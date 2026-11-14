BEGIN;
-- Points only: these private relations never read or write a wallet or reward.
CREATE TABLE public.kq_school_challenge_players (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_round_id UUID,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK(best_score BETWEEN 0 AND 3000),
  best_correct_count INTEGER NOT NULL DEFAULT 0 CHECK(best_correct_count BETWEEN 0 AND 20),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK(completed_count>=0)
);
CREATE TABLE public.kq_school_challenge_rounds (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id UUID NOT NULL,
  content_version TEXT NOT NULL,
  plan JSONB NOT NULL CHECK(jsonb_typeof(plan)='array' AND jsonb_array_length(plan)=20),
  position INTEGER NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 19),
  status TEXT NOT NULL DEFAULT 'question' CHECK(status IN ('question','feedback','complete')),
  opened_at TIMESTAMPTZ NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(answers)='array' AND jsonb_array_length(answers)<=20),
  score INTEGER NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 3000),
  correct_count INTEGER NOT NULL DEFAULT 0 CHECK(correct_count BETWEEN 0 AND 20),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(user_id,id)
);
CREATE TABLE public.kq_school_challenge_requests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  command JSONB NOT NULL,
  PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_school_challenge_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_school_challenge_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_school_challenge_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_school_challenge_players FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_challenge_rounds FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_challenge_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_school_challenge_snapshot(p_user_id UUID,p_replayed BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE player public.kq_school_challenge_players%ROWTYPE; round public.kq_school_challenge_rounds%ROWTYPE; visible JSONB:=NULL;
BEGIN
  SELECT * INTO STRICT player FROM public.kq_school_challenge_players WHERE user_id=p_user_id;
  IF player.active_round_id IS NOT NULL THEN
    SELECT * INTO STRICT round FROM public.kq_school_challenge_rounds WHERE user_id=p_user_id AND id=player.active_round_id;
    visible:=jsonb_build_object('id',round.id,'contentVersion',round.content_version,'status',round.status,
      'questionNumber',round.position+1,'totalQuestions',20,'level',round.position/5+1,
      'score',round.score,'correctCount',round.correct_count,'answeredCount',jsonb_array_length(round.answers),'openedAt',round.opened_at,
      'question',CASE WHEN round.status='complete' THEN NULL ELSE round.plan->round.position->'question' END,
      'feedback',CASE WHEN round.status='feedback' THEN round.answers->round.position ELSE NULL END,'answers',round.answers);
  END IF;
  RETURN jsonb_build_object('version',1,'ownerId',p_user_id,'serverNow',clock_timestamp(),'bestScore',player.best_score,
    'bestCorrectCount',player.best_correct_count,'completedCount',player.completed_count,'round',visible,'replayed',p_replayed);
END $$;

CREATE FUNCTION public.rpc_kq_school_challenge(p_user_id UUID,p_command JSONB DEFAULT NULL,p_plan JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  player public.kq_school_challenge_players%ROWTYPE; round public.kq_school_challenge_rounds%ROWTYPE;
  request_ref UUID; previous JSONB; item JSONB; question JSONB; reference JSONB; feedback JSONB;
  received_at TIMESTAMPTZ:=clock_timestamp(); elapsed BIGINT; bonus INTEGER; correct BOOLEAN; replayed BOOLEAN:=false;
  ordinal INTEGER; action TEXT:=p_command->>'action';
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'school_challenge_invalid'; END IF;
  INSERT INTO public.kq_school_challenge_players(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT player FROM public.kq_school_challenge_players WHERE user_id=p_user_id FOR UPDATE;
  IF p_command IS NULL THEN RETURN public.kq_school_challenge_snapshot(p_user_id); END IF;
  IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR COALESCE(action,'') NOT IN ('start','answer','next')
    OR COALESCE(p_command->>'requestKey','') !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'school_challenge_invalid'; END IF;
  request_ref:=(p_command->>'requestKey')::UUID;
  SELECT command INTO previous FROM public.kq_school_challenge_requests WHERE user_id=p_user_id AND request_key=request_ref;
  IF FOUND THEN
    IF previous IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'school_challenge_request_mismatch'; END IF;
    RETURN public.kq_school_challenge_snapshot(p_user_id,true);
  END IF;
  IF action='start' THEN
    IF (p_command-ARRAY['action','requestKey','replaceRoundId'])<>'{}'::JSONB THEN RAISE EXCEPTION 'school_challenge_invalid'; END IF;
    IF player.active_round_id IS DISTINCT FROM (p_command->>'replaceRoundId')::UUID THEN RAISE EXCEPTION 'school_challenge_round_changed'; END IF;
    IF jsonb_typeof(p_plan->'questions') IS DISTINCT FROM 'array' OR jsonb_array_length(p_plan->'questions')<>20
      OR COALESCE(p_plan->>'contentVersion','') !~ '^[a-zA-Z0-9._-]{1,64}$' THEN RAISE EXCEPTION 'school_challenge_invalid_plan'; END IF;
    IF (SELECT count(DISTINCT entry->'question'->>'id') FROM jsonb_array_elements(p_plan->'questions') entry)<>20 THEN RAISE EXCEPTION 'school_challenge_invalid_plan'; END IF;
    IF (SELECT count(DISTINCT entry->'question'->>'themeId') FROM jsonb_array_elements(p_plan->'questions') entry)<>9 THEN RAISE EXCEPTION 'school_challenge_invalid_plan'; END IF;
    FOR item,ordinal IN SELECT value,ordinality::INTEGER FROM jsonb_array_elements(p_plan->'questions') WITH ORDINALITY LOOP
      question:=item->'question'; reference:=item->'answer';
      IF question->>'level' IS DISTINCT FROM (((ordinal-1)/5)+1)::TEXT
        OR jsonb_typeof(question->'prompt') IS DISTINCT FROM 'string'
        OR jsonb_typeof(question->'sources') IS DISTINCT FROM 'array'
        OR COALESCE(question->>'id','') !~ '^[a-z0-9-]{1,80}$'
        OR COALESCE(question->>'themeId','') NOT IN ('history','plant','molecules','evidence','genetics','biodiversity','uses','profiles','prevention')
        OR jsonb_typeof(question->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(question->'options')<>4
        OR (SELECT count(DISTINCT option->>'id') FROM jsonb_array_elements(question->'options') option)<>4
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(question->'options') option WHERE option->>'id'=reference->>'correctOptionId')
        OR jsonb_typeof(reference->'explanation') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'school_challenge_invalid_plan'; END IF;
    END LOOP;
    INSERT INTO public.kq_school_challenge_rounds(user_id,id,content_version,plan,opened_at)
      VALUES(p_user_id,request_ref,p_plan->>'contentVersion',p_plan->'questions',clock_timestamp());
    UPDATE public.kq_school_challenge_players SET active_round_id=request_ref WHERE user_id=p_user_id;
  ELSE
    IF (p_command-CASE WHEN action='answer' THEN ARRAY['action','requestKey','roundId','questionId','optionId'] ELSE ARRAY['action','requestKey','roundId','questionId'] END)<>'{}'::JSONB
      OR COALESCE(p_command->>'questionId','') !~ '^[a-z0-9-]{1,80}$' THEN RAISE EXCEPTION 'school_challenge_invalid'; END IF;
    IF player.active_round_id IS NULL OR player.active_round_id IS DISTINCT FROM (p_command->>'roundId')::UUID THEN RAISE EXCEPTION 'school_challenge_round_changed'; END IF;
    SELECT * INTO STRICT round FROM public.kq_school_challenge_rounds WHERE user_id=p_user_id AND id=player.active_round_id;
    SELECT value INTO previous FROM jsonb_array_elements(round.answers) WHERE value->>'questionId'=p_command->>'questionId';
    IF action='answer' AND previous IS NOT NULL THEN
      IF previous->>'optionId' IS DISTINCT FROM p_command->>'optionId' THEN RAISE EXCEPTION 'school_challenge_answer_locked'; END IF;
      replayed:=true;
    ELSIF action='next' AND previous IS NOT NULL AND (round.status='complete' OR round.plan->round.position->'question'->>'id' IS DISTINCT FROM p_command->>'questionId') THEN
      replayed:=true;
    ELSE
      item:=round.plan->round.position; question:=item->'question'; reference:=item->'answer';
      IF question->>'id' IS DISTINCT FROM p_command->>'questionId' THEN RAISE EXCEPTION 'school_challenge_question_changed'; END IF;
      IF action='answer' THEN
        IF round.status<>'question' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(question->'options') option WHERE option->>'id'=p_command->>'optionId') THEN RAISE EXCEPTION 'school_challenge_invalid'; END IF;
        -- A request guessed before Next opened this question cannot gain a
        -- zero-time bonus while waiting for the previous transaction's lock.
        IF received_at<round.opened_at THEN RAISE EXCEPTION 'school_challenge_question_changed'; END IF;
        elapsed:=GREATEST(0,floor(extract(epoch FROM received_at-round.opened_at)*1000))::BIGINT;
        correct:=p_command->>'optionId'=reference->>'correctOptionId';
        bonus:=CASE WHEN correct THEN floor(50*GREATEST(0,20000-elapsed)/20000.0)::INTEGER ELSE 0 END;
        feedback:=jsonb_build_object('questionId',question->>'id','optionId',p_command->>'optionId','correctOptionId',reference->>'correctOptionId',
          'isCorrect',correct,'explanation',reference->>'explanation','optionExplanations',reference->'optionExplanations',
          'lessonId',question->>'lessonId','sectionId',question->>'sectionId','sources',question->'sources','buddyCodes',question->'buddyCodes',
          'question',question,'level',question->'level','basePoints',CASE WHEN correct THEN 100 ELSE 0 END,
          'bonusPoints',bonus,'awardedPoints',CASE WHEN correct THEN 100+bonus ELSE 0 END,'elapsedMs',elapsed);
        UPDATE public.kq_school_challenge_rounds SET status='feedback',answers=answers||jsonb_build_array(feedback),
          score=score+(feedback->>'awardedPoints')::INTEGER,correct_count=correct_count+CASE WHEN correct THEN 1 ELSE 0 END WHERE user_id=p_user_id AND id=round.id;
      ELSE
        IF round.status<>'feedback' THEN RAISE EXCEPTION 'school_challenge_answer_required'; END IF;
        IF round.position=19 THEN
          UPDATE public.kq_school_challenge_rounds SET status='complete',completed_at=clock_timestamp() WHERE user_id=p_user_id AND id=round.id;
          UPDATE public.kq_school_challenge_players SET best_score=GREATEST(best_score,round.score),best_correct_count=GREATEST(best_correct_count,round.correct_count),completed_count=completed_count+1 WHERE user_id=p_user_id;
        ELSE
          UPDATE public.kq_school_challenge_rounds SET position=position+1,status='question',opened_at=clock_timestamp() WHERE user_id=p_user_id AND id=round.id;
        END IF;
      END IF;
    END IF;
  END IF;
  INSERT INTO public.kq_school_challenge_requests(user_id,request_key,command) VALUES(p_user_id,request_ref,p_command);
  RETURN public.kq_school_challenge_snapshot(p_user_id,replayed);
END $$;
REVOKE ALL ON FUNCTION public.kq_school_challenge_snapshot(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_school_challenge(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_school_challenge(UUID,JSONB,JSONB) TO service_role;
COMMIT;
