// Real components with local fixtures. No Supabase connection or real purchases.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(), output=resolve(root,'output/culture-wear'), origin='http://127.0.0.1:3228';
const modules={
 'warehouse-assets':`export default ${await readFile(resolve(root,'public/placard/warehouse-v2/manifest.json'),'utf8')};`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,unoptimized,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 'wear-entry':`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {KqEnergyPanel} from '/src/components/placard/KqEnergyPanel';import {KqWarehouseEntry} from '/src/components/placard/KqWarehouseEntry';import {getKqCultureEquipmentCondition,getKqCultureOperationalCodes} from '/src/lib/kanab-quest-culture-wear';import {quoteKqEnergy} from '/src/lib/kanab-quest-energy';
 const query=new URLSearchParams(location.search),starter=['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'],broken=query.has('broken')||query.has('warehouse');
 const state={ownedCodes:[...starter,'LED-300'],purchasedCodes:['LED-300'],equippedCodes:['TENT-080-STARTER','LED-300','AIR-STARTER'],levels:{'LED-300':4},cashCents:query.has('poor')?0:100000,activeRun:query.has('active'),cultureWear:{'LED-300':getKqCultureEquipmentCondition('LED-300',4,broken?100:77,12)}};
 window.__state=state;window.__requests=[];window.__fail=false;
 const original=window.fetch.bind(window);window.fetch=async(url,init={})=>{if(!String(url).startsWith('/api/'))return original(url,init);
 if(init.method==='PATCH'){const body=JSON.parse(init.body);window.__requests.push(body);if(window.__fail){window.__fail=false;return new Response(JSON.stringify({error:'Connexion interrompue.'}),{status:503});}assertReplace(body);state.cashCents-=body.expectedCostCents;state.cultureWear['LED-300']=getKqCultureEquipmentCondition('LED-300',4,0,13);return new Response(JSON.stringify({paidCents:body.expectedCostCents,level:4}));}
 if(String(url).endsWith('/energy')){const codes=getKqCultureOperationalCodes(state.equippedCodes,state.cultureWear);return new Response(JSON.stringify({cashCents:state.cashCents,invoices:[],outstandingCents:0,invoiceCount:0,bestGramsPerKwh:null,cultureWear:state.cultureWear,cultureEquipmentCodes:state.equippedCodes,cultureOperationalCodes:codes,quotes:Object.fromEntries(['eco','balanced','intensive'].map(m=>[m,quoteKqEnergy(codes,state.levels,m)]))}));}
 return new Response(JSON.stringify(state));};
 function assertReplace(body){if(body.action!=='replace'||body.expectedVersion!==12||body.expectedCostCents!==46670||state.activeRun||state.cashCents<46670)throw new Error('Invalid fixture replacement');}
 function App(){const[mode,setMode]=useState('intensive');return query.has('warehouse')?<KqWarehouseEntry initialEquipmentCode="LED-300" onClose={()=>{}} onOpenShop={()=>{}}/>:<main style={{maxWidth:540,margin:'auto',padding:12}}><KqEnergyPanel selectedMode={mode} onModeChange={setMode}/></main>;}createRoot(document.getElementById('root')).render(<App/>);`
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'wear-audit',enforce:'pre',resolveId(id){if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__wear-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3228,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[];
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>void(r.url().startsWith(origin)||r.url().startsWith('data:')?r.continue():r.abort()));
 const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.textContent.includes('Remplacement')||document.body.textContent.includes('remplacement')||document.body.textContent.includes('kWh'));};
 const click=async(prefix)=>{const handle=await page.evaluateHandle(prefix=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(prefix)),prefix);assert.ok(handle.asElement(),prefix);await handle.asElement().click();};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});await visit();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.match(await page.$eval('body',el=>el.textContent),/23\s*%\s*→\s*8\s*%/);
  await click('Éco');await page.waitForFunction(()=>/23\s*%\s*→\s*21\s*%/.test(document.body.textContent));
  await page.screenshot({path:resolve(output,'energy-'+width+'.png'),fullPage:true});
  await visit('warehouse');await page.waitForSelector('[data-warehouse-slot=lighting]:not(:disabled)');
  const dialog='[aria-labelledby="equipment-inventory-title"]';assert.equal(await page.$eval(dialog,el=>el.scrollWidth>el.clientWidth+1),false);
  await page.screenshot({path:resolve(output,'warehouse-'+width+'.png')});
 }
 await click('Remplacer');assert.equal(await page.evaluate(()=>window.__requests.length),0);
 await page.evaluate(()=>{window.__fail=true;});await click('Confirmer');await page.waitForSelector('[role=alert]');await click('Confirmer');
 await page.waitForFunction(()=>window.__state.cultureWear['LED-300'].conditionPercent===100&&document.body.textContent.includes('État : 100'));
 const requests=await page.evaluate(()=>window.__requests);assert.equal(requests.length,2);assert.equal(requests[0].requestKey,requests[1].requestKey);
 assert.equal(await page.evaluate(()=>window.__state.cashCents),53330);assert.equal(await page.evaluate(()=>window.__state.levels['LED-300']),4);
 for(const query of ['warehouse&poor','warehouse&active']){await visit(query);assert.equal(await page.$$eval('button',els=>els.find(b=>b.textContent.trim().startsWith('Remplacer')).disabled),true);}
 await visit('broken');assert.ok(await page.evaluate(()=>document.body.textContent.includes('départ')));
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({widths:[320,390,1440],preview:true,confirmation:true,retrySameKey:true,levelsPreserved:true,insufficientCash:true,activeRunBlocked:true,starterFallback:true,errors},null,2));
 console.log('PASS: wear preview and warehouse at 320/390/1440px; confirmed replacement; retry key preserved; level retained; cash and active-run restrictions; starter fallback.');
}finally{await browser?.close();await server.close();}
