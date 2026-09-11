/** Read-only audit of the HTML actually delivered to visitors and crawlers. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

const baseUrl = process.argv[2] || 'https://www.leschanvriersbretons.com';
const label = process.argv[3] || 'current';
const verify = process.argv.includes('--verify');
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Invalid report label');
const output = resolve('output/seo-audit');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
try {
  const page = await browser.newPage();
  const sitemap = await fetch(new URL('/sitemap.xml', baseUrl)).then(r => r.text());
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const productPath = urls.map(url => new URL(url).pathname).find(path => /^\/boutique\/fleurs-cbd\/.+/.test(path));
  const paths = ['/', '/cbd-naturel', '/cbd-pas-cher', '/cbd-breton', '/boutique', '/boutique/fleurs-cbd', '/boutique/e-liquide-cbd', '/analyse-laboratoire-cbd', productPath].filter(Boolean);
  const pages = [];
  for (const path of paths) {
    const start = Date.now();
    const response = await fetch(new URL(path, baseUrl));
    const html = await response.text();
    const data = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const jsonLd = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(el => { try { return JSON.parse(el.textContent); } catch { return { error: 'invalid JSON' }; } });
      const links = [...doc.querySelectorAll('a[href]')].map(el => ({ href: el.getAttribute('href'), text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 100) }));
      return {
        title: doc.title,
        description: doc.querySelector('meta[name="description"]')?.content,
        canonical: [...doc.querySelectorAll('link[rel="canonical"]')].map(el => el.getAttribute('href')),
        hreflang: [...doc.querySelectorAll('link[hreflang]')].map(el => ({ lang: el.hreflang, href: el.getAttribute('href') })),
        robots: [...doc.querySelectorAll('meta[name="robots"]')].map(el => el.content),
        h1: [...doc.querySelectorAll('h1')].map(el => el.textContent.trim()),
        h2: [...doc.querySelectorAll('h2')].map(el => el.textContent.trim()),
        jsonLdTypes: jsonLd.map(item => item['@type']),
        breadcrumbs: jsonLd.filter(item => item['@type'] === 'BreadcrumbList').map(item => item.itemListElement.map(el => el.item)),
        productLists: jsonLd.filter(item => item['@type'] === 'ItemList').map(item => ({ count: item.numberOfItems, urls: item.itemListElement.map(el => el.item?.url || el.url) })),
        invalidJsonLd: jsonLd.filter(item => item.error).length,
        productLinks: [...new Set(links.filter(el => /^\/boutique\/[^/]+\/.+/.test(el.href)).map(el => el.href))],
        categoryLinks: [...new Set(links.filter(el => /^\/boutique\/[^/]+$/.test(el.href)).map(el => el.href))],
        guideLinks: links.filter(el => ['/cbd-naturel', '/cbd-pas-cher', '/cbd-breton', '/analyse-laboratoire-cbd'].includes(el.href)),
        comparisonRows: doc.querySelectorAll('[data-price-comparison] tbody tr').length,
      };
    }, html);
    pages.push({ path, status: response.status, finalUrl: response.url, bytes: Buffer.byteLength(html), durationMs: Date.now() - start, ...data });
    console.log(JSON.stringify({ path, status: response.status, bytes: Buffer.byteLength(html), title: data.title, breadcrumbs: data.breadcrumbs.length, productLists: data.productLists.length, productLinks: data.productLinks.length, guideLinks: data.guideLinks.length, comparisonRows: data.comparisonRows }));
    if (verify) {
      assert.equal(response.status, 200, path);
      assert.equal(data.h1.length, 1, `${path}: one main heading`);
      assert.equal(data.canonical.length, 1, `${path}: one canonical`);
      assert.equal(new URL(data.canonical[0]).pathname, path, `${path}: canonical matches the page`);
      assert.equal(data.invalidJsonLd, 0, `${path}: valid structured data`);
      assert(!data.robots.some(value => value.includes('noindex')), `${path}: indexable`);
      if (path.startsWith('/boutique')) {
        assert.equal(data.breadcrumbs.length, 1, `${path}: one breadcrumb trail`);
        assert.equal(data.productLists.length, 0, `${path}: no inherited catalogue offers`);
        assert(data.guideLinks.some(link => link.href === '/cbd-pas-cher'), `${path}: price guide linked`);
        assert(data.guideLinks.some(link => link.href === '/cbd-naturel'), `${path}: natural guide linked`);
      }
      if (path === '/boutique') assert(data.categoryLinks.includes('/boutique/fleurs-cbd'));
      if (path === productPath) assert(data.jsonLdTypes.includes('Product'));
      if (path === '/cbd-pas-cher') assert(data.comparisonRows > 0, 'Live flower price comparison');
    }
  }
  await writeFile(resolve(output, `${label}.json`), JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl, sitemapCount: urls.length, duplicateSitemapUrls: urls.length - new Set(urls).size, pages }, null, 2));
} finally { await browser.close(); }
