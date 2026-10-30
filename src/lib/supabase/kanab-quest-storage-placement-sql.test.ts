import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createKqStorageLot, settleKqStorageLot, type KqStorageLot } from "../kanab-quest-storage";

let db: PGlite;
let serial = 0;
const requestKey = "22222222-2222-4222-8222-222222222222";
function definition(file: string, name: string) {
  const sql = readFileSync(`supabase/migrations/${file}.sql`, "utf8");
  const start = sql.search(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\(`));
  if (start < 0) throw new Error(`Missing SQL function ${name}`);
  return sql.slice(start, sql.indexOf("$$;", sql.indexOf("AS $$", start)) + 3);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.kq_storage_lots(flower_id UUID PRIMARY KEY,user_id UUID,state JSONB,revision BIGINT DEFAULT 1,remaining INTEGER);
    CREATE TABLE public.kq_storage_requests(user_id UUID,request_key UUID,payload JSONB,PRIMARY KEY(user_id,request_key));
    CREATE TABLE public.kq_storage_containers(user_id UUID,container_code TEXT,quantity INTEGER);
    CREATE TABLE public.kq_warehouse_layouts(user_id UUID PRIMARY KEY,state JSONB);
    CREATE TABLE public.kq_runs(user_id UUID,status TEXT,warehouse_zone_id TEXT);
    CREATE TABLE public.kq_online_listings(user_id UUID,stock_id UUID,remaining_packets INTEGER,format_grams INTEGER);
    CREATE TABLE public.kq_commerce_stock(id UUID,initial_units INTEGER,equivalent_units INTEGER);
    CREATE FUNCTION public.kq_storage_prepare_state(UUID) RETURNS VOID LANGUAGE sql AS $$SELECT$$;
    CREATE FUNCTION public.kq_storage_remaining(UUID) RETURNS INTEGER LANGUAGE sql AS $$SELECT remaining FROM public.kq_storage_lots WHERE flower_id=$1$$;
    CREATE FUNCTION public.kq_storage_snapshot(UUID,BOOLEAN) RETURNS JSONB LANGUAGE sql AS $$SELECT jsonb_build_object('lots',COALESCE(jsonb_agg(state),'[]')) FROM public.kq_storage_lots WHERE user_id=$1$$;
    CREATE FUNCTION public.kq_warehouse_installed_containers(JSONB) RETURNS TABLE(container_code TEXT,quantity INTEGER)
      LANGUAGE sql AS $$SELECT key,value::INTEGER FROM jsonb_each_text($1->'installed')$$;
    CREATE FUNCTION public.kq_warehouse_pending_shortage_units(UUID) RETURNS NUMERIC LANGUAGE sql AS $$
      SELECT COALESCE(sum((a->>'quantity')::NUMERIC),0) FROM public.kq_storage_lots s,LATERAL jsonb_array_elements(s.state->'capacity'->'allocations') a
      WHERE s.user_id=$1 AND a->>'containerCode'='GLASS-2L'$$;
    CREATE FUNCTION public.kq_storage_capacity_before_zone_runs(UUID,TEXT,TEXT,TEXT,INTEGER,UUID,UUID) RETURNS JSONB LANGUAGE sql AS $$SELECT jsonb_build_object('legacyAction',$2)$$;
  `);
  for (const [file, names] of [
    ["20261010000200_storage_curing", ["kq_storage_method"]],
    ["20261010000300_storage_capacity", ["kq_storage_container"]],
    ["20261012000500_kq_warehouse_service_zones", ["kq_warehouse_usable_containers", "kq_warehouse_storage_capacity_units", "kq_warehouse_reserved_storage_units", "kq_warehouse_packed_stock_units", "kq_warehouse_free_service_slots"]],
    ["20261013000100_kq_zone_cultures", ["rpc_kq_storage_capacity_command"]],
    ["20261018000500_kq_postharvest_quality", ["kq_storage_container_quality_bonus", "kq_storage_settle"]],
    ["20261018000700_kq_postharvest_quality_tiers", ["kq_storage_postharvest_lot"]],
  ] as const) for (const name of names) await db.exec(definition(file, name));
  await db.exec("CREATE TRIGGER postharvest BEFORE UPDATE ON public.kq_storage_lots FOR EACH ROW EXECUTE FUNCTION public.kq_storage_postharvest_lot()");
  await db.exec(readFileSync("supabase/migrations/20261029000100_kq_storage_exact_placement.sql", "utf8"));
}, 30_000);
afterAll(async () => { await db?.close(); });

