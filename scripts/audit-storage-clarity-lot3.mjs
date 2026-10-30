/** Real stock/inventory/placement UI; local transport uses the production placement planner. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/clarity-lot3/storage');
const port = Number(process.env.KQ_STORAGE_CLARITY_AUDIT_PORT ?? 3596), origin = `http://127.0.0.1:${port}`;
const firstId = 'a1111111-1111-4111-8111-111111111111';
const secondId = 'b2222222-2222-4222-8222-222222222222';
const thirdId = 'c3333333-3333-4333-8333-333333333333';
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `const router={push:href=>{window.__navigation=href;}};export const useRouter=()=>router;`,
  'commerce-witness': `import React from 'react';export function KqCommerceComputer(){return null;}`,
  'workshop-witness': `import React from 'react';export function KqWarehouseEntry(){return <div data-workshop-witness>Machines</div>;}`,
  'placement-entry': `
    import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KqHarvestStorage} from '/src/components/placard/KqHarvestStorage';
    import {KqWarehouse} from '/src/components/placard/KqWarehouse';
    import {createKqWarehouseStarter} from '/src/lib/kanab-quest-warehouse';
    import {createKqStorageLot,projectKqStorageLot,planKqStoragePlacement,changeKqStorageCapacity,changeKqStorageMethod,getKqStorageContainer,getKqStorageInventory,KQ_STORAGE_METHODS,KQ_STORAGE_CONTAINERS} from '/src/lib/kanab-quest-storage';
    const params=new URLSearchParams(location.search),now=Date.parse('2026-10-29T12:00:00Z'),stockScenario=params.get('stock'),preJury=params.get('jury');
    const packedOnly=stockScenario==='packed',mixed=stockScenario==='mixed'||stockScenario==='missing'||stockScenario==='many';
    const installed={'GLASS-1L':7,'GLASS-3L':1,'GROVE-1LB':1,'GROVE-1OZ':7,'BOVEDA-1L':1};
    const owned={...installed,'GLASS-1L':9,'GROVE-1LB':2,'BOVEDA-1L':3,'CANNATROL':1};
    const baseline={varietyCode:'HH2026-002',juryScore:8,aroma:75,care:{terpenes:75,cannabinoidExpression:70,cannabinoidConversion:15,cannabinoidOxidation:0}};
    const definitions=packedOnly?[]:[{id:'${firstId}',name:'White Widow CBD',units:stockScenario==='many'?1600:1200,protectedUnits:1200,code:'GLASS-1L',quantity:3},{id:'${secondId}',name:'White Widow CBD',units:stockScenario==='many'?1200:800,protectedUnits:800,code:'GLASS-1L',quantity:2},{id:'${thirdId}',name:'Purple Haze CBD',units:mixed?2500:2000,protectedUnits:2000,code:'GROVE-1LB',quantity:1}];
    const raw=new Map(definitions.map(item=>[item.id,createKqStorageLot({flowerId:item.id,harvestedAt:new Date(now-(preJury==='curing'?1:12)*3600000).toISOString(),baseline:{...baseline,varietyCode:item.id==='${thirdId}'?'HH2026-003':baseline.varietyCode},methodCode:getKqStorageContainer(item.code).methodCode,capacity:{totalUnits:item.units,allocations:[{containerCode:item.code,quantity:item.quantity,storedUnits:item.protectedUnits??item.units}],overflowDeadlineAt:preJury?null:new Date(now-11*3600000).toISOString(),automaticOverflowSale:!preJury}})]));
    let partial=params.has('partial');
    function snapshot(){
      const lots=definitions.map(item=>({flowerId:item.id,varietyName:item.name,harvestGrams:item.units/10,flowerStatus:preJury?'available':'burned',projection:projectKqStorageLot(raw.get(item.id),now)}));
      const inventory=getKqStorageInventory(installed,lots.flatMap(lot=>lot.projection.capacity.allocations));
      const totalUnits=inventory.reduce((sum,row)=>sum+row.ownedQuantity*row.capacityUnits,0);
      const bulkUnits=lots.reduce((sum,lot)=>sum+lot.projection.capacity.totalUnits,0);
      const bulkProtectedUnits=lots.reduce((sum,lot)=>sum+lot.projection.capacity.protectedUnits,0),bulkOverflowUnits=bulkUnits-bulkProtectedUnits;
      const packedActiveUnits=packedOnly?7350:mixed?3000:0,packedPausedUnits=mixed?1350:0,packedOtherUnits=0;
      const packedUnits=packedActiveUnits+packedPausedUnits+packedOtherUnits,packedPackets=packedUnits/50;
      const stockBreakdown={bulkUnits,bulkProtectedUnits,bulkOverflowUnits,packedUnits,packedActiveUnits,packedPausedUnits,packedOtherUnits,packedPackets};
      const reservedUnits=inventory.reduce((sum,row)=>sum+row.occupiedQuantity*row.capacityUnits,0)+packedUnits;
      const usedUnits=bulkUnits+packedUnits;
      const result={serverNow:new Date(now).toISOString(),cashCents:500000,ownedMethodCodes:['STORAGE-GLASS','STORAGE-GROVE','STORAGE-BOVEDA'],defaultMethodCode:'STORAGE-GLASS',catalog:KQ_STORAGE_METHODS,containers:KQ_STORAGE_CONTAINERS,ownedContainers:owned,installedContainers:installed,stockBreakdown,capacity:{totalUnits,reservedUnits,usedUnits,freeUnits:Math.max(0,totalUnits-reservedUnits),overflowUnits:Math.max(bulkOverflowUnits,usedUnits-totalUnits)},overflowSales:[],lots};
      if(stockScenario==='missing')delete result.stockBreakdown;
      if(partial)delete result.lots[1].projection.capacity.allocations;
      return result;
    }
    function place(flowerId,containerCode){
      const lot=raw.get(flowerId);if(!lot)throw new Error('Lot inconnu.');
      const capacity=planKqStoragePlacement({capacity:lot.capacity,containerCode,ownedContainers:installed,reservedAllocations:[...raw.entries()].filter(([id])=>id!==flowerId).flatMap(([,item])=>item.capacity.allocations)});
      raw.set(flowerId,changeKqStorageMethod(changeKqStorageCapacity(lot,capacity,now),getKqStorageContainer(containerCode).methodCode,now));
    }
    const state=createKqWarehouseStarter();
    window.__calls=[];window.__mutations=[];window.__failNextPlace=false;window.__failRead=false;window.__holdPlace=false;window.__holdNextRead=false;
    window.__snapshot=snapshot;window.__raw=()=>Object.fromEntries(raw);window.__initialRaw=JSON.stringify(window.__raw());
    window.__occupyTarget=()=>{place('${secondId}','GLASS-3L');window.dispatchEvent(new Event('kq:storage-updated'));};
    window.__recover=()=>{partial=false;window.__failRead=false;};
    const receipts=new Map(),nativeFetch=window.fetch.bind(window);
    window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return nativeFetch(url,init);
      const call={url:String(url),method:init.method??'GET',body:init.body?JSON.parse(init.body):null};window.__calls.push(call); if(call.method!=='GET'){window.__mutations.push(call.body);throw new Error('Read-only clarity audit rejects mutations');}
      if(call.url==='/api/arena/placard/storage'){
        if(call.method==='POST'){
          window.__mutations.push(call.body);
          if(call.body.action!=='place')throw new Error('Only explicit placement is permitted in this fixture.');
          if(window.__holdPlace)await new Promise(resolve=>window.__releasePlace=resolve);
          if(window.__failNextPlace){window.__failNextPlace=false;return Response.json({error:'Le rangement a été interrompu. Actualise le stockage.'},{status:409});}
          if(receipts.has(call.body.requestKey))return Response.json(receipts.get(call.body.requestKey));
          try{place(call.body.flowerId,call.body.containerCode);}catch(error){return Response.json({error:error.message},{status:409});}
          const result=snapshot();receipts.set(call.body.requestKey,result);return Response.json(result);
        }
        if(window.__failRead)return Response.json({error:'Le stockage est momentanément indisponible.'},{status:503});
        const captured=snapshot();
        if(window.__holdNextRead){window.__holdNextRead=false;await new Promise(resolve=>window.__releaseRead=resolve);}
        return Response.json(captured);
      }
      if(call.url==='/api/arena/placard/warehouse'){const stock=snapshot();return Response.json({state,revision:1,cashCents:500000,activeRun:false,activeRuns:[],completedRuns:[],stockGrams:stock.capacity.usedUnits/10,storageReservedGrams:stock.capacity.reservedUnits/10,storageCapacityGrams:stock.capacity.totalUnits/10,reservedHarvestGrams:0,salesGramsPerDay:30,context:{available:true}});}
      if(call.url==='/api/arena/placard/collection')return Response.json({ownedBuddieCodes:[],buddieRotation:{requiredDistinctBuddies:2,recentBuddieCodes:[]}});
      throw new Error('Unexpected fixture API '+call.url);
    };
    function App(){
      const [mode,setMode]=React.useState(params.has('warehouse')?'warehouse':'harvests'),[flowerId,setFlowerId]=React.useState(params.get('flower')??undefined);
      const harvests=id=>{setFlowerId(id);setMode('harvests');},warehouse=id=>{setFlowerId(id);setMode('warehouse');},market=id=>{window.__market=id;};
      return <main data-fixture-mode={mode}>{mode==='warehouse'?<KqWarehouse embedded initialSection="storage" initialStorageEquipmentOpen={params.has('configure')} initialFlowerId={flowerId} onOpenMarket={market} onOpenHarvests={harvests} onClose={()=>harvests(flowerId)}/>:<KqHarvestStorage initialFlowerId={flowerId} onOpenOverview={harvests} onOpenWarehouse={warehouse} onOpenMarket={market}/>}</main>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `,
};

const server = await createServer({
  root, configFile:false, envDir:false, cacheDir:resolve(output,'vite-cache'), publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},
  resolve:{alias:{'@':resolve(root,'src')}}, css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'storage-placement-audit',enforce:'pre',resolveId(id){
    if(id in modules)return '\0'+id;
    if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';
    if(id==='./KqCommerceDesk')return '\0commerce-witness';
    if(id==='./KqWarehouseEntry')return '\0workshop-witness';
  },async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{
    if(req.url?.split('?')[0]!=='/')return next();
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rangement par récolte · audit local</title><style>@font-face{font-family:"Game Display";src:url("/src/app/fonts/BarlowCondensed-Latin-Bold.woff2");font-weight:700}@font-face{font-family:"Game Body";src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}:root{--font-display:"Game Display";--font-body:"Game Body";--font-sans:"Game Body"}body{margin:0;background:#fff1d6;padding:12px;color:#172923;font-family:var(--font-body),sans-serif}main{max-width:1440px;margin:auto}button,input,select{font-family:inherit}@media(max-width:600px){body{padding:8px}}</style><div id="root"></div><script type="module" src="/@id/__x00__placement-entry"></script></html>');
  });}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null},
});
const phase=process.argv.includes('--before')?'before':'after';
const checks=[],errors=[],remoteRequests=[],measurements=[];let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||['data:','blob:'].includes(url.protocol))void request.continue();else{remoteRequests.push(url.href);void request.abort();}});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const visit=async query=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-storage-container]');await page.evaluate(()=>document.fonts.ready);};
 const enter=async selector=>{await page.focus(selector);await page.keyboard.press('Enter');};
 const check=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' fits the viewport');assert.deepEqual(await page.evaluate(()=>window.__mutations),[],label+' sends no transaction');assert.equal(await page.evaluate(()=>/NaN|Infinity|undefined|Invalid Date/.test(document.body.innerText)),false,label+' has readable data');checks.push(label);};
 const measure=()=>page.evaluate(()=>{const y=selector=>{const node=document.querySelector(selector);return node?Math.round(node.getBoundingClientRect().top+scrollY):null};return{inventoryHeight:Math.round(document.querySelector('[data-storage-inventory]').getBoundingClientRect().height),containerTableY:y('[data-storage-container]'),firstLotY:y('[data-conservation-lot]'),quickActionY:y('[data-storage-jump]'),visibleText:document.querySelector('[data-storage-inventory]').innerText.length};});
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});await visit('stock=mixed');
  const metrics=await page.$$eval('[data-storage-stock] dd',nodes=>Object.fromEntries(nodes.map(node=>[node.closest('[data-storage-stock]').dataset.storageStock,node.textContent])));
  assert.equal(metrics.total,'885 g');assert.equal(metrics.protected,'400 g');assert.equal(metrics.packed,'435 g');
  assert.deepEqual(await page.$$eval('[data-storage-container="GLASS-1L"] td',nodes=>nodes.map(node=>Number(node.textContent))),[7,5,2]);
  measurements.push({width,...await measure()});await check(width+' mixed stock');await page.screenshot({path:resolve(output,`${phase}-mixed-${width}.png`),fullPage:true});
  if(phase==='after'){
   assert.equal(await page.$eval('[data-storage-inventory-details]',node=>node.open),false,'Secondary stock information starts collapsed');
   assert.equal(await page.$eval('[data-storage-stock="overflow"]',node=>node.checkVisibility()),true,'Unprotected flowers stay visible');
   await enter('[data-storage-inventory-details] > summary');assert.equal(await page.$eval('[data-storage-inventory-details]',node=>node.open),true,'Inventory details open by keyboard');
   assert.match(await page.$eval('[data-storage-packed="active"]',node=>node.textContent),/300\s*g/);assert.match(await page.$eval('[data-storage-packed="paused"]',node=>node.textContent),/135\s*g/);await check(width+' expanded details');
   await enter('[data-storage-inventory-details] > summary');
   await enter(`[data-storage-jump="${thirdId}"]`);assert.equal(await page.$eval(`[data-conservation-lot="${thirdId}"]`,node=>node===document.activeElement),true,'The storage shortcut focuses the exact harvest');
   await enter(`[data-storage-placement="${thirdId}"] > summary`);await page.waitForSelector(`[data-storage-placement="${thirdId}"] select`,{visible:true});assert.deepEqual(await page.evaluate(()=>window.__mutations),[],'Opening container choices is not a transaction');
   await visit('stock=missing');assert.deepEqual(await page.$$eval('[data-storage-stock] dd',nodes=>nodes.map(node=>node.textContent)),['—','—','—']);assert.ok(await page.$('[data-storage-breakdown-unavailable]'));await check(width+' missing breakdown');await page.screenshot({path:resolve(output,`after-missing-${width}.png`),fullPage:true});
   await visit('stock=mixed&partial=1');assert.equal(await page.$eval('[data-storage-container="GLASS-1L"] td:last-child',node=>node.textContent),'—');await check(width+' missing allocations');
   await visit('stock=mixed&jury=curing');assert.equal(await page.$$eval('[data-open-jury],[data-open-commerce],[data-sell-overflow]',nodes=>nodes.length),0,'Unjudged curing stock does not offer jury or sale');await check(width+' before jury');
   await visit('stock=mixed&flower='+secondId);await page.waitForFunction(id=>document.activeElement?.dataset.conservationLot===id,{},secondId);await check(width+' selected lot');
   await visit('stock=packed');assert.equal(await page.$eval('[data-storage-stock="packed"] dd',node=>node.textContent),'735 g');assert.equal(await page.$('[data-storage-jump]'),null);await check(width+' packaged-only stock');
   await visit('stock=many&flower='+secondId);assert.equal(await page.$$eval('[data-storage-jump]',nodes=>nodes.length),1,'Several exposed lots still have one compact shortcut');assert.match(await page.$eval('[data-storage-jump]',node=>node.textContent),/Ranger mes 3 lots/);assert.equal(await page.$eval('[data-storage-jump]',node=>node.dataset.storageJump),secondId,'The shortcut keeps the requested exposed harvest');await enter('[data-storage-jump]');assert.equal(await page.$eval(`[data-conservation-lot="${secondId}"]`,node=>node===document.activeElement),true);await check(width+' several exposed lots');
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);await writeFile(resolve(output,`${phase}-report.json`),JSON.stringify({phase,measurements,checks,errors,remoteRequests},null,2));console.log(JSON.stringify({phase,measurements,checks:checks.length,errors,remoteRequests},null,2));
}catch(error){if(page){await page.screenshot({path:resolve(output,phase+'-failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(output,phase+'-failure.json'),JSON.stringify({error:String(error),checks,errors,text:await page.evaluate(()=>document.body.innerText).catch(()=>null)},null,2));}throw error;}
finally{await browser?.close();await server.close();}
