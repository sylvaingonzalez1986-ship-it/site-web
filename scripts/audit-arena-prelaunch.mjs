/** Isolated arena prelaunch review. Local profile fixture only; no credentials or remote writes. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'output/arena-prelaunch');
const modules = {
  'market-preview.tsx': `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css'; import {ContestArenaHub} from '/src/components/contest/ContestArenaHub';
    import {ProductCard} from '/src/components/ProductCard';
    import {ProductTastingSection} from '/src/components/boutique/ProductTastingSection';
    import {ContestTastingBook} from '/src/components/contest/ContestTastingBook';
    import {getProductTastingNotebookHref} from '/src/lib/contest-product-tasting';
    const product = {id:'audit-flower',name:'Fleur du carnet',category:'fleurs',price:2.5,weight:'1 g',image:'/product_flower.jpg',description:'Fleur fictive, réservée à cet audit local.',stock:20};
    const entry = {id:'audit-flower-lot',slug:'audit-flower',title:product.name,productId:product.id,product,seasonId:'audit-season',season:{id:'audit-season',code:'audit-2026',label:'Audit local',isActive:true,isArchived:false},producerId:'audit-producer',producer:{id:'audit-producer',name:'Producteur fictif'},category:'indoor',track:'regular',story:product.description,technicalSheet:{},imageUrl:product.image,galleryUrls:[],isPublished:true,position:0,createdAt:'2026-10-25T00:00:00Z',updatedAt:'2026-10-25T00:00:00Z',stats:{approvedReviewCount:0,averageScore:0,criterionAverages:{},consumptionCounts:{}}};
    const summary = {entry,reviews:[],nextReviewCursor:null,notebookHref:getProductTastingNotebookHref(entry,true)};
    const query = new URLSearchParams(location.search);
    const content = location.pathname.startsWith('/arene/carnet/')
      ? <ContestTastingBook entries={[entry]} unlocks={[]} viewerProfile={null} badges={[]} isAuthenticated={false} seasonLabel="Audit local" initialTrack="regular" initialCategory="outdoor" initialEntryId={query.get('entry')||undefined} initialEditNotes={query.get('edit')==='notes'} />
      : location.pathname==='/market' ? <main style={{maxWidth:400,margin:'0 auto'}}><ProductCard product={product} tastingSummary={summary} /></main>
      : location.pathname==='/flower' ? <main><ProductTastingSection summary={summary} showArenaLink /></main>
      : <ContestArenaHub activitiesLocked initialNotice={query.has('notice')} />;
    createRoot(document.getElementById('root')).render(content);
  `,
  'preview-cart': `export const useCart=()=>({user:location.search.includes('guest')?null:{id:'preview-user'},authLoading:false});`,
  'preview-consent': `export const useCookieConsent=()=>({showBanner:false});`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) {return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from 'react'; export default function dynamic(loader){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props))}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),optimizeDeps:{noDiscovery:true,include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{
  name:'isolated-market',enforce:'pre',
  resolveId(id){if(id.endsWith('/context/CartContext'))return '\0preview-cart';if(id.endsWith('/cookies/CookieConsentProvider'))return '\0preview-consent';if(id in modules)return '\0'+id;},
  async load(id){if(id==='\0market-preview.tsx')return ts.transpileModule(modules['market-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{const path=req.url?.split('?')[0];if(!['/','/market','/flower'].includes(path)&&!path?.startsWith('/arene/carnet/'))return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marché · essai DA arène</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__market-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port:3218,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser, profile=null; const errors=[], requests=[];
try {
  await mkdir(output,{recursive:true}); await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(); page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const url=new URL(request.url());
    if(url.pathname.startsWith('/api/')) {
      requests.push(url.pathname);
      if(url.pathname==='/api/arena/chanvrier') {if(request.method()==='POST')profile=JSON.parse(request.postData()); return void request.respond({status:200,contentType:'application/json',body:JSON.stringify({profile})});}
      return void request.respond({status:423,contentType:'application/json',body:'{}'});
    }
    void(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port==='3218')?request.continue():request.abort());
  });
  const clickText=async text=>page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text)?.click(),text);
  for(const width of [320,390,768,1440]) {
    await page.setViewport({width,height:width<700?844:1000});
    await page.goto('http://127.0.0.1:3218/',{waitUntil:'networkidle0'});
    await page.waitForSelector('[data-arena-scene]');
    assert.equal(await page.$$eval('[data-arena-scene] img',images=>images.length),1);
    assert.deepEqual(await page.$$eval('[data-arena-activity]',items=>items.map(item=>({mode:item.dataset.arenaActivity,tag:item.tagName}))),
      [{mode:'carnet',tag:'A'},{mode:'jouer',tag:'DIV'},{mode:'classement',tag:'DIV'}]);
    assert.equal(await page.$eval('[data-arena-activity="carnet"]',item=>item.getAttribute('href')),'/arene/carnet/regular');
    assert.equal(await page.$$eval('[data-arena-activity] a,[data-arena-activity] button',items=>items.length),0);
    assert.match(await page.$eval('body',el=>el.textContent),/Rendez-vous le 1er novembre/);
    assert.match(await page.$eval('body',el=>el.textContent),/Le Carnet est ouvert/);
    assert.equal(new URL(page.url()).pathname,'/');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:resolve(output,`locked-${width}.png`),fullPage:true});
    await page.keyboard.press('Escape');
    assert.match(await page.$eval('body',el=>el.textContent),/Rendez-vous le 1er novembre/);
  }
  await clickText('Créer mon personnage'); await page.waitForSelector('dialog[open]');
  await page.type('input[autocomplete="nickname"]','Camille29');
  await clickText('Choisir ma force'); await clickText('Créer mon chanvrier');
  await page.waitForFunction(()=>document.body.textContent.includes('ton personnage est prêt.'));
  assert.equal(profile.nickname,'Camille29');
  await clickText('Modifier mon personnage'); await page.waitForSelector('dialog[open]');
  assert.equal(await page.$eval('input[autocomplete="nickname"]',el=>el.value),'Camille29');
  await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:3218/?guest&notice',{waitUntil:'networkidle0'});
  await page.waitForSelector('[data-arena-scene]');
  assert.match(await page.$eval('body',el=>el.textContent),/Rendez-vous le 1er novembre/);
  assert(await page.$('a[href="/compte/connexion?next=%2Farene"]'));
  await page.click('[data-arena-activity="carnet"]');
  await page.waitForSelector('[data-tasting-book]');
  assert.equal(new URL(page.url()).pathname,'/arene/carnet/regular');
  for(const width of [320,390,768,1440]) {
    await page.setViewport({width,height:width<700?844:1000});
    for(const source of ['market','flower']) {
      await page.goto(`http://127.0.0.1:3218/${source}`,{waitUntil:'networkidle0'});
      const selector = 'a[href*="entry=audit-flower-lot"][href*="edit=notes"]';
      await page.waitForSelector(selector);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${source} fits ${width}px`);
      await page.screenshot({path:resolve(output,`${source}-${width}.png`),fullPage:true});
      await page.click(selector);
      await page.waitForSelector('[data-tasting-book][data-notebook-view="tasting"]');
      await page.waitForSelector('a[href^="/compte/connexion?next="]');
      const next=await page.$eval('a[href^="/compte/connexion?next="]',link=>new URL(link.href).searchParams.get('next'));
      const continuation=new URL(next,'https://audit.local');
      assert.equal(continuation.pathname,'/arene/carnet/regular');
      assert.equal(continuation.searchParams.get('entry'),'audit-flower-lot');
      assert.equal(continuation.searchParams.get('season'),'audit-2026');
      assert.equal(continuation.searchParams.get('edit'),'notes');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`guest notebook fits ${width}px`);
      await page.screenshot({path:resolve(output,`notebook-${source}-${width}.png`),fullPage:true});
    }
  }
  assert(requests.every(path=>path==='/api/arena/chanvrier'),'no gameplay or tutorial requests');
  assert.deepEqual(errors,[]); console.log('Arena prelaunch passed: 4 widths, public notebook, 2 locked game activities, character creation/editing, market and product guest rating links, selected flower and login continuation, no gameplay requests.');
} finally {await browser?.close(); await server.close();}
