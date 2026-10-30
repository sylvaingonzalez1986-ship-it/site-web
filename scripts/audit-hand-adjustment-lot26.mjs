/** Real player UI and card engine; isolated local API. No live requests or writes. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const before = process.argv.includes("--before");
const captureLayout = process.argv.includes("--capture-layout");
const root = process.cwd(), output = resolve(root, `output/clarity-lot26/${before ? "before" : "after"}`);
const port = Number(process.env.HAND_ADJUSTMENT_LOT26_PORT ?? 3596), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
import {startKqGame,KQ_ACTIVE_CARDS,KQ_CARDS,playKqCard,canPlayKqCard,rollKqDice,resolveKqStage,advanceKqStage,swapKqHeritageHandCard,redrawKqHand} from '/src/lib/kanab-quest-game';
import {KQ_BASIC_CARE_PRICE_CENTS,isKqCareReplacedCard} from '/src/lib/kanab-quest-care';
import {encodeKqSave,parseKqGameSave} from '/src/lib/kanab-quest-persistence';
import retro from '/src/components/contest/ArenaRetro.module.css';
const scenario=new URLSearchParams(location.search).get('scenario')||'opening';
const runId='local-lot26-run';
const candidates=KQ_ACTIVE_CARDS.filter(card=>!['pbi','substrate'].includes(card.category)&&!isKqCareReplacedCard(card.code)).map(card=>card.code);
let inventory=Object.fromEntries(KQ_CARDS.map(card=>[card.code,3]));
const deck=candidates;
let game=startKqGame(91,{rulesVersion:3,deckCodes:deck,heritageCode:scenario==='extra-redraws'?'HERITAGE-005':'HERITAGE-003',varietyCode:'HH2026-020',startedAt:'2026-10-30T10:00:00Z',startingXp:20});
if(scenario==='duplicates'){game={...game,deckCodes:[...game.deckCodes,game.handCodes[0]],handCodes:[game.handCodes[0],game.handCodes[0],...game.handCodes.slice(2)]};}
if(scenario==='identical-copies'){game={...game,deckCodes:[...game.deckCodes,game.handCodes[0]],heritageReserveCodes:[game.handCodes[0],...game.heritageReserveCodes.slice(1)]};}
const preparation=KQ_CARDS.find(card=>game.handCodes.includes(card.code)&&canPlayKqCard(game,card).allowed);
if(!preparation)throw new Error('Fixture must provide a playable preparation');
if(scenario==='prepared')game=playKqCard(game,preparation.code);
if(scenario==='rolled')game=rollKqDice(game);
if(scenario==='next-stage')game=advanceKqStage(resolveKqStage({...rollKqDice(game),dice:[6,6,6]}));
if(scenario==='exhausted'||scenario==='exhausted-next-stage')game=redrawKqHand(game);
if(scenario==='exhausted-next-stage')game=advanceKqStage(resolveKqStage({...rollKqDice(game),dice:[6,6,6]}));
if(!parseKqGameSave(encodeKqSave(game)))throw new Error('Invalid local hand fixture');
window.__calls=[];window.__game=game;window.__initialGame=structuredClone(game);window.__inventory=inventory;window.__initialInventory=structuredClone(inventory);window.__preparation=preparation.code;window.__holdAction=false;window.__allowAction=false;
window.__expectedSwap=(handIndex,reserveIndex)=>swapKqHeritageHandCard(game,handIndex,reserveIndex);
let revision=0;
const run=()=>({runId,zoneId:null,state:game,status:'active',buddieCode:game.varietyCode,startedAt:game.startedAt,updatedAt:'2026-10-30T10:00:'+String(revision).padStart(2,'0')+'Z',burnReceipts:[]});
const session=()=>({activeRun:run(),activeRuns:[run()],flowers:[],battles:[],progress:null,warnings:[]});
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const storage={persistent:memory(),session:memory()};storage.persistent.setItem('kq-dice-direct-result','1');
const request=async(input,init)=>{
 const url=new URL(String(input),location.origin),path=url.pathname,method=init?.method??'GET';const body=init?.body?JSON.parse(init.body):null;window.__calls.push({path,search:url.search,method,body});
 if(method!=='GET'){
  while(window.__holdAction&&!window.__allowAction)await new Promise(resolve=>setTimeout(resolve,20));
  if(scenario==='action-failure')return Response.json({error:'?change momentan?ment indisponible. R?essaie.'},{status:503});
  if(path.endsWith('/actions')){
   const next=body.action==='heritage-swap'?swapKqHeritageHandCard(game,body.handIndex,body.reserveIndex):body.action==='redraw'?redrawKqHand(game):body.action==='roll'?rollKqDice(game):body.action==='resolve'?resolveKqStage(game):body.action==='advance'?advanceKqStage(game):game;
   if(next===game)return Response.json({error:'Action refus?e par le moteur.'},{status:409});
   game=next;window.__game=game;revision++;return Response.json({state:game,persistedFlower:null});
  }
  if(path.endsWith('/cards')){if(scenario==='recovery')throw new TypeError('Confirmation interrompue.');game=playKqCard(game,body.cardCode);window.__game=game;inventory[body.cardCode]--;return Response.json({state:game,burnReceipt:{id:'receipt-26',cardInstanceId:'copy-26',cardCode:body.cardCode,stageIndex:game.stageIndex,useKind:'support',burnedAt:'2026-10-30T10:01:00Z'}});}
  throw new Error('Unexpected mutation '+path);
 }
 if(path.endsWith('/bootstrap'))return Response.json({collection:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]},ownedBuddieCodes:[game.varietyCode],heritage:{cards:[]},playerSession:session(),warnings:[]});
 if(path.endsWith('/runs')||path.endsWith('/session'))return Response.json(session());
 if(path.endsWith('/collection')||path.endsWith('/cards'))return Response.json({collection:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]}});
 if(path.endsWith('/rankings'))return Response.json({entries:[]});if(path.endsWith('/flowers'))return Response.json({flowers:[]});if(path.endsWith('/me'))return Response.json({progress:null});
 if(path.endsWith('/equipment'))return Response.json({strength:null,routePlan:null});if(path.endsWith('/care'))return Response.json({cashCents:12000,basicCarePriceCents:KQ_BASIC_CARE_PRICE_CENTS,inventory:[],catalog:[]});return Response.json({error:'Outside local fixture'},{status:404});
};
const api=createKqTutorialApi(request);api.isTutorial=false;window.__notify=api.notify;
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
 plugins:[{name:'hand-adjustment-lot26',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},
 async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},
 configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmation de carte · recette locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);})}}],
 server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
const results=[],errors=[],external=[],consoleErrors=[];
const report={passed:false,mode:before?'before':'after',results,errors,external,consoleErrors,backend:'Real player UI and card engine; isolated local API, no live writes.'};
let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],userDataDir:resolve(output,'chrome-profile-'+process.pid),headless:true,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin&&url.pathname==='/favicon.ico')void request.respond({status:204});else if(['data:','blob:'].includes(url.protocol)||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{external.push(request.url());void request.abort();}});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 async function enter(selector){await page.$eval(selector,e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await page.focus(selector);await page.keyboard.press('Enter');await frames()}

 async function open(scenario='opening'){
  await page.goto(origin+'/?scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector('[data-culture-play][data-player-mode="true"]');await page.evaluate(()=>document.fonts.ready);await enter('[data-culture-hand] > summary');await frames();
 }
 async function shot(name){await page.evaluate(()=>Promise.allSettled([...document.images].map(image=>image.decode())));await page.screenshot({path:resolve(output,name+'.png')});}
 async function scrollHandActions(){await page.$eval('[data-hand-redraw]',element=>element.scrollIntoView({block:'start',behavior:'instant'}));await frames();}
 async function metrics(){return page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,redrawReason:document.querySelector('[data-hand-redraw-reason]')?.textContent,hand:window.__game.handCodes,reserve:window.__game.heritageReserveCodes}));}
 if(before){
  for(const [width,height] of [[320,844],[390,844],[1440,900]]){
   await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await open();await scrollHandActions();await shot('opening-'+width);const initial=await metrics();assert.equal(initial.overflow,false);results.push({scenario:'opening',width,...initial});
   await open('prepared');await scrollHandActions();await shot('prepared-'+width);
   const proof=await page.evaluate(()=>{const section=document.querySelector('[class*="heritageHandExchange"]');return{preparationPlayed:window.__game.preparationPlayed,buttons:[...section.querySelectorAll('[class*="heritageExchangePanels"] button')].map(button=>({label:button.textContent,disabled:button.disabled})),redrawDisabled:document.querySelector('[data-hand-redraw]').disabled}});
   assert.equal(proof.preparationPlayed,true);assert.ok(proof.buttons.some(button=>!button.disabled));results.push({scenario:'preparation played but exchange offered',width,...proof});
  }
 }else{
  async function adjustment(scenario='opening',capture){
   await open(scenario);
   assert.equal(await page.$eval('[data-hand-adjustment]',element=>element.open),false,'Adjustment is secondary and initially folded');
   if(capture){
    await page.$eval('[data-hand-adjustment] > summary',element=>element.scrollIntoView({block:'center',behavior:'instant'}));await shot(capture);
    const compact=await page.$eval('[data-hand-adjustment]',element=>({width:innerWidth,height:element.getBoundingClientRect().height,text:element.querySelector('summary').textContent}));
    report.foldedMeasurements??=[];report.foldedMeasurements.push(compact);
   }
   await enter('[data-hand-adjustment] > summary');
  }
  async function posts(){return page.evaluate(()=>window.__calls.filter(call=>call.method==='POST'));}
  async function unchangedBalances(){
   const values=await page.evaluate(()=>({game:window.__game,initial:window.__initialGame,inventory:window.__inventory,initialInventory:window.__initialInventory}));
   assert.equal(values.game.xp,values.initial.xp,'An exchange or redraw spends no XP');
   assert.deepEqual(values.game.usedCards,values.initial.usedCards,'An exchange or redraw burns no copy');
   assert.deepEqual(values.inventory,values.initialInventory,'Album copies are preserved');
  }
  async function noOverflow(){
   const dimensions=await page.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth+1,adjustment:document.querySelector('[data-hand-adjustment]')?.scrollWidth>document.querySelector('[data-hand-adjustment]')?.clientWidth+1}));
   assert.equal(dimensions.page,false);assert.equal(dimensions.adjustment,false);return dimensions;
  }
  async function shortViewportControl(selector){
   const geometry=await page.$eval(selector,element=>{
    const rect=element.getBoundingClientRect(),bar=document.querySelector('[data-culture-actionbar]').getBoundingClientRect();
    return {top:rect.top,bottom:rect.bottom,barTop:bar.top,height:rect.height,hit:element.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2))};
   });
   assert.ok(geometry.top>=0&&geometry.bottom<=geometry.barTop,'The confirmation stays above the fixed turn bar after automatic focus');assert.equal(geometry.hit,true,'The confirmation receives pointer input');
   report.shortViewportControls??=[];report.shortViewportControls.push({selector,...geometry});return geometry;
  }
  async function choose(handIndex=0,reserveIndex=0){
   await enter('[data-heritage-out-index="'+handIndex+'"]');
   assert.equal((await posts()).length,0,'Selecting the outgoing card sends no mutation');
   assert.match(await page.evaluate(()=>document.activeElement?.textContent),/Choisis la carte à faire entrer/,'The next step receives keyboard focus');
   await enter('[data-heritage-in-index="'+reserveIndex+'"]');
   assert.equal((await posts()).length,0,'Selecting the incoming card sends no mutation');
   await page.waitForSelector('[data-heritage-swap-confirm]',{visible:true});
   assert.match(await page.evaluate(()=>document.activeElement?.textContent),/Sort de la main/,'The review receives keyboard focus');
  }
  async function settled(){await page.waitForFunction(()=>!document.querySelector('[data-hand-adjustment-status]')?.textContent.includes('Confirmation…'));await frames();}
  for(const [width,height] of [[320,844],[390,844],[1440,900],[320,422]]){
   await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});
   await adjustment('opening','folded-'+width+'x'+height);await page.$eval('[data-hand-adjustment] > summary',element=>element.scrollIntoView({block:'start',behavior:'instant'}));await shot('opening-'+width+'x'+height);await noOverflow();
   await choose();await shot('swap-choice-'+width+'x'+height);await noOverflow();
   if(height===422&&captureLayout)await shortViewportControl('[data-heritage-swap-confirm]');
   const expected=await page.evaluate(()=>window.__expectedSwap(0,0));
   if(height===422){
    await page.$eval('[data-heritage-swap-confirm]',element=>element.scrollIntoView({block:'center',behavior:'instant'}));
    const point=await page.$eval('[data-heritage-swap-confirm]',element=>{const rect=element.getBoundingClientRect();return{x:rect.x+rect.width/2,y:rect.y+rect.height/2,height:rect.height,visible:rect.top>=0&&rect.bottom<=innerHeight}});
    assert.equal(point.visible,true,'The confirmation is reachable in a short viewport');assert.ok(point.height>=40,'Touch confirmation has a readable target');
    await page.touchscreen.tap(point.x,point.y);
   }else await enter('[data-heritage-swap-confirm]');
   await page.waitForFunction(()=>window.__calls.some(call=>call.method==='POST'));
   await page.waitForFunction(()=>window.__game.handCodes[0]===window.__initialGame.heritageReserveCodes[0]);await settled();
   await page.waitForFunction(()=>document.querySelector('[data-hand-adjustment-status]')===document.activeElement,{timeout:5000});
   assert.equal(await page.$eval('[data-hand-adjustment-status]',element=>element===document.activeElement),true,'The result receives keyboard focus');
   const written=await posts();assert.equal(written.length,1);assert.equal(written[0].body.action,'heritage-swap');
   assert.deepEqual(await page.evaluate(()=>window.__game),expected);await unchangedBalances();await noOverflow();
   await page.$eval('[data-hand-adjustment-status]',element=>element.scrollIntoView({block:'center',behavior:'instant'}));await shot('swap-confirmed-'+width+'x'+height);
   results.push({scenario:'explicit exchange confirmed',width,height,oneWrite:true,xpPreserved:true,albumCopiesPreserved:true,noOverflow:true});

   await adjustment();await enter('[data-hand-redraw]');
   assert.equal((await posts()).length,0,'Opening the redraw warning does not change the hand');
   await page.waitForSelector('[data-hand-redraw-confirm]',{visible:true});
   assert.match(await page.$eval('[data-hand-adjustment]',element=>element.textContent),/réserve/i,'Reserve consequence remains visible before confirmation');
   await shot('redraw-warning-'+width+'x'+height);await noOverflow();
   if(height===422&&captureLayout)await shortViewportControl('[data-hand-redraw-confirm]');
   await enter('[data-hand-redraw-confirm]');await page.waitForFunction(()=>window.__game.handRedrawsUsed===1);await settled();
   assert.equal((await posts()).length,1);assert.equal(await page.evaluate(()=>window.__game.heritageReserveCodes),undefined);
   assert.equal(await page.$eval('[data-hand-redraw]',element=>element.disabled),true);await unchangedBalances();await noOverflow();
   results.push({scenario:'redraw confirms reserve loss and culture quota',width,height,oneWrite:true,reserveLost:true,remaining:0,xpPreserved:true,copiesPreserved:true});
   console.log(JSON.stringify({checkpoint:'exchange and redraw',width,height}));
  }
  if(!captureLayout){
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  for(const scenario of ['prepared','rolled','next-stage','exhausted','exhausted-next-stage']){
   await adjustment(scenario);
   const enabledOutgoing=await page.$$eval('[data-heritage-out-index]',elements=>elements.filter(element=>!element.disabled).length);
   assert.equal(enabledOutgoing,0,'The unavailable reserve never offers an enabled exchange');
   if(await page.$('[data-heritage-reserve-library]')){
    await enter('[data-heritage-reserve-library] > summary');
    assert.match(await page.$eval('[data-heritage-reserve-library]',element=>element.textContent),/réserve/i);
    assert.equal(await page.$$eval('[data-heritage-reserve-library] button',elements=>elements.some(element=>!element.disabled)),false,'A closed exchange window permits reserve reading only');
   }
   if(scenario!=='next-stage')assert.equal(await page.$eval('[data-hand-redraw]',element=>element.disabled),true);
   await page.$$eval('[data-heritage-out-index],[data-heritage-in-index],[data-heritage-swap-confirm]',elements=>elements.forEach(element=>element.click()));
   assert.equal((await posts()).length,0);await noOverflow();await shot('blocked-'+scenario+'-390');
   results.push({scenario:'permission '+scenario,noInvalidWrite:true,exchangeUnavailable:true});
  }
  await adjustment('extra-redraws');
  assert.match(await page.$eval('[data-hand-adjustment] > summary',element=>element.textContent),/3 changements restants pour cette culture/);
  for(let used=1;used<=3;used++){
   await enter('[data-hand-redraw]');await page.waitForFunction(expected=>window.__game.handRedrawsUsed===expected,{},used);await settled();
   assert.equal(await page.$('[data-hand-redraw-confirm]'),null,'Without an opening reserve no warning is necessary');
  }
  assert.equal((await posts()).length,3);assert.equal(await page.$eval('[data-hand-redraw]',element=>element.disabled),true);await unchangedBalances();
  results.push({scenario:'Second regard adds two redraws per culture',writes:3,remaining:0,noReserveWarning:true});

  await adjustment();await enter('[data-hand-adjustment] details > summary');assert.equal((await posts()).length,0);
  assert.match(await page.$eval('[data-hand-adjustment] details[open]',element=>element.textContent),/Consulter ou échanger cette carte ne la joue pas/);
  await enter('[data-hand-redraw]');assert.equal(await page.$eval('[data-hand-redraw-warning]',element=>element===document.activeElement),true);
  await enter('[data-hand-redraw-warning] button:not([data-hand-redraw-confirm])');assert.equal((await posts()).length,0);
  assert.equal(await page.$eval('[data-hand-redraw]',element=>element===document.activeElement),true,'Cancelling returns focus to the redraw opener');
  assert.equal(await page.$('[data-hand-redraw-warning]'),null);await unchangedBalances();
  results.push({scenario:'consult card effects and cancel redraw',noWrite:true,focusReturned:true});

  await adjustment('duplicates');await choose(1,0);const duplicateExpected=await page.evaluate(()=>window.__expectedSwap(1,0));await enter('[data-heritage-swap-confirm]');
  await page.waitForFunction(()=>window.__game.handCodes[1]===window.__initialGame.heritageReserveCodes[0]);await settled();
  assert.deepEqual(await page.evaluate(()=>window.__game),duplicateExpected);assert.equal(await page.evaluate(()=>window.__game.handCodes[0]),await page.evaluate(()=>window.__initialGame.handCodes[0]));
  await unchangedBalances();results.push({scenario:'two identical cards in hand',selectedPhysicalPosition:1,unselectedCopyPreserved:true});

  await adjustment('identical-copies');await choose();assert.match(await page.$eval('[data-hand-adjustment]',element=>element.textContent),/Deux copies de la même carte/);
  await enter('[data-heritage-swap-confirm]');await page.waitForFunction(()=>document.querySelector('[data-hand-adjustment-status]')?.textContent.includes('identiques'));await settled();
  assert.equal((await posts()).length,1);await unchangedBalances();assert.deepEqual(await page.evaluate(()=>window.__game.handCodes),await page.evaluate(()=>window.__initialGame.handCodes));
  results.push({scenario:'same card in reserve',unchangedHandExplainedBeforeConfirmation:true,oneWrite:true});

  await adjustment();await choose();await page.evaluate(()=>window.__holdAction=true);
  await page.$eval('[data-heritage-swap-confirm]',element=>{element.click();element.click()});
  await page.waitForFunction(()=>window.__calls.some(call=>call.method==='POST'));assert.equal((await posts()).length,1,'A synchronous double click submits once');
  assert.equal(await page.$$eval('[data-heritage-swap-confirm]',elements=>elements.some(element=>!element.disabled)),false);
  await page.$$eval('[data-hand-redraw],[data-heritage-out-index],[data-heritage-in-index]',elements=>elements.forEach(element=>element.click()));assert.equal((await posts()).length,1);
  await page.evaluate(()=>window.__allowAction=true);await page.waitForFunction(()=>window.__game.handCodes[0]===window.__initialGame.heritageReserveCodes[0]);await settled();await unchangedBalances();
  results.push({scenario:'pending exchange and synchronous double click',writes:1,otherHandActionsLocked:true});

  await adjustment();await page.evaluate(()=>window.__holdAction=true);await enter('[data-culture-primary-action]');await page.waitForFunction(()=>window.__calls.some(call=>call.method==='POST'));
  assert.equal(await page.$$eval('[data-heritage-out-index]',elements=>elements.some(element=>!element.disabled)),false);
  assert.equal(await page.$eval('[data-hand-redraw]',element=>element.disabled),true);
  await page.$$eval('[data-hand-redraw],[data-heritage-out-index],[data-heritage-in-index]',elements=>elements.forEach(element=>element.click()));assert.equal((await posts()).length,1);
  await page.evaluate(()=>window.__allowAction=true);await page.waitForFunction(()=>window.__game.phase==='rolled');await settled();
  results.push({scenario:'roll in progress',oneRollWrite:true,handActionsLocked:true});

  await adjustment('recovery');const preparation=await page.evaluate(()=>window.__preparation);await enter('[data-action-card="'+preparation+'"]');await enter('[data-culture-confirm-card]');
  await page.waitForSelector('[data-card-recovery-refresh]');await page.keyboard.press('Escape');await page.waitForSelector('[data-app-dialog]',{hidden:true});
  assert.equal(await page.$eval('[data-hand-redraw]',element=>element.disabled),true);assert.equal(await page.$$eval('[data-heritage-out-index]',elements=>elements.some(element=>!element.disabled)),false);
  await page.$$eval('[data-hand-redraw],[data-heritage-out-index],[data-heritage-in-index]',elements=>elements.forEach(element=>element.click()));assert.equal((await posts()).length,1);
  results.push({scenario:'uncertain card confirmation',oneCardAttempt:true,handActionsLocked:true});

  await adjustment('action-failure');await choose();await enter('[data-heritage-swap-confirm]');await page.waitForFunction(()=>document.querySelector('[data-hand-adjustment-status]')?.textContent.includes('indisponible'));
  assert.equal((await posts()).length,1);await unchangedBalances();assert.deepEqual(await page.evaluate(()=>window.__game),await page.evaluate(()=>window.__initialGame));await shot('exchange-error-390');await noOverflow();
  results.push({scenario:'exchange rejected',serverErrorVisible:true,noLocalOptimisticSwap:true,noAutomaticRetry:true});
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(consoleErrors,[]);report.passed=true;console.log(JSON.stringify({passed:true,observations:results.length,output}));
}catch(error){report.failure=error.stack;console.error(error.stack);await page?.screenshot({path:resolve(output,'failure.png'),timeout:10000}).catch(()=>{});process.exitCode=1;}
finally{
 await writeFile(resolve(output,captureLayout?'visual-report.json':'report.json'),JSON.stringify(report,null,2));
 // Windows can leave the local Vite/Chromium shutdown waiting on an open handle.
 // This process owns both helpers, and its dedicated Chromium profile is never shared.
 const ownedBrowserProcess=browser?.process();
 const cleanupDeadline=setTimeout(()=>{ownedBrowserProcess?.kill();process.exit(process.exitCode??0);},15000);
 await browser?.close();await server.close();clearTimeout(cleanupDeadline);
 process.exit(process.exitCode??0);
}
