/** Render real market components with local fixtures; never contact a remote account. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd(), output = resolve(root, "output/placard-customer-demand"), port = 3251;
const origin = `http://127.0.0.1:${port}`;
const modules = {
  "next/navigation": `export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`,
  "next/link": `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}`,
  "next/image": `import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  "customer-demand-ui-entry": `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {KqMarketHub} from '/src/components/placard/KqMarketHub';
    import {KqBuddieCarousel} from '/src/components/placard/KqBuddieCarousel';
    import {KQ_BUDDIES} from '/src/lib/kanab-quest-game';
    import {createKqCustomerDemandSnapshot,getKqCustomerDemandFlavorMatch,KQ_CUSTOMER_DEMAND_PERIOD_MS} from '/src/lib/kanab-quest-customer-demand';
    import {createKqOnlinePreview} from '/src/lib/kanab-quest-online';
    import {createKqBusinessPreview} from '/src/lib/kanab-quest-business';
    const params=new URLSearchParams(location.search),period=Math.floor(Date.parse('2026-10-12T12:00:00Z')/KQ_CUSTOMER_DEMAND_PERIOD_MS);
    const now=(period+1)*KQ_CUSTOMER_DEMAND_PERIOD_MS-12*3600000,iso=value=>new Date(value).toISOString();
    const customerDemand=createKqCustomerDemandSnapshot(now);
    if(params.has('expired'))customerDemand.serverNow=iso(Date.parse(customerDemand.endsAt)+1);
    if(params.has('depleted'))customerDemand.requests.forEach(request=>request.remainingUnits=0);
    const stock=(request,index)=>({id:'stock-'+index,flowerId:'flower-'+index,varietyCode:request.varietyCode,name:KQ_BUDDIES.find(b=>b.code===request.varietyCode).name,route:'raw',batchRoute:'raw',juryScore:9.5,initialUnits:10000,remainingUnits:10000,equivalentUnits:10000,originalUnits:10000,baseUnitCents:1000,repExact:0,repRounded:0,professionalUnits:0,counted:false});
    const commerce={customerDemand,cashCents:100000,electricityOutstandingCents:0,reputation:0,clients:0,computerOwned:false,internetRenew:false,revision:1,campaign:{id:'campaign',revision:1,reputation:0,clientsStart:0,event:'normal',internetPaid:false,directUsed:0,shopUsed:0,goodUnits:0,disappointmentUnits:0},rawLots:[],stocks:params.has('empty')?[]:customerDemand.requests.map(stock),receipts:[],marketVolumes:{},ownVolumes:{},routeSales:{}};
    commerce.online=createKqOnlinePreview(now);
    commerce.business=createKqBusinessPreview(now);
    if(params.has('low-quality'))commerce.stocks.forEach((item,index)=>item.juryScore=customerDemand.requests[index].minimumQuality-0.1);
    if(params.has('extract')){
      commerce.computerOwned=true;
      commerce.stocks=commerce.stocks.map(item=>({...item,route:'dry-sift',batchRoute:'dry-sift',baseUnitCents:1200}));
    }
    if(params.has('partial')||params.has('unmatched')){
      const request=customerDemand.requests.find(item=>item.channel==='cbd-shop');
      const variety=KQ_BUDDIES.find(item=>getKqCustomerDemandFlavorMatch(request,item.code).matchedFlavorCount===(params.has('partial')?1:0));
      commerce.stocks=[{...stock(request,1),varietyCode:variety.code,name:variety.name}];
    }
    if(params.has('packaged')){
      const source=commerce.stocks[0];commerce.stocks=[];
      commerce.online.listings=[{id:'packaged',stockId:source.id,varietyCode:source.varietyCode,name:source.name,route:source.route,formatGrams:5,packagingCode:'kraft-5',packetPriceCents:5000,initialPackets:4,remainingPackets:4,soldPackets:0,status:'paused',qualityScore:9.5,baseUnitCents:source.baseUnitCents,createdAt:iso(now)}];
    }
    if(params.has('legacy'))delete commerce.customerDemand;
    window.__demand={commerce,cultureOpened:0,reads:0,restoreRequests:()=>{commerce.customerDemand=customerDemand;}};
    const original=fetch.bind(window);window.fetch=async(url,init={})=>{
      if(!String(url).startsWith('/api/'))return original(url,init);
      if(String(url).startsWith('/api/arena/placard/commerce')&&!init.method){window.__demand.reads++;return Response.json(commerce);}
      throw Error('Unexpected API request: '+url);
    };
    function App(){const [section,setSection]=useState(params.get('section')??(params.has('dashboard')?'dashboard':undefined));const [selected,setSelected]=useState(KQ_BUDDIES[0].code);return params.has('culture')?<div style={{padding:16,background:'#f4efdf'}}><KqBuddieCarousel buddies={KQ_BUDDIES.slice(0,4)} artwork={{}} selectedCode={selected} onSelect={code=>{setSelected(code);window.__demand.selected=code;}}/></div>:<KqMarketHub section={section} initialFlowerId={params.get('flower')??undefined} onSectionChange={setSection} onOpenShop={()=>{}} onOpenCulture={()=>{window.__demand.cultureOpened++;}}/>;}
    createRoot(document.getElementById('root')).render(<App/>);
  `,
};
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"), publicDir: resolve(root, "public"), resolve: { alias: { "@": resolve(root, "src") } }, optimizeDeps: { include: ["react", "react-dom/client", "lucide-react"] }, plugins: [{
  name: "customer-demand-ui-audit", enforce: "pre", resolveId(id) { if (id in modules) return "\0" + id; },
  async load(id) { if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code; },
  configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.split("?")[0] !== "/") return next(); res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}:root{--font-display:Impact;--font-body:Arial}body{margin:0;font-family:Arial,sans-serif}button,input,select{font-family:inherit}button{cursor:pointer}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}</style><div id="root"></div><script type="module" src="/@id/__x00__customer-demand-ui-entry"></script></html>'); }); },
}], server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null } });

let browser, page;
const checks = [], errors = [];
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  page = await browser.newPage(); page.setDefaultTimeout(30000); page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true); page.on("request", request => void (request.url().startsWith(origin) || request.url().startsWith("data:") ? request.continue() : request.abort()));
  const visit = async (query = "") => { const params = new URLSearchParams(query); if (!params.has("section") && !params.has("dashboard") && !params.has("culture")) params.set("section", "demands"); await page.goto(origin + "/?" + params, { waitUntil: "networkidle0" }); await page.waitForFunction(() => (document.querySelector('[data-screen]') || document.querySelector('[aria-label="Tes cartes Buddies"]')) && !document.body.textContent.includes("Ouverture du comptoir")); };
  const selectSection = async section => {
    await page.click(`[data-market-section="${section === "demands" ? "sales" : section}"]`);
    if (section === "demands") {
      const action = await page.waitForFunction(() => [...document.querySelectorAll("button")].find(node => node.textContent.includes("Demandes clients · voir les primes")));
      await action.asElement().click(); await action.dispose();
    }
  };
  const loadedFlavorImages = async selector => page.waitForFunction(selector => { const images = [...document.querySelectorAll(selector)]; return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0); }, {}, selector);
  await page.goto(origin, { waitUntil: "networkidle0" }); await page.waitForSelector('[data-screen="overview"]');
  assert.equal(await page.$eval('nav[aria-label="Commerce"] [aria-current="page"]', node => node.textContent), "Synthèse");
  checks.push("The market opens on the shop overview without an explicit section");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 1000 }); await visit();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `No overflow at ${width}px`);
    assert.equal(await page.$$eval("article[data-channel]", nodes => nodes.length), 3);
    assert.deepEqual(await page.$$eval('[data-market-section]', nodes => nodes.map(node => node.textContent)), ["Vendre", "Mon stock en vente", "Développer"]);
    assert.equal(await page.$eval('[data-market-section][aria-current="page"]', node => node.textContent), "Vendre");
    assert.ok(await page.$$eval('article[data-channel] ul[aria-label]', nodes => nodes.length === 3 && nodes.every(node => node.querySelectorAll("li").length === 2)));
    await loadedFlavorImages('article[data-channel] ul[aria-label] img');
    const cards = await page.$$eval("article[data-channel]", nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, left: node.getBoundingClientRect().left })));
    assert.equal(width > 700 ? cards.every(card => card.top === cards[0].top) : cards.every(card => card.left === cards[0].left), true, "Responsive demand layout");
    assert.ok(await page.evaluate(() => document.body.textContent.includes("Prépare la prochaine période")));
    await page.screenshot({ path: resolve(output, `market-demand-${width}.png`), fullPage: true });
    checks.push(`Three circuits, paired flavor illustrations, 24-hour preview and no overflow at ${width}px`);
  }
  await page.click('article[data-channel="cbd-shop"] button');
  await page.waitForSelector('[data-screen="offer"]');
  assert.ok(await page.evaluate(() => document.body.textContent.includes("Demande du moment") && document.body.textContent.includes("Le reste est repris au tarif habituel")), "Partial bonus explains weighted price");
  checks.push("Shop demand opens its matching lot and explains partial premium");
  await visit("dashboard"); assert.equal(await page.$("article[data-channel]"), null, "Requests are not duplicated in the sales register");
  await selectSection("demands"); await page.waitForSelector('[data-screen="demands"]'); await page.click('article[data-channel="wholesale"] button'); await page.waitForSelector('[data-screen="offer"]');
  assert.ok(await page.evaluate(() => document.body.textContent.includes("Grossistes")), "Dashboard action switches to sales and retains circuit");
  checks.push("The shop navigation keeps requests separate from the sales register and preserves demand-to-lot navigation");
  await selectSection("demands"); await page.waitForSelector('[data-screen="demands"]');
  await selectSection("sales"); await page.waitForSelector('[data-screen="offer"]');
  assert.ok(await page.evaluate(() => document.body.textContent.includes("Grossistes")), "Returning to production preserves the chosen circuit");
  await page.focus('[data-market-section="dashboard"]'); await page.keyboard.press("Enter");
  await page.waitForSelector('[data-screen="dashboard"]');
  assert.equal(await page.$eval('[data-market-section][aria-current="page"]', node => node.textContent), "Mon stock en vente");
  assert.ok(await page.evaluate(() => document.activeElement?.hasAttribute("data-commerce-view-heading") || document.activeElement?.hasAttribute("data-online-listings-heading")));
  checks.push("Keyboard activation opens the sales register and focuses its heading");
  await visit("section=sales&flower=flower-1"); await page.waitForSelector('[data-screen="distribution"]');
  assert.equal(await page.$("article[data-channel]"), null);
  assert.equal(await page.$eval('[data-market-section][aria-current="page"]', node => node.textContent), "Vendre");
  const returnToOverview = await page.waitForFunction(() => [...document.querySelectorAll("button")].find(node => node.textContent === "Synthèse"));
  await returnToOverview.asElement().click(); await returnToOverview.dispose(); await page.waitForSelector('[data-screen="overview"]');
  await selectSection("demands"); await page.waitForSelector('[data-screen="demands"]');
  checks.push("A harvest deep link opens its lot and returns through the shop overview to requests");
  await visit("partial");
  assert.ok(await page.$eval('article[data-channel="cbd-shop"]', node => node.textContent.includes("1 arôme commun")));
  await page.click('article[data-channel="cbd-shop"] button'); await page.waitForSelector('[data-screen="offer"]');
  assert.ok(await page.evaluate(() => document.body.textContent.includes("Demande du moment")));
  checks.push("A different cultivar sharing one aroma can earn the partial bonus");
  await visit("low-quality");
  await page.click('article[data-channel="cbd-shop"] button'); await page.waitForSelector('[data-screen="offer"]');
  assert.ok(await page.evaluate(() => document.body.textContent.includes("Les goûts correspondent") && document.body.textContent.includes("qualité d’au moins")));
  checks.push("Matching flower tastes explain the minimum quality when the normal price still applies");
  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000 }); await visit("extract");
    assert.ok(await page.$eval('article[data-channel="cbd-shop"]', node => node.textContent.includes("en vrac compatibles")));
    await page.click('article[data-channel="cbd-shop"] button'); await page.waitForSelector('[data-screen="offer"]');
    assert.ok(await page.evaluate(() => document.body.textContent.includes("Demande du moment")));
    await loadedFlavorImages('[data-lot-summary] ul[aria-label] img');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: resolve(output, `extract-demand-${width}.png`), fullPage: true });
    checks.push(`Source flower aromas and demand premium on resin at ${width}px`);
  }
  await visit("extract&packaged");
  assert.ok(await page.$eval('article[data-channel="online"]', node => node.textContent.includes("Des paquets correspondent")));
  await page.click('article[data-channel="online"] button'); await page.waitForSelector('[data-online-listing="packaged"]');
  await loadedFlavorImages('[data-online-listing="packaged"] ul[aria-label] img');
  assert.ok(await page.$eval('[data-online-listing="packaged"]', node => node.textContent.includes("repère +") && node.textContent.includes("Ton prix choisi reste inchangé")));
  checks.push("Packaged resin keeps source tastes and uses the online demand premium without silently changing its asking price");
  await visit("unmatched&section=sales"); await page.click('[aria-label="Tes lots"] button'); await page.waitForSelector('[data-screen="distribution"]');
  await page.click('[aria-label="Voir l’offre CBD shops"]'); await page.waitForSelector('[data-screen="offer"]');
  assert.ok(await page.evaluate(() => !document.body.textContent.includes("Demande du moment") && [...document.querySelectorAll("button")].some(button => button.textContent.includes("Voir le montant net") && !button.disabled)));
  checks.push("An unrelated aroma profile remains sellable at the normal tariff");
  await visit("packaged"); await page.click('article[data-channel="online"] button'); await page.waitForSelector('[data-screen="dashboard"]');
  assert.ok(await page.evaluate(() => document.activeElement?.hasAttribute("data-online-listings-heading")));
  checks.push("Prepared packets open their listing register even when no loose stock remains");
  await visit("empty"); assert.equal(await page.$$eval("article[data-channel]", nodes => nodes.length), 3); await page.click('article[data-channel="online"] a');
  assert.equal(await page.evaluate(() => window.__demand.cultureOpened), 1);
  checks.push("Requests remain visible before any harvest and open the existing culture flow");
  for (const query of ["expired", "depleted"]) {
    await visit(query);
    assert.equal(await page.$$eval('article[data-active="false"]', nodes => nodes.length), 3);
    checks.push(`${query} requests no longer advertise an active premium`);
  }
  await visit("legacy"); assert.equal(await page.$("article[data-channel]"), null);
  assert.ok(await page.evaluate(() => document.body.textContent.includes("Les demandes sont momentanément indisponibles")));
  const readsBeforeRetry = await page.evaluate(() => { window.__demand.restoreRequests(); return window.__demand.reads; });
  const retry = await page.waitForFunction(() => [...document.querySelectorAll("button")].find(node => node.textContent === "Réessayer"));
  await retry.asElement().click(); await retry.dispose(); await page.waitForSelector("article[data-channel]");
  assert.ok(await page.evaluate(reads => window.__demand.reads > reads, readsBeforeRetry));
  checks.push("Missing request data shows a useful state and retry restores the dashboard without invented bonuses");
  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 1000 }); await visit("culture");
    await loadedFlavorImages('article[role="listitem"] ul[aria-label] img');
    const cultureCards = await page.$$eval('article[role="listitem"]', nodes => nodes.map(node => {
      const artwork = node.querySelector('button[data-carousel-drag]'), flavors = node.querySelector('ul[aria-label]');
      return { flavors: flavors?.querySelectorAll("img").length, belowArtwork: flavors?.getBoundingClientRect().top >= artwork?.getBoundingClientRect().bottom };
    }));
    assert.equal(cultureCards.length, 4);
    assert.ok(cultureCards.every(card => card.flavors === 2 && card.belowArtwork));
    await page.$eval('article[role="listitem"]:nth-child(2) > button', button => button.click());
    assert.equal(await page.$eval('article[role="listitem"]:nth-child(2)', node => node.getAttribute("data-selected")), "true");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: resolve(output, `culture-flavors-${width}.png`), fullPage: true });
    checks.push(`Two loaded taste images under every cultivation card; selection works at ${width}px`);
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, "report.json"), JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, output }));
} catch (error) {
  await page?.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, "failure.json"), JSON.stringify({ message: error.message, checks, errors }, null, 2));
  throw error;
} finally { await browser?.close(); await server.close(); }
