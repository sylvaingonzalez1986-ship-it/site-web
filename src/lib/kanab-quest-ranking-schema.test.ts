import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725002900_kq_serialize_ranked_verdict_profiles.sql"),
  "utf8",
);

describe("Kanab Quest ranked verdict serialization", () => {
  it("creates missing profiles then locks both in canonical order", () => {
    expect(migration).toContain("INSERT INTO public.kq_rank_profiles");
    expect(migration).toContain("ORDER BY user_id");
    expect(migration).toContain("FOR UPDATE");
  });

  it("locks ranking before the atomic battle finalizer", () => {
    const lockIndex = migration.indexOf("PERFORM public.rpc_kq_lock_battle_rank_profiles");
    const finalizeIndex = migration.indexOf("v_battle := public.rpc_kq_finalize_battle");
    expect(lockIndex).toBeGreaterThan(0);
    expect(finalizeIndex).toBeGreaterThan(lockIndex);
  });

  it("only exposes the fully validated finalizer to the service role", () => {
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.rpc_kq_finalize_battle(UUID, JSONB, UUID)");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.rpc_kq_finalize_battle_with_challenges");
  });
});
