// Local PostgreSQL integration checks. No credentials or remote writes.
// As in the social fixture, PGlite tests CAS/replay on one connection, not
// multi-connection lock contention. Accounting/social/care code is production SQL.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const main = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
const db = main ? new PGlite() : null;
const query = (sql, values = []) => db.query(sql, values);
const scalar = async (sql, values = []) => Object.values((await query(sql, values)).rows[0])[0];
const migration = name => readFile(path.resolve("supabase/migrations", name), "utf8");
const checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const rejects = async (name, call, pattern) => { await assert.rejects(call, pattern, name); checks.push(name); };
const section = (source, start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, `Fixture anchors: ${start}`);
  return source.slice(first, last);
};
const read = user => scalar("SELECT rpc_kq_staff_snapshot($1)", [user]);
const receipt = (user, key, command) => scalar("SELECT rpc_kq_staff_receipt($1,$2,$3::jsonb)", [user, key, JSON.stringify(command)]);
const commit = (user, revision, key, command, state, debit = 0, effects = []) => scalar(
  "SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)",
  [user, revision, key, JSON.stringify(command), JSON.stringify(state), debit, JSON.stringify(effects)]);
const empty = now => ({ version: 1, employees: [], tasks: [], payroll: [], lastSettledAt: now,
  supplierDiscountPercent: 0, supplierDiscountUntil: null });
const stored = user => scalar(`SELECT jsonb_build_object(
 'staff',(SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1),
 'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
 'social',(SELECT to_jsonb(a) FROM kq_social_accounts a WHERE user_id=$1),
 'online',(SELECT to_jsonb(a) FROM kq_online_accounts a WHERE user_id=$1),
 'receipts',(SELECT count(*) FROM kq_staff_receipts WHERE user_id=$1),
 'journal',(SELECT count(*) FROM kq_treasury_journal WHERE user_id=$1),
 'settlements',(SELECT count(*) FROM test_settlement_observations WHERE user_id=$1))`, [user]);
async function rejectUnchanged(name, user, call, pattern) {
  const before = await stored(user);
  await rejects(name, call, pattern);
  check(`${name}: transaction rolled back`, await stored(user), before);
}

