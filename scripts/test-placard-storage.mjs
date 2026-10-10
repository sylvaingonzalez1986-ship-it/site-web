// Isolated PostgreSQL integration tests. No credentials or deployed writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";

const db = new PGlite();
const vite = await createServer({ configFile:false,envDir:false,resolve:{alias:{"@":path.resolve("src")}},server:{middlewareMode:true,watch:null} });
const sql = async name => readFile(path.resolve("supabase/migrations", name), "utf8");
const scalar = async (query,values=[]) => Object.values((await db.query(query,values)).rows[0])[0];
const checks=[];
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks.push(name);};
const reject=async(name,fn,match)=>{await assert.rejects(fn,error=>error.message.includes(match),name);checks.push(name);};
const user=randomUUID(),outsider=randomUUID();
const storage=(owner=user)=>scalar('SELECT rpc_kq_storage_state($1)',[owner]);
const command=(action,method,flower=null,key=randomUUID(),owner=user)=>scalar('SELECT rpc_kq_storage_command($1,$2,$3,$4,$5)',[owner,action,method,flower,key]);
const commerce=(action,payload,key=randomUUID())=>scalar('SELECT rpc_kq_commerce_command($1,$2,$3::jsonb,$4)',[user,action,JSON.stringify(payload),key]);
try {
 await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
  CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY,code TEXT,description TEXT,updated_at TIMESTAMPTZ);
  CREATE TABLE kq_support_card_rules(card_definition_id UUID,advantage TEXT,rules_version INTEGER,updated_at TIMESTAMPTZ);
  CREATE TABLE kq_runs(id UUID PRIMARY KEY,user_id UUID,state JSONB,status TEXT,started_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ);
  CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT,run_id UUID,variety_code TEXT DEFAULT 'KQ-VAR-001',
   variety_name TEXT DEFAULT 'Test',battle_stats JSONB DEFAULT '{"appearance":90,"aroma":90,"vigor":90,"mastery":90,"regularity":90}',
   created_at TIMESTAMPTZ DEFAULT now(),burned_at TIMESTAMPTZ);
  CREATE TABLE kq_battles(flower_one_id UUID,flower_two_id UUID,status TEXT,rounds JSONB,verdict_at TIMESTAMPTZ);
  CREATE TABLE kq_bot_battles(flower_id UUID,rounds JSONB,verdict_at TIMESTAMPTZ);
  CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY,cash_cents INTEGER NOT NULL DEFAULT 0 CHECK(cash_cents>=0),
   reputation INTEGER NOT NULL DEFAULT 0,planned_route_code TEXT,planned_equipment_code TEXT,updated_at TIMESTAMPTZ DEFAULT now());
  CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS
   'INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING';
  CREATE TABLE kq_equipment_loadouts(user_id UUID,equipment_code TEXT);
  CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
   PERFORM rpc_kq_ensure_equipment_profile(p_user);
   PERFORM 1 FROM kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
  END $$;
 `);
 for(const name of [
  '20260830000200_kq_post_harvest_market.sql','20260904000200_kq_route_masteries.sql','20260905000100_kq_route_expertise_rewards.sql',
  '20260909000100_kq_quality_reputation.sql','20260911000300_kq_cycle_electricity.sql','20260912000200_kq_living_market.sql',
  '20260913000100_kq_sales_channels.sql','20260913000200_kq_commerce_completed_at.sql','20260913000300_kq_commerce_mastery_guards.sql',
  '20260913000400_kq_shop_partners.sql','20260914000500_kq_shop_offer_precision.sql',
 ]) await db.exec(await sql(name));
 await db.exec(await sql('20261010000200_storage_curing.sql'));
 const {KQ_STORAGE_METHODS,createKqStorageLot,changeKqStorageMethod,projectKqStorageLot,isKqStorageLot}=await vite.ssrLoadModule('/src/lib/kanab-quest-storage.ts');
 const {quoteKqCommerce}=await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts');
 const {quoteKqMarketRoutes}=await vite.ssrLoadModule('/src/lib/kanab-quest-market.ts');
 const day=14400000;
 await db.query('INSERT INTO auth.users VALUES($1),($2)',[user,outsider]);
 // Upgrade previously stored timers without resetting elapsed time or aging.
 const legacyOwner=randomUUID();
 await db.query('INSERT INTO auth.users VALUES($1)',[legacyOwner]);
 const legacyLots=[];
 for(const [label,hoursAgo,durationHours] of [['mature',7,240],['curing',2,240],['shorter',1,3],['current',1,6]]) {
  const legacyRun=randomUUID(),legacyFlower=randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{}','completed',now()-interval '2 days')",[legacyRun,legacyOwner]);
  await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,'burned',now()-$4*interval '1 hour')",[legacyFlower,legacyOwner,legacyRun,hoursAgo]);
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(kq_storage_settle(state,(state->>'curingStartedAt')::timestamptz+interval '30 minutes'),'{readyAt}',to_jsonb((state->>'curingStartedAt')::timestamptz+$2*interval '1 hour')) WHERE flower_id=$1",[legacyFlower,durationHours]);
  legacyLots.push({label,flower:legacyFlower,before:await scalar('SELECT to_jsonb(s) FROM kq_storage_lots s WHERE flower_id=$1',[legacyFlower])});
 }
 await db.exec(await sql('20261010000700_storage_curing_six_hours.sql'));
 for(const fixture of legacyLots) {
  const after=await scalar('SELECT to_jsonb(s) FROM kq_storage_lots s WHERE flower_id=$1',[fixture.flower]);
  const changed=['mature','curing'].includes(fixture.label);
  check(`${fixture.label} migration preserves all other state`,{...after.state,readyAt:fixture.before.state.readyAt},fixture.before.state);
  check(`${fixture.label} migration revision`,after.revision,fixture.before.revision+(changed?1:0));
  check(`${fixture.label} migration deadline`,Date.parse(after.state.readyAt),changed?Date.parse(after.state.curingStartedAt)+6*3_600_000:Date.parse(fixture.before.state.readyAt));
  if(changed) {
   await reject(`${fixture.label} old quote revision rejected`,()=>scalar("SELECT kq_storage_check_offer($1,$2,9,$3,now()+interval '1 hour','wholesale')",[legacyOwner,fixture.flower,fixture.before.revision]),'commerce_storage_changed');
   const condition=await scalar('SELECT kq_storage_condition($1::jsonb,9,now())',[JSON.stringify(after.state)]);
   check(`${fixture.label} keeps elapsed curing`,condition.stage,fixture.label==='mature'?'ready':'curing');
  }
 }
 const migrated=await scalar('SELECT jsonb_agg(to_jsonb(s) ORDER BY flower_id) FROM kq_storage_lots s');
 await db.exec(await sql('20261010000700_storage_curing_six_hours.sql'));
 check('migration replay does not reset timers or revisions',await scalar('SELECT jsonb_agg(to_jsonb(s) ORDER BY flower_id) FROM kq_storage_lots s'),migrated);
 // Freeze transaction time to exercise the server sale guard at exactly six hours.
 await db.exec('BEGIN');
 const boundaryFlower=legacyLots[0].flower;
 await db.query("UPDATE kq_storage_lots SET state=state||jsonb_build_object('curingStartedAt',now()-interval '6 hours','lastSettledAt',now()-interval '6 hours','readyAt',now()+interval '1 millisecond') WHERE flower_id=$1",[boundaryFlower]);
 const boundaryRevision=await scalar('SELECT revision FROM kq_storage_lots WHERE flower_id=$1',[boundaryFlower]);
 await db.exec('SAVEPOINT before_boundary');
 await reject('retail blocked one millisecond before curing ends',()=>scalar("SELECT kq_storage_check_offer($1,$2,9,$3,now()+interval '1 hour','cbd-shop')",[legacyOwner,boundaryFlower,boundaryRevision]),'commerce_curing_required');
 await db.exec('ROLLBACK TO SAVEPOINT before_boundary');
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now())) WHERE flower_id=$1",[boundaryFlower]);
 check('retail allowed at exactly six hours',Number(await scalar("SELECT kq_storage_check_offer($1,$2,9,$3,now()+interval '1 hour','cbd-shop')",[legacyOwner,boundaryFlower,boundaryRevision])),9);
 await db.exec('ROLLBACK');
 check('fresh account free glass only',(await storage()).ownedMethodCodes,['STORAGE-GLASS']);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=200000,reputation=1500 WHERE user_id=$1',[user]);
 for(const method of KQ_STORAGE_METHODS) {
  const stored=await scalar('SELECT kq_storage_method($1)',[method.code]);
  check(`${method.code} server catalogue`,stored,{priceCents:method.priceCents,aromaRate:method.aromaRate,chemistryRate:method.chemistryRate});
 }
 const purchaseKey=randomUUID();
 await command('buy','STORAGE-GROVE',null,purchaseKey);
 check('purchase wallet debit',(await storage()).cashCents,197500);
 check('idempotent purchase',(await command('buy','STORAGE-GROVE',null,purchaseKey)).replayed,true);
 check('replay does not debit twice',(await storage()).cashCents,197500);
 await reject('idempotency mismatch',()=>command('buy','STORAGE-BOVEDA',null,purchaseKey),'storage_request_mismatch');
 await reject('owned method duplicate rejected',()=>command('buy','STORAGE-GROVE'),'storage_already_owned');
 await reject('unowned default denied',()=>command('select-default','STORAGE-CVAULT'),'storage_not_owned');
 await reject('outsider cannot afford purchase',()=>command('buy','STORAGE-CVAULT',null,randomUUID(),outsider),'storage_insufficient_cash');
 await reject('client cannot supply unknown method',()=>command('buy','EVIL'),'storage_invalid_request');
 const racingUser=randomUUID();
 await db.query('INSERT INTO auth.users VALUES($1)',[racingUser]);
 await storage(racingUser);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=5000 WHERE user_id=$1',[racingUser]);
 const racing=await Promise.allSettled([command('buy','STORAGE-GROVE',null,randomUUID(),racingUser),command('buy','STORAGE-BOVEDA',null,randomUUID(),racingUser)]);
 check('competing purchases cannot overspend',racing.filter(result=>result.status==='fulfilled').length,1);
 check('wallet never negative',(await storage(racingUser)).cashCents>=0,true);
 const rollbackCash=(await storage()).cashCents;
 await db.exec(`CREATE FUNCTION reject_storage_fixture() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_abort'; END $$;
  CREATE TRIGGER reject_storage_fixture BEFORE UPDATE ON kq_storage_accounts FOR EACH ROW EXECUTE FUNCTION reject_storage_fixture();`);
 await reject('installation failure rolls back earlier debit',()=>command('buy','STORAGE-BOVEDA'),'fixture_abort');
 check('wallet rolled back after late failure',(await storage()).cashCents,rollbackCash);
 await db.exec('DROP TRIGGER reject_storage_fixture ON kq_storage_accounts; DROP FUNCTION reject_storage_fixture();');
 await command('select-default','STORAGE-GROVE');
 const run=randomUUID(),flower=randomUUID();
 await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,$3,'completed',now()-interval '2 days')",[run,user,JSON.stringify({harvestGrams:120,care:{terpenes:90,cannabinoidExpression:90,cannabinoidConversion:5,cannabinoidOxidation:0}})]);
 await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status) VALUES($1,$2,$3,'available')",[flower,user,run]);
 check('no curing before verdict',(await storage()).lots.length,0);
 await db.query("UPDATE kq_flowers SET status='burned',burned_at=now() WHERE id=$1",[flower]);
 let lot=(await storage()).lots[0];
 check('verdict atomically creates storage',lot.flowerId,flower);
 check('stored state satisfies engine validator',isKqStorageLot(lot.state),true);
 check('default applies at verdict',lot.state.methodCode,'STORAGE-GROVE');
 check('six real hours starts after jury',Date.parse(lot.state.readyAt)-Date.parse(lot.state.curingStartedAt),6*3_600_000);
 check('harvest remains separate',Date.parse(lot.state.curingStartedAt)>Date.parse(lot.state.harvestedAt),true);
 check('missing verdict cannot invent a perfect score',lot.juryScore,null);
 await db.query("INSERT INTO kq_bot_battles VALUES($1,'[{\"playerScore\":67,\"opponentScore\":80}]',now())",[flower]);
 check('warehouse reads actual verdict before market preparation',(await storage()).lots[0].juryScore,6.7);
 const originalState=lot.state;
 await db.query("UPDATE kq_flowers SET status='burned',burned_at=now()+interval '1 day' WHERE id=$1",[flower]);
 check('repeated verdict cannot restart curing',(await storage()).lots[0].state,originalState);
 await reject('outsider cannot assign lot',()=>command('assign','STORAGE-GLASS',flower,randomUUID(),outsider),'storage_lot_unavailable');
 // Exact formula parity at boundaries, different installations, and upgrades.
 const base={varietyCode:'KQ-VAR-001',juryScore:9,aroma:90,care:{terpenes:90,cannabinoidExpression:90,cannabinoidConversion:5,cannabinoidOxidation:0}};
 const start=Date.parse('2026-01-01T00:00:00.000Z');
 for(const method of KQ_STORAGE_METHODS) for(const days of [0,(6*3_600_000-1)/day,1.5,(6*3_600_000+1)/day,14.99,15,59.99,60,61,180,960]) {
  const state=createKqStorageLot({flowerId:flower,harvestedAt:new Date(start).toISOString(),methodCode:method.code,baseline:base});
  const time=start+Math.round(days*day), expected=projectKqStorageLot(state,time);
  const actual=await scalar('SELECT kq_storage_condition($1::jsonb,9,$2::timestamptz)',[JSON.stringify(state),new Date(time).toISOString()]);
  check(`${method.code} ${days} days condition`,actual.conditionScore,expected.conditionScore);
  check(`${method.code} ${days} days stage`,actual.stage,expected.stage);
  check(`${method.code} ${days} days deadline`,Date.parse(actual.nextChangeAt),Date.parse(expected.nextChangeAt));
 }
 const now=Date.parse((await storage()).serverNow), past=now-90*day;
 const aged=createKqStorageLot({flowerId:flower,harvestedAt:new Date(past).toISOString(),baseline:base});
 await db.query('UPDATE kq_storage_lots SET state=$2::jsonb WHERE flower_id=$1',[flower,JSON.stringify(aged)]);
 const before=await storage();
 await command('assign','STORAGE-GROVE',flower);
 const upgraded=(await storage()).lots[0];
 check('switch increments revision',upgraded.revision,2);
 const switchedMs=Date.parse(upgraded.state.lastSettledAt);
 check('switch exposure exact parity',upgraded.state.exposure,changeKqStorageMethod(aged,'STORAGE-GROVE',switchedMs).exposure);
 check('upgrade never restores existing loss',projectKqStorageLot(upgraded.state,switchedMs).qualityLoss>=projectKqStorageLot(before.lots[0].state,Date.parse(before.serverNow)).qualityLoss,true);
 const rev=upgraded.revision;
 await command('assign','STORAGE-GROVE',flower);
 check('same installation preserves revision',(await storage()).lots[0].revision,rev);
 // Preparation consumes a fresh, storage-versioned option and creates shared
 // flower provenance for every fraction. Archives retain the original score.
 await scalar('SELECT rpc_kq_commerce_state($1)',[user]);
 await db.query("UPDATE kq_commerce_campaigns SET event='normal' WHERE user_id=$1",[user]);
 const options=quoteKqMarketRoutes({juryScore:9,harvestGrams:120,equipmentCodes:[]}).map(option=>({...option,storageRevision:rev,storageChangeAt:new Date(now+day).toISOString()}));
 await scalar("SELECT rpc_kq_prepare_market_lot($1,$2,120,9,'signature',ARRAY[]::TEXT[],$3::jsonb)",[user,flower,JSON.stringify(options)]);
 const prepared=await commerce('prepare',{flowerId:flower,route:'raw',expectedCostCents:0});
 check('market archive unmodified',Number(await scalar('SELECT jury_score FROM kq_market_lots WHERE flower_id=$1',[flower])),9);
 async function quote(channel='wholesale',units=100) {
  const current=await scalar('SELECT rpc_kq_commerce_state($1)',[user]);
  const stock=current.stocks.find(item=>item.id===prepared.stockId);
  const serverNow=Date.parse((await storage()).serverNow);
  stock.storage=projectKqStorageLot(stock.storageState,serverNow,stock.juryScore);
  const offer=quoteKqCommerce(current,stock,channel,'advised',units,serverNow),id=randomUUID();
  await db.query('INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at,storage_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)',[id,user,stock.id,current.revision,current.campaign?.id,current.campaign?.revision,stock.remainingUnits,current.reputation,JSON.stringify(offer),stock.storage.nextChangeAt,stock.storageRevision]);
  return {id,offer,stock};
 }
 const stale=await quote();
 await command('assign','STORAGE-GLASS',flower);
 await reject('quote invalid after storage assignment',()=>commerce('sell',{quoteId:stale.id,expectedPayoutCents:stale.offer.payoutCents}),'commerce_storage_changed');
 // Force a new immature timer using test-owner SQL; clients cannot do this.
 const fresh=createKqStorageLot({flowerId:flower,harvestedAt:new Date(now).toISOString(),baseline:base});
 await db.query('UPDATE kq_storage_lots SET state=$2::jsonb,revision=revision+1 WHERE flower_id=$1',[flower,JSON.stringify(fresh)]);
 const immature=await quote();
 await db.query("UPDATE kq_commerce_quotes SET offer=jsonb_set(offer,'{channel}','\"cbd-shop\"') WHERE id=$1",[immature.id]);
 await reject('SQL forbids forged immature retail sale',()=>commerce('sell',{quoteId:immature.id,expectedPayoutCents:immature.offer.payoutCents}),'commerce_curing_required');
 const bulk=await quote(),key=randomUUID(),payload={quoteId:bulk.id,expectedPayoutCents:bulk.offer.payoutCents};
 const receipt=await commerce('sell',payload,key);
 check('immature wholesale allowed',receipt.remainingUnits,1100);
 check('sale replay once',(await commerce('sell',payload,key)).replayed,true);
 check('partial sale retains original timer',(await storage()).lots[0].state.readyAt,fresh.readyAt);
 const expired=await quote();
 await db.query("UPDATE kq_commerce_quotes SET expires_at=now()-interval '1 millisecond' WHERE id=$1",[expired.id]);
 await reject('time boundary expires quote',()=>commerce('sell',{quoteId:expired.id,expectedPayoutCents:expired.offer.payoutCents}),'commerce_offer_changed');
 await db.query('UPDATE kq_storage_lots SET state=$2::jsonb,revision=revision+1 WHERE flower_id=$1',[flower,JSON.stringify(aged)]);
 const retail=await quote('cbd-shop');
 check('mature retail accepted by engine',retail.offer.reason,null);
 const retailReceipt=await commerce('sell',{quoteId:retail.id,expectedPayoutCents:retail.offer.payoutCents});
 check('mature retail validated against current quality',retailReceipt.remainingUnits,1000);
 check('sale leaves original jury score untouched',Number(await scalar('SELECT jury_score FROM kq_market_lots WHERE flower_id=$1',[flower])),9);
 for(const table of ['kq_storage_accounts','kq_storage_lots','kq_storage_requests']) for(const role of ['anon','authenticated','service_role']) {
  check(`${table} ${role} cannot direct write`,await scalar('SELECT has_table_privilege($1,$2,\'INSERT,UPDATE,DELETE\')',[role,table]),false);
 }
 check('service RPC granted',await scalar("SELECT has_function_privilege('service_role','rpc_kq_storage_command(uuid,text,text,uuid,uuid)','EXECUTE')"),true);
 check('anonymous RPC denied',await scalar("SELECT has_function_privilege('anon','rpc_kq_storage_command(uuid,text,text,uuid,uuid)','EXECUTE')"),false);
 console.log(`Storage SQL passed: ${checks.length} assertions; catalogue, atomic wallet/replay, post-jury timer, weighted exposure parity, immaturity guards, stale quotes, provenance, archives and grants.`);
} finally { await vite.close(); await db.close(); }
