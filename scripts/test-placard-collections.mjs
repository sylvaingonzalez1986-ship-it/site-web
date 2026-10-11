// Real PostgreSQL execution of the collection migration. No environment files,
// external connections, or production mutations are used.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const owner = "11000000-0000-4000-8000-000000000001";
const other = "11000000-0000-4000-8000-000000000002";
const support = "22000000-0000-4000-8000-000000000001";
const buddie = "22000000-0000-4000-8000-000000000002";
const query = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const snapshot = async (user = owner, draws = false) => (await query(
  "SELECT rpc_kq_heritage_snapshot($1,$2) data", [user, draws],
)).data;
let checks = 0;
async function check(label, fn) {
  await db.exec("BEGIN");
  try { await fn(); console.log(`PASS ${label}`); checks++; }
  finally { await db.exec("ROLLBACK"); }
}

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,card_definition_id UUID);
    CREATE TABLE orders(id TEXT PRIMARY KEY,customer_id UUID,payment_state TEXT,status TEXT);
    CREATE TABLE order_items(id BIGINT PRIMARY KEY,order_id TEXT,product_id TEXT,quantity INTEGER);
    CREATE TABLE products(id TEXT PRIMARY KEY,producer_id TEXT);
    CREATE TABLE producers(id TEXT PRIMARY KEY,name TEXT);
    CREATE TABLE contest_entries(id TEXT PRIMARY KEY,product_id TEXT);
    CREATE TABLE kq_heritage_draws(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,order_item_id BIGINT,unit_index INTEGER,card_code TEXT,was_duplicate BOOLEAN,source TEXT,drawn_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_heritage_player_state(user_id UUID PRIMARY KEY,total_pulls INTEGER);
    CREATE TABLE kq_heritage_fragment_wallets(user_id UUID PRIMARY KEY,balance INTEGER);
    CREATE TABLE kq_heritage_fragment_ledger(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,amount INTEGER,reason TEXT,created_at TIMESTAMPTZ DEFAULT now());
  `);
  await db.exec(await readFile("supabase/migrations/20261011000300_collection_budget.sql", "utf8"));
  await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,$2 FROM generate_series(1,1505)", [owner, support]);
  await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,$2 FROM generate_series(1,1201)", [owner, buddie]);
  await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id) VALUES($1,$2)", [other, support]);
  await db.exec(`
    INSERT INTO producers VALUES('producer-a','Producteur A');
    INSERT INTO products VALUES('flower-a','producer-a'),('not-contest',NULL);
    INSERT INTO contest_entries VALUES('entry-a','flower-a'),('another-season','flower-a');
  `);
  await db.query("INSERT INTO orders SELECT 'order-'||n,$1,'paid','new' FROM generate_series(1,1205) n", [owner]);
  await db.exec(`
    INSERT INTO order_items SELECT n,'order-'||n,'  flower-a :: 3g ',2 FROM generate_series(1,1205) n;
  `);
  await db.query("INSERT INTO kq_heritage_draws(user_id,order_item_id,unit_index,card_code,was_duplicate,source) SELECT $1,n,1,'HERITAGE-001',n>1,'purchase' FROM generate_series(1,1205) n", [owner]);
  await db.query("INSERT INTO kq_heritage_draws(user_id,unit_index,card_code,was_duplicate,source) VALUES($1,1,'HERITAGE-002',false,'craft'),($2,1,'HERITAGE-003',false,'craft')", [owner, other]);
  await db.query("INSERT INTO kq_heritage_fragment_wallets VALUES($1,14),($2,99)", [owner, other]);
  await db.query("INSERT INTO kq_heritage_fragment_ledger(user_id,amount,reason,created_at) SELECT $1,n,'duplicate',now()-make_interval(secs=>n) FROM generate_series(1,25) n", [owner]);

  await check("one compact response counts >1000 support and Buddie copies and isolates owners", async () => {
    const { data } = await query("SELECT rpc_kq_card_copy_counts($1,$2::UUID[]) data", [owner, [support, buddie]]);
    assert.deepEqual(data, { [support]: 1505, [buddie]: 1201 });
    assert(JSON.stringify(data).length < 100);
    assert.deepEqual((await query("SELECT rpc_kq_card_copy_counts($1,$2::UUID[]) data", [other, [support]])).data, { [support]: 1 });
    assert.deepEqual((await query("SELECT rpc_kq_card_copy_counts($1,'{}') data", [owner])).data, {});
  });
  await check("copy counts reflect burns immediately and respect requested definitions", async () => {
    await db.query("DELETE FROM lottery_card_instances WHERE id=(SELECT id FROM lottery_card_instances WHERE user_id=$1 AND card_definition_id=$2 LIMIT 1)", [owner, support]);
    assert.deepEqual((await query("SELECT rpc_kq_card_copy_counts($1,$2::UUID[]) data", [owner, [support]])).data, { [support]: 1504 });
  });
  await check("heritage summary counts all orders, units, purchases and crafted cards without history", async () => {
    const data = await snapshot();
    assert.equal(data.totalPulls, 1206);
    assert.equal(data.eligiblePurchaseUnits, 2410);
    assert.equal(data.attributedPurchaseUnits, 1205);
    assert.deepEqual(data.ownedCounts, { "HERITAGE-001": 1205, "HERITAGE-002": 1 });
    assert.deepEqual(data.producerNamesByCard, { "HERITAGE-001": ["Producteur A"], "HERITAGE-002": [] });
    assert.deepEqual(data.draws, []);
    assert.equal(data.fragmentBalance, 14);
    assert.equal(data.fragmentHistory.length, 20);
    assert.equal(data.fragmentHistory[0].amount, 1);
    assert.equal(data.fragmentHistory[19].amount, 20);
    assert(JSON.stringify(data).length < 4000);
  });
  await check("cancelled and unpaid purchases stop counting as eligible but keep owned cards", async () => {
    await db.exec("UPDATE orders SET status='cancelled' WHERE id='order-1'; UPDATE orders SET payment_state='pending' WHERE id='order-2'; INSERT INTO order_items VALUES(9999,'order-3','not-contest',100)");
    const data = await snapshot();
    assert.equal(data.eligiblePurchaseUnits, 2406);
    assert.equal(data.attributedPurchaseUnits, 1203);
    assert.equal(data.ownedCounts["HERITAGE-001"], 1205);
  });
  await check("admin history remains complete and totals prefer persisted player state", async () => {
    await db.query("INSERT INTO kq_heritage_player_state VALUES($1,1234)", [owner]);
    const data = await snapshot(owner, true);
    assert.equal(data.totalPulls, 1234);
    assert.equal(data.draws.length, 1206);
    assert(data.draws.every(draw => draw.card_code !== "HERITAGE-003"));
  });
  await check("a new player gets exact zero values and existing accounts never leak", async () => {
    const data = await snapshot("11000000-0000-4000-8000-000000000099");
    assert.deepEqual(data, { totalPulls: 0, eligiblePurchaseUnits: 0, attributedPurchaseUnits: 0, ownedCounts: {}, producerNamesByCard: {}, fragmentBalance: 0, fragmentHistory: [], draws: [] });
    const otherData = await snapshot(other);
    assert.deepEqual(otherData.ownedCounts, { "HERITAGE-003": 1 });
    assert.equal(otherData.fragmentBalance, 99);
    assert.equal(otherData.eligiblePurchaseUnits, 0);
  });
  await check("only service_role can execute these private collection readers", async () => {
    for (const signature of ["rpc_kq_card_copy_counts(uuid,uuid[])", "rpc_kq_heritage_snapshot(uuid,boolean)"]) {
      for (const role of ["anon", "authenticated"]) {
        assert.equal((await query("SELECT has_function_privilege($1,$2,'EXECUTE') allowed", [role, signature])).allowed, false);
      }
      assert.equal((await query("SELECT has_function_privilege('service_role',$1,'EXECUTE') allowed", [signature])).allowed, true);
    }
    await db.exec("SET LOCAL ROLE service_role");
    assert.equal((await snapshot()).ownedCounts["HERITAGE-001"], 1205);
  });
  console.log(`${checks} collection SQL checks passed.`);
} finally {
  await db.close();
}
