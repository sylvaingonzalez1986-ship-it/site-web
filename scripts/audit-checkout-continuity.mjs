/**
 * Local browser regression audit using the real cart provider, drawer, payment
 * button and relay picker. All account, relay and checkout APIs are synthetic;
 * external requests are blocked. No account, order or payment is created.
 * Run: node scripts/audit-checkout-continuity.mjs
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/checkout-continuity");
const port = 3262;
const widths = [320, 1440];
const modules = {
  "next/navigation": `export const usePathname=()=>'/boutique';`,
  "next/image": `import React from 'react'; export default function Image({priority,preload,fill,unoptimized,...props}){return React.createElement('img',props);}`,
  "next/dynamic": `import React from 'react'; export default function dynamic(loader){const Component=React.lazy(()=>loader().then(value=>({default:value.default||value})));return function Dynamic(props){return React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props));};}`,
  "@/components/navigation/NavigationFeedback": `const router={push:(url)=>window.__fixture.navigation.push({method:'push',url}),replace:(url)=>window.__fixture.navigation.push({method:'replace',url})}; export const useRouter=()=>router;`,
  "@/components/navigation/NavigationLink": `import React from 'react'; export default function Link(props){return React.createElement('a',props);}`,
  "@/hooks/useCmsStore": `import {defaultStore} from '/src/data/default-store'; export const useCmsStore=()=>({store:defaultStore,loading:false});`,
  "@/components/cookies/CookieConsentProvider": `export const useCookieConsent=()=>({hasConsent:()=>false});`,
  "@/components/checkout/OrderCashReward": `export const OrderCashRewardPreview=()=>null; export const OrderCashRewardReceipt=()=>null;`,
  "@/components/checkout/ContestBundleReward": `export const ContestBundleRewardPreview=()=>null; export const ContestBundleRewardReceipt=()=>null;`,
};
const entry = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '/src/app/globals.css';
import {CartProvider,useCart} from '/src/context/CartContext';
import {CartDrawer} from '/src/components/CartDrawer';
import {AccountRegisterForm} from '/src/components/account/AccountRegisterForm';
import {AccountLoginForm} from '/src/components/account/AccountLoginForm';
import {BitcoinPaymentPage} from '/src/components/checkout/BitcoinPaymentPage';

const scenario=new URLSearchParams(location.search).get('scenario');
const bitcoinPage=location.pathname==='/checkout/bitcoin/AUDIT-BITCOIN';
const Profile=scenario==='profile-orders'?React.lazy(()=>import('/src/components/account/ProfilePanel').then(module=>({default:module.ProfilePanel}))):null;
if(bitcoinPage || Profile){
 for(const key of ['setTimeout','setInterval']){
  const original=window[key].bind(window);
  window[key]=(callback,delay,...args)=>original(callback,delay===30_000?400:delay,...args);
 }
}
const nextUrl='/boutique?panier=1';
const initialUser={id:'customer-a',email:'camille@example.test',firstName:'Camille',lastName:'Exemple',dateOfBirth:'1990-01-01',phone:'',address:'',city:'',postalCode:'',country:'France',loyaltyPoints:0,loyaltyPointsSpent:0,contestBetaEnabled:false,promoCodes:[],createdAt:'2026-01-01T00:00:00Z'};
const secondUser={...initialUser,id:'customer-b',email:'alex@example.test',firstName:'Alex'};
const product={id:'audit-product',name:'Produit de démonstration',category:'fleurs',price:14.9,image:'',description:'Produit fictif pour audit local',trackStock:false};
const relay={id:'AUDIT-RELAY',name:'Relais de démonstration',address:'8 rue du Test',city:'Rennes',postalCode:'35000',country:'FR'};
const belgianRelay={id:'AUDIT-RELAY-BE',name:'Relais belge de démonstration',address:'12 rue du Test',city:'Bruxelles',postalCode:'1000',country:'BE'};
if(!bitcoinPage){localStorage.clear();sessionStorage.clear();}
window.__fixture={user:['register','login'].includes(scenario)?null:initialUser,requests:[],unexpected:[],navigation:[],relay,meMode:'ready',releaseMe:null,bitcoinState:'pending',releaseBitcoin:null,conflict:false};
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
 const state=window.__fixture,method=init.method||'GET',body=init.body?JSON.parse(init.body):null;
 state.requests.push({path:url.pathname,query:Object.fromEntries(url.searchParams),method,body});
 if(url.pathname==='/api/account/me'){
  if(state.meMode==='unavailable')return Response.json({error:'Panne de démonstration.'},{status:503});
  if(state.meMode==='network-error')throw new TypeError('Synthetic network failure');
  if(state.meMode==='delayed'){
   const capturedUser=state.user;
   return new Promise(resolve=>{state.releaseMe=()=>{state.releaseMe=null;resolve(Response.json({user:capturedUser}));};});
  }
  return Response.json({user:state.user});
 }
 if(url.pathname==='/api/account/register'&&method==='POST')return Response.json({email:body.email});
 if(url.pathname==='/api/account/login'&&method==='POST'){state.user=initialUser;return Response.json({user:initialUser});}
 if(url.pathname==='/api/account/orders'){
  const paid=state.bitcoinState==='paid';
  const order={id:'AUDIT-BITCOIN',customerId:initialUser.id,paymentProvider:'swiss_bitcoin_pay',status:paid?'paid':'pending_payment',paymentState:paid?'paid':'pending',
   createdAt:'2026-11-01T10:00:00Z',items:[],itemsCount:0,totalAmount:19.9,totalHt:19.9,totalVat:0,vatBreakdown:[]};
  return Response.json({orders:Profile?[order]:[]});
 }
 if(url.pathname==='/api/account/referral' && Profile)return Response.json({summary:null});
 if(url.pathname==='/api/account/tickets')return Response.json({tickets:[],inventory:null,config:null});
 if(url.pathname==='/api/account/welcome-pack')return Response.json({eligible:false});
 if(url.pathname==='/api/relay/points')return Response.json({points:[relay,belgianRelay].filter(point=>point.country===url.searchParams.get('country')&&point.postalCode===url.searchParams.get('postalCode'))});
 if(url.pathname==='/api/checkout/bitcoin'){
  if(scenario==='bitcoin-error')return Response.json({error:'Disponibilité fictive inaccessible.'},{status:503});
  if(scenario==='bitcoin')return new Promise(resolve=>{state.releaseBitcoin=()=>resolve(Response.json({enabled:true}));});
  return Response.json({enabled:false});
 }
 if(url.pathname==='/api/checkout/bitcoin/AUDIT-BITCOIN'){
  return Response.json({orderId:'AUDIT-BITCOIN',totalAmount:19.9,state:state.bitcoinState,canRetry:false,canPayByCard:false,
   ...(state.bitcoinState==='pending'?{checkoutUrl:'https://checkout.example.test/fake-invoice'}:{})});
 }
 if(url.pathname==='/api/checkout/viva'&&method==='POST'&&body.paymentMethod==='bitcoin_lightning'){
  const bitcoinAttempts=JSON.parse(sessionStorage.getItem('audit:bitcoin-attempts')??'[]');
  bitcoinAttempts.push(body.checkoutAttemptId);
  sessionStorage.setItem('audit:bitcoin-attempts',JSON.stringify(bitcoinAttempts));
  if(state.conflict){
   return Response.json({code:'checkout_method_conflict',error:'Un paiement est déjà en cours avec l’autre moyen de paiement.',orderId:'AUDIT-CARD',
    resumeUrl:'/api/account/orders/AUDIT-CARD/resume-payment'},{status:409});
  }
  if(state.retryBitcoin==='archived'){
   state.retryBitcoin='busy';
   return Response.json({code:'checkout_attempt_archived'},{status:409});
  }
  if(state.retryBitcoin==='busy'){
   state.retryBitcoin=null;
   return Response.json({code:'checkout_attempt_busy'},{status:409,headers:{'Retry-After':'3'}});
  }
  sessionStorage.setItem('audit:bitcoin-attempt',body.checkoutAttemptId);
  return Response.json({orderId:'AUDIT-BITCOIN',redirectUrl:'/checkout/bitcoin/AUDIT-BITCOIN',resumed:false});
 }
 if(url.pathname==='/api/checkout/viva'&&method==='POST'){
  if(state.conflict==='bitcoin'){
   return Response.json({code:'checkout_method_conflict',orderId:'AUDIT-BITCOIN',
    resumeUrl:'/checkout/bitcoin/AUDIT-BITCOIN'},{status:409});
  }
  return Response.json({error:'Paiement fictif arrêté par le harnais.'},{status:503});
 }
 state.unexpected.push({path:url.pathname,method});
 return Response.json({error:'Unexpected fixture API'},{status:503});
};
function Harness(){
 const cart=useCart(),[open,setOpen]=useState(false),[generation,setGeneration]=useState(0),[refreshCount,setRefreshCount]=useState(0);
 const selectUser=(user)=>{window.__fixture.user=user;cart.setUser(user);};
 const el=React.createElement;
 return el('main',{style:{padding:20}},
  el('h1',null,'Audit local de continuité de commande'),
  el('p',null,'Aucune connexion au site, aucune commande réelle.'),
  el('div',{id:'fixture-controls'},
   el('button',{id:'fixture-add',onClick:()=>cart.addToCart(product)},'Ajouter le produit fictif'),
   el('button',{id:'fixture-open',onClick:()=>setOpen(true)},'Ouvrir le panier'),
   el('button',{id:'fixture-remount',onClick:()=>setGeneration(value=>value+1)},'Remonter le panier'),
   el('button',{id:'fixture-refresh',onClick:()=>cart.refreshSession({silent:true,force:true}).finally(()=>setRefreshCount(value=>value+1))},'Actualiser la session'),
   el('button',{id:'fixture-first',onClick:()=>selectUser(initialUser)},'Premier compte'),
   el('button',{id:'fixture-second',onClick:()=>selectUser(secondUser)},'Autre compte'),
   el('button',{id:'fixture-logout',onClick:()=>selectUser(null)},'Déconnexion'),
   el('button',{id:'fixture-clear',onClick:()=>cart.clearCart()},'Vider le panier')),
  el('output',{id:'fixture-state','data-ready':!cart.authLoading&&!cart.cartLoading,'data-user':cart.user?.id||'','data-email':cart.user?.email||'','data-count':cart.totalItems,'data-refreshed':refreshCount}),
  scenario==='register'?el('section',{id:'fixture-register'},el(AccountRegisterForm,{nextUrl})):null,
  scenario==='login'?el('section',{id:'fixture-login'},el(AccountLoginForm,{nextUrl})):null,
  bitcoinPage?el(BitcoinPaymentPage,{orderId:'AUDIT-BITCOIN'}):null,
  Profile?el(React.Suspense,null,el(Profile)):null,
  el(CartDrawer,{key:generation,open,onClose:()=>setOpen(false)}));
}
createRoot(document.getElementById('root')).render(React.createElement(CartProvider,null,React.createElement(Harness)));
`;

const server = await createServer({
  root, configFile: false, envDir: false, publicDir: resolve(root, "public"),
  cacheDir: resolve(output, "vite-cache"), esbuild: { jsx: "automatic" },
  define: { "process.env": "{}" },
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lucide-react", "@vercel/analytics/react"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "checkout-continuity-fixture", enforce: "pre",
    resolveId(id) {
      if (id === "checkout-entry.tsx") return "\0checkout-entry.tsx";
      if (modules[id]) return "\0checkout-fixture:" + id;
      // Vite's alias plugin may resolve @/ imports before this hook.
      const normalized = id.replaceAll("\\", "/");
      const key = Object.keys(modules).find(name => name.startsWith("@/") && normalized === resolve(root, "src", name.slice(2)).replaceAll("\\", "/"));
      if (key) return "\0checkout-fixture:" + key;
    },
    load(id) {
      if (id === "\0checkout-entry.tsx") return entry;
      if (id.startsWith("\0checkout-fixture:")) return modules[id.slice("\0checkout-fixture:".length)];
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (!["/", "/checkout/bitcoin/AUDIT-BITCOIN"].includes(req.url?.split("?")[0])) return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit local du panier</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}#fixture-controls{display:flex;flex-wrap:wrap;gap:12px}#fixture-controls button{background:#fffaf1;padding:8px}</style><div id="root"></div><script type="module" src="/@id/__x00__checkout-entry.tsx"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});

let browser;
const errors = [], results = [], blockedRequests = [], unexpectedApis = [];
let failure;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60_000);
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || (url.hostname === "127.0.0.1" && url.port === String(port) && !url.pathname.startsWith("/api/"))) void request.continue();
    else { blockedRequests.push(request.url()); void request.abort(); }
  });
  const trigger = selector => page.$eval(selector, button => button.click());
  const clickButton = prefix => page.$$eval("dialog[open] button", (buttons, value) => {
    const button = buttons.find(item => item.textContent.trim().startsWith(value));
    if (!button || button.disabled) throw new Error("Missing or disabled button: " + value);
    button.click();
  }, prefix);
  const fillSelector = async (selector, value) => {
    await page.focus(selector);
    await page.keyboard.down("Control"); await page.keyboard.press("A"); await page.keyboard.up("Control");
    await page.keyboard.press("Backspace"); await page.type(selector, value);
  };
  const fill = (label, value) => fillSelector(`input[aria-label="${label}"]`, value);
  const assertDraftNotPersisted = async () => {
    const persisted = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage].map(storage => Object.fromEntries(Object.keys(storage).filter(key => key !== 'checkout:viva:attempt').map(key => [key, storage.getItem(key)])))));
    for (const enteredValue of ['Camille Livraison', 'livraison@example.test', '0612345678', '+32470123456', '12 rue de la Commande', 'AUDIT-RELAY']) assert.equal(persisted.includes(enteredValue), false, 'Order draft must stay in memory: ' + enteredValue);
  };
  const valueOf = label => page.$eval(`input[aria-label="${label}"]`, input => input.value);
  const selectPayment = value => trigger(`dialog[open] [data-checkout-payment-methods] input[value="${value}"]`);
  const waitPayment = async (disabled, chooseCardIfUnset = true) => {
    if (!disabled && chooseCardIfUnset) {
      const selected = await page.$('dialog[open] [data-checkout-payment-methods] input:checked');
      if (!selected) await selectPayment("card");
    }
    await page.waitForFunction(expected => {
      const button = [...document.querySelectorAll("dialog[open] button")].find(item => item.textContent.trim().startsWith("Payer "));
      return button && button.disabled === expected;
    }, {}, disabled);
  };
  const record = (name, width) => { results.push({ name, width, passed: true }); console.log(`PASS ${name} ${width}`); };
  const refresh = async () => {
    const previous = await page.$eval('#fixture-state', state => Number(state.dataset.refreshed));
    await trigger('#fixture-refresh');
    await page.waitForFunction(count => Number(document.querySelector('#fixture-state').dataset.refreshed) > count, {}, previous);
  };
  const reopen = async () => {
    await trigger('[aria-label="Fermer le panier"]');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await trigger("#fixture-open");
    await page.waitForSelector('dialog[open] input[aria-label="Nom complet"]');
  };
  const snapshot = () => page.$$eval("dialog[open] input[aria-label]", inputs => Object.fromEntries(inputs.filter(input => input.type !== "number").map(input => [input.getAttribute("aria-label"), input.value])));
  const relayAvailable = (name = "Relais de démonstration") => page.waitForFunction(expected => [...document.querySelectorAll(".mondial-relay-widget button")].some(button => button.textContent.includes(expected)), {}, name);
  const relaySelected = (name = "Relais de démonstration") => page.waitForFunction(expected => [...document.querySelectorAll(".mondial-relay-widget button")].some(button => button.getAttribute("aria-pressed") === "true" && button.textContent.includes(expected)), {}, name);
  const fillOrder = async () => {
    for (const [label, value] of Object.entries({ "Nom complet": "Camille Livraison", "Email": "livraison@example.test", "Téléphone": "0612345678", "Adresse de livraison": "12 rue de la Commande", "Ville": "Rennes", "Code postal": "35000", "Pays": "France" })) await fill(label, value);
  };

  for (const width of widths) {
    await page.setViewport({ width, height: width < 768 ? 844 : 1000 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle0" });
    await page.waitForSelector('#fixture-state[data-ready="true"][data-user="customer-a"]');
    await trigger("#fixture-add"); await trigger("#fixture-open");
    await page.waitForSelector('dialog[open] input[aria-label="Nom complet"]');
    assert.equal(await valueOf("Nom complet"), "Camille Exemple");
    assert.equal(await valueOf("Email"), "camille@example.test");
    assert.equal(await valueOf("Téléphone"), "");
    assert.equal(await valueOf("Adresse de livraison"), "");
    await waitPayment(true);
    await fillOrder();
    await waitPayment(true);
    const disabledBitcoin = 'dialog[open] input[value="bitcoin_lightning"]:disabled';
    await page.waitForSelector(disabledBitcoin, { visible: true });
    assert.equal(await page.$eval(disabledBitcoin, input => document.getElementById(input.getAttribute("aria-describedby")).textContent.trim()),
      "Le paiement Bitcoin est actuellement désactivé.");
    assert.equal(await page.$('dialog[open] [data-checkout-payment-methods] input:checked'), null);
    await selectPayment("card"); await waitPayment(false);
    record("both-methods-visible-explicit-selection-required-when-bitcoin-disabled", width);
    assert.equal(await page.$$eval("dialog[open] button", buttons => buttons.some(button => button.textContent.includes("Compléter mon profil"))), false);
    record("adult-without-profile-address-can-complete-home-checkout", width);

    const homeSnapshot = await snapshot();
    await assertDraftNotPersisted();
    await reopen();
    assert.deepEqual(await snapshot(), homeSnapshot);
    await waitPayment(false);
    record("home-details-survive-close-and-reopen", width);

    await clickButton("Payer ");
    await page.waitForFunction(() => document.body.textContent.includes("Paiement fictif arrêté par le harnais."));
    const homeRequest = await page.evaluate(() => window.__fixture.requests.find(request => request.path === "/api/checkout/viva").body);
    assert.equal(homeRequest.shippingPhone, "0612345678");
    assert.equal(homeRequest.shippingAddress, "12 rue de la Commande");
    assert.equal(homeRequest.shippingEmail, "livraison@example.test");
    assert.equal(homeRequest.deliveryMethod, "home");
    assert.deepEqual(await snapshot(), homeSnapshot);
    record("real-checkout-button-sends-order-details-and-keeps-them-on-error", width);

    await clickButton("Point relais");
    await page.waitForFunction(() => [...document.querySelectorAll(".mondial-relay-widget button")].some(button => button.textContent.includes("Relais de démonstration")));
    await waitPayment(true);
    await clickButton("Relais de démonstration"); await relaySelected(); await waitPayment(false);
    const relaySnapshot = await snapshot();
    await reopen(); await relaySelected();
    assert.deepEqual(await snapshot(), relaySnapshot);
    await waitPayment(false);
    record("relay-selection-and-details-survive-close-and-reopen", width);
    await assertDraftNotPersisted();
    record("shipping-draft-is-not-written-to-browser-storage", width);

    await page.evaluate(() => { window.__fixture.user = { ...window.__fixture.user, firstName: "Profil actualisé", email: "profil@example.test", phone: "0699999999", address: "99 adresse du profil", city: "Nantes", postalCode: "44000", country: "Belgique" }; });
    await refresh();
    await page.waitForSelector('#fixture-state[data-email="profil@example.test"]');
    assert.deepEqual(await snapshot(), relaySnapshot);
    await relaySelected(); await waitPayment(false);
    record("profile-refresh-does-not-overwrite-edited-shipping", width);

    await trigger("#fixture-remount");
    await page.waitForSelector('dialog[open] input[aria-label="Nom complet"]');
    await relaySelected(); await waitPayment(false);
    assert.deepEqual(await snapshot(), relaySnapshot);
    record("shipping-and-relay-survive-drawer-remount", width);

    await clickButton("Payer ");
    await page.waitForFunction(() => window.__fixture.requests.filter(request => request.path === "/api/checkout/viva").length === 2);
    const relayRequest = await page.evaluate(() => window.__fixture.requests.filter(request => request.path === "/api/checkout/viva").at(-1).body);
    assert.equal(relayRequest.deliveryMethod, "relay");
    assert.equal(relayRequest.relayId, "AUDIT-RELAY");
    assert.equal(relayRequest.shippingPhone, "0612345678");
    await page.screenshot({ path: resolve(output, `relay-preserved-${width}.png`), fullPage: true });
    record("real-checkout-button-sends-preserved-relay", width);

    for (const mode of ['unavailable', 'network-error']) {
      await page.evaluate(value => { window.__fixture.meMode = value; }, mode);
      await refresh();
      assert.deepEqual(await snapshot(), relaySnapshot);
      assert.equal(await page.$eval('#fixture-state', state => state.dataset.user), 'customer-a');
      await waitPayment(false);
    }
    await page.evaluate(() => { window.__fixture.meMode = 'ready'; });
    record("temporary-session-errors-preserve-customer-and-draft", width);

    await fill('Ville', ''); await waitPayment(true);
    await relayAvailable();
    await clickButton('Relais de démonstration'); await relaySelected(); await waitPayment(false);
    record("changing-city-requires-a-new-relay-selection", width);

    await fill('Code postal', ''); await waitPayment(true);
    await fill('Code postal', '35000'); await relayAvailable();
    await clickButton('Relais de démonstration'); await relaySelected(); await waitPayment(false);
    record("changing-postcode-requires-a-new-relay-selection", width);

    await clickButton('Domicile'); await fill('Adresse de livraison', '');
    await clickButton('Point relais'); await relaySelected(); await waitPayment(false);
    record("selected-relay-does-not-require-a-home-address", width);

    await fill('Pays', 'Belgique'); await fill('Code postal', '1000');
    await fill('Ville', 'Bruxelles'); await fill('Téléphone', '+32470123456');
    await waitPayment(true); await relayAvailable('Relais belge de démonstration');
    const belgianLookup = await page.evaluate(() => window.__fixture.requests.filter(request => request.path === '/api/relay/points').at(-1));
    assert.deepEqual(belgianLookup.query, { postalCode: '1000', country: 'BE', city: 'Bruxelles' });
    await clickButton('Relais belge de démonstration'); await relaySelected('Relais belge de démonstration');
    await waitPayment(false); await clickButton('Payer ');
    await page.waitForFunction(() => window.__fixture.requests.filter(request => request.path === '/api/checkout/viva').length === 3);
    const belgianRequest = await page.evaluate(() => window.__fixture.requests.filter(request => request.path === '/api/checkout/viva').at(-1).body);
    assert.equal(belgianRequest.shippingCountry, 'Belgique');
    assert.equal(belgianRequest.shippingPhone, '+32470123456');
    assert.equal(belgianRequest.deliveryMethod, 'relay');
    assert.equal(belgianRequest.deliveryFeeEur, relayRequest.deliveryFeeEur);
    assert.equal(belgianRequest.relayId, 'AUDIT-RELAY-BE');
    assert.equal(belgianRequest.relayCountry, 'BE');
    assert.equal(belgianRequest.relayPostalCode, '1000');
    assert.equal(belgianRequest.relayCity, 'Bruxelles');
    await assertDraftNotPersisted();
    await page.screenshot({ path: resolve(output, `belgian-relay-${width}.png`), fullPage: true });
    record("belgian-country-name-and-phone-reach-relay-checkout", width);

    await fill('Pays', 'France'); await waitPayment(true);
    assert.equal(await page.$$eval('.mondial-relay-widget button[aria-pressed="true"]', buttons => buttons.length), 0);
    assert.equal(await page.$eval('.mondial-relay-widget', widget => widget.textContent.includes('Point sélectionné:')), false);
    await fill('Code postal', '35000'); await fill('Ville', 'Rennes'); await relayAvailable();
    await clickButton('Relais de démonstration'); await relaySelected(); await waitPayment(false);
    await clickButton('Payer ');
    await page.waitForFunction(() => window.__fixture.requests.filter(request => request.path === '/api/checkout/viva').length === 4);
    const switchedCountryRequest = await page.evaluate(() => window.__fixture.requests.filter(request => request.path === '/api/checkout/viva').at(-1).body);
    assert.equal(switchedCountryRequest.shippingCountry, 'France');
    assert.equal(switchedCountryRequest.relayId, 'AUDIT-RELAY');
    assert.equal(switchedCountryRequest.relayCountry, 'FR');
    record("changing-country-clears-belgian-relay-and-allows-french-selection", width);

    await trigger("#fixture-second");
    await page.waitForFunction(() => document.querySelector('input[aria-label="Nom complet"]')?.value === "Alex Exemple");
    assert.equal(await valueOf("Email"), "alex@example.test");
    assert.equal(await valueOf("Téléphone"), "");
    assert.equal(await valueOf("Adresse de livraison"), "");
    assert.equal(await page.$(".mondial-relay-widget"), null);
    await waitPayment(true);
    record("switching-account-clears-previous-customer-details-and-relay", width);

    await fillOrder(); await waitPayment(false);
    await trigger("#fixture-logout");
    await page.waitForSelector('#fixture-state[data-user=""]');
    assert.equal(await page.$('dialog[open] input[aria-label="Téléphone"]'), null);
    await trigger("#fixture-first");
    await page.waitForSelector('dialog[open] input[aria-label="Téléphone"]');
    assert.equal(await valueOf("Téléphone"), "");
    assert.equal(await valueOf("Adresse de livraison"), "");
    await waitPayment(true);
    record("logout-clears-shipping-before-another-login", width);

    await fillOrder(); await waitPayment(false);
    await trigger("#fixture-clear");
    await page.waitForSelector('#fixture-state[data-count="0"]');
    await trigger("#fixture-add");
    await page.waitForSelector('dialog[open] input[aria-label="Téléphone"]');
    assert.equal(await valueOf("Téléphone"), "");
    assert.equal(await valueOf("Adresse de livraison"), "");
    await waitPayment(true);
    record("empty-cart-clears-order-draft", width);

    await fillOrder();
    await fill('Téléphone', '');
    await page.evaluate(() => { window.__fixture.user = { ...window.__fixture.user, phone: '0699999999' }; });
    await refresh();
    assert.equal(await valueOf('Téléphone'), '');
    await waitPayment(true);
    record("explicitly-cleared-fields-stay-empty-after-profile-refresh", width);

    const beforeDelayedRefresh = await page.$eval('#fixture-state', state => Number(state.dataset.refreshed));
    await page.evaluate(() => { window.__fixture.meMode = 'delayed'; });
    await trigger('#fixture-refresh');
    await page.waitForFunction(() => Boolean(window.__fixture.releaseMe));
    await trigger('#fixture-logout');
    await page.waitForSelector('#fixture-state[data-user=""]');
    await page.evaluate(() => { window.__fixture.meMode = 'ready'; window.__fixture.releaseMe(); });
    await page.waitForFunction(count => Number(document.querySelector('#fixture-state').dataset.refreshed) > count, {}, beforeDelayedRefresh);
    assert.equal(await page.$eval('#fixture-state', state => state.dataset.user), '');
    assert.equal(await page.$('dialog[open] input[aria-label="Téléphone"]'), null);
    record("late-session-refresh-cannot-restore-a-logged-out-customer", width);

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Document must fit the viewport");
    assert.equal(await page.$eval("dialog[open]", dialog => dialog.scrollWidth > dialog.clientWidth + 1), false, "Cart must fit the viewport");
    unexpectedApis.push(...await page.evaluate(() => window.__fixture.unexpected));
    record("cart-fits-viewport", width);

    await page.goto(`http://127.0.0.1:${port}/?scenario=register`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#fixture-state[data-ready="true"]');
    await fillSelector('#fixture-register input[name="given-name"]', 'Camille');
    await fillSelector('#fixture-register input[name="family-name"]', 'Exemple');
    await fillSelector('#fixture-register input[type="email"]', 'camille@example.test');
    await fillSelector('#fixture-register input[type="password"]', 'demonstration-only-password');
    await page.$eval('#fixture-register input[type="date"]', input => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '1990-01-01');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await trigger('#fixture-register button[type="submit"]');
    await page.waitForSelector('#fixture-register a');
    const registration = await page.evaluate(() => window.__fixture.requests.find(request => request.path === '/api/account/register').body);
    assert.equal(registration.next, '/boutique?panier=1');
    assert.equal(registration.phone, '');
    assert.equal(registration.address, '');
    const registrationLink = await page.$eval('#fixture-register a', link => link.getAttribute('href'));
    assert.equal(new URL(registrationLink, 'http://localhost').searchParams.get('next'), '/boutique?panier=1');
    unexpectedApis.push(...await page.evaluate(() => window.__fixture.unexpected));
    record("registration-keeps-checkout-return-without-optional-address", width);

    await page.goto(`http://127.0.0.1:${port}/?scenario=login`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#fixture-state[data-ready="true"][data-user=""]');
    await trigger('#fixture-add');
    await fillSelector('#fixture-login input[type="email"]', 'camille@example.test');
    await fillSelector('#fixture-login input[type="password"]', 'demonstration-only-password');
    await trigger('#fixture-login button[type="submit"]');
    await page.waitForSelector('#fixture-state[data-user="customer-a"]', { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => window.__fixture.navigation), [{ method: 'replace', url: '/boutique?panier=1' }]);
    assert.equal(await page.$eval('#fixture-state', state => state.dataset.count), '1');
    await trigger('#fixture-open');
    await page.waitForSelector('dialog[open] input[aria-label="Nom complet"]');
    assert.equal(await valueOf('Nom complet'), 'Camille Exemple');
    unexpectedApis.push(...await page.evaluate(() => window.__fixture.unexpected));
    record("login-immediately-updates-cart-and-keeps-checkout-return", width);

    await page.goto(`http://127.0.0.1:${port}/?scenario=bitcoin`, { waitUntil: "networkidle0" });
    await page.waitForSelector('#fixture-state[data-ready="true"]');
    await trigger("#fixture-add");
    await trigger("#fixture-open");
    await page.waitForSelector('dialog[open] input[aria-label="Nom complet"]');
    if (width === 320) {
      await page.waitForSelector('[data-ui-commerce="cart-mobile"] button', { visible: true });
      await trigger('[data-ui-commerce="cart-mobile"] button');
      assert.equal(await page.evaluate(() => document.activeElement.closest("[data-checkout-payment-methods]") !== null), true);
      record("mobile-summary-focuses-payment-methods", width);
    }
    await fillOrder();
    await waitPayment(true);
    await page.waitForSelector(disabledBitcoin, { visible: true });
    await page.waitForFunction(() => Boolean(window.__fixture.releaseBitcoin));
    assert.equal(await page.$eval(disabledBitcoin, input => document.getElementById(input.getAttribute("aria-describedby")).textContent.trim()),
      "Vérification de la disponibilité de Bitcoin…");
    await selectPayment("card");
    await waitPayment(false, false);
    await clickButton("Payer ");
    await page.waitForFunction(() => document.querySelector('dialog[open] [role="alert"]')?.textContent.includes("Paiement fictif"));
    const cardAttempt = await page.evaluate(() => window.__fixture.requests.find(request =>
      request.path === "/api/checkout/viva").body);
    assert.equal(cardAttempt.paymentMethod, "card");
    record("card-remains-usable-while-bitcoin-availability-is-checked", width);
    await page.evaluate(() => { window.__fixture.conflict = "bitcoin"; });
    await clickButton("Payer ");
    const bitcoinResumeLink = 'dialog[open] a[href="/checkout/bitcoin/AUDIT-BITCOIN"]';
    await page.waitForSelector(bitcoinResumeLink, { visible: true });
    assert.equal(await page.$eval(bitcoinResumeLink, link => link.textContent.trim()), "Reprendre le paiement Bitcoin");
    assert.equal(new URL(page.url()).searchParams.get("scenario"), "bitcoin");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("checkout:bitcoin:cart:AUDIT-BITCOIN")), null);
    record("existing-bitcoin-checkout-offers-explicit-resume-without-snapshot", width);

    await page.evaluate(() => { window.__fixture.releaseBitcoin(); window.__fixture.conflict = true; });
    await page.waitForSelector('dialog[open] input[value="bitcoin_lightning"]:enabled');
    await selectPayment("bitcoin_lightning");
    await clickButton("Payer ");
    const resumeLink = 'dialog[open] a[href="/api/account/orders/AUDIT-CARD/resume-payment"]';
    await page.waitForSelector(resumeLink, { visible: true });
    assert.equal(await page.$eval(resumeLink, link => link.textContent.trim()), "Reprendre le paiement par carte");
    assert.equal(new URL(page.url()).searchParams.get("scenario"), "bitcoin");
    assert.equal(await page.$eval("#fixture-state", state => state.dataset.count), "1");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("checkout:viva:pending-payment")), null);
    record("method-conflict-offers-explicit-resume-without-redirect", width);
    await page.evaluate(() => { window.__fixture.conflict = false; window.__fixture.retryBitcoin = "archived"; });
    await Promise.all([page.waitForNavigation(), clickButton("Payer ")]);
    await page.waitForSelector('a[href="https://checkout.example.test/fake-invoice"]');
    const bitcoinAttempts = await page.evaluate(() => JSON.parse(sessionStorage.getItem("audit:bitcoin-attempts") ?? "[]"));
    assert.equal(bitcoinAttempts.length, 4);
    assert.equal(bitcoinAttempts[0], cardAttempt.checkoutAttemptId);
    assert.equal(bitcoinAttempts[1], cardAttempt.checkoutAttemptId);
    assert.notEqual(bitcoinAttempts[2], cardAttempt.checkoutAttemptId);
    assert.equal(bitcoinAttempts[3], bitcoinAttempts[2]);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("audit:bitcoin-attempt")), bitcoinAttempts[2]);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("checkout:viva:pending-payment")), null);
    assert.equal(await page.$eval("#fixture-state", state => state.dataset.count), "1");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    record("archived-checkout-renews-once-and-busy-reuses-the-fresh-key", width);

    // A changed cart must survive even after the original order is confirmed.
    if (width === 320) {
      await trigger("#fixture-add");
      await page.waitForSelector('#fixture-state[data-count="2"]');
    }
    await page.evaluate(() => {
      window.__fixture.bitcoinState = "review";
      window.dispatchEvent(new Event("pageshow"));
    });
    await page.waitForFunction(() => document.querySelector('section [role="status"]')?.textContent.includes("Paiement à vérifier"));
    await page.evaluate(() => { window.__fixture.bitcoinState = "paid"; });
    await page.waitForFunction(() => document.querySelector('section [role="status"]')?.textContent.includes("Paiement confirmé"));
    await page.waitForSelector(`#fixture-state[data-count="${width === 320 ? 2 : 0}"]`);
    unexpectedApis.push(...await page.evaluate(() => window.__fixture.unexpected));
    record(width === 320 ? "confirmed-bitcoin-keeps-changed-cart" : "confirmed-bitcoin-clears-matching-cart", width);

    await page.goto(`http://127.0.0.1:${port}/?scenario=bitcoin-error`, { waitUntil: "networkidle0" });
    await page.waitForSelector('#fixture-state[data-ready="true"]');
    await trigger("#fixture-add");
    await trigger("#fixture-open");
    await page.waitForSelector(disabledBitcoin, { visible: true });
    assert.equal(await page.$eval(disabledBitcoin, input => document.getElementById(input.getAttribute("aria-describedby")).textContent.trim()),
      "La disponibilité de Bitcoin n’a pas pu être vérifiée.");
    await fillOrder();
    await waitPayment(true);
    await selectPayment("card");
    await waitPayment(false, false);
    unexpectedApis.push(...await page.evaluate(() => window.__fixture.unexpected));
    record("card-remains-usable-when-bitcoin-availability-fails", width);
  }
  await page.goto(`http://127.0.0.1:${port}/?scenario=profile-orders&tab=commandes`, { waitUntil: "networkidle0" });
  const orderEntry = '[data-ui-account="order-entry"]';
  await page.waitForSelector(orderEntry);
  await trigger(orderEntry);
  await page.waitForSelector('dialog[open][aria-label="Détail commande AUDIT-BITCOIN"]');
  await page.evaluate(() => { window.__fixture.bitcoinState = "paid"; });
  await page.waitForFunction(() => document.querySelector("dialog[open]")?.textContent.includes("Bitcoin (Lightning) : Payé"));
  assert.match(await page.$eval(orderEntry, node => node.textContent), /Paiement: Payé/);
  unexpectedApis.push(...await page.evaluate(() => window.__fixture.unexpected));
  record("profile-shows-confirmation-in-list-and-open-detail", 1440);
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedRequests, []);
  assert.deepEqual(unexpectedApis, []);
  console.log(`Checkout continuity audit passed: ${results.length} checks.`);
} catch (error) {
  failure = error;
  throw error;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, "report.json"), JSON.stringify({ passed: !failure && errors.length === 0 && blockedRequests.length === 0 && unexpectedApis.length === 0, widths, results, errors, blockedRequests, unexpectedApis, failure: failure?.stack }, null, 2));
  await browser?.close();
  await server.close();
}
