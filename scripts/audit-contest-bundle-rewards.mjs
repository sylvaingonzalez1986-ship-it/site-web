/** Real reward components, synthetic orders and catalogue; never contacts a remote API. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/contest-bundle-rewards");
const port = 3262;
const origin = `http://127.0.0.1:${port}`;
const widths = [320, 390, 1440];
const flowers = ["A", "B", "C", "D", "E"].map((letter) => ({ productId: `flower-${letter.toLowerCase()}`, title: `Fleur de démonstration ${letter}`, unitWeightGrams: 1 }));
const items = (quantity = 3) => flowers.map((flower) => ({ id: flower.productId, quantity, price: 4 }));
const paidReceipt = {
  orderId: "order-one", grantedAt: "2026-10-02T16:00:00Z",
  card: { id: "00000000-0000-4000-8000-000000000001", code: "EPIC-DEMO", name: "La Gardienne des fleurs", imageUrl: "", rarity: "epic" },
  buddiesPacks: 3, bottePacks: 5, requiredProductIds: flowers.map((flower) => flower.productId),
};
const makeProgress = (grams = 0, rewarded = false) => {
  const purchased = flowers.map((flower, index) => {
    const purchasedGrams = Array.isArray(grams) ? grams[index] ?? 0 : grams;
    return { productId: flower.productId, purchasedGrams, complete: purchasedGrams >= 3 };
  });
  const completedCount = purchased.filter(flower => flower.complete).length;
  return { flowers: purchased, completedCount, requiredCount: flowers.length, eligible: completedCount === flowers.length,
    rewarded, grantedAt: rewarded ? paidReceipt.grantedAt : null };
};
const initialRewards = () => ({ available: true, startsAt: "2026-10-02T12:00:00Z", minGrams: 3, buddiesPacks: 3, bottePacks: 5, flowers, progress: makeProgress(), receipts: [] });
let fixture = { status: 200, rewards: initialRewards() };
const requests = [], browserErrors = [], blockedRequests = [], results = [];
const entry = `
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ContestBundleRewardPreview,ContestBundleRewardReceipt} from '/src/components/checkout/ContestBundleReward';
function App(){
 const query=new URLSearchParams(location.search);
 const [items,setItems]=useState(${JSON.stringify(items().map((item, index) => ({ ...item, quantity: index === 4 ? 2 : 3 })))});
 const [orderId,setOrderId]=useState('order-one');
 const [paymentState,setPaymentState]=useState(query.get('state')||'paid');
 const [active,setActive]=useState(!query.has('closed'));
 useEffect(()=>{window.__setItems=setItems;window.__setOrderId=setOrderId;window.__setPaymentState=setPaymentState;window.__setActive=setActive;},[]);
 return React.createElement('main',null,query.has('receipt')
  ?React.createElement(ContestBundleRewardReceipt,{orderId,paymentState})
  :React.createElement(ContestBundleRewardPreview,{items,active}));
}
createRoot(document.getElementById('root')).render(React.createElement(App));
`;
const modules = {
  "contest-bundle-entry": entry,
  "contest-bundle-link": "import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}",
};
const server = await createServer({
  root, configFile: false, envDir: false, publicDir: false,
  cacheDir: resolve(output, "vite-cache"), esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-runtime", "lucide-react"] },
  plugins: [{
    name: "contest-bundle-fixture", enforce: "pre",
    resolveId(id) {
      if (id.endsWith("/navigation/NavigationLink")) return "\0contest-bundle-link";
      if (Object.hasOwn(modules, id)) return "\0" + id;
    },
    load(id) { if (id.startsWith("\0")) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url === "/api/account/contest-bundle-rewards") {
          requests.push({ method: request.method });
          response.statusCode = fixture.status;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(fixture.status === 200 ? { rewards: fixture.rewards } : { error: "Démonstration indisponible." }));
          return;
        }
        if (request.url?.startsWith("/api/")) {
          response.statusCode = 503; response.end("Unexpected fixture API"); return;
        }
        if (request.url?.split("?")[0] !== "/") return next();
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bonus fleurs Concours · Démonstration locale</title><style>*{box-sizing:border-box}body{margin:0;background:#fffaf1;font-family:Arial,sans-serif;color:#123a2e}main{max-width:640px;margin:0 auto;padding:14px;min-width:0}a{color:#005d45}button{min-height:44px}</style><div id="root"></div><script type="module" src="/@id/__x00__contest-bundle-entry"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});

let browser;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || (url.origin === origin && (!url.pathname.startsWith("/api/") || url.pathname === "/api/account/contest-bundle-rewards"))) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  const open = async (query = "") => {
    requests.length = 0;
    await page.goto(origin + "/" + query, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => Boolean(window.__setItems));
  };
  const text = () => page.$eval("main", element => element.textContent.replace(/\s+/g, " ").trim());
  const noCard = async () => assert.equal(await page.$("aside"), null);
  const progress = async (value) => page.waitForFunction(expected => Number(document.querySelector('progress[aria-label="Fleurs concours complétées"]')?.value) === expected, {}, value);
  const setItems = async (value) => page.evaluate(next => window.__setItems(next), value);
  const layout = async () => {
    const result = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth,
      outside: [...document.querySelectorAll("main aside,main a,main progress")].filter(element => {
        const bounds = element.getBoundingClientRect(); return bounds.left < -1 || bounds.right > innerWidth + 1;
      }).map(element => element.textContent.slice(0, 80)) }));
    assert(result.width <= result.viewport + 1, JSON.stringify(result));
    assert.deepEqual(result.outside, []);
    return result;
  };
  const record = (name, width) => { results.push({ name, width, passed: true }); console.log(`PASS ${name} ${width}`); };

  for (const width of widths) {
    await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
    fixture = { status: 200, rewards: initialRewards() };
    await open(); await progress(4); await layout();
    assert.deepEqual(requests, [{ method: "GET" }]);
    assert.match(await text(), /3\s*g/);
    await page.screenshot({ path: resolve(output, `partial-${width}.png`), fullPage: true });
    record("partial-cart-shows-missing-flower", width);

    await setItems(items()); await progress(5); await layout();
    assert.match(await text(), /3\s*packs Buddies/i); assert.match(await text(), /5\s*packs La Botte/i);
    assert.deepEqual(await page.$$eval('ul[aria-label="Bonus du grand tour"] > li', rows => rows.slice(1).map(row => ({
      packs: row.querySelector(":scope > strong").textContent,
      collection: row.querySelector("b").textContent,
      size: row.querySelector("small").textContent,
    }))), [
      { packs: "3", collection: "Buddies", size: "3 cartes par pack" },
      { packs: "5", collection: "La Botte", size: "10 cartes par pack" },
    ]);
    assert.deepEqual(requests, [{ method: "GET" }]);
    await page.screenshot({ path: resolve(output, `qualified-${width}.png`), fullPage: true });
    await setItems(items(6)); await progress(5);
    assert.match(await text(), /3\s*packs Buddies/i); assert.match(await text(), /5\s*packs La Botte/i);
    await setItems(items(2)); await progress(0);
    record("threshold-updates-without-refetch-or-double-bonus", width);

    fixture.rewards.progress = makeProgress([3, 2, 1, 0, 0]);
    await open();
    await setItems(items().map((item, index) => ({ ...item, quantity: [0, 1, 2, 3, 3][index] })));
    await progress(5); await layout();
    const combinedRows = await page.$$eval('li[data-contest-bundle-product]', rows => rows.map(row => ({ productId: row.dataset.contestBundleProduct, text: row.textContent.replace(/\s+/g, " ").trim() })));
    assert.equal(combinedRows.length, 5);
    for (const [index, row] of combinedRows.entries()) {
      assert.equal(row.productId, flowers[index].productId);
      assert(row.text.includes(`${[3, 2, 1, 0, 0][index]} g déjà payés + ${[0, 1, 2, 3, 3][index]} g dans ce panier`), row.text);
      assert(row.text.includes("3 / 3 g cumulés après paiement"), row.text);
    }
    assert.match(await text(), /Objectif atteint après paiement de ce panier/);
    assert.doesNotMatch(await text(), /dans une même commande/);
    assert.deepEqual(requests, [{ method: "GET" }]);
    await page.screenshot({ path: resolve(output, `cumulative-${width}.png`), fullPage: true });
    await setItems([]); await progress(1);
    assert.match(await text(), /3 g déjà payés \+ 0 g dans ce panier/);
    record("paid-history-and-cart-are-separate-and-combine-per-flower", width);

    fixture.rewards.progress = makeProgress(3);
    await open(); await setItems([]); await progress(5);
    assert.match(await text(), /Tes achats payés remplissent déjà les conditions/);
    assert.match(await text(), /Débloquer mon bonus dans le Carnet/);
    assert.equal(await page.$eval('a[href="/arene/carnet/concours"]', element => element.textContent), "Débloquer mon bonus dans le Carnet");
    assert.deepEqual(requests, [{ method: "GET" }]);
    record("already-eligible-history-links-to-claim-without-mutating-on-read", width);

    fixture.rewards.progress = makeProgress(0, true);
    await open(); await page.waitForSelector("aside");
    assert.match(await text(), /Bonus Concours déjà débloqué/);
    assert.match(await text(), /unique pour ton compte/);
    assert.equal(await page.$('ul[aria-label="Bonus du grand tour"]'), null);
    assert.equal(await page.$('progress[aria-label="Fleurs concours complétées"]'), null);
    await setItems(items(6)); await layout();
    assert.equal(await page.$('ul[aria-label="Bonus du grand tour"]'), null);
    assert.deepEqual(requests, [{ method: "GET" }]);
    await page.screenshot({ path: resolve(output, `already-rewarded-${width}.png`), fullPage: true });
    record("historical-beneficiary-is-not-promised-a-second-bonus", width);

    fixture.rewards.progress = null;
    await open(); await progress(4); await layout();
    assert.match(await text(), /Connecte-toi/);
    const anonymousRows = await page.$$eval('li[data-contest-bundle-product]', rows => rows.map(row => row.textContent));
    assert(anonymousRows.every(row => !row.includes("déjà payés")), JSON.stringify(anonymousRows));
    assert.deepEqual(requests, [{ method: "GET" }]);
    record("anonymous-cart-never-invents-personal-paid-progress", width);

    fixture.rewards.receipts = [paidReceipt];
    fixture.rewards.progress = makeProgress(3, true);
    await open("?receipt"); await page.waitForSelector("aside"); await layout();
    assert.match(await text(), /La Gardienne des fleurs/);
    assert.deepEqual(await page.$$eval('ul[aria-label="Packs crédités"] > li', rows => rows.map(row => ({
      label: row.querySelector("strong").textContent,
      size: row.querySelector("span").textContent,
    }))), [
      { label: "3 packs Buddies", size: "3 cartes par pack" },
      { label: "5 packs La Botte", size: "10 cartes par pack" },
    ]);
    assert.deepEqual(requests, [{ method: "POST" }]);
    await page.screenshot({ path: resolve(output, `receipt-${width}.png`), fullPage: true });
    record("owned-paid-receipt-is-displayed", width);
  }

  await page.setViewport({ width: 390, height: 844 });
  fixture = { status: 200, rewards: initialRewards() };
  await open(); await progress(4);
  const invalidItems = [
    ...items().map(item => ({ ...item, id: item.id + "::3g" })),
    ...items().map(item => ({ ...item, quantity: 0 })),
    ...items().map(item => ({ ...item, quantity: 1.5 })),
    ...items().map(item => ({ ...item, price: 0 })),
  ];
  await setItems(invalidItems); await progress(0);
  await setItems([{ id: "pack-demo", quantity: 3, price: 18, isPack: true, packProductIds: flowers.map(flower => flower.productId) }]);
  await progress(5);
  record("invalid-lines-and-uncertain-variants-excluded-paid-pack-expanded", 390);

  await open("?closed"); await noCard(); assert.deepEqual(requests, []);
  await page.evaluate(() => window.__setActive(true)); await progress(4);
  await page.evaluate(() => window.__setActive(false)); await page.waitForFunction(() => !document.querySelector("aside"));
  record("closed-cart-does-not-load-and-hides-on-close", 390);

  fixture.rewards.flowers = []; await open(); await noCard();
  fixture.rewards = { ...initialRewards(), available: false }; await open(); await noCard();
  record("empty-catalogue-and-unavailable-schema-hide-offer", 390);

  fixture.rewards = initialRewards();
  for (const state of ["pending", "failed", "not_configured"]) {
    await open("?receipt&state=" + state); await noCard(); assert.deepEqual(requests, []);
  }
  fixture.rewards.receipts = [{ ...paidReceipt, orderId: "unrelated-order" }];
  await open("?receipt"); await noCard(); assert.deepEqual(requests, [{ method: "POST" }]);
  fixture.rewards.receipts = [];
  await open("?receipt"); await noCard();
  record("unpaid-and-unrelated-orders-cannot-display-or-request-reward", 390);

  fixture.rewards = { ...initialRewards(), available: false, receipts: [paidReceipt] };
  await open("?receipt"); await page.waitForSelector("aside");
  assert.match(await text(), /La Gardienne des fleurs/);
  await page.evaluate(() => window.__setOrderId("order-two"));
  await page.waitForFunction(() => !document.querySelector("aside"));
  await page.waitForNetworkIdle(); await noCard();
  record("historical-receipt-survives-closed-offer-and-clears-on-order-switch", 390);

  for (const status of [401, 503]) {
    fixture = { status, rewards: initialRewards() };
    await open(); await noCard();
    await open("?receipt"); await noCard();
    record(`api-${status}-hides-unverified-reward-gracefully`, 390);
  }
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(blockedRequests, []);
  await writeFile(resolve(output, "report.json"), JSON.stringify({ passed: true, widths, results, browserErrors, blockedRequests }, null, 2));
  console.log(`Contest bundle rewards audit passed: ${results.length} checks.`);
} finally {
  await browser?.close();
  await server.close();
}
