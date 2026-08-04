BEGIN;

-- Only the two missions displayed in the tasting notebook may create rewards.
UPDATE public.kq_notebook_reward_rules
SET is_active = FALSE, updated_at = now();

INSERT INTO public.kq_notebook_reward_rules(
  badge_code, support_boosters, culture_tokens, is_active, updated_at
) VALUES
  ('premier-carnet', 1, 0, TRUE, now()),
  ('combo-aromatique', 1, 0, TRUE, now())
ON CONFLICT (badge_code) DO UPDATE SET
  support_boosters = EXCLUDED.support_boosters,
  culture_tokens = EXCLUDED.culture_tokens,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- A producer Heritage is deterministic and can be granted only once per
-- customer/campaign, after a paid purchase of an eligible flower.
ALTER TABLE public.kq_heritage_draws
  DROP CONSTRAINT IF EXISTS kq_heritage_draws_source_check;
ALTER TABLE public.kq_heritage_draws
  ADD CONSTRAINT kq_heritage_draws_source_check
  CHECK (source IN ('purchase', 'craft', 'producer_notebook', 'producer_purchase'));

ALTER TABLE public.kq_heritage_draws
  DROP CONSTRAINT IF EXISTS kq_heritage_draws_source_shape_check;
ALTER TABLE public.kq_heritage_draws
  ADD CONSTRAINT kq_heritage_draws_source_shape_check CHECK (
    (source = 'purchase' AND order_item_id IS NOT NULL AND unit_index IS NOT NULL AND craft_key IS NULL AND producer_campaign_id IS NULL)
    OR (source = 'craft' AND order_item_id IS NULL AND unit_index IS NULL AND craft_key IS NOT NULL AND producer_campaign_id IS NULL AND was_duplicate = FALSE)
    OR (source = 'producer_notebook' AND order_item_id IS NULL AND unit_index IS NULL AND craft_key IS NULL AND producer_campaign_id IS NOT NULL AND was_duplicate = FALSE)
    OR (source = 'producer_purchase' AND order_item_id IS NOT NULL AND unit_index IS NOT NULL AND craft_key IS NULL AND producer_campaign_id IS NOT NULL AND was_duplicate = FALSE)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_kq_heritage_producer_purchase_user
  ON public.kq_heritage_draws(user_id, producer_campaign_id)
  WHERE source = 'producer_purchase';

CREATE OR REPLACE FUNCTION public.rpc_kq_draw_heritage_for_purchase(
  p_user_id UUID,
  p_order_item_id BIGINT,
  p_unit_index INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.order_items%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_campaign public.kq_producer_reward_campaigns%ROWTYPE;
  v_existing public.kq_heritage_draws%ROWTYPE;
  v_draw public.kq_heritage_draws%ROWTYPE;
  v_grant public.kq_producer_heritage_reward_grants%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_order_item_id IS NULL OR p_unit_index < 1 THEN
    RAISE EXCEPTION 'kq_heritage_invalid_purchase';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':producer-purchase:' || p_order_item_id::TEXT, 0)
  );

  SELECT * INTO v_item FROM public.order_items
  WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND OR p_unit_index > v_item.quantity THEN
    RAISE EXCEPTION 'kq_heritage_invalid_purchase';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  IF NOT FOUND OR v_order.customer_id IS DISTINCT FROM p_user_id
    OR v_order.payment_state <> 'paid' OR v_order.status = 'cancelled'
  THEN
    RAISE EXCEPTION 'kq_heritage_purchase_not_paid';
  END IF;

  SELECT * INTO v_existing FROM public.kq_heritage_draws
  WHERE order_item_id = p_order_item_id AND unit_index = p_unit_index;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'kq_heritage_purchase_owner_mismatch';
    END IF;
    RETURN jsonb_build_object('draw', to_jsonb(v_existing), 'alreadyDrawn', TRUE);
  END IF;

  SELECT product.* INTO v_product
  FROM public.products product
  WHERE product.id = split_part(BTRIM(v_item.product_id), '::', 1)
    AND product.producer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.contest_entries entry
      WHERE entry.product_id = product.id AND entry.is_published = TRUE
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_purchase_not_eligible'; END IF;

  SELECT campaign.* INTO v_campaign
  FROM public.kq_producer_reward_campaigns campaign
  JOIN public.kq_heritage_card_definitions definition
    ON definition.code = campaign.heritage_code AND definition.is_active = TRUE
  WHERE campaign.producer_id = v_product.producer_id AND campaign.status = 'active'
  FOR UPDATE OF campaign;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_heritage_purchase_not_eligible'; END IF;

  SELECT * INTO v_grant FROM public.kq_producer_heritage_reward_grants
  WHERE user_id = p_user_id AND campaign_id = v_campaign.id;
  IF FOUND THEN
    SELECT * INTO v_draw FROM public.kq_heritage_draws WHERE id = v_grant.heritage_draw_id;
    RETURN jsonb_build_object('draw', to_jsonb(v_draw), 'alreadyDrawn', TRUE);
  END IF;

  INSERT INTO public.kq_heritage_draws(
    user_id, order_item_id, unit_index, card_code, rarity, seed,
    was_duplicate, source, craft_key, producer_campaign_id
  ) VALUES (
    p_user_id, p_order_item_id, p_unit_index, v_campaign.heritage_code, 'common', 0,
    FALSE, 'producer_purchase', NULL, v_campaign.id
  ) RETURNING * INTO v_draw;

  INSERT INTO public.kq_producer_heritage_reward_grants(
    user_id, campaign_id, producer_id, heritage_code, heritage_draw_id
  ) VALUES (
    p_user_id, v_campaign.id, v_campaign.producer_id, v_campaign.heritage_code, v_draw.id
  );

  RETURN jsonb_build_object('draw', to_jsonb(v_draw), 'alreadyDrawn', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_draw_heritage_for_purchase(UUID, BIGINT, INTEGER)
  TO service_role;

COMMIT;
