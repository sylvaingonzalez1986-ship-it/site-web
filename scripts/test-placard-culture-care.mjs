// Local PostgreSQL integration tests; no credentials, network or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";
import { installWarehousePreparations } from "./lib/warehouse-preparation-fixture.mjs";

import { installCultureCareFixture, installCultureCareWork } from "./lib/culture-care-fixture.mjs";

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
  await installCultureCareFixture(db, migration);
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
  const originalPrices = Object.fromEntries(await Promise.all(KQ_CARE_PRODUCTS.map(async product =>
    [product.code, await scalar("SELECT kq_care_price($1)", [product.code])])));

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
  // Surface billing preserves every pre-migration receipt and full application.
  const surfaceOwner=await player(), stranger=await player();
  await query("UPDATE kq_equipment_wallets SET cash_cents=1000000 WHERE user_id=$1",[surfaceOwner]);
  await buy(surfaceOwner,"CARE-SEAWEED",2);
  const historical=await scalar("SELECT jsonb_agg(to_jsonb(p)) FROM kq_care_purchases p WHERE user_id=$1",[surfaceOwner]);
  await installCultureCareWork(db, migration);
  await db.exec(await migration("20261108000900_kq_care_surface_and_purchase_register.sql"));
  check("old receipts retain their recorded amount",await scalar("SELECT total_price_cents FROM kq_care_purchases WHERE user_id=$1",[surfaceOwner]),historical[0].total_price_cents);
  check("old full-treatment reserve is not diluted",await scalar("SELECT quantity FROM kq_care_inventory WHERE user_id=$1",[surfaceOwner]),2);
  const surfaceState={...startKqGame(551),warehouse:{activeAreaM2:25,zones:[]}};
  surfaceState.care.problems=[{code:"THRIPS",severity:2,status:"confirmed",trend:"stable",appearedAt:0,variant:0}];
  const surfaceRun=await createRun(surfaceOwner,surfaceState);
  const shop=await scalar("SELECT rpc_kq_care_shop_v2($1,$2)",[surfaceOwner,surfaceRun.id]);
  check("server quotes every product on frozen cultivated area",[shop.areaM2,shop.pricingUnits,shop.prices["CARE-ORIUS"],shop.basicCarePriceCents],[25,25,45000,12500]);
  check("legacy reserve still covers complete 25m2 applications",shop.inventory.find(item=>item.productCode==="CARE-SEAWEED").quantity,2);
  const purchaseV2=(code,quantity,key=randomUUID(),price=45000,runId=surfaceRun.id)=>scalar("SELECT rpc_kq_purchase_care_v2($1,$2,$3,$4,$5,$6)",[surfaceOwner,code,quantity,key,runId,price]);
  const firstKey=randomUUID(),beforePurchase=await snapshot(surfaceOwner);
  await reject("stale flat-price quote cannot debit or create reserve",()=>purchaseV2("CARE-ORIUS",1,firstKey,1800),"kq_care_price_changed");
  check("rejected quote leaves receipt and money unchanged",await snapshot(surfaceOwner),beforePurchase);
  const purchased=await purchaseV2("CARE-ORIUS",1,firstKey);
  check("purchase adds exact area and no legacy charge",purchased.inventory.find(item=>item.productCode==="CARE-ORIUS"),{productCode:"CARE-ORIUS",quantity:1,legacyQuantity:0,areaQuantity:25});
  const once=await snapshot(surfaceOwner),workOnce=await scalar("SELECT hours FROM fixture_work WHERE user_id=$1",[surfaceOwner]);
  check("retry keeps recorded price even with old quote",(await purchaseV2("CARE-ORIUS",1,firstKey,1800)).replayed,true);
  check("retry never charges twice",await snapshot(surfaceOwner),once);
  check("retry never spends work twice",await scalar("SELECT hours FROM fixture_work WHERE user_id=$1",[surfaceOwner]),workOnce);
  await reject("same receipt cannot change quantity",()=>purchaseV2("CARE-ORIUS",2,firstKey,90000),"kq_care_request_mismatch");
  const larger=await createRun(surfaceOwner,{...surfaceState,warehouse:{activeAreaM2:30,zones:[]}});
  await reject("small reserve cannot cover larger surface",()=>apply(surfaceOwner,larger,applyKqCareProduct(larger.state,"CARE-ORIUS"),"CARE-ORIUS"),"kq_care_stock_unavailable");
  const used=await apply(surfaceOwner,surfaceRun,applyKqCareProduct(surfaceRun.state,"CARE-ORIUS"),"CARE-ORIUS");
  check("applying consumes square metres without a new money charge",[used.chargedCents,used.inventory.find(item=>item.productCode==="CARE-ORIUS").areaQuantity],[0,0]);
  const current=await runRow(surfaceRun.id),basicKey=randomUUID();
  await reject("stale base-care quote refuses flat debit",()=>apply(surfaceOwner,current,performKqBasicCare(current.state),null,basicKey,current.updated_at,500),"kq_care_price_changed");
  const paid=await apply(surfaceOwner,current,performKqBasicCare(current.state),null,basicKey,current.updated_at,12500);
  check("basic care bills exact cultivated area",paid.chargedCents,12500);
  check("basic-care replay remains recorded at actual cost",(await apply(surfaceOwner,current,performKqBasicCare(current.state),null,basicKey,current.updated_at,500)).chargedCents,12500);
  const legacyUse={...startKqGame(552),warehouse:{activeAreaM2:40,zones:[]}};legacyUse.care.problems=[{code:"HEAT",severity:1,status:"confirmed",trend:"stable",appearedAt:0,variant:0}];
  const legacyRun=await createRun(surfaceOwner,legacyUse);
  await apply(surfaceOwner,legacyRun,applyKqCareProduct(legacyUse,"CARE-SEAWEED"),"CARE-SEAWEED");
  check("old full charge remains usable without supplementary debit",await scalar("SELECT quantity FROM kq_care_inventory WHERE user_id=$1 AND product_code='CARE-SEAWEED'",[surfaceOwner]),1);
  const campaignRun=await createRun(surfaceOwner,startKqGame(553));
  const campaign={...campaignRun.state,warehouse:{activeAreaM2:10},campaign:{leaderRunId:campaignRun.id,members:[{warehouse:{activeAreaM2:10}},{warehouse:{activeAreaM2:15}}]}};
  await query("UPDATE kq_runs SET state=$2 WHERE id=$1",[campaignRun.id,JSON.stringify(campaign)]);
  check("campaign sums member surfaces once",(await scalar("SELECT rpc_kq_care_shop_v2($1,$2)",[surfaceOwner,campaignRun.id])).areaM2,25);
  await reject("incomplete campaign cannot silently underprice its surface",()=>scalar("SELECT kq_care_pricing($1)",[JSON.stringify({campaign:{members:[{warehouse:{activeAreaM2:10}},{}]}})]),"kq_care_invalid_request");
  const follower=await createRun(surfaceOwner,campaign);
  await reject("campaign follower cannot purchase a separate treatment",()=>purchaseV2("CARE-ORIUS",1,randomUUID(),45000,follower.id),"kq_campaign_action_required");
  await reject("another owner cannot quote a culture",()=>scalar("SELECT rpc_kq_care_shop_v2($1,$2)",[stranger,surfaceRun.id]),"kq_run_unavailable");
  const initialRegister=await scalar("SELECT rpc_kq_care_purchase_register($1)",[surfaceOwner]);
  check("paid register includes old purchases and basic-care receipts",initialRegister.items.length,3);
  check("paid register totals use actual old and new prices",initialRegister.totalPaidCents,2400+45000+12500);
  check("old purchase area is unknown, never reconstructed",initialRegister.items.find(item=>item.amountCents===2400).areaM2,null);
  check("owner isolation returns no other player's history",(await scalar("SELECT rpc_kq_care_purchase_register($1)",[stranger])).totalCount,0);
  check("new purchases and care do not leave a suspense accounting balance",await scalar("SELECT COALESCE(sum(balance_cents),0)::INTEGER FROM kq_treasury_balances WHERE user_id=$1 AND account='suspense'",[surfaceOwner]),0);
  await query("UPDATE fixture_work SET hours=12 WHERE user_id=$1",[surfaceOwner]);
  const exhaustedBefore=await snapshot(surfaceOwner),exhaustedJournal=await scalar("SELECT count(*)::INTEGER FROM kq_treasury_journal WHERE user_id=$1",[surfaceOwner]);
  await reject("workday failure rolls back purchase and accounting together",()=>purchaseV2("CARE-ORIUS",1,randomUUID()),"player_work_exhausted");
  check("failed workday leaves money, reserve and receipts untouched",await snapshot(surfaceOwner),exhaustedBefore);
  check("failed workday leaves accounting untouched",await scalar("SELECT count(*)::INTEGER FROM kq_treasury_journal WHERE user_id=$1",[surfaceOwner]),exhaustedJournal);
  await query("INSERT INTO kq_care_purchases(user_id,request_key,product_code,quantity,total_price_cents,created_at) SELECT $1,gen_random_uuid(),'CARE-SEAWEED',1,1200,'2026-11-08T00:00:00Z' FROM generate_series(1,30)",[surfaceOwner]);
  const page1=await scalar("SELECT rpc_kq_care_purchase_register($1)",[surfaceOwner]);
  const cursor=page1.nextCursor.split('|'),page2=await scalar("SELECT rpc_kq_care_purchase_register($1,$2,$3)",[surfaceOwner,...cursor]);
  check("equal-timestamp keyset pagination loses no receipt",[page1.items.length,page2.items.length,new Set([...page1.items,...page2.items].map(item=>item.id)).size],[25,8,33]);
  check("paginated aggregate always covers all history",[page1.totalCount,page2.totalPaidCents,page2.nextCursor],[33,page1.totalPaidCents,null]);
  for(const role of ["anon","authenticated","service_role"]){
    check(`${role} new register execute privilege`,await scalar("SELECT has_function_privilege($1,'rpc_kq_care_purchase_register(uuid,timestamptz,text)','EXECUTE')",[role]),role==="service_role");
    check(`${role} cannot bypass quoted purchase`,await scalar("SELECT has_function_privilege($1,'rpc_kq_purchase_care(uuid,text,integer,uuid)','EXECUTE')",[role]),false);
    check(`${role} cannot mutate or read raw receipts`,await scalar("SELECT has_table_privilege($1,'kq_care_purchases','SELECT,INSERT,UPDATE,DELETE')",[role]),false);
  }
  const captureSQL=await readFile(path.resolve("scripts/sql/capture-kq-care-version.sql"),"utf8");
  const captureCare=async ()=>(await db.exec(captureSQL)).at(-1).rows[0].script;
  const restorePassages=await captureCare();
  await db.exec(await migration("20261118000100_kq_care_sectors.sql"));
  const restoreSectors=await captureCare();
  const sectorOwner=await player(), stockCode="CARE-ORIUS";
  const zone={id:"est",active:true,x:2,y:1,width:2,height:3,rotation:90};
  const warehouse={zoneId:zone.id,activeAreaM2:6,zones:[zone]};
  const sectorState={...surfaceState,warehouse};
  const sectorRun=await createRun(sectorOwner,sectorState);
  const firstCell={zoneId:zone.id,x:1,y:2},secondCell={zoneId:zone.id,x:0,y:2};
  await query("INSERT INTO kq_care_inventory(user_id,product_code,quantity,area_quantity) VALUES($1,$2,1,1)",[sectorOwner,stockCode]);
  const scopedShop=async run=>(await scalar("SELECT rpc_kq_care_shop_v2($1,$2)",[sectorOwner,run.id]));
  const row=result=>result.inventory.find(item=>item.productCode===stockCode);
  const spatialShop=await scopedShop(sectorRun);
  check("sector reserve includes every remaining square metre and old full passage", row(spatialShop),{productCode:stockCode,quantity:7,areaQuantity:1,legacyQuantity:1});
  check("purchase keeps the full surface quote",spatialShop.prices[stockCode],10800);
  const nextCell=applyKqCareProduct(sectorState,stockCode,firstCell),sectorKey=randomUUID();
  const substitute=(next,target)=>{
    const copy=structuredClone(next);
    for(const entry of [copy.care.applications.at(-1),copy.care.interventions.at(-1)]) {
      if(target===undefined) delete entry.target;
      else entry.target=target;
    }
    return copy;
  };
  const beforeCells=await snapshot(sectorOwner);
  for(const target of [undefined,{...firstCell,x:2},{...firstCell,y:3},{...firstCell,y:1.5},{...firstCell,x:-1},
    {...firstCell,zoneId:"another-zone"},{...firstCell,slot:1}]) {
    await reject("missing, malformed or out-of-plan target is rejected",()=>apply(sectorOwner,sectorRun,substitute(nextCell,target),stockCode),"kq_care_invalid_target");
  }
  const changedIntervention=structuredClone(nextCell);
  changedIntervention.care.interventions[0].target=secondCell;
  await reject("application and pending intervention must describe the same cell",()=>apply(sectorOwner,sectorRun,changedIntervention,stockCode),"kq_care_invalid_request");
  check("target validation is atomic",await snapshot(sectorOwner),beforeCells);
  const firstCellReceipt=await apply(sectorOwner,sectorRun,nextCell,stockCode,sectorKey);
  check("partial stock is debited before the legacy charge",row(firstCellReceipt),{productCode:stockCode,quantity:6,areaQuantity:0,legacyQuantity:1});
  check("first cell receipt records one square metre", (await query("SELECT target,area_m2,pricing_units,charged_cents FROM kq_care_interventions WHERE user_id=$1 AND request_key=$2",[sectorOwner,sectorKey])).rows[0],{target:firstCell,area_m2:1,pricing_units:1,charged_cents:0});
  check("repeat cell after commit returns the original receipt", (await apply(sectorOwner,sectorRun,nextCell,stockCode,sectorKey)).replayed,true);
  const cellReceipt=target=>scalar("SELECT rpc_kq_care_intervention_receipt($1,$2,$3,$4,$5)",[sectorOwner,sectorRun.id,sectorKey,stockCode,JSON.stringify(target)]);
  await reject("different cell cannot reuse a committed key",()=>apply(sectorOwner,sectorRun,substitute(nextCell,secondCell),stockCode,sectorKey),"kq_care_request_mismatch");
  await reject("receipt preflight detects a changed cell",()=>cellReceipt(secondCell),"kq_care_request_mismatch");
  await reject("old client cannot replay a targeted key without its target",()=>scalar("SELECT rpc_kq_care_intervention_receipt($1,$2,$3,$4)",[sectorOwner,sectorRun.id,sectorKey,stockCode]),"kq_care_request_mismatch");
  check("receipt lookup on the same cell returns current scoped reserve",row(await cellReceipt(firstCell)),row(firstCellReceipt));
  let nextRun=await runRow(sectorRun.id);
  const nextOther=applyKqCareProduct(nextRun.state,stockCode,secondCell);
  await reject("new key cannot repeat the same sector on the same stage",()=>apply(sectorOwner,nextRun,substitute(nextOther,firstCell),stockCode),"kq_care_invalid_request");
  const secondResult=await apply(sectorOwner,nextRun,nextOther,stockCode);
  check("same product on another cell opens a full passage and carries the remainder",row(secondResult),{productCode:stockCode,quantity:5,areaQuantity:5,legacyQuantity:0});
  check("only two committed cells spend player work",Number(await scalar("SELECT hours FROM fixture_work WHERE user_id=$1",[sectorOwner])),1);
  nextRun=await runRow(sectorRun.id);
  const thirdCell={zoneId:zone.id,x:0,y:1},thirdNext=applyKqCareProduct(nextRun.state,stockCode,thirdCell);
  await query("UPDATE fixture_work SET hours=12 WHERE user_id=$1",[sectorOwner]);
  const rollbackBefore=await snapshot(sectorOwner);
  await reject("workday rejection rolls back targeted care",()=>apply(sectorOwner,nextRun,thirdNext,stockCode),"player_work_exhausted");
  check("no stock or receipt is lost on late work rejection",await snapshot(sectorOwner),rollbackBefore);
  check("failed cell leaves save and timestamp intact",await runRow(sectorRun.id),nextRun);
  await query("UPDATE fixture_work SET hours=0 WHERE user_id=$1",[sectorOwner]);
  const sectorBuyKey=randomUUID();
  const spatialBuy=()=>scalar("SELECT rpc_kq_purchase_care_v2($1,$2,1,$3,$4,10800)",[sectorOwner,stockCode,sectorBuyKey,sectorRun.id]);
  check("scoped purchase receipt adds the complete surface as cells",row(await spatialBuy()).quantity,11);
  check("purchase replay also quotes cells",row(await spatialBuy()).quantity,11);
  const leader=await createRun(sectorOwner,sectorState);
  const secondZone={...zone,id:"ouest",x:5,width:3,height:1};
  const outsider={...zone,id:"autre",x:0};
  const campaignState={...sectorState,campaign:{leaderRunId:leader.id,members:[
    {zoneId:zone.id,warehouse},{zoneId:secondZone.id,warehouse:{zoneId:secondZone.id,activeAreaM2:3,zones:[secondZone]}}]},
    warehouse:{activeAreaM2:6,zones:[zone,outsider]}};
  await query("UPDATE kq_runs SET state=$2 WHERE id=$1",[leader.id,JSON.stringify(campaignState)]);
  const leaderRun=await runRow(leader.id),memberCell={zoneId:secondZone.id,x:2,y:0};
  const memberNext=applyKqCareProduct(leaderRun.state,stockCode,memberCell);
  await reject("campaign cannot target a nonmember in the source plan",()=>apply(sectorOwner,leaderRun,substitute(memberNext,{...memberCell,zoneId:outsider.id}),stockCode),"kq_care_invalid_target");
  const followerRun=await createRun(sectorOwner,leaderRun.state);
  await reject("follower cannot apply to the shared campaign",()=>apply(sectorOwner,followerRun,memberNext,stockCode),"kq_campaign_action_required");
  check("leader can protect a cell of the other participant",row(await apply(sectorOwner,leaderRun,memberNext,stockCode)).areaQuantity,10);
  const plain=await createRun(sectorOwner,{...surfaceState,warehouse:{zones:[],activeAreaM2:4}});
  check("historical PBI reserve is quoted in complete passages",row(await scopedShop(plain)).quantity,2);
  const oldNext=applyKqCareProduct(plain.state,stockCode);
  await reject("an unplanned run cannot invent a sector",()=>apply(sectorOwner,plain,substitute(oldNext,firstCell),stockCode),"kq_care_invalid_target");
  check("PBI on unplanned run still costs a complete passage",row(await apply(sectorOwner,plain,oldNext,stockCode)).areaQuantity,6);
  check("old untargeted receipt still replays",(await scalar("SELECT rpc_kq_care_intervention_receipt($1,$2,$3,NULL)",[surfaceOwner,surfaceRun.id,basicKey])).chargedCents,12500);
  const capped=structuredClone(sectorState);
  for(const [x,y] of [[0,0],[1,0],[0,1],[1,1]]){
    capped.care=applyKqCareProduct(capped,stockCode,{zoneId:zone.id,x,y}).care;
  }
  const forgeAppend=state=>({...state,care:{...state.care,
    applications:[...state.care.applications,nextCell.care.applications.at(-1)],
    interventions:[...state.care.interventions,nextCell.care.interventions.at(-1)]}});
  const fourActive=await createRun(sectorOwner,capped);
  await reject("SQL rejects a fifth simultaneous targeted intervention",()=>apply(sectorOwner,fourActive,forgeAppend(capped),stockCode),"kq_care_invalid_request");
  const twelve=structuredClone(capped);
  twelve.care.interventions=[];
  twelve.care.applications=[0,1,2].flatMap(stageIndex=>capped.care.applications.map(a=>({...a,stageIndex})));
  const twelveApplied=await createRun(sectorOwner,twelve);
  await reject("SQL rejects a thirteenth application across distinct cells",()=>apply(sectorOwner,twelveApplied,forgeAppend(twelve),stockCode),"kq_care_invalid_request");
  const noCellStock=await createRun(stranger,sectorState);
  const emptyBefore=await snapshot(stranger);
  await reject("zero reserve refuses targeted PBI",()=>apply(stranger,noCellStock,nextCell,stockCode),"kq_care_stock_unavailable");
  check("out-of-stock sector leaves receipts and wallet untouched",await snapshot(stranger),emptyBefore);
  check("out-of-stock sector leaves run timestamp and save untouched",await runRow(noCellStock.id),noCellStock);
  for(const role of ["anon","authenticated","service_role"]){
    check(`${role} sector receipt execute privilege`,await scalar("SELECT has_function_privilege($1,'rpc_kq_care_intervention_receipt(uuid,uuid,uuid,text,jsonb)','EXECUTE')",[role]),role==="service_role");
    check(`${role} cannot bypass the workday wrapper`,await scalar("SELECT has_function_privilege($1,'kq_work_inner_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)','EXECUTE')",[role]),false);
  }
  // Both restore scripts run against a populated database. Only the fixture
  // marks runs terminal to simulate the end of play before switching versions.
  const persisted=async ()=>Object.fromEntries(await Promise.all([
    "kq_runs","kq_care_inventory","kq_care_purchases","kq_care_interventions",
    "kq_equipment_wallets","kq_treasury_journal","kq_treasury_balances","fixture_work",
  ].map(async table=>[table,await scalar(`SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)) FROM ${table} r`)])));
  await reject("rollback waits for spatial culture and campaign saves",()=>db.exec(restorePassages),"kq_care_active_spatial_runs");
  await db.exec("ROLLBACK");
  check("refused rollback leaves the scoped receipt callable",row(await cellReceipt(firstCell)).quantity,6);
  const plantsOnly=structuredClone(sectorState);
  plantsOnly.care.problems[0].plants=[{...firstCell,slot:0,severity:2}];
  const plantRun=await createRun(sectorOwner,plantsOnly);
  await query("UPDATE kq_runs SET status='abandoned' WHERE state @? '$.care.applications[*].target' AND status='active'");
  await reject("an untreated active plant outbreak also blocks rollback",()=>db.exec(restorePassages),"kq_care_active_spatial_runs");
  await db.exec("ROLLBACK");
  await query("UPDATE kq_runs SET status='abandoned' WHERE id=$1",[plantRun.id]);
  const beforeRestore=await persisted();
  await db.exec(restorePassages);
  check("function rollback preserves all saves, receipts, money, work and stock",await persisted(),beforeRestore);
  const restoredShop=await scopedShop(sectorRun);
  check("old scoped quote advertises complete passages after rollback",row(restoredShop),{productCode:stockCode,quantity:1,areaQuantity:6,legacyQuantity:0});
  await reject("old API cannot reuse a targeted historical receipt",()=>scalar("SELECT rpc_kq_care_intervention_receipt($1,$2,$3,$4)",[sectorOwner,sectorRun.id,sectorKey,stockCode]),"kq_care_request_mismatch");
  const oldMode=await createRun(sectorOwner,sectorState);
  const nextFull=structuredClone(nextCell);
  for(const entry of [nextFull.care.applications.at(-1),nextFull.care.interventions.at(-1)]) delete entry.target;
  const fullKey=randomUUID();
  const fullResult=await apply(sectorOwner,oldMode,nextFull,stockCode,fullKey);
  check("legacy engine consumes one full passage after rollback",row(fullResult).areaQuantity,0);
  const afterLegacy=await persisted();
  await db.exec(restoreSectors);
  check("forward restoration retains records made by both versions",await persisted(),afterLegacy);
  check("sector receipt replays after restoring the new functions",(await cellReceipt(firstCell)).replayed,true);
  check("restored functions replay full applications made during rollback",
    (await scalar("SELECT rpc_kq_care_intervention_receipt($1,$2,$3,$4)",[sectorOwner,oldMode.id,fullKey,stockCode])).replayed,true);
  check("restored scoped purchase can replenish individual square metres",row(await scalar(
    "SELECT rpc_kq_purchase_care_v2($1,$2,1,$3,$4,10800)",[sectorOwner,stockCode,randomUUID(),oldMode.id])).quantity,6);
  const resumedRun=await createRun(sectorOwner,sectorState);
  check("sector play resumes with the exact remaining stock",row(await apply(sectorOwner,resumedRun,nextCell,stockCode)).quantity,5);

  await db.exec(await migration("20261118000400_kq_care_input_sectors.sql"));
  const restoreInputs=await captureCare();
  const inputOwner=await player();
  const inputCodes=KQ_CARE_PRODUCTS.filter(product=>product.kind==="input" && originalPrices[product.code]!=null).map(product=>product.code);
  const reserve=(result,code)=>result.inventory.find(item=>item.productCode===code);
  const inputShop=run=>scalar("SELECT rpc_kq_care_shop_v2($1,$2)",[inputOwner,run.id]);
  for(const code of inputCodes) {
    const run=await createRun(inputOwner,sectorState);
    const quote=await inputShop(run);
    const lotKey=randomUUID(),applicationKey=randomUUID();
    const buyLot=()=>scalar("SELECT rpc_kq_purchase_care_v2($1,$2,1,$3,$4,$5)",
      [inputOwner,code,lotKey,run.id,quote.prices[code]]);
    const purchasedLot=await buyLot();
    check(`${code} buys the quoted six square metres`,
      [purchasedLot.cashCents,purchasedLot.totalPriceCents,reserve(purchasedLot,code).quantity],
      [quote.cashCents-quote.prices[code],originalPrices[code]*6,6]);
    check(`${code} purchase replay preserves cash and stock`,await buyLot(),{...purchasedLot,replayed:true});
    const next=applyKqCareProduct(run.state,code,firstCell);
    const beforeInput=await snapshot(inputOwner);
    for(const invalid of [undefined,{...firstCell,x:2}]) {
      await reject(`${code} requires a cultivated cell`,()=>apply(inputOwner,run,substitute(next,invalid),code),"kq_care_invalid_target");
    }
    check(`${code} invalid target preserves balance, reserve and receipts`,await snapshot(inputOwner),beforeInput);
    const treated=await apply(inputOwner,run,next,code,applicationKey);
    check(`${code} commits the cell and spends exactly one square metre`,
      [treated.state.care.applications.at(-1).target,reserve(treated,code).quantity,treated.chargedCents,treated.cashCents],
      [firstCell,5,0,purchasedLot.cashCents]);
    check(`${code} receipt records one m²`,(await query("SELECT target,area_m2,pricing_units FROM kq_care_interventions WHERE user_id=$1 AND request_key=$2",[inputOwner,applicationKey])).rows[0],
      {target:firstCell,area_m2:1,pricing_units:1});
    check(`${code} replay is bound to its cell`,(await apply(inputOwner,run,next,code,applicationKey)).replayed,true);
    await reject(`${code} cannot replay on another cell`,()=>apply(inputOwner,run,substitute(next,secondCell),code,applicationKey),"kq_care_request_mismatch");
  }
  const vermi="CARE-VERMICOMPOST";
  await query("UPDATE kq_care_inventory SET quantity=1,area_quantity=0 WHERE user_id=$1 AND product_code=$2",[inputOwner,vermi]);
  let distributed=await createRun(inputOwner,sectorState);
  const sixCells=[0,1,2,3,4,5].map(i=>({zoneId:zone.id,x:i%2,y:Math.floor(i/2)}));
  check("one historical input charge covers six individually applicable square metres",reserve(await inputShop(distributed),vermi).quantity,6);
  for(const [index,target] of sixCells.entries()) {
    const next=applyKqCareProduct(distributed.state,vermi,target);
    const treated=await apply(inputOwner,distributed,next,vermi);
    check(`one lombricompost apport covers cell ${index+1} and keeps the exact remainder`,reserve(treated,vermi),
      {productCode:vermi,areaQuantity:5-index,legacyQuantity:0,quantity:5-index});
    distributed=await runRow(distributed.id);
  }
  const forceInput=(state,productCode,target)=>{
    const app={productCode,stageIndex:state.stageIndex,...(target?{target}:{})};
    return {...state,care:{...state.care,applications:[...state.care.applications,app],
      interventions:[...state.care.interventions,{...app,status:"installing",remainingSteps:productCode===vermi?2:1}]}};
  };
  const badInput=async (name,run,code,target)=>reject(name,()=>apply(inputOwner,run,forceInput(run.state,code,target),code),"kq_care_invalid_request");
  await badInput("a treated square metre cannot be billed again",distributed,vermi,sixCells[0]);
  await badInput("a second input at the same stage is refused even on a different cell",distributed,"CARE-SEAWEED",secondCell);
  const later=await createRun(inputOwner,{...distributed.state,stageIndex:1,care:{...distributed.state.care,interventions:[]}});
  await badInput("same input cannot start another apport at a different stage",later,vermi,firstCell);
  await apply(inputOwner,later,applyKqCareProduct(later.state,"CARE-SEAWEED",secondCell),"CARE-SEAWEED");
  const secondStage=(await runRow(later.id)).state;
  const thirdStage=await createRun(inputOwner,{...secondStage,stageIndex:2,care:{...secondStage.care,interventions:[]}});
  await badInput("two distinct apports per culture remain the limit",thirdStage,"CARE-COMPOST-TEA",firstCell);
  const saltState={...sectorState,care:{...sectorState.care,problems:[{...sectorState.care.problems[0],code:"SALTS"}]}};
  const salty=await createRun(inputOwner,saltState);
  await badInput("organic feed still rejects saline stress",salty,"CARE-ORGANIC-FEED",firstCell);
  const datedRun=await createRun(inputOwner,{...sectorState,warehouse:{zones:[],activeAreaM2:4}});
  const datedCode="CARE-COMPOST-TEA";
  const dated=await apply(inputOwner,datedRun,applyKqCareProduct(datedRun.state,datedCode),datedCode);
  check("an old planless tent uses a full four-m² input passage",reserve(dated,datedCode),
    {productCode:datedCode,quantity:0,legacyQuantity:0,areaQuantity:1});
  const basicRun=await createRun(inputOwner,sectorState);
  const basicQuote=await inputShop(basicRun);
  const generalCare=await apply(inputOwner,basicRun,performKqBasicCare(basicRun.state),null,randomUUID(),basicRun.updated_at,basicQuote.basicCarePriceCents);
  check("paid care still covers the entire spatial tent at its exact quote",generalCare.chargedCents,6*KQ_BASIC_CARE_PRICE_CENTS);

  // The intermediate engine understands PBI sectors but reads inputs globally.
  await reject("a PBI-only rollback waits for targeted input applications",()=>db.exec(restoreSectors),"kq_care_active_input_sectors");
  await db.exec("ROLLBACK");
  await query("UPDATE kq_runs SET status='abandoned' WHERE user_id=$1 AND status='active'",[inputOwner]);
  const roots=structuredClone(sectorState);
  roots.care.problems=[{...roots.care.problems[0],code:"ROOTS",plants:[{...firstCell,slot:0,severity:2}]}];
  const rootsRun=await createRun(inputOwner,roots);
  await reject("spatial non-pest observations also prevent incompatible rollback",()=>db.exec(restoreSectors),"kq_care_active_input_sectors");
  await db.exec("ROLLBACK");
  await query("UPDATE kq_runs SET status='abandoned' WHERE id=$1",[rootsRun.id]);
  const beforeInputRestore=await persisted();
  await db.exec(restoreSectors);
  check("PBI-only restore quotes complete input passages",reserve(await inputShop(rootsRun),"CARE-SEAWEED").quantity,0);
  await db.exec(restoreInputs);
  check("restored input version quotes the exact sector stock",reserve(await inputShop(rootsRun),"CARE-SEAWEED").quantity,4);
  check("input version round trip preserves money, hours, stock and all receipts",await persisted(),beforeInputRestore);
  await installWarehousePreparations(db, { retail: false });
  await db.exec("ALTER FUNCTION kq_treasury_initialize(uuid) SET search_path=pg_catalog,public; ALTER FUNCTION fixture_wallet_movement() SET search_path=pg_catalog,public");
  await db.exec(await migration("20261121001300_kq_warehouse_care_provisions.sql"));
  await db.exec(await migration("20261122000200_kq_warehouse_retail_supplies.sql"));
  await db.exec(await migration("20261122000310_kq_warehouse_airlock_preparation.sql"));
  const references=JSON.parse(await readFile("src/lib/kanab-quest-warehouse-retail-supplies.json","utf8"));
  for (const [code,reference] of Object.entries(references)) {
    if (code.startsWith("CARE-") && originalPrices[code]==null) continue;
    check(`public retail unit price ${code}`, await scalar("SELECT kq_warehouse_retail_supply_price($1)",[code]), reference.unitPriceCents);
  }
  for (const product of KQ_CARE_PRODUCTS.filter(p=>originalPrices[p.code]!=null)) check(`authoritative care price ${product.code}`,
    await scalar("SELECT kq_care_price($1)", [product.code]), product.priceCents);
  const betaOwner=await player();
  await query("INSERT INTO kq_warehouse_layouts VALUES($1,$2)",[betaOwner,{zones:[zone]}]);
  const buyDose=(key=randomUUID(), offered=references[vermi].unitPriceCents)=>scalar(
    "SELECT rpc_kq_purchase_care_v2($1,$2,1,$3,NULL,$4)",[betaOwner,vermi,key,offered]);
  await reject("stale standalone soil dose price fails before debit",()=>buyDose(randomUUID(),1400),"kq_care_price_changed");
  const retailKey=randomUUID();
  const firstRetail=await buyDose(retailKey);
  check("retail receipt remains authoritative on retry",await buyDose(retailKey,1400),{...firstRetail,replayed:true});
  const betaRun=await createRun(betaOwner,{...sectorState,warehouse:{...warehouse,preparationVersion:1}});
  await query("UPDATE kq_runs SET warehouse_zone_id=$2 WHERE id=$1",[betaRun.id,zone.id]);
  await scalar("SELECT kq_warehouse_launch_preparations($1,$2,ARRAY[$2]::uuid[],$3)",[betaOwner,betaRun.id,{[zone.id]:{[vermi]:1}}]);
  await buyDose();
  let live=await runRow(betaRun.id);
  check("later purchases cannot enlarge this crop's reserve",reserve(await scalar("SELECT rpc_kq_care_shop_v2($1,$2)",[betaOwner,live.id]),vermi).quantity,1);
  const assigned=applyKqCareProduct(live.state,vermi,firstCell);
  const betaKey=randomUUID();
  const appliedDose=await apply(betaOwner,live,assigned,vermi,betaKey);
  check("a targeted soil treatment consumes the allocated square metre", reserve(appliedDose,vermi).quantity,0);
  check("retrying a locked crop treatment consumes no extra dose",(await apply(betaOwner,live,assigned,vermi,betaKey)).replayed,true);
  live=await runRow(live.id);
  await reject("the additional unit cannot be used on a second square of the existing crop",
    ()=>apply(betaOwner,live,applyKqCareProduct(live.state,vermi,secondCell),vermi),"kq_preparation_reserved");
  check("later stock stays available in the warehouse",reserve(await scalar("SELECT rpc_kq_care_shop_v2($1,NULL)",[betaOwner]),vermi).quantity,1);
  const withPump={zones:[zone],stationPlacements:[{id:"pump",code:"SIM-WATER-03",x:0,y:1}]};
  await query("update kq_warehouse_layouts set state=$2 where user_id=$1",[betaOwner,withPump]);
  const pumpCommand=(action,key=randomUUID())=>scalar("select rpc_kq_warehouse_preparation_command($1,$2,$3)",[betaOwner,key,{...action,requestKey:key}]);
  await reject("mixing supplement needs an installed injector",()=>pumpCommand({action:"program",stationId:"pump",zoneId:zone.id,quantities:{"WAREHOUSE-NUTRITION-BASE":1,"WAREHOUSE-NUTRITION-SUPPLEMENT":1}}),"kq_preparation_injector_required");
  const stale={action:"purchase",code:"WAREHOUSE-VACUUM",quantity:1,expectedCents:400};
  await reject("warehouse rejects stale retail price",()=>pumpCommand(stale),"kq_preparation_price_changed");
  await reject("warehouse requires the quoted price on a new purchase",()=>pumpCommand({action:"purchase",code:stale.code,quantity:1}),"kq_preparation_price_changed");
  const vacuum=await pumpCommand({...stale,expectedCents:references[stale.code].unitPriceCents});
  check("register shows the purchased public-price vacuum",vacuum.items.find(item=>item.code===stale.code).availableQuantity,1);
  const attach={action:"injector",stationId:"pump",expectedCents:references["WAREHOUSE-INJECTOR"].unitPriceCents}, attachKey=randomUUID();
  const installedInjector=await pumpCommand(attach,attachKey);
  const retried=await pumpCommand(attach,attachKey);
  check("an injector is billed once per request",[retried.cashCents,retried.injectors],[installedInjector.cashCents,installedInjector.injectors]);
  await query("update kq_warehouse_layouts set state=$2 where user_id=$1",[betaOwner,{...withPump,stationPlacements:[]}]);
  await query("update kq_warehouse_layouts set state=$2 where user_id=$1",[betaOwner,withPump]);
  const reused=await pumpCommand({...attach,expectedCents:0});
  check("removing and refitting a station reuses its paid injector",[reused.cashCents,reused.injectors],[installedInjector.cashCents,installedInjector.injectors]);
  {
    const openingOwner=await player();
    await query("INSERT INTO kq_warehouse_layouts VALUES($1,$2)",[openingOwner,{zones:[zone]}]);
    const priorRun=await createRun(openingOwner,{...sectorState,warehouse:{...warehouse,preparationVersion:1}});
    await query("UPDATE kq_runs SET warehouse_zone_id=$2 WHERE id=$1",[priorRun.id,zone.id]);
    const oldRequest=randomUUID();
    const oldReceipt=await scalar("SELECT rpc_kq_purchase_care_v2($1,$2,3,$3,NULL,$4)",[openingOwner,vermi,oldRequest,3*references[vermi].unitPriceCents]);
    await scalar("SELECT kq_warehouse_launch_preparations($1,$2,ARRAY[$2]::uuid[],$3)",[openingOwner,priorRun.id,{[zone.id]:{[vermi]:1}}]);
    const irrigator=await player(), baseCode="WAREHOUSE-NUTRITION-BASE";
    await query("INSERT INTO kq_warehouse_layouts VALUES($1,$2)",[irrigator,withPump]);
    const priorCommand=input=>scalar("SELECT rpc_kq_warehouse_preparation_command($1,$2,$3)",[irrigator,randomUUID(),input]);
    await priorCommand({action:"purchase",code:baseCode,quantity:4,expectedCents:60});
    await priorCommand({action:"program",zoneId:zone.id,stationId:"pump",quantities:{[baseCode]:3}});
    await db.exec(await migration("20261122000500_kq_warehouse_supply_packs.sql"));
    await db.exec(await migration("20261122000510_kq_supply_clock_after_lock.sql"));
    const prep=owner=>scalar("SELECT rpc_kq_warehouse_preparations($1)",[owner]);
    const stockItem=(snapshot,code)=>snapshot.items.find(i=>i.code===code);
    const supplies=(owner,action,key=randomUUID())=>scalar("SELECT rpc_kq_warehouse_preparation_command($1,$2,$3)",[owner,key,{...action,requestKey:key}]);
    const pack=(owner,code,expectedCents,quantity=1,key=randomUUID())=>supplies(owner,{action:"purchasePack",code,expectedCents,quantity},key);
    const health=(owner,id)=>scalar("SELECT rpc_kq_care_shop_v2($1,$2)",[owner,id]);
    const seed=async(owner,zoneId,state=sectorState)=>{
      const run=await createRun(owner,{...state,warehouse:{...warehouse,zoneId,zones:[{...zone,id:zoneId}],preparationVersion:1}});
      await query("UPDATE kq_runs SET warehouse_zone_id=$2 WHERE id=$1",[run.id,zoneId]);
      await scalar("SELECT kq_warehouse_launch_preparations($1,$2,ARRAY[$2]::uuid[],NULL)",[owner,run.id]);
      return runRow(run.id);
    };
    const opening=await prep(openingOwner);
    check("historical loose stock survives without reallocating a seeded zone",
      [stockItem(opening,vermi).availableQuantity,stockItem(opening,vermi).reservedQuantity,opening.runs[0].available[vermi]],[2,1,1]);
    check("historical unit receipt retains its original amount after pack migration",
      (await scalar("SELECT rpc_kq_purchase_care_v2($1,$2,3,$3,NULL,0)",[openingOwner,vermi,oldRequest])).totalPriceCents,oldReceipt.totalPriceCents);
    const priorSaved=await runRow(priorRun.id);
    const oldApplied=await apply(openingOwner,priorSaved,applyKqCareProduct(priorSaved.state,vermi,firstCell),vermi);
    check("old dedicated dose is spent first and other loose charges remain untouched",[reserve(oldApplied,vermi).quantity,stockItem(await prep(openingOwner),vermi).availableQuantity],[0,2]);
    const freshOwner=await player(), newZone="sibling";
    await query("INSERT INTO kq_warehouse_layouts VALUES($1,$2)",[freshOwner,{zones:[zone,{...zone,id:newZone}]}]);
    const beforePacks=await prep(freshOwner);
    check("all 18 public pack offers are supplied by the server",beforePacks.items.filter(i=>i.chargesPerPack>0&&i.packPriceCents>0).length,18);
    const offers=Object.fromEntries(beforePacks.items.filter(i=>i.chargesPerPack).map(i=>[i.code,i]));
    for(const [code,offer] of Object.entries(offers)) {
      const source=references[code];
      if(source?.chargesPerPack) check(`${code} matches the published pack and game charge count`,
        [offer.packPriceCents,offer.chargesPerPack],[source.packPriceCents,source.chargesPerPack]);
    }
    const bio="WAREHOUSE-PBI", packsKey=randomUUID(), startCash=beforePacks.cashCents;
    await reject("the loose-dose endpoint cannot create a new receipt",()=>supplies(freshOwner,{action:"purchase",code:vermi,quantity:1,expectedCents:55}),"kq_preparation_pack_required");
    await reject("stale eight-cent aggregate price cannot buy ten sticky cards",()=>pack(freshOwner,bio,1190),"kq_preparation_price_changed");
    for(const invalid of [0,-1,1.5,101]) await reject("whole packs only "+invalid,()=>pack(freshOwner,bio,1188,invalid),"kq_preparation_invalid");
    const buying=()=>pack(freshOwner,bio,1188,1,packsKey);
    const bought=await Promise.all([buying(),buying()]);
    check("simultaneous receipt retries charge once and issue exactly ten unique charges",
     bought.map(x=>[x.cashCents,stockItem(x,bio).availableQuantity]),[[startCash-1188,10],[startCash-1188,10]]);
    await reject("changing the pack amount on retry is a mismatch",()=>pack(freshOwner,bio,2376,2,packsKey),"kq_preparation_request_mismatch");
    await reject("insufficient funds cannot credit even part of a pack",()=>pack(freshOwner,"CARE-SWIRSKII",633000,100),"kq_preparation_cash");
    const a=await seed(freshOwner,zone.id), b=await seed(freshOwner,newZone);
    const consumeSupplies=(run,qty,key=randomUUID())=>supplies(freshOwner,{action:"use",runId:run.id,quantities:{[bio]:qty}},key);
    const seeded=await prep(freshOwner);
    check("seeding two independent zones does not reserve the shared supplies",
      [stockItem(seeded,bio).availableQuantity,stockItem(seeded,bio).reservedQuantity,seeded.runs.map(r=>r.available[bio])],[10,0,[6,6]]);
    const useKey=randomUUID(); await consumeSupplies(a,6,useKey); await consumeSupplies(a,6,useKey);
    await pack(freshOwner,bio,1188);
    const toppedUp=await prep(freshOwner);
    check("later purchase cannot restore six spent serials to a second older crop",
     [stockItem(toppedUp,bio).availableQuantity,toppedUp.runs.find(r=>r.runId===b.id).available[bio]],[14,4]);
    await reject("older crop cannot draw five charges from remaining four",()=>consumeSupplies(b,5),"kq_preparation_reserved");
    await reject("single zone cannot cover its six square metres twice",()=>consumeSupplies(a,1),"kq_preparation_coverage");
    await reject("another owner cannot spend a run's balance",()=>supplies(openingOwner,{action:"use",runId:b.id,quantities:{[bio]:1}}),"kq_preparation_run");
    await consumeSupplies(b,4);
    await pack(freshOwner,vermi,2200);
    const beforeLate=await health(freshOwner,b.id);
    check("buying a new soil product cannot activate an earlier zone",reserve(beforeLate,vermi).zoneQuantities[newZone],0);
    const c=await seed(freshOwner,"third");
    const careTarget={zoneId:"third",x:0,y:0}, careKey=randomUUID();
    const newCare=applyKqCareProduct(c.state,vermi,careTarget);
    const [firstCare,replayCare]=await Promise.all([apply(freshOwner,c,newCare,vermi,careKey),apply(freshOwner,c,newCare,vermi,careKey)]);
    check("a post-purchase seed can target one cell and retry without a new debit",
     [reserve(firstCare,vermi).quantity,reserve(replayCare,vermi).zoneQuantities.third,replayCare.replayed],[39,39,true]);
    const publicShop=await health(freshOwner,null);
    check("health catalog quotes packs independently of the crop area",[publicShop.prices["CARE-IRON"],publicShop.prices[vermi],beforeLate.prices[vermi]],[1390,2200,2200]);
    const purchaseLog=await scalar("SELECT rpc_kq_care_purchase_register($1)",[freshOwner]);
    check("one warehouse pack appears once in the historical care register",[purchaseLog.totalCount,purchaseLog.totalPaidCents,purchaseLog.items[0].quantity],[1,2200,1]);
    const manualRun=await createRun(freshOwner,{...sectorState,warehouse:{...warehouse,preparationVersion:1}});
    await query("UPDATE kq_runs SET warehouse_zone_id=$2 WHERE id=$1",[manualRun.id,zone.id]);
    await reject("new manual reservations are rejected at seed",()=>scalar("SELECT kq_warehouse_launch_preparations($1,$2,ARRAY[$2]::uuid[],$3)",[freshOwner,manualRun.id,{[zone.id]:{[bio]:1}}]),"kq_preparation_manual_allocation");
    const irrigationBefore=await prep(irrigator);
    check("migration preserves real serials for a pre-existing irrigation mix",
      [stockItem(irrigationBefore,baseCode).availableQuantity,stockItem(irrigationBefore,baseCode).reservedQuantity],[1,3]);
    const detached=await seed(irrigator,"detached");
    check("a different zone only sees the free part of the supply", (await prep(irrigator)).runs.find(r=>r.runId===detached.id).available[baseCode],1);
    const irrigated=await seed(irrigator,zone.id);
    check("program consumes its own three units on launch, preserving the fourth unit",
      [irrigated.state.warehousePreparations[zone.id].used[baseCode],stockItem(await prep(irrigator),baseCode).availableQuantity],[3,1]);
    await pack(irrigator,baseCode,1490);
    const oneOldUnit=await supplies(irrigator,{action:"use",runId:detached.id,quantities:{[baseCode]:1}});
    check("the new pack never replaces an old unit after the irrigation mix is spent",
      [stockItem(oneOldUnit,baseCode).availableQuantity,oneOldUnit.runs.find(r=>r.runId===irrigated.id).available[baseCode]],[100,0]);
    const protectedOwner=await player();
    await query("INSERT INTO kq_warehouse_layouts VALUES($1,$2)",[protectedOwner,withPump]);
    await pack(protectedOwner,baseCode,1490);
    const launchBeforeHold=await seed(protectedOwner,"before-mix");
    await supplies(protectedOwner,{action:"program",zoneId:zone.id,stationId:"pump",quantities:{[baseCode]:3}});
    check("new automatic irrigation holds choose three unique serials",await scalar("SELECT held_units->>$2 FROM kq_warehouse_irrigation_programs WHERE user_id=$1",[protectedOwner,baseCode]),"{[0,3)}");
    // A transaction which began before the program existed can resume after
    // another action has obtained and released the shared wallet lock.
    await db.exec("BEGIN");
    try {
      await query("UPDATE kq_warehouse_irrigation_programs SET starts_at=transaction_timestamp()+interval '1 millisecond' WHERE user_id=$1",[protectedOwner]);
      await new Promise(resolve=>setTimeout(resolve,20));
      check("the pre-lock clock sees all 100 charges, the current clock protects the three newer held charges",
        (await query(`SELECT kq_supply_count(a.units)::int AS earlier,kq_supply_count(b.units)::int AS current
          FROM kq_supply_free($1,transaction_timestamp()) a JOIN kq_supply_free($1) b USING(code) WHERE a.code=$2`,
          [protectedOwner,baseCode])).rows[0],{earlier:100,current:97});
    } finally { await db.exec("ROLLBACK"); }
    await supplies(protectedOwner,{action:"program",zoneId:zone.id,stationId:"pump",quantities:{}});
    await supplies(protectedOwner,{action:"use",runId:launchBeforeHold.id,quantities:{[baseCode]:2}});
    check("cancelled mix releases its original eligible units",await scalar("SELECT remaining_units::text FROM kq_warehouse_input_stock WHERE user_id=$1 AND code=$2",[protectedOwner,baseCode]),"{[2,100)}");
    const legacyOwner=await player();
    await query("INSERT INTO kq_warehouse_layouts VALUES($1,$2)",[legacyOwner,{zones:[zone]}]);
    // Simulate player-owned historic full passes and area already paid for.
    await query("INSERT INTO kq_care_inventory(user_id,product_code,quantity,area_quantity) VALUES($1,$2,1,1)",[legacyOwner,vermi]);
    await pack(legacyOwner,vermi,2200);
    const legacyRun=await seed(legacyOwner,zone.id);
    const historicalStock=reserve(await health(legacyOwner,legacyRun.id),vermi);
    check("historic pass retains coverage across the full six square metres",
      [historicalStock.legacyQuantity,historicalStock.areaQuantity,historicalStock.quantity],[1,41,47]);
    let legacyCurrent=legacyRun;
    for (const cell of [firstCell,secondCell]) {
      await apply(legacyOwner,legacyCurrent,applyKqCareProduct(legacyCurrent.state,vermi,cell),vermi);
      legacyCurrent=await runRow(legacyRun.id);
    }
    check("old m² then one historic pass are consumed without losing the remainder or paying again",
      (await query("SELECT quantity,area_quantity FROM kq_care_inventory WHERE user_id=$1 AND product_code=$2",[legacyOwner,vermi])).rows[0],{quantity:0,area_quantity:5});
    check("the modern paid pack stays intact when an old wallet supplied both applications",
      await scalar("SELECT quantity::int FROM kq_warehouse_input_stock WHERE user_id=$1 AND code=$2",[legacyOwner,vermi]),40);
    const campaignOwner=await player(), cid=randomUUID(), lid=randomUUID(), fid=randomUUID();
    await query("INSERT INTO kq_warehouse_layouts VALUES($1,$2)",[campaignOwner,{zones:[zone,secondZone]}]);
    await pack(campaignOwner,vermi,2200);
    await pack(campaignOwner,bio,1188);
    const participants=[{runId:lid,zoneId:zone.id,warehouse:{...warehouse,preparationVersion:1}},
     {runId:fid,zoneId:secondZone.id,warehouse:{zoneId:secondZone.id,activeAreaM2:3,zones:[secondZone],preparationVersion:1}}];
    for(const member of participants) await query("INSERT INTO kq_runs(id,user_id,warehouse_zone_id,campaign_id,state,status) VALUES($1,$2,$3,$4,$5,'active')",
     [member.runId,campaignOwner,member.zoneId,cid,{...sectorState,warehouse:member.warehouse,campaign:{leaderRunId:lid,members:participants}}]);
    await scalar("SELECT kq_warehouse_launch_preparations($1,$2,$3,NULL)",[campaignOwner,lid,[lid,fid]]);
    const aggregate=reserve(await health(campaignOwner,lid),vermi);
    check("campaign total counts shared stock once even when both zones can use it",
     [aggregate.quantity,aggregate.zoneQuantities],[40,{[zone.id]:40,[secondZone.id]:40}]);
    const memberUse=await supplies(campaignOwner,{action:"use",runId:fid,quantities:{[bio]:2}});
    check("the nonleader can spend its provisions and updates the leader's correct zone",
     [memberUse.runs.find(r=>r.runId===fid).consumed[bio],(await runRow(lid)).state.warehousePreparations[secondZone.id].used[bio]],[2,2]);
    const leaderState=await runRow(lid);
    const campaignCare=await apply(campaignOwner,leaderState,applyKqCareProduct(leaderState.state,vermi,memberCell),vermi);
    check("a campaign care application spends the selected member's charge and updates all visible balances",
     [reserve(campaignCare,vermi).quantity,reserve(campaignCare,vermi).zoneQuantities],[39,{[zone.id]:39,[secondZone.id]:39}]);
    for (const [code,problem] of [["CARE-IRON","IRON"],["CARE-PERLITE","ROOTS"],["CARE-SHADE","HEAT"],["CARE-BLUE-TRAPS","THRIPS"]]) {
      const selectedZone=code.toLowerCase(), focus={zoneId:selectedZone,x:0,y:1}, otherCell={...focus,x:1};
      const focused={...sectorState,care:{...sectorState.care,problems:[{...sectorState.care.problems[0],code:problem,plants:[{...focus,severity:2,slot:0}]}]}};
      await pack(freshOwner,code,offers[code].packPriceCents);
      const treatedRun=await seed(freshOwner,selectedZone,focused);
      const next=applyKqCareProduct(treatedRun.state,code,focus);
      await reject(code+" rejects off-focus application before consuming stock",()=>apply(freshOwner,treatedRun,substitute(next,otherCell),code),"kq_care_invalid_request");
      if(code==="CARE-IRON") {
        const salineState={...focused,care:{...focused.care,problems:[...focused.care.problems,{...focused.care.problems[0],code:"SALTS"}]}};
        const saline=await seed(freshOwner,selectedZone,salineState);
        await reject("iron is incompatible with saline stress even at the observed cell",()=>apply(freshOwner,saline,forceInput(saline.state,code,focus),code),"kq_care_invalid_request");
      }
      check(code+" spends just one eligible charge after all game validations",reserve(await apply(freshOwner,treatedRun,next,code),code).quantity,offers[code].chargesPerPack-1);
    }
    await db.exec(await migration("20261122001500_kq_distinct_culture_inputs.sql"));
    const distinctOwner=await player();
    await query("INSERT INTO kq_warehouse_layouts VALUES($1,$2)",[distinctOwner,{zones:[zone]}]);
    const auxiliaries=["CARE-ORIUS","CARE-SWIRSKII"];
    const inputs=["CARE-SHADE","CARE-BLUE-TRAPS","CARE-IRON","CARE-PERLITE"];
    for(const code of [...auxiliaries,...inputs]) await pack(distinctOwner,code,offers[code].packPriceCents);
    let distinctRun=await seed(distinctOwner,zone.id);
    const applyAndReload=async(code,cell)=>{
      const result=await apply(distinctOwner,distinctRun,applyKqCareProduct(distinctRun.state,code,cell),code);
      distinctRun=await runRow(distinctRun.id);
      return result;
    };
    for(const cell of sixCells) await applyAndReload(auxiliaries[0],cell);
    const nextTurn=advanceKqStage(resolveKqStage({...distinctRun.state,phase:"rolled",dice:[2,2,2]}));
    await query("UPDATE kq_runs SET state=$2,updated_at=clock_timestamp() WHERE id=$1",[distinctRun.id,JSON.stringify(nextTurn)]);
    distinctRun=await runRow(distinctRun.id);
    check("prior PBI remains active on the next turn",distinctRun.state.care.interventions.length,sixCells.length);
    const savedBeforeShade=distinctRun, shadeKey=randomUUID();
    const shade=applyKqCareProduct(distinctRun.state,"CARE-SHADE",firstCell);
    const shadeResult=await apply(distinctOwner,distinctRun,shade,"CARE-SHADE",shadeKey);
    check("shade can be placed alongside a prior PBI before heat is observed",
      [reserve(shadeResult,"CARE-SHADE").quantity,shadeResult.state.care.problems.some(p=>p.code==="HEAT")],
      [offers["CARE-SHADE"].chargesPerPack-1,false]);
    distinctRun=await runRow(distinctRun.id);
    for(const code of inputs.slice(1)) await applyAndReload(code,firstCell);
    for(const cell of sixCells) await applyAndReload(auxiliaries[1],cell);
    check("distinct products stack on the same cell, including two auxiliaries with overlapping targets",
      distinctRun.state.care.interventions.filter(i=>i.target.x===firstCell.x && i.target.y===firstCell.y).map(i=>i.productCode),
      [auxiliaries[0],...inputs,auxiliaries[1]]);
    check("all sixteen applications survive the round trip",distinctRun.state.care.applications.length,16);
    const beforeDuplicate=await health(distinctOwner,distinctRun.id);
    await reject("a second shade on the same square is refused",()=>apply(distinctOwner,distinctRun,
      forceInput(distinctRun.state,"CARE-SHADE",firstCell),"CARE-SHADE"),"kq_care_invalid_request");
    const replayedShade=await apply(distinctOwner,savedBeforeShade,shade,"CARE-SHADE",shadeKey);
    check("refused duplicate and delayed replay preserve stock",[
      replayedShade.replayed,(await health(distinctOwner,distinctRun.id)).inventory],[true,beforeDuplicate.inventory]);
    const laterTurn=await createRun(distinctOwner,{...distinctRun.state,stageIndex:2,care:{...distinctRun.state.care,interventions:[]}});
    await reject("the same input cannot start a second pass at a later stage",()=>apply(distinctOwner,laterTurn,
      forceInput(laterTurn.state,"CARE-SHADE",secondCell),"CARE-SHADE"),"kq_care_invalid_request");
    const saline=await createRun(distinctOwner,saltState);
    for(const code of ["CARE-IRON","CARE-ORGANIC-FEED"]) {
      await reject(code+" remains incompatible with saline stress",()=>apply(distinctOwner,saline,
        forceInput(saline.state,code,firstCell),code),"kq_care_invalid_request");
    }
  }
  console.log(JSON.stringify({result:"passed",checks:checks.length,details:checks,engine:"PGlite isolated PostgreSQL",concurrency:"Retry calls submitted together; PGlite serializes on one connection. CAS and row/advisory locks are explicitly verified."},null,2));
} catch(error) {
  console.error(error.message, error.where ?? "", error.detail ?? "");
  if(error.position) console.error("SQL context:",error.query?.slice(Math.max(0,Number(error.position)-220),Number(error.position)+120));
  if(error.name==="AssertionError") console.error(error);
  process.exitCode=1;
} finally { await vite.close(); await db.close(); }
