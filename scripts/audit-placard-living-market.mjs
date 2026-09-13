/** Isolated real UI with synthetic lots: no credentials, no production writes. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(), output=resolve(root,'output/placard-living-market');
const modules={
  'workshop-entry': `import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css'; import retro from '/src/components/contest/ArenaRetro.module.css';
    import {KqMarketDesk} from '/src/components/placard/KqMarketDesk';
    import {quoteKqMarketRoutes} from '/src/lib/kanab-quest-market'; import {KQ_EQUIPMENT_CATALOG} from '/src/lib/kanab-quest-equipment';
    const params=new URLSearchParams(location.search);
    const reputation=params.has('loyal')?1500:0;
    const equipmentCodes=['TENT-080-STARTER',KQ_EQUIPMENT_CATALOG.find(e=>e.unlocks.includes('dry-sift')).code];
    const options=quoteKqMarketRoutes({juryScore:5.8,harvestGrams:150,equipmentCodes,marketContext:{window:Math.floor(Date.now()/21600000),reputation,routeSales:{},recentSales:{raw:8},marketVolumes:{raw:20}}});
    const lot={flowerId:'flower-test-001',varietyCode:'test',varietyName:'Récolte des embruns',cultureSystemCode:'soil',cultureSystemName:'Terre vivante',cultureSystemTechnique:'Culture de démonstration',quality:75,harvestGrams:150,juryScore:5.8,qualityBand:'selection',equipmentCodes,options,status:'ready',selectedRoute:null,payoutCents:null,reputationGain:null,burnedAt:'2026-09-10',settledAt:null};
    const snapshot={cashCents:25000,electricityOutstandingCents:1377,reputation,reputationRank:12,ownedCodes:equipmentCodes,equippedCodes:equipmentCodes,routePlan:null,routeMasteries:[],equipmentSummary:{processingPrecision:30,processingCapacityPercent:50},lots:params.has('empty')?[]:[lot]};
    const originalFetch=window.fetch.bind(window);window.__sales=[];window.__failSale=false;
    window.fetch=async (url,init={})=>{
      if(url==='/api/arena/placard/market') {
        if(init.method==='POST') {
          const request=JSON.parse(init.body);window.__sales.push(request);await new Promise(r=>setTimeout(r,900));
          if(window.__failSale){window.__failSale=false;return new Response(JSON.stringify({error:'Vente refusée pour le test, réessaie.'}),{status:503});}
          const quote={...options.find(q=>q.route===request.route),payoutCents:request.expectedPayoutCents};snapshot.lots[0].status="sold";return new Response(JSON.stringify({receiptId:'receipt-001',flowerId:request.flowerId,route:request.route,payoutCents:quote.payoutCents,electricityPaidCents:1377,netPayoutCents:quote.payoutCents-1377,reputationGain:quote.reputationGain,cashAfterCents:snapshot.cashCents+quote.payoutCents-1377,reputationAfter:snapshot.reputation+quote.reputationGain,replayed:false,routeMastery:null,nextRouteGoal:null,nextEquipmentGoal:null,equipmentProgression:{catalogComplete:true,progressionComplete:true,remainingCount:0,alternativeCount:0}}));
        }
        return new Response(JSON.stringify(snapshot));
      }
      if(String(url).startsWith('/api/')) return new Response(JSON.stringify({error:'Données de progression indisponibles dans cette démonstration.'}),{status:503});
      return originalFetch(url,init);
    };
    params.set('view',params.has('hub')?'hub':params.has('game')?'game':'market');history.replaceState(null,'','?'+params);
    createRoot(document.getElementById('root')).render(React.createElement("div",{className:retro.surface},React.createElement(KqMarketDesk,{onOpenShop:()=>{}}),React.createElement("footer",{style:{height:1800,background:"#eee"}},"Pied de page permanent")));`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,{loading:Loading}){const Component=React.lazy(async()=>({default:await loader()}));return props=>React.createElement(React.Suspense,{fallback:React.createElement(Loading)},React.createElement(Component,props));}`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
};
const server=await createServer({root,cacheDir:resolve(output,"vite-cache"),optimizeDeps:{include:["react","react-dom/client","lucide-react"]},configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'workshop-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard · Atelier</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__workshop-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3199,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[],results=[];
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3199'))void r.continue();else void r.abort();});
 const shot=async name=>{await new Promise(r=>setTimeout(r,250));await page.screenshot({path:resolve(output,name+'.png')});};
 const layout=async()=>page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}));

 for(const width of [320,390,768,1440]){
  await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
  await page.goto('http://127.0.0.1:3199/',{waitUntil:'networkidle0'});
  await page.waitForSelector('[aria-label="Demande et prix"]');
  await page.click('button[aria-label="Lot brut · Disponible"]');
  assert.equal(await page.$eval('#market-machine-detail > article > button',e=>e.disabled),true);
  assert(await page.$eval('[aria-label="Demande et prix"]',e=>e.textContent.includes('Marché saturé')));
  await page.$eval('[aria-label="Demande et prix"]',e=>e.scrollIntoView({block:'center'}));
  await shot('saturation-'+width);
  await page.click('[aria-label="Demande et prix"] button:first-child');
  assert.equal(await page.$eval('#market-machine-detail > article > button',e=>e.disabled),false);
  assert(await page.$eval('[aria-label="Demande et prix"]',e=>e.textContent.includes('€')));
  const selectedPrice=await page.$eval('[aria-label="Demande et prix"] button[aria-pressed="true"] span',e=>e.textContent);
  await page.click('#market-machine-detail > article > button');
  await page.waitForSelector('[role="dialog"]');
  assert(await page.$eval('[role="dialog"]',e=>e.textContent.includes('Prix de déstockage')));
  assert(await page.$eval('[role="dialog"]', (e,price)=>e.textContent.includes(price),selectedPrice));
  await shot('confirmation-'+width);
  await page.click('[role="dialog"] footer button:last-child');
  await page.waitForFunction(()=>document.querySelector('[role="dialog"] h2')?.textContent==='Lot vendu',{timeout:12000});
  const request=await page.evaluate(()=>window.__sales.at(-1));
  assert.equal(request.pricePolicy,'clearance');
  assert(Number.isSafeInteger(request.expectedPayoutCents));
  assert(Number.isSafeInteger(request.marketWindow));
  assert.equal((await layout()).overflow,false);
  await shot('receipt-'+width);
  results.push({width,policy:request.pricePolicy,payoutCents:request.expectedPayoutCents});
 }
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.goto('http://127.0.0.1:3199/?loyal',{waitUntil:'networkidle0'});
 await page.waitForSelector('[aria-label="Demande et prix"]');
 await page.click('button[aria-label="Lot brut · Disponible"]');
 await page.click('[aria-label="Demande et prix"] button:nth-child(3)');
 assert.equal(await page.$eval('#market-machine-detail > article > button',e=>e.disabled),false);
 assert(await page.$eval('[aria-label="Demande et prix"]',e=>e.textContent.includes('prix ambitieux garanti')));
 await page.click('[aria-label="Demande et prix"] summary');
 assert.equal(await page.$$eval('[aria-label="Demande et prix"] li',items=>items.length),6);
 assert(await page.$eval('[aria-label="Demande et prix"] li[aria-current="step"]',e=>e.textContent.includes('1500+')));
 await page.$eval('[aria-label="Demande et prix"]',e=>e.scrollIntoView({block:'start'}));
 assert.equal((await layout()).overflow,false);
 await shot('reputation-tiers-390');
 await page.click('#market-machine-detail > article > button');
 await page.waitForSelector('[role="dialog"]');
 assert(await page.$eval('[role="dialog"]',e=>e.textContent.includes('Prix ambitieux')));
 await page.click('[role="dialog"] footer button:last-child');
 await page.waitForFunction(()=>document.querySelector('[role="dialog"] h2')?.textContent==='Lot vendu',{timeout:12000});
 const loyalRequest=await page.evaluate(()=>window.__sales.at(-1));
 assert.equal(loyalRequest.pricePolicy,'premium');
 results.push({width:390,reputation:1500,policy:loyalRequest.pricePolicy,payoutCents:loyalRequest.expectedPayoutCents});
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,errors},null,2));
 console.log(JSON.stringify({passed:true,results,output}));
}finally{await browser?.close();await server.close();}
