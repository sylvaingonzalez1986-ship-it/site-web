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

let browser, scenario = 'starter', feedbackMode = 'normal', feedbackHistoryFails = false;
const results = [], errors = [], requests = [], externalRequests = [];
let feedbackItems = [], feedbackByRequest = new Map(), feedbackPosts = [];
function resetFeedback() {
  feedbackMode = 'normal'; feedbackHistoryFails = false; feedbackByRequest = new Map(); feedbackPosts = [];
  feedbackItems = [
    { id: '00000000-0000-4000-8000-000000000001', kind: 'idea', subject: 'Retrouver mes cartes favorites', message: 'Un filtre de cartes favorites rendrait ma collection plus facile à consulter.', status: 'planned', reply: 'Merci ! Le filtre est prévu pour la collection.', rewardPacks: 2, rewardGrantedAt: '2026-11-08T10:00:00.000Z' },
    { id: '00000000-0000-4000-8000-000000000002', kind: 'bug', subject: 'Mon panneau de récolte disparaît', message: 'Après un retour au quartier, le panneau de récolte ferme sa dernière sélection.', status: 'reviewing', reply: null, rewardPacks: 0, rewardGrantedAt: null },
    { id: '00000000-0000-4000-8000-000000000003', kind: 'idea', subject: 'Ancien courrier de pagination', message: 'Afficher une aide pour trouver les horaires du personnel sur la carte.', status: 'resolved', reply: 'Cette aide est maintenant disponible.', rewardPacks: 0, rewardGrantedAt: null },
  ].map(item => ({ pagePath: '/arene/placard', createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-08T10:00:00.000Z', ...item }));
}
function payload(path) {
  if (path === '/api/arena/placard/equipment') return { activeRun: scenario === 'active', readyLotCount: scenario === 'lots' ? 2 : 0, availableFlowerCount: scenario === 'jury' ? 1 : 0, ownedCodes: [], cashCents: 100000, productionUnits: 1,
    routeMasteries: scenario === 'first-sale' ? [{ route: 'dry-sift', saleCount: 1, bestJuryScore: 7 }] : scenario === 'mastered' ? [{ route: 'ice-water-hash', saleCount: 31, bestJuryScore: 8 }] : ['craft', 'overflow'].includes(scenario) ? [{ route: 'raw', saleCount: 2, bestJuryScore: 7 }, { route: 'dry-sift', saleCount: 6, bestJuryScore: 8 }] : [] };
  if (path === '/api/arena/placard/storage') return { serverNow: '2026-10-19T12:00:00.000Z', lots: scenario === 'overflow' ? [{ flowerId: 'local-fixture', flowerStatus: 'available', projection: { stage: 'curing', readyAt: '2026-10-19T18:00:00.000Z', nextChangeAt: '2026-10-19T13:00:00.000Z', capacity: { overflowUnits: 1250, overflowDeadlineAt: '2026-10-19T13:00:00.000Z' } } }] : [] };
  return null;
}
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => {
    window.__audioAudit = { contexts: 0 };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__audioAudit.contexts++; }
    };
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url()); if (url.protocol === 'data:') return void request.continue();
    if (url.origin !== origin) { externalRequests.push(url.origin + url.pathname); return void request.abort(); }
    if (!url.pathname.startsWith('/api/')) return void request.continue();
    requests.push({ path: url.pathname, search: url.search, method: request.method() });
    if (url.pathname === '/api/arena/feedback') {
      if (request.method() === 'GET') {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return void request.respond({ status: feedbackHistoryFails ? 503 : 200, contentType: 'application/json', body: JSON.stringify(feedbackHistoryFails ? { error: 'Historique temporairement indisponible.' } : { items: feedbackItems.slice(offset, offset + 2), total: feedbackItems.length, hasMore: offset + 2 < feedbackItems.length }) });
      }
      assert.equal(request.method(), 'POST', 'Only feedback submission may mutate the local fixture');
      const body = JSON.parse(request.postData()); feedbackPosts.push({ body, raw: request.postData() });
      if (feedbackMode === 'reject') return void request.respond({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Limite quotidienne atteinte. Réessaie demain.' }) });
      let item = feedbackByRequest.get(body.requestId);
      if (!item) {
        item = { ...body, id: body.requestId, status: 'new', reply: null, rewardPacks: 0, rewardGrantedAt: null, createdAt: '2026-11-08T12:00:00.000Z', updatedAt: '2026-11-08T12:00:00.000Z' };
        feedbackByRequest.set(body.requestId, item); feedbackItems.unshift(item);
      }
      if (feedbackMode === 'lost') { feedbackMode = 'normal'; return void request.abort('failed'); }
      return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ item }) });
    }
    const body = payload(url.pathname), failed = scenario === 'error' && url.pathname.endsWith('/equipment');
    void request.respond({ status: failed ? 503 : body ? 200 : 404, contentType: 'application/json', body: JSON.stringify(failed ? { error: 'Recette locale' } : body ?? {}) });
  });
  async function load(state, query = '') { scenario = state; await page.goto(`${origin}/arene/placard${query}`, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready); }
  async function noOverflow(label) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': no horizontal overflow'); }
  async function quiet() {
    assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 0, 'The village creates no audio context');
    assert.equal(await page.$('[data-map-sound], [data-game-sound], button[aria-label^="Son"]'), null, 'The village offers no sound control');
  }
  async function compactVillage(hasAction = true) {
    await page.waitForSelector('[data-placard-lobby] [data-placard-map]');
    await page.waitForSelector('[data-placard-lobby] [data-placard-next-action]');
    if (!hasAction) await page.waitForFunction(() => document.querySelector('[data-placard-lobby]')?.textContent.includes('Ton résumé est indisponible'));
    const layout = await page.$eval('[data-placard-lobby]', element => {
      const actions = element.querySelectorAll('[data-placard-next-action]');
      const map = element.querySelector('[data-placard-map]');
      return {
        actionBanners: actions.length,
        actionIsFirstInBrief: actions[0]?.parentElement.firstElementChild === actions[0],
        briefImmediatelyAfterMap: map?.nextElementSibling === actions[0]?.parentElement,
        mapIsFirst: element.firstElementChild?.firstElementChild === map,
        achievementPresent: Boolean(element.querySelector('[data-village-achievement], [data-sylvain-advice]')),
      };
    });
    assert.equal(layout.achievementPresent, false, 'No extra accomplishment card, regardless of sales history');
    assert.equal(layout.actionBanners, 1, 'One next-action summary or recovery banner remains');
    assert(layout.mapIsFirst && layout.briefImmediatelyAfterMap && layout.actionIsFirstInBrief, 'The village remains directly accessible beside its summary');
    return layout;
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
    await load('craft'); const layout = await compactVillage();
    assert.equal(await page.$eval('[data-placard-view]', element => element.dataset.placardView), 'hub', 'Real shell entry');
    await noOverflow(width + 'px');
    await page.screenshot({ path: resolve(output, `quartier-${width}.png`), fullPage: true });
    await page.focus('summary[aria-label="Aide du quartier"]'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-placard-map] details[open] [data-help-facts]');
    await noOverflow('Aide du quartier ' + width + 'px');
    await page.screenshot({ path: resolve(output, `quartier-help-${width}.png`) });
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('summary[aria-label="Aide du quartier"]', node => node.parentElement.open), false);
    assert.equal(await page.$eval('summary[aria-label="Aide du quartier"]', node => node === document.activeElement), true);
    await page.focus('[data-placard-next-action] > button'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-audit-destination]');
    assert(['game', 'workshop'].includes(await page.$eval('[data-placard-view]', element => element.dataset.placardView)), 'Next-action keyboard navigation reaches culture or equipment');
    await page.goBack(); await compactVillage();
    await quiet();
    await page.focus('[data-map-building="warehouse"]'); await page.keyboard.press('Enter');
    await page.waitForSelector('#placard-building-details');
    await page.waitForFunction(() => document.activeElement?.id === 'placard-building-details');
    await quiet();
    await page.keyboard.press('Escape'); assert.equal(await page.$eval('[data-map-building="warehouse"]', element => element === document.activeElement), true);
    await page.focus('[data-map-building="market"]'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'placard-building-details');
    await quiet();
    await page.focus('[data-placard-activity="market"]'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-placard-view="market"]'); await page.waitForSelector('[data-audit-destination]');
    await page.goBack(); await page.waitForSelector('[data-placard-lobby]');
    await quiet();
    results.push({ width, entry: 'PlacardPlayerShell → KqPlacardLobby → KqPlacardMap', keyboard: true, overflow: false, silent: true, noSoundControls: true, layout, nextActionNavigation: true });
  }
  await page.setViewport({ width: 320, height: 900 });
  for (const state of ['starter', 'active', 'lots', 'jury', 'first-sale', 'mastered', 'overflow', 'error']) {
    await load(state); const layout = await compactVillage(state !== 'error'); await noOverflow(state);
    if (state === 'overflow') assert((await page.$eval('[data-priority="storage"]', element => element.textContent)).includes('125 g sans contenant'));
    if (state === 'error') { assert((await page.$eval('[data-village-reply]', element => element.textContent)).includes('Les activités restent accessibles')); assert((await page.$eval('body', element => element.textContent)).includes('Ton résumé est indisponible')); }
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
  async function mailboxButton(text) {
    const buttons = await page.$$('[data-mailbox-dialog] button');
    for (const button of buttons) if ((await button.evaluate(node => node.textContent)).trim() === text) return button;
    throw new Error(`Mailbox button missing: ${text}`);
  }
  async function clickMailboxButton(text) { const button = await mailboxButton(text); await button.click(); }
  async function openMailbox(keyboard = false) {
    await page.focus('[data-map-mailbox]');
    if (keyboard) await page.keyboard.press('Enter'); else await page.click('[data-map-mailbox]');
    await page.waitForSelector('[data-mailbox-dialog][open]');
    await page.waitForFunction(() => !document.querySelector('[data-mailbox-dialog]')?.textContent.includes('Chargement des courriers'));
  }
  async function mailboxFits(width) {
    const layout = await page.$eval('[data-mailbox-dialog]', dialog => {
      const body = dialog.querySelector('[data-app-dialog-body]'), rect = dialog.getBoundingClientRect();
      const controls = [...dialog.querySelectorAll('input, textarea, button')];
      return { width: rect.width, left: rect.left, right: rect.right, height: rect.height, horizontalOverflow: body.scrollWidth > body.clientWidth + 1, controlsInWidth: controls.every(control => { const box = control.getBoundingClientRect(); return box.left >= rect.left && box.right <= rect.right; }), artLoaded: [...dialog.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0) };
    });
    assert(layout.left >= 0 && layout.right <= width && layout.height <= 900, `${width}px: dialog fits viewport`);
    assert(!layout.horizontalOverflow && layout.controlsInWidth && layout.artLoaded, `${width}px: readable controls and loaded artwork`);
    await noOverflow(`Mailbox ${width}px`); return layout;
  }
  async function fillMailbox(kind, subject, message) {
    await page.click(`[data-mailbox-form] input[value="${kind}"]`);
    for (const [name, value] of [['subject', subject], ['message', message]]) {
      const input = await page.$(`[data-mailbox-form] [name="${name}"]`);
      await input.click({ clickCount: 3 }); await input.press('Backspace'); await input.type(value);
    }
  }
  async function closeMailbox(method) {
    if (method === 'Escape') await page.keyboard.press('Escape');
    else if (method === 'Back') await page.evaluate(() => history.back());
    else await page.click('[data-mailbox-dialog] button[aria-label="Fermer la boîte aux lettres"]');
    await page.waitForSelector('[data-mailbox-dialog]', { hidden: true });
    assert(await page.$eval('[data-map-mailbox]', node => node === document.activeElement), `${method}: focus returns to map mailbox`);
  }
  for (const width of [320, 390, 1440]) {
    resetFeedback(); await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
    const previousFeedbackCalls = requests.filter(request => request.path === '/api/arena/feedback').length;
    await load('craft'); await compactVillage();
    assert.equal(requests.filter(request => request.path === '/api/arena/feedback').length, previousFeedbackCalls, 'Mailbox history loads on opening');
    if (await page.$('[data-placard-map][data-map-zoomed]')) await page.click('[data-map-zoom-toggle]');
    await page.$eval('[data-placard-map]', node => node.scrollIntoView({ block: 'start' }));
    await page.waitForFunction(() => [...document.querySelectorAll('[data-map-mailbox] img')].every(img => img.complete && img.naturalWidth > 0));
    const mapLayout = await page.$eval('[data-map-mailbox]', button => {
      const sign = button.querySelector('[data-map-label]'), box = sign.getBoundingClientRect();
      const overlappingLabels = [...document.querySelectorAll('[data-map-label]:not([data-map-label="mailbox"])')].filter(label => { const other = label.getBoundingClientRect(); return Math.min(box.right, other.right) > Math.max(box.left, other.left) && Math.min(box.bottom, other.bottom) > Math.max(box.top, other.top); }).map(label => label.dataset.mapLabel);
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { overlappingLabels, labelReachable: button.contains(hit), labelInViewport: box.left >= 0 && box.right <= innerWidth, labelWidth: box.width, labelHeight: box.height, accessibleName: button.getAttribute('aria-label') };
    });
    await page.screenshot({ path: resolve(output, `mailbox-map-${width}.png`), fullPage: true });
    assert.deepEqual(mapLayout.overlappingLabels, [], `${width}px: mailbox sign does not overlap other destination labels`);
    assert(mapLayout.labelReachable && mapLayout.labelInViewport && mapLayout.labelHeight >= 44 && mapLayout.accessibleName.includes('Boîte aux lettres'), `${width}px: mailbox sign is visible, reachable and named`);
    await page.focus('[data-map-mailbox]'); await page.keyboard.press('Tab');
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    const focusedLabel = await page.$eval('[data-map-label="mailbox"]', sign => {
      const box = sign.getBoundingClientRect(), viewport = document.querySelector('#placard-map-viewport').getBoundingClientRect(), button = sign.closest('button');
      const overlaps = [...document.querySelectorAll('[data-map-label]:not([data-map-label="mailbox"])')].filter(label => { const other = label.getBoundingClientRect(); return Math.min(box.right, other.right) > Math.max(box.left, other.left) && Math.min(box.bottom, other.bottom) > Math.max(box.top, other.top); }).map(label => label.dataset.mapLabel);
      return { overlaps, reachable: [.1, .5, .9].every(fraction => button.contains(document.elementFromPoint(box.left + box.width * fraction, box.top + box.height / 2))), focusRingInMap: box.left - 6 >= viewport.left && box.right + 6 <= viewport.right && box.top - 6 >= viewport.top && box.bottom + 6 <= viewport.bottom };
    });
    await page.screenshot({ path: resolve(output, `mailbox-map-focused-${width}.png`) });
    assert(focusedLabel.reachable && focusedLabel.focusRingInMap, `${width}px: keyboard-focused mailbox sign and full focus ring remain visible and reachable`);
    await openMailbox(width !== 320); const dialogLayout = await mailboxFits(width);
    await page.screenshot({ path: resolve(output, `mailbox-dialog-${width}.png`) });
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    assert(await page.$eval('[data-mailbox-dialog]', dialog => dialog.contains(document.activeElement)), 'Backward tab stays inside the modal');
    await page.keyboard.press('Tab');
    assert(await page.$eval('[data-mailbox-dialog] button[aria-label="Fermer la boîte aux lettres"]', node => node === document.activeElement), 'Tab wraps back to persistent close control');
    assert((await page.$eval('[data-mailbox-dialog]', node => node.textContent)).includes('2 packs Botte du Chanvrier offerts'));
    assert((await page.$eval('[data-mailbox-dialog]', node => node.textContent)).includes('Merci ! Le filtre est prévu'));
    assert.equal(await page.$$eval('[data-mailbox-dialog] article', nodes => nodes.length), 2);
    await clickMailboxButton('Voir les courriers précédents');
    await page.waitForFunction(() => document.querySelector('[data-mailbox-dialog]')?.textContent.includes('Ancien courrier de pagination'));
    assert.equal(await page.$$eval('[data-mailbox-dialog] article', nodes => nodes.length), 3);
    await page.screenshot({ path: resolve(output, `mailbox-history-${width}.png`) });
    results.push({ scenario: 'mailbox map and private history', width, mapLayout, focusedLabel, dialogLayout, reply: true, reward: 2, pagination: true });
    const bugSubject = `Récolte invisible ${width}`, bugMessage = 'Après la récolte, le dernier lot ne se voit plus dans mon entrepôt.';
    await fillMailbox('bug', bugSubject, bugMessage);
    feedbackMode = 'reject'; await clickMailboxButton('Envoyer mon courrier');
    await page.waitForFunction(() => document.querySelector('[data-mailbox-form] [role="alert"]')?.textContent.includes('Limite quotidienne'));
    assert.equal(await page.$eval('[data-mailbox-form] [name="subject"]', node => node.value), bugSubject);
    assert.equal(await page.$eval('[data-mailbox-form] [name="message"]', node => node.value), bugMessage);
    assert.equal(await page.$eval('[data-mailbox-form] fieldset', node => node.disabled), false);
    const rejectedId = feedbackPosts.at(-1).body.requestId;
    feedbackMode = 'normal'; await clickMailboxButton('Envoyer mon courrier');
    await page.waitForFunction(subject => [...document.querySelectorAll('[data-mailbox-dialog] article h3')].some(node => node.textContent === subject), {}, bugSubject);
    assert.notEqual(feedbackPosts.at(-1).body.requestId, rejectedId, 'Definitive rejection permits a fresh request');
    assert.equal(feedbackPosts.at(-1).body.kind, 'bug');
    assert.equal(await page.$eval('[data-mailbox-form] [name="subject"]', node => node.value), '');
    const ideaSubject = `Idée après réponse perdue ${width}`, ideaMessage = 'Je voudrais retrouver mes plantes favorites directement depuis le quartier.';
    await fillMailbox('idea', ideaSubject, ideaMessage);
    feedbackMode = 'lost'; await clickMailboxButton('Envoyer mon courrier');
    await page.waitForFunction(() => document.querySelector('[data-mailbox-form] [role="alert"]')?.textContent.includes('Ton courrier est conservé'));
    assert.equal(await page.$eval('[data-mailbox-form] [name="message"]', node => node.value), ideaMessage);
    assert.equal(await page.$eval('[data-mailbox-form] fieldset', node => node.disabled), true);
    await closeMailbox('Close'); await openMailbox(true);
    assert.equal(await page.$eval('[data-mailbox-form] [name="subject"]', node => node.value), ideaSubject, 'Unconfirmed draft survives modal close');
    feedbackMode = 'reject'; await clickMailboxButton('Vérifier l’envoi');
    await page.waitForFunction(() => document.querySelector('[data-mailbox-form] [role="alert"]')?.textContent.includes('Limite quotidienne'));
    assert.equal(await page.$eval('[data-mailbox-form] fieldset', node => node.disabled), true, 'A transient rejection after a lost response keeps the original unconfirmed request locked');
    assert.equal(feedbackPosts.at(-1).raw, feedbackPosts.at(-2).raw, 'Transient rejection uses the original body');
    feedbackMode = 'normal';
    await clickMailboxButton('Vérifier l’envoi');
    await page.waitForFunction(() => document.querySelector('[data-mailbox-form] [role="status"]')?.textContent.includes('Courrier reçu'));
    assert.equal(feedbackPosts.at(-1).raw, feedbackPosts.at(-2).raw, 'Lost POST response retry sends exactly the original body and request id');
    assert.equal(feedbackPosts.at(-1).body.kind, 'idea');
    await page.waitForFunction(subject => [...document.querySelectorAll('[data-mailbox-dialog] article h3')].filter(node => node.textContent === subject).length === 1, {}, ideaSubject);
    assert.equal(feedbackItems.filter(item => item.subject === ideaSubject).length, 1, 'One persisted fixture contribution');
    await mailboxFits(width);
    results.push({ scenario: 'mailbox bug, idea, rejection and lost response', width, textPreserved: true, immutableRetry: true, transientRejectionAfterLoss: true, singleContribution: true, reopenDraft: true });
    feedbackHistoryFails = true; await clickMailboxButton('Actualiser');
    await page.waitForFunction(() => document.querySelector('[data-mailbox-dialog]')?.textContent.includes('Historique temporairement indisponible'));
    assert((await page.$eval('[data-mailbox-dialog]', node => node.textContent)).includes(ideaSubject), 'Previously read history remains during history errors');
    feedbackHistoryFails = false; await clickMailboxButton('Actualiser');
    await page.waitForFunction(() => !document.querySelector('[data-mailbox-dialog]')?.textContent.includes('Historique temporairement indisponible'));
    await closeMailbox('Escape'); await openMailbox(); await closeMailbox('Back');
    if (width < 700) {
      await page.click('[data-map-zoom-toggle]'); await page.focus('[data-map-building="warehouse"]');
      await page.focus('[data-map-mailbox]');
      await page.waitForFunction(() => { const sign = document.querySelector('[data-map-label="mailbox"]').getBoundingClientRect(); const view = document.querySelector('#placard-map-viewport').getBoundingClientRect(); return sign.left >= view.left && sign.right <= view.right; });
      await page.screenshot({ path: resolve(output, `mailbox-map-zoom-${width}.png`) });
      await page.keyboard.press('Enter'); await page.waitForSelector('[data-mailbox-dialog][open]'); await closeMailbox('Escape');
    }
    results.push({ scenario: 'mailbox recovery, focus and browser back', width, historyRecovery: true, closeFocus: true, escapeFocus: true, backFocus: true, zoomKeyboard: width < 700 });
    if (width === 1440) {
      await openMailbox(); await clickMailboxButton('Voir les courriers précédents');
      await page.waitForFunction(() => document.querySelector('[data-mailbox-dialog]')?.textContent.includes('Voir mes packs'));
      await clickMailboxButton('Voir mes packs');
      await page.waitForSelector('[data-placard-view="shop"] [data-audit-destination]');
      assert.equal(await page.$('[data-mailbox-dialog]'), null, 'Reward navigation closes its modal');
      await page.goBack(); await compactVillage();
      assert.equal(await page.$('[data-mailbox-dialog]'), null, 'Back from packs returns to map without reopening the retired modal');
      results.push({ scenario: 'mailbox reward opens actual pack destination', modalRetired: true, backToVillage: true });
    }
  }
  const feedbackCallsBeforeTutorial = requests.filter(request => request.path === '/api/arena/feedback').length;
  await load('starter', '?isolated=1'); await noOverflow('isolated map');
  assert.equal(await page.$('[data-map-mailbox]'), null, 'No mailbox in isolated tutorial map');
  await quiet();
  await page.focus('[data-map-building="warehouse"]'); await page.keyboard.press('Enter');
  await page.waitForSelector('[id^="placard-building-details-"]');
  await page.waitForFunction(() => document.activeElement?.id.startsWith('placard-building-details-'));
  await page.keyboard.press('Escape');
  assert.equal(await page.$('[id^="placard-building-details-"]'), null);
  results.push({ scenario: 'isolated tutorial map', keyboard: true, silent: true });
  await load('starter', '?isolated=1');
  await page.evaluate(() => { window.AudioContext = undefined; });
  await quiet();
  await page.focus('[data-map-building="warehouse"]'); await page.keyboard.press('Enter');
  await page.waitForSelector('[id^="placard-building-details-"]');
  results.push({ scenario: 'audio unavailable', navigation: true, silent: true });
  assert.equal(requests.filter(request => request.path === '/api/arena/feedback').length, feedbackCallsBeforeTutorial, 'Tutorial makes no feedback requests');
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  assert(requests.every(request => request.method === 'GET' || request.path === '/api/arena/feedback' && request.method === 'POST'));
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: true, results, errors, requests, externalRequests }, null, 2));
  console.log(JSON.stringify({ success: true, output, checks: results.length, errors: errors.length }));
} catch (error) {
  if (browser) { const pages = await browser.pages(); await pages.at(-1)?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: false, results, errors, requests, failure: error.stack }, null, 2)); throw error;
} finally { await browser?.close(); await server.close(); }
