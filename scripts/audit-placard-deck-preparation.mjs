/** Real components, preparation model and in-memory culture transport. No remote calls or database. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd(), output = resolve(root, "output/placard-deck-preparation");
const port = Number(process.env.DECK_PREPARATION_AUDIT_PORT ?? 3395), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from"react";import{createRoot}from"react-dom/client";import"/src/app/globals.css";
import{KanabQuestDicePrototype}from"/src/components/placard/KanabQuestDicePrototype";
import{KqDeckPreparation}from"/src/components/placard/KqDeckPreparation";
import{createKqTutorialApi,KqTutorialApiProvider}from"/src/components/placard/KqTutorialApiContext";
import{getKqPreparationStartingXp}from"/src/lib/kanab-quest-deck-preparation";
import{createReleveCultureTransport}from"/src/lib/kanab-quest-releve-culture";
import{createKqReleveProduction,applyKqReleveProductionAction,suggestKqRelevePlan}from"/src/lib/kanab-quest-releve-production";
import{getKqCampaignParticipants}from"/src/lib/kanab-quest-campaign";
import{startKqGame,KQ_ACTIVE_CARDS,KQ_BUDDIES}from"/src/lib/kanab-quest-game";
import{KQ_HERITAGE_CARDS}from"/src/lib/kanab-quest-heritage";
import retro from"/src/components/contest/ArenaRetro.module.css";
const scenario=new URLSearchParams(location.search).get('scenario')||'official';
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const storage={persistent:memory(),session:memory()};
const candidates=KQ_ACTIVE_CARDS.filter(card=>!['pbi','substrate'].includes(card.category)&&card.rarity!=='epic').map(card=>card.code);
const inventory=Object.fromEntries(candidates.map(code=>[code,3]));
const doubleDeck=[...candidates.slice(0,9),candidates[0]];
window.__calls=[];window.__pending=[];
if(scenario.startsWith('panel-')){
 const kind=scenario.slice(6),deck=kind==='empty'?[]:kind==='large'?candidates.slice(0,13):kind==='expensive'?['BOTTE-039','BOTTE-039']:doubleDeck;
 const stock=['loading','error'].includes(kind)?null:kind==='missing'?{[candidates[0]]:1}:kind==='expensive'?{'BOTTE-039':2}:inventory;
 const heritage=KQ_HERITAGE_CARDS.find(card=>card.effect==='starting-xp-two');
 const buddies=[KQ_BUDDIES[0],KQ_BUDDIES.find(card=>card.advantageLevel>0)];
 const xp=kind==='unknown'?null:kind==='expensive'?1:getKqPreparationStartingXp({source:'official',buddieCodes:buddies.map(card=>card.code),heritageCard:heritage,chanvrierStrength:'green-thumb'});
 window.__fixture={deck,stock,xp,expectedXp:1+2+Math.max(...buddies.map(card=>card.advantageLevel))+2+2};
 window.__localChecks=['local','tutorial'].map(source=>{const base=source==='local'?2:1;const input={source,buddieCodes:[buddies[1].code],heritageCard:heritage,chanvrierStrength:undefined,localBaseXp:base};return {source,forecast:getKqPreparationStartingXp(input),actual:startKqGame(2,{varietyCode:buddies[1].code,startingXp:base,heritageCode:heritage.code,heritageCard:heritage}).xp};});
 createRoot(document.getElementById('root')).render(<div className={retro.surface}><main style={{maxWidth:960,margin:'auto',padding:12}}><KqDeckPreparation deckCodes={deck} inventory={stock} startingXp={xp} loading={kind==='loading'} error={kind==='error'?'Stock indisponible':''}/></main></div>);
}else{
 let production=createKqReleveProduction();const act=action=>production=applyKqReleveProductionAction(production,action);
 act({type:'draft',warehouse:suggestKqRelevePlan(production,scenario==='campaign'?2:1)});act({type:'save-plan'});
 for(let index=0;index<3;index++)act({type:'reveal-buddie'});
 const zones=production.warehouse.zones;
 zones.forEach((zone,index)=>act({type:'assign',zoneId:zone.id,buddieCode:production.ownedBuddies[index]}));act({type:'save-plan'});
 production={...production,heritageCode:scenario==='unknown-heritage'?'HERITAGE-999':scenario==='absent-heritage'?'HERITAGE-006':production.heritageCode};
 const transport=createReleveCultureTransport({getState:()=>production,setState:next=>{production=next;window.__production=next;}});
 const pending=new Map();let equipmentMode=scenario==='equipment-pending'?'pending':scenario==='equipment-invalid'?'invalid':'known';
 let bootstrapMode=scenario==='stock-loading'?'pending':scenario==='stock-error'?'error':'known';
 const request=async(input,init)=>{const url=new URL(String(input),location.origin),path=url.pathname,method=init?.method||'GET';window.__calls.push({path,method,signal:init?.signal});
  if(path.endsWith('/equipment')){if(equipmentMode==='pending'){const id=window.__calls.length;window.__pending.push(id);return await new Promise(resolve=>pending.set(id,resolve));}if(equipmentMode==='error')return Response.json({error:'indisponible'},{status:503});if(equipmentMode==='invalid')return Response.json({strength:'not-a-strength'});if(equipmentMode==='green')return Response.json({strength:'green-thumb'});}
  if(path.endsWith('/bootstrap')){if(bootstrapMode==='pending'){window.__bootstrapPending=true;return await new Promise(resolve=>pending.set('bootstrap',resolve));}if(bootstrapMode==='error')return Response.json({error:'Stock indisponible'},{status:503});if(bootstrapMode==='collection-error'){const payload=await(await transport(input,init)).json();return Response.json({...payload,collection:null});}if(scenario==='heritage-unavailable'){const payload=await(await transport(input,init)).json();return Response.json({...payload,heritage:null});}}
  if(path.includes('/contracts'))return Response.json({error:'Not in fixture'},{status:404});
  return transport(input,init);
 };
 const api=createKqTutorialApi(request);api.isTutorial=false;
 window.__control={equipment:mode=>{equipmentMode=mode;api.notify('kq:equipment-updated');},resolve:(id,strength)=>{pending.get(id)?.(Response.json({strength}));pending.delete(id);},bootstrap:async()=>{bootstrapMode='known';pending.get('bootstrap')?.(await transport('/api/arena/placard/bootstrap'));window.__bootstrapPending=false;},stock:mode=>{bootstrapMode=mode;api.notify('kq:collection-updated');},refresh:()=>api.notify('kq:collection-updated')};
 const participants=getKqCampaignParticipants(production.warehouse,production.revision);
 window.__fixture={deck:production.deckCodes,heritageCode:production.heritageCode,participants:participants.map(member=>member.buddieCode),expectedXp:getKqPreparationStartingXp({source:'official',buddieCodes:participants.map(member=>member.buddieCode),heritageCard:KQ_HERITAGE_CARDS.find(card=>card.code===production.heritageCode),chanvrierStrength:null}),expectedXpWithoutHeritage:getKqPreparationStartingXp({source:'official',buddieCodes:participants.map(member=>member.buddieCode),heritageCard:null,chanvrierStrength:null}),stock:production.supportInventory};window.__production=production;
 createRoot(document.getElementById('root')).render(<div className={retro.surface}><KqTutorialApiProvider api={api}><KanabQuestDicePrototype apiScope="player" initialCampaign showAdminOperations={false} showWarehouseNavigation={false} initialPreparation={{deckCodes:production.deckCodes,heritageCode:production.heritageCode}} isolatedStorage={storage}/></KqTutorialApiProvider></div>);
}
`;
const modules = {
  entry,
  "next/image": `import React from"react";export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==="string"?src:src.src} style={{...(fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:{}),...props.style}}/>}`,
  "next/link": `import React from"react";export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  "next/navigation": `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  "next/dynamic": `import React from"react";export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"), publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lucide-react", "@3d-dice/dice-box-threejs"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: "deck-preparation-audit", enforce: "pre", resolveId(id) { if (id in modules) return "\0" + id; },
    async load(id) { if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.split("?")[0] !== "/") return next(); res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Préparation du deck · audit isolé</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [];
let browser, page;
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  page = await browser.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true); page.on("request", request => { const url = new URL(request.url()); if (["data:", "blob:"].includes(url.protocol)) return void request.continue(); if (url.origin !== origin || url.pathname.startsWith("/api/")) { forbiddenRequests.push(request.url()); return void request.abort(); } void request.continue(); });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  const cards = '[data-setup-choice="cards"]', panel = '[data-deck-preparation]';
  const text = selector => page.$eval(selector, element => element.textContent);
  async function load(scenario = "official") { await page.goto(`${origin}/?scenario=${scenario}`, { waitUntil: "networkidle0" }); await page.evaluate(() => document.fonts.ready); if (!scenario.startsWith("panel-")) { await page.waitForSelector(`${cards} > summary`); await page.focus(`${cards} > summary`); await page.keyboard.press("Enter"); } await page.waitForSelector(panel, { visible: true }); }
  async function layout() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal page overflow"); }
  async function shot(name) { await page.$eval(panel, element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - 16, behavior: 'instant' })); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: resolve(output, name + ".png"), fullPage: false }); }
  async function waitXp(expected) { await page.waitForFunction(value => document.querySelector('[data-deck-starting-xp]').textContent.startsWith(value === null ? 'À vérifier' : value + ' XP'), {}, expected); }
  async function button(label) { const handle = await page.evaluateHandle(value => [...document.querySelectorAll('button')].find(button => button.textContent.includes(value)), label); assert(handle.asElement(), `Button exists: ${label}`); await handle.asElement().focus(); await page.keyboard.press('Enter'); }

  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000, isMobile: width < 700, hasTouch: width < 700 }); await load();
    const expectedXp = await page.evaluate(() => window.__fixture.expectedXp); assert.notEqual(expectedXp, null, 'The prepared fixture has a known Buddie and Heritage'); await waitXp(expectedXp);
    assert((await text('[data-deck-opening-hand]')).startsWith('10'));
    assert.equal(await page.evaluate(() => window.__calls.filter(call => call.path.endsWith('/equipment')).length), 1, 'One initial equipment lookup');
    assert.equal(await page.$eval('[data-deck-compatibility]', element => element.open), false);
    assert((await text(panel)).includes('XP sont partagés'));
    assert(await page.$eval('[data-recommended-deck]', element => Boolean(element.compareDocumentPosition(document.querySelector('#inventory-carousel-title')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Quick action precedes the inventory');
    await layout(); await shot(`preparation-${width}`);
    await page.focus('[data-deck-compatibility] > summary'); await page.keyboard.press('Enter');
    assert.equal(await page.$$eval(`${panel} [role="meter"]`, elements => elements.length), 6); await layout(); await shot(`compatibility-${width}`);
    const filters = `${cards} details:has([aria-label="Filtrer par catégorie"])`;
    await page.focus(`${filters} > summary`); await page.keyboard.press('Enter');
    await page.focus(`${filters} [aria-label="Filtrer par catégorie"] button:nth-child(3)`); await page.keyboard.press('Enter');
    await page.focus(`${filters} select`); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.focus(`${filters} > summary`); await page.keyboard.press('Enter');
    assert.equal(await page.$eval(filters, element => element.open), false); assert((await text(`${filters} > summary`)).includes('Savoir-faire')); assert(!(await text(`${filters} > summary`)).includes('Catégorie · rareté'));
    await page.focus(`${filters} > summary`); await page.keyboard.press('Enter'); await page.focus(`${filters} [aria-label="Filtrer par catégorie"] button:first-child`); await page.keyboard.press('Enter'); await page.select(`${filters} select`, 'all'); await page.focus(`${filters} > summary`); await page.keyboard.press('Enter');
    await button('Garder comme favori'); await button('Retirer les cartes'); assert((await text('[data-deck-copies]')).startsWith('0')); await button('Reprendre mon favori'); assert((await text('[data-deck-copies]')).startsWith('10'));
    await page.focus('[data-recommended-deck]'); await page.keyboard.press('Enter');
    assert((await text('[data-deck-copies]')).startsWith('10')); assert.equal(await page.evaluate(() => window.__production.game), null, 'Review and deck changes never start a culture');
    results.push({ scenario: 'compact preparation, keyboard details, favorite and explicit recommendation', width });
  }
  const forecast = await page.evaluate(() => window.__fixture.expectedXp);
  await page.focus('[data-culture-start-review]'); await page.keyboard.press('Enter'); await page.waitForSelector('[data-culture-confirm-start]:not(:disabled)'); await page.focus('[data-culture-confirm-start]'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__production.game !== null);
  assert.equal(await page.evaluate(() => window.__production.game.xp), forecast, 'The actual engine launch matches the displayed preparation XP');
  assert.equal(await page.evaluate(() => window.__production.game.usedCards.length), 0);
  results.push({ scenario: 'confirmed real launch', forecastXp: forecast, actualXp: forecast });
  const runningGame = await page.evaluate(() => JSON.stringify(window.__production.game));
  await page.evaluate(() => window.__control.stock('pending')); await page.waitForFunction(() => window.__bootstrapPending === true);
  assert.equal(await page.$(cards), null, 'Stock refresh does not reopen preparation during a culture');
  await page.evaluate(() => window.__control.bootstrap()); await page.waitForFunction(() => window.__bootstrapPending === false);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__production.game)), runningGame, 'Stock refresh preserves the actual run, hand, phase and used copies');
  assert.equal(await page.$(cards), null); results.push({ scenario: 'collection refresh during a running culture preserves the game' });

  await page.setViewport({ width: 390, height: 1000 });
  await load('equipment-pending'); await waitXp(null);
  const first = await page.evaluate(() => window.__pending.at(-1));
  await page.evaluate(() => window.__control.equipment('green')); const base = await page.evaluate(() => window.__fixture.expectedXp); await waitXp(base + 2);
  await page.evaluate(id => window.__control.resolve(id, null), first); await waitXp(base + 2);
  assert(await page.evaluate(() => window.__calls.find(call => call.path.endsWith('/equipment')).signal.aborted), 'The stale equipment request was aborted');
  await page.evaluate(() => window.__control.equipment('pending')); await waitXp(null); const second = await page.evaluate(() => window.__pending.at(-1));
  await page.evaluate(() => window.__control.equipment('error')); await waitXp(null); await page.evaluate(id => window.__control.resolve(id, 'green-thumb'), second); await waitXp(null);
  await page.evaluate(() => window.__control.equipment('known')); await waitXp(base);
  results.push({ scenario: 'initial unknown, equipment refresh, invalidation, error and stale responses', raceProtected: true });

  await load('equipment-invalid'); await waitXp(null); assert((await text('[data-deck-cost-summary]')).includes('bonus confirmés')); results.push({ scenario: 'equipment-invalid', unknownPreserved: true });
  for (const scenario of ['unknown-heritage', 'absent-heritage']) {
    await load(scenario); await waitXp(await page.evaluate(() => window.__fixture.expectedXpWithoutHeritage));
    assert.equal(await page.$eval('[data-preparation-heritage]', element => element.dataset.preparationHeritage), '', 'Confirmed absence removes the stale heritage without selecting a replacement');
    assert((await text('[data-preparation-adjusted]')).includes('Héritage indisponible'), 'The preparation explains the removal');
    await shot(scenario); results.push({ scenario, confirmedAbsenceExplained: true, xpWithoutUnavailableBonus: true });
  }
  await load('heritage-unavailable'); await waitXp(null);
  assert.equal(await page.$eval('[data-preparation-heritage]', element => element.dataset.preparationHeritage), await page.evaluate(() => window.__fixture.heritageCode), 'Unknown catalogue retains the chosen heritage');
  assert.equal(await page.$('[data-preparation-adjusted]'), null, 'Unknown catalogue does not invent a removal');
  assert((await text('[data-deck-cost-summary]')).includes('bonus confirmés')); await shot('heritage-unavailable');
  results.push({ scenario: 'heritage-unavailable', choicePreserved: true, unknownXpPreserved: true });
  await load('campaign'); assert.equal(await page.evaluate(() => window.__fixture.participants.length), 2); await waitXp(await page.evaluate(() => window.__fixture.expectedXp)); results.push({ scenario: 'campaign XP uses the strongest participant' });
  await load(); await page.evaluate(() => window.__control.stock('pending')); await page.waitForFunction(() => document.querySelector('[data-deck-opening-hand]').textContent.startsWith('À vérifier')); assert((await text('[data-deck-stock-status]')).includes('Vérification')); assert.equal(await page.$eval('[data-recommended-deck]', element => element.disabled), true); assert((await text('[data-deck-copies]')).startsWith('10')); await page.evaluate(() => window.__control.bootstrap()); await page.waitForFunction(() => document.querySelector('[data-deck-opening-hand]').textContent.startsWith('10')); results.push({ scenario: 'real stock loading resolves without inventing zero or erasing selection' });
  await page.evaluate(() => window.__control.stock('collection-error')); await page.waitForFunction(() => document.querySelector('[data-deck-stock-status]')?.textContent.includes('indisponible')); assert((await text('[data-deck-opening-hand]')).startsWith('À vérifier')); assert((await text('[data-deck-copies]')).startsWith('10')); assert.equal(await page.$eval('[data-recommended-deck]', element => element.disabled), true); results.push({ scenario: 'collection-only failure preserves chosen copies and shows unknown stock' });
  await page.evaluate(() => window.__control.stock('error')); await page.waitForSelector('[data-culture-selection] [role="alert"]'); assert((await text('[data-culture-selection]')).includes('Stock indisponible')); assert.equal(await page.$(panel), null, 'The failed full bootstrap uses the existing global error screen instead of displaying stale preparation'); results.push({ scenario: 'real bootstrap failure blocks stale preparation' });

  for (const scenario of ['duplicates', 'large', 'empty', 'missing', 'loading', 'error', 'unknown', 'expensive']) {
    await load('panel-' + scenario); const fixture = await page.evaluate(() => window.__fixture);
    if (!['unknown', 'expensive'].includes(scenario)) assert.equal(fixture.xp, fixture.expectedXp, 'Real heritage + strength + maximum Buddie XP');
    if (scenario === 'duplicates') { assert((await text('[data-deck-copies]')).startsWith('10')); assert((await text('[data-deck-copies]')).includes('9 références')); }
    if (scenario === 'large') { assert((await text('[data-deck-opening-hand]')).startsWith('10')); assert((await text(panel)).includes('13 choisies')); }
    if (scenario === 'empty') { assert((await text('[data-deck-opening-hand]')).startsWith('0')); assert((await text('[data-deck-cost-summary]')).includes('sans carte')); }
    if (['missing', 'loading', 'error'].includes(scenario)) assert((await text('[data-deck-opening-hand]')).startsWith('À vérifier'));
    if (scenario === 'missing') assert((await text('[data-deck-stock-status]')).includes('9 copies manquantes'));
    if (scenario === 'expensive') { assert((await text('[data-deck-cost-summary]')).includes('0 copies')); assert((await text('[data-deck-cost-summary]')).includes('2 demandent plus')); assert(!(await text(panel)).includes('injouable')); }
    for (const item of await page.evaluate(() => window.__localChecks)) assert.equal(item.forecast, item.actual, item.source + ' starting XP matches actual engine');
    await layout(); results.push({ scenario: 'panel ' + scenario, localAndTutorialXpMatchEngine: true });
  }
  assert.deepEqual(errors, [], 'No browser exceptions'); assert.deepEqual(forbiddenRequests, [], 'No API or external network');
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: true, fixturesOnly: true, scenarios: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ success: true, scenarios: results.length, output }));
} catch (error) { await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: false, error: error.stack, results, errors, forbiddenRequests }, null, 2)); console.error(error.stack); process.exitCode = 1;
} finally { await browser?.close(); await server.close(); }
