/** Real culture preparation and recovery UI, backed only by in-memory fixtures. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-support-recovery');
const port = Number(process.env.KQ_SUPPORT_RECOVERY_PORT ?? 3406), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const focusOnly = process.argv.includes('--focus-only');
const missionPackOnly = process.argv.includes('--mission-pack-only');
const reportName = missionPackOnly ? 'mission-pack-report.json' : focusOnly ? 'focus-report.json' : 'report.json';
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createReleveCultureTransport} from '/src/lib/kanab-quest-releve-culture';
import {createKqReleveProduction,applyKqReleveProductionAction,suggestKqRelevePlan,KQ_RELEVE_SUPPORTS} from '/src/lib/kanab-quest-releve-production';
import {KQ_MISSION_DEFINITIONS} from '/src/lib/kanab-quest-missions';
import {KQ_ACTIVE_CARDS} from '/src/lib/kanab-quest-game';
import {getKqCardArtwork} from '/src/lib/kanab-quest-artwork';
import retro from '/src/components/contest/ArenaRetro.module.css';
const scenario=new URLSearchParams(location.search).get('scenario')||'pack';
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const storage={persistent:memory(),session:memory()};
let production=createKqReleveProduction();const act=action=>production=applyKqReleveProductionAction(production,action);
act({type:'draft',warehouse:suggestKqRelevePlan(production)});act({type:'save-plan'});
for(let index=0;index<3;index++)act({type:'reveal-buddie'});
act({type:'assign',zoneId:production.warehouse.zones[0].id,buddieCode:production.ownedBuddies[0]});act({type:'save-plan'});
const owned=scenario==='welcome'||scenario==='zero'?0:scenario==='ten'?10:scenario==='large-empty'?18:scenario==='mission-next'?9:3;
const inventory=count=>{const result={};for(let index=0;index<count;index++){const code=KQ_RELEVE_SUPPORTS[index%KQ_RELEVE_SUPPORTS.length];result[code]=(result[code]??0)+1}return result};
production.supportInventory=inventory(owned);production.deckCodes=scenario==='large-empty'?[]:Object.entries(production.supportInventory).flatMap(([code,count])=>Array(count).fill(code)).slice(0,3);
const initial=structuredClone(production),baselineDeck=[...production.deckCodes];
let boosters={collectionActive:scenario!=='inactive',costPerPack:100,spendablePoints:123,welcomeClaimed:scenario!=='welcome',availableEntitlements:[]};
if(['pack','loading','error','bad-missions','stock-unknown','stock-pending'].includes(scenario))boosters.availableEntitlements=[{id:'00000000-0000-4000-8000-000000000001',source:'mission',cardCount:10,createdAt:'2026-10-21T08:00:00.000Z'},{id:'00000000-0000-4000-8000-000000000002',source:'loyalty_purchase',cardCount:3,createdAt:'2026-10-21T09:00:00.000Z'}];
if(scenario==='duel')boosters.availableEntitlements=[{id:'00000000-0000-4000-8000-000000000003',source:'pvp_win',cardCount:3,createdAt:'2026-10-21T08:00:00.000Z'}];
let missions={collectionActive:scenario!=='inactive',missions:KQ_MISSION_DEFINITIONS.map(def=>({...def,cardCount:def.reward.kind==='pack'?def.reward.cardCount:def.reward.kind==='card'?1:0,progress:def.target,claimed:true,unlocked:true,claimable:false,rewardAvailable:true,entitlementId:null,packAvailable:false}))};
const currentMission=missions.missions.find(row=>row.code===(scenario==='mission-pack'?'twenty-varieties':'five-varieties'));
if(['mission-ready','mission-next','bad-boosters','mission-pack'].includes(scenario)){
 const claimable=['mission-ready','mission-pack'].includes(scenario);
 Object.assign(currentMission,{claimed:false,claimable,progress:claimable?currentMission.target:4});
 for(const mission of missions.missions.filter(row=>row.track===currentMission.track&&row.step>currentMission.step))Object.assign(mission,{claimed:false,unlocked:false,progress:0});
}
let sourceMode=['error','loading'].includes(scenario)?scenario:'known',stockMode=scenario==='stock-unknown'?'unknown':scenario==='stock-pending'?'pending':'known',openFailure=false,missionDelay=0,missionReadMode='known';
const deferred=[];window.__calls=[];window.__changes=[];
const transport=createReleveCultureTransport({getState:()=>production,setState:next=>{production=next}});
const response=(body,status=200)=>Response.json(body,{status});
const request=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),path=url.pathname,method=init.method??'GET',body=init.body?JSON.parse(init.body):null;
 window.__calls.push({path,method,body});
 if(path.endsWith('/boosters')||path.endsWith('/missions')){
  if(method==='GET'){
   if(sourceMode==='loading')await new Promise(done=>deferred.push(done));
   if(sourceMode==='error')return response({error:'Sources temporairement indisponibles.'},503);
   if(path.endsWith('/boosters'))return response(scenario==='bad-boosters'?{collectionActive:true}:boosters);
   if(missionReadMode==='error')return response({error:'Statut des missions temporairement indisponible.'},503);
   return response(scenario==='bad-missions'?{collectionActive:true}:missions);
  }
  if(path.endsWith('/boosters')&&method==='PUT'){
   boosters.welcomeClaimed=true;boosters.availableEntitlements.push({id:'00000000-0000-4000-8000-000000000004',source:'welcome_pack',cardCount:10,createdAt:'2026-10-21T10:00:00.000Z'});
   return response({entitlementId:'00000000-0000-4000-8000-000000000004',claimed:true,replayed:false,status:'available'});
  }
  if(path.endsWith('/boosters')&&method==='PATCH'){
   await new Promise(done=>setTimeout(done,160));if(openFailure===true)return response({error:'Ouverture interrompue. Ton pack reste disponible.'},503);
   const entitlement=boosters.availableEntitlements.find(row=>row.id===body.entitlementId);if(!entitlement)return response({error:'Pack absent.'},400);
   const cards=Array.from({length:entitlement.cardCount},(_,index)=>KQ_ACTIVE_CARDS.find(card=>card.code===KQ_RELEVE_SUPPORTS[index%KQ_RELEVE_SUPPORTS.length]));
   for(const card of cards)production.supportInventory[card.code]=(production.supportInventory[card.code]??0)+1;
   boosters.availableEntitlements=boosters.availableEntitlements.filter(row=>row.id!==entitlement.id);
   for(const mission of missions.missions.filter(row=>row.entitlementId===entitlement.id))mission.packAvailable=false;
   if(openFailure==='lost-mission-status'){missionReadMode='error';return response({error:'Réponse interrompue après ouverture.'},503)}
   if(openFailure==='lost')return response({error:'Réponse interrompue après ouverture.'},503);
   return response({cards:cards.map(card=>({code:card.code,name:card.name,rarity:card.rarity,imageUrl:getKqCardArtwork(card.code)}))});
  }
  if(path.endsWith('/missions')&&method==='POST'){
   if(missionDelay)await new Promise(done=>setTimeout(done,missionDelay));
   const mission=missions.missions.find(row=>row.code===body.code);if(!mission?.claimable)return response({error:'Objectif non atteint.'},400);
   mission.claimable=false;mission.claimed=true;const reward=mission.reward;
   const next=missions.missions.find(row=>row.track===mission.track&&row.step===mission.step+1);if(next)next.unlocked=true;
   if(reward.kind==='card')production.supportInventory[reward.code]=(production.supportInventory[reward.code]??0)+1;
   if(reward.kind==='pack'){
    mission.entitlementId='00000000-0000-4000-8000-000000000005';mission.packAvailable=true;
    boosters.availableEntitlements.push({id:mission.entitlementId,source:'mission',cardCount:reward.cardCount,createdAt:'2026-10-21T11:00:00.000Z'});
    return response({reward,cardCount:reward.cardCount,entitlementId:mission.entitlementId,replayed:false});
   }
   return response({reward,cardCount:1,entitlementId:null,replayed:false});
  }
  throw new Error('Unsupported fixture mutation '+method+' '+path);
 }
 if(path.includes('/contracts'))return response({error:'Not part of this fixture'},404);
 if(path.endsWith('/bootstrap')){
  if(stockMode==='pending')await new Promise(done=>deferred.push(done));
  const payload=await(await transport(input,init)).json();return response(stockMode==='unknown'?{...payload,collection:null}:payload);
 }
 return transport(input,init);
};
const api=createKqTutorialApi(request);api.isTutorial=false;
window.__fixture=()=>structuredClone({scenario,owned,baselineDeck,initial,production,boosters,missions});
window.__control={resolve:()=>{sourceMode='known';stockMode='known';deferred.splice(0).forEach(done=>done())},sources:mode=>{sourceMode=mode},openFailure:value=>openFailure=value,missionDelay:value=>missionDelay=value,missionRead:mode=>missionReadMode=mode,stock:mode=>{stockMode=mode;api.notify('kq:collection-updated')},inventory:count=>{production.supportInventory=inventory(count);api.notify('kq:collection-updated')},notify:event=>api.notify(event)};
createRoot(document.getElementById('root')).render(<div className={retro.surface}><aside className="fixture-tools"><strong>Démo locale · retrouver des cartes de soutien</strong><p>Culture et récompenses fictives en mémoire, sans compte ni achat réel.</p><label>Situation <select value={scenario} onChange={event=>location.search='?scenario='+event.target.value}>{['pack','duel','welcome','mission-ready','mission-next','zero','ten','large-empty','inactive','error'].map(name=><option key={name}>{name}</option>)}</select></label></aside><KqTutorialApiProvider api={api}><KanabQuestDicePrototype apiScope="player" initialCampaign showAdminOperations={false} showWarehouseNavigation={false} initialPreparation={{deckCodes:production.deckCodes,heritageCode:production.heritageCode}} onPreparationChange={value=>window.__changes.push(value)} isolatedStorage={storage}/></KqTutorialApiProvider></div>);
if(${preview}){let opened=false;const observer=new MutationObserver(()=>{const details=document.querySelector('[data-setup-choice="cards"]');if(details&&!opened){opened=true;details.querySelector('summary').click()}const panel=document.querySelector('[data-deck-preparation]');if(panel&&document.querySelector('[data-support-recovery-status="ready"]')){observer.disconnect();requestAnimationFrame(()=>panel.scrollIntoView({block:'start',behavior:'instant'}))}});observer.observe(document.getElementById('root'),{subtree:true,childList:true,attributes:true})}
`;
const modules = {
  entry,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/dynamic': `import React from'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
  '@/context/CartContext': `export const useCart=()=>({user:{id:'00000000-0000-4000-8000-000000000001'},isAuthenticated:true,authLoading:false,refreshSession:async()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}.fixture-tools{padding:12px 18px;font:12px Body;background:#182b24;color:#fff1d6}.fixture-tools p{margin:5px 0}.fixture-tools select{margin-left:8px;color:#182b24}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react', '@3d-dice/dice-box-threejs'] },
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'support-recovery-audit', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('Real API disabled'); return; } if (req.url?.split('?')[0] !== '/') return next(); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Retrouver des soutiens · démo locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [];
let browser, page;
await mkdir(output, { recursive: true }); await server.listen();
if (preview) {
  console.log(`Local support recovery demo: ${origin} (PID ${process.pid}). In-memory data only.`);
  await new Promise(resolveStop => { const stop = () => { void server.close().then(resolveStop); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); });
} else try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => { const url = new URL(request.url()); if (['data:', 'blob:'].includes(url.protocol)) return void request.continue(); if (url.origin !== origin || url.pathname.startsWith('/api/')) { forbiddenRequests.push(request.url()); return void request.abort(); } void request.continue(); });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const cards = '[data-setup-choice="cards"]', panel = '[data-support-recovery]';
  const text = selector => page.$eval(selector, element => element.textContent);
  const calls = () => page.evaluate(() => window.__calls);
  async function load(scenario = 'pack', openCards = true) {
    await page.goto(`${origin}/?scenario=${scenario}`, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
    if (openCards) { await page.waitForSelector(`${cards} > summary`); await page.focus(`${cards} > summary`); await page.keyboard.press('Enter'); await page.waitForSelector('[data-deck-preparation]', { visible: true }); }
  }
  async function layout() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow'); }
  async function shot(name) { await page.$eval(panel, element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - 16, behavior: 'instant' })); await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: false }); }
  async function button(label, scope = 'body') { const handle = await page.waitForFunction((value, scope) => [...document.querySelectorAll(scope + ' button')].find(node => node.textContent.includes(value) && !node.disabled && node.getBoundingClientRect().height > 0), {}, label, scope); await handle.asElement().focus(); await page.keyboard.press('Enter'); await handle.dispose(); }
  const sourceCalls = async () => (await calls()).filter(call => /\/(boosters|missions)$/.test(call.path));
  const mutations = async () => (await calls()).filter(call => call.method !== 'GET');
  const ready = status => page.waitForFunction(status => document.querySelector('[data-support-recovery]')?.dataset.supportRecoveryStatus === status, {}, status);
  const fixture = () => page.evaluate(() => window.__fixture());
  const action = kind => '[data-support-recovery-action="' + kind + '"]';
  const keyClick = async selector => { await page.waitForSelector(selector, { visible: true }); await page.focus(selector); await page.keyboard.press('Enter'); };
  const waitReturn = async () => { await page.waitForFunction(() => !document.querySelector('dialog[open]') && document.activeElement?.matches('[data-deck-preparation]')); };
  const preservePreparation = async before => {
    const after = await fixture();
    assert.equal(after.production.cashCents, before.production.cashCents, 'Recovery spends no game cash');
    assert.deepEqual(after.production.game, before.production.game, 'Recovery neither starts nor replaces a culture');
    assert.deepEqual(after.production.warehouse, before.production.warehouse, 'Zones and Buddies are preserved');
    assert.deepEqual(after.production.deckCodes, before.production.deckCodes, 'Recovery never adds cards automatically');
    assert.deepEqual(await page.evaluate(() => window.__changes.at(-1).deckCodes), before.baselineDeck, 'Current selected deck survives the modal and inventory refresh');
  };

  if (!missionPackOnly) for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000, isMobile: width < 700, hasTouch: width < 700 });
    for (const scenario of focusOnly ? ['mission-next'] : ['pack', 'welcome', 'mission-ready', 'mission-next', 'zero']) {
      await load(scenario); await ready('ready'); const before = await fixture();
      const expected = scenario === 'welcome' || scenario === 'zero' ? 0 : scenario === 'mission-next' ? 9 : 3;
      assert.match(await text('[data-support-stock]'), new RegExp('^' + expected + ' copie'));
      assert.match(await text(panel), /Tu peux aussi cultiver sans soutien/);
      assert.equal((await sourceCalls()).filter(call => call.path.endsWith('/boosters')).length, 1, 'One initial booster read');
      assert.equal((await sourceCalls()).filter(call => call.path.endsWith('/missions')).length, 1, 'One initial mission read');
      assert.deepEqual(await mutations(), [], 'Passive recovery never claims, opens or purchases');
      assert.doesNotMatch(await text(panel), /NaN|undefined|Infinity|acheter/i);
      if (scenario === 'mission-next') { assert.match(await text(panel), /4\s*\/\s*5/); assert.match(await text(panel), /Deuxième chance/); }
      await layout(); await shot(scenario + '-' + width); await preservePreparation(before);
      const buttons = await page.$$eval(panel + ' button', nodes => nodes.map(node => ({ height: node.getBoundingClientRect().height, right: node.getBoundingClientRect().right })));
      assert(buttons.every(node => node.height >= 44 && node.right <= width + 1), 'Recovery actions are visible touch targets');
      results.push({ scenario: 'read-only ' + scenario, width });
      if (scenario === 'mission-next') {
        await keyClick(action('missions')); await page.waitForSelector('dialog[data-support-missions][open]', { visible: true });
        await page.waitForFunction(() => document.querySelector('[data-support-missions]')?.textContent.includes('Un jardin de caractères'));
        await page.waitForFunction(() => document.activeElement?.matches('[data-support-missions] [data-mission-track="culture"] h2'));
        assert(await page.$eval('[data-support-missions] [data-mission-track="culture"] h2', node => {
          const rect = node.getBoundingClientRect(), header = document.querySelector('[data-support-missions] > header').getBoundingClientRect();
          return rect.top >= header.bottom - 1 && rect.bottom <= innerHeight && header.top >= 0;
        }), 'The selected objective and persistent close button are immediately visible');
        await layout(); await page.screenshot({ path: resolve(output, 'mission-dialog-' + width + '.png'), fullPage: false });
        await page.keyboard.press('Escape'); await waitReturn(); await preservePreparation(before);
        assert.deepEqual(await mutations(), [], 'Opening and closing a mission never claims it');
        results.push({ scenario: 'mission modal keyboard Escape restores selection', width });
      }
    }
  }

  if (!focusOnly && !missionPackOnly) {
  for (const scenario of ['ten', 'large-empty']) {
    await load(scenario); assert.equal(await page.$(panel), null); assert.deepEqual(await sourceCalls(), []);
    if (scenario !== 'large-empty') await button('Retirer les cartes', cards);
    assert.equal(await page.$(panel), null, 'Chosen deck size does not create a stock shortage');
    assert.deepEqual(await sourceCalls(), [], 'Ten or more owned copies need no recovery lookups');
    results.push({ scenario: scenario + ': no panel or lookup despite a small/empty chosen deck' });
  }
  await load('pack', false); await page.waitForSelector(cards); assert.deepEqual(await sourceCalls(), [], 'Closed preparation does not read rewards');
  await keyClick(cards + ' > summary'); await ready('ready'); await button('Retirer les cartes', cards);
  assert.match(await text('[data-deck-copies]'), /^0/); assert.match(await text('[data-support-stock]'), /^3 copie/);
  results.push({ scenario: 'lazy lookup and owned stock independent from selected deck' });

  for (const scenario of ['pack', 'duel']) {
    await page.setViewport({ width: scenario === 'pack' ? 1440 : 320, height: 1000 });
    await load(scenario); await ready('ready'); const before = await fixture();
    await page.$eval(action('pack'), node => { node.focus(); node.click(); node.click(); });
    await page.waitForSelector('[data-support-pack-reveal]', { visible: true });
    const quantity = scenario === 'pack' ? 10 : 3;
    assert.equal(await page.$$eval('[data-support-pack-reveal] article', nodes => nodes.length), quantity, 'The revealed count comes from the actual entitlement');
    assert.equal((await mutations()).filter(call => call.method === 'PATCH').length, 1, 'Double activation opens once');
    await page.waitForFunction(count => Object.values(window.__fixture().production.supportInventory).reduce((sum, value) => sum + value, 0) === count, {}, 3 + quantity);
    if (scenario === 'pack') await page.waitForFunction(() => !document.querySelector('[data-support-recovery]'));
    assert(await page.$('dialog[data-mission-pack-opening][open]'), 'Stock crossing ten keeps the revealed pack mounted');
    await layout(); await page.screenshot({ path: resolve(output, scenario + '-opened-' + (scenario === 'pack' ? 1440 : 320) + '.png'), fullPage: false });
    await button('Revenir à mes cartes', '[data-mission-pack-opening]'); await waitReturn();
    await preservePreparation(before); assert.match(await text('[data-deck-copies]'), /^3/);
    results.push({ scenario: scenario + ': explicit one-time opening, persistent reveal, preserved selection and keyboard return' });
  }
  await page.setViewport({ width: 390, height: 1000 });
  await load('welcome'); await ready('ready'); const welcomeBefore = await fixture();
  await page.$eval(action('welcome'), node => { node.click(); node.click(); });
  await page.waitForSelector(action('pack'), { visible: true });
  assert.equal((await mutations()).filter(call => call.method === 'PUT').length, 1);
  assert.equal((await mutations()).filter(call => call.method === 'PATCH').length, 0, 'Welcome claim does not automatically open the pack');
  await keyClick(action('pack')); await page.waitForSelector('[data-support-pack-reveal]', { visible: true });
  await button('Revenir à mes cartes', '[data-mission-pack-opening]'); await waitReturn(); await preservePreparation(welcomeBefore);
  assert.match(await text('[data-deck-copies]'), /^0/); results.push({ scenario: 'welcome claim and opening are two explicit choices; empty deck remains empty' });

  for (const scenario of ['mission-next', 'mission-ready']) {
    await load(scenario); await ready('ready'); const before = await fixture();
    await keyClick(action('missions')); await page.waitForSelector('dialog[data-support-missions][open]', { visible: true });
    await page.waitForFunction(() => document.querySelector('[data-support-missions]')?.textContent.includes('Un jardin de caractères'));
    assert.equal((await mutations()).length, 0, 'Opening missions never claims a reward');
    const tracks = await page.$$eval('[data-support-missions] section[aria-label]', nodes => nodes.map(node => node.getAttribute('aria-label')));
    assert(tracks.includes('Culture & Buddies'), 'The objective opens its culture track');
    await layout(); await page.screenshot({ path: resolve(output, scenario + '-dialog-390.png'), fullPage: false });
    if (scenario === 'mission-ready') {
      await button('Récupérer ma carte', '[data-support-missions]');
      await page.waitForSelector('[data-support-missions] [data-mission-receipt]', { visible: true });
      assert.equal((await mutations()).filter(call => call.path.endsWith('/missions')).length, 1);
      assert.equal((await fixture()).production.supportInventory['BOTTE-006'], 1);
    }
    await keyClick('[data-support-missions] [aria-label="Revenir à mes cartes"]'); await waitReturn(); await preservePreparation(before);
    results.push({ scenario: scenario + ': real missions dialog, explicit claim only, preparation and focus restored' });
  }

  for (const scenario of ['error', 'bad-boosters', 'inactive', 'bad-missions']) {
    await load(scenario); await ready(scenario === 'inactive' ? 'closed' : scenario === 'bad-missions' ? 'ready' : 'unavailable');
    assert.match(await text('[data-support-stock]'), /^3 copie/);
    assert.deepEqual(await mutations(), []);
    if (scenario === 'bad-missions') assert(await page.$(action('pack')), 'A real available pack survives unrelated mission read failure');
    else assert.equal(await page.$(action('pack')), null, 'Unavailable rights never invent an openable pack');
    if (scenario === 'error') { await page.evaluate(() => window.__control.sources('known')); await keyClick('[data-support-recovery-retry]'); await ready('ready'); assert(await page.$(action('pack'))); }
    await layout(); results.push({ scenario: scenario + ': unknown sources stay explicit; recovery uses only confirmed rights' });
  }
  await load('mission-ready'); await ready('ready'); const pendingMissionBefore = await fixture();
  await page.evaluate(() => window.__control.missionDelay(500)); await keyClick(action('missions'));
  await page.waitForFunction(() => document.querySelector('[data-support-missions]')?.textContent.includes('Un jardin de caractères'));
  await button('Récupérer ma carte', '[data-support-missions]');
  await keyClick('[data-support-missions] [aria-label="Revenir à mes cartes"]'); await waitReturn();
  await page.waitForFunction(() => document.querySelector('[data-support-stock]')?.textContent.startsWith('4 copies'));
  await preservePreparation(pendingMissionBefore);
  assert.equal((await mutations()).filter(call => call.path.endsWith('/missions')).length, 1);
  results.push({ scenario: 'closing a pending mission receipt still reconciles the owned cards after unmount' });
  await load('loading'); await ready('pending'); assert.equal(await page.$(action('pack')), null); assert.match(await text('[data-support-stock]'), /^3 copie/);
  await page.evaluate(() => window.__control.resolve()); await ready('ready'); results.push({ scenario: 'delayed reads never masquerade as empty rewards' });
  await load('loading'); await ready('pending'); await page.evaluate(() => window.__control.inventory(18));
  await page.waitForFunction(() => !document.querySelector('[data-support-recovery]')); await page.evaluate(() => window.__control.resolve());
  assert.equal(await page.$(panel), null); results.push({ scenario: 'stock refresh aborts obsolete recovery reads' });
  await load('pack'); await ready('ready'); await page.evaluate(() => window.__control.stock('unknown'));
  await page.waitForFunction(() => document.querySelector('[data-deck-stock-status]')?.textContent.includes('indisponible'));
  assert.equal(await page.$(panel), null, 'An unknown collection never displays zero copies');
  results.push({ scenario: 'unknown owned inventory is not a zero-stock prompt' });
  await load('pack'); await ready('ready'); const errorBefore = await fixture(); await page.evaluate(() => window.__control.openFailure(true));
  await keyClick(action('pack')); await page.waitForSelector('[data-mission-pack-opening] [role="alert"]', { visible: true });
  assert.match(await text('[data-mission-pack-opening]'), /interrompue/); await preservePreparation(errorBefore);
  await page.evaluate(() => window.__control.openFailure(false)); await button('Réessayer l’ouverture', '[data-mission-pack-opening]');
  await page.waitForSelector('[data-support-pack-reveal]', { visible: true });
  const retryCalls = (await mutations()).filter(call => call.method === 'PATCH'); assert.equal(retryCalls.length, 2); assert.equal(retryCalls[0].body.entitlementId, retryCalls[1].body.entitlementId);
  await button('Revenir à mes cartes', '[data-mission-pack-opening]'); await waitReturn(); await preservePreparation(errorBefore);
  results.push({ scenario: 'failed opening retries the same entitlement without buying or replacing the deck' });

  await load('pack'); await ready('ready'); const lostBefore = await fixture(); await page.evaluate(() => window.__control.openFailure('lost'));
  await keyClick(action('pack')); await page.waitForSelector('[data-mission-pack-opening] [role="alert"]', { visible: true });
  await page.waitForFunction(() => !document.querySelector('[data-support-recovery]'));
  assert.equal((await fixture()).production.supportInventory['BOTTE-005'], 3, 'A lost response still reconciles the real updated album');
  assert(!await page.$$eval('[data-mission-pack-opening] button', nodes => nodes.some(node => node.textContent.includes('Réessayer'))), 'A consumed entitlement must not offer an impossible retry');
  await button('Revenir à mes cartes', '[data-mission-pack-opening]'); await waitReturn(); await preservePreparation(lostBefore);
  assert.equal((await mutations()).filter(call => call.method === 'PATCH').length, 1);
  results.push({ scenario: 'consumed pack with lost response reconciles album and removes invalid retry' });

  await load('zero'); await ready('ready'); await button('Lancer la campagne'); await page.waitForSelector('[data-culture-confirm-start]:not(:disabled)');
  await keyClick('[data-culture-confirm-start]'); await page.waitForFunction(() => window.__fixture().production.game !== null);
  assert.equal(await page.$(panel), null); const run = (await fixture()).production.game;
  await page.evaluate(() => window.__control.notify('kq:boosters-updated')); assert.deepEqual((await fixture()).production.game, run);
  assert.equal((await mutations()).filter(call => call.path.endsWith('/runs')).length, 1);
  assert((await mutations()).every(call => call.path.endsWith('/runs')), 'Playing without cards never triggers a grant or purchase');
  results.push({ scenario: 'zero supports can launch the real engine; reward events preserve the running campaign' });
  }
  if (missionPackOnly || !focusOnly) {
    await page.setViewport({ width: 390, height: 1000 }); await load('mission-pack'); await ready('ready');
    const before = await fixture(); assert.match(await text(panel), /pack de 10 cartes/i);
    assert.deepEqual(await mutations(), [], 'The unclaimed mission pack stays passive');
    await keyClick(action('missions')); await page.waitForSelector('[data-support-missions] [data-mission-track="culture"]', { visible: true });
    await button('Récupérer mon pack', '[data-support-missions]');
    await page.waitForSelector('[data-support-missions] [data-mission-receipt]', { visible: true });
    assert.equal((await mutations()).filter(call => call.method === 'POST').length, 1);
    assert.equal((await mutations()).filter(call => call.method === 'PATCH').length, 0, 'Claiming does not open the pack');
    await page.evaluate(() => window.__control.openFailure('lost-mission-status'));
    await button('Ouvrir mon pack', '[data-support-missions] [data-mission-receipt]');
    await page.waitForSelector('[data-mission-pack-opening] [role="alert"]', { visible: true });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-mission-pack-opening] button')].some(node => node.textContent.includes('Actualiser le statut')));
    assert.equal((await fixture()).production.supportInventory['BOTTE-005'], 3, 'Server applied the draw despite the lost response');
    assert(!await page.$$eval('[data-mission-pack-opening] button', nodes => nodes.some(node => node.textContent.includes('Réessayer'))), 'Unknown status offers a read, never another opening');
    const beforeRefresh = await calls();
    await button('Actualiser le statut', '[data-mission-pack-opening]');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-mission-pack-opening] button')].some(node => node.textContent.includes('Actualiser le statut')));
    const refreshCalls = (await calls()).slice(beforeRefresh.length);
    assert(refreshCalls.some(call => call.method === 'GET' && call.path.endsWith('/missions')), 'Refresh rereads the authoritative mission status');
    assert(refreshCalls.every(call => call.method === 'GET'), 'Status refresh cannot replay PATCH');
    assert.equal((await mutations()).filter(call => call.method === 'PATCH').length, 1);
    await page.screenshot({ path: resolve(output, 'mission-pack-unknown-status-390.png'), fullPage: false });
    await page.evaluate(() => window.__control.missionRead('known'));
    await button('Actualiser le statut', '[data-mission-pack-opening]');
    await page.waitForFunction(() => document.querySelector('[data-mission-pack-opening] [role="alert"]')?.textContent.includes('déjà été ouvert'));
    assert(!await page.$$eval('[data-mission-pack-opening] button', nodes => nodes.some(node => /Réessayer|Actualiser/.test(node.textContent))), 'Confirmed opened entitlement removes retry');
    assert.equal((await mutations()).filter(call => call.method === 'PATCH').length, 1);
    await page.screenshot({ path: resolve(output, 'mission-pack-confirmed-opened-390.png'), fullPage: false });
    await button('Retour aux missions', '[data-mission-pack-opening]');
    await page.waitForFunction(() => !document.querySelector('[data-mission-pack-opening]'));
    await keyClick('[data-support-missions] [aria-label="Revenir à mes cartes"]'); await waitReturn();
    assert.equal(await page.$(panel), null, 'The reconciled thirteen-copy album no longer needs recovery');
    assert.match(await text('[data-deck-copies]'), /^3/); await preservePreparation(before);
    assert.deepEqual((await mutations()).map(call => ({ path: call.path, method: call.method })), [
      { path: '/api/arena/placard/missions', method: 'POST' }, { path: '/api/arena/placard/boosters', method: 'PATCH' },
    ], 'Only the explicit claim and initial pack opening mutated state');
    await layout(); results.push({ scenario: 'mission pack lost response plus failed status read: GET-only retry, confirmed closure, reconciled album, preserved deck', width: 390 });
  }
  assert.deepEqual(errors, [], 'No browser exceptions'); assert.deepEqual(forbiddenRequests, [], 'No API or external network');
  await writeFile(resolve(output, reportName), JSON.stringify({ success: true, fixturesOnly: true, scenarios: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ success: true, scenarios: results.length, output }));
} catch (error) { await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); await writeFile(resolve(output, reportName), JSON.stringify({ success: false, error: error.stack, results, errors, forbiddenRequests }, null, 2)); console.error(error.stack); process.exitCode = 1;
} finally { await browser?.close(); await server.close(); }
