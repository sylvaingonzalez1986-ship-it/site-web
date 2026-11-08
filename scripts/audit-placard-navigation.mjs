/** Local UI audit. Real lobby, shell, collection and progression; destination stubs isolate navigation. */
import assert from 'node:assert/strict';
import {mkdir, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/placard-navigation'), port=Number(process.env.NAVIGATION_AUDIT_PORT??3248), origin=`http://127.0.0.1:${port}`, preview=process.argv.includes('--preview');
const clarityOnly=process.argv.includes('--clarity-only');
const motionOnly=process.argv.includes('--motion-only');
const MAP_ASSET='/placard/map/placard-world-sylvain-v6.webp';
const BUILDING_IDS=['warehouse','bank','office','market','shop','arena','missions','collection'];
// Independently inspected landmarks in the 1536 x 1024 v6 painting. These do
// not come from the app's polygons, so a wrongly traced mask cannot self-pass.
const MAP_LANDMARKS={warehouse:[365,255],bank:[800,221],office:[1180,320],market:[275,551],shop:[809,796],arena:[1235,619],missions:[753,453],collection:[284,831]};
const MAP_GROUND_POINTS=[[950,320],[530,410]];
function fixturePayload(path,scenario){
 if(path==='/api/arena/placard/staff')return {state:{playerWorkDays:{'1':{usedHours:0}},employees:[],tasks:[],payroll:[]},calendar:{day:1,nextDayAt:'2026-10-11T14:00:00.000Z'},serverNow:'2026-10-11T12:00:00.000Z'};
 if(path==='/api/arena/placard/equipment')return {tentNumber:1,tents:[{tentNumber:1,equippedCodes:[],levels:{}}],productionUnits:scenario==='active'?4:1,ownedCodes:[],purchasedCodes:[],equippedCodes:[],cashCents:scenario==='investment'?500000:0,levels:{},reputation:0,activeRun:scenario==='active'||scenario==='motion'||scenario.startsWith('overflow')||scenario==='storage-error',readyLotCount:scenario==='lots'||scenario==='motion'?2:0,availableFlowerCount:scenario==='jury'||scenario==='motion'?1:0,routeMasteries:[],routePlan:null};
 if(path==='/api/arena/placard/storage')return scenario==='storage-error'?null:{serverNow:'2026-10-11T12:00:00.000Z',lots:scenario.startsWith('overflow')?[{flowerId:'first',flowerStatus:'available',projection:{stage:'curing',readyAt:'2026-10-11T16:00:00.000Z',nextChangeAt:'2026-10-11T12:30:00.000Z',capacity:{overflowUnits:1250,overflowDeadlineAt:'2026-10-11T12:30:00.000Z'}}},{flowerId:'second',flowerStatus:'available',projection:{stage:'curing',readyAt:'2026-10-11T16:00:00.000Z',nextChangeAt:'2026-10-11T14:00:00.000Z',capacity:{overflowUnits:2500,overflowDeadlineAt:'2026-10-11T14:00:00.000Z'}}}]:[]};
 if(path==='/api/arena/placard/collection')return {collection:{cards:[]}};
 if(path==='/api/account/collection')return {pages:[],summary:{totalCards:0,ownedUnique:0,totalOwnedCopies:0,duplicateCopies:0},availableClaims:[]};
 return null;
}
const previewFetch=preview?`const fixturePayload=${fixturePayload.toString()};const nativeFetch=window.fetch.bind(window);let failed=false;window.fetch=async(input,init={})=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);const scenario=new URLSearchParams(location.search).get('scenario')||'starter';const method=init.method||(input instanceof Request?input.method:'GET');if(method!=='GET')return new Response(JSON.stringify({error:'Prévisualisation locale : lecture seule'}),{status:405,headers:{'Content-Type':'application/json'}});if(scenario==='error'&&!failed&&url.pathname==='/api/arena/placard/equipment'){failed=true;return new Response(JSON.stringify({error:'Essai local'}),{status:503,headers:{'Content-Type':'application/json'}});}const body=fixturePayload(url.pathname,scenario);return new Response(JSON.stringify(body||{error:'API non simulée'}),{status:body?200:404,headers:{'Content-Type':'application/json'}});};`:'';
const stub=(name,body)=>`import React from 'react';export function ${name}(props){return <section data-destination="${name}" style={{padding:24}}><p data-simulated-destination>Destination simulée · vérification de navigation uniquement.</p>${body}</section>}`;
const destinations={
 './KqHarvests':stub('KqHarvests','<h1>Mes récoltes</h1><p data-harvest-section>{props.section}</p><p data-harvest-flower>{props.initialFlowerId}</p><button onClick={()=>props.onSectionChange("storage","fixture-flower")}>Stockage et affinage</button><button onClick={()=>props.onOpenWarehouse("fixture-flower")}>Augmenter la capacité</button><button onClick={()=>props.onOpenArena("fixture-flower")}>Présenter au jury</button><button onClick={()=>props.onOpenMarket("fixture-flower")}>Vendre cette récolte</button>'),
 './KanabQuestDicePrototype':stub('KanabQuestDicePrototype','<h1>{props.viewMode === "arena" ? "Jury & duels" : "La culture"}</h1>'),
 './KqWarehouseEntry':stub('KqWarehouseEntry','<h1>Entrepôt</h1><p data-equipment>{props.initialEquipmentCode}</p><p data-warehouse-section>{props.initialSection}</p><p data-warehouse-flower>{props.initialFlowerId}</p><p data-storage-configuration>{String(Boolean(props.initialStorageEquipmentOpen))}</p><p data-catalog>{props.initialShopOpen ? "Matériel" : "Plan"}</p><button onClick={()=>props.onOpenShop("LED-500")}>Acheter une lampe</button><button onClick={()=>props.onOpenMarket("fixture-flower")}>Préparer la vente</button>'),
 './KqMarketDesk':stub('KqMarketDesk','<h1>Ma boutique</h1><p data-market-section>{props.section}</p><p data-market-flower>{props.initialFlowerId}</p><p data-market-listing>{props.initialListingId}</p><button onClick={()=>props.onSectionChange("overview")}>Vue d’ensemble</button><button onClick={()=>props.onSectionChange("demands")}>Demandes clients</button><button onClick={()=>props.onSectionChange("sales")}>Vendre ma production</button><button onClick={()=>props.onSectionChange("dashboard")}>Mes ventes</button><button onClick={()=>props.onSectionChange("dashboard","fixture-listing")}>Voir l’annonce ciblée</button><button onClick={()=>props.onSectionChange("management")}>Développer ma boutique</button><button onClick={()=>props.onOpenShop("COMPUTER",props.initialFlowerId)}>Acheter un ordinateur</button>'),
 './KqTreasuryDesk':stub('KqTreasuryDesk','<h1>{props.initialPole === "bank" ? "La Banque" : "Le Bureau"}</h1><p data-treasury-pole>{props.initialPole}</p>'),
 './KqStaffDesk':stub('KqStaffDesk','<h1>Personnel</h1><button onClick={()=>props.onOpenTrim("fixture-employee")}>Trim dans l’Atelier</button>'),
 './KqSocialNetworks':stub('KqSocialNetworks','<h1>Réseaux sociaux</h1>'),
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
 const page=await browser.newPage(); page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=new URL(request.url());
  if(url.protocol==='data:')return void request.continue();
  if(url.origin!==origin)return void request.abort();
  if(!url.pathname.startsWith('/api/'))return void request.continue();
  requests.push({path:url.pathname,method:request.method()});
  if(request.method()!=='GET')return void request.respond({status:405,contentType:'application/json',body:'{"error":"Local audit is read-only"}'});
  const payload=fixturePayload(url.pathname,scenario);
  if(scenario==='error'&&!failed&&url.pathname==='/api/arena/placard/equipment') { failed=true; return void request.respond({status:503,contentType:'application/json',body:'{"error":"Essai local"}'}); }
  if(scenario==='overflow-equipment-error'&&url.pathname==='/api/arena/placard/equipment')return void request.respond({status:503,contentType:'application/json',body:'{"error":"Résumé indisponible"}'});
  void request.respond({status:payload?200:404,contentType:'application/json',body:JSON.stringify(payload??{error:'API non simulée'})});
 });
 const visit=async(state='starter',query='')=>{scenario=state;failed=false;await page.goto(`${origin}/arene/placard?scenario=${state}${query?'&'+query:''}`,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
 const view=async destination=>{await page.waitForSelector(`[data-placard-view="${destination}"]`);if(destination!=='hub')await page.waitForSelector('[data-destination]');};
 const visible=async selector=>page.waitForFunction(selector=>[...document.querySelectorAll(selector)].find(element=>element.checkVisibility()),{},selector);
 const mapPoint=async(id,kind='hit')=>page.evaluate(async({id,kind})=>{
  const viewport=document.querySelector('#placard-map-viewport');
  // Browser Back restores the map and its contextual panel on animation frames.
  // Let that layout settle before sending a real touch to image coordinates.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const button=document.querySelector(`[data-map-building="${id}"]`),image=viewport.querySelector('img');
  const values=button.getAttribute(`data-map-${kind}-point`)?.split(',').map(Number);
  if(!values||values.length!==2||values.some(value=>!Number.isFinite(value)))throw new Error(`Missing map ${kind} point for ${id}`);
  if(viewport.scrollWidth>viewport.clientWidth+1)viewport.scrollTo({left:image.offsetWidth*values[0]/100-viewport.clientWidth/2,top:image.offsetHeight*values[1]/100-viewport.clientHeight/2,behavior:'instant'});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  // Centre the settled map in the usable page space, between the sticky header
  // and the mobile navigation. The native scroll restoration may have moved it.
  const header=document.querySelector('#placard-content > header')?.getBoundingClientRect();
  const mobileNav=document.querySelector('nav[aria-label="Accès rapides de Kanab Quest"]')?.getBoundingClientRect();
  const top=header?.height??0,bottom=mobileNav?.height?mobileNav.top:innerHeight,frame=viewport.getBoundingClientRect();
  window.scrollBy({top:frame.top+frame.height/2-(top+bottom)/2,behavior:'instant'});
  const rect=image.getBoundingClientRect(),point={x:rect.left+rect.width*values[0]/100,y:rect.top+rect.height*values[1]/100};
  const hit=document.elementFromPoint(point.x,point.y);
  if(kind==='hit'&&hit?.closest('[data-map-building]')?.getAttribute('data-map-building')!==id)throw new Error(`Map facade ${id} is covered at ${JSON.stringify(point)} by ${hit?.tagName}: ${hit?.textContent?.slice(0,100)}`);
  return point;
 },{id,kind});
 const click=async selector=>{
  const building=selector.match(/^\[data-map-building="([a-z]+)"\]$/)?.[1];
  if(building){const point=await mapPoint(building);if((await page.viewport()).hasTouch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);return;}
  const handle=await visible(selector);await handle.asElement().evaluate(element=>element.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await handle.asElement().click();await handle.dispose();
 };
 const clickMapZoom=async()=>{
  const handle=await visible('[data-map-zoom-toggle]');
  try {
   // Full-page captures and touch panning can leave the tool row behind the
   // sticky shell header. Centre the real control and verify its hit target.
   await handle.asElement().evaluate(element=>element.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const point=await handle.asElement().evaluate(element=>{
    const rect=element.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const hit=document.elementFromPoint(x,y);
    if(!hit||!element.contains(hit))throw new Error(`Zoom control is covered by ${hit?.tagName??'the viewport edge'}: ${hit?.textContent?.slice(0,100)??''}`);
    return {x,y};
   });
   if((await page.viewport()).hasTouch)await page.touchscreen.tap(point.x,point.y);
   else await page.mouse.click(point.x,point.y);
  }finally{await handle.dispose();}
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
 if(motionOnly){
  const atmosphere='[data-map-atmosphere]', motionToggle='[data-map-motion-toggle]';
  const motionTargets='[data-water-glint], [data-gull-flight], [data-activity-glow], [data-doorway-intent]';
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const motionScreenshot=async(name,fromTop=true)=>{
   if(fromTop)await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   return page.screenshot({path:resolve(output,`${name}.png`),fullPage:false});
  };
  const waitForMotion=state=>page.waitForFunction(state=>document.querySelector('[data-map-atmosphere]')?.getAttribute('data-motion-state')===state,{timeout:15000,polling:100},state);
  const showScene=async()=>{await page.$eval('#placard-map-viewport',element=>element.scrollIntoView({block:'center',behavior:'instant'}));await waitForMotion('running');};
  const sampleMotion=()=>page.$$eval(motionTargets,elements=>elements.map(element=>{
   const style=getComputedStyle(element),rect=element.getBoundingClientRect(),frame=document.querySelector('#placard-map-viewport').getBoundingClientRect();
   return {target:element.hasAttribute('data-water-glint')?'water':element.hasAttribute('data-gull-flight')?'gull':element.getAttribute('data-activity-glow')??'doorway',transform:style.transform,opacity:style.opacity,visibility:style.visibility,display:style.display,visible:rect.width>0&&rect.height>0&&rect.bottom>Math.max(0,frame.top)&&rect.top<Math.min(innerHeight,frame.bottom)&&rect.right>Math.max(0,frame.left)&&rect.left<Math.min(innerWidth,frame.right)};
  }));
  const checkFrozen=async label=>{await pause(300);const before=await sampleMotion();await pause(300);const after=await sampleMotion();assert.deepEqual(after,before,label+' freezes the actual painted effects');return after;};
  const armNavigation=async()=>page.evaluate(()=>{
   window.__motionNavigation=null;
   document.addEventListener('click',()=>{const started=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__motionNavigation={elapsedMs:Math.round(performance.now()-started),view:document.querySelector('[data-placard-view]')?.getAttribute('data-placard-view'),panel:!!document.querySelector('#placard-building-details')};}));},{capture:true,once:true});
  });
  for(width of [320,390,1440]){
   await page.setViewport({width,height:width<=390?844:1000,isMobile:width<=390,hasTouch:width<=390,deviceScaleFactor:1});
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
   await visit('motion');await view('hub');await page.waitForSelector(atmosphere);await page.waitForSelector('[data-map-activity="jury"]');
   await showScene();await assertNoOverflow(`Motion ${width}`);
   const initial=await sampleMotion();await pause(700);const moving=await sampleMotion();
   assert(initial.length>0,'Motion exposes real scene elements');
   assert(moving.some((item,index)=>item.visible&&item.display!=='none'&&item.visibility==='visible'&&(item.transform!==initial[index].transform||item.opacity!==initial[index].opacity)),`${width}: visible artwork changes in normal motion`);
   const hitBehavior=await page.$eval(atmosphere,element=>({pointerEvents:getComputedStyle(element).pointerEvents,hidden:element.getAttribute('aria-hidden'),focusable:element.getAttribute('focusable')}));
   assert.equal(hitBehavior.pointerEvents,'none','Decorative motion cannot cover building interactions');assert.equal(hitBehavior.hidden,'true','Decorative motion does not repeat game state to assistive technology');
   await motionScreenshot(`motion-running-${width}`);
   const record={width,scenario:'motion',normal:{initial,moving},hitBehavior};results.push(record);
   let recorder;
   if(width===1440){
    try {const {default:ffmpegPath}=await import('ffmpeg-static');const path=resolve(output,'quartier-motion-demo.webm');recorder=await page.screencast({path,format:'webm',fps:24,ffmpegPath});record.video={path};}
    catch(error){record.video={unavailable:error.message};}
   }
   try {
    if(width===1440){const point=await mapPoint('warehouse');await page.mouse.move(point.x,point.y);await pause(650);}
    await armNavigation();await click('[data-map-building="warehouse"]');await page.waitForSelector('#placard-building-details');
    await page.waitForFunction(()=>window.__motionNavigation!==null);record.pointer=await page.evaluate(()=>window.__motionNavigation);
    assert.equal(record.pointer.panel,true,'The activity panel is available within two animation frames of the real pointer activation');
    await assertNoOverflow(`Motion panel ${width}`);await motionScreenshot(`motion-panel-${width}`,false);
    if(width===1440)await pause(650);
    await page.keyboard.press('Escape');await page.waitForSelector('#placard-building-details',{hidden:true});
    assert.equal(await page.$eval('[data-map-building="warehouse"]',element=>element===document.activeElement),true,'Escape returns focus to the selected building');
    await showScene();await click('summary[aria-label="Aide du quartier"]');await click(motionToggle);await page.keyboard.press('Escape');await waitForMotion('paused');record.paused=await checkFrozen('User pause');
    assert(await page.$eval(motionToggle,element=>element.getAttribute('aria-label')||element.textContent.trim()),'The motion control has a readable name');
    await motionScreenshot(`motion-paused-${width}`);
    await click('summary[aria-label="Aide du quartier"]');await click(motionToggle);await page.keyboard.press('Escape');await showScene();const beforeResume=await sampleMotion();await pause(500);const resumed=await sampleMotion();
    assert.notDeepEqual(resumed,beforeResume,'User resume restarts scene changes');record.resumed=true;
   }finally{
    if(recorder){try {await recorder.stop();record.video.bytes=(await stat(record.video.path)).size;assert(record.video.bytes>1024,'The interaction recording contains video frames');}catch(error){record.video={unavailable:error.message};}}
   }
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await waitForMotion('reduced');record.reduced=await checkFrozen('Live reduced-motion preference');
   await motionScreenshot(`motion-reduced-${width}`);
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);await showScene();record.livePreference=true;
   // A temporary, inert spacer allows an actual scroll outside the viewport even
   // when the desktop page is shorter than the browser. No observer is mocked.
   await page.evaluate(()=>{const spacer=document.createElement('div');spacer.dataset.motionAuditSpacer='';spacer.setAttribute('aria-hidden','true');spacer.style.height='200vh';document.body.append(spacer);window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});});
   await waitForMotion('offscreen');record.offscreen=await checkFrozen('Offscreen scene');
   await page.evaluate(()=>document.querySelector('[data-motion-audit-spacer]')?.remove());await showScene();
   if(width===1440){
    const other=await browser.newPage();
    try {await other.bringToFront();const hidden=await page.evaluate(()=>document.hidden);if(hidden){await waitForMotion('hidden');record.hidden=await checkFrozen('Hidden document');}else record.hidden={unavailable:'This headless browser does not hide background tabs'};}
    finally{await other.close();await page.bringToFront();}
    await showScene();
   }
   await page.focus('[data-map-building="market"]');await page.keyboard.press('Enter');await page.waitForSelector('#placard-building-details');
   await page.focus('[data-placard-activity="market"]');await armNavigation();await page.keyboard.press('Enter');await view('market');
   await page.waitForFunction(()=>window.__motionNavigation!==null);record.keyboard=await page.evaluate(()=>window.__motionNavigation);
   assert.equal(record.keyboard.view,'market','Keyboard navigation is available within two animation frames');
   assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','The animated map preserves the sale destination');
   await assertNoOverflow(`Motion destination ${width}`);
   await page.goBack();await view('hub');await showScene();
   await click('[data-map-building="office"]');await view('staff');await assertNoOverflow(`Personnel destination ${width}`);
   record.destinations=['market:sales','staff'];
  }
 }else if(clarityOnly){
  for(width of [320,390,1440]){
   await page.setViewport({width,height:844,isMobile:width<=390,hasTouch:width<=390,deviceScaleFactor:1});
   await visit('starter');await view('hub');
   await page.focus('[data-map-building="market"]');await page.keyboard.press('Enter');
   await page.waitForSelector('#placard-building-details');
   await click('[data-placard-activity="market"]');await view('market');
   assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','The map action opens Vendre directly');
   await navTo('market');
   assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'overview','Generic Commerce still opens Synthèse');
   for(const section of ['overview','storage']){
    await visit('starter',`view=harvests&flower=fixture-flower${section==='storage'?'&section=storage':''}`);await view('harvests');
    await clickText('Présenter au jury');await view('arena');
    assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
    await click('button[data-placard-back="harvests"]');await view('harvests');
    assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),section,'Jury returns to the original harvest sub-section');
    assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower');
   }
   await visit('starter','view=arena&flower=fixture-flower&from=workshop&fromSection=storage&fromFlower=fixture-flower');await view('arena');
   await click('button[data-placard-back="workshop"]');await view('workshop');
   assert.equal(new URL(page.url()).searchParams.get('section'),'storage');
   assert.equal(await page.$eval('[data-warehouse-flower]',element=>element.textContent),'fixture-flower');
   assert.equal(await page.$eval('[data-storage-configuration]',element=>element.textContent),'false','Returning from the jury does not open storage configuration');
   await visit('starter','view=harvests&section=storage&flower=fixture-flower');await view('harvests');
   await clickText('Augmenter la capacité');await view('workshop');
   assert.equal(new URL(page.url()).searchParams.get('configure'),'storage');
   assert.equal(await page.$eval('[data-storage-configuration]',element=>element.textContent),'true','The capacity action explicitly requests storage configuration');
   await click('button[data-placard-back="harvests"]');await view('harvests');
   assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower');
   assert.equal(new URL(page.url()).searchParams.has('configure'),false,'The equipment request is scoped to its warehouse entry');
   await assertNoOverflow('Navigation destinations');
   results.push({width,scenario:'clarity-navigation',mapSale:true,genericSummary:true,juryReturns:['overview','storage','workshop'],selectedLot:true});
  }
 }else{
 for(width of (process.env.NAVIGATION_AUDIT_WIDTHS?.split(',').map(Number)??[320,390,768,1440])) {
  await page.setViewport({width,height:width<=390?844:1000,isMobile:width<=390,hasTouch:width<=390,deviceScaleFactor:1});
  await visit('active');await view('hub');
  await page.waitForSelector('[data-placard-next-action]');
  const initialMeasurement=await measureMap();
  await screenshot(`quartier-${width}`);
  assert.equal(await page.$eval('[data-placard-map]',element=>element.hasAttribute('data-map-zoomed')),width<=700,'Mobile starts with readable buildings; larger screens show the whole village');
  if(width<=700){
   assert(initialMeasurement.viewport.height>=240&&initialMeasurement.viewport.height<=360,'Mobile exploration leaves room for the next action below the scene');
   assert(await page.$eval('[data-map-zoom-toggle] span',element=>getComputedStyle(element).display!=='none'&&element.textContent==='Tout le quartier'),'The complete map toggle stays readable on mobile');
   await clickMapZoom();await page.waitForSelector('[data-placard-map]:not([data-map-zoomed])');
  }
  const measurement=await measureMap();
  results.push({width,initialMeasurement,measurement});
  await screenshot(`quartier-overview-${width}`);
  assert.equal(measurement.overflow,false);assert.equal(measurement.imageLoaded,true);assert.equal(measurement.source,MAP_ASSET);assert.deepEqual(measurement.brokenImages,[]);
  assert.deepEqual(measurement.buildings.map(building=>building.id).sort(),[...BUILDING_IDS].sort(),'Every illustrated destination has one real hit target');
  assert(measurement.viewport.scrollWidth<=measurement.viewport.clientWidth+1,'The overview shows the complete image');
  for(const [index,building] of measurement.buildings.entries()){
   assert(building.labelBounds?.width>=44&&building.labelBounds?.height>=44,`${width}: ${building.id} has a visible 44px label alternative to its irregular silhouette`);
   assert(building.labelBounds.left>=measurement.viewport.left-1&&building.labelBounds.right<=measurement.viewport.right+1&&building.labelBounds.top>=measurement.viewport.top-1&&building.labelBounds.bottom<=measurement.viewport.bottom+1,`${width}: ${building.id} label is fully visible in the overview`);
   assert(building.clipPath?.startsWith('polygon('),`${width}: ${building.id} uses a real polygon hit mask`);
   assert(building.tabIndex>=0,`${width}: ${building.id} has keyboard access`);
   assert(/[a-zÀ-ÿ]/i.test(building.label),`${building.id} keeps its complete accessible name in overview`);
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
  await clickMapZoom();await page.waitForSelector('[data-map-zoomed]');
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
  await screenshot(`quartier-zoom-${width}`);await clickMapZoom();await page.waitForSelector('[data-map-zoomed]',{hidden:true});
  await click('[data-map-building="bank"]');await view('treasury');assert.equal(new URL(page.url()).searchParams.get('pole'),'accounting');
  await page.goBack();await view('hub');await click('[data-map-building="office"]');await view('staff');
  await clickText('Trim dans l’Atelier');await view('workshop');assert.equal(await page.$eval('[data-warehouse-section]',element=>element.textContent),'processing');assert.equal(new URL(page.url()).searchParams.get('employee'),'fixture-employee');
  await navTo('hub');await click('[data-map-building="warehouse"]');await click('[data-placard-activity="workshop"]');await view('workshop');assert.equal(await page.$eval('[data-warehouse-section]',element=>element.textContent),'processing','The farm opens the real Atelier');
  await page.goBack();await view('hub');await click('[data-map-building="market"]');await click('[data-placard-activity="social"]');await view('social');
  await page.goBack();await view('hub');await click('[data-map-building="collection"]');await page.waitForSelector(album+'[open]');await page.keyboard.press('Escape');await page.waitForSelector(album+'[open]',{hidden:true});
  await page.waitForFunction(()=>document.activeElement?.matches('[data-map-building="collection"]'));
  for(const destination of ['shop','arena','missions']){
   await click(`[data-map-building="${destination}"]`);await view(destination);
   assert.equal(new URL(page.url()).searchParams.get('view'),destination,`${width}: ${destination} facade opens its destination`);
   await page.goBack();await view('hub');
  }
  await page.focus('[data-map-building="market"]');await page.keyboard.press('Space');await page.waitForSelector('#placard-building-details');
  await click('[data-placard-activity="market"]');await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','Transformer et vendre opens the sale directly');
  await page.goBack();await view('hub');
  await navTo('collection');await page.waitForSelector(album+'[open]');await page.keyboard.press('Escape');await page.waitForSelector(album+'[open]',{hidden:true});
  await navTo('harvests');await clickText('Présenter au jury');await view('arena');assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
  await page.goBack();await view('harvests');await clickText('Vendre cette récolte');await view('market');assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales','A harvest shortcut still opens its sale');
  await click('button[data-placard-back="harvests"]');await view('harvests');
  assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower','Returning from the sale retains the harvest');
  await clickText('Stockage et affinage');await clickText('Augmenter la capacité');await view('workshop');
  assert.equal(await page.$eval('[data-warehouse-flower]',element=>element.textContent),'fixture-flower','Capacity opens for the selected harvest');
  assert.equal(await page.$eval('aside [data-placard-nav="workshop"]',element=>element.getAttribute('aria-current')),'page','Storage equipment belongs to the warehouse');
  await click('button[data-placard-back="harvests"]');await view('harvests');
  assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),'storage','Capacity returns to conservation');
  assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower');
  await clickText('Présenter au jury');await view('arena');
  assert.equal(new URL(page.url()).searchParams.get('fromSection'),'storage','The jury remembers the storage sub-section');
  await click('button[data-placard-back="harvests"]');await view('harvests');
  assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),'storage','Returning from the jury restores conservation');
  assert.equal(await page.$eval('[data-harvest-flower]',element=>element.textContent),'fixture-flower','Returning from the jury restores the selected harvest');
  await clickText('Vendre cette récolte');await view('market');
  await clickText('Vue d’ensemble');await page.waitForFunction(()=>document.querySelector('[data-market-section]').textContent==='overview');
  assert.equal(new URL(page.url()).searchParams.get('flower'),'fixture-flower','Summary preserves the selected lot without forcing sales');
  await clickText('Vendre ma production');await clickText('Acheter un ordinateur');await view('workshop');
  assert.equal(await page.$eval('[data-warehouse-flower]',element=>element.textContent),'fixture-flower','The equipment catalog keeps the sale lot for its commercial shortcut');
  await click('button[data-placard-back="market"]');await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'sales');
  assert.equal(await page.$eval('[data-market-flower]',element=>element.textContent),'fixture-flower','Equipment returns to the same commercial lot');
  await clickText('Voir l’annonce ciblée');await page.waitForFunction(()=>document.querySelector('[data-market-listing]').textContent==='fixture-listing');
  await page.reload({waitUntil:'networkidle0'});await view('market');
  assert.equal(await page.$eval('[data-market-listing]',element=>element.textContent),'fixture-listing','Listing deep link survives reload');
  await clickText('Acheter un ordinateur');await view('workshop');await click('button[data-placard-back="market"]');await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'dashboard');
  assert.equal(await page.$eval('[data-market-listing]',element=>element.textContent),'fixture-listing','Equipment returns to the same listing');
  if(width<=1000)assert.deepEqual(await page.$$eval('nav[aria-label="Accès rapides de Kanab Quest"] button',elements=>elements.map(element=>element.textContent.trim())),['Quartier','Culture','Récoltes','Commerce','Plus']);
  await navTo('market');await assertNoOverflow('Commerce');await screenshot(`commerce-navigation-${width}`);
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'overview','The market navigation opens the shop overview');
  await navTo('workshop');await clickText('Acheter une lampe');await view('workshop');await page.waitForFunction(()=>document.querySelector('[data-catalog]')?.textContent==='Matériel');assert.equal(new URL(page.url()).searchParams.get('equipment'),'LED-500');
  results.at(-1).navigation='passed';
 }
 width=390;await page.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 for(const state of ['starter','lots','jury','investment']){
  await visit(state);await view('hub');await page.waitForSelector('[data-placard-next-action]');await screenshot(`${state}-390`);
  const expected={starter:'game',lots:'market',jury:'arena',investment:'game'}[state];
  await click('[data-placard-next-action] button');await view(expected);
  if(state==='lots')assert.equal(new URL(page.url()).searchParams.get('section'),'sales','Ready lots open the sale directly');
  if(state==='investment')assert.equal(new URL(page.url()).searchParams.has('catalog'),false,'Available cash alone does not send a new player to buy equipment');
  results.push({scenario:state,destination:expected});
 }
 for(const state of ['overflow','overflow-equipment-error']){
  await visit(state);await view('hub');await page.waitForSelector('[data-priority="storage"]');
  const notice=await page.$eval('[data-priority="storage"]',element=>element.textContent);
  assert(notice.includes('375 g sans contenant'),'The priority uses the sum of the server surplus');assert(notice.includes('14:30'),'The earliest server deadline is shown in Paris time');
  assert(notice.includes('Ranger mes récoltes'));assert.equal(await page.$$eval('[data-placard-next-action]',elements=>elements.length),1,'Urgency replaces the ordinary recommendation');
  await assertNoOverflow('Storage urgency');await screenshot(`${state}-390`);await click('[data-priority="storage"] button');await view('harvests');
  assert.equal(new URL(page.url()).searchParams.get('section'),'storage');assert.equal(await page.$eval('[data-harvest-section]',element=>element.textContent),'storage');results.push({scenario:state,destination:'harvests',section:'storage'});
 }
 await visit('storage-error');await view('hub');await page.waitForSelector('[data-placard-next-action]');assert.equal(await page.$('[data-priority="storage"]'),null);await screenshot('storage-error-390');await click('[data-placard-next-action] button');await view('game');results.push({scenario:'storage-error',destination:'game'});
 await visit('error');await page.waitForFunction(()=>document.body.textContent.includes('Ton résumé est indisponible'));await assertNoOverflow('Error');await clickText('Réessayer');await page.waitForSelector('[data-placard-next-action]');
 await visit('starter','view=treasury&pole=management');await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'management');
 await visit('starter','view=market&section=dashboard');await view('market');await clickText('Acheter un ordinateur');await view('workshop');assert.equal(await page.$eval('[data-equipment]',element=>element.textContent),'COMPUTER');await page.goBack();await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'dashboard');
 width=1440;await page.setViewport({width,height:1000,isMobile:false,hasTouch:false,deviceScaleFactor:1});
 await visit('starter','view=market&section=dashboard');await view('market');await navTo('shop');
 assert.equal(new URL(page.url()).searchParams.get('from'),'market');assert.equal(new URL(page.url()).searchParams.get('fromSection'),'dashboard','The sidebar shop preserves the current Commerce sub-section');
 assert.equal(await page.$eval('[data-catalog]',element=>element.textContent),'Packs','The sidebar enters the general shop');
 await clickText('Quitter la boutique');await view('market');assert.equal(new URL(page.url()).searchParams.get('section'),'dashboard');assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),'dashboard');
 results.push({scenario:'sidebar-shop-return',destination:'market',section:'dashboard'});
 for(const [query,expected] of [['view=market','overview'],['view=market&section=overview','overview'],['view=market&section=sales','sales'],['view=market&section=demands','demands'],['view=market&section=demands&flower=fixture-flower','demands'],['view=market&flower=fixture-flower','sales']]) {
  await visit('starter',query);await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),expected);
  await clickText('Acheter un ordinateur');await view('workshop');assert.equal(await page.$eval('[data-catalog]',element=>element.textContent),'Matériel');await page.goBack();await view('market');
  assert.equal(await page.$eval('[data-market-section]',element=>element.textContent),expected,'Browser Back from equipment retains the chosen market section');
  results.push({scenario:'market-entry-and-return',query,section:expected});
 }
 await visit('starter','view=market');await view('market');await clickText('Vendre ma production');
 await page.waitForFunction(()=>new URLSearchParams(location.search).get('section')==='sales');
 await clickText('Demandes clients');await page.waitForFunction(()=>document.querySelector('[data-market-section]')?.textContent==='demands');
 assert.equal(new URL(page.url()).searchParams.get('section'),'demands','Client requests retain their explicit deep link');
 await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-market-section]')?.textContent==='sales');
 results.push({scenario:'market-back-navigation',section:'sales'});
 await visit('starter','view=workshop&section=storage');await view('workshop');assert.equal(await page.$eval('[data-placard-view]',element=>element.dataset.placardView),'workshop');
 await visit('starter','view=arena&flower=fixture-flower&from=workshop&fromSection=storage&fromFlower=fixture-flower');await view('arena');
 await click('button[data-placard-back="workshop"]');await view('workshop');
 assert.equal(new URL(page.url()).searchParams.get('section'),'storage','The jury returns to the warehouse storage when opened there');
 assert.equal(await page.$eval('[data-warehouse-flower]',element=>element.textContent),'fixture-flower','The warehouse return restores the jury lot');
 results.push({scenario:'jury-warehouse-return',section:'storage',flower:'fixture-flower'});
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
 }
 assert.deepEqual(errors,[]);assert(requests.every(request=>request.method==='GET'),'Audit never mutates real state');
 await writeFile(resolve(output,motionOnly?'motion-report.json':clarityOnly?'clarity-report.json':'report.json'),JSON.stringify({results,errors,requests},null,2));
 console.log(JSON.stringify({success:true,output,widths:results.filter(result=>result.width).map(result=>result.width),scenarios:results.filter(result=>result.scenario).length,errors:errors.length},null,2));
}catch(error){
 if(browser){const pages=await browser.pages();await pages.at(-1)?.screenshot({path:resolve(output,motionOnly?'motion-failure.png':'failure.png'),fullPage:true}).catch(()=>{});}
 await writeFile(resolve(output,motionOnly?'motion-report.json':'report.json'),JSON.stringify({results,errors,requests,failure:error.stack},null,2));throw error;
}finally{if(!preview){await browser?.close();await server.close();}}
