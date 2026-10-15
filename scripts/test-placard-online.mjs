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
 // These fixtures represent campaigns already running before version 2 shipped.
 const legacyMarketing=(user,code='introduction',angle='craft')=>db.query(`UPDATE kq_online_accounts SET marketing=jsonb_build_object(
  'id',gen_random_uuid(),'code',$2::text,'angle',$3::text,'startedAt',now(),
  'endsAt',now()+(kq_online_marketing_catalog($2)->>'durationHours')::int*interval '1 hour') WHERE user_id=$1`,[user,code,angle]);
 const p=await player();
 const basicSite=(await state(p.user)).site;
 equal({...basicSite,createdAt:new Date(basicSite.createdAt).toISOString()},{tier:'basic',createdAt:new Date(now).toISOString(),active:true,paidUntil:null,renew:false,feePercent:2.5},'free template, no subscription');
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
 equal(await scalar("SELECT has_function_privilege('service_role','kq_online_marketing_plan(uuid,jsonb,timestamptz)','EXECUTE')"),false,'campaign planning helper remains private to authoritative RPCs');
 equal(await scalar("SELECT has_function_privilege('anon','kq_online_marketing_results(uuid,jsonb,timestamptz)','EXECUTE')"),false,'anonymous users cannot inspect campaign sales');
 equal(await scalar("SELECT has_table_privilege('service_role','kq_online_listings','INSERT')"),false,'listings are only writable through RPCs');
 equal(await scalar("SELECT has_function_privilege('anon','rpc_kq_online_command(uuid,text,jsonb,uuid)','EXECUTE')"),false,'anonymous users cannot mutate commerce');
 equal(await scalar("SELECT has_function_privilege('service_role','rpc_kq_online_command(uuid,text,jsonb,uuid)','EXECUTE')"),true,'server has explicit RPC permission');
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
