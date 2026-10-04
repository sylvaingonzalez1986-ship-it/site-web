BEGIN;

-- Public tasting data is served by Next.js, which removes customer IDs and
-- internal moderation fields. No browser role may bypass that boundary.
-- Reset legacy/default grants, including service_role, before granting exactly
-- the direct operations used by the server. RLS remains enabled as before.
REVOKE ALL ON TABLE
  public.contest_seasons,
  public.contest_entries,
  public.contest_profiles,
  public.contest_reviews,
  public.contest_review_scores,
  public.contest_review_aroma_tags,
  public.contest_review_terpene_guesses,
  public.contest_tester_points,
  public.contest_badges,
  public.contest_profile_badges,
  public.contest_rewards,
  public.contest_reward_unlocks,
  public.contest_beta_testers,
  public.contest_review_votes,
  public.contest_entry_stats,
  public.contest_rankings_current,
  public.contest_review_vote_summary,
  public.contest_tester_points_summary,
  public.contest_tester_rankings_global,
  public.contest_tester_rankings_by_season
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.contest_seasons,
  public.contest_profiles,
  public.contest_badges,
  public.contest_beta_testers,
  public.contest_review_votes
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.contest_entries,
  public.contest_tester_points
TO service_role;

GRANT SELECT, INSERT, DELETE ON TABLE public.contest_profile_badges TO service_role;
GRANT SELECT, UPDATE ON TABLE public.contest_reviews TO service_role;

-- Review collections are written only by SECURITY DEFINER atomic RPCs.
-- Every underlying relation of the security-invoker views is granted here or
-- above: entries, seasons, profiles, reviews, scores, aromas, guesses, votes,
-- points and the intermediate vote/point summaries. Reward tables stay private.
GRANT SELECT ON TABLE
  public.contest_review_scores,
  public.contest_review_aroma_tags,
  public.contest_review_terpene_guesses,
  public.contest_entry_stats,
  public.contest_rankings_current,
  public.contest_review_vote_summary,
  public.contest_tester_points_summary,
  public.contest_tester_rankings_global,
  public.contest_tester_rankings_by_season
TO service_role;

REVOKE ALL ON SEQUENCE
  public.contest_review_scores_id_seq,
  public.contest_review_aroma_tags_id_seq,
  public.contest_review_terpene_guesses_id_seq,
  public.contest_tester_points_id_seq,
  public.contest_profile_badges_id_seq,
  public.contest_reward_unlocks_id_seq,
  public.contest_review_votes_id_seq
FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SEQUENCE
  public.contest_tester_points_id_seq,
  public.contest_profile_badges_id_seq,
  public.contest_review_votes_id_seq
TO service_role;

REVOKE ALL ON FUNCTION public.rpc_create_contest_review_atomic(text, text, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_update_contest_review_atomic(uuid, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_claim_contest_badge_reward(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_create_contest_review_atomic(text, text, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_update_contest_review_atomic(uuid, uuid, text, public.contest_consumption_method, text, text, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_claim_contest_badge_reward(uuid, text) TO service_role;

-- PostgREST ILIKE interprets _, % and * as patterns. Use SQL equality so an
-- authenticated customer's verified email can only unlock its exact guest
-- orders, while preserving case-insensitive historical addresses. Invoker
-- security also requires the server's existing SELECT grant on public.orders.
CREATE OR REPLACE FUNCTION public.rpc_get_contest_paid_guest_orders(
  p_email text,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (id text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT orders.id, orders.created_at
  FROM public.orders AS orders
  WHERE orders.customer_id IS NULL
    AND orders.payment_state = 'paid'
    AND orders.status <> 'cancelled'
    AND NULLIF(trim(p_email), '') IS NOT NULL
    AND lower(orders.customer_email) = lower(trim(p_email))
  ORDER BY orders.created_at DESC, orders.id
  LIMIT greatest(1, least(coalesce(p_limit, 200), 200));
$$;

REVOKE ALL ON FUNCTION public.rpc_get_contest_paid_guest_orders(text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_contest_paid_guest_orders(text, integer) TO service_role;

COMMIT;
