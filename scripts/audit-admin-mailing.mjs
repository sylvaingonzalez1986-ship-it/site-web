/** Real mailing panel with synthetic contacts and API responses. No email or database access. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/admin-mailing");
const port = 3261;
const widths = [320, 390, 1440];
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import AdminLayout from '/src/app/admin/layout';
import {AdminMailingPanel} from '/src/components/admin/AdminMailingPanel';
const scenario=new URLSearchParams(location.search).get('scenario');
const contacts=[
 ...Array.from({length:7},(_,index)=>({email:'client'+index+'@example.test',firstName:index===0?'Élodie':'Client '+index,lastName:'Exemple',customer:true,subscribed:true,unsubscribed:false})),
 {email:'abonne@example.test',firstName:'',lastName:'',customer:false,subscribed:true,unsubscribed:false},
 {email:'sans-accord@example.test',firstName:'Non inscrit',lastName:'Exemple',customer:true,subscribed:false,unsubscribed:false},
 {email:'desinscrit@example.test',firstName:'Désinscrit',lastName:'Exemple',customer:true,subscribed:false,unsubscribed:true},
];
const restored=JSON.parse(sessionStorage.getItem('mailing-fixture')||'null');
window.__fixture={contacts,campaigns:restored?.campaigns||[],recipients:restored?.recipients||{},requests:[],testMessages:[],failLoad:scenario==='load-error',failSave:false,failTest:false,failProcess:false,holdProcess:false,releaseProcess:null};
const persist=()=>sessionStorage.setItem('mailing-fixture',JSON.stringify({campaigns:window.__fixture.campaigns,recipients:window.__fixture.recipients}));
const counts=(rows)=>rows.reduce((sum,row)=>({...sum,[row.status]:sum[row.status]+1}),{total:rows.length,pending:0,processing:0,sent:0,failed:0,skipped:0,uncertain:0});
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
 const state=window.__fixture,method=init.method||'GET',body=init.body?JSON.parse(init.body):null;
 state.requests.push({path:url.pathname,method,body});
 if(url.pathname==='/api/admin/mailing/test'&&method==='POST'){
  if(state.failTest)return Response.json({error:'Le serveur de test est indisponible.'},{status:503});
  state.testMessages.push(body);return Response.json({ok:true});
 }
 if(url.pathname==='/api/admin/mailing'){
  if(method==='GET'){
   if(state.failLoad)return Response.json({error:'La liste de démonstration est indisponible.'},{status:503});
   return Response.json({contacts:state.contacts,campaigns:state.campaigns,settings:{configured:scenario!=='smtp-missing',fromEmail:'boutique@example.test',fromName:'Les Chanvriers Bretons',replyTo:'bonjour@example.test',error:scenario==='smtp-missing'?'SMTP de démonstration manquant.':null}});
  }
  if(method==='POST'){
   if(state.failSave)return Response.json({error:'Le brouillon de démonstration ne peut pas être enregistré.'},{status:503});
   const existing=state.campaigns.find(item=>item.id===body.id);
   const campaign={...body,status:'draft',createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),startedAt:null,completedAt:null,counts:counts([])};
   state.campaigns=[campaign,...state.campaigns.filter(item=>item.id!==body.id)];persist();return Response.json({campaign});
  }
 }
 const match=url.pathname.match(new RegExp('^/api/admin/mailing/([^/]+)(/(start|process))?$'));
 if(match){
  const campaign=state.campaigns.find(item=>item.id===match[1]);
  if(!campaign)return Response.json({error:'Campagne de démonstration introuvable.'},{status:404});
  if(match[3]==='start'&&method==='POST'){
   if(body?.confirmed!==true)return Response.json({error:'Confirmation requise.'},{status:400});
   if(body.expectedUpdatedAt!==campaign.updatedAt)return Response.json({error:'Ce brouillon a changé. Rechargez la campagne.'},{status:409});
   if(campaign.status==='draft'){
    state.recipients[campaign.id]=campaign.recipientEmails.map((email,index)=>({id:campaign.id+'-'+index,email,firstName:state.contacts.find(item=>item.email===email)?.firstName||'',status:'pending',error:null,sentAt:null}));
    campaign.status='sending';campaign.startedAt=new Date().toISOString();campaign.counts=counts(state.recipients[campaign.id]);
   }
   persist();return Response.json({campaign});
  }
  if(match[3]==='process'&&method==='POST'){
   if(state.holdProcess)await new Promise(resolve=>{state.releaseProcess=resolve;});
   if(state.failProcess)return Response.json({error:'Connexion interrompue. Reprenez le lot.'},{status:503});
   const rows=state.recipients[campaign.id]||[];
   rows.filter(row=>row.status==='pending').slice(0,2).forEach(row=>{row.status='sent';row.sentAt=new Date().toISOString();});
   campaign.counts=counts(rows);
   if(campaign.counts.pending===0){campaign.status='completed';campaign.completedAt=new Date().toISOString();}
   persist();return Response.json({campaign,recipients:rows});
  }
  if(method==='GET')return Response.json({campaign,recipients:state.recipients[campaign.id]||[]});
 }
 return Response.json({error:'Unexpected fixture API: '+method+' '+url.pathname},{status:503});
};
createRoot(document.getElementById('root')).render(React.createElement(AdminLayout,null,React.createElement('main',{style:{maxWidth:1440,margin:'auto',padding:12}},React.createElement(AdminMailingPanel))));
`;

const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, "public"),
  cacheDir: resolve(output, "vite-cache"), esbuild: { jsx: "automatic" },
  optimizeDeps: { include: ["react", "react-dom/client", "lucide-react"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "admin-mailing-fixture", enforce: "pre",
    resolveId(id) { if (id === "mailing-entry.tsx") return "\0mailing-entry.tsx"; },
    load(id) { if (id === "\0mailing-entry.tsx") return entry; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mailing · Démonstration locale</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__mailing-entry.tsx"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});

let browser;
const errors = [], results = [], blockedRequests = [];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
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
  const click = async text => {
    await page.$$eval("button", (buttons, label) => {
      const button = buttons.find(item => item.textContent.trim() === label || item.getAttribute("aria-label") === label);
      if (!button) throw new Error("Button not found: " + label);
      if (button.disabled) throw new Error("Button disabled: " + label);
      button.click();
    }, text);
  };
  const fill = async (selector, value) => {
    await page.focus(selector);
    await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
    await page.keyboard.press("Backspace"); await page.type(selector, value);
  };
  const record = (name, width) => { results.push({ name, width, passed: true }); console.log(`PASS ${name} ${width}`); };
  const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "The document must fit the viewport");

  for (const width of widths) {
    await page.setViewport({ width, height: width < 768 ? 844 : 1000 });
    await go(); await waitText("Centre de mailing"); await overflow();
    await page.screenshot({ path: resolve(output, `mailing-${width}.png`), fullPage: true });
    record("responsive-mailing-centre", width);
  }

  await page.setViewport({ width: 390, height: 844 });
  await go();
  await page.waitForFunction(() => !document.querySelector("#mailing-name")?.disabled);
  await fill("#mailing-name", "Nouvelles d’octobre");
  await fill("#mailing-subject", "Bonjour {{prenom}}, voici nos nouvelles");
  const message = "Bonjour {{prenom}},\n\nVoici les nouvelles de la boutique.\n<img src=x onerror=alert('unsafe')>\nÀ bientôt, Sylvain";
  await fill("#mailing-body", message);
  await page.waitForFunction(() => document.querySelector('aside[aria-label="Aperçu du mail"]').textContent.includes("Bonjour Camille,"));
  assert.equal(await page.$$eval('aside[aria-label="Aperçu du mail"] img', items => items.length), 0);
  await overflow();
  record("plain-text-personalized-preview-is-escaped", 390);

  await click("Sélectionner les résultats");
  assert.equal(await page.$$eval('input[type="checkbox"]:checked', inputs => inputs.length), 8);
  assert(await page.$eval('input[aria-label="Sélectionner sans-accord@example.test"]', input => input.disabled));
  assert(await page.$eval('input[aria-label="Sélectionner desinscrit@example.test"]', input => input.disabled));
  await page.select("#mailing-kind", "information");
  await click("Sélectionner les résultats");
  assert.equal(await page.$$eval('input[type="checkbox"]:checked', inputs => inputs.length), 8);
  assert(await page.$eval('input[aria-label="Sélectionner abonne@example.test"]', input => input.disabled));
  assert(await page.$eval('input[aria-label="Sélectionner desinscrit@example.test"]', input => input.disabled));
  await page.select("#mailing-kind", "marketing");
  await click("Sélectionner les résultats");
  record("audience-eligibility-and-unsubscribe-exclusions", 390);

  await fill("#mailing-search", "Élodie");
  assert.equal(await page.$$eval('input[type="checkbox"]', inputs => inputs.length), 1);
  await fill("#mailing-search", "");
  await page.select("#mailing-group", "subscribers");
  assert.equal(await page.$$eval('input[type="checkbox"]', inputs => inputs.length), 8);
  await page.select("#mailing-group", "all");
  record("search-and-contact-group-filters", 390);

  await fill("#mailing-test", "admin@example.test");
  await page.evaluate(() => { window.__fixture.failTest = true; });
  await click("Envoyer le test"); await waitText("Le serveur de test est indisponible.");
  assert.equal(await page.$eval("#mailing-body", input => input.value), message);
  await page.evaluate(() => { window.__fixture.failTest = false; });
  await click("Envoyer le test"); await waitText("Un e-mail de test a été envoyé");
  assert.deepEqual(await page.evaluate(() => window.__fixture.testMessages), [{ subject: "Bonjour {{prenom}}, voici nos nouvelles", body: message, email: "admin@example.test" }]);
  assert.equal(await page.evaluate(() => window.__fixture.requests.some(item => /\/(start|process)$/.test(item.path))), false);
  record("test-message-failure-recovery-without-campaign-send", 390);

  await page.evaluate(() => { window.__fixture.failSave = true; });
  await click("Enregistrer le brouillon"); await waitText("Le brouillon de démonstration ne peut pas être enregistré.");
  const failedDraft = await page.evaluate(() => window.__fixture.requests.find(item => item.method === "POST" && item.path === "/api/admin/mailing").body);
  assert.equal(await page.$eval("#mailing-body", input => input.value), message);
  await page.evaluate(() => { window.__fixture.failSave = false; });
  await click("Enregistrer le brouillon"); await waitText("Brouillon enregistré.");
  const savedDraft = await page.evaluate(() => window.__fixture.campaigns[0]);
  assert.equal(savedDraft.id, failedDraft.id);
  assert.equal(savedDraft.recipientEmails.length, 8);
  assert.equal(savedDraft.body, message);
  assert.equal(savedDraft.status, "draft");
  assert.equal(await page.evaluate(() => window.__fixture.requests.some(item => /\/(start|process)$/.test(item.path))), false);
  record("draft-save-retry-keeps-stable-id-and-never-sends", 390);

  await page.reload({ waitUntil: "networkidle0" });
  await page.$$eval('section[aria-labelledby="mailing-history-title"] button', buttons => buttons[0].click());
  await page.waitForFunction(value => document.querySelector("#mailing-body")?.value === value, {}, message);
  assert.equal(await page.evaluate(() => window.__fixture.requests.some(item => /\/(start|process)$/.test(item.path))), false);
  record("saved-draft-restores-from-history-after-reload", 390);

  await click("Vérifier l’envoi"); await waitText("Confirmer l’envoi groupé");
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-labelledby")), "mailing-confirm-title");
  assert(await page.$eval("#mailing-body", input => input.disabled));
  await click("Revenir au brouillon");
  assert.equal(await page.$eval("#mailing-body", input => input.disabled), false);
  assert.equal(await page.evaluate(() => window.__fixture.requests.some(item => /\/(start|process)$/.test(item.path))), false);
  await click("Vérifier l’envoi"); await waitText("Confirmer l’envoi groupé");
  await page.screenshot({ path: resolve(output, "review-390.png"), fullPage: true });
  record("review-is-focused-and-send-needs-explicit-confirmation", 390);

  await page.evaluate(() => { window.__fixture.campaigns[0].updatedAt = "2026-10-02T23:59:00.000Z"; });
  await click("Confirmer et envoyer"); await waitText("Ce brouillon a changé. Rechargez la campagne.");
  assert.equal(await page.evaluate(() => window.__fixture.requests.some(item => item.path.endsWith("/process"))), false);
  await click("Revenir au brouillon");
  await click("Vérifier l’envoi"); await waitText("Confirmer l’envoi groupé");
  const startsBeforeConfirmation = await page.evaluate(() => window.__fixture.requests.filter(item => item.path.endsWith("/start")).length);
  record("stale-review-is-rejected-before-any-message", 390);

  await page.evaluate(() => { window.__fixture.holdProcess = true; });
  await page.$$eval("button", buttons => {
    const button = buttons.find(item => item.textContent.trim() === "Confirmer et envoyer");
    button.click(); button.click();
  });
  await page.waitForFunction(() => Boolean(window.__fixture.releaseProcess));
  assert.equal(await page.evaluate(() => window.__fixture.requests.filter(item => item.path.endsWith("/start")).length), startsBeforeConfirmation + 1);
  assert.deepEqual(await page.evaluate(() => window.__fixture.requests.filter(item => item.path.endsWith("/start")).at(-1).body), {
    confirmed: true,
    expectedUpdatedAt: await page.evaluate(() => window.__fixture.campaigns[0].updatedAt),
  });
  await click("Mettre en pause");
  await page.evaluate(() => { window.__fixture.holdProcess = false; window.__fixture.releaseProcess(); });
  await waitText("Envoi en pause.");
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1500)));
  assert.equal(await page.evaluate(() => window.__fixture.requests.filter(item => item.path.endsWith("/process")).length), 1);
  assert.equal(await page.evaluate(() => window.__fixture.campaigns[0].counts.sent), 2);
  await overflow();
  await page.screenshot({ path: resolve(output, "paused-390.png"), fullPage: true });
  record("duplicate-confirmation-starts-once-and-pause-stops-next-batch", 390);

  await page.reload({ waitUntil: "networkidle0" });
  await page.$$eval('section[aria-labelledby="mailing-history-title"] button', buttons => buttons[0].click());
  await waitText("Reprendre l’envoi");
  assert.equal(await page.evaluate(() => window.__fixture.requests.some(item => item.path.endsWith("/process"))), false);
  assert.equal(await page.evaluate(() => window.__fixture.campaigns[0].counts.sent), 2);
  await page.evaluate(() => { window.__fixture.failProcess = true; });
  await click("Reprendre l’envoi"); await waitText("Connexion interrompue. Reprenez le lot.");
  assert.equal(await page.evaluate(() => window.__fixture.campaigns[0].counts.sent), 2);
  await page.evaluate(() => { window.__fixture.failProcess = false; });
  await click("Reprendre l’envoi"); await waitText("Campagne terminée.");
  assert.equal(await page.evaluate(() => window.__fixture.campaigns[0].counts.sent), 8);
  assert.equal(await page.evaluate(() => window.__fixture.campaigns[0].counts.pending), 0);
  assert.equal(await page.evaluate(() => window.__fixture.requests.some(item => item.path.endsWith("/start"))), false);
  await overflow();
  record("reload-requires-manual-resume-and-process-errors-preserve-progress", 390);

  await page.setViewport({ width: 1440, height: 1000 });
  await page.screenshot({ path: resolve(output, "completed-1440.png"), fullPage: true });
  await go("smtp-missing"); await waitText("Envoi indisponible");
  assert(await page.$$eval("button", buttons => buttons.find(item => item.textContent.trim() === "Envoyer le test").disabled));
  assert(await page.$$eval("button", buttons => buttons.find(item => item.textContent.trim() === "Vérifier l’envoi").disabled));
  assert.equal(await page.$$eval("button", buttons => buttons.find(item => item.textContent.trim() === "Enregistrer le brouillon").disabled), false);
  record("missing-smtp-disables-sending-but-preserves-drafts", 1440);

  await go("load-error"); await waitText("La liste de démonstration est indisponible.");
  assert(await page.$$eval("button", buttons => buttons.find(item => item.textContent.trim() === "Enregistrer le brouillon").disabled));
  await page.evaluate(() => { window.__fixture.failLoad = false; });
  await click("Actualiser"); await waitText("Données actualisées."); await overflow();
  assert.equal(await page.$$eval("button", buttons => buttons.find(item => item.textContent.trim() === "Enregistrer le brouillon").disabled), false);
  record("load-failure-recovery-restores-contacts-and-history", 1440);

  const report = { passed: errors.length === 0 && blockedRequests.length === 0, widths, results, errors, blockedRequests };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  console.log(`Admin mailing audit passed: ${results.length} checks.`);
} finally {
  await browser?.close();
  await server.close();
}
