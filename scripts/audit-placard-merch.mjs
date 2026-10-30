/** Actual boutique components and local operations. --preview keeps an isolated demo open. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/merch');
const port = Number(process.env.KQ_MERCH_PORT ?? 3398), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const modules = {
  entry: `import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KqBusinessPanel} from '/src/components/placard/KqBusinessPanel';
import {AppDialog} from '/src/components/ui/AppDialog';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
import {KQ_ONLINE_SITE_TIERS} from '/src/lib/kanab-quest-online';
import {KQ_MERCH_PRODUCTS,KQ_MERCH_MODULES,getKqMerchSlots} from '/src/lib/kanab-quest-merch';
import {formatKqCash} from '/src/lib/kanab-quest-equipment';
let state=createKqOperationsLesson('market');
const execute=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;return result.payload};
const command=(command,payload)=>execute({action:'online',command,payload});
const baseline=structuredClone(state);
const options=[['ready','Départ · atelier papeterie à débloquer'],['all','Maison de référence · tous les ateliers ouverts'],['legacy','Ancien serveur · merch indisponible'],['funds','Trésorerie insuffisante'],['branding','Identité de marque manquante'],['locked','Textile et objets verrouillés'],['capacity','Trois références déjà en rayon'],['stock-cap','Stock maximal atteint'],['closed','Site suspendu'],['busy','Action en cours'],['error','Refus simulé à la confirmation']];
function makeScenario(name){
 state=structuredClone(baseline);const c=state.trial.commerce,o=c.online;
 c.cashCents=10000000;c.clients=100;c.reputation=60;
 o.stats.orders=500;o.confidence=95;o.followers=400;o.upgrades.photography=true;o.upgrades.branding=true;o.site.maxLevel=6;
 const tier=KQ_ONLINE_SITE_TIERS.find(row=>row.code===(['all','closed','stock-cap'].includes(name)?'flagship':name==='capacity'?'pro':'improved'));
 Object.assign(o.site,{tier:tier.code,active:true,paidUntil:new Date(state.trial.clock+240*3600000).toISOString()});
 Object.assign(c.business.shop,{name:'L’atelier des Chanvriers',tier:tier.code,active:true,monthlyCents:tier.monthlyCents,paidUntil:o.site.paidUntil});
 if(['all','capacity','stock-cap','closed'].includes(name)){
  command('buy-merch-module',{code:'paper'});
  if(['all','stock-cap','closed','capacity'].includes(name))command('buy-merch-module',{code:'textile'});
  if(['all','stock-cap','closed'].includes(name))command('buy-merch-module',{code:'objects'});
 }
 if(name==='capacity'){for(const code of ['stickers','poster','tote']){command('buy-merch-stock',{code,quantity:10});const item=state.trial.commerce.online.merch.inventory.find(row=>row.code===code);command('update-merch',{code,priceCents:item.priceCents,active:true})}command('buy-merch-stock',{code:'tshirt',quantity:10})}
 if(name==='stock-cap')command('buy-merch-stock',{code:'stickers',quantity:500});
 if(name==='closed'){command('buy-merch-stock',{code:'stickers',quantity:50});const item=state.trial.commerce.online.merch.inventory.find(row=>row.code==='stickers');command('update-merch',{code:'stickers',priceCents:item.priceCents,active:true});state.trial.commerce.online.site.active=false;state.trial.commerce.business.shop.active=false}
 if(name==='funds')state.trial.commerce.cashCents=1;
 if(name==='branding')state.trial.commerce.online.upgrades.branding=false;
 if(name==='legacy')delete state.trial.commerce.online.merch;
 return state;
}
makeScenario('ready');
window.requests=[];window.fixture=()=>structuredClone(getKqOperationsCommerce(state));
window.catalog=()=>structuredClone({products:KQ_MERCH_PRODUCTS,modules:KQ_MERCH_MODULES});
window.slots=()=>getKqMerchSlots(state.trial.commerce.online);
window.testRejected=body=>{const before=structuredClone(state);try{applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});return {rejected:false}}catch(error){return {rejected:true,error:error.message,unchanged:JSON.stringify(before)===JSON.stringify(state)}}};
const api=createKqTutorialApi(async()=>{throw new Error('This isolated component never requests a live API')});
function App(){
 const[,refresh]=useState(0),[scenario,setScenario]=useState('ready'),[pending,setPending]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const committing=useRef(false);
 useEffect(()=>{if(!${preview})return;const first=requestAnimationFrame(()=>document.querySelector('[data-shop-view="merch"]')?.click());return()=>cancelAnimationFrame(first)},[scenario]);
 window.setScenario=name=>{if(committing.current)throw new Error('Wait for the local command');makeScenario(name);window.requests=[];window.pending=null;setPending(null);setError('');setBusy(false);setScenario(name);refresh(value=>value+1)};
 window.localCommand=(name,payload)=>{if(committing.current)throw new Error('Wait for the local command');const result=command(name,payload);refresh(value=>value+1);return result};
 const ask=(title,description,body,cost)=>{if(busy)return;const next={title,description,body,cost:cost??0};window.pending=structuredClone(next);setError('');setPending(next)};
 const close=()=>{if(committing.current)return;window.pending=null;setPending(null);setError('')};
 const confirm=async()=>{if(!pending||committing.current)return;committing.current=true;setBusy(true);window.requests.push(structuredClone(pending.body));try{await new Promise(resolve=>setTimeout(resolve,180));if(scenario==='error')throw new Error('Opération refusée dans cette simulation. Aucun débit.');execute(pending.body);window.pending=null;setPending(null);refresh(value=>value+1)}catch(failure){setError(failure.message)}finally{committing.current=false;setBusy(false)}};
 const data=getKqOperationsCommerce(state);
 return <KqTutorialApiProvider api={api}><aside className="fixture-tools" aria-label="Outils de démonstration"><strong>Démo locale · merch et collections</strong><p>Données fictives en mémoire. Achète un atelier, prépare ton stock, règle tes prix et choisis les produits en rayon. Aucune partie ni aucun compte n’est modifié.</p><label>Scénario <select data-fixture-scenario value={scenario} onChange={event=>window.setScenario(event.target.value)} disabled={busy}>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={()=>window.setScenario(scenario)} disabled={busy}>Réinitialiser</button><button type="button" data-advance-time disabled={busy} onClick={()=>window.localCommand('advance-online-time',{hours:24})}>Simuler 24 h de ventes</button></aside><main className="audit-surface"><KqBusinessPanel key={scenario} expanded showAccounting={false} data={data} busy={busy||scenario==='busy'} now={state.trial.clock} onAsk={ask} onOpenShop={()=>{window.navigation='equipment'}} onPrepareStock={()=>{window.navigation='prepare'}} onViewSales={()=>{window.navigation='sales'}}/></main><AppDialog open={Boolean(pending)} onClose={close} title={pending?.title} closeOnBackdrop={!busy} footer={<><button type="button" onClick={close} disabled={busy}>Annuler</button><button type="button" data-confirm-merch onClick={confirm} disabled={busy}>{busy?'Validation…':'Confirmer'}</button></>}><p>{pending?.description}</p><strong data-confirm-cost>{formatKqCash(pending?.cost??0)}</strong>{error?<p role="alert">{error}</p>:null}</AppDialog></KqTutorialApiProvider>
}
createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
// Match the previous real-component harness, including its locally loaded fonts.
const previousHarness = await readFile(resolve(root, 'scripts/audit-placard-online-progression.mjs'), 'utf8');
const html = previousHarness.match(/const html = `([\s\S]*?)`;\r?\nconst server/)[1].replace('<head>','<head><link rel="icon" href="data:,">');
const server = await createServer({
 root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),
 resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},
 optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},
 plugins:[{name:'isolated-merch',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},configureServer(vite){vite.middlewares.use((request,response,next)=>{if(request.url?.startsWith('/api/')){response.statusCode=403;response.end('Real API disabled');return}if(request.url!=='/')return next();response.setHeader('Content-Type','text/html');response.end(html)})}}],
 server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null},
});
const checks=[],errors=[],forbidden=[],measures=[],failedResponses=[];
let browser,page;
const workshop='[data-merch-workshop]';
await mkdir(output,{recursive:true});await server.listen();
if(preview){
 console.log(`Isolated merch demo: ${origin} (PID ${process.pid}). No remote account or persistent data.`);
 await new Promise(resolveStop=>{const stop=()=>{void server.close().then(resolveStop)};process.once('SIGINT',stop);process.once('SIGTERM',stop)});
}else try{
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)failedResponses.push({url:response.url(),status:response.status()})});
 await page.setRequestInterception(true);page.on('request',request=>{const url=request.url();if((url.startsWith(origin+'/')&&!url.includes('/api/'))||url.startsWith('data:'))void request.continue();else{forbidden.push(url);void request.abort()}});
 await page.setViewport({width:1440,height:1000});await page.goto(origin,{waitUntil:'networkidle0',timeout:60000});await page.evaluate(()=>document.fonts.ready);
 const click=async(text,scope='body')=>{const handle=await page.waitForFunction((text,scope)=>[...document.querySelectorAll(scope+' button')].find(node=>node.textContent.trim()===text&&!node.disabled&&node.getBoundingClientRect().height>0),{},text,scope);await handle.asElement().click();await handle.dispose()};
 const show=async()=>{await page.click('[data-shop-view="merch"]');await page.waitForSelector(workshop,{visible:true})};
 const reset=async name=>{await page.evaluate(name=>window.setScenario(name),name);await page.waitForFunction(name=>document.querySelector('[data-fixture-scenario]').value===name,{},name);await show()};
 const snapshot=()=>page.evaluate(()=>window.fixture());
 const reveal=async selector=>{await page.$eval(selector,node=>{for(let parent=node.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true})};
 const choose=async code=>{const selector='[data-merch-product="'+code+'"]';await reveal(selector);await page.click(selector);await page.waitForFunction(code=>document.querySelector('[data-merch-product="'+code+'"]')?.getAttribute('aria-pressed')==='true',{},code)};
 const overflow=async label=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': no horizontal overflow');assert.doesNotMatch(await page.$eval(workshop,node=>node.innerText),/NaN|undefined|Infinity/)};
 const confirm=async()=>{await page.waitForSelector('dialog[open][data-app-dialog]');await page.click('[data-confirm-merch]',{clickCount:2,delay:20});await page.waitForFunction(()=>!document.querySelector('dialog[open]'))};
 const field=async(selector,value)=>{await reveal(selector);await page.$eval(selector,(node,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))},String(value))};
 await show();const catalog=await page.evaluate(()=>window.catalog());
 assert.deepEqual(catalog.products.map(row=>row.code),['stickers','poster','tote','tshirt','mug','cap']);
 assert.equal(await page.$$eval('[data-merch-product]',nodes=>nodes.length),6);
 const initial=await snapshot();
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:1000});for(const item of catalog.products){await choose(item.code);await overflow(width+'/'+item.code)}
  assert.deepEqual(await snapshot(),initial,'Inspecting products must be free');await choose('stickers');
  measures.push(await page.$eval(workshop,node=>({width:innerWidth,height:Math.round(node.getBoundingClientRect().height)})));
  await page.screenshot({path:resolve(output,'merch-'+width+'.png'),fullPage:true});await(await page.$(workshop)).screenshot({path:resolve(output,'workshop-'+width+'.png')});
 }
 checks.push('all six products inspected at 320, 390 and 1440 px without overflow or state mutation');
 await page.focus('[data-merch-product="mug"]');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-merch-product="mug"]').getAttribute('aria-pressed')==='true');
 assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-merch-product')),'mug');checks.push('product selection works by keyboard');

 for(const scenario of ['legacy','funds','branding','busy']){
  await reset(scenario);const before=await snapshot();assert.equal(await page.$eval('[data-merch-buy-module="paper"]',node=>node.disabled),true);assert.deepEqual(await snapshot(),before);await overflow(scenario);checks.push(scenario+' prevents module purchase with no debit');
 }
 await reset('locked');await choose('tote');assert.equal(await page.$eval('[data-merch-buy-module="textile"]',node=>node.disabled),true);await choose('mug');assert.equal(await page.$eval('[data-merch-buy-module="objects"]',node=>node.disabled),true);checks.push('higher workshops remain locked at the second site level');

 await reset('ready');const beforeModule=await snapshot();await page.click('[data-merch-buy-module="paper"]');await page.waitForSelector('dialog[open]');
 const modulePending=await page.evaluate(()=>window.pending);assert.deepEqual(modulePending.body,{action:'online',command:'buy-merch-module',payload:{code:'paper'}});assert.ok(modulePending.cost>0);assert.deepEqual(await snapshot(),beforeModule);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.deepEqual(await snapshot(),beforeModule);checks.push('module confirmation names the exact operation and cancellation preserves funds');
 await page.click('[data-merch-buy-module="paper"]');await confirm();let after=await snapshot();assert.ok(after.online.merch.modules.includes('paper'));assert.equal(after.cashCents,beforeModule.cashCents-modulePending.cost);assert.equal(await page.evaluate(()=>window.requests.length),1);checks.push('paper workshop purchase debits exactly once despite a double confirmation click');

 await choose('stickers');await page.select('[data-merch-quantity]','10');const beforeStock=await snapshot();await page.click('[data-merch-buy-stock]');await page.waitForSelector('dialog[open]');const stockPending=await page.evaluate(()=>window.pending);
 assert.deepEqual(stockPending.body,{action:'online',command:'buy-merch-stock',payload:{code:'stickers',quantity:10}});await confirm();after=await snapshot();let item=after.online.merch.inventory.find(row=>row.code==='stickers');assert.equal(item.quantity,10);assert.equal(item.active,false);assert.equal(after.cashCents,beforeStock.cashCents-stockPending.cost);checks.push('buying a batch creates actual inactive inventory and debits only its production cost');
 const salePrice=item.priceCents;await field('[data-merch-price]',(salePrice/100).toFixed(2));await page.click('[data-merch-active]');await page.click('[data-merch-save]');await page.waitForSelector('dialog[open]');const savePending=await page.evaluate(()=>window.pending);assert.deepEqual(savePending.body,{action:'online',command:'update-merch',payload:{code:'stickers',priceCents:salePrice,active:true}});assert.equal(savePending.cost,0);await confirm();after=await snapshot();assert.equal(after.online.merch.inventory.find(row=>row.code==='stickers').active,true);checks.push('price and shelf visibility save through the real confirmation without buying more stock');
 for(const value of ['0','-1','1000.01','abc']){await field('[data-merch-price]',value);assert.equal(await page.$eval('[data-merch-save]',node=>node.disabled),true,'Invalid price '+value+' must be rejected')}
 await field('[data-merch-price]',((salePrice+50)/100).toFixed(2).replace('.',','));await page.click('[data-merch-save]');await page.waitForSelector('dialog[open]');assert.equal(await page.evaluate(()=>window.pending.body.payload.priceCents),salePrice+50);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await field('[data-merch-price]',(salePrice/100).toFixed(2));checks.push('invalid prices are blocked and a French decimal comma produces the exact cents');
 const beforeSales=await snapshot();await page.click('[data-advance-time]');await page.waitForFunction(before=>window.fixture().online.serverNow!==before,{},beforeSales.online.serverNow);after=await snapshot();assert.ok(after.online.merch.stats.unitsSold>beforeSales.online.merch.stats.unitsSold);assert.ok(after.online.merch.stats.revenueCents>beforeSales.online.merch.stats.revenueCents);assert.ok(after.online.merch.inventory.find(row=>row.code==='stickers').quantity<10);assert.equal(after.online.stats.orders,beforeSales.online.stats.orders,'Merch sales do not fake flower order progression');checks.push('elapsed local time sells stocked merch, produces accounted revenue and does not inflate flower order progression');
 await page.screenshot({path:resolve(output,'merch-after-sales.png'),fullPage:true});

 await reset('closed');const beforeClosed=await snapshot();await page.click('[data-advance-time]');await page.waitForFunction(before=>window.fixture().online.serverNow!==before,{},beforeClosed.online.serverNow);after=await snapshot();assert.deepEqual(after.online.merch.stats,beforeClosed.online.merch.stats);assert.deepEqual(after.online.merch.inventory,beforeClosed.online.merch.inventory);checks.push('a suspended site sells no merchandise while time advances');
 await reset('all');await page.evaluate(()=>{window.localCommand('buy-merch-stock',{code:'stickers',quantity:100});window.localCommand('update-merch',{code:'stickers',priceCents:400,active:true})});await choose('stickers');await page.waitForSelector('[data-merch-active]:not([disabled])');await field('[data-merch-price]','6,50');await page.focus('[data-merch-price]');await page.evaluate(()=>window.localCommand('advance-online-time',{hours:24}));await page.waitForFunction(()=>window.fixture().online.merch.inventory.find(row=>row.code==='stickers').quantity<100);assert.ok((await snapshot()).online.merch.inventory.find(row=>row.code==='stickers').quantity>0);assert.equal(await page.$eval('[data-merch-price]',node=>node.value),'6,50');assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-merch-price')),true);assert.equal((await snapshot()).online.merch.inventory.find(row=>row.code==='stickers').priceCents,400);checks.push('sales refresh remaining stock without discarding an unsaved price or moving keyboard focus');
 await reset('stock-cap');await choose('stickers');assert.equal(await page.$eval('[data-merch-buy-stock]',node=>node.disabled),true);const capResult=await page.evaluate(()=>window.testRejected({action:'online',command:'buy-merch-stock',payload:{code:'stickers',quantity:10}}));assert.equal(capResult.rejected,true);assert.equal(capResult.unchanged,true);checks.push('the 500-unit inventory cap blocks both the UI and direct local commands');

 await reset('capacity');await choose('tshirt');const beforeCapacity=await snapshot();assert.equal(await page.evaluate(()=>window.slots()),3);const toggleDisabled=await page.$eval('[data-merch-active]',node=>node.disabled);if(!toggleDisabled){await page.click('[data-merch-active]');assert.equal(await page.$eval('[data-merch-save]',node=>node.disabled),true)}const slotsResult=await page.evaluate(()=>window.testRejected({action:'online',command:'update-merch',payload:{code:'tshirt',priceCents:2800,active:true}}));assert.equal(slotsResult.rejected,true);assert.equal(slotsResult.unchanged,true);assert.deepEqual(await snapshot(),beforeCapacity);checks.push('three active references occupy the professional shelf and a fourth cannot bypass capacity');

 await reset('error');const beforeError=await snapshot();await page.click('[data-merch-buy-module="paper"]');await page.waitForSelector('dialog[open]');await page.click('[data-confirm-merch]');await page.waitForSelector('dialog[open] [role="alert"]');assert.deepEqual(await snapshot(),beforeError);await click('Annuler','dialog[open]');checks.push('rejected module purchases show the error without funds or inventory changes');
 await reset('ready');for(const body of [{command:'buy-merch-stock',payload:{code:'stickers',quantity:10}},{command:'buy-merch-module',payload:{code:'textile'}},{command:'update-merch',payload:{code:'stickers',priceCents:0,active:true}},{command:'buy-merch-module',payload:{code:'unknown'}}]){const result=await page.evaluate(body=>window.testRejected({action:'online',...body}),body);assert.equal(result.rejected,true);assert.equal(result.unchanged,true)}checks.push('direct local commands cannot bypass workshop locks, input validity or ownership');
 await reset('all');await page.setViewport({width:320,height:1000});await choose('tshirt');await overflow('all workshops at 320px');await page.screenshot({path:resolve(output,'merch-unlocked-320.png'),fullPage:true});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluate(()=>{for(const image of document.images)image.loading='eager'});await page.waitForFunction(()=>[...document.images].every(image=>image.complete));assert.deepEqual(await page.evaluate(()=>[...document.images].filter(image=>!image.naturalWidth).map(image=>image.src)),[]);assert.ok(await page.evaluate(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('/placard/merch/collection-sprites-v1.png'))));assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);assert.deepEqual(failedResponses,[]);checks.push('all illustration assets load without browser errors or requests to remote services');
 await writeFile(resolve(output,'report.json'),JSON.stringify({success:true,checks,measures,errors,forbidden,failedResponses},null,2));console.log(JSON.stringify({success:true,checks:checks.length,measures,output},null,2));
}catch(error){
 if(page)await Promise.race([page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{}),new Promise(done=>setTimeout(done,3000))]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({success:false,checks,measures,errors,forbidden,failedResponses,failure:String(error)},null,2));throw error;
}finally{
 const closeOwned=async(close,fallback)=>{let timeout;await Promise.race([close().catch(()=>{}),new Promise(done=>{timeout=setTimeout(()=>{fallback?.();done()},15000);timeout.unref?.()})]);clearTimeout(timeout)};
 if(browser)await closeOwned(()=>browser.close(),()=>browser.process()?.kill());
 await closeOwned(()=>server.close(),()=>server.httpServer?.closeAllConnections());
}
