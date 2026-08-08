BEGIN;

-- A contest flower grants five independently openable La Botte packs.  The
-- parent grant keeps the historical first entitlement while this child table
-- records every pack explicitly, making retries and partial openings safe.
CREATE TABLE IF NOT EXISTS public.kq_notebook_flower_reward_packs (
  flower_grant_id UUID NOT NULL
    REFERENCES public.kq_notebook_flower_reward_grants(id) ON DELETE CASCADE,
  pack_index SMALLINT NOT NULL CHECK (pack_index BETWEEN 1 AND 5),
  entitlement_id UUID NOT NULL UNIQUE
    REFERENCES public.kq_support_booster_entitlements(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flower_grant_id, pack_index)
);

CREATE INDEX IF NOT EXISTS idx_kq_notebook_flower_reward_packs_grant
  ON public.kq_notebook_flower_reward_packs(flower_grant_id, pack_index);

ALTER TABLE public.kq_notebook_flower_reward_packs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_notebook_flower_reward_packs
  FROM PUBLIC, anon, authenticated;

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
  v_campaign_found BOOLEAN := FALSE;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_grant public.kq_producer_heritage_reward_grants%ROWTYPE;
  v_pack_index INTEGER;
  v_inserted INTEGER := 0;
  v_packs_granted INTEGER := 0;
  v_packs_total INTEGER := 0;
  v_heritage_granted INTEGER := 0;
  v_heritage_codes JSONB := '[]'::JSONB;
