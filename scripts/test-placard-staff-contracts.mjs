// Local PostgreSQL checks for contract amendments, lineage and waiting periods.
// Production staff/accounting/archive/weekly SQL is exercised on PGlite's one
// connection: rollback and CAS are covered; lock contention is not simulated.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { setupStaffDatabase } from "./test-placard-staff.mjs";

const db = new PGlite(), checks = [];
const DAY = 14_400_000, MONTH = 30 * DAY;
const query = (sql, values = []) => db.query(sql, values);
const scalar = async (sql, values = []) => Object.values((await query(sql, values)).rows[0])[0];
const migration = name => readFile(path.resolve("supabase/migrations", name), "utf8");
const section = (source, first, last) => {
  const start = source.indexOf(first), end = source.indexOf(last, start + first.length);
  assert(start >= 0 && end > start, `Fixture anchors: ${first}`); return source.slice(start, end);
};
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const iso = ms => new Date(ms).toISOString();
const read = user => scalar("SELECT rpc_kq_staff_snapshot($1)", [user]);
const source = (user, id) => scalar("SELECT rpc_kq_staff_contract_source($1,$2)", [user, id]);
const state = snapshot => structuredClone({ version: 1, employees: [], tasks: [], payroll: [], playerWorkDays: {},
  supplierDiscountPercent: 0, supplierDiscountUntil: null, ...(snapshot.state ?? {}), lastSettledAt: snapshot.serverNow });
const commit = (user, snapshot, command, next, key = randomUUID(), debit = 0, effects = []) => scalar(
  "SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb)",
  [user, snapshot.revision, key, JSON.stringify(command), JSON.stringify(next), debit, JSON.stringify(effects)]);
const stored = user => scalar(`SELECT jsonb_build_object(
 'staff',(SELECT to_jsonb(a) FROM kq_staff_accounts a WHERE user_id=$1),
 'wallet',(SELECT to_jsonb(w) FROM kq_equipment_wallets w WHERE user_id=$1),
 'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_key) FROM kq_staff_receipts r WHERE user_id=$1),
 'archive',(SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,record_id) FROM kq_staff_archive a WHERE user_id=$1),
 'journal',(SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM kq_treasury_journal j WHERE user_id=$1),
 'settlements',(SELECT count(*) FROM test_settlement_observations WHERE user_id=$1))`, [user]);
