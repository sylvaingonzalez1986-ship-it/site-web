/** Real player culture and engine, with local API fixtures. No live requests or writes. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const before = process.argv.includes("--before");
const root = process.cwd(), output = resolve(root, `output/clarity-lot23/${before ? "before" : "after"}`);
const port = Number(process.env.CARD_CHOICE_LOT23_PORT ?? 3593), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
import {startKqGame,KQ_ACTIVE_CARDS,KQ_CARDS,playKqCard,resolveKqStage,advanceKqStage} from '/src/lib/kanab-quest-game';
import {createKqCareState,KQ_BASIC_CARE_PRICE_CENTS,isKqCareReplacedCard} from '/src/lib/kanab-quest-care';
import {encodeKqSave,parseKqGameSave} from '/src/lib/kanab-quest-persistence';
import {getKqCardPlayPreview} from '/src/lib/kanab-quest-card-preview';
import retro from '/src/components/contest/ArenaRetro.module.css';
const scenario=new URLSearchParams(location.search).get('scenario')||'reaction';
const code=scenario==='server-error-long-title'?'BOTTE-018':scenario==='random'?'BOTTE-006':scenario==='preparation'||scenario==='xp'?'BOTTE-005':scenario==='worse'?'BOTTE-037':'BOTTE-021';
const candidates=KQ_ACTIVE_CARDS.filter(card=>!['pbi','substrate'].includes(card.category)&&card.rarity!=='epic'&&!isKqCareReplacedCard(card.code)).map(card=>card.code);
const deck=[code,...candidates.filter(value=>value!==code).slice(0,9)];
let inventory=Object.fromEntries(KQ_CARDS.map(card=>[card.code,3]));
const stageIndex=['preparation','xp'].includes(scenario)?0:scenario==='server-error-long-title'?3:1;
let progressed={...startKqGame(91,{rulesVersion:3,deckCodes:deck,varietyCode:'HH2026-020',startedAt:'2026-10-30T10:00:00Z'}),situationCodes:['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006']};
while(progressed.stageIndex<stageIndex)progressed=advanceKqStage(resolveKqStage({...progressed,phase:'rolled',dice:[6,6,6]}));
let game={...progressed,
 phase:['preparation','xp','timing'].includes(scenario)?'prepare':'rolled',
 dice:['preparation','xp','timing'].includes(scenario)?null:scenario==='worse'?[2,2,2]:[2,4,5],
 pressure:0,handCodes:deck,care:{...createKqCareState(),vitality:60},xp:scenario==='xp'?0:10,quality:4,
 ...(scenario==='worse'?{heritageCode:'HERITAGE-006',heritageUsed:false}:{})};
if(!parseKqGameSave(encodeKqSave(game)))throw new Error('Invalid local card choice fixture: '+scenario);
const runId='local-lot23-run';
const run=()=>({runId,state:game,status:'active',buddieCode:game.varietyCode,startedAt:game.startedAt,updatedAt:game.startedAt,burnReceipts:[]});
const session=()=>({activeRun:run(),activeRuns:[run()],flowers:[],battles:[],progress:null,warnings:[]});
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const storage={persistent:memory(),session:memory()};storage.persistent.setItem('kq-dice-direct-result','1');
window.__calls=[];window.__initialGame=JSON.stringify(game);window.__game=game;window.__inventory=inventory;
window.__targetCard=code;window.__card=KQ_CARDS.find(card=>card.code===code);window.__preview=getKqCardPlayPreview(game,window.__card,inventory[code]);
window.__expectedPlayed=playKqCard(game,code);window.__expectedResolved=resolveKqStage(window.__expectedPlayed);
const request=async(input,init)=>{
 const path=new URL(String(input),location.origin).pathname,method=init?.method??'GET';
 const body=init?.body?JSON.parse(init.body):null;window.__calls.push({path,method,body});
 if(method!=='GET'){
  if(path.endsWith('/cards')){
   if(scenario.startsWith('server-error'))return Response.json({error:'La validation est indisponible. Réessaie. '+('Une information longue doit rester lisible sans cacher les commandes. '.repeat(10))},{status:503});
   await new Promise(resolve=>setTimeout(resolve,scenario==='pending-close'?1600:550));
   const next=playKqCard(game,body.cardCode);if(next===game)return Response.json({error:'Carte déjà jouée'},{status:409});
   game=next;inventory={...inventory,[body.cardCode]:inventory[body.cardCode]-1};window.__game=game;window.__inventory=inventory;
   return Response.json({state:game,burnReceipt:{id:'local-burn-receipt',cardInstanceId:'local-instance',cardCode:body.cardCode,runId,stageIndex:game.stageIndex,useKind:'support',burnedAt:'2026-10-30T10:00:00Z'}});
  }
  throw new Error('Unexpected local mutation: '+method+' '+path);
 }
 if(path.endsWith('/bootstrap'))return Response.json({collection:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]},ownedBuddieCodes:[game.varietyCode],heritage:{cards:[]},playerSession:session(),warnings:[]});
 if(path.endsWith('/runs')||path.endsWith('/session'))return Response.json(session());
 if(path.endsWith('/rankings'))return Response.json({entries:[]});
 if(path.endsWith('/me'))return Response.json({progress:null});
 if(path.endsWith('/equipment'))return Response.json({strength:null,routePlan:null});
 if(path.endsWith('/care'))return Response.json({cashCents:12000,basicCarePriceCents:KQ_BASIC_CARE_PRICE_CENTS,inventory:[],catalog:[]});
 return Response.json({error:'Outside local fixture'},{status:404});
};
const api=createKqTutorialApi(request);api.isTutorial=false;
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
 plugins:[{name:'card-choice-lot23',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},
 async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},
 configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Choix des cartes · recette locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);})}}],
 server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
const results=[],errors=[],external=[],consoleErrors=[];
const report={passed:false,mode:before?'before':'after',results,errors,external,consoleErrors,backend:'Real player UI and engine, isolated local API responses and transactions only.'};
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
 async function open(scenario='reaction'){
  await page.goto(`${origin}/?scenario=${scenario}`,{waitUntil:'networkidle0'});await page.waitForSelector('[data-culture-play][data-player-mode="true"]');await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.$('[data-playable-lesson]'),null,'The actual player branch is mounted');
  await enter('[data-culture-hand] > summary');await enter('[data-hand-filter="all"]');
  const code=await page.evaluate(()=>window.__targetCard);await enter(`[data-action-card="${code}"]`);await page.waitForSelector('[data-culture-card-cost]',{visible:true});await frames();return code;
 }
 async function noMutation(){assert.deepEqual(await page.evaluate(()=>window.__calls.filter(call=>call.method!=='GET')),[]);assert.equal(await page.evaluate(()=>JSON.stringify(window.__game)===window.__initialGame),true);}
 async function layout(){
  const metric=await page.$eval('[data-app-dialog]',dialog=>{const body=dialog.querySelector('[data-app-dialog-body]'),button=dialog.querySelector('[data-culture-confirm-card], [data-card-recovery-refresh]'),box=button?.getBoundingClientRect(),d=dialog.getBoundingClientRect(),b=body.getBoundingClientRect(),hit=box&&document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return{dialogTop:d.top,dialogBottom:d.bottom,dialogHeight:d.height,bodyHeight:b.height,bodyScrollHeight:body.scrollHeight,bodyScrollTop:body.scrollTop,headings:[...dialog.querySelectorAll('h1,h2,h3')].map(e=>e.textContent),confirm:box?{top:box.top,bottom:box.bottom,height:box.height,visible:box.top>=0&&box.bottom<=innerHeight+1,uncovered:hit===button||button.contains(hit)}:null,dialogOverflow:dialog.scrollWidth>dialog.clientWidth+1,bodyOverflow:body.scrollWidth>body.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};});
  assert.equal(metric.pageOverflow,false);assert.equal(metric.dialogOverflow,false);assert.equal(metric.bodyOverflow,false);return metric;
 }
 async function shot(name){await page.evaluate(()=>Promise.allSettled([...document.images].map(image=>image.decode())));await page.screenshot({path:resolve(output,`${name}.png`)});}
 async function close(code,recovery=false){await page.keyboard.press('Escape');await page.waitForSelector('[data-app-dialog]',{hidden:true});if(recovery){await page.waitForFunction(()=>document.activeElement?.matches('[data-card-recovery-status]'));assert.equal(await page.$eval('[data-card-recovery-status]',e=>e===document.activeElement),true,'Escape focuses the pending recovery so it remains actionable');}else assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-action-card')),code,'Escape restores the inspected card');}
 for(const [width,height] of [[320,844],[390,844],[1440,900],[320,422]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});const code=await open();
  const metric=await layout();await shot(`reaction-${width}x${height}`);await noMutation();
  if(!before){
   assert.ok(metric.confirm.visible&&metric.confirm.uncovered,'Confirm is visible without scrolling');
   assert.ok(metric.confirm.height>=44,'Confirmation is a touch target of at least 44 px');
   assert.equal(await page.$$eval('[data-app-dialog] h2',nodes=>nodes.length),1,'One card title');
   const card=await page.evaluate(()=>window.__card),cost=await page.$eval('[data-culture-card-cost]',e=>e.textContent);
   assert.ok(cost.includes(`${card.xpCost} XP`)&&cost.includes('1 copie détruite')&&cost.includes('10 XP')&&cost.includes('3 copies'),'Visible footer lists XP cost, permanent consumption and balances');
   assert.equal(await page.$eval('[data-culture-card-cost]',e=>{const b=e.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight}),true,'Costs stay visible together with confirmation');
   const described=await page.$eval('[data-culture-confirm-card]',e=>e.getAttribute('aria-describedby').split(' ').map(id=>document.getElementById(id)?.textContent).join(' '));
   assert.ok(described.includes(cost),'Accessible confirmation includes its exact cost');
   assert.equal(await page.$eval('[data-card-choice-rules]',e=>e.open),false,'Secondary rules begin collapsed');
   const summaries=await page.$$eval('[data-card-choice-rules] > summary, [data-card-play-preview] details > summary',nodes=>nodes.map(e=>{const style=getComputedStyle(e),svg=e.querySelector('svg'),icon=svg?.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);if(svg)range.setEndBefore(svg);const label=range.getBoundingClientRect();return{direction:style.flexDirection,iconOnRight:Boolean(icon&&icon.left>=label.right-1)}}));
   assert.deepEqual(summaries,[{direction:'row',iconOnRight:true},{direction:'row',iconOnRight:true}],'Both detail chevrons remain to the right of their labels, including on mobile');
   assert.ok((await page.$eval('[data-card-choice-limit]',e=>e.textContent)).length>15,'Tradeoff stays outside collapsed rules');
   const meters=await page.$$eval('[data-card-play-preview] [role="meter"]',nodes=>nodes.map(e=>({max:e.getAttribute('aria-valuemax'),value:e.getAttribute('aria-valuenow')}))),preview=await page.evaluate(()=>window.__preview);
   assert.deepEqual(meters,[{max:'100',value:String(preview.before.health)},{max:'100',value:String(preview.after.health)}],'Both health meters use the real 0–100 scale');
   // The native modal contains focus in both directions, even in a short viewport.
   await page.focus('[data-culture-confirm-card]');await page.keyboard.press('Tab');
   assert.equal(await page.$eval('[data-app-dialog] > header button',e=>e===document.activeElement),true);
   await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');
   assert.equal(await page.$eval('[data-culture-confirm-card]',e=>e===document.activeElement),true);
   await enter('[data-card-play-preview] details > summary');
   assert.equal(await page.$eval('[data-card-play-preview] details',e=>e.open),true);
   const rows=await page.$$eval('[data-card-play-preview] tbody tr',nodes=>nodes.map(e=>[...e.querySelectorAll('td')].map(cell=>cell.textContent)));
   assert.deepEqual(rows,[[`${preview.before.quality} pts`,`${preview.after.quality} pts`],[`${preview.before.xpAfterPlay} XP`,`${preview.after.xpAfterPlay} XP`],[`${preview.before.xpAfterValidation} XP`,`${preview.after.xpAfterValidation} XP`],[`${preview.before.pressure} /4`,`${preview.after.pressure} /4`]],'All optional numbers come from the actual engine');
   await enter('[data-card-choice-rules] > summary');
   assert.equal(await page.$eval('[data-card-choice-rules]',e=>e.open),true);
   const expanded=await layout();assert.ok(expanded.confirm.visible&&expanded.confirm.uncovered,'Expanded rules never move the footer off screen');
   await shot(`expanded-${width}x${height}`);await noMutation();
   results.push({scenario:'fixed costs, truthful comparison, details and modal keyboard',width,height,expandedBodyHeight:expanded.bodyScrollHeight,confirmationVisible:true});
  }
  await close(code);
  results.push({scenario:'conditional preview at initial opening',width,height,...metric});
 }
 if(!before){
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  for(const scenario of ['preparation','random','worse','xp','timing']){
   const code=await open(scenario),preview=await page.evaluate(()=>window.__preview);
   if(['xp','timing'].includes(scenario)){
    assert.equal(await page.$eval('[data-culture-confirm-card]',e=>e.disabled),true);
    const reason=await page.$eval('[data-card-blocked-reason]',e=>e.textContent);assert.ok(reason.length>10);
    const described=await page.$eval('[data-culture-confirm-card]',e=>e.getAttribute('aria-describedby').split(' ').map(id=>document.getElementById(id)?.textContent).join(' '));
    assert.ok(described.includes(reason),'Disabled action is associated with its reason');
    assert.equal(await page.$('[data-card-play-preview]'),null,'Blocked play never offers a forecast');
    await page.$eval('[data-culture-confirm-card]',e=>e.click());
   }else if(scenario==='worse'){
    assert.equal(preview.kind,'deterministic');
    assert.match(await page.$eval('[data-preview-result="before"]',e=>e.textContent),/Réussite/);
    assert.match(await page.$eval('[data-preview-result="after"]',e=>e.textContent),/Fragile/,'A worse result remains explicit');
   }else{
    assert.equal(preview.kind,scenario);assert.equal(await page.$eval('[data-card-play-preview]',e=>e.dataset.cardPlayPreview),scenario);
    assert.equal(await page.$('[data-preview-result]'),null,'Preparation and random reactions never reveal future dice');
    assert.equal(await page.$('[data-card-play-preview] [role="meter"]'),null);
   }
   await layout();await shot(`${scenario}-390`);await noMutation();await close(code);
   results.push({scenario,blocked:['xp','timing'].includes(scenario),consultationHasNoEffect:true});
  }
  for(const [width,height] of [[320,844],[390,844],[1440,900],[320,422]]){
   await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});const code=await open();
   const expected=await page.evaluate(()=>window.__expectedPlayed);
   await page.click('[data-culture-confirm-card]');
   await page.waitForSelector('[data-culture-confirm-card][disabled][aria-busy="true"]');
   const pending=await layout();assert.ok(pending.confirm.visible&&pending.confirm.uncovered,'Pending confirmation remains visible');
   await page.click('[data-culture-confirm-card]');
   await page.waitForSelector('[data-app-dialog]',{hidden:true});
   await frames();
   assert.equal(await page.evaluate(()=>window.__calls.filter(call=>call.method==='POST').length),1,'A second click during confirmation cannot send another play');
   assert.deepEqual(await page.evaluate(()=>window.__game),expected,'Confirmed effect equals real domain execution');
   assert.equal(await page.evaluate(code=>window.__inventory[code],code),2,'Exactly one of three copies is consumed');
   assert.equal(await page.evaluate(()=>document.activeElement===document.body),false,'Filtered-card removal retains useful keyboard focus');
   results.push({scenario:'single confirmed play',width,height,oneRequest:true,oneCopyConsumed:true,exactEngineResult:true});
  }
  for(const [width,height,scenario] of [[320,422,'server-error'],[390,844,'server-error'],[320,422,'server-error-long-title']]){
   await page.setViewport({width,height,isMobile:true,hasTouch:true});const code=await open(scenario);
   await page.click('[data-culture-confirm-card]');await page.waitForSelector('[data-card-choice-notice]');
   assert.match(await page.$eval('[data-card-choice-notice]',e=>e.textContent),/validation est indisponible/);
   assert.equal(await page.$('[data-culture-confirm-card]'),null,'An uncertain response replaces replay with read-only verification');
   const metric=await layout();assert.ok(metric.confirm.visible&&metric.confirm.uncovered,'A long server error cannot hide verification or the exit');
   await page.focus('[data-card-choice-notice]');
   assert.equal(await page.$eval('[data-card-choice-notice]',e=>document.activeElement===e),true,'Overflowing server notice is keyboard-focusable');
   await page.keyboard.press('End');await frames();
   assert.ok(await page.$eval('[data-card-choice-notice]',e=>e.scrollTop>0),'The complete long error is readable with the keyboard');
   assert.equal(await page.evaluate(()=>JSON.stringify(window.__game)===window.__initialGame),true);
   assert.equal(await page.evaluate(()=>window.__inventory[window.__targetCard]),3,'Rejected server play consumes no copy');
   assert.ok(metric.bodyHeight>=44,'Even the long title and error leave a visible scrollable body');
   await shot(`${scenario}-${width}x${height}`);await close(code,true);
   results.push({scenario:'server rejection and long notice',width,height,longTitle:scenario.endsWith('long-title'),remainingBodyHeight:metric.bodyHeight,verificationVisible:true,noConsumption:true});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await open('pending-close');
  await page.click('[data-culture-confirm-card]');await page.waitForSelector('[data-culture-confirm-card][disabled][aria-busy="true"]');
  assert.match(await page.$eval('[data-card-blocked-reason]',e=>e.textContent),/Fermer cette fenêtre n’annule pas la demande/,'Closing during confirmation is explained');
  await page.click('[data-app-dialog] > header button');await page.waitForSelector('[data-app-dialog]',{hidden:true});
  await page.waitForFunction(()=>window.__game.usedCards.includes(window.__targetCard));
  assert.equal(await page.evaluate(()=>window.__calls.filter(call=>call.method==='POST').length),1);
  assert.equal(await page.evaluate(()=>window.__inventory[window.__targetCard]),2,'Closing in flight does not falsely cancel or replay the request');
  results.push({scenario:'closing during confirmation',requestCompletes:true,oneRequest:true,oneCopyConsumed:true});
  for(const width of [320,390]){
   await page.setViewport({width,height:844,isMobile:true,hasTouch:true});const code=await open();
   const button='[data-app-dialog] footer button:first-of-type';
   const point=await page.$eval(button,e=>{const b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}});
   assert.equal(await page.evaluate(({button,x,y})=>Boolean(document.elementFromPoint(x,y)?.closest(button)),{button,...point}),true);
   await page.touchscreen.tap(point.x,point.y);await page.waitForSelector('[data-app-dialog]',{hidden:true});await noMutation();
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-action-card')),code);
   results.push({scenario:'touch cancellation',width,noConsumption:true,openerRestored:true});
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(consoleErrors,[]);report.passed=true;
 console.log(JSON.stringify({passed:true,observations:results.length,output}));
}catch(error){report.failure=error.stack;await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});console.error(error.stack);process.exitCode=1;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
