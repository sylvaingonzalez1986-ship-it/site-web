// Isolated PostgreSQL integration: exact archive migration, payroll accounting,
// trim snapshot wrapper, and workday validation/charge. Unrelated business and
// investment activity is empty, as in the existing staff accounting fixture.
// PGlite checks atomic rollback/CAS on one connection, not lock contention.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { setupStaffDatabase } from "./test-placard-staff.mjs";

const db = new PGlite(), checks = [];
const query = (sql, values = []) => db.query(sql, values);
const scalar = async (sql, values = []) => Object.values((await query(sql, values)).rows[0])[0];
const migration = name => readFile(path.resolve("supabase/migrations", name), "utf8");
const section = (source, first, last) => {
  const start = source.indexOf(first), end = source.indexOf(last, start + first.length);
  assert(start >= 0 && end > start, `Fixture anchors: ${first}`);
  return source.slice(start, end);
};
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const rejects = async (name, action, pattern) => { await assert.rejects(action, pattern, name); checks.push(name); };
const read = user => scalar("SELECT rpc_kq_staff_snapshot($1)", [user]);
const archive = (user, kind = "contract", employee = null, cursor = null) => scalar(
  "SELECT rpc_kq_staff_archive($1,$2,$3,$4::jsonb)", [user, kind, employee, cursor === null ? null : JSON.stringify(cursor)]);
const state = snapshot => ({ version: 1, employees: [], tasks: [], payroll: [], playerWorkDays: {},
  supplierDiscountPercent: 0, supplierDiscountUntil: null, ...(snapshot.state ?? {}), lastSettledAt: snapshot.serverNow });
const commit = (user, snapshot, next, command = { action: "settle" }, debit = 0, key = randomUUID()) => scalar(
  "SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,'[]')",
  [user, snapshot.revision, key, JSON.stringify(command), JSON.stringify({ ...next, lastSettledAt: snapshot.serverNow }), debit]);
const employee = (id, at, status = "ended") => ({ id, name: `Employee ${id}`, status, finalPaid: status === "ended",
  hiredAt: at, endsAt: status === "ended" ? at : null, contract: "cdd", weeklyHours: 35, completedTasks: 0 });
const payroll = (id, employeeId, at, paidCents = 0) => ({ id, employeeId, dueAt: at,
  grossCents: 1000, employerCents: 700, indemnityCents: 300, totalCents: 2000, paidCents });
const task = (id, employeeId, at, status = "completed") => ({ id, employeeId, kind: "processing", skill: "processing",
  hours: 1, day: 1, startedAt: at, completesAt: at, status, trainingCostCents: 0, skillLevel: 1 });
const balances = user => scalar("SELECT jsonb_object_agg(account,balance_cents) FROM kq_treasury_balances WHERE user_id=$1", [user]);
const receiptBytes = user => scalar("SELECT COALESCE(jsonb_agg(to_jsonb(r)::TEXT ORDER BY request_key),'[]') FROM kq_staff_receipts r WHERE user_id=$1", [user]);
const stored = user => scalar(`SELECT jsonb_build_object(
  'staff',(SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1),
  'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
  'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_staff_receipts r WHERE user_id=$1),
  'archive',(SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,record_id) FROM kq_staff_archive a WHERE user_id=$1),
  'journal',(SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM kq_treasury_journal j WHERE user_id=$1),
  'settlements',(SELECT count(*) FROM test_settlement_observations WHERE user_id=$1))`, [user]);
async function rejectUnchanged(name, user, action, pattern) {
  const before = await stored(user);
  await rejects(name, action, pattern);
  check(`${name}: all writes rolled back`, await stored(user), before);
}
async function player() {
  const user = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [user]);
  await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [user]);
  await read(user);
  return user;
}

