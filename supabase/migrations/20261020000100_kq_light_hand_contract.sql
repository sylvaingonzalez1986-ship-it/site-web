BEGIN;

-- A voluntary production challenge, accepted before the next culture. Nothing
-- is delivered or removed from stock; its 30 game euros can be earned only once.
CREATE TABLE public.kq_production_contracts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code='light-hand'),
  run_id UUID REFERENCES public.kq_runs(id) ON DELETE RESTRICT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt>0),
  claimed_at TIMESTAMPTZ,
  result JSONB,
  PRIMARY KEY(user_id,code),
  CHECK ((claimed_at IS NULL)=(result IS NULL)),
  CHECK (result IS NULL OR (run_id IS NOT NULL AND jsonb_typeof(result)='object'
    AND result->>'status'='claimed'))
);
ALTER TABLE public.kq_production_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_production_contracts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_contract_progress(p_state JSONB) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE quality INTEGER; cards INTEGER;
BEGIN
  IF jsonb_typeof(p_state->'quality')='number'
    AND length(p_state->>'quality')<16 THEN
    IF (p_state->>'quality')::NUMERIC BETWEEN -2147483648 AND 2147483647
      AND (p_state->>'quality')::NUMERIC=trunc((p_state->>'quality')::NUMERIC) THEN
      quality:=(p_state->>'quality')::NUMERIC::INTEGER;
    END IF;
  END IF;
  IF jsonb_typeof(p_state->'usedCards')='array' THEN
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_state->'usedCards') item
      WHERE jsonb_typeof(item)<>'string' OR (item#>>'{}')!~'^BOTTE-[0-9]{3}$') THEN
      cards:=jsonb_array_length(p_state->'usedCards');
    END IF;
  END IF;
  RETURN jsonb_build_object('quality',quality,'cardsUsed',cards);
END;
$$;
REVOKE ALL ON FUNCTION public.kq_contract_progress(JSONB) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_contract_state(p_user_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  contract public.kq_production_contracts%ROWTYPE;
  lead public.kq_runs%ROWTYPE;
  progress JSONB; state TEXT; reason TEXT; active BOOLEAN;
  quality INTEGER; harvested_quality INTEGER; cards INTEGER;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
    THEN RAISE EXCEPTION 'contract_invalid_user'; END IF;
  SELECT * INTO contract FROM public.kq_production_contracts WHERE user_id=p_user_id AND code='light-hand';
  IF contract.claimed_at IS NOT NULL THEN RETURN contract.result; END IF;
  active:=EXISTS(SELECT 1 FROM public.kq_runs WHERE user_id=p_user_id AND status='active');
  IF contract.user_id IS NULL THEN
    state:='available';
  ELSIF contract.run_id IS NULL THEN
    state:='accepted';
  ELSE
    SELECT * INTO STRICT lead FROM public.kq_runs WHERE id=contract.run_id AND user_id=p_user_id;
    -- The shared campaign spends cards once, on its leader. A follower must
    -- never bind a second attempt or independently earn another reward.
    IF lead.campaign_id IS NOT NULL AND lead.id::TEXT IS DISTINCT FROM lead.state->'campaign'->>'leaderRunId'
      THEN RAISE EXCEPTION 'contract_invalid_leader'; END IF;
    progress:=public.kq_contract_progress(lead.state);
    cards:=(progress->>'cardsUsed')::INTEGER;
    SELECT max((public.kq_contract_progress(r.state)->>'quality')::INTEGER) INTO quality
      FROM public.kq_runs r WHERE r.user_id=p_user_id
        AND (r.id=lead.id OR (lead.campaign_id IS NOT NULL AND r.campaign_id=lead.campaign_id));
    IF lead.status='active' THEN
      state:='active';
      IF cards>2 THEN reason:='La limite de 2 cartes est dépassée pour cette tentative.'; END IF;
    ELSE
      -- A saved score alone is not a harvest. Require an actual flower from
      -- this exact completed run/campaign, a living culture and positive yield.
      SELECT max(f.quality) INTO harvested_quality
        FROM public.kq_runs r JOIN public.kq_flowers f ON f.run_id=r.id AND f.owner_id=p_user_id
        WHERE r.user_id=p_user_id AND r.status='completed' AND r.state->>'phase'='complete'
          AND r.state->'cultureDead' IS DISTINCT FROM 'true'::JSONB
          AND CASE WHEN jsonb_typeof(r.state->'harvestGrams')='number'
            THEN (r.state->>'harvestGrams')::NUMERIC>0 ELSE false END
          AND (r.id=lead.id OR (lead.campaign_id IS NOT NULL AND r.campaign_id=lead.campaign_id));
      IF lead.status='completed' AND lead.state->>'phase'='complete'
        AND lead.state->'cultureDead' IS DISTINCT FROM 'true'::JSONB
        AND cards IS NOT NULL AND cards<=2 AND harvested_quality>=8 THEN
        state:='succeeded'; quality:=harvested_quality;
      ELSE
        state:='failed';
        reason:=CASE WHEN cards>2 THEN 'Plus de 2 cartes Botte ont été jouées.'
          WHEN lead.status='abandoned' THEN 'La culture a été abandonnée. Tu peux retenter le contrat.'
          WHEN lead.state->'cultureDead'='true'::JSONB THEN 'La culture n’a pas survécu. Tu peux retenter le contrat.'
          WHEN cards IS NULL THEN 'Le nombre de cartes jouées ne peut pas être vérifié.'
          WHEN harvested_quality IS NULL THEN 'Aucune récolte vivante n’a été enregistrée pour cette tentative.'
          ELSE 'Aucune récolte de cette tentative n’atteint 8 points de Qualité.' END;
        IF harvested_quality IS NOT NULL THEN quality:=harvested_quality; END IF;
      END IF;
    END IF;
  END IF;
  IF active AND state IN ('available','failed') THEN
    reason:='Termine ta culture en cours avant d’accepter ce contrat.';
  END IF;
  RETURN jsonb_build_object('code','light-hand','status',state,'runId',contract.run_id,
    'quality',quality,'cardsUsed',cards,'rewardCents',3000,
    'canAccept',state IN ('available','failed') AND NOT active,'reason',reason);
END;
$$;

CREATE FUNCTION public.kq_bind_production_contract() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status<>'active' OR (NEW.campaign_id IS NOT NULL
    AND NEW.id::TEXT IS DISTINCT FROM NEW.state->'campaign'->>'leaderRunId') THEN RETURN NEW; END IF;
  -- Same lock as starts, abandonment, equipment and financial mutations.
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||NEW.user_id::TEXT,0));
  UPDATE public.kq_production_contracts SET run_id=NEW.id
    WHERE user_id=NEW.user_id AND code='light-hand' AND run_id IS NULL AND claimed_at IS NULL;
  RETURN NEW;
