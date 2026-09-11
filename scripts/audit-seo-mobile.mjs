/** Mobile rendering and navigation checks; no login or purchase. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const baseUrl = process.argv[2] || 'http://127.0.0.1:3105';
const productionImages = process.argv.includes('--production-images');
if (productionImages && !['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) throw new Error('Image proxy is for local verification only');
const output = resolve('output/seo-audit');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const results = [], errors = [];
let page;
try {
  page = await browser.newPage();
  if (productionImages) {
    // Local DNS64 is rejected by Next's private-IP check. Verify the unchanged
    // images through the real production optimizer, without altering app config.
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      if (url.origin !== new URL(baseUrl).origin || url.pathname !== '/_next/image') return request.continue();
      try {
        const response = await fetch(`https://www.leschanvriersbretons.com${url.pathname}${url.search}`);
        await request.respond({ status: response.status, contentType: response.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) });
      } catch { await request.abort(); }
    });
  }
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: width < 700 ? 844 : 1000, isMobile: width < 700, hasTouch: width < 700 });
    for (const path of ['/cbd-naturel', '/cbd-pas-cher', '/boutique/fleurs-cbd']) {
      await page.goto(new URL(path, baseUrl).href, { waitUntil: 'networkidle2', timeout: 60000 });
      if (new URL(page.url()).pathname === '/age-gate') {
        const confirm = 'button::-p-text(Oui, j\'ai 18 ans ou plus)';
        await page.waitForSelector(confirm, { visible: true });
        await page.$eval(confirm, button => button.click());
        await page.waitForFunction(expected => location.pathname === expected, {}, path);
        await page.waitForSelector('article.product-card', { visible: true });
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
      }
      assert.equal(new URL(page.url()).pathname, path, 'Audit the requested page, not an interstitial');
      const reject = await page.$('button::-p-text(Tout refuser)');
      if (reject) await reject.click();
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        brokenImages: [...document.images].filter(img => img.complete && !img.naturalWidth).map(img => img.src),
        headings: [...document.querySelectorAll('h1')].map(el => el.textContent),
        comparisonScrollable: (() => { const region = document.querySelector('[data-price-comparison] [role="region"]'); return region ? region.scrollWidth > region.clientWidth : null; })(),
      }));
      assert.equal(layout.overflow, false, `${path} at ${width}: overflow`);
      assert.deepEqual(layout.brokenImages, [], `${path}: images`);
      assert.equal(layout.headings.length, 1);
      if (path === '/cbd-pas-cher' && width < 700) assert(layout.comparisonScrollable);
      await page.screenshot({ path: resolve(output, `${path.split('/').at(-1)}-${width}.png`) });
      if (path === '/cbd-pas-cher') {
        await page.$eval('[data-price-comparison]', el => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
        await page.screenshot({ path: resolve(output, `comparison-${width}.png`) });
      }
      results.push({ path, width, ...layout });
      console.log(JSON.stringify(results.at(-1)));
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'mobile.json'), JSON.stringify({ baseUrl, productionImages, results, errors, passed: true }, null, 2));
} catch (error) {
  if (page) {
    await page.screenshot({ path: resolve(output, 'mobile-failure.png') });
    console.error(JSON.stringify({ url: page.url(), errors, completed: results.length }));
  }
  throw error;
} finally { await browser.close(); }
