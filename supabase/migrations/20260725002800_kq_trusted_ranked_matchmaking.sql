BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_lock_ranked_battle(
  p_challenger_id UUID,
  p_flower_one_id UUID,
  p_flower_two_id UUID
)
RETURNS public.kq_battles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flower_one public.kq_flowers%ROWTYPE;
  v_flower_two public.kq_flowers%ROWTYPE;
  v_battle public.kq_battles%ROWTYPE;
  v_locked_count INTEGER;
  v_seed INTEGER;
BEGIN
  IF p_challenger_id IS NULL THEN RAISE EXCEPTION 'Challenger is required'; END IF;
  IF p_flower_one_id = p_flower_two_id THEN RAISE EXCEPTION 'Two distinct flowers are required'; END IF;

  PERFORM id FROM public.kq_flowers
  WHERE id IN (p_flower_one_id, p_flower_two_id)
  ORDER BY id
  FOR UPDATE;
  SELECT * INTO v_flower_one FROM public.kq_flowers WHERE id = p_flower_one_id;
  SELECT * INTO v_flower_two FROM public.kq_flowers WHERE id = p_flower_two_id;

  IF v_flower_one.id IS NULL OR v_flower_two.id IS NULL THEN RAISE EXCEPTION 'Flower unavailable'; END IF;
  IF v_flower_one.owner_id <> p_challenger_id THEN RAISE EXCEPTION 'Challenger does not own first flower'; END IF;
  IF v_flower_one.owner_id = v_flower_two.owner_id THEN RAISE EXCEPTION 'Players must be distinct'; END IF;
  IF v_flower_one.status <> 'available' OR v_flower_two.status <> 'available' THEN RAISE EXCEPTION 'Flower already used'; END IF;
  IF abs(v_flower_one.quality - v_flower_two.quality) > 8 THEN RAISE EXCEPTION 'Flowers outside matchmaking range'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.kq_battles
    WHERE status = 'verdict'
      AND locked_at >= now() - INTERVAL '24 hours'
      AND (
        (player_one_id = v_flower_one.owner_id AND player_two_id = v_flower_two.owner_id)
        OR
        (player_one_id = v_flower_two.owner_id AND player_two_id = v_flower_one.owner_id)
      )
  ) THEN
    RAISE EXCEPTION 'Ranked opponent cooldown';
  END IF;

  UPDATE public.kq_flowers SET status = 'locked', locked_at = now()
  WHERE id IN (p_flower_one_id, p_flower_two_id) AND status = 'available';
  GET DIAGNOSTICS v_locked_count = ROW_COUNT;
  IF v_locked_count <> 2 THEN RAISE EXCEPTION 'Could not lock both flowers'; END IF;

  v_seed := floor(random() * 2147483647)::INTEGER;
  INSERT INTO public.kq_battles (
    player_one_id, player_two_id, flower_one_id, flower_two_id, seed
  ) VALUES (
    v_flower_one.owner_id, v_flower_two.owner_id,
    v_flower_one.id, v_flower_two.id, v_seed
  ) RETURNING * INTO v_battle;
  RETURN v_battle;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_lock_ranked_battle(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_lock_ranked_battle(UUID, UUID, UUID)
  TO service_role;

-- All server callers now use the ownership- and quality-aware entry point.
REVOKE EXECUTE ON FUNCTION public.rpc_kq_lock_battle(UUID, UUID, INTEGER)
  FROM service_role;

COMMIT;
