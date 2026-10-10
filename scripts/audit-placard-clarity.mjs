/** Local UI audit. Real lobby, shell, collection and progression; destination stubs isolate navigation. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/placard-clarity'), port=3224, origin=`http://127.0.0.1:${port}`, preview=process.argv.includes('--preview'), collectionOnly=process.argv.includes('--collection-only');
function fixturePayload(path,scenario){
 if(path==='/api/arena/placard/equipment')return {tentNumber:1,tents:[{tentNumber:1,equippedCodes:[],levels:{}}],productionUnits:scenario==='active'?4:1,ownedCodes:[],purchasedCodes:[],equippedCodes:[],cashCents:0,levels:{},reputation:0,activeRun:scenario==='active',readyLotCount:scenario==='lots'?2:0,availableFlowerCount:scenario==='jury'?1:0,routeMasteries:[],routePlan:null};
 if(path==='/api/arena/placard/collection')return {collection:{cards:[]}};
 return null;
}
const previewFetch=preview?`const fixturePayload=${fixturePayload.toString()};const nativeFetch=window.fetch.bind(window);let failed=false;window.fetch=async(input,init={})=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);const scenario=new URLSearchParams(location.search).get('scenario')||'starter';const method=init.method||(input instanceof Request?input.method:'GET');if(method!=='GET')return new Response(JSON.stringify({error:'Prévisualisation locale : lecture seule'}),{status:405,headers:{'Content-Type':'application/json'}});if(scenario==='error'&&!failed&&url.pathname==='/api/arena/placard/equipment'){failed=true;return new Response(JSON.stringify({error:'Essai local'}),{status:503,headers:{'Content-Type':'application/json'}});}const body=fixturePayload(url.pathname,scenario);return new Response(JSON.stringify(body||{error:'API non simulée'}),{status:body?200:404,headers:{'Content-Type':'application/json'}});};`:'';
const stub=(name,body)=>`import React from 'react';export function ${name}(props){return <section data-destination="${name}" style={{padding:24}}><p data-simulated-destination>Destination simulée · vérification de navigation uniquement.</p>${body}</section>}`;
const destinations={
 './KanabQuestDicePrototype':stub('KanabQuestDicePrototype','<h1>{props.viewMode === "arena" ? "Jury & duels" : "La culture"}</h1>'),
 './KqWarehouseEntry':stub('KqWarehouseEntry','<h1>Entrepôt</h1><p data-equipment>{props.initialEquipmentCode}</p><button onClick={()=>props.onOpenShop("LED-500")}>Acheter une lampe</button>'),
 './KqMarketDesk':stub('KqMarketDesk','<h1>Marché</h1>'),
 './KqTreasuryDesk':stub('KqTreasuryDesk','<h1>{props.initialPole === "bank" ? "La Banque" : "Le Bureau"}</h1><p data-treasury-pole>{props.initialPole}</p><button onClick={props.onOpenMarket}>Aller au Marché</button>'),
 './KqSupportBoosterShop':stub('KqSupportBoosterShop','<h1>La Boutique</h1><p data-catalog>{props.autoOpenEquipment ? "Matériel" : "Packs"}</p><p data-equipment>{props.initialEquipmentCode}</p><button onClick={()=>props.onOpenWorkshop(props.initialEquipmentCode)}>Installer</button><button onClick={props.onExit}>Quitter la boutique</button><button onClick={props.onOpenCollection}>Ma collection</button>'),
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
let browser,scenario='starter',failed=false;
const errors=[],requests=[],results=[],touchResults=[],compactResults=[],collectionResults=[];
if(preview){
 await mkdir(output,{recursive:true});await server.listen();
 console.log(`Prévisualisation locale du menu · données de démonstration et destinations simulées : ${origin}/arene/placard?scenario=starter`);
}else try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>{errors.push(e.message);});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);
 page.on('request',r=>{
  const url=new URL(r.url());if(url.protocol==='data:')return void r.continue();
  if(url.origin!==origin)return void r.abort();if(!url.pathname.startsWith('/api/'))return void r.continue();
  requests.push({path:url.pathname,method:r.method()});
  const send=(body,status=200)=>void r.respond({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/arena/placard/equipment'){
   if(scenario==='error'&&!failed){failed=true;return send({error:'Essai local'},503);}
   return send(fixturePayload(url.pathname,scenario));
  }
  if(url.pathname==='/api/arena/placard/collection')return send(fixturePayload(url.pathname,scenario));
  return send({error:'Unexpected local API'},404);
 });
 const visit=async(state='starter',query='')=>{scenario=state;failed=false;await page.goto(origin+'/arene/placard?scenario='+state+(query?'&'+query:''),{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);};
 const view=async value=>{await page.waitForSelector(`[data-placard-view="${value}"]`);if(value!=="hub")await page.waitForSelector(`[data-placard-view="${value}"] [data-destination]`);};
 const clickText=async text=>{const button=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text&&el.checkVisibility()),{},text);await button.asElement().click();await button.dispose();};
 const buildings=['warehouse','bank','office','market','shop','arena','missions','collection'];
 const collectionPin='[data-map-building="collection"]',collectionAction='[data-placard-activity="collection"]',album='dialog[aria-labelledby="botte-collection-title"]';
 const destinationsToAudit=[
  {building:'warehouse',activity:'game',view:'game'},
  {building:'warehouse',activity:'workshop',view:'workshop'},
  {building:'bank',activity:'bank',view:'treasury',pole:'bank'},
  {building:'office',activity:'treasury',view:'treasury',pole:'accounting'},
  {building:'office',activity:'management',view:'treasury',pole:'management'},
  ...['market','shop','arena','missions'].map(id=>({building:id,activity:id,view:id})),
 ];
 const selectBuilding=async id=>{
  await page.locator(`[data-map-building="${id}"]`).click();
  await page.waitForSelector(`[data-map-building="${id}"][aria-pressed="true"]`);
  assert.equal(await page.$$eval('[data-map-building][aria-pressed="true"]',els=>els.length),1);
 };
 const enterActivity=async target=>{
  await selectBuilding(target.building);
  await page.locator(`[data-placard-activity="${target.activity}"]`).click();
  await view(target.view);
  const params=new URL(page.url()).searchParams;
  assert.equal(params.get('view'),target.view);
  assert.equal(params.get('pole'),target.pole??null);
  if(target.pole)assert.equal(await page.$eval('[data-treasury-pole]',el=>el.textContent),target.pole);
 };
 const tap=async selector=>{
  await page.$eval(selector,element=>element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  const point=await page.$eval(selector,element=>{const bounds=element.getBoundingClientRect();return {x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};});
  await page.touchscreen.tap(point.x,point.y);
 };
 const measure=()=>page.evaluate(()=>{
  const color=value=>{const channels=value.match(/[\d.]+/g)?.map(Number)||[0,0,0];return [...channels.slice(0,3),channels[3]??1];};
  const blend=(foreground,background)=>foreground.slice(0,3).map((value,index)=>value*foreground[3]+background[index]*(1-foreground[3]));
  const backgroundOf=element=>{const ancestors=[];for(let current=element;current;current=current.parentElement)ancestors.push(current);return ancestors.reverse().reduce((background,current)=>blend(color(getComputedStyle(current).backgroundColor),background),[255,255,255]);};
  const luminance=channels=>channels.map(value=>{const channel=value/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  const contrast=(foreground,background)=>{const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);};
  const elementContrast=element=>{const background=backgroundOf(element);return contrast(blend(color(getComputedStyle(element).color),background),background);};
  const primary=[...document.querySelectorAll('[data-placard-activity]')].map(element=>{
   const textContrasts=[];const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;
   while((node=walker.nextNode()))if(node.textContent.trim())textContrasts.push({text:node.textContent.trim(),contrast:elementContrast(node.parentElement)});
   const bounds=element.getBoundingClientRect();
   return {id:element.dataset.placardActivity,text:element.innerText,background:getComputedStyle(element).backgroundColor,accent:getComputedStyle(element).borderLeftColor,width:bounds.width,top:bounds.top,bottom:bounds.bottom,textContrasts,iconContrasts:[...element.querySelectorAll('svg')].map(elementContrast)};
  });
  const map=document.querySelector('[data-placard-map]'),mapImage=map.querySelector('img'),mapViewport=mapImage.parentElement.parentElement,details=document.querySelector('#placard-building-details');
  const buildings=[...map.querySelectorAll('[data-map-building]')].map(element=>{const bounds=element.getBoundingClientRect();return {id:element.dataset.mapBuilding,text:element.innerText,pressed:element.getAttribute('aria-pressed'),controls:element.getAttribute('aria-controls'),label:element.getAttribute('aria-label'),bounds:{left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom,width:bounds.width,height:bounds.height}};});
  const viewportBounds=mapViewport.getBoundingClientRect(),zoomToggle=map.querySelector('[data-map-zoom-toggle]');
  return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,buildings,primary,mapImageLoaded:mapImage.complete&&mapImage.naturalWidth>0,mapImageSource:mapImage.getAttribute('src'),mapImageWidth:mapImage.getBoundingClientRect().width,mapZoomed:map.getAttribute('data-map-zoomed')==='true',zoomTogglePressed:zoomToggle?.getAttribute('aria-pressed')??null,mapViewport:{width:mapViewport.clientWidth,scrollWidth:mapViewport.scrollWidth,scrollLeft:mapViewport.scrollLeft,left:viewportBounds.left,right:viewportBounds.right,overflowX:getComputedStyle(mapViewport).overflowX},detailsBelowMap:details.getBoundingClientRect().top>=viewportBounds.bottom,brokenImages:[...document.images].filter(el=>el.complete&&!el.naturalWidth).map(el=>el.src)};
 });
 const assertBuildingTargets=measurement=>{
  for(const [index,building] of measurement.buildings.entries()){
   assert(building.bounds.width>=44&&building.bounds.height>=44,`${building.id} has a minimum 44px touch target`);
   for(const other of measurement.buildings.slice(index+1)){
    const overlapX=Math.min(building.bounds.right,other.bounds.right)-Math.max(building.bounds.left,other.bounds.left);
    const overlapY=Math.min(building.bounds.bottom,other.bounds.bottom)-Math.max(building.bounds.top,other.bounds.top);
    assert(overlapX<=.5||overlapY<=.5,`${building.id} and ${other.id} have distinct hit areas`);
   }
  }
 };
 const assertMobileOverview=measurement=>{
  assert.equal(measurement.overflow,false);
  assert.equal(measurement.mapZoomed,false);
  assert.equal(measurement.zoomTogglePressed,'false');
  assert(measurement.mapViewport.scrollWidth<=measurement.mapViewport.width+1,'The complete mobile map fits its viewport by default');
  assert(Math.abs(measurement.mapImageWidth-measurement.mapViewport.width)<=1,'The map image is not cropped horizontally');
  assert(measurement.mapViewport.scrollLeft<=1,'The overview returns to the start of the map');
  assert.equal(measurement.detailsBelowMap,true,'Mobile activity controls follow the map');
  for(const [index,building] of measurement.buildings.entries()){
   assert(building.bounds.left>=measurement.mapViewport.left-.5&&building.bounds.right<=measurement.mapViewport.right+.5,`${building.id} is visible in the overview`);
   assert(building.text.includes(String(index+1).padStart(2,'0')),`${building.id} has a visible numbered pin`);
  }
 };
 const closeCollection=async origin=>{
  await page.keyboard.press('Escape');await page.waitForSelector(album,{hidden:true});
  await page.waitForFunction(selector=>document.activeElement?.matches(selector),{},origin);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 };
 const auditCollectionMap=async width=>{
  await visit();await view('hub');
  const m=await measure();assert.equal(m.overflow,false);assert.equal(m.mapImageLoaded,true);assert.equal(m.mapImageSource,'/placard/map/placard-world-v2.webp');assert.deepEqual(m.brokenImages,[]);
  assert.deepEqual(m.buildings.map(building=>building.id),buildings);assertBuildingTargets(m);if(width<=700)assertMobileOverview(m);
  assert.equal(await page.$$eval('[data-arena-tour="collection"]',els=>els.length),1);
  assert.equal(await page.$eval(collectionPin,el=>el.getAttribute('data-arena-tour')),'collection');
  assert.equal(await page.$eval(collectionPin,el=>el.getAttribute('aria-haspopup')),'dialog');
  assert.equal(await page.$('[data-placard-lobby] footer [data-arena-tour="collection"]'),null);
  await page.screenshot({path:resolve(output,`collection-map-${width}.png`),fullPage:true});
  for(const key of ['Enter','Space']){
   await page.focus(collectionPin);await page.keyboard.press(key);await page.waitForSelector(album+'[open]');
   assert.equal(await page.$eval(collectionPin,el=>el.getAttribute('aria-pressed')),'true');
   await closeCollection(collectionPin);
  }
  await page.screenshot({path:resolve(output,`collection-map-selected-${width}.png`),fullPage:true});
  await page.select('[aria-label="Choisir un bâtiment"]','warehouse');
  await page.select('[aria-label="Choisir un bâtiment"]','collection');await page.waitForSelector(collectionPin+'[aria-pressed="true"]');
  assert.equal(await page.$(album+'[open]'),null,'Selecting the collection in the list only reveals its activity');
  assert((await page.$eval(collectionAction,el=>el.textContent)).includes('Ma collection Botte du Chanvrier'));
  await page.locator(collectionAction).click();await page.waitForSelector(album+'[open]');await closeCollection(collectionAction);
  if(width<=700)await tap(collectionPin);else await page.locator(collectionPin).click();
  await page.waitForSelector(album+'[open]');assert.equal(await page.$eval(album,el=>el.scrollWidth>el.clientWidth+1),false);
  await page.screenshot({path:resolve(output,`collection-${width}.png`),fullPage:true});
  await page.locator(album+' footer button').click();await view('shop');assert.equal(await page.$eval('[data-catalog]',el=>el.textContent),'Packs');assert.equal(await page.$(album+'[open]'),null);
  await clickText('Ma collection');await page.waitForSelector(album+'[open]');await page.keyboard.press('Escape');await page.waitForSelector(album,{hidden:true});await view('shop');
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Ma collection');
  await clickText('Quitter la boutique');await view('hub');
  await enterActivity({building:'office',activity:'treasury',view:'treasury',pole:'accounting'});
  const shellCollection='button[aria-label="Ouvrir ma collection Botte du Chanvrier"]';
  await page.locator(shellCollection).click();await page.waitForSelector(album+'[open]');await closeCollection(shellCollection);await view('treasury');
  await visit();await view('hub');
  collectionResults.push({width,eightPlaces:true,imageLoaded:true,distinctHitAreas:true,minimumTarget:44,uniqueTourAnchor:true,keyboardEnterAndSpace:true,pinFocusRestored:true,dropdownDoesNotOpen:true,panelFocusRestored:true,touchPin:width<=700,collectionToShop:true,shopCollectionPreserved:true,subviewCollectionPreserved:true,noOverflow:true});
 };
 const auditTouchMap=async(width,height)=>{
  await page.setViewport({width,height,isMobile:true,hasTouch:true});await visit('active');await view('hub');
  let m=await measure();assertMobileOverview(m);assertBuildingTargets(m);
  await tap('[data-map-building="bank"]');await page.waitForSelector('[data-map-building="bank"][aria-pressed="true"]');
  assert.equal(await page.$eval('[aria-label="Choisir un bâtiment"]',el=>el.value),'bank');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:resolve(output,`touch-overview-${width}x${height}.png`),fullPage:true});
  await tap('[data-map-zoom-toggle]');await page.waitForSelector('[data-map-zoom-toggle][aria-pressed="true"]');
  m=await measure();assert.equal(m.mapZoomed,true);assert.equal(m.overflow,false);assert(m.mapViewport.scrollWidth>m.mapViewport.width,'Zoom enables native map panning');assert.equal(m.mapViewport.overflowX,'auto');assertBuildingTargets(m);
  const swipe=await page.evaluate(()=>{
   const viewport=document.querySelector('[data-placard-map] img').parentElement.parentElement;
   viewport.scrollIntoView({block:'center',behavior:'instant'});viewport.scrollLeft=0;
   const bounds=viewport.getBoundingClientRect();return {startX:bounds.right-30,endX:bounds.left+30,y:Math.min(innerHeight-30,Math.max(30,bounds.top+100))};
  });
  const touch=await page.touchscreen.touchStart(swipe.startX,swipe.y);
  for(let step=1;step<=8;step++){await touch.move(swipe.startX+(swipe.endX-swipe.startX)*step/8,swipe.y);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));}
  await touch.end();
  await page.waitForFunction(()=>document.querySelector('[data-placard-map] img').parentElement.parentElement.scrollLeft>10);
  assert.equal((await measure()).overflow,false);
  await page.screenshot({path:resolve(output,`touch-zoom-${width}x${height}.png`),fullPage:true});
  await tap('[data-map-zoom-toggle]');await page.waitForSelector('[data-map-zoom-toggle][aria-pressed="false"]');
  m=await measure();assertMobileOverview(m);assertBuildingTargets(m);assert.equal(m.buildings.find(building=>building.pressed==='true').id,'bank');
  await tap('[data-placard-activity="bank"]');await view('treasury');assert.equal(await page.$eval('[data-treasury-pole]',el=>el.textContent),'bank');
  touchResults.push({width,height,overviewFits:true,numberedPins:true,touchBuildingSelection:true,touchZoom:true,touchPan:true,touchUnzoom:true,touchNavigation:true});
 };
 if(collectionOnly){
  for(const width of [320,390,1440]){
   await page.setViewport({width,height:width<=700?844:1000,isMobile:width<=700,hasTouch:width<=700});
   await auditCollectionMap(width);
  }
  assert(requests.every(r=>r.method==='GET'));assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'collection-map-report.json'),JSON.stringify({passed:true,scope:'Collection map integration: real map, shell and album, destination stubs',collectionResults,readOnly:true,requests,errors},null,2));
  console.log(JSON.stringify({passed:true,collectionViewports:collectionResults.length,errors,output}));
 }else{
 for(const width of [320,390,430,768,1440]){
  await page.setViewport({width,height:width<=700?844:1000,isMobile:width<=700,hasTouch:width<=700});
  for(const state of ['starter','active','jury','lots']){
   await visit(state);await view('hub');await page.mouse.move(0,0);
   assert.equal(await page.$$eval('dialog[open]',els=>els.length),0);
   assert.deepEqual(await page.$$eval('[data-placard-activity]',els=>els.map(el=>el.dataset.placardActivity)),['game','workshop']);
   if(state==='active'){
    assert((await page.$eval('[data-placard-activity="game"]',el=>el.textContent)).includes('Reprendre ma culture'));
    assert((await page.$eval('[aria-label="Résumé de ton Placard"]',el=>el.textContent)).includes('4 tentes'));
   }
   if(state==='lots'){await selectBuilding('market');assert((await page.$eval('#placard-building-details',el=>el.textContent)).includes('2 lots prêts'));}
   if(state==='jury'){await selectBuilding('arena');assert((await page.$eval('#placard-building-details',el=>el.textContent)).includes('1 Fleur disponible'));}
   const m=await measure();assert.equal(m.overflow,false);assert.deepEqual(m.brokenImages,[]);assert.equal(m.mapImageLoaded,true);assert.deepEqual(m.buildings.map(x=>x.id),buildings);
   assert.equal(m.buildings.filter(x=>x.pressed==='true').length,1);
   assert(m.buildings.every(x=>['true','false'].includes(x.pressed)&&x.controls==='placard-building-details'&&x.label));
   assertBuildingTargets(m);
   if(width<=700)assertMobileOverview(m);
   for(const action of m.primary){
    assert(action.textContrasts.length>0,`${action.id} has readable destination text`);
    for(const label of action.textContrasts)assert(label.contrast>=4.5,`${action.id}: "${label.text}" has contrast ${label.contrast.toFixed(2)} (minimum 4.5)`);
    assert(action.iconContrasts.length>=2,`${action.id} has a destination icon and a navigation arrow`);
    assert(action.iconContrasts.every(value=>value>=3),`${action.id} icons contrast with their background by at least 3:1`);
   }
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.screenshot({path:resolve(output,`lobby-${state}-${width}.png`),fullPage:true});results.push({state,...m});
  }
  for(const target of destinationsToAudit){
   await visit();await enterActivity(target);
   await page.goBack();await view('hub');await page.goForward();await view(target.view);
   if(target.pole)assert.equal(await page.$eval('[data-treasury-pole]',el=>el.textContent),target.pole,'Browser history restores the requested treasury pole');
   await page.locator('[data-placard-view] nav[aria-label="Navigation du Placard"] button:first-child').click();await view('hub');assert.equal(new URL(page.url()).searchParams.get('pole'),null);
  }
  await visit();await page.focus('[data-map-building="bank"]');await page.keyboard.press('Enter');await page.waitForSelector('[data-map-building="bank"][aria-pressed="true"]');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-map-building')),'office');await page.keyboard.press('Space');await page.waitForSelector('[data-map-building="office"][aria-pressed="true"]');
  assert.deepEqual(await page.$$eval('[data-placard-activity]',els=>els.map(el=>el.dataset.placardActivity)),['treasury','management']);assert.equal((await measure()).overflow,false);
  if(width<=700){await page.select('[aria-label="Choisir un bâtiment"]','missions');await page.waitForSelector('[data-map-building="missions"][aria-pressed="true"]');await page.locator('[data-placard-activity="missions"]').click();await view('missions');}
  await auditCollectionMap(width);
  await page.click('summary');assert.equal(await page.$eval('details',el=>el.open),true);assert.equal((await measure()).overflow,false);await page.screenshot({path:resolve(output,`help-${width}.png`),fullPage:true});
  if(width<=700)await auditTouchMap(width,844);
 }
 for(const width of [320,390,430])await auditTouchMap(width,568);
 for(const {width,height} of [{width:320,height:568},{width:844,height:390}]){
  await page.setViewport({width,height,isMobile:true,hasTouch:true});await visit('active');await view('hub');
  let m=await measure();assert.equal(m.overflow,false);assertBuildingTargets(m);if(width<=700)assertMobileOverview(m);
  await page.screenshot({path:resolve(output,`touch-compact-${width}x${height}.png`),fullPage:true});
  for(const building of buildings){await tap(`[data-map-building="${building}"]`);await page.waitForSelector(`[data-map-building="${building}"][aria-pressed="true"]`);if(building==='collection'){await page.waitForSelector(album+'[open]');await closeCollection(collectionPin);}}
  for(const target of destinationsToAudit.filter(target=>['warehouse','office'].includes(target.building))){
   await visit('active');await tap(`[data-map-building="${target.building}"]`);await page.waitForSelector(`[data-map-building="${target.building}"][aria-pressed="true"]`);
   m=await measure();assert.equal(m.overflow,false);assertBuildingTargets(m);
   await tap(`[data-placard-activity="${target.activity}"]`);await view(target.view);
   if(target.pole)assert.equal(await page.$eval('[data-treasury-pole]',el=>el.textContent),target.pole);
  }
  compactResults.push({width,height,allBuildingControlsReachable:true,warehouseActionsReachable:true,officeActionsReachable:true,touchNavigation:true,noOverflow:true});
 }
 await page.setViewport({width:1440,height:1000,isMobile:false,hasTouch:false});
 await visit('starter','guide=1');await page.locator('[data-placard-activity="workshop"]').click();await view('workshop');await clickText('Acheter une lampe');await view('shop');
 assert.equal(new URL(page.url()).searchParams.get('guide'),'1');assert.equal(new URL(page.url()).searchParams.get('catalog'),'equipment');assert.equal(await page.$eval('[data-equipment]',el=>el.textContent),'LED-500');
 await page.goBack();await view('workshop');await page.goForward();await view('shop');await clickText('Installer');await view('workshop');assert.equal(await page.$eval('[data-equipment]',el=>el.textContent),'LED-500');
 await visit('starter','view=shop&catalog=equipment&equipment=LED-500&from=workshop');await view('shop');assert.equal(await page.$eval('[data-catalog]',el=>el.textContent),'Matériel');await clickText('Quitter la boutique');await view('workshop');
 await visit('starter','view=missions');await view('missions');await page.click('details > summary');await page.waitForSelector('[data-placard-dashboard]');await page.waitForSelector('[aria-label="Prochain investissement"]');assert.equal(await page.$('[aria-label="Vues du tableau de bord"]'),null);await page.screenshot({path:resolve(output,'progression.png'),fullPage:true});
 await visit('starter','view=treasury&pole=invalid');await view('treasury');assert.equal(await page.$eval('[data-treasury-pole]',el=>el.textContent),'accounting');
 await visit('starter','view=treasury');await view('treasury');assert.equal(await page.$eval('[data-treasury-pole]',el=>el.textContent),'accounting');
 await visit('starter','view=treasury&pole=bank');await view('treasury');assert.equal(await page.$eval('[data-treasury-pole]',el=>el.textContent),'bank');await clickText('Aller au Marché');await view('market');assert.equal(new URL(page.url()).searchParams.get('pole'),null);await page.goBack();await view('treasury');assert.equal(await page.$eval('[data-treasury-pole]',el=>el.textContent),'bank');
 await visit('error');await page.waitForSelector('[data-placard-lobby] [role="status"]');await clickText('Réessayer');await page.waitForSelector('[data-placard-lobby] [role="status"]',{hidden:true});
 await visit('starter','view=unknown');await view('hub');
 assert(requests.every(r=>r.method==='GET'));assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,scope:'Real map, lobby, shell, collection, progression; other destinations stubbed for navigation only',results,touchResults,compactResults,collectionResults,eightBuildingControls:true,distinctBuildingHitAreas:true,touchTargetMinimum:44,keyboardBuildingSelection:true,mobileBuildingSelector:true,mapImageLoaded:true,mobileOverviewFits:true,mobileZoomPanning:true,mobileTouchNavigation:true,shortPortraitHeight:568,phoneLandscape:true,textContrastMinimum:4.5,iconContrastMinimum:3,bankAndOfficePoles:true,validatedTreasuryDeepLinks:true,directTreasuryAndArena:true,browserHistory:true,missionNavigationAndHistory:true,equipmentDeepLinks:true,collectionToShop:true,helpOnDemand:true,progressionOnDemand:true,retry:true,readOnly:true,requests,errors},null,2));
 console.log(JSON.stringify({passed:true,viewports:5,states:4,touchViewports:touchResults.length,browserHistory:true,errors,output}));
 }
}finally{await browser?.close();await server.close();}
