/** Real ranking UI, local fixtures only. No environment files, credentials or remote API access. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/arena-village');
const port = Number(process.argv.find(argument => argument.startsWith('--port='))?.slice(7) ?? 3236);
const titleOnly = process.argv.includes('--targeted-title');
const origin = `http://127.0.0.1:${port}`;
const viewerPseudo = 'Camille57';
const board = '[data-arena-ranking-board]';
const rows = `${board} li[value]`;
const profile = { gender: 'female', clothing: 'teal', skin: 'honey', appearance: { hair: 'braids', hairColor: 'chestnut', accessory: 'none' } };
const general = Array.from({ length: 100 }, (_, index) => ({
  rank: index + 1,
  pseudo: index === 56 ? viewerPseudo : index === 1 ? 'UnPseudoTresLongDe24Chars' : `Chanvrier${String(index + 1).padStart(3, '0')}`,
  avatar: index === 0 ? profile : null,
  score: 1000 - index * 5,
  notebookScore: 300 - index,
  placardScore: 500 - index * 3,
  businessScore: 200 - index,
  rating: 1300 - index * 4,
  approvedReviewCount: 100 - index,
  wins: 150 - index,
  losses: 3,
}));
const placard = general.map((entry, index) => ({
  ...entry, seasonPoints: 200 - index, reputation: 1000 - index, streak: 2,
  placardScore: entry.rating + Math.min(150, Math.round((200 - index) / 4)) + Math.min(100, Math.round(4 * Math.sqrt(1000 - index))) + entry.businessScore,
}));
const tasting = general.map(entry => ({ ...entry, totalPoints: entry.notebookScore, level: { label: 'Connaisseur' } }));
const viewerProgress = { pseudo: viewerPseudo, totalPoints: 244, seasonRank: 57, globalRank: 57, approvedReviewCount: 44, progressPercent: 55, pointsToNextLevel: 56, currentLevel: { label: 'Connaisseur' }, nextLevel: { label: 'Expert' } };
const rewardPool = {
  viewer: { rank: 57, battles: 97, estimatedGrams: null, grant: null },
  seasonCode: 'KQ-2026-S1', status: 'active', contributionRateBps: 1000,
  poolGrams: 100, wholePoolGrams: 100, carriedGrams: 0, currentWeekGrams: 20,
  weeklyDice: { startsOn: '2026-10-12', endsOn: '2026-10-19', rollCount: 20, average: 5, rateBps: 1000, eligibleFlowerGrams: 200, contributionGrams: 20 },
  startsAt: '2026-01-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z', updatedAt: '2026-10-14T12:00:00Z',
  minimumHumanBattles: 3, eligiblePlayers: 100, milestone: { previousGrams: 50, nextGrams: 250, progressPercent: 25 },
  topRewards: general.slice(0, 10).map((entry, index) => ({ leaderboardRank: entry.rank, rewardRank: entry.rank, pseudo: entry.pseudo, shareBps: [2700, 1800, 1350, 675, 675, 360, 360, 360, 360, 360][index], estimatedGrams: [27, 18, 14, 7, 7, 4, 4, 4, 3, 2][index] })),
  surpriseReward: { shareBps: 1000, estimatedGrams: 10, eligiblePlayers: 90, oneChancePerCustomer: true },
};
const modules = {
  'arena-village-fixture': `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {ContestHubClient} from '/src/components/contest/ContestHubClient';
    const props=${JSON.stringify({ seasons: [], selectedSeasonCode: 'CONTEST-2026', selectedTrack: 'regular', activeCategory: 'outdoor', categoryCounts: { outdoor: 0, greenhouse: 0, indoor: 0 }, entries: [], rankings: [], feed: [], notebookUnlocks: [], draftOwnerId: 'local-arena-audit', viewerProfile: { pseudo: viewerPseudo }, viewerBadges: [], viewerProgress, testerSeasonRankings: [], testerGlobalRankings: [], isAuthenticated: true, isAdminAuthorized: false, isPlacardPlayerEnabled: true, initialView: 'classement', surface: 'arena' })};
    createRoot(document.getElementById('root')).render(React.createElement(ContestHubClient,props));
  `,
  'preview-cart': `import {buildEmptyLoyaltySummary} from '/src/lib/loyalty'; export const useCart=()=>({user:{id:'local-arena-audit'},isAuthenticated:true,authLoading:false,sessionLoading:false,loyalty:buildEmptyLoyaltySummary(),totalItems:0,addToCart:()=>{}});`,
  'preview-lottery': `import {buildEmptyLoyaltySummary} from '/src/lib/loyalty'; export const useLotteryExperience=()=>({tickets:[],inventory:null,config:null,bonuses:[],loyalty:buildEmptyLoyaltySummary(),album:null,loading:false,error:null,acting:false,refreshAll:async()=>{}});`,
  'preview-navigation': `export const NavigationPending=()=>null;export const useRouter=()=>({push:href=>location.assign(href),replace:href=>location.replace(href),refresh:()=>{}});`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props));}`,
  'next/navigation': `export const usePathname=()=>'/arene';export const useSearchParams=()=>new URLSearchParams('vue=classement');export const useRouter=()=>({push:href=>location.assign(href),replace:href=>location.replace(href),refresh:()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}`;
const server = await createServer({
  configFile: false, envDir: false, root, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  define: { 'process.env.NEXT_PUBLIC_CONTEST_BETA_ACCESS_ENABLED': '"false"' },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  esbuild: { jsx: 'automatic' }, resolve: { dedupe: ['react', 'react-dom'], alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'arena-village-audit', enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('/context/CartContext')) return '\0preview-cart';
      if (id.endsWith('/hooks/useLotteryExperience')) return '\0preview-lottery';
      if (id.endsWith('/navigation/NavigationFeedback') || id === './NavigationFeedback') return '\0preview-navigation';
      if (id in modules) return '\0' + id;
    },
    load(id) { if (id.startsWith('\0')) return modules[id.slice(1)]; },
    configureServer(vite) { vite.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/') return next();
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Classement du village · audit local</title><link rel="icon" href="data:,"><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__arena-village-fixture"></script></html>`);
    }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: { ignored: ['**/output/**', '**/.next/**'] } },
});

let browser, page;
let fixture = { state: 'ready', fail: null, hold: null };
const held = [], errors = [], requests = [], blockedRemote = [], unexpectedApi = [], results = [];
const payloadFor = pathname => {
  const data = fixture.state === 'empty' ? [] : fixture.state === 'outside' ? general.filter(entry => entry.pseudo !== viewerPseudo) : general;
  if (pathname === '/api/arena/rankings') return { formulaVersion: 'arena-v2-development', seasonCode: 'KQ-2026-S1', generatedAt: '2026-10-14T12:00:00Z', entries: data };
  if (pathname === '/api/arena/placard/rankings') return { seasonCode: 'KQ-2026-S1', generatedAt: '2026-10-14T12:00:00Z', entries: fixture.state === 'empty' ? [] : placard };
  if (pathname === '/api/contest/testers/rankings') return { items: fixture.state === 'empty' ? [] : tasting };
  if (pathname === '/api/arena/placard/me') return { progress: { ...placard[56], rank: 57, burnedFlowers: 35 } };
  if (pathname === '/api/arena/placard/boosters') return { availableEntitlements: [] };
  if (pathname === '/api/arena/rewards') return rewardPool;
  if (pathname === '/api/arena/rewards/dice') return { eligible: true, viewerRoll: 5 };
  return null;
};

try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:') return void request.continue();
    if (url.origin !== origin) { blockedRemote.push(url.origin + url.pathname); return void request.abort(); }
    if (fixture.state === 'portrait-error' && url.pathname.startsWith('/contest/avatars/')) return void request.abort();
    if (!url.pathname.startsWith('/api/')) return void request.continue();
    requests.push({ state: fixture.state, path: url.pathname, query: url.search, method: request.method() });
    if (request.method() !== 'GET') { unexpectedApi.push({ path: url.pathname, method: request.method() }); return void request.respond({ status: 405, body: '{}' }); }
    const payload = payloadFor(url.pathname);
    if (payload === null) { unexpectedApi.push(url.pathname); return void request.respond({ status: 404, body: '{}' }); }
    const respond = () => request.respond({ status: fixture.fail === url.pathname || fixture.state === 'profile-error' && ['/api/arena/rankings', '/api/arena/placard/me'].includes(url.pathname) ? 503 : 200, contentType: 'application/json', body: JSON.stringify(payload) }).catch(() => {});
    if (fixture.hold === url.pathname) held.push({ respond, path: url.pathname }); else void respond();
  });
  const click = async (text, selector = 'button') => {
    const handle = await page.waitForFunction((text, selector) => [...document.querySelectorAll(selector)].find(element => element.textContent.trim().startsWith(text) && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })), {}, text, selector);
    await handle.asElement().click(); await handle.dispose();
  };
  const waitRows = async (count = 100) => page.waitForFunction((selector, count) => document.querySelectorAll(selector).length === count, {}, rows, count);
  const screenshot = async name => page.screenshot({ path: resolve(output, name + '.png'), fullPage: true });
  const load = async (state = 'ready', options = {}) => {
    fixture = { state, fail: null, hold: null, ...options };
    while (held.length) await held.shift().respond();
    await page.goto(`${origin}/?state=${state}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(board, { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
  };
  const layout = async () => page.evaluate(selector => {
    const container = document.querySelector(selector);
    const region = container.querySelector('[role="region"]');
    const rowInfo = [...container.querySelectorAll('li[value] > *')].map(row => {
      const boxes = [...row.children].map(child => child.getBoundingClientRect());
      return { fits: row.scrollWidth <= row.clientWidth + 1, columns: boxes.length, ordered: boxes.every((box, index) => index === 0 || box.left >= boxes[index - 1].right - 1) };
    });
    const controls = [...container.querySelectorAll('button,summary')].filter(element => element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
    const outside = controls.filter(element => { const rect = element.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; }).map(element => element.textContent.trim());
    return { width: innerWidth, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1, outside, rowCount: rowInfo.length, rowsFit: rowInfo.every(row => row.fits && row.columns === 4 && row.ordered), scrollable: region.scrollHeight > region.clientHeight, hero: document.querySelector('[data-arena-scene="classement"] img')?.getAttribute('src') };
  }, board);
  const checkLayout = async label => {
    const measured = await layout(); results.push({ label, ...measured });
    assert.equal(measured.pageOverflow, false, `${label}: page overflow`);
    assert.deepEqual(measured.outside, [], `${label}: controls outside viewport`);
    assert.equal(measured.rowsFit, true, `${label}: rank/avatar/name/score columns`);
  };
  const findViewer = async () => {
    await click('Ma place', `${board} button`);
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-viewer') === 'true');
    const position = await page.$eval(`${board} [data-viewer="true"]`, element => {
      const row = element.getBoundingClientRect(), region = element.closest('[role="region"]').getBoundingClientRect();
      return { rank: element.closest('li').value, visible: row.top >= region.top - 1 && row.bottom <= region.bottom + 1 };
    });
    assert.deepEqual(position, { rank: 57, visible: true }, 'Own position scrolls and receives keyboard focus');
  };
  for (const width of titleOnly ? [320, 1440] : [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: width < 700 ? 900 : 1050, deviceScaleFactor: 1 });
    await load(); await waitRows();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-arena-scene="classement"] img')].every(image => image.complete && image.naturalWidth > 0));
    await page.waitForSelector(`${board} canvas[data-avatar-state="ready"]`);
    assert.equal(await page.$$eval(`${rows} [aria-label^="Avatar de"]`, avatars => avatars.filter(avatar => !avatar.querySelector('canvas')).length), 99, 'Missing portraits keep the fallback');
    await checkLayout(`general-${width}`); await screenshot(`general-${width}`);
    if (titleOnly) {
      const title = await page.$eval('[data-arena-scene="classement"] h1', heading => {
        const node = heading.firstChild;
        const end = node.textContent.toLocaleLowerCase('fr-FR').lastIndexOf('classements') + 'classements'.length;
        const letter = offset => {
          const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + 1);
          const rect = range.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
        };
        const previous = letter(end - 2), last = letter(end - 1);
        return { text: heading.textContent, previous, last, sameBaseline: Math.abs(previous.bottom - last.bottom) < 1, fontSize: getComputedStyle(heading).fontSize };
      });
      results.push({ label: `title-unbroken-${width}`, ...title });
      assert.equal(title.sameBaseline, true, `CLASSEMENTS final S stays on the same line at ${width}px`);
      continue;
    }
    assert.deepEqual(await page.$$eval(`${board} [data-criterion] b`, elements => elements.map(element => element.firstChild.textContent)), ['300', '500', '200']);
    const first = await page.$eval(`${rows}:first-child`, row => row.textContent);
    assert.match(first, /Carnet\s*300/); assert.match(first, /Duels\s*500/); assert.match(first, /Entreprise\s*200/); assert.doesNotMatch(first, /Ar\?ne|r\?putation/);
    await findViewer(); await screenshot(`own-position-${width}`);
    await page.evaluate(() => { const heading = [...document.querySelectorAll('h2')].find(element => element.textContent.startsWith('Le Pot de la Canopée')); window.__auditPot = heading.closest('section'); window.__auditPot.setAttribute('data-audit-retained-pot', 'true'); });
    for (const [label, name] of [['Dégustation', 'tasting'], ['Kanab Quest', 'placard'], ['Général', 'general-return']]) {
      await click(label, `${board} [aria-label="Type de classement"] button`); await waitRows();
      assert.equal(await page.evaluate(() => window.__auditPot === document.querySelector('[data-audit-retained-pot]')), true, 'Reward pot stays mounted across tabs');
      await checkLayout(`${name}-${width}`); await screenshot(`${name}-${width}`); await findViewer();
      if (name === 'tasting') {
        assert.equal(await page.$$eval(`${rows} a[href^="/arene/profils/"]`, links => links.length), 100);
        await click('Global', `${board} button`); await waitRows(); await checkLayout(`tasting-global-${width}`);
      }
    }
  }

  if (!titleOnly) {
  await page.setViewport({ width: 390, height: 900 });
  await load('loading', { hold: '/api/arena/rankings' });
  await page.waitForSelector(`${board} [aria-busy="true"]`); await screenshot('loading-mobile');
  fixture.hold = null; while (held.length) await held.shift().respond(); await waitRows();
  results.push({ label: 'loading-recovers', passed: true });
  for (const [name, label, path] of [['general', 'Général', '/api/arena/rankings'], ['tasting', 'Dégustation', '/api/contest/testers/rankings'], ['placard', 'Kanab Quest', '/api/arena/placard/rankings']]) {
    await load('error-' + name, { fail: path });
    if (name !== 'general') { await waitRows(); await click(label, `${board} button`); }
    await page.waitForFunction(selector => document.querySelector(selector)?.textContent.includes('momentanément indisponible'), {}, board);
    await checkLayout(`error-${name}`); await screenshot(`error-${name}-mobile`);
    fixture.fail = null; await click('Réessayer', `${board} button`); await waitRows();
    results.push({ label: `retry-${name}`, passed: true });
  }
  await load('abort-tasting', { hold: '/api/contest/testers/rankings' }); await waitRows();
  await click('Dégustation', `${board} button`); await page.waitForSelector(`${board} [aria-busy="true"]`);
  await click('Kanab Quest', `${board} button`); await waitRows(); fixture.hold = null;
  while (held.length) await held.shift().respond();
  await click('Dégustation', `${board} button`); await waitRows(); results.push({ label: 'aborted-tasting-reopens', passed: true });
  await load('empty'); await page.waitForFunction(selector => document.querySelector(selector)?.textContent.includes('Une place à prendre'), {}, board);
  await screenshot('empty-mobile'); assert.equal(await page.$$eval(`${board} li[value]`, entries => entries.length), 0);
  await load('profile-error');
  await click('Mon profil et ma progression', 'summary');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-ranking="general"], [data-ranking="placard"]')].every(card => card.textContent.includes('Indisponible')));
  await screenshot('profile-unavailable-mobile'); results.push({ label: 'profile-error-distinct-from-unranked', passed: true });
  await load('outside'); await waitRows(99); await click('Mon profil et ma progression', 'summary');
  await page.waitForFunction(() => document.querySelector('[data-ranking="general"]')?.textContent.includes('Absent du tableau'));
  results.push({ label: 'outside-table-not-unranked', passed: true });
  await load('portrait-error'); await waitRows(); await page.waitForSelector(`${board} canvas[data-avatar-state="error"]`);
  assert.equal(await page.$eval(`${board} canvas[data-avatar-state="error"]`, element => getComputedStyle(element).opacity), '0');
  await screenshot('portrait-fallback-mobile'); results.push({ label: 'portrait-failure-retains-rows', passed: true });
  }
  assert(requests.filter(request => request.path === '/api/contest/testers/rankings').every(request => new URLSearchParams(request.query).get('limit') === '100'));
  assert.deepEqual(unexpectedApi, []); assert.deepEqual(blockedRemote, []); assert.deepEqual(errors, []);
  console.log(titleOnly ? `PASS: ${results.length} targeted title/layout checks at 320/1440px; final S shares its preceding letter's baseline and no overflow.` : `PASS: ${results.length} ranking checks; 320/390/768/1440px, 100 players, own position, tabs, loading, errors/retries, aborts, profile states and portrait fallback.`);
} catch (error) {
  results.push({ label: 'failure', error: String(error), stack: error.stack });
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); await writeFile(resolve(output, 'failure.html'), await page.content().catch(() => '')); }
  throw error;
} finally {
  await writeFile(resolve(output, titleOnly ? 'title-report.json' : 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), scope: titleOnly ? 'targeted-title-and-layout' : 'full-ranking-audit', localOnly: true, results, errors, requests, blockedRemote, unexpectedApi }, null, 2));
  await browser?.close(); await server.close();
}
