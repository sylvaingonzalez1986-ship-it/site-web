BEGIN;

-- Retire the address subscription without settling it, refunding past purchases,
-- rewriting historical receipts, or changing a culture that has already begun.
-- The retired capability is emitted by the authoritative business snapshot;
-- clients connected to an older database must retain its historical start rules.
CREATE OR REPLACE FUNCTION pg_temp.kq_retire_address_patch(routine TEXT, old_text TEXT, new_text TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE definition TEXT;
BEGIN
 SELECT pg_get_functiondef(routine::regprocedure) INTO definition;
 IF strpos(definition,new_text)>0 THEN RETURN; END IF;
 IF strpos(definition,old_text)=0 THEN RAISE EXCEPTION 'domiciliation_retirement_anchor_changed: %',routine; END IF;
 EXECUTE replace(definition,old_text,new_text);
END $$;

-- The online calendar owns automatic settlement, including offline catch-up.
-- Removing only renew=true would still expire or bill historical contracts at
-- another coincident deadline. Remove the entire subscription event instead.
SELECT pg_temp.kq_retire_address_patch('public.kq_online_business_at(uuid,timestamptz)',
 $old$CASE WHEN a.domiciliation_mode='external' THEN a.domiciliation_paid_until END$old$,
 $new$NULL::TIMESTAMPTZ /* retired address deadline */$new$);
SELECT pg_temp.kq_retire_address_patch('public.kq_online_business_at(uuid,timestamptz)',
 $old$  IF a.domiciliation_mode='external' AND a.domiciliation_paid_until=event_at THEN
   IF a.domiciliation_renew AND cash>=5000 THEN
    cash:=cash-5000;
    UPDATE public.kq_commerce_accounts SET domiciliation_paid_until=domiciliation_paid_until+interval '120 hours' WHERE user_id=p_user;
    INSERT INTO public.kq_business_ledger(user_id,kind,amount_cents,occurred_at) VALUES(p_user,'domicile-paid',5000,event_at);
   ELSE
    UPDATE public.kq_commerce_accounts SET domiciliation_mode='home',domiciliation_renew=false WHERE user_id=p_user;
    INSERT INTO public.kq_business_ledger(user_id,kind,occurred_at) VALUES(p_user,'domicile-expired',event_at);
   END IF;
  END IF;$old$,
 $new$  -- Address subscriptions are retired; historical periods remain archived.$new$);
SELECT pg_temp.kq_retire_address_patch('public.kq_online_settle_until(uuid,timestamptz)',
 $old$CASE WHEN a.domiciliation_mode='external' THEN a.domiciliation_paid_until END$old$,
 $new$NULL::TIMESTAMPTZ /* retired address deadline */$new$);

-- Patch the original snapshot underneath the site/supplier/climate wrappers.
-- Their unrelated fields and the minimum of their own due dates stay intact.
SELECT pg_temp.kq_retire_address_patch('public.kq_online_previous_business_snapshot(uuid)',
 $old$'domiciliation',jsonb_build_object('mode',a.domiciliation_mode,'paidUntil',a.domiciliation_paid_until,'renew',a.domiciliation_renew,
  'active',a.domiciliation_mode='external' AND a.domiciliation_paid_until>now()),$old$,
 $new$'domiciliation',jsonb_build_object('mode',a.domiciliation_mode,'paidUntil',a.domiciliation_paid_until,'renew',false,'active',false,'retired',true),$new$);
SELECT pg_temp.kq_retire_address_patch('public.kq_online_previous_business_snapshot(uuid)',
 $old$CASE WHEN a.domiciliation_mode='external' THEN a.domiciliation_paid_until END$old$,
 $new$NULL::TIMESTAMPTZ /* retired address deadline */$new$);

-- The outer RPC still recognizes and replays already-issued request receipts.
-- Every newly requested address change is rejected before any cash mutation.
SELECT pg_temp.kq_retire_address_patch('public.kq_business_command(uuid,text,jsonb)',
 $old$ ELSIF p_action='domiciliation' THEN
  kind:=p_payload->>'mode';
  IF kind IS NULL OR kind NOT IN ('home','external') THEN RAISE EXCEPTION 'commerce_domiciliation_mode'; END IF;
  IF kind='home' THEN
   UPDATE public.kq_commerce_accounts SET domiciliation_mode='home',domiciliation_renew=false WHERE user_id=p_user;
  ELSE
   IF a.domiciliation_paid_until IS NULL OR a.domiciliation_paid_until<=now() THEN
    cost:=5000;
    IF cash<cost THEN RAISE EXCEPTION 'commerce_cash'; END IF;
    UPDATE public.kq_commerce_accounts SET domiciliation_paid_until=now()+interval '120 hours' WHERE user_id=p_user;
   END IF;
   UPDATE public.kq_commerce_accounts SET domiciliation_mode='external',domiciliation_renew=true WHERE user_id=p_user;
  END IF;$old$,
 $new$ ELSIF p_action='domiciliation' THEN
  RAISE EXCEPTION 'commerce_domiciliation_retired';$new$);

-- Keep the persisted run format readable by the still-deployed server. It
-- starts home after reading active=false; the retirement-aware server starts
-- external for the ordinary theft risk. Neither may rewrite a culture's path.
-- The retired marker belongs to the business capability, not stored runs:
-- older parsers reject that value. Existing update/swap equality guards stay.
SELECT pg_temp.kq_retire_address_patch('public.kq_business_assert_domiciliation(uuid,jsonb)',
 $old$ SELECT CASE WHEN domiciliation_mode='external' AND domiciliation_paid_until>now() THEN 'external' ELSE 'home' END
 INTO expected FROM public.kq_commerce_accounts WHERE user_id=p_user;$old$,
 $new$ expected:=CASE WHEN p_state->>'domiciliation' IN ('home','external')
  THEN p_state->>'domiciliation' ELSE NULL END; -- Shared-database compatibility.
 IF expected IS NULL THEN RAISE EXCEPTION 'kq_domiciliation_changed'; END IF;$new$);

-- Preserve account identity, paid-period history and financial archives. Only
-- the obsolete future renewal is cancelled; no synthetic refund is recorded.
UPDATE public.kq_commerce_accounts SET domiciliation_renew=false,revision=revision+1
 WHERE domiciliation_renew;

-- No public object is introduced. CREATE OR REPLACE from the guarded patches
-- preserves every existing EXECUTE grant, including the service RPC surface.
DROP FUNCTION pg_temp.kq_retire_address_patch(TEXT,TEXT,TEXT);

COMMIT;
