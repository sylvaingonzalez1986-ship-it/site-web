// Actual tour, Placard lobby and collection; simulated notebook/culture pages and API.
// No Supabase or external requests. Navigation deliberately exercises full page reloads.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/arena-journey'), origin='http://127.0.0.1:3212';
let account='alice', persisted=true, failWrite=false;
const progress=new Map(), requests=[], errors=[];
const modules={
 'next/image': `import React from 'react';export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 'next/dynamic': `import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(()=>load().then(defaultExport=>({default:defaultExport})));return props=><Suspense fallback={null}><C {...props}/></Suspense>;}`,
 'cookie-stub': `import {useState,useEffect} from 'react';export function useCookieConsent(){const [showBanner,setShow]=useState(new URLSearchParams(location.search).has('cookies'));useEffect(()=>{const close=()=>setShow(false);window.addEventListener('dismiss-cookies',close);return()=>window.removeEventListener('dismiss-cookies',close);},[]);return {showBanner};}`,
 'link-stub': `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`,
 'journey-entry': `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
 import {ArenaJourneyTour} from '/src/components/contest/ArenaJourneyTour';
 import {KqPlacardLobby} from '/src/components/placard/KqPlacardLobby';
 import {KqBotteCollection} from '/src/components/placard/KqBotteCollection';
 import {KqSupportBoosterShop} from '/src/components/placard/KqSupportBoosterShop';
 import {KqWarehouseEntry} from '/src/components/placard/KqWarehouseEntry';
 import {KQ_EQUIPMENT_CATALOG} from '/src/lib/kanab-quest-equipment';
 const originalFetch=window.fetch.bind(window);window.fetch=(url,init={})=>String(url).endsWith('/equipment')&&(!init.method||init.method==='GET')?Promise.resolve(new Response(JSON.stringify({cashCents:100000,levels:{},purchasedCodes:[],reputation:0,ownedCodes:['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'],equippedCodes:['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'],routePlan:null,catalog:KQ_EQUIPMENT_CATALOG}))):originalFetch(url,init);
 function App(){const [open,setOpen]=useState(false),[book,setBook]=useState(false);const query=new URLSearchParams(location.search),view=query.get('view');return <>
 {query.has('cookies')?<button id='cookies' onClick={()=>{window.dispatchEvent(new Event('dismiss-cookies'));document.getElementById('cookies').remove();}}>Fermer les cookies</button>:null}
 {location.pathname==='/arene/placard'&&!view?<KqPlacardLobby onOpen={v=>location.assign('/arene/placard?view='+v)} onOpenEquipment={()=>{}} onOpenCollection={()=>setOpen(true)}/>:view==='workshop'?<KqWarehouseEntry onClose={()=>location.assign('/arene/placard')} onOpenShop={()=>{}}/>:view==='shop'?<KqSupportBoosterShop autoOpen autoOpenEquipment={query.get('catalog')==='equipment'} autoClaimWelcome={!query.has('guide')} onExit={()=>location.assign('/arene/placard')} onOpenCollection={()=>setOpen(true)}/>:<main style={{maxWidth:1000,margin:'auto',padding:24,minHeight:'110vh'}}><h1>{view==='missions'?<span data-arena-tour='missions'>Le centre de missions</span>:view==='game'?<span data-arena-tour='culture'>Préparer ma culture</span>:location.pathname.includes('/carnet/')?'Mon Carnet':'Mon profil'}</h1><img alt='' src='/contest/mascot/arena-scene-carnet-v1.png' style={{width:'100%',maxHeight:380,objectFit:'cover'}}/>{location.pathname.includes('/carnet/')?<button data-arena-tour='notebook' onClick={()=>setBook(true)}>Ouvrir mon Carnet</button>:null}{book?<p id='book-open'>Le Carnet est ouvert.</p>:null}</main>}
 {open?<KqBotteCollection onClose={()=>setOpen(false)}/>:null}<ArenaJourneyTour/></>;}
 createRoot(document.getElementById('root')).render(<App/>);`,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom/client','react-dom','lucide-react']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},
 plugins:[{name:'journey-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;if(id.endsWith('/components/cookies/CookieConsentProvider'))return '\0cookie-stub';if(id.endsWith('/components/navigation/NavigationLink'))return '\0link-stub';},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
  const path=req.url?.split('?')[0];
  if(path?.startsWith('/api/')){
   requests.push({path,method:req.method});res.setHeader('Content-Type','application/json');
   if(path==='/api/arena/tutorial'){
    if(!account){res.statusCode=401;return res.end('{}');}
    if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);if(failWrite){res.statusCode=503;return res.end('{}');}if(persisted)progress.set(account,body);return res.end(JSON.stringify({progress:body,persisted}));}
    return res.end(JSON.stringify({userId:account,progress:progress.get(account)??{step:0,status:'new'},persisted}));
   }
   if(path.endsWith('/boosters'))return res.end(JSON.stringify({collectionActive:true,costPerPack:5,spendablePoints:20,availableEntitlements:[],welcomeClaimed:false}));
   return res.end(JSON.stringify({collection:{cards:[{code:'BOTTE-002',ownedCopies:2}]}}));
  }
  if(!['/profil','/arene','/arene/carnet/regular','/arene/placard'].includes(path))return next();
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial}body{margin:0;background:#003f30;color:#fff8e8}main>button{padding:20px;background:#ffda48;color:#102c26}h1{font-size:32px;margin:20px 0}</style><div id="root"></div><script type="module" src="/@id/__x00__journey-entry"></script></html>');
 });}}],server:{host:'127.0.0.1',port:3212,strictPort:true,hmr:false,watch:null}});

let browser;
try {
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>void(r.url().startsWith(origin)||r.url().startsWith('data:')?r.continue():r.abort()));
 const visit=async(path='/profil')=>page.goto(origin+path,{waitUntil:'networkidle0'});
 const welcome='dialog[data-arena-journey-ui][open]', coach='[data-arena-journey-ui] section';
 const button=async(selector)=>{await page.waitForSelector(selector);await page.click(selector);};
 const next=()=>button('[data-arena-journey-ui] footer button:last-child');
 const waitStep=async(step)=>page.waitForFunction(step=>{
  const expected=['','/arene/carnet/regular','/arene/placard','/arene/placard?view=shop&guide=1','/arene/placard?view=shop&catalog=equipment&guide=1','/arene/placard?view=workshop','/arene/placard?view=game','/arene/placard?view=arena','/arene/placard?view=market','/arene/placard?view=missions'][step];
  return location.pathname+location.search===expected && document.querySelector('[data-arena-journey-ui] h2')?.textContent.startsWith(step+'.');
 },{},step);
 const snap=async(name)=>{await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:resolve(output,name+'.png')});};
 await page.setViewport({width:390,height:844});await visit('/profil?cookies=1');assert.equal(await page.$(welcome),null);await button('#cookies');await page.waitForSelector(welcome);
 await next();await waitStep(1);assert.ok(page.url().endsWith('/arene/carnet/regular'));
 await button(coach+' button[class*="try"]');await page.waitForSelector('#book-open');await page.reload({waitUntil:'networkidle0'});await waitStep(1);
 await next();await waitStep(2);await button(coach+' button[class*="try"]');await page.waitForSelector('dialog[aria-labelledby="botte-collection-title"][open]');await page.waitForSelector(coach,{hidden:true});
 await page.waitForSelector('button[data-owned="true"]');await button('button[data-owned="true"]');await page.waitForSelector('dialog[aria-labelledby="botte-detail-title"][open]');await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForSelector(coach);
 await next();await waitStep(3);await page.waitForSelector('[data-arena-tour-surface="shop"] [data-arena-journey-ui]');await snap('shop-tour');
 await next();await waitStep(4);await page.waitForSelector('[data-arena-tour-surface="catalog"] [data-arena-journey-ui]');await snap('equipment-tour');
 await next();await waitStep(5);await snap('installation-tour');
 for(const step of [6,7,8,9]){await next();await waitStep(step);}
 await next();await page.waitForSelector(coach,{hidden:true});assert.equal(progress.get('alice').status,'completed');
 await visit();assert.equal(await page.$(welcome),null);await button('button[class*="replay"]');await page.waitForSelector(welcome);await page.keyboard.press('Escape');await page.waitForSelector(welcome,{hidden:true});assert.equal(progress.get('alice').status,'skipped');
 account='bob';await visit();await page.waitForSelector(welcome);assert.equal(progress.has('bob'),false);
 for(const [width,height] of [[320,740],[390,844],[768,1024],[1440,1000],[844,390]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});progress.set('bob',{step:0,status:'new'});await visit();await page.waitForSelector(welcome);await snap('welcome-'+width);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  progress.set('bob',{step:2,status:'active'});await visit('/arene/placard');await waitStep(2);await snap('cards-'+width);
  assert.equal(await page.$eval(coach,el=>el.scrollWidth>el.clientWidth+1),false);
  const bounds=await page.$eval(coach,el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};});assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=height);
  for(const step of [3,4]){
   progress.set('bob',{step,status:'active'});await visit('/arene/placard?view=shop'+(step===4?'&catalog=equipment':'')+'&guide=1');await waitStep(step);
   await page.waitForSelector('[data-arena-tour-surface] [data-arena-journey-ui]');await snap((step===3?'shop-':'equipment-')+width);
   const box=await page.$eval(coach,el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,overflow:el.scrollWidth>el.clientWidth+1};});
   assert.ok(box.left>=0&&box.right<=width&&box.top>=0&&box.bottom<=height&&!box.overflow,JSON.stringify({width,step,box}));
   await page.focus(coach+' footer button:last-child');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[data-arena-tour-surface]')),true);
   if(step===4){
    await page.$eval('button[aria-label^="Voir "]',el=>el.click());await page.waitForSelector(coach,{hidden:true});
    await button('[aria-label="Fermer la fiche"]');await page.waitForSelector(coach);await next();await waitStep(5);await snap('installation-'+width);assert.equal(await page.$eval('[data-arena-tour="warehouse"]',el=>el.getBoundingClientRect().height>0),true);
   }
  }
 }
 account='local-only';persisted=false;await visit();await page.waitForSelector(welcome);await next();await waitStep(1);await page.reload({waitUntil:'networkidle0'});await waitStep(1);assert.equal(progress.has(account),false);await button('[aria-label="Passer le tutoriel"]');await page.waitForSelector(coach,{hidden:true});
 persisted=true;await visit();assert.equal(await page.$(welcome),null);assert.equal(progress.get(account).status,'skipped');
 account='blocked-storage';await page.evaluateOnNewDocument(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage disabled');};});await visit();await page.waitForSelector(welcome);await next();await waitStep(1);assert.equal(progress.get(account).step,1);
 failWrite=true;await next();await page.waitForSelector('[role="alert"]');assert.ok(page.url().endsWith('/arene/carnet/regular'));failWrite=false;
 account=null;await visit();assert.equal(await page.$(welcome),null);assert.equal(await page.$(coach),null);
 assert.deepEqual(errors,[]);assert.ok(requests.filter(r=>r.method!=='GET').every(r=>r.path==='/api/arena/tutorial'));
 await writeFile(resolve(output,'report.json'),JSON.stringify({responsiveViews:25,shopAndCatalog:true,fullJourney:true,collectionZoom:true,resume:true,skipAndReplay:true,accountIsolation:true,cookieDelay:true,localFallback:true,pendingSync:true,blockedStorage:true,failedSave:true,guestHidden:true,gameplayWrites:0,errors},null,2));
 console.log('PASS: journey navigation, collection zoom, 25 responsive views, resume, skip/replay, account isolation, cookies, storage fallback/sync, save failures, guests; zero gameplay writes.');
} finally {await browser?.close();await server.close();}
