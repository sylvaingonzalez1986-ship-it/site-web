import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KQ_CARDS } from "@/lib/kanab-quest-game";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260901000100_kq_us_processing_and_culture_systems.sql"),
  "utf8",
);

describe("Kanab Quest cultivation systems migration", () => {
  it("keeps the four systems and three organic amendments aligned with the source catalogue", () => {
    ["BOTTE-001", "BOTTE-007", "BOTTE-008", "BOTTE-009", "BOTTE-019", "BOTTE-020", "BOTTE-021"].forEach((code) => {
      const card = KQ_CARDS.find((candidate) => candidate.code === code);
      expect(card).toBeDefined();
      expect(migration).toContain(`'${card?.code}'`);
      expect(migration).toContain(`'${card?.effect}'`);
      expect(migration).toContain(card?.description.replaceAll("'", "''"));
    });
  });

  it("stores a different tradeoff for every cultivation technique", () => {
    expect(migration).toContain("Les pompes dépendent du courant");
    expect(migration).toContain("les deux meilleurs dés en Dangers");
    expect(migration).toContain("tampon biologique");
    expect(migration).toContain("'organic-feed'");
  });
});
