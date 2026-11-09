// Isolated PostgreSQL verification; no credentials or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { KQ_MISSION_DEFINITIONS } from "../../../src/lib/kanab-quest-missions.ts";
import { getKqMissionLevel } from "../../../src/lib/kanab-quest-mission-progression.ts";

const db = new PGlite();
const sql = name => readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
const scalar = async (query, values = []) => Object.values((await db.query(query, values)).rows[0])[0];
let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const reject = async (fn, message) => { await assert.rejects(fn, error => error.message.includes(message)); checks++; };
const state = owner => scalar("SELECT rpc_kq_mission_state($1)", [owner]);
const claim = (owner, code) => scalar("SELECT rpc_kq_claim_mission($1,$2)", [owner, code]);
const mission = async (owner, code) => (await state(owner)).missions.find(item => item.code === code);
const functionSql = (source, name) => {
  const match = source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert(match, `Missing actual SQL function ${name}`);
  return match[0];
};

try {
  await db.exec(`
    CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TYPE lottery_card_rarity AS ENUM('common','silver','gold','epic','legendary');
    CREATE TABLE lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,is_active BOOLEAN NOT NULL DEFAULT true);
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID REFERENCES lottery_card_collections,
      code TEXT UNIQUE,name TEXT,rarity lottery_card_rarity,is_active BOOLEAN DEFAULT true,card_number INTEGER);
    CREATE TABLE kq_support_booster_entitlements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users,
      source TEXT NOT NULL,reward_key TEXT UNIQUE,ticket_id UUID,card_count INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'available',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),opened_at TIMESTAMPTZ,
      CONSTRAINT kq_support_booster_entitlements_source_check CHECK(source IN ('ticket','mission')),
      CONSTRAINT kq_support_booster_entitlements_source_shape_check CHECK(source='mission' OR ticket_id IS NOT NULL));
    CREATE TABLE lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users,
      card_definition_id UUID REFERENCES lottery_card_definitions,pack_slot INTEGER,
      ticket_id UUID,kq_support_entitlement_id UUID REFERENCES kq_support_booster_entitlements,source_bot_battle_id UUID,
      pioneer_grant_id UUID,producer_purchase_buddie_grant_id UUID,community_mission_reward_id UUID,contest_bundle_order_id TEXT,
      CONSTRAINT lottery_card_instances_source_required CHECK(ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL
        OR source_bot_battle_id IS NOT NULL OR pioneer_grant_id IS NOT NULL OR producer_purchase_buddie_grant_id IS NOT NULL
        OR community_mission_reward_id IS NOT NULL OR contest_bundle_order_id IS NOT NULL));
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,status TEXT);
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_id UUID,run_id UUID,variety_code TEXT,quality NUMERIC,status TEXT);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY,clients INTEGER DEFAULT 0,shop_partners INTEGER DEFAULT 0);
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users,cash_cents INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_commerce_batches(flower_id UUID PRIMARY KEY,user_id UUID,route TEXT,processing_ready_at TIMESTAMPTZ);
    CREATE TABLE kq_market_lots(flower_id UUID PRIMARY KEY,owner_id UUID,jury_score NUMERIC);
    CREATE TABLE kq_storage_lots(flower_id UUID PRIMARY KEY,user_id UUID,state JSONB,original_units INTEGER DEFAULT 1000);
    CREATE TABLE kq_chanvrier_processing_practice(user_id UUID,flower_id UUID,family TEXT,route TEXT,PRIMARY KEY(user_id,flower_id,family));
    CREATE TABLE kq_online_sales(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,customer_demand JSONB,satisfaction TEXT);
    CREATE TABLE kq_market_sale_receipts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_id UUID,flower_id UUID,route TEXT,jury_score NUMERIC,harvest_grams NUMERIC,sales_channel TEXT,created_at TIMESTAMPTZ DEFAULT now());
    CREATE FUNCTION kq_storage_verdict_score(UUID) RETURNS NUMERIC LANGUAGE sql AS 'SELECT NULL::NUMERIC';
    CREATE TABLE test_settlement_calls(user_id UUID);
    CREATE TABLE test_settlement_targets(user_id UUID PRIMARY KEY,clients INTEGER);
    CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
      INSERT INTO test_settlement_calls VALUES(p_user);
      UPDATE kq_commerce_accounts a SET clients=t.clients FROM test_settlement_targets t WHERE a.user_id=p_user AND t.user_id=p_user;
    END $$;
    INSERT INTO lottery_card_collections(code) VALUES('BOTTE_DU_CHANVRIER_2026');
    INSERT INTO lottery_card_definitions(collection_id,code,name,rarity)
      SELECT collection.id,card.code,'Official '||card.code,'gold' FROM lottery_card_collections collection
      CROSS JOIN unnest(ARRAY['BOTTE-006','BOTTE-032','BOTTE-021','BOTTE-030','BOTTE-016','BOTTE-027','BOTTE-034']) card(code);
  `);
  // Actual journal, posting validation and wallet observer; the opening fixture
  // has only a wallet, so it omits unrelated production/equipment valuations.
  const treasury = await sql("20260921000200_kq_treasury_accounting.sql");
  await db.exec(treasury.slice(0, treasury.indexOf("-- Actual production cost only")) + "COMMIT;");
  await db.exec(`CREATE FUNCTION kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
    INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
    IF FOUND THEN PERFORM kq_treasury_pair(p_user,'opening','opening',now(),'cash','opening_equity',
      COALESCE((SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=p_user),0),'Opening fixture'); END IF;
    END $$;`);
  await db.exec(functionSql(treasury, "kq_treasury_queue"));
  await db.exec(functionSql(treasury, "kq_treasury_observe"));
  await db.exec("CREATE TRIGGER kq_treasury_wallet AFTER INSERT OR UPDATE OF cash_cents ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe()");
  await db.exec(await sql("20260913000500_kq_mission_center.sql"));

  const owner = async (clients = 0, partners = 0) => {
    const id = randomUUID();
    await db.query("INSERT INTO auth.users VALUES($1)", [id]);
    await db.query("INSERT INTO kq_commerce_accounts(user_id,clients,shop_partners) VALUES($1,$2,$3)", [id, clients, partners]);
    return id;
  };
  const flower = async (user, variety = "HH2026-001", quality = 14, status = "completed") => {
    const run = await scalar("INSERT INTO kq_runs(user_id,status) VALUES($1,$2) RETURNING id", [user, status]);
    return scalar("INSERT INTO kq_flowers(owner_id,run_id,variety_code,quality,status) VALUES($1,$2,$3,$4,'burned') RETURNING id", [user, run, variety, quality]);
  };

  await db.exec(`
    CREATE TABLE kq_staff_archive(user_id UUID,kind TEXT,record_id TEXT,employee_id TEXT,payload JSONB,PRIMARY KEY(user_id,kind,record_id));
    CREATE TABLE kq_staff_trim_lots(flower_id UUID PRIMARY KEY,user_id UUID,completed_at TIMESTAMPTZ,total_grams NUMERIC);
    CREATE TABLE kq_social_requests(user_id UUID,request_key UUID,command JSONB,PRIMARY KEY(user_id,request_key));
    CREATE TABLE kq_social_v2_receipts(user_id UUID,request_key UUID,command JSONB,PRIMARY KEY(user_id,request_key));
    CREATE TABLE kq_bot_battles(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,flower_id UUID,verdict_at TIMESTAMPTZ);
    CREATE TABLE kq_battles(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),player_one_id UUID,flower_one_id UUID,player_two_id UUID,flower_two_id UUID,status TEXT,verdict_at TIMESTAMPTZ);
    CREATE TABLE kq_supplier_invoices(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,amount_cents INTEGER,remaining_cents INTEGER);
    INSERT INTO lottery_card_collections(code) VALUES('HEMP_HEROES_2026'),('UNRELATED');
    INSERT INTO lottery_card_definitions(collection_id,code,name,rarity,card_number)
      SELECT c.id,'HH2026-'||lpad(n::TEXT,3,'0'),'Buddie '||n,
       (CASE WHEN n=1 THEN 'legendary' WHEN n<=4 THEN 'epic' WHEN n<=9 THEN 'gold' WHEN n<=19 THEN 'silver' ELSE 'common' END)::lottery_card_rarity,n
      FROM lottery_card_collections c CROSS JOIN generate_series(1,52) n WHERE c.code='HEMP_HEROES_2026';
    INSERT INTO lottery_card_definitions(collection_id,code,name,rarity,card_number)
      SELECT id,'HH2026-053','Unplayable future common','common',53 FROM lottery_card_collections WHERE code='HEMP_HEROES_2026';
    INSERT INTO lottery_card_definitions(collection_id,code,name,rarity,card_number)
      SELECT id,'OTHER-020','Unrelated common','common',20 FROM lottery_card_collections WHERE code='UNRELATED';
  `);
  await db.exec(functionSql(await sql("20261015000200_kq_mission_aroma_evidence.sql"), "kq_mission_metrics"));
  await db.exec(await sql("20261015000300_kq_mission_journey.sql"));
  await db.exec(await sql("20261109000200_kq_mission_progression.sql"));
  const fresh = await owner();
  const before = (await mission(fresh, "staff-first-task")).progress;
  const payload = {
    status: "completed", kind: "culture", cultureShift: true,
    hours: 0.5, cultureUsedHours: 0, employeeId: "synthetic-employee",
    outcome: "Culture : 0 h utilisées sur 0,5 h réservées. Réservation terminée pour cette journée."
  };
  await db.query("INSERT INTO kq_staff_archive VALUES($1,'task','unused-reservation','synthetic-employee',$2)", [fresh, payload]);
  const after = await mission(fresh, "staff-first-task");
  assert.equal(before, 0);
  assert.equal(after.progress, 1);
  assert.equal(after.claimable, true);
  const receipts = await scalar("SELECT count(*) FROM kq_mission_reward_receipts WHERE user_id=$1", [fresh]);
  assert.equal(receipts, 0);
  const report = {
    isolated: true, remoteRequests: 0,
    method: "Existing mission-progression PGlite fixture setup; actual metrics and state RPC; synthetic completed archive payload matching completeTask's zero-work culture reservation",
    archiveStatus: payload.status, reservedHours: payload.hours, usedHours: payload.cultureUsedHours,
    progressBefore: before, progressAfter: after.progress, claimable: after.claimable,
    claimedRewards: receipts,
    limitation: "Direct synthetic archive insert: does not execute completeTask, archive transition trigger, or HTTP integration; those paths were inspected statically. No reward claim executed."
  };
  const { writeFile } = await import("node:fs/promises");
  await writeFile(new URL("./mission-zero-work-result.json", import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(error.message, error.detail ?? "", error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
