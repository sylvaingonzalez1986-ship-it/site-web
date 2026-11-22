/** NPC scenarios reuse the village Vite preview and the actual persisted tutorial controller. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

export const npcAuditEntry = `
import React from 'react';import{createRoot}from'react-dom/client';
import{VillagePrototype}from'/src/components/placard/world/VillagePrototype';
import{KqFarmGuide}from'/src/components/placard/KqFarmGuide';
import { SYLVAIN_LESSONS, sylvainStorageKey, writeSylvainState } from '/src/lib/kanab-quest-sylvain-guide';
import{KQ_FARM_GUIDE_OPEN_EVENT}from'/src/lib/kanab-quest-guide-navigation';
import styles from'/src/components/placard/PlacardPlayerShell.module.css';
window.__npcGuideOpens=0;window.__npcNavigation=[];
window.addEventListener(KQ_FARM_GUIDE_OPEN_EVENT,()=>window.__npcGuideOpens++);
window.__npcProgressKey=sylvainStorageKey('npc-audit');
window.__npcSeed=kind=>{
  if(kind==='empty'){localStorage.removeItem(window.__npcProgressKey);return;}
  const state=kind==='current'
    ? {mode:'active',completed:['warehouse'],skipped:['install'],selected:'prepare'}
    : {mode:'off',completed:SYLVAIN_LESSONS.filter(lesson=>lesson.kind==='initial').map(lesson=>lesson.id),skipped:[],selected:null};
  writeSylvainState(localStorage,'npc-audit',state);
  return state;
};
const changed=()=>{};
function App(){const[destination,setDestination]=React.useState({view:'hub'});
const navigate=React.useCallback(next=>{const target=typeof next==='string'?{view:next}:next;window.__npcNavigation.push(target);setDestination(target);},[]);
return <div className={styles.worldShell} data-placard-view={destination.view}>
<KqFarmGuide ownerId="npc-audit" destination={destination} onNavigate={navigate} onActiveChange={changed}/>
<VillagePrototype onNavigate={navigate} onNavigateHref={href=>navigate({view:new URL(href,location.origin).searchParams.get('view')||'hub'})}/></div>}
createRoot(document.getElementById('main-content')).render(<React.StrictMode><App/></React.StrictMode>);
`;

export async function runVillageNpcAudit(origin) {
  const output = resolve(process.env.VILLAGE_NPC_AUDIT_DIR ?? 'output/village-npcs'); await mkdir(output, { recursive: true });
  const report = { passed: false, cases: [], errors: [], external: [], requests: [], limits: 'Local API fixtures, desktop Chromium and touch/viewport emulation; no physical phone or remote writes.' };
  const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox'], userDataDir: resolve(output, 'chrome') });
  let page;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    page = await browser.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/favicon.ico') return void request.respond({ status: 204 });
      if (url.pathname.startsWith('/api/')) {
        report.requests.push({ path: url.pathname, method: request.method() });
        const body = url.pathname.endsWith('/equipment') ? { activeRun: false, cashCents: 125000, readyLotCount: 0, availableFlowerCount: 0 } : url.pathname.endsWith('/runs') ? { activeRun: null, activeRuns: [] } : url.pathname.endsWith('/flowers') ? { flowers: [] } : { items: [], total: 0, hasMore: false };
        return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return void request.continue();
      report.external.push(request.url()); void request.abort();
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
    const ready = () => page.waitForSelector('canvas[data-village-ready="true"][data-life-npcs]');
    await ready();
    await page.evaluate(() => { window.__npcSeed('empty'); });
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
    const stats = () => page.$eval('canvas', node => ({ ...node.dataset }));
    const npcStats = async () => JSON.parse((await stats()).lifeNpcs);
    const observe = async id => {
      const activate = selector => page.viewport().hasTouch ? page.tap(selector) : page.click(selector);
      await activate('details:has([data-observe-life]) summary');
      const option = `details[open] [data-observe-life="${id}"]`;
      await page.waitForSelector(option,{visible:true}); await activate(option);
      await page.waitForSelector(`canvas[data-life-observe="${id}"][data-camera-transition="idle"]`); await sleep(300);
    };
    const point = async id => page.$eval('canvas', (node, id) => { const p = JSON.parse(node.dataset.npcTargets)[id], r = node.getBoundingClientRect(); return { x: p.x + r.x, y: p.y + r.y }; }, id);
    const tap = async (id, touch = false) => { const p = await point(id); if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); };
    const close = async () => { if (await page.$('[data-npc-dialogue]')) await page.click('[aria-label="Fermer l’échange"]'); };
    const bubbleFits = async () => {
      const box = await page.$eval('[data-npc-dialogue]', node => { const r = node.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:innerWidth, height:innerHeight, scroll:node.querySelector('p').textContent }; });
      assert.ok(box.left >= 0 && box.right <= box.width + 1 && box.top >= 0 && box.bottom <= box.height + 1, JSON.stringify(box));
    };
    await observe('breton'); await page.screenshot({ path: resolve(output, 'sonneur-marche.png') });
    // One out-and-back drag must never count as a touch, even with a zero final delta.
    const p = await point('breton'); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 30, p.y, { steps: 5 }); await page.mouse.move(p.x, p.y, { steps: 5 }); await page.mouse.up();
    assert.equal(await page.$('[data-npc-dialogue]'), null);
    await observe('breton'); await page.evaluate(() => { window.__npcRandom = Math.random; Math.random = () => .99; });
    await tap('breton'); await page.waitForSelector('[data-npc-dialogue="breton"][data-segment="0"]');
    assert.equal(await page.$eval('[data-npc-dialogue]', node => node.dataset.intervention), 'loup-renard-belette');
    const exact = await page.evaluate(async () => (await import('/src/components/placard/world/village-npc-dialogue.ts')).VILLAGE_NPC_INTERVENTIONS.breton.find(item => item.id === 'loup-renard-belette').segments);
    for (let i = 0; i < exact.length; i++) {
      assert.equal(await page.$eval('[data-npc-dialogue] p', node => node.textContent), exact[i]);
      assert.equal(await page.$eval('[data-npc-dialogue]', node => +node.dataset.segment), i);
      if (i < exact.length - 1) await page.click('[data-npc-next]');
    }
    await bubbleFits(); await sleep(900); await page.screenshot({ path: resolve(output, 'sonneur-chant.png') });
    assert.ok((await npcStats()).breton.attention > .9);
    await page.click('[data-npc-next]'); assert.notEqual(await page.$eval('[data-npc-dialogue]', node => node.dataset.intervention), 'loup-renard-belette');
    await close(); const stopped = (await npcStats()).breton; await sleep(1800);
    assert.ok(Math.hypot((await npcStats()).breton.x - stopped.x, (await npcStats()).breton.z - stopped.z) < 2, 'No route restart or teleport');
    report.cases.push('Actual model click, out-and-back camera drag rejected, nine exact ordered song segments, no immediate repeat, bounded gaze and smooth resume');

    await observe('fisherman'); await sleep(500); await page.screenshot({ path: resolve(output, 'pecheur-pont.png') });
    await page.evaluate(() => { Math.random = () => .3; }); await tap('fisherman'); await page.waitForSelector('[data-npc-dialogue="fisherman"]');
    assert.equal(await page.$eval('[data-npc-dialogue] p', node => node.textContent), 'Les Bretons ne sont pas têtus…');
    await page.click('[data-npc-next]'); assert.equal(await page.$eval('[data-npc-dialogue] p', node => node.textContent), 'Ils ont juste raison.');
    await close();
    const phases = new Set();
    for (let i = 0; i < 40; i++) {
      const current = (await npcStats()).fisherman; phases.add(current.fishingPhase);
      if (current.fishingPhase === 'sip') { await page.screenshot({ path: resolve(output, 'pecheur-gorgee.png') }); await tap('fisherman'); await page.waitForSelector('[data-npc-dialogue="fisherman"]'); await sleep(700); await page.screenshot({ path: resolve(output, 'pecheur-interruption.png') }); await close(); }
      if (phases.size === 6) break;
      await sleep(1000);
    }
    report.fishingPhases = [...phases]; assert.equal(phases.size, 6);
    report.cases.push('Fisherman exact two-part joke, all six fishing/bottle phases, click interruption during sip and resumed routine');

    await observe('loic'); await page.screenshot({ path: resolve(output, 'loic-promenade.png') });
    const book = 'dialog[data-sylvain-library][open]';
    const openBook = async (touch = false) => {
      await tap('loic', touch);
      await page.waitForSelector(book, { visible: true });
      assert.equal(await page.$eval(book, node => node.matches(':modal') && node.contains(document.activeElement)), true);
    };
    const closeBook = async () => {
      await page.click(`${book} [aria-label="Fermer le carnet"]`);
      await page.waitForSelector(book, { hidden: true });
      assert.equal(await page.$eval('canvas', node => node.dataset.villageReady), 'true');
    };
    const opensBefore = await page.evaluate(() => window.__npcGuideOpens);
    await openBook(); await tap('loic'); await tap('loic');
    assert.equal(await page.evaluate(() => window.__npcGuideOpens), opensBefore + 1);
    assert.ok(await page.$(`${book} [data-sylvain-control="start"]`));
    assert.equal(await page.$('[data-npc-dialogue]'), null);
    await page.screenshot({ path: resolve(output, 'loic-tutoriel.png') });
    await closeBook(); await openBook();
    assert.equal(await page.evaluate(() => window.__npcGuideOpens), opensBefore + 2);
    await closeBook();
    for (const kind of ['current', 'complete']) {
      const saved = await page.evaluate(kind => window.__npcSeed(kind), kind);
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await observe('loic'); await openBook();
      assert.deepEqual(await page.$$eval(`${book} [data-status="completed"]`, nodes => nodes.map(node => node.dataset.sylvainLesson)), saved.completed);
      assert.deepEqual(await page.$$eval(`${book} [data-status="skipped"]`, nodes => nodes.map(node => node.dataset.sylvainLesson)), saved.skipped);
      await page.click(`${book} [data-sylvain-lesson="warehouse"] summary`);
      await page.waitForSelector(`${book} [data-sylvain-lesson="warehouse"] details[open]`);
      await closeBook();
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem(window.__npcProgressKey))), saved);
    }
    report.cases.push('Loïc opens one modal Carnet, closes and reopens it from his model. Browsing lessons preserves the current or completed guide, including skipped and selected lessons');

    for (const viewport of [{ width: 844, height: 390 }, { width: 568, height: 320 }, { width: 320, height: 568 }]) {
      await page.setViewport({ ...viewport, hasTouch: true, isMobile: true }); await ready();
      await observe('breton'); await tap('breton', true); await page.waitForSelector('[data-npc-dialogue="breton"]'); await bubbleFits();
      const before = await page.$eval('[data-npc-dialogue]', node => ({ id:node.dataset.intervention,segment:+node.dataset.segment }));
      await page.touchscreen.tap(...Object.values(await point('breton'))); await sleep(100);
      const after = await page.$eval('[data-npc-dialogue]', node => ({ id:node.dataset.intervention,segment:+node.dataset.segment }));
      if (before.id === after.id) assert.equal(after.segment, before.segment + 1);
      else assert.equal(after.segment, 0);
      await page.screenshot({ path: resolve(output, `mobile-${viewport.width}x${viewport.height}.png`) }); await close();
      await observe('fisherman'); await tap('fisherman', true); await page.waitForSelector('[data-npc-dialogue="fisherman"]'); await bubbleFits();
      await observe('loic'); assert.equal(await page.$('[data-npc-dialogue]'), null); await openBook(true); await closeBook();
    }
    report.cases.push('Touch at 844×390, 568×320 and 320×568; one segment per tap; bounded speech; successive musician/fisherman/guide exchanges');
    await page.setViewport({ width: 1440, height: 1000 });
    await page.evaluate(() => document.documentElement.requestFullscreen());
    assert.ok(await page.evaluate(() => !!document.fullscreenElement));
    await observe('loic'); await openBook(); await page.screenshot({ path: resolve(output, 'fullscreen-guide.png') }); await closeBook(); await page.evaluate(() => document.exitFullscreen());
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]); await page.waitForSelector('canvas[data-motion-state="reduced"]');
    const before = await npcStats(); await sleep(350); assert.deepEqual(await npcStats(), before);
    await observe('breton'); await tap('breton'); await page.waitForSelector('[data-npc-dialogue="breton"]'); await close();
    await page.emulateMediaFeatures([]);
    report.cases.push('Fullscreen actual guide; reduced motion holds rigs while interactions remain usable');
    const final = await stats(); report.performance = { drawCalls:+final.drawCalls, triangles:+final.triangles, geometries:+final.geometries, textures:+final.textures, renderSubmitMs:+final.renderSubmitMs };
    assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []); assert.ok(report.requests.every(request => request.method === 'GET'));
    report.passed = true;
  } catch (error) {
    report.failure = error.stack; process.exitCode = 1;
    if (page) await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  } finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
  console.log(JSON.stringify(report));
}
