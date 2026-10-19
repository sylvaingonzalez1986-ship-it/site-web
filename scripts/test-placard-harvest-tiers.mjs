// Isolated PostgreSQL checks: no credentials, environment files or network.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const scalar = async (query, values = []) => Object.values((await db.query(query, values)).rows[0])[0];
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const reject = async (operation, message) => { await assert.rejects(operation, error => error.message.includes(message)); checks++; };
const definition = async (file, name) => {
  const source = await sql(file);
  const start = source.search(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\(`));
  assert(start >= 0, `Missing production function ${name}`);
  const end = source.indexOf("$$;", start);
  assert(end > start, `Missing end of production function ${name}`);
  return source.slice(start, end + 3);
};

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TYPE kq_run_status AS ENUM ('active','completed','abandoned');
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,state JSONB NOT NULL,status kq_run_status,
      started_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ,integrity_code TEXT);
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),run_id UUID UNIQUE REFERENCES kq_runs(id),owner_id UUID,
      variety_code TEXT,variety_name TEXT,quality SMALLINT CHECK(quality BETWEEN -6 AND 30),traits TEXT[],combos TEXT[],battle_stats JSONB,
      rules_version SMALLINT,cannabinoid_report JSONB,status TEXT DEFAULT 'available',created_at TIMESTAMPTZ DEFAULT now(),locked_at TIMESTAMPTZ,burned_at TIMESTAMPTZ);
    CREATE FUNCTION kq_business_settle(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION kq_care_state_valid(JSONB) RETURNS BOOLEAN LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION kq_storage_verdict_score(UUID) RETURNS NUMERIC LANGUAGE sql AS 'SELECT NULL::NUMERIC';
    CREATE TABLE kq_commerce_batches(flower_id UUID,user_id UUID,route TEXT,processing_ready_at TIMESTAMPTZ);
    CREATE TABLE kq_storage_lots(flower_id UUID,user_id UUID,state JSONB,original_units BIGINT);
    CREATE TABLE kq_market_lots(flower_id UUID,owner_id UUID,jury_score NUMERIC);
    CREATE TABLE kq_market_sale_receipts(flower_id UUID,owner_id UUID,harvest_grams NUMERIC,jury_score NUMERIC,route TEXT,sales_channel TEXT,created_at TIMESTAMPTZ);
    CREATE TABLE kq_chanvrier_processing_practice(flower_id UUID,user_id UUID,family TEXT,route TEXT);
    CREATE TABLE kq_online_sales(user_id UUID,customer_demand JSONB,satisfaction TEXT);
    CREATE TABLE kq_commerce_accounts(user_id UUID,clients INTEGER,shop_partners INTEGER);
    CREATE TABLE kq_card_burn_receipts(id UUID,card_instance_id UUID,card_code TEXT,stage_index INTEGER,use_kind TEXT,burned_at TIMESTAMPTZ,run_id UUID);
    CREATE TABLE kq_battles(id UUID,status TEXT,seed INTEGER,player_one_id UUID,player_two_id UUID,flower_one_id UUID,flower_two_id UUID,rounds JSONB,winner_id UUID,locked_at TIMESTAMPTZ,verdict_at TIMESTAMPTZ);
    CREATE TABLE kq_bot_battles(id UUID,user_id UUID,flower_id UUID,seed INTEGER,bot_flower JSONB,rounds JSONB,winner TEXT,verdict_at TIMESTAMPTZ,experience_awarded INTEGER);
    CREATE TABLE kq_rank_profiles(user_id UUID,season_code TEXT,rating INTEGER,season_points INTEGER,wins INTEGER,losses INTEGER,streak INTEGER,burned_flowers INTEGER,arena_experience INTEGER,updated_at TIMESTAMPTZ);
    CREATE TABLE kq_leaderboard_snapshots(season_code TEXT,leaderboard JSONB,snapshot_date TIMESTAMPTZ);
    -- Preserve the INSERT/validated-XP-restoration path used by both real starters.
    CREATE FUNCTION kq_start_run_with_heritage_internal(p_user UUID,p_buddie TEXT,p_seed INTEGER,p_deck TEXT[],p_scenarios TEXT[],p_initial_state JSONB,p_tokens INTEGER,p_heritage TEXT)
    RETURNS JSONB LANGUAGE plpgsql AS $$ DECLARE run kq_runs%ROWTYPE; BEGIN
      INSERT INTO kq_runs(user_id,state,status) VALUES(p_user,p_initial_state,'active') RETURNING * INTO run;
      UPDATE kq_runs SET state = p_initial_state WHERE id=run.id RETURNING * INTO run;
      RETURN to_jsonb(run);
    END $$;
    DO $$ DECLARE body TEXT; BEGIN
      body:=pg_get_functiondef('kq_start_run_with_heritage_internal(uuid,text,integer,text[],text[],jsonb,integer,text)'::REGPROCEDURE);
      EXECUTE replace(body,'kq_start_run_with_heritage_internal(','kq_start_campaign_leader_internal(');
    END $$;
  `);
  await db.exec(await definition("20261010000100_kq_culture_care.sql", "rpc_kq_update_run_state"));
  await db.exec(await definition("20261015000200_kq_mission_aroma_evidence.sql", "kq_mission_metrics"));
  await db.exec(await definition("20260813000100_kq_player_core_snapshot.sql", "rpc_kq_player_core_snapshot"));
  await db.exec(await definition("20261013000200_kq_shared_campaigns.sql", "kq_campaign_project_state"));
  await db.exec("REVOKE ALL ON FUNCTION rpc_kq_player_core_snapshot(UUID) FROM PUBLIC; GRANT EXECUTE ON FUNCTION rpc_kq_player_core_snapshot(UUID) TO service_role");

  const owner = randomUUID();
  const base = { rulesVersion: 2, seed: 42, varietyCode: "HH2026-020", varietyName: "Test", phase: "prepare", history: [],
    deckCodes: [], situationCodes: [], usedCards: [], quality: 0 };
  const start = async (state = base) => (await db.query("INSERT INTO kq_runs(user_id,state,status) VALUES($1,$2,'active') RETURNING *", [owner, state])).rows[0];
  const row = id => scalar("SELECT to_jsonb(r) FROM kq_runs r WHERE id=$1", [id]);
  const updateState = (id, state) => db.query("UPDATE kq_runs SET state=$2 WHERE id=$1", [id, state]);
  const advanceHistory = async (run, outcomes, quality) => {
    let state = run.state;
    for (const outcome of outcomes) {
      state = { ...state, history: [...state.history, { outcome }], quality, phase: "resolved" };
      await updateState(run.id, state);
    }
    return row(run.id);
  };
  const finish = async run => {
    const state = { ...run.state, phase: "complete" };
    const flower = { varietyCode: state.varietyCode, varietyName: state.varietyName, quality: state.quality,
      traits: [], combos: [], battleStats: { appearance: 80, aroma: 80, vigor: 80, mastery: 80, regularity: 80 },
      integrityCode: "KQ-1234ABCD", harvestTierVersion: 1, successfulStages: 6, criticalStages: 6, tier: "Fleur légendaire" };
    return scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'advance',$4,$5)", [owner, run.id, run.updated_at, state, flower]);
  };
  const metrics = () => scalar("SELECT kq_mission_metrics($1)", [owner]);
  const oldActive = await start();
  const oldDone = await advanceHistory(await start(), ["success", "success", "success", "fragile", "fragile", "fragile"], 14);
  const oldFlower = (await finish(oldDone)).flower;
  const oldMetrics = await metrics();

  await db.exec(await sql("20261018000900_kq_harvest_tiers_v2.sql"));
  equal(await metrics(), oldMetrics, "all historical mission progress survives even without claimed receipts");
  equal((await row(oldActive.id)).state, oldActive.state, "active historical culture is unchanged");
  equal(await scalar("SELECT harvest_tier_version FROM kq_flowers WHERE id=$1", [oldFlower.id]), 1, "existing flower keeps legacy version");
  for (const starter of ["kq_start_run_with_heritage_internal", "kq_start_campaign_leader_internal"]) {
    const restored = await scalar(`SELECT ${starter}($1,'HH2026-020',42,'{}','{}',$2,0,NULL)`, [owner, base]);
    equal(restored.state.harvestTierVersion, 2, `${starter} preserves forced version when an old server restores starting XP`);
  }
  equal((await finish(await advanceHistory(oldActive, Array(6).fill("success"), 14))).flower.harvest_tier_version, 1,
    "historical active culture completes under its original rules");
  await reject(() => updateState(oldActive.id, { ...(oldActive.state), harvestTierVersion: 2 }), "kq_harvest_tier_version_immutable");

  const fresh = await start({ ...base, harvestTierVersion: 1 });
  equal(fresh.state.harvestTierVersion, 2, "database overrides a requested old version on new cultures");
  await reject(() => updateState(fresh.id, base), "kq_harvest_tier_version_immutable");
  await reject(() => updateState(fresh.id, { ...fresh.state, harvestTierVersion: 1 }), "kq_harvest_tier_version_immutable");
  await reject(() => updateState(fresh.id, { ...fresh.state, history: [{ outcome: "critical" }, { outcome: "critical" }] }), "kq_harvest_history_invalid");
  const incomplete = await advanceHistory(await start(), ["critical"], 26);
  await reject(() => finish(incomplete), "kq_harvest_history_invalid");
  equal((await row(incomplete.id)).status, "active", "rejected incomplete harvest rolls back completion");
  const dying = await advanceHistory(await start({ ...base, rulesVersion: 3, care: { vitality: 100 } }), ["failure"], -1);
  const deadState = { ...dying.state, phase: "complete", cultureDead: true, harvestGrams: 0,
    care: { vitality: 0 }, history: [...dying.state.history, { outcome: "failure" }] };
  const dead = await scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'resolve',$4,NULL)", [owner, dying.id, dying.updated_at, deadState]);
  equal([dead.flower, (await row(dying.id)).status], [null, "abandoned"], "early culture death remains valid without six stages or a flower");
  const ready = await advanceHistory(fresh, ["critical", "critical", "success", "success", "fragile", "failure"], 26);
  await reject(() => updateState(fresh.id, { ...ready.state, history: ready.state.history.map(() => ({ outcome: "critical" })) }), "kq_harvest_history_invalid");
  const awarded = (await finish(ready)).flower;
  equal([awarded.harvest_tier_version, awarded.successful_stages, awarded.critical_stages], [2, 4, 2],
    "real completion RPC derives evidence from the archived outcomes, ignoring forged flower counts and version");
  await reject(() => db.query("UPDATE kq_flowers SET critical_stages=6 WHERE id=$1", [awarded.id]), "kq_flower_harvest_evidence_immutable");
  await reject(() => db.query("UPDATE kq_flowers SET quality=30 WHERE id=$1", [awarded.id]), "kq_flower_harvest_evidence_immutable");
  await db.query("UPDATE kq_flowers SET status='burned',burned_at=now() WHERE id=$1", [awarded.id]);
  equal((await metrics()).legendary_flowers, 3, "sold or consumed flowers retain earned legendary mission credit");

  const failedGate = (await finish(await advanceHistory(await start(), ["critical", "success", "success", "success", "success", "success"], 30))).flower;
  equal([failedGate.successful_stages, failedGate.critical_stages], [6, 1], "insufficient critical results are never invented");
  equal((await metrics()).legendary_flowers, 3, "high raw quality alone cannot complete a new legendary mission");
  equal((await metrics()).contest_flowers, 4, "exceptional flowers still count toward contest missions");
  for (const [quality, version, successes, criticals, expected] of [
    [5, 1, null, null, 0], [6, 1, null, null, 1], [10, 1, null, null, 2], [14, 1, null, null, 4],
    [7, 2, 6, 6, 0], [8, 2, 6, 6, 1], [13, 2, 6, 6, 1], [14, 2, 6, 6, 2],
    [19, 2, 6, 6, 2], [20, 2, 6, 6, 3], [25, 2, 6, 6, 3], [26, 2, 4, 2, 4],
    [30, 2, 3, 2, 3], [30, 2, 6, 1, 3], [30, 2, null, null, 3],
  ]) equal(await scalar("SELECT kq_harvest_tier_rank($1,$2,$3,$4)", [quality, version, successes, criticals]), expected,
    `tier boundaries and independent gates: ${quality}/${version}/${successes}/${criticals}`);

  const projected = await scalar("SELECT kq_campaign_project_state($1,$2)", [ready.state, { ...ready.state, varietyCode: "HH2026-021" }]);
  equal([projected.harvestTierVersion, projected.history], [2, ready.state.history], "shared campaigns retain the common version and actual outcome evidence");
  await db.query("INSERT INTO kq_battles VALUES($1,'verdict',42,$2,$3,$4,$5,'[]',$2,now(),now())",
    [randomUUID(), owner, randomUUID(), oldFlower.id, failedGate.id]);
  await db.query("INSERT INTO kq_bot_battles VALUES($1,$2,$3,42,'{}','[]','player',now(),1)", [randomUUID(), owner, failedGate.id]);
  const snapshot = await scalar("SELECT rpc_kq_player_core_snapshot($1)", [owner]);
  const modernSnapshot = snapshot.flowers.find(flower => flower.id === failedGate.id);
  equal([modernSnapshot.harvestTierVersion, modernSnapshot.successfulStages, modernSnapshot.criticalStages], [2, 6, 1], "inventory snapshot exposes authoritative camelCase evidence");
  equal(snapshot.humanBattles[0].playerFlower.harvest_tier_version, 1, "historical human battle keeps original title version");
  equal(snapshot.humanBattles[0].opponentFlower.critical_stages, 1, "human battle exposes snake_case evidence");
  equal(snapshot.botBattles[0].playerFlower.harvest_tier_version, 2, "bot battle exposes versioned evidence");
  for (const quality of [41, 53]) {
    const high = (await finish(await advanceHistory(await start(), Array(6).fill("critical"), quality))).flower;
    equal(high.quality, quality, `valid high quality ${quality} persists through the real completion RPC`);
  }
  const overLimit = await advanceHistory(await start(), Array(6).fill("critical"), 54);
  await reject(() => finish(overLimit), "kq_flowers_quality_check");
  equal((await row(overLimit.id)).status, "active", "quality above the legal maximum rolls back the entire completion");
  for (const role of ["anon", "authenticated", "service_role"]) {
    equal(await scalar("SELECT has_function_privilege($1,'public.kq_harvest_tier_rank(integer,integer,integer,integer)','EXECUTE')", [role]), false, `${role} cannot invoke private balance helper`);
    equal(await scalar("SELECT has_function_privilege($1,'public.kq_guard_harvest_tier_run()','EXECUTE')", [role]), false, `${role} cannot invoke private run guard`);
  }
  equal(await scalar("SELECT has_function_privilege('service_role','public.rpc_kq_player_core_snapshot(uuid)','EXECUTE')"), true,
    "existing service RPC grant survives function patching");
  console.log(`${checks} harvest tier checks passed in isolated PostgreSQL.`);
} finally {
  await db.close();
}
