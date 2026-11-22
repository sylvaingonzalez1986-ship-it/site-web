import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

// Start the isolated school preview on 3662 as specified in the report.
const origin = 'http://127.0.0.1:3662';
const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const report = { browser: await browser.version(), runs: [] };
try {
  for (const width of [390, 1440]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width, height: width === 390 ? 844 : 900, isMobile: width === 390, hasTouch: width === 390, deviceScaleFactor: 1 });
    const run = { width, steps: [] };
    report.runs.push(run);
    const act = async selector => {
      const node = await page.waitForSelector(selector, { visible: true });
      await node.scrollIntoView();
      if (width === 390) await node.tap();
      else { await node.focus(); await page.keyboard.press('Enter'); }
    };
    const step = async (label, control, destination) => {
      const start = performance.now();
      await act(control);
      await page.waitForSelector(destination, { visible: true });
      run.steps.push({ label, elapsedMs: Math.round(performance.now() - start),
        horizontalOverflowPx: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) });
    };
    try {
      await page.goto(origin + '/arene/placard?view=school', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await step('Salle → encyclopédie', '[data-school-destination=learn]', '[data-reference-topic]');
      await step('Encyclopédie → premier rayon', '[data-reference-topic]', '[data-reference-content] [data-reference-entry]');
      await step('Rayon → article', '[data-reference-content] [data-reference-entry]', '[data-cannabis-article] h2');
      run.articleTitle = await page.$eval('[data-cannabis-article] h2', el => el.textContent);
      await step('Article → salle', '[data-school-home-return]', '[data-school-destination=tournament]');
      await act('[data-school-home] [aria-pressed]');
      assert.equal(await page.$eval('[data-school-home] [aria-pressed]', el => el.getAttribute('aria-pressed')), 'true');
      await step('Salle → tournoi', '[data-school-destination=tournament]', '[data-tournament-weekly-ranking]');
      run.tournament = await page.$eval('[data-tournament-event]', el => el.innerText);
      await step('Tournoi → salle', '[data-school-home-return]', '[data-school-destination=ranking]');
      await act('[data-school-destination=ranking]');
      await page.waitForSelector('[data-school-rankings][data-tutorial-observation="school-ranking"]');
      run.ranking = await page.$eval('[data-school]', el => el.innerText.slice(0, 480));
    } catch (error) {
      run.error = error.message;
      run.observed = await page.evaluate(() => ({ href: location.href, text: document.body.innerText.slice(0, 1000) }));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(new URL('parcours-ecole.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
if (report.runs.some(run => run.error)) process.exitCode = 1;
