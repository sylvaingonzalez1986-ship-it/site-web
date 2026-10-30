/** Listing-card readability at 320/390/1440. Local tutorial fixtures only; payment and listing commands are never confirmed. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/online-listing-readability', process.argv.includes('--before') ? 'before' : 'after');
const port = Number(process.env.KQ_LISTING_READABILITY_PORT ?? 3419), origin = `http://127.0.0.1:${port}`;
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
const api=createKqTutorialApi(async(input,init={})=>{
 const url=new URL(String(input),location.origin),method=init.method??'GET';
 if(!url.pathname.startsWith('/api/arena/placard/'))throw new Error('Unexpected request');
 const body=typeof init.body==='string'?JSON.parse(init.body):undefined;
 if(method!=='GET')window.posts.push(body);
 try{const result=applyKqOperationsRequest(state,{path:url.pathname+url.search,method,body});state=result.state;
  const payload=result.payload;
  if(method==='GET'&&url.pathname==='/api/arena/placard/commerce'){
   if(scenario!=='empty'&&scenario!=='unknown'){
    const item=payload.online.listings[0];
    if(scenario!=='original')item.name='White Widow CBD — Récolte de Sylvain, sélection des fleurs de la serre';
    if(scenario==='paused')item.status='paused';
    if(scenario==='blocked'){item.status='quality-blocked';item.qualityScore=5;}
    if(scenario==='suspended')payload.online.site.active=false;
   }
   if(scenario==='empty'){payload.rawLots=[];payload.stocks=[];payload.online.listings=[];payload.online.merch.inventory=[]}
   if(scenario==='unknown'){delete payload.online.merch.inventory;payload.online.listings=[];payload.rawLots=[];payload.stocks=[]}
  }
  return Response.json(payload);
 }catch(error){return Response.json({error:error.message},{status:400})}
});
function App(){
 const [section,setSection]=React.useState('overview'),[epoch,setEpoch]=React.useState(0),[flower,setFlower]=React.useState(),[listing,setListing]=React.useState();
 window.mount=(name,entry='overview',target)=>{scenario=name;state=structuredClone(name==='lots'?rawState:baseline);window.posts=[];window.navigation=[];setSection(entry);setFlower(target==='flower'?raw.flowerId:undefined);setListing(target==='listing'?listingId:undefined);setEpoch(value=>value+1)};
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
const before=process.argv.includes('--before');
try{
 await mkdir(output,{recursive:true});await server.listen();
 browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||url.protocol==='data:')void request.continue();else void request.abort()});
 const click=async(label,scope='body')=>{const handle=await page.evaluateHandle(({label,scope})=>[...document.querySelectorAll(scope+' button, '+scope+' a, '+scope+' summary')].find(element=>element.getClientRects().length&&element.textContent.trim().startsWith(label)),{label,scope});const element=handle.asElement();assert(element,'Missing visible control: '+label);await element.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await element.focus();await page.keyboard.press('Enter');await handle.dispose()};
 const settled=async()=>{await page.waitForFunction(()=>!document.body.textContent.includes('Ouverture de ta boutique…')&&!document.body.textContent.includes('Ouverture du comptoir…'))};
 const mount=async(name,entry='overview',target)=>{await page.evaluate(({name,entry,target})=>window.mount(name,entry,target),{name,entry,target});await settled()};
 const fit=async(label)=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.visualViewport.width+1),false,label+' fits viewport');

 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await page.waitForSelector('[data-shop-overview]');
  await page.addStyleTag({content:'@font-face{font-family:AuditDisplay;src:url("/src/app/fonts/BarlowCondensed-Latin-Black.woff2");font-weight:900}@font-face{font-family:AuditBody;src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}:root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}'});
  for(const scenario of ['original','long-active','paused','blocked','suspended']){
   await mount(scenario,'dashboard');await page.waitForSelector('[data-online-listing]');await page.evaluate(()=>document.fonts.ready);
   const card=await page.$('[data-online-listing]');
   const measurement=await card.evaluate(element=>{
    const header=element.firstElementChild,title=header.querySelector('strong'),status=header.querySelector('[data-state]');
    const box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}};
    const font=node=>parseFloat(getComputedStyle(node).fontSize);
    const numbers=[...element.querySelector('dl').children].map(node=>({label:node.querySelector('dt').textContent,value:node.querySelector('dd').textContent.replace(/\s+/g,' ').trim()}));
    const controls=[...element.querySelectorAll('button')].filter(node=>node.checkVisibility()).map(node=>({label:node.textContent.trim(),...box(node)}));
    return {title:title.textContent,titleBox:box(title),titleFont:font(title),status:status.textContent,statusBox:box(status),statusFont:font(status),card:box(element),numbers,controls,numberFont:Math.min(...[...element.querySelector('dl').querySelectorAll('dt,dd,small')].map(font)),pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight};
   });
   await card.screenshot({path:resolve(output,scenario+'-'+width+'-card.png')});
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:resolve(output,scenario+'-'+width+'-full.png'),fullPage:true});
   if(!before){
    assert(measurement.pageWidth<=width+1,'No horizontal page overflow');
    assert(measurement.titleBox.width>=140,'Name retains readable width '+scenario+' '+width);
    assert(measurement.titleFont>=16&&measurement.statusFont>=14&&measurement.numberFont>=14,'Essential listing text is readable');
    assert(measurement.controls.every(control=>control.height>=44&&control.width>=44),'Action touch targets');
    if(width<=390)assert(measurement.statusBox.y>=measurement.titleBox.y+measurement.titleBox.height,'Status has its own mobile row');
    assert.deepEqual(measurement.numbers,[{label:'Prix TTC / paquet',value:'9,13 € · 1,83 €/g'},{label:'Paquets restants',value:'4 / 4 · 20 g'},{label:'Ventes réalisées',value:'0 paquet'}],'Prices and quantities match the unchanged fixture');
    assert.equal(measurement.status,{paused:'En pause',blocked:'Qualité insuffisante',suspended:'Ventes suspendues'}[scenario]??'En vente','Listing state unchanged');
    await click('Modifier le prix','[data-online-listing]');await page.waitForSelector('[data-online-listing] form input');
    assert.equal(await page.$eval('[data-online-listing] form input',node=>node.value),'9.13','Editor retains current price');
    await fit('Price editor');await click('Fermer','[data-online-listing] form');
    assert.match(await page.evaluate(()=>document.activeElement.textContent),/Modifier le prix/,'Closing editor restores focus');
    assert.notEqual(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none','Focus remains visible');
    if(scenario==='original'||scenario==='long-active'||scenario==='suspended'){
     await click('Mettre en pause','[data-online-listing]');await page.waitForSelector('dialog[open]');
     assert.match(await page.$eval('dialog[open]',node=>node.textContent),/Mettre l’annonce en pause/);await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true});
    }
    if(scenario==='paused'){
     await click('Reprendre la vente','[data-online-listing]');await page.waitForSelector('dialog[open]');
     assert.match(await page.$eval('dialog[open]',node=>node.textContent),/Reprendre la vente/);await page.keyboard.press('Escape');await page.waitForSelector('dialog[open]',{hidden:true});
    }
   }
   assert.deepEqual(await page.evaluate(()=>window.posts),[],'Observation and cancelled dialogs make no transaction');
   results.push({width,scenario,...measurement});console.log(JSON.stringify({width,scenario,titleWidth:Math.round(measurement.titleBox.width),cardHeight:Math.round(measurement.card.height)}));
  }
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({phase:before?'before':'after',results,errors},null,2));
}finally{await browser?.close();await server.close()}
