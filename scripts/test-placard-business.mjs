// Isolated PostgreSQL integration checks. No .env, credentials, network or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const vite = await createServer({
  configFile: false, envDir: false,
  resolve: { alias: { "@": path.resolve("src") } },
  server: { middlewareMode: true, watch: null },
});
const migration = (name) => readFile(path.resolve("supabase/migrations", name), "utf8");
const result = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const state = async (owner) => (await result("SELECT rpc_kq_commerce_state($1) AS data", [owner])).data;
const command = async (owner, action, payload = {}, key = randomUUID()) => (await result(
  "SELECT rpc_kq_commerce_command($1,$2,$3::jsonb,$4) AS data", [owner, action, JSON.stringify(payload), key])).data;
const cash = async (owner) => (await result("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner])).cash_cents;
let quoteKqCommerce, previewKqBusinessPayment, KQ_ADVERTISING;

async function bootstrap() {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY,code TEXT,description TEXT,updated_at TIMESTAMPTZ);
    CREATE TABLE kq_support_card_rules(card_definition_id UUID,advantage TEXT,rules_version INTEGER,updated_at TIMESTAMPTZ);
    CREATE TYPE kq_run_status AS ENUM ('active','completed','abandoned');
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,state JSONB,status kq_run_status,
      started_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ,updated_at TIMESTAMPTZ DEFAULT now(),integrity_code TEXT,
      CHECK((status='completed')=(completed_at IS NOT NULL)));
    CREATE UNIQUE INDEX one_active_run ON kq_runs(user_id) WHERE status='active';
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT,variety_name TEXT DEFAULT 'Test');
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY,cash_cents INTEGER NOT NULL DEFAULT 35000 CHECK(cash_cents>=0),
      reputation INTEGER NOT NULL DEFAULT 0 CHECK(reputation>=0),planned_route_code TEXT,planned_equipment_code TEXT,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS
      'INSERT INTO kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING';
    CREATE TABLE kq_equipment_catalog(code TEXT PRIMARY KEY,category TEXT,slot TEXT,price_cents INTEGER,is_active BOOLEAN DEFAULT true);
    CREATE TABLE kq_player_equipment(user_id UUID,equipment_code TEXT,level INTEGER DEFAULT 1,PRIMARY KEY(user_id,equipment_code));
    CREATE TABLE kq_equipment_loadouts(user_id UUID,equipment_code TEXT);
    CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT UNIQUE,updated_at TIMESTAMPTZ DEFAULT now());
    -- Starts use representative insert bodies; identity/updated-at run actions below use their actual migrations.
    CREATE FUNCTION rpc_kq_start_run(p_user_id UUID,p_buddie TEXT,p_seed INTEGER,p_deck TEXT[],p_scenario TEXT[],p_initial_state JSONB,p_culture_tokens INTEGER DEFAULT 0)
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE v_run public.kq_runs%ROWTYPE;
    BEGIN
      INSERT INTO public.kq_runs(user_id,state,status) VALUES(p_user_id,p_initial_state,'active') RETURNING * INTO v_run;
      RETURN jsonb_build_object('run',to_jsonb(v_run));
    END $$;
    CREATE FUNCTION rpc_kq_start_run_with_heritage(p_user_id UUID,p_buddie TEXT,p_seed INTEGER,p_deck TEXT[],p_scenario TEXT[],p_initial_state JSONB,p_heritage INTEGER,p_card TEXT)
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE v_expected_xp INTEGER; v_base_xp INTEGER:=1; v_buddie_xp INTEGER:=4; v_heritage_xp INTEGER:=0; v_result JSONB;
    BEGIN
      v_expected_xp := v_base_xp + v_buddie_xp + v_heritage_xp;
      v_result:=public.rpc_kq_start_run(p_user_id,p_buddie,p_seed,p_deck,p_scenario,p_initial_state,p_heritage);
      IF v_buddie_xp > 0 OR v_heritage_xp > 0 THEN RETURN v_result||jsonb_build_object('xp',v_expected_xp); END IF;
      RETURN v_result;
    END $$;
    REVOKE ALL ON FUNCTION rpc_kq_start_run(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER),rpc_kq_start_run_with_heritage(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION rpc_kq_start_run(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER),rpc_kq_start_run_with_heritage(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) TO service_role;
  `);
  for (const name of [
    "20260725001800_kq_atomic_heritage_hand_swap.sql",
    "20260818000100_kq_accept_decimal_flower_stats.sql",
    "20260830000200_kq_post_harvest_market.sql",
    "20260904000200_kq_route_masteries.sql",
    "20260905000100_kq_route_expertise_rewards.sql",
    "20260909000100_kq_quality_reputation.sql",
    "20260911000300_kq_cycle_electricity.sql",
    "20260912000200_kq_living_market.sql",
    "20260913000100_kq_sales_channels.sql",
    "20260913000200_kq_commerce_completed_at.sql",
    "20260913000300_kq_commerce_mastery_guards.sql",
    "20260913000400_kq_shop_partners.sql",
    "20260914000100_arena_chanvrier_profiles.sql",
    "20260914000200_kq_machine_maintenance.sql",
    "20260914000300_chanvrier_treasurer_starting_capital.sql",
    "20260914000400_chanvrier_green_thumb_xp.sql",
    "20260914000500_kq_shop_offer_precision.sql",
    "20260915000300_kq_realtime_commerce_demand.sql",
    "20260919000100_chanvrier_customization_and_benefits.sql",
  ]) await db.exec(await migration(name));
}

async function player({ balance = 1000000, strength = null, completed = true } = {}) {
  const owner = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
  await state(owner);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=$2,reputation=200 WHERE user_id=$1", [owner, balance]);
  if (strength) await db.query("SELECT rpc_arena_save_chanvrier($1,$2::jsonb)", [owner, JSON.stringify({
    nickname: `P${owner.replaceAll('-', '').slice(0, 12)}`, gender: "male", clothing: "teal", skin: "peach", strength,
  })]);
  if (completed) {
    const run = randomUUID();
    // Fixture insertion bypasses completion-trigger billing; actual completion is exercised separately.
    await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{}','completed',now())", [run, owner]);
    await state(owner);
    await db.query("UPDATE kq_commerce_campaigns SET event='normal' WHERE user_id=$1", [owner]);
  }
  return owner;
}

async function stock(owner, { units = 5000, score = 9, price = 180 } = {}) {
  const flower = randomUUID(), id = randomUUID();
  await db.query("INSERT INTO kq_flowers(id,owner_id,status) VALUES($1,$2,'burned')", [flower, owner]);
  await db.query("INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,options,status,selected_route) VALUES($1,$2,$3,$4,'signature','[]','stocked','raw')", [flower, owner, units / 10, score]);
  await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'raw',$3,0)", [flower, owner, units]);
  await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',$4,$4,$4,$5)", [id, flower, owner, units, price]);
  return id;
}

async function quote(owner, stockId, channel = "online", units = 100) {
  const current = await state(owner);
  const item = current.stocks.find((entry) => entry.id === stockId);
  let offer = quoteKqCommerce(current, item, channel, "advised", units);
  const id = randomUUID();
  const energy = Number((await result("SELECT COALESCE(sum(remaining_cents),0) AS cents FROM kq_energy_invoices WHERE user_id=$1", [owner])).cents);
  offer = { ...offer, ...previewKqBusinessPayment(offer.payoutCents, current.business, energy) };
  await db.query(`INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,energy_outstanding_cents,offer,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now()+interval '10 minutes')`,
  [id, owner, stockId, current.revision, current.campaign?.id, current.campaign?.revision, item.remainingUnits, current.reputation, energy, JSON.stringify(offer)]);
  return { id, offer, current };
}

async function sell(owner, quoted, key = randomUUID()) {
  return command(owner, "sell", { quoteId: quoted.id, expectedPayoutCents: quoted.offer.payoutCents }, key);
}

async function openShop(owner, name = "La Fleur locale") {
  await command(owner, "buy-computer");
  return command(owner, "create-shop", { name });
}

async function complete(owner) {
  const run = randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,'{}','active')", [run, owner]);
  await db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1", [run]);
  return run;
}

async function checkWebsite() {
  const owner = await player();
  await assert.rejects(() => command(owner, "create-shop", { name: "Avant le PC" }), /computer/);
  await command(owner, "buy-computer");
  await assert.rejects(() => command(owner, "internet", { enabled: true }), /shop|retired|action|legacy_internet/);
  for (const name of ["", "ab", "a".repeat(41), "<script>", "Nom\ninterdit"]) {
    await assert.rejects(() => command(owner, "create-shop", { name }), /name|invalid/);
  }
  const before = await cash(owner), key = randomUUID();
  const payload = { name: "La Fleur locale" };
  const creation = await command(owner, "create-shop", payload, key);
  assert.equal(await cash(owner), before - 100000, "creation costs exactly 1000 euros");
  assert.equal((await command(owner, "create-shop", payload, key)).replayed, true);
  assert.equal(await cash(owner), before - 100000, "duplicate request never charges twice");
  await assert.rejects(() => command(owner, "create-shop", payload), /exists|created|owned/);
  await assert.rejects(() => command(owner, "rename-shop", { name: "Autre nom" }, key), /mismatch/);
  let current = await state(owner);
  assert.equal(current.business.shop.name, payload.name);
  assert.equal(current.business.shop.active, true);
  assert.equal(Date.parse(current.business.shop.paidUntil) - Date.parse(current.business.shop.createdAt), 120 * 3600000);
  assert.equal(current.cashCents, creation.cashAfterCents, "initial month is included");
  await command(owner, "rename-shop", { name: "Le Jardin" });
  assert.equal((await state(owner)).business.shop.name, "Le Jardin");
  assert.equal(await cash(owner), before - 100000);
  const legacyBalance = await cash(owner);
  await complete(owner);
  assert.equal(await cash(owner), legacyBalance, "completion no longer charges the legacy 15 euros");

  await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()-interval '121 hours' WHERE user_id=$1", [owner]);
  current = await state(owner);
  assert.equal(current.cashCents, legacyBalance - 20000, "offline renewal catches up two elapsed months");
  assert.equal((await state(owner)).cashCents, current.cashCents, "offline catch-up is idempotent");
  const afterCatchup = current.cashCents;
  await command(owner, "shop-renewal", { enabled: false });
  await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()-interval '1 second' WHERE user_id=$1", [owner]);
  current = await state(owner);
  assert.equal(current.business.shop.active, false);
  assert.equal(current.cashCents, afterCatchup, "disabling renewal prevents another debit");
  await command(owner, "renew-shop");
  current = await state(owner);
  assert.equal(current.business.shop.active, true);
  assert.equal(current.cashCents, afterCatchup - 10000, "manual renewal buys one month");

  await command(owner, "shop-renewal", { enabled: true });
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=9999 WHERE user_id=$1", [owner]);
  await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()-interval '1000 days' WHERE user_id=$1", [owner]);
  current = await state(owner);
  assert.equal(current.business.shop.active, false);
  assert.equal(current.cashCents, 9999, "insufficient funds suspend without overdraft or accumulated debt");
  await assert.rejects(() => command(owner, "renew-shop"), /cash/);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=50000 WHERE user_id=$1", [owner]);
  await command(owner, "renew-shop");
  assert.equal(await cash(owner), 40000, "reopening a suspended shop costs one month only");
  console.log("PASS: shop prerequisites, names, idempotency, included month, renewal, offline catch-up and suspension.");
}

async function checkAdvertising() {
  for (const [kind, config] of Object.entries(KQ_ADVERTISING)) {
    const owner = await player({ strength: kind === "radio" ? "merchant" : null });
    await assert.rejects(() => command(owner, "advertise", { kind }), /shop/);
    await openShop(owner);
    const item = await stock(owner);
    const baseline = await quote(owner, item, "online", 100000);
    const before = await cash(owner), key = randomUUID();
    await command(owner, "advertise", { kind }, key);
    assert.equal(await cash(owner), before - config.costCents);
    assert.equal((await command(owner, "advertise", { kind }, key)).replayed, true);
    await assert.rejects(() => command(owner, "advertise", { kind: kind === "radio" ? "instagram" : "radio" }), /active|campaign/);
    const current = await state(owner), ad = current.business.advertising;
    assert.equal(ad.kind, kind);
    assert.equal(ad.boostPercent, config.boostPercent);
    assert.equal(Date.parse(ad.endsAt) - Date.parse(ad.startedAt), config.durationDays * 4 * 3600000);
    const advertised = await quote(owner, item, "online", 100000);
    const multiplier = 1 + config.boostPercent / 100;
    assert(Math.abs(advertised.offer.maxUnits - baseline.offer.maxUnits * multiplier) <= 1, `${kind}: advertised demand matches its multiplier`);
    await assert.rejects(() => sell(owner, baseline), /offer_changed/, "starting a campaign invalidates an earlier quote");
    await sell(owner, advertised);
    const consumed = await state(owner);
    assert(consumed.demand.onlineDebt > multiplier - 0.01, `${kind}: boosted demand is consumed against the same baseline in TS and SQL`);
    await db.query("UPDATE kq_commerce_accounts SET advertising=jsonb_set(advertising,'{endsAt}',to_jsonb((now()-interval '1 second')::text)) WHERE user_id=$1", [owner]);
    const expired = await state(owner);
    assert.equal(expired.business.advertising, null);
    const exhausted = await quote(owner, item, "online", 100);
    assert.equal(exhausted.offer.maxUnits, 0, "campaign expiry cannot create demand");
  }
  const owner = await player();
  await openShop(owner);
  await command(owner, "advertise", { kind: "radio" });
  await command(owner, "shop-renewal", { enabled: false });
  await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()-interval '1 second' WHERE user_id=$1", [owner]);
  const suspended = await state(owner);
  assert.equal(suspended.business.shop.active, false);
  assert.equal(suspended.demand.onlineCapacityMultiplier, 1, "an advert cannot boost a suspended shop");
  const capacity = (await result("SELECT kq_commerce_capacity($1) AS data", [owner])).data;
  assert.equal(capacity.online, capacity.onlineBase);
  console.log("PASS: advertising prices, durations, exclusivity, merchant capacity, quote invalidation and expiry.");
}

async function checkVatAndQuotes() {
  const owner = await player();
  await openShop(owner);
  const item = await stock(owner, { price: 1 });
  const startCash = await cash(owner);
  let revenue = 0, withheld = 0;
  for (let index = 0; index < 18; index++) {
    const channel = ["online", "cbd-shop", "wholesale"][index % 3];
    const offer = await quote(owner, item, channel, 13 + index);
    const receipt = await sell(owner, offer);
    revenue += receipt.payoutCents;
    withheld += receipt.vatCents;
    assert.equal(receipt.vatCents, offer.offer.vatCents, "SQL VAT agrees with the server preview");
    assert.equal(receipt.netPayoutCents, receipt.payoutCents - receipt.vatCents);
    assert.equal(withheld, Math.round(revenue / 6), "cumulative VAT rounding survives small mixed-channel sales");
  }
  let current = await state(owner);
  assert.equal(current.business.vat.salesTtcCents, revenue);
  assert.equal(current.business.vat.reservedCents, withheld);
  assert.equal(current.cashCents, startCash + revenue - withheld);
  await db.query("UPDATE kq_commerce_accounts SET vat_next_settlement_at=now()-interval '121 hours' WHERE user_id=$1", [owner]);
  current = await state(owner);
  assert.equal(current.business.vat.reservedCents, 0);
  assert.equal(current.business.vat.paidCents, withheld);
  assert.equal(current.cashCents, startCash + revenue - withheld, "monthly remittance never deducts the reserved VAT twice");
  assert.equal((await state(owner)).business.vat.paidCents, withheld);
  const next = await quote(owner, item, "wholesale", 29);
  const nextSale = await sell(owner, next);
  assert.equal(nextSale.vatCents, Math.round((revenue + nextSale.payoutCents) / 6) - Math.round(revenue / 6), "monthly remittance preserves cumulative rounding");

  const forged = await quote(owner, item, "wholesale", 500);
  await db.query("UPDATE kq_commerce_quotes SET offer=jsonb_set(offer,'{vatCents}','0') WHERE id=$1", [forged.id]);
  const beforeForged = await state(owner);
  await assert.rejects(() => sell(owner, forged), /offer_changed/, "SQL validates stored deduction amounts again at settlement");
  assert.equal(await cash(owner), beforeForged.cashCents);
  assert.equal((await state(owner)).business.vat.salesTtcCents, beforeForged.business.vat.salesTtcCents);

  const stale = await quote(owner, item, "wholesale", 10);
  await db.query("UPDATE kq_commerce_quotes SET expires_at=now()-interval '1 second' WHERE id=$1", [stale.id]);
  const beforeRejected = await state(owner);
  await assert.rejects(() => sell(owner, stale), /offer_changed/);
  assert.equal(await cash(owner), beforeRejected.cashCents);
  assert.equal((await state(owner)).stocks.find(s => s.id === item).remainingUnits, beforeRejected.stocks.find(s => s.id === item).remainingUnits);
  const competingA = await quote(owner, item, "wholesale", 10), competingB = await quote(owner, item, "wholesale", 10);
  const outcomes = await Promise.allSettled([sell(owner, competingA), sell(owner, competingB)]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1, "only one competing quote settles");
  const replayQuote = await quote(owner, item, "wholesale", 10), replayKey = randomUUID();
  const settled = await sell(owner, replayQuote, replayKey), replayCash = await cash(owner);
  const replay = await sell(owner, replayQuote, replayKey);
  assert.equal(replay.replayed, true);
  assert.equal(replay.vatCents, settled.vatCents);
  assert.equal(await cash(owner), replayCash);
  console.log("PASS: TTC VAT across channels, cumulative rounding, monthly remittance, expired quotes, atomicity and sale replay.");
}

async function checkLaboratory(historical) {
  assert.equal(Number((await result("SELECT count(*) AS n FROM kq_lab_invoices WHERE user_id=$1", [historical])).n), 0, "historical cultures are not invoiced retroactively");
  const owner = await player(), before = await cash(owner), run = await complete(owner);
  let invoice = await result("SELECT * FROM kq_lab_invoices WHERE run_id=$1", [run]);
  assert.equal(invoice.amount_cents, 4500);
  assert.equal(invoice.remaining_cents, 4500);
  assert.equal(new Date(invoice.due_at) - new Date(invoice.issued_at), 120 * 3600000);
  assert.equal(await cash(owner), before, "new analysis is payable later");
  await db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1", [run]);
  assert.equal(Number((await result("SELECT count(*) AS n FROM kq_lab_invoices WHERE run_id=$1", [run])).n), 1);
  await db.query("UPDATE kq_lab_invoices SET due_at=now()-interval '1 second' WHERE id=$1", [invoice.id]);
  let current = await state(owner);
  assert.equal(current.cashCents, before - 4500, "analysis is automatically paid at its due date");
  assert.equal(current.business.lab.outstandingCents, 0);
  assert.equal((await state(owner)).cashCents, current.cashCents);

  const overdueOwner = await player({ balance: 0 });
  const overdueRun = await complete(overdueOwner);
  await db.query("UPDATE kq_lab_invoices SET due_at=now()-interval '1 second' WHERE run_id=$1", [overdueRun]);
  current = await state(overdueOwner);
  assert.equal(current.business.lab.overdueCents, 4500);
  await db.query("INSERT INTO kq_energy_invoices(run_id,user_id,total_cents,remaining_cents,quote,harvest_grams) VALUES($1,$2,10000,10000,'{}',120)", [overdueRun, overdueOwner]);
  const item = await stock(overdueOwner);
  const partial = await quote(overdueOwner, item, "wholesale", 100);
  const partialSale = await sell(overdueOwner, partial);
  assert.equal(partialSale.labPaidCents, Math.floor((partialSale.payoutCents - partialSale.vatCents) / 2));
  assert.equal(partialSale.electricityPaidCents, 0, "overdue analysis has priority over electricity");
  assert.equal(partialSale.netPayoutCents, partial.offer.netPayoutCents);
  const enough = await quote(overdueOwner, item, "wholesale", 2500);
  const paid = await sell(overdueOwner, enough);
  assert.equal(paid.labPaidCents, 4500 - partialSale.labPaidCents);
  assert(paid.electricityPaidCents > 0, "remaining half-revenue budget pays electricity");
  assert.equal(paid.labPaidCents + paid.electricityPaidCents, Math.floor((paid.payoutCents - paid.vatCents) / 2));
  assert.equal(paid.netPayoutCents, enough.offer.netPayoutCents);
  assert.equal((await state(overdueOwner)).business.lab.outstandingCents, 0);

  const earlyRun = await complete(owner);
  invoice = await result("SELECT * FROM kq_lab_invoices WHERE run_id=$1", [earlyRun]);
  const payKey = randomUUID(), earlyBalance = await cash(owner);
  await command(owner, "pay-lab", { invoiceId: invoice.id }, payKey);
  assert.equal(await cash(owner), earlyBalance - 4500);
  assert.equal((await command(owner, "pay-lab", { invoiceId: invoice.id }, payKey)).replayed, true);
  await assert.rejects(() => command(overdueOwner, "pay-lab", { invoiceId: invoice.id }), /invoice|lab/);
  console.log("PASS: non-retroactive analysis invoices, J+30 due date, once-only payment and shared net-of-VAT collection budget.");
}

async function checkPermissions() {
  for (const role of ["anon", "authenticated"]) {
    for (const table of ["kq_lab_invoices", "kq_business_ledger", "kq_commerce_accounts"]) {
      const privileges = await result("SELECT has_table_privilege($1,$2,'INSERT,UPDATE,DELETE') AS writes", [role, table]);
      assert.equal(privileges.writes, false, `${role} cannot write ${table}`);
    }
    const privileges = await result("SELECT has_function_privilege($1,'rpc_kq_commerce_command(uuid,text,jsonb,uuid)','EXECUTE') AS command,has_function_privilege($1,'kq_business_settle(uuid)','EXECUTE') AS settle", [role]);
    assert.equal(privileges.command, false);
    assert.equal(privileges.settle, false);
    const exposed = (await db.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND (p.proname LIKE 'kq_business_%' OR p.proname='kq_invoice_completed_lab')
      AND has_function_privilege($1,p.oid,'EXECUTE')`, [role])).rows;
    assert.deepEqual(exposed, [], `${role} cannot invoke internal business functions`);
  }
}

