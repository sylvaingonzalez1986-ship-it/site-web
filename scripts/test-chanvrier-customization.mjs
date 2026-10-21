// In-memory PostgreSQL only. No .env, Supabase client or network connection.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PGlite } from "@electric-sql/pglite";

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
  await db.exec(`
    ALTER TABLE kq_equipment_wallets ALTER COLUMN cash_cents SET DEFAULT 35000;
    CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY, pseudo TEXT UNIQUE,updated_at TIMESTAMPTZ DEFAULT now());
    CREATE FUNCTION rpc_kq_start_run_with_heritage(p_user_id UUID,p_buddie TEXT,p_seed INTEGER,p_deck TEXT[],p_scenario TEXT[],p_state JSONB,p_heritage INTEGER,p_card TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
    DECLARE v_expected_xp INTEGER; v_base_xp INTEGER:=1; v_buddie_xp INTEGER:=4; v_heritage_xp INTEGER:=0;
    BEGIN
     v_expected_xp := v_base_xp + v_buddie_xp + v_heritage_xp;
     IF v_buddie_xp > 0 OR v_heritage_xp > 0 THEN RETURN jsonb_build_object('xp',v_expected_xp); END IF;
     RETURN '{}';
    END $$;
  `);
  for (const name of [
    '20260914000100_arena_chanvrier_profiles.sql',
    '20260914000300_chanvrier_treasurer_starting_capital.sql',
    '20260914000400_chanvrier_green_thumb_xp.sql',
    '20260915000300_kq_realtime_commerce_demand.sql',
  ]) await db.exec(await migration(name));
  const save = async (user, profile) => (await db.query('SELECT rpc_arena_save_chanvrier($1,$2) AS data',[user,JSON.stringify(profile)])).rows[0].data;
  const savings = async (user,action='state',amount=0,key=null) => (await db.query('SELECT rpc_arena_chanvrier_savings($1,$2,$3,$4) AS data',[user,action,amount,key])).rows[0].data;
  const profile = { nickname:'Treasury',gender:'male',clothing:'teal',skin:'peach',strength:'treasurer' };
  const legacy=randomUUID(), treasury=randomUUID(), grower=randomUUID(), merchant=randomUUID();
  await db.query('INSERT INTO auth.users VALUES($1),($2),($3),($4)',[legacy,treasury,grower,merchant]);
  await save(legacy,{...profile,nickname:'Legacy'});
  for(const name of ['20260919000100_chanvrier_customization_and_benefits.sql','20260919000200_chanvrier_savings.sql']) await db.exec(await migration(name));
  assert.equal((await savings(legacy)).cashCents,200000,'legacy grants preserved');
  const created=await save(treasury,profile);
  assert.equal(created.startingBonusCents,65000);
  assert.equal((await savings(treasury)).cashCents,100000);
  const { CHANVRIER_APPEARANCE_OPTIONS, getChanvrierAppearance } = await vite.ssrLoadModule('/src/lib/arena-chanvrier.ts');
  const appearance=getChanvrierAppearance({gender:'male'});
  for(const [key,choices] of Object.entries(CHANVRIER_APPEARANCE_OPTIONS)) for(const choice of choices){
    const saved=await save(treasury,{...profile,appearance:{...appearance,[key]:choice.code}});
    assert.deepEqual(saved.profile.appearance,{...appearance,[key]:choice.code});
    assert.equal(saved.startingBonusCents,0);
  }
  await assert.rejects(()=>save(treasury,{...profile,appearance:{hair:'injected'}}),/check constraint/);
  await assert.rejects(()=>save(treasury,{...profile,strength:'merchant'}),/chanvrier_strength_locked/);
  await save(grower,{...profile,nickname:'Grower',strength:'green-thumb'});
  await save(merchant,{...profile,nickname:'Merchant',strength:'merchant'});
  const xp=(await db.query("SELECT rpc_kq_start_run_with_heritage($1,'',1,'{}','{}','{}',0,NULL) AS data",[grower])).rows[0].data;
  assert.equal(xp.xp,7,'1 base + 4 Buddie + 2 green thumb');
  await assert.rejects(()=>savings(grower),/savings_treasurer_required/);
  const key=randomUUID();
  assert.equal((await savings(treasury,'deposit',20000,key)).balanceCents,20000);
  assert.equal((await savings(treasury,'deposit',20000,key)).cashCents,80000,'replay cannot debit twice');
  await assert.rejects(()=>savings(treasury,'withdraw',20000,key),/savings_request_mismatch/);
  assert.equal((await savings(treasury)).balanceCents,20000,'no interest before 24h');
  await db.query("UPDATE arena_chanvrier_savings_deposits SET credited_at=now()-interval '23 hours 59 minutes' WHERE user_id=$1",[treasury]);
  assert.equal((await savings(treasury)).balanceCents,20000,'no rounding up partial days');
  await db.query("UPDATE arena_chanvrier_savings_deposits SET credited_at=now()-interval '48 hours' WHERE user_id=$1",[treasury]);
  assert.equal((await savings(treasury)).balanceCents,22050,'two compounded days at 5%');
  assert.equal((await savings(treasury)).balanceCents,22050,'read cannot credit again');
  await savings(treasury,'deposit',10000,randomUUID());
  assert.equal((await savings(treasury)).balanceCents,32050,'new deposits do not get retroactive interest');
  await assert.rejects(()=>savings(treasury,'deposit',100001,randomUUID()),/savings_cash/);
  await assert.rejects(()=>savings(treasury,'withdraw',50000,randomUUID()),/savings_balance/);
  await assert.rejects(()=>savings(treasury,'deposit',-1,randomUUID()),/savings_invalid/);
  const withdrawn=await savings(treasury,'withdraw',5000,randomUUID());
  assert.equal(withdrawn.cashCents,75000);assert.equal(withdrawn.balanceCents,27050);
  assert.equal((await db.query('SELECT balance_cents FROM arena_chanvrier_savings_deposits WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[treasury])).rows[0].balance_cents,5000,'withdraw from newest deposit first');
  const retry=randomUUID();
  await Promise.all([savings(treasury,'deposit',1000,retry),savings(treasury,'deposit',1000,retry)]);
  assert.equal((await savings(treasury)).cashCents,74000,'concurrent duplicate has one debit');
  await db.query("UPDATE arena_chanvrier_savings_deposits SET credited_at=now()-interval '1000 days' WHERE user_id=$1",[treasury]);
  assert.equal((await savings(treasury)).balanceCents,2000000000,'bounded compounding cannot overflow');
  await assert.rejects(()=>savings(treasury,'deposit',1,randomUUID()),/savings_limit/);
  const privileges=(await db.query("SELECT has_function_privilege('authenticated','rpc_arena_chanvrier_savings(uuid,text,integer,uuid)','EXECUTE') AS rpc,has_table_privilege('authenticated','arena_chanvrier_savings_deposits','UPDATE') AS writes")).rows[0];
  assert.equal(privileges.rpc,false);assert.equal(privileges.writes,false);

  // Exercise authoritative capacity and real SQL sales against the TypeScript offer.
  const { quoteKqCommerce }=await vite.ssrLoadModule('/src/lib/kanab-quest-commerce.ts');
  const run=randomUUID(),flower=randomUUID(),stock=randomUUID();
  await db.query("UPDATE kq_equipment_wallets SET reputation=200 WHERE user_id=$1",[merchant]);
  await db.query("INSERT INTO kq_runs(id,user_id,status,state,completed_at) VALUES($1,$2,'completed','{}',now())",[run,merchant]);
  await db.query('SELECT rpc_kq_commerce_state($1)',[merchant]);
  await db.query("UPDATE kq_commerce_campaigns SET event='normal' WHERE run_id=$1",[run]);
  const capacity=(await db.query('SELECT kq_commerce_capacity($1) AS data',[merchant])).rows[0].data;
  assert.equal(capacity.online,1350);assert.equal(capacity['cbd-shop'],6000);
  await db.query("INSERT INTO kq_flowers(id,owner_id,status) VALUES($1,$2,'burned')",[flower,merchant]);
  await db.query("INSERT INTO kq_market_lots(flower_id,owner_id,harvest_grams,jury_score,quality_band,options,status,selected_route) VALUES($1,$2,500,9,'signature','[]','stocked','raw')",[flower,merchant]);
  await db.query("INSERT INTO kq_commerce_batches(flower_id,user_id,route,original_units,processing_cents) VALUES($1,$2,'raw',10000,0)",[flower,merchant]);
  await db.query("INSERT INTO kq_commerce_stock(id,flower_id,user_id,route,initial_units,remaining_units,equivalent_units,base_unit_cents) VALUES($1,$2,$3,'raw',10000,10000,10000,180)",[stock,flower,merchant]);
  const current=(await db.query('SELECT rpc_kq_commerce_state($1) AS data',[merchant])).rows[0].data;
  const offer=quoteKqCommerce(current,current.stocks[0],'cbd-shop','advised',1000);
  const normal=quoteKqCommerce({...current,strength:null},current.stocks[0],'cbd-shop','advised',1000);
  assert.equal(offer.payoutCents,normal.payoutCents*1.5);
  assert.equal(offer.maxUnits,normal.maxUnits*1.5);
  const quote=randomUUID();
  await db.query("INSERT INTO kq_commerce_quotes(id,user_id,stock_id,account_revision,campaign_id,campaign_revision,stock_units,reputation,offer,expires_at) VALUES($1,$2,$3,$4,$5,$6,10000,$7,$8,now()+interval '10 minutes')",[quote,merchant,stock,current.revision,run,current.campaign.revision,current.reputation,JSON.stringify(offer)]);
  await db.query("SELECT rpc_kq_commerce_command($1,'sell',$2,$3)",[merchant,JSON.stringify({quoteId:quote,expectedPayoutCents:offer.payoutCents}),randomUUID()]);
  const after=(await db.query('SELECT rpc_kq_commerce_state($1) AS data',[merchant])).rows[0].data;
  assert.equal(after.cashCents,current.cashCents+offer.payoutCents);
  assert.equal(after.shopRecruitment,offer.shopRecruitmentAfter);

  // Replace the fixture-only wallet initializer with its actual production RPC
  // and the current building-service patch before checking the new default.
  await db.exec(`
    ALTER TABLE kq_equipment_wallets ADD COLUMN production_units INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN equipment_scope_version INTEGER NOT NULL DEFAULT 3;
    CREATE TABLE kq_player_equipment(user_id UUID,tent_number INTEGER,equipment_code TEXT,purchase_price_cents INTEGER,
      PRIMARY KEY(user_id,tent_number,equipment_code));
    ALTER TABLE kq_equipment_loadouts ADD COLUMN tent_number INTEGER NOT NULL DEFAULT 1,ADD COLUMN slot TEXT,
      ADD UNIQUE(user_id,tent_number,slot);
    DROP FUNCTION public.rpc_kq_ensure_equipment_profile(UUID);
  `);
  const equipmentSql=await migration('20261001000200_kq_tent_equipment_and_shared_workshop.sql');
  const initializerStart=equipmentSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_kq_ensure_equipment_profile(');
  assert(initializerStart>=0,'production initializer exists');
  await db.exec(equipmentSql.slice(initializerStart,equipmentSql.indexOf('END $$;',initializerStart)+7));
  const buildingSql=await migration('20261011130000_kq_building_services.sql');
  await db.exec(buildingSql.slice(buildingSql.indexOf('CREATE TABLE public.kq_building_service_archive'),
    buildingSql.indexOf('CREATE TABLE public.kq_building_service_conversions')));
  const conversionStart=buildingSql.indexOf('CREATE FUNCTION public.kq_migrate_building_services(');
  await db.exec(buildingSql.slice(conversionStart,buildingSql.indexOf('END $$;',conversionStart)+7));
  const initializerPatchStart=buildingSql.indexOf('DO $$ DECLARE body TEXT; signature TEXT; BEGIN');
  const initializerPatchEnd=buildingSql.indexOf(' EXECUTE body;',initializerPatchStart)+' EXECUTE body;'.length;
  assert(initializerPatchStart>=0 && initializerPatchEnd>initializerPatchStart,'production initializer patch exists');
  await db.exec(buildingSql.slice(initializerPatchStart,initializerPatchEnd)+'\nEND $$;');
  await db.exec(`
    REVOKE ALL ON FUNCTION public.rpc_kq_ensure_equipment_profile(UUID) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.rpc_kq_ensure_equipment_profile(UUID) TO service_role;
    REVOKE ALL ON TABLE public.kq_equipment_wallets FROM PUBLIC,anon,authenticated,service_role;
    GRANT SELECT ON TABLE public.kq_equipment_wallets TO service_role;
  `);
  const ensure=async user=>(await db.query('SELECT rpc_kq_ensure_equipment_profile($1) AS data',[user])).rows[0].data;
  const cash=async user=>(await db.query('SELECT cash_cents FROM kq_equipment_wallets WHERE user_id=$1',[user])).rows[0].cash_cents;
  const wallets=async()=>(await db.query('SELECT to_jsonb(w) AS wallet FROM kq_equipment_wallets w ORDER BY user_id')).rows;
  const access=async()=>(await db.query(`SELECT
    (SELECT relacl::TEXT FROM pg_class WHERE oid='public.kq_equipment_wallets'::REGCLASS) AS wallet,
    (SELECT proacl::TEXT FROM pg_proc WHERE oid='public.rpc_kq_ensure_equipment_profile(uuid)'::REGPROCEDURE) AS initializer,
    (SELECT proacl::TEXT FROM pg_proc WHERE oid='public.rpc_arena_save_chanvrier(uuid,jsonb)'::REGPROCEDURE) AS profile`)).rows[0];
  const oldWallet=randomUUID();
  await db.query('INSERT INTO auth.users VALUES($1)',[oldWallet]);
  assert.deepEqual(await ensure(oldWallet),{ready:true});
  assert.equal(await cash(oldWallet),35000,'actual initializer uses the previous 350-euro default');
  const previousWallets=await wallets(),previousAccess=await access();
  const budgetMigration=await migration('20261019000300_kq_starting_budget.sql');
  await db.exec(budgetMigration);
  assert.deepEqual(await wallets(),previousWallets,'migration preserves every existing wallet and timestamp');
  assert.deepEqual(await access(),previousAccess,'changing the default preserves table and RPC grants');
  await ensure(oldWallet); await ensure(treasury);
  assert.deepEqual(await wallets(),previousWallets,'initialization retries never top up existing balances');

  const newGrower=randomUUID(),newTreasurer=randomUUID(),preinitialized=randomUUID();
  await db.query('INSERT INTO auth.users VALUES($1),($2),($3)',[newGrower,newTreasurer,preinitialized]);
  const growerProfile={...profile,nickname:'BudgetGrower',strength:'green-thumb'};
  const treasurerProfile={...profile,nickname:'BudgetTreasurer'};
  assert.equal((await save(newGrower,growerProfile)).startingBonusCents,0);
  assert.equal(await cash(newGrower),100000,'new ordinary profile receives exactly 1000 euros');
  assert.equal((await save(newTreasurer,treasurerProfile)).startingBonusCents,65000);
  assert.equal(await cash(newTreasurer),165000,'new Treasurer receives 1000 euros plus the existing 650-euro bonus');
  assert.equal((await save(newGrower,growerProfile)).startingBonusCents,0);
  assert.equal((await save(newTreasurer,treasurerProfile)).startingBonusCents,0);
  await ensure(newGrower); await ensure(newTreasurer);
  assert.equal(await cash(newGrower),100000,'profile and wallet retries preserve the ordinary starting budget');
  assert.equal(await cash(newTreasurer),165000,'profile and wallet retries cannot repeat the Treasurer bonus');
  await ensure(preinitialized);
  assert.equal(await cash(preinitialized),100000,'opening the game before choosing a specialty uses the same default');
  assert.equal((await save(preinitialized,{...profile,nickname:'BudgetPrepared'})).startingBonusCents,65000);
  assert.equal(await cash(preinitialized),165000,'choosing Treasurer after initialization adds only its existing bonus');
  assert.deepEqual((await db.query('SELECT equipment_code,purchase_price_cents FROM kq_player_equipment WHERE user_id=$1 ORDER BY equipment_code',[newGrower])).rows,[
    {equipment_code:'AIR-STARTER',purchase_price_cents:0},
    {equipment_code:'LED-150-STARTER',purchase_price_cents:0},
    {equipment_code:'TENT-080-STARTER',purchase_price_cents:0},
  ],'free starter equipment remains free and is never duplicated by retries');
  const legacyTreasurerProfile={...profile,nickname:'BudgetLegacy'};
  assert.equal((await save(oldWallet,legacyTreasurerProfile)).startingBonusCents,65000);
  assert.equal(await cash(oldWallet),100000,'existing 350-euro wallet choosing Treasurer receives only the 650-euro bonus');
  assert.equal((await save(oldWallet,legacyTreasurerProfile)).startingBonusCents,0);
  assert.equal(await cash(oldWallet),100000,'retry preserves the existing wallet plus its one-time Treasurer bonus');
  const afterBudgetWallets=await wallets();
  await db.exec(budgetMigration);
  assert.deepEqual(await wallets(),afterBudgetWallets,'reapplying the budget migration changes no existing wallet');
  assert.deepEqual(await access(),previousAccess,'reapplying the migration preserves grants');
  console.log('PASS: appearance catalog, legacy profiles, one-time capital, XP migration, savings timing, compounding, transfers, retries, permissions, merchant capacity, settled sale and new-only 1000/1650-euro budgets.');
} catch (error) { console.error(error.message, error.where ?? ""); process.exitCode=1; } finally { await vite.close(); await db.close(); }
