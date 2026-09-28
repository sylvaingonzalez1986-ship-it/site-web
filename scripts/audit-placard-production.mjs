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
 'warehouse-entry':"import React,{useState} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport '/src/app/globals.css';\nimport {KqWarehouseEntry} from '/src/components/placard/KqWarehouseEntry';\nimport {KqEquipmentCatalogModal} from '/src/components/placard/KqEquipmentCatalogModal';\nimport {KqEnergyPanel} from '/src/components/placard/KqEnergyPanel';\nimport {KQ_EQUIPMENT_CATALOG,getKqEquipmentDefinition,getKqEquipmentUpgradeCost,isKqProcessingEquipment,formatKqCash} from '/src/lib/kanab-quest-equipment';\nimport {getKqProductionExpansion} from '/src/lib/kanab-quest-production';\nimport {quoteKqTentEnergy} from '/src/lib/kanab-quest-energy';\nimport {getKqCultureEquipmentCondition,getKqCultureOperationalCodes,getKqCultureWearPreview} from '/src/lib/kanab-quest-culture-wear';\nconst query=new URLSearchParams(location.search),starter=['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'];\nwindow.sessionStorage.removeItem('kq:selected-tent');\nconst purchased=query.has('empty')?[]:['LED-300','DRYING-ROOM'];\nconst common={ownedCodes:[...starter,...purchased],purchasedCodes:[...purchased],equippedCodes:purchased.length?['TENT-080-STARTER','LED-300','AIR-STARTER','DRYING-ROOM']:[...starter],levels:purchased.length?{'LED-300':3,'DRYING-ROOM':4}:{},cultureWear:{},maintenance:{},cultureOperationalCodes:[],operationalCodes:[]};\nconst wear={'LED-300':35,'DRYING-ROOM':40};\nwindow.__state={productionUnits:Number(query.get('units')||1),activeRun:query.has('active'),routePlan:null,reputation:0,sharedEquipment:common,cashCents:query.has('poor')?0:10000000,tents:[]};\nconst refreshTents=()=>{\n common.cultureWear=Object.fromEntries(common.ownedCodes.flatMap(code=>{const condition=getKqCultureEquipmentCondition(code,common.levels[code],wear[code]||0,7);return condition?[[code,condition]]:[];}));\n common.cultureOperationalCodes=getKqCultureOperationalCodes(common.equippedCodes,common.cultureWear);common.operationalCodes=[...common.cultureOperationalCodes];\n const culture=code=>!isKqProcessingEquipment(code);\n window.__state.tents=Array.from({length:window.__state.productionUnits},(_,i)=>({tentNumber:i+1,ownedCodes:common.ownedCodes.filter(culture),purchasedCodes:common.purchasedCodes.filter(culture),equippedCodes:common.equippedCodes.filter(culture),levels:{...common.levels},cultureWear:structuredClone(common.cultureWear),maintenance:{},cultureOperationalCodes:common.cultureOperationalCodes.filter(culture),operationalCodes:common.operationalCodes.filter(culture)}));\n};refreshTents();\nwindow.__requests=[];window.__unexpected=[];window.__rejectOnce=false;\nconst quote=()=>getKqProductionExpansion(window.__state.productionUnits,common.purchasedCodes,common.levels);\nconst profiles=()=>window.__state.tents.map(t=>({tentNumber:t.tentNumber,codes:t.cultureOperationalCodes,levels:t.levels}));\nconst energy=mode=>quoteKqTentEnergy(profiles(),mode,'installation');\nconst legacyTents=Array.from({length:window.__state.productionUnits},(_,i)=>({tentNumber:i+1,codes:i===0?['LED-300','DRYING-ROOM']:starter,levels:i===0?{'LED-300':1,'DRYING-ROOM':1}:{}}));\nconst legacyEnergy=quoteKqTentEnergy(legacyTents,'balanced');\nwindow.__quote=quote;window.__cash=formatKqCash;window.__upgrade=(code,level)=>getKqEquipmentUpgradeCost(code,level,1);window.__energy=()=>energy('balanced');window.__legacyEnergy=legacyEnergy;\nwindow.__wear=mode=>common.equippedCodes.flatMap(code=>{const condition=common.cultureWear[code];const preview=condition&&getKqCultureWearPreview(code,condition,mode);return preview?[preview]:[];});\nconst response=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});\nconst original=window.fetch.bind(window);window.fetch=async(url,init={})=>{\n const parsed=new URL(url,location.origin);\n if(!parsed.pathname.startsWith('/api/'))return original(url,init);\n if(!['/api/arena/placard/equipment','/api/arena/placard/energy'].includes(parsed.pathname)){window.__unexpected.push(parsed.pathname);return response({error:'Unexpected local fixture API'},500);}\n await new Promise(r=>setTimeout(r,50));const state=window.__state,body=init.body?JSON.parse(init.body):null;\n if(init.method==='PATCH'||init.method==='POST'){\n  window.__requests.push(body);\n  if(parsed.pathname!=='/api/arena/placard/equipment'){window.__unexpected.push(parsed.pathname+':'+init.method);return response({},500);}\n  if(window.__rejectOnce){window.__rejectOnce=false;return response({error:'Connexion interrompue.'},503);}\n  if(body.action==='expand-production'){\n   const expansion=quote();if(state.activeRun||!expansion.nextUnits||body.expectedUnits!==state.productionUnits||body.expectedCostCents!==expansion.totalCostCents||state.cashCents<expansion.totalCostCents)return response({error:'Agrandissement indisponible.'},409);\n   state.cashCents-=expansion.totalCostCents;state.productionUnits=expansion.nextUnits;refreshTents();return response({productionUnits:state.productionUnits});\n  }\n  if(body.tentNumber!==1||body.expectedUnits!==state.productionUnits)return response({error:'Mauvaise installation.'},409);\n  if(body.action==='upgrade'){\n   const level=common.levels[body.equipmentCode]||1,cost=getKqEquipmentUpgradeCost(body.equipmentCode,level,1);\n   if(!common.purchasedCodes.includes(body.equipmentCode)||cost===null||state.cashCents<cost||body.expectedLevel!==level)return response({},409);\n   common.levels[body.equipmentCode]=level+1;state.cashCents-=cost;refreshTents();return response({level:level+1});\n  }\n  if(init.method==='POST'){\n   const total=body.equipmentCodes.reduce((sum,code)=>sum+getKqEquipmentDefinition(code).priceCents,0);\n   if(state.cashCents<total||body.equipmentCodes.some(code=>common.ownedCodes.includes(code)))return response({},409);\n   state.cashCents-=total;common.ownedCodes.push(...body.equipmentCodes);common.purchasedCodes.push(...body.equipmentCodes);for(const code of body.equipmentCodes){common.levels[code]=1;wear[code]=0;}refreshTents();\n   return response({equipmentCodes:body.equipmentCodes,totalPriceCents:total,cashAfterCents:state.cashCents});\n  }\n  if(!common.purchasedCodes.includes(body.equipmentCode))return response({},403);\n  const slot=getKqEquipmentDefinition(body.equipmentCode).slot;common.equippedCodes=common.equippedCodes.filter(code=>getKqEquipmentDefinition(code).slot!==slot).concat(body.equipmentCode);refreshTents();return response({equipped:true});\n }\n refreshTents();\n if(parsed.pathname.endsWith('/energy'))return response({productionUnits:state.productionUnits,tents:state.tents,cashCents:state.cashCents,cultureWear:common.cultureWear,cultureEquipmentCodes:common.equippedCodes,cultureOperationalCodes:common.cultureOperationalCodes,quotes:Object.fromEntries(['eco','balanced','intensive'].map(mode=>[mode,energy(mode)])),invoices:[],outstandingCents:0,invoiceCount:0,bestGramsPerKwh:null});\n const requested=Number(parsed.searchParams.get('tentNumber')||1);\n return response({...state,...common,tentNumber:requested<=state.productionUnits?requested:1,equipmentPricingUnits:1,production:quote(),catalog:KQ_EQUIPMENT_CATALOG});\n};\nfunction App(){const[view,setView]=useState(query.get('view')||'warehouse'),[initialCode,setInitialCode]=useState(null);return view==='catalog'?<KqEquipmentCatalogModal onClose={()=>setView('warehouse')} onOpenWorkshop={code=>{setInitialCode(code);setView('warehouse');}}/>:view==='energy'?<KqEnergyPanel selectedMode='balanced' onModeChange={()=>{}}/>:view==='legacy-energy'?<KqEnergyPanel lockedQuote={legacyEnergy} lockedTents={legacyTents}/>:<KqWarehouseEntry initialEquipmentCode={initialCode} onClose={()=>{}} onOpenShop={()=>setView('catalog')}/>;}\ncreateRoot(document.getElementById('root')).render(<App/>);\n",
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
   const before=await page.evaluate(()=>({units:window.__state.productionUnits,cost:window.__quote().totalCostCents,common:window.__state.sharedEquipment}));
   assert.equal(before.cost,before.units===4?2120000:30000,'Capacity price does not buy equipment copies');
   const button=await expansionButton();assert.equal(await button.evaluate(b=>b.disabled),false);
   const quotedTotal=compact(await page.evaluate(cost=>window.__cash(cost),before.cost));
   assert.equal(compact(await button.evaluate(b=>b.getAttribute('aria-label')||b.textContent)).includes(quotedTotal),true);
   assert.equal(compact(await button.evaluate(b=>b.parentElement.textContent)).includes(quotedTotal),true,'Investment total stays visible beside the purchase control');
   await expand();await waitUnits(next);balance-=before.cost;
   assert.equal(await page.evaluate(()=>window.__state.cashCents),balance);
   assert.deepEqual(await page.evaluate(()=>window.__state.sharedEquipment),before.common,'Expansion preserves models, levels and wear');
   const request=await page.evaluate(()=>window.__requests.at(-1));assert.equal(request.action,'expand-production');assert.equal(request.equipmentCodes,undefined);assert.equal(request.expectedUnits,before.units);assert.equal(request.expectedCostCents,before.cost);assert.ok(request.requestKey);
  }
  assert.equal(await page.$eval(capacity,el=>el.textContent.includes('capacité maximale atteinte')),true);
  assert.equal(await page.evaluate(()=>window.__requests.length),4);
  assert.equal(await page.evaluate(()=>window.__state.tents.every(t=>t.equippedCodes.includes('LED-300')&&t.equippedCodes.includes('DRYING-ROOM')&&t.levels['LED-300']===3&&t.levels['DRYING-ROOM']===4&&t.cultureWear['LED-300'].wearPercent===35)),true,'Every added tent inherits global models, levels and wear');
  assert.equal(await page.$eval(capacity,el=>el.scrollWidth>el.clientWidth+1),false,'Capacity fits viewport');
  await snap('capacity-8-'+width);
  await page.click('[data-warehouse-slot="flower-drying"]');
  const upgrade=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Niveau 5')));
  const upgradeCost=await page.evaluate(()=>window.__upgrade('DRYING-ROOM',4));
  assert.equal(compact(await upgrade.evaluate(b=>b.textContent)).includes(compact(await page.evaluate(cost=>window.__cash(cost),upgradeCost))),true);
  await upgrade.asElement().click();await page.waitForFunction(()=>window.__state.sharedEquipment.levels['DRYING-ROOM']===5);assert.equal(await page.evaluate(()=>window.__state.cashCents),balance-upgradeCost);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).tentNumber),1);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).expectedUnits),8);
  await page.click('[data-warehouse-tent="2"] [data-warehouse-slot="tent"]');
  await page.waitForSelector('[data-warehouse-tent="2"] [data-tent-selected="true"]');
  assert.equal(await page.$eval('[data-warehouse-slot=flower-drying]',el=>el.dataset.installed),'true','Drying room remains installed after selecting tent 2');
  assert.equal(await page.$eval('[data-warehouse-tent="2"] [data-warehouse-slot=lighting]',el=>el.getAttribute('aria-label').includes('niveau 3')),true,'Tent 2 inherits upgraded lighting');
  assert.equal(await page.evaluate(()=>window.__state.tents.every(t=>t.levels['DRYING-ROOM']===5&&t.cultureWear['DRYING-ROOM'].wearPercent===40)),true,'A unit-price upgrade serves every tent without resetting wear');
  assert.deepEqual(await page.evaluate(()=>window.__unexpected),[]);
  reports.push({width,defaultClosed:true,sceneFirst:true,closedHeight:initial.accessHeight,workshopArtwork:true,expansionSteps:[2,3,4,8],globalUpgrade:true,inheritedEquipment:true,inheritedWear:true});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 for(const query of['poor','active']){await visit(query);await openCapacity();const button=await expansionButton();assert.equal(await button.evaluate(b=>b.disabled),true);assert.equal(await page.evaluate(()=>window.__requests.length),0);}
 await visit();await page.evaluate(()=>window.__rejectOnce=true);await expand();await page.waitForSelector(capacity+' [role=alert]');
 const failed=await page.evaluate(()=>window.__requests.at(-1));assert.equal(await page.evaluate(()=>window.__state.productionUnits),1);await expand();await waitUnits(2);assert.equal(await page.evaluate(()=>window.__requests.at(-1).requestKey),failed.requestKey);
 for(const [width,height]of[[390,844],[1440,1000]]){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});
  await page.goto(origin+'/?view=catalog&units=4&empty',{waitUntil:'networkidle0'});await page.waitForSelector('button[aria-label="Voir Pièce séchoir"]');
  await page.select('select[aria-label="Tente à observer"]','2');await page.waitForFunction(()=>document.querySelector('select[aria-label="Tente à observer"]')?.disabled===false);
  const price=60000,priceText=await page.evaluate(price=>window.__cash(price),price);
  assert.equal(compact(await page.$eval('button[aria-label="Voir Pièce séchoir"]',el=>el.closest('article').textContent)).includes(compact(priceText)),true);
  await page.$eval('button[aria-label="Voir Pièce séchoir"]',el=>el.closest('article').querySelector('footer button').click());
  await page.click('button[aria-label^="Ouvrir le panier"]');await page.$$eval('button',els=>els.find(b=>b.textContent==='Valider le panier').click());await page.waitForSelector('[aria-labelledby=checkout-title]');
  assert.equal(compact(await page.$eval('[aria-labelledby=checkout-title]',el=>el.textContent)).includes(compact(priceText)),true);
  await page.$$eval('button',els=>els.find(b=>b.textContent==='Confirmer l’achat').click());await page.waitForSelector('[aria-labelledby=equipment-purchase-title]');
  assert.equal(await page.evaluate(()=>window.__state.cashCents),10000000-price);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).tentNumber),1);
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).expectedUnits),4);
  assert.equal(await page.evaluate(()=>window.__state.tents[1].purchasedCodes.includes('DRYING-ROOM')),true);
  assert.equal(await page.evaluate(()=>window.__state.tents.every(t=>t.purchasedCodes.includes('DRYING-ROOM'))),true,'One purchase becomes available in every tent');
  assert.equal(await page.evaluate(()=>window.__state.sharedEquipment.purchasedCodes.filter(code=>code==='DRYING-ROOM').length),1);
  await page.$$eval('[aria-labelledby=equipment-purchase-title] button',els=>els.find(b=>b.textContent==='Installer').click());await page.waitForSelector('[data-warehouse-slot=tent]:not(:disabled)');
  assert.equal(await page.$eval('[data-warehouse-tent="2"] [data-warehouse-slot=tent]',el=>el.dataset.tentSelected),'true','Selection survives shop-to-warehouse navigation');
  await page.$$eval('button',els=>els.find(b=>b.textContent==='Installer pour toutes les tentes').click());await page.waitForSelector('[data-warehouse-slot=flower-drying][data-installed=true]');
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Niveau 2')&&!b.disabled));
  await page.$$eval('button',els=>els.find(b=>b.textContent.includes('Niveau 2')).click());await page.waitForFunction(()=>window.__state.tents[1].levels['DRYING-ROOM']===2);
  assert.equal(await page.evaluate(()=>window.__state.tents.every(t=>t.levels['DRYING-ROOM']===2)),true,'One upgrade is visible throughout the installation');
  await page.goto(origin+'/?view=energy&units=4',{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Charges du Placard"]');
  await page.waitForFunction(()=>document.body.textContent.includes('4 tentes'));
  const energy=await page.evaluate(()=>window.__cash(window.__energy().totalCents));assert.equal(compact(await page.$eval('[aria-label="Charges du Placard"]',el=>el.textContent)).includes(compact(energy)),true);
  await page.$$eval('summary',els=>els.find(el=>el.textContent==='Détail par appareil').click());
  assert.equal(await page.$eval('[aria-label="Charges du Placard"]',el=>el.textContent.includes('Tente 4 ·')),true,'Energy identifies each tent');
  assert.equal(await page.$eval('[aria-label="Charges du Placard"] details',el=>el.textContent.includes('×4')),false,'Individual appliance lines are not multiplied again');
  const lines=await page.$$eval('[aria-label="Charges du Placard"] details:first-of-type li',rows=>rows.map(row=>row.textContent));
  assert.equal(lines.filter(line=>line.includes('Pièce séchoir')).length,1,'One common drying service consumes power once');
  const wearRows=await page.$$eval('[aria-label="Usure prévue du matériel"] li',rows=>rows.map(row=>row.textContent));
  assert.equal(wearRows.length,2,'One wear preview per global model, independent of tent count');
  assert.equal(wearRows.filter(row=>row.includes('Pièce séchoir')).length,1);
  const wearCost=await page.evaluate(()=>window.__cash(window.__wear('balanced').reduce((sum,item)=>sum+item.wearCostCents,0)));
  assert.ok(compact(await page.$eval('[aria-label="Usure prévue du matériel"]',el=>el.textContent)).includes(compact(wearCost)));
  assert.deepEqual(await page.evaluate(()=>window.__unexpected),[]);
  await page.screenshot({path:resolve(output,'energy-4-'+width+'.png')});
  await page.goto(origin+'/?view=legacy-energy&units=4',{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Charges du Placard"]');
  const legacyCash=await page.evaluate(()=>window.__cash(window.__legacyEnergy.totalCents));
  assert.ok(compact(await page.$eval('[aria-label="Charges du Placard"]',el=>el.textContent)).includes(compact(legacyCash)),'Legacy frozen invoice keeps its original amount');
  await page.$$eval('summary',els=>els.find(el=>el.textContent==='Détail par appareil').click());
  const legacyLines=await page.$$eval('[aria-label="Charges du Placard"] details:first-of-type li',rows=>rows.map(row=>row.textContent));
  assert.equal(legacyLines.filter(line=>line.includes('Tente 1')&&line.includes('Pièce séchoir')).length,1,'Legacy invoice preserves its tent attribution');
  assert.equal(legacyLines.filter(line=>line.includes('Tente 4')).length,2,'Legacy last tent keeps its starter appliances');
  assert.deepEqual(await page.evaluate(()=>window.__unexpected),[]);
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({viewports:reports,poorBlocked:true,activeRunBlocked:true,retryKeepsRequestKey:true,globalCheckout:true,tentSelectionPreserved:true,installationEnergy:true,singleWearPreview:true,legacyInvoicePreserved:true,errors},null,2));
 console.log('PASS: scene first, compact closed expansion and illustrated panel on 320px, 390px and desktop; keyboard disclosure, expansion 1→2→3→4→8, exact quotes and balances, final capacity, active/poor guards, idempotent retry, inherited equipment/levels/wear, global upgrades and checkout, retained tent selection, installation energy, single wear preview and legacy frozen invoice.');
} finally {await browser?.close();await server.close();}
