/** Actual workshop UI, synthetic equipment API only: no credentials or live writes. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/visual-workshop');
const port = Number(process.env.KQ_WORKSHOP_AUDIT_PORT ?? 3272);
const origin = `http://127.0.0.1:${port}`;
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,style,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%',...style}:style}/>;}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'link-stub': `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>;}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
  'next/dynamic': `import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(()=>load().then(value=>({default:value.default??value})));return props=><Suspense fallback={null}><C {...props}/></Suspense>;}`,
  'visual-workshop-entry': `
    import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KqWarehouseEntry} from '/src/components/placard/KqWarehouseEntry';
    import {createChanvrierCareerSnapshot} from '/src/lib/chanvrier-career';
    import {KQ_EQUIPMENT_CATALOG,KQ_STARTING_EQUIPMENT_CODES,getKqEquipmentDefinition,getKqEquipmentUpgradeCost,isKqSharedEquipment} from '/src/lib/kanab-quest-equipment';
    import {getKqMachineCondition} from '/src/lib/kanab-quest-maintenance';
    import {getKqWorkshopTierPrice} from '/src/lib/kanab-quest-workshop-machines';
    const query=new URLSearchParams(location.search),purchased=['SIFT-TRAY','WASHER-25L','AUTO-SIEVE','PRESS-0600'];
    const career=createChanvrierCareerSnapshot({xp:query.has('novice')?0:100000,completedCultures:150,processingPractice:query.has('novice')?{}:{sifting:30,washing:30,pressing:30}});
    window.__state={catalog:KQ_EQUIPMENT_CATALOG,career,productionUnits:1,tentNumber:1,tents:[],reputation:10000,routePlan:null,
      ownedCodes:[...KQ_STARTING_EQUIPMENT_CODES,...purchased],purchasedCodes:purchased,equippedCodes:[...KQ_STARTING_EQUIPMENT_CODES,'SIFT-TRAY','WASHER-25L','PRESS-0600'],
      levels:{'SIFT-TRAY':1,'WASHER-25L':9,'AUTO-SIEVE':4,'PRESS-0600':3},cashCents:query.has('poor')?0:20000000,
      maintenance:{'SIFT-TRAY':getKqMachineCondition('SIFT-TRAY',1,0,1),'WASHER-25L':getKqMachineCondition('WASHER-25L',9,3,1),'AUTO-SIEVE':getKqMachineCondition('AUTO-SIEVE',4,1,1),'PRESS-0600':getKqMachineCondition('PRESS-0600',3,2,1)}};
    window.__requests=[];window.__reads=0;window.__fail=false;window.__delay=80;window.__closeCount=0;window.__shop=null;
    const original=window.fetch.bind(window);window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return original(url,init);
      if(!String(url).startsWith('/api/arena/placard/equipment'))throw new Error('Unexpected API endpoint: '+url);
      await new Promise(resolve=>setTimeout(resolve,window.__delay));const state=window.__state;
      if(init.method!=='PATCH'){window.__reads++;return new Response(JSON.stringify({...state,sharedEquipment:{ownedCodes:state.ownedCodes.filter(isKqSharedEquipment),purchasedCodes:state.purchasedCodes.filter(isKqSharedEquipment),equippedCodes:state.equippedCodes.filter(isKqSharedEquipment),levels:state.levels,maintenance:state.maintenance}}));}
      const body=JSON.parse(init.body);window.__requests.push(body);
      if(window.__fail){window.__fail=false;return new Response(JSON.stringify({error:'Connexion interrompue. Réessaie.'}),{status:503});}
      const definition=getKqEquipmentDefinition(body.equipmentCode),current=state.levels[body.equipmentCode]??0;
      if(body.action==='upgrade'){
        const price=getKqEquipmentUpgradeCost(body.equipmentCode,current);
        if(current!==body.expectedLevel||price===null||price>state.cashCents)return new Response('{}',{status:409});
        state.levels[body.equipmentCode]=current+1;state.cashCents-=price;
        const condition=state.maintenance[body.equipmentCode];state.maintenance[body.equipmentCode]=getKqMachineCondition(body.equipmentCode,current+1,condition?.cycles??0,condition?.version??0);
        return new Response(JSON.stringify({level:current+1}));
      }
      if(body.action==='workshop-tier'){
        const price=getKqWorkshopTierPrice(body.equipmentCode,definition.priceCents,body.targetLevel,current);
        if(current!==body.expectedLevel||price!==body.expectedPriceCents||price===null||price>state.cashCents)return new Response('{}',{status:409});
        if(!current){state.ownedCodes.push(body.equipmentCode);state.purchasedCodes.push(body.equipmentCode);}
        state.levels[body.equipmentCode]=body.targetLevel;state.cashCents-=price;
        const condition=state.maintenance[body.equipmentCode];state.maintenance[body.equipmentCode]=getKqMachineCondition(body.equipmentCode,body.targetLevel,condition?.cycles??0,condition?.version??0);
        return new Response(JSON.stringify({level:body.targetLevel,priceCents:price}));
      }
      if(body.action==='repair'){
        const condition=state.maintenance[body.equipmentCode];
        if(condition.version!==body.expectedVersion||condition.repairCents!==body.expectedCostCents)return new Response('{}',{status:409});
        state.cashCents-=condition.repairCents;state.maintenance[body.equipmentCode]={...condition,cycles:0,remaining:condition.interval,due:false,version:condition.version+1};return new Response(JSON.stringify({repaired:true}));
      }
      if(!state.purchasedCodes.includes(body.equipmentCode))return new Response('{}',{status:403});
      state.equippedCodes=state.equippedCodes.filter(code=>getKqEquipmentDefinition(code)?.slot!==definition.slot).concat(body.equipmentCode);return new Response(JSON.stringify({equipped:true}));
    };
    createRoot(document.getElementById('root')).render(<main><KqWarehouseEntry embedded={!query.has('modal')} workshopOnly initialEquipmentCode={query.get('machine')??undefined} onClose={()=>{window.__closeCount++;}} onOpenShop={code=>{window.__shop=code??true;}}/></main>);
  `,
};
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
  resolve: { alias: { '@': resolve(root, 'src') } }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'visual-workshop-audit', enforce: 'pre',
    resolveId(id) {
      if (id in modules) return '\0' + id;
      if (id.endsWith('/public/placard/warehouse-v2/manifest.json')) return '\0warehouse-assets';
      if (id.endsWith('/components/navigation/NavigationLink')) return '\0link-stub';
    },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atelier visuel · audit local</title><style>:root{--font-display:Impact;--font-sans:Arial;--font-body:Arial}body{margin:0;background:#fff2d3}main{width:min(1500px,100%);margin:auto}</style><div id="root"></div><script type="module" src="/@id/__x00__visual-workshop-entry"></script></html>');
      });
    },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

const slots = ['sifting', 'washing', 'filtration', 'static-separation', 'press', 'drying'];
const dialog = '[data-workshop-machine-dialog][open]';
const summary = `${dialog} [data-workshop-machine-summary]`;
let browser;
let page;
const errors = [], results = [];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.setRequestInterception(true);
  page.on('request', request => void (request.url().startsWith(origin) || request.url().startsWith('data:') ? request.continue() : request.abort()));
  const visit = async (query = '') => {
    await page.goto(`${origin}/?${query}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-warehouse-slot="press"]:not(:disabled)');
  };
  const screenshot = async name => {
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode().catch(() => {}))));
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  };
  const clickButton = async (prefix, scope = dialog) => {
    const handle = await page.evaluateHandle(({ prefix, scope }) => [...document.querySelectorAll(`${scope} button`)].find(button => button.textContent.trim().startsWith(prefix)), { prefix, scope });
    assert.ok(handle.asElement(), `Button starting with ${prefix}`);
    assert.equal(await handle.evaluate(button => button.disabled), false, `${prefix} must be enabled`);
    await handle.asElement().click();
  };
  const openMachine = async slot => {
    await page.waitForSelector(`[data-warehouse-slot="${slot}"]:not(:disabled)`);
    await page.click(`[data-warehouse-slot="${slot}"]`);
    await page.waitForSelector(dialog);
    assert.equal(await page.$eval(dialog, element => element.contains(document.activeElement)), true, 'Opening a machine moves focus into its popup');
  };
  const closeMachine = async slot => {
    await page.waitForSelector(`${dialog} button[aria-label="Fermer la fiche de la machine"]:not(:disabled)`);
    await page.keyboard.press('Escape');
    await page.waitForSelector(dialog, { hidden: true });
    await page.waitForFunction(slot => document.activeElement?.getAttribute('data-warehouse-slot') === slot, {}, slot);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-warehouse-slot')), slot, 'Escape restores focus to the selected machine');
  };
  const layout = async () => page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => image.src),
  }));
  const assertUnifiedSummary = async (level, cycles, interval, maximum = false) => {
    await page.waitForSelector(summary, { visible: true });
    const state = await page.$eval(summary, (element, maximum) => {
      const upgrade = element.querySelector('[data-machine-upgrade]');
      const maintenance = element.querySelector('[data-machine-maintenance]');
      const displayed = control => !!control && control.getClientRects().length > 0 && !control.closest('details:not([open])') && getComputedStyle(control).visibility !== 'hidden';
      const levelBar = element.querySelector('[aria-label="Niveau du matériel"]');
      const healthBar = element.querySelector('[aria-label="État de la machine"]');
      const wearCount = element.querySelector('[aria-label="Entretien de la machine"] dd')?.textContent.trim();
      return {
        details: element.querySelectorAll('details').length,
        hiddenByDetails: !!element.closest('details:not([open])'),
        level: Number(levelBar?.getAttribute('aria-valuenow')),
        wearCount,
        health: Number(healthBar?.getAttribute('aria-valuenow')),
        upgradeVisible: displayed(upgrade),
        atMaximum: maximum ? upgrade.disabled && upgrade.textContent.includes('Niveau maximum') : false,
        maintenanceVisible: displayed(maintenance),
      };
    }, maximum);
    assert.deepEqual(state, { details: 0, hiddenByDetails: false, level, wearCount: `${cycles} / ${interval}`, health: Math.round((interval - cycles) / interval * 100), upgradeVisible: true, atMaximum: maximum, maintenanceVisible: true }, 'Level and maintenance are drawn together, with direct actions and no dropdown');
    assert.equal(await page.$$eval(`${dialog} details`, elements => elements.some(element => element.textContent.includes('Réglages fins'))), false, 'No separate upgrade-only dropdown remains in the machine popup');
  };

  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: width < 700 ? 844 : 1000, isMobile: width < 700, hasTouch: width < 700 });
    await visit();
    assert.equal(await page.$(dialog), null, 'The workshop initially shows the whole room');
    assert.deepEqual(await page.$$eval('[data-warehouse-slot]', elements => elements.map(element => element.dataset.warehouseSlot)), slots);
    await screenshot(`room-${width}`);
    const geometry = await page.$$eval('[data-warehouse-slot]', elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { slot: element.dataset.warehouseSlot, owned: element.dataset.owned, installed: element.dataset.installed, level: element.dataset.level, width: box.width, height: box.height };
    }));
    assert.equal(geometry.find(item => item.slot === 'press').owned, 'true');
    assert.equal(geometry.find(item => item.slot === 'filtration').installed, 'false');
    assert.equal(geometry.find(item => item.slot === 'drying').owned, 'false');
    const pressWidth = geometry.find(item => item.slot === 'press').width;
    const washerWidth = geometry.find(item => item.slot === 'washing').width;
    assert.ok(Math.abs(pressWidth / washerWidth - .24 / .5) < .01, 'Machine footprints use a common metre-based scale');
    assert.equal(await page.$eval('[data-warehouse-slot="filtration"] [data-workshop-sprite]', element => getComputedStyle(element).opacity), '1', 'Owned reserve equipment is solid');
    assert.ok(await page.$eval('[data-warehouse-slot="drying"] [data-workshop-sprite]', element => Number(getComputedStyle(element).opacity) < .5), 'Missing equipment stays transparent');
    const checks = await layout();
    assert.equal(checks.overflow, false, `No page overflow at ${width}px`);
    assert.deepEqual(checks.brokenImages, []);
    for (const slot of slots) {
      await openMachine(slot);
      assert.equal((await layout()).overflow, false, `${slot} popup fits at ${width}px`);
      if (slot === 'washing') {
        await assertUnifiedSummary(9, 3, 20);
        await screenshot(`washer-summary-${width}`);
      }
      await closeMachine(slot);
    }
    await openMachine('press');
    await screenshot(`press-popup-${width}`);
    // Native modal must wrap forward and reverse keyboard navigation.
    const last = await page.$eval(dialog, element => {
      const controls = [...element.querySelectorAll('button:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(control => control.getClientRects().length > 0);
      controls.at(-1).focus();return controls.at(-1).textContent;
    });
    assert.ok(last);
    await page.keyboard.press('Tab');
    assert.equal(await page.$eval(dialog, element => element.contains(document.activeElement)), true, 'Tab remains in the popup');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.$eval(dialog, element => element.contains(document.activeElement)), true, 'Further keyboard navigation remains in the popup');
    await closeMachine('press');
    await page.click('button[aria-label="Agrandir l’atelier"]');
    await page.waitForSelector('[data-zoomed="true"]');
    assert.equal(await page.$eval('[data-zoomed="true"]', element => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight), true, 'Zoom provides an internally scrollable workshop');
    assert.equal((await layout()).overflow, false, 'Zoom never overflows the page');
    if (width === 390) await screenshot('room-zoom-390');
    await page.click('button[aria-label="Voir tout l’atelier"]');
    results.push({ width, geometry, ...checks, allSixMachinesClickable: true, escapeAndFocus: true, zoom: true });
  }

  await page.setViewport({ width: 1440, height: 1000 });
  await visit();
  const restingGlow = await page.$eval('[data-warehouse-slot="press"]', element => getComputedStyle(element.firstElementChild).borderColor);
  await page.hover('[data-warehouse-slot="press"]');
  await page.waitForFunction(resting => getComputedStyle(document.querySelector('[data-warehouse-slot="press"]').firstElementChild).borderColor !== resting, {}, restingGlow);
  await screenshot('hover-press-desktop');
  await openMachine('press');
  await assertUnifiedSummary(3, 2, 10);
  await page.evaluate(() => { window.__fail = true; });
  await clickButton('Améliorer · niv. 4');
  await page.waitForFunction(() => document.querySelector('[data-workshop-machine-dialog][open]')?.textContent.includes('Connexion interrompue'));
  assert.equal(await page.$eval('[data-warehouse-slot="press"]', element => element.dataset.level), '3');
  await clickButton('Améliorer · niv. 4');
  await page.waitForSelector('[data-warehouse-slot="press"][data-level="4"]');
  await page.waitForFunction(() => document.querySelector('[data-workshop-machine-dialog][open]')?.contains(document.activeElement));
  assert.equal(await page.$eval(dialog, element => element.contains(document.activeElement)), true, 'Refresh preserves focus inside the popup');
  assert.equal(await page.evaluate(() => window.__requests[0].requestKey === window.__requests[1].requestKey), true, 'Failed upgrade retry keeps its idempotency key');
  await screenshot('press-upgraded');
  await clickButton('Entretenir');
  await page.waitForFunction(() => window.__state.maintenance['PRESS-0600'].cycles === 0);
  await page.waitForFunction(() => document.querySelector('[data-workshop-machine-dialog][open] [aria-label="État de la machine"]')?.getAttribute('aria-valuenow') === '100');
  await assertUnifiedSummary(4, 0, 10);
  assert.equal(await page.$eval(`${summary} [data-machine-maintenance]`, button => button.disabled), true, 'Freshly maintained machines keep a disabled up-to-date maintenance action');
  await closeMachine('press');
  await openMachine('washing');
  await assertUnifiedSummary(9, 3, 20);
  await clickButton('Améliorer · niv. 10');
  await page.waitForSelector('[data-warehouse-slot="washing"][data-level="10"]');
  await assertUnifiedSummary(10, 3, 20, true);
  assert.equal(await page.evaluate(() => window.__state.maintenance['WASHER-25L'].cycles), 3, 'Upgrading keeps existing wear');
  await clickButton('Entretenir');
  await page.waitForFunction(() => window.__state.maintenance['WASHER-25L'].cycles === 0);
  await page.waitForFunction(() => document.querySelector('[data-workshop-machine-dialog][open] [aria-label="État de la machine"]')?.getAttribute('aria-valuenow') === '100');
  await assertUnifiedSummary(10, 0, 20, true);
  assert.equal(await page.evaluate(() => window.__state.levels['WASHER-25L']), 10, 'Maintenance keeps the upgraded machine level');
  await screenshot('washer-max-level-maintained');
  await closeMachine('washing');
  await openMachine('filtration');
  await clickButton('Installer');
  await page.waitForSelector('[data-warehouse-slot="filtration"][data-installed="true"]');
  await closeMachine('filtration');

  // A missing machine can be bought in its popup, becomes solid in reserve, then installed.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await openMachine('drying');
  await page.click(`${dialog} [data-workshop-tier-choose="1"]`);
  await page.evaluate(() => { window.__delay = 450; });
  await page.click(`${dialog} [data-workshop-tier-confirm]`);
  await page.waitForSelector(`${dialog} button[aria-label="Fermer la fiche de la machine"]:disabled`);
  await page.keyboard.press('Escape');
  assert.ok(await page.$(dialog), 'Escape cannot dismiss a machine purchase in progress');
  await page.waitForSelector('[data-warehouse-slot="drying"][data-owned="true"]');
  await page.evaluate(() => { window.__delay = 80; });
  assert.equal(await page.$eval('[data-warehouse-slot="drying"]', element => element.dataset.installed), 'false');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-workshop-machine-dialog][open] button')].some(button => button.textContent.startsWith('Installer') && !button.disabled));
  await screenshot('drying-purchased-in-reserve');
  await clickButton('Installer');
  await page.waitForSelector('[data-warehouse-slot="drying"][data-installed="true"]');
  await closeMachine('drying');
  await screenshot('room-after-purchase');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await page.$eval('[data-warehouse-slot="press"] [data-workshop-sprite]', element => getComputedStyle(element).transitionDuration), '0s', 'Reduced motion disables sprite transitions');
  await page.click('[data-warehouse-slot="press"] strong');
  await page.waitForSelector(dialog);
  await closeMachine('press');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  await visit('novice');
  await openMachine('press');
  await assertUnifiedSummary(3, 2, 10);
  assert.equal(await page.$eval(`${summary} [data-machine-upgrade]`, button => button.disabled), true, 'Career restrictions remain enforced');
  await closeMachine('press');
  await visit('poor');
  await openMachine('drying');
  assert.equal(await page.$eval(`${dialog} [data-workshop-tier-choose="1"]`, button => button.disabled), true, 'Insufficient cash prevents purchase');
  await closeMachine('drying');
  await visit('modal');
  await openMachine('press');
  await closeMachine('press');
  assert.equal(await page.evaluate(() => window.__closeCount), 0, 'Escape closes the machine without closing its parent inventory');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__closeCount), 1, 'A later Escape still closes the parent inventory');

  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: true, results, unifiedLevelAndMaintenance: true, directActions: true, upgradePreservesWear: true, maintenancePreservesLevel: true, maximumLevel: true, upgradeRetry: true, maintenance: true, reserveInstall: true, directPurchaseRefresh: true, careerGate: true, cashGate: true, nestedEscape: true, reducedMotion: true, labelClick: true, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, viewports: results.map(result => result.width), output }));
} catch (error) {
  if (page) {
    await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true });
    await writeFile(resolve(output, 'failure.html'), await page.content());
  }
  console.error(JSON.stringify({ errors }));
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
