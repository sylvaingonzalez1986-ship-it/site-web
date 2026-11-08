// Reuse the staff fixture, real treasury, receipt/CAS, harvest evidence and jury
// pipeline. Only storage ageing is held constant, independently tested elsewhere.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { setupStaffDatabase } from "./test-placard-staff.mjs";

const main = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
const db = main ? new PGlite() : null, checks = [];
const query = (sql, values = []) => db.query(sql, values);
const scalar = async (sql, values = []) => Object.values((await query(sql, values)).rows[0])[0];
const migration = name => readFile(path.resolve("supabase/migrations", name), "utf8");
const section = (source, first, last) => {
  const start = source.indexOf(first), end = source.indexOf(last, start + first.length);
  assert(start >= 0 && end > start, `Fixture anchors: ${first}`); return source.slice(start, end);
};
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const rejects = async (name, call, pattern) => { await assert.rejects(call, pattern, name); checks.push(name); };
const read = user => scalar("SELECT rpc_kq_staff_snapshot($1)", [user]);
const baseline = { varietyCode: "HH2026-001", juryScore: 7, aroma: 70, care: { terpenes: 70, cannabinoidExpression: 70, cannabinoidConversion: 0, cannabinoidOxidation: 0 } };
const stats = { appearance: 70, aroma: 60, vigor: 65, mastery: 60, regularity: 70, cannabinoids: 60 };
async function flower(user) {
  const runId = randomUUID(), id = randomUUID();
  await query("INSERT INTO kq_runs(id,user_id,status,state) VALUES($1,$2,'completed',$3::jsonb)", [runId, user,
    JSON.stringify({ harvestTierVersion: 2, quality: 20, history: Array.from({ length: 6 }, () => ({ outcome: "success" })) })]);
  await query("INSERT INTO kq_flowers(id,owner_id,run_id,variety_name,quality,battle_stats) VALUES($1,$2,$3,'Récolte fictive',20,$4::jsonb)", [id, user, runId, JSON.stringify(stats)]);
  // The real AFTER harvest trigger has already created storage. Advance its
  // deadline only in this fixture so the separate trim gate can be exercised.
  assert.equal(await scalar("SELECT count(*) FROM kq_storage_lots WHERE flower_id=$1", [id]), 1);
  await query("UPDATE kq_storage_lots SET state=jsonb_set(jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 second')),'{baseline}',$2::jsonb) WHERE flower_id=$1", [id, JSON.stringify(baseline)]);
  return id;
}
async function perform(user, effects = [], command = { action: "settle" }, debit = 0, key = randomUUID(), override = {}) {
  const current = await read(user);
  const state = { version: 1, employees: [], tasks: [], payroll: [], supplierDiscountPercent: 0, supplierDiscountUntil: null,
    ...(current.state ?? {}), lastSettledAt: current.serverNow, ...override };
  const params = [user, current.revision, key, JSON.stringify(command), JSON.stringify(state), debit, JSON.stringify(effects)];
  const result = await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", params);
  return { result, params };
}
const effect = (flowerId, work, qualityDelta, mode = "manual") => ({ kind: "trim-work", flowerId, work, qualityDelta, mode });
const trim = id => scalar("SELECT (SELECT to_jsonb(t) FROM kq_staff_trim_lots t WHERE flower_id=$1)", [id]);

