/** Real jury UI; synthetic server responses, no external requests or real writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/ux-implementation/jury'),port=3270,origin=`http://127.0.0.1:${port}`;
const modules={
  'jury-entry': `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
    import {createKqWarehouseStarter} from '/src/lib/kanab-quest-warehouse';
    import {KQ_BUDDIES} from '/src/lib/kanab-quest-game';
    const flower={id:'flower-demo',runId:'run-demo',varietyCode:KQ_BUDDIES[0].code,varietyName:'Fleur de recette',quality:84,traits:[],combos:[],stats:{aroma:80,resin:70,structure:75,vigor:60},status:'available',createdAt:'2026-10-14T10:00:00Z',queuedAt:null,lockedAt:null,burnedAt:null};
    const rounds=[1,2,3].map(i=>({code:'round-'+i,label:'Manche '+i,explanation:'Recette locale',playerScore:80,opponentScore:60,winner:'player'}));
    const battle={id:'battle-demo',status:'verdict',seed:123,playerFlower:{id:flower.id,variety:flower.varietyName,stats:flower.stats},opponentFlower:{id:'opponent-demo',variety:'Fleur adverse',stats:flower.stats},rounds,winner:'player',lockedAt:flower.createdAt,verdictAt:flower.createdAt,opponentType:'bot',experienceAwarded:100};
    const receipt={battleId:battle.id,winner:'player',burnedAt:flower.createdAt,experienceAwarded:100,todayCount:1,dailyLimit:5,opponentFlower:{...battle.opponentFlower,ownerName:'Bot de recette'},rounds,challengePoints:0,completedChallenges:[],rewardCard:null};
    const root=createRoot(document.getElementById('root'));let key=0;const network=fetch.bind(window);
    const state={mode:'success',readsFail:false,finished:false,submitted:false,requests:[]};window.__jury=state;
    const session=()=>({activeRun:null,activeRuns:[],flowers:[{...flower,status:state.finished?'burned':'available'}],battles:state.finished?[battle]:[],progress:null});
    window.fetch=async(input,init={})=>{
      const url=String(input);if(!url.startsWith('/api/'))return network(input,init);
      const path=new URL(url,location.origin).pathname,method=init.method??'GET';state.requests.push({path,method,time:performance.now()});
      if(path.endsWith('/bot-battles')&&method==='POST'){
        state.submitted=true;
        return new Promise((resolve,reject)=>{
          const abort=()=>reject(init.signal.reason);init.signal?.addEventListener('abort',abort,{once:true});
          if(state.mode==='timeout'){state.finished=true;state.readsFail=true;return;}
          setTimeout(()=>{state.finished=true;init.signal?.removeEventListener('abort',abort);resolve(Response.json(receipt));},state.mode==='slow'?1400:50);
        });
      }
      if(state.readsFail&&(path.endsWith('/flowers')||path.endsWith('/battles')))return Response.json({error:'Lecture momentanément indisponible'},{status:503});
      if(path.endsWith('/bootstrap'))return Response.json({collection:{ownerFound:true,collectionActive:true,inventory:{},availableInventory:{},cards:[]},ownedBuddieCodes:[flower.varietyCode],playerSession:session(),heritage:{cards:[]}});
      if(path.endsWith('/session'))return Response.json(session());
      if(path.endsWith('/warehouse'))return Response.json({state:createKqWarehouseStarter(),revision:0});
      if(path.endsWith('/flowers'))return Response.json({flowers:session().flowers});
      if(path.endsWith('/battles'))return Response.json({battles:session().battles});
      if(path.endsWith('/rankings'))return Response.json({entries:[]});
      return Response.json({progress:null});
    };
    window.__showJury=(mode)=>{state.mode=mode;state.readsFail=false;state.finished=false;state.submitted=false;state.requests=[];sessionStorage.clear();localStorage.clear();root.render(<KanabQuestDicePrototype key={++key} apiScope='player' showAdminOperations={false} viewMode='arena' onOpenMarket={()=>{document.body.dataset.navigated='market'}}/>);};window.__showJury('success');`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,sizes,...props}){return <img {...props} style={{...props.style,...(fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:{})}}/>}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,replace,scroll,...props}){return <a {...props}/>}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/compte/arene';export const useSearchParams=()=>new URLSearchParams();`,
  'next/dynamic': `export default function dynamic(){return ()=>null;}`,
};
const server=await createServer({configFile:false,envDir:false,root,publicDir:resolve(root,'public'),cacheDir:resolve(output,'vite-cache'),resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','lucide-react']},plugins:[{name:'jury-fixture',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Display;src:url("/src/app/fonts/BarlowCondensed-Latin-Black.woff2");font-weight:900}@font-face{font-family:Display;src:url("/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2");font-weight:800}@font-face{font-family:Body;src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}:root{--font-body:Body;--font-display:Display}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__jury-entry"></script></html>');});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[],results=[];
try{
  await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.setDefaultTimeout(35000);page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const url=new URL(r.url());if(url.origin===origin||url.protocol==='data:')void r.continue();else void r.abort();});
  const settle=()=>new Promise(resolve=>setTimeout(resolve,200));
  const clickText=async(text,scope='body')=>{const found=await page.evaluate(({text,scope})=>{const target=[...document.querySelectorAll(scope+' button')].find(b=>b.textContent.includes(text)&&!b.disabled);if(!target)return false;target.click();return true;},{text,scope});assert(found,'Clickable button '+text);};
  const openTraining=async()=>{await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Entraînement ·')&&!b.disabled));await clickText('Entraînement ·');await page.waitForSelector('#remote-battle-title');};
  for(const [width,height] of [[320,568],[844,390],[1440,1000]]){
    await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0'});await openTraining();
    const dimensions=await page.$eval('dialog[open]',d=>{const b=d.querySelector('header button'),r=b.getBoundingClientRect();return {w:r.width,h:r.height,visible:r.top>=0&&r.bottom<=innerHeight,overflow:d.scrollWidth>d.clientWidth+1,top:d.matches(':modal')};});assert(dimensions.w>=44&&dimensions.h>=44&&dimensions.visible&&dimensions.top&&!dimensions.overflow);
    await page.screenshot({path:resolve(output,`confirmation-${width}.png`)});await clickText('Lancer l’entraînement','dialog[open]');await page.waitForSelector('dialog[aria-labelledby="bot-result-title"]');
    await page.evaluate(()=>document.fonts.ready);
    const resultLayout=()=>page.$eval('dialog[open]',dialog=>{const button=dialog.querySelector('footer button'),rect=button.getBoundingClientRect(),body=dialog.querySelector('[data-app-dialog-body]'),title=dialog.querySelector('h2');return {footerVisible:rect.top>=0&&rect.bottom<=innerHeight&&rect.height>=44,bodyHeight:body.scrollHeight,overflow:dialog.scrollWidth>dialog.clientWidth+1,titleClipped:title.scrollWidth>title.clientWidth+1,analysisOpen:dialog.querySelector('[data-verdict-analysis]').open};});
    const summary=await resultLayout();assert(summary.footerVisible,'Continue stays visible without scrolling');assert(!summary.overflow&&!summary.titleClipped,'Compact verdict fits');assert(!summary.analysisOpen,'Detailed analysis starts closed');assert(summary.bodyHeight<600,'Summary stays short');
    await page.focus('[data-verdict-analysis] > summary');await page.keyboard.press('Enter');await page.waitForSelector('[data-verdict-analysis][open]');assert((await resultLayout()).footerVisible,'Continue remains visible while reading analysis');await page.keyboard.press('Enter');
    results.push({scenario:'compact-verdict',width,...summary});
    await page.screenshot({path:resolve(output,`result-${width}.png`)});await page.keyboard.press('Escape');await settle();assert.equal(await page.$$eval('dialog[open]',els=>els.length),0);results.push({scenario:'success',width,...dimensions});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.evaluate(()=>window.__showJury('slow'));await openTraining();await clickText('Lancer l’entraînement','dialog[open]');await page.waitForFunction(()=>window.__jury.submitted);await page.keyboard.press('Escape');await settle();assert.equal(await page.$$eval('dialog[open]',els=>els.length),0,'Pending request can be closed');await page.waitForFunction(()=>window.__jury.finished);await settle();assert.equal(await page.$$eval('dialog[open]',els=>els.length),0,'Late result does not reopen dismissed dialog');results.push({scenario:'close-pending'});
  await page.evaluate(()=>window.__showJury('timeout'));await openTraining();const started=Date.now();await clickText('Lancer l’entraînement','dialog[open]');await page.waitForFunction(()=>document.querySelector('[data-jury-recovery] button:not([disabled])'));const elapsed=Date.now()-started;assert(elapsed>=19_000&&elapsed<28_000,'20 second timeout');assert.equal(await page.evaluate(()=>window.__jury.requests.filter(r=>r.method==='POST').length),1,'Only one write while uncertain');assert(await page.$eval('dialog[open]',d=>[...d.querySelectorAll('button')].find(b=>b.textContent.includes('Lancer l’entraînement')).disabled),'Retry mutation blocked');
  await page.screenshot({path:resolve(output,'timeout-recovery.png')});await page.keyboard.press('Escape');await settle();assert.equal(await page.$$eval('dialog[open]',els=>els.length),0);assert(await page.$('[data-jury-recovery]'),'Recovery remains reachable outside dialog');
  await page.evaluate(()=>{window.__jury.readsFail=false;});await clickText('Vérifier le résultat');await page.waitForFunction(()=>!document.querySelector('[data-jury-recovery]'));assert.equal(await page.evaluate(()=>window.__jury.requests.filter(r=>r.method==='POST').length),1,'Checking a result never repeats the mutation');assert(await page.$('[data-archived-jury-recap]'),'Reconciled verdict is available in history');results.push({scenario:'timeout-then-read-recovery',elapsed});
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({passed:results.length,results,errors}));
}finally{await browser?.close();await server.close();}
