/** Extend the local Commerce fixture with quantity editing and quote-only checks. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const phase=process.argv.includes('--before')?'before':'after',output=resolve('output/clarity-lot17',phase);
await mkdir(output,{recursive:true});
let recipe=(await readFile('scripts/audit-sales-channels-lot16.mjs','utf8')).split('source+=String.raw`')[0]
 .replaceAll('clarity-lot16','clarity-lot17').replaceAll("?? 3626","?? 3627");
recipe+=String.raw`
source=source.replace("      if(method==='GET'&&window.__failRefresh)","      if(method==='POST'&&window.__quoteError&&body.action==='quote')return Response.json({error:'Le calcul du versement est momentanément indisponible.'},{status:503});\n      if(method==='GET'&&window.__failRefresh)")
 .replace('          window.__snapshot=structuredClone(snapshot);',()=>"          if(window.__cap!==undefined)snapshot.wholesale={remainingEquivalentUnits:window.__cap,capacityEquivalentUnits:10000,resetsAt:later};\n          window.__snapshot=structuredClone(snapshot);\n          window.__offer=(channel,units)=>quoteKqCommerce(snapshot,stock,channel,'advised',units,state.trial.clock);");
`;
recipe+='source+= '+JSON.stringify(String.raw`
let browser,page;const checks=[],errors=[],external=[];const before=process.argv.includes('--before');
try{
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.setRequestInterception(true);page.on('request',r=>{if(r.url().startsWith(origin)||r.url().startsWith('data:'))void r.continue();else{external.push(r.url());void r.abort();}});
 const click=async label=>{const h=await page.evaluateHandle(label=>[...document.querySelectorAll('button,summary')].find(n=>n.checkVisibility()&&n.textContent.trim().startsWith(label)),label);const n=h.asElement();assert(n,'Missing '+label);await n.scrollIntoView();await n.click();await h.dispose();};
 const show=async(channel='wholesale',mode='ready')=>{await page.goto(origin+'/?prepared&flower=selected&case='+mode,{waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Circuits de vente"]');await page.click('[aria-label="Voir l’offre '+(channel==='wholesale'?'Grossistes':channel==='cbd-shop'?'CBD shops':'Vente en ligne')+'"]');await page.waitForSelector('[data-screen="offer"]');await page.evaluate(()=>document.fonts.ready);};
 const clean=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);if(await page.$('dialog[open]'))assert.equal(await page.$eval('dialog',n=>n.scrollWidth>n.clientWidth+1),false);};
 const fill=async value=>{await page.focus('input[type="number"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');if(value)await page.type('input[type="number"]',value);await page.waitForFunction(v=>document.querySelector('input[type="number"]').value===v,{},value);};
 const shot=async name=>page.screenshot({path:resolve(output,name+'.png'),fullPage:true});
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
  for(const channel of ['wholesale','cbd-shop']){
   await show(channel);const position=await page.evaluate(()=>{const n=document.querySelector('[data-sale-review]')??[...document.querySelectorAll('button')].find(n=>n.textContent.startsWith('Vendre ce lot'));const r=n.getBoundingClientRect(),input=document.querySelector('input[type="number"]');return {reviewBottom:Math.round(r.bottom+scrollY),reviewHeight:r.height,quantityVisible:input.checkVisibility()};});await clean();await shot(channel+'-'+width);checks.push({width,channel,case:'initial',...position});if(before)continue;
   assert(position.quantityVisible);assert(position.reviewHeight>=44);assert(Number(await page.$eval('input[type="number"]',n=>n.value))>0);assert.equal(await page.evaluate(()=>window.__actions.length),0);
   await fill('20.1');await page.waitForFunction(()=>document.querySelector('[data-sale-estimate]')?.textContent.includes('20,1 g'));
   const expected=await page.evaluate(c=>window.__offer(c,201),channel);assert.equal(expected.units,201);assert.match(await page.$eval('[data-sale-estimate]',n=>n.textContent),/102,3 g/);assert.equal(await page.$eval('[data-sale-review]',n=>n.disabled),false);
   await fill('');assert.equal(await page.$eval('input[type="number"]',n=>n.getAttribute('aria-invalid')),'true');assert(await page.$eval('[data-sale-review]',n=>n.disabled));assert.equal(await page.$('[data-sale-estimate]'),null,'Invalid quantity does not show a clamped estimate');
   await click('Maximum');assert.equal(await page.$eval('input[type="number"]',n=>Number(n.value)),await page.evaluate(c=>window.__offer(c).maxUnits/10,channel));
   await fill('20.1');await page.focus('[data-sale-review]');await page.keyboard.press('Enter');await page.waitForSelector('dialog[open]');const command=await page.evaluate(()=>window.__actions[0]);assert.equal(command.action,'quote');assert.equal(command.stockId,'operations-stock');assert.equal(command.channel,channel);assert.equal(command.units,201);assert.match(await page.$eval('dialog',n=>n.textContent),/Versé au portefeuille/);await clean();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-sale-review')),true);assert.equal(await page.$eval('input[type="number"]',n=>n.value),'20.1');assert.deepEqual(await page.evaluate(()=>window.__actions.map(a=>a.action)),['quote']);
   await click('Commandes et fonctionnement');await page.waitForFunction(()=>document.querySelector('[data-sale-conditions]')?.open);assert(await page.$eval('[data-sale-conditions] img',n=>n.checkVisibility()));await clean();await shot(channel+'-details-'+width);checks.push({width,channel,case:'edit-quote-cancel',tenthsPreserved:true,noSale:true});
  }
  if(before)continue;
  for(const [mode,channel] of [['quota','wholesale'],['processing','wholesale'],['curing','cbd-shop'],['low-quality','cbd-shop'],['partial','wholesale']]){
   await show(channel,mode);await clean();if(mode==='partial'){assert.equal(await page.$eval('input[type="number"]',n=>n.value),'30');await fill('40');assert(await page.$eval('[data-sale-review]',n=>n.disabled));assert.equal(await page.$('[data-sale-estimate]'),null);}else{assert.equal(await page.$('[data-sale-review]'),null);assert(await page.$('[data-sale-blocked]'));assert.match(await page.$eval('[data-sale-blocked]',n=>n.textContent),/cours|revient|refuse/);}
   assert.equal(await page.evaluate(()=>window.__actions.length),0);await shot(mode+'-'+width);checks.push({width,case:mode,noPrematureSale:true});
  }
 }
 if(!before){
  await show();for(const value of ['0','-1','0.05','100000']){await fill(value);assert(await page.$eval('[data-sale-review]',n=>n.disabled));assert.equal(await page.$('[data-sale-estimate]'),null);}
  await fill('20');await page.evaluate(()=>{window.__cap=100;window.__refreshCommerce();});await page.waitForFunction(()=>document.querySelector('input[type="number"]').max==='10');assert.equal(await page.$eval('input[type="number"]',n=>n.value),'20');assert(await page.$eval('[data-sale-review]',n=>n.disabled));await click('Maximum');assert.equal(await page.$eval('input[type="number"]',n=>n.value),'10');checks.push({case:'invalid-and-reduced-capacity',explicitCorrection:true});
  await show();await fill('20');await page.evaluate(()=>{window.__failRefresh=true;window.__refreshCommerce();});await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent.includes('Comparaison indisponible'));assert(await page.$eval('[data-sale-review]',n=>n.disabled));await page.evaluate(()=>{window.__failRefresh=false;window.__refreshCommerce();});await page.waitForFunction(()=>!document.querySelector('[data-sale-review]').disabled);assert.equal(await page.$eval('input[type="number"]',n=>n.value),'20');checks.push({case:'refresh-recovery',quantityPreserved:true});
  await page.evaluate(()=>window.__quoteError=true);await click('Voir le montant net');await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent.includes('calcul du versement'));assert.equal(await page.$('dialog[open]'),null);assert.equal(await page.$eval('input[type="number"]',n=>n.value),'20');await page.evaluate(()=>window.__quoteError=false);await click('Voir le montant net');await page.waitForSelector('dialog[open]');await click('Confirmer');await page.waitForSelector('[data-screen="receipt"]');assert.deepEqual(await page.evaluate(()=>window.__actions.map(a=>a.action)),['quote','quote','sell']);checks.push({case:'quote-recovery-and-sale',oneSale:true});
  await show('online','legacy');assert(await page.$eval('input[type="number"]',n=>n.checkVisibility()));await click('Ajuster mon prix');await click('Ambitieux');assert.equal(await page.$eval('fieldset button[aria-pressed="true"]',n=>n.textContent),'Ambitieux · +22 %');await clean();assert.equal(await page.evaluate(()=>window.__actions.length),0);checks.push({case:'legacy-online',pricePoliciesPreserved:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({checks:checks.length,errors,external}));
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,external},null,2));if(browser){const timer=setTimeout(()=>browser.process()?.kill(),5000);try{await browser.close();}finally{clearTimeout(timer);}}server.httpServer?.closeAllConnections();await server.close();}
`)+`;const runtime=resolve(output,'run.mjs');await writeFile(runtime,source);await import(pathToFileURL(runtime).href);`;
const file=resolve(output,'recipe.mjs');await writeFile(file,recipe);await import(pathToFileURL(file).href);
