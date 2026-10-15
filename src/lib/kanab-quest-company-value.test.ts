import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
let userId: string;
let serial = 0;
const fixture = "scripts/fixtures/kq-company-valuation-schema.sql";

beforeAll(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
  // Pre-existing ranking tables deliberately have different columns.
  await db.exec(`
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY,production_units INTEGER DEFAULT 1);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY,vat_sales_ttc_cents BIGINT DEFAULT 0);
  `);
  await db.exec(readFileSync(fixture, "utf8"));
  await db.exec(readFileSync(fixture, "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261014000000_kq_company_valuation.sql", "utf8"));
  await db.exec(`
    CREATE FUNCTION public.test_company_value_for_ranking(p_user UUID) RETURNS NUMERIC
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT public.kq_company_net_value(p_user)$$;
    REVOKE ALL ON FUNCTION public.test_company_value_for_ranking(UUID) FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION public.test_company_value_for_ranking(UUID) TO service_role;
  `);
}, 30_000);
beforeEach(async () => {
  userId = `11111111-1111-4111-8111-${String(++serial).padStart(12, "0")}`;
  await db.exec("BEGIN");
  await db.query("INSERT INTO kq_equipment_wallets(user_id) VALUES($1)", [userId]);
});
afterEach(async () => { await db.exec("ROLLBACK"); });
afterAll(async () => { await db?.close(); });

async function value(id = userId) {
  return Number((await db.query<{ value: string }>("SELECT public.kq_company_net_value($1) AS value", [id])).rows[0].value);
}
async function cash(amount: number) {
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1", [userId, amount]);
}
async function asset(input: {
  key: string; cost: number; account?: string; ageHours?: number; lifetimeHours?: number; recognized?: number; retired?: boolean;
}) {
  await db.query(`INSERT INTO kq_treasury_assets(user_id,source_key,account,cost_cents,recognized_cents,starts_at,ends_at,retired_at)
    VALUES($1,$2,$3,$4,$5,now()-$6*interval '1 hour',now()+($7-$6)*interval '1 hour',CASE WHEN $8 THEN now() ELSE NULL END)`,
  [userId, input.key, input.account ?? "equipment", input.cost, input.recognized ?? 0, input.ageHours ?? 0,
    input.lifetimeHours ?? 4320, input.retired ?? false]);
}
async function ledger(kind: string, amount: number, ageHours = 0) {
  return (await db.query<{ id: string }>(`INSERT INTO kq_business_ledger(user_id,kind,amount_cents,occurred_at)
    VALUES($1,$2,$3,now()-$4*interval '1 hour') RETURNING id`, [userId, kind, amount, ageHours])).rows[0].id;
}
async function storage(payload: Record<string, unknown>, ageHours = 0) {
  return (await db.query<{ request_key: string }>(`INSERT INTO kq_storage_requests(user_id,request_key,payload,created_at)
    VALUES($1,gen_random_uuid(),$2,now()-$3*interval '1 hour') RETURNING request_key`, [userId, payload, ageHours])).rows[0].request_key;
}

