-- Run after the archive and table locks, before deleting the game parents.
-- A loyalty purchase or admin grant emits its batch of tickets and its audit row
-- in one transaction. Historical batch receipts carry a count but no ticket IDs.
CREATE TEMP TABLE reset_ticket_batches ON COMMIT DROP AS
SELECT a.user_id, a.created_at, a.id AS audit_id, a.ticket_id, a.event_type,
       a.details->>'reason' AS reason,
       COALESCE((a.details->>'ticket_count')::int, (a.details->>'pack_count')::int, 1) AS issued
FROM public.lottery_audit_log a
WHERE a.event_type IN ('points_pack_purchase', 'admin_grant', 'welcome_pack_granted');

DO $ticket_origins$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (SELECT user_id, created_at, count(*) AS tickets
          FROM public.lottery_tickets WHERE order_id IS NULL GROUP BY user_id, created_at) t
    LEFT JOIN reset_ticket_batches b USING (user_id, created_at)
    GROUP BY t.user_id, t.created_at, t.tickets
    HAVING count(b.audit_id) <> 1 OR max(b.issued) <> t.tickets
  ) THEN RAISE EXCEPTION 'game_reset_ticket_batch_not_reconciled'; END IF;
  IF EXISTS (
    SELECT 1 FROM reset_ticket_batches b WHERE b.event_type = 'admin_grant' AND
      COALESCE(b.reason, '') !~* '^(Mission([ :]| sociale:)|Badge concours - |Pack de bienvenue|March. des korrigans - |Bonus assortiment concours - |Parrainage: choix packs |Retard Mondial Relay$|Attribution manuelle (admin|loterie)$)'
  ) THEN RAISE EXCEPTION 'game_reset_ticket_grant_reason_unclassified'; END IF;
END $ticket_origins$;

CREATE TEMP TABLE reset_paid_tickets ON COMMIT DROP AS
SELECT t.id FROM public.lottery_tickets t
WHERE t.order_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM reset_ticket_batches b WHERE b.user_id = t.user_id AND b.created_at = t.created_at
    AND (b.ticket_id IS NULL OR b.ticket_id = t.id) AND (
      b.event_type = 'points_pack_purchase'
      OR (b.event_type = 'admin_grant' AND (
        -- Historical carrier-delay compensation was issued without an order ID.
        b.reason = 'Retard Mondial Relay'
        OR EXISTS (SELECT 1 FROM public.kq_contest_bundle_reward_grants g
                   WHERE g.user_id = t.user_id AND b.reason = 'Bonus assortiment concours - ' || g.order_id)
        OR EXISTS (SELECT 1 FROM public.referral_pending_rewards r WHERE r.referrer_id = t.user_id
                   AND b.reason = 'Parrainage: choix packs (filleul commande ' || r.order_id || ')')
      ))
    )
);
ALTER TABLE reset_paid_tickets ADD PRIMARY KEY (id);
-- Do not retire a purchase-related batch if its associated order evidence changed.
DO $commercial_batches$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lottery_tickets t JOIN reset_ticket_batches b USING(user_id, created_at)
             WHERE b.event_type = 'admin_grant' AND b.reason ~ '^(Bonus assortiment concours - |Parrainage: choix packs )'
               AND NOT EXISTS (SELECT 1 FROM reset_paid_tickets p WHERE p.id = t.id))
  THEN RAISE EXCEPTION 'game_reset_commercial_grant_missing_receipt'; END IF;
END $commercial_batches$;

CREATE TEMP TABLE reset_paid_boosters ON COMMIT DROP AS
SELECT e.id FROM public.kq_support_booster_entitlements e
WHERE e.source IN ('pioneer_pack', 'points_purchase', 'contest_bundle')
   OR EXISTS (SELECT 1 FROM reset_paid_tickets t WHERE t.id = e.ticket_id)
   OR EXISTS (SELECT 1 FROM public.kq_support_points_purchases p
              WHERE p.user_id = e.user_id AND e.id = ANY(p.entitlement_ids));

-- The grant and per-flower pack receipts have mandatory FKs to the very booster
-- they prove. Keep the original object and its opening, including the cards drawn.
CREATE TEMP TABLE reset_kept_boosters ON COMMIT DROP AS
SELECT id FROM reset_paid_boosters
UNION SELECT entitlement_id FROM public.kq_notebook_flower_reward_grants
UNION SELECT entitlement_id FROM public.kq_notebook_flower_reward_packs;
ALTER TABLE reset_kept_boosters ADD PRIMARY KEY (id);

CREATE TEMP TABLE reset_boosters ON COMMIT DROP AS
SELECT e.id FROM public.kq_support_booster_entitlements e
WHERE NOT EXISTS (SELECT 1 FROM reset_kept_boosters k WHERE k.id = e.id);
ALTER TABLE reset_boosters ADD PRIMARY KEY (id);

