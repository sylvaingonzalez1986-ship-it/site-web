import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260815000100_kq_ranking_leagues_and_buddie_balance.sql"),
  "utf8",
);

describe("Kanab Quest ranking balance migration", () => {
  it("keeps official rating and season rewards opponent-adjusted", () => {
    expect(migration).toContain("round(32.0 * (1.0 - v_expected_one))");
    expect(migration).toContain("20.0 * (1.0 - v_expected_one)");
    expect(migration).toContain("LEAST(6, streak * 2)");
  });

  it("awards score-based Arena experience through idempotent receipts", () => {
    expect(migration).toContain("WHEN v_user_round_wins = 3 THEN 1.6");
    expect(migration).toContain("WHEN v_user_round_wins = 2 THEN 1.4");
    expect(migration).toContain("ON CONFLICT DO NOTHING");
  });

  it("keeps the low-level verdict finalizer private", () => {
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_battle(UUID, JSONB, UUID)");
  });

  it("uses fewer losses before the technical id as the final sporting tie-break", () => {
    expect(migration).toContain("wins DESC, losses ASC, user_id");
  });
});
