/** Real book and tasting components, synthetic data, no credentials or production writes. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const reportDir = resolve(root, "output/tasting-book");
const notesOnly = process.argv.includes('--notes-only');
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
    const visible = params.has('empty') ? entries.filter(e => !(e.track==='concours' && e.category==='indoor')) : entries;
    if (!params.has('noAverage')) for (const entry of entries) entry.stats = {approvedReviewCount:3, averageScore:74, criterionAverages:Object.fromEntries(CONTEST_SCORE_CRITERIA.map(c=>[c,74])), consumptionCounts:{}};
    const unlocks = entries.filter(e=>e.id.endsWith('-0')).map(e=>({entryId:e.id,unlockedAt:'2026-09-10',review:params.has('review') ? {
      id:'review-'+e.id,entryId:e.id,seasonId:'season',pseudo:'Sylvain',consumptionMethod:'vaporizer',comment:'Mes notes enregistrées sur cette fleur.',status:params.get('review'),adminNote:'',qualityMark:'standard',createdAt:'2026-09-10',updatedAt:'2026-09-10',scores:CONTEST_SCORE_CRITERIA.map(criterion=>({criterion,score:92})),aromaTags:[],terpeneGuesses:[]
    } : undefined}));
    createRoot(document.getElementById('root')).render(React.createElement(ContestTastingBook,{entries:visible,unlocks:params.has('locked')?[]:unlocks,viewerProfile:{pseudo:'Sylvain',createdAt:'2026-09-10',updatedAt:'2026-09-10'},badges:[],isAuthenticated:true,seasonLabel:'Les dégustations de l’Arène · Saison 2026',initialTrack:'regular',initialCategory:'outdoor'}));
  `,
  "next/image": `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) { return React.createElement('img', {...props, src: typeof src === 'string' ? src : src.src, style: {...(fill ? {position:'absolute',inset:0,width:'100%',height:'100%'} : {}), ...props.style}}); }`,
  "next/link": `import React from 'react'; export default function Link({prefetch,scroll,replace,...props}) {return React.createElement('a',props);}`,
  "next/dynamic": `import React from 'react'; export default function dynamic(loader, options={}) {const Component=React.lazy(() => loader().then(m => ({default:m.default || m}))); return function Dynamic(props){return React.createElement(React.Suspense,{fallback:options.loading ? React.createElement(options.loading) : null},React.createElement(Component,props));};}`,
  "next/navigation": `export const usePathname=()=>'/arene/carnet/regular'; export const useSearchParams=()=>new URLSearchParams(); export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{window.__bookRefreshes=(window.__bookRefreshes||0)+1;}});`,
};
const submissions = [];
const server = await createServer({
  configFile: false, envDir: false, root, publicDir: resolve(root, "public"),
  esbuild: { jsx: "automatic" }, resolve: { alias: { "@": resolve(root, "src") } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{ name: "tasting-book-preview", enforce: "pre",
    resolveId(id) { if (id in modules) return `\0${id}`; },
    load(id) { if (id.startsWith("\0")) return modules[id.slice(1)]; },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url?.startsWith('/api/')) {
          response.setHeader('Content-Type','application/json');
          if (request.url === '/api/contest/reviews' && request.method === 'POST') {
            let body=''; request.on('data',chunk=>body+=chunk); request.on('end',()=>{submissions.push(JSON.parse(body));response.end('{"error":"Erreur de test : réessaie sans perdre tes notes."}');}); response.statusCode=503; return;
          }
          response.end('{"availableEntitlements":[],"campaigns":[],"collection":{"cards":[]}}'); return;
        }
        if (request.url?.split('?')[0] !== '/') return next();
        response.setHeader('Content-Type','text/html');
        response.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carnet · vérification locale</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}</style><div class="site-background"><header><button id="site-navigation">Navigation du site</button></header><main class="relative z-0"><div id="root"></div></main><footer><a id="site-footer" href="#">Pied de page du site</a></footer></div><script type="module" src="/@id/__x00__book-preview-entry"></script></html>');
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3197, strictPort: true, hmr: false, watch: { ignored: ['**/output/**','**/.next/**'] } },
});
let browser;
const errors = [];
const results = [];
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
  if (!notesOnly) {
  for (const width of [320,390,768,1440]) {
    await page.setViewport({width,height:width<700?844:1000,deviceScaleFactor:1,hasTouch:width<700,isMobile:width<700});
    await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-tasting-book]', { visible: true, timeout: 60000 });
    await shot(`cover-${width}`);
    await click('Ouvrir mon carnet de dégustation');
    await new Promise(r=>setTimeout(r,750)); await shot(`contents-${width}`);
    assert.equal(await page.$eval('#site-footer',e=>getComputedStyle(e).visibility),'hidden');
    assert.equal(await page.locator('h2').map(e=>e.textContent).wait(),'Table des matières');
    for (const track of ['Regular','Concours']) for (const category of ['Outdoor','Greenhouse','Indoor']) {
      await click(`${track} ${category}, 2 fleurs`);
      assert.equal(await page.$$eval('[data-book-scroll] button',buttons=>buttons.filter(b=>b.textContent.includes('Douceur de Bretagne') || b.textContent.includes('Fleur du soleil')).length),2);
      await click('Table des matières');
    }
    await click('Regular Outdoor, 2 fleurs'); await shot(`flowers-${width}`);
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
    await page.locator('[data-book-scroll] button').filter(e=>e.textContent.includes('Douceur de Bretagne')).click();
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
    await click('Table des matières'); await click('Regular Outdoor, 2 fleurs');
    await page.locator('[data-book-scroll] button').filter(e=>e.textContent.includes('Douceur de Bretagne')).click();
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
  await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
  await click('Ouvrir mon carnet de dégustation');
  await click('Regular Outdoor, 2 fleurs');
  await page.locator('[data-book-scroll] button').filter(e=>e.textContent.includes('Douceur de Bretagne')).click();
  await click('Voir les récompenses de cette fleur');
  await page.waitForFunction(()=>document.body.textContent.includes('Missions de dégustation'));
  await shot('rewards-390');
  assert.deepEqual((await checkLayout()).outside,[]);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto('http://127.0.0.1:3197/?empty=1&locked=1',{waitUntil:'networkidle0'});
  await click('Ouvrir mon carnet de dégustation');
  await click('Concours Indoor, 0 fleurs'); await shot('empty-390');
  assert(await page.locator('[data-book-scroll]').map(e=>e.textContent.includes('encore en culture')).wait());
  await click('Table des matières'); await click('Regular Outdoor, 2 fleurs');
  await page.locator('[data-book-scroll] button').filter(e=>e.textContent.includes('Douceur de Bretagne')).click();
  await page.locator('::-p-text(Déguster cette fleur)').click();
  await page.waitForFunction(()=>document.body.textContent.includes('ayant acheté ce lot'));
  assert.equal(await page.$$eval('textarea',els=>els.length),0);
  await shot('locked-390');
  await click('Fermer le carnet');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Ouvrir mon carnet de dégustation');
  }
  for (const width of [320,390,1440]) for (const status of ['approved','pending','rejected']) {
    await page.setViewport({width,height:width<700?844:1000,isMobile:width<700,hasTouch:width<700});
    await page.goto(`http://127.0.0.1:3197/?review=${status}`,{waitUntil:'networkidle0'});
    await click('Ouvrir mon carnet de dégustation');
    await click('Regular Outdoor, 2 fleurs');
    await page.locator('[data-book-scroll] button').filter(e=>e.textContent.includes('Douceur de Bretagne')).click();
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
  await click('Ouvrir mon carnet de dégustation'); await click('Regular Outdoor, 2 fleurs');
  await page.locator('[data-book-scroll] button').filter(e=>e.textContent.includes('Douceur de Bretagne')).click();
  await page.locator('::-p-text(Retrouver mes notes)').click(); await page.waitForSelector('[data-book-notes]',{visible:true});
  assert.equal(await page.$$eval('.contest-review-skill-area-average',els=>els.length),0);
  assert.equal(await page.$eval('[data-score="community"] strong',e=>e.textContent),'—');
  assert.deepEqual(errors,[]);
  const notesChecks={errors,notesStayInBook:true,notesStatuses:['approved','pending','rejected'],playerAndCommunityScores:true,missingAverage:true};
  await writeFile(resolve(reportDir,notesOnly?'notes-report.json':'report.json'),JSON.stringify(notesOnly?notesChecks:{results,...notesChecks,chapters:6,empty:true,locked:true,reducedMotion:true,swipe:true,keyboardBack:true,rewards:true,siteChromeHidden:true},null,2));
  console.log(JSON.stringify({passed:true,notesOnly,widths:notesOnly?[320,390,1440]:results.map(x=>x.width),screenshots:reportDir}));
} finally { await browser?.close(); await server.close(); }
