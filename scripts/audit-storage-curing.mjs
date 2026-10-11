/** Real warehouse/commerce UI, local operations adapter and storage engine; no account changes. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/storage-curing'), port = 3248;
const modules = {
  entry: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {KqEquipmentInventoryModal} from '/src/components/placard/KqEquipmentInventoryModal';
import {KqCommerceDesk} from '/src/components/placard/KqCommerceDesk';
import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsStorage,getKqOperationsEquipment} from '/src/lib/kanab-quest-operations-lesson';
import {createKqStorageLot,projectKqStorageLot,planKqStorageAllocation} from '/src/lib/kanab-quest-storage';
const origin=Date.parse('2026-10-10T10:00:00Z');let state=createKqOperationsLesson('warehouse');
state.trial.clock=origin+30*60000;state.trial.game.harvestGrams=450;state.trial.game.completedAt=new Date(origin).toISOString();
state.trial.battle.burnedAt=new Date(origin).toISOString();state.trial.battle.rounds=state.trial.battle.rounds.map(round=>({...round,playerScore:90}));
state.trial.commerce.reputation=1500;state.trial.commerce.clients=100;state.trial.commerce.shopPartners=3;
state.trial.commerce.business.serverNow=new Date(state.trial.clock).toISOString();
state.trial.commerce.business.shop.paidUntil=new Date(origin+100*86400000).toISOString();
state.storage.lot=createKqStorageLot({flowerId:state.storage.lot.flowerId,harvestedAt:new Date(origin).toISOString(),curingStartedAt:new Date(origin).toISOString(),
  baseline:{...state.storage.lot.baseline,juryScore:9,aroma:85,care:{...state.storage.lot.baseline.care,terpenes:85,cannabinoidExpression:85}},
  capacity:planKqStorageAllocation({totalUnits:4500,ownedContainers:state.storage.ownedContainers,preferredMethodCode:'STORAGE-GLASS',nowMs:origin})});
window.requests=[];const request=async(url,options={})=>{const path=new URL(String(url),location.origin).pathname;const body=options.body?JSON.parse(options.body):{};const method=options.method??'GET';window.requests.push({path,method,body});
  try{const result=applyKqOperationsRequest(state,{path,method,body});state=result.state;return Response.json(result.payload)}catch(error){return Response.json({error:error.message},{status:400})}};
const api={...createKqTutorialApi(request),isTutorial:false};
window.fixture=()=>({...getKqOperationsStorage(state),prepared:state.prepared,jury:state.trial.battle.rounds[0].playerScore/10,stocks:state.trial.commerce.stocks});
window.replay=async index=>{const original=window.requests[index];return request(original.path,{method:original.method,body:JSON.stringify(original.body)})};
window.mature=()=>{state.trial.clock=Date.parse(state.storage.lot.readyAt);state.trial.commerce.business.serverNow=new Date(state.trial.clock).toISOString();const projection=projectKqStorageLot(state.storage.lot,state.trial.clock);state.trial.commerce.stocks=state.trial.commerce.stocks.map(stock=>({...stock,storage:projection}));api.notify('kq:storage-updated')};
window.expireOverflow=(offset=0)=>{state.trial.clock=Date.parse(state.storage.lot.capacity.overflowDeadlineAt)+offset;state.trial.commerce.business.serverNow=new Date(state.trial.clock).toISOString()};
function App(){const[view,setView]=useState('storage');const[,refresh]=useState(0);const equipment=getKqOperationsEquipment(state);return <KqTutorialApiProvider api={api}>{view==='market'?<KqCommerceDesk onOpenShop={()=>{}} onOpenStorage={()=>setView('storage')}/>:<KqEquipmentInventoryModal key={view} {...equipment} initialSection={view==='storage'?'storage':'equipment'} loading={false} loadError='' onClose={()=>setView('market')} onOpenShop={()=>{}} onRetry={()=>refresh(value=>value+1)}/>}</KqTutorialApiProvider>};createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},plugins:[{name:'storage-audit',enforce:'pre',resolveId(id){if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-manifest';if(id in modules)return '\0'+id;},async load(id){if(id==='\0warehouse-manifest')return 'export default '+await readFile(resolve(root,'public/placard/warehouse-v2/manifest.json'),'utf8');if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#174c3b}button,a,select,input{font-family:inherit}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>');});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser;
const checks=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1440,height:1000});await page.goto('http://127.0.0.1:'+port,{waitUntil:'networkidle0'});
  const clickText=async text=>{const found=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(node=>node.textContent.includes(text)&&!node.disabled),{},text);await found.asElement().click();await found.dispose();};
  const fixture=()=>page.evaluate(()=>window.fixture());
  const selectQuantity=async(code,value)=>{const selector='[data-container-code="'+code+'"] input';await page.locator(selector).fill(String(value));};
  const buy=async(code,quantity)=>{await selectQuantity(code,quantity);const before=(await fixture()).ownedContainers[code]??0;await page.locator('[data-container-code="'+code+'"] button').click();await page.waitForFunction((code,quantity)=>window.fixture().ownedContainers[code]===quantity,{},code,before+quantity);};
  await page.waitForSelector('[data-storage-capacity]');
  await page.locator('[data-storage-shop] > summary').click();
  assert.equal(await page.$$eval('[data-container-code]',nodes=>nodes.length),9);
  assert.equal(await page.$$eval('[data-container-code] a',nodes=>nodes.filter(node=>node.textContent.includes('Produit de référence')).length),9);
  const containerCodes=await page.$$eval('[data-container-code]',nodes=>nodes.map(node=>node.dataset.containerCode));
  for(const code of containerCodes){
    await page.locator('[data-container-code="'+code+'"]').scroll();
    await page.waitForFunction(code=>{const img=document.querySelector('[data-container-code="'+code+'"] img');return img?.complete&&img.naturalWidth>0},{},code);
  }
  assert.equal(await page.$$eval('[data-container-code] img',nodes=>nodes.length),9);
  assert.ok(await page.$$eval('[data-container-code] img',nodes=>nodes.every(node=>node.alt.length>20&&getComputedStyle(node).objectFit==='contain')));
  checks.push('nine realistic container illustrations load with accessible descriptions and no crop');
  for(const [width,columns] of [[320,1],[768,2],[1440,3]]){
    await page.setViewport({width,height:1000});
    await page.$eval('[data-container-code="GLASS-1L"]',node=>node.scrollIntoView({block:'start',behavior:'instant'}));
    const layout=await page.$eval('[data-container-code]',node=>({columns:getComputedStyle(node.parentElement).gridTemplateColumns.split(' ').length,width:node.closest('[data-warehouse-storage]').clientWidth,scroll:node.closest('[data-warehouse-storage]').scrollWidth}));
    assert.equal(layout.columns,columns,'product columns at '+width);
    assert.ok(layout.scroll<=layout.width,'warehouse overflow at '+width);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow at '+width);
    await page.screenshot({path:resolve(output,'containers-'+width+'.png'),fullPage:true});
  }
  for(const code of ['GROVE-1OZ','CVAULT-2OZ']){
    await page.$eval('[data-container-code="'+code+'"]',node=>node.scrollIntoView({block:'start',behavior:'instant'}));
    await page.screenshot({path:resolve(output,'containers-'+code.toLowerCase()+'-1440.png'),fullPage:true});
  }
  checks.push('product catalogue has one two and three columns at mobile tablet and desktop widths','container catalogue stays within all three viewports');
  await page.locator('[data-warehouse-storage] h3').scroll();
  const before=await fixture();assert.equal(before.capacity.totalUnits,1000);assert.equal(before.capacity.usedUnits,1000);assert.equal(before.capacity.overflowUnits,3500);
  const original=before.lots[0].projection;
  assert.equal(Date.parse(original.readyAt)-Date.parse(original.curingStartedAt),6*3600000);
  assert.equal(original.progressPercent,8.33);
  assert.ok(await page.$eval('[data-warehouse-storage]',node=>node.textContent.includes('6 heures réelles')));
  assert.equal(Date.parse(original.capacity.overflowDeadlineAt)-Date.parse(original.curingStartedAt),3600000);
  assert.ok(await page.$eval('[data-warehouse-storage]',node=>node.textContent.includes('1 heure réelle')));
  assert.ok(await page.$eval('[data-overflow-deadline]',node=>node.textContent.includes('vente automatique au grossiste')));
  checks.push('nine real product references','two starter jars and 350 g overflow','six real hours curing advances during the first half hour','one real hour surplus deadline');
  await page.screenshot({path:resolve(output,'warehouse-desktop.png'),fullPage:true});
  assert.ok(await page.$eval('[data-storage-capacity]',(node,deadline)=>node.textContent.includes('Première vente automatique : '+new Date(deadline).toLocaleString('fr-FR')),original.capacity.overflowDeadlineAt));
  await page.setViewport({width:390,height:844});await page.locator('[data-storage-capacity]').scroll();
  await page.screenshot({path:resolve(output,'warehouse-summary-mobile.png'),fullPage:true});
  await page.locator('[data-storage-capacity] a[href="#storage-lots-title"]').click();
  await page.waitForFunction(()=>{const heading=document.getElementById('storage-lots-title'),rect=heading.getBoundingClientRect();return location.hash==='#storage-lots-title'&&rect.top>=0&&rect.bottom<=innerHeight});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  checks.push('first automatic sale deadline displayed above catalogue','mobile urgency link scrolls directly to visible lots');
  await page.setViewport({width:1440,height:1000});

  await page.locator('[aria-label="Fermer l’inventaire"]').click();await clickText('Transformer');
  await page.waitForSelector('a[href="/arene/placard?view=workshop&section=storage"]');
  assert.equal(await page.$$eval('button',nodes=>nodes.find(node=>node.textContent.includes('Préparer les fleurs et continuer')).disabled),true);
  await page.locator('a[href="/arene/placard?view=workshop&section=storage"]').click();
  await page.waitForSelector('[data-container-code="GLASS-1L"]');checks.push('preparation blocked by overflow','market link opens storage directly');
  await page.locator('[data-storage-shop] > summary').click();

  await buy('GLASS-1L',2);let after=await fixture();assert.equal(after.cashCents,before.cashCents-1000);assert.equal(after.capacity.overflowUnits,2500);
  await buy('GLASS-1L',1);after=await fixture();assert.equal(after.ownedContainers['GLASS-1L'],5);assert.equal(after.cashCents,before.cashCents-1500);assert.equal(after.capacity.overflowUnits,2000);
  const originalRequest=await page.evaluate(()=>window.requests.findIndex(request=>request.body.action==='buy'));
  await page.evaluate(index=>window.replay(index),originalRequest);assert.equal((await fixture()).cashCents,after.cashCents);
  for(const quantity of [0,1.5,101]){await selectQuantity('GLASS-1L',quantity);assert.equal(await page.$eval('[data-container-code="GLASS-1L"] button',node=>node.disabled),true)}
  await selectQuantity('GLASS-1L',1);checks.push('quantity purchase debits unit price times quantity','same format purchased repeatedly','replayed purchase never debits twice','zero fraction and excessive quantities blocked');

  await buy('GROVE-1OZ',1);after=await fixture();assert.equal(after.capacity.totalUnits,2780);assert.equal(after.capacity.usedUnits,2780);assert.equal(after.capacity.overflowUnits,1720);
  assert.equal(await page.$$eval('[data-warehouse-storage] select',nodes=>nodes.length),2);await page.select('[data-storage-shop] select','STORAGE-GROVE');await page.waitForFunction(()=>window.fixture().defaultMethodCode==='STORAGE-GROVE');
  await page.select('[aria-labelledby="storage-lots-title"] select','STORAGE-GROVE');await page.waitForFunction(()=>window.fixture().lots[0].projection.methodCode==='STORAGE-GROVE');
  after=await fixture();assert.equal(after.lots[0].projection.readyAt,original.readyAt);assert.equal(after.lots[0].projection.conditionScore,original.conditionScore);assert.equal(after.lots[0].projection.capacity.overflowDeadlineAt,original.capacity.overflowDeadlineAt);
  checks.push('new container fills only part of surplus','default family and mixed allocation','allocation preserves quality and both deadlines');
  await page.locator('[data-cannabinoid-report] summary').click();assert.equal(await page.$$eval('[data-cannabinoid-report] tbody tr',nodes=>nodes.length),7);
  await page.setViewport({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.$eval('[data-warehouse-storage]',node=>node.scrollWidth<=node.clientWidth),true);
  await selectQuantity('GLASS-1L',2);assert.ok(await page.$eval('[data-container-code="GLASS-1L"] button',node=>node.textContent.includes('10')));
  await page.locator('[data-container-code="GLASS-1L"]').scroll();await page.screenshot({path:resolve(output,'warehouse-purchase-mobile.png'),fullPage:true});
  await selectQuantity('GLASS-1L',1);checks.push('mobile quantity control updates purchase total');
  await page.locator('[data-storage-overflow]').scroll();await page.screenshot({path:resolve(output,'warehouse-mobile.png'),fullPage:true});checks.push('seven cannabinoid totals','mobile warehouse stays within viewport');

  const beforeSale=await fixture();await page.locator('[data-storage-overflow] button').click();await page.waitForFunction(()=>window.fixture().capacity.overflowUnits===0);
  after=await fixture();assert.equal(after.overflowSales[0].units,1720);assert.equal(after.overflowSales[0].automatic,false);assert.equal(after.capacity.usedUnits,beforeSale.capacity.usedUnits);assert.equal(after.lots[0].projection.capacity.totalUnits,2780);assert.equal(after.cashCents-beforeSale.cashCents,after.overflowSales[0].netPayoutCents);
  assert.equal(await page.$$eval('[data-storage-overflow]',nodes=>nodes.length),0);assert.equal(await page.$$eval('[data-storage-capacity] a[href="#storage-lots-title"]',nodes=>nodes.length),0);checks.push('manual wholesale sells only unprotected mass','sale credits net amount and preserves stored harvest','summary urgency disappears when surplus is cleared');

  await page.locator('[aria-label="Fermer l’inventaire"]').click();await clickText('Transformer');await clickText('Préparer les fleurs et continuer');await clickText('Confirmer');await page.waitForSelector('[aria-label="Circuits de vente"]');
  assert.equal(await page.$$eval('[aria-label="Circuits de vente"] [data-unavailable=true]',nodes=>nodes.length),2);assert.ok(await page.$eval('[data-curing-status]',node=>node.textContent.includes('grossistes uniquement')));
  await page.screenshot({path:resolve(output,'commerce-curing.png'),fullPage:true});checks.push('wholesale available before curing','two retail channels locked before curing');
  await page.evaluate(()=>window.mature());await page.waitForSelector('[data-curing-status][data-ready=true]');await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Circuits de vente"] [data-unavailable=true]').length===0);
  assert.equal((await fixture()).jury,9);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(output,'commerce-ready-mobile.png'),fullPage:true});checks.push('maturity opens eligible circuits','jury score immutable','mobile commerce stays within viewport');
  const mutations=await page.evaluate(()=>window.requests.filter(request=>request.method==='POST'));assert.ok(mutations.every(request=>request.body.requestKey&&!('priceCents'in request.body)&&!('now'in request.body)));
  checks.push('mutations carry request identity without client price or time');

  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-storage-overflow]');
  await page.evaluate(()=>window.expireOverflow(-1));await page.locator('[aria-label="Actualiser le stockage"]').click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Actualiser le stockage"]').disabled===false);
  assert.equal((await fixture()).overflowSales.length,0);checks.push('surplus remains available one millisecond before its one-hour deadline');
  await page.evaluate(()=>window.expireOverflow());await page.locator('[aria-label="Actualiser le stockage"]').click();await page.waitForFunction(()=>window.fixture().overflowSales.length===1);
  after=await fixture();assert.equal(after.overflowSales[0].automatic,true);assert.equal(after.overflowSales[0].units,3500);assert.equal(after.capacity.usedUnits,1000);assert.equal(after.capacity.overflowUnits,0);
  await page.locator('[aria-label="Actualiser le stockage"]').click();assert.equal((await fixture()).overflowSales.length,1);checks.push('automatic wholesale at one hour deadline','repeated refresh never repeats automatic sale');
  assert.deepEqual(errors,[]);checks.push('no browser errors');
  await writeFile(resolve(output,'result.json'),JSON.stringify({passed:true,checks},null,2));console.log('Storage browser audit: '+checks.length+' checks passed.');
}finally{if(browser)await browser.close();await server.close();}
