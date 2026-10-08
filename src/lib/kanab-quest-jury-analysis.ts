import { getKqJuryScoringCriteria, KQ_JURY_SCORING, type KqBattleRound, type KqFlowerStat } from "./kanab-quest-battle";

type JuryRound = Pick<KqBattleRound, "code" | "label" | "playerScore" | "opponentScore" | "winner">;
type FlowerStats = Partial<Record<KqFlowerStat, number>>;
export type KqJuryAnalysisInput = {
  rounds: readonly JuryRound[];
  playerStats?: FlowerStats | null;
  opponentStats?: FlowerStats | null;
};
export type KqJuryCriterionAnalysis = {
  stat: KqFlowerStat;
  label: string;
  weightPercent: number;
  playerValue: number | null;
  opponentValue: number | null;
  weightedGap: number | null;
};
export type KqJuryRecommendation = { stat: KqFlowerStat; title: string; explanation: string };
export type KqJuryAnalysis = {
  title: string;
  summary: string;
  wins: number;
  focus: { code: string; label: string; margin: number; tied: boolean; reason: string; criteria: KqJuryCriterionAnalysis[] };
  facts: string[];
  recommendations: KqJuryRecommendation[];
  limits: string[];
};

const LABELS: Record<KqFlowerStat, string> = { appearance: "Apparence", aroma: "Arômes", vigor: "Vigueur", mastery: "Maîtrise", regularity: "Régularité" };
// These links follow createKqFlower, not a guessed association between scenario
// names and culture stages. They explain levers, never a player's missing history.
const LEVERS: Record<KqFlowerStat, Omit<KqJuryRecommendation, "stat">> = {
  appearance: {
    title: "Préparer la Récolte",
    explanation: "Le résultat de l’étape Récolte entre directement dans l’Apparence, avec la Qualité finale et les échecs du parcours. À cette étape, regarde l’aperçu du résultat et les cartes utilisables avant de valider.",
  },
  aroma: {
    title: "Soigner les trois dernières étapes",
    explanation: "Floraison, Récolte et Séchage & affinage entrent directement dans les Arômes, avec la Qualité finale. Garde des options adaptées aux situations de fin de culture et compare leur effet dans l’aperçu du résultat.",
  },
  vigor: {
    title: "Consolider le début de culture",
    explanation: "Germination, Enracinement et Croissance entrent directement dans la Vigueur, avec la Qualité finale. Sur ces étapes, regarde ce qu’il manque pour réussir et les cartes utilisables avant de valider.",
  },
  mastery: {
    title: "Viser des étapes réussies",
    explanation: "Les réussites et réussites critiques renforcent la Maîtrise ; les échecs la diminuent. Les cartes jouées hors substrat entrent aussi dans ce calcul : choisis une carte pour son utilité dans la situation, sans la dépenser uniquement pour ce critère.",
  },
  regularity: {
    title: "Limiter les étapes en échec",
    explanation: "Les réussites renforcent la Régularité, les échecs la diminuent. Elle tient aussi compte du bonus de régularité du matériel retenu au début de la culture. Consulte ces effets dans la préparation et l’aperçu du résultat.",
  },
};
const rounded = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
const points = (value: number) => `${number(value)} point${Math.abs(value) > 1 ? "s" : ""}`;
function readStat(stats: FlowerStats | null | undefined, stat: KqFlowerStat) {
  const value = stats?.[stat];
  // createKqFlower/createKqOpponent clamp each stored statistic to this interval.
  return typeof value === "number" && Number.isFinite(value) && value >= 35 && value <= 99 ? value : null;
}

/** Explain only a completed verdict. Absolute scores across different criteria
 * are never used to rank weaknesses; the priority is the closest lost round. */
