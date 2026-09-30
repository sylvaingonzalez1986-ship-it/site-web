/** Real invoice form and order dialog, with synthetic APIs and no live customer data. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/admin-invoice-message");
const port = 3259;
const widths = [320, 390, 1440];
const initialMessage = "Merci Élodie pour ta fidélité !\nÀ bientôt, Sylvain";
const modules = {
  "invoice-message-entry.tsx": `
import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import AdminLayout from '/src/app/admin/layout';
import {AdminOrderDetailModal} from '/src/components/admin/AdminOrderDetailModal';
const query=new URLSearchParams(location.search);
window.__fixture={messages:{'DEMO-A':${JSON.stringify(initialMessage)},'DEMO-B':'Un autre client, un autre message.'},requests:[],downloads:[],pending:[],delayGet:query.has('delay'),failGet:query.has('error'),postMode:'pdf'};
window.__releaseGet=(id,message)=>{
 const state=window.__fixture;
 const pending=state.pending.filter(item=>item.id===id);
 state.pending=state.pending.filter(item=>item.id!==id);
 pending.forEach(item=>item.resolve(Response.json({personalMessage:message??state.messages[id]??''})));
};
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
 const state=window.__fixture,method=init.method||'GET';
 state.requests.push({path:url.pathname,method,body:init.body?JSON.parse(init.body):null});
 const match=url.pathname.match(new RegExp('^/api/admin/orders/([^/]+)/invoice(/message)?$'));
 if(!match)return Response.json({error:'Unexpected fixture API'},{status:503});
 const id=decodeURIComponent(match[1]);
 if(method==='GET'&&match[2]){
  if(state.failGet)return Response.json({error:'Le message de démonstration ne peut pas être chargé.'},{status:503});
  if(state.delayGet)return new Promise(resolve=>state.pending.push({id,resolve}));
  return Response.json({personalMessage:state.messages[id]??''});
 }
 if(method==='POST'&&!match[2]){
  if(state.postMode==='error')return Response.json({error:'Échec de démonstration, réessaie.'},{status:503});
  if(state.postMode==='html')return new Response('<html>Connexion</html>',{headers:{'Content-Type':'text/html'}});
  if(state.postMode==='invalid')return new Response('PDF invalide',{headers:{'Content-Type':'application/pdf'}});
  state.messages[id]=JSON.parse(init.body).personalMessage;
  return new Response('%PDF-1.7\\n'+('synthetic-data-only '.repeat(20)),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="facture-2026-000001.pdf"'}});
 }
 return Response.json({error:'Unexpected fixture API method'},{status:503});
};
const nativeAnchorClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download){window.__fixture.downloads.push({filename:this.download,url:this.href});return;}return nativeAnchorClick.call(this);};
function Fixture(){
 const [id,setId]=useState('DEMO-A'),[open,setOpen]=useState(true);
 useEffect(()=>{window.__setOrder=setId;window.__open=()=>setOpen(true);},[]);
 const unpaid=id==='UNPAID';
 const order={id,createdAt:'2026-09-30T10:00:00Z',status:unpaid?'pending_payment':'paid',paymentState:unpaid?'pending':'paid',paymentProvider:'viva',source:'web',customerName:'Élodie Exemple',customerEmail:'client@example.test',shippingAddress:'12 rue de la Démonstration',shippingCity:'Rennes',shippingPostalCode:'35000',shippingCountry:'FR',deliveryMethod:'home',deliveryFee:0,itemsCount:1,totalHt:20,totalVat:4,vatBreakdown:[{rate:20,baseHt:20,vatAmount:4}],totalAmount:24,items:[{productId:'demo-product',name:'Fleur de démonstration',unitPrice:24,quantity:1,lineTotal:24,vatRate:20,unitPriceHt:20,lineTotalHt:20,lineVatAmount:4}]};
 return React.createElement(AdminLayout,null,React.createElement(AdminOrderDetailModal,{order:open?order:null,onClose:()=>setOpen(false)}));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`,
};

const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, "public"),
  cacheDir: resolve(output, "vite-cache"),
  esbuild: { jsx: "automatic" },
  optimizeDeps: { include: ["react", "react-dom/client"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "admin-invoice-message-fixture", enforce: "pre",
    resolveId(id) { if (id in modules) return "\0" + id; },
    load(id) { if (id.startsWith("\0")) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facture · Démonstration locale</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__invoice-message-entry.tsx"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: { ignored: ["**/output/**", "**/.next/**"] } },
});

let browser;
const errors = [], results = [], blockedRequests = [];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || (url.hostname === "127.0.0.1" && url.port === String(port) && !url.pathname.startsWith("/api/"))) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  const input = "#invoice-personal-message";
  const submit = 'form[aria-label="Préparer la facture"] button[type="submit"]';
  const go = async (query = "") => {
    await page.goto(`http://127.0.0.1:${port}/${query}`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector(input);
    await page.$eval(input, (element) => element.scrollIntoView({ block: "center" }));
  };
  const ready = () => page.waitForFunction((selector) => !document.querySelector(selector)?.disabled, {}, input);
  const setMessage = async (message) => {
    await page.click(input);
    await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type(input, message);
  };
  const clickSubmit = async () => { await page.click(submit); };
  const waitAlert = () => page.waitForSelector('form [role="alert"]');
  const record = (name, width) => { results.push({ name, width, passed: true }); console.log(`PASS ${name} ${width}`); };

  for (const width of widths) {
    await page.setViewport({ width, height: width < 768 ? 844 : 1000 });
    await go(); await ready();
    assert.equal(await page.$eval(input, (element) => element.value), initialMessage);
    const metrics = await page.evaluate((selector) => {
      const textarea = document.querySelector(selector), dialog = document.querySelector('[role="dialog"]');
      const button = document.querySelector('form button[type="submit"]');
      return { documentWidth: document.documentElement.scrollWidth, dialogWidth: dialog.clientWidth, dialogScrollWidth: dialog.scrollWidth, inputFont: parseFloat(getComputedStyle(textarea).fontSize), buttonHeight: button.getBoundingClientRect().height };
    }, input);
    assert(metrics.documentWidth <= width + 1);
    assert(metrics.dialogScrollWidth <= metrics.dialogWidth + 1);
    assert(metrics.inputFont >= 16);
    assert(metrics.buttonHeight >= 44);
    record("stored-message-and-mobile-layout", width);

    const personalMessage = "Merci Élodie pour cette belle commande !\nBonne dégustation et à bientôt,\nSylvain";
    await setMessage(personalMessage);
    assert.equal(await page.$eval("[data-invoice-message-preview] p:last-child", (element) => element.textContent), personalMessage);
    await page.$eval(input, (element) => element.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: resolve(output, `message-preview-${width}.png`) });
    await clickSubmit();
    await page.waitForFunction(() => window.__fixture.downloads.length === 1);
    const posted = await page.evaluate(() => window.__fixture.requests.filter((request) => request.method === "POST"));
    assert.deepEqual(posted.at(-1).body, { personalMessage });
    assert.equal(await page.evaluate(() => window.__fixture.downloads[0].filename), "facture-2026-000001.pdf");
    record("multiline-preview-and-exact-pdf-post", width);

    await setMessage(""); await clickSubmit();
    await page.waitForFunction(() => window.__fixture.downloads.length === 2);
    assert.equal(await page.evaluate(() => window.__fixture.requests.filter((request) => request.method === "POST").at(-1).body.personalMessage), "");
    assert.equal(await page.$("[data-invoice-message-preview]"), null);
    record("clear-existing-message", width);

    await setMessage("Mon texte reste disponible en cas d’échec.");
    await page.evaluate(() => { window.__fixture.postMode = "error"; });
    const beforeFailure = await page.evaluate(() => window.__fixture.requests.length);
    await clickSubmit(); await waitAlert();
    assert.equal(await page.$eval(input, (element) => element.value), "Mon texte reste disponible en cas d’échec.");
    assert.deepEqual(await page.evaluate((start) => window.__fixture.requests.slice(start).map((request) => request.method), beforeFailure), ["POST"]);
    assert.equal(await page.evaluate(() => window.__fixture.downloads.length), 2);
    record("failed-post-preserves-draft-without-get-fallback", width);
  }

  await page.setViewport({ width: 390, height: 844 });
  for (const mode of ["html", "invalid"]) {
    await go(); await ready();
    await setMessage("Un message conservé malgré une réponse invalide.");
    await page.evaluate((value) => { window.__fixture.postMode = value; }, mode);
    await clickSubmit(); await waitAlert();
    assert.equal(await page.$eval(input, (element) => element.value), "Un message conservé malgré une réponse invalide.");
    assert.equal(await page.evaluate(() => window.__fixture.downloads.length), 0);
    record(`reject-${mode}-response`, 390);
  }

  await go("?delay");
  assert(await page.$eval(input, (element) => element.disabled));
  assert(await page.$eval(submit, (element) => element.disabled));
  await page.evaluate(() => { window.__fixture.delayGet = false; window.__releaseGet("DEMO-A"); });
  await ready();
  assert.equal(await page.$eval(input, (element) => element.value), initialMessage);
  record("loading-blocks-editing-and-downloading", 390);

  await go("?error"); await waitAlert();
  assert(await page.$eval(input, (element) => element.disabled));
  assert(await page.$eval(submit, (element) => element.disabled));
  await page.evaluate(() => { window.__fixture.failGet = false; });
  await page.$$eval("form button", (buttons) => buttons.find((button) => button.textContent === "Réessayer").click());
  await ready();
  assert.equal(await page.$eval(input, (element) => element.value), initialMessage);
  record("loading-error-retry-restores-saved-message", 390);

  await setMessage("Brouillon qui appartient seulement à la commande A.");
  await page.evaluate(() => window.__setOrder("DEMO-B"));
  await page.waitForFunction((selector) => document.querySelector(selector)?.value === "Un autre client, un autre message.", {}, input);
  record("order-switch-resets-draft", 390);

  await go("?delay");
  await page.evaluate(() => { window.__fixture.delayGet = false; window.__setOrder("DEMO-B"); });
  await page.waitForFunction((selector) => document.querySelector(selector)?.value === "Un autre client, un autre message.", {}, input);
  await page.evaluate(() => window.__releaseGet("DEMO-A", "Ancienne réponse arrivée trop tard."));
  await page.waitForFunction(() => window.__fixture.pending.length === 0);
  assert.equal(await page.$eval(input, (element) => element.value), "Un autre client, un autre message.");
  record("stale-loading-response-does-not-leak-across-orders", 390);

  await setMessage(Array.from({ length: 21 }, (_, index) => `Ligne ${index + 1}`).join("\n"));
  await waitAlert();
  assert(await page.$eval(submit, (element) => element.disabled));
  assert.equal(await page.$eval(input, (element) => element.getAttribute("aria-invalid")), "true");
  record("twenty-line-validation", 390);

  const emojiMessage = "Merci 💚 pour ta commande 🌿";
  const requestsBeforeEmoji = await page.evaluate(() => window.__fixture.requests.length);
  await setMessage(emojiMessage);
  await waitAlert();
  assert(await page.$eval(submit, (element) => element.disabled));
  assert.equal(await page.$eval(input, (element) => element.value), emojiMessage);
  assert.equal(await page.$eval(input, (element) => element.getAttribute("aria-invalid")), "true");
  assert(await page.$eval("#invoice-message-validation", (element) => element.textContent.includes("emojis")));
  assert.equal(await page.evaluate(() => window.__fixture.requests.length), requestsBeforeEmoji);
  record("unsupported-emoji-blocked-with-draft-preserved", 390);

  await setMessage("é".repeat(1000));
  await page.waitForSelector("[data-invoice-message-preview]");
  assert.equal(await page.$eval(input, (element) => element.maxLength), 1000);
  assert(await page.$eval('[role="dialog"]', (element) => element.scrollWidth <= element.clientWidth + 1));
  record("long-word-preview-wraps-on-mobile", 390);

  await page.evaluate(() => window.__setOrder("UNPAID"));
  await page.waitForFunction(() => document.body.textContent.includes("Facture disponible uniquement"));
  assert.equal(await page.$(input), null);
  assert(await page.$eval(submit, (element) => element.disabled));
  assert.equal(await page.evaluate(() => window.__fixture.requests.some((request) => request.path.includes("UNPAID"))), false);
  record("unpaid-order-cannot-download", 390);

  const report = { passed: errors.length === 0 && blockedRequests.length === 0, widths, results, errors, blockedRequests };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  console.log(`Admin invoice message audit passed: ${results.length} checks.`);
} finally {
  await browser?.close();
  await server.close();
}
