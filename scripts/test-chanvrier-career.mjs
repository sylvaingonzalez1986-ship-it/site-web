// Isolated PostgreSQL integration checks: no credentials, network or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const careerModule = ts.transpileModule(await readFile("src/lib/chanvrier-career.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const career = await import(`data:text/javascript;base64,${Buffer.from(careerModule).toString("base64")}`);
const migration = name => readFile(`supabase/migrations/${name}`, "utf8");
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const one = async (sql, values = []) => (await rows(sql, values))[0];
const rpc = async (sql, values = []) => (await one(`SELECT ${sql} AS value`, values)).value;
const snapshot = owner => rpc("rpc_kq_chanvrier_career($1)", [owner]);
const cash = owner => rpc("(SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1)", [owner]);
const gear = (owner, code, tent = 1) => one("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND equipment_code=$2 AND tent_number=$3", [owner, code, tent]);
const buy = (owner, codes, tent = 1, key = randomUUID()) => rpc("rpc_kq_purchase_tent_equipment($1,$2,$3,$4)", [owner, key, codes, tent]);
const upgrade = (owner, code, level, key = randomUUID()) => rpc("rpc_kq_upgrade_tent_equipment($1,$2,$3,$4,1)", [owner, key, code, level]);
const equip = (owner, code, tent = 1) => rpc("rpc_kq_equip_tent_equipment($1,$2,$3)", [owner, code, tent]);
const expand = (owner, units, cost, key = randomUUID()) => rpc("rpc_kq_expand_production($1,$2,$3,$4)", [owner, key, units, cost]);
const addCompleted = (owner, count) => db.query(`INSERT INTO kq_runs(user_id,status,state,completed_at)
  SELECT $1,'completed'::kq_run_status,'{}',now() FROM generate_series(1,$2::INTEGER)`, [owner, count]);
