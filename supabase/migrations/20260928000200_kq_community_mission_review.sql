BEGIN;

-- The catalogue stays editable by the authenticated admin backend. Submitted
-- evidence and promised rewards can only change through the transactions below.
ALTER TABLE public.social_missions
  ADD COLUMN reward_card_id UUID REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT;
ALTER TABLE public.social_missions DROP CONSTRAINT social_missions_reward_type_check;
ALTER TABLE public.social_missions DROP CONSTRAINT social_missions_reward_amount_check;
ALTER TABLE public.social_missions ADD CONSTRAINT social_missions_reward_type_check
  CHECK (reward_type IN ('packs','points','support_pack','buddies','game_cash'));
-- NOT VALID preserves an older catalogue entry with a larger legacy budget.
-- New or edited entries, and every new submission, use these explicit caps.
ALTER TABLE public.social_missions ADD CONSTRAINT social_missions_reward_budget_check CHECK (
  (reward_type='packs' AND reward_amount BETWEEN 1 AND 20 AND reward_card_id IS NULL) OR
  (reward_type='points' AND reward_amount BETWEEN 1 AND 1000 AND reward_card_id IS NULL) OR
  (reward_type='support_pack' AND reward_amount BETWEEN 1 AND 5 AND reward_card_id IS NULL) OR
  (reward_type='buddies' AND reward_amount=1 AND reward_card_id IS NOT NULL) OR
  (reward_type='game_cash' AND reward_amount BETWEEN 1 AND 100000 AND reward_card_id IS NULL)
) NOT VALID;
ALTER TABLE public.social_missions ADD CONSTRAINT social_missions_completion_budget_check
  CHECK (max_completions_per_user BETWEEN 1 AND 20) NOT VALID;

ALTER TABLE public.social_mission_submissions
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0 CHECK (review_version IN (0,1)),
  ADD COLUMN reward_type_snapshot TEXT,
  ADD COLUMN reward_amount_snapshot INTEGER,
  ADD COLUMN reward_card_id_snapshot UUID REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT,
  ADD COLUMN reward_card_name_snapshot TEXT,
  ADD COLUMN reward_label_snapshot TEXT,
  ADD COLUMN mission_title_snapshot TEXT,
  ADD COLUMN mission_slug_snapshot TEXT,
  ADD COLUMN requires_proof_snapshot BOOLEAN,
  ADD COLUMN completion_limit_snapshot INTEGER,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.social_mission_submissions DROP CONSTRAINT social_mission_submissions_status_check;
ALTER TABLE public.social_mission_submissions ADD CONSTRAINT social_mission_submissions_status_check
  CHECK (status IN ('pending','approved','rejected','changes_requested'));

-- This is a migration-time snapshot for old dossiers, not a reconstruction of
-- their original promises. In particular, old approved rows are never credited.
UPDATE public.social_mission_submissions s SET
  reward_type_snapshot=m.reward_type, reward_amount_snapshot=m.reward_amount,
  reward_card_id_snapshot=m.reward_card_id,
  reward_card_name_snapshot=(SELECT name FROM public.lottery_card_definitions WHERE id=m.reward_card_id),
  reward_label_snapshot=CASE m.reward_type
    WHEN 'packs' THEN m.reward_amount::TEXT || ' pack(s) Buddies'
    WHEN 'points' THEN m.reward_amount::TEXT || ' points de fidélité'
    WHEN 'support_pack' THEN m.reward_amount::TEXT || ' pack(s) La Botte de 3 cartes'
    WHEN 'buddies' THEN '1 Buddy'
    ELSE to_char(m.reward_amount::NUMERIC/100,'FM999999990.00') || ' € du jeu' END,
  mission_title_snapshot=m.title, mission_slug_snapshot=m.slug,
  requires_proof_snapshot=m.requires_proof, completion_limit_snapshot=m.max_completions_per_user
