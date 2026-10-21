import {
  canPlayKqCard, isKqCultureDead, KQ_CARDS, playKqCard,
  type KqGameState, type KqOutcome, type KqSupportCard, type KqSupportEffect,
} from "./kanab-quest-game";
import { getKqTurnPreview, type KqTurnPreview } from "./kanab-quest-turn-preview";

/** Deliberately closed: new effects must be reviewed before they can be simulated.
 * Neither seeded rerolls nor preparation effects belong in this list. */
const DETERMINISTIC_REACTIONS: ReadonlySet<KqSupportEffect> = new Set([
  "pbi-success", "pbi-strong-success", "pbi-neutral-strong", "pbi-success-xp",
  "pbi-mite-shield", "pbi-thrips-relief", "timer-reset", "cross-diagnosis",
  "water-rescue", "illegal-power", "moisture-calibration", "danger-to-neutral",
  "gentle-recovery", "expert-recovery", "emergency-adjustment", "harvest-team",
  "controlled-drying",
]);

export type KqCardPlayResult = {
  dice: [number, number, number];
  outcome: KqOutcome;
  /** Health, quality and pressure at the current stage's validation, not harvest. */
  health: number | null;
  quality: number;
  /** Change relative to the original position, including the card and validation. */
  qualityDelta: number;
  xpAfterPlay: number;
  xpAfterValidation: number;
  pressure: number;
  dangers: number;
  dead: boolean;
  rescued: boolean;
  heritage: KqTurnPreview["heritage"];
};

export type KqCardPlayPreview =
  | { kind: "preparation" | "random"; description: string }
  | { kind: "deterministic"; before: KqCardPlayResult; after: KqCardPlayResult };

function result(state: KqGameState, preview: KqTurnPreview, initialQuality: number): KqCardPlayResult {
  const quality = state.quality + preview.qualityDelta;
  return {
    dice: [...state.dice!],
    outcome: preview.outcome,
    health: preview.health?.after ?? null,
    quality,
    qualityDelta: quality - initialQuality,
    xpAfterPlay: state.xp,
    xpAfterValidation: preview.xpAfter,
    pressure: preview.pressure.after,
    dangers: preview.dangers,
    dead: preview.dead,
    rescued: preview.rescued,
    heritage: preview.heritage,
  };
}

/** A conditional comparison of the visible dice only. Never changes the input,
 * advances the stage, exposes diagnoses or evaluates any future random draw.
 * `copies` is the currently available inventory count, not the deck size. */
export function getKqCardPlayPreview(
  state: KqGameState,
  card: KqSupportCard,
  copies: number,
): KqCardPlayPreview | null {
  if (!Number.isSafeInteger(copies) || copies <= 0 || isKqCultureDead(state)) return null;
  // Match the authoritative definition used by playKqCard, even if a caller's
  // cached card object still has an old timing, effect or cost.
  const definition = KQ_CARDS.find(candidate => candidate.code === card.code);
  if (!definition || !canPlayKqCard(state, definition).allowed) return null;
  if (definition.timing === "before-roll") {
    return { kind: "preparation", description: definition.description };
  }
  if (state.phase !== "rolled" || !state.dice) return null;
  if (!DETERMINISTIC_REACTIONS.has(definition.effect)) {
    return {
      kind: "random",
      description: ["reroll-two-low", "thermal-check"].includes(definition.effect)
        ? "Relance des dés : le résultat sera connu après avoir joué la carte."
        : "L’effet de cette carte ne peut pas être prévisualisé.",
    };
  }
  const before = getKqTurnPreview(state);
  if (!before) return null;
  const played = playKqCard(state, definition.code);
  if (played === state) return null;
  const after = getKqTurnPreview(played);
  if (!after) return null;
  return {
    kind: "deterministic",
    before: result(state, before, state.quality),
    after: result(played, after, state.quality),
  };
}
