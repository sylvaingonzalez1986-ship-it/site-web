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
const game=await readFile(resolve(root,'src/components/placard/KanabQuestDicePrototype.tsx'),'utf8');
// Exercise the existing private renderer without exposing a new production API.
const faces=game.slice(game.indexOf('const dieKind ='),game.indexOf('const formatKqDate =')).replace('function GameDie(', 'export function GameDie(');
const faceModule=ts.transpileModule('import styles from "/src/components/placard/KanabQuestDicePrototype.module.css";\n'+faces,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const modules={
  'dice-faces':faceModule.outputText,
  'dice-entry':`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import styles from '/src/components/placard/KanabQuestDicePrototype.module.css';
    import {KqPhysicsDice} from '/src/components/placard/KqPhysicsDice';import {GameDie} from 'dice-faces';
    function App(){
      const ref=React.useRef(null);const [active,setActive]=React.useState(false);const [phase,setPhase]=React.useState('idle');
      const [values,setValues]=React.useState([1,4,6]);const [validated,setValidated]=React.useState(false);
      window.__roll=async values=>{setValues(values);setValidated(false);setActive(true);const ok=await ref.current.roll(values,setPhase);setPhase('idle');return ok;};
      window.__sync=async values=>{setValues(values);return ref.current.sync(values);};
      window.__reveal=()=>{setValidated(true);return ref.current.reveal(values);};
      window.__fallback=()=>{setActive(false);setValidated(true);};
      return React.createElement('main',{className:styles.page,style:{minHeight:'100vh',padding:16}},
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
const server=await createServer({root,cacheDir:resolve(output,'vite-cache'),configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},optimizeDeps:{include:['react','react-dom/client','@3d-dice/dice-box-threejs']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'dice-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__dice-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3196,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;const errors=[],results=[];
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3196'))void r.continue();else void r.abort();});
  const shot=async name=>{await new Promise(r=>setTimeout(r,350));await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  for(const width of [320,390,768]){
    await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
    await page.goto('http://127.0.0.1:3196/',{waitUntil:'networkidle0'});await page.waitForSelector('#kq-physics-dice-stage[data-status="ready"]',{timeout:60000});
    assert(await page.evaluate(()=>window.__roll([1,4,6])));await shot('rolled-'+width);
    assert(await page.evaluate(()=>window.__reveal()));await shot('validated-'+width);
    assert(await page.evaluate(()=>window.__sync([2,5,6])));assert(await page.evaluate(()=>window.__reveal()));
    assert(await page.evaluate(()=>window.__roll([1,4,6,2])));assert(await page.evaluate(()=>window.__reveal()));await shot('four-dice-'+width);
    await page.evaluate(()=>window.__fallback());
    assert.deepEqual(await page.$$eval('[data-side="front"]',els=>els.map(e=>e.querySelectorAll('i').length)),[1,4,6]);
    await shot('fallback-'+width);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    results.push({width,webgl:true,threeAndFourDice:true,sync:true,fallbackPips:true});
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert(await page.$$eval('[data-die-index]',els=>els.every(e=>getComputedStyle(e).animationName==='none')));
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results,output}));
}finally{await browser?.close();await server.close();}
