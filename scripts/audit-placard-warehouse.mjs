// Actual warehouse entry, installation controls and upgrade component; local API fixture only.
import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer,transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(),output=resolve(root,process.env.WAREHOUSE_AUDIT_OUTPUT||'output/warehouse'),origin='http://127.0.0.1:3214';
const modules={
 'warehouse-assets':`export default ${await readFile(resolve(root,'public/placard/warehouse-v2/manifest.json'),'utf8')};`,
 'next/dynamic':`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(()=>load().then(defaultExport=>({default:defaultExport})));return props=><Suspense fallback={null}><C {...props}/></Suspense>;}`,
 'link-stub':`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,unoptimized,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 'warehouse-entry':`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {KqWarehouseEntry} from '/src/components/placard/KqWarehouseEntry';import {PlacardPlayerShell} from '/src/components/placard/PlacardPlayerShell';import {KQ_EQUIPMENT_CATALOG,getKqEquipmentDefinition,getKqEquipmentUpgradeCost} from '/src/lib/kanab-quest-equipment';
 const query=new URLSearchParams(location.search),starter=['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'];
 const purchased=query.has('empty')?[]:['TENT-120','LED-300','DRYING-ROOM','FREEZE-DRYER','SECURITY-DOG'];
 window.__state={catalog:KQ_EQUIPMENT_CATALOG,routePlan:null,reputation:0,ownedCodes:[...starter,...purchased],purchasedCodes:purchased,equippedCodes:[...starter,...(purchased.length?['FREEZE-DRYER']:[])],levels:{'DRYING-ROOM':Number(query.get('level')||4)},cashCents:query.has('poor')?0:100000};window.__requests=[];window.__fail=false;window.__shop=null;
 if(query.has('full')){const slots=new Map();for(const item of KQ_EQUIPMENT_CATALOG.filter(item=>item.purchasable)){if(!slots.has(item.slot))slots.set(item.slot,item.code);}if(query.has('dog'))slots.set('security','SECURITY-DOG');window.__state.equippedCodes=[...slots.values()];window.__state.purchasedCodes=[...slots.values()];window.__state.ownedCodes=[...starter,...slots.values()];}
 const original=window.fetch.bind(window);window.fetch=async(url,init={})=>{if(!String(url).startsWith('/api/'))return original(url,init);if(String(url).endsWith('/boosters'))return new Response(JSON.stringify({collectionActive:true,costPerPack:5,spendablePoints:20,availableEntitlements:[],welcomeClaimed:true}));await new Promise(r=>setTimeout(r,40));const body=init.body?JSON.parse(init.body):null;
 if(init.method==='POST'){window.__requests.push(body);if(window.__fail){window.__fail=false;return new Response(JSON.stringify({error:'Equipement indisponible.'}),{status:400});}const state=window.__state,total=body.equipmentCodes.reduce((sum,code)=>sum+getKqEquipmentDefinition(code).priceCents,0);state.cashCents-=total;state.ownedCodes.push(...body.equipmentCodes);state.purchasedCodes.push(...body.equipmentCodes);return new Response(JSON.stringify({purchaseId:'test-purchase',equipmentCodes:body.equipmentCodes,totalPriceCents:total,cashAfterCents:state.cashCents,replayed:false}));}
 if(init.method==='PATCH'){window.__requests.push(body);if(window.__fail){window.__fail=false;return new Response(JSON.stringify({error:'Connexion interrompue.'}),{status:503});}const state=window.__state;
 if(body.action==='upgrade'){const level=state.levels[body.equipmentCode]||1,cost=getKqEquipmentUpgradeCost(body.equipmentCode,level);if(cost===null||cost>state.cashCents||level!==body.expectedLevel)return new Response('{}',{status:409});state.levels[body.equipmentCode]=level+1;state.cashCents-=cost;return new Response(JSON.stringify({level:level+1}));}
 if(!state.purchasedCodes.includes(body.equipmentCode))return new Response('{}',{status:403});const slot=getKqEquipmentDefinition(body.equipmentCode).slot;state.equippedCodes=state.equippedCodes.filter(code=>getKqEquipmentDefinition(code).slot!==slot).concat(body.equipmentCode);return new Response(JSON.stringify({equipped:true}));}
 return new Response(JSON.stringify(window.__state));};
 function App(){const[open,setOpen]=useState(true);return query.has('shell')?<PlacardPlayerShell/>:open?<KqWarehouseEntry onClose={()=>setOpen(false)} onOpenShop={code=>{window.__shop=code;setOpen(false);}}/>:<button onClick={()=>setOpen(true)}>Ouvrir mon atelier</button>;}createRoot(document.getElementById('root')).render(<App/>);`,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'warehouse-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';if(id.endsWith('/components/navigation/NavigationLink'))return '\0link-stub';},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__warehouse-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3214,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[];
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>void(r.url().startsWith(origin)||r.url().startsWith('data:')?r.continue():r.abort()));
 const dialog='[aria-labelledby="equipment-inventory-title"]';
 const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('[data-warehouse-slot=tent]:not(:disabled)');};
 const choose=async(slot)=>{await page.click('[data-warehouse-slot="'+slot+'"]');await page.waitForFunction(slot=>document.querySelector('[data-warehouse-slot="'+slot+'"]')?.getAttribute('aria-pressed')==='true',{},slot);};
 const clickText=async(text)=>{const h=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text),text);assert.ok(h.asElement(),text);await h.asElement().click();};
 const snap=async(name)=>{await page.waitForSelector('[data-warehouse-slot=tent]:not(:disabled)');await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:resolve(output,name+'.png')});};
 for(const [width,height]of[[320,740],[390,844],[768,1024],[1440,1000],[844,390]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await visit();await snap('warehouse-'+width);assert.equal(await page.$eval(dialog,el=>el.scrollWidth>el.clientWidth+1),false);
  await choose('flower-drying');await snap('drying-reserve-'+width);await clickText('Installer ici');await page.waitForSelector('[data-warehouse-slot="flower-drying"][data-installed=true]');
  assert.equal(await page.evaluate(()=>window.__state.equippedCodes.includes('FREEZE-DRYER')),true);
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Niveau 5')&&!b.disabled));
  await page.$$eval('button',els=>els.find(b=>b.textContent.includes('Niveau 5')).click());await page.waitForSelector('[data-warehouse-slot="flower-drying"][data-tier="2"]');await snap('drying-level5-'+width);
  assert.equal(await page.evaluate(()=>window.__state.cashCents),76000);assert.equal(await page.evaluate(()=>window.__requests.length),2);
  await choose('lighting');await clickText('Installer ici');await page.waitForFunction(()=>document.querySelector('[data-warehouse-slot=lighting]')?.getAttribute('aria-label').includes('300'));assert.equal(await page.evaluate(()=>window.__state.equippedCodes.includes('LED-150-STARTER')),false);assert.equal(await page.evaluate(()=>window.__state.ownedCodes.includes('LED-150-STARTER')),true);
  await page.keyboard.press('Escape');await page.waitForSelector(dialog,{hidden:true});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 }
 await page.setViewport({width:1440,height:1000});await visit('level=10');await choose('flower-drying');await clickText('Installer ici');await page.waitForSelector('[data-warehouse-slot="flower-drying"][data-installed=true]');await snap('drying-level10');assert.equal(await page.evaluate(()=>document.body.textContent.includes('Niveau maximum atteint')),true);
 await visit('empty');await choose('flower-drying');assert.equal(await page.$$eval('button',els=>els.some(b=>b.textContent==='Installer ici')),false);await page.$$eval('button',els=>els.find(b=>b.textContent.includes('600')).click());assert.equal(await page.evaluate(()=>window.__shop),'DRYING-ROOM');
 await visit('poor');await choose('flower-drying');assert.equal(await page.$$eval('button',els=>els.find(b=>b.textContent.includes('Niveau 5')).disabled),true);
 await visit();await choose('flower-drying');await page.evaluate(()=>window.__fail=true);await clickText('Installer ici');await page.waitForSelector('[role=alert]');assert.equal(await page.evaluate(()=>window.__state.equippedCodes.includes('DRYING-ROOM')),false);await clickText('Installer ici');await page.waitForSelector('[data-warehouse-slot="flower-drying"][data-installed=true]');
 await page.goto(origin+'/?shell=1&view=shop&catalog=equipment',{waitUntil:'networkidle0'});await page.waitForSelector('button[aria-label*="300 W"]');await page.$eval('button[aria-label*="300 W"]',el=>el.closest('article').querySelector('footer button').click());await page.waitForSelector('[data-warehouse-slot=lighting][aria-pressed=true]:not(:disabled)');assert.equal(await page.evaluate(()=>window.__requests.length),0);await clickText('Installer ici');await page.waitForFunction(()=>window.__state.equippedCodes.includes('LED-300'));await snap('shop-to-warehouse');
 for(const [width,height]of[[390,844],[1440,1000]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await page.goto(origin+'/?shell=1&view=shop&catalog=equipment&empty',{waitUntil:'networkidle0'});
  await page.waitForSelector('button[aria-label="Voir Pièce séchoir"]');await page.$eval('button[aria-label="Voir Pièce séchoir"]',el=>el.closest('article').querySelector('footer button').click());await page.click('button[aria-label^="Ouvrir le panier"]');await clickText('Valider le panier');
  await page.evaluate(()=>window.__fail=true);await clickText('Confirmer l’achat');await page.waitForSelector('[role=alertdialog] [role=alert]');
  assert.equal(await page.$eval('[role=alertdialog] [role=alert]',el=>el.textContent.includes('Equipement indisponible.')),true);assert.equal(await page.evaluate(()=>window.__state.cashCents),100000);assert.equal(await page.evaluate(()=>window.__state.ownedCodes.includes('DRYING-ROOM')),false);
  await page.$eval('[role=alertdialog] [role=alert]',el=>el.scrollIntoView({block:'center'}));assert.equal(await page.$eval('[role=alertdialog] [role=alert]',el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),true);
  await clickText('Confirmer l’achat');await page.waitForSelector('[aria-labelledby=equipment-purchase-title]');assert.equal(await page.evaluate(()=>window.__state.cashCents),40000);assert.equal(await page.evaluate(()=>window.__state.ownedCodes.includes('DRYING-ROOM')),true);
  await clickText('Installer');await page.waitForSelector('[data-warehouse-slot=flower-drying][aria-pressed=true]:not(:disabled)');await clickText('Installer ici');await page.waitForSelector('[data-warehouse-slot=flower-drying][data-installed=true]');await snap('drying-purchase-'+width);
 }
 await page.setViewport({width:1440,height:1000});await visit('full');await snap('warehouse-full');
 const scene=await page.$('[aria-label="Les emplacements de ton entrepôt"]');assert.ok(scene);await scene.screenshot({path:resolve(output,'warehouse-full-scene.png')});
 const geometry=await page.$$eval('[data-warehouse-slot]',elements=>elements.map(el=>{const r=el.getBoundingClientRect(),scene=el.parentElement.getBoundingClientRect();return{slot:el.dataset.warehouseSlot,installed:el.dataset.installed==='true',x:r.x-scene.x,y:r.y-scene.y,width:r.width,height:r.height,sceneWidth:scene.width,sceneHeight:scene.height};}));
 await writeFile(resolve(output,'scene-geometry.json'),JSON.stringify(geometry,null,2));
 const hitChecks=[];
 for(const [width,height]of[[1440,1000],[390,844]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await visit('full');
  for(const slot of geometry.map(item=>item.slot)){
   const target=await page.$('[data-warehouse-slot="'+slot+'"]');await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
   const hit=await target.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return{x,y,slot:document.elementFromPoint(x,y)?.closest('[data-warehouse-slot]')?.getAttribute('data-warehouse-slot')??null};});
   assert.equal(hit.slot,slot,`${width}px: ${slot} must remain independently clickable`);await page.mouse.click(hit.x,hit.y);await page.waitForFunction(slot=>document.querySelector('[data-warehouse-slot="'+slot+'"]')?.getAttribute('aria-pressed')==='true',{},slot);hitChecks.push({width,slot});
   if(width===390&&['press','washing','drying','flower-drying'].includes(slot))await snap('warehouse-full-'+slot+'-'+width);
  }
 }
 for(const [width,height]of[[320,740],[390,844]]){
  await page.setViewport({width,height,isMobile:true,hasTouch:true});await visit('full');await clickText('Vue d’ensemble');await page.waitForSelector('[data-overview=true]');await snap('warehouse-overview-'+width);
  assert.equal(await page.$eval('[data-overview=true]',el=>el.scrollWidth<=el.clientWidth+1),true,'Overview must fit the mobile width');
  assert.equal(await page.$eval('[aria-label="Les emplacements de ton entrepôt"]',el=>{const r=el.getBoundingClientRect();return Math.abs(r.width/r.height-2)<0.01;}),true,'Overview preserves the room proportions');
  await clickText('Agrandir le décor');await page.waitForSelector('[data-overview=false]');assert.equal(await page.$eval('[data-overview=false]',el=>el.scrollWidth>el.clientWidth),true,'Detailed view can pan again');
 }
 await page.setViewport({width:1440,height:1000});await visit('full&dog&level=10');await choose('flower-drying');await snap('warehouse-full-dog');
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({viewports:5,installation:true,upgrades:true,independentDryingSlots:true,starterPreserved:true,emptyInventory:true,insufficientCash:true,failedInstallRetry:true,dryingPurchaseAndVisibleError:true,independentHitTargets:hitChecks,mobileOverview:true,errors},null,2));console.log('PASS: warehouse on five viewports; drying-room checkout, visible rejection, retry and installation on mobile and desktop; all equipment remains independently clickable; mobile overview and detail views.');
}finally{await browser?.close();await server.close();}
