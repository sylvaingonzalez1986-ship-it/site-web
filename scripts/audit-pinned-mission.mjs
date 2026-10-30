/** Real mission controls and pinned objective, isolated from every live game API. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/pinned-mission-lot4'), port=3493;
const modules={
 'objective-entry': `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
 import {KqMissionCenter} from '/src/components/placard/KqMissionCenter';
 import {KqMissionFocusProvider,KqPinnedMission} from '/src/components/placard/KqPinnedMission';
 import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
 import {KQ_MISSION_DEFINITIONS as definitions} from '/src/lib/kanab-quest-missions';
 import {getKqMissionTarget} from '/src/lib/kanab-quest-pinned-mission';
 import retro from '/src/components/contest/ArenaRetro.module.css';import lobbyStyles from '/src/components/placard/KqPlacardLobby.module.css';
 const params=new URLSearchParams(location.search),owner=params.get('owner')||'alice';
 window.__gets=0;window.__writes=[];window.__routes=[];window.__mode='progress';window.__progress=0;
 const missions=()=>definitions.map(d=>{const claimed=d.code==='first-prepared'||(d.code==='first-curing'&&window.__mode==='claimed');const unlocked=d.step===1||d.code==='first-curing';return {...d,rewardAvailable:true,cardCount:0,claimed,unlocked,claimable:d.code==='first-curing'&&window.__mode==='claimable',progress:d.code==='first-curing'?window.__progress:0,entitlementId:null,packAvailable:false};});
 const request=async(url,init={})=>{if(init.method&&init.method!=='GET'){window.__writes.push([String(url),init.method]);return Response.json({error:'No writes allowed in this audit'},{status:403});}
 if(String(url)==='/api/account/missions')return Response.json({missions:[],pendingRewards:[]});
 if(String(url)!=='/api/arena/placard/missions')throw new Error('Unexpected API '+url);
 window.__gets++;return window.__mode==='error'?Response.json({error:'Unavailable'},{status:503}):Response.json({missions:missions(),collectionActive:true});};
 const api=createKqTutorialApi(request);api.isTutorial=params.get('tutorial')==='1';window.__refresh=()=>api.notify('kq:missions-updated');
 if(params.get('blocked')==='1')Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage disabled');}});
 function App(){const [view,setView]=useState('quartier');window.__view=setView;const open=(code)=>window.__routes.push(getKqMissionTarget(code));return React.createElement(KqTutorialApiProvider,{api},React.createElement(KqMissionFocusProvider,{ownerId:owner},React.createElement('div',{className:retro.surface},React.createElement('nav',{'aria-label':'Navigation de recette'},React.createElement('button',{onClick:()=>setView('quartier')},'Quartier'),React.createElement('button',{onClick:()=>setView('missions')},'Missions')),view==='missions'?React.createElement(KqMissionCenter,{onOpen:(view,code)=>code&&open(code)}):React.createElement('main',{className:lobbyStyles.lobby},React.createElement('h1',null,'Mon quartier'),React.createElement(KqPinnedMission,{onChoose:()=>setView('missions'),onContinue:open})))));}
 createRoot(document.getElementById('root')).render(React.createElement(App));`,
 '@/components/navigation/NavigationLink': `import React from 'react';export default function Link(props){return React.createElement('a',props);}`,
 'mission-hud': 'export function KqPlacardHud(){return null;}',
 'next/dynamic': `import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(async()=>({default:await loader()}));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props));}`,
 'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
 'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
 'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
};
const server=await createServer({root,cacheDir:resolve(output,'vite-cache'),configFile:false,envDir:false,publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'objective-audit',enforce:'pre',resolveId(id){if(id.endsWith('/components/navigation/NavigationLink'))return '\0@/components/navigation/NavigationLink';if(id.endsWith('/KqPlacardHud'))return '\0mission-hud';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Objectif épinglé</title><style>@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:AuditBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}body{margin:0;background:#fff1d6}nav[aria-label="Navigation de recette"]{display:flex;gap:16px;padding:8px}nav[aria-label="Navigation de recette"] button{min-height:44px}</style><div id="root"></div><script type="module" src="/@id/__x00__objective-entry"></script></html>');});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser;
try {
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage(),errors=[],observations=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port===String(port)))void r.continue();else void r.abort();});
 const goto=async(query='')=>{await page.goto('http://127.0.0.1:'+port+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('main');};
 const clickText=async(text)=>page.$$eval('button',(buttons,text)=>{const button=buttons.find(b=>b.textContent===text);if(!button)throw new Error('Missing button '+text);button.click();},text);
 const check=async(name,width)=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name+' overflow');assert.deepEqual(await page.evaluate(()=>window.__writes),[]);observations.push({name,width});};
 const shot=async(name)=>{await page.evaluate(async()=>{await Promise.allSettled([...document.images].map(img=>img.decode()));});await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
 const pin='[data-pin-mission="first-curing"]', focus='[data-pinned-mission="first-curing"]';
 for(const width of [320,390,1440]) {
  await page.setViewport({width,height:900});await goto('owner=width-'+width);
  await page.waitForFunction(()=>document.body.innerText.includes('Choisir un objectif'));assert.equal(await page.evaluate(()=>window.__gets),0,'Unpinned Quartier makes no mission request');
  await clickText('Choisir un objectif');await page.waitForSelector(pin);await check('missions-before-pin',width);
  await page.focus(pin);await page.keyboard.press('Enter');await page.waitForFunction(selector=>document.querySelector(selector).getAttribute('aria-pressed')==='true',{},pin);
  await shot('mission-selected-'+width);await clickText('Quartier');await page.waitForSelector(focus+' [role="meter"]');
  assert.equal(await page.$eval(focus+' [role="meter"]',e=>e.getAttribute('aria-valuenow')),'0');
  assert.equal(await page.$$eval(focus+' button',items=>items.every(e=>e.getBoundingClientRect().height>=44&&parseFloat(getComputedStyle(e).fontSize)>=14)),true,'Readable target size');
  await check('pinned-zero',width);await shot('quartier-pinned-'+width);
  await page.$$eval('[data-pinned-mission] button',buttons=>buttons.at(-1).click());assert.deepEqual(await page.evaluate(()=>window.__routes.at(-1)),{view:'harvests',options:{harvestSection:'storage'}});
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector(focus+' [role="meter"]');
  await page.evaluate(()=>{window.__progress=1;window.__mode='claimable';window.__refresh();});await page.waitForFunction(()=>document.body.innerText.includes('Voir ma récompense'));
  await check('claimable',width);await clickText('Voir ma récompense');await page.waitForSelector(pin);await check('reward-navigation',width);
  await clickText('Quartier');await page.waitForSelector(focus+' [role="meter"]');
  await page.evaluate(()=>{window.__mode='claimed';window.__refresh();});await page.waitForFunction(()=>document.body.innerText.includes('récompense récupérée'));await check('claimed',width);
  await page.evaluate(()=>{window.__mode='error';window.__refresh();});await page.waitForFunction(()=>document.body.innerText.includes('Progression indisponible'));
  assert.equal(await page.$$(focus+' [role="meter"]').then(items=>items.length),0,'Unavailable progress never shows zero');await check('unavailable',width);await shot('unavailable-'+width);
  await page.evaluate(()=>{window.__mode='progress';window.__progress=0;});await clickText('Réessayer');await page.waitForSelector(focus+' [role="meter"]');await check('retry',width);
  await page.focus('[aria-label="Retirer l’objectif épinglé"]');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.textContent.includes('Choisir un objectif'));await check('remove-keyboard-focus',width);
 }
 await goto('owner=alice');await clickText('Choisir un objectif');await page.waitForSelector(pin);await page.click(pin);await clickText('Quartier');await page.waitForSelector(focus);
 await goto('owner=bob');await page.waitForFunction(()=>document.body.innerText.includes('Choisir un objectif'));assert.equal(await page.$$(focus).then(items=>items.length),0);await check('separate-account',1440);
 await goto('owner=alice');await page.waitForSelector(focus+' [role="meter"]');await check('account-choice-restored',1440);
 await clickText('Missions');await page.waitForSelector('[data-pin-mission="first-harvest"]');await page.click('[data-pin-mission="first-harvest"]');await clickText('Quartier');await page.waitForSelector('[data-pinned-mission="first-harvest"] [role="meter"]');assert.equal(await page.$$(focus).then(items=>items.length),0);await check('replace-choice',1440);
 await goto('owner=alice&tutorial=1');assert.equal(await page.$$('[data-pinned-mission]').then(items=>items.length),0);await clickText('Missions');await page.waitForSelector('section[aria-label="Culture & Buddies"]');assert.equal(await page.$$('[data-pin-mission]').then(items=>items.length),0);await check('tutorial-isolated',1440);
 await goto('owner=blocked&blocked=1');await clickText('Choisir un objectif');await page.waitForSelector(pin);await page.click(pin);await clickText('Quartier');await page.waitForSelector(focus+' [role="meter"]');assert.equal(await page.$eval(focus,e=>e.textContent.includes('ne peut pas sauvegarder')),true);await check('storage-blocked',1440);
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,observations,errors,noGameMutations:true},null,2));
 console.log('Pinned objective passed: '+observations.length+' observations at 320/390/1440 px, keyboard, account isolation, tutorial isolation, unavailable data, retry and zero game writes.');
} finally {
 const closing=setTimeout(()=>{browser?.process()?.kill();server.httpServer?.closeAllConnections();},5000);
 try {await browser?.close();server.httpServer?.closeAllConnections();await server.close();} finally {clearTimeout(closing);}
}
