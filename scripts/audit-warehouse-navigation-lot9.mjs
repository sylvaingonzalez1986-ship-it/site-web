/** Actual warehouse, catalog and Missions advice. Reuses the existing local fixture, blocks every write. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output=resolve('output/clarity-lot9/navigation');await mkdir(output,{recursive:true});
let source=(await readFile('scripts/audit-placard-warehouse-v4.mjs','utf8')).split("if(process.argv.includes('--preview'))")[0];
const replace=(before,after)=>{assert(source.includes(before),'Known fixture anchor: '+before.slice(0,80));source=source.replace(before,after);};
replace("'output/warehouse-v4'","'output/clarity-lot9/navigation'");replace('?? 3248','?? 3582');
replace("import {KqWarehouse} from '/src/components/placard/KqWarehouse';",`import {KqWarehouse} from '/src/components/placard/KqWarehouse';
    import {KqEquipmentCatalogModal} from '/src/components/placard/KqEquipmentCatalogModal';
    import {KqPlacardHud} from '/src/components/placard/KqPlacardHud';`);
replace('let state=createKqWarehouseStarter();',"let state=createKqWarehouseStarter();state.equipment.find(item=>item.code==='MH-TS1000').quantity+=2;");
replace("window.__apiCalls.push({url:String(url),method:init.method??'GET'});","window.__apiCalls.push({url:String(url),method:init.method??'GET'});if(init.method&&init.method!=='GET')throw Error('Read-only navigation fixture: '+init.method+' '+url);");
replace('routePlan:null,reputation:500,tents:', 'routePlan:null,reputation:500,routeMasteries:[],readyLotCount:0,availableFlowerCount:0,tents:');
replace("function Fixture(){const [closed,setClosed]=React.useState(false);return closed?<p data-warehouse-closed>Entrepôt fermé</p>:<KqWarehouse embedded={!query.has('modal')} onClose={()=>{window.__closeCount++;setClosed(true);}}/>;}",
  `function Fixture(){const [closed,setClosed]=React.useState(false),[destination,setDestination]=React.useState(query.has('hud')?'hud':'warehouse'),[equipment,setEquipment]=React.useState(query.get('equipment'));
    const onClose=()=>{window.__closeCount++;setClosed(true);};
    if(closed)return <p data-warehouse-closed>Entrepôt fermé</p>;
    if(destination==='hud')return <KqPlacardHud mode="progression" onOpenShop={code=>{setEquipment(code);setDestination('warehouse');}} onOpenGame={()=>{}} onOpenArena={()=>{}} onOpenStorage={()=>{}} onOpenMarket={()=>{}}/>;
    return query.has('wrapper')?<KqEquipmentCatalogModal embedded initialEquipmentCode={equipment} onClose={onClose}/>:<KqWarehouse embedded initialShopOpen={query.has('catalog')||query.has('hud')} initialEquipmentCode={equipment} initialSection={query.get('section')==='storage'?'storage':'equipment'} initialZoneId={query.get('zone')} onClose={onClose}/>;}`);
replace('const server = await createServer',"modules['next/link']+='export const useLinkStatus=()=>({pending:false});';\nconst server = await createServer");
source+=String.raw`
let browser,page;const results=[],errors=[],blocked=[];
try {
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>void dialog.accept());
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{blocked.push(request.url());void request.abort();}});
 const shop='dialog[data-warehouse-shop][open]';
 const enter=async selector=>{const target=await page.waitForSelector(selector,{visible:true});await target.focus();await page.keyboard.press('Enter');};
 const visit=async(query='')=>{await page.goto(origin+'/?compact&newWorkshop&'+query,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
 const noWrites=async()=>assert.deepEqual(await page.evaluate(()=>window.__apiCalls.filter(call=>call.method!=='GET')),[]);
 const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1||[...document.querySelectorAll('dialog[open]')].some(node=>node.scrollWidth>node.clientWidth+1)),false);
 const closeShop=async()=>{await enter(shop+' button[aria-label="Fermer la boutique"]');await page.waitForSelector(shop,{hidden:true});};
 const targeted=async(code,department)=>{await page.waitForSelector(shop+' [data-warehouse-shop-category="'+department+'"][aria-selected="true"]');await page.waitForFunction(code=>document.activeElement?.getAttribute('data-warehouse-shop-product')===code,{},code);assert.equal(await page.$eval('[data-warehouse-shop-product="'+code+'"]',el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.top<innerHeight;}),true);};
 for(const width of [320,390,1440]) {
  await page.setViewport({width,height:900});
  for(const [code,department]of [['SIM-DRYING-02','drying'],['SIM-SECURITY-02','security']]){
   await visit('catalog&equipment='+code);await targeted(code,department);await noOverflow();await noWrites();
   assert.equal(await page.evaluate(()=>window.__snapshot.revision),1);await page.screenshot({path:resolve(output,'target-'+department+'-'+width+'.png')});
   await closeShop();assert.equal(await page.$(shop),null);await enter('[data-warehouse-action="shop"]');await page.waitForSelector(shop);
   const context=department==='drying'?'drying':'lighting';assert.equal(await page.$eval(shop+' [aria-selected="true"]',el=>el.getAttribute('data-warehouse-shop-category')),context);
   results.push({width,scenario:'target-'+department,productFocused:true,keyboard:true,manualReopenUsesRoom:true,noWrites:true});
  }
  await visit();await page.waitForSelector('[data-warehouse-map]');
  for(const room of ['drying','storage']){await enter('[data-warehouse-room="'+room+'"]');await enter('[data-warehouse-action="shop"]');await page.waitForSelector(shop+' [data-warehouse-shop-category="'+room+'"][aria-selected="true"]');await closeShop();}
  await enter('[data-warehouse-room="processing"]');await enter('[data-warehouse-action="shop"]');await page.waitForSelector('[data-arena-tour-surface="catalog"][data-workshop-only]');assert.equal(await page.$(shop),null);await noWrites();await noOverflow();
  results.push({width,scenario:'contextual-store',drying:true,storage:true,workshop:true,noWrites:true});

  for(const code of ['SECURITY-CAMERA','unknown-device']){await visit('catalog&equipment='+code);await page.waitForSelector('[data-warehouse-target-unavailable]');assert.equal(await page.$('[data-warehouse-shop-product][data-targeted]'),null);await noWrites();await noOverflow();}
  await page.screenshot({path:resolve(output,'unavailable-'+width+'.png')});results.push({width,scenario:'obsolete-and-unknown-target',explicitUnavailable:true,noSilentSubstitution:true});

  await visit('catalog&equipment=MH-TS1000');await targeted('MH-TS1000','lighting');assert.equal(await page.$eval('[data-warehouse-shop-owned="MH-TS1000"]',el=>el.textContent.trim()),'1 installé · 2 en réserve');
  assert.equal(await page.$eval('[data-warehouse-shop-product="MH-TS1000"]',el=>el.textContent.includes('Prix neuf de référence')),true);
  const before=await page.evaluate(()=>JSON.stringify(window.__snapshot));await enter('[data-warehouse-shop-choose="SIM-LIGHT-02"]');
  assert.equal(await page.$('[data-warehouse-shop-owned="SIM-LIGHT-02"]'),null);assert.equal(await page.$eval('[data-warehouse-shop-owned="MH-TS1000"]',el=>el.textContent.trim()),'1 installé · 2 en réserve');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__snapshot)),before);await noWrites();results.push({width,scenario:'inventory-authority',installedAndReserve:true,draftNotPurchased:true,referencePrice:true});

  await visit('catalog&equipment=SIM-STORAGE-CLIMATE-02');await page.waitForFunction(()=>document.activeElement?.getAttribute('data-storage-climate-card')==='SIM-STORAGE-CLIMATE-02');assert.equal(await page.$(shop),null);
  assert.equal(await page.$eval('[data-storage-equipment]',el=>el.open),true);await noWrites();results.push({width,scenario:'climate-target',existingStorageControls:true,noWrite:true});

  await visit('wrapper&equipment=SIM-DRYING-02');await targeted('SIM-DRYING-02','drying');await noWrites();results.push({width,scenario:'catalog-wrapper',opensTarget:true});

  await visit('hud');await page.waitForSelector('[aria-label="Prochain investissement"] button');
  const goal=await page.$eval('[aria-label="Prochain investissement"]',el=>el.textContent);assert(!goal.includes('Caméra de surveillance'));assert(goal.includes('550'));
  await enter('[aria-label="Prochain investissement"] button');await page.waitForSelector('[data-arena-tour-surface="catalog"][data-workshop-only]');await noWrites();
  results.push({width,scenario:'missions-advice',realMachine:true,workshopDestination:true,noWrites:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors,blocked,scope:'Actual KqWarehouse, Shop, CatalogModal and PlacardHud. Browser-local GET fixtures only; no purchase, assignment, or plan save.'},null,2));
 console.log(results.length+' real warehouse navigation checks passed at 320/390/1440.');
}catch(error){await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{const timeout=setTimeout(()=>{browser?.process()?.kill();server.httpServer?.closeAllConnections();},5000);try{await browser?.close();server.httpServer?.closeAllConnections();await server.close();}finally{clearTimeout(timeout);}}
`;
const fixture=resolve(output,'fixture.mjs');await writeFile(fixture,source);await import(pathToFileURL(fixture).href);
