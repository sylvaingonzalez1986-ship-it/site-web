/** Real cart components, local account/cart fixtures and payment stub. No backend requests. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/cart');
const origin = 'http://127.0.0.1:3231';
const drawer = 'dialog[aria-label="Ton panier"]';
const modal = 'dialog[open]:not([aria-label="Ton panier"])';
const modules = {
  'cart-audit-entry': `
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css';import {CartDrawer} from '/src/components/CartDrawer';
    import {FixtureProvider} from 'cart-fixture';
    window.__fixtureRequests=[];window.__fixtureRoutes=[];
    window.fetch=async(url,options={})=>{window.__fixtureRequests.push({url:String(url),method:options.method||'GET'});throw new Error('Unexpected backend request in cart audit: '+url);};
    function App(){const[open,setOpen]=useState(false);return <FixtureProvider><main className="audit-page"><p className="audit-brand">LES CHANVRIERS BRETONS</p><h1>Le Marché.</h1><p>Une sélection locale, des producteurs et une belle récolte à composer.</p><button id="open-cart" className="btn-cartoon btn-primary" onClick={()=>setOpen(true)}>Ouvrir mon panier</button><a href="#after" id="outside-focus">Découvrir les producteurs</a><div style={{height:1200}}/></main><CartDrawer open={open} onClose={()=>setOpen(false)}/></FixtureProvider>;}createRoot(document.getElementById('root')).render(<App/>);
  `,
  'cart-fixture': `
    import React,{createContext,useContext,useState,useCallback,useMemo} from 'react';import {buildEmptyLoyaltySummary} from '/src/lib/loyalty';
    const Context=createContext(null),query=new URLSearchParams(location.search),isAuthenticated=query.get('fixture')==='member';
    const member={id:'cart-audit-member',firstName:'Camille',lastName:'Le Goff',email:'camille@example.test',phone:'0600000000',dateOfBirth:'1990-04-05',address:'12 rue des Producteurs',city:'Rennes',postalCode:'35000',country:'France'};
    const loyalty=buildEmptyLoyaltySummary();if(isAuthenticated)loyalty.currentBadge={...loyalty.badges.find(b=>b.id==='connaisseur'),unlocked:true};
    const inventory={availableClaims:[]},lotteryConfig={isActive:true,eurosPerTicket:5,maxTicketsPerOrder:4};
    const initial=[{id:'audit-flower',name:query.get('fixture')==='long'?'Fleur de chanvre bretonne, récolte des producteurs de la côte et sélection artisanale ExtraLongueSansAucunEspacePourVérifierLesDébordementsResponsives':'Fleur des producteurs bretons · 5 g',category:'fleurs',price:24.9,originalPrice:29.9,promoPercent:17,image:'/product_flower.jpg',description:'Produit de démonstration locale.',bonusPoints:4,quantity:1,trackStock:true,stockQuantity:8},{id:'audit-tea',name:'Infusion du jardin · 30 g',category:'alimentaire',price:12.5,image:'/product_tea.jpg',description:'Produit de démonstration locale.',quantity:2,trackStock:true,stockQuantity:12}];
    export function FixtureProvider({children}){const[items,setItems]=useState(query.get('fixture')==='empty'?[]:initial);
      const refreshSession=useCallback(async()=>{},[]),clearCart=useCallback(()=>setItems([]),[]);
      const removeFromCart=useCallback(id=>setItems(current=>current.filter(item=>item.id!==id)),[]);
      const decreaseQuantity=useCallback(id=>setItems(current=>current.flatMap(item=>item.id!==id?[item]:item.quantity>1?[{...item,quantity:item.quantity-1}]:[])),[]);
      const setQuantity=useCallback((id,quantity)=>{const found=items.find(item=>item.id===id);if(quantity>(found?.stockQuantity??99))return{ok:false,reason:'stock_limit',maxAvailable:found.stockQuantity};setItems(current=>current.map(item=>item.id===id?{...item,quantity}:item));return{ok:true};},[items]);
      const addToCart=useCallback(product=>setQuantity(product.id,(items.find(item=>item.id===product.id)?.quantity??0)+1),[items,setQuantity]);
      const value=useMemo(()=>({items,totalItems:items.reduce((sum,item)=>sum+item.quantity,0),totalPrice:items.reduce((sum,item)=>sum+item.price*item.quantity,0),isAuthenticated,authLoading:false,sessionLoading:false,cartLoading:false,user:isAuthenticated?member:null,orders:[],loyalty,lotteryInventory:inventory,lotteryConfig,refreshSession,addToCart,decreaseQuantity,setQuantity,removeFromCart,clearCart}),[items,refreshSession,addToCart,decreaseQuantity,setQuantity,removeFromCart,clearCart]);
      window.__fixtureItems=items;return <Context.Provider value={value}>{children}</Context.Provider>;
    }
    export const useCart=()=>useContext(Context);
  `,
  'cart-cms': `const store={content:{profile:{}}};export const useCmsStore=()=>({store});`,
  'cart-navigation': `const router={push:path=>window.__fixtureRoutes.push(path),replace:path=>window.__fixtureRoutes.push(path),refresh:()=>{}};export const useRouter=()=>router;`,
  'cart-checkout': `import React from 'react';import {formatPrice} from '/src/lib/utils';export function CheckoutButton({disabled,amountToPay,shipping}){return <div><button type="button" className="btn-cartoon btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" data-checkout-stub data-delivery={shipping.deliveryMethod} data-amount={amountToPay} disabled={disabled} onClick={()=>{throw new Error('Payment stub must never be clicked');}}>Payer {formatPrice(amountToPay)}</button><p className="mt-2 text-center text-xs font-semibold leading-relaxed text-charcoal">En cliquant, tu confirmes une commande avec obligation de paiement. Paiement securise traite par Viva.</p></div>;}`,
  'cart-relay': `import React from 'react';export function MondialRelayPicker({selectedPoint,onSelect}){return <div data-relay-stub style={{border:'1px solid #00563f',padding:16,background:'#fffaf1',minWidth:0}}><p style={{fontWeight:700}}>Choisis ton Point Relais</p><p>Épicerie du quartier · Rennes</p><button type="button" className="btn-cartoon btn-secondary min-h-11 px-3" onClick={()=>onSelect({id:'local-relay',name:'Épicerie du quartier',address:'2 rue du Marché',postalCode:'35000',city:'Rennes',country:'FR'})}>{selectedPoint?'Point Relais sélectionné':'Choisir ce Point Relais'}</button></div>;}`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}}/>;}`,
  'next/dynamic': `import React from 'react';export default function dynamic(loader){const Component=React.lazy(()=>loader().then(module=>({default:module.default||module})));return props=><React.Suspense fallback={null}><Component {...props}/></React.Suspense>;}`,
  'next/navigation': `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:path=>window.__fixtureRoutes.push(path),replace:()=>{},refresh:()=>{}});`,
};

const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, 'public'), cacheDir: resolve(output, 'vite-cache'),
  define: { 'process.env': '{}' },
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
  resolve: { alias: { '@': resolve(root, 'src') }, dedupe: ['react', 'react-dom'] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'isolated-cart-audit', enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('/context/CartContext')) return '\0cart-fixture';
      if (id.endsWith('/hooks/useCmsStore')) return '\0cart-cms';
      if (id.endsWith('/navigation/NavigationFeedback')) return '\0cart-navigation';
      if (id.endsWith('/components/CheckoutButton')) return '\0cart-checkout';
      if (id.endsWith('/components/MondialRelayPicker')) return '\0cart-relay';
      if (Object.hasOwn(modules, id)) return '\0' + id;
    },
    async load(id) {
      if (id.startsWith('\0') && modules[id.slice(1)]) return (await transformWithOxc(modules[id.slice(1)], id + '.tsx', { lang: 'tsx', jsx: { runtime: 'automatic' } })).code;
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit local du panier</title><style>
          @font-face{font-family:BarlowAudit;src:url('/src/app/fonts/BarlowCondensed-Latin-Bold.woff2');font-weight:700;font-display:swap}
          @font-face{font-family:BarlowAudit;src:url('/src/app/fonts/BarlowCondensed-Latin-ExtraBold.woff2');font-weight:800;font-display:swap}
          @font-face{font-family:BarlowAudit;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900;font-display:swap}
          @font-face{font-family:SpaceAudit;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700;font-display:swap}
          :root{--font-display:BarlowAudit;--font-body:SpaceAudit;--font-sans:SpaceAudit}body{margin:0;background:#f7f4e8;font-family:SpaceAudit,sans-serif;color:#003f30}.audit-page{max-width:1000px;margin:auto;padding:80px 24px}.audit-brand{font-size:12px;letter-spacing:.12em;font-weight:700}.audit-page h1{font-family:BarlowAudit,sans-serif;font-size:80px;font-weight:900;text-transform:uppercase}.audit-page p{max-width:480px}.audit-page>a{display:block;margin-top:20px}
        </style><div id="root"></div><script type="module" src="/@id/__x00__cart-audit-entry"></script></html>`);
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3231, strictPort: true, hmr: false, watch: null },
});

let browser;
const failures = [], browserErrors = [], scenarios = [], screenshots = [];
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    void (url.protocol === 'data:' || (url.origin === origin && !url.pathname.startsWith('/api/')) ? request.continue() : request.abort());
  });
  const screenshot = async name => { await page.screenshot({ path: resolve(output, name + '.png') }); screenshots.push(name + '.png'); };
  const clickText = async (prefix, scope = drawer) => {
    const handle = await page.evaluateHandle(({ prefix, scope }) => [...document.querySelectorAll(scope + ' button')].find(button => button.textContent.trim().startsWith(prefix)), { prefix, scope });
    assert(handle.asElement(), `Missing button: ${prefix}`);
    await handle.asElement().click();
    await handle.dispose();
  };
  const assertFit = async (selector = drawer) => {
    await page.$eval(selector, async element => {
      await Promise.all(element.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    const geometry = await page.$eval(selector, element => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: innerWidth, height: innerHeight, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, documentWidth: document.documentElement.scrollWidth };
    });
    assert(geometry.left >= -1 && geometry.right <= geometry.width + 1, 'dialog extends beyond viewport horizontally: ' + JSON.stringify(geometry));
    assert(geometry.top >= -1 && geometry.bottom <= geometry.height + 1, 'dialog extends beyond viewport vertically: ' + JSON.stringify(geometry));
    assert(geometry.scrollWidth <= geometry.clientWidth + 1 && geometry.documentWidth <= geometry.width + 1, 'horizontal overflow: ' + JSON.stringify(geometry));
    return geometry;
  };
  const closeAndRestore = async () => {
    await page.click(drawer + ' button[aria-label="Fermer le panier"]');
    await page.waitForFunction(() => !document.querySelector('dialog[aria-label="Ton panier"]').open);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-cart', 'close must return focus to cart trigger');
    assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'closing cart unlocks background');
    await page.click('#open-cart');
    await page.waitForSelector(drawer + '[open]');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog[aria-label="Ton panier"]').open);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-cart', 'Escape must return focus to cart trigger');
  };
  for (const [width, height] of [[320, 740], [390, 844], [1440, 1000], [667, 390]]) {
    for (const fixture of ['guest', 'member', 'empty', 'long']) {
      const name = `${fixture}-${width}x${height}`;
      try {
        await page.setViewport({ width, height, isMobile: width < 700, hasTouch: width < 700 });
        await page.goto(origin + '/?fixture=' + fixture, { waitUntil: 'networkidle0' });
        await page.evaluate(() => document.fonts.ready);
        await page.click('#open-cart');
        await page.waitForSelector(drawer + '[open]');
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Fermer le panier');
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        const geometry = await assertFit();
        await screenshot(name + '-top');
        for (let index = 0; index < 12; index++) await page.keyboard.press('Tab');
        assert(await page.evaluate(() => document.querySelector('dialog[aria-label="Ton panier"]').contains(document.activeElement)), 'focus escaped the cart');
        if (fixture === 'empty') {
          assert.equal(await page.$(drawer + ' input[type="number"]'), null);
          assert.equal(await page.$(drawer + ' [aria-label="Récapitulatif de la commande"]'), null);
          assert.match(await page.$eval(drawer, element => element.textContent), /Ton panier est vide/);
        } else {
          const quantity = drawer + ' input[type="number"]';
          await page.click(drawer + ' button[aria-label^="Augmenter"]');
          await page.waitForFunction(() => document.querySelector('dialog[aria-label="Ton panier"] input[type="number"]').value === '2');
          await page.click(drawer + ' button[aria-label^="Diminuer"]');
          await page.waitForFunction(() => document.querySelector('dialog[aria-label="Ton panier"] input[type="number"]').value === '1');
          await page.focus(quantity);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('3');
          assert.equal(await page.$eval(quantity, input => input.value), '3');
          await page.click(drawer + ' button[aria-label^="Diminuer"]');await page.click(drawer + ' button[aria-label^="Diminuer"]');
          if (fixture === 'member') {
            assert(await page.$(drawer + ' input[aria-label="Adresse de livraison"]'));
            await clickText('Point relais');await page.waitForSelector('[data-relay-stub]');
            assert.equal(await page.$(drawer + ' input[aria-label="Adresse de livraison"]'), null);
            assert(await page.$eval('[data-checkout-stub]', button => button.disabled));
            await clickText('Choisir ce Point Relais');
            await page.waitForFunction(() => !document.querySelector('[data-checkout-stub]').disabled);
            assert.equal(await page.$eval('[data-checkout-stub]', button => button.dataset.delivery), 'relay');
            await screenshot(name + '-relay');
            await clickText('Domicile');
            await page.waitForSelector(drawer + ' input[aria-label="Adresse de livraison"]');
            for (const benefit of ['Fidélité', 'Packs']) {
              await page.evaluate(benefit => { window.__benefitTrigger = [...document.querySelectorAll('dialog[aria-label="Ton panier"] button')].find(button => button.textContent.trim().startsWith(benefit)); }, benefit);
              await clickText(benefit);await page.waitForSelector(modal);await assertFit(modal);
              for (let index = 0; index < 5; index++) {
                await page.keyboard.press('Tab');
                const focus = await page.evaluate(() => ({
                  inside: document.querySelector('dialog[open]:not([aria-label="Ton panier"])').contains(document.activeElement),
                  browserChrome: document.activeElement === document.body,
                  element: document.activeElement.outerHTML.slice(0, 200),
                }));
                assert(focus.inside || focus.browserChrome, 'focus reached background content: ' + focus.element);
              }
              assert(await page.$eval(modal, element => element.matches(':modal')), 'benefit dialog left the top layer');
              assert(await page.evaluate(() => {
                const background = document.querySelector('dialog[aria-label="Ton panier"] button[aria-label="Fermer le panier"]');
                background.focus();
                return document.activeElement !== background;
              }), 'underlying cart accepted focus while benefit modal was open');
              // Native dialogs may cycle through browser chrome; return to their close button for Escape.
              await page.focus(modal + ' button[aria-label="Fermer le récapitulatif"]');
              assert(await page.evaluate(() => document.querySelector('dialog[open]:not([aria-label="Ton panier"])').contains(document.activeElement)), 'focus escaped the benefit modal');
              await screenshot(name + '-' + (benefit === 'Packs' ? 'packs' : 'loyalty'));
              await page.keyboard.press('Escape');
              await page.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 1);
              assert(await page.evaluate(() => document.querySelector('dialog[aria-label="Ton panier"]').open), 'benefit Escape also closed cart');
              assert(await page.evaluate(() => document.activeElement === window.__benefitTrigger), 'benefit Escape did not restore focus');
              assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
            }
          } else {
            assert.equal(await page.$('[data-checkout-stub]'), null);
            assert.equal(await page.$(drawer + ' input[aria-label="Adresse de livraison"]'), null);
            await clickText('Point relais');
            assert(await page.$eval('[aria-label="Estimer la livraison"] button:last-child', button => button.getAttribute('aria-pressed') === 'true'));
            await clickText('Domicile');
          }
          await page.$eval('[aria-label="Récapitulatif de la commande"]', element => element.scrollIntoView({ block: 'end', behavior: 'instant' }));
          await assertFit();await screenshot(name + '-summary');
          if (fixture === 'long') {
            await page.click(drawer + ' button[aria-label^="Retirer"]');
            await page.waitForFunction(() => window.__fixtureItems.length === 1);
          }
        }
        await closeAndRestore();
        assert.deepEqual(await page.evaluate(() => window.__fixtureRequests), [], 'audit unexpectedly contacted an API');
        scenarios.push({ name, status: 'passed', geometry });
      } catch (error) {
        failures.push({ scenario: name, error: error.message });
        await screenshot(name + '-failure');
        console.error(name + ': ' + error.message);
      }
    }
  }
  assert.deepEqual(browserErrors, [], 'browser errors');
} catch (error) {
  failures.push({ scenario: 'audit', error: error.message });
} finally {
  const report = { origin, scenarios, failures, browserErrors, screenshots, limitation: 'Real components with local cart/account/relay fixtures; checkout is a stub and no payment or backend action is executed.' };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();await server.close();
  console.log(JSON.stringify({ passed: scenarios.length, failures, browserErrors, screenshots: screenshots.length, report: resolve(output, 'report.json') }, null, 2));
  if (failures.length) process.exitCode = 1;
}
