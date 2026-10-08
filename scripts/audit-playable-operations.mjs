import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/playable-operations'), origin = 'http://127.0.0.1:3262';
const modules = {
  'warehouse-manifest': `export default ${await readFile(resolve(root,'public/placard/warehouse-v2/manifest.json'),'utf8')}`,
  fixture: `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {KqPlayableOperationsLesson} from '/src/components/placard/KqPlayableOperationsLesson';createRoot(document.getElementById('root')).render(React.createElement(KqPlayableOperationsLesson,{lesson:new URLSearchParams(location.search).get('lesson')||'equipment',onProgress:p=>window.__progress=p}));`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/navigation': `export const usePathname=()=>'/arene';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({ configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'operations-audit',enforce:'pre',resolveId(id){if(id.endsWith('warehouse-v2/manifest.json'))return '\0warehouse-manifest';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#073c31;font-family:Arial}button{font-family:inherit}</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>');});}}],server:{host:'127.0.0.1',port:3262,strictPort:true,hmr:false,watch:null}});
let browser,page;
const errors=[],api=[],results=[];
async function button(text,scope='body'){
  const handle = await page.evaluateHandle(({text,scope})=>[...document.querySelectorAll(scope+' button')].find(el=>el.getClientRects().length&&!el.disabled&&el.textContent.replace(/\s+/g,' ').includes(text)),{text,scope});
  const el=handle.asElement();assert(el,`Missing button ${text}`);await el.scrollIntoView();await el.click();await handle.dispose();
}
async function textReady(text){await page.waitForFunction(text=>document.body.textContent.includes(text),{},text);}
async function snap(name){await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert(overflow<=1,`overflow ${name}: ${overflow}`);}
async function visit(lesson,width,clear=true){await page.setViewport({width,height:900,deviceScaleFactor:1});await page.goto(origin+'/?lesson='+lesson,{waitUntil:'networkidle0'});if(clear){await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('kq-playable-operations-v1:')).forEach(key=>sessionStorage.removeItem(key)));await page.reload({waitUntil:'networkidle0'});}await page.waitForSelector(`[data-playable-operations="${lesson}"]`);}
try{
  await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(60000);
  page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/api/')){api.push({url:url.pathname,method:request.method()});return void request.respond({status:500,contentType:'application/json',body:'{"error":"Network prohibited in lesson"}'});}if(url.protocol!=='data:'&&url.origin!==origin)return void request.abort();void request.continue();});
  await page.evaluateOnNewDocument(()=>{sessionStorage.setItem('kq:selected-tent','8');sessionStorage.setItem('operations-audit-sentinel','unchanged');window.__globalUpdates=0;window.addEventListener('kq:equipment-updated',()=>window.__globalUpdates++);});
  for(const width of [320,390,1440]){
    await visit('equipment',width);await textReady('Le rayon matériel');await snap(`equipment-${width}`);
    await page.waitForSelector('button[aria-label="Voir LED spéciale 300 W"]');
    await button('Ajouter','article:has(button[aria-label="Voir LED spéciale 300 W"])');
    await page.click('button[aria-label^="Ouvrir le panier"]');
    await button('Valider');
    await button('Confirmer');
    await page.waitForSelector('[aria-labelledby="equipment-purchase-title"]');
    await button('Installer', '[role="dialog"][aria-labelledby="equipment-purchase-title"]');
    await page.waitForSelector('[data-arena-tour-surface="warehouse"]');
    await page.click('[data-warehouse-slot="lighting"]');
    await page.waitForSelector('select');await page.select('select','LED-300');await button('Installer · tente');
    await page.waitForFunction(()=>window.__progress?.complete===true);
    await snap(`equipment-installed-${width}`);
    const saved=await page.evaluate(()=>sessionStorage.getItem('kq-playable-operations-v1:discovery:equipment'));
    assert.equal(JSON.parse(saved).actions.filter(a=>a.method==='POST').length,1);
    await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__progress?.complete===true);
    await button('Énergie','nav[aria-label="Espaces de cet essai"]');await button('Éco','[aria-label="Mode énergétique"]');await page.waitForFunction(()=>document.querySelector('[aria-label="Mode énergétique"] [aria-pressed="true"]')?.textContent.includes('Éco'));
    results.push({lesson:'equipment',width,purchaseInstallReplay:true});

    await visit('warehouse',width);await page.waitForSelector('[data-warehouse-slot]');await snap(`warehouse-${width}`);
    await page.click('[data-warehouse-slot="lighting"]');await textReady('LED spéciale 300 W');
    await button('Niveau 2 ·');await page.waitForFunction(()=>window.__progress?.complete===true);await page.waitForSelector('[data-warehouse-slot="lighting"][aria-label*="niveau 2"]');await snap(`warehouse-upgraded-${width}`);
    results.push({lesson:'warehouse',width,upgrade:true});
    if(width===390){
      await page.click('[data-warehouse-slot="washing"]');await button('Réparer ·');await textReady('Entretien dans 10 cycles');
      await page.click('[aria-label="Ajouter la tente 2 · voir le devis"]');await button('Ajouter cette tente');await page.waitForSelector('[data-warehouse-slot="tent"][data-tent-number="2"]');
      results.push({lesson:'warehouse',width,repairAndExpansion:true});
    }

    await visit('market',width);await page.waitForSelector('[data-screen="lots"]');await snap(`market-${width}`);
    await button('Transformer');await page.waitForSelector('[data-screen="preparation"]');
    if(width===390)await page.select('[data-screen="preparation"] select','dry-sift');
    await button(width===390?'Transformer et continuer':'Préparer');await page.waitForSelector('dialog[open]');await button('Confirmer','dialog[open]');await page.waitForSelector('[data-screen="distribution"]');
    await button('Grossiste');await page.waitForSelector('[data-screen="offer"]');await button('Vendre');await page.waitForSelector('dialog[open]');await button('Confirmer','dialog[open]');await page.waitForSelector('[data-screen="receipt"]');await page.waitForFunction(()=>window.__progress?.complete===true);await snap(`market-sold-${width}`);
    results.push({lesson:'market',width,sale:true});
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('kq:selected-tent')),'8');assert.equal(await page.evaluate(()=>sessionStorage.getItem('operations-audit-sentinel')),'unchanged');assert.equal(await page.evaluate(()=>window.__globalUpdates),0);
  }
  await page.evaluateOnNewDocument(()=>{Storage.prototype.getItem=()=>{throw new Error('Storage denied')};Storage.prototype.setItem=()=>{throw new Error('Storage denied')};Storage.prototype.removeItem=()=>{throw new Error('Storage denied')};});
  await visit('warehouse',390,false);await page.waitForSelector('[data-warehouse-slot="lighting"]');await page.click('[data-warehouse-slot="lighting"]');await button('Niveau 2 ·');await page.waitForFunction(()=>window.__progress?.complete===true);results.push({lesson:'warehouse',storageDenied:true});
  assert.deepEqual(api,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results,api,errors}));
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});console.error(error);console.error(await page?.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,aria:b.getAttribute('aria-label'),disabled:b.disabled})))) ;process.exitCode=1;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify({passed:!process.exitCode,results,api,errors},null,2));await browser?.close();await server.close();}
