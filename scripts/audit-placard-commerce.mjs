/** Isolated real UI with synthetic lots: no credentials, no production writes. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const quoteRecovery=process.argv.includes('--quote-recovery');
const root=process.cwd(), output=resolve(root,quoteRecovery?'output/placard-commerce-quote-recovery':'output/placard-commerce');
const port=Number(process.env.KQ_COMMERCE_AUDIT_PORT??(quoteRecovery?3430:3201)), origin=`http://127.0.0.1:${port}`;
const modules={
  'warehouse-assets': `export default ${await readFile(resolve(root,'public/placard/warehouse-v2/manifest.json'),'utf8')};`,
  'workshop-entry': `import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {KqCommerceDesk as KqMarketDesk} from '/src/components/placard/KqCommerceDesk';
    import {KqEquipmentCatalogModal} from '/src/components/placard/KqEquipmentCatalogModal';
    import {quoteKqMarketRoutes} from '/src/lib/kanab-quest-market'; import {KQ_EQUIPMENT_CATALOG} from '/src/lib/kanab-quest-equipment';
    import {quoteKqCommerce} from '/src/lib/kanab-quest-commerce';
    const shopScenario=new URLSearchParams(location.search).get('shops');const shopPartners=shopScenario==='loss'?4:0;const shopRecruitment=shopScenario==='gain'?4800:0;const juryScore=Number(new URLSearchParams(location.search).get('quality')??9);const loyal=new URLSearchParams(location.search).has('loyal');const reputation=Number(new URLSearchParams(location.search).get('reputation')??(loyal?1500:0));const hash=new URLSearchParams(location.search).has('hash');
    const options=quoteKqMarketRoutes({juryScore,harvestGrams:120,equipmentCodes:hash?['TENT-080-STARTER','SIFT-TRAY']:['TENT-080-STARTER'],marketContext:{reputation:hash?1500:0,routeSales:hash?{raw:20}:{},window:0,recentSales:{},marketVolumes:{}}});
    const snapshot={shopPartners,shopRecruitment,shopChurn:0,revision:0,cashCents:100000,reputation,clients:loyal?100:0,computerOwned:loyal,internetRenew:loyal,campaign:{id:'cycle',shopPartnersStart:shopPartners,shopRecruitmentStart:shopRecruitment,shopChurnStart:0,shopGoodUnits:0,shopBadUnits:0,revision:0,reputation,clientsStart:loyal?100:0,event:'normal',internetPaid:loyal,directUsed:0,shopUsed:0,goodUnits:0,disappointmentUnits:0},stocks:[],receipts:[],routeSales:{},marketVolumes:{},ownVolumes:{},electricityOutstandingCents:0,rawLots:[{flowerId:'flower-test',varietyName:'Récolte des embruns',juryScore,harvestGrams:120,options}]};
    if(new URLSearchParams(location.search).has('overview')) {
      snapshot.clients=0;snapshot.receipts=[
        {action:'sell',channel:'cbd-shop',units:1000,netPayoutCents:8100,reputationGain:0},
        {action:'sell',channel:'online',units:42,netPayoutCents:7915,reputationGain:0},
        {action:'sell',channel:'wholesale',units:1584,netPayoutCents:8554,reputationGain:0},
        {action:'sell',channel:'online',units:90,netPayoutCents:13356,reputationGain:0},
      ];
    }
    const recovery=new URLSearchParams(location.search).get('recovery');
    if(recovery){snapshot.demand={serverNow:new Date().toISOString(),updatedAt:new Date().toISOString(),onlineDebt:0,shopDebt:0,growthResetsAt:new Date(Date.now()+86400000).toISOString()};snapshot.rawLots=[];snapshot.stocks=[{id:'stock',flowerId:'flower-test',name:'Récolte des embruns',route:'raw',batchRoute:'raw',juryScore,initialUnits:1200,remainingUnits:1200,equivalentUnits:1200,originalUnits:1200,baseUnitCents:180,repExact:0,repRounded:0,professionalUnits:0,counted:false}];}
    const originalFetch=window.fetch.bind(window), quotes=new Map(), receipts=new Map();window.__sales=[];window.__quotes=[];window.__mutations=0;
    const control={conflict:recovery==='storage'?'commerce_storage_changed':recovery==='offer'?'commerce_offer_changed':null,failQuotes:0,loseSaleResponse:recovery==='network'};
    window.__control=control;window.__snapshot=()=>structuredClone(snapshot);
    window.__expireQuote=()=>{snapshot.demand.serverNow=new Date(Date.now()+11*60000).toISOString();window.dispatchEvent(new CustomEvent('kq:storage-updated'));};
    window.fetch=async(url,init={})=>{
      if(String(url).startsWith('/api/arena/placard/commerce')) {
        if(init.method!=='POST') return new Response(JSON.stringify(snapshot));
        const body=JSON.parse(init.body);let result={action:body.action,cashAfterCents:snapshot.cashCents};
        if(body.action==='quote'){
          window.__quotes.push(body);
          if(control.failQuotes>0){control.failQuotes--;return Response.json({error:'Le calcul est momentanément indisponible.'},{status:503});}
          const offer=quoteKqCommerce(snapshot,snapshot.stocks.find(s=>s.id===body.stockId),body.channel,body.policy,body.units),quoteId=crypto.randomUUID();quotes.set(quoteId,offer);
          return new Response(JSON.stringify({quoteId,offer,electricityPaidCents:0,netPayoutCents:offer.payoutCents,expiresAt:new Date(Date.now()+600000).toISOString()}));
        }
        if(body.action==='prepare'){
          const q=options.find(q=>q.route===body.route);window.__preparedRoute=body.route;
          snapshot.cashCents-=q.market?.processingCostCents??0;
          snapshot.rawLots=[];snapshot.stocks=[{id:'stock',flowerId:'flower-test',name:'Récolte des embruns',route:q.route,batchRoute:q.route,juryScore,initialUnits:Math.round(q.productGrams*10),remainingUnits:Math.round(q.productGrams*10),equivalentUnits:Math.round(q.processedInputGrams*10),originalUnits:1200,baseUnitCents:q.productBaseUnitCents,repExact:0,repRounded:0,professionalUnits:0,counted:false}];result.stockId='stock';
          if(q.remainderGrams>0)snapshot.stocks.push({...snapshot.stocks[0],id:'remainder',route:q.remainderDestination,initialUnits:Math.round(q.remainderGrams*10),remainingUnits:Math.round(q.remainderGrams*10),equivalentUnits:Math.round(q.remainderGrams*10),baseUnitCents:180});
        }
        if(body.action==='buy-computer'){snapshot.computerOwned=true;snapshot.cashCents-=45000;}
        if(body.action==='internet'){snapshot.internetRenew=body.enabled;if(body.enabled&&!snapshot.campaign.internetPaid){snapshot.cashCents-=1500;snapshot.campaign.internetPaid=true;}}
        if(body.action==='sell'){
          window.__sales.push(body);
          if(receipts.has(body.requestKey))return Response.json({...receipts.get(body.requestKey),replayed:true});
          if(control.conflict){const code=control.conflict;control.conflict=null;snapshot.stocks[0].baseUnitCents+=40;return Response.json({error:code==='commerce_storage_changed'?'La conservation de ce lot a évolué. Recalcule l’offre.':'Les conditions ont changé. Recalcule l’offre avant de confirmer.',code},{status:409});}
          await new Promise(resolve=>setTimeout(resolve,120));
          const offer=quotes.get(body.quoteId),stock=snapshot.stocks[0];window.__mutations++;
          stock.remainingUnits-=offer.units;stock.repExact=offer.repExactAfter;stock.repRounded=offer.repRoundedAfter;stock.payoutExact=offer.payoutExactAfter;stock.payoutRounded=offer.payoutRoundedAfter;
          snapshot.campaign.directUsed+=offer.directCost;snapshot.campaign.shopUsed+=offer.shopCost;snapshot.campaign.goodUnits=offer.goodUnitsAfter;snapshot.campaign.disappointmentUnits=offer.disappointmentAfter;
          snapshot.shopPartners=offer.shopPartnersAfter;snapshot.shopRecruitment=offer.shopRecruitmentAfter;snapshot.shopChurn=offer.shopChurnAfter;snapshot.campaign.shopGoodUnits=offer.shopGoodUnitsAfter;snapshot.campaign.shopBadUnits=offer.shopBadUnitsAfter;
          snapshot.cashCents+=offer.payoutCents;snapshot.clients=offer.clientsAfter;snapshot.reputation+=offer.reputationDelta;
          result={...result,satisfaction:offer.satisfaction,clientsBefore:offer.clientsBefore,shopPartnersBefore:offer.shopPartnersBefore,shopPartnersAfter:offer.shopPartnersAfter,shopPartnersDelta:offer.shopPartnersAfter-offer.shopPartnersBefore,shopPricePercent:offer.shopPricePercent,stockId:stock.id,channel:offer.channel,units:offer.units,payoutCents:offer.payoutCents,netPayoutCents:offer.payoutCents,reputationGain:offer.reputationDelta,clientsAfter:offer.clientsAfter,remainingUnits:stock.remainingUnits};
          snapshot.stocks=snapshot.stocks.filter(s=>s.remainingUnits>0);
        }
        result.cashAfterCents=snapshot.cashCents;snapshot.revision++;snapshot.receipts.unshift(result);
        if(body.action==='sell'){receipts.set(body.requestKey,structuredClone(result));if(control.loseSaleResponse){control.loseSaleResponse=false;throw new TypeError('Connexion interrompue après validation.');}}
        return new Response(JSON.stringify(result));
      }
      if(url==='/api/arena/placard/equipment')return new Response(JSON.stringify({cashCents:snapshot.cashCents,reputation:snapshot.reputation,levels:{},purchasedCodes:[],ownedCodes:['TENT-080-STARTER'],equippedCodes:['TENT-080-STARTER'],routePlan:null,routeMasteries:[],catalog:KQ_EQUIPMENT_CATALOG.filter(e=>e.purchasable)}));
      if(String(url).startsWith('/api/'))return new Response('{}');
      return originalFetch(url,init);
    };
    function App(){const [shop,setShop]=React.useState(false);return React.createElement(React.Fragment,null,React.createElement(KqMarketDesk,{mode:'sales',onOpenShop:()=>setShop(true)}),shop?React.createElement('div',{style:{position:'fixed',inset:0,zIndex:100}},React.createElement(KqEquipmentCatalogModal,{onClose:()=>setShop(false)})):null);}
    createRoot(document.getElementById('root')).render(React.createElement(App));`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,{loading:Loading}){const Component=React.lazy(async()=>({default:await loader()}));return props=>React.createElement(React.Suspense,{fallback:React.createElement(Loading)},React.createElement(Component,props));}`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
};
const server=await createServer({root,cacheDir:resolve(output,"vite-cache"),optimizeDeps:{include:["react","react-dom","react-dom/client","react/jsx-runtime","react/jsx-dev-runtime","lucide-react"]},configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'workshop-audit',enforce:'pre',resolveId(id){if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard · Atelier</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__workshop-entry"></script></html>');});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[],results=[];
try {
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.origin===origin))void r.continue();else void r.abort();});
 const click=async(text)=>{const handle=await page.evaluateHandle(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t||b.textContent.trim().startsWith(t)),text);const el=handle.asElement();assert(el,`Button missing: ${text}`);await el.scrollIntoView();await el.click();};
 const confirm=async()=>{await page.waitForSelector('dialog[open]');await click('Confirmer');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));};
 const shot=async name=>{
   await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished));});
   await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});
 };
 const visibleText=()=>page.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
 const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const prepare=async(score=9)=>{
   await page.waitForSelector('[aria-label="Tes lots"]');
   assert.equal(await page.$('[aria-label="Circuits de vente"]'),null,'Distribution hidden until preparation');
   await page.$eval('[aria-label="Tes lots"] button:first-child',e=>e.click());
   await page.waitForSelector('select');
   assert.equal(await page.$('[aria-label="Circuits de vente"]'),null,'No circuit in transformation step');
   await click('Préparer les fleurs et continuer');await confirm();
   await page.waitForSelector('[aria-label="Circuits de vente"]');
   assert.equal(await page.$$eval('[aria-label="Circuits de vente"] button',buttons=>buttons.length),3);
   assert((await visibleText()).includes('Qualité du lot '+score.toLocaleString('fr-FR',{minimumFractionDigits:1})+'/10'));
   assert((await visibleText()).includes('min. 6,5/10'));
   assert((await visibleText()).includes('Toute qualité acceptée'));
 };
 if(quoteRecovery){
  const dialogButton=async(label)=>{
    const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent.trim()===text),label);
    const button=handle.asElement();assert(button,`Dialog control missing: ${label}`);await button.click();await handle.dispose();
  };
  const openQuote=async(scenario,width)=>{
    await page.setViewport({width,height:width<700?844:1050,isMobile:width<700,hasTouch:width<700});
    await page.goto(origin+'/?loyal&recovery='+scenario,{waitUntil:'networkidle0'});
    await page.waitForSelector('[aria-label="Tes lots"] button');
    await page.click('[aria-label="Tes lots"] button');
    await page.waitForSelector('[aria-label="Voir l’offre Grossistes"]');
    await page.click('[aria-label="Voir l’offre Grossistes"]');
    await page.focus('input[type="number"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');
    await page.type('input[type="number"]','20');
    await click('Voir le montant net');await page.waitForSelector('dialog[open]');
    assert.equal(await page.evaluate(()=>window.__sales.length),0,'Reading a quote does not sell anything');
    return page.$eval('dialog[open] dl',element=>element.innerText);
  };
  const assertRequote=()=>page.waitForFunction(()=>[...document.querySelectorAll('dialog[open] button')].some(button=>button.textContent.trim()==='Recalculer l’offre'));
  for(const [scenario,width] of [['offer',1440],['offer',320],['storage',390]]){
    const oldTotals=await openQuote(scenario,width);
    await dialogButton('Confirmer');await assertRequote();
    assert.equal(await page.evaluate(()=>window.__mutations),0,'Rejected quote never removes stock or credits money');
    assert.equal(await page.evaluate(()=>window.__snapshot().stocks[0].remainingUnits),1200);
    assert.equal(await page.evaluate(()=>window.__snapshot().cashCents),100000);
    await noOverflow();await shot('rejected-'+scenario+'-'+width);
    if(width===320){
      await page.evaluate(()=>{window.__control.failQuotes=1;});
      await dialogButton('Recalculer l’offre');
      await page.waitForFunction(()=>document.querySelector('dialog[open] [role="alert"]')?.textContent.includes('momentanément'));
      await assertRequote();
      assert.equal(await page.evaluate(()=>window.__sales.length),1,'A failed recalculation never retries the rejected sale');
      assert.equal(await page.$eval('dialog[open] dl',element=>element.innerText),oldTotals,'Failure keeps the rejected totals visible for context');
    }
    await dialogButton('Recalculer l’offre');
    await page.waitForFunction(()=>[...document.querySelectorAll('dialog[open] button')].some(button=>button.textContent.trim()==='Confirmer'));
    const newTotals=await page.$eval('dialog[open] dl',element=>element.innerText);
    assert.notEqual(newTotals,oldTotals,'The new authoritative amount is presented before another confirmation');
    assert.equal(await page.evaluate(()=>window.__sales.length),1,'Recalculating never sells automatically');
    const quotes=await page.evaluate(()=>window.__quotes);
    assert.equal(quotes[0].units,200,'Custom 20 g quantity sent in tenths of a gram');
    for(const quote of quotes.slice(1))assert.deepEqual(quote,quotes[0],'Recalculation retains exact stock/channel/policy/quantity');
    await noOverflow();await shot('recalculated-'+scenario+'-'+width);
    // Activation by keyboard must still require the separate confirmation.
    await page.$eval('dialog[open] footer button:last-child',element=>element.focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    const sales=await page.evaluate(()=>window.__sales);
    assert.equal(sales.length,2);assert.notEqual(sales[0].quoteId,sales[1].quoteId);assert.notEqual(sales[0].requestKey,sales[1].requestKey);
    assert.notEqual(sales[0].expectedPayoutCents,sales[1].expectedPayoutCents);
    assert.equal(await page.evaluate(()=>window.__mutations),1);assert.equal(await page.evaluate(()=>window.__snapshot().stocks[0].remainingUnits),1000);
    results.push({scenario,width,explicitRecalculation:true,preservedRequest:true,newAmountConfirmed:true,recalculationFailure:width===320});
  }
  await openQuote('network',390);
  await dialogButton('Confirmer');
  await page.waitForFunction(()=>document.querySelector('dialog[open] [role="alert"]')?.textContent.includes('Connexion interrompue'));
  assert.equal(await page.evaluate(()=>window.__mutations),1,'Fixture applied the sale before the response was lost');
  assert.equal(await page.evaluate(()=>window.__quotes.length),1,'Ambiguous network failure must not create a new quote');
  await page.evaluate(()=>window.__expireQuote());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert(await page.$eval('dialog[open] [role="alert"]',element=>element.textContent.includes('Connexion interrompue')),'A passive refresh preserves the transaction error');
  assert.equal(await page.$$eval('dialog[open] button',buttons=>buttons.some(button=>button.textContent.trim()==='Recalculer l’offre')),false);
  await dialogButton('Revenir');await page.waitForSelector('[data-pending-commerce-sale]');
  await page.click('[data-pending-commerce-sale] button');await page.waitForSelector('dialog[open]');
  assert(await page.$eval('dialog[open] [role="status"]',element=>element.textContent.includes('même demande')),'Reopening clearly explains idempotent verification');
  assert.equal(await page.evaluate(()=>window.__quotes.length),1,'Verifying a pending sale never creates another quote');
  await dialogButton('Revenir');await page.waitForSelector('[data-pending-commerce-sale]');
  await click('Voir le montant net');await page.waitForSelector('dialog[open]');
  assert.equal(await page.evaluate(()=>window.__quotes.length),1,'The normal sale action also resumes the pending request');
  assert.equal(await page.evaluate(()=>window.__sales.length),1,'Closing and reopening never submits a sale');
  await dialogButton('Confirmer');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  const replay=await page.evaluate(()=>({sales:window.__sales,mutations:window.__mutations,quotes:window.__quotes.length,stock:window.__snapshot().stocks[0].remainingUnits}));
  assert.equal(replay.sales.length,2);assert.deepEqual(replay.sales[1],replay.sales[0],'Lost response reuses the complete original idempotent request');
  assert.equal(replay.mutations,1);assert.equal(replay.quotes,1);assert.equal(replay.stock,1000);
  assert.equal(await page.$('[data-pending-commerce-sale]'),null,'A verified receipt clears the pending sale');
  results.push({scenario:'network-response-lost',width:390,expiredBeforeRetry:true,errorSurvivesRefresh:true,closeAndReopenPreserved:true,identicalRequestKey:true,singleSale:true});
 }else{
 for(const width of [320,390,768,1440]){
  await page.setViewport({width,height:width<700?844:1050,isMobile:width<700,hasTouch:width<700});
  await page.goto(origin+'/?loyal',{waitUntil:'networkidle0'});
  await page.waitForSelector('[aria-label="Tes lots"]');await shot('lots-'+width);
  await prepare();await noOverflow();await shot('circuits-'+width);
  await page.click('[aria-label="Voir l’offre Vente en ligne"]');
  await page.waitForSelector('input[type="number"]');
  assert((await visibleText()).includes('Qualité du lot 9,0/10'));
  assert.equal(await page.$eval('input[type="number"]',e=>e.checkVisibility()),true);
  assert.equal((await visibleText()).includes('Quantité à vendre (g)'),true,'Quantity is directly editable');
  await page.focus('input[type="number"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');
  await page.waitForSelector('input[type="number"]',{visible:true});await page.type('input[type="number"]','20');
  await click('Voir le montant net');await page.waitForSelector('dialog[open]');assert((await page.$eval('dialog',e=>e.innerText)).includes('Qualité 9,0/10'));await shot('confirmation-'+width);await confirm();
  await page.waitForFunction(()=>document.body.textContent.includes('100 g restants'));await noOverflow();
  assert((await visibleText()).includes('Clients satisfaits'));assert((await visibleText()).includes('Aucun nouveau client cette fois'));
  await shot('vente-terminee-'+width);
  assert.equal(await page.$('[aria-label="Circuits de vente"]'),null,'Receipt is its own step');
  await click('Vendre le reste');await page.waitForSelector('[aria-label="Circuits de vente"]');
  await page.click('[aria-label="Voir l’offre Grossistes"]');
  await click('Voir le montant net');await confirm();
  assert((await visibleText()).includes('Clientèle directe inchangée'));await click('Retour aux lots');
  await page.waitForFunction(()=>document.body.textContent.includes('Ta réserve est vide'));
  assert.equal(await page.evaluate(()=>window.__sales.length),2);
  results.push({width,prepareBeforeDistribution:true,optionalAdjustments:true,partialSale:true,wholesaleRemainder:true});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.goto(origin+'/',{waitUntil:'networkidle0'});
 await prepare();await page.click('[aria-label="Voir l’offre Vente en ligne"]');
 await click('Trouver l’ordinateur en boutique');
 await page.waitForSelector('[aria-label="Matériel de vente en ligne"]');
 await click('Acheter l’ordinateur');await click('Confirmer l’achat');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Matériel de vente en ligne"]')?.textContent.includes('Ordinateur déjà acheté'));
 await shot('ordinateur-boutique-390');
 await page.click('[aria-labelledby="equipment-catalog-title"] header button:first-child');
 await click('Activer Internet');await confirm();
 await page.waitForFunction(()=>document.body.innerText.includes('Voir le montant net'));
 // Prepared inventory can be resumed without paying for preparation again.
 await click('← Comparer les offres');await click('← Changer de lot');
 await page.waitForSelector('[aria-label="Tes lots"]');
 assert((await visibleText()).includes('Déjà préparé'));
 await page.$eval('[aria-label="Tes lots"] button:first-child',e=>e.click());
 await page.waitForSelector('[aria-label="Circuits de vente"]');
 await page.click('[aria-label="Voir l’offre CBD shops"]');
 await click('Voir le montant net');await confirm();
 await page.waitForFunction(()=>document.body.innerText.includes('Tout ce produit a été vendu.'));
 await noOverflow();
 // Satisfaction and actual clientele changes are separate outcomes.
 for(const scenario of [{score:9,label:'Clients satisfaits',change:'+3 clients fidèles'}, {score:7.5,label:'Clients mitigés',change:'Aucun nouveau client cette fois'}, {score:6,label:'Clients déçus',change:'11 clients perdus'}]) {
   await page.goto(origin+'/?loyal&quality='+scenario.score,{waitUntil:'networkidle0'});
   await prepare(scenario.score);await page.click('[aria-label="Voir l’offre Vente en ligne"]');
   await click('Voir le montant net');await confirm();
   await page.waitForSelector('[aria-label="Bilan clientèle"]');
   const feedback=await page.$eval('[aria-label="Bilan clientèle"]',e=>e.innerText);
   assert(feedback.includes(scenario.label));assert(feedback.includes(scenario.change));
   await noOverflow();await shot('satisfaction-'+scenario.score);
 }
 for(const scenario of [{key:'gain',score:9,label:'Boutiques satisfaites',change:'+1 boutique partenaire'}, {key:'loss',score:6.5,label:'Boutiques déçues',change:'1 boutique perdue'}]) {
   await page.goto(origin+'/?loyal&shops='+scenario.key+'&quality='+scenario.score,{waitUntil:'networkidle0'});
   await prepare(scenario.score);await page.click('[aria-label="Voir l’offre CBD shops"]');
   await page.$eval('details summary',e=>e.click());
   assert((await visibleText()).includes('20 partenaires maximum'));
   await click('Voir le montant net');await confirm();await page.waitForSelector('[aria-label="Bilan clientèle"]');
   const feedback=await page.$eval('[aria-label="Bilan clientèle"]',e=>e.innerText);
   assert(feedback.includes(scenario.label));assert(feedback.includes(scenario.change));
   await noOverflow();await shot('partenaires-'+scenario.key);
 }
 // A real transformation uses its yield and preserves the unprocessed flowers.
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.goto(origin+'/?loyal&hash',{waitUntil:'networkidle0'});
 await page.waitForSelector('[aria-label="Tes lots"]');await page.$eval('[aria-label="Tes lots"] button:first-child',e=>e.click());
 await page.waitForSelector('select');await page.select('select','dry-sift');
 assert.equal(await page.$eval('[data-screen]',e=>getComputedStyle(e.querySelector('section[aria-labelledby]')).animationName),'none','Reduced motion respected');
 await shot('transformation-390');await noOverflow();
 await click('Transformer et continuer');await confirm();
 await page.waitForSelector('[aria-label="Circuits de vente"]');
 assert.equal(await page.evaluate(()=>window.__preparedRoute),'dry-sift');
 assert((await visibleText()).includes('Hash tamisé'));
 assert((await visibleText()).includes('min. 7,5/10'));
 assert((await visibleText()).includes('Qualité du lot 9,0/10'));
 await page.click('[aria-label="Voir l’offre Grossistes"]');await click('Voir le montant net');await confirm();
 await click('Retour aux lots');await page.waitForSelector('[aria-label="Tes lots"]');
 assert((await visibleText()).includes('Fleurs entières'));
 await page.$eval('[aria-label="Tes lots"] button:first-child',e=>e.click());
 await page.waitForSelector('[aria-label="Circuits de vente"]');
 await page.click('[aria-label="Voir l’offre Grossistes"]');await click('Voir le montant net');await confirm();
 await click('Retour aux lots');await page.waitForFunction(()=>document.body.innerText.includes('Ta réserve est vide'));
 // The illustrated overview keeps progression, subscription and sales easy to inspect.
 for(const width of [320,390,768,1440]) {
   await page.setViewport({width,height:width<700?844:1050,isMobile:width<700,hasTouch:width<700});
   await page.goto(origin+'/?loyal&overview&reputation=312',{waitUntil:'networkidle0'});
   await page.waitForSelector('[aria-label="Mon commerce"]');
   await page.click('[aria-label="Mon commerce"] > summary');
   await page.waitForFunction(()=>[...document.querySelectorAll('[aria-label="Mon commerce"] img')].every(img=>img.complete&&img.naturalWidth>0));
   assert.equal(await page.$eval('[aria-label="Ta réputation"] progress',e=>e.value),28);
   const overviewText=await page.$eval('[aria-label="Mon commerce"]',e=>e.innerText);
   assert(overviewText.includes('288 points'));assert(overviewText.includes('Signature locale'));assert(overviewText.includes('0 fidèles'));
   assert.equal(await page.$$eval('[aria-label="Dernières ventes"] > ul > li',rows=>rows.length),3);
   const panel=await page.$('[aria-label="Mon commerce"]');await panel.screenshot({path:resolve(output,'mon-commerce-'+width+'.png')});
   await page.$eval('[aria-label="Mon commerce"] details > summary',e=>e.click());
   assert.equal(await page.$$eval('[aria-label="Mon commerce"] [aria-current="step"]',nodes=>nodes.length),1);
   await page.$eval('[aria-label="Mon commerce"] details > summary',e=>e.click());
   await page.$eval('[aria-label="Dernières ventes"] details > summary',e=>e.click());
   assert((await visibleText()).includes('133,56'));await noOverflow();
   if(width===390) {
     await click('Couper la reconduction');await confirm();
     assert((await visibleText()).includes('Reconduction désactivée'));assert((await visibleText()).includes('Internet actif'));
     await click('Réactiver la reconduction');await confirm();assert((await visibleText()).includes('Reconduction activée'));
   }
 }
 await page.goto(origin+'/?loyal&reputation=3000',{waitUntil:'networkidle0'});
 await page.click('[aria-label="Mon commerce"] > summary');
 assert.equal(await page.$eval('[aria-label="Ta réputation"] progress',e=>e.value),100);
 assert((await visibleText()).includes('Dernier palier atteint'));
 }
 assert.deepEqual(errors,[]);
 const report={passed:true,results,...(quoteRecovery?{quoteRecovery:true}:{computerPurchase:true,internetActivation:true,preparedStockResumed:true,hashTransformation:true,reducedMotion:true,customerFeedback:true,shopPartners:true,commerceOverview:true}),errors};
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,output}));
}catch(error){
 const pages=await browser?.pages();const lastPage=pages?.at(-1);
 await writeFile(resolve(output,'failure.json'),JSON.stringify({error:error.message,stack:error.stack,errors,results,body:lastPage?await lastPage.evaluate(()=>document.body.innerText).catch(()=>null):null},null,2));
 throw error;
}finally{await browser?.close();await server.close();}
