/** Real popup/dialog/history/styles, isolated fixture CMS and navigation. No backend calls. */
import { createServer } from 'vite';
import ts from 'typescript';
import tailwindcss from '@tailwindcss/postcss';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'output/new-products-popup');
const port = 3277;
const storageKey = 'lcb_new_products_popup';
const products = [
  { id: 'fleur-demo', name: 'Fleur bretonne de démonstration', category: 'fleurs', cultureMode: 'indoor', price: 12.5, image: '/product_flower.jpg' },
  { id: 'resine-demo', name: 'Résine du marché', category: 'resines', price: 8.9, image: '/product_resin.jpg' },
  { id: 'tisane-demo', name: 'Tisane des longues soirées', category: 'alimentaire', price: 14, image: '/product_tea.jpg' },
  { id: 'accessoire-demo', name: 'Accessoire au nom particulièrement long pour vérifier sa lisibilité', category: 'accessoires', price: 1234.56, image: '/mascots/boutique-market.png' },
].map(product => ({ ...product, featuredInPopup: true, description: 'Description de démonstration pour vérifier le texte, le prix et le bouton sans données de production.' }));
const signature = products.map(product => product.id).sort().join(',');
const modules = {
  'popup-preview.tsx': `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import '/src/app/globals.css'; import '/src/app/site-ui-preview.css';
    import {NewProductsPopup} from '/src/components/NewProductsPopup'; import {usePathname} from 'next/navigation';
    function Preview(){const path=usePathname();return <><main id="fixture-main" data-path={path} style={{padding:'80px 24px',minHeight:'100vh',background:'#f6f0e6'}}><h1>Le marché</h1><p>Les nouveautés sélectionnées pour vous.</p><button id="outside-button" style={{minHeight:44}}>Continuer la visite</button></main><NewProductsPopup/></>}
    createRoot(document.getElementById('root')).render(<React.StrictMode><Preview/></React.StrictMode>);
  `,
  'preview-store': `const store=window.__popupFixture.store; export const useCmsStore=()=>({store,loading:false});`,
  'preview-consent': `const consent={essential:true,analytics:false,marketing:false};export const useCookieConsent=()=>({consent,showBanner:false});`,
  'preview-navigation': `export {useRouter} from 'next/navigation';export const NavigationPending=()=>null;`,
  'next/image': `import React from 'react';export default function Image({src,fill,priority,preload,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return React.createElement('img',{...props,src:typeof src==='string'?src:src.src,style:{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...props.style}})}`,
  'next/link': `import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({prefetch,scroll,replace,onClick,onNavigate,...props}){return React.createElement('a',{...props,onClick:e=>{onClick?.(e);if(!e.defaultPrevented&&typeof props.href==='string'&&props.href.startsWith('/')){e.preventDefault();window.__navigate(props.href,replace);}}})}`,
  'next/navigation': `import {useSyncExternalStore} from 'react';const subscribe=fn=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)};window.__navigate=(path,replace=false)=>{history[replace?'replaceState':'pushState']({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);const router={push:path=>window.__navigate(path),replace:path=>window.__navigate(path,true),back:()=>history.back(),refresh:()=>{}};export const useRouter=()=>router;`,
};
const server = await createServer({
  configFile: false, envDir: false, root, cacheDir: resolve(output, 'vite-cache'),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
  publicDir: resolve(root, 'public'), esbuild: { jsx: 'automatic' },
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@': resolve(root, 'src') } },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: 'isolated-new-products-popup', enforce: 'pre',
    resolveId(id) {
      for (const [suffix, stub] of [['/hooks/useCmsStore', 'preview-store'], ['/cookies/CookieConsentProvider', 'preview-consent'], ['/NavigationFeedback', 'preview-navigation']]) if (id.endsWith(suffix)) return '\0' + stub;
      if (id in modules) return '\0' + id;
    },
    load(id) {
      if (id === '\0popup-preview.tsx') return ts.transpileModule(modules['popup-preview.tsx'], { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
      if (id.startsWith('\0')) return modules[id.slice(1)];
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (!['/', '/boutique', '/boutique/fleurs-cbd', '/boutique/accessoires-cbd/accessoire-demo', '/blog', '/compte/connexion'].includes(req.url?.split('?')[0])) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(`<!doctype html><html lang="fr" data-site-ui="quartier"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit nouveautés du marché</title><style>@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0}</style><div id="root"></div><script type="module" src="/@id/__x00__popup-preview.tsx"></script></html>`);
      });
    },
  }],
  server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: { ignored: ['**/output/**', '**/.next/**'] } },
});

