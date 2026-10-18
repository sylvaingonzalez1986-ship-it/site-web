import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calculateKqBusinessDevelopment, type KqBusinessDevelopmentScore } from "./kanab-quest-development";

describe("uncapped company cultivation, seasonal turnover and reputation", () => {
  it("starts at zero and ignores invalid inputs", () => {
    expect(calculateKqBusinessDevelopment({})).toEqual({ score: 0, production: 0, sales: 0, reputation: 0,
      productionAreaM2: 0, salesHtCents: 0, reputationPoints: 0 });
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateKqBusinessDevelopment({ productionAreaM2: value, salesHtCents: value, reputationPoints: value }).score).toBe(0);
    }
  });

  it("gives the reference company 27 + 36 + 27 points", () => {
    expect(calculateKqBusinessDevelopment({ productionAreaM2: 50, salesHtCents: 1_000_000, reputationPoints: 600 }))
      .toEqual({ score: 90, production: 27, sales: 36, reputation: 27, productionAreaM2: 50,
        salesHtCents: 1_000_000, reputationPoints: 600 });
  });

  it("continues beyond every previous cap, with diminishing gains", () => {
    const reference = calculateKqBusinessDevelopment({ productionAreaM2: 50, salesHtCents: 1_000_000, reputationPoints: 600 });
    const large = calculateKqBusinessDevelopment({ productionAreaM2: 500, salesHtCents: 100_000_000, reputationPoints: 6000 });
    expect(large).toMatchObject({ score: 426.5, production: 93.4, sales: 239.7, reputation: 93.4 });
    expect(large.production).toBeGreaterThan(60);
    expect(large.sales).toBeGreaterThan(80);
    expect(large.reputation).toBeGreaterThan(60);
    expect(large.score).toBeGreaterThan(200);
    expect(calculateKqBusinessDevelopment({ productionAreaM2: 100 }).production - reference.production).toBeLessThan(reference.production);
    expect(calculateKqBusinessDevelopment({ salesHtCents: 2_000_000 }).sales - reference.sales).toBeLessThan(reference.sales);
    expect(calculateKqBusinessDevelopment({ reputationPoints: 1200 }).reputation - reference.reputation).toBeLessThan(reference.reputation);
  });

  it("sums rounded components and responds to lost reputation", () => {
    expect(calculateKqBusinessDevelopment({ productionAreaM2: 100, salesHtCents: 10_000_000, reputationPoints: 1500 }))
      .toMatchObject({ score: 216.1, production: 42.8, sales: 124.5, reputation: 48.8 });
    expect(calculateKqBusinessDevelopment({ productionAreaM2: 50, salesHtCents: 1_000_000, reputationPoints: 60 }).score).toBe(66.7);
    expect(calculateKqBusinessDevelopment({ productionAreaM2: 0.81 }).production).toBe(0.6);
  });
});

