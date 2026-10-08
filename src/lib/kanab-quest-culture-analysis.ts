import {
  canPlayKqCard, getKqCardTradeoff, getKqSituation, getKqStageTarget,
  getKqStateHeritage, KQ_CARDS, KQ_RETIRED_SUBSTRATE_CODES, KQ_STAGES,
  playKqCard, previewKqResolution, resolveKqStage,
  type KqGameState, type KqOutcome, type KqStageDecision, type KqSupportCard,
} from "./kanab-quest-game";

type Receipt = KqGameState["history"][number];
export type KqCultureStageAnalysis = {
  index: number;
  stage: string;
  situation: string;
  outcome: KqOutcome;
  dice: [number, number, number];
  total: number;
  target: number;
  qualityDelta: number | null;
  xpGain: number | null;
  pressureBefore: number | null;
  pressureAfter: number | null;
  harvestLossPercent: number | null;
  rescued: boolean;
  playedCards: { code: string; name: string; xpCost: number }[];
  evidence: string[];
  detailed: boolean;
};

export type KqCultureCardResult = {
  dice: [number, number, number];
  total: number;
  target: number;
  outcome: KqOutcome;
  qualityDelta: number;
  xpGain: number;
  pressureAfter: number;
  harvestLossPercent: number;
  cultureDead: boolean;
};

export type KqCultureCardAdvice = {
  code: string;
  name: string;
  stageIndex: number;
  stage: string;
  timing: "before-roll" | "after-roll";
  xpCost: number;
  condition: string;
  effect: string;
  availability: string;
  basis: "verified-position" | "next-run";
  exactEffect?: { before: KqCultureCardResult; after: KqCultureCardResult; xpBalanceDelta: number };
};

export type KqCultureAnalysis = {
  headline: string;
  evidence: string[];
  advice: KqCultureCardAdvice[];
  stages: KqCultureStageAnalysis[];
  coverage: "detailed" | "partial" | "legacy";
};

const OUTCOME: Record<KqOutcome, string> = { critical: "Critique", success: "Réussite", fragile: "Fragile", failure: "Échec" };
const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const knownCodes = new Set<string>([...KQ_CARDS.map(card => card.code), ...KQ_RETIRED_SUBSTRATE_CODES]);
const codes = (value: unknown, limit: number) => Array.isArray(value) && value.length <= limit && value.every(code => typeof code === "string" && knownCodes.has(code));

/** Shared by persistence and analysis. Invalid optional metadata never grants a move. */
export function isKqStageDecision(value: unknown): value is KqStageDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const d = value as Record<string, unknown>;
  return Object.keys(d).length === 17 && d.version === 1
    && integer(d.xp, 0, 10000) && integer(d.quality, -100, 10000)
    && integer(d.pressure, 0, 4) && integer(d.cancelledDangers, 0, 10)
    && integer(d.rollNonce, 0, 10000) && integer(d.harvestLossPercent, 0, 80)
    && (d.bonusDie === null || integer(d.bonusDie, 1, 6))
    && (d.revealedPest === null || ["aphids", "mites", "thrips"].includes(String(d.revealedPest)))
    && codes(d.handCodes, 10) && codes(d.usedCards, 32) && codes(d.playedThisStage, 4)
    && ["preparationPlayed", "reactionPlayed", "heritageUsed", "heritageArmed", "powerOutage"].every(key => typeof d[key] === "boolean");
}

function resultOf(state: KqGameState): KqCultureCardResult {
  const entry = state.history.at(-1)!;
  return {
    dice: [...entry.dice], total: entry.total, target: entry.target, outcome: entry.outcome,
    qualityDelta: entry.qualityDelta!, xpGain: entry.xpGain!, pressureAfter: entry.pressureAfter!,
    harvestLossPercent: entry.harvestLossPercent!, cultureDead: state.cultureDead === true,
  };
}

