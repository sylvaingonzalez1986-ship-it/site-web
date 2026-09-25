/** Real book and tasting components, synthetic data, no credentials or production writes. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { buildKqProducerRewardProgress } from "../src/lib/kanab-quest-producer-rewards.ts";

const root = process.cwd();
const reportDir = resolve(root, "output/tasting-book");
const notesOnly = process.argv.includes('--notes-only');
const rewardsOnly = process.argv.includes('--rewards-only');
const previewFonts = `
  @font-face {font-family:BookDisplay;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}
  @font-face {font-family:BookBody;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:400 700}
  @font-face {font-family:BookHand;src:url('/src/app/fonts/Caveat-Latin-Bold.woff2');font-weight:700}
  :root{--font-display:BookDisplay;--font-body:BookBody;--font-sans:BookBody;--font-handwritten:BookHand}body{margin:0}
`;
const modules = {
  "book-preview-entry": `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {ContestTastingBook} from '/src/components/contest/ContestTastingBook';
    import {CONTEST_SCORE_CRITERIA} from '/src/types/contest';
    const entries = ['regular', 'concours'].flatMap((track, ti) => ['outdoor', 'greenhouse', 'indoor'].flatMap((category, ci) => [0,1].map(i => ({
      id: track+'-'+category+'-'+i, slug: track+'-'+category+'-'+i, title: ['Douceur de Bretagne', 'Fleur du soleil'][i],
      productId: 'product-'+i, seasonId:'season', track, category, story:'Une fleur cultivée avec attention, récoltée à la main et affinée lentement. Prends le temps de découvrir son caractère.',
      technicalSheet:{genetics:'Sélection bretonne',soil:'Terre vivante',harvestLabel:'Été 2026',cbdPercent:12.5},
      producer:{id:'producer',name:'Le jardin de Sylvain',region:'Bretagne'},
      imageUrl:'/product_flower.jpg', galleryUrls:[], isPublished:true,position:ti*6+ci*2+i,createdAt:'2026-09-10',updatedAt:'2026-09-10',
      stats:{approvedReviewCount:0,averageScore:0,criterionAverages:{},consumptionCounts:{}},
    }))));
    const params = new URLSearchParams(location.search);
    const visible = params.has('empty') ? entries.filter(e => e.category!=='indoor') : entries;
    if (!params.has('noAverage')) for (const entry of entries) entry.stats = {approvedReviewCount:3, averageScore:74, criterionAverages:Object.fromEntries(CONTEST_SCORE_CRITERIA.map(c=>[c,74])), consumptionCounts:{}};
    const unlocks = entries.filter(e=>e.id.endsWith('-0')).map(e=>({entryId:e.id,unlockedAt:'2026-09-10',review:params.has('review') ? {
      id:'review-'+e.id,entryId:e.id,seasonId:'season',pseudo:'Sylvain',consumptionMethod:'vaporizer',comment:'Mes notes enregistrées sur cette fleur.',status:params.get('review'),adminNote:'',qualityMark:'standard',createdAt:'2026-09-10',updatedAt:'2026-09-10',scores:CONTEST_SCORE_CRITERIA.map(criterion=>({criterion,score:92})),aromaTags:[],terpeneGuesses:[]
    } : undefined}));
    createRoot(document.getElementById('root')).render(React.createElement(ContestTastingBook,{entries:visible,unlocks:params.has('locked')?[]:unlocks,viewerProfile:{pseudo:'Sylvain',createdAt:'2026-09-10',updatedAt:'2026-09-10'},badges:[],isAuthenticated:true,seasonLabel:'Les dégustations de l’Arène · Saison 2026',initialTrack:params.get('initialTrack') || 'regular',initialCategory:params.get('category') || 'outdoor'}));
  `,
  "next/image": `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return React.createElement('img', {...props, src: typeof src === 'string' ? src : src.src, style: {...(fill ? {position:'absolute',inset:0,width:'100%',height:'100%'} : {}), ...props.style}}); }`,
  "next/link": `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}) {return React.createElement('a',props);}`,
  "next/dynamic": `import React from 'react'; export default function dynamic(loader, options={}) {const Component=React.lazy(() => loader().then(m => ({default:m.default || m}))); return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading ? React.createElement(options.loading) : null},React.createElement(Component,props));};}`,
  "next/navigation": `export const usePathname=()=>'/arene/carnet/regular'; export const useSearchParams=()=>new URLSearchParams(); export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{window.__bookRefreshes=(window.__bookRefreshes||0)+1;}});`,
};
const submissions = [];
let rewardFixture = { completed: false, purchasedAll: false, completionGranted: false, purchaseGranted: false, rarity: 'silver', failAction: null };
const rewardRequests = [];
const producerCampaign = () => buildKqProducerRewardProgress({
  campaignId: 'campaign-preview', producerId: 'producer', producerName: 'Le jardin de Sylvain',
  heritageCode: '', heritageName: '', heritageDescription: '', heritageGranted: false,
  approvedProductIds: rewardFixture.completed ? ['product-0', 'product-1'] : [],
  purchasedProductIds: rewardFixture.purchasedAll ? ['product-0', 'product-1'] : ['product-0'],
  completionGranted: rewardFixture.completionGranted,
  purchaseGranted: rewardFixture.purchaseGranted,
  purchaseCard: rewardFixture.purchaseGranted && !rewardFixture.cardUnavailable ? { code: 'BUDDIE-PREVIEW', name: 'Le compagnon du jardin', rarity: rewardFixture.rarity, imageUrl: '' } : null,
  entries: ['regular', 'concours'].flatMap(track => ['outdoor', 'greenhouse', 'indoor'].flatMap(category => [0,1].map(i => ({
    entryId: `${track}-${category}-${i}`, productId: `product-${i}`, title: ['Douceur de Bretagne', 'Fleur du soleil'][i], track,
  })))),
});
const server = await createServer({
  configFile: false, envDir: false, root, publicDir: resolve(root, "public"), cacheDir: resolve(reportDir, 'vite-cache'),
  esbuild: { jsx: "automatic" }, resolve: { alias: { "@": resolve(root, "src") }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: "tasting-book-preview", enforce: "pre",
    resolveId(id) { if (id in modules) return `\0${id}`; },
    load(id) { if (id.startsWith("\0")) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url?.startsWith('/api/')) {
          response.setHeader('Content-Type','application/json');
          if (request.url === '/api/contest/producer-rewards' && request.method === 'GET') {
            response.end(JSON.stringify({campaigns:[producerCampaign()]})); return;
          }
          if (request.url === '/api/contest/producer-rewards' && request.method === 'POST') {
            let body=''; request.on('data',chunk=>body+=chunk); request.on('end',()=>{
              const claim = JSON.parse(body); rewardRequests.push(claim);
              if (claim.action === rewardFixture.failAction) {
                rewardFixture.failAction = null; response.statusCode = 503;
                response.end(JSON.stringify({error:'Erreur de test : ta progression est conservée, réessaie.'})); return;
              }
              if (claim.producerId === 'producer' && claim.action === 'purchase-buddie' && rewardFixture.purchaseGranted && rewardFixture.alreadyGrantedReceipt) {
                response.end(JSON.stringify({campaign:producerCampaign(),receipt:{alreadyGranted:true,cardInstanceId:null}})); return;
              }
              if (claim.producerId !== 'producer' || (claim.action === 'completion' ? !rewardFixture.completed : claim.action !== 'purchase-buddie' || !rewardFixture.purchasedAll || rewardFixture.purchaseGranted)) {
                response.statusCode = 409; response.end(JSON.stringify({error:'Récompense indisponible pour cette progression.'})); return;
              }
              if (claim.action === 'completion') rewardFixture.completionGranted = true;
              else rewardFixture.purchaseGranted = true;
              response.end(JSON.stringify({campaign:producerCampaign()}));
            }); return;
          }
          if (request.url === '/api/contest/reviews' && request.method === 'POST') {
            let body=''; request.on('data',chunk=>body+=chunk); request.on('end',()=>{submissions.push(JSON.parse(body));response.end('{"error":"Erreur de test : réessaie sans perdre tes notes."}');}); response.statusCode=503; return;
          }
          response.end('{"availableEntitlements":[],"campaigns":[],"collection":{"cards":[]}}'); return;
        }
        if (request.url?.split('?')[0] !== '/') return next();
        response.setHeader('Content-Type','text/html');
        response.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carnet · vérification locale</title><style>'+previewFonts+'</style><div class="site-background"><header><button id="site-navigation">Navigation du site</button></header><main class="relative z-0"><div id="root"></div></main><footer><a id="site-footer" href="#">Pied de page du site</a></footer></div><script type="module" src="/@id/__x00__book-preview-entry"></script></html>');
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3197, strictPort: true, hmr: false, watch: { ignored: ['**/output/**','**/.next/**'] } },
});
let browser;
const errors = [];
const results = [];
const rewardResults = [];
try {
  await mkdir(reportDir,{recursive:true}); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(reportDir,'chrome-profile'), args:['--no-sandbox','--disable-gpu'] });
  const page = await browser.newPage();
  page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  await page.setRequestInterception(true);
  page.on('request',request=> { const url = new URL(request.url()); if(url.protocol==='data:' || (url.hostname==='127.0.0.1' && url.port==='3197')) void request.continue(); else void request.abort(); });
  const click = async (label) => { await page.waitForSelector(`button[aria-label="${label}"]`,{visible:true}); await page.click(`button[aria-label="${label}"]`); };
  const shot = async name => { await new Promise(r=>setTimeout(r,300)); await page.screenshot({path:resolve(reportDir,`${name}.png`)}); };
  const checkLayout = async () => page.evaluate(()=> {
    const book = document.querySelector('[data-tasting-book]');
    const rect=book.getBoundingClientRect();
    const overflowing=[...book.querySelectorAll('button,a,input,textarea')].filter(e=>e.getClientRects().length && !e.closest('[hidden]')).filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right>innerWidth+1;});
    return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,outside:overflowing.map(e=>e.textContent.slice(0,50)),bottom:rect.bottom};
  });
  if (!notesOnly && !rewardsOnly) {
  for (const width of [320,390,768,1440]) {
    await page.setViewport({width,height:width<700?844:1000,deviceScaleFactor:1,hasTouch:width<700,isMobile:width<700});
    await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-tasting-book]', { visible: true, timeout: 60000 });
    await shot(`cover-${width}`);
    await click('Ouvrir mon carnet de dégustation');
    await new Promise(r=>setTimeout(r,750)); await shot(`contents-${width}`);
    assert.equal(await page.$eval('#site-footer',e=>getComputedStyle(e).visibility),'hidden');
    assert.equal(await page.locator('h2').map(e=>e.textContent).wait(),'Table des matières');
    assert.equal(await page.$$eval('button[data-culture]',buttons=>buttons.length),3);
    for (const category of ['Outdoor','Greenhouse','Indoor']) {
      await click(`${category}, 4 fleurs`);
      assert.deepEqual(await page.$$eval('[data-book-entry]',buttons=>buttons.map(button=>button.dataset.track)),['regular','regular','concours','concours']);
      assert(await page.$$eval('[data-book-entry]',buttons=>buttons.every(button=>button.textContent.includes('Le jardin de Sylvain'))));
      await click('Table des matières');
    }
    await click('Outdoor, 4 fleurs'); await shot(`flowers-${width}`);
    if (width === 390) {
      await page.evaluate(() => {
        const target=document.querySelector('[data-book-scroll]');
        const start=new Touch({identifier:1,target,clientX:280,clientY:300});
        const end=new Touch({identifier:1,target,clientX:100,clientY:300});
        target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[start]}));
        target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[end]}));
      });
      await page.waitForFunction(()=>document.querySelector('h2').textContent==='Greenhouse');
      await click('Chapitre précédent');
    }
    await page.click('[data-book-entry="regular-outdoor-0"]');
    if (width === 390) {
      await click('Fleur suivante'); await click('Fleur suivante');
      assert(await page.$eval('[data-tasting-book]',book=>book.textContent.includes('Outdoor · Concours')));
      await click('Fleur précédente'); await click('Fleur précédente');
    }
    await shot(`flower-${width}`);
    await page.locator('::-p-text(Déguster cette fleur)').click();
    await page.waitForSelector('[data-tasting-scroll]',{visible:true});
    await shot(`tasting-start-${width}`);
    await click('Étape 2 : Aspect');
    await page.$eval('input[type=range]',el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'83');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
    await shot(`tasting-score-${width}`);
    const layout=await checkLayout();assert.equal(layout.overflow,false);assert.deepEqual(layout.outside,[]);
    const footer=await page.$eval('[data-tasting-scroll] + footer',e=>{const r=e.getBoundingClientRect();return {height:r.height,bottom:r.bottom};});
    assert(footer.height>=44 && footer.bottom<=layout.height, 'Tasting controls must stay visible');
    await click('Étape 5 : Verdict');
    await page.type('textarea','Mes impressions restent dans le carnet.');
    await click('Table des matières'); await click('Outdoor, 4 fleurs');
    await page.click('[data-book-entry="regular-outdoor-0"]');
    await page.locator('::-p-text(Déguster cette fleur)').click();
    assert.equal(await page.$eval('textarea',e=>e.value),'Mes impressions restent dans le carnet.');
    await page.locator('::-p-text(Envoyer mon avis)').click();
    await page.waitForFunction(()=>document.body.textContent.includes('Erreur de test'));
    assert.equal(submissions.at(-1).scores.appearance,83);
    assert.equal(submissions.at(-1).entryId,'regular-outdoor-0');
    assert.equal(submissions.at(-1).comment,'Mes impressions restent dans le carnet.');
    if(width===390) {
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.querySelector('h2').textContent==='Douceur de Bretagne' && document.body.textContent.includes('La fiche botanique'));
      await page.locator('::-p-text(Déguster cette fleur)').click();
      assert.equal(await page.$eval('textarea',e=>e.value),'Mes impressions restent dans le carnet.');
      await page.setViewport({width:390,height:480,isMobile:true,hasTouch:true});
      const small=await checkLayout(); const footerBottom=await page.$eval('[data-tasting-scroll] + footer',e=>e.getBoundingClientRect().bottom);
      assert(footerBottom<=480); assert.equal(small.overflow,false); await shot('keyboard-height-390');
    }
    results.push({width,layout,footer,draftPreserved:true,submissionFailurePreservesDraft:true});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  for (const initialTrack of ['regular','concours']) {
    await page.goto(`http://127.0.0.1:3197/?initialTrack=${initialTrack}&category=greenhouse`,{waitUntil:'networkidle0'});
    await click('Ouvrir mon carnet de dégustation');
    await click('Explorer les fleurs');
    assert.equal(await page.$eval('h2',heading=>heading.textContent),'Greenhouse');
    assert.equal(await page.$$eval('[data-book-entry]',buttons=>buttons.length),4);
  }
  await page.click('[data-book-entry="concours-greenhouse-0"]');
  await page.locator('::-p-text(Déguster cette fleur)').click();
  await page.waitForSelector('[data-tasting-scroll]',{visible:true});
  await click('Étape 5 : Verdict');
  await page.type('textarea','Ma dégustation Concours compte dans le même carnet.');
  await page.locator('::-p-text(Envoyer mon avis)').click();
  await page.waitForFunction(()=>document.body.textContent.includes('Erreur de test'));
  assert.equal(submissions.at(-1).entryId,'concours-greenhouse-0');
  assert.equal(submissions.at(-1).comment,'Ma dégustation Concours compte dans le même carnet.');
  await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
  await click('Ouvrir mon carnet de dégustation');
  await click('Outdoor, 4 fleurs');
  await page.click('[data-book-entry="regular-outdoor-0"]');
  await click('Voir les récompenses de cette fleur');
  await page.waitForSelector('.contest-notebook-collection-tab',{visible:true});
  await page.waitForSelector('progress[aria-label="Fleurs dégustées avec un avis validé"]',{visible:true});
  assert.equal(await page.$eval('progress[aria-label="Fleurs dégustées avec un avis validé"]',progress=>progress.max),2);
  assert.equal(await page.$$eval('[aria-label="Fleurs du producteur"] > li',flowers=>flowers.length),2);
  await shot('rewards-390');
  assert.deepEqual((await checkLayout()).outside,[]);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto('http://127.0.0.1:3197/?empty=1&locked=1',{waitUntil:'networkidle0'});
  await click('Ouvrir mon carnet de dégustation');
  await click('Indoor, 0 fleurs'); await shot('empty-390');
  assert(await page.locator('[data-book-scroll]').map(e=>e.textContent.includes('encore en culture')).wait());
  await click('Table des matières'); await click('Outdoor, 4 fleurs');
  await page.click('[data-book-entry="regular-outdoor-0"]');
  await page.locator('::-p-text(Déguster cette fleur)').click();
  await page.waitForFunction(()=>document.body.textContent.includes('ayant acheté ce lot'));
  assert.equal(await page.$$eval('textarea',els=>els.length),0);
  await shot('locked-390');
  await click('Fermer le carnet');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Ouvrir mon carnet de dégustation');
  }
  if (!rewardsOnly) {
  for (const width of [320,390,1440]) for (const status of ['approved','pending','rejected']) {
    await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
    await page.goto(`http://127.0.0.1:3197/?review=${status}`,{waitUntil:'networkidle0'});
    await click('Ouvrir mon carnet de dégustation');
    await click('Outdoor, 4 fleurs');
    await page.click('[data-book-entry="regular-outdoor-0"]');
    await page.locator('::-p-text(Retrouver mes notes)').click();
    await page.waitForSelector('[data-book-notes]',{visible:true});
    assert.equal(await page.$eval('[data-score="player"] strong',e=>e.textContent),'92,0/100');
    assert.equal(await page.$eval('[data-score="community"] strong',e=>e.textContent),'74,0/100');
    assert.equal(await page.$$eval('.contest-review-skill-area-self',els=>els.length),1);
    assert.equal(await page.$$eval('.contest-review-skill-area-average',els=>els.length),1);
    assert.equal(await page.$eval('.contest-review-skill-legend',e=>getComputedStyle(e).opacity),'1');
    const notesLayout=await checkLayout(); assert.equal(notesLayout.overflow,false); assert.deepEqual(notesLayout.outside,[]);
    await shot(`notes-${status}-${width}`);
    await page.locator(`::-p-text(${status==='pending'?'Modifier mes notes':'Lire mes notes'})`).click();
    await page.waitForSelector('[data-tasting-scroll]',{visible:true});
    if(status!=='pending') {
      await click('Étape 2 : Aspect');
      assert(await page.$$eval('[data-tasting-scroll] input[type="range"]',els=>els.length>0 && els.every(e=>e.disabled)));
    }
    await click('Étape 5 : Verdict');
    if(status==='pending') {
      assert.equal(await page.$eval('textarea',e=>e.value),'Mes notes enregistrées sur cette fleur.');
      await page.type('textarea',' Modification conservée.');
    }
    await shot(`notes-detail-${status}-${width}`);
    await page.locator('[data-tasting-scroll] + footer button:last-child').click();
    await page.waitForSelector('[data-book-notes]',{visible:true});
    if(status==='pending') assert(await page.$eval('[data-book-notes]',e=>e.textContent.includes('Modification conservée.')));
    await page.locator('::-p-text(Retour à la fleur)').click();
    assert(await page.$eval('[data-tasting-book]',e=>e.dataset.open==='true'));
    await page.locator('::-p-text(Retrouver mes notes)').click();
    await page.waitForSelector('[data-book-notes]',{visible:true});
    assert.equal(page.url(),`http://127.0.0.1:3197/?review=${status}`);
    assert.equal(await page.$$eval('[role="dialog"]',els=>els.length),0);
  }
  await page.goto('http://127.0.0.1:3197/?review=pending&noAverage=1',{waitUntil:'networkidle0'});
  await click('Ouvrir mon carnet de dégustation'); await click('Outdoor, 4 fleurs');
  await page.click('[data-book-entry="regular-outdoor-0"]');
  await page.locator('::-p-text(Retrouver mes notes)').click(); await page.waitForSelector('[data-book-notes]',{visible:true});
  assert.equal(await page.$$eval('.contest-review-skill-area-average',els=>els.length),0);
  assert.equal(await page.$eval('[data-score="community"] strong',e=>e.textContent),'—');
  }
  if (!notesOnly) {
    const openRewards = async (entryId) => {
      await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
      await click('Ouvrir mon carnet de dégustation'); await click('Outdoor, 4 fleurs');
      await page.click(`[data-book-entry="${entryId}"]`); await click('Voir les récompenses de cette fleur');
      await page.waitForSelector('progress[aria-label="Fleurs dégustées avec un avis validé"]',{visible:true});
      await page.waitForFunction(()=>!document.querySelector('[data-opening]'));
    };
    const claimButton = async (label) => {
      await page.evaluate((text) => {
        const button = [...document.querySelectorAll('.contest-notebook-collection-tab button')].find(item=>item.textContent.trim()===text);
        if (!button || button.disabled) throw new Error('Expected an enabled claim button: ' + text);
        button.scrollIntoView({block:'center'}); button.click();
      },label);
    };
    for (const width of [320,390]) {
      rewardFixture = { completed: false, purchasedAll: false, completionGranted: false, purchaseGranted: false, rarity: width===320 ? 'silver' : 'gold', failAction: null };
      rewardRequests.length = 0;
      await page.setViewport({width,height:844,isMobile:true,hasTouch:true});
      const entryId = width===320 ? 'regular-outdoor-0' : 'concours-outdoor-0';
      await openRewards(entryId);
      assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>!button.disabled && /Récupérer mon bonus|Tirer mon Buddie/.test(button.textContent)).length),0);
      assert.equal(await page.$eval('progress',progress=>progress.value),0);
      assert.equal(await page.$eval('progress',progress=>progress.max),2);
      const partialLayout = await checkLayout(); assert.equal(partialLayout.overflow,false); assert.deepEqual(partialLayout.outside,[]);
      await shot(`producer-rewards-partial-${width}`);

      rewardFixture.completed = true; rewardFixture.failAction = 'completion';
      await openRewards(entryId); await claimButton('Récupérer mon bonus');
      await page.waitForFunction(()=>document.body.textContent.includes('ta progression est conservée'));
      assert.equal(rewardFixture.completionGranted,false);
      assert.equal(await page.$eval('progress',progress=>progress.value),2);
      await claimButton('Récupérer mon bonus');
      await page.waitForFunction(()=>document.body.textContent.includes('Bonus reçu'));
      assert.equal(rewardFixture.completionGranted,true);
      assert.deepEqual(rewardRequests,[{action:'completion',producerId:'producer'},{action:'completion',producerId:'producer'}]);
      await openRewards(entryId);
      assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>button.textContent.includes('Récupérer mon bonus')).length),0);
      assert(await page.$eval('.contest-notebook-collection-tab',element=>element.textContent.includes('Bonus reçu')));

      rewardFixture.purchasedAll = true; rewardFixture.failAction = 'purchase-buddie';
      await openRewards(entryId); await claimButton('Tirer mon Buddie');
      await page.waitForFunction(()=>document.body.textContent.includes('ta progression est conservée'));
      assert.equal(rewardFixture.purchaseGranted,false);
      await claimButton('Tirer mon Buddie');
      await page.waitForFunction(()=>document.body.textContent.includes('Le compagnon du jardin'));
      assert.equal(rewardFixture.purchaseGranted,true);
      assert.deepEqual(rewardRequests.slice(-2),[{action:'purchase-buddie',producerId:'producer'},{action:'purchase-buddie',producerId:'producer'}]);
      assert(await page.$eval('.contest-notebook-collection-tab',(element,rarity)=>element.textContent.includes('Buddie '+rarity),width===320?'Argent':'Or'));
      assert.equal(await page.$$eval('.contest-notebook-collection-tab a[href="/profil/collection"]',links=>links.filter(link=>link.textContent.trim()==='Ouvrir ma collection').length),1);
      await openRewards(entryId);
      assert(await page.$eval('.contest-notebook-collection-tab',element=>element.textContent.includes('Le compagnon du jardin')));
      assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>button.textContent.includes('Tirer mon Buddie')).length),0);
      assert.equal(rewardRequests.length,4);
      const claimedLayout = await checkLayout(); assert.equal(claimedLayout.overflow,false); assert.deepEqual(claimedLayout.outside,[]);
      await shot(`producer-rewards-claimed-${width}`);
      await page.$eval('[data-book-scroll]',element=>{element.scrollTop=element.scrollHeight;});
      await shot(`producer-rewards-buddie-${width}`);
      rewardResults.push({width,entryId,partialLayout,claimedLayout,completionClaimed:true,purchaseClaimed:true,rarity:rewardFixture.rarity,errorRetryPreservesProgress:true,claimsPersistOnReload:true,noRedraw:true});
    }
    rewardFixture = { completed: true, purchasedAll: true, completionGranted: true, purchaseGranted: false, rarity: 'gold', failAction: null };
    rewardRequests.length = 0;
    await openRewards('concours-outdoor-0');
    // Another tab already claimed the draw; this tab still shows its old enabled button.
    rewardFixture.purchaseGranted = true; rewardFixture.cardUnavailable = true; rewardFixture.alreadyGrantedReceipt = true;
    await claimButton('Tirer mon Buddie');
    await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')].some(element=>element.textContent==='Tu as déjà reçu le Buddie de ce producteur.'));
    assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>button.textContent.includes('Tirer mon Buddie')).length),0);
    assert.deepEqual(rewardRequests,[{action:'purchase-buddie',producerId:'producer'}]);
    await openRewards('concours-outdoor-0');
    assert(await page.$eval('.contest-notebook-collection-tab',element=>element.textContent.includes('Tu as déjà reçu le Buddie de ce producteur.')));
    assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>button.textContent.includes('Tirer mon Buddie')).length),0);
    assert.equal(rewardRequests.length,1);
    await page.$eval('[data-book-scroll]',element=>{element.scrollTop=element.scrollHeight;});
    await shot('producer-rewards-already-granted-390');
    rewardResults.push({width:390,staleTabAlreadyGranted:true,missingCardKeepsGrantedState:true,noRedraw:true});
  }
  assert.deepEqual(errors,[]);
  const notesChecks={errors,notesStayInBook:true,notesStatuses:['approved','pending','rejected'],playerAndCommunityScores:true,missingAverage:true};
  await writeFile(resolve(reportDir,rewardsOnly?'rewards-report.json':notesOnly?'notes-report.json':'report.json'),JSON.stringify(rewardsOnly?{errors,rewardResults}:notesOnly?notesChecks:{results,...notesChecks,chapters:3,combinedTracks:true,concoursSubmission:true,legacyTrackProps:true,empty:true,locked:true,reducedMotion:true,swipe:true,keyboardBack:true,rewards:true,rewardResults,siteChromeHidden:true},null,2));
  console.log(JSON.stringify({passed:true,notesOnly,rewardsOnly,widths:rewardsOnly?[320,390]:notesOnly?[320,390,1440]:results.map(x=>x.width),screenshots:reportDir}));
} finally { await browser?.close(); await server.close(); }
