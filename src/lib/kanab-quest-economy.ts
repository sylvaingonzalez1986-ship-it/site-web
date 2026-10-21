import { KQ_RETIRED_CARDS, KQ_ACTIVE_CARDS, KQ_CARDS, KQ_HAND_SIZE, KQ_BUDDIES, KQ_SITUATIONS, doesKqCardMatchSituation, type KqBuddieEffect, type KqGameState, type KqSupportCard } from "@/lib/kanab-quest-game";

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
    const card = KQ_ACTIVE_CARDS.find((item) => item.code === code);
    if (!card) return;
    if (card.tags.length === 0) versatile += 1;
    KQ_DECK_COVERAGE_TAGS.forEach((tag) => {
      if (card.tags.includes(tag)) coverage[tag] += 1;
    });
  });
  return { ...coverage, versatile };
}

export function buildKqCollectionDeck(inventory: Record<string, number>, mode: "one-each" | "all-copies") {
  return KQ_ACTIVE_CARDS
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
    const category = [...KQ_CARDS, ...KQ_RETIRED_CARDS].find((card) => card.code === code)?.category;
    if (category) categoryBurns[category] += 1;
  });
  return {
    burnedCodes,
    preservedCodes,
    totalBurned: burnedCodes.length,
    totalPreserved: preservedCodes.length,
    categoryBurns,
    recommendedBoosterCards: burnedCodes.length,
  };
}

export function sanitizeKqDeckSelection(selectedCodes: string[], inventory: Record<string, number>) {
  const selectedCounts: Record<string, number> = {};
  return selectedCodes.filter((code) => {
    if (!KQ_ACTIVE_CARDS.some((card) => card.code === code)) return false;
    selectedCounts[code] = (selectedCounts[code] ?? 0) + 1;
    return selectedCounts[code] <= (inventory[code] ?? 0);
  });
}

export function getKqCardChallengeFit(card: KqSupportCard, challengeCodes: string[]) {
  const effectsByChallenge: Record<string, KqSupportCard["effect"][]> = {
    "steady-grower": ["cancel-danger", "humidity-balance", "expert-recovery", "controlled-drying"],
    "no-failure": ["cancel-danger", "humidity-balance", "expert-recovery", "controlled-drying"],
    "green-streak": ["neutral-to-success", "reroll-neutral", "gentle-recovery", "emergency-adjustment"],
    "spark-hunter": ["four-keep-three", "reroll-two-low", "harvest-team"],
    "critical-touch": ["four-keep-three", "reroll-two-low", "controlled-drying"],
    // Biological control is managed through care stock, independently of cards.
    biocontrol: [],
  };
  return challengeCodes.some((code) => effectsByChallenge[code]?.includes(card.effect));
}

const RECOMMENDED_DECKS: Record<KqBuddieEffect, { support: string[] }> = {
  none: { support: ["BOTTE-003", "BOTTE-005", "BOTTE-017", "BOTTE-006"] },
  "starting-xp-1": { support: ["BOTTE-005", "BOTTE-003", "BOTTE-017", "BOTTE-018"] },
  "starting-xp-2": { support: ["BOTTE-014", "BOTTE-015", "BOTTE-018", "BOTTE-006"] },
  "starting-xp-3": { support: ["BOTTE-020", "BOTTE-015", "BOTTE-017", "BOTTE-006"] },
  "starting-xp-4": { support: ["BOTTE-020", "BOTTE-006", "BOTTE-018", "BOTTE-017"] },
};

