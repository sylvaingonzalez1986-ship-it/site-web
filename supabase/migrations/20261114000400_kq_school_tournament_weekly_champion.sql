BEGIN;
-- Play throughout the Paris civil week. Final expert performances are real
-- human results; only the weekly settlement can change the champion's chair.
CREATE TABLE public.kq_school_tournament_weekly_editions (
  edition_date DATE PRIMARY KEY CHECK(EXTRACT(ISODOW FROM edition_date)=7),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL CHECK(closes_at>opens_at),
  settled_at TIMESTAMPTZ,
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_room_id UUID REFERENCES public.kq_school_tournament_rooms(id) ON DELETE SET NULL,
  champion_before UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  champion_after UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title_changed BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE public.kq_school_tournament_weekly_results (
  room_id UUID PRIMARY KEY REFERENCES public.kq_school_tournament_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edition_date DATE NOT NULL REFERENCES public.kq_school_tournament_weekly_editions(edition_date),
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 450),
  correct_count INTEGER NOT NULL CHECK(correct_count BETWEEN 0 AND 3),
  elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms BETWEEN 0 AND 60000),
  completed_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX kq_school_tournament_weekly_best ON public.kq_school_tournament_weekly_results(edition_date,user_id,score DESC,correct_count DESC,elapsed_ms,completed_at);
