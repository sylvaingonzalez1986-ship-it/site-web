-- Run after retiring game parents and issuing the fresh welcome tickets. Compare
-- the complete archived objects, including ownership, dates and spent/open state.
DO $verify_collections$
DECLARE
  spec record;
  changed boolean;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('kq_support_booster_entitlements', 'reset_kept_boosters'),
    ('kq_heritage_draws', 'reset_kept_heritages'),
    ('contest_profile_badges', 'reset_kept_badges'),
    ('lottery_collection_page_completions', 'reset_kept_pages')
  ) AS v(table_name, kept_table)
  LOOP
    EXECUTE format(
      'WITH expected AS (
         SELECT a.row_data FROM game_reset_20261122.rows a JOIN pg_temp.%I k ON k.id::text = a.row_data->>''id''
         WHERE a.table_name = %L
       ), actual AS (SELECT to_jsonb(t) AS row_data FROM public.%I t)
       SELECT EXISTS ((TABLE expected EXCEPT ALL TABLE actual) UNION ALL (TABLE actual EXCEPT ALL TABLE expected))',
      spec.kept_table, spec.table_name, spec.table_name
    ) INTO changed;
    IF changed THEN RAISE EXCEPTION 'game_reset_collection_changed: %', spec.table_name; END IF;
  END LOOP;

  -- These are the only optional game references that can legitimately disappear
  -- from a multi-origin card. Compare every other attribute against the archive.
  IF EXISTS (
    WITH expected AS (
      SELECT a.row_data || jsonb_build_object(
        'source_bot_battle_id', NULL, 'game_mission_reward_id', NULL,
        'starter_buddie_recovery_id', NULL, 'korrigan_draw_id', NULL,
        'kq_support_entitlement_id', CASE WHEN r.id IS NULL THEN a.row_data->'kq_support_entitlement_id' END
      ) AS row_data
      FROM game_reset_20261122.rows a JOIN reset_kept_cards k ON k.id::text = a.row_data->>'id'
      LEFT JOIN reset_boosters r ON r.id::text = a.row_data->>'kq_support_entitlement_id'
      WHERE a.table_name = 'lottery_card_instances'
    ), actual AS (SELECT to_jsonb(i) FROM public.lottery_card_instances i)
    (TABLE expected EXCEPT ALL TABLE actual) UNION ALL (TABLE actual EXCEPT ALL TABLE expected)
  ) THEN RAISE EXCEPTION 'game_reset_card_ownership_changed'; END IF;

  IF EXISTS (
    SELECT 1 FROM game_reset_20261122.rows a
    LEFT JOIN reset_paid_tickets k ON k.id::text = a.row_data->>'id'
    LEFT JOIN public.lottery_tickets t ON t.id::text = a.row_data->>'id'
    WHERE a.table_name = 'lottery_tickets' AND to_jsonb(t) IS DISTINCT FROM
      CASE WHEN k.id IS NULL AND a.row_data->>'status' = 'available'
        THEN a.row_data || jsonb_build_object('status', 'scratched', 'scratched_at', now())
        ELSE a.row_data END
  ) THEN RAISE EXCEPTION 'game_reset_historical_ticket_changed'; END IF;

  IF EXISTS (SELECT row_data FROM game_reset_20261122.rows WHERE table_name = 'lottery_audit_log'
             EXCEPT ALL SELECT to_jsonb(a) FROM public.lottery_audit_log a)
  THEN RAISE EXCEPTION 'game_reset_lottery_history_changed'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.lottery_tickets t WHERE
      NOT EXISTS (SELECT 1 FROM game_reset_20261122.rows a WHERE a.table_name = 'lottery_tickets'
                  AND a.row_data->>'id' = t.id::text)
      AND NOT EXISTS (SELECT 1 FROM public.lottery_welcome_pack_claims w WHERE w.ticket_id = t.id AND w.user_id = t.user_id)
  ) THEN RAISE EXCEPTION 'game_reset_unexpected_new_ticket'; END IF;

  IF COALESCE((SELECT next_number FROM public.lottery_ticket_counter WHERE id = 1), 1) <>
     COALESCE((SELECT (row_data->>'next_number')::bigint FROM game_reset_20261122.rows
               WHERE table_name = 'lottery_ticket_counter' AND row_data->>'id' = '1'), 1) +
     (SELECT count(*) FROM public.lottery_welcome_pack_claims)
  THEN RAISE EXCEPTION 'game_reset_lottery_sequence_mismatch'; END IF;
END $verify_collections$;
