import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260907000100_kq_bot_daily_challenges.sql"),
  "utf8",
);

describe("Kanab Quest bot daily challenge schema", () => {
  it("records exactly one durable battle source per daily claim", () => {
    expect(migration).toContain("ALTER COLUMN battle_id DROP NOT NULL");
    expect(migration).toContain("bot_battle_id UUID");
    expect(migration).toContain("num_nonnulls(battle_id, bot_battle_id) = 1");
  });

  it("validates the run day and preserves the daily rotation and rewards", () => {
    expect(migration).toContain("kq_bot_challenge_run_mismatch");
    expect(migration).toContain("code = ANY(v_daily_codes)");
    expect(migration).toContain("WHEN 'clean-sweep' THEN 15");
    expect(migration).toContain("ON CONFLICT (user_id, challenge_day, challenge_code) DO NOTHING");
  });

  it("finalizes the burn and challenge claim in one server-only transaction", () => {
    const finalizeIndex = migration.indexOf("v_receipt := public.rpc_kq_finalize_bot_battle");
    const claimIndex = migration.indexOf("v_claim := public.rpc_kq_claim_bot_daily_challenges");
    expect(finalizeIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeGreaterThan(finalizeIndex);
    expect(migration).toContain("rpc_kq_finalize_bot_battle_with_challenges");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });
});
