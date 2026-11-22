// Actual warehouse components with a persisted, browser-local warehouse API.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { previewPreparations } from './fixtures/warehouse-preparations-preview.mjs';

const retail = JSON.parse(await readFile('src/lib/kanab-quest-warehouse-retail-equipment.json', 'utf8'));
const lightingOnly = process.argv.includes('--lighting-only');
const handlingOnly = process.argv.includes('--handling-only');
const climateControlOnly = process.argv.includes('--climate-control-only');
const preview = process.argv.includes('--fresh');
const recoveryOnly = process.argv.includes('--recovery-only');
const resetAudit = process.argv.includes('--reset-audit') || recoveryOnly;
const fresh = preview || resetAudit;
const output = resolve(recoveryOnly ? 'output/warehouse-preparation-recovery' : fresh ? 'output/warehouse-fresh-local' : handlingOnly ? 'output/warehouse-handling-placement' : lightingOnly ? 'output/warehouse-lighting' : climateControlOnly ? 'output/warehouse-climate-control' : 'output/warehouse-shop-first');
await mkdir(output, { recursive: true });


const fixture = (await readFile('scripts/audit-placard-warehouse-v4.mjs', 'utf8'))
  .split("if(process.argv.includes('--preview'))")[0]
  .replace("'output/warehouse-v4'", JSON.stringify(output))
  .replace('?? 3248', '?? 3395')
  .replace('window.__snapshot.cashCents=4_000_000;', `if (!${fresh}) window.__snapshot.cashCents=4_000_000;`)
  .replace("'react-dom/client', 'lucide-react']", lightingOnly
    ? "'react-dom/client', 'lucide-react', 'three', 'three/addons/utils/BufferGeometryUtils.js']"
    : "'react-dom/client', 'lucide-react']")
  .replace('export default function Link', 'export const useLinkStatus=()=>({pending:false}); export default function Link')
  .replace('createKqWarehouseStarter,getKqWarehouseQuote', 'createKqWarehouseStarter,createKqWarehouseEmpty,getKqWarehouseDimensions,getKqWarehouseQuote')
  .replace('if(query.has(\'compact\'))Object.assign(window.__snapshot,{activeRuns:[],completedRuns:[]});', `
    Object.assign(window.__snapshot, {
      state: createKqWarehouseEmpty(), cashCents: ${lightingOnly && !fresh ? 500000 : 100000}, activeRuns: [], completedRuns: [], stockGrams: 0, storageReservedGrams: 0,
    });
    if (${climateControlOnly}) {
      const zone = { active: false, lightingCode: 'UNLIT', airCode: 'SIM-AIR-01', optionCodes: ['SIM-SUBSTRATE-01'] };
      window.__snapshot.state = getKqWarehouseQuote({ ...createKqWarehouseEmpty(), zones: [
        { ...zone, id: 'north', name: 'Zone nord', x: 0, y: 0, width: 7, height: 3 },
        { ...zone, id: 'south', name: 'Zone sud', x: 1, y: 5, width: 2, height: 1 },
      ] }).nextState;
      window.__snapshot.cashCents = 4000000;
    }`)
  .replace("import {KqWarehouse} from '/src/components/placard/KqWarehouse';", `
    import {KqWarehouse} from '/src/components/placard/KqWarehouse';
    import {KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER,KQ_WAREHOUSE_PREPARATION_CATALOG,getKqWarehouseInputPack,isKqWarehouseInputCode} from '/src/lib/kanab-quest-warehouse-preparations';
    import {getKqWarehouseStationEntrance} from '/src/lib/kanab-quest-warehouse-stations';
    import {getKqBusinessClock,KQ_GAME_DAY_MS} from '/src/lib/kanab-quest-business';
    import {KQ_PLAYER_DAILY_HOURS} from '/src/lib/kanab-quest-player-work';
    import {VillageActivities} from '/src/components/placard/world/VillageActivities';
    import {positionVillageBubble} from '/src/components/placard/world/village-bubble';
    import {warehouseDraftStorage,writeWarehouseDraft} from '/src/lib/warehouse-draft';
  `)
  .replace("<KqWarehouse embedded=", `<KqWarehouse draftOwnerId={${JSON.stringify(fresh ? 'warehouse-preview' : undefined)}}
    initialShopOpen={${fresh} && (query.get('rayon') === 'nutrition' || isKqWarehouseInputCode(query.get('equipment') ?? ''))}
    initialShopDepartment={${fresh} && query.get('rayon') === 'nutrition' ? 'nutrition' : undefined}
    initialEquipmentCode={${fresh} ? query.get('equipment') : undefined} embedded=`)
  .replace("if(!String(url).startsWith('/api/'))return fetchOriginal(url,init);", `
    if(${fresh} && new URL(url instanceof Request ? url.url : String(url),location.href).origin !== location.origin){
      throw new Error('Les requêtes distantes sont fermées dans la partie locale.');
    }
    if (${fresh} && String(url) === '/api/arena/placard/warehouse/preparations') {
      const current = window.__snapshot;
      const account = sessionStorage.getItem('audit-preparation-account') ?? 'warehouse-preview';
      const headers = { [KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER]: account };
      const expected = new Headers(init.headers).get(KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER);
      const post = init.method === 'POST';
      if (post && expected !== null && expected !== account) return Response.json({ error: 'Le compte a changé.' }, { status: 409, headers });
      const interruption = post && sessionStorage.getItem('audit-preparation-interruption');
      if (interruption) sessionStorage.removeItem('audit-preparation-interruption');
      if (post) (window.__preparationAttempts ??= []).push(JSON.parse(init.body).requestKey);
      if (interruption === 'before') throw new TypeError('Réponse perdue pendant la recette.');
      const snapshot = account === 'warehouse-preview' ? current : { ...current, cashCents: 100000, previewInputInventory: {}, previewPackReceipts: {} };
      const response = (${previewPreparations})(snapshot, init, {
        catalog: KQ_WAREHOUSE_PREPARATION_CATALOG, packFor: code => {
          const pack = getKqWarehouseInputPack(code);
          return pack && code === 'CARE-IRON' && sessionStorage.getItem('audit-preparation-new-price')
            ? { ...pack, packPriceCents: pack.packPriceCents + 1 } : pack;
        }, gameClock: getKqBusinessClock,
        dayMs: KQ_GAME_DAY_MS, dailyHours: KQ_PLAYER_DAILY_HOURS, entrance: getKqWarehouseStationEntrance(getKqWarehouseDimensions(current.state)),
        save: next => {
          window.__snapshot = next;
          try { persistFixture(); } catch (error) { window.__snapshot = current; throw error; }
        },
      });
      if (interruption === 'after') throw new TypeError('Réponse perdue pendant la recette.');
      return new Response(response.body, { status: response.status, headers });
    }
    if (${climateControlOnly} && String(url) === '/api/arena/placard/warehouse/preparations' && (!init.method || init.method === 'GET')) {
      const unused = { completedAt: null, expiresAt: null, pending: null };
      return Response.json({ cashCents: window.__snapshot.cashCents, items: [], runs: [], coverage: [], programs: [], cleaning: { vacuum: unused, mop: unused } });
    }
    if(!String(url).startsWith('/api/'))return fetchOriginal(url,init);
  `)
  .replace("createRoot(document.getElementById('root')).render(<Fixture/>);", `
    function VillageEntry(){
      const [enter,setEnter]=React.useState(${fresh} && (query.get('rayon') === 'nutrition' || isKqWarehouseInputCode(query.get('equipment') ?? '')));
      const menu=React.useRef(null);
      React.useLayoutEffect(()=>{
        if(menu.current)positionVillageBubble(menu.current,null,innerWidth*.45,innerHeight*.65,innerWidth,innerHeight);
      },[]);
      return enter ? <Fixture/> : <VillageActivities id="warehouse" name="Ferme" nodeRef={menu}
        fallback={false} snapshot={null} onClose={()=>{}}
        onNavigate={href=>{
          window.__warehouseEntry=href;
          if(href==='/arene/placard?view=workshop')setEnter(true);
        }}/>;
    }
    function restart(){
      if(!window.confirm('Recommencer cette partie locale avec 1 000 € et un entrepôt vide ?'))return;
      if(persistenceKey)sessionStorage.removeItem(persistenceKey);
      sessionStorage.removeItem('kq:preparation:pending:warehouse-preview');
      writeWarehouseDraft(warehouseDraftStorage(),'warehouse-preview',null);
      location.reload();
    }
    createRoot(document.getElementById('root')).render(${fresh}
      ? <><header><strong>Aménagement de l’entrepôt</strong><p>Cette partie locale couvre le plan, les achats au devis et la réserve d’intrants.</p>
        <button type="button" data-warehouse-preview-reset onClick={restart}>Recommencer la partie locale</button></header><VillageEntry/></>
      : <VillageEntry/>);
  `);
