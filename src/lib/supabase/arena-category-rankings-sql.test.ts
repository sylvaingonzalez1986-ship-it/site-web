import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const playerId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
type RankingEntry = { userId: string; rank: number; pseudo: string; score: number; rating: number; wins: number; losses: number };
type Ranking = { category: string; seasonCode: string; generatedAt: string; leaderboard: RankingEntry[] };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.kq_rank_profiles(user_id UUID PRIMARY KEY, season_code TEXT DEFAULT 'KQ-2026-S1',
      rating INTEGER DEFAULT 1000, season_points INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0);
    CREATE TABLE public.contest_profiles(customer_id UUID PRIMARY KEY, pseudo TEXT);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY);
    CREATE TABLE public.business_score_fixture(user_id UUID PRIMARY KEY, score INTEGER);
    -- The business formula has its own PostgreSQL integration coverage. These
    -- fixtures isolate category eligibility, ordering and the top-100 boundary.
    CREATE FUNCTION public.kq_business_development_score(p_user_id UUID) RETURNS JSONB
    LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('score',COALESCE(
      (SELECT score FROM public.business_score_fixture WHERE user_id=p_user_id),0)) $$;
  `);
  await db.exec(readFileSync("supabase/migrations/20261018000100_arena_category_rankings.sql", "utf8"));
}, 30_000);
beforeEach(async () => { await db.exec("TRUNCATE public.kq_rank_profiles, public.contest_profiles, public.kq_equipment_wallets, public.business_score_fixture"); });
afterAll(async () => { await db?.close(); });

async function ranking(category: string, seasonCode = "KQ-2026-S1") {
  const result = await db.query<{ result: Ranking }>(
    "SELECT public.rpc_kq_get_arena_category_leaderboard($1,$2) AS result", [seasonCode, category]);
  return result.rows[0].result;
}

describe("Arena category rankings in PostgreSQL", () => {
  it("finds category champions across all players before limiting each ranking to 100", async () => {
    await db.exec(`
      INSERT INTO public.kq_rank_profiles(user_id,rating,season_points,wins)
        SELECT ('00000000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID,1200,100,1 FROM generate_series(1,150) n;
      INSERT INTO public.business_score_fixture SELECT user_id,150 FROM public.kq_rank_profiles;
      INSERT INTO public.kq_equipment_wallets SELECT user_id FROM public.kq_rank_profiles;
      INSERT INTO public.kq_rank_profiles(user_id,rating,season_points,wins) VALUES('${playerId(151)}',1300,200,1);
      INSERT INTO public.kq_equipment_wallets VALUES('${playerId(152)}');
      INSERT INTO public.business_score_fixture VALUES('${playerId(152)}',200);
      INSERT INTO public.contest_profiles VALUES('${playerId(151)}','Champion des duels'),('${playerId(152)}','Entreprise sans duel');
    `);
    const duels = await ranking("duels");
    expect(duels.leaderboard).toHaveLength(100);
    expect(duels.leaderboard[0]).toMatchObject({ userId: playerId(151), rank: 1, score: 500, pseudo: "Champion des duels" });
    expect(duels.leaderboard.some(entry => entry.userId === playerId(152))).toBe(false);
    const business = await ranking("business");
    expect(business.leaderboard).toHaveLength(100);
    expect(business.leaderboard[0]).toMatchObject({ userId: playerId(152), rank: 1, score: 200, wins: 0, losses: 0 });
    expect(business.leaderboard.some(entry => entry.userId === playerId(151))).toBe(false);
    expect(business.category).toBe("business");
    expect(business.seasonCode).toBe("KQ-2026-S1");
  });

  it("uses only company points and stable identity to break company ties", async () => {
    await db.exec(`
      INSERT INTO public.kq_rank_profiles(user_id,rating,season_points,wins) VALUES
        ('${playerId(1)}',900,0,0),('${playerId(2)}',2000,500,50),('${playerId(3)}',1500,300,5);
      INSERT INTO public.business_score_fixture VALUES('${playerId(1)}',150),('${playerId(2)}',150);
      INSERT INTO public.kq_equipment_wallets SELECT user_id FROM public.kq_rank_profiles;
    `);
    expect((await ranking("business")).leaderboard.map(entry => entry.userId)).toEqual([playerId(1), playerId(2)]);
    await db.exec(`UPDATE public.kq_rank_profiles SET rating=5000,wins=100,season_points=1000 WHERE user_id='${playerId(2)}'`);
    expect((await ranking("business")).leaderboard.map(entry => entry.userId)).toEqual([playerId(1), playerId(2)]);
  });

  it("breaks duel ties by rating, wins, losses and identity without company influence", async () => {
    await db.exec(`
      INSERT INTO public.kq_rank_profiles(user_id,rating,season_points,wins,losses) VALUES
        ('${playerId(1)}',1400,200,5,2),('${playerId(2)}',1400,200,6,2),
        ('${playerId(3)}',1400,200,6,1),('${playerId(4)}',1500,200,1,5),
        ('${playerId(5)}',1400,200,6,1),('${playerId(6)}',900,0,0,1);
      INSERT INTO public.business_score_fixture VALUES('${playerId(1)}',200);
    `);
    const result = await ranking("duels");
    expect(result.leaderboard.map(entry => entry.userId)).toEqual([4, 3, 5, 2, 1, 6].map(playerId));
    expect(result.leaderboard.map(entry => entry.score)).toEqual([500, 500, 500, 500, 500, 0]);
  });

  it("isolates duel seasons while keeping companies eligible across seasons", async () => {
    expect((await ranking("business")).leaderboard).toEqual([]);
    expect((await ranking("duels")).leaderboard).toEqual([]);
    await db.exec(`
      INSERT INTO public.kq_rank_profiles(user_id,season_code,rating,season_points,wins)
        VALUES('${playerId(1)}','KQ-CLOSED',1300,200,20);
      INSERT INTO public.business_score_fixture VALUES('${playerId(1)}',200);
      INSERT INTO public.kq_equipment_wallets VALUES('${playerId(1)}');
    `);
    expect((await ranking("business")).leaderboard).toMatchObject([{ userId: playerId(1), score: 200, wins: 0, losses: 0 }]);
    expect((await ranking("duels")).leaderboard).toEqual([]);
    expect((await ranking("duels", "KQ-CLOSED")).leaderboard).toHaveLength(1);
    await expect(ranking("unknown")).rejects.toThrow("invalid_ranking_category");
  });

  it("allows only service_role to execute the category reader", async () => {
    const permissions = await db.query<{ anonymous: boolean; authenticated: boolean; service: boolean }>(`SELECT
      has_function_privilege('anon','public.rpc_kq_get_arena_category_leaderboard(text,text)','EXECUTE') AS anonymous,
      has_function_privilege('authenticated','public.rpc_kq_get_arena_category_leaderboard(text,text)','EXECUTE') AS authenticated,
      has_function_privilege('service_role','public.rpc_kq_get_arena_category_leaderboard(text,text)','EXECUTE') AS service`);
    expect(permissions.rows[0]).toEqual({ anonymous: false, authenticated: false, service: true });
  });
});
