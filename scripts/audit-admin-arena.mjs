/** Real admin UI with synthetic in-browser data. No live APIs or credentials. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/admin-arena");
const port = 3258;
const widths = [320, 390, 768, 1440];
const arenaOnly = process.argv.includes("--arena");
const modules = {
  "admin-arena-entry.tsx": `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import AdminLayout from '/src/app/admin/layout';
import AdminLoginPage from '/src/app/admin/login/page';
${arenaOnly ? "import {AdminContestPanel} from '/src/components/admin/AdminContestPanel';" : "import {AdminPanel} from '/src/components/admin/AdminPanel';\nimport {defaultStore} from '/src/data/default-store';"}
const store=${arenaOnly ? "{products:[],orders:[],blog:[]}" : "structuredClone(defaultStore)"};
store.products=store.products.slice(0,2);
store.blog=[{id:'demo-article',title:'Une nouvelle saison à la ferme',slug:'saison-demo',excerpt:'Un article de démonstration pour vérifier la mise en page.',content:'Le texte de démonstration.',coverImage:'/product_flower.jpg',category:'actualite',published:false,createdAt:'2026-09-28T10:00:00Z',updatedAt:'2026-09-28T10:00:00Z'}];
store.orders=['paid','processing'].map((status,index)=>({id:'DEMO-2026-000'+(index+1),createdAt:'2026-09-28T10:00:00Z',status,paymentProvider:'viva',paymentState:'paid',source:'web',customerId:'demo-customer',customerName:index?'Camille Dupré':'Alexandre Martin',customerEmail:'client'+index+'@example.test',shippingAddress:'12 rue de la Démonstration',shippingCity:'Rennes',shippingPostalCode:'35000',shippingCountry:'FR',deliveryMethod:'home',deliveryFee:0,itemsCount:1,totalHt:20,totalVat:4,vatBreakdown:[{rate:20,baseHt:20,vatAmount:4}],totalAmount:24,items:[{productId:'demo-product',name:'Fleur de démonstration',unitPrice:24,quantity:1,lineTotal:24,vatRate:20,unitPriceHt:20,lineTotalHt:20,lineVatAmount:4}]}));
const customers=[{id:'demo-customer',email:'client-au-nom-long@example.test',firstName:'Camille',lastName:'Martin-Duval',city:'Saint-Jacques-de-la-Lande',country:'France',createdAt:'2026-09-28T10:00:00Z',ordersCount:2,totalSpent:48,loyaltyPoints:120,contestBetaEnabled:false,currentBadge:{id:'bronze',label:'Graine de champion',unlocked:true}}];
const feedback=Array.from({length:32},(_,i)=>({id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),kind:i===31?'idea':'bug',subject:i===31?'Un banc pour le Quartier':'Bug de démonstration '+(i+1),message:'En ouvrant la carte du Quartier sur mon téléphone, la commande ne répond plus. Voici les étapes et le résultat attendu. <script>texte brut</script>',pagePath:'/arene',status:'new',reply:null,rewardPacks:0,rewardGrantedAt:null,createdAt:'2026-11-08T10:00:00Z',updatedAt:'2026-11-08T10:00:00Z',userId:'20000000-0000-4000-8000-000000000001',reviewedBy:null}));
window.__feedback=feedback;window.__feedbackPatches=[];window.__packGrants=0;window.__feedbackFailure='';window.__operationsMissing=false;
window.__apiCalls=[];window.__unhandledApi=[];window.__saved=0;
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
 const method=init.method||'GET';window.__apiCalls.push({path:url.pathname,method});
 if(url.pathname==='/api/admin/store'){
  if(method==='PUT'){Object.assign(store,JSON.parse(init.body));window.__saved++;}
  return Response.json(store);
 }
 if(url.pathname==='/api/admin/customers')return Response.json({customers});
 if(url.pathname==='/api/admin/arena/feedback'){
  if(window.__feedbackFailure==='unavailable')return Response.json({error:'Boîte temporairement indisponible.'},{status:503});
  if(window.__feedbackFailure==='expired')return Response.json({error:'Session expirée.'},{status:401});
  if(method==='PATCH'){
   const body=JSON.parse(init.body);window.__feedbackPatches.push(body);
   await new Promise(resolve=>setTimeout(resolve,150));
   if(window.__feedbackFailure==='conflict')return Response.json({error:'Ce message a été modifié. Actualise avant de reprendre.'},{status:409});
   const item=feedback.find(item=>item.id===body.id);
   const rewarded=Boolean(body.rewardPacks&&!item.rewardPacks);
   if(rewarded){window.__packGrants++;item.rewardPacks=body.rewardPacks;item.rewardGrantedAt='2026-11-08T11:00:00Z';}
   Object.assign(item,{status:body.status,reply:body.reply,updatedAt:'2026-11-08T11:00:00Z'});
   if(window.__feedbackFailure==='lost-response'){window.__feedbackFailure='';throw new TypeError('Réponse perdue, réessaie.');}
   return Response.json({item,rewardGranted:rewarded});
  }
  const list=feedback.filter(item=>(!url.searchParams.get('kind')||url.searchParams.get('kind')==='all'||item.kind===url.searchParams.get('kind'))&&(!url.searchParams.get('status')||url.searchParams.get('status')==='all'||item.status===url.searchParams.get('status')));
  const offset=Number(url.searchParams.get('offset')||0);
  return Response.json({items:list.slice(offset,offset+30),total:list.length,hasMore:list.length>offset+30});
 }
 if(url.pathname==='/api/admin/placard/bootstrap')return window.__operationsMissing?Response.json({error:'Pilotage indisponible.'},{status:503}):Response.json({seasonRewards:{rewardsLive:false,eligiblePlayers:12,pendingGrants:3,totalSupportBoosters:4,totalHeritageFragments:6},seasonRollover:{fromSeason:'2026-automne',toSeason:null,players:12,missingRewardGrants:3,lockedBattles:0,ready:false,blockers:['Récompenses en attente']},randomBattleQueue:{generatedAt:'2026-11-08T10:00:00Z',status:'watch',waitingCount:7,oldestQueuedAt:'2026-11-08T09:40:00Z',oldestWaitMinutes:20,waitingOver15Minutes:2,waitingOver60Minutes:0,qualityBands:{artisanale:1,bellePousse:2,concours:3,exceptionnelle:1,legendaire:0,unknown:0},truncated:false}});
 if(url.pathname==='/api/admin/placard/bot-battles')return window.__operationsMissing?Response.json({error:'Suivi indisponible.'},{status:503}):Response.json({dayKey:'2026-11-08',dailyLimit:10,battlesToday:13,activePlayersToday:4,playersAtLimit:1,experienceAwardedToday:26,totalArenaExperience:120,players:[],recent:[]});
 if(url.pathname==='/api/admin/arena/customer-rewards')return window.__operationsMissing?Response.json({error:'Pot indisponible.'},{status:503}):Response.json({seasonCode:'2026-automne',status:'active',poolGrams:28.5,wholePoolGrams:28,currentWeekGrams:8,contributionRateBps:200,weeklyDice:{rollCount:7,average:3,rateBps:200},eligiblePlayers:9,minimumHumanBattles:3,topRewards:[],surpriseReward:{estimatedGrams:3,eligiblePlayers:4}});
 if(url.pathname==='/api/admin/contest/seasons')return Response.json({seasons:[]});
 if(url.pathname==='/api/admin/contest/entries')return Response.json({entries:[],pagination:{total:0,limit:200,offset:0,hasMore:false}});
 if(url.pathname==='/api/admin/contest/reviews')return Response.json({reviews:[],pagination:{total:0,limit:200,offset:0,hasMore:false}});
 if(url.pathname.startsWith('/api/admin/orders/')&&url.pathname.endsWith('/invoice/message'))return Response.json({personalMessage:''});
 if(url.pathname==='/api/admin/login'){
  const body=JSON.parse(init.body);
  return body.totp?Response.json({error:'Code de démonstration refusé.'},{status:401}):Response.json({requireTotp:true},{status:401});
 }
 window.__unhandledApi.push(url.pathname);return Response.json({error:'API absente de la démonstration.'},{status:503});
};
const isLogin=new URLSearchParams(location.search).has('login');
const content=${arenaOnly ? "React.createElement(AdminContestPanel,{products:[],producers:[]})" : "isLogin?await AdminLoginPage({searchParams:Promise.resolve({next:'/admin'})}):React.createElement(AdminPanel)"};
createRoot(document.getElementById('root')).render(React.createElement(AdminLayout,null,${arenaOnly ? "React.createElement('div',{className:'mx-auto max-w-7xl p-4 md:p-8'},content)" : "content"}));
`,
  "navigation-stub": `export const NavigationPending=()=>null;export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  "next/link": `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  "next/image": `import React from 'react';export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  "next/dynamic": `import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props));}`,
};
const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, "public"),
  cacheDir: resolve(output, "vite-cache"),
  define: { "process.env.NEXT_PUBLIC_CONTEST_FEATURE_ENABLED": '"true"' },
  esbuild: { jsx: "automatic" },
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react"], ...(arenaOnly ? { noDiscovery: true, entries: [] } : {}) },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "admin-arena-fixture", enforce: "pre",
    resolveId(id) {
      if (id.endsWith("/navigation/NavigationFeedback")) return "\0navigation-stub";
      if (id.endsWith("/navigation/NavigationLink")) return "\0next/link";
      if (id in modules) return "\0" + id;
    },
    load(id) { if (id.startsWith("\0")) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Administration · Démonstration locale</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}</style><div id="root"></div><script type="module" src="/@id/__x00__admin-arena-entry.tsx"></script></html>`);
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
  console.log(`Admin ${arenaOnly ? "arena" : "full"} fixture listening on ${port}`);
  if (process.argv.includes("--serve")) {
    console.log(`Admin preview with synthetic data: http://127.0.0.1:${port}`);
    await new Promise(() => {});
  }
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  console.log("Admin audit browser ready");
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000);
  page.on("pageerror", (error) => { errors.push(error.message); console.error("Browser:", error.message); });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || (url.hostname === "127.0.0.1" && url.port === String(port) && !url.pathname.startsWith("/api/"))) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  const go = async (query = "") => {
    console.log(`Opening admin fixture ${query || "/"}`);
    await page.goto(`http://127.0.0.1:${port}/${query}`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
  };
  const waitText = (text) => page.waitForFunction((value) => document.body.textContent.includes(value), {}, text);
  const clickText = (text) => page.$$eval("button", (buttons, value) => {
    const button = buttons.find((item) => item.textContent.trim() === value);
    if (!button) throw new Error("Missing button: " + value);
    button.click();
  }, text);
  const checkPage = async (section, width, expectSave = false) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const metrics = await page.evaluate((arenaOnly) => {
      const isVisible = (element) => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
      const save = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Sauvegarder");
      const nav = arenaOnly ? document.querySelector('nav[aria-label="Gestion de l’Arène"]') : innerWidth < 1024 ? document.querySelector("#admin-section") : document.querySelector('nav[aria-label]');
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, navigationVisible: nav ? isVisible(nav) : null, saveVisible: save ? isVisible(save) : null, saveHeight: save?.getBoundingClientRect().height ?? null,
        overflowing: [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== "fixed"; }).slice(0, 10).map((el) => ({ tag: el.tagName, class: el.className, text: el.textContent.slice(0, 60) })) };
    }, arenaOnly);
    const passed = metrics.scrollWidth <= width + 1 && (section === "login" || metrics.navigationVisible) && (!expectSave || (metrics.saveVisible && metrics.saveHeight >= 44));
    results.push({ section, width, passed, ...metrics });
    await page.screenshot({ path: resolve(output, `${section}-${width}.png`), fullPage: false });
    console.log(`${passed ? "PASS" : "FAIL"} ${section} ${width}: scroll=${metrics.scrollWidth} save=${metrics.saveVisible}`);
  };
  const tabs = [
    ["produits", "Mes Produits", "Mes produits"], ["clients", "Clients (1)", "Clients"], ["blog", "Blog (1)", "Blog"], ["textes", "Accueil", "Textes & visuels"],
  ];
  const checkScrolledControls = async (section, width, selector) => {
    await page.$eval(selector, (element) => { element.scrollIntoView({ block: "start" }); window.scrollBy(0, -90); });
    const controlsVisible = await page.evaluate(() => {
      const visible = (element) => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight; };
      const save = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Sauvegarder");
      const navigation = innerWidth < 1024 ? document.querySelector("#admin-section") : document.querySelector('nav button[aria-current="page"]');
      return visible(save) && visible(navigation);
    });
    results.push({ section: `${section}-scrolled`, width, passed: controlsVisible });
    await page.screenshot({ path: resolve(output, `${section}-scrolled-${width}.png`) });
  };
  for (const width of widths) {
    await page.setViewport({ width, height: width < 768 ? 844 : 1000 });
    await go(); if (!arenaOnly) await waitText("Données chargées.");
    if (!arenaOnly) {
    await checkPage("commandes", width, true);
    await checkScrolledControls("commandes", width, "#admin-content article");
    await clickText("Voir le détail");
    await page.waitForSelector('[role="dialog"]');
    const dialogValid = await page.$eval('[role="dialog"]', (dialog) => {
      const rect = dialog.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && dialog.contains(document.activeElement) && document.documentElement.scrollWidth <= innerWidth + 1;
    });
    results.push({ section: "commande-detail", width, passed: dialogValid });
    await page.screenshot({ path: resolve(output, `commande-detail-${width}.png`) });
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"]', { hidden: true });
    for (const [tab, marker, label] of tabs) {
      if (width < 1024) await page.select("#admin-section", tab);
      else await page.$$eval("nav button", (buttons, label) => buttons.find((button) => button.textContent.trim() === label).click(), label);
      await waitText(marker);
      await page.waitForNetworkIdle();
      await checkPage(tab, width, tab !== "clients");
      if (tab === "produits") await checkScrolledControls(tab, width, "#admin-content article:last-child");
      if (tab === "textes") {
        await clickText("Sauvegarder"); await waitText("Sauvegarde effectuée.");
        assert.equal(await page.evaluate(() => window.__saved), 1);
      }
    }
    }
    if (!arenaOnly) {
      if (width < 1024) await page.select("#admin-section", "concours");
      else await page.$$eval("nav button", (buttons) => buttons.find((button) => button.textContent.trim() === "L’Arène").click());
    }
    await waitText("32 message(s) correspondant aux filtres");
    assert.equal(await page.evaluate(() => window.__apiCalls.filter(call => call.path.startsWith('/api/admin/contest/')).length), 0, 'Legacy contest loads only when opened');
    await checkPage("arena-inbox", width);
    await page.select("#admin-feedback-kind", "idea");
    await waitText("1 message(s) correspondant aux filtres");
    await waitText("Un banc pour le Quartier");
    await page.select("#admin-feedback-kind", "bug");
    await waitText("31 message(s) correspondant aux filtres");
    await clickText("Suivants"); await waitText("Page 2");
    await waitText("Bug de démonstration 31");
    await clickText("Précédents"); await waitText("Page 1");
    await page.click('#admin-arena-feedback button[aria-controls="admin-feedback-review"]');
    await page.waitForSelector('[id^="feedback-status-"]');
    assert.equal(await page.$eval('[id^="feedback-packs-"]', el => el.disabled), true);
    await page.select('[id^="feedback-status-"]', "reviewing");
    await page.type('textarea[id^="feedback-reply-"]', "Merci, nous avons reproduit le problème.");
    await page.select('[id^="feedback-packs-"]', "2");
    await clickText("Vérifier la récompense"); await waitText("Confirmer la récompense");
    assert.equal(await page.evaluate(() => window.__feedbackPatches.length), 0);
    assert(await page.$eval('[role="group"][aria-labelledby^="feedback-confirm-"]', el => el === document.activeElement && el.textContent.includes('20000000-0000-4000-8000-000000000001') && el.textContent.includes('20 cartes')));
    await page.screenshot({path:resolve(output,`arena-confirmation-${width}.png`)});
    await clickText("Revenir au suivi");
    await clickText("Vérifier la récompense");
    await page.$$eval('button',buttons=>{const button=buttons.find(el=>el.textContent==='Confirmer l’envoi de 2 pack(s)');button.click();button.click();});
    await waitText("2 pack(s) déjà offert(s)");
    assert.equal(await page.evaluate(() => window.__feedbackPatches.length), 1);
    assert.equal(await page.evaluate(() => window.__packGrants), 1);
    assert.equal(await page.$('[id^="feedback-packs-"]'), null);
    assert.equal(await page.evaluate(() => window.__feedbackPatches[0].expectedUpdatedAt), '2026-11-08T10:00:00Z');
    await checkPage("arena-reviewed", width);
    await clickText("Pilotage du jeu"); await waitText("Duels en attente");
    await waitText("28,5");
    await checkPage("arena-operations", width);
    assert.equal(await page.evaluate(() => document.querySelector('#admin-arena-operations details').open), false);
    assert.equal(await page.evaluate(() => window.__apiCalls.filter(call=>/catalog|launch|artwork|mobile-review/.test(call.path)).length), 0, 'Maintenance editors do not load by default');
    await clickText("Concours & avis"); await waitText("Lots premium");
    assert.equal(await page.evaluate(() => window.__apiCalls.filter(call => call.path.startsWith('/api/admin/contest/')).length), 3);
    await checkPage("arena-contest", width);
    await clickText("Boîte aux lettres"); await waitText("2 pack(s) déjà offert(s)");
    results.push({section:"arena-workflow",width,passed:true,checks:["kind-filter","pagination","keyboard-focus","reward-review-required","explicit-confirmation","double-click-guard","recipient-and-card-count","reward-receipt","draft-preserved-between-sections","lazy-maintenance","legacy-contest-preserved"]});
    assert.deepEqual(await page.evaluate(() => window.__unhandledApi), []);
    if (!arenaOnly) {
    await go("?login"); await page.waitForSelector("#admin-password");
    await checkPage("login", width);
    assert.equal(await page.$eval("#admin-password", (input) => input.autocomplete), "current-password");
    assert(await page.$eval("#admin-password", (input) => input.getBoundingClientRect().height >= 44));
    }
  }
  await page.setViewport({width:390,height:844});
  await go(); if (!arenaOnly) { await waitText("Données chargées."); await page.select("#admin-section","concours"); }
  await waitText("32 message(s) correspondant aux filtres");
  await page.click('#admin-arena-feedback button[aria-controls="admin-feedback-review"]');
  await page.select('[id^="feedback-status-"]',"reviewing");
  await page.type('textarea[id^="feedback-reply-"]',"Réponse préservée après un conflit.");
  await page.evaluate(()=>{window.__feedbackFailure='conflict';});
  await clickText("Enregistrer le suivi"); await waitText("Ce message a été modifié.");
  assert.equal(await page.$eval('textarea[id^="feedback-reply-"]',el=>el.value),"Réponse préservée après un conflit.");
  await page.evaluate(()=>{window.__feedbackFailure='lost-response';});
  await page.select('[id^="feedback-packs-"]',"1"); await clickText("Vérifier la récompense");
  await clickText("Confirmer l’envoi de 1 pack(s)"); await waitText("Réponse perdue, réessaie.");
  await clickText("Confirmer l’envoi de 1 pack(s)"); await waitText("1 pack(s) déjà offert(s)");
  assert.equal(await page.evaluate(()=>window.__packGrants),1,'Retry after a lost response must not award twice');
  await page.evaluate(()=>{window.__feedbackFailure='unavailable';});
  await clickText("Actualiser les messages"); await waitText("Boîte temporairement indisponible.");
  assert(await page.$('#admin-arena-feedback [role="alert"]'));
  await page.evaluate(()=>{window.__feedbackFailure='expired';});
  await clickText("Actualiser les messages"); await waitText("Session admin expirée.");
  await page.evaluate(()=>{window.__operationsMissing=true;});
  await clickText("Pilotage du jeu"); await waitText("Pilotage indisponible.");
  assert(await page.$eval('#admin-arena-operations',el=>el.textContent.includes('Suivi des entraînements indisponible.')&&!el.textContent.includes('Aucun entraînement joué aujourd’hui.')&&el.textContent.includes('— g')));
  await page.screenshot({path:resolve(output,'arena-unavailable-390.png')});
  results.push({section:"arena-errors",width:390,passed:true,checks:["conflict-preserves-reply","lost-reward-response-retry","no-double-award","read-failure","expired-session","missing-metrics-are-not-zero"]});
  if (!arenaOnly) {
  await page.setViewport({ width: 390, height: 844 });
  await go("?login"); await page.waitForSelector("#admin-password");
  await page.type("#admin-password", "demo-password-only");
  await page.click('button[aria-controls="admin-password"]');
  assert.equal(await page.$eval("#admin-password", (input) => input.type), "text");
  await page.click('button[type="submit"]'); await page.waitForSelector("#admin-totp");
  assert.equal(await page.evaluate(() => document.activeElement.id), "admin-totp");
  await page.type("#admin-totp", "123456"); await page.click('button[type="submit"]');
  await waitText("Code de démonstration refusé.");
  assert(await page.$('[role="alert"]'));
  await page.screenshot({ path: resolve(output, "login-totp-390.png"), fullPage: true });
  }
  const report = { passed: results.every((result) => result.passed) && errors.length === 0, mode:arenaOnly?"arena":"all", widths, results, errors, blockedRequests, checks: ["real-admin-layout-and-components", "synthetic-data-only", "mobile-section-selector", "no-document-overflow", "mailbox-review-and-reward", "operations-and-legacy-contest", ...(arenaOnly?[]:["visible-navigation-and-save", "sticky-controls-after-scroll", "order-dialog-focus-and-escape", "mock-save", "login-password-toggle", "totp-focus-and-errors"])] };
  await writeFile(resolve(output, arenaOnly?"arena-report.json":"report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert(report.passed, "Admin layout checks failed; see output/admin-arena/report.json.");
  console.log("Admin arena audit passed.");
} finally {
  await browser?.close();
  await server.close();
}
