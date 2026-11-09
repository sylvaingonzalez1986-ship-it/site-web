/** Real Défis/pack components, synthetic server state, no live game requests. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/mission-progression'),port=3654,origin=`http://127.0.0.1:${port}`;
const migration=await readFile('supabase/migrations/20261109000200_kq_mission_progression.sql','utf8');
const levelSql=migration.split('CREATE FUNCTION public.kq_mission_level_definitions()')[1].split('$$;')[0];
const levels=[...levelSql.matchAll(/\((\d+),'([^']+)'::JSONB\)/g)].map(([,level,reward])=>({code:`level-${level}`,level:Number(level),requiredXp:(Number(level)-1)*(Number(level)+2)*25,reward:JSON.parse(reward)}));
assert.equal(levels.length,19);
const modules={
 'fixture':`import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
 import{KqMissionCenter}from'/src/components/placard/KqMissionCenter';
 import{KqMissionFocusProvider}from'/src/components/placard/KqPinnedMission';
 import{KqTutorialApiProvider,createKqTutorialApi}from'/src/components/placard/KqTutorialApiContext';
 import{KQ_MISSION_DEFINITIONS as definitions}from'/src/lib/kanab-quest-missions';
 import{getKqMissionLevel}from'/src/lib/kanab-quest-mission-progression';
 import{getKqMissionTarget}from'/src/lib/kanab-quest-pinned-mission';
 import retro from'/src/components/contest/ArenaRetro.module.css';
 const params=new URLSearchParams(location.search),mode=params.get('mode')||'ready',levels=${JSON.stringify(levels)};
 const claimed=new Set(mode==='maximum'?definitions.map(d=>d.code):mode==='new'?[]:['first-harvest','trim-one']);
 if(mode==='pack'){claimed.add('three-varieties');claimed.add('staff-first-task');}
 const earned=new Set(),opened=new Set();
 window.__mode=mode;window.__gets=0;window.__writes=[];window.__routes=[];window.__notifications=[];window.__hold=false;
 const count=r=>r.kind==='cash'?0:r.kind==='pack'?r.cardCount:1;
 const offered=r=>r.kind==='buddie'?{...r,code:({common:'HH2026-020',silver:'HH2026-010',gold:'HH2026-005',epic:'HH2026-002',legendary:'HH2026-001'})[r.rarity],name:'Buddie '+r.rarity}:r;
 const snapshot=()=>{
  const xp=window.__xpOverride??definitions.filter(d=>claimed.has(d.code)).reduce((n,d)=>n+d.step*50,0);
  const rewardRows=levels.map(d=>({...d,reward:offered(d.reward),rewardAvailable:window.__mode!=='unavailable',claimed:earned.has(d.code),claimable:!earned.has(d.code)&&xp>=d.requiredXp,cardCount:count(d.reward),entitlementId:earned.has(d.code)&&d.reward.kind==='pack'?'pack-'+d.code:null,packAvailable:earned.has(d.code)&&d.reward.kind==='pack'?!opened.has(d.code):false}));
  const missions=definitions.map(d=>{const done=claimed.has(d.code),unlocked=done||!definitions.some(p=>p.track===d.track&&p.step<d.step&&!claimed.has(p.code));return {...d,xp:d.step*50,rewardAvailable:true,cardCount:count(d.reward),claimed:done,unlocked,claimable:!done&&unlocked&&d.code==='staff-first-task'&&window.__mode!=='navigation',progress:done||d.code==='staff-first-task'?d.target:0,entitlementId:null,packAvailable:false};});
  return {collectionActive:true,missions,...(window.__mode==='missing'?{}:{progression:{...getKqMissionLevel(xp),rewards:rewardRows}})};
 };
 const request=async(url,init={})=>{
  const path=String(url),method=init.method||'GET';
  if(path==='/api/account/missions')return Response.json({missions:[],pendingRewards:[]});
  if(method==='GET'&&path==='/api/arena/placard/missions'){
   window.__gets++;if(window.__mode==='error')return Response.json({error:'Connexion de recette interrompue.'},{status:503});
   const current=snapshot();if(window.__hold){window.__hold=false;return new Promise(resolve=>{window.__release=()=>resolve(Response.json(current));});}
   return Response.json(current);
  }
  const body=JSON.parse(init.body||'{}');window.__writes.push({path,method,body});
  if(path==='/api/arena/placard/missions'&&method==='POST'){
   const def=levels.find(d=>d.code===body.code)||definitions.find(d=>d.code===body.code);if(!def)throw new Error('Unknown fixture reward');
   const replayed=earned.has(def.code)||claimed.has(def.code)||window.__replay===true;
   if(def.level)earned.add(def.code);else claimed.add(def.code);
   if(window.__mode==='lost'){window.__mode='ready';throw new TypeError('Réponse perdue après confirmation serveur.');}
   await new Promise(resolve=>setTimeout(resolve,80));
   return Response.json({reward:offered(def.reward),entitlementId:def.reward.kind==='pack'?'pack-'+def.code:null,cardCount:count(def.reward),cardInstanceId:def.reward.kind==='buddie'?'card-'+def.code:null,replayed,xpAwarded:replayed||def.level?0:def.step*50});
  }
  if(path==='/api/arena/placard/boosters'&&method==='PATCH'){
   const code=body.entitlementId.replace('pack-',''),def=levels.find(d=>d.code===code);if(!earned.has(code)||!def)throw new Error('Unowned fixture pack');opened.add(code);
   if(window.__packLost){window.__packLost=false;return Response.json({error:'Réponse locale interrompue.'},{status:503});}
   return Response.json({cards:Array.from({length:def.reward.cardCount},(_,n)=>({code:'BOTTE-'+String(n+1).padStart(3,'0'),name:'Carte de recette '+(n+1),rarity:n===0?'rare':'commune'}))});
  }
  throw new Error('Unexpected fixture request '+method+' '+path);
 };
 const api=createKqTutorialApi(request);api.isTutorial=false;window.__notify=()=>api.notify('focus');window.__snapshot=snapshot;
 const notify=api.notify.bind(api);api.notify=name=>{window.__notifications.push(name);notify(name);};
 createRoot(document.getElementById('root')).render(React.createElement(KqTutorialApiProvider,{api},React.createElement(KqMissionFocusProvider,{ownerId:'browser-fixture'},React.createElement('div',{className:retro.surface+' '+retro.shell},React.createElement(KqMissionCenter,{onOpen:(view,code)=>window.__routes.push({view,code,target:code?getKqMissionTarget(code):{view}})})))));`,
 'next/dynamic':`import React from'react';export default function dynamic(loader,options={}){const C=React.lazy(async()=>({default:await loader()}));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props));}`,
 'next/image':`import React from'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
 'link':`import React from'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
 'hud':'export function KqPlacardHud(){return null;}',
 'next/navigation':`export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server=await createServer({configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'mission-progression-fixture',enforce:'pre',resolveId(id){if(id.endsWith('/components/navigation/NavigationLink')||id==='next/link')return '\0link';if(id.endsWith('/KqPlacardHud'))return '\0hud';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette progression</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>`);});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser,page;
const report={passed:false,checks:[],errors:[],remote:[],screenshots:[]};
const check=(name,width,extra={})=>report.checks.push({name,width,...extra});
async function click(selector){const element=await page.waitForSelector(selector,{visible:true});await element.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await element.click();await element.dispose();}
async function clean(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow');}
async function shot(name){await page.evaluate(async()=>{await Promise.allSettled([...document.images].map(img=>img.decode()));});await clean();await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');if(name.startsWith('overview-')){await page.screenshot({path:resolve(output,name+'-viewport.png')});report.screenshots.push(name+'-viewport.png');}}
async function visit(mode,width){await page.setViewport({width,height:900});await page.goto(origin+'/?mode='+mode,{waitUntil:'networkidle0'});await page.waitForSelector('[data-mission-summary]');await page.evaluate(()=>document.fonts.ready);}
async function ladder(){await click('[data-mission-progression] details > summary');await page.waitForSelector('[data-mission-progression] details[open]');}
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 page.on('pageerror',error=>report.errors.push(error.message));await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||url.protocol==='blob:'||url.origin===origin)return void request.continue();report.remote.push(url.origin+url.pathname);return void request.abort();});
 for(const width of [320,390,1440]){
  await visit('ready',width);assert.equal(await page.$$eval('[data-mission-track]',items=>items.length),12);assert.equal(await page.$$eval('[data-mission-track] ol li',items=>items.length),72);
  assert.equal(await page.$$eval('select[aria-label="Filtrer les parcours"] option',items=>items.length),14);assert.match(await page.$eval('[data-mission-progression]',el=>el.textContent),/100 XP/);
  await shot('overview-'+width);check('72-objectives-12-tracks-and-level',width);
  for(const track of ['trim','staff','social','collection','jury','finance','prospecting']){await page.select('select[aria-label="Filtrer les parcours"]',track);assert.equal(await page.$$eval('[data-mission-track]',items=>items.length),1);assert.equal(await page.$eval('[data-mission-track]',el=>el.dataset.missionTrack),track);await clean();}
  await page.select('select[aria-label="Filtrer les parcours"]','all');check('new-sector-filters',width);
  await page.focus('[data-mission-progression] details > summary');await page.keyboard.press('Enter');assert.equal(await page.$eval('[data-mission-progression] details',el=>el.open),true);assert.equal(await page.$$eval('[data-mission-progression] details [data-level-reward]',items=>items.length),19);await clean();
  assert.deepEqual(await page.$$eval('[data-mission-progression] details [data-level-reward]',items=>items.filter(el=>el.textContent.includes('Buddie')).map(el=>Number(el.dataset.levelReward))),[2,5,10,15,20]);await shot('ladder-'+width);await page.keyboard.press('Enter');check('keyboard-ladder-five-rarities',width);
  await page.focus('[data-level-claim="level-2"]');await page.keyboard.press('Enter');await page.waitForSelector('[data-mission-receipt]');await page.waitForFunction(()=>document.querySelector('[data-mission-receipt]')?.textContent.includes('rejoint ta collection'));
  assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'H2');assert.equal(await page.evaluate(()=>window.__writes.length),1);assert.equal(await page.evaluate(()=>window.__snapshot().progression.totalXp),100);await shot('buddie-received-'+width);await (await page.$('[data-mission-receipt]')).screenshot({path:resolve(output,'buddie-receipt-'+width+'.png')});check('keyboard-level-claim-and-receipt-focus',width);
  await visit('unavailable',width);assert.equal(await page.$eval('[data-level-claim="level-2"]',el=>el.disabled),true);assert.match(await page.$eval('[data-mission-progression]',el=>el.textContent),/temporairement indisponible/);await clean();check('inactive-reward-preserves-progress',width);
  await visit('missing',width);assert.equal((await page.$$('[data-mission-progression]')).length,0);await page.waitForSelector('[data-progression-unavailable]');assert.equal((await page.$$('[data-mission-track]')).length,12);await clean();check('missing-xp-never-fabricates-level',width);
  await visit('ready',width);await page.evaluate(()=>{window.__mode='error';window.__notify();});await page.waitForSelector('[role="alert"]');await page.waitForFunction(()=>document.querySelector('[data-mission-progression]')?.textContent.includes('Dernier état connu'));assert.equal(await page.$eval('[data-level-claim="level-2"]',el=>el.disabled),true);await clean();check('stale-state-disables-claim',width);
 }
 await visit('navigation',390);
 for(const [track,view,options] of [['trim','workshop',{warehouseSection:'processing'}],['staff','staff'],['social','social'],['collection','collection'],['jury','arena'],['finance','treasury'],['prospecting','staff']]){
  await page.select('select[aria-label="Filtrer les parcours"]',track);await click('[data-mission-track] button:not([data-pin-mission])');const route=await page.evaluate(()=>window.__routes.at(-1));assert.equal(route.view,view);assert.deepEqual(route.target,{view,...(options?{options}:{})});
 }
 assert.equal(await page.evaluate(()=>window.__writes.length),0);check('seven-sector-direct-destinations-and-trim-processing-target',390);
 await visit('lost',390);await click('[data-level-claim="level-2"]');await page.waitForSelector('[role="alert"]');assert.equal(await page.evaluate(()=>window.__writes.length),1);await click('button[aria-label="Actualiser les objectifs"]');await page.waitForFunction(()=>!document.querySelector('[role="alert"]'));await ladder();assert.match(await page.$eval('details [data-level-reward="2"]',el=>el.textContent),/Récompense reçue/);assert.equal(await page.evaluate(()=>window.__writes.length),1);await shot('lost-response-recovered-390');check('lost-claim-reconciles-without-second-write',390);
 await visit('ready',390);await page.evaluate(()=>{window.__replay=true;});await page.$eval('[data-level-claim="level-2"]',el=>{el.click();el.click();});await page.waitForFunction(()=>document.querySelector('[data-mission-receipt]')?.textContent.includes('déjà été reçu'));assert.equal(await page.evaluate(()=>window.__writes.length),1);assert.equal(await page.evaluate(()=>window.__snapshot().progression.totalXp),100);check('replay-and-same-tick-double-click',390);
 await visit('ready',390);await page.evaluate(()=>{window.__hold=true;window.__notify();});await page.waitForFunction(()=>typeof window.__release==='function');await page.evaluate(()=>{window.__xpOverride=450;window.__notify();});await page.waitForFunction(()=>document.querySelector('[data-mission-progression]')?.textContent.includes('450 XP'));await page.evaluate(()=>window.__release());await new Promise(resolve=>setTimeout(resolve,150));assert.match(await page.$eval('[data-mission-progression]',el=>el.textContent),/450 XP/);check('late-snapshot-cannot-revert-level',390);
 for(const width of [320,390,1440]){
  await visit('pack',width);await ladder();await click('[data-mission-progression] details [data-level-claim="level-3"]');await page.waitForSelector('[data-mission-receipt]');await page.waitForFunction(()=>[...document.querySelectorAll('[data-mission-receipt] button')].some(el=>el.textContent.includes('Ouvrir mon pack')&&!el.disabled));
  await click('[data-mission-receipt] button');await page.waitForSelector('dialog[data-mission-pack-opening][open]');await page.waitForFunction(()=>document.querySelectorAll('[data-support-pack-reveal] article').length===3);assert.equal(await page.$eval('dialog[open]',el=>el.contains(document.activeElement)),true);await shot('level-pack-'+width);await page.keyboard.press('Escape');await page.waitForSelector('dialog[data-mission-pack-opening][open]',{hidden:true});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.equal(await page.evaluate(()=>window.__writes.filter(row=>row.method==='PATCH').length),1);check('level-pack-reveal-keyboard-and-scroll',width);
 }
 await visit('pack',390);await ladder();await click('[data-mission-progression] details [data-level-claim="level-3"]');await page.waitForFunction(()=>[...document.querySelectorAll('[data-mission-receipt] button')].some(el=>el.textContent.includes('Ouvrir mon pack')&&!el.disabled));await page.evaluate(()=>{window.__packLost=true;});await click('[data-mission-receipt] button');await page.waitForFunction(()=>document.querySelector('dialog[open] [role="alert"]')?.textContent.includes('déjà été ouvert'));assert.equal(await page.$$eval('dialog[open] button',items=>items.filter(el=>el.textContent.includes('Réessayer')).length),0);await shot('level-pack-lost-response-390');check('ambiguous-pack-opening-cannot-repeat',390);
 await visit('maximum',320);await page.waitForFunction(()=>document.querySelector('[data-mission-progression]')?.textContent.includes('Niveau maximum atteint'));await clean();await shot('level-20-320');check('maximum-level-retains-total-xp',320);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.remote,[]);report.passed=true;
}catch(error){report.failure=error.stack;await shot('failure').catch(()=>undefined);process.exitCode=1;}
finally{
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failure:report.failure,errors:report.errors,remote:report.remote,report:resolve(output,'report.json')}));
 const timeout=setTimeout(()=>{browser?.process()?.kill();server.httpServer?.closeAllConnections();},5000);try{await browser?.close();server.httpServer?.closeAllConnections();await server.close();}finally{clearTimeout(timeout);}
}
