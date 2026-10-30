/** Actual harvest/storage components; synthetic read-only fixtures, no account operations. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/clarity-lot11/actions');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-placard-harvests-navigation.mjs', 'utf8')).split('let browser,page;')[0];
assert(source.includes('const server = await createServer'));
source = source.replace("'output/placard-harvests-navigation'", "'output/clarity-lot11/actions'")
  .replace('const port = 3254', 'const port = 3612')
  .replace("if(query.has('empty'))", () => `
    const copy=(index,id,status)=>({...structuredClone(lots[index]),flowerId:id,varietyName:'Variété '+id,flowerStatus:status});
    const empty=copy(0,'empty','burned');Object.assign(empty.projection.capacity,{totalUnits:0,protectedUnits:0,overflowUnits:0,allocations:[]});
    const unknown=copy(0,'unknown','burned');delete unknown.projection.capacity.totalUnits;
    const invalid=copy(0,'invalid-phase','burned');invalid.projection.stage='unknown';
    const juryLot=(id,status)=>{const lot=copy(0,id,status);lot.projection.capacity=structuredClone(lots[2].projection.capacity);return lot;};
    storage.lots=[juryLot('duel-overflow','locked'),juryLot('queue-overflow','queued'),juryLot('jury-overflow','available'),empty,unknown,invalid,copy(1,'before-jury','available'),lots[0],lots[1]];
    flowers.length=0;
    if(query.has('empty'))`)
  .replaceAll("onOpenMarket={flowerId=>window.__links.push({view:'market',flowerId})}", "onOpenMarket={(flowerId,section)=>window.__links.push({view:'market',flowerId,section})}")
  .replaceAll("onOpenMarket={id=>window.__links.push({view:'market',flowerId:id})}", "onOpenMarket={(id,section)=>window.__links.push({view:'market',flowerId:id,section})}")
  .replace(':root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}', '@font-face{font-family:HarvestBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2)}@font-face{font-family:HarvestDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}:root{--font-display:HarvestDisplay;--font-body:HarvestBody;--font-sans:HarvestBody}');
source += String.raw`
let browser,page;const errors=[],external=[],checks=[];
const report=()=>writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,external},null,2));
try{
  await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
  page.on('request',request=>{if(request.url().startsWith(origin)||request.url().startsWith('data:'))void request.continue();else{external.push(request.url());void request.abort();}});
  const click=async selector=>{const handle=await page.waitForSelector(selector,{visible:true});await handle.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await handle.click();await handle.dispose();};
  const lastLink=()=>page.evaluate(()=>window.__links.at(-1));
  const row=id=>'[data-harvest-id="'+id+'"]';
  const texts=selector=>page.$$eval(selector+' button',nodes=>nodes.map(n=>n.textContent.trim()));
  for(const width of [320,390,1440]){
    await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
    await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector(row('empty'));await page.evaluate(()=>document.fonts.ready);
    for(const [id,label] of [['duel-overflow','Suivre le duel'],['queue-overflow','Suivre le duel'],['jury-overflow','Présenter au jury']]){
      assert.deepEqual(await texts(row(id)),['Protéger le surplus',label]);
      await page.focus(row(id)+' [data-harvest-action="storage"]');await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.harvestAction),'arena');
      await page.keyboard.press('Enter');assert.deepEqual(await lastLink(),{view:'arena',flowerId:id});
      checks.push({width,case:id,juryAccess:true,keyboard:true});
    }
    await page.select('[data-placard-harvests] select','jury');
    assert.deepEqual(await page.$$eval('[data-harvest-id]',nodes=>nodes.map(n=>n.dataset.harvestId)),['duel-overflow','queue-overflow','jury-overflow']);
    await page.select('[data-placard-harvests] select','all');
    for(const id of ['unknown','invalid-phase'])assert.deepEqual(await texts(row(id)),['Vérifier le stockage']);
    assert.deepEqual(await texts(row('before-jury')),['Gérer le stockage']);
    assert.deepEqual(await texts(row('empty')),['Voir mon stock en vente']);
    await click(row('empty')+' button');assert.deepEqual(await lastLink(),{view:'market',flowerId:'empty',section:'dashboard'});
    for(const id of ['ready-flower','curing-flower']){await click(row(id)+' [data-harvest-action="market"]');assert.deepEqual(await lastLink(),{view:'market',flowerId:id,section:'sales'});}
    await page.$eval(row('duel-overflow'),node=>node.scrollIntoView({block:'start',behavior:'instant'}));
    await page.screenshot({path:resolve(output,'duel-'+width+'.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    checks.push({width,case:'overview',filters:true,emptyVsUnknown:true,noPrematureJury:true,marketSections:true,noOverflow:true});
    await click(row('duel-overflow')+' [data-harvest-open-storage]');
    await page.waitForSelector('[data-conservation-lot="duel-overflow"][data-selected]');
    assert.equal(await page.$eval('[data-conservation-lot="duel-overflow"]',node=>node===document.activeElement),true);
    await page.waitForFunction(()=>!document.querySelector('[data-open-commerce="empty"]').disabled);
    await click('[data-open-commerce="empty"]');assert.deepEqual(await lastLink(),{view:'market',flowerId:'empty',section:'dashboard'});
    assert(!(await texts('[data-conservation-lot="empty"]')).includes('Choisir un contenant'));
    for(const id of ['unknown','invalid-phase']){
      assert.equal(await page.$('[data-conservation-lot="'+id+'"] [data-open-commerce]'),null);
      assert((await texts('[data-conservation-lot="'+id+'"]')).includes('Vérifier le lot'));
    }
    assert.equal(await page.$('[data-conservation-lot="before-jury"] [data-open-jury]'),null);
    await page.$eval('[data-conservation-lot="empty"]',node=>node.scrollIntoView({block:'start',behavior:'instant'}));
    await page.screenshot({path:resolve(output,'empty-storage-'+width+'.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    checks.push({width,case:'storage',emptyVsUnknown:true,lotFocus:true,noPrematureJury:true,marketSection:true,noOverflow:true});
    await click('[data-harvest-open-warehouse]');await page.waitForSelector('[data-storage-protection-target="duel-overflow"]');
    await page.waitForFunction(()=>!document.querySelector('[data-open-commerce="empty"]').disabled);
    await click('[data-open-commerce="empty"]');assert.deepEqual(await lastLink(),{view:'market',flowerId:'empty',section:'dashboard'});
    checks.push({width,case:'warehouse-storage',marketSection:true});
    assert.equal(await page.evaluate(()=>window.__snapshot()===window.__initial),true);
    assert.equal(await page.evaluate(()=>window.__calls.some(c=>c.method!=='GET')),false);
  }
  await page.goto(origin+'/?fail=storage',{waitUntil:'networkidle0'});await page.waitForSelector('[role="alert"]');
  assert.equal(await page.$('[data-harvest-id]'),null);assert(!await page.evaluate(()=>document.body.textContent.includes('Ta prochaine récolte commence ici')));
  await page.evaluate(()=>window.__recover());await click('[aria-label="Actualiser les récoltes"]');await page.waitForSelector(row('empty'));
  checks.push({case:'partial-failure',noFalseEmpty:true,recovery:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({checks:checks.length,errors,external}));
}finally{await report();if(browser)await browser.close();await server.close();}
`;
const runtime = resolve(output, 'run.mjs');
await writeFile(runtime, source);
await import(pathToFileURL(runtime).href);
