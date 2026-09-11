/** Own the browser lifecycle to avoid chrome-launcher cleanup races on Windows. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';

const url = process.argv[2] || 'https://www.leschanvriersbretons.com/cbd-pas-cher';
const output = resolve('output/seo-audit');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(output, 'lighthouse-browser'), args: ['--no-sandbox', '--disable-gpu'] });
try {
  const result = await lighthouse(url, { port: Number(new URL(browser.wsEndpoint()).port), output: 'json', onlyCategories: ['performance', 'seo'], logLevel: 'error' });
  if (!result || result.lhr.runtimeError) throw new Error(result?.lhr.runtimeError?.message || 'No Lighthouse report');
  await writeFile(resolve(output, 'lighthouse-production.json'), result.report);
  console.log(JSON.stringify({
    url: result.lhr.finalDisplayedUrl,
    scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([key, category]) => [key, category.score])),
    metrics: Object.fromEntries(['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'first-contentful-paint'].map(key => [key, result.lhr.audits[key].displayValue])),
    seoFailures: result.lhr.categories.seo.auditRefs.filter(ref => ref.weight > 0 && result.lhr.audits[ref.id].score !== null && result.lhr.audits[ref.id].score < 1).map(ref => ({ id: ref.id, title: result.lhr.audits[ref.id].title })),
  }, null, 2));
} finally { await browser.close(); }
