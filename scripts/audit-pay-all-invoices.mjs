/** Real invoice UI with isolated, in-memory payments. No external requests. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/pay-all-invoices');
const port = Number(process.env.KQ_PAY_ALL_PORT ?? 3282), origin = `http://127.0.0.1:${port}`;
const modules = {
  'invoices-entry': `import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
    import {KqTreasuryManagement} from '/src/components/placard/KqTreasuryManagement';
    import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
    import {createKqBusinessPreview,KQ_GAME_DAY_MS} from '/src/lib/kanab-quest-business';
    import {quoteKqEnergy} from '/src/lib/kanab-quest-energy';
    const root=createRoot(document.getElementById('root'));let revision=0;
    window.__showInvoices=mode=>{
      const now=Date.now(),iso=delta=>new Date(now+delta).toISOString();
      const invoice=(id,amount,remaining)=>({id,runId:'run-'+id,issuedAt:iso(-KQ_GAME_DAY_MS),dueAt:iso(KQ_GAME_DAY_MS),amountCents:amount,remainingCents:remaining});
      const business=createKqBusinessPreview(now);business.nextEventAt=null;
      business.lab={outstandingCents:6000,overdueCents:1500,invoices:[invoice('lab-a',4500,4500),invoice('lab-b',4500,1500),invoice('lab-paid',4500,0)]};
      // Outstanding suppliers include an older invoice omitted from the detail page.
      business.suppliers={outstandingCents:12500,overdueCents:0,invoices:[invoice('supplier-visible',4500,4500),invoice('supplier-paid',1000,0)]};
      business.vat.reservedCents=9000;
      business.shop={name:'Boutique témoin',createdAt:iso(-KQ_GAME_DAY_MS),paidUntil:iso(KQ_GAME_DAY_MS),renew:true,active:true};
      const climate={version:1,code:'CLIMATE-TEST',areaM2:20,kwhPerM2Month:2,tariffCentsPerKwh:20,monthlyKwh:40,monthlyCostCents:800,periodStartedAt:iso(-KQ_GAME_DAY_MS),nextBillingAt:iso(KQ_GAME_DAY_MS),accruedCents:700,outstandingCents:1000,invoices:[{id:'climate-unpaid',periodStartedAt:iso(-2*KQ_GAME_DAY_MS),periodEndedAt:iso(-KQ_GAME_DAY_MS),amountCents:1000,remainingCents:1000}]};
      business.storageClimate=climate;
      const commerce={business,cashCents:50000,reputation:0,clients:0,shopPartners:0,computerOwned:true,internetRenew:false,revision:1,campaign:null,rawLots:[],stocks:[],receipts:[],marketVolumes:{},ownVolumes:{},routeSales:{},electricityOutstandingCents:3500};
      const energy={cashCents:commerce.cashCents,outstandingCents:3500,invoiceCount:2,bestGramsPerKwh:null,invoices:[{runId:'energy-unpaid',createdAt:iso(-KQ_GAME_DAY_MS),totalCents:3000,remainingCents:2500,harvestGrams:100,quote:quoteKqEnergy([])}],storageClimate:climate,quotes:{}};
      const receipts=new Map();
      const audit={mode,commerce,energy,posts:[],reads:[],paidCents:0,hold:false,release:null,events:[]};window.__invoiceAudit=audit;
      const clearInvoices=()=>{business.lab.outstandingCents=0;business.lab.overdueCents=0;for(const i of business.lab.invoices)i.remainingCents=0;if(business.suppliers){business.suppliers.outstandingCents=0;business.suppliers.overdueCents=0;for(const i of business.suppliers.invoices)i.remainingCents=0;}energy.outstandingCents=0;commerce.electricityOutstandingCents=0;for(const i of energy.invoices)i.remainingCents=0;climate.outstandingCents=0;for(const i of climate.invoices)i.remainingCents=0;};
      if(mode==='none')clearInvoices();
      if(mode==='poor')commerce.cashCents=energy.cashCents=5000;
      if(mode==='suppliers-unavailable')delete business.suppliers;
      const request=async(input,init={})=>{
        const path=new URL(String(input),location.origin).pathname,method=init.method??'GET';
        if(!['/api/arena/placard/commerce','/api/arena/placard/energy'].includes(path))throw new Error('Unexpected fixture path '+path);
        if(method==='GET'){audit.reads.push(path);if(path.endsWith('/energy')&&mode==='energy-unavailable')return Response.json({error:'Lecture énergie indisponible.'},{status:503});return Response.json(path.endsWith('/commerce')?commerce:energy);}
        if(method!=='POST'||!path.endsWith('/commerce'))throw new Error('Unexpected write '+method+' '+path);
        const body=JSON.parse(init.body);audit.posts.push({path,body});
        if(body.action!=='pay-all-invoices'||typeof body.requestKey!=='string'||!body.requestKey)throw new Error('Invalid batch-payment command');
        if(audit.hold)await new Promise(resolve=>{audit.release=resolve;});
        if(receipts.has(body.requestKey))return Response.json({...receipts.get(body.requestKey),replayed:true});
        const total=business.lab.outstandingCents+energy.outstandingCents+(business.suppliers?.outstandingCents??0);
        if(mode==='stale'||body.expectedCents!==total)return Response.json({error:'Le montant a changé. Actualise les factures avant de confirmer.'},{status:409});
        if(total>commerce.cashCents)return Response.json({error:'Trésorerie insuffisante.'},{status:409});
        commerce.cashCents-=total;energy.cashCents=commerce.cashCents;audit.paidCents+=total;clearInvoices();
        const receipt={action:'pay-all-invoices',paidCents:total,cashAfterCents:commerce.cashCents,replayed:false};receipts.set(body.requestKey,receipt);
        if(mode==='lost-response'&&audit.posts.length===1)return Response.json({error:'Confirmation non reçue. Vérifie ou réessaie ce règlement.'},{status:503});
        return Response.json(receipt);
      };
      const api=createKqTutorialApi(request),notify=api.notify;api.notify=(name,detail)=>{audit.events.push(name);notify(name,detail);};
      root.render(<KqTutorialApiProvider key={++revision} api={api}><div data-fixture-mode={mode}><KqTreasuryManagement section="invoices" onOpenShop={()=>{}}/></div></KqTutorialApiProvider>);
    };window.__showInvoices('normal');`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,sizes,...props}){return <img {...props} style={{...props.style,...(fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:{})}}/>}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,replace,scroll,...props}){return <a {...props}/>}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams();`,
};
const server = await createServer({
  configFile: false, envDir: false, root, publicDir: resolve(root, 'public'), cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') } }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'lucide-react'] },
  plugins: [{ name: 'pay-all-fixture', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/') return next();
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Display;src:url("/src/app/fonts/BarlowCondensed-Latin-Black.woff2");font-weight:900}@font-face{font-family:Body;src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}:root{--font-body:Body;--font-display:Display}body{margin:0;background:#fff1d6}#root{max-width:1200px;margin:auto;padding:12px}</style><div id="root"></div><script type="module" src="/@id/__x00__invoices-entry"></script></html>');
    }); } }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
let browser, page;
const errors = [], checks = [], layouts = [], blockedRequests = [];
const batch = '[data-pay-all-invoices]';
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(output, 'chrome-profile'), args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(35_000); page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === origin || url.protocol === 'data:') void request.continue();
    else { blockedRequests.push(url.origin); void request.abort(); }
  });
  const click = async (text, scope = 'body') => {
    assert(await page.evaluate(({ text, scope }) => {
      const target = [...document.querySelectorAll(scope + ' button')].find(button => button.textContent.trim() === text && !button.disabled);
      if (!target) return false; target.click(); return true;
    }, { text, scope }), 'Clickable button: ' + text);
  };
  const scenario = async mode => {
    await page.evaluate(mode => window.__showInvoices(mode), mode); await page.waitForSelector(`[data-fixture-mode="${mode}"] ${batch}`);
    await page.waitForFunction(() => !document.querySelector('[aria-label="Factures et échéances"] [role="status"]')?.textContent.includes('Ouverture'));
  };
  const fit = async label => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' fits viewport');
  const open = async () => { await page.focus(batch); await page.keyboard.press('Enter'); await page.waitForSelector('dialog[open]'); };
  const confirm = async () => {
    assert(await page.evaluate(() => {
      const button = [...document.querySelectorAll('dialog[open] button')].find(button => button.textContent.trim() === 'Confirmer' && !button.disabled);
      if (!button) return false;
      button.focus(); const rect = button.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44;
    }), 'Confirmation is reachable by keyboard within the viewport');
    await page.keyboard.press('Enter');
  };
  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: width < 700 ? 568 : 900, isMobile: width < 700, hasTouch: width < 700 });
    await page.goto(origin, { waitUntil: 'networkidle0' }); await page.waitForFunction(() => typeof window.__showInvoices === 'function');
    await scenario('normal'); await fit('Invoices at ' + width);
    assert.match(await page.$eval(batch, element => element.textContent), /Régler toutes les factures.*220/);
    const layout = await page.evaluate(() => {
      const button = document.querySelector('[data-pay-all-invoices]'), rect = button.getBoundingClientRect();
      const summary = document.querySelector('[aria-label="Situation avant règlement"]');
      const details = document.querySelector('[data-invoice-analysis]');
      return { width: innerWidth, paymentTop: rect.top, paymentBottom: rect.bottom, paymentHeight: rect.height,
        labelSizes: [...summary.querySelectorAll('dt, span')].map(label => parseFloat(getComputedStyle(label).fontSize)),
        breakdownClosed: !details.open, breakdownTop: details.getBoundingClientRect().top };
    });
    assert(layout.paymentBottom <= (width < 700 ? 568 : 900), 'Payment is visible before scrolling within the invoice panel');
    assert(layout.paymentBottom < layout.breakdownTop && layout.breakdownClosed, 'Payment precedes collapsed secondary charts');
    assert(layout.labelSizes.every(size => size >= 14), 'Summary labels remain legible at every width');
    layouts.push(layout);
    await page.screenshot({ path: resolve(output, `normal-${width}.png`), fullPage: true });
    const breakdown = '[data-invoice-analysis]';
    await page.focus(breakdown + ' > summary'); await page.keyboard.press('Enter');
    assert(await page.$eval(breakdown, element => element.open), 'Charts can be expanded with the keyboard');
    await fit('Expanded charts at ' + width);
    await page.keyboard.press('Enter');
    for (const filter of ['Fournisseurs', 'Laboratoire', 'Électricité & soins', 'Toutes']) {
      await click(filter, '[aria-label="Type de factures"]');
      assert.match(await page.$eval(batch, element => element.textContent), /220/,'Total is independent of '+filter);
    }
    await click('Laboratoire', '[aria-label="Type de factures"]'); await open();
    const dialogText = await page.$eval('dialog[open]', element => element.textContent.replace(/[\u00a0\u202f]/g, ' '));
    assert.match(dialogText, /Régler toutes les factures/); for (const amount of ['220', '125', '60', '35', '280']) assert(dialogText.includes(amount), 'Confirmation includes ' + amount + ' EUR');
    assert.equal(await page.evaluate(() => window.__invoiceAudit.posts.length), 0, 'Opening confirmation does not pay');
    await fit('Confirmation at ' + width); await page.screenshot({ path: resolve(output, `confirmation-${width}.png`) });
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.equal(await page.evaluate(() => window.__invoiceAudit.posts.length), 0, 'Cancelling confirmation does not pay');
    await open(); await page.evaluate(() => { window.__invoiceAudit.hold = true; });
    await page.evaluate(() => { const button = [...document.querySelectorAll('dialog[open] button')].find(button => button.textContent.trim() === 'Confirmer'); button.click(); button.click(); });
    await page.waitForFunction(() => window.__invoiceAudit.posts.length === 1 && typeof window.__invoiceAudit.release === 'function');
    assert(await page.$eval(batch, button => button.disabled), 'Batch button is disabled during payment');
    await page.evaluate(() => { window.__invoiceAudit.hold = false; window.__invoiceAudit.release(); });
    await page.waitForFunction(() => !document.querySelector('dialog[open]') && window.__invoiceAudit.paidCents === 22000);
    assert.deepEqual(await page.evaluate(() => ({ amount: window.__invoiceAudit.posts[0].body.expectedCents, posts: window.__invoiceAudit.posts.length, cash: window.__invoiceAudit.commerce.cashCents, vat: window.__invoiceAudit.commerce.business.vat.reservedCents })), { amount: 22000, posts: 1, cash: 28000, vat: 9000 });
    await page.waitForFunction(() => document.querySelector('[data-pay-all-invoices]')?.disabled && document.querySelector('[data-pay-all-invoices]')?.textContent.includes('0'));
    checks.push({ scenario: 'global-total-filter-confirm-double-click-payment', width });
    for (const mode of ['none', 'poor', 'energy-unavailable', 'suppliers-unavailable']) {
      await scenario(mode); assert(await page.$eval(batch, button => button.disabled), mode + ' blocks batch payment');
      await fit(mode + ' at ' + width); assert.equal(await page.evaluate(() => window.__invoiceAudit.posts.length), 0);
      if (mode === 'poor') assert.match(await page.$eval('[aria-label="Factures et échéances"]', element => element.textContent), /170/);
      if (mode.endsWith('-unavailable')) {
        assert.match(await page.$eval('[aria-label="Situation avant règlement"]', element => element.textContent), /Total à réglerÀ actualiser/);
        assert.match(await page.$eval('[aria-label="Situation avant règlement"]', element => element.textContent), /Solde après règlement à confirmer/);
      }
      if (mode === 'suppliers-unavailable') assert.match(await page.$eval('[aria-label="Factures fournisseurs"]', element => element.textContent), /Factures fournisseur indisponibles/);
      await page.screenshot({ path: resolve(output, `${mode}-${width}.png`), fullPage: true });
      checks.push({ scenario: mode, width });
    }
    await scenario('stale'); await open(); await confirm(); await page.waitForSelector('dialog[open] [role="alert"]');
    assert.match(await page.$eval('dialog[open] [role="alert"]', element => element.textContent), /montant a changé/);
    assert.equal(await page.evaluate(() => window.__invoiceAudit.paidCents), 0, 'Server rejects stale amount without debiting');
    await click('Revenir', 'dialog[open]'); checks.push({ scenario: 'stale-total-no-payment', width });
    await scenario('lost-response'); await open(); await confirm(); await page.waitForSelector('dialog[open] [role="alert"]');
    assert.equal(await page.evaluate(() => window.__invoiceAudit.paidCents), 22000);
    await confirm(); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.deepEqual(await page.evaluate(() => ({ posts: window.__invoiceAudit.posts.length, paid: window.__invoiceAudit.paidCents, cash: window.__invoiceAudit.commerce.cashCents, sameKey: window.__invoiceAudit.posts[0].body.requestKey === window.__invoiceAudit.posts[1].body.requestKey })), { posts: 2, paid: 22000, cash: 28000, sameKey: true });
    checks.push({ scenario: 'lost-response-retry-same-key-no-double-debit', width });
  }
  assert.deepEqual(errors, []); assert.deepEqual(blockedRequests, [], 'No external network requested');
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: true, checks, layouts, errors, blockedRequests }, null, 2));
  console.log(JSON.stringify({ success: true, passed: checks.length, errors }));
} catch (error) {
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); await writeFile(resolve(output, 'failure.json'), JSON.stringify({ message: error.message, checks, errors, state: await page.evaluate(() => ({ audit: window.__invoiceAudit, text: document.body.innerText })).catch(() => null) }, null, 2)); }
  throw error;
} finally { await browser?.close(); await server.close(); }
