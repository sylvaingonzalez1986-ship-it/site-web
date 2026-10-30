BEGIN;

-- Capacity has historically had different meanings for legacy inventories and
-- physical warehouse plans. Expose explicit, disjoint stock pools in the same
-- locked snapshot instead of asking a client to infer packages from a remainder.
ALTER FUNCTION public.kq_storage_snapshot(UUID,BOOLEAN) RENAME TO kq_storage_snapshot_before_stock_breakdown;
REVOKE ALL ON FUNCTION public.kq_storage_snapshot_before_stock_breakdown(UUID,BOOLEAN)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.kq_storage_snapshot(p_user_id UUID,p_active_only BOOLEAN) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result JSONB; bulk NUMERIC; protected NUMERIC; overflow NUMERIC; packed NUMERIC;
 active_units NUMERIC; paused_units NUMERIC; other_units NUMERIC; packets BIGINT;
BEGIN
 result:=public.kq_storage_snapshot_before_stock_breakdown(p_user_id,p_active_only);
 SELECT COALESCE(sum(remaining),0),COALESCE(sum(stored),0),COALESCE(sum(GREATEST(0,remaining-stored)),0)
 INTO bulk,protected,overflow FROM (
  SELECT public.kq_storage_remaining(s.flower_id) remaining,
   COALESCE((SELECT sum((a->>'storedUnits')::NUMERIC)
    FROM jsonb_array_elements(COALESCE(s.state->'capacity'->'allocations','[]'::JSONB)) a),0) stored
  FROM public.kq_storage_lots s WHERE s.user_id=p_user_id
 ) lots;
 SELECT COALESCE(sum(units),0),COALESCE(sum(units) FILTER(WHERE status='active'),0),
  COALESCE(sum(units) FILTER(WHERE status='paused'),0),COALESCE(sum(units) FILTER(WHERE status NOT IN ('active','paused')),0),
  COALESCE(sum(remaining_packets),0)
 INTO packed,active_units,paused_units,other_units,packets FROM (
  SELECT l.remaining_packets,l.remaining_packets::NUMERIC*l.format_grams*10*s.equivalent_units/NULLIF(s.initial_units,0) units,
   CASE WHEN l.status='active' AND public.kq_online_quality(l,now())<5.8 THEN 'quality-blocked' ELSE l.status END status
  FROM public.kq_online_listings l JOIN public.kq_commerce_stock s ON s.id=l.stock_id
  WHERE l.user_id=p_user_id AND l.remaining_packets>0
 ) listings;
 RETURN result||jsonb_build_object('stockBreakdown',jsonb_build_object(
  'bulkUnits',bulk,'bulkProtectedUnits',protected,'bulkOverflowUnits',overflow,
  'packedUnits',packed,'packedActiveUnits',active_units,'packedPausedUnits',paused_units,'packedOtherUnits',other_units,'packedPackets',packets));
END $$;
REVOKE ALL ON FUNCTION public.kq_storage_snapshot(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
