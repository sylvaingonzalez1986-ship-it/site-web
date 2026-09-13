/** Isolated real UI with synthetic lots: no credentials, no production writes. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(), output=resolve(root,'output/placard-commerce');
const modules={
  'workshop-entry': `import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {KqMarketDesk} from '/src/components/placard/KqMarketDesk';
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
    const originalFetch=window.fetch.bind(window), quotes=new Map();window.__sales=[];
    window.fetch=async(url,init={})=>{
      if(String(url).startsWith('/api/arena/placard/commerce')) {
        if(init.method!=='POST') return new Response(JSON.stringify(snapshot));
        const body=JSON.parse(init.body);let result={action:body.action,cashAfterCents:snapshot.cashCents};
        if(body.action==='quote'){
          const offer=quoteKqCommerce(snapshot,snapshot.stocks.find(s=>s.id===body.stockId),body.channel,body.policy,body.units);quotes.set('quote',offer);
          return new Response(JSON.stringify({quoteId:'quote',offer,electricityPaidCents:0,netPayoutCents:offer.payoutCents,expiresAt:new Date(Date.now()+600000).toISOString()}));
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
          const offer=quotes.get(body.quoteId),stock=snapshot.stocks[0];window.__sales.push(body);
          stock.remainingUnits-=offer.units;stock.repExact=offer.repExactAfter;stock.repRounded=offer.repRoundedAfter;stock.payoutExact=offer.payoutExactAfter;stock.payoutRounded=offer.payoutRoundedAfter;
          snapshot.campaign.directUsed+=offer.directCost;snapshot.campaign.shopUsed+=offer.shopCost;snapshot.campaign.goodUnits=offer.goodUnitsAfter;snapshot.campaign.disappointmentUnits=offer.disappointmentAfter;
          snapshot.shopPartners=offer.shopPartnersAfter;snapshot.shopRecruitment=offer.shopRecruitmentAfter;snapshot.shopChurn=offer.shopChurnAfter;snapshot.campaign.shopGoodUnits=offer.shopGoodUnitsAfter;snapshot.campaign.shopBadUnits=offer.shopBadUnitsAfter;
          snapshot.cashCents+=offer.payoutCents;snapshot.clients=offer.clientsAfter;snapshot.reputation+=offer.reputationDelta;
          result={...result,satisfaction:offer.satisfaction,clientsBefore:offer.clientsBefore,shopPartnersBefore:offer.shopPartnersBefore,shopPartnersAfter:offer.shopPartnersAfter,shopPartnersDelta:offer.shopPartnersAfter-offer.shopPartnersBefore,shopPricePercent:offer.shopPricePercent,stockId:stock.id,channel:offer.channel,units:offer.units,payoutCents:offer.payoutCents,netPayoutCents:offer.payoutCents,reputationGain:offer.reputationDelta,clientsAfter:offer.clientsAfter,remainingUnits:stock.remainingUnits};
          snapshot.stocks=snapshot.stocks.filter(s=>s.remainingUnits>0);
        }
        result.cashAfterCents=snapshot.cashCents;snapshot.revision++;snapshot.receipts.unshift(result);return new Response(JSON.stringify(result));
      }
      if(url==='/api/arena/placard/equipment')return new Response(JSON.stringify({cashCents:snapshot.cashCents,reputation:snapshot.reputation,levels:{},purchasedCodes:[],ownedCodes:['TENT-080-STARTER'],equippedCodes:['TENT-080-STARTER'],routePlan:null,routeMasteries:[],catalog:KQ_EQUIPMENT_CATALOG.filter(e=>e.purchasable)}));
      if(String(url).startsWith('/api/'))return new Response('{}');
      return originalFetch(url,init);
    };
    function App(){const [shop,setShop]=React.useState(false);return React.createElement(React.Fragment,null,React.createElement(KqMarketDesk,{onOpenShop:()=>setShop(true)}),shop?React.createElement('div',{style:{position:'fixed',inset:0,zIndex:100}},React.createElement(KqEquipmentCatalogModal,{onClose:()=>setShop(false)})):null);}
    createRoot(document.getElementById('root')).render(React.createElement(App));`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,{loading:Loading}){const Component=React.lazy(async()=>({default:await loader()}));return props=>React.createElement(React.Suspense,{fallback:React.createElement(Loading)},React.createElement(Component,props));}`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
};
const server=await createServer({root,cacheDir:resolve(output,"vite-cache"),optimizeDeps:{include:["react","react-dom/client","lucide-react"]},configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'workshop-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard · Atelier</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__workshop-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3201,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[],results=[];
try {
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3201'))void r.continue();else void r.abort();});
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
 for(const width of [320,390,768,1440]){
  await page.setViewport({width,height:width<700?844:1050,isMobile:width<700,hasTouch:width<700});
  await page.goto('http://127.0.0.1:3201/?loyal',{waitUntil:'networkidle0'});
  await page.waitForSelector('[aria-label="Tes lots"]');await shot('lots-'+width);
  await prepare();await noOverflow();await shot('circuits-'+width);
  await page.click('[aria-label="Voir l’offre Vente en ligne"]');
  await page.waitForSelector('input[type="number"]');
  assert((await visibleText()).includes('Qualité du lot 9,0/10'));
  assert.equal(await page.$eval('input[type="number"]',e=>e.closest('details').open),false);
  assert.equal((await visibleText()).includes('Quantité à vendre (g)'),false,'Quantity is optional');
  await page.$eval('details summary',e=>e.click());
  await page.waitForSelector('input[type="number"]',{visible:true});await page.type('input[type="number"]','20');
  await click('Vendre ce lot');await page.waitForSelector('dialog[open]');assert((await page.$eval('dialog',e=>e.innerText)).includes('Qualité 9,0/10'));await shot('confirmation-'+width);await confirm();
  await page.waitForFunction(()=>document.body.textContent.includes('100 g restants'));await noOverflow();
  assert((await visibleText()).includes('Clients satisfaits'));assert((await visibleText()).includes('Aucun nouveau client cette fois'));
  await shot('vente-terminee-'+width);
  assert.equal(await page.$('[aria-label="Circuits de vente"]'),null,'Receipt is its own step');
  await click('Vendre le reste');await page.waitForSelector('[aria-label="Circuits de vente"]');
  await page.click('[aria-label="Voir l’offre Grossistes"]');
  await click('Vendre ce lot');await confirm();
  assert((await visibleText()).includes('Clientèle directe inchangée'));await click('Retour aux lots');
  await page.waitForFunction(()=>document.body.textContent.includes('Ta réserve est vide'));
  assert.equal(await page.evaluate(()=>window.__sales.length),2);
  results.push({width,prepareBeforeDistribution:true,optionalAdjustments:true,partialSale:true,wholesaleRemainder:true});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.goto('http://127.0.0.1:3201/',{waitUntil:'networkidle0'});
 await prepare();await page.click('[aria-label="Voir l’offre Vente en ligne"]');
 await click('Trouver l’ordinateur en boutique');
 await page.waitForSelector('[aria-label="Matériel de vente en ligne"]');
 await click('Acheter l’ordinateur');await click('Confirmer l’achat');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Matériel de vente en ligne"]')?.textContent.includes('Ordinateur déjà acheté'));
 await shot('ordinateur-boutique-390');
 await page.click('[aria-labelledby="equipment-catalog-title"] header button:first-child');
 await click('Activer Internet');await confirm();
 await page.waitForFunction(()=>document.body.innerText.includes('Vendre ce lot'));
 // Prepared inventory can be resumed without paying for preparation again.
 await click('← Comparer les offres');await click('← Changer de lot');
 await page.waitForSelector('[aria-label="Tes lots"]');
 assert((await visibleText()).includes('Déjà préparé'));
 await page.$eval('[aria-label="Tes lots"] button:first-child',e=>e.click());
 await page.waitForSelector('[aria-label="Circuits de vente"]');
 await page.click('[aria-label="Voir l’offre CBD shops"]');
 await click('Vendre ce lot');await confirm();
 await page.waitForFunction(()=>document.body.innerText.includes('Tout ce produit a été vendu.'));
 await noOverflow();
 // Satisfaction and actual clientele changes are separate outcomes.
 for(const scenario of [{score:9,label:'Clients satisfaits',change:'+3 clients fidèles'}, {score:7.5,label:'Clients mitigés',change:'Aucun nouveau client cette fois'}, {score:6,label:'Clients déçus',change:'11 clients perdus'}]) {
   await page.goto('http://127.0.0.1:3201/?loyal&quality='+scenario.score,{waitUntil:'networkidle0'});
   await prepare(scenario.score);await page.click('[aria-label="Voir l’offre Vente en ligne"]');
   await click('Vendre ce lot');await confirm();
   await page.waitForSelector('[aria-label="Bilan clientèle"]');
   const feedback=await page.$eval('[aria-label="Bilan clientèle"]',e=>e.innerText);
   assert(feedback.includes(scenario.label));assert(feedback.includes(scenario.change));
   await noOverflow();await shot('satisfaction-'+scenario.score);
 }
 for(const scenario of [{key:'gain',score:9,label:'Boutiques satisfaites',change:'+1 boutique partenaire'}, {key:'loss',score:6.5,label:'Boutiques déçues',change:'1 boutique perdue'}]) {
   await page.goto('http://127.0.0.1:3201/?loyal&shops='+scenario.key+'&quality='+scenario.score,{waitUntil:'networkidle0'});
   await prepare(scenario.score);await page.click('[aria-label="Voir l’offre CBD shops"]');
   await page.$eval('details summary',e=>e.click());
   assert((await visibleText()).includes('20 partenaires maximum'));
   await click('Vendre ce lot');await confirm();await page.waitForSelector('[aria-label="Bilan clientèle"]');
   const feedback=await page.$eval('[aria-label="Bilan clientèle"]',e=>e.innerText);
   assert(feedback.includes(scenario.label));assert(feedback.includes(scenario.change));
   await noOverflow();await shot('partenaires-'+scenario.key);
 }
 // A real transformation uses its yield and preserves the unprocessed flowers.
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.goto('http://127.0.0.1:3201/?loyal&hash',{waitUntil:'networkidle0'});
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
 await page.click('[aria-label="Voir l’offre Grossistes"]');await click('Vendre ce lot');await confirm();
 await click('Retour aux lots');await page.waitForSelector('[aria-label="Tes lots"]');
 assert((await visibleText()).includes('Fleurs entières'));
 await page.$eval('[aria-label="Tes lots"] button:first-child',e=>e.click());
 await page.waitForSelector('[aria-label="Circuits de vente"]');
 await page.click('[aria-label="Voir l’offre Grossistes"]');await click('Vendre ce lot');await confirm();
 await click('Retour aux lots');await page.waitForFunction(()=>document.body.innerText.includes('Ta réserve est vide'));
 // The illustrated overview keeps progression, subscription and sales easy to inspect.
 for(const width of [320,390,768,1440]) {
   await page.setViewport({width,height:width<700?844:1050,isMobile:width<700,hasTouch:width<700});
   await page.goto('http://127.0.0.1:3201/?loyal&overview&reputation=312',{waitUntil:'networkidle0'});
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
 await page.goto('http://127.0.0.1:3201/?loyal&reputation=3000',{waitUntil:'networkidle0'});
 await page.click('[aria-label="Mon commerce"] > summary');
 assert.equal(await page.$eval('[aria-label="Ta réputation"] progress',e=>e.value),100);
 assert((await visibleText()).includes('Dernier palier atteint'));
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,computerPurchase:true,internetActivation:true,preparedStockResumed:true,hashTransformation:true,reducedMotion:true,customerFeedback:true,shopPartners:true,commerceOverview:true,errors},null,2));
 console.log(JSON.stringify({passed:true,results,computerPurchase:true,internetActivation:true,preparedStockResumed:true,hashTransformation:true,reducedMotion:true,customerFeedback:true,shopPartners:true,commerceOverview:true,output}));
}finally{await browser?.close();await server.close();}
