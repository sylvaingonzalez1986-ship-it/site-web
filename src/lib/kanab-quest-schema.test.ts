import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260722000100_kanab_quest_game_foundation.sql"),
  "utf8",
);

describe("Kanab Quest database foundation", () => {
  it("seeds the 36 unique support cards", () => {
    const codes = [...migration.matchAll(/\('BOTTE-(\d{3})'/g)].map((match) => match[1]);
    expect(new Set(codes)).toEqual(new Set(Array.from({ length: 36 }, (_, index) => String(index + 1).padStart(3, "0"))));
    expect(migration).toContain("effect TEXT NOT NULL");
    expect(migration).toContain("WHEN 'BOTTE-018' THEN 'three-to-success'");
    expect(migration).toContain("WHEN 'BOTTE-036' THEN 'cancel-danger'");
  });

  it("restricts the inspection Loupe to real pest situations", () => {
    expect(migration).toContain("('BOTTE-004', 'equipment', 'before-roll', 1, ARRAY['pest'], ARRAY[]::TEXT[])");
    expect(migration).not.toContain("ARRAY['pest','flower','harvest']");
  });

  it("keeps battle locking and flower burning server-only and atomic", () => {
    expect(migration).toContain("rpc_kq_lock_battle");
    expect(migration).toContain("v_locked_count <> 2");
    expect(migration).toContain("rpc_kq_finalize_battle");
    expect(migration).toContain("v_burned_count <> 2");
    expect(migration).toContain("TO service_role");
  });

  it("burns an exact support-card instance and keeps an immutable receipt", () => {
    expect(migration).toContain("kq_card_burn_receipts");
    expect(migration).toContain("rpc_kq_burn_support_card");
    expect(migration).toContain("DELETE FROM public.lottery_card_instances WHERE id = v_instance.id");
    expect(migration).toContain("card_instance_id UUID NOT NULL UNIQUE");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_kq_burn_support_card");
  });

  it("adds optional support boosters without replacing the three Buddie slots", () => {
    expect(migration).toContain("CHECK (pack_slot BETWEEN 1 AND 6)");
    expect(migration).toContain("kq_support_booster_entitlements");
    expect(migration).toContain("FOR v_slot IN 4..6 LOOP");
    expect(migration).toContain("IF v_slot = 4 THEN");
    expect(migration).toContain("rpc_kq_open_support_booster");
  });

  it("materializes streak boosters without inventing a purchase ticket", () => {
    expect(migration).toContain("source IN ('ticket', 'arena_streak')");
    expect(migration).toContain("ALTER COLUMN ticket_id DROP NOT NULL");
    expect(migration).toContain("kq_support_entitlement_id UUID");
    expect(migration).toContain("CHECK (ticket_id IS NOT NULL OR kq_support_entitlement_id IS NOT NULL)");
    expect(migration).toContain("rpc_kq_grant_streak_booster");
    expect(migration).toContain("v_profile.streak % 3 <> 0");
    expect(migration).toContain("'arena_streak', v_reward_key");
    expect(migration).toContain("v_winner_streak % 3 = 0");
    expect(migration).toContain("v_streak_entitlement := public.rpc_kq_grant_streak_booster(p_winner_id)");
    expect(migration).toContain("v_streak_entitlement.status = 'available'");
    expect(migration).toContain("rpc_kq_open_support_booster(v_streak_entitlement.id, p_winner_id)");
    expect(migration).toContain("TO service_role");
  });

  it("provides a daily leaderboard cache instead of live aggregation", () => {
    expect(migration).toContain("kq_rank_profiles");
    expect(migration).toContain("kq_leaderboard_snapshots");
    expect(migration).toContain("PRIMARY KEY (snapshot_date, season_code)");
    expect(migration).toContain("rpc_kq_refresh_daily_leaderboard");
    expect(migration).toContain("IF FOUND THEN RETURN v_snapshot");
    expect(migration).toContain("LIMIT 100");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("ORDER BY rating DESC, season_points DESC, wins DESC, user_id");
    expect(migration).not.toContain("ORDER BY season_points DESC, rating DESC, wins DESC, user_id");
    expect(migration).toContain("v_snapshot_date DATE := (timezone('Europe/Paris', now()))::date");
    expect(migration).not.toContain("snapshot_date = CURRENT_DATE");
  });

  it("locks the challenge day and mirrors the local Elo economy", () => {
    expect(migration).toContain("challenge_day DATE NOT NULL");
    expect(migration).toContain("timezone('Europe/Paris', now())");
    expect(migration).toContain("v_expected_one := 1.0 /");
    expect(migration).toContain("v_delta_one := round(24.0");
    expect(migration).toContain("THEN 25 + LEAST(10, streak * 2) ELSE 8");
    expect(migration).not.toContain("THEN 16 ELSE -16");
  });

  it("awards each daily challenge once through a server-only receipt", () => {
    expect(migration).toContain("kq_daily_challenge_claims");
    expect(migration).toContain("PRIMARY KEY (user_id, challenge_day, challenge_code)");
    expect(migration).toContain("rpc_kq_claim_daily_challenges");
    expect(migration).toContain("ON CONFLICT (user_id, challenge_day, challenge_code) DO NOTHING");
    expect(migration).toContain("v_run_day <> p_challenge_day");
    expect(migration).toContain("v_daily_codes := ARRAY[");
    expect(migration).toContain("WHERE code = ANY(v_daily_codes)");
    expect(migration).toContain("TO service_role");
  });
});
