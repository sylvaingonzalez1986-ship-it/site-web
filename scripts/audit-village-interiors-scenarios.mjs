/** Local, intercepted-browser checks for the actual interior components. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { PerspectiveCamera, Vector3 } from 'three';

export async function runInteriorLifecycleAudit({ origin, output }) {
  const report = { passed: false, cases: [], errors: [], requests: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(output, `lifecycle-chrome-${process.pid}`), args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    page = await browser.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    await page.evaluateOnNewDocument(() => {
      window.__interiorLifecycle = { effects: 0, cleanups: 0, ready: 0, unavailable: 0, contexts: [], losses: [] };
      let sequence = 0; const ids = new WeakMap(), original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args) {
        const context = original.apply(this, args);
        if (args[0] === 'webgl2' || args[0] === 'webgl') {
          if (!ids.has(this)) { ids.set(this, ++sequence); this.dataset.lifecycleCanvas = String(sequence); this.addEventListener('webglcontextlost', () => window.__interiorLifecycle.losses.push(ids.get(this))); }
          window.__interiorLifecycle.contexts.push({ canvas: ids.get(this), kind: args[0], returned: !!context, lost: context?.isContextLost() ?? null });
        }
        return context;
      };
    });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/favicon.ico') return void request.respond({ status: 204 });
      if (url.origin === origin && !url.pathname.startsWith('/api/')) return void request.continue();
      report.requests.push(`${request.method()} ${request.url()}`); void request.abort();
    });
    await page.setViewport({ width: 1100, height: 800 }); await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
    const waitReady = async () => {
      await page.waitForFunction(() => document.querySelector('canvas[data-ready="true"]') || document.querySelector('[data-lifecycle-unavailable]'));
      assert.equal(await page.$('[data-lifecycle-unavailable]'), null, 'StrictMode/runtime recreation unexpectedly selected the unavailable fallback');
      await page.waitForSelector('canvas[data-ready="true"]');
      const state = await page.$eval('canvas', node => ({ lost: node.getContext('webgl2').isContextLost(), ...node.dataset }));
      assert.equal(state.lost, false); return state;
    };
    await waitReady();
    assert.equal(await page.evaluate(() => window.__interiorLifecycle.effects), 2, 'Real React.StrictMode must run the initial effect twice');
    const start = await page.$eval('canvas', node => Number(node.dataset.z));
    await page.focus('canvas'); await page.keyboard.down('z'); await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250))); await page.keyboard.up('z');
    assert.ok(await page.$eval('canvas', (node, before) => Number(node.dataset.z) < before - 0.1, start), 'Keyboard movement must work after StrictMode setup');
    assert.equal(await page.$eval('canvas', node => node.getBoundingClientRect().height > 600 && node.getBoundingClientRect().width > 1000), true, 'The new canvas host must fill the scene viewport');
    report.cases.push('Real StrictMode initial setup → cleanup → setup renders successfully on the mounted scene');
    for (let index = 0; index < 4; index++) {
      const previous = await page.$eval('canvas', node => node.dataset.lifecycleCanvas);
      await page.click('[data-lifecycle-resize]');
      await page.waitForFunction(previous => document.querySelector('canvas[data-ready="true"]')?.dataset.lifecycleCanvas !== previous, {}, previous);
      await waitReady();
      assert.equal(await page.$eval('[data-lifecycle-room]', node => node.dataset.lifecycleRoom), index % 2 ? 'starter' : 'legacy');
      const position = await page.$eval('canvas', node => node.dataset.position.split(',').map(Number));
      assert.ok(Number.isFinite(position[0]) && position[1] === 1.65 && Number.isFinite(position[2]));
    }
    report.cases.push('Actual starter 10×10 and historical 40×25 snapshots resize the mounted room repeatedly without a lost renderer');
    const previousWidth = await page.$eval('canvas', node => node.width);
    await page.setViewport({ width: 640, height: 860 });
    await page.waitForFunction(previous => document.querySelector('canvas')?.width !== previous, {}, previousWidth);
    await waitReady();
    report.cases.push('Viewport resizing retains the live canvas and updates its actual drawing buffer');
    for (let index = 0; index < 6; index++) {
      const node = await page.$('canvas');
      await page.click('[data-lifecycle-toggle]'); await page.waitForSelector('[data-lifecycle-outside]');
      const count = await node.evaluate(element => element.dataset.renderCount);
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 90)));
      assert.equal(await node.evaluate(element => element.dataset.renderCount), count, 'Detached scenes must stop rendering');
      await node.dispose(); await page.click('[data-lifecycle-toggle]'); await waitReady();
    }
    assert.equal(await page.evaluate(() => window.__interiorLifecycle.contexts.some(context => context.lost)), false, 'A new runtime must never receive an already lost context');
    report.cases.push('Six enter/exit cycles retain rendering, dispose detached scenes and stop their animation frames');
    await page.screenshot({ path: resolve(output, 'lifecycle-ready.png') });
    await page.$eval('canvas', node => node.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForSelector('[data-lifecycle-unavailable]');
    report.cases.push('Actual unexpected context loss selects the accessible fallback');
    report.lifecycleNormal = await page.evaluate(() => window.__interiorLifecycle);
    await page.evaluateOnNewDocument(() => {
      const prototype = WebGL2RenderingContext.prototype, original = prototype.getShaderPrecisionFormat;
      prototype.getShaderPrecisionFormat = () => null;
      window.__restoreShaderPrecision = () => { prototype.getShaderPrecisionFormat = original; };
    });
    await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForSelector('[data-lifecycle-unavailable]');
    assert.deepEqual(report.consoleErrors, [], 'Null shader precision must select the fallback before Three emits a constructor error');
    report.lifecycleNullPrecision = await page.evaluate(() => window.__interiorLifecycle);
    await page.evaluate(() => window.__restoreShaderPrecision());
    await page.click('[data-lifecycle-toggle]'); await page.waitForSelector('[data-lifecycle-outside]');
    await page.click('[data-lifecycle-toggle]'); await waitReady();
    report.cases.push('Initially null shader precision uses the fallback without a Three console error and recovers after restoring the real API');
    assert.deepEqual(report.requests, []); assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []);
    report.passed = true;
  } catch (error) { report.failure = error.stack; if (page) await page.screenshot({ path: resolve(output, 'lifecycle-failure.png') }).catch(() => {}); throw error; }
  finally {
    report.lifecycle = await page?.evaluate(() => window.__interiorLifecycle).catch(() => null);
    await writeFile(resolve(output, 'report-lifecycle.json'), JSON.stringify(report, null, 2)); await browser?.close();
  }
  console.log(JSON.stringify(report));
}

export async function runInteriorAudit({ origin, output }) {
  const native = process.argv.includes('--native-gpu'), benchmark = process.argv.includes('--interiors-benchmark'), mobileOnly = process.argv.includes('--interiors-mobile');
  const builder = process.argv.includes('--interiors-builder');
  const report = { passed: false, backend: 'Actual Three interiors and React controller; local in-memory warehouse GET/PATCH fixtures only. Actual WebGL renderer identity is recorded; timings are observations, not physical mobile benchmarks.', cases: [], errors: [], external: [], performance: [], patches: [] };
  report.timing = 'frameMs/renderSubmitMs measure CPU renderer submission, not GPU execution; frameInterval/fps are measured between actual rendered frames.';
  let browser, page, snapshot, mode = 'success';
  const receipts = new Map();
  try {
    browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(output, `audit-chrome-${process.pid}`), args: ['--no-sandbox', ...(native ? [] : ['--enable-unsafe-swiftshader'])] });
    page = await browser.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', error => report.errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      const json = (status, value) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(value) });
      if (url.pathname === '/favicon.ico') return void request.respond({ status: 204 });
      if (url.origin === origin && url.pathname === '/api/arena/placard/equipment') return void json(200, { activeRun: false, cashCents: 100000000, readyLotCount: 0, availableFlowerCount: 0, curingFlowerCount: 0 });
      if (url.origin === origin && url.pathname === '/api/arena/placard/warehouse') {
        if (request.method() === 'GET') return void json(snapshot ? 200 : 503, snapshot ?? { error: 'Fixture not initialised.' });
        if (request.method() === 'PATCH') {
          const body = JSON.parse(request.postData()); report.patches.push(body);
          if (mode === 'conflict') { mode = 'success'; return void json(409, { error: 'Le plan a changé. Recette locale.' }); }
          if (receipts.has(body.requestKey)) return void json(200, receipts.get(body.requestKey));
          if (body.expectedRevision !== snapshot.revision) return void json(409, { error: 'Révision périmée.' });
          const nextState = await page.evaluate(async ({ previous, next }) => (await import('/src/lib/kanab-quest-warehouse.ts')).getKqWarehouseQuote(next, previous).nextState, { previous: snapshot.state, next: body.state });
          snapshot = { ...snapshot, state: nextState, revision: snapshot.revision + 1, cashCents: snapshot.cashCents - body.expectedCostCents };
          receipts.set(body.requestKey, structuredClone(snapshot));
          if (mode === 'ambiguous') { mode = 'success'; return void request.abort('failed'); }
          return void json(200, snapshot);
        }
      }
      if ((url.origin === origin && !url.pathname.startsWith('/api/')) || ['data:', 'blob:'].includes(url.protocol)) return void request.continue();
      report.external.push(`${request.method()} ${request.url()}`); void request.abort();
    });
    await page.setViewport(mobileOnly ? { width: 320, height: 760, isMobile: true, hasTouch: true } : { width: 1440, height: 1000 });
    await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForSelector('canvas[data-village-ready="true"]');
    snapshot = await page.evaluate(async () => {
      const { createKqWarehouseStarter, validateKqWarehouseState } = await import('/src/lib/kanab-quest-warehouse.ts');
      const state = createKqWarehouseStarter();
      state.spatial = { version: 1 }; state.preparedAreaM2 = 100;
      state.zones = [{ ...state.zones[0], id: 'zone-a', name: 'Culture A', x: 1, y: 2, width: 2, height: 1 }, { ...state.zones[0], id: 'zone-b', name: 'Culture B', x: 6, y: 2, width: 2, height: 2 }];
      state.serviceZones = state.serviceZones.map((zone, index) => ({ ...zone, id: index ? 'storage' : 'drying', x: index ? 6 : 1, y: 6, width: 1, height: index ? 1 : 2 }));
      state.equipment = state.equipment.map(item => ({ ...item, quantity: 100 }));
      const errors = validateKqWarehouseState(state); if (errors.length) throw new Error(errors.join(' '));
      return { state, revision: 7, cashCents: 100000000, activeRun: false, legacyActiveRun: false, activeRuns: [], completedRuns: [], migrationCreditCents: 0, stockGrams: 0, salesGramsPerDay: null, storageReservedGrams: 0, reservedHarvestGrams: 0, context: { available: true } };
    });
    const canvas = '[data-interior] canvas';
    const stats = () => page.$eval(canvas, node => ({ ...node.dataset }));
    async function enter(id) {
      await page.waitForSelector('canvas[data-village-ready="true"]');
      await page.focus(`[data-village-building="${id}"]`); await page.keyboard.press('Enter');
      await page.waitForSelector(`[data-enter-interior="${id}"]`);
      await page.evaluate(async () => { await Promise.all((document.querySelector('[data-building]')?.getAnimations({ subtree: true }) ?? []).map(animation => animation.finished.catch(() => {}))); });
      await page.click(`[data-enter-interior="${id}"]`);
      await page.waitForSelector(`[data-interior="${id}"] canvas[data-ready="true"]`);
    }
    async function clickText(text) { await page.locator(`[data-interior] button::-p-text(${text})`).click(); }
    async function leave() { await clickText('Au village'); await page.waitForSelector('[data-interior]', { hidden: true }); await page.waitForSelector('canvas[data-village-ready="true"]'); }
    async function select(id) { await page.select('[data-interior] select[aria-label="Objet du lieu"]', id); }
    async function floorPoint(x, z, y = 0) {
      const rect = await page.$eval(canvas, node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, zoom: Number(node.dataset.planZoom ?? 1), pan: (node.dataset.planPan ?? '0,0').split(',').map(Number) }; });
      const aspect = rect.width / rect.height, camera = new PerspectiveCamera(58, aspect, 0.06, 150);
      camera.position.set(rect.pan[0], Math.max(16, 13 / aspect) / (2 * Math.tan(58 * Math.PI / 360)) * 1.12 / rect.zoom, rect.pan[1]);
      camera.up.set(0, 0, -1); camera.lookAt(rect.pan[0], 0, rect.pan[1]); camera.updateMatrixWorld();
      const point = new Vector3(x, y, z).project(camera);
      return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
    }
    async function wait(milliseconds) { await page.evaluate(ms => new Promise(resolve => setTimeout(resolve, ms)), milliseconds); }
    async function hold(key, duration) { await page.focus(canvas); await page.keyboard.down(key); await wait(duration); await page.keyboard.up(key); await wait(100); }
    async function holdUntil(key, predicate, timeout = 22000) {
      await page.focus(canvas); await page.keyboard.down(key);
      try { await page.waitForFunction(predicate, { timeout }); }
      catch (error) { report.movementFailure = await stats(); throw error; }
      finally { await page.keyboard.up(key); }
      await wait(100);
    }
    const buildMenu = 'dialog[data-warehouse-build-menu][open]';
    async function closeBuild() { await page.click(`${buildMenu} [aria-label="Fermer"]`); await page.waitForSelector(buildMenu, { hidden: true }); }
    async function cellPopup(x, y) {
      const point = await floorPoint(x + .5 - 5, y + .5 - 5); await page.mouse.click(point.x, point.y); await page.waitForSelector(buildMenu);
    }
    async function keyboardPlacement(x, y) {
      await closeBuild();
      await page.locator('[data-interior] summary::-p-text(Choisir une case au clavier)').click();
      for (const [name, value] of [['column', x + 1], ['row', y + 1]]) await page.$eval(`[name="${name}"]`, (node, value) => { node.value = String(value); }, value);
      await page.locator('[data-interior] button::-p-text(Choisir cette case)').click(); await page.waitForSelector(buildMenu);
    }
    async function begin(id = 'zone-a') {
      const item = await page.evaluate(async ({ id, state }) => (await import('/src/lib/kanab-quest-warehouse-spatial.ts')).getKqWarehouseSpatialLayout(state).items.find(item => item.id === id), { id, state: snapshot.state });
      const point = await floorPoint(item.x, item.z, .5); await page.mouse.click(point.x, point.y); await page.waitForSelector(`${buildMenu}[data-build-mode="occupied"]`);
      await page.click(`${buildMenu} [data-build-edit]`); await page.waitForSelector('[data-interior-draft="true"]');
    }
    async function save() { await page.click(`${buildMenu} [data-interior-save]`); await page.waitForSelector('[data-interior-draft]', { hidden: true }); await page.waitForSelector(buildMenu, { hidden: true }); }
    async function reloadDraft() {
      await page.locator(`${buildMenu} button::-p-text(Recharger le plan enregistré)`).click();
      const reload = 'dialog[open]:not([data-warehouse-build-menu])'; await page.waitForSelector(reload);
      await page.locator(`${reload} button::-p-text(Recharger)`).click(); await page.waitForSelector(reload, { hidden: true });
      await page.waitForSelector('[data-interior-draft]', { hidden: true });
      await closeBuild();
    }

    async function rendererIdentity() {
      return page.$eval(canvas, node => {
        const gl = node.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { userAgent: navigator.userAgent, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR) };
      });
    }
    if (builder) {
      const menu = 'dialog[data-warehouse-build-menu][open]';
      const initialSnapshot = structuredClone(snapshot);
      const activate = selector => mobileOnly ? page.tap(selector) : page.click(selector);
      const closeMenu = async () => { await activate(`${menu} [aria-label="Fermer"]`); await page.waitForSelector(menu, { hidden: true }); };
      const cancelMenu = async () => { await activate(`${menu} [data-build-cancel]`); await page.waitForSelector(menu, { hidden: true }); };
      const confirmMenu = async () => { await activate(`${menu} [data-interior-save]`); await page.waitForSelector(menu, { hidden: true }); await page.waitForSelector('[data-interior-draft]', { hidden: true }); };
      const toggleBuild = async () => { await page.click('[data-interior-build-toggle]'); await wait(100); };
      async function pick(x, y, mode = 'choose') {
        const point = await floorPoint(x + 0.5 - 5, y + 0.5 - 5);
        assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point), 'CANVAS', 'The chosen cell must be exposed to a real pointer/touch');
        if (mobileOnly) { await page.touchscreen.tap(point.x, point.y); await wait(350); } else await page.mouse.click(point.x, point.y);
        await page.waitForSelector(`${menu}[data-build-mode="${mode}"]`);
      }
      const stateItem = (state, kind) => kind === 'partition' ? state.partitions.at(-1) : kind === 'culture' ? state.zones.at(-1) : state.serviceZones.at(-1);
      async function keyboardCell(x, y) {
        await page.locator('[data-interior] summary::-p-text(Choisir une case au clavier)').click();
        for (const [name, value] of [['column', x + 1], ['row', y + 1]]) {
          await page.$eval(`[name="${name}"]`, (node, value) => { node.value = String(value); }, value);
        }
        await page.locator('[data-interior] button::-p-text(Choisir cette case)').click(); await page.waitForSelector(menu);
      }
      await enter('warehouse'); report.renderer = await rendererIdentity(); await toggleBuild();
      assert.equal(await page.$eval(canvas, node => node.dataset.overhead), 'true');
      assert.equal(await page.$('[aria-label="Activités du lieu"]'), null);
      const suffix = mobileOnly ? 'mobile' : 'desktop';
      await page.screenshot({ path: resolve(output, `builder-fullplan-${suffix}.png`) });
      await page.click('[aria-label="Agrandir le plan"]'); await page.click('[aria-label="Agrandir le plan"]'); await wait(100);
      assert.equal((await stats()).planZoom, '2');
      const panStart = await page.$eval(canvas, node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      if (mobileOnly) {
        const session = await page.createCDPSession();
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...panStart, id: 4 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: panStart.x - 70, y: panStart.y - 70, id: 4 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(panStart.x, panStart.y); await page.mouse.down(); await page.mouse.move(panStart.x - 70, panStart.y - 70, { steps: 8 }); await page.mouse.up();
      }
      await wait(100); assert.notEqual((await stats()).planPan, '0.000,0.000'); assert.equal(await page.$(menu), null);
      assert.equal(await page.$$eval('[aria-label="Vue du plan"] button', nodes => nodes.every(node => node.getBoundingClientRect().height >= 44 && node.getBoundingClientRect().width >= 44)), true);
      await page.screenshot({ path: resolve(output, `builder-zoom-pan-${suffix}.png`) });
      report.cases.push(`${suffix}: accessible 44px controls zoom the plan to 2×, single-pointer drag pans it without opening a build menu`);
      for (const [kind, x, y] of [['culture', 8, 8], ['storage', 8, 5], ['drying', 0, 8]]) {
        const before = report.patches.length;
        await pick(x, y);
        assert.deepEqual(await page.$$eval(`${menu} [data-build-choice]`, nodes => nodes.map(node => node.dataset.buildChoice)), ['culture', 'storage', 'drying', 'partition']);
        assert.match(await page.$eval(menu, node => node.textContent), new RegExp(`colonne ${x + 1}, ligne ${y + 1}`));
        if (kind === 'culture') await page.screenshot({ path: resolve(output, `builder-selected-popup-${suffix}.png`) });
        await activate(`${menu} [data-build-choice="${kind}"]`); await page.waitForSelector(`${menu}[data-build-mode="preview"]`);
        assert.equal(report.patches.length, before);
        assert.match(await page.$eval(menu, node => node.textContent), /À payer maintenant/);
        assert.equal(await page.$eval(`${menu} [data-interior-save]`, node => node.disabled), false);
        await confirmMenu(); assert.equal(report.patches.length, before + 1);
        const item = stateItem(snapshot.state, kind); assert.equal(item.x, x); assert.equal(item.y, y); assert.equal(item.width, 1); assert.equal(item.height, 1);
        await pick(x, y, 'occupied'); assert.ok(await page.$(`${menu} [data-build-edit]`)); await closeMenu();
        if (kind === 'culture') { await page.focus('[aria-label="Recentrer le plan"]'); await page.keyboard.press('Enter'); await wait(100); assert.equal((await stats()).planZoom, '1'); assert.equal((await stats()).planPan, '0.000,0.000'); }
      }
      report.cases.push(`${suffix}: real ${mobileOnly ? 'touch' : 'ray'} cells offer all four choices; culture/storage/drying save exactly at the chosen far cells after a visible quote and explicit confirmation`);
      let before = report.patches.length;
      await pick(4, 5); await page.click(`${menu} [data-build-choice="partition"]`);
      const firstFrame = Number((await stats()).renderCount);
      await page.click(`${menu} [aria-label="Allonger la paroi d’un mètre"]`); await page.click(`${menu} [aria-label="Allonger la paroi d’un mètre"]`);
      await page.waitForFunction(() => document.querySelector('[data-build-wall-length]')?.textContent === '3 m');
      assert.ok(Number((await stats()).renderCount) > firstFrame, 'Visible suspended preview must repaint when wall length changes');
      const paused = await stats(); await wait(200); assert.equal((await stats()).renderCount, paused.renderCount, 'A modal preview update must not start continuous rendering');
      await page.click(`${menu} [data-build-rotate]`); await page.click(`${menu} [data-build-rotate]`);
      await page.screenshot({ path: resolve(output, `builder-wall-popup-${suffix}.png`) });
      await cancelMenu(); assert.equal(report.patches.length, before);
      await pick(4, 5); await page.click(`${menu} [data-build-choice="partition"]`);
      for (let n = 0; n < 2; n++) await page.click(`${menu} [aria-label="Allonger la paroi d’un mètre"]`);
      await confirmMenu(); assert.equal(report.patches.length, before + 1);
      assert.deepEqual({ ...snapshot.state.partitions.at(-1), id: 'wall' }, { id: 'wall', x: 4, y: 5, axis: 'x', length: 3 });
      const wallId = snapshot.state.partitions.at(-1).id;
      assert.equal(await page.$$eval('[aria-label="Vue du plan"] button', nodes => nodes.every(node => {
        const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === node || node.contains(hit);
      })), true, 'Zoom controls must remain exposed after the save notice enlarges the toolbar');
      await page.screenshot({ path: resolve(output, `builder-wall-plan-${suffix}.png`) });
      await pick(4, 5, 'occupied'); await page.click(`${menu} [data-build-edit]`); await closeMenu();
      await keyboardCell(6, 2); await page.waitForSelector(`${menu} [data-build-invalid]`);
      assert.equal(await page.$eval(`${menu} [data-interior-save]`, node => node.disabled), true); await cancelMenu();
      report.cases.push(`${suffix}: wall length grows by metres, rotations update the real ghost while paused, cancel writes nothing, confirmation saves exact centred geometry, occupied cells edit and overlap disables confirmation`);
      if (!mobileOnly) {
        await toggleBuild();
        await holdUntil('z', () => Number(document.querySelector('[data-interior] canvas').dataset.z) < 0.9);
        await hold('z', 450); assert.ok(Number((await stats()).z) >= 0.779);
        await page.screenshot({ path: resolve(output, 'builder-walls-fps.png') });
        await leave(); await enter('warehouse'); await toggleBuild();
        assert.ok(snapshot.state.partitions.some(wall => wall.id === wallId));
        report.cases.push('Confirmed 12 cm wall blocks actual FPS movement and survives leaving/reloading the room');
      }
      before = report.patches.length;
      await pick(4, 5, 'occupied'); await page.click(`${menu} [data-build-remove-wall]`); await confirmMenu();
      assert.equal(report.patches.length, before + 1); assert.equal(snapshot.state.partitions.length, 0);
      assert.equal(snapshot.state.zones.length, initialSnapshot.state.zones.length + 1); assert.equal(snapshot.state.serviceZones.length, initialSnapshot.state.serviceZones.length + 2);
      report.cases.push(`${suffix}: explicit wall removal preserves all culture and service zones`);
      if (!mobileOnly) {
        await leave();
        snapshot.state = { ...initialSnapshot.state, serviceZones: [], zones: [{ ...initialSnapshot.state.zones[0], x: 4, y: 4, width: 1, height: 1 }], partitions: [
          { id: 'top', x: 2, y: 2, axis: 'x', length: 6 }, { id: 'bottom', x: 2, y: 6, axis: 'x', length: 6 }, { id: 'left', x: 2, y: 2, axis: 'y', length: 5 }, { id: 'right-top', x: 7, y: 2, axis: 'y', length: 2 }, { id: 'right-bottom', x: 7, y: 5, axis: 'y', length: 2 },
        ] };
        await enter('warehouse'); await toggleBuild(); await pick(7, 4); await page.click(`${menu} [data-build-choice="partition"]`); await page.click(`${menu} [data-build-rotate]`);
        await page.waitForSelector(`${menu} [data-build-invalid]`); assert.match(await page.$eval(`${menu} [data-build-invalid]`, node => node.textContent), /passage/);
        assert.equal(await page.$eval(`${menu} [data-interior-save]`, node => node.disabled), true); await cancelMenu();
        report.cases.push('Closing the last one-metre doorway around an occupied room shows the real accessibility error and blocks confirmation');
      }
      assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []); report.passed = true; console.log(JSON.stringify({ passed: true, cases: report.cases, patches: report.patches.length })); return;
    }
    if (benchmark) {
      report.backend = `Headless Chromium ${native ? 'without software fallback opt-in' : 'with software fallback allowed'}; actual renderer identity recorded; no physical mobile benchmark.`;
      for (const id of ['warehouse', 'bank']) {
        await enter(id); report.renderer = await rendererIdentity();
        await page.evaluate(() => {
          window.__interiorMeasure = { active: true, samples: [], last: '' };
          const sample = () => {
            const m = window.__interiorMeasure, node = document.querySelector('[data-interior] canvas');
            if (!m.active) return;
            if (node?.dataset.renderCount !== m.last) { m.last = node.dataset.renderCount; m.samples.push({ interval: Number(node.dataset.frameInterval), cpu: Number(node.dataset.renderSubmitMs ?? node.dataset.frameMs) }); }
            requestAnimationFrame(sample);
          }; requestAnimationFrame(sample);
        });
        await hold('z', 3000);
        const samples = await page.evaluate(() => { window.__interiorMeasure.active = false; return window.__interiorMeasure.samples.slice(2); });
        const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)] ?? null;
        const intervals = samples.map(sample => sample.interval).filter(value => value > 0), cpu = samples.map(sample => sample.cpu);
        report.performance.push({ scene: id, viewport: page.viewport(), requestedQuality: 'auto', durationMs: 3000, samples: samples.length, frameIntervalMedianMs: percentile(intervals, 0.5), frameIntervalP95Ms: percentile(intervals, 0.95), medianFps: intervals.length ? 1000 / percentile(intervals, 0.5) : null, cpuSubmissionMedianMs: percentile(cpu, 0.5), cpuSubmissionP95Ms: percentile(cpu, 0.95), finalCanvas: await stats() });
        await page.screenshot({ path: resolve(output, `${id}-fps-${native ? 'native' : 'software'}.png`) });
        if (id === 'bank') {
          await page.evaluate(async () => {
            const THREE = await import('/node_modules/three/build/three.module.js');
            const { createInteriorObjectArt, disposeInteriorArt } = await import('/src/components/placard/world/interior-art.ts');
            const scene = new THREE.Scene(); scene.background = new THREE.Color('#f4dfb8');
            scene.add(new THREE.HemisphereLight('#fff7de', '#ad9a74', 2.4));
            const light = new THREE.DirectionalLight('#fff2cf', 2.3); light.position.set(-4, 9, 6); scene.add(light);
            const host = createInteriorObjectArt({ id: 'review-host', kind: 'character', label: 'Accueil', x: 0, z: 0, width: 0.65, depth: 0.65, rotation: 0 }); scene.add(host);
            const camera = new THREE.PerspectiveCamera(38, 600 / 700, 0.06, 30); camera.position.set(1.3, 1.3, 2.4); camera.lookAt(0, 0.95, 0);
            const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(600, 700); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
            renderer.domElement.dataset.hostReview = 'true'; Object.assign(renderer.domElement.style, { position: 'fixed', top: '0', left: '0', zIndex: '10000' }); document.body.append(renderer.domElement); renderer.render(scene, camera);
            window.__hostReviewCleanup = () => { renderer.domElement.remove(); disposeInteriorArt(host); renderer.dispose(); renderer.forceContextLoss(); };
          });
          await (await page.$('[data-host-review]')).screenshot({ path: resolve(output, 'host-model-review.png') });
          await page.evaluate(() => window.__hostReviewCleanup());
        }
        await leave();
      }
      report.passed = true; console.log(JSON.stringify(report)); return;
    }

    if (!mobileOnly) {
    await enter('warehouse');
    report.renderer = await rendererIdentity();
    assert.equal(await page.$$eval('[aria-label="Objet du lieu"] option', nodes => nodes.filter(node => /^zone-|^(drying|storage)$/.test(node.value)).length), 4);
    await page.screenshot({ path: resolve(output, 'warehouse-fps.png') });
    const start = await stats();
    await hold('z', 500); const forward = await stats(); assert.ok(Number(forward.z) < Number(start.z) - 0.1);
    report.performance.push({ scene: 'warehouse-active', ...forward });
    await hold('q', 350); assert.ok(Number((await stats()).x) < Number(forward.x));
    await hold('d', 350); await hold('s', 500);
    const rect = await page.$eval(canvas, node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.mouse.move(rect.x + rect.width * 0.4, rect.y + rect.height * 0.42); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.4 + 70, rect.y + rect.height * 0.42 + 30, { steps: 8 }); await page.mouse.up();
    const looked = await stats(); assert.notEqual(looked.yaw, '0.0000'); assert.notEqual(looked.pitch, '0.0000');
    await clickText('Activer la souris'); await wait(200);
    const pointerLock = await page.evaluate(() => !!document.pointerLockElement); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => !!document.pointerLockElement), false);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await wait(100); const hidden = await stats();
    await page.$eval(canvas, node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true })));
    await wait(200); assert.equal((await stats()).renderCount, hidden.renderCount);
    await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    report.cases.push(`Warehouse uses four real placed fixtures; ZQSD moves, drag look changes yaw/pitch; optional pointer lock ${pointerLock ? 'acquired and Escape released' : 'unavailable, drag fallback verified'}`);
    // Re-enter resets yaw for deterministic world-relative collision checks.
    await leave(); await enter('warehouse');
    await holdUntil('d', () => Number(document.querySelector('[data-interior] canvas').dataset.x) > 2.45);
    await holdUntil('z', () => Number(document.querySelector('[data-interior] canvas').dataset.z) < -0.68);
    const obstacle = await stats(); await hold('z', 450); const stopped = await stats();
    assert.ok(Number(stopped.z) >= -0.79); assert.ok(Math.abs(Number(stopped.z) - Number(obstacle.z)) < 0.15);
    await hold('d', 700); assert.ok(Number((await stats()).x) > Number(stopped.x) + 0.5);
    await holdUntil('d', () => Number(document.querySelector('[data-interior] canvas').dataset.x) > 6.1);
    await hold('d', 500); assert.ok(Number((await stats()).x) <= 6.281);
    report.cases.push('Player stops at the exact equipment footprint, slides sideways and cannot cross the room wall; fixed eye height remains 1.65 m');

    await clickText('Aménager'); await clickText('Vue de dessus'); await wait(150);
    const objectPoint = await floorPoint(-3, -2.5, 0.8); await page.mouse.click(objectPoint.x, objectPoint.y);
    assert.equal(await page.$eval('[aria-label="Objet du lieu"]', node => node.value), 'zone-a');
    await clickText('Déplacer / tourner');
    const before = report.patches.length;
    await clickText('Tourner 90°');
    const placementPoint = await floorPoint(-2.5, 1); await page.mouse.click(placementPoint.x, placementPoint.y);
    assert.equal(Number(await page.$eval('[aria-label="Position X"]', node => node.value)), -2.5);
    assert.equal(Number(await page.$eval('[aria-label="Position Z"]', node => node.value)), 1);
    await page.waitForSelector('[data-interior-placement-valid="true"]');
    await page.screenshot({ path: resolve(output, 'warehouse-overhead.png') });
    await clickText('Au village'); await page.waitForSelector('dialog[open]');
    await page.waitForSelector(`${canvas}[data-suspended="true"]`);
    const paused = await stats(); await page.$eval(canvas, node => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true })));
    await wait(250); assert.equal((await stats()).renderCount, paused.renderCount);
    await page.locator('dialog[open] button::-p-text(Revenir)').click(); await page.waitForSelector('dialog[open]', { hidden: true });
    await clickText('Annuler l’aperçu'); assert.equal(report.patches.length, before);
    await begin();
    await page.click('[aria-label="Position X"]'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('-2'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => Number(document.querySelector('[aria-label="Position X"]').value) === -2);
    await field('Position X', 2); await field('Position Z', -2);
    await page.waitForSelector('[data-interior-placement-valid="false"]');
    assert.equal(await page.$eval('[data-interior-save]', node => node.disabled), true); assert.equal(report.patches.length, before);
    await field('Position X', -2.5); await field('Position Z', 1); await clickText('Tourner 90°');
    await page.waitForSelector('[data-interior-placement-valid="true"]');
    await save(); assert.equal(report.patches.length, before + 1);
    assert.equal(snapshot.state.zones[0].rotation, 90); assert.equal(snapshot.state.zones.length, 2);
    const saved = structuredClone(snapshot.state.zones[0]);
    await leave(); await enter('warehouse'); await select('zone-a');
    await clickText('Aménager'); await begin();
    assert.equal(Number(await page.$eval('[aria-label="Position X"]', node => node.value)), saved.x + saved.width / 2 - 5);
    await clickText('Annuler l’aperçu');
    report.cases.push('Overhead move/rotate preview, modal suspension, cancel with zero PATCH, overlap blocked, one explicit confirmation and persisted return/reload');

    await begin(); await field('Position Z', 3); mode = 'conflict'; await page.click('[data-interior-save]');
    await page.waitForSelector('[data-interior] [role="alert"]'); assert.ok(await page.$('[data-interior-draft]'));
    assert.equal(await page.$eval('[data-interior-save]', node => node.disabled), true); await reloadDraft();
    report.cases.push('409 preserves the draft, disables another stale confirmation and reloads the authoritative plan through an explicit dialog');
    await begin(); await field('Position Z', 3); mode = 'ambiguous'; const ambiguousStart = report.patches.length;
    await page.click('[data-interior-save]'); await page.waitForFunction(() => document.querySelector('[data-interior-save]')?.textContent.includes('réessayer'));
    assert.ok(await page.$('[data-interior-draft]')); await page.click('[data-interior-save]'); await page.waitForSelector('[data-interior-draft]', { hidden: true });
    assert.equal(report.patches.length, ambiguousStart + 2);
    assert.equal(report.patches.at(-1).requestKey, report.patches.at(-2).requestKey);
    assert.deepEqual(report.patches.at(-1).state, report.patches.at(-2).state);
    report.cases.push('Lost successful response keeps the preview and retries the identical request key/body; local receipt applies the mutation once');
    await page.locator('[data-interior] summary::-p-text(Installer une zone)').click();
    await clickText('Prévisualiser l’installation'); await page.waitForSelector('[data-interior-placement-valid="true"]');
    const count = snapshot.state.zones.length; await save(); assert.equal(snapshot.state.zones.length, count + 1);
    report.cases.push('New culture zone uses a valid free position, shows the quote, and saves only after explicit confirmation');
    await leave();

    for (const id of ['bank', 'office', 'market', 'missions', 'arena', 'collection', 'shop']) {
      await enter(id);
      const room = await page.evaluate(async id => (await import('/src/components/placard/world/interior-rooms.ts')).createInteriorRoom(id), id);
      for (const object of room.objects.filter(object => object.href)) {
        await select(object.id); await clickText('Ouvrir les actions');
        assert.equal(await page.evaluate(() => window.__villageNavigations.at(-1)), object.href);
      }
      if (id === 'bank') {
        await page.screenshot({ path: resolve(output, 'bank-fps.png') });
        await holdUntil('z', () => Number(document.querySelector('[data-interior] canvas').dataset.z) < -4.1);
        await hold('z', 350); assert.ok(Number((await stats()).z) >= -4.281);
        report.performance.push({ scene: 'bank-active', ...await stats() });
      }
      if (id === 'missions') {
        await hold('z', 1100);
        const previousNavigations = await page.evaluate(() => window.__villageNavigations.length);
        await page.focus(canvas); await page.keyboard.press('e');
        await page.waitForFunction(previous => window.__villageNavigations.length > previous, {}, previousNavigations);
        assert.equal(await page.evaluate(() => window.__villageNavigations.at(-1)), '/arene/placard?view=missions');
      }
      await leave();
    }
    report.cases.push('All eight enter/return transitions use actual room geometry; every furniture activity retains its exact existing application URL');
    report.desktopPassed = true;
    await writeFile(resolve(output, 'report-desktop.json'), JSON.stringify({ ...report, passed: true }, null, 2));
    }

    if (!mobileOnly) {
      await page.setViewport({ width: 320, height: 760, isMobile: true, hasTouch: true });
      await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
    }
    await enter('warehouse'); await page.screenshot({ path: resolve(output, 'mobile-fps.png') });
    report.renderer = await rendererIdentity();
    const mobileStart = await stats();
    const touch = await page.createCDPSession();
    const control = await page.$eval('[aria-label="Avancer"]', node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...control, id: 1 }] }); await wait(450);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(100);
    assert.ok(Number((await stats()).z) < Number(mobileStart.z));
    const beforeLook = (await stats()).yaw;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 210, id: 2 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 170, y: 230, id: 2 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(100);
    assert.notEqual((await stats()).yaw, beforeLook);
    assert.equal(await page.$eval('[data-interior]', node => node.scrollWidth <= innerWidth), true);
    await clickText('Aménager'); await clickText('Vue de dessus'); await begin();
    report.mobileOverheadLayout = await page.$eval('[data-interior]', node => {
      const canvas = node.querySelector('canvas').getBoundingClientRect(), panel = node.querySelector('[aria-label="Activités du lieu"]').getBoundingClientRect();
      return { canvas: { top: canvas.top, bottom: canvas.bottom, width: canvas.width, height: canvas.height }, panel: { top: panel.top, bottom: panel.bottom, width: panel.width, height: panel.height } };
    });
    assert.ok(report.mobileOverheadLayout.canvas.height >= 200);
    assert.ok(report.mobileOverheadLayout.canvas.bottom <= report.mobileOverheadLayout.panel.top + 4);
    await page.screenshot({ path: resolve(output, 'mobile-overhead.png') }); await clickText('Annuler l’aperçu');
    await page.locator('[data-interior] summary::-p-text(Commandes et qualité)').click();
    await page.select('[data-interior] details select', 'low'); await page.waitForSelector(`${canvas}[data-quality="low"]`);
    assert.ok(Number((await stats()).dpr) <= 1); report.performance.push({ scene: 'mobile-low-static', ...await stats() });
    await page.$eval(canvas, node => node.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => document.querySelector('[data-interior] [role="alert"]')?.textContent.includes('indisponible'));
    await select('workshop'); await clickText('Ouvrir les actions');
    assert.equal(await page.evaluate(() => window.__villageNavigations.at(-1)), '/arene/placard?view=workshop&section=processing');
    report.cases.push('320 px real touch movement, readable edit controls, explicit reduced graphics, and usable action fallback after WebGL context loss');
    assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack;
    if (page) { report.failureScreen = await page.evaluate(() => document.querySelector('[data-interior]')?.textContent ?? document.body.textContent).catch(() => 'unavailable'); await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {}); }
    throw error;
  }
  finally { await writeFile(resolve(output, builder ? `report-builder-${mobileOnly ? 'mobile' : 'desktop'}.json` : benchmark ? `benchmark-${native ? 'native' : 'software'}.json` : mobileOnly ? 'report-mobile.json' : 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); }
  console.log(JSON.stringify(report));
}
