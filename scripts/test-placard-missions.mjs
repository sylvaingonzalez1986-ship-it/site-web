// Isolated PostgreSQL fixtures. No credentials and no production requests.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";
import { KQ_MISSION_COPY } from "../src/lib/kanab-quest-missions.ts";
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TABLE kq_runs(id UUID PRIMARY KEY,user_id UUID,status TEXT);
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),run_id UUID UNIQUE,owner_id UUID,variety_code TEXT,quality INTEGER,status TEXT);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY,clients INTEGER DEFAULT 0,shop_partners INTEGER DEFAULT 0);
    CREATE TABLE lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT,is_active BOOLEAN);
    CREATE TABLE kq_support_booster_entitlements(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users(id),ticket_id UUID,reward_key TEXT UNIQUE,
      source TEXT CONSTRAINT kq_support_booster_entitlements_source_check CHECK(source<>'mission'),
      CONSTRAINT kq_support_booster_entitlements_source_shape_check CHECK(reward_key IS NOT NULL),
      card_count INTEGER DEFAULT 10 CHECK(card_count BETWEEN 1 AND 10),status TEXT DEFAULT 'available',opened_at TIMESTAMPTZ);
    CREATE TYPE lottery_card_rarity AS ENUM('common','silver','gold');
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID,code TEXT,name TEXT,rarity lottery_card_rarity,is_active BOOLEAN,card_number INTEGER,image_url TEXT);
    CREATE TABLE lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,ticket_id UUID,kq_support_entitlement_id UUID,pack_slot INTEGER,card_definition_id UUID,UNIQUE(kq_support_entitlement_id,pack_slot));
    CREATE FUNCTION lottery_secure_random_int(a INTEGER,b INTEGER) RETURNS INTEGER LANGUAGE sql AS 'SELECT a';
    INSERT INTO lottery_card_collections(code,is_active) VALUES('BOTTE_DU_CHANVRIER_2026',true);
    INSERT INTO lottery_card_definitions(collection_id,code,name,rarity,is_active,card_number)
      SELECT id,'BOTTE-001','Test','common',true,1 FROM lottery_card_collections;
  `);
  await db.exec(await readFile("supabase/migrations/20260913000500_kq_mission_center.sql", "utf8"));
  const openingSql = await readFile("supabase/migrations/20260727000300_kq_pvp_three_card_booster.sql", "utf8");
  await db.exec(openingSql.slice(openingSql.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_open_support_booster"),openingSql.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle_for_both_players")));
  const user = randomUUID(), other = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1),($2)",[user,other]);
  const state = async (id=user) => (await db.query("SELECT rpc_kq_mission_state($1) AS result",[id])).rows[0].result;
  const claim = async (code,id=user) => (await db.query("SELECT rpc_kq_claim_mission($1,$2) AS result",[id,code])).rows[0].result;
  const grow = async (variety,quality=0,status="completed",owner=user,runOwner=owner) => {
    const id=randomUUID();
    await db.query("INSERT INTO kq_runs VALUES($1,$2,$3)",[id,runOwner,status]);
    await db.query("INSERT INTO kq_flowers(run_id,owner_id,variety_code,quality,status) VALUES($1,$2,$3,$4,'burned')",[id,owner,variety,quality]);
  };
  let snapshot=await state();
  assert.equal(snapshot.missions.length,9);
  assert.deepEqual(snapshot.missions.map(m=>m.code).sort(),Object.keys(KQ_MISSION_COPY).sort());
  assert.equal(snapshot.missions.reduce((n,m)=>n+m.cardCount,0),48);
  assert.equal(snapshot.missions.filter(m=>m.unlocked).length,3);
  assert(snapshot.missions.every(m=>m.progress===0&&!m.claimable));
  await assert.rejects(()=>claim("first-harvest"),/mission_not_ready/);
  await assert.rejects(()=>claim("__proto__"),/mission_unknown/);
  await grow("invalid",30,"active"); await grow("foreign",30,"completed",other); await grow("mismatch",30,"completed",user,other);
  assert((await state()).missions.every(m=>m.progress===0));
  await grow("A",9);
  const first=await claim("first-harvest");
  assert.equal(first.cardCount,3); assert.equal(first.replayed,false);
  assert.equal((await claim("first-harvest")).entitlementId,first.entitlementId);
  await assert.rejects(()=>claim("first-harvest",randomUUID()),/mission_not_ready/);
  // Opening uses the existing production draw function, preserving card inventory rules.
  let opened=(await db.query("SELECT rpc_kq_open_support_booster($1,$2) AS result",[first.entitlementId,user])).rows[0].result;
  assert.equal(opened.cards.length,3);
  assert.equal((await claim("first-harvest")).replayed,true);
  await assert.rejects(()=>db.query("SELECT rpc_kq_open_support_booster($1,$2)",[first.entitlementId,other]),/unavailable/);
  await grow("A",9); await grow("B",9);
  assert.equal((await state()).missions.find(m=>m.code==="three-varieties").progress,2);
  await assert.rejects(()=>claim("three-varieties"),/mission_not_ready/);
  await grow("C",9);
  await assert.rejects(()=>claim("contest-flower"),/mission_not_ready/);
  await claim("three-varieties");
  await assert.rejects(()=>claim("contest-flower"),/mission_not_ready/);
  await grow("C",10);
  const contest=await claim("contest-flower");
  opened=(await db.query("SELECT rpc_kq_open_support_booster($1,$2) AS result",[contest.entitlementId,user])).rows[0].result;
  assert.equal(opened.cards.length,10);
  await db.query("INSERT INTO kq_commerce_accounts VALUES($1,2,1)",[user]);
  assert.equal((await state()).missions.filter(m=>m.claimable).length,2);
  await db.query("UPDATE kq_commerce_accounts SET clients=1,shop_partners=0 WHERE user_id=$1",[user]);
  await assert.rejects(()=>claim("online-two"),/mission_not_ready/);
  await assert.rejects(()=>claim("shop-one"),/mission_not_ready/);
  await db.query("UPDATE kq_commerce_accounts SET clients=10,shop_partners=6 WHERE user_id=$1",[user]);
  await assert.rejects(()=>claim("online-ten"),/mission_not_ready/);
  await db.exec("UPDATE lottery_card_collections SET is_active=false");
  await assert.rejects(()=>claim("online-two"),/mission_collection_inactive/);
  await db.exec("UPDATE lottery_card_collections SET is_active=true");
  const duplicate=await Promise.all([claim("online-two"),claim("online-two")]);
  assert.equal(duplicate[0].entitlementId,duplicate[1].entitlementId);
  assert.equal(duplicate.filter(r=>!r.replayed).length,1);
  for(const code of ["online-five","online-ten","shop-one","shop-three","shop-six"]) await claim(code);
  await db.query("UPDATE kq_commerce_accounts SET clients=0,shop_partners=0 WHERE user_id=$1",[user]);
  snapshot=await state();
  assert(snapshot.missions.every(m=>m.claimed&&!m.claimable&&m.progress===m.target));
  assert.equal((await db.query("SELECT count(*)::INTEGER AS n FROM kq_support_booster_entitlements WHERE user_id=$1",[user])).rows[0].n,9);
  assert.equal((await state(other)).missions.filter(m=>m.claimed).length,0);
  for(const role of ["anon","authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(()=>state(),/permission denied/);
    await assert.rejects(()=>claim("online-two"),/permission denied/);
    await db.exec("RESET ROLE");
  }
  console.log("Missions SQL OK: official cultures, quality 9/10 boundary, distinct varieties, net audiences, prerequisites, 48-card cap, replay, ownership, inactive collection, 3/10-card opening and role restrictions.");
} finally { await db.close(); }
