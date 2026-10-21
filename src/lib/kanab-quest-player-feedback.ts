import type { KqBattleRound } from "./kanab-quest-battle";
import { canPlayKqCard, doesKqCardMatchSituation, getKqSituation, getKqVisibleActionCards, type KqGameState, type KqSupportCard } from "./kanab-quest-game";
import { getKqTurnPreview } from "./kanab-quest-turn-preview";

/** Uses the same stock check as the card confirmation, including the PBI reserve. */
export function getKqPlayerCardPermission(state: KqGameState, card: KqSupportCard, copies: number) {
  const permission = canPlayKqCard(state, card);
  if (state.phase === "resolved" || state.phase === "complete") return permission;
  if (!(copies > 0)) return { allowed: false, reason: "Aucune copie restante." };
  if (!permission.allowed && permission.reason === `Il faut ${card.xpCost} XP.`) {
    const withEnoughXp = canPlayKqCard({ ...state, xp: card.xpCost }, card);
    if (!withEnoughXp.allowed) return withEnoughXp;
  }
  return permission;
}

function hasRunCopy(state: KqGameState, card: KqSupportCard) {
  // Historical PBI can come from the collection, outside the prepared deck.
  if (card.category === "pbi" && state.revealedPest !== null && state.collectionCodes.includes(card.code)) return true;
  return state.deckCodes.filter(code => code === card.code).length > state.usedCards.filter(code => code === card.code).length;
}

function getNoCardNextStep(state: KqGameState, explainXp = false) {
  if (state.phase === "prepare") return "Tu peux lancer les dés sans jouer de carte.";
  const preview = getKqTurnPreview(state);
  if (preview?.dead) return "En validant ce résultat, la culture serait perdue sans récolte.";
  const warning = preview?.rescued
    ? "En validant ce résultat, ton secours de première culture serait utilisé. "
    : preview?.dangerBlocksSuccess ? "Un Danger maintient ce résultat fragile. " : "";
  if (explainXp && preview) {
    return warning + (preview.xpGain > 0
      ? `En validant ce résultat, tu gagnerais ${preview.xpGain} XP (${preview.xpAfter} XP au total).`
      : "Valider ce résultat ne rapporte pas d’XP.");
  }
  return warning + "Consulte le bilan avant de valider.";
}

function getUnavailableCardExplanation(state: KqGameState, cards: KqSupportCard[], inventory: Record<string, number>) {
  const nextStep = (reason: string, explainXp = false) => `${reason} ${getNoCardNextStep(state, explainXp)}`;
  if (state.phase === "prepare" && state.preparationPlayed) return nextStep("Ta préparation est déjà jouée pour cette étape.");
  if (state.phase === "rolled" && state.reactionPlayed) return nextStep("Ta réaction est déjà jouée pour cette étape.");

  const remaining = cards.filter(card => (inventory[card.code] ?? 0) > 0 && hasRunCopy(state, card));
  // XP is the sole blocker only if the actual engine allows the same card with
  // sufficient XP. In particular, its earlier XP check can hide wrong timing,
  // an incompatible incident, a spent epic or unsuitable dice.
  const xpOnly = remaining.filter(card => state.xp < card.xpCost
    && canPlayKqCard({ ...state, xp: card.xpCost }, card).allowed);
  if (xpOnly.length) {
    const missingXp = Math.min(...xpOnly.map(card => card.xpCost - state.xp));
    return nextStep(`Il te manque ${missingXp} XP pour jouer au moins une carte adaptée maintenant.`, true);
  }

  if (remaining.length === 0) {
    const deckCards = getKqVisibleActionCards({ ...state, handCodes: state.deckCodes });
    if (deckCards.length === 0) return nextStep("Ce deck ne contient aucune carte d’action disponible.");
    if (deckCards.every(card => !hasRunCopy(state, card))) return nextStep("Toutes les cartes d’action de ce deck ont déjà été utilisées.");
    if (cards.length === 0) return nextStep("Aucune carte d’action dans cette main.");
    if (cards.every(card => (inventory[card.code] ?? 0) <= 0)) return nextStep("Tu n’as plus de copie en stock des cartes de cette main.");
    return nextStep("Les copies de cette main sont épuisées ou déjà utilisées.");
  }

  const currentTiming = state.phase === "prepare" ? "before-roll" : "after-roll";
  const currentCards = remaining.filter(card => card.timing === currentTiming);
  if (currentCards.length === 0) return nextStep(state.phase === "prepare"
    ? "Les cartes restantes se jouent après les dés, si leurs conditions sont réunies."
    : "Les cartes restantes se jouent avant les dés.");
  const situation = getKqSituation(state);
  if (situation && currentCards.every(card => !doesKqCardMatchSituation(card, situation))) return nextStep(state.phase === "prepare"
    ? "Tes préparations restantes ne répondent pas à cet incident."
    : "Tes réactions restantes ne répondent pas à cet incident.");
  return nextStep("Les conditions des cartes restantes ne sont pas réunies. Chaque carte indique ce qui la bloque.");
}

export function getKqPlayerCardChoices(state: KqGameState, inventory: Record<string, number>) {
  const choices = getKqVisibleActionCards(state).map(card => ({
    card, ...getKqPlayerCardPermission(state, card, inventory[card.code] ?? 0),
  })).sort((left, right) => Number(right.allowed) - Number(left.allowed));
  const playableCount = choices.filter(choice => choice.allowed).length;
  const label = state.phase === "resolved" || state.phase === "complete" ? "Étape terminée"
    : playableCount ? `${playableCount} carte${playableCount > 1 ? "s" : ""} jouable${playableCount > 1 ? "s" : ""}`
      : "Aucune carte jouable";
  const explanation = state.phase === "resolved" || state.phase === "complete"
    ? "Les cartes restent consultables. Les prochains choix apparaîtront à l’étape suivante."
    : playableCount
      ? "Les choix jouables avec tes XP et ton stock sont en premier. Tu peux aussi conserver tes cartes."
      : getUnavailableCardExplanation(state, choices.map(choice => choice.card), inventory);
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
