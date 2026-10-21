import { CHANVRIER_STRENGTHS, getChanvrierStartingXp, type ChanvrierStrength } from "./arena-chanvrier";
import {
  doesKqCardMatchSituation, KQ_ACTIVE_CARDS, KQ_BUDDIES, KQ_HAND_SIZE, KQ_SITUATIONS, KQ_STAGES,
  type KqStage,
} from "./kanab-quest-game";
import { isKqHeritageEffect, KQ_HERITAGE_STARTING_XP_BONUS, type KqHeritageCard } from "./kanab-quest-heritage";
import { KQ_CULTURE_TOKEN_RUN_CAP, KQ_CULTURE_TOKEN_START_XP } from "./kanab-quest-notebook-rewards";

export type KqDeckPreparationInput = {
  deckCodes: readonly string[];
  /** null means the stock has not been verified; a missing key in known stock is zero. */
  inventory: Readonly<Record<string, number>> | null;
  startingXp: number | null;
};

export type KqDeckPreparation = {
  /** Counts describe selected active cards, including selected copies missing from known stock. */
  copies: number;
  references: number;
  availableCopies: number | null;
  missingCopies: number | null;
  handCapacity: number;
  /** Selected opening-hand size; missing copies must be corrected before launch. */
  openingHandSize: number;
  beforeRollCopies: number;
  afterRollCopies: number;
  /** Cost only: stock-verified copies, or selected copies when stock is unknown. Not play permissions. */
  affordableCopies: number | null;
  expensiveCopies: number | null;
  /** Catalogue compatibility, not draw odds or guaranteed solutions across successive steps.
   * Missing/invalid known stock is excluded; unknown stock keeps the unverified selection. */
  coverage: {
    compatibleCount: number;
    total: number;
    byStage: Array<{ stage: KqStage; compatibleCount: number; total: number }>;
    uncoveredCodes: string[];
  };
};

/** Describe the selected deck without drawing a hand, choosing incidents or predicting dice. */
export function getKqDeckPreparation({ deckCodes, inventory, startingXp }: KqDeckPreparationInput): KqDeckPreparation {
  const selected = deckCodes.flatMap(code => {
    const card = KQ_ACTIVE_CARDS.find(card => card.code === code);
    return card && card.category !== "pbi" && card.category !== "substrate" && card.timing !== "passive" ? [card] : [];
  });
  const allocated = new Map<string, number>();
  const effective = inventory === null ? selected : selected.filter(card => {
    const stock = inventory[card.code];
    if (!Number.isSafeInteger(stock) || stock <= 0) return false;
    const copies = allocated.get(card.code) ?? 0;
    if (copies >= stock) return false;
    allocated.set(card.code, copies + 1);
    return true;
  });
  const unique = [...new Map(effective.map(card => [card.code, card])).values()];
  const compatible = new Set(KQ_SITUATIONS.filter(situation => unique.some(card => doesKqCardMatchSituation(card, situation))).map(situation => situation.code));
  const xpBudget = typeof startingXp === "number" && Number.isSafeInteger(startingXp) && startingXp >= 0 ? startingXp : null;
  const affordableCopies = xpBudget === null ? null : effective.filter(card => card.xpCost <= xpBudget).length;
  return {
    copies: selected.length,
    references: new Set(selected.map(card => card.code)).size,
    availableCopies: inventory === null ? null : effective.length,
    missingCopies: inventory === null ? null : selected.length - effective.length,
    handCapacity: KQ_HAND_SIZE,
    openingHandSize: Math.min(selected.length, KQ_HAND_SIZE),
    beforeRollCopies: selected.filter(card => card.timing === "before-roll").length,
    afterRollCopies: selected.filter(card => card.timing === "after-roll").length,
    affordableCopies,
    expensiveCopies: affordableCopies === null ? null : effective.length - affordableCopies,
    coverage: {
      compatibleCount: compatible.size,
      total: KQ_SITUATIONS.length,
      byStage: KQ_STAGES.map(stage => {
        const situations = KQ_SITUATIONS.filter(situation => situation.stage === stage);
        return { stage, compatibleCount: situations.filter(situation => compatible.has(situation.code)).length, total: situations.length };
      }),
      uncoveredCodes: KQ_SITUATIONS.filter(situation => !compatible.has(situation.code)).map(situation => situation.code),
    },
  };
}

export type KqPreparationStartingXpInput = {
  source: "official" | "local" | "tutorial";
  /** Official campaigns use the strongest participant. Local/tutorial launches use one Buddie. */
  buddieCodes: readonly string[];
  /** null is an intentional absence; undefined is an unresolved selected Heritage. */
  heritageCard: KqHeritageCard | null | undefined;
  /** Only official launches apply this profile; undefined there means unknown. */
  chanvrierStrength: ChanvrierStrength | null | undefined;
  cultureTokens?: number;
  /** The base actually passed to startKqGame for local/tutorial launches, before Buddie/Heritage. */
  localBaseXp?: number;
};

/** Mirror the explicit launch source. Unknown inputs never fall back to a free bonus or a default Buddie. */
export function getKqPreparationStartingXp(input: KqPreparationStartingXpInput): number | null {
  if (!input.buddieCodes.length || input.heritageCard === undefined) return null;
  const buddies = input.buddieCodes.map(code => KQ_BUDDIES.find(buddie => buddie.code === code));
  if (buddies.some(buddie => !buddie)) return null;
  if (input.heritageCard && !isKqHeritageEffect(input.heritageCard.effect)) return null;
  const heritageXp = input.heritageCard
    ? KQ_HERITAGE_STARTING_XP_BONUS + (input.heritageCard.effect === "starting-xp-two" ? 2 : 0) : 0;
  const advantage = Math.max(...buddies.map(buddie => buddie!.advantageLevel));
  let base: number;
  if (input.source === "official") {
    if (input.chanvrierStrength === undefined || input.chanvrierStrength !== null
      && !CHANVRIER_STRENGTHS.some(strength => strength.code === input.chanvrierStrength)) return null;
    const tokens = Math.floor(input.cultureTokens ?? 0);
    if (!Number.isSafeInteger(tokens) || tokens < 0 || tokens > KQ_CULTURE_TOKEN_RUN_CAP) return null;
    base = 1 + tokens * KQ_CULTURE_TOKEN_START_XP + getChanvrierStartingXp(input.chanvrierStrength);
  } else if (input.source === "local" || input.source === "tutorial") {
    if (buddies.length !== 1) return null;
    const requestedBase = input.localBaseXp ?? 1;
    if (!Number.isSafeInteger(requestedBase)) return null;
    base = Math.max(1, requestedBase);
  } else return null;
  const total = base + advantage + heritageXp;
  return Number.isSafeInteger(total) ? total : null;
}
