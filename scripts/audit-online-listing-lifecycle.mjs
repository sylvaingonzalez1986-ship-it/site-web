/** Real listing UI and simulator transitions at 320/390/1440. All data and commands stay in memory; external traffic is blocked. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/online-listing-lifecycle');
const port = Number(process.env.KQ_LISTING_LIFECYCLE_PORT ?? 3491), origin = `http://127.0.0.1:${port}`;
const modules = {
  entry: `import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import {KqMarketHub} from '/src/components/placard/KqMarketHub';
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
window.fixture=()=>structuredClone(getKqOperationsCommerce(state));
const api=createKqTutorialApi(async(input,init={})=>{
 const url=new URL(String(input),location.origin),method=init.method??'GET';
 if(!url.pathname.startsWith('/api/arena/placard/'))throw new Error('Unexpected request');
 const body=typeof init.body==='string'?JSON.parse(init.body):undefined;
 if(method!=='GET')window.posts.push(body);
 try{const result=applyKqOperationsRequest(state,{path:url.pathname+url.search,method,body});state=result.state;
  const payload=result.payload;
  return Response.json(payload);
 }catch(error){return Response.json({error:error.message},{status:400})}
});
function App(){
 const [section,setSection]=React.useState('overview'),[epoch,setEpoch]=React.useState(0),[flower,setFlower]=React.useState(),[listing,setListing]=React.useState();
 window.mount=(name,entry='overview',target)=>{scenario=name;state=structuredClone(name==='lots'?rawState:baseline);const row=state.trial.commerce.online.listings[0];
 if(['legacy','legacy-blocked'].includes(name))row.status='closed';
 if(['paused','paused-suspended'].includes(name))row.status='paused';
 if(['blocked','legacy-blocked'].includes(name)){row.qualityScore=5.7;if(name==='blocked')row.status='quality-blocked';}
 if(name.includes('suspended'))state.trial.commerce.online.site.active=false;
 if(name==='sold-out'){row.status='sold-out';row.remainingPackets=0;row.soldPackets=4;}
 if(name==='discarded'){row.status='discarded';row.remainingPackets=0;row.soldPackets=1;}
 if(name==='mixed')state.trial.commerce.online.listings=['active','paused','closed','quality-blocked','closed'].map((status,index)=>({...row,id:'listing-'+index,name:'Récolte '+index,status,qualityScore:index>=3?5.7:7.6}));
 window.posts=[];window.navigation=[];setSection(entry);setFlower(target==='flower'?raw.flowerId:undefined);setListing(target==='listing'?listingId:undefined);setEpoch(value=>value+1)};
 window.setListingEntry=id=>{setListing(id);setSection('dashboard')};
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

try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||url.protocol==='data:')void request.continue();else void request.abort()});
 const click=async(label,scope='body')=>{const handle=await page.evaluateHandle(({label,scope})=>[...document.querySelectorAll(scope+' button, '+scope+' a, '+scope+' summary')].find(element=>element.getClientRects().length&&element.textContent.trim().startsWith(label)),{label,scope});const element=handle.asElement();assert(element,'Missing visible control: '+label);await element.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await element.focus();await page.keyboard.press('Enter');await handle.dispose()};
 const settled=async()=>{await page.waitForFunction(()=>!document.body.textContent.includes('Ouverture de ta boutique…')&&!document.body.textContent.includes('Ouverture du comptoir…'))};
 const mount=async(name,entry='overview',target)=>{await page.evaluate(({name,entry,target})=>window.mount(name,entry,target),{name,entry,target});await settled()};
 const fit=async(label)=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.visualViewport.width+1),false,label+' fits viewport');


 const card='[data-online-listing]';
 const fixture=()=>page.evaluate(()=>window.fixture());
 const fixed=snapshot=>({cash:snapshot.cashCents,stocks:snapshot.stocks,packaging:snapshot.online.packaging,stats:snapshot.online.stats,sales:snapshot.online.recentSales});
 const status=()=>page.$eval(card+' > div:first-child [data-state]',node=>node.textContent);
 const cancel=async()=>{await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true})};
 const confirm=async()=>{await click('Confirmer','dialog[open]');await page.waitForSelector('dialog[open]',{hidden:true})};
 const snapshot=async name=>{await fit(name);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:resolve(output,name+'.png'),fullPage:true})};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});
  await page.waitForFunction(()=>typeof window.mount==='function');
  await page.addStyleTag({content:'@font-face{font-family:AuditDisplay;src:url("/src/app/fonts/BarlowCondensed-Latin-Black.woff2");font-weight:900}@font-face{font-family:AuditBody;src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}'});
  for(const mode of ['normal','legacy']){
   await mount(mode,'dashboard');await page.waitForSelector(card);await page.evaluate(()=>document.fonts.ready);
   const initial=await fixture();assert.equal(initial.online.listings[0].status,mode==='legacy'?'closed':'active');
   assert.equal(await status(),mode==='legacy'?'En pause':'En vente');
   assert.equal(await page.$$eval(card+' button',nodes=>nodes.some(node=>node.textContent.includes('Retirer du rayon'))),false,'No duplicate stop control');
   if(mode==='normal'){
    await click('Mettre en pause',card);await page.waitForSelector('dialog[open]');assert.match(await page.$eval('dialog[open]',node=>node.textContent),/progression.*zéro/);
    assert.equal((await page.evaluate(()=>window.posts)).length,0);await cancel();assert.deepEqual(await fixture(),initial);
    await click('Mettre en pause',card);await page.waitForSelector('dialog[open]');await confirm();
    await page.waitForFunction(()=>window.fixture().online.listings[0].status==='paused');
    assert.equal(await status(),'En pause');assert.deepEqual(fixed(await fixture()),fixed(initial));
   }
   await snapshot(mode+'-paused-'+width);
   await click('Reprendre la vente',card);await page.waitForSelector('dialog[open]');
   const resumeText=await page.$eval('dialog[open]',node=>node.textContent);assert.match(resumeText,/4 paquets/);assert.match(resumeText,/9,13/);assert.match(resumeText,/progression.*zéro/);
   await confirm();await page.waitForFunction(()=>window.fixture().online.listings[0].status==='active');assert.equal(await status(),'En vente');
   const resumed=await fixture();assert.deepEqual(fixed(resumed),fixed(initial));assert.equal(resumed.online.listings[0].remainingPackets,4);assert.equal(resumed.online.listings[0].packetPriceCents,913);
   await click('Jeter les paquets',card+' details');await click('Jeter définitivement les paquets',card);await page.waitForSelector('dialog[open]');
   const discardText=await page.$eval('dialog[open]',node=>node.textContent);assert.match(discardText,/4 paquets.*20 g/);assert.match(discardText,/sans remboursement/);assert.match(discardText,/irréversible/);
   await cancel();assert.deepEqual(await fixture(),resumed,'Cancel preserves all stock');
   await click('Jeter définitivement les paquets',card);await page.waitForSelector('dialog[open]');await snapshot(mode+'-discard-confirm-'+width);await confirm();
   await page.waitForFunction(()=>window.fixture().online.listings[0].status==='discarded');await page.waitForSelector(card,{hidden:true});
   const discarded=await fixture();assert.equal(discarded.online.listings[0].remainingPackets,0);assert.equal(discarded.online.listings[0].soldPackets,0);assert.deepEqual(fixed(discarded),fixed(initial));
   assert.deepEqual(await page.evaluate(()=>window.posts.map(body=>body.command)),mode==='legacy'?['resume-listing','discard-listing']:['pause-listing','resume-listing','discard-listing']);
   results.push({width,mode,pauseAndLegacyResume:true,discardConfirmation:true,noRefundOrHistoryChange:true});
  }
  for(const mode of ['blocked','legacy-blocked','suspended','paused-suspended','sold-out','discarded']){
   await mount(mode,'dashboard');await page.waitForSelector('[data-online-listings-heading]');await settled();
   if(mode==='sold-out'||mode==='discarded')assert.equal(await page.$(card),null,'Finished packets have no resumable card');
   else{
    await page.waitForSelector(card);assert.equal(await status(),mode.includes('blocked')?'Qualité insuffisante':mode==='suspended'?'Ventes suspendues':'En pause');
    assert.equal(await page.$$eval(card+' button',nodes=>nodes.some(node=>node.textContent==='Reprendre la vente'&&!node.disabled)),false,'Blocked states cannot resume');
    if(mode==='legacy-blocked')assert(await page.$$eval(card+' button',nodes=>nodes.some(node=>node.disabled&&node.textContent==='Qualité insuffisante')));
    if(mode==='paused-suspended')assert(await page.$$eval(card+' button',nodes=>nodes.some(node=>node.disabled&&node.textContent==='Boutique à réactiver')));
   }
   await snapshot(mode+'-'+width);assert.deepEqual(await page.evaluate(()=>window.posts),[]);results.push({width,mode,readOnly:true,blockingStateClear:true});
  }
  await mount('mixed','dashboard');await page.waitForSelector('[aria-label="Filtrer les annonces"]');
  assert.deepEqual(await page.$$eval('[aria-label="Filtrer les annonces"] button',nodes=>nodes.map(node=>node.textContent)),['Toutes5','En vente1','En pause2','À vérifier2']);
  await click('En pause','[aria-label="Filtrer les annonces"]');assert.equal(await page.$$(card).then(nodes=>nodes.length),2);
  await click('Bilan des paquets et des ventes');
  assert.equal(await page.$$eval('[aria-label="Stock des paquets"] dt',nodes=>nodes.some(node=>node.textContent.includes('Retir'))),false);
  assert.equal(await page.$$eval('[aria-label="Stock des paquets"] > div',nodes=>nodes.find(node=>node.querySelector('dt').textContent==='En pause / suspendus').querySelector('dd').textContent),'8');
  await snapshot('mixed-paused-'+width);assert.deepEqual(await page.evaluate(()=>window.posts),[]);results.push({width,mode:'mixed',legacyGroupedWithPause:true,qualityBeforePause:true});
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors,localOnly:true},null,2));console.log(JSON.stringify({passed:results.length,errors}));
}finally{await browser?.close();await server.close()}