const scenarios = String.raw`
const checks = [], errors = [], blocked = [];
const lightingOnly = process.argv.includes('--lighting-only');
const map = '[data-warehouse-iso-map]';
const shop = 'dialog[data-warehouse-shop][open]';
const openShop = '[data-warehouse-build-shop]';
const plan = '[data-warehouse-plan-review]';
const zones = '[data-grow-footprint][data-kind="culture"]';
const villageEntry = '[data-building="warehouse"] a[href="/arene/placard?view=workshop"]';
const product = code => shop + ' [data-warehouse-shop-choose="' + code + '"]';
const target = id => '[data-warehouse-build-target="' + id + '"]';
let browser;

try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const width of [1440, 320]) {
    const touch = width === 320;
    const page = await browser.newPage();
    let fallbackScript;
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(90000);
    if (touch) {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      if (lightingOnly) fallbackScript = await page.evaluateOnNewDocument(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return type.startsWith('webgl') ? null : getContext.call(this, type, ...args);
        };
      });
    }
    await page.setViewport({ width, height: touch ? 710 : 900, isMobile: touch, hasTouch: touch });
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => {
      if (!lightingOnly) { await dialog.accept(); return; }
      errors.push('Dialogue navigateur inattendu : ' + dialog.type());
      await dialog.dismiss();
    });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.protocol === 'data:' || url.origin === origin && !url.pathname.startsWith('/api/')) void request.continue();
      else { blocked.push(request.url()); void request.abort(); }
    });
    const screenshot = name => page.screenshot({ path: resolve(output, name + '-' + width + '.png') });
    const saved = () => page.evaluate(() => structuredClone(window.__snapshot));
    const requests = () => page.evaluate(() => structuredClone(window.__requests));
    const scroll = selector => page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const press = key => page.keyboard.press(key);
    const enter = async () => {
      await page.waitForSelector(villageEntry);
      assert.equal((await page.$eval(villageEntry, node => node.innerText)).trim(), 'Entrer');
      await page.$eval(villageEntry, async node => {
        await Promise.all(node.closest('aside').getAnimations({ subtree: true }).map(animation => animation.finished));
      });
      await activate(villageEntry);
      await page.waitForSelector(map);
      assert.equal(await page.evaluate(() => window.__warehouseEntry), '/arene/placard?view=workshop');
    };
    const activate = async selector => {
      await page.waitForSelector(selector, { visible: true });
      await scroll(selector);
      assert.equal(await page.$eval(selector, node => node.disabled ?? false), false, selector + ' is enabled');
      if (touch) await page.tap(selector);
      else { await page.focus(selector); await press('Enter'); }
    };
    const waitForMap = async () => {
      await page.waitForSelector(shop, { hidden: true });
      await page.waitForFunction(selector => document.activeElement.matches(selector), {}, map);
    };
    const area = () => page.$$eval(zones, nodes => nodes.map(node => ({ id: node.dataset.growFootprint, width: Number(node.dataset.width), depth: Number(node.dataset.depth) })));
    const cursorTap = async () => {
      await page.waitForSelector('[data-warehouse-cursor]');
      const point = await page.$eval('[data-warehouse-cursor]', node => {
        const area = node.getBoundingClientRect();
        return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
      });
      assert.equal(await page.$eval(map, (node, point) => node.contains(document.elementFromPoint(point.x, point.y)), point), true);
      await page.touchscreen.tap(point.x, point.y);
    };
    const resizeTouch = async id => {
      await page.waitForSelector('[data-warehouse-resize-handle]');
      const { start, end } = await page.$eval(zones + '[data-grow-footprint="' + id + '"]', node => {
        const matrix = node.getScreenCTM();
        const left = node.points.getItem(0).matrixTransform(matrix);
        const right = node.points.getItem(1).matrixTransform(matrix);
        const handle = document.querySelector('[data-warehouse-resize-handle] circle').getBoundingClientRect();
        const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
        return { start: { x, y }, end: { x: x + right.x - left.x, y: y + right.y - left.y } };
      });
      const session = await page.createCDPSession();
      try {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally { await session.detach(); }
    };
    const chooseProduct = async (department, code) => {
      await activate(openShop);
      await activate(shop + ' [data-warehouse-shop-category="' + department + '"]');
      await activate(product(code));
      await page.waitForSelector(shop, { hidden: true });
    };
    const number = (selector, attribute) => page.$eval(selector, (node, attribute) => Number(node.getAttribute(attribute)), attribute);
    const rectangle = async () => {
      await scroll(map);
      await press('ArrowRight'); await press('ArrowDown');
      if (!touch) {
        await press('Enter');
        for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown']) await press(key);
        await press('Enter');
        return;
      }
      const pointAtCursor = () => page.$eval('[data-warehouse-cursor]', node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      const start = await pointAtCursor();
      for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown']) await press(key);
      const end = await pointAtCursor();
      const session = await page.createCDPSession();
      try {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally { await session.detach(); }
    };
    const commitPlan = async (revision = 2, free = false) => {
      await activate(plan + ' [data-warehouse-action="save"]');
      await page.waitForFunction(expected => window.__snapshot.revision === expected, {}, revision);
      await page.waitForSelector(plan, { hidden: true });
      await page.waitForFunction(message => [...document.querySelectorAll('[role="status"]')].some(node =>
        node.getClientRects().length && node.textContent.includes(message)), {}, free ? 'Plan enregistré sans prélèvement' : 'Aménagement installé');
    };
    const lightDetails = '[data-coverage-details="lighting"]';
    const lightPicker = '[data-lighting-pick]';
    const readyLightingView = async (renderer = touch ? 'plan' : 'webgl') => {
      await page.waitForSelector(map + '[data-renderer="' + renderer + '"]');
      if (renderer === 'plan') {
        await page.locator(map + ' [data-grow-fallback-plan] [data-warehouse-room-artwork]').wait();
        await page.$eval(map + ' [data-grow-fallback-plan]', async group => {
          const sources = [...new Set([...group.querySelectorAll('image[href]')].map(node => node.getAttribute('href')))];
          await Promise.all(sources.map(async source => {
            const image = new Image(); image.src = source;
            await image.decode();
          }));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
      }
    };
    const zoomLighting = async id => {
      for (const threshold of [1.39, 1.95, 2.73]) {
        await activate('[data-grow-zoom-in]');
        await page.waitForFunction((map, threshold) => Number(document.querySelector(map)?.dataset.zoom) >= threshold, {}, map, threshold);
      }
      await scroll(map);
      await page.focus(map);
      for (let step = 0; step < 6; step++) {
        const key = await page.$eval(map, (node, id) => {
          const zone = node.querySelector('[data-grow-footprint="' + id + '"]').getBoundingClientRect();
          const frame = node.getBoundingClientRect();
          const dx = zone.x + zone.width / 2 - frame.x - frame.width / 2;
          const dy = zone.y + zone.height / 2 - frame.y - frame.height * .63;
          return Math.abs(dx) > 24 ? dx > 0 ? 'ArrowRight' : 'ArrowLeft'
            : Math.abs(dy) > 24 ? dy > 0 ? 'ArrowDown' : 'ArrowUp' : null;
        }, id);
        if (!key) break;
        await press(key);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      }
    };
    const inspectLight = async (id, count, surface) => {
      const model = '[data-lighting-zone="' + id + '"][data-lighting-state="lit"]';
      await page.waitForFunction((selector, count, surface) => {
        const node = document.querySelector(selector);
        return node?.dataset.lightingCount === String(count) && node.dataset.lightingArea === String(surface);
      }, {}, lightDetails, count, surface);
      await page.waitForSelector(model + ' [data-lighting-footprint]');
      const actual = await page.$eval(model, (group, id) => {
        const zone = document.querySelector('[data-grow-footprint="' + id + '"]');
        const points = list => Array.from({ length: list.numberOfItems }, (_, index) => list.getItem(index));
        const polygon = points(zone.points);
        function inside(point) {
          const edges = polygon.map((first, index) => {
            const last = polygon[(index + 1) % polygon.length];
            const dx = last.x - first.x, dy = last.y - first.y;
            return (dx * (point.y - first.y) - dy * (point.x - first.x)) / Math.hypot(dx, dy);
          });
          return edges.every(value => value >= -.5) || edges.every(value => value <= .5);
        }
        const footprints = [...group.querySelectorAll('[data-lighting-footprint]')];
        return { fixtures: footprints.length, rows: group.querySelectorAll('[data-lighting-row]').length,
          beams: group.querySelectorAll('[data-lighting-beam]').length,
          areas: footprints.map(shape => Number(shape.dataset.lightingArea)),
          clipped: footprints.every(shape => shape.points?.numberOfItems >= 3 && points(shape.points).every(inside)) };
      }, id);
      assert.equal(actual.fixtures, count);
      assert.equal(actual.beams, count);
      assert.equal(actual.rows, await number(lightDetails, 'data-lighting-rows'));
      assert.ok(actual.rows > 0 && actual.rows <= count);
      assert.ok(Math.abs(actual.areas.reduce((sum, area) => sum + area, 0) - surface) < .001);
      assert.equal(actual.clipped, true, 'Toutes les empreintes restent dans la zone');
      return actual;
    };
    const inspectIndividualLamp = async id => {
      const projected = await page.$eval(map, (node, id) => {
        const lamp = node.querySelector('[data-lighting-zone="' + id + '"] [data-lighting-lamp="0"]');
        const box = node.getBoundingClientRect();
        const x = box.x + Number(lamp.dataset.lightingCenterX);
        const y = box.y + Number(lamp.dataset.lightingCenterY);
        if (!node.contains(document.elementFromPoint(x, y))) throw new Error('La lampe à examiner est hors de la zone visible.');
        return { x, y, row: Number(lamp.closest('[data-lighting-row]').dataset.lightingRow) + 1 };
      }, id);
      if (touch) await page.touchscreen.tap(projected.x, projected.y);
      else await page.mouse.click(projected.x, projected.y);
      await page.waitForFunction((picker, row) => {
        const select = document.querySelector(picker);
        return select?.value === '0' && select.selectedOptions[0]?.textContent.includes('Rangée ' + row)
          && document.querySelectorAll('[data-lighting-beam]').length === 1;
      }, {}, lightPicker, projected.row);
      await page.waitForFunction(selector => document.querySelector(selector)?.textContent.includes('2 m² couverts par cette lampe'), {}, lightDetails);
      assert.equal(await page.$$eval('[data-lighting-lamp][data-lighting-focused="true"]', nodes => nodes.length), 1);
      await scroll(lightDetails);
      await screenshot('lampe-individuelle');
      if (touch) await page.select(lightPicker, '');
      else { await page.focus(lightPicker); await press('Home'); }
      await page.waitForFunction((selector, count) => document.querySelector(selector)?.value === ''
        && document.querySelectorAll('[data-lighting-beam]').length === count, {}, lightPicker, 6);
      await screenshot('couverture-standard');
      return projected.row;
    };
    async function climateControlScenario(initial) {
      const offers = ${JSON.stringify(Object.fromEntries(Object.entries(retail).filter(([code]) => /^SIM-(?:CLIMATE|CONTROL)-UNIT-0[123]$/.test(code)).map(([code, item]) => [code, item.unitPriceCents])))};
      const paid = [];
      const costs = [];
      let receipt = initial;
      const openCategory = async department => {
        const inactiveArrangement = '[data-warehouse-mode="arrangement"][aria-pressed="false"]';
        if (await page.$(inactiveArrangement)) {
          await activate(inactiveArrangement);
          await page.waitForSelector('[data-warehouse-mode="arrangement"][aria-pressed="true"]');
        }
        await activate(openShop + ':not([data-warehouse-mode])');
        await activate(shop + ' [data-warehouse-shop-category="' + department + '"]');
      };
      const chooseDevice = async code => {
        await activate(product(code));
        await page.waitForFunction(code => document.activeElement.dataset.warehousePlacement === code, {}, code);
      };
      async function confirmDevice(code, zoneId, cost, ownedQuantity = 1) {
        const before = receipt;
        await chooseDevice(code);
        await page.waitForSelector(target(zoneId));
        assert.deepEqual(await saved(), before);
        await activate(target(zoneId));
        await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), {}, plan);
        assert.equal(await number(plan + ' [data-warehouse-plan-payable-cents]', 'data-warehouse-plan-payable-cents'), cost);
        assert.deepEqual(await saved(), before);
        assert.equal((await requests()).length, costs.length);
        await commitPlan(before.revision + 1, cost === 0);
        receipt = await saved();
        assert.equal(receipt.cashCents, before.cashCents - cost);
        assert.ok(receipt.state.zones.find(zone => zone.id === zoneId).optionCodes.includes(code));
        assert.equal(receipt.state.optionInventory.find(item => item.code === code)?.quantity, ownedQuantity);
        costs.push(cost);
        assert.deepEqual((await requests()).map(request => request.expectedCostCents), costs);
      }
      for (const department of ['climate', 'control']) {
        const codes = ['01', '02', '03'].map(tier => 'SIM-' + department.toUpperCase() + '-UNIT-' + tier);
        await openCategory(department);
        const models = await page.$$eval(shop + ' [data-warehouse-shop-product]', cards => cards.map(card => ({
          code: card.dataset.warehouseShopProduct,
          title: card.querySelector('h4').innerText,
          price: Number(card.querySelector('[data-warehouse-shop-price]').dataset.warehouseShopPrice),
          unit: card.querySelector('[data-warehouse-shop-price]').parentElement.innerText,
          action: card.querySelector('[data-warehouse-shop-choose]').innerText.trim(),
          reference: card.textContent,
          supplierLink: card.querySelector('a[href^="https://"]') !== null,
        })));
        assert.deepEqual(models.map(model => model.code), codes);
        assert.equal(new Set(models.map(model => model.title)).size, 3);
        for (const model of models) {
          assert.equal(model.price, offers[model.code]);
          assert.match(model.unit, /TTC\s*\/\s*appareil/i);
          assert.doesNotMatch(model.unit, /m²/);
          assert.doesNotMatch(model.reference, /Référence et prix public TTC|Relevé le/i);
          assert.equal(model.supplierLink, false);
          assert.equal(model.action, 'Acheter');
        }
        const card = shop + ' [data-warehouse-shop-product="' + codes[0] + '"]';
        await scroll(card);
        assert.ok(await page.$eval(shop, dialog => dialog.scrollWidth <= dialog.clientWidth + 1));
        await screenshot(department === 'climate' ? 'climat' : 'pilotage');
        await chooseDevice(codes[0]);
        await page.waitForSelector(target('north'));
        await activate('[data-warehouse-placement-cancel]');
        assert.deepEqual(await saved(), receipt);
        assert.equal((await requests()).length, costs.length);
        for (const code of codes) {
          const price = offers[code];
          const quantity = code.endsWith('01') ? (department === 'climate' ? 2 : 3) : 1;
          const installation = code.endsWith('01') ? 0 : Math.round(price * quantity * .15);
          await openCategory(department);
          await confirmDevice(code, 'north', price * quantity + installation, quantity);
          paid.push({ code, quantity, price, installation });
        }
        // The second model has returned to reserve after the third replaced it.
        await activate('[data-warehouse-action="reserve"]');
        const reserved = '[data-warehouse-reserve-mode="current"] [data-warehouse-reserve-model="' + codes[1] + '"]';
        await page.waitForSelector(reserved);
        assert.doesNotMatch(await page.$eval(reserved, row => row.innerText), /m²/);
        await openCategory(department);
        assert.equal((await page.$eval(product(codes[1]), node => node.innerText)).trim(), 'Placer');
        await confirmDevice(codes[1], 'south', 0);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await enter();
      assert.deepEqual(await saved(), receipt);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      return { width, touch, passed: true, paid, requestCount: costs.length, reserveReinstallations: 2, cashAfterCents: receipt.cashCents };
    }
    async function lightingScenario(initial) {
      assert.equal(initial.cashCents, 500000);
      await chooseProduct('substrate', 'SIM-SUBSTRATE-01');
      await waitForMap();
      await rectangle();
      await page.waitForSelector(zones + '[data-width="4"][data-depth="3"]');
      const [zone] = await area();
      assert.deepEqual([zone.width, zone.depth], [4, 3]);
      await chooseProduct('lighting', 'SIM-LIGHT-02');
      await activate(target(zone.id));
      const standard = await inspectLight(zone.id, 6, 12);
      assert.ok(standard.rows >= 2, 'Le rectangle reçoit plusieurs rangées');
      const standardPayable = await number(plan + ' [data-warehouse-plan-payable-cents]', 'data-warehouse-plan-payable-cents');
      assert.equal(standardPayable, 12 * 12000 + Math.round((12 * ${retail['SIM-SUBSTRATE-01'].unitPriceCents} + 6 * ${retail['SIM-LIGHT-02'].unitPriceCents}) * 1.15));
      assert.deepEqual(await saved(), initial);
      assert.deepEqual(await requests(), []);
      await scroll(map);
      await readyLightingView();
      if (touch) await zoomLighting(zone.id);
      await screenshot('rangees-standard');
      const inspectedRow = await inspectIndividualLamp(zone.id);
      await chooseProduct('lighting', 'SIM-LIGHT-03');
      await activate(target(zone.id));
      const premium = await inspectLight(zone.id, 3, 12);
      assert.deepEqual(await area(), [zone]);
      const payable = await number(plan + ' [data-warehouse-plan-payable-cents]', 'data-warehouse-plan-payable-cents');
      assert.equal(payable, 12 * 12000 + Math.round((12 * ${retail['SIM-SUBSTRATE-01'].unitPriceCents} + 3 * ${retail['SIM-LIGHT-03'].unitPriceCents}) * 1.15));
      assert.deepEqual(await requests(), []);
      await commitPlan();
      const receipt = await saved();
      assert.equal(receipt.cashCents, initial.cashCents - payable);
      assert.equal(receipt.state.zones[0].lightingCode, 'SIM-LIGHT-03');
      assert.deepEqual(receipt.state.equipment.filter(item => ['SIM-LIGHT-02', 'SIM-LIGHT-03'].includes(item.code)), [{ code: 'SIM-LIGHT-03', quantity: 3 }]);
      assert.deepEqual((await requests()).map(request => request.expectedCostCents), [payable]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await enter();
      assert.deepEqual(await saved(), receipt);
      assert.deepEqual(await area(), [zone]);
      await activate('[data-lighting-inspect]');
      const reloaded = await inspectLight(zone.id, 3, 12);
      assert.deepEqual(reloaded, premium);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await scroll(map);
      await readyLightingView();
      if (touch) await zoomLighting(zone.id);
      await screenshot('rangees-recharge');
      const renderer = await page.$eval(map, node => node.dataset.renderer);
      if (fallbackScript) {
        await page.removeScriptToEvaluateOnNewDocument(fallbackScript.identifier);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await enter();
        assert.deepEqual(await saved(), receipt);
        await activate('[data-lighting-inspect]');
        await scroll(map);
        await readyLightingView('webgl');
        await zoomLighting(zone.id);
        assert.deepEqual(await inspectLight(zone.id, 3, 12), premium);
        await screenshot('rangees-webgl');
      }
      return { width, touch, passed: true, standard, premium, reloaded, standardPayable, payable,
        cashAfterCents: receipt.cashCents, requestCount: 1, zone, renderer, inspectedRow, mobileWebgl: Boolean(fallbackScript) };
    }
    try {
      const url = origin + '/?compact&persist=' + (lightingOnly ? 'lighting-' : 'shop-first-') + Date.now();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await enter();
      const initial = await saved();
      if (process.argv.includes('--handling-only')) {
        const code = 'SIM-LOGISTICS-02';
        const imageReady = async () => page.$eval('[data-handling-marker="'+code+'"] image', async image => {
          const bitmap = new Image(); bitmap.src = image.href.baseVal;
          await bitmap.decode();
          if (!bitmap.naturalWidth || image.getBoundingClientRect().height < 24) throw Error('Illustration de manutention illisible.');
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await chooseProduct('logistics', code);
        await waitForMap();
        await activate('[data-fixture-cancel]');
        assert.equal((await saved()).cashCents, initial.cashCents);
        assert.equal((await requests()).length, 0);
        await chooseProduct('logistics', code);
        await waitForMap();
        await press('ArrowRight'); await press('ArrowDown');
        await imageReady();
        await screenshot('choix-case');
        if (touch) await cursorTap(); else await press('Enter');
        await page.waitForSelector(plan);
        assert.equal((await saved()).cashCents, initial.cashCents);
        await commitPlan();
        const paid = await saved();
        assert.deepEqual(paid.state.handlingPlacements, [{ code, x: 1, y: 1 }]);
        assert(paid.cashCents < initial.cashCents);
        await page.reload({ waitUntil:'domcontentloaded' });
        await enter();
        await page.waitForSelector('[data-handling-marker="'+code+'"][data-x="1"][data-y="1"]');
        await chooseProduct('logistics', code);
        await waitForMap();
        await press('ArrowRight');
        if (touch) await cursorTap(); else await press('Enter');
        await activate(plan+' [data-warehouse-action="save"]');
        await page.waitForFunction(() => window.__snapshot.revision === 3);
        const moved = await saved();
        assert.deepEqual(moved.state.handlingPlacements, [{ code, x: 2, y: 1 }]);
        assert.equal(moved.cashCents, paid.cashCents);
        await scroll(map);
        await imageReady();
        assert.equal(await page.$eval('body', element => element.innerText.includes('premier équipement')),false);
        await page.waitForFunction(() => [...document.querySelectorAll('h3')].some(heading => heading.textContent === 'Matériel en place'));
        await screenshot('emplacement-enregistre');
        checks.push({ width,touch,passed:true,chargeCents:initial.cashCents-paid.cashCents,moveChargeCents:0,position:moved.state.handlingPlacements[0] });
        continue;
      }
      if (lightingOnly) { checks.push(await lightingScenario(initial)); continue; }
      if (process.argv.includes('--climate-control-only')) { checks.push(await climateControlScenario(initial)); continue; }
      assert.equal(initial.cashCents, 100000);
      assert.equal(initial.state.zones.length + initial.state.serviceZones.length + initial.state.airPlacements.length + initial.state.equipment.length, 0);
      assert.match(await page.$eval(openShop, node => node.closest('[aria-label="Actions du plan"]').parentElement.innerText), /Budget\s*·\s*1\s*000/);
      assert.deepEqual(await area(), []);
      assert.equal((await requests()).length, 0);
      await scroll(map);
      await page.waitForSelector(map + ':not([data-renderer="loading"])');
      await screenshot('entrepot-vide');
      await activate(openShop);
      assert.equal(await page.$eval(shop + ' [data-warehouse-shop-category="substrate"]', node => node.getAttribute('aria-selected')), 'true');
      assert.equal(await page.$(target('starter')), null);
      await screenshot('boutique-support');
      await activate(product('SIM-SUBSTRATE-01'));
      await waitForMap();
      assert.deepEqual(await area(), [], 'Choisir un produit ne crée aucune zone');
      assert.deepEqual(await saved(), initial, 'La boutique ne débite pas le budget');
      await press('ArrowRight'); await press('ArrowDown');
      if (touch) await cursorTap();
      else { await press('Enter'); await press('Enter'); }
      await page.waitForSelector(zones);
      const [first] = await area();
      assert.deepEqual([first.width, first.depth], [1, 1]);

      await chooseProduct('substrate', 'SIM-SUBSTRATE-02');
      await activate('[data-warehouse-build-floor]');
      await scroll(map);
      await waitForMap();
      for (let step = 0; step < 5; step++) await press('ArrowRight');
      await press('ArrowDown');
      if (touch) await cursorTap();
      else { await press('Enter'); await press('Enter'); }
      await page.waitForFunction(selector => document.querySelectorAll(selector).length === 2, {}, zones);
      const [, second] = await area();
      assert.ok(second.id && first.id !== second.id);
      assert.deepEqual(await saved(), initial);

      await chooseProduct('lighting', 'SIM-LIGHT-02');
      await page.waitForSelector(target(first.id));
      await page.waitForSelector(target(second.id));
      await page.waitForFunction(() => document.activeElement.closest('[data-warehouse-placement="SIM-LIGHT-02"]') !== null);
      assert.equal(await page.$eval(target(first.id), node => {
        const bounds = node.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight;
      }), true, 'Les cibles restent visibles après la fermeture de la boutique');
      await screenshot('cibles-eclairage');
      await activate(target(first.id));
      await chooseProduct('control', 'SIM-CONTROL-UNIT-01');
      await page.waitForSelector(target(first.id));
      await page.waitForSelector(target(second.id));
      await activate(target(second.id));
      await page.waitForSelector('[data-warehouse-tool="resize"]:enabled');
      await activate('[data-warehouse-tool="resize"]');
      if (touch) { await scroll(map); await resizeTouch(second.id); }
      else { await page.focus(map); await press('ArrowRight'); }
      await page.waitForFunction((selector, id) => [...document.querySelectorAll(selector)].some(node => node.dataset.growFootprint === id && node.dataset.width === '2'), {}, zones, second.id);
      assert.deepEqual(await saved(), initial, 'Le tracé, les équipements et l’agrandissement restent au brouillon');
      assert.deepEqual(await requests(), []);
      await page.waitForSelector(plan);
      await chooseProduct('lighting', 'SIM-LIGHT-03');
      await activate(target(first.id));
      await page.waitForSelector(plan + ' [data-warehouse-plan-shortfall-cents]');
      const shortfall = await number(plan + ' [data-warehouse-plan-shortfall-cents]', 'data-warehouse-plan-shortfall-cents');
      assert.ok(shortfall > 0);
      assert.equal(await page.$eval(plan + ' [data-warehouse-action="save"]', node => node.disabled), true);
      assert.deepEqual(await requests(), []);
      await scroll(plan);
      await screenshot('budget-insuffisant');
      await chooseProduct('lighting', 'SIM-LIGHT-02');
      await activate(target(first.id));
      await page.waitForSelector(plan + ' [data-warehouse-plan-shortfall-cents]', { hidden: true });
      const payable = await number(plan + ' [data-warehouse-plan-payable-cents]', 'data-warehouse-plan-payable-cents');
      assert.ok(payable > 0 && payable < initial.cashCents);
      await scroll(plan);
      await screenshot('devis');
      await activate(plan + ' [data-warehouse-action="save"]');
      await page.waitForFunction(() => window.__snapshot.revision === 2);
      const receipt = await saved();
      const [firstZone, secondZone] = receipt.state.zones;
      assert.equal((await requests()).length, 1);
      assert.equal((await requests())[0].expectedCostCents, payable);
      assert.equal(receipt.cashCents, initial.cashCents - payable);
      assert.equal(firstZone.lightingCode, 'SIM-LIGHT-02');
      assert.ok(firstZone.optionCodes.includes('SIM-SUBSTRATE-01'));
      assert.ok(!firstZone.optionCodes.includes('SIM-CONTROL-UNIT-01'));
      assert.ok(secondZone.optionCodes.includes('SIM-SUBSTRATE-02') && secondZone.optionCodes.includes('SIM-CONTROL-UNIT-01'));
      assert.equal(secondZone.width * secondZone.height, 2);
      assert.equal(secondZone.lightingCode, 'UNLIT', 'Un support seul ne fournit pas d’éclairage');
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await enter();
      await page.waitForSelector(zones);
      assert.deepEqual(await saved(), receipt);
      assert.deepEqual(await area(), [{ id: first.id, width: first.width, depth: first.depth }, { id: second.id, width: 2, depth: 1 }]);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await scroll(map);
      await page.waitForSelector(map + ':not([data-renderer="loading"])');
      await screenshot('plan-recharge');
      checks.push({ width, touch, passed: true, initialCashCents: initial.cashCents, shortfall, payable, cashAfterCents: receipt.cashCents, requestCount: 1, zones: await area() });
    } catch (error) {
      checks.push({ width, touch, passed: false, error: error.stack });
      await screenshot('echec').catch(() => {});
      await writeFile(resolve(output, 'echec-' + width + '.txt'), await page.$eval('body', node => node.innerText).catch(() => ''));
    } finally { await page.close().catch(() => {}); }
  }
} finally {
  const passed = checks.length === 2 && checks.every(item => item.passed) && !errors.length && !blocked.length;
  await writeFile(resolve(output, 'rapport.json'), JSON.stringify({ passed, checks, errors, blocked }, null, 2));
  console.log(JSON.stringify({ passed, checks, errors, blocked }, null, 2));
  if (!passed) process.exitCode = 1;
  if (browser) await browser.close();
  server.httpServer?.closeAllConnections();
  await server.close();
}
`;
const runner = resolve(output, 'run.mjs');
const freshUrl = '/?compact&newWorkshop&persist=new-game';
const resetScenario = String.raw`
async function checkCleaning(browser, width) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height: width === 320 ? 740 : 900 });
    await page.evaluateOnNewDocument(() => {
      const originalNow = Date.now;
      Date.now = () => originalNow() + Number(sessionStorage.getItem('cleaning-test-time-offset') ?? 0);
    });
    const press = async selector => {
      await page.waitForSelector(selector + ':not(:disabled)', { visible: true });
      await page.focus(selector);
      await page.keyboard.press('Enter');
    };
    const enter = '[data-building="warehouse"] a[href="/arene/placard?view=workshop"]';
    const planAction = '[data-warehouse-action="cleaning"]';
    const panel = '[data-warehouse-cleaning][open]';
    const vacuum = panel + ' [data-warehouse-clean-step="vacuum"]';
    const mop = panel + ' [data-warehouse-clean-step="mop"]';
    const shop = '[data-warehouse-shop][open]';
    const read = () => page.evaluate(async () => (await fetch('/api/arena/placard/warehouse/preparations')).json());
    const openCleaning = async () => {
      await press(enter);
      await press(planAction);
      await page.waitForSelector(mop, { visible: true });
    };
    const reloadCleaning = async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await openCleaning();
    };
    await page.goto(origin + '/?compact&newWorkshop&persist=cleaning-' + width, { waitUntil: 'domcontentloaded' });
    await openCleaning();
    assert.equal((await read()).entranceAirlock, false);
    assert.equal(await page.$eval(vacuum, node => node.disabled), true);
    assert.equal(await page.$eval(mop, node => node.disabled), true);
    assert.ok(await page.$eval(panel, node => node.textContent.includes('Aménager')));
    await page.keyboard.press('Escape');
    await page.waitForSelector(panel, { hidden: true });
    await press('[data-warehouse-build-shop]');
    await press(shop + ' [data-warehouse-shop-category="hygiene"]');
    for (const code of ['WAREHOUSE-VACUUM', 'WAREHOUSE-MOP']) {
      const tool = shop + ' [data-warehouse-supply="' + code + '"]';
      await press(tool + ' button');
      await page.waitForFunction(selector => document.querySelector(selector)?.textContent.includes('Possédé'), {}, tool);
    }
    assert.equal(await page.$(shop + ' [data-warehouse-clean-step]'), null);
    await press(shop + ' [aria-label="Fermer le catalogue"]');
    await press(planAction);
    await page.waitForSelector(vacuum + ':enabled');
    assert.equal(await page.$eval(mop, node => node.disabled), true);
    const initial = await read();
    const toolPrice = initial.items.filter(item => item.kind === 'equipment').reduce((sum, item) => sum + item.priceCents, 0);
    assert.equal(initial.cashCents, 100000 - toolPrice);
    const choice = width === 320 ? 'auto' : 'player';
    await page.select(panel + ' select', choice);
    await press(vacuum);
    await page.waitForFunction(() => window.__snapshot.previewCleaning?.vacuum.pending);
    const pending = (await read()).cleaning.vacuum.pending;
    assert.equal(pending.workChoice, 'player');
    assert.equal(Date.parse(pending.endsAt) - Date.parse(pending.startsAt), 5 * 60000);
    await reloadCleaning();
    assert.deepEqual((await read()).cleaning.vacuum.pending, pending);
    assert.ok(await page.$eval(panel, node => node.textContent.includes('En cours · Toi')));
    assert.ok(await page.$eval(panel, node => node.textContent.includes('15 %')));
    assert.equal(await page.$eval(vacuum, node => node.disabled), true);
    assert.equal(await page.$eval(mop, node => node.disabled), true);
    await page.screenshot({ path: resolve(output, 'nettoyage-' + width + '.png') });
    await page.evaluate(() => sessionStorage.setItem('cleaning-test-time-offset', 5 * 60000));
    await reloadCleaning();
    const active = (await read()).cleaning.vacuum;
    assert.equal(active.completedAt, pending.endsAt);
    assert.equal(Date.parse(active.expiresAt) - Date.parse(active.completedAt), 28 * 3600000);
    await press(mop);
    await page.waitForFunction(() => window.__snapshot.previewCleaning?.mop.pending);
    const after = await read();
    assert.equal(after.cashCents, initial.cashCents);
    assert.equal(Date.parse(after.cleaning.mop.pending.endsAt) - Date.parse(after.cleaning.mop.pending.startsAt), 10 * 60000);
    await page.evaluate(() => sessionStorage.setItem('cleaning-test-time-offset', 15 * 60000));
    await reloadCleaning();
    assert.equal((await read()).cleaning.mop.completedAt, after.cleaning.mop.pending.endsAt);
    await page.evaluate(() => sessionStorage.setItem('cleaning-test-time-offset', 28 * 3600000));
    await reloadCleaning();
    const almostExpired = await read();
    assert.ok(Date.parse(almostExpired.cleaning.vacuum.expiresAt) > Date.parse(almostExpired.serverNow));
    assert.equal(await page.$eval(mop, node => node.disabled), true, 'L’aspiration expire avant la fin du lavage');
    return { width, entranceAirlock: initial.entranceAirlock, toolsCents: toolPrice, cashCents: after.cashCents, choice, assignedTo: pending.workChoice, vacuumMinutes: 5, mopMinutes: 10 };
  } finally {
    await page.close();
  }
}
let browser;
try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(30000);
  const blocked = [];
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === origin || url.protocol === 'data:') void request.continue();
    else { blocked.push(url.origin); void request.abort(); }
  });
  await page.goto(origin + ${JSON.stringify(freshUrl)}, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-warehouse-preview-reset]');
  const purchase = await page.evaluate(async () => {
    const initial = structuredClone(window.__snapshot);
    sessionStorage.setItem('local-auth-fixture', 'signed-in');
    localStorage.setItem('local-commerce-fixture', '{"orderId":"simulation","paidCents":2600}');
    sessionStorage.setItem('lcb:warehouse-draft:v1:unrelated-owner', 'protected draft');
    const state = { ...initial.state, optionInventory: [{ code: 'SIM-LOGISTICS-02', quantity: 1 }], handlingPlacements: [{ code: 'SIM-LOGISTICS-02', x: 1, y: 1 }] };
    const response = await fetch('/api/arena/placard/warehouse', { method: 'POST', body: JSON.stringify({
      expectedRevision: initial.revision, state, expectedCostCents: ${retail['SIM-LOGISTICS-02'].unitPriceCents}, requestKey: crypto.randomUUID(),
    }) });
    const bought = await response.json();
    sessionStorage.setItem('lcb:warehouse-draft:v1:warehouse-preview', 'draft fixture');
    return { initial, bought };
  });
  assert.equal(purchase.bought.cashCents, 100000 - ${retail['SIM-LOGISTICS-02'].unitPriceCents});
  assert.equal(purchase.bought.revision, 2);
  const reopen = () => page.goto(origin + ${JSON.stringify(freshUrl + '&rayon=nutrition')}, { waitUntil: 'domcontentloaded' });
  await reopen();
  await page.waitForFunction(() => window.__snapshot?.revision === 2);
  const press = async selector => {
    await page.waitForSelector(selector, { visible: true });
    await page.focus(selector);
    await page.keyboard.press('Enter');
  };
  await page.evaluate(() => sessionStorage.setItem('audit-preparation-interruption', 'after'));
  await press('[data-warehouse-buy-pack="CARE-IRON"]');
  await page.waitForFunction(() => document.body.textContent.includes('Vérifier l’opération'));
  const boughtPack = await page.evaluate(() => ({
    cash: window.__snapshot.cashCents, requestKey: Object.keys(window.__snapshot.previewPackReceipts)[0],
    products: document.querySelectorAll('[data-warehouse-buy-pack]').length,
  }));
  assert.equal(boughtPack.cash, purchase.bought.cashCents - 1390);
  assert.equal(boughtPack.products, 18);
  const verify = 'button::-p-text(Vérifier l’opération)';
  await page.evaluate(() => sessionStorage.setItem('audit-preparation-account', 'warehouse-preview-other'));
  await reopen();
  await page.waitForSelector('[data-warehouse-supply="CARE-IRON"] [data-supply-stock="0"]');
  assert.equal(await page.$(verify), null, 'the other account never receives the pending operation');
  assert.equal(await page.evaluate(() => window.__preparationAttempts?.length ?? 0), 0);
  await page.evaluate(() => sessionStorage.removeItem('audit-preparation-account'));
  await reopen();
  await page.waitForSelector('[data-warehouse-supply="CARE-IRON"] [data-supply-stock="100"]');
  await page.waitForSelector(verify);
  assert.equal(await page.evaluate(() => window.__preparationAttempts?.length ?? 0), 0, 'loading the register does not submit the command');
  await page.click(verify);
  await page.waitForSelector(verify, { hidden: true });
  assert.deepEqual(await page.evaluate(() => window.__preparationAttempts), [boughtPack.requestKey]);
  assert.equal(await page.evaluate(() => window.__snapshot.cashCents), boughtPack.cash);

  await page.evaluate(() => sessionStorage.setItem('audit-preparation-interruption', 'before'));
  await press('[data-warehouse-buy-pack="CARE-IRON"]');
  await page.waitForSelector(verify);
  const outdated = await page.evaluate(() => window.__preparationAttempts.at(-1));
  await page.evaluate(() => sessionStorage.setItem('audit-preparation-new-price', '1'));
  await reopen();
  await page.waitForSelector(verify);
  await page.click(verify);
  await page.waitForFunction(() => document.body.textContent.includes('Le prix a changé.'));
  assert.deepEqual(await page.evaluate(() => window.__preparationAttempts), [outdated]);
  assert.equal(await page.$(verify), null, 'expired quote resolves the uncertain operation');
  assert.equal(await page.evaluate(() => window.__snapshot.cashCents), boughtPack.cash);
  await page.evaluate(() => sessionStorage.removeItem('audit-preparation-new-price'));
  const replay = await page.evaluate(async key => {
    const path = '/api/arena/placard/warehouse/preparations';
    const order = { action: 'purchasePack', code: 'CARE-IRON', quantity: 1, expectedCents: 1390, requestKey: key };
    const post = async body => fetch(path, { method: 'POST', body: JSON.stringify(body) });
    const repeated = await (await post(order)).json();
    const stale = await post({ ...order, expectedCents: 1, requestKey: crypto.randomUUID() });
    return { cash: repeated.cashCents, stock: repeated.items.find(item => item.code === order.code).availableQuantity, stale: stale.status };
  }, boughtPack.requestKey);
  assert.deepEqual(replay, { cash: boughtPack.cash, stock: 100, stale: 409 });
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]', { hidden: true });
  page.once('dialog', dialog => void dialog.accept());
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('[data-warehouse-preview-reset]')]);
  await page.waitForFunction(() => window.__snapshot?.revision === 1);
  const result = await page.evaluate(() => ({
    state: window.__snapshot, receipts: Object.keys(window.__receipts), draft: sessionStorage.getItem('lcb:warehouse-draft:v1:warehouse-preview'),
    auth: sessionStorage.getItem('local-auth-fixture'), commerce: localStorage.getItem('local-commerce-fixture'),
    unrelatedDraft: sessionStorage.getItem('lcb:warehouse-draft:v1:unrelated-owner'),
  }));
  assert.deepEqual(result.state, purchase.initial);
  assert.deepEqual(result.receipts, []);
  assert.equal(result.draft, null);
  assert.equal(result.auth, 'signed-in');
  assert.deepEqual(JSON.parse(result.commerce), { orderId: 'simulation', paidCents: 2600 });
  assert.equal(result.unrelatedDraft, 'protected draft');
  assert.deepEqual(blocked, []);
  const report = { cashCents: result.state.cashCents, floor: result.state.state.floor, zones: result.state.state.zones.length,
    equipment: result.state.state.equipment.length, stockGrams: result.state.stockGrams, activeRuns: result.state.activeRuns.length,
    receipts: result.receipts.length, previewPacks: { products: boughtPack.products, persistedCharges: replay.stock, cashAfterCents: replay.cash },
    recoveredCommand: boughtPack.requestKey, rejectedExpiredCommand: outdated, otherAccountUntouched: true,
    fixtureAccountPreserved: true, fixtureOrderPreserved: true, cleaning: [] };
  if (!${recoveryOnly}) for (const width of [1440, 320]) report.cleaning.push(await checkCleaning(browser, width));
  await writeFile(resolve(output,'rapport.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  server.httpServer?.closeAllConnections();
  await server.close();
}
`;
await writeFile(runner, fixture + (preview ? `console.log('Aménagement et achats au devis · partie isolée — ' + origin + ${JSON.stringify(freshUrl)});` : resetAudit ? resetScenario : scenarios));
await import(pathToFileURL(runner).href);
