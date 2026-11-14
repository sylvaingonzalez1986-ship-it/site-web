BEGIN;

-- Economy: 10.00 game euros per quiz; 100.00 in total, once per player.
-- This is 10% of the 1,000.00 starting wallet and below the climate controller
-- (139.00). A quiz pays at most one fifth of a first-step mission (50.00).
-- Budget is deliberately independent from editorial versions.
-- A deliberate later named-object migration may adjust budget_cents. Never
-- recreate reward_id for a correction, a new answer order or a redeployment.
CREATE TABLE public.kq_school_catalog (
  reward_id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL UNIQUE,
  budget_cents INTEGER NOT NULL CHECK (budget_cents BETWEEN 0 AND 10000)
);
INSERT INTO public.kq_school_catalog(reward_id,quiz_id,budget_cents)
SELECT 'school:'||quiz_id,quiz_id,1000 FROM unnest(ARRAY[
  'plant','molecules','profiles','genetics','history','uses','evidence','biodiversity','law','prevention'
]) quiz_id;

CREATE TABLE public.kq_school_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_ids TEXT[] NOT NULL DEFAULT '{}',
  workshop_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.kq_school_quiz_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL REFERENCES public.kq_school_catalog(reward_id),
  best_score INTEGER NOT NULL CHECK(best_score BETWEEN 0 AND 10),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(paid_cents >= 0),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,reward_id)
);
CREATE TABLE public.kq_school_receipts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  command JSONB NOT NULL CHECK(jsonb_typeof(command)='object'),
  result JSONB NOT NULL CHECK(jsonb_typeof(result)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_key)
);

ALTER TABLE public.kq_school_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_school_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_school_quiz_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_school_receipts ENABLE ROW LEVEL SECURITY;
-- Even service_role cannot overwrite rewarded scores or receipts via Data API.
-- There are no direct application table reads: the sole public entry is the RPC.
REVOKE ALL ON public.kq_school_catalog FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_progress FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_quiz_progress FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_school_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'version',1,'ownerId',p_user_id,'cashCents',wallet.cash_cents,
    'lessonIds',COALESCE(to_jsonb(progress.lesson_ids),'[]'::JSONB),
    'workshopIds',COALESCE(to_jsonb(progress.workshop_ids),'[]'::JSONB),
    'quizzes',(SELECT jsonb_agg(jsonb_build_object(
      'quizId',catalog.quiz_id,'rewardId',catalog.reward_id,'budgetCents',catalog.budget_cents,
      'bestScore',quiz.best_score,'paidCents',COALESCE(quiz.paid_cents,0),
      'remainingCents',GREATEST(0,catalog.budget_cents-COALESCE(quiz.paid_cents,0)),
      'attempts',COALESCE(quiz.attempts,0),'lastAttemptAt',quiz.last_attempt_at
    ) ORDER BY catalog.quiz_id) FROM public.kq_school_catalog catalog
      LEFT JOIN public.kq_school_quiz_progress quiz ON quiz.user_id=p_user_id AND quiz.reward_id=catalog.reward_id),
    'totalBudgetCents',(SELECT COALESCE(sum(budget_cents),0) FROM public.kq_school_catalog),
    'totalPaidCents',(SELECT COALESCE(sum(paid_cents),0) FROM public.kq_school_quiz_progress WHERE user_id=p_user_id)
  ) FROM public.kq_equipment_wallets wallet
    LEFT JOIN public.kq_school_progress progress ON progress.user_id=wallet.user_id
    WHERE wallet.user_id=p_user_id;
$$;

