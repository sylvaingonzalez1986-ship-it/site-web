/** Isolated browser checks for the simplified commerce journey; all mutations use lesson data. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/commerce-simplification');
const port = Number(process.env.KQ_COMMERCE_SIMPLIFICATION_PORT ?? 3416), origin = `http://127.0.0.1:${port}`;
const motionOnly = process.argv.includes('--motion-only');
const modules = {
  entry: `import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import {KqMarketHub} from '/src/components/placard/KqMarketHub';
import {LegacyKqMarketDesk} from '/src/components/placard/KqMarketDesk';
import {quoteKqMarketRoutes} from '/src/lib/kanab-quest-market';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
let state=createKqOperationsLesson('market');
const rawState=structuredClone(state),raw=getKqOperationsCommerce(state).rawLots[0];
const execute=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;return result.payload};
execute({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
const source=state.trial.commerce.stocks[0];
execute({action:'online',command:'buy-packaging',payload:{code:'kraft-5',quantity:4}});
execute({action:'online',command:'create-listing',payload:{stockId:source.id,formatGrams:5,packagingCode:'kraft-5',packets:4,packetPriceCents:913}});
const baseline=structuredClone(state),listingId=state.trial.commerce.online.listings[0].id;
let scenario='empty';window.posts=[];window.navigation=[];window.fixtureListing=listingId;
window.legacyPosts=[];window.legacyFail=false;
const legacyCodes=['TENT-080-STARTER','SIFT-TRAY'];
const legacyOptions=quoteKqMarketRoutes({juryScore:7.5,harvestGrams:150,equipmentCodes:legacyCodes,marketContext:{window:Math.floor(Date.parse('2026-11-07T12:00:00Z')/21600000),reputation:10000,marketVolumes:{},routeSales:{},recentSales:{}}});
const legacyLot={flowerId:'legacy-motion',varietyCode:'test',varietyName:'Récolte test',cultureSystemCode:'soil',cultureSystemName:'Terre',cultureSystemTechnique:'Test',quality:75,harvestGrams:150,juryScore:7.5,qualityBand:'selection',equipmentCodes:legacyCodes,options:legacyOptions,status:'ready',selectedRoute:null,payoutCents:null,reputationGain:null,burnedAt:'2026-09-10',settledAt:null};
const legacySnapshot={cashCents:25000,electricityOutstandingCents:1377,reputation:100,reputationRank:12,ownedCodes:legacyCodes,equippedCodes:legacyCodes,routePlan:null,routeMasteries:[],equipmentSummary:{processingPrecision:30,processingCapacityPercent:50},lots:[legacyLot]};
const realFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 if(String(input)==='/api/arena/placard/market'){
  if(init.method!=='POST')return Response.json(legacySnapshot);
  const body=JSON.parse(init.body);window.legacyPosts.push(body);
  await new Promise(resolve=>setTimeout(resolve,120));
  if(window.legacyFail){window.legacyFail=false;return Response.json({error:'Erreur de reçu : réessaie.'},{status:503})}
  const quote=legacyOptions.find(item=>item.route===body.route);window.legacyConfirmedAt=performance.now();
  return Response.json({receiptId:'receipt-motion',flowerId:legacyLot.flowerId,route:body.route,payoutCents:quote.payoutCents,electricityPaidCents:1377,netPayoutCents:quote.payoutCents-1377,reputationGain:quote.reputationGain,cashAfterCents:25000+quote.payoutCents-1377,reputationAfter:100+quote.reputationGain,replayed:false,routeMastery:null,nextRouteGoal:null,nextEquipmentGoal:null,equipmentProgression:{catalogComplete:true,progressionComplete:true,remainingCount:0,alternativeCount:0}});
 }
 return realFetch(input,init);
};
const api=createKqTutorialApi(async(input,init={})=>{
 const url=new URL(String(input),location.origin),method=init.method??'GET';
 if(!url.pathname.startsWith('/api/arena/placard/'))throw new Error('Unexpected request');
 const body=typeof init.body==='string'?JSON.parse(init.body):undefined;
 if(method!=='GET')window.posts.push(body);
 if(scenario==='processing-error'&&method==='GET')return Response.json({error:'Lecture du stock indisponible.'},{status:503});
 try{const result=applyKqOperationsRequest(state,{path:url.pathname+url.search,method,body});state=result.state;
  const payload=result.payload;
  if(method==='GET'&&url.pathname==='/api/arena/placard/commerce'){
   if(scenario==='empty'){payload.rawLots=[];payload.stocks=[];payload.online.listings=[];payload.online.merch.inventory=[]}
   if(scenario==='unknown'){delete payload.online.merch.inventory;payload.online.listings=[];payload.rawLots=[];payload.stocks=[]}
   if(scenario.startsWith('processing')){
    const now=Date.parse(payload.customerDemand?.serverNow??payload.business?.serverNow??payload.demand.serverNow);
    payload.rawLots=[];payload.stocks=[{...payload.stocks[0],route:'dry-sift',batchRoute:'dry-sift',remainingUnits:270,initialUnits:270,processingReadyAt:new Date(now+(scenario==='processing-ready'?-60000:300000)).toISOString()}];
   }
  }
  return Response.json(payload);
 }catch(error){return Response.json({error:error.message},{status:400})}
});
function App(){
 const [section,setSection]=React.useState('overview'),[epoch,setEpoch]=React.useState(0),[flower,setFlower]=React.useState(),[listing,setListing]=React.useState();
 window.mount=(name,entry='overview',target)=>{scenario=name;state=structuredClone(name==='lots'?rawState:baseline);window.posts=[];window.navigation=[];setSection(entry);setFlower(target==='flower'?raw.flowerId:undefined);setListing(target==='listing'?listingId:undefined);setEpoch(value=>value+1)};
 window.setListingEntry=id=>{setListing(id);setSection('dashboard')};
 window.processingState=name=>{scenario=name;api.notify('kq:storage-updated')};
 if(new URLSearchParams(location.search).has('legacy'))return <LegacyKqMarketDesk onOpenShop={()=>{}}/>;
 return <KqTutorialApiProvider api={api}><KqMarketHub key={epoch} section={section} initialFlowerId={flower} initialListingId={listing} onSectionChange={(next,id)=>{window.navigation.push({section:next,listingId:id});setSection(next);setListing(id)}} onOpenShop={()=>window.navigation.push('equipment')} onOpenCulture={()=>window.navigation.push('culture')} /></KqTutorialApiProvider>;
}
createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);`,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),
 optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},
 plugins:[{name:'commerce-simplification',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},
 configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commerce simplifié</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>')})}}],
 server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser;
const results=[],errors=[];
let holdReceiptArt=false,heldReceiptArt;
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(holdReceiptArt&&url.pathname.includes('sylvain-cooking-sprites'))heldReceiptArt=request;else if(url.origin===origin||url.protocol==='data:')void request.continue();else void request.abort()});
 const click=async(label,scope='body')=>{const handle=await page.evaluateHandle(({label,scope})=>[...document.querySelectorAll(scope+' button, '+scope+' a, '+scope+' summary')].find(element=>element.getClientRects().length&&element.textContent.trim().startsWith(label)),{label,scope});const element=handle.asElement();assert(element,'Missing visible control: '+label);await element.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await element.click();await handle.dispose()};
 const settled=async()=>{await page.waitForFunction(()=>!document.body.textContent.includes('Ouverture de ta boutique…')&&!document.body.textContent.includes('Ouverture du comptoir…'))};
 const mount=async(name,entry='overview',target)=>{await page.evaluate(({name,entry,target})=>window.mount(name,entry,target),{name,entry,target});await settled()};
 const fit=async(label)=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.visualViewport.width+1),false,label+' fits viewport');
 const shot=async(name)=>{await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished))});await page.screenshot({path:resolve(output,name+'.png'),fullPage:true})};
 if(!motionOnly)for(const width of [320,390,1440]){
  await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('[data-shop-overview]');await settled();
  assert.equal(await page.$$eval('[data-market-section]',items=>items.filter(item=>item.getClientRects().length).length),3,'Three main destinations remain visible');
  assert.equal(await page.$$eval('[data-shop-overview] [aria-label="Les chiffres de ma boutique"] > *',items=>items.length),3,'Overview has three figures');
  assert.equal(await page.$('[data-shop-analysis]'),null,'No empty analysis panel');
  await fit('Empty overview');const emptyHeight=await page.evaluate(()=>document.documentElement.scrollHeight);assert(emptyHeight<1400,'Empty overview stays short: '+emptyHeight);await shot('empty-'+width);
  await click('Voir mes cultures');assert.equal(await page.evaluate(()=>window.navigation.at(-1)),'culture','Empty state leads to culture');
  await page.focus('[data-market-section="sales"]');await page.keyboard.press('Enter');await page.waitForSelector('[data-screen="lots"]');await fit('Sell destination');
  await click('Demandes clients');await page.waitForSelector('[data-screen="demands"]');await fit('Client demands');
  await click('Retour à mes lots');await page.waitForSelector('[data-screen="lots"]');
  await click('Mon stock en vente','nav');await page.waitForSelector('[data-online-listings-heading]');await fit('Empty announcements');
  await click('Développer','nav');await page.waitForSelector('[data-shop-view="site"]');
  assert.equal(await page.$$eval('[data-shop-view="activity"],[data-shop-view="pricing"]',items=>items.length),0,'Duplicated activity and pricing tabs removed');
  await fit('Develop');assert.deepEqual(await page.evaluate(()=>window.posts),[],'Navigation never mutates commerce');
  await mount('lots','sales','flower');await page.waitForSelector('[data-commerce-flower]');assert.equal(await page.$eval('#commerce-step-title',node=>node.textContent),'Préparer ma récolte','Harvest destination stays precise');assert.deepEqual(await page.evaluate(()=>window.posts),[]);
  await mount('active');await page.waitForSelector('[data-shop-overview] [aria-label="Les chiffres de ma boutique"]');await fit('Active overview');await shot('active-'+width);
  const listingName=await page.$eval('[data-shop-overview] [aria-labelledby$="-shelf"] li strong',node=>node.textContent);
  await click(listingName,'[data-shop-overview]');await page.waitForSelector('[data-online-listing] form').catch(async error=>{await shot('failure-listing-'+width);console.log(await page.evaluate(()=>({text:document.body.textContent.slice(-12000),navigation:window.navigation,errors:window.posts})));throw error});
  assert.equal(await page.$eval('[data-online-listing] form input',node=>document.activeElement===node),true,'Targeted listing price receives focus');
  assert.equal(await page.evaluate(()=>window.navigation.at(-1).listingId===window.fixtureListing),true,'Listing ID survives navigation');
  await fit('Targeted pricing');await shot('pricing-'+width);
  const form='[data-online-listing] form';
  const initialPrice=await page.$eval(form+' input',node=>node.value);
  await page.click(form+' [aria-label="Stratégies de prix proposées"] button');
  assert.notEqual(await page.$eval(form+' input',node=>node.value),initialPrice,'Preset changes editable price');assert.deepEqual(await page.evaluate(()=>window.posts),[],'Preset is not a transaction');
  await page.focus(form+' input');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('12.34');
  await click('Appliquer ce prix',form);await page.waitForSelector('dialog[open]');
  const confirmation=await page.$eval('dialog[open]',node=>node.textContent);assert.match(confirmation,/Modifier le prix de l’annonce/);assert.match(confirmation,/prochaine commande.*(zéro|réinitial)/);assert.match(confirmation,/12,34/);await fit('Price confirmation');
  await click('Revenir','dialog[open]');assert.deepEqual(await page.evaluate(()=>window.posts),[],'Cancelling price causes no transaction');
  await click('Appliquer ce prix',form);await page.waitForSelector('dialog[open]');await click('Confirmer','dialog[open]');await page.waitForFunction(()=>window.posts.some(body=>body.command==='update-listing'));
  const update=await page.evaluate(()=>window.posts.find(body=>body.command==='update-listing'));assert.equal(update.payload.packetPriceCents,1234);assert.equal(update.payload.listingId,await page.evaluate(()=>window.fixtureListing));
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await mount('unknown');
  assert.match(await page.$eval('[data-shop-overview]',node=>node.textContent),/Stock indisponible/,'Missing merch data is explicit');await fit('Unknown inventory');
  await mount('active','dashboard','listing');await page.waitForSelector('[data-online-listing] form');assert.equal(await page.evaluate(()=>document.querySelector('[data-online-listing]').dataset.onlineListing===window.fixtureListing),true,'Direct listing entry preserved');
  await click('Produits dérivés');await click('Gérer mes produits dérivés','[data-merch-activity]');await page.waitForSelector('[data-shop-view="merch"][aria-selected="true"]');assert.equal(await page.evaluate(()=>document.querySelector('[data-shop-view="site"]').getAttribute('aria-selected')),'false','Leaving a targeted listing preserves the merch destination');
  await page.evaluate(()=>window.setListingEntry(window.fixtureListing));await page.waitForSelector('[data-online-listing] form');await page.evaluate(()=>window.setListingEntry(undefined));await page.waitForFunction(()=>!document.querySelector('[data-online-listing] form'));await page.evaluate(()=>window.setListingEntry(window.fixtureListing));await page.waitForSelector('[data-online-listing] form');
  results.push({width,emptyHeight,visibleNavigation:true,legacyDestinations:true,targetedListing:true,priceConfirmation:true,unknownData:true});
 }
 if(motionOnly)for(const width of [320,390,1440]){
  await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.goto(origin,{waitUntil:'networkidle0',timeout:60000});await page.waitForFunction(()=>typeof window.mount==='function');
  await mount('processing','sales','flower');
  const scene='[data-commerce-workshop-scene]',hand='[data-commerce-waiting-hand]';
  await page.waitForSelector(scene+'[data-phase="pending"]');await page.$eval(scene,node=>node.scrollIntoView({block:'center'}));
  await page.waitForSelector(scene+'[data-motion-state="running"]');
  assert.match(await page.$eval(scene,node=>node.textContent),/27 g/,'Stock units are tenths of a gram');
  assert.equal(await page.$$eval(scene+' [role="progressbar"]',nodes=>nodes.length),0,'No invented percentage');
  const before=await page.$eval(hand,node=>getComputedStyle(node).transform);
  await page.waitForFunction((selector,before)=>getComputedStyle(document.querySelector(selector)).transform!==before,{},hand,before);
  assert.equal(await page.$eval(scene+' img',node=>getComputedStyle(node).transform),'none','Historical machine image stays fixed');
  await page.focus(scene+' button');await page.keyboard.press('Enter');await page.waitForSelector(scene+'[data-motion-state="paused"]');
  assert.equal(await page.$eval(hand,node=>getComputedStyle(node).animationPlayState),'paused');
  await page.keyboard.press('Enter');await page.waitForSelector(scene+'[data-motion-state="running"]');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.waitForSelector(scene+'[data-motion-state="reduced"]');
  assert.equal(await page.$eval(hand,node=>getComputedStyle(node).animationName),'none');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForSelector(scene+'[data-motion-state="hidden"]');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForSelector(scene+'[data-motion-state="running"]');
  await page.$eval(scene,node=>node.style.marginTop='2200px');await page.waitForSelector(scene+'[data-motion-state="offscreen"]');
  await page.$eval(scene,node=>{node.style.marginTop='';node.scrollIntoView({block:'center'})});await page.waitForSelector(scene+'[data-motion-state="running"]');
  await fit('Processing scene');await shot('motion-pending-'+width);
  await page.evaluate(()=>window.processingState('processing-ready'));await page.waitForSelector(scene+'[data-phase="ready"]');
  assert.match(await page.$eval(scene,node=>node.textContent),/Délai de transformation écoulé/);assert.equal(await page.$(hand),null);
  await page.evaluate(()=>window.processingState('processing-error'));await page.waitForSelector(scene+'[data-phase="unknown"]');
  assert.match(await page.$eval(scene,node=>node.textContent),/Disponibilité à confirmer/);assert.deepEqual(await page.evaluate(()=>window.posts),[],'Readiness and motion never mutate game');
  holdReceiptArt=width===1440;await page.setCacheEnabled(!holdReceiptArt);
  await page.goto(origin+'?legacy=1',{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Machines et filières"]');
  await click('Hash tamisé','[aria-label="Machines et filières"]');await page.click('#market-machine-detail > article > button');
  await page.waitForSelector('[role="dialog"]');await click('Retour','[role="dialog"]');assert.deepEqual(await page.evaluate(()=>window.legacyPosts),[],'Cancelling sale is free');
  await page.click('#market-machine-detail > article > button');await page.waitForSelector('[role="dialog"]');
  if(width===390)await page.evaluate(()=>window.legacyFail=true);
  await page.click('[role="dialog"] footer button:last-child');
  if(width===390){await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('Erreur de reçu'));await page.click('[role="dialog"] footer button:last-child')}
  await page.waitForSelector('[data-market-receipt]');
  const elapsed=await page.evaluate(()=>performance.now()-window.legacyConfirmedAt);assert(elapsed<900,'Receipt is immediate: '+elapsed);
  if(holdReceiptArt){assert.equal(await page.$eval('[data-market-receipt] img',node=>node.complete&&node.naturalWidth>0),false,'Receipt is visible before artwork');await heldReceiptArt.continue();holdReceiptArt=false;await page.waitForFunction(()=>document.querySelector('[data-market-receipt] img').naturalWidth>0)}
  assert.equal(await page.$('[data-transformation]'),null,'Sale never impersonates processing');
  assert.match(await page.$eval('[data-market-receipt]',node=>node.textContent),/Charges réglées/);
  const posts=await page.evaluate(()=>window.legacyPosts);assert.equal(posts.length,width===390?2:1);if(width===390)assert.equal(posts[0].requestKey,posts[1].requestKey);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('[data-market-receipt]').contains(document.activeElement)),true);
  await shot('motion-receipt-'+width);await page.keyboard.press('Escape');assert.equal(await page.$('[role="dialog"]'),null);
  results.push({width,pending:true,grams:27,pause:true,reduced:true,hidden:true,offscreen:true,unknown:true,ready:true,receiptImmediateMs:elapsed,retryKey:width===390});
 }
 assert.deepEqual(errors,[],'No runtime errors');await writeFile(resolve(output,motionOnly?'motion-results.json':'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{if(browser)await browser.close();await server.close()}
