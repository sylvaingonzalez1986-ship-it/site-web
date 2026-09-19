/** Actual ranking UI and portrait assets with isolated score fixtures. No backend writes. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'output/ranking-avatars');
const modules = {
  'ranking-preview.tsx': `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/app/globals.css';
    import {ContestTesterLeaderboard} from '/src/components/contest/ContestHubClient';
    createRoot(document.getElementById('root')).render(<main style={{padding:12,maxWidth:900,margin:'auto'}}><ContestTesterLeaderboard seasonItems={[]} globalItems={[]} profileTrack="regular" viewerPseudo="Camille"/></main>);
  `,
  'preview-cart': `import {buildEmptyLoyaltySummary} from '/src/lib/loyalty';const loyalty=buildEmptyLoyaltySummary();loyalty.currentBadge={...loyalty.badges[2],unlocked:true};export const useCart=()=>({user:location.search.includes('guest')?null:{id:'preview-user',firstName:'Camille',email:'player@example.test',contestBetaEnabled:true},loyalty,totalItems:Number(new URLSearchParams(location.search).get('count')??3),hasWelcomePack:true,sessionLoading:false,authLoading:false});`,
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
  name:'isolated-rankings',enforce:'pre',
  resolveId(id){if(id.endsWith('/navigation/NavigationFeedback')||id==='./NavigationFeedback')return '\0preview-navigation';if(id.endsWith('/hooks/useCmsPages'))return '\0preview-pages';if(id.endsWith('/hooks/useCmsStore'))return '\0preview-store';if(id.endsWith('/components/CartDrawer'))return '\0preview-drawer';if(id.endsWith('/context/CartContext'))return '\0preview-cart';if(id in modules)return '\0'+id;},
  async load(id){if(id==='\0ranking-preview.tsx')return ts.transpileModule(modules['ranking-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Classements et avatars</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__ranking-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port:3224,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});

let browser; const errors=[]; let failPortraits=false;
const avatars=[{gender:'male',clothing:'teal',skin:'honey',appearance:{hair:'quiff',hairColor:'ginger',accessory:'glasses'}},{gender:'female',clothing:'berry',skin:'brown',appearance:{hair:'braids',hairColor:'pink',accessory:'earrings'}},null];
const entries=Array.from({length:10},(_,i)=>({rank:i+1,pseudo:i===0?'Camille':i===1?'UnPseudoTresLongDe24Chars':'Cultivateur'+(i+1),avatar:avatars[i%3],score:950-i*10,notebookScore:250,placardScore:700,rating:1250,seasonPoints:300,reputation:90,wins:12,losses:3,totalPoints:300,approvedReviewCount:12,level:{label:'Connaisseur'}}));
try {
  await mkdir(output,{recursive:true});await server.listen();browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',request=>{const url=new URL(request.url());
    if(failPortraits&&url.pathname.startsWith('/contest/avatars/')){void request.abort();}
    else if(url.pathname.startsWith('/api/')){const rankings=url.pathname.includes('rankings');void request.respond({status:rankings?200:503,contentType:'application/json',body:JSON.stringify(rankings?{entries,items:entries}:{error:'unavailable'})});}
    else void(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port==='3224')?request.continue():request.abort());
  });
  for(const width of [320,390,768,1440]) {
    await page.setViewport({width,height:1000});await page.goto('http://127.0.0.1:3224/',{waitUntil:'networkidle0'});
    for(const mode of [0,2,1]){
      await page.$$eval('[aria-label="Type de classement"] button',(buttons,index)=>buttons[index].click(),mode);
      await page.waitForSelector('.contest-station-row canvas[data-avatar-state="ready"]',{timeout:60000});
      await page.waitForFunction(()=>document.querySelectorAll('.contest-station-row canvas[data-avatar-state="ready"]').length===7);
      const layout=await page.$$eval('.contest-station-row',rows=>rows.map(row=>{const [rank,avatar,identity,score]=row.children;const boxes=[rank,avatar,identity,score].map(el=>el.getBoundingClientRect());return {count:row.children.length,aligned:boxes.every((box,i)=>i===0||box.left>=boxes[i-1].right-1),contained:row.scrollWidth<=row.clientWidth+1,label:avatar.getAttribute('aria-label'),fallback:!avatar.querySelector('canvas')};}));
      assert.equal(layout.length,10);assert(layout.every(row=>row.count===4&&row.aligned&&row.contained),'row layout '+width+' '+mode);assert(layout[2].fallback);assert.equal(layout[0].label,'Avatar de Camille');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+width);
      if(mode===1){await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.trim()==='Global').click());await page.waitForFunction(()=>document.querySelectorAll('.contest-station-row canvas[data-avatar-state="ready"]').length===7);assert(await page.$('.contest-station-row[href^="/arene/profils/"]'));}
      await (await page.$('[id][class*="playerLeaderboardPanel"]')).screenshot({path:resolve(output,`ranking-${width}-${mode}.png`)});
    }
  }
  failPortraits=true;await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('.contest-station-row canvas[data-avatar-state="error"]');
  assert.equal(await page.$eval('.contest-station-row canvas[data-avatar-state="error"]',el=>getComputedStyle(el).opacity),'0');
  assert.equal(await page.$$eval('.contest-station-row',rows=>rows.length),10);
  assert.deepEqual(errors,[]);console.log('Ranking portraits passed: 3 modes, season/global, 320/390/768/1440px, actual customized portrait rendering, legacy fallback, rank/avatar/name/score alignment profile links and failed-image fallback.');
}finally{await browser?.close();await server.close();}
