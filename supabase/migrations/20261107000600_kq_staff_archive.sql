BEGIN;

-- The backfill's accounting trigger locks wallets. Block writers in the same
-- wallet -> staff order as the RPCs, before even the foreign-key table lock.
-- EXCLUSIVE also waits for SELECT FOR UPDATE, while ordinary reads can proceed.
LOCK TABLE public.kq_equipment_wallets IN EXCLUSIVE MODE;
LOCK TABLE public.kq_staff_accounts IN SHARE ROW EXCLUSIVE MODE;

-- Keep the live planning small without deleting contracts or their evidence.
-- All reads go through the owner-scoped, server-only RPC below.
CREATE TABLE public.kq_staff_archive (
 user_id UUID NOT NULL REFERENCES public.kq_staff_accounts(user_id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('contract','payroll','task')),
 record_id TEXT NOT NULL CHECK(length(record_id) BETWEEN 1 AND 200),
 employee_id TEXT NOT NULL CHECK(length(employee_id) BETWEEN 1 AND 200),
 event_at TIMESTAMPTZ NOT NULL,
 payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='object'),
 PRIMARY KEY(user_id,kind,record_id)
);
CREATE INDEX kq_staff_archive_pages ON public.kq_staff_archive(user_id,kind,event_at DESC,record_id DESC);
CREATE INDEX kq_staff_archive_employee_pages ON public.kq_staff_archive(user_id,employee_id,kind,event_at DESC,record_id DESC);
ALTER TABLE public.kq_staff_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_staff_archive FROM PUBLIC,anon,authenticated,service_role;

-- Freeze writers while recovering records that older engine windows have
-- already removed. Latest revision wins; live state wins ties. Receipts remain
-- byte-for-byte unchanged and are never executed again.
CREATE TEMP TABLE kq_staff_archive_backfill ON COMMIT DROP AS
 WITH snapshots AS (
  SELECT user_id,result->'state' AS state,COALESCE((result->>'revision')::BIGINT,0) AS revision,
   0 AS live,created_at,request_key::TEXT AS tie FROM public.kq_staff_receipts
  UNION ALL
  SELECT user_id,state,revision,1,updated_at,'' FROM public.kq_staff_accounts WHERE state IS NOT NULL
 ), records AS (
  SELECT s.user_id,s.revision,s.live,s.created_at,s.tie,part.kind,item
  FROM snapshots s CROSS JOIN (VALUES ('contract','employees'),('payroll','payroll'),('task','tasks')) part(kind,field)
  CROSS JOIN LATERAL jsonb_array_elements(s.state->part.field) item
 )
 SELECT DISTINCT ON (user_id,kind,item->>'id') user_id,kind,item->>'id' AS record_id,item AS payload
 FROM records ORDER BY user_id,kind,item->>'id',revision DESC,live DESC,created_at DESC,tie DESC;
CREATE INDEX ON kq_staff_archive_backfill(user_id,kind,(payload->>'employeeId'));

INSERT INTO public.kq_staff_archive(user_id,kind,record_id,employee_id,event_at,payload)
 SELECT user_id,kind,record_id,payload->>'employeeId',
  (CASE kind WHEN 'payroll' THEN payload->>'dueAt' ELSE payload->>'completesAt' END)::TIMESTAMPTZ,payload
 FROM kq_staff_archive_backfill
 WHERE (kind='payroll' AND payload->'paidCents'=payload->'totalCents')
  OR (kind='task' AND payload->>'status'='completed');

INSERT INTO public.kq_staff_archive(user_id,kind,record_id,employee_id,event_at,payload)
 SELECT c.user_id,'contract',c.record_id,c.record_id,
  COALESCE(c.payload->>'endsAt',c.payload->>'paidUntil',c.payload->>'hiredAt')::TIMESTAMPTZ,c.payload
 FROM kq_staff_archive_backfill c
 WHERE c.kind='contract' AND c.payload->>'status'='ended' AND c.payload->'finalPaid'='true'::JSONB
  AND NOT EXISTS(SELECT 1 FROM kq_staff_archive_backfill r WHERE r.user_id=c.user_id AND r.payload->>'employeeId'=c.record_id
   AND ((r.kind='payroll' AND (r.payload->>'paidCents')::BIGINT<(r.payload->>'totalCents')::BIGINT)
    OR (r.kind='task' AND r.payload->>'status'='running')));

