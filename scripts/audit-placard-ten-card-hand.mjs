/** Real game/trial components and engine, local inventory fixtures only. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd(), output = resolve(root, "output/placard-ten-card-hand");
const port = Number(process.env.TEN_CARD_HAND_AUDIT_PORT ?? 3289), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from"react";import{createRoot}from"react-dom/client";import"/src/app/globals.css";
import{KanabQuestDicePrototype}from"/src/components/placard/KanabQuestDicePrototype";
import{KqGuidedTrial}from"/src/components/placard/KqGuidedTrial";
import{startKqGame,getKqHandCodes,KQ_ACTIVE_CARDS,KQ_CARDS,KQ_HAND_SIZE}from"/src/lib/kanab-quest-game";
import{KQ_HERITAGE_CARDS}from"/src/lib/kanab-quest-heritage";
import{createLocalKqRepository}from"/src/lib/kanab-quest-repository";
import{createKqPlayableLesson}from"/src/lib/kanab-quest-playable-lesson";
import{kqTrialStorageKey,KQ_TRIAL_VERSION,KQ_TRIAL_DECK}from"/src/lib/kanab-quest-trial";
import retro from"/src/components/contest/ArenaRetro.module.css";
const query=new URLSearchParams(location.search),scenario=query.get("scenario")||"hand";
const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
const candidates=KQ_ACTIVE_CARDS.filter(card=>!["pbi","substrate"].includes(card.category)&&card.rarity!=="epic").map(card=>card.code);
const deck=scenario==="reserve"?candidates.slice(0,13):scenario==="short-reserve"?candidates.slice(0,11):scenario==="setup"?candidates.slice(0,4):scenario==="duplicates"?[...candidates.slice(0,9),candidates[0]]:candidates.slice(0,10);
const inventory=Object.fromEntries(KQ_CARDS.map(card=>[card.code,KQ_ACTIVE_CARDS.includes(card)?2:0]));
const heritage=KQ_HERITAGE_CARDS.find(card=>card.effect==="opening-hand-reserve");
const game=startKqGame(2026,{deckCodes:deck,collectionCodes:Object.keys(inventory).filter(code=>inventory[code]>0),startingXp:10,...(scenario.includes("reserve")?{heritageCode:heritage.code}:{})});
const repository=createLocalKqRepository(storage);await repository.saveGame(game);await repository.saveInventory(inventory);await repository.saveOnboardingSeen(true);
await repository.saveFavoriteDeck({buddieCode:game.varietyCode,supportCodes:deck.slice(0,2)});
const lesson=createKqPlayableLesson("culture",storage,snapshot=>{window.__snapshot=snapshot;window.__hand=getKqHandCodes(snapshot.game);});
lesson.initialGame=game;lesson.setupOpen=scenario==="setup";lesson.repository=repository;
window.__fixture={deck,inventory,handSize:KQ_HAND_SIZE,trialDeckSize:KQ_TRIAL_DECK.length};window.__storage=storage;
if(scenario==="guided")sessionStorage.setItem(kqTrialStorageKey("ten-card-audit"),JSON.stringify({version:KQ_TRIAL_VERSION,actions:[{type:"check",value:"notebook"},{type:"next"}]}));
createRoot(document.getElementById("root")).render(<div className={retro.surface}>{scenario==="guided"?<KqGuidedTrial userId="ten-card-audit" onPause={()=>{}} onComplete={()=>{}} busy={false} error=""/>:<KanabQuestDicePrototype tutorial={lesson} apiScope="player" viewMode="game" showWarehouseNavigation={false} showAdminOperations={false}/>}</div>);
`;
const modules = {
  entry,
  "next/image": `import React from"react";export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==="string"?src:src.src} style={{...(fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:{}),...props.style}}/>}`,
  "next/link": `import React from"react";export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  "next/navigation": `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  "next/dynamic": `import React from"react";export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"), publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lucide-react", "@3d-dice/dice-box-threejs"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "ten-card-hand-audit", enforce: "pre",
    resolveId(id) { if (id in modules) return "\0" + id; },
    async load(id) { if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => {
      if (req.url?.split("?")[0] !== "/") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Main de dix cartes · audit isolé</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);
    }); },
  }], server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [];
let browser, page;
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  page = await browser.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (["data:", "blob:"].includes(url.protocol)) return void request.continue();
    if (url.origin !== origin || url.pathname.startsWith("/api/")) { forbiddenRequests.push(request.url()); return void request.abort(); }
    void request.continue();
  });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  const row = "[data-culture-hand-cards]";
  async function frames() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
  async function load(scenario = "hand") { await page.goto(`${origin}/?scenario=${scenario}`, { waitUntil: "networkidle0" }); await page.evaluate(() => document.fonts.ready); }
  async function layout() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "The page does not overflow horizontally"); }
  async function openHand() {
    await page.waitForSelector("[data-culture-hand] > summary"); await page.focus("[data-culture-hand] > summary"); await page.keyboard.press("Enter");
    await page.waitForSelector(row, { visible: true }); await page.focus(row);
    await page.click('[data-hand-filter="all"]'); await page.focus(row);
    assert.equal(await page.evaluate(() => window.__fixture.handSize), 10);
    assert.equal(await page.evaluate(() => window.__hand.length), 10, "This is an actual ten-copy hand from the engine");
    assert((await page.$eval("[data-hand-capacity]", element => element.textContent)).startsWith("10 / 10"));
  }
  async function shot(name) {
    await page.evaluate(() => Promise.allSettled([...document.images].map(image => image.decode())));
    await page.screenshot({ path: resolve(output, name + ".png"), fullPage: true });
  }
  async function inspectAllCards() {
    const seen = new Set();
    for (let step = 0; step < 22; step++) {
      const current = await page.$eval(row, element => {
        const bounds = element.getBoundingClientRect();
        return { left: element.scrollLeft, max: element.scrollWidth - element.clientWidth,
          visible: [...element.querySelectorAll("[data-action-card]")].filter(card => {
            const box = card.getBoundingClientRect();
            return Math.min(box.right, bounds.right) - Math.max(box.left, bounds.left) >= box.width * .65;
          }).map(card => card.dataset.actionCard) };
      });
      current.visible.forEach(code => seen.add(code));
      if (current.left >= current.max - 2) break;
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction((selector, before) => document.querySelector(selector).scrollLeft > before + 1, {}, row, current.left);
      await frames();
    }
    const all = await page.$$eval(`${row} [data-action-card]`, cards => cards.map(card => card.dataset.actionCard));
    assert.deepEqual([...seen].sort(), [...all].sort(), "Every card, including disabled ones, is reachable with the horizontal keyboard controls");
    assert.equal(await page.$eval(row, element => document.activeElement === element), true, "Keyboard scrolling retains the region focus");
    const maximumGap = await page.$$eval(`${row} [data-action-card]`, cards => Math.max(...cards.slice(1).map((card, index) => card.getBoundingClientRect().left - cards[index].getBoundingClientRect().right)));
    assert(maximumGap <= 16, "Cards keep a compact, consistent gap");
    return all.length;
  }

  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000, isMobile: width < 700, hasTouch: width < 700 });
    await load(); await openHand(); await layout();
    assert.equal(await inspectAllCards(), 10, "Ten distinct owned cards stress the full layout");
    await shot(`hand-last-${width}`);
    await page.$eval(row, element => { element.scrollLeft = 0; }); await frames();
    await shot(`hand-first-${width}`);
    const playable = await page.$(`${row} [data-action-card][data-card-playable="true"]`);
    assert(playable, "The fixture has a legal card to verify the confirmation");
    await playable.focus(); await page.keyboard.press("Enter");
    await page.waitForSelector("[data-culture-card-cost]", { visible: true });
    assert((await page.$eval("[data-culture-card-cost]", element => element.textContent)).includes("XP"), "The real XP cost remains visible before spending a copy");
    await layout(); await page.keyboard.press("Escape"); await page.waitForSelector("[data-app-dialog]", { hidden: true });
    assert.equal(await page.evaluate(() => window.__snapshot.game.usedCards.length), 0, "Inspection never consumes cards");
    results.push({ scenario: "ten distinct cards", width, keyboard: true, allReachable: true, costsPreserved: true });
  }

  await page.setViewport({ width: 390, height: 1000 });
  await load("duplicates"); await openHand();
  assert.equal(await page.$$eval(`${row} [data-action-card]`, cards => cards.length), 9, "Duplicate copies share one card face");
  assert((await page.$eval(row, element => element.textContent)).includes("Main ×2"), "The doubled owned copy remains explicit");
  await inspectAllCards(); await layout(); await shot("duplicates-390");
  results.push({ scenario: "ten copies across nine references", actualCopies: true });

  for (const [scenario, count] of [["reserve", 13], ["short-reserve", 11]]) {
    await load(scenario); await openHand(); await layout();
    assert((await page.$eval("[data-culture-hand]", element => element.textContent)).includes(`Main prévoyante · ${count} cartes vues`), "The seen-card count uses the actual hand and reserve");
    results.push({ scenario, seenCards: count });
  }

  await load("setup"); await page.waitForSelector('[data-setup-choice="cards"] > summary');
  assert((await page.$eval('[data-setup-choice="cards"] > summary', element => element.textContent)).includes("4 cartes"), "Existing preparation stays unchanged until an explicit action");
  await page.click('[data-setup-choice="cards"] > summary');
  await page.waitForSelector('[data-setup-choice="cards"] [data-recommended-deck]', { visible: true });
  await page.focus('[data-setup-choice="cards"] [data-recommended-deck]'); await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-setup-choice="cards"] > summary').textContent.includes("10 cartes"));
  const selection = await page.evaluate(() => JSON.parse(window.__storage.getItem("preparation")).cards);
  assert.equal(selection.length, 10);
  const owned = await page.evaluate(() => window.__fixture.inventory);
  for (const code of new Set(selection)) assert(selection.filter(value => value === code).length <= owned[code], "The suggestion never adds an unowned copy");
  assert((await page.$eval('[data-setup-choice="cards"]', element => element.textContent)).includes("10 cartes de ta collection"));
  await layout(); await shot("recommended-deck-390");
  await page.$$eval('[data-setup-choice="cards"] button', buttons => buttons.find(button => button.textContent.includes("Reprendre mon favori")).click());
  await page.waitForFunction(() => document.querySelector('[data-setup-choice="cards"] > summary').textContent.includes("2 cartes"));
  results.push({ scenario: "explicit recommended deck and unchanged favorite", ownedCopiesOnly: true });

  await load("guided"); await page.waitForSelector('[data-trial-chapter="1"]', { visible: true });
  const guidedText = await page.$eval('[data-trial-chapter="1"]', element => element.textContent);
  assert(guidedText.includes("jusqu’à 10 cartes") && !guidedText.includes("jusqu’à 5 cartes"));
  assert(guidedText.includes(`${await page.evaluate(() => window.__fixture.trialDeckSize)} cartes Botte du Chanvrier`));
  await layout(); await shot("guided-copy-390");
  results.push({ scenario: "guided trial states the current capacity and actual deck size", passed: true });

  assert.deepEqual(errors, [], "No browser exceptions");
  assert.deepEqual(forbiddenRequests, [], "No API or external request");
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: true, fixturesOnly: true, scenarios: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ success: true, scenarios: results.length, output }));
} catch (error) {
  await page?.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: false, error: error.stack, results, errors, forbiddenRequests }, null, 2));
  console.error(error.stack); process.exitCode = 1;
} finally { await browser?.close(); await server.close(); }
