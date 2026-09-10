import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatKqCash, KQ_EQUIPMENT_CATALOG } from "@/lib/kanab-quest-equipment";

const design = readFileSync(
  join(process.cwd(), "docs/bete-de-concours/PLACARD-GAME-DESIGN.md"),
  "utf8",
);
const rules = readFileSync(
  join(process.cwd(), "docs/bete-de-concours/PLACARD-RULES-DRAFT.md"),
  "utf8",
);
const normalizedDesign = design.replace(/\s+/g, " ");
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

  it("publishes booster odds and the deterministic producer Heritage model", () => {
    expect(normalizedRules).toContain("Commun `70 %`, Peu commune `24 %`, Rare `6 %`");
    expect(normalizedRules).toContain("une carte par producteur présent sur la plateforme");
    expect(normalizedRules).toContain("débloque la carte de ce producteur de façon idempotente");
    expect(normalizedDesign).toContain(
      "L'ancien catalogue fermé de douze références",
    );
  });

  it("documents the durable equipment economy with the implemented prices", () => {
    expect(normalizedRules).toContain("Chaque joueur commence avec `350 $US` virtuels");
    expect(normalizedRules).toContain("ne peut pas être acheté, retiré, remboursé ou converti en argent réel");
    KQ_EQUIPMENT_CATALOG.filter((equipment) => equipment.purchasable).forEach((equipment) => {
      const price = formatKqCash(equipment.priceCents).replace(/\s+/g, " ");
      expect(normalizedRules).toContain(`| ${equipment.name} | ${price} |`);
    });
  });

  it("documents incidents with their exact persistent consequences", () => {
    expect(normalizedRules).toContain("le meilleur dé devient un Danger");
    expect(normalizedRules).toContain("ajoute 2 Pression");
    expect(normalizedRules).toContain("garantit donc trois réussites");
    expect(normalizedRules).toContain("un résultat Fragile retire 15 %");
    expect(normalizedRules).toContain("un Échec en retire 35 %");
  });

  it("documents every market threshold and the quality reputation incentive", () => {
    expect(normalizedRules).toContain("Lot brut | 5,8 | 100 % | 1,80 $US/g");
    expect(normalizedRules).toContain("Hash tamisé | 6,2 | 18 % | 16 $US/g");
    expect(normalizedRules).toContain("Static Sift | 8,3 | 10 % | 120 $US/g");
    expect(normalizedRules).toContain("Rosin Premium | 8,0 | 20 % | 42 $US/g");
    expect(normalizedRules).toContain("Rosin Signature | 8,8 | 22 % | 80 $US/g");
    expect(normalizedRules).toContain("Hash Signature | 8,8 | 18 % | 70 $US/g");
    expect(normalizedRules).toContain("partie non traitée est valorisée en lot brut");
    expect(normalizedRules).toContain("elle retombe en biomasse dans le cas contraire");
    expect(normalizedRules).toContain("La Biomasse ne donne jamais de réputation");
    expect(normalizedRules).toContain("Aucun lot sous `6,2/10` n'en donne");
  });

  it("documents the composite score and its reputation-first tie break", () => {
    expect(normalizedRules).toContain("`cote + bonus saison + bonus réputation`");
    expect(normalizedRules).toContain("départagées dans cet ordre : réputation, cote, nombre de victoires");
  });
});
