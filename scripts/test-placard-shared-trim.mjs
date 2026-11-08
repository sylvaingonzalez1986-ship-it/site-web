// Exact production trim/harvest/jury SQL with the existing local staff fixture.
// Shared trim adds real mass while preserving accounting, workday and archive
// guards. Storage ageing/allocation and unrelated businesses are explicit empty
// boundaries. PGlite checks transactional replay/CAS, not connection contention.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";
import { setupStaffTrimDatabase } from "./test-placard-staff-trim.mjs";

const db = new PGlite(), checks = [];
let vite;
const query = (sql, values = []) => db.query(sql, values);
const scalar = async (sql, values = []) => Object.values((await query(sql, values)).rows[0])[0];
const migration = name => readFile(path.resolve("supabase/migrations", name), "utf8");
const section = (source, first, last) => {
  const start = source.indexOf(first), end = source.indexOf(last, start + first.length);
  assert(start >= 0 && end > start, `Fixture anchors: ${first}`); return source.slice(start, end);
};
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const rejects = async (name, action, pattern) => { await assert.rejects(action, pattern, name); checks.push(name); };
const read = user => scalar("SELECT rpc_kq_staff_snapshot($1)", [user]);
const trim = id => scalar("SELECT to_jsonb(t) FROM kq_staff_trim_lots t WHERE flower_id=$1", [id]);
const stats = { appearance: 70.45, aroma: 60, vigor: 65, mastery: 60, regularity: 70, cannabinoids: 60 };
const gramEffect = (flowerId, work, qualityDelta = 1, mode = "manual") => ({ kind: "trim-work", flowerId, work, qualityDelta, mode, unit: "g" });
const oldEffect = (flowerId, work, qualityDelta = 1, mode = "manual") => ({ kind: "trim-work", flowerId, work, qualityDelta, mode });
const stored = user => scalar(`SELECT jsonb_build_object(
 'staff',(SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1),
 'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
 'trim',(SELECT jsonb_agg(to_jsonb(t) ORDER BY flower_id) FROM kq_staff_trim_lots t WHERE user_id=$1),
 'storage',(SELECT jsonb_agg(to_jsonb(s) ORDER BY flower_id) FROM kq_storage_lots s WHERE user_id=$1),
 'flowers',(SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM kq_flowers f WHERE owner_id=$1),
 'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_staff_receipts r WHERE user_id=$1),
 'archive',(SELECT jsonb_agg(to_jsonb(h) ORDER BY kind,record_id) FROM kq_staff_archive h WHERE user_id=$1))`, [user]);
