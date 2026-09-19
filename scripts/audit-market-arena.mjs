/** Isolated visual review of real market components. No backend, credentials or orders. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'output/market-arena');
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
    const producers = ['Les Jardins du Ponant','La Ferme des Embruns','Chanvre du Bocage','Les Fleurs de Loire'].map((name,i)=>({...own,id:'producer-'+i,name}));
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
const server = await createServer({configFile:false,envDir:false,root,publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{
  name:'isolated-market',enforce:'pre',
  resolveId(id){if(id.endsWith('/context/CartContext'))return '\0preview-cart';if(id in modules)return '\0'+id;},
  async load(id){if(id==='\0market-preview.tsx')return ts.transpileModule(modules['market-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marché · essai DA arène</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__market-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port:3197,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;
const errors=[];
const results=[];
try {
  await mkdir(output,{recursive:true});
  await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],userDataDir:resolve(output,'chrome-profile'),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  page.on('console',m=>{if(m.type()==='error')console.error(m.text())});
  await page.setRequestInterception(true);
  page.on('request',req=>{const u=new URL(req.url());void (u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port==='3197')?req.continue():req.abort());});
  const checkOverflow=async(label)=>{const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(size.scroll<=size.width+1,label+' horizontal overflow '+JSON.stringify(size));};
  for(const width of [320,390,768,1440]){
    await page.setViewport({width,height:width<700?844:1000,deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:3197/',{waitUntil:'networkidle0'});
    await page.waitForSelector('.product-card').catch(async e=>{await page.screenshot({path:resolve(output,'debug.png')});console.error(await page.evaluate(()=>document.body.innerText.slice(0,1000)));throw e;});
    await page.evaluate(()=>document.fonts.ready);
    await checkOverflow('catalogue');
    await page.screenshot({path:resolve(output,`market-${width}.png`),fullPage:true});
    const columns=await page.$eval('.product-card',el=>getComputedStyle(el.parentElement).gridTemplateColumns.split(' ').length);
    assert.equal(columns,width>=1024?3:2,'Existing flower grid retained');
    await page.click('.product-card [aria-label="Photo suivante"]');
    assert.equal(await page.$eval('.product-card [aria-label="Afficher photo 2"]',el=>el.getAttribute('aria-current')),'true');
    await page.click('.product-card .btn-primary');
    assert.equal(await page.evaluate(()=>window.__cartAdds),1);
    await page.click('article[role="button"]');
    await page.waitForSelector('[role="dialog"]');
    await page.evaluate(()=>Promise.all(document.querySelector('[role="dialog"]').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
    await checkOverflow('producer');
    await page.screenshot({path:resolve(output,`producer-${width}.png`)});
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="dialog"]',{hidden:true});
    await page.click('[data-tutorial="category-filter"] button:nth-child(2)');
    assert.equal(await page.$$eval('.product-card',els=>els.length),1,'Promo filter');
    await page.click('[data-tutorial="tab-mes-voisins"]');
    await page.click('[data-tutorial="category-filter"] button:first-child');
    await page.waitForSelector('section[aria-label] article[role="button"]');
    await checkOverflow('neighbors');
    await page.screenshot({path:resolve(output,`neighbors-${width}.png`),fullPage:true});
    const next=await page.$('button[aria-label="Producteur suivant"]');
    if(next){await next.click();await page.waitForFunction(()=>{const track=document.querySelector('section[aria-label] [tabindex="0"]');return track?.scrollLeft>0;});}
    await page.click('section[aria-label] article[role="button"]');
    await page.waitForSelector('[role="dialog"]');
    await page.evaluate(()=>Promise.all(document.querySelector('[role="dialog"]').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
    const before=await page.$eval('[role="dialog"]',el=>el.getAttribute('aria-label'));
    await page.click('[role="dialog"] [aria-label="Producteur suivant"]');
    assert.notEqual(await page.$eval('[role="dialog"]',el=>el.getAttribute('aria-label')),before);
    await page.keyboard.press('Escape');
    await page.goto('http://127.0.0.1:3197/?detail=1',{waitUntil:'networkidle0'});
    await page.waitForSelector('h1');
    await checkOverflow('product detail');
    await page.screenshot({path:resolve(output,`product-${width}.png`),fullPage:true});
    results.push({width,columns,status:'passed'});
    console.log('OK market, filters, photo carousel, cart, producer carousel/modal, detail: '+width+'px');
  }
  assert.deepEqual(errors,[],'Browser errors');
  await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors},null,2));
} finally {await browser?.close();await server.close();}
