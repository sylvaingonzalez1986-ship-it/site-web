import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launch } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { resolve } from "node:path";

const base = "http://localhost:3000";
const output = "output/customer-ab";
await mkdir(output, { recursive: true });
const profile = resolve(output, "chrome-profile-" + Date.now());
await mkdir(profile, { recursive: true });
const chrome = await launch({ userDataDir: profile, chromeFlags: ["--headless", "--disable-gpu"] });
try {
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
  let page = await browser.newPage();
  await page.goto(base);
  await page.evaluate(async () => {
    await fetch("/api/age-gate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
  });
  const results = [];
  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await page.goto(base, { waitUntil: "networkidle2" });
    await page.evaluate(() => [...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Tout refuser")?.click());
    await page.waitForSelector("#products .product-card");
    const layout = await page.evaluate(() => {
      const products = document.querySelector("#products");
      const cards = [...products.querySelectorAll(".product-card")];
      return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        beforePhilosophy: products.getBoundingClientRect().top < document.querySelector("#notre-philosophie").getBoundingClientRect().top,
        columns: cards.filter(el => Math.abs(el.getBoundingClientRect().top - cards[0].getBoundingClientRect().top) < 2).length,
        unavailable: cards.some(el => el.textContent.includes("Rupture")) };
    });
    assert.equal(layout.overflow, false);
    assert.equal(layout.beforePhilosophy, true);
    assert.equal(layout.unavailable, false);
    assert.equal(layout.columns, width < 768 ? 2 : 4);
    results.push(layout);
    await page.screenshot({ path: `${output}/home-${width}.png` });
    await page.$eval("#products", el => el.scrollIntoView());
    await page.screenshot({ path: `${output}/products-${width}.png` });
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle2" });
  const add = await page.$('#products .product-card button.btn-primary:not(:disabled)');
  assert.ok(add, "Un produit achetable est nécessaire au scénario");
  await add.click();
  await page.waitForSelector('[role="status"]');
  assert.equal(new URL(page.url()).pathname, "/");
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("shop:cart:v1")));
  assert.ok(snapshot.items.length > 0);
  await page.evaluate(() => window.dispatchEvent(new Event("shop:open-cart")));
  await page.waitForSelector('[role="dialog"][aria-modal="true"]');
  await new Promise(resolve => setTimeout(resolve, 400));
  await page.screenshot({ path: output + "/guest-cart-390.png" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Continuer ma commande").click());
  await page.waitForFunction(() => location.pathname === "/compte/connexion");
  assert.ok(new URL(page.url()).searchParams.get("next").includes("panier=1"));
  await page.close();
  page = await browser.newPage();
  await page.goto(base + "/boutique", { waitUntil: "networkidle2" });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("shop:cart:v1")).items), snapshot.items);
  // Simulate a successful account response without creating a user or placing an order.
  await page.setRequestInterception(true);
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (path === "/api/account/me") return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "audit-customer", email: "audit@example.test", firstName: "Audit", lastName: "Client", dateOfBirth: "1990-01-01" } }) });
    if (path.startsWith("/api/account/")) return request.respond({ status: 200, contentType: "application/json", body: "{}" });
    if (path.startsWith("/api/checkout/")) return request.abort();
    return request.continue();
  });
  await page.goto(base + "/boutique?panier=1", { waitUntil: "networkidle2" });
  await page.waitForSelector('[role="dialog"][aria-modal="true"]');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("shop:cart:v1")).items), snapshot.items);
  assert.equal(new URL(page.url()).searchParams.has("panier"), false);
  await writeFile(output + "/results.json", JSON.stringify({ layout: results, guestAdd: true, loginReturnLink: true, restoredAcrossTabs: true, simulatedLoginPreservesCart: true }, null, 2));
  console.log("OK: accueil 320/390/1440, panier visiteur, nouvel onglet et retour de connexion simulé.");
  await browser.disconnect();
} finally { await chrome.kill(); }
