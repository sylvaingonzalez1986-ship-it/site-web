// Isolated PostgreSQL fixture: no credentials or production connection.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";
const sql = await readFile("supabase/migrations/20260913000600_kq_indoor_deck_redesign.sql", "utf8");
const cards = JSON.parse(sql.split("$deck$")[1]);
const db = new PGlite();
try {
  await db.exec(`
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,name TEXT,description TEXT,image_url TEXT,rarity TEXT,is_active BOOLEAN,updated_at TIMESTAMPTZ);
    CREATE TABLE kq_support_card_rules(card_definition_id UUID PRIMARY KEY REFERENCES lottery_card_definitions(id),category TEXT,timing TEXT,effect TEXT CONSTRAINT kq_support_card_rules_effect_check CHECK(effect='reroll-neutral'),xp_cost SMALLINT,tags TEXT[],targets TEXT[],advantage TEXT,drawback TEXT,rules_version SMALLINT DEFAULT 1,updated_at TIMESTAMPTZ);
    CREATE TABLE lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),card_definition_id UUID REFERENCES lottery_card_definitions(id),user_id UUID DEFAULT gen_random_uuid());
  `);
  for (const card of cards) {
    await db.query("INSERT INTO lottery_card_definitions(code,name,rarity,is_active) VALUES($1,'ancien nom','silver',true)",[card.code]);
    await db.query("INSERT INTO kq_support_card_rules(card_definition_id,effect) SELECT id,'reroll-neutral' FROM lottery_card_definitions WHERE code=$1",[card.code]);
    await db.query("INSERT INTO lottery_card_instances(card_definition_id) SELECT id FROM lottery_card_definitions WHERE code=$1",[card.code]);
  }
  await db.exec("INSERT INTO lottery_card_definitions(code,name,rarity,is_active) VALUES('BOTTE-001','archive','common',false)");
  const snapshot = async () => ({
    definitions: (await db.query("SELECT id,code,rarity,is_active FROM lottery_card_definitions ORDER BY code")).rows,
    copies: (await db.query("SELECT * FROM lottery_card_instances ORDER BY id")).rows,
  });
  const before = await snapshot();
  await db.exec(sql);
  assert.deepEqual(await snapshot(), before);
  const actual = (await db.query("SELECT d.code,d.name,d.description,d.image_url,r.effect,r.tags,r.targets,r.rules_version FROM lottery_card_definitions d JOIN kq_support_card_rules r ON r.card_definition_id=d.id ORDER BY d.code")).rows;
  for (const card of cards) {
    const row = actual.find((item) => item.code === card.code);
    for (const key of ["name","description","image_url","effect","tags","targets"]) assert.deepEqual(row[key],card[key]);
    assert.equal(row.rules_version,2);
  }
  assert.equal((await db.query("SELECT name FROM lottery_card_definitions WHERE code='BOTTE-001'")).rows[0].name,"archive");
  await db.exec("DELETE FROM kq_support_card_rules WHERE card_definition_id=(SELECT id FROM lottery_card_definitions WHERE code='BOTTE-019')");
  await assert.rejects(()=>db.exec(sql),/indoor_deck_catalog_incomplete/);
  await db.exec("ROLLBACK");
  assert.equal((await db.query("SELECT max(rules_version) AS version FROM kq_support_card_rules")).rows[0].version,2);
  console.log("PostgreSQL local : 32 définitions synchronisées, exemplaires et raretés préservés, catalogue incomplet refusé sans mise à jour partielle.");
} finally { await db.close(); }