const newUser = async () => {
  const owner = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
  await db.query("SELECT kq_business_settle($1)", [owner]);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=100000000 WHERE user_id=$1", [owner]);
  return owner;
};

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TYPE kq_run_status AS ENUM('active','completed','abandoned');
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users(id),
      status kq_run_status NOT NULL DEFAULT 'active',state JSONB NOT NULL,started_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ,updated_at TIMESTAMPTZ DEFAULT now(),integrity_code TEXT);
    CREATE UNIQUE INDEX one_active_run ON kq_runs(user_id) WHERE status='active';
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision BIGINT NOT NULL DEFAULT 0);
    CREATE TABLE kq_commerce_batches(flower_id UUID PRIMARY KEY,user_id UUID,route TEXT,original_units INTEGER,
      processing_cents INTEGER,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);
    -- Calendar/accounting fixtures record external calls. Actual equipment,
    -- ownership, wear, prices, locks, receipts and RPC bodies are loaded below.
    CREATE TABLE test_assets(user_id UUID,source_key TEXT UNIQUE,cost BIGINT,equipment_code TEXT);
    CREATE TABLE kq_treasury_accounts(user_id UUID PRIMARY KEY,started_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE kq_treasury_assets(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,source_key TEXT,
      account TEXT,expense_account TEXT,equipment_code TEXT,cost_cents BIGINT,recognized_cents BIGINT DEFAULT 0,
      starts_at TIMESTAMPTZ,ends_at TIMESTAMPTZ,recognized_at TIMESTAMPTZ,retired_at TIMESTAMPTZ,
      UNIQUE(user_id,source_key),CHECK(recognized_cents BETWEEN 0 AND cost_cents));
    CREATE FUNCTION kq_treasury_add_asset(p_user UUID,p_key TEXT,p_account TEXT,p_expense TEXT,p_cost BIGINT,p_start TIMESTAMPTZ,p_hours INTEGER,p_equipment TEXT DEFAULT NULL,p_opening BOOLEAN DEFAULT false)
      RETURNS BIGINT LANGUAGE plpgsql AS $$ BEGIN
        INSERT INTO test_assets VALUES(p_user,p_key,p_cost,p_equipment);
        INSERT INTO kq_treasury_assets(user_id,source_key,account,expense_account,equipment_code,cost_cents,starts_at,ends_at,recognized_at)
          VALUES(p_user,p_key,p_account,p_expense,p_equipment,p_cost,p_start,p_start+p_hours*interval '1 hour',p_start);
        RETURN p_cost;
      END $$;
    CREATE FUNCTION kq_treasury_refresh(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION kq_treasury_queue(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION kq_treasury_pair(p_user UUID,p_kind TEXT,p_key TEXT,p_at TIMESTAMPTZ,p_debit TEXT,p_credit TEXT,p_amount BIGINT,p_reference TEXT DEFAULT NULL)
      RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN END $$;
  `);
  await db.exec(await migration("20260830000100_kq_durable_equipment_shop.sql"));
  await db.exec(await migration("20260830000200_kq_post_harvest_market.sql"));
  await db.exec("ALTER TABLE kq_market_sale_receipts ADD COLUMN sales_channel TEXT");
  const catalog = await migration("20260901000100_kq_us_processing_and_culture_systems.sql");
  await db.exec(catalog.split("ALTER TABLE public.kq_support_card_rules")[0] + "COMMIT;");
  for (const name of ["20260904000100_kq_equipment_route_goal.sql", "20260906000100_kq_equipment_purchase_guard.sql",
    "20260911000200_kq_equipment_levels.sql", "20260913001100_kq_flower_drying_room.sql", "20260914000200_kq_machine_maintenance.sql",
    "20260919000500_kq_culture_equipment_wear.sql"]) await db.exec(await migration(name));
  const prices = await migration("20260912000300_kq_distinct_talents.sql");
  await db.exec(prices.slice(prices.indexOf("UPDATE public.kq_equipment_catalog"), prices.lastIndexOf("COMMIT;")));
  const electricity = await migration("20260911000300_kq_cycle_electricity.sql");
  await db.exec(electricity.slice(electricity.indexOf("CREATE TABLE public.kq_energy_invoices"), electricity.indexOf("-- The existing sale transaction")));
  await db.exec(await migration("20260913000700_kq_security_equipment_care.sql"));
  const business = await migration("20260921000100_kq_business_calendar.sql");
  await db.exec(business.slice(business.indexOf("CREATE TABLE public.kq_lab_invoices"), business.indexOf("-- Advance in baseline-capacity units")));
  await db.exec(`CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
    PERFORM rpc_kq_ensure_equipment_profile(p_user);
    INSERT INTO kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
  END $$;`);
  const labStart = business.indexOf("CREATE FUNCTION public.kq_invoice_completed_lab()");
  await db.exec(business.slice(labStart, business.indexOf("CREATE FUNCTION public.kq_business_sale_preview", labStart)));
  await db.exec(await migration("20260923001000_kq_production_expansion.sql"));
  await db.exec(`CREATE FUNCTION rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
    LANGUAGE plpgsql AS $$ DECLARE installed TEXT[]; BEGIN
      installed:=(SELECT COALESCE(array_agg(equipment_code ORDER BY equipment_code),ARRAY[]::TEXT[]) FROM public.kq_equipment_loadouts WHERE user_id=p_user_id);
      RETURN to_jsonb(installed);
    END $$;`);
  for (const name of ["20260924000300_kq_individual_tents.sql", "20260927000600_kq_shared_processing_workshop.sql",
    "20260928000100_kq_shared_installation_equipment.sql", "20261001000200_kq_tent_equipment_and_shared_workshop.sql"]) await db.exec(await migration(name));
  // Use the real terminal-state validation before the new XP trigger, including
  // invalid completion/death requests that must never award permanent progress.
  const careSql = await migration("20261010000100_kq_culture_care.sql");
  const careValidStart = careSql.indexOf("CREATE FUNCTION public.kq_care_state_valid(");
  await db.exec(careSql.slice(careValidStart, careSql.indexOf("$$;", careValidStart) + 3));
  const updateStart = careSql.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_update_run_state(");
  const updateGrant = careSql.indexOf("GRANT EXECUTE ON FUNCTION public.rpc_kq_update_run_state", updateStart);
  await db.exec(careSql.slice(updateStart, careSql.indexOf(";", updateGrant) + 1));

  const prepare = async (owner, route, flower = randomUUID()) => {
    const codes = (await rows("SELECT equipment_code FROM kq_equipment_loadouts WHERE user_id=$1", [owner])).map(item => item.equipment_code);
    await db.query("INSERT INTO kq_flowers(id,owner_id,status) VALUES($1,$2,'burned')", [flower, owner]);
    await db.query(`INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,equipment_codes)
      VALUES($1,$2,100,9.5,'signature',$3)`, [flower, owner, codes]);
    return flower;
  };
  const batch = async (owner, route, flower) => {
    const id = flower ?? await prepare(owner, route);
    await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,$3,1000,0)", [id, owner, route]);
    return id;
  };
  const sale = (owner, flower, route, channel = null) => db.query(`INSERT INTO kq_market_sale_receipts(request_key,flower_id,owner_id,route,
    jury_score,harvest_grams,payout_cents,reputation_gain,cash_after_cents,reputation_after,sales_channel)
    VALUES($1,$2,$3,$4,9.5,100,10000,0,10000,0,$5)`, [randomUUID(), flower, owner, route, channel]);
  const start = async owner => {
    const count = await rpc("(SELECT production_units FROM kq_equipment_wallets WHERE user_id=$1)", [owner]);
    const installed = await rows(`SELECT l.tent_number,l.equipment_code,e.level,c.category FROM kq_equipment_loadouts l
      JOIN kq_player_equipment e USING(user_id,tent_number,equipment_code) JOIN kq_equipment_catalog c ON c.code=e.equipment_code
      WHERE l.user_id=$1`, [owner]);
    const profile = items => ({ codes: items.map(item => item.equipment_code), levels: Object.fromEntries(items.map(item => [item.equipment_code, item.level])) });
    const tents = Array.from({ length: count }, (_, i) => ({ tentNumber: i + 1, ...profile(installed.filter(item => item.tent_number === i + 1 && item.category !== "processing")) }));
    const state = { equipment: { scope: "tent", productionUnits: count, ...profile(installed), tents, shared: profile(installed.filter(item => item.category === "processing")) },
      harvestGrams: 100 * count, energy: { version: 1, mode: "balanced", totalCents: 0, totalWattHours: 0 } };
    return (await one("INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id", [owner, state])).id;
  };
  const finish = id => db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1", [id]);

  // Existing equipment and eight-tent accounts must survive every gate.
  const old = await newUser(), oldPurchaseKey = randomUUID(), oldUpgradeKey = randomUUID(), oldExpansionKey = randomUUID();
  const oldPurchase = await buy(old, ["PRESS-0600", "WASHER-25L", "SIFT-TRAY", "FREEZE-DRYER"], 1, oldPurchaseKey);
  await equip(old, "WASHER-25L"); await equip(old, "PRESS-0600"); await equip(old, "SIFT-TRAY");
  const oldUpgrade = await upgrade(old, "FREEZE-DRYER", 1, oldUpgradeKey);
  for (const count of [1, 2, 3]) await expand(old, count, 30000);
  const oldExpansion = await expand(old, 4, 2120000, oldExpansionKey);
  await addCompleted(old, 2);
  await db.query(`INSERT INTO kq_runs(user_id,status,state) VALUES($1,'abandoned',$2),($1,'abandoned','{}')`,
    [old, { cultureDead: true, phase: "complete", harvestGrams: 0, history: [{}, {}, {}] }]);
  const historicalFlower = await batch(old, "ice-water-hash");
  await sale(old, historicalFlower, "ice-water-hash");
  const before = { cash: await cash(old), equipment: await rows("SELECT * FROM kq_player_equipment WHERE user_id=$1 ORDER BY tent_number,equipment_code", [old]) };
  await db.exec(await migration("20261011120000_kq_chanvrier_career.sql"));
  await db.exec(await migration("20261011120100_kq_gradual_production_expansion.sql"));
  for (const code of [...Object.keys(career.CHANVRIER_EQUIPMENT_REQUIRED_LEVELS), "FUTURE-MACHINE", "constructor"]) {
    assert.equal(await rpc("kq_equipment_required_career_level($1,1)", [code]), career.getChanvrierEquipmentRequiredLevel(code), code);
    for (const target of [2, 3, 4, 6, 7, 10, 11]) {
      assert.equal(await rpc("kq_equipment_required_career_level($1,$2)", [code, target]), career.getChanvrierEquipmentUpgradeRequiredLevel(code, target), `${code} -> ${target}`);
    }
  }
  await assert.rejects(() => rpc("kq_assert_equipment_career($1,'FUTURE-MACHINE',1)", [old]), /equipment_career_unavailable/);
  for (const status of ["active", "completed", "abandoned"]) for (const dead of [false, true]) for (const stages of [0, 2, 6, 8]) {
    assert.equal(await rpc("kq_chanvrier_run_xp($1,$2)", [status, { cultureDead: dead, history: Array.from({ length: stages }, () => ({})) }]),
      career.getChanvrierCultureXp({ status, cultureDead: dead, completedStages: stages }));
  }
  assert.equal(await cash(old), before.cash, "Migration never reprices or removes acquisitions");
  assert.deepEqual(await rows("SELECT * FROM kq_player_equipment WHERE user_id=$1 ORDER BY tent_number,equipment_code", [old]), before.equipment);
  assert.deepEqual(await snapshot(old), { xp: 230, level: 2, nextLevel: 3, nextLevelXp: 400, xpToNextLevel: 170,
    progressPercent: 15, completedCultures: 2, processingPractice: { sifting: 0, washing: 1, pressing: 0 } });
  assert.deepEqual(await buy(old, ["PRESS-0600", "WASHER-25L", "SIFT-TRAY", "FREEZE-DRYER"], 1, oldPurchaseKey), { ...oldPurchase, replayed: true });
  assert.deepEqual(await upgrade(old, "FREEZE-DRYER", 1, oldUpgradeKey), { ...oldUpgrade, replayed: true });
  assert.deepEqual(await expand(old, 4, 2120000, oldExpansionKey), { ...oldExpansion, replayed: true });
  await equip(old, "FREEZE-DRYER"); // grandfathered model remains usable below its new gate
  await assert.rejects(() => upgrade(old, "FREEZE-DRYER", 2), /equipment_career_level_required_8/);

  const player = await newUser();
  assert.equal((await snapshot(player)).xp, 0);
  const beforeBlocked = await cash(player);
  await assert.rejects(() => buy(player, ["SECURITY-CAMERA", "LED-300"]), /equipment_career_level_required_2/);
  assert.equal(await cash(player), beforeBlocked, "Mixed basket rolls back its debit and all items");
  assert.equal(await gear(player, "SECURITY-CAMERA"), undefined);
  await assert.rejects(() => expand(player, 1, 30000), /production_career_level_required_3/);
  await buy(player, ["SECURITY-CAMERA"]);
  await upgrade(player, "SECURITY-CAMERA", 1); await upgrade(player, "SECURITY-CAMERA", 2);
  await assert.rejects(() => upgrade(player, "SECURITY-CAMERA", 3), /equipment_career_level_required_5/);
  const active = await start(player);
  assert.equal((await snapshot(player)).xp, 0, "An active culture earns no permanent XP");
  await db.query("UPDATE kq_runs SET status='abandoned' WHERE id=$1", [active]);
  assert.equal((await snapshot(player)).xp, 0, "A voluntary abandon earns no permanent XP");
  const natural = await start(player);
  const naturalRun = await one("SELECT * FROM kq_runs WHERE id=$1", [natural]);
  const died = { ...naturalRun.state, cultureDead: true, phase: "complete", history: [{ total: 0 }, { total: 0 }], harvestGrams: 0, xp: 999999 };
  await assert.rejects(() => rpc("rpc_kq_update_run_state($1,$2,$3,'roll',$4,NULL)", [player, natural, naturalRun.updated_at, died]), /kq_invalid_culture_death/);
  await assert.rejects(() => rpc("rpc_kq_update_run_state($1,$2,$3,'advance',$4,NULL)",
    [player, natural, naturalRun.updated_at, { ...died, cultureDead: false }]), /kq_invalid_flower/);
  assert.equal((await snapshot(player)).xp, 0, "Rejected terminal states never write an XP event");
  await rpc("rpc_kq_update_run_state($1,$2,$3,'resolve',$4,NULL)", [player, natural, naturalRun.updated_at, died]);
  assert.equal((await snapshot(player)).xp, 20);
  await db.query("UPDATE kq_runs SET status=status WHERE id=$1", [natural]);
  assert.equal((await snapshot(player)).xp, 20, "A replay cannot double-credit failure");
  const completed = await start(player);
  await finish(completed); await finish(completed);
  assert.equal((await snapshot(player)).xp, 120, "A harvested culture earns exactly 100 XP once");
  await addCompleted(player, 1);
  assert.equal((await snapshot(player)).level, 2);
  await buy(player, ["LED-300"]);
  await assert.rejects(() => buy(player, ["SIFT-TRAY"]), /equipment_career_level_required_3/);
  await addCompleted(player, 2);
  await buy(player, ["SIFT-TRAY"]); await equip(player, "SIFT-TRAY");
  await expand(player, 1, 30000);
  await assert.rejects(() => expand(player, 2, 30000), /production_career_level_required_5/);

  const advancing = await newUser();
  let priorXp = 0;
  for (const xp of [0, 100, ...career.CHANVRIER_CAREER_LEVEL_XP.slice(1), 5000]) {
    if (xp > priorXp) await addCompleted(advancing, (xp - priorXp) / 100);
    const current = await snapshot(advancing);
    assert.deepEqual(current, career.createChanvrierCareerSnapshot({ xp, completedCultures: xp / 100 }), `SQL/TS progression at ${xp} XP`);
    priorXp = xp;
  }
  const apprentice = await newUser();
  await buy(apprentice, ["SECURITY-CAMERA"]);
  await upgrade(apprentice, "SECURITY-CAMERA", 1); await upgrade(apprentice, "SECURITY-CAMERA", 2);
  await addCompleted(apprentice, 12);
  for (const level of [3, 4, 5]) await upgrade(apprentice, "SECURITY-CAMERA", level);
  await assert.rejects(() => upgrade(apprentice, "SECURITY-CAMERA", 6), /equipment_career_level_required_8/);
  await expand(apprentice, 1, 30000); await expand(apprentice, 2, 30000);
  await assert.rejects(() => expand(apprentice, 3, 30000), /production_career_level_required_7/);
  await addCompleted(apprentice, 12); await expand(apprentice, 3, 30000);
  await assert.rejects(() => expand(apprentice, 4, 2030000), /production_career_level_required_10/);
  await addCompleted(apprentice, 6); await upgrade(apprentice, "SECURITY-CAMERA", 6);

  // A machine ages only when it participates in a completed transformation.
  const wearBeforeCulture = (await gear(old, "WASHER-25L")).wear_cycles;
  const run = await start(old); await finish(run);
  assert.equal((await gear(old, "WASHER-25L")).wear_cycles, wearBeforeCulture);
  const flower = await batch(old, "ice-water-hash");
  assert.equal((await gear(old, "WASHER-25L")).wear_cycles, wearBeforeCulture + 1);
  assert.equal((await gear(old, "FREEZE-DRYER")).wear_cycles, 0, "Unused installed machines do not wear");
  await sale(old, flower, "ice-water-hash", "online");
  assert.equal((await snapshot(old)).processingPractice.washing, 2, "Sale slices never add practice");
  assert.equal((await gear(old, "WASHER-25L")).wear_cycles, wearBeforeCulture + 1);
  const legacyFlower = await prepare(old, "rosin-trial");
  await sale(old, legacyFlower, "rosin-trial");
  assert.equal((await snapshot(old)).processingPractice.pressing, 1);
  assert.equal((await gear(old, "PRESS-0600")).wear_cycles, 1);
  const pollinator = await batch(player, "dry-sift");
  assert.equal((await gear(player, "SIFT-TRAY")).wear_cycles, 1);
  const used = await gear(player, "SIFT-TRAY"), repairKey = randomUUID();
  const repaired = await rpc("rpc_kq_repair_tent_machine($1,'SIFT-TRAY',$2,3300,$3,1)", [player, used.maintenance_version, repairKey]);
  assert.equal(repaired.paidCents, 3300, "Preventive service is possible after one real use");
  assert.equal((await gear(player, "SIFT-TRAY")).wear_cycles, 0);
  assert.deepEqual(await rpc("rpc_kq_repair_tent_machine($1,'SIFT-TRAY',$2,3300,$3,1)", [player, used.maintenance_version, repairKey]), { ...repaired, replayed: true });
  await assert.rejects(() => rpc("rpc_kq_repair_tent_machine($1,'SIFT-TRAY',$2,3300,$3,1)", [player, repaired.version, randomUUID()]), /machine_not_due/);
  assert.equal((await snapshot(player)).processingPractice.sifting, 1, "Repair never resets practice");

  // Advanced purchases require the relevant unique lots, independently of XP,
  // reputation, harvest size, sale counts, and purchased machine levels.
  await addCompleted(player, 41); // 4520 XP, career level 10
  assert.equal((await snapshot(player)).level, 10);
  await buy(player, ["WASHER-25L", "PRESS-0600"]); await equip(player, "WASHER-25L");
  await assert.rejects(() => buy(player, ["AUTO-SIEVE"]), /equipment_career_practice_required/);
  for (let i = 0; i < 3; i++) await batch(player, "ice-water-hash");
  await buy(player, ["AUTO-SIEVE"]);
  await assert.rejects(() => buy(player, ["FREEZE-DRYER"]), /equipment_career_practice_required/);
  for (let i = 0; i < 3; i++) await batch(player, "ice-water-hash");
  await buy(player, ["FREEZE-DRYER"]);
  await assert.rejects(() => buy(player, ["STATIC-PLASMA"]), /equipment_career_practice_required/);
  for (let i = 0; i < 9; i++) await batch(player, "dry-sift");
  await buy(player, ["STATIC-PLASMA"]);
  await batch(player, "dry-sift"); // tenth use since the preventive repair
  await assert.rejects(() => batch(player, "dry-sift"), /commerce_machine_maintenance/);
  assert.equal((await gear(player, "SIFT-TRAY")).wear_cycles, 10);
  assert.equal((await snapshot(player)).processingPractice.sifting, 11);
  await db.query("UPDATE kq_equipment_wallets SET reputation=999999 WHERE user_id=$1", [player]);
  assert.equal((await snapshot(player)).xp, 4520, "Commercial reputation is not career XP");
  await sale(player, pollinator, "raw", "online");
  assert.equal((await snapshot(player)).processingPractice.sifting, 11, "Selling the raw remainder creates no extra practice");

  // Sequential additions keep independent starters and charge the warehouse once.
  const expansionCash = await cash(player), expansionKeys = [];
  for (const count of [2, 3, 4, 5, 6, 7]) {
    const key = randomUUID(), price = count === 4 ? 2030000 : 30000;
    const receipt = await expand(player, count, price, key);
    assert.equal(receipt.productionUnits, count + 1); assert.equal(receipt.addedUnits, 1);
    assert.deepEqual(await expand(player, count, price, key), { ...receipt, replayed: true });
    expansionKeys.push(key);
    assert.equal((await rows("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND tent_number=$2", [player, count + 1])).length, 3);
    assert.equal(await rpc("kq_run_production_units($1)", [{ equipment: { productionUnits: count + 1 } }]), count + 1);
  }
  assert.equal(await cash(player), expansionCash - 2180000);
  assert.equal(await rpc("(SELECT count(*) FROM test_assets WHERE user_id=$1 AND equipment_code='WAREHOUSE-EXTENSION')", [player]), 1);
  await assert.rejects(() => expand(player, 8, 30000), /production_max_units/);
  await assert.rejects(() => expand(player, 7, 30000, expansionKeys[0]), /production_request_mismatch/);
  assert.equal((await snapshot(player)).xp, 4520, "Building and upgrading never buy career XP");

  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["kq_chanvrier_career_events", "kq_chanvrier_processing_practice"]) {
      assert.equal(await rpc("has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE')", [role, table]), false);
    }
    assert.equal(await rpc("has_function_privilege($1,'rpc_kq_chanvrier_career(uuid)','EXECUTE')", [role]), role === "service_role");
    assert.equal(await rpc("has_function_privilege($1,'rpc_kq_update_run_state(uuid,uuid,timestamptz,text,jsonb,jsonb)','EXECUTE')", [role]), role === "service_role");
    assert.equal(await rpc("has_function_privilege($1,'kq_assert_equipment_career(uuid,text,integer)','EXECUTE')", [role]), false);
  }
  await db.exec("SET ROLE service_role");
  assert.equal((await snapshot(player)).xp, 4520, "RPC can read its private journals with service role");
  await assert.rejects(() => rows("SELECT * FROM kq_chanvrier_career_events"), /permission denied/);
  await db.exec("RESET ROLE");
  console.log("PASS: career backfill, permanent and idempotent XP, failed versus abandoned cultures, atomic purchase/upgrade/expansion gates, grandfathered equipment and replays, unique processing practice, actual machine usage, preventive pollinator service, sequential eight-tent expansion and private API permissions.");
} catch (error) {
  console.error(error.stack ?? error);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally { await db.close(); }
