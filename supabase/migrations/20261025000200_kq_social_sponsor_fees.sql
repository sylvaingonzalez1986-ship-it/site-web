-- Cannabis-sector campaigns pay a fee computed by the server and fixed at signing.
-- Preserve legacy contracts and all existing CAS, settlement and receipt guarantees.
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_kq_social_v2_commit(p_user_id UUID,p_command JSONB,p_expected_revision INTEGER,
 p_expected_audience INTEGER,p_next_state JSONB,p_reward_cents INTEGER DEFAULT 0) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE current_state public.kq_social_accounts%ROWTYPE; previous public.kq_social_v2_receipts%ROWTYPE;
 request_id UUID; audience INTEGER; old_social INTEGER; new_social INTEGER; wallet INTEGER;
 account JSONB; old_partner JSONB; new_partner JSONB; old_paid JSONB; new_paid JSONB; platform_code TEXT; field_name TEXT; entry JSONB; old_earned INTEGER;
BEGIN
 IF p_user_id IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR p_command->'modelVersion' IS DISTINCT FROM '2'::JSONB
  OR COALESCE(p_command->>'requestKey','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  OR p_expected_revision IS NULL OR p_expected_revision<0 OR p_expected_revision>2147483646
  OR p_expected_audience IS NULL OR p_expected_audience NOT BETWEEN 0 AND 100000
  OR p_reward_cents IS NULL OR p_reward_cents NOT BETWEEN 0 AND 600000
  OR jsonb_typeof(p_next_state) IS DISTINCT FROM 'object' OR p_next_state->'version' IS DISTINCT FROM '2'::JSONB
  OR jsonb_typeof(p_command->'expectedRevision') IS DISTINCT FROM 'number'
 THEN RAISE EXCEPTION 'social_invalid'; END IF;
 request_id:=(p_command->>'requestKey')::UUID;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 -- The shared lock serializes all social and commerce wallet changes.
 PERFORM public.rpc_kq_social_v1(p_user_id,NULL);
 SELECT * INTO previous FROM public.kq_social_v2_receipts WHERE user_id=p_user_id AND request_key=request_id;
 IF FOUND THEN
  IF previous.command IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'social_request_mismatch'; END IF;
  RETURN public.kq_social_v2_envelope(p_user_id,true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.kq_social_requests WHERE user_id=p_user_id AND request_key=request_id) THEN RAISE EXCEPTION 'social_request_mismatch'; END IF;
 SELECT * INTO current_state FROM public.kq_social_accounts WHERE user_id=p_user_id FOR UPDATE;
 SELECT followers INTO audience FROM public.kq_online_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF current_state.revision<>p_expected_revision OR audience<>p_expected_audience
  OR (p_command->>'expectedRevision')::INTEGER IS DISTINCT FROM p_expected_revision
 THEN RAISE EXCEPTION 'social_changed'; END IF;
 FOREACH field_name IN ARRAY ARRAY['revision','socialFollowers','audienceFollowers','additionalVisitsPerDay'] LOOP
  IF jsonb_typeof(p_next_state->field_name) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'social_invalid'; END IF;
 END LOOP;
 IF (p_next_state->>'revision')::INTEGER IS DISTINCT FROM p_expected_revision+1
  OR jsonb_typeof(p_next_state->'energy') IS DISTINCT FROM 'number'
  OR (p_next_state->>'energy')::INTEGER NOT BETWEEN 0 AND 100
  OR jsonb_typeof(p_next_state->'serverNow') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_next_state->'energyUpdatedAt') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_next_state->'platforms') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_next_state->'sponsors') IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_next_state->'sponsors'->'completedIds') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_next_state->'sponsors'->'declinedIds') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_next_state->'sponsors'->'earnedCents') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p_next_state->'sponsors'->'active') IS NULL
  OR jsonb_typeof(p_next_state->'sponsors'->'active') NOT IN ('object','null')
  OR (p_next_state->>'serverNow')::TIMESTAMPTZ>now()+interval '1 second'
  OR (p_next_state->>'serverNow')::TIMESTAMPTZ<now()-interval '5 minutes'
  OR jsonb_typeof(p_next_state->'history') IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_next_state->'history') NOT BETWEEN 1 AND 20
 THEN RAISE EXCEPTION 'social_invalid'; END IF;
 FOREACH platform_code IN ARRAY ARRAY['instagram','x'] LOOP
  account:=p_next_state->'platforms'->platform_code;
  IF jsonb_typeof(account) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'social_invalid'; END IF;
  FOREACH field_name IN ARRAY ARRAY['followers','haters','trust','moderation','chapter'] LOOP
   IF jsonb_typeof(account->field_name) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'social_invalid'; END IF;
  END LOOP;
  IF (account->>'followers')::INTEGER NOT BETWEEN 0 AND 50000
   OR (account->>'haters')::INTEGER NOT BETWEEN 0 AND 100 OR (account->>'trust')::INTEGER NOT BETWEEN 0 AND 100
   OR (account->>'moderation')::INTEGER NOT BETWEEN 0 AND 5 OR (account->>'chapter')::INTEGER<0
  THEN RAISE EXCEPTION 'social_invalid'; END IF;
 END LOOP;
 SELECT COALESCE(sum(followers),0)::INTEGER INTO old_social FROM public.kq_social_platforms WHERE user_id=p_user_id;
 new_social:=(p_next_state->'platforms'->'instagram'->>'followers')::INTEGER+(p_next_state->'platforms'->'x'->>'followers')::INTEGER;
 IF (p_next_state->>'socialFollowers')::INTEGER IS DISTINCT FROM new_social
  OR (p_next_state->>'audienceFollowers')::INTEGER IS DISTINCT FROM audience+new_social-old_social
  OR audience+new_social-old_social NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'social_invalid'; END IF;
 entry:=p_next_state->'history'->0;
 FOREACH field_name IN ARRAY ARRAY['followersDelta','hatersDelta','moderationDelta','energyDelta','trustDelta','rewardCents'] LOOP
  IF jsonb_typeof(entry->field_name) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'social_invalid'; END IF;
 END LOOP;
 IF entry->>'id' IS DISTINCT FROM request_id::TEXT OR (entry->>'rewardCents')::INTEGER IS DISTINCT FROM p_reward_cents
  OR (entry->>'followersDelta')::INTEGER IS DISTINCT FROM new_social-old_social THEN RAISE EXCEPTION 'social_invalid'; END IF;
 old_earned:=COALESCE((current_state.game_state->'sponsors'->>'earnedCents')::INTEGER,0);
 IF old_earned::BIGINT+p_reward_cents>2147483647
  OR (p_next_state->'sponsors'->>'earnedCents')::BIGINT IS DISTINCT FROM old_earned::BIGINT+p_reward_cents
 THEN RAISE EXCEPTION 'social_invalid'; END IF;
 -- The fee and the signing figures survive every intermediate command unchanged.
 old_partner:=current_state.game_state->'sponsors'->'active';
 new_partner:=p_next_state->'sponsors'->'active';
 IF jsonb_typeof(new_partner)='object' THEN
  IF jsonb_typeof(old_partner)='object' THEN
   IF new_partner->'sponsorId' IS DISTINCT FROM old_partner->'sponsorId'
    OR new_partner->'platform' IS DISTINCT FROM old_partner->'platform'
    OR new_partner->'rewardCents' IS DISTINCT FROM old_partner->'rewardCents'
    OR new_partner->'pricing' IS DISTINCT FROM old_partner->'pricing'
    OR new_partner->'startedAt' IS DISTINCT FROM old_partner->'startedAt'
   THEN RAISE EXCEPTION 'social_invalid'; END IF;
  ELSE
   IF p_command->>'action' IS DISTINCT FROM 'sponsor-accept'
    OR new_partner->>'sponsorId' IS DISTINCT FROM p_command->>'sponsorId'
    OR jsonb_typeof(new_partner->'rewardCents') IS DISTINCT FROM 'number'
    OR (new_partner->>'rewardCents')::INTEGER NOT BETWEEN 1 AND 600000
    OR new_partner->'progressTags' IS DISTINCT FROM '[]'::JSONB
    OR new_partner->'publicationsLeft' IS DISTINCT FROM '4'::JSONB
   THEN RAISE EXCEPTION 'social_invalid'; END IF;
   -- The application computes the fee; the command only confirms the offered sum.
   -- Historical flat-fee contracts have no pricing object or confirmation field.
   IF new_partner ? 'pricing' AND (
    jsonb_typeof(new_partner->'pricing') IS DISTINCT FROM 'object'
    OR new_partner->'pricing'->'version' IS DISTINCT FROM '1'::JSONB
    OR new_partner->'pricing'->'rewardCents' IS DISTINCT FROM new_partner->'rewardCents'
    OR jsonb_typeof(p_command->'expectedRewardCents') IS DISTINCT FROM 'number'
    OR p_command->'expectedRewardCents' IS DISTINCT FROM new_partner->'rewardCents'
   ) THEN RAISE EXCEPTION 'social_invalid'; END IF;
  END IF;
 END IF;
 -- A completed card shows an actual paid fee, even after journal truncation.
 old_paid:=COALESCE(current_state.game_state->'sponsors'->'paidRewardsCents','{}'::JSONB);
 new_paid:=COALESCE(p_next_state->'sponsors'->'paidRewardsCents','{}'::JSONB);
 IF jsonb_typeof(old_paid) IS DISTINCT FROM 'object' OR jsonb_typeof(new_paid) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'social_invalid'; END IF;
 IF p_reward_cents>0 AND old_partner->'pricing'->'version'='1'::JSONB THEN
  IF new_paid IS DISTINCT FROM old_paid||jsonb_build_object(old_partner->>'sponsorId',p_reward_cents)
  THEN RAISE EXCEPTION 'social_invalid'; END IF;
 ELSIF new_paid IS DISTINCT FROM old_paid THEN RAISE EXCEPTION 'social_invalid'; END IF;
 IF p_command->>'action'='sponsor-claim' AND p_reward_cents=0 THEN RAISE EXCEPTION 'social_invalid'; END IF;
 IF p_reward_cents>0 THEN
  IF p_command->>'action' IS DISTINCT FROM 'sponsor-claim' OR jsonb_typeof(old_partner) IS DISTINCT FROM 'object'
   OR (old_partner->>'rewardCents')::INTEGER IS DISTINCT FROM p_reward_cents
   OR jsonb_typeof(old_partner->'progressTags') IS DISTINCT FROM 'array'
   OR jsonb_array_length(old_partner->'progressTags') IS DISTINCT FROM 2
   OR current_state.game_state->'sponsors'->'completedIds' ? (old_partner->>'sponsorId')
   OR (p_next_state->'sponsors'->'completedIds' ? (old_partner->>'sponsorId')) IS NOT TRUE
   OR p_next_state->'sponsors'->'active' IS DISTINCT FROM 'null'::JSONB
  THEN RAISE EXCEPTION 'social_invalid'; END IF;
  SELECT cash_cents INTO wallet FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF wallet::BIGINT+p_reward_cents>2147483647 THEN RAISE EXCEPTION 'social_wallet_limit'; END IF;
  PERFORM public.kq_treasury_initialize(p_user_id);
  UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+p_reward_cents,updated_at=now() WHERE user_id=p_user_id;
  PERFORM public.kq_treasury_pair(p_user_id,'reward','kq-social-sponsor:'||request_id::TEXT,now(),
   'suspense','revenue_rewards',p_reward_cents,'Partenariat : '||(old_partner->>'sponsorId'));
 END IF;
 UPDATE public.kq_online_accounts SET followers=audience+new_social-old_social,revision=revision+1 WHERE user_id=p_user_id;
 UPDATE public.kq_social_accounts SET revision=p_expected_revision+1,game_state=p_next_state,
  energy=(p_next_state->>'energy')::INTEGER,energy_updated_at=(p_next_state->>'energyUpdatedAt')::TIMESTAMPTZ,
  recover_ready_at=(p_next_state->>'recoverReadyAt')::TIMESTAMPTZ WHERE user_id=p_user_id;
 FOREACH platform_code IN ARRAY ARRAY['instagram','x'] LOOP
  account:=p_next_state->'platforms'->platform_code;
  UPDATE public.kq_social_platforms SET followers=(account->>'followers')::INTEGER,haters=(account->>'haters')::INTEGER,
   moderation=(account->>'moderation')::INTEGER,chapter=(account->>'chapter')::INTEGER,next_post_at=(account->>'nextPostAt')::TIMESTAMPTZ
   WHERE user_id=p_user_id AND platform=platform_code;
 END LOOP;
 INSERT INTO public.kq_social_v2_receipts(user_id,request_key,command,result) VALUES(p_user_id,request_id,p_command,entry);
 RETURN public.kq_social_v2_envelope(p_user_id);
END $$;

REVOKE ALL ON FUNCTION public.rpc_kq_social_v2_commit(UUID,JSONB,INTEGER,INTEGER,JSONB,INTEGER)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_social_v2_commit(UUID,JSONB,INTEGER,INTEGER,JSONB,INTEGER)
 TO service_role;

COMMIT;
