// Prospective staff evidence and opted-in payments on isolated PostgreSQL.
// Uses production payroll, supplier, archive, weekly and lifecycle guards.
// PGlite is single-connection: CAS/rollback/replay, not lock contention.
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
  assert(start >= 0 && end > start, `Fixture anchors: ${first}`); return source.slice(start, end);
};
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const read = user => scalar("SELECT rpc_kq_staff_snapshot($1)", [user]);
const empty = snapshot => ({ version: 1, employees: [], tasks: [], payroll: [], playerWorkDays: {},
  supplierDiscountPercent: 0, supplierDiscountUntil: null, ...structuredClone(snapshot.state ?? {}), lastSettledAt: snapshot.serverNow });
const commit = (user, snapshot, command, next = empty(snapshot), debit = 0, effects = [], key = randomUUID()) => scalar(
  "SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)",
  [user, snapshot.revision, key, JSON.stringify(command), JSON.stringify(next), debit, JSON.stringify(effects)]);
const stored = user => scalar(`SELECT jsonb_build_object(
 'staff',(SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1),
 'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
 'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY event_key) FROM kq_staff_benefit_events e WHERE user_id=$1),
 'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_staff_receipts r WHERE user_id=$1),
 'archive',(SELECT jsonb_agg(to_jsonb(h) ORDER BY kind,record_id) FROM kq_staff_archive h WHERE user_id=$1),
 'invoices',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM kq_supplier_invoices i WHERE user_id=$1),
 'journal',(SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM kq_treasury_journal j WHERE user_id=$1))`, [user]);
async function rejectUnchanged(name, user, call, pattern) {
  const before = await stored(user);
  await assert.rejects(call, pattern, name);
  check(`${name}: atomic rollback`, await stored(user), before);
}
async function player() {
  const id = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [id]);
  await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [id]);
  await read(id);
  return id;
}
async function seed(user, extra = {}) {
  const snapshot = await read(user);
  const employee = { id: randomUUID(), status: "active", hiredAt: snapshot.serverNow, name: "Camille", contract: "cdi", endsAt: null,
    nextPayrollAt: new Date(Date.parse(snapshot.serverNow) + 86400000).toISOString(), finalPaid: false,
    weeklyHours: 35, workDays: {}, leave: [] };
  await query("UPDATE kq_staff_accounts SET state=$2::jsonb WHERE user_id=$1", [user, JSON.stringify({ ...empty(snapshot), employees: [employee], ...extra })]);
  return read(user);
}
async function rules(user, changes = {}) {
  const snapshot = await read(user);
  const policy = { enabled: true, employeeId: snapshot.state.employees[0].id, paySuppliers: true, payPayroll: true,
    maxDailyCents: 10000, cashReserveCents: 1000, supplierDueDays: 1, ...changes, updatedAt: snapshot.serverNow };
  const { updatedAt, ...command } = policy;
  return commit(user, snapshot, { action: "set-administration-rules", ...command }, { ...empty(snapshot), administrationRules: policy });
}
async function invoice(user, amount = 1000, dueHours = 2) {
  const run = randomUUID();
  await query("INSERT INTO kq_runs(id,user_id,state) VALUES($1,$2,'{\"history\":[]}')", [run, user]);
  return scalar(`INSERT INTO kq_supplier_invoices(run_id,user_id,amount_cents,remaining_cents,due_at)
   VALUES($1,$2,$3,$3,now()+$4*interval '1 hour') RETURNING id`, [run, user, amount, dueHours]);
}
async function task(user, hours = .5, changes = {}) {
  const snapshot = await read(user), next = empty(snapshot);
  const started = new Date(Date.parse(snapshot.serverNow) - 1000).toISOString();
  // No wall-clock sleeps: fixture clocks model a mission started after consent.
  await query("UPDATE kq_staff_accounts SET benefits_started_at=now()-interval '1 day' WHERE user_id=$1", [user]);
  if (next.administrationRules) next.administrationRules.updatedAt = new Date(Date.parse(started) - 1000).toISOString();
  const item = { id: randomUUID(), employeeId: next.employees[0].id, kind: "administration", skill: "administration",
    skillLevel: 5, hours, day: 1, startedAt: started, completesAt: snapshot.serverNow, status: "running", ...changes };
  next.tasks.push(item);
  await query("UPDATE kq_staff_accounts SET state=$2::jsonb WHERE user_id=$1", [user, JSON.stringify(next)]);
  return item;
}
async function finish(user, item, effects = [], key = randomUUID()) {
  const snapshot = await read(user), next = empty(snapshot);
  next.tasks = next.tasks.map(t => t.id === item.id ? { ...t, status: "completed", outcome: "Mission effectuée.", result: { version: 1, xpGained: 6 } } : t);
  return { snapshot, next, key, result: await commit(user, snapshot, { action: "settle" }, next, 0, effects, key) };
}
const balances = user => scalar("SELECT jsonb_object_agg(account,balance_cents) FROM kq_treasury_balances WHERE user_id=$1", [user]);

