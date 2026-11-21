// Chromium exercises the real security UI with a local API fixture.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const output = resolve("output/warehouse-security");
const retail = JSON.parse(await readFile("src/lib/kanab-quest-warehouse-retail-supplies.json", "utf8"));
const prices = {
  cameraCents: retail["WAREHOUSE-CAMERA"].unitPriceCents,
  alarmCents: retail["WAREHOUSE-ALARM"].unitPriceCents,
  monitoringCents: retail["WAREHOUSE-MONITORING"].unitPriceCents,
};
await mkdir(output, { recursive: true });
const fixture = (await readFile("scripts/audit-placard-warehouse-v4.mjs", "utf8"))
  .split("if(process.argv.includes('--preview'))")[0]
  .replace("'output/warehouse-v4'", "'output/warehouse-security'")
  .replace("?? 3248", "?? 3433")
  .replace("import {KqWarehouse} from '/src/components/placard/KqWarehouse';", "import {KqWarehouseShop} from '/src/components/placard/KqWarehouseShop';")
  .replace("export default function Link", "export const useLinkStatus=()=>({pending:false}); export default function Link")
  .replace("    window.__closeCount=0;", `
    const savedSecurity = sessionStorage.getItem('security-'+query.get('persist'));
    const baseline = window.__snapshot.state;
    const layout = getKqWarehouseQuote({ ...baseline, zones: [
      { ...baseline.zones[0], x: 1, y: 3, width: 2, height: 3, name: 'Culture ouest' },
      { ...baseline.zones[0], id: 'est', x: 6, y: 3, width: 2, height: 3, name: 'Culture est' },
    ], partitions: [{ id: 'wall', x: 4, y: 1, axis: 'y', length: 8 }],
    stationPlacements: [{ id: 'station', code: 'SIM-WATER-03', x: 2, y: 8 }] }).nextState;
    window.__snapshot.state = layout;
    window.__security = savedSecurity ? JSON.parse(savedSecurity) : {
      layout, layoutRevision: 1, revision: 0, cashCents: window.__snapshot.cashCents,
      prices: ${JSON.stringify(prices)}, cameras: [], alarm: 'none',
      monitoring: {status:'none',enabled:false,paidUntil:null},
    };
    window.__snapshot.cashCents = window.__security.cashCents;
    const fixtureFetch = window.fetch;
    window.fetch = async (url, init = {}) => {
      if (url !== '/api/arena/placard/warehouse/security') return fixtureFetch(url, init);
      const security = window.__security;
      if (!init.method) return Response.json(security);
      const input = JSON.parse(init.body);
      const { action, cameraId, placement } = input.command;
      if (action === 'buy-camera') security.cameras.push({id:input.requestKey,placement:null});
      if (action === 'buy-place-camera') security.cameras.push({id:input.requestKey,placement});
      if (action === 'place-camera') security.cameras.find(camera => camera.id === cameraId).placement = placement;
      if (action === 'buy-alarm') security.alarm = 'owned';
      if (action === 'buy-install-alarm') security.alarm = 'installed';
      if (action === 'install-alarm') security.alarm = 'installed';
      if (action === 'subscribe') security.monitoring = {status:'active',enabled:true,paidUntil:security.monitoring.paidUntil || new Date(Date.now()+432000000).toISOString()};
      if (action === 'pause') security.monitoring = {...security.monitoring,status:'suspended',enabled:false};
      if (action === 'cancel') security.monitoring = {...security.monitoring,status:'cancelled'};
      security.cashCents -= input.expectedChargeCents;
      security.revision++;
      window.__snapshot.cashCents = security.cashCents;
      sessionStorage.setItem('security-'+query.get('persist'), JSON.stringify(security));
      return Response.json({...security,receipt:{chargedCents:input.expectedChargeCents,replayed:false}});
    };
    window.__closeCount=0;`)
  .replace(/    function Fixture\(\)\{[^\n]+/, `
    function Fixture(){
      const [open,setOpen]=React.useState(true);
      const [cashCents,setCashCents]=React.useState(window.__snapshot.cashCents);
      return <KqWarehouseShop open={open} onClose={()=>setOpen(false)} state={layout} installedState={layout} initialDepartment="security"
        locked={false} cashCents={cashCents} migrationCreditCents={0} onChooseProduct={()=>{}} onAcquireHandling={()=>{}} onOpenWorkshop={()=>{}} onPaid={setCashCents}/>;
    }`);

const scenarios = String.raw`
const checks = [], errors = [], blocked = [];
let browser;
const shop = 'dialog[data-warehouse-shop][open]';
const tab = shop + ' [data-warehouse-shop-category="security"]';
const security = '[data-warehouse-security]';
try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, protocolTimeout: 60000,
    args: ['--no-sandbox', '--disable-webgl'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.origin === origin && !url.pathname.startsWith('/api/')) void request.continue();
    else { blocked.push(request.url()); void request.abort(); }
  });
  for (const width of [1440, 320]) {
    const touch = width === 320;
    const click = async selector => {
      await page.waitForSelector(selector, { visible: true });
      await page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      if (touch) await page.tap(selector);
      else { await page.focus(selector); await page.keyboard.press('Enter'); }
    };
    const button = async text => {
      const handle = await page.waitForFunction((root, label) => [...document.querySelectorAll(root+' button')].find(node => {
        const name = (node.getAttribute('aria-label') || node.textContent).trim();
        return !node.disabled && (name === label || name.startsWith(label+' ·'));
      }), {polling:'raf'}, security, text);
      const element = handle.asElement();
      await element.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      if (touch) await element.tap();
      else { await element.focus(); await page.keyboard.press('Enter'); }
      await handle.dispose();
    };
    const photo = piece => page.screenshot({path:resolve(output, piece+'-'+width+'.png')});
    try {
      await page.setViewport({ width, height: touch ? 760 : 950, isMobile: touch, hasTouch: touch });
      await page.goto(origin+'/?compact&persist=security-'+width, {waitUntil:'domcontentloaded'});
      await click(tab);
      await page.waitForSelector(security+' [aria-label^="Colonne 1, ligne 5"]');
      assert.equal(await page.$$(security+' [aria-label^="Colonne "]').then(cells => cells.length), 100);
      assert.equal(await page.$$(security+' [aria-label^="Colonne "][tabindex="0"]').then(cells => cells.length), 1);
      await button('Acheter une caméra');
      await page.waitForSelector('[data-camera-install]');
      assert.equal(await page.evaluate(() => window.__security.cameras.length),0);
      await page.waitForFunction(() => document.activeElement.matches('[data-camera-install] button[aria-label^="Colonne "]:not([aria-disabled])'));
      await button('Retour à la boutique');
      assert.equal(await page.evaluate(() => window.__security.cashCents),1500000);
      await button('Acheter une caméra');
      await page.waitForSelector('[aria-label="Orientation de la nouvelle caméra"]');
      await page.select('[aria-label="Orientation de la nouvelle caméra"]', '2');
      const camera = security+' [aria-label^="Colonne 1, ligne 5"]';
      if (touch) await click(camera);
      else {
        await page.focus(security+' [aria-label^="Colonne 1, ligne 4"]');
        await page.keyboard.press('ArrowDown');
        assert.ok(await page.evaluate(() => document.activeElement.getAttribute('aria-label').startsWith('Colonne 1, ligne 5')));
        await page.keyboard.press('Enter');
      }
      await page.waitForSelector(security+' [data-preview="true"]');
      await photo('choisir-case');
      await button('Confirmer l’achat et la pose');
      await page.waitForSelector(security+' [data-filmed="true"]');
      assert.equal(await page.evaluate(() => window.__security.cameras.length),1);
      assert.equal(await page.$(security+' [aria-label^="Colonne 7, ligne 5"][data-filmed="true"]'), null);
      assert.ok(await page.$(security+' [aria-label^="Colonne 2, ligne 5"][data-filmed="true"]'));
      await page.$eval(security+' figure', node => node.scrollIntoView({block:'center'}));
      await photo('plan');
      await button('Acheter et installer à la porte sud');
      await button('Confirmer');
      await button('Activer');
      await button('Confirmer');
      await button('Suspendre');
      await button('Reprendre');
      await button('Confirmer');
      await page.waitForFunction(() => window.__security.monitoring.status === 'active');
      assert.equal(await page.evaluate(() => window.__security.cashCents), ${1500000 - prices.cameraCents - prices.alarmCents - prices.monitoringCents});
      await button('Résilier');
      await button('Confirmer');
      await page.waitForFunction(() => window.__security.monitoring.status === 'cancelled');
      await page.$eval(security+' time', node => node.scrollIntoView({block:'center'}));
      await photo('abonnement');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.reload({waitUntil:'domcontentloaded'});
      await click(tab);
      await page.waitForSelector(security+' [data-placed="true"]');
      assert.match(await page.$eval(security, root => root.textContent), /Résiliée à l’échéance/);
      checks.push({width, touch, passed:true});
    } catch (error) {
      checks.push({width, touch, passed:false, error:error.stack});
      await photo('echec').catch(() => {});
      await writeFile(resolve(output, 'echec-'+width+'.txt'), await page.$eval('body', node => node.innerText).catch(() => ''));
    }
  }
} finally {
  const passed = checks.length === 2 && checks.every(item => item.passed) && !errors.length && !blocked.length;
  const result = {passed, checks, errors, blocked};
  await writeFile(resolve(output,'rapport.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  if (!passed) process.exitCode = 1;
  if (browser) await browser.close();
  server.httpServer?.closeAllConnections();
  await server.close();
}
`;

const runner = resolve(output, "run.mjs");
await writeFile(runner, fixture + scenarios);
await import(pathToFileURL(runner).href);
