import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KQ_CARDS, KQ_RETIRED_CARDS } from "@/lib/kanab-quest-game";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260901000100_kq_us_processing_and_culture_systems.sql"),
  "utf8",
);

describe("Kanab Quest non-dominated support cards migration", () => {
  it("keeps the four differentiated cultivation systems aligned with the historical catalogue", () => {
    ["BOTTE-001", "BOTTE-007", "BOTTE-008", "BOTTE-009"].forEach((code) => {
      const card = [...KQ_CARDS, ...KQ_RETIRED_CARDS].find((candidate) => candidate.code === code);
      expect(card).toBeDefined();
      expect(migration).toContain(`'${card?.effect}'`);
      expect(migration).toContain(card?.description.replaceAll("'", "''"));
    });
  });

  it("stores a specific advantage and drawback for every former domination", () => {
    expect(migration).toContain("Tolérant et gratuit pour démarrer");
    expect(migration).toContain("pompes dépendent du courant");
    expect(migration).toContain("tampon biologique");
  });
});