async function checkOtherWalletEntry() {
  const owner = await player();
  await openShop(owner);
  const current = await state(owner), run = current.campaign.id;
  await db.query("INSERT INTO kq_energy_invoices(run_id,user_id,total_cents,remaining_cents,quote,harvest_grams) VALUES($1,$2,100,100,'{}',120)", [run, owner]);
  await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()-interval '1 second' WHERE user_id=$1", [owner]);
  const before = await cash(owner);
  const key = randomUUID();
  await db.query("SELECT rpc_kq_pay_energy($1,$2,100)", [owner, key]);
  assert.equal(await cash(owner), before - 10100, "electricity payment settles the due website fee first");
  await db.query("SELECT rpc_kq_pay_energy($1,$2,100)", [owner, key]);
  assert.equal(await cash(owner), before - 10100, "replaying an electricity payment does not repeat either debit");
  const online = (await state(owner)).business;
  assert.equal(online.shop.active, true);
  console.log("PASS: non-commerce wallet payment settles due business expenses and preserves replay safety.");
}

async function checkDomiciliation() {
  const owner = await player();
  let current = await state(owner);
  assert.deepEqual(current.business.domiciliation, { mode: "home", paidUntil: null, renew: false, active: false });
  const before = await cash(owner), key = randomUUID();
  await command(owner, "domiciliation", { mode: "external" }, key);
  current = await state(owner);
  const paidUntil = current.business.domiciliation.paidUntil;
  assert.equal(current.cashCents, before - 5000);
  assert.equal(current.business.domiciliation.mode, "external");
  assert.equal(current.business.domiciliation.renew, true);
  assert.equal(current.business.domiciliation.active, true);
  assert(Math.abs(Date.parse(paidUntil) - Date.parse(current.business.serverNow) - 120 * 3600000) < 2000);
  assert.equal((await command(owner, "domiciliation", { mode: "external" }, key)).replayed, true);
  await command(owner, "domiciliation", { mode: "external" });
  assert.equal(await cash(owner), before - 5000, "repeated external selection never charges a paid month twice");
  await command(owner, "domiciliation", { mode: "home" });
  current = await state(owner);
  assert.equal(current.business.domiciliation.mode, "home");
  assert.equal(current.business.domiciliation.renew, false);
  assert.equal(current.business.domiciliation.paidUntil, paidUntil);
  assert.equal(current.cashCents, before - 5000, "returning home does not refund a paid month");
  await command(owner, "domiciliation", { mode: "external" });
  current = await state(owner);
  assert.equal(current.business.domiciliation.paidUntil, paidUntil);
  assert.equal(current.cashCents, before - 5000, "remaining paid external time can be reused without another fee");
  await db.query("UPDATE kq_commerce_accounts SET domiciliation_paid_until=now()-interval '121 hours' WHERE user_id=$1", [owner]);
  current = await state(owner);
  assert.equal(current.cashCents, before - 15000, "offline external address renewal catches up two months");
  assert.equal(current.business.nextEventAt, current.business.domiciliation.paidUntil);
  assert.equal((await state(owner)).cashCents, current.cashCents);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=4999 WHERE user_id=$1", [owner]);
  await db.query("UPDATE kq_commerce_accounts SET domiciliation_paid_until=now()-interval '1 second' WHERE user_id=$1", [owner]);
  current = await state(owner);
  assert.equal(current.cashCents, 4999);
  assert.equal(current.business.domiciliation.mode, "home");
  assert.equal(current.business.domiciliation.active, false);
  assert.equal(current.business.domiciliation.renew, false);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=20000 WHERE user_id=$1", [owner]);
  assert.equal((await state(owner)).cashCents, 20000, "an expired address cannot accumulate charges or restart on its own");
  await command(owner, "domiciliation", { mode: "external" });
  assert.equal(await cash(owner), 15000);
  await assert.rejects(() => command(owner, "domiciliation", { mode: "invalid" }), /domiciliation_mode/);
  console.log("PASS: home/external domiciliation, paid period reuse, monthly/offline renewal and return home on insufficient funds.");
}

