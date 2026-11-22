/** NPC scenarios reuse the village Vite preview and the actual persisted tutorial controller. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { frameVillageSubject } from './fixtures/village-audit-camera.mjs';

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
    const checkControls = async () => {
      assert.equal(await page.$('[data-observe-life], [data-npc-dialogue]'), null);
      assert.equal(await page.$$eval('summary', nodes => nodes.some(node => node.textContent.trim() === 'Observer')), false);
      assert.deepEqual(await page.$$eval('[data-npc-access]', nodes => nodes.map(node => node.dataset.npcAccess)), ['loic']);
      assert.deepEqual(Object.keys(await npcStats()).sort(), ['breton', 'fisherman', 'loic']);
    };
    const tap = async (id, touch = false) => {
      await frameVillageSubject(page, id);
      await page.waitForFunction(id => {
        const node = document.querySelector('canvas');
        const p = JSON.parse(node.dataset.npcTargets || '{}')[id], r = node.getBoundingClientRect();
        return p?.visible && document.elementFromPoint(p.x + r.x, p.y + r.y) === node;
      }, {}, id);
      const p = await page.$eval('canvas', (node, id) => {
        const target = JSON.parse(node.dataset.npcTargets)[id], rect = node.getBoundingClientRect();
        return { x: target.x + rect.x, y: target.y + rect.y };
      }, id);
      if (touch) await page.touchscreen.tap(p.x, p.y);
      else await page.mouse.click(p.x, p.y);
    };
    const checkResidents = async (touch = false) => {
      await checkControls();
      for (const id of ['breton', 'fisherman']) {
        await tap(id, touch);
        assert.equal(await page.$('[data-npc-dialogue], [data-sylvain-library][open]'), null);
        assert.equal((await npcStats())[id].attention, 0);
      }
    };
    await checkResidents();
    report.cases.push('The two villagers remain on the map. Clicking either model leaves the guide closed and opens no dialogue. Only Loïc has a keyboard action.');
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
    await openBook();
    assert.equal(await page.evaluate(() => window.__npcGuideOpens), opensBefore + 1);
    assert.ok(await page.$(`${book} [data-sylvain-control="start"]`));
    assert.equal(await page.$('[data-npc-dialogue]'), null);
    await page.screenshot({ path: resolve(output, 'loic-tutoriel.png') });
    await closeBook(); await openBook();
    assert.equal(await page.evaluate(() => window.__npcGuideOpens), opensBefore + 2);
    await closeBook();
    for (const kind of ['current', 'complete']) {
      const saved = await page.evaluate(kind => window.__npcSeed(kind), kind);
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openBook();
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
      await checkResidents(true);
      await openBook(true); await closeBook();
    }
    report.cases.push('Touching the three models at 844×390, 568×320 and 320×568 opens only the guide for Loïc.');
    await page.setViewport({ width: 1440, height: 1000 }); await ready();
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
    await page.waitForSelector('canvas[data-motion-state="reduced"]');
    const before = await npcStats(); await sleep(350); assert.deepEqual(await npcStats(), before);
    await page.focus('[data-npc-access="loic"]'); await page.keyboard.press('Enter');
    await page.waitForSelector(book, { visible: true }); await closeBook();
    await page.focus('[data-village-building="warehouse"]'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-building="warehouse"] a[href*="view=workshop"]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-building="warehouse"]', { hidden: true });
    report.cases.push('With reduced motion, Loïc’s tutorial and the warehouse remain accessible by keyboard.');
    const final = await stats(); report.performance = { drawCalls:+final.drawCalls, triangles:+final.triangles, geometries:+final.geometries, textures:+final.textures, renderSubmitMs:+final.renderSubmitMs };
    assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []); assert.ok(report.requests.every(request => request.method === 'GET'));
    report.passed = true;
  } catch (error) {
    report.failure = error.stack; process.exitCode = 1;
    if (page) await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  } finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
  console.log(JSON.stringify(report));
}
