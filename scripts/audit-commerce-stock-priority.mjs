/** Real listing UI and simulator transitions at 320/390/1440. All data and commands stay in memory; external traffic is blocked. */
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), phase = process.env.KQ_PRIORITY_PHASE ?? 'after';
const output = resolve(root, 'output/clarity-lot3/commerce', phase);
const port = Number(process.env.KQ_STOCK_PRIORITY_PORT ?? 3494), origin = `http://127.0.0.1:${port}`;
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
window.setMerchInventory=rows=>{state.trial.commerce.online.merch.inventory=rows;api.notify('kq:storage-updated')};
function App(){
 const [section,setSection]=React.useState('overview'),[epoch,setEpoch]=React.useState(0),[flower,setFlower]=React.useState(),[listing,setListing]=React.useState();
 window.mount=(name,entry='overview',target)=>{scenario=name;state=structuredClone(name==='lots'?rawState:baseline);const row=state.trial.commerce.online.listings[0];
 if(['legacy','legacy-blocked'].includes(name))row.status='closed';
 if(['paused','paused-suspended'].includes(name))row.status='paused';
 if(['blocked','legacy-blocked'].includes(name)){row.qualityScore=5.7;if(name==='blocked')row.status='quality-blocked';}
 if(name.includes('suspended'))state.trial.commerce.online.site.active=false;
 if(name==='sold-out'){row.status='sold-out';row.remainingPackets=0;row.soldPackets=4;}
 if(name==='discarded'){row.status='discarded';row.remainingPackets=0;row.soldPackets=1;}
 if(name==='mixed')state.trial.commerce.online.listings=['active','paused','closed','quality-blocked','closed'].map((status,index)=>({...row,id:'listing-'+index,name:'Récolte '+index+' · Orange sanguine et fleurs de montagne',status,qualityScore:index>=3?5.7:7.6}));
 if(name==='empty')state.trial.commerce.online.listings=[];
 if(name==='normal')row.name='Orange sanguine et fleurs de montagne';
 if(name==='merch-stock'){state.trial.commerce.online.merch.modules=['paper'];state.trial.commerce.online.merch.inventory=[{code:'stickers',quantity:7,priceCents:493,active:true,sold:0,progress:0}]}
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
 const cancel=async()=>{await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true})};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});
  await page.waitForFunction(()=>typeof window.mount==='function');
  await page.addStyleTag({content:'@font-face{font-family:AuditDisplay;src:url("/src/app/fonts/BarlowCondensed-Latin-Black.woff2");font-weight:900}@font-face{font-family:AuditBody;src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}'});
  for(const mode of ['normal','mixed','empty','blocked','suspended']){
   await mount(mode,'dashboard');await page.waitForSelector('[data-online-listings-heading]');await settled();await page.evaluate(()=>document.fonts.ready);
   if(mode!=='empty')await page.waitForSelector(card);
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,300)));
   await fit(mode+'-'+width);
   const metrics=await page.evaluate(()=>{
    const visible=element=>element.getClientRects().length>0;
    const first=document.querySelector('[data-online-listing]');
    const primary=first&&[...first.querySelectorAll('button')].find(node=>node.textContent.includes('Modifier le prix'));
    const top=element=>element?Math.round(element.getBoundingClientRect().top+scrollY):null;
    const nav=document.querySelector('nav[aria-label="Commerce"]');
    const title=first?.querySelector('strong');
    const lastParagraph=first&&[...first.querySelectorAll(':scope > p')].at(-1);
    const paragraphActionGap=primary&&lastParagraph?Math.round(primary.getBoundingClientRect().top-lastParagraph.getBoundingClientRect().bottom):null;
    return {firstListingY:top(first),firstPriceActionY:top(primary),navigationHeight:Math.round(nav.getBoundingClientRect().height),documentHeight:document.documentElement.scrollHeight,
     paragraphActionGap,
     nameWidth:title?Math.round(title.getBoundingClientRect().width):null,
     headingsBeforeFirst:[...document.querySelectorAll('h1,h2,h3')].filter(node=>visible(node)&&getComputedStyle(node).position!=='absolute'&&(!first||top(node)<top(first))).map(node=>node.textContent),
     visibleControlsBeforeFirst:[...document.querySelectorAll('button,a,summary,input,select')].filter(node=>visible(node)&&(!first||top(node)<top(first))).map(node=>node.textContent.trim()),
     actions:first?[...first.querySelectorAll(':scope > div button')].filter(visible).map(node=>({text:node.textContent,height:Math.round(node.getBoundingClientRect().height)})):[]};
   });
   if(mode!=='empty'){
    const initial=await fixture();assert.equal(initial.online.listings[0].packetPriceCents,913);assert.equal(initial.online.listings[0].remainingPackets,4);
    await click('Modifier le prix',card);await page.waitForSelector(card+' input');
    assert.equal(await page.$eval(card+' input',node=>node.value),'9.13');
    await page.$eval(card+' input',node=>node.focus());assert.equal(await page.$eval(card+' input',node=>document.activeElement===node),true);
    await click('Fermer les prix',card);assert.deepEqual(await fixture(),initial);
    if(phase==='after'){
     const spacing=await page.$eval(card,node=>{const lastParagraph=[...node.querySelectorAll(':scope > p')].at(-1);const button=[...node.querySelectorAll('button')].find(item=>item.textContent.includes('Modifier le prix'));const css=getComputedStyle(button);return{gap:button.getBoundingClientRect().top-lastParagraph.getBoundingClientRect().bottom,focusExtent:parseFloat(css.outlineWidth)+parseFloat(css.outlineOffset)}});
     assert(spacing.gap>=14,'Actions keep a real 14 px gap after their explanation');assert(spacing.gap>spacing.focusExtent,'The focused button never overlaps the paragraph');
    }
   }
   assert.deepEqual(await page.evaluate(()=>window.posts),[]);
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await page.screenshot({path:resolve(output,mode+'-'+width+'-viewport.png')});await page.screenshot({path:resolve(output,mode+'-'+width+'-full.png'),fullPage:true});
   results.push({width,mode,...metrics});
  }
  await mount('mixed','dashboard');await page.waitForSelector(card);
  await click('En pause','[aria-label="Filtrer les annonces"]');assert.equal((await page.$$(card)).length,2);
  await page.evaluate(()=>window.setListingEntry('listing-3'));
  await page.waitForSelector('[data-online-listing="listing-3"] input');
  await page.waitForFunction(()=>document.activeElement?.closest('[data-online-listing]')?.getAttribute('data-online-listing')==='listing-3');
  await fit('target-'+width);assert.deepEqual(await page.evaluate(()=>window.posts),[]);
  await page.screenshot({path:resolve(output,'target-'+width+'-viewport.png')});
  await mount('normal','dashboard');await page.waitForSelector(card);
  await click('Mettre en pause',card);await page.waitForSelector('dialog[open]');assert.match(await page.$eval('dialog',node=>node.textContent),/progression.*zéro/);await cancel();
  await mount('legacy','dashboard');await page.waitForSelector(card);await click('Reprendre la vente',card);await page.waitForSelector('dialog[open]');
  assert.match(await page.$eval('dialog',node=>node.textContent),/4 paquets.*9,13/);await cancel();
  assert.deepEqual(await page.evaluate(()=>window.posts),[]);
  await mount('normal','dashboard');await page.waitForSelector(card);await click(phase==='after'?'Produits dérivés':'Merch');await page.waitForFunction(()=>document.querySelector('[data-merch-activity]').getClientRects().length>0);
  if(phase==='after')assert.match(await page.evaluate(()=>document.activeElement?.textContent??''),/^Produits dérivés/,'Opening the secondary destination transfers keyboard focus to its selected control');
  await fit('merch-'+width);await page.screenshot({path:resolve(output,'merch-'+width+'-viewport.png')});
  await click('Fleurs et extraits');await page.waitForFunction(()=>document.querySelector('[data-online-listing]').getClientRects().length>0);
  await click('Préparer une nouvelle annonce');await page.waitForFunction(()=>window.navigation.some(entry=>entry.section==='sales'));
  assert.deepEqual(await page.evaluate(()=>window.posts),[]);
  if(phase==='after'){
   await mount('merch-stock','dashboard');await page.waitForSelector('[aria-label="Choisir un rayon"]');
   assert.match(await page.$eval('[aria-label="Choisir un rayon"]',node=>node.textContent),/Fleurs et extraits4 paquetsProduits dérivés7 articles/);
   assert.match(await page.$eval('[data-online-listings-heading]',node=>node.textContent),/4 paquets · 20 g/);
   await click('Produits dérivés','[aria-label="Choisir un rayon"]');await page.waitForSelector('[data-merch-code="stickers"]');
   assert.match(await page.$eval('[data-merch-code="stickers"]',node=>node.textContent),/7 en stock.*4,93/);
   await page.evaluate(()=>window.setMerchInventory([]));
   await page.waitForFunction(()=>document.querySelector('[aria-label="Choisir un rayon"]').textContent.includes('Produits dérivés0 articles'));
   assert.equal(await page.$eval('[data-merch-activity]',node=>node.getClientRects().length>0),true,'Merch stays selected after the last reference disappears');
   assert.equal(await page.$$eval('[aria-label="Choisir un rayon"] button',nodes=>nodes.find(node=>node.textContent.startsWith('Produits dérivés')).getAttribute('aria-pressed')),'true');
   await fit('merch-cleared-'+width);await page.screenshot({path:resolve(output,'merch-cleared-'+width+'-viewport.png')});
   await click('Gérer mes produits dérivés','[data-merch-activity]');await page.waitForFunction(()=>window.navigation.some(entry=>entry.section==='management'));
   assert.deepEqual(await page.evaluate(()=>window.posts),[]);
  }
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),phase,viewportHeight:844,scope:'KqMarketHub component with real descendants, without global HUD; same in-memory fixtures in both phases',results,keyboardScenarios:phase==='after'?21:15,merchSelectionSurvivesEmptyInventory:phase==='after',errors,localOnly:true},null,2));
 if(phase==='after'){
  const before=JSON.parse(await readFile(resolve(output,'../before/report.json'),'utf8'));
  const comparison=results.map(row=>{const old=before.results.find(item=>item.width===row.width&&item.mode===row.mode);return{width:row.width,mode:row.mode,firstListingBefore:old.firstListingY,firstListingAfter:row.firstListingY,priceActionBefore:old.firstPriceActionY,priceActionAfter:row.firstPriceActionY,controlsBefore:old.visibleControlsBeforeFirst.length,controlsAfter:row.visibleControlsBeforeFirst.length}});
  await writeFile(resolve(output,'../comparison.json'),JSON.stringify(comparison,null,2));
 }
 console.log(JSON.stringify({phase,observations:results.length,keyboardScenarios:phase==='after'?21:15,errors}));
}finally{await browser?.close();await server.close()}
