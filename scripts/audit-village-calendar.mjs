import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { createQuarterTeamFixture } from "./audit-quarter-team-scenarios.mjs";

const output = resolve("output/village-calendar");
const district = "canvas[data-village-ready=true]";
const sign = "[data-village-season]";
const scenarios = [
  ["printemps", 1, 720, "spring", "day"],
  ["ete", 91, 720, "summer", "day"],
  ["automne", 181, 720, "autumn", "day"],
  ["hiver", 271, 720, "winter", "day"],
  ["aube", 91, 390, "summer", "dawn"],
  ["soir", 91, 1170, "summer", "dusk"],
  ["nuit", 91, 1380, "summer", "night"],
];

async function contactSheet(file, frames) {
  const width = 680, height = 425, caption = 33;
  const items = [];
  for (const [i, [frame, title]] of frames.entries()) {
    const left = i % 2 * width, top = Math.floor(i / 2) * (height + caption);
    items.push({ input: await sharp(resolve(output, frame + ".png")).resize(width, height).png().toBuffer(), left, top });
    const label = Buffer.from(`<svg width="${width}" height="${caption}"><text x="12" y="23" font-family="sans-serif" font-size="16" fill="#213e35">${title}</text></svg>`);
    items.push({ input: label, left, top: top + height });
  }
  await sharp({ create: { width: width * 2, height: (height + caption) * 2, channels: 3, background: "#f3e6c8" } })
    .composite(items).webp({ quality: 92 }).toFile(resolve(output, file + ".webp"));
}

// Sample open water in the fixed desktop framing, away from signs, birds and the boat.
async function seaColor(image) {
  const sample = await sharp(image).extract({ left: 530, top: 122, width: 24, height: 18 }).png().toBuffer();
  const { channels } = await sharp(sample).stats();
  return channels.slice(0, 3).map(channel => channel.mean);
}

