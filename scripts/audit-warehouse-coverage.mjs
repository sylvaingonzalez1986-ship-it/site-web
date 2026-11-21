// Real perspective editor and shop, with a browser-local warehouse API.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const output = resolve('output/warehouse-coverage');
await mkdir(output, { recursive: true });
const fixture = (await readFile('scripts/audit-placard-warehouse-v4.mjs', 'utf8'))
  .split("if(process.argv.includes('--preview'))")[0]
  .replace("'output/warehouse-v4'", "'output/warehouse-coverage'")
  .replace('?? 3248', '?? 3394')
  .replace('export default function Link', 'export const useLinkStatus=()=>({pending:false}); export default function Link')
  .replace('createKqWarehouseStarter,getKqWarehouseQuote', 'createKqWarehouseStarter,createKqWarehouseEmpty,getKqWarehouseQuote')
  .replace('window.__closeCount=0;', `window.__closeCount=0;
    if (!sessionStorage.getItem(persistenceKey)) {
      const previous = window.__snapshot.state;
      if (query.has('mountedFixtures')) window.__snapshot.cashCents = 2_500_000;
      const zones = previous.zones.map(zone => ({ ...zone, width: 4, height: 3 }));
      const plan = query.has('multiAir') ? {
        ...previous, airPlacements: [],
        zones: [
          { ...zones[0], x: 1, y: 1, width: 2, height: 3 },
          { ...zones[0], id: 'other-culture', name: 'Deuxième culture', x: 4, y: 1, width: 2, height: 3 },
        ],
        ...(query.has('mountedFixtures') ? { stationPlacements: [],
          partitions: [{ id:'fixture-wall', x:1, y:7, length:2, axis:'x' }] } : {}),
      } : { ...previous, zones };
      window.__snapshot.state = query.has('emptyAir') ? createKqWarehouseEmpty() : getKqWarehouseQuote(plan, previous).nextState;
      if (query.has('activeAirlock')) {
        window.__snapshot.activeRun = true;
        window.__snapshot.activeRuns = [{ runId: '11111111-1111-4111-8111-111111111111', zoneId: 'other-culture',
          buddieCode: 'HH2026-002', stageIndex: 2, phase: 'ready', startedAt: '2026-10-13T12:00:00Z' }];
      }
    }`);