-- The authenticated Next server establishes ownership and grades against its
-- server-only answer bank. Browser-supplied scores/budgets are never forwarded.
-- A NULL grade can only replay a previous exact submission, e.g. after a deploy.
CREATE FUNCTION public.rpc_kq_school(p_user_id UUID,p_command JSONB DEFAULT NULL,p_grading JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  cash BIGINT; action TEXT; request_ref UUID; previous public.kq_school_receipts%ROWTYPE;
  catalog public.kq_school_catalog%ROWTYPE; quiz public.kq_school_quiz_progress%ROWTYPE;
  score INTEGER; target INTEGER; gain INTEGER; paid INTEGER; best INTEGER; result JSONB;
  lessons TEXT[]; workshops TEXT[]; answer_count INTEGER; question_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'school_invalid'; END IF;
  -- Wallet FIRST is the shared lock order used throughout the game's economy.
  -- It protects updates across different quizzes, tabs and other wallet users.
  SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'school_profile'; END IF;
  IF p_command IS NULL THEN
    IF p_grading IS NOT NULL THEN RAISE EXCEPTION 'school_invalid'; END IF;
    RETURN public.kq_school_snapshot(p_user_id);
  END IF;
  IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'school_invalid'; END IF;
  action:=p_command->>'action';
  IF action='progress' THEN
    IF p_grading IS NOT NULL OR (SELECT count(*) FROM jsonb_object_keys(p_command))<>3
      OR jsonb_typeof(p_command->'lessonIds') IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_command->'workshopIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'school_invalid'; END IF;
    IF jsonb_array_length(p_command->'lessonIds')>10 OR jsonb_array_length(p_command->'workshopIds')>6 THEN RAISE EXCEPTION 'school_invalid'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'lessonIds') value WHERE jsonb_typeof(value)<>'string'
      OR NOT EXISTS(SELECT 1 FROM public.kq_school_catalog WHERE quiz_id=value#>>'{}'))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'workshopIds') value WHERE jsonb_typeof(value)<>'string'
        OR value#>>'{}' NOT IN ('crossword-plant','crossword-uses','timeline-history','matching-plant','matching-evidence','matching-molecules')) THEN
      RAISE EXCEPTION 'school_invalid';
    END IF;
    SELECT COALESCE(array_agg(DISTINCT value ORDER BY value),'{}') INTO lessons FROM jsonb_array_elements_text(p_command->'lessonIds');
    SELECT COALESCE(array_agg(DISTINCT value ORDER BY value),'{}') INTO workshops FROM jsonb_array_elements_text(p_command->'workshopIds');
    INSERT INTO public.kq_school_progress(user_id,lesson_ids,workshop_ids) VALUES(p_user_id,lessons,workshops)
    ON CONFLICT(user_id) DO UPDATE SET
      lesson_ids=ARRAY(SELECT DISTINCT id FROM unnest(public.kq_school_progress.lesson_ids||EXCLUDED.lesson_ids) id ORDER BY id),
      workshop_ids=ARRAY(SELECT DISTINCT id FROM unnest(public.kq_school_progress.workshop_ids||EXCLUDED.workshop_ids) id ORDER BY id),updated_at=now();
    RETURN public.kq_school_snapshot(p_user_id);
  END IF;
  IF action IS DISTINCT FROM 'submit' OR (SELECT count(*) FROM jsonb_object_keys(p_command))<>5
    OR COALESCE(p_command->>'requestKey','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR COALESCE(p_command->>'contentVersion','') !~ '^[a-zA-Z0-9._-]{1,64}$'
    OR jsonb_typeof(p_command->'answers') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'school_invalid'; END IF;
  SELECT * INTO catalog FROM public.kq_school_catalog WHERE quiz_id=p_command->>'quizId';
  IF NOT FOUND THEN RAISE EXCEPTION 'school_invalid'; END IF;
  SELECT count(*),count(DISTINCT value->>'questionId') INTO answer_count,question_count FROM jsonb_array_elements(p_command->'answers');
  IF answer_count<>10 OR question_count<>10 THEN RAISE EXCEPTION 'school_invalid'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'answers') value WHERE
    jsonb_typeof(value) IS DISTINCT FROM 'object'
    OR COALESCE(value->>'questionId','') !~ '^[a-z0-9-]{1,80}$'
    OR COALESCE(value->>'optionId','') !~ '^[a-z0-9-]{1,80}$') THEN RAISE EXCEPTION 'school_invalid'; END IF;
  request_ref:=(p_command->>'requestKey')::UUID;
  SELECT * INTO previous FROM public.kq_school_receipts WHERE user_id=p_user_id AND request_key=request_ref;
  IF FOUND THEN
    IF previous.command IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'school_request_mismatch'; END IF;
    RETURN jsonb_build_object('snapshot',public.kq_school_snapshot(p_user_id),'result',previous.result,'replayed',true);
  END IF;
  IF p_grading IS NULL THEN RAISE EXCEPTION 'school_version'; END IF;
  IF jsonb_typeof(p_grading) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_grading->'score') IS DISTINCT FROM 'number'
    OR COALESCE(p_grading->>'score','') !~ '^(10|[0-9])$'
    OR jsonb_typeof(p_grading->'corrections') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'school_invalid_grade'; END IF;
  IF jsonb_array_length(p_grading->'corrections')<>10 THEN RAISE EXCEPTION 'school_invalid_grade'; END IF;
  score:=(p_grading->>'score')::INTEGER;
  INSERT INTO public.kq_school_quiz_progress(user_id,reward_id,best_score) VALUES(p_user_id,catalog.reward_id,score) ON CONFLICT DO NOTHING;
  SELECT * INTO quiz FROM public.kq_school_quiz_progress WHERE user_id=p_user_id AND reward_id=catalog.reward_id FOR UPDATE;
  -- Integer division floors cent amounts. Scores below seven earn no cents.
  target:=CASE WHEN score<7 THEN 0 ELSE catalog.budget_cents*score/10 END;
  gain:=GREATEST(0,target-quiz.paid_cents); paid:=quiz.paid_cents+gain; best:=GREATEST(quiz.best_score,score);
  IF cash+gain>2147483647 THEN RAISE EXCEPTION 'school_wallet_limit'; END IF;
  IF gain>0 THEN
    PERFORM public.kq_treasury_initialize(p_user_id);
    UPDATE public.kq_equipment_wallets SET cash_cents=cash_cents+gain,updated_at=now() WHERE user_id=p_user_id;
    -- Existing wallet trigger records cash/suspense; identify the matching income.
    PERFORM public.kq_treasury_pair(p_user_id,'school-reward','school:'||request_ref,now(),'suspense','revenue_rewards',gain,'École des Chanvriers · '||catalog.quiz_id);
    UPDATE public.kq_commerce_accounts SET revision=revision+1 WHERE user_id=p_user_id;
  END IF;
  UPDATE public.kq_school_quiz_progress SET best_score=best,paid_cents=paid,attempts=attempts+1,last_attempt_at=now()
    WHERE user_id=p_user_id AND reward_id=catalog.reward_id;
  result:=jsonb_build_object('requestKey',request_ref,'quizId',catalog.quiz_id,'contentVersion',p_command->>'contentVersion',
    'score',score,'bestScore',best,'passed',score>=7,'gainCents',gain,'paidCents',paid,
    'remainingCents',GREATEST(0,catalog.budget_cents-paid),'cashCents',cash+gain,'corrections',p_grading->'corrections');
  INSERT INTO public.kq_school_receipts(user_id,request_key,command,result) VALUES(p_user_id,request_ref,p_command,result);
  RETURN jsonb_build_object('snapshot',public.kq_school_snapshot(p_user_id),'result',result,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.kq_school_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_school(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_school(UUID,JSONB,JSONB) TO service_role;

COMMIT;
