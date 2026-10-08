/** Real cards/culture/jury components in the shared tutorial frame; no live API. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/arena-playable-culture');
const port = 3258, origin = `http://127.0.0.1:${port}`;
const modules = {
  fixture: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ArenaPlayableLesson} from '/src/components/contest/ArenaPlayableLesson';
    import {KQ_LOCAL_KEYS} from '/src/lib/kanab-quest-repository';
    import {parseKqGameSave,parseKqBattleSave} from '/src/lib/kanab-quest-persistence';
    import {KQ_CARDS,previewKqResolution,resolveKqStage} from '/src/lib/kanab-quest-game';
    import {advanceKqStage,rollKqDice} from '/src/lib/kanab-quest-game';
    import {createKqFlower,createKqOpponent,lockKqBattle,resolveKqBattle} from '/src/lib/kanab-quest-battle';
    import {startKqTrialCulture} from '/src/lib/kanab-quest-trial';
    import {assistKqPlayableLesson} from '/src/lib/kanab-quest-playable-lesson';
    import {KanabQuestDicePrototype} from '/src/components/placard/KanabQuestDicePrototype';
    window.__game=()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('kq-playable-lesson-v2:')&&k.includes(':'+new URLSearchParams(location.search).get('lesson')+':')&&k.endsWith(KQ_LOCAL_KEYS.game));return parseKqGameSave(localStorage.getItem(key));};
    window.__battle=()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('kq-playable-lesson-v2:')&&k.includes(':'+new URLSearchParams(location.search).get('lesson')+':')&&k.endsWith(KQ_LOCAL_KEYS.battle));return parseKqBattleSave(localStorage.getItem(key));};
    window.__inventory=()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('kq-playable-lesson-v2:')&&k.includes(':'+new URLSearchParams(location.search).get('lesson')+':')&&k.endsWith(KQ_LOCAL_KEYS.inventory));return JSON.parse(localStorage.getItem(key));};
    window.__card=code=>KQ_CARDS.find(card=>card.code===code);
    window.__preview=()=>previewKqResolution(window.__game());
    window.__resolved=()=>resolveKqStage(window.__game());
    const official = new URLSearchParams(location.search).get('official');
    let officialApp = null;
    if(official){
      let ending=startKqTrialCulture();
      for(let stage=0;stage<6;stage++){ending=resolveKqStage(assistKqPlayableLesson(rollKqDice(ending)));if(stage<5)ending=advanceKqStage(ending);}
      const harvested=advanceKqStage(ending);
      const active=official==='active'?rollKqDice(startKqTrialCulture()):ending;
      const playerFlower=createKqFlower(harvested),opponentFlower=createKqOpponent(3);
      let battle={...lockKqBattle(playerFlower,opponentFlower,2),seed:2,lockedAt:'2026-10-07T12:00:00Z',verdictAt:null,opponentType:'human'};
      let session={activeRun:{runId:'fixture-active',state:active,burnReceipts:[]},flowers:[],battles:[battle],progress:null};
      window.__officialRequests=[];window.__officialStart=structuredClone(active);window.__officialCurrent=()=>structuredClone(session.activeRun?.state??harvested);
      const realFetch=window.fetch.bind(window);
      window.fetch=async(input,init)=>{
        const path=typeof input==='string'?input:input.url;
        if(!path.startsWith('/api/'))return realFetch(input,init);
        window.__officialRequests.push({path,method:init?.method??'GET'});
        if(path.endsWith('/bootstrap'))return Response.json({ownedBuddieCodes:[active.varietyCode],buddieRotation:{requiredDistinctBuddies:5,recentBuddieCodes:[]},collection:{ownerFound:true,collectionActive:true,inventory:Object.fromEntries(KQ_CARDS.map(card=>[card.code,3])),cards:KQ_CARDS},playerSession:session});
        if(path.endsWith('/rankings'))return Response.json({entries:[]});
        if(path.endsWith('/me'))return Response.json({progress:null});
        if(path.endsWith('/session'))return Response.json(session);
        if(path.endsWith('/flowers'))return Response.json({flowers:[]});
        if(path.endsWith('/battles'))return Response.json({battles:[battle]});
        if(path.endsWith('/energy'))return Response.json({cashCents:200000,productionUnits:1,outstandingCents:0,invoiceCount:0,bestGramsPerKwh:null,invoices:[],quotes:{eco:harvested.energy,balanced:harvested.energy,intensive:harvested.energy}});
        if(path.endsWith('/actions')){session={...session,activeRun:null};return Response.json({state:harvested,persistedFlower:{id:'fixture-flower',status:'available',createdAt:harvested.completedAt}});}
        if(path.endsWith('/verdict')){const result=resolveKqBattle(battle,2);battle={...battle,...result,verdictAt:result.burnedAt};return Response.json({battleId:battle.id,status:'verdict',winner:result.winner,burnedAt:result.burnedAt,rounds:result.rounds,experienceAwarded:10,challengePoints:0,completedChallenges:[],pvpBoosterGranted:false,pvpBoosterCardCount:0,rankProfile:null});}
        return Response.json({error:'Unexpected fixture request'},{status:400});
      };
      function OfficialFixture(){
        const [view,setView]=React.useState(official==='active'?'arena':'game');
        return React.createElement(KanabQuestDicePrototype,{apiScope:'player',showAdminOperations:false,viewMode:view,onOpenArena:()=>setView('arena'),onOpenGame:()=>{window.__returnedToGame=true;setView('game');}});
      }
      officialApp=React.createElement(OfficialFixture);
    }
    createRoot(document.getElementById('root')).render(officialApp??React.createElement(ArenaPlayableLesson,{lesson:new URLSearchParams(location.search).get('lesson')||'cards',onClose:()=>{},onCompleted:id=>window.__complete=id}));`,
  cart: `export const useCart=()=>({user:null,authLoading:false});`,
  consent: `export const useCookieConsent=()=>({showBanner:false});`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from 'react'; export default function dynamic(loader,options={}){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props))}`,
  'next/navigation': `export const usePathname=()=>'/arene';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({ configFile: false, envDir: false, root, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'),
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@': resolve(root, 'src') } }, css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: 'playable-culture-audit', enforce: 'pre', resolveId(id) {
    if (id.endsWith('/context/CartContext')) return '\0cart';
    if (id.endsWith('/cookies/CookieConsentProvider')) return '\0consent';
    if (id in modules) return '\0' + id;
  }, load(id) { if (id.startsWith('\0')) return modules[id.slice(1)]; }, configureServer(vite) {
    vite.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/') return next();
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Display;src:url("/src/app/fonts/BarlowCondensed-Latin-Black.woff2");font-weight:900}@font-face{font-family:Body;src:url("/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2");font-weight:300 700}body{margin:0}:root{--font-display:Display;--font-body:Body;--font-sans:Body}</style><div id="root"></div><script type="module" src="/@id/__x00__fixture"></script></html>');
    });
  } }], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null } });
let browser, page;
const report = { passed: false, errors: [], apiRequests: [], stages: [], blockedRemote: [] };
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return void request.continue();
    if (url.origin !== origin) { report.blockedRemote.push(url.href); return void request.abort(); }
    if (url.pathname.startsWith('/api/')) { report.apiRequests.push({ method: request.method(), path: url.pathname }); return void request.respond({ status: 503, contentType: 'application/json', body: '{}' }); }
    void request.continue();
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('kanab-quest-dice-prototype-v7', 'protected-account-snapshot');
    sessionStorage.setItem('kq-guided-trial-v2:discovery', 'protected-guided-journal');
    sessionStorage.setItem('kq-admin-remote-burns', '1');
  });
  const assertClickable = async handle => {
    await handle.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    assert.equal(await handle.evaluate(element => { const r = element.getBoundingClientRect(); const hit = document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); return hit === element || element.contains(hit); }), true, 'Button is not obscured by the coach');
    await handle.click();
  };
  const clickText = async text => {
    const handle = await page.waitForFunction(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text && !button.disabled && button.checkVisibility()), {}, text);
    await assertClickable(handle.asElement()); await handle.dispose();
  };
  const noOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1 || [...document.querySelectorAll('dialog[open]')].some(dialog => dialog.scrollWidth > dialog.clientWidth+1)), false, `${label}: horizontal overflow`);
  const inspectRecap = async (kind, width) => {
    await page.setViewport({width,height:844});
    const recap=`[data-${kind}-personal-recap]`,details=`[data-${kind}-analysis-details]`;
    await page.waitForSelector(`${recap} [data-${kind}-analysis]`);
    await page.$eval(recap,el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    if(!await page.$eval(details,el=>el.open)){
      const summary=await page.$(details+'>summary');await summary.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
      assert((await summary.boundingBox()).height>=44,'Recap details support touch targets');await summary.focus();await page.keyboard.press('Enter');await page.waitForSelector(details+'[open]');
    }
    if(kind==='culture'){
      assert.equal(await page.$$eval(`${recap} [data-analysis-stage]`,nodes=>nodes.length),6);
      if(width===390){
        const readable=await page.$$eval(`${recap} [data-analysis-stage]`,nodes=>nodes.map(node=>({row:node.getBoundingClientRect().width,paragraph:node.querySelector('p').getBoundingClientRect().width,facts:[...node.querySelectorAll('ul>li')].map(fact=>fact.getBoundingClientRect().width)})));
        assert(readable.every(row=>row.paragraph>=row.row*.75&&row.facts.every(fact=>fact>=row.row*.65)),`Culture explanations use a readable mobile column: ${JSON.stringify(readable)}`);
      }
    }
    await noOverflow(`${kind} recap ${width}`);await page.screenshot({path:resolve(output,`${kind}-analysis-${width}.png`)});
  };
  await page.goto(`${origin}/?lesson=cards`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-culture-preparation]');
  assert.ok(await page.$('#inventory-carousel-title'));
  await noOverflow('cards'); await page.screenshot({ path: resolve(output, 'cards-390.png') });
  const firstBuddie = await page.$('[aria-labelledby="placard-preparation"] [role="listitem"] button:last-child');
  await assertClickable(firstBuddie);
  const addCard = await page.$('[aria-labelledby="inventory-carousel-title"] button[aria-label^="Ajouter une copie"]');
  await assertClickable(addCard);
  const heritage = await page.$('[aria-labelledby="heritage-carousel-title"] button[aria-label^="Équiper"]');
  await assertClickable(heritage);
  await clickText('Lancer ma culture');
  await page.waitForFunction(() => document.querySelector('[aria-label="Charges du Placard"]')?.textContent.includes('Équilibré'));
  await page.screenshot({ path: resolve(output, 'start-energy-390.png') });
  await clickText('Commencer');
  await page.waitForFunction(() => window.__complete === 'cards');
  const prepared = await page.evaluate(() => window.__game());
  assert.equal(prepared.phase, 'prepare'); assert.equal(prepared.varietyCode, 'HH2026-001');
  assert.equal(prepared.deckCodes.length, 10); assert.ok(prepared.heritageCode);
  await page.goto(`${origin}/?lesson=culture`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-culture-primary-action]');
  const checkChoices = async () => {
    const state = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-action-card]')];
      const available = cards.filter(card => !card.disabled);
      return { declared: Number(document.querySelector('[data-playable-card-count]').dataset.playableCardCount),
        actual: available.length, ordered: cards.map(card => card.dataset.cardPlayable === 'true') };
    });
    assert.equal(state.declared, state.actual, 'Exact number of playable displayed cards');
    assert.deepEqual(state.ordered, [...state.ordered].sort((a,b)=>Number(b)-Number(a)), 'Compatible cards come first');
  };
  await checkChoices();
  const beforeCard = await page.evaluate(() => ({ game: window.__game(), inventory: window.__inventory(), card: window.__card('BOTTE-005') }));
  await assertClickable(await page.$('[data-culture-hand] > summary'));
  await assertClickable(await page.$('button[aria-label^="Arrosage mesuré."]'));
  await clickText('Brûler et jouer');
  await page.waitForFunction(() => window.__game().usedCards.includes('BOTTE-005'));
  const afterCard = await page.evaluate(() => ({ game: window.__game(), inventory: window.__inventory() }));
  assert.equal(afterCard.game.xp, beforeCard.game.xp - beforeCard.card.xpCost);
  assert.equal(afterCard.inventory['BOTTE-005'], beforeCard.inventory['BOTTE-005'] - 1);
  report.cardCostAndBurn = true;
  for (let index = 0; index < 18; index++) {
    await checkChoices();
    const before = await page.evaluate(() => window.__game());
    if (before.phase === 'rolled') {
      const heritageAvailable = await page.evaluate(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Activer le pouvoir' && !button.disabled));
      if (heritageAvailable) { await clickText('Activer le pouvoir'); await page.waitForFunction(() => window.__game().heritageUsed); report.heritagePlayed = true; }
      const preview = await page.evaluate(() => window.__preview());
      assert.equal(await page.$eval('[data-culture-result] > strong', element => element.textContent), `${preview.total}/${preview.target}`);
    }
    const expected = before.phase === 'rolled' ? await page.evaluate(() => window.__resolved()) : null;
    const button = await page.waitForSelector('[data-culture-primary-action]:not(:disabled)');
    const geometry = await button.evaluate(element => { const r=element.getBoundingClientRect();const coach=document.querySelector('[data-playable-coach]').getBoundingClientRect();return { bottom:r.bottom, top:r.top, coach:coach.top }; });
    assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.coach, `Mobile action above coach: ${JSON.stringify(geometry)}`);
    await assertClickable(button);
    await page.waitForFunction(before => { const after=window.__game(); return after && (after.phase !== before.phase || after.stageIndex !== before.stageIndex); }, {}, before);
    if (expected) {
      const resolved = await page.evaluate(() => window.__game());
      assert.equal(resolved.xp, expected.xp); assert.equal(resolved.quality, expected.quality);
      assert.deepEqual(resolved.history.at(-1), expected.history.at(-1));
    }
    report.stages.push({ stage: before.stageIndex, phase: before.phase });
    if (index === 1) {
      await page.screenshot({ path: resolve(output, 'culture-result-390.png') });
      await page.reload({ waitUntil: 'networkidle0' });
      assert.equal((await page.evaluate(() => window.__game())).phase, 'resolved');
    }
  }
  await page.waitForFunction(() => window.__complete === 'culture');
  const harvest = await page.evaluate(() => window.__game());
  assert.equal(harvest.history.length, 6); assert.ok(harvest.harvestGrams > 0);
  assert.ok(report.heritagePlayed); report.dicePreviewAndRewards = true;
  await page.waitForSelector('[data-culture-personal-recap]');
  const cultureRecap = await page.$eval('[data-culture-personal-recap]', element => element.textContent);
  assert.ok(cultureRecap.includes(`${harvest.history.filter(stage=>['success','critical'].includes(stage.outcome)).length}/6`));
  await noOverflow('harvest'); await page.screenshot({ path: resolve(output, 'harvest-390.png') });
  await inspectRecap('culture',390);await inspectRecap('culture',1440);await page.setViewport({width:390,height:844});
  await page.goto(`${origin}/?lesson=jury`, { waitUntil: 'networkidle0' });
  await clickText('Trouver un adversaire au hasard'); await clickText('Lancer le verdict du jury');
  await clickText('Confirmer le verdict'); await page.waitForFunction(() => window.__complete === 'jury');
  assert.equal((await page.evaluate(() => window.__battle())).rounds.length, 3);
  await page.waitForSelector('[data-jury-personal-recap]');
  await page.$eval('[data-jury-personal-recap]', element => element.scrollIntoView({ block:'start', behavior:'instant' }));
  await noOverflow('jury'); await page.screenshot({ path: resolve(output, 'jury-390.png') });
  await inspectRecap('jury',390);await inspectRecap('jury',1440);await page.setViewport({width:390,height:844});
  await assertClickable(await page.$('[data-recap-prepare]'));
  await page.waitForSelector('[data-culture-preparation]');
  report.personalRecaps = true; report.cardCountsAndOrder = true; report.nextCultureAction = true;
  report.officialVerdictReturns = [];
  for(const kind of ['complete','active']){
    await page.goto(`${origin}/?official=${kind}`,{waitUntil:'networkidle0'});
    if(kind==='complete'){
      await clickText('Révéler la Récolte');
      await clickText('Voir ma réserve et entrer dans la file');
    }
    await clickText('Demander le verdict');
    await clickText('Confirmer le verdict');
    await page.waitForSelector('[data-verdict-result] [data-recap-prepare]');
    await page.waitForSelector('details[data-archived-jury-recap]');
    const archived=await page.$('details[data-archived-jury-recap]>summary');await archived.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await archived.focus();await page.keyboard.press('Enter');
    await page.waitForSelector('details[data-archived-jury-recap][open] [data-jury-personal-recap] [data-jury-analysis]');
    await noOverflow(`Archived jury ${kind}`);await page.screenshot({path:resolve(output,`official-archive-${kind}-390.png`)});
    const before = await page.evaluate(()=>({posts:window.__officialRequests.filter(request=>request.method==='POST').length,state:window.__officialCurrent(),run:sessionStorage.getItem('kq-player-remote-run-id')}));
    await assertClickable(await page.$('[data-verdict-result] [data-recap-prepare]'));
    await page.waitForFunction(()=>window.__returnedToGame===true);
    await page.waitForSelector(kind==='complete'?'[data-culture-preparation]':'[data-culture-primary-action][data-action="resolve"]');
    const after = await page.evaluate(()=>({posts:window.__officialRequests.filter(request=>request.method==='POST').length,state:window.__officialCurrent(),run:sessionStorage.getItem('kq-player-remote-run-id')}));
    assert.deepEqual(after,before,'Returning from a verdict preserves the current run and sends no mutation');
    if(kind==='active'){
      assert.equal(await page.$eval('[data-culture-decision]',element=>element.dataset.phase),'rolled');
      assert.equal(after.run,'fixture-active');
      assert.deepEqual(after.state,await page.evaluate(()=>window.__officialStart));
    }else assert.equal(after.run,null);
    report.officialVerdictReturns.push({kind,screen:kind==='complete'?'preparation':'active-culture',extraMutations:after.posts-before.posts});
    await page.screenshot({path:resolve(output,`official-return-${kind}-390.png`)});
  }
  const untouched = await page.evaluate(() => [localStorage.getItem('kanab-quest-dice-prototype-v7'), sessionStorage.getItem('kq-guided-trial-v2:discovery'), sessionStorage.getItem('kq-admin-remote-burns')]);
  assert.deepEqual(untouched, ['protected-account-snapshot', 'protected-guided-journal', '1']);
  assert.deepEqual(report.apiRequests, []); assert.deepEqual(report.errors, []);
  report.passed = true; console.log(JSON.stringify({ passed: true, output, stages: report.stages.length }));
} catch (error) {
  report.failure = error.stack;
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close(); await server.close();
}
