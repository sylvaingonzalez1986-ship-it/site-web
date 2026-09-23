// Actual crypto migration exercised in an isolated PostgreSQL engine. No network or credentials.
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
let checks = 0;
async function check(name, fn) { await fn(); console.log(`PASS ${name}`); checks++; }
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
  const held=(await query("UPDATE kq_crypto_refresh_state SET attempted_at=now()-interval '6 minutes' RETURNING id")).id; assert(held);
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
 });
 console.log(`Crypto PostgreSQL: ${checks} checks passed.`);
} finally { await db.close(); }
