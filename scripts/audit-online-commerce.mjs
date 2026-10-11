/** Real market and business components, isolated operations API; no real account. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/online-commerce'), port = 3251;
const modules = {
  entry: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {KqMarketHub} from '/src/components/placard/KqMarketHub';
import {KqTreasuryManagement} from '/src/components/placard/KqTreasuryManagement';
import {KqPlacardMap} from '/src/components/placard/KqPlacardMap';
import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
let state=createKqOperationsLesson('market');const raw=getKqOperationsCommerce(state).rawLots[0];
state=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body:{action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents}}).state;
const prepared=state.trial.commerce.stocks[0];state.trial.commerce.stocks=[{...prepared,id:'11111111-1111-4111-8111-111111111111',name:'Lot témoin · 10 g',initialUnits:100,remainingUnits:100,equivalentUnits:100,originalUnits:400},{...prepared,id:'22222222-2222-4222-8222-222222222222',name:'Lot côtier · 30 g',initialUnits:300,remainingUnits:300,equivalentUnits:300,originalUnits:400}];
state.trial.commerce.clients=0;state.trial.commerce.reputation=0;
window.requests=[];window.fixture=()=>getKqOperationsCommerce(state);
const request=async(url,options={})=>{const path=new URL(String(url),location.origin).pathname;const body=options.body?JSON.parse(options.body):{};const method=options.method??'GET';window.requests.push({path,method,body});
try{const result=applyKqOperationsRequest(state,{path,method,body});state=result.state;return Response.json(result.payload)}catch(error){return Response.json({error:error.message},{status:400})}};
const api=createKqTutorialApi(request);
function App(){const[view,setView]=useState('market');const[section,setSection]=useState('sales');const[,refresh]=useState(0);
const change=()=>{api.notify('kq:equipment-updated');api.notify('kq:commerce-updated');refresh(value=>value+1)};
window.advance=async()=>{const result=await request('/api/arena/placard/commerce',{method:'POST',body:JSON.stringify({action:'online',command:'advance-online-time',payload:{hours:24}})});if(!result.ok)throw new Error(await result.text());change()};
return <KqTutorialApiProvider api={api}><nav className="audit-navigation"><button onClick={()=>setView('map')}>Carte témoin</button></nav><div className="audit-surface">{view==='market'?<KqMarketHub section={section} onSectionChange={setSection} onOpenShop={()=>{}} onOpenTreasury={()=>setView('invoices')}/>:view==='invoices'?<KqTreasuryManagement section="invoices" onOpenShop={()=>{}}/>:<KqPlacardMap cashCents={state.trial.commerce.cashCents} tents={1} onOpenCollection={()=>{}} onOpen={(next,options)=>{window.lastNavigation={view:next,options};if(next==='market'){setSection(options?.marketSection??'sales');setView('market')}}}/>}</div></KqTutorialApiProvider>};createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},plugins:[{name:'online-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id},async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2);font-weight:800}@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Bold.woff2);font-weight:700}@font-face{font-family:AuditBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:400 700}:root{--font-display:AuditDisplay;--font-body:AuditBody}*{box-sizing:border-box}body{margin:0;font-family:AuditBody,Arial,sans-serif;background:#174c3b}.audit-surface{max-width:1200px;margin:auto;padding:12px}button,a,select,input{font-family:inherit}.audit-navigation{padding:12px;display:flex;gap:12px}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>')})}}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser, page;
const checks=[];
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>void(request.url().startsWith('http://127.0.0.1:'+port)||request.url().startsWith('data:')?request.continue():request.abort()));
  await page.setViewport({width:1440,height:1000});await page.goto('http://127.0.0.1:'+port,{waitUntil:'networkidle0'});await page.evaluate(()=>document.fonts.ready);
  const click=async(text,exact=false)=>{const found=await page.waitForFunction((text,exact)=>[...document.querySelectorAll('button')].find(node=>(exact?node.textContent.trim()===text:node.textContent.includes(text))&&!node.disabled&&node.getBoundingClientRect().height>0),{},text,exact);await found.asElement().click();await found.dispose()};
  const fill=async(label,value)=>{const handle=await page.waitForFunction(label=>[...document.querySelectorAll('label')].find(node=>node.textContent.startsWith(label))?.querySelector('input'),{},label);const node=handle.asElement();await node.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.keyboard.type(String(value));await node.press('Tab');await handle.dispose()};
  const fixture=()=>page.evaluate(()=>window.fixture());
  const preparation='[aria-label="Préparer des paquets pour la vente en ligne"]',dashboard='[aria-label="Tableau de bord des ventes en ligne"]';
  const noPreparation=async(location)=>{assert.equal(await page.$(preparation),null,location+' does not contain preparation');assert.equal(await page.$('input[aria-label^="Quantité de "]'),null,location+' does not sell packaging');assert.equal(await page.$('input[type="radio"][value="kraft"]'),null,location+' does not offer packaging choices');};
  const selectLot=async(name)=>{await page.waitForSelector('[aria-label="Tes lots"]');await page.evaluate(name=>{const button=[...document.querySelectorAll('[aria-label="Tes lots"] button')].find(button=>button.textContent.includes(name));if(!button)throw new Error('Missing lot '+name);button.click()},name);await page.waitForSelector('[aria-label="Circuits de vente"]');};
  const listingAction=async(name,label)=>{const handle=await page.waitForFunction((name,label)=>[...document.querySelectorAll('[aria-label="Tableau de bord des ventes en ligne"] li')].filter(item=>item.querySelector('strong')?.textContent===name).flatMap(item=>[...item.querySelectorAll('button')]).find(button=>button.textContent.includes(label)&&!button.disabled),{},name,label);await handle.asElement().click();await handle.dispose();};
  const filterListings=async(label,names)=>{await page.evaluate(label=>{const button=[...document.querySelectorAll('[aria-label="Filtrer les annonces"] button')].find(node=>node.textContent.startsWith(label));if(!button)throw new Error('Missing listing filter '+label);button.click()},label);await page.waitForFunction(names=>JSON.stringify([...document.querySelectorAll('[aria-label="Tableau de bord des ventes en ligne"] li')].filter(item=>item.querySelector('button')).map(item=>item.querySelector('strong')?.textContent))===JSON.stringify(names),{},names);};
  const selectedTab=()=>page.$eval('[aria-label="Les espaces du Marché"] [aria-selected="true"]',node=>node.textContent);
  const assertDashboardTotals=async(snapshot)=>{const expected={'Paquets vendus':snapshot.online.listings.reduce((sum,row)=>sum+row.soldPackets,0),'Paquets restants':snapshot.online.listings.reduce((sum,row)=>sum+row.remainingPackets,0),'Commandes':snapshot.online.stats.orders,'Ventes TTC':snapshot.online.stats.revenueCents/100,'Versé en trésorerie':snapshot.online.stats.netRevenueCents/100,'Quantité vendue':snapshot.online.stats.soldGrams};for(const [label,value]of Object.entries(expected)){const text=await page.$eval(dashboard,(section,label)=>[...section.querySelectorAll('dt')].find(node=>node.textContent===label)?.nextElementSibling?.firstChild?.textContent??'',label);assert.equal(Number(text.replace(/[^\d,.-]/g,'').replace(',','.')),value,'Dashboard total: '+label);}};
  const mainLot='Lot côtier · 30 g',otherLot='Lot témoin · 10 g';
  await page.waitForSelector('[aria-label="Tes lots"]');await noPreparation('Initial lot selection');assert.equal(await page.$(dashboard),null);
  assert.equal((await fixture()).online.stats.orders,0);checks.push('initial lot selection contains no online form packaging shop or dashboard');
  assert.equal(await page.$('img[src="/placard/market-counter-v2.webp"]'),null,'Sales have no shared illustrated banner');
  for(const width of [320,390,768,1440]){
    await page.setViewport({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'market overflow at '+width);
    await page.screenshot({path:resolve(output,'market-'+width+'.png'),fullPage:true});
    if(width===1440){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(output,'market-preview.png')});}
  }
  checks.push('market fits phone tablet and desktop');
  await click('Tableau de bord');await page.waitForSelector(dashboard);await noPreparation('Empty dashboard');assert.equal(await page.$('[aria-label="Tes lots"]'),null);assert.equal((await fixture()).online.listings.length,0);
  await click('Préparer une nouvelle annonce');await page.waitForSelector('[aria-label="Tes lots"]');await noPreparation('Dashboard preparation entry');assert.equal(await page.$(dashboard),null);
  await selectLot(mainLot);await noPreparation('Distribution');assert.equal(await page.$(dashboard),null);
  for(const channel of ['CBD shops','Grossistes']){await page.click('[aria-label="Voir l’offre '+channel+'"]');await page.waitForFunction(channel=>document.querySelector('#commerce-step-title')?.textContent===channel,{},channel);await noPreparation(channel);assert.equal(await page.$(dashboard),null);await click('Comparer les circuits');await page.waitForSelector('[aria-label="Circuits de vente"]');}
  checks.push('distribution shops and wholesale do not expose the online preparation form');
  await page.click('[aria-label="Préparer des paquets pour ma boutique en ligne"]');await page.waitForSelector(preparation);assert.equal(await page.$(dashboard),null);
  assert((await page.$eval(preparation,node=>node.textContent)).includes(mainLot),'The second lot remains selected in preparation');
  await page.waitForFunction(()=>[...document.images].filter(img=>img.src.includes('/packaging-')).length===3&&[...document.images].filter(img=>img.src.includes('/packaging-')).every(img=>img.complete&&img.naturalWidth>0));checks.push('three realistic package illustrations load only in preparation');
  for(const width of [320,390,768,1440]){await page.setViewport({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'preparation overflow at '+width);await page.screenshot({path:resolve(output,'preparation-'+width+'.png'),fullPage:true});}
  const initial=await fixture();await click('Acheter · 2,50');await click('Confirmer',true);
  await page.waitForFunction(()=>window.fixture().online.packaging.find(item=>item.code==='kraft-5').quantity===10);
  assert.equal((await fixture()).cashCents,initial.cashCents-250);checks.push('packaging purchase confirmed once');
  await fill('Nombre de paquets','6');await fill('Ton prix TTC par paquet','9.13');
  await click('Préparer 6 paquets et mettre en vente');await click('Confirmer',true);
  await page.waitForFunction(()=>window.fixture().online.listings.length===1);await page.waitForSelector(dashboard);await noPreparation('Dashboard after publication');assert.match(await selectedTab(),/Tableau de bord/);assert.equal(await page.evaluate(()=>document.activeElement?.matches('h1[data-commerce-view-heading]')),true,'Publication moves focus from the removed dialog to the dashboard heading');
  const created=await fixture();assert.equal(created.online.listings[0].packetPriceCents,913);assert.equal(created.online.listings[0].stockId,initial.stocks[1].id);
  assert.equal(created.stocks[1].remainingUnits,0);assert.equal(created.stocks[0].remainingUnits,initial.stocks[0].remainingUnits);
  assert.equal(created.online.stats.orders,0);assert.equal(created.online.listings[0].remainingPackets*created.online.listings[0].formatGrams,30);await assertDashboardTotals(created);checks.push('selected lot exact price and mass preserved with automatic redirect and no instant sale');
  await click('Gérer mon activité');await page.waitForSelector('[aria-label="Développer ma boutique en ligne"]');
  await page.waitForFunction(()=>[...document.images].some(img=>img.src.includes('market-social-missions-v2.webp')&&img.complete&&img.naturalWidth>0));
  checks.push('social mission illustration loads within business content');
  for(const width of [320,390,768,1440]){
    await page.setViewport({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'business overflow at '+width);
    await page.screenshot({path:resolve(output,'business-'+width+'.png'),fullPage:true});
    if(width===1440){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(output,'business-preview.png')});}
  }
  checks.push('business progression fits phone tablet and desktop');
  await click('Lancer la mission gratuite');await click('Confirmer',true);await page.waitForFunction(()=>window.fixture().online.marketing.active!==null);
  await page.evaluate(()=>window.advance());const after=await fixture();
  assert.ok(after.online.stats.orders>0);assert.equal(after.online.followers,15);checks.push('marketing develops audience and time produces orders');
  await click('Tableau de bord');await page.waitForSelector(dashboard);await page.waitForFunction(()=>document.body.textContent.includes('Dernières commandes automatiques'));await noPreparation('Sales dashboard');
  const sales=after.online.recentSales;assert.equal(after.online.stats.orders,sales.reduce((sum,sale)=>sum+sale.packets,0));assert.equal(after.online.stats.revenueCents,sales.reduce((sum,sale)=>sum+sale.payoutCents,0));assert.equal(after.online.stats.soldGrams+after.online.listings[0].remainingPackets*5,30);await assertDashboardTotals(after);checks.push('dashboard orders revenue and stored grams reconcile with sales');
  await listingAction(mainLot,'Modifier le prix');await fill('Prix TTC du paquet','12.37');await click('Enregistrer',true);await click('Confirmer',true);
  await page.waitForFunction(()=>window.fixture().online.listings[0].packetPriceCents===1237);
  assert.equal((await fixture()).online.recentSales[0].packetPriceCents,913);checks.push('new price preserves historical sale prices');
  await listingAction(mainLot,'Mettre en pause');await click('Confirmer',true);await page.waitForFunction(()=>window.fixture().online.listings[0].status==='paused');
  const paused=await fixture(),orders=paused.online.stats.orders;await page.evaluate(()=>window.advance());const aged=await fixture();assert.equal(aged.online.stats.orders,orders);assert.ok(aged.online.listings[0].qualityScore<paused.online.listings[0].qualityScore);assert.equal(aged.online.listings[0].remainingPackets,paused.online.listings[0].remainingPackets);checks.push('paused packets age without selling');
  await page.setViewport({width:390,height:844});await page.screenshot({path:resolve(output,'listing-paused-mobile.png'),fullPage:true});
  await listingAction(mainLot,'Reprendre les ventes');await click('Confirmer',true);await page.waitForFunction(()=>window.fixture().online.listings[0].status==='active');
  const beforeClose=await fixture();await listingAction(mainLot,'Retirer du rayon');await page.waitForSelector('dialog[open]');assert.match(await page.$eval('dialog[open]',node=>node.textContent),/restent préparés/);await click('Confirmer',true);await page.waitForFunction(()=>window.fixture().online.listings[0].status==='closed');
  const closed=await fixture();assert.equal(closed.online.listings[0].remainingPackets,beforeClose.online.listings[0].remainingPackets);assert.equal(closed.cashCents,beforeClose.cashCents);assert.equal(closed.stocks[1].remainingUnits,0);assert.equal(closed.online.stats.orders,orders);assert.equal(await page.evaluate(()=>window.requests.filter(row=>row.method==='POST').at(-1).body.command),'close-listing');await assertDashboardTotals(closed);await filterListings('Retirées',[mainLot]);await filterListings('Toutes',[mainLot]);
  await page.evaluate(()=>window.advance());assert.equal((await fixture()).online.stats.orders,orders);await listingAction(mainLot,'Reprendre les ventes');await click('Confirmer',true);await page.waitForFunction(()=>window.fixture().online.listings[0].status==='active');await listingAction(mainLot,'Mettre en pause');await click('Confirmer',true);await page.waitForFunction(()=>window.fixture().online.listings[0].status==='paused');checks.push('pause and withdrawal preserve packets stop orders and both resume without discarding');
  await click('Préparer une nouvelle annonce');await page.waitForSelector('[aria-label="Tes lots"]');await noPreparation('New listing restarts from lots');await selectLot(otherLot);await noPreparation('New listing still requires circuit selection');await page.click('[aria-label="Préparer des paquets pour ma boutique en ligne"]');await page.waitForSelector(preparation);assert((await page.$eval(preparation,node=>node.textContent)).includes(otherLot));await fill('Nombre de paquets','2');await fill('Ton prix TTC par paquet','9.13');await click('Préparer 2 paquets et mettre en vente');await click('Confirmer',true);await page.waitForFunction(()=>window.fixture().online.listings.length===2);await page.waitForSelector(dashboard);await noPreparation('Dashboard after all bulk is packed');
  const allPacked=await fixture();assert.equal(allPacked.stocks.reduce((sum,stock)=>sum+stock.remainingUnits,0),0);assert.equal(allPacked.online.stats.soldGrams+allPacked.online.listings.reduce((sum,row)=>sum+row.remainingPackets*row.formatGrams,0),40);assert.match(await selectedTab(),/Tableau de bord/);await assertDashboardTotals(allPacked);checks.push('dashboard remains accessible when all bulk is packed and both lots reconcile');
  await filterListings('En pause',[mainLot]);await filterListings('En vente',[otherLot]);await filterListings('Toutes',[mainLot,otherLot]);checks.push('dashboard filters distinguish active paused and withdrawn listings');
  for(const width of [320,390,768,1440]){await page.setViewport({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'dashboard overflow at '+width);await page.screenshot({path:resolve(output,'dashboard-'+width+'.png'),fullPage:true});}
  const beforeDiscard=await fixture();await listingAction(mainLot,'Jeter les paquets');await click('Confirmer',true);
  await page.waitForFunction(()=>window.fixture().online.listings[0].status==='discarded');
  const discarded=await fixture();assert.equal(discarded.online.listings[0].remainingPackets,0);assert.equal(discarded.online.stats.orders,orders);
  assert.equal(discarded.cashCents,beforeDiscard.cashCents);assert.equal(discarded.stocks[1].remainingUnits,beforeDiscard.stocks[1].remainingUnits);assert.equal(discarded.online.listings[1].remainingPackets,2);
  checks.push('discard requires confirmation and never refunds restores bulk or invents orders');
  await page.setViewport({width:390,height:844});
  await click('Carte témoin',true);
  await page.select('[aria-label="Choisir un bâtiment"]','office');
  assert.equal(await page.$('[data-placard-activity="management"]'),null,'management removed from office');
  await page.select('[aria-label="Choisir un bâtiment"]','market');
  await page.click('[data-placard-activity="management"]');
  await page.waitForSelector('[aria-label="Développer ma boutique en ligne"]');
  assert.deepEqual(await page.evaluate(()=>window.lastNavigation),{view:'market',options:{marketSection:'management'}});
  checks.push('map places management in market and removes it from office');
  await page.focus('[role="tab"][aria-selected="true"]');await page.keyboard.press('Home');
  await page.waitForSelector('[aria-label="Les espaces du Marché"] [role="tab"][aria-selected="true"]');
  assert.match(await page.$eval('[aria-label="Les espaces du Marché"] [role="tab"][aria-selected="true"]',node=>node.textContent),/Transformer et vendre/);
  assert.deepEqual(await page.$$eval('[aria-label="Les espaces du Marché"] [role="tab"] strong',nodes=>nodes.map(node=>node.textContent)),['Transformer et vendre','Tableau de bord','Gérer mon activité']);
  await page.keyboard.press('ArrowRight');await page.waitForSelector(dashboard);assert.match(await selectedTab(),/Tableau de bord/);await noPreparation('Keyboard dashboard with no bulk');
  await page.keyboard.press('End');await page.waitForSelector('[aria-label="Développer ma boutique en ligne"]');
  checks.push('all three market sections support keyboard navigation including dashboard without bulk');
  await page.click('a[href*="pole=accounting"]');await page.waitForSelector('[aria-label="Échéances des abonnements"]');
  const subscriptions=await page.$eval('[aria-label="Échéances des abonnements"]',node=>node.textContent);
  assert.match(subscriptions,/Boutique de base · sans abonnement/);assert.doesNotMatch(subscriptions,/Site suspendu|100\s*€/);
  assert.match(subscriptions,/Marché/);checks.push('accounting link opens invoices with correct free base subscription');
  assert.deepEqual(errors,[]);checks.push('no browser exception and no external network');
  await writeFile(resolve(output,'result.json'),JSON.stringify({passed:true,checks},null,2));console.log('Online commerce browser audit: '+checks.length+' checks passed.');
}catch(error){if(page){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});console.log(await page.evaluate(()=>({buttons:[...document.querySelectorAll('button')].map(x=>({text:x.textContent,disabled:x.disabled})),fields:[...document.querySelectorAll('input')].map(x=>({type:x.type,value:x.value})),alerts:[...document.querySelectorAll('[role="status"],[role="alert"]')].map(x=>x.textContent),online:window.fixture?.().online})));}throw error}finally{if(browser)await browser.close();await server.close()}
