/** Real tasting book and offer note. Synthetic catalogue; no account or production access. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/contest-bundle-notebook");
const port = 3263;
const origin = `http://127.0.0.1:${port}`;
const note = "[data-contest-bundle-note]";
const contentsToggle = 'section[data-track="concours"] > h3 button[aria-expanded][aria-controls]';
const claimsOnly = process.argv.includes("--claims-only");
const widths = [320, 390, 1440];
const categories = ["outdoor", "greenhouse", "indoor"];
const categoryLabels = { outdoor: "Outdoor", greenhouse: "Greenhouse", indoor: "Indoor" };
const entries = ["regular", "concours"].flatMap((track, trackIndex) => categories.flatMap((category, categoryIndex) => [0, 1].map(index => ({
  id: `${track}-${category}-${index}`, slug: `${track}-${category}-${index}`,
  title: `${track === "concours" ? "Concours" : "Regular"} ${categoryLabels[category]} ${index + 1}`,
  productId: `product-${track}-${category}-${index}`, seasonId: "active-season", track, category,
  story: "Une fleur de démonstration, cultivée avec attention et présentée dans le carnet.",
  technicalSheet: { genetics: "Sélection bretonne", soil: "Terre vivante", harvestLabel: "Été 2026", cbdPercent: 12.5 },
  producer: { id: "demo-producer", name: "Le jardin de démonstration", region: "Bretagne" },
  product: { id: `product-${track}-${category}-${index}`, name: "Fleur de démonstration", price: 4, image: "/product_flower.jpg", category: "fleurs" },
  imageUrl: "/product_flower.jpg", galleryUrls: [], isPublished: true,
  position: trackIndex * 6 + categoryIndex * 2 + index, createdAt: "2026-10-02", updatedAt: "2026-10-02",
  stats: { approvedReviewCount: 0, averageScore: 0, criterionAverages: {}, consumptionCounts: {} },
}))));
const offer = {
  available: true, startsAt: "2026-10-02T12:00:00Z", minGrams: 3, buddiesPacks: 3, bottePacks: 5,
  flowers: [
    ...entries.filter(entry => entry.track === "concours").map(entry => ({ productId: entry.productId, title: entry.title, unitWeightGrams: 1 })),
    { productId: "offer-only-flower", title: "Fleur du catalogue sans fiche visible", unitWeightGrams: 1 },
  ],
};
const makeProgress = (grams = 0, rewarded = false) => {
  const flowers = offer.flowers.map((flower, index) => {
    const purchasedGrams = Array.isArray(grams) ? grams[index] ?? 0 : grams;
    return { productId: flower.productId, purchasedGrams, complete: purchasedGrams >= offer.minGrams };
  });
  const completedCount = flowers.filter(flower => flower.complete).length;
  return { flowers, completedCount, requiredCount: flowers.length, eligible: completedCount === flowers.length,
    rewarded, grantedAt: rewarded ? "2026-10-03T15:00:00Z" : null };
};
offer.progress = makeProgress();
const progressScenarios = {
  zero: makeProgress(), partial: makeProgress([3, 1, 2.5, 0, 4, 0, 0]), ready: makeProgress(3),
  rewarded: makeProgress(3, true), legacy: makeProgress(0, true), anonymous: null,
};
let claimFixture = { status: 200, rewards: { ...offer, progress: progressScenarios.rewarded, receipts: [] } };
let readFixture = { status: 200, rewards: { ...offer, receipts: [] } };
let holdReads = false;
let onHeldRead;
const heldReadReleases = [];
const modules = {
  "bundle-book-entry": `
    import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ContestTastingBook} from '/src/components/contest/ContestTastingBook';
    const entries=${JSON.stringify(entries)},baseOffer=${JSON.stringify(offer)},progressScenarios=${JSON.stringify(progressScenarios)};
    function Fixture(){
      const scenario=new URLSearchParams(location.search).get('offer');
      const progressScenario=new URLSearchParams(location.search).get('progress')||'zero';
      const initialOffer={...baseOffer,progress:progressScenarios[progressScenario]};
      const [offer,setOffer]=useState(scenario==='null'?null:scenario==='unavailable'?{...initialOffer,available:false}:scenario==='empty'?{...initialOffer,flowers:[]}:initialOffer);
      useEffect(()=>{window.__setOffer=setOffer;},[]);
      return React.createElement(ContestTastingBook,{entries,unlocks:[],viewerProfile:null,badges:[],isAuthenticated:Boolean(offer?.progress),
        seasonLabel:'Les dégustations de l’Arène · Saison 2026',initialTrack:'concours',initialCategory:'outdoor',contestBundleOffer:offer});
    }
    createRoot(document.getElementById('root')).render(React.createElement(Fixture));
  `,
  "next/image": "import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}});}",
  "next/link": "import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}",
  "bundle-navigation-link": "import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props);}",
  "next/dynamic": "import React from 'react';export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props));};}",
  "next/navigation": "export const usePathname=()=>'/arene/carnet/concours';export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});",
};
const browserErrors = [], externalRequests = [], apiRequests = [], results = [];
const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, "public"),
  cacheDir: resolve(output, "vite-cache"), esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "lucide-react"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: "bundle-book-fixture", enforce: "pre",
    resolveId(id) { if (id.endsWith("/navigation/NavigationLink")) return "\0bundle-navigation-link"; if (Object.hasOwn(modules, id)) return "\0" + id; },
    load(id) { if (id.startsWith("\0")) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url === "/api/account/contest-bundle-rewards") {
          let body = "";
          request.on("data", chunk => { body += chunk; });
          request.on("end", () => {
            apiRequests.push({ url: request.url, method: request.method, body });
            const fixture = structuredClone(request.method === "GET" ? readFixture : claimFixture);
            if (request.method === "POST" && fixture.status === 200 && fixture.rewards.progress?.rewarded) readFixture = structuredClone(fixture);
            const reply = () => {
              response.statusCode = fixture.status;
              response.setHeader("Content-Type", "application/json");
              response.end(JSON.stringify(fixture.status === 200 ? { rewards: fixture.rewards } : { error: "Attribution momentanément indisponible." }));
            };
            if (request.method === "GET" && holdReads) {
              heldReadReleases.push(reply);
              onHeldRead?.();
              onHeldRead = undefined;
            } else reply();
          });
          return;
        }
        if (request.url?.startsWith("/api/")) {
          apiRequests.push({ url: request.url, method: request.method });
          response.statusCode = 503; response.setHeader("Content-Type", "application/json");
          response.end('{"error":"No API access in this display-only fixture."}'); return;
        }
        if (request.url?.split("?")[0] !== "/") return next();
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carnet · Bonus concours local</title><style>@font-face{font-family:BookDisplay;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:BookBody;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:400 700}@font-face{font-family:BookHand;src:url('/src/app/fonts/Caveat-Latin-Bold.woff2');font-weight:700}:root{--font-display:BookDisplay;--font-body:BookBody;--font-sans:BookBody;--font-handwritten:BookHand}body{margin:0}</style><div class="site-background"><main class="relative z-0"><div id="root"></div></main></div><script type="module" src="/@id/__x00__bundle-book-entry"></script></html>`);
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
  page.on("pageerror", error => browserErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.origin === origin) void request.continue();
    else { externalRequests.push(request.url()); void request.abort(); }
  });
  const click = async label => {
    const handle = await page.waitForFunction(text => [...document.querySelectorAll("button[aria-label]")]
      .find(button => button.getAttribute("aria-label") === text && button.getClientRects().length && !button.closest("[hidden]")), {}, label);
    await handle.asElement().click(); await handle.dispose();
  };
  const openBook = async (scenario = "ready", coverFilename, progressScenario = "zero") => {
    readFixture = { status: 200, rewards: { ...offer, receipts: [], progress: progressScenarios[progressScenario],
      available: !["null", "unavailable"].includes(scenario), flowers: scenario === "empty" ? [] : offer.flowers } };
    await page.goto(`${origin}/?offer=${scenario}&progress=${progressScenario}`, { waitUntil: "networkidle0" });
    assert.equal(await page.$$eval("[data-contest-bundle-cover]", elements => elements.length), scenario === "ready" ? 1 : 0);
    if (coverFilename) {
      const cover = await page.$eval("[data-contest-bundle-cover]", element => {
        const bounds = element.getBoundingClientRect();
        return { text: element.textContent, top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right,
          height: bounds.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
      });
      assert.match(cover.text, /Bonus Concours/);
      assert(cover.height > 0 && cover.top >= 0 && cover.bottom <= cover.viewportHeight && cover.left >= 0 && cover.right <= cover.viewportWidth, JSON.stringify(cover));
      await page.screenshot({ path: resolve(output, coverFilename + ".png") });
    }
    await click("Ouvrir mon carnet de dégustation");
    await page.waitForFunction(() => !document.querySelector("[data-opening]"));
  };
  const openChapter = (track, category) => click(`${track === "concours" ? "Concours" : "Regular"} · ${categoryLabels[category]}, 2 fleurs`);
  const countNotes = () => page.$$eval(note, notes => notes.filter(item => !item.closest("[hidden]")).length);
  const noteText = () => page.$eval(note, element => element.textContent.replace(/\s+/g, " ").trim());
  const settleAnimations = () => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    await Promise.all(document.getAnimations().filter(animation => animation.playState === "running"
      && Number.isFinite(animation.effect?.getComputedTiming().iterations))
      .map(animation => animation.finished.catch(() => undefined)));
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
  const layout = async () => {
    await settleAnimations();
    const dimensions = await page.evaluate(selector => {
      const scroll = document.querySelector("[data-book-scroll]");
      const elements = [...document.querySelectorAll(`${selector},${selector} button,${selector} summary,${selector} li`)];
      return { viewport: innerWidth, width: document.documentElement.scrollWidth, pageWidth: scroll.clientWidth, pageScrollWidth: scroll.scrollWidth,
        outside: elements.filter(element => element.getClientRects().length && !element.closest("[hidden]")).filter(element => {
          const bounds = element.getBoundingClientRect(); return bounds.left < -1 || bounds.right > innerWidth + 1;
        }).map(element => element.textContent.slice(0, 100)) };
    }, note);
    assert(dimensions.width <= dimensions.viewport + 1, JSON.stringify(dimensions));
    assert(dimensions.pageScrollWidth <= dimensions.pageWidth + 1, JSON.stringify(dimensions));
    assert.deepEqual(dimensions.outside, []);
    return dimensions;
  };
  const shot = async filename => {
    await settleAnimations();
    await page.$eval(note, element => {
      const scroll = document.querySelector("[data-book-scroll]");
      const tall = element.getBoundingClientRect().height > scroll.clientHeight;
      element.scrollIntoView({ block: tall ? "start" : "center" });
      if (tall) scroll.scrollTop = Math.max(0, scroll.scrollTop - 14);
    });
    await page.screenshot({ path: resolve(output, filename + ".png") });
  };
  const record = (name, width) => { results.push({ name, width, passed: true }); console.log(`PASS ${name} ${width}`); };
  const noteCopyVisibility = async () => {
    await settleAnimations();
    const visibility = await page.evaluate(selector => {
      const scroll = document.querySelector("[data-book-scroll]");
      const note = document.querySelector(selector);
      const bounds = scroll.getBoundingClientRect();
      const requiredCopy = [...note.querySelectorAll(':scope > p:nth-of-type(-n+2), :scope > ul[aria-label="Les récompenses du grand tour"]')];
      return { scrollTop: scroll.scrollTop, minTop: Math.max(0, bounds.top), maxBottom: Math.min(innerHeight, bounds.bottom),
        copy: requiredCopy.map(element => ({ text: element.textContent.replace(/\s+/g, " ").trim(), top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom })) };
    }, note);
    assert.equal(visibility.copy.length, 3);
    for (const item of visibility.copy) assert(item.top >= visibility.minTop && item.bottom <= visibility.maxBottom, JSON.stringify({ ...visibility, failed: item }));
    return visibility;
  };
  const expandContentsBonus = async () => {
    assert.equal(await countNotes(), 0, "The contents bonus must be closed before clicking the Concours bar");
    assert.equal(await page.$eval(contentsToggle, button => button.getAttribute("aria-expanded")), "false");
    assert.match(await page.$eval(contentsToggle, button => button.textContent), /Bonus cadeau/i);
    await page.$eval(contentsToggle, button => button.scrollIntoView({ block: "start" }));
    await page.click(contentsToggle);
    await settleAnimations();
    assert.equal(await page.$eval(contentsToggle, button => button.getAttribute("aria-expanded")), "true");
    assert.equal(await countNotes(), 1);
    const placement = await page.evaluate(({ noteSelector, toggleSelector }) => {
      const button = document.querySelector(toggleSelector);
      const group = button.closest('section[data-track="concours"]');
      const region = document.getElementById(button.getAttribute("aria-controls"));
      const note = group.querySelector(noteSelector);
      const header = group.querySelector("h3");
      const firstCulture = group.querySelector('button[data-culture]');
      return { controlled: Boolean(region?.contains(note)), noteInConcours: Boolean(note),
        headerBottom: header.getBoundingClientRect().bottom, noteTop: note.getBoundingClientRect().top,
        noteBottom: note.getBoundingClientRect().bottom, firstCultureTop: firstCulture.getBoundingClientRect().top };
    }, { noteSelector: note, toggleSelector: contentsToggle });
    assert.equal(placement.controlled, true);
    assert.equal(placement.noteInConcours, true);
    assert(placement.noteTop >= placement.headerBottom - 1, JSON.stringify(placement));
    assert(placement.firstCultureTop >= placement.noteBottom - 1, JSON.stringify(placement));
    await page.$eval(contentsToggle, button => button.scrollIntoView({ block: "start" }));
    await noteCopyVisibility();
  };
  const checklist = () => page.$$eval('[data-contest-bundle-checklist] > li', rows => rows.map(row => ({
    productId: row.dataset.contestBundleProduct, text: row.textContent.replace(/\s+/g, " ").trim(),
    checked: row.querySelector('input[type="checkbox"]')?.checked ?? null,
    disabled: row.querySelector('input[type="checkbox"]')?.disabled ?? null,
  })));
  const claimButtons = () => page.$$eval('[data-contest-bundle-note] button', buttons => buttons.filter(button => button.textContent.trim() === "Débloquer mon bonus").length);
  const postRequests = () => apiRequests.filter(request => request.method === "POST");
  const clickClaim = async (doubleClick = false) => {
    const handle = await page.waitForFunction(() => [...document.querySelectorAll('[data-contest-bundle-note] button')].find(button => button.textContent.trim() === "Débloquer mon bonus"));
    if (doubleClick) await handle.evaluate(button => { button.click(); button.click(); });
    else await handle.asElement().click();
    await handle.dispose();
  };
  const checkProgress = async scenario => {
    const rows = await checklist();
    const expected = progressScenarios[scenario];
    assert.equal(rows.length, offer.flowers.length);
    for (const [index, row] of rows.entries()) {
      assert.equal(row.productId, offer.flowers[index].productId);
      if (expected) {
        assert.equal(row.checked, expected.flowers[index].complete);
        assert.equal(row.disabled, true, "Paid purchases cannot be checked by hand");
        assert(row.text.includes(`${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(expected.flowers[index].purchasedGrams)} / 3 g achetés`), row.text);
      } else {
        assert.equal(row.checked, null);
        assert.match(row.text, /après connexion/);
      }
    }
    assert.equal(await claimButtons(), expected?.eligible && !expected.rewarded ? 1 : 0);
    if (expected?.rewarded) assert.match(await noteText(), /Bonus déjà débloqué/);
    if (!expected) assert.match(await noteText(), /Connecte-toi pour voir ta progression/);
  };

  if (!claimsOnly) {
  for (const width of widths) {
    await page.setViewport({ width, height: width < 700 ? 844 : 1000, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 });
    await openBook("ready", `cover-${width}`);
    record("active-offer-announced-on-closed-cover", width);
    assert.equal(await countNotes(), 0);
    await settleAnimations();
    await page.screenshot({ path: resolve(output, `contents-closed-${width}.png`) });
    await expandContentsBonus();
    assert.equal(await page.$$eval('section[data-track="regular"] [data-contest-bundle-note]', elements => elements.length), 0);
    assert.equal(await page.$$eval('section[data-track="concours"] [data-contest-bundle-note]', elements => elements.length), 1);
    const copy = await noteText();
    assert.match(copy, /Ton bonus Concours/);
    assert.match(copy, /3\s*g/); assert.match(copy, /chaque fleur/i);
    assert.match(copy, /toutes cultures/i); assert.match(copy, /une ou plusieurs commandes payées/i);
    assert.match(copy, /achats payés, y compris les précédents/i); assert.match(copy, /une seule fois par compte/i);
    assert.match(copy, /épique/i); assert.match(copy, /3\s*packs?\s*Buddies/i); assert.match(copy, /5\s*packs?\s*Botte du Chanvrier/i);
    assert.match(copy, /Buddies contient 3 cartes/i); assert.match(copy, /Botte du Chanvrier, 10 cartes/i);
    await layout();
    await page.screenshot({ path: resolve(output, `contents-${width}.png`) });
    record("contents-bonus-opens-directly-under-concours-bar-before-cultures", width);

    await page.focus(contentsToggle);
    await page.keyboard.press("Enter");
    await settleAnimations();
    assert.equal(await page.$eval(contentsToggle, button => button.getAttribute("aria-expanded")), "false");
    assert.equal(await countNotes(), 0);
    await page.keyboard.press("Space");
    await settleAnimations();
    assert.equal(await page.$eval(contentsToggle, button => button.getAttribute("aria-expanded")), "true");
    assert.equal(await countNotes(), 1);
    record("contents-bonus-toggle-supports-keyboard-enter-and-space", width);

    assert.equal(await page.$eval('[data-contest-bundle-checklist]', element => Boolean(element.getClientRects().length && !element.closest("details:not([open]),[hidden]"))), true);
    await checkProgress("zero");
    const list = await page.$$eval('[data-contest-bundle-checklist] > li', elements => elements.map(element => element.textContent.trim()));
    assert.equal(list.length, offer.flowers.length);
    for (const flower of offer.flowers) assert(list.some(title => title.includes(flower.title)), flower.title);
    assert.equal(await page.$$eval('[data-contest-bundle-checklist] button', elements => elements.length), 6);
    await layout(); await shot(`all-cultures-${width}`);
    record("authoritative-flower-list-keeps-other-cultures-and-unmatched-product", width);

    await click("Voir la fleur Concours Indoor 2");
    await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Concours Indoor 2");
    assert.equal(await countNotes(), 1);
    assert.equal(await page.$eval(note, element => element.dataset.compact), "true");
    await layout(); await shot(`flower-${width}`);
    await click("Revenir aux fleurs");
    assert.deepEqual(await page.$$eval("[data-book-entry]", buttons => buttons.map(button => button.dataset.bookEntry)), ["concours-indoor-0", "concours-indoor-1"]);
    assert.equal(await countNotes(), 1);
    await layout();
    record("note-flower-button-navigates-to-correct-culture-and-detail", width);

    await click("Table des matières");
    for (const category of categories) {
      await openChapter("regular", category);
      assert.equal(await countNotes(), 0);
      await page.click(`[data-book-entry="regular-${category}-0"]`);
      assert.equal(await countNotes(), 0);
      await click("Table des matières");
      await openChapter("concours", category);
      assert.equal(await countNotes(), 1);
      await layout();
      if (category === "outdoor") await shot(`chapter-${width}`);
      await click("Table des matières");
    }
    record("all-concours-chapters-show-note-and-regular-pages-do-not", width);

    for (const scenario of ["partial", "ready", "rewarded", "anonymous"]) {
      await openBook("ready", undefined, scenario);
      await expandContentsBonus();
      await checkProgress(scenario);
      await layout();
      await shot(`progress-${scenario}-${width}`);
      record(`cumulative-checklist-${scenario}-is-readonly-until-explicit-claim`, width);
    }
  }

  await page.setViewport({ width: 320, height: 568, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await openBook("ready", "cover-320x568");
  await expandContentsBonus();
  await layout();
  await page.screenshot({ path: resolve(output, "contents-320x568.png") });
  record("short-mobile-cover-and-expanded-bonus-remain-readable", "320x568");

  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await openBook();
  await openChapter("concours", "outdoor");
  await layout();
  await shot("landscape-844x390");
  const landscape = await page.evaluate(() => {
    const scroll = document.querySelector("[data-book-scroll]");
    const footer = scroll.nextElementSibling;
    const button = footer.querySelector('button[aria-label="Chapitre suivant"]');
    const rect = footer.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2);
    const before = scroll.scrollTop;
    scroll.scrollTop = scroll.scrollHeight;
    return { height: innerHeight, footerTop: rect.top, footerBottom: rect.bottom,
      footerButtonAccessible: hit?.closest("button") === button,
      contentHeight: scroll.clientHeight, contentScrollable: scroll.scrollTop > before };
  });
  assert(landscape.footerTop >= 0 && landscape.footerBottom <= landscape.height + 1, JSON.stringify(landscape));
  assert(landscape.contentHeight > 0 && landscape.contentScrollable, JSON.stringify(landscape));
  assert.equal(landscape.footerButtonAccessible, true);
  await click("Chapitre suivant");
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Greenhouse");
  assert.deepEqual(await page.$$eval("[data-book-entry]", buttons => buttons.map(button => button.dataset.bookEntry)), ["concours-greenhouse-0", "concours-greenhouse-1"]);
  await layout();
  record("landscape-note-scrolls-with-footer-visible-and-clickable", "844x390");

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  for (const scenario of ["null", "unavailable", "empty"]) {
    await openBook(scenario);
    assert.equal(await countNotes(), 0);
    assert.equal(await page.$$eval(contentsToggle, elements => elements.length), 0);
    await openChapter("concours", "outdoor");
    assert.equal(await countNotes(), 0);
    await page.click('[data-book-entry="concours-outdoor-0"]');
    assert.equal(await countNotes(), 0);
    record(`offer-${scenario}-never-advertised`, 390);
  }
  await openBook();
  await expandContentsBonus();
  await page.evaluate(() => window.__setOffer(null));
  await page.waitForFunction(() => !document.querySelector("[data-contest-bundle-note]"));
  assert.equal(await page.$$eval(contentsToggle, elements => elements.length), 0);
  record("offer-removal-clears-existing-announcement", 390);
  }

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  assert.deepEqual(postRequests(), [], "Reading the checklist must not attribute a reward");

  await openBook();
  await expandContentsBonus();
  readFixture.rewards.progress = progressScenarios.partial;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(() => document.querySelector('progress[aria-label="Fleurs achetées au seuil requis"]')?.value === 2);
  await checkProgress("partial");
  readFixture.rewards.progress = progressScenarios.ready;
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await page.waitForFunction(() => document.querySelector('progress[aria-label="Fleurs achetées au seuil requis"]')?.value === 7);
  await checkProgress("ready");
  assert.equal(postRequests().length, 0);
  record("returning-from-payment-refreshes-paid-progress-with-readonly-get", 390);

  await openBook("ready", undefined, "legacy");
  await expandContentsBonus();
  await checkProgress("legacy");
  record("historical-beneficiary-cannot-claim-another-bonus", 390);

  await openBook("ready", undefined, "ready");
  await expandContentsBonus();
  holdReads = true;
  const staleReadStarted = new Promise(resolve => { onHeldRead = resolve; });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await staleReadStarted;
  await clickClaim(true);
  await page.waitForFunction(() => document.querySelector('[data-contest-bundle-note]')?.textContent.includes("Bonus déjà débloqué"));
  assert.equal(postRequests().length, 1, "Two immediate clicks must produce one POST");
  holdReads = false;
  const staleResponse = page.waitForResponse(response => response.url().endsWith("/api/account/contest-bundle-rewards") && response.request().method() === "GET");
  for (const release of heldReadReleases.splice(0)) release();
  await (await staleResponse).json();
  await settleAnimations();
  assert.match(await noteText(), /Bonus déjà débloqué/, "An older GET cannot reverse a successful attribution");
  assert.equal(await claimButtons(), 0);
  await click("Voir la fleur Concours Indoor 2");
  await page.waitForFunction(() => document.querySelector("h2")?.textContent === "Concours Indoor 2");
  assert.match(await noteText(), /Bonus déjà débloqué/);
  assert.equal(await claimButtons(), 0);
  await click("Table des matières");
  assert.match(await noteText(), /Bonus déjà débloqué/);
  assert.equal(postRequests().length, 1);
  record("explicit-claim-is-once-and-rewarded-state-survives-cross-culture-navigation", 390);
  record("stale-read-response-cannot-overwrite-successful-claim", 390);

  await openBook("ready", undefined, "ready");
  await expandContentsBonus();
  claimFixture.status = 503;
  await clickClaim();
  await page.waitForSelector('[data-contest-bundle-note] [role="alert"]');
  assert.match(await noteText(), /Attribution momentanément indisponible/);
  assert.doesNotMatch(await noteText(), /Bonus déjà débloqué/);
  assert.equal(await claimButtons(), 1);
  claimFixture = { status: 200, rewards: { ...offer, progress: progressScenarios.ready, receipts: [] } };
  await clickClaim();
  await page.waitForFunction(() => document.querySelector('[data-contest-bundle-note] [role="alert"]')?.textContent.includes("pas encore été attribué"));
  assert.equal(await claimButtons(), 1);
  claimFixture.rewards.progress = progressScenarios.rewarded;
  await clickClaim();
  await page.waitForFunction(() => document.querySelector('[data-contest-bundle-note]')?.textContent.includes("Bonus déjà débloqué"));
  assert.equal(postRequests().length, 4);
  await layout();
  record("failed-or-unconfirmed-claim-can-be-retried-without-false-success", 390);

  await openBook("ready", undefined, "ready");
  await expandContentsBonus();
  claimFixture.status = 401;
  await clickClaim();
  await page.waitForSelector('[data-contest-bundle-note] [role="alert"]');
  assert.match(await noteText(), /Reconnecte-toi/);
  assert.doesNotMatch(await noteText(), /Bonus déjà débloqué/);
  record("expired-session-claim-prompts-login-without-crediting-reward", 390);
  assert.equal(postRequests().length, 5);
  await openBook("ready", undefined, "partial");
  await expandContentsBonus();
  readFixture.status = 401;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForFunction(() => document.querySelector('[data-contest-bundle-note]')?.textContent.includes("Connecte-toi pour voir ta progression"));
  await checkProgress("anonymous");
  record("expired-session-read-clears-personal-checklist", 390);
  for (const request of apiRequests) {
    assert(["GET", "POST"].includes(request.method));
    assert.equal(request.url, "/api/account/contest-bundle-rewards");
    assert.equal(request.body, "");
  }
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(browserErrors, []);
  await writeFile(resolve(output, claimsOnly ? "claims-report.json" : "report.json"), JSON.stringify({ passed: true, widths, results, apiRequests, externalRequests, browserErrors }, null, 2));
  console.log(`Contest bundle notebook audit passed: ${results.length} checks.`);
} finally {
  await browser?.close();
  await server.close();
}
