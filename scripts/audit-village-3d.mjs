/** Actual 3D components, isolated from account APIs; --preview keeps a local viewer open. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { auditCameraScene } from './fixtures/village-audit-camera.mjs';

const lifecycle = process.argv.includes('--interiors-lifecycle');
const interiors = process.argv.includes('--interiors') || process.argv.includes('--interiors-builder') || lifecycle;
const studio = process.argv.includes('--avatar-studio');
const root = process.cwd(), output = resolve(root, studio ? process.env.CHANVRIER_STUDIO_AUDIT_DIR ?? 'output/chanvrier-studio' : interiors ? 'output/village-interiors' : 'output/village-3d');
const preview = process.argv.includes('--preview');
const life = process.argv.includes('--life');
const npcs = process.argv.includes('--npcs');
const characterQuality = process.argv.includes('--character-quality');
const worldFinish = process.argv.includes('--world-finish');
const calendar = process.argv.includes('--calendar');
const korriganPg = process.argv.includes('--korrigans-postgres');
const korrigans = process.argv.includes('--korrigans') || korriganPg;
const port = Number(process.env.VILLAGE_PREVIEW_PORT ?? 3618), origin = `http://127.0.0.1:${port}`;
const modules = {
  'audit-village-camera': 'export { _roots as fiberRoots } from "@react-three/fiber"; export { Vector3 } from "three";',
  entry: `import React from 'react';import {createRoot} from 'react-dom/client';import {VillagePrototype} from '/src/components/placard/world/VillagePrototype';createRoot(document.getElementById('main-content')).render(<VillagePrototype/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,unoptimized,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export function usePathname(){return '/arene/village-3d'}export function useRouter(){return {push:href=>${preview ? 'window.location.assign(href)' : '(window.__villageNavigations??=[]).push(href)'}}}`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,options={}){const Lazy=React.lazy(()=>Promise.resolve(loader()).then(value=>typeof value==='function'?{default:value}:value));return function Dynamic(props){const Loading=options.loading;return <React.Suspense fallback={Loading?<Loading/>:null}><Lazy {...props}/></React.Suspense>}}`,
};
if (life || studio || worldFinish || characterQuality) modules['audit-camera-scene'] = auditCameraScene;
if (korrigans) modules['audit-korrigan-account'] = 'export const useCart = () => ({ user: { id: "korrigan-fixture" } });';
if (life && !process.argv.includes('--baseline')) modules.entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { VillagePrototype } from '/src/components/placard/world/VillagePrototype';
  const root = createRoot(document.getElementById('main-content'));
  const village = new URLSearchParams(location.search).has('strict') ? <React.StrictMode><VillagePrototype/></React.StrictMode> : <VillagePrototype/>;
  window.addEventListener('audit:mount-village', event => root.render(event.detail ? village : null));
  root.render(village);
`;
if (npcs || characterQuality) modules.entry = (await import('./audit-village-npcs.mjs')).npcAuditEntry;
if (calendar) modules.entry = `import React from 'react';import {createRoot} from 'react-dom/client';
  import {VillagePrototype} from '/src/components/placard/world/VillagePrototype';
  import {KqQuarterTeamAccess} from '/src/components/placard/KqQuarterTeamAccess';
  import {KqStaffRecoveryProvider} from '/src/components/placard/KqStaffRecoveryContext';
  const noop=()=>{};createRoot(document.getElementById('main-content')).render(<KqStaffRecoveryProvider ownerId="world-audit-player"><VillagePrototype onNavigate={noop} onOpenOverview={noop}><KqQuarterTeamAccess onAvailabilityChange={noop}/></VillagePrototype></KqStaffRecoveryProvider>);`;
if (studio) modules.entry = (await import('./audit-chanvrier-studio.mjs')).entry;
if (worldFinish || (characterQuality && process.argv.includes('--timing-only') && process.argv.includes('--human-finish'))) {
  const { entry } = await import('./audit-village-finish.mjs');
  modules.entry = entry;
  modules['audit-world-three'] = 'export * from "three"; export { _roots as fiberRoots } from "@react-three/fiber";';
}
if (characterQuality) modules['character-audit-three'] = 'export * from "three"; export { _roots as fiberRoots } from "@react-three/fiber";';
if (lifecycle) modules.entry = `import React,{useCallback,useEffect,useMemo,useState} from 'react';import{createRoot}from'react-dom/client';import InteriorCanvas from '/src/components/placard/world/InteriorCanvas';import{createInteriorRoom}from'/src/components/placard/world/interior-rooms';import{createKqWarehouseStarter}from'/src/lib/kanab-quest-warehouse';
function Lifecycle(){const[mounted,setMounted]=useState(true),[legacy,setLegacy]=useState(false),[failed,setFailed]=useState(false);useEffect(()=>{window.__interiorLifecycle.effects++;return()=>{window.__interiorLifecycle.cleanups++}},[]);const room=useMemo(()=>{const state=createKqWarehouseStarter();if(legacy)delete state.floor;return createInteriorRoom('warehouse',{state,revision:1,cashCents:100000,activeRun:false,legacyActiveRun:false,migrationCreditCents:0,stockGrams:0,salesGramsPerDay:null})},[legacy]);const ready=useCallback(()=>{window.__interiorLifecycle.ready++},[]),unavailable=useCallback(()=>{window.__interiorLifecycle.unavailable++;setFailed(true)},[]),noop=useCallback(()=>{},[]);return <main><nav style={{height:64,display:'flex',gap:12}}><button data-lifecycle-toggle onClick={()=>{setFailed(false);setMounted(value=>!value)}}>{mounted?'Sortir':'Entrer'}</button><button data-lifecycle-resize onClick={()=>setLegacy(value=>!value)}>Changer les dimensions</button></nav><section data-lifecycle-room={legacy?'legacy':'starter'} style={{position:'relative',height:'calc(100vh - 64px)'}}>{mounted&&!failed?<InteriorCanvas room={room} suspended={false} editing={false} overhead={false} grid={false} sensitivity={1} quality="low" selectedId={null} preview={null} previewValid={true} onSelect={noop} onInteract={noop} onPlace={noop} onExit={noop} onReady={ready} onUnavailable={unavailable}/>:failed?<p data-lifecycle-unavailable>Vue indisponible</p>:<p data-lifecycle-outside>Au village</p>}</section></main>};createRoot(document.getElementById('main-content')).render(<React.StrictMode><Lifecycle/></React.StrictMode>);`;
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:700 900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:400 700}:root{--font-display:Display;--font-body:Body}*{box-sizing:border-box}body{margin:0}button,a{-webkit-tap-highlight-color:transparent}button{font-family:inherit}svg{flex-shrink:0}`;
const beforeCharacters = characterQuality && process.argv.includes('--baseline');
const worldDirectory = resolve(root, 'src/components/placard/world');
const characterSnapshot = resolve(root, process.env.VILLAGE_CHARACTER_AUDIT_DIR ?? 'output/village-character-quality', 'source-before');
const worldPrefix = `${worldDirectory.replaceAll('\\', '/')}/`;
const snapshotPrefix = `${characterSnapshot.replaceAll('\\', '/')}/`;
const playerSnapshotPrefix = `${resolve(characterSnapshot, '../player-before').replaceAll('\\', '/')}/`;
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile: false, envDir: false, publicDir: resolve(root, 'public'), cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { ...(korrigans && { '@/context/CartContext': 'audit-korrigan-account' }), '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom', 'three'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'lucide-react', 'three', '@react-three/fiber', 'three/addons/controls/OrbitControls.js', 'three/addons/utils/BufferGeometryUtils.js'] },
  css: { postcss: { plugins: [] } },
  plugins: [{ name: 'isolated-village', enforce: 'pre',
    resolveId(id, importer) {
      if (modules['audit-camera-scene'] && id === './VillageCanvas' && importer?.endsWith('/VillagePrototype.tsx')) return '\0audit-camera-scene';
      if (id in modules) return '\0' + id;
      if (beforeCharacters && process.argv.includes('--human-finish') && importer?.startsWith(worldPrefix) && id === '../kq-grow-worker-model') {
        return playerSnapshotPrefix + 'kq-grow-worker-model.ts';
      }
      if (characterQuality && importer?.startsWith(playerSnapshotPrefix) && id.startsWith('./world/')) {
        return snapshotPrefix + id.slice('./world/'.length) + '.ts';
      }
      if (characterQuality && id.startsWith('../') && importer?.startsWith(snapshotPrefix)) {
        return this.resolve(id, `${worldPrefix}${importer.slice(snapshotPrefix.length)}`, { skipSelf: true });
      }
    },
    async load(id) {
      if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
      if (worldFinish && process.argv.includes('--baseline') && id.startsWith(worldPrefix) && !id.includes('?'))
        return readFile(resolve(root, 'output/village-faune/source-before', relative(worldDirectory, id)), 'utf8');
      if (worldFinish && process.argv.includes('--baseline') && id.replaceAll('\\','/').endsWith('/src/components/placard/KqGrowRoomGeometry.ts'))
        return readFile(resolve(root, 'output/village-faune/player-before/KqGrowRoomGeometry.ts'), 'utf8');
      if (!beforeCharacters || !id.startsWith(worldPrefix) || id.includes('?')) return;
      return readFile(resolve(characterSnapshot, relative(worldDirectory, id)), 'utf8');
    },
    configureServer(vite) { vite.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/')) { res.statusCode = 404; return res.end(); }
      if (req.url?.startsWith('/arene')) { res.writeHead(302, { Location: `http://localhost:3000${req.url}` }); return res.end(); }
      if (req.url?.split('?')[0] !== '/') return next();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Le Quartier en 3D</title><style>${fonts}</style><main id="main-content"></main><script type="module" src="/@id/__x00__entry"></script></html>`);
    }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: preview, watch: preview ? {} : null },
});
await server.listen();
if (preview) {
  console.log(`Village 3D : ${origin}`);
  const stop = async () => { await server.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} else if (korriganPg) {
  try { await (await import('./audit-korrigan-postgres.mjs')).auditKorriganPostgres(origin); } finally { await server.close(); }
} else if (korrigans) {
  try { await (await import('./audit-korrigan-market.mjs')).auditKorriganMarket(origin); } finally { await server.close(); }
} else if (calendar) {
  try { await (await import('./audit-village-calendar.mjs')).auditVillageCalendar(origin, server); } finally { await server.close(); }
} else if (studio) {
  try { await (await import('./audit-chanvrier-studio.mjs')).run({ origin, output }); } finally { await server.close(); }
} else if (worldFinish) {
  try { await (await import('./audit-village-finish.mjs')).auditWorld(origin); } finally { await server.close(); }
} else if (characterQuality) {
  process.env.VILLAGE_CHARACTER_ORIGIN = origin;
  try { await import('./audit-village-character-quality.mjs'); } finally { await server.close(); }
} else if (npcs) {
  try { await (await import('./audit-village-npcs.mjs')).runVillageNpcAudit(origin); } finally { await server.close(); }
} else if (life) {
  process.env.VILLAGE_LIFE_ORIGIN = origin;
  try { await import('./audit-village-life.mjs'); } finally { await server.close(); }
} else if (interiors) {
  try {
    const { runInteriorAudit, runInteriorLifecycleAudit } = await import('./audit-village-interiors-scenarios.mjs');
    await (lifecycle ? runInteriorLifecycleAudit : runInteriorAudit)({ origin, output });
  } finally { await server.close(); }
} else {
  const report = { passed: false, backend: 'Actual village geometry, motion and mailbox UI; equipment/feedback responses intercepted locally, no live account APIs; headless Chromium checks do not establish physical-device performance.', cases: [], errors: [], external: [] };
  const feedbackRequests = [];
  let feedbackUnavailable = false;
  const equipmentRequests = [];
  let activitySnapshot = { activeRun: true, cashCents: 125000, readyLotCount: 3, availableFlowerCount: 2, curingFlowerCount: 1 };
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
      userDataDir: resolve(output, 'audit-chrome'), args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    const context = await browser.createBrowserContext();
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/favicon.ico') return void request.respond({ status: 204 });
      if (url.origin === origin && url.pathname === '/api/arena/placard/equipment' && request.method() === 'GET') {
        equipmentRequests.push(url.search);
        return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(activitySnapshot) });
      }
      if (url.origin === origin && url.pathname === '/api/arena/feedback' && request.method() === 'GET') {
        feedbackRequests.push(request.method());
        return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(feedbackUnavailable ? { error: 'Courrier momentanément indisponible.' } : {
          items: [{ id: 'mailbox-audit', kind: 'idea', subject: 'Courrier de recette', message: 'Un message de test local pour vérifier la lecture.',
            status: 'resolved', reply: 'Réponse de recette : ton idée a bien été lue.', rewardPacks: 0, rewardGrantedAt: null,
            createdAt: '2026-11-17T10:00:00Z', updatedAt: '2026-11-17T11:00:00Z', pagePath: '/arene/village-3d' }], total: 1, hasMore: false,
        }) });
      }
      if (url.origin === origin && !url.pathname.startsWith('/api/') || ['data:', 'blob:'].includes(url.protocol)) return void request.continue();
      report.external.push(request.url()); void request.abort();
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForSelector('canvas[data-village-ready="true"]');
    await page.waitForSelector('canvas[data-motion-state="running"][data-active-activities="culture,market,jury"]');
    await page.waitForSelector('[data-village-activity-state="ready"]');
    assert.ok(equipmentRequests.includes('?tentNumber=1'));
    assert.equal((await page.$eval('canvas', node => node.dataset.motionParts.split(',').length)), 11);
    const waitCamera = () => page.waitForSelector('canvas[data-camera-transition="idle"]');
    const motionTime = () => page.$eval('canvas', node => Number(node.dataset.motionTime));
    const firstTime = await motionTime();
    await page.waitForFunction(before => Number(document.querySelector('canvas').dataset.motionTime) > before + 0.15, {}, firstTime);
    await page.click('[aria-label="Mettre les animations en pause"]');
    await page.waitForSelector('canvas[data-motion-state="paused"]');
    await page.click('[aria-label="Tourner à droite"]');await waitCamera();
    await page.click('[aria-label="Tourner à gauche"]');await waitCamera();
    const pausedAt = await motionTime();
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
    assert.equal(await motionTime(), pausedAt);
    await page.click('[aria-label="Lancer les animations"]');
    await page.waitForSelector('canvas[data-motion-state="running"]');
    report.cases.push('Eleven original scenery pivots, live activity flags, animation clock and manual pause/resume');
    await page.evaluate(()=>{window.__cameraAuditSampling=true;window.__cameraAuditSamples=[];const sample=()=>{if(!window.__cameraAuditSampling)return;window.__cameraAuditSamples.push({time:performance.now(),position:document.querySelector('[data-village-building="warehouse"]')?.style.transform});requestAnimationFrame(sample)};requestAnimationFrame(sample)});
    await page.click('[aria-label="Tourner à droite"]');await page.waitForSelector('canvas[data-camera-transition="running"]');await waitCamera();
    report.cameraInterpolation=await page.evaluate(()=>{window.__cameraAuditSampling=false;const samples=window.__cameraAuditSamples;return{frames:samples.length,distinctPositions:new Set(samples.map(sample=>sample.position)).size,elapsedMs:samples.at(-1).time-samples[0].time}});
    assert.ok(report.cameraInterpolation.distinctPositions>=3,'Camera rotation must project several real intermediate positions');
    await page.click('[aria-label="Tourner à gauche"]');await page.waitForSelector('canvas[data-camera-transition="running"]');
    await page.click('[aria-label="Mettre les animations en pause"]');await page.waitForSelector('canvas[data-motion-state="paused"]');await waitCamera();
    const pausedCamera=await page.$eval('[data-village-building="warehouse"]',node=>node.style.transform);
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,200)));
    assert.equal(await page.$eval('[data-village-building="warehouse"]',node=>node.style.transform),pausedCamera,'Pausing must stop an in-flight camera transition');
    await page.click('[aria-label="Recentrer la vue isométrique"]');await waitCamera();
    await page.click('[aria-label="Lancer les animations"]');await page.waitForSelector('canvas[data-motion-state="running"]');
    assert.equal(await page.$eval('canvas',node=>node.dataset.cameraTransition),'idle','Resuming must not restart a cancelled command');
    await page.click('[aria-label="Agrandir le village"]');await page.waitForSelector('canvas[data-camera-transition="running"]');
    const dragPoint=await page.$eval('canvas',node=>{const r=node.getBoundingClientRect();return{x:r.left+r.width*.9,y:r.top+r.height*.65}});
    await page.mouse.move(dragPoint.x,dragPoint.y);await page.mouse.down();await waitCamera();
    await page.mouse.move(dragPoint.x+40,dragPoint.y+20,{steps:4});await page.mouse.up();
    assert.equal(await page.$eval('canvas',node=>node.dataset.cameraTransition),'idle','Dragging must cancel the camera transition');
    await page.click('[aria-label="Recentrer la vue isométrique"]');await waitCamera();
    report.cases.push('Camera rotation uses measured intermediate frames; pause and direct drag cancel transitions, paused commands snap, and resume does not restart cancelled motion');
    const geometryMotion = await page.evaluate(async () => {
      const { createVillageBuilding } = await import('/src/components/placard/world/village-buildings.ts');
      const { VILLAGE_PLACES, villagePlacePosition } = await import('/src/components/placard/world/village-layout.ts');
      const { createVillageAnimation } = await import('/src/components/placard/world/village-animation.ts');
      const { disposeVillageObject } = await import('/src/components/placard/world/village-terrain.ts');
      const buildings = VILLAGE_PLACES.map(place => ({ place, object: createVillageBuilding(place.id), position: villagePlacePosition(place) }));
      const animation = createVillageAnimation(buildings), bank = buildings.find(b => b.place.id === 'bank').object.getObjectByName('motion-bank-sign');
      const farm = buildings.find(b => b.place.id === 'warehouse').object;
      animation.update(1, { culture: false, market: false, jury: false }, false); const a = bank.rotation.z;
      const idle = farm.getObjectByName('idle-culture').visible && !farm.getObjectByName('activity-culture').visible;
      animation.update(2.3, { culture: true, market: true, jury: true }, false); const b = bank.rotation.z;
      const active = !farm.getObjectByName('idle-culture').visible && farm.getObjectByName('activity-culture').visible;
      animation.react('bank', 2.3); animation.update(2.5, { culture: true, market: true, jury: true }, false); const reaction = bank.rotation.z;
      animation.update(2.5, { culture: true, market: true, jury: true }, true); const reduced = bank.rotation.z;
      animation.dispose(); buildings.forEach(b => disposeVillageObject(b.object));
      return { a, b, reaction, reduced, idle, active };
    });
    assert.notEqual(geometryMotion.a, geometryMotion.b); assert.notEqual(geometryMotion.reaction, geometryMotion.b);
    assert.equal(geometryMotion.reduced, 0); assert.ok(geometryMotion.idle && geometryMotion.active);
    report.cases.push('Actual geometry sways/reacts; reduced motion restores rest; doors reveal the active farm interior');
    await page.evaluate(() => document.fonts.ready);
    const destinations = '[data-village-building]';
    const settleBubble = () => page.evaluate(async () => {
      const panel = document.querySelector('[data-building]');
      await Promise.all((panel?.getAnimations({ subtree: true }) ?? []).map(animation => animation.finished.catch(() => {})));
    }).then(waitCamera);
    assert.equal(await page.$$eval(destinations, nodes => nodes.length), 9);
    assert.equal(await page.$('[data-village-prototype] footer'), null);
    assert.equal(await page.$('[aria-label="Choisir un lieu du quartier"]'), null);
    assert.equal(await page.$eval('canvas', node => Math.abs(node.getBoundingClientRect().bottom - innerHeight) < 2), true);
    await page.screenshot({ path: resolve(output, 'desktop.png') });
    report.cases.push('Full-height village with nine building controls on the map');
    const menuButton = '[aria-label="Ouvrir le menu du quartier"]', menuDialog = 'dialog[aria-label="Menu de Kanab Quest"][open]';
    const menuKeys = ['hub', 'game', 'harvests', 'workshop', 'market', 'social', 'staff', 'treasury', 'school', 'missions', 'shop'];
    const waitMenuClosed = async () => {
      await page.waitForSelector(menuDialog, { hidden: true });
      await page.waitForFunction(() => !window.history.state?.lcbOverlays?.length);
      assert.equal(await page.$eval(menuButton, node => node === document.activeElement && node.getAttribute('aria-expanded') === 'false'), true);
    };
    await page.focus(menuButton); await page.keyboard.press('Enter'); await page.waitForSelector(menuDialog);
    assert.deepEqual(await page.$$eval(`${menuDialog} [data-placard-nav]`, nodes => nodes.map(node => node.dataset.placardNav)), menuKeys);
    assert.equal(await page.$eval(menuDialog, node => node.getBoundingClientRect().left), 0);
    await page.keyboard.press('Tab');
    assert.equal(await page.$eval(menuDialog, node => node.contains(document.activeElement)), true);
    await page.screenshot({ path: resolve(output, 'desktop-menu.png') });
    await page.keyboard.press('Escape'); await waitMenuClosed();
    await page.click(menuButton); await page.waitForSelector(menuDialog);
    await page.evaluate(() => window.history.back()); await waitMenuClosed();
    await page.click(menuButton); await page.waitForSelector(menuDialog);
    await page.mouse.click(900, 350); await waitMenuClosed();
    await page.click(menuButton); await page.waitForSelector(menuDialog);
    await page.setViewport({ width: 900, height: 1000 });
    await page.setViewport({ width: 1440, height: 1000 });
    assert.ok(await page.$(menuDialog));
    await page.click(`${menuDialog} [data-placard-nav="hub"]`); await waitMenuClosed();
    assert.equal(await page.evaluate(() => window.__villageNavigations?.length ?? 0), 0);
    for (const key of menuKeys.filter(key => key !== 'hub')) {
      await page.click(menuButton); await page.waitForSelector(menuDialog);
      await page.click(`${menuDialog} [data-placard-nav="${key}"]`); await waitMenuClosed();
      await page.waitForFunction(href => window.__villageNavigations?.at(-1) === href, {}, `/arene/placard?view=${key}`);
    }
    await page.click(menuButton); await page.waitForSelector(menuDialog);
    const carnetButton = `${menuDialog} [data-arena-learning-trigger]`;
    await page.waitForFunction(selector => document.querySelector(selector)?.textContent.trim() === 'Carnet de Loïc', {}, carnetButton);
    await page.focus(carnetButton); await page.keyboard.press('Enter'); await waitMenuClosed();
    await page.waitForFunction(() => window.__villageNavigations?.at(-1) === '/arene/placard?guide=1');
    report.cases.push('Village side menu with all eleven entries, Carnet de Loïc, keyboard, Escape/Back/backdrop, focus return and desktop resizing');
    async function projectWorldPoint(position) {
      await page.evaluate(() => new Promise(done => requestAnimationFrame(done)));
      await waitCamera();
      return page.evaluate(async position => {
        const { fiberRoots, Vector3 } = await import('/@id/__x00__audit-village-camera');
        const canvas = document.querySelector('canvas[data-village-ready="true"]');
        const { camera } = fiberRoots.get(canvas).store.getState();
        const rect = canvas.getBoundingClientRect(), point = new Vector3(...position).project(camera);
        return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
      }, position);
    }
    const farmPosition = await page.evaluate(async () => {
      const { VILLAGE_PLACES, villagePlacePosition } = await import('/src/components/placard/world/village-layout.ts');
      const place = VILLAGE_PLACES.find(place => place.id === 'warehouse'), [x, y, z] = villagePlacePosition(place);
      return [x, y + 1.7, z + place.depth * place.scale / 2 + 0.2];
    });
    const farmPoint = await projectWorldPoint(farmPosition);
    await page.mouse.click(farmPoint.x, farmPoint.y);
    await page.waitForSelector('[data-building="warehouse"][data-positioned]');
    const farmLinks = ['/arene/placard?view=workshop', '/arene/placard?view=game', '/arene/placard?view=workshop&section=processing', '/arene/placard?view=harvests'];
    assert.deepEqual(await page.$$eval('[aria-label="Activités · La ferme"] a', nodes => nodes.map(node => node.getAttribute('href'))), farmLinks);
    await page.waitForFunction(() => document.querySelector('[aria-label="Lieu sélectionné : La ferme"] a') === document.activeElement);
    await settleBubble();
    await page.screenshot({ path: resolve(output, 'farm-bubble.png') });
    const initialTail = await page.$eval('[data-village-bubble-tail] path', node => node.getAttribute('d'));
    await page.click('[aria-label="Tourner à droite"]');
    await page.click('[aria-label="Agrandir le village"]');
    await page.waitForFunction(before => {
      return document.querySelector('[data-village-bubble-tail] path')?.getAttribute('d') !== before;
    }, {}, initialTail);
    await page.screenshot({ path: resolve(output, 'rotated-bubble.png') });
    await page.keyboard.press('Escape'); await page.waitForSelector('[data-building="warehouse"]', { hidden: true });
    assert.equal(await page.$eval(destinations, node => node === document.activeElement), true);
    await page.click('[aria-label="Recentrer la vue isométrique"]');
    report.cases.push('Real farm model click opens culture/workshop/harvest activities; bubble follows camera, Escape restores focus');
    await page.focus(destinations); await page.keyboard.press('Enter');
    await page.waitForSelector('[aria-label="Lieu sélectionné : La ferme"]');
    assert.equal(await page.$eval('[aria-label="Lieu sélectionné : La ferme"] a', node => node.getAttribute('href')), farmLinks[0]);
    await page.click('[aria-label="Fermer les activités du bâtiment"]');
    const expectedActions = [farmLinks,
      ['/arene/placard?view=hub&room=bank', ...['loans','savings','stocks','crypto'].map(section => `/arene/placard?view=treasury&pole=bank&section=${section}`)],
      ['/arene/placard?view=hub&room=office', '/arene/placard?view=staff', '/arene/placard?view=staff&section=accounting'],
      ['/arene/placard?view=hub&room=market', '/arene/placard?view=market&section=sales', '/arene/placard?view=market&section=dashboard', '/arene/placard?view=market&section=management', '/arene/placard?view=social'],
      ['/arene/placard?view=hub&room=missions', '/arene/placard?view=missions'], ['/arene/placard?view=hub&room=arena', '/arene/placard?view=arena'], ['/arene/placard?view=school'],
      ['/arene/placard?view=hub&room=shop', '/arene/placard?view=shop', '/arene/placard?view=shop&tab=collection']];
    for (let index = 0; index < expectedActions.length; index++) {
      await page.focus(`${destinations}:nth-child(${index + 1})`); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('[data-building]')?.getAttribute('data-positioned') === 'true');
      assert.deepEqual(await page.$$eval('[data-building] nav a', nodes => nodes.map(node => node.getAttribute('href'))), expectedActions[index]);
      if (index === 3) { await settleBubble(); await page.screenshot({ path: resolve(output, 'commerce-bubble.png') }); }
    }
    await page.click('[aria-label="Fermer les activités du bâtiment"]');
    report.cases.push('Keyboard access and correct existing action URLs for all eight buildings');
    await page.click('[aria-label="Tourner à droite"]');
    await page.click('[aria-label="Agrandir le village"]');
    await page.screenshot({ path: resolve(output, 'rotated.png') });
    await page.click('[aria-label="Recentrer la vue isométrique"]');
    report.cases.push('Rotation, zoom and isometric reset');
    const mailboxButton = '[aria-label="Ouvrir la boîte aux lettres"]', mailboxDialog = '[data-mailbox-dialog][open]';
    assert.equal(feedbackRequests.length, 0, 'Mailbox history must load only when opened');
    assert.equal(await page.$('[data-map-mailbox], [data-village-prototype] img[src*="mailbox"]'), null, 'No 2D mailbox artwork floats over the village');
    assert.equal(await page.$eval(mailboxButton, node => getComputedStyle(node).opacity === '0' && getComputedStyle(node).pointerEvents === 'none'), true, 'The keyboard mailbox control must not overlay the scene or capture pointer hits');
    // Project the centre of the mailbox body, then click the WebGL canvas.
    const mailboxPosition = await page.evaluate(async () => {
      const { VILLAGE_MAILBOX_POSITION } = await import('/src/components/placard/world/village-layout.ts');
      return [VILLAGE_MAILBOX_POSITION[0], VILLAGE_MAILBOX_POSITION[1] + 1.75, VILLAGE_MAILBOX_POSITION[2]];
    });
    const { x: mx, y: my } = await projectWorldPoint(mailboxPosition);
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x: mx, y: my }), 'CANVAS', 'Pointer reaches the real mailbox model');
    await page.screenshot({ path: resolve(output, 'mailbox-integrated.png') });
    await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(mx + 40, my + 10, { steps: 6 }); await page.mouse.up();
    assert.equal(await page.$(mailboxDialog), null, 'Camera dragging must not open the mailbox');
    await page.click('[aria-label="Recentrer la vue isométrique"]');
    const resetMailboxPoint = await projectWorldPoint(mailboxPosition);
    await page.mouse.click(resetMailboxPoint.x, resetMailboxPoint.y);
    await page.waitForSelector(mailboxDialog);
    await page.waitForFunction(() => document.querySelector('[data-mailbox-dialog]')?.textContent.includes('Réponse de recette : ton idée a bien été lue.'));
    assert.equal(feedbackRequests.length, 1, 'A model click opens one mailbox and fetches history once');
    await page.type('[data-mailbox-form] input[name="subject"]', 'Brouillon conservé');
    await page.$eval('[data-mailbox-dialog] [data-app-dialog-body]', node => { node.scrollTop = node.scrollHeight; });
    await page.screenshot({ path: resolve(output, 'mailbox-mails.png') });
    await page.keyboard.press('Escape'); await page.waitForSelector(mailboxDialog, { hidden: true });
    assert.equal(await page.$eval(mailboxButton, node => node === document.activeElement), true);
    await page.focus(mailboxButton);
    assert.equal(await page.$eval(mailboxButton, node => node.matches(':focus-visible') && getComputedStyle(node).opacity === '1'), true, 'Keyboard users can still see the mailbox focus target');
    await page.keyboard.press('Enter'); await page.waitForSelector(mailboxDialog);
    assert.equal(await page.$eval('[data-mailbox-form] input[name="subject"]', node => node.value), 'Brouillon conservé');
    await page.goBack(); await page.waitForSelector(mailboxDialog, { hidden: true });
    report.cases.push('Only the 3D mailbox receives pointer hits, no foreground 2D artwork/control; model click, drag guard, messages/replies, visible keyboard access, draft preservation and Back/Escape close');
    const oldMap = 'img[src*="placard-world-quizzshow-v9.webp"], [aria-label="Passer à la carte 2D"], [aria-label="Voir la carte d’origine"], [aria-label="Voir le village en 3D"]';
    assert.equal(await page.$(oldMap), null);
    assert.equal(await page.$$eval('canvas[data-village-ready="true"]', nodes => nodes.length), 1);
    report.cases.push('The standalone village exposes one Three scene and no map switch');
    const tapBuildingModel = async id => {
      await page.tap('[aria-label="Recentrer la vue isométrique"]');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const position = await page.evaluate(async id => {
        const { VILLAGE_PLACES, villagePlacePosition } = await import('/src/components/placard/world/village-layout.ts');
        const place = VILLAGE_PLACES.find(place => place.id === id), [x, y, z] = villagePlacePosition(place);
        return [x, y + 2, z];
      }, id);
      const point = await projectWorldPoint(position);
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point), 'CANVAS');
      await page.touchscreen.tap(point.x, point.y);
    };
    for (const width of [390, 320]) {
      await page.setViewport({ width, height: 844, isMobile: true, hasTouch: true });
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('canvas[data-village-ready="true"]');
      await page.evaluate(() => document.fonts.ready);
      const signs = await page.$$eval(destinations, nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          name: node.getAttribute('aria-label'),
          visible: node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
          showsName: node.innerText.includes(node.getAttribute('aria-label')),
          reachable: node.contains(hit),
          withinScreen: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        };
      }));
      await page.screenshot({ path: resolve(output, width === 320 ? 'mobile.png' : 'mobile-390.png') });
      assert.equal(signs.length, 9);
      for (const [index, sign] of signs.entries()) {
        assert.ok(sign.visible && sign.showsName && sign.reachable && sign.withinScreen, `${width}px: ${sign.name} must be readable and tappable on the map`);
        for (const other of signs.slice(index + 1)) {
          assert.ok(sign.right <= other.left || other.right <= sign.left || sign.bottom <= other.top || other.bottom <= sign.top,
            `${width}px: ${sign.name} overlaps ${other.name}`);
        }
      }
      const mailbox = await projectWorldPoint(mailboxPosition);
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, mailbox), 'CANVAS',
        `${width}px: building signs must leave the mailbox model reachable`);
      await page.tap('[data-village-building="collection"]');
      await page.waitForSelector('[data-building="collection"][data-positioned]');
      await page.tap('[aria-label="Fermer les activités du bâtiment"]');
      await page.waitForSelector('[data-building="collection"]', { hidden: true });
    }
    report.cases.push('All nine building names are visible, separated and touchable at 320px and 390px; the mailbox model remains reachable');
    const labelToggle = '[data-village-toggle-labels]';
    const observer = 'details:has([data-observe-life])';
    const settings = '[data-village-settings]';
    await page.tap(`${observer} > summary`);
    assert.deepEqual(await page.$$eval(`${observer}[open] button`, nodes => nodes.map(node => node.innerText.trim())),
      ['Le sonneur de biniou', 'Le pêcheur près du pont', 'Loïc, le guide']);
    await page.screenshot({ path: resolve(output, 'mobile-observer-320.png') });
    for (const id of ['breton', 'fisherman', 'loic']) {
      await page.tap(`${observer} [data-observe-life="${id}"]`);
      await page.waitForSelector(`canvas[data-life-observe="${id}"][data-camera-transition="idle"]`);
      assert.equal(await page.$eval(observer, node => !node.open && document.activeElement === node.querySelector('summary')), true);
      await page.tap(`${observer} > summary`);
    }
    report.cases.push('320px Observer offers only the three NPCs; tapping each follows that character and returns focus to Observer');
    const toggleNames = async caption => {
      await page.tap(`${settings} > summary`);
      assert.equal(await page.$eval(observer, node => node.open), false);
      assert.ok(await page.$(`${settings}[open] ${labelToggle}`));
      assert.equal(await page.$eval(labelToggle, node => node.innerText.trim()), caption);
      await page.tap(labelToggle);
      assert.equal(await page.$eval(settings, node => node.open), false);
    };
    const visibleNames = () => page.$$eval(destinations, nodes => nodes.filter(node =>
      node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })).length);
    await toggleNames('Masquer les noms des bâtiments');
    assert.equal(await visibleNames(), 0);
    await page.tap('[aria-label="Recentrer la vue isométrique"]');
    await page.waitForSelector('canvas[data-camera-transition="idle"][data-life-observe=""]');
    await page.focus(destinations);
    await page.keyboard.press('Tab');
    await page.waitForSelector('[data-village-building]:focus-visible');
    assert.equal(await visibleNames(), 1, 'Keyboard navigation reveals the focused name');
    await tapBuildingModel('warehouse');
    await page.waitForSelector('[data-building="warehouse"][data-positioned]');
    await page.tap('[aria-label="Fermer les activités du bâtiment"]');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('canvas[data-village-ready="true"]');
    assert.equal(await visibleNames(), 0, 'The hidden preference survives reload');
    await page.screenshot({ path: resolve(output, 'mobile-noms-masques-320.png') });
    await toggleNames('Afficher les noms des bâtiments');
    assert.equal(await visibleNames(), 9);
    report.cases.push('320px touch toggles building names; hiding survives reload, keyboard focus reveals one name, models still open and all nine names can be restored');
    assert.equal(await page.$$eval('[data-village-prototype] > header > div:first-child > button, [data-village-prototype] > header > div:first-child > a, [data-village-prototype] > header > button', nodes => nodes.every(node => {
      const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth;
    })), true);
    await page.tap(menuButton); await page.waitForSelector(menuDialog);
    assert.equal(await page.$eval(menuDialog, node => node.scrollWidth <= node.clientWidth && node.getBoundingClientRect().right <= innerWidth), true);
    await page.screenshot({ path: resolve(output, 'mobile-menu.png') });
    const mobileLearning = `${menuDialog} [data-arena-learning-trigger]`;
    await page.$eval(mobileLearning, node => node.scrollIntoView({ block: 'end', behavior: 'instant' }));
    await page.waitForFunction(selector => document.querySelector(selector).getBoundingClientRect().bottom <= innerHeight + 1, {}, mobileLearning);
    await page.tap('[aria-label="Fermer le menu"]'); await waitMenuClosed();
    assert.equal(await page.$('[aria-label="Accès rapides de Kanab Quest"]'), null);
    report.cases.push('320px side menu opens by touch, scrolls to tutorial, closes from sticky header and keeps the village free of bottom navigation');
    await tapBuildingModel('warehouse');
    await page.waitForSelector('[aria-label="Lieu sélectionné : La ferme"]');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await settleBubble();
    await page.screenshot({ path: resolve(output, 'mobile-selected.png') });
    report.cases.push('320px touch selection, readable panel and no horizontal overflow');
    assert.equal(await page.$eval('[data-building="warehouse"]', node => {
      const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
    }), true);
    await tapBuildingModel('market');
    await page.waitForSelector('[data-building="market"][data-positioned]');
    await settleBubble();
    assert(await page.$eval('[data-building="market"]', node =>
      node.getBoundingClientRect().top >= document.querySelector('[data-village-prototype] > header').getBoundingClientRect().bottom));
    await page.screenshot({ path: resolve(output, 'mobile-commerce.png') });
    assert.equal(await page.$$eval('[data-building="market"] a', nodes => nodes.length), expectedActions[3].length);
    await page.$eval('[data-building="market"] a:last-child', node => node.scrollIntoView({ block: 'nearest' }));
    assert.equal(await page.$eval('[data-building="market"] a:last-child', node => {
      const r = node.getBoundingClientRect(), parent = node.parentElement.getBoundingClientRect(); return r.top >= parent.top && r.bottom <= parent.bottom + 1;
    }), true);
    await page.screenshot({ path: resolve(output, 'mobile-commerce-scrolled.png') });
    await page.click('[aria-label="Fermer les activités du bâtiment"]');
    report.cases.push('320px farm and commerce bubbles stay on screen with all actions reachable');
    await page.tap('[aria-label="Recentrer la vue isométrique"]');
    await page.waitForFunction(() => document.querySelector('[aria-label="Ouvrir la boîte aux lettres"]')?.getAttribute('data-offscreen') === 'false');
    feedbackUnavailable = true;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const mobileMailboxPoint = await projectWorldPoint(mailboxPosition);
    assert.equal(await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y); return hit?.tagName === 'CANVAS' ? 'CANVAS' : `${hit?.tagName}: ${hit?.getAttribute('aria-label')}`;
    }, mobileMailboxPoint), 'CANVAS');
    await page.touchscreen.tap(mobileMailboxPoint.x, mobileMailboxPoint.y); await page.waitForSelector(mailboxDialog);
    await page.waitForSelector('[data-mailbox-dialog] [role="alert"]');
    assert.match(await page.$eval('[data-mailbox-dialog] [role="alert"]', node => node.textContent), /Impossible de lire tes courriers/);
    feedbackUnavailable = false;
    await page.$eval('[data-mailbox-dialog] [data-app-dialog-body]', node => { node.scrollTop = node.scrollHeight; });
    await page.locator('[data-mailbox-dialog] ::-p-text(Actualiser)').click();
    await page.waitForFunction(() => document.querySelector('[data-mailbox-dialog]')?.textContent.includes('Réponse de recette : ton idée a bien été lue.'));
    assert.equal(await page.$eval('[data-mailbox-dialog]', node => node.getBoundingClientRect().width <= innerWidth && node.scrollWidth <= node.clientWidth), true);
    await page.screenshot({ path: resolve(output, 'mobile-mailbox.png') });
    await page.tap('[aria-label="Fermer la boîte aux lettres"]'); await page.waitForSelector(mailboxDialog, { hidden: true });
    report.cases.push('320px mailbox touch access, visible loading error, retry and readable correspondence');
    activitySnapshot = { activeRun: false, cashCents: 100, readyLotCount: 0, availableFlowerCount: 0, curingFlowerCount: 0 };
    await page.evaluate(() => window.dispatchEvent(new Event('kq:storage-updated')));
    await page.waitForSelector('canvas[data-active-activities=""]');
    await tapBuildingModel('warehouse');
    await page.waitForFunction(() => document.querySelector('[data-building="warehouse"]')?.textContent.includes('Commencer une culture'));
    await page.click('[aria-label="Fermer les activités du bâtiment"]');
    activitySnapshot = null;
    await page.evaluate(() => window.dispatchEvent(new Event('kq:equipment-updated')));
    await page.waitForSelector('[data-village-activity-state="error"]');
    assert.equal(await page.$eval('[data-village-activity-state]', node => node.textContent.includes('0 €')), false);
    activitySnapshot = { activeRun: true, cashCents: 125000, readyLotCount: 3, availableFlowerCount: 2, curingFlowerCount: 1 };
    await page.locator('::-p-text(Réessayer)').click();
    await page.waitForSelector('canvas[data-active-activities="culture,market,jury"]');
    report.cases.push('Same equipment snapshot and refresh events as 2D; activity on/off and missing-state recovery without invented zero values');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('canvas[data-motion-state="reduced"]');
    await page.click('[aria-label="Tourner à droite"]');await waitCamera();
    await page.click('[aria-label="Tourner à gauche"]');await waitCamera();
    const reducedAt = await motionTime();
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
    assert.equal(await motionTime(), reducedAt);
    await page.click('[aria-label="Lancer les animations"]');
    await page.waitForSelector('canvas[data-motion-state="running"]');
    await page.waitForFunction(before => Number(document.querySelector('canvas').dataset.motionTime) > before, {}, reducedAt);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForSelector('canvas[data-motion-state="hidden"]');
    const hiddenAt = await motionTime();
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
    assert.equal(await motionTime(), hiddenAt);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForSelector('canvas[data-motion-state="running"]');
    report.cases.push('Reduced-motion static default and explicit opt-in; visibility change freezes/resumes animation clock');
    await page.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    const fallback = '[data-village-unavailable]';
    await page.waitForSelector(fallback, { visible: true });
    assert.match(await page.$eval(`${fallback} [role="alert"]`, node => node.textContent), /indisponible/);
    assert.equal(await page.$(oldMap), null);
    assert.equal(await page.$$eval(`${fallback} ${destinations}`, nodes => nodes.length), 9);
    await page.focus(`${fallback} [data-village-building="hemp-farm"]`); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__villageNavigations?.at(-1) === '/arene/placard?support=1');
    const fallbackFarm = `${fallback} [data-village-building="warehouse"]`;
    await page.focus(fallbackFarm); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-building="warehouse"]', { visible: true });
    assert.deepEqual(await page.$$eval('[data-building="warehouse"] a', nodes => nodes.map(node => node.getAttribute('href'))), farmLinks);
    await page.click('[aria-label="Fermer les activités du bâtiment"]');
    await page.waitForFunction(selector => document.activeElement?.matches(selector), {}, fallbackFarm);
    report.cases.push('After context loss the HTML directory keeps eight activity menus and direct producer support keyboard-accessible');
    await page.tap(mailboxButton); await page.waitForSelector(mailboxDialog);
    await page.waitForFunction(() => document.querySelector('[data-mailbox-dialog]')?.textContent.includes('Courrier de recette'));
    await page.tap('[aria-label="Fermer la boîte aux lettres"]'); await page.waitForSelector(mailboxDialog, { hidden: true });
    report.cases.push('Mailbox remains accessible after WebGL context loss');
    assert.deepEqual(report.external, []); assert.deepEqual(report.errors, []);
    report.passed = true;
  } catch (error) { report.failure = error.stack; throw error; }
  finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); await server.close(); }
  console.log(JSON.stringify(report));
}
