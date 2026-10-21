BEGIN;

-- Optional repeatable objectives. Every choice keeps its own immutable identity,
-- captured terms and terminal receipt; a retry can never become a new choice.
CREATE TABLE public.kq_renewable_contract_attempts (
  id UUID PRIMARY KEY,
  ordinal BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK(code IN ('steady-hand','pure-grower','fine-flower')),
  minimum_quality INTEGER NOT NULL CHECK(minimum_quality>=0),
  max_cards_used INTEGER CHECK(max_cards_used>=0),
  reward_cents INTEGER NOT NULL CHECK(reward_cents>0),
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK(status IN ('accepted','active','succeeded','failed','claimed','cancelled')),
  run_id UUID REFERENCES public.kq_runs(id) ON DELETE RESTRICT,
  quality INTEGER,
  cards_used INTEGER CHECK(cards_used>=0),
  reason TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  cash_after_cents INTEGER CHECK(cash_after_cents>=0),
  CHECK ((status IN ('accepted','cancelled'))=(run_id IS NULL)),
  CHECK (status NOT IN ('accepted','cancelled') OR (quality IS NULL AND cards_used IS NULL)),
  CHECK ((status='claimed')=(claimed_at IS NOT NULL)),
  CHECK ((status='claimed')=(cash_after_cents IS NOT NULL)),
  CHECK ((status IN ('succeeded','failed','claimed','cancelled'))=(resolved_at IS NOT NULL)),
  CHECK (status NOT IN ('succeeded','claimed') OR
    (quality IS NOT NULL AND quality>=minimum_quality AND cards_used IS NOT NULL
      AND (max_cards_used IS NULL OR cards_used<=max_cards_used)))
);
CREATE UNIQUE INDEX kq_renewable_contract_pending ON public.kq_renewable_contract_attempts(user_id)
  WHERE status IN ('accepted','active','succeeded');
CREATE UNIQUE INDEX kq_renewable_contract_run ON public.kq_renewable_contract_attempts(run_id)
  WHERE run_id IS NOT NULL;
CREATE INDEX kq_renewable_contract_history ON public.kq_renewable_contract_attempts(user_id,ordinal DESC);
ALTER TABLE public.kq_renewable_contract_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_renewable_contract_attempts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.kq_renewable_contract_attempts_ordinal_seq FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_renewable_contract_offers() RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT '[{"code":"steady-hand","minimumQuality":10,"maxCardsUsed":2,"rewardCents":1500},
    {"code":"pure-grower","minimumQuality":8,"maxCardsUsed":0,"rewardCents":1000},
    {"code":"fine-flower","minimumQuality":12,"maxCardsUsed":null,"rewardCents":2000}]'::JSONB
$$;

CREATE FUNCTION public.kq_renewable_contract_json(p_attempt public.kq_renewable_contract_attempts) RETURNS JSONB
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT jsonb_build_object('id',p_attempt.id,'code',p_attempt.code,'status',p_attempt.status,
    'runId',p_attempt.run_id,'quality',p_attempt.quality,'cardsUsed',p_attempt.cards_used,
    'minimumQuality',p_attempt.minimum_quality,'maxCardsUsed',p_attempt.max_cards_used,
    'rewardCents',p_attempt.reward_cents,'reason',p_attempt.reason)
    || CASE WHEN p_attempt.status='claimed'
      THEN jsonb_build_object('cashAfterCents',p_attempt.cash_after_cents) ELSE '{}'::JSONB END
$$;

CREATE FUNCTION public.kq_guard_renewable_contract_attempt() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  IF (NEW.id,NEW.ordinal,NEW.user_id,NEW.code,NEW.minimum_quality,NEW.max_cards_used,NEW.reward_cents,NEW.accepted_at)
    IS DISTINCT FROM
    (OLD.id,OLD.ordinal,OLD.user_id,OLD.code,OLD.minimum_quality,OLD.max_cards_used,OLD.reward_cents,OLD.accepted_at)
    OR (OLD.run_id IS NOT NULL AND NEW.run_id IS DISTINCT FROM OLD.run_id)
    OR NOT ((OLD.status='accepted' AND NEW.status IN ('active','cancelled'))
      OR (OLD.status='active' AND NEW.status IN ('succeeded','failed'))
      OR (OLD.status='succeeded' AND NEW.status='claimed'))
    THEN RAISE EXCEPTION 'contract_attempt_immutable'; END IF;
  -- A claimed receipt retains the exact qualified metrics, even if later
  -- operations consume the flower or the catalog's thresholds change.
  IF OLD.status='succeeded' AND
    (NEW.quality,NEW.cards_used,NEW.resolved_at) IS DISTINCT FROM (OLD.quality,OLD.cards_used,OLD.resolved_at)
    THEN RAISE EXCEPTION 'contract_attempt_immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kq_guard_renewable_contract_attempt BEFORE UPDATE ON public.kq_renewable_contract_attempts
  FOR EACH ROW EXECUTE FUNCTION public.kq_guard_renewable_contract_attempt();

