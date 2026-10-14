BEGIN;

-- This receipt coordinates existing purchase and upgrade receipts. It creates
-- no second accounting entry and never resets wear or an installed loadout.
CREATE TABLE public.kq_workshop_tier_receipts (
 user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 equipment_code TEXT NOT NULL,
 previous_level INTEGER NOT NULL CHECK(previous_level BETWEEN 0 AND 9),
 target_level INTEGER NOT NULL CHECK(target_level IN (1,4,7) AND target_level>previous_level),
 expected_price_cents INTEGER NOT NULL CHECK(expected_price_cents>0),
 receipt JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_key)
);
ALTER TABLE public.kq_workshop_tier_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kq_workshop_tier_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.rpc_kq_purchase_workshop_tier(
 p_user_id UUID,p_request_key UUID,p_equipment_code TEXT,p_target_level INTEGER,
 p_expected_level INTEGER,p_expected_price_cents INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.kq_workshop_tier_receipts%ROWTYPE; gear public.kq_player_equipment%ROWTYPE;
 base_price INTEGER; total_price BIGINT; cash INTEGER; previous_level INTEGER; step INTEGER;
 child_key UUID; result JSONB; child_result JSONB;
BEGIN
 IF p_user_id IS NULL OR p_request_key IS NULL OR p_equipment_code IS NULL
  OR p_equipment_code NOT IN ('SIFT-TRAY','PRESS-0600','WASHER-25L','AUTO-SIEVE','FREEZE-DRYER','STATIC-PLASMA')
  OR p_target_level IS NULL OR p_target_level NOT IN (1,4,7)
  OR p_expected_level IS NULL OR p_expected_level NOT BETWEEN 0 AND 9 OR p_target_level<=p_expected_level
  OR p_expected_price_cents IS NULL OR p_expected_price_cents<=0
 THEN RAISE EXCEPTION 'workshop_tier_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kq-equipment:'||p_user_id::TEXT,0));
 SELECT * INTO old FROM public.kq_workshop_tier_receipts WHERE user_id=p_user_id AND request_key=p_request_key;
 IF FOUND THEN
  IF old.equipment_code IS DISTINCT FROM p_equipment_code OR old.target_level IS DISTINCT FROM p_target_level
   OR old.previous_level IS DISTINCT FROM p_expected_level OR old.expected_price_cents IS DISTINCT FROM p_expected_price_cents
  THEN RAISE EXCEPTION 'workshop_tier_request_mismatch'; END IF;
  RETURN old.receipt||jsonb_build_object('replayed',true);
 END IF;
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM public.rpc_kq_ensure_equipment_profile(p_user_id);
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO gear FROM public.kq_player_equipment
  WHERE user_id=p_user_id AND tent_number=1 AND equipment_code=p_equipment_code FOR UPDATE;
 previous_level:=CASE WHEN FOUND THEN gear.level ELSE 0 END;
 IF previous_level IS DISTINCT FROM p_expected_level THEN RAISE EXCEPTION 'equipment_level_changed'; END IF;
 IF previous_level>0 AND gear.purchase_price_cents<=0 THEN RAISE EXCEPTION 'equipment_not_purchased'; END IF;
 SELECT price_cents INTO base_price FROM public.kq_equipment_catalog
  WHERE code=p_equipment_code AND is_active AND is_purchasable FOR SHARE;
 IF NOT FOUND OR base_price<=0 THEN RAISE EXCEPTION 'equipment_unavailable'; END IF;
 total_price:=CASE WHEN previous_level=0 THEN base_price ELSE 0 END;
 FOR step IN GREATEST(1,previous_level)..p_target_level-1 LOOP
  total_price:=total_price+ceil(base_price::NUMERIC*step/10)::BIGINT;
 END LOOP;
 IF total_price IS DISTINCT FROM p_expected_price_cents::BIGINT THEN RAISE EXCEPTION 'workshop_tier_price_changed'; END IF;
 IF cash<total_price THEN RAISE EXCEPTION 'insufficient_equipment_cash'; END IF;
 -- Validate both first acquisition (including practice) and final career gate
 -- before any debit. Existing mutation triggers repeat these checks.
 IF previous_level=0 THEN PERFORM public.kq_assert_equipment_career(p_user_id,p_equipment_code,1); END IF;
 PERFORM public.kq_assert_equipment_career(p_user_id,p_equipment_code,p_target_level);
 IF previous_level>0 AND gear.wear_cycles>=public.kq_machine_interval(p_equipment_code,previous_level)
 THEN RAISE EXCEPTION 'workshop_tier_maintenance'; END IF;
 IF previous_level=0 THEN
  child_key:=md5('workshop-tier:'||p_request_key::TEXT||':purchase')::UUID;
  child_result:=public.rpc_kq_purchase_tent_equipment(p_user_id,child_key,ARRAY[p_equipment_code],1);
  IF COALESCE((child_result->>'replayed')::BOOLEAN,false) THEN RAISE EXCEPTION 'workshop_tier_child_conflict'; END IF;
 END IF;
 FOR step IN GREATEST(1,previous_level)..p_target_level-1 LOOP
  child_key:=md5('workshop-tier:'||p_request_key::TEXT||':upgrade:'||step)::UUID;
  child_result:=public.rpc_kq_upgrade_tent_equipment(p_user_id,child_key,p_equipment_code,step,1);
  IF COALESCE((child_result->>'replayed')::BOOLEAN,false) THEN RAISE EXCEPTION 'workshop_tier_child_conflict'; END IF;
 END LOOP;
 SELECT cash_cents INTO cash FROM public.kq_equipment_wallets WHERE user_id=p_user_id;
 result:=jsonb_build_object('equipmentCode',p_equipment_code,'previousLevel',previous_level,
  'level',p_target_level,'priceCents',total_price,'cashAfterCents',cash,'replayed',false);
 INSERT INTO public.kq_workshop_tier_receipts(user_id,request_key,equipment_code,previous_level,target_level,expected_price_cents,receipt)
  VALUES(p_user_id,p_request_key,p_equipment_code,previous_level,p_target_level,p_expected_price_cents,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_kq_purchase_workshop_tier(UUID,UUID,TEXT,INTEGER,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_purchase_workshop_tier(UUID,UUID,TEXT,INTEGER,INTEGER,INTEGER) TO service_role;

COMMIT;
