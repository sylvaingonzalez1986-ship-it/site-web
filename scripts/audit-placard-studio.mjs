/** Actual Photos et marque UI and operations. --preview keeps an isolated local demo open. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/studio');
const port = Number(process.env.KQ_STUDIO_PORT ?? 3400), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const modules = {
  entry: `import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KqBusinessPanel} from '/src/components/placard/KqBusinessPanel';
import {AppDialog} from '/src/components/ui/AppDialog';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
import {KQ_ONLINE_SITE_TIERS,estimateKqOnlineOffer} from '/src/lib/kanab-quest-online';
import * as studio from '/src/lib/kanab-quest-studio';
import {KQ_MERCH_PRODUCTS,estimateKqMerchOffer} from '/src/lib/kanab-quest-merch';
import {getKqShopDashboard} from '/src/lib/kanab-quest-shop-strategy';
import {formatKqCash} from '/src/lib/kanab-quest-equipment';
let state=createKqOperationsLesson('market');
const execute=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;return result.payload};
const command=(command,payload)=>execute({action:'online',command,payload});
const raw=getKqOperationsCommerce(state).rawLots[0];
execute({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
const source=state.trial.commerce.stocks[0],packets=Math.min(24,Math.floor(source.initialUnits/50));
command('buy-packaging',{code:'kraft-5',quantity:packets});
command('create-listing',{stockId:source.id,formatGrams:5,packagingCode:'kraft-5',packets,packetPriceCents:913});
const baseline=structuredClone(state);
const options=[['ready','Départ · atelier à développer'],['all','Atelier complet · comparer les styles'],['legacy','Ancien serveur · achats historiques'],['legacy-owned','Ancien serveur · photos et marque acquises'],['funds','Trésorerie insuffisante'],['orders','Commandes insuffisantes'],['confidence','Confiance insuffisante'],['followers','Audience insuffisante'],['site','Site de base'],['empty','Aucune annonce en rayon'],['busy','Action en cours'],['error','Refus simulé à la confirmation']];
function makeScenario(name){
 state=structuredClone(baseline);const c=state.trial.commerce,o=c.online;
 c.cashCents=10000000;c.clients=100;c.reputation=60;
 o.stats.orders=500;o.confidence=95;o.followers=400;o.upgrades.photography=false;o.upgrades.branding=false;o.site.maxLevel=6;
 const tier=KQ_ONLINE_SITE_TIERS.find(row=>row.code===(name==='site'?'basic':'flagship'));
 Object.assign(o.site,{tier:tier.code,active:true,paidUntil:new Date(state.trial.clock+240*3600000).toISOString()});
 Object.assign(c.business.shop,{name:'L’atelier des Chanvriers',tier:tier.code,active:true,monthlyCents:tier.monthlyCents,paidUntil:o.site.paidUntil});
 if(name==='funds')c.cashCents=1;
 if(name==='orders')o.stats.orders=0;
 if(name==='confidence')o.confidence=0;
 if(name==='followers')o.followers=0;
 if(name==='empty')o.listings=[];
 if(name.startsWith('legacy'))delete o.studio;
 if(name==='legacy-owned'){o.upgrades.photography=true;o.upgrades.branding=true}
 // Complete-workshop fixture is populated through the real purchase commands below.
 if(name==='all'){
  for(const track of ['photography','branding','editorial'])for(const level of [1,2,3])command('buy-studio-level',{track,level});
  for(const code of ['paper','textile','objects'])command('buy-merch-module',{code});
  for(const product of KQ_MERCH_PRODUCTS){command('buy-merch-stock',{code:product.code,quantity:10});command('update-merch',{code:product.code,priceCents:product.referencePriceCents,active:true})}
 }
 return state;
}
makeScenario('ready');
window.requests=[];window.fixture=()=>structuredClone(getKqOperationsCommerce(state));
window.catalog=()=>structuredClone({tracks:studio.KQ_STUDIO_TRACKS,levels:studio.KQ_STUDIO_LEVELS,styles:studio.KQ_STUDIO_STYLES});
window.levels=()=>studio.getKqStudioLevels(state.trial.commerce.online);
window.multiplier=()=>{const data=getKqOperationsCommerce(state),online=data.online,first=online.listings[0];if(!first)return null;const offer=estimateKqOnlineOffer({...first,quality:first.qualityScore,online,reputation:data.reputation,clients:data.clients,customerDemand:data.customerDemand});return studio.getKqStudioFlowerMultiplier(online,first.qualityScore,offer.priceRatio)};
window.dashboard=()=>structuredClone(getKqShopDashboard(getKqOperationsCommerce(state)));
window.merchOffer=(code,style)=>{const data=getKqOperationsCommerce(state),online=structuredClone(data.online);if(style)online.studio.style=style;const row=online.merch.inventory.find(item=>item.code===code);return estimateKqMerchOffer({online,code,priceCents:row.priceCents,reputation:data.reputation,clients:data.clients,activeProductCount:online.merch.inventory.filter(item=>item.active&&item.quantity>0).length})};
window.testRejected=body=>{const before=structuredClone(state);try{applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});return {rejected:false}}catch(error){return {rejected:true,error:error.message,unchanged:JSON.stringify(before)===JSON.stringify(state)}}};
const api=createKqTutorialApi(async()=>{throw new Error('This isolated component never requests a live API')});
function App(){
 const[,refresh]=useState(0),[scenario,setScenario]=useState('ready'),[pending,setPending]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const committing=useRef(false);
 useEffect(()=>{if(!${preview})return;let second;const first=requestAnimationFrame(()=>{[...document.querySelectorAll('[aria-label="Gérer ma boutique"] button')].find(node=>node.textContent.trim()==='Améliorations')?.click();second=requestAnimationFrame(()=>{[...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='Photos et marque')?.click()})});return()=>{cancelAnimationFrame(first);if(second)cancelAnimationFrame(second)}},[scenario]);
 window.setScenario=name=>{if(committing.current)throw new Error('Wait for the local command');makeScenario(name);window.requests=[];window.pending=null;setPending(null);setError('');setBusy(false);setScenario(name);refresh(value=>value+1)};
 window.localCommand=(name,payload)=>{if(committing.current)throw new Error('Wait for the local command');const result=command(name,payload);refresh(value=>value+1);return result};
 const ask=(title,description,body,cost)=>{if(busy)return;const next={title,description,body,cost:cost??0};window.pending=structuredClone(next);setError('');setPending(next)};
 const close=()=>{if(committing.current)return;window.pending=null;setPending(null);setError('')};
 const confirm=async()=>{if(!pending||committing.current)return;committing.current=true;setBusy(true);window.requests.push(structuredClone(pending.body));try{await new Promise(resolve=>setTimeout(resolve,180));if(scenario==='error')throw new Error('Opération refusée dans cette simulation. Aucun débit.');execute(pending.body);window.pending=null;setPending(null);refresh(value=>value+1)}catch(failure){setError(failure.message)}finally{committing.current=false;setBusy(false)}};
 const data=getKqOperationsCommerce(state);
 return <KqTutorialApiProvider api={api}><aside className="fixture-tools" aria-label="Outils de démonstration"><strong>Démo locale · studio photo et identité de marque</strong><p>Données fictives en mémoire. Développe tes trois ateliers et compare les directions artistiques sur tes produits. Aucune partie ni aucun compte n’est modifié.</p><label>Scénario <select data-fixture-scenario value={scenario} onChange={event=>window.setScenario(event.target.value)} disabled={busy}>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={()=>window.setScenario(scenario)} disabled={busy}>Réinitialiser</button></aside><main className="audit-surface"><KqBusinessPanel key={scenario} expanded showAccounting={false} data={data} busy={busy||scenario==='busy'} now={state.trial.clock} onAsk={ask} onOpenShop={()=>{window.navigation='equipment'}} onPrepareStock={()=>{window.navigation='prepare'}} onViewSales={()=>{window.navigation='sales'}}/></main><AppDialog open={Boolean(pending)} onClose={close} title={pending?.title} closeOnBackdrop={!busy} footer={<><button type="button" onClick={close} disabled={busy}>Annuler</button><button type="button" data-confirm-studio onClick={confirm} disabled={busy}>{busy?'Validation…':'Confirmer'}</button></>}><p>{pending?.description}</p><strong data-confirm-cost>{formatKqCash(pending?.cost??0)}</strong>{error?<p role="alert">{error}</p>:null}</AppDialog></KqTutorialApiProvider>
}
createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const previousHarness=await readFile(resolve(root,'scripts/audit-placard-online-progression.mjs'),'utf8');
const html=previousHarness.match(/const html = `([\s\S]*?)`;\r?\nconst server/)[1].replace('<head>','<head><link rel="icon" href="data:,">');
const server=await createServer({
 root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),
 resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},
 optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},
 plugins:[{name:'isolated-studio',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},configureServer(vite){vite.middlewares.use((request,response,next)=>{if(request.url?.startsWith('/api/')){response.statusCode=403;response.end('Real API disabled');return}if(request.url!=='/')return next();response.setHeader('Content-Type','text/html');response.end(html)})}}],
 server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null},
});
const checks=[],errors=[],forbidden=[],measures=[],failedResponses=[];
let browser,page;
const workshop='[data-brand-studio]';
await mkdir(output,{recursive:true});await server.listen();
if(preview){
 console.log(`Isolated studio demo: ${origin} (PID ${process.pid}). No remote account or persistent data.`);
 await new Promise(resolveStop=>{const stop=()=>{void server.close().then(resolveStop)};process.once('SIGINT',stop);process.once('SIGTERM',stop)});
}else try{
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)failedResponses.push({url:response.url(),status:response.status()})});
 await page.setRequestInterception(true);page.on('request',request=>{const url=request.url();if((url.startsWith(origin+'/')&&!url.includes('/api/'))||url.startsWith('data:'))void request.continue();else{forbidden.push(url);void request.abort()}});
 await page.setViewport({width:1440,height:1000});await page.goto(origin,{waitUntil:'networkidle0',timeout:60000});await page.evaluate(()=>document.fonts.ready);
 const click=async(text,scope='body')=>{const handle=await page.waitForFunction((text,scope)=>[...document.querySelectorAll(scope+' button')].find(node=>node.textContent.trim()===text&&!node.disabled&&node.getBoundingClientRect().height>0),{},text,scope);await handle.asElement().click();await handle.dispose()};
 const show=async()=>{await click('Améliorations','[aria-label="Gérer ma boutique"]');await click('Photos et marque');await page.waitForSelector(workshop,{visible:true})};
 const reset=async name=>{await page.evaluate(name=>window.setScenario(name),name);await page.waitForFunction(name=>document.querySelector('[data-fixture-scenario]').value===name,{},name);await show()};
 const snapshot=()=>page.evaluate(()=>window.fixture());
 const choose=async(track,level)=>{await page.click('[data-studio-track="'+track+'"]');if(level)await page.click('[data-studio-level="'+level+'"]');};
 const overflow=async label=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': no horizontal overflow');assert.doesNotMatch(await page.$eval(workshop,node=>node.innerText),/NaN|undefined|Infinity/)};
 const confirm=async()=>{await page.waitForSelector('dialog[open][data-app-dialog]');await page.click('[data-confirm-studio]',{clickCount:2,delay:20});await page.waitForFunction(()=>!document.querySelector('dialog[open]'))};
 await show();const catalog=await page.evaluate(()=>window.catalog());
 assert.deepEqual(catalog.tracks.map(row=>row.code),['photography','branding','editorial']);
 assert.equal(catalog.levels.length,9);
 const initial=await snapshot();
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:1000});
  for(const item of catalog.levels){await choose(item.track,item.level);await overflow(width+'/'+item.track+'/'+item.level)}
  for(const style of catalog.styles){await page.click('[data-studio-style="'+style.code+'"]');await overflow(width+'/'+style.code)}
  assert.deepEqual(await snapshot(),initial,'Inspecting levels and styles must not mutate the game');
  await choose('photography',2);await page.click('[data-studio-style="craft"]');
  measures.push(await page.$eval(workshop,node=>({width:innerWidth,height:Math.round(node.getBoundingClientRect().height)})));
  await page.screenshot({path:resolve(output,'studio-'+width+'.png'),fullPage:true});await(await page.$(workshop)).screenshot({path:resolve(output,'workshop-'+width+'.png')});
 }
 checks.push('nine levels and three styles inspected at 320, 390 and 1440 px without overflow or game mutation');
 await page.focus('[data-studio-track="editorial"]');await page.keyboard.press('Enter');
 assert.equal(await page.$eval('[data-studio-track="editorial"]',node=>node.getAttribute('aria-pressed')),'true');
 await page.focus('[data-studio-level="2"]');await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-studio-level')),'2');
 await page.focus('[data-studio-style="signature"]');await page.keyboard.press('Enter');
 assert.equal(await page.$eval('[data-studio-style="signature"]',node=>node.getAttribute('aria-pressed')),'true');
 await page.focus('[data-studio-track="photography"]');await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-studio-track')),'editorial');
 await page.focus('[data-studio-level="1"]');await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-studio-level')),'2');
 checks.push('track, level and style controls work by keyboard with retained focus');

 for(const scenario of ['funds','busy']){
  await reset(scenario);await choose('photography',1);const before=await snapshot();
  assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled),true);assert.deepEqual(await snapshot(),before);await overflow(scenario);
  checks.push(scenario+' blocks purchases without a debit');
 }
 await reset('ready');await choose('photography',3);
 assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled),true);
 for(const payload of [{track:'photography',level:3},{track:'branding',level:2},{track:'editorial',level:1},{track:'unknown',level:1}]){
  const result=await page.evaluate(payload=>window.testRejected({action:'online',command:'buy-studio-level',payload}),payload);assert.equal(result.rejected,true);assert.equal(result.unchanged,true);
 }
 checks.push('level skipping, cross-track prerequisites and unknown tracks fail in both the UI and local engine');

 await reset('ready');await choose('photography',1);const beforeCancel=await snapshot();
 await page.click('[data-studio-buy]');await page.waitForSelector('dialog[open]');
 const pending=await page.evaluate(()=>window.pending);assert.equal(pending.cost,30000);assert.deepEqual(await snapshot(),beforeCancel);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.deepEqual(await snapshot(),beforeCancel);
 checks.push('purchase details show the exact amount and Escape cancels without changing the game');

 for(const target of catalog.levels){
  await choose(target.track,target.level);const before=await snapshot(),beforeDashboard=await page.evaluate(()=>window.dashboard()),beforeMultiplier=await page.evaluate(()=>window.multiplier());
  assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled),false,target.track+'/'+target.level+' is available');
  await page.click('[data-studio-buy]');await page.waitForSelector('dialog[open]');const pending=await page.evaluate(()=>window.pending);
  assert.equal(pending.cost,target.costCents);assert.equal(pending.body.action,'online');
  assert.ok(pending.body.command==='buy-studio-level'||(target.level===1&&pending.body.command==='buy-upgrade'));
  const count=await page.evaluate(()=>window.requests.length);await confirm();const after=await snapshot();
  assert.equal((await page.evaluate(()=>window.levels()))[target.track],target.level);
  assert.equal(after.cashCents,before.cashCents-target.costCents);assert.equal(await page.evaluate(()=>window.requests.length),count+1);
  assert.deepEqual(after.online.stats,before.online.stats);assert.deepEqual(after.online.listings,before.online.listings);assert.deepEqual(after.online.recentSales,before.online.recentSales);
  assert.equal(after.online.followers,before.online.followers);assert.equal(after.online.confidence,before.online.confidence);
  const dashboard=await page.evaluate(()=>window.dashboard()),multiplier=await page.evaluate(()=>window.multiplier());
  assert.ok(beforeDashboard.ordersPerDay>0,'A real stocked offer permits effect comparison');
  assert.ok(Math.abs(dashboard.ordersPerDay/beforeDashboard.ordersPerDay-multiplier/beforeMultiplier)<1e-9,'The real flower forecast follows the configured multiplier');
  assert.equal(dashboard.visitorsPerDay,beforeDashboard.visitorsPerDay,'Studio upgrades do not invent traffic');
  assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled).catch(()=>true),true,'Acquired level cannot be purchased again');
  checks.push(target.track+'/'+target.level+': exact one-time cost, real forecast effect, no invented audience or sales');
 }
 assert.equal((await snapshot()).online.upgrades.photography,true);assert.equal((await snapshot()).online.upgrades.branding,true);
 const beforeStyles=await snapshot();const styleForecasts=[];
 for(const target of ['clear','signature','craft']){
  await page.click('[data-studio-style="'+target+'"]');assert.equal(await page.$eval('[data-studio-apply-style]',node=>node.disabled),false);
  await page.click('[data-studio-apply-style]');await page.waitForSelector('dialog[open]');const pending=await page.evaluate(()=>window.pending);
  assert.deepEqual(pending.body,{action:'online',command:'choose-studio-style',payload:{style:target}});assert.equal(pending.cost,0);await confirm();
  const after=await snapshot();assert.equal(after.online.studio.style,target);assert.equal(after.cashCents,beforeStyles.cashCents);
  assert.deepEqual(after.online.listings,beforeStyles.online.listings);assert.deepEqual(after.online.stats,beforeStyles.online.stats);
  assert.deepEqual(after.online.recentSales,beforeStyles.online.recentSales);styleForecasts.push((await page.evaluate(()=>window.dashboard())).ordersPerDay);
  assert.equal(await page.$eval('[data-studio-apply-style]',node=>node.disabled).catch(()=>true),true);
 }
 assert.ok(new Set(styleForecasts).size>1,'Editorial style changes real demand when the offer match changes');
 checks.push('three artistic directions apply through confirmation for free and change actual forecast fit without altering products or sales');
 await page.screenshot({path:resolve(output,'studio-fully-upgraded.png'),fullPage:true});

 await reset('legacy');await choose('photography',1);assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled),false);
 const beforeLegacy=await snapshot();await page.click('[data-studio-buy]');await page.waitForSelector('dialog[open]');
 assert.deepEqual(await page.evaluate(()=>window.pending.body),{action:'online',command:'buy-upgrade',payload:{code:'photography'}});await confirm();
 assert.equal((await snapshot()).cashCents,beforeLegacy.cashCents-30000);assert.equal((await page.evaluate(()=>window.levels())).photography,1);
 await choose('photography',2);assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled),true);
 await choose('editorial',1);assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled),true);
 checks.push('an old server retains the original photo purchase while unsupported advanced actions remain unavailable');
 await reset('legacy-owned');assert.deepEqual(await page.evaluate(()=>window.levels()),{photography:1,branding:1,editorial:0});
 for(const track of ['photography','branding']){await choose(track,1);assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled).catch(()=>true),true);await choose(track,2);assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled),true)}
 await page.click('[data-studio-style="signature"]');assert.equal(await page.$eval('[data-studio-apply-style]',node=>node.disabled),true);
 checks.push('historical photo and brand purchases remain acquired and cannot be charged again');

 for(const scenario of ['orders','confidence','site']){
  await reset(scenario);await page.evaluate(()=>window.localCommand('buy-studio-level',{track:'photography',level:1}));await choose('photography',2);
  const before=await snapshot();assert.equal(await page.$eval('[data-studio-buy]',node=>node.disabled),true);
  const result=await page.evaluate(()=>window.testRejected({action:'online',command:'buy-studio-level',payload:{track:'photography',level:2}}));assert.equal(result.rejected,true);assert.equal(result.unchanged,true);assert.deepEqual(await snapshot(),before);
  checks.push(scenario+' requirement blocks the next upgrade independently');
 }
 await reset('error');await choose('photography',1);const beforeError=await snapshot();await page.click('[data-studio-buy]');await page.waitForSelector('dialog[open]');await page.click('[data-confirm-studio]');await page.waitForSelector('dialog[open] [role="alert"]');assert.deepEqual(await snapshot(),beforeError);await click('Annuler','dialog[open]');
 checks.push('a server refusal keeps the confirmation error visible and preserves funds and ownership');

 await reset('empty');await page.setViewport({width:320,height:1000});await overflow('empty');
 assert.doesNotMatch(await page.$eval('[data-studio-preview]',node=>node.innerText),/0\s*%|0[,.]0\s*commande/i,'Missing offers should not be displayed as a measured zero');
 await page.screenshot({path:resolve(output,'studio-empty-320.png'),fullPage:true});checks.push('empty inventories show a presentation preview without inventing measured results');
 await reset('all');assert.equal(await page.$$eval('[data-studio-style-comparison] select option',nodes=>nodes.length),7);
 for(const style of ['clear','craft','signature']){
  await page.click('[data-studio-style="'+style+'"]');
  for(const code of ['stickers','mug','tshirt']){
   await page.select('[data-studio-style-comparison] select','merch-'+code);
   const actual=await page.$eval('[data-studio-style-comparison]',node=>({before:Number(node.dataset.before),after:Number(node.dataset.after)}));
   const expected=await page.evaluate((code,style)=>({before:window.merchOffer(code).unitsPerDay,after:window.merchOffer(code,style).unitsPerDay}),code,style);
   assert.ok(Math.abs(actual.before-expected.before)<1e-9);assert.ok(Math.abs(actual.after-expected.after)<1e-9);
   assert.match(await page.$eval('[data-studio-style-comparison]',node=>node.innerText),/articles \/ jour/);
  }
 }
 await overflow('complete workshop with six merch references');await page.screenshot({path:resolve(output,'studio-merch-320.png'),fullPage:true});
 checks.push('the complete workshop compares all six stocked merch items with real per-item cadence and correct style effects');
 await choose('branding',3);await click('Décliner la marque en merch',workshop);await page.waitForSelector('[data-merch-workshop]',{visible:true});assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Merch & collections');
 await reset('site');await choose('photography',2);await click('Développer le site',workshop);await page.waitForSelector('[data-online-progression]',{visible:true});assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Le site internet');
 await reset('ready');await choose('editorial',1);await click('Voir','[data-studio-investment]');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-studio-track')),'photography');
 checks.push('prerequisite and cross-panel links move keyboard focus onto the visible destination');
 await reset('ready');await click('Merch & collections');await page.waitForSelector('[data-merch-workshop]',{visible:true});await click('Le site internet');await page.waitForSelector('[data-online-progression]',{visible:true});await click('Photos et marque');await page.waitForSelector(workshop,{visible:true});
 checks.push('merch and the six-level website remain accessible beside Photos et marque');
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluate(()=>{for(const image of document.images)image.loading='eager'});await page.waitForFunction(()=>[...document.images].every(image=>image.complete));
 assert.deepEqual(await page.evaluate(()=>[...document.images].filter(image=>!image.naturalWidth).map(image=>image.src)),[]);assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);assert.deepEqual(failedResponses,[]);
 checks.push('all artwork loads without browser errors or network requests to remote services');
 await writeFile(resolve(output,'report.json'),JSON.stringify({success:true,checks,measures,errors,forbidden,failedResponses},null,2));console.log(JSON.stringify({success:true,checks:checks.length,measures,output},null,2));
}catch(error){
 if(page)await Promise.race([page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{}),new Promise(done=>setTimeout(done,3000))]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({success:false,checks,measures,errors,forbidden,failedResponses,failure:String(error)},null,2));throw error;
}finally{if(browser)await browser.close();await server.close()}
