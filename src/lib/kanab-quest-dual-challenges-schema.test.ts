import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725003100_kq_dual_player_challenge_claims.sql"),
  "utf8",
);

describe("Kanab Quest dual-player challenge verdict", () => {
  it("finalizes once then claims the opponent challenges in the same transaction", () => {
    const finalizeIndex = migration.indexOf("rpc_kq_finalize_battle_with_challenges");
    const opponentIndex = migration.indexOf("v_opponent_points := public.rpc_kq_claim_daily_challenges");
    expect(finalizeIndex).toBeGreaterThan(0);
    expect(opponentIndex).toBeGreaterThan(finalizeIndex);
    expect(migration).toContain("opponentChallengePoints");
  });

  it("derives the opponent from the locked battle rather than client input", () => {
    expect(migration).toContain("v_opponent_id := CASE");
    expect(migration).not.toContain("p_opponent_id");
  });

  it("retires the single-player wrapper from direct service calls", () => {
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.rpc_kq_finalize_battle_with_challenges");
    expect(migration).toContain("FROM service_role");
  });
});
