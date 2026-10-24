/** Real player Shell, preparation and storage; every API operation stays in memory. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-journey-continuity');
const port = Number(process.env.KQ_JOURNEY_PORT ?? 3426), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const preparationOnly = process.argv.includes('--preparation-only'), storageOnly = process.argv.includes('--storage-only');
const reportName = preparationOnly ? 'preparation-report.json' : storageOnly ? 'storage-report.json' : 'report.json';
const targetId = 'c0a00002-0000-4000-8000-000000000002', decoyId = 'c0a00001-0000-4000-8000-000000000001';
const entry = `
import React from'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
import{PlacardPlayerShell}from'/src/components/placard/PlacardPlayerShell';
import{KqTutorialApiProvider,createKqTutorialApi}from'/src/components/placard/KqTutorialApiContext';
import{createReleveCultureTransport}from'/src/lib/kanab-quest-releve-culture';
import{createKqReleveProduction,applyKqReleveProductionAction,suggestKqRelevePlan}from'/src/lib/kanab-quest-releve-production';
import{createKqOperationsLesson,getKqOperationsStorage,getKqOperationsEquipment}from'/src/lib/kanab-quest-operations-lesson';
const scenario=new URLSearchParams(location.search).get('scenario')||'preparation';
const storageScenario=scenario.startsWith('storage');
if(!new URLSearchParams(location.search).has('view'))history.replaceState(null,'','?scenario='+scenario+'&view='+(storageScenario?'harvests':'game&campaign=1'));
let production=createKqReleveProduction();const act=action=>production=applyKqReleveProductionAction(production,action);
act({type:'draft',warehouse:suggestKqRelevePlan(production)});act({type:'save-plan'});
for(let index=0;index<3;index++)act({type:'reveal-buddie'});
act({type:'assign',zoneId:production.warehouse.zones[0].id,buddieCode:production.ownedBuddies[0]});act({type:'save-plan'});
const initial=structuredClone(production);
const lesson=createKqOperationsLesson(scenario==='storage-overflow'?'warehouse':'market'),base=getKqOperationsStorage(lesson);
const baseStorage={...base,capacity:Object.fromEntries(Object.entries(base.capacity).map(([key,value])=>[key,value*2])),ownedContainers:Object.fromEntries(Object.entries(base.ownedContainers).map(([key,value])=>[key,value*2])),containers:base.containers.map(container=>({...container,ownedQuantity:container.ownedQuantity*2,occupiedQuantity:container.occupiedQuantity*2,storedUnits:container.storedUnits*2,freeQuantity:container.freeQuantity*2}))};
const targetId='${targetId}',decoyId='${decoyId}';
const lots=[{...baseStorage.lots[0],flowerId:decoyId,varietyName:'Cherry Abacus'},{...baseStorage.lots[0],flowerId:targetId,varietyName:'Cherry Abacus'}];
const storageSnapshot=()=>({...baseStorage,lots:storageScenario?lots:[]});
let storageMode='known',collectionMode='known',heritageMode='known',storageDelay=0;
const deferred=[];window.__calls=[];window.__unexpected=[];
const transport=createReleveCultureTransport({getState:()=>production,setState:next=>production=next});
const response=(body,status=200)=>Response.json(body,{status});
const request=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),path=url.pathname,method=init.method??'GET',body=init.body?JSON.parse(init.body):null;
 window.__calls.push({path,method,body});
 if(method!=='GET'&&!(method==='PATCH'&&path.endsWith('/warehouse'))){window.__unexpected.push({path,method,body});return response({error:'Mutation interdite dans cette recette.'},403)}
 if(path.endsWith('/storage')){
  if(storageDelay==='pending')await new Promise(done=>deferred.push(done));else if(storageDelay)await new Promise(done=>setTimeout(done,storageDelay));
  if(storageMode==='error')return response({error:'Stockage temporairement indisponible.'},503);
  if(storageMode==='malformed')return response({serverNow:baseStorage.serverNow,lots:null});
  const snapshot=storageSnapshot();return response(storageMode==='missing'?{...snapshot,lots:snapshot.lots.filter(lot=>lot.flowerId!==targetId)}:snapshot);
 }
 if(path.endsWith('/equipment'))return response({...getKqOperationsEquipment(lesson),routePlan:null,strength:null});
 if(path.endsWith('/contracts'))return response({error:'Contrats hors périmètre de cette recette.'},404);
 if(path.endsWith('/bootstrap')){
  if(collectionMode==='pending')await new Promise(done=>deferred.push(done));
  if(collectionMode==='error')return response({error:'Collection temporairement indisponible.'},503);
  const payload=await(await transport(input,init)).json();
  if(heritageMode==='empty')payload.heritage.cards=[];
  return response(payload);
 }
 if(path.endsWith('/warehouse')){
  const received=await transport(input,init),payload=await received.json();
  return response(storageScenario?{...payload,stockGrams:lots.reduce((sum,lot)=>sum+lot.harvestGrams,0),storageReservedGrams:0}:payload,received.status);
 }
 if(path.endsWith('/flowers')&&storageScenario)return response({flowers:[]});
 if(path.endsWith('/boosters'))return response({error:'Aucun pack utilisé par cette recette.'},503);
 if(path.endsWith('/missions'))return response({error:'Aucune mission utilisée par cette recette.'},503);
 const received=await transport(input,init);if(!received.ok)window.__unexpected.push({path,method,status:received.status});return received;
};
const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>new URL(typeof input==='string'?input:input.url,location.origin).pathname.startsWith('/api/')?request(input,init):originalFetch(input,init);
const api=createKqTutorialApi(request,{nativeWarehouse:true});api.isTutorial=false;
window.__fixture=()=>structuredClone({scenario,initial,production,lots,storageMode,collectionMode,heritageMode});
window.__control={storage:mode=>storageMode=mode,storageDelay:value=>storageDelay=value,collection:mode=>collectionMode=mode,heritage:mode=>heritageMode=mode,removeCopies:code=>{production.supportInventory[code]=0},launch:()=>act({type:'launch'}),resolve:()=>{storageDelay=0;collectionMode='known';deferred.splice(0).forEach(done=>done())},notify:name=>api.notify(name)};
createRoot(document.getElementById('root')).render(<KqTutorialApiProvider api={api}><aside className="fixture-tools"><strong>Démo locale · retrouver sa préparation et sa récolte</strong><p>Choix, plan et lots fictifs en mémoire. Aucun compte réel.</p><label>Parcours <select value={scenario} onChange={event=>location.href='/?scenario='+event.target.value}>{['preparation','storage','storage-overflow'].map(value=><option key={value}>{value}</option>)}</select></label></aside><PlacardPlayerShell draftOwnerId="journey-local-fixture"/></KqTutorialApiProvider>);
`;
const modules = {
  entry,
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/dynamic': `import React from'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
  '@/context/CartContext': `export const useCart=()=>({user:{id:'00000000-0000-4000-8000-000000000099'},isAuthenticated:true,authLoading:false,refreshSession:async()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}.fixture-tools{padding:12px 18px;font:12px Body;background:#182b24;color:#fff1d6}.fixture-tools p{margin:5px 0}.fixture-tools select{max-width:100%;margin-left:8px;color:#182b24}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react', '@3d-dice/dice-box-threejs'] },
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'journey-continuity-audit', enforce: 'pre', resolveId(id) { if (id.endsWith('/public/placard/warehouse-v2/manifest.json')) return '\0warehouse-assets'; if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('Real API disabled'); return; } if (!['/', '/arene/placard'].includes(req.url?.split('?')[0])) return next(); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Préparation et stockage · démo locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [];
let browser, page;
await mkdir(output, { recursive: true }); await server.listen();
if (preview) {
  console.log(`Local journey continuity demo: ${origin} (PID ${process.pid}). In-memory data only.`);
  await new Promise(resolveStop => { const stop = () => { void server.close().then(resolveStop); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); });
} else try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => { const url = new URL(request.url()); if (['data:', 'blob:'].includes(url.protocol)) return void request.continue(); if (url.origin !== origin || url.pathname.startsWith('/api/')) { forbiddenRequests.push(request.url()); return void request.abort(); } void request.continue(); });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const keyClick = async selector => { await page.waitForSelector(selector, { visible: true }); await page.focus(selector); await page.keyboard.press('Enter'); };
  async function button(label, scope = 'body') { const match = await page.waitForFunction((label, scope) => [...document.querySelectorAll(scope + ' button')].find(node => node.textContent.trim() === label && !node.disabled && node.getClientRects().length), {}, label, scope); await match.asElement().focus(); await page.keyboard.press('Enter'); await match.dispose(); }
  const fixture = () => page.evaluate(() => window.__fixture());
  const rememberedDeck = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('lcb:culture-preparation:v1:journey-local-fixture')).deckCodes.sort());
  const mutations = () => page.evaluate(() => window.__calls.filter(call => call.method !== 'GET'));
  async function load(scenario, width = 390) {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
    await page.setViewport({ width, height: width === 320 ? 720 : width === 390 ? 844 : 1000 });
    await page.goto(`${origin}/?scenario=${scenario}`, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
  }
  async function layout() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow'); }
  const settled = () => page.waitForFunction(() => !document.querySelector('[data-placard-view] > [role="status"]'));
  async function screenshot(name) { await settled(); await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: false }); }
  async function visibleBelowHeader(selector) {
    await settled();
    const position = await page.$eval(selector, node => ({ top: node.getBoundingClientRect().top, headerBottom: document.querySelector('#placard-content > header').getBoundingClientRect().bottom }));
    assert(position.top >= position.headerBottom + 8, `Focused target must clear sticky header: ${JSON.stringify(position)}`);
  }
  const cards = '[data-setup-choice="cards"]', heritage = '[data-setup-choice="heritage"]';
  async function openChoice(selector) { if (!await page.$eval(selector, node => node.open)) await keyClick(selector + ' > summary'); }
  const deck = () => page.$eval('[data-preparation-deck]', node => node.dataset.preparationDeck.split(',').filter(Boolean).sort());
  async function prepare({ empty = false, noHeritage = false } = {}) {
    await page.waitForSelector('[data-culture-preparation]'); await openChoice(cards);
    await button('Retirer les cartes', cards);
    if (!empty) for (const code of ['BOTTE-005', 'BOTTE-005', 'BOTTE-024', 'BOTTE-003']) await keyClick(`${cards} [data-card-code="${code}"] button[aria-label^="Ajouter"]`);
    const selected = await deck(); await keyClick(`${cards} [data-culture-keep-choice]`);
    await openChoice(heritage);
    if (noHeritage) await button('Sans Héritage', heritage);
    else await keyClick(`${heritage} button[aria-label^="Équiper"]:not([disabled])`);
    const heritageText = await page.$eval(heritage + ' > summary strong', node => node.textContent);
    await keyClick(`${heritage} [data-culture-keep-choice]`);
    return { selected, heritageText };
  }
  async function openPlan() {
    await keyClick('[data-preparation-edit-plan]'); await page.waitForSelector('[data-warehouse-v4]', { visible: true });
    await page.waitForSelector('[data-warehouse-map]'); assert.equal(new URL(page.url()).searchParams.get('from'), 'game');
    assert.equal((await mutations()).length, 0, 'Opening the plan does not launch a culture or buy equipment');
  }
  async function assertPreparation(expected, campaign = true) {
    await page.waitForSelector('[data-culture-preparation]', { visible: true });
    if (campaign) assert.equal(new URL(page.url()).searchParams.get('campaign'), '1');
    assert.equal(await page.$eval(heritage + ' > summary strong', node => node.textContent), expected.heritageText);
    await openChoice(cards); assert.deepEqual(await deck(), expected.selected);
    assert.equal((await fixture()).production.game, null); assert.equal((await mutations()).length, 0);
    await layout();
  }
  if (!storageOnly) {
  for (const width of [1440, 390, 320]) {
    await load('preparation', width); const expected = await prepare(); await openPlan(); await layout();
    await screenshot('plan-return-' + width); await keyClick('[data-placard-back="game"]');
    await assertPreparation(expected); await screenshot('preparation-restored-' + width);
    results.push({ scenario: 'custom deck and heritage preserved across plan and return button', width });
    console.log('Preparation preserved at ' + width + 'px');
  }
  await load('preparation'); let expected = await prepare(); await openPlan();
  await page.goBack({ waitUntil: 'networkidle0' }); await assertPreparation(expected);
  results.push({ scenario: 'browser Back restores the preparation without launching' });
  await load('preparation'); expected = await prepare(); await openPlan();
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('[data-placard-back="game"]'); await keyClick('[data-placard-back="game"]');
  await assertPreparation(expected); results.push({ scenario: 'tab reload during plan preserves owner-scoped preparation' });
  await load('preparation'); expected = await prepare(); await openPlan();
  await keyClick('[data-warehouse-campaign-action="start"]'); await assertPreparation(expected);
  results.push({ scenario: 'warehouse launch CTA returns to preserved choices without submitting a culture' });
  await load('preparation', 320); expected = await prepare({ empty: true, noHeritage: true }); await openPlan(); await keyClick('[data-placard-back="game"]');
  await assertPreparation(expected); results.push({ scenario: 'deliberate empty deck and Sans Héritage remain empty' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.removeCopies('BOTTE-005'));
  await keyClick('[data-placard-back="game"]'); await assertPreparation({ ...expected, selected: expected.selected.filter(code => code !== 'BOTTE-005') });
  assert(await page.$('[data-preparation-adjusted]'));
  results.push({ scenario: 'confirmed inventory reduction removes only unavailable selected copies' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.heritage('empty'));
  await keyClick('[data-placard-back="game"]'); await assertPreparation({ ...expected, heritageText: 'Sans Héritage' });
  assert(await page.$('[data-preparation-adjusted]')); results.push({ scenario: 'confirmed missing heritage clears only unavailable heritage with notice' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.collection('pending'));
  await keyClick('[data-placard-back="game"]'); await page.waitForSelector('[data-culture-selection]');
  assert.deepEqual(await rememberedDeck(), expected.selected, 'Pending inventory never clears remembered cards');
  await page.evaluate(() => window.__control.resolve()); await assertPreparation(expected);
  results.push({ scenario: 'pending collection preserves remembered choices until confirmed' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.collection('error'));
  await keyClick('[data-placard-back="game"]'); await page.waitForFunction(() => document.body.textContent.includes('Collection temporairement indisponible.'));
  assert.deepEqual(await rememberedDeck(), expected.selected); assert.equal((await mutations()).length, 0);
  await page.evaluate(() => window.__control.collection('known')); await keyClick('[data-culture-selection] button'); await assertPreparation(expected);
  results.push({ scenario: 'failed collection read never clears remembered cards' });
  await load('preparation'); expected = await prepare();
  await button('Récoltes', 'nav[aria-label="Accès rapides de Kanab Quest"]'); await button('Jury & duels', '[data-placard-harvests]');
  await page.waitForSelector('[data-placard-view="arena"]'); await settled();
  await button('Culture', 'nav[aria-label="Accès rapides de Kanab Quest"]'); await assertPreparation(expected, false);
  results.push({ scenario: 'visiting the arena does not overwrite the saved preparation on return to culture' });
  await load('preparation'); expected = await prepare(); await openPlan(); await page.evaluate(() => window.__control.launch());
  const launched = (await fixture()).production.game;
  await keyClick('[data-placard-back="game"]');
  await page.waitForFunction(() => document.querySelector('[data-culture-play]') || [...document.querySelectorAll('[data-culture-selection] button')].some(node => !node.disabled && node.getClientRects().length));
  if (!await page.$('[data-culture-play]')) await keyClick('[data-culture-selection] button');
  await page.waitForSelector('[data-culture-play]', { visible: true });
  assert.equal(await page.$eval('[data-culture-play]', node => node.dataset.cultureRun), launched.campaign.leaderRunId);
  assert.deepEqual((await fixture()).production.game, launched); assert.equal((await mutations()).length, 0);
  results.push({ scenario: 'a culture already started elsewhere is resumed without applying the remembered preparation' });
  }
  if (!preparationOnly) {
  for (const width of [1440, 390, 320]) {
    await load('storage', width); await page.waitForSelector(`[data-harvest-open-storage="${targetId}"]`);
    const before = await fixture(); await page.evaluate(() => window.__control.storageDelay(220));
    await keyClick(`[data-harvest-open-storage="${targetId}"]`);
    await page.waitForSelector(`[data-conservation-lot="${targetId}"][data-selected="true"]`, { visible: true });
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-conservation-lot') === id, {}, targetId);
    await visibleBelowHeader(`[data-conservation-lot="${targetId}"]`);
    assert.equal(new URL(page.url()).searchParams.get('flower'), targetId);
    assert.equal(await page.$(`[data-conservation-lot="${decoyId}"][data-selected="true"]`), null);
    await layout(); await screenshot('exact-storage-' + width);
    await keyClick('[data-harvest-overview]'); await page.waitForSelector(`[data-harvest-id="${targetId}"]`, { visible: true });
    await page.waitForFunction(id => document.activeElement?.getAttribute('data-harvest-id') === id, {}, targetId);
    await visibleBelowHeader(`[data-harvest-id="${targetId}"]`);
    assert.deepEqual((await fixture()).production, before.production); assert.equal((await mutations()).length, 0);
    results.push({ scenario: 'homonymous harvest → exact storage lot → focused harvest row', width });
    console.log('Exact storage and return focus verified at ' + width + 'px');
  }
  for (const state of ['missing', 'error', 'malformed']) {
    await load('storage'); await page.waitForSelector(`[data-harvest-open-storage="${targetId}"]`);
    await page.evaluate(state => window.__control.storage(state), state); await keyClick(`[data-harvest-open-storage="${targetId}"]`);
    await page.waitForSelector(`[data-storage-selection="${state === 'missing' ? 'missing' : 'unavailable'}"]`, { visible: true });
    assert.equal(await page.$('[data-conservation-lot][data-selected="true"]'), null, 'Unavailable target never selects a homonym');
    await layout(); await screenshot('storage-' + state + '-390');
    await page.evaluate(() => window.__control.storage('known')); await keyClick('[data-storage-selection-retry]');
    await page.waitForSelector(`[data-conservation-lot="${targetId}"][data-selected="true"]`, { visible: true });
    assert.equal((await mutations()).length, 0); results.push({ scenario: 'storage ' + state + ': explicit state, read-only retry restores target' });
  }
  await load('storage', 320); await page.waitForSelector(`[data-harvest-open-storage="${targetId}"]`);
  await page.evaluate(() => window.__control.storageDelay('pending')); await keyClick(`[data-harvest-open-storage="${targetId}"]`);
  await page.waitForSelector('[data-storage-selection="loading"]', { visible: true });
  assert.equal(await page.$('[data-conservation-lot][data-selected="true"]'), null);
  await page.evaluate(() => window.__control.resolve());
  await page.waitForSelector(`[data-conservation-lot="${targetId}"][data-selected="true"]`);
  await page.goBack({ waitUntil: 'networkidle0' });
  await page.waitForFunction(id => document.activeElement?.getAttribute('data-harvest-id') === id, {}, targetId);
  assert.equal((await mutations()).length, 0); results.push({ scenario: 'pending storage never means missing; browser Back focuses originating row' });
  await load('storage-overflow', 390); await page.waitForSelector(`[data-harvest-open-storage="${targetId}"]`);
  await keyClick(`[data-harvest-open-storage="${targetId}"]`);
  await page.waitForSelector(`[data-conservation-lot="${targetId}"][data-selected="true"]`);
  assert.equal((await mutations()).length, 0); results.push({ scenario: 'Protéger le surplus targets the exact homonymous lot without buying or selling' });
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors'); assert.deepEqual(forbiddenRequests, [], 'No remote or real API requests');
  assert.deepEqual(await page.evaluate(() => window.__unexpected), []);
  await writeFile(resolve(output, reportName), JSON.stringify({ ok: true, checks: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: results.length, output }));
} catch (error) {
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {}); await writeFile(resolve(output, 'failure.html'), await page.content()).catch(() => {}); }
  const calls = page ? await page.evaluate(() => window.__calls).catch(() => []) : [];
  await writeFile(resolve(output, reportName), JSON.stringify({ ok: false, results, error: String(error.stack ?? error), errors, forbiddenRequests, calls }, null, 2)); throw error;
} finally { if (!preview) { await browser?.close(); await server.close(); } }