CREATE FUNCTION public.kq_bind_renewable_contract() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status<>'active' OR (NEW.campaign_id IS NOT NULL
    AND NEW.id::TEXT IS DISTINCT FROM NEW.state->'campaign'->>'leaderRunId') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
  UPDATE public.kq_renewable_contract_attempts SET run_id=NEW.id,status='active'
    WHERE user_id=NEW.user_id AND status='accepted' AND run_id IS NULL;
  RETURN NEW;
END;
$$;
-- Existing aaa_kq_campaign_identity BEFORE INSERT supplies the canonical id.
-- No UPDATE or backfill can attach an old culture to a newly accepted contract.
CREATE TRIGGER kq_bind_renewable_contract AFTER INSERT ON public.kq_runs
  FOR EACH ROW EXECUTE FUNCTION public.kq_bind_renewable_contract();

CREATE FUNCTION public.rpc_kq_contract_board(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<contract_board>>
DECLARE
  attempt public.kq_renewable_contract_attempts%ROWTYPE;
  lead public.kq_runs%ROWTYPE;
  progress JSONB; current_attempt JSONB; outcome TEXT; failure TEXT; board_reason TEXT;
  quality INTEGER; harvested_quality INTEGER; cards INTEGER; completed INTEGER;
  unlocked BOOLEAN; active BOOLEAN; pending BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
    THEN RAISE EXCEPTION 'contract_invalid_user'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  unlocked:=EXISTS(SELECT 1 FROM public.kq_production_contracts
    WHERE user_id=p_user_id AND code='light-hand' AND claimed_at IS NOT NULL);
  IF NOT unlocked THEN
    RETURN jsonb_build_object('version',2,'unlocked',false,'canAccept',false,
      'reason','Récupère la prime Main légère pour ouvrir ces contrats.',
      'offers',public.kq_renewable_contract_offers(),'current',NULL,'completedCount',0);
  END IF;

  SELECT * INTO attempt FROM public.kq_renewable_contract_attempts
    WHERE user_id=p_user_id ORDER BY ordinal DESC LIMIT 1 FOR UPDATE;
  IF attempt.status='active' THEN
    SELECT * INTO STRICT lead FROM public.kq_runs WHERE id=attempt.run_id AND user_id=p_user_id;
    IF lead.campaign_id IS NOT NULL AND (lead.id::TEXT IS DISTINCT FROM lead.state->'campaign'->>'leaderRunId'
      OR NOT EXISTS(SELECT 1 FROM public.kq_culture_campaigns c
        WHERE c.id=lead.campaign_id AND c.user_id=p_user_id AND c.leader_run_id=lead.id))
      THEN RAISE EXCEPTION 'contract_invalid_leader'; END IF;
    progress:=public.kq_contract_progress(lead.state);
    cards:=(progress->>'cardsUsed')::INTEGER;
    SELECT max((public.kq_contract_progress(r.state)->>'quality')::INTEGER) INTO quality
      FROM public.kq_runs r WHERE r.user_id=p_user_id
        AND (r.id=lead.id OR (lead.campaign_id IS NOT NULL AND r.campaign_id=lead.campaign_id));
    IF lead.status='active' THEN
      IF attempt.max_cards_used IS NOT NULL AND cards>attempt.max_cards_used THEN
        failure:=CASE WHEN attempt.max_cards_used=0 THEN 'Une carte Botte a été jouée : ce contrat ne peut plus être réussi.'
          ELSE 'La limite de cartes est dépassée pour cette tentative.' END;
      END IF;
      current_attempt:=public.kq_renewable_contract_json(attempt)
        ||jsonb_build_object('quality',quality,'cardsUsed',cards,'reason',failure);
    ELSE
      -- Completion and flower creation are committed by the existing run RPC
      -- in one transaction. A score alone, another owner or a dead/empty run
      -- never qualifies. A campaign spends its cards once, on the leader.
      SELECT max(f.quality) INTO harvested_quality
        FROM public.kq_runs r JOIN public.kq_flowers f ON f.run_id=r.id AND f.owner_id=p_user_id
        WHERE r.user_id=p_user_id AND r.status='completed' AND r.state->>'phase'='complete'
          AND (r.state->'cultureDead' IS NULL OR r.state->'cultureDead'='false'::JSONB)
          AND CASE WHEN jsonb_typeof(r.state->'harvestGrams')='number'
            THEN (r.state->>'harvestGrams')::NUMERIC>0 ELSE false END
          AND (r.id=lead.id OR (lead.campaign_id IS NOT NULL AND r.campaign_id=lead.campaign_id));
      IF lead.status='completed' AND lead.state->>'phase'='complete'
        AND (lead.state->'cultureDead' IS NULL OR lead.state->'cultureDead'='false'::JSONB)
        AND cards IS NOT NULL AND (attempt.max_cards_used IS NULL OR cards<=attempt.max_cards_used)
        AND harvested_quality>=attempt.minimum_quality THEN
        outcome:='succeeded'; quality:=harvested_quality;
      ELSE
        outcome:='failed';
        failure:=CASE
          WHEN attempt.max_cards_used IS NOT NULL AND cards>attempt.max_cards_used
            THEN 'La limite de cartes Botte de ce contrat a été dépassée.'
          WHEN lead.status='abandoned' THEN 'La culture a été abandonnée. Tu peux choisir un nouveau contrat.'
          WHEN lead.state->'cultureDead'='true'::JSONB THEN 'La culture n’a pas survécu. Tu peux retenter.'
          WHEN cards IS NULL THEN 'Le nombre de cartes jouées ne peut pas être vérifié.'
          WHEN harvested_quality IS NULL THEN 'Aucune récolte vivante n’a été enregistrée pour cette tentative.'
          ELSE 'Aucune récolte de cette tentative n’atteint la Qualité demandée.' END;
        IF harvested_quality IS NOT NULL THEN quality:=harvested_quality; END IF;
      END IF;
      UPDATE public.kq_renewable_contract_attempts SET status=outcome,
        quality=contract_board.quality,cards_used=cards,reason=failure,resolved_at=now()
        WHERE id=attempt.id RETURNING * INTO attempt;
    END IF;
  END IF;
  IF attempt.id IS NOT NULL AND current_attempt IS NULL THEN
    current_attempt:=public.kq_renewable_contract_json(attempt);
  END IF;
  active:=EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status='active');
  pending:=COALESCE(attempt.status IN ('accepted','active','succeeded'),false);
  SELECT count(*)::INTEGER INTO completed FROM public.kq_renewable_contract_attempts
    WHERE user_id=p_user_id AND status='claimed';
  board_reason:=CASE WHEN attempt.status='succeeded' THEN 'Récupère ta prime avant de choisir un autre contrat.'
    WHEN attempt.status='accepted' THEN 'Ce contrat attend ta prochaine culture.'
    WHEN attempt.status='active' OR active THEN 'Termine ta culture en cours avant de choisir un autre contrat.'
    ELSE NULL END;
  RETURN jsonb_build_object('version',2,'unlocked',true,'canAccept',NOT active AND NOT pending,
    'reason',board_reason,'offers',public.kq_renewable_contract_offers(),'current',current_attempt,
    'completedCount',completed);