async function fixture() {
  const user = `11111111-1111-4111-8111-${String(++serial).padStart(12, "0")}`;
  const flower = `33333333-3333-4333-8333-${String(serial).padStart(12, "0")}`;
  const other = `44444444-4444-4444-8444-${String(serial).padStart(12, "0")}`;
  const now = Date.now() - 60_000;
  const state = createKqStorageLot({ flowerId: flower, harvestedAt: new Date(now).toISOString(), baseline: {
    varietyCode: "KANAB-001", juryScore: 8, aroma: 80,
    care: { terpenes: 80, cannabinoidExpression: 80, cannabinoidConversion: 5, cannabinoidOxidation: 0 },
  }, capacity: { totalUnits: 501, allocations: [{ containerCode: "GLASS-1L", quantity: 2, storedUnits: 501 }],
    automaticOverflowSale: false, overflowDeadlineAt: null } });
  state.postHarvest = { dryingQualityBonus: .35, storageQualityBonus: .3, climateQualityBonus: .1,
    aromaRateFactor: 75, chemistryRateFactor: 75, containerQualityBonus: 0, curingBonusWeightedMs: 100 };
  await db.query("INSERT INTO public.kq_storage_lots VALUES($1,$2,$3,1,501)", [flower, user, state]);
  const otherState = { ...state, flowerId: other, capacity: { ...state.capacity!, totalUnits: 1, allocations: [{ containerCode: "BOVEDA-1L", quantity: 1, storedUnits: 1 }] } };
  await db.query("INSERT INTO public.kq_storage_lots VALUES($1,$2,$3,1,1)", [other, user, otherState]);
  for (const [code, quantity] of [["GLASS-1L", 2], ["GLASS-2L", 1], ["BOVEDA-1L", 3], ["CANNATROL", 1]]) {
    await db.query("INSERT INTO public.kq_storage_containers VALUES($1,$2,$3)", [user, code, quantity]);
  }
  await db.query("INSERT INTO public.kq_warehouse_layouts VALUES($1,$2)", [user, { serviceZones: [], installed: { "GLASS-1L": 2, "GLASS-2L": 1, "BOVEDA-1L": 3 } }]);
  return { user, flower, other, state, otherState };
}
async function place(user: string, flower: string, container = "BOVEDA-1L", key = requestKey) {
  return (await db.query<{ result: { replayed: boolean } }>("SELECT public.rpc_kq_storage_capacity_command($1,'place',NULL,$2,NULL,$3,$4) AS result", [user, container, flower, key])).rows[0].result;
}
async function lot(flower: string) {
  return (await db.query<{ state: KqStorageLot; revision: number }>("SELECT state,revision::INTEGER FROM public.kq_storage_lots WHERE flower_id=$1", [flower])).rows[0];
}

