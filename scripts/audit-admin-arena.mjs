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
const modules = {
  "admin-arena-entry.tsx": `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import AdminLayout from '/src/app/admin/layout';
import AdminLoginPage from '/src/app/admin/login/page';
import {AdminPanel} from '/src/components/admin/AdminPanel';
import {defaultStore} from '/src/data/default-store';
const store=structuredClone(defaultStore);
store.products=store.products.slice(0,2);
store.blog=[{id:'demo-article',title:'Une nouvelle saison à la ferme',slug:'saison-demo',excerpt:'Un article de démonstration pour vérifier la mise en page.',content:'Le texte de démonstration.',coverImage:'/product_flower.jpg',category:'actualite',published:false,createdAt:'2026-09-28T10:00:00Z',updatedAt:'2026-09-28T10:00:00Z'}];
store.orders=['paid','processing'].map((status,index)=>({id:'DEMO-2026-000'+(index+1),createdAt:'2026-09-28T10:00:00Z',status,paymentProvider:'viva',paymentState:'paid',source:'web',customerId:'demo-customer',customerName:index?'Camille Dupré':'Alexandre Martin',customerEmail:'client'+index+'@example.test',shippingAddress:'12 rue de la Démonstration',shippingCity:'Rennes',shippingPostalCode:'35000',shippingCountry:'FR',deliveryMethod:'home',deliveryFee:0,itemsCount:1,totalHt:20,totalVat:4,vatBreakdown:[{rate:20,baseHt:20,vatAmount:4}],totalAmount:24,items:[{productId:'demo-product',name:'Fleur de démonstration',unitPrice:24,quantity:1,lineTotal:24,vatRate:20,unitPriceHt:20,lineTotalHt:20,lineVatAmount:4}]}));
const customers=[{id:'demo-customer',email:'client-au-nom-long@example.test',firstName:'Camille',lastName:'Martin-Duval',city:'Saint-Jacques-de-la-Lande',country:'France',createdAt:'2026-09-28T10:00:00Z',ordersCount:2,totalSpent:48,loyaltyPoints:120,contestBetaEnabled:false,currentBadge:{id:'bronze',label:'Graine de champion',unlocked:true}}];
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
 if(url.pathname.startsWith('/api/admin/orders/')&&url.pathname.endsWith('/invoice/message'))return Response.json({personalMessage:''});
 if(url.pathname==='/api/admin/login'){
  const body=JSON.parse(init.body);
  return body.totp?Response.json({error:'Code de démonstration refusé.'},{status:401}):Response.json({requireTotp:true},{status:401});
 }
 window.__unhandledApi.push(url.pathname);return Response.json({error:'API absente de la démonstration.'},{status:503});
};
const isLogin=new URLSearchParams(location.search).has('login');
const content=isLogin?await AdminLoginPage({searchParams:Promise.resolve({next:'/admin'})}):React.createElement(AdminPanel);
createRoot(document.getElementById('root')).render(React.createElement(AdminLayout,null,content));
`,
  "navigation-stub": `export const NavigationPending=()=>null;export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  "next/link": `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}`,
  "next/image": `import React from 'react';export default function Image({src,fill,priority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}`,
  "next/dynamic": `import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props));}`,
};
const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, "public"),
  cacheDir: resolve(output, "vite-cache"),
  define: { "process.env.NEXT_PUBLIC_CONTEST_FEATURE_ENABLED": '"false"' },
  esbuild: { jsx: "automatic" },
  optimizeDeps: { include: ["react", "react-dom/client", "lucide-react"] },
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
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: { ignored: ["**/output/**", "**/.next/**"] } },
});

let browser;
const errors = [], results = [], blockedRequests = [];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  if (process.argv.includes("--serve")) {
    console.log(`Admin preview with synthetic data: http://127.0.0.1:${port}`);
    await new Promise(() => {});
  }
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || (url.hostname === "127.0.0.1" && url.port === String(port) && !url.pathname.startsWith("/api/"))) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  const go = async (query = "") => {
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
    const metrics = await page.evaluate(() => {
      const isVisible = (element) => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
      const save = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Sauvegarder");
      const nav = innerWidth < 1024 ? document.querySelector("#admin-section") : document.querySelector('nav[aria-label]');
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, navigationVisible: nav ? isVisible(nav) : null, saveVisible: save ? isVisible(save) : null, saveHeight: save?.getBoundingClientRect().height ?? null,
        overflowing: [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== "fixed"; }).slice(0, 10).map((el) => ({ tag: el.tagName, class: el.className, text: el.textContent.slice(0, 60) })) };
    });
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
    await go(); await waitText("Données chargées.");
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
    assert.deepEqual(await page.evaluate(() => window.__unhandledApi), []);
    await go("?login"); await page.waitForSelector("#admin-password");
    await checkPage("login", width);
    assert.equal(await page.$eval("#admin-password", (input) => input.autocomplete), "current-password");
    assert(await page.$eval("#admin-password", (input) => input.getBoundingClientRect().height >= 44));
  }
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
  const report = { passed: results.every((result) => result.passed) && errors.length === 0, widths, results, errors, blockedRequests, checks: ["real-admin-layout-and-components", "synthetic-data-only", "mobile-section-selector", "no-document-overflow", "visible-navigation-and-save", "sticky-controls-after-scroll", "order-dialog-focus-and-escape", "mock-save", "login-password-toggle", "totp-focus-and-errors"] };
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert(report.passed, "Admin layout checks failed; see output/admin-arena/report.json.");
  console.log("Admin arena audit passed.");
} finally {
  await browser?.close();
  await server.close();
}
