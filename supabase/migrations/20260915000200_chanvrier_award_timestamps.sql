-- Historical pages are ordered by stable UUID, not event time. Record the actual
-- award time; the original event timestamp remains in the idempotency ledger.
BEGIN;
CREATE OR REPLACE FUNCTION public.kq_apply_progress(p_user UUID,p_key TEXT,p_delta JSONB,p_at TIMESTAMPTZ,p_jury NUMERIC DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m JSONB; d RECORD; c RECORD; n INTEGER; families INTEGER:=0;
BEGIN
  INSERT INTO public.chanvrier_progress(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
  SELECT metrics INTO m FROM public.chanvrier_progress WHERE user_id=p_user FOR UPDATE;
  INSERT INTO public.chanvrier_progress_events(user_id,event_key,occurred_at) VALUES(p_user,p_key,COALESCE(p_at,now())) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  FOR d IN SELECT * FROM jsonb_each_text(p_delta) LOOP
    m:=jsonb_set(m,ARRAY[d.key],to_jsonb(COALESCE((m->>d.key)::NUMERIC,0)+d.value::NUMERIC));
  END LOOP;
  m:=jsonb_set(m,'{bestJury}',to_jsonb(GREATEST(COALESCE((m->>'bestJury')::NUMERIC,0),p_jury)));
  UPDATE public.chanvrier_progress SET metrics=m,updated_at=now() WHERE user_id=p_user;
  FOR c IN SELECT * FROM public.chanvrier_achievement_catalog LOOP
    IF COALESCE((m->>c.code)::NUMERIC,0)>=c.thresholds[1] THEN families:=families+1; END IF;
    FOR n IN 1..cardinality(c.thresholds) LOOP
      IF COALESCE((m->>c.code)::NUMERIC,0)>=c.thresholds[n] THEN
        INSERT INTO public.contest_profile_badges(customer_id,badge_id,awarded_at,reward_pack_count)
        VALUES(p_user,'kq-ach-'||c.code||'-'||n,now(),0)
        ON CONFLICT(customer_id,badge_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH n IN ARRAY ARRAY[5,8] LOOP
    IF families>=n THEN
      INSERT INTO public.kq_support_booster_entitlements(user_id,source,reward_key,card_count)
      VALUES(p_user,'achievement','kq-achievement:v1:'||p_user||':families:'||n,10)
      ON CONFLICT(reward_key) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
COMMIT;