async function rejectUnchanged(name, user, action, pattern) {
  const before = await stored(user);
  await rejects(name, action, pattern);
  check(`${name}: transaction rolled back`, await stored(user), before);
}
async function perform(user, effects = [], override = {}, command = { action: "settle" }) {
  const current = await read(user);
  const next = { version: 1, employees: [], tasks: [], payroll: [], playerWorkDays: {}, supplierDiscountPercent: 0,
    supplierDiscountUntil: null, ...(current.state ?? {}), lastSettledAt: current.serverNow, ...override };
  const params = [user, current.revision, randomUUID(), JSON.stringify(command), JSON.stringify(next), 0, JSON.stringify(effects)];
  return { result: await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", params), params };
}
async function flower(user, grams) {
  const run = randomUUID(), id = randomUUID();
  await query("INSERT INTO kq_runs(id,user_id,status,state) VALUES($1,$2,'completed',$3::jsonb)", [run, user, JSON.stringify({
    harvestTierVersion: 2, harvestGrams: grams, quality: 20, history: Array.from({ length: 6 }, () => ({ outcome: "success" })) })]);
  await query("INSERT INTO kq_flowers(id,owner_id,run_id,variety_name,quality,battle_stats) VALUES($1,$2,$3,'Shared trim fixture',20,$4::jsonb)", [id, user, run, JSON.stringify(stats)]);
  // Only curing is advanced; the real jury/trim guards remain installed.
  await query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 second')) WHERE flower_id=$1", [id]);
  return id;
}

try {
  await setupStaffTrimDatabase(db);
  // Replace the old fixture's fixed quantity with the exact production source.
  await db.exec("ALTER TABLE kq_market_lots ADD COLUMN harvest_grams NUMERIC; DROP FUNCTION kq_storage_harvest_units(UUID);");
  const capacity = await migration("20261010000300_storage_capacity.sql");
  await db.exec(section(capacity, "CREATE FUNCTION public.kq_storage_harvest_units", "ALTER FUNCTION public.kq_storage_create_lot(UUID)"));
  const user = randomUUID(), other = randomUUID();
  for (const id of [user, other]) {
    await query("INSERT INTO auth.users VALUES($1)", [id]);
    await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [id]);
  }
  const grandfathered = await flower(user, 150);
  await db.exec(await migration("20261107000200_kq_staff_trim.sql"));
  await db.exec(`CREATE TABLE test_trim_allocation_observations(flower_id UUID,trim_exists BOOLEAN,trim_grams NUMERIC);
    CREATE OR REPLACE FUNCTION kq_storage_allocate(p_flower UUID,p_method TEXT DEFAULT NULL,p_repack BOOLEAN DEFAULT false)
    RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO test_trim_allocation_observations SELECT p_flower,
       EXISTS(SELECT 1 FROM kq_staff_trim_lots WHERE flower_id=p_flower),
       (SELECT (to_jsonb(t)->>'total_grams')::NUMERIC FROM kq_staff_trim_lots t WHERE flower_id=p_flower);
      UPDATE kq_storage_lots SET state=state||jsonb_build_object('capacity',jsonb_build_object('totalUnits',original_units,'allocations','[]'::JSONB)) WHERE flower_id=p_flower;
    END $$;`);
  const partial = await flower(user, 600), completed = await flower(user, 120), empty = await flower(user, 0);
  const stockAuthoritative = await flower(user, 900);
  await query("UPDATE kq_storage_lots SET original_units=4300 WHERE flower_id=$1", [stockAuthoritative]);
  await perform(user, [oldEffect(partial, 2), oldEffect(completed, 6, 3)]);
  const at = (await read(user)).serverNow, runningTask = { id: "legacy-trim", employeeId: "player", kind: "trim", skill: "processing",
    skillLevel: 1, hours: 1, day: 1, startedAt: at, completesAt: at, status: "running", trainingCostCents: 0,
    targetId: partial, trimMode: "manual", trimWork: 4, trimQualityDelta: 3 };
  await perform(user, [], { tasks: [runningTask], playerWorkDays: { 1: { usedHours: 1 } } });

  // Real accounting and workday validation; no unrelated business activity.
  await db.exec(`ALTER TABLE kq_commerce_accounts ADD COLUMN vat_reserved_cents INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE kq_lab_invoices ADD COLUMN user_id UUID;
    CREATE TABLE kq_energy_invoices(user_id UUID,remaining_cents INTEGER);
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);
    CREATE TABLE arena_chanvrier_savings_deposits(user_id UUID,balance_cents BIGINT);
    CREATE TABLE kq_bank_loans(user_id UUID,total_cents BIGINT,paid_cents BIGINT);
    CREATE TABLE kq_crypto_positions(user_id UUID,cost_basis_cents BIGINT);
    CREATE TABLE kq_stock_positions(user_id UUID,cost_basis_cents BIGINT);
    CREATE FUNCTION kq_treasury_refresh(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;`);
  const stock = await migration("20260923000800_kq_stock_market.sql");
  await db.exec(section(stock, "CREATE OR REPLACE FUNCTION public.kq_treasury_balances_at", "REVOKE ALL ON FUNCTION public.kq_treasury_balances_at"));
  const supplier = await migration("20261012000700_kq_warehouse_supplier_invoices.sql");
  await db.exec(section(supplier, "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_balances_at", "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_stock_cost"));
  await db.exec(await migration("20261107000300_kq_staff_accounting.sql"));
  const workday = await migration("20261107000500_kq_player_workday.sql");
  await db.exec(section(workday, "CREATE FUNCTION public.kq_player_work_day", "-- Capture the exact current signatures/defaults"));
  await db.exec(await migration("20261107000600_kq_staff_archive.sql"));
  const oldCompleted = await trim(completed), oldStorage = await scalar("SELECT to_jsonb(s) FROM kq_storage_lots s WHERE flower_id=$1", [completed]);
  const receipts = await scalar("SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_staff_receipts r WHERE user_id=$1", [user]);
  const oldState = await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [user]);
  const commitDefinition = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  await db.exec(await migration("20261108000100_kq_shared_trim.sql"));
  check("Migration preserves current commit accounting, CAS, trim and player-work guards", await scalar(
    "SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)"), commitDefinition);
  check("Upgrade preserves launched tasks, charged hours and staff revision", await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [user]), oldState);
  check("Upgrade leaves immutable receipt bytes unchanged", await scalar("SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_staff_receipts r WHERE user_id=$1", [user]), receipts);
  check("Grandfathered flowers still have no trim obligation", await scalar("SELECT count(*) FROM kq_staff_trim_lots WHERE flower_id=$1", [grandfathered]), 0);
  const migrated = await trim(partial);
  check("Legacy progress and quality translate proportionally to real harvest mass", [migrated.total_grams, migrated.completed_grams, migrated.quality_gram_weighted_total,
    migrated.required_work, migrated.completed_work, migrated.quality_weighted_total], [600, 200, 200, 6, 2, 2]);
  check("Existing stored mass wins over later run metadata", (await trim(stockAuthoritative)).total_grams, 430);
  const done = await trim(completed);
  check("Already finished trim gains mass evidence without replaying quality or its timestamp", [done.total_grams, done.completed_grams, done.quality_gram_weighted_total, done.completed_at, done.quality_delta], [120, 120, 360, oldCompleted.completed_at, 3]);
  check("Upgrade never rewrites existing storage provenance", await scalar("SELECT to_jsonb(s) FROM kq_storage_lots s WHERE flower_id=$1", [completed]), oldStorage);
  check("True zero mass completes without a quality bonus", [(await trim(empty)).completed_work, (await trim(empty)).total_grams,
    (await trim(empty)).completed_grams, (await trim(empty)).completed_at !== null, await scalar("SELECT battle_stats FROM kq_flowers WHERE id=$1", [empty])], [6, 0, 0, true, stats]);
  const snapshot = await read(user);
  check("Snapshot wrapper retains archives and announces shared gram support", [snapshot.archiveCount, snapshot.context.trimQueueVersion], [0, 2]);
  const visible = snapshot.context.trimLots.find(row => row.flowerId === partial);
  check("Trim snapshot exposes actual grams and deterministic queue creation time", [visible.totalGrams, visible.completedGrams, visible.createdAt], [600, 200, migrated.created_at]);

  const fresh = await flower(user, 371.25);
  check("New harvest mass uses the same stock-unit rounding as storage", [(await trim(fresh)).total_grams,
    Number(await scalar("SELECT original_units::NUMERIC/10 FROM kq_storage_lots WHERE flower_id=$1", [fresh]))], [371.3, 371.3]);
  check("Early trim record exists with true mass before storage allocation runs", await scalar(
    "SELECT jsonb_build_array(trim_exists,trim_grams) FROM test_trim_allocation_observations WHERE flower_id=$1", [fresh]), [true, 371.3]);
  const freshEmpty = await flower(user, 0);
  check("New zero harvest is already complete without fabricated work or appearance", [(await trim(freshEmpty)).completed_at !== null,
    (await trim(freshEmpty)).completed_grams, await scalar("SELECT battle_stats FROM kq_flowers WHERE id=$1", [freshEmpty])], [true, 0, stats]);
  const foreign = await flower(other, 500);
  await rejectUnchanged("Another owner's grams cannot be credited", user, () => perform(user, [gramEffect(foreign, 1)]), /staff_trim_unavailable/);
  await rejects("Jury remains blocked until all true grams are completed", () => scalar("SELECT rpc_kq_prepare_flower_jury($1,$2)", [user, fresh]), /staff_trim_required/);
  for (const [name, sql] of [
    ["flower", "UPDATE kq_flowers SET status='locked' WHERE id=$1"],
    ["market", "INSERT INTO kq_market_lots(flower_id) VALUES($1)"],
    ["sale receipt", "INSERT INTO kq_market_sale_receipts(flower_id) VALUES($1)"],
    ["overflow sale", "INSERT INTO kq_storage_overflow_sales(flower_id) VALUES($1)"],
  ]) await rejects(`Native ${name} guard still blocks unfinished trim`, () => query(sql, [fresh]), /staff_trim_required/);

  const first = await perform(user, [gramEffect(fresh, 100.123456), gramEffect(fresh, 50.654321, 3)]);
  check("Concurrent contributions accumulate micrograms and their own quality weights", [(await trim(fresh)).completed_grams,
    (await trim(fresh)).quality_gram_weighted_total, (await trim(fresh)).completed_at], [150.777777, 252.086419, null]);
  check("Partial gram effects do not change appearance", await scalar("SELECT battle_stats FROM kq_flowers WHERE id=$1", [fresh]), stats);
  const firstPersisted = await stored(user);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", first.params);
  check("Exact partial replay does not credit the contributors twice", await stored(user), firstPersisted);
  const stale = [...first.params]; stale[2] = randomUUID();
  await rejectUnchanged("Stale CAS rolls back gram credits", user,
    () => scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", stale), /staff_changed/);
  await rejectUnchanged("Mode cannot change halfway through shared trim", user,
    () => perform(user, [gramEffect(fresh, 1, -1, "machine")], { trimmerOwned: true }), /staff_trim_changed/);
  const final = await perform(user, [gramEffect(fresh, 7200, 3)]);
  check("Finishing clips excess grams before weighting", [(await trim(fresh)).completed_grams, (await trim(fresh)).quality_gram_weighted_total,
    (await trim(fresh)).completed_work, (await trim(fresh)).quality_delta], [371.3, 913.653088, 6, 2]);
  check("Shared completion applies the rounded weighted quality exactly once", await scalar("SELECT battle_stats->'appearance' FROM kq_flowers WHERE id=$1", [fresh]), 72.45);
  const finalEvidence = await scalar("SELECT jsonb_build_array(battle_stats,(SELECT state->'trim' FROM kq_storage_lots WHERE flower_id=$1)) FROM kq_flowers WHERE id=$1", [fresh]);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", final.params);
  await perform(user, [gramEffect(fresh, 1, 3)]);
  check("Replay and late duplicate completion leave appearance and provenance intact", await scalar(
    "SELECT jsonb_build_array(battle_stats,(SELECT state->'trim' FROM kq_storage_lots WHERE flower_id=$1)) FROM kq_flowers WHERE id=$1", [fresh]), finalEvidence);
  check("Production jury consumes and rounds the shared trim result", await scalar("SELECT rpc_kq_prepare_flower_jury($1,$2)", [user, fresh]), { battleStats: { ...stats, appearance: 72 } });
  await query("INSERT INTO kq_market_lots(flower_id) VALUES($1)", [fresh]);
  checks.push("Completed real mass unlocks the existing commerce boundary");

  const legacyResult = await perform(user, [oldEffect(partial, 4, 3)], { tasks: [{ ...runningTask, status: "completed" }] });
  check("Launched legacy job finishes with its original four-unit effect", [(await trim(partial)).completed_work,
    (await trim(partial)).completed_grams, (await trim(partial)).quality_weighted_total,
    (await trim(partial)).quality_gram_weighted_total, (await trim(partial)).quality_delta], [6, 600, 14, 1400, 2]);
  check("Archive captures the completed legacy task without rewriting its original quote", await scalar(
    "SELECT payload FROM kq_staff_archive WHERE user_id=$1 AND kind='task' AND record_id=$2", [user, runningTask.id]), { ...runningTask, status: "completed" });
  check("Legacy completion does not spend player hours a second time", legacyResult.result.state.playerWorkDays, { 1: { usedHours: 1 } });
  const huge = await flower(user, 100000);
  await perform(user, [gramEffect(huge, 0.000001)]);
  check("Small real contribution keeps legacy progress nonzero without losing precision", [(await trim(huge)).completed_grams, (await trim(huge)).completed_work], [0.000001, 0.01]);
  const tiny = await flower(user, 0.1);
  await perform(user, [gramEffect(tiny, 0.099999, 3)]);
  check("Legacy rounding never finishes a lot with a microgram still outstanding", [(await trim(tiny)).completed_work, (await trim(tiny)).completed_at], [5.99, null]);
  await perform(user, [gramEffect(tiny, 0.000001, 1)]);
  check("Last actual microgram closes both ledgers", [(await trim(tiny)).completed_work, (await trim(tiny)).completed_grams, (await trim(tiny)).quality_delta], [6, 0.1, 3]);
  const machine = await flower(user, 10000);
  await rejectUnchanged("Machine gram work requires ownership", user, () => perform(user, [gramEffect(machine, 7200, -3, "machine")]), /staff_invalid/);
  await perform(user, [gramEffect(machine, 7200, -3, "machine"), gramEffect(machine, 7200, -1, "machine")], { trimmerOwned: true });
  check("Machine contribution clipping preserves weighted damage", [(await trim(machine)).completed_grams,
    (await trim(machine)).quality_gram_weighted_total, (await trim(machine)).quality_delta], [10000, -24400, -2]);
  for (const [name, effect] of [
    ["seventh decimal gram", gramEffect(huge, 0.0000001)], ["over maximum gram", gramEffect(huge, 7200.000001)],
    ["zero gram", gramEffect(huge, 0)], ["negative gram", gramEffect(huge, -1)],
    ["third decimal legacy", oldEffect(huge, 0.001)], ["over maximum legacy", oldEffect(huge, 100.01)],
    ["unknown unit", { ...gramEffect(huge, 1), unit: "kg" }], ["explicit null unit", { ...gramEffect(huge, 1), unit: null }],
    ["wrong manual sign", gramEffect(huge, 1, -1)],
  ]) await rejects(`Rejects ${name}`, () => perform(user, [effect]), /staff_invalid/);
  await rejectUnchanged("Later invalid contribution rolls back earlier gram credits", user,
    () => perform(user, [gramEffect(huge, 1), gramEffect(foreign, 1)]), /staff_trim_unavailable/);
  const massHelper = await scalar("SELECT pg_get_functiondef('kq_storage_harvest_units(uuid)'::regprocedure)");
  await db.exec("CREATE OR REPLACE FUNCTION kq_storage_harvest_units(p_flower UUID) RETURNS INTEGER LANGUAGE sql AS $$ SELECT NULL::INTEGER $$;");
  await rejects("Missing authoritative mass fails instead of inventing a quantity", () => flower(user, 500), /staff_trim_mass_unavailable/);
  await db.exec(massHelper);

  // Exercise the public staff command with the server's new task shape. The
  // engine's elapsed-time/rate calculation is tested in its TypeScript suite;
  // these explicit engine-output fixtures verify the real SQL trust boundary.
  const queueUser = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [queueUser]);
  await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [queueUser]);
  const queueLot = await flower(queueUser, 240), queueInitial = await read(queueUser);
  const queueDay = await scalar("SELECT kq_player_work_day($1)", [queueUser]);
  const queueAt = queueInitial.serverNow, started = new Date(Date.parse(queueAt) - 300000).toISOString();
  const midpoint = new Date(Date.parse(queueAt) - 150000).toISOString();
  const historicalTask = { id: "immutable-history", employeeId: "player", kind: "processing", skill: "processing", hours: 1,
    day: queueDay, startedAt: started, completesAt: queueAt, status: "completed", trainingCostCents: 0, skillLevel: 1 };
  await perform(queueUser, [], { tasks: [historicalTask] });
  const shift = { id: "queue-player", employeeId: "player", kind: "trim", skill: "processing", skillLevel: 1,
    hours: 0.5, day: queueDay, startedAt: started, completesAt: queueAt, status: "running", trainingCostCents: 0,
    trimQueue: true, trimMode: "manual", trimRateGramsPerHour: 60, trimProgressAt: started, trimGrams: 0,
    trimContributions: [], trimQualityDelta: 1 };
  const playerCommand = { action: "trim", employeeId: null, mode: "manual", hours: 0.5, expectedCostCents: 0 };
  await rejectUnchanged("New player trim still requires exactly its charged shared hours", queueUser,
    () => perform(queueUser, [], { tasks: [historicalTask, shift] }, playerCommand), /player_work_changed/);
  const booked = await perform(queueUser, [], { tasks: [historicalTask, shift], playerWorkDays: { [queueDay]: { usedHours: 0.5 } } }, playerCommand);
  check("Player trim without a flower selection reserves time in the canonical shared ledger",
    [booked.result.state.tasks.find(row => row.id === shift.id), booked.result.state.playerWorkDays[queueDay].usedHours], [shift, 0.5]);
  const worker = { id: "queue-worker", status: "active", finalPaid: false, hiredAt: started, endsAt: null };
  const employeeShift = { ...shift, id: "queue-employee", employeeId: worker.id, skillLevel: 10,
    trimRateGramsPerHour: 150, trimQualityDelta: 3 };
  await perform(queueUser, [], { employees: [worker], tasks: [historicalTask, shift, employeeShift] }, { ...playerCommand, employeeId: worker.id });
  const halfShifts = [shift, employeeShift].map((row, index) => ({ ...row, trimProgressAt: midpoint,
    trimGrams: index ? 37.5 : 15, trimContributions: [{ flowerId: queueLot, grams: index ? 37.5 : 15 }] }));
  const queuePartial = await perform(queueUser, [gramEffect(queueLot, 15), gramEffect(queueLot, 37.5, 3)], { tasks: [historicalTask, ...halfShifts] });
  check("Player and employee partial progress commits with their actual common-lot grams", [(await trim(queueLot)).completed_grams,
    queuePartial.result.state.tasks.filter(row => row.trimQueue).map(row => row.trimGrams),
    queuePartial.result.state.playerWorkDays[queueDay].usedHours], [52.5, [15, 37.5], 0.5]);
  const queuePartialStore = await stored(queueUser);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", queuePartial.params);
  check("Shared partial settlement replay preserves task traces and physical grams", await stored(queueUser), queuePartialStore);
  const staleQueue = [...queuePartial.params]; staleQueue[2] = randomUUID();
  await rejectUnchanged("Shared partial stale CAS preserves both contributors", queueUser,
    () => scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", staleQueue), /staff_changed/);
  const finishedShifts = halfShifts.map(row => ({ ...row, status: "completed", trimProgressAt: queueAt,
    trimGrams: row.trimGrams * 2, trimContributions: row.trimContributions.map(contribution => ({ ...contribution, grams: contribution.grams * 2 })) }));
  await perform(queueUser, [gramEffect(queueLot, 15), gramEffect(queueLot, 37.5, 3)], { tasks: [historicalTask, ...finishedShifts] });
  check("Finished shared tasks archive their exact individual gram contribution", await scalar(`SELECT jsonb_agg(payload ORDER BY record_id)
    FROM kq_staff_archive WHERE user_id=$1 AND kind='task' AND record_id IN ('queue-player','queue-employee')`, [queueUser]), [...finishedShifts].sort((a, b) => a.id.localeCompare(b.id)));
  check("Archive006 preserves prior history when shared tasks finish", await scalar(
    "SELECT payload FROM kq_staff_archive WHERE user_id=$1 AND kind='task' AND record_id='immutable-history'", [queueUser]), historicalTask);
  check("Completed task evidence agrees with the real partial harvest and unchanged shared hours",
    [(await trim(queueLot)).completed_grams, (await trim(queueLot)).quality_gram_weighted_total, (await read(queueUser)).state.playerWorkDays[queueDay].usedHours], [105, 255, 0.5]);
  await rejectUnchanged("Archived shared-task gram evidence is immutable", queueUser,
    () => perform(queueUser, [], { tasks: [historicalTask, { ...finishedShifts[0], trimGrams: 999 }, finishedShifts[1]] }), /staff_archive_changed/);
  for (const role of ["anon", "authenticated", "service_role"]) {
    check(`${role} cannot directly access trim mass columns`, await scalar(
      "SELECT has_table_privilege($1,'kq_staff_trim_lots','SELECT,INSERT,UPDATE,DELETE') OR has_any_column_privilege($1,'kq_staff_trim_lots','SELECT,INSERT,UPDATE')", [role]), false);
    for (const signature of ["kq_staff_apply_trim(uuid,jsonb,jsonb)", "kq_staff_trim_after_harvest()", "kq_staff_trim_snapshot(uuid)", "kq_staff_snapshot(uuid)", "kq_staff_snapshot_before_shared_trim(uuid)"]) {
      check(`${role} cannot call private helper ${signature}`, await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false);
    }
  }

  // Extend the existing fixture through the weekly-plan migration. Run the
  // exact partner patches applicable to this staff boundary as well; unrelated
  // commerce wrapper fixtures remain outside this bounded integration test.
  const partners = await migration("20261107000400_kq_unbounded_shop_partners.sql");
  await db.exec(section(partners, "CREATE FUNCTION pg_temp.kq_unbounded_partners_patch", "DO $$ BEGIN"));
  await db.exec(section(partners, "SELECT pg_temp.kq_unbounded_partners_patch('public.rpc_kq_staff_commit", "-- Any offer that could cross"));
  const beforeWeekly = await stored(queueUser);
  const beforeWeeklyCommit = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  await db.exec(await migration("20261108000200_kq_staff_weekly_plan.sql"));
  check("Weekly migration never rewrites cash, clocks, tasks, archives or receipts", await stored(queueUser), beforeWeekly);
  const afterWeeklyCommit = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  check("Weekly migration changes only its known command and validation anchors", afterWeeklyCommit, beforeWeeklyCommit
    .replace("'player-assign','settle'", "'player-assign','set-weekly-plan','settle'")
    .replace("PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);",
      "PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);\n PERFORM public.kq_staff_validate_weekly_plan(p_user_id,p_command,p_state,p_debit_cents);"));
  const weeklyCapability = await read(queueUser);
  check("Weekly snapshot preserves archive and shared-trim capabilities", [weeklyCapability.context.weeklyPlanVersion,
    weeklyCapability.context.trimQueueVersion, weeklyCapability.archiveCount], [1, 2, 0]);
  const activeRun = randomUUID(), foreignRun = randomUUID();
  for (const [runId, owner] of [[activeRun, queueUser], [foreignRun, other]]) await query(
    "INSERT INTO kq_runs(id,user_id,status,state,started_at) VALUES($1,$2,'active',$3::jsonb,now()-interval '1 hour')",
    [runId, owner, JSON.stringify({ rulesVersion: 3, phase: "prepare", varietyName: "Weekly fixture", history: [] })]);
  const visibleRuns = (await read(queueUser)).context.activeRuns;
  check("Weekly culture context gives the real owned run creation time", visibleRuns,
    [{ id: activeRun, name: "Weekly fixture", startedAt: await scalar("SELECT to_jsonb(started_at) FROM kq_runs WHERE id=$1", [activeRun]) }]);

  const weeklyUser = randomUUID(), workerId = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [weeklyUser]);
  await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [weeklyUser]);
  const weeklyInitial = await read(weeklyUser);
  const employee = { id: workerId, status: "active", weeklyHours: 35, finalPaid: false, hiredAt: weeklyInitial.serverNow, endsAt: null };
  await perform(weeklyUser, [], { employees: [employee] });
  const days = Array.from({ length: 5 }, () => [{ kind: "training", skill: "culture", hours: 2 }, { kind: "communication", hours: 1 }]);
  const pricedDays = days.map(day => day.map(slot => ({ ...slot, costCents: slot.kind === "training" ? 7000 : 0 })));
  const saveCommand = { action: "set-weekly-plan", employeeId: workerId, enabled: true, days, expectedWeeklyCostCents: 35000 };
  async function weeklyCommit(command, change = value => value, debit = 0, effects = [], revision) {
    const current = await read(weeklyUser);
    const state = change(structuredClone(current.state), current);
    state.lastSettledAt = current.serverNow;
    const params = [weeklyUser, revision ?? current.revision, randomUUID(), JSON.stringify(command), JSON.stringify(state), debit, JSON.stringify(effects)];
    return { result: await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", params), params };
  }
  const saved = await weeklyCommit(saveCommand, (value, current) => {
    value.employees[0].weeklyPlan = { enabled: true, days: pricedDays, nextDay: 2, updatedAt: current.serverNow, weeklyCostCents: 35000, history: [] };
    return value;
  });
  check("Saving a priced weekly plan reserves no cash or work", [saved.result.cashCents, saved.result.state.tasks.length,
    saved.result.state.employees[0].weeklyPlan.nextDay], [100000, 0, 2]);
  const savedStore = await stored(weeklyUser);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", saved.params);
  check("Plan save replay is resolved before its now-stale timestamp and CAS", await stored(weeklyUser), savedStore);
  await rejectUnchanged("Saving a weekly plan cannot charge its future budget", weeklyUser,
    () => weeklyCommit(saveCommand, value => value, 35000), /staff_invalid/);
  await rejectUnchanged("Old applications cannot silently remove an enabled plan", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => { delete value.employees[0].weeklyPlan; return value; }), /staff_weekly_plan_changed/);
  await rejectUnchanged("Settlement cannot replace the authorized activities", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => { value.employees[0].weeklyPlan.days[0][0].hours = 3; return value; }), /staff_weekly_plan_changed/);
  await rejectUnchanged("Weekly days remain bounded to seven reserved hours", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => { value.employees[0].weeklyPlan.days[0][0].hours = 7; return value; }), /staff_invalid/);
  await rejectUnchanged("Processed days cannot move backward", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => { value.employees[0].weeklyPlan.nextDay = 1; return value; }), /staff_weekly_plan_changed/);
  await rejectUnchanged("Unscheduled settlement cannot debit a training fee", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => value, 7000), /staff_weekly_plan_changed/);
  const staleSaved = [...saved.params]; staleSaved[2] = randomUUID();
  await rejectUnchanged("A stale plan editor still fails the original CAS", weeklyUser,
    () => scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", staleSaved), /staff_changed/);

  // Advance only this fixture's saved calendar and plan timestamp together,
  // representing a plan saved before today's boundary without remote clocks.
  const planAt = new Date(Date.parse(saved.result.serverNow) - 4 * 3600000).toISOString();
  await query("UPDATE kq_commerce_accounts SET business_started_at=business_started_at-interval '6 hours' WHERE user_id=$1", [weeklyUser]);
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{employees,0,weeklyPlan,updatedAt}',$2::jsonb) WHERE user_id=$1", [weeklyUser, JSON.stringify(planAt)]);
  const taskAt = new Date(Date.now() - 3600000).toISOString();
  const plannedTasks = days[1].map((slot, index) => ({ id: `weekly:${workerId}:${planAt}:2:${index}`, employeeId: workerId,
    kind: slot.kind, skill: slot.skill ?? slot.kind, hours: slot.hours, day: 2, startedAt: taskAt,
    completesAt: new Date(Date.now() + (index ? 600000 : -600000)).toISOString(), status: index ? "running" : "completed",
    trainingCostCents: index ? 0 : 7000, skillLevel: 1, weeklyPlanAt: planAt, weeklySlot: index, weeklyCostCents: index ? 0 : 7000 }));
  const launch = value => {
    value.tasks.push(...structuredClone(plannedTasks));
    value.employees[0].weeklyPlan.nextDay = 3;
    value.employees[0].weeklyPlan.history = [{ day: 2, started: 2, skipped: 0, reasons: [] }];
    return value;
  };
  await rejectUnchanged("New automatic tasks require exactly their recorded cost", weeklyUser,
    () => weeklyCommit({ action: "settle" }, launch, 0), /staff_weekly_plan_changed/);
  await rejectUnchanged("An occurrence cannot replace its saved price", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => { launch(value); value.tasks[0].weeklyCostCents = 7001; return value; }, 7001), /staff_weekly_plan_changed/);
  await rejectUnchanged("Duplicate occurrence identities cannot enter one settlement", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => { launch(value); value.tasks.push(structuredClone(value.tasks[0])); return value; }, 14000), /staff_invalid/);
  await rejectUnchanged("Automatic work cannot start inside an explicit command", weeklyUser,
    () => weeklyCommit({ action: "extra-hours", employeeId: workerId, hours: 1, expectedGrossCents: 0 }, launch, 7000), /staff_weekly_plan_changed/);
  const launched = await weeklyCommit({ action: "settle" }, launch, 7000);
  check("Automatic training charges once and retains both occurrence identities", [launched.result.cashCents,
    launched.result.state.tasks.map(row => row.id)], [93000, plannedTasks.map(row => row.id)]);
  check("Automatic expense posts to the real treasury once", await scalar(
    "SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='expense_other'", [weeklyUser]), 7000);
  const launchedStore = await stored(weeklyUser);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", launched.params);
  check("Catch-up replay cannot charge or create the same occurrence twice", await stored(weeklyUser), launchedStore);
  await rejectUnchanged("Completed occurrences cannot be charged again", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => value, 7000), /staff_weekly_plan_changed/);
  await rejectUnchanged("Running occurrence cost cannot change during settlement", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => { value.tasks[1].weeklyCostCents = 1; return value; }), /staff_weekly_plan_changed/);
  await rejectUnchanged("Running occurrence reserved hours cannot change after launch", weeklyUser,
    () => weeklyCommit({ action: "settle" }, value => { value.tasks[1].hours = 2; return value; }), /staff_weekly_plan_changed/);
  const owed = { id: "weekly-payroll", employeeId: workerId, dueAt: taskAt, grossCents: 1000, employerCents: 700, indemnityCents: 300, totalCents: 2000, paidCents: 0 };
  await weeklyCommit({ action: "settle" }, value => { value.payroll.push(owed); return value; });
  check("Payroll accrual adds its expense before payment", Number(await scalar(
    "SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='expense_other'", [weeklyUser])), 9000);
  const paidState = value => { value.payroll[0].paidCents = 2000; return value; };
  await rejectUnchanged("Automatic settlement never pays salaries implicitly", weeklyUser,
    () => weeklyCommit({ action: "settle" }, paidState), /staff_payroll_changed/);
  await rejectUnchanged("Payroll cannot hide automatic costs in its debit", weeklyUser,
    () => weeklyCommit({ action: "payroll", expectedCents: 9000 }, paidState, 9000), /staff_payroll_changed/);
  const paid = await weeklyCommit({ action: "payroll", expectedCents: 2000 }, paidState, 2000);
  check("Explicit payroll follows automatic expenses without double counting", [paid.result.cashCents,
    Number(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='expense_other'", [weeklyUser]))], [91000, 9000]);
  const paused = await weeklyCommit({ ...saveCommand, enabled: false }, (value, current) => {
    value.employees[0].weeklyPlan = { ...value.employees[0].weeklyPlan, enabled: false, updatedAt: current.serverNow, nextDay: 3 };
    return value;
  });
  check("Returning to daily management preserves the launched task and its original plan", [paused.result.state.employees[0].weeklyPlan.enabled,
    paused.result.state.tasks[1]], [false, plannedTasks[1]]);
  await weeklyCommit({ action: "settle" }, value => { value.tasks[1].status = "completed"; value.tasks[1].outcome = "Completed after pause"; return value; });
  check("Paused-plan tasks finish into the durable archive with original terms", await scalar(
    "SELECT payload FROM kq_staff_archive WHERE user_id=$1 AND kind='task' AND record_id=$2", [weeklyUser, plannedTasks[1].id]),
    { ...plannedTasks[1], status: "completed", outcome: "Completed after pause" });
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const signature of ["kq_staff_validate_weekly_plan(uuid,jsonb,jsonb,integer)", "kq_staff_snapshot_before_weekly_plan(uuid)", "kq_staff_snapshot(uuid)"]) {
      check(`${role} cannot call private weekly helper ${signature}`, await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false);
    }
    check(`${role} keeps the original staff commit permission`, await scalar(
      "SELECT has_function_privilege($1,'rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)','EXECUTE')", [role]), role === "service_role");
  }

  // Feed real TypeScript transitions into the production SQL boundary. Vite
  // only loads local modules in middleware mode: no HTTP server or credentials.
  vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } },
    server: { middlewareMode: true, watch: null } });
  const engine = await vite.ssrLoadModule("/src/lib/kanab-quest-staff.ts");
  const engineUser = randomUUID(), engineWorker = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [engineUser]);
  await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [engineUser]);
  async function engineCommit(command, taskId = randomUUID()) {
    const raw = await read(engineUser);
    const transition = engine.applyKqStaffCommand(raw, command, taskId);
    const params = [engineUser, raw.revision, randomUUID(), JSON.stringify(command), JSON.stringify(transition.state),
      transition.debitCents, JSON.stringify(transition.effects)];
    return { transition, params, result: await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", params) };
  }
  const engineInitial = await read(engineUser);
  const candidate = engine.getKqStaffRecruitment(engineInitial.context.businessStartedAt, engineInitial.serverNow).candidates.find(row => row.contracts.includes("cdi"));
  assert(candidate, "Real recruitment offers a permanent employee for the integration fixture");
  await engineCommit({ action: "hire", candidateCode: candidate.code, contract: "cdi", weeklyHours: 35, durationMonths: 0,
    reason: "permanent", expectedMonthlyCostCents: engine.getKqStaffMonthlyCost(candidate, 35).totalCents }, engineWorker);
  const realPlanCommand = engine.parseKqStaffCommand({ ...saveCommand, employeeId: engineWorker,
    days: days.map(day => day.map(slot => ({ ...slot, costCents: 999999 }))) });
  const engineSaved = await engineCommit(realPlanCommand);
  check("Real parser and save transition agree with SQL cost normalization", engineSaved.result.state.employees[0].weeklyPlan.days, pricedDays);
  check("Real save changes neither cash nor reserved task hours", [engineSaved.result.cashCents,
    engineSaved.result.state.employees[0].workDays, engineSaved.result.state.tasks.length], [100000, {}, 0]);

  // Translate the persisted fixture's time origin and all saved timestamps by
  // the same duration. This represents real elapsed time without changing any
  // task terms, clocks in production SQL, or saved receipt bytes. The last free
  // task ends five seconds after catch-up, so its actual completion can then be
  // observed after pausing without fabricating a second clock transition.
  const beforeAge = await read(engineUser), origin = Date.parse(beforeAge.context.businessStartedAt);
  const preview = engine.advanceKqStaff({ ...beforeAge, serverNow: new Date(origin + 3 * 14400000 + 3600000).toISOString() });
  const finalPreviewTask = preview.state.tasks.filter(task => task.day === 4).sort((a, b) => Date.parse(a.completesAt) - Date.parse(b.completesAt)).at(-1);
  assert(finalPreviewTask, "Real scheduler prepares the current day's free activity");
  const ageBy = Date.parse(finalPreviewTask.completesAt) - 5000 - Date.parse(beforeAge.serverNow);
  const shiftTime = value => new Date(Date.parse(value) - ageBy).toISOString();
  const aged = structuredClone(beforeAge.state);
  aged.lastSettledAt = shiftTime(aged.lastSettledAt);
  for (const member of aged.employees) {
    for (const field of ["hiredAt", "endsAt", "nextPayrollAt", "paidUntil"]) if (member[field]) member[field] = shiftTime(member[field]);
    if (member.weeklyPlan) member.weeklyPlan.updatedAt = shiftTime(member.weeklyPlan.updatedAt);
  }
  const immutableSaveReceipts = await scalar("SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_staff_receipts r WHERE user_id=$1", [engineUser]);
  await query("UPDATE kq_commerce_accounts SET business_started_at=$2::timestamptz WHERE user_id=$1", [engineUser, shiftTime(beforeAge.context.businessStartedAt)]);
  await query("UPDATE kq_staff_accounts SET state=$2::jsonb WHERE user_id=$1", [engineUser, JSON.stringify(aged)]);
  const caughtUp = await engineCommit({ action: "settle" });
  check("Real three-day catch-up commits paid and free occurrences with the current SQL clock", [caughtUp.transition.debitCents,
    caughtUp.result.cashCents, caughtUp.result.state.tasks.map(task => [task.day, task.kind]),
    caughtUp.result.state.employees[0].weeklyPlan.nextDay], [21000, 79000,
    [[2, "training"], [2, "communication"], [3, "training"], [3, "communication"], [4, "training"], [4, "communication"]], 5]);
  check("Real catch-up archives all five completed occurrences before returning", Number(await scalar(
    "SELECT count(*) FROM kq_staff_archive WHERE user_id=$1 AND kind='task'", [engineUser])), 5);
  const runningBeforePause = caughtUp.result.state.tasks.filter(task => task.status === "running");
  check("Real catch-up retains the current day's unfinished free activity", runningBeforePause.map(task => task.kind), ["communication"]);
  const caughtUpStored = await stored(engineUser);
  await scalar("SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)", caughtUp.params);
  check("Real catch-up replay repeats neither charges nor completed rewards", await stored(engineUser), caughtUpStored);
  const enginePaused = await engineCommit({ ...realPlanCommand, enabled: false });
  check("Real pause preserves the original running task and its charged terms", enginePaused.result.state.tasks.filter(task => task.status === "running"), runningBeforePause);
  check("Real pause is free and starts a new disabled plan version", [enginePaused.result.cashCents,
    enginePaused.result.state.employees[0].weeklyPlan.enabled,
    enginePaused.result.state.employees[0].weeklyPlan.updatedAt !== aged.employees[0].weeklyPlan.updatedAt], [79000, false, true]);
  const untilComplete = Date.parse(runningBeforePause[0].completesAt) - Date.now() + 100;
  if (untilComplete > 0) await new Promise(resolve => setTimeout(resolve, untilComplete));
  const engineFinished = await engineCommit({ action: "settle" });
  check("Real completion after pause creates no extra task or expense", [engineFinished.transition.debitCents,
    engineFinished.result.cashCents, engineFinished.result.state.tasks.length,
    engineFinished.result.state.tasks.every(task => task.status === "completed")], [0, 79000, 6, true]);
  check("Real completed occurrence keeps its original plan version in the archive", await scalar(
    "SELECT payload FROM kq_staff_archive WHERE user_id=$1 AND kind='task' AND record_id=$2", [engineUser, runningBeforePause[0].id]),
    engineFinished.result.state.tasks.find(task => task.id === runningBeforePause[0].id));
  check("Real scheduler did not rewrite any earlier receipt", await scalar(
    "SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_staff_receipts r WHERE user_id=$1 AND request_key=ANY($2::uuid[])",
    [engineUser, immutableSaveReceipts.map(receipt => receipt.request_key)]), immutableSaveReceipts);
  check("Real automatic cash agrees with the treasury expense ledger", Number(await scalar(
    "SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='expense_other'", [engineUser])), 21000);
  console.log(`Shared TRIM and weekly-plan SQL: ${checks.length} checks passed (isolated PGlite).`);
} catch (error) {
  console.error(`Shared TRIM SQL failed after ${checks.length} checks: ${error.message}`);
  if (error.where) console.error(error.where);
  if (error.position) console.error(`SQL position: ${error.position}`);
  if (error.actual !== undefined) console.error({ actual: error.actual, expected: error.expected });
  process.exitCode = 1;
} finally { await vite?.close(); await db.close(); }
