/** Isolated UI preview: real components, fake data, no .env or database access. */
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const auditDice = process.argv.includes("--dice");
const auditReputation = process.argv.includes("--reputation");
const auditTutorial = process.argv.includes("--tutorial");
const auditSections = process.argv.includes("--sections");
const auditLobby = process.argv.includes("--lobby");
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
    const game = startKqGame(2026);
    const session = {activeRun: {runId: 'preview-run', state: game, burnReceipts: []}, flowers: [], battles: [], progress: null};
    window.__diceRequests = 0;
    const fixture = ${JSON.stringify(fixture)};
    window.__saleRequests = 0;
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
    const Component = ['notebook', 'rankings', 'flowers'].includes(screen) ? ContestHubClient : screen === 'tutorial' ? ArenaFirstVisitTutorial : screen?.startsWith('game-') ? KanabQuestDicePrototype : screen === 'placard' ? PlacardPlayerShell : screen?.startsWith('market') ? KqMarketDesk : screen === 'catalog' ? KqEquipmentCatalogModal : ContestArenaHub;
    createRoot(document.getElementById('root')).render(React.createElement(Component, {seasons: [], selectedTrack: 'regular', activeCategory: 'indoor', categoryCounts: {outdoor: 0, greenhouse: 0, indoor: 1}, entries: [sampleEntry], rankings: [sampleEntry], feed: [], notebookUnlocks: [], viewerProfile: null, viewerBadges: [], viewerProgress: null, testerSeasonRankings: [], testerGlobalRankings: [], isAuthenticated: false, isAdminAuthorized: false, isPlacardPlayerEnabled: true, initialView: screen === 'rankings' ? 'classement' : 'carnet', surface: screen === 'rankings' ? 'arena' : screen === 'flowers' ? 'notebook-ranking' : 'notebook', apiScope: 'player', viewMode: 'game', onOpenShop: () => {}, onClose: () => {}}));
  `,
  "preview-cart": `export const useCart=()=>({addToCart:()=>{},authLoading:false,customer:null,items:[]});`,
  "next/image": `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return React.createElement('img', {...props, src: typeof src === 'string' ? src : src.src, style: {...(fill ? {position:'absolute',inset:0,width:'100%',height:'100%'} : {}), ...props.style}}); }`,
  "next/link": `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}) {return React.createElement('a',props);}`,
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
  page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || (url.hostname === "127.0.0.1" && url.port === "3198")) void request.continue();
    else void request.abort();
  });
  for (const width of auditDice ? [390, 1440] : [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: width < 700 ? 844 : 1000, deviceScaleFactor: 1 });
    for (const screen of auditDice ? ["game-direct", "game-error", "game-stalled"] : auditReputation ? ["market-loss", "market-neutral", "market-gain"] : auditTutorial ? ["tutorial"] : auditSections ? ["notebook", "rankings", "flowers", "placard", "market", "catalog"] : auditLobby ? ["landing"] : ["landing", "placard", "market", "catalog"]) {
      await page.goto(`http://127.0.0.1:3198/?screen=${screen}`, { waitUntil: "networkidle0", timeout: 60000 });
      await page.waitForSelector(screen === "catalog" || auditTutorial ? '[role="dialog"]' : 'h1', { timeout: 30000 });
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
        if (auditLobby) {
          if (await page.$eval('[aria-label="Sons du menu"]', el => el.getAttribute('aria-pressed')) !== 'false') throw new Error('Sound must start off');
          const animations = new Set();
          for (const id of Object.keys(destinations)) {
            await page.click('button[data-mode="' + id + '"]');
            await page.waitForSelector('[data-lobby-mode="' + id + '"]');
            if (await page.$eval('[data-lobby-enter]', el => el.getAttribute('href')) !== destinations[id]) throw new Error('Wrong entry destination');
            if ((await page.$$('nav[aria-label="Choisir un mode"]')).length !== 1 || (await page.$$('[data-lobby-enter]')).length !== 1) throw new Error('Duplicate navigation');
            await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-scene] img')).every(img => img.complete && img.naturalWidth > 0));
            animations.add(await page.$eval('[data-scene][data-active] img', el => getComputedStyle(el.parentElement).animationName));
            await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
            await page.screenshot({path: resolve(reportDir, 'lobby-' + id + '-' + width + '.png'), fullPage: true});
          }
          if (animations.size !== 3 || animations.has('none')) throw new Error('Each mode needs a distinct animation');
          await page.click('[aria-label="Sons du menu"]');
          await page.waitForFunction(() => document.querySelector('[aria-label="Sons du menu"]').getAttribute('aria-pressed') === 'true');
          await page.click('[aria-label="Sons du menu"]');
          await page.waitForFunction(() => document.querySelector('[aria-label="Sons du menu"]').getAttribute('aria-pressed') === 'false');
          await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
          await page.focus('button[data-mode="carnet"]');
          const reduced = await page.$eval('[data-scene][data-active] img', el => getComputedStyle(el.parentElement).animationName);
          if (reduced !== 'none') throw new Error('Reduced motion not respected');
          await page.emulateMediaFeatures([]);
          console.log('OK three scenes, single entry, sound opt-in/out, reduced motion ' + width + 'px');
        }
        await page.focus('button[data-mode="carnet"]');
        await page.keyboard.press("ArrowRight");
        if (await page.evaluate(() => document.activeElement?.getAttribute("data-mode")) !== "jouer") throw new Error("Keyboard selection failed");
        await page.keyboard.press("End");
        await page.waitForSelector('[data-lobby-mode="classement"]');
        await page.keyboard.press("Home");
        await page.waitForSelector('[data-lobby-mode="carnet"]');
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
  console.log(`Screenshots: ${reportDir} (mock data, fallback fonts)`);
} finally {
  try { await browser?.close(); } finally { await server.close(); }
}
