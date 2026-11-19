import { KQ_BANK_DESK_LABELS } from "./kanab-quest-bank-navigation";
import { FARM_GUIDE_CHAPTERS, parseFarmGuide, type FarmGuideChapterId, type FarmGuideFacts } from "./kanab-quest-farm-guide";

import { FARM_GUIDE_STEPS } from "./kanab-quest-tutorial-content";
export { FARM_GUIDE_STEPS } from "./kanab-quest-tutorial-content";

export type FarmStep = typeof FARM_GUIDE_STEPS[number];
export type FarmStepId = FarmStep["id"];
export type FarmVisitId = Extract<FarmStep, { objectiveKind: "visit" }>["id"];
const VISIT_STEPS: readonly FarmVisitId[] = FARM_GUIDE_STEPS.filter(step => step.objectiveKind === "visit").map(step => step.id);
export type FarmProgress = {
  version: 2; active: boolean; started: boolean; collapsed: boolean; completed: FarmStepId[]; flowerId?: string;
  /** Choosing or rereading an objective never changes its completion evidence. */
  selectedStepId?: FarmStepId; replayStepId?: FarmStepId;
};
export type FarmEvidence = {
  error?: boolean; visits?: FarmVisitId[]; savedZones?: number; assignedZones?: number;
  /** Current server/UI prerequisites only; never an alternative completion signal. */
  unavailable?: Partial<Record<FarmStepId, string>>;
  cultureStarted?: boolean; rolled?: boolean; turnResolved?: boolean; harvestId?: string;
  openedPack?: boolean; cardPlayed?: boolean; schoolAnswered?: boolean;
  /** Previously recorded official harvests, linked to a server culture run. */
  pastHarvestIds?: string[];
  lots?: { id: string; protected: boolean; ready: boolean }[]; juryIds?: string[]; saleId?: string;
  trim?: { id: string; state: "required" | "running" | "queued" | "complete" | "not-required" };
  trims?: NonNullable<FarmEvidence["trim"]>[];
};
export const emptyFarmProgress = (): FarmProgress => ({ version: 2, active: false, started: false, collapsed: false, completed: [] });
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const validStepId = (id: unknown): id is FarmStepId => FARM_GUIDE_STEPS.some(step => step.id === id);
export function parseFarmProgress(raw: string | null): FarmProgress | null {
  if (raw === null) return emptyFarmProgress();
  try {
    const row = JSON.parse(raw);
    if (row?.version === 1) {
      const previous = parseFarmGuide(raw);
      // Reading the old slideshow is not evidence that the player performed its tasks.
      return previous ? { ...emptyFarmProgress(), active: previous.active, started: previous.active || previous.read.length > 0, collapsed: previous.read.length > 0 } : null;
    }
    if (row?.version !== 2 || typeof row.active !== "boolean" || typeof row.started !== "boolean" || typeof row.collapsed !== "boolean"
      || !Array.isArray(row.completed) || row.completed.some((id: unknown) => !FARM_GUIDE_STEPS.some(step => step.id === id))
      || (row.flowerId !== undefined && !validId(row.flowerId))
      || (row.selectedStepId !== undefined && !validStepId(row.selectedStepId))
      || (row.replayStepId !== undefined && !validStepId(row.replayStepId))) return null;
    const completed = new Set<FarmStepId>(row.completed);
    // A saved verdict or sale already passed the server prerequisites, including legacy exemptions.
    if (completed.has("jury") || completed.has("sale")) completed.add("trim");
    return { version: 2, active: row.active, started: row.started || row.active, collapsed: row.collapsed, completed: [...completed],
      ...(row.flowerId ? { flowerId: row.flowerId } : {}),
      ...(row.selectedStepId ? { selectedStepId: row.selectedStepId } : {}),
      ...(row.replayStepId ? { replayStepId: row.replayStepId } : {}) };
  } catch { return null; }
}
export const isFarmProgressComplete = (state: FarmProgress) => FARM_GUIDE_STEPS.every(step => state.completed.includes(step.id));
export function getFarmStep(state: FarmProgress, evidence?: FarmEvidence): FarmStep | undefined {
  if (state.replayStepId) return FARM_GUIDE_STEPS.find(step => step.id === state.replayStepId);
  const selected = FARM_GUIDE_STEPS.find(step => step.id === state.selectedStepId);
  if (selected && !state.completed.includes(selected.id)) return selected;
  const nextInChapter = selected && FARM_GUIDE_STEPS.find(step => step.chapter === selected.chapter && getFarmStepState(state, step.id, evidence).status === "available");
  return nextInChapter ?? FARM_GUIDE_STEPS.find(step => getFarmStepState(state, step.id, evidence).status === "available")
    ?? FARM_GUIDE_STEPS.find(step => !state.completed.includes(step.id));
}
export function selectFarmStep(state: FarmProgress, id: FarmStepId): FarmProgress {
  if (!validStepId(id)) return state;
  const progress = { ...state };
  delete progress.replayStepId;
  return { ...progress, active: true, started: true, collapsed: false, selectedStepId: id,
    ...(state.completed.includes(id) ? { replayStepId: id } : {}) };
}
export function replayFarmStep(state: FarmProgress, id: FarmStepId): FarmProgress {
  return validStepId(id) ? { ...state, active: true, started: true, collapsed: false, replayStepId: id } : state;
}
export function resumeFarmProgress(state: FarmProgress): FarmProgress {
  const progress = { ...state };
  delete progress.replayStepId;
  return { ...progress, active: true, started: true, collapsed: false };
}
export const pauseFarmProgress = (state: FarmProgress): FarmProgress => ({ ...state, active: false, collapsed: true });
export type FarmStepState = { status: "completed" | "available" | "locked" | "waiting"; prerequisites: FarmStepId[]; reason?: string };
export function getFarmStepState(state: FarmProgress, id: FarmStepId, evidence?: FarmEvidence): FarmStepState {
  if (state.completed.includes(id)) return { status: "completed", prerequisites: [] };
  const unavailable = evidence?.unavailable?.[id];
  if (typeof unavailable === "string" && unavailable.trim()) return { status: "waiting", prerequisites: [], reason: unavailable };
  if (evidence?.error) return { status: "waiting", prerequisites: [], reason: "La confirmation du jeu est indisponible. La progression reste conservée." };
  const prerequisites = (FARM_GUIDE_STEPS.find(step => step.id === id)?.prerequisites ?? []).filter(required => !state.completed.includes(required));
  if (prerequisites.length) return { status: "locked", prerequisites,
    reason: `À accomplir : ${prerequisites.map(required => `« ${FARM_GUIDE_STEPS.find(step => step.id === required)!.title} »`).join(" et ")}. Tu peux déjà consulter cette étape.` };
  const trim = evidence?.trim?.id === state.flowerId ? evidence?.trim : evidence?.trims?.find(item => item.id === state.flowerId);
  if (id === "trim" && trim && ["running", "queued"].includes(trim.state)) return { status: "waiting", prerequisites: [], reason: "Le trim du lot suivi est encore en cours ou en attente." };
  const lot = evidence?.lots?.find(item => item.id === state.flowerId);
  if (id === "cure" && lot && !lot.ready) return { status: "waiting", prerequisites: [], reason: "L’affinage continue. Sa fin sera confirmée par le jeu." };
  return { status: "available", prerequisites: [] };
}
export const farmStepChapter = (step: FarmStep) => {
  const chapter = FARM_GUIDE_CHAPTERS.find(chapter => chapter.id === step.chapter)!;
  if (step.chapter === "bank") return { ...chapter, section: step.bankDesk, tab: `Banque · ${KQ_BANK_DESK_LABELS[step.bankDesk]}` };
  return step.id === "trim" ? { ...chapter, tab: "Atelier · Trim", section: "processing" } : chapter;
};
export function followFarmHarvest(state: FarmProgress, flowerId: string): FarmProgress {
  if (!validId(flowerId) || state.flowerId === flowerId) return state;
  // Following another lot changes context, not the player's already learned skills.
  return { ...state, flowerId };
}
export function observeFarmProgress(state: FarmProgress, evidence: FarmEvidence): FarmProgress {
  if (!state.started || evidence.error) return state;
  const done = new Set(state.completed);
  evidence.visits?.forEach(id => { if (VISIT_STEPS.includes(id)) done.add(id); });
  if (evidence.openedPack === true) done.add("pack-open");
  if (evidence.cardPlayed === true) done.add("card-play");
  if (evidence.schoolAnswered === true) done.add("school-answer");
  if (Number.isSafeInteger(evidence.savedZones) && evidence.savedZones! > 0) done.add("zone");
  if (Number.isSafeInteger(evidence.assignedZones) && evidence.assignedZones! > 0) { done.add("zone"); done.add("assign"); }
  if (evidence.cultureStarted) done.add("launch");
  if (evidence.rolled && evidence.cultureStarted) done.add("roll");
  if (evidence.turnResolved && evidence.cultureStarted) { done.add("roll"); done.add("resolve"); }
  let flowerId = state.flowerId;
  if (validId(evidence.harvestId)) {
    flowerId ??= evidence.harvestId;
    ["launch", "roll", "resolve", "harvest"].forEach(id => done.add(id as FarmStepId));
  }
  const pastHarvestIds = evidence.pastHarvestIds?.filter(validId) ?? [];
  if (pastHarvestIds.length) {
    flowerId ??= pastHarvestIds[0];
    ["launch", "roll", "resolve", "harvest"].forEach(id => done.add(id as FarmStepId));
  }
  // A recorded stock lot can resume an earlier harvest, but never proves that dice were played.
  if (!flowerId) flowerId = evidence.lots?.find(lot => validId(lot.id))?.id;
  const lot = evidence.lots?.find(item => item.id === flowerId);
  if (lot) {
    done.add("harvest");
    if (lot.protected) done.add("store");
    if (lot.ready) done.add("cure");
  }
  const trim = evidence.trim?.id === flowerId ? evidence.trim : evidence.trims?.find(item => item.id === flowerId);
  if (flowerId && trim && ["complete", "not-required"].includes(trim.state)) done.add("trim");
  if (flowerId && evidence.juryIds?.includes(flowerId)) { done.add("trim"); done.add("jury"); }
  if (flowerId && evidence.saleId === flowerId) { done.add("trim"); done.add("sale"); }
  const completed = FARM_GUIDE_STEPS.filter(step => done.has(step.id)).map(step => step.id);
  if (completed.join() === state.completed.join() && flowerId === state.flowerId) return state;
  return { ...state, completed, ...(flowerId ? { flowerId } : {}) };
}

