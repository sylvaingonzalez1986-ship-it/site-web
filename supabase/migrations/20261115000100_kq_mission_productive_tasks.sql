-- A completed reservation is evidence only when it consumed actual work.
-- Historical reward receipts and packs are deliberately left untouched.
DO $$ DECLARE body TEXT; anchor TEXT; BEGIN
 body:=pg_get_functiondef('public.kq_mission_metrics(uuid)'::regprocedure);
 anchor:='payload->>''status''=''completed''';
 IF strpos(body,anchor)=0 THEN RAISE EXCEPTION 'productive_tasks_metrics_anchor'; END IF;
 EXECUTE replace(body,anchor,anchor||$filter$
   AND payload->>'kind' IS DISTINCT FROM 'production'
   AND CASE
     WHEN payload->>'kind'='culture' AND payload->>'cultureShift'='true' THEN
       CASE WHEN jsonb_typeof(payload->'cultureUsedHours')='number'
         THEN (payload->>'cultureUsedHours')::numeric>0 ELSE false END
     WHEN payload->>'kind'='processing' AND payload->>'processingShift'='true' THEN
       CASE WHEN jsonb_typeof(payload->'processingUsedHours')='number'
         THEN (payload->>'processingUsedHours')::numeric>0 ELSE false END
     ELSE true
   END$filter$);
END $$;
REVOKE ALL ON FUNCTION public.kq_mission_metrics(UUID) FROM PUBLIC,anon,authenticated,service_role;
-- Only the existing SECURITY DEFINER state/claim RPCs may call this helper.
