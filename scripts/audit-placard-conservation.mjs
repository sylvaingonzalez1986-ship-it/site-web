/** Actual conservation component and warehouse wiring, entirely synthetic local API. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/conservation');
const port = Number(process.env.KQ_CONSERVATION_AUDIT_PORT ?? 3278);
const origin = `http://127.0.0.1:${port}`;
const readyId = 'd98e8471-1111-4111-8111-111111111111';
const curingId = 'a18f0172-2222-4222-8222-222222222222';
const overflowId = 'e24c9183-3333-4333-8333-333333333333';
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `const router={push:href=>{window.__navigation=href;}};export const useRouter=()=>router;`,
  'commerce-witness': `import React from 'react';export function KqCommerceDesk({initialFlowerId}){return <output data-selected-workshop-lot={initialFlowerId}>Lot sélectionné : {initialFlowerId}</output>;}export function KqCommerceComputer(){return null;}`,
  'workshop-witness': `import React from 'react';export function KqWarehouseEntry(){return <div data-workshop-witness>Atelier</div>;}`,
  'conservation-entry': `
    import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KqWarehouseHarvests} from '/src/components/placard/KqWarehouseHarvests';
    import {KqWarehouse} from '/src/components/placard/KqWarehouse';
    import {createKqWarehouseStarter,getKqWarehouseSummary} from '/src/lib/kanab-quest-warehouse';
    import {createKqStorageLot,projectKqStorageLot,KQ_STORAGE_METHODS,KQ_STORAGE_CONTAINERS} from '/src/lib/kanab-quest-storage';
    const query=new URLSearchParams(location.search),scenario=query.get('scenario')??'ready';
    const now=Date.parse('2026-10-18T12:00:00Z');
    const baseline={varietyCode:'HH2026-002',juryScore:8.5,aroma:75,care:{terpenes:75,cannabinoidExpression:70,cannabinoidConversion:15,cannabinoidOxidation:0}};
    function makeLot(flowerId,varietyName,units,ageHours,overflowUnits=0){
      const protectedUnits=units-overflowUnits;
      const capacity={totalUnits:units,allocations:protectedUnits?[{containerCode:'GLASS-3L',quantity:Math.ceil(protectedUnits/1500),storedUnits:protectedUnits}]:[],overflowDeadlineAt:overflowUnits?new Date(now+1800000).toISOString():null,automaticOverflowSale:true};
      const lot=createKqStorageLot({flowerId,harvestedAt:new Date(now-ageHours*3600000).toISOString(),baseline,capacity});
      return {flowerId,varietyName,harvestGrams:units/10,flowerStatus:'available',projection:projectKqStorageLot(lot,now),...(overflowUnits?{overflowOffer:{units:overflowUnits,payoutCents:6750,netPayoutCents:5400}}:{})};
    }
    const ready=makeLot('${readyId}','White Widow CBD',1655,12);
    const curing=makeLot('${curingId}','Purple Haze CBD',2875,3);
    const overflow=makeLot('${overflowId}','Critical CBD',5000,12,1250);
    const lots=scenario==='empty'?[]:scenario==='mixed'||scenario==='overflow'?[ready,curing,overflow]:[ready];
    if(scenario==='long')ready.varietyName='Une variété au nom particulièrement long pour vérifier la lisibilité des cartes';
    if(scenario==='ready-by-clock'){ready.projection.stage='curing';ready.projection.progressPercent=99.9;}
    if(scenario==='no-offer') { lots.splice(0,lots.length,overflow);delete overflow.overflowOffer; }
    window.__workshopCalls=[];window.__overflowCalls=[];window.__apiCalls=[];window.__retryCalls=0;window.__holdSale=query.has('hold');
    window.__releaseSale=null;
    const storage={serverNow:new Date(now).toISOString(),cashCents:587484,ownedMethodCodes:['STORAGE-GLASS'],defaultMethodCode:'STORAGE-GLASS',catalog:KQ_STORAGE_METHODS,containers:KQ_STORAGE_CONTAINERS,ownedContainers:{'GLASS-3L':30},installedContainers:{'GLASS-3L':30},capacity:{totalUnits:40000,usedUnits:scenario==='empty'?0:9530,freeUnits:scenario==='empty'?40000:2100,reservedUnits:scenario==='empty'?0:37900,overflowUnits:lots.reduce((sum,lot)=>sum+lot.projection.capacity.overflowUnits,0)},overflowSales:[],lots};
    const state=createKqWarehouseStarter();
    const snapshot={state,revision:1,cashCents:587484,activeRun:false,activeRuns:[],completedRuns:[],stockGrams:scenario==='empty'?0:953,storageReservedGrams:scenario==='empty'?0:3790,storageCapacityGrams:4000,reservedHarvestGrams:0,salesGramsPerDay:30,context:{available:true}};
    const original=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return original(url,init);
      const call={url:String(url),method:init.method??'GET',body:init.body?JSON.parse(init.body):null};window.__apiCalls.push(call);
      if(call.url==='/api/arena/placard/warehouse')return Response.json(snapshot);
      if(call.url==='/api/arena/placard/collection')return Response.json({ownedBuddieCodes:[],buddieRotation:{requiredDistinctBuddies:2,recentBuddieCodes:[]}});
      if(call.url==='/api/arena/placard/storage'){
        if(call.method==='POST'){
          window.__overflowCalls.push(call.body);
          if(window.__holdSale)await new Promise(resolve=>window.__releaseSale=resolve);
          const sold=storage.lots.find(lot=>lot.flowerId===call.body.flowerId);
          sold.projection.capacity.totalUnits-=sold.projection.capacity.overflowUnits;
          sold.projection.capacity.overflowUnits=0;delete sold.overflowOffer;
        }
        return Response.json(storage);
      }
      throw new Error('Unexpected local fixture API: '+call.url);
    };
    const draftStore=query.has('dirty')?{read:()=>({...state,zones:state.zones.map((zone,index)=>index?zone:{...zone,name:'Brouillon non enregistré'})}),write:()=>{}}:undefined;
    function Fixture(){
      const [disabled,setDisabled]=React.useState(query.has('disabled'));
      React.useEffect(()=>{window.__setDisabled=setDisabled;},[]);
      return query.has('integration')?<KqWarehouse embedded initialSection="storage" draftStore={draftStore} onClose={()=>{}}/>:<main data-conservation-fixture><KqWarehouseHarvests storage={['loading','unknown','error'].includes(scenario)?null:storage} stockGrams={scenario==='loading'||scenario==='unknown'?null:snapshot.stockGrams} storageReservedGrams={scenario==='loading'||scenario==='unknown'?null:snapshot.storageReservedGrams} storageCapacityGrams={scenario==='unknown'?null:4000} disabled={disabled} error={scenario==='error'?'Lecture des lots interrompue.':undefined} onRetry={()=>window.__retryCalls++} onOpenWorkshop={flowerId=>window.__workshopCalls.push(flowerId)} onSellOverflow={flowerId=>window.__overflowCalls.push(flowerId)}/></main>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `,
};
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
  resolve: { alias: { '@': resolve(root, 'src') } }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'conservation-audit', enforce: 'pre',
    resolveId(id) {
      if (id in modules) return '\0' + id;
      if (id.endsWith('/public/placard/warehouse-v2/manifest.json')) return '\0warehouse-assets';
      if (id === './KqCommerceDesk') return '\0commerce-witness';
      if (id === './KqWarehouseEntry') return '\0workshop-witness';
    },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conservation · audit local</title><style>@font-face{font-family:"Warehouse Display";src:url("/src/app/fonts/BarlowCondensed-Latin-Bold.woff2") format("woff2");font-weight:700;font-display:swap}@font-face{font-family:"Warehouse Body";src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2") format("woff2");font-weight:300 700;font-display:swap}:root{--font-display:"Warehouse Display";--font-body:"Warehouse Body";--font-sans:"Warehouse Body";--ink:#172923;--muted:#536058;--green:#076c61;--line:#17292355}body{margin:0;background:#fff1d6;padding:24px;font-family:var(--font-body),sans-serif;color:#172923}main{max-width:1500px;margin:auto}button,input{font-family:inherit}@media(max-width:600px){body{padding:10px}}</style><div id="root"></div><script type="module" src="/@id/__x00__conservation-entry"></script></html>');
      });
    },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

await mkdir(output, { recursive: true });
await server.listen();
if (process.argv.includes('--preview')) {
  console.log(`Prévisualisation locale : ${origin}/?scenario=mixed`);
} else {
  let browser, page;
  const errors = [], checks = [], screenshots = [];
  const verify = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks.push(label); };
  try {
    browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    page = await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
    page.on('dialog',dialog=>void dialog.accept());
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.setRequestInterception(true);
    page.on('request', request => void (request.url().startsWith(origin) || request.url().startsWith('data:') ? request.continue() : request.abort()));
    const visit = async (scenario, extra='') => {
      await page.goto(`${origin}/?scenario=${scenario}${extra}`, { waitUntil:'networkidle0' });
      await page.waitForSelector('[data-conservation-summary]');
      await page.evaluate(() => document.fonts.ready);
      console.log(`Fixture ready: ${scenario}${extra}`);
    };
    const screenshot = async name => { await page.screenshot({ path:resolve(output, `${name}.png`), fullPage:true });screenshots.push(`${name}.png`); };
    const layout = async () => page.evaluate(() => ({
      overflow:document.documentElement.scrollWidth>innerWidth,
      invalidText:/NaN|Infinity|undefined|Invalid Date/.test(document.body.textContent),
      brokenImages:[...document.images].filter(image=>!image.complete||!image.naturalWidth).map(image=>image.src),
      controls:[...document.querySelectorAll('[data-conservation-summary] button,[data-conservation-summary] a,[data-conservation-summary] summary')].filter(node=>node.getClientRects().length>0).map(node=>({label:node.textContent.trim(),width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})),
    }));

    for (const width of process.argv.includes('--interactions-only')?[]:[1440,390,320]) {
      await page.setViewport({ width, height:1000 });
      for (const scenario of ['ready','mixed','empty','loading','error','long']) {
        await visit(scenario);
        const measured=await layout();
        verify(measured.overflow,false,`${scenario}: no horizontal overflow at ${width}px`);
        verify(measured.invalidText,false,`${scenario}: no invalid values at ${width}px`);
        verify(measured.brokenImages,[],`${scenario}: illustrations load at ${width}px`);
        verify(measured.controls.every(control=>control.height>=44),true,`${scenario}: accessible touch targets at ${width}px`);
        if(scenario!=='long')await screenshot(`${scenario}-${width}`);
      }
    }

    await page.setViewport({width:1440,height:1000});
    await visit('ready');
    verify(await page.$eval('[data-storage-summary-details]',node=>node.open),false,'Stock and capacity details are initially collapsed');
    await page.click('[data-storage-summary-details] > summary');
    await page.waitForFunction(()=>document.querySelector('[data-storage-summary-details]')?.open);
    const normalizedText=await page.$eval('[data-conservation-summary]',node=>node.textContent.replaceAll('\u00a0',' ').replaceAll('\u202f',' '));
    verify(normalizedText.includes('953 g'),true,'Global stock shows 953 g independently of the one raw lot');
    verify(normalizedText.includes('165,5 g'),true,'The current raw lot keeps its own 165.5 g mass');
    verify(normalizedText.includes('3,79 kg'),true,'Reserved containers show 3.79 kg of capacity, not stock');
    const capacity=await page.$eval('[data-conservation-capacity] [role="meter"]',node=>({value:Number(node.getAttribute('aria-valuenow')),max:Number(node.getAttribute('aria-valuemax'))}));
    verify(capacity,{value:3790,max:4000},'Capacity meter uses reserved 3790 / installed 4000 g');
    verify(await page.$eval('[data-conservation-capacity] [role="meter"]',node=>node.getAttribute('role')),'meter','Container occupancy is a meter rather than a progress task');
    verify(await page.$eval('[data-conservation-summary] a',node=>node.getAttribute('href')),'/arene/placard?view=harvests','All-harvests link is retained');
    await page.focus(`[data-open-workshop="${readyId}"]`);
    await page.keyboard.press('Enter');
    verify(await page.evaluate(()=>window.__workshopCalls),[readyId],'Keyboard workshop action passes the exact selected lot ID');

    await visit('mixed');
    verify(await page.$$eval('[data-conservation-lot]',nodes=>nodes.length),3,'Ready, curing and overflow lots render separately');
    verify(await page.$$eval('[data-open-workshop]:not(:disabled)',nodes=>nodes.map(node=>node.getAttribute('data-open-workshop'))),[readyId,curingId],'Ready and curing lots without surplus can inspect the commerce desk');
    await page.click(`[data-open-workshop="${curingId}"]`);
    verify(await page.evaluate(()=>window.__workshopCalls),[curingId],'Inspecting a curing lot forwards its exact ID without declaring it mature');
    const progress=await page.$eval(`[data-conservation-lot="${curingId}"] [data-curing-progress] [role="meter"]`,node=>({value:Number(node.getAttribute('aria-valuenow')),max:Number(node.getAttribute('aria-valuemax')),label:node.getAttribute('aria-label'),lotName:node.closest('[data-conservation-lot]').querySelector('h4').textContent}));
    verify(progress.value,50,'Three of six curing hours produce 50% progress');
    verify(progress.max,100,'Curing progress has an explicit 100% maximum');
    verify({label:progress.label,lotName:progress.lotName},{label:'Affinage',lotName:'Purple Haze CBD'},'The named curing meter stays inside its identified lot');
    await page.click(`[data-sell-overflow="${overflowId}"]`);
    verify(await page.evaluate(()=>window.__overflowCalls),[overflowId],'Surplus action passes the exact overflow lot ID');
    await page.evaluate(()=>window.__setDisabled(true));
    await page.waitForFunction(id=>document.querySelector(`[data-sell-overflow="${id}"]`)?.disabled,{},overflowId);
    verify(await page.$eval(`[data-open-workshop="${curingId}"]`,node=>node.disabled),true,'The parent disabled guard also blocks opening a curing lot');
    await page.$eval(`[data-open-workshop="${curingId}"]`,node=>node.click());
    verify(await page.evaluate(()=>window.__workshopCalls),[curingId],'A disabled commerce action cannot trigger another callback');
    await page.$eval(`[data-sell-overflow="${overflowId}"]`,node=>node.click());
    verify(await page.evaluate(()=>window.__overflowCalls),[overflowId],'Disabled surplus sale cannot trigger another callback');

    await visit('ready-by-clock');
    verify(await page.$$eval('[data-open-workshop]:not(:disabled)',nodes=>nodes.length),1,'A lot awaiting server maturity can still inspect the commerce desk');
    verify(await page.$eval('[data-curing-status]',node=>node.textContent.trim()),'Curing en cours','Curing status waits for server-confirmed maturity');
    verify(await page.$eval('[data-curing-progress] [role="meter"]',node=>node.getAttribute('aria-valuetext')),'99 %','A curing lot at 99.9% never appears complete before server confirmation');
    verify(await page.$eval('[data-conservation-lot]',node=>node.getAttribute('data-ready')),'false','Opening commerce does not mark an unconfirmed lot ready');
    await visit('unknown');
    await page.click('[data-storage-summary-details] > summary');
    await page.waitForFunction(()=>document.querySelector('[data-storage-summary-details]')?.open);
    verify(await page.$$eval('[data-conservation-capacity] [role="meter"]',nodes=>nodes.length),0,'Unknown capacity is not presented as zero-percent occupancy');
    verify(await page.$eval('[data-conservation-capacity]',node=>node.textContent.includes('Capacité à confirmer')),true,'Unknown capacity has an explicit label rather than invalid meter semantics');
    await visit('no-offer');
    verify(await page.$$eval('[data-sell-overflow]',nodes=>nodes.length),0,'Unavailable clearance offers do not expose a sale button');
    verify((await page.$eval(`[data-conservation-lot="${overflowId}"]`,node=>node.textContent)).includes('125'),true,'Surplus mass stays visible without a sale offer');

    await visit('loading');
    verify(await page.$$eval('[data-conservation-lot]',nodes=>nodes.length),0,'Loading never fabricates empty lot cards');
    verify(/Chargement|actualisation/.test(await page.$eval('[data-conservation-summary]',node=>node.textContent)),true,'Loading state has visible explanatory text');
    await visit('error');
    const retry=await page.$('[data-conservation-summary] button');
    assert.ok(retry,'A failed storage load offers a retry');await retry.click();
    verify(await page.evaluate(()=>window.__retryCalls),1,'Retry action calls the loader once');

    // Full parent integration: only the downstream workshop is replaced by a witness.
    for (const width of [1440,390]) {
      await page.setViewport({width,height:1000});
      await visit('ready','&integration');
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-conservation-summary] img')].every(image=>image.complete&&image.naturalWidth>0));
      const block=await page.$('[data-conservation-summary]');
      await block.screenshot({path:resolve(output,`warehouse-ready-${width}.png`)});
      screenshots.push(`warehouse-ready-${width}.png`);
      verify(await block.evaluate(node=>node.scrollWidth<=node.clientWidth),true,`Conservation fits its actual warehouse context at ${width}px`);
    }
    await page.setViewport({width:1440,height:1000});
    await visit('ready','&integration');
    await page.click(`[data-open-workshop="${readyId}"]`);
    await page.waitForSelector('[data-selected-workshop-lot]');
    verify(await page.$eval('[data-selected-workshop-lot]',node=>node.getAttribute('data-selected-workshop-lot')),readyId,'KqWarehouse forwards the selected flower ID to its commerce desk');
    verify(await page.$eval('[data-warehouse-room="processing"]',node=>node.getAttribute('aria-selected')),'true','Lot action switches the actual parent into the workshop');

    await visit('mixed','&integration&dirty');
    verify(await page.$eval(`[data-sell-overflow="${overflowId}"]`,node=>node.disabled),true,'Parent unsaved draft disables surplus sale');
    await page.$eval(`[data-sell-overflow="${overflowId}"]`,node=>node.click());
    verify(await page.evaluate(()=>window.__overflowCalls.length),0,'Parent draft cannot issue a sale request');
    await visit('mixed','&integration&hold');
    await page.click(`[data-sell-overflow="${overflowId}"]`);
    await page.waitForFunction(()=>window.__overflowCalls.length===1);
    verify(await page.$eval(`[data-sell-overflow="${overflowId}"]`,node=>node.disabled),true,'Parent pending request disables another surplus sale');
    const saleRequest=await page.evaluate(()=>window.__overflowCalls[0]);
    verify(saleRequest.action,'sell-overflow','Surplus sale preserves the existing storage action');
    verify(saleRequest.flowerId,overflowId,'Parent sale request preserves selected lot ID');
    verify(typeof saleRequest.requestKey,'string','Parent sale retains its idempotency request key');
    await page.evaluate(()=>window.__releaseSale());
    await page.waitForFunction(()=>!document.querySelector('[data-sell-overflow]'));
    verify(await page.$$eval('[data-conservation-lot]',nodes=>nodes.length),3,'Selling surplus preserves the rest of all lots');
    verify(await page.$$eval('[data-open-workshop]:not(:disabled)',nodes=>nodes.map(node=>node.getAttribute('data-open-workshop'))),[readyId,overflowId,curingId],'The protected remainder can open commerce alongside the other ready or curing lots');

    verify(errors,[],'No browser runtime errors');
    await writeFile(resolve(output,'audit.json'),JSON.stringify({checks,screenshots,errors},null,2));
    console.log(JSON.stringify({checks:checks.length,screenshots:screenshots.length,output},null,2));
  } catch(error) {
    console.error('Audit failure:',error);
    throw error;
  } finally {
    await browser?.close();await server.close();
  }
}
