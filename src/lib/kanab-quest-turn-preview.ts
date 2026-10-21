import {
  getKqStageTarget, getKqStateHeritage, isKqCultureDead, previewKqResolution,
  resolveKqStage, type KqGameState,
} from "./kanab-quest-game";

/** Only the validation of the dice already visible. Never rolls, plays a card,
 * advances a stage, or returns hidden diagnoses and future situations. */
export function getKqTurnPreview(state: KqGameState) {
  if (state.phase !== "rolled" || !state.dice || isKqCultureDead(state)) return null;
  const dice = previewKqResolution(state);
  if (!dice) return null;
  const after = resolveKqStage(state);
  const stage = after.history.at(-1);
  if (!stage || after.history.length !== state.history.length + 1) return null;
  const heritage = getKqStateHeritage(state);
  return {
    outcome: stage.outcome,
    diceOutcome: dice.outcome,
    dangerBlocksSuccess: dice.total >= dice.target && dice.dangers > 0 && dice.outcome === "fragile",
    dangers: dice.dangers,
    dead: isKqCultureDead(after),
    rescued: stage.rescued === true,
    health: state.care && after.care ? { before: state.care.vitality, after: after.care.vitality } : null,
    qualityDelta: after.quality - state.quality,
    xpGain: after.xp - state.xp,
    xpAfter: after.xp,
    pressure: { before: state.pressure, after: after.pressure },
    heritage: heritage && !state.heritageUsed && after.heritageUsed
      ? { name: heritage.name, changesOutcome: stage.outcome !== dice.outcome } : null,
  };
}

export type KqTurnPreview = NonNullable<ReturnType<typeof getKqTurnPreview>>;

/** The engine caps difficulty at three and may apply other target modifiers. */
export function getKqPressureHint(state: KqGameState) {
  if (state.pressure < 3) return "Culture stable · tension à partir de 3";
  const target = getKqStageTarget(state);
  return `Sous tension · ${target} réussite${target > 1 ? "s" : ""} requise${target > 1 ? "s" : ""}${target === 3 ? " (plafond)" : ""}`;
}
