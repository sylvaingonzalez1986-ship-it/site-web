import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const gameClient = readFileSync(
  join(process.cwd(), "src/components/placard/KanabQuestDicePrototype.tsx"),
  "utf8",
);

describe("Kanab Quest onboarding", () => {
  it("explains the complete culture and workshop economy instead of the legacy pack loop", () => {
    expect(gameClient).toContain("Cultive. Transforme. Réinvestis.");
    expect(gameClient).toContain("1. Prépare ton atelier");
    expect(gameClient).toContain("2. Passe les 6 étapes");
    expect(gameClient).toContain("3. Affronte le jury");
    expect(gameClient).toContain("4. Choisis ton débouché");
    expect(gameClient).toContain("5. Réinvestis intelligemment");
    expect(gameClient).toContain("Vends le lot brut");
    expect(gameClient).toContain("en biomasse");
    expect(gameClient).toContain("ta réputation");
    expect(gameClient).not.toContain("1. Ouvre tes packs");
    expect(gameClient).not.toContain("2. Gagne des points");
  });
});
