import assert from 'node:assert/strict';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const baseline = process.argv.includes('--avant');
const phase = baseline ? 'avant' : 'apres';
const output = resolve(process.env.KQ_WAREHOUSE_PILOTAGE_OUTPUT ?? 'output/warehouse-pilotage');
const retail = JSON.parse(await readFile('src/lib/kanab-quest-warehouse-retail-supplies.json', 'utf8'));
const prices = {
  cameraCents: retail['WAREHOUSE-CAMERA'].unitPriceCents,
  alarmCents: retail['WAREHOUSE-ALARM'].unitPriceCents,
  monitoringCents: retail['WAREHOUSE-MONITORING'].unitPriceCents,
};
const fixture = (await readFile('scripts/audit-placard-warehouse-v4.mjs', 'utf8'))
  .split("if(process.argv.includes('--preview'))")[0]
  .replace("'output/warehouse-v4'", JSON.stringify(output))
  .replace('?? 3248', '?? 0')
  .replace("'react-dom/client', 'lucide-react']", "'react-dom/client', 'lucide-react', 'three', 'three/addons/utils/BufferGeometryUtils.js']")
  .replace('export default function Link', 'export const useLinkStatus=()=>({pending:false}); export default function Link')
  .replace('createKqWarehouseStarter,getKqWarehouseQuote', 'createKqWarehouseStarter,createKqWarehouseEmpty,getKqWarehouseQuote')
  .replace('<KqWarehouse embedded=', '<KqWarehouse draftOwnerId={"warehouse-pilotage-"+query.get("scenario")} embedded=')
  .replace("    const query=new URLSearchParams(location.search);", `
    import {KQ_WAREHOUSE_PREPARATION_CATALOG,getKqWarehouseInputPack} from '/src/lib/kanab-quest-warehouse-preparations';
    import {getKqWarehouseStationCoverage} from '/src/lib/kanab-quest-warehouse-stations';
    const query=new URLSearchParams(location.search);`)
  .replace('    window.__closeCount=0;', `
    const scenario=query.get('scenario');
    const empty=scenario==='vide';
    const alert=scenario==='alertes';
    const clock=Date.now();
    const date=hours=>new Date(clock+hours*3600000).toISOString();
    const pilotageStarter=createKqWarehouseStarter(true);
    const layout=empty?createKqWarehouseEmpty():getKqWarehouseQuote({...pilotageStarter,
      zones:[
        {...pilotageStarter.zones[0],x:1,y:2,width:2,height:3,name:'Culture ouest',buddieCode:'HH2026-002'},
        {...pilotageStarter.zones[0],id:'est',x:6,y:3,width:2,height:3,name:'Culture est'},
      ],
      airPlacements:[{...pilotageStarter.airPlacements[0],x:1,y:2}],
      stationPlacements:[{id:'centrale',code:'SIM-WATER-03',x:1,y:7}],
    }).nextState;
    const runId='11111111-1111-4111-8111-111111111111';
    const activeRuns=empty?[]:[{runId,zoneId:'starter',buddieCode:'HH2026-002',stageIndex:2,phase:'ready',startedAt:date(-2)}];
    window.__snapshot={...window.__snapshot,state:layout,cashCents:3000000,activeRun:!empty,activeRuns,completedRuns:[],
      stockGrams:empty?0:100,storageReservedGrams:empty?0:120,storageCapacityGrams:empty?0:500};
    const input='CARE-COMPOST-TEA';
    const item=(code,availableQuantity,reservedQuantity)=>({code,...KQ_WAREHOUSE_PREPARATION_CATALOG[code],...getKqWarehouseInputPack(code),availableQuantity,reservedQuantity});
    const never={completedAt:null,expiresAt:null,pending:null};
    const cleaned={completedAt:date(-20),expiresAt:date(alert?-1:8),pending:null};
    const installedStations=getKqWarehouseStationCoverage(layout);
    const coverage=layout.zones.map(zone=>{
      const stations=(installedStations?.placements??[]).map(station=>({
        stationId:station.id,kind:station.code==='SIM-WATER-03'?'irrigation':'hygiene',
        servedM2:installedStations.cells.filter(cell=>cell.zoneId===zone.id&&cell.placementId===station.id).length,
      })).filter(station=>station.servedM2>0);
      return {zoneId:zone.id,areaM2:zone.width*zone.height,stations};
    });
    const preparations={cashCents:window.__snapshot.cashCents,serverNow:date(0),calendarOrigin:date(-20),
      items:empty?[]:[item('WAREHOUSE-VACUUM',1,0),item('WAREHOUSE-MOP',1,0),
        item('WAREHOUSE-NUTRITION-BASE',40,0),item(input,185,30)],
      runs:empty?[]:[{runId,zoneId:'starter',reserved:{[input]:30},consumed:{[input]:10},available:{[input]:100}}],
      programs:[],coverage,cleaning:{vacuum:empty?never:cleaned,mop:empty?never:cleaned}};
    const fixtureFetch=window.fetch;
    window.fetch=async(url,init={})=>{
      if(!init.method||init.method==='GET'){
        if(String(url)==='/api/arena/placard/warehouse/preparations')return Response.json(preparations);
        if(String(url)==='/api/arena/placard/warehouse/security')return Response.json({
          layout:window.__snapshot.state,layoutRevision:window.__snapshot.revision,revision:0,
          cashCents:window.__snapshot.cashCents,prices:${JSON.stringify(prices)},
          cameras:empty?[]:[{id:'camera-test',placement:{x:2,y:8,bearing:0}}],
          alarm:empty?'none':'installed',
          monitoring:empty?{status:'none',enabled:false,paidUntil:null}:
            {status:'active',enabled:true,paidUntil:date(alert?1:72)},
        });
      }
      return fixtureFetch(url,init);
    };
    window.__closeCount=0;`);
