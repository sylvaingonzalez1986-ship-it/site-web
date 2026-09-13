// In-memory PostgreSQL only. No .env, Supabase client or network connection.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "../output/reputation-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
const vite = await createServer({
  configFile: false, envDir: false,
  resolve: { alias: { "@": path.resolve("src") } },
  server: { middlewareMode: true, watch: null },
});
const migration = (name) => readFile(path.resolve("supabase/migrations", name), "utf8");

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TABLE public.lottery_card_definitions(id UUID PRIMARY KEY, code TEXT, description TEXT, updated_at TIMESTAMPTZ);
    CREATE TABLE public.kq_support_card_rules(card_definition_id UUID, advantage TEXT, rules_version INTEGER, updated_at TIMESTAMPTZ);
    CREATE TABLE public.kq_runs(id UUID PRIMARY KEY, user_id UUID, state JSONB, status TEXT);
    CREATE TABLE public.kq_flowers(id UUID PRIMARY KEY, owner_id UUID, status TEXT);
    CREATE TABLE public.kq_equipment_wallets(
      user_id UUID PRIMARY KEY, cash_cents INTEGER NOT NULL DEFAULT 0 CHECK(cash_cents >= 0),
      reputation INTEGER NOT NULL DEFAULT 0 CHECK(reputation >= 0),
      planned_route_code TEXT, planned_equipment_code TEXT, updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE FUNCTION public.rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID
      LANGUAGE sql AS 'INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING';
  `);
  for (const name of [
    "20260830000200_kq_post_harvest_market.sql",
    "20260904000200_kq_route_masteries.sql",
    "20260905000100_kq_route_expertise_rewards.sql",
  ]) await db.exec(await migration(name));


  await db.exec(await migration("20260909000100_kq_quality_reputation.sql"));
  await db.exec(await migration("20260911000300_kq_cycle_electricity.sql"));
  await db.exec(await migration("20260912000200_kq_living_market.sql"));

  await db.exec("ALTER TABLE kq_runs ADD COLUMN started_at TIMESTAMPTZ DEFAULT now(), ADD COLUMN completed_at TIMESTAMPTZ, ADD CHECK ((status='completed')=(completed_at IS NOT NULL)); ALTER TABLE kq_flowers ADD COLUMN variety_name TEXT DEFAULT 'Test';");
  await db.exec("CREATE TABLE kq_equipment_loadouts(user_id UUID,equipment_code TEXT);");
  await db.exec(await migration("20260913000100_kq_sales_channels.sql"));
  await db.exec(await migration("20260913000200_kq_commerce_completed_at.sql"));
  await db.exec(await migration("20260913000300_kq_commerce_mastery_guards.sql"));
  await db.exec(await migration("20260913000400_kq_shop_partners.sql"));
  const { quoteKqMarketRoutes } = await vite.ssrLoadModule('/src/lib/kanab-quest-market.ts');
  const { KQ_EQUIPMENT_CATALOG } = await vite.ssrLoadModule('/src/lib/kanab-quest-equipment.ts');
  const { quoteKqCommerce } = await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts');
  const user=randomUUID(), outsider=randomUUID();
  await db.query('INSERT INTO auth.users VALUES($1),($2)',[user,outsider]);
  const state=async(owner=user)=>(await db.query('SELECT rpc_kq_commerce_state($1) AS result',[owner])).rows[0].result;
  const command=async(action,payload={},key=randomUUID(),owner=user)=>(await db.query('SELECT rpc_kq_commerce_command($1,$2,$3::jsonb,$4) AS result',[owner,action,JSON.stringify(payload),key])).rows[0].result;
  await state();
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=100000,reputation=1500 WHERE user_id=$1',[user]);
  const purchaseKey=randomUUID();
  const purchase=await command('buy-computer',{},purchaseKey);
  assert.equal(purchase.cashAfterCents,55000);
  assert.equal((await command('buy-computer',{},purchaseKey)).replayed,true);
  await assert.rejects(()=>command('buy-computer'),/commerce_computer_owned/);
  await assert.rejects(()=>command('internet',{enabled:true}),/commerce_cycle_required/);
  const run=randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,status,state) VALUES($1,$2,'active','{}')",[run,user]);
  await db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1",[run]);
  await db.query("UPDATE kq_commerce_campaigns SET event='normal' WHERE run_id=$1",[run]);
  assert.equal((await state()).campaign.internetPaid,false);
  await command('internet',{enabled:true});
  const subscribed=await state();
  assert.equal(subscribed.cashCents,53500);
  assert.equal(subscribed.campaign.internetPaid,true);
  await command('internet',{enabled:false});
  await command('internet',{enabled:true});
  assert.equal((await state()).cashCents,53500);
  const prepare=async(score=9,route='raw')=>{
    const flower=randomUUID();
    const current=await state();
    const equipmentCodes=KQ_EQUIPMENT_CATALOG.map(e=>e.code);
    await db.query('DELETE FROM kq_equipment_loadouts WHERE user_id=$1',[user]);
    for(const code of equipmentCodes) await db.query('INSERT INTO kq_equipment_loadouts VALUES($1,$2)',[user,code]);
    const options=quoteKqMarketRoutes({juryScore:score,harvestGrams:120,equipmentCodes,equipmentLevels:Object.fromEntries(equipmentCodes.map(c=>[c,10])),marketContext:{reputation:current.reputation,routeSales:current.routeSales,window:0,recentSales:{},marketVolumes:{}}});
    await db.query("INSERT INTO kq_flowers(id,owner_id,status) VALUES($1,$2,'burned')",[flower,user]);
    await db.query("SELECT rpc_kq_prepare_market_lot($1,$2,120,$3,'standard',$4::text[],$5::jsonb)",[user,flower,score,equipmentCodes,JSON.stringify(options)]);
    const selected=options.find(o=>o.route===route);
    const receipt=await command('prepare',{flowerId:flower,route,expectedCostCents:selected.market.processingCostCents});
    return receipt;
  };
  const quote=async(stockId,channel,units,policy='advised')=>{
    const current=await state();const stock=current.stocks.find(s=>s.id===stockId);
    const offer=quoteKqCommerce(current,stock,channel,policy,units);
    const id=randomUUID();
    await db.query("INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now()+interval '10 minutes')",[id,user,stockId,current.revision,current.campaign?.id,current.campaign?.revision,stock.remainingUnits,current.reputation,JSON.stringify(offer)]);
    return {id,offer};
  };
  const prepared=await prepare();
  assert.equal((await state()).stocks.length,1);
  await assert.rejects(()=>db.query("SELECT rpc_kq_sell_market_lot($1,$2,$3,'raw')",[user,prepared.flowerId,randomUUID()]),/market_lot_unavailable/);
  const first=await quote(prepared.stockId,'online',400);
  assert.equal(first.offer.units,400);
  const salePayload={quoteId:first.id,expectedPayoutCents:first.offer.payoutCents},saleKey=randomUUID();
  await assert.rejects(()=>command('sell',salePayload,randomUUID(),outsider),/commerce_offer_changed/);
  await assert.rejects(()=>command('sell',{...salePayload,expectedPayoutCents:1}),/commerce_offer_changed/);
  const sale=await command('sell',salePayload,saleKey);
  assert.equal(sale.remainingUnits,800);
  assert.equal((await command('sell',salePayload,saleKey)).replayed,true);
  await assert.rejects(()=>command('sell',salePayload),/commerce_offer_changed/);
  const shop=await quote(prepared.stockId,'cbd-shop',800);
  const shopReceipt=await command('sell',{quoteId:shop.id,expectedPayoutCents:shop.offer.payoutCents});
  assert.equal(shopReceipt.shopPartnersAfter,0);assert.equal(shopReceipt.shopPricePercent,55);
  assert.equal((await state()).shopRecruitment,3200);
  assert.equal(shopReceipt.satisfaction,'satisfied');
  assert.equal((await state()).stocks.length,0);
  assert.equal((await db.query('SELECT status FROM kq_market_lots WHERE flower_id=$1',[prepared.flowerId])).rows[0].status,'sold');
  assert.equal((await db.query('SELECT COUNT(*)::int n FROM kq_market_sale_receipts WHERE flower_id=$1',[prepared.flowerId])).rows[0].n,2);
  assert.equal((await state()).routeSales.raw,1);
  const poor=await prepare(1);
  assert.equal((await quote(poor.stockId,'cbd-shop',1200)).offer.maxUnits,0);
  const wholesale=await quote(poor.stockId,'wholesale',1200);
  assert.equal(wholesale.offer.units,1200);assert.equal(wholesale.offer.reputationDelta,0);
  await command('sell',{quoteId:wholesale.id,expectedPayoutCents:wholesale.offer.payoutCents});
  assert.equal((await state()).routeSales.raw,1);
  const transformed=await prepare(9,'dry-sift');
  const transformedStocks=(await state()).stocks.filter(s=>s.flowerId===transformed.flowerId);
  assert.equal(transformedStocks.reduce((n,s)=>n+s.equivalentUnits,0),1200);
  assert.equal(transformedStocks.filter(s=>s.route==='dry-sift').length,1);
  await assert.rejects(()=>command('prepare',{flowerId:transformed.flowerId,route:'raw',expectedCostCents:0}),/commerce_lot_unavailable/);
  // Selling unprocessed leftovers must not teach the transformation trade.
  const partial=await prepare(9,'dry-sift');
  await db.query('UPDATE kq_commerce_stock SET initial_units=72,remaining_units=72,equivalent_units=400 WHERE id=$1',[partial.stockId]);
  await db.query('DELETE FROM kq_commerce_stock WHERE flower_id=$1 AND id<>$2',[partial.flowerId,partial.stockId]);
  const remainderId=randomUUID();
  await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',800,800,800,180)",[remainderId,partial.flowerId,user]);
  const beforeMastery=(await state()).routeSales['dry-sift']??0;
  const remainderOffer=await quote(remainderId,'cbd-shop',800);
  await command('sell',{quoteId:remainderOffer.id,expectedPayoutCents:remainderOffer.offer.payoutCents});
  assert.equal((await state()).routeSales['dry-sift']??0,beforeMastery);
  const realProduct=await quote(partial.stockId,'cbd-shop',72);
  await command('sell',{quoteId:realProduct.id,expectedPayoutCents:realProduct.offer.payoutCents});
  assert.equal((await state()).routeSales['dry-sift'],beforeMastery+1);
  // Two independently prepared offers share one revision: only one can settle.
  const competingA=await quote(transformed.stockId,'cbd-shop',1);
  const competingB=await quote(transformed.stockId,'cbd-shop',1);
  const competing=await Promise.allSettled([command('sell',{quoteId:competingA.id,expectedPayoutCents:competingA.offer.payoutCents}),command('sell',{quoteId:competingB.id,expectedPayoutCents:competingB.offer.payoutCents})]);
  assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(competing.filter(r=>r.status==='rejected').length,1);
  const stale=await quote(transformed.stockId,'cbd-shop',1);
  await db.query("UPDATE kq_commerce_quotes SET expires_at=now()-interval '1 second' WHERE id=$1",[stale.id]);
  await assert.rejects(()=>command('sell',{quoteId:stale.id,expectedPayoutCents:stale.offer.payoutCents}),/commerce_offer_changed/);
  const newEnergy=await quote(transformed.stockId,'cbd-shop',1);
  await db.query("INSERT INTO kq_energy_invoices(run_id,user_id,total_cents,remaining_cents,quote,harvest_grams) VALUES($1,$2,100,100,'{}',120)",[run,user]);
  await assert.rejects(()=>command('sell',{quoteId:newEnergy.id,expectedPayoutCents:newEnergy.offer.payoutCents}),/commerce_offer_changed/);
  await db.query('DELETE FROM kq_energy_invoices WHERE run_id=$1',[run]);
  assert(!(await state()).rawFlowerIds.includes(prepared.flowerId));
  assert(!(await state()).rawFlowerIds.includes(transformed.flowerId));
  const networkBeforeCycle=await state();
  // Finishing another cycle renews once; ordinary reads and status replays cannot charge again.
  const cashBefore=(await state()).cashCents;
  const nextRun=randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,status,state) VALUES($1,$2,'active','{}')",[nextRun,user]);
  await db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1",[nextRun]);
  assert.equal((await state()).cashCents,cashBefore-1500);
  await db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1",[nextRun]);
  assert.equal((await state()).cashCents,cashBefore-1500);
  assert.equal((await state()).campaign.directUsed,0);
  assert.equal((await state()).campaign.shopPartnersStart,networkBeforeCycle.shopPartners);
  assert.equal((await state()).campaign.shopRecruitmentStart,networkBeforeCycle.shopRecruitment);
  assert.equal((await state()).campaign.shopGoodUnits,0);
  assert.equal((await state()).stocks.length,transformedStocks.length);
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1',[user]);
  const emptyRun=randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,status,state) VALUES($1,$2,'active','{}')",[emptyRun,user]);
  await db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1",[emptyRun]);
  assert.equal((await state()).campaign.internetPaid,false);
  assert.equal((await state()).cashCents,0);
  const returningUser=randomUUID(),oldRun=randomUUID(),recentRun=randomUUID();
  await db.query('INSERT INTO auth.users VALUES($1)',[returningUser]);
  await db.query("INSERT INTO kq_runs(id,user_id,status,state,started_at,completed_at) VALUES($1,$3,'completed','{}',now()-interval '3 days',now()-interval '2 days'),($2,$3,'completed','{}',now()-interval '1 day',now())",[oldRun,recentRun,returningUser]);
  assert.equal((await state(returningUser)).campaign.id,recentRun);
  assert.equal((await state(returningUser)).campaign.internetPaid,false);
  // Network updates are server-validated, persistent, replay-safe and isolated from direct clients.
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=100000 WHERE user_id=$1',[user]);
  const networkRun=(await state()).campaign.id;
  await db.query('UPDATE kq_commerce_accounts SET shop_partners=4,shop_recruitment=0,shop_churn=0 WHERE user_id=$1',[user]);
  await db.query("UPDATE kq_commerce_campaigns SET shop_partners_start=4,shop_recruitment_start=0,shop_churn_start=0,shop_good_units=0,shop_bad_units=0,shop_used=0,event='normal' WHERE run_id=$1",[networkRun]);
  const disappointing=await prepare(6.5), lostOffer=await quote(disappointing.stockId,'cbd-shop',1200);
  const originalOffer=lostOffer.offer;
  await db.query('UPDATE kq_commerce_quotes SET offer=$2::jsonb WHERE id=$1',[lostOffer.id,JSON.stringify({...originalOffer,shopPartnersAfter:20})]);
  await assert.rejects(()=>command('sell',{quoteId:lostOffer.id,expectedPayoutCents:originalOffer.payoutCents}),/commerce_offer_changed/);
  assert.equal((await state()).shopPartners,4);
  await db.query('UPDATE kq_commerce_quotes SET offer=$2::jsonb WHERE id=$1',[lostOffer.id,JSON.stringify(originalOffer)]);
  const lostKey=randomUUID(), lostPayload={quoteId:lostOffer.id,expectedPayoutCents:originalOffer.payoutCents};
  const lost=await command('sell',lostPayload,lostKey);
  assert.equal(lost.shopPartnersDelta,-1);assert.equal(lost.shopPartnersAfter,3);assert.equal(lost.satisfaction,'disappointed');
  const replay=await command('sell',lostPayload,lostKey);assert.equal(replay.shopPartnersDelta,-1);assert.equal((await state()).shopPartners,3);
  assert.equal((await state()).campaign.shopPartnersStart,4);
  assert((await state()).receipts.some(r=>r.shopPartnersDelta===-1));
  console.log('Commerce SQL passed: migrations, computer, cycle billing, partial stock, multi-channel receipts, low-quality wholesale, quote protection, ownership, replay, mastery and retained inventory.');
} finally { await vite.close(); await db.close(); }
