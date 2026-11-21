// Shared historical care schema and work accounting for the isolated PostgreSQL tests.
export async function installCultureCareFixture(db, migration) {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);
    CREATE TYPE kq_run_status AS ENUM('active','completed','abandoned');
    CREATE TYPE lottery_card_rarity AS ENUM('common','silver','gold');
    CREATE TABLE kq_runs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES auth.users,state JSONB,
      status kq_run_status,started_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now(),completed_at TIMESTAMPTZ,integrity_code TEXT,
      CHECK((status='completed')=(completed_at IS NOT NULL)));
    CREATE TABLE kq_flowers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),run_id UUID UNIQUE REFERENCES kq_runs,owner_id UUID,
      variety_code TEXT,variety_name TEXT,quality SMALLINT,traits TEXT[],combos TEXT[],battle_stats JSONB,status TEXT DEFAULT 'available',
      created_at TIMESTAMPTZ DEFAULT now(),locked_at TIMESTAMPTZ,burned_at TIMESTAMPTZ);
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY REFERENCES auth.users,cash_cents INTEGER DEFAULT 100000 CHECK(cash_cents>=0),updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_treasury_accounts(user_id UUID PRIMARY KEY REFERENCES auth.users,started_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_treasury_journal(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES kq_treasury_accounts,
      source_key TEXT,kind TEXT,reference TEXT,occurred_at TIMESTAMPTZ,postings JSONB,UNIQUE(user_id,source_key));
    CREATE TABLE kq_treasury_balances(user_id UUID REFERENCES kq_treasury_accounts,account TEXT,balance_cents BIGINT,PRIMARY KEY(user_id,account));
    -- Existing production accounting is exercised below using the real post/
    -- pair functions, plus a minimal opening position and wallet trigger.
    CREATE FUNCTION kq_treasury_initialize(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
      DECLARE cash INTEGER; BEGIN
      SELECT cash_cents INTO cash FROM kq_equipment_wallets WHERE user_id=p_user FOR UPDATE;
      INSERT INTO kq_treasury_accounts(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
      IF FOUND THEN PERFORM kq_treasury_pair(p_user,'opening','opening',now(),'cash','opening_equity',cash,'Opening fixture'); END IF;
      END $$;
    CREATE FUNCTION fixture_wallet_movement() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM kq_treasury_accounts WHERE user_id=NEW.user_id) THEN
        PERFORM kq_treasury_pair(NEW.user_id,'cash-movement','cash:'||gen_random_uuid(),now(),'cash','suspense',NEW.cash_cents-OLD.cash_cents,'Wallet fixture');
      END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_wallet_movement AFTER UPDATE ON kq_equipment_wallets FOR EACH ROW EXECUTE FUNCTION fixture_wallet_movement();
    CREATE FUNCTION rpc_kq_ensure_equipment_profile(p_user_id UUID) RETURNS VOID LANGUAGE sql AS $$
      INSERT INTO kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING $$;
    CREATE FUNCTION kq_business_settle(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    CREATE TABLE lottery_card_collections(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT,is_active BOOLEAN DEFAULT true);
    CREATE TABLE lottery_card_definitions(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),collection_id UUID,code TEXT,name TEXT,
      rarity lottery_card_rarity,card_number INTEGER,is_active BOOLEAN DEFAULT true,image_url TEXT,description TEXT);
    CREATE TABLE lottery_card_instances(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,card_definition_id UUID,
      ticket_id UUID,kq_support_entitlement_id UUID,source_bot_battle_id UUID,pack_slot INTEGER,created_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_support_booster_entitlements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,ticket_id UUID,
      status TEXT DEFAULT 'available',card_count INTEGER DEFAULT 10,opened_at TIMESTAMPTZ);
    CREATE FUNCTION lottery_secure_random_int(lo INTEGER,hi INTEGER) RETURNS INTEGER LANGUAGE sql AS $$ SELECT lo $$;
    CREATE TABLE kq_card_burn_receipts(id UUID,run_id UUID,card_instance_id UUID,card_code TEXT,stage_index SMALLINT,use_kind TEXT,burned_at TIMESTAMPTZ);
    CREATE TABLE kq_battles(id UUID,player_one_id UUID,player_two_id UUID,flower_one_id UUID,flower_two_id UUID,status TEXT,seed INTEGER,
      rounds JSONB,winner_id UUID,locked_at TIMESTAMPTZ,verdict_at TIMESTAMPTZ);
    CREATE TABLE kq_bot_battles(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),flower_id UUID,user_id UUID,bot_code TEXT,bot_flower JSONB,seed INTEGER,rounds JSONB,winner TEXT,experience_awarded NUMERIC DEFAULT 0.1,verdict_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_rank_profiles(user_id UUID PRIMARY KEY,season_code TEXT,rating INTEGER,season_points INTEGER,wins INTEGER,losses INTEGER,
      streak INTEGER,burned_flowers INTEGER,arena_experience NUMERIC,updated_at TIMESTAMPTZ);
    CREATE FUNCTION kq_active_season_code() RETURNS TEXT LANGUAGE sql AS $$ SELECT 'KQ-2026-S1'::TEXT $$;
    CREATE TABLE kq_leaderboard_snapshots(season_code TEXT,snapshot_date DATE,leaderboard JSONB);
    -- A representative trigger verifies that interventions are not harvested
    -- runs and death remains terminal without running the completion pipeline.
    CREATE TABLE completion_audit(run_id UUID PRIMARY KEY);
    CREATE FUNCTION fixture_completion() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.status='completed' AND OLD.status='active' THEN INSERT INTO completion_audit VALUES(NEW.id); END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_completion AFTER UPDATE ON kq_runs FOR EACH ROW EXECUTE FUNCTION fixture_completion();
  `);
  const treasury = await migration("20260921000200_kq_treasury_accounting.sql");
  await db.exec(treasury.slice(treasury.indexOf("CREATE FUNCTION public.kq_treasury_post"), treasury.indexOf("-- Actual production cost only.")));
  const booster = await migration("20260727000300_kq_pvp_three_card_booster.sql");
  await db.exec(booster.slice(booster.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_open_support_booster"), booster.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_battle_for_both_players")));
  const bot=await migration("20260727000200_kq_bot_victory_card_reward.sql");
  await db.exec(bot.slice(bot.indexOf("CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_bot_battle"),bot.indexOf("COMMIT;")));
  await db.exec(await migration("20260813000100_kq_player_core_snapshot.sql"));
  await db.exec(await migration("20261010000100_kq_culture_care.sql"));
}

export async function installCultureCareWork(db, migration) {
  await db.exec(`
    CREATE TABLE fixture_work(user_id UUID PRIMARY KEY,hours NUMERIC NOT NULL DEFAULT 0);
    CREATE FUNCTION kq_player_work_cost(TEXT,TEXT) RETURNS NUMERIC LANGUAGE sql AS $$ SELECT 0.5::NUMERIC $$;
    CREATE FUNCTION kq_player_work_charge(p_user UUID,p_hours NUMERIC) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO fixture_work VALUES(p_user,p_hours) ON CONFLICT(user_id) DO UPDATE SET hours=fixture_work.hours+p_hours;
      IF (SELECT hours FROM fixture_work WHERE user_id=p_user)>12 THEN RAISE EXCEPTION 'player_work_exhausted'; END IF;
    END $$;
    CREATE FUNCTION kq_campaign_assert_leader(p_user UUID,p_run UUID,p_state JSONB) RETURNS VOID LANGUAGE plpgsql AS $$ BEGIN
      IF p_state->'campaign' IS NOT NULL AND p_state->'campaign'->>'leaderRunId' IS DISTINCT FROM p_run::TEXT THEN RAISE EXCEPTION 'kq_campaign_action_required'; END IF;
    END $$;
    DO $$ DECLARE body TEXT; BEGIN
      body:=pg_get_functiondef('rpc_kq_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)'::regprocedure);
      EXECUTE replace(body,E'\\nBEGIN\\n',E'\\nBEGIN\\n PERFORM public.kq_campaign_assert_leader(p_user_id,p_run_id,p_next_state);\\n');
    END $$;
  `);
  const workMigration=await migration("20261107000500_kq_player_workday.sql");
  await db.exec(workMigration.slice(workMigration.indexOf("CREATE FUNCTION pg_temp.kq_player_work_wrap"),workMigration.indexOf("-- Registration list")));
  await db.exec("SELECT pg_temp.kq_player_work_wrap('public.rpc_kq_apply_care(uuid,uuid,text,uuid,timestamptz,jsonb,integer)','culture','''care''')");
}
