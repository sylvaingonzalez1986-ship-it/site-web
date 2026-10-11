/** Real commerce/finance UI with local lesson data. Blocks all external requests. */
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer, transformWithOxc} from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import {Launcher} from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/placard-commerce-clarity');
const port = Number(process.env.COMMERCE_CLARITY_PORT ?? 3251), origin = `http://127.0.0.1:${port}`;
const modules = {
  entry: `import React from 'react';
    import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';
    import {KqMarketHub} from '/src/components/placard/KqMarketHub';
    import {KqTreasuryDesk} from '/src/components/placard/KqTreasuryDesk';
    import {createKqTutorialApi,KqTutorialApiProvider} from '/src/components/placard/KqTutorialApiContext';
    import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
    const params = new URLSearchParams(location.search);
    let state = createKqOperationsLesson('market');
    const flowerId = getKqOperationsCommerce(state).rawLots[0].flowerId;
    window.__actions = [];
    if(params.has('prepared')) state = applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body:{action:'prepare',flowerId,route:'raw',expectedCostCents:0,requestKey:'fixture-prepare'}}).state;
    const request = async(input,init={}) => {
      const url = new URL(String(input),location.origin), method = init.method ?? 'GET';
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      if(method !== 'GET') window.__actions.push(body);
      if(url.pathname === '/api/arena/placard/treasury') {
        const now = new Date(state.trial.clock).toISOString(), cash = state.trial.commerce.cashCents;
        return Response.json({version:1,serverNow:now,startedAt:now,businessStartedAt:now,period:{key:url.searchParams.get('period')??'current',from:now,to:now},openingBalances:{cash,opening_equity:-cash},closingBalances:{cash,opening_equity:-cash},series:[],journal:{items:[],total:0,offset:0,limit:25},checks:{walletCashCents:cash,vatReserveCents:0,savingsCents:0,labDebtCents:0,energyDebtCents:0,vatDebtCents:0,loanDebtCents:0,cryptoCostCents:0,securitiesCostCents:0}});
      }
      try {
        const result = applyKqOperationsRequest(state,{path:url.pathname+url.search,method,body});
        state = result.state;
        return Response.json(result.payload);
      } catch(error) { return Response.json({error:error.message},{status:400}); }
    };
    const api = createKqTutorialApi(request);
    window.__refreshCommerce = () => api.notify('kq:storage-updated');
    function App() {
      const [pole,setPole] = React.useState('accounting');
      return <KqTutorialApiProvider api={api}>{params.has('finance') ? <KqTreasuryDesk key={pole} initialPole={pole} onPoleChange={setPole} onOpenShop={()=>{}} /> : <KqMarketHub initialFlowerId={params.has('flower') ? params.get('flower')==='missing' ? 'missing' : flowerId : undefined} onOpenShop={()=>{}} />}</KqTutorialApiProvider>;
    }
    createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>'/arene/placard';export const useSearchParams=()=>new URLSearchParams(location.search);`,
};
const server = await createServer({root, configFile:false, envDir:false, cacheDir:resolve(output,'vite-cache'), publicDir:resolve(root,'public'),
  optimizeDeps:{include:['react','react-dom','react-dom/client','lucide-react']},resolve:{alias:{'@':resolve(root,'src')},dedupe:['react','react-dom']},
  css:{postcss:{plugins:[tailwindcss({base:root})]}},plugins:[{name:'commerce-clarity',enforce:'pre',resolveId(id){if(id in modules)return '\0'+id;},
    async load(id){if(id.startsWith('\0')&&modules[id.slice(1)])return(await transformWithOxc(modules[id.slice(1)],id+'.tsx',{lang:'tsx',jsx:{runtime:'automatic'}})).code;},
    configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commerce local</title><style>:root{--font-display:Impact;--font-body:Arial;--font-sans:Arial}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>');});}}],
  server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}});
let browser;
const errors=[], results=[];
try {
  await mkdir(output,{recursive:true});await server.listen();
  browser=await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());if(url.origin===origin||url.protocol==='data:')void request.continue();else void request.abort();});
  const click=async(label)=>{
    const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button,summary')].find(element=>element.getClientRects().length&&element.textContent.trim().startsWith(text)),label);
    const element=handle.asElement();assert(element,`Missing control: ${label}`);await element.scrollIntoView();await element.click();await handle.dispose();
  };
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Page fits viewport');
  const shot=async(name)=>{await page.evaluate(async()=>{await Promise.allSettled(document.getAnimations().filter(item=>item.effect?.getComputedTiming().iterations!==Infinity).map(item=>item.finished));});await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});};
  for(const width of [320,390,900,1440]) {
    await page.setViewport({width,height:900,isMobile:width<700,hasTouch:width<700});
    await page.goto(origin+'/?flower=selected',{waitUntil:'networkidle0'});
    await page.waitForFunction(()=>document.querySelector('#commerce-step-title')?.textContent==='Préparer ma récolte');
    assert.equal(await page.evaluate(()=>window.__actions.length),0,'Opening a harvest never prepares or sells it');
    await noOverflow();await shot('preparation-'+width);
    await click('Préparer les fleurs et continuer');await page.waitForSelector('dialog[open]');
    await click('Confirmer');await page.waitForSelector('[aria-label="Circuits de vente"]');
    assert.equal(await page.$$eval('[aria-label="Circuits de vente"] > button',items=>items.length),3);
    await noOverflow();await shot('circuits-'+width);
    await page.click('[aria-label="Voir l’offre Grossistes"]');
    await click('Vendre ce lot');await page.waitForSelector('dialog[open]');
    assert(await page.$eval('dialog[open]',element=>element.textContent.includes('Versé au portefeuille')),'Net payout visible before committing');
    await click('Confirmer');await page.waitForFunction(()=>document.querySelector('#commerce-step-title')?.textContent==='Vente terminée');
    assert.deepEqual(await page.evaluate(()=>window.__actions.map(action=>action.action)),['prepare','quote','sell']);
    await noOverflow();
    await click('Ma boutique');await page.waitForSelector('[aria-label="Développer ma boutique en ligne"]');
    assert.equal(await page.$$eval('[aria-label="Développer ma boutique en ligne"] > details[open]',items=>items.length),0,'Optional business sections start collapsed');
    await noOverflow();await shot('boutique-'+width);
    await click('Améliorer et gérer mon site');
    assert(await page.evaluate(()=>document.body.innerText.includes('2,5 %')),'Fees remain visible before paid upgrades');
    await click('Mes ventes');await page.waitForSelector('[aria-label="Mes ventes en ligne"]');
    await noOverflow();
    await page.goto(origin+'/?finance',{waitUntil:'networkidle0'});
    await page.waitForSelector('[aria-label="Factures à régler"]');
    assert.equal(await page.$('#treasury-dossier'),null,'Accounting details do not compete with invoices');
    assert(await page.evaluate(()=>document.body.textContent.includes('Trésorerie disponible')));
    await noOverflow();await shot('finances-'+width);
    await click('Comptabilité détaillée');await page.waitForSelector('#treasury-dossier');
    await page.select('#treasury-dossier','accounts');await page.waitForSelector('[aria-label="Compte de résultat"]');
    await noOverflow();
    results.push({width,harvestLink:true,prepareQuoteSell:true,progressiveBusiness:true,financeDetails:true});
  }
  await page.goto(origin+'/?flower=selected&prepared',{waitUntil:'networkidle0'});
  await page.waitForSelector('[aria-label="Circuits de vente"]');
  assert.equal(await page.evaluate(()=>window.__actions.length),0,'Prepared harvest links select its existing stock');
  await click('← Retour aux lots');await page.waitForSelector('[aria-label="Tes lots"]');
  await page.evaluate(()=>window.__refreshCommerce());
  await page.waitForFunction(()=>Boolean(document.querySelector('[aria-label="Tes lots"]')));
  assert.equal(await page.$('[aria-label="Circuits de vente"]'),null,'Refresh preserves manual navigation');
  await page.goto(origin+'/?flower=missing',{waitUntil:'networkidle0'});
  await page.waitForSelector('[aria-label="Tes lots"]');
  assert(await page.evaluate(()=>document.body.innerText.includes('Cette récolte n’est plus disponible')));
  assert.equal(await page.evaluate(()=>window.__actions.length),0);
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'report.json'),JSON.stringify({passed:true,results,preparedLink:true,missingLink:true,refreshPreservesSelection:true,errors},null,2));
  console.log(JSON.stringify({passed:true,results,output}));
} finally { await browser?.close();await server.close(); }
