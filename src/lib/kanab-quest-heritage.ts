export type KqHeritageRarity = "common" | "rare" | "epic";
export type KqHeritageTiming = "passive" | "once-per-run";

export type KqHeritageCard = {
  code: string;
  name: string;
  rarity: KqHeritageRarity;
  timing: KqHeritageTiming;
  effect:
    | "root-danger-shield"
    | "starting-xp"
    | "opening-draw-twelve"
    | "climate-pressure-shield"
    | "extra-redraw"
    | "failure-xp"
    | "reroll-neutral"
    | "free-pest-inspection"
    | "flower-neutral-success"
    | "drying-reroll-lowest"
    | "ignore-roll-dangers"
    | "four-keep-three";
  description: string;
};

export const KQ_HERITAGE_CARDS: readonly KqHeritageCard[] = [
  { code: "HERITAGE-001", name: "Racines solides", rarity: "common", timing: "once-per-run", effect: "root-danger-shield", description: "Annule le premier Danger pendant l’Enracinement." },
  { code: "HERITAGE-002", name: "Réserve du jardinier", rarity: "common", timing: "passive", effect: "starting-xp", description: "Commence chaque culture avec 1 XP supplémentaire." },
  { code: "HERITAGE-003", name: "Main prévoyante", rarity: "common", timing: "once-per-run", effect: "opening-draw-twelve", description: "À la première étape, pioche 12 cartes et conserve une main de 10." },
  { code: "HERITAGE-004", name: "Climat stable", rarity: "common", timing: "once-per-run", effect: "climate-pressure-shield", description: "Ignore la première hausse de pression provoquée par le climat." },
  { code: "HERITAGE-005", name: "Second regard", rarity: "common", timing: "passive", effect: "extra-redraw", description: "Accorde un changement de main supplémentaire par culture." },
  { code: "HERITAGE-006", name: "Reprise vigoureuse", rarity: "common", timing: "once-per-run", effect: "failure-xp", description: "Après le premier échec de la culture, récupère 1 XP." },
  { code: "HERITAGE-007", name: "Instinct du cultivateur", rarity: "rare", timing: "once-per-run", effect: "reroll-neutral", description: "Après un lancer, relance un dé neutre." },
  { code: "HERITAGE-008", name: "Bouclier biologique", rarity: "rare", timing: "once-per-run", effect: "free-pest-inspection", description: "La première inspection révèle le ravageur sans coût supplémentaire." },
  { code: "HERITAGE-009", name: "Floraison maîtrisée", rarity: "rare", timing: "once-per-run", effect: "flower-neutral-success", description: "Pendant la Floraison, transforme un résultat neutre en réussite." },
  { code: "HERITAGE-010", name: "Affinage patient", rarity: "rare", timing: "once-per-run", effect: "drying-reroll-lowest", description: "À la dernière étape, relance le dé le plus faible." },
  { code: "HERITAGE-011", name: "Héritage de la canopée", rarity: "epic", timing: "once-per-run", effect: "ignore-roll-dangers", description: "Ignore tous les Dangers d’un lancer, sans créer d’Étincelle." },
  { code: "HERITAGE-012", name: "Signature du maître", rarity: "epic", timing: "once-per-run", effect: "four-keep-three", description: "Ajoute un quatrième dé et conserve les trois meilleurs." },
] as const;

export const KQ_HERITAGE_PITY_THRESHOLD = 5;
export const KQ_HERITAGE_DUPLICATE_FRAGMENTS: Readonly<Record<KqHeritageRarity, number>> = {
  common: 1,
  rare: 3,
  epic: 8,
};

export const KQ_HERITAGE_CRAFT_COSTS = {
  common: 5,
  rare: 12,
  epic: null,
} as const;

function heritageRandom(seed: number, salt: number) {
  let value = (Math.abs(Math.floor(seed)) + salt * 0x9e3779b1) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x100000000;
}

export function getKqHeritageRarity(seed: number, pullsWithoutRare: number): KqHeritageRarity {
  const roll = heritageRandom(seed, 1);
  if (pullsWithoutRare >= KQ_HERITAGE_PITY_THRESHOLD) return roll < 0.84 ? "rare" : "epic";
  if (roll < 0.7) return "common";
  if (roll < 0.95) return "rare";
  return "epic";
}

export function drawKqHeritageCard(input: {
  seed: number;
  pullsWithoutRare: number;
  ownedCodes?: string[];
}) {
  const rarity = getKqHeritageRarity(input.seed, input.pullsWithoutRare);
  const rarityPool = KQ_HERITAGE_CARDS.filter((card) => card.rarity === rarity);
  const owned = new Set(input.ownedCodes ?? []);
  const missingPool = rarityPool.filter((card) => !owned.has(card.code));
  const pool = missingPool.length > 0 ? missingPool : rarityPool;
  const card = pool[Math.floor(heritageRandom(input.seed, 2) * pool.length)] ?? pool[0];
  return {
    card,
    duplicate: owned.has(card.code),
    pullsWithoutRare: rarity === "common" ? input.pullsWithoutRare + 1 : 0,
    pityTriggered: input.pullsWithoutRare >= KQ_HERITAGE_PITY_THRESHOLD,
  };
}
