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
    CREATE FUNCTION kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT';
    CREATE FUNCTION kq_treasury_pair(UUID,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,BIGINT,TEXT) RETURNS VOID LANGUAGE sql AS 'SELECT';`);
   const bank=await sql('20260924000100_kq_bank_monthly_installments.sql');
   await db.exec(bank.match(/CREATE OR REPLACE FUNCTION public\.kq_bank_settle\(p_user UUID\)[\s\S]*?\$\$;/)[0]);
   let business=await scalar("SELECT pg_get_functiondef('kq_business_settle(uuid)'::regprocedure)");
   business=business.replace('SELECT cash_cents INTO cash FROM public.kq_equipment_wallets', 'PERFORM public.kq_bank_settle(p_user); SELECT cash_cents INTO cash FROM public.kq_equipment_wallets');
   await db.exec(business);
  }
  await db.exec(await sql(name));
 }
 // Exercise the production post-harvest quality calculation in the commerce
 // fixture too. Its warehouse installation triggers are unrelated to a sale.
 const postHarvestSql=await sql('20261018000500_kq_postharvest_quality.sql');
 for (const name of ['kq_storage_settle','kq_storage_condition']) {
  const definition=postHarvestSql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert.ok(definition,`production definition for ${name}`);
  await db.exec(definition[0]);
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

 const {quoteKqCommerce}=await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts');
 const {projectKqStorageLot}=await vite.ssrLoadModule('/src/lib/kanab-quest-storage.ts');
 const {previewKqBusinessPayment}=await vite.ssrLoadModule('/src/lib/kanab-quest-business.ts');
 const {createKqCustomerDemandSnapshot,getKqCustomerDemandRequest,getKqCustomerDemandPrice}=await vite.ssrLoadModule('/src/lib/kanab-quest-customer-demand.ts');
 const {KQ_BUDDIE_FLAVOR_PROFILES}=await vite.ssrLoadModule('/src/lib/kanab-quest-buddie-flavors.ts');
 for(const [code,profile] of Object.entries(KQ_BUDDIE_FLAVOR_PROFILES)) {
  equal(await scalar('SELECT kq_customer_demand_flavors($1)',[code]),profile.flavors,'SQL/TS profile parity '+code);
 }
 equal(await scalar("SELECT kq_customer_demand_flavors('unknown')"),[],'unknown variety cannot claim a flavor');
 const normalizeDates=value=>({...value,serverNow:new Date(value.serverNow).toISOString(),startsAt:new Date(value.startsAt).toISOString(),endsAt:new Date(value.endsAt).toISOString()});
 for (const date of ['2026-10-12T00:00:00Z','2026-10-13T23:59:59Z','2026-10-14T00:00:00Z','2026-10-15T00:00:00Z','1969-12-31T23:00:00Z']) {
  equal(normalizeDates(await scalar('SELECT kq_customer_demand_snapshot($1,$2)',[randomUUID(),date])),createKqCustomerDemandSnapshot(Date.parse(date)),'SQL/TS exact UTC calendar, preview and negative modulo '+date);
 }
 for (const period of [0,1,6900,-1,-20]) for (const channel of ['online','cbd-shop','wholesale']) {
  equal(await scalar('SELECT kq_customer_demand_request($1,$2)',[period,channel]),getKqCustomerDemandRequest(period,channel),'SQL/TS request '+period+'/'+channel);
 }
 const roundingAccount=await player();
 const roundingSnapshot=await scalar('SELECT rpc_kq_commerce_state($1)',[roundingAccount.user]);
 const roundingStock=roundingSnapshot.stocks[0];
 for(const [base,bonus,units,remaining] of [[210,5,64,7],[210,5,192,97],[210,5,33,3],[210,5,45,1],[300,7.5,73,17],[300,12.5,111,13]]) {
  const rounded=getKqCustomerDemandPrice(base,units,{...getKqCustomerDemandRequest(1,'wholesale'),bonusPercent:bonus,remainingUnits:remaining,matchedFlavorCount:1});
  const precise=Number(await scalar('SELECT round($1::numeric*(1+$2::numeric*$3::numeric/$4::numeric/100),6)',[base,bonus,remaining,units]));
  equal(rounded.unitCents,precise,'partial premium uses PostgreSQL decimal rounding '+[base,bonus,units,remaining].join('/'));
  const channel=base===300?'cbd-shop':'wholesale';
  const demand={...getKqCustomerDemandRequest(roundingSnapshot.customerDemand.period,channel),bonusPercent:bonus,remainingUnits:remaining};
  const priced=quoteKqCommerce({...roundingSnapshot,customerDemand:{...roundingSnapshot.customerDemand,requests:[demand]}},
   {...roundingStock,varietyCode:demand.varietyCode,payoutExact:12345.678901,payoutRounded:12346,
    storage:projectKqStorageLot(roundingStock.storageState,Date.parse(now),roundingStock.juryScore)},channel,'advised',units,Date.parse(now));
  equal(priced.payoutExactAfter,Number(await scalar('SELECT round(12345.678901+$1::numeric*$2::numeric/10,6)',[units,precise])),
   'fractional sale accumulates the same exact payout as PostgreSQL '+[base,bonus,units,remaining].join('/'));
 }
 async function storedQuote(account,channel,units,transformStock=stock=>stock) {
  const snapshot=await scalar('SELECT rpc_kq_commerce_state($1)',[account.user]);
  const rawStock=snapshot.stocks.find(s=>s.id===account.stock);
  const stock={...rawStock,storage:projectKqStorageLot(rawStock.storageState,Date.parse(now),rawStock.juryScore)};
  const offer=quoteKqCommerce(snapshot,transformStock(stock),channel,'advised',units,Date.parse(now));
  Object.assign(offer,previewKqBusinessPayment(offer.payoutCents,snapshot.business,0));
  const quoteId=randomUUID();
  await db.query(`INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at,storage_revision)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now()+interval '1 minute',$10)`,
  [quoteId,account.user,account.stock,snapshot.revision,snapshot.campaign?.id??null,snapshot.campaign?.revision??null,stock.remainingUnits,snapshot.reputation,JSON.stringify(offer),rawStock.storageRevision]);
  return {quoteId,offer};
 }
 const sell=(account,quote,key=randomUUID())=>scalar("SELECT rpc_kq_commerce_command($1,'sell',$2::jsonb,$3)",[account.user,JSON.stringify({quoteId:quote.quoteId,expectedPayoutCents:quote.offer.payoutCents}),key]);
 const request=async(account,channel,at=now)=>scalar('SELECT kq_customer_demand_remaining($1,$2,$3)',[account.user,channel,at]);
 const match=async(account,channel,at=now)=>{
  const demand=await request(account,channel,at);
  await db.query('UPDATE kq_flowers SET variety_code=$2 WHERE id=$1',[account.flower,demand.varietyCode]);
  return demand;
 };
 // A fresh quote must remain acceptable when drying/curing crosses a quality
 // band. Previously TS discarded positive qualityDelta while SQL retained it.
 for (const [route,channel,juryScore,dryingBonus,expectedQuality] of [
  ['raw','cbd-shop',8.5,.7,9.2],
  ['raw','cbd-shop',6.3,.7,7],
  ['raw','wholesale',6.3,.7,7],
  ['dry-sift','cbd-shop',8.5,.7,9.2],
  ['dry-sift','wholesale',8.5,.7,9.2],
  ['rosin-trial','cbd-shop',9.4,.7,10],
 ]) {
  const account=await player();
  await db.query('UPDATE kq_market_lots SET jury_score=$2,selected_route=$3 WHERE flower_id=$1',[account.flower,juryScore,route]);
  await db.query('UPDATE kq_commerce_batches SET route=$2 WHERE flower_id=$1',[account.flower,route]);
  await db.query('UPDATE kq_commerce_stock SET route=$2 WHERE id=$1',[account.stock,route]);
  const profile={dryingQualityBonus:dryingBonus,storageQualityBonus:0,climateQualityBonus:0,
   containerQualityBonus:0,aromaRateFactor:100,chemistryRateFactor:100,curingBonusWeightedMs:0};
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{postHarvest}',$2::jsonb) WHERE flower_id=$1",[account.flower,JSON.stringify(profile)]);
  const condition=await scalar('SELECT kq_storage_condition(state,$2,now()) FROM kq_storage_lots WHERE flower_id=$1',[account.flower,juryScore]);
  equal(condition.conditionScore,expectedQuality,`SQL current quality ${route}/${channel}/${juryScore}`);
  const quote=await storedQuote(account,channel,50);
  await sell(account,quote);
  equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[account.stock]),950,`immediate sale accepts post-harvest quality ${route}/${channel}/${juryScore}`);
  equal(Number(await scalar('SELECT jury_score FROM kq_market_lots WHERE flower_id=$1',[account.flower])),juryScore,'commercial sale preserves original verdict');
  if ((channel==='cbd-shop' && juryScore===8.5) || (route==='raw' && channel==='wholesale')) {
   const legacy=await storedQuote(account,channel,50,item=>({...item,storage:{...item.storage,qualityDelta:Math.min(0,item.storage.qualityDelta)}}));
   await reject(()=>sell(account,legacy),'commerce_offer_changed');
  }
 }
 const plain=await player();
 const shop=await storedQuote(plain,'cbd-shop',50), wholesale=await storedQuote(plain,'wholesale',50);
 equal(shop.offer.unitCents,300,'shop indoor tariff is 3 EUR/g');
 equal(wholesale.offer.unitCents,210,'wholesale indoor tariff is 30 percent below shop');
 await sell(plain,shop);
 const merchant=await player();
 await db.query("INSERT INTO arena_chanvrier_profiles VALUES($1,'merchant')",[merchant.user]);
 equal((await storedQuote(merchant,'wholesale',50)).offer.unitCents,210,'merchant does not multiply fixed wholesale prices');
 for (const [channel,wanted] of [['cbd-shop',300],['wholesale',210]]) {
  const account=await player(),demand=await match(account,channel);
  const quote=await storedQuote(account,channel,100),key=randomUUID();
  equal(quote.offer.unitCents,Math.round(wanted*(1+demand.bonusPercent/100)*1e6)/1e6,'matching mature variety receives current bonus');
  equal(quote.offer.customerDemand,{id:demand.id,period:demand.period,bonusPercent:demand.bonusPercent,matchedFlavorCount:2,units:100},'quote carries exact demand usage');
  await sell(account,quote,key);
  equal((await request(account,channel)).remainingUnits,demand.capacityUnits-100,'sale consumes account quota');
  equal((await sell(account,quote,key)).replayed,true,'retry returns stored receipt');
  equal((await request(account,channel)).remainingUnits,demand.capacityUnits-100,'retry does not consume quota twice');
  await db.query('UPDATE kq_customer_demand_usage SET consumed_units=$2 WHERE user_id=$1 AND channel=$3',[account.user,demand.capacityUnits-30,channel]);
  const otherStock=randomUUID();
  await db.query(`INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents)
   SELECT $2,flower_id,user_id,route,100,100,100,base_unit_cents FROM kq_commerce_stock WHERE id=$1`,[account.stock,otherStock]);
  await db.query('UPDATE kq_commerce_stock SET remaining_units=remaining_units-100 WHERE id=$1',[account.stock]);
  const otherLotQuote=await storedQuote({...account,stock:otherStock},channel,100);
  equal(otherLotQuote.offer.customerDemand.units,30,'another physical stock cannot renew the account quota');
  const partial=await storedQuote(account,channel,100);
  equal(partial.offer.customerDemand.units,30,'only the last 3 grams receive the premium');
  equal(partial.offer.unitCents,Math.round(wanted*(1+.3*demand.bonusPercent/100)*1e6)/1e6,'cross-quota weighted price matches SQL');
  await sell(account,partial);
  equal((await request(account,channel)).remainingUnits,0,'quota cannot become negative');
  const normal=await storedQuote(account,channel,100);
  equal(normal.offer.unitCents,wanted,'exhausted quota automatically returns normal tariff');
  equal(normal.offer.customerDemand,undefined,'no bonus metadata after quota is exhausted');
  await sell(account,normal);
 }
 const stale=await player(),staleDemand=await match(stale,'wholesale'),staleQuote=await storedQuote(stale,'wholesale',100);
 await db.query('INSERT INTO kq_customer_demand_usage VALUES($1,$2,$3,$4)',[stale.user,staleDemand.period,'wholesale',staleDemand.capacityUnits]);
 await reject(()=>sell(stale,staleQuote),'commerce_offer_changed');
 equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[stale.stock]),1000,'changed quota cannot pay or remove stock');
 const forged=await player();await match(forged,'wholesale');
 const forgedQuote=await storedQuote(forged,'wholesale',100);
 await db.query("UPDATE kq_commerce_quotes SET offer=jsonb_set(offer,'{payoutCents}','99999') WHERE id=$1",[forgedQuote.quoteId]);
 await reject(()=>sell(forged,{...forgedQuote,offer:{...forgedQuote.offer,payoutCents:99999}}),'commerce_offer_changed');
 equal((await request(forged,'wholesale')).remainingUnits,5000,'failed amount validation does not consume demand');
 const immature=await player();await match(immature,'wholesale');
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()+interval '1 hour')) WHERE flower_id=$1",[immature.flower]);
 equal((await storedQuote(immature,'wholesale',100)).offer.customerDemand,undefined,'unfinished curing never gets a premium');
 const low=await player();await match(low,'wholesale');
 equal(await scalar("SELECT kq_customer_demand_match($1,$2,'wholesale',6.9,100,now())",[low.user,low.stock]),null,'minimum quality enforced by SQL');
 const tasting=await player();
 let tastePeriod=Math.floor(Date.parse(now)/259200000);
 while(getKqCustomerDemandRequest(tastePeriod,'online').varietyCode!=='HH2026-013') tastePeriod++;
 const tasteAt=new Date(tastePeriod*259200000+86400000).toISOString();
 const tasteDemand=getKqCustomerDemandRequest(tastePeriod,'online');
 for(const [code,count] of [['HH2026-030',2],['HH2026-005',1],['HH2026-006',0]]) {
  await db.query('UPDATE kq_flowers SET variety_code=$2 WHERE id=$1',[tasting.flower,code]);
  const flavorMatch=await scalar("SELECT kq_customer_demand_match($1,$2,'online',9,50,$3,true)",[tasting.user,tasting.stock,tasteAt]);
  equal(flavorMatch,count===0?null:{id:tasteDemand.id,period:tastePeriod,bonusPercent:tasteDemand.bonusPercent*count/2,matchedFlavorCount:count,units:50},'another variety with '+count+' matching aromas receives the proper premium');
 }
 // Select a genuinely unrelated profile for today's wholesale request.
 const todayWholesale=await request(tasting,'wholesale');
 const unrelated=Object.entries(KQ_BUDDIE_FLAVOR_PROFILES).find(([,profile])=>!profile.flavors.some(code=>todayWholesale.flavorCodes.includes(code)))[0];
 await db.query('UPDATE kq_flowers SET variety_code=$2 WHERE id=$1',[tasting.flower,unrelated]);
 const ordinary=await storedQuote(tasting,'wholesale',50);
 equal(ordinary.offer.unitCents,210,'zero aromas retains the ordinary wholesale price');
 equal(ordinary.offer.customerDemand,undefined,'zero aromas has no demand consumption');
 await sell(tasting,ordinary);
 equal((await request(tasting,'wholesale')).remainingUnits,5000,'ordinary sale leaves premium demand intact');
 const listing=async(account,packets=10,price=4000)=>{
  await command(account.user,'buy-packaging',{code:'kraft-5',quantity:packets});
  return (await command(account.user,'create-listing',{stockId:account.stock,formatGrams:5,packagingCode:'kraft-5',packets,packetPriceCents:price})).listingId;
 };
 const online=await player(),onlineDemand=await match(online,'online');
 const first=await listing(online,10),second=await listing(online,10);
 const offer=id=>scalar('SELECT kq_online_offer($1,l,now()) FROM kq_online_listings l WHERE id=$2',[online.user,id]);
 equal((await offer(first)).referencePacketCents,4000*(1+onlineDemand.bonusPercent/100),'online premium reference includes the matching request');
 for(let index=0;index<6;index++) {
  const id=index%2===0?first:second;
  await db.query('UPDATE kq_online_listings SET order_progress=1 WHERE id=$1',[id]);
  await db.query('SELECT kq_online_dispatch($1,$2,now())',[online.user,id]);
 }
 equal((await request(online,'online')).remainingUnits,0,'two listings share the same online quota');
 equal((await offer(first)).referencePacketCents,4000,'online price reference returns to normal after quota');
 equal(Number(await scalar('SELECT sum(payout_cents) FROM kq_online_sales WHERE user_id=$1',[online.user])),24000,'online pays exactly the player chosen price');
 await db.query('SELECT kq_online_dispatch($1,$2,now())',[online.user,second]);
 equal(Number(await scalar('SELECT count(*) FROM kq_online_sales WHERE user_id=$1',[online.user])),6,'dispatch cannot replay a packet without a new order');
 await db.query('UPDATE kq_customer_demand_usage SET consumed_units=275 WHERE user_id=$1 AND channel=\'online\'',[online.user]);
 equal((await offer(first)).customerDemand,null,'a partially covered packet receives no premium');
 for(const [quality,reference] of [[8,3500],[8.5,4000],[9.5,5000]]) {
  await db.query('UPDATE kq_online_listings SET packed_quality=$2 WHERE id=$1',[first,quality]);
  equal((await offer(first)).referencePacketCents,reference,'online raw price quality threshold '+quality);
 }
 equal((await scalar('SELECT rpc_kq_commerce_state($1)',[online.user])).online.listings[0].varietyCode,onlineDemand.varietyCode,'listings carry authoritative variety identity');
 // Cross a complete 72-hour window offline. Frequent reads must produce the
 // same sales, timestamps, quality, willingness to pay and quota consumption.
 const periodStart=(Math.floor(Date.parse(now)/259200000)-1)*259200000;
 const end=new Date(periodStart).toISOString(),begin=new Date(periodStart-259200000).toISOString();
 const batched=await player(),frequent=await player();
 for(const account of [batched,frequent]) {
  await match(account,'online',begin);
  account.listing=await listing(account,20,4500);
  await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb($2::timestamptz-interval '1 hour')) WHERE flower_id=$1",[account.flower,begin]);
  await db.query('UPDATE kq_online_listings SET created_at=$2,changed_at=$2 WHERE id=$1',[account.listing,begin]);
  await db.query("UPDATE kq_online_accounts SET settled_until=$2,growth_day=($2::timestamptz AT TIME ZONE 'UTC')::date,followers=400,clients_start=10 WHERE user_id=$1",[account.user,begin]);
  await db.query('UPDATE kq_commerce_accounts SET clients=10,shop_created_at=$2,business_started_at=$2,demand_updated_at=$2 WHERE user_id=$1',[account.user,begin]);
 }
 for(let hours=7;hours<72;hours+=7) await db.query("SELECT kq_online_settle_until($1,$2::timestamptz+$3*interval '1 hour')",[frequent.user,begin,hours]);
 await db.query('SELECT kq_online_settle_until($1,$2)',[frequent.user,end]);
 await db.query('SELECT kq_online_settle_until($1,$2)',[batched.user,end]);
 const facts=user=>db.query('SELECT occurred_at,packet_number,payout_cents,quality_score,value_ratio,satisfaction_score FROM kq_online_sales WHERE user_id=$1 ORDER BY packet_number',[user]).then(r=>r.rows);
 equal(await facts(frequent.user),await facts(batched.user),'offline 72-hour boundary is independent of polling');
 const usage=user=>db.query('SELECT period,channel,consumed_units FROM kq_customer_demand_usage WHERE user_id=$1 ORDER BY period,channel',[user]).then(r=>r.rows);
 equal(await usage(frequent.user),await usage(batched.user),'offline sales consume the historical period only');
 assert((await usage(batched.user)).some(row=>Number(row.period)===periodStart/259200000-1),'historical demand was actually used');checks++;
 equal((await request(batched,'online',end)).remainingUnits,300,'new period starts with its own complete quota');
 const currentOffer=await scalar('SELECT kq_online_offer($1,l,$3) FROM kq_online_listings l WHERE id=$2',[batched.user,batched.listing,end]);
 const nextDemand=await request(batched,'online',end);
 const previousFlavors=(await request(batched,'online',begin)).flavorCodes;
 const nextMatchingCount=previousFlavors.filter(code=>nextDemand.flavorCodes.includes(code)).length;
 equal(currentOffer.customerDemand,nextMatchingCount?{id:nextDemand.id,period:nextDemand.period,bonusPercent:nextDemand.bonusPercent*nextMatchingCount/2,matchedFlavorCount:nextMatchingCount,units:50}:null,'at the exact boundary only the new requested aromas apply');
 await db.query('SELECT kq_online_settle_until($1,$2)',[batched.user,end]);
 equal(await facts(frequent.user),await facts(batched.user),'repeated boundary catch-up never replays a packet');
 for(let hours=1;hours<=12;hours++) await db.query("SELECT kq_online_settle_until($1,$2::timestamptz+$3*interval '1 hour')",[frequent.user,end,hours]);
 await db.query("SELECT kq_online_settle_until($1,$2::timestamptz+interval '12 hours')",[batched.user,end]);
 equal(await facts(frequent.user),await facts(batched.user),'offline catch-up keeps the same sales after demand changes');
 equal(await usage(frequent.user),await usage(batched.user),'catch-up after rollover keeps the correct period quotas');
 equal(await scalar("SELECT has_table_privilege('service_role','kq_customer_demand_usage','SELECT,INSERT,UPDATE,DELETE')"),false,'quota table is entirely private');
 equal(await scalar("SELECT has_function_privilege('service_role','kq_customer_demand_consume(uuid,text,jsonb)','EXECUTE')"),false,'API role cannot invent demand consumption');
 equal(await scalar("SELECT has_function_privilege('service_role','rpc_kq_commerce_state(uuid)','EXECUTE')"),true,'server retains explicit snapshot permission');
 await db.exec('ROLLBACK');
 console.log(`Customer demand: ${checks} PostgreSQL checks passed.`);
} catch (error) {
 console.error(`After ${checks} checks:`,error.message,error.where??'');
 const line=Number(error.where?.match(/rpc_kq_commerce_command[^\n]* line (\d+)/)?.[1]);
 if (line) {
  await db.exec('ROLLBACK');
  const body=await scalar("SELECT prosrc FROM pg_proc WHERE oid='rpc_kq_commerce_command(uuid,text,jsonb,uuid)'::regprocedure");
  console.error(body.split('\n').slice(line-3,line+1).join('\n'));
 }
 process.exitCode=1;
} finally { await db.close();await vite.close(); }