export async function setupStaffTrimDatabase(db) {
  await setupStaffDatabase(db);
  await db.exec(`
    ALTER TABLE kq_runs ADD COLUMN completed_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE kq_flowers ADD COLUMN owner_id UUID REFERENCES auth.users(id), ADD COLUMN run_id UUID REFERENCES kq_runs(id),
      ADD COLUMN status TEXT NOT NULL DEFAULT 'available',ADD COLUMN quality INTEGER NOT NULL DEFAULT 20,
      ADD COLUMN battle_stats JSONB NOT NULL DEFAULT '{}',ADD COLUMN created_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN variety_code TEXT NOT NULL DEFAULT 'HH2026-001',ADD COLUMN burned_at TIMESTAMPTZ,
      ADD COLUMN harvest_tier_version INTEGER,ADD COLUMN successful_stages INTEGER,ADD COLUMN critical_stages INTEGER;
    CREATE TABLE kq_storage_lots(flower_id UUID PRIMARY KEY REFERENCES kq_flowers(id),user_id UUID,state JSONB,revision BIGINT NOT NULL DEFAULT 1,original_units INTEGER);
    CREATE TABLE kq_storage_accounts(user_id UUID PRIMARY KEY,default_method_code TEXT NOT NULL DEFAULT 'STORAGE-GLASS');
    CREATE TABLE kq_market_lots(flower_id UUID PRIMARY KEY REFERENCES kq_flowers(id),status TEXT NOT NULL DEFAULT 'ready');
    CREATE TABLE kq_market_sale_receipts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),flower_id UUID NOT NULL);
    CREATE TABLE kq_storage_overflow_sales(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),flower_id UUID NOT NULL);
    CREATE TABLE kq_random_battle_queue(flower_id UUID PRIMARY KEY);
    CREATE FUNCTION kq_storage_settle(p_state JSONB,p_now TIMESTAMPTZ) RETURNS JSONB LANGUAGE sql AS $$ SELECT p_state $$;
    CREATE FUNCTION kq_storage_condition(p_state JSONB,p_jury NUMERIC,p_now TIMESTAMPTZ) RETURNS JSONB LANGUAGE sql AS $$ SELECT '{"qualityDelta":0}'::JSONB $$;
    CREATE FUNCTION kq_storage_initialize(p_user UUID) RETURNS VOID LANGUAGE sql AS $$ INSERT INTO kq_storage_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING $$;
    CREATE FUNCTION kq_storage_harvest_units(p_flower UUID) RETURNS INTEGER LANGUAGE sql AS $$ SELECT 60 $$;
    CREATE FUNCTION kq_storage_allocate(p_flower UUID,p_method TEXT DEFAULT NULL,p_repack BOOLEAN DEFAULT false) RETURNS VOID LANGUAGE sql AS $$
      UPDATE kq_storage_lots SET state=state||'{"capacity":{"totalUnits":60,"allocations":[]}}'::JSONB WHERE flower_id=p_flower $$;
  `);
  const storageMigration = await migration("20261010000200_storage_curing.sql");
  await db.exec(section(storageMigration, "CREATE FUNCTION public.kq_storage_create_lot", "CREATE FUNCTION public.kq_storage_after_verdict"));
  const capacity = await migration("20261010000300_storage_capacity.sql");
  await db.exec(section(capacity, "ALTER FUNCTION public.kq_storage_create_lot(UUID)", "CREATE FUNCTION public.kq_storage_sell_overflow"));
  await db.exec(await migration("20261010000700_storage_curing_six_hours.sql"));
  const jury = await migration("20261029000300_kq_curing_before_jury.sql");
  await db.exec(section(jury, "DO $$ DECLARE body TEXT; fragment TEXT; BEGIN", "-- The flower transition is the final database guard"));
  await db.exec(section(jury, "CREATE FUNCTION public.kq_storage_prepare_jury", "-- The verdict already includes"));
  const tiers = await migration("20261018000900_kq_harvest_tiers_v2.sql");
  await db.exec(section(tiers, "CREATE FUNCTION public.kq_guard_flower_harvest_evidence", "-- Preserve the existing mission/commerce evidence"));
}

