import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { KORRIGAN_ODDS, KORRIGAN_MIN_VALUE_CENTS } from "../src/lib/kanab-quest-korrigan.ts";

const folder = resolve(process.env.KORRIGAN_AUDIT_ART_DIR ?? "docs/bete-de-concours/korrigans");
const reportFolder = resolve("output/korrigans");
const lotId = "657f3cfa-7204-499d-b381-36ce75748dfa";
const sessionId = "db66e98e-f3d2-412f-a3dc-77347086c193";
const week = 168 * 3600000;
const access = "[data-korrigan-access]";
const invitation = "[data-korrigan-invitation]";
const dialog = "[data-korrigan-dialog][open]";
const machine = "[data-korrigan-machine]";
const readyCanvas = "canvas[data-village-ready=true]";

export async function auditKorriganMarket(origin) {
  await mkdir(folder, { recursive: true });
  await mkdir(reportFolder, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  const errors = [];
  const cases = [];
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on("pageerror", error => errors.push(error.message));
  try {
    let minuteOfDay = 1380, night = true, stock = 120, session = null, nextOfferAt = null, offers = 0;
    let onDraw = null, heldDraw = null;
    const now = new Date("2026-11-22T22:00:00Z");
    const draws = ["loss", "x5", "botte"];
    const state = () => ({ serverNow: now.toISOString(), nextOfferAt, minimumValueCents: KORRIGAN_MIN_VALUE_CENTS,
      lots: [{ id: lotId, label: "Récolte de la serre", availableGrams: stock }], isNight: night, session });
    await page.setRequestInterception(true);
    page.on("request", async request => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/")) return void (url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? request.continue() : request.abort());
      const json = (value, status = 200) => request.respond({ status, contentType: "application/json", body: JSON.stringify(value) });
      if (url.pathname === "/api/arena/placard/equipment") return void json({ activeRun: false, cashCents: 75000, readyLotCount: 1, availableFlowerCount: 1,
        businessClock: { startedAt: new Date(+now - minuteOfDay * 10000).toISOString(), serverNow: now.toISOString() } });
      if (url.pathname !== "/api/arena/placard/korrigans") return void json({}, 404);
      if (request.method() === "GET") return void json(state());
      const body = JSON.parse(request.postData());
      if (body.action === "quote") return void json({ ...state(), quote: { valueCents: body.grams * 300, eligible: body.grams * 300 >= KORRIGAN_MIN_VALUE_CENTS } });
      if (body.action === "offer" && night && !session) {
        stock -= body.grams;
        offers++;
        nextOfferAt = new Date(+now + week).toISOString();
        session = { id: sessionId, requestId: body.requestId, odds: KORRIGAN_ODDS, lotId, grams: body.grams,
          valueCents: body.grams * 300, nextOfferAt, draws: [] };
        return void json(state());
      }
      if (body.action === "draw" && night && body.draw === session?.draws.length + 1 && body.draw <= 3) {
        const kind = draws[body.draw - 1];
        session.draws.push({ index: body.draw, kind, moneyCents: kind === "x5" ? 5 * session.valueCents : 0,
          ...(kind === "botte" && { itemLabel: "Pack Botte du Chanvrier" }) });
        if (heldDraw) { onDraw(); await heldDraw; }
        return void json(state());
      }
      return void json({ error: "Commande hors séquence." }, 409);
    });
    const button = async (scope, regex) => {
      await page.waitForFunction((selector, pattern) => Array.from(document.querySelectorAll(selector + " button")).some(el => !el.disabled && el.offsetWidth && new RegExp(pattern, "i").test(el.textContent)), {}, scope, regex);
      const target = await page.evaluateHandle((selector, pattern) => Array.from(document.querySelectorAll(selector + " button")).find(el => !el.disabled && el.offsetWidth && new RegExp(pattern, "i").test(el.textContent)), scope, regex);
      await target.asElement().click();
      await target.dispose();
    };
    const phase = async minute => {
      minuteOfDay = minute;
      night = minute < 300 || minute >= 1260;
      await page.evaluate(() => dispatchEvent(new Event("kq:equipment-updated")));
      await page.waitForSelector(`[data-village-phase="${night ? "night" : minute === 300 ? "dawn" : "day"}"]`);
    };
    const focusMarket = async () => {
      await page.keyboard.press("Tab");
      await page.focus(access);
      await page.waitForSelector('canvas[data-life-observe="korrigans"][data-camera-transition="idle"]');
    };
    const open = async () => {
      await page.waitForSelector(access + '[data-offscreen="false"]', { visible: true });
      await page.focus(access);
      await page.waitForFunction(selector => document.activeElement?.matches(selector), {}, access);
      await page.keyboard.press("Enter");
      await button(invitation, "machine|reprendre|bilan");
      await page.waitForSelector(dialog);
    };
    const next = () => button(dialog, "Lancer le tirage");
    const shot = name => page.screenshot({ path: resolve(folder, name + ".webp"), type: "webp", quality: 90 });
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(readyCanvas);
    await page.waitForSelector(access + '[data-offscreen="false"]');
    assert.equal(await page.$$eval("[data-npc-access]", list => list.length), 0);
    assert.equal(await page.$("[data-observe-life]"), null);
    assert.equal(await page.$eval(access, button => button.textContent), "Marché des korrigans");
    await focusMarket();
    await page.waitForFunction(() => JSON.parse(document.querySelector("canvas").dataset.lifeKorrigans || "{}").dancers?.length === 3);
    const positions = () => page.$eval("canvas", node => JSON.parse(node.dataset.lifeKorrigans).dancers);
    const from = await positions();
    await page.waitForFunction(x => Math.abs(JSON.parse(document.querySelector("canvas").dataset.lifeKorrigans).dancers[0].x - x) > .15, {}, from[0].x);
    await shot("ronde-ordinateur");
    const nightData = await page.$eval("canvas", node => ({ npcs: JSON.parse(node.dataset.lifeNpcs), targets: JSON.parse(node.dataset.npcTargets || "{}") }));
    assert(Object.values(nightData.npcs).every(npc => !npc.visible));
    assert.deepEqual(nightData.targets, {});
    cases.push("Connexion nocturne, trois flûtistes en mouvement, zones des habitants absentes");
    await page.click(access);
    await page.waitForSelector(invitation);
    await phase(300);
    await page.waitForSelector(invitation, { hidden: true });
    assert.equal(await page.$(access), null);
    await page.waitForFunction(() => Object.values(JSON.parse(document.querySelector("canvas").dataset.lifeNpcs)).every(npc => npc.visible));
    assert.deepEqual(await page.$$eval("[data-npc-access]", list => list.map(node => node.dataset.npcAccess)), ["loic"]);
    assert.equal(offers, 0);
    cases.push("Aube pendant la proposition, même scène, trois habitants retrouvés");
    await phase(1380);
    await focusMarket();
    for (let step = 0; step < 5; step++) await page.click('button[aria-label="Agrandir le village"]');
    await page.waitForSelector('canvas[data-life-observe="korrigans"][data-camera-transition="idle"]');
    await shot("ronde-detail");
    await page.click('button[aria-label="Recentrer la vue isométrique"]');
    await page.waitForSelector('canvas[data-life-observe=""][data-camera-transition="idle"]');
    await open();
    await page.waitForSelector(dialog + " input[type=number]");
    await page.type(dialog + " input", "35");
    await button(dialog, "Calculer|Consulter|Estimer");
    await page.waitForSelector("[data-korrigan-quote]");
    assert.equal(stock, 120);
    await phase(300);
    await page.waitForSelector("[data-korrigan-day]");
    assert.equal(offers, 0);
    await phase(1380);
    const confirm = async () => {
      if (await page.$(dialog + " [data-korrigan-quote]") === null) await button(dialog, "Calculer|Consulter|Estimer");
      if (!(await page.$("[data-korrigan-confirmation]"))) await button(dialog, "confirmation|Donner");
      await button("[data-korrigan-confirmation]", "Donner");
    };
    await confirm();
    await page.waitForFunction(selector => /Offrande remise|Offrande engagée|Lancer le tirage/i.test(document.querySelector(selector)?.innerText), {}, dialog);
    assert.equal(stock, 85);
    await shot("machine-ordinateur");
    let release;
    const accepted = new Promise(resolve => { onDraw = resolve; });
    heldDraw = new Promise(resolve => { release = resolve; });
    await next();
    await accepted;
    await phase(300);
    release(); heldDraw = null;
    await page.waitForSelector(machine + '[data-result="loss"]');
    await page.keyboard.press("Escape");
    await page.waitForSelector(dialog, { hidden: true });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(readyCanvas);
    assert.equal(await page.$(access), null);
    await phase(1380);
    await open();
    await next();
    await page.waitForSelector(machine + '[data-result="x5"]');
    assert.equal(session.draws[1].moneyCents, 52500);
    cases.push("Offrande unique, aube pendant devis et tirage confirmé, reconnexion et reprise sans débit");
    await page.setViewport({ width: 320, height: 700, isMobile: true, hasTouch: true });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    // Switching Chromium's device class reloads the page, as on another device.
    await page.waitForSelector(readyCanvas);
    if (!await page.$(dialog)) await open();
    await next();
    await page.waitForSelector(machine + '[data-result="botte"]');
    assert.equal(await page.$$eval('[data-reel]', list => list.length), 3);
    assert.equal(await page.$$eval('[aria-label="Résultats des tirages"] li', list => list.length), 3);
    assert.equal(offers, 1);
    assert.equal(await page.$eval(dialog, node => node.scrollWidth <= node.clientWidth + 1), true);
    await shot("machine-mobile");
    await page.keyboard.press("Escape");
    await page.waitForSelector(dialog, { hidden: true });
    await focusMarket();
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await page.waitForSelector('canvas[data-motion-state="running"]');
    await shot("ronde-mobile");
    await page.tap(access);
    await page.waitForSelector(invitation);
    cases.push("Bilan de trois tirages, pack et monnaie cumulés, rouleaux, clavier, réduction des mouvements et toucher à 320 px");
    await page.keyboard.press("Escape");
    await page.waitForSelector(invitation, { hidden: true });
    await page.click('button[aria-label="Recentrer la vue isométrique"]');
    await page.waitForSelector('canvas[data-life-observe=""][data-camera-transition="idle"]');
    await page.waitForSelector(access + '[data-offscreen="false"]');
    await page.tap(access);
    await page.waitForSelector(invitation);
    await page.waitForSelector('canvas[data-life-observe="korrigans"][data-camera-transition="idle"]');
    await page.keyboard.press("Escape");
    await page.waitForSelector(invitation, { hidden: true });
    await page.click("[data-village-motion-toggle]");
    await page.waitForSelector('canvas[data-motion-state="paused"]');
    const canvas = await page.$(readyCanvas);
    const pausedAt = await canvas.evaluate(node => node.dataset.motionTime);
    const settled = expected => page.waitForFunction(night => {
      const { lifeKorrigans, lifeNpcs, npcTargets } = document.querySelector("canvas").dataset;
      const round = JSON.parse(lifeKorrigans || "{}");
      const residents = Object.values(JSON.parse(lifeNpcs || "{}"));
      return round.visible === night && round.dancers.length === (night ? 3 : 0) && residents.length === 3 &&
        residents.every(resident => resident.visible === !night) && (!night || !Object.keys(JSON.parse(npcTargets || "{}")).length);
    }, {}, expected);
    await phase(300);
    await settled(false);
    await phase(1380);
    await settled(true);
    assert.equal(await canvas.evaluate(node => node === document.querySelector("canvas") && node.dataset.motionTime), pausedAt);
    const residentHitTargets = await canvas.evaluate(async node => {
      const { fiberRoots } = await import("/@id/__x00__audit-village-camera");
      const { scene } = fiberRoots.get(node).store.getState();
      return ["breton", "fisherman", "loic"].filter(id => scene.getObjectByName("npc-hit-" + id));
    });
    assert.deepEqual(residentHitTargets, []);
    await canvas.dispose();
    cases.push("Ouverture depuis la carte, cadrage automatique et alternance sans remontage en pause à 320 px");
    assert.deepEqual(errors, []);
    await writeFile(resolve(reportFolder, "navigateur.json"), JSON.stringify({ cases, errors, renderer: "Chromium / SwiftShader", backend: "Réponses de marché scénarisées", stock, session }, null, 2));
    console.log(cases.join("\n"));
  } catch (err) {
    await page.screenshot({ path: resolve(reportFolder, "echec.png") }).catch(() => {});
    console.error("Browser:", errors, await page.evaluate(() => document.querySelector("dialog[open]")?.innerText ?? document.body.innerText.slice(-650)));
    throw err;
  } finally { await browser.close(); }
}
