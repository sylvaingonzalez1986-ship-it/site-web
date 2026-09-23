-- Include bank debt, fixed loan interest and crypto cost basis in every accounting period.
-- Trading market prices remain informational; only realized gains/losses affect income.
BEGIN;

CREATE OR REPLACE FUNCTION public.kq_treasury_balances_at(p_user UUID,p_at TIMESTAMPTZ,p_inclusive BOOLEAN) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH names(account) AS (SELECT unnest(ARRAY['cash','vat_reserve','savings','equipment','website','stock','prepaid','lab_payable','energy_payable','vat_payable',
 'opening_equity','capital','suspense','revenue_online','revenue_shop','revenue_wholesale','revenue_rewards','revenue_interest',
 'expense_lab','expense_energy','expense_processing','expense_hosting','expense_advertising','expense_domiciliation','expense_maintenance','expense_depreciation','stock_variation','expense_other','loan_payable','expense_loan_interest','crypto_assets','revenue_crypto_gains','expense_crypto_losses'])),
 later AS (SELECT line->>'account' account,SUM((line->>'deltaCents')::BIGINT)::BIGINT balance FROM public.kq_treasury_journal j
  CROSS JOIN LATERAL jsonb_array_elements(j.postings) line WHERE j.user_id=p_user AND j.kind<>'opening'
   AND (j.occurred_at>p_at OR (NOT p_inclusive AND j.occurred_at=p_at)) GROUP BY line->>'account')
 SELECT jsonb_object_agg(names.account,COALESCE(current.balance_cents,0)-COALESCE(later.balance,0))
 FROM names LEFT JOIN public.kq_treasury_balances current ON current.user_id=p_user AND current.account=names.account LEFT JOIN later ON later.account=names.account;
$$;
CREATE OR REPLACE FUNCTION public.rpc_kq_treasury_snapshot(p_user_id UUID,p_period TEXT DEFAULT 'current',p_offset INTEGER DEFAULT 0,p_limit INTEGER DEFAULT 25) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE started TIMESTAMPTZ; origin TIMESTAMPTZ; month_start TIMESTAMPTZ; period_from TIMESTAMPTZ; period_to TIMESTAMPTZ;
 opening JSONB; closing JSONB; series JSONB; items JSONB; total BIGINT; step_seconds BIGINT; checks JSONB; unclassified JSONB;
