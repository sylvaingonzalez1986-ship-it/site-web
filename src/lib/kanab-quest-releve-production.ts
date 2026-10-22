import { activateKqHeritage, advanceKqStage, canActivateKqHeritage, canPlayKqCard, isKqCultureDead, KQ_ACTIVE_CARDS, KQ_BUDDIES, KQ_HAND_SIZE, playKqCard, redrawKqHand, resolveKqStage, rollKqDice, startKqGame, swapKqHeritageHandCard, type KqGameState } from "./kanab-quest-game";
import { createKqFlower, createKqOpponent, lockKqBattle, resolveKqBattle, type KqBattle } from "./kanab-quest-battle";
import { getKqCampaignMemberState, getKqCampaignParticipants } from "./kanab-quest-campaign";
import { getKqBuddieRotationRemaining, recordKqBuddieUse } from "./kanab-quest-buddie-rotation";
import { applyKqCareProduct, canApplyKqCareProduct, canPerformKqBasicCare, getKqCareProduct, KQ_BASIC_CARE_PRICE_CENTS, performKqBasicCare } from "./kanab-quest-care";
import { KQ_HERITAGE_CARDS } from "./kanab-quest-heritage";
import { KQ_LAB_ANALYSIS_CENTS, KQ_SUPPLIER_PAYMENT_TERM_MS } from "./kanab-quest-business";
import { getKqWarehouseQuote, getKqWarehouseSummary, validateKqWarehouseState, type KqWarehouseState } from "./kanab-quest-warehouse";

export type KqReleveProductionChapter = "plan" | "buddies" | "launch" | "culture" | "jury" | "expansion";
export type KqReleveProductionLedgerEntry = {
  id: string; kind: "equipment" | "care" | "supplier" | "energy" | "lab";
  label: string; amountCents: number; status: "paid" | "due"; issuedAt: string; dueAt?: string;
};
type Checkpoint = { game: KqGameState; cashCents: number; supportInventory: Record<string, number>; careInventory: Record<string, number>; ledger: KqReleveProductionLedgerEntry[] };
export type KqReleveProductionState = {
  version: 1; warehouse: KqWarehouseState; draftWarehouse: KqWarehouseState; revision: number;
  cashCents: number; clock: number; ownedBuddies: string[]; recentBuddieCodes: string[];
  supportInventory: Record<string, number>; careInventory: Record<string, number>;
  deckCodes: string[]; heritageCode: string | null; game: KqGameState | null;
  battles: Record<string, KqBattle>; revealedRounds: Record<string, number>;
  ledger: KqReleveProductionLedgerEntry[]; milestones: string[]; checkpoint: Checkpoint | null;
};
export const KQ_RELEVE_BUDDIES = ["HH2026-005", "HH2026-010", "HH2026-020"] as const;
export const KQ_RELEVE_SUPPORTS = ["BOTTE-005", "BOTTE-024", "BOTTE-020", "BOTTE-003", "BOTTE-006", "BOTTE-015", "BOTTE-032", "BOTTE-016", "BOTTE-030"];
export const KQ_RELEVE_RESERVE_CENTS = 15_000;
const START_TIME = Date.parse("2026-10-16T12:00:00.000Z");

export function createKqReleveProduction(): KqReleveProductionState {
  const warehouse: KqWarehouseState = { version: 1, floor: { columns: 10, rows: 10 }, zones: [], serviceZones: [], equipment: [], preparedAreaM2: 0 };
  return { version: 1, warehouse, draftWarehouse: structuredClone(warehouse), revision: 0,
    cashCents: 200_000, clock: START_TIME, ownedBuddies: [], recentBuddieCodes: ["HH2026-020"],
    supportInventory: Object.fromEntries(KQ_RELEVE_SUPPORTS.map(code => [code, 2])), careInventory: {},
    deckCodes: [...KQ_RELEVE_SUPPORTS, ...KQ_RELEVE_SUPPORTS].slice(0, KQ_HAND_SIZE), heritageCode: "HERITAGE-007", game: null,
    battles: {}, revealedRounds: {}, ledger: [], milestones: [], checkpoint: null };
}

