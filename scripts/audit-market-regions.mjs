/** Isolated visual review of real market components. Regional map and its interactions. No backend, credentials or orders. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'output/market-regions');
const modules = {
  'market-preview.tsx': `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {BoutiquePageClient} from '/src/components/boutique/BoutiquePageClient';
    import {ProductImageGallery} from '/src/components/boutique/ProductImageGallery';
    import {ProductDetailActions} from '/src/components/boutique/ProductDetailActions';
    import styles from '/src/app/boutique/[category]/[slug]/ProductDetailPage.module.css';
    const own = {id:'own',name:'Les Chanvriers Bretons',image:'/sylvain-culture-hero.webp',location:'Bretagne',department:'Morbihan',region:'Bretagne',description:'Du champ à la fleur, une culture à taille humaine, au rythme des saisons.',philosophy:'Cultiver avec soin, partager le goût du travail bien fait.',cultureType:['outdoor','greenhouse'],climate:'Océanique',soil:'Sol vivant',founded:2019,certifications:['Agriculture biologique']};
    const producers = ['Les Jardins du Ponant','La Ferme des Embruns','Chanvre du Bocage','Les Fleurs de Loire'].map((name,i)=>({...own,id:'producer-'+i,name,region:['Bretagne','Bretagne','Nouvelle-Aquitaine','La Reunion'][i]}));
    const names = ['Fleur du bocage','Douceur bretonne','Les petits bourgeons','Résine de saison','Sélection du jardin','Fleurs des copains'];
    const products = names.map((name,i)=>({id:'flower-'+i,name,category:i===3?'resines':'fleurs',price:4.5+i,image:i===3?'/product_resin.jpg':'/product_flower.jpg',images:i===0?['/product_flower.jpg','/product_resin.jpg']:undefined,description:'Une sélection cultivée avec soin. Retrouvez son origine, ses caractéristiques et son producteur.',cultureMode:'outdoor',trackStock:true,stockQuantity:i===4?0:100,weightGrams:1,...(i===1?{promoPercent:20,originalPrice:6.9}:{}),...(i===0?{badge:'La récolte',bonusPoints:5}:{})}));
    const neighbors = producers.map((p,i)=>({...products[i],id:'neighbor-'+i,producerId:p.id}));
    const boutique={eyebrow:'Le marché des chanvriers',description:'Nos fleurs, nos récoltes et celles des copains. Fais ton marché, rencontre les producteurs et trouve ta prochaine découverte.',addButtonLabel:'Ajouter',lowStockThresholdGrams:20,producerPartnerLabel:'Producteur partenaire',producerWebsiteLabel:'Son site',ownProducerLabel:'Les Chanvriers Bretons',emptyMessage:'Aucun produit.'};
    const detail = new URLSearchParams(location.search).has('detail');
    createRoot(document.getElementById('root')).render(detail ? <section className={styles.page}><div className="retro-container"><nav className={styles.breadcrumb}><a href="/">Le marché</a> / Fleurs / Fleur du bocage</nav><div className={styles.shell}><div className={styles.grid}><div className={styles.gallery}><ProductImageGallery images={products[0].images} productName={products[0].name} badge="La récolte" /></div><div className={styles.info}><p className={styles.eyebrow}>Fleurs · Outdoor</p><h1 className={styles.title}>{products[0].name}</h1><p className={styles.meta}>Les Chanvriers Bretons · Morbihan</p><div className={styles.pricePanel}><span className={styles.price}>4,50 € / g</span><span>TTC</span></div><p className={styles.description}>{products[0].description}</p><ProductDetailActions product={products[0]} /></div></div></div></div></section> : <BoutiquePageClient boutique={boutique} producers={producers} ownProducer={own} ownProducts={products} partnerProducts={neighbors} voisinProducts={neighbors} copainsProducts={neighbors} globalAccessoriesProducts={[]} boutiqueSections={[{id:'header',type:'header'},{id:'products',type:'products'}]} tastingSummariesByProductId={{}} />);
  `,
  'preview-cart': `export const useCart=()=>({addToCart:(product,variant,qty)=>{window.__cartAdds=(window.__cartAdds||0)+qty;return {ok:true}},cartLoading:false,authLoading:false,customer:null,items:[]});`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) {return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from 'react'; export default function dynamic(loader){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props))}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({configFile:false,envDir:false,root,optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{
  name:'isolated-market',enforce:'pre',
  resolveId(id){if(id.endsWith('/context/CartContext'))return '\0preview-cart';if(id in modules)return '\0'+id;},
  async load(id){if(id==='\0market-preview.tsx')return ts.transpileModule(modules['market-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marché · essai DA arène</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__market-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port:3197,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;
const errors=[];
const results=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],userDataDir:resolve(output,'chrome-profile'),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.on('pageerror',error=>{errors.push(error.message);console.error(error.message)});
  await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());void(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port==='3197')?request.continue():request.abort());});
  const overflow=async label=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow');
  const choose=async region=>{await page.$eval(`.region-path[aria-label^="${region},"]`,el=>el.focus());await page.keyboard.press('Enter');};
  const close=async()=>{await page.click('.region-carousel-overlay__close');await page.waitForSelector('.region-carousel-overlay',{hidden:true});};
  const reset=async()=>{await page.click('.region-reset-button');await page.waitForSelector('.region-showcase-panel',{hidden:true});};
  for(const width of [320,390,640,768,1440]) {
    await page.setViewport({width,height:width<700?844:1000,deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
    await page.waitForSelector('.product-card');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Par région').click());
    await page.waitForSelector('.region-map-svg');await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.$$eval('.region-path',items=>items.length),13);
    assert.equal(await page.$$eval('.region-domtom-card',items=>items.length),5);
    assert.equal(await page.$eval('.region-map-container',el=>getComputedStyle(el).backgroundColor),'rgb(0, 63, 48)');
    await overflow('map');
    await page.$eval('.region-map-container',el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.screenshot({path:resolve(output,`map-${width}.png`),fullPage:true});
    await (await page.$('.region-map-container')).screenshot({path:resolve(output,`map-panel-${width}.png`)});
    await choose('Bretagne');
    assert.equal(await page.$eval('.region-path[aria-label^="Bretagne,"]',el=>el.getAttribute('aria-pressed')),'true');
    if(width<=640) {
      await page.waitForSelector('.region-carousel-overlay');
      assert.equal(await page.$eval('.region-carousel-overlay__count',el=>el.textContent.trim()),'3 producteurs');
      const bounds=await page.$eval('.region-carousel-overlay__close',el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}});
      assert(bounds.top>=0&&bounds.bottom<=bounds.height,'close stays visible');
      await page.click('.region-carousel-overlay__nav--right');
      await page.waitForFunction(()=>document.querySelector('.region-carousel-overlay__index').textContent.trim()==='2 / 3');
      await page.$eval('.region-carousel-overlay__viewport',el=>el.scrollTo({left:el.clientWidth*2,behavior:'instant'}));
      await page.waitForFunction(()=>document.querySelector('.region-carousel-overlay__index').textContent.trim()==='3 / 3');
      await page.screenshot({path:resolve(output,`carousel-${width}.png`)});
      await page.click('.region-carousel-overlay__nav--left');
      await page.waitForFunction(()=>document.querySelector('.region-carousel-overlay__index').textContent.trim()==='2 / 3');
      // Open the producer after the existing swipe click-guard has settled.
      await page.waitForFunction(()=>{const el=document.querySelector('.region-carousel-overlay__viewport');return Math.abs(el.scrollLeft-el.clientWidth)<1});
      await new Promise(resolve=>setTimeout(resolve,220));
      await page.click('.region-carousel-overlay__slide:nth-child(2) article');
      await page.waitForSelector('.producer-modal-overlay');await overflow('producer modal');
      await page.keyboard.press('Escape');await page.waitForSelector('.producer-modal-overlay',{hidden:true});
      await close();
      await page.select('.region-map-shell select','Normandie');
      await page.waitForSelector('.region-carousel-overlay__empty');await close();
      await page.select('.region-map-shell select','La Reunion');
      await page.waitForSelector('.region-carousel-overlay');
      assert.equal(await page.$eval('.region-carousel-overlay__count',el=>el.textContent.trim()),'1 producteur');
      await close();
    } else {
      await page.waitForSelector('.region-showcase-panel .product-card');
      assert.equal(await page.$$eval('.region-showcase-grid .product-card',items=>items.length),8);
      await overflow('regional products');
      await page.screenshot({path:resolve(output,`selection-${width}.png`),fullPage:true});
      await reset();await choose('Normandie');await page.waitForSelector('.region-showcase-empty');await reset();
      await page.evaluate(()=>[...document.querySelectorAll('.region-domtom-card')].find(button=>button.textContent.includes('Réunion')).click());
      await page.waitForSelector('.region-showcase-grid .product-card');
      assert.equal(await page.$$eval('.region-showcase-grid .product-card',items=>items.length),1);await reset();
      await page.$eval('.region-path[aria-label^="Corse,"]',el=>el.focus());await page.waitForSelector('.region-map-tooltip');
      assert(await page.$eval('.region-map-tooltip',el=>{const r=el.getBoundingClientRect(),b=el.closest('.region-map-container').getBoundingClientRect();return r.left>=b.left&&r.right<=b.right}),'tooltip stays inside board');
    }
    await overflow('final');results.push({width,status:'passed'});console.log('OK regional map, keyboard selection, producer filtering, overseas and empty states: '+width+'px');
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.waitForFunction(()=>!document.querySelector('.region-flight'));
  await choose('Bretagne');assert.equal(await page.$('.region-flight'),null);
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors},null,2));
} finally {await browser?.close();await server.close();}
