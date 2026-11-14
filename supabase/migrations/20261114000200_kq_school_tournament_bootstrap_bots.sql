BEGIN;
-- Bootstrap an empty replay library with explicitly fictional practice bots.
-- Human and replay identities retain their real auth UUID. Bot UUIDs exist only
-- in this private actor registry, never in auth.users or player statistics.
CREATE TABLE public.kq_school_tournament_actors (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_code TEXT UNIQUE,
  is_bot BOOLEAN GENERATED ALWAYS AS (bot_code IS NOT NULL) STORED,
  UNIQUE(id,is_bot),
  CHECK((user_id IS NOT NULL AND id=user_id AND bot_code IS NULL)
    OR (user_id IS NULL AND bot_code IS NOT NULL AND bot_code IN ('mila','gabin','iris')))
);
ALTER TABLE public.kq_school_tournament_actors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_school_tournament_actors FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO public.kq_school_tournament_actors(id,user_id)
  SELECT DISTINCT user_id,user_id FROM public.kq_school_tournament_participants;
INSERT INTO public.kq_school_tournament_actors(id,bot_code) VALUES
  ('00000000-0000-4000-b070-000000000001','mila'),
  ('00000000-0000-4000-b070-000000000002','gabin'),
  ('00000000-0000-4000-b070-000000000003','iris');
ALTER TABLE public.kq_school_tournament_participants
  ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN bot_performance JSONB,
  ADD CONSTRAINT kq_school_tournament_bot_kind CHECK(
    (is_bot AND NOT is_replay AND bot_performance IS NOT NULL AND jsonb_typeof(bot_performance)='array' AND jsonb_array_length(bot_performance)=12)
    OR (NOT is_bot AND bot_performance IS NULL)),
  DROP CONSTRAINT kq_school_tournament_participants_user_id_fkey,
  ADD CONSTRAINT kq_school_tournament_participant_actor FOREIGN KEY(user_id,is_bot)
    REFERENCES public.kq_school_tournament_actors(id,is_bot) ON DELETE CASCADE;
-- Keep all tournament storage private. The sole API entry point remains the
-- authenticated application server's existing SECURITY DEFINER RPC.
REVOKE ALL ON public.kq_school_tournament_players FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_tournament_rooms FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_tournament_participants FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_tournament_answers FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_tournament_requests FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_tournament_championship FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_tournament_replays FROM PUBLIC,anon,authenticated,service_role;

-- A seeded, non-adaptive performance: 0..2 correct answers in each three-question
-- level, delays 6..17 seconds, all fixed at seating before any question opens.
CREATE FUNCTION public.kq_school_tournament_bot_performance(p_seed UUID,p_code TEXT) RETURNS JSONB
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_agg(jsonb_build_object(
    'isCorrect',((position%3+stage_seed%3)%3)<((stage_seed/3)%3),
    'elapsedMs',6000+delay_seed%11001) ORDER BY position)
  FROM (
    SELECT position,
      ('x'||substr(md5(p_seed::TEXT||':'||p_code||':stage:'||(position/3)::TEXT),1,7))::BIT(28)::INTEGER AS stage_seed,
      ('x'||substr(md5(p_seed::TEXT||':'||p_code||':delay:'||position::TEXT),1,7))::BIT(28)::INTEGER AS delay_seed
    FROM generate_series(0,11) position
  ) seeded;
$$;