describe("read-only current company valuation", () => {
  it("returns zero for absent accounts and counts cash before treasury initialization", async () => {
    expect(await value("99999999-9999-4999-8999-999999999999")).toBe(0);
    await cash(35_000);
    expect(await value()).toBe(35_000);
  });

  it("combines every asset category and all outstanding debts without counting VAT twice", async () => {
    await cash(100_000);
    await db.query("INSERT INTO arena_chanvrier_savings_deposits(user_id,balance_cents) VALUES($1,20000)", [userId]);
    await db.query("INSERT INTO kq_crypto_positions VALUES($1,1,2,8000)", [userId]);
    await db.exec("INSERT INTO kq_crypto_quotes VALUES(1,50,now())");
    await db.query("INSERT INTO kq_stock_positions VALUES($1,'TEST',3,4000)", [userId]);
    await db.exec("INSERT INTO kq_stock_quotes VALUES('TEST',20,now())");
    await asset({ key: "machine", cost: 10_000 });
    await db.query("INSERT INTO kq_company_value_test_stock VALUES($1,7000)", [userId]);
    await db.query("INSERT INTO kq_bank_loans(user_id,total_cents,paid_cents) VALUES($1,11000,1000)", [userId]);
    await db.query("INSERT INTO kq_lab_invoices(user_id,remaining_cents) VALUES($1,1000)", [userId]);
    await db.query("INSERT INTO kq_energy_invoices(user_id,remaining_cents) VALUES($1,2000)", [userId]);
    await db.query("INSERT INTO kq_supplier_invoices(user_id,remaining_cents) VALUES($1,3000)", [userId]);
    expect(await value()).toBe(137_000);
    await db.query("INSERT INTO kq_commerce_accounts(user_id,vat_reserved_cents) VALUES($1,5000)", [userId]);
    expect(await value()).toBe(137_000);
  });

  it("conserves value when cash moves into savings or market holdings", async () => {
    await cash(100_000);
    const initial = await value();
    await cash(60_000);
    await db.query("INSERT INTO arena_chanvrier_savings_deposits(user_id,balance_cents) VALUES($1,40000)", [userId]);
    expect(await value()).toBe(initial);
    await db.query("UPDATE arena_chanvrier_savings_deposits SET balance_cents=0 WHERE user_id=$1", [userId]);
    await db.query("INSERT INTO kq_crypto_positions VALUES($1,1,2,40000)", [userId]);
    await db.exec("INSERT INTO kq_crypto_quotes VALUES(1,200,now())");
    expect(await value()).toBe(initial);
    await db.query("UPDATE kq_crypto_positions SET quantity=0,cost_basis_cents=0 WHERE user_id=$1", [userId]);
    await db.query("INSERT INTO kq_stock_positions VALUES($1,'TEST',4,40000)", [userId]);
    await db.exec("INSERT INTO kq_stock_quotes VALUES('TEST',100,now())");
    expect(await value()).toBe(initial);
  });

  it("does not reward borrowing or repayments and retains negative net value", async () => {
    await cash(100_000);
    await cash(150_000);
    await db.query("INSERT INTO kq_bank_loans(user_id,total_cents) VALUES($1,55000)", [userId]);
    expect(await value()).toBe(95_000);
    await cash(130_000);
    await db.query("UPDATE kq_bank_loans SET paid_cents=20000 WHERE user_id=$1", [userId]);
    expect(await value()).toBe(95_000);
    await cash(0);
    expect(await value()).toBe(-35_000);
  });

  it("conserves cash spent on unused care supplies and removes their value when consumed", async () => {
    await cash(10_000);
    const initial = await value();
    await cash(8200);
    await db.query("INSERT INTO kq_care_inventory VALUES($1,'CARE-COMPOST-TEA',2)", [userId]);
    const requestKey = (await db.query<{ request_key: string }>(`INSERT INTO kq_care_purchases
      (user_id,request_key,product_code,quantity,total_price_cents)
      VALUES($1,gen_random_uuid(),'CARE-COMPOST-TEA',2,1800) RETURNING request_key`, [userId])).rows[0].request_key;
    expect(await value()).toBe(initial);
    await db.query(`INSERT INTO kq_care_purchases(user_id,request_key,product_code,quantity,total_price_cents)
      VALUES($1,$2,'CARE-COMPOST-TEA',2,1800) ON CONFLICT DO NOTHING`, [userId, requestKey]);
    expect(await value()).toBe(initial);
    await db.query("UPDATE kq_care_inventory SET quantity=1 WHERE user_id=$1", [userId]);
    expect(await value()).toBe(9100);
    await db.query("UPDATE kq_care_inventory SET quantity=0 WHERE user_id=$1", [userId]);
    expect(await value()).toBe(8200);
    await db.query("INSERT INTO kq_care_inventory VALUES($1,'CARE-SEAWEED',20)", [userId]);
    expect(await value()).toBe(8200);
    await db.query("UPDATE kq_care_inventory SET quantity=20 WHERE user_id=$1 AND product_code='CARE-COMPOST-TEA'", [userId]);
    expect(await value()).toBe(initial);
  });

  it("carries invoiced crop inputs through debt payment and harvest without adding value twice", async () => {
    await cash(10_000);
    const initial = await value();
    const runId = "22222222-2222-4222-8222-222222222222";
    await db.query("INSERT INTO kq_runs(id,user_id,status) VALUES($1,$2,'active')", [runId, userId]);
    await db.query(`INSERT INTO kq_supplier_invoices(user_id,run_id,amount_cents,remaining_cents)
      VALUES($1,$2,4000,4000)`, [userId, runId]);
    expect(await value()).toBe(initial);
    await cash(6000);
    await db.query("UPDATE kq_supplier_invoices SET remaining_cents=0 WHERE user_id=$1", [userId]);
    expect(await value()).toBe(initial);
    await db.query("UPDATE kq_runs SET status='completed' WHERE id=$1", [runId]);
    await db.query("INSERT INTO kq_company_value_test_stock VALUES($1,4000)", [userId]);
    expect(await value()).toBe(initial);
  });

  it("writes off abandoned crop inputs and requires both invoice and run ownership", async () => {
    await cash(6000);
    const runId = "22222222-2222-4222-8222-222222222222";
    await db.query("INSERT INTO kq_runs(id,user_id,status) VALUES($1,$2,'active')", [runId, userId]);
    await db.query(`INSERT INTO kq_supplier_invoices(user_id,run_id,amount_cents,remaining_cents)
      VALUES($1,$2,4000,0)`, [userId, runId]);
    expect(await value()).toBe(10_000);
    await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [runId]);
    expect(await value()).toBe(6000);
    await db.query("UPDATE kq_runs SET status='active',user_id=$2 WHERE id=$1", [runId, "99999999-9999-4999-8999-999999999999"]);
    expect(await value()).toBe(6000);
    await db.query("UPDATE kq_runs SET user_id=$2 WHERE id=$1", [runId, userId]);
    await db.query("UPDATE kq_supplier_invoices SET user_id=$2 WHERE run_id=$1", [runId, "99999999-9999-4999-8999-999999999999"]);
    expect(await value()).toBe(6000);
  });

  it("preserves legacy cash-paid active inputs without duplicating a later supplier invoice", async () => {
    await cash(6000);
    const runId = "22222222-2222-4222-8222-222222222222";
    await db.query("INSERT INTO kq_runs(id,user_id,status) VALUES($1,$2,'active')", [runId, userId]);
    await db.query(`INSERT INTO kq_treasury_journal(user_id,source_key,kind,postings)
      VALUES($1,$2,'warehouse-consumables','[{"account":"expense_other","deltaCents":4000},{"account":"suspense","deltaCents":-4000}]')`,
    [userId, `warehouse-consumables:${runId}`]);
    expect(await value()).toBe(10_000);
    await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [runId]);
    expect(await value()).toBe(6000);
    await db.query("UPDATE kq_runs SET status='active' WHERE id=$1", [runId]);
    await db.query(`INSERT INTO kq_supplier_invoices(user_id,run_id,amount_cents,remaining_cents)
      VALUES($1,$2,4000,0)`, [userId, runId]);
    expect(await value()).toBe(10_000);
  });

  it("uses last known quotes, falls back to cost when unusable, and ignores empty positions", async () => {
    await db.query(`INSERT INTO kq_crypto_positions VALUES
      ($1,1,2,1000),($1,2,3,2345),($1,3,1,5432),($1,4,0,700)`, [userId]);
    await db.exec(`INSERT INTO kq_crypto_quotes VALUES
      (1,7.256,now()-interval '30 days'),(3,1000,now()+interval '1 day'),(4,1000,now())`);
    await db.query("INSERT INTO kq_stock_positions VALUES($1,'A',1.2,100),($1,'B',3,4567),($1,'C',1,1000)", [userId]);
    await db.exec("INSERT INTO kq_stock_quotes VALUES('A',4.1234,now()-interval '30 days'),('C',0,now())");
    expect(await value()).toBe(15_289);
  });

  it("projects depreciation and prepaid consumption without resurrecting retired assets", async () => {
    await asset({ key: "equipment", cost: 10_000, ageHours: 2160 });
    await asset({ key: "website", account: "website", cost: 10_000, ageHours: 720, lifetimeHours: 1440 });
    await asset({ key: "prepaid", account: "prepaid", cost: 12_000, ageHours: 60, lifetimeHours: 120 });
    await asset({ key: "expired", cost: 15_000, ageHours: 5000 });
    await asset({ key: "retired", cost: 900_000, retired: true });
    await asset({ key: "recognized", cost: 10_000, recognized: 8000 });
    await asset({ key: "paid-in-advance", cost: 10_000, ageHours: -24 });
    expect(await value()).toBe(28_000);
    const retired = (await db.query<{ recognized_cents: number }>("SELECT recognized_cents FROM kq_treasury_assets WHERE user_id=$1 AND source_key='equipment'", [userId])).rows[0];
    expect(Number(retired.recognized_cents)).toBe(0);
  });

  it("values modern online improvements once with their 1,440-hour lifetime", async () => {
    await ledger("online-buy-upgrade", 30_000, 720);
    await ledger("online-buy-upgrade", 70_000);
    await ledger("online-upgrade-site", 90_000, 1441);
    await ledger("online-upgrade-site", 90_000, -24);
    await ledger("online-fee", 100_000);
    await ledger("advertising-started", 100_000);
    const capitalized = await ledger("online-upgrade-site", 40_000);
    await asset({ key: `kq_business_ledger:${capitalized}`, account: "website", cost: 40_000, lifetimeHours: 1440 });
    expect(await value()).toBe(125_000);
  });

  it("values legacy standalone storage purchases without using free or bridged inventory", async () => {
    await storage({ action: "buy", containerCode: "CANNATROL", quantity: 1 }, 2160);
    await storage({ action: "buy", methodCode: "STORAGE-GROVE" });
    await storage({ action: "buy", containerCode: "GLASS-1L", quantity: 3 });
    await storage({ action: "assign", methodCode: "STORAGE-CANNATROL" });
    await storage({ action: "buy", containerCode: "UNKNOWN", quantity: 1000 });
    await storage({ action: "buy", containerCode: "GLASS-1L", quantity: 1001 });
    await storage({ action: "buy", methodCode: "STORAGE-CANNATROL" }, 4321);
    expect(await value()).toBe(94_000);
  });

  it("freezes every historical storage price and avoids replay or asset duplicates", async () => {
    const containers: Record<string, number> = {
      "GLASS-1L": 500, "GLASS-2L": 900, "GLASS-3L": 1200, "GROVE-1OZ": 300, "GROVE-1LB": 1500,
      "BOVEDA-1L": 900, "CVAULT-2OZ": 3500, "CVAULT-1LB": 12000, CANNATROL: 180000, "CURTEC-60L": 8550,
    };
    for (const containerCode of Object.keys(containers)) await storage({ action: "buy", containerCode, quantity: 2 });
    const expected = Object.values(containers).reduce((sum, price) => sum + 2 * price, 0);
    expect(await value()).toBe(expected);
    const key = await storage({ action: "buy", methodCode: "STORAGE-BOVEDA" });
    await db.query(`INSERT INTO kq_storage_requests(user_id,request_key,payload)
      VALUES($1,$2,'{"action":"buy","methodCode":"STORAGE-BOVEDA"}') ON CONFLICT DO NOTHING`, [userId, key]);
    expect(await value()).toBe(expected + 4500);
    await asset({ key: `kq_storage_requests:${key}`, cost: 4500, retired: true });
    expect(await value()).toBe(expected);
  });

  it("preserves warehouse conversion basis and never adds loans or ledger transfers as assets", async () => {
    await asset({ key: "opening-equipment:LIGHT", cost: 10_000 });
    await asset({ key: "warehouse:charged-cash", cost: 3000 });
    await ledger("migration-credit", 10_000);
    await ledger("loan-issued", 1_000_000);
    await ledger("savings-movement", 1_000_000);
    expect(await value()).toBe(13_000);
  });

  it("isolates owners and executes within a read-only transaction", async () => {
    await cash(1234);
    await db.query("INSERT INTO arena_chanvrier_savings_deposits(user_id,balance_cents) VALUES($1,9000000)", ["99999999-9999-4999-8999-999999999999"]);
    await db.exec("COMMIT; BEGIN READ ONLY");
    expect(await value()).toBe(1234);
  });

  it("keeps valuation private while allowing the authorized ranking definer to use it", async () => {
    await cash(4321);
    for (const role of ["anon", "authenticated", "service_role"]) {
      const rights = (await db.query<{ execute: boolean; read: boolean }>(`SELECT
        has_function_privilege($1,'public.kq_company_net_value(uuid)','EXECUTE') AS execute,
        has_table_privilege($1,'public.kq_crypto_positions','SELECT') AS read`, [role])).rows[0];
      expect(rights).toEqual({ execute: false, read: false });
    }
    const declaration = (await db.query<{ stable: boolean; definer: boolean }>(`SELECT provolatile='s' AS stable,prosecdef AS definer
      FROM pg_proc WHERE oid='public.kq_company_net_value(uuid)'::REGPROCEDURE`)).rows[0];
    expect(declaration).toEqual({ stable: true, definer: true });
    await db.exec("SET LOCAL ROLE service_role");
    try {
      const result = await db.query<{ value: string }>("SELECT public.test_company_value_for_ranking($1) AS value", [userId]);
      expect(Number(result.rows[0].value)).toBe(4321);
    } finally { await db.exec("RESET ROLE"); }
  });
});
