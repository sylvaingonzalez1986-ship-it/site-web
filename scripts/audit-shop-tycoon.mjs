/** Real boutique UI and operations simulation, with no live account or external requests. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/shop-tycoon');
const port = 3258;
const captureScreenshots = !process.argv.includes('--no-screenshots');
const modules = {
  entry: `import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KqBusinessPanel} from '/src/components/placard/KqBusinessPanel';
import {createKqOperationsLesson,applyKqOperationsRequest,getKqOperationsCommerce} from '/src/lib/kanab-quest-operations-lesson';
let state=createKqOperationsLesson('market');
const execute=body=>{const result=applyKqOperationsRequest(state,{path:'/api/arena/placard/commerce',method:'POST',body});state=result.state;return result.payload};
const command=(command,payload)=>execute({action:'online',command,payload});
const raw=getKqOperationsCommerce(state).rawLots[0];
execute({action:'prepare',flowerId:raw.flowerId,route:'raw',expectedCostCents:raw.options.find(row=>row.route==='raw').market.processingCostCents});
const source=state.trial.commerce.stocks[0];
const firstUnits=Math.floor(source.initialUnits*.6),secondUnits=source.initialUnits-firstUnits;
state.trial.commerce.stocks=[
  {...source,id:'11111111-1111-4111-8111-111111111111',name:'Brume bretonne · récolte artisanale',initialUnits:firstUnits,remainingUnits:firstUnits,equivalentUnits:firstUnits},
  {...source,id:'22222222-2222-4222-8222-222222222222',name:'La sélection des chanvriers de la côte',initialUnits:secondUnits,remainingUnits:secondUnits,equivalentUnits:secondUnits}
];
state.trial.commerce.business.shop.name='Les Chanvriers Bretons';
state.trial.commerce.clients=0;state.trial.commerce.reputation=0;
const stocks=state.trial.commerce.stocks.map(row=>({...row}));
for(const [index,stock]of stocks.entries()){
 const packets=Math.min(index?16:24,Math.floor(stock.initialUnits/50));
 command('buy-packaging',{code:'kraft-5',quantity:packets});
 command('create-listing',{stockId:stock.id,formatGrams:5,packagingCode:'kraft-5',packets,packetPriceCents:index?1037:913});
}
const listingId=state.trial.commerce.online.listings[0].id;
const introductionBaseline=structuredClone(state);
command('start-marketing',{version:2,code:'introduction',angle:'craft',listingId,budgetCode:'local'});
for(let day=0;day<4;day++)command('advance-online-time',{hours:24});
const plannerBaseline=structuredClone(state);
command('start-marketing',{version:2,code:'behind-scenes',angle:'craft',listingId,budgetCode:'local'});
const baseline=structuredClone(state);
window.requests=[];window.fixture=()=>getKqOperationsCommerce(state);
function App(){
 const[,refresh]=useState(0);const[scenario,setScenario]=useState('active');const[pending,setPending]=useState(null);
 window.setScenario=name=>{state=structuredClone(name==='campaign-planner'?plannerBaseline:name==='introduction-planner'?introductionBaseline:baseline);window.requests=[];setPending(null);window.pendingBody=null;window.pendingCost=null;
  if(name==='empty'){state.trial.commerce.online.listings=[];state.trial.commerce.online.recentSales=[];state.trial.commerce.online.marketing.active=null}
  if(name==='paused'){Object.assign(state.trial.commerce.online.site,{active:false,tier:'improved',paidUntil:new Date(state.trial.clock-3600000).toISOString()});Object.assign(state.trial.commerce.business.shop,{active:false,tier:'improved',monthlyCents:3000})}
  if(name==='legacy-campaign')state.trial.commerce.online.marketing.active={id:'legacy-campaign',code:'behind-scenes',angle:'craft',startedAt:new Date(state.trial.clock).toISOString(),endsAt:new Date(state.trial.clock+48*3600000).toISOString()};
  setScenario(name);refresh(value=>value+1)
 };
 window.advanceMarket=hours=>{while(hours>0){const step=Math.min(24,hours);command('advance-online-time',{hours:step});hours-=step}refresh(value=>value+1)};
 const ask=(title,description,body,cost)=>{window.pendingBody=body;window.pendingCost=cost??0;setPending({title,description,body,cost})};
 const confirm=()=>{window.requests.push(pending.body);execute(pending.body);window.pendingBody=null;setPending(null);refresh(value=>value+1)};
 return <main className="audit-surface"><KqBusinessPanel key={scenario} expanded showAccounting={false} data={getKqOperationsCommerce(state)} busy={scenario==='busy'} now={state.trial.clock} onAsk={ask} onOpenShop={()=>{window.shopOpened=true}} onPrepareStock={()=>{window.lastNavigation='prepare'}} onViewSales={()=>{window.lastNavigation='sales'}}/>
 {pending?<dialog open aria-label="Confirmer la décision"><h2>{pending.title}</h2><p>{pending.description}</p><strong>{(pending.cost??0)/100} € à investir</strong><button onClick={()=>{window.pendingBody=null;setPending(null)}}>Annuler</button><button onClick={confirm}>Confirmer</button></dialog>:null}</main>
}
createRoot(document.getElementById('root')).render(<App/>);`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,...props}){return <a {...props}/>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});`,
};
const documentHtml = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Black.woff2);font-weight:900}
@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2);font-weight:800}
@font-face{font-family:AuditDisplay;src:url(/src/app/fonts/BarlowCondensed-Latin-Bold.woff2);font-weight:700}
@font-face{font-family:AuditBody;src:url(/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2);font-weight:400 700}
:root{--font-display:AuditDisplay;--font-body:AuditBody}*{box-sizing:border-box}body{margin:0;font-family:AuditBody,Arial,sans-serif;background:#fff3db;color:#162e25}.audit-surface{max-width:1160px;margin:24px auto;padding:12px}button,a,select,input{font-family:inherit}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}dialog[open]{position:fixed;z-index:100;inset:20% 12px auto;max-width:480px;background:#fff8e9;border:2px solid #162e25;border-radius:16px;padding:24px;box-shadow:0 0 0 100vmax #162e2588}dialog button{padding:10px 16px;margin-right:8px}
</style></head><body><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></body></html>`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'] },
  plugins: [{
    name: 'shop-tycoon-audit', enforce: 'pre',
    resolveId(id) { if (id in modules) return '\0' + id; },
    async load(id) {
      if (id.startsWith('\0') && modules[id.slice(1)]) {
        return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
      }
    },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url !== '/') return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(documentHtml);
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
});

let browser, page;
const checks = [], errors = [], failedRequests = [], externalRequests = [];
const cockpit = '[aria-label="Pilotage de la boutique"]';
const business = '[aria-label="Développer ma boutique en ligne"]';
const strategy = '[aria-label="Stratégie commerciale"]';
const product = 'select[aria-label="Lot à piloter"]';
const campaignForm = 'form[aria-label="Préparer une campagne"]';
const campaignForecast = '[aria-label="Prévision de campagne"]';
const runningCampaign = '[aria-label="Campagne en cours"]';
const tabs = '[role="tablist"][aria-label="Gérer ma boutique"]';
const sections = ['Activité', 'Prix', 'Communication', 'Améliorations', 'Réglages'];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().startsWith(`http://127.0.0.1:${port}/`) && !request.url().includes('/api/') || request.url().startsWith('data:')) void request.continue();
    else { externalRequests.push(request.url()); void request.abort(); }
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(cockpit);
  const fixture = () => page.evaluate(() => window.fixture());
  const capture = async options => { if (captureScreenshots) await page.screenshot(options); };
  const click = async (text, scope = 'body', exact = true) => {
    const handle = await page.waitForFunction((text, scope, exact) => [...document.querySelectorAll(scope + ' button')].find(button => (exact ? button.textContent.trim() === text || button.querySelector('strong')?.textContent === text : button.textContent.includes(text)) && !button.disabled && button.getBoundingClientRect().height > 0), {}, text, scope, exact);
    await handle.asElement().click(); await handle.dispose();
  };
  const assertTab = async label => {
    await page.waitForFunction((tabs, label) => document.querySelector(tabs + ' [aria-selected="true"]')?.textContent.trim() === label, {}, tabs, label);
    const state = await page.evaluate(tabs => {
      const tab = document.querySelector(tabs + ' [aria-selected="true"]');
      const panels = [...document.querySelectorAll('[role="tabpanel"]')].filter(panel => panel.getBoundingClientRect().height > 0);
      return { visiblePanels: panels.length, selectedPanel: panels[0]?.id, controlledPanel: tab?.getAttribute('aria-controls'), labelledBy: panels[0]?.getAttribute('aria-labelledby'), selectedTab: tab?.id };
    }, tabs);
    assert.equal(state.visiblePanels, 1, label + ' is the only visible panel');
    assert.equal(state.selectedPanel, state.controlledPanel, 'Selected tab controls the visible panel');
    assert.equal(state.labelledBy, state.selectedTab, 'Visible panel has the selected tab as its accessible label');
  };
  const navigate = async label => { await click(label, tabs); await assertTab(label); };
  const clickLink = async suffix => {
    const handle = await page.waitForFunction(suffix => [...document.querySelectorAll('a')].find(link => link.getAttribute('href')?.endsWith(suffix) && link.getBoundingClientRect().height > 0), {}, suffix);
    await handle.asElement().click(); await handle.dispose();
  };
  const reset = async scenario => {
    await page.evaluate(scenario => window.setScenario(scenario), scenario);
    await page.waitForSelector(cockpit);
  };
  const assertNoOverflow = async label => {
    const overflow = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('main *')].filter(node => { const rect = node.getBoundingClientRect(); return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1); }).map(node => ({ tag: node.tagName, text: node.textContent.slice(0, 60), className: node.className })).slice(0, 10) }));
    assert.ok(overflow.pageWidth <= overflow.width, label + ': ' + JSON.stringify(overflow));
  };
  const initial = await fixture();
  assert.ok(initial.online.stats.orders > 0, 'Fixture includes sales generated by actual operations');
  assert.equal(initial.online.listings.filter(row => row.status === 'active' && row.remainingPackets > 0).length, 2);
  assert.equal(initial.online.marketing.active.code, 'behind-scenes');
  assert.equal(initial.online.marketing.active.version, 2);
  assert.equal(initial.online.marketing.version, 2);
  checks.push('real operations fixture includes two stocked listings, settled orders and a v2 campaign in preparation');

  await assertTab('Activité');
  assert.deepEqual(await page.$$eval(tabs + ' [role="tab"]', nodes => nodes.map(node => node.textContent.trim())), sections);
  const headingState = await page.evaluate(() => ({
    shopNames: [...document.querySelectorAll('h1,h2,h3,strong')].filter(node => node.textContent.trim() === 'Les Chanvriers Bretons' && node.getBoundingClientRect().height > 0).length,
    text: document.body.innerText,
  }));
  assert.equal(headingState.shopNames, 1, 'A single shop identity is visible');
  assert.doesNotMatch(headingState.text, /Niveau\s*0?\d/i, 'The site subscription is not presented as an unexplained level');
  assert.match(headingState.text, /Ma boutique en ligne/i);
  assert.match(headingState.text, /Site\s*:\s*Boutique de base/i);
  assert.equal(await page.$eval(strategy, node => node.getBoundingClientRect().height > 0).catch(() => false), false, 'Activity does not stack the pricing workshop underneath');
  checks.push('one shop heading, explicit site formula and five separate panels replace the stacked screen');

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 1100 });
    for (const [index, label] of sections.entries()) {
      await navigate(label);
      await assertNoOverflow(label + ' at ' + width);
      await page.evaluate(() => window.scrollTo(0, 0));
      if (label === 'Activité') {
        await capture({ path: resolve(output, 'boutique-' + width + '.png'), fullPage: true });
        if (width === 390 || width === 1440) await capture({ path: resolve(output, width === 390 ? 'boutique-mobile-preview.png' : 'boutique-preview.png') });
      } else if (label === 'Prix') {
        await capture({ path: resolve(output, 'prix-' + width + '.png'), fullPage: true });
        if (captureScreenshots && (width === 390 || width === 1440)) await (await page.$(strategy)).screenshot({ path: resolve(output, width === 390 ? 'strategy-mobile.png' : 'strategy-desktop.png') });
      } else if (width === 390 || width === 1440) {
        await capture({ path: resolve(output, 'panel-' + index + '-' + width + '.png'), fullPage: true });
      }
    }
  }
  checks.push('all five separate panels fit 320, 390, 768 and 1440 pixels without document overflow');

  await page.focus(tabs + ' [aria-selected="true"]');
  for (const [key, expected] of [['Home', 'Activité'], ['ArrowRight', 'Prix'], ['End', 'Réglages'], ['ArrowRight', 'Activité'], ['ArrowLeft', 'Réglages']]) {
    await page.keyboard.press(key); await assertTab(expected);
    assert.equal(await page.evaluate(tabs => document.activeElement === document.querySelector(tabs + ' [aria-selected="true"]'), tabs), true, key + ' keeps focus on selected tab');
  }
  checks.push('tab navigation supports Home End and wrapping arrow keys with the correct focus');

  await navigate('Activité');
  await click('Piloter mes prix', cockpit);
  await assertTab('Prix');

  await page.waitForSelector(strategy);
  const beforeDecision = await fixture();
  for (const label of ['Rotation', 'Équilibre', 'Sélection']) {
    await click(label, strategy);
    assert.equal(await page.$eval(strategy, (section, label) => [...section.querySelectorAll('button')].find(button => button.querySelector('strong')?.textContent === label)?.getAttribute('aria-pressed'), label), 'true', label + ' is visibly selected');
  }
  assert.deepEqual(await fixture(), beforeDecision, 'Comparing strategies does not mutate economy');
  assert.equal(await page.evaluate(() => window.requests.length), 0);
  checks.push('all three strategies preview freely without changing the economy');

  await click('Rotation', strategy);
  await click('Appliquer ce prix', strategy);
  await page.waitForSelector('dialog[open]');
  const proposal = await page.evaluate(() => window.pendingBody);
  assert.equal(proposal.action, 'online');
  assert.equal(proposal.command, 'update-listing');
  assert.equal(proposal.payload.listingId, initial.online.listings[0].id);
  assert.ok(Number.isSafeInteger(proposal.payload.packetPriceCents) && proposal.payload.packetPriceCents > 0);
  assert.notEqual(proposal.payload.packetPriceCents, initial.online.listings[0].packetPriceCents);
  assert.deepEqual(await fixture(), beforeDecision, 'Confirmation has not yet changed the listing');
  await click('Annuler', 'dialog[open]');
  assert.deepEqual(await fixture(), beforeDecision, 'Cancel preserves the full state');
  await click('Appliquer ce prix', strategy); await click('Confirmer', 'dialog[open]');
  await page.waitForFunction((id, price) => window.fixture().online.listings.find(row => row.id === id)?.packetPriceCents === price, {}, proposal.payload.listingId, proposal.payload.packetPriceCents);
  const afterDecision = await fixture();
  assert.equal(afterDecision.cashCents, beforeDecision.cashCents, 'Repricing has no cost');
  assert.deepEqual(afterDecision.online.recentSales, beforeDecision.online.recentSales, 'Historical sale prices are preserved');
  assert.deepEqual(afterDecision.online.stats, beforeDecision.online.stats, 'Repricing invents neither visits nor orders');
  assert.equal(afterDecision.online.listings[0].remainingPackets, beforeDecision.online.listings[0].remainingPackets);
  assert.equal(await page.evaluate(() => window.requests.length), 1, 'One confirmed decision sends one command');
  checks.push('strategy price requires confirmation, cancellation is inert and the real update command preserves cash stock and historical sales');

  const second = initial.online.listings[1];
  await page.select(product, second.id);
  assert.equal(await page.$eval(product, node => node.value), second.id);
  await click('Sélection', strategy);
  await navigate('Activité'); await navigate('Prix');
  assert.equal(await page.$eval(product, node => node.value), second.id, 'Selected listing survives switching views');
  assert.equal(await page.$eval(strategy, section => [...section.querySelectorAll('button')].find(button => button.querySelector('strong')?.textContent === 'Sélection')?.getAttribute('aria-pressed')), 'true', 'Selected strategy survives switching views');
  await navigate('Activité');
  const firstShelf = await page.waitForFunction((business, name) => [...document.querySelectorAll(business + ' button')].find(button => button.getAttribute('aria-label') === 'Piloter ' + name && !button.disabled), {}, business, initial.online.listings[0].name);
  await firstShelf.asElement().click(); await firstShelf.dispose();
  await assertTab('Prix');
  await page.waitForFunction((selector, id) => document.querySelector(selector)?.value === id, {}, product, initial.online.listings[0].id);
  checks.push('listing and strategy choices survive view changes, and shelf cards open the correct listing in Prices');

  for (const [button, target] of [['Campagne en préparation', 'Communication'], ['Studio photo', 'Améliorations']]) {
    await navigate('Activité');
    await click(button, business, false);
    await assertTab(target);
  }
  await navigate('Communication');
  assert.equal(await page.$$eval('summary', nodes => nodes.some(node => node.textContent.includes('Publicité générale de la boutique') && node.getBoundingClientRect().height > 0)), true, 'Paid advertising belongs to Communication');
  await navigate('Réglages');
  assert.equal(await page.$$eval('summary', nodes => nodes.some(node => node.textContent.includes('Publicité payante') && node.getBoundingClientRect().height > 0)), false, 'Settings does not show paid advertising');
  const renameInput = 'input[placeholder="Ton nom de marque"]';
  await page.evaluate(selector => { const details = document.querySelector(selector)?.closest('details'); if (details) details.open = true; }, renameInput);
  await page.click(renameInput); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.type(renameInput, 'Les Jardins de la côte');
  await navigate('Activité'); await navigate('Réglages');
  assert.equal(await page.$eval(renameInput, node => node.value), 'Les Jardins de la côte', 'Unsubmitted shop name survives view changes');
  await navigate('Activité');
  await clickLink('section=sales');
  assert.equal(await page.evaluate(() => window.lastNavigation), 'prepare');
  await clickLink('section=dashboard');
  assert.equal(await page.evaluate(() => window.lastNavigation), 'sales');
  checks.push('campaign and studio open the right tabs; advertising belongs to Communication; rename drafts survive navigation; supply and sales callbacks remain connected');

  await reset('campaign-planner');
  await navigate('Communication');
  await page.waitForSelector(campaignForm, { visible: true });
  assert.equal(await page.$eval('[aria-label="Objectif de campagne"]', group => [...group.querySelectorAll('button')].length), 4, 'Four compact objectives share one planner');
  assert.equal(await page.$$eval(campaignForm, forms => forms.filter(form => form.getBoundingClientRect().height > 0).length), 1);
  assert.equal(await page.$eval('[aria-label="Objectif de campagne"]', group => [...group.querySelectorAll('button')].find(button => button.querySelector('strong')?.textContent === 'Se lancer')?.disabled), true, 'The initial free campaign cannot be repeated');
  assert.doesNotMatch(await page.$eval('[role="tabpanel"]', node => node.innerText), /Mission\s*0[1-4]|Lancer la mission gratuite|Niveau\s*0?\d/i);
  const beforeCampaign = await fixture();
  await click('Vendre une récolte', '[aria-label="Objectif de campagne"]');
  await page.click(campaignForm + ' input[type="radio"][value="premium"]');
  const premiumPreview = await page.$eval(campaignForecast, node => node.innerText);
  await page.click(campaignForm + ' input[type="radio"][value="value"]');
  const valuePreview = await page.$eval(campaignForecast, node => node.innerText);
  assert.notEqual(valuePreview, premiumPreview, 'Public choice updates fit and the live forecast');
  const localPreview = await page.$eval(campaignForecast, node => node.innerText);
  await page.click(campaignForm + ' input[type="radio"][value="regional"]');
  const regionalPreview = await page.$eval(campaignForecast, node => node.innerText);
  assert.notEqual(regionalPreview, localPreview, 'Budget choice updates the live forecast');
  assert.equal(await page.$eval(campaignForecast, node => [...node.querySelectorAll('dl > div')].find(row => row.querySelector('dt')?.textContent === 'Budget débité au lancement')?.querySelector('dd')?.textContent.replace(/\s/g, '')), '80€');
  assert.deepEqual(await fixture(), beforeCampaign, 'Planning does not spend cash or change the product');
  await navigate('Prix'); await navigate('Communication');
  assert.equal(await page.$eval(campaignForm + ' input[value="regional"]', node => node.checked), true, 'Budget survives switching panels');
  assert.equal(await page.$eval(campaignForm + ' input[value="value"]', node => node.checked), true, 'Public survives switching panels');
  const promotedListing = beforeCampaign.online.listings[1].id;
  await page.select(campaignForm + ' select', promotedListing);
  await click('Ajuster mon prix', campaignForm);
  await assertTab('Prix');
  assert.equal(await page.$eval(product, node => node.value), promotedListing, 'Adjusting a campaign price opens the promoted product, not the previously selected listing');
  await navigate('Communication');
  assert.equal(await page.$eval(campaignForm + ' select', node => node.value), promotedListing, 'Returning to Communication keeps the promoted product');
  assert.equal(await page.$eval(campaignForm + ' input[value="regional"]', node => node.checked), true, 'Returning from Prices keeps the campaign budget');
  assert.equal(await page.$eval(campaignForm + ' input[value="value"]', node => node.checked), true, 'Returning from Prices keeps the campaign audience');
  await page.select(campaignForm + ' select', beforeCampaign.online.listings[0].id);
  checks.push('campaign price adjustment opens the selected second product and preserves the campaign draft when returning');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 1100 });
    await assertNoOverflow('Campaign planner at ' + width);
    await capture({ path: resolve(output, 'campaign-planner-' + width + '.png'), fullPage: true });
  }
  checks.push('campaign planner has one configuration form, meaningful public and budget previews, persistent choices and no overflow at four breakpoints');

  await click('Engager', campaignForecast, false);
  await page.waitForSelector('dialog[open]');
  const campaignProposal = await page.evaluate(() => ({ body: window.pendingBody, cost: window.pendingCost }));
  assert.equal(campaignProposal.cost, 8000);
  assert.deepEqual(campaignProposal.body, { action: 'online', command: 'start-marketing', payload: { version: 2, code: 'harvest', angle: 'value', listingId: beforeCampaign.online.listings[0].id, budgetCode: 'regional' } });
  assert.match(await page.$eval('dialog[open]', node => node.textContent), /80\s*€/);
  assert.deepEqual(await fixture(), beforeCampaign, 'Opening paid campaign confirmation spends nothing');
  await click('Annuler', 'dialog[open]');
  assert.deepEqual(await fixture(), beforeCampaign, 'Cancelling the campaign preserves the complete economy');
  await click('Engager', campaignForecast, false); await click('Confirmer', 'dialog[open]');
  await page.waitForSelector(runningCampaign, { visible: true });
  const prepared = await fixture();
  const campaignId = prepared.online.marketing.active.id;
  assert.equal(prepared.cashCents, beforeCampaign.cashCents - 8000, 'One campaign costs the confirmed amount once');
  assert.equal(await page.evaluate(() => window.requests.length), 1);
  assert.equal(prepared.online.marketing.active.version, 2);
  assert.equal(prepared.online.marketing.active.results.orders, 0);
  assert.equal(prepared.online.marketing.active.results.followersEarned, 0);
  assert.equal(prepared.online.followers, beforeCampaign.online.followers, 'Starting a campaign invents no followers');
  assert.equal(await page.$(campaignForm), null, 'The active campaign replaces the planner');
  assert.match(await page.$eval(runningCampaign, node => node.innerText), /En préparation/i);
  await capture({ path: resolve(output, 'campaign-preparation.png'), fullPage: true });
  checks.push('paid campaign shows the charge before confirmation, cancellation is inert and confirmation replaces the planner after one debit');

  await page.evaluate(() => window.advanceMarket(4));
  await page.waitForFunction(selector => document.querySelector(selector)?.innerText.toLocaleLowerCase('fr-FR').includes('diffusion en cours'), {}, runningCampaign);
  const broadcasting = await fixture();
  assert.equal(broadcasting.online.marketing.active.results.orders, 0, 'Sales during preparation do not count toward the campaign');
  assert.equal(broadcasting.online.followers, beforeCampaign.online.followers);
  await capture({ path: resolve(output, 'campaign-broadcast.png'), fullPage: true });
  await page.evaluate(() => window.advanceMarket(48));
  await page.waitForFunction(() => !window.fixture().online.marketing.active);
  const completed = await fixture();
  const report = completed.online.marketing.history.find(item => item.id === campaignId);
  assert.ok(report, 'Offline settlement keeps the completed campaign report');
  assert.equal(report.version, 2);
  assert.equal(report.costCents, 8000);
  assert.ok(report.results.orders > 0, 'The real simulation produced orders during diffusion');
  assert.ok(report.results.satisfiedOrders <= report.results.orders);
  assert.equal(report.results.followersEarned, Math.min(report.followersCap, report.results.satisfiedOrders * report.followersPerOrder));
  assert.equal(completed.online.followers, beforeCampaign.online.followers + report.results.followersEarned);
  const history = await page.waitForFunction(() => [...document.querySelectorAll('summary')].find(summary => summary.textContent.includes('Bilans des campagnes') && summary.getBoundingClientRect().height > 0));
  await history.asElement().click(); await history.dispose();
  await page.waitForSelector('[aria-label="Bilan Vendre une récolte"]', { visible: true });
  assert.match(await page.$eval('[aria-label="Bilan Vendre une récolte"]', node => node.innerText), /Budget engagé|Commandes satisfaisantes|Abonnés gagnés/);
  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 1100 });
    await assertNoOverflow('Campaign report at ' + width);
    await capture({ path: resolve(output, 'campaign-report-' + width + '.png'), fullPage: true });
  }
  checks.push('offline time advances through preparation and diffusion to a bounded earned-follower report, with no preparation sales credited');

  await reset('introduction-planner'); await navigate('Communication');
  assert.match(await page.$eval(campaignForm, node => node.innerText), /premier essai est offert/i);
  await click('Préparer mon premier lancement', campaignForecast);
  assert.equal(await page.evaluate(() => window.pendingCost), 0);
  await click('Annuler', 'dialog[open]');
  await reset('legacy-campaign'); await navigate('Communication');
  assert.match(await page.$eval(runningCampaign, node => node.innerText), /conserve ses conditions/);
  assert.equal(await page.$(campaignForm), null, 'Legacy running campaigns also occupy the campaign slot');
  const legacyBefore = await fixture();
  await page.evaluate(() => window.advanceMarket(48));
  await page.waitForFunction(() => !window.fixture().online.marketing.active);
  assert.equal((await fixture()).online.followers, legacyBefore.online.followers + 15, 'Legacy campaign retains its promised follower reward');
  checks.push('initial campaign remains a single free trial, and legacy campaigns finish under their original reward rules');

  for (const scenario of ['empty', 'paused', 'busy']) {
    await reset(scenario);
    await page.setViewport({ width: 390, height: 1000 });
    await assertNoOverflow(scenario + ' state');
    await navigate('Prix');
    const canApply = await page.$eval(strategy, section => [...section.querySelectorAll('button')].some(button => button.textContent.trim() === 'Appliquer ce prix' && !button.disabled));
    assert.equal(canApply, false, scenario + ' prevents applying a strategy');
    assert.equal(await page.evaluate(() => window.requests.length), 0);
    if (scenario === 'paused') {
      await navigate('Activité');
      await click('Réactiver mon site', cockpit);
      await assertTab('Améliorations');
    }
    await capture({ path: resolve(output, 'boutique-' + scenario + '.png'), fullPage: true });
  }
  checks.push('empty inventory, paused website and busy state cannot apply a strategy');

  await reset('active');
  await assertTab('Activité');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const moving = await page.$eval(cockpit, section => section.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && Number(animation.effect?.getTiming().duration) > 100).map(animation => ({ name: animation.animationName, duration: animation.effect?.getTiming().duration })));
  assert.deepEqual(moving, [], 'Reduced motion disables long-running cockpit animations');
  checks.push('reduced-motion preference removes long-running cockpit animation');

  for (const label of sections) {
    await navigate(label);
    await page.evaluate(() => { for (const img of document.images) img.loading = 'eager'; });
    await page.waitForFunction(() => [...document.images].every(img => img.complete));
    const brokenImages = await page.evaluate(() => [...document.images].filter(img => !img.naturalWidth).map(img => img.getAttribute('src')));
    assert.deepEqual(brokenImages, [], label + ': all boutique and mission images load');
  }
  assert.deepEqual(externalRequests, [], 'No external requests');
  assert.deepEqual(failedRequests, [], 'No failed asset requests');
  assert.deepEqual(errors, [], 'No browser exception');
  checks.push('all images load, with no browser exception, failed asset or external request');

  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, checks }, null, 2));
  console.log('Shop tycoon browser audit: ' + checks.length + ' checks passed. ' + (captureScreenshots ? 'Screenshots: ' : 'Results: ') + output);
} catch (error) {
  if (page) {
    await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true });
    console.log(await page.evaluate(() => ({ buttons: [...document.querySelectorAll('button')].map(button => ({ text: button.textContent, disabled: button.disabled })), online: window.fixture?.().online })));
  }
  console.log({ errors, failedRequests, externalRequests });
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
}