export function getKqJuryAnalysis({ rounds, playerStats, opponentStats }: KqJuryAnalysisInput): KqJuryAnalysis | null {
  if (!Array.isArray(rounds) || rounds.length !== 3 || rounds.some(round => !round.code || !round.label || !Number.isFinite(round.playerScore) || !Number.isFinite(round.opponentScore) || !["player", "opponent"].includes(round.winner)
    || (round.playerScore !== round.opponentScore && round.winner !== (round.playerScore > round.opponentScore ? "player" : "opponent")))) return null;
  const losses = rounds.filter(round => round.winner === "opponent");
  const candidates = losses.length ? losses : rounds;
  const focus = candidates.reduce((best, round) => Math.abs(round.playerScore - round.opponentScore) < Math.abs(best.playerScore - best.opponentScore) ? round : best);
  const margin = rounded(focus.playerScore - focus.opponentScore);
  const tied = focus.playerScore === focus.opponentScore;
  const definitions = getKqJuryScoringCriteria(focus.code);
  const criteria: KqJuryCriterionAnalysis[] = (definitions ?? []).map(({ stat, weight }) => {
    const playerValue = readStat(playerStats, stat), opponentValue = readStat(opponentStats, stat);
    return { stat, label: LABELS[stat], weightPercent: weight * 100, playerValue, opponentValue,
      weightedGap: playerValue !== null && opponentValue !== null ? rounded((playerValue - opponentValue) * weight) : null };
  });
  const facts = [`${focus.label} : ${number(focus.playerScore)} pour ta Fleur, ${number(focus.opponentScore)} pour l’adversaire.`];
  const limits: string[] = [];
  const recommendations: KqJuryRecommendation[] = [];
  let reason = "";
  if (tied) facts.push(`Les notes sont à égalité. Le départage du jury a attribué cette manche ${focus.winner === "player" ? "à ta Fleur" : "à l’adversaire"}.`);
  else facts.push(`Sur cette manche, ta Fleur termine ${margin > 0 ? "devant" : "derrière"} de ${points(Math.abs(margin))}.`);

  if (!definitions) {
    reason = "Le barème de cette ancienne manche n’est pas disponible. Les scores seuls ne permettent pas d’attribuer cet écart à un critère ou à une étape de culture.";
    limits.push(reason);
  } else {
    facts.push(`Cette manche compte ${criteria.map(criterion => `${number(criterion.weightPercent)} % de ${criterion.label}`).join(" et ")}.`);
    const completeStats = criteria.every(criterion => criterion.playerValue !== null && criterion.opponentValue !== null);
    const playerBase = criteria.reduce((total, criterion, index) => total + (criterion.playerValue ?? 0) * definitions[index].weight, 0);
    const opponentBase = criteria.reduce((total, criterion, index) => total + (criterion.opponentValue ?? 0) * definitions[index].weight, 0);
    const fitsScore = (base: number, score: number) => {
      for (let adjustment = KQ_JURY_SCORING.adjustmentMin; adjustment <= KQ_JURY_SCORING.adjustmentMax; adjustment++) {
        if (Math.abs(Math.round((base + adjustment) * 10) / 10 - score) < 1e-9) return true;
      }
      return false;
    };
    const compatibleStats = completeStats && fitsScore(playerBase, focus.playerScore) && fitsScore(opponentBase, focus.opponentScore);
    if (compatibleStats) {
      facts.push(`Avant la variation du jury et l’arrondi, ces critères donnent ${number(rounded(playerBase))} à ta Fleur et ${number(rounded(opponentBase))} à l’adversaire.`);
      const deficit = criteria.filter(criterion => criterion.weightedGap! < 0).sort((left, right) => left.weightedGap! - right.weightedGap!)[0];
      if (deficit) facts.push(`${deficit.label} apporte ${points(Math.abs(deficit.weightedGap!))} de retard dans cet écart avant la variation du jury.`);
      else if (focus.winner === "opponent") facts.push("Tes critères ne sont pas inférieurs à ceux de l’adversaire sur cette manche. La variation du jury ou le départage a fait la différence dans le verdict.");
      const lead = criteria.filter(criterion => criterion.weightedGap! > 0).sort((left, right) => right.weightedGap! - left.weightedGap!)[0];
      reason = tied
        ? `Cette manche s’est jouée au départage du jury : les notes égales ne montrent aucun déficit de note, et le verdict l’attribue ${focus.winner === "player" ? "à ta Fleur" : "à l’adversaire"}.`
        : deficit
          ? `Le critère ${deficit.label} (${number(deficit.weightPercent)} %) est le plus favorable à l’adversaire : ${number(deficit.playerValue!)} contre ${number(deficit.opponentValue!)}, soit un écart pondéré de ${points(Math.abs(deficit.weightedGap!))} avant la variation du jury.`
          : focus.winner === "opponent"
            ? "La variation du jury fait la différence malgré tes deux critères au moins au niveau de ceux de l’adversaire. Ces statistiques ne montrent pas de retard à corriger."
            : lead
              ? `${lead.label} (${number(lead.weightPercent)} %) apporte ${points(lead.weightedGap!)} à ton avantage avant la variation du jury : ${number(lead.playerValue!)} contre ${number(lead.opponentValue!)}.`
              : "Les deux critères sont identiques pour les deux Fleurs. La variation du jury explique l’écart de note de cette manche.";
      const target = deficit ?? criteria[0];
      recommendations.push({ stat: target.stat, ...LEVERS[target.stat] });
    } else {
      // Without the matching two flower snapshots, a score is not evidence of
      // which statistic caused the result. Keep the advice explicitly general.
      for (const criterion of criteria) criterion.weightedGap = null;
      reason = completeStats
        ? "Les statistiques fournies ne reconstituent pas ces notes avec le barème actuel. Aucun écart n’est attribué à une étape de ta culture."
        : "Les statistiques complètes des deux Fleurs ne sont pas disponibles pour ce verdict. Impossible d’identifier un critère responsable de l’écart.";
      limits.push(reason);
      const target = criteria[0];
      recommendations.push({ stat: target.stat, title: `Repère pour la prochaine culture : ${target.label}`, explanation: LEVERS[target.stat].explanation });
    }
    limits.push("La variation du jury et l’arrondi s’ajoutent aux critères. Les statistiques de la Fleur sont bornées entre 35 et 99 : un levier déjà au plafond peut ne plus les augmenter.");
  }
  limits.push("Ce bilan ne connaît pas les décisions de la culture à l’origine de cette Fleur. Ces leviers décrivent les règles du jeu, sans garantir la victoire au prochain jury.");
  facts.push(losses.length ? tied ? "Une manche perdue à égalité sert de point de repère." : "Cette manche a le plus petit écart de score parmi les manches perdues." : "Cette manche a le plus petit écart de score parmi tes manches gagnées.");
  const wins = rounds.filter(round => round.winner === "player").length;
  return {
    title: `${tied ? "À comprendre" : losses.length ? "À travailler" : "À consolider"} : ${focus.label}`,
    summary: `${number(focus.playerScore)} contre ${number(focus.opponentScore)} sur ${focus.label} : ${tied ? "notes à égalité." : `${points(Math.abs(margin))} ${margin > 0 ? "d’avance" : "de retard"} pour ta Fleur.`}`,
    wins,
    focus: { code: focus.code, label: focus.label, margin, tied,
      reason, criteria },
    facts, recommendations, limits,
  };
}
