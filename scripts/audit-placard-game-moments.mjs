/**
 * Real harvest, contract, mission and sound components. All game/API values are
 * local fixtures; requests outside this Vite origin are rejected. No env or DB.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/placard-game-moments");
const port = Number(process.env.MOMENTS_AUDIT_PORT ?? 3284);
const origin = `http://127.0.0.1:${port}`;
const entry = `
import React,{useState}from"react";import{createRoot}from"react-dom/client";
import"/src/app/globals.css";
import{KqHarvestMoment}from"/src/components/placard/KqHarvestMoment";
import{KqCultureContract}from"/src/components/placard/KqCultureContract";
import{KqMissionCenter}from"/src/components/placard/KqMissionCenter";
import{KqGameSoundProvider,useKqGameSound}from"/src/components/placard/KqGameSound";
import{createKqTutorialApi,KqTutorialApiProvider}from"/src/components/placard/KqTutorialApiContext";
import{startKqGame,advanceKqStage,resolveKqStage}from"/src/lib/kanab-quest-game";
import{createKqWarehouseStarter,getKqWarehouseQuote}from"/src/lib/kanab-quest-warehouse";
import{getKqCampaignParticipants,getKqCampaignMemberState}from"/src/lib/kanab-quest-campaign";
import{KQ_MISSION_DEFINITIONS as definitions}from"/src/lib/kanab-quest-missions";
import retro from"/src/components/contest/ArenaRetro.module.css";
const query=new URLSearchParams(location.search),kind=query.get("kind")||"harvest",scenario=query.get("scenario")||"solo";
const runId="40000000-0000-4000-8000-000000000001";
window.__fixture={requests:[],notifications:[],continues:0};
const solo={...startKqGame(2026,{varietyCode:"HH2026-002"}),phase:"complete",quality:14,harvestGrams:184.5,harvestTierVersion:2,completedAt:"2026-10-20T11:00:00.000Z"};
const initial=createKqWarehouseStarter();
const plan=getKqWarehouseQuote({...initial,zones:[
 {...initial.zones[0],id:"a",buddieCode:"HH2026-002"},
 {...initial.zones[0],id:"b",x:4,width:2,buddieCode:"HH2026-003",optionCodes:["SIM-CLIMATE-03","SIM-NUTRITION-03"]},
]},initial).nextState;
const members=getKqCampaignParticipants(plan,4).map((member,index)=>({...member,runId:"40000000-0000-4000-8000-00000000000"+(index+1)}));
let campaign={...startKqGame(300,{varietyCode:members[0].buddieCode,warehouse:members[0].warehouse,cultivationProfile:members[0].cultivationProfile}),campaign:{version:1,id:"50000000-0000-4000-8000-000000000001",leaderRunId:runId,members}};
while(campaign.phase!=="complete")campaign={...advanceKqStage(resolveKqStage({...campaign,phase:"rolled",dice:[6,6,6]})),campaign:campaign.campaign};
const flower=(state,id=runId)=>({id:"flower-"+id,runId:id,varietyCode:state.varietyCode,varietyName:state.varietyName,quality:state.quality,traits:[],combos:[],stats:{},status:"available",createdAt:"2026-10-20T11:00:00.000Z",queuedAt:null,lockedAt:null,burnedAt:null});
const fixtureState=scenario==="campaign"?campaign:scenario==="dead"?{...solo,cultureDead:true,harvestGrams:0}:scenario==="unknown"?{...solo,harvestGrams:undefined}:solo;
const campaignStates=members.map(member=>getKqCampaignMemberState(campaign,member));
window.__fixture.expected={grams:scenario==="campaign"?campaignStates.reduce((sum,state)=>sum+state.harvestGrams,0):fixtureState.harvestGrams,qualities:scenario==="campaign"?campaignStates.map(state=>state.quality):[fixtureState.quality]};
const flowers=scenario==="campaign"?campaignStates.map((state,index)=>flower(state,members[index].runId)):scenario==="dead"||scenario==="unknown"?undefined:[flower(solo),flower({...solo,varietyName:"Autre récolte"},"90000000-0000-4000-8000-000000000001")];
let contract={code:"light-hand",status:scenario==="claimed"?"claimed":"succeeded",runId,quality:9,cardsUsed:2,rewardCents:3000,canAccept:false,reason:null};
let earned=false;
const missions=()=>({collectionActive:true,missions:definitions.map(d=>({code:d.code,track:d.track,step:d.step,target:d.target,progress:d.code==="first-harvest"?1:0,reward:d.reward,rewardAvailable:true,cardCount:d.reward.kind==="pack"?d.reward.cardCount:0,claimed:d.code==="first-harvest"&&earned,unlocked:d.step===1||d.code==="three-varieties"&&earned,claimable:d.code==="first-harvest"&&!earned,entitlementId:null,packAvailable:false}))});
const request=async(input,init={})=>{
 const path=String(input);window.__fixture.requests.push({path,method:init.method||"GET"});
 if(path==="/api/arena/placard/contracts/board")return Response.json({error:"Renewable contracts are outside this legacy receipt fixture."},{status:404});
 if(path==="/api/arena/placard/contracts"){
  if(init.method==="POST"){if(scenario==="late")await new Promise(resolve=>{window.__releaseAction=resolve;});contract={...contract,status:"claimed",cashAfterCents:103000,replayed:scenario==="replayed"};}
  return Response.json(contract);
 }
 if(path==="/api/arena/placard/missions"){
  if(init.method==="POST"){if(scenario==="late")await new Promise(resolve=>{window.__releaseAction=resolve;});earned=true;return Response.json({reward:{kind:"cash",amountCents:5000},cardCount:0,entitlementId:null,replayed:scenario==="replayed",cashAfterCents:105000});}
  return Response.json(missions());
 }
 if(path==="/api/account/missions")return Response.json({missions:[],pendingRewards:[]});
 throw new Error("Unexpected isolated API request: "+path);
};
const api=createKqTutorialApi(request);api.isTutorial=false;
const notify=api.notify;api.notify=(name,detail)=>{window.__fixture.notifications.push(name);notify(name,detail)};
function AudioControls(){const sound=useKqGameSound();window.__sound=sound;return <div data-audit-sound><button data-sound-toggle aria-pressed={sound.enabled} onClick={sound.toggle}>Son {sound.enabled?"actif":"coupé"}</button><button data-sound-cue onClick={()=>sound.playOnce("reward","audit-reward")}>Prime</button><button data-sound-new-cue onClick={()=>sound.playOnce("harvest","audit-harvest")}>Récolte</button><button data-sound-navigation onClick={()=>sound.playNavigation(294)}>Entrepôt</button></div>}
function Content(){return <><AudioControls/>{kind==="harvest"?<KqHarvestMoment state={fixtureState} runId={runId} flowers={flowers} fresh={query.get("fresh")!=="0"} onContinue={()=>window.__fixture.continues++}/>:kind==="contract"?<KqCultureContract mode="missions"/>:kind==="mission"?<KqMissionCenter onOpen={view=>{window.__fixture.destination=view}}/>:<p data-audit-audio-ready>Sound fixture ready</p>}</>}
function Audit(){const[mounted,setMounted]=useState(true);window.__unmount=()=>setMounted(false);return <div className={retro.surface+" "+retro.shell}>{mounted?<KqGameSoundProvider><KqTutorialApiProvider api={api}><Content/></KqTutorialApiProvider></KqGameSoundProvider>:<p data-audit-unmounted>Unmounted</p>}</div>}
createRoot(document.getElementById("root")).render(<Audit/>);
`;
const modules = {
  entry,
  "next/image": `import React from"react";export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==="string"?src:src.src} style={{...(fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:{}),...props.style}}/>}`,
  "next/link": `import React from"react";export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  "next/navigation": `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  "next/dynamic": `import React from"react";export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><Component {...props}/></React.Suspense>}`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}[data-audit-sound]{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 20px}[data-audit-sound] button{min-height:44px;background:#fff1d6;color:#172923;border:2px solid #172923;border-radius:12px;padding:8px;font:700 12px Body}[data-audit-sound] button:focus-visible{outline:3px solid #169b8b;outline-offset:3px}`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"),
  publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lucide-react"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "game-moments-audit", enforce: "pre",
    resolveId(id) { if (id in modules) return "\0" + id; },
    async load(id) {
      if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code;
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Récoltes et primes · recette locale isolée</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});

const results = [], errors = [], forbiddenRequests = [];
let browser, page;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return void request.continue();
    if (url.origin !== origin || url.pathname.startsWith("/api/")) { forbiddenRequests.push(request.url()); return void request.abort(); }
    void request.continue();
  });
  await page.evaluateOnNewDocument(() => {
    window.__audioAudit = { contexts: 0, notes: 0, closes: 0, suspends: 0 };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__audioAudit.contexts++; }
      createOscillator() { window.__audioAudit.notes++; return super.createOscillator(); }
      close() { window.__audioAudit.closes++; return super.close(); }
      suspend() { window.__audioAudit.suspends++; return super.suspend(); }
      resume() { return window.__delayResume ? new Promise((resolve, reject) => { window.__releaseResume = () => super.resume().then(resolve, reject); }) : super.resume(); }
    };
  });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  async function frames() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
  async function load(kind, scenario = "solo", extra = "") {
    await page.goto(`${origin}/?kind=${kind}&scenario=${scenario}${extra}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("[data-sound-toggle]");
    await page.evaluate(() => document.fonts.ready);
  }
  async function quiet() { assert.equal(await page.evaluate(() => window.__audioAudit.notes), 0, "No notes before explicit opt-in and game action"); }
  async function noOverflow(label) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`); }
  async function shot(name) {
    await page.evaluate(() => Promise.allSettled([...document.images].map(image => image.decode())));
    const missing = await page.$$eval("[data-harvest-moment] img, [data-contract-receipt] img", images => images.filter(image => !image.complete || !image.naturalWidth).map(image => image.src));
    assert.deepEqual(missing, [], "Moment illustrations load from local assets");
    await page.screenshot({ path: resolve(output, name + ".png"), fullPage: true });
  }
  async function optIn() { await page.focus("[data-sound-toggle]"); await page.keyboard.press("Enter"); await page.waitForFunction(() => document.querySelector("[data-sound-toggle]").getAttribute("aria-pressed") === "true"); }

  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000 });
    for (const scenario of ["solo", "campaign", "dead", "unknown"]) {
      await load("harvest", scenario);
      await page.waitForSelector("[data-harvest-moment]");
      await noOverflow(`${scenario}-${width}`);
      await quiet();
      const text = await page.$eval("[data-harvest-moment]", element => element.textContent);
      assert(!/NaN|undefined/.test(text), "No invalid metric leaks into the UI");
      if (scenario === "solo") {
        assert(text.includes("184,5"), "Saved solo harvest is displayed rather than a projection");
        assert(!text.includes("Autre récolte"), "Unrelated old flowers are excluded");
        assert(text.includes("Ta Fleur est enregistrée"), "Exactly the run's own Fleur is confirmed");
        assert(await page.$("[data-harvest-identity]"), "The solo harvest retains the variety and tier");
        await page.focus("[data-harvest-moment] button"); await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(() => window.__fixture.continues), 1, "The reserve is reachable by keyboard");
      }
      if (scenario === "campaign") {
        const expected = await page.evaluate(() => ({ grams: window.__fixture.expected.grams.toLocaleString("fr-FR", { maximumFractionDigits: 1 }), min: Math.min(...window.__fixture.expected.qualities), max: Math.max(...window.__fixture.expected.qualities) }));
        assert(text.includes(expected.grams), "The total uses the actual individual harvests");
        assert(text.includes(`${expected.min}–${expected.max}`), "Campaign quality is an interval, never a sum");
      }
      if (scenario === "dead") {
        assert(!/récolte réussie|bravo|félicitations/i.test(text), "Terminal loss does not celebrate a harvest");
        assert.equal(await page.$("[data-harvest-moment] button"), null, "A dead culture does not invite viewing a nonexistent reward");
      }
      if (scenario === "unknown") assert(text.includes("Quantité indisponible") && !text.includes("184,5"), "Missing quantity is explicitly unknown");
      if (scenario !== "solo") assert.equal(await page.$("[data-harvest-identity]"), null, "No single-variety identity is invented for a campaign or missing harvest");
      assert.equal(await page.$eval("[data-harvest-moment]", element => element.getAnimations({ subtree: true }).length), 0, "Reduced motion removes harvest animations");
      await shot(`${scenario}-${width}`);
      results.push({ scenario: `harvest ${scenario}`, width, noOverflow: true, silentOnMount: true });
    }
  }

  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await load("harvest", "solo");
  assert.notEqual(await page.$eval("[data-harvest-moment] > div", element => getComputedStyle(element).animationName), "none", "A fresh successful harvest has its finite arrival animation");
  await load("harvest", "solo", "&fresh=0");
  assert.equal(await page.$eval("[data-harvest-moment] > div", element => getComputedStyle(element).animationName), "none", "Restored harvests do not celebrate again");
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  results.push({ scenario: "fresh versus restored harvest, motion preference", passed: true });

  for (const width of [320, 390, 1440]) for (const scenario of ["succeeded", "replayed", "claimed"]) {
    await page.setViewport({ width, height: 1000 });
    await load("contract", scenario);
    await page.waitForSelector(`[data-contract-status="${scenario === "claimed" ? "claimed" : "succeeded"}"]`);
    await quiet();
    await optIn();
    if (scenario !== "claimed") {
      await page.focus('[data-contract-action="claim"]'); await page.keyboard.press("Enter");
      await page.waitForSelector('[data-contract-status="claimed"]');
    }
    await page.waitForSelector("[data-contract-receipt]");
    await frames();
    const fresh = await page.$eval("[data-contract-receipt]", element => element.dataset.receiptFresh);
    assert.equal(fresh === "true", scenario === "succeeded", "Only a newly attributed reward is celebrated");
    if (scenario === "succeeded") await page.waitForFunction(() => window.__audioAudit.notes > 0);
    else await quiet();
    await noOverflow(`contract-${scenario}`);
    await shot(`contract-${scenario}-${width}`);
    results.push({ scenario: `contract ${scenario}`, width, fresh: fresh === "true", soundOnlyOnNewReward: true });
  }

  await page.setViewport({ width: 390, height: 1000 });
  for (const kind of ["contract", "mission"]) {
    for (const scenario of ["succeeded", "replayed", "late"]) {
      if (kind === "contract" && scenario !== "late") continue;
      await load(kind, scenario);
      const action = kind === "contract" ? '[data-contract-action="claim"]' : 'section[aria-label="Culture & Buddies"] button';
      await page.waitForSelector(action);
      await quiet(); await optIn();
      await page.click(action);
      if (scenario === "late") {
        await page.waitForFunction(() => typeof window.__releaseAction === "function");
        await page.evaluate(() => window.__unmount()); await page.waitForSelector("[data-audit-unmounted]");
        await page.evaluate(() => window.__releaseAction()); await frames(); await quiet();
        assert.deepEqual(await page.evaluate(() => window.__fixture.notifications), [], "Late unmounted response has no notification or sound");
      } else {
        await page.waitForSelector("[data-mission-receipt]");
        if (scenario === "succeeded") await page.waitForFunction(() => window.__audioAudit.notes > 0);
        else await quiet();
        await noOverflow(`mission-${scenario}`);
        await shot(`mission-${scenario}-390`);
      }
      results.push({ scenario: `${kind} ${scenario} reward`, guardedSideEffects: true });
    }
  }

  await load("sound");
  assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 0, "No AudioContext created on load");
  await page.click("[data-sound-cue]"); await quiet();
  await optIn(); await page.click("[data-sound-new-cue]");
  await page.waitForFunction(() => window.__audioAudit.notes > 0);
  const notes = await page.evaluate(() => window.__audioAudit.notes);
  await page.click("[data-sound-new-cue]"); await frames();
  assert.equal(await page.evaluate(() => window.__audioAudit.notes), notes, "Replaying an id does not duplicate feedback");
  await page.click("[data-sound-toggle]");
  await page.click("[data-sound-navigation]"); await frames();
  assert.equal(await page.evaluate(() => window.__audioAudit.notes), notes, "Muted actions are silent");
  await page.reload({ waitUntil: "networkidle0" }); await quiet();
  assert.equal(await page.evaluate(() => window.__audioAudit.contexts), 0, "Reload never resumes audio automatically");
  results.push({ scenario: "audio opt-in, once-per-id, mute and reload", passed: true });

  await load("sound"); await optIn();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); document.dispatchEvent(new Event("visibilitychange")); window.__sound.playOnce("reward", "hidden"); });
  await frames(); await quiet();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await frames(); await quiet();
  results.push({ scenario: "hidden tabs do not emit or replay sounds", passed: true });

  for (const stop of ["mute", "unmount"]) {
    await load("sound");
    await page.evaluate(() => { window.__delayResume = true; });
    await page.click("[data-sound-toggle]"); await page.click("[data-sound-new-cue]");
    await page.waitForFunction(() => typeof window.__releaseResume === "function");
    if (stop === "mute") await page.click("[data-sound-toggle]");
    else { await page.evaluate(() => window.__unmount()); await page.waitForSelector("[data-audit-unmounted]"); }
    await page.evaluate(() => { window.__delayResume = false; window.__releaseResume(); });
    await frames(); await quiet();
    results.push({ scenario: `pending audio resume cancelled by ${stop}`, passed: true });
  }

  assert.deepEqual(errors, [], "No browser exceptions");
  assert.deepEqual(forbiddenRequests, [], "No external or real API requests");
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: true, fixturesOnly: true, scenarios: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ success: true, scenarios: results.length, output }));
} catch (error) {
  await page?.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: false, error: error.stack, results, errors, forbiddenRequests }, null, 2));
  console.error(error.stack); process.exitCode = 1;
} finally { await browser?.close(); await server.close(); }
