BEGIN;

ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_shape_check;
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_check
  CHECK (source IN ('ticket', 'arena_streak', 'notebook_badge', 'season_reward', 'points_purchase'));
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_shape_check
  CHECK (
    (source = 'ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source IN ('arena_streak', 'notebook_badge', 'season_reward', 'points_purchase')
      AND ticket_id IS NULL AND reward_key IS NOT NULL)
  );

CREATE TABLE IF NOT EXISTS public.kq_support_points_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_count INTEGER NOT NULL CHECK (pack_count BETWEEN 1 AND 50),
  cost_points INTEGER NOT NULL CHECK (cost_points > 0),
  spendable_points_after INTEGER NOT NULL CHECK (spendable_points_after >= 0),
  entitlement_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_key)
);

ALTER TABLE public.kq_support_points_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY kq_support_points_purchases_read_own
  ON public.kq_support_points_purchases FOR SELECT USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.kq_support_points_purchases FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_kq_purchase_support_boosters_with_points(
  p_user_id UUID,
  p_request_key UUID,
  p_pack_count INTEGER,
  p_cost_per_pack INTEGER,
  p_base_points INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack_count INTEGER := COALESCE(p_pack_count, 0);
  v_cost_per_pack INTEGER := COALESCE(p_cost_per_pack, 0);
  v_base_points INTEGER := GREATEST(COALESCE(p_base_points, 0), 0);
  v_bonus_points INTEGER;
  v_spent_points INTEGER;
  v_spendable_points INTEGER;
  v_total_cost INTEGER;
  v_purchase_id UUID := gen_random_uuid();
  v_entitlement_ids JSONB := '[]'::JSONB;
  v_entitlement_id UUID;
  v_index INTEGER;
  v_existing public.kq_support_points_purchases%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_request_key IS NULL THEN RAISE EXCEPTION 'invalid_purchase_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':' || p_request_key::TEXT, 0));
  SELECT * INTO v_existing FROM public.kq_support_points_purchases
  WHERE user_id = p_user_id AND request_key = p_request_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'purchaseId', v_existing.id,
      'granted', v_existing.pack_count,
      'costPoints', v_existing.cost_points,
      'spendablePoints', v_existing.spendable_points_after,
      'entitlementIds', to_jsonb(v_existing.entitlement_ids),
      'replayed', TRUE
    );
  END IF;
  IF v_pack_count < 1 OR v_pack_count > 50 THEN RAISE EXCEPTION 'invalid_pack_count'; END IF;
  IF v_cost_per_pack < 1 OR v_cost_per_pack > 100000 THEN RAISE EXCEPTION 'invalid_cost_per_pack'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lottery_card_collections
    WHERE code = 'BOTTE_DU_CHANVRIER_2026' AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'support_collection_unavailable';
  END IF;

  SELECT GREATEST(COALESCE(loyalty_points, 0), 0),
    GREATEST(COALESCE(loyalty_points_spent, 0), 0)
  INTO v_bonus_points, v_spent_points
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer_not_found'; END IF;

  v_spendable_points := GREATEST(v_base_points + v_bonus_points - v_spent_points, 0);
  v_total_cost := v_pack_count * v_cost_per_pack;
  IF v_spendable_points < v_total_cost THEN RAISE EXCEPTION 'insufficient_points'; END IF;

  UPDATE public.profiles
  SET loyalty_points_spent = v_spent_points + v_total_cost
  WHERE id = p_user_id;

  FOR v_index IN 1..v_pack_count LOOP
    INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key)
    VALUES (p_user_id, 'points_purchase', 'points-purchase:' || v_purchase_id::TEXT || ':' || v_index::TEXT)
    RETURNING id INTO v_entitlement_id;
    v_entitlement_ids := v_entitlement_ids || jsonb_build_array(v_entitlement_id);
  END LOOP;

  INSERT INTO public.kq_support_points_purchases(
    id, request_key, user_id, pack_count, cost_points, spendable_points_after, entitlement_ids
  )
  VALUES (
    v_purchase_id, p_request_key, p_user_id, v_pack_count, v_total_cost,
    v_spendable_points - v_total_cost,
    ARRAY(SELECT jsonb_array_elements_text(v_entitlement_ids)::UUID)
  );

  INSERT INTO public.lottery_audit_log(event_type, user_id, details)
  VALUES ('kq_support_points_purchase', p_user_id, jsonb_build_object(
    'purchase_id', v_purchase_id,
    'pack_count', v_pack_count,
    'cost_per_pack', v_cost_per_pack,
    'total_cost', v_total_cost,
    'spendable_points_before', v_spendable_points,
    'spendable_points_after', v_spendable_points - v_total_cost,
    'entitlement_ids', v_entitlement_ids
  ));

  RETURN jsonb_build_object(
    'purchaseId', v_purchase_id,
    'granted', v_pack_count,
    'costPoints', v_total_cost,
    'spendablePoints', v_spendable_points - v_total_cost,
    'entitlementIds', v_entitlement_ids,
    'replayed', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_purchase_support_boosters_with_points(UUID, UUID, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_support_boosters_with_points(UUID, UUID, INTEGER, INTEGER, INTEGER)
  TO service_role;

COMMIT;
