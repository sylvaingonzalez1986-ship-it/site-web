/** Local UI audit. Real lobby, shell, collection and progression; destination stubs isolate navigation. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/placard-navigation'), port=Number(process.env.NAVIGATION_AUDIT_PORT??3248), origin=`http://127.0.0.1:${port}`, preview=process.argv.includes('--preview');
const MAP_ASSET='/placard/map/placard-world-sylvain-v5.webp';
const BUILDING_IDS=['warehouse','bank','office','market','shop','arena','missions','collection'];
// Independently inspected landmarks in the 1536 x 1024 v5 painting. These do
// not come from the app's polygons, so a wrongly traced mask cannot self-pass.
const MAP_LANDMARKS={warehouse:[365,255],bank:[800,221],office:[1180,320],market:[275,551],shop:[809,796],arena:[1235,619],missions:[753,453],collection:[284,831]};
const MAP_GROUND_POINTS=[[950,320],[530,410]];
function fixturePayload(path,scenario){
 if(path==='/api/arena/placard/equipment')return {tentNumber:1,tents:[{tentNumber:1,equippedCodes:[],levels:{}}],productionUnits:scenario==='active'?4:1,ownedCodes:[],purchasedCodes:[],equippedCodes:[],cashCents:scenario==='investment'?500000:0,levels:{},reputation:0,activeRun:scenario==='active'||scenario.startsWith('overflow')||scenario==='storage-error',readyLotCount:scenario==='lots'?2:0,availableFlowerCount:scenario==='jury'?1:0,routeMasteries:[],routePlan:null};
 if(path==='/api/arena/placard/storage')return scenario==='storage-error'?null:{serverNow:'2026-10-11T12:00:00.000Z',lots:scenario.startsWith('overflow')?[{flowerId:'first',projection:{nextChangeAt:'2026-10-11T12:30:00.000Z',capacity:{overflowUnits:1250,overflowDeadlineAt:'2026-10-11T12:30:00.000Z'}}},{flowerId:'second',projection:{nextChangeAt:'2026-10-11T14:00:00.000Z',capacity:{overflowUnits:2500,overflowDeadlineAt:'2026-10-11T14:00:00.000Z'}}}]:[]};
 if(path==='/api/arena/placard/collection')return {collection:{cards:[]}};
 if(path==='/api/account/collection')return {pages:[],summary:{totalCards:0,ownedUnique:0,totalOwnedCopies:0,duplicateCopies:0},availableClaims:[]};
 return null;
}
const previewFetch=preview?`const fixturePayload=${fixturePayload.toString()};const nativeFetch=window.fetch.bind(window);let failed=false;window.fetch=async(input,init={})=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);const scenario=new URLSearchParams(location.search).get('scenario')||'starter';const method=init.method||(input instanceof Request?input.method:'GET');if(method!=='GET')return new Response(JSON.stringify({error:'Prévisualisation locale : lecture seule'}),{status:405,headers:{'Content-Type':'application/json'}});if(scenario==='error'&&!failed&&url.pathname==='/api/arena/placard/equipment'){failed=true;return new Response(JSON.stringify({error:'Essai local'}),{status:503,headers:{'Content-Type':'application/json'}});}const body=fixturePayload(url.pathname,scenario);return new Response(JSON.stringify(body||{error:'API non simulée'}),{status:body?200:404,headers:{'Content-Type':'application/json'}});};`:'';
const stub=(name,body)=>`import React from 'react';export function ${name}(props){return <section data-destination="${name}" style={{padding:24}}><p data-simulated-destination>Destination simulée · vérification de navigation uniquement.</p>${body}</section>}`;
const destinations={
 './KqHarvests':stub('KqHarvests','<h1>Mes récoltes</h1><p data-harvest-section>{props.section}</p><button onClick={()=>props.onSectionChange("storage")}>Stockage et affinage</button><button onClick={()=>props.onOpenArena("fixture-flower")}>Présenter au jury</button><button onClick={()=>props.onOpenMarket("fixture-flower")}>Vendre cette récolte</button>'),
 './KanabQuestDicePrototype':stub('KanabQuestDicePrototype','<h1>{props.viewMode === "arena" ? "Jury & duels" : "La culture"}</h1>'),
 './KqWarehouseEntry':stub('KqWarehouseEntry','<h1>Entrepôt</h1><p data-equipment>{props.initialEquipmentCode}</p><p data-catalog>{props.initialShopOpen ? "Matériel" : "Plan"}</p><button onClick={()=>props.onOpenShop("LED-500")}>Acheter une lampe</button>'),
 './KqMarketDesk':stub('KqMarketDesk','<h1>Marché</h1><p data-market-section>{props.section}</p><button onClick={()=>props.onSectionChange("demands")}>Demandes du moment</button><button onClick={()=>props.onSectionChange("sales")}>Transformer et vendre</button><button onClick={()=>props.onSectionChange("dashboard")}>Suivre ma boutique</button><button onClick={()=>props.onSectionChange("management")}>Gérer mon activité</button><button onClick={()=>props.onOpenShop("COMPUTER")}>Acheter un ordinateur</button>'),
 './KqTreasuryDesk':stub('KqTreasuryDesk','<h1>{props.initialPole === "bank" ? "La Banque" : "Le Bureau"}</h1><p data-treasury-pole>{props.initialPole}</p>'),
 './KqSupportBoosterShop':stub('KqSupportBoosterShop','<h1>Boutique</h1><p data-catalog>Packs</p><p data-shop-section>{props.initialSection}</p><button onClick={()=>props.onSectionChange("buddies")}>Packs Buddies</button><button onClick={props.onExit}>Quitter la boutique</button><button data-open-shop-collection onClick={()=>props.onOpenCollection(props.initialSection)}>Collections</button>'),
 './KqMissionCenter':stub('KqMissionCenter','<h1>Missions</h1><button onClick={()=>props.onOpen("shop")}>Mes packs</button>'),
};
const modules={
 'entry':`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {PlacardPlayerShell} from '/src/components/placard/PlacardPlayerShell';${previewFetch}createRoot(document.getElementById('root')).render(<>${preview?'<p role="note" style={{margin:0,padding:"8px 16px",background:"#fffaf1",color:"#003f30",fontSize:12}}>Prévisualisation locale du menu · données de démonstration. Les destinations sont simulées.</p>':''}<PlacardPlayerShell/></>);`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
 'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
 'next/navigation':`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{}});`,
 'next/dynamic':`import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
 ...Object.fromEntries(Object.entries(destinations).map(([key,value])=>['destination:'+key,value])),
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}button{cursor:pointer}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'placard-clarity',enforce:'pre',resolveId(id,importer){if(importer?.replaceAll('\\','/').endsWith('/PlacardPlayerShell.tsx')&&id in destinations)return '\0destination:'+id;if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['/','/arene/placard'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard — vérification locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
﻿let browser, scenario='starter', failed=false;
const errors=[], requests=[], results=[];
await mkdir(output,{recursive:true});
if(preview){ await server.listen(); console.log(`Prévisualisation navigation : ${origin}/arene/placard`); }
else try {
 await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(); page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=new URL(request.url());
  if(url.protocol==='data:')return void request.continue();
  if(url.origin!==origin)return void request.abort();
  if(!url.pathname.startsWith('/api/'))return void request.continue();
  requests.push({path:url.pathname,method:request.method()});
  const payload=fixturePayload(url.pathname,scenario);
  if(scenario==='error'&&!failed&&url.pathname==='/api/arena/placard/equipment') { failed=true; return void request.respond({status:503,contentType:'application/json',body:'{"error":"Essai local"}'}); }
  if(scenario==='overflow-equipment-error'&&url.pathname==='/api/arena/placard/equipment')return void request.respond({status:503,contentType:'application/json',body:'{"error":"Résumé indisponible"}'});
  void request.respond({status:payload?200:404,contentType:'application/json',body:JSON.stringify(payload??{error:'API non simulée'})});
 });
 const visit=async(state='starter',query='')=>{scenario=state;failed=false;await page.goto(`${origin}/arene/placard?scenario=${state}${query?'&'+query:''}`,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
 const view=async destination=>{await page.waitForSelector(`[data-placard-view="${destination}"]`);if(destination!=='hub')await page.waitForSelector('[data-destination]');};
 const visible=async selector=>page.waitForFunction(selector=>[...document.querySelectorAll(selector)].find(element=>element.checkVisibility()),{},selector);
 const mapPoint=async(id,kind='hit')=>page.evaluate(({id,kind})=>{
  const viewport=document.querySelector('#placard-map-viewport');viewport.scrollIntoView({block:'center',behavior:'instant'});
  const button=document.querySelector(`[data-map-building="${id}"]`),image=viewport.querySelector('img');
  const values=button.getAttribute(`data-map-${kind}-point`)?.split(',').map(Number);
  if(!values||values.length!==2||values.some(value=>!Number.isFinite(value)))throw new Error(`Missing map ${kind} point for ${id}`);
  const rect=image.getBoundingClientRect();return {x:rect.left+rect.width*values[0]/100,y:rect.top+rect.height*values[1]/100};
 },{id,kind});
 const click=async selector=>{
  const building=selector.match(/^\[data-map-building="([a-z]+)"\]$/)?.[1];
  if(building){const point=await mapPoint(building);if((await page.viewport()).hasTouch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);return;}
  const handle=await visible(selector);await handle.asElement().click();await handle.dispose();
 };
 const clickText=async text=>{const handle=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(element=>element.checkVisibility()&&element.textContent.trim()===text),{},text);await handle.asElement().click();await handle.dispose();};
 const screenshot=async name=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.screenshot({path:resolve(output,`${name}.png`),fullPage:true});};
 const assertNoOverflow=async label=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' stays within the viewport');
 let width=1440;
 const navTo=async key=>{
  if(width<=1000){await click('nav[aria-label="Accès rapides de Kanab Quest"] button[aria-haspopup="dialog"]');await page.waitForSelector('dialog[aria-label="Menu de Kanab Quest"][open]');await click(`dialog[open] [data-placard-nav="${key}"]`);}
  else await click(`nav[aria-label="Navigation de Kanab Quest"] [data-placard-nav="${key}"]`);
  if(key!=='collection')await view(key);
 };
 const album='dialog[aria-labelledby="botte-collection-title"]';
 const measureMap=()=>page.evaluate(()=>{
  const rect=element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const viewport=document.querySelector('#placard-map-viewport');
  const image=viewport.querySelector('img');
  const buildings=[...document.querySelectorAll('[data-map-building]')].map(element=>{
   const label=document.querySelector(`[data-map-label="${element.dataset.mapBuilding}"]`)??element.firstElementChild;
   const hit=element.querySelector('[data-map-hit-area]');
   return {id:element.dataset.mapBuilding,label:element.getAttribute('aria-label')??element.textContent,bounds:rect(element),labelBounds:label?rect(label):null,hitBounds:hit?rect(hit):null,clipPath:hit?getComputedStyle(hit).clipPath:null,role:element.getAttribute('role'),tabIndex:element.tabIndex};
  });
  return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,imageLoaded:image.complete&&image.naturalWidth>0,source:image.getAttribute('src'),viewport:{...rect(viewport),clientWidth:viewport.clientWidth,scrollWidth:viewport.scrollWidth,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop},buildings,brokenImages:[...document.images].filter(element=>element.complete&&!element.naturalWidth).map(element=>element.src)};
 });
 const waitForVisibleSilhouette=async id=>page.waitForFunction(id=>{
  const shape=document.querySelector(`[data-map-silhouette="${id}"][data-active]`);
  if(!shape)return false;
  const style=getComputedStyle(shape),groupStyle=getComputedStyle(shape.parentElement);
  return Number(groupStyle.opacity)>.95&&style.visibility==='visible'&&style.stroke!=='none'&&Number.parseFloat(style.strokeWidth)>0;
 },{},id);
 const checkMapSilhouettes=async width=>{
  await page.$eval('#placard-map-viewport',element=>element.scrollIntoView({block:'center',behavior:'instant'}));
  const geometry=await page.evaluate(()=>{
   const image=document.querySelector('#placard-map-viewport img').getBoundingClientRect();
   return [...document.querySelectorAll('[data-map-building]')].map(button=>{
    const inspect=kind=>{
     const [x,y]=button.getAttribute(`data-map-${kind}-point`).split(',').map(Number);
     const point={x:image.left+image.width*x/100,y:image.top+image.height*y/100};
     const target=document.elementFromPoint(point.x,point.y),bounds=button.querySelector('[data-map-hit-area]').getBoundingClientRect();
     return {point,hit:target?.closest('[data-map-building]')?.getAttribute('data-map-building')??null,
      maskHit:document.elementsFromPoint(point.x,point.y).find(element=>element.matches('[data-map-hit-area]'))?.getAttribute('data-map-hit-area')??null,
      labelHit:target?.closest('[data-map-label]')?.getAttribute('data-map-label')??null,
      inBoundingBox:point.x>bounds.left&&point.x<bounds.right&&point.y>bounds.top&&point.y<bounds.bottom};
    };
    const silhouette=document.querySelector(`[data-map-silhouette="${button.dataset.mapBuilding}"]`);
    return {id:button.dataset.mapBuilding,hit:inspect('hit'),ground:inspect('ground'),
     shape:silhouette?.tagName,vertices:silhouette?.points?.numberOfItems??0,
     controlPointerEvents:getComputedStyle(button).pointerEvents,
     hitPointerEvents:getComputedStyle(button.querySelector('[data-map-hit-area]')).pointerEvents};
   });
  });
  results.at(-1).silhouetteGeometry=geometry;
  for(const building of geometry){
   assert.equal(building.hit.hit,building.id,`${width}: actual building point activates ${building.id}`);
   assert.equal(building.hit.maskHit,building.id,`${width}: ${building.id} facade lies inside its silhouette, independently of its label`);
   assert.equal(building.ground.inBoundingBox,true,`${width}: ${building.id} ground point tests inside its former rectangular hit box`);
   assert.equal(building.ground.maskHit,null,`${width}: ground inside ${building.id} bounds is outside every silhouette`);
   assert(building.ground.hit===null||building.ground.labelHit!==null,`${width}: only a separate accessible label may cover ground near ${building.id}`);
   assert.equal(building.controlPointerEvents,'none',`${width}: ${building.id} button bounding rectangle is inert`);
   assert.equal(building.hitPointerEvents,'auto',`${width}: ${building.id} silhouette accepts input`);
   assert.equal(building.shape,'polygon');assert(building.vertices>=5,`${building.id} follows a building contour`);
  }
  const landmarks=await page.evaluate(({buildings,ground})=>{
   const bounds=document.querySelector('#placard-map-viewport img').getBoundingClientRect();
   const inspect=([x,y])=>{const point={x:bounds.left+bounds.width*x/1536,y:bounds.top+bounds.height*y/1024},target=document.elementFromPoint(point.x,point.y);return {screenPoint:point,hit:target?.closest('[data-map-building]')?.getAttribute('data-map-building')??null,maskHit:document.elementsFromPoint(point.x,point.y).find(element=>element.matches('[data-map-hit-area]'))?.getAttribute('data-map-hit-area')??null};};
   return {buildings:Object.entries(buildings).map(([id,point])=>({id,point,...inspect(point)})),ground:ground.map(point=>({point,...inspect(point)}))};
  },{buildings:MAP_LANDMARKS,ground:MAP_GROUND_POINTS});
  results.at(-1).landmarks=landmarks;
  for(const landmark of landmarks.buildings){assert.equal(landmark.hit,landmark.id,`${width}: independently inspected facade ${landmark.id} is clickable`);assert.equal(landmark.maskHit,landmark.id,`${width}: independently inspected facade ${landmark.id} is inside its real silhouette`);}
  for(const landmark of landmarks.ground)assert.equal(landmark.hit,null,`${width}: inspected soil at ${landmark.point} does not select a building`);
  // A hit-test alone is insufficient: an actual ground click must not open a
  // panel, change the selected building, or navigate to another destination.
  const before=await page.evaluate(()=>({url:location.href,selected:document.querySelector('[data-map-building][data-selected]')?.getAttribute('data-map-building')??null}));
  // Use exact pointer coordinates for soil: mobile browsers deliberately expand
  // nearby label taps beyond elementFromPoint for finger-target adjustment.
  const clearGround=[...geometry.filter(building=>building.ground.hit===null).map(building=>({id:building.id,point:building.ground.point})),...landmarks.ground.map(landmark=>({id:landmark.point.join(','),point:landmark.screenPoint}))];
  for(const building of clearGround){
   await page.mouse.click(building.point.x,building.point.y);
   const after=await page.evaluate(()=>({url:location.href,selected:document.querySelector('[data-map-building][data-selected]')?.getAttribute('data-map-building')??null}));
   assert.deepEqual(after,before,`${width}: clicking the ground beside ${building.id} has no action`);
  }
  if(width>1000){
   for(const building of geometry){await page.mouse.move(building.hit.point.x,building.hit.point.y);await waitForVisibleSilhouette(building.id);}
   const point=await mapPoint('warehouse');await page.mouse.move(point.x,point.y);await screenshot(`quartier-hover-${width}`);await page.mouse.move(0,0);
  }
  await page.keyboard.press('Tab');
  for(const id of BUILDING_IDS){await page.focus(`[data-map-building="${id}"]`);await waitForVisibleSilhouette(id);assert(await page.$eval(`[data-map-label="${id}"]`,element=>[element,...element.querySelectorAll('*')].some(part=>{const style=getComputedStyle(part);return style.outlineStyle!=='none'&&Number.parseFloat(style.outlineWidth)>0;})),`${width}: ${id} visible label has a keyboard focus ring`);}
  await page.focus('[data-map-building="warehouse"]');await screenshot(`quartier-focus-${width}`);
  await page.keyboard.press('Enter');await page.waitForSelector('#placard-building-details');
  await page.keyboard.press('Escape');await page.waitForSelector('#placard-building-details',{hidden:true});
  assert.equal(await page.$eval('[data-map-building="warehouse"]',element=>element===document.activeElement),true,'Keyboard activation restores the original building after Escape');
  return {geometry,landmarks};
 };
 for(width of (process.env.NAVIGATION_AUDIT_WIDTHS?.split(',').map(Number)??[320,390,768,1440])) {
  await page.setViewport({width,height:width<=390?844:1000,isMobile:width<=390,hasTouch:width<=390,deviceScaleFactor:1});
  await visit('active');await view('hub');
  await page.waitForSelector('[aria-label="À faire maintenant"]');
  const measurement=await measureMap();
  results.push({width,measurement});
  await screenshot(`quartier-${width}`);
  assert.equal(measurement.overflow,false);assert.equal(measurement.imageLoaded,true);assert.equal(measurement.source,MAP_ASSET);assert.deepEqual(measurement.brokenImages,[]);
  assert.deepEqual(measurement.buildings.map(building=>building.id).sort(),[...BUILDING_IDS].sort(),'Every illustrated destination has one real hit target');
  assert(measurement.viewport.scrollWidth<=measurement.viewport.clientWidth+1,'The overview shows the complete image');
  for(const [index,building] of measurement.buildings.entries()){
   assert(building.labelBounds?.width>=44&&building.labelBounds?.height>=44,`${width}: ${building.id} has a visible 44px label alternative to its irregular silhouette`);
   assert(building.labelBounds.left>=measurement.viewport.left-1&&building.labelBounds.right<=measurement.viewport.right+1&&building.labelBounds.top>=measurement.viewport.top-1&&building.labelBounds.bottom<=measurement.viewport.bottom+1,`${width}: ${building.id} label is fully visible in the overview`);
   assert(building.clipPath?.startsWith('polygon('),`${width}: ${building.id} uses a real polygon hit mask`);
   assert(building.tabIndex>=0,`${width}: ${building.id} has keyboard access`);
   assert(/[a-zÀ-ÿ]/i.test(building.label),`${building.id} has a visible name, not a number`);
   for(const other of measurement.buildings.slice(index+1)){
    const a=building.labelBounds,b=other.labelBounds;if(!a||!b)continue;
    assert(Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1,`${width}: ${building.id} and ${other.id} labels do not overlap`);
   }
  }
  results.at(-1).silhouettes=await checkMapSilhouettes(width);
  if(width<=1000){
   const trigger='nav[aria-label="Accès rapides de Kanab Quest"] button[aria-haspopup="dialog"]';
   await page.focus(trigger);await page.keyboard.press('Enter');await page.waitForSelector('dialog[aria-label="Menu de Kanab Quest"][open]');
   assert.equal(await page.evaluate(()=>document.querySelector('dialog[open]').contains(document.activeElement)),true,'Drawer receives focus');
   await screenshot(`menu-${width}`);await assertNoOverflow('Mobile menu');
   for(let index=0;index<16;index++){await page.keyboard.press('Tab');const focus=await page.evaluate(()=>({contained:document.querySelector('dialog[open]').contains(document.activeElement),tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,80)}));assert(focus.contained||focus.tag==='BODY',`Modal keyboard focus never reaches a background control: ${JSON.stringify(focus)}`);}
   await page.keyboard.press('Escape');await page.waitForSelector('dialog[aria-label="Menu de Kanab Quest"][open]',{hidden:true});
   assert.equal(await page.$eval(trigger,element=>element===document.activeElement),true,'Escape returns focus to Menu');
  }else{
   await page.hover('nav[aria-label="Navigation de Kanab Quest"] [data-placard-nav="market"]');await page.waitForSelector('[data-map-building="market"][data-highlighted]');
   await page.focus('nav[aria-label="Navigation de Kanab Quest"] [data-placard-nav="game"]');await page.waitForSelector('[data-map-building="warehouse"][data-highlighted]');
  }
  await click('[data-map-building="warehouse"]');await page.waitForSelector('#placard-building-details');
  await page.waitForFunction(()=>document.activeElement?.id==='placard-building-details');await screenshot(`entrepot-actions-${width}`);await assertNoOverflow('Warehouse choices');
  await page.keyboard.press('Escape');await page.waitForSelector('#placard-building-details',{hidden:true});assert.equal(await page.$eval('[data-map-building="warehouse"]',element=>element===document.activeElement),true);
  await click('[data-map-building="warehouse"]');await click('[data-placard-activity="storage"]');await view('harvests');
  assert.equal(new URL(page.url()).searchParams.get('view'),'harvests');
  await page.goBack();await view('hub');assert.equal(await page.$eval('[data-map-building="warehouse"]',element=>element.dataset.selected),'true','Selection survives return');
  await click('[data-map-zoom-toggle]');await page.waitForSelector('[data-map-zoomed]');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.$eval('#placard-map-viewport',element=>{element.scrollLeft=100;element.scrollTop=70;});
  await page.waitForFunction(()=>document.querySelector('#placard-map-viewport').scrollLeft>0);
  const before=await page.$eval('#placard-map-viewport',element=>({left:element.scrollLeft,top:element.scrollTop}));
  await navTo('game');await page.goBack();await view('hub');await page.waitForSelector('[data-map-zoomed]');
  const after=await page.$eval('#placard-map-viewport',element=>({left:element.scrollLeft,top:element.scrollTop}));
  assert(Math.abs(after.left-before.left)<=1&&Math.abs(after.top-before.top)<=1,'Map zoom and framing survive navigation');
  results.at(-1).zoomLayout=await page.evaluate(()=>({windowScroll:scrollY,scrollContainers:[...document.querySelectorAll('*')].filter(element=>element.scrollTop>0).map(element=>({tag:element.tagName,className:String(element.className),top:element.scrollTop,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight})),panel:document.querySelector('#placard-building-details')?.getBoundingClientRect().toJSON()}));
  const panPoint=await page.$eval('#placard-map-viewport',element=>{element.scrollIntoView({block:'center',behavior:'instant'});const rect=element.getBoundingClientRect();return {x:rect.left+rect.width*.7,y:rect.top+rect.height*.6};});
  const panStart=await page.$eval('#placard-map-viewport',element=>element.scrollLeft);
  if(width<=390){const client=await page.createCDPSession();await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:panPoint.x,y:panPoint.y}]});for(let step=1;step<=6;step++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:panPoint.x-step*10,y:panPoint.y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();}
  else {await page.mouse.move(panPoint.x,panPoint.y);await page.mouse.down();await page.mouse.move(panPoint.x-70,panPoint.y,{steps:10});await page.mouse.up();}
  await page.waitForFunction(start=>document.querySelector('#placard-map-viewport')?.scrollLeft>start+10,{},panStart);await view('hub');
  results.at(-1).afterPanLayout=await page.evaluate(()=>({windowScroll:scrollY,scrollContainers:[...document.querySelectorAll('*')].filter(element=>element.scrollTop>0).map(element=>({tag:element.tagName,className:String(element.className),top:element.scrollTop,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight})),panelChildren:[...document.querySelector('#placard-building-details').children].map(element=>({tag:element.tagName,text:element.textContent.slice(0,40),rect:element.getBoundingClientRect().toJSON(),overflow:getComputedStyle(element).overflow}))}));
  await screenshot(`quartier-zoom-${width}`);await click('[data-map-zoom-toggle]');await page.waitForSelector('[data-map-zoomed]',{hidden:true});
  await click('[data-map-building="bank"]');await view('treasury');assert.equal(new URL(page.url()).searchParams.get('pole'),'bank');
  await page.goBack();await view('hub');await click('[data-map-building="office"]');await view('treasury');assert.equal(new URL(page.url()).searchParams.get('pole'),'accounting');
  await page.goBack();await view('hub');await click('[data-map-building="collection"]');await page.waitForSelector(album+'[open]');await page.keyboard.press('Escape');await page.waitForSelector(album+'[open]',{hidden:true});
  await page.waitForFunction(()=>document.activeElement?.matches('[data-map-building="collection"]'));
  for(const destination of ['shop','arena','missions']){
   await click(`[data-map-building="${destination}"]`);await view(destination);
   assert.equal(new URL(page.url()).searchParams.get('view'),destination,`${width}: ${destination} facade opens its destination`);
   await page.goBack();await view('hub');
  }
  await page.focus('[data-map-building="market"]');await page.keyboard.press('Space');await page.waitForSelector('#placard-building-details');
  await click('[data-placard-activity="market"]');await view('market');
  await page.goBack();await view('hub');
  await navTo('collection');await page.waitForSelector(album+'[open]');await page.keyboard.press('Escape');await page.waitForSelector(album+'[open]',{hidden:true});
  await navTo('harvests');await clickText('Présenter au jury');await view('arena');assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
  await page.goBack();await view('harvests');await clickText('Vendre cette récolte');await view('market');assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','A harvest shortcut still opens its sale');
  await navTo('market');await assertNoOverflow('Commerce');await screenshot(`commerce-navigation-${width}`);
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'demands','The market navigation opens client requests');
  await navTo('workshop');await clickText('Acheter une lampe');await view('workshop');await page.waitForFunction(()=>document.querySelector('[data-catalog]')?.textContent==='Matériel');assert.equal(new URL(page.url()).searchParams.get('equipment'),'LED-500');
  results.at(-1).navigation='passed';
 }
 width=390;await page.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 for(const state of ['starter','lots','jury','investment']){
  await visit(state);await view('hub');await page.waitForSelector('[aria-label="À faire maintenant"]');await screenshot(`${state}-390`);
  const expected={starter:'game',lots:'market',jury:'arena',investment:'workshop'}[state];
  await click('[aria-label="À faire maintenant"] button');await view(expected);
  if(state==='investment'){assert.equal(new URL(page.url()).searchParams.get('catalog'),'equipment');assert(new URL(page.url()).searchParams.get('equipment'));}
  results.push({scenario:state,destination:expected});
 }
 for(const state of ['overflow','overflow-equipment-error']){
  await visit(state);await view('hub');await page.waitForSelector('[data-priority="storage"]');
  const notice=await page.$eval('[data-priority="storage"]',element=>element.textContent);
  assert(notice.includes('375 g sans contenant'),'The priority uses the sum of the server surplus');assert(notice.includes('14:30'),'The earliest server deadline is shown in Paris time');
  assert(notice.includes('Protéger ma récolte'));assert.equal(await page.$$eval('[aria-label="À faire maintenant"]',elements=>elements.length),1,'Urgency replaces the ordinary recommendation');
  await assertNoOverflow('Storage urgency');await screenshot(`${state}-390`);await click('[data-priority="storage"] button');await view('harvests');
  assert.equal(new URL(page.url()).searchParams.get('section'),'storage');assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),'storage');results.push({scenario:state,destination:'harvests',section:'storage'});
 }
 await visit('storage-error');await view('hub');await page.waitForSelector('[aria-label="À faire maintenant"]');assert.equal(await page.$('[data-priority="storage"]'),null);await screenshot('storage-error-390');await click('[aria-label="À faire maintenant"] button');await view('game');results.push({scenario:'storage-error',destination:'game'});
 await visit('error');await page.waitForFunction(()=>document.body.textContent.includes('Ton résumé est indisponible'));await assertNoOverflow('Error');await clickText('Réessayer');await page.waitForSelector('[aria-label="À faire maintenant"]');
 await visit('starter','view=treasury&pole=management');await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'management');
 await visit('starter','view=market&section=dashboard');await view('market');await clickText('Acheter un ordinateur');await view('workshop');assert.equal(await page.$eval('[data-equipment]',element=>element.textContent),'COMPUTER');await page.goBack();await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'dashboard');
 width=1440;await page.setViewport({width,height:1000,isMobile:false,hasTouch:false,deviceScaleFactor:1});
 await visit('starter','view=market&section=dashboard');await view('market');await navTo('shop');
 assert.equal(new URL(page.url()).searchParams.get('from'),'market');assert.equal(new URL(page.url()).searchParams.get('fromSection'),'dashboard','The sidebar shop preserves the current Commerce sub-section');
 assert.equal(await page.$eval('[data-catalog]',element=>element.textContent),'Packs','The sidebar enters the general shop');
 await clickText('Quitter la boutique');await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'dashboard');assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'dashboard');
 results.push({scenario:'sidebar-shop-return',destination:'market',section:'dashboard'});
 for(const [query,expected] of [['view=market','demands'],['view=market&section=sales','sales'],['view=market&section=demands&flower=fixture-flower','demands'],['view=market&flower=fixture-flower','sales']]) {
  await visit('starter',query);await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),expected);
  await clickText('Acheter un ordinateur');await view('workshop');assert.equal(await page.$eval('[data-catalog]',element=>element.textContent),'Matériel');await page.goBack();await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),expected,'Browser Back from equipment retains the chosen market section');
  results.push({scenario:'market-entry-and-return',query,section:expected});
 }
 await visit('starter','view=market');await view('market');await clickText('Transformer et vendre');
 await page.waitForFunction(()=>new URLSearchParams(location.search).get('section')==='sales');
 await clickText('Demandes du moment');await page.waitForFunction(()=>document.querySelector('[data-market-section]')?.textContent==='demands');
 await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-market-section]')?.textContent==='sales');
 results.push({scenario:'market-back-navigation',section:'sales'});
 await visit('starter','view=workshop&section=storage');await view('workshop');assert.equal(await page.$eval('[data-placard-view]',element=>element.dataset.placardView),'workshop');
 for(const equipment of ['LED-500','COMPUTER','HASH_SIFTER']){
  await visit('starter',`view=shop&catalog=equipment&equipment=${equipment}`);await view('workshop');
  await page.waitForFunction(()=>new URLSearchParams(location.search).get('view')==='workshop');
  assert.equal(await page.$eval('[data-equipment]',element=>element.textContent),equipment);
  assert.equal(await page.$eval('[data-catalog]',element=>element.textContent),'Matériel');
  results.push({scenario:'legacy-equipment-url',equipment,destination:'workshop'});
 }
 await visit('starter','view=shop&section=buddies');await view('shop');assert.equal(await page.$eval('[data-shop-section]',element=>element.textContent),'buddies');
 await click('[data-open-shop-collection]');await page.waitForSelector(album+'[open]');assert.equal(await page.$eval('[data-collection-tab=buddies]',element=>element.getAttribute('aria-selected')),'true');await page.keyboard.press('Escape');
 results.push({scenario:'buddies-shop-album',initialSection:'buddies'});
 assert.deepEqual(errors,[]);assert(requests.every(request=>request.method==='GET'),'Audit never mutates real state');
 await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors,requests},null,2));
 console.log(JSON.stringify({success:true,output,widths:results.filter(result=>result.width).map(result=>result.width),scenarios:results.filter(result=>result.scenario).length,errors:errors.length},null,2));
}catch(error){
 if(browser){const pages=await browser.pages();await pages.at(-1)?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});}
 await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors,requests,failure:error.stack},null,2));throw error;
}finally{if(!preview){await browser?.close();await server.close();}}
