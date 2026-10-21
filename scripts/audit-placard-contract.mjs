/** Real contract UI; browser-only server fixtures. This does not validate SQL, authentication, or production balances. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-contract');
const port = Number(process.env.CONTRACT_AUDIT_PORT ?? 3281), origin = `http://127.0.0.1:${port}`;
const serve = process.argv.includes('--serve');

// Runs in the browser, including --serve. Every response below is explicitly simulated.
function installFixture() {
  const key = 'kq-contract-ui-audit-v1';
  const available = { code: 'light-hand', status: 'available', runId: null, quality: null, cardsUsed: null, rewardCents: 3000, canAccept: true, reason: null };
  let model;
  try { model = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { /* Empty isolated fixture. */ }
  model ||= { snapshot: { ...available }, cash: 100000, credits: 0, requests: [], readError: 0, postError: 0, lostClaim: false, staleRead: false };
  const save = () => sessionStorage.setItem(key, JSON.stringify(model));
  const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const snapshot = extra => ({ ...model.snapshot, ...extra });
  window.__contractFixture = {
    inspect: () => structuredClone(model),
    set(state, overrides = {}) {
      model.snapshot = { ...available, status: state, canAccept: state === 'available' || state === 'failed',
        ...(['active', 'succeeded', 'failed', 'claimed'].includes(state) ? { runId: '10000000-0000-4000-8000-000000000001', quality: 6, cardsUsed: 1 } : {}),
        ...(['succeeded', 'claimed'].includes(state) ? { quality: 9 } : {}), ...overrides };
      save();
    },
    reset() { model = { snapshot: { ...available }, cash: 100000, credits: 0, requests: [], readError: 0, postError: 0, lostClaim: false, staleRead: false }; save(); },
    fault(name) { if (name === 'read') model.readError++; if (name === 'post') model.postError++; if (name === 'lost-claim') model.lostClaim = true; if (name === 'stale-read') model.staleRead = true; save(); },
  };
  window.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin === location.origin && url.pathname === '/api/arena/placard/contracts/board') return response({ error: 'Catalogue renouvelable hors de cette recette du contrat initial.' }, 404);
    if (url.origin !== location.origin || url.pathname !== '/api/arena/placard/contracts') throw new Error('Recette locale : requête non autorisée.');
    const body = method === 'POST' ? JSON.parse(String(init.body || '{}')) : null;
    const request = { method, path: url.pathname, action: body?.action ?? null, completed: false };
    model.requests.push(request); save();
    await new Promise(resolve => setTimeout(resolve, 180));
    request.completed = true; save();
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (method === 'GET') {
      if (model.readError > 0) { model.readError--; save(); return response({ error: 'Lecture temporairement indisponible dans cette simulation.' }, 503); }
      if (model.staleRead && model.snapshot.status === 'claimed') { model.staleRead = false; save(); return response(snapshot({ status: 'succeeded' })); }
      return response(snapshot());
    }
    if (method !== 'POST' || body?.code !== 'light-hand') return response({ error: 'Commande de recette inconnue.' }, 400);
    if (model.postError > 0) { model.postError--; save(); return response({ error: 'Action refusée dans cette simulation. Aucun changement enregistré.' }, 503); }
    if (body.action === 'accept' && ['available', 'failed'].includes(model.snapshot.status) && model.snapshot.canAccept) {
      model.snapshot = { ...available, status: 'accepted', canAccept: false };
    } else if (body.action === 'cancel' && model.snapshot.status === 'accepted') model.snapshot = { ...available };
    else if (body.action === 'claim' && ['succeeded', 'claimed'].includes(model.snapshot.status)) {
      const replayed = model.snapshot.status === 'claimed';
      if (!replayed) { model.cash += model.snapshot.rewardCents; model.credits++; model.snapshot = snapshot({ status: 'claimed', canAccept: false }); }
      save();
      if (model.lostClaim) { model.lostClaim = false; save(); throw new TypeError('Réponse perdue après enregistrement simulé.'); }
      return response(snapshot({ replayed, cashAfterCents: model.cash }));
    } else if (body.action !== 'accept' || model.snapshot.status !== 'accepted') return response({ error: 'Action incompatible avec cet état de recette.' }, 409);
    save(); return response(snapshot());
  };
  save();
}

