BEGIN;

CREATE TABLE IF NOT EXISTS public.kq_random_battle_queue (
  flower_id UUID PRIMARY KEY REFERENCES public.kq_flowers(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kq_random_battle_queue_waiting
  ON public.kq_random_battle_queue(queued_at, flower_id);

ALTER TABLE public.kq_random_battle_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_random_battle_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kq_random_battle_queue TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_kq_enqueue_random_battle(
  p_player_id UUID,
  p_flower_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flower public.kq_flowers%ROWTYPE;
  v_existing public.kq_random_battle_queue%ROWTYPE;
  v_candidate_flower_id UUID;
  v_candidate public.kq_flowers%ROWTYPE;
  v_battle public.kq_battles%ROWTYPE;
  v_seed INTEGER;
  v_updated INTEGER;
BEGIN
  IF p_player_id IS NULL OR p_flower_id IS NULL THEN
    RAISE EXCEPTION 'kq_random_queue_invalid';
  END IF;

  SELECT * INTO v_flower
  FROM public.kq_flowers
  WHERE id = p_flower_id AND owner_id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'kq_random_queue_flower_not_owned'; END IF;

  SELECT * INTO v_existing
  FROM public.kq_random_battle_queue
  WHERE owner_id = p_player_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.flower_id = p_flower_id AND v_flower.status = 'locked' THEN
      RETURN jsonb_build_object(
        'matchStatus', 'queued',
        'flowerId', v_existing.flower_id,
        'queuedAt', v_existing.queued_at,
        'replayed', TRUE
      );
    END IF;
    RAISE EXCEPTION 'kq_random_queue_owner_already_waiting';
  END IF;

  IF v_flower.status <> 'available' THEN
    RAISE EXCEPTION 'kq_random_queue_flower_unavailable';
  END IF;

  SELECT queue_entry.flower_id INTO v_candidate_flower_id
  FROM public.kq_random_battle_queue AS queue_entry
  JOIN public.kq_flowers AS candidate_flower
    ON candidate_flower.id = queue_entry.flower_id
  WHERE queue_entry.owner_id <> p_player_id
    AND candidate_flower.owner_id = queue_entry.owner_id
    AND candidate_flower.status = 'locked'
    AND candidate_flower.burned_at IS NULL
    AND abs(candidate_flower.quality - v_flower.quality) <= 8
    AND NOT EXISTS (
      SELECT 1
      FROM public.kq_battles AS active_battle
      WHERE active_battle.status = 'locked'
        AND queue_entry.flower_id IN (active_battle.flower_one_id, active_battle.flower_two_id)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.kq_battles AS recent_battle
      WHERE recent_battle.status = 'verdict'
        AND recent_battle.locked_at >= now() - INTERVAL '24 hours'
        AND (
          (recent_battle.player_one_id = p_player_id AND recent_battle.player_two_id = queue_entry.owner_id)
          OR
          (recent_battle.player_one_id = queue_entry.owner_id AND recent_battle.player_two_id = p_player_id)
        )
    )
  ORDER BY random()
  LIMIT 1
  FOR UPDATE OF queue_entry, candidate_flower SKIP LOCKED;

  IF v_candidate_flower_id IS NULL THEN
    UPDATE public.kq_flowers
    SET status = 'locked', locked_at = now()
    WHERE id = v_flower.id AND status = 'available';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN RAISE EXCEPTION 'kq_random_queue_flower_unavailable'; END IF;

    INSERT INTO public.kq_random_battle_queue(flower_id, owner_id)
    VALUES (v_flower.id, p_player_id)
    RETURNING * INTO v_existing;

    RETURN jsonb_build_object(
      'matchStatus', 'queued',
      'flowerId', v_existing.flower_id,
      'queuedAt', v_existing.queued_at,
      'replayed', FALSE
    );
  END IF;

  SELECT * INTO v_candidate
  FROM public.kq_flowers
  WHERE id = v_candidate_flower_id;

  DELETE FROM public.kq_random_battle_queue
  WHERE flower_id = v_candidate.id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'kq_random_queue_candidate_taken'; END IF;

  UPDATE public.kq_flowers
  SET status = 'locked', locked_at = now()
  WHERE id = v_flower.id AND status = 'available';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'kq_random_queue_flower_unavailable'; END IF;

  UPDATE public.kq_flowers
  SET locked_at = now()
  WHERE id = v_candidate.id AND status = 'locked' AND burned_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'kq_random_queue_candidate_taken'; END IF;

  v_seed := floor(random() * 2147483647)::INTEGER;
  INSERT INTO public.kq_battles (
    player_one_id,
    player_two_id,
    flower_one_id,
    flower_two_id,
    seed
  ) VALUES (
    v_candidate.owner_id,
    v_flower.owner_id,
    v_candidate.id,
    v_flower.id,
    v_seed
  ) RETURNING * INTO v_battle;

  RETURN jsonb_build_object(
    'matchStatus', 'matched',
    'battleId', v_battle.id,
    'flowerId', v_flower.id,
    'opponentFlowerId', v_candidate.id,
    'seed', v_battle.seed,
    'status', v_battle.status,
    'matchedAt', v_battle.locked_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_kq_leave_random_battle_queue(
  p_player_id UUID,
  p_flower_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue public.kq_random_battle_queue%ROWTYPE;
  v_flower public.kq_flowers%ROWTYPE;
  v_updated INTEGER;
BEGIN
  IF p_player_id IS NULL OR p_flower_id IS NULL THEN
    RAISE EXCEPTION 'kq_random_queue_invalid';
  END IF;

  SELECT * INTO v_queue
  FROM public.kq_random_battle_queue
  WHERE flower_id = p_flower_id AND owner_id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.kq_battles
      WHERE status = 'locked'
        AND p_flower_id IN (flower_one_id, flower_two_id)
    ) THEN
      RAISE EXCEPTION 'kq_random_queue_already_matched';
    END IF;
    RETURN jsonb_build_object('left', FALSE, 'flowerId', p_flower_id, 'replayed', TRUE);
  END IF;

  SELECT * INTO v_flower
  FROM public.kq_flowers
  WHERE id = p_flower_id AND owner_id = p_player_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kq_random_queue_flower_not_owned'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.kq_battles
    WHERE status = 'locked'
      AND p_flower_id IN (flower_one_id, flower_two_id)
  ) THEN
    RAISE EXCEPTION 'kq_random_queue_already_matched';
  END IF;

  DELETE FROM public.kq_random_battle_queue
  WHERE flower_id = p_flower_id AND owner_id = p_player_id;

  UPDATE public.kq_flowers
  SET status = 'available', locked_at = NULL
  WHERE id = p_flower_id AND owner_id = p_player_id
    AND status = 'locked' AND burned_at IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'kq_random_queue_flower_unavailable'; END IF;

  RETURN jsonb_build_object('left', TRUE, 'flowerId', p_flower_id, 'replayed', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_enqueue_random_battle(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_enqueue_random_battle(UUID, UUID)
  TO service_role;

REVOKE ALL ON FUNCTION public.rpc_kq_leave_random_battle_queue(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_leave_random_battle_queue(UUID, UUID)
  TO service_role;

COMMENT ON TABLE public.kq_random_battle_queue IS
  'One anonymous ranked Flower stake per player. The opponent is selected server-side at random.';
COMMENT ON FUNCTION public.rpc_kq_enqueue_random_battle(UUID, UUID) IS
  'Queues one owned Flower or atomically pairs it with a random compatible waiting Flower.';
COMMENT ON FUNCTION public.rpc_kq_leave_random_battle_queue(UUID, UUID) IS
  'Releases a waiting Flower only while no battle has claimed it.';

COMMIT;
