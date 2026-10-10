import { getKqStageDisplayName, KQ_STAGES, type KqGameState, type KqOutcome } from "./kanab-quest-game";
import { getKqCareProduct, getKqCareProblem, KQ_CARE_SEVERITY_LABELS, type KqCareState } from "./kanab-quest-care";
import type { KqCultureAnalysis, KqCultureStageAnalysis } from "./kanab-quest-culture-analysis";

export type KqCultureStoryMoment = {
  kind: "success" | "setback" | "care";
  title: string;
  text: string;
  stageIndex?: number;
};
export type KqCultureStoryStage = {
  index: number;
  stage: string;
  situation: string;
  outcome: KqOutcome;
  outcomeLabel: string;
  tone: "positive" | "mixed" | "negative";
  summary: string;
  effects: string[];
  careActions: string[];
  detailsAvailable: boolean;
};
export type KqCultureStory = {
  title: string;
  summary: string;
  moments: KqCultureStoryMoment[];
  stages: KqCultureStoryStage[];
  care: { code: string; name: string; count: number; stages: string[]; detail: string }[];
  notes: string[];
};

const LABELS: Record<KqOutcome, string> = {
  critical: "Réussite exceptionnelle", success: "Réussite", fragile: "Résultat fragile", failure: "Échec",
};
const signed = (value: number) => `${value > 0 ? "+" : "−"}${Math.abs(value)}`;
const points = (value: number) => `${Math.abs(value)} point${Math.abs(value) === 1 ? "" : "s"}`;
const won = (stage: KqCultureStageAnalysis) => stage.outcome === "critical" || stage.outcome === "success";
const unique = <T,>(items: T[]) => [...new Set(items)];
const stageName = (index: number) => KQ_STAGES[index] ? getKqStageDisplayName(KQ_STAGES[index]) : "Étape non enregistrée";
const sentence = (text: string) => /[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
const stageWhere = (index: number) => ["à la germination", "à l’enracinement", "pendant la croissance", "en floraison", "à la récolte", "au séchage"][index] ?? "à cette étape";

/** Use recorded biological checks, not a new simulation of this culture. */
function resolutionAt(state: KqGameState, index: number) {
  return state.care?.history.findLast(event => event.kind === "resolution" && event.stageIndex === index);
}

/** An adjacent verified snapshot includes the preceding check. New observations
 * and applications between these checks do not heal existing problems. */
function carePair(state: KqGameState, analysis: KqCultureAnalysis, index: number): { before: KqCareState; after: KqCareState } | null {
  if (!analysis.stages[index]?.detailed) return null;
  const before = state.history[index]?.decision?.care;
  const after = index === state.history.length - 1 ? state.care
    : analysis.stages[index + 1]?.detailed ? state.history[index + 1]?.decision?.care : undefined;
  return before && after ? { before, after } : null;
}

/** Product-specific sentences are already recorded by the engine. Do not
 * attribute the whole health/reward delta to a purchased intervention. */
function productNotes(state: KqGameState, code: string) {
  const product = getKqCareProduct(code);
  if (!product) return [];
  return (state.care?.history ?? []).flatMap(event => event.kind !== "resolution" ? []
    : event.message.split(/(?<=\.)\s+/).filter(sentence => sentence.startsWith(`${product.name} : `)
      || sentence.startsWith(`${product.name} · `)).map(sentence => ({ stageIndex: event.stageIndex,
        text: sentence.slice(product.name.length + 3),
      })));
}

function stageEffects(state: KqGameState, analysis: KqCultureAnalysis, stage: KqCultureStageAnalysis) {
  const effects: string[] = [];
  if (stage.qualityDelta !== null && stage.qualityDelta !== 0) effects.push(`${signed(stage.qualityDelta)} ${points(stage.qualityDelta).replace(/^\d+ /, "")} de qualité.`);
  const check = resolutionAt(state, stage.index);
  if (check?.vitalityDelta) effects.push(`Santé de la culture : ${signed(check.vitalityDelta)} ${points(check.vitalityDelta).replace(/^\d+ /, "")}.`);
  if (check?.terpenesDelta) effects.push(`Arômes · terpènes : ${signed(check.terpenesDelta)} ${points(check.terpenesDelta).replace(/^\d+ /, "")}.`);
  if (check?.cannabinoidDelta) effects.push(`Potentiel cannabinoïde : ${signed(check.cannabinoidDelta)} ${points(check.cannabinoidDelta).replace(/^\d+ /, "")}.`);
  if (stage.rescued) effects.push(state.rulesVersion === 3
    ? "Le secours de première culture a rétabli la santé à 15/100 ; les pertes précédentes restent acquises."
    : "Le secours de première culture a permis de continuer malgré cet échec.");
  const pair = carePair(state, analysis, stage.index);
  if (pair) {
    // The drying step clears plant problems because the lot is harvested; this
    // is not evidence that a pest or deficiency has been cured.
    if (stage.index < 5) for (const problem of pair.before.problems) {
      // A fresh outbreak of the same problem at the following observation
      // belongs to that next stage, not to the preceding problem's recovery.
      const after = pair.after.problems.find(item => item.code === problem.code && item.appearedAt <= stage.index);
      const name = getKqCareProblem(problem.code)?.name;
      if (!name) continue;
      if (!after) effects.push(`${name} : résorbé au bilan.`);
      else if (after.severity !== problem.severity) effects.push(`${name} : ${KQ_CARE_SEVERITY_LABELS[problem.severity].toLowerCase()} → ${KQ_CARE_SEVERITY_LABELS[after.severity].toLowerCase()}.`);
    }
    const support = pair.after.yieldBonusPercent - pair.before.yieldBonusPercent;
    const loss = pair.after.yieldLossPercent - pair.before.yieldLossPercent;
    if (support > 0) effects.push(`Soutien à la production : +${support} points de pourcentage au bonus de rendement.`);
    if (loss > 0) effects.push(`Pertes de production : ${loss} points de pourcentage supplémentaires enregistrés.`);
  }
  if ((stage.harvestLossPercent ?? 0) > 0) effects.push(`Le vol a retiré ${stage.harvestLossPercent} points de pourcentage au rendement.`);
  return effects;
}

function describeStage(state: KqGameState, analysis: KqCultureAnalysis, stage: KqCultureStageAnalysis): KqCultureStoryStage {
  const isLast = stage.index === state.history.length - 1;
  const trait = state.history[stage.index]?.trait;
  const result = stage.outcome === "critical" ? "Tu as obtenu une réussite exceptionnelle."
    : stage.outcome === "success" ? "Tu as passé cette opération avec succès."
      : stage.outcome === "fragile" ? "Le résultat de cette opération reste fragile."
        : "Cette opération s’est soldée par un échec.";
  const careActions = (state.care?.applications ?? []).filter(item => item.stageIndex === stage.index)
    .flatMap(item => { const product = getKqCareProduct(item.productCode); return product ? [product.name] : []; });
  if (state.care?.history.some(event => event.kind === "intervention" && event.stageIndex === stage.index
    && !event.productCode && (event.message.startsWith("Suivi de base engagé")
      || event.message.startsWith("Entretien engagé pour cette étape")))) careActions.push("Entretien de base");
  return {
    index: stage.index, stage: stageName(stage.index), situation: stage.situation, outcome: stage.outcome,
    outcomeLabel: LABELS[stage.outcome], tone: won(stage) ? "positive" : stage.outcome === "fragile" ? "mixed" : "negative",
    summary: `${result}${trait ? ` Bilan : ${sentence(trait.charAt(0).toLowerCase() + trait.slice(1))}` : ""}${state.cultureDead && isLast ? " La culture s’est arrêtée ici." : ""}`,
    effects: stageEffects(state, analysis, stage), careActions: unique(careActions), detailsAvailable: stage.detailed,
  };
}

function momentText(state: KqGameState, stage: KqCultureStageAnalysis, effects: string[]) {
  const selected = effects.filter(effect => !effect.startsWith("Potentiel cannabinoïde") && !effect.startsWith("Soutien à la production")).slice(0, 2);
  const trait = state.history[stage.index]?.trait;
  return `« ${stage.situation} » : ${selected.length ? selected.join(" ") : sentence(trait || LABELS[stage.outcome])}`;
}

function narrateResult(state: KqGameState, stage: KqCultureStageAnalysis) {
  const where = stageWhere(stage.index);
  if ((stage.harvestLossPercent ?? 0) > 0) return `Le vol a entraîné une perte de rendement lors de « ${stage.situation} » ${where}.`;
  if (stage.outcome === "failure") return `L’opération « ${stage.situation} » s’est soldée par un échec ${where}.`;
  if (stage.outcome === "fragile") return `Le résultat de « ${stage.situation} » est resté fragile ${where}.`;
  if ((resolutionAt(state, stage.index)?.vitalityDelta ?? 0) < 0) return `Tu as réussi « ${stage.situation} » ${where}, mais le bilan de santé a reculé à cette étape.`;
  return `Tu as ${stage.outcome === "critical" ? "particulièrement bien " : ""}réussi « ${stage.situation} » ${where}.`;
}

function narrateJourney(state: KqGameState, analysis: KqCultureAnalysis, difficult?: KqCultureStageAnalysis, best?: KqCultureStageAnalysis) {
  const last = analysis.stages.at(-1)!;
  // Tie the difficult passage or strongest operation to the actual ending,
  // in chronological order. These are recorded results, not causal claims.
  const focus = difficult && difficult.index !== last.index ? difficult : best;
  const passages = unique([focus, last].filter((stage): stage is KqCultureStageAnalysis => Boolean(stage)))
    .sort((a, b) => a.index - b.index);
  const journey = passages.map(stage => narrateResult(state, stage)).join(" ");
  if (state.cultureDead) return `${journey} La culture s’est arrêtée ${stageWhere(last.index)}, sans récolte.`;
  if (state.phase === "complete" && state.harvestGrams !== undefined) return `${journey} Récolte obtenue : ${state.harvestGrams.toLocaleString("fr-FR")} g.`;
  return journey;
}

/** A reading layer only: keeps saved rules/rewards intact, and uses the analysis
 * already computed by the caller rather than replaying advice a second time. */
export function getKqCultureStory(state: KqGameState, analysis: KqCultureAnalysis): KqCultureStory {
  const stages = analysis.stages.map(stage => describeStage(state, analysis, stage));
  const notes = analysis.coverage === "detailed" ? [] : ["Certains détails de ce parcours ne sont plus disponibles. Le carnet présente les résultats enregistrés."];
  const care: KqCultureStory["care"] = unique((state.care?.applications ?? []).map(item => item.productCode)).flatMap(code => {
    const product = getKqCareProduct(code);
    if (!product) return [];
    const applications = state.care!.applications.filter(item => item.productCode === code);
    const recorded = productNotes(state, code);
    // Prefer a later, actual biological effect over an installation note.
    const meaningful = recorded.filter(item => !item.text.includes("installation et contention"));
    const latest = (meaningful.length ? meaningful : recorded).at(-1);
    return [{ code, name: product.name, count: applications.length,
      stages: unique(applications.map(item => stageName(item.stageIndex))),
      detail: latest ? `${stageName(latest.stageIndex)} : ${latest.text}` : "Application enregistrée ; son effet propre n’est pas détaillé dans ce bilan.",
    }];
  });
  if (!stages.length) return { title: "Le carnet attend sa première étape", summary: "Aucune opération n’a encore été validée.", moments: [], stages, care, notes: [] };

  const cost = (stage: KqCultureStageAnalysis) => (stage.harvestLossPercent ?? 0) * 3
    + Math.max(0, -(stage.qualityDelta ?? 0)) * 10 + Math.max(0, -(resolutionAt(state, stage.index)?.vitalityDelta ?? 0))
    + (stage.outcome === "failure" ? 10 : stage.outcome === "fragile" ? 1 : 0);
  const difficult = [...analysis.stages].filter(stage => cost(stage) > 0).sort((a, b) => cost(b) - cost(a))[0];
  const strongest = [...analysis.stages].filter(won).sort((a, b) => (b.qualityDelta ?? 0) - (a.qualityDelta ?? 0)
    || (resolutionAt(state, b.index)?.terpenesDelta ?? 0) - (resolutionAt(state, a.index)?.terpenesDelta ?? 0));
  const setbackIndex = state.cultureDead ? stages.at(-1)!.index : difficult?.index;
  // A health loss can coexist with a successful operation. Prefer another
  // genuine success so the short overview does not repeat the same moment.
  const best = strongest.find(stage => stage.index !== setbackIndex);
  const rescued = analysis.stages.find(stage => stage.rescued);
  const last = stages.at(-1)!;
  const moments: KqCultureStoryMoment[] = [];
  if (state.cultureDead) moments.push({ kind: "setback", title: `L’arrêt à l’étape ${last.stage.toLowerCase()}`, stageIndex: last.index,
    text: state.rulesVersion === 3 ? "La santé est tombée à zéro : cette culture n’a pas produit de récolte. Les étapes précédentes restent dans ton carnet."
      : "Les échecs ont déclenché l’arrêt de cette culture, selon ses règles d’origine. Aucune récolte n’a été produite.",
  });
  else if (difficult) moments.push({ kind: "setback", title: `${stageName(difficult.index)} : le passage délicat`, stageIndex: difficult.index,
    text: momentText(state, difficult, stages[difficult.index].effects),
  });
  if (best) moments.push({ kind: "success", title: `${stageName(best.index)} : ton point fort`, stageIndex: best.index,
    text: momentText(state, best, stages[best.index].effects),
  });
  if (rescued) moments.push({ kind: "care", title: "Le secours a permis de continuer", stageIndex: rescued.index,
    text: `${stageName(rescued.index)} : ${state.rulesVersion === 3 ? "la santé a été rétablie à 15/100. Les pertes subies n’ont pas été effacées." : "le secours de première culture a empêché un arrêt à cette étape, sans changer son résultat."}`,
  });
  else if ((state.equipmentQualityBonus ?? 0) > 0) moments.push({ kind: "care", title: "Ton matériel a compté", text: `Ton équipement a ajouté ${points(state.equipmentQualityBonus!)} de qualité à la récolte, en plus des résultats des étapes.` });
  else if (care.length) moments.push({ kind: "care", title: care[0].name, text: care[0].detail });

  const complete = state.phase === "complete" && !state.cultureDead;
  const difficultTitles = ["Un départ difficile", "Un enracinement mouvementé", "Une croissance mouvementée", "Une floraison délicate", "Une récolte sous tension", "Un séchage délicat"];
  const title = state.cultureDead ? `Arrêt ${stageWhere(last.index)}`
    : difficult ? difficultTitles[difficult.index] ?? "Un parcours mouvementé"
      : complete ? "Un parcours sans échec" : "Le début du parcours";
  const summary = narrateJourney(state, analysis, difficult, best);
  return { title, summary, moments: moments.slice(0, 3), stages, care, notes };
}
