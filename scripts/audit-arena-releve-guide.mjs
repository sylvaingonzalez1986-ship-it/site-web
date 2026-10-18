import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

// Follow only the target that Sylvain actually highlights. This deliberately
// does not repair scrolling or search for the next control on the player's behalf.
const root = process.cwd(), output = resolve(root, process.argv.includes('--production-only') ? 'output/arena-releve-native-game' : process.argv.includes('--meetings-only') ? 'output/arena-releve-guide-meetings' : process.argv.includes('--smoke') ? 'output/arena-releve-guide-smoke' : 'output/arena-releve-guide');
const port = Number(process.argv.find(argument => argument.startsWith('--port='))?.slice(7) ?? 3268), origin = `http://127.0.0.1:${port}`;
const modules = {
  'warehouse-manifest': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')}`,
  fixture: `import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';import{ArenaLearningHub}from'/src/components/contest/ArenaLearningHub';function App(){const[open,setOpen]=React.useState(false);return React.createElement(React.Fragment,null,React.createElement('button',{'data-open':true,onClick:()=>setOpen(true)},'Apprendre à jouer'),open?React.createElement(ArenaLearningHub,{onClose:()=>setOpen(false)}):null)}createRoot(document.getElementById('root')).render(React.createElement(App));`,
  'next/dynamic': `import React from'react';export default function dynamic(load,options={}){const C=React.lazy(async()=>{const m=await load();return{default:m.default||m}});return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(C,props))}}`,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/navigation': `export const usePathname=()=>'/arene';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const auditStyle = `
@font-face{font-family:GameBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2) format('woff2');font-weight:400 700;font-style:normal}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Bold.woff2) format('woff2');font-weight:700;font-style:normal}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2) format('woff2');font-weight:800;font-style:normal}
@font-face{font-family:GameDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2) format('woff2');font-weight:900;font-style:normal}
@font-face{font-family:GameHandwritten;src:url(/src/app/fonts/Caveat-Latin-Bold.woff2) format('woff2');font-weight:700;font-style:normal}
:root{--font-body:GameBody;--font-display:GameDisplay;--font-handwritten:GameHandwritten}
body{margin:0;background:#fff1d6;font-family:var(--font-body),sans-serif}button{font-family:inherit}
`;
const server = await createServer({
  configFile: false, envDir: false, root, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react', '@3d-dice/dice-box-threejs', 'gsap'] },
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'releve-guide-audit', enforce: 'pre',
    resolveId(id) { if (id.endsWith('warehouse-v2/manifest.json')) return '\0warehouse-manifest'; if (id in modules) return '\0' + id; },
    load(id) { if (id.startsWith('\0')) return modules[id.slice(1)]; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/') return next();
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${auditStyle}</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>`);
    }); },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
let browser, page;
const errors = [], api = [], consoleErrors = [], results = [], steps = [];

async function snapshot(name) {
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  assert(await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].every(el => el.scrollWidth <= el.clientWidth + 1)), `Horizontal overflow: ${name}`);
}

