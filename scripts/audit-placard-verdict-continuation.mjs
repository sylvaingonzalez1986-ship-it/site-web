/** Real shell → jury → exact commerce lot, isolated from every remote API. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-verdict-continuation');
const port = Number(process.env.KQ_VERDICT_CONTINUATION_PORT ?? 3420), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const targetId = '00000000-0000-4000-8000-000000000002', decoyId = '00000000-0000-4000-8000-000000000001';
const entry = `
import React from 'react';import{createRoot}from'react-dom/client';import'/src/app/globals.css';
import{PlacardPlayerShell}from'/src/components/placard/PlacardPlayerShell';
import{KqTutorialApiProvider,createKqTutorialApi}from'/src/components/placard/KqTutorialApiContext';
import{createKqOperationsLesson,getKqOperationsCommerce,getKqOperationsEquipment,getKqOperationsEnergy,getKqOperationsStorage}from'/src/lib/kanab-quest-operations-lesson';
import{createKqWarehouseStarter}from'/src/lib/kanab-quest-warehouse';
import{KQ_BUDDIES}from'/src/lib/kanab-quest-game';
const scenario=new URLSearchParams(location.search).get('scenario')||'training';
if(!new URLSearchParams(location.search).has('view'))history.replaceState(null,'','?scenario='+scenario+'&view=arena&flower=${targetId}');
const official=scenario.startsWith('official'),missingId=scenario==='official-missing-id';
const lesson=createKqOperationsLesson('market'),base=getKqOperationsCommerce(lesson);
const targetId='${targetId}',decoyId='${decoyId}',battleId='00000000-0000-4000-8000-000000000003';
const date='2026-10-21T10:00:00.000Z',stats=lesson.trial.battle.playerFlower.stats;
const flower={id:targetId,runId:'00000000-0000-4000-8000-000000000004',varietyCode:KQ_BUDDIES[0].code,varietyName:'Cherry Abacus',quality:84,traits:[],combos:[],stats,status:official?'locked':'available',createdAt:date,queuedAt:null,lockedAt:official?date:null,burnedAt:null};
const rounds=structuredClone(lesson.trial.battle.rounds),winner=lesson.trial.battle.winner;
let finished=false,commerceError=scenario==='training-commerce-error'||scenario==='training-malformed-commerce';
const battle=()=>({id:battleId,status:finished?'verdict':'locked',seed:123,playerFlower:{...(missingId?{}:{id:targetId}),variety:flower.varietyName,stats},opponentFlower:{id:'00000000-0000-4000-8000-000000000005',variety:'Carmagnola',stats:lesson.trial.battle.opponentFlower.stats},rounds:finished?rounds:[],winner:finished?winner:null,lockedAt:date,verdictAt:finished?date:null,opponentType:official?'human':'bot',experienceAwarded:100});
const session=()=>({activeRun:null,activeRuns:[],flowers:[{...flower,id:decoyId,status:'available'},{...flower,status:finished?'burned':flower.status,burnedAt:finished?date:null}],battles:official||finished?[battle()]:[],progress:null});
const raw=base.rawLots[0];
const commerce={...base,rawLots:[{...raw,flowerId:decoyId,varietyName:flower.varietyName},...(scenario==='training-missing-lot'?[]:[{...raw,flowerId:targetId,varietyName:flower.varietyName}])],stocks:[]};
window.__calls=[];window.__unexpected=[];window.__fixture=()=>structuredClone({scenario,finished,commerce,session:session()});window.__control={commerceError:value=>commerceError=value};
const response=(payload,status=200)=>Response.json(payload,{status});
const request=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),path=url.pathname,method=init.method??'GET',body=init.body?JSON.parse(init.body):null;
 window.__calls.push({path,method,body});
 if(method==='POST'&&(path.endsWith('/bot-battles')||path.endsWith('/'+battleId+'/verdict'))){
  await new Promise(done=>setTimeout(done,100));finished=true;
  return response({battleId,status:'verdict',rounds,winner,burnedAt:date,experienceAwarded:100,todayCount:1,dailyLimit:5,opponentType:official?'human':'bot',opponentFlower:{...battle().opponentFlower,ownerName:'Adversaire de recette'},challengePoints:0,opponentChallengePoints:0,claimedChallengeCodes:[],completedChallenges:[],rewardCard:null,pvpBoosterGranted:false,pvpBoosterCardCount:0,rankProfile:null,replayed:false});
 }
 if(method!=='GET'){window.__unexpected.push({path,method,body});return response({error:'Mutation désactivée dans cette recette.'},403)}
 if(finished&&(path.endsWith('/flowers')||path.endsWith('/battles')))await new Promise(done=>setTimeout(done,180));
 if(path.endsWith('/bootstrap'))return response({collection:{ownerFound:true,collectionActive:true,inventory:{},availableInventory:{},cards:[]},ownedBuddieCodes:[flower.varietyCode],playerSession:session(),heritage:{cards:[]}});
 if(path.endsWith('/session'))return response(session());
 if(path.endsWith('/warehouse'))return response({state:createKqWarehouseStarter(),revision:0});
 if(path.endsWith('/flowers'))return response({flowers:session().flowers});
 if(path.endsWith('/battles'))return scenario==='training-missing-archive'&&finished?response({error:'Historique temporairement indisponible.'},503):response({battles:session().battles});
 if(path.endsWith('/commerce'))return commerceError?(scenario==='training-malformed-commerce'?response({...commerce,rawLots:null}):response({error:'Comptoir temporairement indisponible.'},503)):response(commerce);
 if(path.endsWith('/equipment'))return response({...getKqOperationsEquipment(lesson),readyLotCount:2,availableFlowerCount:finished?1:2,routeMasteries:[]});
 if(path.endsWith('/storage'))return response(getKqOperationsStorage(lesson));
 if(path.endsWith('/energy'))return response(getKqOperationsEnergy(lesson));
 if(path.endsWith('/rankings'))return response({entries:[]});
 if(path.endsWith('/me'))return response({progress:null});
 if(path.endsWith('/contracts'))return response({error:'Les contrats ne font pas partie de cette recette.'},404);
 window.__unexpected.push({path,method});return response({error:'Lecture absente de cette recette.'},404);
};
const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.origin);return url.pathname.startsWith('/api/')?request(input,init):originalFetch(input,init)};
const api=createKqTutorialApi(request);api.isTutorial=false;
localStorage.clear();sessionStorage.clear();
createRoot(document.getElementById('root')).render(<KqTutorialApiProvider api={api}><aside className="fixture-tools"><strong>Démo locale · du jury au bon lot</strong><p>Deux récoltes homonymes, données en mémoire. Aucun compte ni achat réel.</p><label>Situation <select value={scenario} onChange={event=>location.href='/?scenario='+event.target.value+'&view=arena&flower='+targetId}>{['training','official','training-missing-lot','official-missing-id','training-commerce-error','training-missing-archive'].map(value=><option key={value}>{value}</option>)}</select></label></aside><PlacardPlayerShell draftOwnerId="verdict-local-fixture"/></KqTutorialApiProvider>);
`;
const modules = {
  entry,
  'next/image': `import React from'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/dynamic': `import React from'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
  '@/context/CartContext': `export const useCart=()=>({user:{id:'00000000-0000-4000-8000-000000000099'},isAuthenticated:true,authLoading:false,refreshSession:async()=>{}});`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}.fixture-tools{padding:12px 18px;font:12px Body;background:#182b24;color:#fff1d6}.fixture-tools p{margin:5px 0}.fixture-tools select{max-width:100%;margin-left:8px;color:#182b24}`;
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react', '@3d-dice/dice-box-threejs'] },
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'verdict-continuation-audit', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
    configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('Real API disabled'); return; } if (req.url?.split('?')[0] !== '/') return next(); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Du jury au bon lot · démo locale</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`); }); },
  }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const results = [], errors = [], forbiddenRequests = [];
let browser, page;
await mkdir(output, { recursive: true }); await server.listen();
if (preview) {
  console.log(`Local verdict continuation demo: ${origin} (PID ${process.pid}). In-memory data only.`);
  await new Promise(resolveStop => { const stop = () => { void server.close().then(resolveStop); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); });
} else try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => { const url = new URL(request.url()); if (['data:', 'blob:'].includes(url.protocol)) return void request.continue(); if (url.origin !== origin || url.pathname.startsWith('/api/')) { forbiddenRequests.push(request.url()); return void request.abort(); } void request.continue(); });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const keyClick = async selector => { await page.waitForSelector(selector, { visible: true }); await page.focus(selector); await page.keyboard.press('Enter'); };
  const fixture = () => page.evaluate(() => window.__fixture());
  const mutations = () => page.evaluate(() => window.__calls.filter(call => call.method !== 'GET'));
  const text = selector => page.$eval(selector, node => node.textContent);
  async function layout() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow'); }
  async function screenshot(name) { await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))); await page.screenshot({ path: resolve(output, name + '.png'), fullPage: false }); }
  async function showVerdict(scenario, width) {
    await page.setViewport({ width, height: width === 320 ? 720 : width === 390 ? 844 : 1000 });
    await page.goto(`${origin}/?scenario=${scenario}&view=arena&flower=${targetId}`, { waitUntil: 'networkidle0' }); await page.evaluate(() => document.fonts.ready);
    if (scenario.startsWith('official')) { await keyClick('[data-pending-battle] button'); await keyClick('[data-culture-confirm-verdict]'); }
    else { await keyClick(`[data-culture-training-flower="${targetId}"]`); await keyClick('[data-culture-confirm-training]'); }
    await page.waitForSelector('[data-verdict-result][open]', { visible: true });
    await page.waitForFunction(() => window.__calls.some(call => call.path.endsWith('/battles') && call.method === 'GET'));
    await page.evaluate(() => new Promise(done => setTimeout(done, 250)));
    assert.equal((await mutations()).length, 1, 'Only explicit jury resolution mutates the fixture');
    assert.equal(await page.$eval('[data-verdict-analysis]', node => node.open), false, 'Analysis remains optional');
    assert(await page.$eval('[data-verdict-continuation]', node => node.getBoundingClientRect().height > 0 && !node.closest('details')), 'Commercial result visible outside collapsed analysis');
    assert.match(await text('[data-verdict-continuation]'), /comptoir|offres/i);
    await layout();
  }
  for (const width of [1440, 390, 320]) for (const scenario of ['training', 'official']) {
    await showVerdict(scenario, width); const before = (await fixture()).commerce;
    await page.waitForSelector('[data-verdict-open-lot]', { visible: true });
    const footer = await page.$eval('[data-verdict-open-lot]', node => { const box = node.getBoundingClientRect(); return { height: box.height, bottom: box.bottom, top: box.top, viewport: innerHeight }; });
    assert(footer.height >= 44 && footer.top >= 0 && footer.bottom <= footer.viewport + 1, 'Primary lot action is visible and touch friendly');
    await screenshot(`${scenario}-verdict-${width}`);
    await keyClick('[data-verdict-open-lot]');
    await page.waitForSelector(`[data-commerce-flower="${targetId}"]`, { visible: true });
    assert.equal(new URL(page.url()).searchParams.get('flower'), targetId);
    assert.equal(new URL(page.url()).searchParams.get('view'), 'market');
    assert.equal(await page.$eval('[data-commerce-flower]', node => node.dataset.commerceLot), 'raw:' + targetId, 'Exact homonymous lot selected');
    await page.waitForFunction(() => document.activeElement?.matches('[data-commerce-view-heading]'));
    await layout(); await screenshot(`${scenario}-comptoir-${width}`);
    assert.deepEqual((await fixture()).commerce, before, 'Navigation does not prepare or sell the lot');
    assert.equal((await mutations()).length, 1);
    results.push({ scenario, width, result: 'jury receipt → exact homonymous lot, focus, keyboard, no commerce mutation' });
    console.log('Verified ' + scenario + ' at ' + width + 'px');
  }
  await showVerdict('training-missing-lot', 390); await keyClick('[data-verdict-open-lot]');
  await page.waitForSelector(`[data-screen="missing-lot"][data-commerce-missing-flower="${targetId}"]`, { visible: true });
  assert.equal(await page.$('[data-commerce-flower]'), null, 'Missing lot never silently selects the homonym');
  await screenshot('missing-lot-390'); await keyClick('[data-commerce-other-lots]');
  await page.waitForSelector('[data-screen="lots"]', { visible: true });
  assert.equal(await page.$('[data-commerce-flower]'), null, 'Other lots require an explicit choice');
  assert.equal((await mutations()).length, 1); results.push({ scenario: 'missing exact lot: explicit warning, no substitute selected' });
  await showVerdict('official-missing-id', 320);
  assert.equal(await page.$('[data-verdict-open-lot]'), null, 'Historical battle with missing identity never routes to another flower');
  assert(await page.$('[data-verdict-prepare]')); await screenshot('official-missing-id-320');
  results.push({ scenario: 'missing official flower identity: preparation available, no false exact-lot action' });
  await showVerdict('training-missing-archive', 390); await keyClick('[data-verdict-open-lot]');
  await page.waitForSelector(`[data-commerce-flower="${targetId}"]`, { visible: true });
  assert.equal((await mutations()).length, 1); results.push({ scenario: 'training identity survives failed battle archive refresh' });
  for (const scenario of ['training-commerce-error', 'training-malformed-commerce']) {
  await showVerdict(scenario, 390); await keyClick('[data-verdict-open-lot]');
  await page.waitForSelector('[role="alert"] button', { visible: true });
  assert.equal(await page.$('[data-commerce-flower]'), null); assert.equal(await page.$('[data-screen="missing-lot"]'), null);
  await screenshot(scenario + '-390');
  await page.evaluate(() => window.__control.commerceError(false));
  await keyClick('[role="alert"] button');
  await page.waitForSelector(`[data-commerce-flower="${targetId}"]`, { visible: true });
  assert.equal((await mutations()).length, 1); results.push({ scenario: scenario + ': retry preserves exact identity and only reads' });
  }
  assert.deepEqual(await page.evaluate(() => window.__unexpected), [], 'Every API call is explicitly covered by the local fixture');
  assert.deepEqual(errors, [], 'No uncaught browser errors'); assert.deepEqual(forbiddenRequests, [], 'No remote or real API requests');
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ ok: true, checks: results.length, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: results.length, output }));
} catch (error) {
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {}); await writeFile(resolve(output, 'failure.html'), await page.content()).catch(() => {}); }
  const calls = page ? await page.evaluate(() => window.__calls).catch(() => []) : [];
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ ok: false, results, error: String(error.stack ?? error), errors, forbiddenRequests, calls }, null, 2)); throw error;
} finally { if (!preview) { await browser?.close(); await server.close(); } }
