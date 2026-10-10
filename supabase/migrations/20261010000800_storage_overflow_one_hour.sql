BEGIN;

-- Unprotected surplus gets one real hour from the original verdict. Repacking
-- or buying containers retains the lot's existing deadline, as before.
DO $$
DECLARE definition TEXT;
 old_fragment TEXT := '(lot.state->>''curingStartedAt'')::TIMESTAMPTZ+interval ''24 hours''';
 new_fragment TEXT := '(lot.state->>''curingStartedAt'')::TIMESTAMPTZ+interval ''1 hour''';
BEGIN
 definition:=pg_get_functiondef('public.kq_storage_allocate(uuid,text,boolean)'::regprocedure);
 IF position(old_fragment IN definition)>0 THEN
  EXECUTE replace(definition,old_fragment,new_fragment);
 ELSIF position(new_fragment IN definition)=0 THEN
  RAISE EXCEPTION 'storage_overflow_duration_anchor_missing';
 END IF;
END $$;

-- Shorten existing deadlines without granting a fresh hour at deployment or
-- extending an earlier deadline. Preserve the six-hour curing clock, quality,
-- exposure and protected allocations. Expired surplus is handled by the normal
-- settlement worker / player actions; this migration never executes a sale.
-- Invalidate offers that were based on the previous storage deadline.
UPDATE public.kq_storage_lots
SET state=jsonb_set(state,'{capacity,overflowDeadlineAt}',to_jsonb((state->>'curingStartedAt')::TIMESTAMPTZ+interval '1 hour')),
 revision=revision+1
WHERE (state->'capacity'->>'overflowDeadlineAt')::TIMESTAMPTZ
 >(state->>'curingStartedAt')::TIMESTAMPTZ+interval '1 hour';

COMMIT;