async function inspectGuide() {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-releve-guide-active]')].some(el => el.getClientRects().length && !el.closest(':disabled,[aria-disabled=true]')));
  await page.waitForFunction(() => [...document.querySelectorAll('[data-releve-guide-card] img')].some(el => el.getClientRects().length && el.complete));
  // Give layout effects and observers two frames to follow the new game target.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // The game now scrolls only the necessary distance, smoothly. Observe its
  // settled geometry without moving the screen on the player's behalf.
  await page.waitForFunction(() => {
    const target = [...document.querySelectorAll('[data-releve-guide-active]')].filter(el => el.getClientRects().length).at(-1);
    if (!target) return false;
    const rect = target.getBoundingClientRect();
    const key = `${target.getAttribute('data-releve-guide-active')}:${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
    const previous = window.__guideAuditPosition;
    if (!previous || previous.key !== key) { window.__guideAuditPosition = { key, since: performance.now() }; return false; }
    return performance.now() - previous.since > 180;
  }, { timeout: 4000 });
  // The moving outline has a short CSS transition. Verify its settled position,
  // including the coordinate conversion when it lives in a native modal.
  await page.waitForFunction(() => {
    const target = [...document.querySelectorAll('[data-releve-guide-active]')].filter(el => el.getClientRects().length).at(-1);
    const spot = [...document.querySelectorAll('[data-releve-spotlight]')].find(el => el.getClientRects().length);
    if (!target || !spot) return false;
    const a = target.getBoundingClientRect(), b = spot.getBoundingClientRect();
    return Math.abs(a.left + a.width / 2 - b.left - b.width / 2) < 8 && Math.abs(a.top + a.height / 2 - b.top - b.height / 2) < 8;
  }, { timeout: 3000 });
  return page.evaluate(() => {
    const targets = [...document.querySelectorAll('[data-releve-guide-active]')].filter(el => el.getClientRects().length);
    const target = targets.at(-1), card = [...document.querySelectorAll('[data-releve-guide-card]')].filter(el => el.getClientRects().length).at(-1);
    if (!target || !card) return { error: 'The target and coach must both be visible.' };
    const r = target.getBoundingClientRect(), c = card.getBoundingClientRect();
    const center = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const overlap = Math.max(0, Math.min(r.right, c.right) - Math.max(r.left, c.left)) * Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top));
    const label = target.getAttribute('aria-label') || target.textContent?.replace(/\s+/g, ' ').trim() || target.getAttribute('placeholder') || target.id;
    const portrait = card.querySelector('img');
    const spotlight = [...document.querySelectorAll('[data-releve-spotlight]')].find(el => el.getClientRects().length);
    const story = JSON.parse(localStorage.getItem('arena-releve-session-v1') || 'null');
    return {
      count: targets.length, id: target.getAttribute('data-releve-guide-active'), cardId: card.getAttribute('data-guide-step'), label,
      tag: target.tagName, type: target.getAttribute('type'), value: target.value,
      instruction: card.textContent?.replace(/\s+/g, ' ').trim(), chapter: story?.chapter ?? 0,
      rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      interactive: target.matches('button,input,select,textarea,summary,a[href],[role="button"],[role="slider"],[data-warehouse-map-viewport]:has([data-drawing=true]),[data-buddie-target=true]') || !!target.closest('button:not(:disabled),a[href]'),
      enabled: !target.closest(':disabled,[aria-disabled=true]'),
      inViewport: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1,
      coachVisible: c.left >= -1 && c.right <= innerWidth + 1 && c.top >= -1 && c.bottom <= innerHeight + 1,
      unoccluded: !!center && (target === center || target.contains(center)),
      clearOfCoach: card.contains(target) || overlap < 1,
      portrait: !!portrait && portrait.naturalWidth > 0, spotlight: !!spotlight,
      innerDialog: target.closest('dialog') === card.closest('dialog'),
    };
  });
}

async function assertGuide(context) {
  const guide = await inspectGuide();
  assert(!guide.error, `${context}: ${guide.error}`);
  for (const property of ['interactive', 'enabled', 'inViewport', 'coachVisible', 'unoccluded', 'clearOfCoach', 'portrait', 'spotlight', 'innerDialog']) {
    assert(guide[property], `${context}: ${property} failed for ${JSON.stringify(guide)}`);
  }
  assert.equal(guide.count, 1, `${context}: only one action should be highlighted`);
  assert.equal(guide.id, guide.cardId, `${context}: instruction and target disagree`);
  steps.push({ context, ...guide });
  return guide;
}

async function fingerprint() {
  return page.evaluate(() => {
    const target = [...document.querySelectorAll('[data-releve-guide-active]')].filter(el => el.getClientRects().length).at(-1);
    const card = [...document.querySelectorAll('[data-releve-guide-card]')].filter(el => el.getClientRects().length).at(-1);
    return JSON.stringify([target?.outerHTML, target?.closest('label')?.textContent, card?.textContent, localStorage.getItem('arena-releve-session-v1'), [...document.querySelectorAll('details[open]')].map(el => el.querySelector('summary')?.textContent), document.querySelector('[data-pack-phase]')?.getAttribute('data-pack-phase')]);
  });
}

async function follow(guide) {
  const before = await fingerprint();
  const handle = await page.$('[data-releve-guide-active]');
  assert(handle, `Missing ${guide.id}`);
  if (/^(plan|expansion):trace-/.test(guide.id)) {
    const point = await handle.evaluate((el, id) => {
      const map = el.querySelector('[data-warehouse-map]');
      const x = id.includes('storage') ? 4 : id.startsWith('expansion') ? 5 : 1;
      const y = id.includes('culture') ? 1 : 7;
      const cell = Number(map.dataset.gridCellSize);
      const result = new DOMPoint(Number(map.dataset.gridOriginX) + (x + .5) * cell, Number(map.dataset.gridOriginY) + (y + .5) * cell).matrixTransform(map.getScreenCTM());
      return { x: result.x, y: result.y };
    }, guide.id);
    await page.mouse.click(point.x, point.y);
  } else if (guide.tag === 'INPUT' || guide.tag === 'TEXTAREA') {
    if (guide.type === 'range') {
      await handle.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Tab');
    } else if (guide.type === 'checkbox' || guide.type === 'radio') {
      await handle.click();
    } else {
      const value = guide.id === 'commerce-quantity' ? '10' : guide.id === 'commerce-brand' || /nom de marque|boutique/i.test(guide.label) ? 'La relève guidée' : /surnom|Sylvain29/i.test(guide.label) ? 'Apprenti29' : guide.value || '100';
      await handle.click({ clickCount: 3 }); await page.keyboard.press('Backspace'); await handle.type(value); await page.keyboard.press('Tab');
    }
  } else if (guide.tag === 'SELECT') {
    const value = await handle.evaluate((el, instruction) => [...el.options].find(option => !option.disabled && option.textContent.trim().length > 2 && instruction.toLocaleLowerCase('fr').includes(option.textContent.trim().toLocaleLowerCase('fr')))?.value ?? [...el.options].find(option => /Hash tamisé/.test(option.textContent))?.value ?? [...el.options].find(option => !option.disabled && option.value !== el.value)?.value, guide.instruction);
    assert(value !== undefined, `No selectable option at ${guide.id}`); await handle.select(value);
  } else {
    await handle.click();
  }
  await handle.dispose();
  await page.waitForFunction(before => {
    const target = [...document.querySelectorAll('[data-releve-guide-active]')].filter(el => el.getClientRects().length).at(-1);
    const card = [...document.querySelectorAll('[data-releve-guide-card]')].filter(el => el.getClientRects().length).at(-1);
    return JSON.stringify([target?.outerHTML, target?.closest('label')?.textContent, card?.textContent, localStorage.getItem('arena-releve-session-v1'), [...document.querySelectorAll('details[open]')].map(el => el.querySelector('summary')?.textContent), document.querySelector('[data-pack-phase]')?.getAttribute('data-pack-phase')]) !== before;
  }, { timeout: 12000 }, before);
}

async function openHub(width, clear = false) {
  await page.setViewport({ width, height: 960, deviceScaleFactor: 1 });
  await page.goto(origin, { waitUntil: 'networkidle0' });
  if (clear) { await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' }); }
  await page.click('[data-open]');
}

async function freeExplorationAcrossConfirmation() {
  const target = await page.$('[data-releve-guide-active]');
  assert(target, 'The game action must be available before pausing guidance.');
  const pause = await page.evaluateHandle(() => [...document.querySelectorAll('[data-releve-guide-card] button')].find(el => el.textContent.trim() === 'Explorer librement' && el.getClientRects().length));
  await pause.asElement().click(); await pause.dispose();
  await page.waitForFunction(() => !document.querySelector('[data-releve-guide-active]'));
  assert.equal(await page.$('[data-releve-spotlight]'), null, 'Free exploration must remove the spotlight.');
  // Act on the same game control after switching the guide off. A native
  // confirmation remounts the coach in the top layer and must keep this choice.
  await target.click(); await target.dispose();
  await page.waitForSelector('[data-releve] dialog[open]');
  await page.waitForFunction(() => {
    const host = [...document.querySelectorAll('dialog[open]')].at(-1);
    return host?.querySelector('[data-releve-guide-card]')?.textContent.includes('Reprendre le guidage');
  });
  assert.equal(await page.$('[data-releve-guide-active]'), null, 'Opening a confirmation must not silently restart the guide.');
  const resume = await page.evaluateHandle(() => [...document.querySelectorAll('dialog[open]')].at(-1)?.querySelector('[data-releve-guide-card] button'));
  assert(await resume.evaluate(el => el?.textContent.includes('Reprendre le guidage')), 'The player can resume guidance in the confirmation.');
  await resume.asElement().click(); await resume.dispose();
  const current = await assertGuide('resumed-in-confirmation');
  assert.equal(current.id, 'commerce-confirm');
}

async function story(width, limit = 160) {
  await openHub(width, true);
  const resume = process.argv.includes('--resume') ? JSON.parse(await readFile(resolve(output, 'failure-story.json'), 'utf8')) : null;
  if (resume) await page.evaluate(state => localStorage.setItem('arena-releve-session-v1', JSON.stringify(state)), resume);
  await page.click('[data-releve-start]');
  const chapters = new Set();
  let freeAcrossModal = false;
  for (let index = 0; index < limit; index++) {
    const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('arena-releve-session-v1') || 'null')?.completed === true);
    if (completed) {
      await snapshot(`complete-${width}`); assert.equal(chapters.size, 9 - (resume?.chapter ?? 0)); results.push({ width, story: true, resumed: !!resume, chapters: [...chapters], actions: index, freeAcrossModal }); return;
    }
    const guide = await assertGuide(`story/${width}/${index}`);
    if (!chapters.has(guide.chapter)) { chapters.add(guide.chapter); await snapshot(`chapter-${guide.chapter + 1}-${width}`); }
    if (guide.id === 'plan:inspect-zone') await snapshot(`plan-zones-${width}`);
    if (guide.id === 'buddies:profile') await snapshot(`buddies-cards-${width}`);
    if (guide.id === 'buddies:close-profile') await snapshot(`buddie-sheet-${width}`);
    if (guide.id === 'launch:deck') await snapshot(`support-deck-${width}`);
    if (guide.id === 'culture:card-2-after-roll') await snapshot(`support-card-${width}`);
    console.log(`${width}px · ${guide.id} · ${guide.label}`);
    if (guide.id === 'commerce-prepare' && !freeAcrossModal) { await freeExplorationAcrossConfirmation(); freeAcrossModal = true; }
    else await follow(guide);
    if (process.argv.includes('--production-only') && guide.chapter === 5 && guide.id === 'chapter-complete') { results.push({ width, production: true, chapters: [...chapters], actions: index + 1 }); return; }
    if (process.argv.includes('--smoke') && guide.chapter >= 2) { results.push({ width, smoke: true, chapters: [...chapters] }); return; }
  }
  throw new Error(`The highlighted path did not finish within ${limit} actions at ${width}px.`);
}

async function meetings(width) {
  const selected = process.argv.find(argument => argument.startsWith('--meeting='))?.slice('--meeting='.length);
  const excluded = process.argv.find(argument => argument.startsWith('--exclude-meeting='))?.slice('--exclude-meeting='.length);
  for (const id of ['expansion', 'workshop', 'business', 'bank', 'community', 'notebook'].filter(id => (!selected || selected === id) && excluded !== id)) {
    await openHub(width); await page.click('[data-learning-group="meetings"]'); await page.click(`[data-releve-meeting="${id}"]`);
    const guide = await assertGuide(`meeting/${id}/${width}`); await snapshot(`meeting-${id}-${width}`);
    if (process.argv.includes('--meetings-full') || process.argv.includes('--meetings-only')) {
      let completed = false;
      for (let index = 0; index < 100; index++) {
        const current = index === 0 ? guide : await assertGuide(`meeting/${id}/${width}/${index}`);
        console.log(`${width}px · ${id} · ${current.id} · ${current.label}`);
        await follow(current);
        if (current.id === 'meeting-complete') { completed = true; break; }
      }
      assert(completed, `The highlighted path did not finish meeting ${id} at ${width}px.`);
      results.push({ width, meeting: id, completed: true });
      continue;
    }
    if (['bank', 'community', 'notebook'].includes(id)) {
      await follow(guide); await page.waitForSelector('[data-playable-lesson]');
      await assertGuide(`lesson/${id}/${width}`); await snapshot(`lesson-${id}-${width}`);
    }
    results.push({ width, meeting: id, initialTarget: guide.id, nativeModal: ['bank', 'community', 'notebook'].includes(id) });
  }
}

try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) { api.push({ path: url.pathname, method: request.method() }); return void request.respond({ status: 500, contentType: 'application/json', body: '{"error":"No account access in tutorial audit"}' }); }
    if (url.protocol !== 'data:' && url.origin !== origin) return void request.abort();
    void request.continue();
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('releve-real-player-sentinel', 'unchanged'); window.__globalUpdates = 0;
    for (const type of ['kq:equipment-updated', 'kq:commerce-updated', 'kq:treasury-updated', 'arena:profile-updated']) window.addEventListener(type, () => window.__globalUpdates++);
  });
  const requestedWidth = Number(process.argv.find(argument => argument.startsWith('--width='))?.slice('--width='.length));
  for (const width of requestedWidth ? [requestedWidth] : process.argv.includes('--production-only') ? [320, 1440] : [1440, 390, ...(process.argv.includes('--smoke') ? [320] : [])]) {
    if (!process.argv.includes('--meetings-only')) await story(width);
    else await openHub(width, true);
    if (!process.argv.includes('--smoke') && !process.argv.includes('--production-only')) await meetings(width);
    assert.equal(await page.evaluate(() => localStorage.getItem('releve-real-player-sentinel')), 'unchanged');
    assert.equal(await page.evaluate(() => window.__globalUpdates), 0);
  }
  assert.deepEqual(api, []); assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
  console.log(JSON.stringify({ passed: true, results, steps: steps.length, api, errors }));
} catch (error) {
  process.exitCode = 1; console.error(error);
  if (page) await writeFile(resolve(output, 'failure-story.json'), await page.evaluate(() => localStorage.getItem('arena-releve-session-v1') ?? 'null'));
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }); console.error(await page.evaluate(() => [...document.querySelectorAll('[data-releve-guide-active], [data-releve-guide-card]')].map(el => el.outerHTML))); }
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: !process.exitCode, results, steps, api, errors, consoleErrors }, null, 2));
  await browser?.close(); await server.close();
}