ALTER TABLE public.kq_school_tournament_weekly_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kq_school_tournament_weekly_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kq_school_tournament_weekly_editions FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.kq_school_tournament_weekly_results FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.kq_school_tournament_calendar(p_now TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE local_day DATE:=(p_now AT TIME ZONE 'Europe/Paris')::DATE;
  first_day DATE:=local_day-(EXTRACT(ISODOW FROM local_day)::INTEGER-1);
BEGIN
  RETURN jsonb_build_object('timeZone','Europe/Paris','isOpen',true,'editionDate',first_day+6,
    'opensAt',first_day::TIMESTAMP AT TIME ZONE 'Europe/Paris',
    'closesAt',(first_day+7)::TIMESTAMP AT TIME ZONE 'Europe/Paris',
    'awardAt',(first_day+7)::TIMESTAMP AT TIME ZONE 'Europe/Paris',
    'nextOpensAt',(first_day+7)::TIMESTAMP AT TIME ZONE 'Europe/Paris');
END $$;

CREATE FUNCTION public.kq_school_tournament_ensure_edition(p_now TIMESTAMPTZ) RETURNS DATE
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE calendar JSONB:=public.kq_school_tournament_calendar(p_now); edition DATE:=(calendar->>'editionDate')::DATE;
BEGIN
  INSERT INTO public.kq_school_tournament_weekly_editions(edition_date,opens_at,closes_at)
    VALUES(edition,(calendar->>'opensAt')::TIMESTAMPTZ,(calendar->>'closesAt')::TIMESTAMPTZ) ON CONFLICT DO NOTHING;
  RETURN edition;
END $$;

-- Record at the final common reveal, not when a tab later polls the result.
-- A timeout is an actual zero-point answer, but an absent or all-timeout finalist
-- cannot enter the weekly ranking. Bots and replay actors never enter it.
CREATE FUNCTION public.kq_school_tournament_record_weekly(p_room_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.kq_school_tournament_rooms%ROWTYPE; finalist public.kq_school_tournament_participants%ROWTYPE;
  amount INTEGER; manual INTEGER; total_score INTEGER; correct INTEGER; elapsed INTEGER; completed TIMESTAMPTZ; edition DATE;
BEGIN
  SELECT * INTO STRICT r FROM public.kq_school_tournament_rooms WHERE id=p_room_id;
  IF r.stage<>4 OR r.position<>11 OR r.finalist_id IS NULL THEN RETURN; END IF;
  SELECT * INTO finalist FROM public.kq_school_tournament_participants
    WHERE room_id=r.id AND user_id=r.finalist_id AND is_active AND NOT is_bot AND NOT is_replay AND left_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*),count(option_id),sum(points),count(*) FILTER(WHERE a.correct),sum(elapsed_ms),max(answered_at)
    INTO amount,manual,total_score,correct,elapsed,completed
    FROM public.kq_school_tournament_answers a WHERE room_id=r.id AND user_id=r.finalist_id AND position BETWEEN 9 AND 11;
  IF amount<>3 OR manual=0 OR finalist.last_seen_at<completed-interval '15 seconds' THEN RETURN; END IF;
  edition:=public.kq_school_tournament_ensure_edition(completed);
  -- A settled edition is immutable. The worker catches up every potentially
  -- due room before closing an edition, so normal late polling cannot reach it.
  IF EXISTS(SELECT 1 FROM public.kq_school_tournament_weekly_editions WHERE edition_date=edition AND settled_at IS NOT NULL) THEN RETURN; END IF;
  INSERT INTO public.kq_school_tournament_weekly_results(room_id,user_id,edition_date,score,correct_count,elapsed_ms,completed_at)
    VALUES(r.id,r.finalist_id,edition,total_score,correct,elapsed,completed) ON CONFLICT(room_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.kq_school_tournament_event(p_user_id UUID,p_now TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE calendar JSONB:=public.kq_school_tournament_calendar(p_now); played BOOLEAN; completed BOOLEAN;
BEGIN
  SELECT count(*)>0,COALESCE(bool_or(room.finished_at IS NOT NULL OR result.room_id IS NOT NULL),false) INTO played,completed
    FROM public.kq_school_tournament_participants participant
    JOIN public.kq_school_tournament_rooms room ON room.id=participant.room_id
    LEFT JOIN public.kq_school_tournament_weekly_results result ON result.room_id=room.id AND result.user_id=p_user_id
    WHERE participant.user_id=p_user_id AND NOT participant.is_bot AND NOT participant.is_replay
      AND (room.edition_date=(calendar->>'editionDate')::DATE OR result.edition_date=(calendar->>'editionDate')::DATE)
      AND room.started_at IS NOT NULL;
  RETURN calendar||jsonb_build_object('participated',played,'completed',completed);
END $$;

CREATE FUNCTION public.kq_school_tournament_weekly_leaderboard(p_now TIMESTAMPTZ) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(public.kq_school_tournament_identity(ranked.user_id)||jsonb_build_object(
    'rank',ranked.rank,'score',ranked.score,'correctCount',ranked.correct_count,'elapsedMs',ranked.elapsed_ms,'completedAt',ranked.completed_at)
    ORDER BY ranked.rank),'[]'::JSONB)
  FROM (
    SELECT best.*,row_number() OVER(ORDER BY score DESC,correct_count DESC,elapsed_ms,completed_at,user_id,room_id) AS rank
    FROM (
      SELECT DISTINCT ON(user_id) * FROM public.kq_school_tournament_weekly_results
      WHERE edition_date=(public.kq_school_tournament_calendar(p_now)->>'editionDate')::DATE
      ORDER BY user_id,score DESC,correct_count DESC,elapsed_ms,completed_at,room_id
    ) best ORDER BY score DESC,correct_count DESC,elapsed_ms,completed_at,user_id,room_id LIMIT 50
  ) ranked;
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
    INSERT INTO public.kq_school_tournament_replays(user_id,source_kind,source_id,recorded_at,performance,edition_date)
      SELECT p.user_id,'tournament',r.id,max(a.answered_at),jsonb_agg(jsonb_build_object('isCorrect',a.correct,'elapsedMs',a.elapsed_ms) ORDER BY a.position),
        (public.kq_school_tournament_calendar(max(a.answered_at))->>'editionDate')::DATE
      FROM public.kq_school_tournament_participants p JOIN public.kq_school_tournament_answers a USING(room_id,user_id)
      WHERE p.room_id=r.id AND NOT p.is_replay AND NOT p.is_bot GROUP BY p.user_id HAVING count(*)=12
      ON CONFLICT(user_id,source_kind,source_id) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.kq_school_tournament_tick(p_room_id UUID,p_now TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r public.kq_school_tournament_rooms%ROWTYPE; c public.kq_school_tournament_championship%ROWTYPE;
  finalist public.kq_school_tournament_participants%ROWTYPE;
  loser UUID; active_count INTEGER; transition_at TIMESTAMPTZ; step INTEGER;
BEGIN
  FOR step IN 1..48 LOOP
    SELECT * INTO r FROM public.kq_school_tournament_rooms WHERE id=p_room_id FOR UPDATE;
    IF NOT FOUND OR r.status IN ('complete','cancelled') THEN RETURN; END IF;
    IF r.status='lobby' THEN
      -- A waiting lobby crossing midnight belongs to the new open week. Its
      -- original fifteen-second waiting deadline is never extended.
      IF r.edition_date IS DISTINCT FROM (public.kq_school_tournament_calendar(p_now)->>'editionDate')::DATE THEN
        UPDATE public.kq_school_tournament_rooms SET edition_date=(public.kq_school_tournament_calendar(p_now)->>'editionDate')::DATE,
          autofill_at=COALESCE(autofill_at,p_now+interval '15 seconds') WHERE id=r.id;
        SELECT * INTO STRICT r FROM public.kq_school_tournament_rooms WHERE id=p_room_id;
      END IF;
      UPDATE public.kq_school_tournament_players p SET room_id=NULL FROM public.kq_school_tournament_participants entry
        WHERE entry.room_id=r.id AND entry.user_id=p.user_id AND p.room_id=r.id AND NOT entry.is_replay AND NOT entry.is_bot AND entry.last_seen_at<p_now-interval '90 seconds';
      DELETE FROM public.kq_school_tournament_participants WHERE room_id=r.id AND NOT is_replay AND NOT is_bot AND last_seen_at<p_now-interval '90 seconds';
      IF r.last_activity_at<p_now-interval '10 minutes' OR NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND NOT is_replay AND NOT is_bot) THEN
        PERFORM public.kq_school_tournament_finish(r.id,'lobby_expired',p_now); RETURN;
      END IF;
      IF r.autofill_at IS NOT NULL AND p_now>=r.autofill_at
        AND (SELECT count(*) FROM public.kq_school_tournament_participants WHERE room_id=r.id)<4 THEN
        PERFORM public.kq_school_tournament_fill(r.id,p_now,true);
      END IF;
      IF (SELECT count(*) FROM public.kq_school_tournament_participants WHERE room_id=r.id AND ready AND (is_replay OR is_bot OR last_seen_at>=p_now-interval '45 seconds'))=4 THEN
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
      IF r.stage=4 AND r.position=11 THEN PERFORM public.kq_school_tournament_record_weekly(r.id); END IF;
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
      IF r.stage=4 THEN
        PERFORM public.kq_school_tournament_finish(r.id,CASE WHEN EXISTS(
          SELECT 1 FROM public.kq_school_tournament_weekly_results WHERE room_id=r.id
        ) THEN 'weekly_recorded' ELSE 'finalist_absent' END,p_now); RETURN;
      END IF;
      UPDATE public.kq_school_tournament_participants SET is_active=false,eliminated_stage=r.stage
        WHERE room_id=r.id AND is_active AND NOT is_replay AND NOT is_bot AND last_seen_at<p_now-interval '45 seconds';
      SELECT count(*) INTO active_count FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active;
      IF active_count=0 THEN PERFORM public.kq_school_tournament_finish(r.id,'no_active_players',p_now); RETURN; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active AND NOT is_replay AND NOT is_bot) THEN
        PERFORM public.kq_school_tournament_finish(r.id,CASE WHEN EXISTS(
          SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_active AND is_bot
        ) THEN 'bots_won' ELSE 'replay_won' END,p_now); RETURN;
      END IF;
      -- Weekly and bootstrap finalists still play every level: their twelve
      -- real answers become a replay even when other humans leave early.
      IF (active_count=1 AND r.edition_date IS NULL AND NOT EXISTS(SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND is_bot)) OR r.stage=3 THEN
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
      SELECT * INTO STRICT c FROM public.kq_school_tournament_championship WHERE singleton;
      IF c.user_id=r.finalist_id THEN PERFORM public.kq_school_tournament_finish(r.id,'already_champion',p_now); RETURN; END IF;
      UPDATE public.kq_school_tournament_participants SET stage_score=0,stage_correct=0,stage_elapsed=0,stage_manual_answers=0 WHERE room_id=r.id AND is_active;
      UPDATE public.kq_school_tournament_rooms SET status='question',champion_target=public.kq_school_tournament_champion(),champion_version=c.version,
        opened_at=p_now+interval '3 seconds',closes_at=p_now+interval '23 seconds',next_at=NULL WHERE id=r.id;
      RETURN;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'school_tournament_transition_limit';
END $$;

-- Idempotent publication. The same advisory lock protects answers, matchmaking
-- and the scheduled worker. Catch up rooms before selecting expired editions:
-- their final timeout can have occurred before midnight without a recent poll.
CREATE FUNCTION public.kq_school_tournament_settle_weekly(p_now TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE edition public.kq_school_tournament_weekly_editions%ROWTYPE;
  contender public.kq_school_tournament_weekly_results%ROWTYPE;
  champion public.kq_school_tournament_championship%ROWTYPE; room_ref UUID; cutoff TIMESTAMPTZ; changed BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(714203611140001::BIGINT);
  PERFORM public.kq_school_tournament_ensure_edition(p_now);
  SELECT max(closes_at) INTO cutoff FROM public.kq_school_tournament_weekly_editions WHERE settled_at IS NULL AND closes_at<=p_now;
  IF cutoff IS NULL THEN RETURN; END IF;
  FOR room_ref IN SELECT id FROM public.kq_school_tournament_rooms
    WHERE started_at<cutoff AND status NOT IN ('complete','cancelled','lobby') ORDER BY started_at,id LOOP
    PERFORM public.kq_school_tournament_tick(room_ref,p_now);
  END LOOP;
  FOR edition IN SELECT * FROM public.kq_school_tournament_weekly_editions WHERE settled_at IS NULL AND closes_at<=p_now ORDER BY closes_at FOR UPDATE LOOP
    SELECT * INTO STRICT champion FROM public.kq_school_tournament_championship WHERE singleton FOR UPDATE;
    SELECT * INTO contender FROM public.kq_school_tournament_weekly_results
      WHERE edition_date=edition.edition_date AND user_id IS DISTINCT FROM champion.user_id
      ORDER BY score DESC,correct_count DESC,elapsed_ms,completed_at,user_id,room_id LIMIT 1;
    changed:=FOUND AND (champion.user_id IS NULL OR (contender.score,contender.correct_count,-contender.elapsed_ms)>(champion.score,champion.correct_count,-champion.elapsed_ms));
    IF changed THEN
      UPDATE public.kq_school_tournament_championship SET user_id=contender.user_id,score=contender.score,correct_count=contender.correct_count,
        elapsed_ms=contender.elapsed_ms,since=edition.closes_at,defenses=0,version=version+1 WHERE singleton;
      UPDATE public.kq_school_tournament_players SET titles=titles+1 WHERE user_id=contender.user_id;
    ELSIF contender.room_id IS NOT NULL AND champion.user_id IS NOT NULL THEN
      UPDATE public.kq_school_tournament_championship SET defenses=defenses+1 WHERE singleton;
    END IF;
    UPDATE public.kq_school_tournament_weekly_editions SET settled_at=p_now,winner_user_id=contender.user_id,winner_room_id=contender.room_id,
      champion_before=champion.user_id,champion_after=CASE WHEN changed THEN contender.user_id ELSE champion.user_id END,title_changed=changed
      WHERE edition_date=edition.edition_date;
  END LOOP;
END $$;

CREATE FUNCTION public.rpc_kq_school_tournament_settle_weekly() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.kq_school_tournament_settle_weekly(public.kq_school_tournament_now());
END $$;


CREATE OR REPLACE FUNCTION public.kq_school_tournament_snapshot(p_user_id UUID,p_replayed BOOLEAN DEFAULT false) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_at TIMESTAMPTZ:=public.kq_school_tournament_now(); r public.kq_school_tournament_rooms%ROWTYPE; visible JSONB:=NULL; leaders JSONB; current_question JSONB; reveal JSONB:=NULL;
BEGIN
  -- Runs after an incoming answer has been handled with its pre-lock arrival
  -- timestamp, so weekly reconciliation cannot time out that queued answer.
  PERFORM public.kq_school_tournament_settle_weekly(current_at);
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
    visible:=jsonb_build_object('id',r.id,'status',r.status,'editionDate',r.edition_date,'autofillAt',r.autofill_at,'resultEditionDate',(SELECT edition_date FROM public.kq_school_tournament_weekly_results WHERE room_id=r.id),'stage',r.stage,'questionNumber',CASE WHEN r.status='lobby' THEN 0 ELSE r.position%3+1 END,
      'availableReplays',CASE WHEN r.status='lobby' THEN public.kq_school_tournament_available_replays(r.id) ELSE 0 END,
      'players',COALESCE((SELECT jsonb_agg(public.kq_school_tournament_identity(p.user_id)||jsonb_build_object(
        'seat',p.seat,'ready',p.ready,'connected',NOT p.is_replay AND NOT p.is_bot AND p.left_at IS NULL AND p.last_seen_at>=current_at-interval '45 seconds',
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
  RETURN jsonb_build_object('version',1,'ownerId',p_user_id,'serverNow',current_at,'champion',public.kq_school_tournament_champion(),
    'leaderboard',leaders,'weeklyLeaderboard',public.kq_school_tournament_weekly_leaderboard(current_at),'room',visible,'event',public.kq_school_tournament_event(p_user_id,current_at),'replayed',p_replayed);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_kq_school_tournament(p_user_id UUID,p_command JSONB DEFAULT NULL,p_plan JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  received_at TIMESTAMPTZ:=public.kq_school_tournament_now(); current_at TIMESTAMPTZ; calendar JSONB;
  player public.kq_school_tournament_players%ROWTYPE; r public.kq_school_tournament_rooms%ROWTYPE;
  member public.kq_school_tournament_participants%ROWTYPE; existing public.kq_school_tournament_answers%ROWTYPE;
  previous JSONB; action TEXT:=p_command->>'action'; key UUID; room_ref UUID; item JSONB; ordinal INTEGER;
  elapsed INTEGER; correct BOOLEAN; points INTEGER; seat_number INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'school_tournament_invalid'; END IF;
  -- One short local transaction serializes matchmaking, room transitions and
  -- the single title. No network request runs while this lock is held.
  PERFORM pg_advisory_xact_lock(714203611140001::BIGINT);
  current_at:=public.kq_school_tournament_now();
  calendar:=public.kq_school_tournament_calendar(current_at);
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
    -- A missed ceremony may have replaced the previous incumbent. Reconcile
    -- before deciding whether this account would challenge its own chair.
    PERFORM public.kq_school_tournament_settle_weekly(current_at);
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
    SELECT room.* INTO r FROM public.kq_school_tournament_rooms room WHERE room.status='lobby' AND room.edition_date=(calendar->>'editionDate')::DATE
      AND (SELECT count(*) FROM public.kq_school_tournament_participants WHERE room_id=room.id)<4 ORDER BY room.created_at LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.kq_school_tournament_rooms(plan,content_version,edition_date,autofill_at,created_at,last_activity_at)
        VALUES(p_plan->'questions',p_plan->>'contentVersion',(calendar->>'editionDate')::DATE,current_at+interval '15 seconds',current_at,current_at) RETURNING * INTO r;
    END IF;
    SELECT candidate INTO seat_number FROM generate_series(1,4) candidate WHERE NOT EXISTS(
      SELECT 1 FROM public.kq_school_tournament_participants WHERE room_id=r.id AND seat=candidate) ORDER BY candidate LIMIT 1;
    IF seat_number IS NULL THEN RAISE EXCEPTION 'school_tournament_full'; END IF;
    INSERT INTO public.kq_school_tournament_participants(room_id,user_id,seat,last_seen_at,ready) VALUES(r.id,p_user_id,seat_number,current_at,true);
    UPDATE public.kq_school_tournament_players SET room_id=r.id WHERE user_id=p_user_id;
    UPDATE public.kq_school_tournament_rooms SET last_activity_at=current_at WHERE id=r.id;
    PERFORM public.kq_school_tournament_tick(r.id,current_at);
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
      IF r.edition_date IS NOT NULL AND NOT (p_command->>'ready')::BOOLEAN THEN RAISE EXCEPTION 'school_tournament_invalid'; END IF;
      UPDATE public.kq_school_tournament_participants SET ready=(p_command->>'ready')::BOOLEAN WHERE room_id=r.id AND user_id=p_user_id;
      IF (SELECT count(*) FROM public.kq_school_tournament_participants WHERE room_id=r.id AND ready AND (is_replay OR is_bot OR last_seen_at>=current_at-interval '45 seconds'))=4 THEN
        UPDATE public.kq_school_tournament_rooms SET status='question',started_at=current_at,opened_at=current_at+interval '3 seconds',closes_at=current_at+interval '23 seconds' WHERE id=r.id;
      END IF;
    ELSIF action IN ('fill_replays','fill_opponents') THEN
      IF r.status<>'lobby' THEN RAISE EXCEPTION 'school_tournament_room_changed'; END IF;
      IF NOT member.ready THEN RAISE EXCEPTION 'school_tournament_not_ready'; END IF;
      PERFORM public.kq_school_tournament_refresh_replays(true);
      IF action='fill_replays' AND public.kq_school_tournament_available_replays(r.id)=0 THEN RAISE EXCEPTION 'school_tournament_replays_unavailable'; END IF;
      PERFORM public.kq_school_tournament_fill(r.id,current_at,action='fill_opponents');
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

REVOKE ALL ON FUNCTION public.kq_school_tournament_ensure_edition(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_record_weekly(UUID) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_weekly_leaderboard(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_settle_weekly(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_school_tournament_settle_weekly() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_school_tournament_settle_weekly() TO postgres;
REVOKE ALL ON FUNCTION public.kq_school_tournament_calendar(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_event(UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_finish(UUID,TEXT,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_tick(UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.kq_school_tournament_snapshot(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_school_tournament(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_school_tournament(UUID,JSONB,JSONB) TO service_role;

-- Drop obsolete title leases; the stored incumbent and benchmark are preserved.
UPDATE public.kq_school_tournament_championship SET reservation_room_id=NULL,reservation_until=NULL WHERE singleton;
SELECT public.kq_school_tournament_ensure_edition(public.kq_school_tournament_now());

-- A persistent owner, one named job, both UTC offsets. The worker settles only
-- editions whose Paris deadline has really passed (DST and retries are safe).
SET LOCAL ROLE postgres;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
SELECT cron.schedule('kq-school-tournament-weekly-champion','0 22,23 * * 0','SELECT public.rpc_kq_school_tournament_settle_weekly();');
COMMIT;
