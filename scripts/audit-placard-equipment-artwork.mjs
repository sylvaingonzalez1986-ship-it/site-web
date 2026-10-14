// Read-only UI checks against audit-placard-warehouse-v4.mjs --preview.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const origin = process.env.KQ_EQUIPMENT_ARTWORK_ORIGIN ?? 'http://127.0.0.1:3277';
const targeted = process.argv.includes('--targeted');
const families = targeted ? ['lighting', 'air'] : ['lighting', 'air', 'water', 'climate', 'control', 'hygiene', 'logistics', 'security', 'substrate', 'nutrition', 'drying', 'storage'];
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Only a local fixture may be audited');
const output = resolve('output/equipment-sylvain');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
const errors = [], checks = [], assets = new Set();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).pathname !== '/favicon.ico') errors.push(`${response.status()} ${response.url()}`); });
await page.setRequestInterception(true);
page.on('request', request => void (request.url().startsWith(origin + '/') || request.url().startsWith('data:') ? request.continue() : request.abort()));
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const visit = async () => {
  await page.goto(origin + '/?expanded', { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-warehouse-map]');
  await page.evaluate(() => document.fonts.ready);
  await settle();
};
const fits = async () => {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No page overflow');
};
const inspectImages = async (selector, containerSelector, expectedCount) => {
  const nodes = await page.$$(selector);
  assert.equal(nodes.length, expectedCount, selector);
  const sources = [];
  for (const node of nodes) {
    await node.evaluate(image => image.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await node.evaluate(image => image.decode());
    await settle();
    const result = await node.evaluate((image, containerSelector) => {
      const box = image.getBoundingClientRect(), parent = image.closest(containerSelector).getBoundingClientRect();
      return { src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight,
        fit: getComputedStyle(image).objectFit,
        contained: box.left >= parent.left - 1 && box.right <= parent.right + 1 && box.top >= parent.top - 1 && box.bottom <= parent.bottom + 1 };
    }, containerSelector);
    assert.equal(result.width, 512, result.src);
    assert.equal(result.height, 512, result.src);
    assert.equal(result.fit, 'contain', 'The entire object is shown: ' + result.src);
    assert.equal(result.contained, true, 'The image stays inside its card: ' + result.src);
    assets.add(result.src); sources.push(result.src);
  }
  assert.equal(new Set(sources).size, expectedCount, 'Each tier uses a distinct image');
};

try {
  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: 1000, isMobile: width < 600, hasTouch: width < 600 });
    await visit(); await page.click('[data-warehouse-action="shop"]');
    await page.waitForSelector('[data-warehouse-shop]', { visible: true });
    for (const family of families) {
      await page.click(`[data-warehouse-shop-category="${family}"]`); await settle();
      await inspectImages('[data-warehouse-product-artwork]', '[data-warehouse-shop-product]', 3);
      await fits();
      await page.$eval('[data-warehouse-shop-product]', node => node.scrollIntoView({ block: 'start' }));
      await settle();
      await page.screenshot({ path: resolve(output, `shop-${family}-${width}.png`) });
    }
    checks.push(`${families.length} families / ${families.length * 3} distinct decoded images, complete objects, no overflow at ${width}px`);
    await page.keyboard.press('Escape');
    await page.click('[data-warehouse-room="processing"]');
    await page.waitForSelector('[data-workshop-tiers]');
    const machines = await page.evaluate(targeted => window.__machines.filter(machine => !targeted || machine.code === 'SIFT-TRAY'), targeted);
    assert.equal(machines.length, targeted ? 1 : 6);
    for (const machine of machines) {
      await page.click(`[data-warehouse-slot="${machine.slot}"]`);
      await page.waitForSelector(`[data-workshop-tiers="${machine.code}"]`);
      await inspectImages('[data-workshop-tier-artwork]', '[data-workshop-tier]', 3);
      await inspectImages('[data-workshop-inventory-artwork]', 'article', 1);
      await fits();
      await page.$eval('[data-workshop-tiers]', node => node.scrollIntoView({ block: 'start' }));
      await settle();
      await page.screenshot({ path: resolve(output, `workshop-${machine.code}-${width}.png`) });
    }
    checks.push(`${machines.length} workshop machines / ${machines.length * 3} tier images and ${machines.length} inventory heroes at ${width}px`);
    assert.deepEqual(await page.evaluate(() => [...window.__requests, ...window.__equipmentRequests]), [], 'Browsing never buys or changes the plan');
  }
  assert.equal(assets.size, targeted ? 9 : 54);
  assert.deepEqual(errors, []);
  const report = { passed: true, checks, uniqueAssets: assets.size, errors };
  await writeFile(resolve(output, targeted ? 'targeted-report.json' : 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ message: error.message, checks, errors }, null, 2));
  throw error;
} finally {
  await browser.close();
}
