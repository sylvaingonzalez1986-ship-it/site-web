// Actual crypto migration exercised in an isolated PostgreSQL engine.
// --live-quotes additionally reads CoinMarketCap through the production adapter;
// all wallets, orders and SQL writes remain in memory. No env files are loaded.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";
const db = new PGlite();
const query = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const command = async (user, action = 'state', payload = {}, enabled = true) => (await query('SELECT rpc_kq_crypto_command($1,$2,$3::jsonb,$4) data', [user, action, JSON.stringify(payload), enabled])).data;
const owner = randomUUID(), other = randomUUID();
const portfolio = async user => (await command(user)).positions;
const buy = (user, assetId, amountCents) => command(user, 'preview', { side: 'buy', assetId, amountCents });
const sell = (user, assetId, quantity) => command(user, 'preview', { side: 'sell', assetId, quantity });
const confirm = (user, orderId, enabled = true) => command(user, 'confirm', { orderId }, enabled);
const cash = async user => (await query('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1', [user])).cash_cents;
const refreshClaim = async () => (await query('SELECT rpc_kq_crypto_refresh_claim() data')).data;
const refreshStatus = async () => (await query('SELECT rpc_kq_crypto_refresh_status() data')).data;
const refreshPublish = async (leaseId, assets) => (await query('SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb) data',[leaseId,JSON.stringify(assets)])).data;
const refreshFail = async (leaseId, code, retryAfter = null) => (await query('SELECT rpc_kq_crypto_refresh_fail($1,$2,$3) data',[leaseId,code,retryAfter])).data;
const refreshDue = () => db.exec("UPDATE kq_crypto_refresh_state SET next_attempt_at=now()-interval '1 second',lease_until=NULL,lease_id=NULL");
async function rollbackFixture(run) { await db.exec('BEGIN'); try { await run(); } finally { await db.exec('ROLLBACK'); } }
async function rejectedStatement(run, pattern) {
 await db.exec('SAVEPOINT expected_rejection');
 try { await assert.rejects(run,pattern); }
 finally { await db.exec('ROLLBACK TO SAVEPOINT expected_rejection; RELEASE SAVEPOINT expected_rejection'); }
}
let checks = 0;
async function check(name, fn) { await fn(); console.log(`PASS ${name}`); checks++; }
async function checkLiveQuotes() {
 const [{createServer}, {resolve}] = await Promise.all([import('vite'), import('node:path')]);
 const vite = await createServer({configFile:false,envDir:false,resolve:{alias:{'@':resolve('src'),'server-only':resolve('src/test/server-only.ts')}},server:{middlewareMode:true,watch:null}});
 try {
  const {fetchCoinMarketCapTop100} = await vite.ssrLoadModule('/src/lib/coinmarketcap.ts');
  const {isKqCryptoSnapshot,isKqCryptoOrder,isKqCryptoTrade,isKqCryptoQuoteFresh} = await vite.ssrLoadModule('/src/lib/kanab-quest-crypto.ts');
  const liveAssets = await fetchCoinMarketCapTop100();
  assert.equal(liveAssets.length,100);
  // Age only the isolated database lease; never bypass production freshness checks.
  await refreshDue();
  await db.exec('SET ROLE service_role');
  try {
   const lease = (await query('SELECT rpc_kq_crypto_refresh_claim() data')).data;
   assert(lease?.leaseId,'service role must obtain the real refresh RPC lease');
   assert.equal((await query('SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb) data',[lease.leaseId,JSON.stringify(liveAssets)])).data,true,'real CMC rows must pass SQL publication');
   const initial = await command(other);
   assert(isKqCryptoSnapshot(initial),'SQL snapshot must pass the production browser/backend validator');
   const freshAssets=initial.assets.filter(asset=>isKqCryptoQuoteFresh(asset.quotedAt,Date.parse(initial.serverNow)));
   assert(freshAssets.length>0,'at least one provider quote must be fresh');
   assert.equal(initial.marketStatus,freshAssets.length===100?'live':'stale');
   assert.equal(initial.assets.length,100);
   assert.deepEqual(initial.assets.map(asset=>asset.id).sort((a,b)=>a-b),liveAssets.map(asset=>asset.id).sort((a,b)=>a-b));
   let firstOffer;
   for (const asset of liveAssets) {
    if(!freshAssets.some(fresh=>fresh.id===asset.id)) { await assert.rejects(buy(other,asset.id,10000),/crypto_stale/); continue; }
    const offer = await buy(other,asset.id,10000);
    assert(isKqCryptoOrder(offer),`real ${asset.symbol} preview must pass the production validator`);
    assert.equal(offer.assetId,asset.id);
    assert.equal(offer.amountCents,10000);
    if (!firstOffer) firstOffer=offer;
   }
   assert(firstOffer);
   const purchase = await confirm(other,firstOffer.orderId);
   assert(isKqCryptoTrade(purchase.trade));
   assert.equal(purchase.replayed,false);
   assert.equal(purchase.trade.amountCents,10000);
   const bought = await command(other);
   assert(isKqCryptoSnapshot(bought));
   assert.equal(bought.cashCents,initial.cashCents-10000);
   assert.equal(bought.positions.length,1);
   assert.equal(bought.positions[0].quantity,firstOffer.quantity);
   const saleOffer = await sell(other,firstOffer.assetId,firstOffer.quantity);
   assert(isKqCryptoOrder(saleOffer));
   const sale = await confirm(other,saleOffer.orderId);
   assert(isKqCryptoTrade(sale.trade));
   assert.equal(sale.trade.amountCents,saleOffer.amountCents);
   assert.equal(sale.trade.costBasisCents,10000);
   assert.equal(sale.trade.realizedPnlCents,sale.trade.amountCents-10000);
   const final = await command(other);
   assert(isKqCryptoSnapshot(final));
   assert.equal(final.positions.length,0);
   assert.equal(final.cashCents,initial.cashCents-10000+sale.trade.amountCents);
   assert.equal(final.recentTrades.length,2);
   console.log(JSON.stringify({provider:'CoinMarketCap',assets:liveAssets.length,validatedPreviews:freshAssets.length,roundTripSymbol:liveAssets.find(asset=>asset.id===firstOffer.assetId).symbol,quotedAt:firstOffer.quotedAt,sqlMarketStatus:final.marketStatus,execution:'isolated PostgreSQL only'}));
  } finally { await db.exec('RESET ROLE'); }
  assert.equal((await query("SELECT COALESCE(SUM(balance_cents),0)::INTEGER amount FROM kq_treasury_balances WHERE user_id=$1 AND account IN ('suspense','crypto_assets')",[other])).amount,0,'completed live-price round trip must leave neither suspense nor crypto cost');
 } finally { await vite.close(); }
}
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id UUID PRIMARY KEY);
 CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users(id),cash_cents INTEGER NOT NULL CHECK(cash_cents>=0),updated_at TIMESTAMPTZ);
 CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY,revision INTEGER DEFAULT 0);
 CREATE TABLE kq_treasury_accounts(user_id UUID PRIMARY KEY);
 CREATE TABLE kq_treasury_journal(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,source_key TEXT,kind TEXT,reference TEXT,occurred_at TIMESTAMPTZ,postings JSONB,UNIQUE(user_id,source_key));
 CREATE TABLE kq_treasury_balances(user_id UUID,account TEXT,balance_cents BIGINT,PRIMARY KEY(user_id,account));
 CREATE FUNCTION kq_business_settle(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT';
 CREATE FUNCTION kq_treasury_initialize(UUID) RETURNS VOID LANGUAGE sql AS 'SELECT';`);
 // Execute the actual posting primitive, including preceding banking accounts.
 const treasury = await readFile('supabase/migrations/20260921000200_kq_treasury_accounting.sql','utf8');
 await db.exec(treasury.slice(treasury.indexOf('CREATE FUNCTION public.kq_treasury_post('), treasury.indexOf('-- Actual production cost')).replace("'expense_other'];", "'expense_other','loan_payable','expense_loan_interest'];"));
 await db.exec(await readFile('supabase/migrations/20260923000400_kq_crypto_portfolio.sql', 'utf8'));
 await db.exec(await readFile('supabase/migrations/20260923000600_kq_crypto_refresh_recovery.sql', 'utf8'));
 await db.exec("UPDATE kq_crypto_refresh_state SET attempted_at=now()-interval '20 seconds',succeeded_at=now()-interval '4 minutes'");
 await db.exec(await readFile('supabase/migrations/20260924000200_kq_crypto_refresh_resilience.sql', 'utf8'));
 assert.equal((await query("SELECT next_attempt_at=GREATEST(succeeded_at+interval '5 minutes',attempted_at+interval '1 minute') AS preserved FROM kq_crypto_refresh_state")).preserved,true,'migration preserves the current shared refresh deadline');
 await db.exec('UPDATE kq_crypto_refresh_state SET attempted_at=NULL,succeeded_at=NULL,next_attempt_at=NULL');
 await db.exec(`CREATE FUNCTION cash_observer() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 PERFORM kq_treasury_pair(NEW.user_id,'cash-movement',gen_random_uuid()::TEXT,now(),'cash','suspense',(NEW.cash_cents-OLD.cash_cents)::BIGINT); RETURN NEW; END $$;
 CREATE TRIGGER wallet_cash AFTER UPDATE OF cash_cents ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION cash_observer();`);
 for (const user of [owner, other]) {
  await db.query('INSERT INTO auth.users VALUES($1)', [user]); await db.query('INSERT INTO kq_equipment_wallets VALUES($1,1000000,now())', [user]);
  await db.query('INSERT INTO kq_commerce_accounts(user_id) VALUES($1)', [user]); await db.query('INSERT INTO kq_treasury_accounts VALUES($1)', [user]);
 }
 const assets = Array.from({ length:100 }, (_, i) => ({ id:i+1, rank:i+1, name:`Coin ${i+1}`, symbol:`C${i+1}`, priceEur:i===0?'40000':i===1?'0.00001':'10', change24h:1.5, quotedAt:new Date().toISOString(), inTop100:true }));
 await check('shared refresh lease prevents stampedes and ignores stale lease writes', async () => {
  assert.equal((await query('SELECT rpc_kq_crypto_refresh_publish(NULL,$1::jsonb) data',[JSON.stringify(assets)])).data,false,'no unclaimed publish');
  const lease = (await query('SELECT rpc_kq_crypto_refresh_claim() data')).data;
  assert(lease.leaseId); assert.equal((await query('SELECT rpc_kq_crypto_refresh_claim() data')).data,null);
  assert.equal((await query('SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb) data',[randomUUID(),JSON.stringify(assets)])).data,false);
  await assert.rejects(query('SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb)',[lease.leaseId,JSON.stringify(assets.map(a=>({...a,rank:1})))]),/crypto_invalid_quotes/);
  assert.equal((await query('SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb) data',[lease.leaseId,JSON.stringify(assets)])).data,true);
  assert.equal((await command(owner)).assets.length,100);
  assert.equal((await query('SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb) data',[lease.leaseId,JSON.stringify(assets)])).data,false,'published leases cannot be reused');
 });
 await check('shared deadlines preserve successful cache, live leases and recovery after a disappeared worker',async()=>rollbackFixture(async()=>{
  assert.equal(await refreshClaim(),null,'a recent successful publication still prevents another provider call');
  await db.exec("UPDATE kq_crypto_refresh_state SET next_attempt_at=now()-interval '1 second',lease_until=now()+interval '1 second'");
  assert.equal(await refreshClaim(),null,'an active lease remains exclusive even when the retry deadline has elapsed');
  await db.exec("UPDATE kq_crypto_refresh_state SET next_attempt_at=now()+interval '1 second',lease_until=now()-interval '1 second'");
  assert.equal(await refreshClaim(),null,'an expired lease does not bypass the shared next attempt');
  await refreshDue();
  const recovered=await refreshClaim(); assert(recovered?.leaseId);
  assert.equal((await query("SELECT EXTRACT(EPOCH FROM lease_until-now())::INTEGER AS seconds FROM kq_crypto_refresh_state")).seconds,60);
  assert.equal(await refreshClaim(),null);
  await db.exec("UPDATE kq_crypto_refresh_state SET next_attempt_at=now()-interval '1 second',lease_until=now()-interval '1 second'");
  const replacement=await refreshClaim(); assert.notEqual(replacement.leaseId,recovered.leaseId);
  const before=await refreshStatus();
  assert.equal(await refreshFail(recovered.leaseId,'rate_limited',600),false,'expired worker cannot postpone its replacement');
  assert.deepEqual(await refreshStatus(),before);
  assert.equal(await refreshPublish(recovered.leaseId,assets),false);
  assert.equal(await refreshPublish(replacement.leaseId,assets),true);
  assert.equal(await refreshClaim(),null);
 }));
 await check('provider failures share exponential backoff and Retry-After, and successful publication resets failures',async()=>rollbackFixture(async()=>{
  for(const [index,seconds] of [60,120,240,300,300].entries()) {
   await refreshDue(); const lease=await refreshClaim();
   assert.equal(await refreshFail(lease.leaseId,'provider_unavailable'),true);
   const state=await refreshStatus(); assert.equal(state.failureCount,index+1); assert.equal(state.lastFailureCode,'provider_unavailable'); assert.equal(state.refreshing,false);
   assert.equal((await query("SELECT EXTRACT(EPOCH FROM next_attempt_at-now())::INTEGER AS seconds FROM kq_crypto_refresh_state")).seconds,seconds);
   assert.equal(await refreshClaim(),null);
   assert.equal(await refreshFail(lease.leaseId,'rate_limited',600),false,'a failure report cannot replay');
  }
  await refreshDue(); const limited=await refreshClaim();
  await rejectedStatement(()=>refreshFail(limited.leaseId,'rate_limited',604801),/crypto_invalid_refresh_failure/);
  await rejectedStatement(()=>refreshFail(limited.leaseId,'secret'),/crypto_invalid_refresh_failure/);
  assert.equal(await refreshFail(limited.leaseId,'rate_limited',600),true);
  assert.equal((await query("SELECT EXTRACT(EPOCH FROM next_attempt_at-now())::INTEGER AS seconds FROM kq_crypto_refresh_state")).seconds,600);
  await refreshDue(); const recovered=await refreshClaim();
  assert.equal(await refreshPublish(recovered.leaseId,assets),true);
  const healthy=await refreshStatus(); assert.equal(healthy.failureCount,0); assert.equal(healthy.lastFailureCode,null); assert.equal(healthy.refreshing,false);
  assert.equal((await query("SELECT EXTRACT(EPOCH FROM next_attempt_at-now())::INTEGER AS seconds FROM kq_crypto_refresh_state")).seconds,300);
  assert.equal(await refreshFail(recovered.leaseId,'publish_failed'),false,'late failure cannot overwrite a committed success');
 }));
 await check('publishing a good top100 honors held-asset Retry-After without letting an old lease postpone the cache again',async()=>rollbackFixture(async()=>{
  await refreshDue(); const lease=await refreshClaim();
  const publishWithPause=seconds=>query('SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb,$3) data',[lease.leaseId,JSON.stringify(assets),seconds]);
  await rejectedStatement(()=>publishWithPause(-1),/crypto_invalid_refresh_failure/);
  assert.equal((await publishWithPause(600)).data,true);
  assert.equal((await refreshStatus()).freshQuoteCount,100);
  assert.equal((await query("SELECT EXTRACT(EPOCH FROM next_attempt_at-now())::INTEGER AS seconds FROM kq_crypto_refresh_state")).seconds,600);
  assert.equal(await refreshClaim(),null);
  const before=await refreshStatus(); assert.equal((await publishWithPause(3600)).data,false); assert.deepEqual(await refreshStatus(),before);
 }));
 await check('99 fresh top100 quotes keep trading while one stale asset stays visible and cannot be traded',async()=>rollbackFixture(async()=>{
  await refreshDue();
  await db.exec("UPDATE kq_crypto_quotes SET quoted_at=now()-interval '20 minutes' WHERE asset_id=100");
  const stamped=(await query("SELECT (now()-interval '11 minutes')::TEXT AS old,now()::TEXT AS fresh")).old;
  const partial=assets.map(asset=>asset.id===100?{...asset,quotedAt:stamped}:asset);
  const lease=await refreshClaim(); assert.equal(await refreshPublish(lease.leaseId,partial),true);
  const state=await refreshStatus(); assert.equal(state.quoteCount,100); assert.equal(state.freshQuoteCount,99);
  assert.equal((await command(owner)).marketStatus,'stale');
  let first;
  for(const asset of partial.filter(asset=>asset.id!==100)) { const offer=await buy(owner,asset.id,100); first??=offer; }
  await rejectedStatement(()=>buy(owner,100,100),/crypto_stale/);
  const bought=await confirm(owner,first.orderId); assert.equal(bought.trade.assetId,first.assetId);
  const sale=await sell(owner,first.assetId,first.quantity); assert.equal((await confirm(owner,sale.orderId)).trade.side,'sell');
 }));
 await check('entirely stale, future or malformed batches cannot replace the cache or mark refresh success',async()=>rollbackFixture(async()=>{
  await refreshDue(); const lease=await refreshClaim();
  const stamps=await query("SELECT (now()-interval '11 minutes')::TEXT AS old,(now()+interval '61 seconds')::TEXT AS future");
  const before=await refreshStatus();
  await rejectedStatement(()=>refreshPublish(lease.leaseId,assets.map(asset=>({...asset,quotedAt:stamps.old}))),/crypto_invalid_quotes/);
  await rejectedStatement(()=>refreshPublish(lease.leaseId,assets.map((asset,i)=>i===0?{...asset,quotedAt:stamps.future}:asset)),/crypto_invalid_quotes/);
  await rejectedStatement(()=>refreshPublish(lease.leaseId,assets.map((asset,i)=>i===0?{...asset,name:null}:asset)),/crypto_invalid_quotes/);
  assert.deepEqual(await refreshStatus(),before);
  assert.equal(await refreshPublish(lease.leaseId,assets),true);
 }));
 await check('older provider rows update membership metadata without replacing a newer cached price or timestamp',async()=>rollbackFixture(async()=>{
  await refreshDue();
  const stamps=await query("SELECT now()::TEXT AS fresh,(now()-interval '5 minutes')::TEXT AS old");
  await db.exec('UPDATE kq_crypto_quotes SET price_eur=77777,change_24h=7,quoted_at=now() WHERE asset_id=1');
  const lease=await refreshClaim();
  assert.equal(await refreshPublish(lease.leaseId,assets.map(asset=>asset.id===1?{...asset,name:'Updated name',priceEur:'1',change24h:-99,quotedAt:stamps.old}:asset)),true);
  const stored=await query('SELECT name,price_eur::TEXT AS price,change_24h::INTEGER AS change,quoted_at=now() AS preserved FROM kq_crypto_quotes WHERE asset_id=1');
  assert.deepEqual(stored,{name:'Updated name',price:'77777.000000000000000000',change:7,preserved:true});
 }));
 await check('refresh scheduling accounts for actual quote age before the ten-minute trading limit',async()=>rollbackFixture(async()=>{
  for(const [age,seconds] of [['1 minute',300],['7 minutes',120],['8 minutes 30 seconds',60]]) {
   await refreshDue(); await db.exec("UPDATE kq_crypto_quotes SET quoted_at=now()-interval '20 minutes'");
   const stamp=(await query('SELECT (now()-$1::interval)::TEXT AS stamped',[age])).stamped;
   const lease=await refreshClaim(); assert.equal(await refreshPublish(lease.leaseId,assets.map(asset=>({...asset,quotedAt:stamp}))),true);
   assert.equal((await query("SELECT EXTRACT(EPOCH FROM next_attempt_at-now())::INTEGER AS seconds FROM kq_crypto_refresh_state")).seconds,seconds);
  }
 }));
 let original;
 await check('preview does not debit; exact locked price executes after provider moves',async()=>{
  original=await buy(owner,1,10000); assert.equal(original.quantity,'0.002500000000000000'); assert.equal(await cash(owner),1000000);
  await db.exec('UPDATE kq_crypto_quotes SET price_eur=50000 WHERE asset_id=1');
  const traded=await confirm(owner,original.orderId); assert.equal(traded.trade.amountCents,10000); assert.equal(traded.trade.priceEur,'40000.000000000000000000'); assert.equal(await cash(owner),990000);
 });
 await check('receipt replays after expiry and market disable without another debit',async()=>{
  await db.query("UPDATE kq_crypto_orders SET expires_at=now()-interval '1 day' WHERE id=$1",[original.orderId]);
  const retry=await confirm(owner,original.orderId,false); assert.equal(retry.replayed,true); assert.equal(await cash(owner),990000);
  assert.equal((await query('SELECT count(*) total FROM kq_crypto_trades')).total,1);
 });
 await check('ownership, invalid money and unconfigured preview fail closed',async()=>{
  await assert.rejects(confirm(other,original.orderId),/crypto_order_missing/);
  await assert.rejects(command(owner,'preview',{side:'buy',assetId:1,amountCents:100},false),/crypto_closed/);
  for(const amount of [0,1,99,100000001,-100,1.5]) await assert.rejects(buy(owner,1,amount),/crypto_invalid/);
 });
 await check('two sell previews cannot oversell and exact cost basis realizes gain',async()=>{
  const first=await sell(owner,1,'0.0025'), second=await sell(owner,1,'0.0025');
  const result=await confirm(owner,first.orderId); assert.equal(result.trade.amountCents,12500); assert.equal(result.trade.costBasisCents,10000); assert.equal(result.trade.realizedPnlCents,2500);
  await assert.rejects(confirm(owner,second.orderId),/crypto_quantity/); assert.equal((await portfolio(owner)).length,0);
 });
 await check('fractional cheap coins preserve NUMERIC precision and never manufacture a cent',async()=>{
  const bought=await buy(owner,2,12345); assert.equal(bought.quantity,'12345000.000000000000000000'); await confirm(owner,bought.orderId);
  await assert.rejects(sell(owner,2,'0.000000000000000001'),/crypto_dust/);
 });
 await check('extreme prices cannot overflow fractional quantity precision',async()=>{
  await db.exec('UPDATE kq_crypto_quotes SET price_eur=0.000000000000000001 WHERE asset_id=3');
  await assert.rejects(buy(owner,3,10000),/crypto_position_limit/);
  await db.exec('UPDATE kq_crypto_quotes SET price_eur=10 WHERE asset_id=3');
 });
 await check('expired prices and quotes cannot execute; cached portfolio remains visible',async()=>{
  const pending=await buy(owner,3,100); await db.query("UPDATE kq_crypto_orders SET expires_at=now()-interval '1 second' WHERE id=$1",[pending.orderId]);
  await assert.rejects(confirm(owner,pending.orderId),/crypto_expired/);
  await db.exec("UPDATE kq_crypto_quotes SET quoted_at=now()-interval '11 minutes' WHERE asset_id=2");
  await assert.rejects(sell(owner,2,'1'),/crypto_stale/); const snapshot=await command(owner); assert.equal(snapshot.marketStatus,'stale'); assert.equal(snapshot.positions[0].valueCents,null);
 });
 await check('holdings outside top100 can be sold at refreshed by-ID prices',async()=>{
  await refreshDue();
  const lease=(await query('SELECT rpc_kq_crypto_refresh_claim() data')).data; assert(lease.heldAssetIds.includes(2));
  const replacement=assets.filter(a=>a.id!==2).map(a=>({...a,quotedAt:new Date().toISOString()})); replacement.push({...assets[1],id:101,rank:2}); replacement.push({...assets[1],rank:101,inTop100:false,priceEur:'0.000005',quotedAt:new Date().toISOString()});
  await query('SELECT rpc_kq_crypto_refresh_publish($1,$2::jsonb)',[lease.leaseId,JSON.stringify(replacement)]);
  await assert.rejects(buy(owner,2,100),/crypto_not_top100/);
  const offer=await sell(owner,2,'12345000'); const sold=await confirm(owner,offer.orderId); assert.equal(sold.trade.amountCents,6172); assert.equal(sold.trade.realizedPnlCents,-6173);
 });
 await check('wallet, basis and realized P&L have balanced entries without suspense',async()=>{
  const suspense=(await query("SELECT COALESCE(SUM(balance_cents),0)::INTEGER amount FROM kq_treasury_balances WHERE account='suspense'")).amount; assert.equal(suspense,0);
  assert.equal((await query("SELECT count(*) amount FROM kq_treasury_journal WHERE (SELECT sum((x->>'deltaCents')::BIGINT) FROM jsonb_array_elements(postings) x)<>0")).amount,0);
  assert.equal((await query("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='crypto_assets'",[owner])).balance_cents,0);
 });
 await check('atomic rollback protects wallet if accounting fails',async()=>{
  const offer=await buy(owner,3,100); const before=await cash(owner);
  await db.exec("CREATE FUNCTION fail_trade() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture accounting unavailable'; END $$; CREATE TRIGGER fail_trade BEFORE INSERT ON kq_treasury_journal FOR EACH ROW WHEN(NEW.kind='crypto-buy') EXECUTE FUNCTION fail_trade();");
  await assert.rejects(confirm(owner,offer.orderId),/fixture accounting unavailable/); assert.equal(await cash(owner),before);
  assert.equal((await query('SELECT count(*) total FROM kq_crypto_trades WHERE order_id=$1',[offer.orderId])).total,0);
  await db.exec('DROP TRIGGER fail_trade ON kq_treasury_journal');
 });
 await check('private tables and mutation RPCs deny direct client access',async()=>{
  for(const role of ['anon','authenticated','service_role']) for(const table of ['kq_crypto_quotes','kq_crypto_refresh_state','kq_crypto_positions','kq_crypto_orders','kq_crypto_trades']) {
   assert.equal((await query('SELECT has_table_privilege($1,$2,$3) allowed',[role,table,'SELECT,INSERT,UPDATE,DELETE'])).allowed,false);
  }
  for(const role of ['anon','authenticated']) assert.equal((await query("SELECT has_function_privilege($1,'rpc_kq_crypto_command(uuid,text,jsonb,boolean)','EXECUTE') allowed",[role])).allowed,false);
  assert.equal((await query("SELECT has_function_privilege('service_role','rpc_kq_crypto_command(uuid,text,jsonb,boolean)','EXECUTE') allowed")).allowed,true);
  for(const signature of ['rpc_kq_crypto_refresh_claim()','rpc_kq_crypto_refresh_publish(uuid,jsonb)','rpc_kq_crypto_refresh_publish(uuid,jsonb,integer)','rpc_kq_crypto_refresh_fail(uuid,text,integer)','rpc_kq_crypto_refresh_status()']) {
   for(const role of ['anon','authenticated']) assert.equal((await query('SELECT has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,signature])).allowed,false);
   assert.equal((await query('SELECT has_function_privilege(\'service_role\',$1,\'EXECUTE\') allowed',[signature])).allowed,true);
  }
  const before=(await query('SELECT row_to_json(s) AS data FROM kq_crypto_refresh_state s')).data;
  await db.exec('SET ROLE service_role');
  try {
   const status=await refreshStatus();
   assert.deepEqual(Object.keys(status).sort(),['refreshing','nextAttemptAt','attemptedAt','succeededAt','failureCount','lastFailureCode','quoteCount','freshQuoteCount','oldestQuotedAt','newestQuotedAt'].sort());
  } finally { await db.exec('RESET ROLE'); }
  assert.deepEqual((await query('SELECT row_to_json(s) AS data FROM kq_crypto_refresh_state s')).data,before,'operational status never claims a lease or changes state');
 });
 if (process.argv.includes('--live-quotes')) await check('real CoinMarketCap adapter publishes the top100, enables fresh previews and completes a virtual buy/sell through service-role RPCs',checkLiveQuotes);
 console.log(`Crypto PostgreSQL: ${checks} checks passed.`);
} finally { await db.close(); }
