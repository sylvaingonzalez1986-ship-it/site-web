/** Real invoice UI with isolated, in-memory payments. No external requests. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/clarity-lot3/finance');
const port = Number(process.env.KQ_FINANCE_HIERARCHY_PORT ?? 3481), origin = `http://127.0.0.1:${port}`;
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
const phase = process.argv.includes('--before') ? 'before' : 'after';
const errors = [], results = [], external = [];
try {
  await mkdir(resolve(output, phase), { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(output, 'chrome-profile'), args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(30_000); page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === origin || url.protocol === 'data:') void request.continue();
    else { external.push(url.origin); void request.abort(); }
  });
  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 844 });
    await page.goto(origin, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.__showInvoices === 'function');
    for (const mode of ['normal', 'poor', 'none', 'energy-unavailable', 'suppliers-unavailable']) {
      await page.evaluate(mode => window.__showInvoices(mode), mode);
      await page.waitForSelector('[data-fixture-mode="' + mode + '"] [data-pay-all-invoices]');
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => {
        const amount = document.querySelector('[aria-label="Situation avant règlement"]');
        const payment = document.querySelector('[data-pay-all-invoices]');
        const first = document.querySelector('[data-supplier-invoice]');
        const calendar = document.querySelector('[data-upcoming-finances]') || document.querySelector('[aria-label="TVA réservée"]').parentElement;
        return { width: innerWidth, paymentTop: payment.getBoundingClientRect().top + scrollY,
          firstInvoiceTop: first ? first.getBoundingClientRect().top + scrollY : null,
          calendarHeight: calendar.getBoundingClientRect().height,
          documentHeight: document.documentElement.scrollHeight,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          amount: amount.textContent, disabled: payment.disabled,
          posts: window.__invoiceAudit.posts.length };
      });
      assert.equal(metrics.overflow, false, mode + ' fits at ' + width);
      assert.equal(metrics.posts, 0);
      assert.equal(metrics.disabled, mode !== 'normal');
      if (mode.endsWith('unavailable')) assert.match(metrics.amount, /À actualiser/);
      if (mode === 'poor') assert.match(metrics.amount, /Il manque/);
      if (phase === 'after') {
        assert.equal(await page.$eval('[data-invoice-analysis]', element => element.open), false);
        assert.equal(await page.$eval('[data-upcoming-rules]', element => element.open), false);
        assert(await page.evaluate(() => {
          const invoices = document.querySelector('[aria-label="Factures à régler"]');
          const analysis = document.querySelector('[data-invoice-analysis]');
          return !!(invoices.compareDocumentPosition(analysis) & Node.DOCUMENT_POSITION_FOLLOWING);
        }), 'Analysis follows invoice actions');
        const upcoming = await page.$eval('[data-upcoming-finances]', element => element.innerText);
        assert.match(upcoming, /90(?:[,.]00)?\s*€/);
        assert.match(upcoming, /8(?:[,.]00)?\s*€/);
        assert.match(upcoming, /7(?:[,.]00)?\s*€/);
        assert.match(upcoming, /Prochain débit/);
        assert.match(upcoming, /Renouvellement/);
        assert(!upcoming.includes('La TVA de jeu'), 'Long explanations stay in details');
        if (mode === 'normal') {
          await page.focus('[data-invoice-analysis] > summary'); await page.keyboard.press('Enter');
          assert.equal(await page.$eval('[data-invoice-analysis]', e => e.open), true);
          assert.match(await page.$eval('[data-invoice-analysis]', e => e.innerText), /50 %/);
          await page.keyboard.press('Enter');
          await page.focus('[data-upcoming-rules] > summary'); await page.keyboard.press('Enter');
          assert.equal(await page.$eval('[data-upcoming-rules]', e => e.open), true);
          assert.match(await page.$eval('[data-upcoming-rules]', e => e.innerText), /ne débite pas une seconde fois/);
          await page.keyboard.press('Enter');
        }
      }
      if (mode === 'normal') {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: resolve(output, phase, 'normal-' + width + '-full.png'), fullPage: true });
        await page.screenshot({ path: resolve(output, phase, 'normal-' + width + '-viewport.png') });
        const calendar = await page.$('[data-upcoming-finances]') || await page.$('[aria-label="TVA réservée"]');
        await calendar.screenshot({ path: resolve(output, phase, 'upcoming-' + width + '.png') });
      }
      results.push({ mode, ...metrics });
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(resolve(output, phase, 'report.json'), JSON.stringify({ results, errors, external }, null, 2));
  console.log(JSON.stringify({ phase, cases: results.length, normal: results.filter(r => r.mode === 'normal') }));
} finally { await browser?.close(); await server.close(); }
