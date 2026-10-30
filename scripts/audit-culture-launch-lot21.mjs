/** Real player components and local Relève transport. No remote API or database. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/clarity-lot21');
const port = Number(process.env.CULTURE_LAUNCH_LOT21_PORT ?? 3591), origin = `http://127.0.0.1:${port}`;
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/app/globals.css';
import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
import {createReleveCultureTransport} from '/src/lib/kanab-quest-releve-culture';
import {createKqReleveProduction,applyKqReleveProductionAction,suggestKqRelevePlan} from '/src/lib/kanab-quest-releve-production';
import {getKqCampaignParticipants} from '/src/lib/kanab-quest-campaign';
import {getKqZoneIdentity} from '/src/lib/kanab-quest-zone-identity';
import {KQ_BUDDIES} from '/src/lib/kanab-quest-game';
import retro from '/src/components/contest/ArenaRetro.module.css';
const params=new URLSearchParams(location.search),scenario=params.get('scenario')||'known',count=Number(params.get('count')||2);
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
const storage={persistent:memory(),session:memory()};
let production=createKqReleveProduction();const act=action=>production=applyKqReleveProductionAction(production,action);
act({type:'draft',warehouse:suggestKqRelevePlan(production,count)});act({type:'save-plan'});
for(let index=0;index<3;index++)act({type:'reveal-buddie'});
production.warehouse.zones.forEach((zone,index)=>act({type:'assign',zoneId:zone.id,buddieCode:production.ownedBuddies[index]}));act({type:'save-plan'});
const transport=createReleveCultureTransport({getState:()=>production,setState:next=>{production=next;window.__production=next;}});
const offered={energy:12345,consumables:6789};let energyState=scenario,release;
window.__calls=[];window.__starts=[];window.__production=production;
const energyResponse=async()=>{
 if(energyState==='error')return Response.json({error:'Devis temporairement indisponible. Réessaie.'},{status:503});
 const payload=await(await transport('/api/arena/placard/energy')).json();
 for(const mode of ['eco','balanced','intensive'])payload.quotes[mode]={...payload.quotes[mode],totalCents:offered.energy};
 payload.warehouse={...payload.warehouse,energyCostCents:offered.energy,consumablesCostCents:offered.consumables,operatingCostCents:offered.energy+offered.consumables};
 if(energyState==='incomplete')delete payload.warehouse.consumablesCostCents;
 if(energyState==='missing-quote')delete payload.quotes.balanced;
 if(energyState==='null-consumables')payload.warehouse.consumablesCostCents=null;
 if(energyState==='zero'){for(const mode of ['eco','balanced','intensive'])payload.quotes[mode].totalCents=0;payload.warehouse.energyCostCents=0;payload.warehouse.consumablesCostCents=0;payload.warehouse.operatingCostCents=0;}
 return Response.json(payload);
};
const request=async(input,init)=>{
 const url=new URL(String(input),location.origin),path=url.pathname,method=init?.method||'GET';
 window.__calls.push({path,method,query:url.search});
 if(path.endsWith('/runs')&&method==='POST'){window.__starts.push(JSON.parse(init.body));return Response.json({error:'Lancement indisponible dans la recette locale. Réessaie.'},{status:503});}
 if(method!=='GET')throw new Error('Unexpected local mutation '+method+' '+path);
 if(path.includes('/contracts'))return Response.json({error:'Contrat hors recette'},{status:404});
 if(path.endsWith('/energy')){
  if(energyState==='loading')return new Promise(resolve=>{release=resolve;window.__energyPending=true;});
  return energyResponse();
 }
 return transport(input,init);
};
const api=createKqTutorialApi(request);api.isTutorial=false;
window.__control={set:state=>{energyState=state;},prices:(energy,consumables)=>{offered.energy=energy;offered.consumables=consumables;},resolve:async(state='known')=>{energyState=state;const response=await energyResponse();release?.(response);release=undefined;window.__energyPending=false;},refresh:()=>api.notify('kq:equipment-updated'),reassign:()=>{const code=KQ_BUDDIES.find(b=>!production.ownedBuddies.includes(b.code)&&!production.recentBuddieCodes.includes(b.code)).code;production={...production,ownedBuddies:[...production.ownedBuddies,code]};act({type:'assign',zoneId:production.warehouse.zones[0].id,buddieCode:code});act({type:'save-plan'});window.__production=production;return {code,name:KQ_BUDDIES.find(b=>b.code===code)?.name,revision:production.revision};}};
window.__fixture={revision:production.revision,participants:getKqCampaignParticipants(production.warehouse,production.revision).map(member=>({code:member.buddieCode,name:KQ_BUDDIES.find(b=>b.code===member.buddieCode)?.name,zone:getKqZoneIdentity(member.warehouse.sourceState,member.zoneId)?.label??member.warehouse.zones[0]?.name,area:member.warehouse.activeAreaM2})),offered};
createRoot(document.getElementById('root')).render(<div className={retro.surface}><KqTutorialApiProvider api={api}><KanabQuestDicePrototype apiScope='player' initialCampaign showAdminOperations={false} showWarehouseNavigation={false} initialPreparation={{deckCodes:production.deckCodes,heritageCode:production.heritageCode}} isolatedStorage={storage}/></KqTutorialApiProvider></div>);
`;
const modules = {
  entry,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react', '@3d-dice/dice-box-threejs'] },
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'culture-launch-lot21-audit', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.split('?')[0] !== '/') return next(); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lancement des cultures · recette isolée</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const checks = [], errors = [], external = [], report = { passed: false, checks, errors, external, backend: 'Real player UI, local Relève GET transport. Deliberately distinct offered amounts verify API authority. Captured POSTs return a local 503; no account/database mutation.', reflow: '320×422 CSS px models available space at 200% of 640×844; not native browser zoom.' };
let browser, page;
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(25000); page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error => errors.push(error.message)); await page.setRequestInterception(true);
  page.on('request', request => { const url = new URL(request.url()); if (['data:', 'blob:'].includes(url.protocol) || url.origin === origin && !url.pathname.startsWith('/api/')) void request.continue(); else { external.push(request.url()); void request.abort(); } });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const shot = name => page.screenshot({ path: resolve(output, name + '.png') });
  const enter = async selector => { const element = await page.waitForSelector(selector, { visible: true }); await element.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await element.focus(); await page.keyboard.press('Enter'); };
  const ready = () => page.waitForSelector('[data-culture-confirm-start]:not(:disabled)');
  const open = async (scenario = 'known', count = 2) => {
    await page.goto(`${origin}/?scenario=${scenario}&count=${count}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-culture-start-review]:not(:disabled)'); await page.evaluate(() => document.fonts.ready);
    await enter('[data-culture-start-review]'); await page.waitForSelector('[data-app-dialog][open]');
  };
  const closed = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[data-app-dialog]')); assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-culture-start-review')), true, 'Escape restores the launch review button'); };
  const assertBlocked = async () => {
    await page.waitForFunction(() => document.querySelector('[data-culture-confirm-start]')?.disabled === true);
    assert.equal(await page.$('[data-campaign-budget]'), null, 'An unavailable quote does not show its previous amount or a fabricated zero');
    assert.equal(await page.evaluate(() => window.__starts.length), 0, 'Reading/retrying costs must not start a culture');
  };
  const geometry = () => page.$eval('[data-app-dialog]', dialog => {
    const body = dialog.querySelector('[data-app-dialog-body]'), box = dialog.getBoundingClientRect(), bodyBox = body.getBoundingClientRect();
    const budget = dialog.querySelector('[data-campaign-budget]'), budgetBox = budget?.getBoundingClientRect();
    return { overflow: dialog.scrollWidth > dialog.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1,
      dialog: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
      budget: budget ? { text: budget.innerText, top: budgetBox.top, bottom: budgetBox.bottom, visibleOnOpening: budgetBox.top >= bodyBox.top && budgetBox.bottom <= bodyBox.bottom } : null,
      viewport: { width: innerWidth, height: innerHeight } };
  });
  for (const count of [1, 2]) {
    for (const size of [{ width: 320, height: 844, name: '320' }, { width: 390, height: 844, name: '390' }, { width: 1440, height: 844, name: '1440' }, { width: 320, height: 422, name: '320-short' }]) {
      await page.setViewport({ width: size.width, height: size.height }); await open('known', count); await ready();
      const observed = await geometry(); assert.equal(observed.overflow, false); assert(observed.budget.visibleOnOpening, 'Offered budget visible before scrolling, even at 320×422');
      assert.match(observed.budget.text, /191,34\s*€/); assert.match(await page.$eval('[data-culture-launch-scope]', node => node.innerText), count === 1 ? /1 Buddie/ : /2 Buddies/);
      assert.equal(await page.$eval('[data-culture-launch-participants]', node => node.open), false); assert.equal(await page.$eval('[data-culture-launch-cards]', node => node.open), false);
      assert.match(await page.$eval('[data-campaign-billing]', node => node.innerText), /récolte/); assert.match(await page.$eval('[data-campaign-billing]', node => node.innerText), /5 jours réels/);
      assert.equal(await page.$eval('[data-campaign-billing]', node => node.closest('details:not([open])')), null, 'Payment timing is never hidden in a closed accordion');
      assert.match(await page.$eval('[data-app-dialog-body]', node => node.innerText), /6 heures réelles d’affinage/); await shot(`launch-${count}-${size.name}`);
      await enter('[data-culture-launch-participants] > summary'); assert.equal(await page.$eval('[data-culture-launch-participants]', node => node.open), true);
      const participants = await page.evaluate(() => window.__fixture.participants), participantText = await page.$eval('[data-culture-launch-participants]', node => node.innerText);
      for (const participant of participants) { assert(participantText.includes(participant.name), `Participant ${participant.name} is identified`); assert(participantText.includes(participant.zone), `Zone ${participant.zone} is identified`); assert(participantText.includes(`${participant.area} m²`), `Area of ${participant.zone} is explicit`); }
      assert.equal((await geometry()).overflow, false); await shot(`participants-${count}-${size.name}`); await enter('[data-culture-launch-participants] > summary');
      await enter('[data-culture-launch-cards] > summary'); assert.match(await page.$eval('[data-culture-launch-cards]', node => node.innerText), /cartes choisies/); await enter('[data-culture-launch-cards] > summary');
      await page.focus('[data-culture-confirm-start]'); const focus = await page.$eval('[data-culture-confirm-start]', node => { const rect = node.getBoundingClientRect(); return { focused: document.activeElement === node, visible: rect.top >= 0 && rect.bottom <= innerHeight, outline: getComputedStyle(node).outlineStyle }; });
      assert.equal(focus.focused, true); assert.equal(focus.visible, true); assert.notEqual(focus.outline, 'none'); await shot(`launch-action-${count}-${size.name}`);
      await page.keyboard.press('Tab'); assert.equal(await page.$eval('[data-app-dialog]', node => node.contains(document.activeElement)), true, 'Focus remains in the modal');
      await closed(); assert.equal(await page.evaluate(() => window.__production.game), null); assert.equal(await page.evaluate(() => window.__starts.length), 0);
      checks.push({ scenario: 'responsive-review', participants: count, viewport: size, ...observed, keyboardDetails: true, focus, escapeRestoresOpener: true });
    }
  }
  await page.setViewport({ width: 390, height: 844 });
  for (const scenario of ['loading', 'error', 'incomplete', 'missing-quote', 'null-consumables']) {
    await open(scenario); await page.waitForSelector(`[data-campaign-charge-status="${scenario === 'loading' ? 'loading' : scenario === 'error' ? 'error' : 'incomplete'}"]`); await assertBlocked(); await shot('quote-' + scenario);
    if (scenario === 'loading') { await page.waitForFunction(() => window.__energyPending); await page.evaluate(() => window.__control.resolve()); }
    else { await page.evaluate(() => window.__control.set('known')); await enter('[aria-label="Actualiser les charges"]'); }
    await ready(); assert.match(await page.$eval('[data-campaign-budget]', node => node.innerText), /191,34\s*€/); await closed();
    checks.push({ scenario, blockedWithoutInventedAmount: true, recovered: true });
  }
  await open('known'); await ready();
  await page.evaluate(() => window.__control.set('loading')); await enter('[aria-label="Actualiser les charges"]'); await page.waitForFunction(() => window.__energyPending);
  await assertBlocked(); await shot('refresh-known-loading');
  await page.evaluate(() => window.__control.resolve('error')); await page.waitForSelector('[data-campaign-charge-status="error"] [role="alert"]'); await assertBlocked(); await shot('refresh-known-error');
  await page.evaluate(() => { window.__control.set('known'); window.__control.prices(24789, 8855); }); await enter('[aria-label="Actualiser les charges"]'); await ready();
  assert.match(await page.$eval('[data-campaign-budget]', node => node.innerText), /336,44\s*€/); await shot('refresh-recovered-new-price');
  checks.push({ scenario: 'refresh-after-known', staleAmountHiddenWhileLoading: true, failureBlocks: true, recoveredWithNewServerPrice: true });
  await closed(); await page.evaluate(() => window.__control.set('loading')); await enter('[data-culture-start-review]'); await page.waitForFunction(() => window.__energyPending); await assertBlocked();
  await page.evaluate(() => window.__control.resolve()); await ready(); await closed(); checks.push({ scenario: 'reopen-review', priorQuoteCannotEnableLaunchWhileReloading: true });
  await open('zero'); await ready(); assert.match(await page.$eval('[data-campaign-budget]', node => node.innerText), /^0(?:,00)?\s*€/); await closed(); checks.push({ scenario: 'actual-server-zero', genuineZeroRemainsValid: true });
  await open('known'); await ready(); await enter('[data-culture-confirm-start]'); await page.waitForFunction(() => window.__starts.length === 1 && document.body.innerText.includes('Lancement indisponible dans la recette locale'));
  await ready(); await enter('[data-culture-confirm-start]'); await page.waitForFunction(() => window.__starts.length === 2); await ready();
  const starts = await page.evaluate(() => window.__starts); assert.equal(starts[0].expectedEnergyCents, 12345); assert.equal(starts[0].campaign, true); assert.equal(starts[0].requestKey, starts[1].requestKey); assert.equal(starts[0].zoneId, undefined); assert.equal(starts[0].expectedWarehouseRevision, await page.evaluate(() => window.__fixture.revision));
  assert.equal(await page.evaluate(() => window.__production.game), null); checks.push({ scenario: 'local-launch-retry', offeredEnergySent: 12345, reviewedWarehouseRevisionSent: starts[0].expectedWarehouseRevision, campaign: true, sameRequestKey: true, local503Only: true });
  const recoveryBefore = await page.evaluate(() => ({ reads: window.__calls.length, starts: window.__starts.length, ...window.__control.reassign() }));
  await enter('[data-culture-refresh-preparation]'); await page.waitForFunction(() => !document.querySelector('[data-app-dialog]'));
  await page.waitForFunction(previous => window.__calls.slice(previous).some(call => call.path.endsWith('/bootstrap')) && window.__calls.slice(previous).some(call => call.path.endsWith('/warehouse')), {}, recoveryBefore.reads);
  await page.waitForSelector('[data-culture-start-review]:not(:disabled)'); assert.equal(await page.evaluate(() => window.__starts.length), recoveryBefore.starts);
  const recoveryFocus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, review: document.activeElement?.hasAttribute('data-culture-start-review') }));
  assert.equal(recoveryFocus.review, true, 'Refreshing the preparation returns keyboard focus to its review action');
  await page.evaluate(() => window.__control.set('loading')); await enter('[data-culture-start-review]'); await page.waitForFunction(() => window.__energyPending);
  assert.equal(await page.$eval('[data-culture-confirm-start]', node => node.disabled), true); assert.equal(await page.$('[data-campaign-budget]'), null);
  await page.evaluate(() => window.__control.resolve()); await ready(); await enter('[data-culture-launch-participants] > summary');
  assert((await page.$eval('[data-culture-launch-participants]', node => node.innerText)).includes(recoveryBefore.name), 'Refreshed review contains the new Buddie from the updated plan');
  await shot('preparation-recovery-new-buddie'); assert.equal(await page.evaluate(() => window.__starts.length), recoveryBefore.starts); await closed();
  checks.push({ scenario: 'refresh-preparation-after-error', rereadsBootstrapAndWarehouse: true, newBuddie: recoveryBefore.name, revision: recoveryBefore.revision, newQuoteRequired: true, noAutomaticPost: true, focus: recoveryFocus });
  assert.deepEqual(errors, []); assert.deepEqual(external, []); report.passed = true;
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: true, checks: checks.length, errors, external, output }));
} catch (error) {
  report.error = String(error?.stack ?? error); if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); report.text = await page.evaluate(() => document.body.innerText).catch(() => null); }
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); throw error;
} finally {
  const timer = setTimeout(() => { browser?.process()?.kill(); server.httpServer?.closeAllConnections(); }, 5000);
  try { await browser?.close(); server.httpServer?.closeAllConnections(); await server.close(); } finally { clearTimeout(timer); }
}