async function historicalSale(owner) {
  const flower = randomUUID(), key = randomUUID();
  await db.query("INSERT INTO kq_flowers(id,owner_id,status) VALUES($1,$2,'burned')", [flower, owner]);
  await db.query("INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,options) VALUES($1,$2,120,8,'premium',$3::jsonb)",
    [flower, owner, JSON.stringify([{ route: "raw", available: true, payoutCents: 12000, reputationPolicyVersion: 2 }])]);
  const receipt = (await result("SELECT rpc_kq_sell_market_lot($1,$2,$3,'raw') AS data", [owner, flower, key])).data;
  return { flower, key, receipt };
}

async function checkLegacyRetirement(owner, historical) {
  const before = await cash(owner);
  const replay = (await result("SELECT rpc_kq_sell_market_lot($1,$2,$3,'raw') AS data", [owner, historical.flower, historical.key])).data;
  assert.equal(replay.replayed, true);
  assert.equal(replay.netPayoutCents, historical.receipt.netPayoutCents);
  assert.equal(replay.vatCents, 0, "historical receipts are not retrospectively taxed");
  const offeredReplay = (await result("SELECT rpc_kq_sell_market_offer($1,$2,$3,'raw','fair',12000,0) AS data", [owner, historical.flower, historical.key])).data;
  assert.equal(offeredReplay.replayed, true);
  assert.equal(await cash(owner), before);
  await assert.rejects(() => db.query("SELECT rpc_kq_sell_market_lot($1,$2,$3,'raw')", [owner, randomUUID(), randomUUID()]), /commerce_legacy_sale/);
  await assert.rejects(() => db.query("SELECT rpc_kq_sell_market_offer($1,$2,$3,'raw','fair',12000,0)", [owner, randomUUID(), randomUUID()]), /commerce_legacy_sale/);
  console.log("PASS: both legacy sale RPCs reject new sales while preserving historical receipts and replays.");
}

