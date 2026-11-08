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
 // Include the production readiness columns, dispatch evidence and latest
 // commerce snapshot wrapper without bootstrapping unrelated staff systems.
 const warehouseSql=await sql('20261012000200_kq_warehouse_run_integration.sql');
 await db.exec(warehouseSql.match(/ALTER TABLE public\.kq_commerce_batches ADD COLUMN processing_started_at[\s\S]*?;/)[0]);
 const evidenceSql=await sql('20261015000200_kq_mission_aroma_evidence.sql');
 await db.exec(evidenceSql.slice(evidenceSql.indexOf('ALTER TABLE public.kq_online_sales'),evidenceSql.indexOf('-- Collection, stock')));
 const processingSql=await sql('20261108000400_kq_processing_work.sql');
 await db.exec(processingSql.slice(processingSql.indexOf('CREATE TABLE public.kq_processing_jobs'),processingSql.indexOf('CREATE INDEX kq_staff_archive_processing_day')));
 await db.exec(processingSql.match(/CREATE FUNCTION public\.kq_processing_jobs_snapshot\([\s\S]*?\$\$;/)[0]);
 await db.exec(processingSql.slice(processingSql.indexOf('ALTER FUNCTION public.rpc_kq_commerce_state(UUID)'),processingSql.indexOf('ALTER FUNCTION public.kq_staff_snapshot(UUID)')));
 await db.exec(await sql('20261108000500_kq_product_customer_demand.sql'));
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
 const {KQ_MARKET_ROUTES}=await vite.ssrLoadModule('/src/lib/kanab-quest-market.ts');
 const {createKqOnlinePreview,estimateKqOnlineOffer}=await vite.ssrLoadModule('/src/lib/kanab-quest-online.ts');
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
 const transformedRoutes=KQ_MARKET_ROUTES.filter(route=>route.family==='hash'||route.family==='rosin');
 async function transformedPlayer(route='dry-sift') {
  const account=await player();
  const definition=KQ_MARKET_ROUTES.find(item=>item.code===route);
  await db.query('UPDATE kq_market_lots SET selected_route=$2 WHERE flower_id=$1',[account.flower,route]);
  await db.query('UPDATE kq_commerce_batches SET route=$2 WHERE flower_id=$1',[account.flower,route]);
  await db.query('UPDATE kq_commerce_stock SET route=$2,base_unit_cents=$3 WHERE id=$1',[account.stock,route,definition.basePriceCentsPerProductGram]);
  return account;
 }
 const prepared=await player(),preparedDemand=await match(prepared,'wholesale');
 await scalar('SELECT rpc_kq_commerce_state($1)',[prepared.user]);
 const storageRevision=await scalar('SELECT revision FROM kq_storage_lots WHERE flower_id=$1',[prepared.flower]);
 const preparation={route:'dry-sift',available:true,productBaseUnitCents:600,processedInputGrams:80,productGrams:15,
  storageRevision,storageChangeAt:new Date(Date.parse(now)+60000).toISOString(),market:{reputation:0,salesCount:0,processingCostCents:0}};
 await db.query('DELETE FROM kq_commerce_stock WHERE flower_id=$1',[prepared.flower]);
 await db.query('DELETE FROM kq_commerce_batches WHERE flower_id=$1',[prepared.flower]);
 await db.query("UPDATE kq_market_lots SET status='ready',selected_route=NULL,options=$2::jsonb WHERE flower_id=$1",[prepared.flower,JSON.stringify([preparation])]);
 const created=await scalar("SELECT rpc_kq_commerce_command($1,'prepare',$2::jsonb,$3)",[prepared.user,JSON.stringify({flowerId:prepared.flower,route:'dry-sift',expectedCostCents:0}),randomUUID()]);
 const preparedState=await scalar('SELECT rpc_kq_commerce_state($1)',[prepared.user]);
 equal(preparedState.stocks.map(item=>[item.route,item.flowerId,item.varietyCode]).sort(),
  [['dry-sift',prepared.flower,preparedDemand.varietyCode],['raw',prepared.flower,preparedDemand.varietyCode]],'actual preparation preserves source identity on resin and remaining flowers');
 equal((await storedQuote({...prepared,stock:created.stockId},'wholesale',50)).offer.customerDemand.matchedFlavorCount,2,'resin made by production prepare matches its original flower aromas');
 for(const {code} of transformedRoutes) {
  for(const channel of ['cbd-shop','wholesale']) {
   const account=await transformedPlayer(code),demand=await match(account,channel);
   const snapshot=await scalar('SELECT rpc_kq_commerce_state($1)',[account.user]);
   equal(snapshot.processingWorkVersion,1,'latest processing wrapper is exercised');
   equal(snapshot.stocks[0].varietyCode,demand.varietyCode,`${code} preserves the source flower variety in the current snapshot`);
   const quote=await storedQuote(account,channel,100),key=randomUUID();
   equal(quote.offer.customerDemand,{id:demand.id,period:demand.period,bonusPercent:demand.bonusPercent,matchedFlavorCount:2,units:100},`${code}/${channel} receives both source aromas`);
   const expectedBase=snapshot.stocks[0].baseUnitCents*(channel==='cbd-shop'?.5:snapshot.campaign.event==='promotion'?.25:snapshot.campaign.event==='restock'?.33:.3);
   equal(quote.offer.unitCents,Math.round(expectedBase*(1+demand.bonusPercent/100)*1e6)/1e6,`${code}/${channel} retains its own product tariff`);
   await sell(account,quote,key);
   equal((await request(account,channel)).remainingUnits,demand.capacityUnits-100,`${code}/${channel} consumes product units once`);
   equal((await sell(account,quote,key)).replayed,true,`${code}/${channel} retry replays its receipt`);
   equal((await request(account,channel)).remainingUnits,demand.capacityUnits-100,`${code}/${channel} retry leaves demand unchanged`);
  }
  // Matching depends on source aromas, including a partial overlap with a
  // different variety, rather than the product's name or its extraction route.
  const account=await transformedPlayer(code);
  for(const [variety,count] of [['HH2026-030',2],['HH2026-005',1],['HH2026-006',0]]) {
   await db.query('UPDATE kq_flowers SET variety_code=$2,variety_name=$3 WHERE id=$1',[account.flower,variety,'Misleading lemon resin']);
   equal(await scalar("SELECT kq_customer_demand_match($1,$2,'online',9,50,$3,true)",[account.user,account.stock,tasteAt]),
    count?{id:tasteDemand.id,period:tastePeriod,bonusPercent:tasteDemand.bonusPercent*count/2,matchedFlavorCount:count,units:50}:null,
    `${code} uses ${count} aromas from the original variety`);
  }
 }
 const product=await transformedPlayer(),productDemand=await match(product,'wholesale');
 await db.query('INSERT INTO kq_customer_demand_usage VALUES($1,$2,$3,$4)',[product.user,productDemand.period,'wholesale',productDemand.capacityUnits-30]);
 const weightedProduct=await storedQuote(product,'wholesale',100);
 equal(weightedProduct.offer.customerDemand.units,30,'product premium is weighted by the remaining quota');
 await sell(product,weightedProduct);
 equal((await storedQuote(product,'wholesale',100)).offer.customerDemand,undefined,'product returns to its ordinary tariff when quota is exhausted');
 const sharedRaw=randomUUID();
 await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',100,100,100,180)",[sharedRaw,product.flower,product.user]);
 equal((await storedQuote({...product,stock:sharedRaw},'wholesale',50)).offer.customerDemand,undefined,'raw remainder shares the source product account quota');
 const pending=await transformedPlayer();await match(pending,'wholesale');
 await db.query("UPDATE kq_commerce_batches SET processing_ready_at='9999-01-01' WHERE flower_id=$1",[pending.flower]);
 equal(await scalar("SELECT kq_customer_demand_match($1,$2,'wholesale',9,100,now())",[pending.user,pending.stock]),null,'unfunded or unfinished processing cannot earn aroma premium');
 await db.query('UPDATE kq_commerce_batches SET processing_ready_at=now() WHERE flower_id=$1',[pending.flower]);
 equal((await scalar("SELECT kq_customer_demand_match($1,$2,'wholesale',9,100,now())",[pending.user,pending.stock])).matchedFlavorCount,2,'completed processing becomes eligible at its exact deadline');
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()+interval '1 hour')) WHERE flower_id=$1",[pending.flower]);
 equal(await scalar("SELECT kq_customer_demand_match($1,$2,'wholesale',9,100,now())",[pending.user,pending.stock]),null,'transformed products still require mature source flowers');
 await db.query("UPDATE kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now())) WHERE flower_id=$1",[pending.flower]);
 equal(await scalar("SELECT kq_customer_demand_match($1,$2,'wholesale',6.9,100,now())",[pending.user,pending.stock]),null,'transformed products still require minimum demand quality');
 await db.query("UPDATE kq_commerce_stock SET route='biomass' WHERE id=$1",[pending.stock]);
 equal(await scalar("SELECT kq_customer_demand_match($1,$2,'wholesale',9,100,now())",[pending.user,pending.stock]),null,'biomass never receives a source aroma premium');
 const wrongOwner=await player();
 equal(await scalar("SELECT kq_customer_demand_match($1,$2,'wholesale',9,100,now())",[wrongOwner.user,product.stock]),null,'another account cannot borrow a product source');
 const manipulated=await transformedPlayer();await match(manipulated,'wholesale');
 const manipulatedQuote=await storedQuote(manipulated,'wholesale',100);
 await db.query("UPDATE kq_commerce_quotes SET offer=jsonb_set(offer,'{unitCents}','99999') WHERE id=$1",[manipulatedQuote.quoteId]);
 await reject(()=>sell(manipulated,manipulatedQuote),'commerce_offer_changed');
 equal((await request(manipulated,'wholesale')).remainingUnits,5000,'tampered transformed tariff leaves demand untouched');
 equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[manipulated.stock]),1000,'tampered transformed tariff leaves stock untouched');
 const staleProduct=await transformedPlayer(),staleProductDemand=await match(staleProduct,'wholesale');
 const staleProductQuote=await storedQuote(staleProduct,'wholesale',100);
 await db.query('INSERT INTO kq_customer_demand_usage VALUES($1,$2,$3,$4)',[staleProduct.user,staleProductDemand.period,'wholesale',staleProductDemand.capacityUnits]);
 await reject(()=>sell(staleProduct,staleProductQuote),'commerce_offer_changed');
 equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[staleProduct.stock]),1000,'product quota changed after quote cannot remove stock or pay');
 for(const [channel,event,quality,partners,multiplier] of [
  ['cbd-shop','normal',7.5,1,1],['cbd-shop','normal',8,4,1],['cbd-shop','normal',9,8,1.5],['cbd-shop','normal',9.5,12,1.5],
  ['wholesale','promotion',9,0,1.5],['wholesale','restock',9,0,1.5],
 ]) {
  const account=await transformedPlayer();await match(account,channel);
  await scalar('SELECT rpc_kq_commerce_state($1)',[account.user]);
  await db.query('UPDATE kq_market_lots SET jury_score=$2 WHERE flower_id=$1',[account.flower,quality]);
  await db.query('UPDATE kq_commerce_accounts SET shop_partners=$2 WHERE user_id=$1',[account.user,partners]);
  await db.query('UPDATE kq_commerce_campaigns SET shop_partners_start=$2,event=$3 WHERE user_id=$1',[account.user,partners,event]);
  if(multiplier===1.5) await db.query("INSERT INTO arena_chanvrier_profiles VALUES($1,'merchant')",[account.user]);
  const quote=await storedQuote(account,channel,73);
  await sell(account,quote);
  equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[account.stock]),927,`product SQL tariff agrees with quote: ${channel}/${event}/${quality}/${partners}/${multiplier}`);
 }
 // Processing precision produces fractional stock prices. Exact half-micro
 // base tariffs must round like NUMERIC before applying the aroma premium.
 for(const [base,multiplier,event,expected] of [[1486.545455,1,'normal',445.963637],[1354.356364,1.5,'promotion',507.883637]]) {
  const account=await transformedPlayer();
  await scalar('SELECT rpc_kq_commerce_state($1)',[account.user]);
  await db.query('UPDATE kq_commerce_stock SET base_unit_cents=$2 WHERE id=$1',[account.stock,base]);
  await db.query('UPDATE kq_commerce_campaigns SET event=$2 WHERE user_id=$1',[account.user,event]);
  if(multiplier===1.5) await db.query("INSERT INTO arena_chanvrier_profiles VALUES($1,'merchant')",[account.user]);
  const ordinaryQuote=await storedQuote(account,'wholesale',73);
  equal(ordinaryQuote.offer.unitCents,expected,`fractional product base rounds exact half up: ${base}/${multiplier}/${event}`);
  await sell(account,ordinaryQuote);
  equal(await scalar('SELECT remaining_units FROM kq_commerce_stock WHERE id=$1',[account.stock]),927,'fractional product price is accepted by SQL payment');
  const demand=await match(account,'wholesale');
  const premiumQuote=await storedQuote(account,'wholesale',73);
  equal(premiumQuote.offer.unitCents,Number(await scalar('SELECT round($1::numeric*(1+$2::numeric/100),6)',[expected,demand.bonusPercent])),
   'fractional product premium starts from the exact rounded base tariff');
  await sell(account,premiumQuote);
  equal((await request(account,'wholesale')).remainingUnits,5000-73,'fractional product payment consumes the quoted premium once');
 }
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
 for(const route of ['dry-sift','rosin-trial']) {
  const account=await transformedPlayer(route),demand=await match(account,'online');
  const id=await listing(account,10,4000);
  const productOffer=()=>scalar('SELECT kq_online_offer($1,l,now()) FROM kq_online_listings l WHERE id=$2',[account.user,id]);
  const boosted=await productOffer();
  equal(boosted.customerDemand.matchedFlavorCount,2,`${route} online inherits both flower aromas`);
  await db.query('INSERT INTO kq_customer_demand_usage VALUES($1,$2,$3,275)',[account.user,demand.period,'online']);
  const ordinaryProduct=await productOffer();
  equal(ordinaryProduct.customerDemand,null,`${route} online cannot premium a partly covered packet`);
  equal(boosted.referencePacketCents,Math.round(ordinaryProduct.referencePacketCents*(1+demand.bonusPercent/100)),`${route} online premium uses the product reference including packaging`);
  await db.query('DELETE FROM kq_customer_demand_usage WHERE user_id=$1',[account.user]);
  await db.query('UPDATE kq_online_listings SET order_progress=1 WHERE id=$1',[id]);
  await scalar('SELECT kq_online_dispatch($1,$2,now())',[account.user,id]);
  equal((await request(account,'online')).remainingUnits,250,`${route} actual packet dispatch consumes one shared quota`);
  equal(Number(await scalar('SELECT sum(payout_cents) FROM kq_online_sales WHERE user_id=$1',[account.user])),4000,`${route} online pays only the chosen packet price`);
  const evidence=await scalar('SELECT customer_demand FROM kq_online_sales WHERE user_id=$1',[account.user]);
  equal(evidence,{...boosted.customerDemand,flavorCodes:demand.flavorCodes},`${route} receipt stores actual source-aroma demand evidence`);
  await scalar('SELECT kq_online_dispatch($1,$2,now())',[account.user,id]);
  equal((await request(account,'online')).remainingUnits,250,`${route} dispatch retry does not consume another packet`);
  equal((await scalar('SELECT rpc_kq_commerce_state($1)',[account.user])).online.listings[0].varietyCode,demand.varietyCode,`${route} online snapshot preserves the original flower variety`);
 }
 // A product reference need not be a multiple of 500 cents like flowers.
 // 12,230 * 1.15 lands below .5 in binary floats but is 14,065 in SQL NUMERIC.
 let roundingPeriod=Math.floor(Date.parse(now)/259200000)+1;
 while(getKqCustomerDemandRequest(roundingPeriod,'online').bonusPercent!==15) roundingPeriod++;
 const roundingAt=new Date(roundingPeriod*259200000+86400000).toISOString();
 const roundingProduct=await transformedPlayer('ice-water-hash');
 const roundingDemand=await match(roundingProduct,'online',roundingAt);
 const roundingListing=await listing(roundingProduct,10,14065);
 await db.query('UPDATE kq_online_listings SET packed_quality=8.19,created_at=$2 WHERE id=$1',[roundingListing,roundingAt]);
 const sqlReference=await scalar('SELECT kq_online_offer($1,l,$3) FROM kq_online_listings l WHERE id=$2',[roundingProduct.user,roundingListing,roundingAt]);
 const tsReference=estimateKqOnlineOffer({route:'ice-water-hash',varietyCode:roundingDemand.varietyCode,quality:8.19,baseUnitCents:2200,
  formatGrams:5,packagingCode:'kraft-5',packetPriceCents:14065,reputation:0,clients:0,
  online:createKqOnlinePreview(Date.parse(roundingAt)),customerDemand:createKqCustomerDemandSnapshot(Date.parse(roundingAt))});
 equal(sqlReference.referencePacketCents,14065,'SQL product reference rounds exact half-cent up after aroma premium');
 equal(tsReference.referencePacketPriceCents,sqlReference.referencePacketCents,'online product reference rounding agrees between TypeScript and PostgreSQL');
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