await mkdir(output, { recursive: true });
const runner = resolve(output, 'serve.mjs');
await writeFile(runner, fixture + '\nexport {server};');
const { server } = await import(pathToFileURL(runner).href);
const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
const errors = [], measurements = [], checks = [];
const mode = name => `button[data-warehouse-mode="${name}"]`;
const moduleButton = name => `button[data-warehouse-module="${name}"]`;
const context = '[data-warehouse-context]';
const map = '[data-warehouse-iso-map]';
const shop = 'dialog[data-warehouse-shop][open]';
const scenarios = ['vide', 'actif', 'alertes'];

async function capture(page, name, width) {
  if (await page.evaluate(selector => {
    const bounds = document.querySelector(selector)?.getBoundingClientRect();
    return bounds && bounds.top < innerHeight && bounds.bottom > 0;
  }, map)) {
    await page.waitForFunction(selector => {
      const scene = document.querySelector(selector);
      return scene?.dataset.renderer === 'webgl' || scene?.querySelector('[data-grow-fallback-plan]');
    }, {timeout:8000}, map);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(finish => requestAnimationFrame(() => requestAnimationFrame(finish)));
  });
  await page.screenshot({path:resolve(output, `${phase}-${name}-${width}.png`)});
}

async function openScene(page, scenario) {
  await page.goto(origin + '/?compact&scenario=' + scenario, {waitUntil:'domcontentloaded', timeout:60000});
  await page.waitForSelector('[data-warehouse-map]', {visible:true});
}

