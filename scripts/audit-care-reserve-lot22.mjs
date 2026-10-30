/** Real care components, local transport and browser evidence; no player account. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const baseline = process.argv.includes('--before');
const phase = baseline ? 'before' : 'after';
const output = resolve(root, 'output/clarity-lot22', phase);
const port = Number(process.env.KQ_CARE_RESERVE_AUDIT_PORT || 3592);
const origin = `http://127.0.0.1:${port}`;
const modules = {
  'next/image': `import React from 'react';export default function Image({src,fill,preload,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  entry: `import React,{useState,useEffect} from 'react';
import '/src/app/globals.css';
import {createRoot} from 'react-dom/client';
import {KqCareShop} from '/src/components/placard/KqCareShop';
import {KqCultureCarePanel} from '/src/components/placard/KqCultureCarePanel';
import {startKqGame} from '/src/lib/kanab-quest-game';
import {KQ_CARE_PRODUCTS,getKqCareProduct,canApplyKqCareProduct,applyKqCareProduct} from '/src/lib/kanab-quest-care';
import gameStyles from '/src/components/placard/KanabQuestDicePrototype.module.css';
const params=new URLSearchParams(location.search),scenario=params.get('scenario')||'stocked',integrated=params.has('integrated'),catalogue=params.has('catalogue');
let game=startKqGame(100);
game.care={...game.care,vitality:76,problems:[{code:'APHIDS',severity:2,status:'confirmed',trend:'stable',appearedAt:0,variant:0}]};
if(scenario==='healthy')game.care.problems=[];
if(scenario==='heat')game.care.problems=['MITES','HEAT'].map(code=>({code,severity:2,status:'confirmed',trend:'stable',appearedAt:0,variant:0}));
if(scenario==='late')game.stageIndex=4;
if(scenario==='active')game=applyKqCareProduct(game,'CARE-APHIDIUS');
const catalog=KQ_CARE_PRODUCTS.map(product=>({...product,priceCents:product.code==='CARE-APHIDIUS'&&scenario==='server-price'?2300:product.priceCents})).filter(product=>scenario!=='missing-price'||product.code!=='CARE-APHIDIUS');
let wallet={cashCents:scenario==='poor'?500:scenario==='replay-poor'?1200:35000,inventory:['empty','purchase','replay','replay-poor'].includes(scenario)?[]:[{productCode:scenario==='heat'?'CARE-PHYTOSEIULUS':'CARE-APHIDIUS',quantity:scenario==='apply-replay'?1:2}],basicCarePriceCents:500,catalog};
const requests=[],receipts=new Map();let charges=0,applications=0,failed=false,readFailure=scenario==='error',holdRead=scenario==='loading';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
window.__careSnapshot=()=>({wallet,requests,charges,applications,receipts:[...receipts.keys()],game});
window.__setReadFailure=value=>{readFailure=value};
window.__holdRead=()=>{holdRead=true};
window.__releaseRead=()=>{holdRead=false};
const request=async(url,init)=>{
 const method=init?.method||'GET',input=init?.body?JSON.parse(init.body):null;
 requests.push({url:String(url),method,input});
 if(method==='GET'){
  while(holdRead)await new Promise(resolve=>setTimeout(resolve,10));
  if(readFailure)return response({error:'Réserve indisponible. Réessaie.'},503);
  return response(scenario==='missing-inventory'?{...wallet,inventory:undefined}:wallet);
 }
 if(method!=='POST')throw Error('Unexpected mutation');
 if(scenario==='pending-purchase'&&!String(url).includes('/runs/'))await new Promise(resolve=>{window.__releasePurchase=resolve});
 if(receipts.has(input.requestKey))return response({...receipts.get(input.requestKey),replayed:true,cashCents:wallet.cashCents,inventory:wallet.inventory});
 if(String(url).includes('/runs/')){
  if(!canApplyKqCareProduct(game,input.productCode).allowed)return response({error:'Intervention interdite pour cette culture.'},409);
  const owned=wallet.inventory.find(item=>item.productCode===input.productCode);
  if(!owned?.quantity)return response({error:'Aucune charge disponible.'},409);
  game=applyKqCareProduct(game,input.productCode);owned.quantity--;applications++;if(scenario==='apply-refresh-error')readFailure=true;
  const result={state:game,cashCents:wallet.cashCents,inventory:wallet.inventory,chargedCents:0,replayed:false,updatedAt:new Date().toISOString()};receipts.set(input.requestKey,result);
  if(scenario==='apply-replay'&&!failed){failed=true;throw Error('Réponse intervention interrompue après validation. Réessaie.');}
  return response(result);
 }
 const product=wallet.catalog.find(product=>product.code===input.productCode);
 if(!product||input.quantity!==1||!input.requestKey)throw Error('Purchase contract mismatch');
 if(wallet.cashCents<product.priceCents)return response({error:'Trésorerie insuffisante.'},409);
 wallet.cashCents-=product.priceCents;charges++;
 const owned=wallet.inventory.find(item=>item.productCode===product.code);if(owned)owned.quantity++;else wallet.inventory.push({productCode:product.code,quantity:1});
 const result={cashCents:wallet.cashCents,inventory:wallet.inventory,totalPriceCents:product.priceCents,replayed:false};receipts.set(input.requestKey,result);
 if(scenario.startsWith('replay')&&!failed){failed=true;throw Error('Réponse interrompue après validation. Réessaie.');}
 return response(result);
};
function App(){
 const [state,setState]=useState(game),[busy,setBusy]=useState(false),[refreshKey,setRefreshKey]=useState(0);
 useEffect(()=>{window.__refreshCare=()=>setRefreshKey(value=>value+1)},[]);
 const apply=async productCode=>{const result=await request('/api/admin/placard/runs/audit-run/care',{method:'POST',body:JSON.stringify({productCode,requestKey:crypto.randomUUID()})});const body=await result.json();if(!result.ok)throw Error(body.error);setState(body.state)};
 return <main className={gameStyles.page} data-player-mode style={{maxWidth:1100,margin:'auto',padding:12}}>
 {integrated?<KqCultureCarePanel state={state} request={request} runId="audit-run" disabled={busy} onBusyChange={setBusy} onStateChange={setState}/>:<KqCareShop request={request} state={catalogue?undefined:state} onApply={catalogue?undefined:apply} refreshKey={refreshKey} disabled={busy} onBusyChange={setBusy}/>}
 </main>;
}
createRoot(document.getElementById('root')).render(<App/>);`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#174c3b}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react'],exclude:['next/image']},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'care-reserve-lot22',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fonts+'</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>')})}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser,page;
const checks=[],errors=[],blockedRequests=[],metrics=[];
const pass=name=>checks.push(name);
const shop='[aria-label="Intrants et protection biologique"]';
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();page.setDefaultTimeout(20000);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(['data:','blob:'].includes(url.protocol))return void request.continue();if(url.origin!==origin||url.pathname.startsWith('/api/')){blockedRequests.push({method:request.method(),url:url.href});return void request.abort()}void request.continue()});
 const clickText=async text=>{const handle=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(node=>node.textContent.includes(text)&&!node.disabled),{},text);await handle.asElement().click();await handle.dispose()};
 const ready=async()=>{await page.waitForSelector(shop);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(image=>image.complete&&image.naturalWidth>0))};
 const visit=async(query='')=>{await page.goto(origin+'/'+query,{waitUntil:'networkidle0'});await ready()};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:900});await visit('?scenario=stocked');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const data=await page.$eval(shop,node=>{const buttons=[...node.querySelectorAll('button')];const firstUse=buttons.find(button=>button.textContent.includes('Utiliser')&&!button.disabled);return {height:node.getBoundingClientRect().height,firstUse:firstUse?{text:firstUse.textContent,y:firstUse.getBoundingClientRect().top}:null,visibleProducts:[...node.querySelectorAll('article h3')].map(item=>item.textContent),buttonFonts:[...new Set(buttons.map(item=>getComputedStyle(item).fontSize))],text:node.innerText}});metrics.push({width,...data});
  await page.screenshot({path:resolve(output,`reserve-${width}.png`),fullPage:true});
  if(baseline){await clickText('Protection biologique');await ready();const target=await page.waitForFunction(()=>[...document.querySelectorAll('article')].find(node=>node.textContent.includes('Aphidius colemani')));await target.asElement().screenshot({path:resolve(output,`aphidius-${width}.png`)});await target.dispose()}
  pass(`reserve renders without horizontal overflow at ${width}px`);
 }
 await page.setViewport({width:390,height:844});await page.goto(origin+'/?integrated&scenario=stocked',{waitUntil:'networkidle0'});await page.waitForSelector('[data-care-toggle]');await page.click('[data-care-toggle]');await page.click('[data-care-reserve-toggle]');await ready();await page.screenshot({path:resolve(output,'integrated-390.png'),fullPage:true});pass('reserve opens from real culture care panel');
 if(!baseline){
  const product=code=>`[data-care-product="${code}"]`;
  const action=(code,kind)=>`${product(code)} [data-care-product-${kind}]`;
  const state=()=>page.evaluate(()=>window.__careSnapshot());
  const settled=async(status='ready')=>page.waitForFunction(status=>{const node=document.querySelector('[data-care-reserve-status]');return node?.getAttribute('data-care-reserve-status')===status&&(status!=='ready'||node.getAttribute('aria-busy')==='false')},{},status);
  const disabled=selector=>page.$eval(selector,node=>node.disabled);
  const openIntegrated=async scenario=>{await page.goto(origin+'/?integrated&scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector('[data-care-toggle]');await page.click('[data-care-toggle]');await page.click('[data-care-reserve-toggle]');await ready();await settled()};

  await visit('?scenario=stocked');await settled();
  assert.equal(await page.$eval(shop,node=>node.getAttribute('data-care-view')),'context');
  assert.deepEqual((await page.$$eval('[data-care-product]',nodes=>nodes.map(node=>node.getAttribute('data-care-product')))).sort(),['CARE-APHIDIUS','CARE-CHRYSOPERLA','CARE-COCCINELLA']);
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),false);
  assert.equal((await state()).requests.filter(item=>item.method==='POST').length,0);
  pass('pucerons open directly on the three matching products with stocked Aphidius usable');

  for(const metric of metrics){assert.notEqual(metric.firstUse,null);assert.ok(metric.firstUse.y<900,`first useful action visible at ${metric.width}px`)}
  pass('a usable stocked intervention appears in the first viewport at all three widths');
  assert.equal(await page.$$eval('[data-care-product] details',nodes=>nodes.every(node=>!node.open)),true);
  await page.focus(action('CARE-APHIDIUS','use'));await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__careSnapshot().applications===1);await settled();
  assert.equal((await state()).wallet.inventory.find(item=>item.productCode==='CARE-APHIDIUS').quantity,1);
  assert.equal((await state()).charges,0);assert.equal((await state()).game.care.vitality,76);
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),true);
  assert.match(await page.$eval(product('CARE-APHIDIUS'),node=>node.innerText),/encore active|en cours/);
  pass('keyboard use consumes one charge, without cash debit or immediate health change, and blocks repeat use');

  await visit('?scenario=healthy');await settled();
  assert.equal(await page.$$eval('[data-care-product]',nodes=>nodes.length),0);
  assert.match(await page.$eval(shop,node=>node.innerText),/Aucun problème|aucun problème/);
  await clickText('Intrants du sol vivant');
  assert.equal(await page.$$eval('[data-care-product]',nodes=>nodes.length),4);
  await clickText('Protection biologique');
  assert.equal(await page.$$eval('[data-care-product]',nodes=>nodes.length),6);
  pass('healthy culture has an explicit empty context and all ten products remain reachable in the catalogue');

  await visit('?scenario=heat');await settled();
  assert.deepEqual((await page.$$eval('[data-care-product]',nodes=>nodes.map(node=>node.getAttribute('data-care-product')))).sort(),['CARE-PHYTOSEIULUS','CARE-SEAWEED']);
  assert.equal(await disabled(action('CARE-PHYTOSEIULUS','use')),true);
  assert.match(await page.$eval(product('CARE-PHYTOSEIULUS'),node=>node.innerText),/Stress thermique actif/);
  await page.screenshot({path:resolve(output,'heat-blocked-390.png'),fullPage:true});
  pass('a matching but heat-blocked biological treatment remains visible with its actual reason');

  await visit('?scenario=late');await settled();
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),true);
  assert.match(await page.$eval(product('CARE-APHIDIUS'),node=>node.innerText),/Trop tard/);
  pass('harvest timing restrictions remain visible on otherwise matching products');

  await visit('?scenario=server-price');await settled();
  assert.match(await page.$eval(product('CARE-APHIDIUS'),node=>node.innerText),/23,00/);
  await page.click(action('CARE-APHIDIUS','buy'));
  await page.waitForFunction(()=>window.__careSnapshot().charges===1);
  assert.equal((await state()).wallet.cashCents,32700);assert.equal((await state()).applications,0);
  pass('purchase uses the server catalogue price and never applies the charge automatically');

  await visit('?scenario=missing-price');await settled();
  assert.equal(await disabled(action('CARE-APHIDIUS','buy')),true);
  assert.doesNotMatch(await page.$eval(product('CARE-APHIDIUS'),node=>node.innerText),/12,00/);
  pass('missing server price blocks purchase instead of using a local default');

  await visit('?scenario=poor');await settled();
  assert.equal(await disabled(action('CARE-APHIDIUS','buy')),true);
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),false);
  assert.match(await page.$eval(product('CARE-APHIDIUS'),node=>node.innerText),/insuffisante/);
  pass('insufficient cash blocks buying but preserves use of an already owned charge');

  await visit('?scenario=loading');await settled('loading');
  assert.equal(await page.$$eval('[data-care-product-buy],[data-care-product-use]',nodes=>nodes.every(node=>node.disabled)),true);
  assert.doesNotMatch(await page.$eval(shop,node=>node.innerText),/0 en réserve|0 charge/);
  await page.screenshot({path:resolve(output,'loading-390.png'),fullPage:true});
  await page.evaluate(()=>window.__releaseRead());await settled();
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),false);
  pass('loading stock is unknown, blocks actions and becomes usable when the response arrives');

  await visit('?scenario=error');await settled('error');
  assert.equal(await page.$$eval('[data-care-product-buy],[data-care-product-use]',nodes=>nodes.every(node=>node.disabled)),true);
  assert.doesNotMatch(await page.$eval(shop,node=>node.innerText),/0 en réserve|0 charge/);
  await page.evaluate(()=>window.__setReadFailure(false));await page.click('[data-care-shop-refresh]');await settled();
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),false);
  pass('read error shows no false zero stock and supports a working retry');

  await page.evaluate(()=>window.__setReadFailure(true));await page.click('[data-care-shop-refresh]');await settled('error');
  assert.equal(await page.$$eval('[data-care-product-buy],[data-care-product-use]',nodes=>nodes.every(node=>node.disabled)),true);
  await page.screenshot({path:resolve(output,'refresh-error-390.png'),fullPage:true});
  pass('a failed refresh invalidates the previous wallet before another action');

  await visit('?scenario=missing-inventory');await settled('error');
  assert.equal(await page.$$eval('[data-care-product-buy],[data-care-product-use]',nodes=>nodes.every(node=>node.disabled)),true);
  assert.doesNotMatch(await page.$eval(shop,node=>node.innerText),/0 en réserve|0 charge/);
  pass('malformed missing inventory stays unavailable instead of turning into an empty reserve');

  await visit('?scenario=replay');await settled();
  await page.click(action('CARE-APHIDIUS','buy'));
  await page.waitForFunction(()=>window.__careSnapshot().charges===1);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Intrants et protection biologique"]')?.innerText.includes('Réponse interrompue'));
  await settled();
  await page.click(action('CARE-APHIDIUS','buy'));
  await page.waitForFunction(()=>window.__careSnapshot().requests.filter(item=>item.method==='POST').length===2);
  const replay=await state(),posts=replay.requests.filter(item=>item.method==='POST');
  assert.equal(posts[0].input.requestKey,posts[1].input.requestKey);
  assert.equal(replay.charges,1);assert.equal(replay.wallet.cashCents,33800);assert.equal(replay.wallet.inventory[0].quantity,1);assert.equal(replay.applications,0);
  pass('retry after a lost purchase response reuses its request key and charges only once');

  await visit('?scenario=replay-poor');await settled();
  await page.click(action('CARE-APHIDIUS','buy'));
  await page.waitForFunction(()=>window.__careSnapshot().charges===1);
  await page.waitForFunction(()=>document.querySelector('[aria-label="Intrants et protection biologique"]')?.innerText.includes('Réponse interrompue'));
  await settled();
  await page.click('[data-care-shop-refresh]');await settled();
  assert.equal(await disabled(action('CARE-APHIDIUS','buy')),false);
  await page.click(action('CARE-APHIDIUS','buy'));
  await page.waitForFunction(()=>window.__careSnapshot().requests.filter(item=>item.method==='POST').length===2);
  const poorReplay=await state(),poorPosts=poorReplay.requests.filter(item=>item.method==='POST');
  assert.equal(poorPosts[0].input.requestKey,poorPosts[1].input.requestKey);
  assert.equal(poorReplay.charges,1);assert.equal(poorReplay.wallet.cashCents,0);assert.equal(poorReplay.wallet.inventory[0].quantity,1);
  pass('receipt retry remains available after refresh shows the original purchase exhausted the budget');

  await openIntegrated('stocked');
  assert.match(await page.$eval('[data-care-reserve-toggle]',node=>node.innerText),/Produits de soin/);
  assert.equal(await page.evaluate(()=>Boolean(document.querySelector('[data-care-reserve-toggle]').compareDocumentPosition(document.querySelector('[data-care-basic-section]'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
  pass('contextual products are named clearly and placed before optional basic maintenance');
  await page.click(action('CARE-APHIDIUS','use'));
  await page.waitForFunction(()=>window.__careSnapshot().applications===1);await settled();
  assert.equal((await state()).charges,0);
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),true);
  assert.equal(await page.$eval('[data-care-reserve-toggle]',node=>node.disabled),false);
  pass('real culture panel receives the intervention and unlocks its reserve after the request');

  await openIntegrated('pending-purchase');
  await page.click(action('CARE-APHIDIUS','buy'));
  await page.waitForFunction(()=>typeof window.__releasePurchase==='function');
  assert.equal(await page.$eval('[data-care-toggle]',node=>node.disabled),true);
  assert.equal(await page.$eval('[data-care-reserve-toggle]',node=>node.disabled),true);
  assert.equal(await page.$$eval('[data-care-product-buy],[data-care-product-use]',nodes=>nodes.every(node=>node.disabled)),true);
  await page.$eval(action('CARE-APHIDIUS','buy'),node=>node.click());
  assert.equal((await state()).requests.filter(item=>item.method==='POST').length,1);
  await page.evaluate(()=>window.__releasePurchase());await settled();
  assert.equal((await state()).charges,1);
  assert.equal(await page.$eval('[data-care-reserve-toggle]',node=>node.disabled),false);
  pass('pending purchase locks parent disclosures and prevents a duplicate click until completion');

  await openIntegrated('apply-replay');
  await page.click(action('CARE-APHIDIUS','use'));
  await page.waitForFunction(()=>window.__careSnapshot().applications===1);await settled();
  assert.equal((await state()).wallet.inventory[0].quantity,0);
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),false);
  assert.match(await page.$eval(action('CARE-APHIDIUS','use'),node=>node.innerText),/Vérifier/);
  await page.click(action('CARE-APHIDIUS','use'));
  await page.waitForFunction(()=>window.__careSnapshot().requests.filter(item=>item.url.includes('/runs/')&&item.method==='POST').length===2);await settled();
  const applyReplay=await state(),applyPosts=applyReplay.requests.filter(item=>item.url.includes('/runs/')&&item.method==='POST');
  assert.equal(applyPosts[0].input.requestKey,applyPosts[1].input.requestKey);
  assert.equal(applyReplay.applications,1);assert.equal(applyReplay.wallet.inventory[0].quantity,0);assert.equal(applyReplay.charges,0);
  assert.equal(await disabled(action('CARE-APHIDIUS','use')),true);
  pass('real panel retries a lost intervention receipt with its original key even when no charge remains');

  await openIntegrated('apply-refresh-error');
  await page.click(action('CARE-APHIDIUS','use'));
  await page.waitForFunction(()=>window.__careSnapshot().applications===1);await settled('error');
  assert.equal(await page.$$eval('[data-care-product-buy],[data-care-product-use]',nodes=>nodes.every(node=>node.disabled)),true);
  assert.match(await page.$eval('main',node=>node.innerText),/Intervention enregistrée|Intervention engagée/);
  assert.match(await page.$eval(shop,node=>node.innerText),/Réserve indisponible/);
  assert.equal((await state()).wallet.inventory[0].quantity,1);assert.equal((await state()).applications,1);
  pass('successful application remains recorded when the subsequent reserve refresh fails');

  await visit('?catalogue&scenario=stocked');await settled();
  assert.equal(await page.$$eval('button',nodes=>nodes.some(node=>node.textContent.includes('Pour cette culture'))),false);
  assert.equal(await page.$$eval('[data-care-product-use]',nodes=>nodes.length),0);
  assert.equal(await page.$$eval('[data-care-product]',nodes=>nodes.length),4);
  pass('standalone shop keeps its two catalogue sections without culture-only actions');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blockedRequests,[]);pass('no browser errors or external requests');
 await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,phase,checks,metrics,errors,blockedRequests},null,2));console.log(`Care reserve ${phase}: ${checks.length} checks passed.`);
}catch(error){await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>undefined);await writeFile(resolve(output,'report.json'),JSON.stringify({passed:false,phase,checks,metrics,errors,blockedRequests,failure:error.stack},null,2));throw error}finally{await browser?.close();await server.close()}
