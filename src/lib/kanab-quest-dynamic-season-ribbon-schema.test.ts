import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260725003400_kq_dynamic_season_reward_ribbons.sql"),
  "utf8",
);

describe("Kanab Quest dynamic season reward ribbons", () => {
  it("derives every official tier ribbon from the requested season", () => {
    expect(migration).toContain("regexp_replace(p_season_code");
    expect(migration).toContain("'Champion de saison ' || v_season_label");
    expect(migration).toContain("'Podium de saison ' || v_season_label");
    expect(migration).toContain("'Finaliste de saison ' || v_season_label");
    expect(migration).toContain("'Saison ' || v_season_label || ' complète'");
  });

  it("stores the personalized payload in the immutable grant receipt", () => {
    const personalizeIndex = migration.indexOf("v_reward_payload := jsonb_set");
    const insertIndex = migration.indexOf("INSERT INTO public.kq_season_reward_grants");
    expect(personalizeIndex).toBeGreaterThan(0);
    expect(insertIndex).toBeGreaterThan(personalizeIndex);
    expect(migration).toContain("p_final_season_points, v_reward_payload, v_grant_key");
  });

  it("keeps the unlocked helper inaccessible to clients and service callers", () => {
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
  });
});
