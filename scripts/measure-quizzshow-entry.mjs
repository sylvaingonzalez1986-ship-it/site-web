import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { arch, cpus, platform, release } from "node:os";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

// Synthetic school fixture served by audit-placard-navigation.mjs --school-visual --preview.
const label = process.argv[2];
if (!["avant", "apres", "appariee", "appariee-finale"].includes(label)) throw new Error("Préciser avant, apres, appariee ou appariee-finale.");
const fixtureUrl = port => `http://127.0.0.1:${Number(port)}/arene/placard?view=school`;
const finalComparison = label === "appariee-finale";
const paired = label === "appariee" || finalComparison;
const fixtures = {
  avant: fixtureUrl(process.env.QUIZZSHOW_BEFORE_PORT ?? 3663),
  apres: fixtureUrl(process.env.QUIZZSHOW_AFTER_PORT ?? (finalComparison ? 3666 : 3665)),
};
const url = fixtureUrl(process.env.NAVIGATION_AUDIT_PORT ?? 3663);
const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
  args: ["--no-sandbox", "--disable-webgl"] });
const results = { label, browser: await browser.version(), webgl: false, runs: [],
  ...(paired ? { fixtures, startedAt: new Date().toISOString(), host: {
    platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
  } } : { fixture: url }),
};

async function measureProfile(fixture, width, repeat, version, position) {
  const context = await browser.createBrowserContext();
  const rows = [];
  try {
    const page = await context.newPage();
    await page.setViewport({ width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, hasTouch: width === 390, isMobile: width === 390 });
    const visible = selector => page.waitForSelector(selector, { visible: true, timeout: 60000 });
    for (const cache of ["cold", "warm"]) {
      const started = performance.now();
      await page.goto(fixture, { waitUntil: "domcontentloaded", timeout: 90000 });
      const row = { width, repeat, cache, ...(version ? { version, position } : {}) };
      const open = async (control, target, key) => {
        const button = await visible(control);
        await button.scrollIntoView();
        await button.focus();
        const at = performance.now();
        if (width === 390) await button.tap();
        else await page.keyboard.press("Enter");
        await visible(target);
        row[key] = Math.round(performance.now() - at);
      };
      await visible("[data-school-destination=learn]");
      row.firstControlMs = Math.round(performance.now() - started);
      await open("[data-school-destination=learn]", "[data-reference-topic]", "shelvesMs");
      await open("[data-reference-topic]", "[data-reference-entry]", "entriesMs");
      await open("[data-reference-entry]", "[data-cannabis-article] h2", "articleMs");
      row.article = await page.$eval("[data-cannabis-article] h2", n => n.textContent);
      results.runs.push(row);
      rows.push(row);
      await page.evaluate(() => sessionStorage.clear());
    }
  } finally {
    await context.close();
  }
  return rows;
}

try {
  for (const width of [390, 1440]) {
    for (let repeat = 1; repeat <= 3; repeat++) {
      if (!paired) {
        await measureProfile(url, width, repeat);
        continue;
      }
      const beforeFirst = (repeat + Number(width === 1440)) % 2 === 1;
      const first = beforeFirst ? "avant" : "apres";
      const second = beforeFirst ? "apres" : "avant";
      const left = await measureProfile(fixtures[first], width, repeat, first, 1);
      const right = await measureProfile(fixtures[second], width, repeat, second, 2);
      assert.deepEqual(left.map(row => row.article), right.map(row => row.article));
    }
  }
  if (label === "apres" || finalComparison) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const held = [];
    let rendererRequests = 0;
    let release = false;
    await page.setRequestInterception(true);
    page.on("request", request => {
      if (request.url().includes("/world/quizzshow-renderer")) rendererRequests++;
      if (!release && request.url().includes("/kanab-quest-cannabis-reference-biology")) held.push(request);
      else void request.continue();
    });
    try {
      await page.goto(finalComparison ? fixtures.apres : url, { waitUntil: "domcontentloaded" });
      const library = await page.waitForSelector("[data-school-destination=learn]", { visible: true });
      await library.click();
      const shelf = await page.waitForSelector("[data-reference-topic]", { visible: true });
      await shelf.click();
      await page.waitForFunction(() => Boolean(document.querySelector("[role=status]")));
      if (!held.length) await page.waitForRequest(request => request.url().includes("/kanab-quest-cannabis-reference-biology"));
      assert(held.length > 0, "The catalogue request was held on the test server");
      assert.equal(await page.$("[data-reference-entry]"), null);
      release = true;
      await Promise.all(held.map(request => request.continue()));
      const entry = await page.waitForSelector("[data-reference-entry]", { visible: true });
      if (finalComparison) {
        await entry.click();
        await page.waitForSelector("[data-cannabis-article] h2", { visible: true });
      }
      assert.equal(rendererRequests, 0, "The WebGL 2 renderer is unnecessary in the HTML fallback");
      results.slowCatalog = { shelvesUsableBeforeCatalog: true, entriesAfterRelease: true, rendererRequests,
        ...(finalComparison ? { articleAfterRelease: await page.$eval("[data-cannabis-article] h2", node => node.textContent) } : {}),
      };
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  const dir = "docs/bete-de-concours/plan-80-recette";
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/performance-${label}.json`, JSON.stringify(results, null, 2) + "\n");
}
