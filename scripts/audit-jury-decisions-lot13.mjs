/** Real jury, local read-only fixtures. Confirmations open without submitting a duel. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/clarity-lot13/jury');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-ux-jury.mjs', 'utf8')).split('let browser,page;')[0];
assert(source.includes('const server=await createServer'));
source = source.replace("'output/ux-implementation/jury'", "'output/clarity-lot13/jury'").replace('??3270', '??3622')
  .replace("include:['react','react-dom/client'", "include:['react','react-dom','react-dom/client'")
  .replace('import {createKqCareState}', 'import {createKqCareState,getKqCannabinoidReport}')
  .replace('const session=()=>', 'const originalSession=()=>')
  .replace('    window.fetch=async', () => `
    const session=()=>{
      const base=originalSession();
      base.flowers[0].cannabinoidReport=getKqCannabinoidReport({varietyCode:flower.varietyCode,care:createKqCareState()});
      if(['multiple','target'].includes(state.mode))return {...base,flowers:Array.from({length:4},(_,i)=>({...base.flowers[0],id:'flower-'+i,varietyName:i===1?'Variété au nom particulièrement long pour vérifier la lisibilité sur petit écran':'Fleur de recette '+(i+1),quality:84-i}))};
      if(state.mode==='locked')return {...base,flowers:[{...base.flowers[0],status:'available'}],battles:[{...battle,id:'locked-target',status:'locked',winner:null,rounds:[],verdictAt:null}]};
      return base;
    };
    window.fetch=async`)
  .replace('state.requests.push({path,method,time:performance.now()});', () => `state.requests.push({path,method,time:performance.now()});if(method!=='GET')throw Error('Read-only fixture rejected '+method+' '+path);`)
  .replace("apiScope='player' showAdminOperations", "initialFlowerId={mode==='target'?'flower-2':undefined} apiScope='player' showAdminOperations")
  .replace('root.render(<KanabQuestDicePrototype key={++key}', 'root.render(<div key={++key} data-jury-fixture-mode={mode}><KanabQuestDicePrototype')
  .replace("onOpenMarket={()=>{document.body.dataset.navigated='market'}}/>);", "onOpenMarket={()=>{document.body.dataset.navigated='market'}}/></div>);");
source += String.raw`
let browser,page;const errors=[],external=[],checks=[];
try{
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',request=>{if(request.url().startsWith(origin)||request.url().startsWith('data:'))void request.continue();else{external.push(request.url());void request.abort();}});
 const click=async selector=>{const handle=await page.waitForSelector(selector,{visible:true});await handle.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await handle.click();await handle.dispose();};
 const show=async mode=>{await page.evaluate(mode=>window.__showJury(mode),mode);await page.waitForFunction(mode=>document.querySelector('[data-jury-fixture-mode]')?.dataset.juryFixtureMode===mode&&!!document.querySelector('[data-jury-flower-details]')&&!document.querySelector('[data-jury-loading]'),{},mode);await page.evaluate(()=>document.fonts.ready);};
 const clean=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal overflow');assert.equal(await page.evaluate(()=>window.__jury.requests.some(r=>r.method!=='GET')),false,'No mutation');};
 const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector('[data-culture-training-flower]');await page.evaluate(()=>document.fonts.ready);
  const initial=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
   return {ranked:rect('[data-culture-ranked-flower]'),training:rect('[data-culture-training-flower]'),detailsOpen:document.querySelector('[data-jury-flower-details]').open,cardVisible:document.querySelector('[data-status="available"]').checkVisibility(),copy:document.getElementById('jury-flower-use-flower-demo').textContent};
  });
  assert(initial.ranked.bottom<844&&initial.training.bottom<844,'Both modes in initial isolated viewport');assert(initial.ranked.height>=44&&initial.training.height>=44);assert(!initial.detailsOpen&&!initial.cardVisible);assert.match(initial.copy,/consommée au verdict/);assert.match(initial.copy,/stock récolté est conservé/);
  assert(await page.$$eval('[data-jury-flower-details] > summary, #placard-reserve > details > summary, [data-jury-season] > summary',nodes=>nodes.every(n=>getComputedStyle(n).flexDirection==='row'&&n.querySelector('svg'))),'Disclosure arrows stay beside their labels');
  await page.screenshot({path:resolve(output,'decisions-'+width+'.png')});await clean();checks.push({width,case:'initial',...initial});
  await page.focus('#placard-flower-flower-demo');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cultureRankedFlower),'flower-demo');await page.keyboard.press('Enter');await page.waitForSelector('#random-queue-title');assert.equal(await page.$eval('[data-jury-confirm-flower]',n=>n.dataset.juryConfirmFlower),'flower-demo');await close();
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.cultureRankedFlower),'flower-demo','Dialog restores focus');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cultureTrainingFlower),'flower-demo');await page.keyboard.press('Enter');await page.waitForSelector('#remote-battle-title');assert.equal(await page.$eval('[data-jury-confirm-flower]',n=>n.dataset.juryConfirmFlower),'flower-demo');assert.match(await page.$eval('[data-jury-stock-consequence]',n=>n.textContent),/définitivement consommée/);await close();
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.parentElement.dataset.juryFlowerDetails),'flower-demo');await page.keyboard.press('Enter');assert.equal(await page.$eval('[data-jury-flower-details]',n=>n.open),true);assert.equal(await page.$eval('[data-status="available"]',n=>n.checkVisibility()),true);await clean();
  await click('[data-cannabinoid-report] > summary');assert.equal(await page.$eval('[data-cannabinoid-report]',n=>n.open),true);await clean();
  await page.screenshot({path:resolve(output,'card-expanded-'+width+'.png'),fullPage:true});checks.push({width,case:'keyboard',rankedThenTrainingThenDetails:true,confirmExactFlower:true,focusRestored:true,analysisAccessible:true});
  for(const mode of ['curing','unknown','locked']){
   await show(mode);assert.equal(await page.$('[data-culture-ranked-flower]'),null);assert.equal(await page.$('[data-culture-training-flower]'),null);
   if(mode==='locked'){await click('[data-culture-follow-duel]');await page.waitForFunction(()=>document.activeElement?.dataset.battleId==='locked-target');}
   else{if(mode==='curing')assert.equal(await page.$eval('[role="meter"]',n=>n.getAttribute('aria-valuenow')),'50');else assert.match(await page.$eval('[data-culture-curing]',n=>n.textContent),/à vérifier/);await click('[data-culture-open-storage]');assert.equal(await page.evaluate(()=>document.body.dataset.navigated),'storage:flower-demo');}
   await clean();checks.push({width,case:mode,noPrematureDuel:true});
  }
  await show('multiple');assert.equal(await page.$$eval('[data-jury-flower-details]',n=>n.length),4);assert.equal(await page.$$eval('[data-jury-flower-details][open]',n=>n.length),0);
  const names=await page.$$eval('[id^="jury-flower-name-"]',nodes=>nodes.map(n=>({overflow:n.scrollWidth>n.clientWidth+1,text:n.textContent})));assert(names.every(n=>!n.overflow));await clean();await page.screenshot({path:resolve(output,'multiple-'+width+'.png'),fullPage:true});
  await click('[data-culture-training-flower="flower-1"]');assert.equal(await page.$eval('[data-jury-confirm-flower]',n=>n.dataset.juryConfirmFlower),'flower-1');assert.match(await page.$eval('[data-jury-confirm-flower]',n=>n.textContent),/Variété au nom particulièrement long/);await close();await clean();checks.push({width,case:'multiple',flowers:4,longNameWraps:true,exactSecondFlower:true});
  await show('target');await page.waitForFunction(()=>document.activeElement?.id==='placard-flower-flower-2');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.cultureRankedFlower),'flower-2');await page.keyboard.press('Enter');await page.waitForSelector('#random-queue-title');assert.equal(await page.$eval('[data-jury-confirm-flower]',n=>n.dataset.juryConfirmFlower),'flower-2');await close();await clean();checks.push({width,case:'target',exactThirdFlower:true});
 }
 await page.setViewport({width:320,height:568,isMobile:true,hasTouch:true});await show('success');await click('[data-culture-training-flower]');await page.waitForSelector('#remote-battle-title');assert.equal(await page.$eval('dialog[open]',n=>n.scrollWidth>n.clientWidth+1),false);await close();await clean();checks.push({width:320,height:568,case:'short-screen',confirmationAccessible:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({checks:checks.length,errors,external}));
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png')});throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,external},null,2));if(browser)await browser.close();await server.close();}
`;
const runtime=resolve(output,'run.mjs');
await writeFile(runtime,source);
await import(pathToFileURL(runtime).href);
