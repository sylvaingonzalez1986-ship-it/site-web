/** Real shop, booster reveals and Collections. All purchases use a browser-local store. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { installPlacardCardShopFixture } from './fixtures/placard-card-shop.mjs';

const root=process.cwd(), output=resolve(root,'output/placard-card-shop'), port=Number(process.env.PLACARD_SHOP_AUDIT_PORT||3205), origin=`http://127.0.0.1:${port}`, preview=process.argv.includes('--preview');
const modules={
 'shop-audit-entry':`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KqSupportBoosterShop} from '/src/components/placard/KqSupportBoosterShop';
import {KqBotteCollection} from '/src/components/placard/KqBotteCollection';
import {KQ_ACTIVE_CARDS} from '/src/lib/kanab-quest-game';
import {getKqBuddieCultivationProfile} from '/src/lib/kanab-quest-buddie-cultivation';
(${installPlacardCardShopFixture.toString()})(KQ_ACTIVE_CARDS,getKqBuddieCultivationProfile);
function App(){const[collection,setCollection]=useState(null),[section,setSection]=useState('botte'),[revision,setRevision]=useState(0);return <><KqSupportBoosterShop key={revision} autoOpen embedded initialSection={section} onOpenCollection={(kind='botte')=>setCollection(kind)} onExit={()=>{}}/>{collection?<KqBotteCollection initialSection={collection} onClose={()=>setCollection(null)} onOpenShop={(kind='botte')=>{setCollection(null);setSection(kind);setRevision(value=>value+1);}}/>:null}</>;}createRoot(document.getElementById('root')).render(<App/>);`,
 'next/image':`import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
 'next/link':`import React from 'react';export default function Link({prefetch,replace,scroll,shallow,locale,...props}){return <a {...props}/>;}`,
 'next/navigation':`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),prefetch:()=>{}});`,
 '@/context/CartContext':`export const useCart=()=>({isAuthenticated:true,authLoading:false,user:{id:'local-audit'},refreshSession:async()=>{}});`,
 '@/components/navigation/NavigationLink':`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`,
};
const fonts=`@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#f2edda}`;
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react','gsap']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},css:{postcss:{plugins:[tailwindcss({base:root})]}},
 plugins:[{name:'shop-audit',enforce:'pre',resolveId(id){if(id.endsWith('/context/CartContext'))return '\0@/context/CartContext';if(id.endsWith('/components/navigation/NavigationLink'))return '\0@/components/navigation/NavigationLink';if(id in modules)return '\0'+id;},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Boutique locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__shop-audit-entry"></script></html>`);});}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});

let browser,page;
const errors=[], results=[], blocked=[];
const supportPurchase='[data-support-pack-purchase]', supportOpen='[data-support-pack-open]', buddiePurchase='[data-buddie-pack-purchase]', buddieOpen='[data-buddie-pack-open]', collections='dialog[data-placard-collections]';
await mkdir(output,{recursive:true});
if(preview){await server.listen();console.log('Prévisualisation boutique : '+origin);}
else try {
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>errors.push(error.message));await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);page.on('request',request=>{if(request.url().startsWith(origin)||request.url().startsWith('data:'))void request.continue();else{blocked.push(request.url());void request.abort();}});
 const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForSelector(supportPurchase);await page.evaluate(()=>document.fonts.ready);};
 const click=async(selector,keyboard=false)=>{const handle=await page.waitForSelector(selector,{visible:true});await handle.evaluate(element=>element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));if(keyboard){await handle.focus();await page.keyboard.press('Enter');}else await handle.click();};
 const clickText=async(text)=>{const handle=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(button=>button.checkVisibility()&&button.textContent.trim()===text),{},text);await handle.asElement().click();await handle.dispose();};
 const switchSection=async(section)=>{await click(`[data-shop-section="${section}"]`);await page.waitForSelector(section==='buddies'?buddiePurchase:supportPurchase,{visible:true});};
 const layout=async()=>{
  const measured=await page.evaluate(()=>({documentOverflow:document.documentElement.scrollWidth>innerWidth+1,dialogs:[...document.querySelectorAll('dialog[open],[aria-modal=true]')].filter(element=>element.checkVisibility()).map(element=>{const rect=element.getBoundingClientRect();return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,overflow:element.scrollWidth>element.clientWidth+1};})}));
  assert.equal(measured.documentOverflow,false,'No page overflow');for(const dialog of measured.dialogs){assert.equal(dialog.overflow,false,'No modal overflow');assert.ok(dialog.left>=-1&&dialog.right<=(await page.viewport()).width+1,'Modal stays within viewport');}return measured;
 };
 const snap=async(name)=>{await page.evaluate(()=>Promise.all([...document.images].filter(image=>image.checkVisibility()).map(image=>image.decode().catch(()=>{}))));await page.screenshot({path:resolve(output,name+'.png'),fullPage:false});};
 const openCollection=async(section)=>{await clickText('Collections');await page.waitForSelector(collections+'[open]');await click(`[data-collection-tab=${section}]`);};
 const fixture=async()=>page.evaluate(()=>({points:window.__fixture.points,commits:window.__fixture.purchaseCommits,supportCounts:window.__fixture.supportCounts,buddieCounts:window.__fixture.buddieCounts,requests:window.__fixture.requests,entitlements:window.__fixture.entitlements.length,tickets:window.__fixture.tickets}));
 const beginBuddieOpening=async()=>{await click(buddieOpen,true);await page.waitForSelector('[data-pack-phase=idle]');await clickText('Ouvrir le pack');};
 const finishBuddieOpening=async(width)=>{await page.waitForSelector('[data-pack-phase=cards]');await clickText('Tout révéler');await page.waitForSelector('[data-pack-phase=recap]');assert.equal(await page.$$eval('[data-pack-phase=recap] button[data-buddie]',elements=>elements.length),3);await layout();await snap('buddie-reveal-'+width);await clickText('Ranger dans mon album');await page.waitForSelector('[data-pack-phase]',{hidden:true});};

 for(const width of (process.argv.includes('--retry-only')?[]:[320,390,1440])){
  await page.setViewport({width,height:width===320?740:width===390?844:1000,isMobile:width<700,hasTouch:width<700});await visit();await layout();await snap('counter-'+width);
  assert.equal(await page.$('[data-arena-tour=equipment-book]'),null,'Equipment book removed from card shop');
  assert.equal(await page.$('[aria-labelledby=equipment-catalog-title]'),null);
  await click(supportPurchase,true);await page.waitForFunction(()=>window.__fixture.purchaseCommits.support===1);await page.waitForFunction(selector=>!document.querySelector(selector)?.disabled,{},supportPurchase);
  assert.equal((await fixture()).points,1142);await click(supportOpen,true);await page.waitForSelector('[data-support-pack-reveal]');await layout();await snap('support-reveal-'+width);await page.keyboard.press('Escape');await page.waitForSelector('[data-support-pack-reveal]',{hidden:true});
  await openCollection('botte');await page.waitForSelector('[data-card-code="BOTTE-005"]');assert.equal(await page.$$eval('[data-collection-panel=botte] [data-card-code]',elements=>elements.length),5);await snap('support-collection-'+width);await page.keyboard.press('Escape');await page.waitForSelector(collections,{hidden:true});
  await switchSection('buddies');await page.waitForFunction(()=>document.querySelector('[data-buddie-pack-points]')?.textContent.replace(/\D/g,'')==='1142');await layout();await snap('buddies-shop-'+width);await click(buddiePurchase,true);await page.waitForFunction(()=>window.__fixture.purchaseCommits.buddies===1);await page.waitForFunction(selector=>!document.querySelector(selector)?.disabled,{},buddiePurchase);
  assert.equal((await fixture()).points,1042);await beginBuddieOpening();await finishBuddieOpening(width);
  await openCollection('buddies');await page.waitForSelector('[data-buddie-collection-card="HH2026-001"]');assert.equal(await page.$$eval('[data-buddie-collection-card]',elements=>elements.length),5);await snap('buddies-collection-'+width);await layout();await page.keyboard.press('Escape');await page.waitForSelector(collections,{hidden:true});
  const current=await fixture();assert.equal(current.requests.filter(request=>request.url.includes('/equipment')||request.url.includes('/care')).length,0,'Card shop never requests equipment');
  results.push({width,points:current.points,supportOwned:5,buddiesOwned:5,purchaseCommits:current.commits,keyboard:true,overflow:false});
 }
 await page.setViewport({width:390,height:844});
 await visit('empty');await page.evaluate(()=>sessionStorage.removeItem('audit:card-shop-state'));
 await visit('empty&persist');await page.evaluate(()=>{window.__fixture.failAfterCommit='/api/arena/placard/boosters';});await click(supportPurchase);await page.waitForFunction(()=>window.__fixture.purchaseCommits.support===1);await page.waitForSelector('[data-support-pack-verify]');
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[data-support-pack-verify]');await click('[data-support-pack-verify]');await page.waitForFunction(()=>document.querySelector('[data-support-pack-verify]')===null);
 const supportRetry=await fixture();assert.equal(supportRetry.points,1142);assert.equal(supportRetry.commits.support,1);assert.equal(supportRetry.entitlements,1);
 const supportPosts=supportRetry.requests.filter(request=>request.url==='/api/arena/placard/boosters'&&request.method==='POST');assert.equal(supportPosts.length,2);assert.equal(supportPosts[0].body.requestKey,supportPosts[1].body.requestKey);
 results.push({scenario:'support-uncertain-purchase',commits:1,points:supportRetry.points,reloadSameKey:true});
 await page.evaluate(()=>sessionStorage.removeItem('audit:card-shop-state'));
 await visit('empty&persist');await switchSection('buddies');await page.evaluate(()=>{window.__fixture.failAfterCommit='/api/account/tickets';});
 await click(buddiePurchase);await page.waitForSelector('[data-buddie-pack-verify]');assert.equal(await page.$eval(buddiePurchase,element=>element.disabled),true);
 await page.reload({waitUntil:'networkidle0'});await switchSection('buddies');await page.waitForSelector('[data-buddie-pack-verify]');
 assert.equal(await page.$eval(buddiePurchase,element=>element.disabled),true,'An uncertain purchase stays blocked after reload');
 await page.evaluate(()=>{window.__fixture.failTickets=true;});await click('[data-buddie-pack-verify]');
 await page.waitForFunction(()=>document.querySelector('[data-buddie-pack-shop] [role=alert]')?.textContent.length>0);
 await page.waitForFunction(()=>document.querySelector('[data-buddie-pack-verify]')?.disabled===false);
 assert.equal(await page.$eval(buddiePurchase,element=>element.disabled),true,'A failed verification never unlocks a new purchase');
 await page.evaluate(()=>{window.__fixture.failTickets=false;});await click('[data-buddie-pack-verify]');await page.waitForFunction(()=>document.querySelector('[data-buddie-pack-verify]')===null);
 const buddieRetry=await fixture();assert.equal(buddieRetry.points,1047);assert.equal(buddieRetry.commits.buddies,1);assert.equal(buddieRetry.requests.filter(request=>request.url==='/api/account/tickets'&&request.method==='POST').length,1);
 results.push({scenario:'buddie-uncertain-purchase',commits:1,points:buddieRetry.points,reloadLocked:true,failedReadLocked:true});
 await visit('empty');await switchSection('buddies');await page.evaluate(()=>{window.__fixture.deferNextBuddiePurchase=true;});await click(buddiePurchase);await page.waitForSelector('[data-buddie-pack-verify]');
 await click('[data-buddie-pack-verify]');await page.waitForFunction(()=>!document.querySelector('[data-buddie-pack-verify]')?.disabled);
 assert.equal(await page.$eval(buddiePurchase,element=>element.disabled),true,'An unchanged snapshot cannot prove an uncertain purchase failed');
 assert.equal((await fixture()).commits.buddies,0);
 await page.evaluate(()=>window.__fixture.completeLateBuddiePurchase());await click('[data-buddie-pack-verify]');await page.waitForFunction(()=>document.querySelector('[data-buddie-pack-verify]')===null);
 const late=await fixture();assert.equal(late.commits.buddies,1);assert.equal(late.points,1047);assert.equal(late.requests.filter(request=>request.url==='/api/account/tickets'&&request.method==='POST').length,1);
 results.push({scenario:'buddie-late-commit',unchangedReadLocked:true,commits:1,points:1047});
 await visit();await switchSection('buddies');await page.evaluate(()=>{window.__fixture.failAfterCommit='/api/account/tickets/initial-buddie/scratch';});await beginBuddieOpening();await finishBuddieOpening('retry');const openRetry=await fixture();assert.equal(openRetry.buddieCounts['HH2026-020'],3);assert.equal(openRetry.buddieCounts['HH2026-001'],1);assert.equal(openRetry.requests.filter(request=>request.url.endsWith('/scratch')).length,1);results.push({scenario:'buddie-opening-retry',sameTicket:true,awardedOnce:true});
 await visit('poor&empty');assert.equal(await page.$eval(supportPurchase,element=>element.disabled),true);await switchSection('buddies');assert.equal(await page.$eval(buddiePurchase,element=>element.disabled),true);assert.equal(await page.$eval(buddieOpen,element=>element.disabled),true);
 await visit('welcome&empty');await switchSection('buddies');await click('[data-buddie-pack-welcome]');await page.waitForFunction(()=>window.__fixture.tickets.length===1);assert.equal((await fixture()).points,1147);results.push({scenario:'poor-empty-welcome',freeWelcome:true});
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,errors,blocked,localOnly:true},null,2));console.log(JSON.stringify({passed:true,groups:results.length,errors}));
}catch(error){if(page){await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});await writeFile(resolve(output,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,results,errors,body:await page.evaluate(()=>document.body.innerText).catch(()=>null)},null,2));}throw error;}
finally{await browser?.close();await server.close();}