/** A separate practice dossier: no transfer of its budget into the main farm. */
export function createKqReleveExpansion(): KqReleveProductionState {
  const state = createKqReleveProduction();
  const saved = getKqWarehouseQuote(suggestKqRelevePlan(state)).nextState;
  return { ...state, warehouse: saved, draftWarehouse: structuredClone(saved), revision: 1,
    cashCents: 500_000, ownedBuddies: [...KQ_RELEVE_BUDDIES], milestones: ["expansion-dossier"] };
}

/** A proposal changes the draft only. Owned equipment always comes from the saved room. */
export function suggestKqRelevePlan(state: KqReleveProductionState, cultures: 1 | 2 = 1, width = 1): KqWarehouseState {
  return { ...structuredClone(state.warehouse), zones: Array.from({ length: cultures }, (_, index) => ({
    id: `culture-${index + 1}`, name: index ? "La seconde zone" : "La première zone", x: index * 4, y: 1,
    width, height: 1, active: true, lightingCode: "MH-TS1000", airCode: "SIM-AIR-01",
    ...(state.warehouse.zones[index]?.buddieCode ? { buddieCode: state.warehouse.zones[index].buddieCode } : {}),
  })), serviceZones: [
    { id: "drying", name: "Le séchage", x: 1, y: 7, width: 1, height: 1, kind: "drying", deviceCode: "SJ-DRYIT90" },
    { id: "storage", name: "La réserve", x: 4, y: 7, width: 1, height: 1, kind: "storage", deviceCode: "LP-SUPER-1L" },
  ] };
}

export function getKqReleveProductionOutstanding(state: KqReleveProductionState) {
  const amount = (kind: KqReleveProductionLedgerEntry["kind"]) => state.ledger.filter(row => row.kind === kind && row.status === "due").reduce((sum, row) => sum + row.amountCents, 0);
  const supplierCents = amount("supplier"), energyCents = amount("energy"), labCents = amount("lab");
  return { supplierCents, energyCents, labCents, totalCents: supplierCents + energyCents + labCents };
}

export function getKqRelevePlanReview(state: KqReleveProductionState) {
  const errors = validateKqWarehouseState(state.draftWarehouse);
  if (state.draftWarehouse.zones.length > 2) errors.push("Cet exercice accompagne une ou deux zones de culture.");
  if (errors.length) return { errors, quote: null, summary: null, commitmentsCents: 0, availableCents: state.cashCents };
  try {
    const quote = getKqWarehouseQuote(state.draftWarehouse, state.warehouse);
    const summary = getKqWarehouseSummary(quote.nextState);
    const activeCount = quote.nextState.zones.filter(zone => zone.active).length;
    const commitmentsCents = summary.operatingCostCents + activeCount * KQ_LAB_ANALYSIS_CENTS + KQ_BASIC_CARE_PRICE_CENTS;
    return { errors, quote, summary, commitmentsCents, availableCents: state.cashCents - quote.totalCostCents - commitmentsCents - getKqReleveProductionOutstanding(state).totalCents };
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : "Devis indisponible."], quote: null, summary: null, commitmentsCents: 0, availableCents: state.cashCents };
  }
}

export function getKqReleveLaunchIssues(state: KqReleveProductionState): string[] {
  const errors: string[] = [];
  if (state.game) return ["Cette campagne a déjà été lancée. Reprends-la dans le chapitre Culture."];
  if (JSON.stringify(state.warehouse) !== JSON.stringify(state.draftWarehouse)) errors.push("Enregistre ou annule le brouillon du plan avant de lancer.");
  const participants = getKqCampaignParticipants(state.warehouse, state.revision);
  if (!participants.length) errors.push("Affecte un Buddie disponible à une zone active.");
  if (new Set(participants.map(member => member.buddieCode)).size !== participants.length) errors.push("Chaque zone doit accueillir un Buddie différent.");
  for (const member of participants) {
    if (!state.ownedBuddies.includes(member.buddieCode)) errors.push("Ce Buddie ne fait pas partie de l’album prêté.");
    const waiting = getKqBuddieRotationRemaining(member.buddieCode, state.recentBuddieCodes);
    if (waiting) errors.push(`Ce Buddie attend encore ${waiting} autres variétés dans sa rotation.`);
  }
  const summary = getKqWarehouseSummary(state.warehouse);
  // Reservation follows physical potential, before the Buddie's quantity factor.
  const potential = participants.reduce((sum, member) => sum + member.warehouse.estimatedHarvestGrams, 0);
  if (potential > summary.dryingCapacityGrams) errors.push("Agrandis la zone de séchage pour accueillir le potentiel de la campagne.");
  if (potential > summary.storageCapacityGrams) errors.push("Agrandis le stockage avant de lancer cette campagne.");
  for (const code of state.deckCodes) if (!KQ_ACTIVE_CARDS.some(card => card.code === code && card.category !== "pbi") || !(state.supportInventory[code] > 0)) errors.push("Une carte du deck n’est pas disponible.");
  return [...new Set(errors)];
}

