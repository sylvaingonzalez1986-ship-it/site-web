/** Real blog pages and components rendered with local fixtures; no backend writes. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const output=resolve(root,'output/blog-arena');
const port=3196;
const modules={
  'blog-fixtures': `
    const content = [
      'Au petit matin, le jardin se réveille doucement. On prend le temps de regarder les plantes, de toucher la terre et de noter ce qui a changé depuis la veille. Ces gestes simples racontent notre manière de cultiver.',
      'Chaque saison apporte ses questions. La lumière, le sol et le rythme des pluies font partie du quotidien. Le carnet permet de garder une trace de ces observations et de partager ce que le terrain nous apprend.',
      'Dans les rangs, rien ne remplace la patience. Nous préférons observer avant d’intervenir, comparer les récoltes et discuter avec les producteurs voisins. C’est aussi de ces échanges que naissent les prochains essais.',
      'Du champ au journal, notre envie reste la même : rendre ce travail visible, expliquer nos choix et continuer à apprendre ensemble. Retrouvez ici les nouvelles du jardin et les rencontres qui font vivre notre métier.'
    ].join('\\n\\n');
    export const posts=[
      ['Au rythme du jardin : le carnet d’un chanvrier','chronique','/sylvain-culture-hero.webp'],
      ['De la graine à la récolte, les gestes qui comptent','guide','/mascots/blog-journal.png'],
      ['Une nouvelle saison chez les copains','actualite','/mascots/home-producer.png'],
      ['Prendre le temps de découvrir le chanvre','bien-etre','/product_tea.jpg'],
      ['Comprendre les modes de culture','guide','/sylvain-culture-hero.webp'],
      ['Les rencontres qui font grandir notre jardin','chronique','/mascots/boutique-market.png']
    ].map(([title,category,coverImage],i)=>({id:'post-'+i,slug:'article-'+i,title,category,coverImage,content,excerpt:'Des nouvelles du terrain, des rencontres et des gestes de culture à découvrir dans le journal des chanvriers.',published:true,createdAt:'2026-09-'+String(19-i).padStart(2,'0')+'T10:00:00Z',updatedAt:'2026-09-19T10:00:00Z'}));
    export const blogContent={eyebrow:'Le journal des chanvriers',title:'Le carnet de terrain',description:'Des histoires de culture, des guides et des nouvelles des copains. Entre dans les coulisses du jardin.',postsReadMoreLabel:'Lire l’article',postsEmptyMessage:'Aucun article pour le moment.',breadcrumbHomeLabel:'Accueil',breadcrumbBlogLabel:'Le journal',postPublishedPrefix:'Publié le',postBackLabel:'Retour au journal'};
    export const store={blog:new URLSearchParams(location.search).has('empty')?[]:posts,products:[],content:{blog:blogContent},sections:{blog:[{id:'header',type:'header'},{id:'posts',type:'posts'}]}};
  `,
  'blog-preview.tsx': `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import BlogPage from '/src/app/blog/page';
    import BlogPostPage from '/src/app/blog/[slug]/page';
    window.__writes=[];
    window.fetch=async (input,options={})=>{
      const url=String(input);
      if(!url.startsWith('/api/blog/'))throw new Error('Preview blocks unexpected requests');
      if(options.method==='POST'){
        const body=JSON.parse(options.body);window.__writes.push({url,...body});
        return Response.json(url.includes('ratings')?{postId:body.postId,averageRating:4.7,totalRatings:13,userRating:body.rating}:{message:'Merci, votre commentaire attend la modération.'});
      }
      return Response.json(url.includes('ratings')?{postId:'post-0',averageRating:4.5,totalRatings:12,userRating:null}:{comments:[{id:'comment-1',customerFirstName:'Camille',customerLastName:'B.',content:'Merci pour ce partage. Les nouvelles du jardin donnent envie de découvrir la prochaine récolte !',createdAt:'2026-09-19T10:00:00Z'}]});
    };
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text}}});
    const detail=location.pathname.startsWith('/blog/article-');
    const element=detail?await BlogPostPage({params:Promise.resolve({slug:location.pathname.split('/').at(-1)})}):await BlogPage();
    createRoot(document.getElementById('root')).render(element);
  `,
  '@/lib/data-backend': `import {posts,store} from 'blog-fixtures';export const readPublicStoreByBackend=async()=>store;export const getBlogPostBySlugByBackend=async slug=>posts.find(p=>p.slug===slug);`,
  '@/lib/blog-interactions-backend': `export const getBlogRatingStats=async()=>({averageRating:4.5,totalRatings:12,userRating:null});`,
  '@/lib/site-url': `export const getSiteUrl=()=>location.origin;`,
  '@/components/JsonLd': `export const BreadcrumbJsonLd=()=>null;export const ArticleJsonLd=()=>null;`,
  '@/hooks/useCustomerSession': `export const useCustomerSession=()=>({user:new URLSearchParams(location.search).has('guest')?null:{id:'preview-user'}});`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return React.createElement('a',props)}`,
  'next/navigation': `import {useSyncExternalStore} from 'react';const subscribe=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};const navigate=url=>{history.replaceState({},'',url);window.dispatchEvent(new Event('popstate'))};const router={push:navigate,replace:navigate,refresh:()=>{}};export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));export const useRouter=()=>router;export const notFound=()=>{throw new Error('Fixture not found')};`,
};
const server=await createServer({configFile:false,envDir:false,root,publicDir:resolve(root,'public'),resolve:{alias:{'@':resolve(root,'src')}},css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{
  name:'isolated-blog',enforce:'pre',
  resolveId(id){if(id in modules)return '\0'+id;const normalized=id.replaceAll('\\','/').replace(/\.(tsx?|jsx?)$/,'');for(const key of Object.keys(modules)){if(key.startsWith('@/')&&normalized.endsWith('/src/'+key.slice(2)))return '\0'+key;}},
  load(id){if(id==='\0blog-preview.tsx')return ts.transpileModule(modules['blog-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['/blog','/blog/article-0','/blog/article-1'].includes(req.url?.split('?')[0]))return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Journal · aperçu arène</title><link rel="icon" href="data:,"><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__blog-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;
const errors=[];const results=[];
try{
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],userDataDir:resolve(output,'chrome-profile'),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.setRequestInterception(true);
  page.on('request',req=>{const u=new URL(req.url());void(u.protocol==='data:'||(u.hostname==='127.0.0.1'&&u.port===String(port))?req.continue():req.abort());});
  const goto=async path=>{await page.goto(`http://127.0.0.1:${port}${path}`,{waitUntil:'networkidle0',timeout:60000});await page.waitForSelector('h1');await page.evaluate(()=>document.fonts.ready)};
  const overflow=async label=>{const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(size.scroll<=size.width+1,label+JSON.stringify(size));};
  const clickText=async(selector,text)=>{const el=await page.evaluateHandle((selector,text)=>[...document.querySelectorAll(selector)].find(e=>e.textContent.trim()===text),selector,text);assert(el.asElement(),'Missing '+text);await el.asElement().click();await el.dispose();};
  for(const width of [320,390,768,1440]){
    await page.setViewport({width,height:width<700?844:1000,deviceScaleFactor:1});
    await goto('/blog');await page.waitForSelector('article');await overflow('listing');
    await page.screenshot({path:resolve(output,`blog-${width}.png`),fullPage:true});
    const visible=await page.$$eval('article',els=>els.filter(e=>e.getClientRects().length>0).length);assert.equal(visible,6);
    if(width<1024){await page.$eval('[role="region"]',e=>e.scrollTo({left:300,behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('[role="region"]').scrollLeft>0);}
    await clickText('[aria-label="Filtrer les articles par rubrique"] button','Guide');
    await page.waitForFunction(()=>location.search.includes('categorie=guide')&&document.querySelector('p[role="status"]').textContent==='2 articles');
    if(width<1024)await page.waitForFunction(()=>document.querySelector('[role="region"]').scrollLeft<2);
    await clickText('[aria-label="Filtrer les articles par rubrique"] button','Tous');
    await page.waitForFunction(()=>!location.search.includes('categorie')&&document.querySelector('p[role="status"]').textContent==='6 articles');
    await goto('/blog/article-0');await page.waitForSelector('[aria-label="Noter 5 sur 5"]');await overflow('article');
    const prose=await page.$eval('article > div:last-child > div:nth-child(2)',e=>({width:e.getBoundingClientRect().width,lineHeight:getComputedStyle(e).lineHeight}));assert(prose.width<850,'Reading measure too wide');
    await page.screenshot({path:resolve(output,`article-${width}.png`),fullPage:true});
    await clickText('button','Copier le lien');assert.equal(await page.evaluate(()=>window.__copied),`http://127.0.0.1:${port}/blog/article-0`);
    await page.click('[aria-label="Noter 5 sur 5"]');await page.waitForFunction(()=>document.querySelector('[aria-label="Noter 5 sur 5"]').getAttribute('aria-pressed')==='true');
    await page.type('[aria-label="Votre commentaire"]','Merci pour cet article de démonstration.');await page.click('button[type="submit"]');
    await page.waitForFunction(()=>document.querySelector('[aria-label="Votre commentaire"]').value==='');
    const writes=await page.evaluate(()=>window.__writes);assert.equal(writes.length,2);assert.equal(writes[0].rating,5);assert.equal(writes[1].content,'Merci pour cet article de démonstration.');
    await goto('/blog/article-0?guest=1');assert.equal(await page.$('[aria-label="Votre commentaire"]'),null);assert(await page.$eval('[aria-label="Noter 5 sur 5"]',e=>e.disabled));
    await goto('/blog?empty=1');assert.equal(await page.$$('article').then(a=>a.length),0);await overflow('empty');
    results.push({width,status:'passed'});console.log('OK listing, carousel, URL filters, article, sharing, ratings, comments, guest and empty states: '+width+'px');
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors},null,2));
}finally{await browser?.close();await server.close();}
