/** Isolated playable preview. Real culture transport + production contract SQL, no accounts or environment files.
 * Uses La Relève's unmodified seed 2 / firstCultureRescue and a prepared 1 m² room.
 * This verifies the playable flow and SQL reward, not production difficulty or economy.
 * --renewable adds the actual optional contract board and successive local cultures.
 * The explicit reset creates a fresh in-memory fixture.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { createContractFixture } from './lib/placard-contracts-fixture.mjs';

const renewable = process.argv.includes('--renewable');
const root = process.cwd(), port = Number(process.env.PLACARD_CONTRACT_PREVIEW_PORT ?? (renewable ? 3287 : 3282)), origin = `http://127.0.0.1:${port}`;
const output = resolve(root, renewable ? 'output/placard-renewable-playable' : 'output/placard-contract-playable'), audit = process.argv.includes('--audit');
let fixture, owner, production, transport, engine, browser, server;
let queue = Promise.resolve(), generation = 0, cycle = 1, archives = [];
const requests = [], errors = [];
const serial = task => { const result = queue.then(task); queue = result.catch(() => {}); return result; };

const entry = `
import React,{useEffect,useMemo,useState} from 'react';import{createRoot}from'react-dom/client';
import'/src/app/globals.css';import{KanabQuestDicePrototype}from'/src/components/placard/KanabQuestDicePrototype';
import{KqPlacardMap}from'/src/components/placard/KqPlacardMap';import{KqCultureContract}from'/src/components/placard/KqCultureContract';
import{createKqTutorialApi,KqTutorialApiProvider}from'/src/components/placard/KqTutorialApiContext';
import{KqGameSoundProvider,useKqGameSound}from'/src/components/placard/KqGameSound';
import retro from'/src/components/contest/ArenaRetro.module.css';
const renewable=${renewable};
const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==location.origin)return Promise.reject(new Error('Cet aperçu refuse les connexions distantes.'));return nativeFetch(input,init);};
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
function App(){
 const[view,setView]=useState(new URLSearchParams(location.search).get('view')||(renewable?'missions':'game')),[summary,setSummary]=useState(null),[notice,setNotice]=useState('');
 const sound=useKqGameSound();
 const storage=useMemo(()=>({persistent:memory(),session:memory()}),[]);
 const refresh=async()=>{const response=await fetch('/__preview/state');if(response.ok)setSummary(await response.json());};
 const api=useMemo(()=>{const local=createKqTutorialApi(async(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/api/arena/placard/'))return Response.json({error:'Cette activité ne fait pas partie de cet aperçu.'},{status:404});const response=await fetch(url.pathname+url.search,init);if((init?.method??'GET')!=='GET')await refresh();return response;});local.isTutorial=false;return local;},[]);
 useEffect(()=>{void refresh();},[]);
 function open(next){setNotice('');if(['game','hub','missions','arena'].includes(next)){setView(next);history.replaceState(null,'','?view='+next);}else setNotice('Cet aperçu permet de jouer la culture, le contrat et le jury. Les autres activités restent dans le jeu complet.');}
 async function reset(){if(!window.confirm('Recommencer cet aperçu ? Sa culture, son contrat et sa caisse locale seront remis à zéro. Aucun compte réel ne sera touché.'))return;const response=await fetch('/__preview/reset',{method:'POST'});if(response.ok)location.assign('/?view=game');else setNotice('La nouvelle partie n’a pas pu démarrer.');}
 async function nextCulture(){const response=await fetch('/__preview/next',{method:'POST'});const result=await response.json();if(response.ok)location.assign('/?view=game');else setNotice(result.error||'La prochaine culture ne peut pas encore démarrer.');}
 return <KqTutorialApiProvider api={api}><div className={retro.surface} data-playable-contract-preview>
 <header className="preview-head"><div><strong>Partie isolée · {renewable?'contrats renouvelables':'culture et contrat'}</strong><p>{renewable?'Main légère déjà validé dans cette partie d’essai : 1 000 € de départ + 30 € de prime. Choisis un contrat avant de lancer ta culture.':'Entrepôt préparé, 1 000 € de jeu.'} Aucun compte réel. La partie reste disponible après actualisation et disparaît à l’arrêt de cet aperçu.</p><details><summary>Conditions de cet essai</summary><p>Cette partie utilise les paramètres de La Relève : tirages reproductibles et secours de première culture. Les décisions, les soins et les cartes restent à jouer. Elle permet de tester le parcours ; elle ne mesure pas l’équilibrage de la production. {renewable?'Après chaque bilan, « Nouvelle culture » conserve tes comptes, tes cartes et les cultures enregistrées. Le prochain Buddie suit la rotation ; le jury affiche la culture courante.':'Une campagne par partie : utilise « Recommencer l’aperçu » pour rejouer.'}</p></details></div><div className="preview-buttons">{renewable&&summary?.game?.phase==='complete'?<button type="button" data-preview-next onClick={nextCulture}>Nouvelle culture</button>:null}<button type="button" onClick={reset}>Recommencer l’aperçu</button></div></header>
 <nav className="preview-nav" aria-label="Activités de cet aperçu">{[['hub','Mon quartier'],['game','Ma culture'],['missions','Mon contrat'],['arena','Jury & duels']].map(([id,label])=><button key={id} type="button" data-preview-view={id} aria-current={view===id?'page':undefined} onClick={()=>open(id)}>{label}</button>)}<button type="button" data-preview-sound aria-pressed={sound.enabled} onClick={sound.toggle}>Son {sound.enabled?'actif':'coupé'}</button><span data-preview-cash>{summary?new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(summary.cashCents/100):'…'} de jeu</span></nav>
 {notice?<p className="preview-notice" role="status">{notice}</p>:null}
 <main>{!summary?<p role="status">Préparation de ta partie isolée…</p>:view==='hub'?<KqPlacardMap isolated cashCents={summary.cashCents} tents={1} activeRun={summary.activeRun} availableFlowerCount={summary.availableFlowerCount} recommended={summary.activeRun?'game':summary.availableFlowerCount?'arena':'game'} onOpen={open} onOpenCollection={()=>open('collection')}/>:view==='missions'?<div className="preview-contract"><KqCultureContract mode="missions" onOpenGame={()=>open('game')}/></div>:<KanabQuestDicePrototype apiScope="player" showAdminOperations={false} showWarehouseNavigation={false} initialCampaign viewMode={view==='arena'?'arena':'game'} initialPreparation={summary.preparation} isolatedStorage={storage} onOpenWarehouse={()=>open('workshop')} onOpenArena={()=>open('arena')} onOpenGame={()=>open('game')} onOpenMarket={()=>open('market')} onOpenRun={()=>open('game')}/>}</main>
 </div></KqTutorialApiProvider>;
}createRoot(document.getElementById('root')).render(<KqGameSoundProvider><App/></KqGameSoundProvider>);`;

const modules = {
  'playable-preview': entry,
  'next/image': `import React from'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){const click=event=>{props.onClick?.(event);if(!event.defaultPrevented&&props.href?.startsWith('/arene/placard')){event.preventDefault();const view=new URL(props.href,location.origin).searchParams.get('view')||'game';document.querySelector('[data-preview-view="'+view+'"]')?.click();}};return <a {...props} onClick={click}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/dynamic': `import React from'react';export default function dynamic(loader,options={}){const C=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=><React.Suspense fallback={options.loading?<options.loading/>:null}><C {...props}/></React.Suspense>}`,
};
const styles = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#fff1d6}.preview-head{display:flex;align-items:center;gap:20px;justify-content:space-between;padding:16px 24px;border-bottom:2px solid #172923;background:#fff1d6;color:#172923;font:13px/1.6 Body,Arial}.preview-head p{margin:4px 0 0;max-width:80ch}.preview-buttons{display:flex;flex-wrap:wrap;gap:8px}.preview-head button,.preview-nav button{min-height:44px;padding:10px 14px;border:2px solid #172923;border-radius:12px;background:#fff1d6;color:#172923;font:700 13px Body,Arial;cursor:pointer}.preview-nav{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:14px 24px;border-bottom:2px solid #172923;background:#fff1d6}.preview-nav [aria-current=page]{background:#efc451}.preview-nav span{margin-left:auto;font-weight:750}.preview-notice,.preview-contract{margin:20px auto;padding:0 16px;max-width:980px}main{max-width:1440px;margin:auto}button:focus-visible{outline:3px solid #149b8b;outline-offset:3px}@media(max-width:600px){.preview-head{align-items:stretch;flex-direction:column;gap:10px;padding:12px}.preview-nav{padding:12px;gap:7px}.preview-nav span{width:100%;margin:4px 0 0}.preview-nav button{flex:1}}
`;

async function readBody(request) {
  let body = '';
  for await (const chunk of request) { body += chunk; if (body.length > 150_000) throw new Error('Requête locale trop volumineuse.'); }
  return body;
}
async function summary() {
  const flowers = engine.culture.getReleveNativeFlowers(production);
  return { generation, cycle, renewable, cashCents: production.cashCents, activeRun: Boolean(production.game && production.game.phase !== 'complete'),
    availableFlowerCount: flowers.filter(flower => flower.status === 'available').length,
    preparation: { deckCodes: production.deckCodes, heritageCode: production.heritageCode },
    previewParameters: { source: 'La Relève', seed: 2, firstCultureRescue: true, preparedWarehouse: true, productionBalanceAudit: false },
    contract: await fixture.snapshot(owner), ...(renewable ? { board: await contractBoard(), archivedCultures: archives.length } : {}),
    game: production.game, currentHandCount: production.game ? engine.game.getKqHandCodes(production.game).length : 0, handCapacity: engine.game.KQ_HAND_SIZE, ledger: production.ledger };
}
const contractBoard = () => fixture.scalar('SELECT rpc_kq_contract_board($1)', [owner]);
const contractAction = command => fixture.scalar('SELECT rpc_kq_contract_board_action($1,$2,$3,$4)', [owner, command.action, command.code ?? null, command.attemptId]);
function resetTransport() {
  transport = engine.culture.createReleveCultureTransport({ getState: () => production, setState: value => { production = value; } });
}
async function seedHistoricalLightHand() {
  // A completed historical fixture unlocks the same SQL gate as the real game.
  // This is explicit in the preview header and never becomes the current culture.
  await fixture.action(owner, 'accept');
  const runId = randomUUID();
  await fixture.db.query('INSERT INTO kq_runs(id,user_id,state) VALUES($1,$2,$3)', [runId, owner, { phase: 'prepare', quality: 0, usedCards: [] }]);
  await fixture.db.query("UPDATE kq_runs SET status='completed',state=$2,completed_at=now() WHERE id=$1", [runId, { phase: 'complete', quality: 8, harvestGrams: 100, usedCards: [] }]);
  await fixture.db.query('INSERT INTO kq_flowers(run_id,owner_id,quality) VALUES($1,$2,8)', [runId, owner]);
  const earned = await fixture.action(owner, 'claim');
  assert.equal(earned.cashAfterCents, 103000);
}
async function reset() {
  const previous = fixture;
  fixture = await createContractFixture({ renewable }); owner = await fixture.player();
  if (renewable) await seedHistoricalLightHand();
  let next = engine.production.createKqReleveProduction();
  const act = action => { next = engine.production.applyKqReleveProductionAction(next, action); };
  act({ type: 'draft', warehouse: engine.production.suggestKqRelevePlan(next) }); act({ type: 'save-plan' });
  for (let index = 0; index < 3; index++) act({ type: 'reveal-buddie' });
  act({ type: 'assign', zoneId: next.warehouse.zones[0].id, buddieCode: 'HH2026-005' }); act({ type: 'save-plan' });
  // The prepared room is this preview's starting kit, not a purchase from its wallet.
  production = { ...next, cashCents: renewable ? 103000 : 100000, ledger: [], clock: Date.now() };
  resetTransport();
  generation++; cycle = 1; archives = [];
  await previous?.db.close();
}
async function nextCulture() {
  if (!renewable || production.game?.phase !== 'complete') throw new Error('Termine la culture actuelle avant de préparer la suivante.');
  const board = await contractBoard();
  if (board.current?.status === 'succeeded') throw new Error('Récupère la prime de ton contrat avant de préparer la prochaine culture.');
  const available = production.ownedBuddies.find(code => !engine.rotation.getKqBuddieRotationRemaining(code, production.recentBuddieCodes));
  if (!available) throw new Error('Aucun Buddie de cette partie d’essai n’est disponible dans la rotation.');
  const before = production;
  let next = { ...production, game: null, checkpoint: null, battles: {}, revealedRounds: {}, clock: Date.now(),
    milestones: production.milestones.filter(value => !value.startsWith('jury-') && !['launched', 'harvested', 'health-read', 'recap-read', 'card-played', 'care-used'].includes(value)) };
  next = engine.production.applyKqReleveProductionAction(next, { type: 'assign', zoneId: next.warehouse.zones[0].id, buddieCode: available });
  next = engine.production.applyKqReleveProductionAction(next, { type: 'save-plan' });
  archives.push({ game: structuredClone(before.game), battles: structuredClone(before.battles) });
  production = next; cycle++; resetTransport();
  await synchronize();
}
function giveCultureUniqueIdentity(payload) {
  // La Relève teaches one culture using fixed identifiers. The isolated
  // renewable preview substitutes fresh identities before persistence, without
  // changing choices, random draws, costs, equipment, or the game's code.
  const campaign = production.game?.campaign;
  if (!campaign) throw new Error('La culture locale n’a pas de manifeste.');
  const replacements = [[campaign.id, randomUUID()], ...campaign.members.map(member => [member.runId, randomUUID()])];
  const replace = value => {
    let json = JSON.stringify(value);
    for (const [previous, next] of replacements) json = json.replaceAll(previous, next);
    return JSON.parse(json);
  };
  production = replace(production);
  resetTransport(); // Cached launch responses must not retain the tutorial UUIDs.
  return replace(payload);
}
async function synchronize() {
  await fixture.db.transaction(async tx => {
    const game = production.game;
    if (game?.campaign) {
      const campaign = game.campaign;
      await tx.query('INSERT INTO kq_culture_campaigns(id,user_id,leader_run_id,manifest) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING', [campaign.id, owner, campaign.leaderRunId, campaign]);
      for (const member of campaign.members) {
        const memberState = member.runId === campaign.leaderRunId ? game : engine.campaign.getKqCampaignMemberState(game, member);
        const completed = memberState.phase === 'complete';
        // The real identity and binding triggers run at first insertion. Each following action updates that same run.
        await tx.query("INSERT INTO kq_runs(id,user_id,state,campaign_id,status,started_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET state=excluded.state,status=excluded.status,updated_at=now(),completed_at=excluded.completed_at", [member.runId, owner, memberState, campaign.id, completed ? 'completed' : 'active', memberState.startedAt, completed ? memberState.completedAt ?? new Date().toISOString() : null]);
      }
      for (const harvest of engine.production.getKqReleveHarvests(production)) {
        if (harvest.game.cultureDead || !(harvest.game.harvestGrams > 0)) continue;
        const member = campaign.members.find(item => item.zoneId === harvest.zoneId);
        await tx.query('INSERT INTO kq_flowers(run_id,owner_id,quality) VALUES($1,$2,$3) ON CONFLICT(run_id) DO NOTHING', [member.runId, owner, harvest.game.quality]);
      }
    }
    await tx.query('UPDATE kq_equipment_wallets SET cash_cents=$2,updated_at=now() WHERE user_id=$1 AND cash_cents<>$2', [owner, production.cashCents]);
  });
}
async function route(request, url, body) {
  if (url.pathname === '/__preview/state' && request.method === 'GET') return Response.json(await summary());
  if (url.pathname === '/__preview/reset' && request.method === 'POST') { await reset(); return Response.json(await summary()); }
  if (url.pathname === '/__preview/next' && request.method === 'POST' && renewable) { await nextCulture(); return Response.json(await summary()); }
  if (!url.pathname.startsWith('/api/arena/placard/')) return Response.json({ error: 'Activité hors de cet aperçu.' }, { status: 404 });
  if (url.pathname === '/api/arena/placard/contracts') {
    if (request.method === 'GET') return Response.json(await fixture.snapshot(owner));
    const command = JSON.parse(body || '{}');
    const result = await fixture.action(owner, command.action, command.code);
    production = { ...production, cashCents: await fixture.scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1', [owner]) };
    return Response.json(result);
  }
  if (url.pathname === '/api/arena/placard/contracts/board') {
    if (!renewable) return Response.json({ error: 'Contrats renouvelables absents de cet aperçu.' }, { status: 404 });
    if (request.method === 'GET') return Response.json(await contractBoard());
    const result = await contractAction(JSON.parse(body || '{}'));
    production = { ...production, cashCents: await fixture.scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1', [owner]) };
    return Response.json(result);
  }
  if (url.pathname === '/api/arena/placard/runs' && request.method === 'POST' && production.game?.phase === 'complete') {
    return Response.json({ error: renewable ? 'Cette culture est terminée. Utilise « Nouvelle culture » pour préparer le prochain Buddie.' : 'Cette campagne d’essai est terminée. Utilise « Recommencer l’aperçu » pour rejouer une partie isolée.' }, { status: 409 });
  }
  const original = production, before = structuredClone(production);
  let response = await transport(url.pathname + url.search, { method: request.method, ...(body ? { body } : {}) });
  if (response.ok && production !== original) {
    try {
      if (renewable && !before.game && production.game && url.pathname === '/api/arena/placard/runs' && request.method === 'POST') {
        response = Response.json(giveCultureUniqueIdentity(await response.json()));
      }
      await synchronize();
    } catch (error) { production = before; resetTransport(); throw error; }
  }
  return response;
}

try {
  await mkdir(output, { recursive: true });
  server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
    optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react', '@3d-dice/dice-box-threejs'] },
    resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
    plugins: [{ name: 'playable-contract-preview', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; },
      async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
      configureServer(vite) { vite.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', origin);
        if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__preview/')) {
          if (!['GET', 'POST'].includes(request.method) || request.headers.origin && request.headers.origin !== origin) { response.writeHead(403); response.end(); return; }
          void readBody(request).then(body => serial(async () => {
            requests.push({ path: url.pathname, method: request.method });
            let result;
            try { result = await route(request, url, body); } catch (error) { result = Response.json({ error: error.message }, { status: 400 }); }
            response.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(await result.text());
          })).catch(error => { response.writeHead(400); response.end(JSON.stringify({ error: error.message })); }); return;
        }
        if (!['/', '/arene/placard'].includes(url.pathname)) return next();
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval'; connect-src 'self'; worker-src 'self' blob:; font-src 'self'; frame-src 'none'");
        response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Partie isolée · Main légère</title><link rel="icon" href="data:,"><style>${styles}</style><div id="root"></div><script type="module" src="/@id/__x00__playable-preview"></script></html>`);
      }); },
    }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
  });
  engine = { production: await server.ssrLoadModule('/src/lib/kanab-quest-releve-production.ts'), culture: await server.ssrLoadModule('/src/lib/kanab-quest-releve-culture.ts'), campaign: await server.ssrLoadModule('/src/lib/kanab-quest-campaign.ts'), rotation: await server.ssrLoadModule('/src/lib/kanab-quest-buddie-rotation.ts'), game: await server.ssrLoadModule('/src/lib/kanab-quest-game.ts') };
  await reset(); await server.listen();
  console.log(`Aperçu jouable isolé : ${origin}/ — vraie culture et contrat SQL, aucun compte réel. Actualiser conserve la partie ; arrêter le serveur l’efface.`);
  if (audit) {
    const { Launcher } = await import('chrome-launcher'), { default: puppeteer } = await import('puppeteer-core');
    browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const page = await browser.newPage(); page.setDefaultTimeout(25000);
    await page.setViewport({ width: 1440, height: 1000 }); await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true); page.on('request', request => { const url = new URL(request.url()); if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) void request.continue(); else { errors.push('Remote request blocked: ' + url.origin + url.pathname); void request.abort(); } });
    await page.goto(origin, { waitUntil: 'networkidle0' });
    if (renewable) {
      await page.waitForSelector('[data-renewable-offer="pure-grower"]');
      assert.equal(production.cashCents, 103000, 'The explicitly seeded Main légère reward is the only starting supplement');
      await page.screenshot({ path: resolve(output, 'renewable-offers.png'), fullPage: true });
      await page.click('[data-renewable-offer="pure-grower"] [data-renewable-action="accept"]');
      await page.click('[data-preview-view="game"]');
    } else {
      await page.waitForSelector('[data-kq-contract][data-contract-status="available"]');
      await page.click('[data-kq-contract] summary'); await page.click('[data-contract-action="accept"]');
    }
    await page.waitForSelector('[data-contract-status="accepted"]');
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('[data-contract-status="accepted"]');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Lancer la campagne'))?.click());
    await page.waitForSelector('[data-culture-confirm-start]:not(:disabled)'); await page.click('[data-culture-confirm-start]');
    await page.waitForSelector('[data-contract-status="active"]');
    const started = await summary(); assert(started.game?.campaign?.leaderRunId); assert.equal(renewable ? started.board.current.runId : started.contract.runId, started.game.campaign.leaderRunId);
    const openingHandCounts = [started.currentHandCount];
    assert.equal(started.currentHandCount, 10, 'The prepared real deck distributes ten owned copies');
    assert.match(await page.$eval('[data-hand-capacity]', element => element.textContent), /10\s*\/\s*10/, 'The real UI displays all ten distributed copies');
    await page.screenshot({ path: resolve(output, 'culture-contract-active.png'), fullPage: true });
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('[data-contract-status="active"]');
    assert.equal(renewable ? (await summary()).board.current.runId : (await summary()).contract.runId, renewable ? started.board.current.runId : started.contract.runId, 'Reload preserves the real active SQL run and contract');
    for (let guard = 0; guard < 30 && production.game.phase !== 'complete'; guard++) {
      await page.waitForSelector('[data-culture-primary-action]:not(:disabled)');
      const previous = `${production.game.phase}:${production.game.stageIndex}`;
      await page.click('[data-culture-primary-action]');
      await page.waitForFunction(async previous => { const { game } = await (await fetch('/__preview/state')).json(); return `${game.phase}:${game.stageIndex}` !== previous; }, {}, previous);
    }
    assert.equal(production.game.phase, 'complete');
    await page.waitForSelector('[data-harvest-moment][data-outcome="harvest"][data-fresh]');
    assert.equal(await page.$$eval('[data-harvest-moment] button', buttons => buttons.filter(button => button.textContent.includes('Voir ma réserve')).length), 1);
    await page.screenshot({ path: resolve(output, 'harvest-moment.png'), fullPage: true });
    await page.click('[data-harvest-moment] button');
    await page.waitForFunction(() => document.querySelector('[data-preview-view="arena"]')?.getAttribute('aria-current') === 'page');
    await page.click('[data-preview-view="game"]');
    await page.waitForSelector('[data-harvest-moment][data-outcome="harvest"]');
    assert.equal(await page.$eval('[data-harvest-moment]', element => element.hasAttribute('data-fresh')), false, 'Returning to a preserved culture session does not replay the harvest animation');
    const final = await summary();
    await page.click('[data-preview-view="missions"]');
    await page.waitForSelector(`${renewable ? '[data-kq-renewable-contracts]' : '[data-kq-contract]'}[data-contract-status="${renewable ? final.board.current.status : final.contract.status}"]`);
    let renewal;
    if (renewable) {
      assert.equal(final.board.current.status, 'succeeded', 'The real no-card harvest satisfies Au naturel');
      assert.equal(production.game.usedCards.length, 0);
      const cashBefore = production.cashCents;
      await page.click('[data-renewable-action="claim"]');
      await page.waitForSelector('[data-renewable-receipt][data-receipt-fresh]', { visible: true });
      assert.equal(production.cashCents, cashBefore + 1000);
      const firstReceipt = structuredClone((await contractBoard()).current);
      const replay = await contractAction({ action: 'claim', attemptId: firstReceipt.id });
      assert.equal(replay.replayed, true); assert.deepEqual(replay.receipt, firstReceipt);
      assert.equal(await fixture.scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1', [owner]), production.cashCents);
      await page.screenshot({ path: resolve(output, 'first-renewable-reward.png'), fullPage: true });
      const inventory = structuredClone(production.supportInventory), oldLedger = structuredClone(production.ledger);
      await page.click('[data-renewable-offer="pure-grower"] [data-renewable-action="accept"]');
      await page.waitForSelector('[data-kq-renewable-contracts][data-contract-status="accepted"]');
      const secondAttempt = (await contractBoard()).current.id;
      assert.notEqual(secondAttempt, firstReceipt.id, 'The next attempt has its own immutable identity');
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('[data-preview-next]')]);
      await page.waitForSelector('[data-kq-renewable-contracts][data-contract-status="accepted"]');
      await page.waitForFunction(() => document.querySelector('[data-preview-view="game"]')?.getAttribute('aria-current') === 'page');
      assert.equal(production.game, null); assert.equal(cycle, 2);
      assert.equal(production.cashCents, cashBefore + 1000, 'Preparing another culture preserves the wallet');
      assert.deepEqual(production.supportInventory, inventory, 'Cards are not replenished between cultures');
      for (const row of oldLedger) assert(production.ledger.some(next => next.id === row.id && next.amountCents === row.amountCents && next.status === row.status), 'Old invoices are preserved');
      assert.notEqual(production.warehouse.zones[0].buddieCode, started.game.varietyCode, 'The real Buddie rotation selects another variety');
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Lancer la campagne'))?.click());
      await page.waitForSelector('[data-culture-confirm-start]:not(:disabled)'); await page.click('[data-culture-confirm-start]');
      await page.waitForSelector('[data-kq-renewable-contracts][data-contract-status="active"]');
      const secondRunId = production.game.campaign.leaderRunId;
      openingHandCounts.push(engine.game.getKqHandCodes(production.game).length);
      assert.equal(openingHandCounts[1], 10, 'The next culture also distributes ten owned copies');
      assert.notEqual(secondRunId, started.game.campaign.leaderRunId, 'A new culture never reuses the tutorial run UUID');
      assert.equal((await contractBoard()).current.runId, secondRunId);
      assert.equal(production.checkpoint.game.campaign.leaderRunId, secondRunId, 'The checkpoint uses the same new identity');
      assert(production.ledger.some(row => row.id === `supplier:${secondRunId}`), 'New supplies have their own invoice identity');
      for (let guard = 0; guard < 30 && production.game.phase !== 'complete'; guard++) {
        await page.waitForSelector('[data-culture-primary-action]:not(:disabled)');
        const previous = `${production.game.phase}:${production.game.stageIndex}`;
        await page.click('[data-culture-primary-action]');
        await page.waitForFunction(async previous => { const { game } = await (await fetch('/__preview/state')).json(); return `${game.phase}:${game.stageIndex}` !== previous; }, {}, previous);
      }
      assert.equal(production.game.phase, 'complete');
      await page.click('[data-preview-view="missions"]');
      const secondResult = await contractBoard();
      await page.waitForSelector(`[data-kq-renewable-contracts][data-contract-status="${secondResult.current.status}"]`);
      if (secondResult.current.status === 'succeeded') {
        const beforeSecondClaim = production.cashCents;
        await page.click('[data-renewable-action="claim"]');
        await page.waitForSelector('[data-renewable-receipt][data-receipt-fresh]');
        assert.equal(production.cashCents, beforeSecondClaim + secondResult.current.rewardCents, 'A separately completed attempt earns its own reward');
      } else assert.equal(secondResult.current.status, 'failed', 'Another Buddie keeps its actual outcome');
      const historicalReplay = await contractAction({ action: 'claim', attemptId: firstReceipt.id });
      assert.equal(historicalReplay.replayed, true); assert.deepEqual(historicalReplay.receipt, firstReceipt, 'The earlier receipt stays unchanged after the next culture');
      await page.click('[data-renewable-offer="steady-hand"] [data-renewable-action="accept"]');
      await page.waitForSelector('[data-kq-renewable-contracts][data-contract-status="accepted"]');
      assert.equal((await contractBoard()).current.code, 'steady-hand', 'A different challenge can be selected after the second culture');
      renewal = { completedCultures: 2, firstRunId: started.game.campaign.leaderRunId, secondRunId, secondOutcome: secondResult.current.status,
        immutableReceipt: true, preservedInventory: true, preservedInvoices: true, rotationPreserved: true, thirdChoice: 'steady-hand' };
    } else if (final.contract.status === 'succeeded') {
      const cashBefore = production.cashCents; await page.click('[data-contract-action="claim"]'); await page.waitForSelector('[data-contract-status="claimed"]');
      await page.waitForSelector('[data-contract-receipt][data-receipt-fresh]', { visible: true });
      assert.equal(production.cashCents, cashBefore + 3000);
      const replay = await fixture.action(owner, 'claim'); assert.equal(replay.replayed, true); assert.equal(await fixture.scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1', [owner]), production.cashCents);
    }
    await page.screenshot({ path: resolve(output, 'contract-result.png'), fullPage: true });
    await page.click('[data-preview-view="hub"]'); await page.waitForSelector('[data-placard-map]'); await page.screenshot({ path: resolve(output, 'village-after-culture.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: true, realUi: true, realEngine: true, realContractSql: true, openingHandCounts, reloadPreserved: true, confirmedHarvestMoment: true, harvestDoesNotReplayOnReturn: true, confirmedRewardReceipt: true, ...(renewal ? { renewal } : {}), final: await summary(), requests, errors }, null, 2));
    console.log(JSON.stringify({ success: true, phase: production.game.phase, contract: (await fixture.snapshot(owner)).status, quality: production.game.quality, cardsUsed: production.game.usedCards.length, cashCents: production.cashCents, output }));
    await browser.close(); browser = null; await server.close(); await fixture.db.close();
  } else {
    const close = async () => { await queue; await server.close(); await fixture.db.close(); process.exit(0); };
    process.once('SIGINT', close); process.once('SIGTERM', close);
  }
} catch (error) {
  console.error(error.stack); process.exitCode = 1;
  if (browser) { const pages = await browser.pages(); await pages.at(-1)?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: false, error: error.stack, requests, errors }, null, 2));
  await browser?.close(); await server?.close(); await fixture?.db.close();
}
