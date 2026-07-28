BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_notebook_reward_rules (
  badge_code TEXT PRIMARY KEY,
  support_boosters INTEGER NOT NULL DEFAULT 0 CHECK (support_boosters BETWEEN 0 AND 10),
  culture_tokens INTEGER NOT NULL DEFAULT 0 CHECK (culture_tokens BETWEEN 0 AND 10),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (support_boosters > 0 OR culture_tokens > 0)
);

CREATE TABLE IF NOT EXISTS public.kq_notebook_reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_badge_id BIGINT NOT NULL UNIQUE REFERENCES public.contest_profile_badges(id) ON DELETE RESTRICT,
  badge_code TEXT NOT NULL REFERENCES public.kq_notebook_reward_rules(badge_code) ON DELETE RESTRICT,
  support_boosters INTEGER NOT NULL CHECK (support_boosters >= 0),
  culture_tokens INTEGER NOT NULL CHECK (culture_tokens >= 0),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kq_notebook_reward_grants_user
  ON public.kq_notebook_reward_grants(user_id, granted_at DESC);

ALTER TABLE public.kq_notebook_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_notebook_reward_grants ENABLE ROW LEVEL SECURITY;

INSERT INTO public.kq_notebook_reward_rules(badge_code, support_boosters, culture_tokens, is_active)
VALUES
  ('premier-carnet', 1, 1, FALSE),
  ('gouteur-regulier', 1, 2, FALSE),
  ('marathon-des-lots', 2, 3, FALSE),
  ('premiere-piste', 1, 0, FALSE),
  ('combo-aromatique', 1, 1, FALSE),
  ('nez-absolu', 2, 1, FALSE),
  ('nez-divin', 3, 2, FALSE),
  ('tour-de-saison', 1, 2, FALSE),
  ('expert-outdoor', 1, 1, FALSE),
  ('expert-greenhouse', 1, 1, FALSE),
  ('expert-indoor', 1, 1, FALSE),
  ('critique-utile', 0, 1, FALSE),
  ('plume-dor', 1, 2, FALSE),
  ('voix-respectee', 1, 1, FALSE),
  ('validateur-serieux', 0, 1, FALSE)
ON CONFLICT (badge_code) DO UPDATE SET
  support_boosters = EXCLUDED.support_boosters,
  culture_tokens = EXCLUDED.culture_tokens,
  is_active = FALSE,
  updated_at = now();

ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_source_check;
ALTER TABLE public.kq_support_booster_entitlements
  DROP CONSTRAINT IF EXISTS kq_support_booster_entitlements_check;
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_check
  CHECK (source IN ('ticket', 'arena_streak', 'notebook_badge'));
ALTER TABLE public.kq_support_booster_entitlements
  ADD CONSTRAINT kq_support_booster_entitlements_source_shape_check
  CHECK (
    (source = 'ticket' AND ticket_id IS NOT NULL AND reward_key IS NULL) OR
    (source IN ('arena_streak', 'notebook_badge') AND ticket_id IS NULL AND reward_key IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.rpc_kq_grant_notebook_badge_reward(
  p_user_id UUID,
  p_profile_badge_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge public.contest_profile_badges%ROWTYPE;
  v_badge_code TEXT;
  v_rule public.kq_notebook_reward_rules%ROWTYPE;
  v_grant public.kq_notebook_reward_grants%ROWTYPE;
  v_collection_active BOOLEAN := FALSE;
  v_index INTEGER;
  v_balance INTEGER;
BEGIN
  SELECT * INTO v_badge
  FROM public.contest_profile_badges
  WHERE id = p_profile_badge_id AND customer_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_notebook_badge_not_owned'; END IF;

  SELECT code INTO v_badge_code FROM public.contest_badges WHERE id = v_badge.badge_id;
  SELECT * INTO v_rule FROM public.kq_notebook_reward_rules
  WHERE badge_code = v_badge_code AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_notebook_rewards_inactive'; END IF;

  SELECT is_active INTO v_collection_active
  FROM public.lottery_card_collections
  WHERE code = 'BOTTE_DU_CHANVRIER_2026';
  IF COALESCE(v_collection_active, FALSE) = FALSE THEN
    RAISE EXCEPTION 'kq_notebook_rewards_inactive';
  END IF;

  SELECT * INTO v_grant FROM public.kq_notebook_reward_grants
  WHERE profile_badge_id = p_profile_badge_id;
  IF FOUND THEN
    SELECT COALESCE(balance, 0) INTO v_balance
    FROM public.kq_culture_token_wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('grant', to_jsonb(v_grant), 'cultureTokenBalance', v_balance, 'alreadyGranted', TRUE);
  END IF;

  INSERT INTO public.kq_notebook_reward_grants(
    user_id, profile_badge_id, badge_code, support_boosters, culture_tokens
  ) VALUES (
    p_user_id, p_profile_badge_id, v_rule.badge_code, v_rule.support_boosters, v_rule.culture_tokens
  )
  RETURNING * INTO v_grant;

  IF v_rule.culture_tokens > 0 THEN
    INSERT INTO public.kq_culture_token_wallets(user_id, balance)
    VALUES (p_user_id, v_rule.culture_tokens)
    ON CONFLICT (user_id) DO UPDATE SET
      balance = public.kq_culture_token_wallets.balance + EXCLUDED.balance,
      updated_at = now()
    RETURNING balance INTO v_balance;

    INSERT INTO public.kq_culture_token_ledger(user_id, amount, reason, reward_key)
    VALUES (
      p_user_id, v_rule.culture_tokens, 'notebook_badge',
      'notebook-badge:' || p_profile_badge_id::TEXT || ':tokens'
    );
  ELSE
    SELECT COALESCE(balance, 0) INTO v_balance
    FROM public.kq_culture_token_wallets WHERE user_id = p_user_id;
  END IF;

  FOR v_index IN 1..v_rule.support_boosters LOOP
    INSERT INTO public.kq_support_booster_entitlements(user_id, source, reward_key)
    VALUES (
      p_user_id, 'notebook_badge',
      'notebook-badge:' || p_profile_badge_id::TEXT || ':booster:' || v_index::TEXT
    );
  END LOOP;

  RETURN jsonb_build_object(
    'grant', to_jsonb(v_grant),
    'cultureTokenBalance', COALESCE(v_balance, 0),
    'alreadyGranted', FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_grant_notebook_badge_reward(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_grant_notebook_badge_reward(UUID, BIGINT)
  TO service_role;

COMMIT;
