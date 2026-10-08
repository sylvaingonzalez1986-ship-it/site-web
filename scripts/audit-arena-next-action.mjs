/** Real arena home with a synthetic signed-in context; all APIs are intercepted. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/arena-next-action'),origin='http://127.0.0.1:3264';
const smoke=process.argv.includes('--smoke');
const profile={nickname:'CamilleAudit',gender:'female',clothing:'teal',skin:'honey',strength:'green-thumb'};
const cases={
  culture:{activeRun:true,readyLotCount:0,availableFlowerCount:0,supportPackCount:0,buddiePackCount:0,href:'/arene/placard?view=game'},
  lot:{activeRun:false,readyLotCount:2,availableFlowerCount:0,supportPackCount:0,buddiePackCount:0,href:'/arene/placard?view=market'},
  flower:{activeRun:false,readyLotCount:0,availableFlowerCount:2,supportPackCount:0,buddiePackCount:0,href:'/arene/placard?view=arena'},
  buddies:{activeRun:false,readyLotCount:0,availableFlowerCount:0,supportPackCount:0,buddiePackCount:2,href:'/profil/collection'},
  support:{activeRun:false,readyLotCount:0,availableFlowerCount:0,supportPackCount:2,buddiePackCount:0,href:'/arene/placard?view=shop'},
  ready:{activeRun:false,readyLotCount:0,availableFlowerCount:0,supportPackCount:0,buddiePackCount:0,href:'/arene/placard?view=game'},
  mixed:{activeRun:true,readyLotCount:2,availableFlowerCount:2,supportPackCount:2,buddiePackCount:2,href:'/arene/placard?view=game'},
  'mixed-lot':{activeRun:false,readyLotCount:2,availableFlowerCount:2,supportPackCount:2,buddiePackCount:2,href:'/arene/placard?view=market'},
  'mixed-flower':{activeRun:false,readyLotCount:0,availableFlowerCount:2,supportPackCount:2,buddiePackCount:2,href:'/arene/placard?view=arena'},
  'mixed-packs':{activeRun:false,readyLotCount:0,availableFlowerCount:0,supportPackCount:2,buddiePackCount:2,href:'/profil/collection'},
};
let scenario='ready',failure=false;
const report={passed:false,fixture:'Real ContestArenaHub, synthetic customer; intercepted local API only.',results:[],requests:[],unexpectedApi:[],blockedRemote:[],errors:[]};
const modules={
  fixture:`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {ContestArenaHub} from '/src/components/contest/ContestArenaHub';const scenario=new URLSearchParams(location.search).get('scenario');createRoot(document.getElementById('root')).render(React.createElement(ContestArenaHub,{personalSummaryEnabled:scenario!=='guest',activitiesLocked:scenario==='locked'}));`,
  cart:`export const useCart=()=>({user:new URLSearchParams(location.search).get('scenario')==='guest'?null:{id:'local-resume-audit',email:'fixture@example.invalid',firstName:'Camille'},isAuthenticated:new URLSearchParams(location.search).get('scenario')!=='guest',authLoading:false,sessionLoading:false});`,
  consent:`export const useCookieConsent=()=>({showBanner:false});`,
  'next/image':`import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic':`import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(value=>({default:value.default||value})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props))}`,
  'next/navigation':`export const usePathname=()=>'/arene';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:path=>location.assign(path),replace:path=>location.replace(path),refresh:()=>{}});`,
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}`;
const server=await createServer({configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:'arena-next-action-fixture',enforce:'pre',resolveId(id){if(id.endsWith('/context/CartContext'))return '\0cart';if(id.endsWith('/cookies/CookieConsentProvider'))return '\0consent';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{
    const path=req.url?.split('?')[0];if(path==='/arene'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>`);return;}
    if(path?.startsWith('/arene/')||path?.startsWith('/compte/')||path?.startsWith('/profil')){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><h1 data-audit-destination>Destination locale simulée</h1>');return;}
    next();
  });}}],server:{host:'127.0.0.1',port:3264,strictPort:true,hmr:false,watch:null}});
let browser,page;
const action='[data-arena-player-resume]',primary='[data-resume-primary]';
async function visit(next,width){scenario=next;await page.setViewport({width,height:900});await page.goto(`${origin}/arene?scenario=${next}`,{waitUntil:'networkidle0'});await page.waitForSelector('[data-arena-activity="jouer"]');}
async function screenshot(name){await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}: horizontal overflow`);}
try{
  await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
  page.on('pageerror',error=>report.errors.push({scenario,message:error.message}));await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());if(url.protocol==='data:'||url.protocol==='blob:')return void request.continue();
    if(url.origin!==origin){report.blockedRemote.push({url:url.origin+url.pathname,method:request.method()});return void request.abort();}
    if(!url.pathname.startsWith('/api/'))return void request.continue();
    const record={scenario,method:request.method(),path:url.pathname};report.requests.push(record);const respond=(status,body)=>void request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
    if(request.method()!=='GET'){report.unexpectedApi.push(record);return respond(405,{error:'No writes allowed in this audit.'});}
    if(scenario==='guest')return respond(401,{error:'Synthetic guest'});
    const state=cases[scenario]??cases.ready;
    if(url.pathname==='/api/arena/tutorial')return respond(200,{userId:'local-resume-audit',chanvrier:profile,progress:{step:9,status:'completed'},persisted:true});
    if(url.pathname==='/api/arena/chanvrier')return respond(200,{profile});
    if(url.pathname==='/api/arena/placard/summary'){
      if(scenario.startsWith('hidden-'))return respond(Number(scenario.split('-')[1]),{error:'Access unavailable'});
      return respond(failure?503:200,failure?{error:'Summary unavailable'}:state);
    }
    if(url.pathname==='/api/arena/placard/equipment')return respond(failure?503:200,failure?{error:'Summary unavailable'}:{...state,productionUnits:1,ownedCodes:['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'],cashCents:20000});
    if(url.pathname==='/api/arena/placard/boosters')return respond(200,{collectionActive:true,costPerPack:5,spendablePoints:0,welcomeClaimed:true,availableEntitlements:Array.from({length:state.supportPackCount},(_,index)=>({id:`fixture-pack-${index}`,source:'mission',cardCount:3,createdAt:'2026-10-07T12:00:00Z'}))});
    report.unexpectedApi.push(record);return respond(503,{error:'Unconfigured local fixture API'});
  });
  for(const width of [390,1440]){
    for(const [name,expected] of Object.entries(cases)){
      await visit(name,width);
      if(smoke){await screenshot(`${name}-${width}`);report.results.push({name,width,smoke:true});continue;}
      await page.waitForSelector(`${action}[data-resume-status="ready"]`);const link=await page.$(primary);assert(link,`${name}: one primary action`);const href=await link.evaluate(el=>el.getAttribute('href'));
      assert.equal(href,expected.href,`${name}: correct continuation`);assert.equal(await page.$$eval(primary,nodes=>nodes.length),1);assert((await link.boundingBox()).height>=44);await screenshot(`${name}-${width}`);
      await link.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await link.click();await page.waitForSelector('[data-audit-destination]');assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,href);
      report.results.push({name,width,href});
    }
    for(const name of ['guest','locked']){const before=report.requests.length;await visit(name,width);assert.equal(await page.$(action),null);assert.equal(report.requests.slice(before).filter(row=>row.path==='/api/arena/placard/summary').length,0);await screenshot(`${name}-${width}`);report.results.push({name,width});}
  }
  if(!smoke){
    for(const status of [401,403,404]){await visit(`hidden-${status}`,390);assert.equal(await page.$(action),null);report.results.push({name:`hidden-${status}`,width:390});}
    failure=true;await visit('ready',390);await page.waitForSelector(`${action}[data-resume-status="error"] button`);failure=false;await page.click(`${action} button`);await page.waitForSelector(primary);report.results.push({name:'summary-retry',width:390});
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpectedApi,[]);assert.deepEqual(report.blockedRemote,[]);report.passed=true;
}catch(error){report.failure=error.stack;await screenshot('failure').catch(()=>undefined);process.exitCode=1;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();await server.close();}