/** No dice are rolled here. Refuse a snapshot whose fixed validation no longer matches. */
function restoreDecision(state: KqGameState, index: number): KqGameState | null {
  const entry = state.history[index];
  if (!entry || !isKqStageDecision(entry.decision) || entry.stage !== KQ_STAGES[index]) return null;
  if (!Array.isArray(entry.dice) || entry.dice.length !== 3 || !entry.dice.every(die => integer(die, 1, 6))) return null;
  const { version: _version, ...decision } = entry.decision;
  void _version;
  const history = state.history.slice(0, index);
  const position: KqGameState = {
    ...state, ...decision,
    stageIndex: index, phase: "rolled", dice: [...entry.dice], history,
    traits: history.map(item => item.trait), combos: history.flatMap(item => item.combos ?? []),
    cultureDead: false, harvestGrams: undefined, equipmentQualityBonus: undefined,
    // Only terminal date generation is neutralized; never the game's random generator.
    completedAt: "2000-01-01T00:00:00.000Z", effectNotices: [], lastOutcome: null,
  };
  try {
    const computed = resolveKqStage(position).history.at(-1)!;
    const fields = ["stage", "situation", "total", "target", "outcome", "trait", "qualityDelta", "xpGain", "pressureAfter", "dangers", "sparks", "harvestLossPercent"] as const;
    if (fields.some(field => computed[field] !== entry[field])) return null;
    if ((computed.rescued === true) !== (entry.rescued === true)
      || JSON.stringify(computed.combos) !== JSON.stringify(entry.combos)) return null;
    return position;
  } catch {
    return null;
  }
}

function describeStage(entry: Receipt, index: number, position: KqGameState | null): KqCultureStageAnalysis {
  const evidence: string[] = [
    `Dés validés : ${entry.dice.join(" · ")}. ${entry.total} réussite${entry.total === 1 ? "" : "s"} pour un seuil de ${entry.target}.`,
  ];
  if (entry.qualityDelta !== undefined) evidence.push(`${OUTCOME[entry.outcome]} : ${signed(entry.qualityDelta)} Qualité${entry.xpGain !== undefined ? ` et +${entry.xpGain} XP à la validation` : ""}.`);
  if ((entry.harvestLossPercent ?? 0) > 0) evidence.push(`Le vol a retiré ${entry.harvestLossPercent} points de pourcentage au rendement final.`);
  if (entry.rescued) evidence.push("Le secours a évité une mort de culture ; l’échec, les dés et les gains sont restés identiques.");
  if (position) {
    const preview = previewKqResolution(position)!;
    const heritage = getKqStateHeritage(position);
    if (preview.outcome !== entry.outcome) evidence.push(`${heritage?.name ?? "L’Hérédité"} a transformé ${OUTCOME[preview.outcome]} en ${OUTCOME[entry.outcome]}.`);
    if (position.pressure >= 3) {
      const calmTarget = getKqStageTarget({ ...position, pressure: 2 });
      if (entry.target > calmTarget) evidence.push(`À ${position.pressure} Pression, le seuil est passé de ${calmTarget} à ${entry.target} réussites.`);
    }
    if (preview.dangers > 0) {
      const withoutDangers = resolveKqStage({ ...position, cancelledDangers: 3 }).history.at(-1)!;
      evidence.push(`${preview.dangers} Danger${preview.dangers > 1 ? "s" : ""} non protégé${preview.dangers > 1 ? "s" : ""}${withoutDangers.outcome !== entry.outcome ? ` : sans ces Dangers, le même nombre de réussites donnait ${OUTCOME[withoutDangers.outcome]}` : " à la validation"}.`);
    }
    const shielded = Math.min(position.cancelledDangers, entry.dice.filter(die => die === 1).length);
    if (shielded > 0) evidence.push(`${shielded} Danger${shielded > 1 ? "s" : ""} neutralisé${shielded > 1 ? "s" : ""} par les protections ; aucun dé supplémentaire n’est devenu une réussite.`);
    // Removing only a validation bonus does not undo or claim the preceding random roll.
    const resolutionBonusEffects = new Set(["patient-curing", "harvest-four-quality", "clean-cut", "pbi-success-xp"]);
    for (const code of position.playedThisStage) {
      const card = KQ_CARDS.find(item => item.code === code);
      if (!card || !resolutionBonusEffects.has(card.effect)) continue;
      const withoutBonus = resolveKqStage({ ...position, playedThisStage: position.playedThisStage.filter(item => item !== code) }).history.at(-1)!;
      const quality = (entry.qualityDelta ?? 0) - (withoutBonus.qualityDelta ?? 0);
      const xp = (entry.xpGain ?? 0) - (withoutBonus.xpGain ?? 0);
      if (quality > 0 || xp > 0) evidence.push(`${card.name} a ajouté ${[quality > 0 ? `+${quality} Qualité` : "", xp > 0 ? `+${xp} XP` : ""].filter(Boolean).join(" et ")} à la validation, sur ces dés.`);
    }
    if (position.reactionPlayed) evidence.push("Une réaction avait déjà été utilisée : aucune seconde réaction n’était permise.");
  } else {
    evidence.push("La main, les XP disponibles et les actions avant validation ne sont pas vérifiables pour cette étape.");
  }
  return {
    index, stage: entry.stage, situation: entry.situation, outcome: entry.outcome, dice: [...entry.dice],
    total: entry.total, target: entry.target, qualityDelta: entry.qualityDelta ?? null,
    xpGain: entry.xpGain ?? null, pressureBefore: position?.pressure ?? null,
    pressureAfter: entry.pressureAfter ?? null, harvestLossPercent: entry.harvestLossPercent ?? null,
    rescued: entry.rescued === true, detailed: position !== null, evidence,
    playedCards: position?.playedThisStage.flatMap(code => {
      const card = KQ_CARDS.find(item => item.code === code);
      return card ? [{ code, name: card.name, xpCost: card.xpCost }] : [];
    }) ?? [],
  };
}

