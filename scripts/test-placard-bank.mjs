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

const cash = async (owner) => (await result("SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1", [owner])).cash_cents;


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

const bank = async (owner, command = null) => (await result('SELECT rpc_kq_bank($1,$2::jsonb) AS data', [owner, command ? JSON.stringify(command) : null])).data;
const borrow = (view, amountCents = 10000, requestKey = randomUUID()) => ({ action: 'borrow', requestKey, quoteId: view.market.id, amountCents, expectedRateBps: view.offer?.rateBps ?? view.market.rateBps });
async function experienced(reputation = 200, balance = 1000000) {
  const owner = await player({ balance });
  await db.query("SELECT kq_treasury_pair($1,'capital','fixture-capital',now(),'suspense','capital',-balance_cents) FROM kq_treasury_balances WHERE user_id=$1 AND account='suspense'", [owner]);
  await db.query("UPDATE kq_runs SET completed_at=now()-interval '2 days' WHERE user_id=$1", [owner]);
  await db.query('UPDATE kq_equipment_wallets SET reputation=$2 WHERE user_id=$1', [owner, reputation]);
  return owner;
}
async function checked(owner) {
  const view = await bank(owner);
  assert(isKqBankSnapshot(view), 'bank returns the complete validated public contract');
  const entries = (await db.query('SELECT account,balance_cents FROM kq_treasury_balances WHERE user_id=$1', [owner])).rows;
  const balances = Object.fromEntries(entries.map(row => [row.account, Number(row.balance_cents)]));
  assert.equal(Object.values(balances).reduce((a, b) => a + b, 0), 0, 'double-entry balances remain balanced');
  assert.equal(balances.cash, await cash(owner));
  assert.equal(balances.suspense ?? 0, 0, 'loan and cash movements match without suspense');
  assert.equal(Math.abs(balances.loan_payable ?? 0), view.loan?.remainingCents ?? 0);
  return view;
}
let isKqBankSnapshot, KQ_BANK_TIERS, KQ_BANK_MAX_CENTS, KQ_BANK_MAX_RATE_BPS, KQ_BANK_MAX_REPAYMENT_CENTS, getKqBankTerms;
try {
  await bootstrap(); await extendSchema();
  await db.exec(await migration('20260921000100_kq_business_calendar.sql'));
  await db.exec(await migration('20260921000200_kq_treasury_accounting.sql'));
  await db.exec(await migration('20260923000300_kq_bank_loans.sql'));
  ({ isKqBankSnapshot, KQ_BANK_TIERS, KQ_BANK_MAX_CENTS, KQ_BANK_MAX_RATE_BPS, KQ_BANK_MAX_REPAYMENT_CENTS, getKqBankTerms } = await vite.ssrLoadModule('/src/lib/kanab-quest-bank.ts'));
  const legacyOwner=await experienced(600), legacyOffer=await bank(legacyOwner);
  const legacyCommand=borrow(legacyOffer,12345), legacyBefore=await bank(legacyOwner,legacyCommand);
  await db.exec(await migration('20260923000700_kq_bank_investment_limits.sql'));
  const legacyAfter=await bank(legacyOwner);
  assert.deepEqual(legacyAfter.loan,legacyBefore.loan,'raising new lending limits never rewrites a signed small loan');
  assert.equal(legacyAfter.cashCents,legacyBefore.cashCents);
  const legacyReplay=await bank(legacyOwner,legacyCommand);
  assert.equal(legacyReplay.replayed,true);
  assert.deepEqual(legacyReplay.loan,legacyBefore.loan);
  console.log('PASS: existing small loan, fixed interest, seven instalments and request receipt survive the limit migration unchanged.');

  const partialOwner=await experienced(600), partialCommand=borrow(await bank(partialOwner),12345);
  let partialBefore=await bank(partialOwner,partialCommand);
  await db.query("UPDATE kq_bank_loans SET accepted_at=now()-interval '49 hours' WHERE user_id=$1",[partialOwner]);
  partialBefore=await bank(partialOwner);
  assert.equal(partialBefore.loan.paidCents,Math.floor(partialBefore.loan.totalCents*2/7));
  const closedOwner=await experienced(), closedCommand=borrow(await bank(closedOwner));
  const closedLoan=(await bank(closedOwner,closedCommand)).loan;
  const closedBefore=await bank(closedOwner,{action:'repay',requestKey:randomUUID(),loanId:closedLoan.id,amountCents:closedLoan.totalCents});
  const migrationState=async()=> (await db.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.user_id,row.request_key) FROM kq_bank_requests row) AS requests,
    (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.user_id) FROM kq_equipment_wallets row) AS wallets,
    (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.user_id,row.account) FROM kq_treasury_balances row) AS balances,
    (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id) FROM kq_treasury_journal row) AS journal,
    (SELECT jsonb_agg(to_jsonb(row)-'installment_hours' ORDER BY row.id) FROM kq_bank_loans row) AS loans`)).rows[0];
  const beforeMigration=await migrationState();
  await db.exec(await migration('20260924000100_kq_bank_monthly_installments.sql'));
  assert.deepEqual(await migrationState(),beforeMigration,'rescheduling never changes signed amounts, paid cents, cash, accounting or request receipts');
  for(const [migratedOwner,before] of [[legacyOwner,legacyBefore],[partialOwner,partialBefore]]) {
    const after=await checked(migratedOwner);
    assert.equal(after.cashCents,before.cashCents);
    const immutable=loan=>({...loan,dueAt:undefined,schedule:loan.schedule.map(item=>({...item,at:undefined}))});
    assert.deepEqual(immutable(after.loan),immutable(before.loan));
    assert.equal(Date.parse(after.loan.dueAt)-Date.parse(after.loan.acceptedAt),35*86400000);
    assert(after.loan.schedule.every((item,i)=>Date.parse(item.at)-Date.parse(after.loan.acceptedAt)===(i+1)*120*3600000));
    assert.equal((await result('SELECT installment_hours FROM kq_bank_loans WHERE user_id=$1',[migratedOwner])).installment_hours,120);
  }
  const closedAfter=await checked(closedOwner);
  assert.deepEqual(closedAfter.history,closedBefore.history,'paid loan history retains its original seven daily dates');
  assert.equal(closedAfter.offer.termDays,35);
  assert.equal((await result('SELECT installment_hours FROM kq_bank_loans WHERE user_id=$1',[closedOwner])).installment_hours,24);
  assert.equal((await bank(partialOwner,partialCommand)).replayed,true);
  assert.equal((await bank(partialOwner)).cashCents,partialBefore.cashCents,'replaying a rescheduled loan never credits its capital twice');
  console.log('PASS: monthly migration reschedules open loans, preserves prior payments, closed history, cash, accounting and request receipts.');

  const fresh = await player();
  const noRep = await experienced(199);
  assert.equal((await bank(fresh)).blockedReason, 'experience');
  assert.equal((await bank(noRep)).blockedReason, 'reputation');

  const freshView = await bank(fresh);
  await assert.rejects(() => bank(fresh, borrow(freshView)), /bank_experience/);
  await assert.rejects(() => bank(noRep, borrow(freshView)), /bank_reputation/);
  const novice = await player({ completed: false });
  assert.equal((await bank(novice)).blockedReason, 'experience');
  console.log('PASS: server reputation and first completed-culture age gate.');

  for (const [index,tier] of KQ_BANK_TIERS.entries()) {
    const {reputation:rep,maxCents:cap,discountBps:discount}=tier;
    const owner = await experienced(rep); const view = await checked(owner);
    assert.equal(view.offer.maxCents, cap);
    assert.equal(view.offer.rateBps, Math.max(100, view.market.rateBps - discount));
    for (const amount of [9999, cap + 1, 1.2, 2147483647, -1]) await assert.rejects(() => bank(owner, borrow(view, amount)), /bank_invalid/);
    assert.equal((await bank(owner)).loan, null);
    const beforeTier=await bank(await experienced(rep-1));
    if(index===0) assert.equal(beforeTier.offer,null);
    else assert.equal(beforeTier.offer.maxCents,KQ_BANK_TIERS[index-1].maxCents,'server keeps the preceding ceiling one reputation point below the next gate');
  }
  const rich = await experienced(3000, 2147483000), richView = await bank(rich);
  await assert.rejects(() => bank(rich, borrow(richView)), /bank_wallet_limit/);
  assert.equal(await cash(rich), 2147483000);
  console.log('PASS: SQL offers match TypeScript tiers, reputation boundaries, rate discounts and integer overflow guards.');

  const highOwner=await experienced(KQ_BANK_TIERS.at(-1).reputation,KQ_BANK_MAX_REPAYMENT_CENTS-KQ_BANK_MAX_CENTS+1_000_000);
  let highView=await bank(highOwner);
  await db.query('UPDATE kq_bank_markets SET rate_bps=$2 WHERE id=$1',[highView.market.id,KQ_BANK_MAX_RATE_BPS]);
  highView=await checked(highOwner);
  assert.equal(highView.offer.maxCents,KQ_BANK_MAX_CENTS);
  assert.equal(highView.offer.rateBps,KQ_BANK_MAX_RATE_BPS-KQ_BANK_TIERS.at(-1).discountBps);
  const highInitial=highView.cashCents, highCommand=borrow(highView,KQ_BANK_MAX_CENTS);
  await assert.rejects(()=>bank(highOwner,borrow(highView,KQ_BANK_MAX_CENTS+1)),/bank_invalid/);
  await assert.rejects(()=>bank(highOwner,borrow(highView,KQ_BANK_MAX_REPAYMENT_CENTS+1)),/bank_invalid/);
  highView=await bank(highOwner,highCommand);
  const highTerms=getKqBankTerms(KQ_BANK_MAX_CENTS,highCommand.expectedRateBps);
  assert.equal(highView.loan.interestCents,highTerms.interestCents);
  assert.equal(highView.loan.totalCents,highTerms.totalCents);
  assert(highView.loan.totalCents<=KQ_BANK_MAX_REPAYMENT_CENTS);
  assert.deepEqual(highView.loan.schedule.map(item=>item.amountCents),highTerms.installments);
  assert.equal(highView.cashCents,highInitial+KQ_BANK_MAX_CENTS);
  await checked(highOwner);
  assert.equal((await bank(highOwner,highCommand)).replayed,true);
  const highRepayment={action:'repay',requestKey:randomUUID(),loanId:highView.loan.id,amountCents:highView.loan.totalCents};
  const highPaid=await bank(highOwner,highRepayment);
  assert.equal(highPaid.loan,null);
  assert.equal(highPaid.cashCents,highInitial-highTerms.interestCents);
  assert.equal(highPaid.history[0].paidCents,highTerms.totalCents);
  assert.equal((await bank(highOwner,highRepayment)).replayed,true);
  await checked(highOwner);
  console.log('PASS: maximum investment loan at the highest market rate, exact instalments, large early repayment and replay preserve wallet/accounting.');

  const owner = await experienced(600);
  let view = await checked(owner);
  const initialCash = await cash(owner), command = borrow(view, 12345);
  await assert.rejects(() => bank(owner, { ...command, quoteId: randomUUID() }), /bank_quote_changed/);
  await assert.rejects(() => bank(owner, { ...command, expectedRateBps: command.expectedRateBps + 1 }), /bank_quote_changed/);
  view = await bank(owner, command);
  assert.equal(Date.parse(view.loan.dueAt)-Date.parse(view.loan.acceptedAt),35*86400000);
  assert(view.loan.schedule.every((item,i)=>Date.parse(item.at)-Date.parse(view.loan.acceptedAt)===(i+1)*120*3600000));
  assert.equal(view.cashCents, initialCash + 12345);
  assert.equal(view.loan.interestCents, Math.ceil(12345 * command.expectedRateBps / 10000));
  assert.equal(view.loan.schedule.reduce((sum, item) => sum + item.amountCents, 0), view.loan.totalCents);
  const journalCount = Number((await result('SELECT count(*) AS n FROM kq_treasury_journal WHERE user_id=$1', [owner])).n);
  const replay = await bank(owner, command);
  assert.equal(replay.replayed, true); assert.equal(replay.cashCents, view.cashCents);
  assert.equal(Number((await result('SELECT count(*) AS n FROM kq_treasury_journal WHERE user_id=$1', [owner])).n), journalCount);
  await assert.rejects(() => bank(owner, { ...command, amountCents: 15000 }), /bank_request_mismatch/);
  await assert.rejects(() => bank(owner, { ...command, requestKey: randomUUID() }), /bank_active/);
  await checked(owner);
  console.log('PASS: offer validation, atomic cash + loan + accounting, request replay and mismatched key.');

  const parallelOwner = await experienced(3000), parallelView = await bank(parallelOwner);
  const commands = [borrow(parallelView), borrow(parallelView)];
  // PGlite serializes its transport: these overlapping promises exercise replay /
  // uniqueness, while production PostgreSQL also enforces the wallet row lock.
  const parallel = await Promise.allSettled(commands.map(command => bank(parallelOwner, command)));
  assert.equal(parallel.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal((await bank(parallelOwner)).cashCents, 1010000);
  const sameOwner = await experienced(), sameCommand = borrow(await bank(sameOwner));
  const same = await Promise.all([bank(sameOwner, sameCommand), bank(sameOwner, sameCommand)]);
  assert.equal(same.filter(item => item.replayed).length, 1);
  assert.equal((await bank(sameOwner)).cashCents, 1010000);
  console.log('PASS: overlapping distinct and identical borrow requests cannot duplicate credit.');

  const marketId = view.market.id, signedRate = view.loan.rateBps;
  assert.equal((await bank(await experienced())).market.id, marketId);
  for (let i = 0; i < 5; i++) assert.equal((await bank(owner)).market.id, marketId);
  await db.query('UPDATE kq_bank_markets SET rate_bps=CASE WHEN rate_bps<1200 THEN rate_bps+100 ELSE rate_bps-100 END WHERE id=$1', [marketId]);
  assert.equal((await bank(owner)).loan.rateBps, signedRate);
  const outdatedOwner = await experienced(), outdated = await bank(outdatedOwner);
  await db.exec("UPDATE kq_bank_markets SET period=period-1,starts_at=starts_at-interval '1 day',expires_at=expires_at-interval '1 day'");
  await assert.rejects(() => bank(outdatedOwner, borrow(outdated)), /bank_quote_changed/);
  const today = await bank(outdatedOwner);
  assert.notEqual(today.market.id, outdated.market.id);
  assert.equal((await bank(owner)).market.id, today.market.id);
  console.log('PASS: shared stable daily scenario, expired quote rejected, signed debt never repriced.');

  const loanId = view.loan.id;
  // A transaction pins now() so exact boundary checks do not depend on execution speed.
  for(const [age,installments] of [['119 hours 59 minutes 59 seconds',0],['120 hours',1],['240 hours',2]]) {
    await db.exec('BEGIN');
    try {
      await db.query('UPDATE kq_bank_loans SET accepted_at=now()-$2::interval WHERE id=$1',[loanId,age]);
      await state(owner);
      const boundary=await checked(owner);
      assert.equal(boundary.loan.paidCents,Math.floor(boundary.loan.totalCents*installments/7),`exact ${age} settlement`);
      assert.equal(boundary.loan.overdueCents,0);
      assert.equal(boundary.cashCents,initialCash+12345-boundary.loan.paidCents);
      assert.equal(boundary.autoPaidCents,0);
      const count=Number((await result('SELECT count(*) AS n FROM kq_treasury_journal WHERE user_id=$1',[owner])).n);
      await state(owner); await bank(owner);
      assert.equal(Number((await result('SELECT count(*) AS n FROM kq_treasury_journal WHERE user_id=$1',[owner])).n),count,'repeated gameplay and bank reads never collect a due instalment twice');
    } finally { await db.exec('COMMIT'); }
  }
  console.log('PASS: no debit before 30 game days, exact first and second boundaries, and idempotent gameplay settlement.');
  await db.query("UPDATE kq_bank_loans SET accepted_at=now()-interval '361 hours' WHERE id=$1", [loanId]);
  await state(owner); // real commerce -> business_settle -> bank hook
  view = await checked(owner);
  assert.equal(view.loan.paidCents, Math.floor(view.loan.totalCents * 3 / 7));
  assert.equal(view.cashCents, initialCash + 12345 - view.loan.paidCents);
  assert.equal(view.autoPaidCents, 0, 'commerce already caught up; bank cannot collect twice');
  const repayment = { action: 'repay', loanId, amountCents: view.loan.remainingCents, requestKey: randomUUID() };
  await assert.rejects(() => bank(fresh, repayment), /bank_repayment_changed/);
  await assert.rejects(() => bank(owner, { ...repayment, amountCents: repayment.amountCents + 1 }), /bank_repayment_changed/);
  const paid = await bank(owner, repayment);
  assert.equal(paid.loan, null); assert.equal(paid.history[0].paidCents, paid.history[0].totalCents);
  assert.equal((await bank(owner, repayment)).replayed, true);
  await checked(owner);
  console.log('PASS: calendar repayments run outside bank, stable totals and ownership-safe early repayment.');

  const broke = await experienced(200, 0); let brokeView = await bank(broke);
  brokeView = await bank(broke, borrow(brokeView));
  // Spend through a classified game transaction, then advance the test clock.
  await db.query("SELECT kq_treasury_pair($1,'test-expense','test-spend',now(),'expense_other','suspense',10000)", [broke]);
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=0 WHERE user_id=$1', [broke]);
  await db.query("UPDATE kq_bank_loans SET accepted_at=now()-interval '36 days' WHERE user_id=$1", [broke]);
  brokeView = await checked(broke);
  assert.equal(brokeView.blockedReason, 'arrears'); assert.equal(brokeView.loan.overdueCents, brokeView.loan.totalCents);
  await assert.rejects(() => bank(broke, borrow(today)), /bank_active/);
  const missingCash = { action: 'repay', requestKey: randomUUID(), loanId: brokeView.loan.id, amountCents: brokeView.loan.remainingCents };
  await assert.rejects(() => bank(broke, missingCash), /bank_cash/);
  assert.equal((await bank(broke)).loan.paidCents, 0);
  await db.query("SELECT kq_treasury_pair($1,'capital','test-funds',now(),'suspense','capital',123)", [broke]);
  await db.query('UPDATE kq_equipment_wallets SET cash_cents=123 WHERE user_id=$1', [broke]);
  await state(broke);
  brokeView = await checked(broke);
  assert.equal(brokeView.cashCents, 0); assert.equal(brokeView.loan.paidCents, 123);
  assert.equal(brokeView.loan.remainingCents, brokeView.loan.totalCents - 123);
  console.log('PASS: arrears, insufficient balance, partial automatic collection, no negative cash or extra interest.');

  await db.exec("SET TIME ZONE 'Europe/Paris'");
  try {
    for(const acceptedAt of ['2026-03-27T12:00:00+01:00','2026-10-23T12:00:00+02:00']) {
      await db.query('UPDATE kq_bank_loans SET accepted_at=$2::timestamptz WHERE id=$1',[loanId,acceptedAt]);
      const schedule=(await result('SELECT kq_bank_loan_json(loan) AS data FROM kq_bank_loans loan WHERE id=$1',[loanId])).data;
      assert(schedule.schedule.every((item,i)=>Date.parse(item.at)-Date.parse(acceptedAt)===(i+1)*120*3600000),'daylight saving never changes the 120-hour instalment interval');
      assert.equal(Date.parse(schedule.dueAt)-Date.parse(acceptedAt),35*86400000);
    }
  } finally { await db.exec("SET TIME ZONE 'UTC'"); }
  console.log('PASS: every instalment remains 120 real hours apart across both daylight-saving transitions.');

  for (const role of ['anon', 'authenticated', 'service_role']) for (const table of ['kq_bank_markets', 'kq_bank_loans', 'kq_bank_requests']) {
    assert.equal((await result('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, table, 'SELECT,INSERT,UPDATE,DELETE'])).allowed, false);
  }
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await result("SELECT has_function_privilege($1,'rpc_kq_bank(uuid,jsonb)','EXECUTE') AS allowed", [role])).allowed, false);
  }
  assert.equal((await result("SELECT has_function_privilege('service_role','rpc_kq_bank(uuid,jsonb)','EXECUTE') AS allowed")).allowed, true);
  console.log('PASS: private bank tables and helpers; only the service RPC is exposed.');
  console.log('PASS: isolated bank integration against real business and treasury migrations.');
} catch (error) { console.error(error.stack ?? error.message, error.where ?? ''); process.exitCode = 1; }
finally { await vite.close(); await db.close(); }
