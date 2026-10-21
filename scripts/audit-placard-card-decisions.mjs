/** Real game/trial components and engine, local inventory fixtures only. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd(), output = resolve(root, "output/placard-card-decisions");
const port = Number(process.env.CARD_DECISIONS_AUDIT_PORT ?? 3291), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from"react";import{createRoot}from"react-dom/client";import"/src/app/globals.css";
import{KanabQuestDicePrototype}from"/src/components/placard/KanabQuestDicePrototype";
import{KqGuidedTrial}from"/src/components/placard/KqGuidedTrial";
import{startKqGame,getKqHandCodes,KQ_ACTIVE_CARDS,KQ_CARDS,KQ_RETIRED_CARDS,KQ_HAND_SIZE,playKqCard,resolveKqStage}from"/src/lib/kanab-quest-game";
import{createKqCareState}from"/src/lib/kanab-quest-care";
import{getKqCardPlayPreview}from"/src/lib/kanab-quest-card-preview";
import{KqSupportCardView}from"/src/components/placard/KqGameCards";
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
let game=startKqGame(2026,{deckCodes:deck,collectionCodes:Object.keys(inventory).filter(code=>inventory[code]>0),startingXp:10,...(scenario.includes("reserve")?{heritageCode:heritage.code}:{})});

if(["reaction","random","worse","assisted","xp"].includes(scenario)){
 const code=scenario==="reaction"?"BOTTE-021":scenario==="random"?"BOTTE-006":scenario==="xp"?"BOTTE-005":"BOTTE-037";
 const actualDeck=[code,...candidates.filter(value=>value!==code).slice(0,9)];
 game={...startKqGame(91,{rulesVersion:3,deckCodes:actualDeck,varietyCode:"HH2026-020"}),
  situationCodes:["SIT-001","SIT-002","SIT-003","SIT-004","SIT-005","SIT-006"],stageIndex:scenario==="xp"?0:1,phase:scenario==="xp"?"prepare":"rolled",
  dice:scenario==="xp"?null:scenario==="worse"||scenario==="assisted"?[2,2,2]:[2,4,5],
  pressure:0,handCodes:actualDeck,care:{...createKqCareState(),vitality:scenario==="assisted"?1:60},xp:scenario==="xp"?0:10,quality:4,
  ...(scenario==="worse"||scenario==="assisted"?{heritageCode:"HERITAGE-006",heritageUsed:false}:{})};
 window.__targetCard=code;window.__expectedPreview=getKqCardPlayPreview(game,KQ_CARDS.find(card=>card.code===code),inventory[code]);
}
window.__initialGame=structuredClone(game);
window.__expectedPlayed=code=>playKqCard(window.__initialGame,code);
window.__expectedResolved=code=>resolveKqStage(playKqCard(window.__initialGame,code));
const repository=createLocalKqRepository(storage);await repository.saveGame(game);await repository.saveInventory(inventory);await repository.saveOnboardingSeen(true);
await repository.saveFavoriteDeck({buddieCode:game.varietyCode,supportCodes:deck.slice(0,2)});
const lesson=createKqPlayableLesson("culture",storage,snapshot=>{window.__snapshot=snapshot;window.__hand=getKqHandCodes(snapshot.game);});
lesson.initialGame=game;lesson.setupOpen=scenario==="setup";lesson.repository=repository;
window.__fixture={deck,inventory,handSize:KQ_HAND_SIZE,trialDeckSize:KQ_TRIAL_DECK.length};window.__storage=storage;
if(scenario==="guided")sessionStorage.setItem(kqTrialStorageKey("ten-card-audit"),JSON.stringify({version:KQ_TRIAL_VERSION,actions:[{type:"check",value:"notebook"},{type:"next"}]}));
createRoot(document.getElementById("root")).render(<div className={retro.surface}>{scenario==="zero"?<KqSupportCardView card={KQ_RETIRED_CARDS.find(card=>card.code==="BOTTE-001")} state={game} copies={1} handCopies={0} deckCopies={0} onPlay={()=>{}} compact/>:scenario==="guided"?<KqGuidedTrial userId="ten-card-audit" onPause={()=>{}} onComplete={()=>{}} busy={false} error=""/>:<KanabQuestDicePrototype tutorial={lesson} apiScope="player" viewMode="game" showWarehouseNavigation={false} showAdminOperations={false}/>}</div>);
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
    name: "card-decisions-audit", enforce: "pre",
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

  async function openDecisionHand() {
    await page.waitForSelector("[data-culture-hand] > summary");
    await page.focus("[data-culture-hand] > summary"); await page.keyboard.press("Enter");
    await page.waitForSelector(row,{visible:true});
  }
  async function closeInspection() { await page.keyboard.press("Escape"); await page.waitForSelector("[data-app-dialog]",{hidden:true}); }
  async function inspect(code) {
    const selector=`[data-action-card="${code}"]`;
    await page.focus(selector); await frames();
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("data-action-card")),code,"The intended card receives keyboard focus before inspection");
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-culture-card-cost]",{visible:true});
  }
  for (const width of [320,390,1440]) {
    await page.setViewport({width,height:1000,isMobile:width<700,hasTouch:width<700});
    await load(); await openDecisionHand(); await layout();
    assert.equal(await page.$eval('[data-hand-filter="playable"]',e=>e.getAttribute("aria-pressed")),"true");
    assert.equal(await page.$$eval(`${row} [data-card-playable="false"]`,cards=>cards.length),0);
    const playableCount=await page.$eval('[data-playable-card-count]',e=>Number(e.dataset.playableCardCount));
    assert.equal(await page.$$eval(`${row} [data-action-card]`,cards=>cards.length),playableCount);
    assert.equal(await page.$eval('[data-hand-redraw]',e=>e.disabled),true,"A ten-copy deck cannot waste a redraw on the same ten copies");
    assert.match(await page.$eval('[data-hand-redraw-reason]',e=>e.textContent),/1 changement restant.*déjà dans ta main/);
    const first=await page.$eval(`${row} [data-card-playable="true"]`,e=>e.dataset.actionCard);
    const geometry=await page.$eval(`${row} [data-action-card]`,e=>{const art=e.querySelector('[data-game-card-artwork]').getBoundingClientRect(),status=e.querySelector('[data-card-status]').getBoundingClientRect();return{height:e.getBoundingClientRect().height,statusAboveArt:status.bottom<=art.top+1,artHeight:art.height}});
    assert(geometry.statusAboveArt&&geometry.artHeight>150,"Status and illustration both stay visible");
    assert(geometry.height<650,"The card no longer requires a long vertical rule sheet");
    await inspect(first); assert.equal(await page.$eval('[data-culture-confirm-card]',e=>e.disabled),false);
    assert.equal(await page.$eval('[data-card-play-preview]',e=>e.dataset.cardPlayPreview),"preparation","Before-roll inspection never reveals a future result");
    await closeInspection();
    assert.equal(await page.evaluate(()=>window.__snapshot.game.usedCards.length),0);
    await page.focus('[data-hand-filter="all"]');await page.keyboard.press("Enter");await page.focus(row);
    assert.equal(await inspectAllCards(),10);
    const blocked=await page.$eval(`${row} [data-card-playable="false"]`,e=>e.dataset.actionCard);
    await inspect(blocked);
    assert.equal(await page.$eval('[data-culture-confirm-card]',e=>e.disabled),true);
    assert((await page.$eval('[data-card-blocked-reason]',e=>e.textContent)).length>4);
    assert.equal(await page.$('[data-card-play-preview]'),null);
    await page.$eval('[data-culture-confirm-card]',e=>e.click());
    assert.equal(await page.evaluate(()=>window.__snapshot.game.usedCards.length),0,"Inspecting and attempting the disabled action never consumes a card");
    await layout();await shot(`blocked-${width}`);await closeInspection();
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("data-action-card")),blocked,"Keyboard inspection returns to its opener");
    await page.click('[data-hand-filter="playable"]');await shot(`hand-${width}`);
    results.push({scenario:"filter, compact hand and blocked inspection",width,playableCount,cardHeight:geometry.height,keyboard:true,noConsumption:true});
  }
  for (const width of [320,390]) {
    await page.setViewport({width,height:1000,isMobile:true,hasTouch:true});
    await load();
    async function tap(selector) {
      await page.$eval(selector,e=>e.scrollIntoView({block:"center",inline:"center"}));await frames();
      const point=await page.$eval(selector,e=>{const box=e.getBoundingClientRect();return{x:box.left+box.width/2,y:box.top+box.height/2};});
      assert(await page.evaluate(({selector,x,y})=>Boolean(document.elementFromPoint(x,y)?.closest(selector)),{selector,...point}),"The tap target is visible above the fixed action bar");
      await page.touchscreen.tap(point.x,point.y);
    }
    await tap('[data-culture-hand] > summary');
    await page.waitForFunction(()=>document.querySelector('[data-culture-hand]').open);
    await tap(`${row} [data-card-playable="true"]`);
    await page.waitForSelector('[data-culture-card-cost]',{visible:true});
    await tap('[data-app-dialog] > header button');await page.waitForSelector('[data-app-dialog]',{hidden:true});
    assert.equal(await page.evaluate(()=>window.__snapshot.game.usedCards.length),0);
    results.push({scenario:"real touch opens the hand and inspects a card",width,noConsumption:true});
  }
  await page.setViewport({width:390,height:1000,isMobile:true,hasTouch:true});
  await load("duplicates");await openDecisionHand();await page.click('[data-hand-filter="all"]');
  assert.equal(await page.$$eval(`${row} [data-action-card]`,cards=>cards.length),9);
  assert.match(await page.$eval('[data-hand-filter="all"]',e=>e.textContent),/Toutes\s*9/);
  assert((await page.$eval(row,e=>e.textContent)).includes("Main ×2"));
  results.push({scenario:"distinct filters preserve duplicate-copy counts"});

  await load("xp");await openDecisionHand();
  assert.equal(await page.$eval('[data-hand-filter="all"]',e=>e.getAttribute("aria-pressed")),"true");
  assert.equal(await page.$eval('[data-hand-filter="playable"]',e=>e.disabled),true);
  assert.match(await page.$eval('[data-card-choice-hint]',e=>e.textContent),/manque.*XP/);
  await inspect("BOTTE-005");assert.equal(await page.$eval('[data-culture-confirm-card]',e=>e.disabled),true);await closeInspection();
  results.push({scenario:"no XP defaults to all cards and explains the cause"});

  for(const width of [320,390,1440]) {
    await page.setViewport({width,height:1000,isMobile:width<700,hasTouch:width<700});
    await load("reaction");await openDecisionHand();await inspect("BOTTE-021");
    await page.waitForSelector('[data-card-play-preview="deterministic"]');
    const expected=await page.evaluate(()=>window.__expectedPreview);
    assert.equal(expected.kind,"deterministic");
    assert.match(await page.$eval('[data-preview-result="before"]',e=>e.textContent),/Réussite/);
    assert.match(await page.$eval('[data-preview-result="after"]',e=>e.textContent),/Réussite exceptionnelle/);
    await page.click('[data-card-play-preview] details > summary');
    const numbers=await page.$eval('[data-card-play-preview]',e=>e.textContent);
    assert(numbers.includes(`${expected.before.health} /100`)&&numbers.includes(`${expected.after.health} /100`));
    assert(numbers.includes(`${expected.after.xpAfterPlay} XP`)&&numbers.includes(`${expected.after.xpAfterValidation} XP`));
    await layout();await shot(`comparison-${width}`);await closeInspection();
    assert.equal(await page.evaluate(()=>window.__snapshot.game.usedCards.length),0);
    await inspect("BOTTE-021");await page.click('[data-culture-confirm-card]');await page.waitForSelector('[data-app-dialog]',{hidden:true});
    await page.waitForFunction(()=>window.__snapshot.game.usedCards.includes("BOTTE-021"));
    assert.equal(await page.evaluate(()=>window.__snapshot.game.xp),expected.after.xpAfterPlay);
    assert.equal(await page.evaluate(()=>JSON.parse(window.__storage.getItem("kanab-quest-botte-inventory-v1"))["BOTTE-021"]),1);
    assert.equal(await page.evaluate(()=>document.activeElement===document.body),false,"Playing a filtered card retains a meaningful focus target");
    await page.click('[data-culture-primary-action]');await page.waitForFunction(()=>window.__snapshot.game.phase==="resolved");
    const actual=await page.evaluate(()=>({health:window.__snapshot.game.care.vitality,quality:window.__snapshot.game.quality,xp:window.__snapshot.game.xp,pressure:window.__snapshot.game.pressure}));
    assert.deepEqual(actual,{health:expected.after.health,quality:expected.after.quality,xp:expected.after.xpAfterValidation,pressure:expected.after.pressure},"Confirmed play and validation match the displayed conditional result");
    results.push({scenario:"deterministic comparison and real card play",width,exactResult:true,oneCopyConsumed:true});
  }
  await page.setViewport({width:390,height:1000,isMobile:true,hasTouch:true});
  await load("random");await openDecisionHand();await inspect("BOTTE-006");
  assert.equal(await page.$eval('[data-card-play-preview]',e=>e.dataset.cardPlayPreview),"random");
  assert.equal(await page.$('[data-preview-result]'),null);await closeInspection();
  assert.equal(await page.evaluate(()=>window.__snapshot.game.usedCards.length),0);
  results.push({scenario:"random reaction never exposes a future dice result"});

  await load("worse");await openDecisionHand();await inspect("BOTTE-037");
  assert.match(await page.$eval('[data-preview-result="before"]',e=>e.textContent),/Réussite/);
  assert.match(await page.$eval('[data-preview-result="after"]',e=>e.textContent),/Fragile/);
  await shot("worse-390");await closeInspection();results.push({scenario:"a card can honestly produce a worse outcome"});

  await load("assisted");await openDecisionHand();await inspect("BOTTE-037");
  await page.waitForSelector('[data-card-teaching-assistance]');assert.equal(await page.$('[data-preview-result]'),null);
  await page.click('[data-culture-confirm-card]');await page.waitForSelector('[data-app-dialog]',{hidden:true});
  await page.waitForFunction(()=>window.__snapshot.game.usedCards.includes("BOTTE-037"));
  assert.equal(await page.evaluate(()=>window.__snapshot.game.care.vitality),100);
  results.push({scenario:"tutorial assistance is disclosed without an incorrect fatal forecast"});

  await load("zero");await page.waitForSelector('[data-action-card="BOTTE-001"]');
  const zero=await page.$eval('[data-action-card="BOTTE-001"]',e=>e.textContent);
  assert(zero.includes("0 XP")&&!zero.includes("∞"));results.push({scenario:"an isolated historical zero-cost card displays 0 XP"});

  await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"no-preference"}]);
  await load();await openDecisionHand();
  const busyCard=await page.$eval(`${row} [data-card-playable="true"]`,e=>e.dataset.actionCard);
  await page.click('[data-culture-primary-action]');
  await page.waitForSelector('[data-culture-primary-action][aria-busy="true"]');
  await page.$eval(`[data-action-card="${busyCard}"]`,e=>e.click());
  await page.waitForSelector('[data-culture-confirm-card]');
  assert.equal(await page.$eval('[data-culture-confirm-card]',e=>e.disabled),true);
  assert.equal(await page.$('[data-card-play-preview]'),null);
  await page.$eval('[data-culture-confirm-card]',e=>e.click());
  assert.equal(await page.evaluate(()=>window.__snapshot.game.usedCards.length),0);
  await closeInspection();
  await page.waitForFunction(()=>window.__snapshot.game.phase==="rolled");
  results.push({scenario:"dice animation allows inspection but prevents spending and forecast"});

  assert.deepEqual(errors, [], "No browser exceptions");
  assert.deepEqual(forbiddenRequests, [], "No API or external request");
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: true, fixturesOnly: true, scenarios: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ success: true, scenarios: results.length, output }));
} catch (error) {
  await page?.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: false, error: error.stack, results, errors, forbiddenRequests }, null, 2));
  console.error(error.stack); process.exitCode = 1;
} finally { await browser?.close(); await server.close(); }
