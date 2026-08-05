export type KqHeritageTiming = "passive" | "once-per-run";

export type KqHeritageCard = {
  code: string;
  name: string;
  timing: KqHeritageTiming;
  effect:
    | "root-danger-to-spark"
    | "starting-xp-two"
    | "opening-draw-thirteen"
    | "climate-danger-to-spark"
    | "two-extra-redraws"
    | "failure-to-fragile"
    | "neutral-to-spark"
    | "free-pest-mastery"
    | "flower-neutrals-to-success"
    | "drying-lowest-to-spark"
    | "dangers-to-success"
    | "five-keep-three";
  description: string;
};

export const KQ_HERITAGE_CARDS: readonly KqHeritageCard[] = [
  { code: "HERITAGE-001", name: "Racines solides", timing: "once-per-run", effect: "root-danger-to-spark", description: "Le premier Danger en Enracinement devient une Étincelle." },
  { code: "HERITAGE-002", name: "Réserve du jardinier", timing: "passive", effect: "starting-xp-two", description: "Commence chaque culture avec 2 XP supplémentaires." },
  { code: "HERITAGE-003", name: "Main prévoyante", timing: "once-per-run", effect: "opening-draw-thirteen", description: "À la première étape, pioche 13 cartes et conserve une main de 10." },
  { code: "HERITAGE-004", name: "Climat stable", timing: "once-per-run", effect: "climate-danger-to-spark", description: "Le premier Danger d’une situation Climat devient une Étincelle." },
  { code: "HERITAGE-005", name: "Second regard", timing: "passive", effect: "two-extra-redraws", description: "Accorde deux changements de main supplémentaires par culture." },
  { code: "HERITAGE-006", name: "Reprise vigoureuse", timing: "once-per-run", effect: "failure-to-fragile", description: "Le premier échec de la culture devient un résultat Fragile." },
  { code: "HERITAGE-007", name: "Instinct du cultivateur", timing: "once-per-run", effect: "neutral-to-spark", description: "Après un lancer, transforme un dé neutre en Étincelle." },
  { code: "HERITAGE-008", name: "Bouclier biologique", timing: "once-per-run", effect: "free-pest-mastery", description: "Révèle gratuitement le premier ravageur et accorde 2 XP." },
  { code: "HERITAGE-009", name: "Floraison maîtrisée", timing: "once-per-run", effect: "flower-neutrals-to-success", description: "Pendant la Floraison, transforme tous les dés neutres en réussites." },
  { code: "HERITAGE-010", name: "Affinage patient", timing: "once-per-run", effect: "drying-lowest-to-spark", description: "À la dernière étape, transforme le dé le plus faible en Étincelle." },
  { code: "HERITAGE-011", name: "Héritage de la canopée", timing: "once-per-run", effect: "dangers-to-success", description: "Transforme tous les Dangers d’un lancer en réussites." },
  { code: "HERITAGE-012", name: "Signature du maître", timing: "once-per-run", effect: "five-keep-three", description: "Lance cinq dés et conserve les trois meilleurs." },
] as const;

export const KQ_HERITAGE_DUPLICATE_FRAGMENTS = 1;
export const KQ_HERITAGE_CRAFT_COST = 5;

function heritageRandom(seed: number, salt: number) {
  let value = (Math.abs(Math.floor(seed)) + salt * 0x9e3779b1) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x100000000;
}

export function drawKqHeritageCard(input: {
  seed: number;
  ownedCodes?: string[];
}) {
  const owned = new Set(input.ownedCodes ?? []);
  const missingPool = KQ_HERITAGE_CARDS.filter((card) => !owned.has(card.code));
  const pool = missingPool.length > 0 ? missingPool : KQ_HERITAGE_CARDS;
  const card = pool[Math.floor(heritageRandom(input.seed, 1) * pool.length)] ?? pool[0];
  return {
    card,
    duplicate: owned.has(card.code),
  };
}
