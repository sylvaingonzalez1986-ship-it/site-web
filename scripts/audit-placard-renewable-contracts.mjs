/**
 * Browser audit of the real renewable contract UI, with local API fixtures.
 * No account, environment file, real API, or database is contacted.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/placard-renewable-contracts");
const port = Number(process.env.RENEWABLE_CONTRACT_AUDIT_PORT ?? 3286);
const origin = `http://127.0.0.1:${port}`;
const entry = `
import React,{useState}from"react";import{createRoot}from"react-dom/client";
import"/src/app/globals.css";
import{KqRenewableContracts}from"/src/components/placard/KqRenewableContracts";
import{KqGameSoundProvider,useKqGameSound}from"/src/components/placard/KqGameSound";
import{createKqTutorialApi,KqTutorialApiProvider}from"/src/components/placard/KqTutorialApiContext";
import retro from"/src/components/contest/ArenaRetro.module.css";
const query=new URLSearchParams(location.search),scenario=query.get("scenario")||"available",mode=query.get("mode")||"missions";
const runId="40000000-0000-4000-8000-000000000001";
const previousId="50000000-0000-4000-8000-000000000001";
const offers=[
 {code:"steady-hand",minimumQuality:10,maxCardsUsed:2,rewardCents:1500},
 {code:"pure-grower",minimumQuality:8,maxCardsUsed:0,rewardCents:1000},
 {code:"fine-flower",minimumQuality:12,maxCardsUsed:null,rewardCents:2000},
];
if(scenario==="server-values")offers[0]={code:"steady-hand",minimumQuality:11,maxCardsUsed:1,rewardCents:1777};
const terminal=["succeeded","failed","claimed","replayed","ambiguous-claim","late"];
let current=terminal.includes(scenario)?{...offers[0],id:previousId,status:scenario==="failed"?"failed":scenario==="claimed"?"claimed":"succeeded",runId,quality:scenario==="failed"?7:11,cardsUsed:2,reason:null}:scenario==="active"?{...offers[1],id:previousId,status:"active",runId,quality:null,cardsUsed:null,reason:null}:null;
let completedCount=scenario==="claimed"?2:scenario==="locked"?0:1,broken=false,credited=0;
window.__fixture={offers,requests:[],notifications:[],busy:[],opened:0,claimed:0,scenario};
const board=()=>({version:2,unlocked:scenario!=="locked",canAccept:scenario!=="locked"&&(!current||["failed","claimed","cancelled"].includes(current.status)),reason:scenario==="locked"?"Termine Main légère pour découvrir ces contrats.":null,offers,current,completedCount});
window.__fixture.board=board;
const request=async(input,init={})=>{
 const path=String(input),method=init.method||"GET";
 window.__fixture.requests.push({path,method,...(init.body?{command:JSON.parse(init.body)}:{})});
 if(path!=="/api/arena/placard/contracts/board")throw new Error("Unexpected local fixture API: "+path);
 if(window.__fixture.transientFailure)return Response.json({error:"Temporary failure after legacy response"},{status:503});
 if(scenario==="legacy")return Response.json({error:"Not found"},{status:404});
 if(scenario==="unavailable"&&!window.__fixture.recovered)return Response.json({error:"Le comptoir est momentanément indisponible."},{status:503});
 if(method==="GET"){
  if(scenario==="malformed"&&!window.__fixture.recovered)return Response.json({...board(),offers:offers.map((offer,index)=>index===0?{...offer,rewardCents:-1}:offer)});
  return Response.json(board());
 }
 const command=JSON.parse(init.body);
 if(scenario==="late")await new Promise(resolve=>{window.__releaseAction=resolve;});
 if(command.action==="accept"){
  const offer=offers.find(offer=>offer.code===command.code);
  if(!offer)return Response.json({error:"Offre inconnue."},{status:400});
  if(current&&current.id===command.attemptId)return Response.json({board:board(),receipt:null,replayed:true});
  if(!board().canAccept)return Response.json({error:"Un contrat est déjà en cours."},{status:409});
  current={...offer,id:command.attemptId,status:"accepted",runId:null,quality:null,cardsUsed:null,reason:null};
  if(scenario==="ambiguous-accept"&&!broken){broken=true;throw new TypeError("Network response lost after commit");}
  return Response.json({board:board(),receipt:null,replayed:false});
 }
 if(command.action==="cancel"){
  if(current?.id!==command.attemptId||current.status!=="accepted")return Response.json({error:"Ce contrat ne peut plus être annulé."},{status:409});
  current={...current,status:"cancelled"};
  return Response.json({board:board(),receipt:null,replayed:false});
 }
 if(command.action==="claim"){
  if(current?.id!==command.attemptId||!["succeeded","claimed"].includes(current.status))return Response.json({error:"Prime indisponible."},{status:409});
  const replayed=current.status==="claimed"||scenario==="replayed";
  current={...current,status:"claimed",cashAfterCents:100000+current.rewardCents};
  if(!replayed){credited+=current.rewardCents;completedCount++;window.__fixture.claimed++;}
  window.__fixture.credited=credited;
  if(scenario==="ambiguous-claim"&&!broken){broken=true;throw new TypeError("Network response lost after credit");}
  return Response.json({board:board(),receipt:{...current},replayed});
 }
 return Response.json({error:"Commande inconnue."},{status:400});
};
const api=createKqTutorialApi(request);api.isTutorial=false;
window.__refreshBoard=()=>api.notify("kq:contracts-updated");
const notify=api.notify;api.notify=(name,detail)=>{window.__fixture.notifications.push(name);notify(name,detail);};
function Content(){const sound=useKqGameSound();return <><div data-audit-controls><button data-audit-sound aria-pressed={sound.enabled} onClick={sound.toggle}>Son {sound.enabled?"actif":"coupé"}</button></div><KqRenewableContracts mode={mode} runId={mode==="run"?(query.get("mismatch")?"90000000-0000-4000-8000-000000000001":runId):undefined} disabled={query.get("disabled")==="1"} onBusyChange={busy=>window.__fixture.busy.push(busy)} onOpenGame={()=>window.__fixture.opened++}/></>}
function Audit(){const[mounted,setMounted]=useState(true);window.__unmount=()=>setMounted(false);return <div className={retro.surface+" "+retro.shell} data-audit-ready>{mounted?<KqGameSoundProvider><KqTutorialApiProvider api={api}><Content/></KqTutorialApiProvider></KqGameSoundProvider>:<p data-audit-unmounted>Unmounted</p>}</div>}
createRoot(document.getElementById("root")).render(<Audit/>);
`;
const modules = {
  entry,
  "next/image": `import React from"react";export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==="string"?src:src.src} style={{...(fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:{}),...props.style}}/>}`,
  "next/link": `import React from"react";export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  "next/navigation": `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}[data-audit-ready]{max-width:1200px;margin:auto;padding:16px}[data-audit-controls]{margin-bottom:16px}[data-audit-controls]button{min-height:44px;padding:8px 14px;border:2px solid #172923;border-radius:12px;color:#172923;background:#fff1d6;font:700 13px Body}button:focus-visible{outline:3px solid #169b8b;outline-offset:3px}`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"), publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lucide-react"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "renewable-contract-audit", enforce: "pre",
    resolveId(id) { if (id in modules) return "\0" + id; },
    async load(id) {
      if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code;
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contrats renouvelables · audit isolé</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [];
let browser, page;
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  page = await browser.newPage(); page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return void request.continue();
    if (url.origin !== origin || url.pathname.startsWith("/api/")) { forbiddenRequests.push(request.url()); return void request.abort(); }
    void request.continue();
  });
  await page.evaluateOnNewDocument(() => {
    window.__audioAudit = { contexts: 0, notes: 0 };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__audioAudit.contexts++; }
      createOscillator() { window.__audioAudit.notes++; return super.createOscillator(); }
    };
  });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  async function frames() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
  async function load(scenario, query = "") {
    await page.goto(`${origin}/?scenario=${scenario}${query}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-audit-ready]");
    await page.evaluate(() => document.fonts.ready);
  }
  async function quiet() { assert.equal(await page.evaluate(() => window.__audioAudit.notes), 0, "No autoplay or replayed reward sound"); }
  async function layout(name) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: no horizontal overflow`); }
  async function shot(name) { await page.evaluate(() => Promise.allSettled([...document.images].map(image => image.decode()))); await page.screenshot({ path: resolve(output, name + ".png"), fullPage: true }); }
  async function optIn() { await page.focus("[data-audit-sound]"); await page.keyboard.press("Enter"); await page.waitForFunction(() => document.querySelector("[data-audit-sound]").getAttribute("aria-pressed") === "true"); }
  const posts = () => page.evaluate(() => window.__fixture.requests.filter(request => request.method === "POST"));
  const accept = '[data-renewable-action="accept"]';

  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await load("available");
    await page.waitForSelector("[data-renewable-offer]");
    await quiet(); await layout(`available-${width}`);
    assert.equal(await page.$$eval("[data-renewable-offer]", items => items.length), 3, "All three offered difficulties are visible");
    const offers = await page.evaluate(() => window.__fixture.offers);
    for (const offer of offers) {
      const text = await page.$eval(`[data-renewable-offer="${offer.code}"]`, element => element.textContent);
      assert(text.includes(String(offer.minimumQuality)), `${offer.code}: offered quality threshold`);
      assert(text.includes((offer.rewardCents / 100).toLocaleString("fr-FR")), `${offer.code}: server-offered reward`);
      if (offer.maxCardsUsed === 0) assert(/aucune|sans|0/.test(text.toLowerCase()), "Zero support cards is explicit");
      else if (offer.maxCardsUsed !== null) assert(text.includes(String(offer.maxCardsUsed)), `${offer.code}: card limit`);
    }
    await shot(`offers-${width}`);
    if (width === 320) await page.evaluate(() => Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true }));
    await page.focus(accept); await page.keyboard.press("Enter");
    await page.waitForSelector('[data-renewable-action="cancel"]');
    const commands = await posts();
    assert.equal(commands.length, 1, "Keyboard activation accepts once");
    assert.match(commands[0].command.attemptId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "Acceptance has a stable UUID");
    assert.equal(commands[0].command.action, "accept");
    await layout(`accepted-${width}`); await shot(`accepted-${width}`);
    await page.focus('[data-renewable-action="cancel"]'); await page.keyboard.press("Enter");
    await page.waitForSelector("[data-renewable-offer]");
    assert.equal((await posts())[1].command.attemptId, commands[0].command.attemptId, "Cancellation names the accepted attempt");
    results.push({ scenario: "offers, keyboard acceptance and cancellation", width, exactServerRules: true, ...(width === 320 ? { withoutNativeRandomUuid: true } : {}) });

    await load("succeeded"); await page.waitForSelector('[data-renewable-action="claim"]'); await quiet(); await optIn();
    if (width === 390) await page.$eval('[data-renewable-action="claim"]', button => { button.click(); button.click(); });
    else { await page.focus('[data-renewable-action="claim"]'); await page.keyboard.press("Enter"); }
    await page.waitForSelector("[data-renewable-receipt]");
    await page.waitForFunction(() => window.__audioAudit.notes > 0);
    assert.equal(await page.$eval("[data-renewable-receipt]", element => element.dataset.receiptFresh), "true", "New claim has a fresh receipt");
    assert.equal(await page.evaluate(() => window.__fixture.claimed), 1);
    assert.equal((await posts()).length, 1);
    assert.equal(await page.$eval("[data-renewable-receipt]", element => element.getAnimations({ subtree: true }).length), 0, "Reduced-motion preference removes receipt animation");
    await layout(`receipt-${width}`); await shot(`receipt-${width}`);
    results.push({ scenario: "fresh claim", width, once: true, reducedMotion: true });
  }

  await page.setViewport({ width: 390, height: 1000 });
  for (const scenario of ["locked", "legacy"]) {
    await load(scenario); await frames();
    assert.equal(await page.$("[data-kq-renewable-contracts]"), null, `${scenario}: unavailable board stays out of the UI`);
    await quiet(); assert.equal((await posts()).length, 0);
    results.push({ scenario, hidden: true });
  }
  for (const scenario of ["unavailable", "malformed"]) {
    await load(scenario); await page.waitForSelector('[data-renewable-action="retry"]');
    assert.equal(await page.$('[data-renewable-action="accept"]'), null, "An unavailable or invalid snapshot offers no invented fallback contract");
    await page.evaluate(() => { window.__fixture.recovered = true; });
    await page.click('[data-renewable-action="retry"]'); await page.waitForSelector("[data-renewable-offer]");
    results.push({ scenario: `${scenario} service can be refreshed`, passed: true });
  }
  await load("legacy"); await frames();
  assert.equal(await page.$("[data-kq-renewable-contracts]"), null);
  await page.evaluate(() => { window.__fixture.transientFailure = true; window.__refreshBoard(); });
  await page.waitForSelector('[data-renewable-action="retry"]');
  assert.equal(await page.$('[data-renewable-action="accept"]'), null);
  results.push({ scenario: "transient failure after a missing RPC stays visible", passed: true });
  await load("server-values"); await page.waitForSelector('[data-renewable-offer="steady-hand"]');
  const serverText = await page.$eval('[data-renewable-offer="steady-hand"]', element => element.textContent);
  assert(serverText.includes("17,77") && serverText.includes("11") && serverText.includes("1"), "Thresholds, card limits and exact euro amount come from the server response");
  await page.click('[data-renewable-offer="steady-hand"] [data-renewable-action="accept"]');
  await page.waitForSelector('[data-renewable-action="cancel"]');
  assert((await page.$eval("[data-kq-renewable-contracts]", element => element.textContent)).includes("17,77"), "Accepted attempt preserves the server's offered reward");
  results.push({ scenario: "server rules remain authoritative", passed: true });

  await load("failed"); await page.waitForSelector("[data-renewable-offer]");
  await shot("failed-390");
  await page.click('[data-renewable-offer="fine-flower"] [data-renewable-action="accept"]');
  await page.waitForSelector('[data-renewable-action="cancel"]');
  assert.equal((await posts())[0].command.code, "fine-flower", "A failed attempt permits choosing a different difficulty");
  assert.notEqual((await posts())[0].command.attemptId, "50000000-0000-4000-8000-000000000001");
  results.push({ scenario: "failed attempt followed by a different choice", passed: true });

  for (const scenario of ["replayed", "claimed"]) {
    await load(scenario); await optIn();
    if (scenario === "replayed") { await page.waitForSelector('[data-renewable-action="claim"]'); await page.click('[data-renewable-action="claim"]'); }
    await page.waitForSelector("[data-renewable-receipt]");
    assert.notEqual(await page.$eval("[data-renewable-receipt]", element => element.dataset.receiptFresh), "true");
    await frames(); await quiet(); await shot(`${scenario}-390`);
    assert.equal(await page.evaluate(() => window.__fixture.claimed), 0, "No new attribution on replay");
    results.push({ scenario: `${scenario} receipt`, noNewReward: true });
  }

  for (const scenario of ["ambiguous-accept", "ambiguous-claim"]) {
    await load(scenario); await optIn();
    const action = scenario === "ambiguous-accept" ? accept : '[data-renewable-action="claim"]';
    await page.waitForSelector(action); await page.click(action);
    await page.waitForSelector('[data-renewable-action="retry"]');
    const mutations = await page.$$eval('[data-renewable-action="accept"],[data-renewable-action="claim"],[data-renewable-action="cancel"]', buttons => buttons.filter(button => !button.disabled).length);
    assert.equal(mutations, 0, "Uncertain response requires authoritative refresh before another mutation");
    await quiet();
    await page.click('[data-renewable-action="retry"]');
    await page.waitForSelector(scenario === "ambiguous-accept" ? '[data-renewable-action="cancel"]' : "[data-renewable-receipt]");
    assert.equal((await posts()).length, 1, "Refresh reconciles a committed operation without another POST");
    if (scenario === "ambiguous-claim") {
      assert.notEqual(await page.$eval("[data-renewable-receipt]", element => element.dataset.receiptFresh), "true");
      assert.equal(await page.evaluate(() => window.__fixture.claimed), 1);
    }
    await quiet(); results.push({ scenario, reconciledByRead: true });
  }

  await load("active", "&mode=run"); await page.waitForSelector("[data-kq-renewable-contracts]");
  assert.equal(await page.$('[data-renewable-action="claim"]'), null, "A running culture cannot claim a reward");
  assert.equal(await page.$('[data-renewable-action="cancel"]'), null, "A running culture cannot cancel its contract");
  const activeText = await page.$eval("[data-kq-renewable-contracts]", element => element.textContent);
  assert(!/NaN|undefined/.test(activeText)); assert(activeText.includes("—"), "Missing progress is unknown, never zero");
  await layout("active"); await shot("active-390");
  await load("active", "&mode=run&mismatch=1"); await frames();
  assert.equal(await page.$("[data-kq-renewable-contracts]"), null, "A different run does not show this contract");
  results.push({ scenario: "active contract belongs to its exact run", passed: true });

  await load("available", "&disabled=1"); await page.waitForSelector("[data-renewable-offer]");
  assert(await page.$$eval('[data-renewable-action="accept"]', buttons => buttons.length === 3 && buttons.every(button => button.disabled)), "Busy preparation disables all accept actions");
  results.push({ scenario: "disabled parent blocks acceptance", passed: true });

  await load("late"); await page.waitForSelector('[data-renewable-action="claim"]'); await optIn();
  await page.click('[data-renewable-action="claim"]'); await page.waitForFunction(() => typeof window.__releaseAction === "function");
  await page.evaluate(() => window.__unmount()); await page.waitForSelector("[data-audit-unmounted]");
  await page.evaluate(() => window.__releaseAction()); await frames(); await quiet();
  assert.deepEqual(await page.evaluate(() => window.__fixture.notifications), [], "Late response cannot dispatch a hidden reward");
  assert.equal(await page.evaluate(() => window.__fixture.busy.at(-1)), false, "Unmount releases the preparation lock");
  results.push({ scenario: "late unmounted claim", silent: true, lockReleased: true });

  assert.deepEqual(errors, [], "No browser exceptions");
  assert.deepEqual(forbiddenRequests, [], "No real API or external requests");
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: true, fixturesOnly: true, scenarios: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ success: true, scenarios: results.length, output }));
} catch (error) {
  await page?.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: false, error: error.stack, results, errors, forbiddenRequests }, null, 2));
  console.error(error.stack); process.exitCode = 1;
} finally { await browser?.close(); await server.close(); }
