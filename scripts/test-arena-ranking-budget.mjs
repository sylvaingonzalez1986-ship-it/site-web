// Isolated PostgreSQL checks. No live database, credentials or network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';

const db = new PGlite();
const vite = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, watch: null } });
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
    CREATE TABLE kq_equipment_wallets(user_id UUID PRIMARY KEY, reputation INTEGER DEFAULT 0);
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
    notebookScore: 300, placardScore: 25, approvedReviewCount: 1, rating: 1000, wins: 1, losses: 0,
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

  await db.exec(`INSERT INTO kq_equipment_wallets VALUES('${playerId(101)}',400);
    UPDATE kq_rank_profiles SET season_points=20 WHERE user_id='${playerId(101)}';`);
  const beforeCore = await scalar('SELECT COUNT(*)::INTEGER FROM ranking_writes');
  const progress = (await scalar('SELECT rpc_kq_player_core_snapshot($1)', [playerId(101)])).progress;
  equal('Bootstrap has current reputation without refreshing shared rankings', progress.reputation, 400);
  equal('Bootstrap uses current composite score independently of cached rank', progress.placardScore, 1485);
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

  const { calculateArenaScore } = await vite.ssrLoadModule('/src/lib/arena-ranking.ts');
  const cases = [
    { rating: 901, seasonPoints: 0, notebook: 0 }, { rating: 902, seasonPoints: 12, notebook: -50 },
    { rating: 899, seasonPoints: 301, notebook: 9999 }, { rating: 1206, seasonPoints: 99, notebook: 200 },
    { rating: 900, seasonPoints: 2147483647, notebook: 1 }, { rating: 100000, seasonPoints: 0, notebook: 300 },
  ];
  for (const [index, sample] of cases.entries()) {
    const id = playerId(200 + index);
    await db.query("INSERT INTO kq_rank_profiles(user_id,season_code,rating,season_points) VALUES($1,'FORMULA',$2,$3)", [id, sample.rating, sample.seasonPoints]);
    await db.query('INSERT INTO contest_profiles VALUES($1,$2)', [id, `Formula ${index}`]);
    await db.query('INSERT INTO contest_tester_points VALUES($1,$2,$3)', [id, 'harvest-2027', sample.notebook]);
  }
  const formulaEntries = (await arena(true, 'FORMULA')).leaderboard;
  for (const [index, sample] of cases.entries()) {
    const score = calculateArenaScore({ placardRating: sample.rating, placardSeasonPoints: sample.seasonPoints, notebookSeasonPoints: sample.notebook, placardBattles: 1 });
    const result = formulaEntries.find((p) => p.userId === playerId(200 + index));
    equal(`SQL/TypeScript formula parity ${index + 1}`, [result.score, result.notebookScore, result.placardScore], [score.total, score.notebook, score.placard]);
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    equal(`${role} cannot access the private Arena snapshot table`, await scalar(`SELECT has_table_privilege($1,'kq_arena_leaderboard_snapshots','SELECT,INSERT,UPDATE,DELETE')`, [role]), false);
    equal(`${role} RPC execution is explicitly scoped`, await scalar("SELECT has_function_privilege($1,'rpc_kq_get_arena_leaderboard(text,boolean)','EXECUTE')", [role]), role === 'service_role');
  }
  equal('Progress snapshot table is read-only to service_role', await scalar("SELECT has_table_privilege('service_role','kq_leaderboard_snapshots','SELECT') AND NOT has_table_privilege('service_role','kq_leaderboard_snapshots','INSERT,UPDATE,DELETE')"), true);
  console.log(JSON.stringify({ result: 'passed', checks: checks.length, details: checks,
    engine: 'PGlite isolated PostgreSQL', concurrency: 'Overlapping requests are serialized by PGlite. True multi-connection lock contention needs PostgreSQL.' }, null, 2));
} finally {
  await vite.close();
  await db.close();
}