async function checkRunGuards() {
  const initial = { seed: 1, deckCodes: [], situationCodes: [], usedCards: [], varietyCode: "test", stageIndex: 0,
    phase: "prepare", handCodes: ["A"], heritageReserveCodes: ["B"], history: [] };
  const start = async (owner, snapshot, heritage) => (await result(heritage
    ? "SELECT rpc_kq_start_run_with_heritage($1,'TEST',1,'{}','{}',$2::jsonb,0,NULL) AS data"
    : "SELECT rpc_kq_start_run($1,'TEST',1,'{}','{}',$2::jsonb,0) AS data", [owner, JSON.stringify(snapshot)])).data.run;
  const act = async (owner, runId, nextState, swap = false) => {
    const current = await result("SELECT updated_at::text AS updated FROM kq_runs WHERE id=$1", [runId]);
    return result(swap
      ? "SELECT rpc_kq_swap_heritage_hand($1,$2,$3::timestamptz,$4::jsonb) AS data"
      : "SELECT rpc_kq_update_run_state($1,$2,$3::timestamptz,'roll',$4::jsonb,NULL) AS data",
    [owner, runId, current.updated, JSON.stringify(nextState)]);
  };
  for (const heritage of [false, true]) {
    const owner = await player({ completed: false });
    await assert.rejects(() => start(owner, initial, heritage), /kq_domiciliation_changed/, "new runs require an authoritative address snapshot");
    await assert.rejects(() => start(owner, { ...initial, domiciliation: "external" }, heritage), /kq_domiciliation_changed/);
    const home = { ...initial, domiciliation: "home" };
    const run = await start(owner, home, heritage);
    assert.equal(run.state.domiciliation, "home");
    for (const swap of [false, true]) {
      await assert.rejects(() => act(owner, run.id, { ...home, domiciliation: "external" }, swap), /kq_invalid_state_transition/);
      await assert.rejects(() => act(owner, run.id, initial, swap), /kq_invalid_state_transition/);
      await act(owner, run.id, home, swap);
    }
    await command(owner, "domiciliation", { mode: "external" });
    await act(owner, run.id, home);
    assert.equal((await result("SELECT state FROM kq_runs WHERE id=$1", [run.id])).state.domiciliation, "home", "changing the account address cannot change an ongoing culture");
    await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [run.id]);
    const external = await start(owner, { ...initial, domiciliation: "external" }, heritage);
    assert.equal(external.state.domiciliation, "external");
    await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [external.id]);

    await db.query("UPDATE kq_commerce_accounts SET domiciliation_paid_until=now()-interval '1 second' WHERE user_id=$1", [owner]);
    await db.query("UPDATE kq_equipment_wallets SET cash_cents=4999 WHERE user_id=$1", [owner]);
    await assert.rejects(() => start(owner, { ...initial, domiciliation: "external" }, heritage), /kq_domiciliation_changed/, "expiry between snapshot and start rejects the stale protection");
    assert.equal(Number((await result("SELECT count(*) AS n FROM kq_runs WHERE user_id=$1 AND status='active'", [owner])).n), 0);
    const fallback = await start(owner, home, heritage);
    assert.equal(fallback.state.domiciliation, "home");
    assert.equal((await state(owner)).business.domiciliation.mode, "home");
  }
  // Historical in-progress runs retain their absent field, preserving their earlier rules.
  const legacyOwner = await player({ completed: false }), legacyId = randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3::jsonb,'active')", [legacyId, legacyOwner, JSON.stringify(initial)]);
  await act(legacyOwner, legacyId, initial);
  await assert.rejects(() => act(legacyOwner, legacyId, { ...initial, domiciliation: "home" }), /kq_invalid_state_transition/);

  const definitions = (await db.query(`SELECT proname,prosrc FROM pg_proc WHERE proname IN
    ('rpc_kq_start_run','rpc_kq_start_run_with_heritage','rpc_kq_update_run_state','rpc_kq_swap_heritage_hand')`)).rows;
  for (const row of definitions) {
    if (row.proname.startsWith("rpc_kq_start_run")) assert(row.prosrc.includes("kq_business_assert_domiciliation"));
    else assert(row.prosrc.includes("p_next_state->'domiciliation' IS DISTINCT FROM v_run.state->'domiciliation'"));
    if (row.proname === "rpc_kq_update_run_state") assert(row.prosrc.indexOf("kq_business_settle") < row.prosrc.indexOf("SELECT * INTO v_run"), "wallet settlement precedes the run row lock");
  }
  for (const role of ["anon", "authenticated"]) {
    const exposed = (await db.query(`SELECT p.proname FROM pg_proc p WHERE p.proname IN
      ('rpc_kq_start_run','rpc_kq_start_run_with_heritage','rpc_kq_update_run_state','rpc_kq_swap_heritage_hand')
      AND has_function_privilege($1,p.oid,'EXECUTE')`, [role])).rows;
    assert.deepEqual(exposed, [], `${role} cannot bypass the authenticated game backend`);
  }
  console.log("PASS: both start entry points enforce current domiciliation; actual update/swap RPCs preserve snapshots, stale expiry is rejected, legacy saves survive, and RPCs remain private.");
}

try {
  await bootstrap();
  const historical = await player();
  const legacy = await historicalSale(historical);
  await db.exec(await migration("20260921000100_kq_business_calendar.sql"));
  ({ quoteKqCommerce } = await vite.ssrLoadModule("/src/lib/kanab-quest-commerce.ts"));
  ({ previewKqBusinessPayment, KQ_ADVERTISING } = await vite.ssrLoadModule("/src/lib/kanab-quest-business.ts"));
  assert.equal((await state(historical)).business !== undefined, true, "migration adds authoritative business snapshot");
  if (process.argv.includes("--guards-only")) {
    await checkRunGuards();
    await checkPermissions();
    console.log("PASS: targeted run guard and permission checks.");
  } else {
  await checkWebsite();
  await checkAdvertising();
  await checkVatAndQuotes();
  await checkLaboratory(historical);
  await checkOtherWalletEntry();
  await checkDomiciliation();
  await checkLegacyRetirement(historical, legacy);
  await checkRunGuards();
  await checkPermissions();
  console.log("PASS: business calendar integration, existing migration composition and private writes.");
  }
} catch (error) {
  console.error(error.stack ?? error.message, error.where ?? "");
  process.exitCode = 1;
} finally {
  await vite.close();
  await db.close();
}
