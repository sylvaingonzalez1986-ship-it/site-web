import { describe, expect, it } from "vitest";
import { KQ_BUDDIES } from "./kanab-quest-game";
import { getKqBuddieFlavors } from "./kanab-quest-buddie-flavors";
import { getKqBuddieVariety, KQ_BUDDIE_VARIETIES } from "./kanab-quest-buddie-varieties";

describe("Buddie variety references", () => {
  it("provides one complete editorial profile and two tastes for every Buddie", () => {
    expect(KQ_BUDDIE_VARIETIES.map(variety => variety.code).sort()).toEqual(KQ_BUDDIES.map(buddie => buddie.code).sort());
    expect(new Set(KQ_BUDDIE_VARIETIES.map(variety => variety.code)).size).toBe(KQ_BUDDIE_VARIETIES.length);
    for (const buddie of KQ_BUDDIES) {
      const variety = getKqBuddieVariety(buddie.code)!;
      for (const field of [variety.summary, variety.history, variety.origin, variety.lineage]) {
        expect(field.trim().length, buddie.name).toBeGreaterThan(0);
      }
      expect(variety.characteristics.length, buddie.name).toBeGreaterThanOrEqual(2);
      expect(variety.characteristics.every(characteristic => characteristic.trim().length > 10), buddie.name).toBe(true);
      expect(getKqBuddieFlavors(buddie.code), buddie.name).toHaveLength(2);
      expect(["documented", "commercial-name", "fiction"], buddie.name).toContain(variety.identity);
      expect(variety.reviewedAt, buddie.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("attributes real descriptions and qualifies ambiguous commercial identities", () => {
    for (const variety of KQ_BUDDIE_VARIETIES) {
      if (variety.identity === "fiction") {
        expect(variety.code).toBe("HH2026-001");
        expect(variety.sources).toHaveLength(0);
        continue;
      }
      expect(variety.sources.length, variety.code).toBeGreaterThan(0);
      for (const source of variety.sources) {
        expect(source.label.trim().length, variety.code).toBeGreaterThan(2);
        const url = new URL(source.url);
        expect(url.protocol, variety.code).toBe("https:");
        expect(url.hostname, variety.code).not.toMatch(/^(localhost|127\.)/);
      }
      if (variety.identity === "commercial-name") expect(variety.caveat?.trim().length ?? 0, variety.code).toBeGreaterThan(15);
    }
  });

  it("keeps fictitious identity and simulated chemistry out of real variety facts", () => {
    expect(getKqBuddieVariety("HH2026-001")?.identity).toBe("fiction");
    for (const variety of KQ_BUDDIE_VARIETIES) {
      expect(variety).not.toHaveProperty("cannabinoidTargets");
      expect(variety).not.toHaveProperty("yieldFactor");
    }
    for (const code of ["", "HH2026-999", "constructor", "__proto__", "toString"]) {
      expect(getKqBuddieVariety(code)).toBeUndefined();
    }
  });
});
