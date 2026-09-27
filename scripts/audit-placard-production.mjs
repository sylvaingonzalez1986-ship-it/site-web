// Actual production, warehouse, catalog and energy components; isolated local API fixtures.
import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer,transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(),output=resolve(root,process.env.PRODUCTION_AUDIT_OUTPUT||'output/production'),origin='http://127.0.0.1:3215';
const modules={
 'warehouse-assets':`export default ${await readFile(resolve(root,'public/placard/warehouse-v2/manifest.json'),'utf8')};`,
 'next/dynamic':`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(()=>load().then(defaultExport=>({default:defaultExport})));return props=><Suspense fallback={null}><C {...props}/></Suspense>;}`,
 'link-stub':`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,unoptimized,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 'warehouse-entry':"import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';\nimport {KqWarehouseEntry} from '/src/components/placard/KqWarehouseEntry';\nimport {KqEquipmentCatalogModal} from '/src/components/placard/KqEquipmentCatalogModal';\nimport {KqEnergyPanel} from '/src/components/placard/KqEnergyPanel';\nimport {KQ_EQUIPMENT_CATALOG,getKqEquipmentDefinition,getKqEquipmentUpgradeCost,formatKqCash} from '/src/lib/kanab-quest-equipment';\nimport {getKqProductionExpansion} from '/src/lib/kanab-quest-production';\nimport {quoteKqTentEnergy} from '/src/lib/kanab-quest-energy';\nconst query=new URLSearchParams(location.search),starter=['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'];\nwindow.sessionStorage.removeItem('kq:selected-tent');\nconst purchased=query.has('empty')?[]:['LED-300','DRYING-ROOM'];\nconst basic=tentNumber=>({tentNumber,ownedCodes:[...starter],purchasedCodes:[],equippedCodes:[...starter],levels:{},cultureWear:{},maintenance:{},cultureOperationalCodes:[...starter]});\nconst first={...basic(1),ownedCodes:[...starter,...purchased],purchasedCodes:[...purchased],equippedCodes:purchased.length?['TENT-080-STARTER','LED-300','AIR-STARTER','DRYING-ROOM']:[...starter],levels:purchased.length?{'DRYING-ROOM':4}:{}};\nwindow.__state={productionUnits:Number(query.get('units')||1),activeRun:query.has('active'),routePlan:null,reputation:0,levels:first.levels,cashCents:query.has('poor')?0:10000000,tents:[]};\nwindow.__state.tents=Array.from({length:window.__state.productionUnits},(_,i)=>i===0?first:basic(i+1));\nwindow.__requests=[];window.__rejectOnce=false;\nconst quote=()=>getKqProductionExpansion(window.__state.productionUnits,first.purchasedCodes,first.levels);\nconst energy=mode=>quoteKqTentEnergy(window.__state.tents.map(t=>({tentNumber:t.tentNumber,codes:t.equippedCodes,levels:t.levels})),mode);\nwindow.__quote=quote;window.__cash=formatKqCash;window.__upgrade=(code,level)=>getKqEquipmentUpgradeCost(code,level,1);window.__energy=()=>energy('balanced');\nconst original=window.fetch.bind(window);window.fetch=async(url,init={})=>{\n if(!String(url).startsWith('/api/'))return original(url,init);\n await new Promise(r=>setTimeout(r,50));const state=window.__state,body=init.body?JSON.parse(init.body):null;\n if(init.method==='PATCH'||init.method==='POST'){\n  window.__requests.push(body);\n  if(window.__rejectOnce){window.__rejectOnce=false;return new Response(JSON.stringify({error:'Connexion interrompue.'}),{status:503});}\n  if(body.action==='expand-production'){\n   const expansion=quote();if(state.activeRun||!expansion.nextUnits||body.expectedUnits!==state.productionUnits||body.expectedCostCents!==expansion.totalCostCents||state.cashCents<expansion.totalCostCents)return new Response(JSON.stringify({error:'Agrandissement indisponible.'}),{status:409});\n   state.cashCents-=expansion.totalCostCents;for(let n=state.productionUnits+1;n<=expansion.nextUnits;n++)state.tents.push(basic(n));state.productionUnits=expansion.nextUnits;return new Response(JSON.stringify({productionUnits:state.productionUnits}));\n  }\n  const tent=state.tents.find(t=>t.tentNumber===body.tentNumber);\n  if(!tent||body.expectedUnits!==state.productionUnits)return new Response(JSON.stringify({error:'Mauvaise tente.'}),{status:409});\n  if(body.action==='upgrade'){\n   const level=tent.levels[body.equipmentCode]||1,cost=getKqEquipmentUpgradeCost(body.equipmentCode,level,1);\n   if(!tent.purchasedCodes.includes(body.equipmentCode)||cost===null||state.cashCents<cost||body.expectedLevel!==level)return new Response('{}',{status:409});\n   tent.levels[body.equipmentCode]=level+1;state.cashCents-=cost;return new Response(JSON.stringify({level:level+1}));\n  }\n  if(init.method==='POST'){\n   const total=body.equipmentCodes.reduce((sum,code)=>sum+getKqEquipmentDefinition(code).priceCents,0);\n   if(state.cashCents<total||body.equipmentCodes.some(code=>tent.ownedCodes.includes(code)))return new Response('{}',{status:409});state.cashCents-=total;tent.ownedCodes.push(...body.equipmentCodes);tent.purchasedCodes.push(...body.equipmentCodes);\n   return new Response(JSON.stringify({equipmentCodes:body.equipmentCodes,totalPriceCents:total,cashAfterCents:state.cashCents}));\n  }\n  if(!tent.purchasedCodes.includes(body.equipmentCode))return new Response('{}',{status:403});const slot=getKqEquipmentDefinition(body.equipmentCode).slot;tent.equippedCodes=tent.equippedCodes.filter(code=>getKqEquipmentDefinition(code).slot!==slot).concat(body.equipmentCode);return new Response(JSON.stringify({equipped:true}));\n }\n if(String(url).endsWith('/energy'))return new Response(JSON.stringify({productionUnits:state.productionUnits,tents:state.tents,cashCents:state.cashCents,quotes:Object.fromEntries(['eco','balanced','intensive'].map(mode=>[mode,energy(mode)])),invoices:[],outstandingCents:0,invoiceCount:0,bestGramsPerKwh:null}));\n const requested=Number(new URL(url,location.origin).searchParams.get('tentNumber')||1),tent=state.tents.find(t=>t.tentNumber===requested)||state.tents[0];\n return new Response(JSON.stringify({...state,...tent,equipmentPricingUnits:1,production:quote(),catalog:KQ_EQUIPMENT_CATALOG}));\n};\nfunction App(){const[view,setView]=useState(query.get('view')||'warehouse');return view==='catalog'?<KqEquipmentCatalogModal onClose={()=>setView('warehouse')} onOpenWorkshop={()=>setView('warehouse')}/>:view==='energy'?<KqEnergyPanel selectedMode='balanced' onModeChange={()=>{}}/>:<KqWarehouseEntry onClose={()=>{}} onOpenShop={()=>setView('catalog')}/>;}\ncreateRoot(document.getElementById('root')).render(<App/>);",
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'warehouse-audit',enforce:'pre',resolveId(id){if(id==='next/link')return '\0link-stub';if(id in modules)return '\0'+id;if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';if(id.endsWith('/components/navigation/NavigationLink'))return '\0link-stub';},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__warehouse-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3215,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[];
try {
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>void(r.url().startsWith(origin)||r.url().startsWith('data:')?r.continue():r.abort()));
 const capacity='details[data-production-capacity][aria-labelledby="production-capacity-title"]';
 const disclosure=capacity+' > summary',scene='[aria-label="Les emplacements de ton entrepôt"]';
 const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector(capacity);await page.waitForSelector('[data-warehouse-slot=tent]:not(:disabled)');};
 const openCapacity=async()=>{if(!await page.$eval(capacity,el=>el.open))await page.click(disclosure);await page.waitForFunction(selector=>document.querySelector(selector).open,{},capacity);};
 const expansionButton=async()=>page.evaluateHandle(selector=>[...document.querySelector(selector).querySelectorAll('button')].find(b=>b.textContent.includes('Ajouter cette tente')||b.textContent.includes('Acheter l’entrepôt final')),capacity);
 const expand=async()=>{await openCapacity();const button=await expansionButton();assert.ok(button.asElement());await button.asElement().click();};
 const waitUnits=async(units)=>{await page.waitForFunction(({units,selector})=>window.__state.productionUnits===units&&document.querySelectorAll(selector+' li[data-owned=true]').length===units,{}, {units,selector:capacity});await page.waitForSelector('[data-warehouse-slot=tent]:not(:disabled)');};
 const snap=async(name)=>{await page.$eval(capacity,el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:resolve(output,name+'.png')});await(await page.$(capacity)).screenshot({path:resolve(output,name+'-panel.png')});};
 const compact=text=>text.replace(/\s/g,'');
 const reports=[];
 for(const [width,height]of[[320,740],[390,844],[1440,1000]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await visit();
  assert.equal(await page.$eval('[aria-labelledby=equipment-inventory-title]',el=>el.scrollWidth>el.clientWidth+1),false,'Warehouse fits viewport');
  assert.equal(await page.$eval(capacity,el=>el.open),false,'Expansion is closed on entry');
  assert.equal(await page.$eval(disclosure,el=>el.textContent.includes('Agrandir l’atelier')),true,'Expansion has a clear access label');
  const initial=await page.evaluate(({capacity,scene})=>{const access=document.querySelector(capacity).getBoundingClientRect(),workshop=document.querySelector(scene).getBoundingClientRect();return{sceneTop:workshop.top,sceneBottom:workshop.bottom,accessTop:access.top,accessHeight:access.height};},{capacity,scene});
  assert.ok(initial.sceneTop>=0&&initial.sceneTop<height&&initial.sceneBottom>0,'Workshop scene is visible on entry');
  assert.ok(initial.sceneBottom<=initial.accessTop,'Workshop appears before the expansion access');
  assert.ok(initial.accessHeight<=120,'Closed expansion remains a compact row');
  await page.screenshot({path:resolve(output,'warehouse-default-'+width+'.png')});
  await openCapacity();
  assert.equal(await page.evaluate(()=>window.__requests.length),0,'Opening the expansion never purchases');
  if(width===390){await page.focus(disclosure);await page.keyboard.press('Enter');assert.equal(await page.$eval(capacity,el=>el.open),false,'Disclosure closes with the keyboard');await page.keyboard.press('Enter');assert.equal(await page.$eval(capacity,el=>el.open),true,'Disclosure opens with the keyboard');}
  await page.waitForFunction(selector=>[...document.querySelectorAll(selector+' img')].some(img=>img.complete&&img.naturalWidth>0),{},capacity);
  const artwork=await page.$$eval(capacity+' img',images=>images.filter(img=>img.getBoundingClientRect().width>0).map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0})));
  assert.ok(artwork.some(img=>img.src.includes('/placard/warehouse-v2/')&&img.loaded),'Expanded panel uses loaded workshop artwork');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const capacityLayout=await page.$eval(capacity,el=>{const r=el.getBoundingClientRect();return {width:r.width,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,children:[...el.querySelectorAll('*')].filter(child=>child.getBoundingClientRect().right>r.right+1).map(child=>({tag:child.tagName,cls:child.className,text:child.textContent.slice(0,80),width:child.getBoundingClientRect().width}))};});
  if(capacityLayout.scrollWidth>capacityLayout.clientWidth+1){await page.$eval(capacity,el=>el.scrollIntoView());await page.screenshot({path:resolve(output,'capacity-overflow-'+width+'.png')});console.log(capacityLayout);}
  assert.ok(capacityLayout.scrollWidth<=capacityLayout.clientWidth+1,'Expanded capacity fits viewport '+width);
  await snap('capacity-1-'+width);
  let balance=await page.evaluate(()=>window.__state.cashCents);
  for(const next of[2,3,4,8]){
   const before=await page.evaluate(()=>({units:window.__state.productionUnits,cost:window.__quote().totalCostCents}));
   const button=await expansionButton();assert.equal(await button.evaluate(b=>b.disabled),false);
   const quotedTotal=compact(await page.evaluate(cost=>window.__cash(cost),before.cost));
   assert.equal(compact(await button.evaluate(b=>b.getAttribute('aria-label')||b.textContent)).includes(quotedTotal),true);
   assert.equal(compact(await button.evaluate(b=>b.parentElement.textContent)).includes(quotedTotal),true,'Investment total stays visible beside the purchase control');
   await expand();await waitUnits(next);balance-=before.cost;
   assert.equal(await page.evaluate(()=>window.__state.cashCents),balance);
   const request=await page.evaluate(()=>window.__requests.at(-1));assert.equal(request.expectedUnits,before.units);assert.equal(request.expectedCostCents,before.cost);assert.ok(request.requestKey);
  }
  assert.equal(await page.$eval(capacity,el=>el.textContent.includes('capacité maximale atteinte')),true);
  assert.equal(await page.evaluate(()=>window.__requests.length),4);
  assert.equal(await page.evaluate(()=>window.__state.tents.slice(1).every(t=>t.purchasedCodes.length===0&&Object.keys(t.levels).length===0&&t.equippedCodes.join(',')==='TENT-080-STARTER,LED-150-STARTER,AIR-STARTER')),true,'Every added tent begins with the basic kit');
  assert.equal(await page.$eval(capacity,el=>el.scrollWidth>el.clientWidth+1),false,'Capacity fits viewport');
  await snap('capacity-8-'+width);
  await page.click('[data-warehouse-slot="flower-drying"]');
  const upgrade=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Niveau 5')));
  const upgradeCost=await page.evaluate(()=>window.__upgrade('DRYING-ROOM',4));
  assert.equal(compact(await upgrade.evaluate(b=>b.textContent)).includes(compact(await page.evaluate(cost=>window.__cash(cost),upgradeCost))),true);
  await upgrade.asElement().click();await page.waitForFunction(()=>window.__state.levels['DRYING-ROOM']===5);assert.equal(await page.evaluate(()=>window.__state.cashCents),balance-upgradeCost);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).tentNumber),1);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).expectedUnits),8);
  await page.select('select[aria-label="Tente à aménager"]','2');await page.waitForSelector('[data-warehouse-slot=tent]:not(:disabled)');
  assert.equal(await page.$eval('[data-warehouse-slot=flower-drying]',el=>el.dataset.installed), 'false','An upgrade to tent 1 never installs equipment in tent 2');
  assert.equal(await page.$eval('[data-warehouse-slot=lighting]',el=>el.getAttribute('aria-label').includes('115 W')),true,'Tent 2 retains starter lighting');
  reports.push({width,defaultClosed:true,sceneFirst:true,closedHeight:initial.accessHeight,workshopArtwork:true,expansionSteps:[2,3,4,8],independentUpgrade:true});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 for(const query of['poor','active']){await visit(query);await openCapacity();const button=await expansionButton();assert.equal(await button.evaluate(b=>b.disabled),true);assert.equal(await page.evaluate(()=>window.__requests.length),0);}
 await visit();await page.evaluate(()=>window.__rejectOnce=true);await expand();await page.waitForSelector(capacity+' [role=alert]');
 const failed=await page.evaluate(()=>window.__requests.at(-1));assert.equal(await page.evaluate(()=>window.__state.productionUnits),1);await expand();await waitUnits(2);assert.equal(await page.evaluate(()=>window.__requests.at(-1).requestKey),failed.requestKey);
 for(const [width,height]of[[390,844],[1440,1000]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});
  await page.goto(origin+'/?view=catalog&units=4&empty',{waitUntil:'networkidle0'});await page.waitForSelector('button[aria-label="Voir Pièce séchoir"]');
  await page.select('select[aria-label="Tente à aménager"]','2');await page.waitForFunction(()=>document.querySelector('select[aria-label="Tente à aménager"]')?.disabled===false);
  const price=60000,priceText=await page.evaluate(price=>window.__cash(price),price);
  assert.equal(compact(await page.$eval('button[aria-label="Voir Pièce séchoir"]',el=>el.closest('article').textContent)).includes(compact(priceText)),true);
  await page.$eval('button[aria-label="Voir Pièce séchoir"]',el=>el.closest('article').querySelector('footer button').click());
  await page.click('button[aria-label^="Ouvrir le panier"]');await page.$$eval('button',els=>els.find(b=>b.textContent==='Valider le panier').click());await page.waitForSelector('[aria-labelledby=checkout-title]');
  assert.equal(compact(await page.$eval('[aria-labelledby=checkout-title]',el=>el.textContent)).includes(compact(priceText)),true);
  await page.$$eval('button',els=>els.find(b=>b.textContent==='Confirmer l’achat').click());await page.waitForSelector('[aria-labelledby=equipment-purchase-title]');
  assert.equal(await page.evaluate(()=>window.__state.cashCents),10000000-price);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).tentNumber),2);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).expectedUnits),4);
  assert.equal(await page.evaluate(()=>window.__state.tents[1].purchasedCodes.includes('DRYING-ROOM')),true);
  assert.equal(await page.evaluate(()=>window.__state.tents.filter(t=>t.tentNumber!==2).every(t=>!t.purchasedCodes.includes('DRYING-ROOM'))),true,'Purchase affects only tent 2');
  await page.$$eval('[aria-labelledby=equipment-purchase-title] button',els=>els.find(b=>b.textContent==='Installer').click());await page.waitForSelector('[data-warehouse-slot=tent]:not(:disabled)');
  assert.equal(await page.$eval('select[aria-label="Tente à aménager"]',el=>el.value),'2','Selection survives shop-to-warehouse navigation');
  await page.click('[data-warehouse-slot=flower-drying]');await page.$$eval('button',els=>els.find(b=>b.textContent.startsWith('Installer · tente')).click());await page.waitForSelector('[data-warehouse-slot=flower-drying][data-installed=true]');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Niveau 2')&&!b.disabled));
  await page.$$eval('button',els=>els.find(b=>b.textContent.includes('Niveau 2')).click());await page.waitForFunction(()=>window.__state.tents[1].levels['DRYING-ROOM']===2);
  assert.equal(await page.evaluate(()=>window.__state.tents.filter(t=>t.tentNumber!==2).every(t=>!t.levels['DRYING-ROOM'])),true,'Upgrades remain individual');
  await page.goto(origin+'/?view=energy&units=4',{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Charges du Placard"]');
  await page.waitForFunction(()=>document.body.textContent.includes('4 tentes'));
  const energy=await page.evaluate(()=>window.__cash(window.__energy().totalCents));assert.equal(compact(await page.$eval('[aria-label="Charges du Placard"]',el=>el.textContent)).includes(compact(energy)),true);
  await page.$$eval('summary',els=>els.find(el=>el.textContent==='Détail par appareil').click());
  assert.equal(await page.$eval('[aria-label="Charges du Placard"]',el=>el.textContent.includes('Tente 4 ·')),true,'Energy identifies each tent');
  assert.equal(await page.$eval('[aria-label="Charges du Placard"] details',el=>el.textContent.includes('×4')),false,'Individual appliance lines are not multiplied again');
  await page.screenshot({path:resolve(output,'energy-4-'+width+'.png')});
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({viewports:reports,poorBlocked:true,activeRunBlocked:true,retryKeepsRequestKey:true,independentCheckout:true,tentSelectionPreserved:true,aggregatedEnergy:true,errors},null,2));
 console.log('PASS: scene first, compact closed expansion and illustrated panel on 320px, 390px and desktop; keyboard disclosure, expansion 1→2→3→4→8, exact quotes and balances, final capacity, active/poor guards, idempotent retry, basic new tents, independent upgrades and checkout, retained tent selection and aggregated energy.');
} finally {await browser?.close();await server.close();}
