/** Real Commerce components, local fixtures only. No game transaction or external network. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer,transformWithOxc} from 'vite';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root=process.cwd(),phase=process.env.KQ_GUIDANCE_PHASE??'after',port=3497,origin=`http://127.0.0.1:${port}`;
const output=resolve(root,'output/clarity-lot5/commerce',phase);
const modules={entry:`import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
import{KqMarketHub}from'/src/components/placard/KqMarketHub';
import{KqHarvestStorage}from'/src/components/placard/KqHarvestStorage';
import{KqTutorialApiProvider,createKqTutorialApi}from'/src/components/placard/KqTutorialApiContext';
import{createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce,getKqOperationsStorage}from'/src/lib/kanab-quest-operations-lesson';
let state=createKqOperationsLesson('market');const raw=getKqOperationsCommerce(state).rawLots[0],initial=structuredClone(state);
function execute(body){const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;}
execute({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
execute({action:'online',command:'buy-packaging',payload:{code:'kraft-5',quantity:4}});
execute({action:'online',command:'create-listing',payload:{stockId:state.trial.commerce.stocks[0].id,formatGrams:5,packagingCode:'kraft-5',packets:4,packetPriceCents:913}});
const packed=structuredClone(state);let commerce,storage,scenario='empty';window.posts=[];window.navigation=[];window.fixtureFlower=raw.flowerId;
const api=createKqTutorialApi(async(input,init={})=>{const path=new URL(String(input),location.origin).pathname;
 if(init.method&&init.method!=='GET'){window.posts.push(path);throw new Error('Transaction forbidden in this audit');}
 if(path.endsWith('/commerce'))return Response.json(commerce);
 if(path.endsWith('/storage'))return scenario==='loading'?new Promise(resolve=>{window.releaseStorage=()=>{scenario='empty';resolve(Response.json(storage))}}):scenario==='storage-error'?Response.json({error:'Stockage indisponible pendant cette observation.'},{status:503}):Response.json(storage);
 if(path.endsWith('/sales'))return Response.json({orders:[],nextCursor:null});
 const result=applyKqOperationsRequest(state,{path,method:'GET'});return Response.json(result.payload);
});
function configure(name){scenario=name;state=structuredClone(packed);commerce=structuredClone(getKqOperationsCommerce(state));storage=structuredClone(getKqOperationsStorage(state));
 commerce.rawLots=[];commerce.stocks=[];storage.lots=[];
 if(!['packets','missing','sold-out','discarded','target-paused'].includes(name))commerce.online.listings=[];
 if(['curing','overflow','jury','partial','queued','locked'].includes(name)){storage=structuredClone(getKqOperationsStorage(initial));const lot=storage.lots[0];lot.flowerStatus=['queued','locked'].includes(name)?name:'available';lot.varietyName='Orange sanguine';lot.projection.stage=['jury','queued','locked'].includes(name)?'ready':'curing';lot.projection.readyAt=new Date(Date.parse(storage.serverNow)+3600000).toISOString();lot.projection.capacity.overflowUnits=name==='overflow'?230:0;if(name==='partial')delete lot.projection.capacity;}
 if(name==='unopened'||name==='processing'){commerce=structuredClone(getKqOperationsCommerce(name==='unopened'?initial:packed));commerce.online.site.createdAt=null;commerce.online.site.active=false;commerce.online.listings=[];commerce.computerOwned=false;if(name==='processing'){commerce.stocks[0].processingReadyAt=new Date(Date.parse(storage.serverNow)+3600000).toISOString();}}
 if(name==='online-unknown')delete commerce.online;
 if(['sold-out','discarded','target-paused'].includes(name)){const target=commerce.online.listings[0];target.id='target-listing';if(name==='target-paused')target.status='paused';else{target.status=name;target.remainingPackets=0;target.soldPackets=name==='sold-out'?4:1;}commerce.online.listings.push({...target,id:'other-listing',name:'Autre variété',status:'active',remainingPackets:3});}
 window.posts=[];window.navigation=[];
}
configure('empty');
function App(){const[section,setSection]=React.useState('sales'),[listing,setListing]=React.useState(),[epoch,setEpoch]=React.useState(0),[storageTarget,setStorageTarget]=React.useState(null);
 window.mount=(name)=>{configure(name);setStorageTarget(null);setSection(['unopened','processing'].includes(name)?'overview':['missing','sold-out','discarded','target-paused'].includes(name)?'dashboard':'sales');setListing(['missing','sold-out','discarded','target-paused'].includes(name)?'target-listing':undefined);setEpoch(v=>v+1)};
 window.recover=()=>{scenario='empty';api.notify('kq:storage-updated')};window.currentTarget=()=>listing;
 return <KqTutorialApiProvider api={api}>{storageTarget?<KqHarvestStorage initialFlowerId={storageTarget.flowerId} onOpenMarket={()=>setStorageTarget(null)} onOpenOverview={()=>{}} onOpenArena={flowerId=>window.navigation.push({section:'arena',flowerId})} showWarehouseLink={false}/>:<KqMarketHub key={epoch} section={section} initialListingId={listing} onSectionChange={(next,id)=>{window.navigation.push({section:next,listingId:id});setSection(next);setListing(id)}} onOpenShop={()=>window.navigation.push({section:'equipment'})} onOpenCulture={()=>window.navigation.push({section:'culture'})} onOpenStorage={(flowerId,lotId)=>{window.navigation.push({section:'storage',flowerId,lotId});setStorageTarget({flowerId})}}/>}</KqTutorialApiProvider>;
}createRoot(document.getElementById('root')).render(<App/>);`,
'next/image':`import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return<img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
'next/link':`import React from'react';export default function Link({prefetch,scroll,replace,...props}){return<a {...props}/>} `,
'next/navigation':`export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);`};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},plugins:[{name:'commerce-guidance',enforce:'pre',resolveId(id){if(id in modules)return'\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>')})}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser;const results=[],errors=[];
try{await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});const page=await browser.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.origin===origin||u.protocol==='data:')void r.continue();else void r.abort()});
 const click=async(text,scope='body')=>{const handle=await page.evaluateHandle(({text,scope})=>[...document.querySelectorAll(scope+' button,'+scope+' a')].find(n=>n.getClientRects().length&&n.textContent.trim().startsWith(text)),{text,scope});const node=handle.asElement();assert(node,'Missing control '+text);await node.focus();await page.keyboard.press('Enter');await handle.dispose()};
 for(const width of[320,390,1440]){await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await page.waitForFunction(()=>typeof window.mount==='function');await page.addStyleTag({content:'@font-face{font-family:AuditDisplay;src:url("/src/app/fonts/BarlowCondensed-Latin-Black.woff2");font-weight:900}@font-face{font-family:AuditBody;src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}'});
 for(const name of phase==='before'?['empty','packets','curing','unopened','missing']:['empty','packets','curing','overflow','jury','partial','queued','locked','loading','storage-error','online-unknown','unopened','processing','missing','sold-out','discarded','target-paused']){
  await page.evaluate(name=>window.mount(name),name);await page.waitForFunction(()=>!document.body.textContent.includes('Ouverture du comptoir…')&&!document.body.textContent.includes('Ouverture de ta boutique…'));await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>setTimeout(r,150)));await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name}-${width} fits`);
  const content=await page.evaluate(()=>document.body.textContent);const metrics=await page.evaluate(()=>({height:document.documentElement.scrollHeight,actionY:(()=>{const n=document.querySelector('[data-commerce-empty] a, [aria-label="La prochaine étape de ma boutique"] a,[data-missing-listing]');return n?Math.round(n.getBoundingClientRect().top+scrollY):null})()}));
  await page.screenshot({path:resolve(output,name+'-'+width+'.png'),fullPage:true});
  if(phase==='after'){
   if(['curing','overflow','jury','partial','queued','locked'].includes(name)){assert.match(content,/Orange sanguine/);await click(name==='overflow'?'Ranger cette récolte':'Retrouver cette récolte');assert.deepEqual(await page.evaluate(()=>window.navigation.at(-1)),{section:'storage',flowerId:await page.evaluate(()=>window.fixtureFlower)});await page.waitForFunction(()=>document.querySelector('[data-conservation-lot]'));assert.equal(await page.$eval('[data-conservation-lot][data-selected]',node=>node.getAttribute('data-conservation-lot')),await page.evaluate(()=>window.fixtureFlower));if(['queued','locked'].includes(name)){await click('Suivre le duel');assert.deepEqual(await page.evaluate(()=>window.navigation.at(-1)),{section:'arena',flowerId:await page.evaluate(()=>window.fixtureFlower)});}}
   if(name==='empty'){assert.match(content,/6 heures/);await click('Voir mes cultures','[data-commerce-empty]');assert.equal(await page.evaluate(()=>window.navigation.at(-1).section),'culture');}
   if(name==='packets'){assert.match(content,/4 paquets.*20 g/);await click('Voir mon stock en vente','[data-commerce-empty]');assert.equal(await page.evaluate(()=>window.navigation.at(-1).section),'dashboard');}
   if(name==='loading'){assert.match(content,/Vérification des récoltes/);assert.match(await page.$eval('[data-commerce-empty] a',n=>n.textContent),/^Vérifier mon stockage/);await page.evaluate(()=>window.releaseStorage());await page.waitForFunction(()=>document.querySelector('[data-commerce-empty] a')?.textContent.startsWith('Voir mes cultures'));}
   if(name==='storage-error'){assert.match(content,/Stockage indisponible/);assert.doesNotMatch(content,/Ta réserve est vide/);assert.match(await page.$eval('[data-commerce-empty] a',n=>n.textContent),/^Vérifier mon stockage/);await page.evaluate(()=>window.recover());await page.waitForFunction(()=>!document.querySelector('[data-commerce-empty] [role="alert"]'));}
   if(name==='online-unknown')assert.match(content,/paquets.*indisponible/i);
   if(name==='partial')assert.doesNotMatch(content,/0 g sans contenant/);
   if(name==='unopened'){assert.match(content,/Vendre mes lots/);await click('Vendre mes lots');assert.equal(await page.evaluate(()=>window.navigation.at(-1).section),'sales');}
   if(name==='processing')assert.doesNotMatch(await page.$eval('[aria-label="La prochaine étape de ma boutique"]',n=>n.textContent),/Vendre mes lots/);
   if(['missing','sold-out','discarded'].includes(name)){assert(await page.$('[data-missing-listing="target-listing"]'));assert.match(content,name==='missing'?/Annonce introuvable/:name==='sold-out'?/annonce est épuisée/:/paquets ont été jetés/);assert.equal(await page.$('[data-online-listing] input'),null);await click('Voir les autres annonces');assert.equal(await page.evaluate(()=>window.currentTarget()),'target-listing');}
   if(name==='target-paused'){assert.equal(await page.$('[data-missing-listing]'),null);assert(await page.$('[data-online-listing="target-listing"] input'));}
  }
  assert.deepEqual(await page.evaluate(()=>window.posts),[]);results.push({width,name,...metrics});
 }}assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({phase,results,errors,localOnly:true,transactions:0},null,2));console.log(JSON.stringify({phase,cases:results.length,errors}));
}finally{await browser?.close();await server.close()}
