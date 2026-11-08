// Isolated PostgreSQL only. No environment files, credentials or deployed writes.
// Production commerce commands/capacity, invoice wrapper and staff commit patches
// are loaded verbatim. Unrelated payroll posting/trim execution are not exercised.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const vite = await createServer({ configFile:false, envDir:false, resolve:{ alias:{ '@':path.resolve('src') } }, server:{ middlewareMode:true, watch:null } });
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const scalar = async (query, values=[]) => Object.values((await db.query(query,values)).rows[0])[0];
const definition = async signature => (await scalar('SELECT pg_get_functiondef($1::regprocedure)', [signature])).replaceAll('\r\n','\n');
const section = (source, start, end) => {
 const a=source.indexOf(start), b=source.indexOf(end,a+start.length);
 assert.ok(a>=0 && b>a, `fixture source anchors: ${start}`);
 return source.slice(a,b);
};
const checks=[];
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks.push(label);};
const reject=async(fn,code)=>{
 await db.exec('SAVEPOINT expected_failure');
 try { await assert.rejects(fn,e=>e.message.includes(code));checks.push(`reject ${code}`); }
 finally { await db.exec('ROLLBACK TO SAVEPOINT expected_failure'); }
};
try {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
 CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY,code TEXT,description TEXT,updated_at TIMESTAMPTZ);
 CREATE TABLE kq_support_card_rules(card_definition_id UUID,advantage TEXT,rules_version INTEGER,updated_at TIMESTAMPTZ);
 CREATE TABLE kq_runs(id UUID PRIMARY KEY,user_id UUID,state JSONB,status TEXT,started_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ,campaign_id UUID,updated_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT,run_id UUID,variety_code TEXT DEFAULT 'KQ-VAR-001',variety_name TEXT DEFAULT 'Test',quality NUMERIC DEFAULT 9,
 battle_stats JSONB DEFAULT '{"appearance":90,"aroma":90,"vigor":90,"mastery":90,"regularity":90}',created_at TIMESTAMPTZ DEFAULT now(),burned_at TIMESTAMPTZ);
 CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY,cash_cents INTEGER NOT NULL DEFAULT 0 CHECK(cash_cents>=0),reputation INTEGER NOT NULL DEFAULT 0 CHECK(reputation>=0),planned_route_code TEXT,planned_equipment_code TEXT,created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now());
 CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS 'INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING';
 CREATE TABLE kq_equipment_loadouts(user_id UUID,equipment_code TEXT);
 CREATE TABLE arena_chanvrier_profiles(user_id UUID PRIMARY KEY,strength TEXT);
 `);
 for (const name of [
  '20260830000200_kq_post_harvest_market.sql','20260904000200_kq_route_masteries.sql','20260905000100_kq_route_expertise_rewards.sql',
  '20260909000100_kq_quality_reputation.sql','20260911000300_kq_cycle_electricity.sql','20260912000200_kq_living_market.sql',
  '20260913000100_kq_sales_channels.sql','20260913000200_kq_commerce_completed_at.sql','20260913000300_kq_commerce_mastery_guards.sql',
  '20260913000400_kq_shop_partners.sql','20260914000500_kq_shop_offer_precision.sql','20260915000300_kq_realtime_commerce_demand.sql',
  '20260921000100_kq_business_calendar.sql',
 ]) {
  if (name==='20260914000500_kq_shop_offer_precision.sql') {
   const source=await sql('20260914000100_arena_chanvrier_profiles.sql');
   await db.exec(source.slice(source.indexOf('DO $$',source.indexOf('-- Add the immutable specialty')),source.lastIndexOf('COMMIT;')));
  }
  if (name==='20260921000100_kq_business_calendar.sql') {
   const source=await sql('20260919000100_chanvrier_customization_and_benefits.sql');
   const start=source.indexOf(" SELECT pg_get_functiondef('public.rpc_kq_commerce_command");
   await db.exec('DO $$ DECLARE definition TEXT; original TEXT; BEGIN'+source.slice(start,source.indexOf('END $$;',start)+7));
  }
  await db.exec(await sql(name));
 }
 await db.exec(section(await sql('20261012000200_kq_warehouse_run_integration.sql'),
  'CREATE TABLE public.kq_warehouse_wholesale_sales', 'CREATE FUNCTION public.kq_warehouse_consume_wholesale'));
 await db.exec(await sql('20261029000400_kq_pay_all_invoices.sql'));
 await db.exec(`
 ALTER TABLE kq_commerce_batches ADD COLUMN processing_started_at TIMESTAMPTZ, ADD COLUMN processing_ready_at TIMESTAMPTZ;
 CREATE TABLE kq_social_platforms(user_id UUID,platform TEXT,followers INTEGER DEFAULT 0);
 CREATE TABLE kq_supplier_invoices(id UUID PRIMARY KEY,user_id UUID,run_id UUID,amount_cents INTEGER,remaining_cents INTEGER,due_at TIMESTAMPTZ);
 CREATE FUNCTION kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT';
 `);
 const staff=await sql('20261107000100_kq_staff.sql');
 await db.exec(staff.slice(0,staff.indexOf('-- Negotiations apply prospectively'))+'COMMIT;');
 const trim=await sql('20261107000200_kq_staff_trim.sql');
 await db.exec(section(trim,'CREATE FUNCTION pg_temp.kq_staff_trim_patch',"SELECT pg_temp.kq_staff_trim_patch('public.kq_storage_prepare_jury")+'DROP FUNCTION pg_temp.kq_staff_trim_patch(TEXT,TEXT,TEXT);');
 const accounting=await sql('20261107000300_kq_staff_accounting.sql');
 await db.exec(section(accounting,'CREATE FUNCTION pg_temp.kq_staff_accounting_patch','SELECT pg_temp.kq_staff_accounting_patch')
  +section(accounting,'CREATE FUNCTION public.kq_staff_paid_delta','-- If this extension')+'DROP FUNCTION pg_temp.kq_staff_accounting_patch(TEXT,TEXT,TEXT);');

 const { quoteKqCommerce }=await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts');
 const { quoteKqMarketRoutes }=await vite.ssrLoadModule('/src/lib/kanab-quest-market.ts');
 const { previewKqBusinessPayment }=await vite.ssrLoadModule('/src/lib/kanab-quest-business.ts');
 const { KQ_EQUIPMENT_CATALOG }=await vite.ssrLoadModule('/src/lib/kanab-quest-equipment.ts');
 const state=id=>scalar('SELECT rpc_kq_commerce_state($1)',[id]);
 const command=(id,action,payload={},key=randomUUID())=>scalar('SELECT rpc_kq_commerce_command($1,$2,$3::jsonb,$4)',[id,action,JSON.stringify(payload),key]);
 async function player(partners=0,strength=null) {
  const id=randomUUID(),run=randomUUID();
  await db.query('INSERT INTO auth.users VALUES($1)',[id]);await state(id);
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=1000000,reputation=1500 WHERE user_id=$1',[id]);
  if (strength) await db.query('INSERT INTO arena_chanvrier_profiles VALUES($1,$2)',[id,strength]);
  await db.query("INSERT INTO kq_runs(id,user_id,status,state) VALUES($1,$2,'active','{}')",[run,id]);
  await db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1",[run]);
  await db.query('UPDATE kq_commerce_accounts SET shop_partners=$2 WHERE user_id=$1',[id,partners]);
  await db.query("UPDATE kq_commerce_campaigns SET shop_partners_start=$2,event='normal' WHERE run_id=$1",[run,partners]);
  return {id,run};
 }
 async function prepare(id,score=9,key=randomUUID()) {
  const flower=randomUUID(), current=await state(id), equipmentCodes=KQ_EQUIPMENT_CATALOG.map(e=>e.code);
  await db.query('DELETE FROM kq_equipment_loadouts WHERE user_id=$1',[id]);
  for (const code of equipmentCodes) await db.query('INSERT INTO kq_equipment_loadouts VALUES($1,$2)',[id,code]);
  const options=quoteKqMarketRoutes({juryScore:score,harvestGrams:120,equipmentCodes,equipmentLevels:Object.fromEntries(equipmentCodes.map(c=>[c,10])),marketContext:{reputation:current.reputation,routeSales:current.routeSales,window:0,recentSales:{},marketVolumes:{}}});
  await db.query("INSERT INTO kq_flowers(id,owner_id,status) VALUES($1,$2,'burned')",[flower,id]);
  await db.query("SELECT rpc_kq_prepare_market_lot($1,$2,120,$3,'standard',$4::text[],$5::jsonb)",[id,flower,score,equipmentCodes,JSON.stringify(options)]);
  const raw=options.find(o=>o.route==='raw');
  return command(id,'prepare',{flowerId:flower,route:'raw',expectedCostCents:raw.market.processingCostCents},key);
 }
 async function quote(id,stockId,units=1200,oldCap=false) {
  const current=await state(id), stock=current.stocks.find(s=>s.id===stockId), key=randomUUID();
  const offer=quoteKqCommerce(current,stock,'cbd-shop','advised',units);
  Object.assign(offer,previewKqBusinessPayment(offer.payoutCents,current.business,0));
  if (oldCap) offer.shopPartnersAfter=Math.min(20,offer.shopPartnersAfter);
  await db.query("INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now()+interval '10 minutes')",
   [key,id,stockId,current.revision,current.campaign.id,current.campaign.revision,stock.remainingUnits,current.reputation,JSON.stringify(offer)]);
  return {quoteId:key,expectedPayoutCents:offer.payoutCents,offer};
 }
 const sell=(id,q,key)=>command(id,'sell',{quoteId:q.quoteId,expectedPayoutCents:q.expectedPayoutCents},key);
 const core='public.kq_commerce_command_before_invoice_batch(uuid,text,jsonb,uuid)';
 const commit='public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)';
 const unchanged=await definition('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)');
 const staffBefore=await definition(commit), coreBefore=await definition(core);
 const legacy=await player(19,'merchant');
 await db.query('UPDATE kq_commerce_accounts SET shop_recruitment=5000.1,shop_demand_debt=.25 WHERE user_id=$1',[legacy.id]);
 await db.query('UPDATE kq_commerce_campaigns SET shop_recruitment_start=5000.1 WHERE run_id=$1',[legacy.run]);
 const legacyKey=randomUUID(), legacyLot=await prepare(legacy.id,9,legacyKey), legacyQuote=await quote(legacy.id,legacyLot.stockId,1200,true);
 equal(legacyQuote.offer.shopPartnersAfter,20,'historical merchant offer at 19 was capped at 20');
 const facts=()=>scalar('SELECT to_jsonb(a) FROM kq_commerce_accounts a WHERE user_id=$1',[legacy.id]);
 const before=await facts();
 const migration=await sql('20261107000400_kq_unbounded_shop_partners.sql');
 // Deliberately drift one real prerequisite before the first application.
 // The failure must roll back earlier CHECK replacements and every revision.
 const oldConstraint=await scalar("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='kq_commerce_accounts_shop_partners_check'");
 await db.exec('BEGIN');
 await db.exec(coreBefore.replace('shop_after:=GREATEST(0,','shop_after := GREATEST(0,'));
 await db.exec('SAVEPOINT drift');
 await assert.rejects(()=>db.exec(migration.replace(/^BEGIN;/,'').replace(/COMMIT;\s*$/,'')),/unbounded_partners_patch_drift/);
 await db.exec('ROLLBACK TO SAVEPOINT drift');
 equal(await scalar("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='kq_commerce_accounts_shop_partners_check'"),oldConstraint,'patch drift atomically preserves the original constraint');
 equal(await facts(),before,'patch drift leaves the existing account entirely unchanged');
 await db.exec('ROLLBACK');
 await db.exec(migration);
 const after=await facts();
 equal(after,{...before,revision:before.revision+1},'migration only invalidates offers; preserves partners, fractions, debt and business state');
 equal(await definition('public.rpc_kq_commerce_command(uuid,text,jsonb,uuid)'),unchanged,'current invoice wrapper is untouched');
 equal(await definition(core),coreBefore.replace('shop_after:=GREATEST(0,LEAST(20,c.shop_partners_start+FLOOR(shop_recruit/6000)-FLOOR(shop_churn_value/6000)));','shop_after:=GREATEST(0,c.shop_partners_start+FLOOR(shop_recruit/6000)-FLOOR(shop_churn_value/6000));'),'core command retains every existing guard and only removes the partner ceiling');
 equal(await definition(commit),staffBefore.replace("SELECT LEAST(20-shop_partners,(effect->>'shopPartners')::INTEGER) INTO delta","SELECT (effect->>'shopPartners')::INTEGER INTO delta").replace('shop_partners_start=LEAST(20,shop_partners_start+delta)','shop_partners_start=shop_partners_start+delta'),'latest staff commit preserves trim, payroll, CAS and receipt guards');
 await db.exec('BEGIN');
 equal((await command(legacy.id,'prepare',{flowerId:legacyLot.flowerId,route:'raw',expectedCostCents:0},legacyKey)).replayed,true,'a receipt created before the migration still replays');
 await reject(()=>sell(legacy.id,legacyQuote),'commerce_offer_changed');
 const fresh=await quote(legacy.id,legacyLot.stockId);
 equal(fresh.offer.shopPartnersAfter,21,'merchant carry legitimately crosses 20 from a baseline of 19');
 equal((await sell(legacy.id,fresh)).shopPartnersAfter,21,'SQL accepts the uncapped merchant quote');

 for (const partners of [20,21,100,101,1000,10_000_000]) {
  const p=await player(partners);
  equal(Number((await scalar('SELECT kq_commerce_capacity($1)',[p.id]))['cbd-shop']),4000+partners*250,`${partners}: CBD capacity includes every partner without integer overflow`);
  const capacity=10000+partners*2500;
  equal((await scalar('SELECT kq_warehouse_wholesale_budget($1)',[p.id])).capacityEquivalentUnits,capacity,`${partners}: wholesale capacity includes every partner`);
  await db.query('INSERT INTO kq_warehouse_wholesale_sales(user_id,request_key,equivalent_units) VALUES($1,$2,1234.5)',[p.id,randomUUID()]);
  equal((await scalar('SELECT kq_warehouse_wholesale_budget($1)',[p.id])).remainingEquivalentUnits,capacity-1234.5,`${partners}: existing wholesale consumption survives`);
 }
 const p=await player(100), lot=await prepare(p.id), q=await quote(p.id,lot.stockId);
 const saleKey=randomUUID(), sale=await sell(p.id,q,saleKey);
 equal(sale.shopPartnersAfter,100,'first small exceptional delivery retains progress at 100');
 const lot2=await prepare(p.id), q2=await quote(p.id,lot2.stockId);
 equal((await sell(p.id,q2)).shopPartnersAfter,101,'ordinary deliveries grow the network beyond 100');
 equal((await sell(p.id,q,saleKey)).replayed,true,'historical commerce receipt replays after later sales');
 equal((await state(p.id)).shopPartners,101,'replay cannot reduce a later network');
 const lot3=await prepare(p.id), q3=await quote(p.id,lot3.stockId);
 equal((await sell(p.id,q3)).shopPartnersAfter,101,'periodic acquisition remains limited after large-network sales');
 equal(q3.offer.shopPricePercent,59,'network price bonus remains four points');

 const staffState=()=>({version:1,employees:[],tasks:[],payroll:[],supplierDiscountPercent:0,supplierDiscountUntil:null,lastSettledAt:new Date().toISOString()});
 const staffCommit=(id,revision,key,effects)=>scalar('SELECT rpc_kq_staff_commit($1,$2,$3,$4::jsonb,$5::jsonb,0,$6::jsonb)',[id,revision,key,JSON.stringify({action:'settle'}),JSON.stringify(staffState()),JSON.stringify(effects)]);
 const staffKey=randomUUID(), effect=[{kind:'sales',shopPartners:2,reputation:0}];
 const formerlyFull=await player(20);
 equal((await staffCommit(formerlyFull.id,0,randomUUID(),effect)).context.shopPartners,22,'prospecting crosses the former 20-partner ceiling');
 const keptLot=await prepare(formerlyFull.id,7), keptQuote=await quote(formerlyFull.id,keptLot.stockId);
 equal((await sell(formerlyFull.id,keptQuote)).shopPartnersAfter,22,'neutral delivery after prospecting retains all 22 partners');
 const prospect=await staffCommit(p.id,0,staffKey,effect);
 equal(prospect.context.shopPartners,103,'staff prospecting adds two partners beyond 100');
 equal(Number(await scalar('SELECT shop_partners_start FROM kq_commerce_campaigns WHERE run_id=$1',[p.run])),102,'prospecting carries additions into the active baseline');
 equal((await staffCommit(p.id,0,staffKey,effect)).replayed,true,'staff replay succeeds before stale revision validation');
 equal((await state(p.id)).shopPartners,103,'staff replay never recruits twice');
 await reject(()=>staffCommit(p.id,1,randomUUID(),[{kind:'sales',shopPartners:3,reputation:0}]),'staff_invalid');
 const neutral=await prepare(p.id,7), neutralQuote=await quote(p.id,neutral.stockId);
 equal((await sell(p.id,neutralQuote)).shopPartnersAfter,103,'next neutral sale preserves recruited partners and existing campaign growth');
 await db.query("UPDATE kq_commerce_campaigns SET growth_started_at=now()-interval '25 hours' WHERE run_id=$1",[p.run]);
 await db.query('SELECT kq_commerce_refresh_period($1)',[p.id]);
 const next=await state(p.id);
 equal(next.shopPartners,103,'period rollover does not reduce the network');
 equal(next.campaign.shopPartnersStart,103,'next growth period starts with the entire network');
 equal(next.campaign.shopGoodUnits,0,'periodic recruitment allowance resets normally');
 await db.query("UPDATE kq_commerce_campaigns SET event='normal' WHERE run_id=$1",[p.run]);
 const nextLot=await prepare(p.id), nextQuote=await quote(p.id,nextLot.stockId);
 equal((await sell(p.id,nextQuote)).shopPartnersAfter,103,'new period accumulates fractional progress normally');
 const nextLot2=await prepare(p.id), nextQuote2=await quote(p.id,nextLot2.stockId);
 equal((await sell(p.id,nextQuote2)).shopPartnersAfter,104,'new period can recruit another partner without a network ceiling');
 const poorLot=await prepare(p.id,6.5), poorQuote=await quote(p.id,poorLot.stockId);
 equal((await sell(p.id,poorQuote)).shopPartnersAfter,103,'disappointing deliveries still lose only earned churn, without collapsing the network to 20');
 await reject(()=>db.query('UPDATE kq_commerce_accounts SET shop_partners=-1 WHERE user_id=$1',[p.id]),'kq_commerce_accounts_shop_partners_check');
 await reject(()=>db.query('UPDATE kq_commerce_campaigns SET shop_partners_start=-1 WHERE run_id=$1',[p.run]),'kq_commerce_campaigns_shop_partners_start_check');
 for (const signature of [core,'kq_warehouse_wholesale_budget(uuid)','kq_commerce_capacity(uuid)',commit,'rpc_kq_commerce_command(uuid,text,jsonb,uuid)']) {
  for (const role of ['anon','authenticated']) equal(await scalar('SELECT has_function_privilege($1,$2,\'EXECUTE\')',[role,signature]),false,`${role}: no direct access to ${signature}`);
  equal(await scalar('SELECT has_function_privilege(\'service_role\',$1,\'EXECUTE\')',[signature]),![core,'kq_warehouse_wholesale_budget(uuid)'].includes(signature),`service role boundary preserved: ${signature}`);
 }
 await db.exec('ROLLBACK');
 await mkdir('output/shop-partners',{recursive:true});
 await writeFile('output/shop-partners/sql-report.json',JSON.stringify({migration:'20261107000400',isolated:true,checks:checks.length,results:checks},null,2)+'\n');
 console.log(`Shop partners SQL: ${checks.length} checks passed (isolated PGlite; no remote writes).`);
} catch (error) {
 console.error('Last checks:', checks.slice(-4));
 if (error.where) console.error(error.where);
 throw new Error(error.message);
} finally { await vite.close();await db.close(); }
