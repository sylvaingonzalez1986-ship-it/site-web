import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { KORRIGAN_ODDS, KORRIGAN_MIN_VALUE_CENTS } from "../src/lib/kanab-quest-korrigan.ts";

const folder = resolve(process.env.KORRIGAN_AUDIT_ART_DIR ?? "docs/bete-de-concours/korrigans");
const reportFolder = resolve(process.env.KORRIGAN_AUDIT_REPORT_DIR ?? "output/korrigans");
const lotId = "657f3cfa-7204-499d-b381-36ce75748dfa";
const sessionId = "db66e98e-f3d2-412f-a3dc-77347086c193";
const week = 168 * 3600000;
const access = "[data-korrigan-access]";
const invitation = "[data-korrigan-invitation]";
const dialog = "[data-korrigan-dialog][open]";
const machine = "[data-korrigan-machine]";
const readyCanvas = "canvas[data-village-ready=true]";
const auditDialogue = process.env.KORRIGAN_AUDIT_DIALOGUE === "1";
const reaction = "[data-korrigan-reaction]";

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
    const requestedDraws = [];
    const now = new Date("2026-11-22T22:00:00Z");
    const draws = ["loss", "x5", "botte"];
    const state = () => ({ serverNow: now.toISOString(), nextOfferAt, minimumValueCents: KORRIGAN_MIN_VALUE_CENTS,
      lots: stock ? [{ id: lotId, label: "Récolte de la serre", availableGrams: stock }] : [], isNight: night, session });
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
      if (body.action === "draw") requestedDraws.push(body.draw);
      if (body.action === "quote") return void json({ ...state(), quote: { valueCents: body.grams * 300, eligible: body.grams * 300 >= KORRIGAN_MIN_VALUE_CENTS } });
      if (body.action === "offer" && night && !session) {
        stock -= body.grams;
        offers++;
        nextOfferAt = new Date(+now + week).toISOString();
        session = { id: sessionId, requestId: body.requestId, odds: KORRIGAN_ODDS, lotId, grams: body.grams,
          valueCents: body.grams * 300, nextOfferAt, draws: [] };
        return void json(state());
      }
      if (auditDialogue && body.action === "draw" && session?.draws[body.draw - 1]?.pending) {
        delete session.draws[body.draw - 1].pending;
        return void json(state());
      }
      if (body.action === "draw" && night && body.draw === session?.draws.length + 1 && body.draw <= 3) {
        const kind = draws[body.draw - 1];
        session.draws.push({ index: body.draw, kind, moneyCents: kind === "x5" ? 5 * session.valueCents : 0,
          ...(kind === "botte" && { itemLabel: "Pack Botte du Chanvrier", ...(auditDialogue && { pending: true }) }) });
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
    const open = async (beforeOpen = null) => {
      await page.waitForSelector(access + '[data-offscreen="false"]', { visible: true });
      await page.focus(access);
      await page.waitForFunction(selector => document.activeElement?.matches(selector), {}, access);
      await page.keyboard.press("Enter");
      await page.waitForSelector(invitation + "[open]");
      if (beforeOpen) await beforeOpen();
      assert(await page.$eval(invitation, node => node.querySelector("button") === document.activeElement));
      await page.keyboard.press("Enter");
      await page.waitForSelector(dialog);
    };
    const next = () => button(dialog, "Lancer le tirage");
    const keyWith = async (modifier, key) => {
      await page.keyboard.down(modifier);
      try { await page.keyboard.press(key); }
      finally { await page.keyboard.up(modifier); }
    };
    const shot = name => page.screenshot({ path: resolve(folder, name + ".webp"), type: "webp", quality: 90 });
    const captureVoices = async name => {
      const speech = `${invitation} [data-korrigan-speech]`;
      await page.waitForFunction(selector => document.querySelectorAll(selector).length === 2, {}, speech);
      const voices = await page.$$eval(speech, nodes => Object.fromEntries(nodes.map(node => [
        node.dataset.korriganSpeech, { label: node.querySelector("strong")?.textContent.trim(), text: node.innerText.trim() },
      ])));
      assert.match(voices.rouge.label, /Bonnet rouge/u);
      assert.match(voices.bleu.label, /Bonnet bleu/u);
      assert(voices.rouge.text.length > voices.rouge.label.length && voices.bleu.text.length > voices.bleu.label.length);
      assert.notEqual(voices.rouge.text, voices.bleu.text);
      assert(await page.$eval(invitation, node => node.scrollWidth <= node.clientWidth + 1));
      await shot(name);
    };
    const waitForReaction = async kind => {
      const line = `${dialog} [role="status"] [data-korrigan-reaction="${kind}"][data-korrigan-speech]`;
      await page.waitForSelector(line, { visible: true });
      assert.equal(await page.$eval(machine, node => node.dataset.result), kind);
    };
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
    if (auditDialogue) await captureVoices("invitation-ordinateur");
    const inviteFocus = () => page.$eval(invitation, node => [...node.querySelectorAll("button")].indexOf(document.activeElement));
    assert.equal(await inviteFocus(), 0);
    await keyWith("Shift", "Tab");
    assert.equal(await inviteFocus(), 1);
    await page.keyboard.press("Tab");
    assert.equal(await inviteFocus(), 0);
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
    const closeButton = `${dialog} header button`;
    const rules = `${dialog} summary`;
    await page.focus(closeButton);
    await keyWith("Shift", "Tab");
    assert(await page.$eval(rules, node => node === document.activeElement));
    await page.keyboard.press("Tab");
    assert(await page.$eval(closeButton, node => node === document.activeElement));
    const amount = `${dialog} input[type=number]`;
    await page.type(amount, "33");
    await button(dialog, "Calculer|Consulter|Estimer");
    await page.waitForSelector("[data-korrigan-quote]");
    assert.match(await page.$eval("[data-korrigan-quote]", node => node.textContent), /99.*100/u);
    assert.equal(offers, 0);
    await page.focus(amount);
    await keyWith("Control", "a");
    await page.type(amount, "35");
    await button(dialog, "Calculer|Consulter|Estimer");
    await page.waitForSelector("[data-korrigan-quote]");
    if (process.env.KORRIGAN_AUDIT_ART_DIR) await shot("offrande-ordinateur");
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
    if (auditDialogue) await page.evaluate((dialogSelector, machineSelector, reactionSelector) => {
      const panel = document.querySelector(dialogSelector);
      window.auditEarlyKorriganReactions = [];
      new MutationObserver(() => {
        const machine = panel.querySelector(machineSelector);
        for (const line of panel.querySelectorAll(reactionSelector)) {
          if (machine.dataset.spinning || machine.dataset.result !== line.dataset.korriganReaction) {
            window.auditEarlyKorriganReactions.push(line.dataset.korriganReaction);
          }
        }
      }).observe(panel, { subtree: true, childList: true, attributes: true });
    }, dialog, machine, reaction);
    let release;
    const accepted = new Promise(resolve => { onDraw = resolve; });
    heldDraw = new Promise(resolve => { release = resolve; });
    const handleTip = await page.$eval(machine, node => {
      const handle = node.querySelector('[class*="lever"] > i');
      const action = node.querySelector('button[data-korrigan-next]');
      const bounds = handle.getBoundingClientRect();
      const x = bounds.x + bounds.width / 2, y = bounds.y + 2;
      return { x, y, hitsAction: document.elementFromPoint(x, y) === action };
    });
    assert.equal(handleTip.hitsAction, true, "La pointe de la poignée doit activer le bouton de tirage");
    await page.mouse.click(handleTip.x, handleTip.y);
    await accepted;
    await page.waitForSelector(machine + '[data-spinning="true"]');
    assert.equal(await page.$(machine + "[data-result]"), null);
    if (auditDialogue) assert.equal(await page.$(`${dialog} ${reaction}`), null);
    if (process.env.KORRIGAN_AUDIT_ART_DIR) await shot("tirage-animation-ordinateur");
    await phase(300);
    release(); heldDraw = null;
    await page.waitForSelector(machine + '[data-result="loss"]');
    if (auditDialogue) {
      await waitForReaction("loss");
      assert.deepEqual(await page.evaluate(() => window.auditEarlyKorriganReactions), []);
    }
    await page.keyboard.press("Escape");
    await page.waitForSelector(dialog, { hidden: true });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(readyCanvas);
    assert.equal(await page.$(access), null);
    await phase(1380);
    await open();
    const acceptedSecond = new Promise(resolve => { onDraw = resolve; });
    heldDraw = new Promise(resolve => { release = resolve; });
    if (auditDialogue) {
      const drawButton = `${machine} button[data-korrigan-next]:not(:disabled)`;
      await page.waitForSelector(drawButton);
      await page.focus(drawButton);
      await page.keyboard.press("Enter");
    } else await next();
    await acceptedSecond;
    await page.waitForSelector(machine + '[data-spinning="true"]');
    await button(dialog, "Passer.*animation");
    assert.equal(await page.$(machine + '[data-result="x5"]'), null);
    if (auditDialogue) assert.equal(await page.$(`${dialog} [data-korrigan-reaction="x5"]`), null);
    release(); heldDraw = null;
    await page.waitForSelector(machine + '[data-result="x5"]');
    if (auditDialogue) await waitForReaction("x5");
    assert.equal(session.draws[1].moneyCents, 52500);
    cases.push("Offrande unique, aube pendant devis et tirage confirmé, reconnexion et reprise sans débit");
    await page.setViewport({ width: 320, height: 700, isMobile: true, hasTouch: true });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    // Switching Chromium's device class reloads the page, as on another device.
    await page.waitForSelector(readyCanvas);
    if (!await page.$(dialog)) await open();
    await page.evaluate(selector => {
      const panel = document.querySelector(selector);
      window.auditKorriganSpins = 0;
      new MutationObserver(() => {
        if (panel.querySelector('[data-spinning="true"]')) window.auditKorriganSpins++;
      }).observe(panel, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-spinning"] });
    }, dialog);
    await next();
    await page.waitForSelector(machine + '[data-result="botte"]');
    if (auditDialogue) {
      await page.waitForFunction(selector => document.querySelector(selector)?.innerText.includes("Remise en attente"), {}, dialog);
      assert.equal(await page.$(`${dialog} ${reaction}`), null);
      await button(dialog, "Récupérer le gain");
      await waitForReaction("botte");
    }
    assert.equal(await page.evaluate(() => window.auditKorriganSpins), 0);
    assert.equal(await page.$$eval('[data-reel]', list => list.length), 3);
    const register = await page.$$eval('[aria-label="Résultats des tirages"] li', list => list.map(row => row.innerText.replace(/\s+/g, " ")));
    assert.equal(register.length, 3);
    assert.match(register[0], /Aucun gain/u);
    assert.match(register[1], /525(?:,00)?\s*€/u);
    assert.match(register[2], /Pack Botte du Chanvrier/u);
    assert.deepEqual(requestedDraws, auditDialogue ? [1, 2, 3, 3] : [1, 2, 3]);
    assert.equal(offers, 1);
    assert.equal(await page.$eval(dialog, node => node.scrollWidth <= node.clientWidth + 1), true);
    await shot("machine-mobile");
    await page.keyboard.press("Escape");
    await page.waitForSelector(dialog, { hidden: true });
    await page.waitForFunction(selector => document.activeElement?.matches(selector), {}, access);
    await focusMarket();
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await page.waitForSelector('canvas[data-motion-state="running"]');
    await shot("ronde-mobile");
    await page.tap(access);
    await page.waitForSelector(invitation);
    cases.push("Devis de 99 € bloqué sous le minimum de 100 €, focus contenu dans les deux modales et rendu au panneau");
    cases.push(`Roulement sans résultat anticipé, passage de l’animation, aucun roulement en mouvement réduit. Résultats serveur de perte, ×5 et pack${auditDialogue ? ", avec reprise du pack" : ", chacun demandé une fois"}, toucher à 320 px`);
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
    const finished = { stock, session };
    stock = 0; session = null; nextOfferAt = null;
    await open(auditDialogue ? () => captureVoices("invitation-mobile") : null);
    await page.waitForFunction(selector => /Aucun lot de fleurs sèches disponible/.test(document.querySelector(selector)?.innerText ?? ""), {}, dialog);
    assert.equal(await page.$(`${dialog} input[type=number]`), null);
    await shot("offrande-vide-mobile");
    await button(dialog, "Voir mes récoltes");
    await page.waitForFunction(() => window.__villageNavigations?.includes("/arene/placard?view=harvests&section=storage"));
    await page.waitForSelector(dialog, { hidden: true });
    await page.setViewport({ width: 903, height: 576 });
    await page.waitForSelector(readyCanvas);
    await open();
    await page.waitForFunction(selector => /Aucun lot de fleurs sèches disponible/.test(document.querySelector(selector)?.innerText ?? ""), {}, dialog);
    await shot("offrande-vide-ordinateur");
    cases.push("Activation du premier tirage à la pointe du levier. Lot vide à 320 px et action vers les récoltes");
    if (auditDialogue) cases.push("Deux voix nommées dans l’invitation aux deux tailles. Entrée et tirage au clavier, répliques après la révélation et sans annonce de gain en attente");
    assert.deepEqual(errors, []);
    await writeFile(resolve(reportFolder, "navigateur.json"), JSON.stringify({ cases, errors, browser: await browser.version(),
      renderer: "Chromium / SwiftShader", viewports: ["1280 × 800", "320 × 700 tactile", "903 × 576"],
      backend: "Réponses de marché scénarisées", ...finished }, null, 2));
    console.log(cases.join("\n"));
  } catch (err) {
    await page.screenshot({ path: resolve(reportFolder, "echec.png") }).catch(() => {});
    console.error("Browser:", errors, await page.evaluate(() => document.querySelector("dialog[open]")?.innerText ?? document.body.innerText.slice(-650)));
    throw err;
  } finally { await browser.close(); }
}
