/** Real warehouse components with in-memory synthetic inventory. No external traffic or transactions. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/clarity-lot19');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-placard-warehouse-v4.mjs', 'utf8')).split("if(process.argv.includes('--preview'))")[0];
assert(source.includes('await server.listen();'), 'Known local warehouse fixture');
source = source.replace("'output/warehouse-v4'", "'output/clarity-lot19'").replace('?? 3248', '?? 3391');
const fixture = String.raw`
modules['next/link'] += 'export const useLinkStatus=()=>({pending:false});';
modules['warehouse-v4-entry'] = "import {initializeKqWarehouseCondition,reconcileKqWarehouseCondition,assertKqWarehouseCondition} from '/src/lib/kanab-quest-warehouse-condition';\n" + modules['warehouse-v4-entry'];
modules['warehouse-v4-entry'] = modules['warehouse-v4-entry'].replace('const fetchOriginal=window.fetch.bind(window);', ${JSON.stringify(String.raw`
    const original = window.__snapshot.state;
    const zone = {...original.zones[0],x:1,y:1,width:2,height:2,name:'La chambre',optionCodes:[]};
    let inventory = getKqWarehouseQuote({...original,zones:[zone]}).nextState;
    const quantity = query.has('partial') ? 1 : 2;
    const moduleQuantity = query.has('partial') ? 3 : 6;
    inventory = {...inventory,equipment:[...inventory.equipment,{code:'SIM-LIGHT-02',quantity}],optionInventory:[{code:'SIM-WATER-02',quantity:moduleQuantity}]};
    let condition = initializeKqWarehouseCondition(inventory);
    condition = {...condition, assets:condition.assets.flatMap(asset=>{
      if(asset.zoneId!==null)return [{...asset,wearPercent:50,purchaseUnitCents:10000}];
      if(asset.code==='SIM-LIGHT-02')return quantity===1?[{...asset,wearPercent:20,purchaseUnitCents:32900}]:[{...asset,quantity:1,wearPercent:20,purchaseUnitCents:32900},{...asset,id:asset.id+'-worn',quantity:1,wearPercent:80,purchaseUnitCents:32900}];
      if(asset.code==='SIM-WATER-02')return [{...asset,quantity:3,wearPercent:20,purchaseUnitCents:1900},...(moduleQuantity>3?[{...asset,id:asset.id+'-worn',quantity:3,wearPercent:80,purchaseUnitCents:1900}]:[])];
      return [asset];
    })};
    assertKqWarehouseCondition(inventory,condition);
    window.__snapshot={...window.__snapshot,state:inventory,cultureEquipment:query.has('unknown')?undefined:condition,activeRun:query.has('occupied'),activeRuns:query.has('occupied')?[{runId:'11111111-1111-4111-8111-111111111111',zoneId:'starter',buddieCode:'HH2026-002',stageIndex:2,phase:'ready',startedAt:'2026-10-13T12:00:00Z'}]:[],completedRuns:[]};
    window.__initial=structuredClone(window.__snapshot);
    const fetchOriginal=window.fetch.bind(window);
`)});
modules['warehouse-v4-entry'] = modules['warehouse-v4-entry'].replace('window.__snapshot={...snapshot,state:quote.nextState,cashCents:snapshot.cashCents-quote.totalCostCents,revision:snapshot.revision+1};','window.__snapshot={...snapshot,state:quote.nextState,cultureEquipment:snapshot.cultureEquipment?reconcileKqWarehouseCondition(snapshot.state,quote.nextState,snapshot.cultureEquipment,{requestKey:body.requestKey,fundedFraction:1}):undefined,cashCents:snapshot.cashCents-quote.totalCostCents,revision:snapshot.revision+1};');
`;
source = source.replace('const server = await createServer', fixture + '\nconst server = await createServer');
source += String.raw`
const only=process.argv.find(argument=>argument.startsWith('--only='))?.slice(7);
const matches=name=>!only||only.split(',').some(pattern=>pattern.endsWith('*')?name.startsWith(pattern.slice(0,-1)):name===pattern);
const previous=only?JSON.parse(await readFile(resolve(output,'report.json'),'utf8').catch(()=>'{}')):{};
const checks=only?(previous.checks??[]).filter(check=>!matches(check.name)):[],errors=[],blocked=[];
let browser,page;
const report=()=>writeFile(resolve(output,'report.json'),JSON.stringify({passed:checks.every(item=>item.passed)&&errors.length===0&&blocked.length===0,checks,errors,blocked,mode:'Actual KqWarehouse, reserve, dashboard and shop; synthetic in-memory API responses; no external traffic or actual purchase.'},null,2));
try {
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,protocolTimeout:30000,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(60000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>void dialog.accept());
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{blocked.push(request.url());void request.abort();}});
 const reserve='[data-warehouse-reserve-mode="current"]',projection='[data-warehouse-reserve-projection]',preview='[data-warehouse-reserve-mode="preview"]',shop='dialog[data-warehouse-shop][open]',menu='dialog[data-warehouse-zone-menu][open]';
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const visit=async(extra='')=>{await page.goto(origin+'/?compact&'+extra,{waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-map] [data-zone-id="starter"]');};
 const scroll=async(selector)=>{await page.$eval(selector,node=>node.scrollIntoView({block:'center',behavior:'instant'}));await settle();};
 const clickVisible=async(selector)=>{const element=await page.waitForFunction(selector=>[...document.querySelectorAll(selector)].find(node=>node.checkVisibility()&&!node.disabled)||false,{},selector);await element.asElement().click();await element.dispose();await settle();};
 const close=async()=>{await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true});await settle();};
 const openReserve=async()=>{await clickVisible('[data-warehouse-action="reserve"]');await page.waitForFunction(()=>document.querySelector('[data-warehouse-dashboard]')?.open&&document.querySelector('[data-warehouse-summary-tab="reserve"]')?.getAttribute('aria-selected')==='true');await settle();};
 const openShop=async()=>{await page.focus('[data-warehouse-zone-chip="starter"]');await page.keyboard.press('Enter');await page.waitForSelector(menu);await page.click(menu+' [data-warehouse-zone-action="furnish"]');await page.waitForSelector(shop);await settle();};
 const noMutation=async()=>{const actual=await page.evaluate(()=>({requests:window.__requests,equipment:window.__equipmentRequests,storage:window.__storageRequests,snapshot:window.__snapshot,initial:window.__initial}));assert.deepEqual(actual.requests,[]);assert.deepEqual(actual.equipment,[]);assert.deepEqual(actual.storage,[]);assert.deepEqual(actual.snapshot,actual.initial,'Browsing and draft edits leave the saved server fixture unchanged');};
 const model=(code,scope=reserve)=>scope+' [data-warehouse-reserve-model="'+code+'"]';
 const capture=name=>page.screenshot({path:resolve(output,name+'.png')});
 const bounds=async(selector)=>page.$eval(selector,node=>({width:node.clientWidth,scrollWidth:node.scrollWidth,left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth}));
 const run=async(name,fn)=>{if(!matches(name))return;try{const details=await fn();checks.push({name,passed:true,...details});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});console.error('FAIL '+name+': '+error.message);await capture('failed-'+name).catch(()=>{});await writeFile(resolve(output,'failed-'+name+'.txt'),await page.$eval('body',node=>node.innerText).catch(()=>''));}await report();};
 await run('reserve-shortcut-header-320',async()=>{
  await page.setViewport({width:320,height:568,isMobile:true,hasTouch:true});await visit();await page.evaluate(()=>scrollTo(0,0));await settle();const layout=await page.$eval('[data-warehouse-action="reserve"]',node=>{const header=node.closest('header');return {header:{left:header.getBoundingClientRect().left,right:header.getBoundingClientRect().right},buttons:[...header.querySelectorAll('button')].filter(button=>button.checkVisibility()).map(button=>({label:button.getAttribute('aria-label')||button.textContent.trim(),left:button.getBoundingClientRect().left,right:button.getBoundingClientRect().right,width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})),viewport:innerWidth};});assert(layout.header.left>=-1&&layout.header.right<=layout.viewport+1);for(const button of layout.buttons)assert(button.width>0&&button.left>=-1&&button.right<=layout.viewport+1,'Header action fits: '+button.label);await capture('header-320');await noMutation();return {layout};
 });
 for(const [width,height]of [[320,568],[390,844],[1440,900]])await run('reserve-register-'+width,async()=>{
  await page.setViewport({width,height,isMobile:width<1000,hasTouch:width<1000});await visit();await openReserve();
  assert.match(await page.$eval(model('SIM-LIGHT-02'),node=>node.innerText),/2 appareils/);
  assert.match(await page.$eval(model('SIM-LIGHT-02')+' [data-warehouse-reserve-wear="20"]',node=>node.innerText),/1 appareil.*20\s*%/);
  assert.match(await page.$eval(model('SIM-LIGHT-02')+' [data-warehouse-reserve-wear="80"]',node=>node.innerText),/1 appareil.*80\s*%/);
  assert.match(await page.$eval(model('SIM-WATER-02'),node=>node.innerText),/6 m²/);
  assert.match(await page.$eval(model('SIM-WATER-02')+' [data-warehouse-reserve-wear="20"]',node=>node.innerText),/3 m².*20\s*%/);
  assert.equal(await page.$eval(reserve,node=>[...node.querySelectorAll('details')].some(detail=>detail.open)),false,'Secondary graphs start collapsed');
  const layout=await bounds(reserve);assert(layout.scrollWidth<=layout.width+1&&layout.left>=-1&&layout.right<=layout.viewport+1&&layout.documentWidth<=layout.viewport+1,'Reserve fits viewport');
  await scroll(reserve);await capture('reserve-'+width);await noMutation();return {width,layout,mixedWear:[20,80],devices:2,moduleM2:6};
 });
 await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});
 await run('reserve-shortcut-keyboard',async()=>{
  await visit();const shortcut=await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(node=>node.checkVisibility()&&node.textContent.trim()==='Ma réserve')||false);await shortcut.asElement().focus();await page.keyboard.press('Enter');await shortcut.dispose();await page.waitForFunction(()=>document.activeElement?.getAttribute('data-warehouse-summary-tab')==='reserve');
  assert.equal(await page.$eval('[data-warehouse-dashboard]',node=>node.open),true);
  await page.keyboard.press('Home');assert.equal(await page.$eval('[data-warehouse-summary-tab="performance"]',node=>document.activeElement===node&&node.getAttribute('aria-selected')==='true'),true);
  await page.keyboard.press('End');assert.equal(await page.$eval('[data-warehouse-summary-tab="reserve"]',node=>document.activeElement===node&&node.getAttribute('aria-selected')==='true'),true);
  await noMutation();return {keys:['Enter','Home','End'],focusedTab:'reserve'};
 });
 await run('reserve-unknown-condition',async()=>{
  await visit('unknown');await openReserve();for(const code of ['SIM-LIGHT-02','SIM-WATER-02']){const text=await page.$eval(model(code),node=>node.innerText);assert.match(text,/Usure à vérifier/);assert.equal(await page.$(model(code)+' [data-warehouse-reserve-wear="0"]'),null,'Missing condition is not displayed as unworn');}
  await capture('reserve-unknown');await noMutation();return {unknownDisplayed:true};
 });
 for(const partial of [false,true])await run(partial?'shop-partial-reuse':'shop-full-reuse',async()=>{
  await visit(partial?'partial':'');await openShop();const product=shop+' [data-warehouse-shop-product="SIM-LIGHT-02"]';await scroll(product);await capture(partial?'shop-partial-main':'shop-full-main');const reuse=await page.$eval(product+' [data-warehouse-shop-reuse]',node=>({kept:Number(node.dataset.kept),reused:Number(node.dataset.reused),fresh:Number(node.dataset.new)}));assert.deepEqual(reuse,{kept:0,reused:partial?1:2,fresh:partial?1:0});await scroll(product+' [data-warehouse-shop-condition] > summary');await page.click(product+' [data-warehouse-shop-condition] > summary');const text=await page.$eval(product,node=>node.innerText);
  await writeFile(resolve(output,partial?'shop-partial.txt':'shop-full.txt'),text);
  assert.match(text,/réutilis/i,'Reuse is explained before choosing');assert.match(text,/20\s*%/,'Reserve wear is visible before choosing');if(!partial)assert.match(text,/80\s*%/,'Both wear groups are visible');assert.equal(await page.$eval(product+' [data-warehouse-shop-new-cost]',node=>Number(node.dataset.warehouseShopNewCost)),partial?32900:0,'Only missing new equipment is priced for this zone');
  await capture(partial?'shop-partial':'shop-full');await noMutation();return {partial,reuse,text};
 });
 await run('shop-modules-use-square-metres',async()=>{
  await visit();await openShop();await page.click(shop+' [data-warehouse-shop-category="water"]');const product=shop+' [data-warehouse-shop-product="SIM-WATER-02"]';await scroll(product+' [data-warehouse-shop-condition] > summary');await page.click(product+' [data-warehouse-shop-condition] > summary');const text=await page.$eval(product,node=>node.innerText);
  assert.match(text,/réutilis/i);assert.match(text,/4 m²/);assert.match(text,/20\s*%/);assert.match(text,/80\s*%/);await capture('shop-modules');await noMutation();return {text};
 });
 await run('shop-unknown-condition',async()=>{
  await visit('unknown');await openShop();const product=shop+' [data-warehouse-shop-product="SIM-LIGHT-02"]';await scroll(product+' [data-warehouse-shop-condition] > summary');await page.click(product+' [data-warehouse-shop-condition] > summary');const text=await page.$eval(product,node=>node.innerText);assert.match(text,/usure.*vérifier|usure.*inconnue|état.*inconnu|état.*vérifier/i);await noMutation();return {text};
 });
 await run('shop-320-layout',async()=>{
  await page.setViewport({width:320,height:568,isMobile:true,hasTouch:true});await visit();await openShop();const product=shop+' [data-warehouse-shop-product="SIM-LIGHT-02"]';await scroll(product+' [data-warehouse-shop-new-cost]');const layout=await bounds(shop);assert(layout.left>=-1&&layout.right<=layout.viewport+1&&layout.scrollWidth<=layout.width+1,'Shop fits 320 px');const productLayout=await bounds(product);assert(productLayout.scrollWidth<=productLayout.width+1&&productLayout.left>=-1&&productLayout.right<=320+1,'Product fits 320 px');await capture('shop-320-main');await scroll(product+' [data-warehouse-shop-choose]');const action=await bounds(product+' [data-warehouse-shop-choose]');assert(action.left>=-1&&action.right<=321);await capture('shop-320-action');await noMutation();return {layout,productLayout,action};
 });
 for(const [width,height]of [[320,568],[1440,900]])await run('draft-reserve-remains-current-'+width,async()=>{
  await page.setViewport({width,height,isMobile:width<1000,hasTouch:width<1000});await visit();await openReserve();const before=await page.$eval(reserve,node=>node.innerText);await openShop();await scroll(shop+' [data-warehouse-shop-choose="SIM-LIGHT-02"]');await page.click(shop+' [data-warehouse-shop-choose="SIM-LIGHT-02"]');await close();await openReserve();
  assert.equal(await page.$eval(reserve,node=>node.innerText),before,'Owned reserve is stable while a draft reuses it');assert.equal(await page.$eval(projection,node=>node.open),false,'Projected reserve is secondary and collapsed');await scroll(projection+' > summary');await page.click(projection+' > summary');await page.waitForFunction(selector=>document.querySelector(selector)?.open,{},projection);
  assert.equal(await page.$(model('SIM-LIGHT-02',preview)),null,'Used reserve disappears only from after-installation projection');assert.match(await page.$eval(preview,node=>node.innerText),/après installation/i);assert(await page.$(model('MH-TS1000',preview)),'Replaced installed lighting returns to projected reserve');
  const layout=await bounds(preview);assert(layout.scrollWidth<=layout.width+1&&layout.right<=layout.viewport+1,'Projected reserve fits');await scroll(projection);await capture('draft-comparison-'+width);await noMutation();
  await clickVisible('[data-warehouse-action="reset"]');await page.waitForSelector(projection,{hidden:true});assert.equal(await page.$eval(reserve,node=>node.innerText),before,'Cancel restores the same reserve');await noMutation();return {width,unchangedBeforeSave:true,cancel:true,layout};
 });
 for(const partial of [false,true])await run(partial?'saved-reserve-partial-reuse':'saved-reserve-full-reuse',async()=>{
  await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});await visit(partial?'partial':'');await openShop();await scroll(shop+' [data-warehouse-shop-choose="SIM-LIGHT-02"]');await page.click(shop+' [data-warehouse-shop-choose="SIM-LIGHT-02"]');await close();await noMutation();await clickVisible('[data-warehouse-action="save"]');await page.waitForFunction(()=>window.__snapshot.revision===2);await openReserve();
  assert.equal(await page.$(model('SIM-LIGHT-02')),null,'Saved reused stock is no longer offered as available');assert.match(await page.$eval(model('MH-TS1000'),node=>node.innerText),/4 appareils/,'Replaced equipment is available after save');assert.equal(await page.$(projection),null,'A saved plan has no pending projection');
  const actual=await page.evaluate(()=>({requests:window.__requests,condition:window.__snapshot.cultureEquipment,initialCash:window.__initial.cashCents,cash:window.__snapshot.cashCents}));assert.equal(actual.requests.length,1);const selected=actual.condition.assets.filter(asset=>asset.zoneId==='starter'&&asset.code==='SIM-LIGHT-02');assert.deepEqual(selected.map(asset=>asset.wearPercent).sort((a,b)=>a-b),partial?[0,20]:[20,80]);assert.equal(actual.initialCash-actual.cash,actual.requests[0].expectedCostCents);if(!partial)assert.equal(actual.requests[0].expectedCostCents,0,'Full reuse requires no new purchase');else assert(actual.requests[0].expectedCostCents>=32900,'New device and applicable installation remain charged');return {partial,requests:1,costCents:actual.requests[0].expectedCostCents,installedWear:selected.map(asset=>asset.wearPercent)};
 });
 await run('invalid-draft-keeps-current-reserve',async()=>{
  await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});await visit();await openReserve();const before=await page.$eval(reserve,node=>node.innerText);await page.focus('[data-warehouse-zone-chip="starter"]');await page.keyboard.press('Enter');await page.waitForSelector(menu);
  const dimensions=menu+' [data-warehouse-zone-action="dimensions"]';await page.$eval(dimensions,node=>node.closest('details').open=true);await page.click(dimensions);await page.waitForSelector('dialog[data-warehouse-zone-dialog][open]');const settings='[data-warehouse-zone-settings]';await page.click(settings+' > summary');const width=settings+' input[type="number"]';await page.focus(width);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('10');await settle();await close();await openReserve();
  assert.equal(await page.$eval(reserve,node=>node.innerText),before);await scroll(projection+' > summary');await page.click(projection+' > summary');await page.waitForSelector('[data-warehouse-reserve-preview-unavailable]');assert.equal(await page.$(preview),null,'An invalid plan never shows a fictional projected inventory');await noMutation();return {actualReserveUnchanged:true,projectionUnavailable:true};
 });
 await run('active-zone-keeps-reserve-readable',async()=>{
  await visit('occupied');await openReserve();assert.match(await page.$eval(model('SIM-LIGHT-02'),node=>node.innerText),/2 appareils/);await page.focus('[data-warehouse-zone-chip="starter"]');await page.keyboard.press('Enter');await page.waitForSelector(menu);assert.equal(await page.$eval(menu+' [data-warehouse-zone-action="furnish"]',node=>node.disabled),true);await noMutation();return {reserveReadable:true,furnishLocked:true};
 });
 assert.deepEqual(errors,[],'No uncaught browser errors');assert.deepEqual(blocked,[],'No real API or external traffic');
 console.log(JSON.stringify({passed:checks.filter(check=>check.passed).length,total:checks.length,output},null,2));
 if(checks.some(check=>!check.passed))process.exitCode=1;
} finally {
 await report();if(browser){const timer=setTimeout(()=>browser.process()?.kill(),5000);await browser.close().catch(()=>{});clearTimeout(timer);}
 server.httpServer?.closeAllConnections();await server.close();
}
`;
const target = resolve(output, 'run.mjs');
await writeFile(target, source);
await import(pathToFileURL(target).href + '?run=' + Date.now());
