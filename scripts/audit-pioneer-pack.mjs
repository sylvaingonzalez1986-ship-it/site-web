/** Browser audit of the real reward panel with isolated account/API fixtures. */
import { createServer } from 'vite';
import ts from 'typescript';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),output=resolve(root,'output/pioneer-pack'),port=3197;
const modules={
  'pioneer-preview.tsx': `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {PioneerPackReward} from '/src/components/account/PioneerPackReward';
    const mode=new URLSearchParams(location.search).get('state')||'eligible';
    window.__posts=0;window.__events=[];window.__refreshes=0;
    for(const event of ['kq:boosters-updated','kq:collection-updated','kq:equipment-updated']) window.addEventListener(event,()=>window.__events.push(event));
    let failed=false;
    window.fetch=async(input,options={})=>{
      if(String(input)!=='/api/account/pioneer-pack')throw new Error('Unexpected request');
      if(options.method==='POST'){window.__posts++;await new Promise(r=>setTimeout(r,150));if(mode==='claim-error')return new Response(JSON.stringify({error:'Réessaie dans un instant.'}),{status:503});}
      if(mode==='error'&&!failed){failed=true;return new Response(JSON.stringify({error:'Pack momentanément indisponible.'}),{status:503});}
      const claimed=mode==='claimed'||window.__posts>0;
      return new Response(JSON.stringify({eligible:mode!=='ineligible',claimed,available:mode!=='unavailable',cashCents:100000,packCount:10,grantedAt:claimed?'2026-09-19T10:00:00Z':null,goldCard:claimed?{code:'HH2026-007',name:'Sour Space Candy',imageUrl:null}:null}));
    };
    createRoot(document.getElementById('root')).render(<PioneerPackReward onClaimed={()=>{window.__refreshes++}}/>);
  `,
  '@/context/CartContext': `const context={isAuthenticated:new URLSearchParams(location.search).get('state')!=='guest',authLoading:false,user:{id:'preview-user'},refreshSession:async()=>{}};export const useCart=()=>context;`,
  '@/components/navigation/NavigationLink': `import React from 'react';export default function Link(props){return React.createElement('a',props)}`,
  'next/image': `import React from 'react';export default function Image({priority,fill,...props}){return React.createElement('img',props)}`,
};
const server=await createServer({configFile:false,envDir:false,root,publicDir:resolve(root,'public'),resolve:{alias:{'@':resolve(root,'src')}},plugins:[{
  name:'pioneer-preview',enforce:'pre',
  resolveId(id){if(id in modules)return '\0'+id;const normalized=id.replaceAll('\\','/').replace(/\.(tsx?|jsx?)$/,'');for(const key of Object.keys(modules)){if(key.startsWith('@/')&&normalized.endsWith('/src/'+key.slice(2)))return '\0'+key;}},
  load(id){if(id==='\0pioneer-preview.tsx')return ts.transpileModule(modules['pioneer-preview.tsx'],{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText;if(id.startsWith('\0'))return modules[id.slice(1)];},
  configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/preview')return next();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body}*{box-sizing:border-box}body{margin:0;background:#022820;font-family:Body,sans-serif;padding:40px 0}button,a{font:inherit}p{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__pioneer-preview.tsx"></script></html>`);});}
}],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:{ignored:['**/output/**','**/.next/**']}}});
let browser;const errors=[],results=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],userDataDir:resolve(output,'chrome-profile'),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());void(url.protocol==='data:'||(url.hostname==='127.0.0.1'&&url.port===String(port))?request.continue():request.abort());});
  const goto=async state=>{await page.goto(`http://127.0.0.1:${port}/preview?state=${state}`,{waitUntil:'networkidle0'});await page.waitForSelector('#pack-pionniers[aria-busy="false"]');await page.evaluate(()=>document.fonts.ready);};
  const overflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  for(const width of [320,390,768,1440]) {
    await page.setViewport({width,height:width<700?844:1000,deviceScaleFactor:1});
    await goto('eligible');await overflow();
    assert.equal(await page.$$eval('ul li',items=>items.length),4);
    assert(await page.$eval('img',img=>img.complete&&img.naturalWidth>0));
    assert.equal(await page.evaluate(()=>window.__posts),0,'status never grants automatically');
    await page.screenshot({path:resolve(output,`eligible-${width}.png`),fullPage:true});
    await page.click('button');await page.waitForFunction(()=>document.body.textContent.includes('Ton pack a rejoint'));
    assert.equal(await page.evaluate(()=>window.__posts),1);
    assert.deepEqual(await page.evaluate(()=>window.__events),['kq:boosters-updated','kq:collection-updated','kq:equipment-updated']);
    assert.equal(await page.evaluate(()=>window.__refreshes),1);
    assert.equal(await page.$('button'),null);
    assert(await page.$('a[href="/arene/placard?view=shop"]'));await overflow();
    await page.screenshot({path:resolve(output,`claimed-${width}.png`),fullPage:true});
    results.push({width,claim:'pass',overflow:false});
  }
  for(const state of ['guest','ineligible','unavailable','claimed','error','claim-error']) {
    await goto(state);await overflow();
    if(state==='guest'){assert(await page.$('a[href^="/compte/connexion"]'));assert.equal(await page.$('button'),null);}
    if(state==='ineligible'){assert.equal(await page.$('button'),null);assert((await page.$eval('section',el=>el.textContent)).includes('Aucune commande'));}
    if(state==='unavailable')assert(await page.$eval('button',button=>button.disabled));
    if(state==='claimed')assert.equal(await page.$('button'),null);
    if(state==='error'){assert(await page.$('[role="alert"]'));await page.click('button');await page.waitForFunction(()=>!document.querySelector('[role="alert"]'));assert.equal(await page.evaluate(()=>window.__posts),0);}
    if(state==='claim-error'){await page.click('button');await page.waitForSelector('[role="alert"]');assert.equal(await page.evaluate(()=>window.__events.length),0);assert.equal(await page.$eval('button',el=>el.disabled),false);}
    results.push({state,result:'pass'});
  }
  assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({results,errors},null,2));
  console.log('Pioneer panel passed: 320/390/768/1440px, claim, refresh, guest, eligibility, claimed, unavailable, retry and errors.');
} finally {await browser?.close();await server.close();}
