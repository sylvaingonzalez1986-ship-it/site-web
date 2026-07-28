import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002400_kq_harden_battle_verdicts.sql"),
  "utf8",
);

describe("Kanab Quest battle database safeguards", () => {
  it("locks both flower rows in a canonical order", () => {
    expect(migration).toContain("ORDER BY id");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("v_locked_count <> 2");
  });

  it("rejects malformed jury rounds and a winner inconsistent with their majority", () => {
    expect(migration).toContain("jsonb_array_length(p_rounds) <> 3");
    expect(migration).toContain("Invalid jury round");
    expect(migration).toContain("Winner does not match jury rounds");
  });

  it("keeps verdict, flower burn, ranking and challenges in one transaction", () => {
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain("rpc_kq_finalize_battle(p_battle_id, p_rounds, p_winner_id)");
    expect(migration).toContain("rpc_kq_claim_daily_challenges");
    expect(migration).toContain("COMMIT;");
  });
});