export async function setupStaffDatabase(db) {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),
      reputation INTEGER NOT NULL DEFAULT 0,cash_cents INTEGER NOT NULL DEFAULT 100000 CHECK(cash_cents>=0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE public.kq_runs(id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES auth.users(id),status TEXT NOT NULL DEFAULT 'active',
      state JSONB NOT NULL,started_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),campaign_id UUID);
    CREATE TABLE public.kq_flowers(id UUID PRIMARY KEY,variety_name TEXT);
    CREATE TABLE public.kq_commerce_batches(flower_id UUID PRIMARY KEY REFERENCES kq_flowers(id),user_id UUID NOT NULL,
      processing_started_at TIMESTAMPTZ,processing_ready_at TIMESTAMPTZ,processing_equipment_codes TEXT[]);
    CREATE TABLE public.kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision BIGINT NOT NULL DEFAULT 0,
      computer_owned BOOLEAN DEFAULT false,internet_renew BOOLEAN DEFAULT false,shop_partners INTEGER DEFAULT 0 CHECK(shop_partners BETWEEN 0 AND 20),
      current_run_id UUID,business_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),shop_created_at TIMESTAMPTZ,shop_paid_until TIMESTAMPTZ,
      shop_suspended BOOLEAN DEFAULT false);
    CREATE TABLE public.kq_commerce_campaigns(run_id UUID PRIMARY KEY,user_id UUID,shop_partners_start INTEGER NOT NULL DEFAULT 0,
      revision BIGINT NOT NULL DEFAULT 0,internet_paid BOOLEAN DEFAULT false);
    CREATE TABLE public.kq_online_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),followers INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 0,site_tier TEXT DEFAULT 'basic');
    CREATE TABLE public.kq_lab_invoices(id UUID PRIMARY KEY,remaining_cents INTEGER);
    CREATE TABLE public.kq_business_ledger(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,kind TEXT,
      amount_cents BIGINT,occurred_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.test_settlement_observations(user_id UUID,followers INTEGER);
    CREATE FUNCTION public.kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
      INSERT INTO kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      INSERT INTO kq_online_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      INSERT INTO test_settlement_observations SELECT p_user,followers FROM kq_online_accounts WHERE user_id=p_user;
    END $$;
  `);
  const treasury = await migration("20260921000200_kq_treasury_accounting.sql");
  await db.exec(section(treasury, "CREATE TABLE public.kq_treasury_accounts", "-- Actual production cost only.")
    .replace("'lab_payable','energy_payable'", "'lab_payable','supplier_payable','energy_payable'"));
  await db.exec(`
    CREATE FUNCTION public.kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE cash INTEGER; BEGIN
      SELECT cash_cents INTO cash FROM kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
      INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      IF FOUND THEN PERFORM kq_treasury_pair(p_user,'opening','opening',now(),'cash','opening_equity',cash,'Fixture opening'); END IF;
    END $$;
    CREATE FUNCTION public.fixture_wallet_movement() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
      IF NEW.cash_cents<>OLD.cash_cents AND EXISTS(SELECT 1 FROM kq_treasury_accounts WHERE user_id=NEW.user_id) THEN
        PERFORM kq_treasury_pair(NEW.user_id,'cash-movement','cash:'||gen_random_uuid(),now(),'cash','suspense',NEW.cash_cents::BIGINT-OLD.cash_cents,'Fixture wallet');
      END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_wallet_movement AFTER UPDATE ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION fixture_wallet_movement();
  `);
  await db.exec(await migration("20261022000100_kq_social_adventure.sql"));
  await db.exec(await migration("20261023000100_kq_social_sponsors.sql"));
  await db.exec(await migration("20261010000600_kq_care_explicit_problems.sql"));
  const suppliers = await migration("20261012000700_kq_warehouse_supplier_invoices.sql");
  await db.exec(section(suppliers, "CREATE TABLE public.kq_supplier_invoices", "ALTER TABLE public.kq_market_sale_receipts"));
  await db.exec(section(suppliers, "CREATE FUNCTION public.kq_supplier_invoice_accounting", "SELECT pg_temp.kq_supplier_patch('public.kq_validate_warehouse_run_start"));
  const calendar = await migration("20260921000100_kq_business_calendar.sql");
  await db.exec(section(calendar, "CREATE FUNCTION public.kq_business_command", "CREATE OR REPLACE FUNCTION public.kq_commerce_demand_snapshot"));
  // Apply the exact production supplier patches to the real business command.
  await db.exec(section(suppliers, "CREATE FUNCTION pg_temp.kq_supplier_patch", "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_post"));
  await db.exec(section(suppliers, "SELECT pg_temp.kq_supplier_patch('public.kq_business_command", "SELECT pg_temp.kq_supplier_patch('public.rpc_kq_commerce_command"));
  const campaign = await migration("20261013000200_kq_shared_campaigns.sql");
  await db.exec(section(campaign, "CREATE FUNCTION public.kq_campaign_project_state", "CREATE FUNCTION public.kq_campaign_run_identity"));
  await db.exec(section(campaign, "CREATE FUNCTION public.kq_campaign_sync_state", "-- These effects belong"));
  const warehouse = await migration("20261012000200_kq_warehouse_run_integration.sql");
  await db.exec(section(warehouse, "CREATE FUNCTION public.kq_guard_warehouse_run_snapshot", "DO $$ DECLARE body TEXT"));
  const tiers = await migration("20261018000900_kq_harvest_tiers_v2.sql");
  await db.exec(section(tiers, "CREATE FUNCTION public.kq_guard_harvest_tier_run", "-- Heritage/rarity starters"));
  await db.exec(await migration("20261107000100_kq_staff.sql"));
}

if (main) try {
  await setupStaffDatabase(db);
  checks.push("Migration composes with production accounting, suppliers, social and run guards");

  const user = randomUUID(), other = randomUUID(), missing = randomUUID();
  for (const id of [user, other]) {
    await query("INSERT INTO auth.users VALUES($1)", [id]);
    await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [id]);
  }
  await rejects("Unknown player cannot create staff data", () => read(missing), /staff_profile/);
  const initial = await read(user);
  check("New account has null state and revision zero", [initial.state, initial.revision, initial.cashCents], [null, 0, 100000]);
  check("Empty context has actual empty resources", [initial.context.activeRuns, initial.context.processingBatches, initial.context.supplierInvoices], [[], [], []]);
  check("Business clock comes from the business account", initial.context.businessStartedAt,
    await scalar("SELECT to_jsonb(business_started_at) FROM kq_commerce_accounts WHERE user_id=$1", [user]));
  const request = randomUUID(), state = empty(initial.serverNow), command = { action: "payroll", expectedCents: 2000 };
  const initialStore = await stored(user);
  check("Unknown preflight receipt returns null", await receipt(user, request, command), null);
  check("Missing preflight receipt has no side effects", await stored(user), initialStore);
  const paid = await commit(user, 0, request, command, state, 2000);
  check("Staff charge and revision commit together", [paid.cashCents, paid.revision], [98000, 1]);
  const paidStore = await stored(user);
  const preflight = await receipt(user, request, command);
  check("Existing receipt preflight returns current state before eligibility", [preflight.replayed, preflight.revision, preflight.cashCents], [true, 1, 98000]);
  check("Receipt belongs exclusively to its player", await receipt(other, request, command), null);
  await rejectUnchanged("Preflight rejects request key reused for a different command", user,
    () => receipt(user, request, { action: "settle" }), /staff_request_mismatch/);
  check("Exact replay ignores obsolete CAS without another charge", (await commit(user, 0, request, command, state, 2000)).replayed, true);
  check("Replay has no database writes", await stored(user), paidStore);
  await rejectUnchanged("Reused key with changed command fails before CAS", user,
    () => commit(user, 0, request, { action: "settle" }, state), /staff_request_mismatch/);
  await rejectUnchanged("Stale worker cannot overwrite another commit", user,
    () => commit(user, 0, randomUUID(), { action: "settle" }, state), /staff_changed/);
  await rejectUnchanged("Insufficient cash never consumes the receipt", user,
    () => commit(user, 1, randomUUID(), command, state, 200000), /staff_cash/);
  await rejectUnchanged("Browser future clock cannot advance the ledger", user,
    () => commit(user, 1, randomUUID(), { action: "settle" }, { ...state, lastSettledAt: "2099-01-01T00:00:00.000Z" }), /staff_invalid/);
  check("Expense is booked once and cash has no duplicate movement", await scalar(`SELECT jsonb_object_agg(account,balance_cents)
    FROM kq_treasury_balances WHERE user_id=$1`, [user]), { cash: 98000, opening_equity: -100000, expense_other: 2000, suspense: 0 });

  const runId = randomUUID(), satellite = randomUUID(), campaignId = randomUUID(), foreignRun = randomUUID();
  const care = { version: 1, vitality: 98, terpenes: 98, cannabinoidExpression: 97, cannabinoidConversion: 5,
    cannabinoidOxidation: 0, yieldBonusPercent: 9, yieldLossPercent: 3, problems: [], interventions: [], applications: [], history: [] };
  const culture = { rulesVersion: 3, phase: "prepare", varietyName: "Simulation", history: [], care,
    campaign: { leaderRunId: runId }, warehouse: { qualityBonus: 0, consumablesCostCents: 0 }, quality: 10 };
  for (const [id, owner, cid] of [[runId, user, campaignId], [satellite, user, campaignId], [foreignRun, other, null]]) {
    await query("INSERT INTO kq_runs(id,user_id,state,campaign_id) VALUES($1,$2,$3::jsonb,$4)", [id, owner, JSON.stringify(culture), cid]);
  }
  await query("UPDATE kq_commerce_accounts SET current_run_id=$2,shop_partners=3 WHERE user_id=$1", [user, runId]);
  await query("INSERT INTO kq_commerce_campaigns(run_id,user_id,shop_partners_start) VALUES($1,$2,3)", [runId, user]);
  const activeFlower = randomUUID(), queuedFlower = randomUUID();
  for (const id of [activeFlower, queuedFlower]) await query("INSERT INTO kq_flowers VALUES($1,'Lot fictif')", [id]);
  await query(`INSERT INTO kq_commerce_batches VALUES($1,$2,now()-interval '1 hour',now()+interval '1 hour',ARRAY['PRESS']),
    ($3,$2,now()+interval '1 hour',now()+interval '2 hours',ARRAY['PRESS'])`, [activeFlower, user, queuedFlower]);
  const queueBefore = await scalar("SELECT to_jsonb(b) FROM kq_commerce_batches b WHERE flower_id=$1", [queuedFlower]);
  const readyBefore = await scalar("SELECT extract(epoch FROM processing_ready_at)::double precision FROM kq_commerce_batches WHERE flower_id=$1", [activeFlower]);
  await scalar("SELECT rpc_kq_social_v2_read($1,NULL)", [user]);
  await query("UPDATE kq_social_platforms SET followers=100 WHERE user_id=$1 AND platform='instagram'", [user]);
  await query("UPDATE kq_online_accounts SET followers=180 WHERE user_id=$1", [user]);
  await query(`UPDATE kq_social_accounts SET game_state=jsonb_build_object('version',2,'revision',revision,
    'platforms',jsonb_build_object('instagram',jsonb_build_object('followers',100),'x',jsonb_build_object('followers',0)),
    'audienceFollowers',180,'socialFollowers',100) WHERE user_id=$1`, [user]);
  const context = await read(user);
  check("Context lists only shared campaign leader", context.context.activeRuns.map(run => run.id), [runId]);
  check("Context omits future machine reservations", context.context.processingBatches.map(batch => batch.flowerId), [activeFlower]);
  const effects = [
    { kind: "culture", runId, vitalityDelta: 5, terpenesDelta: 3, yieldBonusDelta: 2, cannabinoidDelta: 4 },
    { kind: "culture", runId: foreignRun, vitalityDelta: 5, terpenesDelta: 3, yieldBonusDelta: 2, cannabinoidDelta: 4 },
    { kind: "processing", flowerId: activeFlower, secondsSaved: 900 },
    { kind: "processing", flowerId: queuedFlower, secondsSaved: 900 },
    { kind: "communication", instagramFollowers: 40, reputation: 2 },
    { kind: "sales", shopPartners: 1, reputation: 3 },
  ];
  const rewarded = await commit(user, 1, randomUUID(), { action: "settle" }, empty(context.serverNow), 0, effects);
  check("Followers, reputation and shop partners use real data", [rewarded.context.instagramFollowers, rewarded.context.reputation, rewarded.context.shopPartners], [140, 5, 4]);
  check("Staff rewards settle OLD sales audience first", await scalar("SELECT max(followers) FROM test_settlement_observations WHERE user_id=$1", [user]), 180);
  const actualCare = await scalar("SELECT state->'care' FROM kq_runs WHERE id=$1", [runId]);
  check("Culture bonuses stay bounded without erasing prior damage", [actualCare.vitality, actualCare.terpenes, actualCare.yieldBonusPercent, actualCare.cannabinoidExpression, actualCare.yieldLossPercent], [100, 99, 10, 99, 3]);
  check("Production campaign trigger propagates care", await scalar("SELECT state->'care' FROM kq_runs WHERE id=$1", [satellite]), actualCare);
  check("Another player's culture is untouched", await scalar("SELECT state->'care' FROM kq_runs WHERE id=$1", [foreignRun]), care);
  check("Only active processing is accelerated", await scalar("SELECT extract(epoch FROM processing_ready_at)::double precision FROM kq_commerce_batches WHERE flower_id=$1", [activeFlower]), readyBefore - 900);
  check("Future shared-machine reservation is intact", await scalar("SELECT to_jsonb(b) FROM kq_commerce_batches b WHERE flower_id=$1", [queuedFlower]), queueBefore);
  check("Sales baseline retains partnerships for subsequent sales", await scalar("SELECT shop_partners_start FROM kq_commerce_campaigns WHERE run_id=$1", [runId]), 4);
  check("Social V2 matches source tables and keeps marketing audience", await scalar(`SELECT jsonb_build_array(
    (game_state->'platforms'->'instagram'->>'followers')::INTEGER,(game_state->>'socialFollowers')::INTEGER,
    (game_state->>'audienceFollowers')::INTEGER,revision,(game_state->>'revision')::INTEGER) FROM kq_social_accounts WHERE user_id=$1`, [user]), [140, 140, 220, 1, 1]);
  await rejectUnchanged("An invalid effect rolls back its earlier debit", user,
    () => commit(user, 2, randomUUID(), { action: "settle" }, empty(rewarded.serverNow), 100,
      [{ kind: "communication", instagramFollowers: 999999, reputation: 1 }]), /staff_invalid/);

  const discountedState = { ...empty(rewarded.serverNow), supplierDiscountPercent: 10,
    supplierDiscountUntil: new Date(Date.parse(rewarded.serverNow) + 3600000).toISOString() };
  await commit(user, 2, randomUUID(), { action: "settle" }, discountedState);
  const invoiceRun = randomUUID();
  await query("INSERT INTO kq_runs(id,user_id,state) VALUES($1,$2,$3::jsonb)", [invoiceRun, user,
    JSON.stringify({ rulesVersion: 3, phase: "prepare", history: [], warehouse: { consumablesCostCents: 1000 } })]);
  const invoice = (await query("SELECT id,amount_cents,remaining_cents FROM kq_supplier_invoices WHERE run_id=$1", [invoiceRun])).rows[0];
  check("Administrative negotiation discounts new invoices only", [invoice.amount_cents, invoice.remaining_cents], [900, 900]);
  check("Business journal uses actual discounted amount", await scalar("SELECT amount_cents FROM kq_business_ledger WHERE user_id=$1 AND kind='supplier-issued'", [user]), 900);
  check("Supplier accounting sees discounted amount before posting", await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='supplier_payable'", [user]), -900);
  const invoiceCommand = { action: "pay-invoice", employeeId: randomUUID(), invoiceId: invoice.id, expectedCents: 900 };
  const invoiceRequest = randomUUID(), invoiceEffect = [{ kind: "supplier-payment", invoiceId: invoice.id, amountCents: 900 }];
  const invoicePaid = await commit(user, 3, invoiceRequest, invoiceCommand, discountedState, 0, invoiceEffect);
  check("Native supplier payment debits exactly the displayed amount", invoicePaid.cashCents, 97100);
  check("Supplier paid via existing debt settlement", await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [invoice.id]), 0);
  check("Payable and suspense clear without a duplicate expense", await scalar(`SELECT jsonb_object_agg(account,balance_cents)
    FROM kq_treasury_balances WHERE user_id=$1`, [user]), { cash: 97100, opening_equity: -100000, expense_other: 2900, suspense: 0, supplier_payable: 0 });
  await commit(user, 3, invoiceRequest, invoiceCommand, discountedState, 0, invoiceEffect);
  check("Supplier retry cannot double-pay", (await read(user)).cashCents, 97100);
  await rejectUnchanged("Wrong supplier expected amount fails atomically", user,
    () => commit(user, 4, randomUUID(), invoiceCommand, discountedState, 200, invoiceEffect), /staff_changed/);

  // The server engine owns eligibility; SQL persists both new command variants
  // and lets exact retries bypass eligibility after their state has changed.
  const leaveInitial = await read(other), leaveId = randomUUID(), employeeId = randomUUID();
  const leaveCommand = { action: "leave", employeeId, startDay: 8, endDay: 9 }, leaveKey = randomUUID();
  const leaveState = { ...empty(leaveInitial.serverNow), employees: [{ id: employeeId, leave: [{ id: leaveId, startDay: 8, endDay: 9, days: 2 }] }] };
  const leaveBooked = await commit(other, 0, leaveKey, leaveCommand, leaveState);
  check("Leave command persists its server-calculated dates", leaveBooked.state.employees[0].leave, leaveState.employees[0].leave);
  check("Leave retry is available before overlap validation", (await receipt(other, leaveKey, leaveCommand)).replayed, true);
  const cancelCommand = { action: "cancel-leave", employeeId, leaveId }, cancelKey = randomUUID();
  const cancelState = { ...leaveState, employees: [{ id: employeeId, leave: [] }] };
  const leaveCancelled = await commit(other, 1, cancelKey, cancelCommand, cancelState);
  check("Cancel-leave persists the removal", leaveCancelled.state.employees[0].leave, []);
  check("Cancel-leave retry is available after leave no longer exists", (await receipt(other, cancelKey, cancelCommand)).replayed, true);
  check("Old leave receipt returns latest account state", (await receipt(other, leaveKey, leaveCommand)).state.employees[0].leave, []);

  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["kq_staff_accounts", "kq_staff_receipts"]) {
      check(`${role} has no direct ${table} access`, await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')", [role, table]), false);
    }
    check(`${role} snapshot RPC grant`, await scalar("SELECT has_function_privilege($1,'rpc_kq_staff_snapshot(uuid)','EXECUTE')", [role]), role === "service_role");
    check(`${role} commit RPC grant`, await scalar("SELECT has_function_privilege($1,'rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)','EXECUTE')", [role]), role === "service_role");
    check(`${role} receipt RPC grant`, await scalar("SELECT has_function_privilege($1,'rpc_kq_staff_receipt(uuid,uuid,jsonb)','EXECUTE')", [role]), role === "service_role");
  }
  console.log(`Personnel SQL: ${checks.length} checks passed (isolated PGlite).`);
} catch (error) {
  console.error(`Personnel SQL failed after ${checks.length} checks: ${error.message}`);
  if (error.where) console.error(error.where);
  if (error.position) console.error(`SQL position: ${error.position}`);
  if (error.actual !== undefined) console.error({ actual: error.actual, expected: error.expected });
  process.exitCode = 1;
} finally {
  await db.close();
}
