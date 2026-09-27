/** Isolated UI preview: real components, fake data, no .env or database access. */
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const auditDice = process.argv.includes("--dice");
const auditReputation = process.argv.includes("--reputation");
const auditTutorial = process.argv.includes("--tutorial");
const auditSections = process.argv.includes("--sections");
const auditLobby = process.argv.includes("--lobby");
const auditProfile = process.argv.includes("--profile");
const reportDir = resolve(root, "output/arena-retro");
const fixture = {
  cashCents: 245000, reputation: 120, reputationRank: 4,
  ownedCodes: [], purchasedCodes: [], equippedCodes: [], activeRun: false,
  readyLotCount: 0, availableFlowerCount: 0, routePlan: null, routeMasteries: [], lots: [],
};
const modules = {
  "arena-preview-entry": `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import '/src/app/globals.css';
    import { ContestHubClient } from '/src/components/contest/ContestHubClient';
    import { ContestArenaHub } from '/src/components/contest/ContestArenaHub';
    import { ArenaFirstVisitTutorial } from '/src/components/contest/ArenaFirstVisitTutorial';
    import { PlacardPlayerShell } from '/src/components/placard/PlacardPlayerShell';
    import { KqMarketDesk } from '/src/components/placard/KqMarketDesk';
    import { KqEquipmentCatalogModal } from '/src/components/placard/KqEquipmentCatalogModal';
    import { KQ_EQUIPMENT_CATALOG, buildKqEquipmentGoalReceipt, getKqEquipmentProgressionStatus } from '/src/lib/kanab-quest-equipment';
    import { KanabQuestDicePrototype } from '/src/components/placard/KanabQuestDicePrototype';
    import { startKqGame, rollKqDice } from '/src/lib/kanab-quest-game';
    import { quoteKqMarketRoutes, previewKqMarketReputation } from '/src/lib/kanab-quest-market';
    const sampleEntry = {id:'preview-flower', slug:'preview-flower', title:'Fleur de demonstration', productId:'preview-product', seasonId:'preview-season', category:'indoor', track:'regular', story:'Une fiche fictive pour verifier la presentation du carnet.', technicalSheet:{genetics:'Selection botanique'}, imageUrl:'/sylvain-culture-hero.webp', galleryUrls:[], isPublished:true, position:0, createdAt:'2026-09-10', updatedAt:'2026-09-10', stats:{entryId:'preview-flower', seasonId:'preview-season', category:'indoor', track:'regular', approvedReviewCount:0, averageScore:0, criterionAverages:{}, consumptionCounts:{}}};
    const screen = new URLSearchParams(location.search).get('screen');
    const profileProgress = {pseudo:'Camille Mobile',totalPoints:145,currentLevel:{code:'testeur',label:'Testeur confirmé',requiredPoints:100,nextRequiredPoints:200,rewardPackCount:1},nextLevel:{code:'expert',label:'Nez expert',requiredPoints:200,rewardPackCount:2},pointsIntoLevel:45,pointsToNextLevel:55,progressPercent:45,seasonRank:2,globalRank:7};
    const profilePlacard = {rank:4,placardScore:420,rating:1100,seasonPoints:80,wins:4,losses:2,streak:1,burnedFlowers:6};
    const profileGeneral = {rank:3,pseudo:profileProgress.pseudo,score:650,notebookScore:230,placardScore:420,approvedReviewCount:4,rating:1100,wins:4,losses:2};
    const game = startKqGame(2026);
    const session = {activeRun: {runId: 'preview-run', state: game, burnReceipts: []}, flowers: [], battles: [], progress: null};
    window.__diceRequests = 0;
    const fixture = ${JSON.stringify(fixture)};
    window.__saleRequests = 0;
    window.__profileRequests = [];
    if (screen?.startsWith('market-')) {
      fixture.reputation = screen === 'market-loss' ? 2 : 120;
      fixture.ownedCodes = fixture.equippedCodes = ['TENT-080-STARTER', 'SIFT-TRAY', 'PRESS-20T'];
      const score = screen === 'market-gain' ? 8.8 : 7.5;
      fixture.lots = [{flowerId: 'quality-preview-lot', varietyName: 'Lot de test qualité', juryScore: score,
        harvestGrams: 100, qualityBand: score >= 8.8 ? 'signature' : 'selection', status: 'ready',
        burnedAt: '2026-09-09T12:00:00Z', settledAt: null,
        options: quoteKqMarketRoutes({juryScore: score, harvestGrams: 100, equipmentCodes: fixture.equippedCodes})}];
    }
    window.fetch = async (input, options) => {
      if (screen === 'profile') {
        window.__profileRequests.push({url:String(input),method:options?.method || 'GET'});
        if (options?.method && options.method !== 'GET') throw new Error('Profile preview blocks writes');
        if (String(input) === '/api/arena/placard/me') return Response.json({progress:profilePlacard});
        if (String(input) === '/api/arena/rankings') return Response.json({entries:[profileGeneral]});
      }
      if (String(input) === '/api/arena/tutorial') return Response.json({error:'Local guest fixture'}, {status:401});
      if (String(input) === '/api/arena/rewards') return Response.json({error:'Preview unavailable state'}, {status:503});
      if (String(input).includes('/rankings')) return Response.json({items:[],entries:[]});
      if (screen?.startsWith('market-') && String(input).endsWith('/market') && options?.method === 'POST') {
        window.__saleRequests++;
        const body = JSON.parse(options.body);
        const quote = fixture.lots[0].options.find(option => option.route === body.route);
        return Response.json({receiptId: 'quality-preview-receipt', flowerId: body.flowerId, route: body.route,
          payoutCents: quote.payoutCents, cashAfterCents: fixture.cashCents + quote.payoutCents,
          ...previewKqMarketReputation(fixture.reputation, quote.reputationGain, 0),
          equipmentProgression: getKqEquipmentProgressionStatus(fixture.ownedCodes),
          nextEquipmentGoal: buildKqEquipmentGoalReceipt({ownedCodes: fixture.ownedCodes, cashCents: fixture.cashCents + quote.payoutCents}),
          routeMastery: null, nextRouteGoal: null, replayed: false});
      }
      if (screen?.startsWith('game-')) {
        if (String(input).endsWith('/bootstrap')) return Response.json({collection: {ownerFound: true, inventory: {}}, ownedBuddieCodes: [game.varietyCode], playerSession: session});
        if (String(input).endsWith('/session')) return Response.json(session);
        if (String(input).endsWith('/actions')) {
          window.__diceRequests++;
          return screen === 'game-error' ? Response.json({error: 'Session de test expirée.'}, {status: 401}) : Response.json({state: rollKqDice(game), persistedFlower: null});
        }
      }
      if (String(input).startsWith('/api/') && (!options?.method || options.method === 'GET')) return new Response(JSON.stringify({...fixture, catalog: KQ_EQUIPMENT_CATALOG}));
      throw new Error('Preview blocks non-fixture requests');
    };
    if (screen === 'tutorial') localStorage.removeItem('lcb_arena_tutorial_v2');
    else localStorage.setItem('lcb_arena_tutorial_v2', 'seen');
    localStorage.setItem('kanab-quest-onboarding-seen-v1', '1');
    localStorage.setItem('kq-dice-direct-result', screen === 'game-stalled' ? '0' : '1');
    const Component = ['notebook', 'rankings', 'flowers', 'profile'].includes(screen) ? ContestHubClient : screen === 'tutorial' ? ArenaFirstVisitTutorial : screen?.startsWith('game-') ? KanabQuestDicePrototype : screen === 'placard' ? PlacardPlayerShell : screen?.startsWith('market') ? KqMarketDesk : screen === 'catalog' ? KqEquipmentCatalogModal : ContestArenaHub;
    createRoot(document.getElementById('root')).render(React.createElement(Component, {seasons: [], selectedTrack: 'regular', activeCategory: 'indoor', categoryCounts: {outdoor: 0, greenhouse: 0, indoor: 1}, entries: [sampleEntry], rankings: [sampleEntry], feed: [], notebookUnlocks: [], viewerProfile: screen === 'profile' ? {pseudo:profileProgress.pseudo,createdAt:'2026-09-01',updatedAt:'2026-09-01'} : null, viewerBadges: [], viewerProgress: screen === 'profile' ? profileProgress : null, testerSeasonRankings: [], testerGlobalRankings: [], isAuthenticated: screen === 'profile', isAdminAuthorized: false, isPlacardPlayerEnabled: true, initialView: ['rankings','profile'].includes(screen) ? 'classement' : 'carnet', surface: ['rankings','profile'].includes(screen) ? 'arena' : screen === 'flowers' ? 'notebook-ranking' : 'notebook', apiScope: 'player', viewMode: 'game', onOpenShop: () => {}, onClose: () => {}}));
  `,
  "preview-cart": `export const useCart=()=>({addToCart:()=>{},authLoading:false,customer:null,items:[]});`,
  "next/image": `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return React.createElement('img', {...props, src: typeof src === 'string' ? src : src.src, style: {...(fill ? {position:'absolute',inset:0,width:'100%',height:'100%'} : {}), ...props.style}}); }`,
  "next/link": `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}) {return React.createElement('a',props);}`,
  "next/dynamic": `import React from 'react'; export default function dynamic(loader, options={}) {const Component=React.lazy(() => loader().then(defaultExport => ({default:defaultExport.default || defaultExport}))); return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading ? React.createElement(options.loading) : null},React.createElement(Component,props));};}`,
  "next/navigation": `export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  "@/components/cookies/CookieConsentProvider": `export const useCookieConsent=()=>({showBanner:false, hasConsent:()=>false});`,
  "preview-stalled-dice": `import React from 'react'; export const KqPhysicsDice = React.forwardRef(function Dice(_, ref) { React.useImperativeHandle(ref, () => ({roll: () => new Promise(() => {}), sync: async () => true, reveal: () => {}})); return null; });`,
};
const server = await createServer({
  configFile: false, envDir: false, root,
  publicDir: resolve(root, "public"),
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": resolve(root, "src") } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "isolated-arena-preview",
    enforce: "pre",
    resolveId(id) {
      if (id.endsWith("/context/CartContext")) return "\0preview-cart";
      if (auditDice && (id === './KqPhysicsDice' || id.endsWith('/KqPhysicsDice'))) return '\0preview-stalled-dice';
      if (id.endsWith("src/components/cookies/CookieConsentProvider")) return "\0@/components/cookies/CookieConsentProvider";
      if (id in modules) return `\0${id}`;
    },
    load(id) { if (id.startsWith("\0") && id.slice(1) in modules) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url?.startsWith("/api/")) {
          response.setHeader("Content-Type", "application/json");
          if (request.method !== "GET") { response.statusCode = 405; response.end('{"error":"Read-only preview"}'); return; }
          response.end(JSON.stringify(fixture)); return;
        }
        if (request.url?.split("?")[0] !== "/") return next();
        response.setHeader("Content-Type", "text/html");
        response.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arène · UI preview</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__arena-preview-entry"></script></html>');
      });
    },
  }],
  server: { host: "127.0.0.1", port: 3198, strictPort: true, hmr: false, watch: { ignored: ["**/output/**", "**/.next/**"] } },
});
let browser;
try {
  await mkdir(reportDir, { recursive: true });
  await mkdir(resolve(reportDir, "chrome-profile"), { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], userDataDir: resolve(reportDir, "chrome-profile-puppeteer"), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  const errors = [];
  const profileResults = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || (url.hostname === "127.0.0.1" && url.port === "3198")) void request.continue();
    else void request.abort();
  });
  for (const width of auditProfile ? [320, 390, 767, 768, 1440] : auditDice ? [390, 1440] : [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: width < 768 ? 844 : 1000, deviceScaleFactor: 1, ...(auditProfile ? { isMobile: width < 768, hasTouch: width < 768 } : {}) });
    for (const screen of auditProfile ? ["profile"] : auditDice ? ["game-direct", "game-error", "game-stalled"] : auditReputation ? ["market-loss", "market-neutral", "market-gain"] : auditTutorial ? ["tutorial"] : auditSections ? ["notebook", "rankings", "flowers", "placard", "market", "catalog"] : auditLobby ? ["landing"] : ["landing", "placard", "market", "catalog"]) {
      await page.goto(`http://127.0.0.1:3198/?screen=${screen}`, { waitUntil: "networkidle0", timeout: 60000 });
      await page.waitForSelector(screen === "catalog" || auditTutorial ? '[role="dialog"]' : 'h1', { timeout: 30000 });
      if (auditProfile) {
        const selector = 'details[class*="rankingProfileDetails"]';
        const summary = await page.waitForSelector(selector + ' > summary', { visible: true });
        if (!(await summary.evaluate(el => el.textContent.includes('Mon profil et ma progression')))) throw new Error('Profile summary missing');
        if (await page.$eval(selector, el => el.open)) throw new Error('Profile must start collapsed');
        const toggle = () => width < 768 ? summary.tap() : summary.click();
        const visibleProfile = () => page.waitForFunction((selector) => {
          const panel = document.querySelector(selector);
          const profile = panel?.querySelector('[class*="personalGrid"] > div');
          const visible = el => Boolean(el?.checkVisibility() && el.getBoundingClientRect().height > 0);
          return panel?.open && visible(profile) && visible(profile.querySelector('h2')) && profile.querySelector('h2').textContent === 'Camille Mobile'
            && ['tasting', 'placard', 'general'].every(name => visible(profile.querySelector('[data-ranking="' + name + '"]')))
            && profile.querySelector('[data-ranking="tasting"]').innerText.includes('145')
            && profile.querySelector('[data-ranking="placard"]').innerText.includes('420')
            && profile.querySelector('[data-ranking="general"]').innerText.includes('650')
            && visible(profile.querySelector('[aria-label="Progression 45%"]'))
            && profile.innerText.includes('55 point(s) avant Nez expert.') && profile.innerText.includes('6 fleur(s) passée(s) au jury.');
        }, { timeout: 10000 }, selector).catch(async error => {
          const diagnostic = await page.$eval(selector, panel => {
            const profile = panel.querySelector('[class*="personalGrid"] > div');
            return { width: innerWidth, open: panel.open, profileDisplay: profile ? getComputedStyle(profile).display : null,
              profileVisible: profile?.checkVisibility() ?? false, profileHeight: profile?.getBoundingClientRect().height ?? null,
              profileText: profile?.textContent, requests: window.__profileRequests };
          });
          await writeFile(resolve(reportDir, 'profile-failure.json'), JSON.stringify(diagnostic, null, 2));
          await page.screenshot({ path: resolve(reportDir, 'profile-failure-' + width + '.png'), fullPage: true });
          throw new Error('Profile content is not visible: ' + JSON.stringify(diagnostic), { cause: error });
        });
        await toggle();
        await visibleProfile();
        await toggle();
        if (await page.$eval(selector, el => el.open || el.querySelector('[class*="personalGrid"] > div').checkVisibility())) throw new Error('Profile did not collapse');
        await toggle();
        await visibleProfile();
        const result = await page.$eval(selector, panel => ({
          width: innerWidth, touch: navigator.maxTouchPoints > 0, open: panel.open,
          profileVisible: panel.querySelector('[class*="personalGrid"] > div').checkVisibility(),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          requests: window.__profileRequests,
        }));
        if (result.overflow) throw new Error('Profile overflow: ' + JSON.stringify(result));
        if (result.requests.some(request => request.method !== 'GET')) throw new Error('Profile audit attempted a write');
        if (!result.requests.some(request => request.url === '/api/arena/placard/me') || !result.requests.some(request => request.url === '/api/arena/rankings')) throw new Error('Profile progression fixtures were not read');
        profileResults.push(result);
        await summary.dispose();
        console.log('OK profile toggle, visible pseudo and all progression, close/reopen ' + width + 'px');
      }
      if (auditTutorial) {
        const steps = ['carnet', 'placard', 'boutique', 'inventaire', 'culture', 'duel', 'marche', 'reputation'];
        for (const [index, id] of steps.entries()) {
          await page.waitForSelector('[data-tutorial-step="' + id + '"]');
          const layout = await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            const footer = dialog.querySelector('footer').getBoundingClientRect();
            const scroller = dialog.querySelector('[data-tutorial-scroll]');
            return { top: scroller.scrollTop, overflow: scroller.scrollWidth > scroller.clientWidth + 1,
              footerVisible: footer.top >= 0 && footer.bottom <= innerHeight + 1 };
          });
          if (layout.top !== 0 || layout.overflow || !layout.footerVisible) throw new Error('Tutorial layout: ' + id + ' ' + JSON.stringify(layout));
          if (id === 'boutique' || id === 'reputation') await page.screenshot({path: resolve(reportDir, `tutorial-${id}-${width}.png`)});
          if (index < steps.length - 1) {
            await page.$eval('[data-tutorial-scroll]', el => { el.scrollTop = el.scrollHeight; });
            await page.click('[role="dialog"] footer button:last-child');
          }
        }
        await page.click('[role="dialog"] summary');
        await page.focus('[role="dialog"] footer button:last-child');
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) !== 'Fermer le tutoriel de l’Arène') throw new Error('Tutorial focus escaped');
        await page.keyboard.press('Escape');
        await page.waitForSelector('[role="dialog"]', {hidden: true});
        if (await page.evaluate(() => localStorage.getItem('lcb_arena_tutorial_v2')) !== 'seen') throw new Error('Tutorial dismissal not saved');
        await page.click('button');
        await page.waitForSelector('[data-tutorial-step="carnet"]');
        await page.click('[aria-label="Étapes du tutoriel"] button:last-child');
        await page.waitForSelector('[data-tutorial-step="reputation"]');
        console.log('OK 8 chapters, scroll reset, direct navigation, keyboard, dismiss/reopen ' + width + 'px');
      }
      if (auditReputation) {
        const recipe = screen === 'market-loss' ? 'Rosin Sélection' : screen === 'market-neutral' ? 'Hash tamisé' : 'Rosin Premium';
        await page.waitForSelector('article[data-available] h4');
        const button = await page.evaluateHandle((name) => [...document.querySelectorAll('article[data-available]')]
          .find(article => article.querySelector('h4')?.textContent === name)?.querySelector('button'), recipe);
        await button.asElement().click();
        await page.waitForSelector('[aria-labelledby="market-confirm-title"]');
        const dialogText = await page.$eval('[aria-labelledby="market-confirm-title"]', el => el.innerText);
        if (screen === 'market-loss' && (!dialogText.includes('pénalité de 4 points') || !dialogText.includes('-2'))) throw new Error('Missing penalty or zero-floor preview');
        if (screen !== 'market-loss' && dialogText.includes('pénalité')) throw new Error('Unexpected penalty');
        await page.screenshot({path: resolve(reportDir, `${screen}-confirm-${width}.png`), fullPage: true});
        await page.click('[aria-labelledby="market-confirm-title"] footer button:last-child');
        await page.waitForSelector('[aria-labelledby="market-receipt-title"]');
        const receiptText = await page.$eval('[aria-labelledby="market-receipt-title"]', el => el.textContent);
        const delta = screen === 'market-loss' ? '-2' : screen === 'market-neutral' ? '0' : '+10';
        if (!receiptText.includes(delta + ' réputation') || receiptText.includes('+-')) throw new Error('Incorrect signed receipt');
        if (screen === 'market-loss' && !receiptText.includes('Réputation en baisse')) throw new Error('Loss shown as a promotion');
        if (await page.evaluate(() => window.__saleRequests) !== 1) throw new Error('Expected a single sale request');
      }
      if (auditDice) {
        const selector = '[aria-label="Action principale du tour"] button';
        await page.waitForSelector(selector);
        await page.click(selector);
        if (screen === 'game-error') {
          try {
            await page.waitForFunction(() => document.body.innerText.includes('Session de test expirée.'), {timeout: 12000});
          } catch (error) {
            console.log(await page.evaluate(() => ({requests: window.__diceRequests, alerts: [...document.querySelectorAll('[role="alert"]')].map(el => ({text: el.textContent, visible: el.getBoundingClientRect().height})), buttons: [...document.querySelectorAll('button')].filter(el => el.textContent?.includes('Lancer')).map(el => ({text: el.textContent, disabled: el.disabled}))})));
            await page.screenshot({path: resolve(reportDir, `dice-error-${width}.png`), fullPage: true});
            throw error;
          }
        } else {
          await page.waitForSelector('[data-phase="rolled"]', {timeout: 12000});
          const result = await page.$('[data-phase="rolled"]');
          if (!(await result.isVisible())) throw new Error('Dice result is hidden in an inactive tab');
        }
        if (screen === 'game-error') {
          const alert = await page.$('[role="alert"]');
          const box = await alert.boundingBox();
          if (!box || box.y < 0 || box.y + box.height > page.viewport().height) throw new Error('Roll error is outside the viewport');
        }
        if (await page.evaluate(() => window.__diceRequests) !== 1) throw new Error('Expected exactly one roll request');
      }
      await page.screenshot({ path: resolve(reportDir, `${screen}-${width}.png`), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) throw new Error(`Horizontal overflow: ${screen} at ${width}px`);
      if (screen === "landing") {
        const destinations = {carnet: '/arene/carnet/regular', jouer: '/arene/placard', classement: '/arene?vue=classement'};
        await page.waitForSelector('[data-arena-activity="carnet"]');
        for (const [id, href] of Object.entries(destinations)) {
          if (await page.$eval('a[data-arena-activity="' + id + '"]', el => el.getAttribute('href')) !== href) throw new Error('Wrong direct activity destination');
        }
        if ((await page.$$('nav[aria-label="Choisir une activité"]')).length !== 1 || (await page.$$('[data-arena-activity]')).length !== 3) throw new Error('Expected three direct activities');
        if ((await page.$$('[data-arena-scene] img')).length !== 1) throw new Error('Only one scene should load');
        await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-arena-scene] img')).every(img => img.complete && img.naturalWidth > 0));
        if (await page.$('dialog[open],[role="dialog"]')) throw new Error('The hub must not open a dialog automatically');
        await page.focus('a[data-arena-activity="carnet"]');
        for (const id of ['jouer','classement']) {
          await page.keyboard.press('Tab');
          if (await page.evaluate(() => document.activeElement?.getAttribute('data-arena-activity')) !== id) throw new Error('Direct activities must follow normal keyboard order');
        }
        if (auditLobby) console.log('OK three direct activities, one scene, optional help, keyboard order ' + width + 'px');
      }
      if (auditSections && ["notebook", "rankings", "flowers", "placard"].includes(screen)) {
        const scene = await page.$('[data-arena-scene]');
        if (!scene || await scene.$$eval('a[aria-current="page"]', nodes => nodes.length) !== 1) throw new Error('Missing active mode');
        await scene.$eval('a', node => node.focus());
        await page.keyboard.press('Tab');
        if (!await page.evaluate(() => Boolean(document.activeElement?.closest('[data-arena-scene]')))) throw new Error('Scene navigation cannot be reached by keyboard: ' + await page.evaluate(() => document.activeElement?.outerHTML?.slice(0,300)));
      }
      if (auditSections && screen === "notebook") {
        await page.click('.contest-notebook-cover-button');
        await page.waitForSelector('dialog[open]');
        await page.waitForFunction(() => !document.querySelector('dialog[open] [data-turning]'));
        await new Promise(resolve => setTimeout(resolve, 800));
        await page.screenshot({path: resolve(reportDir, 'notebook-open-' + width + '.png')});
        await page.click('button[aria-label="Fermer le carnet"]');
      }
      if (screen === "placard") {
        const toggle = await page.$('button[aria-controls="placard-hud-details"]');
        await toggle.click();
        if (await toggle.evaluate((button) => button.getAttribute("aria-expanded")) !== "true") throw new Error("HUD cannot expand");
        await toggle.click();
      }
      if (screen === "catalog") {
        await page.click('button[aria-label^="Ouvrir le panier"]');
        const cart = await page.$('aside[aria-label="Panier matériel"]');
        if (!cart || !(await cart.isVisible())) throw new Error("Cart is not visible");
        await page.screenshot({ path: resolve(reportDir, `cart-${width}.png`) });
      }
      console.log(`OK ${screen} ${width}px`);
    }
  }
  if (errors.length) throw new Error([...new Set(errors)].join("\n"));
  if (auditProfile) await writeFile(resolve(reportDir, 'profile-report.json'), JSON.stringify({ passed: true, results: profileResults, errors, remoteWrites: 0, apiFixtures: true }, null, 2));
  console.log(`Screenshots: ${reportDir} (mock data, fallback fonts)`);
} finally {
  try { await browser?.close(); } finally { await server.close(); }
}
