import { launch } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://localhost:3000";
const out = "output/boutique-ui";
await mkdir(out, { recursive: true });
const chrome = await launch({ chromeFlags: ["--headless", "--disable-gpu"] });
try {
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  const page = await browser.newPage();
  await page.goto(base);
  await page.evaluate(async () => {
    await fetch("/api/age-gate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
  });
  const results = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await page.goto(base + "/boutique", { waitUntil: "networkidle2" });
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find(button => button.textContent?.trim() === "Tout refuser")?.click();
    });
    await new Promise(resolve => setTimeout(resolve, 400));
    for (const mode of ["mes-produits", "mes-voisins", "les-copains"]) {
      const button = await page.$(`[data-tutorial="tab-${mode}"]`);
      if (!button || await button.evaluate(el => el.disabled)) continue;
      await button.click();
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!await button.evaluate(el => el.getAttribute("aria-pressed") === "true")) throw new Error("Onglet non sélectionné : " + mode);
      const result = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".product-card")];
        const first = cards[0]?.getBoundingClientRect();
        const track = document.querySelector('[aria-label="Fiches des producteurs"]');
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          products: cards.length, columns: first ? cards.filter(card => Math.abs(card.getBoundingClientRect().top - first.top) < 2).length : 0,
          producers: track?.children.length ?? 0,
          carousel: track ? track.scrollWidth > track.clientWidth + 2 : false,
          cardOverflow: cards.some(card => card.scrollWidth > card.clientWidth + 2) };
      });
      const next = await page.$('[aria-label="Producteur suivant"]');
      if (next && !await next.evaluate(el => el.disabled)) {
        await next.click();
        await new Promise(resolve => setTimeout(resolve, 600));
        result.nextWorks = await page.$eval('[aria-label="Fiches des producteurs"]', el => el.scrollLeft > 0);
        await page.focus('[aria-label="Fiches des producteurs"]');
        await page.keyboard.press("ArrowLeft");
        await new Promise(resolve => setTimeout(resolve, 600));
        result.keyboardWorks = await page.$eval('[aria-label="Fiches des producteurs"]', el => el.scrollLeft < 8);
      }
      results.push({ width, mode, ...result });
      await page.screenshot({ path: `${out}/${mode}-${width}.png`, fullPage: true });
    }
  }
  await writeFile(out + "/results.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => result.overflow || result.cardOverflow || result.nextWorks === false || result.keyboardWorks === false || (result.width < 640 && result.products > 1 && result.columns !== 2))) {
    throw new Error("Une vérification de la boutique a échoué.");
  }
  await browser.disconnect();
} finally { await chrome.kill(); }
