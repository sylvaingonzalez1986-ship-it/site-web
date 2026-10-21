/** Real player shell and village; destination stubs and local API fixtures only. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-village-ambience');
const port = Number(process.env.VILLAGE_AMBIENCE_AUDIT_PORT ?? 3279), origin = `http://127.0.0.1:${port}`;
const destinations = Object.fromEntries(['KqHarvests', 'KanabQuestDicePrototype', 'KqWarehouseEntry', 'KqMarketDesk', 'KqTreasuryDesk', 'KqSupportBoosterShop', 'KqMissionCenter'].map(name => [`./${name}`, `import React from 'react';export function ${name}(){return <p data-audit-destination>Destination de navigation simulée</p>}`]));
const modules = {
  entry: `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';import {PlacardPlayerShell} from '/src/components/placard/PlacardPlayerShell';import {KqPlacardMap} from '/src/components/placard/KqPlacardMap';createRoot(document.getElementById('root')).render(location.search.includes('isolated=1')?<KqPlacardMap isolated cashCents={100000} tents={1} onOpen={()=>{}} onOpenCollection={()=>{}}/>:<PlacardPlayerShell/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
  ...Object.fromEntries(Object.entries(destinations).map(([id, body]) => ['destination:' + id, body])),
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'] }, resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'village-ambience-audit', enforce: 'pre', resolveId(id, importer) { if (importer?.replaceAll('\\', '/').endsWith('/PlacardPlayerShell.tsx') && id in destinations) return '\0destination:' + id; if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.split('?')[0] !== '/arene/placard') return next(); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quartier · recette locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser, scenario = 'starter';
const results = [], errors = [], requests = [];
function payload(path) {
  if (path === '/api/arena/placard/equipment') return { activeRun: scenario === 'active', readyLotCount: scenario === 'lots' ? 2 : 0, availableFlowerCount: scenario === 'jury' ? 1 : 0, ownedCodes: [], cashCents: 100000, productionUnits: 1,
    routeMasteries: scenario === 'first-sale' ? [{ route: 'dry-sift', saleCount: 1, bestJuryScore: 7 }] : scenario === 'mastered' ? [{ route: 'ice-water-hash', saleCount: 31, bestJuryScore: 8 }] : ['craft', 'overflow'].includes(scenario) ? [{ route: 'raw', saleCount: 2, bestJuryScore: 7 }, { route: 'dry-sift', saleCount: 6, bestJuryScore: 8 }] : [] };
  if (path === '/api/arena/placard/storage') return { serverNow: '2026-10-19T12:00:00.000Z', lots: scenario === 'overflow' ? [{ flowerId: 'local-fixture', projection: { nextChangeAt: '2026-10-19T13:00:00.000Z', capacity: { overflowUnits: 1250, overflowDeadlineAt: '2026-10-19T13:00:00.000Z' } } }] : [] };
  return null;
}
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => {
    window.__audioAudit = { contexts: 0, notes: 0 };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__audioAudit.contexts++; }
      createOscillator() { window.__audioAudit.notes++; return super.createOscillator(); }
    };
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url()); if (url.protocol === 'data:') return void request.continue();
    if (url.origin !== origin) return void request.abort();
    if (!url.pathname.startsWith('/api/')) return void request.continue();
    requests.push({ path: url.pathname, method: request.method() });
    const body = payload(url.pathname), failed = scenario === 'error' && url.pathname.endsWith('/equipment');
    void request.respond({ status: failed ? 503 : body ? 200 : 404, contentType: 'application/json', body: JSON.stringify(failed ? { error: 'Recette locale' } : body ?? {}) });
  });
  async function load(state, query = '') { scenario = state; await page.goto(`${origin}/arene/placard${query}`, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready); }
  async function noOverflow(label) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': no horizontal overflow'); }
  async function compactVillage(hasAction = true) {
    await page.waitForSelector('[data-placard-lobby] [data-placard-map]');
    if (hasAction) await page.waitForSelector('[data-placard-lobby] > [aria-label="À faire maintenant"]');
    else await page.waitForFunction(() => document.querySelector('[data-placard-lobby]')?.textContent.includes('Ton résumé est indisponible'));
    const layout = await page.$eval('[data-placard-lobby]', element => {
      const actions = element.querySelectorAll(':scope > [aria-label="À faire maintenant"]');
      const map = element.querySelector(':scope > [data-placard-map]');
      return {
        actionBanners: actions.length,
        actionIsFirst: element.firstElementChild === actions[0],
        mapImmediatelyAfterAction: map?.previousElementSibling === actions[0],
        mapIsFirst: element.firstElementChild === map,
        achievementPresent: Boolean(element.querySelector('[data-village-achievement], [data-sylvain-advice]')),
      };
    });
    assert.equal(layout.achievementPresent, false, 'No extra accomplishment card, regardless of sales history');
    assert.equal(layout.actionBanners, hasAction ? 1 : 0, 'Only the useful next-action banner remains');
    if (hasAction) assert(layout.actionIsFirst && layout.mapImmediatelyAfterAction, 'The village map immediately follows the single next-action banner');
    else assert(layout.mapIsFirst, 'The village remains directly accessible when its summary is unavailable');
    return layout;
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
    await load('craft'); const layout = await compactVillage();
    assert.equal(await page.$eval('[data-placard-view]', element => element.dataset.placardView), 'hub', 'Real shell entry');
    await noOverflow(width + 'px');
    await page.screenshot({ path: resolve(output, `quartier-${width}.png`), fullPage: true });
    await page.focus('[data-placard-lobby] > [aria-label="À faire maintenant"] button'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-audit-destination]');
    assert(['game', 'workshop'].includes(await page.$eval('[data-placard-view]', element => element.dataset.placardView)), 'Next-action keyboard navigation reaches culture or equipment');
    await page.goBack(); await compactVillage();
    const soundSize = await page.$eval('[data-map-sound]', element => { const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height }; });
    assert(soundSize.width >= 44 && soundSize.height >= 44, 'Accessible sound target');
    assert.equal(await page.$eval('[data-map-sound]', element => element.getAttribute('aria-pressed')), 'false');
    assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 0, 'No audio context before opt-in');
    await page.focus('[data-map-sound]'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-map-sound]').getAttribute('aria-pressed') === 'true');
    await page.focus('[data-map-building="warehouse"]'); await page.keyboard.press('Enter');
    await page.waitForSelector('#placard-building-details');
    await page.waitForFunction(() => document.activeElement?.id === 'placard-building-details');
    assert.equal(await page.evaluate(() => window.__audioAudit.notes), 1, 'Explicit keyboard selection plays a note');
    await page.keyboard.press('Escape'); assert.equal(await page.$eval('[data-map-building="warehouse"]', element => element === document.activeElement), true);
    await page.click('[data-map-sound]'); await page.waitForFunction(() => document.querySelector('[data-map-sound]').getAttribute('aria-pressed') === 'false');
    await page.focus('[data-map-building="market"]'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'placard-building-details');
    assert.equal(await page.evaluate(() => window.__audioAudit.notes), 1, 'Muted navigation makes no new sound');
    await page.focus('[data-placard-activity="market"]'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-placard-view="market"]'); await page.waitForSelector('[data-audit-destination]');
    await page.goBack(); await page.waitForSelector('[data-placard-lobby]');
    assert.equal(await page.$eval('[data-map-sound]', element => element.getAttribute('aria-pressed')), 'false', 'Returning never re-enables audio');
    results.push({ width, entry: 'PlacardPlayerShell → KqPlacardLobby → KqPlacardMap', keyboard: true, overflow: false, soundOptIn: true, mute: true, layout, nextActionNavigation: true });
  }
  await page.setViewport({ width: 320, height: 900 });
  for (const state of ['starter', 'active', 'lots', 'jury', 'first-sale', 'mastered', 'overflow', 'error']) {
    await load(state); const layout = await compactVillage(state !== 'error'); await noOverflow(state);
    if (state === 'overflow') assert((await page.$eval('[data-priority="storage"]', element => element.textContent)).includes('125 g sans contenant'));
    if (state === 'error') { assert.equal(await page.$('[data-village-reply]'), null); assert((await page.$eval('body', element => element.textContent)).includes('Ton résumé est indisponible')); }
    else if (state !== 'overflow') assert((await page.$eval('[data-village-reply]', element => element.textContent)).length > 30);
    await page.screenshot({ path: resolve(output, `${state}-320.png`), fullPage: true });
    results.push({ scenario: state, correctContext: true, layout });
  }
  await page.setViewport({ width: 1440, height: 900 }); await load('mastered'); const masteredLayout = await compactVillage(); await noOverflow('mastered desktop');
  await page.screenshot({ path: resolve(output, 'mastered-1440.png'), fullPage: true });
  results.push({ scenario: '31 ice-water-hash sales', width: 1440, layout: masteredLayout });
  await load('starter'); await compactVillage();
  await page.waitForSelector('[data-map-building="warehouse"][data-map-state="idle"]');
  scenario = 'active';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForSelector('[data-map-building="warehouse"][data-map-state="active"]');
  assert(await page.$('[data-map-activity="culture"]'), 'Returning to the tab refreshes the warehouse activity');
  results.push({ scenario: 'focus refreshes actual building state without navigation', activeCulture: true });
  scenario = 'lots';
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('kq:storage-updated')));
  await page.waitForSelector('[data-map-building="market"][data-map-state="active"]');
  await page.waitForSelector('[data-map-building="warehouse"][data-map-state="idle"]');
  assert((await page.$eval('[data-map-status="market"]', element => element.textContent)).includes('2 lots'));
  assert.equal(await page.$('[data-map-activity="culture"]'), null);
  results.push({ scenario: 'storage notification refreshes ready lots and clears finished culture', readyLots: 2 });
  await load('starter', '?isolated=1'); await noOverflow('isolated map');
  assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 0);
  await page.focus('[data-map-building="warehouse"]'); await page.keyboard.press('Enter');
  await page.waitForSelector('[id^="placard-building-details-"]');
  await page.waitForFunction(() => document.activeElement?.id.startsWith('placard-building-details-'));
  await page.keyboard.press('Escape');
  assert.equal(await page.$('[id^="placard-building-details-"]'), null);
  results.push({ scenario: 'isolated tutorial map', keyboard: true, silent: true });
  await load('starter', '?isolated=1');
  await page.evaluate(() => { window.AudioContext = undefined; });
  await page.click('[data-map-sound]');
  assert.equal(await page.$eval('[data-map-sound]', element => element.getAttribute('aria-pressed')), 'false');
  await page.focus('[data-map-building="warehouse"]'); await page.keyboard.press('Enter');
  await page.waitForSelector('[id^="placard-building-details-"]');
  results.push({ scenario: 'audio unavailable', navigation: true, silent: true });
  assert.deepEqual(errors, []); assert(requests.every(request => request.method === 'GET'));
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: true, results, errors, requests }, null, 2));
  console.log(JSON.stringify({ success: true, output, checks: results.length, errors: errors.length }));
} catch (error) {
  if (browser) { const pages = await browser.pages(); await pages.at(-1)?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: false, results, errors, requests, failure: error.stack }, null, 2)); throw error;
} finally { await browser?.close(); await server.close(); }
