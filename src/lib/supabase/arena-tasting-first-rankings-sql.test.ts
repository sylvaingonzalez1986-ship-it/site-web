import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calculateArenaScore } from "@/lib/arena-ranking";

let db: PGlite;
let migratedCreditCount = 0;
const user = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
type Entry = { userId: string; rank: number; score: number; notebookScore: number; placardScore: number;
  businessScore: number; tastedFlowerCount: number; duelSeasonPoints: number };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,email_confirmed_at TIMESTAMPTZ);
    CREATE TABLE public.kq_seasons(season_code TEXT PRIMARY KEY,status TEXT,starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,activated_at TIMESTAMPTZ,closed_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT now());
    INSERT INTO public.kq_seasons VALUES ('current','active',now()-INTERVAL '90 days',NULL,NULL,NULL,now());
    CREATE TABLE public.contest_seasons(id TEXT PRIMARY KEY,code TEXT,is_active BOOLEAN);
    INSERT INTO public.contest_seasons VALUES ('notebook','2026',true),('old-notebook','2025',false);
    CREATE FUNCTION public.kq_current_notebook_season() RETURNS TABLE(id TEXT)
      LANGUAGE sql STABLE AS $$ SELECT id FROM public.contest_seasons WHERE is_active LIMIT 1 $$;
    CREATE TABLE public.products(id TEXT PRIMARY KEY,category TEXT);
    CREATE TABLE public.contest_entries(id TEXT PRIMARY KEY,product_id TEXT,season_id TEXT);
    CREATE TABLE public.contest_reviews(id UUID PRIMARY KEY,entry_id TEXT,season_id TEXT,customer_id UUID,
      status TEXT,created_at TIMESTAMPTZ DEFAULT now()-INTERVAL '1 day',reviewed_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.orders(id TEXT PRIMARY KEY,customer_id UUID,customer_email TEXT,payment_state TEXT DEFAULT 'paid',
      status TEXT DEFAULT 'delivered',payment_review_required BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()-INTERVAL '2 days',paid_at TIMESTAMPTZ DEFAULT now()-INTERVAL '2 days');
    CREATE TABLE public.order_items(order_id TEXT,product_id TEXT,quantity INTEGER DEFAULT 1,line_total NUMERIC DEFAULT 10);
    CREATE TABLE public.contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT);
    CREATE TABLE public.kq_rank_profiles(user_id UUID PRIMARY KEY,season_code TEXT DEFAULT 'current',rating INTEGER DEFAULT 1000,
      season_points INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,losses INTEGER DEFAULT 0);
    CREATE TABLE public.kq_equipment_wallets(user_id UUID PRIMARY KEY);
    CREATE TABLE public.kq_daily_challenge_claims(user_id UUID,bot_battle_id UUID,points INTEGER,claimed_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE public.kq_arena_leaderboard_snapshots(season_code TEXT PRIMARY KEY,contest_season_id TEXT,
      contest_season_code TEXT,generated_at TIMESTAMPTZ,leaderboard JSONB);
    CREATE TABLE public.business_fixture(user_id UUID PRIMARY KEY,score NUMERIC);
    CREATE FUNCTION public.kq_business_development_score_for_season(UUID,TEXT,TIMESTAMPTZ DEFAULT now()) RETURNS JSONB
      LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('score',COALESCE((SELECT score FROM public.business_fixture WHERE user_id=$1),0),
        'productionAreaM2',50,'salesHtCents',1000000,'reputationPoints',600) $$;
    INSERT INTO auth.users VALUES('${user(99)}','old@example.com',now());
    INSERT INTO public.products VALUES('legacy','fleurs');
    INSERT INTO public.contest_entries VALUES('legacy-entry','legacy','notebook');
    INSERT INTO public.contest_reviews(id,entry_id,season_id,customer_id,status,created_at)
      VALUES('${user(99)}','legacy-entry','notebook','${user(99)}','approved',now()-INTERVAL '150 days');
    INSERT INTO public.orders(id,customer_id,created_at,paid_at)
      VALUES('legacy-order','${user(99)}',now()-INTERVAL '200 days',now()-INTERVAL '200 days');
    INSERT INTO public.order_items(order_id,product_id) VALUES('legacy-order','legacy');
  `);
  await db.exec(readFileSync("supabase/migrations/20261018000300_arena_tasting_first_rankings.sql", "utf8"));
  migratedCreditCount = Number((await db.query<{ count: number }>("SELECT count(*) FROM public.kq_arena_tasting_transition_credits")).rows[0].count);
}, 30_000);

beforeEach(async () => {
  await db.exec(`TRUNCATE public.kq_arena_tasting_transition_credits,public.contest_reviews,public.contest_entries,
    public.products,public.orders,public.order_items,public.contest_profiles,public.kq_rank_profiles,
    public.kq_equipment_wallets,public.kq_daily_challenge_claims,public.business_fixture,public.kq_arena_leaderboard_snapshots;
    DELETE FROM public.kq_seasons WHERE season_code <> 'current'; UPDATE public.kq_seasons SET status='active' WHERE season_code='current';`);
});
afterAll(async () => { await db?.close(); });

async function taste(index: number, product = `flower-${index}`, season = "notebook") {
  await db.query("INSERT INTO auth.users VALUES($1,$2,now()) ON CONFLICT(id) DO NOTHING", [user(index), `${index}@example.com`]);
  await db.query("INSERT INTO public.products VALUES($1,'fleurs') ON CONFLICT DO NOTHING", [product]);
  await db.query("INSERT INTO public.contest_entries VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [`entry-${index}`, product, season]);
  await db.query("INSERT INTO public.contest_reviews(id,entry_id,season_id,customer_id,status) VALUES($1,$2,$3,$1,'approved')",
    [user(index), `entry-${index}`, season]);
  await db.query("INSERT INTO public.orders(id,customer_id) VALUES($1,$2)", [`order-${index}`, user(index)]);
  await db.query("INSERT INTO public.order_items(order_id,product_id) VALUES($1,$2)", [`order-${index}`, product]);
}
async function ranking(category?: string) {
  if (category) return (await db.query<{ result: { leaderboard: Entry[] } }>(
    "SELECT public.rpc_kq_get_arena_category_leaderboard('current',$1) AS result", [category])).rows[0].result.leaderboard;
  return (await db.query<{ leaderboard: Entry[] }>(
    "SELECT leaderboard FROM public.rpc_kq_get_arena_leaderboard('current',true)")).rows[0].leaderboard;
}

describe("Arena tasting-first rankings in PostgreSQL", () => {
  it("migrates legitimate historical discoveries and admits players without duels", async () => {
    expect(migratedCreditCount).toBe(1);
    await taste(1);
    await db.exec(`INSERT INTO public.kq_equipment_wallets VALUES('${user(2)}');
      INSERT INTO public.business_fixture VALUES('${user(2)}',90);`);
    expect(await ranking()).toMatchObject([
      { userId: user(1), score: 100, notebookScore: 100, placardScore: 0 },
      { userId: user(2), score: 90, businessScore: 90 },
    ]);
  });

  it("removes bot awards exactly and matches the pure score formula", async () => {
    await taste(1);
    await db.exec(`INSERT INTO public.kq_rank_profiles(user_id,season_points,wins) VALUES
      ('${user(1)}',650,5),('${user(2)}',400,0);
      INSERT INTO public.kq_daily_challenge_claims(user_id,bot_battle_id,points) VALUES
      ('${user(1)}','${user(3)}',400),('${user(2)}','${user(4)}',400);
      INSERT INTO public.kq_daily_challenge_claims(user_id,bot_battle_id,points,claimed_at)
        VALUES('${user(1)}','${user(5)}',999,now()-INTERVAL '100 days');
      INSERT INTO public.business_fixture VALUES('${user(1)}',90);`);
    const entries = await ranking();
    const expected = calculateArenaScore({ tastedFlowerCount: 1, duelSeasonPoints: 250, businessScore: 90 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ score: expected.total, notebookScore: expected.notebook,
      placardScore: expected.placard, businessScore: expected.business, duelSeasonPoints: 250 });
    expect((await ranking("duels"))[0].score).toBe(expected.placard);
    expect((await ranking("business"))[0].score).toBe(expected.business);
    expect((await ranking("tasting"))[0].score).toBe(expected.notebook);
  });

  it("deduplicates product variants and requires new seasonal paid purchases", async () => {
    await taste(1);
    await taste(2);
    await db.exec(`UPDATE public.order_items SET product_id='flower-1::3g' WHERE order_id='order-1';
      INSERT INTO public.order_items(order_id,product_id) VALUES('order-1','flower-1::10g');
      INSERT INTO public.contest_entries VALUES('duplicate','flower-1','notebook');
      INSERT INTO public.contest_reviews(id,entry_id,season_id,customer_id,status)
        VALUES('${user(3)}','duplicate','notebook','${user(1)}','approved');
      UPDATE public.orders SET created_at=now()-INTERVAL '100 days',paid_at=now()-INTERVAL '100 days' WHERE id='order-2';`);
    expect(await ranking("tasting")).toMatchObject([{ userId: user(1), tastedFlowerCount: 1, score: 100 }]);
    await db.exec(`INSERT INTO public.kq_arena_tasting_transition_credits(customer_id,product_id,notebook_season_id,review_id,arena_season_code)
      VALUES('${user(2)}','flower-2','notebook','${user(2)}','current');`);
    expect((await ranking()).map(row => row.userId)).toEqual([user(1), user(2)]);
  });

  it("checks payment ownership, moderation, cancellations and non-flower products", async () => {
    for (let index = 1; index <= 6; index++) await taste(index);
    await db.exec(`UPDATE public.orders SET payment_state='pending' WHERE id='order-1';
      UPDATE public.orders SET status='cancelled' WHERE id='order-2';
      UPDATE public.contest_reviews SET status='rejected' WHERE id='${user(3)}';
      UPDATE public.products SET category='accessoires' WHERE id='flower-4';
      UPDATE public.orders SET customer_id=NULL,customer_email='5@example.com' WHERE id='order-5';
      UPDATE public.orders SET customer_id=NULL,customer_email='6@example.com' WHERE id='order-6';
      UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${user(6)}';`);
    expect((await ranking()).map(row => row.userId)).toEqual([user(5)]);
  });

  it("keeps the full field beyond 100 players and shares exact ties", async () => {
    await db.exec(`INSERT INTO public.kq_equipment_wallets
      SELECT ('00000000-0000-4000-8000-'||lpad(n::TEXT,12,'0'))::UUID FROM generate_series(1,151) n;
      INSERT INTO public.business_fixture SELECT user_id,90 FROM public.kq_equipment_wallets;`);
    const entries = await ranking();
    expect(entries).toHaveLength(151);
    expect(entries[150]).toMatchObject({ userId: user(151), rank: 1, score: 90 });
    expect(await ranking("business")).toHaveLength(151);
    await db.exec(`UPDATE public.business_fixture SET score=100 WHERE user_id='${user(151)}'`);
    const updated = await ranking();
    expect(updated[0]).toMatchObject({ userId: user(151), rank: 1 });
    expect(updated[1]).toMatchObject({ userId: user(1), rank: 2 });
  });

  it("counts historical tasting seasons globally without adding them to the current season", async () => {
    await taste(1, "same-flower");
    await taste(2, "same-flower", "old-notebook");
    await db.exec(`UPDATE public.contest_reviews SET customer_id='${user(1)}' WHERE id='${user(2)}';
      UPDATE public.orders SET customer_id='${user(1)}' WHERE id='order-2';
      INSERT INTO public.kq_arena_tasting_transition_credits(customer_id,product_id,notebook_season_id,review_id)
        VALUES('${user(1)}','same-flower','old-notebook','${user(2)}');`);
    expect((await ranking("tasting-global"))[0]).toMatchObject({ userId: user(1), tastedFlowerCount: 2, score: 200 });
    expect((await ranking("tasting"))[0]).toMatchObject({ userId: user(1), tastedFlowerCount: 1, score: 100 });
  });

  it("keeps discoveries when the Carnet changes and deduplicates across Carnets within one Arena season", async () => {
    await taste(1, "same-flower");
    await taste(2, "same-flower", "old-notebook");
    await taste(3, "another-flower", "old-notebook");
    await db.exec(`UPDATE public.contest_reviews SET customer_id='${user(1)}';
      UPDATE public.orders SET customer_id='${user(1)}';`);
    expect((await ranking("tasting-global"))[0]).toMatchObject({ userId: user(1), tastedFlowerCount: 2, score: 200 });
    expect((await ranking("tasting"))[0]).toMatchObject({ userId: user(1), tastedFlowerCount: 2, score: 200 });
  });

  it("counts the same flower in a later Arena season only after a renewed purchase and review", async () => {
    await taste(1, "same-flower", "old-notebook");
    await taste(2, "same-flower");
    await db.exec(`INSERT INTO public.kq_seasons(season_code,status,starts_at,ends_at)
      VALUES('previous','closed',now()-INTERVAL '180 days',now()-INTERVAL '90 days');
      UPDATE public.contest_reviews SET created_at=now()-INTERVAL '100 days',reviewed_at=now()-INTERVAL '99 days' WHERE id='${user(1)}';
      UPDATE public.orders SET created_at=now()-INTERVAL '101 days',paid_at=now()-INTERVAL '101 days' WHERE id='order-1';
      UPDATE public.contest_reviews SET customer_id='${user(1)}' WHERE id='${user(2)}';
      UPDATE public.orders SET customer_id='${user(1)}',payment_state='pending' WHERE id='order-2';`);
    expect(await ranking()).toEqual([]);
    expect((await ranking("tasting-global"))[0]).toMatchObject({ userId: user(1), tastedFlowerCount: 1, score: 100 });
    await db.exec("UPDATE public.orders SET payment_state='paid' WHERE id='order-2'");
    expect((await ranking())[0]).toMatchObject({ userId: user(1), tastedFlowerCount: 1, score: 100 });
    expect((await ranking("tasting-global"))[0]).toMatchObject({ userId: user(1), tastedFlowerCount: 2, score: 200 });
  });

  it("preserves closed snapshots even for forced refresh and keeps service-only RPC access", async () => {
    await taste(1);
    await ranking();
    await db.exec(`UPDATE public.kq_seasons SET status='closed' WHERE season_code='current';
      UPDATE public.kq_arena_leaderboard_snapshots SET formula_version='arena-v2-development',leaderboard='[{"score":777}]';`);
    expect(await ranking()).toEqual([{ score: 777 }]);
    const rights = await db.query<{ private_read: boolean; anonymous: boolean; authenticated: boolean; service: boolean }>(`SELECT
      has_table_privilege('service_role','public.kq_arena_tasting_transition_credits','SELECT') AS private_read,
      has_function_privilege('anon','public.rpc_kq_get_arena_category_leaderboard(text,text)','EXECUTE') AS anonymous,
      has_function_privilege('authenticated','public.rpc_kq_get_arena_leaderboard(text,boolean)','EXECUTE') AS authenticated,
      has_function_privilege('service_role','public.rpc_kq_get_arena_category_leaderboard(text,text)','EXECUTE') AS service`);
    expect(rights.rows[0]).toEqual({ private_read: false, anonymous: false, authenticated: false, service: true });
  });
});
