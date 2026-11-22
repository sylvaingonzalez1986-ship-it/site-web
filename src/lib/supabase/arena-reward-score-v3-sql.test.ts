import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildArenaCustomerRewardPreview, type ArenaCustomerRewardStanding } from "../arena-customer-rewards";

const version = "arena-v3-tasting-first";
const player = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const standing = (n: number, rank = n): ArenaCustomerRewardStanding => ({ playerId: player(n), leaderboardRank: rank,
  pseudo: `Player ${n}`, score: 900.1 - rank, rating: 1000, wins: 0, losses: 0,
  tastedFlowerCount: 1, rankingFormulaVersion: version });

type Plan = { topRewards: Record<string, unknown>[]; surpriseCandidates: Record<string, unknown>[]; surpriseGrams: number; candidateHash: string };
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    SET timezone='UTC';
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE public.kq_seasons(season_code TEXT PRIMARY KEY);
    CREATE TABLE public.contest_seasons(id TEXT PRIMARY KEY);
    CREATE TABLE public.kq_rank_profiles(user_id UUID,season_code TEXT,wins INTEGER,losses INTEGER);
    CREATE TABLE public.lottery_reward_claims(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,
      reward_snapshot JSONB,status TEXT,gift_weight_grams INTEGER,gift_label TEXT);
    CREATE TABLE public.orders(id TEXT PRIMARY KEY, status TEXT, payment_provider TEXT, payment_state TEXT,
      customer_id UUID, customer_name TEXT, customer_email TEXT, shipping_address TEXT, shipping_city TEXT,
      shipping_postal_code TEXT, shipping_country TEXT, shipping_phone TEXT, delivery_method TEXT, delivery_fee NUMERIC,
      items_count INTEGER, total_ht NUMERIC, total_vat NUMERIC, total_amount NUMERIC, viva_order_code TEXT, viva_transaction_id TEXT);
    CREATE TABLE public.order_items(order_id TEXT REFERENCES public.orders(id), product_id TEXT, name TEXT, unit_price NUMERIC,
      unit_price_ht NUMERIC, quantity INTEGER, line_total NUMERIC, line_total_ht NUMERIC, line_vat_amount NUMERIC,
      vat_rate NUMERIC, product_category TEXT, unit_weight_grams NUMERIC);
    CREATE TABLE public.kq_arena_leaderboard_snapshots(season_code TEXT PRIMARY KEY,formula_version TEXT,leaderboard JSONB);
    CREATE FUNCTION public.rpc_kq_get_arena_leaderboard(p_season_code TEXT,p_force_refresh BOOLEAN DEFAULT false)
    RETURNS public.kq_arena_leaderboard_snapshots LANGUAGE sql AS $$
      SELECT * FROM public.kq_arena_leaderboard_snapshots WHERE season_code=p_season_code $$;
    CREATE FUNCTION public.lottery_secure_random_int(low INTEGER,high INTEGER) RETURNS INTEGER
      LANGUAGE sql AS $$ SELECT low $$;
  `);
  const legacy = readFileSync("supabase/migrations/20260826000100_arena_customer_reward_pool.sql", "utf8");
  await db.exec(legacy.slice(legacy.indexOf("CREATE TABLE IF NOT EXISTS public.arena_customer_reward_seasons"),
    legacy.indexOf("INSERT INTO public.arena_customer_reward_seasons")));
  await db.exec(`
    CREATE FUNCTION public.rpc_arena_refresh_customer_reward_pool(p_season_code TEXT,p_finalize_previous_weeks BOOLEAN DEFAULT false)
    RETURNS JSONB LANGUAGE sql AS $$ SELECT jsonb_build_object('status',status)
      FROM public.arena_customer_reward_seasons WHERE season_code=p_season_code $$;
  `);
  await db.exec(legacy.slice(legacy.indexOf("CREATE OR REPLACE FUNCTION public.rpc_arena_freeze_customer_reward_season"),
    legacy.indexOf("ALTER TABLE public.arena_customer_reward_seasons ENABLE ROW LEVEL SECURITY")));
  await db.exec(readFileSync("supabase/migrations/20260912000100_arena_customer_reward_standings_snapshot.sql", "utf8"));
  await db.exec(`
    INSERT INTO public.kq_seasons VALUES('LEGACY');
    INSERT INTO public.arena_customer_reward_seasons(season_code,status,starts_at) VALUES('LEGACY','frozen','2026-01-01');
  `);
  await db.exec(readFileSync("supabase/migrations/20261018000400_arena_reward_score_v3.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261122001200_arena_prize_season_delivery.sql", "utf8"));
}, 30_000);
beforeEach(async () => {
  await db.exec(`TRUNCATE public.arena_customer_reward_grants,public.arena_customer_reward_draws, public.orders, public.order_items,
    public.arena_customer_reward_weeks,public.arena_customer_reward_adjustments,public.lottery_reward_claims,
    public.kq_rank_profiles,public.kq_arena_leaderboard_snapshots;
    DELETE FROM public.arena_customer_reward_seasons WHERE season_code<>'LEGACY';
    INSERT INTO public.kq_seasons VALUES('S1') ON CONFLICT DO NOTHING;
    INSERT INTO public.arena_customer_reward_seasons(season_code,status,starts_at) VALUES('S1','active','2026-01-01');
    INSERT INTO auth.users SELECT ('00000000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID FROM generate_series(1,40) n ON CONFLICT DO NOTHING;
    UPDATE public.arena_customer_reward_seasons SET status='frozen',standings_snapshot=NULL WHERE season_code='LEGACY';
  `);
});
afterAll(async () => { await db?.close(); });

async function setStandings(rows: ArenaCustomerRewardStanding[], frozen = false, pool = 1000) {
  const leaderboard = rows.map(row => ({ userId: row.playerId, rank: row.leaderboardRank, pseudo: row.pseudo,
    score: row.score, rating: row.rating, wins: row.wins, losses: row.losses, tastedFlowerCount: row.tastedFlowerCount }));
  await db.query("INSERT INTO public.kq_arena_leaderboard_snapshots VALUES('S1',$1,$2)", [version, leaderboard]);
  await db.query("INSERT INTO public.arena_customer_reward_weeks(season_code,week_start,week_end,contribution_grams) VALUES('S1','2026-10-12','2026-10-19',$1)", [pool]);
  if (frozen) await db.query("UPDATE public.arena_customer_reward_seasons SET status='frozen',standings_snapshot=$1 WHERE season_code='S1'", [rows]);
}
async function sqlPlan(rows: ArenaCustomerRewardStanding[], pool = 1000) {
  return (await db.query<{ value: Plan }>("SELECT public.kq_arena_reward_plan_v3($1,$2,3) AS value", [rows, pool])).rows[0].value;
}
function tsPlan(rows: ArenaCustomerRewardStanding[], pool = 1000): Plan {
  const result = buildArenaCustomerRewardPreview(pool, rows);
  const payload = (row: ArenaCustomerRewardStanding) => ({ userId: row.playerId, leaderboardRank: row.leaderboardRank,
    score: row.score, rating: row.rating, wins: row.wins, losses: row.losses,
    tastedFlowerCount: row.tastedFlowerCount ?? 0, rankingFormulaVersion: version });
  const topRewards = result.rankingWinners.filter(row => row.grams > 0).map(row => ({ ...payload(row), rewardRank: row.rewardRank,
    shareBps: row.shareBps, grams: row.grams }));
  const surpriseCandidates = result.surpriseCandidates.map(payload);
  return { topRewards, surpriseCandidates, surpriseGrams: result.surprisePoolGrams,
    candidateHash: createHash("sha256").update(surpriseCandidates.map(row => `${row.leaderboardRank}:${row.userId}`).join("\n")).digest("hex") };
}
async function settle(plan: Plan, execute = false, season = "S1") {
  return (await db.query<{ value: Record<string, unknown> }>("SELECT public.rpc_arena_settle_customer_rewards($1,$2,$3,$4,$5,$6) AS value",
    [season, plan.topRewards, plan.surpriseCandidates, plan.candidateHash, plan.surpriseGrams, execute])).rows[0].value;
}

async function configurePrizes(season = "S1", from = "2026-11-14 23:00:00Z", until = "2026-12-31 23:00:00Z", carry: string | null = null) {
  return (await db.query<{ value: { configured: boolean } }>("SELECT public.rpc_arena_configure_prize_season_v3($1,$2,$3,$4) AS value", [season, from, until, carry])).rows[0].value;
}

describe("versioned physical prizes and free delivery", () => {
  it.each([
    { name: "three tied including an ineligible player", rows: [standing(1, 1), { ...standing(2, 1), tastedFlowerCount: 0 }, standing(3, 1)], grants: [20, 19], report: 61 },
    { name: "one eligible player", rows: [standing(1)], grants: [27], report: 73 },
    { name: "no eligible player", rows: [{ ...standing(1), tastedFlowerCount: 0 }], grants: [], report: 100 },
  ])("closes and replays a 100 g season with $name", async ({ rows, grants, report }) => {
    expect(await configurePrizes()).toMatchObject({ configured: true });
    expect(await configurePrizes()).toMatchObject({ configured: false });
    await setStandings(rows, true, 0);
    const plan = tsPlan(rows, 100);
    const expected = { poolGrams: 100, baseGrams: 100, carryInGrams: 0, reportGrams: report,
      rankingGrams: 100 - report, surpriseGrams: 0 };
    expect(await settle(plan)).toMatchObject({ ...expected, ready: true, executed: false });
    expect(await settle(plan, true)).toMatchObject({ ...expected, executed: true, granted: grants.length });
    expect(await settle(plan, true)).toMatchObject({ ...expected, executed: false, alreadySettled: true });
    expect((await db.query<{ gift_weight_grams: number; claim_id: string | null }>(
      "SELECT gift_weight_grams, claim_id FROM public.arena_customer_reward_grants ORDER BY user_id",
    )).rows).toEqual(grants.map(grams => ({ gift_weight_grams: grams, claim_id: null })));

    await db.exec(`INSERT INTO public.kq_seasons VALUES('S2'),('DUPLICATE') ON CONFLICT DO NOTHING;
      INSERT INTO public.arena_customer_reward_seasons(season_code,status,starts_at) VALUES
      ('S2','planned','2026-12-31 23:00:00Z'),('DUPLICATE','planned','2026-12-31 23:00:00Z');`);
    expect(await configurePrizes("S2", "2026-12-31 23:00:00Z", "2027-03-31 22:00:00Z", "S1")).toMatchObject({ configured: true });
    const funding = await db.query("SELECT public.kq_arena_customer_prize_funding('S2') AS value");
    expect(funding.rows[0]).toMatchObject({ value: { baseGrams: 100, carryInGrams: report, carryPending: false } });
    await expect(configurePrizes("DUPLICATE", "2026-12-31 23:00:00Z", "2027-03-31 22:00:00Z", "S1")).rejects.toThrow();
  });

  it("authorizes only the winner and recovers the same fulfilment receipt after a lost response", async () => {
    await configurePrizes();
    const rows = [standing(1)];
    await setStandings(rows, true, 0);
    await settle(tsPlan(rows, 100), true);
    const grants = await db.query<{ id: string }>("SELECT id FROM public.arena_customer_reward_grants");
    const grant = grants.rows[0].id;
    const address = { name: "Camille Martin", address: "2 rue des Fleurs", postalCode: "29200", city: "Brest", email: "test@example.invalid", phone: "+33612345678" };
    const order = async (userId: string, shipping: Partial<typeof address>) => (await db.query<{ value: { orderId: string } }>(
      "SELECT public.rpc_arena_order_customer_prize($1,$2,$3) AS value", [grant, userId, shipping],
    )).rows[0].value;
    await expect(order(player(2), address)).rejects.toThrow("arena_customer_prize_not_found");
    await expect(order(player(1), { ...address, postalCode: "97400" })).rejects.toThrow("arena_customer_prize_shipping_invalid");
    const receipt = await order(player(1), address);
    expect(receipt).toMatchObject({ grams: 27, totalCents: 0 });
    expect(await order(player(1), {})).toEqual(receipt);
    const orders = await db.query("SELECT id, payment_provider, payment_state, total_amount::FLOAT, delivery_fee::FLOAT FROM public.orders");
    expect(orders.rows).toEqual([{ id: receipt.orderId, payment_provider: "arena_reward", payment_state: "not_configured", total_amount: 0, delivery_fee: 0 }]);
    expect((await db.query("SELECT line_total::FLOAT, unit_weight_grams::FLOAT FROM public.order_items")).rows).toEqual([{ line_total: 0, unit_weight_grams: 27 }]);
    const persistent = await db.query("SELECT fulfillment_order_id FROM public.arena_customer_reward_grants WHERE id=$1", [grant]);
    expect(persistent.rows[0]).toEqual({ fulfillment_order_id: receipt.orderId });
    await expect(db.exec("UPDATE public.orders SET payment_state='paid'")).rejects.toThrow("arena_reward_order_has_no_payment");
  });

  it("preserves the rule version of frozen seasons", async () => {
    await expect(configurePrizes("LEGACY")).rejects.toThrow("arena_customer_prize_season_not_configurable");
    const legacy = await db.query("SELECT formula_version, prize_settlement FROM public.arena_customer_reward_seasons WHERE season_code='LEGACY'");
    expect(legacy.rows).toEqual([{ formula_version: "arena-customer-v1", prize_settlement: null }]);
  });

  it("settles the frozen snapshot after a new live score would change the winner", async () => {
    await configurePrizes();
    const frozen = [standing(1), { ...standing(2), tastedFlowerCount: 0 }];
    await setStandings(frozen, false, 0);
    await db.query("SELECT public.rpc_arena_freeze_customer_reward_snapshot('S1',$1,true)", [frozen]);
    await db.query(`UPDATE public.kq_arena_leaderboard_snapshots SET leaderboard =
      '[{"userId":"${player(2)}","rank":1,"score":999.9,"rating":1000,"wins":3,"losses":0,"tastedFlowerCount":2}]' WHERE season_code='S1'`);
    const live = [{ ...standing(2, 1), score: 999.9, wins: 3, tastedFlowerCount: 2 }];
    await expect(settle(tsPlan(live, 100), true)).rejects.toThrow("arena_customer_reward_allocation_changed");
    expect(await settle(tsPlan(frozen, 100), true)).toMatchObject({ rankingGrams: 27, reportGrams: 73, granted: 1 });
    expect((await db.query("SELECT user_id FROM public.arena_customer_reward_grants")).rows).toEqual([{ user_id: player(1) }]);
  });
});

describe("v3 reward scoring, frozen evidence and exact allocations", () => {
  it("matches the public projection for decimals, tiny pools and tie groups", async () => {
    const rows = [standing(1), ...Array.from({ length: 3 }, (_, i) => standing(i + 2, 2)), standing(5, 5), standing(6, 11)];
    rows[2].tastedFlowerCount = 0; // retains its occupied slot without taking a reward
    for (const pool of [0, 1, 7, 13.7, 95, 1000, 12034.5]) expect(await sqlPlan(rows, pool)).toEqual(tsPlan(rows, pool));
  });

  it("allows >10 beneficiaries and distributes each occupied slot once", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => standing(i + 1, 1));
    rows.push(standing(13, 13));
    await setStandings(rows, true);
    const plan = tsPlan(rows);
    expect(plan.topRewards).toHaveLength(12);
    expect(plan.topRewards.reduce((sum, row) => sum + Number(row.grams), 0)).toBe(900);
    expect(plan.surpriseCandidates).toHaveLength(1);
    expect(await settle(plan, true)).toMatchObject({ executed: true, granted: 13, surpriseDrawn: true });
    const grants = await db.query<{ score: string; share: string }>("SELECT score_snapshot::TEXT AS score,share_bps::TEXT AS share FROM public.arena_customer_reward_grants WHERE user_id=$1", [player(1)]);
    expect(Number(grants.rows[0].score)).toBe(899.1);
    expect(Number(grants.rows[0].share)).toBe(750);
    expect(await settle(plan, true)).toEqual({ executed: false, alreadySettled: true });
  });

  it("includes every tie crossing tenth place and keeps them outside the surprise", async () => {
    const rows = [...Array.from({ length: 9 }, (_, i) => standing(i + 1)), standing(10, 10), standing(11, 10), standing(12, 10), standing(13, 13)];
    expect(await sqlPlan(rows, 97)).toEqual(tsPlan(rows, 97));
    const plan = await sqlPlan(rows, 97);
    expect(plan.surpriseCandidates.map(row => row.userId)).toEqual([player(13)]);
    const tiedGrams = plan.topRewards.filter(row => row.leaderboardRank === 10).map(row => row.grams);
    expect(tiedGrams).toEqual([1, 1, 1]);
  });

  it("accepts a taster without rank profile and denies a company-only owner", async () => {
    const rows = [standing(1), { ...standing(2), tastedFlowerCount: 0 },
      { ...standing(3), tastedFlowerCount: 0, wins: 2, losses: 1 }];
    await setStandings(rows, true);
    const plan = tsPlan(rows);
    expect(plan.topRewards.map(row => row.userId)).toEqual([player(1), player(3)]);
    expect(await settle(plan, true)).toMatchObject({ granted: 2 });
  });

  it("checks all supplied scores, recipients, shares, budgets and candidate hashes", async () => {
    const rows = [...Array.from({ length: 11 }, (_, i) => standing(i + 1))];
    await setStandings(rows, true);
    const plan = tsPlan(rows);
    for (const tampered of [
      { ...plan, topRewards: [{ ...plan.topRewards[0], score: 999 }, ...plan.topRewards.slice(1)] },
      { ...plan, topRewards: [{ ...plan.topRewards[0], grams: 271 }, ...plan.topRewards.slice(1)] },
      { ...plan, topRewards: [{ ...plan.topRewards[0], shareBps: 3000 }, ...plan.topRewards.slice(1)] },
      { ...plan, topRewards: plan.topRewards.slice(1) },
      { ...plan, topRewards: [...plan.topRewards, plan.topRewards[0]] },
      { ...plan, surpriseCandidates: [] },
      { ...plan, candidateHash: "a".repeat(64) },
      { ...plan, surpriseGrams: 101 },
    ]) await expect(settle(tampered, true)).rejects.toThrow("arena_customer_reward_allocation_changed");
    expect((await db.query("SELECT * FROM public.lottery_reward_claims")).rows).toHaveLength(0);
  });

  it("validates the freeze against the server snapshot and preserves frozen standings", async () => {
    const rows = [standing(1)];
    await setStandings(rows);
    await expect(db.query("SELECT public.rpc_arena_freeze_customer_reward_snapshot('S1',$1,true)",
      [[{ ...rows[0], score: 99999 }]])).rejects.toThrow("arena_customer_reward_standings_changed");
    await db.query("SELECT public.rpc_arena_freeze_customer_reward_snapshot('S1',$1,true)", [rows]);
    await db.query("UPDATE public.kq_arena_leaderboard_snapshots SET leaderboard='[]'");
    expect(await settle(tsPlan(rows), true)).toMatchObject({ executed: true, granted: 1 });
    const saved = await db.query<{ value: unknown }>("SELECT standings_snapshot AS value FROM public.arena_customer_reward_seasons WHERE season_code='S1'");
    expect(saved.rows[0].value).toEqual(rows);
  });

  it("supports a checked active dry run but requires frozen standings to execute", async () => {
    const rows = [standing(1)];
    await setStandings(rows);
    expect(await settle(tsPlan(rows))).toMatchObject({ executed: false, ready: false, rankingWinners: 1 });
    await expect(settle(tsPlan(rows), true)).rejects.toThrow("arena_customer_reward_season_must_be_frozen");
    await db.exec("UPDATE public.arena_customer_reward_seasons SET status='frozen' WHERE season_code='S1'");
    await expect(settle(tsPlan(rows), true)).rejects.toThrow("arena_customer_reward_invalid_standings");
  });

  it("treats an explicitly null execution flag as preview for freeze and settlement", async () => {
    const rows = [standing(1)];
    await setStandings(rows);
    await db.query("SELECT public.rpc_arena_freeze_customer_reward_snapshot('S1',$1,NULL)", [rows]);
    const season = await db.query<{ status: string; snapshot: unknown }>("SELECT status,standings_snapshot AS snapshot FROM public.arena_customer_reward_seasons WHERE season_code='S1'");
    expect(season.rows[0]).toEqual({ status: "active", snapshot: null });
    await db.query("UPDATE public.arena_customer_reward_seasons SET status='frozen',standings_snapshot=$1 WHERE season_code='S1'", [rows]);
    const plan = tsPlan(rows);
    const preview = await db.query<{ result: { executed: boolean } }>("SELECT public.rpc_arena_settle_customer_rewards('S1',$1,$2,$3,$4,NULL) AS result",
      [plan.topRewards, plan.surpriseCandidates, plan.candidateHash, plan.surpriseGrams]);
    expect(preview.rows[0].result.executed).toBe(false);
    expect((await db.query("SELECT * FROM public.lottery_reward_claims")).rows).toHaveLength(0);
  });

  it("preserves the historical 3-duel eligibility and integer awards", async () => {
    const row = { ...standing(1), rankingFormulaVersion: undefined, tastedFlowerCount: undefined, score: 100 };
    await db.query("INSERT INTO public.arena_customer_reward_weeks(season_code,week_start,week_end,contribution_grams) VALUES('LEGACY','2026-10-12','2026-10-19',1000)");
    const plan = { topRewards: [{ userId: row.playerId, leaderboardRank: 1, rewardRank: 1, shareBps: 2700,
      grams: 270, score: 100, rating: 1000, wins: 3, losses: 0 }], surpriseCandidates: [], surpriseGrams: 100,
      candidateHash: createHash("sha256").update("").digest("hex") };
    await expect(settle(plan, true, "LEGACY")).rejects.toThrow("arena_customer_reward_player_ineligible");
    await db.query("INSERT INTO public.kq_rank_profiles VALUES($1,'LEGACY',3,0)", [player(1)]);
    expect(await settle(plan, true, "LEGACY")).toMatchObject({ executed: true, granted: 1 });
    expect((await db.query<{ version: string }>("SELECT ranking_formula_version AS version FROM public.arena_customer_reward_seasons WHERE season_code='LEGACY'")).rows[0].version).toBe("arena-v2-development");
  });

  it("keeps unchecked legacy and v3 writers inaccessible to API callers", async () => {
    for (const name of ["kq_arena_settle_customer_rewards_legacy", "kq_arena_settle_customer_rewards_v3"]) {
      const rights = await db.query<{ allowed: boolean }>("SELECT has_function_privilege('service_role',$1,'EXECUTE') AS allowed",
        [`public.${name}(text,jsonb,jsonb,text,integer,boolean)`]);
      expect(rights.rows[0].allowed).toBe(false);
    }
    const freezeRights = await db.query<{ allowed: boolean }>("SELECT has_function_privilege('service_role','public.rpc_arena_freeze_customer_reward_season(text,boolean)','EXECUTE') AS allowed");
    expect(freezeRights.rows[0].allowed).toBe(false);
    const rights = await db.query<{ allowed: boolean }>("SELECT has_function_privilege('service_role','public.rpc_arena_settle_customer_rewards(text,jsonb,jsonb,text,integer,boolean)','EXECUTE') AS allowed");
    expect(rights.rows[0].allowed).toBe(true);
  });
});