END;
$$;
-- AFTER INSERT sees the canonical campaign identity assigned by the existing
-- aaa_kq_campaign_identity BEFORE trigger. No historical run is ever attached.
CREATE TRIGGER kq_bind_production_contract AFTER INSERT ON public.kq_runs
  FOR EACH ROW EXECUTE FUNCTION public.kq_bind_production_contract();
REVOKE ALL ON FUNCTION public.kq_bind_production_contract() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_contract_action(p_user_id UUID,p_code TEXT,p_action TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<command>>
DECLARE contract public.kq_production_contracts%ROWTYPE; snapshot JSONB; wallet INTEGER; result JSONB;
BEGIN
  IF p_code IS DISTINCT FROM 'light-hand' THEN RAISE EXCEPTION 'contract_unknown'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('accept','cancel','claim') THEN RAISE EXCEPTION 'contract_action_invalid'; END IF;
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
    THEN RAISE EXCEPTION 'contract_invalid_user'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
  SELECT * INTO contract FROM public.kq_production_contracts
    WHERE user_id=p_user_id AND code=p_code FOR UPDATE;
  snapshot:=public.rpc_kq_contract_state(p_user_id);

  IF p_action='accept' THEN
    -- Retried accepts must not attach to a later culture or erase a success.
    IF snapshot->>'status' IN ('accepted','active','succeeded','claimed') THEN
      RETURN snapshot||jsonb_build_object('replayed',true);
    END IF;
    IF (snapshot->>'canAccept')::BOOLEAN IS DISTINCT FROM true THEN RAISE EXCEPTION 'contract_active_run'; END IF;
    INSERT INTO public.kq_production_contracts(user_id,code) VALUES(p_user_id,p_code)
      ON CONFLICT(user_id,code) DO UPDATE SET run_id=NULL,accepted_at=now(),attempt=kq_production_contracts.attempt+1
        WHERE kq_production_contracts.claimed_at IS NULL;
    RETURN public.rpc_kq_contract_state(p_user_id)||jsonb_build_object('replayed',false);
  END IF;

  IF p_action='cancel' THEN
    IF contract.run_id IS NOT NULL OR contract.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'contract_already_started'; END IF;
    DELETE FROM public.kq_production_contracts WHERE user_id=p_user_id AND code=p_code AND run_id IS NULL AND claimed_at IS NULL;
    RETURN public.rpc_kq_contract_state(p_user_id)||jsonb_build_object('replayed',contract.user_id IS NULL);
  END IF;

  IF contract.claimed_at IS NOT NULL THEN RETURN contract.result||jsonb_build_object('replayed',true); END IF;
  IF snapshot->>'status' IS DISTINCT FROM 'succeeded' THEN RAISE EXCEPTION 'contract_not_ready'; END IF;
  -- Reuse the existing mission cash/accounting path. No booster source, card
  -- provenance or sale is invented for this production reward.
  PERFORM public.kq_business_settle(p_user_id);
  INSERT INTO public.kq_equipment_wallets(user_id) VALUES(p_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF wallet::BIGINT+3000>2147483647 THEN RAISE EXCEPTION 'contract_wallet_limit'; END IF;
  PERFORM public.kq_treasury_initialize(p_user_id);
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+3000,updated_at=now()
    WHERE user_id=p_user_id RETURNING cash_cents INTO wallet;
  PERFORM public.kq_treasury_pair(p_user_id,'reward','kq-contract:light-hand:'||p_user_id::TEXT,now(),
    'suspense','revenue_rewards',3000,'Contrat : Main légère');
  result:=snapshot||jsonb_build_object('status','claimed','canAccept',false,'reason',NULL,
    'cashAfterCents',wallet,'replayed',false);
  UPDATE public.kq_production_contracts SET claimed_at=now(),result=command.result
    WHERE user_id=p_user_id AND code=p_code;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_contract_state(UUID),public.rpc_kq_contract_action(UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_contract_state(UUID),public.rpc_kq_contract_action(UUID,TEXT,TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
