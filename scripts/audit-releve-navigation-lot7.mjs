/** Actual Commerce and Relève coach; seeded local lessons, navigation only. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/clarity-lot7/guides');
const port = Number(process.env.KQ_RELEVE_LANGUAGE_PORT ?? 3578), origin = `http://127.0.0.1:${port}`;
const reportsOnly = process.argv.includes('--reports-only');
const modules = {
  'warehouse-assets': `export default ${await readFile(resolve(root, 'public/placard/warehouse-v2/manifest.json'), 'utf8')};`,
  entry: `import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import {KqMarketHub} from '/src/components/placard/KqMarketHub';
import {ArenaReleveGuide,ReleveGuideProvider} from '/src/components/contest/ArenaReleveGuide';
import {getReleveCommerceGuide} from '/src/lib/arena-releve-commerce-guide';
import {createReleveCommerceBusiness,createReleveCommerceMerch,applyReleveCommerceRequest,getReleveCommerceSnapshot} from '/src/lib/kanab-quest-releve-commerce';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import retro from '/src/components/contest/ArenaRetro.module.css';
import releve from '/src/components/contest/ArenaReleve.module.css';
const fixture=new URLSearchParams(location.search).get('fixture')??'sales';
let state=fixture==='management'?createReleveCommerceBusiness():createReleveCommerceMerch();
const setup=(body,path='/api/arena/placard/commerce')=>{state=applyReleveCommerceRequest(state,{path,method:'POST',body}).state;};
const online=(command,payload={})=>setup({action:'online',command,payload});
const prepareFlowerListing=()=>{
 const lot=getReleveCommerceSnapshot(state).rawLots[0];
 const option=lot.options.find(item=>item.route==='raw');
 setup({action:'prepare',flowerId:lot.flowerId,route:'raw',expectedCostCents:option.market.processingCostCents});
 const stock=state.operations.trial.commerce.stocks[0];
 online('buy-packaging',{code:'kraft-5',quantity:2});
 online('create-listing',{stockId:stock.id,formatGrams:5,packagingCode:'kraft-5',packets:2,packetPriceCents:913});
};
if(fixture==='management')setup({action:'borrow-computer'},'/api/releve/commerce');
if(fixture==='dashboard'){prepareFlowerListing();online('advance-online-time',{hours:24});}
if(fixture==='merch-stocked'||fixture.startsWith('merch-report')){
 online('buy-merch-module',{code:'paper'});online('buy-merch-stock',{code:'stickers',quantity:10});
}
if(fixture.startsWith('merch-report')){
 prepareFlowerListing();online('update-merch',{code:'stickers',priceCents:400,active:true});online('advance-online-time',{hours:24});
}
if(fixture==='campaign-report-open'){
 prepareFlowerListing();online('start-marketing',{version:2,code:'introduction',angle:'value',listingId:state.operations.trial.commerce.online.listings[0].id,budgetCode:'local'});
 online('advance-online-time',{hours:24});
}
const chapter=fixture.startsWith('merch-')?'merch':fixture==='campaign-report-open'?'business':'shop';
const steps=getReleveCommerceGuide(chapter,state);
window.fixture={name:fixture,chapter,milestones:[...state.milestones]};
window.posts=[];window.requests=[];
const api=createKqTutorialApi(async(input,init={})=>{
 const url=new URL(String(input),location.origin),method=init.method??'GET';window.requests.push({path:url.pathname,method});
 if(method!=='GET'){window.posts.push({path:url.pathname,method});return Response.json({error:'Navigation en lecture seule'},{status:405});}
 try{const result=applyReleveCommerceRequest(state,{path:url.pathname+url.search,method,body:{}});return Response.json(result.payload);}
 catch(error){return Response.json({error:error.message},{status:400});}
});
function Host(){
 const host=useRef(null);const [section,setSection]=useState(fixture==='merch-report-open'?'dashboard':fixture==='dashboard'||fixture==='merch-report'||fixture==='campaign-report-open'?'management':'overview');
 const [guideEnabled,setGuideEnabled]=useState(!fixture.endsWith('report-open'));
 useEffect(()=>{if(!host.current.open)host.current.showModal();window.enableGuide=()=>setGuideEnabled(true);},[]);
 return <dialog ref={host} className={retro.surface} aria-label="Recette locale La Relève" style={{inset:0,width:'100%',maxWidth:'none',height:'100%',maxHeight:'none',margin:0,padding:12,border:0,overflow:'auto'}}>
  <header><h1 style={{fontSize:18,margin:'0 0 12px'}}>La Relève · recette locale</h1></header>
  <KqTutorialApiProvider api={api}><ReleveGuideProvider>
   <div data-releve-commerce={chapter} data-releve-section={section} style={{paddingBottom:fixture.endsWith('report-open')?1200:220}}>
    <KqMarketHub section={section} onSectionChange={setSection} managementView={fixture==='campaign-report-open'?'marketing':undefined} onOpenShop={()=>{}} />
   </div>
   <div className={releve.nestedCoach} data-releve-floating-guide><ArenaReleveGuide compact enabled={guideEnabled} steps={steps} instruction="Choisis la prochaine étape de cet essai." /></div>
  </ReleveGuideProvider></KqTutorialApiProvider>
 </dialog>;
}
createRoot(document.getElementById('root')).render(<Host/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{}});`,
};
const server = await createServer({ root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'), publicDir: resolve(root, 'public'), optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'] }, resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [tailwindcss({ base: root })] } }, plugins: [{
  name: 'releve-navigation', enforce: 'pre',
  resolveId(id) { if (id.endsWith('/public/placard/warehouse-v2/manifest.json')) return '\0warehouse-assets'; if (id in modules) return '\0' + id; },
  async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; },
  configureServer(vite) { vite.middlewares.use((req, res, next) => { if (req.url?.split('?')[0] !== '/') return next(); res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette guides Commerce</title><style>@font-face{font-family:Display;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}@font-face{font-family:Body;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>'); }); },
}], server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null } });

let browser;
const results = [], errors = [], networkWrites = [], external = [];
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage(); page.setDefaultTimeout(25000); page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await page.setRequestInterception(true);
  page.on('request', request => { const url = new URL(request.url()); if (url.protocol === 'data:') return void request.continue(); if (url.origin !== origin) { external.push(url.href); return void request.abort(); } if (!['GET', 'HEAD'].includes(request.method())) { networkWrites.push(url.pathname); return void request.abort(); } void request.continue(); });
  const visit = async fixture => { await page.goto(`${origin}/?fixture=${fixture}`, { waitUntil: 'networkidle0' }); await page.waitForSelector('dialog[open]'); };
  const target = async (id, selector) => {
    const element = await page.waitForSelector(`[data-releve-guide-active="${id}"]`, { visible: true });
    assert.equal(await element.evaluate((node, expected) => node.matches(expected), selector), true, id);
    assert.equal(await page.$eval('[data-releve-coach]', node => node.dataset.guideStep), id);
    return element;
  };
  const follow = async (id, selector) => {
    const element = await target(id, selector);
    await page.click('[aria-label="Aide : me montrer"]');
    assert.equal(await element.evaluate(node => document.activeElement === node), true, `Coach focus: ${id}`);
    assert.notEqual(await element.evaluate(node => getComputedStyle(node).outlineStyle), 'none', `Keyboard focus: ${id}`);
    await page.keyboard.press('Enter');
  };
  const record = async (name, width) => {
    await page.evaluate(() => document.fonts.ready);
    const state = await page.evaluate(() => ({ fixture: window.fixture, requests: window.requests, posts: window.posts, overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector('dialog').scrollWidth > document.querySelector('dialog').clientWidth + 1, target: document.querySelector('[data-releve-guide-active]')?.dataset.releveGuideActive ?? null, section: document.querySelector('[data-releve-section]')?.dataset.releveSection }));
    assert.equal(state.overflow, false, `${name} ${width}`); assert.deepEqual(state.posts, []);
    await page.screenshot({ path: resolve(output, `${name}-${width}.png`) });
    results.push({ name, width, ...state });
  };
  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 844, isMobile: width < 700, hasTouch: width < 700 });
    if (!reportsOnly) {
    for (const section of ['sales', 'management', 'dashboard']) {
      await visit(section); await target(`commerce-open-${section}`, `[data-market-section="${section}"]`); await record(`guide-to-${section}`, width);
      await follow(`commerce-open-${section}`, `[data-market-section="${section}"]`);
      await page.waitForSelector(`[data-market-section="${section}"][aria-current="page"]`);
      await record(`arrived-${section}`, width);
    }
    await visit('merch-prepare');
    await follow('merch-management', '[data-market-section="management"]');
    await follow('merch-open', '[data-shop-view="merch"]');
    await target('merch-module', '[data-merch-buy-module="paper"]'); await record('products-prepare', width);
    await visit('merch-stocked');
    await follow('merch-management', '[data-market-section="management"]');
    await follow('merch-open', '[data-shop-view="merch"]');
    await target('merch-activate', '[data-merch-active]'); await record('products-stocked', width);
    await visit('merch-report');
    await follow('merch-dashboard', '[data-market-section="dashboard"]');
    await follow('merch-activity', '[data-online-rayon="merch"]');
    await target('merch-report', '[data-merch-activity] details > summary'); await record('products-report', width);
    await follow('merch-report', '[data-merch-activity] details > summary');
    await page.waitForSelector('[data-merch-activity] details[open]'); await record('products-report-open', width);
    }
    for (const scenario of [
      { fixture: 'merch-report-open', id: 'merch-report-read', selector: '[data-merch-activity] details[open]', details: '[data-merch-activity] details' },
      { fixture: 'campaign-report-open', id: 'commerce-read-campaign-report', selector: '[data-marketing-history][open] [data-marketing-report]', details: '[data-marketing-history]' },
    ]) {
      await visit(scenario.fixture);
      if (scenario.fixture === 'merch-report-open') await page.click('[data-online-rayon="merch"]');
      const summary = await page.waitForSelector(`${scenario.details} > summary`, { visible: true });
      await summary.evaluate(node => node.click());
      await page.waitForSelector(scenario.selector, { visible: true });
      // Extra host padding makes an already-open report fully offscreen even on desktop.
      await page.evaluate(() => { const host = document.querySelector('dialog'); host.scrollTop = host.scrollHeight; });
      await page.waitForFunction(selector => document.querySelector(selector).getBoundingClientRect().bottom <= 0, {}, scenario.selector);
      await page.evaluate(() => window.enableGuide());
      const report = await target(scenario.id, scenario.selector);
      await page.waitForFunction(selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return rect.top >= 0 && rect.top < innerHeight && rect.bottom > 0; }, {}, scenario.selector);
      await page.focus('[aria-label="Aide : me montrer"]'); await page.keyboard.press('Enter');
      assert.equal(await report.evaluate(node => document.activeElement === node), true, `Open report focus: ${scenario.id}`);
      assert.notEqual(await report.evaluate(node => getComputedStyle(node).outlineStyle), 'none', `Open report outline: ${scenario.id}`);
      assert.equal(await report.evaluate(node => node.closest('details').open), true, `Report stays open: ${scenario.id}`);
      await record(`existing-${scenario.fixture}`, width);
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(networkWrites, []); assert.deepEqual(external, []);
  await writeFile(resolve(output, reportsOnly ? 'reports-open.json' : 'report.json'), JSON.stringify({ createdAt: new Date().toISOString(), scope: 'Real MarketHub and ArenaReleveGuide in native dialog; simulator seeded before rendering; UI GET only', results, errors, networkWrites, external }, null, 2));
  console.log(JSON.stringify({ passed: results.length, errors, networkWrites, external, output }));
} catch (error) { const pages = await browser?.pages(); await pages?.at(-1)?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
finally { if (browser) await browser.close(); await server.close(); }
