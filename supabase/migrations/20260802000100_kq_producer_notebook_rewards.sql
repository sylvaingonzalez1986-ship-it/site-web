BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_producer_reward_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id TEXT NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,
  heritage_code TEXT NOT NULL REFERENCES public.kq_heritage_card_definitions(code) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (producer_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_producer_campaign_active_producer
  ON public.kq_producer_reward_campaigns(producer_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_producer_campaign_active_heritage
  ON public.kq_producer_reward_campaigns(heritage_code) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.kq_producer_reward_entries (
  campaign_id UUID NOT NULL REFERENCES public.kq_producer_reward_campaigns(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES public.contest_entries(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, entry_id)
);

CREATE TABLE IF NOT EXISTS public.kq_notebook_flower_reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES public.contest_entries(id) ON DELETE RESTRICT,
  review_id UUID NOT NULL UNIQUE REFERENCES public.contest_reviews(id) ON DELETE RESTRICT,
  producer_id TEXT NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,
  entitlement_id UUID NOT NULL UNIQUE REFERENCES public.kq_support_booster_entitlements(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_id)
);

CREATE TABLE IF NOT EXISTS public.kq_producer_heritage_reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.kq_producer_reward_campaigns(id) ON DELETE RESTRICT,
  producer_id TEXT NOT NULL REFERENCES public.producers(id) ON DELETE RESTRICT,
  heritage_code TEXT NOT NULL REFERENCES public.kq_heritage_card_definitions(code) ON DELETE RESTRICT,
  heritage_draw_id UUID NOT NULL UNIQUE REFERENCES public.kq_heritage_draws(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_kq_flower_rewards_user
  ON public.kq_notebook_flower_reward_grants(user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_kq_producer_heritage_rewards_user
  ON public.kq_producer_heritage_reward_grants(user_id, granted_at DESC);

ALTER TABLE public.kq_producer_reward_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_producer_reward_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_notebook_flower_reward_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_producer_heritage_reward_grants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_shape_check;
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_check
  CHECK (source IN ('ticket', 'arena_streak', 'notebook_badge', 'season_reward', 'points_purchase', 'welcome_pack', 'pvp_win', 'notebook_flower'));
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_shape_check
  CHECK (
    (source = 'ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source IN ('arena_streak', 'notebook_badge', 'season_reward', 'points_purchase', 'welcome_pack', 'pvp_win', 'notebook_flower')
      AND ticket_id IS NULL AND reward_key IS NOT NULL)
  );

ALTER TABLE public.kq_heritage_draws
  ADD COLUMN IF NOT EXISTS producer_campaign_id UUID
  REFERENCES public.kq_producer_reward_campaigns(id) ON DELETE RESTRICT;
ALTER TABLE public.kq_heritage_draws
  DROP CONSTRAINT IF EXISTS kq_heritage_draws_source_shape_check;
ALTER TABLE public.kq_heritage_draws
  ADD CONSTRAINT kq_heritage_draws_source_shape_check CHECK (
    (source = 'purchase' AND order_item_id IS NOT NULL AND unit_index IS NOT NULL AND craft_key IS NULL AND producer_campaign_id IS NULL)
    OR (source = 'craft' AND order_item_id IS NULL AND unit_index IS NULL AND craft_key IS NOT NULL AND producer_campaign_id IS NULL AND was_duplicate = FALSE)
    OR (source = 'producer_notebook' AND order_item_id IS NULL AND unit_index IS NULL AND craft_key IS NULL AND producer_campaign_id IS NOT NULL AND was_duplicate = FALSE)
  );
CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_heritage_producer_campaign_user
  ON public.kq_heritage_draws(user_id, producer_campaign_id)
  WHERE source = 'producer_notebook';

CREATE OR REPLACE FUNCTION public.rpc_kq_grant_producer_notebook_rewards(
  p_user_id UUID,
  p_review_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review public.contest_reviews%ROWTYPE;
  v_entry public.contest_entries%ROWTYPE;
  v_entitlement public.kq_support_booster_entitlements%ROWTYPE;
  v_flower_grant public.kq_notebook_flower_reward_grants%ROWTYPE;
  v_campaign RECORD;
  v_required INTEGER;
  v_completed INTEGER;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_heritage_codes JSONB := '[]'::JSONB;
  v_heritage_granted INTEGER := 0;
  v_flower_was_granted BOOLEAN := FALSE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':producer-notebook', 0));

  SELECT * INTO v_review FROM public.contest_reviews
  WHERE id = p_review_id AND customer_id = p_user_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_notebook_review_not_approved'; END IF;

  SELECT * INTO v_entry FROM public.contest_entries
  WHERE id = v_review.entry_id AND producer_id IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_notebook_entry_without_producer'; END IF;

  SELECT * INTO v_flower_grant FROM public.kq_notebook_flower_reward_grants
  WHERE user_id = p_user_id AND entry_id = v_entry.id;
  IF NOT FOUND THEN
    INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key, card_count)
    VALUES (p_user_id, 'notebook_flower', 'notebook-flower:' || p_user_id::TEXT || ':' || v_entry.id::TEXT, 10)
    ON CONFLICT (reward_key) DO UPDATE SET reward_key = EXCLUDED.reward_key
    RETURNING * INTO v_entitlement;

    INSERT INTO public.kq_notebook_flower_reward_grants(
      user_id, entry_id, review_id, producer_id, entitlement_id
    ) VALUES (p_user_id, v_entry.id, v_review.id, v_entry.producer_id, v_entitlement.id)
    ON CONFLICT (user_id, entry_id) DO NOTHING
    RETURNING * INTO v_flower_grant;
    v_flower_was_granted := FOUND;
  END IF;

  FOR v_campaign IN
    SELECT campaign.id, campaign.producer_id, campaign.heritage_code, definition.rarity
    FROM public.kq_producer_reward_campaigns campaign
    JOIN public.kq_heritage_card_definitions definition ON definition.code = campaign.heritage_code
    WHERE campaign.producer_id = v_entry.producer_id
      AND campaign.status = 'active'
      AND definition.is_active = TRUE
  LOOP
    SELECT COUNT(*) INTO v_required
    FROM public.kq_producer_reward_entries required_entry
    WHERE required_entry.campaign_id = v_campaign.id;
    IF v_required = 0 THEN CONTINUE; END IF;

    SELECT COUNT(DISTINCT required_entry.entry_id) INTO v_completed
    FROM public.kq_producer_reward_entries required_entry
    JOIN public.contest_reviews review
      ON review.entry_id = required_entry.entry_id
      AND review.customer_id = p_user_id
      AND review.status = 'approved'
    WHERE required_entry.campaign_id = v_campaign.id;
    IF v_completed <> v_required THEN CONTINUE; END IF;

    SELECT * INTO v_draw FROM public.kq_heritage_draws
    WHERE user_id = p_user_id AND producer_campaign_id = v_campaign.id;
    IF NOT FOUND THEN
      INSERT INTO public.kq_heritage_draws(
        user_id, order_item_id, unit_index, card_code, rarity, seed,
        was_duplicate, source, craft_key, producer_campaign_id
      ) VALUES (
        p_user_id, NULL, NULL, v_campaign.heritage_code, v_campaign.rarity,
        0, FALSE, 'producer_notebook', NULL, v_campaign.id
      ) RETURNING * INTO v_draw;

      INSERT INTO public.kq_producer_heritage_reward_grants(
        user_id, campaign_id, producer_id, heritage_code, heritage_draw_id
      ) VALUES (
        p_user_id, v_campaign.id, v_campaign.producer_id, v_campaign.heritage_code, v_draw.id
      ) ON CONFLICT (user_id, campaign_id) DO NOTHING;
      v_heritage_granted := v_heritage_granted + 1;
      v_heritage_codes := v_heritage_codes || to_jsonb(v_campaign.heritage_code::TEXT);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'flowerBoosterGranted', v_flower_was_granted,
    'boosterCardCount', CASE WHEN v_flower_was_granted THEN 10 ELSE 0 END,
    'heritageGranted', v_heritage_granted,
    'heritageCodes', v_heritage_codes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_configure_producer_reward_campaign(
  p_producer_id TEXT,
  p_heritage_code TEXT,
  p_entry_ids TEXT[],
  p_activate BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.kq_producer_reward_campaigns%ROWTYPE;
  v_version INTEGER;
  v_entry_id TEXT;
BEGIN
  IF COALESCE(BTRIM(p_producer_id), '') = '' OR COALESCE(array_length(p_entry_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'kq_producer_campaign_invalid';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('producer-campaign:' || p_producer_id, 0));
  IF NOT EXISTS (SELECT 1 FROM public.producers WHERE id = p_producer_id) THEN
    RAISE EXCEPTION 'kq_producer_campaign_unknown_producer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kq_heritage_card_definitions WHERE code = p_heritage_code) THEN
    RAISE EXCEPTION 'kq_producer_campaign_unknown_heritage';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_entry_ids) requested(entry_id)
    LEFT JOIN public.contest_entries entry ON entry.id = requested.entry_id
    WHERE entry.id IS NULL OR entry.producer_id IS DISTINCT FROM p_producer_id OR entry.is_published = FALSE
  ) THEN
    RAISE EXCEPTION 'kq_producer_campaign_invalid_entry';
  END IF;

  SELECT * INTO v_campaign FROM public.kq_producer_reward_campaigns
  WHERE producer_id = p_producer_id AND status = 'draft'
  ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
    FROM public.kq_producer_reward_campaigns WHERE producer_id = p_producer_id;
    INSERT INTO public.kq_producer_reward_campaigns(producer_id, heritage_code, version)
    VALUES (p_producer_id, p_heritage_code, v_version) RETURNING * INTO v_campaign;
  ELSE
    UPDATE public.kq_producer_reward_campaigns
    SET heritage_code = p_heritage_code, updated_at = now()
    WHERE id = v_campaign.id RETURNING * INTO v_campaign;
  END IF;

  DELETE FROM public.kq_producer_reward_entries WHERE campaign_id = v_campaign.id;
  FOREACH v_entry_id IN ARRAY p_entry_ids LOOP
    INSERT INTO public.kq_producer_reward_entries(campaign_id, entry_id, position)
    VALUES (v_campaign.id, v_entry_id, array_position(p_entry_ids, v_entry_id));
  END LOOP;

  IF p_activate THEN
    UPDATE public.kq_producer_reward_campaigns SET status = 'archived', updated_at = now()
    WHERE producer_id = p_producer_id AND status = 'active';
    UPDATE public.kq_heritage_card_definitions SET is_active = TRUE, updated_at = now()
    WHERE code = p_heritage_code;
    UPDATE public.kq_producer_reward_campaigns SET status = 'active', updated_at = now()
    WHERE id = v_campaign.id RETURNING * INTO v_campaign;
  END IF;

  RETURN jsonb_build_object(
    'id', v_campaign.id, 'producerId', v_campaign.producer_id,
    'heritageCode', v_campaign.heritage_code, 'version', v_campaign.version,
    'status', v_campaign.status, 'entryIds', to_jsonb(p_entry_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_configure_producer_reward_campaign(TEXT, TEXT, TEXT[], BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_configure_producer_reward_campaign(TEXT, TEXT, TEXT[], BOOLEAN)
  TO service_role;

COMMIT;
