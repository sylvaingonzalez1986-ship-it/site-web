/** Runs against the existing isolated preview; all business requests are local fixtures. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import { frameVillageSubject } from './fixtures/village-audit-camera.mjs';

const baseline = process.argv.includes('--baseline');
const metricsOnly = process.argv.includes('--metrics-only');
const origin = process.env.VILLAGE_LIFE_ORIGIN ?? 'http://127.0.0.1:3624';
const output = resolve('output/village-life');
const label = baseline ? 'before' : 'after';
await mkdir(output, { recursive: true });
const report = { label, passed: false, timing: 'Actual rendered-frame intervals and CPU render submission; not GPU execution time. Mobile viewports are desktop emulation, not physical phones.', cases: [], errors: [], external: [], performance: [] };
const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox'], userDataDir: resolve(output, `chrome-${label}`) });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/favicon.ico') return void request.respond({ status: 204 });
    if (url.origin === origin && url.pathname === '/api/arena/placard/equipment') return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeRun: true, cashCents: 125000, readyLotCount: 3, availableFlowerCount: 2, curingFlowerCount: 1 }) });
    if (url.origin === origin && url.pathname === '/api/arena/feedback') return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, hasMore: false }) });
    if (url.origin === origin && !url.pathname.startsWith('/api/') || ['data:', 'blob:'].includes(url.protocol)) return void request.continue();
    report.external.push(request.url()); void request.abort();
  });
  await page.setViewport({ width: 1440, height: 1000 });
  const started = performance.now();
  await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('canvas[data-village-ready="true"][data-motion-state="running"][data-render-frames]');
  report.readyMs = performance.now() - started;
  report.renderer = await page.$eval('canvas', node => { const gl = node.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info'); return { userAgent: navigator.userAgent, renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) }; });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
    await page.setViewport(viewport);
    await new Promise(resolve => setTimeout(resolve, 700));
    const samples = await page.evaluate(() => new Promise(resolve => {
      const samples = [], start = performance.now(); let previous = '';
      function sample() { const data = document.querySelector('canvas').dataset;
        if (data.renderFrames !== previous) { previous = data.renderFrames; samples.push({ interval: Number(data.frameInterval), cpu: Number(data.renderSubmitMs) }); }
        if (performance.now() - start < 5000) requestAnimationFrame(sample); else resolve(samples);
      } requestAnimationFrame(sample);
    }));
    const percentile = (values, p) => values.sort((a,b) => a-b)[Math.floor((values.length - 1) * p)];
    const intervals = samples.slice(1).map(s => s.interval), cpu = samples.slice(1).map(s => s.cpu);
    report.performance.push({ viewport, samples: samples.length, medianFps: 1000 / percentile(intervals, .5), frameP95Ms: percentile(intervals, .95), cpuMedianMs: percentile(cpu, .5), cpuP95Ms: percentile(cpu, .95), canvas: await page.$eval('canvas', node => ({ ...node.dataset })), heap: await page.evaluate(() => performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null) });
    await page.screenshot({ path: resolve(output, `${label}-${viewport.width}.png`) });
  }
  report.cases.push('Three viewport captures and 5-second rendered-frame samples, native renderer identity, memory counters');
  if (!baseline && !metricsOnly) {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const stats = () => page.$eval('canvas', node => ({ ...node.dataset }));
    await page.setViewport({ width: 1100, height: 760 });
    await page.goto(`${origin}/?strict=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('canvas[data-motion-state="running"][data-life-boat]');
    await frameVillageSubject(page, 'boat');
    const recorder = await page.screencast({ path: resolve(output, 'fishing-cycle.webm'), ffmpegPath, fps: 15, scale: 0.75 });
    const phases = new Set(), catches = [];
    for (let i = 0; i < 44; i++) {
      const data = await stats(), boat = JSON.parse(data.lifeBoat);
      if (!phases.has(boat.phase)) { phases.add(boat.phase); await page.screenshot({ path: resolve(output, `boat-${boat.phase}.png`) }); }
      if (boat.catchVisible) { if (!catches.length) await page.screenshot({ path: resolve(output, 'boat-visible-catch.png') }); catches.push(boat.phase); }
      await sleep(1000);
    }
    await recorder.stop();
    for (const phase of ['approach', 'lower', 'fishing', 'haul', 'stow', 'depart']) assert.ok(phases.has(phase), `Missing mounted boat phase ${phase}`);
    assert.ok(catches.includes('haul'));
    report.cases.push('Mounted boat slows, lowers line, fishes, raises visible catch, stows and departs; 44-second recording');
    report.fishing = { phases: [...phases], catchObserved: catches.length > 0 };
    const actorRecorder = await page.screencast({ path: resolve(output, 'island-characters.webm'), ffmpegPath, fps: 15, scale: 0.75 });
    for (const id of ['wolf', 'fox', 'weasel', 'breton']) {
      await frameVillageSubject(page, id);
      await sleep(700);
      await page.screenshot({ path: resolve(output, `portrait-${id}.png`) }); await sleep(2500);
    }
    await actorRecorder.stop();
    await page.setViewport({ width: 568, height: 320 });
    await frameVillageSubject(page, 'breton'); await page.screenshot({ path: resolve(output, 'mobile-observe-breton.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.$$eval('[aria-label="Caméra du village"] button', nodes => nodes.every(node => node.getBoundingClientRect().bottom <= innerHeight)), true);
    await page.focus('[data-village-settings] > summary'); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
    assert.equal(await page.$eval('[data-village-settings]', node => !node.open && document.activeElement === node.querySelector('summary')), true);
    await page.click('[data-village-motion-toggle]'); await page.waitForSelector('canvas[data-motion-state="paused"]');
    const paused = await stats(); await sleep(500); const frozen = await stats();
    assert.equal(frozen.motionTime, paused.motionTime); assert.equal(frozen.lifeBoat, paused.lifeBoat); assert.equal(frozen.lifeAnimals, paused.lifeAnimals);
    await page.click('[data-village-motion-toggle]');
    await page.waitForSelector('canvas[data-motion-state="running"]');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.waitForSelector('canvas[data-motion-state="reduced"]');
    const reduced = await stats(); await sleep(300); assert.equal((await stats()).motionTime, reduced.motionTime);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    const hiddenTime = Number((await stats()).motionTime), other = await browser.newPage(); await other.bringToFront();
    await sleep(800); await page.bringToFront(); await other.close();
    assert.ok(Number((await stats()).motionTime) - hiddenTime < 0.3, 'Background time must not be replayed');
    report.cases.push('Settings keyboard/menu, 568×320 close-up, all rigs freeze on pause/reduced motion and return without background catch-up');
    await page.setViewport({ width: 1440, height: 1000 });
    const memory = [];
    for (let mount = 0; mount < 3; mount++) {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('audit:mount-village', { detail: false })));
      await page.waitForSelector('canvas', { hidden: true });
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('audit:mount-village', { detail: true })));
      await page.waitForSelector('canvas[data-motion-state="running"][data-life-animals]');
      await page.click('[aria-label="Recentrer la vue isométrique"]'); await sleep(800);
      const current = await stats();
      assert.ok(JSON.parse(current.lifeAnimals).every(animal => animal.active));
      const before = JSON.parse(current.lifeBoat).time; await sleep(300);
      assert.ok(JSON.parse((await stats()).lifeBoat).time > before, 'Animation survives StrictMode and remount');
      memory.push({ geometries: +current.geometries, textures: +current.textures });
    }
    assert.ok(Math.max(...memory.map(m => m.geometries)) - Math.min(...memory.map(m => m.geometries)) <= 4);
    assert.ok(memory.every(m => m.textures === memory[0].textures));
    report.lifecycleMemory = memory;
    report.cases.push('Three StrictMode scene remounts: all actors resume, renderer geometry/texture counts stay bounded');
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []);
  report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(resolve(output, `${label}${metricsOnly ? '-metrics' : ''}.json`), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report));
