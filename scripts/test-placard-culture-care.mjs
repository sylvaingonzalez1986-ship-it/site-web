// Local PostgreSQL integration tests; no credentials, network or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
const migration = (name) => readFile(path.resolve("supabase/migrations", name), "utf8");
const query = (sql, args = []) => db.query(sql, args);
const scalar = async (sql, args = []) => Object.values((await query(sql, args)).rows[0])[0];
const checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const reject = async (name, fn, message) => { await assert.rejects(fn, error => error.message.includes(message), name); checks.push(name); };
const snapshot = async (owner) => ({
  cash: await scalar("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner]),
  inventory: await scalar("SELECT kq_care_inventory_json($1)", [owner]),
  purchases: await scalar("SELECT count(*)::integer FROM kq_care_purchases WHERE user_id=$1", [owner]),
  interventions: await scalar("SELECT count(*)::integer FROM kq_care_interventions WHERE user_id=$1", [owner]),
});
const buy = (owner, product, quantity = 1, key = randomUUID()) => scalar("SELECT rpc_kq_purchase_care($1,$2,$3,$4)", [owner, product, quantity, key]);
const runRow = async (id) => (await query("SELECT *,updated_at::TEXT AS updated_at FROM kq_runs WHERE id=$1", [id])).rows[0];
const apply = (owner, run, next, product, key = randomUUID(), version = run.updated_at, quote = product === null ? KQ_BASIC_CARE_PRICE_CENTS : null) => scalar(
  "SELECT rpc_kq_apply_care($1,$2,$3,$4,$5,$6,$7)", [owner, run.id, product, key, version, JSON.stringify(next), quote]);
let startKqGame, resolveKqStage, advanceKqStage, applyKqCareProduct, performKqBasicCare, KQ_CARE_PRODUCTS, KQ_BASIC_CARE_PRICE_CENTS, getKqCannabinoidReport;
async function player() {
  const id = randomUUID();
  await query("INSERT INTO auth.users VALUES($1)", [id]);
  await query("SELECT rpc_kq_ensure_equipment_profile($1)", [id]);
  return id;
}
async function createRun(owner, state = startKqGame(31)) {
  const id = await scalar("INSERT INTO kq_runs(user_id,state,status) VALUES($1,$2,'active') RETURNING id", [owner, JSON.stringify(state)]);
  return runRow(id);
}
try {
  ({ startKqGame, resolveKqStage, advanceKqStage } = await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts"));
  ({ applyKqCareProduct, performKqBasicCare, KQ_CARE_PRODUCTS, KQ_BASIC_CARE_PRICE_CENTS, getKqCannabinoidReport } = await vite.ssrLoadModule("/src/lib/kanab-quest-care.ts"));
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TYPE kq_run_status AS ENUM('active','completed','abandoned');
    CREATE TYPE lottery_card_rarity AS ENUM('common','silver','gold');
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users,state JSONB,
      status kq_run_status,started_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ,integrity_code TEXT,
      CHECK((status='completed')=(completed_at IS NOT NULL)));
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),run_id UUID UNIQUE REFERENCES kq_runs,owner_id UUID,
      variety_code TEXT,variety_name TEXT,quality SMALLINT,traits TEXT[],combos TEXT[],battle_stats JSONB,status TEXT DEFAULT 'available',
      created_at TIMESTAMPTZ DEFAULT now(),locked_at TIMESTAMPTZ,burned_at TIMESTAMPTZ);
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users,cash_cents INTEGER DEFAULT 100000 CHECK(cash_cents>=0),updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_treasury_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users,started_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_treasury_journal(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES kq_treasury_accounts,
      source_key TEXT,kind TEXT,reference TEXT,occurred_at TIMESTAMPTZ,postings JSONB,UNIQUE(user_id,source_key));
    CREATE TABLE kq_treasury_balances(user_id UUID REFERENCES kq_treasury_accounts,account TEXT,balance_cents BIGINT,PRIMARY KEY(user_id,account));
    -- Existing production accounting is exercised below using the real post/
    -- pair functions, plus a minimal opening position and wallet trigger.
    CREATE FUNCTION kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
      DECLARE cash INTEGER; BEGIN
      SELECT cash_cents INTO cash FROM kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
      INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      IF FOUND THEN PERFORM kq_treasury_pair(p_user,'opening','opening',now(),'cash','opening_equity',cash,'Opening fixture'); END IF;
      END $$;
    CREATE FUNCTION fixture_wallet_movement() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM kq_treasury_accounts WHERE user_id=NEW.user_id) THEN
        PERFORM kq_treasury_pair(NEW.user_id,'cash-movement','cash:'||gen_random_uuid(),now(),'cash','suspense',NEW.cash_cents-OLD.cash_cents,'Wallet fixture');
      END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_wallet_movement AFTER UPDATE ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION fixture_wallet_movement();
    CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS $$
      INSERT INTO kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING $$;
    CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    CREATE TABLE lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT,is_active BOOLEAN DEFAULT true);
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID,code TEXT,name TEXT,
      rarity lottery_card_rarity,card_number INTEGER,is_active BOOLEAN DEFAULT true,image_url TEXT,description TEXT);
    CREATE TABLE lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,card_definition_id UUID,
      ticket_id UUID,kq_support_entitlement_id UUID,source_bot_battle_id UUID,pack_slot INTEGER,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_support_booster_entitlements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,ticket_id UUID,
      status TEXT DEFAULT 'available',card_count INTEGER DEFAULT 10,opened_at TIMESTAMPTZ);
    CREATE FUNCTION lottery_secure_random_int(lo INTEGER,hi INTEGER) RETURNS INTEGER LANGUAGE sql AS $$ SELECT lo $$;
    CREATE TABLE kq_card_burn_receipts(id UUID,run_id UUID,card_instance_id UUID,card_code TEXT,stage_index SMALLINT,use_kind TEXT,burned_at TIMESTAMPTZ);
    CREATE TABLE kq_battles(id UUID,player_one_id UUID,player_two_id UUID,flower_one_id UUID,flower_two_id UUID,status TEXT,seed INTEGER,
      rounds JSONB,winner_id UUID,locked_at TIMESTAMPTZ,verdict_at TIMESTAMPTZ);
    CREATE TABLE kq_bot_battles(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),flower_id UUID,user_id UUID,bot_code TEXT,bot_flower JSONB,seed INTEGER,rounds JSONB,winner TEXT,experience_awarded NUMERIC DEFAULT 0.1,verdict_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_rank_profiles(user_id UUID PRIMARY KEY,season_code TEXT,rating INTEGER,season_points INTEGER,wins INTEGER,losses INTEGER,
      streak INTEGER,burned_flowers INTEGER,arena_experience NUMERIC,updated_at TIMESTAMPTZ);
    CREATE FUNCTION kq_active_season_code() RETURNS TEXT LANGUAGE sql AS $$ SELECT 'KQ-2026-S1'::TEXT $$;
    CREATE TABLE kq_leaderboard_snapshots(season_code TEXT,snapshot_date DATE,leaderboard JSONB);
    -- A representative trigger verifies that interventions are not harvested
    -- runs and death remains terminal without running the completion pipeline.
    CREATE TABLE completion_audit(run_id UUID PRIMARY KEY);
    CREATE FUNCTION fixture_completion() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.status='completed' AND OLD.status='active' THEN INSERT INTO completion_audit VALUES(NEW.id); END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_completion AFTER UPDATE ON kq_runs FOR EACH ROW EXECUTE FUNCTION fixture_completion();
  `);
  const treasury = await migration("20260921000200_kq_treasury_accounting.sql");
  await db.exec(treasury.slice(treasury.indexOf("CREATE FUNCTION public.kq_treasury_post"), treasury.indexOf("-- Actual production cost only.")));
  const booster = await migration("20260727000300_kq_pvp_three_card_booster.sql");
  await db.exec(booster.slice(booster.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_open_support_booster"), booster.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle_for_both_players")));
  const bot=await migration("20260727000200_kq_bot_victory_card_reward.sql");
  await db.exec(bot.slice(bot.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_bot_battle"),bot.indexOf("COMMIT;")));
  await db.exec(await migration("20260813000100_kq_player_core_snapshot.sql"));
  await db.exec(await migration("20261010000100_kq_culture_care.sql"));
  const crowdedState = {
    ...startKqGame(31), stageIndex: 4,
    care: {
      ...startKqGame(31).care,
      problems: ["HEAT", "ROOTS", "APHIDS", "MITES", "THRIPS"].map((code, appearedAt) => ({
        code, severity: 1, status: "confirmed", trend: "stable", appearedAt, variant: 0,
      })),
    },
  };
  check("historical validator rejects a third explicit problem", await scalar("SELECT kq_care_state_valid($1)", [JSON.stringify({
    ...crowdedState.care, problems: crowdedState.care.problems.slice(0, 3),
  })]), false);
  await db.exec(await migration("20261010000600_kq_care_explicit_problems.sql"));
  // A real pre-migration receipt was free and must never be charged on retry.
  const freeOwner = await player(), freeRun = await createRun(freeOwner), freeKey = randomUUID();
  const freeNext = performKqBasicCare(freeRun.state);
  await scalar("SELECT rpc_kq_apply_care($1,$2,NULL,$3,$4,$5)", [freeOwner, freeRun.id, freeKey, freeRun.updated_at, JSON.stringify(freeNext)]);
  await db.exec(await migration("20261010001000_kq_paid_basic_care.sql"));
  const historicalReceipt = await scalar("SELECT rpc_kq_care_intervention_receipt($1,$2,$3,NULL)", [freeOwner, freeRun.id, freeKey]);
  check("historical free receipt keeps its original zero charge", [historicalReceipt.chargedCents, historicalReceipt.cashCents], [0, 100000]);
  check("historical free receipt replays without a current quote", (await apply(freeOwner, freeRun, freeNext, null, freeKey, freeRun.updated_at, null)).chargedCents, 0);
  check("SQL basic price matches the game catalogue", await scalar("SELECT kq_basic_care_price()"), KQ_BASIC_CARE_PRICE_CENTS);
  check("shop advertises the actual SQL basic-care quote", (await scalar("SELECT rpc_kq_care_shop($1)", [freeOwner])).basicCarePriceCents, KQ_BASIC_CARE_PRICE_CENTS);
  for (const count of [0, 2, 3, 4, 5]) check(`updated validator accepts ${count} observed problems`, await scalar(
    "SELECT kq_care_state_valid($1)", [JSON.stringify({ ...crowdedState.care, problems: crowdedState.care.problems.slice(0, count) })]), true);
  const excessiveProblems = [...crowdedState.care.problems, { code: "SALTS", severity: 1, status: "confirmed", trend: "stable", appearedAt: 4, variant: 0 }];
  check("updated validator still rejects a sixth problem", await scalar("SELECT kq_care_state_valid($1)", [JSON.stringify({
    ...crowdedState.care, problems: excessiveProblems,
  })]), false);
  check("updated validator preserves health bounds", await scalar("SELECT kq_care_state_valid($1)", [JSON.stringify({
    ...crowdedState.care, vitality: 101,
  })]), false);
  check("updated validator preserves history bounds", await scalar("SELECT kq_care_state_valid($1)", [JSON.stringify({
    ...crowdedState.care, history: Array(49).fill({}),
  })]), false);
  for (const product of KQ_CARE_PRODUCTS) check(`authoritative SQL price ${product.code}`, await scalar("SELECT kq_care_price($1)", [product.code]), product.priceCents);

  const owner = await player(), other = await player();
  const crowdedOwner = await player();
  let crowdedRun = await createRun(crowdedOwner, crowdedState);
  const crowdedBasic = performKqBasicCare(crowdedRun.state);
  await reject("care RPC rejects a sixth problem", () => apply(crowdedOwner, crowdedRun, {
    ...crowdedBasic, care: { ...crowdedBasic.care, problems: excessiveProblems },
  }, null), "kq_care_invalid_request");
  check("rejected over-cap care leaves the culture intact", (await runRow(crowdedRun.id)).state, crowdedState);
  const crowdedReceipt = await apply(crowdedOwner, crowdedRun, crowdedBasic, null);
  check("care RPC preserves all five explicit problems", crowdedReceipt.state.care.problems, crowdedState.care.problems);
  crowdedRun = await runRow(crowdedRun.id);
  const crowdedNext = { ...crowdedRun.state, stageIndex: 5 };
  const advanceCrowded = (state) => scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'advance',$4,NULL)", [
    crowdedOwner, crowdedRun.id, crowdedRun.updated_at, JSON.stringify(state),
  ]);
  await reject("progress RPC rejects a sixth problem", () => advanceCrowded({
    ...crowdedNext, care: { ...crowdedNext.care, problems: excessiveProblems },
  }), "kq_invalid_state_transition");
  await advanceCrowded(crowdedNext);
  check("progress RPC preserves all five explicit problems", (await runRow(crowdedRun.id)).state.care.problems, crowdedState.care.problems);
  const key = randomUUID();
  const receipts = await Promise.all([buy(owner,"CARE-COMPOST-TEA",2,key),buy(owner,"CARE-COMPOST-TEA",2,key)]);
  check("retry buys exactly once", receipts.map(r=>r.replayed), [false,true]);
  check("one debit, one receipt, exact purchased stock", await snapshot(owner), {
    cash:98200,inventory:[{productCode:"CARE-COMPOST-TEA",quantity:2}],purchases:1,interventions:0,
  });
  const before = await snapshot(owner);
  await reject("changed idempotency payload rejected",()=>buy(owner,"CARE-SEAWEED",2,key),"kq_care_request_mismatch");
  await reject("unknown product rejected",()=>buy(owner,"FORGED",1),"kq_care_invalid_request");
  await reject("fractional or oversized quantity rejected",()=>buy(owner,"CARE-COMPOST-TEA",21),"kq_care_invalid_request");
  check("failed purchases leave all stores untouched",await snapshot(owner),before);
  await query("UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1",[other]);
  await reject("insufficient cash is atomic",()=>buy(other,"CARE-ORIUS"),"kq_care_insufficient_cash");
  check("no phantom stock after rejected purchase",(await snapshot(other)).inventory,[]);

  let run = await createRun(owner);
  const firstState = applyKqCareProduct(run.state,"CARE-COMPOST-TEA"), applyKey=randomUUID();
  const first = await apply(owner,run,firstState,"CARE-COMPOST-TEA",applyKey);
  check("care consumes one charge",first.inventory,[{productCode:"CARE-COMPOST-TEA",quantity:1}]);
  check("care leaves the game outside care unchanged",Object.fromEntries(Object.entries(first.state).filter(([k])=>k!=="care")),Object.fromEntries(Object.entries(run.state).filter(([k])=>k!=="care")));
  check("care does not trigger harvest",await scalar("SELECT count(*)::integer FROM completion_audit"),0);
  check("same action retry does not consume again",(await apply(owner,run,firstState,"CARE-COMPOST-TEA",applyKey)).replayed,true);
  await reject("request key cannot target a different product",()=>apply(owner,run,firstState,"CARE-ORIUS",applyKey),"kq_care_request_mismatch");
  await reject("a concurrent stale action is rejected",()=>apply(owner,run,firstState,"CARE-COMPOST-TEA"),"kq_stale_run");
  await reject("another player cannot touch run",()=>apply(other,run,firstState,"CARE-COMPOST-TEA"),"kq_run_unavailable");
  run=await runRow(run.id);
  await reject("client-like state forging rejected",()=>apply(owner,run,{...performKqBasicCare(run.state),xp:999},null),"kq_care_invalid_request");
  const zeroBefore=await snapshot(owner);
  const noStockRun=await createRun(owner);
  await reject("no stock cannot mutate culture",()=>apply(owner,noStockRun,applyKqCareProduct(noStockRun.state,"CARE-SEAWEED"),"CARE-SEAWEED"),"kq_care_stock_unavailable");
  check("no-stock intervention rolls back inventory and receipt",await snapshot(owner),zeroBefore);
  check("no-stock intervention rolls back state",(await runRow(run.id)).state,run.state);
  const basic=await apply(owner,run,performKqBasicCare(run.state),null);
  check("basic care does not consume inventory",basic.inventory,first.inventory);
  check("basic care debits its quoted price",[basic.cashCents,basic.chargedCents],[98200-KQ_BASIC_CARE_PRICE_CENTS,KQ_BASIC_CARE_PRICE_CENTS]);
  run=await runRow(run.id);
  await reject("basic care cannot be repeated",()=>apply(owner,run,performKqBasicCare(run.state),null),"kq_care_invalid_request");
  const replay=await scalar("SELECT rpc_kq_care_intervention_receipt($1,$2,$3,$4)",[owner,run.id,applyKey,"CARE-COMPOST-TEA"]);
  check("late replay returns current culture",replay.state,run.state);
  check("product usage has no extra cash charge",[first.chargedCents,first.cashCents],[0,98200]);

  const paidOwner = await player();
  let paidRun = await createRun(paidOwner);
  const paidNext = performKqBasicCare(paidRun.state), paidKey = randomUUID();
  const atomicSnapshot = async (owner, id) => ({
    ...(await snapshot(owner)), run: await runRow(id),
    journal: (await query("SELECT * FROM kq_treasury_journal WHERE user_id=$1 ORDER BY source_key", [owner])).rows,
    balances: (await query("SELECT * FROM kq_treasury_balances WHERE user_id=$1 ORDER BY account", [owner])).rows,
  });
  const unpaid = await atomicSnapshot(paidOwner, paidRun.id);
  await reject("old six-argument free button cannot silently debit", () => scalar("SELECT rpc_kq_apply_care($1,$2,NULL,$3,$4,$5)", [paidOwner,paidRun.id,randomUUID(),paidRun.updated_at,JSON.stringify(paidNext)]), "kq_care_price_changed");
  for (const quote of [0, KQ_BASIC_CARE_PRICE_CENTS-1, KQ_BASIC_CARE_PRICE_CENTS+1]) {
    await reject(`stale price ${quote} cannot debit`, () => apply(paidOwner,paidRun,paidNext,null,randomUUID(),paidRun.updated_at,quote), "kq_care_price_changed");
  }
  check("rejected quotes leave cash, state, receipts and ledger intact",await atomicSnapshot(paidOwner,paidRun.id),unpaid);
  await reject("payment cannot hide an immediate health change", () => apply(paidOwner,paidRun,{...paidNext,care:{...paidNext.care,vitality:99}},null), "kq_care_invalid_request");
  // Force a failure after wallet, ledger and run mutations to check rollback.
  await db.exec("ALTER TABLE kq_care_interventions ADD CONSTRAINT fixture_abort_paid_receipt CHECK(charged_cents=0) NOT VALID");
  await reject("late receipt failure rolls back the entire debit", () => apply(paidOwner,paidRun,paidNext,null,paidKey), "fixture_abort_paid_receipt");
  await db.exec("ALTER TABLE kq_care_interventions DROP CONSTRAINT fixture_abort_paid_receipt");
  check("receipt failure rolls back state, wallet and accounting together",await atomicSnapshot(paidOwner,paidRun.id),unpaid);
  const paidReceipts=await Promise.all([apply(paidOwner,paidRun,paidNext,null,paidKey),apply(paidOwner,paidRun,paidNext,null,paidKey)]);
  check("concurrent paid retries debit only once",paidReceipts.map(item=>[item.replayed,item.cashCents,item.chargedCents]),[[false,100000-KQ_BASIC_CARE_PRICE_CENTS,KQ_BASIC_CARE_PRICE_CENTS],[true,100000-KQ_BASIC_CARE_PRICE_CENTS,KQ_BASIC_CARE_PRICE_CENTS]]);
  check("one upkeep expense reaches the treasury journal",await scalar("SELECT count(*)::integer FROM kq_treasury_journal WHERE user_id=$1 AND kind='culture-care'",[paidOwner]),1);
  check("upkeep accounts balance without residual suspense",(await query("SELECT account,balance_cents::integer amount FROM kq_treasury_balances WHERE user_id=$1 AND account IN ('cash','suspense','expense_maintenance') ORDER BY account",[paidOwner])).rows,[{account:"cash",amount:100000-KQ_BASIC_CARE_PRICE_CENTS},{account:"expense_maintenance",amount:KQ_BASIC_CARE_PRICE_CENTS},{account:"suspense",amount:0}]);
  paidRun=await runRow(paidRun.id);
  const alreadyPaid=await atomicSnapshot(paidOwner,paidRun.id);
  await reject("new request cannot charge a second basic care on the same step",()=>apply(paidOwner,paidRun,performKqBasicCare(paidRun.state),null),"kq_care_invalid_request");
  check("same-step refusal leaves wallet and ledger intact",await atomicSnapshot(paidOwner,paidRun.id),alreadyPaid);
  const advanced=advanceKqStage(resolveKqStage({...paidRun.state,phase:"rolled",dice:[6,6,6]}));
  await query("UPDATE kq_runs SET state=$2,updated_at=clock_timestamp() WHERE id=$1",[paidRun.id,JSON.stringify(advanced)]);
  await buy(paidOwner,"CARE-SEAWEED");
  const delayed=await apply(paidOwner,paidRun,paidNext,null,paidKey,paidRun.updated_at,0);
  check("late paid retry returns advanced state and current cash with original amount",[delayed.state,delayed.cashCents,delayed.chargedCents],[JSON.parse(JSON.stringify(advanced)),100000-KQ_BASIC_CARE_PRICE_CENTS-1200,KQ_BASIC_CARE_PRICE_CENTS]);
  check("late paid retry never posts another expense",await scalar("SELECT count(*)::integer FROM kq_treasury_journal WHERE user_id=$1 AND kind='culture-care'",[paidOwner]),1);
  paidRun=await runRow(paidRun.id);
  const productNext=applyKqCareProduct(paidRun.state,"CARE-SEAWEED");
  await reject("a product application cannot smuggle in unpaid basic care",()=>apply(paidOwner,paidRun,{...productNext,care:{...productNext.care,lastBasicCareStage:1}},"CARE-SEAWEED"),"kq_care_invalid_request");
  const oldProductCall=await scalar("SELECT rpc_kq_apply_care($1,$2,'CARE-SEAWEED',$3,$4,$5)",[paidOwner,paidRun.id,randomUUID(),paidRun.updated_at,JSON.stringify(productNext)]);
  check("old six-argument product applications remain compatible without a new debit",[oldProductCall.chargedCents,oldProductCall.cashCents,oldProductCall.inventory],[0,100000-KQ_BASIC_CARE_PRICE_CENTS-1200,[{productCode:"CARE-SEAWEED",quantity:0}]]);
  const poorOwner=await player(),poorRun=await createRun(poorOwner);
  await query("UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1",[poorOwner,KQ_BASIC_CARE_PRICE_CENTS-1]);
  const poorBefore=await atomicSnapshot(poorOwner,poorRun.id);
  await reject("insufficient basic-care funds never activate care",()=>apply(poorOwner,poorRun,performKqBasicCare(poorRun.state),null),"kq_care_basic_insufficient_cash");
  check("insufficient basic-care funds preserve every store",await atomicSnapshot(poorOwner,poorRun.id),poorBefore);

  const collection=await scalar("INSERT INTO lottery_card_collections(code) VALUES('BOTTE_DU_CHANVRIER_2026') RETURNING id");
  for(const [index,code] of ["BOTTE-002","BOTTE-010","BOTTE-011","BOTTE-012","BOTTE-022","BOTTE-023","BOTTE-004","BOTTE-025","BOTTE-003"].entries()) {
    const id=await scalar("INSERT INTO lottery_card_definitions(collection_id,code,name,rarity,card_number) VALUES($1,$2,$2,'common',$3) RETURNING id",[collection,code,index]);
    await query("INSERT INTO lottery_card_instances(user_id,card_definition_id) VALUES($1,$2)",[other,id]);
  }
  const legacyState={...startKqGame(51),rulesVersion:2}; delete legacyState.care;
  const legacy=await createRun(other,legacyState);
  await reject("v2 culture refuses new interventions",()=>apply(other,legacy,legacyState,null),"kq_care_legacy_run");
  await query("SELECT rpc_kq_care_shop($1)",[other]);
  check("initial care stock is empty even with old PBI cards",(await snapshot(other)).inventory,[]);
  await query("UPDATE kq_runs SET status='abandoned' WHERE id=$1",[legacy.id]);
  await query("SELECT rpc_kq_care_shop($1)",[other]);
  await query("SELECT rpc_kq_care_shop($1)",[other]);
  check("reading care stock never converts beta collections",(await snapshot(other)).inventory,[]);
  check("old cards are left to the separate launch reset",await scalar("SELECT count(*)::integer FROM lottery_card_instances WHERE user_id=$1",[other]),9);
  check("all original definitions remain active",await scalar("SELECT bool_and(is_active) FROM lottery_card_definitions"),true);
  const pack=await scalar("INSERT INTO kq_support_booster_entitlements(user_id) VALUES($1) RETURNING id",[other]);
  const opened=await scalar("SELECT rpc_kq_open_support_booster($1,$2)",[pack,other]);
  check("future boosters preserve size and exclude eight retired codes",opened.cards.map(c=>c.code),Array(10).fill("BOTTE-003"));

  const stats={appearance:70,aroma:71,vigor:72,mastery:73,regularity:74};
  const flower=(state, battleStats)=>({varietyCode:state.varietyCode,varietyName:state.varietyName,quality:state.quality,traits:[],combos:[],battleStats,integrityCode:"KQ-12345678",cannabinoidReport:state.rulesVersion===3?getKqCannabinoidReport(state):null});
  const update=(r,next,payload)=>scalar("SELECT rpc_kq_update_run_state($1,$2,$3,'advance',$4,$5)",[r.user_id,r.id,r.updated_at,JSON.stringify(next),payload?JSON.stringify(payload):null]);
  const complete={...run.state,phase:"complete",completedAt:new Date().toISOString()};
  await reject("new flowers require cannabinoid stat",()=>update(run,complete,flower(complete,stats)),"kq_invalid_flower_stats");
  await reject("terpenes cannot double count aromatic expression",()=>update(run,complete,flower(complete,{...stats,terpenes:75})),"kq_invalid_flower_stats");
  const validFlower=flower(complete,{...stats,cannabinoids:complete.care.cannabinoidExpression});
  await reject("report must be marked as simulated",()=>update(run,complete,{...validFlower,cannabinoidReport:{...validFlower.cannabinoidReport,simulated:false}}),"kq_invalid_cannabinoid_report");
  await reject("report requires all fourteen measured game analytes",()=>update(run,complete,{...validFlower,cannabinoidReport:{...validFlower.cannabinoidReport,rates:{cbd:8,cbg:1,thc:0.1}}}),"kq_invalid_cannabinoid_report");
  const harvested=await update(run,complete,flower(complete,{...stats,cannabinoids:complete.care.cannabinoidExpression}));
  check("new flowers carry six stats and version",[harvested.flower.rules_version,harvested.flower.battle_stats.cannabinoids],[3,complete.care.cannabinoidExpression]);
  check("complete cannabinoid panel persists as explicitly simulated",harvested.flower.cannabinoid_report,getKqCannabinoidReport(complete));
  check("fourteen individual analytes and seven derived totals are distinct",[Object.keys(harvested.flower.cannabinoid_report.rates).length,Object.keys(harvested.flower.cannabinoid_report.totals).length],[14,7]);
  check("harvest pipeline fires once",await scalar("SELECT count(*)::integer FROM completion_audit"),1);
  const core=await scalar("SELECT rpc_kq_player_core_snapshot($1)",[owner]);
  check("core snapshot exposes flower version",core.flowers[0].rulesVersion,3);
  check("core snapshot exposes cannabinoid report",core.flowers[0].cannabinoidReport,harvested.flower.cannabinoid_report);
  const older=await createRun(other,legacyState), oldComplete={...legacyState,phase:"complete"};
  await reject("legacy flower refuses sixth stat",()=>update(older,oldComplete,flower(oldComplete,{...stats,cannabinoids:75})),"kq_invalid_flower_stats");
  const oldHarvest=await update(older,oldComplete,flower(oldComplete,stats));
  check("legacy five-stat flower remains version 2",oldHarvest.flower.rules_version,2);
  const wonBot=await scalar("SELECT rpc_kq_finalize_bot_battle($1,$2,'bot-test','{}',42,'[{},{},{}]','player')",[other,oldHarvest.flower.id]);
  check("bot victory rewards also exclude retired care cards",wonBot.rewardCard.code,"BOTTE-003");
  const dead=await createRun(owner), deadNext={...dead.state,phase:"complete",cultureDead:true,harvestGrams:0,care:{...dead.state.care,vitality:0}};
  await update(dead,deadNext,null);
  check("zero-vitality death abandons without flower",[(await runRow(dead.id)).status,await scalar("SELECT count(*)::integer FROM kq_flowers WHERE run_id=$1",[dead.id])],["abandoned",0]);
  check("death does not enter harvest pipeline",await scalar("SELECT count(*)::integer FROM completion_audit"),2);

  for(const role of ["anon","authenticated","service_role"]) {
    for(const table of ["kq_care_inventory","kq_care_purchases","kq_care_interventions"]) {
      check(`${role} cannot read or write private ${table}`,await scalar("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')",[role,table]),false);
    }
    check(`${role} care RPC permission`,await scalar("SELECT has_function_privilege($1,'rpc_kq_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)','EXECUTE')",[role]),role==="service_role");
    check(`${role} cannot call internal care validator`,await scalar("SELECT has_function_privilege($1,'kq_care_state_valid(jsonb)','EXECUTE')",[role]),false);
    check(`${role} cannot call internal basic-care price`,await scalar("SELECT has_function_privilege($1,'kq_basic_care_price()','EXECUTE')",[role]),false);
  }
  console.log(JSON.stringify({result:"passed",checks:checks.length,details:checks,engine:"PGlite isolated PostgreSQL",concurrency:"Retry calls submitted together; PGlite serializes on one connection. CAS and row/advisory locks are explicitly verified."},null,2));
} catch(error) {
  console.error(error.message, error.where ?? "", error.detail ?? "");
  if(error.position) console.error("SQL context:",error.query?.slice(Math.max(0,Number(error.position)-220),Number(error.position)+120));
  if(error.name==="AssertionError") console.error(error);
  process.exitCode=1;
} finally { await vite.close(); await db.close(); }