const FIXED_REACTIONS = new Set([
  "water-rescue", "pbi-mite-shield", "pbi-neutral-strong", "pbi-success", "pbi-success-xp",
  "pbi-thrips-relief", "pbi-strong-success", "three-to-success", "moisture-calibration",
  "danger-to-neutral", "timer-reset", "cross-diagnosis", "illegal-power",
]);

function verifiedAdvice(position: KqGameState, index: number): { advice: KqCultureCardAdvice; score: number }[] {
  const baseline = resolveKqStage(position);
  const before = resultOf(baseline);
  return KQ_CARDS.flatMap(card => {
    if (card.timing !== "after-roll" || !FIXED_REACTIONS.has(card.effect) || !canPlayKqCard(position, card).allowed) return [];
    const changed = resolveKqStage(playKqCard(position, card.code));
    const after = resultOf(changed);
    const xpBalanceDelta = changed.xp - baseline.xp;
    const score = (Number(before.cultureDead) - Number(after.cultureDead)) * 100
      + (after.qualityDelta - before.qualityDelta) * 10
      + before.harvestLossPercent - after.harvestLossPercent
      + before.pressureAfter - after.pressureAfter + xpBalanceDelta;
    if (score <= 0) return [];
    const pressure = before.pressureAfter === after.pressureAfter
      ? `Pression finale inchangée à ${after.pressureAfter}.`
      : `Pression finale : ${before.pressureAfter} → ${after.pressureAfter}.`;
    const availability = `${card.category === "pbi" ? "Réserve PBI et cible identifiée" : "Carte en main"}, ${position.xp} XP et réaction libre enregistrés. Une copie en stock restait nécessaire ; ce stock n’a pas été enregistré.`;
    return [{
      score,
      advice: {
        code: card.code, name: card.name, stageIndex: index, stage: KQ_STAGES[index], timing: "after-roll", xpCost: card.xpCost,
        condition: `Après ces dés, avant leur validation, avec ${card.xpCost} XP et une copie disponible. ${getKqCardTradeoff(card).risk}`,
        effect: `Sur cette position : ${before.dice.join(" · ")} → ${after.dice.join(" · ")}, ${OUTCOME[before.outcome]} → ${OUTCOME[after.outcome]}. Qualité : ${signed(before.qualityDelta)} → ${signed(after.qualityDelta)}. Solde XP après coût et validation : ${signed(xpBalanceDelta)} par rapport au résultat enregistré. ${pressure}${before.harvestLossPercent !== after.harvestLossPercent ? ` Perte de rendement : ${before.harvestLossPercent} % → ${after.harvestLossPercent} %.` : ""}${before.cultureDead && !after.cultureDead ? " Cette validation n’aurait pas déclenché la mort ; la suite de la culture reste inconnue." : ""}`,
        availability, basis: "verified-position", exactEffect: { before, after, xpBalanceDelta },
      } satisfies KqCultureCardAdvice,
    }];
  });
}

