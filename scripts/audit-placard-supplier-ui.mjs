/** Real invoice and launch components, browser-local fixtures, no remote writes. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer,transformWithOxc} from 'vite';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root=process.cwd(),output=resolve(root,'output/placard-suppliers'),port=3250;
const origin='http://127.0.0.1:'+port;
const modules={
  'next/link':`import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}`,
  'next/image':`import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>;}`,
  'supplier-ui-entry':`
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {KqTreasuryManagement} from '/src/components/placard/KqTreasuryManagement';
    import {KqEnergyPanel} from '/src/components/placard/KqEnergyPanel';
    import {KqCommerceDesk} from '/src/components/placard/KqCommerceDesk';
    import {quoteKqCommerce} from '/src/lib/kanab-quest-commerce';
    import {createKqBusinessPreview,previewKqBusinessPayment,KQ_SUPPLIER_PAYMENT_TERM_MS} from '/src/lib/kanab-quest-business';
    import {createKqWarehouseStarter,getKqWarehouseRunSnapshot} from '/src/lib/kanab-quest-warehouse';
    import {quoteKqWarehouseEnergy} from '/src/lib/kanab-quest-warehouse-run';
    const params=new URLSearchParams(location.search),now=Date.now(),iso=value=>new Date(value).toISOString();
    const business=createKqBusinessPreview(now),warehouse=getKqWarehouseRunSnapshot(createKqWarehouseStarter(),1),quote=quoteKqWarehouseEnergy(warehouse);
    const invoice=(id,runId,amountCents,remainingCents,issuedAt)=>({id,runId,amountCents,remainingCents,issuedAt:iso(issuedAt),dueAt:iso(issuedAt+KQ_SUPPLIER_PAYMENT_TERM_MS)});
    business.suppliers={outstandingCents:6000,overdueCents:1800,invoices:[invoice('future','new-run-0001',4200,4200,now),invoice('overdue','overdue-run-1',3600,1800,now-KQ_SUPPLIER_PAYMENT_TERM_MS-3600000),invoice('paid','paid-run-0001',700,0,now-2*KQ_SUPPLIER_PAYMENT_TERM_MS)]};
    business.lab={outstandingCents:4500,overdueCents:0,invoices:[]};
    business.nextEventAt=iso(now+KQ_SUPPLIER_PAYMENT_TERM_MS);
    if(params.has('legacy'))delete business.suppliers;
    const cash=params.has('poor')?0:10000;
    const commerce={business,cashCents:cash,electricityOutstandingCents:1500,reputation:0,clients:0,computerOwned:false,revision:1,campaign:null,rawLots:[],stocks:[],receipts:[],marketVolumes:{},ownVolumes:{},routeSales:{}};
    if(params.get('view')==='sales')commerce.stocks=[{id:'stock',flowerId:'sale-flower',name:'Lot fournisseur',route:'raw',batchRoute:'raw',juryScore:8,initialUnits:1000,remainingUnits:1000,equivalentUnits:1000,originalUnits:1000,baseUnitCents:1200,repExact:0,repRounded:0,professionalUnits:0,counted:false}];
    const energy={cashCents:cash,outstandingCents:1500,invoices:[],invoiceCount:0,bestGramsPerKwh:null,quotes:{eco:quote,balanced:quote,intensive:quote},warehouse,cultureWear:{},cultureEquipmentCodes:[],cultureOperationalCodes:[],supplierInvoice:params.has('active')?business.suppliers.invoices[0]:null};
    window.__supplier={commerce,energy,requests:[],quote:null,failOnce:false,hold:false,receipts:{}};
    const original=fetch.bind(window);
    window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return original(url,init);
      if(String(url).startsWith('/api/arena/placard/energy'))return Response.json(energy);
      if(!String(url).startsWith('/api/arena/placard/commerce'))throw Error('Unexpected API '+url);
      if(init.method!=='POST')return Response.json(commerce);
      const body=JSON.parse(init.body);window.__supplier.requests.push(body);
      if(body.action==='quote'){
        const offer=quoteKqCommerce(commerce,commerce.stocks[0],body.channel,body.policy,body.units,now);
        const prepared={quoteId:'sale-quote',offer,...previewKqBusinessPayment(offer.payoutCents,business,energy.outstandingCents),expiresAt:iso(now+60000)};
        window.__supplier.prepared=prepared;return Response.json(prepared);
      }
      if(body.action==='sell'){
        const prepared=window.__supplier.prepared;commerce.cashCents+=prepared.netPayoutCents;commerce.stocks[0].remainingUnits-=prepared.offer.units;
        return Response.json({action:'sell',...prepared,channel:'wholesale',units:prepared.offer.units,payoutCents:prepared.offer.payoutCents,cashAfterCents:commerce.cashCents,remainingUnits:commerce.stocks[0].remainingUnits});
      }
      if(window.__supplier.hold)await new Promise(resolve=>window.__supplier.release=resolve);
      if(!window.__supplier.receipts[body.requestKey]){
        if(body.action!=='pay-supplier')throw Error('Unexpected invoice action');
        const invoice=business.suppliers.invoices.find(item=>item.id===body.invoiceId);
        if(!invoice||commerce.cashCents<invoice.remainingCents)throw Error('Unaffordable payment');
        const paidCents=invoice.remainingCents;
        commerce.cashCents-=paidCents;energy.cashCents=commerce.cashCents;business.suppliers.outstandingCents-=paidCents;
        if(Date.parse(invoice.dueAt)<=now)business.suppliers.overdueCents-=paidCents;
        invoice.remainingCents=0;window.__supplier.receipts[body.requestKey]={cashAfterCents:commerce.cashCents,paidCents};
      }
      if(window.__supplier.failOnce){window.__supplier.failOnce=false;return Response.json({error:'Réponse perdue. Réessaie le règlement.'},{status:503});}
      return Response.json(window.__supplier.receipts[body.requestKey]);
    };
    createRoot(document.getElementById('root')).render(params.get('view')==='energy'
      ? <KqEnergyPanel {...(params.has('locked')?{lockedQuote:quote,lockedWarehouse:warehouse,runId:params.has('active')?'new-run-0001':'old-run-0001'}:{selectedMode:'balanced',onQuoteChange:value=>window.__supplier.quote=value})}/>
      : params.get('view')==='sales' ? <KqCommerceDesk mode="sales" initialFlowerId="sale-flower" onOpenShop={()=>{}}/>
      : <KqTreasuryManagement section="invoices" onOpenShop={()=>{}}/>);
  `,
};
await mkdir(output,{recursive:true});
const server=await createServer({root,configFile:false,envDir:false,cacheDir:resolve(output,'vite-cache'),publicDir:resolve(root,'public'),resolve:{alias:{'@':resolve(root,'src')}},optimizeDeps:{include:['react','react-dom/client','lucide-react']},plugins:[{
  name:'supplier-ui-audit',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},
  async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:16px;background:#103b2e;font-family:Arial,sans-serif}#root{max-width:1200px;margin:auto}button,input,select{font-family:inherit}button{cursor:pointer}@media(max-width:500px){body{padding:6px}}</style><div id="root"></div><script type="module" src="/@id/__x00__supplier-ui-entry"></script></html>');});},
}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser,page;const checks=[],errors=[];
try{
  await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>void(request.url().startsWith(origin)||request.url().startsWith('data:')?request.continue():request.abort()));
  const visit=async(query='')=>{await page.goto(origin+'/?'+query,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.textContent.includes('Factures & échéances')||document.body.textContent.includes('Consommables')||document.body.textContent.includes('Lot fournisseur'));};
  const clickText=async text=>{for(let attempt=0;attempt<3;attempt++){const button=await page.waitForFunction(text=>[...document.querySelectorAll('button')].find(node=>!node.disabled&&node.getClientRects().length&&node.textContent.trim().startsWith(text))||false,{},text);try{await button.asElement().click();return;}catch(error){if(attempt===2||!/detached|not clickable/.test(error.message))throw error;}finally{await button.dispose();}}};
  const layout=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow');
  for(const width of [320,390,768,1440]){
    await page.setViewport({width,height:1000});await visit();await layout();
    assert.equal(await page.$eval('[aria-label="Factures à régler"] [aria-label="Factures fournisseurs"]',node=>node.textContent.includes('5 jours réels')),true);
    const total=await page.evaluate(()=>[...document.querySelectorAll('article')].find(node=>node.textContent.includes('Factures à régler'))?.textContent);
    assert.match(total,/120\s*€/,'Supplier balances are included in invoice total');
    await clickText('Fournisseurs');assert.equal(await page.$$eval('[aria-label="Factures laboratoire"],[aria-label="Factures électricité et soins"]',nodes=>nodes.length),0,'Supplier filter hides unrelated invoices');
    assert.deepEqual(await page.$$eval('[data-supplier-invoice]',nodes=>nodes.map(node=>node.dataset.supplierInvoice)),['overdue','future'],'Supplier invoices sorted by due date');
    assert.ok(await page.$('[data-supplier-invoice="overdue"] [data-overdue="true"]'),'Overdue invoice marked');
    await page.screenshot({path:resolve(output,'supplier-invoices-'+width+'.png'),fullPage:true});checks.push('supplier invoice list, totals and filtering at '+width+'px');
  }
  await visit('poor');await clickText('Fournisseurs');assert.equal(await page.$$eval('[data-supplier-invoice] button',nodes=>nodes.every(node=>node.disabled)),true,'Unaffordable early payment disabled');
  await visit('view=energy&poor');await page.waitForFunction(()=>window.__supplier.quote!==null);assert.ok(await page.evaluate(()=>document.body.textContent.includes('Aucun débit immédiat pour les consommables')));assert.equal(await page.evaluate(()=>document.body.textContent.includes('Il manque')),false,'Zero cash does not produce a consumables start warning');checks.push('zero cash keeps launch quote available while early invoice payment remains protected');
  await visit('view=energy&locked');assert.equal(await page.evaluate(()=>document.body.textContent.includes('à régler avant le')),false,'Historical paid run has no invented future invoice');assert.ok(await page.$('a[href*="view=treasury"]'));
  await visit('view=energy&locked&active');assert.ok(await page.evaluate(()=>document.body.textContent.includes('Facture fournisseur :')&&document.body.textContent.includes('42')));assert.ok(await page.$('time[datetime]'));checks.push('historical run stays neutral and new active run shows its real invoice');
  await visit('legacy');assert.ok(await page.$('[aria-label="Factures laboratoire"]'),'Older business snapshot remains usable');checks.push('optional supplier schema preserves historical invoice screens');
  await visit();await clickText('Fournisseurs');await page.evaluate(()=>{window.__supplier.failOnce=true;window.__supplier.hold=true;});
  await page.click('[data-supplier-invoice="future"] button');await page.waitForSelector('dialog[open]');
  assert.match(await page.$eval('dialog',node=>node.textContent),/Régler le fournisseur/);assert.equal(await page.evaluate(()=>window.__supplier.requests.length),0,'Review occurs before payment');
  await clickText('Confirmer');await page.waitForFunction(()=>typeof window.__supplier.release==='function');
  assert.equal(await page.$$eval('dialog button',nodes=>nodes.every(node=>node.disabled)),true,'Payment confirmation remains locked in flight');
  await page.evaluate(()=>{window.__supplier.hold=false;window.__supplier.release();});await page.waitForSelector('dialog [role="alert"]');await clickText('Confirmer');
  await page.waitForFunction(()=>!document.querySelector('dialog[open]')&&document.body.textContent.includes('Règlement enregistré'));
  const result=await page.evaluate(()=>({cash:window.__supplier.commerce.cashCents,due:window.__supplier.commerce.business.suppliers.outstandingCents,requests:window.__supplier.requests}));
  assert.equal(result.requests.length,2);assert.equal(result.requests[0].requestKey,result.requests[1].requestKey,'Lost payment response reuses its idempotency key');
  assert.deepEqual({action:result.requests[0].action,invoiceId:result.requests[0].invoiceId},{action:'pay-supplier',invoiceId:'future'});assert.equal(result.cash,5800,'One debit only');assert.equal(result.due,1800);
  assert.equal(await page.$('[data-supplier-invoice="future"]'),null,'Paid invoice leaves unpaid list');assert.ok(await page.evaluate(()=>document.body.textContent.includes('Dernières factures fournisseur réglées · 2')));checks.push('supplier early payment, pending lock, lost-response retry and paid history');
  await page.setViewport({width:390,height:1000});await visit('view=sales');await page.click('[aria-label="Voir l’offre Grossistes"]');await clickText('Voir le montant net');await page.waitForSelector('dialog[open]');
  assert.equal(await page.evaluate(()=>window.__supplier.prepared.supplierPaidCents),1800,'Authoritative sale includes overdue suppliers');
  const deduction=()=>[...document.querySelectorAll('dt')].find(node=>node.textContent==='Fournisseurs échus réglés')?.nextElementSibling?.textContent;
  assert.match(await page.evaluate(deduction),/18\s*€/,'Supplier deduction shown before selling');await layout();
  await clickText('Confirmer');await page.waitForFunction(()=>!document.querySelector('dialog[open]')&&document.body.textContent.includes('versés'));
  assert.match(await page.evaluate(deduction),/18\s*€/,'Committed receipt explains the supplier deduction');await layout();await page.screenshot({path:resolve(output,'supplier-sale-receipt-390.png'),fullPage:true});checks.push('sale quote and receipt explain the supplier deduction on mobile');
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks,output}));
}catch(error){await page?.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(output,'failure.json'),JSON.stringify({message:error.message,checks,errors},null,2));throw error;}
finally{await browser?.close();await server.close();}
