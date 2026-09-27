// Isolated PostgreSQL integration tests: no credentials, network or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const migration = name => readFile(`supabase/migrations/${name}`, "utf8");
const query = async (sql, values = []) => (await db.query(sql, values)).rows;
const one = async (sql, values = []) => (await query(sql, values))[0];
const rpc = async (sql, values = []) => (await one(`SELECT ${sql} AS value`, values)).value;
const user = randomUUID(), legacyUser = randomUUID();
const wallet = (owner = user) => one("SELECT cash_cents,production_units FROM kq_equipment_wallets WHERE user_id=$1", [owner]);
const finish = id => db.query("UPDATE kq_runs SET status='completed' WHERE id=$1", [id]);

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users(id),status TEXT NOT NULL DEFAULT 'active',state JSONB NOT NULL);
    CREATE UNIQUE INDEX one_active_run ON kq_runs(user_id) WHERE status='active';
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users(id),revision BIGINT NOT NULL DEFAULT 0);
    CREATE TABLE kq_commerce_batches(user_id UUID,route TEXT);
    CREATE TABLE arena_chanvrier_profiles(user_id UUID,strength TEXT);
    -- Calendar/treasury fixtures record integration calls; equipment and invoice
    -- routines below are loaded from the actual migration chain.
    CREATE TABLE test_settlements(user_id UUID);
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
    "20260919000500_kq_culture_equipment_wear.sql"])
    await db.exec(await migration(name));
  const electricity = await migration("20260911000300_kq_cycle_electricity.sql");
  await db.exec(electricity.slice(electricity.indexOf("CREATE TABLE public.kq_energy_invoices"), electricity.indexOf("-- The existing sale transaction")));
  await db.exec(await migration("20260913000700_kq_security_equipment_care.sql"));
  const business = await migration("20260921000100_kq_business_calendar.sql");
  await db.exec(business.slice(business.indexOf("CREATE TABLE public.kq_lab_invoices"), business.indexOf("-- Advance in baseline-capacity units")));
  await db.exec(`CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
    PERFORM rpc_kq_ensure_equipment_profile(p_user);
    INSERT INTO kq_commerce_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
    INSERT INTO test_settlements VALUES(p_user);
  END $$;`);
  const labStart = business.indexOf("CREATE FUNCTION public.kq_invoice_completed_lab()");
  await db.exec(business.slice(labStart, business.indexOf("CREATE FUNCTION public.kq_business_sale_preview", labStart)));
  await db.exec(await migration("20260923001000_kq_production_expansion.sql"));
  await db.exec(`CREATE FUNCTION rpc_kq_commerce_command(p_user_id UUID,p_action TEXT,p_payload JSONB,p_request_key UUID) RETURNS JSONB
    LANGUAGE plpgsql AS $$ DECLARE installed TEXT[]; BEGIN
      installed:=(SELECT COALESCE(array_agg(equipment_code ORDER BY equipment_code),ARRAY[]::TEXT[]) FROM public.kq_equipment_loadouts WHERE user_id=p_user_id);
      RETURN to_jsonb(installed);
    END $$;`);
  await db.exec(await migration("20260924000300_kq_individual_tents.sql"));
  for (const owner of [user,legacyUser]) {
    await db.query("INSERT INTO auth.users VALUES($1)",[owner]);
    await db.query("SELECT kq_business_settle($1)",[owner]);
    await db.query("UPDATE kq_equipment_wallets SET production_units=4,cash_cents=100000000 WHERE user_id=$1",[owner]);
    await db.query("SELECT rpc_kq_ensure_equipment_profile($1)",[owner]);
    await db.query("INSERT INTO kq_treasury_accounts(user_id) VALUES($1)",[owner]);
  }
  await db.exec(`CREATE TRIGGER test_workshop_purchase AFTER INSERT ON kq_equipment_purchase_receipts FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();
    CREATE TRIGGER test_workshop_upgrade AFTER INSERT ON kq_equipment_upgrade_receipts FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();`);
  const tentBuy=(owner,tent,codes,key=randomUUID())=>rpc("rpc_kq_purchase_tent_equipment($1,$2,$3,$4)",[owner,key,codes,tent]);
  const equip=(owner,tent,code)=>rpc("rpc_kq_equip_tent_equipment($1,$2,$3)",[owner,code,tent]);
  const owned=(owner,tent,code)=>one("SELECT * FROM kq_player_equipment WHERE user_id=$1 AND tent_number=$2 AND equipment_code=$3",[owner,tent,code]);
  const buildState=async(owner,shared)=>{
    const rows=await query(`SELECT l.tent_number,l.equipment_code,e.level,c.category,c.slot FROM kq_equipment_loadouts l
      JOIN kq_player_equipment e USING(user_id,tent_number,equipment_code) JOIN kq_equipment_catalog c ON c.code=l.equipment_code
      WHERE l.user_id=$1 ORDER BY l.tent_number,l.equipment_code`,[owner]);
    const sharedSlots=new Set(['sifting','washing','filtration','static-separation','press','drying']);
    const isShared=row=>row.category==='processing'&&sharedSlots.has(row.slot);
    const copy=items=>({codes:items.map(row=>row.equipment_code),levels:Object.fromEntries(items.map(row=>[row.equipment_code,row.level]))});
    const tents=Array.from({length:4},(_,index)=>({tentNumber:index+1,...copy(rows.filter(row=>row.tent_number===index+1&&(!shared||!isShared(row))))}));
    return {equipment:{productionUnits:4,codes:tents[0].codes,levels:tents[0].levels,tents,...(shared?{shared:copy(rows.filter(isShared))}:{})},harvestGrams:400};
  };
  // Two previously paid copies have different levels, wear and maintenance tokens.
  await tentBuy(legacyUser,1,['WASHER-25L','STATIC-PLASMA']);
  const oldPurchaseKey=randomUUID();
  const oldPurchase=await tentBuy(legacyUser,2,['WASHER-25L','STATIC-PLASMA'],oldPurchaseKey);
  await tentBuy(legacyUser,2,['LED-300','PRESS-0600']);
  await tentBuy(legacyUser,3,['PRESS-0600']);
  await equip(legacyUser,1,'WASHER-25L'); await equip(legacyUser,2,'WASHER-25L');
  await equip(legacyUser,2,'STATIC-PLASMA');
  await equip(legacyUser,2,'LED-300'); await equip(legacyUser,2,'PRESS-0600');
  await equip(legacyUser,3,'PRESS-0600');
  await db.query("UPDATE kq_player_equipment SET level=8 WHERE user_id=$1 AND tent_number=3 AND equipment_code='PRESS-0600'",[legacyUser]);
  await db.query("UPDATE kq_equipment_loadouts SET equipped_at='2026-01-01'::timestamptz+tent_number*interval '1 day' WHERE user_id=$1",[legacyUser]);
  const chosenLoadouts=await query("SELECT slot,equipment_code,equipped_at FROM kq_equipment_loadouts WHERE user_id=$1 AND ((slot='washing' AND tent_number=1) OR (slot='press' AND tent_number=3)) ORDER BY slot",[legacyUser]);
  const oldUpgradeKey=randomUUID();
  const oldUpgrade=await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'STATIC-PLASMA',1,2)",[legacyUser,oldUpgradeKey]);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=10,maintenance_version=4 WHERE user_id=$1 AND tent_number=2 AND equipment_code='STATIC-PLASMA'",[legacyUser]);
  const oldRepairKey=randomUUID();
  const oldRepair=await rpc("rpc_kq_repair_tent_machine($1,'STATIC-PLASMA',4,20000,$2,2)",[legacyUser,oldRepairKey]);
  await db.query("UPDATE kq_player_equipment SET level=3,wear_cycles=2,maintenance_version=9 WHERE user_id=$1 AND tent_number=1 AND equipment_code='WASHER-25L'",[legacyUser]);
  await db.query("UPDATE kq_player_equipment SET level=5,wear_cycles=4,maintenance_version=6 WHERE user_id=$1 AND tent_number=2 AND equipment_code='WASHER-25L'",[legacyUser]);
  const historicalState=await buildState(legacyUser,false);
  const historicalRun=(await one("INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id",[legacyUser,JSON.stringify(historicalState)])).id;
  await db.query("UPDATE kq_treasury_assets SET recognized_cents=LEAST(cost_cents,37) WHERE user_id=$1",[legacyUser]);
  const walletBefore=await wallet(legacyUser);
  const individualBefore=await owned(legacyUser,2,'LED-300');
  const receiptsBefore=await query("SELECT * FROM kq_equipment_purchase_receipts WHERE user_id=$1 ORDER BY id",[legacyUser]);
  const assetsBefore=await query("SELECT * FROM kq_treasury_assets WHERE user_id=$1 ORDER BY source_key",[legacyUser]);
  const totalPrice=(await query("SELECT purchase_price_cents FROM kq_player_equipment WHERE user_id=$1 AND equipment_code='WASHER-25L'",[legacyUser])).reduce((sum,row)=>sum+row.purchase_price_cents,0);
  await db.exec(await migration("20260927000600_kq_shared_processing_workshop.sql"));
  assert.deepEqual(await wallet(legacyUser),walletBefore,'Migration never changes cash');
  assert.deepEqual(await query("SELECT * FROM kq_equipment_purchase_receipts WHERE user_id=$1 ORDER BY id",[legacyUser]),receiptsBefore,'Historical receipts stay immutable');
  assert.deepEqual((await one("SELECT state FROM kq_runs WHERE id=$1",[historicalRun])).state,historicalState,'Active snapshot stays frozen');
  const merged=await owned(legacyUser,1,'WASHER-25L');
  assert.equal(merged.level,5);assert.equal(merged.wear_cycles,4);assert.equal(merged.maintenance_version,9);assert.equal(merged.purchase_price_cents,totalPrice);
  assert.equal(await owned(legacyUser,2,'WASHER-25L'),undefined);
  assert.deepEqual(await owned(legacyUser,2,'LED-300'),individualBefore,'Individual equipment is unchanged');
  assert.deepEqual(await query("SELECT slot,equipment_code,equipped_at FROM kq_equipment_loadouts WHERE user_id=$1 AND tent_number=1 AND slot IN ('washing','press') ORDER BY slot",[legacyUser]),chosenLoadouts,'Tent one installation wins when present; otherwise the highest installed level wins');
  assert.deepEqual(await query("SELECT * FROM kq_treasury_assets WHERE user_id=$1 ORDER BY source_key",[legacyUser]),assetsBefore.map(row=>({...row,tent_number:row.equipment_code==='LED-300'?2:1})),'Asset schedules and basis are preserved');
  assert.deepEqual(await tentBuy(legacyUser,1,['WASHER-25L','STATIC-PLASMA'],oldPurchaseKey),{...oldPurchase,tentNumber:1,replayed:true});
  assert.deepEqual(await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'STATIC-PLASMA',1,1)",[legacyUser,oldUpgradeKey]),{...oldUpgrade,tentNumber:1,replayed:true});
  assert.deepEqual(await rpc("rpc_kq_repair_tent_machine($1,'STATIC-PLASMA',4,20000,$2,1)",[legacyUser,oldRepairKey]),{...oldRepair,replayed:true});
  assert.deepEqual(await wallet(legacyUser),walletBefore,'Historical replay never debits again');
  await finish(historicalRun);
  assert.equal((await owned(legacyUser,1,'WASHER-25L')).wear_cycles,5,'Legacy duplicated snapshots wear the shared machine once');
  assert.equal((await owned(legacyUser,1,'WASHER-25L')).maintenance_version,10);

  // Mixed baskets remain one atomic transaction and book their two scopes correctly.
  const purchaseKey=randomUUID(),before=await wallet();
  const purchase=await tentBuy(user,2,['LED-300','PRESS-0600'],purchaseKey);
  assert.ok(await owned(user,2,'LED-300'));assert.ok(await owned(user,1,'PRESS-0600'));
  assert.equal(await owned(user,2,'PRESS-0600'),undefined);
  assert.equal((await wallet()).cash_cents,before.cash_cents-purchase.totalPriceCents);
  assert.deepEqual(await tentBuy(user,2,['LED-300','PRESS-0600'],purchaseKey),{...purchase,replayed:true});
  await assert.rejects(()=>tentBuy(user,1,['LED-300','PRESS-0600'],purchaseKey),/equipment_purchase_request_mismatch/);
  const after=await wallet();
  await assert.rejects(()=>tentBuy(user,3,['AIR-EC6','PRESS-0600']),/equipment_already_owned/);
  assert.equal(await owned(user,3,'AIR-EC6'),undefined);assert.deepEqual(await wallet(),after);
  const books=await query("SELECT equipment_code,tent_number FROM kq_treasury_assets WHERE user_id=$1 ORDER BY equipment_code",[user]);
  assert.deepEqual(books,[{equipment_code:'LED-300',tent_number:2},{equipment_code:'PRESS-0600',tent_number:1}]);
  await assert.rejects(()=>db.query("INSERT INTO kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents) VALUES($1,2,'PRESS-0600',1)",[user]),/equipment_shared_workshop_only/);
  const allSharedKey=randomUUID(),allShared=await tentBuy(user,3,['WASHER-25L'],allSharedKey);
  assert.equal((await tentBuy(user,1,['WASHER-25L'],allSharedKey)).replayed,true);
  assert.equal((await wallet()).cash_cents,after.cash_cents-allShared.totalPriceCents);
  await equip(user,4,'WASHER-25L');await equip(user,2,'PRESS-0600');
  const upgradeKey=randomUUID();
  const upgraded=await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'WASHER-25L',1,2)",[user,upgradeKey]);
  assert.equal(upgraded.level,2);assert.equal(upgraded.tentNumber,1);
  assert.equal((await rpc("rpc_kq_upgrade_tent_equipment($1,$2,'WASHER-25L',1,4)",[user,upgradeKey])).replayed,true);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=kq_machine_interval(equipment_code,level),maintenance_version=7 WHERE user_id=$1 AND equipment_code='WASHER-25L'",[user]);
  const repairKey=randomUUID(),repair=await rpc("rpc_kq_repair_tent_machine($1,'WASHER-25L',7,20000,$2,4)",[user,repairKey]);
  assert.equal(repair.tentNumber,1);assert.equal(repair.version,8);assert.equal((await owned(user,1,'WASHER-25L')).wear_cycles,0);
  assert.equal((await rpc("rpc_kq_repair_tent_machine($1,'WASHER-25L',7,20000,$2,1)",[user,repairKey])).replayed,true);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=kq_machine_interval(equipment_code,level),maintenance_version=12 WHERE user_id=$1 AND equipment_code='PRESS-0600'",[user]);
  const duePress=await owned(user,1,'PRESS-0600');
  await assert.rejects(()=>db.query("SELECT kq_assert_processing_maintenance($1,'rosin-flower')",[user]),/commerce_machine_maintenance/);
  const sharedState=await buildState(user,true);
  assert.ok(sharedState.equipment.shared.codes.includes('PRESS-0600'),'An installed machine remains in the snapshot when maintenance is due');
  const invalid=structuredClone(sharedState);invalid.equipment.shared.codes=[];
  await assert.rejects(()=>db.query("INSERT INTO kq_runs(user_id,state) VALUES($1,$2)",[user,JSON.stringify(invalid)]),/kq_shared_equipment_changed/);
  const wrongLevel=structuredClone(sharedState);wrongLevel.equipment.shared.levels['WASHER-25L']=1;
  await assert.rejects(()=>db.query("INSERT INTO kq_runs(user_id,state) VALUES($1,$2)",[user,JSON.stringify(wrongLevel)]),/kq_shared_equipment_changed/);
  const next=(await one("INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id",[user,JSON.stringify(sharedState)])).id;
  await assert.rejects(()=>db.query("UPDATE kq_runs SET state=jsonb_set(state,'{equipment,shared,codes}','[]') WHERE id=$1",[next]),/kq_energy_quote_immutable/);
  await finish(next);assert.equal((await owned(user,1,'WASHER-25L')).wear_cycles,1);
  await finish(next);assert.equal((await owned(user,1,'WASHER-25L')).wear_cycles,1,'Repeated completion is idempotent');
  assert.deepEqual(await owned(user,1,'PRESS-0600'),duePress,'A due machine stays at its maintenance threshold');
  for (const role of ['anon','authenticated','service_role']) {
    assert.equal(await rpc("has_function_privilege($1,'public.kq_equipment_storage_tent(text,integer)','EXECUTE')",[role]),false);
    assert.equal(await rpc("has_function_privilege($1,'public.rpc_kq_purchase_tent_equipment(uuid,uuid,text[],integer)','EXECUTE')",[role]),role==='service_role');
  }
  console.log('Shared workshop PostgreSQL passed: conservative migration, immutable history/assets, atomic mixed purchase and replay, canonical install/upgrade/repair, shared frozen snapshot, legacy/new wear once, direct-write guard and grants.');
} finally { await db.close(); }