CREATE TEMP TABLE reset_paid_cards ON COMMIT DROP AS
SELECT i.id FROM public.lottery_card_instances i
WHERE i.pioneer_grant_id IS NOT NULL OR i.contest_bundle_order_id IS NOT NULL
   OR i.producer_purchase_buddie_grant_id IS NOT NULL
   OR EXISTS (SELECT 1 FROM public.kq_producer_purchase_buddie_grants g
              WHERE g.user_id = i.user_id AND g.card_instance_id = i.id)
   OR EXISTS (SELECT 1 FROM reset_paid_tickets t WHERE t.id = i.ticket_id)
   OR EXISTS (SELECT 1 FROM reset_paid_boosters e WHERE e.id = i.kq_support_entitlement_id);
ALTER TABLE reset_paid_cards ADD PRIMARY KEY (id);

CREATE TEMP TABLE reset_kept_cards ON COMMIT DROP AS
SELECT id FROM reset_paid_cards
UNION SELECT i.id FROM public.lottery_card_instances i JOIN reset_kept_boosters b ON b.id = i.kq_support_entitlement_id;
ALTER TABLE reset_kept_cards ADD PRIMARY KEY (id);
CREATE TEMP TABLE reset_cards ON COMMIT DROP AS
SELECT i.id FROM public.lottery_card_instances i WHERE NOT EXISTS (SELECT 1 FROM reset_kept_cards k WHERE k.id = i.id);

CREATE TEMP TABLE reset_kept_heritages ON COMMIT DROP AS
SELECT d.id FROM public.kq_heritage_draws d WHERE d.order_item_id IS NOT NULL
   OR EXISTS (SELECT 1 FROM public.kq_producer_heritage_reward_grants g WHERE g.heritage_draw_id = d.id);
CREATE TEMP TABLE reset_kept_badges ON COMMIT DROP AS
SELECT b.id FROM public.contest_profile_badges b
WHERE b.review_id IS NOT NULL OR b.reward_claimed_at IS NOT NULL
   OR EXISTS (SELECT 1 FROM public.kq_notebook_reward_grants g WHERE g.profile_badge_id = b.id);

-- Claimed completions are the one-off receipts for store rewards. A pending
-- page stays complete only if every required active card survives the reset.
CREATE TEMP TABLE reset_kept_pages ON COMMIT DROP AS
SELECT p.id FROM public.lottery_collection_page_completions p
WHERE p.reward_claim_id IS NOT NULL OR p.claimed_at IS NOT NULL OR (
  EXISTS (SELECT 1 FROM public.lottery_card_definitions d WHERE d.rarity = p.page_rarity AND d.is_active) AND
  NOT EXISTS (SELECT 1 FROM public.lottery_card_definitions d
              WHERE d.rarity = p.page_rarity AND d.is_active AND NOT EXISTS (
                SELECT 1 FROM public.lottery_card_instances i JOIN reset_kept_cards k USING(id)
                WHERE i.user_id = p.user_id AND i.card_definition_id = d.id))
);

DELETE FROM public.kq_zone_card_reservations;
DELETE FROM public.lottery_card_instances i USING reset_cards r WHERE i.id = r.id;
-- Multi-origin cards keep their instance, definition and purchase proof. Unlink
-- only the retired game parents so their cascading FK cannot destroy the card.
UPDATE public.lottery_card_instances i SET
  source_bot_battle_id = NULL, game_mission_reward_id = NULL,
  starter_buddie_recovery_id = NULL, korrigan_draw_id = NULL,
  kq_support_entitlement_id = CASE WHEN b.id IS NULL THEN i.kq_support_entitlement_id END
FROM reset_kept_cards k LEFT JOIN (
  SELECT c.id FROM public.lottery_card_instances c JOIN reset_boosters e ON e.id = c.kq_support_entitlement_id
) b ON b.id = k.id
WHERE i.id = k.id AND (i.source_bot_battle_id IS NOT NULL OR i.game_mission_reward_id IS NOT NULL
  OR i.starter_buddie_recovery_id IS NOT NULL OR i.korrigan_draw_id IS NOT NULL OR b.id IS NOT NULL);
DELETE FROM public.kq_support_booster_entitlements e USING reset_boosters r WHERE e.id = r.id;
-- Tickets may still secure discounts, stickers, redemption history or a physical
-- delivery. Keep each row, and retire the spending right on unused free tickets.
UPDATE public.lottery_tickets t SET status = 'scratched', scratched_at = now()
WHERE t.status = 'available' AND NOT EXISTS (SELECT 1 FROM reset_paid_tickets k WHERE k.id = t.id);
DELETE FROM public.contest_profile_badges b WHERE NOT EXISTS (SELECT 1 FROM reset_kept_badges k WHERE k.id = b.id);
DELETE FROM public.lottery_collection_page_completions p WHERE NOT EXISTS (SELECT 1 FROM reset_kept_pages k WHERE k.id = p.id);
-- Fragments are game currency. Remove the ledger before draws (ON DELETE RESTRICT).
DELETE FROM public.kq_heritage_fragment_ledger;
DELETE FROM public.kq_heritage_draws d WHERE NOT EXISTS (SELECT 1 FROM reset_kept_heritages k WHERE k.id = d.id);
