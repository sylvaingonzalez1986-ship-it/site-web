import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatKqCash, KQ_EQUIPMENT_CATALOG } from "@/lib/kanab-quest-equipment";
import { KQ_ACTIVE_CARDS } from "@/lib/kanab-quest-game";
import { KQ_SUPPORT_RARITY_WEIGHTS } from "@/lib/kanab-quest-booster";

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
const care = readFileSync(join(process.cwd(), "docs/bete-de-concours/CULTURE-VIVANTE-2026-10-15.md"), "utf8").replace(/\s+/g, " ");
const currentDesign = normalizedDesign.split("## Archives de conception")[0];

describe("Kanab Quest Placard rules draft", () => {
  it("states that both generated Flowers burn at the verdict", () => {
    expect(normalizedRules).toContain("les deux Fleurs sont définitivement brûlées");
    expect(normalizedRules).toContain("que leur propriétaire gagne ou perde");
    expect(design).not.toContain("Une defaite ne detruit rien");
  });

  it("protects the Buddie, Heritage and unused Botte du Chanvrier cards", () => {
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
    const odds = KQ_SUPPORT_RARITY_WEIGHTS;
    expect(normalizedRules).toContain(`Commun \`${odds.common} %\`, Peu commune \`${odds.uncommon} %\`, Rare \`${odds.rare} %\`, Épique \`${odds.epic} %\``);
    expect(normalizedRules).toContain("une carte par producteur présent sur la plateforme");
    expect(normalizedRules).toContain("débloque la carte de ce producteur de façon idempotente");
    expect(normalizedDesign).toContain(
      "L'ancien catalogue fermé de douze références",
    );
  });

  it("keeps the active thirty-card contract separate from archived PBI and observation", () => {
    expect(normalizedRules).toContain(`**${KQ_ACTIVE_CARDS.length} cartes actives**`);
    expect(normalizedRules).toContain("Une seule carte épique peut être jouée par culture");
    expect(normalizedRules).toContain("Les PBI se trouvent dans la boutique de soins");
    expect(normalizedRules).toContain("observations du panneau Santé sont gratuites");
    expect(normalizedRules).toContain("liste explicite de situations compatibles");
    expect(currentDesign).toContain("30 cartes actives");
    expect(currentDesign).not.toContain("les PBI restent hors deck, apparaissent apres la Loupe");
    expect(normalizedDesign).toContain("Archives de conception");
    expect(care).toContain("Une seule carte épique peut être jouée par culture");
    for (const card of KQ_ACTIVE_CARDS.filter(item => Number(item.code.slice(-3)) >= 37)) {
      expect(normalizedRules).toContain(`| ${card.code} | ${card.name} | ${card.rarity === "epic" ? "Épique" : "Commune"} | ${card.xpCost} |`);
    }
  });

  it("places timed curing after the jury and states the one-hour surplus deadline", () => {
    expect(normalizedRules).toContain("avant le jury et le duel");
    expect(normalizedRules).toContain("après leur verdict");
    expect(normalizedRules).toContain("6 heures réelles, indépendamment du calendrier du jeu");
    expect(normalizedRules).toContain("1 heure réelle après le duel");
    expect(normalizedRules).toContain("seul le surplus est vendu automatiquement");
    expect(currentDesign).toContain("Aucune ne soigne directement un parasite");
    expect(care).toContain("aucune carte ne raccourcit ses 6 heures réelles");
  });

  it("documents the durable equipment economy with the implemented prices", () => {
    expect(normalizedRules).toContain("Chaque joueur commence avec `350 €` virtuels");
    expect(normalizedRules).toContain("ne peut pas être acheté, retiré, remboursé ou converti en argent réel");
    expect(normalizedRules).toContain("une seule facture d’analyse de `45 €` pour son lot commun, quel que soit le nombre de tentes");
    KQ_EQUIPMENT_CATALOG.filter((equipment) => equipment.purchasable).forEach((equipment) => {
      const price = formatKqCash(equipment.priceCents).replace(/\s+/g, " ");
      expect(normalizedRules).toContain(`| ${equipment.name} | ${price} |`);
    });
  });

  it("documents incidents with their exact persistent consequences", () => {
    const incidents = normalizedRules.split("## 5. Incidents de culture")[1]?.split("## 6. Duel classé")[0] ?? "";
    expect(incidents).toContain("un résultat Fragile ou un Échec retire 10 points de rendement aux tentes de chaque bâtiment sans secours solaire");
    expect(incidents).toContain("Le Panneau solaire et batterie protège uniquement son bâtiment");
    expect(incidents).toContain("Les dés de la culture commune restent inchangés");
    expect(incidents).toContain("Les anciennes cultures conservent la coupure à l'étape suivante : le meilleur dé devient un Danger");
    expect(incidents).toContain("Charge répartie réduit le seuil d'une réussite");
    expect(incidents).toContain("le Branchement illégal transforme les deux dés les plus faibles après le lancer, mais ajoute 2 Pression");
    expect(incidents).toContain("Papiers en règle fixe les trois dés sur une réussite et garantit donc trois réussites pour ce contrôle");
    expect(incidents).toContain("sans protection, un résultat Fragile retire 15 points de rendement et un Échec en retire 35");
    expect(incidents).toContain("La sécurité installée protège les tentes de son bâtiment ; seules les tentes non protégées subissent ces pertes");
    expect(incidents).toContain("Gros molosse et l’Héritage de protection du vol couvrent toute la culture");
    expect(incidents).toContain("Les anciennes cultures conservent leur protection et leur perte globales");
  });

  it("documents every market threshold and the quality reputation incentive", () => {
    expect(normalizedRules).toContain("Lot brut | 5,8 | 100 % | 1,80 €/g");
    expect(normalizedRules).toContain("Hash tamisé | 6,2 | 18 % | 16 €/g");
    expect(normalizedRules).toContain("Static Sift | 8,3 | 10 % | 60 €/g");
    expect(normalizedRules).toContain("Rosin Premium | 8,0 | 20 % | 42 €/g");
    expect(normalizedRules).toContain("Rosin Signature | 8,8 | 22 % | 80 €/g");
    expect(normalizedRules).toContain("Hash Signature | 8,8 | 18 % | 70 €/g");
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
