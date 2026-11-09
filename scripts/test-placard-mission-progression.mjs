// Isolated PostgreSQL verification; no credentials or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { KQ_MISSION_DEFINITIONS } from "../src/lib/kanab-quest-missions.ts";
import { getKqMissionLevel } from "../src/lib/kanab-quest-mission-progression.ts";

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
  const legacy = await owner(10, 6);
  for (let n = 1; n <= 3; n++) await flower(legacy, `HH2026-00${n}`);
  const oldCodes = ["first-harvest", "three-varieties", "contest-flower", "online-two", "online-five", "online-ten", "shop-one", "shop-three", "shop-six"];
  const oldRewards = new Map();
  for (const code of oldCodes) oldRewards.set(code, await claim(legacy, code));
  await db.query("UPDATE kq_support_booster_entitlements SET status='opened',opened_at=now() WHERE id=$1", [oldRewards.get("contest-flower").entitlementId]);
  await db.exec(functionSql(await sql("20261015000200_kq_mission_aroma_evidence.sql"), "kq_mission_metrics"));
  await db.exec(await sql("20261015000300_kq_mission_journey.sql"));
  const receiptBefore = (await db.query("SELECT id,user_id,mission_code,reward,result,claimed_at FROM kq_mission_reward_receipts ORDER BY id")).rows;
  const packBefore = (await db.query("SELECT * FROM kq_support_booster_entitlements ORDER BY id")).rows;
  const metricsBefore = await scalar("SELECT prosrc FROM pg_proc WHERE oid='public.kq_mission_metrics(uuid)'::regprocedure");
  await db.exec(await sql("20261109000200_kq_mission_progression.sql"));
  equal((await db.query("SELECT id,user_id,mission_code,reward,result,claimed_at FROM kq_mission_reward_receipts ORDER BY id")).rows, receiptBefore, "Migration preserves exact historical reward receipts");
  equal((await db.query("SELECT * FROM kq_support_booster_entitlements ORDER BY id")).rows, packBefore, "Migration neither reopens nor replaces existing packs");
  equal(await scalar("SELECT prosrc FROM pg_proc WHERE oid='public.kq_mission_metrics_before_progression(uuid)'::regprocedure"), metricsBefore, "Existing quality, commerce and curing rules survive unchanged");

  const catalog = (await db.query("SELECT * FROM kq_mission_definitions() ORDER BY code")).rows;
  equal(catalog, KQ_MISSION_DEFINITIONS.map(({ code, track, step, metric, target, reward }) => ({ code, track, step, metric, target, reward }))
    .sort((a, b) => a.code.localeCompare(b.code)), "All 72 display objectives match authoritative SQL metrics and rewards");
  const expectedOldXp = KQ_MISSION_DEFINITIONS.filter(item => oldCodes.includes(item.code)).reduce((sum, item) => sum + item.step * 50, 0);
  equal((await state(legacy)).progression.totalXp, expectedOldXp, "Nine historical mission receipts receive their fixed XP once");
  for (const code of oldCodes) {
    const replay = await claim(legacy, code);
    equal([replay.entitlementId, replay.reward.kind, replay.replayed, replay.xpAwarded], [oldRewards.get(code).entitlementId, "pack", true, 0], `Legacy ${code} replays without another reward or XP`);
  }
  equal((await state(legacy)).progression.totalXp, expectedOldXp, "Legacy retries cannot multiply XP");
  const lateLegacy = await owner();
  const latePack = await scalar("INSERT INTO kq_support_booster_entitlements(user_id,source,reward_key,card_count) VALUES($1,'mission',$2,3) RETURNING id", [lateLegacy, `kq-mission:v1:${lateLegacy}:first-harvest`]);
  equal((await state(lateLegacy)).progression.totalXp, 50, "A v1 entitlement completing during deployment counts once");
  equal([(await claim(lateLegacy, "first-harvest")).entitlementId, (await state(lateLegacy)).progression.totalXp], [latePack, 50], "Late v1 replay does not pay replacement cash or XP");

  const fresh = await owner(), other = await owner();
  let view = await state(fresh);
  equal([view.missions.length, view.missions.filter(item => item.unlocked).length, view.progression.rewards.length], [72, 12, 19], "Twelve independent journeys and nineteen level milestones are visible");
  equal({ ...view.progression, rewards: undefined }, { ...getKqMissionLevel(0), rewards: undefined }, "New players have honest level one with no invented XP");
  await reject(() => claim(fresh, "level-2"), "mission_not_ready");
  await reject(() => claim(fresh, "level-21"), "mission_unknown");
  const f = await flower(fresh), foreign = await flower(other);
  await db.query("INSERT INTO kq_staff_trim_lots VALUES($1,$2,NULL,80),($3,$4,now(),80)", [f, fresh, foreign, other]);
  equal((await mission(fresh, "trim-one")).progress, 0, "Pending and foreign trims do not count");
  await db.query("UPDATE kq_staff_trim_lots SET completed_at=now(),total_grams=0 WHERE flower_id=$1", [f]);
  equal((await mission(fresh, "trim-one")).progress, 0, "Empty harvest completion does not fabricate a trimmed lot");
  await db.query("UPDATE kq_staff_trim_lots SET total_grams=80 WHERE flower_id=$1", [f]);
  await db.query("INSERT INTO kq_staff_archive VALUES($1,'task','running','employee', $2),($1,'task','player','player',$3),($4,'task','foreign','employee',$3)", [fresh, { status: "running", kind: "sales" }, { status: "completed", kind: "sales" }, other]);
  equal([(await mission(fresh, "staff-first-task")).progress, (await mission(fresh, "prospecting-one")).progress], [0, 1], "Staff excludes the player; completed player prospecting counts");
  await db.query("INSERT INTO kq_staff_archive VALUES($1,'task','employee','employee',$2)", [fresh, { status: "completed", kind: "training" }]);
  equal((await mission(fresh, "staff-first-task")).progress, 1, "Archived completed employee tasks count after live-state compaction");
  const request = randomUUID();
  await db.query("INSERT INTO kq_social_requests VALUES($1,$2,$3)", [fresh, request, { action: "choose" }]);
  await db.query("INSERT INTO kq_social_v2_receipts VALUES($1,$2,$3),($1,$4,$5),($6,$7,$3)", [fresh, request, { action: "choose" }, randomUUID(), { action: "recover" }, other, randomUUID()]);
  equal((await mission(fresh, "social-three-choices")).progress, 1, "Social history deduplicates v1/v2 receipt keys and excludes recoveries and other players");
  await db.query("INSERT INTO kq_bot_battles(user_id,flower_id,verdict_at) VALUES($1,$2,now()),($1,$2,now()),($1,$3,NULL),($1,$3,now())", [fresh, f, foreign]);
  await db.query("INSERT INTO kq_battles(player_one_id,flower_one_id,player_two_id,flower_two_id,status,verdict_at) VALUES($1,$2,$3,$4,'verdict',now())", [fresh, f, other, foreign]);
  equal((await mission(fresh, "jury-five")).progress, 1, "Jury counts distinct owned judged flowers across bot and PvP verdicts");
  await db.query("INSERT INTO kq_supplier_invoices(user_id,amount_cents,remaining_cents) VALUES($1,100,1),($1,0,0),($2,100,0)", [fresh, other]);
  equal((await mission(fresh, "finance-one")).progress, 0, "Unpaid, empty and foreign invoices cannot earn finance progress");
  await db.query("INSERT INTO kq_supplier_invoices(user_id,amount_cents,remaining_cents) VALUES($1,100,0)", [fresh]);
  equal((await mission(fresh, "finance-one")).progress, 1, "Fully paid invoices are authoritative finance evidence");
  await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id,pioneer_grant_id) SELECT $1,id,gen_random_uuid() FROM lottery_card_definitions WHERE code IN ('HH2026-020','HH2026-053','OTHER-020','BOTTE-006')", [fresh]);
  await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id,pioneer_grant_id) SELECT $1,id,gen_random_uuid() FROM lottery_card_definitions WHERE code='HH2026-020'", [fresh]);
  equal((await mission(fresh, "collection-five")).progress, 1, "Collection excludes duplicate copies, support cards and nonplayable catalogues");

  const cash = await claim(fresh, "first-harvest");
  equal(cash.xpAwarded, 50, "Claiming a first objective awards exactly fifty permanent XP");
  equal((await claim(fresh, "trim-one")).xpAwarded, 50, "A second sector contributes to the same progression");
  view = await state(fresh);
  equal({ ...view.progression, rewards: undefined }, { ...getKqMissionLevel(100), rewards: undefined }, "Server level boundaries match the display model");
  equal(view.progression.rewards[0].reward.code, "HH2026-021", "Buddie offers prefer an unowned playable card of the exact rarity");
  await db.exec("UPDATE lottery_card_definitions SET is_active=false WHERE code LIKE 'HH2026-%' AND card_number BETWEEN 20 AND 52");
  view = await state(fresh);
  equal([view.progression.rewards[0].rewardAvailable, view.progression.rewards[0].reward.code ?? null], [false, null], "An empty active rarity pool stays unavailable without a fabricated card");
  await reject(() => claim(fresh, "level-2"), "mission_card_unavailable");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_mission_reward_receipts WHERE user_id=$1 AND mission_code='level-2'", [fresh]), 0, "Unavailable Buddies roll back the entire claim");
  await db.exec("UPDATE lottery_card_definitions SET is_active=true WHERE code LIKE 'HH2026-%' AND card_number BETWEEN 20 AND 52");
  await db.exec("UPDATE lottery_card_collections SET is_active=false WHERE code='HEMP_HEROES_2026'");
  await reject(() => claim(fresh, "level-2"), "mission_collection_inactive");
  await db.exec("UPDATE lottery_card_collections SET is_active=true WHERE code='HEMP_HEROES_2026'");
  const race = await Promise.all(Array.from({ length: 4 }, () => claim(fresh, "level-2")));
  equal(race.filter(result => !result.replayed).length, 1, "Concurrent submitted claims create one Buddie receipt");
  const buddie = race.find(result => !result.replayed);
  equal([buddie.reward.kind, buddie.reward.rarity, buddie.reward.code, buddie.xpAwarded], ["buddie", "common", "HH2026-021", 0], "The granted Buddie and name are frozen in the result, with no circular XP");
  await db.query("DELETE FROM lottery_card_instances WHERE id=$1", [buddie.cardInstanceId]);
  await db.exec("UPDATE lottery_card_definitions SET name='Changed',is_active=false WHERE code='HH2026-021'");
  const replayBuddie = await claim(fresh, "level-2");
  equal([replayBuddie.cardInstanceId, replayBuddie.reward.name, replayBuddie.xpAwarded], [buddie.cardInstanceId, buddie.reward.name, 0], "Consumed or inactive Buddie rewards replay their exact frozen receipt");
  equal(await scalar("SELECT count(*)::INTEGER FROM lottery_card_instances WHERE id=$1", [buddie.cardInstanceId]), 0, "Replay never recreates consumed collection inventory");
  equal((await state(fresh)).progression.totalXp, 100, "Level rewards and consumption never change permanent XP");
  await db.exec("UPDATE lottery_card_definitions SET is_active=true WHERE code='HH2026-021'");

  const max = await owner(10, 6), flowers = [];
  for (let n = 1; n <= 100; n++) flowers.push(await flower(max, `HH2026-${String((n - 1) % 52 + 1).padStart(3, "0")}`));
  for (const id of flowers.slice(0, 10)) {
    await db.query("INSERT INTO kq_market_lots VALUES($1,$2,8.5)", [id, max]);
    await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route) VALUES($1,$2,'raw')", [id, max]);
    await db.query("INSERT INTO kq_storage_lots(flower_id,user_id,state) VALUES($1,$2,jsonb_build_object('readyAt',now()-interval '1 hour','baseline',jsonb_build_object('juryScore',8.5)))", [id, max]);
  }
  for (const [n, family] of ["sifting", "washing", "pressing"].entries()) await db.query("INSERT INTO kq_chanvrier_processing_practice VALUES($1,$2,$3,$3)", [max, flowers[n], family]);
  for (let period = 1; period <= 3; period++) {
    await db.query("INSERT INTO kq_online_sales(user_id,customer_demand,satisfaction) VALUES($1,$2,'satisfied')", [max, { period, matchedFlavorCount: 2 }]);
    await db.query("INSERT INTO kq_market_sale_receipts(owner_id,flower_id,route,jury_score,harvest_grams,sales_channel) VALUES($1,$2,'raw',8.5,200,'cbd-shop')", [max, flowers[period - 1]]);
  }
  await db.query("INSERT INTO kq_staff_trim_lots SELECT id,$1,now(),100 FROM kq_flowers WHERE owner_id=$1", [max]);
  await db.query("INSERT INTO kq_bot_battles(user_id,flower_id,verdict_at) SELECT $1,id,now() FROM kq_flowers WHERE owner_id=$1", [max]);
  await db.query("INSERT INTO kq_staff_archive SELECT $1,'task',n::TEXT,'employee',jsonb_build_object('status','completed','kind',CASE WHEN n<=100 THEN 'sales' ELSE 'training' END) FROM generate_series(1,120) n", [max]);
  await db.query("INSERT INTO kq_social_v2_receipts SELECT $1,gen_random_uuid(),jsonb_build_object('action','choose') FROM generate_series(1,200)", [max]);
  await db.query("INSERT INTO kq_supplier_invoices(user_id,amount_cents,remaining_cents) SELECT $1,100,0 FROM generate_series(1,100)", [max]);
  await db.query("INSERT INTO lottery_card_instances(user_id,card_definition_id,pioneer_grant_id) SELECT $1,d.id,gen_random_uuid() FROM lottery_card_definitions d JOIN lottery_card_collections c ON c.id=d.collection_id WHERE c.code='HEMP_HEROES_2026' AND card_number BETWEEN 1 AND 50", [max]);
  const before = await state(max);
  equal(before.missions.every(item => item.progress === item.target), true, "Actual completed evidence can satisfy every sector objective");
  await reject(() => claim(max, "staff-hundred-twenty-tasks"), "mission_not_ready");
  let awarded = 0;
  for (const item of before.missions) {
    const receipt = await claim(max, item.code);
    equal(receipt.xpAwarded, item.step * 50, `${item.code} grants the fixed step XP`);
    awarded += receipt.xpAwarded;
  }
  view = await state(max);
  equal([awarded, view.progression.totalXp, view.progression.level, view.progression.nextLevelXp], [12600, 12600, 20, null], "All seventy-two missions lead to capped level twenty, retaining surplus XP");
  equal(view.progression.rewards.every(item => item.claimable), true, "All reached level rewards unlock independently");
  const expectedRarities = new Map([[2, "common"], [5, "silver"], [10, "gold"], [15, "epic"], [20, "legendary"]]);
  const levelReceipts = [];
  for (const item of view.progression.rewards) {
    equal(item.requiredXp, (item.level - 1) * (item.level + 2) * 25, `${item.code} uses the declared threshold`);
    const receipt = await claim(max, item.code); levelReceipts.push(receipt);
    equal(receipt.xpAwarded, 0, `${item.code} never recursively generates XP`);
    if (expectedRarities.has(item.level)) equal(receipt.reward.rarity, expectedRarities.get(item.level), `${item.code} grants its guaranteed playable rarity`);
  }
  equal((await state(max)).progression.totalXp, 12600, "Collecting every level reward leaves XP unchanged");
  const cashExpected = before.missions.filter(item => item.reward.kind === "cash").reduce((sum, item) => sum + item.reward.amountCents, 0)
    + levelReceipts.filter(item => item.reward.kind === "cash").reduce((sum, item) => sum + item.reward.amountCents, 0);
  equal(await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [max]), cashExpected, "Mission and level cash is paid exactly once");
  equal(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='revenue_rewards'", [max]), -cashExpected, "New level cash retains the real treasury accounting path");
  equal(await scalar("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='suspense'", [max]), 0, "Reward cash and treasury postings balance");
  const totalRows = await scalar("SELECT count(*)::INTEGER FROM kq_mission_reward_receipts WHERE user_id=$1", [max]);
  for (const code of [...before.missions.map(item => item.code), ...view.progression.rewards.map(item => item.code)]) equal((await claim(max, code)).xpAwarded, 0, "Every repeated reward returns zero new XP");
  equal(await scalar("SELECT count(*)::INTEGER FROM kq_mission_reward_receipts WHERE user_id=$1", [max]), totalRows, "All retries retain exactly ninety-one reward receipts");
  await db.query("DELETE FROM lottery_card_instances WHERE user_id=$1", [max]);
  equal([(await mission(max, "collection-fifty")).claimed, (await state(max)).progression.totalXp], [true, 12600], "Collection consumption cannot erase an earned objective or level");

  const overflow = await owner(); await flower(overflow);
  await db.query("INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES($1,2147483647)", [overflow]);
  await reject(() => claim(overflow, "first-harvest"), "mission_wallet_limit");
  equal([(await state(overflow)).progression.totalXp, (await mission(overflow, "first-harvest")).claimed], [0, false], "Cash overflow rolls back reward and XP together");
  for (const role of ["anon", "authenticated", "service_role"]) {
    equal(await scalar("SELECT has_table_privilege($1,'public.kq_mission_reward_receipts','SELECT,INSERT,UPDATE,DELETE')", [role]), false, `${role} cannot forge or inspect private receipt rows`);
    for (const helper of ["kq_mission_metrics(uuid)", "kq_mission_definitions()", "kq_mission_total_xp(uuid)", "kq_mission_reward_offer(uuid,jsonb)", "kq_mission_buddie_catalog(text)", "kq_mission_level_definitions()"])
      equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE')", [role, `public.${helper}`]), false, `${role} cannot call private ${helper}`);
    equal(await scalar("SELECT has_function_privilege($1,'public.rpc_kq_claim_mission(uuid,text)','EXECUTE')", [role]), role === "service_role", `${role} only has the intended claim entry point`);
  }
  await db.exec("SET ROLE service_role");
  equal((await state(max)).progression.totalXp, 12600, "The service-only RPC can read all private sector evidence");
  equal((await claim(max, "level-20")).replayed, true, "The service role replays through the same secured transaction");
  await db.exec("RESET ROLE");
  console.log(`PASS: ${checks} permanent mission progression checks (PostgreSQL/PGlite; concurrent submissions serialize on one connection).`);
} catch (error) {
  console.error(error.message, error.detail ?? "", error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
