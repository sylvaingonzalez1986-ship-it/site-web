// Isolated PostgreSQL only. No credentials, environment files or deployed writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const vite = await createServer({ configFile:false,envDir:false,resolve:{alias:{'@':path.resolve('src')}},server:{middlewareMode:true,watch:null} });
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const scalar = async (query, values=[]) => Object.values((await db.query(query,values)).rows[0])[0];
const command = (id,action,payload={},key=randomUUID()) => scalar('SELECT rpc_kq_online_command($1,$2,$3::jsonb,$4)',[id,action,JSON.stringify(payload),key]);
const state = id => scalar('SELECT rpc_kq_online_state($1)',[id]);
let checks=0;
const equal = (actual,expected,label) => { assert.deepEqual(actual,expected,label);checks++; };
const reject = async (fn,code) => { await db.exec('SAVEPOINT expected_failure'); try { await assert.rejects(fn,e=>e.message.includes(code));checks++; } finally { await db.exec('ROLLBACK TO SAVEPOINT expected_failure'); } };
try {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
 CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY,code TEXT,description TEXT,updated_at TIMESTAMPTZ);
 CREATE TABLE kq_support_card_rules(card_definition_id UUID,advantage TEXT,rules_version INTEGER,updated_at TIMESTAMPTZ);
 CREATE TABLE kq_runs(id UUID PRIMARY KEY,user_id UUID,state JSONB,status TEXT,started_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ);
 CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT,run_id UUID,variety_code TEXT DEFAULT 'KQ-VAR-001',variety_name TEXT DEFAULT 'Test',quality NUMERIC DEFAULT 9,
 battle_stats JSONB DEFAULT '{"appearance":90,"aroma":90,"vigor":90,"mastery":90,"regularity":90}',created_at TIMESTAMPTZ DEFAULT now(),burned_at TIMESTAMPTZ);
 CREATE TABLE kq_battles(flower_one_id UUID,flower_two_id UUID,status TEXT,rounds JSONB,verdict_at TIMESTAMPTZ);
 CREATE TABLE kq_bot_battles(flower_id UUID,rounds JSONB,verdict_at TIMESTAMPTZ);
 CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY,cash_cents INTEGER NOT NULL DEFAULT 0 CHECK(cash_cents>=0),reputation INTEGER NOT NULL DEFAULT 0 CHECK(reputation>=0),planned_route_code TEXT,planned_equipment_code TEXT,updated_at TIMESTAMPTZ DEFAULT now());
 CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS 'INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING';
 CREATE TABLE kq_equipment_loadouts(user_id UUID,equipment_code TEXT);
 CREATE TABLE arena_chanvrier_profiles(user_id UUID PRIMARY KEY,strength TEXT);
 `);
 for (const name of [
  '20260830000200_kq_post_harvest_market.sql','20260904000200_kq_route_masteries.sql','20260905000100_kq_route_expertise_rewards.sql',
  '20260909000100_kq_quality_reputation.sql','20260911000300_kq_cycle_electricity.sql','20260912000200_kq_living_market.sql',
  '20260913000100_kq_sales_channels.sql','20260913000200_kq_commerce_completed_at.sql','20260913000300_kq_commerce_mastery_guards.sql',
  '20260913000400_kq_shop_partners.sql','20260914000500_kq_shop_offer_precision.sql','20260915000300_kq_realtime_commerce_demand.sql',
  '20260921000100_kq_business_calendar.sql','20261010000200_storage_curing.sql','20261010000300_storage_capacity.sql',
  '20261010000700_storage_curing_six_hours.sql','20261010000800_storage_overflow_one_hour.sql',
  '20261011150000_kq_online_commerce.sql','20261012002000_kq_variety_market_demands.sql',
  '20261015000500_kq_marketing_campaigns.sql',
 ]) {
  if (name==='20260914000500_kq_shop_offer_precision.sql') {
   const specialty=await sql('20260914000100_arena_chanvrier_profiles.sql');
   await db.exec(specialty.slice(specialty.indexOf('DO $$',specialty.indexOf('-- Add the immutable specialty')),specialty.lastIndexOf('COMMIT;')));
  }
  if (name==='20260921000100_kq_business_calendar.sql') {
   const specialty=await sql('20260919000100_chanvrier_customization_and_benefits.sql');
   const start=specialty.indexOf(" SELECT pg_get_functiondef('public.rpc_kq_commerce_command");
   await db.exec('DO $$ DECLARE definition TEXT; original TEXT; BEGIN'+specialty.slice(start,specialty.indexOf('END $$;',start)+7));
  }
  if (name==='20261011150000_kq_online_commerce.sql') {
   // Run the production inventory valuation and installment implementation too;
   // only the unrelated chart-of-accounts writer is stubbed in this fixture.
   const treasury=await sql('20260921000200_kq_treasury_accounting.sql');
   await db.exec(treasury.match(/CREATE FUNCTION public\.kq_treasury_stock_cost\(p_user UUID\)[\s\S]*?\$\$;/)[0]);
   await db.exec(`CREATE TABLE kq_bank_loans(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,total_cents INTEGER,paid_cents INTEGER DEFAULT 0,accepted_at TIMESTAMPTZ,paid_at TIMESTAMPTZ,installment_hours INTEGER DEFAULT 120);
    CREATE TABLE audit_treasury_pairs(user_id UUID,event TEXT,source TEXT,occurred_at TIMESTAMPTZ,debit TEXT,credit TEXT,cents BIGINT,label TEXT);
    CREATE FUNCTION kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION kq_treasury_pair(UUID,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,BIGINT,TEXT) RETURNS VOID LANGUAGE sql AS 'INSERT INTO audit_treasury_pairs VALUES($1,$2,$3,$4,$5,$6,$7,$8)';`);
   const bank=await sql('20260924000100_kq_bank_monthly_installments.sql');
   await db.exec(bank.match(/CREATE OR REPLACE FUNCTION public\.kq_bank_settle\(p_user UUID\)[\s\S]*?\$\$;/)[0]);
   let business=await scalar("SELECT pg_get_functiondef('kq_business_settle(uuid)'::regprocedure)");
   business=business.replace('SELECT cash_cents INTO cash FROM public.kq_equipment_wallets', 'PERFORM public.kq_bank_settle(p_user); SELECT cash_cents INTO cash FROM public.kq_equipment_wallets');
   await db.exec(business);
  }
  await db.exec(await sql(name));
 }
 // A real pre-migration receipt and account must survive the new catalogue.
 const legacySiteUser=randomUUID(),legacySiteKey=randomUUID(),legacySitePayload={tier:'pro',name:'Ancienne boutique'};
 await db.query('INSERT INTO auth.users VALUES($1)',[legacySiteUser]);
 await state(legacySiteUser);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=3000000 WHERE user_id=$1',[legacySiteUser]);
 await db.query('UPDATE kq_commerce_accounts SET computer_owned=true WHERE user_id=$1',[legacySiteUser]);
 await db.query('UPDATE kq_online_accounts SET total_packets=30,confidence=60 WHERE user_id=$1',[legacySiteUser]);
 const legacySiteReceipt=await command(legacySiteUser,'upgrade-site',legacySitePayload,legacySiteKey);
 const accountFacts=id=>scalar(`SELECT jsonb_build_object('online',to_jsonb(o),'business',to_jsonb(a),'wallet',to_jsonb(w))
  FROM kq_online_accounts o JOIN kq_commerce_accounts a USING(user_id) JOIN kq_equipment_wallets w USING(user_id) WHERE o.user_id=$1`,[id]);
 const legacySiteBefore=await accountFacts(legacySiteUser);
 const oldCatalogue=await scalar("SELECT jsonb_agg(kq_online_site_catalog(tier)) FROM unnest(ARRAY['basic','improved','pro']) tier");
 const unchangedFunctions=()=>db.query(`SELECT oid::regprocedure::text AS name,pg_get_functiondef(oid) AS definition FROM pg_proc
  WHERE oid IN ('kq_online_offer(uuid,kq_online_listings,timestamptz)'::regprocedure,'kq_online_settle_until(uuid,timestamptz)'::regprocedure,
   'kq_online_dispatch(uuid,uuid,timestamptz)'::regprocedure,'kq_online_collect(uuid,integer,timestamptz)'::regprocedure) ORDER BY name`).then(result=>result.rows);
 const economicsBefore=await unchangedFunctions();
 await db.exec(await sql('20261020000400_kq_online_site_progression.sql'));
 equal(await accountFacts(legacySiteUser),legacySiteBefore,'site migration preserves the full existing pro account and paid period');
 equal(await unchangedFunctions(),economicsBefore,'site progression does not replace sale, settlement, dispatch or collection logic');
 for (const previous of oldCatalogue) {
  const current=await scalar('SELECT kq_online_site_catalog($1)',[previous.tier]);
  equal(Object.fromEntries(Object.keys(previous).map(key=>[key,current[key]])),previous,`${previous.tier}: old catalogue economics stay unchanged`);
 }
 const merchBefore=await accountFacts(legacySiteUser);
 await db.exec(await sql('20261020000500_kq_online_merch.sql'));
 equal(await accountFacts(legacySiteUser),merchBefore,'merch migration leaves existing account, cash and paid period intact');
 const legacyStudioUser=randomUUID(),legacyPhotoKey=randomUUID(),legacyBrandKey=randomUUID();
 await db.query('INSERT INTO auth.users VALUES($1)',[legacyStudioUser]);
 await state(legacyStudioUser);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=1000000 WHERE user_id=$1',[legacyStudioUser]);
 await db.query('UPDATE kq_commerce_accounts SET computer_owned=true WHERE user_id=$1',[legacyStudioUser]);
 await command(legacyStudioUser,'upgrade-site',{tier:'basic',name:'Ancien studio'});
 const legacyPhotoReceipt=await command(legacyStudioUser,'buy-upgrade',{code:'photography'},legacyPhotoKey);
 const legacyBrandReceipt=await command(legacyStudioUser,'buy-upgrade',{code:'branding'},legacyBrandKey);
 const legacyStudioFacts=await accountFacts(legacyStudioUser);
 const studioUntouched=await unchangedFunctions();
 await db.exec(await sql('20261020000600_kq_online_studio.sql'));
 const migratedStudioFacts=await accountFacts(legacyStudioUser);
 equal(Object.fromEntries(Object.keys(legacyStudioFacts.online).map(key=>[key,migratedStudioFacts.online[key]])),legacyStudioFacts.online,'studio migration preserves historical account values');
 equal(migratedStudioFacts.business,legacyStudioFacts.business,'studio migration preserves paid periods and business state');
 equal(migratedStudioFacts.wallet,legacyStudioFacts.wallet,'studio migration never charges historical upgrades again');
 equal((await unchangedFunctions()).filter(item=>!item.name.startsWith('kq_online_offer(')),studioUntouched.filter(item=>!item.name.startsWith('kq_online_offer(')),'studio migration preserves settlement, dispatch and collection functions');
 equal(await scalar('SELECT kq_online_studio_snapshot($1)',[legacyStudioUser]),{version:1,levels:{photography:1,branding:1,editorial:0},style:'craft'},'historical upgrades become level one without an editorial bonus');
 equal(Number(await scalar('SELECT kq_online_studio_flower_multiplier($1,9,1)',[legacyStudioUser])),1.188,'historical photography and brand keep their exact combined effect');
 equal(Number(await scalar("SELECT kq_online_studio_merch_multiplier($1,'tote',1)",[legacyStudioUser])),1,'historical brand does not gain an unearned merch bonus');
 equal(await command(legacyStudioUser,'buy-upgrade',{code:'photography'},legacyPhotoKey),{...legacyPhotoReceipt,replayed:true},'historical photography receipt replays after migration');
 equal(await command(legacyStudioUser,'buy-upgrade',{code:'branding'},legacyBrandKey),{...legacyBrandReceipt,replayed:true},'historical branding receipt replays after migration');
 // All relative timestamps are identical across repeated and batched settlement.
 await db.exec('BEGIN');
 const now = await scalar('SELECT now()');
 async function player() {
  const user=randomUUID(),run=randomUUID(),flower=randomUUID(),stock=randomUUID();
  await db.query('INSERT INTO auth.users VALUES($1)',[user]);
  await state(user);
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=1000000 WHERE user_id=$1',[user]);
  await db.query('UPDATE kq_commerce_accounts SET computer_owned=true WHERE user_id=$1',[user]);
  await command(user,'upgrade-site',{tier:'basic',name:'Petit atelier'});
  await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{}','completed',now()-interval '2 days')",[run,user]);
  await db.query("INSERT INTO kq_flowers(id,owner_id,run_id,status,burned_at) VALUES($1,$2,$3,'burned',now()-interval '1 day')",[flower,user,run]);
  await db.query("INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,equipment_codes,options,status,selected_route) VALUES($1,$2,100,9,'signature',ARRAY[]::TEXT[],'[]','stocked','raw')",[flower,user]);
  await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'raw',1000,0)",[flower,user]);
  await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',1000,1000,1000,180)",[stock,flower,user]);
  await db.query("UPDATE kq_storage_lots SET original_units=1000,state=jsonb_set(jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 hour')),'{capacity}',jsonb_build_object('totalUnits',1000,'allocations',jsonb_build_array(jsonb_build_object('containerCode','GLASS-1L','quantity',2,'storedUnits',1000)),'overflowDeadlineAt',now()+interval '1 day')) WHERE flower_id=$1",[flower]);
  return {user,flower,stock};
 }
 const {KQ_ONLINE_SITE_TIERS,estimateKqOnlineOffer}=await vite.ssrLoadModule('/src/lib/kanab-quest-online.ts');
 equal(KQ_ONLINE_SITE_TIERS.length,6,'six website levels are published by the client catalogue');
 for (const tier of KQ_ONLINE_SITE_TIERS) {
  equal(await scalar('SELECT kq_online_site_catalog($1)',[tier.code]),{
   tier:tier.code,level:tier.level,costCents:tier.acquisitionCents,monthlyCents:tier.monthlyCents,feePercent:2.5,
   conversion:tier.conversionMultiplier,requiredPackets:tier.minimumOrders,requiredConfidence:tier.minimumConfidence,
   requiredFollowers:tier.minimumFollowers,requiresPhotography:tier.requiredUpgrades.includes('photography'),requiresBranding:tier.requiredUpgrades.includes('branding'),
  },`${tier.code}: SQL and TypeScript agree on all costs, effects and prerequisites`);
 }
 equal(await scalar("SELECT kq_online_site_catalog('unknown')"),null,'unknown site levels have no authoritative catalogue entry');
 const replayedLegacySite=await command(legacySiteUser,'upgrade-site',legacySitePayload,legacySiteKey);
 equal(replayedLegacySite,{...legacySiteReceipt,replayed:true},'a pre-migration skipped-tier receipt still replays without buying again');
 equal((await state(legacySiteUser)).site.maxLevel,6,'migrated snapshots advertise the highest supported level');
 equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[legacySiteUser]),legacySiteBefore.wallet.cash_cents,'replaying an old site purchase preserves the wallet');

 const progression=await player();
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=3000000 WHERE user_id=$1',[progression.user]);
 await db.query('UPDATE kq_online_accounts SET total_packets=350,confidence=88,followers=300,photography=true,branding=true WHERE user_id=$1',[progression.user]);
 await reject(()=>command(progression.user,'upgrade-site',{tier:'pro'}),'online_progression_required');
 await reject(()=>command(progression.user,'upgrade-site',{tier:'basic'}),'online_progression_required');
 await db.query('UPDATE kq_online_accounts SET photography=false,branding=false WHERE user_id=$1',[progression.user]);
 let paidForSite=0;
 for (const tier of KQ_ONLINE_SITE_TIERS.slice(1)) {
  const beforeTier=await scalar('SELECT site_tier FROM kq_online_accounts WHERE user_id=$1',[progression.user]);
  await db.query('UPDATE kq_online_accounts SET total_packets=$2,confidence=$3,followers=$4 WHERE user_id=$1',
   [progression.user,tier.minimumOrders,tier.minimumConfidence,tier.minimumFollowers]);
  for (const upgrade of tier.requiredUpgrades) {
   if (!await scalar(`SELECT ${upgrade} FROM kq_online_accounts WHERE user_id=$1`,[progression.user])) await command(progression.user,'buy-upgrade',{code:upgrade});
  }
  const eligibleCash=await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[progression.user]);
  // Test one absent prerequisite at a time; client-supplied proof cannot fill it.
  for (const [field,minimum] of [['total_packets',tier.minimumOrders],['confidence',tier.minimumConfidence],['followers',tier.minimumFollowers]]) {
   if (minimum===0) continue;
   await db.query(`UPDATE kq_online_accounts SET ${field}=$2 WHERE user_id=$1`,[progression.user,minimum-1]);
   await reject(()=>command(progression.user,'upgrade-site',{tier:tier.code,orders:999999,confidence:100,followers:999999}),'online_progression_required');
   equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[progression.user]),eligibleCash,`${tier.code}: missing ${field} never charges cash`);
   await db.query(`UPDATE kq_online_accounts SET ${field}=$2 WHERE user_id=$1`,[progression.user,minimum]);
  }
  for (const upgrade of tier.requiredUpgrades) {
   await db.query(`UPDATE kq_online_accounts SET ${upgrade}=false WHERE user_id=$1`,[progression.user]);
   await reject(()=>command(progression.user,'upgrade-site',{tier:tier.code,photography:true,branding:true}),'online_progression_required');
   await db.query(`UPDATE kq_online_accounts SET ${upgrade}=true WHERE user_id=$1`,[progression.user]);
  }
  const cost=tier.acquisitionCents-paidForSite;
  const failedKey=randomUUID();
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1',[progression.user,cost-1]);
  const failedBefore=await accountFacts(progression.user);
  await reject(()=>command(progression.user,'upgrade-site',{tier:tier.code,costCents:0},failedKey),'online_cash');
  equal(await accountFacts(progression.user),failedBefore,`${tier.code}: insufficient cash rolls back site, billing, revisions and wallet`);
  equal(await scalar('SELECT count(*)::int FROM kq_online_requests WHERE user_id=$1 AND request_key=$2',[progression.user,failedKey]),0,`${tier.code}: failed purchase has no success receipt`);
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1',[progression.user,eligibleCash]);
  // A longer existing paid period survives each improvement.
  await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()+interval '240 hours' WHERE user_id=$1",[progression.user]);
  const paidUntil=await scalar('SELECT shop_paid_until FROM kq_commerce_accounts WHERE user_id=$1',[progression.user]);
  const siteKey=randomUUID(),payload={tier:tier.code,costCents:0,monthlyCents:0,conversion:999};
  const receipt=await command(progression.user,'upgrade-site',payload,siteKey);
  equal(receipt.paidCents,cost,`${tier.code}: server charges only the authoritative acquisition difference`);
  equal(await scalar('SELECT site_tier FROM kq_online_accounts WHERE user_id=$1',[progression.user]),tier.code,`${beforeTier} advances to ${tier.code}`);
  equal(await scalar('SELECT shop_paid_until FROM kq_commerce_accounts WHERE user_id=$1',[progression.user]),paidUntil,`${tier.code}: longer paid hosting is preserved`);
  equal(await scalar('SELECT shop_renew AND internet_renew FROM kq_commerce_accounts WHERE user_id=$1',[progression.user]),true,`${tier.code}: paid hosting renews at its own tariff`);
  equal(await command(progression.user,'upgrade-site',payload,siteKey),{...receipt,replayed:true},`${tier.code}: identical request replays its original receipt`);
  equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[progression.user]),eligibleCash-cost,`${tier.code}: retry does not debit twice`);
  equal(await scalar('SELECT count(*)::int FROM kq_business_ledger WHERE user_id=$1 AND kind=$2 AND amount_cents=$3',[progression.user,'online-upgrade-site',cost]),1,`${tier.code}: one website expense is recorded`);
  await reject(()=>command(progression.user,'upgrade-site',{tier:beforeTier}),'online_progression_required');
  await reject(()=>command(progression.user,'upgrade-site',{tier:tier.code}),'online_progression_required');
  await reject(()=>command(progression.user,'upgrade-site',{tier:tier.code},siteKey),'online_request_mismatch');
  paidForSite=tier.acquisitionCents;
 }
 equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[progression.user]),900000,'complete progression costs 20000 euros plus the two existing brand investments');
 // Renewal uses the same clock and ledger as existing tiers, including replay.
 await db.query("UPDATE kq_online_accounts SET settled_until=now()-interval '2 hours' WHERE user_id=$1",[progression.user]);
 await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()-interval '1 hour' WHERE user_id=$1",[progression.user]);
 const flagshipBefore=await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[progression.user]);
 const flagshipState=await state(progression.user);
 equal(flagshipState.site.tier,'flagship','the sixth level remains installed across renewal');
 equal(flagshipState.site.active,true,'funded flagship renewal keeps the boutique active');
 equal(await scalar("SELECT count(*)::int FROM kq_business_ledger WHERE user_id=$1 AND kind='shop-renewed' AND amount_cents=28000",[progression.user]),1,'flagship renewal charges exactly 280 euros');
 equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[progression.user]),flagshipBefore-28000,'flagship renewal debits its own monthly tariff');
 await state(progression.user);
 equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[progression.user]),flagshipBefore-28000,'another read cannot renew flagship twice');
 // These fixtures represent campaigns already running before version 2 shipped.
 const legacyMarketing=(user,code='introduction',angle='craft')=>db.query(`UPDATE kq_online_accounts SET marketing=jsonb_build_object(
  'id',gen_random_uuid(),'code',$2::text,'angle',$3::text,'startedAt',now(),
  'endsAt',now()+(kq_online_marketing_catalog($2)->>'durationHours')::int*interval '1 hour') WHERE user_id=$1`,[user,code,angle]);
 const p=await player();
 const basicSite=(await state(p.user)).site;
 equal({...basicSite,createdAt:new Date(basicSite.createdAt).toISOString()},{tier:'basic',maxLevel:6,createdAt:new Date(now).toISOString(),active:true,paidUntil:null,renew:false,feePercent:2.5},'free template, no subscription');
 const key=randomUUID(),cashBefore=await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[p.user]);
 await command(p.user,'buy-packaging',{code:'kraft-5',quantity:10},key);
 await command(p.user,'buy-packaging',{code:'kraft-5',quantity:10},key);
 equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[p.user]),cashBefore-250,'packaging purchase is charged once');
 equal(await scalar('SELECT kq_treasury_stock_cost($1)',[p.user]),250,'unused packaging is valued in inventory');
 await reject(()=>command(p.user,'buy-packaging',{code:'kraft-5',quantity:11},key),'online_request_mismatch');
 await reject(()=>command(p.user,'buy-packaging',{code:'printed-5',quantity:1}),'online_branding_required');
 const listing=(await command(p.user,'create-listing',{stockId:p.stock,formatGrams:5,packagingCode:'kraft-5',packets:10,packetPriceCents:1000})).listingId;
 equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[p.stock]),500,'prepacking removes physical loose stock');
 equal(await scalar("SELECT quantity FROM kq_online_packaging WHERE user_id=$1 AND code='kraft-5'",[p.user]),0,'prepacking consumes sachets once');
 equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[p.user]),cashBefore-250,'prepacking does not charge packaging twice');
 equal(await scalar('SELECT kq_treasury_stock_cost($1)',[p.user]),250,'prepared packaging remains valued in inventory');
 await command(p.user,'close-listing',{listingId:listing});
 equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[p.stock]),500,'removing from shelf keeps prepared packs');
 await command(p.user,'resume-listing',{listingId:listing});
 await reject(()=>command(p.user,'create-listing',{stockId:p.stock,formatGrams:10,packagingCode:'kraft-5',packets:1,packetPriceCents:1000}),'online_invalid_request');
 await reject(()=>command(p.user,'update-listing',{listingId:listing,packetPriceCents:1.1}),'online_invalid_request');
 await legacyMarketing(p.user);
 await reject(()=>command(p.user,'start-marketing',{version:2,code:'behind-scenes',angle:'craft',listingId:listing,budgetCode:'local'}),'online_marketing_active');
 // Shift a complete account timeline into the past, then advance incrementally
 // without wall clock sleeps or controls accessible to a game client.
 async function backdate(user,hours=72) {
  await db.query("UPDATE kq_online_accounts SET settled_until=now()-$2*interval '1 hour',growth_day=(now()-$2*interval '1 hour')::date,marketing=CASE WHEN marketing IS NULL THEN NULL ELSE marketing||jsonb_build_object('startedAt',now()-$2*interval '1 hour','endsAt',now()-($2-24)*interval '1 hour') END WHERE user_id=$1",[user,hours]);
  await db.query("UPDATE kq_online_listings SET created_at=now()-$2*interval '1 hour',changed_at=now()-$2*interval '1 hour' WHERE user_id=$1",[user,hours]);
  await db.query("UPDATE kq_commerce_accounts SET shop_created_at=now()-$2*interval '1 hour',business_started_at=now()-$2*interval '1 hour',demand_updated_at=now()-$2*interval '1 hour' WHERE user_id=$1",[user,hours]);
 }
 await backdate(p.user);
 const settled=await state(p.user);
 assert(settled.stats.orders>0,'offline time ships actual orders');checks++;
 equal(settled.stats.packagingCostCents,settled.stats.orders*25,'packaging allocated once to margin');
 equal(await scalar('SELECT kq_treasury_stock_cost($1)',[p.user]),250-settled.stats.packagingCostCents,'dispatched packaging leaves inventory once');
 const wallet=await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[p.user]);
 equal((await state(p.user)).stats,settled.stats,'repeated catch-up cannot replay sales');
 equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[p.user]),wallet,'replay cannot credit income twice');
 equal(settled.followers,15,'completed simulated campaign recruits audience exactly once');
 await reject(()=>command(p.user,'start-marketing',{version:2,code:'introduction',angle:'craft',listingId:listing,budgetCode:'local'}),'online_progression_required');
 // Same starting conditions, one catch-up versus reads every seven hours.
 const prepare=async (price=4000,packets=20) => {
  const account=await player();
  await command(account.user,'buy-packaging',{code:'kraft-5',quantity:packets});
  account.listing=(await command(account.user,'create-listing',{stockId:account.stock,formatGrams:5,packagingCode:'kraft-5',packets,packetPriceCents:price})).listingId;
  return account;
 };
 const offerParity=await prepare();
 let baseRate,baseTraffic;
 for (const tier of KQ_ONLINE_SITE_TIERS) {
  await db.query('UPDATE kq_online_accounts SET site_tier=$2 WHERE user_id=$1',[offerParity.user,tier.code]);
  await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()+interval '120 hours',shop_suspended=false WHERE user_id=$1",[offerParity.user]);
  const commerce=await scalar('SELECT rpc_kq_commerce_state($1)',[offerParity.user]);
  const row=commerce.online.listings.find(item=>item.id===offerParity.listing);
  const estimated=estimateKqOnlineOffer({listingId:row.id,route:row.route,varietyCode:row.varietyCode,customerDemand:commerce.customerDemand,
   quality:row.qualityScore,baseUnitCents:row.baseUnitCents,formatGrams:row.formatGrams,packagingCode:row.packagingCode,
   packetPriceCents:row.packetPriceCents,reputation:commerce.reputation,clients:commerce.clients,online:commerce.online});
  equal(Math.abs(row.offer.ordersPerDay-estimated.ordersPerDay)<1e-8,true,`${tier.code}: actual SQL order rate matches the TypeScript forecast`);
  equal(row.offer.referencePacketCents,estimated.referencePacketPriceCents,`${tier.code}: website level does not fabricate a new reference price`);
  if(tier.code==='basic'){baseRate=row.offer.ordersPerDay;baseTraffic=row.offer.visitorsPerDay;}
  equal(Math.abs(row.offer.ordersPerDay-baseRate*tier.conversionMultiplier)<1e-8,true,`${tier.code}: only the advertised conversion factor changes the rate`);
  equal(row.offer.visitorsPerDay,baseTraffic,`${tier.code}: a website improvement does not create visitors`);
 }
 const batched=await prepare(),frequent=await prepare();
 for (const account of [batched,frequent]) {
  await legacyMarketing(account.user);
  await backdate(account.user,200);
  await db.query('UPDATE kq_commerce_accounts SET clients=15 WHERE user_id=$1',[account.user]);
  await db.query('UPDATE kq_online_accounts SET clients_start=15 WHERE user_id=$1',[account.user]);
 }
 for (let hours=193;hours>=0;hours-=7) await db.query("SELECT kq_online_settle_until($1,now()-$2*interval '1 hour')",[frequent.user,hours]);
 const batchResult=await state(batched.user),frequentResult=await state(frequent.user);
 equal(frequentResult.stats,batchResult.stats,'same orders, money, material and audience for frequent/rare reads');
 equal(frequentResult.confidence,batchResult.confidence,'confidence independent of polling');
 equal(await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[frequent.user]),await scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[batched.user]),'same final cash for frequent/rare reads');
 const saleFacts=id=>db.query('SELECT packet_number,payout_cents,vat_cents,fee_cents,quality_score,satisfaction_score FROM kq_online_sales WHERE user_id=$1 ORDER BY packet_number',[id]).then(r=>r.rows);
 equal(await saleFacts(frequent.user),await saleFacts(batched.user),'identical per-sale quality and cumulative rounding');
 // Price edits settle past time using the price actually displayed then.
 const repriced=await prepare();await backdate(repriced.user,72);
 await command(repriced.user,'update-listing',{listingId:repriced.listing,packetPriceCents:1_000_000});
 equal(await scalar('SELECT bool_and(payout_cents=4000) FROM kq_online_sales WHERE user_id=$1',[repriced.user]),true,'old elapsed orders keep the old price');
 equal(Number(await scalar('SELECT order_progress FROM kq_online_listings WHERE id=$1',[repriced.listing])),0,'price change clears incomplete old purchase intent');
 equal((await state(repriced.user)).listings[0].offer.ordersPerDay,0,'absurd prices have zero demand');
 // A starting wallet cannot pay renewal, but revenue earned before it can.
 const renewed=await prepare();await backdate(renewed.user,120);
 await db.query("UPDATE kq_online_accounts SET site_tier='improved' WHERE user_id=$1",[renewed.user]);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=1000 WHERE user_id=$1',[renewed.user]);
 await db.query("UPDATE kq_commerce_accounts SET clients=40,shop_paid_until=now()-interval '24 hours',shop_renew=true WHERE user_id=$1",[renewed.user]);
 const renewedState=await state(renewed.user);
 equal(renewedState.site.active,true,'earlier online proceeds can finance renewal');
 equal(await scalar("SELECT count(*)::int FROM kq_business_ledger WHERE user_id=$1 AND kind='shop-renewed' AND amount_cents=3000",[renewed.user]),1,'improved subscription charged exactly at its own tariff');
 // Conversely no sales are invented after a suspension to fund it retroactively.
 const suspended=await prepare();await backdate(suspended.user,120);
 await db.query("UPDATE kq_online_accounts SET site_tier='improved' WHERE user_id=$1",[suspended.user]);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1',[suspended.user]);
 await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()-interval '119 hours',shop_renew=true WHERE user_id=$1",[suspended.user]);
 const suspendedState=await state(suspended.user);
 equal(suspendedState.site.active,false,'unfunded due subscription suspends the site');
 equal(suspendedState.stats.orders,0,'suspended time produces no invented sales');
 // Receivables created later must never be collected from earlier sales.
 const debt=await prepare();await backdate(debt.user,96);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1',[debt.user]);
 await db.query('UPDATE kq_commerce_accounts SET clients=15 WHERE user_id=$1',[debt.user]);
 await db.query("INSERT INTO kq_lab_invoices(run_id,user_id,due_at) SELECT run_id,$1,now()-interval '12 hours' FROM kq_flowers WHERE id=$2",[debt.user,debt.flower]);
 await state(debt.user);
 equal(await scalar("SELECT bool_and(lab_paid_cents=0) FROM kq_online_sales WHERE user_id=$1 AND occurred_at<now()-interval '12 hours'",[debt.user]),true,'future laboratory debt never consumes historical sales');
 // Real installments are events on the same timeline, including hours that
 // do not coincide with quality ticks, UTC midnight or an order.
 const borrower=await prepare();await backdate(borrower.user,72);
 await db.query("INSERT INTO kq_bank_loans(user_id,total_cents,accepted_at) VALUES($1,7000,now()-interval '143 hours')",[borrower.user]);
 equal(new Date(await scalar('SELECT kq_online_next_bank_event($1,now()-interval \'72 hours\')',[borrower.user])).getTime(),new Date(now).getTime()-23*3600000,'bank deadline is scheduled at its exact timestamp');
 await state(borrower.user);
 equal(await scalar('SELECT paid_cents FROM kq_bank_loans WHERE user_id=$1',[borrower.user]),1000,'only elapsed loan installment collected');
 // Quality-priced professionals: no merchant boost on shops and bulk below it.
 equal(Number(await scalar("SELECT kq_online_raw_professional_price('cbd-shop',6.5,'normal',180,1.5)")),300,'commercial indoor flowers sell to shops at 3000 euros/kg');
 equal(Number(await scalar("SELECT kq_online_raw_professional_price('cbd-shop',9.5,'normal',180,1.5)")),300,'quality does not multiply the fixed professional base');
 equal(Number(await scalar("SELECT kq_online_raw_professional_price('wholesale',6.5,'normal',180,1.5)")),210,'wholesale remains thirty percent below the shop price');
 const {quoteKqCommerce}=await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts');
 const {projectKqStorageLot}=await vite.ssrLoadModule('/src/lib/kanab-quest-storage.ts');
 const {previewKqBusinessPayment}=await vite.ssrLoadModule('/src/lib/kanab-quest-business.ts');
 async function storedQuote(account,channel,units) {
  const snapshot=await scalar('SELECT rpc_kq_commerce_state($1)',[account.user]);
  const rawStock=snapshot.stocks.find(s=>s.id===account.stock);
  const stock={...rawStock,storage:projectKqStorageLot(rawStock.storageState,Date.parse(now),rawStock.juryScore)};
  const offer=quoteKqCommerce(snapshot,stock,channel,'advised',units,Date.parse(now));
  Object.assign(offer,previewKqBusinessPayment(offer.payoutCents,snapshot.business,0));
  const quoteId=randomUUID();
  await db.query(`INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at,storage_revision)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now()+interval '1 minute',$10)`,
  [quoteId,account.user,account.stock,snapshot.revision,snapshot.campaign?.id??null,snapshot.campaign?.revision??null,stock.remainingUnits,snapshot.reputation,JSON.stringify(offer),rawStock.storageRevision]);
  return {quoteId,offer};
 }
 const trader=await prepare(1000,10);
 const shopQuote=await storedQuote(trader,'cbd-shop',250);
 equal(shopQuote.offer.units,250,'new shop quote can use available loose stock');
 const shopSale=await scalar('SELECT rpc_kq_commerce_command($1,\'sell\',$2::jsonb,$3)',[trader.user,JSON.stringify({quoteId:shopQuote.quoteId,expectedPayoutCents:shopQuote.offer.payoutCents}),randomUUID()]);
 equal(shopSale.payoutCents,shopQuote.offer.payoutCents,'server accepts the actual TypeScript quality tariff');
 equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[trader.stock]),250,'shop settlement cannot consume prepared packets');
 const bulkQuote=await storedQuote(trader,'wholesale',250);
 await scalar('SELECT rpc_kq_commerce_command($1,\'sell\',$2::jsonb,$3)',[trader.user,JSON.stringify({quoteId:bulkQuote.quoteId,expectedPayoutCents:bulkQuote.offer.payoutCents}),randomUUID()]);
 equal(await scalar('SELECT status FROM kq_market_lots WHERE flower_id=$1',[trader.flower]),'stocked','loose stock exhaustion keeps prepared material unsold');
 const legacy=await player(),oldQuote=await storedQuote(legacy,'online',50);
 await reject(()=>scalar('SELECT rpc_kq_commerce_command($1,\'sell\',$2::jsonb,$3)',[legacy.user,JSON.stringify({quoteId:oldQuote.quoteId,expectedPayoutCents:oldQuote.offer.payoutCents}),randomUUID()]),'online_legacy_sale');
 const tampered=await player(),tamperedQuote=await storedQuote(tampered,'cbd-shop',50);
 await db.query("UPDATE kq_commerce_quotes SET offer=jsonb_set(offer,'{unitCents}','999') WHERE id=$1",[tamperedQuote.quoteId]);
 await reject(()=>scalar('SELECT rpc_kq_commerce_command($1,\'sell\',$2::jsonb,$3)',[tampered.user,JSON.stringify({quoteId:tamperedQuote.quoteId,expectedPayoutCents:tamperedQuote.offer.payoutCents}),randomUUID()]),'commerce_offer_changed');
 const aged=await prepare(1000,10);
 await command(aged.user,'buy-packaging',{code:'kraft-5',quantity:10});
 const dying=(await command(aged.user,'create-listing',{stockId:aged.stock,formatGrams:5,packagingCode:'kraft-5',packets:10,packetPriceCents:1000})).listingId;
 await db.query('UPDATE kq_online_listings SET packed_quality=5.8 WHERE id=$1',[dying]);
 const halfRate=Number(await scalar("SELECT (kq_online_offer($1,l,now())->>'ordersPerDay')::numeric FROM kq_online_listings l WHERE id=$2",[aged.user,aged.listing]));
 const fullRate=Number(await scalar("SELECT (kq_online_offer($1,l,now()+interval '4 hours')->>'ordersPerDay')::numeric FROM kq_online_listings l WHERE id=$2",[aged.user,aged.listing]));
 assert(fullRate>halfRate*1.9,'unmarketable quality no longer consumes shared demand');checks++;
 await db.query("UPDATE kq_online_listings SET created_at=now()-interval '4 hours' WHERE id=$1",[dying]);
 equal((await state(aged.user)).listings.find(l=>l.id===dying).status,'quality-blocked','threshold crossing is visible in listing status');
 const discardedKey=randomUUID(),inventoryBefore=await scalar('SELECT kq_treasury_stock_cost($1)',[aged.user]);
 const discarded=await command(aged.user,'discard-listing',{listingId:dying},discardedKey);
 equal(discarded.discardedGrams,50,'discard receipt reports actual destroyed mass');
 equal((await command(aged.user,'discard-listing',{listingId:dying},discardedKey)).replayed,true,'discard retries cannot destroy material twice');
 equal(await scalar('SELECT kq_treasury_stock_cost($1)',[aged.user]),inventoryBefore-250,'discard writes remaining packaging out of inventory');
 equal((await state(aged.user)).stats.orders,0,'discard is never counted as a sale');
 equal(await scalar('SELECT remaining_packets+sold_packets FROM kq_online_listings WHERE id=$1',[dying]),0,'discard preserves zero sold count and removes remaining packets');
 await reject(()=>command(aged.user,'resume-listing',{listingId:dying}),'online_listing_inactive');
 const merchant=await player();
 await db.query("INSERT INTO arena_chanvrier_profiles(user_id,strength) VALUES($1,'merchant')",[merchant.user]);
 const merchantShop=await storedQuote(merchant,'cbd-shop',100);
 await scalar('SELECT rpc_kq_commerce_command($1,\'sell\',$2::jsonb,$3)',[merchant.user,JSON.stringify({quoteId:merchantShop.quoteId,expectedPayoutCents:merchantShop.offer.payoutCents}),randomUUID()]);
 equal(merchantShop.offer.unitCents,shopQuote.offer.unitCents,'merchant specialty does not increase fixed shop quality tariff');
 const merchantBulk=await storedQuote(merchant,'wholesale',100);
 await scalar('SELECT rpc_kq_commerce_command($1,\'sell\',$2::jsonb,$3)',[merchant.user,JSON.stringify({quoteId:merchantBulk.quoteId,expectedPayoutCents:merchantBulk.offer.payoutCents}),randomUUID()]);
 assert(merchantBulk.offer.unitCents<=merchantShop.offer.unitCents*.7+.000001,'merchant bulk remains below direct shop tariff');checks++;
 const honest=await prepare(3000),expensive=await prepare(7200);
 for (const account of [honest,expensive]) {
  await db.query('UPDATE kq_equipment_wallets SET reputation=100 WHERE user_id=$1',[account.user]);
  await db.query('UPDATE kq_commerce_accounts SET clients=50 WHERE user_id=$1',[account.user]);
  await db.query('UPDATE kq_online_accounts SET followers=5000,clients_start=50 WHERE user_id=$1',[account.user]);
  await backdate(account.user,96);
 }
 await db.query('UPDATE kq_online_listings SET packed_quality=6.5 WHERE user_id=$1',[honest.user]);
 const honestResult=await state(honest.user),expensiveResult=await state(expensive.user);
 equal(await scalar('SELECT reputation FROM kq_equipment_wallets WHERE user_id=$1',[honest.user]),100,'fair price for modest quality does not punish reputation');
 assert(expensiveResult.confidence<60,'disappointing value reduces confidence');checks++;
 assert(await scalar('SELECT clients<50 FROM kq_commerce_accounts WHERE user_id=$1',[expensive.user]),'disappointing deliveries lose existing clients');checks++;
 assert(await scalar('SELECT reputation<100 FROM kq_equipment_wallets WHERE user_id=$1',[expensive.user]),'enough overpriced sales cause reputation loss');checks++;
 assert(honestResult.stats.orders>expensiveResult.stats.orders,'modest quality at fair price outsells overpriced quality');checks++;
 const scheduled=await prepare();await backdate(scheduled.user,96);
 const worker=await scalar('SELECT rpc_kq_online_settle_due(100)');
 equal(worker.failedUsers,0,'background worker settles without hidden failure');
 assert(worker.processedUsers>=1,'background worker selects a due seller');checks++;
 assert((await state(scheduled.user)).stats.orders>0,'background worker ships while user is absent');checks++;

 // Campaign v2: server-priced budgets, a real preparation slot, targeted
 // acquisition and earned followers. Every fixture stays inside this PGlite DB.
 const campaignInput=(account,code='behind-scenes',budgetCode='local',angle='craft')=>({version:2,code,angle,listingId:account.listing,budgetCode});
 const money=user=>scalar('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[user]);
 const quote=(account,listingId=account.listing,hours=0)=>scalar("SELECT kq_online_offer($1,l,now()+$3*interval '1 hour') FROM kq_online_listings l WHERE id=$2",[account.user,listingId,hours]);
 const near=(actual,expected,label)=>{assert.ok(Math.abs(actual-expected)<1e-8,label+': '+actual+' versus '+expected);checks++};
 const campaign=await prepare(4000,10);
 await command(campaign.user,'buy-packaging',{code:'kraft-5',quantity:10});
 campaign.otherListing=(await command(campaign.user,'create-listing',{stockId:campaign.stock,formatGrams:5,packagingCode:'kraft-5',packets:10,packetPriceCents:4000})).listingId;
 await reject(()=>command(campaign.user,'start-marketing',{code:'introduction',angle:'craft'}),'online_marketing_version');
 await reject(()=>command(campaign.user,'start-marketing',{...campaignInput(campaign),version:'2'}),'online_marketing_version');
 await reject(()=>command(campaign.user,'start-marketing',{...campaignInput(campaign),version:3}),'online_marketing_version');
 await reject(()=>command(campaign.user,'start-marketing',campaignInput(campaign,'introduction','national')),'online_marketing_unknown');
 await reject(()=>command(campaign.user,'start-marketing',campaignInput(campaign,'behind-scenes','free')),'online_marketing_unknown');
 await reject(()=>command(campaign.user,'start-marketing',campaignInput(campaign,'feedback')),'online_progression_required');
 const organicNow=await quote(campaign),organicLaunch=await quote(campaign,campaign.listing,12);
 const otherOrganic=await quote(campaign,campaign.otherListing,12);
 const campaignCash=await money(campaign.user),campaignKey=randomUUID();
 const campaignReceipt=await command(campaign.user,'start-marketing',{...campaignInput(campaign),costCents:0,visitorsPerDay:999999,followersCap:999999},campaignKey);
 const activeCampaign=(await state(campaign.user)).marketing;
 equal(campaignReceipt.paidCents,3000,'server derives local campaign cost, ignoring forged free cost');
 equal(await money(campaign.user),campaignCash-3000,'paid launch deducts cash immediately');
 equal(activeCampaign.version,2,'snapshot advertises the campaign v2 capability');
 equal(activeCampaign.active.visitorsPerDay,56.25,'server freezes budget traffic and mission multiplier');
 equal(activeCampaign.active.followersCap,30,'client cannot choose its followers cap');
 equal(activeCampaign.active.flowerId,null,'ordinary campaigns do not reserve a future harvest presentation');
 equal(new Date(activeCampaign.active.launchesAt).getTime()-new Date(activeCampaign.active.startedAt).getTime(),12*3600000,'workshop campaign requires twelve real hours of preparation');
 equal(new Date(activeCampaign.active.endsAt).getTime()-new Date(activeCampaign.active.launchesAt).getTime(),48*3600000,'diffusion lasts forty-eight hours after preparation');
 equal(activeCampaign.active.results,{orders:0,satisfiedOrders:0,revenueCents:0,netRevenueCents:0,followersEarned:0},'active result starts empty');
 equal((await command(campaign.user,'start-marketing',{...campaignInput(campaign),costCents:0,visitorsPerDay:999999,followersCap:999999},campaignKey)).replayed,true,'campaign retry returns the original receipt');
 equal(await money(campaign.user),campaignCash-3000,'retry never buys the campaign twice');
 equal(await scalar("SELECT count(*)::int FROM kq_business_ledger WHERE user_id=$1 AND kind='online-start-marketing'",[campaign.user]),1,'one paid campaign creates one ledger entry');
 equal((await db.query("SELECT debit,cents FROM audit_treasury_pairs WHERE user_id=$1 AND event='online-start-marketing'",[campaign.user])).rows,[{debit:'expense_advertising',cents:3000}],'campaign cost reaches the advertising expense account');
 await reject(()=>command(campaign.user,'start-marketing',campaignInput(campaign,'behind-scenes','regional'),campaignKey),'online_request_mismatch');
 await reject(()=>command(campaign.user,'start-marketing',campaignInput(campaign,'harvest')),'online_marketing_active');
 near((await quote(campaign)).ordersPerDay,organicNow.ordersPerDay,'preparation adds no order rate');
 near((await quote(campaign,campaign.otherListing,12)).ordersPerDay,otherOrganic.ordersPerDay,'targeting one listing adds no demand to another listing');
 const launched=await quote(campaign,campaign.listing,12);
 near(launched.visitorsPerDay-organicLaunch.visitorsPerDay,56.25*1.15,'matching craft audience begins exactly at diffusion');
 assert(launched.ordersPerDay>organicLaunch.ordersPerDay,'diffusion increases the target order rate');checks++;
 const beforeLaunch=await quote(campaign,campaign.listing,12-1/3600000);
 near(beforeLaunch.visitorsPerDay,organicLaunch.visitorsPerDay,'one millisecond before launch still has no campaign traffic');
 const expired=await quote(campaign,campaign.listing,60);
 near(expired.visitorsPerDay,organicNow.visitorsPerDay,'traffic ends exactly at the exclusive diffusion deadline');
 await db.query("UPDATE kq_commerce_accounts SET advertising=jsonb_build_object('startedAt',now(),'endsAt',now()+interval '72 hours','boostPercent',100) WHERE user_id=$1",[campaign.user]);
 near((await quote(campaign,campaign.listing,12)).visitorsPerDay,organicLaunch.visitorsPerDay*2+56.25*1.15,'generic advertising doubles organic visits without multiplying paid targeted traffic');
 await db.query('UPDATE kq_commerce_accounts SET advertising=NULL WHERE user_id=$1',[campaign.user]);
 await db.query('UPDATE kq_online_listings SET packet_price_cents=$2 WHERE id=$1',[campaign.listing,Math.round(organicLaunch.referencePacketCents*1.2)]);
 await db.query("UPDATE kq_online_accounts SET marketing=jsonb_set(marketing,'{angle}','\"value\"') WHERE user_id=$1",[campaign.user]);
 near((await quote(campaign,campaign.listing,12)).visitorsPerDay-organicLaunch.visitorsPerDay,56.25*.35,'expensive products waste most of a value audience');
 await db.query("UPDATE kq_online_accounts SET marketing=jsonb_set(marketing,'{angle}','\"premium\"') WHERE user_id=$1",[campaign.user]);
 near((await quote(campaign,campaign.listing,12)).visitorsPerDay-organicLaunch.visitorsPerDay,56.25*1.15,'premium audience matches high quality and premium prices');
 await db.query('UPDATE kq_online_listings SET packet_price_cents=$2 WHERE id=$1',[campaign.listing,Math.round(organicLaunch.referencePacketCents*.9)]);
 near((await quote(campaign,campaign.listing,12)).visitorsPerDay-organicLaunch.visitorsPerDay,56.25*.3,'discounted pricing is a poor fit for premium positioning');

 const poor=await prepare(),poorKey=randomUUID();
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=2999 WHERE user_id=$1',[poor.user]);
 await reject(()=>command(poor.user,'start-marketing',campaignInput(poor),poorKey),'online_cash');
 equal(await money(poor.user),2999,'insufficient funds preserves the wallet');
 equal((await state(poor.user)).marketing.active,null,'failed debit rolls the campaign back');
 equal((await state(poor.user)).marketing.history,[],'failed launch creates no history');
 equal(await scalar('SELECT count(*)::int FROM kq_online_requests WHERE user_id=$1 AND request_key=$2',[poor.user,poorKey]),0,'failed launch creates no idempotency receipt');
 const invalid=await prepare();
 await reject(()=>command(invalid.user,'start-marketing',{...campaignInput(invalid),listingId:poor.listing}),'online_listing_unknown');
 await command(invalid.user,'pause-listing',{listingId:invalid.listing});
 await reject(()=>command(invalid.user,'start-marketing',campaignInput(invalid)),'online_listing_inactive');
 await command(invalid.user,'resume-listing',{listingId:invalid.listing});
 await db.exec('SAVEPOINT invalid_campaign_quality');
 await db.query('UPDATE kq_online_listings SET packed_quality=5.79 WHERE id=$1',[invalid.listing]);
 await reject(()=>command(invalid.user,'start-marketing',campaignInput(invalid)),'online_listing_inactive');
 await db.exec('ROLLBACK TO SAVEPOINT invalid_campaign_quality');
 await db.exec('SAVEPOINT immature_campaign_stock');
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()+interval '1 hour')) WHERE flower_id=$1",[invalid.flower]);
 await reject(()=>command(invalid.user,'start-marketing',campaignInput(invalid,'harvest')),'online_storage_not_ready');
 await db.exec('ROLLBACK TO SAVEPOINT immature_campaign_stock');

 // Rewind all campaign boundaries together. The production settlement still
 // owns every dispatch; no public time-advance operation is introduced.
 async function rewindCampaign(account,hours) {
  await db.query(`UPDATE kq_online_accounts SET settled_until=now()-$2*interval '1 hour',growth_day=(now()-$2*interval '1 hour')::date,
   marketing=marketing||jsonb_build_object('startedAt',(marketing->>'startedAt')::timestamptz-$2*interval '1 hour',
    'launchesAt',(marketing->>'launchesAt')::timestamptz-$2*interval '1 hour','endsAt',(marketing->>'endsAt')::timestamptz-$2*interval '1 hour') WHERE user_id=$1`,[account.user,hours]);
  await db.query("UPDATE kq_online_listings SET created_at=now()-$2*interval '1 hour',changed_at=now()-$2*interval '1 hour' WHERE user_id=$1",[account.user,hours]);
  await db.query("UPDATE kq_commerce_accounts SET shop_created_at=now()-$2*interval '1 hour',business_started_at=now()-$2*interval '1 hour',demand_updated_at=now()-$2*interval '1 hour' WHERE user_id=$1",[account.user,hours]);
 }
 const intro=await prepare(1000000);
 const introCash=await money(intro.user);
 await command(intro.user,'start-marketing',campaignInput(intro,'introduction'));
 equal(await money(intro.user),introCash,'first introductory campaign remains free');
 await rewindCampaign(intro,25);
 const introResult=await state(intro.user);
 equal(introResult.followers,0,'a v2 campaign with no satisfied order earns no automatic followers');
 equal(introResult.marketing.history[0].results.followersEarned,0,'empty campaign result explains the zero reward');
 await reject(()=>command(intro.user,'start-marketing',campaignInput(intro,'introduction')),'online_progression_required');
 await command(intro.user,'start-marketing',{...campaignInput(intro,'harvest','regional'),stockId:poor.stock});
 const harvestCampaign=(await state(intro.user)).marketing.active;
 equal(harvestCampaign.stockId,intro.stock,'harvest uses the targeted listing stock instead of a forged payload stock');
 equal(harvestCampaign.flowerId,intro.flower,'only harvest freezes the promoted flower');
 equal(harvestCampaign.costCents,8000,'regional budget is charged at its authoritative tariff');
 equal(harvestCampaign.visitorsPerDay,200,'harvest applies its multiplier to the regional audience');
 await rewindCampaign(intro,74);await state(intro.user);
 await reject(()=>command(intro.user,'start-marketing',campaignInput(intro,'harvest')),'online_progression_required');
 const feedback=await prepare(1000000);
 await db.query('UPDATE kq_online_accounts SET total_packets=5 WHERE user_id=$1',[feedback.user]);
 await command(feedback.user,'start-marketing',campaignInput(feedback,'feedback','national'));
 const feedbackCampaign=(await state(feedback.user)).marketing.active;
 equal({cost:feedbackCampaign.costCents,visits:feedbackCampaign.visitorsPerDay,cap:feedbackCampaign.followersCap,goal:feedbackCampaign.goalOrders},{cost:18000,visits:140,cap:40,goal:4},'feedback has a distinct budget audience and qualified-order objective');

 const measured=await prepare(1000000,10);
 await command(measured.user,'buy-packaging',{code:'kraft-5',quantity:10});
 measured.otherListing=(await command(measured.user,'create-listing',{stockId:measured.stock,formatGrams:5,packagingCode:'kraft-5',packets:10,packetPriceCents:1000000})).listingId;
 await command(measured.user,'start-marketing',campaignInput(measured));
 await rewindCampaign(measured,60);
 for (const [index,hours,microseconds,price,satisfaction,target] of [
  [1,48,-1,1000,98,true], [2,48,0,2000,80,true], [3,24,0,3000,74,true],
  [4,0,-1,4000,75,true], [5,0,0,5000,98,true], [1,24,0,10000,98,false],
 ]) {
  await db.query(`INSERT INTO kq_online_sales(user_id,listing_id,packet_number,occurred_at,payout_cents,vat_cents,fee_cents,lab_paid_cents,electricity_paid_cents,net_payout_cents,packaging_cost_cents,quality_score,value_ratio,satisfaction_score,satisfaction)
   VALUES($1,$2,$3,now()-$4*interval '1 hour'+$5*interval '1 microsecond',$6,0,0,0,0,$6*8/10,25,9,1,$7::numeric,CASE WHEN $7::numeric>=75 THEN 'satisfied' ELSE 'neutral' END)`,[measured.user,target?measured.listing:measured.otherListing,index,hours,microseconds,price,satisfaction]);
 }
 await db.query('UPDATE kq_online_listings SET sold_packets=CASE WHEN id=$2 THEN 5 ELSE 1 END,remaining_packets=CASE WHEN id=$2 THEN 5 ELSE 9 END WHERE user_id=$1',[measured.user,measured.listing]);
 const expectedResults={orders:3,satisfiedOrders:2,revenueCents:9000,netRevenueCents:7200,followersEarned:20};
 equal(await scalar("SELECT kq_online_marketing_results($1,marketing,now()-interval '24 hours') FROM kq_online_accounts WHERE user_id=$1",[measured.user]),
  {orders:2,satisfiedOrders:1,revenueCents:5000,netRevenueCents:4000,followersEarned:10},'live progress includes a sale exactly at the observation time before campaign end');
 const runningSnapshot=await scalar('SELECT kq_online_snapshot($1)',[measured.user]);
 equal(runningSnapshot.marketing.active.results,expectedResults,'live results count only target sales within inclusive launch and exclusive end');
 const measuredResult=await state(measured.user);
 equal(measuredResult.marketing.active,null,'completed campaign releases the preparation slot');
 equal(measuredResult.marketing.history[0].results,expectedResults,'completion freezes the same measured results');
 equal(measuredResult.followers,20,'only the two satisfied target orders earn followers');
 equal((await state(measured.user)).followers,20,'repeated completion cannot award followers twice');
 equal(await scalar("SELECT (kq_online_marketing_results($1,(marketing_history->0)||jsonb_build_object('followersCap',15),now())->>'followersEarned')::int FROM kq_online_accounts WHERE user_id=$1",[measured.user]),15,'earned audience remains capped');
 await reject(()=>command(measured.user,'start-marketing',campaignInput(measured)),'online_progression_required');

 const paidBatch=await prepare(4000),paidFrequent=await prepare(4000);
 for (const account of [paidBatch,paidFrequent]) {
  await command(account.user,'start-marketing',campaignInput(account,'behind-scenes','regional'));
  await rewindCampaign(account,72);
 }
 for(let hours=65;hours>=0;hours-=7)await db.query("SELECT kq_online_settle_until($1,now()-$2*interval '1 hour')",[paidFrequent.user,hours]);
 const paidBatchResult=await state(paidBatch.user),paidFrequentResult=await state(paidFrequent.user);
 equal(paidFrequentResult.stats,paidBatchResult.stats,'v2 offline and frequent reads produce identical orders visits and receipts');
 equal(paidFrequentResult.marketing.history[0].results,paidBatchResult.marketing.history[0].results,'v2 campaign result is independent of polling frequency');
 equal(paidFrequentResult.followers,paidBatchResult.followers,'earned v2 followers are independent of polling frequency');
 equal(await money(paidFrequent.user),await money(paidBatch.user),'paid campaign cash reconciles for frequent and offline players');
 equal(await saleFacts(paidFrequent.user),await saleFacts(paidBatch.user),'v2 preparation and diffusion boundaries preserve identical per-sale economics');
 assert(paidBatchResult.marketing.history[0].results.satisfiedOrders>0,'real v2 diffusion produces satisfied orders');checks++;
 const historical=await player();
 await db.query(`UPDATE kq_online_accounts SET marketing_history=(SELECT jsonb_agg(jsonb_build_object('id',n,'code','behind-scenes','startedAt',now()-n*interval '1 day','completedAt',now()-n*interval '1 day')) FROM generate_series(1,12)n) WHERE user_id=$1`,[historical.user]);
 equal((await state(historical.user)).marketing.history.map(entry=>entry.id),[12,11,10,9,8,7,6,5,4,3],'snapshot exposes only the ten latest recorded campaign results');

 // Merchandise runs through the production command, settlement and accounting
 // functions. It stays physically and statistically independent of flower lots.
 const {KQ_MERCH_MODULES,KQ_MERCH_PRODUCTS,estimateKqMerchOffer}=await vite.ssrLoadModule('/src/lib/kanab-quest-merch.ts');
 for (const collection of KQ_MERCH_MODULES) {
  const rules={...collection};delete rules.name;
  equal(await scalar('SELECT kq_online_merch_module_catalog($1)',[collection.code]),rules,`${collection.code}: merch module client/SQL rules agree`);
 }
 for (const product of KQ_MERCH_PRODUCTS) {
  const rules={...product};delete rules.name;delete rules.description;
  equal(await scalar('SELECT kq_online_merch_catalog($1)',[product.code]),rules,`${product.code}: merch product client/SQL rules agree`);
 }
 async function merchPlayer(tier='studio') {
  const account=await player();
  await db.query('UPDATE kq_online_accounts SET site_tier=$2,total_packets=80,confidence=80,followers=200,branding=true WHERE user_id=$1',[account.user,tier]);
  await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()+interval '5 days',shop_renew=false WHERE user_id=$1",[account.user]);
  return account;
 }
 const emptyMerch=(await state(legacySiteUser)).merch;
 equal(emptyMerch,{version:1,modules:[],inventory:[],stats:{unitsSold:0,revenueCents:0,netRevenueCents:0,feesCents:0,stockCostCents:0,costOfGoodsSoldCents:0,moduleCostCents:0},recentSales:[]},'existing players explicitly receive an empty supported merch snapshot');
 const merch=await merchPlayer();
 const unchangedFlowerStats=(await state(merch.user)).stats;
 const unchangedFlower=await scalar('SELECT to_jsonb(s) FROM kq_commerce_stock s WHERE id=$1',[merch.stock]);
 for (const collection of KQ_MERCH_MODULES) {
  const startCash=await money(merch.user);
  for (const [field,value] of [['site_tier','basic'],['total_packets',collection.minimumOrders-1],['confidence',collection.minimumConfidence-1],['branding',false]]) {
   await db.exec('SAVEPOINT missing_merch_requirement');
   await db.query(`UPDATE kq_online_accounts SET ${field}=$2 WHERE user_id=$1`,[merch.user,value]);
   await reject(()=>command(merch.user,'buy-merch-module',{code:collection.code,orders:999,confidence:100,branding:true}),field==='branding'?'online_branding_required':'online_merch_progression_required');
   equal(await money(merch.user),startCash,`${collection.code}: missing ${field} never charges cash`);
   await db.exec('ROLLBACK TO SAVEPOINT missing_merch_requirement');
  }
  await db.exec('SAVEPOINT suspended_merch_module');
  await db.query('UPDATE kq_commerce_accounts SET shop_suspended=true WHERE user_id=$1',[merch.user]);
  await reject(()=>command(merch.user,'buy-merch-module',{code:collection.code}),'online_site_required');
  await db.exec('ROLLBACK TO SAVEPOINT suspended_merch_module');
  await db.exec('SAVEPOINT poor_merch_module');
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1',[merch.user,collection.costCents-1]);
  await reject(()=>command(merch.user,'buy-merch-module',{code:collection.code}),'online_cash');
  equal((await state(merch.user)).merch.modules.includes(collection.code),false,`${collection.code}: an unaffordable module is not installed`);
  await db.exec('ROLLBACK TO SAVEPOINT poor_merch_module');
  const key=randomUUID(),payload={code:collection.code,costCents:0};
  const bought=await command(merch.user,'buy-merch-module',payload,key);
  equal(bought.paidCents,collection.costCents,`${collection.code}: authoritative module price ignores forged client cost`);
  equal(await money(merch.user),startCash-collection.costCents,`${collection.code}: installed module is paid once`);
  equal((await command(merch.user,'buy-merch-module',payload,key)).replayed,true,`${collection.code}: module purchase replay succeeds`);
  equal(await money(merch.user),startCash-collection.costCents,`${collection.code}: replay cannot charge twice`);
  await reject(()=>command(merch.user,'buy-merch-module',{code:collection.code}),'online_merch_module_owned');
 }
 const noModule=await merchPlayer();
 await reject(()=>command(noModule.user,'buy-merch-stock',{code:'mug',quantity:10}),'online_merch_module_required');
 await command(noModule.user,'buy-merch-module',{code:'objects'});
 equal((await state(noModule.user)).merch.modules,['objects'],'objects can be acquired directly without paper or textile');
 await reject(()=>command(noModule.user,'update-merch',{code:'mug',priceCents:1600,active:true}),'online_merch_stock_required');
 for (const product of KQ_MERCH_PRODUCTS) {
  const before=await money(merch.user),key=randomUUID(),payload={code:product.code,quantity:10,unitCostCents:0,priceCents:1,active:true};
  const purchase=await command(merch.user,'buy-merch-stock',payload,key);
  equal(purchase.paidCents,product.unitCostCents*10,`${product.code}: server charges exact production cost`);
  let row=(await state(merch.user)).merch.inventory.find(item=>item.code===product.code);
  equal(row,{code:product.code,quantity:10,priceCents:product.referencePriceCents,active:false,sold:0,progress:0},`${product.code}: initial stock is unpublished at catalogue reference price`);
  await command(merch.user,'buy-merch-stock',payload,key);
  equal(await money(merch.user),before-product.unitCostCents*10,`${product.code}: stock replay is not charged twice`);
  equal((await state(merch.user)).merch.inventory.find(item=>item.code===product.code).quantity,10,`${product.code}: stock replay cannot duplicate inventory`);
  await reject(()=>command(merch.user,'buy-merch-stock',{code:product.code,quantity:491}),'online_merch_stock_limit');
  for (const quantity of [0,-1,1.5,501,'1',null]) await reject(()=>command(merch.user,'buy-merch-stock',{code:product.code,quantity}),'online_invalid_request');
 }
 for (const priceCents of [0,-1,1.5,100001,'100',null]) await reject(()=>command(merch.user,'update-merch',{code:'stickers',priceCents,active:true}),'online_invalid_request');
 await reject(()=>command(merch.user,'update-merch',{code:'stickers',priceCents:400,active:'true'}),'online_invalid_request');
 await reject(()=>command(merch.user,'buy-merch-module',{code:'free'}),'online_merch_unknown');
 await reject(()=>command(merch.user,'buy-merch-stock',{code:'free',quantity:1}),'online_merch_unknown');
 for (const code of ['stickers','poster','tote','tshirt']) {
  const product=KQ_MERCH_PRODUCTS.find(item=>item.code===code);
  await command(merch.user,'update-merch',{code,priceCents:product.referencePriceCents,active:true});
 }
 await reject(()=>command(merch.user,'update-merch',{code:'mug',priceCents:1600,active:true}),'online_merch_slots');
 await command(merch.user,'update-merch',{code:'stickers',priceCents:400,active:false});
 await command(merch.user,'update-merch',{code:'mug',priceCents:1600,active:true});
 equal((await state(merch.user)).merch.inventory.filter(item=>item.active).length,4,'one paused reference releases one studio display slot');
 await db.query("UPDATE kq_online_merch_inventory SET progress=.6 WHERE user_id=$1 AND code='mug'",[merch.user]);
 await command(merch.user,'update-merch',{code:'mug',priceCents:1600,active:true});
 equal((await state(merch.user)).merch.inventory.find(item=>item.code==='mug').progress,.6,'unchanged publication settings preserve legitimate progress');
 await command(merch.user,'buy-merch-stock',{code:'mug',quantity:2});
 equal((await state(merch.user)).merch.inventory.find(item=>item.code==='mug'),{code:'mug',quantity:12,priceCents:1600,active:true,sold:0,progress:.6},'restocking retains the chosen price, publication and demand progress');
 await command(merch.user,'update-merch',{code:'mug',priceCents:1700,active:true});
 equal((await state(merch.user)).merch.inventory.find(item=>item.code==='mug').progress,0,'changing price clears accumulated demand');
 await db.query("UPDATE kq_online_merch_inventory SET progress=.6 WHERE user_id=$1 AND code='mug'",[merch.user]);
 await db.exec('SAVEPOINT suspended_merch');
 await db.query('UPDATE kq_commerce_accounts SET shop_suspended=true WHERE user_id=$1',[merch.user]);
 await reject(()=>command(merch.user,'buy-merch-stock',{code:'mug',quantity:1}),'online_site_required');
 await reject(()=>command(merch.user,'update-merch',{code:'mug',priceCents:1700,active:true}),'online_site_required');
 await command(merch.user,'update-merch',{code:'mug',priceCents:1700,active:false});
 equal((await state(merch.user)).merch.inventory.find(item=>item.code==='mug').progress,0,'a suspended shop can pause a reference and reset its progress');
 await db.exec('ROLLBACK TO SAVEPOINT suspended_merch');
 equal((await state(merch.user)).stats,unchangedFlowerStats,'merch investments do not manufacture flower orders or visitors');
 equal(await scalar('SELECT to_jsonb(s) FROM kq_commerce_stock s WHERE id=$1',[merch.stock]),unchangedFlower,'merch investments leave flower inventory untouched');
 const stockValue=await scalar('SELECT kq_treasury_stock_cost($1)',[merch.user]);
 equal(Number(stockValue),KQ_MERCH_PRODUCTS.reduce((sum,product)=>sum+product.unitCostCents*(product.code==='mug'?12:10),0),'unsold merch is valued at production cost rather than retail price');
 equal(Number(await scalar("SELECT sum(cents) FROM audit_treasury_pairs WHERE user_id=$1 AND event='online-buy-merch-module'",[merch.user])),172000,'module investments enter the accounting expense ledger');

 // The same forecast tariff governs the private authoritative sale rate.
 const merchSnapshot=await state(merch.user);
 const merchClients=await scalar('SELECT clients FROM kq_commerce_accounts WHERE user_id=$1',[merch.user]);
 const merchRep=await scalar('SELECT reputation FROM kq_equipment_wallets WHERE user_id=$1',[merch.user]);
 for (const product of KQ_MERCH_PRODUCTS) for (const ratio of [.5,1,1.25,2,2.5]) {
  const priceCents=Math.round(product.referencePriceCents*ratio);
  const sqlRate=Number(await scalar('SELECT kq_online_merch_rate($1,$2,$3,now())',[merch.user,product.code,priceCents]));
  const clientRate=estimateKqMerchOffer({online:merchSnapshot,code:product.code,priceCents,reputation:merchRep,clients:merchClients}).unitsPerDay;
  assert(Math.abs(sqlRate-clientRate)<1e-10,`${product.code}: SQL and client merch cadence agree at price ratio ${ratio}`); checks++;
 }
 const stickerRate=Number(await scalar("SELECT kq_online_merch_rate($1,'stickers',400,now())",[merch.user]));
 const tshirtRate=Number(await scalar("SELECT kq_online_merch_rate($1,'tshirt',2800,now())",[merch.user]));
 assert(stickerRate>tshirtRate*4,'reference-price stickers rotate over four times faster than higher-value shirts');checks++;
 assert(Math.abs(stickerRate/tshirtRate-3/.65)<1e-10,'each reference retains its own demand factor after sharing the audience');checks++;
 await db.exec('SAVEPOINT isolated_merch_audience');
 const organicMerchRate=await scalar("SELECT kq_online_merch_rate($1,'stickers',400,now())",[merch.user]);
 await db.query("UPDATE kq_commerce_accounts SET advertising=jsonb_build_object('startedAt',now()-interval '1 hour','endsAt',now()+interval '1 hour','boostPercent',100) WHERE user_id=$1",[merch.user]);
 await db.query("UPDATE kq_online_accounts SET marketing=jsonb_build_object('version',2,'launchesAt',now()-interval '1 hour','endsAt',now()+interval '1 hour','visitorsPerDay',9999) WHERE user_id=$1",[merch.user]);
 equal(await scalar("SELECT kq_online_merch_rate($1,'stickers',400,now())",[merch.user]),organicMerchRate,'flower advertising and targeted campaigns never multiply merch demand');
 await db.exec('ROLLBACK TO SAVEPOINT isolated_merch_audience');
 await db.exec('SAVEPOINT no_merch_brand');
 await db.query('UPDATE kq_online_accounts SET branding=false WHERE user_id=$1',[merch.user]);
 equal(Number(await scalar("SELECT kq_online_merch_rate($1,'stickers',400,now())",[merch.user])),0,'merch demand remains blocked without its acquired brand');
 await db.exec('ROLLBACK TO SAVEPOINT no_merch_brand');

 async function stockedMerch(quantity=100,priceCents=400) {
  const account=await merchPlayer();
  await command(account.user,'buy-merch-module',{code:'paper'});
  await command(account.user,'buy-merch-stock',{code:'stickers',quantity});
  await command(account.user,'update-merch',{code:'stickers',priceCents,active:true});
  return account;
 }
 async function rewindMerch(account,hours) {
  await db.query("UPDATE kq_online_accounts SET settled_until=now()-$2*interval '1 hour',growth_day=(now()-$2*interval '1 hour')::date WHERE user_id=$1",[account.user,hours]);
  await db.query("UPDATE kq_commerce_accounts SET shop_created_at=now()-$2*interval '1 hour',business_started_at=now()-$2*interval '1 hour',demand_updated_at=now()-$2*interval '1 hour' WHERE user_id=$1",[account.user,hours]);
  await db.query("UPDATE kq_online_merch_inventory SET created_at=now()-$2*interval '1 hour',changed_at=now()-$2*interval '1 hour' WHERE user_id=$1",[account.user,hours]);
 }
 const merchBatch=await stockedMerch(),merchFrequent=await stockedMerch();
 const pennyMerch=await stockedMerch(2,1);
 await db.query('UPDATE kq_online_accounts SET fee_exact=.475,fee_rounded=0 WHERE user_id=$1',[pennyMerch.user]);
 await db.query('UPDATE kq_commerce_accounts SET vat_sales_ttc_cents=20 WHERE user_id=$1',[pennyMerch.user]);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1',[pennyMerch.user]);
 for (let unit=1;unit<=2;unit++) {
  await db.query("UPDATE kq_online_merch_inventory SET progress=1 WHERE user_id=$1 AND code='stickers'",[pennyMerch.user]);
  await db.query("SELECT kq_online_merch_dispatch($1,'stickers',now())",[pennyMerch.user]);
 }
 const pennyResult=(await state(pennyMerch.user)).merch;
 equal(pennyResult.stats.netRevenueCents,0,'minimum one-cent prices never create a negative payout when VAT and fees round up together');
 equal(pennyResult.stats.feesCents,1,'the deferred fee cent is recovered on the next available one-cent payment');
 equal(await scalar('SELECT fee_rounded=round(fee_exact) FROM kq_online_accounts WHERE user_id=$1',[pennyMerch.user]),true,'one-cent deferral still reconciles the exact cumulative fee after the next sale');
 for (const account of [merchBatch,merchFrequent]) await rewindMerch(account,72);
 for(let hours=65;hours>=0;hours-=7) await db.query("SELECT kq_online_settle_until($1,now()-$2*interval '1 hour')",[merchFrequent.user,hours]);
 const merchBatchResult=await state(merchBatch.user),merchFrequentResult=await state(merchFrequent.user);
 equal(merchFrequentResult.merch.stats,merchBatchResult.merch.stats,'merch purchases, turnover, fees and costs are independent of polling frequency');
 equal(await money(merchFrequent.user),await money(merchBatch.user),'frequent and offline merch settlement credit the same wallet amount');
 const merchSaleFacts=id=>db.query('SELECT unit_number,price_cents,net_payout_cents,fee_cents,vat_cents,cost_cents FROM kq_online_merch_sales WHERE user_id=$1 ORDER BY unit_number',[id]).then(result=>result.rows);
 equal(await merchSaleFacts(merchFrequent.user),await merchSaleFacts(merchBatch.user),'merch per-unit tax, fees and receipts are independent of polling frequency');
 assert(merchBatchResult.merch.stats.unitsSold>0,'real settlement sells merch without any flower listing');checks++;
 equal(merchBatchResult.stats.orders,0,'merch sales do not unlock flower-order milestones');
 equal(merchBatchResult.stats.soldGrams,0,'merch articles never appear as sold grams');
 equal(merchBatchResult.followers,200,'merch sales do not create followers');
 equal(merchBatchResult.confidence,80,'merch sales do not inflate flower trust');
 equal((await state(merchBatch.user)).merch.stats,merchBatchResult.merch.stats,'repeat settlement cannot ship the same unit twice');
 const soldStats=merchBatchResult.merch.stats;
 equal(soldStats.revenueCents,soldStats.unitsSold*400,'merch revenue matches real unit sales');
 equal(soldStats.costOfGoodsSoldCents,soldStats.unitsSold*80,'cost of goods sold counts only shipped units');
 equal(Number(await scalar("SELECT sum(cents) FROM audit_treasury_pairs WHERE user_id=$1 AND event IN ('merch-sale','merch-vat')",[merchBatch.user])),soldStats.revenueCents,'merch sales post both net revenue and VAT to accounting');
 equal(Number(await scalar('SELECT kq_treasury_stock_cost($1)',[merchBatch.user])),(100-soldStats.unitsSold)*80,'inventory valuation decreases by exactly the shipped cost');
 const lastUnit=await stockedMerch(1);
 await rewindMerch(lastUnit,72); const lastUnitState=await state(lastUnit.user);
 equal(lastUnitState.merch.inventory[0],{code:'stickers',quantity:0,priceCents:400,active:false,sold:1,progress:0},'selling the last unit releases the slot and resets demand');
 await command(lastUnit.user,'buy-merch-stock',{code:'stickers',quantity:1});
 equal((await state(lastUnit.user)).merch.inventory[0].active,false,'restocking a sold-out reference never silently reopens it');
 const rejectedMerch=await stockedMerch(10,1000);
 await rewindMerch(rejectedMerch,72);
 equal((await state(rejectedMerch.user)).merch.stats.unitsSold,0,'a merch price at total refusal produces no phantom sales');
 const suspendedMerch=await stockedMerch();
 await rewindMerch(suspendedMerch,72);
 await db.query('UPDATE kq_commerce_accounts SET shop_suspended=true WHERE user_id=$1',[suspendedMerch.user]);
 equal((await state(suspendedMerch.user)).merch.stats.unitsSold,0,'a suspended site cannot sell merch during catchup');
 const boundaryMerch=await stockedMerch();
 await rewindMerch(boundaryMerch,24);
 await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()-interval '12 hours',shop_renew=false WHERE user_id=$1",[boundaryMerch.user]);
 await state(boundaryMerch.user);
 equal(await scalar("SELECT count(*)::int FROM kq_online_merch_sales WHERE user_id=$1 AND occurred_at>=now()-interval '12 hours'",[boundaryMerch.user]),0,'a subscription deadline suspends merch before any later sale');
 const merchRenewal=await stockedMerch(100);
 await rewindMerch(merchRenewal,72);
 await db.query("UPDATE kq_online_accounts SET site_tier='improved',followers=5000 WHERE user_id=$1",[merchRenewal.user]);
 await db.query("UPDATE kq_commerce_accounts SET clients=50,shop_paid_until=now()-interval '24 hours',shop_renew=true WHERE user_id=$1",[merchRenewal.user]);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1',[merchRenewal.user]);
 const merchRenewalResult=await state(merchRenewal.user);
 equal(merchRenewalResult.site.active,true,'merch income earned before expiry can actually fund the next subscription');
 equal(await scalar("SELECT count(*)::int FROM kq_business_ledger WHERE user_id=$1 AND kind='shop-renewed' AND amount_cents=3000",[merchRenewal.user]),1,'merch-funded renewal is charged once at the current site tariff');
 // A modest selling price leaves part of the invoice due after the date-time
 // attempt even with the faster sticker rotation, so later sale withholding runs.
 const merchDebt=await stockedMerch(100,100);
 await rewindMerch(merchDebt,72);
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1',[merchDebt.user]);
 await db.query("INSERT INTO kq_lab_invoices(run_id,user_id,due_at) SELECT run_id,$1,now()-interval '12 hours' FROM kq_flowers WHERE id=$2",[merchDebt.user,merchDebt.flower]);
 await state(merchDebt.user);
 equal(await scalar("SELECT bool_and(lab_paid_cents=0) FROM kq_online_merch_sales WHERE user_id=$1 AND occurred_at<now()-interval '12 hours'",[merchDebt.user]),true,'merch sales cannot pay a laboratory debt that was not yet due');
 assert(await scalar("SELECT sum(lab_paid_cents)>0 FROM kq_online_merch_sales WHERE user_id=$1 AND occurred_at>=now()-interval '12 hours'",[merchDebt.user]),'merch receipts repay an actually due laboratory debt');checks++;
 const merchScheduled=await stockedMerch();
 await rewindMerch(merchScheduled,72);
 await scalar('SELECT rpc_kq_online_settle_due(1000)');
 assert(await scalar('SELECT count(*)>0 FROM kq_online_merch_sales WHERE user_id=$1',[merchScheduled.user]),'the worker settles a merch-only account with no flower listings or campaign');checks++;
 const rollbackMerch=await merchPlayer();
 await command(rollbackMerch.user,'buy-merch-module',{code:'paper'});
 await db.query('UPDATE kq_equipment_wallets SET cash_cents=79 WHERE user_id=$1',[rollbackMerch.user]);
 const poorMerchKey=randomUUID();
 await reject(()=>command(rollbackMerch.user,'buy-merch-stock',{code:'stickers',quantity:1},poorMerchKey),'online_cash');
 equal((await state(rollbackMerch.user)).merch.inventory,[],'unaffordable stock rolls back all inventory writes');
 equal(await scalar('SELECT count(*)::int FROM kq_online_requests WHERE user_id=$1 AND request_key=$2',[rollbackMerch.user,poorMerchKey]),0,'failed merchandise purchase leaves no success receipt');
 const {KQ_STUDIO_LEVELS}=await vite.ssrLoadModule('/src/lib/kanab-quest-studio.ts');
 equal(KQ_STUDIO_LEVELS.length,9,'nine permanent studio upgrades are published');
 for(const spec of KQ_STUDIO_LEVELS) equal(await scalar('SELECT kq_online_studio_catalog($1,$2)',[spec.track,spec.level]),{
  track:spec.track,level:spec.level,costCents:spec.costCents,minimumLevel:spec.minimumSiteLevel,
  minimumOrders:spec.minimumOrders,minimumConfidence:spec.minimumConfidence,
  requiresPhotography:spec.requiredLevels.photography??0,requiresBranding:spec.requiredLevels.branding??0,
 },`${spec.track} ${spec.level}: studio SQL and client costs and requirements agree`);
 equal(await scalar("SELECT kq_online_studio_catalog('free',1)"),null,'unknown studio tracks have no catalogue entry');
 equal(await scalar("SELECT kq_online_studio_catalog('photography',4)"),null,'the studio has no fourth level');
 const creative=await player();
 await db.query("UPDATE kq_online_accounts SET site_tier='flagship',total_packets=350,confidence=90,followers=300 WHERE user_id=$1",[creative.user]);
 await db.query("UPDATE kq_commerce_accounts SET shop_paid_until=now()+interval '120 hours',shop_suspended=false WHERE user_id=$1",[creative.user]);
 const studioInitial=await state(creative.user),studioCash=await money(creative.user);
 await reject(()=>command(creative.user,'choose-studio-style',{style:'clear'}),'online_studio_style_required');
 for(const [field,value] of [['shop_paid_until',null],['computer_owned',false],['shop_created_at',null]]) {
  await db.exec('SAVEPOINT incomplete_studio_site');
  await db.query(`UPDATE kq_commerce_accounts SET ${field}=$2 WHERE user_id=$1`,[creative.user,value]);
  await reject(()=>command(creative.user,'buy-studio-level',{track:'photography',level:1}),'online_site_required');
  await db.exec('ROLLBACK TO SAVEPOINT incomplete_studio_site');
 }
 for(const track of ['photography','branding','editorial']) {
  await reject(()=>command(creative.user,'buy-studio-level',{track,level:2}),'online_studio_sequence');
  for(const spec of KQ_STUDIO_LEVELS.filter(item=>item.track===track).sort((a,b)=>a.level-b.level)) {
   const before=await money(creative.user);
   for(const [field,minimum] of [['total_packets',spec.minimumOrders],['confidence',spec.minimumConfidence]]) {
    if(!minimum) continue;
    await db.exec('SAVEPOINT studio_requirement');
    await db.query(`UPDATE kq_online_accounts SET ${field}=$2 WHERE user_id=$1`,[creative.user,minimum-1]);
    await reject(()=>command(creative.user,'buy-studio-level',{track,level:spec.level,orders:99999,confidence:100,costCents:0}),'online_studio_progression_required');
    equal(await money(creative.user),before,`${track} ${spec.level}: missing ${field} does not debit cash`);
    await db.exec('ROLLBACK TO SAVEPOINT studio_requirement');
   }
   if(spec.minimumSiteLevel>1) {
    await db.exec('SAVEPOINT studio_site');
    const tooLow=KQ_ONLINE_SITE_TIERS.find(tier=>tier.level===spec.minimumSiteLevel-1);
    await db.query('UPDATE kq_online_accounts SET site_tier=$2 WHERE user_id=$1',[creative.user,tooLow.code]);
    await reject(()=>command(creative.user,'buy-studio-level',{track,level:spec.level}),'online_studio_progression_required');
    await db.exec('ROLLBACK TO SAVEPOINT studio_site');
   }
   for(const [required,minimum] of Object.entries(spec.requiredLevels)) {
    await db.exec('SAVEPOINT studio_dependency');
    await db.query(`UPDATE kq_online_accounts SET studio_${required}_level=$2,${required}=$3 WHERE user_id=$1`,[creative.user,minimum-1,minimum>1]);
    await reject(()=>command(creative.user,'buy-studio-level',{track,level:spec.level,levels:{photography:3,branding:3}}),'online_studio_progression_required');
    await db.exec('ROLLBACK TO SAVEPOINT studio_dependency');
   }
   await db.exec('SAVEPOINT studio_suspended');
   await db.query('UPDATE kq_commerce_accounts SET shop_suspended=true WHERE user_id=$1',[creative.user]);
   await reject(()=>command(creative.user,'buy-studio-level',{track,level:spec.level}),'online_site_required');
   await db.exec('ROLLBACK TO SAVEPOINT studio_suspended');
   await db.exec('SAVEPOINT studio_poor');
   await db.query('UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1',[creative.user,spec.costCents-1]);
   const poorKey=randomUUID();
   await reject(()=>command(creative.user,'buy-studio-level',{track,level:spec.level},poorKey),'online_cash');
   equal((await state(creative.user)).studio.levels[track],spec.level-1,`${track} ${spec.level}: failed debit rolls back the level`);
   equal(await scalar('SELECT count(*)::int FROM kq_online_requests WHERE user_id=$1 AND request_key=$2',[creative.user,poorKey]),0,`${track} ${spec.level}: failed debit records no success receipt`);
   await db.exec('ROLLBACK TO SAVEPOINT studio_poor');
   const key=randomUUID(),payload={track,level:spec.level,costCents:0};
   const receipt=await command(creative.user,'buy-studio-level',payload,key);
   equal(receipt.paidCents,spec.costCents,`${track} ${spec.level}: the server charges the exact incremental cost`);
   equal(await money(creative.user),before-spec.costCents,`${track} ${spec.level}: the wallet loses the paid amount once`);
   equal((await command(creative.user,'buy-studio-level',payload,key)).replayed,true,`${track} ${spec.level}: receipt replays`);
   equal(await money(creative.user),before-spec.costCents,`${track} ${spec.level}: replay cannot charge again`);
   equal((await state(creative.user)).studio.levels[track],spec.level,`${track} ${spec.level}: installed level is authoritative`);
   await reject(()=>command(creative.user,'buy-studio-level',{track,level:spec.level}),'online_studio_sequence');
  }
  await reject(()=>command(creative.user,'buy-studio-level',{track,level:1}),'online_studio_sequence');
 }
 const studioTotal=KQ_STUDIO_LEVELS.reduce((sum,spec)=>sum+spec.costCents,0);
 equal(await money(creative.user),studioCash-studioTotal,'all studio levels debit only their summed incremental costs');
 equal(Number(await scalar("SELECT sum(cents) FROM audit_treasury_pairs WHERE user_id=$1 AND event='online-buy-studio-level'",[creative.user])),studioTotal,'studio investments enter the expense ledger');
 equal((await state(creative.user)).upgrades,{photography:true,branding:true},'studio levels retain packaging and website legacy requirements');
 equal((await state(creative.user)).stats,studioInitial.stats,'studio investments do not invent orders, visits or sales');
 for(const level of [0,4,-1,1.5,'1',null]) await reject(()=>command(creative.user,'buy-studio-level',{track:'photography',level}),'online_invalid_request');
 await reject(()=>command(creative.user,'buy-studio-level',{track:'free',level:1}),'online_studio_unknown');
 await reject(()=>command(creative.user,'choose-studio-style',{style:'free'}),'online_studio_unknown');
 await reject(()=>command(creative.user,'buy-upgrade',{code:'photography'}),'online_invalid_request');
 await reject(()=>command(creative.user,'buy-upgrade',{code:'branding'}),'online_invalid_request');
 const oldUpgrade=await player();
 await command(oldUpgrade.user,'buy-upgrade',{code:'photography'});
 await command(oldUpgrade.user,'buy-upgrade',{code:'branding'});
 equal((await state(oldUpgrade.user)).studio.levels,{photography:1,branding:1,editorial:0},'legacy upgrade commands synchronize the new studio levels');
 await reject(()=>command(oldUpgrade.user,'buy-studio-level',{track:'photography',level:1}),'online_studio_sequence');
 await reject(()=>command(oldUpgrade.user,'buy-studio-level',{track:'branding',level:1}),'online_studio_sequence');
 const noSite=randomUUID();
 await db.query('INSERT INTO auth.users VALUES($1)',[noSite]); await state(noSite);
 await reject(()=>command(noSite,'buy-studio-level',{track:'photography',level:1}),'online_site_required');
 await reject(()=>command(noSite,'choose-studio-style',{style:'craft'}),'online_site_required');
 await command(creative.user,'buy-packaging',{code:'kraft-5',quantity:10});
 const creativeListing=(await command(creative.user,'create-listing',{stockId:creative.stock,formatGrams:5,packagingCode:'kraft-5',packets:10,packetPriceCents:1000})).listingId;
 for(const collection of KQ_MERCH_MODULES) await command(creative.user,'buy-merch-module',{code:collection.code});
 for(const product of KQ_MERCH_PRODUCTS) await command(creative.user,'buy-merch-stock',{code:product.code,quantity:1});
 await command(creative.user,'update-merch',{code:'tote',priceCents:1800,active:true});
 await db.query('UPDATE kq_online_listings SET order_progress=.6 WHERE id=$1',[creativeListing]);
 await db.query("UPDATE kq_online_merch_inventory SET progress=.7 WHERE user_id=$1 AND code='tote'",[creative.user]);
 const styleWallet=await money(creative.user);
 for(const style of ['clear','craft','signature']) {
  const key=randomUUID();
  await command(creative.user,'choose-studio-style',{style},key);
  equal((await command(creative.user,'choose-studio-style',{style},key)).replayed,true,`${style}: direction choice replays safely`);
  equal((await state(creative.user)).studio.style,style,`${style}: artistic direction persists`);
  equal(await money(creative.user),styleWallet,`${style}: choosing a direction is free`);
  equal(Number(await scalar('SELECT order_progress FROM kq_online_listings WHERE id=$1',[creativeListing])),.6,`${style}: direction changes preserve accumulated flower demand`);
  equal(Number(await scalar("SELECT progress FROM kq_online_merch_inventory WHERE user_id=$1 AND code='tote'",[creative.user])),.7,`${style}: direction changes preserve accumulated merch demand`);
  for(const editorial of [0,1,2,3]) {
   await db.query('UPDATE kq_online_accounts SET studio_editorial_level=$2 WHERE user_id=$1',[creative.user,editorial]);
   for(const ratio of [.9,1,1.05,1.2,1.3,1.5,2]) {
    for(const quality of [7,7.5,8.5,9]) {
     const match=style==='clear'?ratio<=1.05:style==='craft'?quality>=7.5&&ratio<=1.3:quality>=8.5&&ratio>=1&&ratio<=1.5;
     const expected=1.26*1.2*(editorial===0?1:match?1+.04*editorial:1-.02*editorial);
     const actual=Number(await scalar('SELECT kq_online_studio_flower_multiplier($1,$2,$3)',[creative.user,quality,ratio]));
     assert(Math.abs(actual-expected)<1e-12,`${style} level ${editorial}: flower quality ${quality}, ratio ${ratio} uses exact match/compromise`);checks++;
    }
    const packetPriceCents=Math.round(1000*ratio);
    await db.query('UPDATE kq_online_listings SET packet_price_cents=$2 WHERE id=$1',[creativeListing,packetPriceCents]);
    const current=await state(creative.user),listing=current.listings.find(item=>item.id===creativeListing);
    const projected=estimateKqOnlineOffer({online:current,route:listing.route,varietyCode:listing.varietyCode,quality:listing.qualityScore,
     baseUnitCents:listing.baseUnitCents,formatGrams:listing.formatGrams,packagingCode:listing.packagingCode,packetPriceCents,
     reputation:0,clients:0});
    assert(Math.abs(listing.offer.ordersPerDay-projected.ordersPerDay)<1e-10,`${style} level ${editorial}: client and SQL flower orders agree at ${packetPriceCents} cents`);checks++;
    equal(listing.offer.visitorsPerDay,projected.visitorsPerDay,`${style} level ${editorial}: studio leaves actual audience intact`);
    for(const product of KQ_MERCH_PRODUCTS) {
     const priceCents=Math.round(product.referencePriceCents*ratio);
     const serverRate=Number(await scalar('SELECT kq_online_merch_rate($1,$2,$3,now())',[creative.user,product.code,priceCents]));
     const clientRate=estimateKqMerchOffer({online:current,code:product.code,priceCents,reputation:0,clients:0}).unitsPerDay;
     assert(Math.abs(serverRate-clientRate)<1e-10,`${style} level ${editorial}: client and SQL ${product.code} cadence agree at ratio ${ratio}`);checks++;
    }
   }
  }
 }
 await db.query('UPDATE kq_commerce_accounts SET shop_suspended=true WHERE user_id=$1',[creative.user]);
 await command(creative.user,'choose-studio-style',{style:'clear'});
 equal((await state(creative.user)).studio.style,'clear','a suspended shop may prepare its artistic direction');
 for(const role of ['anon','authenticated','service_role']) for(const fn of ['kq_online_studio_catalog(text,integer)','kq_online_studio_snapshot(uuid)',
  'kq_online_studio_editorial_multiplier(integer,boolean)','kq_online_studio_flower_multiplier(uuid,numeric,numeric)',
  'kq_online_studio_merch_multiplier(uuid,text,numeric)','kq_online_studio_command(uuid,text,jsonb)']) {
  equal(await scalar('SELECT has_function_privilege($1,$2,$3)',[role,fn,'EXECUTE']),false,`${role}: ${fn} remains private`);
 }
 for (const role of ['anon','authenticated','service_role']) {
  for (const table of ['kq_online_merch_modules','kq_online_merch_inventory','kq_online_merch_sales']) {
   equal(await scalar('SELECT has_table_privilege($1,$2,$3)',[role,table,'SELECT,INSERT,UPDATE,DELETE']),false,`${role}: ${table} is private to RPCs`);
  }
  for (const func of ['kq_online_merch_module_catalog(text)','kq_online_merch_catalog(text)','kq_online_merch_command(uuid,text,jsonb)','kq_online_merch_rate(uuid,text,integer,timestamptz)','kq_online_merch_dispatch(uuid,text,timestamptz)','kq_online_merch_snapshot(uuid)']) {
   equal(await scalar('SELECT has_function_privilege($1,$2,$3)',[role,func,'EXECUTE']),false,`${role}: ${func} is not a public money or data entry point`);
  }
 }
 equal(await scalar("SELECT has_function_privilege('service_role','kq_online_marketing_plan(uuid,jsonb,timestamptz)','EXECUTE')"),false,'campaign planning helper remains private to authoritative RPCs');
 equal(await scalar("SELECT has_function_privilege('anon','kq_online_marketing_results(uuid,jsonb,timestamptz)','EXECUTE')"),false,'anonymous users cannot inspect campaign sales');
 equal(await scalar("SELECT has_table_privilege('service_role','kq_online_listings','INSERT')"),false,'listings are only writable through RPCs');
 equal(await scalar("SELECT has_function_privilege('anon','rpc_kq_online_command(uuid,text,jsonb,uuid)','EXECUTE')"),false,'anonymous users cannot mutate commerce');
 equal(await scalar("SELECT has_function_privilege('service_role','rpc_kq_online_command(uuid,text,jsonb,uuid)','EXECUTE')"),true,'server has explicit RPC permission');
 for (const role of ['anon','authenticated','service_role']) {
  equal(await scalar('SELECT has_table_privilege($1,$2,$3)',[role,'kq_online_accounts','SELECT,INSERT,UPDATE,DELETE']),false,`${role}: website accounts remain private to RPCs`);
  equal(await scalar('SELECT has_function_privilege($1,$2,$3)',[role,'kq_online_site_catalog(text)','EXECUTE']),false,`${role}: website catalogue helper is private`);
  equal(await scalar('SELECT has_function_privilege($1,$2,$3)',[role,'kq_online_snapshot(uuid)','EXECUTE']),false,`${role}: website snapshot helper is private`);
 }
 await db.exec('ROLLBACK');
 console.log(`Online commerce: ${checks} PostgreSQL checks passed.`);
} catch (error) {
 console.error(error.message,error.where??'');
 const line=Number(error.where?.match(/rpc_kq_commerce_command[^\n]* line (\d+)/)?.[1]);
 if (line) {
  await db.exec('ROLLBACK');
  const body=await scalar("SELECT prosrc FROM pg_proc WHERE oid='rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure");
  console.error(body.split('\n').slice(line-3,line+1).join('\n'));
 }
 process.exitCode=1;
} finally { await db.close();await vite.close(); }