-- This pure compaction also keeps the recent window for active staff/player.
-- All finished rows must already have been saved before calling it.
CREATE FUNCTION public.kq_staff_compact(p_user UUID,p_state JSONB) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT p_state || jsonb_build_object(
  'employees',COALESCE((SELECT jsonb_agg(e ORDER BY n) FROM jsonb_array_elements(p_state->'employees') WITH ORDINALITY a(e,n)
   WHERE NOT EXISTS(SELECT 1 FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='contract' AND h.record_id=e->>'id')),'[]'::JSONB),
  'payroll',COALESCE((SELECT jsonb_agg(e ORDER BY n) FROM (
   SELECT e,n,row_number() OVER (PARTITION BY e->'paidCents'=e->'totalCents' ORDER BY n DESC) AS rank
   FROM jsonb_array_elements(p_state->'payroll') WITH ORDINALITY a(e,n)
   WHERE NOT EXISTS(SELECT 1 FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='contract' AND h.record_id=e->>'employeeId')
  ) rows WHERE e->'paidCents'<>e->'totalCents' OR rank<=120),'[]'::JSONB),
  'tasks',COALESCE((SELECT jsonb_agg(e ORDER BY n) FROM (
   SELECT e,n,row_number() OVER (PARTITION BY e->>'status' ORDER BY n DESC) AS rank
   FROM jsonb_array_elements(p_state->'tasks') WITH ORDINALITY a(e,n)
   WHERE NOT EXISTS(SELECT 1 FROM public.kq_staff_archive h WHERE h.user_id=p_user AND h.kind='contract' AND h.record_id=e->>'employeeId')
  ) rows WHERE e->>'status'='running' OR rank<=200),'[]'::JSONB)
 );
$$;
REVOKE ALL ON FUNCTION public.kq_staff_compact(UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;

-- Invalidate any pre-migration CAS snapshot; do not advance the simulation,
-- recalculate pay, write a receipt, or touch a player's wallet.
UPDATE public.kq_staff_accounts a SET state=public.kq_staff_compact(a.user_id,a.state),revision=a.revision+1,updated_at=now()
 WHERE a.state IS NOT NULL AND a.state IS DISTINCT FROM public.kq_staff_compact(a.user_id,a.state);

CREATE FUNCTION public.kq_staff_archive_transition() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE before_state JSONB; part RECORD; field TEXT;
BEGIN
 IF NEW.state IS NULL THEN
  IF TG_OP='UPDATE' AND OLD.state IS NOT NULL THEN RAISE EXCEPTION 'staff_archive_changed'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN before_state:=OLD.state; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.state->'employees') e
   WHERE e->>'status' IS NULL OR e->>'status' NOT IN ('active','ended'))
  OR (SELECT count(*) FROM jsonb_array_elements(NEW.state->'employees') e WHERE e->>'status'='active')>8
  OR (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(NEW.state->'employees') e)<>jsonb_array_length(NEW.state->'employees')
 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 -- Removing a contract or running task is the archive's job, never the caller's.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(before_state->'employees') e WHERE NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(NEW.state->'employees') n WHERE n->>'id'=e->>'id'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(before_state->'tasks') e WHERE e->>'status'='running' AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(NEW.state->'tasks') n WHERE n->>'id'=e->>'id'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.state->'employees') e JOIN public.kq_staff_archive h
   ON h.user_id=NEW.user_id AND h.kind='contract' AND h.record_id=e->>'id')
 THEN RAISE EXCEPTION 'staff_archive_changed'; END IF;
 FOR part IN SELECT * FROM (VALUES ('payroll','payroll','dueAt'),('task','tasks','completesAt')) p(kind,field,date_field) LOOP
  field:=part.field;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.state->field) e JOIN public.kq_staff_archive h
    ON h.user_id=NEW.user_id AND h.kind=part.kind AND h.record_id=e->>'id'
    WHERE h.payload IS DISTINCT FROM e OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(before_state->field) prior_item WHERE prior_item->>'id'=e->>'id'))
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.state->field) e JOIN public.kq_staff_archive h
    ON h.user_id=NEW.user_id AND h.kind='contract' AND h.record_id=e->>'employeeId')
  THEN RAISE EXCEPTION 'staff_archive_changed'; END IF;
  INSERT INTO public.kq_staff_archive(user_id,kind,record_id,employee_id,event_at,payload)
   SELECT NEW.user_id,part.kind,e->>'id',e->>'employeeId',(e->>part.date_field)::TIMESTAMPTZ,e
   FROM (SELECT e FROM jsonb_array_elements(before_state->field) e
    UNION SELECT e FROM jsonb_array_elements(NEW.state->field) e) rows
   WHERE (part.kind='payroll' AND e->'paidCents'=e->'totalCents') OR (part.kind='task' AND e->>'status'='completed')
   ON CONFLICT (user_id,kind,record_id) DO NOTHING;
 END LOOP;
 INSERT INTO public.kq_staff_archive(user_id,kind,record_id,employee_id,event_at,payload)
  SELECT NEW.user_id,'contract',e->>'id',e->>'id',COALESCE(e->>'endsAt',e->>'paidUntil',e->>'hiredAt')::TIMESTAMPTZ,e
  FROM jsonb_array_elements(NEW.state->'employees') e
  WHERE e->>'status'='ended' AND e->'finalPaid'='true'::JSONB
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.state->'payroll') p WHERE p->>'employeeId'=e->>'id' AND (p->>'paidCents')::BIGINT<(p->>'totalCents')::BIGINT)
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.state->'tasks') t WHERE t->>'employeeId'=e->>'id' AND t->>'status'='running');
 NEW.state:=public.kq_staff_compact(NEW.user_id,NEW.state);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.kq_staff_archive_transition() FROM PUBLIC,anon,authenticated,service_role;