describe("exact container placement transaction", () => {
  it("reserves the chosen model for all remaining mass and preserves every other lot", async () => {
    const f = await fixture();
    expect(await place(f.user, f.flower)).toMatchObject({ replayed: false });
    const updated = await lot(f.flower);
    expect(updated.revision).toBe(2);
    expect(updated.state.capacity).toEqual({ ...f.state.capacity, allocations: [{ containerCode: "BOVEDA-1L", quantity: 2, storedUnits: 501 }] });
    expect(updated.state.methodCode).toBe("STORAGE-BOVEDA");
    expect(await lot(f.other)).toEqual({ state: f.otherState, revision: 1 });
    expect(updated.state.readyAt).toBe(f.state.readyAt);
    expect(updated.state.curingStartedAt).toBe(f.state.curingStartedAt);
    const settled = settleKqStorageLot(f.state, Date.parse(updated.state.lastSettledAt));
    expect(updated.state.exposure).toEqual(settled.exposure);
    expect(updated.state.postHarvest).toEqual({ ...settled.postHarvest, containerQualityBonus: .15 });
  });

  it("replays without a second change, rejects changed payloads and retains legacy delegation", async () => {
    const f = await fixture();
    await place(f.user, f.flower);
    const first = await lot(f.flower);
    expect(await place(f.user, f.flower)).toMatchObject({ replayed: true });
    expect(await lot(f.flower)).toEqual(first);
    await expect(place(f.user, f.flower, "GLASS-2L")).rejects.toThrow("storage_request_mismatch");
    const legacy = await db.query<{ result: { legacyAction: string } }>("SELECT public.rpc_kq_storage_capacity_command($1,'assign','STORAGE-GLASS',NULL,NULL,$2,$3) AS result", [f.user, f.flower, requestKey]);
    expect(legacy.rows[0].result).toEqual({ legacyAction: "assign" });
  });

  it("rejects a foreign or sold lot and an owned but uninstalled model", async () => {
    const f = await fixture(), stranger = await fixture();
    await expect(place(stranger.user, f.flower)).rejects.toThrow("storage_lot_unavailable");
    await expect(place(f.user, f.flower, "CANNATROL")).rejects.toThrow("storage_container_not_installed");
    await db.query("UPDATE public.kq_storage_lots SET remaining=0 WHERE flower_id=$1", [f.flower]);
    await expect(place(f.user, f.flower)).rejects.toThrow("storage_lot_unavailable");
    expect((await lot(f.flower)).state).toEqual(f.state);
  });

  it("does not share another lot’s partly empty container or fall back to glass", async () => {
    const f = await fixture();
    await db.query("UPDATE public.kq_storage_containers SET quantity=2 WHERE user_id=$1 AND container_code='BOVEDA-1L'", [f.user]);
    await expect(place(f.user, f.flower)).rejects.toThrow("storage_container_capacity");
    expect(await lot(f.flower)).toEqual({ state: f.state, revision: 1 });
    expect(await lot(f.other)).toEqual({ state: f.otherState, revision: 1 });
    // Its own two glass jars remain available to this lot.
    expect(await place(f.user, f.flower, "GLASS-1L")).toMatchObject({ replayed: false });
  });

  it("includes packed stock in the physical capacity check", async () => {
    const f = await fixture();
    await db.query("INSERT INTO public.kq_commerce_stock VALUES($1,1,1)", [f.flower]);
    await db.query("INSERT INTO public.kq_online_listings VALUES($1,$2,1,250)", [f.user, f.flower]);
    await expect(place(f.user, f.flower)).rejects.toThrow("warehouse_service_capacity_in_use");
    expect(await lot(f.flower)).toEqual({ state: f.state, revision: 1 });
  });

  it("rolls back placement, accrued quality and receipt if it consumes space promised to a culture", async () => {
    const f = await fixture();
    await db.query("INSERT INTO public.kq_runs VALUES($1,'active','zone')", [f.user]);
    await expect(place(f.user, f.flower, "GLASS-2L")).rejects.toThrow("warehouse_service_capacity_in_use");
    expect(await lot(f.flower)).toEqual({ state: f.state, revision: 1 });
    expect((await db.query("SELECT * FROM public.kq_storage_requests WHERE user_id=$1", [f.user])).rows).toEqual([]);
  });

  it("restricts the entry point to service_role and keeps the renamed helper private", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const permissions = (await db.query<{ entry: boolean; helper: boolean }>(`SELECT
        has_function_privilege($1,'public.rpc_kq_storage_capacity_command(uuid,text,text,text,integer,uuid,uuid)','EXECUTE') AS entry,
        has_function_privilege($1,'public.kq_storage_capacity_before_placement(uuid,text,text,text,integer,uuid,uuid)','EXECUTE') AS helper`, [role])).rows[0];
      expect(permissions).toEqual({ entry: role === "service_role", helper: false });
    }
  });
});
