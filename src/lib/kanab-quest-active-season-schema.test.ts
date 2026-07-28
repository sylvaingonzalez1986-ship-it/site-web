import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725003300_kq_active_season_profiles.sql"),
  "utf8",
);
const backend = readFileSync(
  join(process.cwd(), "src/lib/supabase/kanab-quest-backend.ts"),
  "utf8",
);

describe("Kanab Quest active season resolution", () => {
  it("assigns every newly created rank profile to the active season", () => {
    expect(migration).toContain("WHERE status = 'active'");
    expect(migration).toContain("SET DEFAULT public.kq_active_season_code()");
  });

  it("keeps the resolver private to service-side operations", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.kq_active_season_code()");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("does not pin leaderboard and reward reads to the first season", () => {
    const dynamicSection = backend.slice(backend.indexOf("export async function getKqPublicLeaderboard"));
    expect(dynamicSection).not.toContain("KQ_SEASON_CODE");
    expect(dynamicSection).toContain("getKqActiveSeasonCode()");
  });
});