BEGIN
  IF p_user_id IS NULL OR p_review_id IS NULL THEN
    RAISE EXCEPTION 'kq_notebook_reward_invalid';
  END IF;

  SELECT * INTO v_review
  FROM public.contest_reviews
  WHERE id = p_review_id
    AND customer_id = p_user_id
    AND status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'kq_notebook_review_not_approved';
  END IF;

  SELECT * INTO v_entry
  FROM public.contest_entries
  WHERE id = v_review.entry_id
    AND producer_id IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'flowerBoosterGranted', FALSE,
      'flowerBoostersGranted', 0,
      'flowerBoostersTotal', 0,
      'boosterCardCount', 0,
      'heritageGranted', 0,
      'heritageCodes', '[]'::JSONB
    );
  END IF;

  -- Packs are a contest-flower reward, not a purchase reward and not a reward
  -- for regular flowers. The per-flower lock serializes approval retries.
  IF v_entry.track = 'concours' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_user_id::TEXT || ':notebook-flower:' || v_entry.id::TEXT, 0)
    );

    SELECT * INTO v_flower_grant
    FROM public.kq_notebook_flower_reward_grants
    WHERE user_id = p_user_id
      AND entry_id = v_entry.id;

    IF NOT FOUND THEN
      INSERT INTO public.kq_support_booster_entitlements(
        user_id, source, reward_key, card_count
      ) VALUES (
        p_user_id,
        'notebook_flower',
        'notebook-flower:' || p_user_id::TEXT || ':' || v_entry.id::TEXT,
        10
      )
      ON CONFLICT (reward_key) DO UPDATE
        SET reward_key = EXCLUDED.reward_key
      RETURNING * INTO v_entitlement;

      INSERT INTO public.kq_notebook_flower_reward_grants(
        user_id, entry_id, review_id, producer_id, entitlement_id
      ) VALUES (
        p_user_id, v_entry.id, v_review.id, v_entry.producer_id, v_entitlement.id
      )
      ON CONFLICT (user_id, entry_id) DO NOTHING
      RETURNING * INTO v_flower_grant;

      IF NOT FOUND THEN
        SELECT * INTO v_flower_grant
        FROM public.kq_notebook_flower_reward_grants
        WHERE user_id = p_user_id
          AND entry_id = v_entry.id;
      END IF;
    END IF;

    INSERT INTO public.kq_notebook_flower_reward_packs(
      flower_grant_id, pack_index, entitlement_id
    ) VALUES (
      v_flower_grant.id, 1, v_flower_grant.entitlement_id
    )
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_packs_granted := v_packs_granted + v_inserted;

    FOR v_pack_index IN 2..5 LOOP
      INSERT INTO public.kq_support_booster_entitlements(
        user_id, source, reward_key, card_count
      ) VALUES (
        p_user_id,
        'notebook_flower',
        'notebook-flower:' || p_user_id::TEXT || ':' || v_entry.id::TEXT
          || ':pack:' || v_pack_index::TEXT,
        10
      )
      ON CONFLICT (reward_key) DO UPDATE
        SET reward_key = EXCLUDED.reward_key
      RETURNING * INTO v_entitlement;

      INSERT INTO public.kq_notebook_flower_reward_packs(
        flower_grant_id, pack_index, entitlement_id
      ) VALUES (
        v_flower_grant.id, v_pack_index, v_entitlement.id
      )
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_packs_granted := v_packs_granted + v_inserted;
    END LOOP;

    SELECT COUNT(*) INTO v_packs_total
    FROM public.kq_notebook_flower_reward_packs
    WHERE flower_grant_id = v_flower_grant.id;
  END IF;

  -- Heritage remains one permanent card per customer and producer campaign.
  SELECT campaign.id, campaign.producer_id, campaign.heritage_code, definition.rarity
  INTO v_campaign
  FROM public.kq_producer_reward_campaigns campaign
  JOIN public.kq_producer_reward_entries campaign_entry
    ON campaign_entry.campaign_id = campaign.id
    AND campaign_entry.entry_id = v_entry.id
  JOIN public.kq_heritage_card_definitions definition
    ON definition.code = campaign.heritage_code
    AND definition.is_active = TRUE
  WHERE campaign.producer_id = v_entry.producer_id
    AND campaign.status = 'active';
  v_campaign_found := FOUND;

  IF v_campaign_found THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_user_id::TEXT || ':producer-heritage:' || v_campaign.id::TEXT, 0)
    );

    SELECT * INTO v_grant
    FROM public.kq_producer_heritage_reward_grants
    WHERE user_id = p_user_id
      AND campaign_id = v_campaign.id;

    IF NOT FOUND THEN
      INSERT INTO public.kq_heritage_draws(
        user_id, order_item_id, unit_index, card_code, rarity, seed,
        was_duplicate, source, craft_key, producer_campaign_id
      ) VALUES (
        p_user_id, NULL, NULL, v_campaign.heritage_code, v_campaign.rarity, 0,
        FALSE, 'producer_notebook', NULL, v_campaign.id
      )
      RETURNING * INTO v_draw;

      INSERT INTO public.kq_producer_heritage_reward_grants(
        user_id, campaign_id, producer_id, heritage_code, heritage_draw_id
      ) VALUES (
        p_user_id, v_campaign.id, v_campaign.producer_id,
        v_campaign.heritage_code, v_draw.id
      );
      v_heritage_granted := 1;
      v_heritage_codes := jsonb_build_array(v_campaign.heritage_code);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'flowerBoosterGranted', v_packs_granted > 0,
    'flowerBoostersGranted', v_packs_granted,
    'flowerBoostersTotal', v_packs_total,
    'boosterCardCount', v_packs_granted * 10,
    'heritageGranted', v_heritage_granted,
    'heritageCodes', v_heritage_codes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_producer_notebook_rewards(UUID, UUID)
  TO service_role;

-- Reconcile every already-approved contest review. This also maps the original
-- single pack as pack 1 and tops old grants up to five without duplicating any.
DO $$
DECLARE
  v_reward RECORD;
BEGIN
  FOR v_reward IN
    SELECT DISTINCT ON (review.customer_id, review.entry_id)
      review.customer_id,
      review.id AS review_id
    FROM public.contest_reviews review
    JOIN public.contest_entries entry
      ON entry.id = review.entry_id
    WHERE review.status = 'approved'
      AND entry.track = 'concours'
      AND entry.producer_id IS NOT NULL
    ORDER BY review.customer_id, review.entry_id, review.created_at, review.id
  LOOP
    PERFORM public.rpc_kq_grant_producer_notebook_rewards(
      v_reward.customer_id,
      v_reward.review_id
    );
  END LOOP;
END;
$$;

COMMIT;
