// Local browser integration: real collection, lobby, shop and profile; no remote writes.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { installPlacardCardShopFixture } from './fixtures/placard-card-shop.mjs';
const root=process.cwd(),output=resolve(root,"output/placard-collection"),collectionOnly=process.argv.includes('--collection-only');
const modules={
 "collection-entry":`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqBotteCollection} from '/src/components/placard/KqBotteCollection';
import {KqPlacardLobby} from '/src/components/placard/KqPlacardLobby';
import {KqSupportBoosterShop} from '/src/components/placard/KqSupportBoosterShop';
import {BotteAlbumCollection} from '/src/components/account/BotteAlbumCollection';
import {KqInventoryCarousel} from '/src/components/placard/KqInventoryCarousel';
import {KqSupportPackReveal} from '/src/components/placard/KqSupportPackOpening';
import {KQ_ACTIVE_CARDS as KQ_CARDS} from '/src/lib/kanab-quest-game';
import {getKqBuddieCultivationProfile} from '/src/lib/kanab-quest-buddie-cultivation';
const query=new URLSearchParams(location.search);(${installPlacardCardShopFixture.toString()})(KQ_CARDS,getKqBuddieCultivationProfile);
function App(){const [view,setView]=useState(query.get('view')||'hub'),[open,setOpen]=useState(false),[collectionKind,setCollectionKind]=useState('botte'),[shopKind,setShopKind]=useState('botte');return <>{view==='pack'?<section style={{height:'100dvh',position:'relative'}}><KqSupportPackReveal cards={KQ_CARDS.filter(c=>['BOTTE-037','BOTTE-039','BOTTE-041'].includes(c.code))} onClose={()=>setView('hub')}/></section>:view==='inventory'?<main style={{background:'#fffaf1',padding:16}}><KqInventoryCarousel inventory={Object.fromEntries(KQ_CARDS.map(c=>[c.code,1]))} selectedCodes={[]} onAdd={()=>{}} onRemove={()=>{}}/></main>:view==='hub'?<KqPlacardLobby onOpen={()=>setView('shop')} onOpenEquipment={()=>setView('shop')} onOpenCollection={(kind='botte')=>{setCollectionKind(kind);setOpen(true);}}/>:view==='profile'?<BotteAlbumCollection isAuthenticated/>:<KqSupportBoosterShop autoOpen initialSection={shopKind} onOpenCollection={(kind='botte')=>{setCollectionKind(kind);setOpen(true);}} onExit={()=>setView('hub')}/>} {open?<KqBotteCollection initialSection={collectionKind} onClose={()=>setOpen(false)} onOpenShop={(kind='botte')=>{setShopKind(kind);setOpen(false);setView('shop');}}/>:null}</>;}createRoot(document.getElementById('root')).render(<App/>);`,
 "next/image":`import React from 'react';export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 "@/components/navigation/NavigationLink":`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`,
 "next/link":`import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
 "next/navigation":`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),prefetch:()=>{}});`,
 "@/context/CartContext":`export const useCart=()=>({isAuthenticated:true,authLoading:false,user:{id:'local-audit'},refreshSession:async()=>{}});`,
 "next/dynamic":`import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(()=>load().then(defaultExport=>({default:defaultExport})));return props=><Suspense fallback={null}><C {...props}/></Suspense>;}`,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom/client','react-dom','lucide-react']},esbuild:{jsx:'automatic',loader:'tsx'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},
 plugins:[{name:'collection-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;if(id.endsWith('/context/CartContext'))return '\0@/context/CartContext';if(id.endsWith('/components/navigation/NavigationLink'))return '\0@/components/navigation/NavigationLink';},async load(id){if(id.startsWith('\0') && modules[id.slice(1)])return (await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__collection-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3206,strictPort:true,hmr:false,watch:null}});
let browser;const errors=[],results=[];
const album='dialog[aria-labelledby="botte-collection-title"]', detail='dialog[aria-labelledby="botte-detail-title"]',collectionPin='[data-map-building="collection"][data-arena-tour="collection"]';
try{
 await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
 const page=await browser.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await page.setRequestInterception(true);page.on('request',r=>{if(r.url().startsWith('http://127.0.0.1:3206')||r.url().startsWith('data:'))void r.continue();else void r.abort();});
 const clickText=async(text)=>{const handle=await page.evaluateHandle(text=>[...(document.querySelector('dialog[open]')||document).querySelectorAll('button')].find(b=>b.checkVisibility()&&b.textContent.trim()===text),text);assert.ok(handle.asElement(),text);await handle.asElement().click();};
 const visit=async(query='')=>{await page.goto('http://127.0.0.1:3206/?'+query,{waitUntil:'networkidle0'});};
 const open=async()=>{await page.waitForSelector(collectionPin+'[aria-haspopup="dialog"]');await page.locator('[data-map-label=collection]').click();await page.waitForSelector(album+'[open]');};
 const waitCards=async(n)=>{await page.waitForFunction((selector,n)=>document.querySelectorAll(selector+' button[data-card-code][data-owned]').length===n,{},album,n);};
 const snap=async(name)=>{await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:resolve(output,name+'.png')});};
 const buddiePanel='[data-collection-panel=buddies]', buddieCards= '[data-buddie-collection-card]';
 const waitBuddies=async(count)=>page.waitForFunction((selector,count)=>document.querySelectorAll(selector).length===count,{},buddieCards,count);
 const inspectBuddies=async(width)=>{
  await page.focus('[data-collection-tab=botte]');await page.keyboard.press('ArrowRight');await waitBuddies(3);
  assert.equal(await page.$eval('[data-collection-tab=buddies]',el=>el.getAttribute('aria-selected')),'true');
  assert.equal(await page.$eval(buddiePanel+' progress',el=>el.value),3);
  assert.equal(await page.$eval(buddiePanel,el=>el.scrollWidth>el.clientWidth+1),false);
  await snap('buddies-owned-'+width);
  await page.click('[data-buddie-collection-filter=duplicates]');await waitBuddies(1);
  await page.focus('[data-buddie-collection-card="HH2026-020"]');await page.keyboard.press('Enter');
  await page.waitForSelector('[data-buddie-collection-detail="HH2026-020"][open]');
  assert.ok(await page.$('[data-buddie-collection-profile="HH2026-020"]'));
  assert.equal(await page.$eval('[data-buddie-collection-detail]',el=>el.scrollWidth>el.clientWidth+1),false);
  await snap('buddie-detail-'+width);await page.keyboard.press('Escape');
  await page.waitForSelector('[data-buddie-collection-detail]',{hidden:true});
  assert.equal(await page.$eval(album,el=>el.open),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-buddie-collection-card')),'HH2026-020');
  await page.click('[data-buddie-collection-filter=all]');await waitBuddies(52);
  await page.select(buddiePanel+' select','legendary');await waitBuddies(1);
  await page.click(buddieCards);await page.waitForSelector('[data-buddie-collection-detail="HH2026-001"][open]');
  assert.equal(await page.$('[data-buddie-collection-profile]'),null,'Missing Buddies keep their identity/profile undisclosed');
  await page.keyboard.press('Escape');await page.select(buddiePanel+' select','all');
  await page.click('[data-buddie-collection-filter=missing]');await waitBuddies(49);
  await page.type('[aria-label="Rechercher un Buddie"]','HH2026-052');await waitBuddies(1);
  await snap('buddies-missing-'+width);
  await page.click('[data-collection-tab=botte]');
 };
 for(const [width,height]of(collectionOnly?[[320,740],[390,844],[1440,1000]]:[[320,740],[390,844],[768,1024],[1440,1000],[844,390]])){
  await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await visit();await snap('entry-'+width);await open();await clickText('Album complet 30');await waitCards(30);
  assert.equal(await page.$$eval(album+' [data-owned=true]',els=>els.length),3);
  assert.equal(await page.$eval(album+' progress',el=>el.value),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.$eval(album,el=>el.scrollWidth>el.clientWidth+1),false);
  await snap('album-'+width);assert.equal(await page.$$eval(album+' button[data-card-code] img',els=>els.every(img=>img.complete&&img.naturalWidth>0)),true,'Every active card artwork must load');
  await page.select('[aria-label="Filtrer par rareté"]','epic');await waitCards(4);assert.equal(await page.$$eval(album+' [data-rarity=epic]',els=>els.filter(el=>el.matches('button')).length),4);await snap('epics-'+width);await page.select('[aria-label="Filtrer par rareté"]','all');await waitCards(30);
  assert.equal(await page.$$eval(album+' button[data-card-code]',els=>els.some(el=>['BOTTE-002','BOTTE-004','BOTTE-010','BOTTE-011','BOTTE-012','BOTTE-022','BOTTE-023','BOTTE-025'].includes(el.dataset.cardCode))),false);
  await clickText('Manquantes 27');await waitCards(27);await page.click(album+' button[data-owned=false]');await page.waitForSelector(detail+'[open]');
  assert.equal(await page.$eval(detail,el=>el.textContent.includes('Cette carte te manque')),true);
  assert.equal(await page.$eval(detail,el=>el.scrollWidth>el.clientWidth+1),false);
  await snap('detail-'+width);await page.keyboard.press('Escape');await page.waitForSelector(detail,{hidden:true});assert.equal(await page.$eval(album,d=>d.open),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.matches('button[data-owned=false]')),true);
  await clickText('Mes cartes 3');await waitCards(3);await page.type('[aria-label="Rechercher une carte"]','ombrage');await waitCards(1);await page.click(album+' button[data-owned=true]');await page.waitForSelector(detail+'[open]');
  assert.equal(await page.$eval(detail,el=>el.textContent.includes('3 exemplaires en stock')),true);
  await page.click('button[aria-label="Fermer la carte agrandie"]');await inspectBuddies(width);await page.keyboard.press('Escape');await page.waitForSelector(album,{hidden:true});
  await page.waitForFunction(selector=>document.activeElement?.matches(selector),{},collectionPin);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');results.push({width,height,owned:3,missing:27,zoom:true,focusRestored:true});
 }
 await page.setViewport({width:390,height:844});await visit();await open();await waitCards(3);assert((await page.$eval(album+' footer button',el=>el.textContent)).includes('La Boutique'));await page.locator(album+' footer button').click();await page.waitForSelector('[aria-label="Quitter la boutique"]');assert.equal(await page.$(album+'[open]'),null);await snap('map-collection-to-shop');
 await visit('view=shop');await snap('shop-entry');await clickText('Collections');await waitCards(3);await snap('shop-album');await page.keyboard.press('Escape');await page.waitForSelector(album,{hidden:true});assert.ok(await page.$('[aria-label="Quitter la boutique"]'));assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');assert.equal(await page.evaluate(()=>document.activeElement?.textContent.trim()),'Collections');
 await visit('fail');await open();await page.waitForSelector(album+' [role=alert]');assert.equal(await page.$$eval(album+' button[data-card-code][data-owned]',els=>els.length),0);await page.evaluate(()=>window.__fixture.failCollection=false);await clickText('Réessayer');await waitCards(3);
 await page.evaluate(()=>{window.__counts['BOTTE-005']=1;window.dispatchEvent(new Event('kq:collection-updated'));});await page.waitForFunction(()=>document.querySelector('dialog progress')?.value===4);
 await visit('empty');await open();await waitCards(0);assert.equal(await page.$eval(album+' progress',el=>el.value),0);await clickText('Mes cartes 0');await waitCards(0);await clickText('Manquantes 30');await waitCards(30);await page.click(album+' button[data-owned=false]');await page.waitForSelector(detail+'[open]');await page.mouse.click(2,2);await page.waitForSelector(detail,{hidden:true});assert.equal(await page.$eval(album,d=>d.open),true);
 await visit('complete');await open();await waitCards(30);await clickText('Manquantes 0');await page.waitForFunction(()=>document.querySelector('dialog')?.textContent.includes('Tu possèdes toutes les cartes'));
 await visit('view=profile');await page.waitForSelector('button[aria-label="Agrandir Brassage ajusté"]');await page.click('button[aria-label="Agrandir Brassage ajusté"]');await page.waitForSelector(detail+'[open]');assert.equal(await page.$eval(detail,el=>el.textContent.includes('2 exemplaires en stock')),true);await page.keyboard.press('Escape');
 for(const width of [320,1440]){
  await page.setViewport({width,height:900});await visit('view=pack');await page.waitForSelector('[data-support-pack-reveal] article');assert.equal(await page.$$eval('[data-support-pack-reveal] article',els=>els.length),3);assert.equal(await page.$$eval('[data-support-pack-reveal] article[data-rarity=epic]',els=>els.every(el=>el.textContent.includes('Une épique jouée par culture'))),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await snap('pack-'+width);
  await visit('view=inventory');await page.waitForSelector('[role=listitem]');assert.equal(await page.$$eval('[role=listitem]',els=>els.length),30);await page.select('[aria-label="Filtrer l’inventaire par rareté"]','epic');await page.waitForFunction(()=>document.querySelectorAll('[role=listitem]').length===4);assert.equal(await page.$$eval('[role=listitem]',els=>els.every(el=>el.dataset.rarity==='epic')),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await snap('inventory-epics-'+width);
 }
 assert.equal(await page.evaluate(()=>window.__requests.every(r=>r.method==='GET')),true);assert.deepEqual(errors,[]);await writeFile(resolve(output,collectionOnly?'collection-map-report.json':'report.json'),JSON.stringify({passed:true,results,errors,mapPinOpener:true,mapPinFocusRestored:true,collectionToShop:true,shopCollectionFocusRestored:true,retry:true,refresh:true,completeCollection:true,profileZoom:true,readOnly:true},null,2));console.log(JSON.stringify({passed:true,viewports:results.length,zoom:true,filters:true,errors}));
}finally{await browser?.close();await server.close();}
