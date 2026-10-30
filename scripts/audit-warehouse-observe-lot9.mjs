/** Current warehouse, real components, local read-only synthetic fixtures. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const phase = process.env.KQ_WAREHOUSE_LOT9_PHASE ?? 'after';
assert(['before', 'after'].includes(phase));
const output = resolve('output/clarity-lot9/warehouse', phase);
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-placard-warehouse-v4.mjs', 'utf8')).split("if(process.argv.includes('--preview'))")[0];
assert(source.includes('await server.listen();'));
source = source.replace("'output/warehouse-v4'", JSON.stringify('output/clarity-lot9/warehouse/' + phase))
  .replace('?? 3248', '?? 3599')
  .replace("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport tailwindcss from '@tailwindcss/postcss';")
  .replace('root, configFile: false, envDir: false,', 'root, configFile: false, envDir: false, css:{postcss:{plugins:[tailwindcss()]}},')
  .replace('background:#183529', 'background:#fff1d6')
  .replace('BarlowCondensed-Latin-Bold.woff2', 'BarlowCondensed-Latin-Black.woff2')
  .replace('font-weight:700;font-display:swap}@font-face{font-family:"Warehouse Hand"', 'font-weight:900;font-display:swap}@font-face{font-family:"Warehouse Hand"')
  .replace("import {KqWarehouse} from '/src/components/placard/KqWarehouse';", "import {KqWarehouseEntry as KqWarehouse} from '/src/components/placard/KqWarehouseEntry';\nimport '/src/app/globals.css';\nimport retro from '/src/components/contest/ArenaRetro.module.css';")
  .replace('window.__apiCalls.push({url:String(url),method:init.method??\'GET\'});', "window.__apiCalls.push({url:String(url),method:init.method??'GET'});if(init.method&&init.method!=='GET')throw Error('Mutation prohibited in read-only observation');")
  .replace('window.__requests=[];', 'if(query.has("reserve"))window.__snapshot.state.equipment.push({code:"SIM-AIR-03",quantity:2});\nwindow.__requests=[];')
  .replace('<KqWarehouse embedded={!query.has(\'modal\')} onClose=', '<KqWarehouse initialZoneId={query.get("zone")} initialEquipmentCode={query.get("equipment")} initialShopOpen={query.has("catalog")} embedded={!query.has(\'modal\')} onOpenCulture={href=>{window.__navigation=href;}} onClose=')
  .replace('render(<Fixture/>);', 'render(<div className={retro.surface}><Fixture/></div>);')
  .replace('const server = await createServer', "modules['next/link']+='export const useLinkStatus=()=>({pending:false});';\nconst server = await createServer");
source += '\nconst phase=' + JSON.stringify(phase) + ';\n' + String.raw`
let browser,page;const errors=[],external=[],observations=[];
const report=()=>writeFile(resolve(output,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'Actual KqWarehouseEntry + KqWarehouse, isolated cream surface, viewport height844, synthetic local reads; no shell header',observations,errors,external},null,2));
try{
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{external.push(request.url());void request.abort();}});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const measure=()=>page.evaluate(()=>{
  const box=node=>{if(!node)return null;const r=node.getBoundingClientRect(),style=getComputedStyle(node);return {text:node.textContent.trim(),top:r.top+scrollY,bottom:r.bottom+scrollY,width:r.width,height:r.height,fontSize:style.fontSize,visible:r.top>=0&&r.bottom<=innerHeight,disabled:node.disabled};};
  return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,height:document.documentElement.scrollHeight,scrollY,focused:box(document.activeElement),focusTarget:document.activeElement?.dataset?.warehouseShopProduct??document.activeElement?.dataset?.warehouseAction,selectedZone:document.querySelector('[data-warehouse-zone-chip][aria-pressed="true"]')?.getAttribute('aria-label'),room:document.querySelector('[data-warehouse-room][aria-selected="true"]')?.textContent,header:box(document.querySelector('[data-warehouse-v4]>header')),stats:box(document.querySelector('[aria-label="Repères de ton installation"]')),mode:box(document.querySelector('[aria-label="Mode du plan"]')),campaign:box(document.querySelector('[data-warehouse-campaign]')),zoneNav:box(document.querySelector('[aria-label="Sélection des zones"]')),map:box(document.querySelector('[data-warehouse-map-viewport]')),configure:box(document.querySelector('[data-warehouse-action="configure-selected"]')),mapConfigure:box(document.querySelector('[data-warehouse-plan] [data-warehouse-action="configure"]')),selectedDepartment:document.querySelector('[data-warehouse-shop-category][aria-selected="true"]')?.textContent,departmentNav:box(document.querySelector('[aria-label="Rayons de la boutique"]')),product:box(document.querySelector('[data-warehouse-shop-product][data-targeted="true"]')??document.querySelector('[data-warehouse-product-artwork]')?.closest('article')),buttons:[...document.querySelectorAll('button')].filter(node=>node.getClientRects().length).slice(0,30).map(box)};
 });
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<600,hasTouch:width<600});
  for(const scenario of [{name:'from-culture',query:'compact&zone=starter'},{name:'active',query:'compact&cultures&zone=second'},{name:'active-locked',query:'compact&cultures&zone=starter'},{name:'unknown-zone',query:'compact&zone=unknown'},{name:'requested-air',query:'compact&zone=starter&catalog&equipment=SIM-AIR-03&reserve'}]){
   await page.goto(origin+'/?'+scenario.query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-map]');await page.evaluate(()=>document.fonts.ready);await settle();
   const before=await measure();await page.screenshot({path:resolve(output,scenario.name+'-'+width+'-viewport.png')});await page.screenshot({path:resolve(output,scenario.name+'-'+width+'-full.png'),fullPage:true});
   let configured=null,checks={};
   if(phase==='after'){
    assert(!before.overflow,'No horizontal page overflow');
    if(['from-culture','active'].includes(scenario.name)){
     assert.equal(before.focusTarget,'configure-selected','Requested editable zone receives focus');assert(before.focused.visible,'Focused configuration action is in view');
    }
    if(scenario.name==='active-locked'){
     assert(before.configure.disabled,'Active zone stays locked');assert(before.focused.text.includes('Culture en cours'),'Locked target announces its state');assert(before.focused.visible,'Locked target is in view');
    }
    if(scenario.name==='unknown-zone'){assert.equal(before.scrollY,0,'Unknown zone does not scroll to another zone');assert.notEqual(before.focusTarget,'configure-selected');}
    if(scenario.name==='requested-air'){
     assert.equal(before.selectedDepartment,'Extraction');assert.equal(before.focusTarget,'SIM-AIR-03','Exact requested model receives focus');assert(before.product.text.includes('Prix neuf de référence'),'New purchase reference is distinguished');assert(before.product.text.includes('0 installé · 2 en réserve'),'Owned reserve is shown without pretending installed');
     await page.screenshot({path:resolve(output,'target-product-'+width+'.png')});await page.$eval('[data-warehouse-shop-owned="SIM-AIR-03"]',node=>node.scrollIntoView({block:'center',behavior:'instant'}));await settle();await page.screenshot({path:resolve(output,'reserve-'+width+'.png')});await page.keyboard.press('Escape');await page.waitForSelector('dialog[data-warehouse-shop]',{hidden:true});checks.shopEscape=true;
    }
   }
   if(scenario.name==='from-culture'){
    const selector='[data-warehouse-action="configure-selected"]';await page.focus(selector);await page.keyboard.press('Enter');await page.waitForSelector('dialog[data-warehouse-zone-dialog][open]');await settle();
    configured=await page.$eval('dialog[data-warehouse-zone-dialog][open]',node=>{const footer=node.querySelector('footer'),r=footer.getBoundingClientRect();return {text:node.textContent,footerTop:r.top,footerBottom:r.bottom,overflow:node.scrollWidth>node.clientWidth+1,selectLabels:[...node.querySelectorAll('label')].map(label=>({text:label.textContent,font:getComputedStyle(label).fontSize}))};});await page.screenshot({path:resolve(output,'configure-'+width+'.png')});await page.keyboard.press('Escape');await page.waitForSelector('dialog[data-warehouse-zone-dialog][open]',{hidden:true});
   }
   if(phase==='after'&&['from-culture','active'].includes(scenario.name)){
    const refresh='[aria-label="Actualiser l’entrepôt"]';await page.focus(refresh);const refreshScroll=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('[aria-label="Actualiser l’entrepôt"]').disabled);await settle();assert.equal(await page.evaluate(()=>scrollY),refreshScroll,'Refresh does not jump back to initial target');assert.notEqual(await page.evaluate(()=>document.activeElement?.dataset?.warehouseAction),'configure-selected','Refresh never refocuses original target');
    const nextZone=scenario.name==='active'?'third':'starter-drying';await page.focus('[data-warehouse-zone-chip="'+nextZone+'"]');const selectionScroll=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');await settle();assert.equal(await page.$eval('[data-warehouse-zone-chip][aria-pressed="true"]',node=>node.dataset.warehouseZoneChip),nextZone);assert.equal(await page.evaluate(()=>scrollY),selectionScroll,'Changing zone does not refocus original target');checks.refreshNoJump=true;checks.selectionNoJump=true;
   }
   assert.deepEqual(await page.evaluate(()=>window.__apiCalls.filter(call=>call.method!=='GET')),[]);observations.push({scenario:scenario.name,...before,configured,checks});await report();console.log('OBSERVED '+scenario.name+' '+width);
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await report();console.log(JSON.stringify({observed:observations.length,output}));
}finally{
 await report();const timer=setTimeout(()=>{browser?.process()?.kill();server.httpServer?.closeAllConnections();},5000);try{await browser?.close();server.httpServer?.closeAllConnections();await server.close();}finally{clearTimeout(timer);}
}
`;
const fixture=resolve(output,'fixture.mjs');await writeFile(fixture,source);await import(pathToFileURL(fixture).href);
