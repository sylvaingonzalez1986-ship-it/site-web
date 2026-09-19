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
  console.log('PASS: appearance catalog, legacy profiles, one-time capital, XP migration, savings timing, compounding, transfers, retries, permissions, merchant capacity and settled sale.');
} catch (error) { console.error(error.message, error.where ?? ""); process.exitCode=1; } finally { await vite.close(); await db.close(); }