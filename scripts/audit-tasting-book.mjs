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
    if (params.has('images')) {
      Object.assign(entries.find(e=>e.id==='regular-outdoor-0'), {
        imageUrl:' /__book-images/missing-primary.jpg ',
        product:{id:'product-0',image:' /product_flower.jpg?book-image=product '},
        galleryUrls:['/product_flower.jpg?book-image=unused-gallery'],
      });
      Object.assign(entries.find(e=>e.id==='regular-outdoor-1'), {
        imageUrl:'/__book-images/missing-entry-gallery.jpg',
        product:{id:'product-1',image:'/__book-images/missing-product.jpg'},
        galleryUrls:[' /product_flower.jpg?book-image=gallery ','/product_flower.jpg?book-image=gallery'],
      });
      Object.assign(entries.find(e=>e.id==='regular-greenhouse-0'), {
        imageUrl:'/__book-images/missing-all-entry.jpg',
        product:{id:'product-0',image:'/__book-images/missing-all-product.jpg'},
        galleryUrls:[' /__book-images/missing-all-gallery.jpg ','/__book-images/missing-all-gallery.jpg'],
      });
    }
    const visible = params.has('empty') ? entries.filter(e => e.category!=='indoor') : entries;
    if (!params.has('noAverage')) for (const entry of entries) entry.stats = {approvedReviewCount:3, averageScore:74, criterionAverages:Object.fromEntries(CONTEST_SCORE_CRITERIA.map(c=>[c,74])), consumptionCounts:{}};
    const unlocks = entries.filter(e=>e.id.endsWith('-0')).map(e=>({entryId:e.id,unlockedAt:'2026-09-10',review:params.has('review') ? {
      id:'review-'+e.id,entryId:e.id,seasonId:'season',pseudo:'Sylvain',consumptionMethod:'vaporizer',comment:'Mes notes enregistrées sur cette fleur.'+(params.has('reviewDistinct')?' '+e.id:''),status:params.get('review'),adminNote:'',qualityMark:'standard',createdAt:'2026-09-10',updatedAt:'2026-09-10',scores:CONTEST_SCORE_CRITERIA.map(criterion=>({criterion,score:92})),aromaTags:[],terpeneGuesses:[]
    } : undefined}));
    createRoot(document.getElementById('root')).render(React.createElement(ContestTastingBook,{entries:visible,unlocks:params.has('locked')?[]:unlocks,viewerProfile:params.has('missingProfile') ? null : {pseudo:'Sylvain',createdAt:'2026-09-10',updatedAt:'2026-09-10'},badges:[],isAuthenticated:!params.has('anonymous'),draftOwnerId:params.get('owner'),initialEntryId:params.get('entry'),initialEditNotes:params.get('edit')==='notes'||params.get('view')==='notes',seasonLabel:'Les dégustations de l’Arène · Saison 2026',initialTrack:params.get('initialTrack') || 'regular',initialCategory:params.get('category') || 'outdoor'}));
  `,
  "next/image": `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return React.createElement('img', {...props, src: typeof src === 'string' ? src : src.src, style: {...(fill ? {position:'absolute',inset:0,width:'100%',height:'100%'} : {}), ...props.style}}); }`,
  "next/link": `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}) {return React.createElement('a',props);}`,
  "next/dynamic": `import React from 'react'; export default function dynamic(loader, options={}) {const Component=React.lazy(() => loader().then(m => ({default:m.default || m}))); return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading ? React.createElement(options.loading) : null},React.createElement(Component,props));};}`,
  "next/navigation": `export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({push:()=>{},replace:(href)=>history.replaceState(history.state,'',href),refresh:()=>{window.__bookRefreshes=(window.__bookRefreshes||0)+1;}});`,
};
const submissions = [];
let reviewFixture = { status: 503, delay: 0 };
const profileSubmissions = [];
let rewardFixture = { completed: false, purchasedAll: false, completionGranted: false, purchaseGranted: false, rarity: 'silver', failAction: null };
const rewardRequests = [];
const collectionApiRequests = [];
const heritageFixture = {
  code:'HERITAGE-019',name:'Floraison généreuse',
  description:'En Floraison, ajoute +3 au dé le plus faible, sans dépasser 6.',
  imageUrl:'/app/kanab-quest/card-fronts/heritage-019-iznofarm-front-v2.webp',
};
const rewardProducts = () => Array.from({length:rewardFixture.flowerCount ?? 2},(_,index)=>`product-${index}`);
const producerCampaign = () => buildKqProducerRewardProgress({
  campaignId: 'campaign-preview', producerId: 'producer', producerName: 'Iznofarm',
  heritageCode: heritageFixture.code, heritageName: heritageFixture.name, heritageDescription: heritageFixture.description,
  heritageImage: heritageFixture.imageUrl, heritageGranted: rewardFixture.heritageGranted === true,
  approvedProductIds: rewardFixture.completed ? rewardProducts() : rewardProducts().slice(0,rewardFixture.approvedCount ?? 0),
  purchasedProductIds: rewardFixture.purchasedAll ? rewardProducts() : ['product-0'],
  completionGranted: rewardFixture.completionGranted,
  completionCashCents: rewardFixture.completionCashCents,
  purchaseGranted: rewardFixture.purchaseGranted,
  purchaseCard: rewardFixture.purchaseGranted && !rewardFixture.cardUnavailable ? { code: 'BUDDIE-PREVIEW', name: 'Le compagnon du jardin', rarity: rewardFixture.rarity, imageUrl: '' } : null,
  entries: ['regular', 'concours'].flatMap(track => ['outdoor', 'greenhouse', 'indoor'].flatMap(category => rewardProducts().map((productId,i) => ({
    entryId: `${track}-${category}-${i}`, productId, title: ['Douceur de Bretagne', 'Fleur du soleil', 'Brume du jardin'][i], track,
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
        if (request.url?.startsWith('/__book-images/')) {
          response.statusCode = 404;
          response.setHeader('Content-Type', 'text/plain');
          response.end('Missing flower image fixture'); return;
        }
        if (request.url?.startsWith('/api/')) {
          response.setHeader('Content-Type','application/json');
          if (['/api/arena/placard/bootstrap','/api/arena/placard/boosters'].includes(request.url.split('?')[0])) {
            collectionApiRequests.push({method:request.method,url:request.url});
          }
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
              if (claim.action === 'completion') {
                rewardFixture.completionGranted = true;
                rewardFixture.completionCashCents ??= rewardProducts().length * 10_000;
              }
              else rewardFixture.purchaseGranted = true;
              response.end(JSON.stringify({campaign:producerCampaign()}));
            }); return;
          }
          if (request.url === '/api/contest/reviews' && ['POST','PUT'].includes(request.method)) {
            let body=''; request.on('data',chunk=>body+=chunk); request.on('end',()=>{
              const payload = JSON.parse(body); submissions.push({...payload,method:request.method});
              setTimeout(()=>{
                response.statusCode=reviewFixture.status;
                response.end(JSON.stringify(reviewFixture.status===200 ? {review:{...payload,id:'saved-'+payload.entryId,seasonId:'season',pseudo:'Sylvain',status:'pending',adminNote:'',qualityMark:'standard',createdAt:'2026-10-04',updatedAt:'2026-10-04',scores:Object.entries(payload.scores).map(([criterion,score])=>({criterion,score}))}} : {error:'Erreur de test : réessaie sans perdre tes notes.'}));
              },reviewFixture.delay);
            }); return;
          }
          if (request.url === '/api/contest/profile' && request.method === 'POST') {
            let body=''; request.on('data',chunk=>body+=chunk); request.on('end',()=>{
              profileSubmissions.push(JSON.parse(body)); setTimeout(()=>response.end('{}'),600);
            }); return;
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
const imageResults = [];
try {
  await mkdir(reportDir,{recursive:true}); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(reportDir,'chrome-profile'), args:['--no-sandbox','--disable-gpu'] });
  const page = await browser.newPage();
  page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  await page.setRequestInterception(true);
  page.on('request',request=> { const url = new URL(request.url()); if(url.protocol==='data:' || (url.hostname==='127.0.0.1' && url.port==='3197')) void request.continue(); else void request.abort(); });
  // Reused synthetic Chrome profiles must not carry drafts between audit runs.
  await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
  await page.evaluate(()=>localStorage.clear());
  const click = async (label) => {
    const handle = await page.waitForFunction(text => [...document.querySelectorAll('button[aria-label]')]
      .find(button=>button.getAttribute('aria-label')===text && button.getClientRects().length && !button.closest('[hidden]')), {}, label);
    await handle.asElement().click(); await handle.dispose();
  };
  const trackLabels = { regular: 'Regular', concours: 'Concours' };
  const categoryLabels = { outdoor: 'Outdoor', greenhouse: 'Greenhouse', indoor: 'Indoor' };
  const chapters = ['regular','concours'].flatMap(track=>['outdoor','greenhouse','indoor'].map(category=>({track,category})));
  const chapterLabel = (track, category, count=2) => `${trackLabels[track]} · ${categoryLabels[category]}, ${count} fleurs`;
  const openChapter = (track, category, count=2) => click(chapterLabel(track,category,count));
  const assessAllCriteria = async () => {
    for (const [index,label] of [[2,'Aspect'],[3,'Odeur'],[4,'Goût'],[5,'Verdict']]) {
      await click(`Étape ${index} : ${label}`);
      await page.$$eval('[data-book-scroll] > div:not([hidden]) button[aria-label^="Confirmer"]',buttons=>buttons.forEach(button=>button.click()));
    }
  };
  const assertChapterEntries = async (track, category, count=2) => {
    assert.deepEqual(await page.$$eval('[data-book-entry]',buttons=>buttons.map(button=>({id:button.dataset.bookEntry,track:button.dataset.track}))),
      Array.from({length:count},(_,index)=>({id:`${track}-${category}-${index}`,track})));
  };
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
    assert.deepEqual(await page.$$eval('button[data-culture]',buttons=>buttons.map(button=>({track:button.dataset.track,category:button.dataset.culture}))),chapters);
    for (const {track,category} of chapters) {
      await openChapter(track,category);
      await assertChapterEntries(track,category);
      assert(await page.$$eval('[data-book-entry]',buttons=>buttons.every(button=>button.textContent.includes('Le jardin de Sylvain'))));
      await click('Table des matières');
    }
    await openChapter('regular','outdoor'); await shot(`flowers-${width}`);
    if (width === 390) {
      assert.equal(await page.$eval('button[aria-label="Chapitre précédent"]',button=>button.disabled),true);
      for (const {track,category} of chapters.slice(1)) {
        await click('Chapitre suivant'); await assertChapterEntries(track,category);
      }
      assert.equal(await page.$eval('button[aria-label="Chapitre suivant"]',button=>button.disabled),true);
      for (const {track,category} of chapters.slice(0,-1).reverse()) {
        await click('Chapitre précédent'); await assertChapterEntries(track,category);
      }
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
      assert.equal(await page.$eval('button[aria-label="Fleur précédente"]',button=>button.disabled),true);
      await click('Fleur suivante');
      assert.equal(await page.$eval('h2',heading=>heading.textContent),'Fleur du soleil');
      assert.equal(await page.$eval('button[aria-label="Fleur suivante"]',button=>button.disabled),true);
      await click('Fleur précédente');
    }
    await shot(`flower-${width}`);
    await page.locator('::-p-text(Déguster cette fleur)').click();
    await page.waitForSelector('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll]',{visible:true});
    await shot(`tasting-start-${width}`);
    await click('Étape 2 : Aspect');
    await page.$eval('[data-book-scroll] > div:not([hidden]) input[type=range]',el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'83');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
    await shot(`tasting-score-${width}`);
    const layout=await checkLayout();assert.equal(layout.overflow,false);assert.deepEqual(layout.outside,[]);
    const footer=await page.$eval('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll] + footer',e=>{const r=e.getBoundingClientRect();return {height:r.height,bottom:r.bottom};});
    assert(footer.height>=44 && footer.bottom<=layout.height, 'Tasting controls must stay visible');
    await click('Étape 5 : Verdict');
    await page.type('[data-book-scroll] > div:not([hidden]) textarea','Mes impressions restent dans le carnet.');
    if (width === 390) {
      await click('Table des matières'); await openChapter('concours','outdoor');
      await page.click('[data-book-entry="concours-outdoor-0"]');
      await page.locator('::-p-text(Déguster cette fleur)').click();
      await page.waitForSelector('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll]',{visible:true});
      await click('Étape 5 : Verdict');
      await page.type('[data-book-scroll] > div:not([hidden]) textarea','Mes impressions Concours restent distinctes.');
    }
    await click('Table des matières'); await openChapter('regular','outdoor');
    await page.click('[data-book-entry="regular-outdoor-0"]');
    await page.locator('::-p-text(Déguster cette fleur)').click();
    assert.equal(await page.$eval('[data-book-scroll] > div:not([hidden]) textarea',e=>e.value),'Mes impressions restent dans le carnet.');
    await assessAllCriteria();
    await page.locator('::-p-text(Envoyer mon avis)').click();
    await page.waitForFunction(()=>document.body.textContent.includes('Erreur de test'));
    assert.equal(submissions.at(-1).scores.appearance,83);
    assert.equal(submissions.at(-1).entryId,'regular-outdoor-0');
    assert.equal(submissions.at(-1).comment,'Mes impressions restent dans le carnet.');
    if(width===390) {
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.querySelector('h2').textContent==='Douceur de Bretagne' && document.body.textContent.includes('La fiche botanique'));
      await page.locator('::-p-text(Déguster cette fleur)').click();
      assert.equal(await page.$eval('[data-book-scroll] > div:not([hidden]) textarea',e=>e.value),'Mes impressions restent dans le carnet.');
      await click('Table des matières'); await openChapter('concours','outdoor');
      await page.click('[data-book-entry="concours-outdoor-0"]');
      await page.locator('::-p-text(Déguster cette fleur)').click();
      assert.equal(await page.$eval('[data-book-scroll] > div:not([hidden]) textarea',e=>e.value),'Mes impressions Concours restent distinctes.');
      await click('Table des matières'); await openChapter('regular','outdoor');
      await page.click('[data-book-entry="regular-outdoor-0"]');
      await page.locator('::-p-text(Déguster cette fleur)').click();
      await page.setViewport({width:390,height:480,isMobile:true,hasTouch:true});
      await page.waitForFunction(()=>innerHeight===480
        && document.querySelector('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll] + footer')?.getBoundingClientRect().bottom<=480);
      const small=await checkLayout(); const footerBottom=await page.$eval('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll] + footer',e=>e.getBoundingClientRect().bottom);
      assert(footerBottom<=480); assert.equal(small.overflow,false); await shot('keyboard-height-390');
    }
    results.push({width,layout,footer,draftPreserved:true,submissionFailurePreservesDraft:true,chaptersSeparated:true,chapterFlowerCount:2});
  }
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  for (const initialTrack of ['regular','concours']) {
    await page.goto(`http://127.0.0.1:3197/?initialTrack=${initialTrack}&category=greenhouse`,{waitUntil:'networkidle0'});
    await click('Ouvrir mon carnet de dégustation');
    await click(`Explorer ${trackLabels[initialTrack]} · Greenhouse`);
    assert.equal(await page.$eval('h2',heading=>heading.textContent),'Greenhouse');
    await assertChapterEntries(initialTrack,'greenhouse');
  }
  await page.click('[data-book-entry="concours-greenhouse-0"]');
  await page.locator('::-p-text(Déguster cette fleur)').click();
  await page.waitForSelector('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll]',{visible:true});
  await click('Étape 5 : Verdict');
  await page.type('[data-book-scroll] > div:not([hidden]) textarea','Ma dégustation Concours compte dans le même carnet.');
  await assessAllCriteria();
  await page.locator('::-p-text(Envoyer mon avis)').click();
  await page.waitForFunction(()=>document.body.textContent.includes('Erreur de test'));
  assert.equal(submissions.at(-1).entryId,'concours-greenhouse-0');
  assert.equal(submissions.at(-1).comment,'Ma dégustation Concours compte dans le même carnet.');
  await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
  await click('Ouvrir mon carnet de dégustation');
  await openChapter('regular','outdoor');
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
  await openChapter('regular','indoor',0); await shot('empty-390');
  assert(await page.locator('[data-book-scroll]').map(e=>e.textContent.includes('encore en culture')).wait());
  await click('Table des matières'); await openChapter('regular','outdoor');
  await page.click('[data-book-entry="regular-outdoor-0"]');
  await page.locator('::-p-text(Déguster cette fleur)').click();
  await page.waitForFunction(()=>document.body.textContent.includes('ayant acheté ce lot'));
  assert.equal(await page.$$eval('[data-book-scroll] > div:not([hidden]) textarea',els=>els.length),0);
  await shot('locked-390');
  await click('Fermer le carnet');
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Ouvrir mon carnet de dégustation');
  for (const width of [320,390,1440]) {
    await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
    await page.goto('http://127.0.0.1:3197/?images=1',{waitUntil:'networkidle0'});
    await click('Ouvrir mon carnet de dégustation'); await openChapter('regular','outdoor');
    const assertImage = async (selector, expected) => page.waitForFunction((selector, expected) => {
      const image=document.querySelector(selector);
      if (!image || !image.complete || image.naturalWidth===0) return false;
      const source=new URL(image.currentSrc||image.src,location.href);
      return source.pathname+source.search===expected;
    },{},selector,expected);
    const productImage='/product_flower.jpg?book-image=product';
    const galleryImage='/product_flower.jpg?book-image=gallery';
    await assertImage('[data-book-entry="regular-outdoor-0"] img',productImage);
    await assertImage('[data-book-entry="regular-outdoor-1"] img',galleryImage);
    await shot(`image-fallback-thumbnails-${width}`);
    await page.click('[data-book-entry="regular-outdoor-0"]');
    await assertImage('[data-book-scroll] > article img',productImage);
    await click('Fleur suivante');
    await assertImage('[data-book-scroll] > article img',galleryImage);
    await shot(`image-gallery-fallback-${width}`);
    await click('Fleur précédente');
    await assertImage('[data-book-scroll] > article img',productImage);
    await click('Table des matières'); await openChapter('regular','greenhouse');
    await page.waitForSelector('[data-book-entry="regular-greenhouse-0"] [role="img"][aria-label="Image de la fleur indisponible"]',{visible:true});
    assert.equal(await page.$$eval('[data-book-entry="regular-greenhouse-0"] img',images=>images.length),0);
    await page.click('[data-book-entry="regular-greenhouse-0"]');
    await page.waitForSelector('[data-book-scroll] > article [role="img"][aria-label="Image de la fleur indisponible"]',{visible:true});
    assert.equal(await page.$$eval('[data-book-scroll] > article img',images=>images.length),0);
    await shot(`image-unavailable-${width}`);
    await click('Fleur suivante');
    await assertImage('[data-book-scroll] > article img','/product_flower.jpg');
    await click('Fleur précédente');
    await page.waitForSelector('[data-book-scroll] > article [role="img"][aria-label="Image de la fleur indisponible"]',{visible:true});
    const layout=await checkLayout(); assert.equal(layout.overflow,false); assert.deepEqual(layout.outside,[]);
    imageResults.push({width,primary404UsesProduct:true,product404UsesGallery:true,all404UsesAccessibleIcon:true,thumbnailAndDetail:true,entrySwitchResetsCandidates:true,layout});
  }
  }
  if (!rewardsOnly) {
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  const draftUrl = 'http://127.0.0.1:3197/?owner=alice&entry=regular-outdoor-0&edit=notes';
  await page.goto(draftUrl,{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-tasting-scroll]',{visible:true});
  const beforeEmptySubmission = submissions.length;
  await click('Étape 5 : Verdict');
  await page.locator('::-p-text(Envoyer mon avis)').click();
  await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent.includes('10 critères'));
  assert.equal(submissions.length,beforeEmptySubmission,'Untouched default scores must never be sent');
  await assessAllCriteria();
  await page.type('textarea','Mon brouillon privé repris après actualisation.');
  await page.waitForFunction(()=>Object.keys(localStorage).some(key=>key.includes('alice')&&localStorage.getItem(key).includes('Mon brouillon privé')));
  assert.equal(await page.locator('::-p-text(Préremplir)').map(button=>button.disabled).wait(),true,'Prefill must not replace written impressions');
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('textarea')?.value==='Mon brouillon privé repris après actualisation.');
  assert(await page.$eval('[data-tasting-book]',element=>element.dataset.open==='true'));
  assert(await page.$eval('[data-tasting-scroll]',element=>element.textContent.includes('Brouillon retrouvé')));
  await page.goto(draftUrl.replace('alice','bob'),{waitUntil:'networkidle0'});
  await click('Étape 5 : Verdict');
  assert.equal(await page.$eval('textarea',element=>element.value),'','Another account must not see the saved private draft');
  await page.goto(draftUrl,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.querySelector('textarea')?.value==='Mon brouillon privé repris après actualisation.');
  await page.goto(draftUrl+'&review=approved',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-book-notes]',{visible:true});
  assert.equal(await page.$eval('[data-score="player"] strong',element=>element.textContent),'92,0/100','A server review must win over an obsolete draft');
  assert.equal(await page.$eval('textarea[aria-label="Critique de mon ancien brouillon"]',element=>element.value),'Mon brouillon privé repris après actualisation.','The old draft remains available for comparison only');

  reviewFixture = {status:200,delay:700};
  await page.goto(draftUrl.replace('alice','submitter'),{waitUntil:'networkidle0'});
  await assessAllCriteria();
  await page.type('textarea','Un seul envoi et un accusé de réception visible.');
  const beforeSuccess = submissions.length;
  const successResponse = page.waitForResponse(response=>response.url().endsWith('/api/contest/reviews'));
  await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent==='Envoyer mon avis');button.click();button.click();});
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Envoi...'&&button.disabled));
  await successResponse;
  await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')].some(element=>element.textContent.includes('Guide envoyé')));
  assert.equal(submissions.length,beforeSuccess+1,'Two immediate clicks must cause exactly one request');
  assert.equal(await page.$$eval('textarea',fields=>fields.length),0,'Saved review must immediately become read only');
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes('submitter'))),false,'Success must clear the local draft');

  await page.goto(draftUrl.replace('alice','corrector')+'&review=rejected',{waitUntil:'networkidle0'});
  await click('Étape 5 : Verdict');
  await page.type('textarea',' Avis corrigé.');
  await page.locator('::-p-text(Renvoyer mon avis corrigé)').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')].some(element=>element.textContent.includes('Guide modifié')));
  assert.equal(submissions.at(-1).method,'PUT');
  assert(submissions.at(-1).comment.includes('Avis corrigé.'));
  assert.equal(submissions.at(-1).expectedUpdatedAt,'2026-09-10');
  reviewFixture = {status:409,delay:0};
  await page.goto(draftUrl.replace('alice','conflict')+'&review=pending',{waitUntil:'networkidle0'});
  await click('Étape 5 : Verdict');
  await page.type('textarea',' Conflit sans perte.');
  await page.locator('::-p-text(Enregistrer mes modifications)').click();
  await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent.includes('Cet avis a changé'));
  assert((await page.$eval('textarea',element=>element.value)).includes('Conflit sans perte.'));
  assert(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes('conflict')&&localStorage.getItem(key).includes('Conflit sans perte'))));

  await page.goto(draftUrl.replace('alice','profile')+'&missingProfile=1',{waitUntil:'networkidle0'});
  await page.waitForSelector('input[id$="-pseudo"]',{visible:true});
  await page.type('input[id$="-pseudo"]','Degustateur');
  const beforePseudo = profileSubmissions.length;
  const profileResponse = page.waitForResponse(response=>response.url().endsWith('/api/contest/profile'));
  await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent==='Enregistrer mon pseudo');button.click();button.click();});
  await profileResponse;
  assert.equal(profileSubmissions.length,beforePseudo+1);
  await page.goto(draftUrl+'&anonymous=1',{waitUntil:'networkidle0'});
  const loginHref = await page.$eval('a[href^="/compte/connexion"]',link=>link.getAttribute('href'));
  const returnUrl = new URL(new URL(loginHref,'http://127.0.0.1:3197').searchParams.get('next'),'http://127.0.0.1:3197');
  assert.equal(returnUrl.searchParams.get('entry'),'regular-outdoor-0');
  assert.equal(returnUrl.searchParams.get('edit'),'notes');
  reviewFixture = {status:503,delay:0};

  for (const width of [320,390,1440]) for (const status of ['approved','pending','rejected']) {
    await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
    await page.goto(`http://127.0.0.1:3197/?review=${status}`,{waitUntil:'networkidle0'});
    await click('Ouvrir mon carnet de dégustation');
    await openChapter('regular','outdoor');
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
    await page.locator(`::-p-text(${status==='rejected'?'Corriger mes notes':status==='pending'?'Modifier mes notes':'Lire mes notes'})`).click();
    await page.waitForSelector('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll]',{visible:true});
    if(status==='approved') {
      await click('Étape 2 : Aspect');
      assert(await page.$$eval('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll] input[type="range"]',els=>els.length>0 && els.every(e=>e.disabled)));
    }
    await click('Étape 5 : Verdict');
    if(status!=='approved') {
      assert.equal(await page.$eval('[data-book-scroll] > div:not([hidden]) textarea',e=>e.value),'Mes notes enregistrées sur cette fleur.');
      await page.type('[data-book-scroll] > div:not([hidden]) textarea',' Modification conservée.');
    }
    await shot(`notes-detail-${status}-${width}`);
    await page.locator('[data-book-scroll] > div:not([hidden]) [data-tasting-scroll] + footer button:last-child').click();
    await page.waitForSelector('[data-book-notes]',{visible:true});
    if(status!=='approved') assert(await page.$eval('[data-book-notes]',e=>e.textContent.includes('Modification conservée.')));
    await page.locator('::-p-text(Retour à la fleur)').click();
    assert(await page.$eval('[data-tasting-book]',e=>e.dataset.open==='true'));
    await page.locator('::-p-text(Retrouver mes notes)').click();
    await page.waitForSelector('[data-book-notes]',{visible:true});
    assert.equal(new URL(page.url()).searchParams.get('review'),status);
    assert.equal(await page.$$eval('[role="dialog"]',els=>els.length),0);
  }
  await page.goto('http://127.0.0.1:3197/?review=pending&noAverage=1',{waitUntil:'networkidle0'});
  await click('Ouvrir mon carnet de dégustation'); await openChapter('regular','outdoor');
  await page.click('[data-book-entry="regular-outdoor-0"]');
  await page.locator('::-p-text(Retrouver mes notes)').click(); await page.waitForSelector('[data-book-notes]',{visible:true});
  assert.equal(await page.$$eval('.contest-review-skill-area-average',els=>els.length),0);
  assert.equal(await page.$eval('[data-score="community"] strong',e=>e.textContent),'—');
  await page.goto('http://127.0.0.1:3197/?review=approved&reviewDistinct=1',{waitUntil:'networkidle0'});
  await click('Ouvrir mon carnet de dégustation');
  for (const track of ['regular','concours','regular']) {
    await openChapter(track,'outdoor');
    const id=`${track}-outdoor-0`;
    await page.click(`[data-book-entry="${id}"]`);
    await page.locator('::-p-text(Retrouver mes notes)').click();
    await page.waitForFunction(id=>[...document.querySelectorAll('[data-book-notes]')]
      .some(notes=>!notes.closest('[hidden]') && notes.textContent.includes(id)),{},id);
    await click('Table des matières');
  }
  }
  if (!notesOnly) {
    collectionApiRequests.length = 0;
    const removedMissionCopy = ['Missions de dégustation','Deux défis, deux packs','Critique élaborée','Les bons terpènes et goûts'];
    const openRewards = async (entryId) => {
      await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
      await click('Ouvrir mon carnet de dégustation'); await openChapter(entryId.startsWith('concours-') ? 'concours' : 'regular','outdoor');
      await page.click(`[data-book-entry="${entryId}"]`); await click('Voir les récompenses de cette fleur');
      await page.waitForSelector('progress[aria-label="Fleurs dégustées avec un avis validé"]',{visible:true});
      await page.waitForFunction(()=>!document.querySelector('[data-opening]'));
      const rewardText = await page.$eval('.contest-notebook-collection-tab',element=>element.textContent);
      for (const text of removedMissionCopy) assert(!rewardText.includes(text),`Removed tasting mission still displayed: ${text}`);
      assert.equal(await page.$$eval('[aria-label="Missions de dégustation"]',elements=>elements.length),0);
      for (const text of ['Mes packs Botte du Chanvrier','Inventaire Botte du Chanvrier','Voir l’inventaire','Ouvrir un pack']) {
        assert(!rewardText.includes(text),`Removed collection control still displayed: ${text}`);
      }
      assert.equal(await page.$$eval('#contest-botte-chest-title',elements=>elements.length),0);
      assert.deepEqual(collectionApiRequests,[],'Notebook rewards must not request the Placard bootstrap or boosters API');
    };
    const claimButton = async (label) => {
      await page.evaluate((text) => {
        const button = [...document.querySelectorAll('.contest-notebook-collection-tab button')].find(item=>item.textContent.trim()===text);
        if (!button || button.disabled) throw new Error('Expected an enabled claim button: ' + text);
        button.scrollIntoView({block:'center'}); button.click();
      },label);
    };
    const assertCompletionAmount = async (euros, granted) => {
      const expected = `${euros} € ${granted ? 'reçus dans le jeu' : 'dans le jeu'}`;
      await page.waitForFunction(text => [...document.querySelectorAll('.contest-notebook-collection-tab span')]
        .some(element=>element.textContent.replace(/\s+/g,' ').trim()===text), {}, expected);
    };
    const assertHeritage = async (granted) => {
      await page.waitForFunction(()=>{
        const image = document.querySelector('[data-heritage-reward] img');
        return image?.complete && image.naturalWidth > 0;
      });
      const state = await page.$eval('[data-heritage-reward]',section=>{
        const image = section.querySelector('img');
        const progress = document.querySelector('progress[aria-label="Fleurs dégustées avec un avis validé"]');
        const imageRect = image.getBoundingClientRect();
        const scrollRect = document.querySelector('[data-book-scroll]').getBoundingClientRect();
        return {
          unlocked:section.dataset.unlocked,
          insideDetails:!!section.closest('details') || !!section.querySelector('details,summary'),
          firstReward:section.parentElement.firstElementChild === section,
          beforeCompletion:!!(section.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING),
          imageSource:image.getAttribute('src'),filter:getComputedStyle(image).filter,
          imageWidth:imageRect.width,imageTop:imageRect.top,imageBottom:imageRect.bottom,
          imageFullyVisible:imageRect.top >= scrollRect.top-1 && imageRect.bottom <= scrollRect.bottom+1,
          statusText:section.querySelector('header span')?.textContent.trim(),
          statusHasIcon:!!section.querySelector('header span svg'),
          text:section.textContent,
        };
      });
      assert.equal(state.unlocked,String(granted));
      assert.equal(state.insideDetails,false);
      assert.equal(state.firstReward,true);
      assert.equal(state.beforeCompletion,true);
      assert.equal(state.imageSource,heritageFixture.imageUrl);
      assert(state.imageWidth >= 140 && state.imageWidth <= 241,`Heritage card must remain legible: ${state.imageWidth}px`);
      const grayscale = state.filter.match(/grayscale\(([^)]+)\)/);
      if (granted) assert(!grayscale || Number.parseFloat(grayscale[1]) === 0,`Granted Heritage remains grey: ${state.filter}`);
      else assert.match(state.filter,/grayscale\((?:1|100%)\)/);
      assert.equal(state.statusText,granted ? 'Débloquée' : 'À gagner');
      assert.equal(state.statusHasIcon,true);
      assert(state.text.includes(heritageFixture.name));
      assert(state.text.includes(heritageFixture.description));
      return state;
    };
    const shotCompletion = async (name) => {
      await page.$eval('progress[aria-label="Fleurs dégustées avec un avis validé"]',element=>element.parentElement.scrollIntoView({block:'center'}));
      await shot(name);
    };
    for (const width of [320,390]) {
      const flowerCount = width===320 ? 2 : 3;
      const completionEuros = flowerCount * 100;
      rewardFixture = { flowerCount, completed: false, purchasedAll: false, completionGranted: false, purchaseGranted: false, rarity: width===320 ? 'silver' : 'gold', failAction: null };
      rewardRequests.length = 0;
      await page.setViewport({width,height:844,isMobile:true,hasTouch:true});
      const entryId = width===320 ? 'regular-outdoor-0' : 'concours-outdoor-0';
      await openRewards(entryId);
      assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>!button.disabled && /Récupérer mon bonus|Tirer mon Buddie/.test(button.textContent)).length),0);
      assert.equal(await page.$eval('progress',progress=>progress.value),0);
      assert.equal(await page.$eval('progress',progress=>progress.max),flowerCount);
      assert.equal(await page.$$eval('ul[aria-label="Fleurs du producteur"] > li',flowers=>flowers.length),flowerCount);
      await assertHeritage(false);
      await assertCompletionAmount(completionEuros,false);
      assert(await page.$eval('.contest-notebook-collection-tab',element=>element.textContent.includes('100 € de monnaie de jeu par fleur, versés ensemble à la fin du parcours')));
      const partialLayout = await checkLayout(); assert.equal(partialLayout.overflow,false); assert.deepEqual(partialLayout.outside,[]);
      await shot(`producer-rewards-partial-${width}`);

      rewardFixture.completed = true; rewardFixture.heritageGranted = true; rewardFixture.failAction = 'completion';
      await openRewards(entryId); await claimButton('Récupérer mon bonus');
      await page.waitForFunction(()=>document.body.textContent.includes('ta progression est conservée'));
      assert.equal(rewardFixture.completionGranted,false);
      assert.equal(await page.$eval('progress',progress=>progress.value),flowerCount);
      await claimButton('Récupérer mon bonus');
      await assertCompletionAmount(completionEuros,true);
      assert.equal(rewardFixture.completionGranted,true);
      assert.equal(rewardFixture.completionCashCents,completionEuros*100);
      assert.deepEqual(rewardRequests,[{action:'completion',producerId:'producer'},{action:'completion',producerId:'producer'}]);
      await openRewards(entryId);
      assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>button.textContent.includes('Récupérer mon bonus')).length),0);
      await assertCompletionAmount(completionEuros,true);
      await assertHeritage(true);
      await shotCompletion(`producer-rewards-completion-${flowerCount}-flowers-${width}`);

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
      assert.deepEqual(collectionApiRequests,[]);
      rewardResults.push({width,entryId,flowerCount,completionEuros,distinctProductsDeduplicated:true,partialLayout,claimedLayout,completionClaimed:true,completionAmountPersistsOnReload:true,purchaseClaimed:true,rarity:rewardFixture.rarity,errorRetryPreservesProgress:true,claimsPersistOnReload:true,noRedraw:true,tastingMissionsAbsent:true,chestAndInventoryAbsent:true,noCollectionApiRequests:true});
    }
    // A historical receipt keeps its actual credited amount if the current catalogue changes.
    rewardFixture = { flowerCount:3, completed:true, purchasedAll:false, completionGranted:true, completionCashCents:20_000, purchaseGranted:false, rarity:'gold', failAction:null };
    rewardRequests.length = 0;
    await openRewards('concours-outdoor-0');
    assert.equal(await page.$eval('progress',progress=>progress.max),3);
    await assertCompletionAmount(200,true);
    assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>button.textContent.includes('Récupérer mon bonus')).length),0);
    await openRewards('concours-outdoor-0');
    await assertCompletionAmount(200,true);
    assert.deepEqual(rewardRequests,[]);
    await shotCompletion('producer-rewards-historical-receipt-390');
    rewardResults.push({width:390,flowerCount:3,historicalReceiptEuros:200,historicalAmountPersistsOnReload:true,noCompletionReclaim:true});
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

    for (const width of [320,390,1440]) {
      await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
      rewardRequests.length = 0;
      for (const fixture of [
        {name:'before-review',approvedCount:0,heritageGranted:false},
        {name:'eligible-awaiting-grant',approvedCount:1,heritageGranted:false},
        {name:'first-review-granted',approvedCount:1,heritageGranted:true},
        {name:'historical-grant',approvedCount:0,heritageGranted:true},
      ]) {
        rewardFixture = { flowerCount:3,completed:false,purchasedAll:false,completionGranted:false,purchaseGranted:false,rarity:'silver',failAction:null,...fixture };
        await openRewards('regular-outdoor-0');
        const heritage = await assertHeritage(fixture.heritageGranted);
        if (width<700) assert(heritage.imageFullyVisible,`The full Heritage card must be visible without scrolling at ${width}px (${heritage.imageTop}–${heritage.imageBottom})`);
        assert.equal(await page.$eval('progress',element=>element.value),fixture.approvedCount);
        assert.equal(await page.$eval('progress',element=>element.max),3);
        assert.equal(producerCampaign().heritageEligible,fixture.approvedCount>0);
        assert.equal(await page.$$eval('.contest-notebook-collection-tab button',buttons=>buttons.filter(button=>button.textContent.includes('Récupérer mon bonus')).length),0);
        await assertCompletionAmount(300,false);
        if (fixture.name === 'eligible-awaiting-grant') assert(heritage.text.includes('La carte passera en couleur dès que son attribution sera confirmée.'));
        const layout = await checkLayout(); assert.equal(layout.overflow,false); assert.deepEqual(layout.outside,[]);
        await shot(`producer-rewards-heritage-${fixture.name}-${width}`);
        rewardResults.push({width,heritageState:fixture.name,reviewedCount:fixture.approvedCount,requiredCount:3,unlocked:fixture.heritageGranted,imageWidth:heritage.imageWidth,imageTop:heritage.imageTop,imageBottom:heritage.imageBottom,imageFullyVisibleAtOpen:heritage.imageFullyVisible,filter:heritage.filter,heritageFirst:true,heritageAlwaysOpen:true,statusText:heritage.statusText,statusIcon:true,completionStillPending:true,layout});
      }
      assert.deepEqual(rewardRequests,[],'Opening the Heritage reward must never claim a reward');
    }
    assert.deepEqual(collectionApiRequests,[],'Notebook rewards must not call collection APIs, including after claims');
  }
  assert.deepEqual(errors,[]);
  const notesChecks={errors,notesStayInBook:true,notesStatuses:['approved','pending','rejected'],playerAndCommunityScores:true,missingAverage:true,crossTrackReviewsPreserved:true,draftSurvivesReload:true,draftOwnerIsolation:true,serverReviewWinsOverDraft:true,untouchedScoresBlocked:true,reviewAndPseudoDoubleClicksBlocked:true,successClearsDraft:true,rejectedReviewCorrectable:true,loginRetainsFlower:true};
  await writeFile(resolve(reportDir,rewardsOnly?'rewards-report.json':notesOnly?'notes-report.json':'report.json'),JSON.stringify(rewardsOnly?{errors,rewardResults,collectionApiRequests}:notesOnly?notesChecks:{results,...notesChecks,chapters:6,tracksSeparated:true,chapterBoundaries:true,flowerBoundaries:true,crossTrackDraftsPreserved:true,concoursSubmission:true,initialTrackRespected:true,imageResults,empty:true,locked:true,reducedMotion:true,swipe:true,keyboardBack:true,rewards:true,rewardResults,collectionApiRequests,siteChromeHidden:true},null,2));
  console.log(JSON.stringify({passed:true,notesOnly,rewardsOnly,widths:rewardsOnly?[320,390,1440]:notesOnly?[320,390,1440]:results.map(x=>x.width),screenshots:reportDir}));
} finally { await browser?.close(); await server.close(); }