export async function auditVillageCalendar(origin, server) {
  await mkdir(output, { recursive: true });
  const team = await createQuarterTeamFixture(server);
  const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
    userDataDir: resolve(output, "audit-chrome"), args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const startedAt = team.snapshot().context.businessStartedAt;
    const dayMs = 4 * 60 * 60 * 1000;
    let serverNowMs = Date.parse(startedAt) + 90 * dayMs - 5000;
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/api/arena/placard/equipment") {
        return void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({
          activeRun: true, cashCents: 125000, readyLotCount: 3, availableFlowerCount: 2,
          businessClock: { startedAt, serverNow: new Date(serverNowMs).toISOString() },
        }) });
      }
      if (url.pathname === "/api/arena/placard/staff") return void team.handle(request);
      if (url.origin === origin && !url.pathname.startsWith("/api/") || ["blob:", "data:"].includes(url.protocol)) return void request.continue();
      void request.abort();
    });
    const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    async function preview(day, minute, season, phase) {
      await page.evaluate(({ day, minute }) => {
        history.replaceState(null, "", `?villageDay=${day}&villageMinute=${minute}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, { day, minute });
      await page.waitForSelector(`${sign}[data-village-season="${season}"][data-village-phase="${phase}"] [role=meter][aria-valuenow="${minute}"]`);
      await paint();
    }
    const capture = name => page.screenshot({ path: resolve(output, name + ".png") });
    await page.setViewport({ width: 1280, height: 800 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(origin + "/?villageDay=1&villageMinute=720", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(district);
    await page.waitForSelector("[data-team-expanded] [data-team-close]");
    await page.click("[data-team-close]");
    await page.waitForSelector("[data-team-player-time]");
    await page.evaluate(() => document.fonts.ready);
    const canvas = await page.$(district);
    for (const [file, day, minute, season, phase] of scenarios) {
      await preview(day, minute, season, phase);
      assert.ok(await page.evaluate(node => node === document.querySelector("canvas"), canvas));
      await capture(file);
    }
    const dayColor = await seaColor(resolve(output, "ete.png"));
    const nightColor = await seaColor(resolve(output, "nuit.png"));
    assert.ok(dayColor[1] > nightColor[1] + 60, "The sea darkens with the landscape");
    await preview(92, 720, "summer", "day");
    const nextDayColor = await seaColor(await page.screenshot());
    assert.ok(nextDayColor.every((channel, i) => Math.abs(channel - dayColor[i]) < 10), "Daylight returns after night");
    await preview(91, 1380, "summer", "night");
    await page.focus('[data-village-building="bank"]');
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-building="bank"]');
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-village-building") === "bank");
    for (const [width, height] of [[320, 680], [844, 390]]) {
      await page.setViewport({ width, height, isMobile: true, hasTouch: true });
      await page.click('[aria-label="Recentrer la vue isométrique"]');
      await paint();
      const clear = await page.evaluate(selector => {
        const box = document.querySelector(selector).getBoundingClientRect();
        const overlaps = [...document.querySelectorAll("fieldset button,[data-team-open],header summary,header button")].some(node => {
          const r = node.getBoundingClientRect();
          return r.width && r.height && r.x < box.right && r.right > box.x && r.y < box.bottom && r.bottom > box.y;
        });
        return !overlaps && box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
      }, sign);
      assert.ok(clear, `Indicateur et commandes à ${width} px`);
      await capture("nuit-" + width);
    }
    await page.click("[data-village-motion-toggle]");
    await page.waitForSelector('canvas[data-motion-state="running"]');
    await page.waitForFunction(() => Number(document.querySelector("canvas").dataset.motionTime) > .08);
    const metrics = await page.$eval("canvas", async node => {
      const frames = [];
      let previous = node.dataset.renderFrames;
      while (frames.length < 12) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const d = node.dataset;
        if (d.renderFrames === previous) continue;
        previous = d.renderFrames;
        frames.push({ intervalMs: Number(d.frameInterval), submitMs: Number(d.renderSubmitMs) });
      }
      return { frames, drawCalls: Number(node.dataset.drawCalls), triangles: Number(node.dataset.triangles) };
    });
    await page.click("[data-village-motion-toggle]");
    await page.setViewport({ width: 1280, height: 800 });
    // Leave preview and resynchronise the same saved game just before midnight.
    await page.evaluate(() => {
      history.replaceState(null, "", "/"); window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new Event("kq:equipment-updated"));
    });
    await page.waitForSelector(`${sign}[data-village-season="spring"] [aria-valuenow="1439"]`);
    await page.waitForSelector(`${sign}[data-village-season="summer"] [aria-valuenow="0"]`);
    assert.match(await page.$eval(sign, node => node.textContent), /Mois 4 · Jour 1/);
    serverNowMs += 5000;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(district);
    await page.waitForSelector(`${sign}[data-village-season="summer"][data-village-phase="night"]`);
    await paint();
    const restoredColor = await seaColor(await page.screenshot());
    assert.ok(restoredColor.every((channel, i) => Math.abs(channel - nightColor[i]) < 10), "A reloaded night uses night lighting");
    assert.equal(team.mutations(), 0);
    assert.deepEqual(errors, []);
    await contactSheet("saisons", [["printemps", "Printemps"], ["ete", "Été"], ["automne", "Automne"], ["hiver", "Hiver"]]);
    await contactSheet("journee", [["aube", "6 h 30 · Aube"], ["ete", "12 h · Journée"], ["soir", "19 h 30 · Crépuscule"], ["nuit", "23 h · Nuit"]]);
    await writeFile(resolve(output, "rapport.json"), JSON.stringify({ passed: true, renderer: "Chromium SwiftShader",
      viewports: [[1280, 800], [320, 680], [844, 390]], scenarios, midnight: true, seasonChange: true,
      reload: true, sameCanvas: true, keyboardAtNight: true, reducedMotion: true, dayColor, nightColor, restoredColor, metrics, errors }, null, 2));
  } finally { await browser.close(); }
}
