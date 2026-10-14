import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createKqWarehouseStarter, getKqWarehouseQuote, type KqWarehouseState } from "../kanab-quest-warehouse";

let db: PGlite;
let serial = 0;
const starter = createKqWarehouseStarter();
const requestKey = "22222222-2222-4222-8222-222222222222";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),cash_cents INTEGER DEFAULT 1000000,production_units INTEGER DEFAULT 1,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_player_equipment(user_id UUID,tent_number INTEGER,equipment_code TEXT,purchase_price_cents INTEGER,level INTEGER,PRIMARY KEY(user_id,tent_number,equipment_code));
    CREATE TABLE public.kq_equipment_loadouts(user_id UUID,tent_number INTEGER,slot TEXT,equipment_code TEXT);
    CREATE TABLE public.kq_equipment_upgrade_receipts(user_id UUID,price_cents INTEGER,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_production_expansions(user_id UUID,price_cents INTEGER,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_runs(id UUID DEFAULT gen_random_uuid(),user_id UUID,status TEXT);
    CREATE TABLE public.kq_storage_lots(user_id UUID,flower_id UUID);
    CREATE TABLE public.kq_storage_containers(user_id UUID,container_code TEXT,quantity INTEGER);
    CREATE TABLE public.kq_commerce_stock(id UUID,initial_units INTEGER,equivalent_units INTEGER);
    CREATE TABLE public.kq_online_listings(user_id UUID,stock_id UUID,remaining_packets INTEGER,format_grams INTEGER);
    CREATE TABLE public.kq_commerce_accounts(user_id UUID PRIMARY KEY,revision INTEGER DEFAULT 0);
    CREATE TABLE public.test_assets(user_id UUID,source_key TEXT,cost BIGINT);
    CREATE FUNCTION public.kq_storage_remaining(UUID) RETURNS INTEGER LANGUAGE sql AS $$SELECT 2500$$;
    CREATE FUNCTION public.kq_storage_container(TEXT) RETURNS JSONB LANGUAGE sql AS $$SELECT '{"capacityUnits":500}'::JSONB$$;
    CREATE FUNCTION public.rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$BEGIN
      INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING; RETURN '{}'; END$$;
    CREATE FUNCTION public.kq_business_settle(UUID) RETURNS VOID LANGUAGE sql AS $$SELECT$$;
    CREATE FUNCTION public.kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS $$SELECT$$;
    CREATE FUNCTION public.kq_treasury_add_asset(UUID,TEXT,TEXT,TEXT,BIGINT,TIMESTAMPTZ,INTEGER,TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$BEGIN
      INSERT INTO public.test_assets VALUES($1,$2,$5); RETURN $5; END$$;
  `);
  await db.exec(readFileSync("supabase/migrations/20261012000100_kq_warehouse_layouts.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

async function owner() {
  const id = `11111111-1111-4111-8111-${String(++serial).padStart(12, "0")}`;
  await db.query("INSERT INTO auth.users VALUES($1)", [id]);
  await db.query("INSERT INTO public.kq_equipment_wallets(user_id) VALUES($1)", [id]);
  await db.query("INSERT INTO public.kq_player_equipment VALUES($1,1,'OLD-LAMP',10000,2)", [id]);
  await db.query("INSERT INTO public.kq_equipment_upgrade_receipts(user_id,price_cents) VALUES($1,2000)", [id]);
  await db.query("INSERT INTO public.kq_production_expansions(user_id,price_cents) VALUES($1,30000)", [id]);
  await db.query("INSERT INTO public.kq_commerce_accounts(user_id) VALUES($1)", [id]);
  return id;
}

async function initialize(id: string) {
  return (await db.query<{ data: { state: KqWarehouseState | null; revision: number; cashCents: number; migrationCreditCents: number; receipt?: { replayed: boolean } } }>(
    "SELECT public.rpc_kq_warehouse_initialize($1,$2) AS data", [id, starter])).rows[0].data;
}

async function save(id: string, candidate: KqWarehouseState, revision = 1, key = requestKey) {
  const quote = getKqWarehouseQuote(candidate, starter);
  const request = { state: candidate, expectedRevision: revision, expectedCostCents: quote.totalCostCents };
  return (await db.query<{ data: { state: KqWarehouseState; revision: number; cashCents: number; migrationCreditCents: number; receipt: { creditUsedCents: number; chargedCents: number; replayed: boolean } } }>(
    "SELECT public.rpc_kq_warehouse_save($1,$2,$3,$4,$5,$6,$7) AS data", [id, key, request, revision, starter, quote.nextState, quote.totalCostCents])).rows[0].data;
}

describe("warehouse atomic persistence", () => {
  it("archives legacy assets once and converts paid value to non-cash credit", async () => {
    const id = await owner();
    expect(await initialize(id)).toMatchObject({ revision: 1, cashCents: 1_000_000, migrationCreditCents: 42_000 });
    expect(await initialize(id)).toMatchObject({ revision: 1, cashCents: 1_000_000, migrationCreditCents: 42_000 });
    const archived = (await db.query<{ legacy_archive: { equipment: { level: number }[] } }>("SELECT legacy_archive FROM public.kq_warehouse_layouts WHERE user_id=$1", [id])).rows[0];
    expect(archived.legacy_archive.equipment[0].level).toBe(2);
    expect((await db.query("SELECT * FROM public.kq_player_equipment WHERE user_id=$1", [id])).rows).toHaveLength(1);
    await expect(db.query("UPDATE public.kq_warehouse_layouts SET legacy_archive='{}' WHERE user_id=$1", [id])).rejects.toThrow("warehouse_archive_immutable");
    await expect(db.query("UPDATE public.kq_player_equipment SET level=3 WHERE user_id=$1", [id])).rejects.toThrow("warehouse_legacy_equipment_archived");
    await expect(db.query("UPDATE public.kq_equipment_wallets SET production_units=2 WHERE user_id=$1", [id])).rejects.toThrow("warehouse_legacy_equipment_archived");
  });

  it("uses conversion credit first, debits once and capitalizes only newly paid cash", async () => {
    const id = await owner();
    await initialize(id);
    const candidate = { ...starter, zones: starter.zones.map(zone => ({ ...zone, width: 10 })) };
    const quote = getKqWarehouseQuote(candidate, starter);
    const result = await save(id, candidate);
    expect(result.receipt).toMatchObject({ creditUsedCents: 42_000, chargedCents: quote.totalCostCents - 42_000, replayed: false });
    expect(result.cashCents).toBe(1_000_000 - quote.totalCostCents + 42_000);
    expect(await save(id, candidate)).toMatchObject({ cashCents: result.cashCents, revision: 2, receipt: { replayed: true } });
    expect((await db.query<{ cost: number }>("SELECT cost FROM public.test_assets WHERE user_id=$1", [id])).rows.map(row => Number(row.cost))).toEqual([result.receipt.chargedCents]);
    await expect(save(id, { ...candidate, zones: candidate.zones.map(zone => ({ ...zone, name: "Another request" })) })).rejects.toThrow("warehouse_request_mismatch");
  });

  it("rejects stale plans and active cultures without changing cash or issuing receipts", async () => {
    const id = await owner();
    await initialize(id);
    const candidate = { ...starter, zones: starter.zones.map(zone => ({ ...zone, width: 2 })) };
    await expect(save(id, candidate, 2)).rejects.toThrow("warehouse_revision_changed");
    await db.query("INSERT INTO public.kq_runs(user_id,status) VALUES($1,'active')", [id]);
    await expect(save(id, candidate)).rejects.toThrow("warehouse_active_run");
    expect((await db.query("SELECT cash_cents FROM public.kq_equipment_wallets WHERE user_id=$1", [id])).rows).toEqual([{ cash_cents: 1_000_000 }]);
    expect((await db.query("SELECT * FROM public.kq_warehouse_receipts WHERE user_id=$1", [id])).rows).toEqual([]);
  });

  it("postpones conversion of an active legacy culture and reports stock in grams", async () => {
    const id = await owner();
    await db.query("INSERT INTO public.kq_runs(user_id,status) VALUES($1,'active')", [id]);
    await db.query("INSERT INTO public.kq_storage_lots VALUES($1,gen_random_uuid())", [id]);
    expect(await initialize(id)).toMatchObject({ state: null, revision: 0, cashCents: 1_000_000, migrationCreditCents: 0, stockGrams: 250 });
    expect((await db.query("SELECT * FROM public.kq_warehouse_layouts WHERE user_id=$1", [id])).rows).toEqual([]);
  });

  it("denies every API role direct table access and restricts mutations to the service RPC", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const privileges = (await db.query<{ read: boolean; write: boolean }>("SELECT has_table_privilege($1,'public.kq_warehouse_layouts','SELECT') AS read,has_table_privilege($1,'public.kq_warehouse_receipts','INSERT') AS write", [role])).rows[0];
      expect(privileges).toEqual({ read: false, write: false });
      const execute = (await db.query<{ permitted: boolean }>("SELECT has_function_privilege($1,'public.rpc_kq_warehouse_save(uuid,uuid,jsonb,integer,jsonb,jsonb,integer)','EXECUTE') AS permitted", [role])).rows[0];
      expect(execute.permitted).toBe(role === "service_role");
    }
  });
});