CREATE OR REPLACE FUNCTION public.kq_school_tournament_identity(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('userId',p_user_id,'displayName',COALESCE(
    (SELECT CASE bot_code WHEN 'mila' THEN 'Mila' WHEN 'gabin' THEN 'Gabin' WHEN 'iris' THEN 'Iris' END
      FROM public.kq_school_tournament_actors WHERE id=p_user_id AND is_bot),
    (SELECT NULLIF(btrim(pseudo),'') FROM public.contest_profiles WHERE customer_id=p_user_id),
    'Joueur '||left(p_user_id::TEXT,6)),'avatarUrl',NULL);
$$;

CREATE OR REPLACE FUNCTION public.kq_school_tournament_finish(p_room_id UUID,p_reason TEXT,p_now TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.kq_school_tournament_rooms%ROWTYPE;
BEGIN
  SELECT * INTO STRICT r FROM public.kq_school_tournament_rooms WHERE id=p_room_id FOR UPDATE;
  IF r.finished_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.kq_school_tournament_rooms SET status=CASE WHEN started_at IS NULL THEN 'cancelled' ELSE 'complete' END,
    finished_at=p_now,next_at=NULL,reason=p_reason WHERE id=p_room_id;
  IF r.started_at IS NOT NULL THEN
    UPDATE public.kq_school_tournament_players p SET tournaments=p.tournaments+1,best_score=GREATEST(p.best_score,entry.score)
      FROM public.kq_school_tournament_participants entry WHERE entry.room_id=p_room_id AND entry.user_id=p.user_id AND NOT entry.is_replay AND NOT entry.is_bot;
    INSERT INTO public.kq_school_tournament_replays(user_id,source_kind,source_id,recorded_at,performance)
      SELECT p.user_id,'tournament',r.id,p_now,jsonb_agg(jsonb_build_object('isCorrect',a.correct,'elapsedMs',a.elapsed_ms) ORDER BY a.position)
      FROM public.kq_school_tournament_participants p JOIN public.kq_school_tournament_answers a USING(room_id,user_id)
      WHERE p.room_id=r.id AND NOT p.is_replay AND NOT p.is_bot GROUP BY p.user_id HAVING count(*)=12
      ON CONFLICT(user_id,source_kind,source_id) DO NOTHING;
  END IF;
  UPDATE public.kq_school_tournament_championship SET reservation_room_id=NULL,reservation_until=NULL
    WHERE singleton AND reservation_room_id=p_room_id;
END $$;

CREATE OR REPLACE FUNCTION public.kq_school_tournament_tick(p_room_id UUID,p_now TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r public.kq_school_tournament_rooms%ROWTYPE; c public.kq_school_tournament_championship%ROWTYPE;
  finalist public.kq_school_tournament_participants%ROWTYPE;
  loser UUID; active_count INTEGER; transition_at TIMESTAMPTZ; won BOOLEAN; step INTEGER;
BEGIN
  FOR step IN 1..48 LOOP
    SELECT * INTO r FROM public.kq_school_tournament_rooms WHERE id=p_room_id FOR UPDATE;
    IF NOT FOUND OR r.status IN ('complete','cancelled') THEN RETURN; END IF;
    IF r.status='lobby' THEN
      UPDATE public.kq_school_tournament_players p SET room_id=NULL FROM public.kq_school_tournament_participants entry
        WHERE entry.room_id=r.id AND entry.user_id=p.user_id AND p.room_id=r.id AND NOT entry.is_replay AND NOT entry.is_bot AND entry.last_seen_at<p_now-interval '90 seconds';
      DELETE FROM public.kq_school_tournament_participants WHERE room_id=r.id AND NOT is_replay AND NOT is_bot AND last_seen_at<p_now-interval '90 seconds';
      IF r.last_activity_at<p_now-interval '10 minutes' OR NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND NOT is_replay AND NOT is_bot) THEN
        PERFORM public.kq_school_tournament_finish(r.id,'lobby_expired',p_now);
      ELSIF (SELECT count(*) FROM public.kq_school_tournament_participants WHERE room_id=r.id AND ready AND (is_replay OR is_bot OR last_seen_at>=p_now-interval '45 seconds'))=4 THEN
        UPDATE public.kq_school_tournament_rooms SET status='question',started_at=p_now,opened_at=p_now+interval '3 seconds',closes_at=p_now+interval '23 seconds' WHERE id=r.id;
      END IF;
      RETURN;
    END IF;
    IF r.status='question' THEN
      -- Both kinds of automated participant use a private plan fixed before
      -- this question opens. Bots never inspect or react to a human answer.
      -- Replays reproduce a recorded success/failure and response delay on the
      -- new question of the same level. The selected option is an adaptation,
      -- never presented as that player's historical answer to this question.
      INSERT INTO public.kq_school_tournament_answers(room_id,user_id,position,option_id,correct,points,elapsed_ms,answered_at)
        SELECT r.id,p.user_id,r.position,
          CASE WHEN (automated.performance->r.position->>'elapsedMs')::INTEGER>=20000 THEN NULL
            WHEN (automated.performance->r.position->>'isCorrect')::BOOLEAN THEN r.plan->r.position->'answer'->>'correctOptionId'
            ELSE (SELECT o->>'id' FROM jsonb_array_elements(r.plan->r.position->'question'->'options') o
              WHERE o->>'id'<>r.plan->r.position->'answer'->>'correctOptionId' ORDER BY md5(r.tie_seed::TEXT||p.user_id::TEXT||(o->>'id')) LIMIT 1) END,
          (automated.performance->r.position->>'isCorrect')::BOOLEAN AND (automated.performance->r.position->>'elapsedMs')::INTEGER<20000,
          CASE WHEN (automated.performance->r.position->>'isCorrect')::BOOLEAN AND (automated.performance->r.position->>'elapsedMs')::INTEGER<20000
            THEN 100+floor(50*(20000-(automated.performance->r.position->>'elapsedMs')::INTEGER)/20000.0)::INTEGER ELSE 0 END,
          (automated.performance->r.position->>'elapsedMs')::INTEGER,
          r.opened_at+((automated.performance->r.position->>'elapsedMs')||' milliseconds')::INTERVAL
        FROM public.kq_school_tournament_participants p
        LEFT JOIN public.kq_school_tournament_replays replay ON replay.id=p.replay_id
        CROSS JOIN LATERAL (SELECT CASE WHEN p.is_bot THEN p.bot_performance ELSE replay.performance END AS performance) automated
        WHERE p.room_id=r.id AND p.is_active AND (p.is_replay OR p.is_bot)
          AND r.opened_at+((automated.performance->r.position->>'elapsedMs')||' milliseconds')::INTERVAL<=p_now
        ON CONFLICT DO NOTHING;
      IF p_now<r.closes_at AND EXISTS(SELECT 1 FROM public.kq_school_tournament_participants p WHERE p.room_id=r.id AND p.is_active
        AND NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_answers a WHERE a.room_id=r.id AND a.user_id=p.user_id AND a.position=r.position)) THEN RETURN; END IF;
      INSERT INTO public.kq_school_tournament_answers(room_id,user_id,position,option_id,correct,points,elapsed_ms,answered_at)
        SELECT r.id,user_id,r.position,NULL,false,0,20000,r.closes_at FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active
        ON CONFLICT DO NOTHING;
      UPDATE public.kq_school_tournament_participants p SET stage_score=p.stage_score+a.points,score=p.score+a.points,
        stage_correct=p.stage_correct+CASE WHEN a.correct THEN 1 ELSE 0 END,stage_elapsed=p.stage_elapsed+a.elapsed_ms,
        stage_manual_answers=p.stage_manual_answers+CASE WHEN a.option_id IS NULL THEN 0 ELSE 1 END
        FROM public.kq_school_tournament_answers a WHERE a.room_id=r.id AND a.position=r.position AND p.room_id=r.id AND p.user_id=a.user_id;
      SELECT COALESCE(max(answered_at),r.closes_at) INTO transition_at FROM public.kq_school_tournament_answers WHERE room_id=r.id AND position=r.position;
      UPDATE public.kq_school_tournament_rooms SET status='reveal',next_at=transition_at+interval '6 seconds' WHERE id=r.id;
      CONTINUE;
    END IF;
    IF r.status='reveal' THEN
      IF p_now<r.next_at THEN RETURN; END IF;
      IF r.position%3<2 THEN
        UPDATE public.kq_school_tournament_rooms SET status='question',position=position+1,opened_at=r.next_at,
          closes_at=r.next_at+interval '20 seconds',next_at=NULL WHERE id=r.id;
      ELSE
        UPDATE public.kq_school_tournament_participants SET is_active=false,eliminated_stage=r.stage
          WHERE room_id=r.id AND is_active AND NOT is_replay AND NOT is_bot AND (last_seen_at<p_now-interval '45 seconds' OR stage_manual_answers=0);
        IF r.stage<4 THEN
          SELECT count(*) INTO active_count FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active;
          IF active_count>1 THEN
            SELECT user_id INTO loser FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active
              ORDER BY stage_score ASC,stage_correct ASC,stage_elapsed DESC,md5(r.tie_seed::TEXT||user_id::TEXT) DESC LIMIT 1;
            UPDATE public.kq_school_tournament_participants SET is_active=false,eliminated_stage=r.stage WHERE room_id=r.id AND user_id=loser;
          END IF;
        END IF;
        UPDATE public.kq_school_tournament_rooms SET status='stage_result',next_at=r.next_at+interval '10 seconds' WHERE id=r.id;
      END IF;
      CONTINUE;
    END IF;
    IF r.status='stage_result' THEN
      IF p_now<r.next_at THEN RETURN; END IF;
      UPDATE public.kq_school_tournament_participants SET is_active=false,eliminated_stage=r.stage
        WHERE room_id=r.id AND is_active AND NOT is_replay AND NOT is_bot AND last_seen_at<p_now-interval '45 seconds';
      SELECT count(*) INTO active_count FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active;
      IF active_count=0 THEN PERFORM public.kq_school_tournament_finish(r.id,'no_active_players',p_now); RETURN; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active AND NOT is_replay AND NOT is_bot) THEN
        PERFORM public.kq_school_tournament_finish(r.id,CASE WHEN EXISTS(
          SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active AND is_bot
        ) THEN 'bots_won' ELSE 'replay_won' END,p_now); RETURN;
      END IF;
      IF r.stage=4 THEN
        SELECT * INTO STRICT finalist FROM public.kq_school_tournament_participants WHERE room_id=r.id AND user_id=r.finalist_id;
        SELECT * INTO STRICT c FROM public.kq_school_tournament_championship WHERE singleton FOR UPDATE;
        IF c.reservation_room_id IS DISTINCT FROM r.id OR c.version IS DISTINCT FROM r.champion_version THEN
          PERFORM public.kq_school_tournament_finish(r.id,'champion_changed',p_now); RETURN;
        END IF;
        IF finalist.is_replay OR finalist.is_bot OR NOT finalist.is_active OR finalist.last_seen_at<p_now-interval '15 seconds' OR finalist.stage_manual_answers=0 THEN
          PERFORM public.kq_school_tournament_finish(r.id,'finalist_absent',p_now); RETURN;
        END IF;
        won:=c.user_id IS NULL OR (finalist.stage_score,finalist.stage_correct,-finalist.stage_elapsed)>(c.score,c.correct_count,-c.elapsed_ms);
        IF won THEN
          UPDATE public.kq_school_tournament_championship SET user_id=finalist.user_id,score=finalist.stage_score,
            correct_count=finalist.stage_correct,elapsed_ms=finalist.stage_elapsed,since=p_now,defenses=0,version=version+1 WHERE singleton;
          UPDATE public.kq_school_tournament_players SET titles=titles+1 WHERE user_id=finalist.user_id;
          UPDATE public.kq_school_tournament_rooms SET title_won=true WHERE id=r.id;
        ELSE
          UPDATE public.kq_school_tournament_championship SET defenses=defenses+1 WHERE singleton;
        END IF;
        PERFORM public.kq_school_tournament_finish(r.id,CASE WHEN won THEN 'title_won' ELSE 'champion_defended' END,p_now); RETURN;
      END IF;
      -- Bootstrap finalists still play every level: their twelve real answers
      -- become a usable replay even if all other participants leave early.
      IF (active_count=1 AND NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_bot)) OR r.stage=3 THEN
        SELECT user_id INTO loser FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active LIMIT 1;
        UPDATE public.kq_school_tournament_rooms SET status='champion_wait',stage=4,position=9,finalist_id=loser,next_at=p_now WHERE id=r.id;
        UPDATE public.kq_school_tournament_players SET finals=finals+1 WHERE user_id=loser;
      ELSE
        UPDATE public.kq_school_tournament_rooms SET status='question',stage=stage+1,position=(stage)*3,opened_at=r.next_at,
          closes_at=r.next_at+interval '20 seconds',next_at=NULL WHERE id=r.id;
        UPDATE public.kq_school_tournament_participants SET stage_score=0,stage_correct=0,stage_elapsed=0,stage_manual_answers=0 WHERE room_id=r.id AND is_active;
      END IF;
      CONTINUE;
    END IF;
    IF r.status='champion_wait' THEN
      SELECT * INTO finalist FROM public.kq_school_tournament_participants WHERE room_id=r.id AND user_id=r.finalist_id AND is_active AND NOT is_replay AND NOT is_bot;
      IF NOT FOUND OR finalist.last_seen_at<p_now-interval '45 seconds' THEN
        PERFORM public.kq_school_tournament_finish(r.id,'finalist_absent',p_now); RETURN;
      END IF;
      SELECT * INTO STRICT c FROM public.kq_school_tournament_championship WHERE singleton FOR UPDATE;
      IF c.reservation_room_id IS NOT NULL AND c.reservation_room_id<>r.id AND c.reservation_until<=p_now THEN
        PERFORM public.kq_school_tournament_tick(c.reservation_room_id,p_now);
        SELECT * INTO STRICT c FROM public.kq_school_tournament_championship WHERE singleton;
        IF c.reservation_room_id IS NOT NULL AND c.reservation_until<=p_now THEN
          PERFORM public.kq_school_tournament_finish(c.reservation_room_id,'champion_timeout',p_now);
          SELECT * INTO STRICT c FROM public.kq_school_tournament_championship WHERE singleton;
        END IF;
      END IF;
      IF c.reservation_room_id IS NOT NULL AND c.reservation_room_id<>r.id THEN
        UPDATE public.kq_school_tournament_rooms SET next_at=c.reservation_until WHERE id=r.id; RETURN;
      END IF;
      IF c.user_id=r.finalist_id THEN PERFORM public.kq_school_tournament_finish(r.id,'already_champion',p_now); RETURN; END IF;
      UPDATE public.kq_school_tournament_championship SET reservation_room_id=r.id,reservation_until=p_now+interval '150 seconds' WHERE singleton;
      UPDATE public.kq_school_tournament_participants SET stage_score=0,stage_correct=0,stage_elapsed=0,stage_manual_answers=0 WHERE room_id=r.id AND is_active;
      UPDATE public.kq_school_tournament_rooms SET status='question',champion_target=public.kq_school_tournament_champion(),champion_version=c.version,
        opened_at=p_now+interval '3 seconds',closes_at=p_now+interval '23 seconds',next_at=NULL WHERE id=r.id;
      RETURN;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'school_tournament_transition_limit';
