import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KQ_CARDS } from "@/lib/kanab-quest-game";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260830000300_kq_incident_support_cards.sql"),
  "utf8",
);

const electricityMigration = readFileSync(join(process.cwd(), "supabase/migrations/20260911000300_kq_cycle_electricity.sql"), "utf8");

const incidentCardCodes = ["BOTTE-027", "BOTTE-028", "BOTTE-031", "BOTTE-034"];

describe("Kanab Quest incident support card migration", () => {
  it("allows every new incident effect in the database constraint", () => {
    ["compliance-clearance", "illegal-power", "bill-relief", "theft-guard"].forEach((effect) => {
      expect(migration).toContain(`'${effect}'`);
    });
  });

  it("keeps the four source cards aligned with the database catalogue", () => {
    incidentCardCodes.forEach((code) => {
      const card = KQ_CARDS.find((candidate) => candidate.code === code);
      expect(card).toBeDefined();
      expect(migration).toContain(`'${card?.code}'`);
      expect(migration).toContain(`'${card?.name.replaceAll("'", "''")}'`);
      expect(migration).toContain(`'${card?.effect}'`);
      expect(migration + electricityMigration).toContain(card?.description.replaceAll("'", "''"));
    });
  });

  it("stores distinct tradeoffs and art direction prompts", () => {
    expect(migration).toContain("Ajoute immédiatement 2 Pression");
    expect(migration).toContain("Ne change pas le verdict du jury");
    expect(migration.match(/key art satirique/g)).toHaveLength(4);
    expect(migration).toContain("morceau de caleçon à carreaux");
  });
});
