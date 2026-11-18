/** Real warehouse components; local synthetic fixtures; no external API or purchase. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/warehouse-zone-actions');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-placard-warehouse-v4.mjs', 'utf8')).split("if(process.argv.includes('--preview'))")[0];
assert(source.includes('await server.listen();'), 'Known local warehouse fixture');
source = source.replace("'output/warehouse-v4'", "'output/warehouse-zone-actions'").replace('?? 3248', '?? 3389');
const fixture = String.raw`
modules['next/link'] += 'export const useLinkStatus=()=>({pending:false});';
modules['warehouse-v4-entry'] = modules['warehouse-v4-entry'].replace('createKqWarehouseStarter,getKqWarehouseQuote}', 'createKqWarehouseStarter,getKqWarehouseQuote,getKqWarehouseZoneQuote}');
modules['warehouse-v4-entry'] = "import {initializeKqWarehouseCondition,reconcileKqWarehouseCondition,removeKqWarehouseZone,getKqWarehouseRemovalQuote} from '/src/lib/kanab-quest-warehouse-condition';\n" + modules['warehouse-v4-entry'];
modules['warehouse-v4-entry'] = "import {KqReleveNativeWarehouse} from '/src/components/placard/KqReleveNativeWarehouse';import {createKqReleveExpansion} from '/src/lib/kanab-quest-releve-production';\n" + modules['warehouse-v4-entry'];
modules['warehouse-v4-entry'] = "import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';\n" + modules['warehouse-v4-entry'];
modules['warehouse-v4-entry'] = modules['warehouse-v4-entry'].replace("createRoot(document.getElementById('root')).render(<Fixture/>);", "window.__lessonCalls=[];function NativeFixture(){const [lesson,setLesson]=React.useState(createKqReleveExpansion);window.__lesson=lesson;return <KqReleveNativeWarehouse chapter='plan' state={lesson} onChange={setLesson}/>;}const content=query.has('nativeLesson')?<NativeFixture/>:query.has('buddieDock')?<KqTutorialApiProvider api={createKqTutorialApi(window.fetch.bind(window))}><Fixture/></KqTutorialApiProvider>:<Fixture/>;createRoot(document.getElementById('root')).render(content);");
modules['warehouse-v4-entry'] = modules['warehouse-v4-entry'].replace('const fetchOriginal=window.fetch.bind(window);', ${JSON.stringify(String.raw`
    if (query.has('zoneActions') && !(persistenceKey && sessionStorage.getItem(persistenceKey))) {
      const original = window.__snapshot.state;
      const first = { ...original.zones[0], x: 1, y: 1, width: 2, height: 2, name: 'Petite chambre' };
      const second = { ...first, id: 'second', x: 5, y: 1, width: 4, height: 2, name: 'Grande chambre' };
      delete first.buddieCode; delete second.buddieCode;
      const next = getKqWarehouseQuote({ ...original, zones: [first, second] }).nextState;
      window.__snapshot = { ...window.__snapshot, state: next, activeRun: query.has('occupied'), activeRuns: query.has('occupied') ? [{ runId: '11111111-1111-4111-8111-111111111111', zoneId: 'starter', buddieCode: 'HH2026-002', stageIndex: 2, phase: 'ready', startedAt: '2026-10-13T12:00:00Z' }] : [], completedRuns: [] };
      const condition=initializeKqWarehouseCondition(next);
      window.__snapshot.cultureEquipment={...condition,assets:condition.assets.map(asset=>({...asset,wearPercent:50,purchaseUnitCents:next.zones.find(zone=>zone.id===asset.zoneId)?.lightingCode===asset.code?Math.floor(10000/asset.quantity):null}))};
    }
    if(query.has('savedWall') && !window.__snapshot.state.partitions?.length)window.__snapshot.state={...window.__snapshot.state,partitions:[{id:'saved-wall',x:1,y:7,axis:'x',length:2}]};
    if(query.has('cells')&&!window.__snapshot.cultureEquipment)window.__snapshot.cultureEquipment=initializeKqWarehouseCondition(window.__snapshot.state);
    window.__removalQuotes=[]; window.__removals=[]; window.__removalApplied=0;
    window.__freshZonePotential=(zoneId,lightingCode)=>{const zone=window.__snapshot.state.zones.find(item=>item.id===zoneId);return getKqWarehouseZoneQuote({...zone,lightingCode}).estimatedHarvestGrams/(zone.width*zone.height);};
    window.__zoneRemovalQuote=zoneId=>getKqWarehouseRemovalQuote(window.__snapshot.state,window.__snapshot.cultureEquipment,zoneId,window.__snapshot.revision);
    const fetchOriginal=window.fetch.bind(window);
`)});
modules['warehouse-v4-entry'] = modules['warehouse-v4-entry'].replace('const body=JSON.parse(init.body);window.__requests.push(body);', ${JSON.stringify(String.raw`
      const body=JSON.parse(init.body);window.__requests.push(body);
      if(body.action==='quote-zone-removal') {
        window.__removalQuotes.push(body);
        if(window.__quoteHold)await new Promise(resolve=>window.__quoteRelease=resolve);
        if(window.__quoteFailure)return Response.json({error:'Le devis est momentanément indisponible.'},{status:503});
        if(window.__snapshot.activeRuns.some(run=>run.zoneId===body.zoneId))return Response.json({error:'Cette zone est en culture.'},{status:409});
        return Response.json(window.__zoneRemovalQuote(body.zoneId));
      }
      if(body.action==='remove-zone') {
        window.__removals.push(body);
        if(window.__receipts[body.requestKey])return Response.json(window.__receipts[body.requestKey]);
        if(window.__removeHold)await new Promise(resolve=>window.__removeRelease=resolve);
        if(body.expectedRevision!==window.__snapshot.revision)return Response.json({error:'Le plan a changé. Actualise le devis.'},{status:409});
        if(window.__snapshot.activeRuns.some(run=>run.zoneId===body.zoneId))return Response.json({error:'Cette zone est en culture.'},{status:409});
        const quote=window.__zoneRemovalQuote(body.zoneId);
        if(body.expectedResaleCents!==(body.resellEquipment?quote.resaleCents:0))return Response.json({error:'Le montant de reprise a changé.'},{status:409});
        const removed=removeKqWarehouseZone(window.__snapshot.state,window.__snapshot.cultureEquipment,body.zoneId,body.resellEquipment);
        const soldCount=removed.sold.reduce((total,asset)=>total+asset.quantity,0);
        const totalCount=quote.lines.reduce((total,line)=>total+line.quantity,0);
        const receipt={zoneId:body.zoneId,resaleCents:body.resellEquipment?quote.resaleCents:0,soldCount,keptCount:totalCount-soldCount};
        window.__snapshot={...window.__snapshot,state:removed.state,cultureEquipment:removed.condition,revision:window.__snapshot.revision+1,cashCents:window.__snapshot.cashCents+receipt.resaleCents};
        window.__receipts[body.requestKey]={...structuredClone(window.__snapshot),removalReceipt:receipt};
        window.__removalApplied++;
        if(window.__removalLoseResponse){window.__removalLoseResponse=false;throw Error('Réponse perdue après validation. Réessaie.');}
        return Response.json(window.__receipts[body.requestKey]);
      }
`)});
modules['warehouse-v4-entry'] = modules['warehouse-v4-entry'].replace('window.__snapshot={...snapshot,state:quote.nextState,cashCents:snapshot.cashCents-quote.totalCostCents,revision:snapshot.revision+1};','window.__snapshot={...snapshot,state:quote.nextState,cultureEquipment:reconcileKqWarehouseCondition(snapshot.state,quote.nextState,snapshot.cultureEquipment,{requestKey:body.requestKey,fundedFraction:1}),cashCents:snapshot.cashCents-quote.totalCostCents,revision:snapshot.revision+1};');
`;
source = source.replace('const server = await createServer', fixture + '\nconst server = await createServer');
source = source.replace('async load(id){', String.raw`transform(code,id){if(id.split('?')[0].replaceAll('\\','/').endsWith('/src/lib/kanab-quest-releve-warehouse.ts'))return code.replace('return async (input, init) => {', 'return async (input, init) => { globalThis.__lessonCalls?.push({url:String(input),method:init?.method??"GET",body:init?.body?JSON.parse(String(init.body)):null});');},async load(id){`);
source += process.argv.includes('--cells') ? String.raw`
import {auditWarehouseCells} from '../../scripts/audit-warehouse-cell-scenarios.mjs';
await auditWarehouseCells({origin,output,server,puppeteer,Launcher});
` : String.raw`
const only=process.argv.find(argument=>argument.startsWith('--only='))?.slice(7);
const matches=name=>!only||only.split(',').some(pattern=>pattern.endsWith('*')?name.startsWith(pattern.slice(0,-1)):name===pattern);
const previous=only?JSON.parse(await readFile(resolve(output,'report.json'),'utf8').catch(()=>'{}')):{};
const checks=only?(previous.checks??[]).filter(check=>!matches(check.name)):[],errors=[],blocked=[];
let browser,page,cdp;
const report=()=>writeFile(resolve(output,'report.json'),JSON.stringify({passed:checks.every(item=>item.passed)&&errors.length===0&&blocked.length===0,checks,errors,blocked,mode:'Real KqWarehouse / plan / shop / carousel / removal dialogs; in-memory synthetic server responses; no external traffic or actual transactions.'},null,2));
try {
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,protocolTimeout:30000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage();cdp=await page.createCDPSession();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(60000);
 await page.evaluateOnNewDocument(()=>{
  if(!new URLSearchParams(location.search).has('noWebGL'))return;
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
   return /webgl/i.test(type)?null:original.call(this,type,...args);
  };
 });
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',dialog=>void dialog.accept());
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{blocked.push(request.url());void request.abort();}});
 const menu='dialog[data-warehouse-zone-menu][open]',shop='dialog[data-warehouse-shop][open]',removal='[data-warehouse-removal]';
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const camera='[data-grow-camera]';
 const footprint=id=>'[data-grow-footprint="'+id+'"]';
 const frame=async()=>{await page.$eval(camera,node=>node.scrollIntoView({block:'center',behavior:'instant'}));await settle();};
 const visit=async(extra='')=>{
  await page.goto(origin+'/?compact&zoneActions&'+extra,{waitUntil:'domcontentloaded'});
  await page.waitForSelector(footprint('starter'),{timeout:60000});await frame();
  assert.equal((await page.$$(camera)).length,1,'Exactly one isometric viewport');
  assert.equal(await page.$('svg[data-warehouse-map]'),null,'The top-down viewport is gone');
  assert.equal((await page.$$('[data-grow-posts]')).length,1,'Exactly one keyboard station list');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
 };
 const point=(x,y)=>page.$eval(footprint('starter'),(node,{x,y})=>{
  const [origin,east,,south]=Array.from(node.points);
  const a=(x-1+.5)/Number(node.dataset.width),b=(y-1+.5)/Number(node.dataset.depth);
  const point=new DOMPoint(origin.x+a*(east.x-origin.x)+b*(south.x-origin.x),origin.y+a*(east.y-origin.y)+b*(south.y-origin.y)).matrixTransform(node.getScreenCTM());
  return {x:point.x,y:point.y};
 },{x,y});
 const zonePoint=id=>page.$eval(footprint(id),node=>{
  const [a,,b]=Array.from(node.points);
  const p=new DOMPoint((a.x+b.x)/2,(a.y+b.y)/2).matrixTransform(node.getScreenCTM());
  return {x:p.x,y:p.y};
 });
 const start=async(p,touch)=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});else{await page.mouse.move(p.x,p.y);await page.mouse.down();}};
 const move=async(p,touch)=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});else await page.mouse.move(p.x,p.y);await settle();};
 const lift=async touch=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();await settle();};
 const tap=async(p,touch)=>{if(touch){await start(p,true);await lift(true);}else await page.mouse.click(p.x,p.y);await settle();};
 const openMenu=async(id='starter',touch=false)=>{await frame();await tap(await zonePoint(id),touch);await page.waitForSelector(menu);await settle();assert.equal(await page.$$eval('dialog[open]',nodes=>nodes.length),1,'Exactly one dialog after one gesture');};
 const action=name=>menu+' [data-warehouse-zone-action="'+name+'"]';
 const close=async()=>{await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true});await settle();};
 const noMutation=async()=>assert.equal(await page.evaluate(()=>window.__requests.filter(call=>call.action!=='quote-zone-removal').length),0,'Only a read-only quote may be requested before explicit confirmation');
 const clickButton=async(scope,part)=>{const element=await page.waitForFunction(({scope,part})=>[...document.querySelectorAll(scope+' button')].find(button=>!button.disabled&&button.checkVisibility()&&button.textContent.includes(part))||false,{},{scope,part});await element.asElement().click();await element.dispose();await settle();};
 const assertLayout=async(selector)=>{
  const result=await page.$eval(selector,node=>{const rect=node.getBoundingClientRect(),body=node.querySelector('[data-app-dialog-body]');return {modal:node.matches(':modal'),width:rect.width,overflow:node.scrollWidth>node.clientWidth+1||!!body&&body.scrollWidth>body.clientWidth+1,within:rect.left>=-1&&rect.right<=innerWidth+1&&rect.top>=-1&&rect.bottom<=innerHeight+1,actions:[...node.querySelectorAll('[data-warehouse-zone-action]')].filter(node=>node.checkVisibility()).map(node=>({action:node.dataset.warehouseZoneAction,height:node.getBoundingClientRect().height}))};});
  assert(result.modal&&result.within&&!result.overflow,'Modal fits viewport without horizontal overflow');for(const action of result.actions)assert(action.height>=44,'Touch target '+action.action);return result;
 };
 const capture=name=>page.screenshot({path:resolve(output,name+'.png')});
 const run=async(name,fn)=>{if(!matches(name))return;try{const details=await fn();checks.push({name,passed:true,...details});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});console.error('FAIL '+name+': '+error.message);await report();await capture('failed-'+name).catch(()=>{});await writeFile(resolve(output,'failed-'+name+'.txt'),await page.$eval('body',node=>node.innerText).catch(()=>''));await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>{});await page.mouse.up().catch(()=>{});}await report();};
 for(const [width,height]of [[320,568],[390,844],[844,390],[1440,900]])await run('single-gesture-menu-'+width,async()=>{
  const touch=width<1000;await page.setViewport({width,height,isMobile:touch,hasTouch:touch});await visit();await openMenu('starter',touch);
  for(const value of ['furnish','buddies','remove'])assert(await page.$(action(value)),'Action '+value+' is available');
  const condition=await page.$eval('[data-warehouse-zone-condition]',node=>node.innerText);assert.match(condition,/50\s*%/,'Actual material wear is visible');assert.match(condition,/75\s*%/,'Yield effect is visible');
  const wear=await page.evaluateHandle(selector=>[...document.querySelectorAll(selector+' details > summary')].find(node=>node.textContent==='Usure et rendement'),menu);assert(wear.asElement(),'Wear explanation is available');assert.equal(await wear.evaluate(node=>node.parentElement.open),false,'Wear formulas start collapsed');await wear.asElement().click();await settle();const explanation=await wear.evaluate(node=>({open:node.parentElement.open,text:node.parentElement.innerText}));assert(explanation.open);assert.match(explanation.text,/5 points/);assert.match(explanation.text,/50\s*%[\s\S]*75\s*%/);await capture('menu-wear-'+width);await wear.asElement().click();await wear.dispose();await page.$eval(menu+' [data-app-dialog-body]',node=>node.scrollTop=0);await settle();
  const layout=await assertLayout(menu);await noMutation();await capture('menu-'+width);await close();await noMutation();return {width,height,touch,layout};
 });
 await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});
 await run('keyboard-zone-menu',async()=>{
  await visit();const selector='[data-grow-pick="starter"]';await page.focus(selector);await page.keyboard.press('Enter');await page.waitForSelector(menu);assert(await page.$(action('furnish')));await close();assert.equal(await page.$eval(selector,node=>document.activeElement===node),true,'Escape restores triggering zone control');await page.keyboard.press('Space');await page.waitForSelector(menu);await noMutation();return {keys:['Enter','Escape','Space']};
 });
 for(const [width,height]of [[320,568],[1440,900]])await run('shop-area-prices-'+width,async()=>{
  await page.setViewport({width,height,isMobile:width<1000,hasTouch:width<1000});await visit();const prices=[];
  for(const [id,area]of [['starter',4],['second',8]]){
   await openMenu(id,width<1000);await page.click(action('furnish'));await page.waitForSelector(shop);await settle();assert.equal(await page.$(menu),null,'Shop replaces zone menu');
   assert.match(await page.$eval(shop,node=>node.innerText),new RegExp(area+' m²'),'Selected area is visible');
   const offers=await page.$$eval(shop+' [data-warehouse-shop-product]',nodes=>nodes.map(node=>({code:node.dataset.warehouseShopProduct,cents:Number(node.querySelector('[data-warehouse-shop-zone-price]').dataset.warehouseShopZonePrice),harvestGramsPerM2:Number(node.querySelector('[data-warehouse-shop-harvest]').dataset.warehouseShopHarvest)})));
   assert(offers.length>=3,'Three equipment ranges');assert(offers.every(offer=>offer.cents>0));const fresh=await page.evaluate(id=>window.__freshZonePotential(id,'SIM-LIGHT-02'),id),standard=offers.find(offer=>offer.code==='SIM-LIGHT-02');assert(standard.harvestGramsPerM2>0&&standard.harvestGramsPerM2<fresh,'New lighting keeps the worn extractor yield penalty');assert.match(await page.$eval(shop+' [data-warehouse-shop-product="SIM-LIGHT-02"]',node=>node.innerText),/Usure de ton matériel prise en compte/);prices.push({id,area,offers,freshHarvestGramsPerM2:fresh});await capture('shop-'+id+'-'+width);await page.$eval(shop+' [data-warehouse-shop-product="SIM-LIGHT-02"] [data-warehouse-shop-harvest]',node=>node.scrollIntoView({block:'center',behavior:'instant'}));await capture('shop-wear-'+id+'-'+width);await close();await noMutation();
  }
  for(const small of prices[0].offers){const big=prices[1].offers.find(offer=>offer.code===small.code);assert(big&&big.cents>=small.cents,'Larger area cannot cost less for same model');}
  assert(prices[0].offers.some(small=>prices[1].offers.find(big=>big.code===small.code).cents>small.cents),'Area changes actual reference prices');return {prices};
 });
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await run('extra-shop-upgrade-target-zone',async()=>{
  await visit();const initial=await page.evaluate(()=>structuredClone(window.__snapshot));await openMenu('second',true);await page.click(action('furnish'));await page.waitForSelector(shop);
  const choose=shop+' [data-warehouse-shop-choose="SIM-LIGHT-02"]';await page.$eval(choose,node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.click(choose);await settle();await noMutation();await close();
  const save=await page.waitForFunction(()=>[...document.querySelectorAll('[data-warehouse-action="save"]')].find(node=>node.checkVisibility()&&!node.disabled)||false);await save.asElement().click();await save.dispose();await page.waitForFunction(()=>window.__snapshot.revision===2);
  const actual=await page.evaluate(()=>({snapshot:window.__snapshot,requests:window.__requests}));assert.equal(actual.requests.length,1);const changed=actual.snapshot.state.zones.find(zone=>zone.id==='second');assert.equal(changed.lightingCode,'SIM-LIGHT-02');assert.deepEqual(actual.snapshot.state.zones.find(zone=>zone.id==='starter'),initial.state.zones.find(zone=>zone.id==='starter'));assert(actual.requests[0].expectedCostCents>0);assert.equal(actual.snapshot.cashCents,initial.cashCents-actual.requests[0].expectedCostCents);const assets=actual.snapshot.cultureEquipment.assets.filter(asset=>asset.zoneId==='second');assert(assets.some(asset=>asset.code===changed.airCode&&asset.wearPercent===50),'Worn extractor is preserved when upgrading lighting');assert(assets.some(asset=>asset.code===changed.lightingCode&&asset.wearPercent===0),'New lighting starts unworn');return {zoneId:'second',priceCents:actual.requests[0].expectedCostCents,requests:1,wornExtractorPreserved:true};
 });
 await run('buddies-carousel-target-zone',async()=>{
  await visit();await openMenu('second',true);await page.click(action('buddies'));await page.waitForSelector('[data-warehouse-zone-buddies] [data-buddie-select]');
  assert.equal(await page.$eval('[data-warehouse-zone-buddies] [data-buddie-select="HH2026-002"]',node=>node.disabled),true,'Rotation stays locked');
  const available='[data-warehouse-zone-buddies] [data-buddie-select="HH2026-003"]';await page.$eval(available,node=>node.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await page.click(available);await settle();
  assert(await page.$(footprint('second')+'[data-selected="true"]'),'The requested zone remains selected while the assignment is reviewed');await noMutation();await capture('buddies-390');
  const save='[data-warehouse-zone-save-buddie]';await page.waitForSelector(save);await page.click(save);await page.waitForFunction(()=>window.__snapshot.revision===2);const requests=await page.evaluate(()=>window.__requests);assert.equal(requests.length,1);assert.equal(requests[0].state.zones.find(zone=>zone.id==='second').buddieCode,'HH2026-003');assert.equal(requests[0].state.zones.find(zone=>zone.id==='starter').buddieCode,undefined);return {zoneId:'second',buddieCode:'HH2026-003',requests:1};
 });
 await run('active-zone-actions-locked',async()=>{
  await visit('occupied');await openMenu('starter',true);for(const value of ['furnish','buddies','remove'])assert.equal(await page.$eval(action(value),node=>node.disabled),true,'Active zone locks '+value);assert.match(await page.$eval(menu,node=>node.innerText),/culture/i);await noMutation();await close();await openMenu('second',true);assert.equal(await page.$eval(action('furnish'),node=>node.disabled),false,'Other zones remain editable');await noMutation();return {lockedZone:'starter',freeZone:'second'};
 });
 const openRemoval=async()=>{await openMenu('starter',true);await page.click(action('remove'));await page.waitForSelector(removal);await page.waitForFunction(()=>window.__removalQuotes.length===1);await page.waitForFunction(()=>document.querySelector('[data-warehouse-remove-confirm]')?.disabled===false);await settle();};
 const resell=async value=>{const selector=removal+' input[type="radio"]';assert.equal(await page.$$eval(selector,nodes=>nodes.length),2,'Explicit keep/resale choices');const handles=await page.$$(selector);await handles[value?1:0].click();await settle();};
 const confirmRemove=async()=>{await page.click('[data-warehouse-remove-confirm]');await settle();};
 await run('server-amount-authoritative',async()=>{
  await visit();await page.evaluate(()=>{const original=window.__zoneRemovalQuote;window.__zoneRemovalQuote=zoneId=>{const quote=original(zoneId);return {...quote,resaleCents:4637,lines:quote.lines.map(line=>line.resaleCents===null?line:{...line,resaleCents:4637})};};});await openRemoval();await resell(true);assert.match(await page.$eval('[data-warehouse-remove-confirm]',node=>node.textContent),/46,37/,'Confirmation displays the offered server amount');await confirmRemove();await page.waitForSelector(menu,{hidden:true});const actual=await page.evaluate(()=>({request:window.__removals[0],cash:window.__snapshot.cashCents}));assert.equal(actual.request.expectedResaleCents,4637);assert.equal(actual.cash,1504637);return {serverResaleCents:4637,acceptedResaleCents:actual.request.expectedResaleCents};
 });
 await run('extra-dirty-plan-blocks-removal',async()=>{
  await visit();await openMenu('starter',true);await page.click(action('buddies'));await page.waitForSelector('[data-warehouse-zone-buddies] [data-buddie-select="HH2026-003"]');await page.$eval('[data-buddie-select="HH2026-003"]',node=>node.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await page.click('[data-buddie-select="HH2026-003"]');await settle();await clickButton(menu,'Retour aux actions');await page.click(action('remove'));await page.waitForSelector(removal);assert.equal(await page.$eval('[data-warehouse-remove-confirm]',node=>node.disabled),true);assert.match(await page.$eval(removal,node=>node.innerText),/Enregistre ou annule/);assert.equal(await page.evaluate(()=>window.__removalQuotes.length),0);await noMutation();return {quoteRequests:0,removalRequests:0};
 });
 await run('extra-removal-pending-locks-repeat-and-close',async()=>{
  await visit();await openRemoval();await resell(true);await page.evaluate(()=>window.__removeHold=true);await confirmRemove();await page.waitForFunction(()=>typeof window.__removeRelease==='function');assert.equal(await page.$eval('[data-warehouse-remove-confirm]',node=>node.disabled),true);await page.$eval('[data-warehouse-remove-confirm]',node=>node.click());await page.keyboard.press('Escape');await settle();assert(await page.$(menu),'Pending transaction keeps dialog open');assert.equal(await page.evaluate(()=>window.__removals.length),1,'Repeated activation cannot create a second request');await page.evaluate(()=>window.__removeRelease());await page.waitForSelector(menu,{hidden:true});assert.equal(await page.evaluate(()=>window.__removalApplied),1);return {requests:1,applied:1};
 });
 for(const selling of [false,true])await run(selling?'remove-with-server-resale':'remove-keep-equipment',async()=>{
  await visit();await openRemoval();await noMutation();assert.match(await page.$eval(removal,node=>node.innerText),/50/);assert.match(await page.$eval(removal,node=>node.innerText),/inconnu|introuvable|historique|conserv/i,'Unknown purchase is explained');await resell(selling);await capture(selling?'removal-resale':'removal-keep');await confirmRemove();await page.waitForFunction(()=>window.__removalApplied===1);await page.waitForSelector(menu,{hidden:true});
  const actual=await page.evaluate(()=>({requests:window.__removals,snapshot:window.__snapshot,quotes:window.__removalQuotes}));assert.equal(actual.requests.length,1);assert.equal(actual.requests[0].zoneId,'starter');assert.equal(actual.requests[0].expectedRevision,1);assert.equal(actual.requests[0].resellEquipment,selling);assert.equal(actual.requests[0].expectedResaleCents,selling?5000:0);assert(actual.requests[0].requestKey);assert(!actual.snapshot.state.zones.some(zone=>zone.id==='starter'));assert.equal(actual.snapshot.cashCents,1500000+(selling?5000:0));return {selling,quoteRequests:1,removalRequests:1,resaleCents:selling?5000:0};
 });
 await run('remove-lost-response-identical-retry',async()=>{
  await visit();await openRemoval();await resell(true);await page.evaluate(()=>window.__removalLoseResponse=true);await confirmRemove();await page.waitForFunction(()=>document.querySelector('[data-warehouse-remove-confirm]')?.textContent.includes('Vérifier'));await page.waitForFunction(selector=>document.querySelector(selector)?.innerText.includes('perdue'),{},menu);await capture('removal-retry');await confirmRemove();await page.waitForSelector(menu,{hidden:true});
  const actual=await page.evaluate(()=>({requests:window.__removals,applied:window.__removalApplied,cash:window.__snapshot.cashCents,quotes:window.__removalQuotes.length}));assert.equal(actual.requests.length,2);assert.deepEqual(actual.requests[1],actual.requests[0],'Retry keeps exact request/key/accepted amount');assert.equal(actual.applied,1);assert.equal(actual.cash,1505000);assert.equal(actual.quotes,1);return {attempts:2,applied:1,sameRequest:true};
 });
 await run('remove-loading-no-premature-confirmation',async()=>{
  await visit();await page.evaluate(()=>window.__quoteHold=true);await openMenu('starter',true);await page.click(action('remove'));await page.waitForFunction(()=>typeof window.__quoteRelease==='function');await noMutation();const active=await page.$$eval('dialog[open] button',nodes=>nodes.filter(node=>node.textContent.includes('Supprimer')&&!node.disabled).length);assert.equal(active,0,'No destructive action before quote');await page.evaluate(()=>window.__quoteRelease());await page.waitForSelector(removal);await close();await noMutation();return {quoteRequests:1,removalRequests:0};
 });
 await run('remove-quote-failure-keeps-zone',async()=>{
  await visit();await page.evaluate(()=>window.__quoteFailure=true);await openMenu('starter',true);await page.click(action('remove'));await page.waitForFunction(()=>document.querySelector('dialog[open]')?.innerText.includes('momentanément indisponible'));await noMutation();assert.equal(await page.evaluate(()=>window.__snapshot.state.zones.length),2);const destructive=await page.$$eval('dialog[open] button',nodes=>nodes.filter(node=>node.textContent.includes('Supprimer')&&!node.disabled).length);assert.equal(destructive,0,'No deletion without authoritative quote');return {zonePreserved:true};
 });
 const drag=async(a,b,touch)=>{
  await start(a,touch);
  for(let step=1;step<=6;step++)await move({x:a.x+(b.x-a.x)*step/6,y:a.y+(b.y-a.y)*step/6},touch);
  await lift(touch);
 };
 const draw=async(kind,cells,touch)=>{
  await page.click('[data-warehouse-draw-kind="'+kind+'"]');await frame();
  await drag(await point(...cells[0]),await point(...cells[1]),touch);
  assert.equal(await page.$('dialog[open]'),null,'Drawing never opens a menu');
  return page.$eval('[data-grow-footprint][data-selected="true"][data-kind="'+kind+'"]',node=>node.dataset.growFootprint);
 };
 const size=id=>page.$eval(footprint(id),node=>[+node.dataset.worldX,+node.dataset.worldZ,+node.dataset.width,+node.dataset.depth]);
 const savePlan=async()=>page.click('[data-warehouse-action="save"]:not(:disabled)');
 await run('isometric-wall-occupied-cell',async()=>{
  await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});
  await visit('savedWall');
  const origin=await size('saved-wall'),wallMenu='dialog[data-warehouse-cell-menu][open]';
  await tap(await zonePoint('saved-wall'),false);await page.waitForSelector(wallMenu);
  await clickButton(wallMenu,'Déplacer sur le plan');await page.waitForSelector(wallMenu,{hidden:true});
  await frame();await tap(await point(1,1),false);await page.waitForSelector(wallMenu);
  assert.match(await page.$eval(wallMenu,node=>node.innerText),/Colonne 2, ligne 2/);
  assert.equal(await page.$eval('[data-warehouse-cell-save]',node=>node.disabled),true);
  await close();assert.deepEqual(await size('saved-wall'),origin);
  await noMutation();return {rejectedPosition:[1,1]};
 });
 for(const touch of [false,true])await run('isometric-edit-'+(touch?'320':'1440'),async()=>{
  await page.setViewport({width:touch?320:1440,height:touch?568:900,isMobile:touch,hasTouch:touch});
  await visit('savedWall&persist=iso-'+touch+'-'+Date.now()+(touch?'&noWebGL':''));
  if(touch)await page.waitForSelector('[data-grow-fallback-plan]');
  await tap(await zonePoint('saved-wall'),touch);await page.waitForSelector('dialog[data-warehouse-cell-menu][open]');await close();
  await frame();await tap(await point(5,5),touch);
  assert.equal(await page.$('dialog[open]'),null,'A free cell never opens a menu');
  assert.equal(await page.$('[data-grow-footprint][data-selected="true"]'),null,'A free cell clears the selection');
  await page.click('[data-grow-zoom-in]');assert(await page.$eval(camera,node=>+node.dataset.zoom>1));await page.click('[data-grow-reset]');
  const culture=await draw('culture',[[4,5],[5,6]],touch);
  const origin=await size(culture);
  await page.click('[data-warehouse-tool="move"]');await frame();
  const a=await point(4,5),b=await point(5,5);await drag(a,b,touch);
  const moved=await size(culture);assert.deepEqual(moved,[origin[0]+1,...origin.slice(1)]);
  await page.click('[data-warehouse-tool="resize"]');await frame();
  await page.focus(camera);await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await settle();
  assert.deepEqual((await size(culture)).slice(2),[3,2],'Keyboard resizes the selected culture');
  await page.click('[data-warehouse-action="reset"]');await page.waitForSelector(footprint(culture),{hidden:true});await noMutation();
  const created=[
   await draw('culture',[[4,5],[5,6]],touch),
   await draw('drying',[[7,5],[8,5]],touch),
   await draw('storage',[[7,8],[8,8]],touch),
  ];
  const payable=await page.$eval('[data-warehouse-plan-payable-cents]',node=>Number(node.dataset.warehousePlanPayableCents));
  assert(payable>0);await noMutation();
  await frame();await capture('isometric-draft-'+(touch?'320':'1440'));
  const before=await page.evaluate(()=>({cash:window.__snapshot.cashCents,revision:window.__snapshot.revision}));
  await page.evaluate(()=>window.__hold=true);await savePlan();
  await page.waitForFunction(()=>typeof window.__release==='function');
  assert.equal(await page.$eval('[data-warehouse-action="save"]',node=>node.disabled),true);
  assert.equal(await page.$eval('[data-warehouse-draw-kind="culture"]',node=>node.disabled),true);
  await page.$eval('[data-warehouse-action="save"]',node=>node.click());
  assert.equal(await page.evaluate(()=>window.__requests.length),1,'The pending save cannot be submitted again');
  await page.evaluate(()=>window.__release());
  await page.waitForFunction(revision=>window.__snapshot.revision===revision+1,{},before.revision);
  const saved=await page.evaluate(()=>({snapshot:window.__snapshot,request:window.__requests[0]}));
  assert.equal(saved.request.expectedCostCents,payable);assert.equal(saved.snapshot.cashCents,before.cash-payable);
  await page.reload({waitUntil:'networkidle0'});
  for(const id of created)await page.waitForSelector(footprint(id));
  assert.deepEqual(await page.evaluate(()=>window.__snapshot.state),saved.snapshot.state);
  await frame();await capture('isometric-saved-'+(touch?'320':'1440'));
  return {touch,fallback:touch,created,payable};
 });
 await run('isometric-save-conflict-and-retry',async()=>{
  await page.setViewport({width:1440,height:900,isMobile:false,hasTouch:false});
  await visit();
  const id=await draw('culture',[[4,5],[5,6]],false);
  await page.evaluate(()=>window.__snapshot.revision++);
  await savePlan();await page.waitForSelector('[data-warehouse-reconcile]');
  assert(await page.$(footprint(id)),'Revision conflict retains the local geometry');
  assert.equal(await page.evaluate(id=>window.__snapshot.state.zones.some(zone=>zone.id===id),id),false);
  await page.click('[data-warehouse-reconcile]');await page.click('[data-warehouse-reconcile-confirm]');
  await page.waitForSelector('[data-warehouse-reconcile]',{hidden:true});
  await visit();
  const retryId=await draw('culture',[[4,5],[5,6]],false);
  await page.evaluate(()=>window.__loseResponseOnce=true);
  await savePlan();
  await page.waitForFunction(()=>document.querySelector('[data-warehouse-action="save"]')?.textContent.includes('réessayer'));
  assert(await page.$(footprint(retryId)),'Uncertain confirmation retains the displayed geometry');
  await savePlan();
  await page.waitForFunction(()=>window.__requests.length===2);
  const result=await page.evaluate(()=>({requests:window.__requests,snapshot:window.__snapshot}));
  assert.deepEqual(result.requests[0],result.requests[1],'Retry preserves accepted price and idempotency key');
  assert.equal(result.snapshot.revision,2);assert.equal(result.snapshot.cashCents,1500000-result.requests[0].expectedCostCents);
  return {conflict:true,identicalRetry:true};
 });
 for(const input of ['mouse','keyboard','drag'])await run('isometric-buddie-'+input,async()=>{
  await page.setViewport({width:1440,height:1080,isMobile:false,hasTouch:false});
  await visit('buddieDock');
  if(!await page.$('[data-warehouse-buddie-toggle]'))await clickButton('[aria-label="Mode du plan"]','Cultures');
  await page.click('[data-warehouse-buddie-toggle]');
  const card='[data-warehouse-buddie-card="HH2026-003"]';
  await page.waitForSelector(card,{visible:true});
  if(input==='drag'){
   const origin=await page.$eval(card,node=>{
    node.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
    const rect=node.getBoundingClientRect();
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
   });
   await drag(origin,await zonePoint('second'),false);
  }else{
   await page.click(card);
   await clickButton('[data-buddie-variety-popover]','Placer ce Buddie');
   if(input==='keyboard'){
    await page.focus('[data-grow-pick="second"]');await page.keyboard.press('Enter');await settle();
   }else{
    await frame();await tap(await zonePoint('second'),false);
   }
  }
  assert(await page.$(footprint('second')+'[data-selected="true"]'));
  assert.equal(await page.$(menu),null,'Buddie placement does not open zone actions');
  await noMutation();await savePlan();
  await page.waitForFunction(()=>window.__snapshot.revision===2);
  const zones=await page.evaluate(()=>window.__snapshot.state.zones);
  assert.equal(zones.find(zone=>zone.id==='second').buddieCode,'HH2026-003');
  assert.equal(zones.find(zone=>zone.id==='starter').buddieCode,undefined);
  return {zoneId:'second',input};
 });
 for(const [width,height]of [[320,568],[1440,900]])await run('tutorial-progression-and-draft-removal-'+width,async()=>{
  const touch=width<1000;await page.setViewport({width,height,isMobile:touch,hasTouch:touch});await page.goto(origin+'/?compact&nativeLesson',{waitUntil:'networkidle0'});await page.waitForSelector('[data-releve-native="warehouse"] '+footprint('culture-1'));await frame();
  const before=await page.evaluate(()=>({cash:window.__lesson.cashCents,revision:window.__lesson.revision,equipment:structuredClone(window.__lesson.warehouse.equipment)}));
  await openMenu('culture-1',touch);await page.click(action('furnish'));await page.waitForSelector(shop);await page.waitForFunction(()=>window.__lesson.milestones.includes('zone-inspected'));
  const details=shop+' [data-warehouse-quote-details] > summary';await page.$eval(details,node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.click(details);await page.waitForFunction(()=>window.__lesson.milestones.includes('quote-read'));await close();
  await openMenu('culture-1',touch);await page.click(action('buddies'));const card='[data-warehouse-zone-buddies] [data-buddie-variety-card="HH2026-005"]';await page.waitForSelector(card);await page.$eval(card,node=>node.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await page.click(card);await page.waitForFunction(()=>window.__lesson.milestones.includes('profile-read'));await page.waitForSelector('[data-buddie-variety-popover]');await page.click('[data-buddie-variety-close]');await close();
  await openMenu('culture-1',touch);await page.click(action('remove'));await page.waitForSelector(removal);assert.match(await page.$eval(removal,node=>node.textContent),/entraînement/);assert.match(await page.$eval(removal,node=>node.textContent),/sans revente/);assert.equal(await page.$(removal+' input[type="radio"]'),null,'Tutorial offers no resale transaction');await capture('tutorial-removal-'+width);await confirmRemove();await page.waitForSelector(menu,{hidden:true});await page.waitForFunction(()=>window.__lesson.draftWarehouse.zones.length===0);
  const draft=await page.evaluate(()=>({state:window.__lesson,calls:window.__lessonCalls}));assert.equal(draft.state.warehouse.zones.length,1,'Saved lesson plan stays intact until explicit save');assert.equal(draft.state.cashCents,before.cash);assert.deepEqual(draft.state.draftWarehouse.equipment,before.equipment,'Equipment remains in reserve');assert.deepEqual(draft.calls.filter(call=>call.method!=='GET'),[],'No POST or PATCH while browsing or removing the draft');
  const save=await page.waitForFunction(()=>[...document.querySelectorAll('[data-warehouse-action="save"]')].find(node=>node.checkVisibility()&&!node.disabled)||false);await save.asElement().click();await save.dispose();await page.waitForFunction(revision=>window.__lesson.revision===revision+1,{},before.revision);
  const after=await page.evaluate(()=>({state:window.__lesson,calls:window.__lessonCalls}));assert.equal(after.state.warehouse.zones.length,0);assert.equal(after.state.cashCents,before.cash);assert.deepEqual(after.state.warehouse.equipment,before.equipment);const writes=after.calls.filter(call=>call.method!=='GET');assert.equal(writes.length,1);assert.equal(writes[0].method,'PATCH');assert.equal(writes[0].body.expectedCostCents,0);assert.equal(await page.evaluate(()=>window.__apiCalls.length),0,'Tutorial never touches the live API adapter');return {width,milestones:['zone-inspected','quote-read','profile-read'],draftRemoval:true,resaleRequests:0,saveRequests:1,equipmentPreserved:true};
 });
 assert.deepEqual(errors,[],'No uncaught browser errors');assert.deepEqual(blocked,[],'No external or real API traffic');
 console.log(JSON.stringify({passed:checks.filter(check=>check.passed).length,total:checks.length,output},null,2));
 if(checks.some(check=>!check.passed))process.exitCode=1;
} finally {
 await report();
 if(browser){const timer=setTimeout(()=>browser.process()?.kill(),5000);await browser.close().catch(()=>{});clearTimeout(timer);}
 server.httpServer?.closeAllConnections();await server.close();
}
`;
const target = resolve(output, 'run.mjs');
await writeFile(target, source);
await import(pathToFileURL(target).href + '?run=' + Date.now());