END $$;

CREATE OR REPLACE FUNCTION public.kq_school_tournament_snapshot(p_user_id UUID,p_replayed BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.kq_school_tournament_rooms%ROWTYPE; visible JSONB:=NULL; leaders JSONB; current_question JSONB; reveal JSONB:=NULL;
BEGIN
  SELECT room.* INTO r FROM public.kq_school_tournament_players p JOIN public.kq_school_tournament_rooms room ON room.id=p.room_id WHERE p.user_id=p_user_id;
  IF FOUND THEN
    current_question:=CASE WHEN r.status IN ('question','reveal') THEN r.plan->r.position->'question' ELSE NULL END;
    IF r.status='reveal' THEN
      reveal:=jsonb_build_object('question',current_question,'correctOptionId',r.plan->r.position->'answer'->>'correctOptionId',
        'explanation',r.plan->r.position->'answer'->>'explanation','answers',COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'userId',a.user_id,'optionId',a.option_id,'isCorrect',a.correct,'awardedPoints',a.points,'elapsedMs',a.elapsed_ms) ORDER BY p.seat)
          FROM public.kq_school_tournament_answers a JOIN public.kq_school_tournament_participants p USING(room_id,user_id)
          WHERE a.room_id=r.id AND a.position=r.position),'[]'::JSONB));
    END IF;
    visible:=jsonb_build_object('id',r.id,'status',r.status,'stage',r.stage,'questionNumber',CASE WHEN r.status='lobby' THEN 0 ELSE r.position%3+1 END,
      'availableReplays',CASE WHEN r.status='lobby' THEN public.kq_school_tournament_available_replays(r.id) ELSE 0 END,
      'players',COALESCE((SELECT jsonb_agg(public.kq_school_tournament_identity(p.user_id)||jsonb_build_object(
        'seat',p.seat,'ready',p.ready,'connected',NOT p.is_replay AND NOT p.is_bot AND p.left_at IS NULL AND p.last_seen_at>=clock_timestamp()-interval '45 seconds',
        'isBot',p.is_bot,'botCode',(SELECT bot_code FROM public.kq_school_tournament_actors WHERE id=p.user_id),
        'isReplay',p.is_replay,'replayRecordedAt',(SELECT recorded_at FROM public.kq_school_tournament_replays WHERE id=p.replay_id),
        'isActive',p.is_active,'stageScore',p.stage_score,'score',p.score,'correctCount',p.stage_correct,'stageElapsedMs',p.stage_elapsed,
        'answered',EXISTS(SELECT 1 FROM public.kq_school_tournament_answers a WHERE a.room_id=r.id AND a.user_id=p.user_id AND a.position=r.position)) ORDER BY p.seat)
        FROM public.kq_school_tournament_participants p WHERE p.room_id=r.id),'[]'::JSONB),
      'question',current_question,'openedAt',r.opened_at,'closesAt',r.closes_at,'nextAt',r.next_at,
      'ownAnswerId',(SELECT option_id FROM public.kq_school_tournament_answers WHERE room_id=r.id AND user_id=p_user_id AND position=r.position),
      'reveal',reveal,'championTarget',r.champion_target,'winnerId',r.finalist_id,
      'eliminatedIds',COALESCE((SELECT jsonb_agg(user_id ORDER BY eliminated_stage,seat) FROM public.kq_school_tournament_participants WHERE room_id=r.id AND NOT is_active),'[]'::JSONB),
      'titleWon',r.title_won,'reason',r.reason);
  END IF;
  SELECT COALESCE(jsonb_agg(public.kq_school_tournament_identity(x.user_id)||jsonb_build_object('rank',x.rank,'tournaments',x.tournaments,
    'finals',x.finals,'titles',x.titles,'bestScore',x.best_score) ORDER BY x.rank),'[]'::JSONB) INTO leaders FROM (
    SELECT *,row_number() OVER(ORDER BY titles DESC,finals DESC,best_score DESC,tournaments DESC,user_id) AS rank
      FROM public.kq_school_tournament_players WHERE tournaments>0 ORDER BY titles DESC,finals DESC,best_score DESC,tournaments DESC,user_id LIMIT 50) x;
  RETURN jsonb_build_object('version',1,'ownerId',p_user_id,'serverNow',clock_timestamp(),'champion',public.kq_school_tournament_champion(),
    'leaderboard',leaders,'room',visible,'replayed',p_replayed);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_school_tournament(p_user_id UUID,p_command JSONB DEFAULT NULL,p_plan JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  received_at TIMESTAMPTZ:=clock_timestamp(); current_at TIMESTAMPTZ;
  player public.kq_school_tournament_players%ROWTYPE; r public.kq_school_tournament_rooms%ROWTYPE;
  member public.kq_school_tournament_participants%ROWTYPE; existing public.kq_school_tournament_answers%ROWTYPE;
  previous JSONB; action TEXT:=p_command->>'action'; key UUID; room_ref UUID; item JSONB; ordinal INTEGER;
  elapsed INTEGER; correct BOOLEAN; points INTEGER; seat_number INTEGER; replay_entry public.kq_school_tournament_replays%ROWTYPE; bot_entry public.kq_school_tournament_actors%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'school_tournament_invalid'; END IF;
  -- One short local transaction serializes matchmaking, room transitions and
  -- the single title. No network request runs while this lock is held.
  PERFORM pg_advisory_xact_lock(714203611140001::BIGINT);
  current_at:=clock_timestamp();
  INSERT INTO public.kq_school_tournament_players(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.kq_school_tournament_actors(id,user_id) VALUES(p_user_id,p_user_id) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO STRICT player FROM public.kq_school_tournament_players WHERE user_id=p_user_id FOR UPDATE;
  IF p_command IS NOT NULL THEN
    IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR COALESCE(action,'') NOT IN ('join','leave','ready','answer','fill_replays','fill_opponents')
      OR COALESCE(p_command->>'requestKey','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR (p_command-CASE action WHEN 'join' THEN ARRAY['action','requestKey'] WHEN 'ready' THEN ARRAY['action','requestKey','roomId','ready']
        WHEN 'leave' THEN ARRAY['action','requestKey','roomId'] WHEN 'fill_replays' THEN ARRAY['action','requestKey','roomId'] WHEN 'fill_opponents' THEN ARRAY['action','requestKey','roomId'] ELSE ARRAY['action','requestKey','roomId','questionId','optionId'] END)<>'{}'::JSONB
      THEN RAISE EXCEPTION 'school_tournament_invalid'; END IF;
    key:=(p_command->>'requestKey')::UUID;
    IF action<>'join' AND COALESCE(p_command->>'roomId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'school_tournament_invalid'; END IF;
    IF action='ready' AND jsonb_typeof(p_command->'ready') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'school_tournament_invalid'; END IF;
    IF action='answer' AND (COALESCE(p_command->>'questionId','') !~ '^[a-z0-9-]{1,80}$' OR COALESCE(p_command->>'optionId','') !~ '^[a-z0-9-]{1,80}$') THEN RAISE EXCEPTION 'school_tournament_invalid'; END IF;
    SELECT command INTO previous FROM public.kq_school_tournament_requests WHERE user_id=p_user_id AND request_key=key;
    IF FOUND AND previous IS DISTINCT FROM p_command THEN RAISE EXCEPTION 'school_tournament_request_mismatch'; END IF;
  END IF;
  IF player.room_id IS NOT NULL THEN
    -- Determine inactivity using the preceding heartbeat, before a late return
    -- can revive an eliminated finalist or reopen an expired question.
    PERFORM public.kq_school_tournament_tick(player.room_id,CASE WHEN action='answer' THEN received_at ELSE current_at END);
    SELECT * INTO STRICT player FROM public.kq_school_tournament_players WHERE user_id=p_user_id;
    UPDATE public.kq_school_tournament_participants SET last_seen_at=current_at WHERE room_id=player.room_id AND user_id=p_user_id AND left_at IS NULL;
    UPDATE public.kq_school_tournament_rooms SET last_activity_at=current_at WHERE id=player.room_id AND status NOT IN ('complete','cancelled');
  END IF;
  IF previous IS NOT NULL THEN RETURN public.kq_school_tournament_snapshot(p_user_id,true); END IF;
  IF p_command IS NULL THEN
    IF player.room_id IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM public.kq_school_tournament_rooms WHERE id=player.room_id AND status='lobby') THEN PERFORM public.kq_school_tournament_refresh_replays(); END IF;
      PERFORM public.kq_school_tournament_tick(player.room_id,current_at);
    END IF;
    RETURN public.kq_school_tournament_snapshot(p_user_id);
  END IF;
  IF action='join' THEN
    IF EXISTS(SELECT 1 FROM public.kq_school_tournament_championship WHERE singleton AND user_id=p_user_id) THEN
      RAISE EXCEPTION 'school_tournament_already_champion';
    END IF;
    PERFORM public.kq_school_tournament_refresh_replays(true);
    IF player.room_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.kq_school_tournament_rooms WHERE id=player.room_id AND status NOT IN ('complete','cancelled')) THEN
      -- Rejoining is recovery, never a second concurrent seat.
      INSERT INTO public.kq_school_tournament_requests VALUES(p_user_id,key,p_command);
      RETURN public.kq_school_tournament_snapshot(p_user_id,true);
    END IF;
    IF p_plan->>'contentVersion' IS DISTINCT FROM '2026-11-14.champion1' OR jsonb_typeof(p_plan->'questions') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_plan->'questions')<>12 OR (SELECT count(DISTINCT e->'question'->>'id') FROM jsonb_array_elements(p_plan->'questions') e)<>12 THEN
      RAISE EXCEPTION 'school_tournament_invalid_plan'; END IF;
    FOR item,ordinal IN SELECT value,ordinality::INTEGER FROM jsonb_array_elements(p_plan->'questions') WITH ORDINALITY LOOP
      IF item->'question'->>'level' IS DISTINCT FROM (((ordinal-1)/3)+1)::TEXT
        OR jsonb_typeof(item->'question'->'prompt') IS DISTINCT FROM 'string'
        OR COALESCE(item->'question'->>'id','') !~ '^[a-z0-9-]{1,80}$'
        OR jsonb_typeof(item->'question'->'sources') IS DISTINCT FROM 'array'
        OR jsonb_typeof(item->'question'->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'question'->'options')<>4
        OR (SELECT count(DISTINCT o->>'id') FROM jsonb_array_elements(item->'question'->'options') o)<>4
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(item->'question'->'options') o WHERE o->>'id'=item->'answer'->>'correctOptionId')
        OR jsonb_typeof(item->'answer'->'explanation') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'school_tournament_invalid_plan'; END IF;
    END LOOP;
    -- Reap expired waiting rooms before selecting an available seat.
    FOR room_ref IN SELECT id FROM public.kq_school_tournament_rooms WHERE status='lobby' ORDER BY created_at LOOP
      PERFORM public.kq_school_tournament_tick(room_ref,current_at);
    END LOOP;
    SELECT room.* INTO r FROM public.kq_school_tournament_rooms room WHERE room.status='lobby'
      AND (SELECT count(*) FROM public.kq_school_tournament_participants WHERE room_id=room.id)<4 ORDER BY room.created_at LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.kq_school_tournament_rooms(plan,content_version) VALUES(p_plan->'questions',p_plan->>'contentVersion') RETURNING * INTO r;
    END IF;
    SELECT candidate INTO seat_number FROM generate_series(1,4) candidate WHERE NOT EXISTS(
      SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND seat=candidate) ORDER BY candidate LIMIT 1;
    IF seat_number IS NULL THEN RAISE EXCEPTION 'school_tournament_full'; END IF;
    INSERT INTO public.kq_school_tournament_participants(room_id,user_id,seat,last_seen_at) VALUES(r.id,p_user_id,seat_number,current_at);
    UPDATE public.kq_school_tournament_players SET room_id=r.id WHERE user_id=p_user_id;
    UPDATE public.kq_school_tournament_rooms SET last_activity_at=current_at WHERE id=r.id;
  ELSE
    IF player.room_id IS NULL OR player.room_id IS DISTINCT FROM (p_command->>'roomId')::UUID THEN RAISE EXCEPTION 'school_tournament_room_changed'; END IF;
    SELECT * INTO STRICT r FROM public.kq_school_tournament_rooms WHERE id=player.room_id FOR UPDATE;
    SELECT * INTO member FROM public.kq_school_tournament_participants WHERE room_id=r.id AND user_id=p_user_id;
    IF NOT FOUND OR member.is_replay OR member.is_bot THEN RAISE EXCEPTION 'school_tournament_not_active'; END IF;
    IF action='leave' THEN
      IF r.status='lobby' THEN
        DELETE FROM public.kq_school_tournament_participants WHERE room_id=r.id AND user_id=p_user_id;
        PERFORM public.kq_school_tournament_tick(r.id,current_at);
      ELSIF r.status NOT IN ('complete','cancelled') THEN
        UPDATE public.kq_school_tournament_participants SET is_active=false,left_at=current_at,ready=false,eliminated_stage=r.stage WHERE room_id=r.id AND user_id=p_user_id;
        PERFORM public.kq_school_tournament_tick(r.id,current_at);
      END IF;
      -- Leaving also ends spectator follow-up. Keep the historical participant
      -- for the old room's result, but release this account's current room.
      UPDATE public.kq_school_tournament_players SET room_id=NULL WHERE user_id=p_user_id;
    ELSIF action='ready' THEN
      IF r.status<>'lobby' THEN RAISE EXCEPTION 'school_tournament_room_changed'; END IF;
      UPDATE public.kq_school_tournament_participants SET ready=(p_command->>'ready')::BOOLEAN WHERE room_id=r.id AND user_id=p_user_id;
      IF (SELECT count(*) FROM public.kq_school_tournament_participants WHERE room_id=r.id AND ready AND (is_replay OR is_bot OR last_seen_at>=current_at-interval '45 seconds'))=4 THEN
        UPDATE public.kq_school_tournament_rooms SET status='question',started_at=current_at,opened_at=current_at+interval '3 seconds',closes_at=current_at+interval '23 seconds' WHERE id=r.id;
      END IF;
    ELSIF action IN ('fill_replays','fill_opponents') THEN
      IF r.status<>'lobby' THEN RAISE EXCEPTION 'school_tournament_room_changed'; END IF;
      IF NOT member.ready THEN RAISE EXCEPTION 'school_tournament_not_ready'; END IF;
      PERFORM public.kq_school_tournament_refresh_replays(true);
      IF action='fill_replays' AND public.kq_school_tournament_available_replays(r.id)=0 THEN RAISE EXCEPTION 'school_tournament_replays_unavailable'; END IF;
      FOR replay_entry IN SELECT DISTINCT ON(replay.user_id) replay.* FROM public.kq_school_tournament_replays replay
        WHERE NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_participants p WHERE p.room_id=r.id AND p.user_id=replay.user_id)
          AND NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_championship c WHERE c.singleton AND c.user_id=replay.user_id)
        ORDER BY replay.user_id,replay.recorded_at DESC,replay.id DESC LOOP
        SELECT candidate INTO seat_number FROM generate_series(1,4) candidate WHERE NOT EXISTS(
          SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND seat=candidate) ORDER BY candidate LIMIT 1;
        EXIT WHEN seat_number IS NULL;
        INSERT INTO public.kq_school_tournament_actors(id,user_id) VALUES(replay_entry.user_id,replay_entry.user_id) ON CONFLICT(id) DO NOTHING;
        INSERT INTO public.kq_school_tournament_participants(room_id,user_id,seat,ready,is_replay,replay_id,last_seen_at)
          VALUES(r.id,replay_entry.user_id,seat_number,true,true,replay_entry.id,current_at);
      END LOOP;
      IF action='fill_opponents' THEN
        FOR bot_entry IN SELECT * FROM public.kq_school_tournament_actors actor WHERE actor.is_bot
          AND NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_participants p WHERE p.room_id=r.id AND p.user_id=actor.id)
          ORDER BY actor.id LOOP
          SELECT candidate INTO seat_number FROM generate_series(1,4) candidate WHERE NOT EXISTS(
            SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND seat=candidate) ORDER BY candidate LIMIT 1;
          EXIT WHEN seat_number IS NULL;
          INSERT INTO public.kq_school_tournament_participants(room_id,user_id,seat,ready,is_bot,bot_performance,last_seen_at)
            VALUES(r.id,bot_entry.id,seat_number,true,true,public.kq_school_tournament_bot_performance(r.tie_seed,bot_entry.bot_code),current_at);
        END LOOP;
      END IF;
      PERFORM public.kq_school_tournament_tick(r.id,current_at);
    ELSE
      SELECT * INTO existing FROM public.kq_school_tournament_answers a WHERE room_id=r.id AND user_id=p_user_id
        AND r.plan->a.position->'question'->>'id'=p_command->>'questionId';
      IF FOUND THEN
        IF existing.option_id IS DISTINCT FROM p_command->>'optionId' THEN RAISE EXCEPTION 'school_tournament_answer_locked'; END IF;
        INSERT INTO public.kq_school_tournament_requests VALUES(p_user_id,key,p_command);
        RETURN public.kq_school_tournament_snapshot(p_user_id,true);
      END IF;
      IF NOT member.is_active OR member.left_at IS NOT NULL THEN RAISE EXCEPTION 'school_tournament_not_active'; END IF;
      IF r.status<>'question' OR r.plan->r.position->'question'->>'id' IS DISTINCT FROM p_command->>'questionId'
        OR received_at<r.opened_at OR received_at>=r.closes_at THEN RAISE EXCEPTION 'school_tournament_question_changed'; END IF;
      item:=r.plan->r.position;
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(item->'question'->'options') o WHERE o->>'id'=p_command->>'optionId') THEN RAISE EXCEPTION 'school_tournament_invalid'; END IF;
      elapsed:=LEAST(20000,GREATEST(0,floor(extract(epoch FROM received_at-r.opened_at)*1000)::INTEGER));
      correct:=p_command->>'optionId'=item->'answer'->>'correctOptionId';
      points:=CASE WHEN correct THEN 100+floor(50*(20000-elapsed)/20000.0)::INTEGER ELSE 0 END;
      INSERT INTO public.kq_school_tournament_answers VALUES(r.id,p_user_id,r.position,p_command->>'optionId',correct,points,elapsed,received_at);
      PERFORM public.kq_school_tournament_tick(r.id,current_at);
    END IF;
  END IF;
  INSERT INTO public.kq_school_tournament_requests VALUES(p_user_id,key,p_command);
  RETURN public.kq_school_tournament_snapshot(p_user_id);
END $$;

REVOKE ALL ON FUNCTION public.kq_school_tournament_bot_performance(UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_identity(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_finish(UUID,TEXT,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_tick(UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_snapshot(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_school_tournament(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_school_tournament(UUID,JSONB,JSONB) TO service_role;
COMMIT;