function nextRunAdvice(state: KqGameState, stage: KqCultureStageAnalysis, position: KqGameState | null): KqCultureCardAdvice | null {
  const situation = getKqSituation({ ...state, stageIndex: stage.index });
  const dangerous = stage.dice.includes(1);
  const weak = stage.outcome === "failure" || stage.outcome === "fragile";
  const options: { code: string; when: boolean; condition: string }[] = [
    { code: "BOTTE-034", when: (stage.harvestLossPercent ?? 0) > 0, condition: "Lors d’un vol, avant les dés, à la place d’une autre préparation." },
    { code: "BOTTE-025", when: weak && situation.tags.includes("pest") && !position?.revealedPest, condition: "Avant les dés d’une situation Ravageur, puis choisir une PBI qui cible le ravageur révélé et garder les XP nécessaires pour cette réaction." },
    { code: "BOTTE-014", when: weak && (stage.pressureBefore ?? 0) >= 3 && situation.tags.some(tag => ["water", "climate", "drying"].includes(tag)), condition: "Avant les dés d’une situation Eau, Climat ou Séchage, à la place d’une autre préparation ; utile pour repasser sous 3 Pression si elle est à 3." },
    { code: "BOTTE-024", when: weak && dangerous && situation.tags.includes("water"), condition: "Après les dés d’une situation Eau, seulement s’il reste un 1 et si la réaction est encore libre." },
    { code: "BOTTE-026", when: weak && dangerous && situation.tags.some(tag => ["climate", "drying"].includes(tag)), condition: "Avant les dés d’une situation Climat ou Séchage, à la place d’une autre préparation ; protège jusqu’à deux 1, sans créer de réussite." },
    { code: "BOTTE-030", when: weak && stage.dice.some(die => die === 2 || die === 3) && situation.tags.includes("drying"), condition: "Après les dés au Séchage, avec un 2 ou un 3 et la réaction encore libre." },
    { code: "BOTTE-021", when: stage.total === 2 && stage.dice.some(die => die === 2 || die === 3), condition: "Après les dés, avec exactement deux réussites, un 2 ou un 3 et la réaction encore libre." },
    { code: "BOTTE-031", when: weak && situation.tags.includes("energy"), condition: "Avant les dés d’une situation Énergie, à la place d’une autre préparation ; le seuil reste au minimum à 1." },
    { code: "BOTTE-016", when: !weak && situation.tags.includes("drying"), condition: "Avant les dés au Séchage, à la place d’une autre préparation ; le bonus Qualité exige ensuite une Réussite ou un Critique." },
    { code: "BOTTE-015", when: weak && situation.tags.includes("flower") && situation.code !== "SIT-046", condition: "Avant les dés d’une situation Floraison compatible, à la place d’une autre préparation ; il faut ensuite obtenir un 2 ou un 3." },
  ];
  const option = options.find(item => item.when && !position?.playedThisStage.includes(item.code));
  if (!option) return null;
  const card = KQ_CARDS.find(item => item.code === option.code) as KqSupportCard;
  return {
    code: card.code, name: card.name, stageIndex: stage.index, stage: stage.stage,
    timing: card.timing as "before-roll" | "after-roll", xpCost: card.xpCost,
    condition: `${option.condition} Prévoir ${card.xpCost} XP.`,
    effect: `${card.description} ${getKqCardTradeoff(card).risk}`,
    availability: "À prévoir pour une prochaine situation semblable, avec une copie en stock et la carte en main. Aucun effet chiffré n’est attribué à la partie passée.",
    basis: "next-run",
  };
}

