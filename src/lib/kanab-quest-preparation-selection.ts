import { sanitizeKqDeckSelection } from "./kanab-quest-economy";

export type KqPreparationSelection = { deckCodes: string[]; heritageCode: string | null };

/** Missing or malformed ownership is unknown, never an empty collection. */
export function getKqVerifiedPreparationHeritages(cards: unknown): string[] | null {
  if (!Array.isArray(cards)) return null;
  const seen = new Set<string>();
  const owned: string[] = [];
  for (const card of cards) {
    if (!card || typeof card !== "object" || typeof card.code !== "string" || !card.code
      || seen.has(card.code) || typeof card.isActive !== "boolean"
      || !Number.isSafeInteger(card.ownedCopies) || card.ownedCopies < 0) return null;
    seen.add(card.code);
    if (card.isActive && card.ownedCopies > 0) owned.push(card.code);
  }
  return owned;
}

/** Reconcile choices only against confirmed ownership; never add a card. */
export function reconcileKqPreparationSelection(
  preparation: KqPreparationSelection,
  inventory: Record<string, number> | null,
  ownedHeritageCodes: readonly string[] | null,
) {
  const verifiedInventory = inventory !== null && Object.values(inventory).every(count => Number.isSafeInteger(count) && count >= 0);
  const deckCodes = verifiedInventory ? sanitizeKqDeckSelection(preparation.deckCodes, inventory) : [...preparation.deckCodes];
  const removedHeritage = preparation.heritageCode !== null && ownedHeritageCodes !== null
    && !ownedHeritageCodes.includes(preparation.heritageCode);
  return {
    selection: { deckCodes, heritageCode: removedHeritage ? null : preparation.heritageCode },
    removedCopies: preparation.deckCodes.length - deckCodes.length,
    removedHeritage,
  };
}
