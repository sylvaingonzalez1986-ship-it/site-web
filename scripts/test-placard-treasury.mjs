// Isolated PostgreSQL integration checks. No .env, credentials, network or deployed writes.
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
const result = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const state = async (owner) => (await result("SELECT rpc_kq_commerce_state($1) AS data", [owner])).data;
const command = async (owner, action, payload = {}, key = randomUUID()) => (await result(
  "SELECT rpc_kq_commerce_command($1,$2,$3::jsonb,$4) AS data", [owner, action, JSON.stringify(payload), key])).data;
const cash = async (owner) => (await result("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner])).cash_cents;
let quoteKqCommerce, previewKqBusinessPayment, getKqTreasuryReport, isKqTreasurySnapshot;

async function bootstrap() {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql AS 'SELECT NULL::UUID';
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY,code TEXT,description TEXT,updated_at TIMESTAMPTZ);
    CREATE TABLE kq_support_card_rules(card_definition_id UUID,advantage TEXT,rules_version INTEGER,updated_at TIMESTAMPTZ);
    CREATE TYPE kq_run_status AS ENUM ('active','completed','abandoned');
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,state JSONB,status kq_run_status,
      started_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ,updated_at TIMESTAMPTZ DEFAULT now(),integrity_code TEXT,
      CHECK((status='completed')=(completed_at IS NOT NULL)));
    CREATE UNIQUE INDEX one_active_run ON kq_runs(user_id) WHERE status='active';
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY,owner_id UUID,status TEXT,variety_name TEXT DEFAULT 'Test');
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY,cash_cents INTEGER NOT NULL DEFAULT 35000 CHECK(cash_cents>=0),
      reputation INTEGER NOT NULL DEFAULT 0 CHECK(reputation>=0),planned_route_code TEXT,planned_equipment_code TEXT,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS
      'INSERT INTO kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING';
    CREATE TABLE kq_equipment_catalog(code TEXT PRIMARY KEY,category TEXT,slot TEXT,price_cents INTEGER,is_active BOOLEAN DEFAULT true);
    CREATE TABLE kq_player_equipment(user_id UUID,equipment_code TEXT,level INTEGER DEFAULT 1,PRIMARY KEY(user_id,equipment_code));
    CREATE TABLE kq_equipment_loadouts(user_id UUID,equipment_code TEXT);
    CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY,pseudo TEXT UNIQUE,updated_at TIMESTAMPTZ DEFAULT now());
    -- Starts use representative insert bodies; identity/updated-at run actions below use their actual migrations.
    CREATE FUNCTION rpc_kq_start_run(p_user_id UUID,p_buddie TEXT,p_seed INTEGER,p_deck TEXT[],p_scenario TEXT[],p_initial_state JSONB,p_culture_tokens INTEGER DEFAULT 0)
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE v_run public.kq_runs%ROWTYPE;
    BEGIN
      INSERT INTO public.kq_runs(user_id,state,status) VALUES(p_user_id,p_initial_state,'active') RETURNING * INTO v_run;
      RETURN jsonb_build_object('run',to_jsonb(v_run));
    END $$;
    CREATE FUNCTION rpc_kq_start_run_with_heritage(p_user_id UUID,p_buddie TEXT,p_seed INTEGER,p_deck TEXT[],p_scenario TEXT[],p_initial_state JSONB,p_heritage INTEGER,p_card TEXT)
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE v_expected_xp INTEGER; v_base_xp INTEGER:=1; v_buddie_xp INTEGER:=4; v_heritage_xp INTEGER:=0; v_result JSONB;
    BEGIN
      v_expected_xp := v_base_xp + v_buddie_xp + v_heritage_xp;
      v_result:=public.rpc_kq_start_run(p_user_id,p_buddie,p_seed,p_deck,p_scenario,p_initial_state,p_heritage);
      IF v_buddie_xp > 0 OR v_heritage_xp > 0 THEN RETURN v_result||jsonb_build_object('xp',v_expected_xp); END IF;
      RETURN v_result;
    END $$;
    REVOKE ALL ON FUNCTION rpc_kq_start_run(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER),rpc_kq_start_run_with_heritage(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION rpc_kq_start_run(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER),rpc_kq_start_run_with_heritage(UUID,TEXT,INTEGER,TEXT[],TEXT[],JSONB,INTEGER,TEXT) TO service_role;
  `);
  for (const name of [
    "20260725001800_kq_atomic_heritage_hand_swap.sql",
    "20260818000100_kq_accept_decimal_flower_stats.sql",
    "20260830000200_kq_post_harvest_market.sql",
    "20260904000200_kq_route_masteries.sql",
    "20260905000100_kq_route_expertise_rewards.sql",
    "20260909000100_kq_quality_reputation.sql",
    "20260911000300_kq_cycle_electricity.sql",
    "20260912000200_kq_living_market.sql",
    "20260913000100_kq_sales_channels.sql",
    "20260913000200_kq_commerce_completed_at.sql",
    "20260913000300_kq_commerce_mastery_guards.sql",
    "20260913000400_kq_shop_partners.sql",
    "20260914000100_arena_chanvrier_profiles.sql",
    "20260914000200_kq_machine_maintenance.sql",
    "20260914000300_chanvrier_treasurer_starting_capital.sql",
    "20260914000400_chanvrier_green_thumb_xp.sql",
    "20260914000500_kq_shop_offer_precision.sql",
    "20260915000300_kq_realtime_commerce_demand.sql",
    "20260919000100_chanvrier_customization_and_benefits.sql",
  ]) await db.exec(await migration(name));
}

async function player({ balance = 1000000, strength = null, completed = true } = {}) {
  const owner = randomUUID();
  await db.query("INSERT INTO auth.users VALUES($1)", [owner]);
  await state(owner);
  await db.query("UPDATE kq_equipment_wallets SET cash_cents=$2,reputation=200 WHERE user_id=$1", [owner, balance]);
  if (strength) await db.query("SELECT rpc_arena_save_chanvrier($1,$2::jsonb)", [owner, JSON.stringify({
    nickname: `P${owner.replaceAll('-', '').slice(0, 12)}`, gender: "male", clothing: "teal", skin: "peach", strength,
  })]);
  if (completed) {
    const run = randomUUID();
    // Fixture insertion bypasses completion-trigger billing; actual completion is exercised separately.
    await db.query("INSERT INTO kq_runs(id,user_id,state,status,completed_at) VALUES($1,$2,'{}','completed',now())", [run, owner]);
    await state(owner);
    await db.query("UPDATE kq_commerce_campaigns SET event='normal' WHERE user_id=$1", [owner]);
  }
  return owner;
}

async function stock(owner, { units = 5000, score = 9, price = 180 } = {}) {
  const flower = randomUUID(), id = randomUUID();
  await db.query("INSERT INTO kq_flowers(id,owner_id,status) VALUES($1,$2,'burned')", [flower, owner]);
  await db.query("INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,options,status,selected_route) VALUES($1,$2,$3,$4,'signature','[]','stocked','raw')", [flower, owner, units / 10, score]);
  await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'raw',$3,0)", [flower, owner, units]);
  await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',$4,$4,$4,$5)", [id, flower, owner, units, price]);
  return id;
}

async function quote(owner, stockId, channel = "online", units = 100) {
  const current = await state(owner);
  const item = current.stocks.find((entry) => entry.id === stockId);
  let offer = quoteKqCommerce(current, item, channel, "advised", units);
  const id = randomUUID();
  const energy = Number((await result("SELECT COALESCE(sum(remaining_cents),0) AS cents FROM kq_energy_invoices WHERE user_id=$1", [owner])).cents);
  offer = { ...offer, ...previewKqBusinessPayment(offer.payoutCents, current.business, energy) };
  await db.query(`INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,energy_outstanding_cents,offer,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now()+interval '10 minutes')`,
  [id, owner, stockId, current.revision, current.campaign?.id, current.campaign?.revision, item.remainingUnits, current.reputation, energy, JSON.stringify(offer)]);
  return { id, offer, current };
}

async function sell(owner, quoted, key = randomUUID()) {
  return command(owner, "sell", { quoteId: quoted.id, expectedPayoutCents: quoted.offer.payoutCents }, key);
}

async function openShop(owner, name = "La Fleur locale") {
  await command(owner, "buy-computer");
  return command(owner, "create-shop", { name });
}

async function complete(owner) {
  const run = randomUUID();
  await db.query("INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,'{}','active')", [run, owner]);
  await db.query("UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1", [run]);
  return run;
}


// Only missing schema surfaces are fixtures; commerce, savings, invoicing and
// treasury routines below execute their actual migrations in isolated PostgreSQL.
async function extendSchema() {
  await db.exec(`
    ALTER TABLE kq_flowers ADD COLUMN run_id UUID REFERENCES kq_runs(id), ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE kq_player_equipment ADD COLUMN purchase_price_cents INTEGER DEFAULT 0, ADD COLUMN acquired_at TIMESTAMPTZ DEFAULT now();
    CREATE TABLE kq_equipment_purchase_receipts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),request_key UUID NOT NULL,user_id UUID NOT NULL REFERENCES auth.users(id),
      equipment_codes TEXT[] NOT NULL,total_price_cents INTEGER NOT NULL,cash_after_cents INTEGER NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(user_id,request_key));
    CREATE TABLE kq_equipment_upgrade_receipts(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES auth.users(id),request_key UUID NOT NULL,
      equipment_code TEXT NOT NULL,previous_level INTEGER NOT NULL,level INTEGER NOT NULL,price_cents INTEGER NOT NULL,cash_after_cents INTEGER NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(user_id,request_key));
    CREATE TABLE kq_culture_equipment_replacements(user_id UUID NOT NULL REFERENCES auth.users(id),request_key UUID NOT NULL,equipment_code TEXT NOT NULL,
      expected_version INTEGER NOT NULL,receipt JSONB NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,request_key));
    CREATE TABLE kq_pioneer_pack_grants(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users(id),cash_cents INTEGER NOT NULL,granted_at TIMESTAMPTZ DEFAULT now());
  `);
  await db.exec(await migration('20260919000200_chanvrier_savings.sql'));
}
const treasury = async (owner, period='all', offset=0, limit=25) => (await result('SELECT rpc_kq_treasury_snapshot($1,$2,$3,$4) AS data',[owner,period,offset,limit])).data;
const savings = async (owner, action='state', amount=0, key=null) => (await result('SELECT rpc_arena_chanvrier_savings($1,$2,$3,$4) AS data',[owner,action,amount,key])).data;
const count = async owner => Number((await result('SELECT count(*) AS total FROM kq_treasury_journal WHERE user_id=$1',[owner])).total);
async function inspected(owner,{suspense=0,period='all',unclassified={transactions:suspense===0?0:1,netCents:suspense,absoluteCents:Math.abs(suspense)}}={}) {
  const data=await treasury(owner,period);
  assert(isKqTreasurySnapshot(data),'SQL snapshot satisfies the public TypeScript contract');
  const report=getKqTreasuryReport(data);
  assert.equal(report.balanceSheet.differenceCents,0,'every balance sheet remains balanced');
  if(period!=='previous') assert.equal(report.reconciled,true,'ledger agrees with every live physical source');
  assert.equal(report.suspenseCents,suspense,'standard financial sources leave no unidentified income');
  assert.deepEqual(data.unclassified,unclassified,'unclassified transactions remain visible independently of their net balance');
  const invalid=await result(`SELECT count(*) AS total FROM kq_treasury_journal j WHERE user_id=$1 AND (SELECT sum((line->>'deltaCents')::bigint) FROM jsonb_array_elements(postings) line)<>0`,[owner]);
  assert.equal(Number(invalid.total),0,'every transaction balances independently');
  return {data,report};
}
async function reward(owner,amount) {
  await db.transaction(async tx=>{
    await tx.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents+$2 WHERE user_id=$1',[owner,amount]);
    await tx.query('INSERT INTO kq_pioneer_pack_grants(user_id,cash_cents) VALUES($1,$2)',[owner,amount]);
  });
}
async function production(owner,{units=1200,energy=603}={}) {
  const run=randomUUID();
  await db.query(`INSERT INTO kq_runs(id,user_id,state,status) VALUES($1,$2,$3::jsonb,'active')`,[run,owner,JSON.stringify({energy:{version:1,totalCents:energy},harvestGrams:units/10})]);
  await db.query(`UPDATE kq_runs SET status='completed',completed_at=now() WHERE id=$1`,[run]);
  const stockId=await stock(owner,{units});
  await db.query('UPDATE kq_flowers SET run_id=$2 WHERE id=(SELECT flower_id FROM kq_commerce_stock WHERE id=$1)',[stockId,run]);
  return {run,stockId};
}
async function checkOpening(owner,historicalCash) {
  const {data,report}=await inspected(owner);
  assert.equal(report.cash.availableCents,historicalCash,'opening never charges or reconstructs historic cash');
  assert.equal(report.income.resultCents,0,'prior sales and costs never become current profit');
  assert.equal(data.journal.total,1,'one honest opening position replaces invented transaction history');
  assert.equal(data.journal.items[0].kind,'opening');
  assert.equal(data.openingBalances.cash,historicalCash,'opening enters balances before observed activity');
  assert.equal(data.openingBalances.stock,5103);
  assert.equal(data.openingBalances.lab_payable,-4500);
  assert.equal(data.openingBalances.energy_payable,-603);
  assert.equal(data.openingBalances.equipment,45000);
  assert.equal(data.openingBalances.website,100000);
  const previous=await inspected(owner,{period:'previous'});
  assert.equal(previous.data.journal.total,0);
  assert.equal(previous.data.series.length,0);
  assert.equal(previous.report.income.resultCents,0);
  console.log('PASS: prospective opening, no retroactive earnings or charges, honest unavailable history.');
}
async function checkSales(owner) {
  await openShop(owner);
  const stockId=await stock(owner);
  let total=0,vat=0;
  for(const channel of ['online','cbd-shop','wholesale']) {
    const offered=await quote(owner,stockId,channel,channel==='wholesale'?1200:100);
    assert(offered.offer.payoutCents>0,channel+' has eligible demand');
    const key=randomUUID(); await sell(owner,offered,key);
    const beforeCount=await count(owner);
    assert.equal((await sell(owner,offered,key)).replayed,true);
    assert.equal(await count(owner),beforeCount,'sale replay adds no journal entries');
    total+=offered.offer.payoutCents;vat+=offered.offer.vatCents;
    const {report}=await inspected(owner);
    assert.equal(report.income.salesHtCents,total-vat);
  }
  const before=await inspected(owner);
  const wallet=before.report.cash.availableCents;
  assert.equal(before.report.cash.reservedVatCents,vat);
  await db.query(`UPDATE kq_commerce_accounts SET vat_next_settlement_at=now()-interval '1 second' WHERE user_id=$1`,[owner]);
  const paid=await inspected(owner);
  assert.equal(paid.report.cash.availableCents,wallet,'VAT remittance spends its reserve, never wallet cash again');
  assert.equal(paid.report.cash.reservedVatCents,0);
  assert.equal(paid.report.income.salesHtCents,total-vat);
  const last=await quote(owner,stockId,'online',1);
  await db.query(`UPDATE kq_commerce_quotes SET expires_at=now()-interval '1 second' WHERE id=$1`,[last.id]);
  const entries=await count(owner);
  await assert.rejects(()=>sell(owner,last),/expired|changed/);
  assert.equal(await count(owner),entries,'failed sale rolls journal back together with cash');
  console.log('PASS: real sales in three channels, cumulative VAT reserve/remittance, replay and rollback.');
}
async function checkInvoicesAndStock(owner) {
  const {run,stockId}=await production(owner);
  let view=await inspected(owner);
  assert.equal(view.data.closingBalances.stock,5103,'stock is measured at traced production cost, never selling price');
  assert.equal(view.report.income.resultCents,0,'unsold production costs remain an asset');
  assert.equal(view.report.cash.unpaidCents,5103);
  const invoice=await result('SELECT id FROM kq_lab_invoices WHERE run_id=$1',[run]);
  const before=await cash(owner);
  await command(owner,'pay-lab',{invoiceId:invoice.id});
  await db.query('SELECT rpc_kq_pay_energy($1,$2,603)',[owner,randomUUID()]);
  view=await inspected(owner);
  assert.equal(view.report.cash.availableCents,before-5103);
  assert.equal(view.report.income.resultCents,0,'payment clears liabilities without charging the expense twice');
  const offered=await quote(owner,stockId,'wholesale',1200);
  await sell(owner,offered);
  view=await inspected(owner);
  assert.equal(view.data.closingBalances.stock,0,'sold product leaves stock');
  assert.equal(view.report.income.expenseCents,5103);
  assert.equal(view.report.income.resultCents,offered.offer.payoutCents-offered.offer.vatCents-5103);
  const debtRun=await complete(owner);
  view=await inspected(owner);
  assert.equal(view.report.income.expenseCents,9603,'a new unstocked lab invoice is accrued immediately');
  await db.query(`UPDATE kq_lab_invoices SET due_at=now()-interval '1 second' WHERE run_id=$1`,[debtRun]);
  const paid=await inspected(owner);
  assert.equal(paid.report.income.expenseCents,9603,'automatic due-date payment never repeats an expense');
  assert.equal(paid.report.cash.unpaidCents,0);
  console.log('PASS: real completion invoices, lab/energy payments, stock capitalization and cost upon sale.');
}
async function checkSavings(owner) {
  const before=await inspected(owner), key=randomUUID();
  await savings(owner,'deposit',10000,key);
  let view=await inspected(owner);
  assert.equal(view.report.cash.availableCents,before.report.cash.availableCents-10000);
  assert.equal(view.report.cash.savingsCents,10000);
  assert.equal(view.report.income.resultCents,0);
  const entries=await count(owner); await savings(owner,'deposit',10000,key);
  assert.equal(await count(owner),entries);
  await db.query(`UPDATE arena_chanvrier_savings_deposits SET credited_at=now()-interval '24 hours 1 second' WHERE user_id=$1`,[owner]);
  view=await inspected(owner);
  assert.equal(view.report.cash.savingsCents,10500);
  assert.equal(view.report.income.resultCents,500,'only interest is revenue');
  assert.equal(view.report.income.operatingResultCents,0);
  await savings(owner,'withdraw',3000,randomUUID());
  view=await inspected(owner);
  assert.equal(view.report.cash.savingsCents,7500);
  assert.equal(view.report.income.resultCents,500);
  console.log('PASS: savings transfers, actual interest settlement and idempotency.');
}
async function checkAssets(owner) {
  const original=await cash(owner);
  await openShop(owner);
  let view=await inspected(owner);
  assert.equal(view.report.cash.availableCents,original-145000);
  assert.equal(view.report.income.resultCents,0);
  assert.equal(view.data.closingBalances.equipment,45000);
  assert.equal(view.data.closingBalances.website,100000);
  await command(owner,'domiciliation',{mode:'external'});
  await command(owner,'advertise',{kind:'flyers'});
  view=await inspected(owner);
  assert.equal(view.data.closingBalances.prepaid,11000);
  assert.equal(view.report.income.resultCents,0,'services begin as prepaid expenses');
  // Advance only each asset's observed schedule; no timers or operating system clock changes.
  await db.query(`UPDATE kq_treasury_assets SET starts_at=starts_at-interval '12 hours',ends_at=ends_at-interval '12 hours',recognized_at=recognized_at-interval '12 hours' WHERE user_id=$1`,[owner]);
  view=await inspected(owner);
  assert(view.data.closingBalances.equipment<45000);
  assert(view.data.closingBalances.website<100000);
  assert.equal(view.data.closingBalances.prepaid,8700,'12h consumes 500 of domicile and 1800 of flyers');
  assert(view.report.income.expenseCents>2300,'depreciation and consumed services enter result');
  assert.equal(view.report.cash.availableCents,original-156000,'recognition never spends cash again');
  console.log('PASS: computer/site fixed assets, depreciation and service prepayments.');
}
async function checkUnknownAndRollback(owner) {
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents+321 WHERE user_id=$1',[owner]);
  const before=await inspected(owner,{suspense:-321});
  assert.equal(before.report.income.resultCents,0,'unidentified cash is never guessed to be revenue');
  const entries=await count(owner), wallet=await cash(owner);
  await assert.rejects(()=>db.transaction(async tx=>{
    await tx.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents-123 WHERE user_id=$1',[owner]);
    throw new Error('fixture rollback');
  }),/fixture rollback/);
  assert.equal(await cash(owner),wallet);assert.equal(await count(owner),entries);
  await assert.rejects(()=>db.query(`SELECT kq_treasury_post($1,'bad','bad',now(),'[{"account":"cash","deltaCents":1}]')`,[owner]),/unbalanced/);
  assert.equal(await count(owner),entries);
  console.log('PASS: explicit suspense, unbalanced-entry rejection and atomic rollback.');
}
async function checkPeriods(owner) {
  await reward(owner,1200);
  await db.query(`UPDATE kq_commerce_accounts SET business_started_at=now()-interval '121 hours' WHERE user_id=$1`,[owner]);
  await db.query(`UPDATE kq_treasury_accounts SET started_at=now()-interval '121 hours' WHERE user_id=$1`,[owner]);
  await db.query(`UPDATE kq_treasury_journal SET occurred_at=now()-interval '120 hours' WHERE user_id=$1`,[owner]);
  await complete(owner);
  const previous=await inspected(owner,{period:'previous'}), current=await inspected(owner,{period:'current'});
  assert.equal(previous.report.income.resultCents,1200);
  assert.equal(current.report.income.resultCents,-4500);
  assert.equal(current.report.balanceSheet.equity.find(line=>line.account==='retained_result').cents,1200);
  const all=await inspected(owner), first=await treasury(owner,'all',0,1), second=await treasury(owner,'all',1,1);
  assert.deepEqual(first.closingBalances,all.data.closingBalances);
  assert.deepEqual(second.openingBalances,all.data.openingBalances);
  assert.equal(first.journal.total,all.data.journal.total);
  assert.notEqual(first.journal.items[0].id,second.journal.items[0].id);
  assert.equal(first.series.at(-1).cashClosingCents,all.report.cash.availableCents);
  assert.deepEqual(getKqTreasuryReport(first),getKqTreasuryReport(second),'complete reports are independent of journal page');
  console.log('PASS: monthly carry-forward, complete aggregates, charts and independent journal pagination.');
}

async function checkFutureAccount() {
  const owner=randomUUID();
  await db.query('INSERT INTO auth.users VALUES($1)',[owner]);
  await state(owner);
  let view=await inspected(owner);
  assert.equal(view.report.cash.availableCents,35000);
  assert.equal(view.report.income.resultCents,0);
  const profile={nickname:'T'+owner.replaceAll('-','').slice(0,12),gender:'male',clothing:'teal',skin:'peach',strength:'treasurer'};
  await db.query('SELECT rpc_arena_save_chanvrier($1,$2::jsonb)',[owner,JSON.stringify(profile)]);
  view=await inspected(owner);
  assert.equal(view.report.cash.availableCents,100000);
  assert.equal(view.report.income.resultCents,0,'starting capital increases equity without invented revenue');
  assert.equal(view.data.closingBalances.capital,-65000);
  const entries=await count(owner);
  await db.query('SELECT rpc_arena_save_chanvrier($1,$2::jsonb)',[owner,JSON.stringify(profile)]);
  assert.equal(await count(owner),entries,'one-time capital cannot be replayed');
  await reward(owner,700);
  view=await inspected(owner);
  assert.equal(view.report.income.resultCents,700,'earned pioneer reward is revenue');
  console.log('PASS: future wallet opening, real treasurer capital grant and pioneer reward.');
}
async function checkEquipmentReceipts(owner) {
  const original=await cash(owner), code='FIXTURE-MACHINE';
  await db.query("INSERT INTO kq_equipment_catalog(code,category,slot,price_cents) VALUES($1,'processing','machine',40000)",[code]);
  // Receipt schema mirrors real migrations; no production purchase routine is stubbed.
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO kq_player_equipment(user_id,equipment_code,purchase_price_cents) VALUES($1,$2,40000)',[owner,code]);
    await tx.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents-40000 WHERE user_id=$1',[owner]);
    await tx.query('INSERT INTO kq_equipment_purchase_receipts(user_id,request_key,equipment_codes,total_price_cents,cash_after_cents) VALUES($1,$2,$3,40000,$4)',[owner,randomUUID(),[code],original-40000]);
  });
  let view=await inspected(owner);
  assert.equal(view.data.closingBalances.equipment,40000);assert.equal(view.report.income.resultCents,0);
  await db.transaction(async tx=>{
    await tx.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents-5000 WHERE user_id=$1',[owner]);
    await tx.query('UPDATE kq_player_equipment SET level=2,wear_cycles=10 WHERE user_id=$1 AND equipment_code=$2',[owner,code]);
    await tx.query('INSERT INTO kq_equipment_upgrade_receipts(user_id,request_key,equipment_code,previous_level,level,price_cents,cash_after_cents) VALUES($1,$2,$3,1,2,5000,$4)',[owner,randomUUID(),code,original-45000]);
  });
  view=await inspected(owner);assert.equal(view.data.closingBalances.equipment,45000);
  const repairKey=randomUUID();
  await db.query('SELECT rpc_kq_repair_machine($1,$2,0,2520,$3)',[owner,code,repairKey]);
  view=await inspected(owner);
  assert.equal(view.report.income.expenseCents,2520,'repair is a maintenance expense');
  const entries=await count(owner);
  await db.query('SELECT rpc_kq_repair_machine($1,$2,0,2520,$3)',[owner,code,repairKey]);
  assert.equal(await count(owner),entries);
  await db.transaction(async tx=>{
    await tx.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents-30000 WHERE user_id=$1',[owner]);
    await tx.query('INSERT INTO kq_culture_equipment_replacements(user_id,request_key,equipment_code,expected_version,receipt) VALUES($1,$2,$3,0,$4::jsonb)',[owner,randomUUID(),code,JSON.stringify({paidCents:30000})]);
  });
  view=await inspected(owner);
  assert.equal(view.data.closingBalances.equipment,30000,'replacement retires former equipment and upgrades');
  assert.equal(view.report.income.expenseCents,47520,'the retired carrying value is a disposal loss');
  assert.equal(view.report.cash.availableCents,original-77520);
  console.log('PASS: equipment purchase/upgrade/replacement receipts, disposal loss and real repair replay.');
}


async function checkOffsettingUnknowns(owner) {
  const original=await cash(owner);
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents+100 WHERE user_id=$1',[owner]);
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents-100 WHERE user_id=$1',[owner]);
  const unclassified={transactions:2,netCents:0,absoluteCents:200};
  let view=await inspected(owner,{unclassified});
  assert.equal(view.report.cash.availableCents,original);
  assert.equal(view.report.income.resultCents,0);
  assert.equal(view.report.suspenseCents,0,'a zero net balance does not conceal two unknown operations');
  await db.transaction(async tx=>{
    await tx.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents+50 WHERE user_id=$1',[owner]);
    await tx.query('UPDATE kq_equipment_wallets SET cash_cents=cash_cents-50 WHERE user_id=$1',[owner]);
  });
  view=await inspected(owner,{unclassified});
  assert.equal(view.data.unclassified.transactions,2,'counterparts within one atomic transaction are classified together');
  const page=await treasury(owner,'all',0,1);
  assert.deepEqual(page.unclassified,unclassified,'warning covers complete history independently of journal pagination');
  console.log('PASS: offsetting unknown transactions remain visible despite zero net suspense.');
}

async function checkPermissions(owner) {
  for(const role of ['anon','authenticated']) {
    const routines=await db.query(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (proname LIKE 'kq_treasury_%' OR proname='rpc_kq_treasury_snapshot') AND has_function_privilege($1,p.oid,'EXECUTE')`,[role]);
    assert.deepEqual(routines.rows,[]);
  }
  const tables=(await db.query(`SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('kq_treasury_accounts','kq_treasury_journal','kq_treasury_balances','kq_treasury_assets','kq_treasury_pending')`)).rows;
  assert.equal(tables.length,5);assert(tables.every(table=>table.relrowsecurity));
  for(const table of tables) assert.equal((await result('SELECT has_table_privilege($1,$2,$3) AS allowed',['service_role',table.relname,'INSERT,UPDATE,DELETE'])).allowed,false);
  for(const args of [['invalid',0,25],['all',-1,25],['all',0,101]]) await assert.rejects(()=>treasury(owner,...args),/invalid_request/);
  await db.exec('SET ROLE authenticated');
  try { await assert.rejects(()=>treasury(owner),/permission denied/); } finally { await db.exec('RESET ROLE'); }
  console.log('PASS: private write helpers, RLS, service read-only tables and validated RPC arguments.');
}
try {
  await bootstrap();await extendSchema();
  await db.exec(await migration('20260921000100_kq_business_calendar.sql'));
  const owners={};
  for(const name of ['opening','sales','invoices','savings','assets','unknown','periods','equipment','offsetting']) owners[name]=await player({strength:name==='savings'?'treasurer':null});
  await openShop(owners.opening);await production(owners.opening);
  const historicalCash=await cash(owners.opening);
  await db.exec(await migration('20260921000200_kq_treasury_accounting.sql'));
  ({quoteKqCommerce}=await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts'));
  ({previewKqBusinessPayment}=await vite.ssrLoadModule('/src/lib/kanab-quest-business.ts'));
  ({getKqTreasuryReport,isKqTreasurySnapshot}=await vite.ssrLoadModule('/src/lib/kanab-quest-treasury.ts'));
  await checkOpening(owners.opening,historicalCash);
  await checkSales(owners.sales);
  await checkInvoicesAndStock(owners.invoices);
  await checkSavings(owners.savings);
  await checkAssets(owners.assets);
  await checkEquipmentReceipts(owners.equipment);
  await checkFutureAccount();
  await checkUnknownAndRollback(owners.unknown);
  await checkOffsettingUnknowns(owners.offsetting);
  await checkPeriods(owners.periods);
  await checkPermissions(owners.opening);
  console.log('PASS: isolated treasury accounting integration with real economy migrations.');
} catch(error) {console.error(error.stack??error.message,error.where??'');process.exitCode=1;}
finally {await vite.close();await db.close();}