export function getKqReleveHarvests(state: KqReleveProductionState) {
  const game = state.game;
  if (!game?.campaign || game.phase !== "complete" || isKqCultureDead(game)) return [];
  return game.campaign.members.map(member => ({ zoneId: member.zoneId,
    game: getKqCampaignMemberState(game, member), battle: state.battles[member.zoneId] ?? null }));
}

export type KqReleveProductionAction =
  | { type: "draft"; warehouse: KqWarehouseState } | { type: "save-plan" } | { type: "cancel-plan" }
  | { type: "reveal-buddie" } | { type: "assign"; zoneId: string; buddieCode: string }
  | { type: "deck"; codes: string[] } | { type: "heritage-choice"; code: string | null }
  | { type: "mark"; milestone: "zone-inspected" | "quote-read" | "charges-read" | "profile-read" | "health-read" | "recap-read" }
  | { type: "launch" } | { type: "roll" } | { type: "resolve" } | { type: "advance" }
  | { type: "play"; code: string } | { type: "heritage" } | { type: "heritage-swap"; handIndex: number; reserveIndex: number } | { type: "redraw" }
  | { type: "basic-care" } | { type: "buy-care"; code: string } | { type: "apply-care"; code: string }
  | { type: "assist" } | { type: "restore-stage" }
  | { type: "duel"; zoneId: string } | { type: "verdict"; zoneId: string } | { type: "round"; zoneId: string };

