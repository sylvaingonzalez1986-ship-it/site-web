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
    const query=new URLSearchParams(location.search),allMachines=['SIFT-TRAY','WASHER-25L','AUTO-SIEVE','STATIC-PLASMA','PRESS-0600','FREEZE-DRYER'];
    const purchased=query.has('empty')?[]:query.has('full')?[...allMachines]:['SIFT-TRAY','WASHER-25L','AUTO-SIEVE','PRESS-0600'];
    const levels=Object.fromEntries(purchased.map(code=>[code,query.has('tier')?Number(query.get('tier')):({'SIFT-TRAY':1,'WASHER-25L':9,'AUTO-SIEVE':4,'PRESS-0600':3}[code]??1)]));
    const career=createChanvrierCareerSnapshot({xp:query.has('novice')?0:100000,completedCultures:150,processingPractice:query.has('novice')?{}:{sifting:30,washing:30,pressing:30}});
    window.__state={catalog:KQ_EQUIPMENT_CATALOG,career,productionUnits:1,tentNumber:1,tents:[],reputation:10000,routePlan:null,
      ownedCodes:[...KQ_STARTING_EQUIPMENT_CODES,...purchased],purchasedCodes:purchased,equippedCodes:[...KQ_STARTING_EQUIPMENT_CODES,...purchased.filter(code=>code!=='AUTO-SIEVE')],
      levels,cashCents:query.has('poor')?0:20000000,
      maintenance:Object.fromEntries(purchased.map(code=>[code,getKqMachineCondition(code,levels[code],({'SIFT-TRAY':0,'WASHER-25L':3,'AUTO-SIEVE':1,'PRESS-0600':2}[code]??0),1)]))};
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
const machineCodes = ['SIFT-TRAY', 'WASHER-25L', 'AUTO-SIEVE', 'STATIC-PLASMA', 'PRESS-0600', 'FREEZE-DRYER'];
const initiallyPurchased = ['SIFT-TRAY', 'WASHER-25L', 'AUTO-SIEVE', 'PRESS-0600'];
const dialog = '[data-workshop-machine-dialog][open]';
const summary = `${dialog} [data-workshop-machine-summary]`;
let browser;
let page;
const errors = [], results = [], external = [];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.origin === origin && !url.pathname.startsWith('/api/')) void request.continue();
    else { external.push(request.url()); void request.abort(); }
  });
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
    await page.$eval(`[data-warehouse-slot="${slot}"]`, element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.keyboard.press('Tab');
    await page.focus(`[data-warehouse-slot="${slot}"]`);
    assert.notEqual(await page.$eval(`[data-warehouse-slot="${slot}"]`, element => getComputedStyle(element).outlineStyle), 'none', 'Machine card keyboard focus is visible');
    await page.keyboard.press('Enter');
    await page.waitForSelector(dialog);
    assert.equal(await page.$eval(dialog, element => element.contains(document.activeElement)), true, 'Opening a machine moves focus into its popup');
  };
  const closeMachine = async (slot, trigger = 'data-warehouse-slot') => {
    await page.waitForSelector(`${dialog} button[aria-label="Fermer la fiche de la machine"]:not(:disabled)`);
    await page.keyboard.press('Escape');
    await page.waitForSelector(dialog, { hidden: true });
    await page.waitForFunction(({ slot, trigger }) => document.activeElement?.getAttribute(trigger) === slot, {}, { slot, trigger });
    assert.equal(await page.evaluate(trigger => document.activeElement?.getAttribute(trigger), trigger), slot, 'Escape restores focus to the machine trigger');
  };
  const layout = async () => page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    brokenImages: [...document.images].filter(image => image.complete && !image.naturalWidth).map(image => image.src),
  }));
  const assertLab = async purchased => {
    assert.ok(await page.$('[data-workshop-lab]'));
    assert.deepEqual(await page.$$eval('[data-warehouse-slot]', elements => elements.map(element => element.dataset.warehouseSlot)), slots, 'Only the six compact register buttons carry inventory slots');
    assert.deepEqual(await page.$$eval('[data-lab-station]', elements => elements.map(element => element.dataset.labStation).sort()), [...machineCodes].sort());
    assert.deepEqual(await page.$$eval('[data-lab-sprite]', elements => elements.map(element => element.dataset.labSprite).sort()), [...purchased].sort(), 'Only purchased machines appear in the laboratory');
    assert.deepEqual(await page.$$eval('[data-lab-empty]', elements => elements.map(element => element.dataset.labEmpty).sort()), machineCodes.filter(code => !purchased.includes(code)).sort(), 'Unpurchased stations keep their floor space free');
    assert.equal(await page.$$eval('[data-lab-empty] img', images => images.length), 0, 'Free stations contain no unpurchased machine sprite');
    const images = await page.$$eval('[data-workshop-artwork] img', async elements => {
      await Promise.all(elements.map(image => image.decode()));
      const stage = document.querySelector('[data-lab-stage]').getBoundingClientRect();
      return elements.map(image => {
        const box = image.getBoundingClientRect();
        const canvas = document.createElement('canvas');canvas.width = 64;canvas.height = 64;
        const context = canvas.getContext('2d');context.drawImage(image, 0, 0, 64, 64);
        const pixels = context.getImageData(0, 0, 64, 64).data;
        let transparent = 0;for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 16) transparent++;
        return { code: image.closest('[data-workshop-artwork]').dataset.workshopArtwork,
          path: new URL(image.currentSrc || image.src).pathname, loaded: image.complete && image.naturalWidth > 0,
          width: box.width, height: box.height, relativeWidth: box.width / stage.width, transparentRatio: transparent / 4096,
          opacity: getComputedStyle(image.closest('[data-workshop-artwork]')).opacity };
      });
    });
    assert.equal(images.length, purchased.length);
    for (const image of images) {
      assert.ok(image.path.endsWith('.webp'), 'Sprites use local WebP artwork');
      assert.equal(image.loaded, true);assert.equal(image.opacity, '1');
      assert.ok(image.transparentRatio > .15, `${image.code} has a transparent cutout, not a rectangular product card`);
    }
    const targets = await page.$$eval('[data-lab-station]', elements => elements.map(element => {
      const markerElement = element.querySelector(':scope > span:last-child');
      markerElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const box = element.getBoundingClientRect(), marker = markerElement.getBoundingClientRect();
      const stage = document.querySelector('[data-lab-stage]').getBoundingClientRect();
      return { code: element.dataset.labStation, width: box.width, height: box.height, markerWidth: marker.width, markerHeight: marker.height,
        markerLeft: marker.left - stage.left, markerTop: marker.top - stage.top,
        hit: document.elementFromPoint(marker.left + marker.width / 2, marker.top + marker.height / 2)?.closest('[data-lab-station]')?.getAttribute('data-lab-station'),
        dialog: element.getAttribute('aria-haspopup'), label: element.getAttribute('aria-label') };
    }));
    assert.ok(targets.every(target => target.markerWidth >= 24 && target.markerHeight >= 24), 'Scene markers retain 24px targets alongside the larger register controls');
    assert.ok(targets.every(target => target.hit === target.code), `Every scene marker stays visible and clickable: ${JSON.stringify(targets.map(({ code, hit }) => ({ code, hit })))}`);
    for (const [index, target] of targets.entries()) {
      for (const other of targets.slice(index + 1)) {
        const overlapX = Math.min(target.markerLeft + target.markerWidth, other.markerLeft + other.markerWidth) - Math.max(target.markerLeft, other.markerLeft);
        const overlapY = Math.min(target.markerTop + target.markerHeight, other.markerTop + other.markerHeight) - Math.max(target.markerTop, other.markerTop);
        assert.ok(overlapX <= 1 || overlapY <= 1, `${target.code} and ${other.code} scene markers do not overlap`);
      }
    }
    assert.ok(targets.every(target => target.dialog === 'dialog' && target.label), 'Every scene station names its machine and opens a dialog');
    return { images, targets };
  };
  const openStation = async code => {
    const selector = `[data-lab-station="${code}"]`;
    await page.$eval(selector, element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
    await page.keyboard.press('Tab');
    await page.focus(selector);
    assert.notEqual(await page.$eval(selector, element => getComputedStyle(element).outlineStyle), 'none', 'Scene station keyboard focus is visible');
    await page.keyboard.press('Enter');
    await page.waitForSelector(dialog);
    assert.equal(await page.$eval(dialog, element => element.contains(document.activeElement)), true);
    await closeMachine(code, 'data-lab-station');
  };
  const assertMobileZoom = async width => {
    if (width >= 700) return;
    const zoom = '[data-lab-zoom]';
    assert.equal(await page.$eval(zoom, element => element.getAttribute('aria-pressed')), 'false');
    await page.click(zoom);
    await page.waitForSelector('[data-lab-zoom][aria-pressed="true"]');
    assert.equal(await page.$eval('[data-lab-viewport]', element => element.scrollWidth > element.clientWidth + 1), true, 'Zoom exposes a horizontally scrollable scene');
    await page.$eval('[data-lab-viewport]', element => { element.scrollLeft = 0;element.focus(); });
    assert.equal(await page.$eval('[data-lab-viewport]', element => element === document.activeElement), true, 'The enlarged scene is reachable by keyboard');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('[data-lab-viewport]').scrollLeft > 0);
    const viewport = await page.$('[data-lab-viewport]');
    const box = await viewport.boundingBox();
    await page.$eval('[data-lab-viewport]', element => { element.scrollLeft = 0; });
    const session = await page.createCDPSession();
    const touch = (type, x) => session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: box.y + box.height * .65 }] });
    await touch('touchStart', box.x + box.width * .8);
    for (const fraction of [.7, .6, .5, .4, .3]) await touch('touchMove', box.x + box.width * fraction);
    await touch('touchEnd', 0);
    await page.waitForFunction(() => document.querySelector('[data-lab-viewport]').scrollLeft > 5);
    await session.detach();
    await screenshot(`lab-zoom-${width}`);
    assert.equal((await layout()).overflow, false, 'Zoom is contained inside the lab viewport');
    await page.click(zoom);
    await page.waitForSelector('[data-lab-zoom][aria-pressed="false"]');
  };
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
        hiddenByDetails: !!element.closest('details:not([open])'),
        level: Number(levelBar?.getAttribute('aria-valuenow')),
        wearCount,
        health: Number(healthBar?.getAttribute('aria-valuenow')),
        upgradeVisible: displayed(upgrade),
        atMaximum: maximum ? upgrade.disabled && upgrade.textContent.includes('Niveau maximum') : false,
        maintenanceVisible: displayed(maintenance),
      };
    }, maximum);
    assert.deepEqual(state, { hiddenByDetails: false, level, wearCount: `${cycles} / ${interval}`, health: Math.round((interval - cycles) / interval * 100), upgradeVisible: true, atMaximum: maximum, maintenanceVisible: true }, 'Level and maintenance are drawn together, with both actions outside the optional reference details');
    assert.equal(await page.$$eval(`${dialog} details`, elements => elements.some(element => element.textContent.includes('Réglages fins'))), false, 'No separate upgrade-only dropdown remains in the machine popup');
  };

  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: width < 700 ? 844 : 1000, isMobile: width < 700, hasTouch: width < 700 });
    await visit();
    assert.equal(await page.$(dialog), null, 'The workshop initially opens the laboratory');
    assert.equal(await page.$eval('[data-workshop-scene]', element => element.getAttribute('aria-label')), 'Machines de l’atelier');
    assert.deepEqual(await page.$$eval('[data-warehouse-slot]', elements => elements.map(element => element.dataset.warehouseSlot)), slots);
    await screenshot(`machines-${width}`);
    const geometry = await page.$$eval('[data-warehouse-slot]', elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { slot: element.dataset.warehouseSlot, owned: element.dataset.owned, installed: element.dataset.installed, level: element.dataset.level, width: box.width, height: box.height };
    }));
    assert.equal(geometry.find(item => item.slot === 'press').owned, 'true');
    assert.equal(geometry.find(item => item.slot === 'filtration').installed, 'false');
    assert.equal(geometry.find(item => item.slot === 'drying').owned, 'false');
    assert.ok(geometry.every(item => item.height >= 44 && item.height < 180), 'The register keeps six compact readable controls');
    const { images, targets } = await assertLab(initiallyPurchased);
    const press = images.find(item => item.code === 'PRESS-0600');
    const washer = images.find(item => item.code === 'WASHER-25L');
    assert.ok(press.width < washer.width * .75, 'The compact press keeps its actual smaller scale beside the professional washer');
    if (results.length) {
      for (const image of images) {
        const desktop = results[0].images.find(item => item.code === image.code);
        assert.ok(Math.abs(image.relativeWidth - desktop.relativeWidth) < .005, 'All sprites keep their shared scene scale across viewports');
      }
    }
    const checks = await layout();
    assert.equal(checks.overflow, false, `No page overflow at ${width}px`);
    assert.deepEqual(checks.brokenImages, []);
    await openStation('PRESS-0600');
    await openStation('FREEZE-DRYER');
    await assertMobileZoom(width);
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
    results.push({ width, geometry, images, targets, ...checks, allSixMachinesKeyboardAccessible: true, sceneKeyboardAccessible: true, mobileZoomAndPan: width < 700, escapeAndFocus: true });
  }

  // A new farm has an empty room; a fully equipped farm has no imaginary free stations.
  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: width < 700 ? 844 : 1000, isMobile: width < 700, hasTouch: width < 700 });
    await visit('empty');
    await assertLab([]);
    await screenshot(`lab-empty-${width}`);
    assert.equal((await layout()).overflow, false);
    await openStation('PRESS-0600');
    assert.equal(await page.evaluate(() => window.__requests.length), 0, 'Browsing a free station makes no purchase');
    await visit('full&tier=7');
    await assertLab(machineCodes);
    await screenshot(`lab-full-premium-${width}`);
    assert.deepEqual(await layout(), { overflow: false, brokenImages: [] });
  }

  // Press and washer configurations change the placed machine rather than just its label.
  const tierSprites = [];
  for (const tier of [1, 4, 7]) {
    await visit(`full&tier=${tier}`);
    tierSprites.push((await assertLab(machineCodes)).images);
  }
  for (const code of ['PRESS-0600', 'WASHER-25L']) {
    const variants = tierSprites.map(images => images.find(image => image.code === code));
    assert.equal(new Set(variants.map(image => image.path)).size, 3, `${code} has a different sprite for each equipment range`);
    assert.ok(variants[0].width < variants[1].width && variants[1].width < variants[2].width, `${code} configurations share a coherent physical scale`);
  }

  await page.setViewport({ width: 1440, height: 1000 });
  await visit();
  const restingMaterial = await page.$eval('[data-warehouse-slot="press"]', element => getComputedStyle(element).getPropertyValue('--game-control-art'));
  await page.hover('[data-warehouse-slot="press"]');
  await page.waitForFunction(resting => getComputedStyle(document.querySelector('[data-warehouse-slot="press"]')).getPropertyValue('--game-control-art') !== resting, {}, restingMaterial);
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

  // A missing machine can be bought in its popup, moves into reserve, then is installed.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await openMachine('drying');
  await page.click(`${dialog} [data-workshop-tier-choose="1"]`);
  const purchase = await page.evaluate(() => {
    const price = window.__state.catalog.find(machine => machine.code === 'FREEZE-DRYER').priceCents;
    return { price, cash: window.__state.cashCents, label: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: price % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(price / 100) };
  });
  assert.ok((await page.$eval(`${dialog} [data-workshop-tier-confirm]`, button => button.textContent)).includes(purchase.label), 'The exact purchase price is visible before confirming');
  await page.evaluate(() => { window.__fail = true; });
  await page.click(`${dialog} [data-workshop-tier-confirm]`);
  await page.waitForFunction(() => document.querySelector('[data-workshop-machine-dialog][open]')?.textContent.includes('Connexion interrompue'));
  assert.equal(await page.evaluate(() => window.__state.cashCents), purchase.cash, 'A failed purchase leaves the balance unchanged');
  assert.equal(await page.$('[data-lab-sprite="FREEZE-DRYER"]'), null, 'A failed purchase does not place a machine');
  await page.evaluate(() => { window.__delay = 450; });
  await page.click(`${dialog} [data-workshop-tier-confirm]`);
  await page.waitForSelector(`${dialog} button[aria-label="Fermer la fiche de la machine"]:disabled`);
  await page.keyboard.press('Escape');
  assert.ok(await page.$(dialog), 'Escape cannot dismiss a machine purchase in progress');
  await page.waitForSelector('[data-warehouse-slot="drying"][data-owned="true"]');
  await page.evaluate(() => { window.__delay = 80; });
  assert.equal(await page.$eval('[data-warehouse-slot="drying"]', element => element.dataset.installed), 'false');
  assert.ok(await page.$('[data-lab-sprite="FREEZE-DRYER"]'), 'A confirmed purchase places the reserved machine in the laboratory');
  assert.equal(await page.$('[data-lab-empty="FREEZE-DRYER"]'), null);
  const purchaseRequests = await page.evaluate(() => window.__requests.filter(request => request.action === 'workshop-tier' && request.equipmentCode === 'FREEZE-DRYER'));
  assert.equal(purchaseRequests.length, 2);
  assert.equal(purchaseRequests[0].requestKey, purchaseRequests[1].requestKey, 'Purchase retries retain their idempotency key');
  assert.equal(purchaseRequests[1].expectedPriceCents, purchase.price);
  assert.equal(await page.evaluate(() => window.__state.cashCents), purchase.cash - purchase.price, 'The confirmed purchase debits its exact offered amount once');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-workshop-machine-dialog][open] button')].some(button => button.textContent.startsWith('Installer') && !button.disabled));
  await screenshot('drying-purchased-in-reserve');
  await clickButton('Installer');
  await page.waitForSelector('[data-warehouse-slot="drying"][data-installed="true"]');
  await closeMachine('drying');
  await screenshot('machines-after-purchase');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await page.$eval('[data-lab-sprite="PRESS-0600"]', element => getComputedStyle(element).transitionDuration.split(',').every(duration => parseFloat(duration) <= .001)), true, 'Reduced motion disables visible illustration transitions');
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
  assert.deepEqual(external, []);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: true, results, laboratoryStates: ['empty', 'partial', 'full'], transparentOwnedSprites: true, tierSprites, commonSceneScale: true, sceneKeyboardAndTouch: true, mobileZoomAndPan: true, unifiedLevelAndMaintenance: true, directActions: true, upgradePreservesWear: true, maintenancePreservesLevel: true, maximumLevel: true, upgradeRetry: true, maintenance: true, reserveInstall: true, directPurchaseRefresh: true, careerGate: true, cashGate: true, nestedEscape: true, reducedMotion: true, labelClick: true, errors, external, backend: 'Local synthetic equipment API; no live request.' }, null, 2));
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