async function rejectUnchanged(name, user, action, pattern = /staff_contract_|staff_changed|staff_invalid/) {
  const before = await stored(user);
  await assert.rejects(action, pattern, name);
  check(`${name}; transaction unchanged`, await stored(user), before);
}
async function player() {
  const id = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [id]);
  await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [id]);
  await read(id);
  await query("UPDATE kq_commerce_accounts SET business_started_at=now()-interval '2400 hours' WHERE user_id=$1", [id]);
  return id;
}
function employee(snapshot, overrides = {}) {
  const at = Date.parse(snapshot.serverNow), day = Math.floor((at - Date.parse(snapshot.context.businessStartedAt)) / DAY) + 1;
  return { code: "fixture-person", name: "Camille Martin", role: "commercial", trait: "learner", biography: "Profil conservé.", portraitCode: "ines",
    hourlyCents: 1579, classification: 7, skills: { culture: 213, processing: 8099, communication: 415, sales: 1671, administration: 91 }, contracts: ["cdi", "cdd", "seasonal"],
    id: randomUUID(), contract: "cdd", reason: "replacement", weeklyHours: 35,
    hiredAt: iso(at - 2 * MONTH), endsAt: iso(at + MONTH), status: "active", nextPayrollAt: iso(at + MONTH), paidUntil: iso(at),
    grossEarnedCents: 485031, overtimeGrossCents: 1579, finalPaid: false,
    workDays: { [day]: { usedHours: 3.5, extraHours: 1 }, [day - 8]: { usedHours: 7, extraHours: 2 }, 1: { usedHours: 7, extraHours: 3 } },
    leave: [{ id: randomUUID(), startDay: day - 4, endDay: day - 4, days: 1 }], completedTasks: 43,
    weeklyPlan: { enabled: false, days: [[], [], [], [], []], nextDay: day + 1, updatedAt: snapshot.serverNow, weeklyCostCents: 0, history: [] }, ...overrides };
}
async function seed(user, employees, extra = {}) {
  const snapshot = await read(user);
  await query("UPDATE kq_staff_accounts SET state=$2::jsonb WHERE user_id=$1", [user, JSON.stringify({ ...state(snapshot), employees, ...extra })]);
  return read(user);
}
const monthly = (row, hours = row.weeklyHours) => {
  const gross = Math.round(row.hourlyCents * hours * 52 / 12); return gross + Math.round(gross * .35);
};
function amend(snapshot, action, months = 1) {
  const next = state(snapshot), old = next.employees[0], current = structuredClone(old);
  const command = { action, employeeId: old.id, expectedEndsAt: old.endsAt, expectedMonthlyCostCents: monthly(old) };
  if (action === "renew-contract") {
    command.months = months; current.endsAt = iso(Date.parse(old.endsAt) + months * MONTH);
    current.renewals = [...(old.renewals ?? []), { at: snapshot.serverNow, previousEndsAt: old.endsAt, endsAt: current.endsAt }];
  } else Object.assign(current, { contract: "cdi", reason: "permanent", endsAt: null, convertedToCdiAt: snapshot.serverNow });
  next.employees[0] = current;
  return { next, command };
}
function newContract(snapshot, old, action = "rehire", contract = "cdi") {
  const at = Date.parse(snapshot.serverNow), durationMonths = contract === "cdi" ? 0 : 3;
  const currentWeek = Math.floor((Math.floor((at - Date.parse(snapshot.context.businessStartedAt)) / DAY)) / 7);
  const profile = Object.fromEntries(Object.entries(old).filter(([key]) => ["code", "name", "role", "trait", "biography", "portraitCode", "hourlyCents", "classification", "skills", "contracts"].includes(key)));
  const id = randomUUID(), next = state(snapshot), reason = contract === "cdi" ? "permanent" : contract === "cdd" ? "replacement" : "harvest";
  const command = { action, ...(action === "rehire" ? { sourceContractId: old.id } : { candidateCode: old.code }), contract,
    weeklyHours: 35, durationMonths, reason, expectedMonthlyCostCents: monthly(old, 35) };
  const current = { ...structuredClone(profile), id, personId: action === "rehire" ? old.personId ?? old.id : id,
    ...(action === "rehire" ? { previousContractId: old.id } : {}), renewals: [], contract, weeklyHours: 35, reason,
    hiredAt: snapshot.serverNow, endsAt: contract === "cdi" ? null : iso(at + durationMonths * MONTH), status: "active",
    nextPayrollAt: iso(at + MONTH), paidUntil: snapshot.serverNow, grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false,
    workDays: action === "rehire" ? Object.fromEntries(Object.entries(old.workDays).filter(([day]) => Math.floor((Number(day) - 1) / 7) >= currentWeek - 11)) : {},
    leave: [], completedTasks: 0 };
  next.employees.push(current);
  return { next, command, current };
}

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
    CREATE FUNCTION kq_treasury_refresh(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;`);
  const stock = await migration("20260923000800_kq_stock_market.sql"), suppliers = await migration("20261012000700_kq_warehouse_supplier_invoices.sql");
  await db.exec(section(stock, "CREATE OR REPLACE FUNCTION public.kq_treasury_balances_at", "REVOKE ALL ON FUNCTION public.kq_treasury_balances_at"));
  await db.exec(section(suppliers, "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_balances_at", "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_stock_cost"));
  await db.exec(await migration("20261107000300_kq_staff_accounting.sql"));
  const workday = await migration("20261107000500_kq_player_workday.sql");
  await db.exec(section(workday, "CREATE FUNCTION public.kq_player_work_day", "-- Capture the exact current signatures/defaults"));
  await db.exec(await migration("20261107000600_kq_staff_archive.sql"));
  await db.exec(await migration("20261108000200_kq_staff_weekly_plan.sql"));
  const oldCommit = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  await db.exec(await migration("20261108000700_kq_staff_contract_lifecycle.sql"));
  const newCommit = await scalar("SELECT pg_get_functiondef('rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure)");
  check("Migration preserves the composed commit except whitelist and added guard", newCommit
    .replace("'hire','renew-contract','convert-cdi','rehire','assign'", "'hire','assign'")
    .replace("\n PERFORM public.kq_staff_validate_contract_lifecycle(p_user_id,p_command,p_state,p_debit_cents,p_effects);", ""), oldCommit);
  for (const signature of ["kq_staff_contract_rows(uuid)", "kq_staff_contract_source(uuid,text)", "kq_staff_contract_available_at(timestamptz,jsonb)",
    "kq_staff_contract_cooldowns(uuid)", "kq_staff_contract_monthly_cost(integer,integer)", "kq_staff_validate_contract_lifecycle(uuid,jsonb,jsonb,integer,jsonb)"]) {
    check(`Private lifecycle helper ${signature}`, await scalar(`SELECT jsonb_build_array(has_function_privilege('service_role',$1,'EXECUTE'),
      has_function_privilege('anon',$1,'EXECUTE'),has_function_privilege('authenticated',$1,'EXECUTE'))`, [signature]), [false, false, false]);
  }
  check("Source RPC is server only", await scalar(`SELECT jsonb_build_array(has_function_privilege('service_role','rpc_kq_staff_contract_source(uuid,text)','EXECUTE'),
    has_function_privilege('anon','rpc_kq_staff_contract_source(uuid,text)','EXECUTE'),has_function_privilege('authenticated','rpc_kq_staff_contract_source(uuid,text)','EXECUTE'))`), [true, false, false]);
  for (const hourlyCents of [0, 1206, 1218, 1230, 1365, 1379, 1381, 1395, 1410, 1479, 1579, 2445]) {
    for (const weeklyHours of [7, 14, 21, 28, 35]) {
      assert.equal(Number(await scalar("SELECT kq_staff_contract_monthly_cost($1,$2)", [hourlyCents, weeklyHours])), monthly({ hourlyCents, weeklyHours }),
        `Existing engine quote rounding for ${hourlyCents} cents/hour, ${weeklyHours} h/week`);
    }
  }
  checks.push("Monthly quote validation retains JavaScript's actual rounding across all weekly schedules");

  const user = await player(), other = await player();
  let snapshot = await read(user), original = employee(snapshot);
  snapshot = await seed(user, [original]);
  check("Snapshot advertises capability while retaining weekly and trim context", [snapshot.context.contractLifecycleVersion, snapshot.context.weeklyPlanVersion, snapshot.context.trimLots], [1, 1, []]);
  check("New employer has no waiting periods", snapshot.context.contractCooldowns, {});
  const beforeSource = await stored(user);
  check("Owner-scoped source returns exact current contract", await source(user, original.id), original);
  check("Source read has no writes", await stored(user), beforeSource);
  await rejectUnchanged("Another owner cannot fetch the employee", other, () => source(other, original.id), /staff_contract_unavailable/);
  let amendment = amend(snapshot, "renew-contract", 3);
  for (const [name, mutate] of [
    ["XP", row => row.skills.sales++], ["hourly rate", row => row.hourlyCents++], ["leave", row => row.leave = []],
    ["financial accrual", row => row.grossEarnedCents = 0], ["work history", row => row.workDays = {}],
    ["weekly plan", row => row.weeklyPlan.enabled = true], ["person identity", row => row.personId = randomUUID()],
  ]) {
    const forged = structuredClone(amendment.next); mutate(forged.employees[0]);
    await rejectUnchanged(`Renewal cannot rewrite ${name}`, user, () => commit(user, snapshot, amendment.command, forged));
  }
  await rejectUnchanged("Renewal rejects stale expected deadline", user, () => commit(user, snapshot, { ...amendment.command, expectedEndsAt: snapshot.serverNow }, amendment.next));
  await rejectUnchanged("Renewal rejects changed offered monthly cost", user, () => commit(user, snapshot, { ...amendment.command, expectedMonthlyCostCents: 0 }, amendment.next));
  await rejectUnchanged("Renewal requires integer months", user, () => commit(user, snapshot, { ...amendment.command, months: 1.5 }, amendment.next));
  await rejectUnchanged("Renewal has no cash debit", user, () => commit(user, snapshot, amendment.command, amendment.next, randomUUID(), 1));
  const renewalKey = randomUUID(), beforeRenewal = snapshot;
  let renewed = await commit(user, snapshot, amendment.command, amendment.next, renewalKey);
  check("Renewal preserves identity, skills and all accrued work", renewed.state.employees[0], amendment.next.employees[0]);
  let prior = await stored(user);
  check("Renewal receipt replays before obsolete CAS and deadline validation", (await commit(user, beforeRenewal, amendment.command, amendment.next, renewalKey)).replayed, true);
  check("Renewal replay writes nothing", await stored(user), prior);
  snapshot = await read(user); amendment = amend(snapshot, "renew-contract", 12);
  renewed = await commit(user, snapshot, amendment.command, amendment.next);
  check("Second renewal can reach exactly 18 game months", [renewed.state.employees[0].renewals.length,
    (Date.parse(renewed.state.employees[0].endsAt) - Date.parse(original.hiredAt)) / MONTH], [2, 18]);
  snapshot = await read(user); amendment = amend(snapshot, "renew-contract", 1);
  await rejectUnchanged("Third renewal is refused", user, () => commit(user, snapshot, amendment.command, amendment.next));
  const forgedSettle = state(snapshot); forgedSettle.employees = structuredClone(forgedSettle.employees); forgedSettle.employees[0].renewals = [];
  await rejectUnchanged("Settle cannot erase renewal history", user, () => commit(user, snapshot, { action: "settle" }, forgedSettle));
  amendment = amend(snapshot, "convert-cdi");
  const converted = await commit(user, snapshot, amendment.command, amendment.next);
  check("CDI conversion preserves accrued pay, leave, XP and original service date", converted.state.employees[0], amendment.next.employees[0]);
  check("CDI conversion creates no contract-end payroll or bonus", converted.state.payroll, []);

  const seasonal = await player(); snapshot = await read(seasonal);
  const season = employee(snapshot, { contract: "seasonal", reason: "harvest" });
  snapshot = await seed(seasonal, [season]); amendment = amend(snapshot, "renew-contract", 3);
  await commit(seasonal, snapshot, amendment.command, amendment.next);
  snapshot = await read(seasonal); amendment = amend(snapshot, "renew-contract", 1);
  await rejectUnchanged("Seasonal renewal cannot exceed the game's six-month cap", seasonal, () => commit(seasonal, snapshot, amendment.command, amendment.next));
  const expired = await player(); snapshot = await read(expired);
  const past = employee(snapshot, { endsAt: iso(Date.parse(snapshot.serverNow) - 1), finalPaid: false });
  snapshot = await seed(expired, [past]); amendment = amend(snapshot, "renew-contract", 1);
  await rejectUnchanged("Actual server time refuses renewal after expiry", expired, () => commit(expired, snapshot, amendment.command, amendment.next));
  const payday = await player(); snapshot = await read(payday);
  const unpaidBoundary = employee(snapshot, { nextPayrollAt: iso(Date.parse(snapshot.serverNow) - 1) });
  snapshot = await seed(payday, [unpaidBoundary]); amendment = amend(snapshot, "convert-cdi");
  await rejectUnchanged("Payday crossed before amendment forces another persisted settlement", payday,
    () => commit(payday, snapshot, amendment.command, amendment.next), /^error: staff_changed$|^staff_changed$/);
  const rounding = await player(); snapshot = await read(rounding);
  snapshot = await seed(rounding, [employee(snapshot, { hourlyCents: 1410, weeklyHours: 7 })]);
  amendment = amend(snapshot, "renew-contract", 1);
  check("Existing 7-hour quote keeps its one-cent floating-point rounding", amendment.command.expectedMonthlyCostCents, 57739);
  check("Server accepts that exact existing quote when renewing", (await commit(rounding, snapshot, amendment.command, amendment.next)).state.employees[0].endsAt, amendment.next.employees[0].endsAt);

  const origin = Date.parse("2026-01-01T00:00:00.000Z");
  for (const [duration, expectedDay] of [[13, 23], [14, 19], [15, 22], [14.25, 22]]) {
    const row = { contract: "cdd", hiredAt: iso(origin), endsAt: iso(origin + duration * DAY) };
    const available = await scalar("SELECT kq_staff_contract_available_at($1,$2::jsonb)", [iso(origin), JSON.stringify(row)]);
    check(`Waiting period duration ${duration} respects opening days and exclusive end`, Date.parse(available), origin + expectedDay * DAY);
  }
  check("Seasonal predecessor creates no ordinary CDD waiting period", await scalar("SELECT kq_staff_contract_available_at($1,$2::jsonb)",
    [iso(origin), JSON.stringify({ contract: "seasonal", hiredAt: iso(origin), endsAt: iso(origin + 90 * DAY) })]), null);
  const microOrigin = "2026-01-01T00:00:00.000999Z";
  check("Waiting periods use the same millisecond precision as the engine", Date.parse(await scalar("SELECT kq_staff_contract_available_at($1,$2::jsonb)",
    [microOrigin, JSON.stringify({ contract: "cdd", hiredAt: microOrigin, endsAt: iso(origin + 14 * DAY) })])), origin + 19 * DAY);

  const returner = await player(); snapshot = await read(returner);
  const departed = employee(snapshot, { hiredAt: iso(Date.parse(snapshot.serverNow) - 3 * MONTH - DAY), endsAt: iso(Date.parse(snapshot.serverNow) - DAY), status: "ended", finalPaid: true });
  snapshot = await seed(returner, [departed]);
  check("Fully settled former contract is archived", snapshot.state.employees, []);
  check("Archived contract can be fetched with exact experience", await source(returner, departed.id), departed);
  check("Ordinary ended CDD contributes the role's waiting period", Date.parse(snapshot.context.contractCooldowns.commercial) > Date.parse(snapshot.serverNow), true);
  let hire = newContract(snapshot, departed, "rehire", "cdd");
  await rejectUnchanged("Same person cannot return on CDD during waiting period", returner, () => commit(returner, snapshot, hire.command, hire.next), /staff_contract_cooldown/);
  hire = newContract(snapshot, { ...departed, code: "new-candidate-same-post" }, "hire", "seasonal");
  await rejectUnchanged("Fresh candidate cannot bypass post waiting period with seasonal contract", returner, () => commit(returner, snapshot, hire.command, hire.next), /staff_contract_cooldown/);
  hire = newContract(snapshot, { ...departed, code: "new-candidate-same-post" }, "hire", "cdd");
  await rejectUnchanged("Fresh CDD candidate shares the same post waiting period", returner, () => commit(returner, snapshot, hire.command, hire.next), /staff_contract_cooldown/);
  hire = newContract(snapshot, departed);
  for (const [name, mutate] of [["skills", row => row.skills.communication++], ["identity", row => row.name = "Someone else"],
    ["pay grade", row => row.classification++], ["hourly rate", row => row.hourlyCents++], ["work-day fatigue", row => row.workDays = {}],
    ["old leave", row => row.leave = departed.leave], ["old payroll accrual", row => row.grossEarnedCents = departed.grossEarnedCents],
    ["old weekly plan", row => row.weeklyPlan = departed.weeklyPlan], ["task count", row => row.completedTasks = departed.completedTasks]]) {
    const forged = structuredClone(hire.next); mutate(forged.employees.at(-1));
    await rejectUnchanged(`Rehire rejects forged ${name}`, returner, () => commit(returner, snapshot, hire.command, forged));
  }
  const archiveBefore = (await stored(returner)).archive, rehireKey = randomUUID();
  const returned = await commit(returner, snapshot, hire.command, hire.next, rehireKey);
  check("CDI rehire keeps exact profile/XP and resets contract accruals", returned.state.employees[0], hire.current);
  check("Rehire preserves original archive byte values", (await stored(returner)).archive, archiveBefore);
  check("Recent used and extra hours survive rehire, older weeks are pruned", returned.state.employees[0].workDays, hire.current.workDays);
  prior = await stored(returner);
  check("Rehire replay succeeds while the person is already active", (await commit(returner, snapshot, hire.command, hire.next, rehireKey)).replayed, true);
  check("Rehire replay does not clone a second employee", await stored(returner), prior);
  check("Source requested through original contract resolves latest active contract", await source(returner, departed.id), hire.current);
  snapshot = await read(returner);
  const duplicate = newContract(snapshot, departed);
  await rejectUnchanged("Older archived contract cannot branch a person's career", returner, () => commit(returner, snapshot, duplicate.command, duplicate.next), /staff_contract_unavailable/);

  const latest = { ...hire.current, status: "ended", finalPaid: true, skills: { ...hire.current.skills, sales: 1751 } };
  snapshot = await seed(returner, [latest]);
  check("Original contract resolves the latest ended contract after later work", (await source(returner, departed.id)).skills.sales, 1751);
  const nextReturn = newContract(snapshot, latest);
  const twice = await commit(returner, snapshot, nextReturn.command, nextReturn.next);
  check("Second return preserves newest XP and stable person identity", [twice.state.employees[0].skills.sales, twice.state.employees[0].personId, twice.state.employees[0].previousContractId], [1751, departed.id, latest.id]);

  const debtUser = await player(); snapshot = await read(debtUser);
  const owes = employee(snapshot, { contract: "seasonal", reason: "harvest", endsAt: iso(Date.parse(snapshot.serverNow) - DAY), status: "ended", finalPaid: true });
  const due = { id: randomUUID(), employeeId: owes.id, dueAt: owes.endsAt, grossCents: 1000, employerCents: 350, indemnityCents: 0, totalCents: 1350, paidCents: 0 };
  snapshot = await seed(debtUser, [owes], { payroll: [due] });
  hire = newContract(snapshot, owes);
  await rejectUnchanged("Unpaid payroll blocks rehire without losing the former contract", debtUser, () => commit(debtUser, snapshot, hire.command, hire.next));
  const busyUser = await player(); snapshot = await read(busyUser);
  const busy = employee(snapshot, { contract: "seasonal", reason: "harvest", endsAt: iso(Date.parse(snapshot.serverNow) - DAY), status: "ended", finalPaid: true });
  snapshot = await seed(busyUser, [busy], { tasks: [{ id: randomUUID(), employeeId: busy.id, status: "running" }] });
  hire = newContract(snapshot, busy);
  await rejectUnchanged("A former contract's running task must finish before rehire", busyUser, () => commit(busyUser, snapshot, hire.command, hire.next), /staff_contract_unavailable/);

  const afterWaiting = await player(); snapshot = await read(afterWaiting);
  const longGone = employee(snapshot, { hiredAt: iso(Date.parse(snapshot.serverNow) - 200 * DAY), endsAt: iso(Date.parse(snapshot.serverNow) - 110 * DAY), status: "ended", finalPaid: true });
  snapshot = await seed(afterWaiting, [longGone]);
  check("Elapsed waiting period stays as a historical date", Date.parse(snapshot.context.contractCooldowns.commercial) < Date.parse(snapshot.serverNow), true);
  hire = newContract(snapshot, longGone, "rehire", "cdd");
  const fixedReturn = await commit(afterWaiting, snapshot, hire.command, hire.next);
  check("New CDD is allowed after the role's waiting period", [fixedReturn.state.employees[0].contract, fixedReturn.state.employees[0].skills], ["cdd", longGone.skills]);

  const seasonalReturn = await player(); snapshot = await read(seasonalReturn);
  const pastSeason = employee(snapshot, { contract: "seasonal", reason: "harvest", endsAt: iso(Date.parse(snapshot.serverNow) - DAY), status: "ended", finalPaid: true });
  snapshot = await seed(seasonalReturn, [pastSeason]);
  check("Ended seasonal contract does not create a role cooldown", snapshot.context.contractCooldowns, {});
  hire = newContract(snapshot, pastSeason, "rehire", "seasonal");
  check("Seasonal worker can be rehired without ordinary CDD waiting period", (await commit(seasonalReturn, snapshot, hire.command, hire.next)).state.employees[0].skills, pastSeason.skills);

  const fullUser = await player(); snapshot = await read(fullUser);
  const retired = employee(snapshot, { contract: "seasonal", reason: "harvest", endsAt: iso(Date.parse(snapshot.serverNow) - DAY), status: "ended", finalPaid: true });
  await seed(fullUser, [retired]);
  const eight = Array.from({ length: 8 }, (_, index) => employee(snapshot, { code: `working-${index}`, id: randomUUID() }));
  snapshot = await seed(fullUser, eight);
  hire = newContract(snapshot, retired);
  await rejectUnchanged("Rehire cannot exceed eight simultaneous active employees", fullUser, () => commit(fullUser, snapshot, hire.command, hire.next));

  const ordinary = await player(); snapshot = await read(ordinary);
  const newCandidate = employee(snapshot, { code: "fresh-candidate" });
  hire = newContract(snapshot, newCandidate, "hire", "cdd");
  const normalHire = await commit(ordinary, snapshot, hire.command, hire.next);
  check("Ordinary hire remains available with server-confirmed terms", normalHire.state.employees[0], hire.current);
  snapshot = await read(ordinary);
  const originalEmployee = snapshot.state.employees[0];
  const renewTooLong = amend(snapshot, "renew-contract", 16);
  await rejectUnchanged("First renewal cannot cross the 18-month total cap", ordinary, () => commit(ordinary, snapshot, renewTooLong.command, renewTooLong.next));
  const noCdi = { ...originalEmployee, contracts: ["cdd", "seasonal"] };
  snapshot = await seed(ordinary, [noCdi]); amendment = amend(snapshot, "convert-cdi");
  await rejectUnchanged("CDI conversion respects the worker's accepted contracts", ordinary, () => commit(ordinary, snapshot, amendment.command, amendment.next));

  console.log(`Staff contract lifecycle SQL: ${checks.length} checks passed (real staff/accounting/archive/weekly stack, owner-scoped sources and atomic CAS/replay).`);
} catch (error) {
  console.error(error instanceof Error ? { message: error.message, stack: error.stack, position: error.position, where: error.where } : error); process.exitCode = 1;
} finally { await db.close(); }
