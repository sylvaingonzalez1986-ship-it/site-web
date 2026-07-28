import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const design = readFileSync(
  join(process.cwd(), "docs/bete-de-concours/PLACARD-GAME-DESIGN.md"),
  "utf8",
);
const rules = readFileSync(
  join(process.cwd(), "docs/bete-de-concours/PLACARD-RULES-DRAFT.md"),
  "utf8",
);
const normalizedRules = rules.replace(/\s+/g, " ");

describe("Kanab Quest Placard rules draft", () => {
  it("states that both generated Flowers burn at the verdict", () => {
    expect(normalizedRules).toContain("les deux Fleurs sont définitivement brûlées");
    expect(normalizedRules).toContain("que leur propriétaire gagne ou perde");
    expect(design).not.toContain("Une defaite ne detruit rien");
  });

  it("protects the Buddie, Heritage and unused La Botte cards", () => {
    expect(normalizedRules).toContain("La carte Buddie d'origine n'est jamais détruite");
    expect(normalizedRules).toContain("Héritage équipée est permanente");
    expect(normalizedRules).toContain("sans être jouées ne brûlent pas");
  });

  it("does not promise dormant season prizes", () => {
    expect(normalizedRules).toContain("ne vaut pas règlement commercial");
    expect(normalizedRules).toContain("les règles de récompense restent désactivées");
    expect(normalizedRules).toContain("Points à valider avant publication");
  });
});
