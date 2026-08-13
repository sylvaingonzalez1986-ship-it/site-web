BEGIN;

CREATE INDEX IF NOT EXISTS idx_kq_leaderboard_snapshots_season_recent
  ON public.kq_leaderboard_snapshots(season_code, snapshot_date DESC);

CREATE OR REPLACE FUNCTION public.rpc_kq_player_core_snapshot(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_run AS (
    SELECT r.id, r.state, r.started_at, r.updated_at
    FROM public.kq_runs r
    WHERE r.user_id = p_user_id
      AND r.status = 'active'
    ORDER BY r.started_at DESC
    LIMIT 1
  ),
  active_run_payload AS (
    SELECT jsonb_build_object(
      'runId', r.id,
      'state', r.state,
      'startedAt', r.started_at,
      'updatedAt', r.updated_at,
      'burnReceipts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', receipt.id,
            'cardInstanceId', receipt.card_instance_id,
            'cardCode', receipt.card_code,
            'stageIndex', receipt.stage_index,
            'useKind', receipt.use_kind,
            'burnedAt', receipt.burned_at
          )
          ORDER BY receipt.burned_at DESC
        )
        FROM public.kq_card_burn_receipts receipt
        WHERE receipt.run_id = r.id
      ), '[]'::jsonb)
    ) AS payload
    FROM active_run r
  ),
  flowers_payload AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', flower.id,
        'runId', flower.run_id,
        'varietyCode', flower.variety_code,
        'varietyName', flower.variety_name,
        'quality', flower.quality,
        'traits', flower.traits,
        'combos', flower.combos,
        'stats', flower.battle_stats,
        'status', flower.status,
        'createdAt', flower.created_at,
        'lockedAt', flower.locked_at,
        'burnedAt', flower.burned_at
      )
      ORDER BY flower.created_at DESC
    ), '[]'::jsonb) AS payload
    FROM (
      SELECT f.*
      FROM public.kq_flowers f
      WHERE f.owner_id = p_user_id
        AND f.status IN ('available', 'locked')
      ORDER BY f.created_at DESC
      LIMIT 40
    ) flower
  ),
  human_battles_payload AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', battle.id,
        'status', battle.status,
        'seed', battle.seed,
        'playerFlower', CASE WHEN battle.player_one_id = p_user_id THEN
          jsonb_build_object(
            'id', flower_one.id, 'variety_name', flower_one.variety_name,
            'quality', flower_one.quality, 'traits', flower_one.traits,
            'battle_stats', flower_one.battle_stats, 'status', flower_one.status,
            'created_at', flower_one.created_at
          )
        ELSE
          jsonb_build_object(
            'id', flower_two.id, 'variety_name', flower_two.variety_name,
            'quality', flower_two.quality, 'traits', flower_two.traits,
            'battle_stats', flower_two.battle_stats, 'status', flower_two.status,
            'created_at', flower_two.created_at
          )
        END,
        'opponentFlower', CASE WHEN battle.player_one_id = p_user_id THEN
          jsonb_build_object(
            'id', flower_two.id, 'variety_name', flower_two.variety_name,
            'quality', flower_two.quality, 'traits', flower_two.traits,
            'battle_stats', flower_two.battle_stats, 'status', flower_two.status,
            'created_at', flower_two.created_at
          )
        ELSE
          jsonb_build_object(
            'id', flower_one.id, 'variety_name', flower_one.variety_name,
            'quality', flower_one.quality, 'traits', flower_one.traits,
            'battle_stats', flower_one.battle_stats, 'status', flower_one.status,
            'created_at', flower_one.created_at
          )
        END,
        'rounds', battle.rounds,
        'invertRounds', battle.player_one_id <> p_user_id,
        'winner', CASE
          WHEN battle.winner_id IS NULL THEN NULL
          WHEN battle.winner_id = p_user_id THEN 'player'
          ELSE 'opponent'
        END,
        'lockedAt', battle.locked_at,
        'verdictAt', battle.verdict_at,
        'opponentType', 'human',
        'experienceAwarded', CASE WHEN battle.status = 'verdict' THEN 1 ELSE 0 END
      )
      ORDER BY battle.locked_at DESC
    ), '[]'::jsonb) AS payload
    FROM (
      SELECT candidate.*
      FROM public.kq_battles candidate
      WHERE candidate.player_one_id = p_user_id OR candidate.player_two_id = p_user_id
      ORDER BY candidate.locked_at DESC
      LIMIT 12
    ) battle
    JOIN public.kq_flowers flower_one ON flower_one.id = battle.flower_one_id
    JOIN public.kq_flowers flower_two ON flower_two.id = battle.flower_two_id
  ),
  bot_battles_payload AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', battle.id,
        'status', 'verdict',
        'seed', battle.seed,
        'playerFlower', jsonb_build_object(
          'id', flower.id, 'variety_name', flower.variety_name,
          'quality', flower.quality, 'traits', flower.traits,
          'battle_stats', flower.battle_stats, 'status', flower.status,
          'created_at', flower.created_at
        ),
        'opponentFlower', battle.bot_flower,
        'rounds', battle.rounds,
        'invertRounds', false,
        'winner', battle.winner,
        'lockedAt', battle.verdict_at,
        'verdictAt', battle.verdict_at,
        'opponentType', 'bot',
        'experienceAwarded', battle.experience_awarded
      )
      ORDER BY battle.verdict_at DESC
    ), '[]'::jsonb) AS payload
    FROM (
      SELECT candidate.*
      FROM public.kq_bot_battles candidate
      WHERE candidate.user_id = p_user_id
      ORDER BY candidate.verdict_at DESC
      LIMIT 12
    ) battle
    JOIN public.kq_flowers flower ON flower.id = battle.flower_id
  ),
  rank_profile AS (
    SELECT profile.*
    FROM public.kq_rank_profiles profile
    WHERE profile.user_id = p_user_id
  ),
  progress_payload AS (
    SELECT jsonb_build_object(
      'seasonCode', profile.season_code,
      'rank', (
        SELECT (entry ->> 'rank')::integer
        FROM jsonb_array_elements(COALESCE(snapshot.leaderboard, '[]'::jsonb)) entry
        WHERE entry ->> 'userId' = p_user_id::text
        LIMIT 1
      ),
      'rating', profile.rating,
      'seasonPoints', profile.season_points,
      'wins', profile.wins,
      'losses', profile.losses,
      'streak', profile.streak,
      'burnedFlowers', profile.burned_flowers,
      'arenaExperience', profile.arena_experience,
      'leaderboardGeneratedAt', snapshot.snapshot_date,
      'updatedAt', profile.updated_at
    ) AS payload
    FROM rank_profile profile
    LEFT JOIN LATERAL (
      SELECT leaderboard, snapshot_date
      FROM public.kq_leaderboard_snapshots
      WHERE season_code = profile.season_code
      ORDER BY snapshot_date DESC
      LIMIT 1
    ) snapshot ON true
  )
  SELECT jsonb_build_object(
    'activeRun', (SELECT payload FROM active_run_payload),
    'flowers', COALESCE((SELECT payload FROM flowers_payload), '[]'::jsonb),
    'humanBattles', COALESCE((SELECT payload FROM human_battles_payload), '[]'::jsonb),
    'botBattles', COALESCE((SELECT payload FROM bot_battles_payload), '[]'::jsonb),
    'progress', (SELECT payload FROM progress_payload)
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_player_core_snapshot(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_player_core_snapshot(UUID)
  TO service_role;

COMMENT ON FUNCTION public.rpc_kq_player_core_snapshot(UUID) IS
  'Returns the authenticated Placard player active run, flowers, battles and rank progress in one database round trip.';

COMMIT;