if (main) try {
  await setupStaffTrimDatabase(db);
  const user = randomUUID(), other = randomUUID();
  for (const id of [user, other]) {
    await query("INSERT INTO auth.users VALUES($1)", [id]);
    await query("INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES($1,500000)", [id]);
  }
  const historical = await flower(user);
  await db.exec(await migration("20261107000200_kq_staff_trim.sql"));
  check("Historical flowers are grandfathered without trim records", await trim(historical), null);
  check("Historical jury keeps its old preparation path", await scalar("SELECT rpc_kq_prepare_flower_jury($1,$2)", [user, historical]), { battleStats: stats });
  const pending = await flower(user), foreign = await flower(other);
  check("New harvest creates six work units automatically", (await trim(pending)).required_work, 6);
  const visible = await read(user);
  check("Staff context lists the actual pending harvest", visible.context.trimLots.map(lot => [lot.flowerId, lot.requiredWork, lot.completedWork, lot.mode]), [[pending, 6, 0, null]]);
  check("Readiness excludes untrimmed harvests and includes a trim count", await scalar("SELECT rpc_kq_jury_readiness($1)", [user]), { availableFlowerCount: 1, curingFlowerCount: 0, trimFlowerCount: 1 });
  await rejects("Bot jury cannot prepare an unfinished trim", () => scalar("SELECT rpc_kq_prepare_flower_jury($1,$2)", [user, pending]), /staff_trim_required/);
  await rejects("Direct flower locking cannot bypass trim", () => query("UPDATE kq_flowers SET status='locked' WHERE id=$1", [pending]), /staff_trim_required/);
  await rejects("Market lot creation cannot bypass trim", () => query("INSERT INTO kq_market_lots(flower_id) VALUES($1)", [pending]), /staff_trim_required/);
  await rejects("Processing cannot bypass trim", () => query("INSERT INTO kq_commerce_batches(flower_id,user_id) VALUES($1,$2)", [pending, user]), /staff_trim_required/);
  await rejects("Sale receipt cannot bypass trim", () => query("INSERT INTO kq_market_sale_receipts(flower_id) VALUES($1)", [pending]), /staff_trim_required/);
  await rejects("Overflow sale cannot bypass trim", () => query("INSERT INTO kq_storage_overflow_sales(flower_id) VALUES($1)", [pending]), /staff_trim_required/);
  await rejects("Another player cannot trim someone else's harvest", () => perform(user, [effect(foreign, 6, 3)]), /staff_trim_unavailable/);
  await rejects("Machine requires an owned trimmer", () => perform(user, [effect(pending, 6, -1, "machine")]), /staff_invalid/);
  await rejects("Wrong-sign manual quality is rejected", () => perform(user, [effect(pending, 6, -1)]), /staff_invalid/);

  const partial = await perform(user, [effect(pending, 5.5, 1)], { action: "trim", flowerId: pending, mode: "manual", employeeId: null, hours: 5.5, expectedCostCents: 0 });
  check("Partial work persists without awarding quality early", [(await trim(pending)).completed_work, (await trim(pending)).completed_at,
    await scalar("SELECT battle_stats FROM kq_flowers WHERE id=$1", [pending])], [5.5, null, stats]);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", partial.params);
  check("Partial task replay cannot add work again", (await trim(pending)).completed_work, 5.5);
  await rejects("Changing trim mode mid-lot is forbidden", () => perform(user, [effect(pending, .5, -2, "machine")], { action: "settle" }, 0, randomUUID(), { trimmerOwned: true }), /staff_trim_changed/);
  const finished = await perform(user, [effect(pending, .5, 3)]);
  const completed = await trim(pending);
  check("Expert finishing half a unit cannot replace the full lot quality", [completed.completed_work, completed.quality_delta, completed.quality_weighted_total], [6, 1, 7]);
  check("Manual trim updates real future jury appearance only", await scalar("SELECT battle_stats FROM kq_flowers WHERE id=$1", [pending]), { ...stats, appearance: 71 });
  check("Harvest audit quality and history evidence stay intact", await scalar("SELECT jsonb_build_array(quality,harvest_tier_version,successful_stages,critical_stages) FROM kq_flowers WHERE id=$1", [pending]), [20, 2, 6, 0]);
  check("Storage baseline is immutable and provenance is separate", await scalar("SELECT state->'baseline' FROM kq_storage_lots WHERE flower_id=$1", [pending]), baseline);
  check("Trim provenance records original and resulting appearance", await scalar("SELECT (state->'trim')-'completedAt' FROM kq_storage_lots WHERE flower_id=$1", [pending]), { mode: "manual", qualityDelta: 1, originalAppearance: 70, appearance: 71 });
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", finished.params);
  check("Completion retry cannot apply quality a second time", await scalar("SELECT battle_stats->'appearance' FROM kq_flowers WHERE id=$1", [pending]), 71);
  check("Production jury preparation uses trimmed appearance", await scalar("SELECT rpc_kq_prepare_flower_jury($1,$2)", [user, pending]), { battleStats: { ...stats, appearance: 71 } });
  await query("UPDATE kq_flowers SET status='locked' WHERE id=$1", [pending]);
  await query("INSERT INTO kq_market_lots(flower_id) VALUES($1)", [pending]);
  checks.push("Completed trim unlocks native jury and commerce guards");

  const purchase = await perform(user, [], { action: "buy-trimmer", expectedCostCents: 150000 }, 150000, randomUUID(), { trimmerOwned: true });
  check("Displayed machine price debits real cash once", purchase.result.cashCents, 350000);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", purchase.params);
  check("Machine purchase retry never charges again", (await read(user)).cashCents, 350000);
  await rejects("Already owned machine cannot be charged twice", () => perform(user, [], { action: "buy-trimmer", expectedCostCents: 150000 }, 150000, randomUUID(), { trimmerOwned: true }), /staff_changed/);
  const machineLot = await flower(user);
  await perform(user, [effect(machineLot, 2, -1, "machine"), effect(machineLot, 100, -3, "machine")]);
  check("Excess machine work is clipped before weighting", [(await trim(machineLot)).completed_work, (await trim(machineLot)).quality_delta], [6, -2]);
  check("Machine damages actual appearance", await scalar("SELECT battle_stats->'appearance' FROM kq_flowers WHERE id=$1", [machineLot]), 68);
  for (const [mode, delta, expected] of [["manual", 3, 75.45], ["machine", -3, 69.45]]) {
    const fractionalLot = await flower(user);
    await query("UPDATE kq_flowers SET battle_stats=jsonb_set(battle_stats,'{appearance}','72.45') WHERE id=$1", [fractionalLot]);
    await perform(user, [effect(fractionalLot, 6, delta, mode)]);
    check(`${mode} trim preserves fractional original appearance`, await scalar("SELECT battle_stats->'appearance' FROM kq_flowers WHERE id=$1", [fractionalLot]), expected);
  }
  await rejects("Out-of-range work is rejected", () => perform(user, [effect(machineLot, 101, -1, "machine")]), /staff_invalid/);
  for (const role of ["anon", "authenticated", "service_role"]) {
    check(`${role} cannot write or read trim tables directly`, await scalar("SELECT has_table_privilege($1,'kq_staff_trim_lots','SELECT,INSERT,UPDATE,DELETE')", [role]), false);
    check(`${role} cannot call internal trim effect helper`, await scalar("SELECT has_function_privilege($1,'kq_staff_apply_trim(uuid,jsonb,jsonb)','EXECUTE')", [role]), false);
  }
  console.log(`Personnel TRIM SQL: ${checks.length} checks passed (isolated PGlite).`);
} catch (error) {
  console.error(`Personnel TRIM SQL failed after ${checks.length} checks: ${error.message}`);
  if (error.where) console.error(error.where);
  if (error.position) console.error(`SQL position: ${error.position}`);
  if (error.actual !== undefined) console.error({ actual: error.actual, expected: error.expected });
  process.exitCode = 1;
} finally { await db.close(); }