FROM public.social_missions m WHERE m.id=s.mission_id;
ALTER TABLE public.social_mission_submissions
  ALTER COLUMN review_version SET DEFAULT 1,
  ALTER COLUMN reward_type_snapshot SET NOT NULL,
  ALTER COLUMN reward_amount_snapshot SET NOT NULL,
  ALTER COLUMN reward_label_snapshot SET NOT NULL,
  ALTER COLUMN mission_title_snapshot SET NOT NULL,
  ALTER COLUMN mission_slug_snapshot SET NOT NULL,
  ALTER COLUMN requires_proof_snapshot SET NOT NULL,
  ALTER COLUMN completion_limit_snapshot SET NOT NULL;
-- Existing duplicate pending dossiers stay visible for human reconciliation.
-- The RPC also checks those legacy rows before accepting any new dossier.
CREATE UNIQUE INDEX social_mission_one_active_submission
  ON public.social_mission_submissions(user_id,mission_id)
  WHERE status IN ('pending','changes_requested') AND review_version=1;

CREATE TABLE public.social_mission_request_receipts (
  request_key UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.social_mission_submissions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('submit','approved','rejected','changes_requested')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor TEXT NOT NULL,
  payload JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX social_mission_request_receipts_submission
  ON public.social_mission_request_receipts(submission_id,created_at,request_key);
ALTER TABLE public.social_mission_request_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_mission_request_receipts FROM PUBLIC,anon,authenticated,service_role;

-- Independent immutable accounting references also survive an archived mission.
-- No proof or reviewer email is retained in this financial/reward receipt.
CREATE TABLE public.social_mission_reward_receipts (
  submission_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  mission_id UUID NOT NULL,
  reward_type TEXT NOT NULL,
  reward_amount INTEGER NOT NULL CHECK (reward_amount > 0),
  reward_card_id UUID REFERENCES public.lottery_card_definitions(id) ON DELETE RESTRICT,
  reward_result JSONB NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_mission_reward_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_mission_reward_receipts FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.lottery_card_instances ADD COLUMN community_mission_reward_id UUID
  REFERENCES public.social_mission_reward_receipts(submission_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX lottery_card_instances_community_mission
  ON public.lottery_card_instances(community_mission_reward_id) WHERE community_mission_reward_id IS NOT NULL;
ALTER TABLE public.lottery_card_instances DROP CONSTRAINT lottery_card_instances_source_required;
ALTER TABLE public.lottery_card_instances ADD CONSTRAINT lottery_card_instances_source_required CHECK (
  ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL OR source_bot_battle_id IS NOT NULL
  OR pioneer_grant_id IS NOT NULL OR producer_purchase_buddie_grant_id IS NOT NULL
  OR community_mission_reward_id IS NOT NULL);

REVOKE ALL ON TABLE public.social_missions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.social_missions TO service_role;
REVOKE ALL ON TABLE public.social_mission_submissions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.social_mission_submissions TO service_role;

CREATE FUNCTION public.rpc_submit_social_mission(
  p_user_id UUID, p_mission_id UUID, p_request_key UUID,
  p_proof_url TEXT, p_proof_text TEXT, p_proof_storage_path TEXT,
  p_proof_content_type TEXT, p_proof_file_size INTEGER,
  p_submission_id UUID DEFAULT NULL, p_expected_revision INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mission public.social_missions%ROWTYPE;
  submission public.social_mission_submissions%ROWTYPE;
  receipt public.social_mission_request_receipts%ROWTYPE;
  card_name TEXT; reward_label TEXT; payload JSONB; result JSONB;
  url TEXT:=NULLIF(btrim(p_proof_url),''); submitted_text TEXT:=NULLIF(btrim(p_proof_text),'');
  storage_path TEXT:=NULLIF(btrim(p_proof_storage_path),''); needs_proof BOOLEAN;
  content_type TEXT:=p_proof_content_type; file_size INTEGER:=p_proof_file_size;
  uploaded_at TIMESTAMPTZ:=CASE WHEN NULLIF(btrim(p_proof_storage_path),'') IS NOT NULL THEN now() END;
BEGIN
  IF p_user_id IS NULL OR p_mission_id IS NULL OR p_request_key IS NULL
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
    RAISE EXCEPTION 'mission_invalid_request';
  END IF;
  payload:=jsonb_build_object('missionId',p_mission_id,'submissionId',p_submission_id,
    'expectedRevision',p_expected_revision,'proofUrl',url,'proofText',submitted_text);
  PERFORM pg_advisory_xact_lock(hashtextextended('social-mission-request:'||p_request_key::TEXT,0));
  SELECT * INTO receipt FROM public.social_mission_request_receipts WHERE request_key=p_request_key;
  IF FOUND THEN
    IF receipt.user_id<>p_user_id OR receipt.action<>'submit' OR receipt.payload<>payload THEN
      RAISE EXCEPTION 'mission_request_key_reused';
    END IF;
    RETURN receipt.result || jsonb_build_object('replayed',true);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('social-missions:'||p_user_id::TEXT,0));
  SELECT * INTO mission FROM public.social_missions WHERE id=p_mission_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission_not_found'; END IF;
  IF p_submission_id IS NULL THEN
    IF p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'mission_invalid_request'; END IF;
    IF NOT mission.is_active THEN RAISE EXCEPTION 'mission_inactive'; END IF;
    IF mission.max_completions_per_user NOT BETWEEN 1 AND 20 OR NOT (
      (mission.reward_type='packs' AND mission.reward_amount BETWEEN 1 AND 20 AND mission.reward_card_id IS NULL) OR
      (mission.reward_type='points' AND mission.reward_amount BETWEEN 1 AND 1000 AND mission.reward_card_id IS NULL) OR
      (mission.reward_type='support_pack' AND mission.reward_amount BETWEEN 1 AND 5 AND mission.reward_card_id IS NULL) OR
      (mission.reward_type='buddies' AND mission.reward_amount=1 AND mission.reward_card_id IS NOT NULL) OR
      (mission.reward_type='game_cash' AND mission.reward_amount BETWEEN 1 AND 100000 AND mission.reward_card_id IS NULL)
    ) THEN RAISE EXCEPTION 'mission_invalid_reward'; END IF;
    IF (SELECT count(*) FROM public.social_mission_submissions
      WHERE user_id=p_user_id AND mission_id=p_mission_id AND status='approved')>=mission.max_completions_per_user THEN
      RAISE EXCEPTION 'mission_completion_limit';
    END IF;
    needs_proof:=mission.requires_proof;
  ELSE
    SELECT * INTO submission FROM public.social_mission_submissions
      WHERE id=p_submission_id AND user_id=p_user_id AND mission_id=p_mission_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'mission_submission_not_found'; END IF;
    IF p_expected_revision IS DISTINCT FROM submission.revision THEN RAISE EXCEPTION 'mission_stale_revision'; END IF;
    IF submission.status<>'changes_requested' OR submission.reward_granted THEN
      RAISE EXCEPTION 'mission_submission_not_correctable';
    END IF;
    needs_proof:=submission.requires_proof_snapshot;
    -- Correcting a link or a comment can retain the screenshot already held
    -- privately for this same dossier. Never accept arbitrary client paths.
    IF storage_path IS NULL THEN
      IF content_type IS NOT NULL OR file_size IS NOT NULL THEN RAISE EXCEPTION 'mission_invalid_proof'; END IF;
      storage_path:=submission.proof_storage_path;
      content_type:=submission.proof_content_type;
      file_size:=submission.proof_file_size;
      uploaded_at:=submission.proof_uploaded_at;
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM public.social_mission_submissions WHERE user_id=p_user_id AND mission_id=p_mission_id
    AND status IN ('pending','changes_requested') AND id IS DISTINCT FROM p_submission_id) THEN
    RAISE EXCEPTION 'mission_already_pending';
  END IF;
  IF needs_proof AND storage_path IS NULL THEN RAISE EXCEPTION 'mission_proof_required'; END IF;
  IF (url IS NOT NULL AND (length(url)>2048 OR url !~ '^https://[^[:space:]/@]+([/:?#][^[:space:]]*)?$'))
    OR length(COALESCE(submitted_text,''))>2000 THEN RAISE EXCEPTION 'mission_invalid_proof'; END IF;
  IF storage_path IS NOT NULL AND (
    storage_path !~ ('^'||p_user_id::TEXT||'/[0-9a-f-]{36}\.(jpg|png|webp)$')
    OR content_type IS NULL OR content_type NOT IN ('image/jpeg','image/png','image/webp')
    OR file_size IS NULL OR file_size NOT BETWEEN 1 AND 8388608
  ) THEN RAISE EXCEPTION 'mission_invalid_proof'; END IF;
  IF storage_path IS NULL AND (content_type IS NOT NULL OR file_size IS NOT NULL) THEN
    RAISE EXCEPTION 'mission_invalid_proof';
  END IF;
  IF p_submission_id IS NULL THEN
    IF mission.reward_type='buddies' THEN
      SELECT card.name INTO card_name FROM public.lottery_card_definitions card
        JOIN public.lottery_card_collections collection ON collection.id=card.collection_id
        WHERE card.id=mission.reward_card_id AND card.is_active AND collection.is_active
          AND collection.code='HEMP_HEROES_2026' FOR SHARE OF card,collection;
      IF NOT FOUND THEN RAISE EXCEPTION 'mission_buddy_unavailable'; END IF;
    END IF;
    reward_label:=CASE mission.reward_type
      WHEN 'packs' THEN mission.reward_amount::TEXT||' pack(s) Buddies'
      WHEN 'points' THEN mission.reward_amount::TEXT||' points de fidélité'
      WHEN 'support_pack' THEN mission.reward_amount::TEXT||' pack(s) La Botte de 3 cartes'
      WHEN 'buddies' THEN '1 Buddy : '||card_name
      ELSE to_char(mission.reward_amount::NUMERIC/100,'FM999999990.00')||' € du jeu' END;
    INSERT INTO public.social_mission_submissions(user_id,mission_id,proof_url,proof_text,
      proof_storage_path,proof_content_type,proof_file_size,proof_uploaded_at,
      reward_type_snapshot,reward_amount_snapshot,reward_card_id_snapshot,reward_card_name_snapshot,
      reward_label_snapshot,mission_title_snapshot,mission_slug_snapshot,requires_proof_snapshot,completion_limit_snapshot)
    VALUES(p_user_id,p_mission_id,url,submitted_text,storage_path,content_type,file_size,uploaded_at,
      mission.reward_type,mission.reward_amount,mission.reward_card_id,card_name,reward_label,
      mission.title,mission.slug,mission.requires_proof,mission.max_completions_per_user)
    RETURNING * INTO submission;
  ELSE
    UPDATE public.social_mission_submissions SET proof_url=url,proof_text=submitted_text,
      proof_storage_path=storage_path,proof_content_type=content_type,proof_file_size=file_size,
      proof_uploaded_at=uploaded_at,
      status='pending',revision=revision+1,review_version=1,admin_note=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
    WHERE id=p_submission_id RETURNING * INTO submission;
  END IF;
  result:=jsonb_build_object('submission',to_jsonb(submission),'replayed',false,'reward',NULL);
  INSERT INTO public.social_mission_request_receipts(request_key,user_id,submission_id,action,revision,actor,payload,result)
    VALUES(p_request_key,p_user_id,submission.id,'submit',submission.revision,p_user_id::TEXT,payload,result);
  RETURN result;
END;
$$;

CREATE FUNCTION public.rpc_review_social_mission(
  p_submission_id UUID,p_expected_revision INTEGER,p_decision TEXT,
  p_admin_email TEXT,p_request_key UUID,p_admin_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE submission public.social_mission_submissions%ROWTYPE;
  receipt public.social_mission_request_receipts%ROWTYPE;
  subject UUID; actor TEXT:=lower(NULLIF(btrim(p_admin_email),'')); note TEXT:=NULLIF(btrim(p_admin_note),'');
  payload JSONB; result JSONB; reward JSONB; wallet INTEGER; card_id UUID; entitlement_id UUID;
  entitlement_ids UUID[]:=ARRAY[]::UUID[]; instance_id UUID; i INTEGER;
BEGIN
  IF p_submission_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1 OR p_request_key IS NULL
    OR p_decision IS NULL OR p_decision NOT IN ('approved','rejected','changes_requested')
    OR actor IS NULL OR length(actor)>254 OR actor NOT LIKE '%@%'
    OR length(COALESCE(note,''))>2000 THEN RAISE EXCEPTION 'mission_invalid_review'; END IF;
  IF p_decision IN ('rejected','changes_requested') AND note IS NULL THEN RAISE EXCEPTION 'mission_note_required'; END IF;
  payload:=jsonb_build_object('submissionId',p_submission_id,'expectedRevision',p_expected_revision,
    'decision',p_decision,'adminEmail',actor,'adminNote',note);
  PERFORM pg_advisory_xact_lock(hashtextextended('social-mission-request:'||p_request_key::TEXT,0));
  SELECT * INTO receipt FROM public.social_mission_request_receipts WHERE request_key=p_request_key;
  IF FOUND THEN
    IF receipt.action<>p_decision OR receipt.actor<>actor OR receipt.payload<>payload THEN
      RAISE EXCEPTION 'mission_request_key_reused';
    END IF;
    RETURN receipt.result || jsonb_build_object('replayed',true);
  END IF;
  SELECT user_id INTO subject FROM public.social_mission_submissions WHERE id=p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission_submission_not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('social-missions:'||subject::TEXT,0));
  SELECT * INTO submission FROM public.social_mission_submissions WHERE id=p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission_submission_not_found'; END IF;
  IF submission.revision<>p_expected_revision THEN RAISE EXCEPTION 'mission_stale_revision'; END IF;
  IF submission.status<>'pending' OR submission.reward_granted THEN RAISE EXCEPTION 'mission_already_reviewed'; END IF;
  IF p_decision='approved' THEN
    IF (SELECT count(*) FROM public.social_mission_submissions WHERE user_id=subject
      AND mission_id=submission.mission_id AND status='approved')>=submission.completion_limit_snapshot THEN
      RAISE EXCEPTION 'mission_completion_limit';
    END IF;
    IF EXISTS(SELECT 1 FROM public.social_mission_reward_receipts WHERE submission_id=submission.id) THEN
      RAISE EXCEPTION 'mission_reward_already_granted';
    END IF;
    reward:=jsonb_build_object('type',submission.reward_type_snapshot,'amount',submission.reward_amount_snapshot,
      'cardId',submission.reward_card_id_snapshot,'label',submission.reward_label_snapshot);
    INSERT INTO public.social_mission_reward_receipts(submission_id,user_id,mission_id,reward_type,reward_amount,reward_card_id,reward_result)
      VALUES(submission.id,subject,submission.mission_id,submission.reward_type_snapshot,
        submission.reward_amount_snapshot,submission.reward_card_id_snapshot,reward);
    CASE submission.reward_type_snapshot
      WHEN 'packs' THEN
        -- The native issuer owns its ticket sequence and lottery audit log.
        PERFORM public.rpc_admin_grant_lottery_tickets(subject,submission.reward_amount_snapshot,
          'Mission : '||submission.mission_title_snapshot,actor);
      WHEN 'points' THEN
        UPDATE public.profiles SET loyalty_points=loyalty_points+submission.reward_amount_snapshot WHERE id=subject;
        IF NOT FOUND THEN RAISE EXCEPTION 'mission_profile_missing'; END IF;
      WHEN 'support_pack' THEN
        IF submission.reward_amount_snapshot NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'mission_invalid_reward'; END IF;
        PERFORM 1 FROM public.lottery_card_collections WHERE code='BOTTE_DU_CHANVRIER_2026' AND is_active FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'mission_collection_inactive'; END IF;
        FOR i IN 1..submission.reward_amount_snapshot LOOP
          INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
            VALUES(subject,'mission','community-mission:v1:'||submission.id::TEXT||':'||i::TEXT,3)
            RETURNING id INTO entitlement_id;
          entitlement_ids:=array_append(entitlement_ids,entitlement_id);
        END LOOP;
        reward:=reward||jsonb_build_object('entitlementIds',to_jsonb(entitlement_ids));
      WHEN 'buddies' THEN
        IF submission.reward_amount_snapshot<>1 THEN RAISE EXCEPTION 'mission_invalid_reward'; END IF;
        SELECT card.id INTO card_id FROM public.lottery_card_definitions card
          JOIN public.lottery_card_collections collection ON collection.id=card.collection_id
          WHERE card.id=submission.reward_card_id_snapshot AND card.is_active AND collection.is_active
            AND collection.code='HEMP_HEROES_2026' FOR SHARE OF card,collection;
        IF NOT FOUND THEN RAISE EXCEPTION 'mission_buddy_unavailable'; END IF;
        INSERT INTO public.lottery_card_instances(user_id,card_definition_id,pack_slot,community_mission_reward_id)
          VALUES(subject,card_id,1,submission.id) RETURNING id INTO instance_id;
        reward:=reward||jsonb_build_object('cardInstanceId',instance_id);
      WHEN 'game_cash' THEN
        IF submission.reward_amount_snapshot NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'mission_invalid_reward'; END IF;
        INSERT INTO public.kq_equipment_wallets(user_id) VALUES(subject) ON CONFLICT(user_id) DO NOTHING;
        SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id=subject FOR UPDATE;
        IF wallet::BIGINT+submission.reward_amount_snapshot>2147483647 THEN RAISE EXCEPTION 'mission_wallet_limit'; END IF;
        PERFORM public.kq_treasury_initialize(subject);
        UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+submission.reward_amount_snapshot,updated_at=now() WHERE user_id=subject;
        PERFORM public.kq_treasury_pair(subject,'reward','community-mission:'||submission.id::TEXT,now(),
          'suspense','revenue_rewards',submission.reward_amount_snapshot,'Mission : '||submission.mission_title_snapshot);
      ELSE RAISE EXCEPTION 'mission_invalid_reward';
    END CASE;
    UPDATE public.social_mission_reward_receipts SET reward_result=reward WHERE submission_id=submission.id;
  END IF;
  UPDATE public.social_mission_submissions SET status=p_decision,admin_note=note,reviewed_by=actor,
    reviewed_at=now(),reward_granted=(p_decision='approved'),updated_at=now()
    WHERE id=submission.id RETURNING * INTO submission;
  result:=jsonb_build_object('submission',to_jsonb(submission),'replayed',false,'reward',reward);
  INSERT INTO public.social_mission_request_receipts(request_key,user_id,submission_id,action,revision,actor,payload,result)
    VALUES(p_request_key,subject,submission.id,p_decision,submission.revision,actor,payload,result);
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_social_mission(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,INTEGER,UUID,INTEGER)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_review_social_mission(UUID,INTEGER,TEXT,TEXT,UUID,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_submit_social_mission(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,INTEGER,UUID,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_review_social_mission(UUID,INTEGER,TEXT,TEXT,UUID,TEXT) TO service_role;

-- A ready-to-edit starting point; activating and setting the final reward is an
-- explicit editorial action. Posting or following a social account is not needed.
INSERT INTO public.social_missions(slug,title,description,icon,reward_type,reward_amount,
  max_completions_per_user,requires_proof,proof_instructions,is_active,sort_order)
VALUES('fleur-en-arene','Ta Fleur entre dans l’Arène',
  'Présente ta Fleur prête au combat : envoie sa capture pour que l’équipe valide ton défi.',
  'camera','support_pack',1,1,true,
  'Ajoute une capture lisible de ta Fleur prête au combat. Son nom et ton pseudonyme doivent être visibles. Tu peux ajouter le lien de sa fiche.',
  false,100)
ON CONFLICT(slug) DO NOTHING;

NOTIFY pgrst,'reload schema';
COMMIT;
