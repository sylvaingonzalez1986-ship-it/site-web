/** Current Lobby/map and real Shell routing with destination stubs. All data and requests stay local. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer,transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/clarity-lot6/quartier');
const port=Number(process.env.KQ_QUARTIER_ATTENTION_PORT??3566),origin=`http://127.0.0.1:${port}`,preview=process.argv.includes('--preview');
const selectedCases=process.argv.find(arg=>arg.startsWith('--cases='))?.slice(8).split(',');
const destinations={
 './KqTreasuryDesk':`import React from 'react';export function KqTreasuryDesk(props){return <section data-destination="treasury" data-pole={props.initialPole}><h2>Factures — destination simulée, aucun règlement</h2></section>}`,
 './KqMarketDesk':`import React from 'react';export function KqMarketDesk(props){return <section data-destination="market" data-section={props.section} data-listing={props.initialListingId??''}><h2>Commerce — destination simulée, aucune commande</h2></section>}`,
 './KqHarvests':`import React from 'react';export function KqHarvests(props){return <section data-destination="harvests" data-section={props.section}><h2>Stockage — destination simulée</h2></section>}`,
};
const modules={entry:`import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
import{KqPlacardLobby}from'/src/components/placard/KqPlacardLobby';
import{PlacardPlayerShell}from'/src/components/placard/PlacardPlayerShell';
import{KqMissionFocusProvider,KqPinnedMission}from'/src/components/placard/KqPinnedMission';
import{KqTutorialApiProvider,createKqTutorialApi}from'/src/components/placard/KqTutorialApiContext';
import{createKqOperationsLesson,getKqOperationsCommerce}from'/src/lib/kanab-quest-operations-lesson';
import retro from'/src/components/contest/ArenaRetro.module.css';
const now=Date.parse('2026-10-29T12:00:00.000Z'),iso=hours=>new Date(now+hours*3600000).toISOString();
const seed=getKqOperationsCommerce(createKqOperationsLesson('market'));
let mode='culture',commerce,equipment,storage;window.__requests=[];window.__navigation=[];window.__attentionCompleted=0;
const invoice=(id,cents,dueHours)=>({id,runId:'run-fixture',issuedAt:iso(-120),dueAt:iso(dueHours),amountCents:cents,remainingCents:cents});
const listing=(id,status='active')=>({id,stockId:'stock-fixture',name:'Orange sanguine de montagne · récolte de démonstration',route:'raw',formatGrams:5,packagingCode:'kraft-5',packetPriceCents:1250,initialPackets:8,remainingPackets:8,soldPackets:0,status,qualityScore:8,baseUnitCents:250,createdAt:iso(-24)});
function configure(name){
 mode=name;window.__requests=[];window.__navigation=[];window.__attentionCompleted=0;
 commerce=structuredClone(seed);commerce.rawLots=[];commerce.stocks=[];commerce.electricityOutstandingCents=0;commerce.cashCents=50000;
 commerce.business.serverNow=iso(0);commerce.business.lab={outstandingCents:0,overdueCents:0,invoices:[]};commerce.business.suppliers={outstandingCents:0,overdueCents:0,invoices:[]};
 commerce.business.nextEventAt=null;commerce.online.serverNow=iso(0);commerce.online.settledUntil=iso(0);commerce.online.site={...commerce.online.site,createdAt:iso(-120),active:true,renew:true,paidUntil:iso(48)};commerce.online.listings=[];
 equipment={activeRun:['culture','overdue','suspended','quality','upcoming-active','far-future','paused','closed','sold-out','discarded','uncreated','healthy','mixed','unknown','partial','slow','hanging'].includes(name),readyLotCount:0,availableFlowerCount:0,curingFlowerCount:['waiting','upcoming-waiting'].includes(name)?1:0,productionUnits:1,ownedCodes:[],cashCents:50000};
 storage={serverNow:iso(0),lots:[]};
 if(name==='busy-unknown')equipment={...equipment,activeRun:true,readyLotCount:2,availableFlowerCount:1};
 if(['waiting','upcoming-waiting','mixed'].includes(name))storage.lots=[{flowerId:'flower-fixture',varietyName:'Orange sanguine',harvestGrams:125,flowerStatus:'available',projection:{stage:'curing',readyAt:iso(6),nextChangeAt:iso(1),capacity:{overflowUnits:name==='mixed'?1250:0,overflowDeadlineAt:iso(1),automaticOverflowSale:true}}}];
 if(['overdue','mixed','low-cash'].includes(name)){commerce.business.lab={outstandingCents:4500,overdueCents:4500,invoices:[invoice('lab-fixture',4500,-2)]};commerce.business.suppliers={outstandingCents:6500,overdueCents:6500,invoices:[invoice('supplier-fixture',6500,-1)]};}
 if(['upcoming-active','upcoming-waiting','upcoming-new','far-future'].includes(name))commerce.business.suppliers={outstandingCents:6500,overdueCents:0,invoices:[invoice('supplier-fixture',6500,name==='far-future'?30:8)]};
 if(name==='low-cash'){commerce.cashCents=100;equipment.cashCents=100;}
 if(['suspended','mixed'].includes(name)){commerce.online.site.active=false;commerce.online.site.paidUntil=iso(-1);commerce.online.listings=[listing('suspended-listing')];}
 if(name==='quality'){commerce.online.listings=[{...listing('quality-listing','quality-blocked'),qualityScore:5.6}];}
 if(['paused','closed','sold-out','discarded','healthy'].includes(name))commerce.online.listings=[{...listing('intentional-listing',name==='healthy'?'active':name),remainingPackets:['sold-out','discarded'].includes(name)?0:8}];
 if(['paused','closed'].includes(name)){commerce.online.site.active=false;commerce.online.site.paidUntil=iso(-1);}
 if(name==='uncreated'){commerce.online.site.active=false;commerce.online.site.createdAt=null;}
 if(name==='partial')delete commerce.business.suppliers;
 window.__fixtureAmounts={cashCents:commerce.cashCents,lab:commerce.business.lab.outstandingCents,suppliers:commerce.business.suppliers?.outstandingCents??null,packets:commerce.online.listings.reduce((sum,row)=>sum+row.remainingPackets,0)};
}
configure('culture');
const api={...createKqTutorialApi(async(input,init={})=>{
 const url=new URL(String(input),location.origin),method=init.method??'GET';window.__requests.push({path:url.pathname,search:url.search,method});if(method!=='GET')throw new Error('No game mutations allowed in this audit');
 if(url.pathname.endsWith('/equipment'))return Response.json(equipment);
 if(url.pathname.endsWith('/storage'))return Response.json(storage);
 if(url.pathname.endsWith('/commerce')){
  if(mode==='slow')await new Promise((resolve,reject)=>{window.__releaseAttention=resolve;init.signal?.addEventListener('abort',()=>reject(new DOMException('Fixture aborted','AbortError')),{once:true});});
  if(mode==='hanging')await new Promise((resolve,reject)=>init.signal?.addEventListener('abort',()=>reject(new DOMException('Fixture timed out','AbortError')),{once:true}));
  window.__attentionCompleted++;const unavailable=['unknown','busy-unknown'].includes(mode);return Response.json(unavailable?{error:'Attention temporarily unavailable'}:commerce,{status:unavailable?503:200});
 }
 return Response.json({error:'Unexpected fixture request'},{status:404});
}),isTutorial:false};
window.__recover=()=>{mode='culture';api.notify('kq:commerce-updated')};window.__recoverQuiet=()=>{mode='culture'};window.__notify=name=>api.notify(name);
window.__amounts=()=>({cashCents:commerce.cashCents,lab:commerce.business.lab.outstandingCents,suppliers:commerce.business.suppliers?.outstandingCents??null,packets:commerce.online.listings.reduce((sum,row)=>sum+row.remainingPackets,0)});
window.__clearBills=()=>{commerce.business.lab={outstandingCents:0,overdueCents:0,invoices:[]};commerce.business.suppliers={outstandingCents:0,overdueCents:0,invoices:[]};api.notify('kq:treasury-updated')};
function App(){const[epoch,setEpoch]=React.useState(0),[scope,setScope]=React.useState('lobby');window.mount=(name,nextScope='lobby')=>{configure(name);history.replaceState(null,'','/arene/placard');window.dispatchEvent(new PopStateEvent('popstate'));setScope(nextScope);setEpoch(v=>v+1)};
 return <KqTutorialApiProvider api={api}><div key={epoch} data-fixture={mode} data-scope={scope}>{scope==='shell'?<PlacardPlayerShell draftOwnerId="attention-fixture"/>:<div className={retro.surface}><KqMissionFocusProvider ownerId="attention-fixture"><KqPlacardLobby onOpen={(view,options)=>window.__navigation.push({view,options})} onOpenCollection={()=>window.__navigation.push({view:'collection'})}><KqPinnedMission onChoose={()=>window.__navigation.push({view:'missions'})} onContinue={()=>{}}/></KqPlacardLobby></KqMissionFocusProvider></div>}</div></KqTutorialApiProvider>;
}createRoot(document.getElementById('root')).render(<App/>);`,
 'next/image':`import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return<img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
 'next/link':`import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return<a {...props}/>} `,
 'next/navigation':`export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`,
 'next/dynamic':`import React from'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
 ...Object.fromEntries(Object.entries(destinations).map(([key,value])=>['destination:'+key,value])),
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'quartier-attention',enforce:'pre',resolveId(id,importer){if(importer?.replaceAll('\\','/').endsWith('/PlacardPlayerShell.tsx')&&id in destinations)return'\0destination:'+id;if(id in modules)return'\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['/','/arene/placard'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quartier — attention</title><style>@font-face{font-family:Display;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:Body;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}[data-destination]{padding:20px}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>');});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});

let browser,page;const results=[],errors=[],external=[];
await mkdir(output,{recursive:true});await server.listen();
if(preview){console.log(`Attention preview: ${origin}/arene/placard`);}
else try{
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.origin===origin)void request.continue();else{external.push(url.href);void request.abort();}});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const mount=async(name,scope='lobby')=>{await page.evaluate(({name,scope})=>window.mount(name,scope),{name,scope});await page.waitForSelector(`[data-fixture="${name}"] [data-placard-next-action]`);};
 const settled=async()=>{await page.waitForFunction(()=>window.__attentionCompleted>0);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 const primary='[data-placard-next-action] > button';
 const enter=async(selector)=>{const handle=await page.waitForSelector(selector,{visible:true});await handle.focus();assert.notEqual(await handle.evaluate(e=>getComputedStyle(e).outlineStyle),'none');await page.keyboard.press('Enter');};
 const measure=async(name,width)=>{
  await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,0));
  const metrics=await page.$eval('[data-placard-next-action]',node=>({kind:node.dataset.priority,tone:node.dataset.tone,text:node.textContent,title:node.querySelector('h2')?.textContent,primaryButtons:node.querySelectorAll(':scope > button').length,facts:node.querySelectorAll('li').length,height:Math.round(node.getBoundingClientRect().height),buttonHeight:node.querySelector(':scope > button')?.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert.equal(metrics.primaryButtons,1);assert(metrics.facts<=2);assert(metrics.buttonHeight>=48);assert.equal(metrics.overflow,false);
  assert.doesNotMatch(metrics.text,/pendant ton absence|toutes tes factures sont réglées|aucune vente bloquée/i);
  const requests=await page.evaluate(()=>window.__requests);assert(requests.every(r=>r.method==='GET'));assert(requests.every(r=>['/api/arena/placard/equipment','/api/arena/placard/storage','/api/arena/placard/commerce'].includes(r.path)));assert(requests.filter(r=>r.path.endsWith('/commerce')).every(r=>r.search==='?shop=1'));
  await page.screenshot({path:resolve(output,`${name}-${width}-viewport.png`)});if(['mixed','overdue','quality','unknown','busy-unknown','partial'].includes(name))await page.screenshot({path:resolve(output,`${name}-${width}-full.png`),fullPage:true});
  results.push({name,width,...metrics,readRequests:requests.length});return metrics;
 };
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await page.goto(origin+'/arene/placard',{waitUntil:'networkidle0',timeout:90000});await page.waitForFunction(()=>typeof window.mount==='function');
  for(const name of selectedCases??['mixed','overdue','low-cash','suspended','quality','culture','waiting','upcoming-active','upcoming-waiting','upcoming-new','far-future','paused','closed','sold-out','discarded','uncreated','healthy','unknown','busy-unknown','partial']){
   await mount(name);await settled();const metrics=await measure(name,width);
   if(name==='mixed'){
    assert.match(metrics.text,/125 g sans contenant/);assert.equal(metrics.kind,'storage');
    const notices=await page.$$eval('[data-resume-notice]',nodes=>nodes.map(e=>e.dataset.resumeNotice));assert.deepEqual(notices,['invoice-overdue','sales-suspended']);
    for(const notice of notices){await enter(`[data-resume-notice="${notice}"]`);const route=await page.evaluate(()=>window.__navigation.at(-1));assert.equal(route.view,notice==='invoice-overdue'?'treasury':'market');assert.equal(route.options?.[notice==='invoice-overdue'?'treasuryPole':'marketSection'],notice==='invoice-overdue'?'accounting':'management');}
   }
   if(name==='upcoming-active'){assert.equal(metrics.kind,'culture');await enter('[data-resume-notice="invoice-upcoming"]');assert.equal(await page.evaluate(()=>window.__navigation.at(-1).view),'treasury');}
   if(['upcoming-waiting','upcoming-new'].includes(name)){assert.equal(metrics.kind,'finance');assert.equal(metrics.tone,'ready');}
   if(['unknown','busy-unknown','partial'].includes(name))assert.equal(await page.$$('[data-resume-refresh]').then(nodes=>nodes.length),1);
   if(name==='busy-unknown'){
    assert.equal(metrics.kind,'culture');assert.equal(metrics.facts,2);assert.match(metrics.text,/2 lots prêts à vendre/);assert.match(metrics.text,/suivi des factures et des ventes reste à vérifier/);
    await page.evaluate(()=>window.__recoverQuiet());await enter('[data-resume-refresh]');await page.waitForFunction(()=>window.__attentionCompleted>1);await page.waitForFunction(()=>!document.querySelector('[data-resume-refresh]'));
    const recovered=await measure('busy-recovered',width);assert.equal(recovered.kind,'culture');assert.equal(recovered.facts,2);assert.match(recovered.text,/1 Fleur d’Arène prête pour le jury/);
   }
   if(['paused','closed','sold-out','discarded','uncreated','healthy','far-future'].includes(name))assert.equal(metrics.kind,'culture');
   if(['overdue','low-cash','suspended','quality'].includes(name)){
    await enter(primary);const route=await page.evaluate(()=>window.__navigation.at(-1));
    if(['overdue','low-cash'].includes(name)){assert.equal(route.view,'treasury');assert.equal(route.options?.treasuryPole,'accounting');}
    else{assert.equal(route.view,'market');if(name==='quality'){assert.equal(route.options?.marketSection,'dashboard');assert.equal(route.options?.listingId,'quality-listing');}else assert.equal(route.options?.marketSection,'management');}
   }
   assert.deepEqual(await page.evaluate(()=>window.__amounts()),await page.evaluate(()=>window.__fixtureAmounts),'Navigation never changes cash, invoice balances or packets');
  }
  if(selectedCases)continue;
  await mount('slow');assert.equal(await page.evaluate(()=>window.__attentionCompleted),0,'Slow optional attention request must not delay the core resume card');await page.evaluate(()=>window.__releaseAttention());await settled();await measure('slow-released',width);
  await mount('unknown');await settled();await page.evaluate(()=>window.__recover());await page.waitForFunction(()=>window.__attentionCompleted>1);await page.waitForFunction(()=>document.querySelector('[data-placard-next-action]')?.dataset.priority==='culture');await measure('recovered',width);
  await mount('unknown');await settled();await page.evaluate(()=>window.__recoverQuiet());await enter('[data-resume-refresh]');await page.waitForFunction(()=>window.__attentionCompleted>1);await page.waitForFunction(()=>!document.querySelector('[data-resume-refresh]'));results.push({name:'explicit-retry',width});
  await mount('overdue');await settled();await page.evaluate(()=>window.__clearBills());await page.waitForFunction(()=>document.querySelector('[data-placard-next-action]')?.dataset.priority==='culture');results.push({name:'paid-event',width});
  for(const name of ['overdue','quality']){
   await mount(name,'shell');await settled();await enter(primary);await page.waitForSelector('[data-destination]');
   const destination=await page.$eval('[data-destination]',e=>({...e.dataset}));
   if(name==='overdue'){assert.equal(destination.destination,'treasury');assert.equal(destination.pole,'accounting');}else{assert.equal(destination.destination,'market');assert.equal(destination.section,'dashboard');assert.equal(destination.listing,'quality-listing');}
   await enter('[data-placard-back="hub"]');await page.waitForSelector('[data-placard-next-action]');assert.equal(new URL(page.url()).searchParams.get('view'),null);results.push({name:`shell-${name}`,width,destination,backToQuarter:true});
  }
 }
 if(!selectedCases){await page.setViewport({width:390,height:844});await mount('hanging');
 assert.equal(await page.$eval('[data-placard-next-action]',e=>e.dataset.priority),'culture');
 assert.equal(await page.evaluate(()=>window.__requests.filter(r=>r.path.endsWith('/commerce')).length),1);
 await page.waitForSelector('[data-resume-refresh]',{timeout:15000});await page.evaluate(()=>window.__recoverQuiet());await enter('[data-resume-refresh]');await page.waitForFunction(()=>window.__attentionCompleted>0);await page.waitForFunction(()=>!document.querySelector('[data-resume-refresh]'));results.push({name:'timeout-retry',width:390,coreNeverBlocked:true});}
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await writeFile(resolve(output,selectedCases?'report-targeted.json':'report.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'Real Lobby/map and Shell; local data; destination stubs; no remote traffic or POST',viewportHeight:844,results,errors,external},null,2));console.log(JSON.stringify({passed:results.length,errors,external,output}));
}catch(error){await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{if(!preview){await browser?.close();await server.close();}}
