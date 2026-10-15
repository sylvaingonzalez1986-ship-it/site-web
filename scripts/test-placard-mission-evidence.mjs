// Exercise the real online dispatch, demand quotas and mission metrics in an
// isolated PostgreSQL instance. No credentials, env files or deployed writes.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const scalar = async (query, values = []) => Object.values((await db.query(query, values)).rows[0])[0];
const command = (user, action, payload = {}) => scalar('SELECT public.rpc_kq_online_command($1,$2,$3::jsonb,$4)', [user, action, JSON.stringify(payload), randomUUID()]);
const metrics = user => scalar('SELECT public.kq_mission_metrics($1)', [user]);
const setClock = at => db.query("SELECT set_config('test.mission_now',$1,false)", [at]);
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };

async function player({ quality = 9, variety = null, user = randomUUID() } = {}) {
 const run = randomUUID(), flower = randomUUID(), stock = randomUUID();
 await db.query('INSERT INTO auth.users VALUES($1) ON CONFLICT DO NOTHING', [user]);
 await scalar('SELECT public.rpc_kq_online_state($1)', [user]);
 await db.query('UPDATE public.kq_equipment_wallets SET cash_cents=1000000 WHERE user_id=$1', [user]);
 await db.query('UPDATE public.kq_commerce_accounts SET computer_owned=true WHERE user_id=$1', [user]);
 if (!await scalar('SELECT shop_created_at IS NOT NULL FROM public.kq_commerce_accounts WHERE user_id=$1', [user])) {
  await command(user, 'upgrade-site', { tier: 'basic', name: 'Atelier missions' });
 }
 const demand = await scalar("SELECT public.kq_customer_demand_remaining($1,'online',now())", [user]);
 await db.query("INSERT INTO public.kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{}','completed',now()-interval '2 days')", [run, user]);
 await db.query("INSERT INTO public.kq_flowers(id,owner_id,run_id,variety_code,status,burned_at,quality) VALUES($1,$2,$3,$4,'burned',now()-interval '1 day',$5)", [flower, user, run, variety ?? demand.varietyCode, quality]);
 await db.query("INSERT INTO public.kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,equipment_codes,options,status,selected_route) VALUES($1,$2,100,$3,'signature',ARRAY[]::TEXT[],'[]','stocked','raw')", [flower, user, quality]);
 await db.query("INSERT INTO public.kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'raw',1000,0)", [flower, user]);
 await db.query("INSERT INTO public.kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',1000,1000,1000,180)", [stock, flower, user]);
 await db.query(`UPDATE public.kq_storage_lots SET original_units=1000,state=jsonb_set(jsonb_set(state,'{readyAt}',to_jsonb(now()-interval '1 hour')),'{capacity}',
  jsonb_build_object('totalUnits',1000,'allocations',jsonb_build_array(jsonb_build_object('containerCode','GLASS-1L','quantity',2,'storedUnits',1000)),
   'overflowDeadlineAt',now()+interval '1 day')) WHERE flower_id=$1`, [flower]);
 await command(user, 'buy-packaging', { code: 'kraft-5', quantity: 12 });
 const listing = (await command(user, 'create-listing', { stockId: stock, formatGrams: 5, packagingCode: 'kraft-5', packets: 12, packetPriceCents: 2500 })).listingId;
 return { user, run, flower, stock, listing, demand };
}

async function dispatch(account, progress = true) {
 if (progress) await db.query('UPDATE public.kq_online_listings SET order_progress=1 WHERE id=$1', [account.listing]);
 await db.query('SELECT public.kq_online_dispatch($1,$2,now())', [account.user, account.listing]);
}

