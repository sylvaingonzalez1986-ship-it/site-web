import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const migration = async name => readFile("supabase/migrations/" + name + ".sql", "utf8");
const between = (source, start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, start);
  return source.slice(a, b);
};
const value = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const pool = async (season, finalize = false) => value("SELECT rpc_arena_refresh_customer_reward_pool($1,$2)", [season, finalize]);
const record = (id, reference, grams) => value("SELECT rpc_arena_prize_record_return($1,$2,$3)", [id, reference, grams]);
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE kq_seasons(season_code text PRIMARY KEY); CREATE TABLE contest_seasons(id text PRIMARY KEY,is_active boolean,is_archived boolean);
    CREATE TABLE contest_entries(season_id text,product_id text,is_published boolean,track text);
    CREATE TABLE products(id text PRIMARY KEY,is_pack boolean,weight_grams numeric,variant_options jsonb);
    CREATE TABLE orders(id text PRIMARY KEY,payment_state text,status text,archived_at timestamptz,paid_at timestamptz,total_amount numeric);
    CREATE TABLE order_items(id bigserial PRIMARY KEY,order_id text,product_id text,parent_pack_id text,product_category text,
      unit_weight_grams numeric,quantity integer,line_total numeric);
    CREATE TABLE lottery_reward_claims(id uuid PRIMARY KEY);
    INSERT INTO contest_seasons VALUES ('notebook',true,false);
    INSERT INTO kq_seasons VALUES ('test'),('legacy'),('prior');
    INSERT INTO products VALUES ('A',false,100,'[]'),('B',false,100,'[]'),('pack',true,100,'[]');
    INSERT INTO contest_entries VALUES ('notebook','A',true,'concours'),('notebook','B',true,'regular');
    INSERT INTO orders VALUES ('sale','paid','new',null,now()-interval '14 days',100),('present','paid','new',null,now(),0);
    INSERT INTO order_items(order_id,product_id,product_category,unit_weight_grams,quantity,line_total)
      VALUES ('sale','historic','fleurs',100,1,20);
  `);
  const initial = await migration("20260826000100_arena_customer_reward_pool");
  await db.exec(between(initial, "CREATE TABLE IF NOT EXISTS public.arena_customer_reward_seasons", "INSERT INTO public.arena_customer_reward_seasons"));
  const dice = await migration("20260826000200_arena_customer_reward_weekly_dice");
  await db.exec(between(dice, "ALTER TABLE public.arena_customer_reward_seasons", "CREATE OR REPLACE FUNCTION public.rpc_arena_refresh_customer_reward_pool"));
  const settlement = await migration("20261003000300_producer_settlements");
  await db.exec(between(settlement, "CREATE OR REPLACE FUNCTION public.resolve_producer_settlement_weight", "CREATE OR REPLACE FUNCTION public.snapshot_order_item_producer"));
  const prizes = await migration("20261122001200_arena_prize_season_delivery");
  await db.exec(`ALTER TABLE arena_customer_reward_seasons ADD COLUMN carry_from_season_code text, ADD COLUMN prize_settlement jsonb;`);
  await db.exec(between(prizes, "CREATE FUNCTION public.kq_arena_customer_prize_funding", "ALTER FUNCTION public.rpc_arena_settle_customer_rewards"));
  await db.exec(await migration("20261122001300_arena_prize_contest_sales"));
  await db.exec(`
    INSERT INTO arena_customer_reward_seasons(season_code,starts_at,ends_at,status,formula_version)
      SELECT code,now()-interval '20 days',now()+interval '1 day',CASE WHEN code='test' THEN 'active' ELSE 'planned' END,v FROM
        (VALUES ('test','arena-customer-prizes-v3'),('prior','arena-customer-prizes-v3'),('legacy','arena-customer-dice-v2')) AS s(code,v);
    UPDATE arena_customer_reward_seasons SET status='settled',prize_settlement='{"reportGrams":61}' WHERE season_code='prior';
    UPDATE arena_customer_reward_seasons SET carry_from_season_code='prior' WHERE season_code='test';
    INSERT INTO order_items(order_id,product_id,product_category,unit_weight_grams,quantity,line_total) VALUES
      ('sale','A','fleurs',100,10,200),('sale','B','fleurs',100,8,180),('sale','pack','fleurs',100,1,10),
      ('sale','A','fleurs',100,5,0),('present','A','fleurs',100,10,150);
    UPDATE contest_entries SET track='regular' WHERE product_id='A';
  `);
  const itemId = await value("SELECT id FROM order_items WHERE product_id='A' AND order_id='sale' AND line_total>0");
  assert.equal(await value("SELECT arena_prize_track FROM order_items WHERE id=$1", [itemId]), "concours");
  assert.equal((await pool("test")).poolGrams, 171); // 100 + 61 + 1% of 1000 g.
  assert.equal((await pool("test")).unknownSaleLines, 1);
  assert.equal(Number(await record(itemId, "return-1", 250)), 250);
  assert.equal(Number(await record(itemId, "return-1", 250)), 250);
  await assert.rejects(record(itemId, "return-1", 1), /prize_return_changed/);
  await assert.rejects(record(itemId, "return-2", 800), /prize_return_exceeds_sale/);
  const finalWeek = (await pool("test", true)).lastFinalWeek;
  assert.equal(finalWeek.eligibleFlowerGrams, 750);
  assert.equal((await pool("test")).poolGrams, 168.5);
  await record(itemId, "late-return", 50);
  assert.equal((await pool("test")).poolGrams, 168.5);
  assert.equal((await pool("legacy")).poolGrams, 30);
  await assert.rejects(db.exec("UPDATE arena_customer_reward_seasons SET status='frozen',ends_at=now() WHERE season_code='test'"), /prize_season_not_finished/);
  console.log(JSON.stringify({ allocation: { base:100, carryIn:61, soldContestGrams:1000, returnedBeforeFinalization:250,
    finalBonus:finalWeek.contributionGrams, lateReturnGrams:50, poolGrams:168.5, unknownSaleLines:1 }, legacyPoolGrams:30 }));
} finally { await db.close(); }