export function buildKqRecommendedDeck(effect: KqBuddieEffect, inventory: Record<string, number>, challengeCodes: string[] = [], buddieCode?: string, options?: { startingXp: number | null }) {
  const preferred = RECOMMENDED_DECKS[effect];
  const ownedCopies = (code: string) => Number.isSafeInteger(inventory[code]) && inventory[code] > 0 ? inventory[code] : 0;
  const available = (code: string) => KQ_ACTIVE_CARDS.some(card => card.code === code) && ownedCopies(code) > 0;
  const playable = KQ_ACTIVE_CARDS.filter(card => available(card.code));
  const complete = (support: string[]) => {
    const repeatable = support.filter(code => KQ_ACTIVE_CARDS.find(card => card.code === code)?.rarity !== "epic");
    while (support.length < KQ_HAND_SIZE) {
      const previousLength = support.length;
      for (const code of repeatable) {
        if (support.length >= KQ_HAND_SIZE) break;
        if (support.filter(item => item === code).length < ownedCopies(code)) support.push(code);
      }
      if (support.length === previousLength) break;
    }
    return { support };
  };
  const buddie = KQ_BUDDIES.find((card) => card.code === buddieCode);
  if (buddie || options) {
    // An explicit null means the player's bonuses have not been loaded. Never
    // substitute the leader's bonus for an unknown official starting budget.
    const requestedXp = options ? options.startingXp : 1 + buddie!.advantageLevel;
    const startingXp = requestedXp !== null && Number.isFinite(requestedXp) ? Math.max(0, requestedXp) : null;
    const selected: KqSupportCard[] = [];
    const coverage = new Map<string, number>();
    const affordableCoverage = new Map<string, number>();
    const matches = new Map(playable.map(card => [card.code, KQ_SITUATIONS.filter(situation => doesKqCardMatchSituation(card, situation))]));
    const stageSizes = new Map(KQ_SITUATIONS.map(situation => [situation.stage, KQ_SITUATIONS.filter(item => item.stage === situation.stage).length]));
    const candidates = [...playable];
    while (selected.length < KQ_HAND_SIZE && candidates.length) {
      // Separate preparation and reaction options, with diminishing credit for
      // overlaps. Compatibility is not a win probability: dice and other card
      // conditions are unknown here, and no future scenario is consulted.
      const score = (card: KqSupportCard) => (matches.get(card.code) ?? []).reduce((sum, situation) => {
        const key = `${situation.code}:${card.timing}`;
        const weight = 1 / stageSizes.get(situation.stage)!;
        return sum + weight * (6 / (1 + (coverage.get(key) ?? 0))
          + (startingXp !== null && card.xpCost <= startingXp ? 4 / (1 + (affordableCoverage.get(key) ?? 0)) : 0));
      }, 0)
        + (getKqCardChallengeFit(card, challengeCodes) ? 3 : 0)
        + (selected.some((item) => item.timing === card.timing) ? 0 : 2)
        - card.xpCost * 0.35;
      candidates.sort((left, right) => score(right) - score(left) || left.code.localeCompare(right.code));
      const card = candidates.shift()!;
      if (card.rarity === "epic" && selected.some(item => item.rarity === "epic")) continue;
      selected.push(card);
      for (const situation of matches.get(card.code) ?? []) {
        const key = `${situation.code}:${card.timing}`;
        coverage.set(key, (coverage.get(key) ?? 0) + 1);
        if (startingXp !== null && card.xpCost <= startingXp) affordableCoverage.set(key, (affordableCoverage.get(key) ?? 0) + 1);
      }
    }
    return complete(selected.map((card) => card.code));
  }
  const challengeSupport = playable.filter((card) => getKqCardChallengeFit(card, challengeCodes)).slice(0, 2).map((card) => card.code);
  let selectedEpic = false;
  const support = [...challengeSupport, ...preferred.support.filter(available), ...playable.map((card) => card.code)]
    .filter((code, index, codes) => codes.indexOf(code) === index)
    .filter(code => {
      if (KQ_ACTIVE_CARDS.find(card => card.code === code)?.rarity !== "epic") return true;
      if (selectedEpic) return false;
      selectedEpic = true;
      return true;
    })
    .slice(0, KQ_HAND_SIZE);
  return complete(support);
}
