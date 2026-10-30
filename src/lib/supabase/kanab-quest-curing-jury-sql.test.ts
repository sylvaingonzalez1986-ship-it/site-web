import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyKqStorageToJury, projectKqStorageLot, type KqStorageLot } from "../kanab-quest-storage";

let db: PGlite;
let serial = 0;
const id = () => `11111111-1111-4111-8111-${String(++serial).padStart(12, "0")}`;
const stats = { appearance: 60, aroma: 60, vigor: 60, mastery: 60, regularity: 60, cannabinoids: 60 };
let historical: { user: string; flower: string; run: string };
let waiting: { user: string; flower: string; run: string };
let oldReady: { user: string; flower: string; run: string };
let oldState: KqStorageLot;
function definition(file: string, name: string) {
  const sql = readFileSync(`supabase/migrations/${file}.sql`, "utf8");
  const start = sql.search(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\(`));
  if (start < 0) throw new Error(`Missing SQL function ${name}`);
  return sql.slice(start, sql.indexOf("$$;", sql.indexOf("AS $$", start)) + 3);
}
async function fixture(status = "available") {
  const user = id(), flower = id(), run = id();
  await db.query("INSERT INTO public.kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,$3,'completed',now())", [run, user,
    { harvestGrams: 100, care: { terpenes: 60, cannabinoidExpression: 60, cannabinoidConversion: 5, cannabinoidOxidation: 0 } }]);
  await db.query(`INSERT INTO public.kq_flowers(id,owner_id,run_id,variety_code,variety_name,battle_stats,status,burned_at)
    VALUES($1,$2,$3,'KANAB-001','Test',$4,$5,CASE WHEN $5='burned' THEN now()-interval '2 days' ELSE NULL END)`, [flower, user, run, stats, status]);
  return { user, flower, run };
}
async function state(flower: string) {
  return (await db.query<{ state: KqStorageLot; revision: number }>("SELECT state,revision::INTEGER FROM public.kq_storage_lots WHERE flower_id=$1", [flower])).rows[0];
}
async function mature(flower: string, hours = 6) {
  await db.query(`UPDATE public.kq_storage_lots SET state=state||jsonb_build_object(
    'harvestedAt',date_trunc('milliseconds',now())-($2*interval '1 hour'),
    'curingStartedAt',date_trunc('milliseconds',now())-($2*interval '1 hour'),
    'lastSettledAt',date_trunc('milliseconds',now())-($2*interval '1 hour'),
    'readyAt',date_trunc('milliseconds',now())-($2*interval '1 hour')+interval '6 hours',
    'postHarvest','{"dryingQualityBonus":0.35,"storageQualityBonus":0.3,"climateQualityBonus":0.25,"containerQualityBonus":0,"aromaRateFactor":60,"chemistryRateFactor":60,"curingBonusWeightedMs":0}'::JSONB)
    WHERE flower_id=$1`, [flower, hours]);
}
async function prepare(user: string, flower: string) {
  return (await db.query<{ result: { battleStats: typeof stats } }>("SELECT public.rpc_kq_prepare_flower_jury($1,$2) AS result", [user, flower])).rows[0].result;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.kq_runs(id UUID PRIMARY KEY,user_id UUID,state JSONB,status TEXT,completed_at TIMESTAMPTZ,started_at TIMESTAMPTZ DEFAULT now(),warehouse_zone_id TEXT);
    CREATE TABLE public.kq_flowers(id UUID PRIMARY KEY,owner_id UUID,run_id UUID,variety_code TEXT,variety_name TEXT,battle_stats JSONB,status TEXT,created_at TIMESTAMPTZ DEFAULT now(),burned_at TIMESTAMPTZ,locked_at TIMESTAMPTZ,quality INTEGER DEFAULT 6);
    CREATE TABLE public.kq_storage_lots(flower_id UUID PRIMARY KEY,user_id UUID,state JSONB,revision BIGINT DEFAULT 1,original_units INTEGER DEFAULT 0,overflow_sold_units INTEGER DEFAULT 0);
    CREATE TABLE public.kq_storage_accounts(user_id UUID PRIMARY KEY,default_method_code TEXT DEFAULT 'STORAGE-GLASS',owned_method_codes TEXT[] DEFAULT ARRAY['STORAGE-GLASS'],capacity_initialized BOOLEAN DEFAULT false);
    CREATE TABLE public.kq_storage_containers(user_id UUID,container_code TEXT,quantity INTEGER,PRIMARY KEY(user_id,container_code));
    CREATE TABLE public.kq_market_lots(flower_id UUID,status TEXT,harvest_grams NUMERIC);
    CREATE TABLE public.kq_commerce_batches(flower_id UUID);
    CREATE TABLE public.kq_commerce_stock(id UUID,flower_id UUID,remaining_units INTEGER,equivalent_units INTEGER,initial_units INTEGER);
    CREATE TABLE public.kq_warehouse_layouts(user_id UUID,state JSONB,revision INTEGER);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID,cash_cents INTEGER);
    CREATE TABLE public.kq_online_listings(user_id UUID,stock_id UUID,remaining_packets INTEGER,format_grams INTEGER);
    CREATE TABLE public.kq_random_battle_queue(flower_id UUID PRIMARY KEY,owner_id UUID UNIQUE,queued_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_battles(id UUID DEFAULT gen_random_uuid(),player_one_id UUID,player_two_id UUID,flower_one_id UUID,flower_two_id UUID,seed INTEGER,status TEXT DEFAULT 'locked',locked_at TIMESTAMPTZ DEFAULT now());
    CREATE FUNCTION public.kq_warehouse_installed_containers(JSONB) RETURNS TABLE(container_code TEXT,quantity INTEGER) LANGUAGE sql AS $$SELECT key,value::INTEGER FROM jsonb_each_text(COALESCE($1->'installed','{}'::JSONB))$$;
    CREATE FUNCTION public.kq_warehouse_storage_capacity_units(UUID,JSONB DEFAULT NULL) RETURNS NUMERIC LANGUAGE sql AS $$SELECT COALESCE(sum(quantity*500),0) FROM public.kq_storage_containers WHERE user_id=$1$$;
    CREATE FUNCTION public.kq_business_sale_preview(UUID,INTEGER) RETURNS JSONB LANGUAGE sql AS $$SELECT jsonb_build_object('netPayoutCents',$2)$$;
    CREATE FUNCTION public.kq_storage_sell_overflow(p_flower UUID,p_automatic BOOLEAN) RETURNS JSONB LANGUAGE plpgsql AS $$
      DECLARE lot public.kq_storage_lots%ROWTYPE; BEGIN
       SELECT * INTO lot FROM public.kq_storage_lots WHERE flower_id=p_flower FOR UPDATE;
       IF NOT FOUND THEN RETURN NULL; END IF;
       RETURN jsonb_build_object('sold',true);
      END $$;
  `);
  for (const [file, names] of [
    ["20261010000200_storage_curing", ["kq_storage_method", "kq_storage_create_lot", "kq_storage_after_verdict"]],
    ["20261010000300_storage_capacity", ["kq_storage_container", "kq_storage_initialize", "kq_storage_remaining", "kq_storage_harvest_units", "kq_storage_allocate", "kq_storage_overflow_offer"]],
    ["20261012000300_kq_warehouse_storage", ["kq_is_warehouse_flower"]],
    ["20261012000500_kq_warehouse_service_zones", ["kq_warehouse_reserved_storage_units", "kq_warehouse_packed_stock_units", "kq_warehouse_pending_shortage_units", "kq_warehouse_validate_service_change", "kq_warehouse_sync_containers"]],
    ["20261018000500_kq_postharvest_quality", ["kq_storage_container_quality_bonus", "kq_storage_settle", "kq_storage_condition"]],
  ] as const) for (const name of names) await db.exec(definition(file, name));
  await db.exec("ALTER FUNCTION public.kq_storage_create_lot(UUID) RENAME TO kq_storage_create_lot_without_capacity");
  await db.exec(definition("20261010000300_storage_capacity", "kq_storage_create_lot"));
  await db.exec(readFileSync("supabase/migrations/20261010000700_storage_curing_six_hours.sql", "utf8"));
  await db.exec(definition("20261012000200_kq_warehouse_run_integration", "kq_validate_warehouse_run_start"));
  await db.exec("ALTER FUNCTION public.kq_validate_warehouse_run_start(UUID,UUID,JSONB) RENAME TO kq_validate_warehouse_run_start_v1");
  await db.exec(definition("20261013000100_kq_zone_cultures", "kq_validate_warehouse_run_start"));
  await db.exec(definition("20260906000200_kq_random_duel_open_matching", "rpc_kq_enqueue_random_battle"));
  // The production allocator already keeps warehouse overflow out of auto-sale.
  await db.exec(`DO $$ DECLARE body TEXT; fragment TEXT; BEGIN
    body:=pg_get_functiondef('public.kq_storage_allocate(uuid,text,boolean)'::REGPROCEDURE);
    fragment:='capacity:=jsonb_build_object(''totalUnits'',total,''allocations'',allocations,''overflowDeadlineAt'',deadline);';
    EXECUTE replace(body,fragment,fragment||' IF public.kq_is_warehouse_flower(p_flower) THEN capacity:=capacity||jsonb_build_object(''automaticOverflowSale'',false,''overflowDeadlineAt'',NULL); END IF;');
    END $$;
    CREATE TRIGGER kq_storage_after_verdict AFTER INSERT OR UPDATE OF status,burned_at ON public.kq_flowers
     FOR EACH ROW WHEN(NEW.status::TEXT='burned' AND NEW.burned_at IS NOT NULL) EXECUTE FUNCTION public.kq_storage_after_verdict();
  `);
  historical = await fixture("burned");
  oldState = (await state(historical.flower)).state;
  waiting = await fixture("locked");
  oldReady = await fixture();
  await db.exec(readFileSync("supabase/migrations/20261029000300_kq_curing_before_jury.sql", "utf8"));
}, 30_000);
afterAll(async () => { await db?.close(); });

