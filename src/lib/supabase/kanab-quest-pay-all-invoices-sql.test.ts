import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
let serial = 0;
const id = () => `11111111-1111-4111-8111-${String(++serial).padStart(12, "0")}`;
function definition(file: string, name: string) {
  const sql = readFileSync(`supabase/migrations/${file}.sql`, "utf8");
  const start = sql.search(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\(`));
  if (start < 0) throw new Error(`Missing SQL function ${name}`);
  return sql.slice(start, sql.indexOf("$$;", sql.indexOf("AS $$", start)) + 3);
}
type Receipt = { action: string; paidCents: number; supplierPaidCents: number; labPaidCents: number;
  electricityPaidCents: number; storageClimatePaidCents: number; invoiceCount: number; cashAfterCents: number; replayed: boolean };
async function pay(user: string, expectedCents: number, requestKey = id()) {
  return (await db.query<{ result: Receipt }>("SELECT public.rpc_kq_commerce_command($1,'pay-all-invoices',$2,$3) AS result", [user, { expectedCents }, requestKey])).rows[0].result;
}
async function fixture(cash = 50_000) {
  const user = id();
  await db.query("INSERT INTO auth.users VALUES($1)", [user]);
  await db.query("INSERT INTO public.kq_equipment_wallets(user_id,cash_cents) VALUES($1,$2)", [user, cash]);
  await db.query("INSERT INTO public.kq_commerce_accounts(user_id) VALUES($1)", [user]);
  return user;
}
async function invoice(user: string, family: "supplier" | "lab" | "energy" | "climate", remaining: number, options: { future?: boolean; due?: boolean; total?: number } = {}) {
  const invoiceId = id(), total = options.total ?? remaining;
  const issued = options.future ? "now()+interval '1 day'" : "now()-interval '2 days'";
  if (family === "energy") {
    await db.query(`INSERT INTO public.kq_energy_invoices(run_id,user_id,total_cents,remaining_cents,created_at,dog_care)
      VALUES($1,$2,$3,$4,${issued},'{"totalCents":200}'::JSONB)`, [invoiceId, user, total, remaining]);
  } else if (family === "climate") {
    await db.query(`INSERT INTO public.kq_storage_climate_invoices(id,user_id,amount_cents,remaining_cents,period_started_at,period_ended_at)
      VALUES($1,$2,$3,$4,${issued}-interval '120 hours',${issued})`, [invoiceId, user, total, remaining]);
  } else {
    const table = family === "supplier" ? "kq_supplier_invoices" : "kq_lab_invoices";
    const due = options.due ? "now()-interval '1 day'" : "now()+interval '6 days'";
    await db.query(`INSERT INTO public.${table}(id,run_id,user_id,amount_cents,remaining_cents,issued_at,due_at)
      VALUES($1,$1,$2,$3,$4,${issued},${due})`, [invoiceId, user, total, remaining]);
  }
  return invoiceId;
}
async function snapshot(user: string) {
  const data: Record<string, unknown> = {};
  for (const table of ["kq_equipment_wallets", "kq_commerce_accounts", "kq_supplier_invoices", "kq_lab_invoices", "kq_energy_invoices", "kq_storage_climate_invoices", "kq_commerce_requests", "kq_business_ledger", "kq_treasury_accounts", "kq_treasury_journal", "kq_treasury_balances"]) {
    data[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM public.${table} t WHERE user_id=$1 ORDER BY to_jsonb(t)::TEXT`, [user])).rows;
  }
  return data;
}
async function balances(user: string) {
  return Object.fromEntries((await db.query<{ account: string; amount: number }>("SELECT account,balance_cents::INTEGER AS amount FROM public.kq_treasury_balances WHERE user_id=$1", [user])).rows.map(row => [row.account, row.amount]));
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY,cash_cents INTEGER,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_commerce_accounts(user_id UUID PRIMARY KEY,revision INTEGER DEFAULT 1,vat_reserved_cents INTEGER DEFAULT 1200,vat_paid_cents INTEGER DEFAULT 0,vat_next_settlement_at TIMESTAMPTZ DEFAULT now()-interval '1 day');
    CREATE TABLE public.kq_commerce_requests(user_id UUID,request_key UUID,action TEXT,payload JSONB,receipt JSONB,PRIMARY KEY(user_id,request_key));
    CREATE TABLE public.kq_supplier_invoices(id UUID PRIMARY KEY,run_id UUID,user_id UUID,issued_at TIMESTAMPTZ,due_at TIMESTAMPTZ,amount_cents INTEGER,remaining_cents INTEGER CHECK(remaining_cents>=0),last_paid_at TIMESTAMPTZ,due_processed_at TIMESTAMPTZ);
    CREATE TABLE public.kq_lab_invoices(id UUID PRIMARY KEY,run_id UUID,user_id UUID,issued_at TIMESTAMPTZ,due_at TIMESTAMPTZ,amount_cents INTEGER,remaining_cents INTEGER CHECK(remaining_cents>=0),due_processed_at TIMESTAMPTZ);
    CREATE TABLE public.kq_energy_invoices(run_id UUID PRIMARY KEY,user_id UUID,total_cents INTEGER,remaining_cents INTEGER CHECK(remaining_cents>=0),created_at TIMESTAMPTZ,dog_care JSONB);
    CREATE TABLE public.kq_storage_climate_invoices(id UUID PRIMARY KEY,user_id UUID,period_started_at TIMESTAMPTZ,period_ended_at TIMESTAMPTZ,amount_cents INTEGER,remaining_cents INTEGER CHECK(remaining_cents>=0),last_paid_at TIMESTAMPTZ);
    CREATE TABLE public.kq_business_ledger(id UUID DEFAULT gen_random_uuid(),user_id UUID,kind TEXT,amount_cents BIGINT,occurred_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_treasury_accounts(user_id UUID PRIMARY KEY,started_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_treasury_journal(user_id UUID,source_key TEXT,kind TEXT,reference TEXT,occurred_at TIMESTAMPTZ,postings JSONB,UNIQUE(user_id,source_key));
    CREATE TABLE public.kq_treasury_balances(user_id UUID,account TEXT,balance_cents BIGINT,PRIMARY KEY(user_id,account));
    CREATE FUNCTION public.kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS $$INSERT INTO public.kq_treasury_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING$$;
    CREATE FUNCTION public.kq_treasury_queue(UUID) RETURNS VOID LANGUAGE sql AS $$SELECT$$;
    CREATE FUNCTION public.kq_business_settle(UUID) RETURNS VOID LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'timeline_must_not_run'; END$$;
    CREATE FUNCTION public.rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
      LANGUAGE sql AS $$SELECT jsonb_build_object('legacyAction',p_action,'payload',p_payload)$$;
  `);
  await db.exec(definition("20260911000300_kq_cycle_electricity", "kq_settle_energy").replace("public.kq_settle_energy(", "public.kq_settle_cycle_energy("));
  await db.exec(definition("20260921000200_kq_treasury_accounting", "kq_treasury_post").replace("'lab_payable','energy_payable'", "'lab_payable','supplier_payable','energy_payable'"));
  for (const [file, names] of [
    ["20260921000200_kq_treasury_accounting", ["kq_treasury_pair", "kq_treasury_observe"]],
    ["20261012000700_kq_warehouse_supplier_invoices", ["kq_supplier_invoice_accounting"]],
    ["20261018000600_kq_postharvest_prices_and_climate_billing", ["kq_storage_climate_invoice_accounting", "kq_storage_climate_collect"]],
  ] as const) for (const name of names) await db.exec(definition(file, name));
  await db.exec(`
    CREATE TRIGGER wallet AFTER INSERT OR UPDATE ON public.kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe();
    CREATE TRIGGER laboratory AFTER INSERT OR UPDATE ON public.kq_lab_invoices FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe();
    CREATE TRIGGER energy AFTER INSERT OR UPDATE ON public.kq_energy_invoices FOR EACH ROW EXECUTE FUNCTION public.kq_treasury_observe();
    CREATE TRIGGER supplier BEFORE INSERT OR UPDATE ON public.kq_supplier_invoices FOR EACH ROW EXECUTE FUNCTION public.kq_supplier_invoice_accounting();
    CREATE TRIGGER climate BEFORE INSERT OR UPDATE ON public.kq_storage_climate_invoices FOR EACH ROW EXECUTE FUNCTION public.kq_storage_climate_invoice_accounting();
  `);
  await db.exec(readFileSync("supabase/migrations/20261029000400_kq_pay_all_invoices.sql", "utf8"));
}, 30_000);
afterAll(async () => { await db?.close(); });

describe("all issued invoices in one atomic payment", () => {
  it("pays issued bills including non-due suppliers/lab and counts energy/care/climate exactly once", async () => {
    const user = await fixture();
    await invoice(user, "supplier", 1000);
    await invoice(user, "supplier", 500, { due: true, total: 1000 });
    await invoice(user, "lab", 4500);
    await invoice(user, "energy", 2000);
    await invoice(user, "climate", 600);
    const before = await balances(user);
    expect(await pay(user, 8600)).toEqual({ action: "pay-all-invoices", paidCents: 8600, supplierPaidCents: 1500, labPaidCents: 4500,
      electricityPaidCents: 2600, storageClimatePaidCents: 600, invoiceCount: 5, cashAfterCents: 41400, replayed: false });
    const after = await balances(user);
    expect(after.cash - (before.cash ?? 0)).toBe(-8600);
    expect(after.supplier_payable - before.supplier_payable).toBe(1500);
    expect(after.lab_payable - before.lab_payable).toBe(4500);
    expect(after.energy_payable - before.energy_payable).toBe(2600);
    expect(after.expense_other).toBe(before.expense_other);
    expect(after.expense_lab).toBe(before.expense_lab);
    expect(after.expense_energy).toBe(before.expense_energy);
    expect(after.suspense - (before.suspense ?? 0)).toBe(0);
    const account = (await db.query<{ vat_reserved_cents: number; vat_paid_cents: number }>("SELECT vat_reserved_cents,vat_paid_cents FROM public.kq_commerce_accounts WHERE user_id=$1", [user])).rows[0];
    expect(account).toEqual({ vat_reserved_cents: 1200, vat_paid_cents: 0 });
  });
  it("rejects insufficient cash and changed totals without touching invoices, cash, accounting or the replay journal", async () => {
    const user = await fixture(999);
    await invoice(user, "supplier", 1000);
    const before = await snapshot(user);
    await expect(pay(user, 1000)).rejects.toThrow("commerce_invoices_cash");
    expect(await snapshot(user)).toEqual(before);
    await expect(pay(user, 999)).rejects.toThrow("commerce_invoices_changed");
    expect(await snapshot(user)).toEqual(before);
  });
  it("replays the original receipt before any new bill or debit and rejects reusing its key with a different confirmation", async () => {
    const user = await fixture(), key = id();
    await invoice(user, "lab", 4500);
    const receipt = await pay(user, 4500, key);
    await invoice(user, "supplier", 900);
    const before = await snapshot(user);
    expect(await pay(user, 4500, key)).toEqual({ ...receipt, replayed: true });
    expect(await snapshot(user)).toEqual(before);
    await expect(pay(user, 900, key)).rejects.toThrow("commerce_request_mismatch");
    expect(await snapshot(user)).toEqual(before);
  });
  it("rolls back earlier debits, paid invoices and accounting if a later invoice update fails", async () => {
    const user = await fixture(), key = id();
    await invoice(user, "supplier", 1000);
    await invoice(user, "lab", 4500);
    await invoice(user, "energy", 2000);
    await invoice(user, "climate", 600);
    const before = await snapshot(user);
    await db.exec(`
      CREATE FUNCTION public.test_interrupt_invoice_payment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF (SELECT cash_cents FROM public.kq_equipment_wallets WHERE user_id=NEW.user_id) <> 47400 THEN
          RAISE EXCEPTION 'expected_energy_and_climate_to_be_paid_first';
        END IF;
        RAISE EXCEPTION 'invoice_payment_interrupted_after_debit';
      END $$;
      CREATE TRIGGER interrupt_invoice_payment BEFORE UPDATE ON public.kq_lab_invoices
      FOR EACH ROW EXECUTE FUNCTION public.test_interrupt_invoice_payment();
    `);
    try {
      await expect(pay(user, 8100, key)).rejects.toThrow("invoice_payment_interrupted_after_debit");
      expect(await snapshot(user)).toEqual(before);
    } finally {
      await db.exec("DROP TRIGGER interrupt_invoice_payment ON public.kq_lab_invoices; DROP FUNCTION public.test_interrupt_invoice_payment();");
    }
    expect(await pay(user, 8100, key)).toMatchObject({ paidCents: 8100, cashAfterCents: 41900, replayed: false });
  });
  it("leaves future invoices, zero balances, other players and future consumption untouched", async () => {
    const user = await fixture(), stranger = await fixture();
    for (const family of ["supplier", "lab", "energy", "climate"] as const) {
      await invoice(user, family, 700, { future: true });
      await invoice(user, family, 0, { total: 500 });
      await invoice(stranger, family, 800);
    }
    await invoice(user, "energy", 1200);
    await invoice(user, "climate", 200);
    const foreignBefore = await snapshot(stranger);
    expect(await pay(user, 1400)).toMatchObject({ paidCents: 1400, electricityPaidCents: 1400, storageClimatePaidCents: 200, invoiceCount: 2 });
    for (const table of ["kq_supplier_invoices", "kq_lab_invoices", "kq_energy_invoices", "kq_storage_climate_invoices"]) {
      expect(Number((await db.query<{ amount: string }>(`SELECT sum(remaining_cents) AS amount FROM public.${table} WHERE user_id=$1`, [user])).rows[0].amount)).toBe(700);
    }
    expect(await snapshot(stranger)).toEqual(foreignBefore);
  });
  it("includes every issued invoice beyond the UI history limits and allows spending exactly the available cash", async () => {
    const user = await fixture(1800);
    for (let count = 0; count < 45; count++) {
      for (const family of ["supplier", "lab", "energy", "climate"] as const) await invoice(user, family, 10);
    }
    expect(await pay(user, 1800)).toMatchObject({ paidCents: 1800, supplierPaidCents: 450, labPaidCents: 450,
      electricityPaidCents: 900, storageClimatePaidCents: 450, invoiceCount: 180, cashAfterCents: 0 });
  });
  it("validates confirmation bounds and empty totals without overflow and preserves legacy delegation and permissions", async () => {
    const user = await fixture();
    for (const expectedCents of [0, -1, 1.5, 2147483648]) await expect(pay(user, expectedCents)).rejects.toThrow("commerce_invalid_request");
    await expect(pay(user, 1)).rejects.toThrow("commerce_invoices_changed");
    await invoice(user, "supplier", 2147483647);
    await invoice(user, "lab", 2147483647);
    await expect(pay(user, 2147483647)).rejects.toThrow("commerce_invoices_changed");
    const legacy = (await db.query<{ result: { legacyAction: string; payload: unknown } }>("SELECT public.rpc_kq_commerce_command($1,'pay-lab',$2,$3) AS result", [user, { invoiceId: id() }, id()])).rows[0].result;
    expect(legacy.legacyAction).toBe("pay-lab");
    for (const role of ["anon", "authenticated", "service_role"]) {
      const grants = (await db.query<{ entry: boolean; helper: boolean }>(`SELECT
        has_function_privilege($1,'public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)','EXECUTE') AS entry,
        has_function_privilege($1,'public.kq_commerce_command_before_invoice_batch(uuid,text,jsonb,uuid)','EXECUTE') AS helper`, [role])).rows[0];
      expect(grants).toEqual({ entry: role === "service_role", helper: false });
    }
  });
});