async function runChecks(page, width) {
  const mobile = width === 320;
  const activate = async selector => {
    await page.waitForSelector(selector, {visible:true});
    await page.$eval(selector, node => node.scrollIntoView({block:'center', behavior:'instant'}));
    if (mobile) await page.tap(selector);
    else {
      await page.focus(selector);
      await page.keyboard.press('Enter');
    }
  };
  const visible = selector => page.waitForSelector(selector, {visible:true});
  const contextText = () => page.$eval(context, node => node.innerText);
  const assertNoSupplierDetails = async selector => {
    const card = await page.$eval(selector, node => ({
      text: node.textContent,
      supplier: node.querySelector('a[href^="https://"]')?.href,
    }));
    assert.doesNotMatch(card.text, /référence (?:et prix public|de prix|commerciale|fabricant)|relevé le |fiche fabricant|proportions et références/iu);
    assert.equal(card.supplier, undefined);
  };
  const assertContext = expression => page.waitForFunction((selector, pattern) =>
    new RegExp(pattern, 'iu').test(document.querySelector(selector)?.innerText ?? ''), {timeout:5000}, context, expression.source);
  let currentScenario;
  const check = async (name, scenario, action) => {
    try {
      if (currentScenario !== scenario) {
        await openScene(page, scenario);
        currentScenario = scenario;
      }
      await action();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(overflow, 0, 'Débordement horizontal');
      checks.push({name, width, result:'ok'});
    } catch (error) {
      console.error(`${width} px · ${name} · ${error.message}`);
      checks.push({name, width, result:'échec', error:error.message, context:await contextText().catch(() => null)});
      currentScenario = null;
    }
  };

  await check('Sélecteur partagé entre Pilotage et Aménager', 'actif', async () => {
    const switchSelector = '[data-warehouse-mode-switch]';
    for (const selected of ['pilotage', 'arrangement', 'pilotage']) {
      await activate(mode(selected));
      await visible(`${switchSelector}[data-warehouse-mode-switch="${selected}"]`);
      const state = await page.$eval(switchSelector, track => {
        const buttons = [...track.querySelectorAll('button')];
        const active = buttons.filter(button => button.getAttribute('aria-pressed') === 'true');
        const thumb = getComputedStyle(track, '::before');
        return {
          selected: active.map(button => button.dataset.warehouseMode),
          descriptions: buttons.map(button => document.getElementById(button.getAttribute('aria-describedby'))?.textContent),
          thumbArt: thumb.borderImageSource,
          thumbLeft: parseFloat(thumb.left),
          selectedLeft: active[0]?.offsetLeft,
          activeWidth: active[0]?.offsetWidth,
          thumbWidth: parseFloat(thumb.width),
          mark: active[0] && getComputedStyle(active[0].querySelector('strong')).textDecorationLine,
          fits: buttons.every(button => button.offsetHeight >= 44 && button.scrollWidth <= button.clientWidth + 1),
          managing: document.querySelector('[data-warehouse-managing]') !== null,
          focus: document.activeElement?.dataset.warehouseMode,
        };
      });
      assert.deepEqual(state.selected, [selected]);
      assert.deepEqual(state.descriptions, ['Suivre l’activité', 'Modifier le plan']);
      assert.match(state.thumbArt, /control-teal-v2\.webp/);
      assert(Math.abs(state.thumbLeft - state.selectedLeft) <= 1, 'La sélection remplit le bon côté du sélecteur');
      assert(Math.abs(state.thumbWidth - state.activeWidth) <= 1, 'La sélection couvre toute la cible');
      assert.match(state.mark, /underline/);
      assert.equal(state.managing, selected === 'arrangement');
      assert(state.fits);
      if (!mobile) assert.equal(state.focus, selected);
      await page.$eval(switchSelector, track => track.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
      await capture(page, `mode-${selected}`, width);
    }
    assert.equal(await page.evaluate(() => window.__requests.length), 0);
  });

  await check('Dimensions accessibles directement depuis le menu de zone', 'actif', async () => {
    const menu = 'dialog[data-warehouse-zone-menu][open]';
    const dimensions = menu + ' [data-warehouse-zone-action="dimensions"]';
    const editor = 'dialog[data-warehouse-zone-dialog][open]';
    await activate(mode('arrangement'));
    await visible(mode('arrangement') + '[aria-pressed="true"]');
    await activate('[data-warehouse-zone-chip="est"]');
    await visible(dimensions);
    assert.equal(await page.$eval(dimensions, node => Boolean(node.closest('details'))), false);
    await activate(dimensions);
    await visible(editor + ' [data-warehouse-zone-quote]');
    const text = await page.$eval(editor, node => node.textContent);
    assert.doesNotMatch(text, /Références de cette zone|Référence avec du matériel neuf/);
    assert.match(text, /Coût neuf \/ m²/);
    assert.match(text, /Récolte estimée/);
    await capture(page, 'reglages-zone', width);
    await page.keyboard.press('Escape');
    await page.waitForSelector(editor, {hidden:true});
    await activate(mode('pilotage'));
    assert.equal(await page.evaluate(() => window.__requests.length), 0);
  });

  const modules = {
    cleaning:/[Aa]spirat|[Ss]erpilli/,
    security:/[Cc]am.ra|[Aa]larme/,
    ventilation:/[Ee]xtraction d.air|[Vv]entilation/,
    irrigation:/[Ii]rrigation|[Cc]entrale/,
    inputs:/[Ss]tock|[Ii]ntrants/,
    drying:/[Ss].chage/,
    storage:/[Ss]tockage/,
  };
  for (const [name, expected] of Object.entries(modules)) {
    await check(`Accès direct · ${name}`, 'actif', async () => {
      await activate(moduleButton(name));
      await assertContext(expected);
      assert.equal(await page.$eval(moduleButton(name), node => node.getAttribute('aria-selected')), 'true');
      await visible(map);
    });
  }
  await check('Extractions d’atelier et ouverture d’un lot', 'actif&ready', async () => {
    await activate(moduleButton('processing'));
    assert.equal(await page.$(map), null, 'L’activité de l’atelier s’affiche dès l’ouverture');
    await visible('[data-workshop-tabs] button[aria-pressed="true"]');
    const extractsTab = '[data-workshop-tabs] button:nth-of-type(2)';
    assert.equal(await page.$eval(extractsTab, node => node.textContent.trim()), 'Extractions');
    await activate(extractsTab);
    const extracts = '[data-warehouse-workshop][data-workshop-section="extracts"] [data-warehouse-extracts]';
    const lot = extracts + ' [aria-label="Lots de l’atelier"] button';
    await visible(lot);
    assert.match(await page.$eval(lot, node => node.textContent), /Lot prêt pour l’atelier/);
    await activate(lot);
    try {
      await page.waitForFunction(selector => {
        const panel = document.querySelector(selector);
        return panel?.dataset.screen === 'preparation' && panel.dataset.commerceLot?.startsWith('raw:')
          && /préparer une extraction/i.test(panel.innerText);
      }, {}, extracts);
    } catch {
      const panel = await page.$eval(extracts, node => ({
        screen:node.dataset.screen, lot:node.dataset.commerceLot, text:node.innerText,
      }));
      throw new Error(JSON.stringify(panel));
    }
    const backArt = await page.$eval(extracts, panel => {
      const back = [...panel.querySelectorAll('button')].find(button => /retour aux lots/i.test(button.textContent));
      return back ? getComputedStyle(back).borderImageSource : '';
    });
    assert.match(backArt, /control-paper-v2\.webp/, 'Le retour aux lots utilise le bouton papier');
    await page.$eval(extracts, node => node.scrollIntoView({block:'start', behavior:'instant'}));
    await capture(page, 'atelier-extractions', width);
  });
  await check('Atelier cadré et accès aux machines depuis l’entrepôt', 'actif', async () => {
    await activate(moduleButton('processing'));
    await activate('[data-workshop-tabs] button:last-of-type');
    await visible('[data-workshop-lab] [data-lab-stage]');
    await assertNoSupplierDetails('[data-workshop-lab]');
    await visible('aside[aria-label="Postes de travail"] [data-workshop-machine]');
    assert.equal(await page.$(map), null);
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll('[data-workshop-lab] img')].map(image => image.decode()));
      window.scrollTo(0, 0);
    });
    const scene = await page.$eval('[data-lab-stage]', node => {
      const frame = node.getBoundingClientRect();
      return { top: frame.top, bottom: frame.bottom, height: innerHeight, background: getComputedStyle(node.closest('[data-warehouse-v4]')).backgroundColor };
    });
    assert.equal(scene.background, 'rgb(246, 236, 210)', 'L’atelier reprend le fond crème du Pilotage');
    assert.ok(scene.top >= 0 && scene.bottom <= scene.height, `Le décor tient dans le premier écran à ${width} px`);
    await capture(page, 'atelier-machines', width);
    await activate('[data-workshop-machine="SIFT-TRAY"]');
    await visible('[data-workshop-machine-dialog][open]');
    await assertNoSupplierDetails('[data-workshop-machine-dialog][open]');
    await activate('[data-workshop-machine-dialog] button[aria-label="Fermer la fiche de la machine"]');
    await activate('[data-workshop-return]');
    await visible(map);
  });
  if (!mobile) {
    await check('Navigation des modules avec les flèches', 'actif', async () => {
      const production = moduleButton('production');
      await visible(production);
      await page.focus(production);
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(selector => document.activeElement.matches(selector), moduleButton('cleaning')), true);
      await assertContext(/aspirat|serpill/);
    });
  }
  await check('Échéance du nettoyage et accès aux deux passages', 'actif', async () => {
    await activate(moduleButton('cleaning'));
    await visible(context + ' [data-warehouse-cleaning] time');
    await visible(context + ' [data-warehouse-clean-step="vacuum"]');
    await visible(context + ' [data-warehouse-clean-step="mop"]');
  });
  await check('Alerte et accès direct à son action', 'alertes', async () => {
    const alert = '[data-warehouse-alert="cleaning"] button';
    await activate(alert);
    await assertContext(/expir|renouvel/);
    await visible(context + ' [data-warehouse-clean-step="vacuum"]');
    await capture(page, 'priorite', width);
  });
  await check('Localisation d’une culture depuis la synthèse', 'actif', async () => {
    await activate('[data-warehouse-metric="production"]');
    await activate('[data-warehouse-stage-zone="starter"]');
    await visible('[data-grow-footprint="starter"][data-selected="true"]');
    await assertContext(/culture ouest|charlotte/);
  });
  await check('Extraction sélectionnée depuis la scène, portée et légende', 'actif', async () => {
    await activate('[data-warehouse-equipment-hit="air-starter"]');
    await visible('[data-coverage-details="air"]');
    await visible('[data-air-coverage-cell]');
    await visible('[aria-label="Légende de la couverture"]');
    await capture(page, 'couverture-air', width);
    await activate('[data-coverage-details="air"] button');
    await page.waitForSelector('[data-air-coverage-cell]', {hidden:true});
  });
  await check('Caméra sélectionnée depuis la scène et échéance', 'actif', async () => {
    await activate(moduleButton('security'));
    await activate('[data-security-camera-hit="camera-test"]');
    assert.equal(await page.$eval('[data-security-camera-hit="camera-test"]', node => node.getAttribute('aria-pressed')), 'true');
    await assertContext(/caméra|couverture/);
    await visible(context + ' [data-warehouse-security] time');
    await assertNoSupplierDetails(context + ' [data-warehouse-security]');
    await capture(page, 'securite', width);
  });
  await check('Quantités en stock, réservées et accès pour la culture', 'actif', async () => {
    await activate(moduleButton('inputs'));
    const productSelect = '[data-warehouse-inputs] label:has(option[value="CARE-COMPOST-TEA"]) select';
    await visible(productSelect);
    await page.select(productSelect, 'CARE-COMPOST-TEA');
    await visible('[data-warehouse-input="CARE-COMPOST-TEA"]');
    await assertNoSupplierDetails('[data-warehouse-input="CARE-COMPOST-TEA"]');
    const name = await page.$eval('[data-warehouse-input="CARE-COMPOST-TEA"] h4', heading => ({
      text:heading.textContent,
      fits:heading.scrollWidth <= heading.clientWidth,
    }));
    assert.equal(name.text, retail['CARE-COMPOST-TEA'].name);
    assert.equal(name.fits, true, 'Le nom complet tient dans le panneau');
    await assertContext(/185/);
    await assertContext(/30/);
    await assertContext(/100/);
    await assertContext(/accessible au cycle/);
    if (mobile) await page.$eval(context, node => node.scrollIntoView({block:'start', behavior:'instant'}));
    await capture(page, 'intrants', width);
    await activate('[data-warehouse-input="CARE-COMPOST-TEA"] button[data-primary]');
    await visible(shop + ' [data-warehouse-supply="CARE-COMPOST-TEA"]');
    await assertNoSupplierDetails(shop + ' [data-warehouse-supply="CARE-COMPOST-TEA"]');
    assert.equal(await page.$(shop + ' [role="tabpanel"] > h3'), null, 'The selected shop tab is the visible category label');
    assert.equal(await page.$eval(shop + ' [data-warehouse-shop-category="nutrition"]', node => node.getAttribute('aria-selected')), 'true');
    await activate(shop + ' button[aria-label="Fermer le catalogue"]');
    await page.waitForSelector(shop, {hidden:true});
    await visible('[data-warehouse-input="CARE-COMPOST-TEA"]');
    await page.select(productSelect, 'WAREHOUSE-NUTRITION-BASE');
    await assertContext(/ce cycle ne peut plus utiliser ce produit/);
  });
  await check('Aménagement, restauration du brouillon, annulation et confirmation du devis', 'vide', async () => {
    const review = '[data-warehouse-plan-review]';
    const draftKey = 'lcb:warehouse-draft:v1:warehouse-pilotage-vide';
    const stageInstallation = async () => {
      await activate(mode('arrangement'));
      await activate('button[data-warehouse-build-shop]');
      await activate(shop + ' [data-warehouse-shop-choose="SIM-SUBSTRATE-01"]');
      await page.waitForSelector(shop, {hidden:true});
      await visible(map);
      await page.focus(map);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      if (mobile) {
        const cursor = '[data-warehouse-cursor]';
        await visible(cursor);
        await page.$eval(cursor, node => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
        const point = await page.$eval(cursor, node => {
          const bounds = node.getBoundingClientRect();
          return {x:bounds.x + bounds.width / 2, y:bounds.y + bounds.height / 2};
        });
        await page.touchscreen.tap(point.x, point.y);
      } else {
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
      }
      await visible(review);
      await visible('[data-warehouse-plan-payable-cents]');
    };
    await stageInstallation();
    await page.waitForFunction(key => !!sessionStorage.getItem(key), {}, draftKey);
    assert(await page.$eval(mode('pilotage'), button => button.disabled && button.textContent.includes('Brouillon en cours')));
    assert(await page.$('[data-warehouse-mode-switch="arrangement"]'));
    assert.equal(await page.evaluate(() => window.__requests.length), 0);
    await capture(page, 'brouillon', width);

    await openScene(page, 'vide');
    await page.waitForFunction(() => /brouillon a été restauré/.test(document.body.innerText));
    assert.equal(await page.evaluate(() => window.__snapshot.state.zones.length), 0);
    await activate('[data-warehouse-draft="true"] + button');
    await capture(page, 'devis', width);
    await activate(review + ' button[data-warehouse-action="reset"]');
    await page.waitForSelector(review, {hidden:true});
    await page.waitForFunction(key => !sessionStorage.getItem(key), {}, draftKey);
    assert.equal(await page.evaluate(() => window.__requests.length), 0);

    await stageInstallation();
    await activate(review + ' button[data-warehouse-action="save"]:enabled');
    await page.waitForFunction(() => window.__snapshot.revision === 2);
    assert.equal(await page.evaluate(() => window.__snapshot.state.zones.length), 1);
    assert.equal(await page.evaluate(() => window.__requests.length), 1);
    await activate(mode('pilotage'));
    assert.equal(await page.$eval(mode('pilotage'), node => node.getAttribute('aria-pressed')), 'true');
  });
}

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: Launcher.getInstallations()[0],
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  for (const width of [1440, 320]) {
    const mobile = width === 320;
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.setViewport({width, height:mobile?710:900, isMobile:mobile, hasTouch:mobile});
    await page.emulateMediaFeatures([{ name:'prefers-reduced-motion', value:'reduce' }]);
    await page.setRequestInterception(true);
    page.on('request', request => void (request.url().startsWith(origin + '/') || request.url().startsWith('data:')
      ? request.continue() : request.abort()));
    page.on('dialog', async dialog => {
      if (dialog.type() === 'beforeunload') await dialog.accept();
      else {
        errors.push('Dialogue inattendu : ' + dialog.message());
        await dialog.dismiss();
      }
    });
    page.on('pageerror', error => errors.push(error.message));
    try {
      for (const scenario of scenarios) {
        await openScene(page, scenario);
        const proof = await page.$(mode('pilotage')) !== null;
        assert.equal(proof, !baseline, 'Confirme la version capturée');
        await capture(page, scenario, width);
        const layout = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          height: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          title: document.querySelector('h1,h2')?.textContent,
          mapTop: Math.round(document.querySelector('[data-warehouse-map]').getBoundingClientRect().top),
          mapHeight: Math.round(document.querySelector('[data-warehouse-map]').getBoundingClientRect().height),
          renderer: document.querySelector('[data-warehouse-map]').dataset.renderer,
        }));
        measurements.push({scenario, ...layout, proof});
      }
      if (!baseline) await runChecks(page, width);
    } finally {
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(checks.filter(check => check.result === 'échec').map(check => [check.width, check.name, check.error]), []);
} finally {
  await writeFile(resolve(output, `rapport-${phase}.json`), JSON.stringify({ measurements, checks, errors }, null, 2) + '\n');
  await browser?.close();
  await server.close();
  await unlink(runner);
}
