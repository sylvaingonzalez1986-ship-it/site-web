/** Real shop navigation and activity with an in-memory API. --preview keeps the local demo open. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd(), output = resolve(root, 'output/shop-navigation');
const port = Number(process.env.KQ_SHOP_ACTIVITY_PORT ?? 3402), origin = `http://127.0.0.1:${port}`;
const preview = process.argv.includes('--preview');
const modules = {
  entry: `import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KqMarketHub} from '/src/components/placard/KqMarketHub';
import {KqTreasuryManagement} from '/src/components/placard/KqTreasuryManagement';
import {KqTutorialApiProvider,createKqTutorialApi} from '/src/components/placard/KqTutorialApiContext';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
import {KQ_ONLINE_SITE_TIERS} from '/src/lib/kanab-quest-online';
import {KQ_MERCH_PRODUCTS} from '/src/lib/kanab-quest-merch';
import {getKqShopActivity} from '/src/lib/kanab-quest-shop-activity';
let state=createKqOperationsLesson('market');
const execute=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;return result.payload};
const command=(command,payload)=>execute({action:'online',command,payload});
const raw=getKqOperationsCommerce(state).rawLots[0];
execute({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
const source=state.trial.commerce.stocks[0],packets=Math.min(24,Math.floor(source.initialUnits/50));
command('buy-packaging',{code:'kraft-5',quantity:packets});
command('create-listing',{stockId:source.id,formatGrams:5,packagingCode:'kraft-5',packets,packetPriceCents:913});
const baseline=structuredClone(state);
const options=[['mixed','Fleurs et merch'],['merch','Merch uniquement'],['flowers','Fleurs uniquement'],['legacy','Suivi merch indisponible'],['empty','Deux rayons vides'],['paused','Collection hors vitrine'],['suspended','Hébergement suspendu'],['sold-out','Collection épuisée'],['recent','Ventes récentes des deux rayons'],['missing-inventory','Inventaire temporairement indisponible'],['missing-quantity','Quantité temporairement indisponible'],['legacy-domicile','Ancienne échéance de domiciliation']];
function makeScenario(name){
 state=structuredClone(baseline);const c=state.trial.commerce,o=c.online;
 c.cashCents=10000000;c.clients=100;c.reputation=60;
 o.stats.orders=500;o.confidence=95;o.followers=400;o.upgrades.photography=true;o.upgrades.branding=true;o.site.maxLevel=6;
 const tier=KQ_ONLINE_SITE_TIERS.find(row=>row.code==='flagship');
 Object.assign(o.site,{tier:tier.code,active:true,paidUntil:new Date(state.trial.clock+240*3600000).toISOString()});
 Object.assign(c.business.shop,{name:'L’atelier des Chanvriers',tier:tier.code,active:true,monthlyCents:tier.monthlyCents,paidUntil:o.site.paidUntil});
 if(!['flowers','legacy','empty'].includes(name)){
  for(const code of ['paper','textile','objects'])command('buy-merch-module',{code});
  for(const [code,quantity] of [['stickers',12],['mug',8],['tshirt',5]]){
   command('buy-merch-stock',{code,quantity});
   command('update-merch',{code,priceCents:KQ_MERCH_PRODUCTS.find(item=>item.code===code).referencePriceCents,active:true});
  }
 }
 const current=state.trial.commerce,online=current.online;
 // Unlock requirements above are fixture setup, never invented receipts or orders.
 online.stats.orders=0;online.stats.revenueCents=0;online.stats.netRevenueCents=0;online.recentSales=[];
 if(['merch','empty','paused','sold-out'].includes(name)){online.listings=[];current.stocks=[]}
 if(name==='legacy')delete online.merch;
 if(name==='missing-inventory'){delete online.merch.inventory;online.listings=[];current.stocks=[]}
 if(name==='missing-quantity'){delete online.merch.inventory[0].quantity;online.listings=[];current.stocks=[]}
 if(name==='paused')for(const row of online.merch.inventory)row.active=false;
 if(name==='suspended'){online.site.active=false;current.business.shop.active=false}
 if(name==='legacy-domicile')current.business.domiciliation={mode:'external',active:true,renew:true,paidUntil:new Date(state.trial.clock+20*3600000).toISOString()};
 if(name==='recent')command('advance-online-time',{hours:6});
 if(name==='sold-out')for(let day=0;day<7&&state.trial.commerce.online.merch.inventory.some(row=>row.quantity>0);day++)command('advance-online-time',{hours:24});
}
makeScenario('mixed');
window.requests=[];window.navigation=[];window.rejectRename=false;
window.fixture=()=>structuredClone(getKqOperationsCommerce(state));
window.activity=()=>structuredClone(getKqShopActivity(getKqOperationsCommerce(state)));
const api=createKqTutorialApi(async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),method=init.method??'GET';
 if(url.origin!==location.origin||!['/api/arena/placard/commerce','/api/arena/placard/commerce/sales','/api/arena/placard/energy'].includes(url.pathname))throw new Error('Unsupported isolated API: '+url.pathname);
 const body=init.body?JSON.parse(init.body):undefined;window.requests.push({path:url.pathname+url.search,method,body});
 if(body?.action==='rename-shop'){await new Promise(done=>setTimeout(done,180));if(window.rejectRename)return new Response(JSON.stringify({error:'Renommage refusé dans cette simulation. Aucun changement.'}),{status:400,headers:{'Content-Type':'application/json'}})}
 try{const result=applyKqOperationsRequest(state,{path:url.pathname+url.search,method,body});state=result.state;return new Response(JSON.stringify(result.payload),{status:200,headers:{'Content-Type':'application/json'}})}
 catch(error){return new Response(JSON.stringify({error:error.message}),{status:400,headers:{'Content-Type':'application/json'}})}
});
function App(){
 const[scenario,setScenario]=useState('mixed'),[epoch,setEpoch]=useState(0),[section,setSection]=useState(${preview}?'management':'overview'),[frame,setFrame]=useState('market'),[initial,setInitial]=useState(null);
 useEffect(()=>{if(!${preview})return;const show=()=>{const target=document.querySelector('[data-shop-view="merch"]');if(!target)return false;target.click();return true};if(show())return;const observer=new MutationObserver(()=>{if(show())observer.disconnect()});observer.observe(document.getElementById('root'),{subtree:true,childList:true});return()=>observer.disconnect()},[]);
 window.setScenario=name=>{makeScenario(name);window.requests=[];window.navigation=[];window.rejectRename=false;setScenario(name);setSection('overview');setFrame('market');setInitial(null);setEpoch(value=>value+1)};
 window.mountLegacy=(initialView,initialUpgradeView)=>{setInitial({initialView,initialUpgradeView});setFrame('initial');setEpoch(value=>value+1)};
 window.showFinance=()=>setFrame('finances');
 const navigate=next=>{window.navigation.push(next);setSection(next)};
 return <KqTutorialApiProvider api={api}><aside className="fixture-tools" aria-label="Outils de démonstration"><strong>Démo locale · les espaces de ta boutique</strong><p>Données fictives en mémoire. Parcours réels, aucun compte modifié et aucune connexion distante.</p><label>Scénario <select data-fixture-scenario value={scenario} onChange={event=>window.setScenario(event.target.value)}>{options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={()=>window.setScenario(scenario)}>Réinitialiser</button><button type="button" onClick={()=>setFrame(frame==='market'?'finances':'market')}>{frame==='market'?'Voir les finances':'Revenir à la boutique'}</button></aside><div className="audit-surface" data-fixture-section={section} data-fixture-frame={frame} data-fixture-epoch={epoch}>{frame==='market'?<KqMarketHub key={epoch} section={section} onSectionChange={navigate} onOpenShop={()=>window.navigation.push('equipment')} onOpenTreasury={()=>{window.navigation.push('treasury');setFrame('finances')}} onOpenStorage={()=>window.navigation.push('storage')} onOpenCulture={()=>window.navigation.push('culture')}/>:<KqTreasuryManagement key={frame+epoch} section={frame==='finances'?'invoices':'management'} {...(initial??{})} onOpenShop={()=>window.navigation.push('equipment')}/>}</div></KqTutorialApiProvider>;
}
createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const previousHarness = await readFile(resolve(root, 'scripts/audit-placard-online-progression.mjs'), 'utf8');
const html = previousHarness.match(/const html = `([\s\S]*?)`;\r?\nconst server/)[1].replace('<head>', '<head><link rel="icon" href="data:,">');
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  plugins: [{ name: 'isolated-shop-activity', enforce: 'pre', resolveId(id) { if (id in modules) return '\0' + id; }, async load(id) { if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code; }, configureServer(vite) { vite.middlewares.use((request, response, next) => { if (request.url?.startsWith('/api/')) { response.statusCode = 403; response.end('Real API disabled'); return; } if (request.url !== '/') return next(); response.setHeader('Content-Type', 'text/html'); response.end(html); }); } }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});
const checks = [], errors = [], forbidden = [], failedResponses = [], measures = [];
let browser, page;
await mkdir(output, { recursive: true });
await server.listen();
if (preview) {
  console.log(`Isolated shop activity demo: ${origin} (PID ${process.pid}). No remote account or persistent data.`);
  await new Promise(resolveStop => { const stop = () => { void server.close().then(resolveStop); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); });
} else try {
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
  await page.setRequestInterception(true);
  page.on('request', request => { const url = request.url(); if ((url.startsWith(origin + '/') && !url.includes('/api/')) || url.startsWith('data:')) void request.continue(); else { forbidden.push(url); void request.abort(); } });
  await page.setViewport({ width: 1440, height: 1000 }); await page.goto(origin, { waitUntil: 'networkidle0', timeout: 60000 }); await page.evaluate(() => document.fonts.ready);
  const click = async (label, scope = 'body') => { const handle = await page.waitForFunction((label, scope) => [...document.querySelectorAll(scope + ' button')].find(node => node.textContent.trim() === label && !node.disabled && node.getBoundingClientRect().height > 0), {}, label, scope); await handle.asElement().click(); await handle.dispose(); };
  const waitOverview = () => page.waitForSelector('[data-shop-overview] [data-merch-activity]', { visible: true });
  const snapshot = () => page.evaluate(() => window.fixture());
  const reset = async name => { const epoch = await page.$eval('[data-fixture-epoch]', node => Number(node.dataset.fixtureEpoch)); await page.evaluate(name => window.setScenario(name), name); await page.waitForFunction(epoch => Number(document.querySelector('[data-fixture-epoch]')?.dataset.fixtureEpoch) > epoch, {}, epoch); await waitOverview(); };
  const overflow = async label => { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': no horizontal overflow'); assert.doesNotMatch(await page.$eval('.audit-surface', node => node.innerText), /NaN|undefined|Infinity/); };
  const openSection = async label => { const visible = await page.$eval('[role="tablist"][aria-label="Ma boutique"]', node => node.getBoundingClientRect().height > 0); if (!visible) await click('Rubriques'); await click(label, '[role="tablist"][aria-label="Ma boutique"]'); };
  const openActivity = async () => { await openSection('Développer ma boutique'); await page.waitForSelector('[data-shop-activity]', { visible: true }); };
  const selectView = async code => { await page.click('[data-shop-view="' + code + '"]'); await page.waitForFunction(code => document.querySelector('[data-shop-view="' + code + '"]')?.getAttribute('aria-selected') === 'true', {}, code); };
  const activeView = () => page.$eval('[aria-label="Gérer ma boutique"] [aria-selected="true"]', node => node.dataset.shopView);
  const showMerchLedger = async () => { await openSection('Mes ventes'); await page.waitForSelector('[aria-label="Choisir un rayon"]', { visible: true }); await page.click('[aria-label="Choisir un rayon"] button:nth-child(2)'); };
  const visibleMerch = async () => { const handle = await page.waitForFunction(() => [...document.querySelectorAll('[data-merch-activity]')].find(node => node.getBoundingClientRect().height > 0)); return handle.asElement(); };
  const checkMerch = async label => {
    const data = await snapshot(), merch = data.online.merch, node = await visibleMerch();
    if (!merch) { assert.match(await node.evaluate(node => node.innerText), /indisponible/i); assert.equal(await node.$$eval('dl dd', nodes => nodes.length), 0, label + ': missing data is not zero'); return; }
    const actual = await node.$$eval('dl dd', nodes => nodes.map(node => node.textContent.trim()));
    const number = value => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    const inventory = merch.inventory ?? [], quantityKnown = Boolean(merch.inventory) && inventory.every(row => Number.isSafeInteger(row.quantity));
    const activeUnits = quantityKnown ? inventory.filter(row => row.active && row.quantity > 0).reduce((sum, row) => sum + row.quantity, 0) : null;
    assert.equal(actual[0], activeUnits === null ? '—' : number(activeUnits), label + ': active article count'); assert.equal(actual[1], number(merch.stats.unitsSold), label + ': actual article sales');
    assert.equal(Number(actual[2].replace(/[^\d,-]/g, '').replace(',', '.')), merch.stats.netRevenueCents / 100, label + ': actual net payment');
    const rows = await node.$$eval('[data-merch-code]', nodes => nodes.map(node => ({ code: node.dataset.merchCode, status: node.dataset.status, text: node.innerText })));
    assert.equal(rows.length, inventory.length, label + ': all product references visible');
    for (const item of inventory) { const row = rows.find(row => row.code === item.code); assert.ok(row, item.code); if (item.quantity !== undefined) assert.match(row.text, new RegExp(item.quantity + ' en stock')); assert.equal(row.status, item.quantity === undefined ? 'unknown' : item.quantity === 0 ? 'sold-out' : item.active ? 'active' : 'paused'); }
    await node.dispose();
  };
  const checkNavigation = async originLabel => {
    const before = await snapshot(), node = await visibleMerch(), button = await node.$('[data-open-merch]');
    await button.focus(); await page.keyboard.press('Enter'); await page.waitForSelector('[data-merch-workshop]', { visible: true });
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-shop-view') === 'merch');
    assert.equal(await activeView(), 'merch');
    await selectView('activity'); await page.waitForSelector('[data-shop-activity]', { visible: true });
    await selectView('pricing'); assert.equal(await activeView(), 'pricing');
    await click('Vue d’ensemble', '[role="tabpanel"]'); await waitOverview();
    assert.deepEqual(await snapshot(), before, originLabel + ': navigation must not change the game');
    assert.ok((await page.evaluate(() => window.requests)).every(request => request.method === 'GET'), 'Navigation must not submit commands');
    checks.push(originLabel + ': keyboard CTA opens Merch with visible focus; Activity/Prices and return remain free, with no mutation');
  };
  await waitOverview();
  for (const width of [1440, 320]) {
    await page.setViewport({ width, height: 1000 });
    for (const scenario of ['merch', 'flowers', 'mixed', 'legacy', 'empty', 'paused', 'suspended', 'sold-out', 'recent', 'missing-inventory', 'missing-quantity']) {
      await reset(scenario); const before = await snapshot();
      await checkMerch(scenario + '/overview'); await overflow(scenario + '/overview/' + width);
      const flowersInRayon = before.online.listings.filter(row => row.status === 'active' && row.qualityScore >= 5.8 && row.remainingPackets > 0).reduce((sum, row) => sum + row.remainingPackets, 0);
      const displayedPackets = await page.$$eval('[aria-label="Les chiffres de ma boutique"] button', nodes => nodes.find(node => node.textContent.includes('Paquets en rayon'))?.querySelector('strong')?.textContent);
      assert.equal(displayedPackets, flowersInRayon.toLocaleString('fr-FR'), 'Flower packet count excludes every merch article');
      if (scenario === 'recent') await page.screenshot({ path: resolve(output, 'overview-recent-' + width + '.png'), fullPage: true });
      if (scenario === 'merch') { assert.equal(before.online.listings.length, 0); assert.equal(before.online.stats.orders, 0); assert.match(await page.$eval('[data-shop-overview] h2', node => node.innerText), /collection/i); }
      if (scenario === 'sold-out') { assert.ok(before.online.merch.inventory.every(row => row.quantity === 0)); assert.equal(before.online.merch.stats.unitsSold, 25); assert.equal(before.online.stats.orders, 0); }
      if (scenario === 'recent') { assert.ok(before.online.recentSales.length > 0); assert.ok(before.online.merch.recentSales.length > 0); }
      await openActivity(); await checkMerch(scenario + '/activity'); await overflow(scenario + '/activity/' + width);
      if (scenario === 'recent') {
        const cta = await page.$('[aria-label="Pilotage de la boutique"] [data-running] button');
        await cta.evaluate(node => node.scrollIntoView({ block: 'center' }));
        const covered = await cta.evaluate(node => { const bounds = node.getBoundingClientRect(); return [.15, .5, .85].some(fraction => !node.contains(document.elementFromPoint(bounds.left + bounds.width * fraction, bounds.top + bounds.height / 2))); });
        assert.equal(covered, false, 'The main sales CTA must not be covered by the Photo/Brand/Stories equipment');
      }
      if (scenario === 'merch') assert.doesNotMatch(await page.$eval('[data-shop-activity] h3', node => node.innerText), /Prépare ton/i);
      if (scenario === 'suspended') { const node = await visibleMerch(); assert.match(await node.evaluate(node => node.innerText), /ventes suspendues/i); assert.equal((await page.evaluate(() => window.activity())).merch.estimatedUnitsPerDay, 0); }
      if (['recent', 'merch'].includes(scenario)) {
        measures.push({ scenario, width, height: await page.$eval('[data-shop-activity]', node => Math.round(node.getBoundingClientRect().height)) });
        await page.screenshot({ path: resolve(output, 'activity-' + scenario + '-' + width + '.png'), fullPage: true });
        await (await visibleMerch()).screenshot({ path: resolve(output, 'merch-' + scenario + '-' + width + '.png') });
      }
      if (['recent', 'merch', 'legacy', 'missing-inventory', 'missing-quantity'].includes(scenario)) {
        await openSection('Mes ventes'); await page.waitForSelector('[aria-label="Choisir un rayon"]', { visible: true });
        if (scenario === 'merch') assert.equal(await page.$eval('[aria-label="Choisir un rayon"] button:nth-child(2)', node => node.getAttribute('aria-pressed')), 'true', 'Merch-only inventory opens the merch register');
        await page.click('[aria-label="Choisir un rayon"] button:nth-child(2)'); await checkMerch(scenario + '/ledger'); await overflow(scenario + '/ledger/' + width);
        if (scenario === 'recent') {
          await page.focus('[data-online-sales-journal] summary'); await page.keyboard.press('Enter');
          await page.waitForSelector('[data-online-sale]');
          for (let pageNumber = 0; await page.$('[data-online-sales-more]:not(:disabled)'); pageNumber++) {
            assert.ok(pageNumber < 20, 'Sales pagination terminates');
            const beforeCount = await page.$$eval('[data-online-sale]', nodes => nodes.length);
            await page.click('[data-online-sales-more]');
            await page.waitForFunction(count => document.querySelectorAll('[data-online-sale]').length > count, {}, beforeCount);
          }
          const rows = await page.$$eval('[data-online-sale]', nodes => nodes.map(node => node.innerText));
          const receipts = (await page.evaluate(() => window.activity())).receipts;
          assert.equal(rows.length, before.online.recentSales.length + before.online.merch.recentSales.length, 'Every displayed receipt comes from an actual flower or merch sale');
          for (const [index, receipt] of receipts.entries()) {
            const unit = receipt.quantity === 1 ? receipt.unitLabel.replace(/s$/, '') : receipt.unitLabel;
            assert.ok(rows[index].includes(receipt.name + ' · ' + receipt.quantity + ' ' + unit), 'Receipt order, source and units');
            assert.match(rows[index], /Frais du site/);
            assert.match(rows[index], receipt.kind === 'flower' ? /Satisfaction.*Emballages déjà payés/ : /Fabrication déjà payée/);
          }
        }
        if (scenario !== 'legacy') await page.screenshot({ path: resolve(output, 'ledger-' + scenario + '-' + width + '.png'), fullPage: true });
        await page.focus('[aria-label="Choisir un rayon"] button:first-child'); await page.keyboard.press('Enter'); await page.waitForSelector('[data-online-listings-heading]', { visible: true });
        assert.equal(await page.$eval('[aria-label="Choisir un rayon"] button:first-child', node => node.getAttribute('aria-pressed')), 'true');
        assert.equal(await page.$eval('[aria-label="Résultats depuis l’ouverture"] dd', node => node.textContent), before.online.stats.orders.toLocaleString('fr-FR'), 'Flower-order totals never include merch articles');
      }
      if (scenario.startsWith('missing-')) {
        await page.click('[aria-label="Choisir un rayon"] button:nth-child(2)');
        await (await (await visibleMerch()).$('[data-open-merch]')).click(); await page.waitForSelector('[data-merch-workshop]', { visible: true });
        assert.equal(await page.$eval('[data-merch-buy-stock]', node => node.disabled), true, 'Unknown stock blocks manufacturing until refreshed');
        assert.equal(await page.$eval('[data-merch-save]', node => node.disabled), true, 'Unknown stock blocks publication');
        assert.match(await page.$eval('[data-merch-workshop]', node => node.innerText), /indisponible/i); await overflow(scenario + '/workshop/' + width);
        await selectView('brand'); await page.waitForSelector('[data-brand-studio]', { visible: true }); await overflow(scenario + '/studio/' + width);
      }
      assert.deepEqual(await snapshot(), before, scenario + ': browsing preserves stock, cash and receipts');
      checks.push(scenario + ': overview and activity at ' + width + ' px preserve separate actual flower/merch counters and correct stock statuses');
    }
    await reset('mixed'); await checkNavigation('Overview/' + width);
    await openActivity(); await checkNavigation('Activity/' + width);
    await showMerchLedger(); await checkMerch('sales register'); await overflow('sales register/' + width); await checkNavigation('Sales register/' + width);
    await openActivity(); assert.equal(await activeView(), 'activity', 'Normal management entry resets to activity after the merch shortcut');
    const codes = ['activity', 'pricing', 'merch', 'marketing', 'site', 'brand'];
    const tabs = await page.$$eval('[aria-label="Gérer ma boutique"] [data-shop-view]', nodes => nodes.map(node => { const bounds = node.getBoundingClientRect(); return { code: node.dataset.shopView, text: node.innerText, left: Math.round(bounds.left), right: Math.round(bounds.right), top: Math.round(bounds.top), width: bounds.width, height: bounds.height }; }));
    assert.deepEqual(tabs.map(tab => tab.code), codes); assert.ok(tabs.every(tab => tab.width > 0 && tab.height >= 44));
    assert.ok(tabs.every(tab => tab.left >= 0 && tab.right <= width), 'All six main tabs are visible without horizontal scrolling');
    const clippedLabels = await page.$$eval('[aria-label="Gérer ma boutique"] [data-shop-view]', nodes => nodes.filter(node => { const bounds = node.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node.querySelector('strong')); return [...range.getClientRects()].some(rect => rect.left < bounds.left || rect.right > bounds.right); }).map(node => node.dataset.shopView));
    assert.deepEqual(clippedLabels, [], 'Tab labels fit inside their own button without covering the next destination');
    if (width === 320) { assert.equal(new Set(tabs.map(tab => tab.top)).size, 2, 'Mobile navigation has two rows'); assert.equal(new Set(tabs.map(tab => tab.left)).size, 3, 'Mobile navigation has three columns'); }
    for (const code of codes) { await selectView(code); await overflow('main navigation/' + code + '/' + width); assert.doesNotMatch(await page.$eval('.audit-surface', node => node.innerText), /L’adresse de mon commerce|Choisir mon domicile|Adresse extérieure|risque ×2/i); }
    assert.equal(await page.$$eval('[aria-label="Choisir les améliorations"]', nodes => nodes.length), 0, 'No redundant upgrades sub-navigation');
    await page.focus('[data-shop-view="activity"]'); await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => document.activeElement.dataset.shopView), 'pricing');
    await page.keyboard.press('End'); assert.equal(await page.evaluate(() => document.activeElement.dataset.shopView), 'brand'); await page.keyboard.press('Home'); assert.equal(await page.evaluate(() => document.activeElement.dataset.shopView), 'activity');
    await selectView('merch'); await page.screenshot({ path: resolve(output, 'navigation-merch-' + width + '.png'), fullPage: true });
    await (await page.$('[aria-label="Gérer ma boutique"]')).screenshot({ path: resolve(output, 'navigation-tabs-' + width + '.png') });
    await click('Agrandir avec le site', '[data-merch-workshop]'); await page.waitForSelector('[data-online-progression]', { visible: true });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.shopView), 'site');
    await selectView('brand'); await page.click('[data-studio-track="branding"]'); await click('Décliner la marque en merch', '[data-brand-studio]'); await page.waitForSelector('[data-merch-workshop]', { visible: true });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.shopView), 'merch');
    checks.push('Six direct tabs are visible, address controls absent, keyboard arrows/Home/End work at ' + width + ' px');
  }
  await reset('recent'); await openActivity(); await selectView('merch');
  const identity = '[data-shop-identity]';
  const showIdentity = async () => {
    await page.waitForSelector(identity);
    const summary = await page.$eval(identity, node => { const details = node.closest('details'); if (!details || details.open) return false; return true; });
    if (summary) { const handle = await page.evaluateHandle(selector => document.querySelector(selector).closest('details').querySelector('summary'), identity); await handle.asElement().focus(); await page.keyboard.press('Enter'); await handle.dispose(); }
    await page.waitForSelector(identity + ' input', { visible: true });
  };
  const renameValue = async value => { await showIdentity(); await page.click(identity + ' input', { clickCount: 3 }); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.type(identity + ' input', value); };
  await showIdentity(); const beforeRename = await snapshot();
  for (const invalid of ['ab', '<marque>', 'a'.repeat(41)]) { await renameValue(invalid); assert.equal(await page.$eval(identity + ' button', node => node.disabled), true, 'Invalid shop names cannot be submitted'); }
  await renameValue('Les Chanvriers du Port'); await click('Enregistrer le nom', identity); await page.waitForSelector('dialog[open]');
  assert.match(await page.$eval('dialog[open]', node => node.innerText), /Aucun débit immédiat|Gratuit/i); assert.deepEqual(await snapshot(), beforeRename);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); assert.deepEqual(await snapshot(), beforeRename);
  assert.ok((await page.evaluate(() => window.requests)).every(request => request.method === 'GET'), 'Canceling a rename submits nothing');
  await renameValue('  Les   Chanvriers du Port  '); await click('Enregistrer le nom', identity); await page.waitForSelector('dialog[open]');
  assert.match(await page.$eval('dialog[open]', node => node.innerText), /Les Chanvriers du Port/);
  const confirm = await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] button')].find(node => node.textContent.trim() === 'Confirmer'));
  await confirm.asElement().click({ clickCount: 2, delay: 20 }); await confirm.dispose();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForFunction(() => document.querySelector('[aria-label="Développer ma boutique en ligne"] h2')?.textContent === 'Les Chanvriers du Port');
  const renamed = await snapshot(), posts = await page.evaluate(() => window.requests.filter(request => request.method === 'POST'));
  assert.equal(posts.length, 1, 'Double confirmation sends one rename command'); assert.equal(posts[0].body.action, 'rename-shop'); assert.equal(posts[0].body.name, 'Les Chanvriers du Port');
  assert.equal(renamed.cashCents, beforeRename.cashCents); assert.deepEqual(renamed.online, beforeRename.online); assert.deepEqual(renamed.stocks, beforeRename.stocks);
  assert.deepEqual({ ...renamed.business.shop, name: '' }, { ...beforeRename.business.shop, name: '' });
  await selectView('brand'); await page.waitForSelector('[data-brand-studio]', { visible: true }); assert.match(await page.$eval('[data-studio-preview]', node => node.innerText), /Les Chanvriers du Port/);
  await click('Vue d’ensemble', '[role="tabpanel"]'); await waitOverview(); assert.match(await page.$eval('[data-shop-overview]', node => node.innerText), /Les Chanvriers du Port/);
  checks.push('Merch name validates 3–40 characters, cancels without mutation, normalizes spaces, confirms once for free and propagates to Studio and Overview');
  await openActivity(); await selectView('merch'); await renameValue('Atelier du refus'); await page.evaluate(() => { window.rejectRename = true; });
  const beforeRefusal = await snapshot(); await click('Enregistrer le nom', identity); await page.waitForSelector('dialog[open]'); await click('Confirmer', 'dialog[open]'); await page.waitForSelector('dialog[open] [role="alert"]');
  assert.match(await page.$eval('dialog[open] [role="alert"]', node => node.innerText), /Renommage refusé/); assert.deepEqual(await snapshot(), beforeRefusal); await click('Revenir', 'dialog[open]');
  await page.evaluate(() => { window.rejectRename = false; });
  checks.push('A refused rename leaves the current name, funds and sales intact with a visible error');
  for (const target of ['merch', 'site', 'brand']) {
    await page.evaluate(target => window.mountLegacy('upgrades', target), target); await page.waitForSelector('[data-shop-view="' + target + '"]', { visible: true });
    await page.waitForFunction(target => document.querySelector('[data-shop-view="' + target + '"]')?.getAttribute('aria-selected') === 'true', {}, target);
    await overflow('legacy initial view/' + target);
  }
  checks.push('Old upgrades/merch, upgrades/site and upgrades/brand entry contracts map to the matching direct tab');
  for (const width of [1440, 320]) {
    await page.setViewport({ width, height: 1000 }); await reset('mixed'); await page.evaluate(() => window.showFinance()); await page.waitForSelector('[aria-label="Échéances des abonnements"]', { visible: true });
    assert.doesNotMatch(await page.$eval('[aria-label="Factures et échéances"]', node => node.innerText), /domicili|adresse extérieure|à domicile/i); await overflow('new finances/' + width);
    await reset('legacy-domicile'); const legacy = await snapshot(); await page.evaluate(() => window.showFinance()); await page.waitForSelector('[aria-label="Échéances des abonnements"]', { visible: true });
    const domicile = await page.$$eval('[aria-label="Échéances des abonnements"] dl > div', nodes => nodes.find(node => /domicili/i.test(node.innerText))?.innerText);
    assert.ok(domicile, 'An old active subscription must remain visible until the database migration'); assert.match(domicile, /50\s*€/); assert.match(domicile, /renouvellement/i);
    const dueLabel = await page.evaluate(value => new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), legacy.business.domiciliation.paidUntil);
    assert.ok(domicile.includes(dueLabel), 'The historical subscription keeps its actual due date visible');
    assert.doesNotMatch(await page.$eval('[aria-label="Factures et échéances"]', node => node.innerText), /Choisir mon domicile|Choisir une adresse|risque ×2/i); await overflow('legacy finances/' + width);
    await page.screenshot({ path: resolve(output, 'legacy-finances-' + width + '.png'), fullPage: true });
    assert.deepEqual(await snapshot(), legacy, 'Reading the legacy deadline must not renew or charge it');
  }
  checks.push('New finances omit domiciliation; an old active subscription still shows its actual 50 € renewal and due date at desktop/mobile without a debit');
  await reset('recent'); await page.setViewport({ width: 1440, height: 1000 }); await page.screenshot({ path: resolve(output, 'overview-recent-1440.png'), fullPage: true });
  const expected = (await page.evaluate(() => window.activity())).receipts.slice(0, 3);
  const receipts = await page.$$eval('[data-shop-overview] section', nodes => { const section = nodes.find(node => node.querySelector('h2')?.textContent === 'Dernières ventes'); return [...section.querySelectorAll('li')].map(node => node.innerText); });
  assert.equal(receipts.length, expected.length);
  for (const [index, receipt] of expected.entries()) { assert.ok(receipts[index].includes(receipt.name)); assert.ok(receipts[index].includes(receipt.quantity + ' ' + receipt.unitLabel)); }
  checks.push('Overview recent receipts merge actual dated flower and merch sales with correct quantities and units');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await page.evaluate(() => { for (const image of document.images) image.loading = 'eager'; }); await page.waitForFunction(() => [...document.images].every(image => image.complete));
  assert.deepEqual(await page.evaluate(() => [...document.images].filter(image => !image.naturalWidth).map(image => image.src)), []);
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []); assert.deepEqual(failedResponses, []);
  checks.push('Artwork loads, no browser errors and no remote/API network requests');
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: true, checks, measures, errors, forbidden, failedResponses }, null, 2));
  console.log(JSON.stringify({ success: true, checks: checks.length, measures, output }, null, 2));
} catch (error) {
  if (page) await writeFile(resolve(output, 'failure-state.json'), JSON.stringify(await page.evaluate(() => ({ scenario: document.querySelector('[data-fixture-scenario]')?.value, section: document.querySelector('[data-fixture-section]')?.dataset.fixtureSection, focus: document.activeElement?.textContent, requests: window.requests })).catch(() => null), null, 2));
  if (page) await Promise.race([page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {}), new Promise(done => setTimeout(done, 3000))]);
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ success: false, checks, measures, errors, forbidden, failedResponses, failure: String(error) }, null, 2)); throw error;
} finally { if (browser) await browser.close(); await server.close(); }
