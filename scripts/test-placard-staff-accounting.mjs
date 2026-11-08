// Production payroll postings and treasury snapshots in isolated PostgreSQL.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { setupStaffDatabase } from "./test-placard-staff.mjs";

const db = new PGlite(), checks = [];
const query = (sql, values = []) => db.query(sql, values);
const scalar = async (sql, values = []) => Object.values((await query(sql, values)).rows[0])[0];
const source = name => readFile(path.resolve("supabase/migrations", name), "utf8");
const section = (text, start, end) => {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Fixture anchors: ${start}`); return text.slice(a, b);
};
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const rejects = async (name, action, pattern) => { await assert.rejects(action, pattern, name); checks.push(name); };
const state = now => ({ version: 1, employees: [], tasks: [], payroll: [], lastSettledAt: now, supplierDiscountPercent: 0, supplierDiscountUntil: null });
const read = user => scalar("SELECT rpc_kq_staff_snapshot($1)", [user]);
const treasury = user => scalar("SELECT rpc_kq_treasury_snapshot($1,'all',0,100)", [user]);
const balances = user => scalar("SELECT jsonb_object_agg(account,balance_cents) FROM kq_treasury_balances WHERE user_id=$1", [user]);
const commit = (user, snapshot, command, next, debit = 0, key = randomUUID()) => scalar(
  "SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,$6,'[]')",
  [user, snapshot.revision, key, JSON.stringify(command), JSON.stringify({ ...next, lastSettledAt: snapshot.serverNow }), debit]);
const row = (now, id = randomUUID()) => ({ id, employeeId: randomUUID(), dueAt: now, grossCents: 1000, employerCents: 700, indemnityCents: 300, totalCents: 2000, paidCents: 0 });

try {
  await setupStaffDatabase(db);
  // Dependencies outside the payroll feature have zero activity in this fixture.
  // The journal, balances_at and complete treasury snapshot are production SQL.
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
  const stock = await source("20260923000800_kq_stock_market.sql");
  await db.exec(section(stock, "CREATE OR REPLACE FUNCTION public.kq_treasury_balances_at", "REVOKE ALL ON FUNCTION public.kq_treasury_balances_at"));
  const supplier = await source("20261012000700_kq_warehouse_supplier_invoices.sql");
  await db.exec(section(supplier, "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_balances_at", "SELECT pg_temp.kq_supplier_patch('public.kq_treasury_stock_cost"));
  const legacy = randomUUID(), user = randomUUID();
  for (const id of [legacy, user]) {
    await query("INSERT INTO auth.users VALUES($1)", [id]);
    await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [id]);
  }
  const old = await read(legacy), legacyRow = { ...row(old.serverNow), paidCents: 500 };
  await commit(legacy, old, { action: "payroll", expectedCents: 500 }, { ...state(old.serverNow), payroll: [legacyRow] }, 500);
  await db.exec(await source("20261107000300_kq_staff_accounting.sql"));
  checks.push("Migration composes with production treasury functions and existing payroll");
  check("Existing partially paid payroll accrues only its remaining debt", await balances(legacy),
    { cash: 99500, opening_equity: -100000, expense_other: 2000, suspense: 0, staff_payable: -1500 });
  check("Legacy debt independent source agrees", (await treasury(legacy)).checks.staffDebtCents, 1500);

  let raw = await read(user);
  const payroll = row(raw.serverNow), due = { ...state(raw.serverNow), payroll: [payroll] }, accrueKey = randomUUID();
  const accrueCommand = { action: "settle" };
  await commit(user, raw, accrueCommand, due, 0, accrueKey);
  check("Unpaid gross salary, employer charges and indemnities are expensed together", await balances(user),
    { cash: 100000, opening_equity: -100000, expense_other: 2000, staff_payable: -2000 });
  let report = await treasury(user);
  check("Independent payroll debt is present in the real treasury snapshot", report.checks.staffDebtCents, 2000);
  check("Closing balances include payable and unchanged cash", [report.closingBalances.staff_payable, report.closingBalances.cash], [-2000, 100000]);
  check("Debt accrual produces no cash outflow", report.series.reduce((sum, point) => sum + point.outflowsCents, 0), 0);
  check("Accrual appears as an expense in the authoritative chart", report.series.reduce((sum, point) => sum + point.expenseCents, 0), 2000);
  check("Payroll receipt retry replays before CAS", (await commit(user, raw, accrueCommand, due, 0, accrueKey)).replayed, true);
  check("Repeated settlement has one payroll accrual", await scalar("SELECT count(*) FROM kq_treasury_journal WHERE user_id=$1 AND kind='staff-issued'", [user]), 1);
  raw = await read(user);
  await commit(user, raw, { action: "settle" }, raw.state);
  check("Unchanged payroll never posts a second charge", (await balances(user)).expense_other, 2000);

  raw = await read(user);
  const partial = { ...raw.state, payroll: [{ ...payroll, paidCents: 600 }] }, payKey = randomUUID(), payCommand = { action: "payroll", expectedCents: 600 };
  await commit(user, raw, payCommand, partial, 600, payKey);
  check("Payment clears debt and suspense without another expense", await balances(user),
    { cash: 99400, opening_equity: -100000, expense_other: 2000, staff_payable: -1400, suspense: 0 });
  await commit(user, raw, payCommand, partial, 600, payKey);
  check("Payment retry never debits twice", (await read(user)).cashCents, 99400);
  report = await treasury(user);
  check("Partial settlement source and balance agree", [report.checks.staffDebtCents, report.closingBalances.staff_payable], [1400, -1400]);
  check("Payment has exactly one cash flow", report.series.reduce((sum, point) => sum + point.outflowsCents, 0), 600);
  check("No unresolved cash counterpart remains", report.unclassified, { transactions: 0, netCents: 0, absoluteCents: 0 });

  raw = await read(user);
  const before = await balances(user), paid = { ...raw.state, payroll: [{ ...payroll, paidCents: 2000 }] };
  await rejects("Debit must equal paid payroll change", () => commit(user, raw, { action: "payroll", expectedCents: 1300 }, paid, 1300), /staff_payroll_changed/);
  await rejects("Settlement cannot pay payroll without cash", () => commit(user, raw, { action: "settle" }, paid), /staff_payroll_changed/);
  await rejects("An unpaid payroll cannot disappear", () => commit(user, raw, { action: "settle" }, { ...raw.state, payroll: [] }), /staff_payroll_changed/);
  await rejects("Accrued amounts cannot be rewritten", () => commit(user, raw, { action: "settle" }, { ...raw.state, payroll: [{ ...partial.payroll[0], grossCents: 900, indemnityCents: 400 }] }), /staff_payroll_changed/);
  check("Rejected changes preserve cash and ledger", await balances(user), before);
  await commit(user, raw, { action: "payroll", expectedCents: 1400 }, paid, 1400);
  report = await treasury(user);
  check("Full payment clears the independent debt", [report.checks.staffDebtCents, report.closingBalances.staff_payable, report.closingBalances.expense_other], [0, 0, 2000]);
  check("No duplicate staff-cost payroll expense is posted", await scalar("SELECT count(*) FROM kq_treasury_journal WHERE user_id=$1 AND kind='staff-cost'", [user]), 0);
  raw = await read(user);
  await commit(user, raw, { action: "settle" }, { ...raw.state, payroll: [] });
  check("Compacting paid history preserves the financial journal", (await balances(user)).expense_other, 2000);
  raw = await read(user);
  await commit(user, raw, { action: "train" }, raw.state, 300);
  check("Training still expenses its actual cost and cash once", await balances(user),
    { cash: 97700, opening_equity: -100000, expense_other: 2300, staff_payable: 0, suspense: 0 });
  raw = await read(legacy);
  await commit(legacy, raw, { action: "payroll", expectedCents: 1500 }, { ...raw.state, payroll: [{ ...legacyRow, paidCents: 2000 }] }, 1500);
  check("Backfilled legacy debt can be paid without a duplicate expense", [(await balances(legacy)).expense_other, (await treasury(legacy)).checks.staffDebtCents], [2000, 0]);
  const absent = randomUUID(), origin = new Date(Date.now() - 250 * 60 * 60 * 1000).toISOString();
  await query("INSERT INTO auth.users VALUES($1)", [absent]);
  await query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [absent]);
  await read(absent);
  await query("SELECT kq_treasury_initialize($1)", [absent]);
  await query("UPDATE kq_treasury_accounts SET started_at=$2 WHERE user_id=$1", [absent, origin]);
  await query("UPDATE kq_treasury_journal SET occurred_at=$2 WHERE user_id=$1 AND kind='opening'", [absent, origin]);
  await query("UPDATE kq_commerce_accounts SET business_started_at=$2 WHERE user_id=$1", [absent, origin]);
  raw = await read(absent);
  const monthly = [120, 240].map(hours => row(new Date(Date.parse(origin) + hours * 60 * 60 * 1000).toISOString()));
  await commit(absent, raw, { action: "settle" }, { ...state(raw.serverNow), payroll: monthly });
  const previousMonth = await scalar("SELECT rpc_kq_treasury_snapshot($1,'previous',0,100)", [absent]);
  const currentMonth = await scalar("SELECT rpc_kq_treasury_snapshot($1,'current',0,100)", [absent]);
  check("Delayed recognition preserves each actual payroll due date", [previousMonth, currentMonth].map(value => value.series.reduce((sum, point) => sum + point.expenseCents, 0)), [2000, 2000]);
  check("Historical closing debt excludes the later payroll", [previousMonth.closingBalances.staff_payable, currentMonth.closingBalances.staff_payable], [-2000, -4000]);
  check("Backdated accrual never withdraws cash", currentMonth.checks.walletCashCents, 100000);
  for (const role of ["anon", "authenticated", "service_role"]) {
    check(`${role} cannot invoke private accounting helpers`, await scalar("SELECT has_function_privilege($1,'kq_staff_debt(uuid)','EXECUTE') OR has_function_privilege($1,'kq_staff_paid_delta(jsonb,jsonb)','EXECUTE')", [role]), false);
  }
  console.log(`Personnel accounting SQL: ${checks.length} checks passed (isolated PGlite).`);
} catch (error) {
  console.error(`Personnel accounting SQL failed after ${checks.length} checks: ${error.message}`);
  if (error.where) console.error(error.where);
  if (error.actual !== undefined) console.error({ actual: error.actual, expected: error.expected });
  process.exitCode = 1;
} finally { await db.close(); }
