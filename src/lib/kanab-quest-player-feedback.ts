import type { KqBattleRound } from "./kanab-quest-battle";
import { canPlayKqCard, getKqVisibleActionCards, type KqGameState, type KqSupportCard } from "./kanab-quest-game";

/** Uses the same stock check as the card confirmation, including the PBI reserve. */
export function getKqPlayerCardPermission(state: KqGameState, card: KqSupportCard, copies: number) {
  const permission = canPlayKqCard(state, card);
  if (!permission.allowed) return permission;
  return copies > 0 ? permission : { allowed: false, reason: "Aucune copie restante." };
}

export function getKqPlayerCardChoices(state: KqGameState, inventory: Record<string, number>) {
  const choices = getKqVisibleActionCards(state).map(card => ({
    card, ...getKqPlayerCardPermission(state, card, inventory[card.code] ?? 0),
  })).sort((left, right) => Number(right.allowed) - Number(left.allowed));
  const playableCount = choices.filter(choice => choice.allowed).length;
  const noun = state.phase === "rolled" ? "réaction" : "préparation";
  const label = state.phase === "resolved" || state.phase === "complete" ? "Étape terminée"
    : playableCount ? `${playableCount} ${noun}${playableCount > 1 ? "s" : ""} disponible${playableCount > 1 ? "s" : ""}`
      : `Aucune ${noun} jouable`;
  const explanation = state.phase === "resolved" || state.phase === "complete"
    ? "Les cartes restent consultables. Les prochains choix apparaîtront à l’étape suivante."
    : playableCount
      ? "Les choix jouables avec tes XP et ton stock sont en premier. Tu peux aussi conserver tes cartes."
      : "Aucune carte ne peut être jouée dans ta situation actuelle. Chaque carte indique ce qui la bloque.";
  return { choices, playableCount, label, explanation };
}

type JuryRound = Pick<KqBattleRound, "code" | "label" | "playerScore" | "opponentScore" | "winner">;
const roundTenth = (value: number) => Math.round(value * 10) / 10;

/** A verdict is compared only with itself: partial history cannot prove a record. */
export function getKqPersonalJurySummary(rounds: readonly JuryRound[]) {
  if (rounds.length !== 3 || rounds.some(round => !Number.isFinite(round.playerScore) || !Number.isFinite(round.opponentScore))) return null;
  const high = Math.max(...rounds.map(round => round.playerScore));
  const low = Math.min(...rounds.map(round => round.playerScore));
  const closest = rounds.reduce((best, round) => Math.abs(round.playerScore - round.opponentScore) < Math.abs(best.playerScore - best.opponentScore) ? round : best);
  return {
    strongest: rounds.filter(round => round.playerScore === high),
    weakest: rounds.filter(round => round.playerScore === low),
    even: high === low,
    closest,
    margin: roundTenth(closest.playerScore - closest.opponentScore),
    wins: rounds.filter(round => round.winner === "player").length,
  };
}

export function getKqPersonalCultureSummary(state: KqGameState) {
  if (state.phase !== "complete" || state.history.length === 0) return null;
  const weight = { failure: 0, fragile: 1, success: 2, critical: 3 };
  const weakest = state.history.reduce((lowest, stage) => weight[stage.outcome] < weight[lowest.outcome] ? stage : lowest);
  return {
    stages: state.history.length,
    successful: state.history.filter(stage => stage.outcome === "success" || stage.outcome === "critical").length,
    critical: state.history.filter(stage => stage.outcome === "critical").length,
    zero: state.history.filter(stage => stage.total === 0).length,
    weakest: weakest.outcome === "failure" || weakest.outcome === "fragile" ? weakest : null,
  };
}
