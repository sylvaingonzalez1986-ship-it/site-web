import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

// Exercise the real local App Router. The only simulated changes are in the
// isolated browser DOM and image response, never in the shared catalogue.
const base = new URL(process.env.BOUTIQUE_TEST_URL ?? "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
const market = "/boutique?selection=neighbors&culture=greenhouse";
const cardSelector = '[data-shop-list-view="market"] [data-shop-product-id]';
const viewSelector = '[data-shop-product-control="view"]';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
const browser = await puppeteer.launch({
  executablePath: Launcher.getInstallations()[0], headless: true,
  args: ["--disable-background-networking", "--disable-gpu"],
});
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.createBrowserContext();
    const consent = {
      version: 1,
      categories: { necessary: true, analytics: false, marketing: false },
      updatedAt: new Date().toISOString(),
    };
    await context.setCookie({
      name: "lcb_cookie_consent", domain: base.hostname, path: "/",
      value: encodeURIComponent(Buffer.from(JSON.stringify(consent)).toString("base64")),
    });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    await page.setViewport({ width, height, isMobile: width < 500, hasTouch: width < 500 });
    await page.setRequestInterception(true);
    let completedImages = 0;
    page.on("request", async request => {
      const url = new URL(request.url());
      if (url.origin === base.origin && url.pathname === "/__shop-test-image.svg") {
        await wait(1800);
        await request.respond({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="tan"/></svg>' });
        completedImages++;
      } else if (["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
        (url.origin === base.origin && url.pathname === "/api/age-gate/verify")) {
        await request.continue();
      } else {
        await request.abort();
      }
    });
    await page.goto(base.origin + market, { waitUntil: "domcontentloaded" });
    if (page.url().includes("/age-gate")) {
      await page.evaluate(() => fetch("/api/age-gate/verify", { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmed: true }) }));
      await page.goto(base.origin + market, { waitUntil: "domcontentloaded" });
    }
    await page.waitForSelector(cardSelector);
    await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Tout refuser")?.click());
    await wait(3200);
    await page.evaluate(() => document.querySelector('[data-new-products-popup] button[aria-label="Fermer"]')?.click());
    await page.waitForFunction(sel => document.querySelectorAll(sel).length >= 2, {}, cardSelector);
    const before = await page.evaluate(({ cardSelector, viewSelector }) => {
      const cards = [...document.querySelectorAll(cardSelector)];
      const card = cards.at(-1);
      const link = card.querySelector(viewSelector);
      link.scrollIntoView({ block: "center", behavior: "instant" });
      link.focus({ preventScroll: true });
      return { id: card.id, index: cards.indexOf(card), y: Math.round(link.getBoundingClientRect().top) };
    }, { cardSelector, viewSelector });
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-ui-commerce="product-shell"]');
    const productUrl = page.url();
    assert.ok(new URL(productUrl).searchParams.has("resume"), "L'activation doit avoir enregistré le repère");
    const back = 'article a[href*="#shop-card-"]';
    await page.waitForSelector(back);
    const restore = async () => {
      await page.$eval(back, element => { element.scrollIntoView({block:"center",behavior:"instant"}); element.focus({preventScroll:true}); });
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => location.pathname === "/boutique", {timeout:20000}).catch(error => {
        console.error("Destination après activation du retour", page.url());
        throw error;
      });
    };
    // Move the original card to a different row before React's scroll effect.
    // An actual img request stays pending while restoration runs.
    await page.evaluate(({ id, cardSelector }) => {
      const observer = new MutationObserver(() => {
        const card = document.getElementById(id);
        if (!card?.matches(cardSelector)) return;
        observer.disconnect();
        card.parentElement.prepend(card);
        const img = card.querySelector("img");
        img.removeAttribute("srcset");
        img.loading = "eager";
        img.src = "/__shop-test-image.svg";
      });
      observer.observe(document.body, { subtree: true, childList: true });
    }, { id: before.id, cardSelector });
    await restore();
    await page.waitForSelector(cardSelector);
    const position = () => page.evaluate(({ id, cardSelector, viewSelector }) => {
      const card = document.getElementById(id);
      const link = card.querySelector(viewSelector);
      return { index: [...document.querySelectorAll(cardSelector)].indexOf(card),
        y: Math.round(link.getBoundingClientRect().top), focus: document.activeElement === link };
    }, { id: before.id, cardSelector, viewSelector });
    await page.waitForFunction(id => document.activeElement?.closest("[data-shop-product-id]")?.id === id, {timeout:10000}, before.id).catch(async error => {
      console.error("Reprise", { before, url: page.url(), position: await position(),
        active: await page.evaluate(() => [document.activeElement?.tagName, document.activeElement?.getAttribute("aria-label"), [...document.querySelectorAll("dialog[open]")].map(d=>d.getAttribute("aria-label")||d.getAttribute("aria-labelledby"))]) });
      throw error;
    });
    const after = await position();
    assert.equal(after.index, 0);
    assert.ok(after.focus && Math.abs(after.y - before.y) <= 24, JSON.stringify({ before, after }));
    await wait(2300);
    const stable = await position();
    assert.ok(completedImages > 0 && stable.focus && Math.abs(stable.y - before.y) <= 24);

    const removed = new URL(productUrl);
    removed.searchParams.set("entree", "reference-retiree-recette");
    removed.searchParams.delete("resume");
    await page.goto(removed.href, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(back);
    await restore();
    await page.waitForFunction(() => document.activeElement?.id === "boutique-resultats");
    const missing = await page.evaluate(() => ({ title: document.activeElement.textContent, url: location.pathname + location.search }));
    // Interact during the missing-card timeout and verify the fallback does not steal focus.
    await page.goto(removed.href, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(back);
    await restore();
    await page.waitForSelector(cardSelector);
    const other = await page.$('[data-tutorial="tab-mes-voisins"]');
    await other.focus();
    await page.keyboard.press("Shift");
    await wait(1800);
    const respected = await other.evaluate(element => document.activeElement === element);
    assert.ok(respected, "Focus repris après une interaction clavier");
    results.push({ width, height, before, after, stable, completedImages, missing, respected });
    await context.close();
  }
} finally {
  await browser.close();
  await mkdir("output/boutique-resultats", { recursive: true });
  await writeFile("output/boutique-resultats/recette.json", JSON.stringify(results, null, 2) + "\n");
}
console.log(JSON.stringify(results));