BEGIN
 IF p_user_id IS NULL OR p_period IS NULL OR p_period NOT IN ('current','previous','all') OR p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'treasury_invalid_request'; END IF;
 -- Match every other economy endpoint's wallet -> commerce/account lock order.
 PERFORM public.kq_business_settle(p_user_id);
 PERFORM public.kq_treasury_initialize(p_user_id);
 IF EXISTS(SELECT 1 FROM public.arena_chanvrier_profiles WHERE user_id=p_user_id AND strength='treasurer') THEN
  PERFORM public.rpc_arena_chanvrier_savings(p_user_id,'state',0,NULL);
 END IF;
 PERFORM public.kq_treasury_refresh(p_user_id);
 SELECT started_at INTO started FROM public.kq_treasury_accounts WHERE user_id=p_user_id;
 SELECT business_started_at INTO origin FROM public.kq_commerce_accounts WHERE user_id=p_user_id;
 origin:=COALESCE(origin,started);
 month_start:=origin+FLOOR(GREATEST(0,EXTRACT(EPOCH FROM (now()-origin)))/432000)*interval '120 hours';
 period_from:=CASE p_period WHEN 'current' THEN GREATEST(started,month_start) WHEN 'previous' THEN GREATEST(started,month_start-interval '120 hours') ELSE started END;
 period_to:=GREATEST(period_from,CASE p_period WHEN 'previous' THEN LEAST(now(),month_start) ELSE now() END);
 opening:=public.kq_treasury_balances_at(p_user_id,period_from,false);
 closing:=public.kq_treasury_balances_at(p_user_id,period_to,p_period<>'previous');
 -- A prior period entirely before opening has no observed activity or chart.
 IF period_to=period_from AND p_period='previous' THEN closing:=opening; END IF;
 step_seconds:=CASE WHEN p_period='all' THEN 432000*GREATEST(1,CEIL(EXTRACT(EPOCH FROM (period_to-period_from))/432000/1200))::BIGINT ELSE 14400 END;
 WITH buckets AS (
  SELECT GREATEST(period_from,stamp) AS bucket_from,LEAST(period_to,stamp+step_seconds*interval '1 second') AS bucket_to
  FROM generate_series(origin+FLOOR(EXTRACT(EPOCH FROM (period_from-origin))/step_seconds)*step_seconds*interval '1 second',
   period_to,step_seconds*interval '1 second') stamp WHERE period_to>period_from AND stamp<period_to AND stamp+step_seconds*interval '1 second'>period_from
 ), flows AS (
  SELECT j.occurred_at,line->>'account' account,(line->>'deltaCents')::BIGINT amount
  FROM public.kq_treasury_journal j CROSS JOIN LATERAL jsonb_array_elements(j.postings) line
  WHERE j.user_id=p_user_id AND j.kind<>'opening' AND j.occurred_at>=period_from
   AND (j.occurred_at<period_to OR (p_period<>'previous' AND j.occurred_at=period_to))
 ), bucket_flows AS (
  SELECT b.bucket_from,b.bucket_to,
   COALESCE(SUM(f.amount) FILTER(WHERE f.account='cash'),0)::BIGINT cash_delta,
   COALESCE(SUM(f.amount) FILTER(WHERE f.account='cash' AND f.amount>0),0)::BIGINT inflows,
   COALESCE(-SUM(f.amount) FILTER(WHERE f.account='cash' AND f.amount<0),0)::BIGINT outflows,
   COALESCE(-SUM(f.amount) FILTER(WHERE f.account LIKE 'revenue_%'),0)::BIGINT revenue,
   COALESCE(SUM(f.amount) FILTER(WHERE f.account LIKE 'expense_%' OR f.account='stock_variation'),0)::BIGINT expense
  FROM buckets b LEFT JOIN flows f ON f.occurred_at>=b.bucket_from AND (f.occurred_at<b.bucket_to OR (p_period<>'previous' AND b.bucket_to=period_to AND f.occurred_at=period_to))
  GROUP BY b.bucket_from,b.bucket_to
 ), points AS (
  SELECT *, (opening->>'cash')::BIGINT+COALESCE(SUM(cash_delta) OVER(ORDER BY bucket_from ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0)::BIGINT cash_opening,
   (opening->>'cash')::BIGINT+SUM(cash_delta) OVER(ORDER BY bucket_from)::BIGINT cash_closing FROM bucket_flows
 ) SELECT COALESCE(jsonb_agg(jsonb_build_object('from',bucket_from,'to',bucket_to,'cashOpeningCents',cash_opening,'cashClosingCents',cash_closing,
  'inflowsCents',inflows,'outflowsCents',outflows,'revenueCents',revenue,'expenseCents',expense) ORDER BY bucket_from),'[]'::JSONB) INTO series FROM points;
 SELECT COUNT(*) INTO total FROM public.kq_treasury_journal j WHERE user_id=p_user_id AND occurred_at>=period_from
  AND (occurred_at<period_to OR (p_period<>'previous' AND occurred_at=period_to)) AND (period_to>period_from OR p_period<>'previous');
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',j.id,'occurredAt',j.occurred_at,'kind',j.kind,'reference',j.reference,'postings',j.postings) ORDER BY j.occurred_at DESC,j.id DESC),'[]'::JSONB)
 INTO items FROM (SELECT * FROM public.kq_treasury_journal WHERE user_id=p_user_id AND occurred_at>=period_from
  AND (occurred_at<period_to OR (p_period<>'previous' AND occurred_at=period_to)) AND (period_to>period_from OR p_period<>'previous') ORDER BY occurred_at DESC,id DESC OFFSET p_offset LIMIT p_limit) j;
 -- Match counterparts within the same committed financial transaction. Opposite
 -- unknown transactions remain visible even if their total suspense cancels out.
 -- The report refresh above has already completed deferred asset/stock valuation.
 WITH unresolved AS (
  SELECT j.transaction_id,SUM((line->>'deltaCents')::BIGINT)::BIGINT amount
  FROM public.kq_treasury_journal j CROSS JOIN LATERAL jsonb_array_elements(j.postings) line
  WHERE j.user_id=p_user_id AND line->>'account'='suspense'
   AND (j.occurred_at<period_to OR (p_period<>'previous' AND j.occurred_at=period_to))
  GROUP BY j.transaction_id HAVING SUM((line->>'deltaCents')::BIGINT)<>0
 ) SELECT jsonb_build_object('transactions',COUNT(*),'netCents',COALESCE(SUM(amount),0),'absoluteCents',COALESCE(SUM(ABS(amount)),0))
 INTO unclassified FROM unresolved;
 SELECT jsonb_build_object('walletCashCents',w.cash_cents,'vatReserveCents',a.vat_reserved_cents,
  'savingsCents',COALESCE((SELECT SUM(balance_cents) FROM public.arena_chanvrier_savings_deposits WHERE user_id=p_user_id),0),
  'labDebtCents',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_lab_invoices WHERE user_id=p_user_id),0),
  'energyDebtCents',COALESCE((SELECT SUM(remaining_cents) FROM public.kq_energy_invoices WHERE user_id=p_user_id),0),
  'loanDebtCents',COALESCE((SELECT SUM(total_cents-paid_cents) FROM public.kq_bank_loans WHERE user_id=p_user_id),0),
  'cryptoCostCents',COALESCE((SELECT SUM(cost_basis_cents) FROM public.kq_crypto_positions WHERE user_id=p_user_id),0),
  'vatDebtCents',a.vat_reserved_cents) INTO checks FROM public.kq_equipment_wallets w JOIN public.kq_commerce_accounts a USING(user_id) WHERE w.user_id=p_user_id;
 RETURN jsonb_build_object('version',1,'serverNow',now(),'startedAt',started,'businessStartedAt',origin,
  'period',jsonb_build_object('key',p_period,'from',period_from,'to',period_to),'openingBalances',opening,'closingBalances',closing,
  'series',series,'journal',jsonb_build_object('items',items,'total',total,'offset',p_offset,'limit',p_limit),'checks',checks,'unclassified',unclassified);
END $$;


REVOKE ALL ON FUNCTION public.kq_treasury_balances_at(UUID,TIMESTAMPTZ,BOOLEAN) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_kq_treasury_snapshot(UUID,TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_treasury_snapshot(UUID,TEXT,INTEGER,INTEGER) TO service_role;
COMMIT;
