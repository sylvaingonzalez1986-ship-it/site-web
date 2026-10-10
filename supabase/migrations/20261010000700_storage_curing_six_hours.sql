BEGIN;

-- Curing is a gameplay wait of six real hours. Keep the existing verdict
-- anchor and the independent storage-aging / overflow clocks unchanged.
-- Capacity support wraps and renames the original lot constructor.
DO $$
DECLARE constructor REGPROCEDURE; definition TEXT;
 old_fragment TEXT := '''readyAt'',anchor+interval ''240 hours''';
 new_fragment TEXT := '''readyAt'',anchor+interval ''6 hours''';
BEGIN
 constructor:=to_regprocedure('public.kq_storage_create_lot_without_capacity(uuid)');
 IF constructor IS NULL THEN
  constructor:=to_regprocedure('public.kq_storage_create_lot(uuid)');
 END IF;
 IF constructor IS NULL THEN RAISE EXCEPTION 'storage_curing_constructor_missing'; END IF;
 definition:=pg_get_functiondef(constructor);
 IF position(old_fragment IN definition)>0 THEN
  EXECUTE replace(definition,old_fragment,new_fragment);
 ELSIF position(new_fragment IN definition)=0 THEN
  RAISE EXCEPTION 'storage_curing_duration_anchor_missing';
 END IF;
END $$;

-- Existing lots retain their elapsed wait, exposure, quality, provenance and
-- container reservations. Already shorter deadlines are never extended.
-- A revision bump also invalidates quotes/preparation options based on the
-- former deadline; their normal refresh supplies the new six-hour schedule.
UPDATE public.kq_storage_lots
SET state=jsonb_set(state,'{readyAt}',to_jsonb((state->>'curingStartedAt')::TIMESTAMPTZ+interval '6 hours')),
 revision=revision+1
WHERE (state->>'readyAt')::TIMESTAMPTZ>(state->>'curingStartedAt')::TIMESTAMPTZ+interval '6 hours';

COMMIT;
