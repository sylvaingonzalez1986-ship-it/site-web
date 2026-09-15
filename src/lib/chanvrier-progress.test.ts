import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achievementProgress, parseChanvrierShowcase } from "./chanvrier-progress";
import { readFileSync } from "node:fs";
describe("chanvrier achievements", () => {
  it("keeps UI thresholds in sync with the database catalog", () => {
    const sql = readFileSync("supabase/migrations/20260915000100_chanvrier_achievements.sql", "utf8");
    for (const a of ACHIEVEMENTS) {
      const row = sql.split("\n").find(line => line.startsWith(`('${a.code}',`));
      expect(row).toContain(`ARRAY[${a.thresholds.join(",")}]`);
    }
    expect(new Set(ACHIEVEMENTS.map(a => a.code)).size).toBe(8);
  });
  it("tracks the next tier without counting higher tiers as extra families", () => {
    expect(achievementProgress("triple-spark", {})).toMatchObject({ value: 0, tier: 0, target: 1, completed: false });
    expect(achievementProgress("triple-spark", { "triple-spark": 5 })).toMatchObject({ tier: 2, target: 20, completed: false });
    expect(achievementProgress("triple-spark", { "triple-spark": 30 })).toMatchObject({ tier: 3, target: 20, completed: true, percent: 100 });
    expect(achievementProgress("versatile-artisan", { "versatile-artisan": 2 })).toMatchObject({ tier: 0, target: 3 });
  });
  it("requires explicit, known customization fields", () => {
    expect(parseChanvrierShowcase({ badges: [], title: null, tracked: null })).not.toBeNull();
    expect(parseChanvrierShowcase({ badges: [] })).toBeNull();
    expect(parseChanvrierShowcase({ badges: [], title: "cool-head", tracked: null })).toBeNull();
    expect(parseChanvrierShowcase({ badges: [], title: "triple-spark", tracked: "jury-favorite" })).not.toBeNull();
  });
});