-- Alphabetical BEFORE-trigger ordering is deliberate: accounting must see the
-- payment before the now-settled payroll disappears from the live state.
CREATE TRIGGER zz_kq_staff_archive BEFORE INSERT OR UPDATE OF state ON public.kq_staff_accounts
 FOR EACH ROW EXECUTE FUNCTION public.kq_staff_archive_transition();

-- Retain every previously installed guard (trim, debt, partner count, hours).
DO $$ DECLARE body TEXT; anchor TEXT:='OR jsonb_array_length(p_state->''employees'')>40'; BEGIN
 SELECT pg_get_functiondef('public.rpc_kq_staff_commit(uuid,integer,uuid,jsonb,jsonb,integer,jsonb)'::regprocedure) INTO body;
 IF (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'staff_archive_patch_drift'; END IF;
 EXECUTE replace(body,anchor,'OR (SELECT count(*) FROM jsonb_array_elements(p_state->''employees'') e WHERE e->>''status''=''active'')>8');
END $$;

ALTER FUNCTION public.kq_staff_snapshot(UUID) RENAME TO kq_staff_snapshot_before_archive;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot_before_archive(UUID) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.kq_staff_snapshot(p_user UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.kq_staff_snapshot_before_archive(p_user)||jsonb_build_object('archiveCount',
  (SELECT count(*) FROM public.kq_staff_archive WHERE user_id=p_user AND kind='contract'));
$$;
REVOKE ALL ON FUNCTION public.kq_staff_snapshot(UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_staff_archive(p_user_id UUID,p_kind TEXT DEFAULT 'contract',p_employee_id TEXT DEFAULT NULL,p_cursor JSONB DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result JSONB; cursor_at TIMESTAMPTZ; cursor_id TEXT;
BEGIN
 IF p_user_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('contract','payroll','task')
  OR (p_kind='contract' AND p_employee_id IS NOT NULL)
  OR (p_kind<>'contract' AND COALESCE(length(p_employee_id),0) NOT BETWEEN 1 AND 200)
 THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 IF p_cursor IS NOT NULL THEN
  IF jsonb_typeof(p_cursor) IS DISTINCT FROM 'object' OR jsonb_typeof(p_cursor->'at') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_cursor->'id') IS DISTINCT FROM 'string' OR length(p_cursor->>'id') NOT BETWEEN 1 AND 200
  THEN RAISE EXCEPTION 'staff_invalid'; END IF;
  cursor_at:=(p_cursor->>'at')::TIMESTAMPTZ; cursor_id:=p_cursor->>'id';
  IF NOT isfinite(cursor_at) THEN RAISE EXCEPTION 'staff_invalid'; END IF;
 END IF;
 IF p_kind<>'contract' AND NOT EXISTS(SELECT 1 FROM public.kq_staff_archive WHERE user_id=p_user_id AND kind='contract' AND record_id=p_employee_id)
 THEN RETURN jsonb_build_object('items','[]'::JSONB,'nextCursor',NULL); END IF;
 WITH page AS MATERIALIZED (
  SELECT record_id,event_at,payload FROM public.kq_staff_archive
  WHERE user_id=p_user_id AND kind=p_kind AND (p_kind='contract' OR employee_id=p_employee_id)
   AND (p_cursor IS NULL OR (event_at,record_id)<(cursor_at,cursor_id))
  ORDER BY event_at DESC,record_id DESC LIMIT 21
 ), visible AS (SELECT * FROM page ORDER BY event_at DESC,record_id DESC LIMIT 20)
 SELECT jsonb_build_object('items',COALESCE((SELECT jsonb_agg(payload ORDER BY event_at DESC,record_id DESC) FROM visible),'[]'::JSONB),
  'nextCursor',CASE WHEN (SELECT count(*) FROM page)>20 THEN
   (SELECT jsonb_build_object('at',event_at,'id',record_id) FROM visible ORDER BY event_at,record_id LIMIT 1) ELSE NULL END) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_staff_archive(UUID,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_staff_archive(UUID,TEXT,TEXT,JSONB) TO service_role;

COMMIT;
