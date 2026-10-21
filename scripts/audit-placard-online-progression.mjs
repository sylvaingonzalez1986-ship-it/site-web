/** Real boutique UI and local operations only. --preview keeps an isolated demo open. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/online-progression');
const port = Number(process.env.KQ_ONLINE_PROGRESSION_PORT ?? 3397);
const preview = process.argv.includes('--preview');
const origin = `http://127.0.0.1:${port}`;
const modules = {
  entry: `import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KqBusinessPanel} from '/src/components/placard/KqBusinessPanel';
import {AppDialog} from '/src/components/ui/AppDialog';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
import {KQ_ONLINE_SITE_TIERS,getKqOnlineUpgradeCost} from '/src/lib/kanab-quest-online';
import {getKqShopDashboard} from '/src/lib/kanab-quest-shop-strategy';
import {formatKqCash} from '/src/lib/kanab-quest-equipment';
let state=createKqOperationsLesson('market');
const execute=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;return result.payload};
const command=(command,payload)=>execute({action:'online',command,payload});
const raw=getKqOperationsCommerce(state).rawLots[0];
execute({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
const source=state.trial.commerce.stocks[0];
const firstUnits=Math.floor(source.initialUnits*.6),secondUnits=source.initialUnits-firstUnits;
state.trial.commerce.stocks=[{...source,id:'11111111-1111-4111-8111-111111111111',name:'Brume bretonne',initialUnits:firstUnits,remainingUnits:firstUnits,equivalentUnits:firstUnits},{...source,id:'22222222-2222-4222-8222-222222222222',name:'La sélection de la côte',initialUnits:secondUnits,remainingUnits:secondUnits,equivalentUnits:secondUnits}];
state.trial.commerce.business.shop.name='L’atelier des Chanvriers';
for(const stock of [...state.trial.commerce.stocks]){
 const packets=Math.min(24,Math.floor(stock.initialUnits/50));
 command('buy-packaging',{code:'kraft-5',quantity:packets});
 command('create-listing',{stockId:stock.id,formatGrams:5,packagingCode:'kraft-5',packets,packetPriceCents:913});
}
const baseline=structuredClone(state);
const tiers=KQ_ONLINE_SITE_TIERS;
const options=[['ready','Départ · tous les prérequis réunis'],['pro','Professionnelle · niveau historique'],['legacy','Ancien serveur · trois niveaux'],['flagship','Sixième niveau installé'],['orders','Commandes insuffisantes'],['confidence','Confiance insuffisante'],['followers','Audience insuffisante'],['photography','Photographies manquantes'],['branding','Identité manquante'],['both-upgrades','Photos et marque manquantes'],['funds','Trésorerie insuffisante'],['busy','Action déjà en cours'],['paused','Hébergement suspendu'],['error','Refus simulé à la confirmation']];
function makeScenario(name){
 state=structuredClone(baseline);
 const c=state.trial.commerce,o=c.online;
 c.cashCents=10000000;o.stats.orders=500;o.confidence=95;o.followers=400;o.upgrades.photography=true;o.upgrades.branding=true;o.site.maxLevel=6;
 let current='basic';
 if(['pro','legacy','paused'].includes(name))current='pro';
 if(name==='flagship')current='flagship';
 if(name==='both-upgrades'){current='studio';o.upgrades.photography=false;o.upgrades.branding=false}
 if(['orders','confidence','followers','photography','branding'].includes(name)){
   const field={orders:'minimumOrders',confidence:'minimumConfidence',followers:'minimumFollowers'}[name];
   const index=tiers.findIndex(tier=>field?tier[field]:tier.requiredUpgrades.includes(name));
   if(index<1)throw new Error('No catalog prerequisite for '+name);
   current=tiers[index-1].code;
   if(name==='orders')o.stats.orders=tiers[index].minimumOrders-1;
   if(name==='confidence')o.confidence=tiers[index].minimumConfidence-1;
   if(name==='followers')o.followers=tiers[index].minimumFollowers-1;
   if(name==='photography')o.upgrades.photography=false;
   if(name==='branding')o.upgrades.branding=false;
 }
 if(name==='funds')c.cashCents=100;
 const tier=tiers.find(row=>row.code===current);if(!tier)throw new Error('Missing tier '+current);
 Object.assign(o.site,{tier:current,active:name!=='paused',paidUntil:current==='basic'?null:new Date(state.trial.clock+240*3600000).toISOString()});
 Object.assign(c.business.shop,{tier:current,active:o.site.active,monthlyCents:tier.monthlyCents,paidUntil:o.site.paidUntil});
 if(name==='legacy')delete o.site.maxLevel;
 return state;
}
makeScenario('ready');
window.requests=[];window.fixture=()=>structuredClone(getKqOperationsCommerce(state));window.catalog=()=>structuredClone(tiers);
window.dashboard=()=>structuredClone(getKqShopDashboard(getKqOperationsCommerce(state)));
window.upgradeCost=(current,target)=>getKqOnlineUpgradeCost(current,target);
window.testRejected=body=>{const before=structuredClone(state);try{applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});return {rejected:false}}catch(error){return {rejected:true,error:error.message,unchanged:JSON.stringify(before)===JSON.stringify(state)}}};
const api=createKqTutorialApi(async()=>{throw new Error('This isolated component never requests a live API')});
function App(){
 const[,refresh]=useState(0),[scenario,setScenario]=useState('ready'),[pending,setPending]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const committing=useRef(false);
 window.setScenario=name=>{if(committing.current)throw new Error('Wait for the pending local command');makeScenario(name);window.requests=[];window.pending=null;setPending(null);setError('');setBusy(false);setScenario(name);refresh(value=>value+1)};
 const ask=(title,description,body,cost)=>{if(busy)return;const next={title,description,body,cost:cost??0};window.pending=structuredClone(next);setError('');setPending(next)};
 const close=()=>{if(committing.current)return;window.pending=null;setPending(null);setError('')};
 const confirm=async()=>{if(!pending||committing.current)return;committing.current=true;setBusy(true);window.requests.push(structuredClone(pending.body));try{await new Promise(resolve=>setTimeout(resolve,180));if(scenario==='error')throw new Error('Opération refusée dans cette simulation. Aucun débit.');execute(pending.body);window.pending=null;setPending(null);refresh(value=>value+1)}catch(failure){setError(failure.message)}finally{committing.current=false;setBusy(false)}};
 const data=getKqOperationsCommerce(state);
 return <KqTutorialApiProvider api={api}><aside className="fixture-tools" aria-label="Outils de démonstration"><strong>Démo locale · six niveaux de boutique</strong><p>Données fictives en mémoire. Les scénarios fournissent les prérequis pour comparer les niveaux ; aucune partie ni aucun compte n’est modifié.</p><label>Scénario <select data-fixture-scenario value={scenario} onChange={event=>window.setScenario(event.target.value)} disabled={busy}>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={()=>window.setScenario(scenario)} disabled={busy}>Réinitialiser la démonstration</button></aside><main className="audit-surface"><KqBusinessPanel key={scenario} expanded showAccounting={false} data={data} busy={busy||scenario==='busy'} now={state.trial.clock} onAsk={ask} onOpenShop={()=>{window.navigation='equipment'}} onPrepareStock={()=>{window.navigation='prepare'}} onViewSales={()=>{window.navigation='sales'}}/></main>
 <AppDialog open={Boolean(pending)} onClose={close} title={pending?.title} closeOnBackdrop={!busy} footer={<><button type="button" onClick={close} disabled={busy}>Annuler</button><button type="button" data-confirm-upgrade onClick={confirm} disabled={busy}>{busy?'Validation…':'Confirmer'}</button></>}><p>{pending?.description}</p><strong data-confirm-cost>{formatKqCash(pending?.cost??0)}</strong>{error?<p role="alert">{error}</p>:null}</AppDialog></KqTutorialApiProvider>
}
createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2);font-weight:800}@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Bold.woff2);font-weight:700}@font-face{font-family:AuditBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:400 700}
:root{--font-display:AuditDisplay;--font-body:AuditBody;--game-surface-warm:#ffad63;--game-ink:#172923;--game-cream:#fff8e7;--game-gold:#efc451;--game-teal:#149b8b}*{box-sizing:border-box}body{margin:0;font-family:AuditBody,Arial,sans-serif;background:#fff3db;color:#172923}.audit-surface{max-width:1160px;margin:20px auto;padding:12px}button,input,select{font-family:inherit}button{cursor:pointer}.fixture-tools{max-width:1136px;margin:12px auto;padding:12px;border:1px dashed #345d4b;background:#eaf2ee;font-size:12px}.fixture-tools p{margin:6px 0}.fixture-tools label{display:inline-flex;align-items:center;gap:8px;max-width:100%;flex-wrap:wrap}.fixture-tools select{min-width:0;max-width:100%;min-height:44px}.fixture-tools button,dialog footer button{min-height:44px;padding:8px 12px;margin:4px;background:#fff8e7;border:2px solid #172923;border-radius:8px}dialog p{line-height:1.6}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:600px){.fixture-tools{margin:8px}}
</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></body></html>`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  plugins: [{
    name: 'isolated-online-progression', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url?.startsWith('/api/')) { response.statusCode = 403; response.end('Local demo: real API access is disabled'); return; }
        if (request.url !== '/') return next();
        response.setHeader('Content-Type', 'text/html'); response.end(html);
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

const checks = [], errors = [], forbidden = [], measures = [];
let browser, page;
const progression = '[data-online-progression]';
const upgrade = '[data-online-upgrade]';
const tierButton = code => `[data-online-tier="${code}"]`;
await mkdir(output, { recursive: true });
await server.listen();
if (preview) {
  console.log(`Isolated six-level boutique demo: ${origin} (PID ${process.pid}). No remote account or persistent data.`);
  await new Promise(resolveStop => {
    const stop = () => { void server.close().then(resolveStop); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  });
} else try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if ((url.startsWith(origin + '/') && !url.includes('/api/')) || url.startsWith('data:')) void request.continue();
    else { forbidden.push(url); void request.abort(); }
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(origin, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const click = async (text, scope = 'body') => {
    const handle = await page.waitForFunction((text, scope) => [...document.querySelectorAll(scope + ' button')].find(node => node.textContent.trim() === text && !node.disabled && node.getBoundingClientRect().height > 0), {}, text, scope);
    await handle.asElement().click(); await handle.dispose();
  };
  const showProgression = async () => {
    await click('Améliorations', '[aria-label="Gérer ma boutique"]');
    await click('Le site internet');
    await page.waitForSelector(progression, { visible: true });
  };
  const snapshot = () => page.evaluate(() => window.fixture());
  const selected = code => page.waitForFunction(code => document.querySelector('[data-online-tier="' + code + '"]')?.getAttribute('aria-pressed') === 'true', {}, code);
  const reset = async name => {
    await page.evaluate(name => window.setScenario(name), name);
    await page.waitForFunction(name => document.querySelector('[data-fixture-scenario]')?.value === name, {}, name);
    await showProgression();
  };
  const choose = async code => { await page.click(tierButton(code)); await selected(code); };
  const noOverflow = async label => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': no horizontal page overflow');
    assert.doesNotMatch(await page.$eval(progression, node => node.innerText), /NaN|undefined|Infinity/);
  };
  await showProgression();
  const catalog = await page.evaluate(() => window.catalog());
  assert.deepEqual(catalog.map(tier => tier.code), ['basic', 'improved', 'pro', 'studio', 'signature', 'flagship']);
  assert.equal(await page.$$eval('[data-online-tier]', nodes => nodes.length), 6);
  const initial = await snapshot();
  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000 });
    for (const tier of catalog) {
      await choose(tier.code); await noOverflow(`${width}/${tier.code}`);
      const comparison = await page.$eval('[data-online-comparison]', node => ({ gain: Number(node.dataset.conversionGain), monthly: Number(node.dataset.monthlyCents), text: node.innerText }));
      assert.ok(Math.abs(comparison.gain - (tier.conversionMultiplier / catalog[0].conversionMultiplier - 1) * 100) < 1e-9);
      assert.equal(comparison.monthly, tier.monthlyCents);
      assert.match(comparison.text, /même offre et audience/);
    }
    assert.deepEqual(await snapshot(), initial, 'Browsing all six tiers is free at ' + width);
    await choose('improved');
    measures.push(await page.$eval(progression, node => ({ width: innerWidth, height: Math.round(node.getBoundingClientRect().height), top: Math.round(node.getBoundingClientRect().top + scrollY) })));
    await page.screenshot({ path: resolve(output, `progression-${width}.png`), fullPage: true });
    await (await page.$(progression)).screenshot({ path: resolve(output, `progression-panel-${width}.png`) });
  }
  assert.equal(await page.evaluate(() => window.requests.length), 0);
  checks.push('six levels are inspectable at 320, 390 and 1440 px without overflow, invented values or mutations');

  await page.focus(tierButton('flagship')); await page.keyboard.press('Enter'); await selected('flagship');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-online-tier')), 'flagship');
  assert.equal(await page.$eval(upgrade, node => node.disabled), true, 'A distant tier cannot be bought');
  await page.focus(tierButton('improved')); await page.keyboard.press('Space'); await selected('improved');
  for (const [key, code] of [['End', 'flagship'], ['ArrowLeft', 'signature'], ['Home', 'basic'], ['ArrowRight', 'improved']]) {
    await page.keyboard.press(key); await selected(code);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-online-tier')), code);
  }
  assert.deepEqual(await snapshot(), initial);
  checks.push('keyboard comparison remains free and cannot skip directly to a distant level');

  for (const name of ['orders', 'confidence', 'followers', 'photography', 'branding', 'funds']) {
    await reset(name);
    const key = name === 'funds' ? 'budget' : name;
    const before = await snapshot();
    const current = catalog.findIndex(tier => tier.code === before.online.site.tier);
    await choose(catalog[current + 1].code);
    assert.equal(await page.$eval(`[data-online-condition="${key}"]`, node => node.getAttribute('data-met')), 'false', key + ' is explicitly unmet');
    assert.equal(await page.$eval(upgrade, node => node.disabled), true);
    assert.equal(await page.evaluate(() => window.requests.length), 0);
    await noOverflow(name);
    checks.push(key + ' prerequisite is explicit and blocks an unaffordable or premature upgrade');
  }

  await reset('both-upgrades'); await choose('signature');
  await page.setViewport({ width: 320, height: 1000 });
  await noOverflow('320 px: both missing presentation upgrades');
  for (const [key, cost] of [['photography', 300], ['branding', 700]]) {
    const text = await page.$eval(`[data-online-condition="${key}"]`, node => node.innerText);
    assert.match(text, new RegExp('À acquérir.*' + cost + '\\s*€'));
  }
  await page.screenshot({ path: resolve(output, 'missing-photo-brand-320.png'), fullPage: true });
  await click('Voir les photos et la marque', progression);
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === 'Photos et marque' && document.activeElement.getAttribute('aria-pressed') === 'true');
  assert.equal(await page.evaluate(() => window.requests.length), 0);
  checks.push('both missing upgrades show their 300/700 euro costs at 320 px and the brand link transfers keyboard focus');

  await reset('busy'); await choose('improved');
  assert.equal(await page.$eval(upgrade, node => node.disabled), true);
  checks.push('busy state disables the purchase while retaining tier inspection');

  await reset('legacy'); await choose('studio');
  assert.equal(await page.$eval(upgrade, node => node.disabled), true);
  assert.equal(await page.$$eval('[data-online-tier]', nodes => nodes.length), 6);
  assert.equal((await snapshot()).online.site.tier, 'pro');
  checks.push('legacy snapshots without maxLevel preserve professional ownership and preview six levels without permitting level four');

  await reset('pro'); await choose('studio');
  const beforePro = await snapshot();
  assert.equal(await page.$eval(upgrade, node => node.disabled), false);
  await page.click(upgrade); await page.waitForSelector('dialog[open][data-app-dialog]');
  assert.equal(await page.evaluate(() => window.pending.body.payload.tier), 'studio');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.deepEqual(await snapshot(), beforePro);
  checks.push('the historical professional level remains eligible for studio, and real AppDialog Escape spends nothing');

  await reset('ready'); await choose('improved');
  const beforePurchase = await snapshot();
  await page.click(upgrade); await page.waitForSelector('dialog[open][data-app-dialog]');
  const pending = await page.evaluate(() => window.pending);
  assert.deepEqual(pending.body, { action: 'online', command: 'upgrade-site', payload: { tier: 'improved' } });
  assert.equal(pending.cost, catalog[1].acquisitionCents - catalog[0].acquisitionCents);
  assert.deepEqual(await snapshot(), beforePurchase);
  await click('Annuler', 'dialog[open]'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.deepEqual(await snapshot(), beforePurchase);
  assert.equal(await page.evaluate(() => window.requests.length), 0);
  checks.push('purchase confirmation names the exact next tier and differential cost; cancellation is inert');

  for (let index = 1; index < catalog.length; index++) {
    const target = catalog[index], previous = await snapshot();
    const previousDashboard = await page.evaluate(() => window.dashboard());
    await choose(target.code);
    assert.equal(await page.$eval(upgrade, node => node.disabled), false, target.code + ' can be installed next');
    await page.click(upgrade); await page.waitForSelector('dialog[open][data-app-dialog]');
    const cost = await page.evaluate(() => window.pending.cost);
    assert.equal(cost, target.acquisitionCents - catalog[index - 1].acquisitionCents);
    const requestsBefore = await page.evaluate(() => window.requests.length);
    await page.click('[data-confirm-upgrade]', { clickCount: 2, delay: 20 });
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    const after = await snapshot();
    assert.equal(after.online.site.tier, target.code);
    assert.equal(after.cashCents, previous.cashCents - cost);
    assert.equal(await page.evaluate(() => window.requests.length), requestsBefore + 1);
    assert.deepEqual(after.online.listings, previous.online.listings);
    assert.deepEqual(after.online.stats, previous.online.stats);
    assert.equal(after.online.followers, previous.online.followers);
    assert.equal(after.online.confidence, previous.online.confidence);
    assert.deepEqual(after.online.recentSales, previous.online.recentSales);
    const afterDashboard = await page.evaluate(() => window.dashboard());
    assert.ok(previousDashboard.ordersPerDay > 0, 'A stocked real offer permits comparison');
    assert.ok(Math.abs(afterDashboard.ordersPerDay / previousDashboard.ordersPerDay - target.conversionMultiplier / catalog[index - 1].conversionMultiplier) < 1e-9, 'Real offer cadence matches the catalog gain');
    assert.equal(afterDashboard.visitorsPerDay, previousDashboard.visitorsPerDay, 'A site upgrade does not invent visits');
    assert.equal(after.online.site.renew, true);
    if (target.code === 'improved') {
      assert.equal(await page.$eval('[data-online-comparison] dd', node => node.textContent), '×1,25');
      await page.screenshot({ path: resolve(output, 'improved-installed-320.png'), fullPage: true });
    }
    if (previous.online.site.paidUntil) assert.ok(Date.parse(after.online.site.paidUntil) >= Date.parse(previous.online.site.paidUntil), 'An upgrade preserves a longer prepaid period');
    checks.push(target.code + ': one confirmed operation, exact differential debit, stock/audience/sales preserved');
  }
  await choose('flagship');
  assert.equal(await page.$eval(upgrade, node => node.disabled).catch(() => true), true);
  assert.equal((await snapshot()).online.site.tier, 'flagship');
  await page.screenshot({ path: resolve(output, 'flagship-installed.png'), fullPage: true });
  checks.push('the sixth tier is installed once and cannot be repurchased');

  await reset('error'); await choose('improved');
  const beforeError = await snapshot();
  await page.click(upgrade); await page.waitForSelector('dialog[open]'); await page.click('[data-confirm-upgrade]');
  await page.waitForSelector('dialog[open] [role="alert"]');
  assert.deepEqual(await snapshot(), beforeError);
  await click('Annuler', 'dialog[open]'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  checks.push('a rejected operation keeps the confirmation error visible and changes no funds or ownership');

  await reset('ready');
  for (const target of ['basic', 'pro', 'flagship', 'unknown']) {
    const result = await page.evaluate(target => window.testRejected({ action: 'online', command: 'upgrade-site', payload: { tier: target } }), target);
    assert.equal(result.rejected, true, target + ' cannot bypass the progression');
    assert.equal(result.unchanged, true, 'Rejected upgrade cannot mutate the original state');
  }
  checks.push('real operations refuse duplicate, skipped and unknown levels without mutating the state');

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await choose('studio');
  await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
  assert.deepEqual(await page.$eval(progression, node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && Number(animation.effect?.getTiming().duration) > 100).map(animation => animation.animationName)), []);
  await page.evaluate(() => { for (const img of document.images) img.loading = 'eager'; });
  await page.waitForFunction(() => [...document.images].every(img => img.complete));
  assert.deepEqual(await page.evaluate(() => [...document.images].filter(img => !img.naturalWidth).map(img => img.src)), []);
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  checks.push('reduced motion, image loading and isolation complete without browser errors or external requests');
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: true, checks, measures, errors, forbidden }, null, 2));
  console.log(JSON.stringify({ success: true, checks: checks.length, measures, output }, null, 2));
} catch (error) {
  if (page) await Promise.race([page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}), new Promise(resolveTimeout => setTimeout(resolveTimeout, 3000))]);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: false, checks, measures, errors, forbidden, failure: String(error) }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
}
