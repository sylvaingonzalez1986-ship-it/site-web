import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260906000400_kq_placard_composite_score.sql"),
  "utf8",
);

describe("Kanab Quest reputation leaderboard migration", () => {
  it("ranks the composite Placard score before deterministic tie-breakers", () => {
    expect(migration).toContain(
      "ORDER BY placard_score DESC, reputation DESC, rating DESC,",
    );
    expect(migration).toContain("wins DESC, losses ASC, season_points DESC, user_id");
  });

  it("caps seasonal activity and applies diminishing reputation returns", () => {
    expect(migration).toContain("LEAST(150, ROUND(season_points * 0.25)::INTEGER)");
    expect(migration).toContain("LEAST(100, ROUND(4 * SQRT(reputation::NUMERIC))::INTEGER)");
    expect(migration).toContain("'placardScore', placard_score");
  });

  it("keeps players without an equipment wallet eligible", () => {
    expect(migration).toContain("LEFT JOIN public.kq_equipment_wallets AS wallet");
    expect(migration).toContain("COALESCE(wallet.reputation, 0) AS reputation");
  });

  it("publishes the current reputation on every explicit refresh", () => {
    expect(migration).toContain("'reputation', reputation");
    expect(migration).toContain("ON CONFLICT (snapshot_date, season_code) DO UPDATE");
    expect(migration).toContain("generated_at = now()");
    expect(migration).not.toContain("IF FOUND");
  });

  it("keeps leaderboard refresh restricted to the service role", () => {
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });
});
