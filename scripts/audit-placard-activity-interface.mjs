/** Run against audit-placard-navigation.mjs --preview --school-real on the same loopback port. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:' + Number(process.env.NAVIGATION_AUDIT_PORT ?? 3248);
const output = 'output/finition-interface/activites';
const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox', '--disable-webgl'] });
const checks = [];
let page;
try {
  page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  let failSchool = false, invalidStock = false;
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== origin && !['data:', 'blob:'].includes(url.protocol)) return void request.abort();
    if (request.method() !== 'GET') return void request.abort();
    if (failSchool && url.pathname === '/api/arena/placard/school') return void request.respond({ status: 503, contentType: 'application/json', body: '{"error":"Connexion interrompue."}' });
    if (invalidStock && url.pathname === '/api/arena/placard/collection') return void request.respond({ status: 200, contentType: 'application/json', body: '{"collection":{"cards":[{"code":"BOTTE-005","ownedCopies":null}]}}' });
    void request.continue();
  });
  const visit = query => page.goto(origin + '/arene/placard?scenario=cards&' + query, { waitUntil: 'domcontentloaded' });
  const visible = selector => page.waitForSelector(selector, { visible: true });
  const press = async selector => { const element = await visible(selector); await element.focus(); await page.keyboard.press('Enter'); };
  const focused = selector => page.waitForFunction(value => document.activeElement?.matches(value), {}, selector);
  for (const width of [320, 1440]) {
    await page.setViewport({ width, height: width === 320 ? 740 : 900, deviceScaleFactor: 1, hasTouch: width === 320 });
    await visit('view=school');
    await press('[data-school-destination=ranking]');
    await visible('[data-school-weekly-ranking]');
    assert.match(await page.$eval('[data-school] nav [aria-current=page]', n => n.textContent), /Classement/);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const reflow = await page.$eval('[data-school]', school => ({
      fits: school.scrollWidth <= school.clientWidth + 1,
      targets: [...school.querySelectorAll('nav [data-school-switch]')].every(button => button.getBoundingClientRect().height >= 44 && button.scrollWidth <= button.clientWidth + 1),
    }));
    assert.deepEqual(reflow, { fits: true, targets: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await press('[data-school-switch=learn]');
    await press('[data-reference-index]');
    await visible('[data-reference-view="index"] [data-reference-entry]');
    const entry = await page.$('[data-reference-view="index"] [data-reference-entry]');
    const before = await entry.evaluate(n => {
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      return { id: n.dataset.referenceEntry, top: n.closest('[data-village-activity-panel]').scrollTop };
    });
    assert.ok(before.top > 5, 'The article opens from a scrolled activity panel');
    await entry.focus(); await page.keyboard.press('Enter');
    await visible('[data-cannabis-article]');
    await page.goBack();
    await focused('[data-reference-entry="' + before.id + '"]');
    const restored = await page.$eval('[data-village-activity-panel]', panel => panel.scrollTop);
    assert.ok(Math.abs(restored - before.top) <= 2, 'The library restores the panel to the selected article');
    await press('[data-school-home-return]');
    await focused('[data-school-destination=learn]');
    checks.push({ width, libraryOffset: before.top, restored, hallFocus: 'learn', rootFont200Percent: reflow });

    failSchool = true;
    await visit('view=school&section=ranking');
    await visible('[data-school] [role=alert]');
    assert.equal(await page.$('[data-school-rankings]'), null);
    failSchool = false;
    await press('[data-school] [role=alert] button');
    await visible('[data-school-weekly-ranking]');
    invalidStock = true;
    await visit('view=shop&tab=collection&section=botte');
    const album = '[data-collection-panel=botte]';
    await visible(album + ' [role=alert]');
    assert.equal(await page.$(album + ' [role=meter]'), null);
    invalidStock = false;
    await press(album + ' [role=alert] button');
    await visible(album + ' [role=meter]');
    await press(album + ' nav button:nth-child(2)');
    await press(album + ' details > summary');
    const card = await visible(album + ' [data-card-code]');
    const code = await card.evaluate(n => n.dataset.cardCode);
    await page.type(album + ' input[type=search]', code);
    await page.waitForFunction(() => document.querySelectorAll('[data-card-code]').length === 1);
    await press(album + ' [data-card-code]');
    await visible('dialog[data-tutorial-card-detail][open]');
    await page.keyboard.press('Escape');
    await focused(album + ' [data-card-code]');
    assert.equal(await page.$eval(album + ' input', n => n.value), code);
    await page.focus('[data-collection-tab=botte]'); await page.keyboard.press('ArrowRight');
    await visible('[data-buddie-collection-card]');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval(album + ' input', n => n.value), code);
    checks.push({ width, card: code, restoredFilter: true, unavailableStockAndSchoolRetry: true });
  }
  assert.deepEqual(errors, []);
  await mkdir(output, { recursive: true });
  await writeFile(output + '/parcours.json', JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify(checks));
} catch (error) {
  if (page) {
    console.error(page.url(), await page.evaluate(() => ({
      focus: document.activeElement?.outerHTML.slice(0, 180),
      panelScroll: document.querySelector('[data-village-activity-panel]')?.scrollTop,
    })));
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: output + '/parcours-echec.png' });
  }
  throw error;
} finally { await browser.close(); }
