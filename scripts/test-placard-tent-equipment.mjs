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
  const freshUser=randomUUID(),brokenUser=randomUUID();
  for (const owner of [user,legacyUser,freshUser,brokenUser]) {
    await db.query('INSERT INTO auth.users VALUES($1)',[owner]);
    await db.query('SELECT kq_business_settle($1)',[owner]);
    await db.query('UPDATE kq_equipment_wallets SET production_units=$2,cash_cents=100000000 WHERE user_id=$1',[owner,owner===freshUser?1:4]);
    await db.query('SELECT rpc_kq_ensure_equipment_profile($1)',[owner]);
    await db.query('INSERT INTO kq_treasury_accounts(user_id) VALUES($1)',[owner]);
  }
  await db.exec(`CREATE TRIGGER test_installation_purchase AFTER INSERT ON kq_equipment_purchase_receipts FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();
    CREATE TRIGGER test_installation_upgrade AFTER INSERT ON kq_equipment_upgrade_receipts FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();
    CREATE TRIGGER test_installation_replacement AFTER INSERT ON kq_culture_equipment_replacements FOR EACH ROW EXECUTE FUNCTION kq_treasury_observe();`);
  const buy=(owner,tent,codes,key=randomUUID())=>rpc('rpc_kq_purchase_tent_equipment($1,$2,$3,$4)',[owner,key,codes,tent]);
  const equip=(owner,tent,code)=>rpc('rpc_kq_equip_tent_equipment($1,$2,$3)',[owner,code,tent]);
  const profile=owner=>query('SELECT * FROM kq_player_equipment WHERE user_id=$1 ORDER BY tent_number,equipment_code',[owner]);
  const price=code=>rpc('(SELECT price_cents FROM kq_equipment_catalog WHERE code=$1)',[code]);
  const upgrade=(owner,tent,code,level,key=randomUUID())=>rpc('rpc_kq_upgrade_tent_equipment($1,$2,$3,$4,$5)',[owner,key,code,level,tent]);
  const replace=(owner,tent,code,version,cost,key=randomUUID())=>rpc('rpc_kq_replace_tent_culture_equipment($1,$2,$3,$4,$5,$6)',[owner,code,version,cost,key,tent]);
  const expand=(owner,units,cost,key=randomUUID())=>rpc('rpc_kq_expand_production($1,$2,$3,$4)',[owner,key,units,cost]);
  const snapshot=async(owner,{global=false,shared=true,scope=false}={})=>{
    const {production_units:units}=await wallet(owner);
    const rows=await query(`SELECT l.tent_number,l.equipment_code,e.level,c.slot,c.category,
      e.culture_wear_percent=100 AND kq_culture_equipment_wear_delta(e.equipment_code,'balanced',0)>0 AS broken
      FROM kq_equipment_loadouts l JOIN kq_player_equipment e USING(user_id,tent_number,equipment_code)
      JOIN kq_equipment_catalog c ON c.code=l.equipment_code WHERE l.user_id=$1 ORDER BY l.equipment_code`,[owner]);
    const isProcessing=row=>row.category==='processing'&&['sifting','washing','filtration','static-separation','press','drying'].includes(row.slot);
    const copy=items=>({codes:items.map(row=>row.equipment_code).sort(),levels:Object.fromEntries(items.map(row=>[row.equipment_code,row.level]))});
    const tents=Array.from({length:units},(_,index)=>{
      const local=rows.filter(row=>row.tent_number===(global?1:index+1)&&!row.broken&&(!shared||!isProcessing(row)));
      for(const [slot,code] of [['tent','TENT-080-STARTER'],['lighting','LED-150-STARTER'],['air','AIR-STARTER']]){
        if(!local.some(row=>row.slot===slot))local.push({slot,equipment_code:code,level:1});
      }
      return {tentNumber:index+1,...copy(local)};
    });
    return {equipment:{productionUnits:units,codes:tents[0].codes,levels:tents[0].levels,tents,
      ...(shared?{shared:copy(rows.filter(row=>row.tent_number===1&&isProcessing(row)))}:{}),...(scope?{scope:'installation'}:{})},
      harvestGrams:100*units,energy:{version:1,mode:'balanced',totalCents:603*units,totalWattHours:20100*units}};
  };
  const start=async(owner,state)=>(await one('INSERT INTO kq_runs(user_id,state) VALUES($1,$2) RETURNING id',[owner,JSON.stringify(state)])).id;
  const invoice=run=>one('SELECT * FROM kq_energy_invoices WHERE run_id=$1',[run]);

  // Start a genuine pre-workshop culture with individual copies before applying 006.
  const oldPurchaseKey=randomUUID();
  await buy(legacyUser,1,['LED-300','WASHER-25L']);
  await buy(legacyUser,2,['LED-300','AIR-EC6','SECURITY-DOG','WASHER-25L'],oldPurchaseKey);
  await buy(legacyUser,4,['SECURITY-DOG']);
  for(const [tent,codes] of [[1,['LED-300','WASHER-25L']],[2,['LED-300','AIR-EC6','SECURITY-DOG','WASHER-25L']],[4,['SECURITY-DOG']]]){
    for(const code of codes)await equip(legacyUser,tent,code);
  }
  await upgrade(legacyUser,2,'LED-300',1);
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100,culture_wear_version=3 WHERE user_id=$1 AND tent_number=2 AND equipment_code='AIR-EC6'",[legacyUser]);
  const airPrice=await price('AIR-EC6');
  await replace(legacyUser,2,'AIR-EC6',3,airPrice);
  await db.query("UPDATE kq_player_equipment SET level=2,culture_wear_percent=50,culture_wear_version=9,maintenance_version=4 WHERE user_id=$1 AND tent_number=1 AND equipment_code='LED-300'",[legacyUser]);
  await db.query("UPDATE kq_player_equipment SET level=4,culture_wear_percent=70,culture_wear_version=6,maintenance_version=8 WHERE user_id=$1 AND tent_number=2 AND equipment_code='LED-300'",[legacyUser]);
  const oldestState=await snapshot(legacyUser,{shared:false});
  const oldestRun=await start(legacyUser,oldestState);
  await db.exec(await migration('20260927000600_kq_shared_processing_workshop.sql'));

  // A second already-active culture uses the shared-workshop format, but no scope flag.
  await buy(user,2,['LED-300','SECURITY-DOG','SOLAR-BACKUP']);
  await buy(user,3,['AIR-EC6','DRYING-ROOM']);
  for(const [tent,codes] of [[2,['LED-300','SECURITY-DOG','SOLAR-BACKUP']],[3,['AIR-EC6','DRYING-ROOM']]]){
    for(const code of codes)await equip(user,tent,code);
  }
  const priorState=await snapshot(user),priorRun=await start(user,priorState);
  // A broken installed model remains broken; reserve models must not get installed.
  await buy(brokenUser,2,['LED-300','AIR-EC6']);
  await equip(brokenUser,2,'LED-300');
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100,culture_wear_version=11 WHERE user_id=$1 AND tent_number=2 AND equipment_code='LED-300'",[brokenUser]);
  await db.exec(await migration('20260928000100_kq_shared_installation_equipment.sql'));

  // An active installation-era culture must also survive the new allocation.
  await buy(freshUser,1,['LED-300','SECURITY-DOG','WASHER-25L']);
  for(const code of ['LED-300','SECURITY-DOG','WASHER-25L'])await equip(freshUser,1,code);
  await expand(freshUser,1,30000);
  const installationState=await snapshot(freshUser,{global:true,scope:true});
  const installationRun=await start(freshUser,installationState);
  // Exercise cent rounding where splitting cost and recognized amounts naively
  // into a large remainder on tent one would violate recognized <= cost.
  await db.query("UPDATE kq_treasury_assets SET recognized_cents=cost_cents-3 WHERE user_id=$1 AND equipment_code='LED-300' AND retired_at IS NULL",[freshUser]);
  await db.query("INSERT INTO kq_treasury_assets(user_id,source_key,account,expense_account,equipment_code,cost_cents,recognized_cents,starts_at,ends_at,recognized_at,tent_number) VALUES($1,'rounding-fixture','equipment','expense_depreciation','LED-300',9,7,now(),now()+interval '1 year',now(),1)",[user]);
  const beforeAllocation=await query('SELECT * FROM kq_player_equipment ORDER BY user_id,tent_number,equipment_code');
  const beforeInstalled=await query('SELECT * FROM kq_equipment_loadouts ORDER BY user_id,tent_number,slot');
  const beforeWallets=await query('SELECT user_id,cash_cents,production_units,updated_at FROM kq_equipment_wallets ORDER BY user_id');
  const beforeAssets=await query('SELECT * FROM kq_treasury_assets ORDER BY id');
  const beforeHistory={};
  for(const table of ['kq_equipment_purchase_receipts','kq_equipment_upgrade_receipts','kq_culture_equipment_replacements']){
    beforeHistory[table]=await query('SELECT * FROM '+table+' ORDER BY user_id,request_key');
  }
  const allocationMigration=await migration('20261001000200_kq_tent_equipment_and_shared_workshop.sql');
  await db.exec(allocationMigration);
  const localOwned=(owner,tent,code)=>one('SELECT * FROM kq_player_equipment WHERE user_id=$1 AND tent_number=$2 AND equipment_code=$3',[owner,tent,code]);
  const currentSnapshot=async owner=>{
    const state=await snapshot(owner);
    state.equipment.scope='tent';
    return state;
  };
  const assertFrozen=async(id,state)=>assert.deepEqual((await one('SELECT state FROM kq_runs WHERE id=$1',[id])).state,state);
  assert.deepEqual(await query('SELECT user_id,cash_cents,production_units,updated_at FROM kq_equipment_wallets ORDER BY user_id'),beforeWallets);
  for(const [table,before] of Object.entries(beforeHistory))assert.deepEqual(await query('SELECT * FROM '+table+' ORDER BY user_id,request_key'),before);
  for(const original of beforeAllocation){
    const isShared=await rpc('kq_is_shared_processing_equipment($1)',[original.equipment_code]);
    const units=(await wallet(original.user_id)).production_units;
    const copies=await query('SELECT * FROM kq_player_equipment WHERE user_id=$1 AND equipment_code=$2 ORDER BY tent_number',[original.user_id,original.equipment_code]);
    assert.equal(copies.length,isShared?1:units,original.equipment_code+' assigned once per correct scope');
    assert.equal(copies.reduce((total,row)=>total+row.purchase_price_cents,0),original.purchase_price_cents,'Purchase basis never multiplied');
    for(const copy of copies){
      assert.deepEqual({...copy,tent_number:1,purchase_price_cents:original.purchase_price_cents},original,'Level, condition, versions and dates preserved');
      if(original.purchase_price_cents>0)assert.ok(copy.purchase_price_cents>0);
    }
  }
  for(const original of beforeInstalled){
    const shared=await rpc('kq_is_shared_processing_equipment($1)',[original.equipment_code]);
    const copies=await query('SELECT * FROM kq_equipment_loadouts WHERE user_id=$1 AND slot=$2 ORDER BY tent_number',[original.user_id,original.slot]);
    assert.equal(copies.length,shared?1:(await wallet(original.user_id)).production_units);
    for(const copy of copies)assert.deepEqual({...copy,tent_number:1},original,'Installed choices, including broken equipment, survive');
  }
  for(const original of beforeAssets){
    const copies=await query("SELECT * FROM kq_treasury_assets WHERE id=$1 OR source_key LIKE $2 ORDER BY tent_number",[original.id,'tent-allocation:'+original.id+':%']);
    assert.equal(copies.reduce((total,row)=>total+Number(row.cost_cents),0),Number(original.cost_cents));
    assert.equal(copies.reduce((total,row)=>total+Number(row.recognized_cents),0),Number(original.recognized_cents));
    for(const copy of copies){
      for(const key of ['user_id','account','expense_account','equipment_code','starts_at','ends_at','recognized_at','retired_at'])assert.deepEqual(copy[key],original[key]);
      assert.ok(Number(copy.recognized_cents)<=Number(copy.cost_cents));
    }
  }
  await assertFrozen(oldestRun,oldestState);await assertFrozen(priorRun,priorState);await assertFrozen(installationRun,installationState);
  const convertedRows=await query('SELECT * FROM kq_player_equipment ORDER BY user_id,tent_number,equipment_code');
  const convertedAssets=await query('SELECT * FROM kq_treasury_assets ORDER BY id');
  await db.exec(allocationMigration);
  assert.deepEqual(await query('SELECT * FROM kq_player_equipment ORDER BY user_id,tent_number,equipment_code'),convertedRows,'Reapplying cannot multiply equipment');
  assert.deepEqual(await query('SELECT * FROM kq_treasury_assets ORDER BY id'),convertedAssets,'Reapplying cannot divide basis again');

  // Three snapshot generations complete without rewriting frozen electricity or
  // changing historical dog charges; every physical copy actually used wears once.
  await finish(oldestRun);await finish(priorRun);await finish(installationRun);
  assert.equal((await invoice(oldestRun)).dog_care.foodCents,1600,'Old two-dog snapshot retains its billing');
  assert.equal((await invoice(priorRun)).dog_care.foodCents,800,'Previous individual snapshot retains its single installed dog');
  assert.equal((await invoice(installationRun)).dog_care.foodCents,800,'Old installation still bills one common dog');
  assert.equal((await invoice(installationRun)).total_cents,installationState.energy.totalCents+800);
  assert.equal((await localOwned(freshUser,1,'LED-300')).culture_wear_percent,5);
  assert.equal((await localOwned(freshUser,2,'LED-300')).culture_wear_percent,5);
  assert.equal((await localOwned(freshUser,1,'WASHER-25L')).wear_cycles,1,'Shared processing wears once per culture');
  const afterLegacy=await profile(freshUser);await finish(installationRun);assert.deepEqual(await profile(freshUser),afterLegacy);
  assert.equal((await localOwned(legacyUser,1,'LED-300')).culture_wear_percent,75);
  assert.equal((await localOwned(legacyUser,2,'LED-300')).culture_wear_percent,75);
  assert.equal((await localOwned(legacyUser,3,'LED-300')).culture_wear_percent,70,'An unused local copy does not wear');
  for(const tent of [1,2,3,4]){
    assert.equal((await localOwned(brokenUser,tent,'LED-300')).culture_wear_percent,100);
    await assert.rejects(()=>equip(brokenUser,tent,'LED-300'),/kq_culture_equipment_broken/);
  }
  const fallbackState=await currentSnapshot(brokenUser);
  assert.ok(fallbackState.equipment.tents.every(t=>t.codes.includes('LED-150-STARTER')&&!t.codes.includes('LED-300')));
  await finish(await start(brokenUser,fallbackState));
  assert.equal((await localOwned(brokenUser,4,'LED-300')).culture_wear_version,11);

  // Future tents have a basic kit only. The shared workshop remains accessible.
  const expansionKey=randomUUID(),expansion=await expand(freshUser,2,30000,expansionKey);
  assert.equal(expansion.productionUnits,3);
  assert.deepEqual(await expand(freshUser,2,30000,expansionKey),{...expansion,replayed:true});
  const tentThree=await query('SELECT equipment_code FROM kq_player_equipment WHERE user_id=$1 AND tent_number=3 ORDER BY equipment_code',[freshUser]);
  assert.deepEqual(tentThree.map(row=>row.equipment_code),['AIR-STARTER','LED-150-STARTER','TENT-080-STARTER']);
  assert.ok((await currentSnapshot(freshUser)).equipment.shared.codes.includes('WASHER-25L'));
  assert.equal((await localOwned(freshUser,2,'LED-300')).culture_wear_percent,5);
  const purchaseKey=randomUUID(),beforePurchase=await wallet(freshUser);
  const purchase=await buy(freshUser,3,['LED-300','PRESS-0600'],purchaseKey);
  assert.equal(purchase.tentNumber,3);
  assert.equal((await wallet(freshUser)).cash_cents,beforePurchase.cash_cents-purchase.totalPriceCents);
  assert.ok(await localOwned(freshUser,3,'LED-300'));assert.ok(await localOwned(freshUser,1,'PRESS-0600'));
  assert.equal(await localOwned(freshUser,3,'PRESS-0600'),undefined);
  assert.deepEqual(await buy(freshUser,3,['LED-300','PRESS-0600'],purchaseKey),{...purchase,replayed:true});
  await assert.rejects(()=>buy(freshUser,2,['LED-300','PRESS-0600'],purchaseKey),/equipment_purchase_request_mismatch/);
  const atomicWallet=await wallet(freshUser);
  await assert.rejects(()=>buy(freshUser,2,['CLIMATE-SMART','WASHER-25L']),/equipment_already_owned/);
  assert.equal(await localOwned(freshUser,2,'CLIMATE-SMART'),undefined);assert.deepEqual(await wallet(freshUser),atomicWallet);
  await assert.rejects(()=>buy(freshUser,4,['AIR-EC6']),/production_invalid_tent/);
  await assert.rejects(()=>db.query("INSERT INTO kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents) VALUES($1,3,'WASHER-25L',1)",[freshUser]),/equipment_shared_workshop_only/);
  await assert.rejects(()=>db.query("INSERT INTO kq_equipment_loadouts(user_id,tent_number,slot,equipment_code) VALUES($1,3,'washing','WASHER-25L')",[freshUser]),/equipment_shared_workshop_only/);

  await equip(freshUser,3,'LED-300');await equip(freshUser,3,'PRESS-0600');
  const upgradeKey=randomUUID(),upgraded=await upgrade(freshUser,3,'LED-300',1,upgradeKey);
  assert.equal(upgraded.tentNumber,3);assert.equal(upgraded.level,2);
  assert.equal((await localOwned(freshUser,1,'LED-300')).level,1);
  assert.deepEqual(await upgrade(freshUser,3,'LED-300',1,upgradeKey),{...upgraded,replayed:true});
  await assert.rejects(()=>upgrade(freshUser,1,'LED-300',1,upgradeKey),/equipment_upgrade_request_mismatch/);
  const sharedUpgrade=await upgrade(freshUser,3,'WASHER-25L',1);assert.equal(sharedUpgrade.tentNumber,1);
  await buy(freshUser,1,['SECURITY-CAMERA']);await equip(freshUser,1,'SECURITY-CAMERA');
  assert.equal((await rpc('rpc_kq_energy_snapshot($1)',[freshUser])).dogCare.foodCents,1600,'Adopted dogs require care even with a camera installed');
  const state=await currentSnapshot(freshUser);
  assert.equal(state.equipment.tents[0].levels['LED-300'],1);assert.equal(state.equipment.tents[2].levels['LED-300'],2);
  const stale=structuredClone(state);stale.equipment.tents[2].levels['LED-300']=1;
  await assert.rejects(()=>start(freshUser,stale),/kq_culture_equipment_changed/);
  const wrongCodes=structuredClone(state);wrongCodes.equipment.tents[2].codes.push('SECURITY-CAMERA');
  await assert.rejects(()=>start(freshUser,wrongCodes),/kq_culture_equipment_changed/);
  const wrongShared=structuredClone(state);wrongShared.equipment.shared.codes=[];
  await assert.rejects(()=>start(freshUser,wrongShared),/kq_shared_equipment_changed/);
  const oldScope=structuredClone(state);oldScope.equipment.scope='installation';
  await assert.rejects(()=>start(freshUser,oldScope),/kq_culture_equipment_changed/);
  const missingScope=structuredClone(state);delete missingScope.equipment.scope;
  await assert.rejects(()=>start(freshUser,missingScope),/kq_culture_equipment_changed/);
  const run=await start(freshUser,state);
  await assert.rejects(()=>db.query("UPDATE kq_runs SET state=jsonb_set(state,'{equipment,scope}','\"installation\"') WHERE id=$1",[run]),/kq_energy_quote_immutable/);
  const beforeRun=await profile(freshUser),beforeFinish=await wallet(freshUser);
  await finish(run);
  assert.equal((await invoice(run)).dog_care.foodCents,1600);
  assert.equal((await wallet(freshUser)).cash_cents,beforeFinish.cash_cents-1600);
  assert.equal((await invoice(run)).total_cents,state.energy.totalCents+1600);
  for(const tent of [1,2,3]){
    const before=beforeRun.find(row=>row.tent_number===tent&&row.equipment_code==='LED-300');
    const after=await localOwned(freshUser,tent,'LED-300');
    assert.equal(after.culture_wear_percent,before.culture_wear_percent+5);
    assert.equal(after.culture_wear_version,before.culture_wear_version+1);
  }
  assert.equal((await localOwned(freshUser,1,'WASHER-25L')).wear_cycles,2);
  const wearReceipt=(await one('SELECT equipment FROM kq_culture_equipment_wear_receipts WHERE run_id=$1',[run])).equipment;
  assert.equal(wearReceipt.length,new Set(wearReceipt.map(item=>item.tentNumber+':'+item.equipmentCode)).size);
  const completed=await profile(freshUser);await finish(run);assert.deepEqual(await profile(freshUser),completed);

  // Replacing tent two cannot reset tent one's wear or retire its asset.
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100,culture_wear_version=8 WHERE user_id=$1 AND tent_number=2 AND equipment_code='LED-300'",[freshUser]);
  const otherBefore=await localOwned(freshUser,1,'LED-300'),replacementKey=randomUUID(),replacementCost=await price('LED-300');
  const otherAssets=await query("SELECT * FROM kq_treasury_assets WHERE user_id=$1 AND tent_number=1 AND equipment_code='LED-300' ORDER BY id",[freshUser]);
  const replaced=await replace(freshUser,2,'LED-300',8,replacementCost,replacementKey);
  assert.equal(replaced.tentNumber,2);assert.equal((await localOwned(freshUser,2,'LED-300')).culture_wear_percent,0);
  assert.deepEqual(await localOwned(freshUser,1,'LED-300'),otherBefore);
  assert.deepEqual(await query("SELECT * FROM kq_treasury_assets WHERE user_id=$1 AND tent_number=1 AND equipment_code='LED-300' ORDER BY id",[freshUser]),otherAssets);
  assert.deepEqual(await replace(freshUser,2,'LED-300',8,replacementCost,replacementKey),{...replaced,replayed:true});
  await assert.rejects(()=>replace(freshUser,1,'LED-300',8,replacementCost,replacementKey),/culture_equipment_request_mismatch/);
  await db.query("UPDATE kq_player_equipment SET wear_cycles=kq_machine_interval(equipment_code,level),maintenance_version=7 WHERE user_id=$1 AND equipment_code='WASHER-25L'",[freshUser]);
  const repairKey=randomUUID(),repairCost=20000;
  const repair=await rpc("rpc_kq_repair_tent_machine($1,'WASHER-25L',7,$2,$3,3)",[freshUser,repairCost,repairKey]);
  assert.equal(repair.tentNumber,1);assert.equal((await localOwned(freshUser,1,'WASHER-25L')).wear_cycles,0);
  assert.equal((await rpc("rpc_kq_repair_tent_machine($1,'WASHER-25L',7,$2,$3,1)",[freshUser,repairCost,repairKey])).replayed,true);

  // Applying again after new local purchases/expansion still preserves all rows.
  const finalProfile=await query('SELECT * FROM kq_player_equipment ORDER BY user_id,tent_number,equipment_code');
  const finalAssets=await query('SELECT * FROM kq_treasury_assets ORDER BY id');
  await db.exec(allocationMigration);
  assert.deepEqual(await query('SELECT * FROM kq_player_equipment ORDER BY user_id,tent_number,equipment_code'),finalProfile);
  assert.deepEqual(await query('SELECT * FROM kq_treasury_assets ORDER BY id'),finalAssets);
  assert.equal(await rpc("kq_is_shared_processing_equipment('DRYING-ROOM')"),false);
  assert.equal(await rpc("kq_equipment_storage_tent('SOLAR-BACKUP',3)"),3);
  assert.equal(await rpc("kq_equipment_storage_tent('WASHER-25L',3)"),1);
  for(const role of ['anon','authenticated','service_role']){
    assert.equal(await rpc("has_function_privilege($1,'kq_equipment_storage_tent(text,integer)','EXECUTE')",[role]),false);
    assert.equal(await rpc("has_function_privilege($1,'rpc_kq_replace_tent_culture_equipment(uuid,text,integer,integer,uuid,integer)','EXECUTE')",[role]),role==='service_role');
  }
  console.log('Tent equipment PostgreSQL passed: existing rights and levels/wear retained per tent, exact accounting allocation and replay, three historical snapshot generations, starter-only expansion, atomic mixed purchases, local upgrades/replacements, shared maintenance, current snapshot validation, physical wear, per-dog care and RPC privileges.');
} catch(error) {
  console.error(error.message);
  if(error.where)console.error(error.where);
  if(error.stack)console.error(error.stack.split('\n').slice(1,3).join('\n'));
  process.exitCode=1;
} finally { await db.close(); }
