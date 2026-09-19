/** Actual mobile navigation and loyalty badges with isolated account/CMS fixtures. No backend writes. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'output/mobile-menu-badges');
const modules = {
  'menu-preview.tsx': `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {Navbar} from '/src/components/Navbar'; import {LoyaltyBadgeIllustration} from '/src/components/account/LoyaltyBadgeIllustration';
    import {LoyaltyBadgeSummary} from '/src/components/account/LoyaltyBadgeSummary';
    const ids=['decouverte','explorateur','connaisseur','ambassadeur','legende'];
    createRoot(document.getElementById('root')).render(<><Navbar/><main style={{padding:'140px 20px 40px',maxWidth:1200,margin:'auto'}}><section id='emblems' style={{padding:20,background:'#fffaf1',border:'2px solid #00563f',marginBottom:20}}><h1 style={{fontFamily:'Display',fontSize:36,color:'#003f30'}}>Les insignes du club.</h1>{[true,false].map(unlocked=><div key={String(unlocked)} style={{display:'flex',gap:12,flexWrap:'wrap',padding:'12px 0'}}>{ids.map(badgeId=><div key={badgeId} style={{display:'grid',justifyItems:'center',gap:6}}><LoyaltyBadgeIllustration badgeId={badgeId} unlocked={unlocked} size='md'/><LoyaltyBadgeIllustration badgeId={badgeId} unlocked={unlocked} size='xs'/></div>)}</div>)}</section><LoyaltyBadgeSummary/></main></>);
  `,
  'preview-cart': `import {buildEmptyLoyaltySummary} from '/src/lib/loyalty';const loyalty=buildEmptyLoyaltySummary();loyalty.currentBadge={...loyalty.badges[2],unlocked:true};export const useCart=()=>({user:location.search.includes('guest')?null:{id:'preview-user',firstName:'Camille',email:'player@example.test',contestBetaEnabled:true},loyalty,totalItems:3,hasWelcomePack:true,sessionLoading:false,authLoading:false});`,
  'preview-pages': `export const useCmsPages=()=>({pages:location.search.includes('long')?Array.from({length:5},(_,i)=>({slug:'page-'+i,title:'Une histoire de chanvre et de producteurs '+i,navLabel:'',showInNav:true,position:i})):[]});`,
  'preview-store': `export const useCmsStore=()=>({store:{content:{profile:{}}}});`,
  'preview-drawer': `import React from 'react';export function CartDrawer({open,onClose}){return open?React.createElement('div',{role:'dialog','data-cart-preview':true},React.createElement('button',{onClick:onClose},'Fermer le panier')):null}`,
  'next/image': `import React from 'react'; export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}) {return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react'; export const useLinkStatus=()=>({pending:false}); export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/dynamic': `import React from 'react'; export default function dynamic(loader){const Component=React.lazy(()=>loader().then(m=>({default:m.default||m})));return props=>React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props))}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const server = await createServer({configFile:false,envDir:false,root,cacheDir:resolve(output,'vite-cache'),define:{'process.env.NEXT_PUBLIC_CONTEST_BETA_ACCESS_ENABLED':'"false"'},optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react']},publicDir:resolve(root,'public'),esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom'],alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{
  name:'isolated-menu',enforce:'pre',
  resolveId(id){if(id.endsWith('/hooks/useCmsPages'))return '\0preview-pages';if(id.endsWith('/hooks/useCmsStore'))return '\0preview-store';if(id.endsWith('/components/CartDrawer'))return '\0preview-drawer';if(id.endsWith('/context/CartContext'))return '\0preview-cart';if(id in modules)return '\0'+id;},
  async load(id){if(id==='\0menu-preview.tsx')return ts.transpileModule(modules['menu-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marché · essai DA arène</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__menu-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port:3223,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser; const errors=[];
try {
  await mkdir(output,{recursive:true});await server.listen(); browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(); page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());void(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port==='3223')?request.continue():request.abort());});
  for(const [width,height] of [[320,740],[390,844],[667,390]]) {
    await page.setViewport({width,height});await page.goto('http://127.0.0.1:3223/',{waitUntil:'networkidle0'});await page.waitForSelector('[data-badge-tone]');
    assert.equal(await page.$$eval('#emblems [data-badge-tone]',items=>items.length),20);
    await page.click('button[aria-label="Menu"]');await page.waitForSelector('#mobile-nav[open]');
    assert.equal(await page.$eval('#mobile-nav',el=>getComputedStyle(el).backgroundColor),'rgb(0, 63, 48)');
    assert(await page.$eval('#mobile-nav',el=>el.scrollWidth<=el.clientWidth+1));
    assert.equal(await page.$eval('#mobile-nav [data-badge-tone]',el=>Math.round(el.getBoundingClientRect().width)),52);
    for(let i=0;i<18;i++)await page.keyboard.press('Tab');
    assert(await page.evaluate(()=>document.querySelector('#mobile-nav').contains(document.activeElement)),'focus remains inside menu');
    await page.focus('#mobile-nav button[aria-label="Fermer le menu"]');await page.$eval('#mobile-nav',el=>el.scrollTop=0);await page.screenshot({path:resolve(output,`menu-member-${width}.png`)});
    await page.keyboard.press('Escape');assert.equal(await page.$('#mobile-nav[open]'),null);
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Menu');
    assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'gallery overflow');
    await page.screenshot({path:resolve(output,`badges-${width}.png`),fullPage:true});
  }
  await page.setViewport({width:390,height:844});await page.goto('http://127.0.0.1:3223/?guest&long',{waitUntil:'networkidle0'});await page.click('button[aria-label="Menu"]');
  await page.waitForSelector('#mobile-nav[open]');assert(await page.$('#mobile-nav a[href="/compte/connexion"]'));
  await page.$eval('#mobile-nav',el=>el.scrollTop=el.scrollHeight);await page.screenshot({path:resolve(output,'menu-long-bottom.png')});
  assert(await page.$eval('#mobile-nav',el=>el.scrollWidth<=el.clientWidth+1));
  await page.evaluate(()=>[...document.querySelectorAll('#mobile-nav button')].find(b=>b.textContent.includes('Mon panier')).click());await page.waitForSelector('[data-cart-preview]');assert.equal(await page.$('#mobile-nav[open]'),null);
  await page.goto('http://127.0.0.1:3223/',{waitUntil:'networkidle0'});await page.click('button[aria-label="Menu"]');
  await page.$eval('#mobile-nav a[href="/boutique"]',el=>el.addEventListener('click',event=>event.preventDefault(),{once:true}));await page.click('#mobile-nav a[href="/boutique"]');await page.waitForFunction(()=>!document.querySelector('#mobile-nav').open);
  await page.click('button[aria-label="Menu"]');await page.setViewport({width:1440,height:1000});await page.waitForFunction(()=>!document.querySelector('#mobile-nav').open);
  await page.screenshot({path:resolve(output,'badges-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('Mobile menu and badges passed: phone/landscape, focus trap, Escape/focus restoration, guest/member, long CMS navigation, cart, desktop resize, all five loyalty tiers with locked/unlocked and small/large variants.');
}finally{await browser?.close();await server.close();}
