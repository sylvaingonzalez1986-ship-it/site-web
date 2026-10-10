// Local PostgreSQL integration only: no environment files, credentials or network.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';
const db=new PGlite();
const vite=await createServer({configFile:false,envDir:false,resolve:{alias:{'@':path.resolve('src')}},server:{middlewareMode:true,watch:null}});
const scalar=async(query,values=[])=>Object.values((await db.query(query,values)).rows[0])[0];
const sql=name=>readFile(path.resolve('supabase/migrations',name),'utf8');
let checks=0;
const equal=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks++;};
const reject=async(name,fn,match)=>{await assert.rejects(fn,error=>error.message.includes(match),name);checks++;};
const storage=owner=>scalar('SELECT rpc_kq_storage_state($1)',[owner]);
const command=(owner,action,args={},key=randomUUID())=>scalar('SELECT rpc_kq_storage_capacity_command($1,$2,$3,$4,$5,$6,$7)',[owner,action,args.methodCode??null,args.containerCode??null,args.quantity??null,args.flowerId??null,key]);
const commerce=(owner,action,payload,key=randomUUID())=>scalar('SELECT rpc_kq_commerce_command($1,$2,$3::jsonb,$4)',[owner,action,JSON.stringify(payload),key]);
try {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
 CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY,code TEXT,description TEXT,updated_at TIMESTAMPTZ);
 CREATE TABLE kq_support_card_rules(card_definition_id UUID,advantage TEXT,rules_version INTEGER,updated_at TIMESTAMPTZ);
 CREATE TABLE kq_runs(id UUID PRIMARY KEY,user_id UUID,state JSONB,status TEXT,started_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ);
 CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT,run_id UUID,variety_code TEXT DEFAULT 'KQ-VAR-001',variety_name TEXT DEFAULT 'Test',
  battle_stats JSONB DEFAULT '{"appearance":90,"aroma":90,"vigor":90,"mastery":90,"regularity":90}',created_at TIMESTAMPTZ DEFAULT now(),burned_at TIMESTAMPTZ);
 CREATE TABLE kq_battles(flower_one_id UUID,flower_two_id UUID,status TEXT,rounds JSONB,verdict_at TIMESTAMPTZ);
 CREATE TABLE kq_bot_battles(flower_id UUID,rounds JSONB,verdict_at TIMESTAMPTZ);
 CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY,cash_cents INTEGER NOT NULL DEFAULT 0 CHECK(cash_cents>=0),
  reputation INTEGER NOT NULL DEFAULT 0,planned_route_code TEXT,planned_equipment_code TEXT,updated_at TIMESTAMPTZ DEFAULT now());
 CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS
  'INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING';
 CREATE TABLE kq_equipment_loadouts(user_id UUID,equipment_code TEXT);
 CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
  PERFORM rpc_kq_ensure_equipment_profile(p_user); PERFORM 1 FROM kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
 END $$;
 CREATE FUNCTION kq_business_sale_preview(p_user UUID,p_payout INTEGER) RETURNS JSONB LANGUAGE sql AS
  $$ SELECT jsonb_build_object('vatCents',round(p_payout::NUMERIC/6),'labPaidCents',0,'electricityPaidCents',0,'netPayoutCents',p_payout-round(p_payout::NUMERIC/6)) $$;
 CREATE FUNCTION kq_business_collect_sale(p_user UUID,p_payout INTEGER) RETURNS JSONB LANGUAGE plpgsql AS $$
 DECLARE charges JSONB; BEGIN charges:=kq_business_sale_preview(p_user,p_payout);
 UPDATE kq_equipment_wallets SET cash_cents=cash_cents-(charges->>'vatCents')::INTEGER WHERE user_id=p_user; RETURN charges; END $$;
 `);
 for(const name of ['20260830000200_kq_post_harvest_market.sql','20260904000200_kq_route_masteries.sql','20260905000100_kq_route_expertise_rewards.sql',
 '20260909000100_kq_quality_reputation.sql','20260911000300_kq_cycle_electricity.sql','20260912000200_kq_living_market.sql',
 '20260913000100_kq_sales_channels.sql','20260913000200_kq_commerce_completed_at.sql','20260913000300_kq_commerce_mastery_guards.sql',
 '20260913000400_kq_shop_partners.sql','20260914000500_kq_shop_offer_precision.sql','20261010000200_storage_curing.sql']) await db.exec(await sql(name));
 await db.exec('ALTER TABLE kq_market_sale_receipts ADD COLUMN vat_cents INTEGER DEFAULT 0,ADD COLUMN lab_paid_cents INTEGER DEFAULT 0;');
 const engine=await vite.ssrLoadModule('/src/lib/kanab-quest-storage.ts');
 const {quoteKqMarketRoutes}=await vite.ssrLoadModule('/src/lib/kanab-quest-market.ts');
 const {quoteKqCommerce}=await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts');
 async function player(){const id=randomUUID();await db.query('INSERT INTO auth.users VALUES($1)',[id]);await storage(id);await db.query('UPDATE kq_equipment_wallets SET cash_cents=1000000,reputation=1500 WHERE user_id=$1',[id]);return id;}
 async function harvest(owner,grams=120){
  const run=randomUUID(),flower=randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,$3,'completed',now()-interval '2 days')",[run,owner,JSON.stringify({harvestGrams:grams,care:{terpenes:90,cannabinoidExpression:90,cannabinoidConversion:5,cannabinoidOxidation:0}})]);
  await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,'burned',now())",[flower,owner,run]);
  await db.query("INSERT INTO kq_bot_battles VALUES($1,'[{\"playerScore\":90,\"opponentScore\":80}]',now())",[flower]);
  return flower;
 }
 // Seed an already transformed beta lot before migration: only it receives help.
 const legacy=await player(),legacyFlower=await harvest(legacy,250);
 const legacyState=(await storage(legacy)).lots[0];
 const oldOptions=quoteKqMarketRoutes({juryScore:9,harvestGrams:250,equipmentCodes:[]}).map(o=>({...o,storageRevision:legacyState.revision,storageChangeAt:engine.projectKqStorageLot(legacyState.state,Date.now()).nextChangeAt}));
 await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,250,9,'signature',ARRAY[]::TEXT[],$3::jsonb)",[legacy,legacyFlower,JSON.stringify(oldOptions)]);
 await commerce(legacy,'prepare',{flowerId:legacyFlower,route:'raw',expectedCostCents:0});
 const historicRaw=await harvest(legacy,300);
 const historicMissing=await harvest(legacy,120);
 await db.query("UPDATE kq_runs SET state=state-'harvestGrams' WHERE id=(SELECT run_id FROM kq_flowers WHERE id=$1)",[historicMissing]);
 await db.exec(await sql('20261010000300_storage_capacity.sql'));
 const upgraded=await storage(legacy);
 equal('legacy prepared mass preserved',upgraded.lots.find(l=>l.flowerId===legacyFlower).state.capacity.totalUnits,2500);
 equal('legacy prepared stock is fully reserved',engine.projectKqStorageCapacity(upgraded.lots.find(l=>l.flowerId===legacyFlower).state.capacity,Date.now()).overflowUnits,0);
 equal('migration grants only prepared coverage',upgraded.ownedContainers['GLASS-1L'],5);
 equal('raw history gets no free extra containers',engine.projectKqStorageCapacity(upgraded.lots.find(l=>l.flowerId===historicRaw).state.capacity,Date.now()).overflowUnits,3000);
 equal('historical grace starts on migration',Date.parse(upgraded.lots.find(l=>l.flowerId===historicRaw).state.capacity.overflowDeadlineAt)>Date.parse(upgraded.serverNow)+86_000_000,true);
 equal('old runs without stored weight retain their calculated harvest',upgraded.lots.find(l=>l.flowerId===historicMissing).state.capacity.totalUnits,760);
 await scalar('SELECT kq_storage_initialize($1)',[legacy]);
 equal('initialization cannot replay migration grants',(await storage(legacy)).ownedContainers['GLASS-1L'],5);
 const beforeCuringUpgrade=await scalar('SELECT jsonb_agg(to_jsonb(s) ORDER BY flower_id) FROM kq_storage_lots s');
 await db.exec(await sql('20261010000700_storage_curing_six_hours.sql'));
 const afterCuringUpgrade=await scalar('SELECT jsonb_agg(to_jsonb(s) ORDER BY flower_id) FROM kq_storage_lots s');
 for(const [index,before] of beforeCuringUpgrade.entries()) {
  const after=afterCuringUpgrade[index];
  equal('curing upgrade preserves capacity, exposure and history '+before.flower_id,{...after,revision:before.revision,state:{...after.state,readyAt:before.state.readyAt}},before);
  equal('curing upgrade invalidates existing capacity quotes '+before.flower_id,after.revision,before.revision+1);
  equal('curing upgrade uses original verdict '+before.flower_id,Date.parse(after.state.readyAt)-Date.parse(before.state.curingStartedAt),6*3_600_000);
 }
 // The next migration shortens historical overflow grace without selling it.
 const overdueOwner=await player(),overdueFlower=await harvest(overdueOwner,150);
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state||jsonb_build_object('curingStartedAt',now()-interval '2 hours','lastSettledAt',now()-interval '2 hours','readyAt',now()+interval '4 hours'),'{capacity,overflowDeadlineAt}',to_jsonb(now()+interval '22 hours')) WHERE flower_id=$1",[overdueFlower]);
 const shorterOwner=await player(),shorterFlower=await harvest(shorterOwner);
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,overflowDeadlineAt}',to_jsonb((state->>'curingStartedAt')::timestamptz+interval '30 minutes')) WHERE flower_id=$1",[shorterFlower]);
 const currentOwner=await player(),currentFlower=await harvest(currentOwner);
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,overflowDeadlineAt}',to_jsonb((state->>'curingStartedAt')::timestamptz+interval '1 hour')) WHERE flower_id=$1",[currentFlower]);
 const beforeOverflowUpgrade=await scalar('SELECT jsonb_agg(to_jsonb(s) ORDER BY flower_id) FROM kq_storage_lots s');
 const cashBeforeOverflowUpgrade=await scalar('SELECT jsonb_agg(to_jsonb(w) ORDER BY user_id) FROM kq_equipment_wallets w');
 await db.exec(await sql('20261010000800_storage_overflow_one_hour.sql'));
 const afterOverflowUpgrade=await scalar('SELECT jsonb_agg(to_jsonb(s) ORDER BY flower_id) FROM kq_storage_lots s');
 for(const [index,before] of beforeOverflowUpgrade.entries()) {
  const after=afterOverflowUpgrade[index],oldDeadline=Date.parse(before.state.capacity.overflowDeadlineAt);
  const verdictDeadline=Date.parse(before.state.curingStartedAt)+3_600_000,changed=oldDeadline>verdictDeadline;
  equal('overflow upgrade preserves curing, reservations and quality '+before.flower_id,{...after,revision:before.revision,state:{...after.state,capacity:{...after.state.capacity,overflowDeadlineAt:before.state.capacity.overflowDeadlineAt}}},before);
  equal('overflow upgrade only changes affected revisions '+before.flower_id,after.revision,before.revision+(changed?1:0));
  equal('overflow upgrade never restarts or extends deadline '+before.flower_id,Date.parse(after.state.capacity.overflowDeadlineAt),Math.min(oldDeadline,verdictDeadline));
 }
 equal('overflow migration does not touch wallets',await scalar('SELECT jsonb_agg(to_jsonb(w) ORDER BY user_id) FROM kq_equipment_wallets w'),cashBeforeOverflowUpgrade);
 equal('overflow migration never initiates a sale',Number(await scalar('SELECT count(*) FROM kq_storage_overflow_sales')),0);
 const overdueMigrated=afterOverflowUpgrade.find(s=>s.flower_id===overdueFlower);
 equal('elapsed hour is not restarted for old surplus',Date.parse(overdueMigrated.state.capacity.overflowDeadlineAt)<Date.now(),true);
 const oldOverdueRevision=beforeOverflowUpgrade.find(s=>s.flower_id===overdueFlower).revision;
 await reject('overflow migration invalidates stale offers',()=>scalar("SELECT kq_storage_check_offer($1,$2,9,$3,now()+interval '1 hour','wholesale')",[overdueOwner,overdueFlower,oldOverdueRevision]),'commerce_storage_changed');
 await db.exec(await sql('20261010000800_storage_overflow_one_hour.sql'));
 equal('overflow migration replay leaves state and revisions unchanged',await scalar('SELECT jsonb_agg(to_jsonb(s) ORDER BY flower_id) FROM kq_storage_lots s'),afterOverflowUpgrade);
 equal('normal worker settles migrated overdue surplus',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,1);
 const overdueSettled=await storage(overdueOwner);
 equal('migrated overdue sale protects contained 100 grams',overdueSettled.lots[0].state.capacity.totalUnits,1000);
 equal('migrated overdue sale only sells loose 50 grams',overdueSettled.overflowSales[0].units,500);
 equal('migrated overdue sale preserves six-hour curing',overdueSettled.lots[0].state.readyAt,overdueMigrated.state.readyAt);
 equal('migrated overdue sale remains idempotent',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,0);
 // Freeze PostgreSQL time: no sale at 59m59.999s; sale at exactly one hour.
 await db.exec('BEGIN');
 const boundaryOwner=await player(),boundaryFlower=await harvest(boundaryOwner,150);
 const earlyBuyer=await player(),earlyFlower=await harvest(earlyBuyer,150);
 const lateBuyer=await player(),lateFlower=await harvest(lateBuyer,150);
 async function setVerdictAge(flower,elapsedMs) {
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state||jsonb_build_object('curingStartedAt',now()-$2*interval '1 millisecond','lastSettledAt',now()-$2*interval '1 millisecond','readyAt',now()-$2*interval '1 millisecond'+interval '6 hours'),'{capacity,overflowDeadlineAt}',to_jsonb(now()-$2*interval '1 millisecond'+interval '1 hour')) WHERE flower_id=$1",[flower,elapsedMs]);
 }
 await setVerdictAge(boundaryFlower,3_600_000-1);
 await setVerdictAge(earlyFlower,3_600_000-1);
 equal('no automatic sale one millisecond before one hour',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,0);
 const earlyPurchase=await command(earlyBuyer,'buy',{containerCode:'GLASS-1L',quantity:1});
 equal('purchase just before deadline saves loose harvest',earlyPurchase.lots[0].state.capacity.totalUnits,1500);
 equal('purchase just before deadline protects all harvest',earlyPurchase.capacity.overflowUnits,0);
 equal('purchase just before deadline does not sell',earlyPurchase.overflowSales,[]);
 await setVerdictAge(boundaryFlower,3_600_000);
 const boundaryBefore=await scalar('SELECT state FROM kq_storage_lots WHERE flower_id=$1',[boundaryFlower]);
 equal('automatic sale at exactly one real hour',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,1);
 const boundarySold=await storage(boundaryOwner);
 equal('one-hour sale is automatic',boundarySold.overflowSales[0].automatic,true);
 equal('one-hour sale goes to wholesale',await scalar('SELECT sales_channel FROM kq_market_sale_receipts WHERE flower_id=$1',[boundaryFlower]),'wholesale');
 equal('one-hour sale preserves protected containers',boundarySold.lots[0].state.capacity.allocations,boundaryBefore.capacity.allocations);
 equal('one-hour sale keeps original jury quality',boundarySold.lots[0].state.baseline,boundaryBefore.baseline);
 equal('one-hour sale does not finish curing',engine.projectKqStorageLot(boundarySold.lots[0].state,Date.parse(boundarySold.serverNow)).stage,'curing');
 equal('one-hour sale retains six-hour deadline',boundarySold.lots[0].state.readyAt,boundaryBefore.readyAt);
 await setVerdictAge(lateFlower,3_600_000+1);
 const lateKey=randomUUID(),latePurchase=await command(lateBuyer,'buy',{containerCode:'GLASS-1L',quantity:1},lateKey);
 equal('late purchase settles overflow before adding container',latePurchase.lots[0].state.capacity.totalUnits,1000);
 equal('late purchase sells only loose harvest',latePurchase.overflowSales[0].units,500);
 equal('late purchase sale remains automatic',latePurchase.overflowSales[0].automatic,true);
 equal('late purchase credits sale and debits container once',latePurchase.cashCents,1_000_000+2250-500);
 const lateReplay=await command(lateBuyer,'buy',{containerCode:'GLASS-1L',quantity:1},lateKey);
 equal('late purchase replay is recognized',lateReplay.replayed,true);
 equal('late purchase replay never duplicates sale',lateReplay.overflowSales.length,1);
 equal('late purchase replay never changes cash',lateReplay.cashCents,latePurchase.cashCents);
 equal('one-hour worker replay has no further sale',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,0);
 await db.exec('COMMIT');
 for(const product of engine.KQ_STORAGE_CONTAINERS){
  equal(product.code+' catalogue parity',await scalar('SELECT kq_storage_container($1)',[product.code]),{methodCode:product.methodCode,capacityUnits:product.capacityUnits,priceCents:product.priceCents});
 }
 const owner=await player(),outsider=await player();
 equal('starter two glass jars',(await storage(owner)).ownedContainers,{'GLASS-1L':2});
 equal('starter exactly 100 grams',(await storage(owner)).capacity,{totalUnits:1000,usedUnits:0,freeUnits:1000,reservedUnits:0,overflowUnits:0});
 const racing=await player();
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=500 WHERE user_id=$1',[racing]);
 const race=await Promise.allSettled([command(racing,'buy',{containerCode:'GLASS-1L',quantity:1}),command(racing,'buy',{containerCode:'GLASS-1L',quantity:1})]);
 equal('parallel purchases cannot overspend',race.filter(r=>r.status==='fulfilled').length,1);
 equal('parallel purchases grant exactly one jar',(await storage(racing)).ownedContainers['GLASS-1L'],3);
 const rollback=await player();
 await db.exec(`CREATE FUNCTION reject_container_fixture() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_abort'; END $$;
  CREATE TRIGGER reject_container_fixture BEFORE INSERT OR UPDATE ON kq_storage_containers FOR EACH ROW EXECUTE FUNCTION reject_container_fixture();`);
 await reject('inventory failure rolls back debit',()=>command(rollback,'buy',{containerCode:'GLASS-2L',quantity:2}),'fixture_abort');
 await db.exec('DROP TRIGGER reject_container_fixture ON kq_storage_containers; DROP FUNCTION reject_container_fixture();');
 equal('failed purchase leaves wallet intact',(await storage(rollback)).cashCents,1000000);
 equal('failed purchase creates no containers',(await storage(rollback)).ownedContainers,{'GLASS-1L':2});
 const first=await harvest(owner),firstLot=(await storage(owner)).lots.find(l=>l.flowerId===first);
 equal('post-duel timer retained',Date.parse(firstLot.state.readyAt)-Date.parse(firstLot.state.curingStartedAt),engine.KQ_CURING_DURATION_MS);
 equal('one real hour from verdict deadline',Date.parse(firstLot.state.capacity.overflowDeadlineAt)-Date.parse(firstLot.state.curingStartedAt),3_600_000);
 equal('only 100 grams protected',firstLot.state.capacity.allocations,[{containerCode:'GLASS-1L',quantity:2,storedUnits:1000}]);
 equal('20 grams surplus',(await storage(owner)).capacity.overflowUnits,200);
 equal('manual surplus offer taxes',firstLot.overflowOffer.netPayoutCents,900);
 await reject('foreign lot cannot be reassigned',()=>command(outsider,'assign',{methodCode:'STORAGE-GLASS',flowerId:first}),'storage_lot_unavailable');
 const options=quoteKqMarketRoutes({juryScore:9,harvestGrams:120,equipmentCodes:[]}).map(o=>({...o,storageRevision:firstLot.revision,storageChangeAt:engine.projectKqStorageLot(firstLot.state,Date.now()).nextChangeAt}));
 await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,120,9,'signature',ARRAY[]::TEXT[],$3::jsonb)",[owner,first,JSON.stringify(options)]);
 await reject('unprotected fraction cannot bypass by preparation',()=>commerce(owner,'prepare',{flowerId:first,route:'raw',expectedCostCents:0}),'commerce_storage_overflow');
 const key=randomUUID();
 await command(owner,'buy',{containerCode:'GLASS-1L',quantity:2},key);
 equal('quantity charged once',(await storage(owner)).cashCents,999000);
 equal('repeated jars allowed',(await storage(owner)).ownedContainers['GLASS-1L'],4);
 equal('purchase fills existing surplus',(await storage(owner)).capacity.overflowUnits,0);
 equal('purchase replay',(await command(owner,'buy',{containerCode:'GLASS-1L',quantity:2},key)).replayed,true);
 equal('replay unchanged cash',(await storage(owner)).cashCents,999000);
 await reject('request payload mismatch',()=>command(owner,'buy',{containerCode:'GLASS-1L',quantity:1},key),'storage_request_mismatch');
 for(const quantity of [0,-1,1001]) await reject('invalid quantity '+quantity,()=>command(owner,'buy',{containerCode:'GLASS-1L',quantity}),'storage_invalid_request');
 equal('purchase preserves maturity',(await storage(owner)).lots.find(l=>l.flowerId===first).state.readyAt,firstLot.state.readyAt);
 const second=await harvest(owner,60);
 equal('partially filled jars cannot hold another harvest',(await storage(owner)).capacity.overflowUnits,100);
 const manualKey=randomUUID(),beforeSale=(await storage(owner)).cashCents;
 let sold=await command(owner,'sell-overflow',{flowerId:second},manualKey);
 equal('manual sells only surplus',sold.overflowSales[0].units,100);
 equal('manual receipt marked',sold.overflowSales[0].automatic,false);
 equal('sale collects real business deductions',sold.cashCents-beforeSale,450);
 equal('protected second lot remains',sold.lots.find(l=>l.flowerId===second).state.capacity.totalUnits,500);
 await command(owner,'sell-overflow',{flowerId:second},manualKey);
 equal('manual idempotent once',(await storage(owner)).overflowSales.length,1);
 equal('original harvested mass kept',Number(await scalar("SELECT (state->>'harvestGrams')::NUMERIC FROM kq_runs WHERE id=(SELECT run_id FROM kq_flowers WHERE id=$1)",[second])),60);
 const third=await harvest(owner,20),thirdState=(await storage(owner)).lots.find(l=>l.flowerId===third).state;
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,overflowDeadlineAt}',to_jsonb(now()-interval '1 millisecond')) WHERE flower_id=$1",[third]);
 const autoBuy=await command(owner,'buy',{containerCode:'GLASS-1L',quantity:1});
 equal('buy after deadline cannot rescue expired surplus',autoBuy.overflowSales[0].flowerId,third);
 equal('expired whole lot sold once',autoBuy.overflowSales[0].automatic,true);
 equal('sold mass removed from raw commerce',(await scalar('SELECT rpc_kq_commerce_state($1)',[owner])).rawFlowerIds.includes(third),false);
 equal('sale never changes jury timer',(await scalar('SELECT state FROM kq_storage_lots WHERE flower_id=$1',[third])).readyAt,thirdState.readyAt);
 equal('global cron replay no duplicate',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,0);
 const offline=await player(),offlineFlower=await harvest(offline,150);
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,overflowDeadlineAt}',to_jsonb(now()-interval '1 millisecond')) WHERE flower_id=$1",[offlineFlower]);
 equal('cron settles absent player',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,1);
 equal('cron settles only unprotected 50g',(await storage(offline)).overflowSales[0].units,500);
 equal('cron retains protected harvest',(await storage(offline)).lots[0].state.capacity.totalUnits,1000);
 await reject('stale pre-expiry preview cannot reinsert sold grams',()=>scalar("SELECT rpc_kq_prepare_market_lot($1,$2,150,9,'signature',ARRAY[]::TEXT[],'[]'::jsonb)",[offline,offlineFlower]),'commerce_storage_changed');
 await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,100,9,'signature',ARRAY[]::TEXT[],'[]'::jsonb)",[offline,offlineFlower]);
 await db.query('UPDATE kq_market_lots SET harvest_grams=150 WHERE flower_id=$1',[offlineFlower]);
 await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,100,9,'signature',ARRAY[]::TEXT[],'[]'::jsonb)",[offline,offlineFlower]);
 equal('fresh preview repairs stale ready-row weight',Number(await scalar('SELECT harvest_grams FROM kq_market_lots WHERE flower_id=$1',[offlineFlower])),100);
 equal('repeated cron cannot resell',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,0);
 const badUser=await player(),goodUser=await player(),badFlower=await harvest(badUser,110),goodFlower=await harvest(goodUser,110);
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{capacity,overflowDeadlineAt}',to_jsonb(now()-interval '1 millisecond')) WHERE flower_id IN ($1,$2)",[badFlower,goodFlower]);
 await db.exec(`CREATE FUNCTION fail_one_storage_owner_fixture() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.user_id='${badUser}'::UUID THEN RAISE EXCEPTION 'fixture_owner_failure'; END IF; RETURN NEW; END $$;
  CREATE TRIGGER fail_one_storage_owner_fixture BEFORE INSERT ON kq_storage_overflow_sales FOR EACH ROW EXECUTE FUNCTION fail_one_storage_owner_fixture();`);
 const isolatedFailure=await scalar('SELECT rpc_kq_storage_settle_due(100)');
 equal('one broken account does not undo other cron sales',isolatedFailure.sales,1);
 equal('failed account count reported',isolatedFailure.failedUsers,1);
 equal('failed account wallet debit rolls back',Number(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[badUser])),1000000);
 equal('successful account sale committed',(await storage(goodUser)).overflowSales.length,1);
 await db.exec('DROP TRIGGER fail_one_storage_owner_fixture ON kq_storage_overflow_sales; DROP FUNCTION fail_one_storage_owner_fixture();');
 equal('failed account succeeds next sweep',(await scalar('SELECT rpc_kq_storage_settle_due(100)')).sales,1);
 await reject('outsider cannot manually sell overflow',()=>command(outsider,'sell-overflow',{flowerId:offlineFlower}),'storage_lot_unavailable');
 // Weighted quality: one high-tech container never protects unallocated mass.
 await command(owner,'buy',{containerCode:'CVAULT-2OZ',quantity:1});
 await command(owner,'assign',{methodCode:'STORAGE-CVAULT',flowerId:first});
 const mixed=(await storage(owner)).lots.find(l=>l.flowerId===first).state;
 equal('mixed lot keeps all its mass',engine.projectKqStorageCapacity(mixed.capacity,Date.now()).protectedUnits,1200);
 equal('one premium container has limited volume',mixed.capacity.allocations.find(a=>a.containerCode==='CVAULT-2OZ').storedUnits,560);
 const evalTime=Date.parse(mixed.lastSettledAt)+100*14_400_000;
 const sqlCondition=await scalar('SELECT kq_storage_condition($1::jsonb,9,$2::timestamptz)',[JSON.stringify(mixed),new Date(evalTime).toISOString()]);
 equal('weighted exposure SQL and engine agree',sqlCondition.conditionScore,engine.projectKqStorageLot(mixed,evalTime,9).conditionScore);
 const pure=engine.planKqStorageAllocation({totalUnits:2400,ownedContainers:{'GLASS-3L':1,'GLASS-2L':1,'GLASS-1L':1},nowMs:Date.now()});
 const greedy=await player();await command(greedy,'buy',{containerCode:'GLASS-3L',quantity:1});await command(greedy,'buy',{containerCode:'GLASS-2L',quantity:1});
 const greedyFlower=await harvest(greedy,240);
 equal('packing prefers two useful formats',(await storage(greedy)).lots.find(l=>l.flowerId===greedyFlower).state.capacity.allocations,pure.allocations);
 const preserve=await player();await harvest(preserve,50);const preserveFlower=await harvest(preserve,126);
 await command(preserve,'buy',{containerCode:'CVAULT-2OZ',quantity:1});
 await command(preserve,'buy',{containerCode:'GLASS-1L',quantity:1});
 const protectedBefore=(await storage(preserve)).lots.find(l=>l.flowerId===preserveFlower).state.capacity.allocations;
 equal('merged glass allocation leaves premium mass protected',protectedBefore,[{containerCode:'GLASS-1L',quantity:2,storedUnits:700},{containerCode:'CVAULT-2OZ',quantity:1,storedUnits:560}]);
 await command(preserve,'buy',{containerCode:'GROVE-1OZ',quantity:1});
 equal('unrelated purchase never moves premium mass to glass',(await storage(preserve)).lots.find(l=>l.flowerId===preserveFlower).state.capacity.allocations,protectedBefore);
 // Finish first lot preparation, sell it in pieces, and release whole containers.
 async function prepareRaw(user,flower){
  const lot=(await storage(user)).lots.find(l=>l.flowerId===flower),grams=lot.state.capacity.totalUnits/10;
  const quotes=quoteKqMarketRoutes({juryScore:9,harvestGrams:grams,equipmentCodes:[]}).map(o=>({...o,storageRevision:lot.revision,storageChangeAt:engine.projectKqStorageLot(lot.state,Date.now()).nextChangeAt}));
  await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,$3,9,'signature',ARRAY[]::TEXT[],$4::jsonb)",[user,flower,grams,JSON.stringify(quotes)]);
  return commerce(user,'prepare',{flowerId:flower,route:'raw',expectedCostCents:0});
 }
 const prepared=await prepareRaw(owner,first);
 async function quoteAndSell(user,stockId,units){
  const current=await scalar('SELECT rpc_kq_commerce_state($1)',[user]),stock=current.stocks.find(s=>s.id===stockId);
  stock.storage=engine.projectKqStorageLot(stock.storageState,Date.now(),stock.juryScore);
  const offer=quoteKqCommerce(current,stock,'wholesale','advised',units,Date.now()),id=randomUUID();
  await db.query('INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at,storage_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)',[id,user,stockId,current.revision,current.campaign?.id,current.campaign?.revision,stock.remainingUnits,current.reputation,JSON.stringify(offer),stock.storage.nextChangeAt,stock.storageRevision]);
  return commerce(user,'sell',{quoteId:id,expectedPayoutCents:offer.payoutCents});
 }
 await quoteAndSell(owner,prepared.stockId,700);
 const partial=(await storage(owner)).lots.find(l=>l.flowerId===first);
 equal('partial stock sale reduces equivalent reservation',partial.state.capacity.totalUnits,500);
 equal('partial sale releases empty containers',partial.state.capacity.allocations.length,1);
 await quoteAndSell(owner,prepared.stockId,500);
 equal('fully sold lot leaves warehouse',(await storage(owner)).lots.find(l=>l.flowerId===first).marketStatus,'sold');
 equal('fully sold lot releases all containers',(await scalar('SELECT state FROM kq_storage_lots WHERE flower_id=$1',[first])).capacity.allocations,[]);
 // A derivative remains responsible for its raw flower equivalent, including rounding.
 const derivativeUser=await player(),derivativeFlower=await harvest(derivativeUser,100);
 const derivative=await prepareRaw(derivativeUser,derivativeFlower);
 await db.query("UPDATE kq_commerce_stock SET route='dry-sift',initial_units=137,remaining_units=137,equivalent_units=1000 WHERE id=$1",[derivative.stockId]);
 await db.query("UPDATE kq_commerce_batches SET route='dry-sift' WHERE flower_id=$1",[derivativeFlower]);
 await scalar('SELECT kq_storage_allocate($1)',[derivativeFlower]);
 equal('extraction volume cannot release source containers',(await storage(derivativeUser)).lots[0].state.capacity.totalUnits,1000);
 await quoteAndSell(derivativeUser,derivative.stockId,37);
 equal('fractional equivalents reserve conservatively',(await storage(derivativeUser)).lots[0].state.capacity.totalUnits,Math.ceil(1000*100/137));
 equal('fractional equivalent still occupies two jars',(await storage(derivativeUser)).lots[0].state.capacity.allocations[0].quantity,2);
 await quoteAndSell(derivativeUser,derivative.stockId,100);
 equal('derivative final sale frees source jars',(await storage(derivativeUser)).capacity.reservedUnits,0);
 // An excess sale leaving a very small protected remainder is still preparable.
 const tinyUser=await player(),tinyFlower=await harvest(tinyUser,10);
 equal('below old twenty-gram limit still preparable',(await prepareRaw(tinyUser,tinyFlower)).action,'prepare');
 for(const table of ['kq_storage_containers','kq_storage_overflow_sales']) for(const role of ['anon','authenticated','service_role']) equal(table+' '+role+' private',await scalar("SELECT has_table_privilege($1,$2,'INSERT,UPDATE,DELETE,SELECT')",[role,table]),false);
 equal('capacity command service grant',await scalar("SELECT has_function_privilege('service_role','rpc_kq_storage_capacity_command(uuid,text,text,text,integer,uuid,uuid)','EXECUTE')"),true);
 equal('old unlimited purchase disabled',await scalar("SELECT has_function_privilege('service_role','rpc_kq_storage_command(uuid,text,text,uuid,uuid)','EXECUTE')"),false);
 equal('cron unavailable to public',await scalar("SELECT has_function_privilege('anon','rpc_kq_storage_settle_due(integer)','EXECUTE')"),false);
 console.log(`Storage capacity SQL passed: ${checks} assertions.`);
} finally {await vite.close();await db.close();}
