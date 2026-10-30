BEGIN;

-- Completed receipts remain private. The authenticated server supplies the
-- player identity; this reader never settles orders or changes the wallet.
CREATE FUNCTION public.rpc_kq_online_sales_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_before_at TIMESTAMPTZ DEFAULT NULL,
  p_before_source TEXT DEFAULT NULL,
  p_before_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE result JSONB;
BEGIN
  IF p_user_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid_online_sales_history_page';
  END IF;
  IF num_nonnulls(p_before_at, p_before_source, p_before_id) NOT IN (0, 3)
    OR (p_before_source IS NOT NULL AND p_before_source NOT IN ('flower', 'merch'))
    OR (p_before_at IS NOT NULL AND NOT isfinite(p_before_at)) THEN
    RAISE EXCEPTION 'invalid_online_sales_history_cursor';
  END IF;

  WITH flower_sales AS MATERIALIZED (
    SELECT sale.id, 'flower'::TEXT AS source, flower.variety_name AS name,
      NULL::TEXT AS code, stock.route, sale.occurred_at,
      1 AS quantity, listing.format_grams,
      sale.payout_cents AS revenue_cents, sale.net_payout_cents,
      sale.fee_cents AS fees_cents, NULL::INTEGER AS cost_cents,
      sale.satisfaction_score AS satisfaction
    FROM public.kq_online_sales sale
    JOIN public.kq_online_listings listing ON listing.id = sale.listing_id AND listing.user_id = p_user_id
    JOIN public.kq_commerce_stock stock ON stock.id = listing.stock_id AND stock.user_id = p_user_id
    JOIN public.kq_flowers flower ON flower.id = stock.flower_id AND flower.owner_id = p_user_id
    WHERE sale.user_id = p_user_id
      AND (p_before_at IS NULL OR sale.occurred_at < p_before_at OR
        (sale.occurred_at = p_before_at AND
          ('flower' > p_before_source OR ('flower' = p_before_source AND sale.id > p_before_id))))
    ORDER BY sale.occurred_at DESC, sale.id ASC
    LIMIT p_limit + 1
  ), merch_sales AS MATERIALIZED (
    SELECT sale.id, 'merch'::TEXT AS source, NULL::TEXT AS name,
      sale.code, NULL::TEXT AS route, sale.occurred_at,
      1 AS quantity, NULL::INTEGER AS format_grams,
      sale.price_cents AS revenue_cents, sale.net_payout_cents,
      sale.fee_cents AS fees_cents, sale.cost_cents,
      NULL::NUMERIC AS satisfaction
    FROM public.kq_online_merch_sales sale
    WHERE sale.user_id = p_user_id
      AND (p_before_at IS NULL OR sale.occurred_at < p_before_at OR
        (sale.occurred_at = p_before_at AND
          ('merch' > p_before_source OR ('merch' = p_before_source AND sale.id > p_before_id))))
    ORDER BY sale.occurred_at DESC, sale.id ASC
    LIMIT p_limit + 1
  ), candidates AS MATERIALIZED (
    SELECT * FROM flower_sales
    UNION ALL
    SELECT * FROM merch_sales
  ), page AS MATERIALIZED (
    SELECT * FROM candidates
    ORDER BY occurred_at DESC, source ASC, id ASC
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'version', 1,
    'sales', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'source', source, 'name', name, 'code', code, 'route', route,
      'soldAt', occurred_at, 'quantity', quantity, 'formatGrams', format_grams,
      'revenueCents', revenue_cents, 'netPayoutCents', net_payout_cents,
      'feesCents', fees_cents, 'costCents', cost_cents, 'satisfaction', satisfaction
    ) ORDER BY occurred_at DESC, source ASC, id ASC) FROM page), '[]'::JSONB),
    'nextCursor', CASE WHEN (SELECT count(*) FROM candidates) > p_limit THEN
      (SELECT jsonb_build_object('soldAt', occurred_at, 'source', source, 'id', id)
       FROM page ORDER BY occurred_at ASC, source DESC, id DESC LIMIT 1)
      ELSE NULL END
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_online_sales_history(UUID, INTEGER, TIMESTAMPTZ, TEXT, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kq_online_sales_history(UUID, INTEGER, TIMESTAMPTZ, TEXT, UUID)
  TO service_role;

COMMIT;