END;
$$;

CREATE FUNCTION public.rpc_kq_contract_board_action(
  p_user_id UUID,p_action TEXT,p_code TEXT DEFAULT NULL,p_attempt_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  attempt public.kq_renewable_contract_attempts%ROWTYPE;
  board JSONB; offer JSONB; wallet INTEGER; receipt JSONB;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('accept','cancel','claim')
    THEN RAISE EXCEPTION 'contract_action_invalid'; END IF;
  IF p_attempt_id IS NULL THEN RAISE EXCEPTION 'contract_attempt_invalid'; END IF;
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
    THEN RAISE EXCEPTION 'contract_invalid_user'; END IF;
  IF p_action='accept' THEN
    SELECT item INTO offer FROM jsonb_array_elements(public.kq_renewable_contract_offers()) item
      WHERE item->>'code'=p_code;
    IF offer IS NULL THEN RAISE EXCEPTION 'contract_unknown'; END IF;
  ELSIF p_code IS NOT NULL THEN RAISE EXCEPTION 'contract_action_invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));

  IF p_action='accept' THEN
    SELECT * INTO attempt FROM public.kq_renewable_contract_attempts WHERE id=p_attempt_id;
    IF FOUND THEN
      IF attempt.user_id<>p_user_id OR attempt.code<>p_code
        THEN RAISE EXCEPTION 'contract_attempt_conflict'; END IF;
      RETURN jsonb_build_object('board',public.rpc_kq_contract_board(p_user_id),'receipt',NULL,'replayed',true);
    END IF;
    board:=public.rpc_kq_contract_board(p_user_id);
    IF (board->>'unlocked')::BOOLEAN IS DISTINCT FROM true THEN RAISE EXCEPTION 'contract_locked'; END IF;
    IF board->'current'->>'status' IN ('accepted','active','succeeded') THEN RAISE EXCEPTION 'contract_pending'; END IF;
    IF (board->>'canAccept')::BOOLEAN IS DISTINCT FROM true THEN RAISE EXCEPTION 'contract_active_run'; END IF;
    INSERT INTO public.kq_renewable_contract_attempts(id,user_id,code,minimum_quality,max_cards_used,reward_cents)
      VALUES(p_attempt_id,p_user_id,p_code,(offer->>'minimumQuality')::INTEGER,
        (offer->>'maxCardsUsed')::INTEGER,(offer->>'rewardCents')::INTEGER)
      ON CONFLICT(id) DO NOTHING RETURNING * INTO attempt;
    IF NOT FOUND THEN RAISE EXCEPTION 'contract_attempt_conflict'; END IF;
    RETURN jsonb_build_object('board',public.rpc_kq_contract_board(p_user_id),'receipt',NULL,'replayed',false);
  END IF;

  -- Refresh only under the same player/equipment lock as starts and claims.
  -- Stale commands address their exact ledger entry, never the newest attempt.
  board:=public.rpc_kq_contract_board(p_user_id);
  SELECT * INTO attempt FROM public.kq_renewable_contract_attempts
    WHERE id=p_attempt_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_attempt_unknown'; END IF;
  IF p_action='cancel' THEN
    IF attempt.status='cancelled' THEN
      RETURN jsonb_build_object('board',board,'receipt',NULL,'replayed',true);
    END IF;
    IF attempt.status<>'accepted' THEN RAISE EXCEPTION 'contract_already_started'; END IF;
    UPDATE public.kq_renewable_contract_attempts SET status='cancelled',resolved_at=now(),
      reason='Contrat annulé avant le départ.' WHERE id=attempt.id;
    RETURN jsonb_build_object('board',public.rpc_kq_contract_board(p_user_id),'receipt',NULL,'replayed',false);
  END IF;

  IF attempt.status='claimed' THEN
    RETURN jsonb_build_object('board',board,'receipt',public.kq_renewable_contract_json(attempt),'replayed',true);
  END IF;
  IF attempt.status<>'succeeded' THEN RAISE EXCEPTION 'contract_not_ready'; END IF;
  PERFORM public.kq_business_settle(p_user_id);
  INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF wallet::BIGINT+attempt.reward_cents>2147483647 THEN RAISE EXCEPTION 'contract_wallet_limit'; END IF;
  PERFORM public.kq_treasury_initialize(p_user_id);
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+attempt.reward_cents,updated_at=now()
    WHERE user_id=p_user_id RETURNING cash_cents INTO wallet;
  PERFORM public.kq_treasury_pair(p_user_id,'reward','kq-contract-attempt:'||attempt.id::TEXT,now(),
    'suspense','revenue_rewards',attempt.reward_cents,
    'Contrat : '||CASE attempt.code WHEN 'steady-hand' THEN 'Le juste geste'
      WHEN 'pure-grower' THEN 'Au naturel' ELSE 'La belle signature' END);
  UPDATE public.kq_renewable_contract_attempts SET status='claimed',claimed_at=now(),cash_after_cents=wallet
    WHERE id=attempt.id RETURNING * INTO attempt;
  receipt:=public.kq_renewable_contract_json(attempt);
  RETURN jsonb_build_object('board',public.rpc_kq_contract_board(p_user_id),'receipt',receipt,'replayed',false);
END;
$$;

REVOKE ALL ON FUNCTION public.kq_renewable_contract_offers(),
  public.kq_renewable_contract_json(public.kq_renewable_contract_attempts),
  public.kq_guard_renewable_contract_attempt(),public.kq_bind_renewable_contract(),
  public.rpc_kq_contract_board(UUID),public.rpc_kq_contract_board_action(UUID,TEXT,TEXT,UUID)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_contract_board(UUID),public.rpc_kq_contract_board_action(UUID,TEXT,TEXT,UUID)
  TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
