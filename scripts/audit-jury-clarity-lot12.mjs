/** Actual jury/reserve/history; local read-only fixtures. No duel is submitted. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/clarity-lot12/jury');
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-ux-jury.mjs', 'utf8')).split('let browser,page;')[0];
assert(source.includes('const server=await createServer'));
source = source.replace("'output/ux-implementation/jury'", "'output/clarity-lot12/jury'").replace('??3270', '??3620')
  .replace('const session=()=>', 'const originalSession=()=>')
  .replace('    window.fetch=async', () => `
    const receipts=()=>Array.from({length:7},(_,i)=>({...structuredClone(battle),id:i===6?'wanted-receipt':'receipt-'+i,playerFlower:{...battle.playerFlower,id:i===6?flower.id:'other-'+i},verdictAt:new Date(Date.parse(flower.createdAt)-i*60000).toISOString()}));
    const session=()=>{
      const base=originalSession();
      if(state.mode==='locked')return {...base,flowers:[{...base.flowers[0],status:'available'}],battles:[{...battle,id:'locked-target',status:'locked',winner:null,rounds:[],verdictAt:null}]};
      if(state.mode==='receipt')return {...base,flowers:[{...base.flowers[0],status:'burned'}],battles:receipts()};
      if(['archived','history-error','empty'].includes(state.mode))return {...base,flowers:[],battles:[]};
      if(state.mode==='missing')return {...base,flowers:[{...base.flowers[0],id:'other-flower'}],battles:[]};
      return base;
    };
    window.fetch=async`)
  .replace('state.requests.push({path,method,time:performance.now()});', () => `state.requests.push({path,method,time:performance.now()});
      if(method!=='GET')throw Error('Read-only fixture rejected '+method+' '+path);
      if(state.mode==='unavailable'&&['bootstrap','session'].includes(path.split('/').at(-1)))return Response.json({error:'Lecture du jury indisponible.'},{status:503});
      if(path.endsWith('/battles')&&state.mode==='history-error'&&!state.recovered)return Response.json({error:'Historique indisponible.'},{status:503});
      if(path.endsWith('/battles')&&['archived','history-error'].includes(state.mode))return Response.json({battles:receipts()});`)
  .replace("apiScope='player' showAdminOperations", "initialFlowerId={['normal','empty'].includes(mode)?undefined:'flower-demo'} apiScope='player' showAdminOperations")
  .replace("onOpenMarket={()=>{document.body.dataset.navigated='market'}}", "onOpenMarket={id=>{document.body.dataset.navigated='market:'+id}}")
  .replace("window.__showJury('success');", "window.__showJury('normal');");
source += String.raw`
let browser,page;const errors=[],external=[],checks=[];
try{
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',request=>{if(request.url().startsWith(origin)||request.url().startsWith('data:'))void request.continue();else{external.push(request.url());void request.abort();}});
 const click=async selector=>{const handle=await page.waitForSelector(selector,{visible:true});await handle.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await handle.click();await handle.dispose();};
 const show=async mode=>{await page.evaluate(mode=>window.__showJury(mode),mode);await page.waitForFunction(()=>!document.querySelector('[data-jury-loading]')||document.querySelector('[data-jury-loading][role="alert"]'));await page.evaluate(()=>document.fonts.ready);};
 const focused=id=>page.waitForFunction(id=>document.activeElement?.dataset.battleId===id,{},id);
 const clean=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await page.evaluate(()=>window.__jury.requests.some(r=>r.method!=='GET')),false);};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector('[data-culture-training-flower]');await page.evaluate(()=>document.fonts.ready);
  const initial=await page.evaluate(()=>({reserveY:document.getElementById('placard-reserve').getBoundingClientRect().top,seasonOpen:document.querySelector('[data-jury-season]').open,seasonBeforeReserve:!!(document.getElementById('placard-reserve').compareDocumentPosition(document.querySelector('[data-jury-season]'))&Node.DOCUMENT_POSITION_PRECEDING)}));
  assert(!initial.seasonOpen&&!initial.seasonBeforeReserve);assert(initial.reserveY<500,'Reserve begins in the first viewport');
  await page.screenshot({path:resolve(output,'normal-'+width+'.png')});await clean();checks.push({width,case:'normal',...initial});
  await show('locked');await focused('locked-target');
  assert.equal(await page.$('[data-culture-training-flower]'),null,'A confirmed duel wins over the stale available flower');
  const target='[data-pending-battle][data-battle-id="locked-target"]';
  assert.equal(await page.$$eval(target+' button',n=>n.length),1);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-pending-battle]')?.dataset.battleId),'locked-target');
  await page.keyboard.press('Enter');await page.waitForSelector('#official-verdict-title');
  assert.match(await page.$eval('[data-jury-stock-consequence]',n=>n.textContent),/conservé/);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await clean();
  await page.$eval(target,n=>n.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:resolve(output,'locked-'+width+'.png')});checks.push({width,case:'locked',targetFocus:true,singleVerdictAction:true,keyboardConfirmation:true});
  await show('receipt');await focused('wanted-receipt');
  assert.equal(await page.$('[data-status="burned"]'),null,'Consumed flowers no longer crowd the reserve');
  assert(await page.$eval('[data-battle-id="wanted-receipt"]',n=>n.open));
  assert.equal(await page.$eval('[data-battle-statistics]',n=>n.open),false);
  await click('[data-battle-open-lot="flower-demo"]');assert.equal(await page.evaluate(()=>document.body.dataset.navigated),'market:flower-demo');
  await click('[data-battle-id="wanted-receipt"] > summary');assert.equal(await page.$eval('[data-battle-id="wanted-receipt"]',n=>n.open),false);
  await click('[aria-label="Voir les combats plus récents"]');assert.equal(await page.$('[data-battle-id="wanted-receipt"]'),null,'Manual pagination is respected');
  await clean();checks.push({width,case:'receipt',correctPage:true,exactLot:true,closedStatistics:true,manualPagination:true});
  await show('archived');await page.waitForSelector('[data-jury-selection="missing"]');await click('[data-jury-selection] button');await focused('wanted-receipt');await clean();checks.push({width,case:'archived',loadThenFocus:true});
  await show('missing');await page.waitForSelector('[data-jury-selection]');await click('[data-jury-selection] button');await page.waitForFunction(()=>document.querySelector('[data-jury-selection]').textContent.includes('duels récents chargés'));
  assert.equal(await page.$eval('[data-jury-selection]',n=>n===document.activeElement||n.contains(document.activeElement)),true,'An unrelated flower never takes focus');
  await clean();checks.push({width,case:'missing',noSubstitution:true});
  await show('empty');assert(!await page.evaluate(()=>document.body.textContent.includes('Ton palmarès commence ici')));await clean();checks.push({width,case:'empty',noInventedFirstVisit:true});
 }
 await show('unavailable');assert.equal(await page.$('[data-culture-training-flower]'),null);assert(!await page.evaluate(()=>document.body.textContent.includes('Aucune Fleur en attente')));
 await page.evaluate(()=>{window.__jury.mode='normal';});await click('[data-jury-loading] button');await page.waitForSelector('[data-culture-training-flower]');await clean();checks.push({case:'unavailable',retry:true,noFalseEmpty:true});
 await show('history-error');await click('[data-jury-selection] button');await page.waitForSelector('[data-jury-selection] [role="alert"]');await page.evaluate(()=>{window.__jury.recovered=true;});await click('[data-jury-selection] button');await focused('wanted-receipt');await clean();checks.push({case:'history-error',retryToExactLot:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({checks:checks.length,errors,external}));
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png')});throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors,external},null,2));if(browser)await browser.close();await server.close();}
`;
const runtime = resolve(output, 'run.mjs');
await writeFile(runtime, source);
await import(pathToFileURL(runtime).href);