const fixture = `import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';
import '/src/app/globals.css';import{KqCultureContract}from'/src/components/placard/KqCultureContract';import{KqPlacardMap}from'/src/components/placard/KqPlacardMap';
(${installFixture.toString()})();
function App(){
 const[mode,setModeValue]=useState(()=>sessionStorage.getItem('kq-contract-ui-audit-mode')||'preparation'),[disabled,setDisabled]=useState(false),[busy,setBusy]=useState(false),[opened,setOpened]=useState(false),[mapActive,setMapActive]=useState(false),[mapReady,setMapReady]=useState(false),[mapJury,setMapJury]=useState(false),[foreignRun,setForeignRun]=useState(false);
 const setMode=value=>{sessionStorage.setItem('kq-contract-ui-audit-mode',value);setModeValue(value);};
 const refresh=()=>window.dispatchEvent(new Event('kq:contracts-updated'));
 const choose=(status,overrides={})=>{window.__contractFixture.set(status,overrides);refresh();};
 useEffect(()=>{window.__contractHarness={refresh,mode:setMode,disabled:setDisabled,foreignRun:setForeignRun};},[]);
 return <main className="contract-audit"><aside className="audit-controls" aria-label="Commandes de recette locale">
 <h1>${serve ? 'Quartier & contrat' : 'Contrat Main légère'} · recette locale</h1><p>Composants réels, serveur et argent simulés. Aucun compte réel ni base de données.</p>
 <details><summary>Choisir un état de simulation</summary>
 <label>Emplacement <select data-audit-mode value={mode} onChange={e=>setMode(e.target.value)}><option value="preparation">Avant la culture</option><option value="run">Pendant la culture</option><option value="missions">Dans les missions</option></select></label>
 ${serve ? `<fieldset><legend>Activités simulées dans le quartier</legend><label><input type="checkbox" checked={mapActive} onChange={e=>setMapActive(e.target.checked)}/> Culture en cours</label><label><input type="checkbox" checked={mapReady} onChange={e=>setMapReady(e.target.checked)}/> 2 lots prêts à vendre</label><label><input type="checkbox" checked={mapJury} onChange={e=>setMapJury(e.target.checked)}/> 1 Fleur disponible pour le jury</label></fieldset>` : ''}
 <div className="audit-buttons"><button type="button" onClick={()=>{window.__contractFixture.reset();refresh();setOpened(false);}}>Nouvelle recette</button>
 <button type="button" onClick={()=>choose('active')}>Simuler le lancement</button><button type="button" onClick={()=>choose('failed',{quality:5,cardsUsed:3})}>Simuler un échec</button><button type="button" onClick={()=>choose('succeeded')}>Simuler une réussite</button>
 <button type="button" onClick={()=>{window.__contractFixture.fault('read');refresh();}}>Simuler une erreur de lecture</button><button type="button" onClick={()=>{window.__contractFixture.fault('post');}}>Refuser la prochaine action</button>
 <button type="button" onClick={()=>{window.__contractFixture.fault('lost-claim');}}>Perdre la prochaine réponse de gain</button><button type="button" onClick={refresh}>Relire l’état simulé</button></div>
 <label><input type="checkbox" checked={disabled} onChange={e=>setDisabled(e.target.checked)}/> Simuler une autre action occupée</label>
 <p data-audit-busy>{busy?'Action du contrat en cours':'Contrat disponible pour interaction'}</p></details></aside>
 ${serve ? `<section className="audit-product" aria-label="Aperçu du quartier réel"><KqPlacardMap isolated cashCents={100000} tents={1} activeRun={mapActive} readyLotCount={mapReady?2:0} availableFlowerCount={mapJury?1:0} recommended={mapJury?'arena':mapReady?'market':mapActive?'game':undefined} onOpen={()=>{setOpened(true);document.querySelector('[data-kq-contract]')?.scrollIntoView({block:'center',behavior:'instant'});}} onOpenCollection={()=>setOpened(true)}/></section>` : ''}
 <section className="audit-product" aria-label="Aperçu du contrat réel"><KqCultureContract mode={mode} runId={mode==='run'?(foreignRun?'10000000-0000-4000-8000-000000000002':'10000000-0000-4000-8000-000000000001'):null} disabled={disabled} onBusyChange={setBusy} onOpenGame={()=>setOpened(true)}/></section>
 {opened?<p data-audit-opened>Navigation vers la culture reçue par la recette locale.</p>:null}
 <p className="audit-note">Le lancement et le résultat d’une culture sont simulés par les commandes de recette ; leur calcul serveur n’est pas testé ici.</p></main>;
}createRoot(document.getElementById('root')).render(<App/>);`;
const modules = {
  entry: fixture,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const css = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6;color:#172923;font-family:Body,sans-serif}.contract-audit{max-width:1040px;margin:auto;padding:12px}.audit-controls{padding:16px;border:2px dashed #526157;border-radius:12px;margin-bottom:20px;background:#edf3e9}.audit-controls h1{font-size:19px;margin:0 0 8px}.audit-controls p,.audit-note{font-size:12px;line-height:1.55}.audit-controls summary{min-height:44px;align-content:center;cursor:pointer;font-size:13px}.audit-controls label{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;margin:8px 0}.audit-controls select,.audit-controls button{min-height:44px;border:1px solid #526157;border-radius:8px;padding:8px;background:#fffaf0;color:#172923;font:inherit;font-size:12px}.audit-controls input{width:20px;height:20px}.audit-buttons{display:flex;flex-wrap:wrap;gap:8px}.audit-controls :focus-visible{outline:3px solid #076c61;outline-offset:3px}.audit-product{min-width:0}.audit-note{margin-top:24px}`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'] }, resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'contract-local-audit', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => {
      if (!['/', '/arene/placard'].includes(req.url?.split('?')[0])) return next();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
      res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Main légère · recette locale</title><style>${css}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);
    }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser, page;
