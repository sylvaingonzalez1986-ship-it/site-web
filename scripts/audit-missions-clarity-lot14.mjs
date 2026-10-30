/** Real mission center and pin controls; synthetic responses, no game writes. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const baseline = process.argv.includes('--before');
const output = resolve('output/clarity-lot14/' + (baseline ? 'before' : 'after'));
await mkdir(output, { recursive: true });
let source = (await readFile('scripts/audit-pinned-mission.mjs', 'utf8')).split('let browser;')[0];
source = source.replace("'output/pinned-mission-lot4'", JSON.stringify(output.replaceAll('\\', '/'))).replace('port=3493','port=3640')
 .replace("include:['react','react-dom/client'", "include:['react','react-dom','react-dom/client'")
 .replace("window.__mode='progress'", "window.__mode=params.get('mode')||'progress'")
 .replace("const missions=()=>definitions.map", "const originalMissions=()=>definitions.map")
 .replace(' const request=async', () => `
 const missions=()=>originalMissions().map(m=>{
  if(window.__mode==='empty')return null;
  if(window.__mode==='complete')return {...m,claimed:true,unlocked:true,claimable:false,packAvailable:false};
  if(window.__mode==='locked')return {...m,claimed:false,unlocked:false,claimable:false};
  if(window.__mode==='ready'||window.__mode==='unavailable')return {...m,claimed:false,unlocked:m.step===1,claimable:m.step===1,progress:m.target,rewardAvailable:window.__mode!=='unavailable'};
  if(window.__mode==='mixed')return {...m,claimed:false,unlocked:m.step===1,claimable:m.track==='shops'&&m.step===1,progress:m.track==='shops'?m.target:0};
  if(window.__mode==='packs'&&m.code==='first-harvest')return {...m,claimed:true,reward:{kind:'pack',cardCount:3},cardCount:3,entitlementId:'legacy-pack',packAvailable:true};
  return m;
 }).filter(Boolean);
 const request=async`)
 .replace("useState('quartier')", "useState('missions')");
source += `\nconst baseline=${baseline};\n`;
source += String.raw`
let browser,page;const errors=[],checks=[];
try{
 await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});page=await browser.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port===String(port)))void r.continue();else void r.abort();});
 let visitNumber=0;const visit=async mode=>{await page.goto('http://127.0.0.1:'+port+'/?mode='+mode+'&owner=lot14-'+(++visitNumber),{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__gets>0);await page.evaluate(()=>document.fonts.ready);};
 const click=async selector=>{const h=await page.waitForSelector(selector,{visible:true});await h.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));await h.click();await h.dispose();};
 const clean=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No page overflow');assert.deepEqual(await page.evaluate(()=>window.__writes),[]);};
 for(const width of [320,390,1440]){
  await page.setViewport({width,height:844});await visit('progress');await page.waitForSelector('[data-mission-track] button');
  const layout=await page.$eval('[data-mission-track] button',n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}});
  await page.screenshot({path:resolve(output,'progress-'+width+'.png'),fullPage:true});await page.screenshot({path:resolve(output,'viewport-'+width+'.png')});await clean();checks.push({case:'progress',width,...layout});
  if(baseline)continue;
  assert(layout.bottom<844,'First mission action in the initial isolated viewport');assert(layout.height>=44);
  assert.equal(await page.$eval('[data-mission-overview]',n=>n.open),false);
  await page.select('select[aria-label="Filtrer les parcours"]','preparation');assert.equal(await page.$$eval('[data-mission-track]',n=>n.length),1);
  await page.focus('[data-pin-mission="first-curing"]');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-pin-mission="first-curing"]').getAttribute('aria-pressed')==='true');await clean();checks.push({case:'filter-and-pin',width});
  await visit('mixed');await page.waitForSelector('[data-mission-track]');assert.equal(await page.$eval('[data-mission-track]',n=>n.dataset.missionTrack),'shops');await clean();checks.push({case:'ready-first',width});
  await page.select('select[aria-label="Filtrer les parcours"]','ready');assert.equal(await page.$$eval('[data-mission-track]',n=>n.length),1);assert.equal(await page.$eval('[data-mission-track]',n=>n.dataset.missionTrack),'shops');
  await visit('unavailable');await page.waitForSelector('[data-mission-track]');assert.equal(await page.$$eval('[data-mission-claim]',n=>n.every(b=>b.disabled)),true);assert.match(await page.$eval('[data-mission-summary]',n=>n.textContent),/indisponible/);await page.select('select[aria-label="Filtrer les parcours"]','ready');await page.waitForSelector('[data-mission-empty-filter]');await clean();checks.push({case:'unavailable',width,noFalseReady:true});
  await visit('locked');await page.waitForSelector('[data-mission-track]');assert.equal(await page.$$('[data-mission-track] > div button').then(n=>n.length),0);assert.match(await page.$eval('[data-mission-track]',n=>n.textContent),/verrouillée/);await click('[data-mission-track] details > summary');assert.equal(await page.$eval('[data-mission-track] details',n=>n.open),true);await clean();checks.push({case:'locked',width});
  await visit('packs');await page.waitForSelector('[data-mission-packs]');assert.equal(await page.$$('[data-mission-packs] button').then(n=>n.length),1);assert(await page.$eval('[data-mission-packs]',n=>!!(n.compareDocumentPosition(document.querySelector('[data-mission-track]'))&Node.DOCUMENT_POSITION_FOLLOWING)));await clean();checks.push({case:'older-pack',width,shortcutBeforeTracks:true});
  await visit('complete');await page.waitForSelector('[data-mission-track]');assert.equal(await page.$$('[data-mission-track] button').then(n=>n.length),0);await clean();checks.push({case:'complete',width});
  await visit('error');await page.waitForSelector('[role="alert"]');assert.equal(await page.$('[data-mission-summary]'),null);await page.evaluate(()=>{window.__mode='progress';});await click('[role="alert"] button');await page.waitForSelector('[data-mission-track]');await clean();checks.push({case:'error-retry',width});
 }
 if(!baseline){
  await visit('empty');await page.waitForSelector('[data-mission-empty]');assert.equal(await page.$('[data-mission-track]'),null);await clean();checks.push({case:'empty',noInventedProgress:true});
  await visit('ready');await page.waitForSelector('[data-mission-claim]:not(:disabled)');await page.evaluate(()=>{window.__mode='error';});await click('[aria-label="Actualiser les objectifs"]');await page.waitForSelector('[role="alert"]');assert.match(await page.$eval('[data-mission-summary]',n=>n.textContent),/Dernier état connu/);assert(await page.$$eval('[data-mission-claim]',nodes=>nodes.length>0&&nodes.every(n=>n.disabled)));await clean();
  await page.evaluate(()=>{window.__mode='ready';});await click('[role="alert"] button');await page.waitForSelector('[data-mission-claim]:not(:disabled)');await clean();checks.push({case:'stale-error',knownStateLabeled:true,rewardsBlockedUntilRecovery:true});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:checks.length,errors}));
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify({checks,errors},null,2));const timer=setTimeout(()=>{browser?.process()?.kill();server.httpServer?.closeAllConnections();},5000);try{await browser?.close();server.httpServer?.closeAllConnections();await server.close();}finally{clearTimeout(timer);}}
`;
const runtime=resolve(output,'run.mjs');await writeFile(runtime,source);await import(pathToFileURL(runtime).href);