try {
 // Share the existing dependency bootstrap, while executing our own scenarios.
 // Asserting both boundaries makes fixture changes fail explicitly.
 const source = (await readFile(new URL('./test-placard-customer-demand.mjs', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
 const start = source.indexOf('\ntry {\n await db.exec(');
 const end = source.indexOf(' // All relative timestamps');
 assert(start >= 0 && end > start, 'customer-demand fixture bootstrap markers changed');
 const setup = source.slice(start + '\ntry {'.length, end);
 const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
 await new AsyncFunction('db', 'sql', 'scalar', setup)(db, sql, scalar);
 await db.exec(`
  CREATE TABLE public.kq_chanvrier_processing_practice(user_id UUID,flower_id UUID,family TEXT,route TEXT,PRIMARY KEY(user_id,flower_id,family));
  ALTER TABLE public.kq_commerce_batches ADD COLUMN processing_ready_at TIMESTAMPTZ;
  SELECT set_config('test.mission_now','2026-10-15T12:00:00Z',false);
  CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$SELECT current_setting('test.mission_now')::TIMESTAMPTZ$$;
 `);

 const historical = await player();
 await dispatch(historical);
 await db.exec(await sql('20261015000200_kq_mission_aroma_evidence.sql'));
 equal((await metrics(historical.user)).online_sales, 1, 'historical real sales still count as orders');
 equal((await metrics(historical.user)).online_dual_aroma_sales, 0, 'historical aroma eligibility is never invented');

 const matched = await player();
 await dispatch(matched);
 const evidence = await scalar('SELECT customer_demand FROM public.kq_online_sales WHERE user_id=$1', [matched.user]);
 equal(evidence, {
  id: matched.demand.id, period: matched.demand.period, bonusPercent: matched.demand.bonusPercent,
  matchedFlavorCount: 2, units: 50, flavorCodes: matched.demand.flavorCodes,
 }, 'fulfilled sale stores the exact request and both aromas before quota consumption');
 equal((await metrics(matched.user)).online_satisfied_dual_aroma_periods, 1, 'one satisfied exact-match period qualifies');
 await dispatch(matched, false);
 equal((await metrics(matched.user)).online_sales, 1, 'dispatch replay without an earned order cannot double-count');
 for (let i = 0; i < 6; i++) await dispatch(matched);
 equal((await metrics(matched.user)).online_sales, 7, 'ordinary orders still count after demand is filled');
 equal((await metrics(matched.user)).online_dual_aroma_sales, 6, 'quota-exhausted sale has no false aroma achievement');
 equal((await metrics(matched.user)).online_satisfied_dual_aroma_periods, 1, 'splitting sales cannot create extra demand periods');

 const single = await player();
 const singleVariety = await scalar(`SELECT 'HH2026-'||lpad(i::TEXT,3,'0') FROM generate_series(1,52) i
  WHERE (SELECT count(DISTINCT aroma) FROM unnest(public.kq_customer_demand_flavors('HH2026-'||lpad(i::TEXT,3,'0'))) aroma
   WHERE $1::JSONB ? aroma)=1 LIMIT 1`, [JSON.stringify(single.demand.flavorCodes)]);
 assert(singleVariety, 'one-aroma fixture exists');
 await db.query('UPDATE public.kq_flowers SET variety_code=$2 WHERE id=$1', [single.flower, singleVariety]);
 await dispatch(single);
 equal(await scalar("SELECT customer_demand->>'matchedFlavorCount' FROM public.kq_online_sales WHERE user_id=$1", [single.user]), '1', 'one matching aroma is preserved honestly');
 equal((await metrics(single.user)).online_dual_aroma_sales, 0, 'one matching aroma cannot qualify for both');

 for (const reason of ['quality', 'curing', 'transformed']) {
  const account = await player({ quality: reason === 'quality' ? 7 : 9 });
  if (reason === 'curing') await db.query("UPDATE public.kq_storage_lots SET state=jsonb_set(state,'{readyAt}',to_jsonb(now()+interval '1 hour')) WHERE flower_id=$1", [account.flower]);
  if (reason === 'transformed') await db.query("UPDATE public.kq_commerce_stock SET route='dry-sift' WHERE id=$1", [account.stock]);
  await dispatch(account);
  equal((await metrics(account.user)).online_dual_aroma_sales, 0, `${reason} ineligibility is not mistaken for a fulfilled raw-flower demand`);
 }

 const nextPeriod = new Date((matched.demand.period + 1) * 259200000 + 3600000).toISOString();
 await setClock(nextPeriod);
 equal(await scalar('SELECT customer_demand FROM public.kq_online_sales WHERE user_id=$1 ORDER BY occurred_at,packet_number LIMIT 1', [matched.user]), evidence,
  'request rotation does not rewrite the previously fulfilled aromas');
 // Use a fresh flower with the new request, after turning off old listings so
 // settlement cannot dispatch unrelated background fixtures during setup.
 await db.query("UPDATE public.kq_online_listings SET status='paused' WHERE user_id=$1", [matched.user]);
 const secondPeriod = await player({ user: matched.user });
 await dispatch(secondPeriod);
 equal((await metrics(matched.user)).online_satisfied_dual_aroma_periods, 2, 'two distinct fulfilled periods count once each');

 const cultivation = await player();
 await db.query('UPDATE public.kq_flowers SET quality=14 WHERE id=$1', [cultivation.flower]);
 await db.query(`INSERT INTO public.kq_chanvrier_processing_practice VALUES($1,$2,'sifting','dry-sift'),($1,$2,'pressing','rosin-trial')`, [cultivation.user, cultivation.flower]);
 const progress = await metrics(cultivation.user);
 equal([progress.harvests, progress.varieties, progress.beautiful_flowers, progress.contest_flowers, progress.contest_varieties, progress.legendary_flowers, progress.legendary_varieties],
  [1, 1, 1, 1, 1, 1, 1], 'one official completed flower contributes once to each earned quality tier');
 equal([progress.prepared_batches, progress.cured_lots, progress.quality_cured_lots, progress.transformed_batches, progress.transformed_routes],
  [1, 1, 1, 1, 2], 'processing counts distinct flowers and distinct techniques without sale slicing');
 await db.query("UPDATE public.kq_storage_lots SET state=jsonb_set(state,'{exposure,aromaWeightedMs}','999999999999999') WHERE flower_id=$1", [cultivation.flower]);
 equal((await metrics(cultivation.user)).quality_cured_lots, 1, 'later storage aging does not erase the original jury quality');
 await db.query("UPDATE public.kq_runs SET status='active' WHERE id=$1", [cultivation.run]);
 const pending = await metrics(cultivation.user);
 equal([pending.harvests, pending.prepared_batches, pending.cured_lots, pending.transformed_batches], [0, 0, 0, 0], 'pending cultures cannot count through pre-existing stock facts');
 await db.query("UPDATE public.kq_runs SET status='completed',user_id=$2 WHERE id=$1", [cultivation.run, matched.user]);
 const wrongOwner = await metrics(cultivation.user);
 equal([wrongOwner.harvests, wrongOwner.prepared_batches, wrongOwner.cured_lots, wrongOwner.transformed_batches], [0, 0, 0, 0], 'a culture owned by someone else cannot qualify through any stock facts');
 await db.query('UPDATE public.kq_runs SET user_id=$2 WHERE id=$1', [cultivation.run, cultivation.user]);
 await db.query("DELETE FROM public.kq_chanvrier_processing_practice WHERE user_id=$1 AND family='pressing'", [cultivation.user]);
 await db.query("UPDATE public.kq_commerce_batches SET route='dry-sift',processing_ready_at=now()+interval '2 hours' WHERE flower_id=$1", [cultivation.flower]);
 equal((await metrics(cultivation.user)).transformed_batches, 0, 'queued workshop practice is not a completed transformation');
 await db.query("UPDATE public.kq_commerce_batches SET processing_ready_at=now()-interval '1 minute' WHERE flower_id=$1", [cultivation.flower]);
 equal((await metrics(cultivation.user)).transformed_batches, 1, 'finished workshop work counts without requiring a sale');

 const shop = await player();
 for (const [route, quality, grams, channel] of [['raw', 8.5, 10, 'cbd-shop'], ['raw', 8, 15, 'cbd-shop'], ['raw', 7.9, 50, 'cbd-shop'], ['raw', 9, 50, 'wholesale']]) {
  await db.query(`INSERT INTO public.kq_market_sale_receipts(request_key,flower_id,owner_id,route,jury_score,harvest_grams,payout_cents,reputation_gain,cash_after_cents,reputation_after,sales_channel)
   VALUES($1,$2,$3,$4,$5,$6,100,0,1000000,0,$7)`, [randomUUID(), shop.flower, shop.user, route, quality, grams, channel]);
 }
 const transformedShop = await player({ user: shop.user, variety: 'HH2026-001' });
 await db.query(`INSERT INTO public.kq_market_sale_receipts(request_key,flower_id,owner_id,route,jury_score,harvest_grams,payout_cents,reputation_gain,cash_after_cents,reputation_after,sales_channel)
  VALUES($1,$2,$3,'dry-sift',9,100,100,0,1000000,0,'cbd-shop')`, [randomUUID(), transformedShop.flower, shop.user]);
 const shopMetrics = await metrics(shop.user);
 equal([shopMetrics.shop_varieties, shopMetrics.shop_quality_grams], [1, 25], 'shops count distinct raw varieties and only delivered raw grams with a sale-time score of at least 8');
 const earlySale = await player();
 await db.query(`INSERT INTO public.kq_market_sale_receipts(request_key,flower_id,owner_id,route,jury_score,harvest_grams,payout_cents,reputation_gain,cash_after_cents,reputation_after,sales_channel,created_at)
  VALUES($1,$2,$3,'raw',9,100,100,0,1000000,0,'wholesale',now()-interval '2 hours')`, [randomUUID(), earlySale.flower, earlySale.user]);
 equal([(await metrics(earlySale.user)).cured_lots, (await metrics(earlySale.user)).quality_cured_lots], [0, 0], 'an entire harvest sold before its deadline never later earns curing milestones');
 await db.query("UPDATE public.kq_market_sale_receipts SET created_at=now() WHERE owner_id=$1", [earlySale.user]);
 equal((await metrics(earlySale.user)).cured_lots, 1, 'a lot that matured before being sold keeps its curing credit');

 const overflowCases = [];
 for (const overflowUnits of [1000, 200]) {
  const account = await player();
  await db.query('DELETE FROM public.kq_online_listings WHERE user_id=$1', [account.user]);
  await db.query('DELETE FROM public.kq_commerce_stock WHERE user_id=$1', [account.user]);
  await db.query('DELETE FROM public.kq_commerce_batches WHERE user_id=$1', [account.user]);
  await db.query(`UPDATE public.kq_storage_lots SET state=jsonb_set(jsonb_set(state,'{readyAt}',to_jsonb(now()+interval '1 hour')),'{capacity}',
   jsonb_build_object('totalUnits',1000,'allocations',CASE WHEN $2::INTEGER=1000 THEN '[]'::JSONB ELSE
    jsonb_build_array(jsonb_build_object('containerCode','GLASS-1L','quantity',2,'storedUnits',1000-$2::INTEGER)) END)) WHERE flower_id=$1`, [account.flower, overflowUnits]);
  await scalar('SELECT public.kq_storage_sell_overflow($1,false)', [account.flower]);
  overflowCases.push({ account, expected: overflowUnits === 1000 ? 0 : 1 });
 }
 await setClock(new Date(Date.parse(nextPeriod) + 7200000).toISOString());
 for (const { account, expected } of overflowCases) {
  equal((await metrics(account.user)).cured_lots, expected,
   expected === 0 ? 'actual full overflow sale prevents a fictitious future curing achievement' : 'a partial overflow sale still lets the remaining flower mature');
 }
 equal(Object.values(await metrics(randomUUID())).every(value => value === 0), true, 'an empty account has a complete zero-valued metrics object');

 for (const role of ['anon', 'authenticated', 'service_role']) {
  equal(await scalar("SELECT has_table_privilege($1,'public.kq_online_sales','INSERT')", [role]), false, `${role} cannot forge sale evidence`);
  equal(await scalar("SELECT has_function_privilege($1,'public.kq_mission_metrics(uuid)','EXECUTE')", [role]), false, `${role} cannot call private metrics directly`);
 }
 console.log(`Mission evidence: ${checks} PostgreSQL integration checks passed (isolated PGlite).`);
} catch (error) {
 console.error(error.message, error.where ?? '');
 process.exitCode = 1;
} finally { await db.close(); }
