BEGIN;
SET LOCAL lock_timeout = '10s';

-- Run once before opening the Carnet. Keep an owner-only recovery snapshot and
-- a durable marker: replaying this migration must never delete customer notes
-- written after the opening. This table is deliberately outside the Data API.
CREATE TABLE IF NOT EXISTS public.contest_notebook_reset_archive (
  reset_key TEXT PRIMARY KEY,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  deleted_counts JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(deleted_counts) = 'object')
);
ALTER TABLE public.contest_notebook_reset_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contest_notebook_reset_archive FROM PUBLIC, anon, authenticated, service_role;

DO $reset$
DECLARE
  v_key CONSTANT TEXT := '2026-10-public-opening';
  v_count BIGINT;
  v_counts JSONB := '{}'::jsonb;
  v_season_code TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('contest-notebook-reset:' || v_key, 0));
  IF EXISTS (SELECT 1 FROM public.contest_notebook_reset_archive WHERE reset_key = v_key) THEN
    RETURN;
  END IF;

  -- Share the refresh RPC's lock so a calculation started before this reset
  -- cannot write stale tasting counts back into the cache after our commit.
  FOR v_season_code IN SELECT season_code FROM public.kq_seasons WHERE status = 'active' ORDER BY season_code LOOP
    PERFORM pg_advisory_xact_lock(hashtext('kq_arena_leaderboard:' || v_season_code));
  END LOOP;

  -- Freeze the notes and their dependent rows for a consistent snapshot. A busy
  -- database fails without changing anything rather than partially resetting.
  LOCK TABLE public.contest_reviews, public.contest_review_scores,
    public.contest_review_aroma_tags, public.contest_review_terpene_guesses,
    public.contest_review_votes, public.contest_tester_points,
    public.contest_profile_badges, public.contest_reward_unlocks,
    public.kq_notebook_reward_grants, public.kq_notebook_flower_reward_grants,
    public.kq_notebook_flower_reward_packs, public.kq_arena_tasting_transition_credits,
    public.kq_arena_leaderboard_snapshots IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.contest_notebook_reset_archive(reset_key, snapshot)
  SELECT v_key, jsonb_build_object(
    'contest_reviews', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.contest_reviews r),
    'contest_review_scores', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.contest_review_scores r),
    'contest_review_aroma_tags', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.contest_review_aroma_tags r),
    'contest_review_terpene_guesses', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.contest_review_terpene_guesses r),
    'contest_review_votes', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.contest_review_votes r),
    'contest_tester_points', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.contest_tester_points r),
    'contest_profile_badges', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.contest_profile_badges r),
    'contest_reward_unlocks', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.contest_reward_unlocks r),
    'kq_notebook_flower_reward_grants', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.kq_notebook_flower_reward_grants r),
    'kq_notebook_flower_reward_packs', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.kq_notebook_flower_reward_packs r),
    'kq_arena_tasting_transition_credits', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.kq_arena_tasting_transition_credits r),
    'kq_arena_leaderboard_snapshots', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM public.kq_arena_leaderboard_snapshots r)
  );

  -- A grant is also the idempotency receipt for an already-issued pack. Retain
  -- it when its test note disappears, on both older RESTRICT installations and
  -- newer CASCADE installations. A replacement note must not pay out again.
  ALTER TABLE public.kq_notebook_flower_reward_grants
    ALTER COLUMN review_id DROP NOT NULL,
    DROP CONSTRAINT kq_notebook_flower_reward_grants_review_id_fkey;
  ALTER TABLE public.kq_notebook_flower_reward_grants
    ADD CONSTRAINT kq_notebook_flower_reward_grants_review_id_fkey
    FOREIGN KEY (review_id) REFERENCES public.contest_reviews(id) ON DELETE SET NULL;

  -- Remove review-derived points before their review_id is SET NULL by the FK.
  -- Known reasons also cover old notes already deleted from the test database.
  -- Unrelated manual awards remain owned by the customer.
  DELETE FROM public.contest_tester_points
  WHERE review_id IS NOT NULL OR source_key LIKE 'review:%'
    OR reason IN ('review_approved', 'terpene_match', 'review_upvote_received',
      'review_downvote_received', 'admin_quality_useful', 'admin_quality_excellent');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('contest_tester_points', v_count);

  -- Keep claimed badges and game grant receipts to prevent paying a reward
  -- twice. Other tasting/voting/ranking badges no longer have a basis.
  DELETE FROM public.contest_profile_badges awarded
  USING public.contest_badges badge
  WHERE awarded.badge_id = badge.id
    AND awarded.reward_claimed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.kq_notebook_reward_grants receipt WHERE receipt.profile_badge_id = awarded.id)
    AND (awarded.review_id IS NOT NULL OR badge.code IN (
      'premier-carnet', 'gouteur-regulier', 'marathon-des-lots', 'premiere-piste',
      'combo-aromatique', 'nez-absolu', 'nez-divin', 'tour-de-saison',
      'expert-outdoor', 'expert-greenhouse', 'expert-indoor', 'critique-utile',
      'plume-dor', 'voix-respectee', 'validateur-serieux'
    ) OR badge.code LIKE 'jury-saisonnier-%');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('contest_profile_badges', v_count);

  DELETE FROM public.contest_reward_unlocks unlocked
  USING public.contest_rewards reward
  WHERE unlocked.reward_id = reward.id AND unlocked.status = 'unlocked'
    AND unlocked.claimed_at IS NULL AND reward.required_points > (
      SELECT COALESCE(SUM(points.points), 0) FROM public.contest_tester_points points
      WHERE points.customer_id = unlocked.customer_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('contest_reward_unlocks', v_count);

  -- Scores, aromas, terpene guesses, votes and legacy tasting eligibility
  -- credits cascade. The issued packs/cards, cash, purchase receipts, customers,
  -- orders, profiles, flower catalogue and seasons remain untouched.
  DELETE FROM public.contest_reviews;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('contest_reviews', v_count);

  -- Active rankings are recomputed on their next read using the preserved game
  -- data and empty Carnet. Closed snapshots remain historical reward evidence.
  DELETE FROM public.kq_arena_leaderboard_snapshots snapshot
  USING public.kq_seasons season
  WHERE snapshot.season_code = season.season_code AND season.status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('kq_arena_leaderboard_snapshots', v_count);

  UPDATE public.contest_notebook_reset_archive SET deleted_counts = v_counts
  WHERE reset_key = v_key;
END
$reset$;

COMMIT;
