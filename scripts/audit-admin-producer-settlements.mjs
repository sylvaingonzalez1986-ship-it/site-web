/** Real admin panel with synthetic sales and local API fixtures. No database or bank access. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/admin-producer-settlements");
const port = 3262;
const widths = [320, 390, 1440];
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import AdminLayout from '/src/app/admin/layout';
import {AdminProducerSettlementsPanel} from '/src/components/admin/AdminProducerSettlementsPanel';
import {buildProducerSettlementsDashboard} from '/src/lib/producer-settlements';
const scenario=new URLSearchParams(location.search).get('scenario');
const base={paymentState:'paid',status:'shipped',archivedAt:null,productId:'flower::10g',productName:'Fleur de démonstration · 10 g',producerId:'farm',producerName:'Ferme de démonstration',attribution:'producer',lineTotal:120,lineTotalHt:100,vatRate:20,unitWeightGrams:10};
const sources={
 producers:[{id:'farm',name:'Ferme de démonstration'},{id:'farm2',name:'Autre producteur'}],
 sales:[
  {...base,orderId:'sep-sale',createdAt:'2026-09-15T12:00:00Z',quantity:6},
  {...base,orderId:'oct-sale',createdAt:'2026-10-02T12:00:00Z',quantity:5},
  {...base,orderId:'other-sale',createdAt:'2026-09-16T12:00:00Z',producerId:'farm2',producerName:'Autre producteur',quantity:4,lineTotal:60,lineTotalHt:50},
 ],rates:[],payments:[],
};
window.__fixture={sources,requests:[],failLoad:scenario==='load-error',losePaymentResponse:false,holdPayment:false,releasePayment:null};
window.__dashboard=()=>buildProducerSettlementsDashboard(sources);
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
 const state=window.__fixture,method=init.method||'GET',body=init.body?JSON.parse(init.body):null;
 state.requests.push({path:url.pathname,method,body});
 if(url.pathname!=='/api/admin/producer-settlements')throw new Error('Unexpected fixture API '+url.pathname);
 if(method==='GET'){
  if(state.failLoad)return Response.json({error:'Chargement de démonstration indisponible.'},{status:503});
  return Response.json({dashboard:window.__dashboard()});
 }
 if(body.action==='payment'){
  if(state.holdPayment)await new Promise(resolve=>{state.releasePayment=resolve;});
  const existing=sources.payments.find(item=>item.id===body.id);
  if(!existing)sources.payments.unshift({...body,createdAt:new Date().toISOString(),voidedAt:null,voidReason:null});
  else if(['producerId','producerName','salesFromMonth','salesMonth','amountCents','paidOn','reference','note'].some(key=>existing[key]!==body[key]))return Response.json({error:'Identifiant réutilisé avec des valeurs différentes.'},{status:409});
  if(state.losePaymentResponse){state.losePaymentResponse=false;throw new TypeError('Connexion interrompue après enregistrement.');}
  return Response.json({ok:true});
 }
 if(body.action==='void'){
  const payment=sources.payments.find(item=>item.id===body.id);
  if(!payment)return Response.json({error:'Règlement introuvable.'},{status:404});
  payment.voidedAt=new Date().toISOString();payment.voidReason=body.reason;
  return Response.json({ok:true});
 }
 if(body.action==='rate'){
  sources.rates=sources.rates.filter(rate=>!(rate.producerId===body.producerId&&rate.productId===body.productId&&rate.effectiveMonth===body.effectiveMonth));
  sources.rates.push(body);return Response.json({ok:true});
 }
 return Response.json({error:'Unexpected fixture action'},{status:400});
};
createRoot(document.getElementById('root')).render(React.createElement(AdminLayout,null,React.createElement('main',{style:{maxWidth:1440,margin:'auto',padding:12}},React.createElement(AdminProducerSettlementsPanel))));
`;

const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, "public"),
  cacheDir: resolve(output, "vite-cache"), esbuild: { jsx: "automatic" },
  optimizeDeps: { include: ["react", "react-dom/client", "lucide-react"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "producer-settlements-fixture", enforce: "pre",
    resolveId(id) { if (id === "producer-settlements-entry.tsx") return "\0producer-settlements-entry.tsx"; },
    load(id) { if (id === "\0producer-settlements-entry.tsx") return entry; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Règlements producteurs · Démonstration locale</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__producer-settlements-entry.tsx"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});

let browser, page;
const errors = [], results = [], blockedRequests = [];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  page = await browser.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || (url.hostname === "127.0.0.1" && url.port === String(port) && !url.pathname.startsWith("/api/"))) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  const go = async (scenario = "ready") => {
    await page.goto(`http://127.0.0.1:${port}/?scenario=${scenario}`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
  };
  const waitText = text => page.waitForFunction(value => document.body.textContent.includes(value), {}, text);
  const click = async (text, index = 0) => {
    await page.$$eval("button", (buttons, { label, index }) => {
      const button = buttons.filter(item => item.textContent.trim() === label || item.getAttribute("aria-label") === label)[index];
      if (!button) throw new Error("Button not found: " + label);
      if (button.disabled) throw new Error("Button disabled: " + label);
      button.click();
    }, { label: text, index });
  };
  const field = async label => {
    await page.$$eval("label", (labels, label) => {
      const match = labels.find(item => [...item.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join("").trim() === label);
      const control = match?.querySelector("input,select,textarea");
      if (!control) throw new Error("Field not found: " + label);
      document.querySelector('[data-audit-field="active"]')?.removeAttribute("data-audit-field");
      control.setAttribute("data-audit-field", "active");
    }, label);
    return '[data-audit-field="active"]';
  };
  const setField = async (label, value) => {
    const selector = await field(label);
    await page.$eval(selector, (control, value) => {
      const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(control, value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };
  const fieldValue = async label => page.$eval(await field(label), control => control.value);
  const visiblePeriods = () => page.$$eval("details article h4", headings => headings.map(heading => heading.parentElement.textContent));
  const record = (name, width) => { results.push({ name, width, passed: true }); console.log(`PASS ${name} ${width}`); };
  const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "The document must fit the viewport");

  for (const width of widths) {
    await page.setViewport({ width, height: width < 768 ? 844 : 1000 });
    await go(); await waitText("Cumul par producteur"); await overflow();
    await page.screenshot({ path: resolve(output, `settlements-${width}.png`), fullPage: true });
    record("responsive-producer-settlements", width);
  }

  await page.setViewport({ width: 390, height: 844 });
  await go(); await waitText("Cumul par producteur");
  await setField("Producteur", "farm");
  await setField("Du mois (inclus)", "2026-09");
  await setField("Au mois (inclus)", "2026-10");
  assert.equal((await visiblePeriods()).length, 2);
  assert((await visiblePeriods()).every(text => text.includes("Ferme de démonstration")));
  const cumulative = await page.$$eval("article", articles => articles.find(article => article.querySelector("dl") && article.textContent.includes("Ferme de démonstration")).textContent);
  assert(cumulative.includes("110 g"));
  assert(cumulative.includes("1 palier(s) de 100 g atteint(s)"));
  assert(cumulative.replace(/\s+/g, " ").includes("160,00 €"));
  await page.$$eval("summary", summaries => summaries.find(summary => summary.textContent === "Détail par mois et par produit").click());
  await click("Détail des ventes et tarifs");
  await waitText("80 % du CA HT");
  assert.equal(await page.$eval("table", table => table.textContent.replace(/\s+/g, " ").includes("100,00 € HT")), true);
  assert.equal(await page.$eval("table", table => table.textContent.replace(/\s+/g, " ").includes("80,00 €")), true);
  await overflow();
  await page.screenshot({ path: resolve(output, "filtered-detail-390.png"), fullPage: true });
  record("producer-period-filters-and-80-percent-ht", 390);
  record("two-months-combine-into-110-grams-and-one-100-gram-threshold", 390);

  await setField("Du mois (inclus)", "2026-11");
  await waitText("Le mois de fin doit être égal ou postérieur au mois de début.");
  assert.equal((await visiblePeriods()).length, 0);
  await setField("Du mois (inclus)", "2026-09");
  await page.waitForFunction(() => document.querySelectorAll("details article h4").length === 2);
  record("reversed-period-is-explicit-and-recovers", 390);

  await click("Règlement de cette période");
  await waitText("Enregistrer un règlement effectué");
  assert.equal(await fieldValue("Producteur payé"), "farm");
  assert.equal(await fieldValue("Premier mois des ventes"), "2026-09");
  assert.equal(await fieldValue("Dernier mois des ventes"), "2026-10");
  assert.equal(await fieldValue("Montant payé (€)"), "160.00");
  await page.setViewport({ width: 320, height: 844 });
  await overflow();
  await page.screenshot({ path: resolve(output, "range-payment-form-320.png"), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  await setField("Premier mois des ventes", "2026-09");
  await setField("Dernier mois des ventes", "2026-10");
  await setField("Montant payé (€)", "100");
  await setField("Référence du paiement (facultatif)", "VIR-SEPT-OCT");
  await page.evaluate(() => { window.__fixture.losePaymentResponse = true; });
  await click("Valider le paiement effectué");
  await waitText("La connexion a été interrompue. Réessayez avec ce formulaire pour conserver la même référence de saisie.");
  assert.equal(await fieldValue("Montant payé (€)"), "100");
  assert.equal(await page.evaluate(() => window.__fixture.sources.payments.length), 1);
  const firstAttempt = await page.evaluate(() => window.__fixture.requests.find(request => request.body?.action === "payment").body);
  assert.equal(firstAttempt.salesFromMonth, "2026-09");
  assert.equal(firstAttempt.salesMonth, "2026-10");
  assert.equal(firstAttempt.amountCents, 10000);
  await page.screenshot({ path: resolve(output, "payment-retry-390.png"), fullPage: true });

  await page.evaluate(() => { window.__fixture.holdPayment = true; });
  await page.$$eval("button", buttons => {
    const button = buttons.find(item => item.textContent.trim() === "Valider le paiement effectué");
    button.click(); button.click();
  });
  await page.waitForFunction(() => typeof window.__fixture.releasePayment === "function");
  assert.equal(await page.evaluate(() => window.__fixture.requests.filter(request => request.body?.action === "payment").length), 2);
  await page.evaluate(() => { window.__fixture.holdPayment = false; window.__fixture.releasePayment(); });
  await waitText("Le règlement a été enregistré");
  assert.equal(await page.evaluate(() => window.__fixture.sources.payments.length), 1);
  assert.deepEqual(await page.evaluate(() => window.__fixture.requests.filter(request => request.body?.action === "payment").map(request => request.body.id)), [firstAttempt.id, firstAttempt.id]);
  const balances = await page.evaluate(() => window.__dashboard().periods.filter(period => period.producerId === "farm").map(period => [period.month, period.dueCents, period.paidCents, period.balanceCents]));
  assert.deepEqual(balances, [["2026-10", 8000, 2000, 6000], ["2026-09", 8000, 8000, 0]]);
  await overflow();
  await page.screenshot({ path: resolve(output, "payment-recorded-390.png"), fullPage: true });
  record("one-payment-covers-two-months-oldest-sales-first", 390);
  record("lost-response-retry-and-double-click-never-duplicate-payment", 390);

  await click("Annuler cette saisie");
  await setField("Motif de l’annulation", "Erreur de saisie de démonstration");
  await click("Confirmer l’annulation de la saisie");
  await waitText("La saisie a été annulée");
  await waitText("Annulé · exclu des totaux");
  const afterVoid = await page.evaluate(() => window.__dashboard().periods.filter(period => period.producerId === "farm"));
  assert.equal(afterVoid.reduce((sum, period) => sum + period.paidCents, 0), 0);
  assert.equal(afterVoid.reduce((sum, period) => sum + period.balanceCents, 0), 16000);
  assert.equal(await page.evaluate(() => window.__fixture.sources.payments.length), 1);
  assert.equal(await page.evaluate(() => window.__fixture.sources.payments[0].voidReason), "Erreur de saisie de démonstration");
  await overflow();
  record("void-keeps-audit-history-and-restores-balances", 390);

  await page.setViewport({ width: 1440, height: 1000 });
  await page.screenshot({ path: resolve(output, "voided-payment-1440.png"), fullPage: true });
  await go("load-error"); await waitText("Chargement de démonstration indisponible.");
  assert.equal((await visiblePeriods()).length, 0);
  await page.evaluate(() => { window.__fixture.failLoad = false; });
  await click("Réessayer le chargement");
  await waitText("Cumul par producteur");
  assert.equal((await visiblePeriods()).length, 3);
  await overflow();
  record("load-errors-can-be-retried-without-showing-stale-balances", 1440);

  const report = { passed: errors.length === 0 && blockedRequests.length === 0, widths, results, errors, blockedRequests };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  console.log(`Admin producer settlements audit passed: ${results.length} checks.`);
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true });
    console.error(await page.evaluate(() => ({
      alerts: [...document.querySelectorAll('[role="alert"]')].map(item => item.textContent),
      fields: [...document.querySelectorAll("input,select")].map(input => ({ value: input.value, valid: input.validity.valid, validationMessage: input.validationMessage })),
      requests: window.__fixture.requests,
    })));
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
