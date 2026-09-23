// Actual stock RPCs in isolated PostgreSQL. No credentials or deployed writes.
// --live-quotes reads the provider sample previously saved by check-stock-market-live.mjs.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {PGlite} from '../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),owner=randomUUID(),other=randomUUID();
const vite=await createServer({configFile:false,envDir:false,resolve:{alias:{'@':resolve('src')}},server:{middlewareMode:true,watch:null}});
const query=async(sql,values=[])=>(await db.query(sql,values)).rows[0];
const command=async(user,action='state',payload={},ids=[])=>(await query('SELECT rpc_kq_stock_command($1,$2,$3::jsonb,$4) data',[user,action,JSON.stringify(payload),ids])).data;
const buy=(user,assetId,amountCents)=>command(user,'preview',{side:'buy',assetId,amountCents});
const sell=(user,assetId,quantity)=>command(user,'preview',{side:'sell',assetId,quantity});
const confirm=(user,orderId)=>command(user,'confirm',{orderId});
const cash=async(user)=>(await query('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[user])).cash_cents;
const claim=async(ids)=>(await query('SELECT rpc_kq_stock_refresh_claim($1) data',[ids])).data;
const publish=async(lease,assets)=>(await query('SELECT rpc_kq_stock_refresh_publish($1,$2::jsonb) ok',[lease,JSON.stringify(assets)])).ok;
const ago=ms=>new Date(Date.now()-ms).toISOString();
let count=0,model;
async function check(name,fn){await fn();console.log('PASS '+name);count++;}
function quote(id,extra={}){const instrument=model.getKqStockInstrument(id);return{id,priceNative:'10',currency:instrument.currency,changePercent:1.5,quotedAt:ago(0),marketState:'open',fxRate:instrument.currency==='EUR'?'1':'1.25',fxQuotedAt:instrument.currency==='EUR'?null:ago(0),...extra};}
async function refresh(assets){const ids=assets.map(row=>row.id);await db.query("UPDATE kq_stock_quotes SET attempted_at=now()-interval '2 minutes',refreshed_at=now()-interval '6 minutes',lease_until=NULL WHERE asset_id=ANY($1)",[ids]);const lease=await claim(ids);assert(lease?.leaseId);return publish(lease.leaseId,assets);}
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
 await db.exec(await readFile('supabase/migrations/20260923000800_kq_stock_market.sql', 'utf8'));
 await db.exec(`CREATE FUNCTION cash_observer() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
 PERFORM kq_treasury_pair(NEW.user_id,'cash-movement',gen_random_uuid()::TEXT,now(),'cash','suspense',(NEW.cash_cents-OLD.cash_cents)::BIGINT); RETURN NEW; END $$;
 CREATE TRIGGER wallet_cash AFTER UPDATE OF cash_cents ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION cash_observer();`);
 for (const user of [owner, other]) {
  await db.query('INSERT INTO auth.users VALUES($1)', [user]); await db.query('INSERT INTO kq_equipment_wallets VALUES($1,1000000,now())', [user]);
  await db.query('INSERT INTO kq_commerce_accounts(user_id) VALUES($1)', [user]); await db.query('INSERT INTO kq_treasury_accounts VALUES($1)', [user]);
 }

 model=await vite.ssrLoadModule('/src/lib/kanab-quest-stocks.ts');
 await db.exec(await readFile('supabase/migrations/20260923000900_kq_stock_catalog.sql','utf8'));
 await check('actual catalog migration seeds all 545 instruments with browser-identical metadata',async()=>{const rows=(await db.query('SELECT id,symbol,name,kind,markets,currency FROM kq_stock_instruments ORDER BY id COLLATE \"C\"')).rows;assert.equal(rows.length,545);assert.deepEqual(rows,model.KQ_STOCK_INSTRUMENTS.map(({id,symbol,name,kind,markets,currency})=>({id,symbol,name,kind,markets,currency})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));});
 await check('catalog metadata survives absent quotes without inventing prices',async()=>{
  const snapshot=await command(owner,'state',{},['AAPL','^FCHI']);assert(model.isKqStockSnapshot(snapshot));assert.equal(snapshot.assets.length,2);assert(snapshot.assets.every(asset=>asset.priceEur===null&&asset.quotedAt===null));
  await assert.rejects(command(owner,'state',{},['NOT-IN-CATALOG']),/stocks_invalid/);await assert.rejects(claim(Array(13).fill('AAPL')),/stocks_invalid_instruments/);
 });
 await check('shared per-asset leases avoid crossed batches and publish partial successes',async()=>{
  const first=await claim(['AAPL','AI.PA']);assert.deepEqual(first.assetIds,['AAPL','AI.PA']);assert.equal(await claim(['AAPL']),null);
  const overlap=await claim(['AI.PA','^FCHI']);assert.deepEqual(overlap.assetIds,['^FCHI']);
  assert.equal(await publish(randomUUID(),[quote('AAPL')]),false);assert.equal(await publish(null,[quote('AAPL')]),false);
  assert.equal(await publish(first.leaseId,[quote('AAPL',{priceNative:'250'}),quote('AI.PA',{priceNative:'NaN'})]),true);
  const snapshot=await command(owner,'state',{},['AAPL','AI.PA']);assert(model.isKqStockSnapshot(snapshot));assert.equal(snapshot.assets.find(a=>a.id==='AAPL').priceEur,'200.000000000000000000');assert.equal(snapshot.assets.find(a=>a.id==='AI.PA').priceEur,null);
  assert.equal(await publish(first.leaseId,[quote('AI.PA')]),false);assert.equal(await publish(overlap.leaseId,[quote('^FCHI',{priceNative:'8000',marketState:'closed',quotedAt:ago(48*3600000)})]),true);
 });
 await check('five-minute successes and one-minute failure backoff have independent asset scopes',async()=>{
  assert.equal(await claim(['AI.PA']),null);await db.exec("UPDATE kq_stock_quotes SET attempted_at=now()-interval '61 seconds' WHERE asset_id='AI.PA'");const retry=await claim(['AI.PA']);assert(retry);assert.equal(await publish(retry.leaseId,[quote('AI.PA')]),true);
  await db.exec("UPDATE kq_stock_quotes SET attempted_at=now()-interval '2 minutes' WHERE asset_id='AAPL'");assert.equal(await claim(['AAPL']),null);
  await db.exec("UPDATE kq_stock_quotes SET refreshed_at=now()-interval '6 minutes',lease_until=now()+interval '30 seconds' WHERE asset_id='AAPL'");assert.equal(await claim(['AAPL']),null);await db.exec("UPDATE kq_stock_quotes SET lease_until=NULL WHERE asset_id='AAPL'");assert.equal(await refresh([quote('AAPL',{priceNative:'250'})]),true);
 });
 await check('malformed, future, stale and mismatched FX rows never overwrite valid quotes',async()=>{
  const bad=[{priceNative:'NaN'},{priceNative:'Infinity'},{priceNative:'-1'},{quotedAt:ago(-120000)},{quotedAt:'not-a-date'},{quotedAt:ago(46*60000)}, {marketState:'closed',quotedAt:ago(97*3600000)}, {fxQuotedAt:ago(46*60000)},{fxQuotedAt:ago(97*3600000)},{fxQuotedAt:ago(-120000)},{fxRate:'0'},{currency:'EUR'},{changePercent:'2'}];
  for(const extra of bad){assert.equal(await refresh([quote('AAPL',extra)]),false);assert.equal((await query("SELECT price_eur FROM kq_stock_quotes WHERE asset_id='AAPL'")).price_eur,'200.000000000000000000');}
  assert.equal(await refresh([quote('AI.PA',{fxRate:'2'})]),false);assert.equal(await refresh([quote('AAPL',{priceNative:'250'})]),true);
 });
 let original;
 await check('fractional USD purchases lock server EUR and FX before any wallet debit',async()=>{
  original=await buy(owner,'AAPL',10000);assert(model.isKqStockOrder(original));assert.equal(original.quantity,'0.500000000000000000');assert.equal(await cash(owner),1000000);
  assert.equal(await refresh([quote('AAPL',{priceNative:'275'})]),true);const receipt=await confirm(owner,original.orderId);assert(model.isKqStockTrade(receipt.trade));assert.equal(receipt.trade.priceEur,'200.000000000000000000');assert.equal(await cash(owner),990000);
  const state=await command(owner);assert(model.isKqStockSnapshot(state));assert.equal(state.positions[0].valueCents,11000);assert.equal(state.positions[0].costBasisCents,10000);
 });
 await check('committed receipt replays after expiry, unknown owners and invalid orders fail closed',async()=>{
  await db.query("UPDATE kq_stock_orders SET expires_at=now()-interval '1 day' WHERE id=$1",[original.orderId]);assert.equal((await confirm(owner,original.orderId)).replayed,true);assert.equal(await cash(owner),990000);
  await assert.rejects(confirm(other,original.orderId),/stocks_order_missing/);await assert.rejects(confirm(owner,'not-a-uuid'),/stocks_invalid/);
  for(const amount of [0,99,100000001,-100,1.5])await assert.rejects(buy(owner,'AAPL',amount),/stocks_invalid/);
 });
 await check('partial sale cost basis, oversell protection and final loss remain exact in euros',async()=>{
  const partial=await sell(owner,'AAPL','0.2'),oversell=await sell(owner,'AAPL','0.5');const sold=await confirm(owner,partial.orderId);assert.equal(sold.trade.amountCents,4400);assert.equal(sold.trade.costBasisCents,4000);assert.equal(sold.trade.realizedPnlCents,400);
  await assert.rejects(confirm(owner,oversell.orderId),/stocks_quantity/);await refresh([quote('AAPL',{priceNative:'200'})]);const final=await sell(owner,'AAPL','0.3');const loss=await confirm(owner,final.orderId);assert.equal(loss.trade.amountCents,4800);assert.equal(loss.trade.costBasisCents,6000);assert.equal(loss.trade.realizedPnlCents,-1200);assert.equal(await cash(owner),999200);assert.equal((await command(owner)).positions.length,0);
 });
 await check('retired constituents keep holdings and sales but prohibit new purchases',async()=>{
  await refresh([quote('AI.PA')]);const purchase=await buy(owner,'AI.PA',10000);await confirm(owner,purchase.orderId);await db.exec("UPDATE kq_stock_instruments SET markets='{}' WHERE id='AI.PA'");
  const held=await command(owner);assert(held.assets.some(a=>a.id==='AI.PA'&&a.markets.length===0));await assert.rejects(buy(owner,'AI.PA',100),/stocks_retired/);
  const sale=await sell(owner,'AI.PA',purchase.quantity);await confirm(owner,sale.orderId);await db.query("UPDATE kq_stock_instruments SET markets=$1 WHERE id='AI.PA'",[model.getKqStockInstrument('AI.PA').markets]);
 });
 await check('closed indices remain tradable at a recently fetched last close, including FX',async()=>{
  await refresh([quote('^FCHI',{priceNative:'8000',marketState:'closed',quotedAt:ago(48*3600000)}),quote('^GSPC',{priceNative:'6000',marketState:'closed',quotedAt:ago(48*3600000),fxQuotedAt:ago(48*3600000)})]);
  for(const id of ['^FCHI','^GSPC']){const offer=await buy(owner,id,10000);assert(model.isKqStockOrder(offer));await confirm(owner,offer.orderId);}
  const snapshot=await command(owner);assert(model.isKqStockSnapshot(snapshot));assert(snapshot.positions.every(p=>p.valueCents!==null));assert(snapshot.assets.every(a=>model.canTradeKqStockAsset(a,Date.parse(snapshot.serverNow))));
 });
 await check('stale fetched data, market timestamps and FX disable trades and valuations',async()=>{
  for(const [id,change] of [['^FCHI',"refreshed_at=now()-interval '11 minutes'"],['^FCHI',"refreshed_at=now(),quoted_at=now()-interval '97 hours'"],['^GSPC',"fx_quoted_at=now()-interval '97 hours'"],['^GSPC',"fx_quoted_at=now(),market_state='open',quoted_at=now()-interval '46 minutes'"]]){
   await db.exec(`UPDATE kq_stock_quotes SET ${change} WHERE asset_id='${id}'`);await assert.rejects(buy(owner,id,100),/stocks_stale/);assert.equal((await command(owner)).positions.find(p=>p.assetId===id).valueCents,null);
  }
  await refresh([quote('^FCHI',{priceNative:'8000'}),quote('^GSPC',{priceNative:'6000'})]);
 });
 await check('order lifetime never extends past fetched-price or FX validity',async()=>{
  await refresh([quote('AAPL',{priceNative:'250'})]);await db.exec("UPDATE kq_stock_quotes SET refreshed_at=now()-interval '9 minutes 50 seconds' WHERE asset_id='AAPL'");
  const offer=await buy(owner,'AAPL',100);assert(Date.parse(offer.expiresAt)-Date.now()<=11000);await db.query("UPDATE kq_stock_orders SET expires_at=now()-interval '1 second' WHERE id=$1",[offer.orderId]);const before=await cash(owner);await assert.rejects(confirm(owner,offer.orderId),/stocks_expired/);assert.equal(await cash(owner),before);
  await refresh([quote('AAPL',{fxQuotedAt:ago(45*60000-10000)})]);const fx=await buy(owner,'AAPL',100);assert(Date.parse(fx.expiresAt)-Date.now()<=11000);await refresh([quote('AAPL',{priceNative:'250'})]);
 });
 await check('numeric quantity guards and sub-cent proceeds cannot manufacture value',async()=>{
  await refresh([quote('AI.PA',{priceNative:'0.000000000000000001'})]);await assert.rejects(buy(owner,'AI.PA',10000),/stocks_position_limit/);await refresh([quote('AI.PA')]);const offer=await buy(owner,'AI.PA',12345);await confirm(owner,offer.orderId);await assert.rejects(sell(owner,'AI.PA','0.000000000000000001'),/stocks_dust/);
 });
 await check('wallet overflow and accounting errors roll back every economic side effect',async()=>{
  const held=await buy(other,'AI.PA',100);await confirm(other,held.orderId);const balance=await cash(other);await db.query('UPDATE kq_equipment_wallets SET cash_cents=2147483640 WHERE user_id=$1',[other]);const tooLarge=await sell(other,'AI.PA',held.quantity);await assert.rejects(confirm(other,tooLarge.orderId),/stocks_wallet_limit/);await db.query('UPDATE kq_equipment_wallets SET cash_cents=$2 WHERE user_id=$1',[other,balance]);
  const order=await buy(owner,'AI.PA',100);const before=await cash(owner);await db.exec("CREATE FUNCTION fail_stock_posting() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture accounting unavailable'; END $$; CREATE TRIGGER fail_stock_posting BEFORE INSERT ON kq_treasury_journal FOR EACH ROW WHEN(NEW.kind='stock-buy') EXECUTE FUNCTION fail_stock_posting();");await assert.rejects(confirm(owner,order.orderId),/fixture accounting unavailable/);assert.equal(await cash(owner),before);assert.equal((await query('SELECT count(*) n FROM kq_stock_trades WHERE order_id=$1',[order.orderId])).n,0);await db.exec('DROP TRIGGER fail_stock_posting ON kq_treasury_journal');
 });
 await check('cash counterparts, security cost and realized financial returns reconcile',async()=>{
  assert.equal((await query("SELECT COALESCE(SUM(balance_cents),0)::INTEGER value FROM kq_treasury_balances WHERE account='suspense'")).value,0);
  assert.equal((await query("SELECT count(*) n FROM kq_treasury_journal WHERE (SELECT SUM((p->>'deltaCents')::BIGINT) FROM jsonb_array_elements(postings) p)<>0")).n,0);
  for(const user of [owner,other])assert.equal(Number((await query("SELECT balance_cents FROM kq_treasury_balances WHERE user_id=$1 AND account='securities_assets'",[user])).balance_cents),Number((await query('SELECT SUM(cost_basis_cents) value FROM kq_stock_positions WHERE user_id=$1',[user])).value));
 });
 await check('all stock tables and helpers stay private; only named RPCs execute as service role',async()=>{
  for(const role of ['anon','authenticated','service_role'])for(const table of ['kq_stock_instruments','kq_stock_quotes','kq_stock_positions','kq_stock_orders','kq_stock_trades'])assert.equal((await query('SELECT has_table_privilege($1,$2,$3) allowed',[role,table,'SELECT,INSERT,UPDATE,DELETE'])).allowed,false);
  for(const role of ['anon','authenticated'])assert.equal((await query("SELECT has_function_privilege($1,'rpc_kq_stock_command(uuid,text,jsonb,text[])','EXECUTE') allowed",[role])).allowed,false);
  await db.exec('SET ROLE service_role');try{assert(model.isKqStockSnapshot(await command(owner,'state',{},['AAPL'])));}finally{await db.exec('RESET ROLE');}
 });
 if(process.argv.includes('--live-quotes'))await check('real provider sample publishes and completes an isolated virtual round trip',async()=>{
  const sample=JSON.parse(await readFile('output/stock-market-live-check.json','utf8'));assert(Array.isArray(sample.quotes)&&sample.quotes.length>0&&sample.quotes.length<=12);const ids=sample.quotes.map(row=>row.id);
  await db.query("UPDATE kq_stock_quotes SET attempted_at=now()-interval '2 minutes',refreshed_at=now()-interval '6 minutes',lease_until=NULL WHERE asset_id=ANY($1)",[ids]);
  await db.exec('SET ROLE service_role');try{const lease=await claim(ids);assert(lease);assert.equal(await publish(lease.leaseId,sample.quotes),true);const snapshot=await command(other,'state',{},ids);assert(model.isKqStockSnapshot(snapshot));const executable=snapshot.assets.filter(asset=>ids.includes(asset.id)&&model.canTradeKqStockAsset(asset,Date.parse(snapshot.serverNow)));assert.equal(executable.length,sample.quotes.length,'every real provider quote must publish and enable trading');for(const asset of executable){const source=sample.quotes.find(row=>row.id===asset.id);assert.equal(Number(asset.priceNative),Number(source.priceNative));const converted=Number(source.priceNative)/(source.currency==='USD'?Number(source.fxRate):1);assert(Math.abs(Number(asset.priceEur)-converted)<=Math.max(1e-10,Math.abs(converted)*1e-12),'SQL EUR conversion matches the real native price and FX');}
   for(const asset of executable)assert(model.isKqStockOrder(await buy(other,asset.id,10000)));
   const asset=executable.find(row=>!(snapshot.positions.some(position=>position.assetId===row.id)))??executable[0];const offer=await buy(other,asset.id,10000);const bought=await confirm(other,offer.orderId);assert(model.isKqStockTrade(bought.trade));const exit=await sell(other,asset.id,offer.quantity);const sold=await confirm(other,exit.orderId);assert(model.isKqStockTrade(sold.trade));assert(sold.trade.amountCents<=10000,'fractional rounding never creates a cent');console.log(JSON.stringify({source:'saved real provider sample',validatedAssets:executable.length,roundTrip:asset.id,execution:'isolated PostgreSQL only'}));
  }finally{await db.exec('RESET ROLE');}
 });
 console.log(`Stocks PostgreSQL: ${count} checks passed.`);
}catch(error){console.error(error.stack??error.message,{where:error.where,position:error.position,internalPosition:error.internalPosition,internalQuery:error.internalQuery});process.exitCode=1;}finally{await vite.close();await db.close();}
