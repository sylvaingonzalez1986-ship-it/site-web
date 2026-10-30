/** Browser audit of the real compact care panel, reserve transactions and responsive illustrations. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/culture-care');
const origin = 'http://127.0.0.1:3247';
const modules = {
  'next/image': `import React from 'react';export default function Image({src,fill,preload,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  entry: `import React,{useEffect,useState} from 'react';
import '/src/app/globals.css';
import {createRoot} from 'react-dom/client';
import {KqCultureCarePanel} from '/src/components/placard/KqCultureCarePanel';
import {startKqGame,resolveKqStage,advanceKqStage,KQ_STAGES,KQ_SITUATIONS,getKqStageDisplayName} from '/src/lib/kanab-quest-game';
import {parseKqGameSave} from '/src/lib/kanab-quest-persistence';
import {performKqBasicCare,canPerformKqBasicCare,getKqCareProduct,KQ_CARE_PRODUCTS} from '/src/lib/kanab-quest-care';
import gameStyles from '/src/components/placard/KanabQuestDicePrototype.module.css';
const remoteMode=new URLSearchParams(location.search).has('remote');
const fixture=new URLSearchParams(location.search).get('fixture');
const params=new URLSearchParams(location.search);
const BASIC_PRICE=500;
const walletKey='kanab-quest-care-simulation-v1';
// This payment fixture has its own balance; the game's starter budget is tested separately.
if(!localStorage.getItem(walletKey))localStorage.setItem(walletKey,JSON.stringify({cashCents:35000,inventory:{}}));
if(fixture?.startsWith('wallet-')){
  localStorage.removeItem('kanab-quest-dice-prototype-v7');
  localStorage.removeItem('kanab-quest-care-journal-v1');
  localStorage.setItem(walletKey,JSON.stringify({cashCents:Number(params.get('cash')??BASIC_PRICE),inventory:{}}));
}
const outcomes={critical:[6,6,6],success:[4,4,2],fragile:[4,2,2],failure:[2,2,2]};
function visualState({stage=0,outcome,phase='prepare',vitality,dead=false,problemSeverity=0,ongoing=false}={}){
  let game=startKqGame(100,{heritageCode:'HERITAGE-007'});
  game.situationCodes=KQ_STAGES.map(step=>{
    const situation=KQ_SITUATIONS.find(item=>item.stage===step&&item.difficulty===2&&!item.incident);
    if(!situation)throw Error('Missing ordinary stage fixture: '+step);
    return situation.code;
  });
  for(let index=0;index<stage;index++)game=advanceKqStage(resolveKqStage({...game,phase:'rolled',dice:[6,6,6]}));
  game={...game,care:{...game.care,vitality:100,problems:[]}};
  if(outcome)game=resolveKqStage({...game,phase:'rolled',dice:outcomes[outcome]});
  if(outcome&&game.history.at(-1)?.outcome!==outcome)throw Error('Outcome fixture mismatch: '+stage+' '+outcome);
  if(phase==='complete')game=advanceKqStage(game);
  if(vitality!==undefined)game={...game,care:{...game.care,vitality}};
  if(problemSeverity)game={...game,care:{...game.care,problems:[{code:'APHIDS',severity:problemSeverity,status:'confirmed',trend:'worsening',appearedAt:Math.min(stage,4),variant:0}]}};
  if(ongoing)game={...game,care:{...game.care,interventions:[{productCode:'CARE-APHIDIUS',stageIndex:Math.min(stage,4),remainingSteps:1,status:'active'}],applications:[{productCode:'CARE-APHIDIUS',stageIndex:Math.min(stage,4)}]}};
  if(dead)game={...game,phase:'complete',cultureDead:true,harvestGrams:0,care:{...game.care,vitality:0}};
  return game;
}
let wallet={cashCents:Number(params.get('cash')??35000),inventory:[],basicCarePriceCents:BASIC_PRICE,catalog:KQ_CARE_PRODUCTS};
let serverGame,charges=0,lostResponse=false;
const requests=[],receipts=new Map();
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
window.__careRemoteSnapshot=()=>({wallet,requests,charges,receipts:[...receipts.keys()],serverGame});
const request=async(url,init)=>{
  if(!remoteMode)throw Error('Unexpected API access');
  const input=init?.body?JSON.parse(init.body):null;
  requests.push({method:init?.method??'GET',url:String(url),input});
  if(init?.method==='POST'){
    if(input.action==='basic'){
      if(input.basicPriceCents!==BASIC_PRICE)return response({error:'Le prix doit être accepté avant de payer cet entretien.'},409);
      if(receipts.has(input.requestKey))return response({...receipts.get(input.requestKey),cashCents:wallet.cashCents,replayed:true});
      if(fixture==='remote-basic')await new Promise(resolve=>{window.__releaseCare=resolve});
      if(fixture==='remote-reject')return response({error:'Entretien refusé par le serveur. Aucun débit effectué.'},409);
      const permission=canPerformKqBasicCare(serverGame);
      if(!permission.allowed)return response({error:permission.reason},409);
      if(wallet.cashCents<BASIC_PRICE)return response({error:'Trésorerie insuffisante pour cet entretien.'},409);
      const chargedCents=fixture==='remote-legacy-receipt'?0:BASIC_PRICE;
      serverGame=performKqBasicCare(serverGame);
      wallet={...wallet,cashCents:wallet.cashCents-chargedCents};
      if(chargedCents)charges++;
      const result={state:serverGame,updatedAt:new Date().toISOString(),inventory:wallet.inventory,cashCents:wallet.cashCents,chargedCents,replayed:fixture==='remote-legacy-receipt'};
      receipts.set(input.requestKey,result);
      if(fixture==='remote-replay'&&!lostResponse){lostResponse=true;throw Error('Réponse interrompue après validation. Réessaie avec la même demande.');}
      return response(result);
    }
    await new Promise(resolve=>{window.__releasePurchase=resolve});
    const product=getKqCareProduct(input.productCode);
    wallet={...wallet,cashCents:wallet.cashCents-product.priceCents,inventory:[{productCode:input.productCode,quantity:1}]};
  }
  return response(fixture==='remote-no-price'?{...wallet,basicCarePriceCents:undefined}:wallet);
};
function App(){
  const [state,setState]=useState(()=>{
    const saved=!remoteMode&&!fixture&&parseKqGameSave(localStorage.getItem('kanab-quest-dice-prototype-v7'));
    if(saved)return saved;
    if(fixture==='visual')return visualState();
    const game=startKqGame(100);
    game.care.problems=[{code:'APHIDS',severity:2,status:'confirmed',trend:'stable',appearedAt:0,variant:0}];
    if(fixture==='harvest')game.stageIndex=4;
    if(fixture==='heat'){
      game.stageIndex=2;
      game.care.problems=['MITES','HEAT'].map(code=>({code,severity:2,status:'confirmed',trend:'stable',appearedAt:1,variant:0}));
    }
    return game;
  });
  const [busy,setBusy]=useState(false);
  useEffect(()=>{window.__careState=state;if(remoteMode)serverGame=state;},[state]);
  useEffect(()=>{
    window.__visualCare=options=>setState(visualState(options));
    window.__careStageNames=KQ_STAGES.map(getKqStageDisplayName);
    window.__criticalCare=()=>setState(current=>({...current,care:{...current.care,vitality:20,problems:[
      {code:'NITROGEN',severity:1,status:'suspected',trend:'stable',appearedAt:0,variant:0},
      {code:'APHIDS',severity:3,status:'confirmed',trend:'worsening',appearedAt:0,variant:0},
    ]}}));
  },[]);
  return <main className={gameStyles.page} data-player-mode style={{maxWidth:1100,margin:'auto',padding:12}}>
    <KqCultureCarePanel state={state} request={request} storage={remoteMode?undefined:localStorage} runId={remoteMode?'audit-run':undefined} disabled={busy} onBusyChange={setBusy} onStateChange={setState}/>
    <button id="advance" disabled={busy} onClick={()=>setState(advanceKqStage(resolveKqStage({...state,phase:'rolled',dice:[4,4,4]})))}>Valider une opération</button>
    {fixture==='visual'?<div data-audit-actions><button id="resolve-only" disabled={busy} onClick={()=>setState(resolveKqStage({...state,phase:'rolled',dice:[6,6,6]}))}>Valider sans avancer</button><button id="advance-only" disabled={busy||state.phase!=='resolved'} onClick={()=>setState(advanceKqStage(state))}>Passer à la prochaine étape</button></div>:null}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#174c3b}`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'], exclude: ['next/image'] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'care-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fonts+'</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>');
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3247, strictPort: true, hmr: false, watch: null },
});
let browser, page;
const checks = [];
const errors = [], blockedRequests = [], compactHeights = [];
const pass = name => checks.push(name);
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) return void request.continue();
    if (url.origin !== origin || url.pathname.startsWith('/api/')) {
      blockedRequests.push({ method: request.method(), url: url.href });
      return void request.abort();
    }
    void request.continue();
  });
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(origin, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-care-toggle]');
  const clickText = async text => {
    const button = await page.waitForFunction(text => [...document.querySelectorAll('button')].find(node => node.textContent.includes(text) && !node.disabled), {}, text);
    await button.asElement().click(); await button.dispose();
  };
  const text = () => page.$eval('main', element => element.textContent);
  const localCash = () => page.evaluate(() => JSON.parse(localStorage.getItem('kanab-quest-care-simulation-v1') || '{"cashCents":35000}').cashCents);
  const remoteSnapshot = () => page.evaluate(() => window.__careRemoteSnapshot());
  const waitBasicQueued = async () => page.waitForFunction(() => { const button = document.querySelector('[data-care-basic]'); return button?.disabled && /Entretien (?:déjà )?activé/.test(button.textContent); });
  const waitCash = async cents => page.waitForFunction(cents => document.querySelector('[data-care-cash]')?.getAttribute('data-cash-cents') === String(cents), {}, cents);
  const reserveCash = async cents => page.waitForFunction(cents => [...document.querySelectorAll('[aria-label="Intrants et protection biologique"] header strong')].some(node => node.textContent.replace(/\s/g, '').includes((cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ''))), {}, cents);
  const imagesReady = async (selector, count) => {
    await page.waitForFunction((selector, count) => {
      const images = [...document.querySelectorAll(selector)];
      return images.length === count && images.every(image => image.complete && image.naturalWidth > 0);
    }, {}, selector, count);
  };
  assert.equal(await page.$eval('[data-care-toggle]', node => node.getAttribute('aria-expanded')), 'false');
  assert.equal(await page.$eval('[data-care-content]', node => node.hidden), true);
  assert.equal(await page.$eval('[data-care-toggle]', node => document.getElementById(node.getAttribute('aria-controls'))?.hasAttribute('data-care-content')), true);
  pass('collapsed by default with accessible disclosure target');
  assert.ok((await page.$eval('[data-care-alert]', node => node.innerText)).includes('Foyer de pucerons'));
  pass('active problem remains visible while collapsed');
  await imagesReady('[data-care-portrait]', 1);
  assert.match(await page.$eval('[data-care-portrait]', node => node.alt), /Sylvain/);
  pass('stage-specific Sylvain portrait loaded with descriptive alternative');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewport({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const height = await page.$eval('[data-culture-care]', node => node.getBoundingClientRect().height);
    compactHeights.push({ fixture: 'initial', width, height });
    assert.ok(height <= 240, `Compact panel exceeds 240px at ${width}px: ${height}px`);
    await page.screenshot({ path: resolve(output, `care-compact-${width}.png`), fullPage: true });
  }
  pass('compact panel below 240 px and no overflow at 320, 390, 768 and 1280 px');
  await page.focus('[data-care-toggle]');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('[data-care-toggle]', node => node.getAttribute('aria-expanded')), 'true');
  assert.equal(await page.$eval('[data-care-reserve-toggle]', node => node.getAttribute('aria-expanded')), 'false');
  pass('keyboard opens follow-up while reserve stays closed');
  await waitCash(35000);
  assert.match(await page.$eval('[data-care-basic-section]', node => node.textContent), /5,00/);
  const beforeBasic = await page.evaluate(() => ({ vitality: window.__careState.care.vitality, problems: window.__careState.care.problems }));
  await page.setViewport({ width: 390, height: 844 });
  await (await page.$('[data-care-basic-section]')).screenshot({ path: resolve(output, 'care-basic-before-mobile.png') });
  await page.locator('[data-care-basic]').click();
  await waitBasicQueued();
  assert.equal(await page.$eval('[role=meter]', node => node.getAttribute('aria-valuenow')), '100');
  assert.equal(await page.$eval('[data-care-basic]', node => node.disabled), true);
  assert.match(await page.$eval('[data-care-basic]', node => node.textContent), /Entretien (?:déjà )?activé/);
  assert.deepEqual(await page.evaluate(() => ({ vitality: window.__careState.care.vitality, problems: window.__careState.care.problems })), beforeBasic);
  assert.equal(await localCash(), 34500);
  await waitCash(34500);
  await page.$eval('[data-care-basic]', node => node.click());
  assert.equal(await localCash(), 34500, 'A disabled repeat click cannot charge again');
  await (await page.$('[data-care-basic-section]')).screenshot({ path: resolve(output, 'care-basic-after-mobile.png') });
  pass('basic care charges exactly 500 cents once without immediate change to vitality or problems');
  await page.setViewport({ width: 1280, height: 900 });
  await page.screenshot({ path: resolve(output, 'care-expanded-desktop.png'), fullPage: true });
  await page.locator('[data-care-reserve-toggle]').click();
  await reserveCash(34500);
  await clickText('Intrants du sol vivant');
  await imagesReady('[aria-label="Intrants et protection biologique"] article img', 4);
  pass('four illustrated inputs loaded');
  assert.equal(await page.$$eval('[aria-label="Intrants et protection biologique"] article details', nodes => nodes.every(node => !node.open)), true);
  pass('product explanations stay discreet by default');
  assert.equal(await page.$$eval('[aria-label="Intrants et protection biologique"] a', nodes => nodes.length), 0);
  pass('input cards show no documentary or retailer links');
  await clickText('Protection biologique');
  await imagesReady('[aria-label="Intrants et protection biologique"] article img', 6);
  assert.equal(await page.$$eval('[aria-label="Intrants et protection biologique"] article img', nodes => nodes.every(node => node.alt.length > 10)), true);
  pass('six illustrated PBI loaded with descriptive alternatives');
  const pbiRoles = await page.$$eval('[aria-label="Intrants et protection biologique"] article', cards => cards.map(card => ({ name: card.querySelector('h3').textContent, visible: card.innerText })));
  for (const [name, role] of [
    ['Aphidius colemani', 'Économique · action différée'],
    ['Phytoseiulus persimilis', 'Spécialiste des tétranyques'],
    ['Amblyseius swirskii', 'Économique · petits foyers'],
    ['Orius laevigatus', 'Action forte · foyer installé'],
    ['Chrysoperla carnea', 'Polyvalent · deux cibles'],
    ['Coccinelle à sept points', 'Renfort rapide · dès le premier bilan'],
  ]) assert.ok(pbiRoles.find(card => card.name === name)?.visible.includes(role), `Visible role missing for ${name}`);
  assert.ok(pbiRoles.find(card => card.name === 'Chrysoperla carnea')?.visible.includes('Pucerons · Thrips'));
  pass('six distinct PBI roles and both Chrysoperla targets visible without opening details');
  assert.equal(await page.$$eval('[aria-label="Intrants et protection biologique"] a', nodes => nodes.length), 0);
  pass('PBI cards show no documentary or retailer links');
  const aphidius = await page.waitForFunction(() => [...document.querySelectorAll('article')].find(node => node.querySelector('h3')?.textContent === 'Aphidius colemani'));
  await aphidius.asElement().$$eval('button', buttons => buttons.find(node => node.textContent.includes('Acheter')).click());
  await page.waitForFunction(() => [...document.querySelectorAll('article')].some(node => node.querySelector('h3')?.textContent === 'Aphidius colemani' && node.textContent.includes('1 en réserve')));
  await waitCash(33300);
  await reserveCash(33300);
  pass('purchase adds one charge to reserve');
  await aphidius.asElement().$$eval('button', buttons => buttons.find(node => node.textContent.includes('Utiliser')).click());
  await page.waitForFunction(() => document.querySelector('main').textContent.includes('Installation en cours'));
  pass('use consumes charge and starts delayed PBI intervention');
  await page.locator('[data-cannabinoid-report] summary').click();
  assert.equal(await page.$$eval('[data-cannabinoid-report] tbody tr', rows => rows.length), 7);
  assert.equal(await page.$$eval('[data-cannabinoid-report] tbody td span', labels => labels.length), 14);
  assert.ok((await text()).includes('Total potentiel'));
  assert.ok((await text()).includes('Arômes · terpènes'));
  pass('aroma-terpene label and 14 analytes / 7 totals preserved');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewport({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.$eval('[data-cannabinoid-report] summary', node => getComputedStyle(node).display), 'list-item');
  }
  pass('expanded reserve and cannabinoid table fit all four widths');
  await page.locator('[data-cannabinoid-report] summary').click();
  await page.screenshot({ path: resolve(output, 'care-desktop.png'), fullPage: true });
  await page.$eval('[aria-label="Intrants et protection biologique"]', node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: resolve(output, 'care-reserve-desktop.png'), fullPage: false });
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, 'care-mobile.png'), fullPage: true });
  await page.$eval('[aria-label="Intrants et protection biologique"]', node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: resolve(output, 'care-reserve-mobile.png'), fullPage: false });
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('[data-care-toggle]', node => node.getAttribute('aria-expanded')), 'false');
  assert.ok((await text()).includes('1 intervention en cours'));
  await page.locator('[data-care-toggle]').click();
  assert.ok((await text()).includes('Installation en cours'));
  pass('reload preserves intervention with compact panel restored');
  await page.locator('#advance').click();
  await page.waitForFunction(() => document.querySelector('main').textContent.includes('Action suivie'));
  pass('PBI effect still advances with the next operation');
  await page.locator('[data-care-toggle]').click();
  await page.evaluate(() => window.__criticalCare());
  await page.waitForFunction(() => document.querySelector('[data-care-alert]').innerText.includes('Vitalité critique'));
  const alert = await page.$eval('[data-care-alert]', node => node.innerText);
  assert.ok(alert.includes('2 problèmes'));
  assert.ok(alert.includes('Foyer de pucerons · critique'));
  assert.equal(await page.$eval('[role=meter]', node => node.getAttribute('aria-valuenow')), '20');
  await page.screenshot({ path: resolve(output, 'care-critical-mobile.png'), fullPage: true });
  pass('critical vitality and most severe problem stay visible when folded');
  for (const scenario of [
    { fixture: 'harvest', name: 'Aphidius colemani', reason: 'Trop tard pour une nouvelle PBI' },
    { fixture: 'heat', name: 'Phytoseiulus persimilis', reason: 'Stress thermique actif' },
  ]) {
    await page.goto(`${origin}/?fixture=${scenario.fixture}`, { waitUntil: 'networkidle0' });
    await page.locator('[data-care-toggle]').click();
    await page.locator('[data-care-reserve-toggle]').click();
    await clickText('Protection biologique');
    await imagesReady('[aria-label="Intrants et protection biologique"] article img', 6);
    const card = await page.waitForFunction(name => [...document.querySelectorAll('[aria-label="Intrants et protection biologique"] article')].find(node => node.querySelector('h3')?.textContent === name), {}, scenario.name);
    await card.asElement().$$eval('button', buttons => buttons.find(node => node.textContent.includes('Acheter')).click());
    await page.waitForFunction(name => [...document.querySelectorAll('article')].some(node => node.querySelector('h3')?.textContent === name && node.textContent.includes('1 en réserve')), {}, scenario.name);
    assert.equal(await card.asElement().$$eval('button', buttons => buttons.find(node => node.textContent.includes('Utiliser')).disabled), true);
    assert.ok((await card.asElement().evaluate(node => node.innerText)).includes(scenario.reason));
    assert.ok((await card.asElement().evaluate(node => node.innerText)).includes('charge reste en réserve'));
    const before = await page.evaluate(() => ({ storage: { ...localStorage }, state: window.__careState }));
    await card.asElement().$$eval('button', buttons => buttons.find(node => node.textContent.includes('Utiliser')).click());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await page.evaluate(() => ({ storage: { ...localStorage }, state: window.__careState }));
    assert.deepEqual(after, before);
    for (const width of [320, 390]) {
      await page.setViewport({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await card.asElement().screenshot({ path: resolve(output, `care-pbi-${scenario.fixture}-mobile.png`) });
    await card.dispose();
    pass(`${scenario.fixture}: stocked PBI visibly blocked with reason, disabled click preserves charge and culture, fits 320 and 390 px`);
  }
  await page.goto(`${origin}/?remote=1`, { waitUntil: 'networkidle0' });
  await page.locator('[data-care-toggle]').click();
  await page.locator('[data-care-reserve-toggle]').click();
  await clickText('Intrants du sol vivant');
  await clickText('Acheter 1 charge');
  await page.waitForFunction(() => typeof window.__releasePurchase === 'function');
  assert.equal(await page.$eval('[data-care-toggle]', node => node.disabled), true);
  assert.equal(await page.$eval('[data-care-reserve-toggle]', node => node.disabled), true);
  assert.equal(await page.$eval('#advance', node => node.disabled), true);
  await page.evaluate(() => { document.querySelector('[data-care-toggle]').click(); document.querySelector('[data-care-reserve-toggle]').click(); });
  assert.equal(await page.$eval('[data-care-toggle]', node => node.getAttribute('aria-expanded')), 'true');
  assert.equal(await page.$eval('[data-care-reserve-toggle]', node => node.getAttribute('aria-expanded')), 'true');
  await page.evaluate(() => window.__releasePurchase());
  await page.waitForFunction(() => !document.querySelector('[data-care-toggle]').disabled);
  await waitCash(34100);
  pass('both disclosures and game action stay locked throughout remote purchase');
  const visitPaid = async (name, cash, remote = false) => {
    await page.goto(`${origin}/?fixture=${name}&cash=${cash}${remote ? '&remote=1' : ''}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-care-toggle]');
    await page.locator('[data-care-toggle]').click();
    await waitCash(cash);
  };
  await visitPaid('wallet-exact', 500);
  assert.equal(await page.$eval('[data-care-basic]', node => node.disabled), false);
  await page.locator('[data-care-basic]').click();
  await waitBasicQueued();
  assert.equal(await localCash(), 0);
  await waitCash(0);
  const exactState = await page.evaluate(() => window.__careState);
  await page.$eval('[data-care-basic]', node => node.click());
  assert.equal(await localCash(), 0);
  assert.deepEqual(await page.evaluate(() => window.__careState), exactState);
  await page.goto(origin, { waitUntil: 'networkidle0' });
  await page.locator('[data-care-toggle]').click();
  await waitBasicQueued();
  assert.equal(await localCash(), 0);
  assert.deepEqual(await page.evaluate(() => window.__careState), exactState);
  pass('exact cash funds one local care action; duplicate click and reload neither reapply nor recharge it');
  await visitPaid('wallet-insufficient', 499);
  assert.equal(await page.$eval('[data-care-basic]', node => node.disabled), true);
  assert.match(await page.$eval('[data-care-basic-section]', node => node.textContent), /insuffis/i);
  const insufficientState = await page.evaluate(() => window.__careState);
  await page.$eval('[data-care-basic]', node => node.click());
  assert.equal(await localCash(), 499);
  assert.deepEqual(await page.evaluate(() => window.__careState), insufficientState);
  await (await page.$('[data-care-basic-section]')).screenshot({ path: resolve(output, 'care-basic-insufficient-mobile.png') });
  pass('insufficient local cash disables payment without a debit or care application');
  await visitPaid('wallet-race', 500);
  const staleState = await page.evaluate(() => window.__careState);
  await page.evaluate(() => localStorage.setItem('kanab-quest-care-simulation-v1', JSON.stringify({ cashCents: 499, inventory: {} })));
  await page.locator('[data-care-basic]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(node => /insuffis/i.test(node.textContent)));
  assert.equal(await localCash(), 499);
  assert.deepEqual(await page.evaluate(() => window.__careState), staleState);
  pass('local payment rechecks cash after a stale display and refuses without applying care');
  await visitPaid('wallet-two-stages', 1000);
  await page.locator('[data-care-basic]').click();
  await waitBasicQueued();
  assert.equal(await localCash(), 500);
  await page.locator('#advance').click();
  await page.waitForFunction(() => window.__careState.stageIndex === 1 && !document.querySelector('[data-care-basic]').disabled);
  await page.locator('[data-care-basic]').click();
  await waitBasicQueued();
  assert.equal(await localCash(), 0);
  assert.deepEqual(await page.evaluate(() => window.__careState.care.history.filter(item => item.kind === 'intervention' && !item.productCode).map(item => item.stageIndex)), [0, 1]);
  pass('a new stage permits one new paid care action and records its own payment');
  await visitPaid('remote-basic', 35000, true);
  assert.ok((await remoteSnapshot()).requests.some(request => request.method === 'GET'), 'The care quote comes from a server snapshot');
  await page.evaluate(() => { const button = document.querySelector('[data-care-basic]'); button.click(); button.click(); });
  await page.waitForFunction(() => typeof window.__releaseCare === 'function');
  assert.equal((await remoteSnapshot()).requests.filter(request => request.method === 'POST').length, 1);
  assert.equal(await page.$eval('[data-care-toggle]', node => node.disabled), true);
  const posted = (await remoteSnapshot()).requests.find(request => request.method === 'POST').input;
  assert.equal(posted.basicPriceCents, 500);
  assert.equal(posted.action, 'basic');
  await page.evaluate(() => window.__releaseCare());
  await waitBasicQueued();
  await waitCash(34500);
  assert.equal((await remoteSnapshot()).wallet.cashCents, 34500);
  assert.equal((await remoteSnapshot()).charges, 1);
  await page.locator('[data-care-reserve-toggle]').click();
  await reserveCash(34500);
  assert.ok((await text()).includes('5,00'), 'The paid receipt includes the actual charge');
  pass('remote care accepts the displayed price, coalesces duplicate clicks and synchronizes the reserve balance');
  await visitPaid('remote-reject', 35000, true);
  const rejectedState = await page.evaluate(() => window.__careState);
  await page.locator('[data-care-basic]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(node => /refusé par le serveur/i.test(node.textContent)));
  assert.equal((await remoteSnapshot()).wallet.cashCents, 35000);
  assert.equal((await remoteSnapshot()).charges, 0);
  assert.deepEqual(await page.evaluate(() => window.__careState), rejectedState);
  pass('a rejected server payment leaves both care and cash unchanged');
  await visitPaid('remote-no-price', 35000, true);
  assert.equal(await page.$eval('[data-care-basic]', node => node.disabled), true);
  assert.match(await page.$eval('[data-care-basic-section]', node => node.textContent), /indisponible/i);
  const beforeMissingQuote = await page.evaluate(() => window.__careState);
  await page.$eval('[data-care-basic]', node => node.click());
  assert.equal((await remoteSnapshot()).requests.filter(request => request.method === 'POST').length, 0);
  assert.equal((await remoteSnapshot()).wallet.cashCents, 35000);
  assert.deepEqual(await page.evaluate(() => window.__careState), beforeMissingQuote);
  pass('a legacy snapshot without a current care price blocks payment instead of implying free service');
  await visitPaid('remote-replay', 500, true);
  await page.locator('[data-care-basic]').click();
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(node => /Réponse interrompue/i.test(node.textContent)));
  assert.equal((await remoteSnapshot()).wallet.cashCents, 0);
  await page.locator('[data-care-basic]').click();
  await waitBasicQueued();
  await waitCash(0);
  const replay = await remoteSnapshot();
  const retries = replay.requests.filter(request => request.method === 'POST');
  assert.equal(retries.length, 2);
  assert.equal(retries[0].input.requestKey, retries[1].input.requestKey);
  assert.equal(replay.charges, 1);
  assert.equal(replay.wallet.cashCents, 0);
  assert.equal(await page.evaluate(() => window.__careState.care.history.filter(item => item.kind === 'intervention' && !item.productCode).length), 1);
  pass('lost payment response retries the same receipt even with an empty wallet, without a second debit or care application');
  await visitPaid('remote-legacy-receipt', 35000, true);
  await page.locator('[data-care-basic]').click();
  await waitBasicQueued();
  assert.equal((await remoteSnapshot()).wallet.cashCents, 35000);
  assert.equal((await remoteSnapshot()).charges, 0);
  const oldReceiptNotice = await page.$$eval('[role="status"]', nodes => nodes.map(node => node.textContent).join(' '));
  assert.doesNotMatch(oldReceiptNotice, /5,00\s*€|500\s*cent/i, 'A historical zero-charge receipt must not invent a fee');
  pass('a replayed historical zero-charge receipt never claims a new payment');
  await page.evaluate(() => {
    localStorage.setItem('kanab-quest-care-simulation-v1', JSON.stringify({ cashCents: 35000, inventory: {} }));
    localStorage.removeItem('kanab-quest-dice-prototype-v7');
    localStorage.removeItem('kanab-quest-care-journal-v1');
  });
  await page.goto(`${origin}/?fixture=visual`, { waitUntil: 'networkidle0' });
  const labels = ['Réussite exceptionnelle', 'Réussite', 'Fragile', 'Échec'];
  const outcomes = ['critical', 'success', 'fragile', 'failure'];
  const stageSlugs = ['germination', 'enracinement', 'croissance', 'floraison', 'recolte', 'sechage-affinage'];
  const stageNames = await page.evaluate(() => window.__careStageNames);
  const setVisual = async options => {
    await page.evaluate(options => window.__visualCare(options), options);
    await page.waitForFunction(options => {
      const state = window.__careState;
      return state?.stageIndex === options.stage
        && state.history.length === options.stage + Number(Boolean(options.outcome))
        && (!options.outcome || state.history.at(-1)?.outcome === options.outcome)
        && (options.vitality === undefined || state.care.vitality === options.vitality)
        && (!options.dead || state.cultureDead === true);
    }, {}, options);
    await imagesReady('[data-care-portrait]', 1);
  };
  await page.locator('[data-care-toggle]').click();
  await waitCash(35000);
  await setVisual({ stage: 0, vitality: 100 });
  await page.waitForSelector('[data-care-choice]');
  assert.match(await page.$eval('[data-care-choice]', node => node.textContent), /continuer sans entretien/);
  assert.match(await page.$eval('[data-care-choice]', node => node.textContent), /5,00/);
  assert.equal(await page.$eval('[data-care-basic]', node => node.getAttribute('aria-describedby').split(' ').some(id => document.getElementById(id)?.hasAttribute('data-care-choice'))), true);
  const beforeChoice = await localCash();
  await page.locator('#advance').click();
  await page.waitForFunction(() => window.__careState.stageIndex === 1);
  assert.equal(await localCash(), beforeChoice, 'Choosing the next operation without care does not debit the wallet');
  assert.equal(await page.evaluate(() => window.__careState.care.history.some(item => item.kind === 'intervention' && !item.productCode)), false);
  pass('healthy culture offers an accessible unpaid next step; continuing does not silently activate or charge care');
  for (const options of [{ stage: 2, vitality: 89 }, { stage: 2, vitality: 100, problemSeverity: 1 }, { stage: 5, vitality: 100 }, { stage: 2, vitality: 0, dead: true }]) {
    await setVisual(options);
    assert.equal(await page.$('[data-care-choice]'), null, 'Advice to save care must not hide a problem, fragile health or a terminal state');
  }
  pass('save-care advice disappears with a problem, lower health, death or postharvest');
  await setVisual({ stage: 2, vitality: 90 });
  await page.waitForSelector('[data-care-choice]');
  for (const width of [320, 390]) {
    await page.setViewport({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await (await page.$('[data-care-basic-section]')).screenshot({ path: resolve(output, `care-optional-${width}.png`) });
  }
  const careDetails = await page.$eval('[data-care-basic-section]', node => node.textContent);
  assert.match(careDetails, /Entretien facultatif/);
  assert.match(careDetails, /cinq étapes représente 25,00/);
  assert.match(careDetails, /ne garantit ni la note du jury ni le prix de vente/);
  await page.locator('[data-care-basic]').click();
  await waitBasicQueued();
  assert.equal(await page.$('[data-care-choice]'), null, 'A paid action must show its receipt rather than advice to skip it');
  assert.equal(await localCash(), beforeChoice - 500, 'Explicit payment still charges the exact existing price');
  pass('optional-care decision fits 320/390px, distinguishes per-step and full-cycle cost, and yields to the paid receipt');
  // The visual matrix starts a separate panel, without the prior payment notice.
  await page.goto(`${origin}/?fixture=visual`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-care-toggle]');
  const portrait = () => page.$eval('[data-care-portrait]', image => ({ src: image.getAttribute('src'), alt: image.alt }));
  const readResult = async () => {
    await page.locator('[data-care-toggle]').click();
    const result = await page.$eval('[data-care-result]', node => node.textContent);
    assert.equal(await page.$$eval('[aria-label="Progression de la culture"] li', nodes => nodes.length), 6);
    assert.equal(await page.$$eval('[aria-label="Progression de la culture"] [aria-current="step"]', nodes => nodes.length), 1);
    await page.locator('[data-care-toggle]').click();
    return result;
  };
  for (let stage = 0; stage < 6; stage++) {
    await setVisual({ stage });
    assert.ok((await page.$eval('[data-care-stage]', node => node.textContent)).includes(stageNames[stage]));
    const before = await portrait();
    assert.ok(before.src.includes(stageSlugs[stage]), `Preparing ${stageNames[stage]} keeps its botanical stage`);
    assert.match(before.alt, /Sylvain/);
    if (stage === 5) {
      assert.match(before.alt, /récolt|séchage|fleurs/i);
      assert.doesNotMatch(before.alt, /jeune pousse|plante en croissance|premières racines/i);
    }
    pass(`stage ${stage + 1}: preparing ${stageNames[stage]} uses its own Sylvain scene`);
    const picturedResults = new Set();
    for (const [index, outcome] of outcomes.entries()) {
      await setVisual({ stage, outcome });
      const image = await portrait();
      picturedResults.add(image.src);
      assert.ok(image.src.includes(stageSlugs[stage]) && image.src.includes(outcome), `${stageNames[stage]} ${outcome}: correct verdict scene`);
      assert.ok((await readResult()).includes(labels[index]), `${stageNames[stage]} ${outcome}: explicit operation result`);
      assert.ok((await page.$eval('[data-care-stage]', node => node.textContent)).includes(stageNames[stage]));
      assert.equal(await page.$eval('[data-care-toggle]', node => node.getAttribute('aria-expanded')), 'false');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.doesNotMatch(image.src, /-dead\./, 'A failed operation never falsely depicts a dead culture');
      if (stage === 2 || stage === 5) await page.screenshot({ path: resolve(output, `care-stage-${stage + 1}-${outcome}-mobile.png`), fullPage: true });
      pass(`stage ${stage + 1}: ${outcome} updates scene and recorded result without changing stage`);
    }
    assert.equal(picturedResults.size, 4, 'Each operation verdict has its own illustrated response');
  }
  await setVisual({ stage: 2 });
  const beforeResolve = await portrait();
  await page.locator('#resolve-only').click();
  await page.waitForFunction(() => window.__careState.phase === 'resolved');
  await imagesReady('[data-care-portrait]', 1);
  const afterResolve = await portrait();
  assert.notEqual(afterResolve.src, beforeResolve.src);
  assert.ok(afterResolve.src.includes('croissance-critical'));
  await page.locator('#advance-only').click();
  await page.waitForFunction(() => window.__careState.stageIndex === 3 && window.__careState.phase === 'prepare');
  await imagesReady('[data-care-portrait]', 1);
  const afterAdvance = await portrait();
  assert.ok(afterAdvance.src.includes('floraison'));
  assert.notEqual(afterAdvance.src, afterResolve.src);
  assert.ok((await page.$eval('[data-care-stage]', node => node.textContent)).includes('Floraison'));
  assert.ok((await readResult()).includes('Croissance'), 'A previous operation is labelled with its own stage');
  pass('real resolve then advance updates the portrait first by result, then by botanical stage');
  await setVisual({ stage: 3, outcome: 'critical', vitality: 20 });
  const endangered = await portrait();
  assert.ok(endangered.src.includes('floraison-failure'), 'Current poor health takes priority over a successful operation');
  assert.match(await page.$eval('[data-care-condition]', node => node.innerText), /critique/i);
  assert.ok((await readResult()).includes('Réussite exceptionnelle'), 'The real positive result remains visible alongside the warning');
  await page.screenshot({ path: resolve(output, 'care-critical-after-success-mobile.png'), fullPage: true });
  await page.locator('[data-care-toggle]').click();
  await page.screenshot({ path: resolve(output, 'care-dynamic-critical-mobile.png'), fullPage: true });
  await page.locator('[data-care-toggle]').click();
  pass('critical health overrides a recent success visually while preserving its actual result');
  await setVisual({ stage: 2, outcome: 'critical', vitality: 100, problemSeverity: 3 });
  assert.equal(await page.$eval('[data-culture-care]', node => node.dataset.condition), 'critical');
  assert.match(await page.$eval('[data-care-condition]', node => node.innerText), /critique/i);
  assert.ok((await portrait()).src.includes('croissance-failure'), 'A severe current pest remains visually urgent even at full vitality');
  assert.equal(await page.$eval('[role=meter]', node => node.getAttribute('aria-valuenow')), '100');
  assert.ok((await page.$eval('[data-care-alert]', node => node.innerText)).includes('Foyer de pucerons · critique'));
  pass('severe pest warning takes priority over full vitality and a critical success');
  await setVisual({ stage: 5, problemSeverity: 3, ongoing: true });
  assert.equal(await page.$eval('[data-culture-care]', node => node.dataset.condition), 'harvested');
  assert.doesNotMatch(await text(), /interventions? en cours/i, 'Residual growing interventions are not announced as active during drying');
  await page.locator('[data-care-toggle]').click();
  assert.match(await text(), /Observations à la récolte/i);
  assert.doesNotMatch(await text(), /interventions? en cours|Installation en cours|Action suivie/i);
  assert.ok((await portrait()).src.includes('sechage-affinage'));
  await page.screenshot({ path: resolve(output, 'care-dynamic-drying-mobile.png'), fullPage: true });
  await page.locator('[data-care-toggle]').click();
  pass('drying with retained growing problems and intervention records presents them only as harvest history');
  await setVisual({ stage: 5, outcome: 'success', phase: 'complete' });
  assert.match(await page.$eval('[data-care-condition]', node => node.innerText), /lot|récolt/i);
  await page.locator('[data-care-toggle]').click();
  assert.equal((await page.$$('[data-care-reserve-toggle]')).length, 0, 'A completed lot no longer offers growing interventions');
  assert.ok(await page.$('[data-cannabinoid-report]'), 'A successful completed lot retains its simulated composition');
  await page.locator('[data-care-toggle]').click();
  pass('drying and completed harvest retain a lot scene and stop growing interventions');
  await setVisual({ stage: 3, outcome: 'failure', dead: true });
  assert.ok((await portrait()).src.includes('floraison-dead'));
  assert.match(await page.$eval('[data-care-condition]', node => node.innerText), /arrêt|mort/i);
  assert.equal(await page.$eval('[role=meter]', node => node.getAttribute('aria-valuenow')), '0');
  await page.locator('[data-care-toggle]').click();
  assert.equal((await page.$$('[data-care-reserve-toggle]')).length, 0);
  assert.equal((await page.$$('[data-care-basic]')).length, 0);
  assert.equal((await page.$$('[data-cannabinoid-report]')).length, 0, 'A dead culture must not show a fictitious harvested cannabinoid profile');
  assert.doesNotMatch(await text(), /Qualité obtenue|Lot récolté|Entretenir la culture|Entretien activé|Ouvrir la réserve/);
  await page.screenshot({ path: resolve(output, 'care-dead-mobile.png'), fullPage: true });
  pass('dead culture has a stage-correct portrait and no false care, lot or harvested profile');
  await page.locator('[data-care-toggle]').click();
  await setVisual({ stage: 2, outcome: 'critical' });
  for (const width of [300, 320, 390, 768, 1280]) {
    await page.setViewport({ width, height: 900 });
    const height = await page.$eval('[data-culture-care]', node => node.getBoundingClientRect().height);
    compactHeights.push({ fixture: 'resolved', width, height });
    assert.ok(height <= 240, `Resolved compact panel exceeds 240px at ${width}px: ${height}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(output, `care-dynamic-${width}.png`), fullPage: true });
  }
  pass('dynamic operation summary remains compact and responsive at 300, 320, 390, 768 and 1280 px');
  await page.locator('[data-care-toggle]').click();
  await page.screenshot({ path: resolve(output, 'care-dynamic-expanded-desktop.png'), fullPage: true });
  await page.locator('[data-care-toggle]').click();
  const animations = await page.$$eval('[data-culture-care], [data-culture-care] *', nodes => nodes.filter(node => node.checkVisibility()).map(node => ({ animation: getComputedStyle(node).animationDuration, transition: getComputedStyle(node).transitionDuration })));
  const short = durations => durations.split(',').every(value => parseFloat(value) <= 0.01);
  assert.ok(animations.every(style => short(style.animation) && short(style.transition)), 'Reduced motion removes long panel animations');
  await page.focus('[data-care-toggle]');await page.keyboard.press('Enter');
  assert.equal(await page.$eval('[data-care-toggle]', node => node.getAttribute('aria-expanded')), 'true');
  await page.focus('[data-care-reserve-toggle]');await page.keyboard.press('Enter');
  assert.equal(await page.$eval('[data-care-reserve-toggle]', node => node.getAttribute('aria-expanded')), 'true');
  pass('dynamic presentation respects reduced motion and both disclosures remain keyboard operable');
  await page.goto(`${origin}/?fixture=visual`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-care-toggle]');
  await setVisual({ stage: 3, outcome: 'success' });
  await page.locator('[data-care-toggle]').click();
  for (const [name, width] of [['desktop', 1280], ['mobile', 390]]) {
    await page.setViewport({ width, height: 900 });
    await imagesReady('[data-care-portrait]', 1);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const panel = await page.$('[data-culture-care]');
    await panel.screenshot({ path: resolve(output, `care-preview-${name}.png`) });
  }
  pass('final desktop and mobile previews show only the expanded flowering panel with loaded artwork and site fonts');
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  pass('no browser errors');
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, checks, compactHeights, blockedRequests, errors }, null, 2));
  console.log(`Care browser audit: ${checks.length} checks passed.`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => undefined);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: false, checks, compactHeights, blockedRequests, errors, failure: error.stack }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
}
