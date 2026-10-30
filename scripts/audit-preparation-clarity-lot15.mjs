/** Real commerce UI. Lesson engine and explicit edge-case quotes stay in memory. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const phase = process.argv.includes('--before') ? 'before' : 'after';
const output = resolve('output/clarity-lot15', phase);
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-placard-commerce-clarity.mjs', 'utf8')).split('let browser;')[0];
assert(source.includes('const server = await createServer'));
source = source.replace("'output/placard-commerce-clarity'", `'output/clarity-lot15/${phase}'`).replace('?? 3251', '?? 3625')
  .replace("'react-dom/client','lucide-react'", "'react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react'")
  .replace('    const request = async', () => `
    const fixture = params.get('case') ?? 'raw';
    const request = async`)
  .replace('if(method !== \'GET\') window.__actions.push(body);', () => `
      if(method !== 'GET') window.__actions.push(body);
      if(method === 'GET' && window.__failRefresh) return Response.json({error:'Actualisation indisponible pour cette recette.'},{status:503});
      if(method !== 'GET' && fixture === 'changed') return Response.json({error:'Le coût a changé. Actualise la préparation.'},{status:409});
      if(method !== 'GET' && fixture !== 'raw') throw Error('Fixture is read-only: '+fixture);`)
  .replace('        return Response.json(result.payload);', () => `
        if(method === 'GET' && url.pathname === '/api/arena/placard/commerce' && result.payload.rawLots?.length){
          const lot = result.payload.rawLots[0];
          if(['partial','biomass-remainder','locked','poor','unknown-time','changed'].includes(fixture)){
            lot.harvestGrams=250;
            if(lot.storage?.capacity)lot.storage.capacity.totalUnits=2500;
            for(const quote of lot.options.filter(q=>q.route==='raw'||q.route==='biomass'))Object.assign(quote,{processedInputGrams:250,productGrams:250,remainderGrams:0});
            Object.assign(lot.options.find(q=>q.route==='dry-sift'),{
              available:fixture!=='locked',blockedReason:fixture==='locked'?'Installe un tamis pour préparer ce produit.':null,
              processedInputGrams:200,productGrams:36,remainderGrams:50,
              remainderDestination:fixture==='biomass-remainder'?'biomass':'raw',
              processingDurationSeconds:fixture==='unknown-time'?undefined:7200,
              market:{...lot.options.find(q=>q.route==='dry-sift').market,processingCostCents:1250}
            });
            if(fixture==='poor') result.payload.cashCents=500;
          }
          if(fixture==='overflow')lot.storage.capacity={...lot.storage.capacity,overflowUnits:300};
          window.__snapshot=structuredClone(result.payload);
        }
        return Response.json(result.payload);`);
source += String.raw`
let browser,page;const errors=[],external=[],checks=[];
const before=process.argv.includes('--before');
try{
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
 page.on('request',r=>{if(r.url().startsWith(origin)||r.url().startsWith('data:'))void r.continue();else{external.push(r.url());void r.abort();}});
 const click=async label=>{const h=await page.evaluateHandle(label=>[...document.querySelectorAll('button,summary')].find(n=>n.checkVisibility()&&n.textContent.trim().startsWith(label)),label);const n=h.asElement();assert(n,'Missing '+label);await n.scrollIntoView();await n.click();await h.dispose();};
 const clean=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No page overflow');if(await page.$('dialog[open]'))assert.equal(await page.$eval('dialog[open]',n=>n.scrollWidth>n.clientWidth+1),false,'No dialog overflow');};
 const show=async name=>{await page.goto(origin+'/?flower=selected&case='+name,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.querySelector('#commerce-step-title')?.textContent==='Préparer ma récolte');await page.evaluate(()=>document.fonts.ready);if(name!=='raw'&&name!=='overflow'){await page.select('select','dry-sift');await page.waitForFunction(()=>document.querySelector('select')?.value==='dry-sift');}};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await show('raw');
  const position=await page.evaluate(()=>{const n=[...document.querySelectorAll('button')].find(n=>n.textContent.startsWith('Préparer les fleurs et continuer'));const s=document.querySelector('select');return {actionBottom:Math.round(n.getBoundingClientRect().bottom+scrollY),choiceTop:Math.round(s.getBoundingClientRect().top+scrollY),actionHeight:n.getBoundingClientRect().height};});
  await clean();assert.equal(await page.evaluate(()=>window.__actions.length),0);await page.screenshot({path:resolve(output,'raw-'+width+'.png'),fullPage:true});checks.push({width,case:'raw',...position});
  if(before)continue;
  assert(position.actionHeight>=44);
  assert.match(await page.$eval('[data-preparation-summary]',n=>n.textContent),/Sans passage en atelier/);
  await page.focus('select');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.dataset.prepareLot),true,'Next action follows selector');
  await page.keyboard.press('Enter');await page.waitForSelector('dialog[open]');assert.match(await page.$eval('dialog',n=>n.textContent),/Lot operatio/);
  assert.match(await page.$eval('dialog [data-preparation-summary]',n=>n.textContent),/0\s*€/);await clean();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await page.evaluate(()=>!!document.activeElement.dataset.prepareLot),true,'Focus returns to preparation');assert.equal(await page.evaluate(()=>window.__actions.length),0,'Cancel is read-only');
  await click('Détails du produit');assert.equal(await page.$eval('[data-preparation-details]',n=>n.open),true);await click('Récolte, qualité et stockage');
  assert(await page.$eval('[data-commerce-open-lot-storage]',n=>n.checkVisibility()));const link=new URL(await page.$eval('[data-commerce-open-lot-storage]',n=>n.href));assert.equal(link.searchParams.get('flower'),await page.evaluate(()=>window.__snapshot.rawLots[0].flowerId));assert.equal(link.searchParams.get('fromLot'),'raw:'+link.searchParams.get('flower'));await clean();checks.push({width,case:'keyboard-and-cancel',focusRestored:true,detailsAccessible:true,exactStorageTarget:true});
  for(const name of ['partial','biomass-remainder','locked','poor','unknown-time','overflow']){
   await show(name);const text=await page.$eval('[data-commerce-preparation]',n=>n.textContent);
   if(name==='overflow'){assert.match(text,/30 g/);assert(await page.$eval('[data-prepare-lot]',n=>n.disabled));const href=await page.$eval('[data-commerce-preparation] [role="status"] a',n=>n.href);assert.equal(new URL(href).searchParams.get('flower'),await page.evaluate(()=>window.__snapshot.rawLots[0].flowerId));}
   else{
    assert.match(text,/200 g/);assert.match(text,/36 g/);assert.match(text,/50 g/);assert.match(text,/12,50/);
    if(name==='locked'){assert.match(text,/Installe un tamis/);assert(await page.$eval('[data-prepare-lot]',n=>n.disabled));}
    else if(name==='poor'){assert.match(text,/7,50/);assert.match(text,/5\s*€/);assert(await page.$eval('[data-prepare-lot]',n=>n.disabled));}
    else{
     if(name==='unknown-time')assert.match(text,/Durée à confirmer/);else assert.match(text,/120 min/);
     if(name==='biomass-remainder')assert.match(text,/50 g de biomasse/);else assert.match(text,/50 g de fleurs/);
     await click('Transformer et continuer');await page.waitForSelector('dialog[open]');const review=await page.$eval('dialog',n=>n.textContent);assert.match(review,/200 g/);assert.match(review,/36 g/);assert.match(review,/50 g/);assert.match(review,/12,50/);assert.match(review,/vente sera choisie/);await clean();
     await page.screenshot({path:resolve(output,name+'-confirm-'+width+'.png')});await page.keyboard.press('Escape');
    }
   }
   assert.equal(await page.evaluate(()=>window.__actions.length),0);await clean();await page.screenshot({path:resolve(output,name+'-'+width+'.png'),fullPage:true});checks.push({width,case:name,readOnly:true});
  }
 }
 if(!before){
  await show('raw');await page.select('select','biomass');await click('Préparer la biomasse et continuer');await page.waitForSelector('dialog[open]');assert.match(await page.$eval('dialog',n=>n.textContent),/Biomasse/);assert.match(await page.$eval('dialog',n=>n.textContent),/Sans passage en atelier/);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__actions.length),0);checks.push({case:'biomass',noTransformationClaim:true});
  await show('raw');await page.evaluate(()=>{window.__failRefresh=true;window.__refreshCommerce();});await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent.includes('Actualisation indisponible'));assert(await page.$eval('[data-prepare-lot]',n=>n.disabled));await page.evaluate(()=>{window.__failRefresh=false;window.__refreshCommerce();});await page.waitForFunction(()=>!document.querySelector('[data-prepare-lot]').disabled);assert.equal(await page.evaluate(()=>window.__actions.length),0);checks.push({case:'stale-and-recovered',noPreparationFromFailedRefresh:true});
  await page.setViewport({width:320,height:568,isMobile:true,hasTouch:true});await show('changed');await click('Transformer et continuer');await page.waitForSelector('dialog[open]');await clean();await click('Confirmer');await page.waitForFunction(()=>document.querySelector('dialog [role="alert"]')?.textContent.includes('Le coût a changé'));assert.equal(await page.evaluate(()=>window.__actions.length),1);await page.keyboard.press('Escape');assert.equal(await page.$eval('main[data-screen]',n=>n.dataset.screen),'preparation');checks.push({case:'changed-cost',width:320,height:568,noFalseSuccess:true});
  await show('raw');await click('Préparer les fleurs et continuer');await page.waitForSelector('dialog[open]');await click('Confirmer');await page.waitForSelector('[aria-label="Circuits de vente"]');
  const command=await page.evaluate(()=>window.__actions[0]);assert.equal(command.flowerId,await page.evaluate(()=>window.__snapshot.rawLots[0].flowerId));assert.equal(command.route,'raw');assert.equal(command.expectedCostCents,0);assert(command.requestKey);
  await page.click('[aria-label="Voir l’offre Grossistes"]');await click('Voir le montant net');await page.waitForSelector('dialog[open]');assert.match(await page.$eval('dialog',n=>n.textContent),/Versé au portefeuille/);await click('Confirmer');await page.waitForFunction(()=>document.querySelector('#commerce-step-title')?.textContent==='Vente terminée');
  assert.deepEqual(await page.evaluate(()=>window.__actions.map(a=>a.action)),['prepare','quote','sell']);await clean();checks.push({case:'prepare-quote-sell',width:320,height:568,exactFlower:true,localLessonOnly:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({checks:checks.length,errors,external}));
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,external},null,2));if(browser){const timer=setTimeout(()=>browser.process()?.kill(),5000);try{await browser.close();}finally{clearTimeout(timer);}}server.httpServer?.closeAllConnections();await server.close();}
`;
const runtime=resolve(output,'run.mjs');await writeFile(runtime,source);await import(pathToFileURL(runtime).href);
