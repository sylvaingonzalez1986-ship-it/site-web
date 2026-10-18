/** Real warehouse UI, synthetic local transactions only. SQL rules have separate tests. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/postharvest');
const port = Number(process.env.KQ_POSTHARVEST_AUDIT_PORT ?? 3282);
const origin = `http://127.0.0.1:${port}`;
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `const router={push:href=>{window.__navigation=href;}};export const useRouter=()=>router;`,
  'commerce-witness': `import React from 'react';export function KqCommerceDesk(){return <div>Atelier des lots</div>;}export function KqCommerceComputer(){return null;}`,
  'workshop-witness': `import React from 'react';export function KqWarehouseEntry(){return <div data-workshop-witness>Atelier</div>;}`,
  'postharvest-entry': `
    import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KqWarehouse} from '/src/components/placard/KqWarehouse';
    import {createKqWarehouseStarter,getKqWarehouseSummary,getKqWarehouseQuote,getKqWarehouseStorageClimateQuote} from '/src/lib/kanab-quest-warehouse';
    import {KQ_STORAGE_METHODS,KQ_STORAGE_CONTAINERS,createKqStorageLot,projectKqStorageLot} from '/src/lib/kanab-quest-storage';
    const params=new URLSearchParams(location.search);
    sessionStorage.clear();
    let state=createKqWarehouseStarter(),revision=1,cashCents=params.has('poor')?100:500000;
    if(params.has('large'))state=getKqWarehouseQuote({...state,serviceZones:state.serviceZones.map(zone=>zone.kind==='storage'?{...zone,width:4}:zone)},state).nextState;
    if(params.has('installed'))state=getKqWarehouseQuote({...state,storageClimateCode:'SIM-STORAGE-CLIMATE-01'},state).nextState;
    if(params.has('reserve'))state={...state,equipment:[...state.equipment,{code:'SIM-STORAGE-CLIMATE-03',quantity:1}]};
    if(params.has('empty')){state={...state,serviceZones:[],equipment:state.equipment.filter(item=>!['SJ-DRYIT90','LP-SUPER-1L'].includes(item.code))};}
    window.__saves=[];window.__state=state;window.__cash=cashCents;
    window.__climateQuote=()=>getKqWarehouseStorageClimateQuote(state);
    const billing=()=>{const quote=getKqWarehouseStorageClimateQuote(state);return {version:1,code:quote.code,areaM2:quote.areaM2,kwhPerM2Month:quote.kwhPerM2,tariffCentsPerKwh:25,monthlyKwh:quote.monthlyKwh,monthlyCostCents:quote.monthlyCents,periodStartedAt:new Date(Date.now()-60*3600000).toISOString(),nextBillingAt:new Date(Date.now()+60*3600000).toISOString(),accruedCents:Math.round(quote.monthlyCents/2),outstandingCents:params.has('debt')?600:0,invoices:params.has('debt')?[{id:'local-unpaid-invoice',periodStartedAt:new Date(Date.now()-180*3600000).toISOString(),periodEndedAt:new Date(Date.now()-60*3600000).toISOString(),amountCents:600,remainingCents:600}]:[]};};
    const snapshot=()=>({state,revision,cashCents,activeRun:false,activeRuns:[],completedRuns:[],legacyActiveRun:false,migrationCreditCents:0,stockGrams:0,storageReservedGrams:0,storageCapacityGrams:getKqWarehouseSummary(state).storageCapacityGrams,reservedHarvestGrams:0,salesGramsPerDay:20,context:{available:true},...(params.has('billing')?{storageClimateBilling:billing()}:{} )});
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return nativeFetch(url,init);
      if(url==='/api/arena/placard/warehouse'){
        if(init.method==='PATCH'){
          const body=JSON.parse(init.body);window.__saves.push(body);
          const quote=getKqWarehouseQuote(body.state,state);
          if(quote.totalCostCents!==body.expectedCostCents||body.expectedRevision!==revision)return Response.json({error:'Devis périmé'},{status:409});
          if(quote.totalCostCents>cashCents)return Response.json({error:'Trésorerie insuffisante'},{status:400});
          state=quote.nextState;cashCents-=quote.totalCostCents;revision++;
          window.__state=state;window.__cash=cashCents;
        }
        return Response.json(snapshot());
      }
      if(url==='/api/arena/placard/storage')return Response.json({serverNow:new Date().toISOString(),cashCents,ownedMethodCodes:['STORAGE-GLASS'],defaultMethodCode:'STORAGE-GLASS',catalog:KQ_STORAGE_METHODS,containers:KQ_STORAGE_CONTAINERS,ownedContainers:{'GLASS-1L':2},capacity:{totalUnits:getKqWarehouseSummary(state).storageCapacityGrams*10,usedUnits:0,freeUnits:getKqWarehouseSummary(state).storageCapacityGrams*10,reservedUnits:0,overflowUnits:0},overflowSales:[],lots:[]});
      if(url==='/api/arena/placard/collection')return Response.json({ownedBuddieCodes:[],buddieRotation:{requiredDistinctBuddies:5,recentBuddieCodes:[]}});
      throw new Error('Unexpected local fixture API: '+url);
    };
    createRoot(document.getElementById('root')).render(<KqWarehouse embedded initialSection={params.get('room')==='drying'?'equipment':'storage'} initialEquipmentCode={params.get('room')==='drying'?'SJ-DRYIT90':undefined} onClose={()=>{}}/>);
  `,
};
const server = await createServer({
  root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom/client','lucide-react']},
  resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{
    name:'postharvest-audit',enforce:'pre',
    resolveId(id){
      if(id in modules)return '\0'+id;
      if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';
      if(id==='./KqCommerceDesk')return '\0commerce-witness';
      if(id==='./KqWarehouseEntry')return '\0workshop-witness';
    },
    async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/')return next();
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Séchage et stockage · audit local</title><style>@font-face{font-family:"Warehouse Display";src:url("/src/app/fonts/BarlowCondensed-Latin-Bold.woff2") format("woff2");font-weight:700}@font-face{font-family:"Warehouse Body";src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2") format("woff2");font-weight:300 700}:root{--font-display:"Warehouse Display";--font-body:"Warehouse Body";--font-sans:"Warehouse Body"}body{margin:0;background:#fff1d6;padding:20px;font-family:var(--font-body),sans-serif;color:#172923}button,input{font-family:inherit}@media(max-width:600px){body{padding:6px}}</style><div id="root"></div><script type="module" src="/@id/__x00__postharvest-entry"></script></html>');
    });},
  }],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null},
});
await mkdir(output,{recursive:true});
await server.listen();
if(process.argv.includes('--preview'))console.log(`Prévisualisation : ${origin}`);
else {
  let browser;
  const checks=[],errors=[];
  const verify=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks.push(label);};
  try {
    browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
    const page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
    page.on('dialog',dialog=>void dialog.accept());
    page.on('pageerror',error=>errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request',request=>void (request.url().startsWith(origin)||request.url().startsWith('data:')?request.continue():request.abort()));
    const visit=async(room,extra='')=>{
      await page.goto(`${origin}/?room=${room}${extra}`,{waitUntil:'networkidle0'});
      await page.waitForSelector(`[data-postharvest-room="${room}"]`);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
    };
    const catalogPrices=()=>page.$$eval('[data-post-harvest-device] footer strong',nodes=>nodes.map(node=>Math.round(Number(node.textContent.replace(/[^0-9,]/g,'').replace(',','.'))*100)));
    const catalogQuality=()=>page.$$eval('[data-post-harvest-device] [role="meter"]',nodes=>nodes.map(node=>Number(node.getAttribute('aria-valuenow'))));
    const catalogProtection=()=>page.$$eval('[data-post-harvest-device]',nodes=>nodes.map(node=>Number(node.querySelector('p[class*="protection"]')?.textContent.match(/(\d+)\s*% de pertes en moins/)?.[1]??0)));
    const climateQuality=()=>page.$$eval('[data-storage-climate-card]',nodes=>nodes.map(node=>Number(node.textContent.match(/\+([\d,]+)\s*\/\s*10/)?.[1]?.replace(',','.'))));
    const climateProtection=()=>page.$$eval('[data-storage-climate-card]',nodes=>nodes.map(node=>Number(node.querySelector('[class*="climateBenefit"] span:last-child')?.textContent.match(/(\d+)\s*% de pertes en moins/)?.[1])));
    const qualityComparison=()=>page.$$eval('[data-quality-tier]',nodes=>nodes.map(node=>({tier:node.dataset.qualityTier,score:Number(node.dataset.resultScore),bonus:Number(node.dataset.qualityBonus),retention:Number(node.dataset.retentionPercent)})));
    const expectedQuality={
      drying:[{tier:'economy',score:6,bonus:0,retention:0},{tier:'standard',score:6.35,bonus:.35,retention:0},{tier:'premium',score:6.7,bonus:.7,retention:0}],
      storage:[{tier:'economy',score:6.1,bonus:.1,retention:10},{tier:'standard',score:6.9,bonus:.9,retention:43},{tier:'premium',score:7.8,bonus:1.8,retention:67}],
    };
    const monthlyCents=selector=>page.$eval(selector,node=>Number(node.dataset.monthlyCents));
    const climateCardQuotes=()=>page.$$eval('[data-storage-climate-card]',nodes=>nodes.map(node=>({areaM2:Number(node.dataset.areaM2),monthlyCents:Number(node.dataset.monthlyCents),kwhPerM2:Number(node.dataset.kwhPerM2),centsPerM2:Number(node.dataset.centsPerM2)})));
    for(const width of process.argv.includes('--interactions-only')?[]:[1440,390,320]){
      await page.setViewport({width,height:1000});
      for(const room of ['drying','storage']){
        await visit(room);
        const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,invalid:/NaN|undefined|Infinity/.test(document.body.textContent),broken:[...document.images].filter(img=>!img.naturalWidth).map(img=>img.src)}));
        verify(layout.overflow,false,`${room}: no overflow ${width}px`);verify(layout.invalid,false,`${room}: finite displayed values ${width}px`);verify(layout.broken,[],`${room}: all illustrations loaded ${width}px`);
        verify(await page.$$eval('[data-warehouse-room]',nodes=>nodes.map(node=>node.dataset.warehouseRoom)),['culture','drying','storage','processing'],'Four separate warehouse tabs');
        verify(await page.$$eval('[data-warehouse-place-device]',nodes=>nodes.map(node=>node.dataset.warehousePlaceDevice).length),3,`${room}: only three relevant equipment ranges`);
        verify(await qualityComparison(),expectedQuality[room],`${room}: the three ranges have clear comparable quality outcomes at ${width}px`);
        await page.screenshot({path:resolve(output,`${room}-${width}.png`),fullPage:true});
        await (await page.$(`[data-postharvest-comparison="${room}"]`)).screenshot({path:resolve(output,`quality-${room}-${width}.png`)});
        console.log(`Verified ${room} at ${width}px`);
      }
    }
    await page.setViewport({width:1440,height:1000});
    await visit('drying');
    verify(await catalogPrices(),[14900,69900,249900],'Drying ranges have progressive prices per square metre');
    verify(await catalogQuality(),[0,.35,.7],'Drying quality has three clearly separated tiers on the comparison meters');
    verify(await qualityComparison(),expectedQuality.drying,'The drying comparison isolates the drying bonus for a six-point harvest');
    await page.focus('[data-warehouse-room="drying"]');await page.keyboard.press('ArrowRight');
    await page.waitForSelector('[data-postharvest-room="storage"]');
    verify(await catalogPrices(),[11960,64900,359600],'Storage prices account for the number of containers per square metre');
    verify(await catalogQuality(),[0,.3,.6],'Storage quality has three clearly separated tiers on the comparison meters');
    verify(await catalogProtection(),[0,25,45],'Storage cards explain stronger preservation at each tier');
    verify(await climateQuality(),[.1,.25,.5],'Climate cards show the larger quality gains alongside their costs');
    verify(await climateProtection(),[10,25,40],'Climate cards show the stronger preservation of the upper tiers');
    verify(await qualityComparison(),expectedQuality.storage,'The full-chain comparison combines quality and multiplicative protection honestly');
    verify(await page.$$eval('[data-storage-climate]',nodes=>nodes.map(node=>Math.round(Number(node.closest('article').querySelector('strong[class*="climatePrice"]').firstChild.textContent.replace(/[^0-9,]/g,'').replace(',','.'))*100))),[49900,179900,499900],'Climate purchase prices clearly separate the three ranges');
    verify(await climateCardQuotes(),[{areaM2:1,monthlyCents:150,kwhPerM2:6,centsPerM2:150},{areaM2:1,monthlyCents:300,kwhPerM2:12,centsPerM2:300},{areaM2:1,monthlyCents:600,kwhPerM2:24,centsPerM2:600}],'Each climate card quotes energy and a monthly cost per square metre');
    verify(await monthlyCents('[data-storage-climate-current]'),0,'No installed climate means no monthly charge');
    verify(await page.$eval('[data-storage-climate-section]',node=>/30 jours/.test(node.textContent)&&/120\s*h/.test(node.textContent)),true,'The game-month duration is explained alongside the monthly costs');
    verify(await page.$eval('[data-warehouse-room="storage"]',node=>node===document.activeElement),true,'Keyboard advances from drying to storage');
    await page.keyboard.press('End');verify(await page.$eval('[data-warehouse-room="processing"]',node=>node===document.activeElement),true,'End reaches the workshop fourth tab');
    await visit('storage');
    await page.focus('[data-quality-start]');await page.keyboard.press('End');
    for(let i=0;i<5;i++)await page.keyboard.press('ArrowLeft');
    verify(await page.$eval('[data-quality-start]',node=>Number(node.value)),9.5,'The quality comparison is operable with the keyboard');
    verify((await qualityComparison()).map(row=>row.score),[9.6,10,10],'The live comparison caps the final commercial score at ten');
    verify(await page.evaluate(()=>window.__saves.length),0,'Comparing a harvest score does not modify or purchase equipment');
    await visit('drying');
    await page.click('[data-postharvest-upgrade="starter-drying"][data-device-code="SIM-DRYING-02"]');
    verify(await page.evaluate(()=>window.__saves.length),0,'Choosing a drying upgrade only prepares the quote');
    await page.waitForSelector('[data-postharvest-basket]');
    await page.click('[data-postharvest-basket] [data-warehouse-action="save"]');
    await page.waitForFunction(()=>window.__state.serviceZones.find(zone=>zone.id==='starter-drying').deviceCode==='SIM-DRYING-02');
    verify(await page.evaluate(()=>window.__state.equipment.some(item=>item.code==='SJ-DRYIT90')),true,'Old drying equipment remains in reserve');
    verify(await page.evaluate(()=>window.__cash<500000),true,'Installing the drying upgrade charges the quote');
    await page.click('[data-warehouse-room="storage"]');
    await page.click('[data-storage-climate="SIM-STORAGE-CLIMATE-01"]');
    verify(await page.evaluate(()=>window.__state.storageClimateCode??null),null,'Climate choice is not applied before installation');
    await page.click('[data-postharvest-basket] [data-warehouse-action="save"]');
    await page.waitForFunction(()=>window.__state.storageClimateCode==='SIM-STORAGE-CLIMATE-01');
    verify(await page.evaluate(()=>window.__state.equipment.find(item=>item.code==='SIM-STORAGE-CLIMATE-01').quantity),1,'Exactly one selected climate unit is purchased');
    verify(await monthlyCents('[data-storage-climate-current]'),150,'Installed economy climate costs 1.50 euros for one square metre each month');
    verify(await page.$eval('[data-storage-climate-current]',node=>node.textContent.includes('Prochaine facture')),false,'The UI does not invent a billing date when the server has not supplied one');
    await page.waitForFunction(()=>!document.querySelector('[data-postharvest-basket]'));
    await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
    await page.screenshot({path:resolve(output,'storage-equipped-1440.png'),fullPage:true});
    await page.setViewport({width:320,height:1000});
    verify(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Installed climate illustration fits at 320px');
    await page.screenshot({path:resolve(output,'storage-equipped-320.png'),fullPage:true});
    await page.setViewport({width:1440,height:1000});
    await page.click('[data-storage-climate-remove]');
    verify(await monthlyCents('[data-storage-climate-current]'),150,'Removing climate in a draft does not change the installed monthly charge');
    verify(await monthlyCents('[data-storage-climate-preview]'),0,'The removal draft previews zero future monthly charge');
    await page.click('[data-postharvest-basket] [data-warehouse-action="save"]');
    await page.waitForFunction(()=>!window.__state.storageClimateCode);
    verify(await page.evaluate(()=>window.__state.equipment.find(item=>item.code==='SIM-STORAGE-CLIMATE-01').quantity),1,'Removing climate preserves the owned unit');
    verify(await monthlyCents('[data-storage-climate-current]'),0,'A climate unit kept in reserve has no recurring charge');
    await visit('storage','&reserve');
    verify(await monthlyCents('[data-storage-climate-current]'),0,'Owning a premium climate unit alone does not add monthly costs');
    verify(await page.$eval('[data-storage-climate="SIM-STORAGE-CLIMATE-03"]',node=>node.textContent.trim()),'Installer','A climate unit in reserve can be reused without another purchase');
    await page.click('[data-storage-climate="SIM-STORAGE-CLIMATE-03"]');
    await page.click('[data-postharvest-basket] [data-warehouse-action="save"]');
    await page.waitForFunction(()=>window.__state.storageClimateCode==='SIM-STORAGE-CLIMATE-03');
    verify(await page.evaluate(()=>window.__cash),500000,'Reinstalling a climate unit from reserve does not charge its purchase price again');
    verify(await monthlyCents('[data-storage-climate-current]'),600,'Reinstalling the owned premium unit starts its monthly consumption');
    for(const width of process.argv.includes('--interactions-only')?[1440]:[1440,390,320]){
      await page.setViewport({width,height:1000});
      await visit('storage','&large&installed&billing');
      verify(await monthlyCents('[data-storage-climate-current]'),600,`Four square metres cost four times as much, at ${width}px`);
      verify(await climateCardQuotes(),[{areaM2:4,monthlyCents:600,kwhPerM2:6,centsPerM2:150},{areaM2:4,monthlyCents:1200,kwhPerM2:12,centsPerM2:300},{areaM2:4,monthlyCents:2400,kwhPerM2:24,centsPerM2:600}],`All climate card totals follow the configured area at ${width}px`);
      verify(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Monthly billing fits at ${width}px`);
      verify(await page.$eval('[data-storage-climate-current]',node=>/Consommation engagée\s*3\s*€/.test(node.textContent)&&node.textContent.includes('Prochaine facture')),true,`Server-provided accrued cost and billing date are shown at ${width}px`);
      await page.screenshot({path:resolve(output,`storage-monthly-${width}.png`),fullPage:true});
      await (await page.$('[data-storage-climate-section]')).screenshot({path:resolve(output,`climate-monthly-${width}.png`)});
    }
    await page.setViewport({width:1440,height:1000});
    await page.click('[data-storage-climate="SIM-STORAGE-CLIMATE-02"]');
    verify(await monthlyCents('[data-storage-climate-current]'),600,'An unsaved range upgrade retains the current installed cost');
    verify(await monthlyCents('[data-storage-climate-preview]'),1200,'The upgrade quote previews the new monthly cost for the entire room');
    verify(await page.evaluate(()=>window.__state.storageClimateCode),'SIM-STORAGE-CLIMATE-01','A monthly preview never changes installed equipment');
    await page.click('[data-postharvest-basket] [data-warehouse-action="reset"]');
    verify(await page.$('[data-storage-climate-preview]'),null,'Cancelling the draft removes its future monthly charge');
    await page.click('[data-post-harvest-zone="starter-storage"] button[aria-label]');
    await page.waitForSelector('[data-warehouse-zone-dialog]');
    await page.click('[data-warehouse-zone-settings] summary');
    let widthField=await page.$('[data-warehouse-zone-settings] input[type="number"]');
    await widthField.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await widthField.type('42');await widthField.press('Tab');
    await page.click('[data-warehouse-zone-dialog] button[aria-label="Fermer"]');
    await page.click('[data-warehouse-room="storage"]');
    verify(await page.$eval('[role="alert"] button',node=>node.textContent),'Corriger les dimensions sur le plan','An invalid room width offers a recoverable error instead of crashing storage');
    verify(await page.$eval('[data-postharvest-basket] [data-warehouse-action="save"]',node=>node.disabled),true,'An invalid room cannot be installed');
    await page.click('[role="alert"] button');
    verify(await page.$eval('[data-warehouse-room="culture"]',node=>node.getAttribute('aria-selected')),'true','The correction action returns to the warehouse plan');
    await page.click('[data-warehouse-action="configure-selected"]');
    await page.waitForSelector('[data-warehouse-zone-dialog]');
    await page.click('[data-warehouse-zone-settings] summary');
    widthField=await page.$('[data-warehouse-zone-settings] input[type="number"]');
    await widthField.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await widthField.type('2');await widthField.press('Tab');
    verify(await widthField.evaluate(node=>node.value),'2','The storage width draft is two metres');
    await page.click('[data-warehouse-zone-dialog] button[aria-label="Fermer"]');
    await page.click('[data-warehouse-room="storage"]');
    verify(await monthlyCents('[data-storage-climate-current]'),600,'Resizing the draft keeps the charge for the installed four-square-metre room');
    verify(await monthlyCents('[data-storage-climate-preview]'),300,'Reducing the storage room to two square metres halves its future monthly cost');
    await page.click('[data-postharvest-basket] [data-warehouse-action="save"]');
    await page.waitForFunction(()=>window.__state.serviceZones.find(zone=>zone.id==='starter-storage').width===2);
    verify(await monthlyCents('[data-storage-climate-current]'),300,'Saving the resized room updates the installed monthly quote');
    await visit('storage','&large&installed&billing&debt');
    verify(await page.$eval('[data-storage-climate-current]',node=>/Factures restant à payer\s*6\s*€/.test(node.textContent)),true,'Unpaid monthly electricity remains visible in the storage room');
    await visit('storage','&poor');await page.click('[data-storage-climate="SIM-STORAGE-CLIMATE-03"]');
    verify(await page.$eval('[data-postharvest-basket] [data-warehouse-action="save"]',node=>node.disabled),true,'Insufficient funds prevent installing climate');
    await visit('storage','&empty');
    verify(await page.$$eval('[data-storage-climate]',nodes=>nodes.every(node=>node.disabled)),true,'A storage room is required before installing climate');
    await visit('drying');await page.click('[data-warehouse-place-device="SIM-DRYING-03"]');
    verify(await page.$eval('[data-warehouse-room="culture"]',node=>node.getAttribute('aria-selected')),'true','Placing a drying zone opens the floor plan');
    verify(errors,[],'No browser runtime errors');
    await writeFile(resolve(output,process.argv.includes('--interactions-only')?'audit-interactions.json':'audit.json'),JSON.stringify({checks,errors},null,2));
    console.log(JSON.stringify({checks:checks.length,output},null,2));
  } finally {await browser?.close();await server.close();}
}
