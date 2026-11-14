BEGIN;
-- Learning feedback fixes the first answer. No money is awarded here.
CREATE TABLE public.kq_school_question_feedback (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  quiz_id TEXT NOT NULL,
  content_version TEXT NOT NULL,
  selection_id TEXT NOT NULL,
  checks JSONB NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(checks)='object'),
  PRIMARY KEY(user_id,request_key),
  UNIQUE(user_id,selection_id)
);
ALTER TABLE public.kq_school_question_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_school_question_feedback FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_school_check(p_user_id UUID,p_command JSONB,p_correction JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  request_ref UUID;
  entry public.kq_school_question_feedback%ROWTYPE;
  question TEXT:=p_command->>'questionId';
  previous JSONB;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_command))<>6
    OR COALESCE(p_command->>'quizId','') NOT IN ('plant','molecules','profiles','genetics','history','uses','evidence','biodiversity','law','prevention')
    OR COALESCE(p_command->>'contentVersion','') !~ '^[a-zA-Z0-9._-]{1,64}$'
    OR COALESCE(p_command->>'selectionId','') !~ '^[a-z]1\.[0-9a-f-]{36}\.[0-9a-f]{64}$'
    OR COALESCE(question,'') !~ '^[a-z0-9-]{1,80}$'
    OR COALESCE(p_command->>'optionId','') !~ '^[a-z0-9-]{1,80}$'
    OR jsonb_typeof(p_correction) IS DISTINCT FROM 'object'
    OR p_correction->>'questionId' IS DISTINCT FROM question
    OR p_correction->>'optionId' IS DISTINCT FROM p_command->>'optionId'
    OR jsonb_typeof(p_correction->'isCorrect') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_correction->'explanation') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'school_feedback_invalid'; END IF;
  request_ref:=(p_command->>'requestKey')::UUID;
  IF request_ref IS NULL THEN RAISE EXCEPTION 'school_feedback_invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT||':'||(p_command->>'selectionId'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT||':'||request_ref::TEXT,0));
  INSERT INTO public.kq_school_question_feedback(user_id,request_key,quiz_id,content_version,selection_id)
    VALUES(p_user_id,request_ref,p_command->>'quizId',p_command->>'contentVersion',p_command->>'selectionId')
    ON CONFLICT DO NOTHING;
  SELECT * INTO entry FROM public.kq_school_question_feedback WHERE user_id=p_user_id AND request_key=request_ref FOR UPDATE;
  IF entry.quiz_id IS DISTINCT FROM p_command->>'quizId' OR entry.content_version IS DISTINCT FROM p_command->>'contentVersion'
    OR entry.selection_id IS DISTINCT FROM p_command->>'selectionId' THEN RAISE EXCEPTION 'school_feedback_mismatch'; END IF;
  previous:=entry.checks->question;
  IF previous IS NOT NULL THEN
    IF previous->>'optionId' IS DISTINCT FROM p_command->>'optionId' THEN RAISE EXCEPTION 'school_feedback_locked'; END IF;
    RETURN jsonb_build_object('correction',previous,'replayed',true);
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(entry.checks))>=10 THEN RAISE EXCEPTION 'school_feedback_invalid'; END IF;
  UPDATE public.kq_school_question_feedback SET checks=checks||jsonb_build_object(question,p_correction)
    WHERE user_id=p_user_id AND request_key=request_ref;
  RETURN jsonb_build_object('correction',p_correction,'replayed',false);
END $$;

-- Wrap the unchanged monetary RPC; its receipt identity and command stay intact.
CREATE FUNCTION public.rpc_kq_school_submit_checked(p_user_id UUID,p_command JSONB,p_grading JSONB,p_selection_id TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  request_ref UUID:=(p_command->>'requestKey')::UUID;
  entry public.kq_school_question_feedback%ROWTYPE;
  completed JSONB;
BEGIN
  IF p_user_id IS NULL OR request_ref IS NULL OR p_command->>'action' IS DISTINCT FROM 'submit' THEN RAISE EXCEPTION 'school_invalid'; END IF;
  IF p_selection_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT||':'||p_selection_id,0));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT||':'||request_ref::TEXT,0));
  IF EXISTS(SELECT 1 FROM public.kq_school_receipts WHERE user_id=p_user_id AND request_key=request_ref) THEN
    RETURN public.rpc_kq_school(p_user_id,p_command,p_grading);
  END IF;
  IF EXISTS(SELECT 1 FROM public.kq_school_question_feedback WHERE user_id=p_user_id AND selection_id=p_selection_id AND request_key<>request_ref) THEN
    RAISE EXCEPTION 'school_feedback_mismatch';
  END IF;
  SELECT * INTO entry FROM public.kq_school_question_feedback WHERE user_id=p_user_id AND request_key=request_ref;
  IF FOUND THEN
    IF entry.quiz_id IS DISTINCT FROM p_command->>'quizId' OR entry.content_version IS DISTINCT FROM p_command->>'contentVersion'
      OR entry.selection_id IS DISTINCT FROM p_selection_id THEN RAISE EXCEPTION 'school_feedback_mismatch'; END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(entry.checks))<>10 OR jsonb_typeof(p_command->'answers') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_command->'answers')<>10 THEN RAISE EXCEPTION 'school_feedback_incomplete'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'answers') answer
      WHERE entry.checks->(answer->>'questionId')->>'optionId' IS DISTINCT FROM answer->>'optionId') THEN RAISE EXCEPTION 'school_feedback_locked'; END IF;
  END IF;
  completed:=public.rpc_kq_school(p_user_id,p_command,p_grading);
  -- Direct completion remains compatible with old drafts, but disclosing its
  -- complete correction consumes this signed selection just like step checks.
  -- Receipt replay above remains valid even after version/key rotation.
  IF p_selection_id IS NOT NULL AND entry.user_id IS NULL THEN
    INSERT INTO public.kq_school_question_feedback(user_id,request_key,quiz_id,content_version,selection_id,checks)
    VALUES(p_user_id,request_ref,p_command->>'quizId',p_command->>'contentVersion',p_selection_id,
      (SELECT jsonb_object_agg(item->>'questionId',item) FROM jsonb_array_elements(p_grading->'corrections') item));
  END IF;
  RETURN completed;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_school_check(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_school_submit_checked(UUID,JSONB,JSONB,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_school_check(UUID,JSONB,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_school_submit_checked(UUID,JSONB,JSONB,TEXT) TO service_role;
COMMIT;