/** Explains receipts, never predicts subsequent dice or assumes real account inventory. */
export function getKqCultureAnalysis(state: KqGameState): KqCultureAnalysis {
  const positions = state.history.map((_, index) => restoreDecision(state, index));
  const stages = state.history.map((entry, index) => describeStage(entry, index, positions[index]));
  const detailedCount = stages.filter(stage => stage.detailed).length;
  const coverage = detailedCount === 0 ? "legacy" : detailedCount === stages.length ? "detailed" : "partial";
  if (!stages.length) return { headline: "Aucune étape validée à analyser.", evidence: [], advice: [], stages, coverage };
  const losses = stages.filter(stage => (stage.qualityDelta ?? 0) < 0);
  const costly = [...stages].sort((a, b) => (b.harvestLossPercent ?? 0) - (a.harvestLossPercent ?? 0) || (a.qualityDelta ?? 0) - (b.qualityDelta ?? 0))[0];
  const best = [...stages].sort((a, b) => (b.qualityDelta ?? 0) - (a.qualityDelta ?? 0))[0];
  const zeroStages = stages.filter(stage => stage.total === 0 && !stage.rescued);
  const headline = state.cultureDead
    ? `${zeroStages.length} étapes à zéro réussite non secourues ont arrêté la culture.`
    : (costly.harvestLossPercent ?? 0) > 0
      ? `${costly.stage} : le vol a réduit le rendement de ${costly.harvestLossPercent} %.`
      : losses.length
        ? `${costly.stage} a coûté ${Math.abs(costly.qualityDelta!)} Qualité.`
        : best.qualityDelta !== null
          ? `${best.stage} a apporté ${signed(best.qualityDelta)} Qualité.`
          : "Les résultats sont conservés, mais les gains détaillés manquent dans cette ancienne partie.";
  const evidence: string[] = [];
  if (losses.length) evidence.push(`${losses.map(stage => stage.stage).join(" et ")} : ${losses.reduce((sum, stage) => sum - stage.qualityDelta!, 0)} Qualité perdue au total.`);
  const focalStage = state.cultureDead ? zeroStages.at(-1) ?? costly
    : (costly.harvestLossPercent ?? 0) > 0 || losses.length ? costly : best;
  if (focalStage.detailed) {
    evidence.push(...focalStage.evidence.slice(2, 4).map(detail => `${focalStage.stage} : ${detail}`));
  }
  if ((best.qualityDelta ?? 0) > 0) evidence.push(`Meilleur apport : ${best.stage}, +${best.qualityDelta} Qualité avec ${OUTCOME[best.outcome]}.`);
  if ((state.equipmentQualityBonus ?? 0) > 0) evidence.push(`Le matériel a ajouté +${state.equipmentQualityBonus} Qualité à la récolte, en plus des étapes.`);
  if (coverage !== "detailed") evidence.push("Certaines positions avant validation ne sont pas enregistrées ou ne sont plus vérifiables : aucun coup manqué n’est affirmé pour ces étapes.");
  const ranked = positions.flatMap((position, index) => position ? verifiedAdvice(position, index) : []).sort((a, b) => b.score - a.score || a.advice.xpCost - b.advice.xpCost || a.advice.stageIndex - b.advice.stageIndex);
  const advice: KqCultureCardAdvice[] = [];
  for (const item of ranked) {
    if (!advice.some(existing => existing.code === item.advice.code || existing.stageIndex === item.advice.stageIndex)) advice.push(item.advice);
    if (advice.length === 2) break;
  }
  for (const stage of [costly, ...stages]) {
    if (advice.length >= 2) break;
    if (advice.some(item => item.stageIndex === stage.index)) continue;
    const planned = nextRunAdvice(state, stage, positions[stage.index]);
    if (planned && !advice.some(item => item.code === planned.code)) advice.push(planned);
  }
  return { headline, evidence, advice, stages, coverage };
}
