BEGIN;

ALTER TABLE public.kq_rank_profiles
  ADD COLUMN IF NOT EXISTS arena_experience NUMERIC(10,1) NOT NULL DEFAULT 0
  CHECK (arena_experience >= 0);

CREATE TABLE IF NOT EXISTS public.kq_bot_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flower_id UUID NOT NULL UNIQUE REFERENCES public.kq_flowers(id) ON DELETE RESTRICT,
  bot_code TEXT NOT NULL,
  bot_flower JSONB NOT NULL,
  seed INTEGER NOT NULL,
  rounds JSONB NOT NULL,
  winner TEXT NOT NULL CHECK (winner IN ('player', 'opponent')),
  experience_awarded NUMERIC(3,1) NOT NULL DEFAULT 0.1 CHECK (experience_awarded = 0.1),
  verdict_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kq_bot_battles_user_daily
  ON public.kq_bot_battles(user_id, verdict_at DESC);

ALTER TABLE public.kq_bot_battles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.kq_arena_experience_receipts (
  battle_id UUID NOT NULL REFERENCES public.kq_battles(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(3,1) NOT NULL CHECK (amount = 1.0),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (battle_id, user_id)
);
ALTER TABLE public.kq_arena_experience_receipts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rpc_kq_award_human_battle_experience(
  p_battle_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.kq_battles%ROWTYPE;
  v_user_id UUID;
  v_granted INTEGER := 0;
BEGIN
  SELECT * INTO v_battle FROM public.kq_battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND OR v_battle.status <> 'verdict' THEN RAISE EXCEPTION 'kq_battle_not_final'; END IF;
  FOREACH v_user_id IN ARRAY ARRAY[v_battle.player_one_id, v_battle.player_two_id] LOOP
    INSERT INTO public.kq_arena_experience_receipts (battle_id, user_id, amount)
    VALUES (p_battle_id, v_user_id, 1.0)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN
      UPDATE public.kq_rank_profiles
      SET arena_experience = arena_experience + 1.0, updated_at = now()
      WHERE user_id = v_user_id;
      v_granted := v_granted + 1;
    END IF;
  END LOOP;
  RETURN v_granted;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_finalize_bot_battle(
  p_user_id UUID,
  p_flower_id UUID,
  p_bot_code TEXT,
  p_bot_flower JSONB,
  p_seed INTEGER,
  p_rounds JSONB,
  p_winner TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flower public.kq_flowers%ROWTYPE;
  v_battle public.kq_bot_battles%ROWTYPE;
  v_today_start TIMESTAMPTZ;
  v_today_count INTEGER;
  v_season TEXT;
BEGIN
  IF p_user_id IS NULL OR p_flower_id IS NULL OR COALESCE(BTRIM(p_bot_code), '') = ''
    OR p_bot_flower IS NULL OR p_rounds IS NULL OR JSONB_ARRAY_LENGTH(p_rounds) <> 3
    OR p_winner NOT IN ('player', 'opponent')
  THEN RAISE EXCEPTION 'kq_invalid_bot_battle'; END IF;

  v_today_start := ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::DATE AT TIME ZONE 'Europe/Paris');
  SELECT COUNT(*) INTO v_today_count FROM public.kq_bot_battles
  WHERE user_id = p_user_id AND verdict_at >= v_today_start;
  IF v_today_count >= 10 THEN RAISE EXCEPTION 'kq_bot_daily_limit'; END IF;

  SELECT * INTO v_flower FROM public.kq_flowers
  WHERE id = p_flower_id AND owner_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_flower.status <> 'available' THEN RAISE EXCEPTION 'kq_flower_unavailable'; END IF;

  INSERT INTO public.kq_bot_battles (
    user_id, flower_id, bot_code, bot_flower, seed, rounds, winner
  ) VALUES (
    p_user_id, p_flower_id, p_bot_code, p_bot_flower, p_seed, p_rounds, p_winner
  ) RETURNING * INTO v_battle;

  UPDATE public.kq_flowers
  SET status = 'burned', locked_at = v_battle.verdict_at, burned_at = v_battle.verdict_at
  WHERE id = p_flower_id;

  v_season := public.kq_active_season_code();
  INSERT INTO public.kq_rank_profiles (user_id, season_code, arena_experience, burned_flowers)
  VALUES (p_user_id, v_season, 0.1, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET arena_experience = public.kq_rank_profiles.arena_experience + 0.1,
      burned_flowers = public.kq_rank_profiles.burned_flowers + 1,
      updated_at = now();

  RETURN jsonb_build_object(
    'battleId', v_battle.id,
    'verdictAt', v_battle.verdict_at,
    'winner', v_battle.winner,
    'rounds', v_battle.rounds,
    'experienceAwarded', v_battle.experience_awarded,
    'todayCount', v_today_count + 1,
    'dailyLimit', 10
  );
END;
$$;

REVOKE ALL ON TABLE public.kq_bot_battles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.kq_arena_experience_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_kq_finalize_bot_battle(UUID, UUID, TEXT, JSONB, INTEGER, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_bot_battle(UUID, UUID, TEXT, JSONB, INTEGER, JSONB, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_award_human_battle_experience(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_award_human_battle_experience(UUID)
  TO service_role;

COMMIT;