function requireAction(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function mark(state: KqReleveProductionState, milestone: string) { state.milestones = [...new Set([...state.milestones, milestone])]; }
function record(state: KqReleveProductionState, row: Omit<KqReleveProductionLedgerEntry, "issuedAt">) {
  if (state.ledger.some(previous => previous.id === row.id)) return;
  if (row.status === "paid") {
    requireAction(state.cashCents >= row.amountCents, "Budget d’essai insuffisant. Réduis le devis ou reprends le point de contrôle.");
    state.cashCents -= row.amountCents;
  }
  state.ledger.push({ ...row, issuedAt: new Date(state.clock).toISOString() });
}
function checkpoint(state: KqReleveProductionState) {
  state.checkpoint = structuredClone({ game: state.game!, cashCents: state.cashCents, supportInventory: state.supportInventory, careInventory: state.careInventory, ledger: state.ledger });
}
function harvestInvoices(state: KqReleveProductionState) {
  if (state.game?.phase !== "complete" || !state.game.campaign) return;
  for (const member of state.game.campaign.members) {
    record(state, { id: `energy:${member.runId}`, kind: "energy", label: `Électricité · ${member.warehouse.zones[0].name}`, amountCents: member.warehouse.energyCostCents, status: "due", dueAt: new Date(state.clock).toISOString() });
    if (!isKqCultureDead(state.game)) record(state, { id: `lab:${member.runId}`, kind: "lab", label: `Analyse · ${member.warehouse.zones[0].name}`, amountCents: KQ_LAB_ANALYSIS_CENTS, status: "due", dueAt: new Date(state.clock + KQ_SUPPLIER_PAYMENT_TERM_MS).toISOString() });
  }
}

/** All mutations are local and atomic; the caller persists this serializable state. */
export function applyKqReleveProductionAction(current: KqReleveProductionState, action: KqReleveProductionAction): KqReleveProductionState {
  const state = structuredClone(current);
  const game = state.game;
  switch (action.type) {
    case "mark": mark(state, action.milestone); return state;
    case "draft":
      requireAction(!game, "Le plan utilisé par la campagne est figé jusqu’à sa fin.");
      state.draftWarehouse = structuredClone(action.warehouse); return state;
    case "cancel-plan": state.draftWarehouse = structuredClone(state.warehouse); return state;
    case "save-plan": {
      requireAction(!game, "Cette campagne conserve son plan de départ.");
      const review = getKqRelevePlanReview(state);
      requireAction(review.quote && !review.errors.length, review.errors[0] ?? "Devis invalide.");
      if (JSON.stringify(state.warehouse) === JSON.stringify(state.draftWarehouse)) return current;
      for (const zone of state.draftWarehouse.zones) if (zone.buddieCode) requireAction(state.ownedBuddies.includes(zone.buddieCode), "Ouvre l’album prêté avant d’affecter ce Buddie.");
      record(state, { id: `equipment:${state.revision + 1}`, kind: "equipment", label: "Aménagement des zones", amountCents: review.quote.totalCostCents, status: "paid" });
      state.warehouse = review.quote.nextState; state.draftWarehouse = structuredClone(state.warehouse); state.revision++;
      mark(state, "plan-saved"); if (state.milestones.includes("expansion-dossier")) mark(state, "expansion-saved"); return state;
    }
    case "reveal-buddie": {
      const code = KQ_RELEVE_BUDDIES.find(item => !state.ownedBuddies.includes(item));
      if (!code) return current;
      state.ownedBuddies.push(code);
      if (state.ownedBuddies.length === KQ_RELEVE_BUDDIES.length) mark(state, "pack-opened");
      return state;
    }
    case "assign": {
      requireAction(!game, "Les Buddies de cette campagne sont déjà engagés.");
      requireAction(state.ownedBuddies.includes(action.buddieCode), "Révèle cette carte dans le pack d’essai.");
      requireAction(!getKqBuddieRotationRemaining(action.buddieCode, state.recentBuddieCodes), "Ce Buddie est en rotation. Choisis une autre carte disponible.");
      requireAction(!state.draftWarehouse.zones.some(zone => zone.id !== action.zoneId && zone.buddieCode === action.buddieCode), "Ce Buddie est déjà affecté. Choisis une variété différente.");
      const zone = state.draftWarehouse.zones.find(item => item.id === action.zoneId);
      requireAction(zone, "Choisis une zone sur le plan."); zone.buddieCode = action.buddieCode; mark(state, "buddie-assigned"); return state;
    }
    case "deck":
      requireAction(!game, "Le deck de cette campagne est déjà préparé.");
      requireAction(action.codes.length <= 250 && action.codes.every(code => KQ_RELEVE_SUPPORTS.includes(code) && action.codes.filter(item => item === code).length <= (state.supportInventory[code] ?? 0)), "Choisis des copies disponibles dans l’album prêté.");
      state.deckCodes = [...action.codes]; mark(state, "deck-chosen"); return state;
    case "heritage-choice":
      requireAction(!game && (action.code === null || KQ_HERITAGE_CARDS.some(card => card.code === action.code)), "Choisis un Héritage disponible avant le lancement.");
      state.heritageCode = action.code; mark(state, "heritage-chosen"); return state;
    case "launch": {
      if (game) return current;
      const issues = getKqReleveLaunchIssues(state); requireAction(!issues.length, issues[0]);
      const members = getKqCampaignParticipants(state.warehouse, state.revision).map((member, index) => ({ ...member, runId: `61000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }));
      const first = members[0];
      const maxAdvantage = Math.max(...members.map(member => KQ_BUDDIES.find(buddie => buddie.code === member.buddieCode)!.advantageLevel));
      const firstAdvantage = KQ_BUDDIES.find(buddie => buddie.code === first.buddieCode)!.advantageLevel;
      state.game = { ...startKqGame(2, { rulesVersion: 3, domiciliation: "retired", varietyCode: first.buddieCode, warehouse: first.warehouse, cultivationProfile: first.cultivationProfile,
        deckCodes: state.deckCodes, collectionCodes: Object.keys(state.supportInventory), heritageCode: state.heritageCode ?? undefined,
        startedAt: new Date(state.clock).toISOString(), startingXp: 1, firstCultureRescue: true }),
        campaign: { version: 1, id: "62000000-0000-4000-8000-000000000001", leaderRunId: first.runId, members } };
      state.game.xp += maxAdvantage - firstAdvantage;
      for (const member of members) record(state, { id: `supplier:${member.runId}`, kind: "supplier", label: `Fournitures · ${member.warehouse.zones[0].name}`,
        amountCents: member.warehouse.consumablesCostCents, status: "due", dueAt: new Date(state.clock + KQ_SUPPLIER_PAYMENT_TERM_MS).toISOString() });
      state.recentBuddieCodes = members.reduce((recent, member) => recordKqBuddieUse(member.buddieCode, recent), state.recentBuddieCodes);
      checkpoint(state); mark(state, "launched"); return state;
    }
    case "restore-stage":
      requireAction(state.checkpoint, "Aucun point de contrôle de culture disponible.");
      Object.assign(state, structuredClone(state.checkpoint)); state.battles = {}; state.revealedRounds = {}; mark(state, "stage-restored"); return state;
    case "assist":
      requireAction(game?.care && game.phase !== "complete", "Reprends d’abord le point de contrôle de cette étape.");
      state.game = { ...game, care: { ...game.care, vitality: 100 }, effectNotices: [...(game.effectNotices ?? []), "Aide de l’essai demandée : vitalité rétablie à 100. Les dés, problèmes et pertes précédentes sont conservés."].slice(-12) };
      mark(state, "assisted"); return state;
    case "duel": {
      const harvest = getKqReleveHarvests(state).find(item => item.zoneId === action.zoneId); requireAction(harvest, "Termine la culture avant de présenter cette Fleur.");
      if (state.battles[action.zoneId]) return current;
      const seed = 2026 + getKqReleveHarvests(state).findIndex(item => item.zoneId === action.zoneId);
      state.battles[action.zoneId] = lockKqBattle(createKqFlower(harvest.game, "La ferme d’essai"), createKqOpponent(seed, { rulesVersion: 3, ownerName: "Sylvain · entraînement" }), seed);
      state.revealedRounds[action.zoneId] = 0; return state;
    }
    case "verdict": {
      const battle = state.battles[action.zoneId]; requireAction(battle, "Présente cette Fleur au jury.");
      if (battle.status === "verdict") return current;
      state.battles[action.zoneId] = resolveKqBattle(battle, 2026, new Date(state.clock)); return state;
    }
    case "round": {
      const battle = state.battles[action.zoneId]; requireAction(battle?.status === "verdict", "Confirme le verdict avant de découvrir les manches.");
      state.revealedRounds[action.zoneId] = Math.min(battle.rounds.length, (state.revealedRounds[action.zoneId] ?? 0) + 1);
      if (state.revealedRounds[action.zoneId] === battle.rounds.length) mark(state, `jury-read:${action.zoneId}`); return state;
    }
    default: break;
  }
  requireAction(game && game.phase !== "complete" && !isKqCultureDead(game), "Reprends une culture en cours pour intervenir.");
  switch (action.type) {
    case "roll": requireAction(game.phase === "prepare", "Le lancer de cette étape est déjà effectué."); state.game = rollKqDice(game); break;
    case "resolve":
      requireAction(game.phase === "rolled", "Lance les dés avant de valider."); state.game = resolveKqStage(game);
      if (state.game.phase === "complete") state.game.completedAt = new Date(state.clock).toISOString();
      break;
    case "advance":
      requireAction(game.phase === "resolved", "Valide le bilan avant de continuer."); state.game = advanceKqStage(game);
      if (state.game.phase === "complete") { state.game.completedAt = new Date(state.clock).toISOString(); mark(state, "harvested"); }
      else checkpoint(state);
      break;
    case "play": {
      const card = KQ_ACTIVE_CARDS.find(item => item.code === action.code); requireAction(card, "Carte inconnue.");
      const access = canPlayKqCard(game, card); requireAction(access.allowed && state.supportInventory[card.code] > 0, access.reason);
      state.game = playKqCard(game, card.code); state.supportInventory[card.code]--; mark(state, "card-played"); break;
    }
    case "heritage": { const access = canActivateKqHeritage(game); requireAction(access.allowed, access.reason); state.game = activateKqHeritage(game); break; }
    case "heritage-swap": state.game = swapKqHeritageHandCard(game, action.handIndex, action.reserveIndex); break;
    case "redraw": state.game = redrawKqHand(game); break;
    case "basic-care": {
      const access = canPerformKqBasicCare(game); requireAction(access.allowed, access.reason);
      record(state, { id: `care:${state.ledger.length}`, kind: "care", label: "Entretien commun de la campagne", amountCents: KQ_BASIC_CARE_PRICE_CENTS, status: "paid" });
      state.game = performKqBasicCare(game); mark(state, "care-used"); break;
    }
    case "buy-care": {
      const product = getKqCareProduct(action.code); requireAction(product, "Produit de soin inconnu.");
      record(state, { id: `care:${state.ledger.length}`, kind: "care", label: product.name, amountCents: product.priceCents, status: "paid" });
      state.careInventory[product.code] = (state.careInventory[product.code] ?? 0) + 1; break;
    }
    case "apply-care": {
      const access = canApplyKqCareProduct(game, action.code); requireAction(access.allowed, access.reason);
      requireAction(state.careInventory[action.code] > 0, "Achète une charge dans la réserve de soins.");
      state.game = applyKqCareProduct(game, action.code); state.careInventory[action.code]--; mark(state, "care-used"); break;
    }
  }
  harvestInvoices(state);
  return state;
}

export function getKqReleveProductionProgress(chapter: KqReleveProductionChapter, state: KqReleveProductionState) {
  const summary = getKqWarehouseSummary(state.warehouse);
  const saved = JSON.stringify(state.warehouse) === JSON.stringify(state.draftWarehouse);
  const planReady = state.warehouse.zones.some(zone => zone.active) && summary.dryingCapacityGrams >= summary.estimatedHarvestGrams && summary.storageCapacityGrams >= summary.estimatedHarvestGrams;
  if (chapter === "expansion") return { complete: saved && state.milestones.includes("expansion-saved"), instruction: "Essaie un agrandissement, compare les modules et enregistre ton projet dans ce dossier prêté. Son budget reste séparé de ta ferme d’essai." };
  if (chapter === "plan") return { complete: saved && planReady && ["plan-saved", "quote-read", "charges-read"].every(key => state.milestones.includes(key)), instruction: "Dessine tes zones, compare le devis et les charges, puis enregistre l’installation." };
  if (chapter === "buddies") return { complete: saved && state.milestones.includes("pack-opened") && state.milestones.includes("profile-read") && getKqCampaignParticipants(state.warehouse, state.revision).length > 0,
    instruction: "Révèle le pack prêté, découvre un profil et affecte une variété disponible à chaque zone que tu veux cultiver. Enregistre ton choix." };
  if (chapter === "launch") return { complete: !!state.game, instruction: "Vérifie les participants, les cartes et les factures prévues. Confirme le départ commun." };
  if (chapter === "culture") return { complete: state.game?.phase === "complete" && !isKqCultureDead(state.game) && state.game.history.length === 6 && state.milestones.includes("health-read") && state.milestones.includes("recap-read"),
    instruction: "Observe, prépare si tu le souhaites, lance, réagis et valide. Le suivi gratuit explique les effets au prochain bilan." };
  const harvests = getKqReleveHarvests(state);
  return { complete: harvests.length > 0 && harvests.every(item => item.battle?.status === "verdict" && state.milestones.includes(`jury-read:${item.zoneId}`)),
    instruction: "Présente chaque Fleur au jury et découvre ses trois manches. Le lot commercial reste dans la ferme après le duel." };
}
