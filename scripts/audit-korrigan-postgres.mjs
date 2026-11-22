import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { Launcher } from "chrome-launcher";
import puppeteer from "puppeteer-core";
import { openKorriganFixture } from "./test-korrigan-market.mjs";

/** Exercise the actual UI, Next handlers, shop quotation and PostgreSQL commands on a disposable local player. */
export async function auditKorriganPostgres(origin) {
  const fixture = await openKorriganFixture();
  let browser, api;
  const out = resolve("output/korrigans");
  await mkdir(out, { recursive: true });
  try {
    const player = await fixture.player();
    const args = {
      kq_korrigan_market: ["p_user_id", "p_action", "p_clock", "p_lot_id", "p_grams", "p_request_id", "p_session_id", "p_draw", "p_expected_value_cents"],
      rpc_kq_commerce_state: ["p_user_id"],
    };
    globalThis.korriganTestRpc = async (name, payload) => {
      assert(Object.hasOwn(args, name));
      const values = args[name].map(key => payload[key] ?? null);
      try {
        const sql = `SELECT public.${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) AS data`;
        const result = await fixture.db.query(sql, values);
        return { data: result.rows[0].data, error: null };
      } catch (error) { return { data: null, error: { message: error.message } }; }
    };
    const mocks = {
      "customer-backend": `export const getCurrentCustomerSessionByBackend = async () => ({ customerId: ${JSON.stringify(player.user)} });`,
      "kanab-quest-player-request-access": "export const isKqPlayerRequestEnabled=async()=>true",
      "security-rate-limit": "export const hitRateLimit=async()=>({allowed:true}); export const getRequestIp=()=>'127.0.0.1'",
      "supabase/admin": "export const createSupabaseServiceClient=()=>({rpc:globalThis.korriganTestRpc})",
      "kanab-quest-staff-backend": "export const settleKqStaffIfAvailable=async()=>null",
    };
    api = await createServer({ configFile: false, envDir: false, resolve: { alias: { "server-only": resolve("src/test/server-only.ts"), "@": resolve("src") } },
      server: { middlewareMode: true, hmr: false, watch: null }, plugins: [{ name: "local-korrigan-route", enforce: "pre",
        resolveId(id, importer) {
          const key = Object.keys(mocks).find(key => id === key || id.replaceAll("\\", "/").replace(/\.tsx?$/, "").endsWith("/" + key));
          if (key) return "\0kq-fixture:" + key;
          if (id === "./admin" && importer?.includes("supabase")) return "\0kq-fixture:supabase/admin";
        },
        load(id) { if (id.startsWith("\0kq-fixture:")) return mocks[id.slice(12)]; },
      }] });
    const route = await api.ssrLoadModule("/src/app/api/arena/placard/korrigans/route.ts");
    browser = await puppeteer.launch({ executablePath: Launcher.getInstallations()[0], headless: true,
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    const errors = [], requests = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.setRequestInterception(true);
    let lostOffer = false;
    page.on("request", async req => {
      const url = new URL(req.url());
      if (!url.pathname.startsWith("/api/")) return void (url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? req.continue() : req.abort());
      if (url.pathname.endsWith("/equipment")) {
        const { rows: [clock] } = await fixture.db.query("SELECT business_started_at AS origin,clock_timestamp() AS now FROM kq_commerce_accounts WHERE user_id=$1", [player.user]);
        return void req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ activeRun: false,
          readyLotCount: 1, availableFlowerCount: 1, cashCents: 0, businessClock: { startedAt: clock.origin, serverNow: clock.now } }) });
      }
      if (!url.pathname.endsWith("/korrigans")) return void req.respond({ status: 404, body: "{}" });
      const method = req.method(), body = req.postData();
      const reply = await route[method](new Request(req.url(), { method, body }));
      const value = await reply.text();
      const action = body ? JSON.parse(body).action : "state";
      requests.push({ action, status: reply.status });
      if (reply.status >= 400) console.error(action, value);
      if (reply.ok && action === "offer" && !lostOffer) {
        lostOffer = true;
        return void req.abort("connectionreset");
      }
      return void req.respond({ status: reply.status, contentType: "application/json", body: value });
    });
    const click = async pattern => {
      const button = await page.waitForFunction(text => [...document.querySelectorAll("button")].find(el => el.offsetWidth && !el.disabled && new RegExp(text, "i").test(el.textContent)), {}, pattern);
      await button.asElement().click();
      await button.dispose();
    };
    const visit = async () => {
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-korrigan-access][data-offscreen="false"]', { visible: true });
      await page.click("[data-korrigan-access]");
      await click("Voir la machine|Reprendre.*(offrande|session|tirage|machine)");
      await page.waitForSelector("[data-korrigan-dialog][open]");
    };
    const read = async () => (await fixture.db.query("SELECT kq_korrigan_market($1,'state',$2::jsonb) AS market", [player.user, { dayMs: 14400000, dawn: 300, night: 1260 }])).rows[0].market;
    await page.setViewport({ width: 1000, height: 780 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await visit();
    await page.waitForSelector("dialog input");
    await page.type("dialog input", "35");
    await click("Calculer la valeur");
    await page.waitForSelector("[data-korrigan-quote]");
    await click("Passer à la confirmation");
    await click("Donner 35");
    await page.waitForFunction(() => document.querySelector('[role="alert"]') || document.body.innerText.includes("Offrande remise"));
    await visit();
    for (let index = 1; index <= 3; index++) await click("Lancer le tirage " + index);
    await page.waitForFunction(() => (document.querySelector('[aria-label="Résultats des tirages"]')?.children.length ?? 0) === 3);
    const result = await read();
    assert.equal(result.session.grams, 35);
    assert.equal(result.session.draws.length, 3);
    assert(lostOffer && result.session.draws.every(draw => !draw.pending));
    const row = (await fixture.db.query("SELECT s.grams,extract(epoch FROM (s.next_offer_at-s.offered_at)) AS seconds,stock.remaining_units FROM kq_korrigan_sessions s JOIN kq_commerce_stock stock ON s.lot_id=stock.id WHERE s.user_id=$1", [player.user])).rows;
    assert.equal(row.length, 1);
    assert.equal(Number(row[0].seconds), 604800);
    assert.equal(row[0].remaining_units, 650);
    assert.deepEqual(errors, []);
    await writeFile(resolve(out, "navigateur-postgres.json"), JSON.stringify({ passed: true, requests, rows: row, session: result.session,
      transport: "Next route invoked with fixture identity and local PostgreSQL RPC adapter", lostOffer }, null, 2));
    console.log("Chromium → Next → PostgreSQL : offrande récupérée après coupure, un débit, trois tirages, 604800 secondes.");
  } finally {
    delete globalThis.korriganTestRpc;
    await browser?.close();
    await api?.close();
    await fixture.close();
  }
}
