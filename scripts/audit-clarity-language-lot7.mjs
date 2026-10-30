/** Real shell, commerce and business tabs. Other destinations are explicit navigation fixtures; no API writes. */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(), output=resolve(root,'output/clarity-lot7');
const port=Number(process.env.KQ_CLARITY_LANGUAGE_PORT??3577), origin=`http://127.0.0.1:${port}`;
const observe=process.argv.includes('--observe'),phase=observe?'before':'after';
const stub=(name,body)=>`import React from 'react';export function ${name}(props){return <section data-destination="${name}"><p>Destination simulée pour la recette de navigation.</p>${body}</section>}`;
const destinations={
 './KqMarketDesk':`import React from 'react';import {KqMarketHub} from '/src/components/placard/KqMarketHub';export function KqMarketDesk(props){return <><KqMarketHub {...props}/><aside data-route-fixture aria-label="Commandes de recette"><button data-fixture-equipment onClick={()=>props.onOpenShop('COMPUTER',props.initialFlowerId)}>Recette : ouvrir le matériel</button><button data-fixture-storage onClick={()=>props.onOpenStorage(props.initialFlowerId)}>Recette : ouvrir le stockage</button></aside></>}`,
 './KqHarvests':stub('KqHarvests','<p data-harvest-flower>{props.initialFlowerId}</p><p data-harvest-section>{props.section}</p><button data-fixture-jury onClick={()=>props.onOpenArena(props.initialFlowerId)}>Présenter au jury</button><button data-fixture-overview onClick={()=>props.onSectionChange("overview",props.initialFlowerId)}>Vue des récoltes</button>'),
 './KqWarehouseEntry':stub('KqWarehouseEntry','<p data-warehouse-flower>{props.initialFlowerId}</p><p data-warehouse-section>{props.initialSection}</p>'),
 './KanabQuestDicePrototype':stub('KanabQuestDicePrototype','<p data-jury-flower>{props.initialFlowerId}</p>'),
 './KqSupportBoosterShop':stub('KqSupportBoosterShop','<p>Packs</p><button onClick={props.onExit}>Revenir</button>'),
};
const modules={
 'warehouse-assets': `export default ${await readFile(resolve(root,'public/placard/warehouse-v2/manifest.json'),'utf8')};`,
 entry:`import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {PlacardPlayerShell} from '/src/components/placard/PlacardPlayerShell';import{KqEquipmentInventoryModal}from'/src/components/placard/KqEquipmentInventoryModal';import retro from'/src/components/contest/ArenaRetro.module.css';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
let state=createKqOperationsLesson('market');const raw=getKqOperationsCommerce(state).rawLots[0];
const setup=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;};
setup({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
const stock=state.trial.commerce.stocks[0];setup({action:'online',command:'buy-packaging',payload:{code:'kraft-5',quantity:4}});
setup({action:'online',command:'create-listing',payload:{stockId:stock.id,formatGrams:5,packagingCode:'kraft-5',packets:4,packetPriceCents:913}});
state.trial.commerce.stocks.push({...structuredClone(stock),id:'fixture-second-stock',name:'Résidu de la même récolte · essai',route:'biomass',batchRoute:'raw',initialUnits:200,remainingUnits:200,equivalentUnits:200});
state.trial.commerce.online.merch.modules=['paper'];state.trial.commerce.online.merch.inventory=[{code:'stickers',quantity:7,priceCents:493,active:true,sold:0,progress:0}];
if(new URLSearchParams(location.search).get('fixture')==='brand-ready'){state.trial.commerce.online.upgrades.branding=true;state.trial.commerce.online.studio.levels.branding=1;}
if(new URLSearchParams(location.search).get('fixture')==='locked-products'){state.trial.commerce.online.merch.modules=[];state.trial.commerce.online.upgrades.branding=false;state.trial.commerce.online.studio.levels.branding=0;}
if(new URLSearchParams(location.search).get('fixture')==='merch-only'){state.trial.commerce.online.listings=[];state.trial.commerce.stocks=[];state.trial.commerce.rawLots=[];}
window.fixture={flower:raw.flowerId,lot:stock.id,listing:state.trial.commerce.online.listings[0]?.id};window.posts=[];window.requests=[];
const api=createKqTutorialApi(async(input,init={})=>{const url=new URL(String(input),location.origin),method=init.method??'GET';window.requests.push({path:url.pathname,method});
if(method!=='GET'){window.posts.push({path:url.pathname,method});return Response.json({error:'Recette en lecture seule'},{status:405});}
if(new URLSearchParams(location.search).get('fixture')==='unavailable'&&url.pathname==='/api/arena/placard/commerce')return Response.json({error:'Gestion indisponible pour cet essai'},{status:503});
try{const result=applyKqOperationsRequest(state,{path:url.pathname+url.search,method});state=result.state;return Response.json(result.payload);}catch(error){return Response.json({error:error.message},{status:400});}});
createRoot(document.getElementById('root')).render(<KqTutorialApiProvider api={api}>{new URLSearchParams(location.search).get('fixture')==='storage'?<div className={retro.surface}><KqEquipmentInventoryModal embedded initialSection="storage" ownedCodes={[]} purchasedCodes={[]} equippedCodes={[]} levels={{}} cashCents={50000} loading={false} loadError="" onClose={()=>{}} onOpenShop={()=>{}} onRetry={()=>{}}/></div>:<PlacardPlayerShell/>}</KqTutorialApiProvider>);`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
 'next/link':`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
 'next/navigation':`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{}});`,
 'next/dynamic':`import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
 ...Object.fromEntries(Object.entries(destinations).map(([key,value])=>['destination:'+key,value])),
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'commerce-navigation',enforce:'pre',resolveId(id,importer){if(id.endsWith('/public/placard/warehouse-v2/manifest.json'))return '\0warehouse-assets';if(importer?.replaceAll('\\','/').endsWith('/PlacardPlayerShell.tsx')&&id in destinations)return '\0destination:'+id;if(id in modules)return '\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['/','/arene/placard'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette navigation Commerce</title><style>@font-face{font-family:Display;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:Body;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>')})}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
// App fixtures preserve legacy URL keys; all interaction requests are read-only.
let browser;const results=[],errors=[],external=[],networkWrites=[];
try{
 await mkdir(resolve(output,phase),{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setRequestInterception(true);
 page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:')return void request.continue();if(url.origin!==origin){external.push(url.href);return void request.abort();}if(!['GET','HEAD'].includes(request.method())){networkWrites.push(url.pathname);return void request.abort();}void request.continue();});
 const visit=async query=>page.goto(`${origin}/arene/placard?${query}`,{waitUntil:'networkidle0'});
 const selected=async tab=>page.waitForSelector(`[data-shop-view="${tab}"][aria-selected="true"]`);
 const enter=async selector=>{const el=await page.waitForSelector(selector,{visible:true});await el.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await el.focus();assert.notEqual(await el.evaluate(e=>getComputedStyle(e).outlineStyle),'none');await page.keyboard.press('Enter');};
 const enterText=async text=>{const found=await page.waitForFunction(text=>[...document.querySelectorAll('button,a')].find(e=>e.checkVisibility()&&e.textContent.trim()===text),{},text);const element=found.asElement();await element.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await element.focus();await page.keyboard.press('Enter');};
 const measure=async(name,width)=>{
  await page.evaluate(()=>document.fonts.ready);
  const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,tabs:[...document.querySelectorAll('[data-shop-view]')].map(e=>{const r=e.getBoundingClientRect(),label=e.querySelector('strong'),lr=label.getBoundingClientRect();return{key:e.dataset.shopView,name:e.getAttribute('aria-label'),width:r.width,height:r.height,fontSize:getComputedStyle(label).fontSize,labelWidth:lr.width,labelHeight:lr.height,labelInside:lr.left>=r.left&&lr.right<=r.right&&lr.top>=r.top&&lr.bottom<=r.bottom,selected:e.getAttribute('aria-selected')};})}));
  assert.equal(metrics.overflow,false);assert(metrics.tabs.every(tab=>tab.height>=44&&tab.labelInside));
  if(!observe&&metrics.tabs.length)assert.equal(metrics.tabs.find(tab=>tab.key==='merch').name,'Produits dérivés');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(output,phase,`${name}-${width}-viewport.png`)});await page.screenshot({path:resolve(output,phase,`${name}-${width}-full.png`),fullPage:true});
  assert.deepEqual(await page.evaluate(()=>window.posts),[]);results.push({name,width,...metrics});
 };
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
  await visit('view=market&section=management&business=merch');await selected('merch');await page.waitForSelector('[data-merch-workshop]');await measure('develop-products',width);
  await page.focus('[data-shop-view="merch"]');await page.keyboard.press('Home');await selected('site');await page.keyboard.press('ArrowRight');await selected('brand');await page.keyboard.press('ArrowRight');await selected('merch');assert.equal(new URL(page.url()).searchParams.get('business'),'merch');
  await page.reload({waitUntil:'networkidle0'});await selected('merch');assert.equal(new URL(page.url()).searchParams.get('business'),'merch');
  await page.goBack();await selected('brand');await page.goForward();await selected('merch');
  await enter('[data-market-section="dashboard"]');await page.waitForSelector('[data-merch-activity]');
  await enter('[data-online-rayon="merch"]');await page.waitForSelector('[data-merch-activity]',{visible:true});await measure('stock-products',width);
  await enter('[data-open-merch]');await selected('merch');assert.equal(new URL(page.url()).searchParams.get('business'),'merch');await page.reload({waitUntil:'networkidle0'});await selected('merch');
  if(!observe){
   await visit('view=market&section=overview&fixture=merch-only');await page.waitForSelector('[data-open-merch]');await measure('overview-products',width);
   const hrefs=await page.$$eval('a[href*="section=management"]',nodes=>nodes.filter(e=>/dérivés/i.test(e.textContent)).map(e=>e.getAttribute('href')));assert(hrefs.length>0);assert(hrefs.every(href=>new URL(href,origin).searchParams.get('business')==='merch'));
   await enter('[data-open-merch]');await selected('merch');assert.equal(new URL(page.url()).searchParams.get('business'),'merch');
   await visit(hrefs[0].split('?')[1]);await selected('merch');await page.reload({waitUntil:'networkidle0'});await selected('merch');
   await visit('view=market&section=management&business=brand&fixture=brand-ready');await selected('brand');await enter('[data-studio-track="branding"]');await enterText('Voir les produits dérivés');await selected('merch');assert.equal(new URL(page.url()).searchParams.get('business'),'merch');
   await visit('view=market&section=management&business=merch&fixture=locked-products');await selected('merch');await enterText('Créer ma marque au Studio · 700 €');await selected('brand');assert.equal(new URL(page.url()).searchParams.get('business'),'brand');
   await enter('[data-shop-view="merch"]');await selected('merch');await enterText('Voir le site internet');await selected('site');assert.equal(new URL(page.url()).searchParams.get('business'),'site');
  }
  await visit('fixture=storage');await page.waitForSelector('[data-warehouse-storage]');await page.waitForFunction(()=>!document.querySelector('[data-warehouse-storage]')?.textContent.includes('Chargement des lots'));await measure('storage-help',width);
  const stages=await page.$$eval('[aria-label="Parcours de la récolte"] > *',nodes=>nodes.map(e=>e.textContent.trim()));
  const timeline=await page.$('[aria-label="Parcours de la récolte"]');await timeline.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.screenshot({path:resolve(output,phase,`storage-timeline-${width}-viewport.png`)});
  if(!observe){assert.deepEqual(stages,['Récolte','Rangement','Affinage · 6 heures réelles','Jury et duel','Vente']);assert.doesNotMatch(await page.$eval('[data-warehouse-storage]',e=>e.innerText),/curing/i);}
  results.push({name:'keyboard-reload-routes-storage-order',width,stages,internalKey:'merch'});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(networkWrites,[]);assert.deepEqual(external,[]);
 await writeFile(resolve(output,phase,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),scope:'Real Shell, Commerce, business tabs and embedded storage inventory; local fixtures; no API writes',viewportHeight:844,results,errors,networkWrites,external},null,2));console.log(JSON.stringify({phase,passed:results.length,errors,external,output}));
}catch(error){const pages=await browser?.pages();await pages?.at(-1)?.screenshot({path:resolve(output,phase,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{if(browser)await browser.close();await server.close();}
