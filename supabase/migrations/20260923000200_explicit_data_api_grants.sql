BEGIN;

-- Backfill explicit Data API privileges after replaying historical migrations.
-- These named grants cover the server backend and existing import/seed tools;
-- new tables must declare their own grants in the migration that creates them.
-- Keep client-role permissions, RLS, RPC privileges and default privileges intact.
-- Tables used only inside SECURITY DEFINER functions need no direct API grant.

-- Historical shop, CMS, lottery and contest tables.
-- Upserts need INSERT and UPDATE; reads, filters and returned rows need SELECT.
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.blog_comments,
  public.blog_ratings,
  public.cms_pages,
  public.contest_badges,
  public.contest_beta_testers,
  public.contest_profiles,
  public.contest_review_votes,
  public.contest_seasons,
  public.invoice_counter,
  public.invoices,
  public.lottery_album_cards,
  public.lottery_album_pages,
  public.lottery_bonus_definitions,
  public.lottery_card_collections,
  public.lottery_card_definitions,
  public.lottery_game_config,
  public.lottery_reward_definitions,
  public.lottery_reward_rules,
  public.orders,
  public.page_sections,
  public.printful_sync_runs,
  public.printful_sync_state,
  public.profiles,
  public.promo_codes,
  public.referral_pending_rewards,
  public.referral_reward_settings,
  public.site_content,
  public.social_mission_submissions,
  public.social_missions
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.blog_posts,
  public.contest_entries,
  public.contest_tester_points,
  public.lottery_bonus_options,
  public.newsletter_subscribers,
  public.printful_sync_products,
  public.printful_sync_variants,
  public.producers,
  public.products
TO service_role;

-- Album slots also need SELECT when embedded in the album-page API response.
-- Order-item writes are used by scripts/seed-supabase-from-json.mjs.
GRANT SELECT, INSERT, DELETE ON TABLE
  public.contest_profile_badges,
  public.lottery_album_page_slots,
  public.order_items,
  public.pack_components
TO service_role;

GRANT SELECT, UPDATE ON TABLE
  public.contest_reviews,
  public.lottery_bonus_instances
TO service_role;

GRANT SELECT ON TABLE
  public.contest_review_aroma_tags,
  public.contest_review_scores,
  public.contest_review_terpene_guesses,
  public.lottery_card_instances,
  public.lottery_collection_burn_log,
  public.lottery_collection_page_completions,
  public.lottery_collection_page_reward_options,
  public.lottery_reward_claims,
  public.lottery_tickets,
  public.lottery_welcome_pack_claims,
  public.referral_rewards
TO service_role;

GRANT INSERT ON TABLE public.audit_logs TO service_role;

-- Security-invoker views require access to their underlying tables and views.
-- contest_tester_points_summary is an indirect dependency of the rankings.
GRANT SELECT ON TABLE
  public.contest_entry_stats,
  public.contest_rankings_current,
  public.contest_review_vote_summary,
  public.contest_tester_points_summary,
  public.contest_tester_rankings_global,
  public.contest_tester_rankings_by_season
TO service_role;

-- BIGSERIAL defaults used by direct backend/import inserts and upserts.
GRANT USAGE ON SEQUENCE
  public.contest_profile_badges_id_seq,
  public.contest_review_votes_id_seq,
  public.contest_tester_points_id_seq,
  public.invoices_id_seq,
  public.newsletter_subscribers_id_seq,
  public.order_items_id_seq,
  public.printful_sync_runs_id_seq,
  public.promo_codes_id_seq
TO service_role;

-- Game and reward state read directly by the backend. Mutations continue to
-- use the existing SECURITY DEFINER RPCs and their established permissions.
GRANT SELECT ON TABLE
  public.kq_support_card_rules,
  public.kq_support_booster_entitlements,
  public.kq_runs,
  public.kq_card_burn_receipts,
  public.kq_flowers,
  public.kq_battles,
  public.kq_rank_profiles,
  public.kq_daily_challenge_claims,
  public.kq_culture_token_wallets,
  public.kq_notebook_reward_rules,
  public.kq_notebook_reward_grants,
  public.kq_heritage_card_definitions,
  public.kq_heritage_player_state,
  public.kq_heritage_draws,
  public.kq_heritage_fragment_wallets,
  public.kq_heritage_fragment_ledger,
  public.kq_season_reward_rules,
  public.kq_season_reward_grants,
  public.kq_seasons,
  public.kq_bot_battles,
  public.kq_producer_reward_campaigns,
  public.kq_producer_reward_entries,
  public.kq_notebook_flower_reward_grants,
  public.kq_producer_heritage_reward_grants,
  public.kq_notebook_flower_reward_packs,
  public.checkout_attempts,
  public.arena_customer_reward_seasons,
  public.arena_customer_reward_grants,
  public.arena_customer_reward_week_rolls,
  public.kq_equipment_catalog,
  public.kq_equipment_wallets,
  public.kq_player_equipment,
  public.kq_equipment_loadouts,
  public.kq_market_lots,
  public.kq_market_sale_receipts,
  public.kq_player_route_masteries
TO service_role;

-- Direct administrative cleanup when a contest entry is deleted.
GRANT DELETE ON TABLE
  public.kq_notebook_flower_reward_grants,
  public.kq_producer_reward_entries
TO service_role;

-- The backend marks a checkout attempt cancelled without calling an RPC.
GRANT UPDATE ON TABLE public.checkout_attempts TO service_role;

COMMIT;
