/** Real stock/inventory/placement UI; local transport uses the production placement planner. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/storage-placement');
const port = Number(process.env.KQ_STORAGE_PLACEMENT_AUDIT_PORT ?? 3587), origin = `http://127.0.0.1:${port}`;
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
    const packedOnly=stockScenario==='packed',mixed=stockScenario==='mixed'||stockScenario==='missing';
    const installed={'GLASS-1L':7,'GLASS-3L':1,'GROVE-1LB':1,'GROVE-1OZ':7,'BOVEDA-1L':1};
    const owned={...installed,'GLASS-1L':9,'GROVE-1LB':2,'BOVEDA-1L':3,'CANNATROL':1};
    const baseline={varietyCode:'HH2026-002',juryScore:8,aroma:75,care:{terpenes:75,cannabinoidExpression:70,cannabinoidConversion:15,cannabinoidOxidation:0}};
    const definitions=packedOnly?[]:[{id:'${firstId}',name:'White Widow CBD',units:1200,code:'GLASS-1L',quantity:3},{id:'${secondId}',name:'White Widow CBD',units:800,code:'GLASS-1L',quantity:2},{id:'${thirdId}',name:'Purple Haze CBD',units:mixed?2500:2000,protectedUnits:2000,code:'GROVE-1LB',quantity:1}];
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
      const call={url:String(url),method:init.method??'GET',body:init.body?JSON.parse(init.body):null};window.__calls.push(call);
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
      return <main data-fixture-mode={mode}>{mode==='warehouse'?<KqWarehouse embedded initialSection="storage" initialFlowerId={flowerId} onOpenMarket={market} onOpenHarvests={harvests} onClose={()=>harvests(flowerId)}/>:<KqHarvestStorage initialFlowerId={flowerId} onOpenOverview={harvests} onOpenWarehouse={warehouse} onOpenMarket={market}/>}</main>;
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
const checks=[],errors=[],remoteRequests=[],screenshots=[];let browser,page;
const verify=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks.push(label);};
const editor=id=>`[data-storage-placement="${id}"]`;
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||['data:','blob:'].includes(url.protocol))void request.continue();else{remoteRequests.push(url.href);void request.abort();}});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-storage-inventory] [data-storage-container]');await page.evaluate(()=>document.fonts.ready);};
  const press=async selector=>{await page.focus(selector);await page.keyboard.press('Enter');};
  const pressText=async(label,scope='')=>{const button=await page.waitForFunction(({label,scope})=>[...document.querySelectorAll(scope+' button')].find(node=>node.checkVisibility()&&node.textContent.trim()===label&&!node.disabled),{},{label,scope});await button.asElement().focus();await page.keyboard.press('Enter');await button.dispose();};
  const openEditor=async(id=firstId)=>{if(!await page.$eval(editor(id),node=>node.open))await press(editor(id)+' > summary');await page.waitForSelector(editor(id)+' select',{visible:true});};
  const choose=async(code,id=firstId)=>{await openEditor(id);await page.select(editor(id)+' select',code);};
  const inventory=code=>page.$$eval(`[data-storage-container="${code}"] td`,nodes=>nodes.map(node=>Number(node.textContent)));
  const stockMetrics=()=>page.$$eval('[data-storage-stock] dd',nodes=>Object.fromEntries(nodes.map(node=>[node.closest('[data-storage-stock]').dataset.storageStock,node.textContent])));
  const mutations=()=>page.evaluate(()=>window.__mutations);
  const layout=async label=>{verify(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+': no horizontal overflow');verify(await page.evaluate(()=>/NaN|Infinity|undefined|Invalid Date/.test(document.body.innerText)),false,label+': values remain readable');};
  const shot=async name=>{screenshots.push(name+'.png');await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};

  for(const width of [320,390,1440]){
    await page.setViewport({width,height:1000,isMobile:width<700,hasTouch:width<700});
    await visit('jury=curing');
    verify(await page.$$eval('[data-open-commerce],[data-open-jury],[data-sell-overflow]',nodes=>nodes.length),0,`${width}: curing opens neither jury nor commerce before maturity`);
    verify(await page.$$eval('[data-storage-placement]',nodes=>nodes.length),3,`${width}: every variety can choose containers before jury`);
    verify(await page.$$eval('[data-lot-quality] dt',nodes=>nodes.every(node=>node.textContent==='Qualité estimée')),true,`${width}: pre-jury quality is an estimate rather than a verdict`);
    await layout(`${width} pre-jury curing`);await shot(`pre-jury-curing-${width}`);
    verify(await mutations(),[],`${width}: reading pre-jury storage changes no stock`);
    await visit('jury=ready');
    verify(await page.$$eval('[data-open-jury]',nodes=>nodes.length),3,`${width}: mature unjudged lots open the jury`);
    verify(await page.$$eval('[data-open-commerce],[data-sell-overflow]',nodes=>nodes.length),0,`${width}: mature unjudged lots still wait for a verdict before commerce`);
    verify(await page.$eval(`[data-open-jury="${firstId}"]`,(node,id)=>node.href.includes('view=arena')&&node.href.includes('flower='+id),firstId),true,`${width}: the jury link keeps the exact harvest identity`);
    await page.focus(`[data-open-jury="${firstId}"]`);
    verify(await page.evaluate(()=>document.activeElement.hasAttribute('data-open-jury')),true,`${width}: a mature lot's jury link is keyboard accessible`);
    await layout(`${width} pre-jury ready`);await shot(`pre-jury-ready-${width}`);
    await page.setViewport({width,height:1000,isMobile:width<700,hasTouch:width<700});await visit();
    verify(await page.evaluate(()=>!!(document.querySelector('[data-storage-inventory]').compareDocumentPosition(document.querySelector('[data-conservation-lot]'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,`${width}: stock and installed containers precede the harvest list`);
    verify(await page.$$eval('[data-conservation-lot]',nodes=>nodes.length),3,`${width}: three independent harvests remain visible`);
    verify(await page.$$eval('[data-conservation-lot] h4',nodes=>nodes.map(node=>node.textContent).filter(name=>name==='White Widow CBD').length),2,`${width}: equal varieties retain separate lots`);
    verify(await inventory('GLASS-1L'),[7,5,2],`${width}: occupied and free counts use installed jars`);
    verify(await inventory('GROVE-1LB'),[1,1,0],`${width}: a partly filled container cannot host another harvest`);
    verify(await page.$$eval('[data-storage-container="CANNATROL"]',nodes=>nodes.length),0,`${width}: a purchased cabinet in reserve is not usable inventory`);
    await layout(`${width} inventory`);await shot(`inventory-${width}`);
    await choose('GLASS-3L');verify(await mutations(),[],`${width}: choosing a model changes no game state`);
    verify(await page.$$eval(editor(firstId)+' option',nodes=>nodes.some(node=>node.value==='CANNATROL')),false,`${width}: reserve-only models are absent from placement choices`);
    await choose('BOVEDA-1L');verify(await page.$$eval(editor(firstId)+' button',nodes=>nodes.find(node=>node.textContent==='Ranger ce lot')?.disabled),true,`${width}: an insufficient installed model cannot be confirmed`);
    await choose('GLASS-3L');await pressText('Ranger ce lot',editor(firstId));verify(await mutations(),[],`${width}: opening confirmation still changes no stock`);
    await layout(`${width} placement confirmation`);await shot(`placement-${width}`);
    await pressText('Revenir au choix',editor(firstId));verify(await mutations(),[],`${width}: cancelling confirmation preserves all reservations`);
    await visit('warehouse');
    verify(await page.evaluate(()=>{const inventory=document.querySelector('[data-storage-inventory]'),lot=document.querySelector('[data-conservation-lot]'),equipment=document.querySelector('[data-storage-equipment]');return !!(inventory.compareDocumentPosition(lot)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(lot.compareDocumentPosition(equipment)&Node.DOCUMENT_POSITION_FOLLOWING);}),true,`${width}: the warehouse leads with inventory, then lots, then equipment`);
    verify(await page.$eval('[data-postharvest-guide]',node=>!node.open&&node===node.parentElement.lastElementChild),true,`${width}: the equipment comparison stays collapsed at the bottom`);
    await layout(`${width} warehouse`);await shot(`warehouse-${width}`);
    await press('[data-storage-equipment] > summary');
    verify(await page.evaluate(()=>{const guide=document.querySelector('[data-postharvest-guide]');return [...document.querySelectorAll('[data-post-harvest-device],[data-storage-climate-section]')].every(node=>node.checkVisibility()&&!!(node.compareDocumentPosition(guide)&Node.DOCUMENT_POSITION_FOLLOWING));}),true,`${width}: equipment costs and climate precede the explanatory guide`);
    await press('[data-postharvest-guide] > summary');await page.focus('[data-quality-start]');await page.keyboard.press('End');
    verify(await page.$$eval('[data-quality-tier]',nodes=>nodes.length>0&&nodes.every(node=>Number(node.dataset.resultScore)===10)),true,`${width}: the collapsed comparison remains operable by keyboard`);
    await layout(`${width} expanded equipment`);
    verify(await mutations(),[],`${width}: exploring the equipment and simulation makes no purchase`);

    await visit('warehouse&stock=packed');
    verify(await stockMetrics(),{total:'735 g',protected:'0 g',packed:'735 g'},`${width}: packaged stock is not reported as flowers protected by containers`);
    verify(await page.$$eval('[data-conservation-lot]',nodes=>nodes.length),0,`${width}: packages alone do not create a loose harvest`);
    verify(await inventory('GLASS-1L'),[7,0,7],`${width}: 735 g of packages occupy no loose-flower jars`);
    verify(await page.$$eval('[data-storage-container] td:nth-of-type(2)',nodes=>nodes.every(node=>node.textContent==='0')),true,`${width}: all container reservations remain empty for packaged-only stock`);
    verify(await page.$$eval('[data-storage-inventory] figure,[data-storage-stock="overflow"]',nodes=>nodes.length),0,`${width}: a single packaged category creates neither surplus nor redundant chart`);
    verify(await page.$eval('[data-storage-packed="active"]',node=>/735\s*g/.test(node.textContent)&&/annonces actives/i.test(node.textContent)),true,`${width}: packaged stock identifies active listings without claiming jar protection`);
    verify(await page.$$eval('[data-conservation-summary] details > summary',nodes=>nodes.some(node=>/465\s*g de capacité disponible/.test(node.textContent))),true,`${width}: warehouse capacity is distinguished from 1200 g of free containers`);
    await layout(`${width} packaged-only stock`);await shot(`stock-packed-${width}`);

    await visit('warehouse&stock=mixed');
    verify(await stockMetrics(),{total:'885 g',protected:'400 g',packed:'435 g'},`${width}: mixed stock counts its 50 g surplus once in the 885 g total`);
    verify(await page.$eval('[data-storage-stock="overflow"]',node=>/50\s*g/.test(node.textContent)),true,`${width}: the unprotected loose stock stays visible outside the main stock cards`);
    verify(await page.$$eval('[data-storage-packed] strong',nodes=>Object.fromEntries(nodes.map(node=>[node.closest('[data-storage-packed]').dataset.storagePacked,node.textContent]))),{active:'300 g',paused:'135 g'},`${width}: active and paused packages keep their distinct authoritative amounts`);
    verify(await inventory('GLASS-1L'),[7,5,2],`${width}: packages do not reserve the loose lots' containers`);
    const chartValues=await page.$$eval('[data-storage-inventory] figure li strong',nodes=>nodes.map(node=>Number(node.textContent.replace(/\s|g/g,'').replace(',','.'))));
    verify(chartValues.length>=2&&chartValues.every(value=>value>0)&&chartValues.reduce((sum,value)=>sum+value,0)===885,true,`${width}: chart segments partition actual stock without zero categories or double counting`);
    await layout(`${width} mixed stock`);await shot(`stock-mixed-${width}`);

    await visit('warehouse&stock=missing');
    verify(await stockMetrics(),{total:'—',protected:'—',packed:'—'},`${width}: absent server breakdown is shown as unknown rather than inferred from aggregate usage`);
    verify(await page.$eval('[data-storage-breakdown-unavailable]',node=>node.checkVisibility()),true,`${width}: missing breakdown has a visible explanation and refresh guidance`);
    verify(await page.$$eval('[data-storage-inventory] figure,[data-storage-stock="overflow"]',nodes=>nodes.length),0,`${width}: unknown stock categories produce no invented proportions or surplus`);
    verify(await page.$$eval('[data-storage-packed]',nodes=>nodes.length),0,`${width}: missing metadata does not imply packages or active sales`);
    verify(await inventory('GLASS-1L'),[7,5,2],`${width}: known container counts remain available without a stock breakdown`);
    await layout(`${width} unknown stock breakdown`);await shot(`stock-unknown-${width}`);
    verify(await mutations(),[],`${width}: viewing stock breakdowns never changes reservations or sales`);
  }

  await page.setViewport({width:390,height:1000});await visit();
  const untouched=await page.evaluate(ids=>ids.map(id=>JSON.stringify(window.__raw()[id])),[secondId,thirdId]);
  const originalDates=await page.evaluate(id=>{const lot=window.__raw()[id];return {harvestedAt:lot.harvestedAt,readyAt:lot.readyAt,deadline:lot.capacity.overflowDeadlineAt};},firstId);
  await choose('GLASS-3L');await pressText('Ranger ce lot',editor(firstId));await pressText('Confirmer le rangement',editor(firstId));
  await page.waitForFunction(id=>document.querySelector(`[data-storage-placement="${id}"]`)?.open===false,{},firstId);
  verify(await page.evaluate(id=>document.activeElement===document.querySelector(`[data-storage-placement="${id}"] > summary`),firstId),true,'Successful placement restores focus to its own disclosure control');
  const firstRequest=(await mutations())[0];verify({action:firstRequest.action,flowerId:firstRequest.flowerId,containerCode:firstRequest.containerCode},{action:'place',flowerId:firstId,containerCode:'GLASS-3L'},'Confirmation submits the exact lot ID and exact container model');
  verify(typeof firstRequest.requestKey,'string','Placement carries an idempotency key');
  verify(await page.evaluate(ids=>ids.map(id=>JSON.stringify(window.__raw()[id])),[secondId,thirdId]),untouched,'The other variety and the second lot of the same variety keep every recorded field');
  verify(await page.evaluate(id=>{const lot=window.__raw()[id];return {harvestedAt:lot.harvestedAt,readyAt:lot.readyAt,deadline:lot.capacity.overflowDeadlineAt};},firstId),originalDates,'Placement keeps the harvest age and original deadlines');
  verify(await inventory('GLASS-1L'),[7,2,5],'Success releases only the selected harvest’s former jars');
  verify(await inventory('GLASS-3L'),[1,1,0],'Success reserves one complete selected container');
  verify(await page.evaluate(()=>window.__snapshot().cashCents),500000,'Placement charges no purchase');

  await visit('warehouse');await choose('GLASS-3L');await pressText('Ranger ce lot',editor(firstId));
  await page.evaluate(id=>{window.__placedEditor=document.querySelector(`[data-storage-placement="${id}"]`);},firstId);
  await pressText('Confirmer le rangement',editor(firstId));
  await page.waitForFunction(id=>!document.querySelector(`[data-storage-placement="${id}"]`)?.open&&document.querySelector('[data-harvest-storage] [role="status"]')?.textContent.includes('rangement enregistré'),{},firstId);
  await page.waitForFunction(()=>window.__calls.filter(call=>call.url==='/api/arena/placard/warehouse').length>=2);
  verify(await page.evaluate(id=>window.__placedEditor===document.querySelector(`[data-storage-placement="${id}"]`)&&document.activeElement===window.__placedEditor.querySelector('summary'),firstId),true,'Warehouse equipment refresh preserves the editor instance and returned keyboard focus');
  verify(await page.$eval('[data-harvest-storage] [role="status"]',node=>node.textContent.includes('rangement enregistré')),true,'The warehouse keeps its success receipt visible after equipment refresh');
  verify(await inventory('GLASS-3L'),[1,1,0],'Placement from the warehouse updates the shared inventory');
  verify((await mutations()).length,1,'Warehouse placement performs one explicit mutation');
  await shot('warehouse-placement-success-390');

  await visit();await choose('GLASS-3L');await pressText('Ranger ce lot',editor(firstId));await page.evaluate(()=>window.__occupyTarget());
  await page.waitForFunction(id=>[...document.querySelectorAll(`[data-storage-placement="${id}"] button`)].some(node=>node.textContent==='Confirmer le rangement'&&node.disabled),{},firstId);
  verify(await mutations(),[],'A new reservation invalidates an open confirmation without submitting it');

  await visit();await choose('GLASS-3L');await page.evaluate(()=>{window.__holdNextRead=true;});await press('[aria-label="Actualiser le stockage"]');await page.waitForFunction(()=>typeof window.__releaseRead==='function');
  await pressText('Ranger ce lot',editor(firstId));await pressText('Confirmer le rangement',editor(firstId));await page.waitForFunction(()=>window.__mutations.length===1);
  await page.evaluate(()=>window.__releaseRead());await page.waitForFunction(()=>document.querySelector('[data-storage-container="GLASS-3L"] td:last-child')?.textContent==='0');
  verify(await inventory('GLASS-1L'),[7,2,5],'A late pre-mutation snapshot cannot restore the old reservations');

  await visit();await choose('GLASS-3L');await pressText('Ranger ce lot',editor(firstId));await page.evaluate(()=>{window.__failNextPlace=true;});await pressText('Confirmer le rangement',editor(firstId));await page.waitForSelector('[role="alert"]');
  verify(await page.evaluate(()=>JSON.stringify(window.__raw())===window.__initialRaw),true,'A rejected placement leaves every lot unchanged');
  verify(await page.$eval(editor(firstId)+' select',node=>node.value),'GLASS-3L','A rejected placement retains the intended model');
  await press('[aria-label="Actualiser le stockage"]');await pressText('Confirmer le rangement',editor(firstId));await page.waitForFunction(()=>window.__mutations.length===2);
  verify(await page.evaluate(()=>window.__mutations[0].requestKey===window.__mutations[1].requestKey),true,'Retrying the same interrupted placement retains its request key');

  await visit();await choose('GLASS-3L');await pressText('Ranger ce lot',editor(firstId));await page.evaluate(()=>{window.__holdPlace=true;});await pressText('Confirmer le rangement',editor(firstId));await page.waitForFunction(()=>typeof window.__releasePlace==='function');
  verify(await page.$$eval('[data-storage-placement] select',nodes=>nodes.every(node=>node.disabled)),true,'An in-flight placement locks all placement editors');
  await page.$eval(editor(firstId)+' button:last-child',node=>node.click());verify((await mutations()).length,1,'Repeated activation cannot send a second pending placement');
  await page.evaluate(()=>window.__releasePlace());await page.waitForFunction(id=>!document.querySelector(`[data-storage-placement="${id}"]`)?.open,{},firstId);

  await visit('partial');await press(editor(firstId)+' > summary');
  verify(await page.$$eval(editor(firstId)+' select',nodes=>nodes.length),0,'Missing reservations disable placement instead of inventing free space');
  verify(await page.$$eval('[data-storage-container="GLASS-1L"] td',nodes=>nodes.map(node=>node.textContent)),['7','—','—'],'Incomplete inventory leaves occupied and free counts unknown');
  await page.evaluate(()=>window.__recover());await press('[aria-label="Actualiser le stockage"]');await page.waitForSelector(editor(firstId)+' select',{visible:true});
  verify(await inventory('GLASS-1L'),[7,5,2],'Retry restores installed inventory after incomplete data');

  await visit('flower='+secondId);await page.waitForFunction(id=>document.activeElement?.getAttribute('data-conservation-lot')===id,{},secondId);
  await press('[data-harvest-open-warehouse]');await page.waitForSelector('[data-fixture-mode="warehouse"]');
  await page.waitForSelector('[data-storage-equipment]');await press('[data-storage-equipment] > summary');
  await page.waitForSelector('[data-return-protection-lot]',{visible:true});await press('[data-return-protection-lot]');
  await page.waitForSelector('[data-fixture-mode="harvests"]');
  await page.waitForFunction(id=>document.activeElement?.getAttribute('data-conservation-lot')===id,{},secondId);
  verify(await page.evaluate(()=>document.activeElement?.getAttribute('data-conservation-lot')),secondId,'Returning from the equipment restores keyboard focus to the selected harvest');
  verify(await mutations(),[],'Equipment round trip does not allocate or buy implicitly');

  verify(errors,[],'No browser exception');verify(remoteRequests,[],'All fixture traffic stays local');
  await writeFile(resolve(output,'report.json'),JSON.stringify({success:true,checks:checks.length,results:checks,errors,remoteRequests,screenshots},null,2));
  console.log(JSON.stringify({success:true,checks:checks.length,output},null,2));
}catch(error){
  await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(resolve(output,'report.json'),JSON.stringify({success:false,error:error.stack,checks,errors,remoteRequests},null,2));console.error(error.stack);process.exitCode=1;
}finally{await browser?.close();await server.close();}
