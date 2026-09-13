BEGIN;

-- Runs use started_at/completed_at, not created_at. Keep the deployed migration immutable.
CREATE OR REPLACE FUNCTION public.rpc_kq_commerce_state(p_user_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.kq_commerce_accounts%ROWTYPE; w public.kq_equipment_wallets%ROWTYPE; c public.kq_commerce_campaigns%ROWTYPE; latest UUID;
BEGIN
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'commerce_user_invalid'; END IF;
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 PERFORM 1 FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 INSERT INTO public.kq_commerce_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF a.current_run_id IS NULL THEN
  SELECT id INTO latest FROM public.kq_runs WHERE user_id=p_user_id AND status::TEXT='completed' ORDER BY completed_at DESC NULLS LAST,started_at DESC,id LIMIT 1;
  IF latest IS NOT NULL THEN PERFORM public.kq_commerce_open_cycle(p_user_id,latest); END IF;
 END IF;
 SELECT * INTO a FROM public.kq_commerce_accounts WHERE user_id=p_user_id;
 SELECT * INTO w FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 SELECT * INTO c FROM public.kq_commerce_campaigns WHERE run_id=a.current_run_id;
 RETURN jsonb_build_object('revision',a.revision,'cashCents',w.cash_cents,'reputation',w.reputation,'clients',a.clients,
 'computerOwned',a.computer_owned,'internetRenew',a.internet_renew,
 'campaign',CASE WHEN c.run_id IS NULL THEN NULL ELSE jsonb_build_object('id',c.run_id,'revision',c.revision,'reputation',c.reputation,'clientsStart',c.clients_start,'event',c.event,'internetPaid',c.internet_paid,'directUsed',c.direct_used,'shopUsed',c.shop_used,'goodUnits',c.good_units,'disappointmentUnits',c.disappointment_units) END,
 'rawFlowerIds',COALESCE((SELECT jsonb_agg(f.id) FROM public.kq_flowers f WHERE f.owner_id=p_user_id AND f.status::TEXT='burned' AND NOT EXISTS(SELECT 1 FROM public.kq_market_lots l WHERE l.flower_id=f.id AND l.status<>'ready')),'[]'::JSONB),
 'stocks',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'flowerId',s.flower_id,'name',f.variety_name,'route',s.route,'batchRoute',b.route,'juryScore',l.jury_score,
 'initialUnits',s.initial_units,'remainingUnits',s.remaining_units,'equivalentUnits',s.equivalent_units,'originalUnits',b.original_units,'baseUnitCents',s.base_unit_cents,
 'payoutExact',s.payout_exact,'payoutRounded',s.payout_rounded,'repExact',b.rep_exact,'repRounded',b.rep_rounded,'professionalUnits',b.professional_units,'counted',b.counted) ORDER BY b.created_at,s.id)
 FROM public.kq_commerce_stock s JOIN public.kq_commerce_batches b ON b.flower_id=s.flower_id JOIN public.kq_market_lots l ON l.flower_id=s.flower_id JOIN public.kq_flowers f ON f.id=s.flower_id WHERE s.user_id=p_user_id AND s.remaining_units>0),'[]'::JSONB),
 'receipts',COALESCE((SELECT jsonb_agg(r.receipt ORDER BY r.created_at DESC) FROM (SELECT receipt,created_at FROM public.kq_commerce_requests WHERE user_id=p_user_id ORDER BY created_at DESC LIMIT 20) r),'[]'::JSONB),
 'routeSales',COALESCE((SELECT jsonb_object_agg(route,sale_count) FROM public.kq_player_route_masteries WHERE user_id=p_user_id),'{}'::JSONB),
 'marketVolumes',COALESCE((SELECT jsonb_object_agg(route,grams) FROM (SELECT route,SUM(harvest_grams) grams FROM public.kq_market_sale_receipts WHERE created_at>=now()-interval '24 hours' AND route<>'biomass' GROUP BY route) x),'{}'::JSONB),
 'ownVolumes',COALESCE((SELECT jsonb_object_agg(route,grams) FROM (SELECT route,SUM(harvest_grams) grams FROM public.kq_market_sale_receipts WHERE owner_id=p_user_id AND created_at>=now()-interval '24 hours' GROUP BY route) x),'{}'::JSONB));
END $$;

COMMIT;
