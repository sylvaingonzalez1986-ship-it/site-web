BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Count on the database side: a collector with thousands of copies must not
-- download them all or hit the Data API row limit. This index also serves burns.
CREATE INDEX IF NOT EXISTS idx_lottery_card_instances_user_definition
  ON public.lottery_card_instances(user_id, card_definition_id);

CREATE FUNCTION public.rpc_kq_card_copy_counts(p_user_id UUID, p_definition_ids UUID[])
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(c.card_definition_id::TEXT, c.copies), '{}'::JSONB)
  FROM (
    SELECT i.card_definition_id, count(*) AS copies
    FROM public.lottery_card_instances i
    WHERE i.user_id = p_user_id AND i.card_definition_id = ANY(p_definition_ids)
    GROUP BY i.card_definition_id
  ) c;
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_card_copy_counts(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_card_copy_counts(UUID, UUID[]) TO service_role;

-- Summaries are independent of the optional full admin history. In particular,
-- >1000 draws, order items or orders never truncate ownership/pending counts.
-- Public play needs the summary only and passes p_include_draws = false.
CREATE FUNCTION public.rpc_kq_heritage_snapshot(p_user_id UUID, p_include_draws BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible_items AS MATERIALIZED (
    SELECT oi.id, oi.quantity, pr.name AS producer_name
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    LEFT JOIN public.products p ON p.id = btrim(split_part(btrim(oi.product_id), '::', 1))
    LEFT JOIN public.producers pr ON pr.id = p.producer_id
    WHERE o.customer_id = p_user_id AND o.payment_state = 'paid' AND o.status <> 'cancelled'
      AND EXISTS (
        SELECT 1 FROM public.contest_entries ce
        WHERE ce.product_id = btrim(split_part(btrim(oi.product_id), '::', 1))
      )
  ), owned AS MATERIALIZED (
    SELECT d.card_code, count(*) AS copies,
      count(e.id) AS attributed_units,
      COALESCE(jsonb_agg(DISTINCT e.producer_name ORDER BY e.producer_name)
        FILTER (WHERE e.producer_name IS NOT NULL AND e.producer_name <> ''), '[]'::JSONB) AS producer_names
    FROM public.kq_heritage_draws d
    LEFT JOIN eligible_items e ON e.id = d.order_item_id
    WHERE d.user_id = p_user_id
    GROUP BY d.card_code
  )
  SELECT jsonb_build_object(
    'totalPulls', COALESCE(
      (SELECT s.total_pulls::BIGINT FROM public.kq_heritage_player_state s WHERE s.user_id = p_user_id),
      (SELECT sum(copies) FROM owned), 0),
    'eligiblePurchaseUnits', COALESCE((SELECT sum(quantity) FROM eligible_items), 0),
    'attributedPurchaseUnits', COALESCE((SELECT sum(attributed_units) FROM owned), 0),
    'ownedCounts', COALESCE((SELECT jsonb_object_agg(card_code, copies) FROM owned), '{}'::JSONB),
    'producerNamesByCard', COALESCE((SELECT jsonb_object_agg(card_code, producer_names) FROM owned), '{}'::JSONB),
    'fragmentBalance', COALESCE((SELECT w.balance FROM public.kq_heritage_fragment_wallets w WHERE w.user_id = p_user_id), 0),
    'fragmentHistory', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC, h.id DESC) FROM (
      SELECT l.id, l.amount, l.reason, l.created_at
      FROM public.kq_heritage_fragment_ledger l WHERE l.user_id = p_user_id
      ORDER BY l.created_at DESC, l.id DESC LIMIT 20
    ) h), '[]'::JSONB),
    'draws', CASE WHEN p_include_draws THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'order_item_id', d.order_item_id, 'unit_index', d.unit_index,
        'card_code', d.card_code, 'was_duplicate', d.was_duplicate,
        'source', d.source, 'drawn_at', d.drawn_at
      ) ORDER BY d.drawn_at DESC, d.id DESC)
      FROM public.kq_heritage_draws d WHERE d.user_id = p_user_id
    ), '[]'::JSONB) ELSE '[]'::JSONB END
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_kq_heritage_snapshot(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kq_heritage_snapshot(UUID, BOOLEAN) TO service_role;

COMMIT;
