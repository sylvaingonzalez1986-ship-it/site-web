/** Real Commerce, local lesson data and explicit edge cases; no external account. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const phase=process.argv.includes('--before')?'before':'after';
const output=resolve('output/clarity-lot16',phase);await mkdir(output,{recursive:true});
let source=(await readFile('scripts/audit-placard-commerce-clarity.mjs','utf8')).split('let browser;')[0];
assert(source.includes('const server = await createServer'));
source=source.replace("'output/placard-commerce-clarity'",`'output/clarity-lot16/${phase}'`).replace('?? 3251','?? 3626')
 .replace("'react-dom/client','lucide-react'","'react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react'")
 .replace("    const params =", "    import {quoteKqCommerce} from '/src/lib/kanab-quest-commerce';\n    const params =")
 .replace('    const request = async',"    const fixture=params.get('case')??'ready';\n    const request = async")
 .replace("      if(method !== 'GET') window.__actions.push(body);",()=>`
      if(method !== 'GET'){window.__actions.push(body);if(fixture!=='ready')throw Error('Read-only fixture: '+fixture);}
      if(method==='GET'&&window.__failRefresh)return Response.json({error:'Comparaison indisponible pour cette recette.'},{status:503});`)
 .replace('        return Response.json(result.payload);',()=>`
        if(method==='GET'&&url.pathname==='/api/arena/placard/commerce'&&result.payload.stocks?.length){
          const snapshot=result.payload,stock=snapshot.stocks[0],later=new Date(state.trial.clock+3600000).toISOString();
          if(fixture==='no-computer'){snapshot.computerOwned=false;snapshot.online.site.createdAt=null;snapshot.online.site.active=false;}
          if(fixture==='suspended')snapshot.online.site.active=false;
          if(fixture==='low-quality'){stock.juryScore=6.4;stock.storage.qualityDelta=0;stock.storage.conditionScore=6.4;}
          if(fixture==='processing')stock.processingReadyAt=later;
          if(fixture==='curing'){stock.storage.stage='curing';stock.storage.readyAt=later;stock.storage.progressPercent=50;}
          if(fixture==='biomass'){stock.route='biomass';stock.batchRoute='biomass';}
          if(fixture==='quota'||fixture==='partial'){
            snapshot.wholesale={remainingEquivalentUnits:fixture==='quota'?0:300,capacityEquivalentUnits:10000,resetsAt:later};
            snapshot.demand={serverNow:new Date(state.trial.clock).toISOString(),updatedAt:new Date(state.trial.clock).toISOString(),onlineDebt:0,shopDebt:fixture==='quota'?1:.95,growthResetsAt:later};
          }
          if(fixture==='legacy')delete snapshot.online;
          window.__snapshot=structuredClone(snapshot);
          window.__offers=Object.fromEntries(['online','cbd-shop','wholesale'].map(channel=>[channel,quoteKqCommerce(snapshot,stock,channel,'advised',undefined,state.trial.clock)]));
        }
        return Response.json(result.payload);`);
source+=String.raw`
let browser,page;const checks=[],errors=[],external=[];const before=process.argv.includes('--before');
try{
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{if(r.url().startsWith(origin)||r.url().startsWith('data:'))void r.continue();else{external.push(r.url());void r.abort();}});
 const show=async name=>{await page.goto(origin+'/?prepared&flower=selected&case='+name,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Circuits de vente"]');await page.evaluate(()=>document.fonts.ready);};
 const click=async label=>{const handle=await page.evaluateHandle(label=>[...document.querySelectorAll('button,summary')].find(n=>n.checkVisibility()&&n.textContent.trim().startsWith(label)),label);const el=handle.asElement();assert(el,'Missing '+label);await el.scrollIntoView();await el.click();await handle.dispose();};
 const clean=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Page fits viewport');
 const shot=async name=>page.screenshot({path:resolve(output,name+'.png'),fullPage:true});
 const noWrites=async()=>assert.equal(await page.evaluate(()=>window.__actions.length),0,'Browsing does not sell');
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await show('ready');
  const positions=await page.evaluate(()=>{const box=document.querySelector('[aria-label="Circuits de vente"]');const buttons=[...box.querySelectorAll('button')];return {comparisonTop:Math.round(box.getBoundingClientRect().top+scrollY),comparisonBottom:Math.round(box.getBoundingClientRect().bottom+scrollY),actions:buttons.map(n=>({name:n.getAttribute('aria-label'),top:Math.round(n.getBoundingClientRect().top+scrollY),height:n.getBoundingClientRect().height}))};});
  await clean();await noWrites();await shot('ready-'+width);checks.push({width,case:'ready',...positions});if(before)continue;
  assert.equal(await page.$$eval('[data-sales-channel]',nodes=>nodes.length),3);assert(positions.actions.every(a=>a.height>=44));
  assert.deepEqual(await page.$$eval('[data-sales-channel]',nodes=>nodes.map(n=>n.dataset.salesChannel)),['cbd-shop','wholesale','online']);
  for(const channel of ['cbd-shop','wholesale']){
   const text=await page.$eval('[data-sales-channel="'+channel+'"]',n=>n.innerText);const offer=await page.evaluate(c=>window.__offers[c],channel);
   assert.match(text,/TTC/);assert.match(text,/Paiement immédiat/);assert(text.includes((offer.units/10).toLocaleString('fr-FR')+' g'));assert(text.includes((offer.payoutCents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:offer.payoutCents%100?2:0})));
  }
  const online=await page.$eval('[data-sales-channel="online"]',n=>n.innerText);assert.match(online,/Ventes progressives/);assert.match(online,/Prix libres/);assert.match(online,/2,5 %/);assert.match(online,/emballages/i);
  await page.focus('[data-sales-channel="cbd-shop"] button');await page.keyboard.press('Enter');await page.waitForSelector('[data-screen="offer"]');await noWrites();await click('← Comparer les circuits');await page.waitForSelector('[data-screen="distribution"]');
  await page.focus('[data-sales-channel="cbd-shop"] button');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-sales-channel]')?.dataset.salesChannel),'wholesale');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-sales-channel]')?.dataset.salesChannel),'online');await page.keyboard.press('Enter');await page.waitForSelector('[aria-label="Préparer des paquets pour la vente en ligne"]');assert.match(await page.$eval('[aria-label="Préparer des paquets pour la vente en ligne"]',n=>n.textContent),/La récolte de Sylvain/);await noWrites();await click('← Comparer les circuits');await page.waitForSelector('[data-screen="distribution"]');
  await click('Détails du lot et stockage');assert(await page.$eval('[data-commerce-open-lot-storage]',n=>n.checkVisibility()));assert.equal(new URL(await page.$eval('[data-commerce-open-lot-storage]',n=>n.href)).searchParams.get('fromLot'),'operations-stock');await noWrites();await clean();checks.push({width,case:'keyboard-and-destinations',exactPreparedLot:true});
  for(const name of ['no-computer','suspended','low-quality','processing','curing','biomass','quota','partial','legacy']){
   await show(name);await clean();await noWrites();
   for(const channel of ['cbd-shop','wholesale']){
    const offer=await page.evaluate(c=>window.__offers[c],channel),card=await page.$eval('[data-sales-channel="'+channel+'"]',n=>({text:n.innerText,unavailable:n.dataset.unavailable}));
    if(offer.reason){assert.equal(card.unavailable,'true');assert(card.text.includes(offer.reason));assert.match(card.text,/Voir les conditions/);assert(!card.text.includes('0 €'),'No false zero-price offer');}
    else{assert.equal(card.unavailable,undefined);assert(card.text.includes((offer.units/10).toLocaleString('fr-FR')+' g'));}
   }
   const onlineText=await page.$eval('[data-sales-channel="online"]',n=>n.innerText);
   if(name==='no-computer'){assert.match(onlineText,/Ordinateur requis/);assert.match(onlineText,/450/);}
   if(name==='suspended')assert.match(onlineText,/Boutique suspendue/);
   if(name==='biomass')assert.match(onlineText,/Biomasse non acceptée/);
   if(name==='processing')assert.match(onlineText,/Transformation en cours/);
   if(name==='legacy'){assert(!onlineText.includes('Ventes progressives'));assert.equal(await page.$('[aria-label="Préparer des paquets pour ma boutique en ligne"]'),null);}
   if(name==='partial'){assert.match(await page.$eval('[data-sales-channel="wholesale"]',n=>n.innerText),/30 g/);}
   await shot(name+'-'+width);checks.push({width,case:name,noWrites:true});
  }
 }
 if(!before){
  await show('ready');await page.click('[aria-label="Voir l’offre Grossistes"]');await click('Voir le montant net');await page.waitForSelector('dialog[open]');assert.match(await page.$eval('dialog',n=>n.innerText),/Versé au portefeuille/);assert.deepEqual(await page.evaluate(()=>window.__actions.map(a=>a.action)),['quote']);await page.keyboard.press('Escape');await click('← Comparer les circuits');await page.waitForSelector('[data-screen="distribution"]');assert.deepEqual(await page.evaluate(()=>window.__actions.map(a=>a.action)),['quote']);checks.push({case:'authoritative-quote',cancelDoesNotSell:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({checks:checks.length,errors,external}));
}catch(error){if(page)await shotFailure();throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,external},null,2));if(browser){const t=setTimeout(()=>browser.process()?.kill(),5000);try{await browser.close();}finally{clearTimeout(t);}}server.httpServer?.closeAllConnections();await server.close();}
async function shotFailure(){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});}
`;
const runtime=resolve(output,'run.mjs');await writeFile(runtime,source);await import(pathToFileURL(runtime).href);
