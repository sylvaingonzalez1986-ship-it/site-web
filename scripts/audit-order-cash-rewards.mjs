/** Actual reward components with a synthetic local API; no accounts or remote writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const reportDir = resolve(root, 'output/order-cash-rewards');
const origin = 'http://127.0.0.1:3198';
const requests = [], browserErrors = [], blockedRequests = [], results = [];
const paidReceipt = {
  orderId: 'order-one', productsAmountCents: 5000, cashCents: 50000,
  grantedAt: '2026-09-27T12:00:00Z', ruleVersion: 'order-cash-v1',
};
let fixture = { available: true, receipts: [], status: 200 };
const modules = {
  'order-cash-audit': `
    import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {OrderCashRewardPreview,OrderCashRewardReceipt} from '/src/components/checkout/OrderCashReward';
    function App(){const params=new URLSearchParams(location.search);const [amount,setAmount]=useState(50);const [orderId,setOrderId]=useState('order-one');
      return React.createElement('main',null,params.has('receipt')?
        React.createElement(React.Fragment,null,
          React.createElement('button',{onClick:()=>setOrderId('order-two')},'Autre commande'),
          React.createElement(OrderCashRewardReceipt,{orderId,paymentState:params.get('state')??'paid'})):
        React.createElement(React.Fragment,null,
          React.createElement('label',null,'Produits après remises ',React.createElement('input',{id:'amount',type:'number',step:'.01',value:amount,onChange:event=>setAmount(Number(event.target.value))})),
          React.createElement(OrderCashRewardPreview,{productsAmount:amount,active:!params.has('closed')})));}
    createRoot(document.getElementById('root')).render(React.createElement(App));
  `,
  'order-cash-link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
};
const server = await createServer({
  root, configFile: false, envDir: false, publicDir: false, cacheDir: resolve(reportDir, 'vite-cache'),
  esbuild: { jsx: 'automatic' }, resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'] },
  plugins: [{ name: 'local-order-cash-audit', enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('/navigation/NavigationLink')) return '\0order-cash-link';
      if (Object.hasOwn(modules, id)) return '\0' + id;
    },
    load(id) { if (id.startsWith('\0')) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url === '/api/account/order-cash-rewards') {
          requests.push(request.method);
          response.setHeader('Content-Type', 'application/json'); response.statusCode = fixture.status;
          response.end(JSON.stringify({ rewards: {
            available: fixture.available, gameEurosPerEuro: 10, startsAt: '2026-09-27T12:00:00Z', receipts: fixture.receipts,
          } })); return;
        }
        if (request.url?.startsWith('/api/')) { response.statusCode = 404; response.end('Unexpected API'); return; }
        if (request.url?.split('?')[0] !== '/') return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bonus de commande · vérification locale</title><style>
          *{box-sizing:border-box}body{margin:0;background:#fffaf1;font-family:Arial,sans-serif}main{max-width:620px;margin:0 auto;padding:14px;min-width:0}label{font-size:14px}input{max-width:100%;width:110px;padding:8px}button{min-height:44px}
        </style><div id="root"></div><script type="module" src="/@id/__x00__order-cash-audit"></script></html>`);
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3198, strictPort: true, hmr: false, watch: null },
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
  const open = async (query = '') => {
    requests.length = 0;
    await page.goto(origin + '/' + query, { waitUntil: 'networkidle0' });
  };
  const text = () => page.$eval('main', element => element.textContent.replace(/\s+/g, ' ').trim());
  const noCard = async () => assert.equal(await page.$('aside'), null);
  const layout = async () => {
    const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      outside: [...document.querySelectorAll('main aside,main a,main input')].filter(element => {
        const rect = element.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1;
      }).map(element => element.textContent.slice(0, 80)) }));
    assert(result.scrollWidth <= result.width + 1, JSON.stringify(result)); assert.deepEqual(result.outside, []);
    return result;
  };
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    fixture = { available: true, receipts: [], status: 200 };
    await open(); assert.match(await text(), /\+500 € de jeu/); assert.deepEqual(requests, ['GET']);
    assert.match(await text(), /après remises et hors livraison/);
    assert.match(await text(), /mêmes fleurs/);
    const previewLayout = await layout();
    await page.screenshot({ path: resolve(reportDir, `preview-${width}.png`), fullPage: true });
    await page.$eval('#amount', element => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, '25.55');
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => document.body.textContent.includes('255,5'));
    assert.match(await text(), /\+255,5 € de jeu/); assert.deepEqual(requests, ['GET']);
    await page.$eval('#amount', element => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, '0');
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => !document.querySelector('aside'));
    await open('?closed'); await noCard(); assert.deepEqual(requests, []);
    fixture.available = false; await open(); await noCard();
    fixture.available = true;
    for (const state of ['pending', 'failed', 'not_configured']) {
      await open('?receipt&state=' + state); await noCard(); assert.deepEqual(requests, []);
    }
    await open('?receipt'); await noCard(); assert.deepEqual(requests, ['POST']);
    fixture.receipts = [{ ...paidReceipt, cashCents: 0 }]; await open('?receipt'); await noCard();
    fixture.receipts = [{ ...paidReceipt, orderId: 'unrelated-order' }]; await open('?receipt'); await noCard();
    fixture.receipts = [paidReceipt]; await open('?receipt');
    assert.match(await text(), /\+500 € de jeu crédités/);
    assert.equal(await page.$eval('aside a', element => element.getAttribute('href')), '/arene/placard');
    const receiptLayout = await layout();
    await page.screenshot({ path: resolve(reportDir, `receipt-${width}.png`), fullPage: true });
    await page.click('main button'); await page.waitForFunction(() => !document.querySelector('aside'));
    await page.waitForNetworkIdle(); await noCard();
    fixture.status = 503; await open('?receipt'); await noCard(); await open(); await noCard();
    results.push({ width, previewLayout, receiptLayout, scenarios: 12 });
  }
  assert.deepEqual(browserErrors, []); assert.deepEqual(blockedRequests, []);
  await writeFile(resolve(reportDir, 'report.json'), JSON.stringify({ results, browserErrors, blockedRequests }, null, 2));
  console.log(JSON.stringify({ passed: true, widths: results.map(result => result.width), scenarios: 48, browserErrors, blockedRequests }));
} finally {
  await browser?.close(); await server.close();
}
