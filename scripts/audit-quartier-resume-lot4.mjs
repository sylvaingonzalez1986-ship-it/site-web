/** Actual Quartier, village map and pinned objective. Local read-only fixtures; no remote traffic. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/clarity-lot4/quartier');
const port=Number(process.env.KQ_QUARTIER_RESUME_PORT??3504),origin=`http://127.0.0.1:${port}`;
const modules={
 entry:`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqPlacardLobby} from '/src/components/placard/KqPlacardLobby';
import {KqPinnedMission,KqMissionFocusProvider} from '/src/components/placard/KqPinnedMission';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
let mode='rich';window.requests=[];window.navigation=[];
const owner='quartier-resume-audit';
function payload(path){
 if(path.endsWith('/commerce'))return{business:{serverNow:'2026-10-29T12:00:00.000Z',lab:{outstandingCents:0,overdueCents:0,invoices:[]},suppliers:{outstandingCents:0,overdueCents:0,invoices:[]}},online:{version:1,serverNow:'2026-10-29T12:00:00.000Z',site:{createdAt:null,active:false},listings:[]}};
 const pending=['mixed','waiting','waiting-goal','active','storage-unknown','capacity-unknown','inconsistent'].includes(mode);
 if(path.endsWith('/equipment'))return{activeRun:['mixed','active'].includes(mode),readyLotCount:mode==='mixed'?2:0,availableFlowerCount:mode==='mixed'||mode==='jury'?1:0,curingFlowerCount:pending&&mode!=='inconsistent'?1:0,ownedCodes:[],cashCents:10000000,productionUnits:1};
 if(path.endsWith('/storage'))return{serverNow:'2026-10-29T12:00:00.000Z',lots:pending||['jury','manual-overflow','exposed-unknown'].includes(mode)?[{flowerId:'fixture-flower',varietyName:'Orange de montagne',flowerStatus:'available',harvestGrams:125,
 projection:{stage:mode==='jury'?'ready':'curing',readyAt:mode==='jury'?'2026-10-29T11:00:00.000Z':'2026-10-29T16:30:00.000Z',nextChangeAt:'2026-10-29T13:00:00.000Z',capacity:mode==='capacity-unknown'?undefined:{overflowUnits:['mixed','manual-overflow','exposed-unknown'].includes(mode)?1250:0,overflowDeadlineAt:'2026-10-29T13:00:00.000Z',automaticOverflowSale:mode!=='manual-overflow'}}}]:[]};
 if(path.endsWith('/missions'))return{missions:[{code:'first-curing',progress:0,target:1,unlocked:true,claimable:false,claimed:false,rewardCents:2500}]};
 return{};
}
const api={...createKqTutorialApi(async(input,init={})=>{const path=new URL(String(input),location.origin).pathname;const method=init.method??'GET';window.requests.push({path,method});if(method!=='GET')throw new Error('No mutations authorized');
 if(mode==='hanging')await new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Fixture timed out','AbortError')),{once:true}));
 const fail=mode==='unknown'||mode==='storage-unknown'&&path.endsWith('/storage')||mode==='exposed-unknown'&&path.endsWith('/equipment');return Response.json(fail?{error:'Fixture unavailable'}:payload(path),{status:fail?503:200});}),isTutorial:false};
function App(){const[epoch,setEpoch]=React.useState(0);window.mount=name=>{mode=name;window.navigation=[];window.requests=[];localStorage.removeItem('kq-pinned-mission-v1:'+owner);if(name==='waiting-goal')localStorage.setItem('kq-pinned-mission-v1:'+owner,JSON.stringify({version:1,code:'first-curing'}));setEpoch(value=>value+1)};window.recover=()=>{mode='rich'};
 return <div data-fixture={mode}><KqTutorialApiProvider api={api}><KqMissionFocusProvider key={epoch} ownerId={owner}><KqPlacardLobby onOpen={(view,options)=>window.navigation.push({view,options})} onOpenCollection={()=>window.navigation.push({view:'collection'})}><KqPinnedMission onChoose={()=>window.navigation.push({view:'missions'})} onContinue={code=>window.navigation.push({view:'goal',code})}/></KqPlacardLobby></KqMissionFocusProvider></KqTutorialApiProvider></div>}
createRoot(document.getElementById('root')).render(<App/>);`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
 'next/link':`import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
 'next/navigation':`export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},
 plugins:[{name:'quartier-resume-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},
 configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reprise du Quartier</title><style>@font-face{font-family:AuditDisplay;src:url("/src/app/fonts/BarlowCondensed-Latin-Black.woff2");font-weight:900}@font-face{font-family:AuditBody;src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}body{margin:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>')})}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
const results=[],errors=[];let browser;
const cases={mixed:['storage','attention','harvests'],waiting:['curing','waiting','workshop'],'waiting-goal':['curing','waiting','workshop'],active:['culture','ready','game'],jury:['jury','ready','arena'],rich:['new-culture','ready','game'],'storage-unknown':['curing','unknown','workshop'],'capacity-unknown':['curing','unknown','workshop'],inconsistent:['curing','unknown','workshop'],'manual-overflow':['storage','attention','harvests'],'exposed-unknown':['storage','attention','harvests'],unknown:['unknown','unknown',null],hanging:['unknown','unknown',null]};
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||url.protocol==='data:')void request.continue();else void request.abort()});
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await page.waitForFunction(()=>typeof window.mount==='function');
  for(const[mode,[kind,tone,destination]]of Object.entries(cases)){
   await page.evaluate(mode=>window.mount(mode),mode);await page.waitForSelector('[data-fixture="'+mode+'"] [data-placard-next-action]');await page.waitForSelector('[data-placard-map]');await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>document.querySelector('[data-placard-lobby]')?.textContent.includes('Choisir un objectif')||document.querySelector('[data-pinned-mission] [role="meter"]'));
   const metrics=await page.$eval('[data-placard-next-action]',element=>{const button=element.querySelector(':scope > button'),bounds=element.getBoundingClientRect();return{kind:element.dataset.priority,tone:element.dataset.tone,title:element.querySelector('h2').textContent,text:element.textContent,primaryActions:element.querySelectorAll(':scope > button').length,secondaryFacts:element.querySelectorAll('li').length,height:Math.round(bounds.height),buttonHeight:Math.round(button.getBoundingClientRect().height),buttonFont:parseFloat(getComputedStyle(button).fontSize),descriptionFont:parseFloat(getComputedStyle(element.querySelector('[data-village-reply]')).fontSize)}});
   assert.equal(metrics.kind,kind);assert.equal(metrics.tone,tone);assert.equal(metrics.primaryActions,1);assert(metrics.secondaryFacts<=2);assert(metrics.buttonHeight>=48);assert(metrics.buttonFont>=14);assert(metrics.descriptionFont>=14);
   assert.doesNotMatch(metrics.text,/Investis|Budget atteint|pendant ton absence|Protège ta récolte avant le jury/);
   if(tone==='waiting'){assert.match(metrics.text,/rangé/);assert.match(metrics.text,/17:30/);assert.match(metrics.text,/automatiquement/)}
   if(['storage-unknown','inconsistent'].includes(mode)){assert.match(metrics.text,/ne sont pas confirmés/);assert.doesNotMatch(metrics.text,/sont rangés/)}
   if(mode==='capacity-unknown'){assert.match(metrics.text,/rangement reste à vérifier/);assert.match(metrics.text,/17:30/);assert.doesNotMatch(metrics.text,/est rangé/)}
   if(mode==='manual-overflow')assert.doesNotMatch(metrics.text,/vente automatique/);
   if(mode==='mixed')assert.match(metrics.text,/125 g sans contenant/);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,mode+' fits '+width);
   if(mode==='waiting-goal'){
    await page.waitForSelector('[data-pinned-mission="first-curing"]');
    assert.equal(await page.$eval('[data-pinned-mission]',node=>node.previousElementSibling?.hasAttribute('data-placard-next-action')&&node.nextElementSibling?.hasAttribute('data-placard-map')),true,'Pinned objective follows the main card and precedes the map');
   }
   const requests=await page.evaluate(()=>window.requests);assert(requests.every(request=>request.method==='GET'));assert(requests.every(request=>['/api/arena/placard/equipment','/api/arena/placard/storage','/api/arena/placard/missions','/api/arena/placard/commerce'].includes(request.path)));
   if(mode!=='waiting-goal')assert.equal(requests.some(request=>request.path.endsWith('/missions')),false,'No mission fetch without a voluntary pin');
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:resolve(output,mode+'-'+width+'-viewport.png')});
   if(['mixed','waiting-goal','unknown'].includes(mode))await page.screenshot({path:resolve(output,mode+'-'+width+'-full.png'),fullPage:true});
   if(mode==='unknown'||mode==='hanging')await page.evaluate(()=>window.recover());
   await page.focus('[data-placard-next-action] button');assert.notEqual(await page.$eval('[data-placard-next-action] button',node=>getComputedStyle(node).outlineStyle),'none');await page.keyboard.press('Enter');
   if(destination){const navigation=await page.evaluate(()=>window.navigation);assert.equal(navigation.at(-1).view,destination);if(kind==='storage')assert.equal(navigation.at(-1).options.harvestSection,'storage')}
   else await page.waitForFunction(()=>document.querySelector('[data-placard-next-action]')?.dataset.priority==='new-culture');
   results.push({width,mode,...metrics,overflow,onlyReadRequests:true});
  }
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'Actual KqPlacardLobby, KqPlacardMap and KqPinnedMission; global HUD excluded; local read-only fixtures',viewportHeight:844,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors}));
}finally{await browser?.close();await server.close()}
