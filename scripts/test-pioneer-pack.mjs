// Real PostgreSQL execution in an isolated in-memory database. No network or credentials.
// Setup: npm.cmd install --prefix output/reputation-test-tools --no-save --ignore-scripts --package-lock=false @electric-sql/pglite
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,email_confirmed_at TIMESTAMPTZ);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    -- Fixed clock permits exact testing of the future campaign cutoff without changing production SQL.
    CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$ SELECT current_setting('test.clock')::TIMESTAMPTZ $$;
    SELECT set_config('test.clock','2026-10-16 12:00:00+00',false);
    CREATE TYPE order_status AS ENUM('new','pending_payment','paid','processing','shipped','cancelled');
    CREATE TYPE payment_state AS ENUM('pending','paid','failed','not_configured');
    CREATE TABLE orders(id TEXT PRIMARY KEY,customer_id UUID REFERENCES auth.users,customer_email TEXT,created_at TIMESTAMPTZ DEFAULT now(),payment_state payment_state DEFAULT 'pending',status order_status DEFAULT 'new');
    CREATE TYPE lottery_card_rarity AS ENUM('common','silver','gold','epic','legendary');
    CREATE TABLE lottery_game_config(id INTEGER);
    CREATE TABLE lottery_tickets(id UUID PRIMARY KEY);
  `);
  const base = await readFile('supabase/migrations/20260228001200_lottery_tcg_collection.sql','utf8');
  // Actual collection, definition and instance tables before later source columns.
  await db.exec(base.slice(base.indexOf('CREATE TABLE IF NOT EXISTS public.lottery_card_collections'),base.indexOf('ALTER TABLE public.lottery_tickets')));
  await db.exec(`
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),cash_cents INTEGER NOT NULL DEFAULT 35000 CHECK(cash_cents>=0),updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_support_booster_entitlements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users(id),ticket_id UUID UNIQUE,reward_key TEXT UNIQUE,source TEXT NOT NULL DEFAULT 'ticket' CONSTRAINT kq_support_booster_entitlements_source_check CHECK(source<>'pioneer_pack'),
      CONSTRAINT kq_support_booster_entitlements_source_shape_check CHECK((source='ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR(source<>'ticket' AND ticket_id IS NULL AND reward_key IS NOT NULL)),
      card_count INTEGER NOT NULL DEFAULT 10 CHECK(card_count BETWEEN 1 AND 10),status TEXT NOT NULL DEFAULT 'available' CHECK(status IN('available','opened')),opened_at TIMESTAMPTZ,CHECK((status='opened')=(opened_at IS NOT NULL)));
    ALTER TABLE lottery_card_instances ALTER COLUMN ticket_id DROP NOT NULL,DROP CONSTRAINT lottery_card_instances_ticket_id_key,
      ADD COLUMN kq_support_entitlement_id UUID REFERENCES kq_support_booster_entitlements(id),ADD COLUMN source_bot_battle_id UUID,ADD COLUMN pack_slot INTEGER NOT NULL CHECK(pack_slot BETWEEN 1 AND 13),
      ADD CONSTRAINT lottery_card_instances_source_required CHECK(ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL OR source_bot_battle_id IS NOT NULL),ADD UNIQUE(kq_support_entitlement_id,pack_slot);
    -- Deterministic draws make rarity/collection assertions reproducible; production uses its secure RNG.
    CREATE FUNCTION lottery_secure_random_int(a INTEGER,b INTEGER) RETURNS INTEGER LANGUAGE sql AS $$ SELECT a $$;
    INSERT INTO lottery_card_collections(code,title) VALUES('HEMP_HEROES_2026','Buddies'),('BOTTE_DU_CHANVRIER_2026','La Botte');
    INSERT INTO lottery_card_definitions(collection_id,code,card_number,name,rarity)
      SELECT id,'TEST-GOLD-'||n,n,'Gold '||n,'gold' FROM lottery_card_collections CROSS JOIN generate_series(1,3) n WHERE code='HEMP_HEROES_2026';
    INSERT INTO lottery_card_definitions(collection_id,code,card_number,name,rarity)
      SELECT id,'BOTTE-001',1,'Botte common','common' FROM lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026';
  `);
  await db.exec(await readFile('supabase/migrations/20260919000300_kq_pioneer_pack.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20260919000400_kq_pioneer_pack_opening.sql','utf8'));
  await db.exec("SELECT set_config('test.clock','2026-10-14 21:59:59+00',false)");
  await assert.rejects(db.query("SELECT rpc_kq_claim_pioneer_pack('00000000-0000-0000-0000-000000000001')"), /pioneer_not_open/);
  await db.exec("SELECT set_config('test.clock','2026-10-15 00:00:00 Europe/Paris',false)");
  const opening = await readFile('supabase/migrations/20260727000300_kq_pvp_three_card_booster.sql','utf8');
  await db.exec(opening.slice(opening.indexOf('CREATE OR REPLACE FUNCTION public.rpc_kq_open_support_booster'),opening.indexOf('CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle_for_both_players')));
  const user = async (verified=true) => { const id=randomUUID(); await db.query("INSERT INTO auth.users VALUES($1,$2,CASE WHEN $3 THEN now() END)",[id,id+'@example.invalid',verified]); return id; };
  const order = async (id,{date='2026-02-01 00:00:00+00',paid=true,status='paid',guest=false,email=id+'@example.invalid'}={}) => {
    const orderId=randomUUID(); await db.query('INSERT INTO orders VALUES($1,$2,$3,$4,$5,$6)',[orderId,guest?null:id,email,date,paid?'paid':'pending',status]); return orderId;
  };
  const scalar = async (sql,args=[]) => Object.values((await db.query(sql,args)).rows[0])[0];
  const state = id => scalar('SELECT rpc_kq_pioneer_pack_state($1)',[id]);
  const claim = id => scalar('SELECT rpc_kq_claim_pioneer_pack($1)',[id]);
  const cash = id => scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[id]);
  const count = (table,id) => scalar('SELECT count(*)::INTEGER FROM '+table+' WHERE user_id=$1',[id]);

  const old=await user(); await order(old,{date:'2020-01-01 00:00:00+00'}); await order(old);
  assert.equal((await state(old)).eligible,true,'site history has no lower bound');
  assert.equal(await count('kq_pioneer_pack_grants',old),0,'GET state must not credit');
  const first=await claim(old), replay=await claim(old);
  assert.equal(first.replayed,false); assert.equal(replay.replayed,true);
  assert.equal(first.cashCents,100000); assert.equal(first.packCount,10);
  assert.equal(first.goldCard.code,'TEST-GOLD-1'); assert.deepEqual(replay.goldCard,first.goldCard);
  assert.equal(await cash(old),135000,'default starting cash plus 1000 euros');
  assert.equal(await count('lottery_card_instances',old),2);
  assert.equal(await count('kq_support_booster_entitlements',old),10);
  assert.equal(await count('kq_pioneer_pack_grants',old),1);
  assert.equal(await scalar("SELECT count(*)::INTEGER FROM lottery_card_instances i JOIN lottery_card_definitions d ON d.id=i.card_definition_id WHERE i.user_id=$1 AND d.code='PIONEER-2026-001'",[old]),1);
  assert.equal(await scalar("SELECT is_active FROM lottery_card_collections WHERE code='PIONEERS_2026'"),false);
  assert.equal(await scalar("SELECT is_active FROM lottery_card_definitions WHERE code='PIONEER-2026-001'"),false);

  const edge=await user(); await order(edge,{date:'2026-10-10 23:59:59.999999 Europe/Paris'});
  assert.equal((await state(edge)).eligible,true,'last microsecond of 10 October included');
  const cutoff=await user(); await order(cutoff,{date:'2026-10-11 00:00:00 Europe/Paris'});
  assert.equal((await state(cutoff)).eligible,false,'11 October excluded');
  const unpaid=await user(); await order(unpaid,{paid:false});
  const cancelled=await user(); await order(cancelled,{status:'cancelled'});
  const empty=await user();
  for (const id of [cutoff,unpaid,cancelled,empty]) {
    await assert.rejects(()=>claim(id),/pioneer_not_eligible/);
    assert.equal(await count('kq_pioneer_pack_grants',id),0);
    assert.equal(await count('kq_equipment_wallets',id),0);
  }
  const guest=await user(); await order(guest,{guest:true,email:'  '+guest.toUpperCase()+'@EXAMPLE.INVALID  '});
  assert.equal((await state(guest)).eligible,true,'verified guest email matches normalized address');
  const unverified=await user(false); await order(unverified,{guest:true});
  assert.equal((await state(unverified)).eligible,false);
  const owner=await user(), imposter=await user(); await order(owner,{email:imposter+'@example.invalid'});
  assert.equal((await state(imposter)).eligible,false,'linked order never reassigned by email');
  assert.equal((await state(owner)).eligible,true);
  // Existing wallets and simultaneous requests preserve balances and the original draw.
  await db.query('INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES($1,87654)',[edge]);
  const duplicates=await Promise.all([claim(edge),claim(edge)]);
  assert.equal(duplicates.filter(value=>!value.replayed).length,1);
  assert.equal(await cash(edge),187654);
  assert.equal(await count('kq_support_booster_entitlements',edge),10);
  // Missing catalog content leaves every reward untouched.
  await db.exec("UPDATE lottery_card_collections SET is_active=false WHERE code='BOTTE_DU_CHANVRIER_2026'");
  await assert.rejects(()=>claim(guest),/pioneer_unavailable/);
  assert.equal(await count('kq_pioneer_pack_grants',guest),0);
  await db.exec("UPDATE lottery_card_collections SET is_active=true WHERE code='BOTTE_DU_CHANVRIER_2026'");
  // A late insert failure rolls back cash, card instances and the attribution ledger together.
  await db.query("INSERT INTO kq_support_booster_entitlements(user_id,source,reward_key) VALUES($1,'mission',$2)",[guest,'kq-pioneer:2026:'+guest+':10']);
  await assert.rejects(()=>claim(guest),/unique constraint/);
  assert.equal(await count('kq_pioneer_pack_grants',guest),0);
  assert.equal(await count('lottery_card_instances',guest),0);
  assert.equal(await count('kq_equipment_wallets',guest),0);
  await db.query('DELETE FROM kq_support_booster_entitlements WHERE user_id=$1',[guest]);
  await claim(guest);
  // Packs use the unchanged real opening RPC and deliver ten cards from La Botte.
  const pack=await scalar('SELECT id FROM kq_support_booster_entitlements WHERE user_id=$1 LIMIT 1',[old]);
  await assert.rejects(()=>scalar('SELECT rpc_kq_open_support_booster($1,$2)',[pack,guest]),/unavailable/);
  const opened=await scalar('SELECT rpc_kq_open_support_booster($1,$2)',[pack,old]);
  assert.equal(opened.cards.length,10); assert(opened.cards.every(card=>card.code==='BOTTE-001'));
  await assert.rejects(()=>scalar('SELECT rpc_kq_open_support_booster($1,$2)',[pack,old]),/unavailable/);
  await claim(old); assert.equal(await count('lottery_card_instances',old),12);
  // The upper RNG bound still selects an active gold Buddie, never another collection or inactive card.
  const upper=await user(); await order(upper);
  await db.exec("INSERT INTO lottery_card_definitions(collection_id,code,card_number,name,rarity,is_active) SELECT id,'INACTIVE-GOLD',4,'Inactive','gold',false FROM lottery_card_collections WHERE code='HEMP_HEROES_2026'");
  await db.exec("INSERT INTO lottery_card_definitions(collection_id,code,card_number,name,rarity) SELECT id,'OTHER-GOLD',2,'Other collection','gold' FROM lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026'");
  await db.exec('CREATE OR REPLACE FUNCTION lottery_secure_random_int(a INTEGER,b INTEGER) RETURNS INTEGER LANGUAGE sql AS $$ SELECT b $$');
  assert.equal((await claim(upper)).goldCard.code,'TEST-GOLD-3');
  // Normal order cleanup cannot remove a collected gift or block archive operations.
  await db.query('DELETE FROM orders WHERE customer_id=$1',[old]);
  assert.equal((await state(old)).claimed,true);
  assert.equal((await claim(old)).replayed,true);
  // Batch preview and pagination; apply is idempotent for everyone, including prior claims.
  const before=await scalar('SELECT count(*)::INTEGER FROM kq_pioneer_pack_grants');
  const batch=async apply=>{let cursor=null,total=0;do {const result=await scalar('SELECT rpc_kq_pioneer_pack_batch($1,2,$2)',[cursor,apply]);cursor=result.nextCursor;total+=result.granted;}while(cursor);return total;};
  assert.equal(await batch(false),0); assert.equal(await scalar('SELECT count(*)::INTEGER FROM kq_pioneer_pack_grants'),before);
  assert.equal(await batch(true),1); assert.equal(await batch(true),0);
  await assert.rejects(()=>scalar('SELECT rpc_kq_pioneer_pack_batch(NULL,101,true)'),/invalid_limit/);
  // RLS and service-only RPC access prevent cross-account reads and self-crediting.
  await db.exec("GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role; SET ROLE authenticated");
  for(const fn of ['rpc_kq_pioneer_pack_state','rpc_kq_claim_pioneer_pack','kq_pioneer_qualifying_order']) await assert.rejects(()=>scalar('SELECT '+fn+'($1)',[old]),/permission denied/);
  await assert.rejects(()=>scalar('SELECT rpc_kq_pioneer_pack_batch(NULL,1,true)'),/permission denied/);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[old]);
  assert.equal(await scalar('SELECT count(*)::INTEGER FROM kq_pioneer_pack_grants'),1);
  assert.equal(await scalar('SELECT count(*)::INTEGER FROM kq_pioneer_pack_grants WHERE user_id=$1',[guest]),0);
  await db.exec('RESET ROLE; SET ROLE service_role');
  assert.equal((await state(old)).claimed,true);
  await db.exec('RESET ROLE');
  console.log('Pioneer pack SQL passed: exact Paris cutoff, history, guest eligibility, 1000 euros, random-gold pool, 10 working packs, replay, rollback, batch and access controls.');
} catch (error) { console.error(error.message, error.detail || "", error.where || ""); process.exitCode=1; } finally { await db.close(); }
