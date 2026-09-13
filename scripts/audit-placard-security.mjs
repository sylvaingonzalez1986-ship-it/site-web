// Real React components, synthetic wallet: never writes to Supabase.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
const root = process.cwd(), output = resolve(root, "output/security-care");
const modules = {
 'next/image': "import React from 'react';export default function Image({src,fill,priority,unoptimized,...props}){return React.createElement('img',{...props,src});}",
 'energy-entry': `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
 import {KqEnergyPanel} from '/src/components/placard/KqEnergyPanel';import {quoteKqEnergy,quoteKqDogCare} from '/src/lib/kanab-quest-energy';
 const query=new URLSearchParams(location.search), codes=['LED-300','AIR-EC6','CLIMATE-SMART','SECURITY-FENCE'];
 const quotes=Object.fromEntries(['eco','balanced','intensive'].map(m=>[m,quoteKqEnergy(codes,{},m)]));
 let snapshot={cashCents:query.has('poor')?0:35000,outstandingCents:1377,invoiceCount:1,bestGramsPerKwh:3.51,quotes,invoices:[{runId:'11111111-1111-4111-8111-111111111111',createdAt:'2026-09-11T12:00:00Z',totalCents:1377,remainingCents:1377,harvestGrams:161.1,quote:quotes.balanced}]};
 snapshot.dogCare=quoteKqDogCare(query.get('view')==='choose'?9:10);snapshot.outstandingCents=quotes.balanced.totalCents;snapshot.invoices[0].totalCents=quotes.balanced.totalCents;snapshot.invoices[0].remainingCents=quotes.balanced.totalCents; snapshot.invoices[0].dogCare={cycle:10,foodCents:800,vetCents:4000,totalCents:4800,paidCents:4800};snapshot.invoices[0].totalCents+=4800; window.__payments=[];window.__fail=false;window.fetch=async(url,init={})=>{
 if(init.method==='POST'){window.__payments.push(JSON.parse(init.body));await new Promise(r=>setTimeout(r,100));if(window.__fail){window.__fail=false;return new Response(JSON.stringify({error:'Réseau indisponible.'}),{status:503});}snapshot={...snapshot,cashCents:snapshot.cashCents-quotes.balanced.totalCents,outstandingCents:0,invoices:snapshot.invoices.map(i=>({...i,remainingCents:0}))};return new Response(JSON.stringify({paidCents:quotes.balanced.totalCents}));}
 return new Response(JSON.stringify(snapshot));};
 function App(){const [mode,setMode]=useState('balanced');return React.createElement('main',{style:{maxWidth:540,margin:'auto',padding:12}},React.createElement(KqEnergyPanel,query.get('view')==='choose'?{selectedMode:mode,onModeChange:setMode}:query.get('view')==='bill'?{lockedQuote:quotes.balanced,runId:snapshot.invoices[0].runId}:{}));}
 createRoot(document.getElementById('root')).render(React.createElement(App));`
};
const server = await createServer({ root, configFile:false, envDir:false, cacheDir:resolve(output,"vite-cache"),
  publicDir:resolve(root,"public"), optimizeDeps:{include:["react","react-dom/client","lucide-react"]},
  esbuild:{jsx:"automatic",loader:"tsx"}, resolve:{alias:{"@":resolve(root,"src")}},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},
  plugins:[{name:"equipment-audit",enforce:"pre",resolveId(id){if(id in modules)return "\0"+id;},
    async load(id){if(id.startsWith("\0")&&modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+".tsx",{lang:"tsx",jsx:{runtime:"automatic"}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split("?")[0]!=="/")return next();
      res.setHeader("Content-Type","text/html");res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-sans:Arial}body{margin:0;background:#0b252b}#root{height:100dvh;position:relative}</style><div id="root"></div><script type="module" src="/@id/__x00__energy-entry"></script></html>');});}}],
  server:{host:"127.0.0.1",port:3210,strictPort:true,hmr:false,watch:null},
});
let browser;const errors=[];try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{if(r.url().startsWith('http://127.0.0.1:3210')||r.url().startsWith('data:'))void r.continue();else void r.abort();});
 const visit=async(q)=>{await page.goto('http://127.0.0.1:3210/?'+q,{waitUntil:'networkidle0'});await page.waitForSelector('section[aria-label="Charges du Placard"]');await page.waitForFunction(()=>document.body.textContent.includes('Compagnon'));};
 for(const width of [320,390,768,1440]){await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});for(const view of ['choose','bill','dashboard']){await visit('view='+view);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);if(view==='choose'){await page.$$eval('[role="group"] button',els=>els[2].click());assert.equal(await page.$eval('[aria-pressed="true"] strong',el=>el.textContent),'Intensif');}await page.screenshot({path:resolve(output,view+'-'+width+'.png'),fullPage:true});}}
 await visit('view=bill&poor');assert.equal(await page.$$eval('button',els=>els.find(el=>el.textContent.includes('Tout régler')).disabled),true);
 await visit('view=bill');await page.evaluate(()=>{window.__fail=true;});const pay=()=>page.$$eval('button',els=>els.find(el=>el.textContent.includes('Tout régler')).click());await pay();await page.waitForSelector('[role="alert"]');await pay();await page.waitForFunction(()=>document.body.textContent.includes('Factures acquittées'));
 assert.equal(await page.evaluate(()=>window.__payments.length),2);assert.equal(await page.evaluate(()=>window.__payments[0].requestKey===window.__payments[1].requestKey),true);assert.equal(await page.evaluate(()=>document.body.textContent.includes('Aucune facture en attente')),true);assert.deepEqual(errors,[]);await writeFile(resolve(output,'browser-report.json'),JSON.stringify({views:12,overflow:false,paymentRetry:true,insufficientCash:true,errors},null,2));console.log('PASS: 12 responsive views, mode selection, insufficient cash, retry using same payment key, cleared invoice.');
}finally{await browser?.close();await server.close();}