const checks = [], errors = [], blockedRequests = [];
const scope = 'Real KqCultureContract, CSS and browser interactions; simulated API and balances. No SQL, authentication, server integration or production validation.';
await mkdir(output, { recursive: true });
await server.listen();
if (serve) {
  console.log(`Aperçu local interactif : ${origin}/arene/placard — données de recette uniquement.`);
  const close = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
} else try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => { const url = new URL(request.url()); if (url.protocol === 'data:' || url.origin === origin) void request.continue(); else { blockedRequests.push(request.url()); void request.abort(); } });
  const ready = status => page.waitForSelector(`[data-kq-contract][data-contract-status="${status}"]`);
  const action = name => `[data-contract-action="${name}"]`;
  const expand = async () => { if (!await page.$eval('[data-kq-contract]', element => element.open)) await page.click('[data-kq-contract] > summary'); };
  const click = async name => { await expand(); await page.waitForSelector(`${action(name)}:not(:disabled)`, { visible: true }); await page.click(action(name)); };
  const reset = async (status = 'available', mode = 'preparation', overrides = {}) => {
    await page.waitForFunction(() => !!window.__contractFixture && !!window.__contractHarness);
    await page.evaluate(({ status, mode, overrides }) => { window.__contractFixture.reset(); window.__contractFixture.set(status, overrides); window.__contractHarness.mode(mode); window.__contractHarness.disabled(false); window.__contractHarness.foreignRun(false); window.__contractHarness.refresh(); }, { status, mode, overrides });
    await page.waitForFunction(() => window.__contractFixture.inspect().requests.some(request => request.method === 'GET' && request.completed));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await ready(status);
  };
  const state = () => page.evaluate(() => window.__contractFixture.inspect());
  const layout = async label => { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${label}: no horizontal overflow`); };
  const capture = async name => { await page.$eval('[data-kq-contract]', element => element.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); };
  await page.goto(origin + '/arene/placard', { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready); await ready('available');

  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700, deviceScaleFactor: 1 });
    await reset(); await layout(`available ${width}`); await capture(`available-${width}`);
    await page.focus('[data-kq-contract] > summary'); await page.keyboard.press('Enter');
    await page.waitForSelector(`${action('accept')}:not(:disabled)`, { visible: true });
    await page.focus(action('accept')); await page.keyboard.press('Enter'); await ready('accepted');
    await expand(); await page.focus(action('cancel')); await page.keyboard.press('Enter'); await ready('available');
    await reset('active', 'run'); await layout(`active ${width}`); await capture(`active-${width}`);
    await reset('succeeded', 'missions'); await layout(`succeeded ${width}`); await capture(`succeeded-${width}`);
    checks.push({ width, noOverflow: true, keyboardAcceptCancel: true, modes: ['preparation', 'run', 'missions'] });
  }

  await reset(); await click('accept'); await ready('accepted');
  await page.reload({ waitUntil: 'networkidle0' }); await ready('accepted');
  await page.evaluate(() => { window.__contractFixture.set('active'); window.__contractHarness.mode('run'); window.__contractHarness.refresh(); }); await ready('active');
  await page.reload({ waitUntil: 'networkidle0' }); await ready('active');
  await page.evaluate(() => { window.__contractFixture.set('failed', { quality: 5, cardsUsed: 3 }); window.__contractHarness.mode('preparation'); window.__contractHarness.refresh(); }); await ready('failed');
  await capture('failed-1440'); await click('accept'); await ready('accepted');
  await page.evaluate(() => { window.__contractFixture.set('succeeded'); window.__contractHarness.mode('missions'); window.__contractHarness.refresh(); }); await ready('succeeded');
  await page.$eval(action('claim'), button => { button.click(); button.click(); }); await ready('claimed');
  assert.equal((await state()).credits, 1); assert.equal((await state()).cash, 103000);
  assert.equal((await state()).requests.filter(request => request.action === 'claim').length, 1, 'Double click sends only one claim');
  await page.reload({ waitUntil: 'networkidle0' }); await ready('claimed');
  checks.push({ scenario: 'accept-reload-active-fail-retry-succeed-claim-reload', credits: 1, doubleClickRequestCount: 1 });

  await page.evaluate(() => { window.__contractFixture.fault('stale-read'); window.__contractHarness.refresh(); }); await ready('succeeded');
  await click('claim'); await ready('claimed'); assert.equal((await state()).credits, 1);
  checks.push({ scenario: 'stale-success-snapshot-replayed-claim', credits: 1, note: 'UI handles replay fixture; SQL idempotency is tested separately.' });

  await reset(); await page.evaluate(() => { window.__contractFixture.fault('read'); window.__contractHarness.refresh(); });
  await ready('error'); await click('retry'); await ready('available');
  checks.push({ scenario: 'read-error-retry' });
  await reset(); await page.evaluate(() => window.__contractFixture.fault('post')); await click('accept');
  await page.waitForFunction(() => document.querySelector('[data-kq-contract]')?.textContent.includes('Action refusée'));
  assert.equal((await state()).snapshot.status, 'available'); await capture('action-error-1440');
  await click('retry'); await ready('available'); await click('accept'); await ready('accepted');
  checks.push({ scenario: 'rejected-action-keeps-available-recover' });

  await reset('succeeded', 'missions'); await page.evaluate(() => window.__contractFixture.fault('lost-claim')); await click('claim');
  await ready('error'); assert.equal((await state()).credits, 1);
  await click('retry'); await ready('claimed'); assert.equal((await state()).credits, 1);
  checks.push({ scenario: 'lost-claim-response-reread-reconciles', credits: 1 });

  await reset(); await page.evaluate(() => window.__contractHarness.disabled(true));
  assert.equal(await page.$eval(action('accept'), element => element.disabled), true);
  await page.evaluate(() => window.__contractHarness.disabled(false)); await click('accept');
  await page.waitForFunction(() => document.querySelector('[data-audit-busy]')?.textContent.includes('en cours'));
  await ready('accepted'); await page.waitForFunction(() => !document.querySelector('[data-audit-busy]')?.textContent.includes('en cours'));
  checks.push({ scenario: 'disabled-and-busy-coordination' });

  await reset('available', 'preparation', { canAccept: false, reason: 'Une culture est déjà en cours dans cette recette.' });
  assert((await page.$eval('[data-kq-contract]', element => element.textContent)).includes('Une culture est déjà en cours'));
  const acceptEnabled = await page.$eval('[data-kq-contract]', element => [...element.querySelectorAll('[data-contract-action="accept"]')].some(button => !button.disabled));
  assert.equal(acceptEnabled, false); checks.push({ scenario: 'prerequisite-visible-accept-unavailable' });
  await reset('active', 'run', { quality: null, cardsUsed: null });
  assert((await page.$eval('[data-kq-contract]', element => element.textContent)).includes('— / 2 cartes'));
  assert.equal(await page.$(action('claim')), null); checks.push({ scenario: 'unknown-live-metrics-stay-unknown-no-claim' });
  await reset('active', 'run', { quality: 9, cardsUsed: 3 });
  assert((await page.$eval('[data-kq-contract]', element => element.textContent)).includes('Limite de cartes dépassée'));
  assert.equal(await page.$(action('claim')), null); checks.push({ scenario: 'card-budget-exceeded-no-claim' });
  await reset('active', 'run'); await page.evaluate(() => { window.__contractFixture.fault('read'); window.__contractHarness.refresh(); });
  await ready('error'); await click('retry'); await ready('active');
  checks.push({ scenario: 'known-active-run-read-error-visible-and-retry' });
  await reset('succeeded', 'run'); await page.evaluate(() => window.__contractFixture.fault('lost-claim')); await click('claim');
  await ready('error'); assert.equal((await state()).credits, 1); assert.equal(await page.$(action('claim')), null);
  await click('retry'); await ready('claimed'); assert.equal((await state()).credits, 1); assert.equal(await page.$(action('claim')), null);
  assert.equal((await state()).requests.filter(request => request.action === 'claim').length, 1);
  checks.push({ scenario: 'known-run-lost-claim-reconciles-without-second-claim', credits: 1 });
  await reset('active', 'run'); await page.evaluate(() => window.__contractHarness.foreignRun(true));
  await page.waitForFunction(() => !document.querySelector('[data-kq-contract]'));
  checks.push({ scenario: 'foreign-run-hides-contract' });
  assert.deepEqual(errors, []); assert.deepEqual(blockedRequests, []);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: true, scope, checks, errors, blockedRequests }, null, 2));
  console.log(JSON.stringify({ success: true, output, checks: checks.length, scope }));
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: false, scope, checks, errors, blockedRequests, failure: error.stack }, null, 2)); throw error;
} finally { if (!serve) { await browser?.close(); await server.close(); } }