const scenarios = String.raw`
const checks = [], errors = [], blocked = [];
const map = '[data-warehouse-iso-map]';
const shop = 'dialog[data-warehouse-shop][open]';
const review = '[data-warehouse-plan-review]';
const placement = '[data-air-placement]';
const selectFan = shop + ' [data-warehouse-shop-choose="SIM-AIR-03"]';
let browser;
const onlyFixtures = process.argv.includes('--fixtures-only');
const fallbackFixtures = process.argv.includes('--fixtures-fallback');

try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, protocolTimeout: 60000,
    args: fallbackFixtures ? ['--no-sandbox', '--disable-webgl'] : ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    errors.push('Dialogue navigateur inattendu : ' + dialog.type());
    await dialog.dismiss();
  });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.origin === origin && !url.pathname.startsWith('/api/')) void request.continue();
    else { blocked.push(request.url()); void request.abort(); }
  });
  const screenshot = name => page.screenshot({ path: resolve(output, (fallbackFixtures ? 'repli-' : '') + name + '.png') });
  const saved = () => page.evaluate(() => structuredClone(window.__snapshot));
  const requests = () => page.evaluate(() => structuredClone(window.__requests));
  for (const width of onlyFixtures ? [] : [1440, 320]) {
    const touch = width === 320;
    const activate = async selector => {
      await page.waitForSelector(selector, { visible: true });
      await page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      if (touch) await page.tap(selector);
      else { await page.focus(selector); await page.keyboard.press('Enter'); }
    };
    const press = key => page.keyboard.press(key);
    const commit = async revision => {
      await page.waitForSelector(review);
      await activate(review + ' [data-warehouse-action="save"]');
      await page.waitForFunction(revision => window.__snapshot.revision === revision, {}, revision);
      await page.waitForSelector(review, { hidden: true });
    };
    try {
      await page.goto('about:blank');
      await page.setViewport({ width, height: touch ? 710 : 900, isMobile: touch, hasTouch: touch });
      await page.goto(origin + '/?compact&persist=coverage-' + Date.now(), { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(placement);
      await page.$eval(map, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForSelector(map + ':not([data-renderer="loading"])');
      const initial = await saved();
      const originalCount = await page.$$eval(placement, nodes => nodes.length);
      assert.equal(initial.state.airPlacements, undefined, 'Opening the historical plan preserves the saved format');
      await activate('[data-air-coverage-toggle]');
      await page.waitForSelector('[data-air-coverage-cell][data-covered="true"]');
      await activate('[data-air-shop]');
      await activate(selectFan);
      await page.waitForSelector(shop, { hidden: true });
      await page.waitForFunction(selector => document.activeElement.matches(selector), {}, map);
      await press('ArrowRight');
      await page.waitForSelector('[data-air-ghost]');
      if (touch) {
        await page.waitForSelector('[data-warehouse-cursor]');
        await screenshot('apercu-tactile-320');
        const cell = await page.$eval('[data-warehouse-cursor]', node => {
          const rect = node.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        });
        await page.touchscreen.tap(cell.x, cell.y);
      } else {
        await press('+');
        await page.waitForFunction(selector => Number(document.querySelector(selector).dataset.zoom) > 1, {}, map);
        await press('Home');
        await page.waitForFunction(selector => Number(document.querySelector(selector).dataset.zoom) === 1, {}, map);
        await screenshot('apercu-clavier-1440');
        await press('Enter');
      }
      await page.waitForFunction((selector, count) => document.querySelectorAll(selector).length === count, {}, placement, originalCount + 1);
      assert.equal((await requests()).length, 0, 'Le brouillon ne déclenche aucune écriture');
      assert.equal(await page.$$eval('[data-air-marker]:not([data-air-ghost])', nodes => nodes.length), originalCount + 1);
      await activate('[data-air-shop]');
      await page.waitForSelector(shop + ' [data-warehouse-shop-plan-payable]');
      const payable = await page.$eval(shop + ' [data-warehouse-shop-plan-payable]', node => Number(node.dataset.warehouseShopPlanPayable));
      assert.ok(payable > 0, 'Le panier indique le montant du nouvel appareil');
      await activate(shop + ' [data-warehouse-shop-review]');
      await page.$eval(review, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await screenshot('devis-' + width);
      await commit(2);
      const installed = await saved();
      const id = installed.state.airPlacements.find(item => !item.id.startsWith('air-legacy')).id;
      const row = placement + '[data-air-placement="' + id + '"]';
      await activate(row + ' [data-air-move]');
      await page.focus(map);
      const other = installed.state.airPlacements.find(item => item.id !== id);
      let newPlacement = installed.state.airPlacements.find(item => item.id === id);
      for (let step = newPlacement.x; step > other.x; step--) await press('ArrowLeft');
      for (let step = newPlacement.x; step < other.x; step++) await press('ArrowRight');
      for (let step = newPlacement.y; step > other.y; step--) await press('ArrowUp');
      for (let step = newPlacement.y; step < other.y; step++) await press('ArrowDown');
      await page.waitForSelector('[data-air-invalid="true"]');
      await press('Enter');
      assert.match(await page.$eval('[data-warehouse-iso-viewport]', node => node.innerText), /qu’un extracteur/);
      assert.equal((await requests()).length, 1);
      await screenshot('chevauchement-' + width);
      await press(other.x < 9 ? 'ArrowRight' : 'ArrowLeft');
      await press(other.y < 9 ? 'ArrowDown' : 'ArrowUp');
      await press('Enter');
      await commit(3);
      newPlacement = (await saved()).state.airPlacements.find(item => item.id === id);
      assert.notDeepEqual(newPlacement, installed.state.airPlacements.find(item => item.id === id));
      assert.equal((await requests()).at(-1).expectedCostCents, 0, 'Déplacement sans achat ni pose');
      await activate(row + ' [data-air-remove]');
      await commit(4);
      assert.equal((await saved()).state.airPlacements.length, originalCount);
      assert.deepEqual((await saved()).state.equipment, installed.state.equipment);
      assert.equal((await requests()).at(-1).expectedCostCents, 0, 'Retrait conservé en réserve');
      await activate('[data-air-shop]');
      const cart = 'SIM-LOGISTICS-02';
      await activate(shop + ' [data-warehouse-shop-category="logistics"]');
      const cartCard = shop + ' [data-warehouse-shop-product="' + cart + '"]';
      await page.waitForSelector(cartCard, { visible: true });
      assert.match(await page.$eval(cartCard, node => node.innerText), /achat unique.*Pour tout l’entrepôt/s);
      await activate(shop + ' [data-warehouse-shop-choose="' + cart + '"]');
      await page.waitForFunction(selector => document.activeElement.matches(selector), {}, map);
      for (let step = 0; step < 7; step++) await press('ArrowDown');
      await press('Enter');
      await page.waitForSelector(review);
      assert.equal((await requests()).length, 3, 'Le chariot placé reste au brouillon avant confirmation');
      await commit(5);
      const withCart = await saved();
      assert.equal(withCart.state.optionInventory.find(item => item.code === cart).quantity, 1);
      assert.deepEqual(withCart.state.handlingPlacements, [{ code: cart, x: 0, y: 7 }]);
      assert.equal(withCart.state.airPlacements.length, originalCount);
      await activate('[data-air-shop]');
      await activate(shop + ' [data-warehouse-shop-category="logistics"]');
      await page.waitForSelector(cartCard + ' [data-warehouse-shop-owned="' + cart + '"]');
      await page.$eval(cartCard, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await screenshot('chariot-acquis-' + width);
      await press('Escape');
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      assert.ok(fits, 'Aucun débordement horizontal');
      checks.push({ width, touch, passed: true, placementCount: originalCount + 1, explicitSaves: 4, overlapBlocked: true, reservePreserved: true, cartOwned: true, payable });
    } catch (error) {
      checks.push({ width, touch, passed: false, error: error.stack });
      await screenshot('echec-' + width).catch(() => {});
      await writeFile(resolve(output, 'echec-' + width + '.txt'), await page.$eval('body', node => node.innerText).catch(() => ''));
    }
  }
  if (!onlyFixtures) try {
    await page.goto('about:blank');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(origin + '/?compact&multiAir', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(map);
    await page.$eval(map, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForSelector(map + ':not([data-renderer="loading"])');
    await page.click('[data-air-shop]');
    await page.click(shop + ' [data-warehouse-shop-choose="SIM-AIR-01"]');
    await page.waitForFunction(selector => document.activeElement.matches(selector), {}, map);
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    const coverage = await page.$$eval('[data-air-coverage-cell]', cells => ({
      served: cells.filter(cell => cell.dataset.covered === 'true').length,
      unserved: cells.filter(cell => cell.dataset.covered === 'false').length,
      zones: [...new Set(cells.filter(cell => cell.dataset.airDevice).map(cell => cell.dataset.airZone))],
      devices: [...new Set(cells.map(cell => cell.dataset.airDevice).filter(Boolean))],
    }));
    assert.deepEqual({ served: coverage.served, unserved: coverage.unserved, zones: coverage.zones.length, devices: coverage.devices.length },
      { served: 8, unserved: 4, zones: 2, devices: 1 });
    const hint = await page.$eval(map, node => document.getElementById(node.getAttribute('aria-describedby')).innerText);
    assert.match(hint, /8 \/ 8 m².*2 zones.*pts par m².*\+8 m²/);
    assert.equal((await requests()).length, 0);
    await screenshot('multizone-1440');
    checks.push({ name: 'multizone', passed: true, ...coverage });
  } catch (error) {
    checks.push({ name: 'multizone', passed: false, error: error.stack });
    await screenshot('echec-multizone').catch(() => {});
  }
  for (const width of [1440, 320]) {
    const touch = width === 320;
    try {
      await page.goto('about:blank');
      await page.setViewport({ width, height: touch ? 710 : 900, isMobile: touch, hasTouch: touch });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: touch ? 'reduce' : 'no-preference' }]);
      const activate = async selector => {
        await page.waitForSelector(selector, { visible: true });
        await page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        if (touch) await page.tap(selector);
        else { await page.focus(selector); await page.keyboard.press('Enter'); }
      };
      const mapFocus = () => page.waitForFunction(selector => document.activeElement.matches(selector), {}, map);
      const browse = async query => {
        await page.goto(origin + '/?compact&' + query, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(map);
        await page.$eval(map, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.waitForSelector(map + ':not([data-renderer="loading"])');
      };
      const selectMount = async value => {
        assert.deepEqual(await page.select('[data-air-mount]', value), [value]);
        await mapFocus();
      };
      const shopChoice = async (department, code, captureProduct = false) => {
        await activate('[data-warehouse-build-shop]');
        await activate(shop + ' [data-warehouse-shop-category="' + department + '"]');
        if (captureProduct) {
          const card = await page.waitForSelector(shop + ' [data-warehouse-shop-product="' + code + '"]');
          await card.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await page.waitForFunction(node => node.querySelector('img')?.naturalWidth > 0, {}, card);
          assert.equal(await card.$eval('[data-warehouse-shop-price]', node => Number(node.dataset.warehouseShopPrice)), 1_500_000);
          assert.match(await card.evaluate(node => node.innerText), /75\s*%/);
          await card.screenshot({ path: resolve(output, 'fiche-sas-' + width + '.png') });
        }
        await activate(shop + ' [data-warehouse-shop-choose="' + code + '"]');
        await page.waitForSelector(shop, { hidden: true });
        await mapFocus();
      };
      const commitCursor = async (touchTarget = '[data-warehouse-cursor]') => {
        if (!touch) { await page.keyboard.press('Enter'); return; }
        await page.waitForSelector(touchTarget);
        const point = await page.$eval(touchTarget, node => {
          const rect = node.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        });
        await page.touchscreen.tap(point.x, point.y);
      };
      await browse('emptyAir');
      await shopChoice('air', 'SIM-AIR-01');
      await selectMount('wall:south');
      await page.waitForSelector('[data-air-ghost][data-air-mount="wall"][data-air-face="south"]');
      const emptyReach = await page.$$eval('[data-air-reach-cell]', nodes => nodes.length);
      assert.ok(emptyReach > 0, 'La portée géométrique reste visible sans culture');
      assert.ok(await page.$eval('[data-air-ghost]', node => Number(node.dataset.airElevation) > 1));
      assert.equal(await page.$('[data-air-coverage-cell]'), null);
      assert.ok(await page.$('[data-air-flow="south"]'));
      assert.ok(await page.$('[data-air-anchor-cell]'));
      if (touch) assert.equal(await page.$eval('[data-flow-track]', node => getComputedStyle(node).animationName), 'none');
      await screenshot('mur-a-vide-' + width);
      await page.keyboard.press('Escape');
      assert.deepEqual(await requests(), []);

      const query = 'multiAir&mountedFixtures&persist=fixtures-' + width + '-' + Date.now();
      await browse(query);
      await shopChoice('air', 'SIM-AIR-01');
      await selectMount('partition:fixture-wall:north');
      await page.waitForSelector('[data-air-ghost][data-air-partition="fixture-wall"][data-air-face="north"]');
      assert.ok(await page.$('[data-air-flow="north"]'));
      await screenshot('paroi-interieure-' + width);
      await selectMount('wall:south');
      // The fixture's two culture beds sit either side of column four.
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await page.waitForSelector('[data-air-coverage-state="served"]');
      const zonesServed = await page.$$eval('[data-air-coverage-state="served"]', nodes =>
        new Set(nodes.map(node => node.dataset.airZone)).size);
      assert.equal(zonesServed, 2);
      const covered = await page.$$eval('[data-air-coverage-state="served"]', nodes => nodes.length);
      assert.ok(covered > 0 && covered < 12);
      await screenshot('mur-deux-zones-' + width);
      await commitCursor('[data-air-anchor-point="3,0"]');
      await page.waitForSelector('[data-air-marker][data-air-mount="wall"]:not([data-air-ghost])');

      await shopChoice('water', 'SIM-WATER-03');
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
      await page.waitForSelector('[data-station-model="SIM-WATER-03"][data-equipment-ghost]');
      const irrigatedArea = await page.$$eval('[data-station-served="true"]', nodes => nodes.length);
      assert.ok(irrigatedArea > 0);
      await screenshot('centrale-portee-' + width);
      await commitCursor();
      await page.waitForSelector('[data-station-model="SIM-WATER-03"]:not([data-equipment-ghost])');

      const payable = () => page.$eval(review + ' [data-warehouse-plan-payable-cents]', node => Number(node.dataset.warehousePlanPayableCents));
      const beforeAirlock = await payable();
      await shopChoice('hygiene', 'SIM-HYGIENE-03', true);
      await page.waitForSelector('[data-station-entrance="5,9"]');
      await page.waitForSelector('[data-station-model="SIM-HYGIENE-03"][data-equipment-ghost]');
      await page.waitForSelector('[data-airlock-protection="building"]');
      assert.equal(await page.$('[data-station-reach-cell]'), null);
      await screenshot('sas-seuil-' + width);
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => /porte sud/.test(document.querySelector('[data-fixture-placement] [role="alert"]')?.textContent ?? ''));
      assert.equal(await payable(), beforeAirlock);
      await activate('[data-station-install-entrance]');
      await page.waitForSelector('[data-station-model="SIM-HYGIENE-03"]:not([data-equipment-ghost])');
      await page.waitForFunction(selector => document.activeElement.matches(selector), {}, review);
      const airlockInstalledCostCents = await payable() - beforeAirlock;
      assert.equal(airlockInstalledCostCents, 1_500_000);
      assert.match(await page.$eval('[data-coverage-details="station"]', node => node.textContent), /75 %.*tout l’entrepôt/);
      assert.deepEqual(await requests(), []);
      await activate(review + ' [data-warehouse-action="save"]');
      await page.waitForFunction(() => window.__snapshot.revision === 2);
      await page.waitForFunction(selector => !document.querySelector(selector)
        && Array.from(document.querySelectorAll('[role="status"]')).some(node => node.textContent.includes('Aménagement installé')), {}, review);
      const committed = await saved();
      assert.equal(committed.state.airPlacements[0].mount.face, 'south');
      assert.deepEqual([committed.state.airPlacements[0].x, committed.state.airPlacements[0].y], [3, 0]);
      assert.equal(committed.state.stationPlacements.length, 2);
      const sas = committed.state.stationPlacements.find(item => item.code === 'SIM-HYGIENE-03');
      assert.deepEqual([sas.x, sas.y], [5, 9]);
      await browse(query);
      await page.waitForSelector('[data-air-marker][data-air-mount="wall"]');
      await page.waitForSelector('[data-station-model="SIM-WATER-03"]');
      await page.waitForSelector('[data-station-model="SIM-HYGIENE-03"]');
      assert.deepEqual(await saved(), committed);
      const follow = await page.$$eval('button', nodes => nodes.some(node => node.textContent.trim() === 'Suivre les cultures'));
      if (follow) await activate('button::-p-text(Suivre les cultures)');
      await page.$eval(map, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const airHotspot = '[data-warehouse-equipment-hit="' + committed.state.airPlacements[0].id + '"]';
      await activate(airHotspot);
      await page.waitForSelector(airHotspot + '[aria-pressed="true"]');
      assert.ok(await page.$('[data-air-reach-cell]'));
      await screenshot('equipements-recharges-' + width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await browse('multiAir&mountedFixtures&activeAirlock&persist=airlock-active-' + width + '-' + Date.now());
      const activeFloor = await saved();
      await shopChoice('hygiene', 'SIM-HYGIENE-03');
      await activate('[data-station-install-entrance]');
      await page.waitForFunction(selector => document.activeElement.matches(selector), {}, review);
      assert.equal(await payable(), airlockInstalledCostCents);
      assert.equal(await page.$eval(review + ' [data-warehouse-action="save"]', node => node.disabled), false);
      await activate(review + ' [data-warehouse-action="save"]');
      await page.waitForFunction(() => window.__snapshot.revision === 2);
      await page.waitForSelector(review, { hidden: true });
      const protectedFloor = await saved();
      assert.equal(activeFloor.cashCents - protectedFloor.cashCents, airlockInstalledCostCents);
      assert.deepEqual(protectedFloor.state.zones, activeFloor.state.zones);
      assert.deepEqual(protectedFloor.activeRuns, activeFloor.activeRuns);
      checks.push({ name: 'fixtures-' + width, passed: true, width, touch, emptyReach, zonesServed, covered, irrigatedArea, airlockInstalledCostCents, activeCropPreserved: true, installations: 4, saves: 2 });
    } catch (error) {
      checks.push({ name: 'fixtures-' + width, passed: false, width, touch, error: error.stack });
      await screenshot('echec-fixtures-' + width).catch(() => {});
      await writeFile(resolve(output, 'echec-fixtures-' + width + '.txt'), await page.$eval('body', node => node.innerText).catch(() => ''));
    }
  }
} finally {
  const passed = checks.length === (onlyFixtures ? 2 : 5) && checks.every(item => item.passed) && !errors.length && !blocked.length;
  await writeFile(resolve(output, fallbackFixtures ? 'rapport-equipements-repli.json' : onlyFixtures ? 'rapport-equipements.json' : 'rapport.json'), JSON.stringify({ passed, checks, errors, blocked }, null, 2));
  console.log(JSON.stringify({ passed, checks, errors, blocked }, null, 2));
  if (!passed) process.exitCode = 1;
  if (browser) await browser.close();
  server.httpServer?.closeAllConnections();
  await server.close();
}
`;
const runner = resolve(output, 'run.mjs');
await writeFile(runner, fixture + scenarios);
await import(pathToFileURL(runner).href);
