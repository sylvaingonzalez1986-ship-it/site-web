import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725003000_kq_dormant_season_rollover.sql"),
  "utf8",
);
const foundation = readFileSync(
  join(process.cwd(), "supabase/migrations/20260722000100_kanab_quest_game_foundation.sql"),
  "utf8",
);

describe("Kanab Quest dormant season rollover", () => {
  it("preserves an immutable ranked archive before resetting profiles", () => {
    const archiveIndex = migration.indexOf("INSERT INTO public.kq_season_rank_archives");
    const resetIndex = migration.indexOf("UPDATE public.kq_rank_profiles SET");
    expect(archiveIndex).toBeGreaterThan(0);
    expect(resetIndex).toBeGreaterThan(archiveIndex);
    expect(migration).toContain("UNIQUE (season_code, final_rank)");
  });

  it("refuses execution while rewards or battles are unfinished", () => {
    expect(migration).toContain("Season rewards are incomplete");
    expect(migration).toContain("Locked battles prevent season rollover");
    expect(migration).toContain("missingRewardGrants");
  });

  it("is preview-only by default and has no client permissions", () => {
    expect(migration).toContain("p_execute BOOLEAN DEFAULT FALSE");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.rpc_kq_rollover_season");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("serializes and safely recognizes an already completed rollover", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("v_from_status = 'closed' AND v_to_status = 'active'");
    expect(migration).toContain("'alreadyRolled', true");
  });

  it("uses the exact same deterministic tie-break for daily and final ranks", () => {
    const order = "ORDER BY rating DESC, season_points DESC, wins DESC, user_id";
    expect(foundation).toContain(order);
    expect(migration).toContain(order);
  });
});
