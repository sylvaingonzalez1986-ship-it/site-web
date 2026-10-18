/** Real ArenaWorldMap geometry and input audit. All navigation/profile destinations are local fixtures. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/arena-silhouettes');
const port = Number(process.argv.find(argument => argument.startsWith('--port='))?.slice(7) ?? 3238);
const origin = `http://127.0.0.1:${port}`;
const ids = ['carnet', 'jouer', 'classement', 'profil'];
const routes = { carnet: '/arene/carnet/regular', jouer: '/arene/placard', classement: '/arene?vue=classement' };
// Read independently from the source artwork, not copied from the geometry implementation.
const landmarks = { profil: [180, 150], carnet: [580, 785], jouer: [1100, 550], classement: [1200, 210] };
const emptyDecor = [[45, 30], [920, 90], [1100, 930], [935, 395]];
const modules = {
  entry: `import React from 'react';import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ArenaWorldMap} from '/src/components/contest/ArenaWorldMap';
    import styles from '/src/components/contest/ArenaHome.module.css';
    import retro from '/src/components/contest/ArenaRetro.module.css';
    const params=new URLSearchParams(location.search);
    window.auditActions=[];
    document.addEventListener('click',event=>{const link=event.target.closest('a');if(link){event.preventDefault();window.auditActions.push({type:'navigation',href:link.getAttribute('href')});}});
    const launcher={current:{open:origin=>window.auditActions.push({type:'profile',origin:origin.getAttribute('data-arena-place')})}};
    createRoot(document.getElementById('root')).render(React.createElement('main',{className:retro.surface+' '+styles.home,'data-world':'arena'},
      React.createElement('section',{className:styles.activities},React.createElement(ArenaWorldMap,{
        activitiesLocked:params.get('locked')==='1',initialMode:params.get('mode')||'jouer',profileLauncher:launcher,profileAvailability:params.get('profile')||'ready'
      }))));`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/navigation': `export const useRouter=()=>({});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}`;
const server = await createServer({
  configFile: false, envDir: false, root, publicDir: resolve(root, 'public'), cacheDir: resolve(output, 'vite-cache'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'] },
  esbuild: { jsx: 'automatic' }, resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'arena-silhouette-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    load(id) { if (id.startsWith('\0')) return modules[id.slice(1)]; },
    configureServer(vite) { vite.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/') return next();
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arène — silhouettes</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);
    }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser, page;
const errors = [], blockedRequests = [], results = [], screenshots = [];
await mkdir(output, { recursive: true });
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:') return void request.continue();
    if (url.origin !== origin || url.pathname.startsWith('/api/')) { blockedRequests.push(url.origin + url.pathname); return void request.abort(); }
    void request.continue();
  });
  const visit = async (query = '') => {
    await page.goto(`${origin}/?${query}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-arena-place]');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-arena-scene] img')].every(image => image.complete && image.naturalWidth > 0));
    await page.$eval('#arena-map-viewport', element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  };
  const screenshot = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: false });
    screenshots.push(`${name}.png`);
  };
  const pointFor = async (id, kind = 'hit') => page.evaluate(({ id, kind }) => {
    const element = document.querySelector(`[data-arena-place="${id}"]`);
    const [x, y] = element.getAttribute(`data-arena-${kind}-point`).split(',').map(Number);
    const image = document.querySelector('[data-arena-scene] > img');
    const viewport = document.querySelector('#arena-map-viewport');
    if (viewport.scrollWidth > viewport.clientWidth) viewport.scrollLeft = image.clientWidth * x / 100 - viewport.clientWidth / 2;
    const bounds = image.getBoundingClientRect();
    return { x: bounds.left + bounds.width * x / 100, y: bounds.top + bounds.height * y / 100 };
  }, { id, kind });
  const show = async id => page.waitForFunction(id => {
    const polygon = document.querySelector(`[data-arena-silhouette="${id}"][data-active]`);
    return polygon && Number(getComputedStyle(polygon.parentElement).opacity) > .95;
  }, {}, id);
  const action = async (id, point, touch = false) => {
    await page.evaluate(() => window.auditActions = []);
    if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    const actual = await page.evaluate(() => window.auditActions);
    assert.deepEqual(actual, [id === 'profil' ? { type: 'profile', origin: id } : { type: 'navigation', href: routes[id] }], `${id} activates its own destination once`);
  };
  const inspect = async () => page.evaluate(({ landmarks, emptyDecor }) => {
    const image = document.querySelector('[data-arena-scene] > img'), bounds = image.getBoundingClientRect();
    const svg = document.querySelector('[data-arena-silhouette]').ownerSVGElement, svgBounds = svg.getBoundingClientRect();
    const inspectPoint = ([x, y], percent = false) => {
      const point = { x: bounds.left + bounds.width * x / (percent ? 100 : 1536), y: bounds.top + bounds.height * y / (percent ? 100 : 1024) };
      const elements = document.elementsFromPoint(point.x, point.y);
      return { point, target: elements[0]?.closest('[data-arena-place]')?.getAttribute('data-arena-place') ?? null,
        hit: elements.find(element => element.matches('[data-arena-hit-area]'))?.getAttribute('data-arena-hit-area') ?? null,
        label: elements[0]?.closest('[data-arena-label]')?.getAttribute('data-arena-label') ?? null };
    };
    const places = [...document.querySelectorAll('[data-arena-place]')].map(element => {
      const id = element.getAttribute('data-arena-place'), hit = element.querySelector('[data-arena-hit-area]'), rect = hit.getBoundingClientRect();
      const ground = inspectPoint(element.getAttribute('data-arena-ground-point').split(',').map(Number), true);
      return { id, hit: inspectPoint(element.getAttribute('data-arena-hit-point').split(',').map(Number), true), ground,
        groundInBox: ground.point.x > rect.left && ground.point.x < rect.right && ground.point.y > rect.top && ground.point.y < rect.bottom,
        vertices: document.querySelector(`[data-arena-silhouette="${id}"]`).points.numberOfItems,
        pointerEvents: getComputedStyle(element).pointerEvents, clipPath: getComputedStyle(hit).clipPath,
        beforeContent: getComputedStyle(element, '::before').content };
    });
    return { places, image: { width: bounds.width, height: bounds.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight },
      svgAligned: ['left', 'top', 'width', 'height'].every(key => Math.abs(bounds[key] - svgBounds[key]) < .1),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      landmarks: Object.entries(landmarks).map(([id, point]) => ({ id, ...inspectPoint(point) })),
      emptyDecor: emptyDecor.map(point => inspectPoint(point)) };
  }, { landmarks, emptyDecor });

  for (const width of [1440, 390, 320]) {
    const mobile = width < 700;
    await page.setViewport({ width, height: mobile ? 844 : 1120, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    await visit();
    const measured = await inspect();
    assert.equal(measured.overflow, false, `${width}: no page overflow`);
    assert.equal(measured.svgAligned, true, `${width}: SVG contours aligned with artwork`);
    assert.deepEqual([measured.image.naturalWidth, measured.image.naturalHeight], [1536, 1024]);
    assert.deepEqual(measured.places.map(place => place.id).sort(), [...ids].sort());
    for (const place of measured.places) {
      assert.equal(place.hit.hit, place.id, `${width}: interior point is inside ${place.id} silhouette`);
      assert.equal(place.hit.target, place.id, `${width}: interior point selects ${place.id}`);
      assert.equal(place.groundInBox, true, `${width}: negative point tests ${place.id} bounding rectangle`);
      assert.equal(place.ground.hit, null, `${width}: empty rectangle corner is outside all silhouettes`);
      assert(place.ground.target === null || place.ground.label !== null, `${width}: only a separate visible label may cover a rectangle corner`);
      assert.equal(place.pointerEvents, 'none', `${width}: bounding box itself is inert`);
      assert(place.clipPath.startsWith('polygon('), `${width}: actual hit area follows a polygon`);
      assert(place.vertices >= 5, `${width}: polygon is not a rectangle`);
      assert(['none', 'normal'].includes(place.beforeContent), `${width}: no former rectangular pseudo-frame`);
    }
    for (const landmark of measured.landmarks) assert.equal(landmark.hit, landmark.id, `${width}: independently inspected object ${landmark.id}`);
    for (const empty of measured.emptyDecor) assert.equal(empty.target, null, `${width}: empty décor must remain inert`);
    await page.evaluate(() => window.auditActions = []);
    for (const item of [...measured.places.map(place => place.ground).filter(point => point.target === null), ...measured.emptyDecor]) await page.mouse.click(item.point.x, item.point.y);
    assert.deepEqual(await page.evaluate(() => window.auditActions), [], `${width}: clicking empty scene never opens anything`);
    await screenshot(`overview-${width}`);

    if (!mobile) {
      for (const id of ids) {
        await page.evaluate(() => document.activeElement?.blur());
        const point = await pointFor(id); await page.mouse.move(point.x, point.y); await show(id);
        await screenshot(`hover-${id}-${width}`);
        await action(id, point);
      }
      await page.mouse.move(0, 0);
    } else {
      for (const id of ids) await action(id, await pointFor(id), true);
    }
    await page.keyboard.press('Tab');
    for (const id of ids) {
      await page.focus(`[data-arena-place="${id}"]`); await show(id);
      const focus = await page.$eval(`[data-arena-place="${id}"]`, element => ({
        outer: getComputedStyle(element).outlineStyle,
        label: getComputedStyle(element.querySelector('[data-arena-label]')).outlineStyle,
      }));
      assert.equal(focus.outer, 'none', `${width}: focus does not resurrect rectangular frame`);
      assert.notEqual(focus.label, 'none', `${width}: readable label keeps keyboard focus ring`);
      await page.evaluate(() => window.auditActions = []);
      await page.keyboard.press('Enter');
      assert.deepEqual(await page.evaluate(() => window.auditActions), [id === 'profil' ? { type: 'profile', origin: id } : { type: 'navigation', href: routes[id] }]);
    }
    await screenshot(`keyboard-profil-${width}`);
    if (mobile) {
      await page.click('[data-arena-map-zoom]');
      assert.equal(await page.$eval('[data-arena-map-zoom]', element => element.getAttribute('aria-pressed')), 'true');
      for (const id of ids) {
        const point = await pointFor(id);
        const correct = await page.evaluate(({ x, y, id }) => document.elementFromPoint(x, y)?.closest('[data-arena-place]')?.getAttribute('data-arena-place') === id, { ...point, id });
        assert.equal(correct, true, `${width}: ${id} stays registered after zoom and horizontal pan`);
        await action(id, point, true);
      }
      await page.focus('[data-arena-place="jouer"]'); await pointFor('jouer'); await show('jouer');
      const zoomAlignment = await inspect();
      assert.equal(zoomAlignment.svgAligned, true, `${width}: zoom preserves SVG/image alignment`);
      assert.equal(zoomAlignment.overflow, false, `${width}: zoom stays inside scroll viewport`);
      await screenshot(`zoom-jouer-${width}`);
      await page.click('[data-arena-map-zoom]');
      assert.equal(await page.$eval('[data-arena-map-zoom]', element => element.getAttribute('aria-pressed')), 'false');
    }
    results.push({ width, measured, mouseOrTouchDestinations: ids, keyboardDestinations: ids, zoomChecked: mobile });
  }

  await page.setViewport({ width: 1440, height: 1120, deviceScaleFactor: 1 });
  for (const state of ['loading', 'blocked']) {
    await visit(`profile=${state}`);
    assert.equal(await page.$eval('[data-arena-place="profil"]', element => element.disabled), true);
    const point = await pointFor('profil'); await page.mouse.move(point.x, point.y); await page.mouse.click(point.x, point.y);
    assert.deepEqual(await page.evaluate(() => window.auditActions), [], `${state}: disabled profile cannot open`);
    assert.equal(await page.$('[data-arena-silhouette="profil"][data-active]'), null, `${state}: disabled profile is not highlighted`);
  }
  await visit('profile=error'); await action('profil', await pointFor('profil'));
  await visit('locked=1');
  for (const id of ['carnet', 'jouer', 'classement']) {
    assert.equal(await page.$eval(`[data-arena-place="${id}"]`, element => element.getAttribute('aria-disabled')), 'true');
    const point = await pointFor(id); await page.mouse.move(point.x, point.y); await page.mouse.click(point.x, point.y);
    assert.equal(await page.$(`[data-arena-silhouette="${id}"][data-active]`), null, `locked: ${id} does not invite interaction`);
  }
  assert.deepEqual(await page.evaluate(() => window.auditActions), [], 'Locked activities never navigate');
  await action('profil', await pointFor('profil'));
  assert.deepEqual(errors, []); assert.deepEqual(blockedRequests, []);
  const report = { passed: true, createdAt: new Date().toISOString(), scope: 'Actual ArenaWorldMap and ArenaHome/ArenaRetro styles; only Next infrastructure and destination side effects stubbed. No API calls.', results, disabledProfile: ['loading', 'blocked'], profileRetry: true, lockedActivities: true, screenshots, errors, blockedRequests };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, widths: results.map(result => result.width), screenshots: screenshots.length, output }, null, 2));
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {});
  await writeFile(resolve(output, 'failure-report.json'), JSON.stringify({ passed: false, error: String(error.stack || error), results, errors, blockedRequests }, null, 2) + '\n');
  throw error;
} finally {
  await browser?.close(); await server.close();
}