try {
  await setupStaffDatabase(db);
  const trim = await migration("20261107000200_kq_staff_trim.sql");
  await db.exec(section(trim, "CREATE TABLE public.kq_staff_trim_lots", "CREATE FUNCTION public.kq_staff_trim_after_harvest"));
  await db.exec(section(trim, "CREATE FUNCTION public.kq_staff_trim_snapshot", "CREATE FUNCTION public.kq_staff_apply_trim"));
  await db.exec(section(trim, "CREATE FUNCTION pg_temp.kq_staff_trim_patch", "SELECT pg_temp.kq_staff_trim_patch('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)',\n 'IF effect_kind"));
  await db.exec(`ALTER TABLE kq_commerce_accounts ADD COLUMN vat_reserved_cents INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE kq_lab_invoices ADD COLUMN user_id UUID;
    CREATE TABLE kq_energy_invoices(user_id UUID,remaining_cents INTEGER);
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);
    CREATE TABLE arena_chanvrier_savings_deposits(user_id UUID,balance_cents BIGINT);
    CREATE TABLE kq_bank_loans(user_id UUID,total_cents BIGINT,paid_cents BIGINT);
    CREATE TABLE kq_crypto_positions(user_id UUID,cost_basis_cents BIGINT);
    CREATE TABLE kq_stock_positions(user_id UUID,cost_basis_cents BIGINT);
    CREATE FUNCTION kq_treasury_refresh(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    ALTER TABLE kq_staff_trim_lots ADD COLUMN completed_grams NUMERIC NOT NULL DEFAULT 0;`);
  const stock = await migration("20260923000800_kq_stock_market.sql"), suppliers = await migration("20261012000700_kq_warehouse_supplier_invoices.sql");
  await db.exec(section(stock, "CREATE OR REPLACE FUNCTION public.kq_treasury_balances_at", "REVOKE ALL ON FUNCTION public.kq_treasury_balances_at"));
  await db.exec(section(suppliers, "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_balances_at", "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_stock_cost"));
  await db.exec(await migration("20261107000300_kq_staff_accounting.sql"));
  const workday = await migration("20261107000500_kq_player_workday.sql");
  await db.exec(section(workday, "CREATE FUNCTION public.kq_player_work_day", "-- Capture the exact current signatures/defaults"));
  await db.exec(await migration("20261107000600_kq_staff_archive.sql"));
  await db.exec(await migration("20261108000200_kq_staff_weekly_plan.sql"));
  await db.exec(await migration("20261108000700_kq_staff_contract_lifecycle.sql"));
  const culture = await migration("20261108000300_kq_culture_work_steps.sql");
  await db.exec(section(culture, "CREATE TABLE public.kq_culture_work_steps", "-- Cumulative differences"));
  await db.exec(section(culture, "CREATE FUNCTION public.kq_culture_work_validate_staff", "DO $$ DECLARE body TEXT; anchor TEXT; spec RECORD; BEGIN"));
  const processing = await migration("20261108000400_kq_processing_work.sql");
  await db.exec(section(processing, "CREATE TABLE public.kq_processing_jobs", "CREATE FUNCTION public.kq_processing_machine_available"));
  await db.exec(section(processing, "CREATE FUNCTION public.kq_processing_work_validate_staff", "DO $$ DECLARE body TEXT; anchor TEXT; BEGIN"));
  // The current processing guard is composed before the benefits observer.
  let body = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  body = body.replace("AND processing_ready_at>now();", "AND processing_ready_at>now() AND NOT EXISTS(SELECT 1 FROM public.kq_processing_jobs j WHERE j.flower_id=(effect->>'flowerId')::UUID);");
  body = body.replace("PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);", "PERFORM public.kq_player_work_validate_staff(p_user_id,p_command,p_state);\n PERFORM public.kq_culture_work_validate_staff(p_user_id,p_state);\n PERFORM public.kq_processing_work_validate_staff(p_user_id,p_state);");
  await db.exec(body);
  const legacy = await player();
  await seed(legacy, { supplierDiscountPercent: 6, supplierDiscountUntil: "2099-01-01T00:00:00Z" });
  await invoice(legacy);
  await db.exec(await migration("20261108001100_kq_staff_benefits.sql"));
  checks.push("Migration composes with production archive, payroll, weekly-plan and lifecycle guards");
  check("Historical savings are not invented", (await read(legacy)).benefits.supplierSavingsCents, 0);

  const user = await player(), other = await player();
  await seed(user); await seed(other);
  let snapshot = await read(user);
  check("Capability and prospective starting point are explicit", [snapshot.context.staffBenefitsVersion, typeof snapshot.benefits.trackedSince, snapshot.benefits.lastAdministration], [1, "string", null]);
  check("No authorization is created by reading Personnel", snapshot.state.administrationRules, undefined);
  const disabledInvoice = await invoice(user);
  await finish(user, await task(user));
  check("Absent rules never spend money", [(await read(user)).cashCents, await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [disabledInvoice])], [100000, 1000]);

  snapshot = await read(user);
  const invalid = { enabled: true, employeeId: snapshot.state.employees[0].id, paySuppliers: true, payPayroll: true, maxDailyCents: 10000, cashReserveCents: 1000, supplierDueDays: 8, updatedAt: snapshot.serverNow };
  const { updatedAt, ...invalidCommand } = invalid;
  await rejectUnchanged("Due horizon is capped server-side", user,
    () => commit(user, snapshot, { action: "set-administration-rules", ...invalidCommand }, { ...empty(snapshot), administrationRules: invalid }), /staff_administration_invalid/);
  invalid.supplierDueDays = 1; invalid.employeeId = (await read(other)).state.employees[0].id;
  await rejectUnchanged("Administrator must belong to the owner", user,
    () => commit(user, snapshot, { action: "set-administration-rules", ...invalid, updatedAt: undefined }, { ...empty(snapshot), administrationRules: invalid }), /staff_administration_invalid/);
  await rejectUnchanged("Unrelated commands cannot insert authorization", user,
    () => commit(user, snapshot, { action: "settle" }, { ...empty(snapshot), administrationRules: invalid }), /staff_administration_changed/);
  await rules(user);
  const current = await task(user), execution = await finish(user, current);
  check("One half-hour handles one invoice", [execution.result.cashCents, execution.result.benefits.invoicesPaidCount, execution.result.benefits.invoicesPaidCents], [99000, 1, 1000]);
  check("Payment result is explicit", execution.result.benefits.lastAdministration, { taskId: current.id, at: execution.result.benefits.lastAdministration.at, paidCents: 1000, paidCount: 1, skippedReason: null });
  const beforeReplay = await stored(user);
  check("Receipt replay precedes stale CAS", (await commit(user, execution.snapshot, { action: "settle" }, execution.next, 0, [], execution.key)).replayed, true);
  check("Replay cannot double spend or double count", await stored(user), beforeReplay);
  snapshot = await read(user);
  await commit(user, snapshot, { action: "settle" });
  check("A task cannot be reexecuted by a new settle key", (await read(user)).cashCents, 99000);
  check("Invoice debt and cash observer balance without suspense", (await balances(user)).suspense, 0);
  snapshot = await read(user);
  const unchangedRules = snapshot.state.administrationRules;
  const { updatedAt: previousAuthorization, ...sameCommand } = unchangedRules;
  const noChange = await commit(user, snapshot, { action: "set-administration-rules", ...sameCommand });
  check("Saving unchanged rules preserves their original authorization timestamp", noChange.state.administrationRules.updatedAt, previousAuthorization);
  check("Saving unchanged rules cannot replay task capacity", noChange.cashCents, 99000);
  await rejectUnchanged("Changed receipt command is rejected before mutation", user,
    () => commit(user, execution.snapshot, { action: "set-administration-rules", ...sameCommand }, execution.next, 0, [], execution.key), /staff_request_mismatch/);
  snapshot = await read(user);
  const oversized = { ...snapshot.state.administrationRules, maxDailyCents: 100000001, updatedAt: snapshot.serverNow };
  await rejectUnchanged("Daily delegation cap has a hard server maximum", user,
    () => commit(user, snapshot, { action: "set-administration-rules", ...oversized, updatedAt: undefined }, { ...empty(snapshot), administrationRules: oversized }), /staff_administration_invalid/);
  const changedReserve = { ...snapshot.state.administrationRules, cashReserveCents: 100, updatedAt: snapshot.serverNow };
  await rejectUnchanged("A command cannot hide a different reserve in state", user,
    () => commit(user, snapshot, { action: "set-administration-rules", ...sameCommand }, { ...empty(snapshot), administrationRules: changedReserve }), /staff_administration_changed/);

  const payrollUser = await player(); await seed(payrollUser); await rules(payrollUser, { maxDailyCents: 3000 });
  snapshot = await read(payrollUser);
  const payroll = { id: randomUUID(), employeeId: snapshot.state.employees[0].id, dueAt: snapshot.serverNow,
    grossCents: 1000, employerCents: 500, indemnityCents: 500, totalCents: 2000, paidCents: 0 };
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{payroll}',$2::jsonb) WHERE user_id=$1", [payrollUser, JSON.stringify([payroll])]);
  const pInvoice = await invoice(payrollUser, 1000);
  await finish(payrollUser, await task(payrollUser, 1));
  snapshot = await read(payrollUser);
  check("One hour pays two documents ordered by due date", [snapshot.benefits.payrollPaidCents, snapshot.benefits.invoicesPaidCents, snapshot.cashCents], [2000, 1000, 97000]);
  check("Paid payroll remains authoritative in returned state", snapshot.state.payroll[0].paidCents, 2000);
  check("Payroll expense is accrued once and both debts clear", await balances(payrollUser), { cash: 97000, opening_equity: -100000, expense_other: 3000, staff_payable: 0, supplier_payable: 0, suspense: 0 });
  check("Archive contains the exact fully paid payroll", await scalar("SELECT payload->'paidCents' FROM kq_staff_archive WHERE user_id=$1 AND kind='payroll' AND record_id=$2", [payrollUser, payroll.id]), 2000);
  check("Supplier payment is committed", await scalar("SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1", [pInvoice]), 0);
  await invoice(payrollUser, 100);
  await finish(payrollUser, await task(payrollUser));
  snapshot = await read(payrollUser);
  check("Daily budget is shared across completed tasks", [snapshot.cashCents, snapshot.benefits.lastAdministration.paidCents, snapshot.benefits.lastAdministration.skippedReason], [97000, 0, "budget-or-reserve"]);
  await query("UPDATE kq_commerce_accounts SET business_started_at=business_started_at-interval '4 hours' WHERE user_id=$1", [payrollUser]);
  await finish(payrollUser, await task(payrollUser));
  check("A new game day resets available delegated budget", (await read(payrollUser)).cashCents, 96900);

  const reserveUser = await player(); await seed(reserveUser); await rules(reserveUser, { cashReserveCents: 99500 });
  await invoice(reserveUser, 1000); await invoice(reserveUser, 400);
  await finish(reserveUser, await task(reserveUser, 1));
  snapshot = await read(reserveUser);
  check("Reserve skips unaffordable documents, allowing smaller ones", [snapshot.cashCents, snapshot.benefits.invoicesPaidCents, snapshot.benefits.lastAdministration.skippedReason], [99600, 400, "budget-or-reserve"]);
  const cancelledTask = await task(reserveUser);
  await rules(reserveUser, { enabled: false });
  await finish(reserveUser, cancelledTask);
  check("Disabling rules revokes capacity from an already queued task", (await read(reserveUser)).cashCents, 99600);
  await finish(reserveUser, await task(reserveUser));
  check("Disabled rules cannot execute new capacity", (await read(reserveUser)).cashCents, 99600);

  const retroUser = await player(); await seed(retroUser); await rules(retroUser);
  await invoice(retroUser);
  const retroTask = await task(retroUser, .5, { startedAt: "2000-01-01T00:00:00Z" });
  await finish(retroUser, retroTask);
  check("A policy never authorizes a task that started before consent", (await read(retroUser)).cashCents, 100000);
  const future = await invoice(retroUser, 1000, 6);
  await query("UPDATE kq_supplier_invoices SET remaining_cents=0 WHERE user_id=$1 AND id<>$2", [retroUser, future]);
  await finish(retroUser, await task(retroUser));
  snapshot = await read(retroUser);
  check("Supplier horizon uses game days, not real days", [snapshot.cashCents, snapshot.benefits.lastAdministration.skippedReason], [100000, "no-eligible-documents"]);

  const capacityUser = await player(); await seed(capacityUser); await rules(capacityUser);
  const firstDue = await invoice(capacityUser, 200, 1), secondDue = await invoice(capacityUser, 300, 2);
  await finish(capacityUser, await task(capacityUser));
  snapshot = await read(capacityUser);
  check("Half-hour capacity cannot pay two documents", [snapshot.cashCents, snapshot.benefits.lastAdministration.skippedReason], [99800, "capacity-reached"]);
  check("Invoices are paid in deterministic due-date order", await scalar("SELECT jsonb_build_array((SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$1),(SELECT remaining_cents FROM kq_supplier_invoices WHERE id=$2))", [firstDue, secondDue]), [0, 300]);
  const futureTask = await task(capacityUser, .5, { completesAt: "2099-01-01T00:00:00Z" });
  await finish(capacityUser, futureTask);
  check("Claimed completion cannot spend before the task deadline", (await read(capacityUser)).cashCents, 99800);

  const compactUser = await player(); await seed(compactUser); await rules(compactUser);
  snapshot = await read(compactUser);
  const ended = { ...snapshot.state.employees[0], id: randomUUID(), status: "ended", finalPaid: true, endsAt: snapshot.serverNow };
  const endedPayroll = { ...payroll, id: randomUUID(), employeeId: ended.id, dueAt: snapshot.serverNow };
  const activePayroll = { ...payroll, id: randomUUID(), employeeId: snapshot.state.employees[0].id, dueAt: snapshot.serverNow };
  await query("UPDATE kq_staff_accounts SET state=$2::jsonb WHERE user_id=$1", [compactUser, JSON.stringify({ ...empty(snapshot), employees: [...snapshot.state.employees, ended], payroll: [endedPayroll, activePayroll] })]);
  await finish(compactUser, await task(compactUser, 1));
  snapshot = await read(compactUser);
  check("Delegated final payroll allows contract archival without revival", [snapshot.cashCents, snapshot.state.employees.some(e => e.id === ended.id), snapshot.benefits.payrollPaidCount], [96000, false, 2]);
  check("Final payroll is retained by the archive", await scalar("SELECT count(*) FROM kq_staff_archive WHERE user_id=$1 AND kind='payroll'", [compactUser]), 2);

  const backlogUser = await player(); await seed(backlogUser); await rules(backlogUser);
  const template = await task(backlogUser);
  snapshot = await read(backlogUser);
  const backlog = Array.from({ length: 201 }, (_, i) => ({ ...template, id: i === 0 ? template.id : `backlog-${String(i).padStart(3, "0")}` }));
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{tasks}',$2::jsonb) WHERE user_id=$1", [backlogUser, JSON.stringify(backlog)]);
  snapshot = await read(backlogUser);
  await commit(backlogUser, snapshot, { action: "settle" }, { ...empty(snapshot), tasks: backlog.map(t => ({ ...t, status: "completed" })) });
  snapshot = await read(backlogUser);
  check("Completed-task compaction remains bounded", snapshot.state.tasks.length, 200);
  check("Administration receipts include the just-archived backlog task", await scalar("SELECT count(*) FROM kq_staff_benefit_events WHERE user_id=$1 AND kind='administration-task'", [backlogUser]), 201);

  const rollbackUser = await player(); await seed(rollbackUser); await rules(rollbackUser);
  snapshot = await read(rollbackUser);
  await query("UPDATE kq_staff_accounts SET state=jsonb_set(state,'{payroll}',$2::jsonb) WHERE user_id=$1", [rollbackUser, JSON.stringify([{ ...payroll, id: randomUUID(), employeeId: snapshot.state.employees[0].id, dueAt: snapshot.serverNow }])]);
  await invoice(rollbackUser);
  const rollbackTask = await task(rollbackUser, 1);
  await db.exec(`CREATE FUNCTION fixture_benefit_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.kind='supplier-payment' THEN RAISE EXCEPTION 'fixture_late_failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_benefit_failure BEFORE INSERT ON kq_staff_benefit_events FOR EACH ROW EXECUTE FUNCTION fixture_benefit_failure();`);
  await rejectUnchanged("A late failure after payroll and invoice debits rolls everything back", rollbackUser,
    () => finish(rollbackUser, rollbackTask), /fixture_late_failure/);
  await db.exec("DROP TRIGGER fixture_benefit_failure ON kq_staff_benefit_events; DROP FUNCTION fixture_benefit_failure();");
  await finish(rollbackUser, rollbackTask);
  check("A failed transaction does not consume its task authorization", (await read(rollbackUser)).cashCents, 97000);

  for (const alreadyRunning of [false, true]) {
    const weeklyUser = await player(); await seed(weeklyUser); await rules(weeklyUser); await invoice(weeklyUser);
    snapshot = await read(weeklyUser);
    const planAt = new Date(Date.parse(snapshot.serverNow) - 2000).toISOString();
    const taskAt = new Date(Date.parse(snapshot.serverNow) - 1000).toISOString();
    const employee = snapshot.state.employees[0];
    const weekly = { id: `weekly:${employee.id}:${planAt}:1:0`, employeeId: employee.id, kind: "administration", skill: "administration",
      skillLevel: 5, hours: .5, day: 1, startedAt: taskAt, completesAt: snapshot.serverNow, status: "running",
      weeklyPlanAt: planAt, weeklySlot: 0, weeklyCostCents: 0 };
    const plan = { enabled: true, days: [[{ kind: "administration", hours: .5, costCents: 0 }], [], [], [], []],
      nextDay: alreadyRunning ? 2 : 1, updatedAt: planAt, weeklyCostCents: 0, history: [] };
    const initialState = { ...empty(snapshot), employees: [{ ...employee, weeklyPlan: plan }],
      administrationRules: { ...snapshot.state.administrationRules, updatedAt: planAt }, tasks: alreadyRunning ? [weekly] : [] };
    await query("UPDATE kq_staff_accounts SET state=$2::jsonb,benefits_started_at=now()-interval '1 day' WHERE user_id=$1", [weeklyUser, JSON.stringify(initialState)]);
    snapshot = await read(weeklyUser);
    const next = empty(snapshot);
    next.employees[0].weeklyPlan.nextDay = 2;
    next.tasks = [{ ...weekly, status: "completed", result: { version: 1, xpGained: 6 } }];
    await commit(weeklyUser, snapshot, { action: "settle" }, next);
    check(`${alreadyRunning ? "Running" : "Newly materialized"} weekly task completes with result and pays once`, (await read(weeklyUser)).cashCents, 99000);
    snapshot = await read(weeklyUser);
    const tampered = empty(snapshot); tampered.tasks[0].result.xpGained = 999;
    await rejectUnchanged("Completed weekly results cannot be rewritten", weeklyUser,
      () => commit(weeklyUser, snapshot, { action: "settle" }, tampered), /staff_changed/);
  }
  for (const kind of ["culture", "processing"]) {
    const reservationUser = await player(); await seed(reservationUser);
    const reserved = await task(reservationUser, .5, { kind, skill: kind, [`${kind}Shift`]: true, [`${kind}UsedHours`]: 0 });
    snapshot = await read(reservationUser);
    const changed = empty(snapshot); changed.tasks[0].hours = 1;
    await rejectUnchanged(`${kind} booked hours remain immutable`, reservationUser,
      () => commit(reservationUser, snapshot, { action: "settle" }, changed), /culture_work_changed|processing_work_changed/);
    await finish(reservationUser, reserved);
    check(`${kind} reservation can attach its new completion result`, (await read(reservationUser)).state.tasks[0].result.version, 1);
  }

  // Real deltas are recorded at the exact SQL mutation, including caps.
  const metrics = await player(); await seed(metrics);
  await scalar("SELECT rpc_kq_social_v2_read($1,NULL)", [metrics]);
  await query("UPDATE kq_social_platforms SET followers=49990 WHERE user_id=$1 AND platform='instagram'", [metrics]);
  await query("UPDATE kq_online_accounts SET followers=49990 WHERE user_id=$1", [metrics]);
  snapshot = await read(metrics);
  await commit(metrics, snapshot, { action: "settle" }, empty(snapshot), 0,
    [{ kind: "communication", instagramFollowers: 100, reputation: 1 }, { kind: "sales", shopPartners: 1, reputation: 1 }]);
  snapshot = await read(metrics);
  check("Communication records capped real followers and successful partners", [snapshot.benefits.followersGained, snapshot.benefits.partnersGained], [10, 1]);
  await rejectUnchanged("A later rejected effect rolls all earlier metrics back", metrics,
    () => commit(metrics, snapshot, { action: "settle" }, empty(snapshot), 0,
      [{ kind: "sales", shopPartners: 1, reputation: 1 }, { kind: "invalid" }]), /staff_invalid/);
  await query("UPDATE kq_staff_accounts SET state=state||jsonb_build_object('supplierDiscountPercent',6,'supplierDiscountUntil',now()+interval '1 hour') WHERE user_id=$1", [metrics]);
  const discounted = await invoice(metrics, 22000);
  snapshot = await read(metrics);
  check("Savings preserve actual base and invoice net", [snapshot.benefits.supplierBaseCents, snapshot.benefits.supplierSavingsCents, snapshot.benefits.supplierNetCents, snapshot.benefits.discountedInvoices], [22000, 1320, 20680, 1]);
  await query(`INSERT INTO kq_supplier_invoices(run_id,user_id,amount_cents,remaining_cents)
    SELECT run_id,user_id,22000,22000 FROM kq_supplier_invoices WHERE id=$1 ON CONFLICT(run_id) DO NOTHING`, [discounted]);
  check("ON CONFLICT insert cannot invent a second saving", (await read(metrics)).benefits.supplierSavingsCents, 1320);

  const run = randomUUID(), flower = randomUUID();
  await query("INSERT INTO kq_runs(id,user_id,state) VALUES($1,$2,'{\"history\":[]}')", [run, metrics]);
  for (const [stage, source] of [[0, "employee"], [1, "player"]]) await query(`INSERT INTO kq_culture_work_steps
    VALUES($1,$2,$3,now(),repeat('a',32),$4::jsonb,now())`, [run, stage, metrics, JSON.stringify({ paid: true, source, stepHours: .5 })]);
  await query("INSERT INTO kq_flowers VALUES($1,'Fixture')", [flower]);
  await query(`INSERT INTO kq_processing_jobs(flower_id,user_id,route,input_grams,nominal_hours,passive_hours,work,equipment_codes,segments)
    VALUES($1,$2,'dry',1000,2,1,'{}','{}',$3::jsonb)`, [flower, metrics, JSON.stringify([{ source: "employee", bookedHours: 1.5 }])]);
  await query("UPDATE kq_processing_jobs SET segments=segments||$2::jsonb WHERE flower_id=$1", [flower, JSON.stringify([{ source: "player", bookedHours: 1 }, { source: "employee", bookedHours: .5 }])]);
  await query("UPDATE kq_processing_jobs SET segments=segments WHERE flower_id=$1", [flower]);
  await query("INSERT INTO kq_staff_trim_lots(flower_id,user_id) VALUES($1,$2)", [flower, metrics]);
  await query("UPDATE kq_staff_trim_lots SET completed_grams=123.5 WHERE flower_id=$1", [flower]);
  await query("UPDATE kq_staff_trim_lots SET completed_grams=150 WHERE flower_id=$1", [flower]);
  snapshot = await read(metrics);
  check("Delegated culture/processing exclude player work; workshop trim uses real grams", [snapshot.benefits.cultureHoursDelegated, snapshot.benefits.processingHoursDelegated, snapshot.benefits.trimGrams], [.5, 2, 150]);
  const legacyFlower = randomUUID();
  await query("INSERT INTO kq_flowers VALUES($1,'Legacy')", [legacyFlower]);
  await query(`INSERT INTO kq_commerce_batches(flower_id,user_id,processing_started_at,processing_ready_at)
    VALUES($1,$2,now()-interval '1 hour',now()+interval '1 hour'),($3,$2,now()-interval '1 hour',now()+interval '1 hour')`, [legacyFlower, metrics, flower]);
  snapshot = await read(metrics);
  await commit(metrics, snapshot, { action: "settle" }, empty(snapshot), 0,
    [{ kind: "processing", flowerId: legacyFlower, secondsSaved: 600 }, { kind: "processing", flowerId: flower, secondsSaved: 600 }]);
  check("Legacy machine time records actual seconds without accelerating new jobs", (await read(metrics)).benefits.processingSecondsSaved, 600);
  snapshot = await read(metrics);
  const manual = { action: "pay-invoice", employeeId: snapshot.state.employees[0].id, invoiceId: discounted, expectedCents: 20680 };
  await commit(metrics, snapshot, manual, empty(snapshot), 0, [{ kind: "supplier-payment", invoiceId: discounted, amountCents: 20680 }]);
  snapshot = await read(metrics);
  check("Explicit employee invoice payments contribute their actual settled amount", [snapshot.benefits.invoicesPaidCents, snapshot.benefits.invoicesPaidCount], [20680, 1]);
  check("Metrics never leak another player's results", [(await read(other)).benefits.followersGained, (await read(other)).benefits.supplierSavingsCents], [0, 0]);

  for (const role of ["anon", "authenticated", "service_role"]) {
    check(`${role} cannot read or mutate the private evidence ledger`, await scalar("SELECT jsonb_build_array(has_table_privilege($1,'kq_staff_benefit_events','SELECT'),has_table_privilege($1,'kq_staff_benefit_events','INSERT'),has_table_privilege($1,'kq_staff_benefit_events','UPDATE'),has_table_privilege($1,'kq_staff_benefit_events','DELETE'))", [role]), [false, false, false, false]);
    for (const signature of ["kq_staff_benefit_record(uuid,text,text,bigint,numeric,bigint,integer)", "kq_staff_process_administration(uuid,jsonb,jsonb)", "kq_staff_validate_administration(uuid,jsonb,jsonb,integer)", "kq_staff_benefits_snapshot(uuid)"]) {
      check(`${role} cannot execute ${signature}`, await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false);
    }
  }
  check("Evidence ledger has RLS", await scalar("SELECT relrowsecurity FROM pg_class WHERE oid='kq_staff_benefit_events'::regclass"), true);
  check("Staff commit remains server-only", await scalar("SELECT jsonb_build_array(has_function_privilege('service_role','rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)','EXECUTE'),has_function_privilege('anon','rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)','EXECUTE'))"), [true, false]);
  console.log(JSON.stringify({ ok: true, checks: checks.length, details: checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, completedChecks: checks.length, lastCheck: checks.at(-1), error: error.message, where: error.where, position: error.position, query: error.query?.slice(Math.max(0, Number(error.position ?? 1) - 180), Number(error.position ?? 1) + 250) }, null, 2));
  process.exitCode = 1;
} finally { await db.close(); }
