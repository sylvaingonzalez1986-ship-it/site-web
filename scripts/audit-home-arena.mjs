/** Actual home and navigation components with isolated CMS/cart fixtures. No backend writes. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'output/home-arena');
const modules = {
  'home-preview.tsx': `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {HomeEditorialExperience} from '/src/components/home/HomeEditorialExperience'; import {Navbar} from '/src/components/Navbar';
    import {defaultStore} from '/src/data/default-store';
    const store=structuredClone(defaultStore);const params=new URLSearchParams(location.search);
    store.products=['Fleur du bocage','Douceur bretonne','Les petits bourgeons','Fleurs des copains'].map((name,i)=>({id:'home-'+i,name,category:'fleurs',price:4.5+i,image:'/product_flower.jpg',images:['/product_flower.jpg','/product_resin.jpg'],description:'Une recolte cultivee avec soin en Bretagne.',cultureMode:'outdoor',trackStock:true,stockQuantity:100,weightGrams:1}));
    store.content.home.seasonGalleryImages=['/product_flower.jpg','/product_resin.jpg'];
    if(params.has('empty')){store.products=[];store.content.home.seasonGalleryImages=[];}
    if(params.has('hidden')){store.sections.home=store.sections.home.map(section=>({...section,visible:false}));}
    if(params.has('long')){store.content.home.heroPrimaryCtaLabel='Decouvrir toutes les fleurs de nos producteurs';store.content.home.seasonGalleryTitle='Une tres longue saison dans les champs de nos producteurs bretons';}
    createRoot(document.getElementById('root')).render(<><Navbar/><HomeEditorialExperience initialStore={store}/></>);
  `,
  'preview-cart': `import {buildEmptyLoyaltySummary} from '/src/lib/loyalty';export const useCart=()=>({user:null,isAuthenticated:new URLSearchParams(location.search).has('member'),loyalty:buildEmptyLoyaltySummary(),totalItems:0,hasWelcomePack:false,sessionLoading:false,authLoading:false,cartLoading:false,items:[],addToCart:(product,variant,qty)=>{window.__cartAdds=(window.__cartAdds||0)+qty;return {ok:true}}});`,
  'preview-pages': `export const useCmsPages=()=>({pages:location.search.includes('long')?Array.from({length:5},(_,i)=>({slug:'page-'+i,title:'Une histoire de chanvre et de producteurs '+i,navLabel:'',showInNav:true,position:i})):[]});`,
  'preview-store': `export const useCmsStore=()=>({store:{content:{profile:{}}}});`,
  'preview-drawer': `import React from 'react';export function CartDrawer({open,onClose}){return open?React.createElement('div',{role:'dialog','data-cart-preview':true},React.createElement('button',{onClick:onClose},'Fermer le panier')):null}`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) {return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from 'react'; export default function dynamic(loader){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props))}`,
  'preview-navigation': `export const NavigationPending=()=>null; export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
  'next/navigation': `export const usePathname=()=>location.search.includes('inner')?'/boutique':location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),define:{'process.env.NEXT_PUBLIC_CONTEST_BETA_ACCESS_ENABLED':'"false"'},optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{
  name:'isolated-home',enforce:'pre',
  resolveId(id){if(id.endsWith('/navigation/NavigationFeedback')||id==='./NavigationFeedback')return '\0preview-navigation';if(id.endsWith('/hooks/useCmsPages'))return '\0preview-pages';if(id.endsWith('/hooks/useCmsStore'))return '\0preview-store';if(id.endsWith('/components/CartDrawer'))return '\0preview-drawer';if(id.endsWith('/context/CartContext'))return '\0preview-cart';if(id in modules)return '\0'+id;},
  async load(id){if(id==='\0home-preview.tsx')return ts.transpileModule(modules['home-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accueil clair</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__home-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port:3225,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});

let browser;const errors=[];
try {
  await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());void(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port==='3225')?request.continue():request.abort());});
  for(const width of [320,390,768,1440]){
    await page.setViewport({width,height:1000});await page.goto('http://127.0.0.1:3225/',{waitUntil:'networkidle0'});
    await page.waitForSelector('#products article');await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.$$eval('h1',items=>items.length),1);
    assert.equal(await page.$$eval('#products article',items=>items.length),4);
    assert.equal(await page.$$eval('#badge-fidelite-home [data-badge-tone]',items=>items.length),5);
    assert.equal(await page.$eval('[data-tutorial="home-hero"]',el=>getComputedStyle(el).backgroundColor),'rgb(255, 250, 241)');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+width);
    assert(await page.$$eval('[class*="heroActions"] a',links=>links.every(link=>link.getBoundingClientRect().height>=44)));
    if(width===1440)assert.equal(await page.$eval('header .game-brand',el=>getComputedStyle(el).color),'rgb(255, 250, 241)');
    await page.screenshot({path:resolve(output,`home-${width}.png`),fullPage:true});
    for(const section of ['badge-fidelite-home','cultures-saison'])await (await page.$('#'+section)).screenshot({path:resolve(output,`${section}-${width}.png`)});
    await (await page.$('[data-tutorial="home-hero"]')).screenshot({path:resolve(output,`hero-${width}.png`)});
    await page.$eval('#products article button.btn-primary',button=>button.click());assert.equal(await page.evaluate(()=>window.__cartAdds),1);
    const carousel=await page.$('#cultures-saison [aria-label^="Images de"]');await carousel.focus();await page.keyboard.press('ArrowRight');
    assert.equal(await carousel.$eval('[aria-label="Afficher photo 2"]',button=>button.getAttribute('aria-current')),'true');
    await page.$eval('[href="#notre-philosophie"]',link=>link.click());assert.equal(new URL(page.url()).hash,'#notre-philosophie');
    if(width<768){await page.evaluate(()=>window.scrollTo(0,0));await page.click('button[aria-label="Menu"]');await page.waitForSelector('#mobile-nav[open]');await page.keyboard.press('Escape');}
  }
  for(const scenario of ['empty','hidden','long','member']){
    await page.setViewport({width:320,height:1000});await page.goto('http://127.0.0.1:3225/?'+scenario,{waitUntil:'networkidle0'});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'scenario overflow '+scenario);
    if(scenario==='empty'){assert.equal(await page.$('#products article'),null);assert.equal(await page.$('#cultures-saison'),null);}
    if(scenario==='hidden'){assert.equal(await page.$('#products'),null);assert.equal(await page.$('#prix-juste-title'),null);assert.equal(await page.$('#cultures-saison'),null);}
    if(scenario==='member')assert.equal(await page.$eval('#badge-fidelite-home a',link=>link.getAttribute('href')),'/profil?tab=fidelite');
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert(await page.$eval('[class*="primaryCta"]',el=>parseFloat(getComputedStyle(el).transitionDuration)<=.001));
  assert.deepEqual(errors,[]);console.log('Home passed: 320/390/768/1440px, light palette, four products, five loyalty emblems, cart, carousel keyboard, anchors, mobile menu, empty/hidden/long CMS content, guest/member links and reduced motion.');
}finally{await browser?.close();await server.close();}