describe("SQL harvest → storage → jury lifecycle", () => {
  it("stores a harvested flower immediately, reserves real containers once and gates all status transitions until ready", async () => {
    const f = await fixture();
    const lot = (await state(f.flower)).state;
    expect(lot.preJury).toBe(true);
    expect(Date.parse(lot.readyAt) - Date.parse(lot.curingStartedAt)).toBe(6 * 3_600_000);
    expect(lot.capacity).toMatchObject({ totalUnits: 1000, allocations: [{ containerCode: "GLASS-1L", quantity: 2, storedUnits: 1000 }], automaticOverflowSale: false, overflowDeadlineAt: null });
    await expect(prepare(f.user, f.flower)).rejects.toThrow("kq_curing_required");
    await expect(db.query("UPDATE public.kq_flowers SET status='locked' WHERE id=$1", [f.flower])).rejects.toThrow("kq_curing_required");
    await expect(db.query("UPDATE public.kq_flowers SET status='burned',burned_at=now() WHERE id=$1", [f.flower])).rejects.toThrow("kq_curing_required");
    const shortage = await db.query<{ units: string }>("SELECT public.kq_warehouse_pending_shortage_units($1) AS units", [f.user]);
    expect(Number(shortage.rows[0].units)).toBe(0);
  });
  it("incorporates the exact same acquired quality as TypeScript once, preserving the original harvest and six-hour clock", async () => {
    const f = await fixture();
    await mature(f.flower);
    const original = (await state(f.flower)).state;
    const prepared = await prepare(f.user, f.flower);
    const lot = (await state(f.flower)).state;
    const expected = applyKqStorageToJury(original, stats, Date.parse(lot.juryApplied!.at));
    expect(prepared.battleStats).toEqual(expected.stats);
    expect({ ...lot.juryApplied, at: new Date(lot.juryApplied!.at).toISOString() }).toEqual(expected.lot.juryApplied);
    expect(lot.baseline).toEqual(original.baseline);
    expect(lot.readyAt).toBe(original.readyAt);
    expect(await prepare(f.user, f.flower)).toEqual(prepared);
    expect((await state(f.flower)).state).toEqual(lot);
    await db.query("UPDATE public.kq_flowers SET status='locked' WHERE id=$1", [f.flower]);
    expect((await state(f.flower)).state).toEqual(lot);
  });
  it("gates the actual queue RPC before consuming its queue slot and freezes its jury evidence at entry", async () => {
    const f = await fixture();
    await expect(db.query("SELECT public.rpc_kq_enqueue_random_battle($1,$2)", [f.user, f.flower])).rejects.toThrow("kq_curing_required");
    expect((await db.query("SELECT * FROM public.kq_random_battle_queue WHERE owner_id=$1", [f.user])).rows).toEqual([]);
    await mature(f.flower);
    const result = (await db.query<{ result: { matchStatus: string } }>("SELECT public.rpc_kq_enqueue_random_battle($1,$2) AS result", [f.user, f.flower])).rows[0].result;
    expect(result.matchStatus).toBe("queued");
    expect((await state(f.flower)).state.juryApplied?.stats).toEqual(Object.fromEntries(Object.keys(stats).map(key => [key, 69])));
    expect((await db.query<{ result: { availableFlowerCount: number; curingFlowerCount: number } }>("SELECT public.rpc_kq_jury_readiness($1) AS result", [f.user])).rows[0].result)
      .toEqual({ availableFlowerCount: 0, curingFlowerCount: 0 });
  });
  it("keeps the final jury score authoritative for trade, without curing twice or starting another wait", async () => {
    const f = await fixture();
    await mature(f.flower);
    await prepare(f.user, f.flower);
    const original = (await state(f.flower)).state;
    await db.query("UPDATE public.kq_flowers SET status='burned',burned_at=now() WHERE id=$1", [f.flower]);
    const lot = (await state(f.flower)).state;
    const projection = (await db.query<{ result: { stage: string; qualityDelta: number; conditionScore: number }; time: string }>(
      "SELECT public.kq_storage_condition($1,7.2,date_trunc('milliseconds',now())) AS result,date_trunc('milliseconds',now())::TEXT AS time", [lot])).rows[0];
    expect(projection.result).toMatchObject({ stage: "ready", qualityDelta: 0, conditionScore: 7.2 });
    expect(projectKqStorageLot(lot, Date.parse(projection.time), 7.2).conditionScore).toBe(7.2);
    expect(lot.readyAt).toBe(original.readyAt);
    expect(lot.curingStartedAt).toBe(original.curingStartedAt);
    expect(lot.capacity?.automaticOverflowSale).toBe(true);
    expect(Date.parse(lot.capacity!.overflowDeadlineAt!) - Date.parse(projection.time)).toBeGreaterThan(3_590_000);
  });
  it("blocks both manual and automatic surplus sales before the jury and exposes no premature offer", async () => {
    const f = await fixture();
    await mature(f.flower);
    await db.query("UPDATE public.kq_storage_lots SET state=jsonb_set(state,'{capacity,allocations}','[]') WHERE flower_id=$1", [f.flower]);
    await expect(db.query("SELECT public.kq_storage_sell_overflow($1,false)", [f.flower])).rejects.toThrow("storage_jury_required");
    expect((await db.query<{ result: null }>("SELECT public.kq_storage_sell_overflow($1,true) AS result", [f.flower])).rows[0].result).toBeNull();
    expect((await db.query<{ result: null }>("SELECT public.kq_storage_overflow_offer($1,state,0) AS result FROM public.kq_storage_lots WHERE flower_id=$2", [f.user, f.flower])).rows[0].result).toBeNull();
  });
  it("preserves archived storage, lets already locked historical duels finish and starts available backfill without inventing past exposure", async () => {
    expect((await state(historical.flower)).state).toEqual(oldState);
    expect(await state(waiting.flower)).toBeUndefined();
    await db.query("UPDATE public.kq_flowers SET status='burned',burned_at=now() WHERE id=$1", [waiting.flower]);
    expect((await state(waiting.flower)).state.preJury).toBe(false);
    expect((await state(oldReady.flower)).state).toMatchObject({ preJury: true, exposure: { aromaWeightedMs: 0, chemistryWeightedMs: 0 } });
  });
  it("uses the server maturity clock for readiness and never exposes private preparation helpers", async () => {
    const f = await fixture();
    const readiness = async () => (await db.query<{ result: { availableFlowerCount: number; curingFlowerCount: number } }>("SELECT public.rpc_kq_jury_readiness($1) AS result", [f.user])).rows[0].result;
    expect(await readiness()).toEqual({ availableFlowerCount: 0, curingFlowerCount: 1 });
    await mature(f.flower);
    expect(await readiness()).toEqual({ availableFlowerCount: 1, curingFlowerCount: 0 });
    await expect(prepare(id(), f.flower)).rejects.toThrow("kq_flower_unavailable");
    for (const role of ["anon", "authenticated", "service_role"]) {
      const permission = (await db.query<{ entry: boolean; helper: boolean; readiness: boolean }>(`SELECT
        has_function_privilege($1,'public.rpc_kq_prepare_flower_jury(uuid,uuid)','EXECUTE') AS entry,
        has_function_privilege($1,'public.kq_storage_prepare_jury(uuid,jsonb)','EXECUTE') AS helper,
        has_function_privilege($1,'public.rpc_kq_jury_readiness(uuid)','EXECUTE') AS readiness`, [role])).rows[0];
      expect(permission).toEqual({ entry: role === "service_role", helper: false, readiness: role === "service_role" });
    }
  });
});
