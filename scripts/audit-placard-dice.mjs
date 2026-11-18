/** Actual WebGL dice and CSS faces, fixed display values, no game or API writes. */
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/placard-workshop/dice');
const game=await readFile(resolve(root,'src/components/placard/KqGameCards.tsx'),'utf8');
// Exercise the shared renderer used by both the game and its guided tutorial.
const faces=game.slice(game.indexOf('const dieKind ='),game.indexOf('export function KqCardArtwork(')).replace('export function KqGameDie(', 'export function GameDie(');
const faceModule=ts.transpileModule('import styles from "/src/components/placard/KanabQuestDicePrototype.module.css";\n'+faces,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const modules={
  'next/image':`import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...rest}){return React.createElement('img',{...rest,src});}`,
  'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...rest}){return React.createElement('a',rest);}`,
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
  'dice-faces':faceModule.outputText,
  'dice-entry':`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import styles from '/src/components/placard/KanabQuestDicePrototype.module.css';
    import {KqPhysicsDice} from '/src/components/placard/KqPhysicsDice';import {GameDie} from 'dice-faces';
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
const server=await createServer({root,cacheDir:resolve(output,'vite-cache'),configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},optimizeDeps:{entries:[],noDiscovery:true,include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/client','three','cannon-es','lucide-react','next/dynamic']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'dice-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');const entry=req.url.includes('game')?'culture-game':'dice-entry';res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__'+entry+'"></script></html>');});}}],server:{host:'127.0.0.1',port:3196,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[],results=[];
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))void r.respond({status:503,contentType:'application/json',body:'{"error":"API locale indisponible"}'});else if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3196'))void r.continue();else void r.abort();});
  const shot=async name=>{await new Promise(r=>setTimeout(r,350));await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  const topFaces=()=>page.$eval('[data-top-faces]',el=>el.dataset.topFaces.split(',').map(Number));
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
  await page.$eval(button,el=>{el.click();el.click();});
  await page.waitForSelector('[data-moving=true]');
  const saved=await page.evaluate(()=>({state:window.__saved(),rolls:window.__saveWrites.filter(p=>p==='rolled').length}));
  assert.equal(saved.rolls,1);assert.equal(saved.state.phase,'rolled');
  assert.equal(await page.$eval(button,el=>el.disabled),true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-top-faces]');assert.deepEqual(await topFaces(),saved.state.dice);
  await page.waitForSelector(button+'[data-action=resolve]:not(:disabled)');
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
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results,output}));
}catch(error){console.error('Browser errors',errors);throw error;}finally{await browser?.close();await server.close();}
