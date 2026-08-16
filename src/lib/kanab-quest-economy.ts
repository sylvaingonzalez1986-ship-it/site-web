import { KQ_CARDS, KQ_HAND_SIZE, type KqBuddieEffect, type KqGameState, type KqSupportCard } from "@/lib/kanab-quest-game";

export function getKqOpeningHandChance(deckSize: number, copies: number, handSize = KQ_HAND_SIZE) {
  const safeDeckSize = Math.max(0, Math.floor(deckSize));
  const safeCopies = Math.min(safeDeckSize, Math.max(0, Math.floor(copies)));
  const drawn = Math.min(safeDeckSize, Math.max(0, Math.floor(handSize)));
  if (safeDeckSize === 0 || safeCopies === 0 || drawn === 0) return 0;
  if (drawn === safeDeckSize) return 100;
  let missChance = 1;
  for (let draw = 0; draw < drawn; draw += 1) {
    missChance *= (safeDeckSize - safeCopies - draw) / (safeDeckSize - draw);
  }
  return Math.round((1 - Math.max(0, missChance)) * 100);
}

export const KQ_DECK_COVERAGE_TAGS = ["roots", "water", "climate", "pest", "flower", "drying"] as const;

export function getKqDeckCoverage(selectedCodes: string[]) {
  const coverage = Object.fromEntries(KQ_DECK_COVERAGE_TAGS.map((tag) => [tag, 0])) as Record<(typeof KQ_DECK_COVERAGE_TAGS)[number], number>;
  let versatile = 0;
  selectedCodes.forEach((code) => {
    const card = KQ_CARDS.find((item) => item.code === code);
    if (!card || card.category === "substrate" || card.category === "pbi") return;
    if (card.tags.length === 0) versatile += 1;
    KQ_DECK_COVERAGE_TAGS.forEach((tag) => {
      if (card.tags.includes(tag)) coverage[tag] += 1;
    });
  });
  return { ...coverage, versatile };
}

export function buildKqCollectionDeck(inventory: Record<string, number>, mode: "one-each" | "all-copies") {
  return KQ_CARDS
    .filter((card) => card.category !== "substrate" && card.category !== "pbi")
    .flatMap((card) => Array.from(
      { length: mode === "one-each" ? Math.min(1, inventory[card.code] ?? 0) : Math.max(0, Math.floor(inventory[card.code] ?? 0)) },
      () => card.code,
    ));
}

export function summarizeKqCardEconomy(state: Pick<KqGameState, "deckCodes" | "usedCards">) {
  const burnedCodes = [...state.usedCards];
  const remainingBurns = burnedCodes.reduce<Record<string, number>>((counts, code) => {
    counts[code] = (counts[code] ?? 0) + 1;
    return counts;
  }, {});
  const preservedCodes = state.deckCodes.filter((code) => {
    if ((remainingBurns[code] ?? 0) <= 0) return true;
    remainingBurns[code] -= 1;
    return false;
  });
  const categoryBurns = Object.fromEntries(["substrate", "pbi", "equipment", "know-how", "luck"].map((category) => [category, 0])) as Record<string, number>;
  burnedCodes.forEach((code) => {
    const category = KQ_CARDS.find((card) => card.code === code)?.category;
    if (category) categoryBurns[category] += 1;
  });
  return {
    burnedCodes,
    preservedCodes,
    totalBurned: burnedCodes.length,
    totalPreserved: preservedCodes.length,
    categoryBurns,
    recommendedBoosterCards: Math.max(0, burnedCodes.length - 1),
  };
}

export function sanitizeKqDeckSelection(selectedCodes: string[], inventory: Record<string, number>) {
  const selectedCounts: Record<string, number> = {};
  return selectedCodes.filter((code) => {
    selectedCounts[code] = (selectedCounts[code] ?? 0) + 1;
    return selectedCounts[code] <= (inventory[code] ?? 0);
  });
}

export function getKqCardChallengeFit(card: KqSupportCard, challengeCodes: string[]) {
  const effectsByChallenge: Record<string, KqSupportCard["effect"][]> = {
    "steady-grower": ["cancel-danger"],
    "no-failure": ["cancel-danger"],
    "green-streak": ["neutral-to-success", "reroll-neutral"],
    "spark-hunter": ["four-keep-three", "reroll-two-low"],
    "critical-touch": ["four-keep-three", "reroll-two-low"],
    biocontrol: ["reveal-pest"],
  };
  return challengeCodes.some((code) => effectsByChallenge[code]?.includes(card.effect));
}

const RECOMMENDED_DECKS: Record<KqBuddieEffect, { substrate: string; support: string[] }> = {
  none: { substrate: "BOTTE-001", support: ["BOTTE-003", "BOTTE-005", "BOTTE-017", "BOTTE-006"] },
  "starting-xp-1": { substrate: "BOTTE-001", support: ["BOTTE-005", "BOTTE-003", "BOTTE-017", "BOTTE-018"] },
  "starting-xp-2": { substrate: "BOTTE-008", support: ["BOTTE-014", "BOTTE-015", "BOTTE-018", "BOTTE-006"] },
  "starting-xp-3": { substrate: "BOTTE-009", support: ["BOTTE-004", "BOTTE-015", "BOTTE-017", "BOTTE-006"] },
  "starting-xp-4": { substrate: "BOTTE-009", support: ["BOTTE-004", "BOTTE-006", "BOTTE-018", "BOTTE-017"] },
};

export function buildKqRecommendedDeck(effect: KqBuddieEffect, inventory: Record<string, number>, challengeCodes: string[] = []) {
  const preferred = RECOMMENDED_DECKS[effect];
  const available = (code: string) => (inventory[code] ?? 0) > 0;
  const substrate = available(preferred.substrate)
    ? preferred.substrate
    : KQ_CARDS.find((card) => card.category === "substrate" && available(card.code))?.code ?? preferred.substrate;
  const playable = KQ_CARDS.filter((card) => card.category !== "substrate" && card.category !== "pbi" && available(card.code));
  const challengeSupport = playable.filter((card) => getKqCardChallengeFit(card, challengeCodes)).slice(0, 2).map((card) => card.code);
  const support = [...challengeSupport, ...preferred.support.filter(available), ...playable.map((card) => card.code)]
    .filter((code, index, codes) => codes.indexOf(code) === index)
    .slice(0, 4);
  return { substrate, support };
}
