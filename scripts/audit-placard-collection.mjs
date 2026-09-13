// Local browser integration: real collection, lobby, shop and profile; no remote writes.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
const root=process.cwd(),output=resolve(root,"output/placard-collection");
const modules={
 "collection-entry":`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqBotteCollection} from '/src/components/placard/KqBotteCollection';
import {KqPlacardLobby} from '/src/components/placard/KqPlacardLobby';
import {KqSupportBoosterShop} from '/src/components/placard/KqSupportBoosterShop';
import {BotteAlbumCollection} from '/src/components/account/BotteAlbumCollection';
import {KQ_CARDS} from '/src/lib/kanab-quest-game';
const query=new URLSearchParams(location.search);window.__counts=query.has('empty')?{}:query.has('complete')?Object.fromEntries(KQ_CARDS.map(c=>[c.code,1])):{'BOTTE-002':2,'BOTTE-004':1,'BOTTE-013':3};window.__fail=query.has('fail');window.__requests=[];
const original=window.fetch.bind(window);window.fetch=async(url,init={})=>{
 if(!String(url).startsWith('/api/'))return original(url,init);window.__requests.push({url,method:init.method||'GET'});
 if(String(url).endsWith('/collection')){
  await new Promise(r=>setTimeout(r,query.has('slow')?700:60));
  if(window.__fail)return new Response(JSON.stringify({error:'Collection temporairement indisponible.'}),{status:503});
  return new Response(JSON.stringify({collection:{cards:Object.entries(window.__counts).map(([code,ownedCopies])=>({code,ownedCopies}))}}));
 }
 if(String(url).endsWith('/bootstrap'))return new Response(JSON.stringify({collection:{cards:Object.entries(window.__counts).map(([code,ownedCopies])=>({code,ownedCopies}))}}));
 if(String(url).endsWith('/boosters'))return new Response(JSON.stringify({collectionActive:true,costPerPack:5,spendablePoints:50,welcomeClaimed:true,availableEntitlements:[]}));
 return new Response('{}');
};
function App(){const [view,setView]=useState(query.get('view')||'hub'),[open,setOpen]=useState(false);return <>{view==='hub'?<KqPlacardLobby onOpen={()=>setView('shop')} onOpenEquipment={()=>setView('shop')} onOpenCollection={()=>setOpen(true)}/>:view==='profile'?<BotteAlbumCollection isAuthenticated/>:<KqSupportBoosterShop autoOpen onOpenCollection={()=>setOpen(true)} onExit={()=>setView('hub')}/>} {open?<KqBotteCollection onClose={()=>setOpen(false)}/>:null}</>;}createRoot(document.getElementById('root')).render(<App/>);`,
 "next/image":`import React from 'react';export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 "@/components/navigation/NavigationLink":`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`,
 "next/dynamic":`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(()=>load().then(defaultExport=>({default:defaultExport})));return props=><Suspense fallback={null}><C {...props}/></Suspense>;}`,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom/client','react-dom','lucide-react']},esbuild:{jsx:'automatic',loader:'tsx'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},
 plugins:[{name:'collection-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;if(id.endsWith('/components/navigation/NavigationLink'))return '\0@/components/navigation/NavigationLink';},async load(id){if(id.startsWith('\0') && modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__collection-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3206,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[],results=[];
const album='dialog[aria-labelledby="botte-collection-title"]', detail='dialog[aria-labelledby="botte-detail-title"]';
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await page.setRequestInterception(true);page.on('request',r=>{if(r.url().startsWith('http://127.0.0.1:3206')||r.url().startsWith('data:'))void r.continue();else void r.abort();});
 const clickText=async(text)=>{const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text),text);assert.ok(handle.asElement(),text);await handle.asElement().click();};
 const visit=async(query='')=>{await page.goto('http://127.0.0.1:3206/?'+query,{waitUntil:'networkidle0'});};
 const open=async()=>{await page.waitForSelector('button[aria-haspopup="dialog"]');await clickText('Ma collection La Botte');await page.waitForSelector(album+'[open]');};
 const waitCards=async(n)=>{await page.waitForFunction((selector,n)=>document.querySelectorAll(selector+' button[data-owned]').length===n,{},album,n);};
 const snap=async(name)=>{await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:resolve(output,name+'.png')});};
 for(const [width,height]of[[320,740],[390,844],[768,1024],[1440,1000],[844,390]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await visit();await snap('entry-'+width);await open();await waitCards(32);
  assert.equal(await page.$$eval(album+' [data-owned=true]',els=>els.length),3);
  assert.equal(await page.$eval(album+' progress',el=>el.value),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.$eval(album,el=>el.scrollWidth>el.clientWidth+1),false);
  await snap('album-'+width);
  await clickText('Manquantes 29');await waitCards(29);await page.click(album+' button[data-owned=false]');await page.waitForSelector(detail+'[open]');
  assert.equal(await page.$eval(detail,el=>el.textContent.includes('Cette carte te manque')),true);
  assert.equal(await page.$eval(detail,el=>el.scrollWidth>el.clientWidth+1),false);
  await snap('detail-'+width);await page.keyboard.press('Escape');await page.waitForSelector(detail,{hidden:true});assert.equal(await page.$eval(album,d=>d.open),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.matches('button[data-owned=false]')),true);
  await clickText('Possédées 3');await waitCards(3);await page.type('[aria-label="Rechercher une carte"]','ombrage');await waitCards(1);await page.click(album+' button[data-owned=true]');await page.waitForSelector(detail+'[open]');
  assert.equal(await page.$eval(detail,el=>el.textContent.includes('3 exemplaires en stock')),true);
  await page.click('button[aria-label="Fermer la carte agrandie"]');await page.keyboard.press('Escape');await page.waitForSelector(album,{hidden:true});
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent.includes('Ma collection La Botte')),true);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');results.push({width,height,owned:3,missing:29,zoom:true,focusRestored:true});
 }
 await page.setViewport({width:390,height:844});await visit('view=shop');await snap('shop-entry');await clickText('Ma collection');await waitCards(32);await snap('shop-album');await page.keyboard.press('Escape');await page.waitForSelector(album,{hidden:true});assert.ok(await page.$('[aria-label="Quitter la boutique"]'));assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await visit('fail');await open();await page.waitForSelector(album+' [role=alert]');assert.equal(await page.$$eval(album+' button[data-owned]',els=>els.length),0);await page.evaluate(()=>window.__fail=false);await clickText('Réessayer');await waitCards(32);
 await page.evaluate(()=>{window.__counts['BOTTE-005']=1;window.dispatchEvent(new Event('kq:collection-updated'));});await page.waitForFunction(()=>document.querySelector('dialog progress')?.value===4);
 await visit('empty');await open();await waitCards(32);assert.equal(await page.$eval(album+' progress',el=>el.value),0);await clickText('Possédées 0');await waitCards(0);await clickText('Manquantes 32');await waitCards(32);await page.click(album+' button[data-owned=false]');await page.waitForSelector(detail+'[open]');await page.mouse.click(2,2);await page.waitForSelector(detail,{hidden:true});assert.equal(await page.$eval(album,d=>d.open),true);
 await visit('complete');await open();await waitCards(32);await clickText('Manquantes 0');await page.waitForFunction(()=>document.querySelector('dialog')?.textContent.includes('Tu possèdes toutes les cartes'));
 await visit('view=profile');await page.waitForSelector('button[aria-label="Agrandir Chrysope affamée"]');await page.click('button[aria-label="Agrandir Chrysope affamée"]');await page.waitForSelector(detail+'[open]');assert.equal(await page.$eval(detail,el=>el.textContent.includes('2 exemplaires en stock')),true);await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>window.__requests.every(r=>r.method==='GET')),true);assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors,retry:true,refresh:true,completeCollection:true,profileZoom:true,readOnly:true},null,2));console.log(JSON.stringify({viewports:results.length,zoom:true,filters:true,errors}));
}finally{await browser?.close();await server.close();}
