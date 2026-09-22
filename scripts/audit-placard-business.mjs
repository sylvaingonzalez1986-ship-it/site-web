/** Real React commerce UI with synthetic accounts. No external requests or player writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
const root = process.cwd(), output = resolve(root, 'output/placard-business');
const modules = {
  'business-entry': `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KqCommerceDesk} from '/src/components/placard/KqCommerceDesk';import {KqTreasuryManagement} from '/src/components/placard/KqTreasuryManagement';
    import {createKqBusinessPreview,KQ_GAME_MONTH_MS,KQ_ADVERTISING,previewKqBusinessPayment} from '/src/lib/kanab-quest-business';
    import {quoteKqCommerce} from '/src/lib/kanab-quest-commerce';
    const now=Date.now(),iso=n=>new Date(n).toISOString(),scenario=new URLSearchParams(location.search).get('scenario');
    const business=createKqBusinessPreview(now);business.domiciliation={mode:'home',active:false,renew:false,paidUntil:null};
    business.lab={outstandingCents:9000,overdueCents:4500,invoices:[{id:'invoice-due',runId:'run-due',issuedAt:iso(now-KQ_GAME_MONTH_MS-60000),dueAt:iso(now-60000),amountCents:4500,remainingCents:4500},{id:'invoice-later',runId:'run-later',issuedAt:iso(now),dueAt:iso(now+KQ_GAME_MONTH_MS),amountCents:4500,remainingCents:4500}]};
    business.vat.reservedCents=2000;
    if(scenario==='active'||scenario==='suspended')business.shop={name:'Les Fleurs des Embruns',createdAt:iso(now-3600000),paidUntil:iso(now+(scenario==='active'?12:-1)*3600000),renew:true,active:scenario==='active'};
    const snapshot={business,shopPartners:2,revision:0,cashCents:scenario==='poor'?35000:150000,reputation:312,clients:12,computerOwned:true,internetRenew:false,campaign:{id:'cycle',shopPartnersStart:2,revision:0,reputation:312,clientsStart:12,event:'normal',internetPaid:false,directUsed:0,shopUsed:0,goodUnits:0,disappointmentUnits:0},demand:{serverNow:iso(now),updatedAt:iso(now),onlineDebt:0,shopDebt:0,growthResetsAt:iso(now+86400000)},stocks:[{id:'stock',flowerId:'flower-test',name:'Recolte des embruns',route:'raw',batchRoute:'raw',juryScore:9,initialUnits:1200,remainingUnits:1200,equivalentUnits:1200,originalUnits:1200,baseUnitCents:180,repExact:0,repRounded:0,professionalUnits:0,counted:false}],receipts:[],routeSales:{},marketVolumes:{},ownVolumes:{},electricityOutstandingCents:1000,rawLots:[]};
    window.__snapshot=snapshot;window.__actions=[];const quotes=new Map();
    const originalFetch=window.fetch.bind(window);window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/arena/placard/commerce'))return originalFetch(url,init);
      business.serverNow=iso(Date.now());snapshot.demand.serverNow=business.serverNow;
      if(init.method!=='POST')return new Response(JSON.stringify(snapshot));
      const body=JSON.parse(init.body);window.__actions.push(body);let result={action:body.action,cashAfterCents:snapshot.cashCents};
      if(body.action==='create-shop'){snapshot.cashCents-=100000;business.shop={name:body.name,createdAt:business.serverNow,paidUntil:iso(Date.now()+KQ_GAME_MONTH_MS),renew:true,active:true};}
      if(body.action==='rename-shop')business.shop.name=body.name;
      if(body.action==='shop-renewal')business.shop.renew=body.enabled;
      if(body.action==='renew-shop'){snapshot.cashCents-=10000;business.shop.active=true;business.shop.paidUntil=iso(Date.now()+KQ_GAME_MONTH_MS);}
      if(body.action==='advertise'){const ad=KQ_ADVERTISING[body.kind];snapshot.cashCents-=ad.costCents;business.advertising={id:'advertisement',kind:body.kind,startedAt:business.serverNow,endsAt:iso(Date.now()+ad.durationDays*14400000),boostPercent:ad.boostPercent};}
      if(body.action==='pay-lab'){const invoice=business.lab.invoices.find(i=>i.id===body.invoiceId);snapshot.cashCents-=invoice.remainingCents;business.lab.outstandingCents-=invoice.remainingCents;if(Date.parse(invoice.dueAt)<Date.now())business.lab.overdueCents-=invoice.remainingCents;invoice.remainingCents=0;}
      if(body.action==='domiciliation'){const d=business.domiciliation;if(body.mode==='external'){if(!d.paidUntil||Date.parse(d.paidUntil)<=Date.now()){snapshot.cashCents-=5000;d.paidUntil=iso(Date.now()+KQ_GAME_MONTH_MS);}d.mode='external';d.active=true;d.renew=true;}else{d.mode='home';d.active=false;d.renew=false;}}
      if(body.action==='quote'){const offer=quoteKqCommerce(snapshot,snapshot.stocks[0],body.channel,body.policy,body.units,Date.now());const payment=previewKqBusinessPayment(offer.payoutCents,business,snapshot.electricityOutstandingCents);quotes.set('quote',{offer,payment});return new Response(JSON.stringify({quoteId:'quote',offer,...payment,expiresAt:iso(Date.now()+600000)}));}
      if(body.action==='sell'){const {offer,payment}=quotes.get(body.quoteId);snapshot.cashCents+=payment.netPayoutCents;business.vat.reservedCents+=payment.vatCents;business.vat.salesTtcCents+=offer.payoutCents;snapshot.stocks[0].remainingUnits-=offer.units;result={...result,...payment,stockId:'stock',channel:offer.channel,units:offer.units,payoutCents:offer.payoutCents,remainingUnits:snapshot.stocks[0].remainingUnits,satisfaction:offer.satisfaction,clientsBefore:offer.clientsBefore,clientsAfter:offer.clientsAfter};}
      result.cashAfterCents=snapshot.cashCents;snapshot.receipts.unshift(result);return new Response(JSON.stringify(result));
    };
    function App(){const [view,setView]=React.useState('management');const onOpenShop=()=>{window.__openedComputer=true;};return React.createElement(React.Fragment,null,React.createElement('button',{'data-audit-market':true,onClick:()=>setView('market')},'Marché'),view==='management'?React.createElement(KqTreasuryManagement,{onOpenShop}):React.createElement(KqCommerceDesk,{onOpenShop,onOpenTreasury:()=>setView('management')}));}createRoot(document.getElementById('root')).render(React.createElement(App));`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
};
const server = await createServer({ root, cacheDir: resolve(output, 'vite-cache'), optimizeDeps: { include: ['react','react-dom/client','lucide-react'] }, configFile:false, envDir:false, publicDir:resolve(root,'public'), esbuild:{jsx:'automatic'}, resolve:{alias:{'@':resolve(root,'src')}}, css:{postcss:{plugins:[tailwindcss({base:root})]}}, plugins:[{name:'business-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},load(id){if(id.startsWith('\0'))return modules[id.slice(1)];},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Placard business audit</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__business-entry"></script></html>');});}}],server:{host:'127.0.0.1',port:3217,strictPort:true,hmr:false,watch:null} });
let browser;const errors=[],results=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,userDataDir:resolve(output,'chrome-profile'),args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port==='3217'))void request.continue();else void request.abort();});
  const click=async(label,selector='button')=>{const handle=await page.evaluateHandle((text,query)=>[...document.querySelectorAll(query)].find(el=>el.textContent.trim().startsWith(text)),label,selector);const element=handle.asElement();assert(element,'Missing button: '+label);await element.scrollIntoView();await element.click();};
  const confirm=async()=>{await page.waitForSelector('dialog[open]');await click('Confirmer');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));};
  const bodyText=()=>page.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal overflow');
  const shot=async name=>{await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished));});await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  const visit=async scenario=>{await page.goto('http://127.0.0.1:3217/?scenario='+scenario,{waitUntil:'networkidle0'});await page.waitForSelector('#kq-business-management');await page.$eval('#kq-business-management',el=>{if(!el.open)el.querySelector('summary').click();});};
  for(const width of [320,390,1280]){
    await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
    await visit('poor');assert((await bodyText()).toLowerCase().includes('mois 1'));assert.equal(await page.$eval('[aria-label="Épargne pour créer le site"]',el=>el.value),35000);
    await page.type('input[type="text"]','Les Embruns');assert.equal(await page.$eval('form button',el=>el.disabled),true);await noOverflow();await shot('savings-'+width);
    await visit('create');await page.type('input[type="text"]','Les Embruns');await click('Créer mon site');await page.waitForSelector('dialog[open]');assert((await bodyText()).includes('premier mois de jeu inclus'));await confirm();
    await page.waitForFunction(()=>window.__snapshot.business.shop.name==='Les Embruns');await page.waitForFunction(()=>document.body.innerText.includes('Tes clients peuvent commander'));
    assert.equal(await page.evaluate(()=>window.__snapshot.cashCents),50000);await noOverflow();await shot('created-'+width);
    await click('Modifier le nom','summary');await page.$eval('input[type="text"]',el=>{el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.click('input[type="text"]',{clickCount:3});await page.keyboard.press('Backspace');await page.type('input[type="text"]','La Boutique des Embruns');await click('Enregistrer le nom');await confirm();await page.waitForFunction(()=>window.__snapshot.business.shop.name==='La Boutique des Embruns');
    await click('Désactiver');await confirm();assert.equal(await page.evaluate(()=>window.__snapshot.business.shop.renew),false);
    await click('Lancer la campagne');await confirm();assert.equal(await page.evaluate(()=>window.__snapshot.business.advertising.kind),'flyers');
    assert.equal(await page.$$eval('[aria-label="Campagnes publicitaires"] article button',buttons=>buttons.every(button=>button.disabled)),true);
    await page.$eval('[aria-label="Charges et échéances"] li:nth-child(2) button',button=>button.click());await confirm();assert.equal(await page.evaluate(()=>window.__snapshot.business.lab.invoices[1].remainingCents),0);
    const beforeAddress=await page.evaluate(()=>window.__snapshot.cashCents);await click('Choisir · 50');await confirm();assert.equal(await page.evaluate(()=>window.__snapshot.cashCents),beforeAddress-5000);await click('Choisir mon domicile');await confirm();await click('Réactiver la période payée');await confirm();assert.equal(await page.evaluate(()=>window.__snapshot.cashCents),beforeAddress-5000);
    await noOverflow();await shot('management-'+width);
    await page.click('[data-audit-market]');await page.waitForSelector('[aria-label="Tes lots"]');assert.equal(await page.$('#kq-business-management'),null,'Management lives outside the market');
    await page.$eval('[aria-label="Tes lots"] button',el=>el.click());await page.waitForSelector('[aria-label="Circuits de vente"]');await page.click('[aria-label="Voir l’offre Vente en ligne"]');await click('Vendre ce lot');await page.waitForSelector('dialog[open]');
    const modal=await page.$eval('dialog',el=>el.innerText);for(const label of ['Recette TTC','TVA mise de côté','Analyses échues réglées','Électricité et soins réglés','Versé au portefeuille'])assert(modal.includes(label),label);
    await shot('sale-confirmation-'+width);await confirm();await page.waitForSelector('[aria-label="Bilan clientèle"]');assert((await bodyText()).includes('TVA mise de côté'));await noOverflow();await shot('sale-receipt-'+width);
    results.push({width,savings:true,creation:true,rename:true,renewalToggle:true,advertising:true,labPayment:true,domiciliation:true,saleBreakdown:true,noOverflow:true});
  }
  await visit('active');assert((await bodyText()).includes('Ton abonnement arrive à échéance avant la fin de cette campagne.'));await shot('advertising-renewal-warning');
  await visit('suspended');await click('Réactiver');await confirm();assert.equal(await page.evaluate(()=>window.__snapshot.business.shop.active),true);assert.equal(await page.evaluate(()=>window.__snapshot.cashCents),140000);
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,reactivation:true,errors},null,2));console.log(JSON.stringify({passed:true,results,reactivation:true,output}));
} catch(error) {console.error('Browser errors:',errors);if(browser){const pages=await browser.pages();const page=pages.at(-1);await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true});console.error(await page?.evaluate(()=>document.body.innerText));}throw error;} finally {await browser?.close();await server.close();}
