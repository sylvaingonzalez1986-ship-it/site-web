// Real warehouse components and isolated local fixtures. No live account or API.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/placard-warehouse-clarity');
const origin = 'http://127.0.0.1:3241';
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'warehouse-entry': `
    import React from 'react'; import { createRoot, hydrateRoot } from 'react-dom/client';
    import { renderToString } from 'react-dom/server';
    import '/src/app/globals.css';
    import { KqWarehouseEntry } from '/src/components/placard/KqWarehouseEntry';
    import { KQ_EQUIPMENT_CATALOG, getKqEquipmentDefinition, getKqEquipmentUpgradeCost, isKqSharedEquipment } from '/src/lib/kanab-quest-equipment';
    import { getKqMachineCondition } from '/src/lib/kanab-quest-maintenance';
    import { getKqProductionExpansion } from '/src/lib/kanab-quest-production';
    const query = new URLSearchParams(location.search);
    const starter = ['TENT-080-STARTER','LED-150-STARTER','AIR-STARTER'];
    const all = ['TENT-120','LED-300','AIR-EC6','CLIMATE-SMART','SIFT-TRAY','WASHER-25L','AUTO-SIEVE','STATIC-PLASMA','PRESS-0600','FREEZE-DRYER','DRYING-ROOM','SOLAR-BACKUP','SECURITY-DOG'];
    sessionStorage.setItem('kq:selected-tent', query.get('selected') || '1');
    const starterTent = tentNumber => ({tentNumber,ownedCodes:[...starter],purchasedCodes:[],equippedCodes:[...starter],levels:{},maintenance:{},cultureWear:{},cultureOperationalCodes:[...starter]});
    function tent(tentNumber) {
      let purchasedCodes, equippedCodes, levels;
      if (query.has('full')) {
        purchasedCodes = all.filter(code=>!isKqSharedEquipment(code)); equippedCodes = [...purchasedCodes];
        levels = Object.fromEntries(purchasedCodes.map(code => [code, 10]));
      } else if (tentNumber === 1) {
        purchasedCodes = ['TENT-120','LED-300','DRYING-ROOM','SECURITY-CAMERA'];
        equippedCodes = ['TENT-120','LED-300','AIR-STARTER','DRYING-ROOM','SECURITY-CAMERA'];
        levels = {'LED-300':4,'DRYING-ROOM':5};
      } else {
        purchasedCodes = ['LED-300','DRYING-ROOM','SECURITY-DOG'];
        equippedCodes = [...starter,'SECURITY-DOG'];
        levels = {'LED-300':2,'DRYING-ROOM':2};
      }
      return {tentNumber,ownedCodes:[...new Set([...starter,...purchasedCodes])],purchasedCodes,equippedCodes,levels,maintenance:{},cultureWear:{},cultureOperationalCodes:[...equippedCodes]};
    }
    window.__state = {productionUnits:Number(query.get('units') || 2),cashCents:10000000,activeRun:false,routePlan:null,reputation:0,tents:[]};
    window.__state.tents = Array.from({length:window.__state.productionUnits}, (_, index) => tent(index+1));
    const commonCodes = query.has('full') ? all.filter(isKqSharedEquipment) : ['FREEZE-DRYER','WASHER-25L','PRESS-0600'];
    const commonLevels = Object.fromEntries(commonCodes.map(code=>[code,query.has('full')?10:3]));
    const commonMaintenance = Object.fromEntries(commonCodes.flatMap(code=>{
      const condition=getKqMachineCondition(code,commonLevels[code],query.has('maintenance')&&code==='WASHER-25L'?30:3,1);return condition?[[code,condition]]:[];
    }));
    window.__state.sharedEquipment = {ownedCodes:[...commonCodes],purchasedCodes:[...commonCodes],equippedCodes:[...commonCodes],levels:commonLevels,maintenance:commonMaintenance,operationalCodes:[...commonCodes]};
    window.__requests = []; window.__reads = []; window.__heldReads = []; window.__receipts = {};
    window.__holdInstall = false; window.__installRelease = null; window.__holdReadTent = null;
    window.__releaseReads = () => { for (const release of window.__heldReads.splice(0)) release(); };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (url, init = {}) => {
      if (!String(url).startsWith('/api/')) return originalFetch(url, init);
      if (!String(url).startsWith('/api/arena/placard/equipment')) throw new Error('Unexpected API fixture request: '+url);
      const state = window.__state;
      if (init.method === 'PATCH') {
        const body = JSON.parse(init.body); window.__requests.push(body);
        const reject = message => new Response(JSON.stringify({error:message}),{status:409});
        if (body.requestKey && window.__receipts[body.requestKey]) return new Response(window.__receipts[body.requestKey]);
        const success = result => {
          const receipt=JSON.stringify(result);if(body.requestKey)window.__receipts[body.requestKey]=receipt;return new Response(receipt);
        };
        if (body.action === 'expand-production') {
          const quote=getKqProductionExpansion(state.productionUnits);
          if(state.activeRun||quote.nextUnits===null||body.expectedUnits!==state.productionUnits||body.expectedCostCents!==quote.totalCostCents||state.cashCents<quote.totalCostCents)return reject('Devis local indisponible.');
          for(let number=state.productionUnits+1;number<=quote.nextUnits;number++)state.tents.push(starterTent(number));
          state.cashCents-=quote.totalCostCents;state.productionUnits=quote.nextUnits;
          return success({productionUnits:state.productionUnits});
        }
        const shared = isKqSharedEquipment(body.equipmentCode);
        const selected = shared ? state.sharedEquipment : state.tents.find(row => row.tentNumber === body.tentNumber);
        if (!selected || body.expectedUnits !== state.productionUnits || shared && body.tentNumber !== 1) throw new Error('Invalid equipment mutation target');
        if (window.__holdInstall) {
          window.__holdInstall = false;
          await new Promise(resolve => { window.__installRelease = resolve; });
        }
        if (body.action === 'upgrade') {
          const current = selected.levels[body.equipmentCode] || 1;
          if (current !== body.expectedLevel) throw new Error('Invalid expected upgrade level');
          const cost=getKqEquipmentUpgradeCost(body.equipmentCode,current,1);
          if(!selected.purchasedCodes.includes(body.equipmentCode)||cost===null||state.cashCents<cost)return reject('Amélioration locale indisponible.');
          state.cashCents -= cost;
          selected.levels[body.equipmentCode] = current + 1;
          const condition=selected.maintenance[body.equipmentCode];
          if(condition)selected.maintenance[body.equipmentCode]=getKqMachineCondition(body.equipmentCode,current+1,condition.cycles,condition.version);
          return success({level:current+1});
        }
        if (body.action === 'repair') {
          const condition=selected.maintenance[body.equipmentCode];
          if(!condition?.due||body.expectedVersion!==condition.version||body.expectedCostCents!==condition.repairCents||state.cashCents<condition.repairCents)return reject('Réparation locale indisponible.');
          state.cashCents-=condition.repairCents;
          selected.maintenance[body.equipmentCode]=getKqMachineCondition(body.equipmentCode,selected.levels[body.equipmentCode]||1,0,condition.version+1);
          if(shared)selected.operationalCodes=selected.equippedCodes.filter(code=>!selected.maintenance[code]?.due);
          return success({repaired:true});
        }
        if (!selected.purchasedCodes.includes(body.equipmentCode)) throw new Error('Installing an unowned model');
        const slot = getKqEquipmentDefinition(body.equipmentCode).slot;
        selected.equippedCodes = selected.equippedCodes.filter(code => getKqEquipmentDefinition(code).slot !== slot).concat(body.equipmentCode);
        if (!shared) selected.cultureOperationalCodes = [...selected.equippedCodes];
        else selected.operationalCodes = [...selected.equippedCodes];
        return new Response(JSON.stringify({equipped:true}));
      }
      if (init.method && init.method !== 'GET') throw new Error('Unexpected mutation: '+init.method);
      const requested = Number(new URL(url, location.origin).searchParams.get('tentNumber') || 1);
      window.__reads.push(requested);
      const selected = state.tents.find(row => row.tentNumber === requested) || state.tents[0];
      const first = state.tents[0];
      const shared = state.sharedEquipment;
      const response = JSON.stringify({...state,...selected,ownedCodes:[...selected.ownedCodes,...shared.ownedCodes],purchasedCodes:[...selected.purchasedCodes,...shared.purchasedCodes],equippedCodes:[...selected.equippedCodes,...shared.equippedCodes],levels:{...selected.levels,...shared.levels},maintenance:{...selected.maintenance,...shared.maintenance},catalog:KQ_EQUIPMENT_CATALOG,equipmentPricingUnits:1,production:getKqProductionExpansion(state.productionUnits,first.purchasedCodes,first.levels)});
      // Deliberately ignore AbortSignal here: the UI must reject obsolete responses too.
      if (window.__holdReadTent === requested) {
        window.__holdReadTent = null;
        await new Promise(resolve => window.__heldReads.push(resolve));
      }
      return new Response(response);
    };
    const app = <KqWarehouseEntry initialEquipmentCode={query.get('equipment')} onClose={()=>{window.__closed=true;}} onOpenShop={code=>{window.__shop=code;console.info('Prévisualisation visuelle : catalogue hors de cette démonstration locale.',code||'');}}/>;
    const container = document.getElementById('root');
    if (query.has('hydrate')) { container.innerHTML = renderToString(app); hydrateRoot(container, app); }
    else createRoot(container).render(app);
  `,
};

