/**
 * Real village map, local input fixtures only. No account, network API, or database.
 * Verifies visible activity, honest unknown states, and map interaction at mobile sizes.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, transformWithOxc } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = resolve(root, "output/placard-building-activity");
const port = Number(process.env.BUILDING_ACTIVITY_AUDIT_PORT ?? 3283);
const origin = `http://127.0.0.1:${port}`;
const entry = `
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import "/src/app/globals.css";
import {KqPlacardMap} from "/src/components/placard/KqPlacardMap";
function Audit() {
  const [snapshot,setSnapshot] = useState({});
  window.__setVillageSnapshot = setSnapshot;
  return <KqPlacardMap isolated cashCents={100000} tents={1} {...snapshot}
    onOpen={(view,options)=>{window.__villageNavigation={view,options};}}
    onOpenCollection={()=>{window.__villageNavigation={view:"collection"};}} />;
}
createRoot(document.getElementById("root")).render(<Audit/>);
`;
const modules = {
  entry,
  "next/image": `import React from "react";export default function Image({src,fill,priority,fetchPriority,unoptimized,loader,quality,placeholder,blurDataURL,...props}){return <img {...props} src={typeof src==="string"?src:src.src} style={{...(fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:{}),...props.style}}/>}`,
};
const fonts = `@font-face{font-family:Display;src:url('/src/app/fonts/BarlowCondensed-Latin-Black.woff2');font-weight:900}@font-face{font-family:Body;src:url('/src/app/fonts/SpaceGrotesk-Latin-Variable.woff2');font-weight:300 700}:root{--font-display:Display;--font-body:Body;--font-sans:Body}body{margin:0;background:#003f30}`;
const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, "vite-cache"),
  publicDir: resolve(root, "public"),
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "lucide-react"] },
  resolve: { alias: { "@": resolve(root, "src") }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwindcss({ base: root })] } },
  plugins: [{
    name: "building-activity-audit", enforce: "pre",
    resolveId(id) { if (id in modules) return "\0" + id; },
    async load(id) {
      if (id.startsWith("\0") && modules[id.slice(1)]) {
        return (await transformWithOxc(modules[id.slice(1)], id + ".tsx", {
          lang: "tsx", jsx: { runtime: "automatic" },
        })).code;
      }
    },
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Activité des bâtiments · recette locale isolée</title><style>${fonts}</style><div id="root"></div><script type="module" src="/@id/__x00__entry"></script></html>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false, watch: null },
});

const calm = { activeRun: false, readyLotCount: 0, availableFlowerCount: 0 };
const active = { activeRun: true, readyLotCount: 3, availableFlowerCount: 2 };
const trackedBuildings = ["warehouse", "market", "arena"];
const results = [], errors = [], forbiddenRequests = [];
let browser;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await puppeteer.launch({
    executablePath: Launcher.getInstallations()[0], headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.protocol === "data:") return void request.continue();
    if (url.origin !== origin || url.pathname.startsWith("/api/")) {
      forbiddenRequests.push(request.url());
      return void request.abort();
    }
    void request.continue();
  });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

  async function snapshot(values) {
    await page.evaluate(values => window.__setVillageSnapshot(values), values);
    // React must commit its state update before measurements. Animation frames do not sleep.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const decodedImages = await page.$$eval("[data-map-activity] image", elements => Promise.all(elements.map(async element => {
      const image = new Image();
      image.src = element.href.baseVal;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error(`Activity image is empty: ${image.src}`);
      return { source: element.href.baseVal, width: image.naturalWidth, height: image.naturalHeight };
    })));
    assert.equal(decodedImages.length, await page.$$eval("[data-map-activity]", elements => elements.length), "Every active building uses a decoded painted image");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  }
  async function visibleStatuses() {
    return page.evaluate(ids => Object.fromEntries(ids.map(id => {
      const button = document.querySelector(`[data-map-building="${id}"]`);
      const status = button?.querySelector("[data-map-status]");
      const rect = status?.getBoundingClientRect();
      const style = status ? getComputedStyle(status) : null;
      return [id, {
        state: button?.dataset.mapState,
        text: status?.textContent ?? "",
        visible: Boolean(rect?.width && rect?.height && style?.display !== "none" && style?.visibility !== "hidden"),
        fontSize: style ? Number.parseFloat(style.fontSize) : null,
        left: rect?.left, right: rect?.right,
      }];
    })), trackedBuildings);
  }
  async function checkLayout(name) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: no horizontal overflow`);
    const labels = await page.$$eval("[data-map-label]", elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { name: element.dataset.mapLabel, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, clipped: rect.left < -1 || rect.right > innerWidth + 1 };
    }));
    const clipping = labels.filter(item => item.clipped);
    assert.deepEqual(clipping, [], `${name}: all labels are inside the viewport`);
    for (let index = 0; index < labels.length; index++) {
      for (const other of labels.slice(index + 1)) {
        const current = labels[index];
        const intersectionWidth = Math.min(current.right, other.right) - Math.max(current.left, other.left);
        const intersectionHeight = Math.min(current.bottom, other.bottom) - Math.max(current.top, other.top);
        assert(intersectionWidth <= 0 || intersectionHeight <= 0, `${name}: ${current.name} and ${other.name} labels do not overlap`);
      }
    }
  }
  async function checkHitAreas() {
    const hitTests = await page.$$eval("[data-map-building]", elements => elements.map(element => {
      const terrain = element.closest("nav").parentElement.getBoundingClientRect();
      const [x, y] = element.dataset.mapHitPoint.split(",").map(Number);
      const actual = document.elementFromPoint(terrain.left + terrain.width * x / 100, terrain.top + terrain.height * y / 100);
      return { expected: element.dataset.mapBuilding, actual: actual?.closest("[data-map-building]")?.dataset.mapBuilding };
    }));
    for (const hit of hitTests) assert.equal(hit.actual, hit.expected, `${hit.expected}: drawing remains clickable`);
    return hitTests;
  }

  for (const width of [320, 390, 1440]) {
    await page.setViewport({ width, height: 1300, isMobile: width < 700, hasTouch: width < 700 });
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-placard-map]");
    await page.waitForFunction(() => {
      const painting = document.querySelector("[data-placard-map] img");
      return painting?.complete && painting.naturalWidth > 0;
    });
    await page.evaluate(() => document.fonts.ready);
    await snapshot(active);
    assert.equal(await page.$$eval("[data-map-activity]", elements => elements.length), 3);
    assert.equal(await page.$eval("[data-map-life]", element => getComputedStyle(element).pointerEvents), "none");
    const activeStatuses = await visibleStatuses();
    for (const [id, status] of Object.entries(activeStatuses)) {
      assert.equal(status.state, "active", `${width}px ${id}: active state`);
      assert(status.visible && status.text.length > 0 && status.fontSize >= 10, `${width}px ${id}: readable activity`);
    }
    assert.match(activeStatuses.market.text, /3/);
    assert.match(activeStatuses.arena.text, /2/);
    await checkLayout(`${width}px active`);
    const map = await page.$("[data-placard-map]");
    await map.screenshot({ path: resolve(output, `active-${width}.png`) });
    // Map screenshots may scroll the viewport on desktop; restore before point tests.
    await page.evaluate(() => scrollTo(0, 0));
    const hitTests = await checkHitAreas();
    assert(await page.$$eval("[data-map-life] *", elements => elements.every(element => getComputedStyle(element).animationName === "none")), "Reduced motion stops decorative animations");
    await page.focus('[data-map-building="warehouse"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.id.startsWith("placard-building-details-"));
    await page.keyboard.press("Escape");
    assert.equal(await page.$eval('[data-map-building="warehouse"]', element => element === document.activeElement), true);
    await page.focus('[data-map-building="market"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.id.startsWith("placard-building-details-"));
    await page.focus('[data-placard-activity="market"]');
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.__villageNavigation?.view), "market");
    await page.focus('[id^="placard-building-details-"]');
    await page.keyboard.press("Escape");
    await page.focus('[data-map-building="arena"]');
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.__villageNavigation?.view), "arena");
    // Clear the selected building so activity comparison does not include a navigation highlight.
    await page.focus('[data-map-building="warehouse"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.id.startsWith("placard-building-details-"));
    await page.keyboard.press("Escape");

    await snapshot(calm);
    assert.equal(await page.$$eval("[data-map-activity]", elements => elements.length), 0);
    const calmStatuses = await visibleStatuses();
    for (const [id, status] of Object.entries(calmStatuses)) {
      assert.equal(status.state, "idle", `${width}px ${id}: explicit calm state`);
      assert(status.visible && status.text.length > 0, `${width}px ${id}: calm state stays visible`);
      assert.notEqual(status.text, activeStatuses[id].text);
    }
    await page.evaluate(() => document.activeElement?.blur());
    await checkLayout(`${width}px calm`);
    await map.screenshot({ path: resolve(output, `calm-${width}.png`) });
    results.push({ width, activeStatuses, calmStatuses, hitTests, reducedMotion: true, keyboardNavigation: true, horizontalOverflow: false });
  }

  await page.setViewport({ width: 320, height: 1300, isMobile: true, hasTouch: true });
  await snapshot({ activeRun: true, readyLotCount: 1000, availableFlowerCount: 1000 });
  await checkLayout("large counters at 320px");
  const largeStatuses = await visibleStatuses();
  assert.match(largeStatuses.market.text, /1.?000/);
  assert.match(largeStatuses.arena.text, /1.?000/);
  results.push({ scenario: "large counters", width: 320, statuses: largeStatuses });

  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 1300, isMobile: width < 700, hasTouch: width < 700 });
    for (const [name, values, activity] of [
      ["culture-only", { ...calm, activeRun: true }, "culture"],
      ["market-only", { ...calm, readyLotCount: 1 }, "market"],
      ["jury-only", { ...calm, availableFlowerCount: 1 }, "jury"],
    ]) {
      await snapshot(values);
      const actual = await page.$$eval("[data-map-activity]", elements => elements.map(element => element.dataset.mapActivity));
      assert.deepEqual(actual, [activity], `${width}px ${name}: only the truthful activity appears`);
      await checkLayout(`${width}px ${name}`);
      await (await page.$("[data-placard-map]")).screenshot({ path: resolve(output, `${name}-${width}.png`) });
      results.push({ scenario: name, width, activities: actual, statuses: await visibleStatuses() });
    }

    await snapshot(active);
    await page.click("[data-map-zoom-toggle]");
    await page.waitForSelector("[data-placard-map][data-map-zoomed]");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const captures = [];
    for (const id of trackedBuildings) {
      // Pan the real zoomed map to inspect each painted patch against its surroundings.
      await page.$eval(`[data-map-building="${id}"]`, element => {
        const terrain = element.closest("nav").parentElement;
        const viewport = terrain.parentElement;
        const [x, y] = element.dataset.mapHitPoint.split(",").map(Number);
        viewport.scrollTo({
          left: terrain.clientWidth * x / 100 - viewport.clientWidth / 2,
          top: terrain.clientHeight * y / 100 - viewport.clientHeight / 2,
          behavior: "instant",
        });
        document.activeElement?.blur();
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      const imageName = `active-zoom-${id}-${width}.png`;
      const viewportId = await page.$eval("[data-map-zoom-toggle]", element => element.getAttribute("aria-controls"));
      await (await page.$(`[id="${viewportId}"]`)).screenshot({ path: resolve(output, imageName) });
      captures.push(imageName);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px zoom stays inside the viewport`);
    await page.click("[data-map-zoom-toggle]");
    await page.waitForSelector("[data-placard-map]:not([data-map-zoomed])");
    results.push({ scenario: "painted building zoom", width, captures, horizontalOverflow: false });
  }

  await page.setViewport({ width: 390, height: 1300, isMobile: true, hasTouch: true });
  for (const [name, values] of [
    ["unknown", {}],
    ["invalid", { activeRun: "true", readyLotCount: -1, availableFlowerCount: 1.5 }],
  ]) {
    await snapshot(values);
    assert.equal(await page.$$eval("[data-map-activity]", elements => elements.length), 0);
    const statuses = await visibleStatuses();
    for (const [id, status] of Object.entries(statuses)) {
      assert.equal(status.state, "unknown", `${name} ${id}: missing or invalid information is not zero`);
      assert(!/\b0\b/.test(status.text), `${name} ${id}: no invented zero`);
    }
    await checkLayout(name);
    await (await page.$("[data-placard-map]")).screenshot({ path: resolve(output, `${name}-390.png`) });
    results.push({ scenario: name, statuses });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(forbiddenRequests, []);
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: true, fixturesOnly: true, results, errors, forbiddenRequests }, null, 2));
  console.log(JSON.stringify({ success: true, checks: results.length, output }));
} catch (error) {
  if (browser) await (await browser.pages()).at(-1)?.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, "report.json"), JSON.stringify({ success: false, results, errors, forbiddenRequests, failure: error.stack }, null, 2));
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
