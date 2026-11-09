/** Flower register with isolated fixtures; no credentials, remote data or writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/ranking-flowers');
const port = Number(process.argv.find(argument => argument.startsWith('--port='))?.slice(7) ?? 3248);
const origin = `http://127.0.0.1:${port}`;
const path = '/arene/carnet/classement';
const board = '[data-flower-ranking-board]';
const season = { id: 'season', code: '2026', label: 'Saison 2026', isActive: true, isArchived: false, year: 2026 };
function flower(id, title, track, count, score, rank, category = 'indoor') {
  return {
    id, slug: id, title, productId: id, seasonId: season.id, season, category, track,
    story: '', technicalSheet: {}, imageUrl: '', galleryUrls: [], isPublished: true, position: 0,
    createdAt: '2026-11-01', updatedAt: '2026-11-01',
    stats: { entryId: id, seasonId: season.id, category, track, approvedReviewCount: count, averageScore: score, criterionAverages: {}, consumptionCounts: {} },
    ...(rank ? { ranking: { entryId: id, isRankEligible: true, seasonCategoryRank: rank } } : {}),
  };
}
const entries = [
  flower('black', 'Black Berserker', 'concours', 2, 82, 2),
  flower('lemon', 'Lemon Flambé', 'concours', 0, 0),
  flower('regular', 'Fleur Regular', 'regular', 1, 90, 1),
  ...Array.from({ length: 14 }, (_, index) => flower(`suite-${index}`, `Fleur ${index + 3}`, index % 2 ? 'concours' : 'regular', 1, 80 - index, index + 3)),
  flower('outdoor', 'Fleur Outdoor', 'regular', 1, 88, 1, 'outdoor'),
  flower('greenhouse', 'Fleur Greenhouse', 'concours', 0, 0, undefined, 'greenhouse'),
];
const modules = {
  'flower-ranking-fixture': `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {ContestHubClient} from '/src/components/contest/ContestHubClient';
    const all=${JSON.stringify(entries)};
    const query=new URLSearchParams(location.search);
    const track=['regular','concours'].includes(query.get('track'))?query.get('track'):undefined;
    const category=query.get('category')||'indoor';
    const scoped=all.filter(entry=>!track||entry.track===track);
    const props={seasons:[${JSON.stringify(season)}],selectedSeasonCode:'2026',selectedTrack:track||'regular',rankingTrack:track,
      activeCategory:category,categoryCounts:Object.fromEntries(['outdoor','greenhouse','indoor'].map(key=>[key,scoped.filter(entry=>entry.category===key).length])),
      entries:scoped.filter(entry=>entry.category===category),feed:[],notebookUnlocks:[],viewerProfile:null,viewerBadges:[],viewerProgress:null,
      testerSeasonRankings:[],testerGlobalRankings:[],isAuthenticated:false,isAdminAuthorized:false,isPlacardPlayerEnabled:true,
      initialView:query.get('vue')==='classement'?'classement':'carnet',surface:query.get('vue')==='classement'?'arena':'notebook-ranking'};
    createRoot(document.getElementById('root')).render(React.createElement(ContestHubClient,props));
  `,
  'preview-cart': `export const useCart=()=>({addToCart:()=>{},authLoading:false,user:null,customer:null,items:[]});`,
  'preview-lottery': `export const useLotteryExperience=()=>({tickets:[],inventory:null,config:null,bonuses:[],album:null,loading:false,error:null,acting:false,refreshAll:async()=>{}});`,
  'preview-navigation': `export const NavigationPending=()=>null;export const useRouter=()=>({push:href=>location.assign(href),replace:href=>location.replace(href),refresh:()=>{}});`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props));}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:href=>location.assign(href),replace:href=>location.replace(href),refresh:()=>{}});`,
};
const server = await createServer({
  configFile: false, envDir: false, root, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  define: { 'process.env.NEXT_PUBLIC_CONTEST_BETA_ACCESS_ENABLED': '"false"' },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  esbuild: { jsx: 'automatic' }, resolve: { dedupe: ['react', 'react-dom'], alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'flower-ranking-audit', enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('/context/CartContext')) return '\0preview-cart';
      if (id.endsWith('/hooks/useLotteryExperience')) return '\0preview-lottery';
      if (id.endsWith('/navigation/NavigationFeedback') || id === './NavigationFeedback') return '\0preview-navigation';
      if (id in modules) return '\0' + id;
    },
    load(id) { if (id.startsWith('\0')) return modules[id.slice(1)]; },
    configureServer(vite) { vite.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== path) return next();
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Classement fleurs — audit local</title><link rel="icon" href="data:,"><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__flower-ranking-fixture"></script></html>');
    }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: { ignored: ['**/output/**', '**/.next/**'] } },
});

let browser;
const errors = [], remote = [], writes = [], results = [];
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:') return void request.continue();
    if (url.origin !== origin) { remote.push(url.origin + url.pathname); return void request.abort(); }
    if (!url.pathname.startsWith('/api/')) return void request.continue();
    if (request.method() !== 'GET') writes.push(url.pathname);
    void request.respond({ status: request.method() !== 'GET' ? 405 : url.pathname.startsWith('/api/arena/rewards') ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ reviews: [], entries: [] }) });
  });
  const ready = async count => page.waitForFunction((selector, count) => document.querySelectorAll(`${selector} li`).length === count, {}, board, count);
  const clickFilter = async (group, label, count) => {
    const selector = `[aria-label="${group}"] button`;
    const button = await page.waitForFunction((selector, label) => [...document.querySelectorAll(selector)].find(button => button.textContent.trim() === label), {}, selector, label);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), button.asElement().click()]);
    await ready(count);
  };
  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
    await page.goto(`${origin}${path}?category=indoor`, { waitUntil: 'domcontentloaded' });
    await ready(17);
    assert.equal(await page.$eval('[aria-label="Type de carnet"] [aria-pressed="true"]', el => el.textContent.trim()), 'Tous');
    assert.equal(await page.$eval('a[aria-current="page"]', el => new URL(el.href).searchParams.has('track')), false);
    const labels = await page.$$eval(`${board} li button`, buttons => buttons.map(button => button.getAttribute('aria-label')));
    assert.match(labels[0], /Fleur Regular · rang 1/);
    assert.match(labels[1], /Black Berserker · rang 2 · 82,0 sur 100 · 2 avis/);
    assert.match(labels.at(-1), /Lemon Flambé · pas encore notée · 0 avis/);
    assert.doesNotMatch(labels.at(-1), /rang|0 sur 100/);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      outside: [...document.querySelectorAll('[aria-label="Type de carnet"] button')].some(el => el.getBoundingClientRect().right > innerWidth + 1),
    }));
    assert.deepEqual(layout, { overflow: false, outside: false });
    await page.screenshot({ path: resolve(output, `indoor-${width}.png`), fullPage: true });
    results.push({ width, rows: labels.length, ...layout });
  }
  await page.setViewport({ width: 320, height: 1000 });
  await clickFilter('Type de carnet', 'Regular', 8);
  assert.equal(new URL(page.url()).searchParams.get('track'), 'regular');
  assert.equal(await page.$(`${board} button[aria-label*="Black Berserker"]`), null);
  await clickFilter('Type de carnet', 'Concours', 9);
  assert.equal(new URL(page.url()).searchParams.get('track'), 'concours');
  assert.match(await page.$eval(`${board} li:first-child button`, el => el.getAttribute('aria-label')), /Black Berserker · rang 2/);
  await clickFilter('Type de carnet', 'Tous', 17);
  assert.equal(new URL(page.url()).searchParams.has('track'), false);
  const lemon = `${board} button[aria-label*="Lemon Flambé"]`;
  await page.focus(lemon); await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[open]');
  assert.match(await page.$eval('dialog[open]', el => el.textContent), /Lemon Flambé/);
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]', { hidden: true });
  assert.equal(await page.$eval(lemon, el => document.activeElement === el), true);
  results.push({ filters: 'all/regular/concours', universalRanks: true, keyboardModal: true });
  await page.goto(`${origin}${path}?vue=classement`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[aria-label="Classements de l’Arène"]');
  const flowerLink = await page.$eval('[aria-label="Classements de l’Arène"] a:last-child', el => el.getAttribute('href'));
  assert.equal(new URL(flowerLink, origin).searchParams.has('track'), false);
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('[aria-label="Classements de l’Arène"] a:last-child')]);
  await ready(17);
  assert.equal(await page.$eval('[aria-label="Type de carnet"] [aria-pressed="true"]', el => el.textContent.trim()), 'Tous');
  results.push({ playerNavigationOpensBothNotebooks: true });
  assert.deepEqual(errors, []); assert.deepEqual(remote, []); assert.deepEqual(writes, []);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ ok: true, results, errors, remote, writes }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: results.length, report: 'output/ranking-flowers/report.json' }));
} finally {
  await browser?.close(); await server.close();
}
