// Isolated PostgreSQL checks. No live database, credentials or network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { '@': path.resolve('src') } }, server: { middlewareMode: true, watch: null } });
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const migration = (name) => readFile(path.resolve('supabase/migrations', name), 'utf8');
const playerId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const arena = (force = false, season = 'KQ-2026-S1') => scalar('SELECT to_jsonb(rpc_kq_get_arena_leaderboard($1, $2))', [season, force]);
const placard = () => scalar("SELECT to_jsonb(rpc_kq_get_daily_leaderboard('KQ-2026-S1'))");
const checks = [];
const equal = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE kq_rank_profiles (user_id UUID PRIMARY KEY, season_code TEXT DEFAULT 'KQ-2026-S1',
      rating INTEGER DEFAULT 1000, season_points INTEGER DEFAULT 0, wins INTEGER DEFAULT 1,
      losses INTEGER DEFAULT 0, streak INTEGER DEFAULT 0, burned_flowers INTEGER DEFAULT 0,
      arena_experience INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY, reputation INTEGER DEFAULT 0, production_units INTEGER DEFAULT 1);
    CREATE TABLE kq_seasons(season_code TEXT PRIMARY KEY, status TEXT);
    CREATE TABLE kq_equipment_catalog(code TEXT PRIMARY KEY, slot TEXT, is_active BOOLEAN DEFAULT true);
    CREATE TABLE kq_player_equipment(user_id UUID, equipment_code TEXT, level INTEGER, purchase_price_cents INTEGER, tent_number INTEGER DEFAULT 1);
    CREATE TABLE kq_equipment_loadouts(user_id UUID, tent_number INTEGER, slot TEXT, equipment_code TEXT);
    CREATE TABLE kq_warehouse_layouts(user_id UUID PRIMARY KEY, state JSONB);
    CREATE TABLE kq_commerce_accounts(user_id UUID PRIMARY KEY, vat_sales_ttc_cents BIGINT DEFAULT 0);
    CREATE TABLE kq_online_accounts(user_id UUID PRIMARY KEY, site_tier TEXT DEFAULT 'none');
    REVOKE ALL ON kq_warehouse_layouts,kq_online_accounts FROM PUBLIC,anon,authenticated,service_role;
    CREATE TABLE arena_customer_reward_seasons(season_code TEXT PRIMARY KEY, status TEXT, standings_snapshot JSONB);
    CREATE TABLE kq_leaderboard_snapshots(snapshot_date DATE, season_code TEXT,
      leaderboard JSONB, generated_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY(snapshot_date, season_code));
    CREATE TABLE contest_seasons(id TEXT PRIMARY KEY, code TEXT, is_active BOOLEAN, is_archived BOOLEAN,
      harvest_start DATE, year INTEGER);
    CREATE TABLE contest_profiles(customer_id UUID PRIMARY KEY, pseudo TEXT);
    CREATE TABLE contest_tester_points(customer_id UUID, season_id TEXT REFERENCES contest_seasons(id), points INTEGER);
    CREATE TABLE contest_reviews(customer_id UUID, season_id TEXT REFERENCES contest_seasons(id), status TEXT);
    CREATE TABLE kq_runs(id UUID, user_id UUID, state JSONB, status TEXT, started_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);
    CREATE TABLE kq_card_burn_receipts(id UUID, run_id UUID, card_instance_id UUID, card_code TEXT,
      stage_index INTEGER, use_kind TEXT, burned_at TIMESTAMPTZ);
    CREATE TABLE kq_flowers(id UUID, owner_id UUID, run_id UUID, variety_code TEXT, variety_name TEXT,
      quality INTEGER, traits JSONB, combos JSONB, battle_stats JSONB, status TEXT,
      created_at TIMESTAMPTZ, locked_at TIMESTAMPTZ, burned_at TIMESTAMPTZ, rules_version INTEGER, cannabinoid_report JSONB);
    CREATE TABLE kq_battles(id UUID, player_one_id UUID, player_two_id UUID, flower_one_id UUID,
      flower_two_id UUID, winner_id UUID, status TEXT, seed INTEGER, rounds JSONB,
      locked_at TIMESTAMPTZ, verdict_at TIMESTAMPTZ);
    CREATE TABLE kq_bot_battles(id UUID, user_id UUID, flower_id UUID, seed INTEGER, bot_flower JSONB,
      rounds JSONB, winner TEXT, experience_awarded INTEGER, verdict_at TIMESTAMPTZ);
  `);
  await db.exec(await migration('20260906000400_kq_placard_composite_score.sql'));
  // Apply the real core function, including the flower enrichment from culture
  // care, so the incremental patch cannot silently replace those fields.
  let coreSql = await migration('20260813000100_kq_player_core_snapshot.sql');
  coreSql = coreSql.replace("'stats', flower.battle_stats,", "'stats', flower.battle_stats, 'rulesVersion', flower.rules_version, 'cannabinoidReport', flower.cannabinoid_report,");
  await db.exec(coreSql);
  await db.exec(await migration('20261011000100_arena_ranking_budget.sql'));
  const warehouseCatalog = await migration('20261012000900_kq_warehouse_equipment_tiers.sql');
  const deviceStart = warehouseCatalog.indexOf('CREATE FUNCTION public.kq_warehouse_device(');
  const deviceEnd = warehouseCatalog.indexOf('$$;', deviceStart) + 3;
  assert.ok(deviceStart >= 0 && deviceEnd > deviceStart, 'Warehouse catalog declaration is present');
  await db.exec(warehouseCatalog.slice(deviceStart, deviceEnd));
  await db.exec(await readFile(path.resolve('scripts/fixtures/kq-company-valuation-schema.sql'), 'utf8'));
  await db.exec(await migration('20261014000000_kq_company_valuation.sql'));
  await db.exec(await migration('20261014000100_kq_business_development_score.sql'));
  await db.exec(`
    INSERT INTO kq_seasons VALUES('KQ-2026-S1','active'),('KQ-CLOSED','closed');
    INSERT INTO kq_leaderboard_snapshots VALUES
      (CURRENT_DATE,'KQ-2026-S1','[]',now()),(CURRENT_DATE-1,'KQ-2026-S1','[{"score":7}]',now()),
      (CURRENT_DATE,'KQ-CLOSED','[{"score":9}]',now());
    INSERT INTO kq_arena_leaderboard_snapshots(season_code,leaderboard)
      VALUES('KQ-2026-S1','[]'),('KQ-CLOSED','[{"score":9}]');
    INSERT INTO arena_customer_reward_seasons VALUES('REWARD-CLOSED','frozen','[{"score":77,"rank":1}]');
  `);
  await db.exec(await migration('20261014000200_kq_development_rankings.sql'));
  equal('Development migration expires the current Placard cache', await scalar("SELECT generated_at < now()-interval '60 seconds' FROM kq_leaderboard_snapshots WHERE season_code='KQ-2026-S1' AND snapshot_date=CURRENT_DATE"), true);
  equal('Development migration preserves older daily snapshots', await scalar("SELECT generated_at > now()-interval '60 seconds' FROM kq_leaderboard_snapshots WHERE season_code='KQ-2026-S1' AND snapshot_date=CURRENT_DATE-1"), true);
  equal('Development migration expires the current Arena cache', await scalar("SELECT generated_at < now()-interval '60 seconds' FROM kq_arena_leaderboard_snapshots WHERE season_code='KQ-2026-S1'"), true);
  equal('Development migration preserves closed-season caches', await scalar("SELECT generated_at > now()-interval '60 seconds' AND leaderboard='[{\"score\":9}]'::JSONB FROM kq_arena_leaderboard_snapshots WHERE season_code='KQ-CLOSED'"), true);
  equal('Development migration preserves frozen customer reward standings', await scalar("SELECT standings_snapshot FROM arena_customer_reward_seasons WHERE season_code='REWARD-CLOSED'"), [{ score: 77, rank: 1 }]);
  await db.exec("DELETE FROM kq_leaderboard_snapshots WHERE season_code='KQ-2026-S1'; DELETE FROM kq_arena_leaderboard_snapshots WHERE season_code='KQ-2026-S1';");
  equal('Snapshot season identity keeps the existing contest TEXT key', await scalar("SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='kq_arena_leaderboard_snapshots' AND column_name='contest_season_id'"), 'text');
  await db.exec(`
    CREATE TABLE ranking_writes(kind TEXT);
    CREATE FUNCTION count_ranking_write() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO ranking_writes VALUES(TG_TABLE_NAME); RETURN NEW; END $$;
    CREATE TRIGGER count_arena_write AFTER INSERT OR UPDATE ON kq_arena_leaderboard_snapshots
      FOR EACH ROW EXECUTE FUNCTION count_ranking_write();
    CREATE TRIGGER count_placard_write AFTER INSERT OR UPDATE ON kq_leaderboard_snapshots
      FOR EACH ROW EXECUTE FUNCTION count_ranking_write();
    INSERT INTO contest_seasons VALUES ('harvest-2026','CARNET-1',true,false,now(),2026);
    INSERT INTO kq_rank_profiles(user_id, rating)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID,1100 FROM generate_series(1,100) n;
    INSERT INTO kq_rank_profiles(user_id,rating) VALUES('${playerId(101)}',1000);
    INSERT INTO kq_rank_profiles(user_id,rating,wins) VALUES('${playerId(102)}',3000,0);
    INSERT INTO contest_profiles VALUES('${playerId(101)}','Carnet gagnant');
    INSERT INTO contest_tester_points VALUES('${playerId(101)}','harvest-2026',300);
    INSERT INTO contest_reviews VALUES('${playerId(101)}','harvest-2026','approved');
  `);
  const initialPlacard = await placard();
  equal('The eventual Arena winner is absent from the Placard top 100', initialPlacard.leaderboard.some((p) => p.userId === playerId(101)), false);
  const initialArena = await arena();
  equal('Non-UUID contest season identity is preserved', initialArena.contest_season_id, 'harvest-2026');
  equal('Full Arena score is calculated before the top-100 cutoff', initialArena.leaderboard[0], {
    userId: playerId(101), rank: 1, pseudo: 'Carnet gagnant', score: 325,
    notebookScore: 300, placardScore: 25, businessScore: 0, approvedReviewCount: 1, rating: 1000, wins: 1, losses: 0,
  });
  equal('Arena stays bounded to 100 eligible players', initialArena.leaderboard.length, 100);
  equal('No-duel players remain ineligible', initialArena.leaderboard.some((p) => p.userId === playerId(102)), false);
  equal('Deterministic ties use rating then UUID', initialArena.leaderboard[1].userId, playerId(1));

  await db.exec(`UPDATE kq_rank_profiles SET rating=1300 WHERE user_id='${playerId(101)}';`);
  await Promise.all(Array.from({ length: 20 }, () => arena()));
  await Promise.all(Array.from({ length: 20 }, () => placard()));
  equal('Repeated reads do not write either fresh snapshot', await scalar('SELECT COUNT(*)::INTEGER FROM ranking_writes'), 2);
  equal('Arena TTL preserves the original generation timestamp', (await arena()).generated_at, initialArena.generated_at);
  equal('Placard TTL preserves the original generation timestamp', (await placard()).generated_at, initialPlacard.generated_at);
  equal('Arena TTL serves the previous score within 60 seconds', (await arena()).leaderboard[0].score, 325);

  const forced = await arena(true);
  equal('Reward finalization bypasses an unexpired Arena snapshot', forced.leaderboard[0].score, 400);
  await scalar("SELECT to_jsonb(rpc_kq_refresh_daily_leaderboard('KQ-2026-S1'))");
  equal('Legacy season-reward refresh remains forced', (await placard()).leaderboard.some((p) => p.userId === playerId(101)), true);

  await db.exec(`UPDATE kq_rank_profiles SET rating=1400 WHERE user_id='${playerId(101)}';
    UPDATE kq_arena_leaderboard_snapshots SET generated_at=now()-interval '61 seconds';
    UPDATE kq_leaderboard_snapshots SET generated_at=now()-interval '61 seconds';`);
  const beforeExpiredReads = await scalar('SELECT COUNT(*)::INTEGER FROM ranking_writes');
  await Promise.all(Array.from({ length: 20 }, () => arena()));
  await Promise.all(Array.from({ length: 20 }, () => placard()));
  equal('Expiry triggers exactly one write per ranking', await scalar('SELECT COUNT(*)::INTEGER FROM ranking_writes'), beforeExpiredReads + 2);
  equal('Expired Arena snapshot reflects current profile data', (await arena()).leaderboard[0].rating, 1400);

  await db.exec(`INSERT INTO kq_equipment_wallets(user_id,reputation) VALUES('${playerId(101)}',400);
    UPDATE kq_rank_profiles SET season_points=20 WHERE user_id='${playerId(101)}';`);
  const beforeCore = await scalar('SELECT COUNT(*)::INTEGER FROM ranking_writes');
  const progress = (await scalar('SELECT rpc_kq_player_core_snapshot($1)', [playerId(101)])).progress;
  equal('Bootstrap has current reputation without refreshing shared rankings', progress.reputation, 400);
  equal('Bootstrap uses current composite score independently of cached rank', progress.placardScore, 1485);
  equal('Bootstrap includes a zero development score before a business exists', progress.businessScore, 0);
  equal('Bootstrap exposes the full persisted generation timestamp', progress.leaderboardGeneratedAt, (await placard()).generated_at);
  equal('Bootstrap remains read-only', await scalar('SELECT COUNT(*)::INTEGER FROM ranking_writes'), beforeCore);
  equal('Wallet-less profiles keep zero reputation', (await scalar('SELECT rpc_kq_player_core_snapshot($1)', [playerId(1)])).progress.reputation, 0);
  equal('Core patch preserves culture-care fields', (await scalar("SELECT pg_get_functiondef('rpc_kq_player_core_snapshot(uuid)'::regprocedure)")).includes("'rulesVersion', flower.rules_version"), true);

  await db.exec(`UPDATE contest_seasons SET is_active=false;
    INSERT INTO contest_seasons VALUES('harvest-2027','CARNET-2',true,false,now(),2026);`);
  const switched = await arena();
  equal('A new notebook season invalidates the old snapshot immediately', switched.contest_season_code, 'CARNET-2');
  equal('Notebook points from the old season cannot leak into the new one', switched.leaderboard[0].notebookScore, 0);
  equal('Another Placard season has independent candidates', (await arena(false, 'KQ-2026-S2')).leaderboard, []);

  // Development is calculated for every candidate before either top-100 cutoff.
  await db.exec(`
    INSERT INTO kq_rank_profiles(user_id,season_code,rating)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID,'DEVELOPMENT',1100
      FROM generate_series(300,399) n;
    INSERT INTO kq_rank_profiles(user_id,season_code,rating) VALUES('${playerId(400)}','DEVELOPMENT',1000);
    INSERT INTO kq_rank_profiles(user_id,season_code,rating,wins) VALUES('${playerId(401)}','DEVELOPMENT',1000,0);
  `);
  const initialDevelopment = await arena(true, 'DEVELOPMENT');
  equal('Undeveloped candidate starts outside the Arena top 100', initialDevelopment.leaderboard.some((entry) => entry.userId === playerId(400)), false);
  await db.exec(`
    INSERT INTO kq_commerce_accounts(user_id,vat_sales_ttc_cents) VALUES('${playerId(400)}',1000000),('${playerId(401)}',1000000);
    INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES('${playerId(400)}',1000000);
    INSERT INTO kq_warehouse_layouts(user_id,state) VALUES('${playerId(400)}','{
      "version":1,"preparedAreaM2":50,
      "zones":[{"width":10,"height":5,"active":false,"lightingCode":"SIM-LIGHT-03","airCode":"SIM-AIR-03"}],
      "serviceZones":[],
      "equipment":[{"code":"SIM-LIGHT-03","quantity":13},{"code":"SIM-AIR-03","quantity":1}]
    }');
  `);
  equal('Turnover, installed production and net company value form the development score', await scalar('SELECT kq_business_development_score($1)', [playerId(400)]), { score: 200, production: 60, sales: 80, companyValue: 60, productionAreaM2: 50, companyValueCents: 1000000 });
  equal('Business changes respect the shared Arena TTL', (await arena(false, 'DEVELOPMENT')).leaderboard, initialDevelopment.leaderboard);
  const developedArena = await arena(true, 'DEVELOPMENT');
  equal('Business development can move an excluded candidate to Arena first place', [developedArena.leaderboard[0].userId, developedArena.leaderboard[0].businessScore, developedArena.leaderboard[0].score], [playerId(400), 200, 225]);
  equal('A developed company does not bypass the human-duel requirement', developedArena.leaderboard.some((entry) => entry.userId === playerId(401)), false);
  const developedPlacard = await scalar("SELECT to_jsonb(rpc_kq_refresh_daily_leaderboard('DEVELOPMENT'))");
  equal('The same development bonus changes the Placard score and rank', [developedPlacard.leaderboard[0].userId, developedPlacard.leaderboard[0].businessScore, developedPlacard.leaderboard[0].placardScore], [playerId(400), 200, 1200]);
  const beforeDevelopedCore = await scalar('SELECT COUNT(*)::INTEGER FROM ranking_writes');
  const developedProgress = (await scalar('SELECT rpc_kq_player_core_snapshot($1)', [playerId(400)])).progress;
  equal('Personal progress matches both live development and Placard score', [developedProgress.businessScore, developedProgress.placardScore], [200, 1200]);
  equal('Developed personal progress remains read-only', await scalar('SELECT COUNT(*)::INTEGER FROM ranking_writes'), beforeDevelopedCore);
  await db.exec(`UPDATE kq_rank_profiles SET rating=9999,season_points=9999 WHERE user_id='${playerId(400)}';
    INSERT INTO contest_profiles VALUES('${playerId(400)}','Entreprise accomplie');
    INSERT INTO contest_tester_points VALUES('${playerId(400)}','harvest-2027',9999);`);
  const completeScore = (await arena(true, 'DEVELOPMENT')).leaderboard[0];
  equal('All three fully developed Arena contributions are capped at 1,000', [completeScore.notebookScore, completeScore.placardScore, completeScore.businessScore, completeScore.score], [300, 500, 200, 1000]);

  await db.exec(`
    INSERT INTO kq_rank_profiles(user_id,season_code,rating)
      VALUES('${playerId(500)}','VALUATION',1000),('${playerId(501)}','VALUATION',1010);
  `);
  const beforeValueGrowth = await arena(true, 'VALUATION');
  equal('Before value growth, duel score breaks the otherwise equal development ranking', beforeValueGrowth.leaderboard[0].userId, playerId(501));
  const beforeValueComponents = await scalar('SELECT kq_business_development_score($1)', [playerId(500)]);
  await db.exec(`INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES('${playerId(500)}',1000000);`);
  const afterValueComponents = await scalar('SELECT kq_business_development_score($1)', [playerId(500)]);
  equal('Company value can grow without changing turnover or installed production', [afterValueComponents.sales, afterValueComponents.production, afterValueComponents.companyValue], [beforeValueComponents.sales, beforeValueComponents.production, 60]);
  equal('Company value changes retain the shared cache until a refresh', (await arena(false, 'VALUATION')).leaderboard, beforeValueGrowth.leaderboard);
  const afterValueGrowth = (await arena(true, 'VALUATION')).leaderboard[0];
  equal('Company value alone can change the Arena winner', [afterValueGrowth.userId, afterValueGrowth.businessScore, afterValueGrowth.score], [playerId(500), 60, 85]);
  const valuePlacard = (await scalar("SELECT to_jsonb(rpc_kq_refresh_daily_leaderboard('VALUATION'))")).leaderboard[0];
  equal('Company value alone can change the Placard winner', [valuePlacard.userId, valuePlacard.placardScore], [playerId(500), 1060]);

  const { calculateArenaScore } = await vite.ssrLoadModule('/src/lib/arena-ranking.ts');
  const { calculateKqPlacardScore } = await vite.ssrLoadModule('/src/lib/kanab-quest-reputation.ts');
  const { calculateKqBusinessDevelopment } = await vite.ssrLoadModule('/src/lib/kanab-quest-development.ts');
  const cases = [
    { rating: 901, seasonPoints: 0, notebook: 0, sales: 0, width: 0, height: 0, company: 0, business: 0 },
    { rating: 902, seasonPoints: 12, notebook: -50, sales: 10000, width: 1, height: 1, company: 10000, business: 15 },
    { rating: 899, seasonPoints: 301, notebook: 9999, sales: 562500, width: 10, height: 5, company: 1000000, business: 180 },
    { rating: 1206, seasonPoints: 99, notebook: 200, sales: 25599, width: 2, height: 2, company: 250000, business: 46 },
    { rating: 900, seasonPoints: 2147483647, notebook: 1, sales: 9223372036854775807n, width: 0, height: 0, company: 0, business: 80 },
    { rating: 100000, seasonPoints: 0, notebook: 300, sales: 100, width: 5, height: 2, company: 1000000, business: 72 },
  ];
  for (const [index, sample] of cases.entries()) {
    const id = playerId(200 + index);
    await db.query("INSERT INTO kq_rank_profiles(user_id,season_code,rating,season_points) VALUES($1,'FORMULA',$2,$3)", [id, sample.rating, sample.seasonPoints]);
    await db.query('INSERT INTO contest_profiles VALUES($1,$2)', [id, `Formula ${index}`]);
    await db.query('INSERT INTO contest_tester_points VALUES($1,$2,$3)', [id, 'harvest-2027', sample.notebook]);
    await db.query('INSERT INTO kq_commerce_accounts(user_id,vat_sales_ttc_cents) VALUES($1,$2)', [id, String(sample.sales)]);
    await db.query('INSERT INTO kq_equipment_wallets(user_id,cash_cents) VALUES($1,$2)', [id, sample.company]);
    const area = sample.width * sample.height;
    if (area > 0) await db.query('INSERT INTO kq_warehouse_layouts(user_id,state) VALUES($1,$2)', [id, JSON.stringify({
      version: 1, preparedAreaM2: area, serviceZones: [],
      zones: [{ width: sample.width, height: sample.height, active: true, lightingCode: 'SIM-LIGHT-03', airCode: 'SIM-AIR-03' }],
      equipment: [{ code: 'SIM-LIGHT-03', quantity: Math.ceil(area / 4) }, { code: 'SIM-AIR-03', quantity: Math.ceil(area / 50) }],
    })]);
  }
  const formulaEntries = (await arena(true, 'FORMULA')).leaderboard;
  const placardFormulaEntries = (await scalar("SELECT to_jsonb(rpc_kq_refresh_daily_leaderboard('FORMULA'))")).leaderboard;
  for (const [index, sample] of cases.entries()) {
    const development = calculateKqBusinessDevelopment({ salesTtcCents: Number(sample.sales), productionAreaM2: sample.width * sample.height, companyValueCents: sample.company });
    equal(`Company development SQL/TypeScript parity ${index + 1}`, await scalar('SELECT kq_business_development_score($1)', [playerId(200 + index)]), development);
    equal(`Company development expected weighting ${index + 1}`, development.score, sample.business);
    const score = calculateArenaScore({ placardRating: sample.rating, placardSeasonPoints: sample.seasonPoints, notebookSeasonPoints: sample.notebook, placardBattles: 1, businessScore: sample.business });
    const result = formulaEntries.find((p) => p.userId === playerId(200 + index));
    equal(`SQL/TypeScript formula parity ${index + 1}`, [result.score, result.notebookScore, result.placardScore, result.businessScore], [score.total, score.notebook, score.placard, score.business]);
    const placardScore = calculateKqPlacardScore({ rating: sample.rating, seasonPoints: sample.seasonPoints, reputation: 0, businessScore: sample.business });
    const placardResult = placardFormulaEntries.find((p) => p.userId === playerId(200 + index));
    equal(`Placard SQL/TypeScript formula parity ${index + 1}`, [placardResult.placardScore, placardResult.businessScore], [placardScore.score, placardScore.businessBonus]);
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    equal(`${role} cannot access the private Arena snapshot table`, await scalar(`SELECT has_table_privilege($1,'kq_arena_leaderboard_snapshots','SELECT,INSERT,UPDATE,DELETE')`, [role]), false);
    equal(`${role} RPC execution is explicitly scoped`, await scalar("SELECT has_function_privilege($1,'rpc_kq_get_arena_leaderboard(text,boolean)','EXECUTE')", [role]), role === 'service_role');
    equal(`${role} development RPC execution is explicitly scoped`, await scalar("SELECT has_function_privilege($1,'kq_business_development_score(uuid)','EXECUTE')", [role]), role === 'service_role');
    equal(`${role} cannot call the private company valuation helper directly`, await scalar("SELECT has_function_privilege($1,'kq_company_net_value(uuid)','EXECUTE')", [role]), false);
    equal(`${role} cannot directly read private company source tables`, await scalar("SELECT has_table_privilege($1,'kq_online_accounts','SELECT') OR has_table_privilege($1,'kq_warehouse_layouts','SELECT')", [role]), false);
  }
  equal('Progress snapshot table is read-only to service_role', await scalar("SELECT has_table_privilege('service_role','kq_leaderboard_snapshots','SELECT') AND NOT has_table_privilege('service_role','kq_leaderboard_snapshots','INSERT,UPDATE,DELETE')"), true);
  console.log(JSON.stringify({ result: 'passed', checks: checks.length, details: checks,
    engine: 'PGlite isolated PostgreSQL', concurrency: 'Overlapping requests are serialized by PGlite. True multi-connection lock contention needs PostgreSQL.' }, null, 2));
} finally {
  await vite.close();
  await db.close();
}