describe("authoritative company scoring in PostgreSQL", () => {
  let db: PGlite;
  const userId = "11111111-1111-4111-8111-111111111111";
  const asOf = "2026-10-18T12:00:00Z";
  const season = "KQ-2026-S1";
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      SET timezone = 'UTC';
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY,reputation INTEGER DEFAULT 0);
      CREATE TABLE public.kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,status TEXT DEFAULT 'active',
        state JSONB,started_at TIMESTAMPTZ,completed_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
      CREATE TABLE public.kq_market_sale_receipts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_id UUID,
        payout_cents INTEGER,vat_cents INTEGER,created_at TIMESTAMPTZ,sales_channel TEXT);
      CREATE TABLE public.kq_seasons(season_code TEXT PRIMARY KEY,status TEXT,starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,activated_at TIMESTAMPTZ,closed_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE public.kq_rank_profiles(user_id UUID PRIMARY KEY,season_code TEXT,rating INTEGER DEFAULT 900,
        season_points INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,losses INTEGER DEFAULT 0);
      CREATE TABLE public.contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT);
      CREATE TABLE public.kq_leaderboard_snapshots(season_code TEXT,snapshot_date DATE,generated_at TIMESTAMPTZ);
      REVOKE ALL ON public.kq_equipment_wallets,public.kq_runs,public.kq_market_sale_receipts,public.kq_seasons,
        public.kq_rank_profiles,public.contest_profiles FROM PUBLIC,anon,authenticated,service_role;
      CREATE FUNCTION public.kq_business_development_score(p_user_id UUID) RETURNS JSONB
        LANGUAGE sql AS $$ SELECT '{"score":0}'::JSONB $$;
      -- Isolate the exact legacy call sites without unrelated bootstrap state.
      CREATE FUNCTION public.rpc_kq_refresh_daily_leaderboard(p_season_code TEXT) RETURNS JSONB
        LANGUAGE sql AS $$ SELECT jsonb_build_object('businessScore',
          (public.kq_business_development_score(profile.user_id)->>'score')::INTEGER)
          FROM public.kq_rank_profiles profile WHERE season_code=p_season_code LIMIT 1 $$;
      CREATE FUNCTION public.rpc_kq_player_core_snapshot(p_user_id UUID) RETURNS JSONB
        LANGUAGE sql AS $$ SELECT jsonb_build_object('businessScore',
          (public.kq_business_development_score(profile.user_id)->>'score')::INTEGER)
          FROM public.kq_rank_profiles profile WHERE user_id=p_user_id $$;
      CREATE FUNCTION public.rpc_kq_get_arena_leaderboard(p_season_code TEXT,p_force_refresh BOOLEAN DEFAULT false) RETURNS JSONB
        LANGUAGE sql AS $$ SELECT jsonb_build_object('businessScore',
          (public.kq_business_development_score(rank_profile.user_id)->>'score')::INTEGER)
          FROM public.kq_rank_profiles rank_profile WHERE season_code=p_season_code LIMIT 1 $$;
    `);
    const units = readFileSync("supabase/migrations/20261011120100_kq_gradual_production_expansion.sql", "utf8");
    await db.exec(units.slice(units.indexOf("CREATE OR REPLACE FUNCTION public.kq_run_production_units"), units.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_expand_production")));
    const tents = readFileSync("supabase/migrations/20260924000300_kq_individual_tents.sql", "utf8");
    await db.exec(tents.slice(tents.indexOf("CREATE FUNCTION public.kq_run_tents"), tents.indexOf("CREATE OR REPLACE FUNCTION public.kq_guard_culture_equipment_loadout")));
    await db.exec(readFileSync("supabase/migrations/20261018000100_arena_category_rankings.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261018000200_kq_business_score_v3.sql", "utf8"));
  }, 30_000);
  beforeEach(async () => {
    await db.exec("TRUNCATE public.kq_equipment_wallets,public.kq_runs,public.kq_market_sale_receipts,public.kq_seasons,public.kq_rank_profiles,public.contest_profiles");
    await db.query("INSERT INTO public.kq_seasons(season_code,status,starts_at,activated_at) VALUES($1,'active','2026-10-01','2026-10-02')", [season]);
    await db.query("INSERT INTO public.kq_equipment_wallets(user_id) VALUES($1)", [userId]);
  });
  afterAll(async () => { await db?.close(); });

  async function score(at = asOf, requestedSeason = season) {
    return (await db.query<{ value: KqBusinessDevelopmentScore & { calculatedAt: string; seasonStartedAt: string } }>(
      "SELECT public.kq_business_development_score_for_season($1,$2,$3) AS value", [userId, requestedSeason, at])).rows[0].value;
  }
  async function run(area: number, from: string, to: string | null = null, zone = "a", status = to ? "completed" : "active") {
    await db.query("INSERT INTO public.kq_runs(user_id,status,state,started_at,completed_at,updated_at) VALUES($1,$2,$3,$4,$5,$6)",
      [userId, status, { warehouse: { version: 2, zoneId: zone, activeAreaM2: area } }, from,
        status === "completed" ? to : null, to ?? from]);
  }
  async function receipt(ttc: number, vat: number, at: string, channel = "wholesale") {
    await db.query("INSERT INTO public.kq_market_sale_receipts(owner_id,payout_cents,vat_cents,created_at,sales_channel) VALUES($1,$2,$3,$4,$5)",
      [userId, ttc, vat, at, channel]);
  }

  it("matches the reference, large company and fractional formulas", async () => {
    expect(await score()).toMatchObject(calculateKqBusinessDevelopment({}));
    for (const [area, salesHtCents, reputationPoints] of [[50, 1_000_000, 600], [500, 100_000_000, 6000], [0.81, 123_456, 321]]) {
      await db.exec("TRUNCATE public.kq_runs,public.kq_market_sale_receipts");
      await run(area, "2026-09-18T12:00:00Z");
      await receipt(salesHtCents, 0, "2026-10-02");
      await db.query("UPDATE public.kq_equipment_wallets SET reputation=$1", [reputationPoints]);
      expect(await score()).toMatchObject(calculateKqBusinessDevelopment({ productionAreaM2: area, salesHtCents, reputationPoints }));
    }
  });

  it("integrates only elapsed cultivation inside 30 days and retains recent harvested area", async () => {
    await run(60, "2026-09-01T12:00:00Z", "2026-10-03T12:00:00Z"); // 15 / 30 days
    await run(30, "2026-10-08T12:00:00Z", null, "b"); // 10 / 30 days
    await run(1000, "2026-08-01", "2026-09-18T12:00:00Z", "old");
    await run(1000, "2026-10-19", null, "future");
    expect(await score()).toMatchObject(calculateKqBusinessDevelopment({ productionAreaM2: 40 }));
    // Completing a run does not suddenly erase the last 30 days of cultivation.
    await db.exec("UPDATE public.kq_runs SET status='completed',completed_at='2026-10-18T12:00:00Z' WHERE state->'warehouse'->>'zoneId'='b'");
    expect((await score()).productionAreaM2).toBe(40);
  });

  it("unions overlaps within one zone while adding concurrent distinct zones", async () => {
    await run(30, "2026-09-18T12:00:00Z", "2026-10-08T12:00:00Z");
    await run(30, "2026-09-28T12:00:00Z", null);
    await run(60, "2026-10-03T12:00:00Z", null, "b");
    expect((await score()).productionAreaM2).toBe(60);
  });

  it("stops failed cultures at their terminal update and ignores missing area history", async () => {
    await run(30, "2026-10-03T12:00:00Z", "2026-10-08T12:00:00Z", "dead", "abandoned");
    await db.query("INSERT INTO public.kq_runs(user_id,state,started_at,updated_at) VALUES($1,'{}','2026-09-01','2026-09-01')", [userId]);
    expect((await score()).productionAreaM2).toBe(5);
  });

  it("reads frozen legacy tent sizes and whole-warehouse snapshots", async () => {
    for (const [state, expectedArea] of [
      [{ equipment: { productionUnits: 2, codes: ["TENT-120", "LED-300", "AIR-STARTER"] } }, 2.88],
      [{ equipment: { productionUnits: 2, tents: [
        { tentNumber: 1, codes: ["TENT-080-STARTER", "LED-150-STARTER", "AIR-STARTER"] },
        { tentNumber: 2, codes: ["TENT-150", "LED-300", "AIR-STARTER"] },
      ] } }, 3.06],
      [{ warehouse: { version: 1, activeAreaM2: 100 }, equipment: { codes: ["TENT-150"] } }, 100],
    ] as const) {
      await db.exec("TRUNCATE public.kq_runs");
      await db.query("INSERT INTO public.kq_runs(user_id,state,started_at,updated_at) VALUES($1,$2,'2026-09-18T12:00:00Z','2026-09-18T12:00:00Z')", [userId, state]);
      expect((await score()).productionAreaM2).toBe(expectedArea);
    }
  });

  it("counts only settled receipt HT in the requested season, across all channels", async () => {
    await receipt(12000, 2000, "2026-09-30T23:59:59Z"); // outside the season
    await receipt(12000, 2000, "2026-10-01", "wholesale");
    await receipt(24000, 4000, "2026-10-02", "cbd-shop");
    await receipt(36000, 6000, "2026-10-03", "online");
    await receipt(12000, 2000, asOf); // half-open window
    await receipt(12000, 2000, "2026-10-19");
    expect((await score()).salesHtCents).toBe(60_000);
    await db.exec("UPDATE public.kq_seasons SET ends_at='2026-10-03'");
    expect((await score()).salesHtCents).toBe(30_000);
    await db.exec("UPDATE public.kq_seasons SET closed_at='2026-10-02'");
    expect((await score()).salesHtCents).toBe(10_000);
  });

  it("uses activation then creation when no scheduled season start exists", async () => {
    await receipt(12000, 2000, "2026-10-01");
    await receipt(12000, 2000, "2026-10-02");
    await db.exec("UPDATE public.kq_seasons SET starts_at=NULL,created_at='2026-10-03'");
    expect((await score()).salesHtCents).toBe(10_000);
    await db.exec("UPDATE public.kq_seasons SET activated_at=NULL");
    expect((await score()).salesHtCents).toBe(0);
    expect((await score(asOf, "unknown-season")).salesHtCents).toBe(0);
  });

  it("keeps decimal business scores readable by legacy consumers and owners without a duel", async () => {
    await db.exec("UPDATE public.kq_equipment_wallets SET reputation=60");
    await db.query("INSERT INTO public.kq_rank_profiles(user_id,season_code) VALUES($1,$2)", [userId, season]);
    for (const sql of [
      "SELECT public.rpc_kq_player_core_snapshot($1::uuid) AS value",
      "SELECT public.rpc_kq_refresh_daily_leaderboard($1::text) AS value",
      "SELECT public.rpc_kq_get_arena_leaderboard($1::text,false) AS value",
    ]) {
      const result = await db.query<{ value: { businessScore: number } }>(sql, [sql.includes("snapshot") ? userId : season]);
      expect(result.rows[0].value.businessScore).toBe(3.7);
    }
    await db.exec("TRUNCATE public.kq_rank_profiles");
    const ranking = await db.query<{ value: { leaderboard: { userId: string; score: number; wins: number; losses: number }[] } }>(
      "SELECT public.rpc_kq_get_arena_category_leaderboard($1,'business') AS value", [season]);
    expect(ranking.rows[0].value.leaderboard).toMatchObject([{ userId, score: 3.7, wins: 0, losses: 0 }]);
  });

  it("allows service reads through the score helper without exposing private source tables", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const rights = (await db.query<{ execute: boolean; read: boolean }>(`SELECT
        has_function_privilege($1,'public.kq_business_development_score_for_season(uuid,text,timestamptz)','EXECUTE') AS execute,
        has_table_privilege($1,'public.kq_market_sale_receipts','SELECT') AS read`, [role])).rows[0];
      expect(rights).toEqual({ execute: role === "service_role", read: false });
    }
    await db.exec("SET ROLE service_role");
    try { expect((await score()).score).toBe(0); } finally { await db.exec("RESET ROLE"); }
  });
});
