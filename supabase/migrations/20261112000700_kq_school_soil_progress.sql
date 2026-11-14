BEGIN;

-- Reading/activity checkpoints are non-monetary and deliberately separate from
-- the stable school:uses reward. No wallet, reward, receipt or old completion
-- is rewritten. In particular legacy lesson_ids=['uses'] proves no new lesson.
CREATE TABLE public.kq_school_soil_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_ids TEXT[] NOT NULL DEFAULT '{}' CHECK(cardinality(lesson_ids)<=20),
  checkpoint_ids TEXT[] NOT NULL DEFAULT '{}' CHECK(cardinality(checkpoint_ids)<=10),
  activity_ids TEXT[] NOT NULL DEFAULT '{}' CHECK(cardinality(activity_ids)<=20),
  resume_lesson_id TEXT,
  revision BIGINT NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 9007199254740991),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kq_school_soil_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_school_soil_progress FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_school_soil_snapshot(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('version',1,'ownerId',p_user_id,
    'lessonIds',COALESCE(to_jsonb(progress.lesson_ids),'[]'::JSONB),
    'checkpointIds',COALESCE(to_jsonb(progress.checkpoint_ids),'[]'::JSONB),
    'activityIds',COALESCE(to_jsonb(progress.activity_ids),'[]'::JSONB),
    'resumeLessonId',progress.resume_lesson_id,'revision',COALESCE(progress.revision,0),
    'updatedAt',progress.updated_at,'resumeConflict',false)
  FROM (VALUES(p_user_id)) owner(id)
  LEFT JOIN public.kq_school_soil_progress progress ON progress.user_id=owner.id;
$$;

CREATE FUNCTION public.rpc_kq_school_soil(p_user_id UUID,p_command JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  chapters CONSTANT TEXT[]:=ARRAY['physical','rhizosphere','life','organic','nutrients','measures','inputs','amendments','analysis','hemp'];
  allowed_lessons TEXT[]; allowed_checkpoints TEXT[]; allowed_activities TEXT[];
  previous public.kq_school_soil_progress%ROWTYPE;
  lessons TEXT[]; checkpoints TEXT[]; activities TEXT[]; next_lesson TEXT;
  has_position BOOLEAN; expected_revision BIGINT; conflict BOOLEAN:=false;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'school_soil_invalid'; END IF;
  IF p_command IS NULL THEN RETURN public.kq_school_soil_snapshot(p_user_id); END IF;
  IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'school_soil_invalid'; END IF;
  has_position:=p_command ? 'resumeLessonId';
  IF (SELECT count(*) FROM jsonb_object_keys(p_command))<>(CASE WHEN has_position THEN 5 ELSE 3 END)
    OR jsonb_typeof(p_command->'lessonIds') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_command->'checkpointIds') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_command->'activityIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'school_soil_invalid'; END IF;
  IF jsonb_array_length(p_command->'lessonIds')>20 OR jsonb_array_length(p_command->'checkpointIds')>10
    OR jsonb_array_length(p_command->'activityIds')>20 THEN RAISE EXCEPTION 'school_soil_invalid'; END IF;
  SELECT array_agg('soil-'||chapter||'-'||lesson ORDER BY chapter,lesson) INTO allowed_lessons FROM unnest(chapters) chapter CROSS JOIN generate_series(1,2) lesson;
  SELECT array_agg('soil-'||chapter||'-checkpoint' ORDER BY chapter) INTO allowed_checkpoints FROM unnest(chapters) chapter;
  SELECT array_agg('soil-'||chapter||'-activity-'||lesson ORDER BY chapter,lesson) INTO allowed_activities FROM unnest(chapters) chapter CROSS JOIN generate_series(1,2) lesson;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'lessonIds') value WHERE jsonb_typeof(value)<>'string' OR NOT (value#>>'{}')=ANY(allowed_lessons))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'checkpointIds') value WHERE jsonb_typeof(value)<>'string' OR NOT (value#>>'{}')=ANY(allowed_checkpoints))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'activityIds') value WHERE jsonb_typeof(value)<>'string' OR NOT (value#>>'{}')=ANY(allowed_activities)) THEN
    RAISE EXCEPTION 'school_soil_invalid';
  END IF;
  IF has_position THEN
    IF jsonb_typeof(p_command->'expectedRevision') IS DISTINCT FROM 'number'
      OR COALESCE(p_command->>'expectedRevision','') !~ '^[0-9]{1,16}$'
      OR (p_command->'resumeLessonId'<>'null'::JSONB AND
        (jsonb_typeof(p_command->'resumeLessonId') IS DISTINCT FROM 'string' OR NOT (p_command->>'resumeLessonId')=ANY(allowed_lessons))) THEN
      RAISE EXCEPTION 'school_soil_invalid';
    END IF;
    expected_revision:=(p_command->>'expectedRevision')::BIGINT;
    IF expected_revision>9007199254740991 THEN RAISE EXCEPTION 'school_soil_invalid'; END IF;
  END IF;
  -- Lock only this learning row. No wallet/treasury access and no money side effect.
  INSERT INTO public.kq_school_soil_progress(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO previous FROM public.kq_school_soil_progress WHERE user_id=p_user_id FOR UPDATE;
  SELECT ARRAY(SELECT DISTINCT id FROM unnest(previous.lesson_ids||ARRAY(SELECT jsonb_array_elements_text(p_command->'lessonIds'))) id ORDER BY id) INTO lessons;
  SELECT ARRAY(SELECT DISTINCT id FROM unnest(previous.checkpoint_ids||ARRAY(SELECT jsonb_array_elements_text(p_command->'checkpointIds'))) id ORDER BY id) INTO checkpoints;
  SELECT ARRAY(SELECT DISTINCT id FROM unnest(previous.activity_ids||ARRAY(SELECT jsonb_array_elements_text(p_command->'activityIds'))) id ORDER BY id) INTO activities;
  next_lesson:=previous.resume_lesson_id;
  IF has_position THEN
    IF expected_revision=previous.revision OR previous.resume_lesson_id IS NOT DISTINCT FROM p_command->>'resumeLessonId' THEN
      next_lesson:=p_command->>'resumeLessonId';
    ELSE conflict:=true;
    END IF;
  END IF;
  IF lessons IS DISTINCT FROM previous.lesson_ids OR checkpoints IS DISTINCT FROM previous.checkpoint_ids
    OR activities IS DISTINCT FROM previous.activity_ids OR next_lesson IS DISTINCT FROM previous.resume_lesson_id THEN
    UPDATE public.kq_school_soil_progress SET lesson_ids=lessons,checkpoint_ids=checkpoints,activity_ids=activities,
      resume_lesson_id=next_lesson,revision=revision+1,updated_at=now() WHERE user_id=p_user_id;
  END IF;
  RETURN public.kq_school_soil_snapshot(p_user_id)||jsonb_build_object('resumeConflict',conflict);
END $$;

REVOKE ALL ON FUNCTION public.kq_school_soil_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_school_soil(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_school_soil(UUID,JSONB) TO service_role;
COMMIT;
