/** Actual notebook components, synthetic local API, headless browser, no credentials. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { buildKqProducerRewardProgress } from '../src/lib/kanab-quest-producer-rewards.ts';
import { getKqNotebookBuddieOdds, getKqNotebookQuantityReward } from '../src/lib/kanab-quest-notebook-quantity.ts';

const root = process.cwd();
const reportDir = resolve(root, 'output/notebook-quantity');
const origin = 'http://127.0.0.1:3199';
const quantitySelector = 'section[aria-label="Bonus quantité par fleur"]';
const oddsSelector = 'dl[aria-label="Probabilités du tirage Buddie"]';
const requests = [], browserErrors = [], blockedRequests = [], results = [];
let fixture;
const initialFixture = () => ({ grams: [5, 0], granted: [23_000, 0], purchasedAll: false, reviewed: ['a'],
  quantityAvailable: true, purchaseGranted: false, frozenOdds: null, failNext: false });
const currentOdds = () => {
  const odds = [getKqNotebookBuddieOdds('regular', fixture.grams[0]), getKqNotebookBuddieOdds('concours', fixture.grams[1])];
  return Object.fromEntries(['common', 'silver', 'gold'].map(rarity => [rarity, (odds[0][rarity] + odds[1][rarity]) / 2]));
};
const campaign = () => buildKqProducerRewardProgress({
  campaignId: '', producerId: 'producer', producerName: 'Le Jardin des découvertes', heritageCode: '',
  heritageName: '', heritageDescription: '', heritageGranted: false,
  entries: [
    { entryId: 'entry-a', productId: 'a', title: 'Douceur de Bretagne', track: 'regular' },
    { entryId: 'entry-b', productId: 'b', title: 'Fleur du soleil', track: 'concours' },
  ],
  approvedProductIds: fixture.reviewed, purchasedProductIds: fixture.purchasedAll ? ['a', 'b'] : ['a'],
  completionGranted: false, completionCashCents: 20_000, quantityRewardsAvailable: fixture.quantityAvailable,
  quantityRewards: ['a', 'b'].map((productId, index) => {
    const reward = getKqNotebookQuantityReward(fixture.grams[index]);
    return { productId, bestOrderGrams: fixture.grams[index], totalCashCents: reward.totalCashCents,
      bonusCashCents: reward.bonusCashCents, grantedCashCents: fixture.granted[index],
      availableCashCents: fixture.reviewed.includes(productId) ? Math.max(0, reward.bonusCashCents - fixture.granted[index]) : 0 };
  }),
  purchaseGranted: fixture.purchaseGranted,
  purchaseCard: fixture.purchaseGranted ? { code: 'COMMON-LOCAL', name: 'Le compagnon du jardin', rarity: 'common', imageUrl: '' } : null,
  purchaseOdds: fixture.quantityAvailable ? fixture.purchaseGranted ? fixture.frozenOdds : currentOdds() : null,
});

const modules = {
  'notebook-quantity-audit': `
    import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ProducerRewardJourney} from '/src/components/contest/ProducerRewardJourney';
    import {NotebookQuantityBonusPreview} from '/src/components/contest/NotebookQuantityBonus';
    function App(){const [grams,setGrams]=useState(5);const params=new URLSearchParams(location.search);
      return React.createElement('main',{className:'audit-page'},params.has('preview')?
        React.createElement(React.Fragment,null,
          React.createElement('label',null,'Quantité choisie ',React.createElement('select',{id:'preview-grams',value:grams,onChange:event=>setGrams(Number(event.target.value))},[1,3,5,10,20].map(value=>React.createElement('option',{key:value,value},value+' g')))),
          React.createElement(NotebookQuantityBonusPreview,{productId:params.has('outside')?'not-in-notebook':'a',grams})):
        React.createElement(ProducerRewardJourney,{isAuthenticated:true,embedded:true,entryId:'entry-a'}));}
    createRoot(document.getElementById('root')).render(React.createElement(App));
  `,
  'notebook-cart-fixture': `export const useCart=()=>({user:new URLSearchParams(location.search).has('guest')?null:{id:'local-customer'}});`,
  'notebook-link-fixture': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src});}`,
};
const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, 'public'), cacheDir: resolve(reportDir, 'vite-cache'),
  esbuild: { jsx: 'automatic' }, resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'local-notebook-quantity', enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('/context/CartContext')) return '\0notebook-cart-fixture';
      if (id.endsWith('/navigation/NavigationLink')) return '\0notebook-link-fixture';
      if (Object.hasOwn(modules, id)) return '\0' + id;
    },
    load(id) { if (id.startsWith('\0')) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url === '/api/contest/producer-rewards') {
          response.setHeader('Content-Type', 'application/json');
          if (request.method === 'GET') { response.end(JSON.stringify({ campaigns: [campaign()] })); return; }
          let body = '';
          request.on('data', chunk => { body += chunk; });
          request.on('end', () => {
            const claim = JSON.parse(body); requests.push(claim);
            if (fixture.failNext) {
              fixture.failNext = false; response.statusCode = 503;
              response.end(JSON.stringify({ error: 'Erreur de test : ta progression est conservée, réessaie.' })); return;
            }
            assert.deepEqual(Object.keys(claim).sort(), ['action', 'producerId']);
            assert.equal(claim.producerId, 'producer');
            let receipt;
            if (claim.action === 'quantity-bonus') {
              const quantities = campaign().entries.map(entry => entry.quantityReward);
              const cashCents = quantities.reduce((sum, item) => sum + item.availableCashCents, 0);
              quantities.forEach((item, index) => { fixture.granted[index] += item.availableCashCents; });
              receipt = { producerId: 'producer', cashCents, alreadyGranted: cashCents === 0 };
            } else if (claim.action === 'purchase-buddie' && fixture.purchasedAll) {
              const alreadyGranted = fixture.purchaseGranted;
              if (!alreadyGranted) fixture.frozenOdds = currentOdds();
              fixture.purchaseGranted = true;
              receipt = { producerId: 'producer', alreadyGranted, cardRarity: 'common' };
            } else {
              response.statusCode = 409; response.end(JSON.stringify({ error: 'Récompense indisponible.' })); return;
            }
            response.end(JSON.stringify({ receipt, campaign: campaign() }));
          }); return;
        }
        if (request.url?.startsWith('/api/')) {
          response.statusCode = 404; response.end('Unexpected API in isolated audit'); return;
        }
        if (request.url?.split('?')[0] !== '/') return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bonus Carnet · vérification locale</title><style>
          @font-face{font-family:AuditDisplay;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}
          @font-face{font-family:AuditBody;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:400 700}
          :root{--font-display:AuditDisplay;--font-body:AuditBody;--font-sans:AuditBody}body{margin:0;font-family:AuditBody,sans-serif;background:#fffaf1}
          .audit-page{max-width:900px;margin:0 auto;padding:12px;min-width:0}
        </style><div id="root"></div><script type="module" src="/@id/__x00__notebook-quantity-audit"></script></html>`);
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3199, strictPort: true, hmr: false, watch: null },
});

let browser;
try {
  await mkdir(reportDir, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
    userDataDir: resolve(reportDir, 'chrome-profile'), args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); page.setDefaultTimeout(15_000);
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.origin === origin) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  const text = selector => page.$eval(selector, element => element.textContent.replace(/\s+/g, ' ').trim());
  const open = async (query = '') => {
    await page.goto(origin + '/' + query, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !document.body.textContent.includes('Chargement de tes dégustations'));
  };
  const button = async label => {
    const handle = await page.waitForFunction(label => [...document.querySelectorAll('button')]
      .find(button => !button.disabled && button.textContent.replace(/\s+/g, ' ').trim() === label), {}, label);
    await handle.asElement().click(); await handle.dispose();
  };
  const assertNoButton = async label => assert.equal(await page.$$eval('button', (buttons, label) => buttons
    .filter(button => button.textContent.replace(/\s+/g, ' ').trim() === label).length, label), 0);
  const layout = async () => {
    const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll('main button')].map(element => {
        const style = getComputedStyle(element);
        return { text: element.textContent.trim(), color: style.color, background: style.backgroundColor };
      }),
      outside: [...document.querySelectorAll('main button,main a,main select,main dl,main li')]
        .filter(element => element.getClientRects().length).filter(element => {
          const rect = element.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1;
        }).map(element => element.textContent.slice(0, 100)) }));
    assert(result.scrollWidth <= result.width + 1, JSON.stringify(result)); assert.deepEqual(result.outside, []);
    for (const button of result.buttons) {
      assert.notEqual(button.color, button.background, 'Button label must contrast with its surface: ' + JSON.stringify(button));
      assert(button.color !== 'rgb(255, 255, 255)' || button.background !== 'rgba(0, 0, 0, 0)',
        'White button labels need an opaque surface: ' + JSON.stringify(button));
    }
    return result;
  };
  const shot = name => page.screenshot({ path: resolve(reportDir, name + '.png'), fullPage: true });
  const waitForQuantity = async cents => page.waitForFunction((selector, expected) => document.querySelector(selector)?.textContent
    .replace(/\s+/g, ' ').includes(expected), {}, quantitySelector,
    `${new Intl.NumberFormat('fr-FR').format(cents / 100)} € de supplément reçus`.replace(/\s+/g, ' '));

  for (const width of [320, 390, 768, 1440]) {
    fixture = initialFixture(); requests.length = 0;
    await page.setViewport({ width, height: width < 700 ? 844 : 1000, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 });
    await open(); await page.waitForSelector(quantitySelector);
    assert.equal(await page.$eval('progress', element => element.value), 1);
    assert.equal(await page.$eval('progress', element => element.max), 2);
    await assertNoButton('Récupérer mon bonus');
    assert.match(await text(oddsSelector), /Or2,25 %/);
    const partialLayout = await layout(); await shot(`partial-${width}`);
    await page.$$eval('details', details => details.forEach(element => { element.open = true; }));
    const expandedLayout = await layout();
    await page.$$eval('details', details => details.forEach(element => { element.open = false; }));
    assert.deepEqual(requests, [], 'Reading progress must not claim rewards');

    fixture.failNext = true;
    await button('Récupérer mes 270 € de supplément');
    await page.waitForSelector('[role="alert"]');
    assert.match(await text('[role="alert"]'), /progression est conservée/);
    assert.equal(fixture.granted[0], 23_000);
    await button('Récupérer mes 270 € de supplément'); await waitForQuantity(50_000);
    assert.equal(fixture.granted[0], 50_000);
    assert.match(await text('[role="status"]'), /270 € de bonus quantité/);
    await assertNoButton('Récupérer mes 270 € de supplément');
    await open(); await waitForQuantity(50_000);
    assert.equal(requests.length, 2, 'Reload must not issue another claim');

    fixture.purchasedAll = true; fixture.grams[1] = 1; await open(); await button('Tirer mon Buddie');
    await page.waitForFunction(() => document.body.textContent.includes('Buddie Commun'));
    await assertNoButton('Tirer mon Buddie');
    const frozenOdds = await text(oddsSelector);
    assert.match(frozenOdds, /Or2,25 %/);
    fixture.grams[0] = 10; await open();
    assert.equal(await text(oddsSelector), frozenOdds, 'A larger purchase must retain the historical draw odds');
    await button('Récupérer mes 700 € de supplément'); await waitForQuantity(120_000);
    assert.equal(fixture.granted[0], 120_000);
    await assertNoButton('Tirer mon Buddie');
    assert.equal(requests.filter(request => request.action === 'purchase-buddie').length, 1);
    const upgradedLayout = await layout(); await shot(`upgraded-after-common-${width}`);

    fixture = initialFixture(); await open();
    fixture.granted[0] = 50_000; // Another tab already received the quantity bonus.
    await button('Récupérer mes 270 € de supplément');
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('déjà été reçus'));
    assert.equal(fixture.granted[0], 50_000, 'A stale tab retry must keep the persisted total');
    await assertNoButton('Récupérer mes 270 € de supplément');
    await shot(`already-claimed-${width}`);

    fixture = { ...initialFixture(), quantityAvailable: false }; await open();
    assert.equal(await page.$(quantitySelector), null); assert.equal(await page.$(oddsSelector), null);
    assert(!(await text('main')).includes('1 %'), 'Legacy progress must not invent draw odds');
    await layout(); await shot(`legacy-${width}`);
    fixture = { ...initialFixture(), purchaseGranted: true, frozenOdds: null }; await open();
    assert.equal(await page.$(oddsSelector), null); await assertNoButton('Tirer mon Buddie');
    assert.match(await text('main'), /Buddie Commun/);

    fixture = initialFixture(); await open('?preview');
    await page.waitForSelector('aside');
    assert.match(await text('aside'), /600 € de monnaie de jeu/);
    assert.match(await text('aside'), /270 € de supplément/);
    await page.select('#preview-grams', '10');
    await page.waitForFunction(() => document.querySelector('aside')?.textContent.replace(/\s+/g, ' ').includes('1 300 €'));
    assert.match(await text('aside'), /970 € de supplément/);
    await page.select('#preview-grams', '20');
    assert.match(await text('aside'), /1 300 € de monnaie de jeu/);
    await page.select('#preview-grams', '1');
    assert.match(await text('aside'), /achat précédent de 5 g conserve ton meilleur palier/);
    const previewLayout = await layout(); await shot(`product-preview-${width}`);
    for (const query of ['?preview&guest', '?preview&outside']) { await open(query); assert.equal(await page.$('aside'), null); }
    fixture.quantityAvailable = false; await open('?preview'); assert.equal(await page.$('aside'), null);
    results.push({ width, partialLayout, expandedLayout, upgradedLayout, previewLayout, partialProducerClaim: true, serverFailureRetry: true,
      staleTabReplay: true, commonBuddie: true, persistedOdds: true, upgradeAfterDrawWithoutRedraw: true,
      legacyOddsAbsent: true, productPreviewCapAndHistoricalTier: true, unavailablePreviewHidden: true });
  }
  assert.deepEqual(browserErrors, []); assert.deepEqual(blockedRequests, []);
  await writeFile(resolve(reportDir, 'report.json'), JSON.stringify({ passed: true, results, browserErrors, blockedRequests }, null, 2));
  console.log(JSON.stringify({ passed: true, widths: results.map(result => result.width), reportDir }));
} catch (error) {
  await writeFile(resolve(reportDir, 'report.json'), JSON.stringify({ passed: false, error: String(error), results, browserErrors, blockedRequests }, null, 2));
  throw error;
} finally { await browser?.close(); await server.close(); }
