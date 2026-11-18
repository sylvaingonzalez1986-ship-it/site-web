/** Player culture with a gated local roll response, plus isolated 3D and fallback checks. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import sharp from 'sharp';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/placard-workshop/dice');
const playerEntry = `
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import '/src/app/globals.css';
  import retro from '/src/components/contest/ArenaRetro.module.css';
  import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
  import {createKqTutorialApi, KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
  import {KQ_CARDS, startKqGame, rollKqDice} from '/src/lib/kanab-quest-game';
  const runId = 'fixture-dice-run';
  const initial = startKqGame(270926, {rulesVersion: 3, varietyCode: 'HH2026-020'});
  let game = initial;
  const inventory = Object.fromEntries(KQ_CARDS.map(card => [card.code, 3]));
  const session = () => {
    const run = {runId, state: game, status: 'active', buddieCode: game.varietyCode, startedAt: game.startedAt, burnReceipts: []};
    return {activeRun: run, activeRuns: [run], flowers: [], battles: [], progress: null, warnings: []};
  };
  window.__rollPosts = [];
  const request = async (input, init) => {
    const path = new URL(input, location.origin).pathname;
    if (init?.method === 'POST' && path.endsWith('/actions')) {
      const body = JSON.parse(init.body);
      window.__rollPosts.push(body);
      if (body.action !== 'roll') throw new Error('Unexpected fixture action');
      const accepted = await new Promise(resolve => { window.__releaseRoll = resolve; });
      window.__releaseRoll = null;
      if (!accepted) return Response.json({error:'Lancer refusé pour la recette.'}, {status:409});
      game = {...rollKqDice(game), dice:[1,4,6]};
      return Response.json({state:game});
    }
    if (init?.method && init.method !== 'GET') throw new Error('Unexpected fixture mutation ' + path);
    if (path.endsWith('/bootstrap')) return Response.json({collection:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]},ownedBuddieCodes:[game.varietyCode],heritage:{cards:[]},playerSession:session(),warnings:[]});
    if (path.endsWith('/session') || path.endsWith('/runs')) return Response.json(session());
    if (path.endsWith('/rankings')) return Response.json({entries:[]});
    if (path.endsWith('/me')) return Response.json({progress:null});
    if (path.endsWith('/equipment')) return Response.json({strength:null,routePlan:null});
    if (path.endsWith('/work')) return Response.json({version:1,runId,stageIndex:game.stageIndex,phase:game.phase,day:1,source:'player',paid:game.phase!=='prepare',stepHours:0.5,playerRemainingHours:8,employee:null,bonus:{vitality:0,terpenes:0,yieldPercent:0,cannabinoids:0}});
    return Response.json({error:'Unavailable in local fixture'}, {status:404});
  };
  const api = createKqTutorialApi(request);
  api.isTutorial = false;
  const mode = new URLSearchParams(location.search).get('mode');
  localStorage.setItem('kanab-quest-onboarding-seen-v1','1');
  localStorage.setItem('kq-dice-direct-result', mode === 'direct' ? '1' : '0');
  const el = React.createElement;
  createRoot(document.getElementById('root')).render(el('div',{className:retro.surface},
    el(KqTutorialApiProvider,{api},el(KanabQuestDicePrototype,{apiScope:'player', initialRunId:runId, viewMode:'game',showWarehouseNavigation:false,showAdminOperations:false}))));
`;
const modules={
  'player-culture':playerEntry,
  'next/image':`import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...rest}){return React.createElement('img',{...rest,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...rest.style}});}`,
  'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...rest}){return React.createElement('a',rest);}`,
  'next/dynamic':`import React from 'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props));}`,
  'next/navigation':`export const useRouter=()=>({push(){},replace(){},refresh(){}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
  'culture-game':`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
    import {startKqGame} from '/src/lib/kanab-quest-game';
    import {KQ_LOCAL_KEYS} from '/src/lib/kanab-quest-repository';
    import {encodeKqSave,parseKqGameSave} from '/src/lib/kanab-quest-persistence';
    if(!localStorage.getItem(KQ_LOCAL_KEYS.game)) localStorage.setItem(KQ_LOCAL_KEYS.game,encodeKqSave(startKqGame(270926)));
    localStorage.setItem(KQ_LOCAL_KEYS.onboardingSeen,'1');
    window.__saved=()=>parseKqGameSave(localStorage.getItem(KQ_LOCAL_KEYS.game));
    window.__saveWrites=[];const put=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KQ_LOCAL_KEYS.game)window.__saveWrites.push(parseKqGameSave(value)?.phase);return put.call(this,key,value);};
    createRoot(document.getElementById('root')).render(React.createElement(KanabQuestDicePrototype,{apiScope:'admin',showAdminOperations:false,viewMode:'game'}));`,
  'dice-entry':`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import styles from '/src/components/placard/KanabQuestDicePrototype.module.css';
    import {KqPhysicsDice} from '/src/components/placard/KqPhysicsDice';import {KqGameDie as GameDie} from '/src/components/placard/KqGameCards';
    function App(){
      const ref=React.useRef(null);const [active,setActive]=React.useState(false);const [phase,setPhase]=React.useState('idle');
      const [values,setValues]=React.useState([1,4,6]);const [validated,setValidated]=React.useState(false);
      window.__roll=async (values,fast=false)=>{setValues(values);setValidated(false);setActive(true);const ok=await ref.current.roll(values,setPhase,fast);setPhase('idle');return ok;};
      window.__finish=()=>ref.current.finish();
      window.__restore=async values=>{setValues(values);setActive(true);return ref.current.sync(values,false);};
      window.__sync=async values=>{setValues(values);return ref.current.sync(values);};
      window.__reveal=()=>{setValidated(true);return ref.current.reveal(values);};
      window.__fallback=()=>{setActive(false);setValidated(true);};
      return React.createElement('main',{className:styles.page,'data-culture-play':true,style:{minHeight:'100vh',padding:16}},
        React.createElement('section',{className:styles.diceBoard,style:{maxWidth:660,margin:'auto'}},
          React.createElement('span',{className:styles.buddyName},'Le Placard'),React.createElement('h2',null,'À toi de lancer'),
          React.createElement('div',{className:styles.diceTray,'data-phase':'rolled','data-physics':active||undefined,'data-motion-phase':phase,'data-rolling':phase!=='idle'||undefined},
            React.createElement(KqPhysicsDice,{ref}),
            phase!=='idle'?React.createElement('span',{className:styles.diceMotionStatus},React.createElement('i'),React.createElement('small',null,'Les dés roulent…')):null,
            React.createElement('div',{className:styles.dice},values.slice(0,3).map((value,index)=>React.createElement(GameDie,{key:index,value,index,validated})))),
          React.createElement('div',{className:styles.diceLegend},[['1','Danger','danger'],['2–3','Neutre','neutral'],['4–5','Réussite','success'],['6','Étincelle','spark']].map(([n,label,kind])=>React.createElement('span',{key:kind,'data-kind':kind},React.createElement('b',null,n),label))),
          React.createElement('button',{className:styles.rollButton,onClick:()=>window.__roll([1,4,6])},'Lancer les dés')));
    }createRoot(document.getElementById('root')).render(React.createElement(App));`,
};
const server=await createServer({root,cacheDir:resolve(output,'vite-cache'),configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},optimizeDeps:{entries:[],noDiscovery:true,include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/client','three','cannon-es','lucide-react','next/dynamic']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'dice-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');const entry=req.url.includes('player')?'player-culture':req.url.includes('game')?'culture-game':'dice-entry';res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Display;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:Body;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__'+entry+'"></script></html>');});}}],server:{host:'127.0.0.1',port:3196,strictPort:true,hmr:false,watch:null}});
const playerStage = '#kq-physics-dice-stage';
const playerTray = '[data-culture-decision] [data-motion-phase]';
const playerAction = '[data-culture-primary-action]';

let browser, coldModuleGate;const errors=[],results=[];
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();page.setDefaultTimeout(45000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', async request=>{
    const url=new URL(request.url());
    if (url.pathname.startsWith('/api/')) return request.respond({status:503,contentType:'application/json',body:'{"error":"API locale indisponible"}'});
    if (url.protocol==='data:' || url.protocol==='blob:') return request.continue();
    if (url.origin!=='http://127.0.0.1:3196') return request.abort();
    if (coldModuleGate && url.pathname.endsWith('/kq-dice-table.ts')) await coldModuleGate;
    return request.continue();
  });
  const shot=async name=>{await new Promise(r=>setTimeout(r,350));await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  const topFaces=()=>page.$eval('[data-top-faces]',el=>el.dataset.topFaces.split(',').map(Number));
  if (!process.argv.includes('--game-only')) await auditPlayer(page, results);
  if (!process.argv.includes('--player-only')) {
  for(const width of process.argv.includes('--game-only') ? [] : [320,390,1440]){
    await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
    await page.goto('http://127.0.0.1:3196/',{waitUntil:'domcontentloaded'});await page.waitForSelector('#kq-physics-dice-stage[data-status="ready"]',{timeout:60000});
    await page.evaluate(()=>{window.__pendingRoll=window.__roll([1,4,6]);});
    await page.waitForSelector('[data-moving=true]');
    if(width===390) await page.screenshot({path:resolve(output,'in-flight-390.png')});
    assert(await page.evaluate(()=>window.__pendingRoll));assert.deepEqual(await topFaces(),[1,4,6]);await shot('rolled-'+width);
    assert(await page.evaluate(()=>window.__reveal()));await shot('validated-'+width);
    assert(await page.evaluate(()=>window.__sync([2,5,6])));assert.deepEqual(await topFaces(),[2,5,6]);assert(await page.evaluate(()=>window.__reveal()));
    assert(await page.evaluate(()=>window.__roll([1,4,6,2],true)));assert.deepEqual(await topFaces(),[1,4,6,2]);assert(await page.evaluate(()=>window.__reveal()));await shot('four-dice-'+width);
    assert(await page.evaluate(()=>window.__restore([4,5,1])));assert.deepEqual(await topFaces(),[4,5,1]);
    await page.evaluate(()=>{window.__pendingRoll=window.__roll([1,4,6]);window.__finish();});
    assert(await page.evaluate(()=>window.__pendingRoll));assert.deepEqual(await topFaces(),[1,4,6]);
    await page.evaluate(()=>window.__fallback());
    assert.deepEqual(await page.$$eval('[data-side="front"]',els=>els.map(e=>e.querySelectorAll('i').length)),[1,4,6]);
    await shot('fallback-'+width);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    results.push({width,webgl:true,threeAndFourDice:true,actualTopFaces:true,cardSync:true,accelerated:true,skipped:true,restored:true,fallbackPips:true});
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert(await page.$$eval('[data-die-index]',els=>els.every(e=>getComputedStyle(e).animationName==='none')));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.goto('http://127.0.0.1:3196/?game',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.__saved==='function');
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});
  const button='[data-culture-primary-action]';
  await page.waitForSelector('#kq-physics-dice-stage[data-status=ready]');
  await page.waitForSelector(button+'[data-action=roll]:not(:disabled)');
  // Record the actual moving frame and reload there. Several protocol
  // round-trips between assertions can outlast an entire accelerated throw.
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}), page.$eval(button,el=>{
    const stage=document.querySelector('#kq-physics-dice-stage');
    const onMove=new MutationObserver(()=>{
      if(stage.dataset.moving!=='true' || !el.disabled) return;
      onMove.disconnect();
      sessionStorage.setItem('audit-moving-save',JSON.stringify({state:window.__saved(),rolls:window.__saveWrites.filter(p=>p==='rolled').length}));
      location.reload();
    });
    onMove.observe(stage,{attributes:true});
    el.click();
    el.click();
  })]);
  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('audit-moving-save')));
  assert.equal(saved.rolls,1);assert.equal(saved.state.phase,'rolled');
  await page.waitForSelector(button+'[data-action=resolve]:not(:disabled)');
  await page.waitForSelector('#kq-physics-dice-stage[data-status=ready][data-top-faces="'+saved.state.dice.join(',')+'"]');
  assert.deepEqual(await topFaces(),saved.state.dice);
  assert.equal(await page.$('[data-moving=true]'),null);
  assert.equal(await page.evaluate(()=>window.__saved().stageIndex),saved.state.stageIndex);
  await page.$eval('#kq-physics-dice-stage canvas',canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForSelector('#kq-physics-dice-stage[data-status=error]');
  await page.waitForFunction(()=>!document.querySelector('[data-physics=true]'));
  assert.deepEqual(await page.$$eval('[data-side=front]',els=>els.slice(0,3).map(e=>e.querySelectorAll('i').length)),saved.state.dice);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector(button+'[data-action=roll]:not(:disabled)');
  const point=await page.$eval(button,el=>{window.__taps=[];document.addEventListener('click',e=>window.__taps.push({time:e.timeStamp,detail:e.detail,target:e.target.textContent}),true);el.scrollIntoView({block:'center',behavior:'instant'});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
  // Send both contacts from Chromium's input queue. Two awaited Puppeteer
  // taps can be seconds apart on the software renderer's busy main thread.
  const input=await page.createCDPSession();
  const epoch=Date.now()/1000;
  const sends=[];
  for(const [id,delay] of [[1,0],[2,.12]]){
    const touch={x:Math.round(point.x),y:Math.round(point.y),id,radiusX:.5,radiusY:.5,force:.5};
    sends.push(input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch],timestamp:epoch+delay}));
    sends.push(input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[touch],timestamp:epoch+delay+.03}));
  }
  await Promise.all(sends);
  await input.detach();
  await page.waitForSelector(button+'[data-action=resolve]:not(:disabled)',{timeout:5000}).catch(async error=>{
    throw new Error('Double touch '+JSON.stringify(await page.evaluate(()=>({phase:window.__saved()?.phase,writes:window.__saveWrites,taps:window.__taps}))),{cause:error});
  });
  assert.equal(await page.evaluate(()=>window.__saveWrites.filter(p=>p==='rolled').length),1);
  assert.equal(await page.$('#kq-physics-dice-stage'),null);
  results.push({actualCulture:true,doublePress:true,reloadDuringThrow:true,oneLocalRollSave:true,webglLoss:true,reducedMotion:true});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,results,output}));
}catch(error){errors.push(String(error));console.error('Browser errors',errors);throw error;}finally{
  const report = process.argv.includes('--player-only') ? 'player-report.json' : process.argv.includes('--game-only') ? 'game-report.json' : 'report.json';
  await writeFile(resolve(output,report),JSON.stringify({passed:errors.length===0,results,errors},null,2));
  await browser?.close();
  await server.close();
}

async function auditPlayer(page, results) {
  await page.evaluateOnNewDocument(() => {
    if (new URLSearchParams(location.search).get('mode') !== 'no-webgl') return;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...options) {
      if (type.includes('webgl')) return null;
      return getContext.call(this, type, ...options);
    };
  });
  async function visit(width, mode) {
    await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:mode==='reduced'?'reduce':'no-preference'}]);
    await page.goto('http://127.0.0.1:3196/?player&mode='+mode, {waitUntil:'domcontentloaded'});
    await page.waitForSelector(playerAction+'[data-action=roll]:not(:disabled)');
    await page.$eval('[data-culture-decision]', el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    if (mode==='no-webgl') await page.waitForSelector(playerStage+'[data-status=error]');
    if (mode==='animated') {
      await page.waitForFunction(id=>{
        const stage=document.querySelector(id);
        return stage?.dataset.status==='ready' && getComputedStyle(stage).visibility==='visible' && Number(getComputedStyle(stage).opacity)===1;
      },{},playerStage);
    }
  }
  function roll() { return page.click(playerAction); }
  async function pending() {
    await page.waitForFunction(()=>typeof window.__releaseRoll==='function');
    assert.equal(await page.$eval(playerAction, el=>el.disabled),true);
    assert.equal(await page.$('[data-culture-result]'),null);
    assert.equal(await page.$eval(playerTray, el=>el.dataset.phase),'prepare');
  }
  async function release(accepted=true) {
    await page.evaluate(value=>window.__releaseRoll(value),accepted);
  }
  async function result() {
    await page.waitForSelector(playerAction+'[data-action=resolve]:not(:disabled)');
    assert.equal(await page.$eval(playerTray, el=>el.dataset.phase),'rolled');
    assert(await page.$('[data-culture-result]'));
    assert.equal(await page.$eval(playerTray, el=>el.querySelector('[aria-live]')?.getAttribute('aria-label')),'Résultat des dés : 1, 4 et 6');
  }
  async function assertStatic() {
    const displayed = await page.$$eval(playerTray+' [data-side=front]', faces=>faces.map(face=>({
      pips:face.querySelectorAll('i').length, animation:getComputedStyle(face.closest('[data-die-index]')).animationName,
    })));
    assert.deepEqual(displayed.map(face=>face.pips),[1,4,6]);
    assert(displayed.every(face=>face.animation==='none'));
  }
  async function watchCanvas() {
    await page.$eval(playerTray, tray=>{
      const stage=tray.querySelector('#kq-physics-dice-stage');
      const canvas=stage.querySelector('canvas');
      const changes=[];
      window.__diceLayout=[];
      window.__paintedDiceTops=[];
      const painted=new MessageChannel();
      function afterPaint() {
        if (!tray.dataset.rolling && !tray.dataset.result) return;
        const top=Math.round(tray.getBoundingClientRect().top);
        if(window.__paintedDiceTops.at(-1)!==top)window.__paintedDiceTops.push(top);
      }
      painted.port1.onmessage=afterPaint;
      function sample() {
        const top=Math.round(tray.getBoundingClientRect().top);
        if(changes.at(-1)?.top!==top) {
          window.__diceLayout.push({top,phase:tray.dataset.motionPhase,regions:[...tray.closest('main').children].map(el=>({
            name:el.getAttribute('aria-label')||el.className||el.tagName,height:Math.round(el.getBoundingClientRect().height),
          }))});
        }
        const row={
          phase:tray.dataset.motionPhase, status:stage.dataset.status, gathering:stage.dataset.gathering === 'true', moving:stage.dataset.moving === 'true',
          top,scroll:Math.round(window.scrollY),documentTop:top+Math.round(window.scrollY),boardTop:Math.round(tray.closest('[data-culture-decision]').getBoundingClientRect().top),
          same:canvas.isConnected && stage.querySelector('canvas')===canvas,
          opaque:getComputedStyle(stage).visibility==='visible' && Number(getComputedStyle(stage).opacity)===1,
          html:[...tray.querySelectorAll('[data-die-index]')].some(die=>getComputedStyle(die.parentElement).opacity!=='0'),
        };
        if (JSON.stringify(row)!==JSON.stringify(changes.at(-1))) changes.push(row);
      }
      const observer=new MutationObserver(sample);
      observer.observe(tray,{attributes:true,subtree:true,childList:true});
      let frame;
      function checkFrame() { sample(); painted.port2.postMessage(null); frame=requestAnimationFrame(checkFrame); }
      checkFrame();
      window.__diceTrace=changes;
      window.__endDiceTrace=()=>{
        observer.disconnect();cancelAnimationFrame(frame);painted.port1.close();painted.port2.close();
        sample();afterPaint();return changes;
      };
    });
  }
  async function measureTray() {
    return page.$eval(playerTray, tray=>{
      const r=tray.getBoundingClientRect();
      return {left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)};
    });
  }
  async function diceShot(name) {
    const tray=await page.$(playerTray);
    await tray.screenshot({path:resolve(output,name+'.png')});
  }
  await visit(1440,'animated');
  assert.equal(await page.$eval(playerTray, el=>el.querySelector('[aria-live]')?.getAttribute('aria-label')),'Les dés n’ont pas encore été lancés');
  await diceShot('player-rest-1440');
  await page.$eval('[data-culture-decision]', el=>el.scrollIntoView({block:'start',behavior:'instant'}));
  const clip=await measureTray();
  assert(clip.width>340,'Desktop tray should exceed the former 340 px cap');
  await watchCanvas();
  await roll();
  await pending();
  await page.waitForFunction(()=>window.__diceTrace.some(row=>row.gathering));
  await new Promise(resolve=>setTimeout(resolve,320));
  await release();
  await result();
  const trace=await page.evaluate(()=>window.__endDiceTrace());
  await writeFile(resolve(output,'player-trace-1440.json'),JSON.stringify(trace,null,2));
  await writeFile(resolve(output,'player-layout-1440.json'),JSON.stringify(await page.evaluate(()=>window.__diceLayout),null,2));
  const throwPositions=await page.evaluate(()=>window.__paintedDiceTops);
  assert(Math.max(...throwPositions)-Math.min(...throwPositions)<=2,'Visible desktop tray moved during the roll: '+throwPositions.join(', '));
  assert(trace.every(row=>row.same && row.opaque && !row.html),'A second visual layer or canvas replacement interrupted the throw: '+JSON.stringify(trace));
  assert(trace.some(row=>row.phase==='preparing'&&row.gathering),'Physical gathering starts before the local server answers');
  assert(trace.some(row=>row.phase==='rolling'&&row.moving),'The authenticated faces enter the actual throw');
  assert(trace.some(row=>row.phase==='settling'&&row.moving),'Physical impacts precede the readout');
  assert.equal(await page.$eval(playerStage, stage=>stage.dataset.topFaces),'1,4,6');
  assert.equal(await page.evaluate(()=>window.__rollPosts.length),1);
  await diceShot('player-result-1440');
  results.push({player:'desktop',width:1440,clip,trace,paintedTops:throwPositions,rollPosts:1,faces:[1,4,6]});
  console.log('Desktop player roll verified',clip);

  await visit(320,'animated');
  await roll();
  await pending();
  await release(false);
  await page.waitForSelector(playerAction+'[data-action=roll]:not(:disabled)');
  assert.equal(await page.$('[data-culture-result]'),null);
  assert.equal(await page.$eval(playerStage, el=>el.dataset.moving),undefined);
  assert(await page.evaluate(()=>document.body.innerText.includes('Lancer refusé pour la recette.')));
  await roll();
  await pending();
  await release();
  const skipSelector='[data-culture-decision] button';
  await page.waitForFunction(selector=>[...document.querySelectorAll(selector)].some(el=>el.textContent==='Voir le résultat'),{},skipSelector);
  await page.evaluate(selector=>[...document.querySelectorAll(selector)].find(el=>el.textContent==='Voir le résultat').focus(),skipSelector);
  await page.keyboard.press('Enter');
  await result();
  await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-culture-result'));
  assert.equal(await page.$eval(playerStage, stage=>stage.dataset.topFaces),'1,4,6');
  assert.equal(await page.evaluate(()=>window.__rollPosts.length),2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await diceShot('player-result-320');
  results.push({player:'mobile',width:320,serverRefusal:true,retry:true,keyboardSkip:true,resultFocused:true,faces:[1,4,6]});
  let resumeImport;
  coldModuleGate = new Promise(resolve=>{resumeImport=resolve;});
  await page.setCacheEnabled(false);
  try {
    await visit(390,'cold');
    await page.waitForSelector(playerStage+'[data-status=loading]');
    await roll();
    await pending();
    await release();
    await page.waitForSelector(playerTray+'[data-phase=rolled]');
    assert.equal(await page.$(playerTray+' [data-die-index]'),null);
    assert.equal(await page.$('[data-culture-result]'),null);
    await page.evaluate(selector=>{
      window.__coldMoved=false;
      const watch=new MutationObserver(()=>{if(document.querySelector(selector)?.dataset.moving==='true')window.__coldMoved=true;});
      watch.observe(document.querySelector(selector),{attributes:true});
    },playerStage);
  } finally {
    resumeImport();
    coldModuleGate=null;
  }
  await result();
  assert.equal(await page.evaluate(()=>window.__coldMoved),true);
  assert.equal(await page.$eval(playerStage, stage=>stage.dataset.topFaces),'1,4,6');
  assert.equal(await page.evaluate(()=>window.__rollPosts.length),1);
  await page.setCacheEnabled(true);
  results.push({player:'cold first click',width:390,serverBeforeWebgl:true,noHtmlDiceDuringLoad:true,rollPosts:1,faces:[1,4,6]});
  for (const mode of ['no-webgl','direct','reduced']) {
    await visit(390,mode);
    await roll();
    await pending();
    assert.equal(await page.$(playerTray+' [data-moving=true]'),null);
    await release();
    await result();
    await assertStatic();
    assert.equal(await page.$(playerStage+' canvas'),null);
    assert.equal(await page.evaluate(()=>window.__rollPosts.length),1);
    results.push({player:mode,width:390,staticFaces:[1,4,6],rollPosts:1});
  }
  await visit(1440,'animated');
  results.push({player:'desktop GIF',...await recordTray(page)});
}

async function recordTray(page) {
  // The assertions above use Chromium's normal clock. For the replay, step a
  // second actual player throw and capture the composited tray every 50 ms so
  // software rendering speed does not drop the first impact from the GIF.
  await page.evaluate(()=>{
    let now=performance.now(), id=-1;
    const frames=new Map(), timers=new Map();
    const nativeCancel=window.cancelAnimationFrame.bind(window), nativeClear=window.clearTimeout.bind(window);
    window.requestAnimationFrame=callback=>{frames.set(id,callback);return id--;};
    window.cancelAnimationFrame=key=>{if(!frames.delete(key))nativeCancel(key);};
    window.setTimeout=(callback,delay=0,...args)=>{timers.set(id,{due:now+delay,callback,args});return id--;};
    window.clearTimeout=key=>{if(!timers.delete(key))nativeClear(key);};
    Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
    window.__advanceFilm=delta=>{
      now+=delta;
      for(const [key,timer] of [...timers]) if(timer.due<=now) {
        timers.delete(key);
        timer.callback(...timer.args);
      }
      const present=[...frames.values()];
      frames.clear();
      present.forEach(callback=>callback(now));
    };
  });
  const client=await page.createCDPSession();
  const buffers=[],delays=[];
  let width,height,previousPhase,lastContactFrame;
  async function frame(delta,delay) {
    const geometry=await page.$eval(playerTray,(tray,delta)=>{
      window.__advanceFilm(delta);
      const r=tray.getBoundingClientRect();
      return {x:Math.round(r.x+scrollX),y:Math.round(r.y+scrollY),width:Math.round(r.width),height:Math.round(r.height)};
    },delta);
    width=geometry.width;
    height=geometry.height;
    const shot=await client.send('Page.captureScreenshot',{format:'png',clip:{...geometry,scale:1},captureBeyondViewport:true,fromSurface:true});
    const png=Buffer.from(shot.data,'base64');
    const phase=await page.$eval(playerTray,el=>el.dataset.motionPhase);
    if(previousPhase==='rolling' && phase==='settling') {
      lastContactFrame=buffers.length;
    }
    if(lastContactFrame!==undefined && buffers.length===lastContactFrame+2) {
      await writeFile(resolve(output,'player-in-flight-1440.png'),png);
    }
    previousPhase=phase;
    buffers.push(await sharp(png).removeAlpha().raw().toBuffer());
    delays.push(delay);
    return phase;
  }
  try {
    await frame(0,400);
    await page.$eval(playerAction,button=>button.click());
    for(let i=0;i<6;i++) await frame(50,50);
    await page.evaluate(()=>window.__releaseRoll(true));
    await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.moving==='true',{polling:'mutation'},playerStage);
    for(let i=0;i<122;i++) {
      const phase=await frame(50,50);
      if(phase==='idle')break;
    }
    assert.equal(previousPhase,'idle','The recorded replay ended');
    assert.notEqual(lastContactFrame,undefined,'The replay includes the physical first contact');
    assert.equal(await page.$eval(playerStage,stage=>stage.dataset.topFaces),'1,4,6');
    delays[delays.length-1]=800;
    await sharp(Buffer.concat(buffers),{raw:{width,height:height*buffers.length,pageHeight:height,channels:3}})
      .gif({delay:delays,loop:0,effort:3}).toFile(resolve(output,'player-throw-1440.gif'));
    return {capturedFrames:buffers.length,firstContactFrame:lastContactFrame,frameIntervalMs:50,width,height};
  } finally {
    await client.detach();
  }
}
