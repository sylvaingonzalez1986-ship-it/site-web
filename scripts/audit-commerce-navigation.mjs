/** Real shell, commerce and business tabs. Other destinations are explicit navigation fixtures; no API writes. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/clarity-lot2/navigation');
const port=Number(process.env.KQ_COMMERCE_NAVIGATION_PORT??3443), origin=`http://127.0.0.1:${port}`;
const stub=(name,body)=>`import React from 'react';export function ${name}(props){return <section data-destination="${name}"><p>Destination simulée pour la recette de navigation.</p>${body}</section>}`;
const destinations={
 './KqMarketDesk':`import React from 'react';import {KqMarketHub} from '/src/components/placard/KqMarketHub';export function KqMarketDesk(props){return <><KqMarketHub {...props}/><aside data-route-fixture aria-label="Commandes de recette"><button data-fixture-equipment onClick={()=>props.onOpenShop('COMPUTER',props.initialFlowerId)}>Recette : ouvrir le matériel</button><button data-fixture-storage onClick={()=>props.onOpenStorage(props.initialFlowerId)}>Recette : ouvrir le stockage</button></aside></>}`,
 './KqHarvests':stub('KqHarvests','<p data-harvest-flower>{props.initialFlowerId}</p><p data-harvest-section>{props.section}</p><button data-fixture-jury onClick={()=>props.onOpenArena(props.initialFlowerId)}>Présenter au jury</button><button data-fixture-overview onClick={()=>props.onSectionChange("overview",props.initialFlowerId)}>Vue des récoltes</button>'),
 './KqWarehouseEntry':stub('KqWarehouseEntry','<p data-warehouse-flower>{props.initialFlowerId}</p><p data-warehouse-section>{props.initialSection}</p>'),
 './KanabQuestDicePrototype':stub('KanabQuestDicePrototype','<p data-jury-flower>{props.initialFlowerId}</p>'),
 './KqSupportBoosterShop':stub('KqSupportBoosterShop','<p>Packs</p><button onClick={props.onExit}>Revenir</button>'),
};
const modules={
 entry:`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {PlacardPlayerShell} from '/src/components/placard/PlacardPlayerShell';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
let state=createKqOperationsLesson('market');const raw=getKqOperationsCommerce(state).rawLots[0];
const setup=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;};
setup({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
const stock=state.trial.commerce.stocks[0];setup({action:'online',command:'buy-packaging',payload:{code:'kraft-5',quantity:4}});
setup({action:'online',command:'create-listing',payload:{stockId:stock.id,formatGrams:5,packagingCode:'kraft-5',packets:4,packetPriceCents:913}});
state.trial.commerce.stocks.push({...structuredClone(stock),id:'fixture-second-stock',name:'Résidu de la même récolte · essai',route:'biomass',batchRoute:'raw',initialUnits:200,remainingUnits:200,equivalentUnits:200});
window.fixture={flower:raw.flowerId,lot:stock.id,listing:state.trial.commerce.online.listings[0].id};window.posts=[];window.requests=[];
const api=createKqTutorialApi(async(input,init={})=>{const url=new URL(String(input),location.origin),method=init.method??'GET';window.requests.push({path:url.pathname,method});
if(method!=='GET'){window.posts.push({path:url.pathname,method});return Response.json({error:'Recette en lecture seule'},{status:405});}
if(new URLSearchParams(location.search).get('fixture')==='unavailable'&&url.pathname==='/api/arena/placard/commerce')return Response.json({error:'Gestion indisponible pour cet essai'},{status:503});
try{const result=applyKqOperationsRequest(state,{path:url.pathname+url.search,method});state=result.state;return Response.json(result.payload);}catch(error){return Response.json({error:error.message},{status:400});}});
createRoot(document.getElementById('root')).render(<KqTutorialApiProvider api={api}><PlacardPlayerShell/></KqTutorialApiProvider>);`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
 'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
 'next/navigation':`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{}});`,
 'next/dynamic':`import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
 ...Object.fromEntries(Object.entries(destinations).map(([key,value])=>['destination:'+key,value])),
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'commerce-navigation',enforce:'pre',resolveId(id,importer){if(importer?.replaceAll('\\','/').endsWith('/PlacardPlayerShell.tsx')&&id in destinations)return '\0destination:'+id;if(id in modules)return '\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['/','/arene/placard'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette navigation Commerce</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>')})}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser;const results=[],errors=[],external=[],networkWrites=[];
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(120000);page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setRequestInterception(true);
 page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:')return void request.continue();if(url.origin!==origin){external.push(url.href);return void request.abort();}if(!['GET','HEAD'].includes(request.method())){networkWrites.push(url.pathname);return void request.abort();}if(url.pathname.startsWith('/api/'))return void request.respond({status:200,contentType:'application/json',body:'{}'});void request.continue()});
 const visit=async query=>{await page.goto(`${origin}/arene/placard?${query}`,{waitUntil:'networkidle0'});};
 const selected=async tab=>page.waitForSelector(`[data-shop-view="${tab}"][aria-selected="true"]`);
 const click=async selector=>{const element=await page.waitForSelector(selector,{visible:true});await element.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await element.click()};
 const params=()=>new URL(page.url()).searchParams;
 const checkContext=(expected,prefix='')=>{for(const [key,value]of Object.entries(expected))assert.equal(params().get(prefix?prefix+key[0].toUpperCase()+key.slice(1):key),value,`${prefix}${key} preserved`)};
 const noWrites=async()=>assert.deepEqual(await page.evaluate(()=>window.posts),[],'Navigation never sends an operation');
 for(const width of process.argv.includes('--context-only')?[]:[320,390,1440]){
  console.log(`Navigation Commerce : ${width}px`);
  await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});
  await visit('view=market&section=management');await selected('site');
  const context=await page.evaluate(()=>window.fixture);
  const contextQuery=new URLSearchParams(context).toString();
  await visit(`view=market&section=management&business=site&${contextQuery}`);await selected('site');
  for(const tab of ['brand','merch','marketing']){await click(`[data-shop-view="${tab}"]`);await selected(tab);assert.equal(params().get('business'),tab);checkContext(context);await noWrites();}
  await page.goBack();await selected('merch');await page.goBack();await selected('brand');await page.goForward();await selected('merch');await page.goForward();await selected('marketing');
  await page.reload({waitUntil:'networkidle0'});await selected('marketing');checkContext(context);
  await page.focus('[data-shop-view="marketing"]');await page.keyboard.press('Home');await selected('site');assert.equal(params().get('business'),'site');await page.keyboard.press('End');await selected('marketing');
  await click('[data-fixture-equipment]');await page.waitForSelector('[data-destination="KqWarehouseEntry"]');checkContext(context,'from');assert.equal(params().get('fromBusiness'),'marketing');
  await page.reload({waitUntil:'networkidle0'});await click('[data-placard-back="market"]');await selected('marketing');checkContext(context);
  await click('[data-fixture-storage]');await page.waitForSelector('[data-destination="KqHarvests"]');assert.equal(params().get('from'),'market');checkContext(context,'from');assert.equal(params().get('section'),'storage');
  await page.reload({waitUntil:'networkidle0'});await click('[data-fixture-overview]');await click('[data-placard-back="market"]');await selected('marketing');checkContext(context);
  await click('[data-market-section="sales"]');await page.waitForSelector('[data-commerce-lot]');assert.equal(await page.$eval('[data-commerce-lot]',node=>node.dataset.commerceLot),context.lot);
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-commerce-lot]');assert.equal(await page.$eval('[data-commerce-lot]',node=>node.dataset.commerceLot),context.lot);
  await visit('view=market&section=sales');await page.waitForSelector('[aria-label="Tes lots"]');await click('[aria-label="Tes lots"] button:last-child');await page.waitForSelector('[data-commerce-lot="fixture-second-stock"]');assert.equal(params().get('lot'),'fixture-second-stock');
  await page.goBack();await page.waitForSelector('[aria-label="Tes lots"]');assert.equal(params().has('lot'),false);await page.goForward();await page.waitForSelector('[data-commerce-lot="fixture-second-stock"]');
  await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-commerce-lot="fixture-second-stock"]');
  await visit(`view=market&section=sales&business=marketing&${contextQuery}`);await page.waitForSelector('[data-commerce-lot]');
  await click('[data-market-section="management"]');await selected('marketing');
  await visit(`view=market&section=dashboard&${contextQuery}`);await page.waitForSelector('[data-online-listing] form');
  await click('[data-market-section="management"]');await selected('site');await click('[data-shop-view="merch"]');await page.goBack();await selected('site');await page.goBack();await page.waitForSelector('[data-online-listing] form');checkContext(context);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No document overflow');await noWrites();
  results.push({width,history:true,reload:true,keyboard:true,equipmentReturn:true,storageReturn:true,exactLot:true,sameFlowerVariants:true,targetedListing:true});
  await page.screenshot({path:resolve(output,`targeted-listing-${width}.png`),fullPage:true});
 }
 await visit('view=market&section=management&business=unknown');await selected('site');await noWrites();
 await visit('view=treasury&pole=management&business=brand');await selected('brand');assert.equal(params().get('view'),'market');assert.equal(params().get('section'),'management');
 await visit('view=market&section=management&business=marketing&fixture=unavailable');await page.waitForSelector('[role="alert"]');assert.match(await page.$eval('[role="alert"]',node=>node.textContent),/indisponible/);assert.equal(await page.$('[data-shop-view]'),null);assert.equal(params().get('business'),'marketing');await noWrites();
 await visit('view=market&section=sales&lot=unknown-stock');await page.waitForSelector('[data-commerce-missing-lot]');assert.equal(await page.$('[data-commerce-lot]'),null);await noWrites();
 await visit('view=harvests&section=storage&flower=fixture-flower');await click('[data-fixture-jury]');await page.waitForSelector('[data-jury-flower]');assert.equal(params().get('fromSection'),'storage');await click('[data-placard-back="harvests"]');assert.equal(params().get('flower'),'fixture-flower');assert.equal(params().get('section'),'storage');
 await visit('view=market&section=sales&flower=operations-lesson-flower');await page.waitForSelector('[data-commerce-lot="operations-stock"]');assert.equal(params().has('lot'),false,'Resolving a harvest does not rewrite the URL');
 await click('details:has([data-commerce-open-lot-storage]) > summary');await click('[data-commerce-open-lot-storage]');await page.waitForSelector('[data-harvest-flower]');assert.equal(params().get('fromLot'),'operations-stock','The real lot sheet passes the resolved product');
 await click('[data-placard-back="market"]');await page.waitForSelector('[data-commerce-lot="operations-stock"]');assert.equal(params().get('lot'),'operations-stock');
 await visit('view=market&section=demands&flower=operations-lesson-flower&lot=fixture-second-stock');await page.waitForSelector('[data-screen="demands"]');
 const historyBefore=await page.evaluate(()=>history.length);
 const browse=await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(node=>node.checkVisibility()&&node.textContent.trim()==='Voir mes lots'));await browse.asElement().click();await browse.dispose();
 await page.waitForSelector('[aria-label="Tes lots"]');assert.equal(params().get('section'),'sales');assert.equal(params().has('lot'),false);assert.equal(params().has('flower'),false);assert.equal(await page.evaluate(()=>history.length),historyBefore+1,'Browsing lots creates one navigation entry');
 await page.goBack();await page.waitForSelector('[data-screen="demands"]');assert.equal(params().get('lot'),'fixture-second-stock');await noWrites();
 await visit('view=market&section=sales&lot=unknown-stock');await page.waitForSelector('[data-commerce-missing-lot]');await click('[data-commerce-other-lots]');await page.waitForSelector('[aria-label="Tes lots"]');assert.equal(params().has('lot'),false);await page.goBack();await page.waitForSelector('[data-commerce-missing-lot]');await noWrites();
 assert.deepEqual(errors,[]);assert.deepEqual(networkWrites,[]);assert.deepEqual(external,[]);
 await writeFile(resolve(output,process.argv.includes('--context-only')?'context-report.json':'report.json'),JSON.stringify({results,unknownTabFallback:true,legacyRoute:true,unavailableData:true,missingLot:true,juryReturn:true,resolvedLotStorageLink:true,singleBrowseHistoryEntry:true,missingLotRecovery:true,errors,networkWrites,external},null,2));console.log(JSON.stringify({results,errors,networkWrites,external},null,2));
}finally{if(browser){const timer=setTimeout(()=>browser.process()?.kill(),5000);try{await browser.close();}finally{clearTimeout(timer);}}server.httpServer?.closeAllConnections();await server.close()}