const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-dom/server', 'lucide-react'] },
  resolve: { alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'warehouse-clarity-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; if (id.endsWith('/public/placard/warehouse-v2/manifest.json')) return '\0warehouse-assets'; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', {lang:'tsx',jsx:{runtime:'automatic'}})).code; },
    configureServer(vite) { vite.middlewares.use((req,res,next) => {
      if (req.url?.split('?')[0] !== '/') return next();
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prévisualisation locale · Entrepôt · données de démonstration</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__warehouse-entry"></script></html>');
    }); },
  }],
  server: { host:'127.0.0.1',port:3241,strictPort:true,hmr:false,watch:null },
});

const scene = '[aria-label="Les emplacements de ton entrepôt"]';
const dialog = '[aria-labelledby="equipment-inventory-title"]';
const panel = '[aria-labelledby="warehouse-slot-title"]';
const tentButton = number => `[data-warehouse-slot="tent"][data-tent-number="${number}"]`;
const slotButton = (slot,number) => `[data-warehouse-slot="${slot}"][data-tent-number="${number}"]`;
const sharedButton = slot => `[data-warehouse-scope="shared"][data-warehouse-slot="${slot}"]`;
let browser, page;
const errors = [], layouts = [], interactions = [];
if (process.argv.includes('--preview')) {
  await mkdir(output,{recursive:true});
  await server.listen();
  console.log('Prévisualisation locale · données de démonstration : '+origin+'/?units=2');
} else {
try {
  await mkdir(output,{recursive:true}); await server.listen();
  browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page = await browser.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => void(request.url().startsWith(origin) || request.url().startsWith('data:') ? request.continue() : request.abort()));
  const visit = async (units=2,full=false,extra='') => {
    await page.goto(`${origin}/?units=${units}${full?'&full':''}${extra?'&'+extra:''}`,{waitUntil:'networkidle0'});
    await page.waitForSelector(`${tentButton(1)}:not(:disabled)`);
    await page.waitForFunction(selector => [...document.querySelectorAll(selector+' img')].every(img=>img.complete&&img.naturalWidth>0),{},scene);
  };
  const clickText = async prefix => {
    const handle = await page.evaluateHandle(prefix => [...document.querySelectorAll('button')].find(button=>button.textContent.trim().startsWith(prefix)),prefix);
    assert.ok(handle.asElement(),prefix); await handle.asElement().click();
  };
  const selectTent = async number => {
    const target=await page.$(tentButton(number));
    const bounds=await target.boundingBox();
    await target.click({offset:{x:bounds.width/2,y:bounds.height*.7}});
    await page.waitForFunction(number => document.querySelector('[data-warehouse-slot="tent"][data-tent-number="'+number+'"]')?.dataset.tentSelected==='true',{},number);
    await page.waitForSelector(tentButton(number)+'[data-selected="true"]');
    await page.waitForFunction(({number,panel}) => document.querySelector(panel)?.textContent.includes('Tente '+number),{},{number,panel});
  };
  const selectSlot = async (slot,number) => {
    await page.click(slotButton(slot,number));
    await page.waitForSelector(`${slotButton(slot,number)}[data-selected="true"]`);
  };
  const noOverflow = async label => {
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' document');
    assert.equal(await page.$eval(dialog,el=>el.scrollWidth>el.clientWidth+1),false,label+' dialog');
  };
  const screenshotScene = async path => {
    // ElementHandle.screenshot scrolls the panorama back to its first bay.
    const clip = await page.$eval('[data-overview]',el=>{
      const r=el.getBoundingClientRect();
      return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};
    });
    await page.screenshot({path,clip});
  };
  const geometry = async () => page.$$eval('[data-warehouse-slot]', elements => elements.map(el=>{
    const r=el.getBoundingClientRect();return {slot:el.dataset.warehouseSlot,scope:el.dataset.warehouseScope,tent:el.hasAttribute('data-tent-number')?Number(el.dataset.tentNumber):null,active:el.dataset.tentSelected==='true',x:r.x,y:r.y,width:r.width,height:r.height};
  }));
  const captureCommon = async () => page.evaluate(() => {
    window.__commonNodes=[...document.querySelectorAll('[data-warehouse-workshop] [data-warehouse-scope="shared"]')];
    window.__commonSignature=window.__commonNodes.map(el=>[el.dataset.warehouseSlot,el.getAttribute('aria-label'),el.getAttribute('style')]);
  });
  const assertCommonStable = async label => {
    assert.equal(await page.$eval('[data-warehouse-workshop]',el=>el.closest('[data-warehouse-bay]').dataset.warehouseBay),'1',label+' shared atelier stays in first bay');
    assert.equal(await page.$$eval('[data-warehouse-workshop] button',els=>els.every(el=>el.dataset.warehouseScope==='shared'&&!el.hasAttribute('data-tent-number'))),true,label+' common machines have no tent owner');
    assert.equal(await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('[data-warehouse-workshop] [data-warehouse-scope="shared"]')];
      return nodes.every((el,index)=>el===window.__commonNodes[index])&&JSON.stringify(nodes.map(el=>[el.dataset.warehouseSlot,el.getAttribute('aria-label'),el.getAttribute('style')]))===JSON.stringify(window.__commonSignature);
    }),true,label+' machine nodes, levels and placement stay identical');
  };
  for (const width of [320,390,768,1440]) {
    await page.setViewport({width,height:1000,isMobile:width<700,hasTouch:width<700});
    for (const units of [1,2,4,8]) {
      await visit(units,true); await noOverflow(`${units} tents at ${width}`);
      assert.equal((await page.$$(scene)).length,1,'One panorama');
      assert.equal((await page.$$('[data-warehouse-bay]')).length,units===8?2:1,'Eight tents share two bays of the same panorama');
      assert.equal((await page.$$('[data-warehouse-slot="tent"]')).length,units,'Every owned tent is drawn');
      assert.equal((await page.$$('[data-warehouse-slot="tent"][data-tent-selected="true"]')).length,1,'One active tent');
      assert.equal((await page.$$(panel)).length,1,'One equipment detail');
      assert.equal((await page.$$('[data-warehouse-workshop]')).length,1,'One common workshop');
      assert.equal((await page.$$('[data-warehouse-workshop] button')).length,6,'Six shared processing machines, each drawn once');
      await captureCommon();
      if (units>=2) {
        const position=await page.$$eval('[data-warehouse-slot="tent"]',els=>els.slice(0,2).map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
        assert.ok(position[0].right<=position[1].x+1,'Tent 2 is beside tent 1');
        assert.ok(Math.abs(position[0].bottom-position[1].bottom)<3,'Neighboring tents share the same floor');
      }
      await page.screenshot({path:resolve(output,`full-${units}-tents-${width}.png`)});
      await screenshotScene(resolve(output,`full-${units}-tents-${width}-scene.png`));
      layouts.push({width,units,noOverflow:true,geometry:await geometry()});
      if (units===8) {
        await selectTent(8);
        await assertCommonStable('Selecting tent 8');
        await noOverflow(`last tent at ${width}`);
        await page.screenshot({path:resolve(output,`full-8-tents-${width}-tent8.png`)});
        await screenshotScene(resolve(output,`full-8-tents-${width}-tent8-scene.png`));
        layouts.push({width,units,selectedTent:8,noOverflow:true,geometry:await geometry()});
      }
    }
    await visit(2);
    await page.click('button[aria-label="Ajouter la tente 3 · voir le devis"]');
    assert.equal(await page.$eval('[data-production-capacity]',el=>el.open),true,'Free tent position opens the expansion quote');
    assert.equal(await page.evaluate(()=>window.__requests.length),0,'Viewing the expansion quote never purchases');
    await visit(2);
    await captureCommon();
    await page.evaluate(({scene,panel,dialog})=>{
      window.__sceneNode=document.querySelector(scene);window.__dialogNode=document.querySelector(dialog);
      window.__scrollBefore=[...document.querySelectorAll(dialog+' *')].filter(el=>el.scrollHeight>el.clientHeight+1&&/auto|scroll/.test(getComputedStyle(el).overflowY)).map(el=>[el,el.scrollTop]);
    },{scene,panel,dialog});
    await selectTent(2);
    assert.equal(await page.evaluate(({scene,dialog})=>window.__sceneNode===document.querySelector(scene)&&window.__dialogNode===document.querySelector(dialog),{scene,dialog}),true,'Selecting a tent keeps scene and dialog mounted');
    assert.equal(await page.evaluate(()=>window.__scrollBefore.every(([el,top])=>Math.abs(el.scrollTop-top)<=1)),true,'Selecting a tent preserves vertical scroll');
    await assertCommonStable('Selecting tent 2');
    assert.equal(await page.$eval(slotButton('lighting',2),el=>el.getAttribute('aria-label').includes('115 W')),true,'Tent 2 keeps starter light');
    assert.equal(await page.$eval(sharedButton('washing'),el=>el.dataset.installed),'true','Existing shared washer remains available from tent 2');
    assert.equal(await page.evaluate(()=>window.__state.tents.every(tent=>!tent.ownedCodes.includes('WASHER-25L'))),true,'No individual tent purchases the common washer');
    await selectSlot('lighting',2);
    await page.select(panel+' select','LED-300');
    assert.equal((await page.$$(panel+' > article')).length,1,'One selected model');
    const before=await page.evaluate(()=>JSON.stringify(window.__state.tents[0]));
    await page.evaluate(()=>{window.__holdInstall=true;});
    await clickText('Installer · tente 2');
    await page.waitForFunction(()=>window.__installRelease!==null);
    await selectTent(1);
    await assertCommonStable('Switching tents during installation');
    await page.evaluate(()=>window.__installRelease());
    await page.waitForFunction(()=>window.__state.tents[1].equippedCodes.includes('LED-300'));
    await page.waitForFunction(()=>!document.querySelector('[aria-labelledby="warehouse-slot-title"]')?.textContent.includes('Actualisation'));
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__state.tents[0])),before,'Delayed installation cannot mutate tent 1');
    assert.equal(await page.$eval(tentButton(1),el=>el.dataset.tentSelected),'true','Delayed response does not switch the selected tent');
    await assertCommonStable('Delayed individual installation');
    assert.equal(await page.$eval(panel,el=>el.textContent.includes('installé dans la tente 2')),false,'Other tent success notice stays out of this detail');
    assert.deepEqual(await page.evaluate(()=>window.__requests.map(({equipmentCode,tentNumber,expectedUnits})=>({equipmentCode,tentNumber,expectedUnits}))),[{equipmentCode:'LED-300',tentNumber:2,expectedUnits:2}]);
    await selectTent(2); await selectSlot('lighting',2);
    assert.equal(await page.$eval(slotButton('lighting',2),el=>el.getAttribute('aria-label').includes('300')),true,'Returned tent shows installed model');
    assert.equal((await page.$$(panel+' > article')).length,1);
    await page.click(sharedButton('washing'));
    await page.waitForFunction(panel=>document.querySelector(panel)?.textContent.includes('Atelier commun'),{},panel);
    assert.equal(await page.$eval(tentButton(2),el=>el.dataset.tentSelected),'true','Selecting a shared machine keeps the active tent');
    assert.equal(await page.$$eval(panel+' button',els=>els.some(button=>/^(Acheter|Installer)/.test(button.textContent.trim()))),false,'An installed common machine is not offered for purchase or installation again');
    await clickText('Niveau 4');
    await page.waitForFunction(()=>window.__state.sharedEquipment.levels['WASHER-25L']===4);
    await page.waitForFunction(panel=>document.querySelector(panel+' [aria-label="Niveau du matériel"]')?.getAttribute('aria-valuenow')==='4',{},panel);
    assert.deepEqual(await page.evaluate(()=>{const r=window.__requests.at(-1);return{action:r.action,tentNumber:r.tentNumber,equipmentCode:r.equipmentCode};}),{action:'upgrade',tentNumber:1,equipmentCode:'WASHER-25L'},'The common upgrade has one canonical target');
    const conditionBefore=await page.evaluate(()=>JSON.stringify(window.__state.sharedEquipment.maintenance['WASHER-25L']));
    await captureCommon();
    await selectTent(1); await assertCommonStable('After common upgrade');
    await page.click(sharedButton('washing'));
    assert.equal(await page.$eval(panel+' [aria-label="Niveau du matériel"]',el=>el.getAttribute('aria-valuenow')),'4','A common upgrade is visible from another tent');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__state.sharedEquipment.maintenance['WASHER-25L'])),conditionBefore,'The same maintenance state follows the common machine');
    assert.equal(await page.evaluate(()=>window.__state.sharedEquipment.purchasedCodes.filter(code=>code==='WASHER-25L').length),1,'Only one shared washer is owned');
    assert.equal(await page.$$eval(panel+' button',els=>els.some(button=>/^(Acheter|Installer)/.test(button.textContent.trim()))),false,'Changing tents does not ask for a second purchase');
    await noOverflow(`interactions ${width}`);
    interactions.push({width,directTentSelection:true,noRemount:true,noScrollJump:true,commonMachinesStable:true,commonUpgradePersistent:true,commonConditionPersistent:true,noDuplicatePurchase:true,expansionQuoteOnly:true,singleModel:true,delayedInstallationIsolated:true});
  }
  // A stale GET snapshot must never replace another tent's fresh visible data.
  await visit(2);
  await page.evaluate(()=>{window.__holdReadTent=1;window.dispatchEvent(new Event('kq:equipment-updated'));});
  await page.waitForFunction(()=>window.__heldReads.length===1);
  await selectTent(2);
  await page.evaluate(()=>window.__releaseReads());
  await page.waitForFunction(()=>window.__heldReads.length===0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.$eval(tentButton(2),el=>el.dataset.tentSelected),'true');
  assert.equal(await page.$eval('[data-warehouse-workshop]',el=>el.closest('[data-warehouse-bay]').dataset.warehouseBay),'1');
  assert.equal(await page.$eval(slotButton('lighting',2),el=>el.getAttribute('aria-label').includes('115 W')),true,'Obsolete GET cannot repaint tent 2 with tent 1');
  await visit(8,false,'selected=8&equipment=LED-500&hydrate');
  await page.waitForSelector(`${slotButton('lighting',8)}[data-selected="true"]`);
  assert.equal(await page.$eval(tentButton(8),el=>el.dataset.tentSelected),'true','Hydration restores the saved tent');
  assert.equal(await page.$eval('#warehouse-slot-title',el=>el.textContent.includes('Éclairage')),true,'Equipment deep link survives server tent 1 to client tent 8');
  assert.equal(await page.$eval('[data-warehouse-workshop]',el=>el.closest('[data-warehouse-bay]').dataset.warehouseBay),'1','The common workshop stays in the first bay after hydration');
  assert.equal(await page.$eval(tentButton(8),el=>{const tent=el.getBoundingClientRect(),viewport=el.closest('[data-overview]').getBoundingClientRect();return tent.left>=viewport.left-1&&tent.right<=viewport.right+1;}),true,'Restored tent 8 is initially in view');
  await visit(2);
  await clickText('Agrandir le décor');
  await page.waitForSelector('[data-overview="false"]');
  await selectTent(2);
  assert.ok(await page.$('[data-overview="false"]'),'Selecting another tent preserves the chosen zoom');
  // The preview uses only browser fixtures; exercise its local repairs and expansion too.
  await visit(2,false,'maintenance');
  await selectTent(2);await page.click(sharedButton('washing'));
  const repairBefore=await page.evaluate(()=>({cash:window.__state.cashCents,condition:window.__state.sharedEquipment.maintenance['WASHER-25L']}));
  await clickText('Réparer ·');
  await page.waitForFunction(()=>!window.__state.sharedEquipment.maintenance['WASHER-25L'].due);
  assert.equal(await page.evaluate(()=>window.__state.cashCents),repairBefore.cash-repairBefore.condition.repairCents,'Local common repair debits one quote');
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).tentNumber),1,'The repair has one canonical common target');
  await selectTent(1);await page.click(sharedButton('washing'));
  assert.equal(await page.$eval(panel,el=>el.textContent.includes('Machine à l’arrêt')),false,'A common repair remains visible after changing tent');
  await visit(1);
  const expansionBefore=await page.evaluate(()=>({cash:window.__state.cashCents,tent:JSON.stringify(window.__state.tents[0]),shared:JSON.stringify(window.__state.sharedEquipment)}));
  await page.click('button[aria-label="Ajouter la tente 2 · voir le devis"]');
  for(const units of [2,3,4,8]) {
    await clickText(units===8?'Acheter l’entrepôt final':'Ajouter cette tente');
    await page.waitForFunction(units=>window.__state.productionUnits===units&&document.querySelectorAll('[data-warehouse-slot="tent"]').length===units,{},units);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__state.tents[0])),expansionBefore.tent,'Expansion preserves the first tent');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__state.sharedEquipment)),expansionBefore.shared,'Expansion never duplicates or changes the common workshop');
  assert.equal(await page.evaluate(()=>window.__state.tents.slice(1).every(tent=>tent.purchasedCodes.length===0&&Object.keys(tent.levels).length===0&&tent.equippedCodes.join(',')==='TENT-080-STARTER,LED-150-STARTER,AIR-STARTER')),true,'All seven new demo tents start with the basic kit');
  assert.equal(await page.evaluate(()=>window.__state.cashCents),expansionBefore.cash-3*30000-2120000,'Local expansion uses all four exact quotes');
  const beforeReplay=await page.evaluate(()=>window.__state.cashCents);
  await page.evaluate(async()=>{const body=window.__requests.at(-1);await fetch('/api/arena/placard/equipment',{method:'PATCH',body:JSON.stringify(body)});});
  assert.equal(await page.evaluate(()=>window.__state.cashCents),beforeReplay,'Replaying a local receipt does not debit twice');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,layouts,interactions,staleReadIsolated:true,savedTentHydration:true,equipmentDeepLink:true,zoomPreserved:true,localPreviewRepair:true,localPreviewExpansion:true,localPreviewIdempotent:true,errors},null,2));
  console.log(JSON.stringify({passed:true,viewports:[320,390,768,1440],tentCounts:[1,2,4,8],interactions,output}));
} catch (error) {
  await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});
  await writeFile(resolve(output,'failure.json'),JSON.stringify({message:error.message,errors,layouts,interactions},null,2));
  throw error;
} finally { await browser?.close(); await server.close(); }
}