/** Keep recovery and the game's real errors ahead of instructions to spend resources. */
export function farmStepAdvice(step: FarmStep, facts: FarmGuideFacts, currentChapter: FarmGuideChapterId) {
  if (facts.error) return { line: "Le jeu demande ton attention. Lis son message avant de poursuivre ; ton objectif reste conservé.", target: "[role=alert]" };
  if (step.id === "trim" && facts.trimState === "queued") return { line: "Ce trim est réservé après une autre mission. Suis son départ dans l’Atelier ; les heures sont déjà engagées et le lot attend encore sa préparation.", target: step.target };
  if (step.id === "trim" && facts.trimState === "running") return { line: "Le trim de cette récolte est en cours. Une tâche peut ne préparer qu’une partie du lot : le guide attend la confirmation que tout le trim est terminé.", target: step.target };
  if (step.id === "staff-candidate" && currentChapter === "staff" && facts.staffTab === "candidates") {
    return { line: step.line, target: "[data-staff-profile], [data-staff-candidates-empty=true]" };
  }
  if ((step.id === "staff-planning" || step.id === "staff-development" || step.id === "staff-week") && currentChapter === "staff" && facts.staffTab !== "overview") {
    return { line: "Ouvre Bilan pour retrouver les aides de l’équipe. " + step.line, target: "[data-staff-tab=overview]" };
  }
  if (step.chapter === "culture" && currentChapter === "culture") {
    if (facts.cultureDead) return { line: "Cette culture n’a pas donné de récolte. Lis le bilan et les possibilités de reprise avant de relancer.", target: "[data-culture-recovery], [data-culture-rescue]" };
    if (step.id === "harvest" && facts.phase === "prepare") return { line: "Une nouvelle situation attend ta décision. Lis ses effets, puis lance les dés quand tu es prêt.", target: "[data-culture-primary-action], [data-culture-situation]" };
    if (step.id === "harvest" && facts.phase === "rolled") return { line: "Compare les effets de tes choix après le lancer. Valide ta décision avec le bouton du jeu.", target: "[data-culture-primary-action], [data-culture-decision]" };
    if (step.id === "harvest" && facts.phase === "resolved") return { line: "Regarde le résultat sur tes plantes, puis passe à la prochaine étape. La récolte viendra au bout de la culture.", target: "[data-culture-primary-action], [data-culture-result]" };
    if (facts.harvested && step.id === "harvest") return { line: "La culture est finie. Attendons la confirmation de la récolte ; si un message apparaît, suis son indication.", target: "[data-harvest-moment]" };
  }
  return { line: step.line, target: step.target };
}