let browser;
const results = [], errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const record = (test, data = {}) => { results.push({ test, passed: true, ...data }); console.log('PASS', test); };
const selector = '[data-new-products-popup][open]';
try {
  await mkdir(output, { recursive: true }); await server.listen();
  browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  async function fixture({ path = '/boutique', stored, fixtureProducts = products, updatedAt = 'fixture-v1', blocked = false, viewport = { width: 390, height: 844 } } = {}) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(); await page.setViewport(viewport);
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => { const url = new URL(request.url()); void (url.protocol === 'data:' || (url.hostname === '127.0.0.1' && url.port === String(port) && !url.pathname.startsWith('/api/')) ? request.continue() : request.abort()); });
    await page.evaluateOnNewDocument(({ stored, store, blocked, storageKey }) => {
      window.__popupFixture = { store };
      if (stored !== undefined) localStorage.setItem(storageKey, stored);
      if (blocked) { Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; }
    }, { stored, store: { products: fixtureProducts, updatedAt }, blocked, storageKey });
    await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle0', timeout: 60000 });
    return { page, close: () => context.close() };
  }
  const shown = page => page.waitForSelector(selector, { timeout: 12000 });
  async function absent(page) { await pause(2700); assert.equal(await page.$(selector), null); }
  async function navigate(page, path) { await page.evaluate(path => window.__navigate(path), path); await page.waitForFunction(path => document.querySelector('#fixture-main')?.dataset.path === path, {}, path); }

  const visual = await fixture(); await shown(visual.page);
  for (const [width, height] of [[320, 568], [390, 844], [768, 900], [1440, 900], [844, 390], [568, 320]]) {
    const page = visual.page; await page.setViewport({ width, height });
    await page.$eval('[data-app-dialog-body]', element => { element.scrollTop = 0; });
    await page.evaluate(() => document.fonts.ready); await pause(150);
    const metrics = await page.evaluate(() => {
      const dialog = document.querySelector('[data-new-products-popup]'); const body = dialog.querySelector('[data-app-dialog-body]');
      const rect = dialog.getBoundingClientRect(); const close = dialog.querySelector('[aria-label="Fermer"]').getBoundingClientRect();
      return {
        viewport: [innerWidth, innerHeight], documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        dialogFits: rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1,
        contentFits: body.scrollWidth <= body.clientWidth + 1 && [...dialog.querySelectorAll('article')].every(node => node.scrollWidth <= node.clientWidth + 1),
        closeVisible: close.top >= 0 && close.bottom <= innerHeight,
        controls: [...dialog.querySelectorAll('button,a[href]')].map(node => { const r = node.getBoundingClientRect(); return { label: node.getAttribute('aria-label'), width: r.width, height: r.height }; }),
        photosLoaded: [...dialog.querySelectorAll('[data-product-photo] img')].every(node => node.complete && node.naturalWidth > 0),
        artLoaded: [...dialog.querySelectorAll('[data-kq-chapter] img')].every(node => node.complete && node.naturalWidth > 0),
        panelMaterial: getComputedStyle(dialog).borderImageSource,
      };
    });
    assert.equal(metrics.documentOverflow, false); assert(metrics.dialogFits); assert(metrics.contentFits); assert(metrics.closeVisible);
    assert(metrics.photosLoaded); assert(metrics.artLoaded); assert.equal(metrics.controls.length, 5);
    assert(metrics.controls.every(control => control.width >= 44 && control.height >= 44)); assert.match(metrics.panelMaterial, /panel-paper-v1/);
    await page.screenshot({ path: resolve(output, `popup-${width}x${height}.png`) });
    await page.$eval('[data-app-dialog-body]', element => { element.scrollTop = element.scrollHeight; });
    assert(await page.$eval('[aria-label="Fermer"]', element => { const r = element.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    await page.screenshot({ path: resolve(output, `popup-scrolled-${width}x${height}.png`) });
    record(`Responsive four-product popup ${width}x${height}`, metrics);
  }
  await visual.page.focus('[aria-label="Fermer"]'); await visual.page.keyboard.down('Shift'); await visual.page.keyboard.press('Tab'); await visual.page.keyboard.up('Shift');
  assert.equal(await visual.page.evaluate(() => document.activeElement === document.querySelector('[data-new-products-popup] article:last-child a')), true);
  await visual.page.keyboard.press('Tab'); assert.equal(await visual.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Fermer');
  for (let index = 0; index < 8; index++) { await visual.page.keyboard.press('Tab'); assert(await visual.page.evaluate(() => !!document.activeElement?.closest('[data-new-products-popup]'))); }
  await visual.page.keyboard.press('Escape'); await visual.page.waitForFunction(() => !document.querySelector('[data-new-products-popup]'));
  assert.equal(await visual.page.evaluate(() => location.pathname), '/boutique'); assert.notEqual(await visual.page.evaluate(() => document.body.style.overflow), 'hidden');
  record('Keyboard focus cycles within popup; Escape closes and restores scrolling'); await visual.close();

  for (const [name, options, expected] of [
    ['No selected products', { fixtureProducts: [] }, false],
    ['Malformed localStorage JSON', { stored: '{broken-json' }, true],
    ['Recent same selection after unrelated CMS update', { stored: JSON.stringify({ signature, dismissedAt: Date.now() - 60000 }), updatedAt: 'unrelated-edit-v2' }, false],
    ['Recently dismissed selection with a changed featured ID', { stored: JSON.stringify({ signature: 'previous-product', dismissedAt: Date.now() - 60000 }) }, true],
    ['Same selection after 24-hour expiry', { stored: JSON.stringify({ signature, dismissedAt: Date.now() - 25 * 60 * 60 * 1000 }) }, true],
  ]) {
    const test = await fixture(options); if (expected) await shown(test.page); else await absent(test.page); record(name); await test.close();
  }
  const blocked = await fixture({ blocked: true }); await shown(blocked.page); await blocked.page.click('[aria-label="Fermer"]');
  await blocked.page.waitForFunction(() => !document.querySelector('[data-new-products-popup]')); await pause(100);
  await navigate(blocked.page, '/blog'); await navigate(blocked.page, '/boutique'); await absent(blocked.page);
  record('Blocked localStorage still dismisses and remembers dismissal after client return'); await blocked.close();

  for (const path of ['/', '/blog', '/boutique/fleurs-cbd', '/boutique/accessoires-cbd/accessoire-demo', '/compte/connexion']) {
    const test = await fixture({ path }); await absent(test.page); record('No popup outside market entry: ' + path); await test.close();
  }
  const navigation = await fixture({ path: '/blog' }); await navigate(navigation.page, '/boutique'); await pause(200); await navigate(navigation.page, '/blog'); await absent(navigation.page);
  await navigate(navigation.page, '/boutique'); await shown(navigation.page); record('Leaving cancels delayed open; next client entry can open');
  await navigation.page.click('[data-new-products-popup] article:last-child a');
  await navigation.page.waitForFunction(() => location.pathname === '/boutique/accessoires-cbd/accessoire-demo');
  assert.equal(await navigation.page.$(selector), null); await navigation.page.goBack();
  await navigation.page.waitForFunction(() => location.pathname === '/boutique'); await absent(navigation.page);
  record('Product link cleans overlay history; Back returns to market without reopening'); await navigation.close();
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error);
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ results, errors, scope: 'Real NewProductsPopup, AppDialog, overlay history, chapter artwork, globals.css and site-ui-preview.css; simulated CMS, consent and navigation; all external/API requests blocked.' }, null, 2));
  await browser?.close(); await server.close();
}
console.log(`New-products popup audit: ${results.length} checks passed, ${errors.length} errors.`);
