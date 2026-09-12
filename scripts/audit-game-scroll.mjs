/** Browser regression: real viewport/lock hooks, synthetic content, no API writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import ts from 'typescript';

const root = process.cwd(), output = resolve(root, 'output/game-scroll');
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useGameViewport} from '/src/hooks/useGameViewport';
import {useBodyScrollLock} from '/src/hooks/useBodyScrollLock';
const baseline = new URLSearchParams(location.search).has('baseline');
const useViewport = baseline ? () => React.useRef(null) : useGameViewport;
function Modal({children}) {
  useBodyScrollLock(true);
  return <div role="dialog" style={{position:'fixed',inset:40,background:'#fff',zIndex:2}}>{children}</div>;
}
function Game() {
  const [view,setView] = React.useState('game');
  const [height,setHeight] = React.useState(2600);
  const [modal,setModal] = React.useState(0);
  const ref = useViewport(view);
  window.fixture = {resize:setHeight, modal:setModal, navigate:()=>{setModal(0);setView('market');setHeight(1100);}};
  return <><main ref={ref} style={{height,background:'#d9efe4'}}>
    <h1 style={{margin:0}}>{view}</h1><button onClick={()=>setHeight(950)}>Valider</button>
    {modal>0 && <Modal><button onClick={()=>setModal(0)}>Fermer</button>{modal>1 && <Modal>Catalogue</Modal>}</Modal>}
  </main><footer style={{height:1800,background:'#eee'}}>Pied de page permanent</footer></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Game/></React.StrictMode>);
`;
const server = await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),
  esbuild:{jsx:'automatic'},optimizeDeps:{include:['react','react-dom/client']},
  plugins:[{name:'scroll-fixture',resolveId(id){if(id==='scroll-entry')return '\0scroll-entry.tsx';},
    load(id){if(id==='\0scroll-entry.tsx')return ts.transpileModule(entry,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/')return next();
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__scroll-entry.tsx"></script></html>');
    });}}],server:{host:'127.0.0.1',port:3195,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;
const results = [], errors = [];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox']});
  const page = await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  const settle = () => page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const visit = async baseline => {await page.goto('http://127.0.0.1:3195/'+(baseline?'?baseline':''),{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.fixture);};
  const position = () => page.evaluate(()=>({y:scrollY,bottom:document.querySelector('main').getBoundingClientRect().bottom,overflow:document.documentElement.style.overflow}));
  for (const width of [390,1440]) {
    await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
    // Without the guard, shrinking the game really does leave only the footer visible.
    await visit(true);
    await page.evaluate(()=>scrollTo(0,1500));await settle();
    await page.evaluate(()=>fixture.resize(950));await settle();
    assert((await position()).bottom<=0,'Reproduce the reported footer jump');
    await visit(false);
    await page.evaluate(()=>scrollTo(0,1500));await settle();
    await page.evaluate(()=>fixture.resize(950));await settle();
    assert((await position()).bottom>=840,'Keep the shorter result visible');
    // Updating content at a stable height must preserve the player's position.
    await page.evaluate(()=>{fixture.resize(2600);});await settle();
    await page.evaluate(()=>scrollTo(0,600));await settle();
    await page.evaluate(()=>fixture.resize(2800));await settle();
    assert.equal((await position()).y,600);
    // A deliberate visit to the footer must never be pulled back into the game.
    await page.evaluate(()=>scrollTo(0,2900));await settle();
    await page.evaluate(()=>fixture.resize(2400));await settle();
    assert((await position()).bottom<0);
    await page.evaluate(()=>scrollTo(0,600));await settle();
    await page.evaluate(()=>fixture.modal(2));await settle();
    assert.equal((await position()).overflow,'hidden');
    await page.evaluate(()=>fixture.modal(1));await settle();
    assert.equal((await position()).overflow,'hidden','Closing one nested window keeps its parent locked');
    await page.evaluate(()=>fixture.modal(0));await settle();
    assert.equal((await position()).overflow,'');
    assert.equal((await position()).y,600,'Closing a window keeps the current position');
    await page.evaluate(()=>fixture.modal(2));await settle();
    await page.evaluate(()=>fixture.navigate());await settle();
    assert.equal((await position()).y,0,'Navigation from a modal must not restore its opening position');
    await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>{fixture.resize(3000);resolve();},700)));await settle();
    assert.equal((await position()).y,0,'Late content must not drag the viewport down');
    assert.equal((await position()).overflow,'');
    await page.screenshot({path:resolve(output,'navigation-'+width+'.png')});
    results.push({width,footerRegression:true,nestedModals:true,lateContent:true,manualFooterScroll:true});
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results},null,2));
  console.log(JSON.stringify({passed:true,results}));
} finally {await browser?.close();await server.close();}
