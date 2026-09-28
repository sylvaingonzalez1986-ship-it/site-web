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
  const owned=(owner,code)=>one('SELECT * FROM kq_player_equipment WHERE user_id=$1 AND tent_number=1 AND equipment_code=$2',[owner,code]);
  const profile=owner=>query('SELECT * FROM kq_player_equipment WHERE user_id=$1 ORDER BY tent_number,equipment_code',[owner]);
  const loadout=owner=>query('SELECT * FROM kq_equipment_loadouts WHERE user_id=$1 ORDER BY tent_number,slot',[owner]);
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
  const oldPurchase=await buy(legacyUser,2,['LED-300','AIR-EC6','SECURITY-DOG','WASHER-25L'],oldPurchaseKey);
  await buy(legacyUser,4,['SECURITY-DOG']);
  for(const [tent,codes] of [[1,['LED-300','WASHER-25L']],[2,['LED-300','AIR-EC6','SECURITY-DOG','WASHER-25L']],[4,['SECURITY-DOG']]]){
    for(const code of codes)await equip(legacyUser,tent,code);
  }
  const oldUpgradeKey=randomUUID(),oldUpgrade=await upgrade(legacyUser,2,'LED-300',1,oldUpgradeKey);
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100,culture_wear_version=3 WHERE user_id=$1 AND tent_number=2 AND equipment_code='AIR-EC6'",[legacyUser]);
  const airPrice=await price('AIR-EC6');
  const oldReplacementKey=randomUUID(),oldReplacement=await replace(legacyUser,2,'AIR-EC6',3,airPrice,oldReplacementKey);
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
  const walletsBefore=await query('SELECT * FROM kq_equipment_wallets ORDER BY user_id');
  const assetsBefore=await query('SELECT * FROM kq_treasury_assets ORDER BY id');
  const histories={};
  for(const table of ['kq_equipment_purchase_receipts','kq_equipment_upgrade_receipts','kq_culture_equipment_replacements']){
    histories[table]=await query('SELECT * FROM '+table+' ORDER BY user_id,request_key');
  }
  const mergedExpected=await query(`SELECT user_id,equipment_code,SUM(purchase_price_cents)::int purchase_price_cents,
    MIN(acquired_at) acquired_at,MAX(level) level,MAX(wear_cycles) wear_cycles,MAX(maintenance_version) maintenance_version,
    MAX(culture_wear_percent) culture_wear_percent,MAX(culture_wear_version) culture_wear_version
    FROM kq_player_equipment GROUP BY user_id,equipment_code ORDER BY user_id,equipment_code`);
  await db.exec(await migration('20260928000100_kq_shared_installation_equipment.sql'));
  assert.deepEqual(await query('SELECT * FROM kq_equipment_wallets ORDER BY user_id'),walletsBefore);
  for(const [table,before] of Object.entries(histories))assert.deepEqual(await query('SELECT * FROM '+table+' ORDER BY user_id,request_key'),before);
  assert.deepEqual(await query('SELECT user_id,equipment_code,purchase_price_cents,acquired_at,level,wear_cycles,maintenance_version,culture_wear_percent,culture_wear_version FROM kq_player_equipment ORDER BY user_id,equipment_code'),mergedExpected);
  assert.deepEqual(await query('SELECT * FROM kq_treasury_assets ORDER BY id'),assetsBefore.map(row=>({...row,tent_number:row.retired_at?row.tent_number:1})), 'Preserve separate asset schedules, including retired history');
  assert.deepEqual((await one('SELECT state FROM kq_runs WHERE id=$1',[oldestRun])).state,oldestState);
  assert.deepEqual((await one('SELECT state FROM kq_runs WHERE id=$1',[priorRun])).state,priorState);
  assert.equal((await rpc('(SELECT count(*) FROM kq_player_equipment WHERE tent_number<>1)')),0);
  assert.equal((await rpc('(SELECT count(*) FROM kq_equipment_loadouts WHERE tent_number<>1)')),0);
  assert.equal((await loadout(user)).find(row=>row.slot==='lighting').equipment_code,'LED-300','Paid installed model wins over tent one starter');
  assert.equal((await loadout(brokenUser)).find(row=>row.slot==='air').equipment_code,'AIR-STARTER','Reserve equipment stays in reserve');
  assert.equal((await owned(brokenUser,'LED-300')).culture_wear_percent,100);
  assert.equal((await owned(brokenUser,'LED-300')).culture_wear_version,11);
  await assert.rejects(()=>equip(brokenUser,2,'LED-300'),/kq_culture_equipment_broken/);
  assert.equal(await rpc("(SELECT tgenabled='O' FROM pg_trigger WHERE tgname='kq_guard_culture_equipment_loadout')"),true);
  const fallbackState=await snapshot(brokenUser,{global:true,scope:true});
  assert.ok(fallbackState.equipment.tents.every(t=>t.codes.includes('LED-150-STARTER')&&!t.codes.includes('LED-300')));
  await finish(await start(brokenUser,fallbackState));
  assert.equal((await owned(brokenUser,'LED-300')).culture_wear_version,11,'A broken model omitted by fallback is not worn again');

  // Historical cross-tent receipts replay globally without another debit or write.
  const replayWallet=await wallet(legacyUser);
  assert.deepEqual(await buy(legacyUser,1,['LED-300','AIR-EC6','SECURITY-DOG','WASHER-25L'],oldPurchaseKey),{...oldPurchase,tentNumber:1,replayed:true});
  assert.deepEqual(await upgrade(legacyUser,4,'LED-300',1,oldUpgradeKey),{...oldUpgrade,tentNumber:1,replayed:true});
  assert.deepEqual(await replace(legacyUser,1,'AIR-EC6',3,airPrice,oldReplacementKey),{...oldReplacement,replayed:true});
  await assert.rejects(()=>buy(legacyUser,1,['AIR-EC6'],oldPurchaseKey),/equipment_purchase_request_mismatch/);
  assert.deepEqual(await wallet(legacyUser),replayWallet);
  await finish(oldestRun);
  assert.equal((await owned(legacyUser,'LED-300')).culture_wear_percent,75,'Duplicate old snapshots wear the shared model once');
  assert.equal((await owned(legacyUser,'LED-300')).culture_wear_version,10);
  assert.equal((await owned(legacyUser,'WASHER-25L')).wear_cycles,1);
  assert.equal((await invoice(oldestRun)).dog_care.foodCents,1600,'Old two-dog snapshot retains its frozen billing');
  const oldCompleted=await profile(legacyUser);
  await finish(oldestRun);assert.deepEqual(await profile(legacyUser),oldCompleted);
  await finish(priorRun);
  assert.equal((await owned(user,'LED-300')).culture_wear_percent,5,'A model used only by historical tent two still wears once');
  assert.equal((await owned(user,'AIR-EC6')).culture_wear_percent,3);

  // New purchases, installations, upgrades and capacity changes share one profile.
  await buy(freshUser,1,['LED-300','AIR-EC6','SECURITY-DOG','SOLAR-BACKUP','DRYING-ROOM','WASHER-25L']);
  for(const code of ['LED-300','AIR-EC6','SECURITY-DOG','SOLAR-BACKUP','DRYING-ROOM','WASHER-25L'])await equip(freshUser,1,code);
  const initialProfile=await profile(freshUser),initialLoadout=await loadout(freshUser),beforeExpand=await wallet(freshUser);
  const expansionKey=randomUUID(),expansion=await expand(freshUser,1,30000,expansionKey);
  assert.equal(expansion.productionUnits,2);assert.equal((await wallet(freshUser)).cash_cents,beforeExpand.cash_cents-30000);
  assert.deepEqual(await profile(freshUser),initialProfile);assert.deepEqual(await loadout(freshUser),initialLoadout);
  assert.deepEqual(await expand(freshUser,1,30000,expansionKey),{...expansion,replayed:true});
  await assert.rejects(()=>expand(freshUser,1,30000),/production_units_changed/);
  await assert.rejects(()=>expand(freshUser,2,60000),/production_price_changed/);
  const beforeDuplicate=await wallet(freshUser),requestCount=await rpc('(SELECT count(*) FROM kq_equipment_purchase_receipts WHERE user_id=$1)',[freshUser]);
  await assert.rejects(()=>buy(freshUser,2,['CLIMATE-SMART','LED-300']),/equipment_already_owned/);
  assert.equal(await owned(freshUser,'CLIMATE-SMART'),undefined);
  assert.deepEqual(await wallet(freshUser),beforeDuplicate);
  assert.equal(await rpc('(SELECT count(*) FROM kq_equipment_purchase_receipts WHERE user_id=$1)',[freshUser]),requestCount);
  await assert.rejects(()=>buy(freshUser,2,['CLIMATE-SMART','CLIMATE-SMART']),/duplicate_equipment/);
  const newPurchaseKey=randomUUID(),purchase=await buy(freshUser,2,['CLIMATE-SMART','PRESS-0600'],newPurchaseKey);
  assert.equal(purchase.tentNumber,1);
  assert.deepEqual(await buy(freshUser,1,['CLIMATE-SMART','PRESS-0600'],newPurchaseKey),{...purchase,replayed:true});
  await equip(freshUser,2,'CLIMATE-SMART');await equip(freshUser,2,'PRESS-0600');
  const newUpgradeKey=randomUUID(),newUpgrade=await upgrade(freshUser,2,'LED-300',1,newUpgradeKey);
  assert.equal(newUpgrade.level,2);assert.equal(newUpgrade.tentNumber,1);
  assert.deepEqual(await upgrade(freshUser,1,'LED-300',1,newUpgradeKey),{...newUpgrade,replayed:true});
  await assert.rejects(()=>upgrade(freshUser,2,'LED-300',1),/equipment_level_changed/);
  await assert.rejects(()=>equip(freshUser,8,'LED-300'),/production_invalid_tent/);
  await assert.rejects(()=>db.query("INSERT INTO kq_player_equipment(user_id,tent_number,equipment_code,purchase_price_cents) VALUES($1,2,'LED-300',1)",[freshUser]),/equipment_shared_installation_only/);
  await assert.rejects(()=>db.query("INSERT INTO kq_equipment_loadouts(user_id,tent_number,slot,equipment_code) VALUES($1,2,'lighting','LED-300')",[freshUser]),/equipment_shared_installation_only/);
  for(const units of [2,3])await expand(freshUser,units,30000);
  const preWarehouseProfile=await profile(freshUser),preWarehouseLoadout=await loadout(freshUser),preWarehouseWallet=await wallet(freshUser);
  const warehouse=await expand(freshUser,4,2120000);
  assert.equal(warehouse.productionUnits,8);assert.equal((await wallet(freshUser)).cash_cents,preWarehouseWallet.cash_cents-2120000);
  assert.deepEqual(await profile(freshUser),preWarehouseProfile);assert.deepEqual(await loadout(freshUser),preWarehouseLoadout);
  await assert.rejects(()=>expand(freshUser,8,30000),/production_max_units/);

  // All eight profiles repeat the shared culture equipment; processing remains separate.
  const state=await snapshot(freshUser,{global:true,scope:true});
  assert.equal(state.equipment.tents.length,8);
  assert.ok(state.equipment.tents.every(t=>JSON.stringify(t.codes)===JSON.stringify(state.equipment.codes)));
  assert.ok(!state.equipment.codes.includes('WASHER-25L')&&state.equipment.shared.codes.includes('WASHER-25L'));
  const stale=structuredClone(state);stale.equipment.tents[7].levels['LED-300']=1;
  await assert.rejects(()=>start(freshUser,stale),/kq_culture_equipment_changed/);
  const wrongCodes=structuredClone(state);wrongCodes.equipment.tents[1].codes=wrongCodes.equipment.tents[1].codes.filter(code=>code!=='AIR-EC6');
  await assert.rejects(()=>start(freshUser,wrongCodes),/kq_culture_equipment_changed/);
  const noScope=structuredClone(state);delete noScope.equipment.scope;
  await assert.rejects(()=>start(freshUser,noScope),/kq_culture_equipment_changed/);
  const run=await start(freshUser,state);
  await assert.rejects(()=>db.query("UPDATE kq_runs SET state=jsonb_set(state,'{equipment,scope}','\"tent\"') WHERE id=$1",[run]),/kq_energy_quote_immutable/);
  await assert.rejects(()=>replace(freshUser,2,'LED-300',0,1),/culture_equipment_active_run/);
  const beforeFinish=await wallet(freshUser);
  await finish(run);
  const currentInvoice=await invoice(run);
  assert.equal(currentInvoice.dog_care.foodCents,800,'One global dog at eight tents');
  assert.equal(currentInvoice.total_cents,603*8+800,'Frozen full capacity electricity is preserved');
  assert.equal((await wallet(freshUser)).cash_cents,beforeFinish.cash_cents-800);
  for(const [code,wear] of [['LED-300',5],['AIR-EC6',3],['SOLAR-BACKUP',2],['DRYING-ROOM',2],['CLIMATE-SMART',2]]){
    assert.equal((await owned(freshUser,code)).culture_wear_percent,wear,code+' wears once');
    assert.equal((await owned(freshUser,code)).culture_wear_version,1);
  }
  assert.equal((await owned(freshUser,'WASHER-25L')).wear_cycles,1);
  assert.equal((await owned(freshUser,'PRESS-0600')).wear_cycles,1);
  const receipt=(await one('SELECT equipment FROM kq_culture_equipment_wear_receipts WHERE run_id=$1',[run])).equipment;
  assert.equal(receipt.length,new Set(receipt.map(item=>item.equipmentCode)).size);
  assert.ok(receipt.every(item=>item.tentNumber===1));
  const completedProfile=await profile(freshUser);await finish(run);assert.deepEqual(await profile(freshUser),completedProfile);

  // Replacement/maintenance reset one due model, keep its level, and reject stale tokens.
  await db.query("UPDATE kq_player_equipment SET culture_wear_percent=100,culture_wear_version=8 WHERE user_id=$1 AND equipment_code='LED-300'",[freshUser]);
  const replacementCost=Math.ceil((await price('LED-300'))*1.1),replacementKey=randomUUID();
  await assert.rejects(()=>replace(freshUser,2,'LED-300',7,replacementCost),/culture_equipment_condition_changed/);
  const replaced=await replace(freshUser,2,'LED-300',8,replacementCost,replacementKey);
  assert.equal(replaced.tentNumber,1);assert.equal(replaced.level,2);
  assert.equal((await owned(freshUser,'LED-300')).culture_wear_percent,0);
  assert.equal((await owned(freshUser,'LED-300')).culture_wear_version,9);
  assert.deepEqual(await replace(freshUser,8,'LED-300',8,replacementCost,replacementKey),{...replaced,replayed:true});
  await db.query("UPDATE kq_player_equipment SET wear_cycles=kq_machine_interval(equipment_code,level),maintenance_version=7 WHERE user_id=$1 AND equipment_code='WASHER-25L'",[freshUser]);
  const repairKey=randomUUID(),repair=await rpc("rpc_kq_repair_tent_machine($1,'WASHER-25L',7,20000,$2,8)",[freshUser,repairKey]);
  assert.equal(repair.tentNumber,1);assert.equal((await owned(freshUser,'WASHER-25L')).wear_cycles,0);
  assert.equal((await rpc("rpc_kq_repair_tent_machine($1,'WASHER-25L',7,20000,$2,1)",[freshUser,repairKey])).replayed,true);
  assert.equal((await rpc('rpc_kq_energy_snapshot($1)',[freshUser])).dogCare.foodCents,800);
  // Legacy API entry points are global too: fleet size cannot reintroduce duplicate purchases.
  const wrapperPurchase=await rpc("rpc_kq_purchase_equipment($1,$2,ARRAY['TENT-120'])",[freshUser,randomUUID()]);
  assert.equal(wrapperPurchase.tentNumber,1);
  assert.equal((await rpc("rpc_kq_equip_durable($1,'TENT-120')",[freshUser])).tentNumber,1);
  assert.equal((await rpc("rpc_kq_upgrade_equipment($1,$2,'AIR-EC6',1)",[freshUser,randomUUID()])).level,2);
  assert.equal((await rpc("rpc_kq_replace_culture_equipment($1,'LED-300',8,$2,$3)",[freshUser,replacementCost,replacementKey])).replayed,true);
  assert.equal((await rpc("rpc_kq_repair_machine($1,'WASHER-25L',7,20000,$2)",[freshUser,repairKey])).replayed,true);
  // An adopted dog still needs care when the camera occupies the security slot.
  await buy(freshUser,2,['SECURITY-CAMERA']);await equip(freshUser,2,'SECURITY-CAMERA');
  const cameraState=await snapshot(freshUser,{global:true,scope:true});
  assert.ok(cameraState.equipment.tents.every(t=>t.codes.includes('SECURITY-CAMERA')&&!t.codes.includes('SECURITY-DOG')));
  assert.equal((await rpc('rpc_kq_energy_snapshot($1)',[freshUser])).dogCare?.foodCents,800,'Owned dog appears in the care preview even with a camera installed');
  const cameraWallet=await wallet(freshUser),cameraRun=await start(freshUser,cameraState);
  await finish(cameraRun);
  assert.equal((await invoice(cameraRun)).dog_care?.foodCents,800,'An owned dog is charged once even when not installed');
  assert.equal((await invoice(cameraRun)).total_cents,603*8+800);
  assert.equal((await wallet(freshUser)).cash_cents,cameraWallet.cash_cents-800);
  assert.equal(await rpc("kq_is_shared_processing_equipment('LED-300')"),false);
  assert.equal(await rpc("kq_is_shared_processing_equipment('WASHER-25L')"),true);
  for(const role of ['anon','authenticated','service_role']){
    assert.equal(await rpc("has_function_privilege($1,'kq_equipment_storage_tent(text,integer)','EXECUTE')",[role]),false);
    assert.equal(await rpc("has_function_privilege($1,'rpc_kq_replace_tent_culture_equipment(uuid,text,integer,integer,uuid,integer)','EXECUTE')",[role]),role==='service_role');
  }
  console.log('Shared installation PostgreSQL passed: conservative global merge, unchanged wallets/receipts/assets/frozen runs, atomic purchases and replay, canonical upgrades/replacement/maintenance, expansion without resetting equipment, new eight-tent snapshot and one wear/dog charge, legacy cycles, stale guards and ACLs.');
} catch(error) {
  console.error(error.message);
  if(error.where)console.error(error.where);
  if(error.stack)console.error(error.stack.split('\n').slice(1,3).join('\n'));
  process.exitCode=1;
} finally { await db.close(); }
