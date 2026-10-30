/** Real workshop entry and UI. Local read-only responses; no live API or account. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer,transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(),output=resolve(root,'output/clarity-lot9/workshop');
const port=Number(process.env.WORKSHOP_INVENTORY_LOT9_PORT??3593),origin=`http://127.0.0.1:${port}`;
const publicManifest=await readFile(resolve(root,'public/placard/warehouse-v2/manifest.json'),'utf8');
const modules={
 'warehouse-manifest':`export default ${publicManifest};`,
entry:`
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqWarehouseEntry} from '/src/components/placard/KqWarehouseEntry';
import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
import {getKqMachineCondition} from '/src/lib/kanab-quest-maintenance';
import retro from '/src/components/contest/ArenaRetro.module.css';
const initial=new URLSearchParams(location.search).get('scenario')||'owned';let mode=initial,pending=[];
const owned=['SIFT-TRAY','PRESS-0600',...(initial==='maintenance'?['WASHER-25L']:[])];
const equipped=['SIFT-TRAY',...(initial==='maintenance'?['WASHER-25L']:[])];
const payload=(empty=false)=>({ownedCodes:empty?[]:owned,purchasedCodes:empty?[]:owned,equippedCodes:empty?[]:equipped,levels:Object.fromEntries(owned.map(code=>[code,1])),cashCents:empty?0:12345,tentNumber:1,productionUnits:1,maintenance:Object.fromEntries(owned.map(code=>[code,getKqMachineCondition(code,1,code==='WASHER-25L'?10:2)]))});
window.__calls=[];window.__openedShop=[];
const response=()=>mode==='error'?Response.json({error:'Inventaire temporairement indisponible.'},{status:503}):mode==='invalid'?Response.json({ownedCodes:[]}):Response.json(payload(mode==='empty'));
const request=async(input,init)=>{const path=new URL(String(input),location.origin).pathname,method=init?.method||'GET';window.__calls.push({path,method});if(method!=='GET')throw new Error('Mutation forbidden in workshop audit');if(path.endsWith('/equipment'))return mode==='loading'?new Promise(resolve=>pending.push(resolve)):response();return Response.json({error:'Not part of this fixture'},{status:404});};
const api=createKqTutorialApi(request);api.isTutorial=false;
window.__mode=value=>{mode=value;};window.__refresh=value=>{mode=value;api.notify('kq:equipment-updated');};window.__resolve=value=>{mode=value;pending.splice(0).forEach(resolve=>resolve(response()));};
createRoot(document.getElementById('root')).render(<div className={retro.surface}><KqTutorialApiProvider api={api}><KqWarehouseEntry embedded workshopOnly onClose={()=>{}} onOpenShop={code=>window.__openedShop.push(code)}/></KqTutorialApiProvider></div>);
`,
'next/image':`import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
'next/navigation':`export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`,
'next/dynamic':`import React from 'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>;}`,
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react','@3d-dice/dice-box-threejs']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'workshop-inventory-lot9',enforce:'pre',resolveId(id){if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-manifest';if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inventaire Atelier · recette locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
const results=[],errors=[],consoleErrors=[],external=[];const report={passed:false,results,errors,consoleErrors,external,backend:'In-memory responses; all mutations and remote network calls rejected.'};let browser,page;
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin===origin&&u.pathname==='/favicon.ico')void r.respond({status:204});else if(['data:','blob:'].includes(u.protocol)||u.origin===origin&&!u.pathname.startsWith('/api/'))void r.continue();else{external.push(r.url());void r.abort();}});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const enter=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.focus(selector);await page.keyboard.press('Enter');await frames();};
 const shot=async name=>{await page.evaluate(()=>Promise.allSettled([...document.images].map(img=>img.decode())));await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
 const load=async scenario=>{await page.goto(origin+'/?scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector('[data-workshop-only]');await page.evaluate(()=>document.fonts.ready);};
 const state=async(code,label)=>assert.equal(await page.$eval(`[data-workshop-machine="${code}"] [data-workshop-machine-state]`,e=>e.textContent),label);
 const unchanged=async()=>{assert.deepEqual(await page.evaluate(()=>window.__calls.filter(call=>call.method!=='GET')),[]);assert.deepEqual(await page.evaluate(()=>window.__openedShop),[]);};
 const layout=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal document overflow');
 const unknown=async()=>{assert.equal(await page.$('[data-workshop-scene]'),null,'Unknown data never becomes an empty workshop');assert.equal(await page.$eval('[data-inventory-balance] strong',e=>e.textContent),'—');assert.equal(await page.evaluate(()=>/0 \/ 6|À acquérir|0,00/.test(document.body.textContent)),false,'No fabricated zero or unowned state');};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
  for(const scenario of ['loading','error','invalid','empty','owned','maintenance']){
   await load(scenario);
   if(['loading','error','invalid'].includes(scenario)){
    await page.waitForSelector(`[data-inventory-state="${scenario==='loading'?'loading':'unavailable'}"]`);await unknown();
    assert.equal(await page.$$eval('[data-inventory-state]',els=>els.length),1,'One concise inventory status');
    await shot(scenario+'-'+width);await layout();await unchanged();results.push({width,scenario,unknown:true});
    if(scenario==='loading')await page.evaluate(()=>window.__resolve('owned'));
    else{await page.evaluate(()=>window.__mode('owned'));await enter('[data-inventory-state] button');}
    await page.waitForSelector('[data-workshop-scene]');await state('PRESS-0600','À installer');assert.match(await page.$eval('[data-inventory-balance]',e=>e.textContent),/123,45/);
    if(scenario!=='loading')assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-workshop-machine')),'SIFT-TRAY','Retry recovery returns focus to the first actionable machine');
    await unchanged();results.push({width,scenario:scenario+'-recovery',keyboard:true});
    continue;
   }
   await page.waitForSelector('[data-workshop-scene]');
   if(scenario==='empty'){
    assert.match(await page.$eval('[data-workshop-scene]',e=>e.textContent),/0 \/ 6 machines acquises/);
    assert.equal(await page.$$eval('[data-workshop-machine-state]',els=>els.filter(e=>e.textContent==='À acquérir').length),6,'A confirmed empty inventory can truthfully say not acquired');
    assert.match(await page.$eval('[data-inventory-balance]',e=>e.textContent),/0\s*€/);
   }else{
    await state('SIFT-TRAY','Installée');await state('PRESS-0600','À installer');if(scenario==='maintenance')await state('WASHER-25L','À entretenir');
    const labels=await page.$$eval('[data-workshop-machine-state]',els=>els.map(e=>{const label=e.parentElement,r=label.getBoundingClientRect();return{text:label.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,visible:e.checkVisibility(),fontSize:parseFloat(getComputedStyle(e).fontSize),clipped:e.scrollWidth>e.clientWidth+1||label.scrollWidth>label.clientWidth+1};}));
    assert.ok(labels.every(label=>label.fontSize>=12),'Every essential machine status is at least 12px');
    assert.ok(labels.every(label=>label.visible&&!label.clipped&&label.left>=0&&label.right<=width),'Statuses are visible text, with no clipping');
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)assert.ok(labels[i].right<=labels[j].left||labels[j].right<=labels[i].left||labels[i].bottom<=labels[j].top||labels[j].bottom<=labels[i].top,'Machine statuses never overlap');
    await enter('[data-workshop-machine="PRESS-0600"]');await page.waitForSelector('[data-workshop-machine-summary="PRESS-0600"]');
    assert.ok(await page.$$eval('button',els=>els.some(e=>e.checkVisibility()&&!e.disabled&&e.textContent.includes('Installer dans l’atelier commun'))),'A reserve machine opens its installation option');
    await page.keyboard.press('Escape');await page.waitForSelector('[data-workshop-machine-summary="PRESS-0600"]',{hidden:true});
    assert.equal(await page.$eval('[data-workshop-machine="PRESS-0600"]',e=>document.activeElement===e),true,'Machine dialog returns focus to the source');
   }
   await layout();await unchanged();await shot(scenario+'-'+width);results.push({width,scenario,visibleStates:true,keyboard:true});
   if(scenario==='owned'){
    await page.evaluate(()=>window.__refresh('loading'));await page.waitForSelector('[data-inventory-state="refreshing"]');await state('SIFT-TRAY','Installée');
    assert.match(await page.$eval('[data-inventory-balance]',e=>e.textContent),/123,45/);assert.equal(await page.$$eval('[data-workshop-machine]',els=>els.every(e=>e.disabled)),true);
    await page.evaluate(()=>window.__resolve('error'));await page.waitForSelector('[data-inventory-state="stale"]');await state('PRESS-0600','À installer');await shot('refresh-failed-'+width);
    assert.match(await page.$eval('[data-inventory-state]',e=>e.textContent),/Dernières données connues.*non actualisé/s);assert.equal(await page.$$eval('[data-workshop-machine]',els=>els.every(e=>e.disabled)),true);
    await page.evaluate(()=>window.__mode('empty'));await enter('[data-inventory-state] button');await page.waitForFunction(()=>!document.querySelector('[data-inventory-state]'));
    assert.match(await page.$eval('[data-workshop-scene]',e=>e.textContent),/0 \/ 6 machines acquises/);assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-workshop-machine')),'SIFT-TRAY','Fresh inventory remains reachable after keyboard retry');await unchanged();results.push({width,scenario:'refresh-failed-and-recovered',previousDataPreserved:true,keyboard:true});
   }
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(external,[]);report.passed=true;console.log(JSON.stringify({passed:true,observations:results.length,output}));
}catch(error){report.failure=error.stack;throw error;}finally{await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
