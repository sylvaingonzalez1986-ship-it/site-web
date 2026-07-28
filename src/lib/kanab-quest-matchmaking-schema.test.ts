import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002800_kq_trusted_ranked_matchmaking.sql"),
  "utf8",
);

describe("Kanab Quest ranked matchmaking safeguards", () => {
  it("validates flower ownership and comparable quality inside PostgreSQL", () => {
    expect(migration).toContain("v_flower_one.owner_id <> p_challenger_id");
    expect(migration).toContain("abs(v_flower_one.quality - v_flower_two.quality) > 8");
    expect(migration).toContain("Players must be distinct");
  });

  it("creates the seed in the trusted transaction", () => {
    expect(migration).toContain("v_seed := floor(random() * 2147483647)");
    expect(migration).not.toContain("p_seed");
  });

  it("prevents repeated ranked farming between the same players for 24 hours", () => {
    expect(migration).toContain("Ranked opponent cooldown");
    expect(migration).toContain("INTERVAL '24 hours'");
    expect(migration).toContain("status = 'verdict'");
  });

  it("retires the older seed-accepting RPC from the service role", () => {
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.rpc_kq_lock_battle");
    expect(migration).toContain("FROM service_role");
  });
});
