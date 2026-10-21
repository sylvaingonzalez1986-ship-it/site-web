// Isolated PostgreSQL checks. No credentials, network or deployed database writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const readMigration = name => readFile(`supabase/migrations/${name}`, "utf8");
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await rows(sql, params))[0];
const executeFunction = async (migration, name) => {
  const text = await readMigration(migration);
  const start = text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `actual SQL function ${name}`);
  await db.exec(text.slice(start, text.indexOf("$$;", start) + 3));
};
const player = async () => {
  const id = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [id]);
  return id;
};
const claim = async owner => (await one("SELECT public.rpc_claim_welcome_pack($1) AS granted", [owner])).granted;
const starterTicket = async owner => (await one("SELECT ticket_id FROM lottery_welcome_pack_claims WHERE user_id=$1", [owner])).ticket_id;
const open = async (owner, ticket) => (await one("SELECT public.rpc_scratch_ticket($1,$2) AS result", [ticket, owner])).result;
const instances = owner => rows(`SELECT i.id,d.code,i.ticket_id,i.pack_slot FROM lottery_card_instances i
  JOIN lottery_card_definitions d ON d.id=i.card_definition_id WHERE i.user_id=$1 ORDER BY d.code,i.id`, [owner]);
const cycles = () => rows("SELECT * FROM lottery_draw_cycles ORDER BY id");
const legacy = async codes => {
  const owner = await player();
  await db.query("INSERT INTO lottery_welcome_pack_claims(user_id) VALUES($1)", [owner]);
  await db.query("SELECT rpc_admin_grant_lottery_tickets($1,1)", [owner]);
  const ticket = (await one("SELECT id FROM lottery_tickets WHERE user_id=$1", [owner])).id;
  for (const [index, code] of codes.entries()) await db.query(`INSERT INTO lottery_card_instances(user_id,ticket_id,pack_slot,card_definition_id)
    SELECT $1,$2,$3,id FROM lottery_card_definitions WHERE code=$4`, [owner, ticket, index + 1, code]);
  if (codes.length) await db.query("UPDATE lottery_tickets SET status='scratched',scratched_at=now() WHERE id=$1", [ticket]);
  return owner;
};

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS $$ SELECT NULL::UUID $$;
    CREATE TYPE public.lottery_card_rarity AS ENUM('common','silver','gold','epic','legendary');
    CREATE TYPE public.lottery_ticket_status AS ENUM('available','scratched');
    CREATE TABLE public.lottery_game_config(id INTEGER PRIMARY KEY,is_active BOOLEAN);
    INSERT INTO lottery_game_config VALUES(1,true);
    CREATE TABLE public.lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,title TEXT,is_active BOOLEAN DEFAULT true,created_at TIMESTAMPTZ DEFAULT now());
    INSERT INTO lottery_card_collections(code,title) VALUES('HEMP_HEROES_2026','Buddies'),('BOTTE_DU_CHANVRIER','Botte');
    CREATE TABLE public.lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID REFERENCES lottery_card_collections(id),
      code TEXT UNIQUE,card_number INTEGER,name TEXT,rarity lottery_card_rarity,visual_prompt TEXT DEFAULT '',description TEXT DEFAULT '',image_url TEXT DEFAULT '',is_active BOOLEAN DEFAULT true);
    INSERT INTO lottery_card_definitions(collection_id,code,card_number,name,rarity)
      SELECT c.id,'HH2026-'||lpad(n::TEXT,3,'0'),n,'Buddie '||n,'common' FROM lottery_card_collections c CROSS JOIN generate_series(20,26) n WHERE c.code='HEMP_HEROES_2026';
    INSERT INTO lottery_card_definitions(collection_id,code,card_number,name,rarity)
      SELECT id,'HH2026-009',9,'Gold Buddie','gold' FROM lottery_card_collections WHERE code='HEMP_HEROES_2026';
    INSERT INTO lottery_card_definitions(collection_id,code,card_number,name,rarity)
      SELECT id,'HH2026-053',53,'Not a playable Buddie','common' FROM lottery_card_collections WHERE code='HEMP_HEROES_2026';
    UPDATE lottery_card_definitions SET is_active=false WHERE code='HH2026-025';
    UPDATE lottery_card_definitions SET collection_id=(SELECT id FROM lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER') WHERE code='HH2026-026';
    CREATE TABLE public.lottery_tickets(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,order_id TEXT,
      ticket_number TEXT UNIQUE,order_amount NUMERIC,status lottery_ticket_status DEFAULT 'available',created_at TIMESTAMPTZ DEFAULT now(),scratched_at TIMESTAMPTZ,
      card_definition_id UUID,card_rarity lottery_card_rarity,sticker_id UUID,sticker_rarity TEXT,legendary_reward_claim_id UUID);
    CREATE TABLE public.lottery_ticket_counter(id INTEGER PRIMARY KEY,next_number INTEGER NOT NULL);
    CREATE TABLE public.lottery_audit_log(id BIGSERIAL PRIMARY KEY,event_type TEXT,user_id UUID,ticket_id UUID,details JSONB);
    CREATE TABLE public.lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      ticket_id UUID REFERENCES lottery_tickets(id),pack_slot INTEGER NOT NULL CHECK(pack_slot BETWEEN 1 AND 10),
      card_definition_id UUID REFERENCES lottery_card_definitions(id),kq_support_entitlement_id UUID,source_bot_battle_id UUID,pioneer_grant_id UUID,
      producer_purchase_buddie_grant_id UUID,community_mission_reward_id UUID,contest_bundle_order_id TEXT,game_mission_reward_id UUID,
      CONSTRAINT lottery_card_instances_ticket_slot_key UNIQUE(ticket_id,pack_slot),
      CONSTRAINT lottery_card_instances_source_required CHECK(ticket_id IS NOT NULL));
    CREATE TABLE public.lottery_draw_cycles(id INTEGER PRIMARY KEY,cycle_number INTEGER,completed_at TIMESTAMPTZ,total_packs INTEGER,packs_opened INTEGER,
      common_remaining INTEGER,silver_remaining INTEGER,gold_remaining INTEGER,epic_remaining INTEGER,legendary_remaining INTEGER);
    INSERT INTO lottery_draw_cycles VALUES(1,1,NULL,10000,0,30000,0,0,0,0);
    CREATE TABLE public.lottery_bonus_definitions(id UUID PRIMARY KEY,code TEXT,title TEXT,description TEXT,image_url TEXT);
    CREATE TABLE public.lottery_cycle_bonus_pool(cycle_id INTEGER,bonus_definition_id UUID,remaining INTEGER);
    CREATE TABLE public.lottery_bonus_instances(id UUID DEFAULT gen_random_uuid(),user_id UUID,ticket_id UUID,cycle_id INTEGER,bonus_definition_id UUID,status TEXT,created_at TIMESTAMPTZ);
    CREATE TABLE public.lottery_bonus_options(id UUID,bonus_definition_id UUID,label TEXT,kind TEXT,gift_weight_grams NUMERIC,gift_product_sku TEXT,gift_label TEXT,
      custom_payload JSONB,sort_order INTEGER,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
    -- Deterministic randomness forces duplicates in the ordinary implementation.
    CREATE FUNCTION public.lottery_secure_random_int(INTEGER,INTEGER) RETURNS INTEGER LANGUAGE sql AS $$ SELECT $1 $$;
    CREATE FUNCTION public.lottery_start_next_cycle(BOOLEAN DEFAULT false) RETURNS VOID LANGUAGE sql AS $$ SELECT $$;
  `);
  await executeFunction("20260228000800_lottery_dynamic_rewards.sql", "rpc_admin_grant_lottery_tickets");
  await db.exec(await readMigration("20260302003000_lottery_welcome_pack.sql"));
  await db.exec(await readMigration("20260302002200_lottery_bonus_replace_pack_slot.sql"));
  const original = (await one("SELECT pg_get_functiondef('rpc_scratch_ticket(uuid,uuid)'::regprocedure) AS source")).source;
  const empty = await legacy([]);
  const short = await legacy(["HH2026-020", "HH2026-020", "HH2026-021"]);
  const complete = await legacy(["HH2026-009", "HH2026-020", "HH2026-021"]);
  const invalid = await legacy(["HH2026-025", "HH2026-026", "HH2026-053"]);
  const unclaimed = await player();
  const legacyRows = await rows("SELECT * FROM lottery_card_instances ORDER BY id");
  const legacyTickets = await rows("SELECT * FROM lottery_tickets ORDER BY id");
  const initialCycle = await cycles();
  await db.exec(await readMigration("20261019000400_kq_starter_buddies.sql"));

  // Old draws and tickets are preserved. Only missing active, playable varieties
  // receive a separate receipt; inactive/wrong-collection/future cards don't count.
  assert.deepEqual(await rows("SELECT * FROM lottery_tickets ORDER BY id"), legacyTickets);
  for (const old of legacyRows) {
    const current = await one("SELECT * FROM lottery_card_instances WHERE id=$1", [old.id]);
    const { starter_buddie_recovery_id, ...existing } = current;
    assert.equal(starter_buddie_recovery_id, null);
    assert.deepEqual(existing, old);
  }
  assert.equal((await instances(empty)).length, 3);
  assert.equal((await instances(short)).length, 4);
  assert.equal((await instances(complete)).length, 3);
  assert.equal((await instances(invalid)).length, 6);
  assert.equal((await instances(unclaimed)).length, 0);
  assert.equal((await rows("SELECT * FROM kq_starter_buddie_recoveries")).length, 3);
  assert.equal(await claim(short), false);
  assert.equal((await instances(short)).length, 4);
  const recovery = await one("SELECT * FROM kq_starter_buddie_recoveries WHERE user_id=$1", [short]);
  await assert.rejects(() => db.query("DELETE FROM kq_starter_buddie_recoveries WHERE id=$1", [recovery.id]), /foreign key/);
  await assert.rejects(() => db.query("INSERT INTO kq_starter_buddie_recoveries(user_id,card_definition_ids) VALUES($1,$2)", [short, recovery.card_definition_ids]), /unique constraint/);
  assert.deepEqual(await cycles(), initialCycle);

  // The old body is only renamed; its ordinary replacement-bonus/rarity path is
  // byte-for-byte preserved and cannot be called directly by an API role.
  const ordinary = (await one("SELECT pg_get_functiondef('kq_scratch_ordinary_ticket(uuid,uuid)'::regprocedure) AS source")).source;
  assert.equal(ordinary.replace("FUNCTION public.kq_scratch_ordinary_ticket(", "FUNCTION public.rpc_scratch_ticket("), original);
  await db.query("SELECT rpc_admin_grant_lottery_tickets($1,1)", [unclaimed]);
  const normalTicket = (await one("SELECT id FROM lottery_tickets WHERE user_id=$1", [unclaimed])).id;
  const normal = await open(unclaimed, normalTicket);
  assert.equal(normal.cards.length, 3);
  assert.equal(new Set(normal.cards.map(card => card.code)).size, 1);
  assert.equal(normal.cycle.packsOpened, 1);
  assert.equal((await cycles())[0].common_remaining, 29997);
  await assert.rejects(() => open(unclaimed, normalTicket), /ticket_not_found_or_already_scratched/);

  const bonus = randomUUID();
  await db.query("INSERT INTO lottery_bonus_definitions(id,code,title,description,image_url) VALUES($1,'BONUS-1','Bonus','','')", [bonus]);
  await db.query("INSERT INTO lottery_cycle_bonus_pool VALUES(1,$1,1)", [bonus]);
  const owner = await player();
  assert.deepEqual(await Promise.all([claim(owner), claim(owner)]), [true, false]);
  const ticket = await starterTicket(owner);
  assert.equal((await rows("SELECT id FROM lottery_tickets WHERE user_id=$1", [owner])).length, 1);
  assert.equal((await instances(owner)).length, 0);
  const before = await cycles();
  await assert.rejects(() => open(unclaimed, ticket), /ticket_not_found_or_already_scratched/);
  const opened = await open(owner, ticket);
  assert.equal(opened.cards.length, 3);
  assert.equal(new Set(opened.cards.map(card => card.code)).size, 3);
  assert.ok(opened.cards.every(card => card.rarity === "common" && !card.isBonus && /^HH2026-02[0-4]$/.test(card.code)));
  assert.deepEqual(opened.cards.map(card => card.packSlot), [1, 2, 3]);
  const firstCard = { ...opened.cards[0] };
  delete firstCard.packSlot;
  assert.deepEqual(opened.card, firstCard);
  assert.equal(opened.inventory.uniqueOwned, 3);
  assert.equal(opened.inventory.totalOwnedCopies, 3);
  assert.equal(opened.bonusPrize, null);
  assert.equal(opened.cycle, undefined);
  assert.deepEqual(await open(owner, ticket), opened);
  assert.deepEqual(await open(owner, ticket), opened);
  assert.equal((await instances(owner)).length, 3);
  assert.deepEqual(await cycles(), before);
  assert.equal((await rows("SELECT * FROM lottery_bonus_instances")).length, 0);
  assert.equal((await one("SELECT remaining FROM lottery_cycle_bonus_pool WHERE bonus_definition_id=$1", [bonus])).remaining, 1);
  // The same available bonus still replaces an ordinary pack slot as before.
  await db.query("SELECT rpc_admin_grant_lottery_tickets($1,1)", [unclaimed]);
  const bonusTicket = (await one("SELECT id FROM lottery_tickets WHERE user_id=$1 AND status='available'", [unclaimed])).id;
  const ordinaryBonus = await open(unclaimed, bonusTicket);
  assert.equal(ordinaryBonus.cards.filter(card => card.isBonus).length, 1);
  assert.equal(ordinaryBonus.cards.filter(card => !card.isBonus).length, 2);
  assert.equal(ordinaryBonus.bonusPrize.id, bonus);
  assert.equal((await one("SELECT remaining FROM lottery_cycle_bonus_pool WHERE bonus_definition_id=$1", [bonus])).remaining, 0);

  // Failed claims roll back eligibility and the global counter. Failed openings
  // retain the ticket and cannot leave a partial 1/2-card pack behind.
  const unavailable = await player();
  const counter = await one("SELECT * FROM lottery_ticket_counter");
  await db.exec("UPDATE lottery_card_definitions SET is_active=false WHERE code IN ('HH2026-022','HH2026-023','HH2026-024')");
  await assert.rejects(() => claim(unavailable), /starter_buddies_unavailable/);
  assert.equal((await rows("SELECT * FROM lottery_welcome_pack_claims WHERE user_id=$1", [unavailable])).length, 0);
  assert.deepEqual(await one("SELECT * FROM lottery_ticket_counter"), counter);
  await db.exec("UPDATE lottery_card_definitions SET is_active=true WHERE code IN ('HH2026-022','HH2026-023','HH2026-024')");
  assert.equal(await claim(unavailable), true);
  const waiting = await starterTicket(unavailable);
  await db.exec("UPDATE lottery_card_definitions SET is_active=false WHERE code IN ('HH2026-022','HH2026-023','HH2026-024')");
  await assert.rejects(() => open(unavailable, waiting), /starter_buddies_unavailable/);
  assert.equal((await instances(unavailable)).length, 0);
  assert.equal((await one("SELECT status FROM lottery_tickets WHERE id=$1", [waiting])).status, "available");
  assert.equal((await one("SELECT opening_result FROM lottery_welcome_pack_claims WHERE user_id=$1", [unavailable])).opening_result, null);
  await db.exec("UPDATE lottery_card_definitions SET is_active=true WHERE code IN ('HH2026-022','HH2026-023','HH2026-024')");
  await db.exec("UPDATE lottery_game_config SET is_active=false");
  await assert.rejects(() => open(unavailable, waiting), /lottery_inactive/);
  assert.deepEqual(await open(owner, ticket), opened); // A receipt remains recoverable while paused.
  await db.exec("UPDATE lottery_game_config SET is_active=true");
  await open(unavailable, waiting);
  assert.equal((await instances(unavailable)).length, 3);

  for (const role of ["anon", "authenticated", "service_role"]) {
    const allowed = await one(`SELECT
      has_table_privilege($1,'kq_starter_buddie_recoveries','SELECT') AS ledger_read,
      has_table_privilege($1,'kq_starter_buddie_recoveries','INSERT') AS ledger_write,
      has_table_privilege($1,'lottery_welcome_pack_claims','UPDATE') AS claim_write,
      has_table_privilege($1,'lottery_welcome_pack_claims','SELECT') AS claim_read,
      has_function_privilege($1,'kq_starter_buddie_catalog()','EXECUTE') AS catalogue,
      has_function_privilege($1,'kq_scratch_ordinary_ticket(uuid,uuid)','EXECUTE') AS ordinary,
      has_function_privilege($1,'rpc_scratch_ticket(uuid,uuid)','EXECUTE') AS open,
      has_function_privilege($1,'rpc_claim_welcome_pack(uuid)','EXECUTE') AS claim`, [role]);
    assert.deepEqual(allowed, { ledger_read: false, ledger_write: false, claim_write: false, claim_read: role === "service_role",
      catalogue: false, ordinary: false, open: role === "service_role", claim: role === "service_role" });
  }
  assert.equal((await one("SELECT relrowsecurity FROM pg_class WHERE oid='kq_starter_buddie_recoveries'::regclass")).relrowsecurity, true);
  // A protected source cannot be removed on its own, but deleting the owning
  // account still cascades through its claims, tickets, copies and recoveries.
  for (const deleted of [owner, short]) {
    await db.query("DELETE FROM auth.users WHERE id=$1", [deleted]);
    for (const table of ["lottery_welcome_pack_claims", "lottery_tickets", "lottery_card_instances", "kq_starter_buddie_recoveries"])
      assert.equal((await rows(`SELECT * FROM ${table} WHERE user_id=$1`, [deleted])).length, 0);
  }
  console.log("Starter Buddies: PASS (3 distinct playable commons, one claim/ticket, receipt replay, old-account repair without rewriting history, ordinary draws unchanged, rollback and permissions).");
} catch (error) {
  console.error(error.stack?.split("\n").slice(0, 8).join("\n") ?? error.message);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
