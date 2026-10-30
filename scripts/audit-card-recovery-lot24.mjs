/** Real player UI and card engine; isolated local API. No live requests or writes. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const before = process.argv.includes("--before");
const captureOnly = process.argv.includes("--capture-recovered");
const completedOnly = process.argv.includes("--completed-elsewhere");
const root = process.cwd(), output = resolve(root, `output/clarity-lot24/${before ? "before" : "after"}`);
const port = Number(process.env.CARD_RECOVERY_LOT24_PORT ?? 3594), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
import {startKqGame,KQ_ACTIVE_CARDS,KQ_CARDS,playKqCard,rollKqDice,resolveKqStage,advanceKqStage} from '/src/lib/kanab-quest-game';
import {createKqCareState,KQ_BASIC_CARE_PRICE_CENTS,isKqCareReplacedCard} from '/src/lib/kanab-quest-care';
import {encodeKqSave,parseKqGameSave} from '/src/lib/kanab-quest-persistence';
import {createKqFlower} from '/src/lib/kanab-quest-battle';
import retro from '/src/components/contest/ArenaRetro.module.css';
const scenario=new URLSearchParams(location.search).get('scenario')||'lost-response';
const code='BOTTE-021',runId='local-lot24-run';
const candidates=KQ_ACTIVE_CARDS.filter(card=>!['pbi','substrate'].includes(card.category)&&card.rarity!=='epic'&&!isKqCareReplacedCard(card.code)).map(card=>card.code);
const deck=scenario==='two-copies'?[code,code,...candidates.filter(value=>value!==code).slice(0,8)]:[code,...candidates.filter(value=>value!==code).slice(0,9)];
let inventory=Object.fromEntries(KQ_CARDS.map(card=>[card.code,3]));
const started=startKqGame(91,{rulesVersion:3,deckCodes:deck,varietyCode:'HH2026-020',startedAt:'2026-10-30T10:00:00Z'});
const grown=advanceKqStage(resolveKqStage({...started,situationCodes:['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006'],phase:'rolled',dice:[6,6,6]}));
let game={...grown,
 situationCodes:['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006'],stageIndex:1,phase:'rolled',dice:[2,4,5],
 pressure:0,handCodes:deck,care:{...createKqCareState(),vitality:60},xp:10,quality:4};
if(!parseKqGameSave(encodeKqSave(game)))throw new Error('Invalid local card recovery fixture');
let receipt=null,submitted=false,flowers=[];
const run=()=>({runId,zoneId:null,state:game,status:game.phase==='complete'?'complete':'active',buddieCode:game.varietyCode,startedAt:game.startedAt,updatedAt:game.phase==='complete'?'2026-10-30T10:05:00Z':receipt?'2026-10-30T10:01:00Z':'2026-10-30T10:00:00Z',burnReceipts:receipt?[receipt]:[]});
const session=()=>{const selected=run();if(submitted&&window.__readMode==='wrong-run')selected.runId='another-local-run';return {activeRun:selected,activeRuns:[selected],flowers:[],battles:[],progress:null,warnings:[]}};
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const storage={persistent:memory(),session:memory()};storage.persistent.setItem('kq-dice-direct-result','1');
window.__calls=[];window.__initialGame=JSON.stringify(game);window.__game=game;window.__inventory=inventory;window.__targetCard=code;
window.__expectedPlayed=playKqCard(game,code);window.__readMode=scenario;window.__allowRead=false;window.__recoveryRunReads=0;window.__holdBootstrap=false;
window.__completeElsewhere=()=>{
 for(let step=0;step<20&&game.phase!=='complete';step++){
  if(game.phase==='prepare')game=rollKqDice(game);
  else if(game.phase==='rolled')game=resolveKqStage({...game,dice:[6,6,6]});
  else if(game.phase==='resolved')game=advanceKqStage(game);
 }
 if(game.phase!=='complete'||game.cultureDead||!parseKqGameSave(encodeKqSave(game)))throw new Error('Completion fixture must be a valid harvested culture');
 const flower=createKqFlower(game);flowers=[{...flower,id:'local-lot24-harvest',runId,varietyCode:game.varietyCode,varietyName:game.varietyName,quality:game.quality,combos:game.combos,queuedAt:null,lockedAt:null,burnedAt:null}];
 window.__game=game;window.__flowers=flowers;
};
const request=async(input,init)=>{
 const url=new URL(String(input),location.origin),path=url.pathname,method=init?.method??'GET';
 const body=init?.body?JSON.parse(init.body):null;window.__calls.push({path,search:url.search,method,body,afterSubmission:submitted});
 if(method!=='GET'){
  if(path.endsWith('/cards')){
   submitted=true;await new Promise(resolve=>setTimeout(resolve,scenario==='pending-close'?950:200));
   if(scenario==='rejected')return Response.json({error:'Cette carte n’a pas été jouée : confirmation refusée.'},{status:409});
   const next=playKqCard(game,body.cardCode);if(next===game)return Response.json({error:'Carte déjà jouée'},{status:409});
   game=next;inventory={...inventory,[body.cardCode]:inventory[body.cardCode]-1};window.__game=game;window.__inventory=inventory;
   receipt={id:'local-lot24-burn-receipt',cardInstanceId:'local-instance',cardCode:body.cardCode,runId,stageIndex:game.stageIndex,useKind:'support',burnedAt:'2026-10-30T10:01:00Z'};
   if(scenario==='success')return Response.json({state:game,burnReceipt:receipt});
   throw new TypeError('Connexion interrompue après la demande.');
  }
  throw new Error('Unexpected local mutation: '+method+' '+path);
 }
 if(submitted&&['/bootstrap','/runs','/session','/collection','/cards'].some(suffix=>path.endsWith(suffix))){
  if(window.__readMode==='read-failure')return Response.json({error:'Vérification indisponible. Réessaie.'},{status:503});
  if(window.__readMode==='read-slow')while(!window.__allowRead)await new Promise(resolve=>setTimeout(resolve,20));
 }
 if(path.endsWith('/bootstrap')){
  while(window.__holdBootstrap)await new Promise(resolve=>setTimeout(resolve,20));
  const collection=submitted&&window.__readMode==='incomplete-inventory'?{ownerFound:true,collectionActive:true,cards:[]}:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]};
  return Response.json({collection,ownedBuddieCodes:[game.varietyCode],heritage:{cards:[]},playerSession:session(),warnings:[]});
 }
 if(path.endsWith('/runs')||path.endsWith('/session')){
  const payload=session();
  if(submitted&&path.endsWith('/runs')){
   window.__recoveryRunReads++;
   if(window.__readMode==='changed-during-read'&&window.__recoveryRunReads%2===0)payload.activeRun={...payload.activeRun,updatedAt:'2026-10-30T10:02:00Z',state:{...game,xp:game.xp+1}};
  }
  return Response.json(payload);
 }
 if(path.endsWith('/collection')||path.endsWith('/cards')){
  if(submitted&&window.__readMode==='incomplete-inventory')return Response.json({collection:{ownerFound:true,collectionActive:true,cards:[]}});
  if(submitted&&window.__readMode==='missing-card'){const incomplete={...inventory};delete incomplete[code];return Response.json({collection:{ownerFound:true,collectionActive:true,inventory:incomplete,availableInventory:incomplete,cards:[]}});}
  return Response.json({collection:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]}});
 }
 if(path.endsWith('/rankings'))return Response.json({entries:[]});
 if(path.endsWith('/flowers'))return Response.json({flowers});
 if(path.endsWith('/me'))return Response.json({progress:null});
 if(path.endsWith('/equipment'))return Response.json({strength:null,routePlan:null});
 if(path.endsWith('/care'))return Response.json({cashCents:12000,basicCarePriceCents:KQ_BASIC_CARE_PRICE_CENTS,inventory:[],catalog:[]});
 return Response.json({error:'Outside local fixture'},{status:404});
};
const api=createKqTutorialApi(request);api.isTutorial=false;
window.__notify=api.notify;
createRoot(document.getElementById('root')).render(<div className={retro.surface}><KqTutorialApiProvider api={api}><KanabQuestDicePrototype apiScope="player" initialRunId={runId} viewMode="game" showWarehouseNavigation={false} showAdminOperations={false} isolatedStorage={storage}/></KqTutorialApiProvider></div>);
`;
const modules = {
 entry,
 "next/image": `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 "next/link": `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
 "next/navigation": `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`,
 "next/dynamic": `import React from 'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>;}`,
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
 optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react','@3d-dice/dice-box-threejs']},
 resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},
 plugins:[{name:'card-recovery-lot24',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},
 async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},
 configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmation de carte · recette locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);})}}],
 server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
const results=[],errors=[],external=[],consoleErrors=[];
const report={passed:false,mode:before?'before':'after',results,errors,external,consoleErrors,backend:'Real player UI and card engine; isolated local API, no live writes.'};
let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin&&url.pathname==='/favicon.ico')void request.respond({status:204});else if(['data:','blob:'].includes(url.protocol)||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{external.push(request.url());void request.abort();}});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 async function enter(selector){await page.$eval(selector,e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await page.focus(selector);await page.keyboard.press('Enter');await frames()}
 async function open(scenario='lost-response'){
  await page.goto(`${origin}/?scenario=${scenario}`,{waitUntil:'networkidle0'});await page.waitForSelector('[data-culture-play][data-player-mode="true"]');await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.$('[data-playable-lesson]'),null,'Actual player branch mounted');
  await enter('[data-culture-hand] > summary');await enter('[data-hand-filter="all"]');
  const code=await page.evaluate(()=>window.__targetCard);await enter(`[data-action-card="${code}"]`);await page.waitForSelector('[data-culture-card-cost]',{visible:true});await frames();return code;
 }
 async function shot(name){await page.evaluate(()=>Promise.allSettled([...document.images].map(image=>image.decode())));await page.screenshot({path:resolve(output,`${name}.png`)});}
 async function layout(){return page.evaluate(()=>({pageOverflow:document.documentElement.scrollWidth>innerWidth+1,dialogs:[...document.querySelectorAll('[data-app-dialog]')].map(d=>({dialogOverflow:d.scrollWidth>d.clientWidth+1,bodyOverflow:d.querySelector('[data-app-dialog-body]').scrollWidth>d.querySelector('[data-app-dialog-body]').clientWidth+1}))}));}
 async function transaction(){return page.evaluate(()=>({posts:window.__calls.filter(call=>call.method==='POST'),inventory:window.__inventory[window.__targetCard],state:window.__game,expected:window.__expectedPlayed}));}
 async function consumedOnce(){const t=await transaction();assert.equal(t.posts.length,1,'Recovery never replays a write');if(!before)assert.equal(t.posts[0].body.expectedStageIndex,1,'The play identifies the stage originally confirmed');assert.equal(t.inventory,2,'Only one copy consumed');assert.deepEqual(t.state,t.expected,'Effect equals the real engine');}
 async function recoverySelector(){return await page.$('[data-app-dialog] [data-card-recovery-refresh]')?'[data-app-dialog] [data-card-recovery-refresh]':'[data-card-recovery-refresh]';}
 async function waitUncertain(){await page.waitForSelector('[data-card-recovery-refresh]');await page.waitForFunction(()=>[...document.querySelectorAll('[data-card-recovery-refresh]')].some(e=>!e.disabled));await frames();}
 async function recover(){const selector=await recoverySelector();await enter(selector);}
 async function waitRecovered(){await page.waitForSelector('[data-card-recovery-refresh]',{hidden:true});await frames();}
 async function actionsLocked(){
  assert.equal(await page.$eval('[data-culture-primary-action]',e=>e.disabled),true,'The next turn cannot use stale state');
  assert.equal(await page.$eval('[data-hand-redraw]',e=>e.disabled),true,'Hand changes cannot consume a stale window');
  assert.equal(await page.$$eval('[data-care-basic]',nodes=>nodes.every(e=>e.disabled)),true,'Basic care cannot mutate uncertain state');
  const confirm=await page.$('[data-culture-confirm-card]');if(confirm)assert.equal(await confirm.evaluate(e=>e.disabled),true,'An ambiguous card cannot be submitted again');
  if(await page.$('[data-app-dialog]')){
   assert.equal(await page.$('[data-card-play-preview]'),null,'Unverified state never drives a fresh card forecast');
   assert.ok(!(await page.$eval('[data-culture-card-cost]',e=>e.textContent)).includes('Disponibles : 10 XP · 3 copies'),'Old balances are not presented as confirmed');
  }
  await page.$$eval('[data-culture-primary-action],[data-hand-redraw],[data-care-basic],[data-culture-confirm-card]',nodes=>nodes.forEach(e=>e.click()));
  assert.equal(await page.evaluate(()=>window.__calls.filter(call=>call.method==='POST').length),1,'Disabled actions send no writes');
 }
 async function noOverflow(){const metric=await layout();assert.equal(metric.pageOverflow,false);assert.ok(metric.dialogs.every(d=>!d.dialogOverflow&&!d.bodyOverflow));return metric;}
 async function assertAppliedUi(){
  assert.match(await page.$eval('[data-culture-quality]',e=>e.previousElementSibling.textContent),/8 XP/,'Visible XP reflects the verified state');
  assert.match(await page.$eval('[data-card-choice-hint]',e=>e.textContent),/réaction est déjà jouée/,'Actual reaction lock is restored');
  assert.equal(await page.$eval('[data-culture-primary-action]',e=>e.disabled),false,'Turn continuation unlocks after verification');
 }
 if(completedOnly){
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await open('completed-elsewhere');await enter('[data-culture-confirm-card]');await waitUncertain();
  await page.evaluate(()=>window.__completeElsewhere());await recover();await waitRecovered();
  await page.waitForSelector('main[data-culture-phase="complete"]');await page.waitForSelector('[data-harvest-moment][data-outcome="harvest"]');
  await page.waitForSelector('[data-app-dialog]',{hidden:true});await page.waitForFunction(()=>!window.history.state?.lcbOverlays?.length);await frames();
  const actual=await transaction();assert.equal(actual.posts.length,1);assert.equal(actual.inventory,2);assert.equal(actual.state.phase,'complete');assert.equal(actual.state.usedCards.filter(code=>code==='BOTTE-021').length,1);
  assert.equal(await page.$('[data-culture-primary-action]'),null,'The recovered completed culture no longer offers stale turn controls');
  assert.ok(await page.evaluate(()=>window.__calls.some(call=>call.afterSubmission&&call.method==='GET'&&call.path.endsWith('/flowers'))),'Completion refreshes the authoritative harvested flowers');
  assert.match(await page.$eval('[data-harvest-moment]',e=>e.textContent),/Fleur d’Arène est enregistrée/,'The completed harvest uses the official flower snapshot');
  assert.equal(await page.$eval('[data-card-recovery-status]',e=>e===document.activeElement),true,'Completed recovery focuses the result in the final report');
  await noOverflow();await shot('completed-elsewhere-390');
  results.push({scenario:'culture completed in another tab before verification',oneWrite:true,oneCopyConsumed:true,harvestConfirmed:true,phase:'complete',focusedResult:true});
 }else if(captureOnly){
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await open();await enter('[data-culture-confirm-card]');await waitUncertain();await recover();await waitRecovered();
  await page.waitForSelector('[data-app-dialog]',{hidden:true});await page.waitForFunction(()=>!window.history.state?.lcbOverlays?.length);await frames();
  await consumedOnce();await assertAppliedUi();await noOverflow();await shot('recovered-390');
  results.push({scenario:'mobile verified recovery capture',width:390,height:844,oneWrite:true,copies:2,xp:8});
 }else if(before){
  for(const [width,height] of [[320,844],[390,844],[1440,900]]){
   await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});const code=await open();
   await enter('[data-culture-confirm-card]');await page.waitForSelector('[data-card-choice-notice]');await consumedOnce();
   const staleCost=await page.$eval('[data-culture-card-cost]',e=>e.textContent),confirmEnabled=await page.$eval('[data-culture-confirm-card]',e=>!e.disabled);
   assert.ok(staleCost.includes('3 copies'),'Baseline still displays three copies after actual burn');assert.equal(confirmEnabled,true,'Baseline permits an ambiguous second confirmation');
   await shot(`lost-response-${width}`);await page.keyboard.press('Escape');await page.waitForSelector('[data-app-dialog]',{hidden:true});
   const turnEnabled=await page.$eval('[data-culture-primary-action]',e=>!e.disabled);assert.equal(turnEnabled,true);
   await enter(`[data-action-card="${code}"]`);assert.equal(await page.$eval('[data-culture-confirm-card]',e=>!e.disabled),true);
   const metric=await layout();assert.equal(metric.pageOverflow,false);results.push({scenario:'lost response leaves stale copies and actions available',width,height,staleCost,confirmEnabled,turnEnabled,serverCopies:2,...metric});
  }
 }else{
  for(const [width,height] of [[320,844],[390,844],[1440,900],[320,422]]){
   await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});const code=await open();
   await enter('[data-culture-confirm-card]');await waitUncertain();await consumedOnce();await actionsLocked();
   const selector=await recoverySelector(),metric=await page.$eval(selector,e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{top:b.top,bottom:b.bottom,height:b.height,visible:b.top>=0&&b.bottom<=innerHeight,uncovered:hit===e||e.contains(hit)}});
   assert.ok(metric.visible&&metric.uncovered,'Recovery stays available in the card dialog');assert.ok(metric.height>=44,'Recovery touch target is at least 44 px');await noOverflow();await shot(`lost-response-${width}x${height}`);
   await page.keyboard.press('Escape');await page.waitForSelector('[data-app-dialog]',{hidden:true});await waitUncertain();await actionsLocked();
   await page.waitForFunction(()=>!window.history.state?.lcbOverlays?.length);await frames();
   assert.equal(await page.$eval('[data-card-recovery-status]',e=>e===document.activeElement),true,'Closing preserves keyboard focus on the global recovery');
   const globalRecovery=await page.$eval('[data-card-recovery] [data-card-recovery-refresh]',e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{top:b.top,bottom:b.bottom,visible:b.top>=0&&b.bottom<=innerHeight,uncovered:hit===e||e.contains(hit)}});
   if(width===320&&height===844)await shot('closed-recovery-320');
   assert.ok(globalRecovery.visible&&globalRecovery.uncovered,'Closing the card leaves its recovery command visible after history restores scroll');
   await enter(`[data-action-card="${code}"]`);await waitUncertain();await actionsLocked();
   await recover();await waitRecovered();await page.waitForSelector('[data-app-dialog]',{hidden:true});await consumedOnce();await assertAppliedUi();await noOverflow();
   assert.equal(await page.$eval('[data-card-recovery-status]',e=>e===document.activeElement),true,'Verified result receives keyboard focus after the dialog closes');
   const reads=await page.evaluate(()=>window.__calls.filter(call=>call.afterSubmission&&call.method==='GET'));
   assert.ok(reads.length>0,'The recovery uses reads');assert.ok(reads.some(call=>call.path.endsWith('/runs')&&new URLSearchParams(call.search).get('runId')==='local-lot24-run'),'Recovery explicitly requests the affected culture');
   results.push({scenario:'lost response, closure, reopening and keyboard recovery',width,height,recovery:metric,globalRecovery,reads:reads.map(call=>call.path+call.search),oneWrite:true,oneCopyConsumed:true,verifiedUiXp:8});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await open('inventory-refresh');
  await page.evaluate(()=>{window.__holdBootstrap=true;window.__notify('kq:collection-updated')});
  await page.waitForSelector('[data-culture-confirm-card][disabled]');
  assert.match(await page.$eval('[data-card-blocked-reason]',e=>e.textContent),/album|inventaire|copies/i,'An in-flight album refresh explains why confirmation waits');
  await page.$eval('[data-culture-confirm-card]',e=>e.click());
  assert.equal(await page.evaluate(()=>window.__calls.filter(call=>call.method==='POST').length),0,'A stale album cannot trigger a card play');
  assert.equal(await page.$('[data-card-play-preview]'),null,'An unverified album cannot drive the preview');
  await page.evaluate(()=>{window.__holdBootstrap=false});
  await page.waitForSelector('[data-culture-confirm-card]:not([disabled])');
  assert.match(await page.$eval('[data-culture-card-cost]',e=>e.textContent),/10 XP · 3 copies/);
  assert.equal(await page.evaluate(()=>window.__calls.filter(call=>call.method==='POST').length),0,'Revalidating inventory does not submit the card');
  results.push({scenario:'album refreshed while choosing a card',blockedWhileUnverified:true,enabledAfterRead:true,noWrite:true});
  await open('rejected');await enter('[data-culture-confirm-card]');await waitUncertain();await actionsLocked();
  assert.equal(await page.evaluate(()=>window.__inventory[window.__targetCard]),3);
  await recover();await waitRecovered();
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__game)===window.__initialGame),true,'Rejection leaves actual state unchanged');
  if(!await page.$('[data-culture-confirm-card]'))await enter('[data-action-card="BOTTE-021"]');
  assert.equal(await page.$eval('[data-culture-confirm-card]',e=>e.disabled),false,'Unplayed card can be chosen again only after verified read');
  assert.match(await page.$eval('[data-culture-card-cost]',e=>e.textContent),/10 XP · 3 copies/);
  assert.equal(await page.evaluate(()=>window.__calls.filter(call=>call.method==='POST').length),1,'Verification does not resubmit a rejected play');
  results.push({scenario:'rejected before commit',oneWrite:true,copies:3,xp:10,confirmationAvailableOnlyAfterRead:true});

  for(const scenario of ['read-failure','incomplete-inventory','missing-card','wrong-run','changed-during-read']){
   await open(scenario);await enter('[data-culture-confirm-card]');await waitUncertain();await recover();await waitUncertain();
   await actionsLocked();await consumedOnce();
   assert.match(await page.$eval('[data-culture-quality]',e=>e.previousElementSibling.textContent),/XP à vérifier/,'An incomplete verification does not announce an authoritative balance');
   const status='[data-app-dialog] [data-card-choice-notice]';
   await page.waitForSelector(status);assert.equal(await page.$eval(status,e=>e===document.activeElement||e.contains(document.activeElement)),true,'Failed verification receives useful keyboard focus');
   await noOverflow();await shot(`${scenario}-390`);
   await page.evaluate(()=>{window.__readMode='lost-response'});await recover();await waitRecovered();await page.waitForSelector('[data-app-dialog]',{hidden:true});await consumedOnce();await assertAppliedUi();
   results.push({scenario,rejectedIncompleteRead:true,actionsStayedLocked:true,focusOnReadError:true,retryUsesOnlyReads:true});
  }
  await open('read-slow');await enter('[data-culture-confirm-card]');await waitUncertain();await recover();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-card-recovery-refresh]')].every(e=>e.disabled));
  const readCount=await page.evaluate(()=>window.__calls.filter(call=>call.afterSubmission&&call.method==='GET').length);
  await page.$$eval('[data-card-recovery-refresh]',nodes=>nodes.forEach(e=>e.click()));await frames();
  assert.equal(await page.evaluate(()=>window.__calls.filter(call=>call.afterSubmission&&call.method==='GET').length),readCount,'Double click cannot start another verification');
  await page.keyboard.press('Escape');await page.waitForSelector('[data-app-dialog]',{hidden:true});await actionsLocked();
  await page.evaluate(()=>{window.__allowRead=true});await waitRecovered();await consumedOnce();await assertAppliedUi();
  results.push({scenario:'slow verification closed in flight',singleReadBatch:true,noReplay:true,verifiedResultRetained:true});

  await open('pending-close');await enter('[data-culture-confirm-card]');
  await page.waitForSelector('[data-culture-confirm-card][aria-busy="true"]');await page.keyboard.press('Escape');await page.waitForSelector('[data-app-dialog]',{hidden:true});
  await waitUncertain();await actionsLocked();await consumedOnce();await recover();await waitRecovered();await assertAppliedUi();
  results.push({scenario:'dialog closed before lost response',globalRecoveryRemainsAvailable:true,oneCopyConsumed:true});

  await open('two-copies');await enter('[data-culture-confirm-card]');await waitUncertain();
  const touchSelector=await recoverySelector(),point=await page.$eval(touchSelector,e=>{const b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}});
  await page.touchscreen.tap(point.x,point.y);await waitRecovered();await page.waitForSelector('[data-app-dialog]',{hidden:true});await consumedOnce();
  await enter('[data-action-card="BOTTE-021"]');assert.equal(await page.$eval('[data-culture-confirm-card]',e=>e.disabled),true);
  assert.match(await page.$eval('[data-culture-card-cost]',e=>e.textContent),/8 XP · 2 copies/,'Remaining copies and XP come from the authoritative recovery');
  results.push({scenario:'second prepared copy remains after one burn',copies:2,xp:8,reactionCannotRepeat:true});

  await open('success');await enter('[data-culture-confirm-card]');await page.waitForSelector('[data-app-dialog]',{hidden:true});await consumedOnce();await assertAppliedUi();
  assert.equal(await page.$('[data-card-recovery-refresh]'),null,'Successful confirmation does not add a recovery chore');
  results.push({scenario:'ordinary confirmation',oneWrite:true,oneCopyConsumed:true,noRecoveryPrompt:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(consoleErrors,[]);report.passed=true;
 console.log(JSON.stringify({passed:true,observations:results.length,output}));
}catch(error){report.failure=error.stack;await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});console.error(error.stack);process.exitCode=1;}
finally{await writeFile(resolve(output,completedOnly?'completed-report.json':captureOnly?'capture-report.json':'report.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
