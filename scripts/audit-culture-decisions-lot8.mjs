/** Real player culture UI and engine. Every API response is local; mutations are forbidden. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd(), output = resolve(root, "output/clarity-lot8/decisions");
const visualOnly = process.argv.includes('--visual-only');
const port = Number(process.env.CULTURE_DECISIONS_LOT8_PORT ?? 3590), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from 'react'; import { createRoot } from 'react-dom/client';
import '/src/app/globals.css';
import { KanabQuestDicePrototype } from '/src/components/placard/KanabQuestDicePrototype';
import { createKqTutorialApi, KqTutorialApiProvider } from '/src/components/placard/KqTutorialApiContext';
import { startKqGame, KQ_ACTIVE_CARDS, KQ_CARDS, getKqRunProjection } from '/src/lib/kanab-quest-game';
import { getKqPlayerCardChoices } from '/src/lib/kanab-quest-player-feedback';
import { KQ_BASIC_CARE_PRICE_CENTS } from '/src/lib/kanab-quest-care';
import retro from '/src/components/contest/ArenaRetro.module.css';
const scenario = new URLSearchParams(location.search).get('scenario') || 'prepare';
const candidates = KQ_ACTIVE_CARDS.filter(card => !['pbi','substrate'].includes(card.category) && card.rarity !== 'epic' && card.xpCost > 0);
const deck = scenario === 'empty' ? [] : [
 ...candidates.filter(card => card.timing === 'before-roll').slice(0, 4),
 ...candidates.filter(card => card.timing === 'after-roll').slice(0, 6)
].map(card => card.code);
const inventory = Object.fromEntries(KQ_CARDS.map(card => [card.code, scenario === 'zero-stock' ? 0 : 3]));
const rolled = ['rolled','low-health','spent-reaction'].includes(scenario);
const game = {
 ...startKqGame(91, { rulesVersion: 3, varietyCode: 'HH2026-020', deckCodes: deck, startingXp: 10, startedAt: '2026-10-29T10:00:00Z' }),
 situationCodes: ['SIT-001','SIT-002','SIT-003','SIT-004','SIT-005','SIT-006'],
 stageIndex: 0, phase: rolled ? 'rolled' : 'prepare', dice: rolled ? [1,4,6] : null,
 handCodes: deck, pressure: 0, quality: 14, xp: scenario === 'zero-xp' ? 0 : 10,
 preparationPlayed: scenario === 'spent-preparation', reactionPlayed: scenario === 'spent-reaction'
};
if (scenario === 'low-health') game.care = { ...game.care, vitality: 5 };
const runId = 'local-lot8-run';
const run = {runId, state: game, status: 'active', buddieCode: game.varietyCode, startedAt: game.startedAt, updatedAt: game.startedAt, burnReceipts: []};
const session = {activeRun: run, activeRuns: [run], flowers: [], battles: [], progress: null, warnings: []};
const memory = () => { const data = new Map(); return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)}; };
const storage = {persistent: memory(), session: memory()}; storage.persistent.setItem('kq-dice-direct-result','1');
window.__calls = []; window.__game = game; window.__initialGame = JSON.stringify(game);
window.__fixture = {scenario, inventory, playable: getKqPlayerCardChoices(game, inventory).choices.filter(card=>card.allowed).map(card=>card.card.code), quality:getKqRunProjection(game).projectedQuality};
const request = async (input, init) => {
 const path = new URL(String(input), location.origin).pathname, method = init?.method ?? 'GET';
 window.__calls.push({path, method, body:init?.body});
 if(method !== 'GET') throw new Error('Unexpected mutation in read-only culture audit: '+method+' '+path);
 if(path.endsWith('/bootstrap')) return Response.json({collection:{ownerFound:true,collectionActive:true,inventory,availableInventory:inventory,cards:[]},ownedBuddieCodes:[game.varietyCode],heritage:{cards:[]},playerSession:session,warnings:[]});
 if(path.endsWith('/runs') || path.endsWith('/session')) return Response.json(session);
 if(path.endsWith('/rankings')) return Response.json({entries:[]});
 if(path.endsWith('/me')) return Response.json({progress:null});
 if(path.endsWith('/equipment')) return Response.json({strength:null,routePlan:null});
 if(path.endsWith('/care')) return Response.json({cashCents:12000,basicCarePriceCents:KQ_BASIC_CARE_PRICE_CENTS,inventory:[],catalog:[]});
 return Response.json({error:'Not part of this local fixture'},{status:404});
};
const api=createKqTutorialApi(request);api.isTutorial=false;
createRoot(document.getElementById('root')).render(<div className={retro.surface}><KqTutorialApiProvider api={api}><KanabQuestDicePrototype apiScope="player" initialRunId={runId} viewMode="game" showWarehouseNavigation={false} showAdminOperations={false} isolatedStorage={storage}/></KqTutorialApiProvider></div>);
`;
const modules = {
  entry,
  "next/image": `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  "next/link": `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  "next/navigation": `export const useRouter=()=>({push:()=>{},refresh:()=>{},replace:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`,
  "next/dynamic": `import React from 'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>;}`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"), publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lucide-react", "@3d-dice/dice-box-threejs"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: "culture-decisions-lot8", enforce: "pre",
    resolveId(id) { if (id in modules) return "\0" + id; },
    async load(id) { if (id.startsWith("\0") && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", { lang: "tsx", jsx: { runtime: "automatic" } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => {
      if (req.url?.split("?")[0] !== "/") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Décisions Culture · recette locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);
    }); },
  }], server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [], consoleErrors = [];
const report = {passed:false, mode:visualOnly?'visual-only':'full', results, errors, forbiddenRequests, consoleErrors, backend:"Real player presentation, in-memory GET responses only. Every mutation and external request is rejected."};
let browser, page;
const hand = '[data-culture-hand]', summary = `${hand} > summary`, cards = '[data-culture-hand-cards]', action = '[data-culture-options-action]';
try {
  await mkdir(output, {recursive:true}); await server.listen();
  browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page = await browser.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error=>errors.push(error.message));
  page.on('console', message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.setRequestInterception(true);
  page.on('request', request=>{const url=new URL(request.url());if(url.origin===origin&&url.pathname==='/favicon.ico')void request.respond({status:204});else if(['data:','blob:'].includes(url.protocol)||url.origin===origin&&!url.pathname.startsWith('/api/'))void request.continue();else{forbiddenRequests.push(request.url());void request.abort();}});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  const frames = ()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  async function enter(selector) {
    await page.$eval(selector, element=>element.scrollIntoView({block:'center',behavior:'instant'}));
    await page.focus(selector); await page.keyboard.press('Enter'); await frames();
  }
  async function visibleTarget(selector) {
    return page.$eval(selector, element=>{const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{visible:r.top>=0&&r.bottom<=innerHeight+1,uncovered:hit===element||element.contains(hit),height:r.height,top:r.top,bottom:r.bottom};});
  }
  async function noMutation() {
    assert.deepEqual(await page.evaluate(()=>window.__calls.filter(call=>call.method!=='GET')),[],'Consultation never sends a transaction');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__game)===window.__initialGame),true,'Consultation preserves the complete culture state');
  }
  async function layout() {
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal page overflow');
    const measures=await page.$$eval('[aria-label="Légende des faces de dés"] > span',elements=>elements.map(element=>{const r=element.getBoundingClientRect();return{text:element.innerText,left:r.left,right:r.right,top:r.top,bottom:r.bottom,clipped:element.scrollWidth>element.clientWidth+1};}));
    assert.equal(measures.some(item=>item.left<0||item.right>page.viewport().width+1||item.clipped),false,'Every die legend remains readable');
    for(let i=0;i<measures.length;i++)for(let j=i+1;j<measures.length;j++)assert.ok(measures[i].right<=measures[j].left+1||measures[j].right<=measures[i].left+1||measures[i].bottom<=measures[j].top+1||measures[j].bottom<=measures[i].top+1,'Die meanings never overlap');
    const faceLines=await page.$$eval('[aria-label="Légende des faces de dés"] > span > b',elements=>elements.map(element=>{const range=document.createRange();range.selectNodeContents(element);return{text:element.textContent,lines:range.getClientRects().length};}));
    assert.ok(faceLines.every(item=>item.lines===1),'Die face values, including 2–3 and 4–5, stay on one line');
    return measures;
  }
  for (const width of visualOnly?[320,390]:[320,390,1440]) {
    await page.setViewport({width,height:844,isMobile:width<700,hasTouch:width<700});
    for (const scenario of visualOnly?['prepare']:['prepare','rolled','low-health','zero-xp','spent-preparation','spent-reaction','zero-stock','empty']) {
      await page.goto(`${origin}/?scenario=${scenario}`,{waitUntil:'networkidle0'});
      await page.waitForSelector('[data-culture-play][data-player-mode="true"]');
      await page.evaluate(()=>document.fonts.ready); await frames();
      assert.equal(await page.$('[data-playable-lesson]'),null,'The actual player branch is mounted, not the tutorial branch');
      const fixture=await page.evaluate(()=>window.__fixture), playable=fixture.playable.length;
      if(['prepare','rolled','low-health'].includes(scenario))assert.ok(playable>0,`${scenario}: fixture has a genuine playable option`);
      else assert.equal(playable,0,`${scenario}: permission blocker really prevents every card`);
      assert.equal(await page.$eval(hand,e=>e.open),false,'The hand begins collapsed');
      assert.equal(await page.$eval(action,e=>e.dataset.cultureOptionsAction),playable?'cards':'options','Shortcut follows actual permissions');
      const legend=await layout();
      assert.match(legend.find(item=>item.text.startsWith('6')).text,/Réussite.*\+1 XP/is);
      const quality=await page.$eval('[data-culture-quality]',e=>e.textContent);
      assert.ok(quality?.includes(String(fixture.quality))&&quality.includes('pts')&&quality.includes('estimés'),'The projected culture points are identified without a false /10 scale');
      if(scenario==='prepare'||scenario==='rolled')await page.screenshot({path:resolve(output,`${scenario}-overview-${width}.png`),fullPage:width===1440});
      if(scenario==='rolled'||visualOnly){
        await page.$eval('[aria-label="Légende des faces de dés"]',element=>element.scrollIntoView({block:'start',behavior:'instant'}));
        await page.screenshot({path:resolve(output,`dice-legend-${width}.png`)});
      }
      if(visualOnly){await noMutation();results.push({width,scenario,legend,quality,faceValuesOnOneLine:true,noTransaction:true});continue;}
      if(width<700){
        const initial=await visibleTarget(action);assert.ok(initial.visible&&initial.uncovered,'Mobile shortcut is visible above the action');
        await enter(action);
        if(playable){
          await page.waitForFunction(()=>document.querySelector('[data-culture-hand]').open);
          assert.equal(await page.$eval(summary,e=>document.activeElement===e),true,'Shortcut places focus on the opened hand');
          assert.equal(await page.$eval('[data-hand-filter="playable"]',e=>e.getAttribute('aria-pressed')),'true');
          const focused=await visibleTarget(summary);assert.ok(focused.visible&&focused.uncovered,'Focused hand stays above the fixed actionbar');
        }else{
          assert.equal(await page.$eval('[data-culture-options]',e=>document.activeElement===e),true,'With no playable card, focus remains on all care/options');
          assert.equal(await page.$eval(hand,e=>e.open),false,'Zero-card shortcut does not open a misleading card list');
          await enter(summary);
        }
      }else{
        assert.equal(await page.$eval(action,e=>e.checkVisibility()),false,'Desktop keeps the native options section without a redundant mobile link');
        await enter(summary);
      }
      const shown=await page.$$eval(`${cards} [data-action-card]`,elements=>elements.map(e=>({code:e.dataset.actionCard,playable:e.dataset.cardPlayable})));
      if(playable){
        assert.deepEqual(shown.map(item=>item.code).sort(),[...fixture.playable].sort(),'The opened default filter contains exactly currently playable choices');
        assert.ok(shown.every(item=>item.playable==='true'));
        await enter('[data-hand-filter="all"]');
        assert.ok(await page.$$eval(`${cards} [data-card-playable="false"]`,elements=>elements.length>0),'Blocked cards remain available for inspection');
        await enter(summary); assert.equal(await page.$eval(hand,e=>e.open),false);
        if(width<700){
          await enter(action);
          assert.equal(await page.$eval('[data-hand-filter="playable"]',e=>e.getAttribute('aria-pressed')),'true','Explicit card shortcut restores playable filter after inspecting all cards');
          assert.equal(await page.$eval(summary,e=>document.activeElement===e),true);
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-hand-filter')),'playable','Keyboard continues into the actual filter controls');
        }else await enter(summary);
      }else{
        assert.ok(shown.every(item=>item.playable==='false'),'Blocked cards are not advertised as playable');
        assert.equal(await page.$eval('[data-hand-filter="playable"]',e=>e.disabled),true);
      }
      if(scenario==='prepare'||scenario==='rolled'||scenario==='low-health')await page.screenshot({path:resolve(output,`${scenario}-cards-${width}.png`)});
      const care='[data-culture-options] button[aria-expanded]';
      await page.waitForSelector(care);await enter(care);
      assert.equal(await page.$eval(care,e=>e.getAttribute('aria-expanded')),'true','Care remains keyboard-accessible after card consultation');
      const careTarget=await visibleTarget(care);assert.ok(careTarget.uncovered,'Care control is not covered by the actionbar');
      await noMutation();await layout();
      results.push({width,scenario,playable,keyboard:true,careAccessible:true,noTransaction:true,legend,quality});
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(forbiddenRequests,[]);assert.deepEqual(consoleErrors,[]);
  report.passed=true;console.log(JSON.stringify({passed:true,observations:results.length,output}));
}catch(error){report.failure=error.stack;throw error;}
finally{await writeFile(resolve(output,visualOnly?'visual-results.json':'results.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