try {
  await setupStaffDatabase(db);
  const trim = await migration("20261107000200_kq_staff_trim.sql");
  await db.exec(section(trim, "CREATE TABLE public.kq_staff_trim_lots", "CREATE FUNCTION public.kq_staff_trim_after_harvest"));
  await db.exec(section(trim, "CREATE FUNCTION public.kq_staff_trim_snapshot", "CREATE FUNCTION public.kq_staff_apply_trim"));
  // Only the staff command whitelist is needed; actual trim effects are covered
  // by test-placard-staff-trim, not substituted by fake successful operations.
  await db.exec(section(trim, "CREATE FUNCTION pg_temp.kq_staff_trim_patch", "SELECT pg_temp.kq_staff_trim_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',\n 'IF effect_kind"));
  await db.exec(`
    ALTER TABLE kq_commerce_accounts ADD COLUMN vat_reserved_cents INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE kq_lab_invoices ADD COLUMN user_id UUID;
    CREATE TABLE kq_energy_invoices(user_id UUID,remaining_cents INTEGER);
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);
    CREATE TABLE arena_chanvrier_savings_deposits(user_id UUID,balance_cents BIGINT);
    CREATE TABLE kq_bank_loans(user_id UUID,total_cents BIGINT,paid_cents BIGINT);
    CREATE TABLE kq_crypto_positions(user_id UUID,cost_basis_cents BIGINT);
    CREATE TABLE kq_stock_positions(user_id UUID,cost_basis_cents BIGINT);
    CREATE FUNCTION kq_treasury_refresh(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
  `);
  const stock = await migration("20260923000800_kq_stock_market.sql");
  await db.exec(section(stock, "CREATE OR REPLACE FUNCTION public.kq_treasury_balances_at", "REVOKE ALL ON FUNCTION public.kq_treasury_balances_at"));
  const supplier = await migration("20261012000700_kq_warehouse_supplier_invoices.sql");
  await db.exec(section(supplier, "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_balances_at", "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_stock_cost"));
  await db.exec(await migration("20261107000300_kq_staff_accounting.sql"));
  const workday = await migration("20261107000500_kq_player_workday.sql");
  await db.exec(section(workday, "CREATE FUNCTION public.kq_player_work_day", "-- Capture the exact current signatures/defaults"));

  const legacy = await player(), untouched = await player();
  const initial = await read(legacy), at = initial.serverNow;
  const oldEmployees = Array.from({ length: 40 }, (_, index) => employee(`old-${String(index).padStart(2, "0")}`, at));
  const oldState = { ...state(initial), employees: oldEmployees };
  const legacySaved = await commit(legacy, initial, oldState);
  // The old engine had already trimmed this history from its live JSON. Keep
  // multiple receipt versions to ensure backfill chooses final paid/completed
  // records, and preserves the complete immutable historical receipt bytes.
  const recovered = employee("receipt-contract", at);
  const receiptPay = payroll("receipt-pay", recovered.id, at, 2000);
  const receiptTask = task("receipt-task", recovered.id, at);
  for (const [index, historical] of [
    { ...oldState, employees: [...oldEmployees, { ...recovered, completedTasks: 1 }], payroll: [{ ...receiptPay, paidCents: 1000 }], tasks: [{ ...receiptTask, status: "running" }] },
    { ...oldState, employees: [...oldEmployees, { ...recovered, completedTasks: 2 }], payroll: [receiptPay], tasks: [receiptTask] },
  ].entries()) {
    await query("INSERT INTO kq_staff_receipts(user_id,request_key,command,result,created_at) VALUES($1,$2,$3::jsonb,$4::jsonb,now()+$5::INTEGER*interval '1 second')",
      [legacy, randomUUID(), JSON.stringify({ action: "settle" }), JSON.stringify({ state: historical, revision: index + 20 }), index + 1]);
  }
  const beforeReceipts = await receiptBytes(legacy), beforeBalances = await balances(legacy);
  const beforeUntouched = await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [untouched]);
  await db.exec(await migration("20261107000600_kq_staff_archive.sql"));
  checks.push("Archive migration composes with real accounting, trim snapshot and workday validation");
  const compacted = await read(legacy);
  check("Backfill removes forty settled contracts from the live roster", compacted.state.employees, []);
  check("Snapshot reports the durable archived contract count", compacted.archiveCount, 41);
  check("Backfill invalidates existing CAS without advancing settlement time", [compacted.revision, compacted.state.lastSettledAt], [legacySaved.revision + 1, oldState.lastSettledAt]);
  check("Backfill leaves an uncompacted account untouched", await scalar("SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1", [untouched]), beforeUntouched);
  check("Backfill never rewrites historical receipts", await receiptBytes(legacy), beforeReceipts);
  check("Backfill creates no new salary expense or cash movement", await balances(legacy), beforeBalances);
  check("Receipt-only paid payroll survives with its final payment", (await archive(legacy, "payroll", recovered.id)).items, [receiptPay]);
  check("Receipt-only completed task survives with its final status", (await archive(legacy, "task", recovered.id)).items, [receiptTask]);
  check("Receipt-only contract uses its latest version", await scalar("SELECT payload FROM kq_staff_archive WHERE user_id=$1 AND kind='contract' AND record_id=$2", [legacy, recovered.id]), { ...recovered, completedTasks: 2 });

  const collected = [], pageSizes = [];
  let cursor = null;
  do {
    const page = await archive(legacy, "contract", null, cursor);
    collected.push(...page.items); pageSizes.push(page.items.length); cursor = page.nextCursor;
  } while (cursor);
  check("Cursor pagination gives bounded pages through tied event timestamps", pageSizes, [20, 20, 1]);
  check("Tied timestamps have stable descending IDs without duplicates or skips", collected.map(row => row.id),
    [...oldEmployees, recovered].map(row => row.id).sort().reverse());
  check("Other owner cannot see these archives", await archive(untouched), { items: [], nextCursor: null });
  check("Archive filtering never includes a different employee", (await archive(legacy, "payroll", oldEmployees[0].id)).items, []);
  const fortyFirst = employee("hire-41", at, "active");
  const hired = await commit(legacy, compacted, { ...state(compacted), employees: [fortyFirst] }, { action: "hire" });
  check("Forty archived contracts permit the forty-first hire", hired.state.employees, [fortyFirst]);
  await rejectUnchanged("Pre-migration CAS cannot overwrite compacted data", legacy,
    () => commit(legacy, legacySaved, oldState), /staff_changed/);

  const capacity = await player(), capacityBefore = await read(capacity);
  const eight = Array.from({ length: 8 }, (_, index) => employee(`active-${index}`, at, "active"));
  const full = await commit(capacity, capacityBefore, { ...state(capacityBefore), employees: eight });
  check("Eight simultaneous active contracts remain allowed", full.state.employees.length, 8);
  await rejectUnchanged("Ninth simultaneous active contract is rejected", capacity,
    () => commit(capacity, full, { ...state(full), employees: [...eight, employee("active-9", at, "active")] }), /staff_/);
  const many = await player(), manyBefore = await read(many);
  const overForty = await commit(many, manyBefore, { ...state(manyBefore), employees: [...oldEmployees, fortyFirst] });
  check("SQL no longer caps total historical plus active contracts at forty", overForty.state.employees, [fortyFirst]);

  const payer = await player(), beforeDue = await read(payer);
  const debtor = employee("debtor", at), working = employee("working", at), unfinished = employee("not-final", at);
  unfinished.finalPaid = false;
  const due = payroll("pay-1", debtor.id, at), running = task("run-1", working.id, at, "running");
  const accrued = await commit(payer, beforeDue, { ...state(beforeDue), employees: [debtor, working, unfinished], payroll: [due], tasks: [running] });
  check("Ended contracts stay live while unpaid, running or not finalized", accrued.state.employees.map(row => row.id), [debtor.id, working.id, unfinished.id]);
  check("Unpaid contract does not appear in the archive", (await archive(payer)).items, []);
  check("Accrual records debt before any archive removal", await balances(payer),
    { cash: 100000, opening_equity: -100000, expense_other: 2000, staff_payable: -2000 });
  const payKey = randomUUID(), payCommand = { action: "payroll", expectedCents: 2000 };
  const paidState = { ...state(accrued), payroll: [{ ...due, paidCents: 2000 }] };
  const paid = await commit(payer, accrued, paidState, payCommand, 2000, payKey);
  check("Final payment archives the settled contract and its payroll atomically", [paid.state.employees.map(row => row.id), paid.state.payroll], [[working.id, unfinished.id], []]);
  check("Archive retains final payroll amounts", (await archive(payer, "payroll", debtor.id)).items, [{ ...due, paidCents: 2000 }]);
  check("Accounting runs before compaction: expense once, debt cleared, cash once", await balances(payer),
    { cash: 98000, opening_equity: -100000, expense_other: 2000, staff_payable: 0, suspense: 0 });
  check("Independent treasury debt agrees after compaction", await scalar("SELECT kq_staff_debt($1)", [payer]), 0);
  const afterPayment = await stored(payer);
  const replay = await commit(payer, accrued, paidState, payCommand, 2000, payKey);
  check("Exact payment replay succeeds after its payroll left live state", [replay.replayed, replay.cashCents], [true, 98000]);
  check("Replay changes neither receipts, ledger, cash nor archive", await stored(payer), afterPayment);
  await rejectUnchanged("Stale payment cannot create an archive or a second charge", payer,
    () => commit(payer, accrued, paidState, payCommand, 2000), /staff_changed/);
  await rejectUnchanged("Archived employee IDs cannot be resurrected", payer,
    () => commit(payer, paid, { ...state(paid), employees: [...paid.state.employees, { ...debtor, status: "active", finalPaid: false }] }), /staff_/);
  await rejectUnchanged("Archived payroll IDs cannot re-enter the live journal", payer,
    () => commit(payer, paid, { ...state(paid), payroll: [{ ...due, paidCents: 2000 }] }, payCommand, 2000), /staff_/);

  const finished = await commit(payer, paid, { ...state(paid), tasks: [{ ...running, status: "completed" }] });
  check("Completing the last running task releases its finalized contract", finished.state.employees.map(row => row.id), [unfinished.id]);
  check("Completion archives the new task version rather than the old running version", (await archive(payer, "task", working.id)).items, [{ ...running, status: "completed" }]);

  // Active employee and personal task history can be trimmed by the engine.
  // OLD rows must be archived before they disappear from NEW state.
  const history = await player(), historyBefore = await read(history);
  const active = employee("history-active", at, "active"), oldTask = task("history-task", "player", at);
  const historySeed = await commit(history, historyBefore, { ...state(historyBefore), employees: [active], tasks: [oldTask] });
  const historyTrimmed = await commit(history, historySeed, { ...state(historySeed), tasks: [] });
  check("Compaction preserves completed player task history from OLD state", await scalar("SELECT payload FROM kq_staff_archive WHERE user_id=$1 AND kind='task' AND record_id=$2", [history, oldTask.id]), oldTask);
  const historyArchive = await scalar("SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,record_id) FROM kq_staff_archive a WHERE user_id=$1", [history]);
  await query("SELECT kq_player_work_charge($1,0.5)", [history]);
  const charged = await read(history), day = await scalar("SELECT kq_player_work_day($1)", [history]);
  check("Shared player work charges retain roster and advance the real daily hours", [charged.state.employees, charged.state.playerWorkDays[day].usedHours, charged.revision], [[active], 0.5, historyTrimmed.revision + 1]);
  check("Shared player work updates preserve archive bytes", await scalar("SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,record_id) FROM kq_staff_archive a WHERE user_id=$1", [history]), historyArchive);
  await rejectUnchanged("Current commit still rejects overwriting shared work hours", history,
    () => commit(history, charged, { ...state(charged), playerWorkDays: {} }), /player_work_changed/);
  const flower = randomUUID();
  await query("INSERT INTO kq_flowers(id,variety_name) VALUES($1,'Trim fixture')", [flower]);
  await query("INSERT INTO kq_staff_trim_lots(flower_id,user_id) VALUES($1,$2)", [flower, history]);
  check("Archive snapshot wrapping preserves the existing trim snapshot", (await read(history)).context.trimLots.map(row => row.flowerId), [flower]);

  const windowUser = await player(), windowBefore = await read(windowUser);
  const windowEmployee = employee("window-active", at, "active");
  const completedTasks = Array.from({ length: 210 }, (_, index) => task(`window-task-${index}`, windowEmployee.id, at));
  const paidPayroll = Array.from({ length: 130 }, (_, index) => ({ ...payroll(`window-pay-${index}`, windowEmployee.id, at),
    grossCents: 0, employerCents: 0, indemnityCents: 0, totalCents: 0, paidCents: 0 }));
  const windowSaved = await commit(windowUser, windowBefore,
    { ...state(windowBefore), employees: [windowEmployee], tasks: completedTasks, payroll: paidPayroll });
  check("Live active-staff windows retain the latest two hundred tasks and one hundred twenty payslips",
    [windowSaved.state.tasks.map(row => row.id), windowSaved.state.payroll.map(row => row.id)],
    [completedTasks.slice(-200).map(row => row.id), paidPayroll.slice(-120).map(row => row.id)]);
  check("Every finished row survives outside the bounded live windows", await scalar(`SELECT jsonb_object_agg(kind,total) FROM
    (SELECT kind,count(*) AS total FROM kq_staff_archive WHERE user_id=$1 GROUP BY kind) rows`, [windowUser]), { task: 210, payroll: 130 });
  const archiveRowsBefore = await scalar("SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,record_id) FROM kq_staff_archive a WHERE user_id=$1", [windowUser]);
  await rejectUnchanged("Archived completed task payload is immutable while still visible", windowUser,
    () => commit(windowUser, windowSaved, { ...state(windowSaved), tasks: windowSaved.state.tasks.map((row, index) => index ? row : { ...row, hours: 2 }) }), /staff_archive_changed/);
  await commit(windowUser, windowSaved, { ...state(windowSaved), tasks: [], payroll: [] });
  check("Older application windows may omit finished rows without destroying history", await scalar(
    "SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,record_id) FROM kq_staff_archive a WHERE user_id=$1", [windowUser]), archiveRowsBefore);
  await query("SELECT kq_player_work_charge($1,0.5)", [windowUser]);
  const chargedWindow = await read(windowUser);
  check("Shared work updates never restore compacted task or payroll arrays", [chargedWindow.state.tasks, chargedWindow.state.payroll], [[], []]);

  for (const role of ["anon", "authenticated", "service_role"]) {
    check(`${role} has no direct archive read/write privileges`, await scalar(`SELECT
      has_table_privilege($1,'kq_staff_archive','SELECT') OR has_table_privilege($1,'kq_staff_archive','INSERT') OR
      has_table_privilege($1,'kq_staff_archive','UPDATE') OR has_table_privilege($1,'kq_staff_archive','DELETE')`, [role]), false);
    check(`${role} archive RPC execution follows the trusted backend boundary`, await scalar(
      "SELECT has_function_privilege($1,'rpc_kq_staff_archive(uuid,text,text,jsonb)','EXECUTE')", [role]), role === "service_role");
  }
  check("Archive table has RLS enabled", await scalar("SELECT relrowsecurity FROM pg_class WHERE oid='kq_staff_archive'::regclass"), true);
  await rejects("Invalid archive kind is rejected", () => archive(history, "invalid"), /staff_/);
  await rejects("Malformed archive cursor is rejected", () => archive(history, "contract", null, { at: "invalid", id: "x" }), /staff_|timestamp|date/);
  console.log(`Personnel archive SQL: ${checks.length} checks passed (isolated PGlite).`);
} catch (error) {
  console.error(`Personnel archive SQL failed after ${checks.length} checks: ${error.message}`);
  if (error.where) console.error(error.where);
  if (error.actual !== undefined) console.error({ actual: error.actual, expected: error.expected });
  process.exitCode = 1;
} finally { await db.close(); }
