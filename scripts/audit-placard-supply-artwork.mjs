/** Real care, storage and online packaging components with local read-only fixtures. */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const root = process.cwd(), output = resolve(root, 'output/placard-supply-artwork');
const port = Number(process.env.SUPPLY_ARTWORK_PORT ?? 3274), origin = `http://127.0.0.1:${port}`;
const modules = {
  entry: `import React from 'react';import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {KqCareShop} from '/src/components/placard/KqCareShop';
    import {KqWarehouseStorage} from '/src/components/placard/KqWarehouseStorage';
    import {KqOnlineStore} from '/src/components/placard/KqOnlineStore';
    import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
    import {createKqOperationsLesson,getKqOperationsStorage,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
    const state = createKqOperationsLesson('market');
    window.__requests = [];
    const request = async(input,init={}) => {
      const path = new URL(String(input),location.origin).pathname, method = init.method ?? 'GET';
      window.__requests.push({path,method});
      if(method !== 'GET') throw new Error('This artwork fixture is read-only');
      if(path === '/api/arena/placard/storage') return Response.json(getKqOperationsStorage(state));
      throw new Error('Unmocked request: '+path);
    };
    const api = createKqTutorialApi(request);
    const section = new URLSearchParams(location.search).get('section');
    createRoot(document.getElementById('root')).render(<main><KqTutorialApiProvider api={api}>
      {section === 'storage' ? <KqWarehouseStorage/> : section === 'packaging' ? <KqOnlineStore data={getKqOperationsCommerce(state)} busy={false} onAsk={()=>{}} onOpenShop={()=>{}}/> : <KqCareShop request={request} storage={sessionStorage} embedded/>}
    </KqTutorialApiProvider></main>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
  resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'supply-artwork',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},
    async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Illustrations de Kanab Quest · local</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0!important;background:#bfe9db!important}main{max-width:1240px;margin:auto;padding:12px;container-type:inline-size}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>');});}}],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
const sourcePaths = ['src/lib/kanab-quest-care-artwork.ts','src/lib/kanab-quest-storage-artwork.ts','src/lib/kanab-quest-online.ts'];
const assets = new Set();
for(const path of sourcePaths) for(const match of (await readFile(resolve(root,path),'utf8')).matchAll(/\/placard\/equipment-sylvain-v1\/[a-z0-9-]+\.webp/g)) assets.add(match[0]);
const checks = [], errors = [], forbiddenRequests = [];
let browser, page;
try {
  await mkdir(output,{recursive:true});
  assert.equal(assets.size,23,'23 distinct supply illustrations');
  for(const path of assets) {
    const metadata = await sharp(resolve(root,'public'+path)).metadata();
    assert.equal(metadata.width,512,path+' width');assert.equal(metadata.height,512,path+' height');assert.equal(metadata.hasAlpha,true,path+' transparency');
  }
  checks.push('23 mapped images exist as transparent 512×512 WebP files');
  await server.listen();
  browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page = await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||url.protocol==='data:')void request.continue();else {forbiddenRequests.push(request.url());void request.abort();}});
  const selector = 'img[src^="/placard/equipment-sylvain-v1/"]';
  const verify = async(name,count) => {
    await page.waitForFunction((selector,count)=>{const images=[...document.querySelectorAll(selector)];return images.length===count&&images.every(img=>img.complete&&img.naturalWidth===512&&img.naturalHeight===512);},{},selector,count);
    assert.ok(await page.$$eval(selector,images=>images.every(img=>getComputedStyle(img).objectFit==='contain')),'Uncropped illustrations: '+name);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow: '+name);
    assert.ok(await page.evaluate(()=>window.__requests.every(request=>request.method==='GET')),'Read-only fixture: '+name);
    await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});
    checks.push(name+': '+count+' images load without cropping or page overflow');
  };
  for(const width of [320,390,1440]) {
    await page.setViewport({width,height:1000,isMobile:width<700,hasTouch:width<700});
    await page.goto(origin+'/?section=care',{waitUntil:'networkidle0'});
    await verify('care-input-'+width,4);
    await page.click('[aria-label="Rayon"] button:nth-child(2)');
    await verify('care-pbi-'+width,6);
    await page.goto(origin+'/?section=storage',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-container-code]');
    await page.click('[data-storage-shop] > summary');
    await verify('containers-'+width,10);
    await page.goto(origin+'/?section=packaging',{waitUntil:'networkidle0'});
    await verify('packaging-5-'+width,3);
    const format = await page.$('select:has(option[value="10"])');
    assert.ok(format,'Packaging format selector');await format.select('10');await format.dispose();
    await verify('packaging-10-'+width,3);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(forbiddenRequests,[]);
  checks.push('No JavaScript error or external network request');
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,fixture:'Local read-only operation data; production React components and CSS. next/image mocked as native img.',checks,assets:[...assets],errors,forbiddenRequests},null,2));
  console.log('Supply artwork audit: '+checks.length+' checks passed.');
} catch(error) {
  if(page) await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(resolve(output,'failure.json'),JSON.stringify({error:error.message,checks,errors,forbiddenRequests},null,2));
  throw error;
} finally {if(browser)await browser.close();await server.close();}
