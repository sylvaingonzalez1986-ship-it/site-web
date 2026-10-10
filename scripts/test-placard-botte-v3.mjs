// Local PostgreSQL integration tests; no credentials or production connection.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
const migration = name => readFile(path.join("supabase/migrations", name), "utf8");
const query = (sql, args = []) => db.query(sql, args);
const scalar = async (sql, args = []) => Object.values((await query(sql, args)).rows[0])[0];
const checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const reject = async (name, fn, text) => { await assert.rejects(fn, error => error.message.includes(text), name); checks.push(name); };
const selectRarity = roll => query("UPDATE fixture_draw SET roll=$1", [roll]);
const archived = ["BOTTE-002", "BOTTE-004", "BOTTE-010", "BOTTE-011", "BOTTE-012", "BOTTE-022", "BOTTE-023", "BOTTE-025"];
const owner = randomUUID();
try {
  const { KQ_ACTIVE_CARDS, KQ_CARDS, KQ_RETIRED_CARDS, startKqGame, playKqCard } = await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts");
  const { getKqCardArtwork } = await vite.ssrLoadModule("/src/lib/kanab-quest-artwork.ts");
  const sql = await migration("20261010000500_botte_situations_epic.sql");
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TYPE lottery_card_rarity AS ENUM('common','silver','gold','epic','legendary');
    CREATE TABLE lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,is_active BOOLEAN DEFAULT true);
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID REFERENCES lottery_card_collections,
      code TEXT UNIQUE,card_number INTEGER,name TEXT,rarity lottery_card_rarity,description TEXT,visual_prompt TEXT,image_url TEXT,
      is_active BOOLEAN DEFAULT true,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_support_card_rules(card_definition_id UUID PRIMARY KEY REFERENCES lottery_card_definitions,category TEXT,timing TEXT,
      effect TEXT CONSTRAINT kq_support_card_rules_effect_check CHECK(effect='reroll-neutral'),xp_cost SMALLINT,tags TEXT[],targets TEXT[],
      advantage TEXT,drawback TEXT,rules_version SMALLINT DEFAULT 1,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,card_definition_id UUID REFERENCES lottery_card_definitions,
      ticket_id UUID,kq_support_entitlement_id UUID,source_bot_battle_id UUID,pack_slot INTEGER,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_support_booster_entitlements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,ticket_id UUID,
      status TEXT DEFAULT 'available',card_count INTEGER DEFAULT 10,opened_at TIMESTAMPTZ);
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,status TEXT DEFAULT 'active',state JSONB,deck_codes TEXT[],updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_card_burn_receipts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),run_id UUID,user_id UUID,card_instance_id UUID UNIQUE,
      card_definition_id UUID REFERENCES lottery_card_definitions,card_code TEXT,stage_index SMALLINT,use_kind TEXT,burned_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_id UUID,status TEXT DEFAULT 'available',locked_at TIMESTAMPTZ,burned_at TIMESTAMPTZ);
    CREATE TABLE kq_bot_battles(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,flower_id UUID UNIQUE,bot_code TEXT,bot_flower JSONB,seed INTEGER,
      rounds JSONB,winner TEXT,experience_awarded NUMERIC DEFAULT 0.1,verdict_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_rank_profiles(user_id UUID PRIMARY KEY,season_code TEXT,arena_experience NUMERIC,burned_flowers INTEGER,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE FUNCTION kq_active_season_code() RETURNS TEXT LANGUAGE sql AS $$ SELECT 'KQ-TEST' $$;
    CREATE TABLE fixture_draw(roll INTEGER); INSERT INTO fixture_draw VALUES(1);
    CREATE FUNCTION lottery_secure_random_int(lo INTEGER,hi INTEGER) RETURNS INTEGER LANGUAGE sql AS $$
      SELECT CASE WHEN lo=1 AND hi=100 THEN (SELECT roll FROM fixture_draw) ELSE lo END $$;
    INSERT INTO lottery_card_collections(code) VALUES('BOTTE_DU_CHANVRIER_2026');
  `);
  for (const card of [...KQ_CARDS, ...KQ_RETIRED_CARDS].filter(card => Number(card.code.slice(-3)) <= 36)) {
    await query("INSERT INTO lottery_card_definitions(collection_id,code,card_number,name,rarity,is_active) SELECT id,$1,$2,$3,'common',$4 FROM lottery_card_collections", [card.code, Number(card.code.slice(-3)), card.name, card.category !== "substrate"]);
    await query("INSERT INTO kq_support_card_rules(card_definition_id,category,effect) SELECT id,$2,'reroll-neutral' FROM lottery_card_definitions WHERE code=$1", [card.code, card.category]);
    await query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions WHERE code=$2", [owner, card.code]);
  }
  const beforeCopies = (await query("SELECT * FROM lottery_card_instances ORDER BY id")).rows;
  const beforeIds = (await query("SELECT code,id FROM lottery_card_definitions ORDER BY code")).rows;
  const source = await migration("20260727000200_kq_bot_victory_card_reward.sql");
  await db.exec(source.slice(source.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_bot_battle"), source.indexOf("COMMIT;")));
  await db.exec(await migration("20260725000300_kq_atomic_support_card_play.sql"));
  await db.exec(await migration("20260726000300_kq_fix_support_card_category_validation.sql"));
  const editor = await migration("20260802000200_kq_botte_catalog_editor.sql");
  await db.exec(editor.slice(editor.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_update_botte_card_editorial"), editor.indexOf("COMMIT;")));
  await db.exec(sql);
  check("all existing instances survive archival", (await query("SELECT * FROM lottery_card_instances ORDER BY id")).rows, beforeCopies);
  check("existing definition IDs remain stable", (await query("SELECT code,id FROM lottery_card_definitions WHERE card_number<=36 ORDER BY code")).rows, beforeIds);
  check("exactly thirty active definitions", await scalar("SELECT count(*)::integer FROM lottery_card_definitions WHERE is_active"), 30);
  check("six health cards and two observations are archived", await scalar("SELECT count(*)::integer FROM lottery_card_definitions WHERE code=ANY($1) AND NOT is_active", [archived]), 8);
  const rarityMapping = { common: "common", uncommon: "silver", rare: "gold", epic: "epic" };
  for (const card of KQ_ACTIVE_CARDS) {
    const row = (await query("SELECT d.name,d.description,d.rarity,d.image_url,r.category,r.timing,r.effect,r.xp_cost,r.tags,r.targets,r.situation_codes FROM lottery_card_definitions d JOIN kq_support_card_rules r ON r.card_definition_id=d.id WHERE d.code=$1", [card.code])).rows[0];
    check(`SQL/TS catalog parity ${card.code}`, row, {
      name: card.name, description: card.description, rarity: rarityMapping[card.rarity], image_url: getKqCardArtwork(card.code),
      category: card.category, timing: card.timing, effect: card.effect, xp_cost: card.xpCost,
      tags: card.tags, targets: card.targets ?? [], situation_codes: card.situationCodes ?? [],
    });
  }
  const counts = { common: 0, silver: 0, gold: 0, epic: 0 };
  for (let roll = 1; roll <= 100; roll++) {
    await selectRarity(roll);
    const card = (await query("SELECT * FROM kq_pick_support_card(false)")).rows[0];
    counts[card.rarity]++;
    assert.ok(KQ_ACTIVE_CARDS.some(item => item.code === card.code));
  }
  check("exact rarity probabilities across all one hundred outcomes", counts, { common: 70, silver: 23, gold: 6, epic: 1 });
  await selectRarity(100);
  check("guaranteed common ignores the random epic outcome", (await query("SELECT * FROM kq_pick_support_card(true)")).rows[0].rarity, "common");
  const entitlement = await scalar("INSERT INTO kq_support_booster_entitlements(user_id) VALUES($1) RETURNING id", [owner]);
  const pack = await scalar("SELECT rpc_kq_open_support_booster($1,$2)", [entitlement, owner]);
  check("first common plus nine random epics at the one-percent boundary", pack.cards.map(card => card.rarity), ["common", ...Array(9).fill("epic")]);
  check("pack grants ten owned instances", await scalar("SELECT count(*)::integer FROM lottery_card_instances WHERE kq_support_entitlement_id=$1", [entitlement]), 10);
  await reject("same pack cannot be opened twice", () => scalar("SELECT rpc_kq_open_support_booster($1,$2)", [entitlement, owner]), "Support booster unavailable");
  const unavailablePack = await scalar("INSERT INTO kq_support_booster_entitlements(user_id) VALUES($1) RETURNING id", [owner]);
  await query("UPDATE lottery_card_definitions SET is_active=false WHERE rarity='epic'");
  await reject("missing rarity fails without silently changing the odds", () => scalar("SELECT rpc_kq_open_support_booster($1,$2)", [unavailablePack, owner]), "kq_support_rarity_unavailable");
  check("failed pack opening rolls back its first common copy", await scalar("SELECT count(*)::integer FROM lottery_card_instances WHERE kq_support_entitlement_id=$1", [unavailablePack]), 0);
  check("failed pack remains available", await scalar("SELECT status FROM kq_support_booster_entitlements WHERE id=$1", [unavailablePack]), "available");
  await query("UPDATE lottery_card_definitions SET is_active=true WHERE rarity='epic'");
  for (const [roll, rarity] of [[1,"common"],[71,"silver"],[94,"gold"],[100,"epic"]]) {
    await selectRarity(roll);
    const flower = await scalar("INSERT INTO kq_flowers(owner_id) VALUES($1) RETURNING id", [owner]);
    const receipt = await scalar("SELECT rpc_kq_finalize_bot_battle($1,$2,'bot-test','{}',7,'[1,2,3]','player')", [owner, flower]);
    check(`bot victory shares ${rarity} rarity boundary`, receipt.rewardCard.rarity, rarity);
    await reject(`bot reward ${rarity} cannot be claimed twice`, () => scalar("SELECT rpc_kq_finalize_bot_battle($1,$2,'bot-test','{}',7,'[1,2,3]','player')", [owner, flower]), "kq_flower_unavailable");
  }

  async function run(state) {
    const id = await scalar("INSERT INTO kq_runs(user_id,state,deck_codes) VALUES($1,$2,$3) RETURNING id", [owner, JSON.stringify(state), state.deckCodes]);
    return (await query("SELECT id,state,updated_at::text AS updated_at FROM kq_runs WHERE id=$1", [id])).rows[0];
  }
  async function grant(code) { await query("INSERT INTO lottery_card_instances(user_id,card_definition_id) SELECT $1,id FROM lottery_card_definitions WHERE code=$2", [owner, code]); }
  async function play(row, code, next, kind="support") {
    return scalar("SELECT rpc_kq_play_support_card($1,$2,$3,$4::smallint,$5,$6,$7)", [owner,row.id,code,row.state.stageIndex,kind,row.updated_at,JSON.stringify(next)]);
  }
  const base = startKqGame(42, { startingXp: 9, deckCodes: ["BOTTE-039","BOTTE-040"], collectionCodes: ["BOTTE-039","BOTTE-040"] });
  const state = { ...base, handCodes: ["BOTTE-039","BOTTE-040"], phase: "rolled", dice: [1,2,4], situationCodes: ["SIT-001",...base.situationCodes.slice(1)] };
  const row = await run(state);
  await grant("BOTTE-039"); await grant("BOTTE-040");
  const next = playKqCard(state,"BOTTE-039");
  assert.notEqual(next,state);
  const first = await play(row,"BOTTE-039",next);
  check("epic use creates exactly one atomic burn receipt", first.burnReceipt.card_code, "BOTTE-039");
  await reject("replaying the same state does not consume another copy", () => play(row,"BOTTE-039",next), "kq_stale_run");
  await query("UPDATE kq_runs SET state=jsonb_set(jsonb_set(state,'{situationCodes,0}','\"SIT-004\"'),'{playedThisStage}','[]') WHERE id=$1", [row.id]);
  const secondRow = (await query("SELECT id,state,updated_at::text AS updated_at FROM kq_runs WHERE id=$1", [row.id])).rows[0];
  const forged = { ...secondRow.state, usedCards: [...secondRow.state.usedCards,"BOTTE-040"], playedThisStage: ["BOTTE-040"] };
  const beforeSecond = await scalar("SELECT count(*)::integer FROM lottery_card_instances WHERE user_id=$1 AND card_definition_id=(SELECT id FROM lottery_card_definitions WHERE code='BOTTE-040')", [owner]);
  await reject("second epic rejected under the run lock", () => play(secondRow,"BOTTE-040",forged), "kq_epic_already_played");
  check("rejected epic keeps the remaining copy", await scalar("SELECT count(*)::integer FROM lottery_card_instances WHERE user_id=$1 AND card_definition_id=(SELECT id FROM lottery_card_definitions WHERE code='BOTTE-040')", [owner]), beforeSecond);
  check("rejected epic creates no receipt", await scalar("SELECT count(*)::integer FROM kq_card_burn_receipts WHERE run_id=$1", [row.id]), 1);
  const mismatch = await run({ ...state, situationCodes: ["SIT-024",...state.situationCodes.slice(1)] });
  await reject("server rejects a card for an unrelated situation", () => play(mismatch,"BOTTE-039",{ ...mismatch.state,usedCards:["BOTTE-039"],playedThisStage:["BOTTE-039"] }), "kq_support_situation_mismatch");
  const obsolete = await run({ ...base, deckCodes:["BOTTE-004"], handCodes:["BOTTE-004"] });
  await reject("archived observation rejected in a current culture", () => play(obsolete,"BOTTE-004",{ ...obsolete.state,usedCards:["BOTTE-004"],playedThisStage:["BOTTE-004"] }), "kq_support_card_archived");
  const oldId = await scalar("SELECT id FROM lottery_card_definitions WHERE code='BOTTE-002'");
  await reject("editor cannot reactivate an archived PBI", () => scalar("SELECT rpc_kq_update_botte_card_editorial($1,'Chrysope','silver','ancien texte','image',true,'ancien avantage','')",[oldId]), "kq_support_card_archived");
  const epicId = await scalar("SELECT id FROM lottery_card_definitions WHERE code='BOTTE-039'");
  const commonId = await scalar("SELECT id FROM lottery_card_definitions WHERE code='BOTTE-037'");
  const originalEpic = (await query("SELECT name,rarity FROM lottery_card_definitions WHERE id=$1", [epicId])).rows[0];
  await reject("editor cannot downgrade an epic and bypass the draw odds", () => scalar("SELECT rpc_kq_update_botte_card_editorial($1,'Nouveau nom','common','description','image',true,'avantage','')",[epicId]), "kq_botte_rarity_locked");
  await reject("editor cannot promote an ordinary card to epic", () => scalar("SELECT rpc_kq_update_botte_card_editorial($1,'Nouveau nom','epic','description','image',true,'avantage','')",[commonId]), "kq_botte_rarity_locked");
  check("rejected rarity edit preserves all editorial fields", (await query("SELECT name,rarity FROM lottery_card_definitions WHERE id=$1", [epicId])).rows[0], originalEpic);
  await reject("generic lottery update cannot bypass the rarity guard", () => query("UPDATE lottery_card_definitions SET rarity='common' WHERE id=$1",[epicId]), "kq_botte_rarity_locked");
  await scalar("SELECT rpc_kq_update_botte_card_editorial($1,'Nom corrigé','epic','description','image',true,'avantage','')",[epicId]);
  check("editorial correction remains possible at the official rarity", (await query("SELECT name,rarity FROM lottery_card_definitions WHERE id=$1", [epicId])).rows[0], {name:"Nom corrigé",rarity:"epic"});
  await query("INSERT INTO lottery_card_definitions(code,name,rarity) VALUES('OTHER-COLLECTION','autre','common')");
  await query("UPDATE lottery_card_definitions SET rarity='legendary' WHERE code='OTHER-COLLECTION'");
  check("other collections retain independent rarity editing", await scalar("SELECT rarity FROM lottery_card_definitions WHERE code='OTHER-COLLECTION'"), "legendary");
  check("draw helper inaccessible through API roles", await scalar("SELECT has_function_privilege('service_role','public.kq_pick_support_card(boolean)','EXECUTE')"), false);
  check("pack RPC remains service only", (await query("SELECT has_function_privilege('service_role','public.rpc_kq_open_support_booster(uuid,uuid)','EXECUTE') AS service,has_function_privilege('anon','public.rpc_kq_open_support_booster(uuid,uuid)','EXECUTE') AS anon")).rows[0], {service:true,anon:false});
  console.log(`Botte PostgreSQL: ${checks.length} checks passed; catalog, odds, bot rewards, archives, atomic epic consumption.`);
} finally { await db.close(); await vite.close(); }
