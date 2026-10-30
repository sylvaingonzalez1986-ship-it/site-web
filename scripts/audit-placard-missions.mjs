/** Real mission UI and catalog, with isolated synthetic API responses. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(), output=resolve(root,'output/placard-missions');
const modules={
 'workshop-entry': `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
 import {KqMissionCenter} from '/src/components/placard/KqMissionCenter';import retro from '/src/components/contest/ArenaRetro.module.css';
 import {KQ_MISSION_DEFINITIONS as definitions} from '/src/lib/kanab-quest-missions';
 const scenario=new URLSearchParams(location.search).get('scenario');
 window.__counts=Object.fromEntries(definitions.map(d=>[d.metric,10000]));window.__claims=[];window.__opened=[];window.__notifications=[];window.__fail=scenario==='error';
 for(const name of ['kq:equipment-updated','kq:treasury-updated','kq:collection-updated','kq:boosters-updated'])window.addEventListener(name,()=>window.__notifications.push(name));
 const earned=new Map();
 const seed=d=>earned.set(d.code,{reward:d.reward,entitlementId:d.reward.kind==='pack'?'pack-'+d.code:null});
 if(scenario==='complete')definitions.forEach(seed);
 if(scenario==='unavailable-card')definitions.filter(d=>d.track==='culture'&&d.step<3).forEach(seed);
 if(scenario==='inactive')definitions.filter(d=>(d.track==='quality'&&d.step<3)||(d.track==='online'&&d.step<5)).forEach(seed);
 if(scenario==='legacy')earned.set('first-harvest',{reward:{kind:'pack',cardCount:3},entitlementId:'legacy-pack'});
 const state=()=>({collectionActive:scenario!=='inactive',missions:definitions.map(d=>{const {code,track,step,target,metric}=d;const previous=definitions.find(p=>p.track===track&&p.step===step-1);const claimed=earned.has(code),unlocked=!previous||earned.has(previous.code);const reward=earned.get(code)?.reward??d.reward,entitlementId=earned.get(code)?.entitlementId??null;
  return {code,track,step,target,reward,cardCount:reward.kind==='pack'?reward.cardCount:0,rewardAvailable:reward.kind==='cash'||(scenario!=='inactive'&&!(scenario==='unavailable-card'&&code==='five-varieties')),claimed,unlocked,claimable:!claimed&&unlocked&&window.__counts[metric]>=target,progress:claimed?target:Math.min(target,window.__counts[metric]),entitlementId,packAvailable:!!entitlementId&&!window.__opened.includes(entitlementId)};
 })});
 const nativeFetch=window.fetch.bind(window);window.fetch=async(url,init={})=>{
  if(String(url)==='/api/account/missions')return new Response(JSON.stringify({missions:[],pendingRewards:[]}));
  if(String(url)==='/api/arena/placard/boosters'&&init.method==='PATCH'){
   const {entitlementId}=JSON.parse(init.body);const entry=[...earned.values()].find(item=>item.entitlementId===entitlementId);
   if(!entry||window.__opened.includes(entitlementId))return Response.json({error:'Pack déjà ouvert ou introuvable'},{status:409});
   window.__opened.push(entitlementId);return Response.json({cards:Array.from({length:entry.reward.cardCount},()=>({code:'BOTTE-006',name:'Deuxième chance',rarity:'gold'}))});
  }
  if(String(url)!=='/api/arena/placard/missions')return nativeFetch(url,init);
  if(scenario==='guest')return new Response(JSON.stringify({error:'Connecte-toi pour retrouver tes missions.'}),{status:401});
  if(window.__fail)return new Response(JSON.stringify({error:'Le centre de missions est momentanément indisponible.'}),{status:503});
  if(init.method!=='POST')return new Response(JSON.stringify(state()));
  const {code}=JSON.parse(init.body);window.__claims.push(code);await new Promise(resolve=>setTimeout(resolve,120));
  const mission=state().missions.find(m=>m.code===code),replayed=earned.has(code);
  if(!replayed&&(!mission?.claimable||!mission.rewardAvailable))return new Response(JSON.stringify({error:'Objectif incomplet ou récompense indisponible'}),{status:409});
  if(!replayed)seed(definitions.find(d=>d.code===code));return Response.json({...earned.get(code),cardCount:mission.cardCount,replayed});
 };
 const onOpen=view=>{window.__destination=view;};createRoot(document.getElementById('root')).render(React.createElement('div',{className:retro.surface+' '+retro.shell},React.createElement(KqMissionCenter,{onOpen})));`,
 '@/components/navigation/NavigationLink': `import React from 'react';export default function Link(props){return React.createElement('a',props);}`,
 'mission-hud': `export function KqPlacardHud(){return null;}`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,{loading:Loading}){const Component=React.lazy(async()=>({default:await loader()}));return props=>React.createElement(React.Suspense,{fallback:React.createElement(Loading)},React.createElement(Component,props));}`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
};
const server=await createServer({root,cacheDir:resolve(output,"vite-cache"),optimizeDeps:{include:["react","react-dom/client","lucide-react"]},configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'workshop-audit',enforce:'pre',resolveId(id){if(id.endsWith('/components/navigation/NavigationLink'))return '\0@/components/navigation/NavigationLink';if(id.endsWith('/KqPlacardHud')||id==='./KqPlacardHud')return '\0mission-hud';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard · Atelier</title><style>@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:AuditBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}body{margin:0;background:#fff1d6}</style><div id="root"></div><script type="module" src="/@id/__x00__workshop-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3201,strictPort:true,hmr:false,watch:null}});
let browser;
try {
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3201'))void r.continue();else void r.abort();});
 const goto=async(scenario='ready')=>{await page.goto('http://127.0.0.1:3201/?scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector('main');};
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const shot=async(name)=>{await page.evaluate(async()=>{await Promise.allSettled([...document.images].map(img=>img.decode()));});await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
 const culture='section[aria-label="Culture & Buddies"]';
 const clickText=async(text,selector='button')=>page.$$eval(selector,(buttons,text)=>{const button=buttons.find(button=>button.textContent.includes(text));if(!button)throw new Error('Missing button: '+text);button.click();},text);
 const waitClaim=async(code)=>page.waitForFunction(code=>window.__claims.includes(code)&&!document.body.innerText.includes('Récupération…'),{},code);
 for(const width of [320,390,768,1440]) {
  await page.setViewport({width,height:900});await goto();await page.waitForSelector(culture);
  await overflow();assert.equal(await page.$$('[role="meter"]').then(e=>e.length),5);
  assert.deepEqual(await page.$$eval('[aria-label="Progression de tes défis"] figure li strong',items=>items.map(item=>Number(item.textContent))),[0,5,25],'The overview separates claimed, claimable and remaining missions');
  assert.equal(await page.$$eval('[role="meter"]',items=>items.every(item=>Number(item.getAttribute('aria-valuenow'))===Number(item.getAttribute('aria-valuemax')))),true,'Every ready mission exposes its reached target');
  assert.equal(await page.$$eval('details ol li',items=>items.length),30);
  await page.$$eval('details',items=>items.forEach(item=>item.open=true));await overflow();
  await page.$$eval('details',items=>items.forEach(item=>item.open=false));
  await shot('missions-'+width);
 }
 await page.setViewport({width:390,height:844});
 await page.click(culture+' button');await waitClaim('first-harvest');
 await page.waitForFunction(()=>document.querySelector('[data-mission-receipt]').textContent.includes('50 € de jeu'));
 assert.deepEqual(await page.evaluate(()=>window.__claims),['first-harvest']);
 assert.equal(await page.$eval('[data-mission-receipt]',element=>element.textContent.includes('Ouvrir mon pack')),false);
 assert.equal(await page.evaluate(()=>window.__notifications.includes('kq:equipment-updated')),true);
 await page.click(culture+' button');await waitClaim('three-varieties');
 await page.click(culture+' button');await waitClaim('five-varieties');
 await page.waitForFunction(()=>document.querySelector('[data-mission-receipt]').textContent.includes('Deuxième chance rejoint ta collection'));
 assert.equal(await page.$eval('[data-mission-receipt]',element=>element.textContent.includes('Ouvrir mon pack')),false);
 assert.equal(await page.evaluate(()=>window.__notifications.includes('kq:collection-updated')),true);
 await shot('rare-card-390');
 await page.click(culture+' button');await waitClaim('ten-varieties');
 await page.click(culture+' button');await waitClaim('fifteen-varieties');
 await page.waitForFunction(()=>document.body.innerText.includes('Bravo ! Un pack de 3 cartes gagné.'));
 await clickText('Ouvrir mon pack','[data-mission-receipt] button');
 await page.waitForSelector('[data-support-pack-reveal]');
 assert.equal(await page.$$('[data-support-pack-reveal] article').then(items=>items.length),3);
 await page.click('[aria-label="Fermer le pack ouvert"]');
 await page.click(culture+' button');await waitClaim('twenty-varieties');
 await page.waitForFunction(()=>document.body.innerText.includes('Bravo ! Un pack de 10 cartes gagné.'));
 await page.waitForFunction(selector=>document.querySelector(selector).textContent.includes('Parcours terminé'),{},culture);
 await shot('claimed-390');
 assert.equal(await page.$$eval('[data-mission-receipt] button',buttons=>buttons.some(button=>button.textContent.includes('Ouvrir mon pack'))),true,'The newly earned pack remains accessible in its receipt');
 await page.select('select[aria-label="Filtrer les parcours"]','online');
 assert.equal(await page.$$('details ol').then(items=>items.length),1);
 await page.select('select[aria-label="Filtrer les parcours"]','all');
 await page.click('section[aria-label="Vente en ligne"] button');await waitClaim('first-online-sale');
 await page.evaluate(()=>{window.__counts.clients=1;});await page.click('[aria-label="Actualiser les objectifs"]');
 await page.waitForFunction(()=>document.querySelector('section[aria-label="Vente en ligne"] button').textContent.includes('Vendre en ligne'));
 await page.click('section[aria-label="Vente en ligne"] button');assert.equal(await page.evaluate(()=>window.__destination),'market');
 for(const scenario of ['guest','error','inactive','unavailable-card','legacy','complete']) {
  await goto(scenario);await overflow();await shot(scenario+'-390');
  if(scenario==='guest')assert(await page.$('a[href*="connexion"]'));
  if(scenario==='error'){
   await page.evaluate(()=>{window.__fail=false;});await clickText('Réessayer');await page.waitForSelector(culture);
  }
  if(scenario==='inactive'){
   assert.equal(await page.$eval(culture+' button',button=>button.disabled),false,'Cash remains claimable without an active collection');
   assert.equal(await page.$eval('section[aria-label="Qualité & savoir-faire"] button',button=>button.disabled),true,'Rare cards require availability');
   assert.equal(await page.$eval('section[aria-label="Vente en ligne"] button',button=>button.disabled),true,'Packs require availability');
   await page.click(culture+' button');await waitClaim('first-harvest');
   assert.equal(await page.$eval('[data-mission-receipt]',element=>element.textContent.includes('50 € de jeu')),true);
  }
  if(scenario==='unavailable-card')assert.equal(await page.$eval(culture+' button',button=>button.disabled),true,'Individual missing card disabled even with active collection');
  if(scenario==='legacy'){
   await clickText('de mission à ouvrir','[data-mission-packs] button');await page.waitForSelector('[data-support-pack-reveal]');
   assert.deepEqual(await page.evaluate(()=>window.__opened),['legacy-pack']);
   await page.click('[aria-label="Fermer le pack ouvert"]');
   assert.equal(await page.$$('[data-mission-packs] button').then(items=>items.length),0);
  }
  if(scenario==='complete')assert.equal(await page.$$eval('h2',els=>els.filter(el=>el.textContent.includes('Parcours terminé')).length),5);
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,widths:[320,390,768,1440],missions:30,tracks:5,states:['ready','cash','rare-card','pack','guest','error-recovery','inactive','unavailable-card','legacy-pack','complete'],claims:['cash','cash','card','card','pack-3','pack-10'],audienceRegression:true,errors},null,2));
 console.log('Missions UI passed: 30 missions, five tracks, four widths, cash/card/pack claims, direct and legacy pack opening, audience regression, guest/retry/unavailable/completed states.');
} finally {await browser?.close();await server.close();}
