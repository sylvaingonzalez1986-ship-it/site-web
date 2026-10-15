// Isolated PostgreSQL verification; no credentials or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { KQ_MISSION_DEFINITIONS } from "../src/lib/kanab-quest-missions.ts";

const db = new PGlite();
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
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
    CREATE TYPE lottery_card_rarity AS ENUM('common','silver','gold','epic');
    CREATE TABLE lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,is_active BOOLEAN NOT NULL DEFAULT true);
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID REFERENCES lottery_card_collections,
      code TEXT UNIQUE,name TEXT,rarity lottery_card_rarity,is_active BOOLEAN DEFAULT true);
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
  const legacy = await owner(10, 6);
  for (let n = 1; n <= 3; n++) await flower(legacy, `HH2026-00${n}`);
  const oldCodes = ["first-harvest", "three-varieties", "contest-flower", "online-two", "online-five", "online-ten", "shop-one", "shop-three", "shop-six"];
  const oldRewards = new Map();
  for (const code of oldCodes) oldRewards.set(code, await claim(legacy, code));
  await db.query("UPDATE kq_support_booster_entitlements SET status='opened',opened_at=now() WHERE id=$1", [oldRewards.get("contest-flower").entitlementId]);
  const legacyBefore = (await db.query("SELECT * FROM kq_support_booster_entitlements ORDER BY id")).rows;

  const evidence = await sql("20261015000200_kq_mission_aroma_evidence.sql");
  await db.exec(functionSql(evidence, "kq_mission_metrics"));
  await db.exec(await sql("20261015000300_kq_mission_journey.sql"));
  await db.exec(functionSql(await sql("20261011000300_collection_budget.sql"), "rpc_kq_card_copy_counts"));
  const catalog = (await db.query("SELECT * FROM kq_mission_definitions() ORDER BY code")).rows;
  equal(catalog, KQ_MISSION_DEFINITIONS.map(({ code, track, step, metric, target, reward }) => ({ code, track, step, metric, target, reward }))
    .sort((a, b) => a.code.localeCompare(b.code)), "Every display objective and reward matches the authoritative SQL catalog");
  equal((await state(legacy)).missions.length, 30, "Thirty missions are available");
  equal((await db.query("SELECT * FROM kq_support_booster_entitlements ORDER BY id")).rows, legacyBefore, "Legacy packs are untouched by migration");
  for (const code of oldCodes) {
    const replay = await claim(legacy, code);
    equal([replay.replayed, replay.entitlementId, replay.cardCount, replay.reward.kind],
      [true, oldRewards.get(code).entitlementId, oldRewards.get(code).cardCount, "pack"], `Legacy ${code} retains its exact reward`);
  }
  equal((await mission(legacy, "contest-flower")).packAvailable, false, "Opened legacy packs do not reappear");
  equal((await mission(legacy, "three-contest-flowers")).unlocked, false, "A legacy claim cannot skip new earlier missions");
  await claim(legacy, "beautiful-flower");
  equal((await mission(legacy, "three-contest-flowers")).claimable, true, "Completing the new earlier step unlocks the path");
  const lateLegacy = await owner();
  const latePack = await scalar("INSERT INTO kq_support_booster_entitlements(user_id,source,reward_key,card_count) VALUES($1,'mission',$2,3) RETURNING id",
    [lateLegacy, `kq-mission:v1:${lateLegacy}:first-harvest`]);
  equal((await mission(lateLegacy, "first-harvest")).claimed, true, "An old claim finishing during deployment remains claimed");
  equal([(await claim(lateLegacy, "first-harvest")).entitlementId, await scalar("SELECT count(*)::INTEGER FROM kq_equipment_wallets WHERE user_id=$1", [lateLegacy])],
    [latePack, 0], "An overlapping old claim cannot also pay the new cash reward");

  const user = await owner(10, 6), flowers = [];
  for (let n = 1; n <= 20; n++) flowers.push(await flower(user, `HH2026-${String(n).padStart(3, "0")}`));
  for (const id of flowers.slice(0, 10)) {
    await db.query("INSERT INTO kq_market_lots VALUES($1,$2,8.5)", [id, user]);
    await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route) VALUES($1,$2,'raw')", [id, user]);
    await db.query("INSERT INTO kq_storage_lots(flower_id,user_id,state) VALUES($1,$2,jsonb_build_object('readyAt',now()-interval '1 hour','juryScore',8.5,'baseline',jsonb_build_object('juryScore',8.5)))", [id, user]);
  }
  for (const [n, family] of ["sifting", "washing", "pressing"].entries())
    await db.query("INSERT INTO kq_chanvrier_processing_practice VALUES($1,$2,$3,$3)", [user, flowers[n], family]);
  for (let period = 1; period <= 3; period++)
    await db.query("INSERT INTO kq_online_sales(user_id,customer_demand,satisfaction) VALUES($1,$2,'satisfied')", [user, { period, matchedFlavorCount: 2 }]);
  for (let n = 0; n < 3; n++)
    await db.query("INSERT INTO kq_market_sale_receipts(owner_id,flower_id,route,jury_score,harvest_grams,sales_channel) VALUES($1,$2,'raw',8.5,$3,'cbd-shop')", [user, flowers[n], n === 0 ? 100 : 200]);
  await reject(() => claim(user, "twenty-varieties"), "mission_not_ready");
  await reject(() => claim(user, "unknown"), "mission_unknown");
  const initial = (await state(user)).missions;
  const stateSql = await scalar("SELECT prosrc FROM pg_proc WHERE oid='public.rpc_kq_mission_state(uuid)'::regprocedure");
  const plan = (await scalar(`EXPLAIN (ANALYZE,FORMAT JSON) ${stateSql.replaceAll("p_user_id", `'${user}'::UUID`)}`))[0].Plan;
  const nodes = node => [node, ...(node.Plans ?? []).flatMap(nodes)];
  const metricsPlan = nodes(plan).filter(node => node["Subplan Name"] === "CTE metrics");
  equal(metricsPlan.length, 1, "The snapshot plan contains one materialized metric aggregation");
  equal([metricsPlan[0]["Actual Loops"], metricsPlan[0]["Actual Rows"]], [1, 1], "PostgreSQL evaluates all progress metrics once for thirty missions");
  equal(initial.filter(item => item.unlocked).length, 5, "Only the first step of each track starts unlocked");
  const cashExpected = initial.filter(item => item.reward.kind === "cash").reduce((sum, item) => sum + item.reward.amountCents, 0);
  const receipts = [];
  for (const item of initial) {
    const result = await claim(user, item.code);
    equal(result.replayed, false, `${item.code} grants once`);
    receipts.push(result);
    if (result.reward.kind === "card") equal(result.reward.name, `Official ${result.reward.code}`, "Guaranteed cards use the current authoritative label");
  }
  equal((await state(user)).missions.filter(item => item.claimed).length, 30, "The complete journey can be claimed");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [user]), cashExpected, "Cash rewards total exactly the catalog amount");
  equal(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='cash'", [user]), cashExpected, "Actual treasury wallet observer credits cash");
  equal(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='revenue_rewards'", [user]), -cashExpected, "Mission revenue is recorded once");
  equal(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='suspense'", [user]), 0, "Cash movements and mission revenue balance");
  equal(await scalar("SELECT count(*)::INTEGER FROM lottery_card_instances WHERE user_id=$1", [user]), 8, "Eight guaranteed rare cards reach the inventory");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_support_booster_entitlements WHERE user_id=$1", [user]), 9, "Nine harder milestones grant packs");
  for (const item of initial) equal((await claim(user, item.code)).replayed, true, "Repeated claims reuse their receipt");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_mission_reward_receipts WHERE user_id=$1", [user]), 30, "No replay creates a new reward receipt");
  const cardDefinition = await scalar("SELECT id FROM lottery_card_definitions WHERE code='BOTTE-006'");
  const copies = () => scalar("SELECT rpc_kq_card_copy_counts($1,$2)", [user, [cardDefinition]]);
  equal((await copies())[cardDefinition], 2, "The production collection query includes both guaranteed card rewards");
  await db.query("DELETE FROM lottery_card_instances WHERE id=$1", [receipts[2].cardInstanceId]);
  equal((await claim(user, "five-varieties")).cardInstanceId, receipts[2].cardInstanceId, "A consumed card retains its original reward receipt");
  equal((await copies())[cardDefinition], 1, "Replaying a consumed card reward does not recreate inventory");
  equal((await mission(user, "five-varieties")).claimed, true, "Consuming a reward card does not reset its mission");

  const fresh = await owner();
  await flower(fresh);
  await db.exec("UPDATE lottery_card_collections SET is_active=false");
  const races = await Promise.all(Array.from({ length: 4 }, () => claim(fresh, "first-harvest")));
  equal(races.filter(item => !item.replayed).length, 1, "Parallel requests award cash once while the collection is inactive");
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [fresh]), 5000, "Concurrent retries do not multiply cash");
  equal((await claim(user, "twenty-varieties")).entitlementId, receipts[5].entitlementId, "Inactive collection does not block reward replay");
  equal((await mission(fresh, "beautiful-flower")).rewardAvailable, true, "Cash remains available without the collection");
  await db.exec("UPDATE lottery_card_collections SET is_active=true");
  for (let n = 2; n <= 5; n++) await flower(fresh, `HH2026-00${n}`);
  await claim(fresh, "three-varieties");
  await db.exec("UPDATE lottery_card_definitions SET is_active=false WHERE code='BOTTE-006'");
  equal((await mission(fresh, "five-varieties")).rewardAvailable, false, "Unavailable guaranteed cards disable their reward");
  await reject(() => claim(fresh, "five-varieties"), "mission_card_unavailable");
  equal((await mission(fresh, "five-varieties")).claimed, false, "Failed card claims leave no completion receipt");
  await db.exec("UPDATE lottery_card_definitions SET is_active=true WHERE code='BOTTE-006'");
  equal((await claim(fresh, "five-varieties")).cardCount, 1, "The restored guaranteed card can be claimed");

  const overflow = await owner();
  await flower(overflow);
  await db.query("INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES($1,2147483647)", [overflow]);
  await reject(() => claim(overflow, "first-harvest"), "mission_wallet_limit");
  equal((await mission(overflow, "first-harvest")).claimed, false, "Wallet overflow rolls back the reward receipt");
  const staleAudience = await owner(2);
  await db.query("INSERT INTO kq_online_sales(user_id,satisfaction) VALUES($1,'satisfied')", [staleAudience]);
  await claim(staleAudience, "first-online-sale");
  await db.query("INSERT INTO test_settlement_targets VALUES($1,1)", [staleAudience]);
  await reject(() => claim(staleAudience, "online-two"), "mission_not_ready");
  await db.query("UPDATE test_settlement_targets SET clients=2 WHERE user_id=$1", [staleAudience]);
  await claim(staleAudience, "online-two");
  equal(await scalar("SELECT count(*)::INTEGER FROM test_settlement_calls WHERE user_id=$1", [staleAudience]), 2, "Fresh claims settle automatic commerce before checking audience");
  await claim(staleAudience, "online-two");
  equal(await scalar("SELECT count(*)::INTEGER FROM test_settlement_calls WHERE user_id=$1", [staleAudience]), 2, "Receipt replay performs no new business settlement");
  for (const role of ["anon", "authenticated", "service_role"]) {
    equal(await scalar("SELECT has_table_privilege($1,'public.kq_mission_reward_receipts','SELECT,INSERT,UPDATE,DELETE')", [role]), false, `${role} cannot access private receipts`);
    equal(await scalar("SELECT has_function_privilege($1,'public.rpc_kq_claim_mission(uuid,text)','EXECUTE')", [role]), role === "service_role", `${role} has only intended claim permission`);
  }
  await db.exec("SET ROLE service_role");
  equal((await state(user)).missions.length, 30, "The service RPC reads private mission state");
  await db.exec("RESET ROLE");
  console.log(`PASS: ${checks} mission journey checks (PostgreSQL/PGlite; concurrent calls serialize on one connection).`);
} catch (error) {
  console.error(error.message, error.detail ?? "", error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
