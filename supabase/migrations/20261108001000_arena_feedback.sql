BEGIN;

-- Private inbox: server reads are scoped to the authenticated player or administrator.
-- Writes are available exclusively through the service-only transactional routines.
CREATE TABLE public.arena_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bug', 'idea')),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 4 AND 120),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 20 AND 4000),
  page_path TEXT CHECK (page_path IS NULL OR (char_length(page_path) <= 300
    AND page_path ~ '^/([^/?#[:space:]][^?#[:space:]]*)?$' AND position(chr(92) IN page_path) = 0)),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'resolved', 'declined')),
  reply TEXT CHECK (char_length(reply) <= 2000),
  reviewed_by TEXT,
  reward_packs INTEGER NOT NULL DEFAULT 0 CHECK (reward_packs BETWEEN 0 AND 5),
  reward_granted_at TIMESTAMPTZ,
  reward_granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id),
  CHECK ((reward_packs = 0 AND reward_granted_at IS NULL AND reward_granted_by IS NULL)
    OR (reward_packs > 0 AND reward_granted_at IS NOT NULL AND reward_granted_by IS NOT NULL))
);
CREATE INDEX arena_feedback_player_history ON public.arena_feedback(user_id, created_at DESC, id DESC);
CREATE INDEX arena_feedback_inbox ON public.arena_feedback(status, created_at DESC, id DESC);
ALTER TABLE public.arena_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.arena_feedback FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.arena_feedback TO service_role;

-- Keep every existing source. These gifts open through the usual Botte pack flow.
ALTER TABLE public.kq_support_booster_entitlements DROP CONSTRAINT kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements ADD CONSTRAINT kq_support_booster_entitlements_source_check CHECK (
  source IN ('ticket','arena_streak','notebook_badge','season_reward','points_purchase','welcome_pack',
    'pvp_win','notebook_flower','mission','achievement','pioneer_pack','contest_bundle','arena_feedback')
);

CREATE FUNCTION public.rpc_arena_submit_feedback(
  p_user_id UUID, p_request_id UUID, p_kind TEXT, p_subject TEXT, p_message TEXT, p_page_path TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE entry public.arena_feedback%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('bug','idea')
    OR p_subject IS NULL OR char_length(p_subject) NOT BETWEEN 4 AND 120 OR p_subject <> btrim(p_subject)
    OR position(chr(10) IN p_subject) > 0 OR position(chr(13) IN p_subject) > 0 OR position(chr(9) IN p_subject) > 0
    OR p_message IS NULL OR char_length(p_message) NOT BETWEEN 20 AND 4000 OR p_message <> btrim(p_message)
    OR (p_page_path IS NOT NULL AND (char_length(p_page_path) > 300
      OR p_page_path !~ '^/([^/?#[:space:]][^?#[:space:]]*)?$' OR position(chr(92) IN p_page_path) > 0))
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id)
    THEN RAISE EXCEPTION 'feedback_invalid'; END IF;

  -- Serialize quota checks and submissions for an account, including simultaneous tabs.
  PERFORM pg_advisory_xact_lock(hashtextextended('arena-feedback:' || p_user_id::TEXT, 0));
  SELECT * INTO entry FROM public.arena_feedback WHERE user_id = p_user_id AND request_id = p_request_id;
  IF FOUND THEN
    IF entry.kind <> p_kind OR entry.subject <> p_subject OR entry.message <> p_message
      OR entry.page_path IS DISTINCT FROM p_page_path THEN RAISE EXCEPTION 'feedback_request_conflict'; END IF;
    RETURN jsonb_build_object('item', to_jsonb(entry), 'replayed', true);
  END IF;
  -- Identical content with a fresh browser key also recovers the existing message.
  SELECT * INTO entry FROM public.arena_feedback WHERE user_id = p_user_id
    AND kind = p_kind AND subject = p_subject AND message = p_message AND page_path IS NOT DISTINCT FROM p_page_path
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('item', to_jsonb(entry), 'replayed', true); END IF;
  IF (SELECT count(*) FROM public.arena_feedback WHERE user_id = p_user_id AND created_at > now() - INTERVAL '24 hours') >= 5
    THEN RAISE EXCEPTION 'feedback_daily_limit'; END IF;
  IF EXISTS (SELECT 1 FROM public.arena_feedback WHERE user_id = p_user_id AND created_at > now() - INTERVAL '1 minute')
    THEN RAISE EXCEPTION 'feedback_cooldown'; END IF;
  INSERT INTO public.arena_feedback(user_id, request_id, kind, subject, message, page_path)
    VALUES(p_user_id, p_request_id, p_kind, p_subject, p_message, p_page_path) RETURNING * INTO entry;
  RETURN jsonb_build_object('item', to_jsonb(entry), 'replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_arena_submit_feedback(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_submit_feedback(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

CREATE FUNCTION public.rpc_arena_review_feedback(
  p_id UUID, p_status TEXT, p_reply TEXT, p_reward_packs INTEGER, p_reviewed_by TEXT,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE entry public.arena_feedback%ROWTYPE; granted BOOLEAN := false;
BEGIN
  IF p_id IS NULL OR p_status IS NULL OR p_status NOT IN ('new','reviewing','planned','resolved','declined')
    OR char_length(p_reply) > 2000 OR p_reward_packs IS NULL OR p_reward_packs NOT BETWEEN 0 AND 5
    OR p_reviewed_by IS NULL OR char_length(btrim(p_reviewed_by)) NOT BETWEEN 3 AND 320
    OR (p_reward_packs > 0 AND p_status IN ('new','declined')) THEN RAISE EXCEPTION 'feedback_invalid'; END IF;
  SELECT * INTO entry FROM public.arena_feedback WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'feedback_not_found'; END IF;
  IF p_reward_packs > 0 AND entry.reward_packs > 0 AND p_reward_packs <> entry.reward_packs
    THEN RAISE EXCEPTION 'feedback_reward_conflict'; END IF;
  -- Identical PATCH recovers after a lost response, even when carrying its old version.
  IF entry.status = p_status AND entry.reply IS NOT DISTINCT FROM nullif(btrim(p_reply), '')
    AND (p_reward_packs = 0 OR entry.reward_packs = p_reward_packs) THEN
    RETURN jsonb_build_object('item', to_jsonb(entry), 'rewardGranted', false);
  END IF;
  IF p_expected_updated_at IS NOT NULL AND entry.updated_at <> p_expected_updated_at
    THEN RAISE EXCEPTION 'feedback_changed'; END IF;

  IF p_reward_packs > 0 AND entry.reward_packs = 0 THEN
    -- An unexpected key collision fails the whole review, rather than hiding a partial gift.
    INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key, card_count)
      SELECT entry.user_id, 'arena_feedback', 'arena-feedback:' || entry.id::TEXT || ':' || n, 10
      FROM generate_series(1, p_reward_packs) n;
    granted := true;
  END IF;
  UPDATE public.arena_feedback SET status = p_status, reply = nullif(btrim(p_reply), ''), reviewed_by = p_reviewed_by,
    reward_packs = CASE WHEN granted THEN p_reward_packs ELSE reward_packs END,
    reward_granted_at = CASE WHEN granted THEN now() ELSE reward_granted_at END,
    reward_granted_by = CASE WHEN granted THEN p_reviewed_by ELSE reward_granted_by END,
    updated_at = clock_timestamp()
    WHERE id = p_id RETURNING * INTO entry;
  RETURN jsonb_build_object('item', to_jsonb(entry), 'rewardGranted', granted);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_arena_review_feedback(UUID, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_arena_review_feedback(UUID, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ) TO service_role;

COMMIT;
