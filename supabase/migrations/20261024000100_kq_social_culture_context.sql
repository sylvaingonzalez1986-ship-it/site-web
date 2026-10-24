BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- A compact, read-only narrative view. In particular, this does not invoke the
-- storage/commerce state RPCs that settle charges or sell overdue surplus.
CREATE FUNCTION public.rpc_kq_social_culture(p_user_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH candidate_lots AS MATERIALIZED (
  SELECT f.id,f.run_id,f.variety_code,f.variety_name,f.created_at,r.state AS run_state,r.completed_at,
    s.state AS storage_state,public.kq_storage_remaining(f.id)::NUMERIC/10 AS remaining_grams
  FROM public.kq_flowers f
  JOIN public.kq_storage_lots s ON s.flower_id=f.id AND s.user_id=p_user_id
  LEFT JOIN public.kq_runs r ON r.id=f.run_id AND r.user_id=p_user_id
  WHERE f.owner_id=p_user_id
 )
 SELECT jsonb_build_object(
  'runs',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',r.id,'updatedAt',r.updated_at,
    'state',jsonb_build_object('varietyCode',r.state->'varietyCode','varietyName',r.state->'varietyName',
      'stageIndex',r.state->'stageIndex','phase',r.state->'phase','cultureDead',COALESCE(r.state->'cultureDead','false'::JSONB),
      'warehouse',CASE WHEN r.state->'warehouse'->>'version' IN ('1','2') THEN jsonb_build_object(
        'version',r.state->'warehouse'->'version','zoneId',r.state->'warehouse'->'zoneId',
        'zones',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',z->'id','name',z->'name'))
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.state->'warehouse'->'zones')='array'
            THEN r.state->'warehouse'->'zones' ELSE '[]'::JSONB END) z
          WHERE z->>'id'=r.state->'warehouse'->>'zoneId'),'[]'::JSONB)) ELSE NULL END,
      'history',CASE WHEN jsonb_typeof(r.state->'history')='array' AND jsonb_array_length(r.state->'history')>0
        THEN jsonb_build_array(jsonb_build_object('stage',r.state->'history'->-1->'stage',
          'situation',r.state->'history'->-1->'situation','outcome',r.state->'history'->-1->'outcome',
          'trait',r.state->'history'->-1->'trait')) ELSE '[]'::JSONB END,
      'care',jsonb_build_object('problems',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'code',p->'code','status',p->'status','variant',p->'variant','appearedAt',p->'appearedAt'))
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.state->'care'->'problems')='array'
          THEN r.state->'care'->'problems' ELSE '[]'::JSONB END) p
        WHERE p->>'status' IN ('suspected','confirmed') AND jsonb_typeof(p->'appearedAt')='number'
          AND (p->>'appearedAt')::NUMERIC BETWEEN 0 AND (r.state->>'stageIndex')::NUMERIC),'[]'::JSONB))))
    ORDER BY r.updated_at DESC,r.id)
    FROM (SELECT id,state,updated_at FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='active'
      ORDER BY updated_at DESC,id LIMIT 129) r),'[]'::JSONB),
  'lots',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',f.id,'runId',f.run_id,'varietyCode',f.variety_code,'varietyName',f.variety_name,
    'cultivation',CASE WHEN f.run_state->'warehouse'->>'version' IN ('1','2') THEN 'indoor' ELSE 'unknown' END,
    'harvestGrams',f.run_state->'harvestGrams',
    'harvestedAt',COALESCE(f.storage_state->>'harvestedAt',f.completed_at::TEXT,f.created_at::TEXT),
    'storage',jsonb_build_object('harvestedAt',f.storage_state->'harvestedAt','readyAt',f.storage_state->'readyAt'),
    'remainingGrams',f.remaining_grams)
    ORDER BY f.created_at DESC,f.id)
    -- Candidate subjects, not an exhaustive inventory: old exhausted harvests
    -- never hide an available lot or invalidate the current culture context.
    FROM (SELECT * FROM candidate_lots WHERE remaining_grams>0 ORDER BY created_at DESC,id LIMIT 128) f),'[]'::JSONB)
 );
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_social_culture(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_social_culture(UUID) TO service_role;
COMMENT ON FUNCTION public.rpc_kq_social_culture(UUID) IS 'Service-only observed culture facts for social narratives; no future situations, private gameplay state, settlements or writes.';
COMMIT;
