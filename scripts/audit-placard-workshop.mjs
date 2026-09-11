/** Isolated real UI with synthetic lots: no credentials, no production writes. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(), output=resolve(root,'output/placard-workshop');
const modules={
  'workshop-entry': `import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {KqMarketDesk} from '/src/components/placard/KqMarketDesk'; import {KqPlacardLobby} from '/src/components/placard/KqPlacardLobby';
    import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
    import {quoteKqMarketRoutes} from '/src/lib/kanab-quest-market'; import {KQ_EQUIPMENT_CATALOG} from '/src/lib/kanab-quest-equipment';
    const params=new URLSearchParams(location.search);
    const equipmentCodes=['TENT-080-STARTER',KQ_EQUIPMENT_CATALOG.find(e=>e.unlocks.includes('dry-sift')).code];
    const options=quoteKqMarketRoutes({juryScore:7.5,harvestGrams:150,equipmentCodes});
    const lot={flowerId:'flower-test-001',varietyCode:'test',varietyName:'Récolte des embruns',cultureSystemCode:'soil',cultureSystemName:'Terre vivante',cultureSystemTechnique:'Culture de démonstration',quality:75,harvestGrams:150,juryScore:7.5,qualityBand:'selection',equipmentCodes,options,status:'ready',selectedRoute:null,payoutCents:null,reputationGain:null,burnedAt:'2026-09-10',settledAt:null};
    const snapshot={cashCents:25000,reputation:100,reputationRank:12,ownedCodes:equipmentCodes,equippedCodes:equipmentCodes,routePlan:null,routeMasteries:[],equipmentSummary:{processingPrecision:30,processingCapacityPercent:50},lots:params.has('empty')?[]:[lot]};
    const originalFetch=window.fetch.bind(window);window.__sales=[];window.__failSale=false;
    window.fetch=async (url,init={})=>{
      if(url==='/api/arena/placard/market') {
        if(init.method==='POST') {
          const request=JSON.parse(init.body);window.__sales.push(request);await new Promise(r=>setTimeout(r,900));
          if(window.__failSale){window.__failSale=false;return new Response(JSON.stringify({error:'Vente refusée pour le test, réessaie.'}),{status:503});}
          const quote=options.find(q=>q.route===request.route);return new Response(JSON.stringify({receiptId:'receipt-001',flowerId:request.flowerId,route:request.route,payoutCents:quote.payoutCents,reputationGain:quote.reputationGain,cashAfterCents:snapshot.cashCents+quote.payoutCents,reputationAfter:snapshot.reputation+quote.reputationGain,replayed:false,routeMastery:null,nextRouteGoal:null,nextEquipmentGoal:null,equipmentProgression:{catalogComplete:true,progressionComplete:true,remainingCount:0,alternativeCount:0}}));
        }
        return new Response(JSON.stringify(snapshot));
      }
      if(String(url).startsWith('/api/')) return new Response(JSON.stringify({error:'Données de progression indisponibles dans cette démonstration.'}),{status:503});
      return originalFetch(url,init);
    };
    function App(){const [view,setView]=React.useState(params.has('hub')?'hub':params.has('game')?'game':'market');return React.createElement(React.Fragment,null, view==='hub'?React.createElement(KqPlacardLobby,{onOpen:v=>{window.__opened=v;setView(v);},onOpenEquipment:()=>{window.__equipmentOpened=true;}}):view==='market'?React.createElement(KqMarketDesk,{onOpenShop:code=>{window.__equipmentOpened=code||true;}}):view==='game'?React.createElement(KanabQuestDicePrototype,{apiScope:'player',viewMode:'game',showAdminOperations:false}):React.createElement('p',null,'Destination : '+view));}
    createRoot(document.getElementById('root')).render(React.createElement(App));`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
};
const server=await createServer({root,cacheDir:resolve(output,"vite-cache"),optimizeDeps:{include:["react","react-dom/client","lucide-react"]},configFile:false,envDir:false,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'workshop-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard · Atelier</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__workshop-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3198,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;const errors=[],results=[];
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3198'))void r.continue();else void r.abort();});
 const shot=async name=>{await new Promise(r=>setTimeout(r,250));await page.screenshot({path:resolve(output,name+'.png')});};
 const layout=async()=>page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}));
 for(const width of [320,390,768,1440]){
  await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
  await page.goto('http://127.0.0.1:3198/?hub=1',{waitUntil:'networkidle0'});await page.waitForSelector('nav[aria-label="Activités du Placard"]',{timeout:60000});
  await shot('hub-'+width);
  await page.click('nav[aria-label="Activités du Placard"] button:nth-child(2)');await shot('hub-market-'+width);
  await page.locator('::-p-text(Ouvrir le marché)').click();await page.waitForSelector('[aria-label="Machines et filières"]');
  assert.equal(await page.$$eval('[aria-label="Machines et filières"] button',els=>els.length),10);
  assert.equal(await page.$$eval('#market-machine-detail > article',els=>els.length),1);
  await page.$eval('[aria-label="Atelier du lot sélectionné"]',el=>el.scrollIntoView({block:'center'}));await shot('market-'+width);
  await page.click('button[aria-label="Rosin Signature · Verrouillé"]');
  assert(await page.$eval('#market-machine-detail',e=>e.textContent.includes('Objectif prochaine récolte')));
  assert.equal(await page.$$eval('#market-machine-detail > article > button:disabled',els=>els.length),1);
  await shot('locked-'+width);
  await page.click('button[aria-label="Hash tamisé · Disponible"]');
  const check=await layout();assert.equal(check.overflow,false);assert.deepEqual(check.brokenImages,[]);
  await page.click('#market-machine-detail > article > button');await page.waitForSelector('[role="dialog"]');
  await shot('confirm-'+width);
  if(width===390)await page.evaluate(()=>{window.__failSale=true;});
  await page.click('[role="dialog"] footer button:last-child');await page.waitForSelector('[data-transformation][data-phase="working"]');
  await shot('transform-'+width);await page.keyboard.press('Escape');
  if(width===390){
    await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('Vente refusée'));
    assert.equal(await page.$$eval('[data-transformation]',els=>els.length),0);
    await page.click('[role="dialog"] footer button:last-child');
  }
  await page.waitForSelector('[data-transformation][data-phase="complete"]');await shot('success-'+width);
  await page.waitForSelector('#market-receipt-title');
  const sales=await page.evaluate(()=>window.__sales);assert.equal(sales.length,width===390?2:1);assert.equal(sales[0].route,'dry-sift');assert.equal(sales[0].flowerId,'flower-test-001');
  if(width===390)assert.equal(sales[0].requestKey,sales[1].requestKey);
  await page.keyboard.press('Escape');assert.equal(await page.$$eval('[role="dialog"]',els=>els.length),0);
  assert.equal(await page.$$eval('[aria-label="Machines et filières"]',els=>els.length),0);
  results.push({width,...check,saleConfirmed:true,retryKeepsKey:width===390});
 }
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.goto('http://127.0.0.1:3198/',{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Machines et filières"]');
 await page.click('button[aria-label="Hash tamisé · Disponible"]');await page.click('#market-machine-detail > article > button');await page.click('[role="dialog"] footer button:last-child');
 await page.waitForSelector('[data-transformation]');assert(await page.$$eval('[data-transformation] *',els=>els.every(e=>getComputedStyle(e).animationName==='none')));
 await page.waitForSelector('#market-receipt-title');await page.keyboard.press('Escape');
 await page.goto('http://127.0.0.1:3198/?empty=1',{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.textContent.includes('Le jury t’attend'));await shot('empty-390');
 assert.equal((await layout()).overflow,false);assert.deepEqual(errors,[]);
 for(const width of [320,390,1440]){
   await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
   await page.goto('http://127.0.0.1:3198/?game=1',{waitUntil:'networkidle0'});
   await page.waitForSelector('[data-view-mode="game"] h1');
   const guideClose=await page.$('button[aria-label="Fermer les règles"]');if(guideClose)await guideClose.click();
   await shot('culture-'+width);
   const hero=await page.$eval('h1',el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right};});assert(hero.left>=0&&hero.right<=width);
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,errors,empty:true,reducedMotion:true},null,2));console.log(JSON.stringify({passed:true,widths:results.map(r=>r.width),output}));
}finally{await browser?.close();await server.close();}
