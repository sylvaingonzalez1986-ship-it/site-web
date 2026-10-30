import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { KqStorageStockBreakdown } from "../kanab-quest-storage-breakdown";

let db: PGlite;
let serial = 0;
const owner = () => `11111111-1111-4111-8111-${String(++serial).padStart(12, "0")}`;
const empty: KqStorageStockBreakdown = { bulkUnits: 0, bulkProtectedUnits: 0, bulkOverflowUnits: 0, packedUnits: 0, packedActiveUnits: 0, packedPausedUnits: 0, packedOtherUnits: 0, packedPackets: 0 };
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.kq_storage_lots(flower_id UUID PRIMARY KEY,user_id UUID,state JSONB,remaining INTEGER);
    CREATE TABLE public.kq_commerce_stock(id UUID PRIMARY KEY,initial_units INTEGER CHECK(initial_units>0),equivalent_units INTEGER CHECK(equivalent_units>0));
    CREATE TABLE public.kq_online_listings(id UUID DEFAULT gen_random_uuid(),user_id UUID,stock_id UUID REFERENCES public.kq_commerce_stock(id),remaining_packets INTEGER,format_grams INTEGER,status TEXT,packed_quality NUMERIC,created_at TIMESTAMPTZ DEFAULT now(),packaging_code TEXT DEFAULT 'kraft-5');
    CREATE FUNCTION public.kq_storage_remaining(UUID) RETURNS INTEGER LANGUAGE sql AS $$SELECT remaining FROM public.kq_storage_lots WHERE flower_id=$1$$;
    CREATE FUNCTION public.kq_storage_snapshot(UUID,BOOLEAN) RETURNS JSONB LANGUAGE sql AS $$SELECT jsonb_build_object('lots','[]'::JSONB,'capacity',jsonb_build_object('usedUnits',7350),'activeOnly',$2)$$;
    CREATE FUNCTION public.kq_online_packaging_catalog(TEXT) RETURNS JSONB LANGUAGE sql AS $$SELECT '{"protectionRate":1}'::JSONB$$;
  `);
  const onlineSql = readFileSync("supabase/migrations/20261011150000_kq_online_commerce.sql", "utf8");
  const start = onlineSql.indexOf("CREATE FUNCTION public.kq_online_quality(");
  await db.exec(onlineSql.slice(start, onlineSql.indexOf("$$;", onlineSql.indexOf("AS $$", start)) + 3));
  await db.exec(readFileSync("supabase/migrations/20261029000200_kq_storage_stock_breakdown.sql", "utf8"));
}, 30_000);
afterAll(async () => { await db?.close(); });

async function packet(user: string, count: number, status = "active", quality = 8, ratio: [number, number] = [1, 1]) {
  const id = owner();
  await db.query("INSERT INTO public.kq_commerce_stock VALUES($1,$2,$3)", [id, ratio[0], ratio[1]]);
  await db.query("INSERT INTO public.kq_online_listings(user_id,stock_id,remaining_packets,format_grams,status,packed_quality) VALUES($1,$2,$3,5,$4,$5)", [user, id, count, status, quality]);
}
async function bulk(user: string, units: number, protectedUnits: number) {
  await db.query("INSERT INTO public.kq_storage_lots VALUES($1,$2,$3,$4)", [owner(), user, { capacity: { totalUnits: units, allocations: protectedUnits ? [{ storedUnits: protectedUnits }] : [] } }, units]);
}
async function read(user: string) {
  return (await db.query<{ result: { stockBreakdown: KqStorageStockBreakdown; capacity: { usedUnits: number }; activeOnly: boolean } }>("SELECT public.kq_storage_snapshot($1,true) AS result", [user])).rows[0].result;
}

describe("SQL storage stock breakdown", () => {
  it("identifies exactly 735 g of packets with no bulk allocations and keeps the existing capacity contract", async () => {
    const user = owner();
    await packet(user, 147);
    expect(await read(user)).toEqual({ lots: [], capacity: { usedUnits: 7350 }, activeOnly: true, stockBreakdown: { ...empty, packedUnits: 7350, packedActiveUnits: 7350, packedPackets: 147 } });
  });
  it("counts overflow once and splits mixed packets into mutually exclusive pools", async () => {
    const user = owner();
    await bulk(user, 1000, 500);
    await packet(user, 2); await packet(user, 3, "paused"); await packet(user, 4, "closed"); await packet(user, 1, "active", 5);
    await packet(user, 0, "sold-out"); await packet(user, 0, "discarded");
    const result = (await read(user)).stockBreakdown;
    expect(result).toEqual({ bulkUnits: 1000, bulkProtectedUnits: 500, bulkOverflowUnits: 500,
      packedUnits: 500, packedActiveUnits: 100, packedPausedUnits: 150, packedOtherUnits: 250, packedPackets: 10 });
    expect(result.bulkUnits + result.packedUnits).toBe(1500);
  });
  it("handles a curing lot with overflow and no packets without adding the overflow to total bulk twice", async () => {
    const user = owner();
    await bulk(user, 900, 500);
    expect((await read(user)).stockBreakdown).toEqual({ ...empty, bulkUnits: 900, bulkProtectedUnits: 500, bulkOverflowUnits: 400 });
  });
  it("uses exact extraction equivalents while counting real packets and ignores other players", async () => {
    const user = owner(), stranger = owner();
    await packet(user, 1, "paused", 8, [3, 10]);
    await packet(stranger, 147); await bulk(stranger, 1000, 1000);
    const result = (await read(user)).stockBreakdown;
    expect(result.packedUnits).toBeCloseTo(500 / 3);
    expect(result.packedPausedUnits).toBeCloseTo(500 / 3);
    expect(result.packedPackets).toBe(1);
    expect(result.bulkUnits).toBe(0);
  });
  it("does not mislabel a closed shop as empty inventory or infer orders from active status", async () => {
    const user = owner();
    // The listing status is deliberately independent of a shop's subscription.
    await packet(user, 2, "active");
    expect((await read(user)).stockBreakdown.packedActiveUnits).toBe(100);
  });
  it("keeps both snapshot helpers private to the service entry points", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const result = await db.query<{ current: boolean; previous: boolean }>(`SELECT
        has_function_privilege($1,'public.kq_storage_snapshot(uuid,boolean)','EXECUTE') AS current,
        has_function_privilege($1,'public.kq_storage_snapshot_before_stock_breakdown(uuid,boolean)','EXECUTE') AS previous`, [role]);
      expect(result.rows[0]).toEqual({ current: false, previous: false });
    }
  });
});
