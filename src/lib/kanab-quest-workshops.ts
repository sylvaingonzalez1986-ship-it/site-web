import { canActivateKqHeritage, KQ_CARDS } from "./kanab-quest-game";
import {
  createKqTrial, reduceKqTrial, trialCardPermission,
  type KqTrialAction, type KqTrialState,
} from "./kanab-quest-trial";

export const KQ_WORKSHOP_VERSION = 1;
export const KQ_WORKSHOPS = [
  {
    id: "cards", title: "Tes cartes", description: "Prépare un Buddie, un Héritage et une main de soutien.",
    startChapter: 1, endChapter: 1,
    prerequisites: "Un album de démonstration est prêté. Aucune carte de ta collection n’est utilisée.",
  },
  {
    id: "equipment", title: "Équipement et énergie", description: "Achète, installe et compare les régimes d’énergie.",
    startChapter: 2, endChapter: 3,
    prerequisites: "Les cartes sont déjà préparées. Tu disposes de 2 000 € fictifs et d’un kit de départ.",
  },
  {
    id: "culture", title: "La culture", description: "Joue les six étapes, utilise tes cartes et découvre la récolte.",
    startChapter: 4, endChapter: 5,
    prerequisites: "Buddie, Héritage, cartes et installation sont prêts. La culture reste entièrement fictive.",
  },
  {
    id: "jury", title: "Le jury", description: "Engage un duel fictif et découvre les trois manches.",
    startChapter: 6, endChapter: 6,
    prerequisites: "Une fleur déjà récoltée est prêtée. Le duel ne modifie aucun classement.",
  },
  {
    id: "market", title: "Transformer et vendre", description: "Choisis une filière, compare les circuits et vends ton lot.",
    startChapter: 7, endChapter: 8,
    prerequisites: "Un lot déjà évalué, du matériel, 200 points de réputation, 8 clients et 2 shops fictifs sont prêtés.",
  },
] as const;

export type KqWorkshopId = (typeof KQ_WORKSHOPS)[number]["id"];
export type KqWorkshopSession = { state: KqTrialState; actions: KqTrialAction[] };
export type KqWorkshopSave = { version: typeof KQ_WORKSHOP_VERSION; workshop: KqWorkshopId; actions: KqTrialAction[] };

const WORKSHOP_TIME = "2026-09-16T12:00:00.000Z";
const MAX_WORKSHOP_ACTIONS = 500;

function workshopDefinition(id: KqWorkshopId) {
  const workshop = KQ_WORKSHOPS.find(item => item.id === id);
  if (!workshop) throw new Error("Atelier inconnu.");
  return workshop;
}

// Only workshop states are normalized. The guided v2 journal and official
// engine retain their existing rules, dates and storage format.
function fixedWorkshopDates(state: KqTrialState): KqTrialState {
  return {
    ...state,
    game: state.game?.completedAt ? { ...state.game, completedAt: WORKSHOP_TIME } : state.game,
    battle: state.battle ? {
      ...state.battle,
      playerFlower: { ...state.battle.playerFlower, createdAt: WORKSHOP_TIME },
      opponentFlower: { ...state.battle.opponentFlower, createdAt: WORKSHOP_TIME },
    } : null,
  };
}

/** Supply prerequisites through real tutorial actions, never an account snapshot. */
export function createKqWorkshop(id: KqWorkshopId): KqTrialState {
  const { startChapter } = workshopDefinition(id);
  let state = createKqTrial();
  const apply = (action: KqTrialAction) => {
    const next = reduceKqTrial(state, action);
    if (next === state) throw new Error("Les prérequis de cet atelier sont indisponibles.");
    state = fixedWorkshopDates(next);
  };
  apply({ type: "check", value: "notebook" });
  apply({ type: "next" });
  if (startChapter === 1) return state;
  for (const value of ["buddie", "deck", "heritage"]) apply({ type: "check", value });
  apply({ type: "next" });
  if (startChapter === 2) return state;
  apply({ type: "buy" });
  apply({ type: "next" });
  for (const code of ["LED-300", "DRYING-ROOM", "SIFT-TRAY"]) apply({ type: "install", code });
  apply({ type: "next" });
  if (startChapter === 4) return state;

  // The fixed lesson uses the same legal preparations, PBI and Heritage as the
  // guided culture. Rewards, yield, invoices and the jury score remain derived.
  for (let stage = 0; stage < 6; stage += 1) {
    if (stage === 0) apply({ type: "play", code: "BOTTE-005" });
    if (stage === 2) apply({ type: "play", code: "BOTTE-004" });
    if (stage >= 3) {
      const card = KQ_CARDS.find(item => trialCardPermission(state, item.code).allowed);
      if (card) apply({ type: "play", code: card.code });
    }
    apply({ type: "roll" });
    if (canActivateKqHeritage(state.game!).allowed) apply({ type: "heritage" });
    if (stage === 2 && trialCardPermission(state, "BOTTE-002").allowed) apply({ type: "play", code: "BOTTE-002" });
    apply({ type: "resolve" });
    apply({ type: "advance" });
  }
  apply({ type: "next" });
  if (startChapter === 6) return state;
  apply({ type: "duel" });
  for (let round = 0; round < 3; round += 1) apply({ type: "round" });
  apply({ type: "next" });
  return state;
}

/** Completion applies only to this local exercise, never to the account guide. */
export function isKqWorkshopComplete(id: KqWorkshopId, state: KqTrialState) {
  return state.chapter === workshopDefinition(id).endChapter + 1;
}

export function reduceKqWorkshop(id: KqWorkshopId, state: KqTrialState, action: KqTrialAction): KqTrialState {
  const workshop = workshopDefinition(id);
  if (state.chapter < workshop.startChapter || state.chapter > workshop.endChapter) return state;
  const next = reduceKqTrial(state, action);
  return next === state ? state : fixedWorkshopDates(next);
}

export function kqWorkshopStorageKey(scope: string, id: KqWorkshopId) {
  return `kq-workshop-v${KQ_WORKSHOP_VERSION}:${scope}:${workshopDefinition(id).id}`;
}

/** Rebuild the supplied lesson and replay only this workshop's own actions. */
export function restoreKqWorkshop(id: KqWorkshopId, value: unknown): KqWorkshopSession {
  const empty: KqWorkshopSession = { state: createKqWorkshop(id), actions: [] };
  if (!value || typeof value !== "object") return empty;
  const saved = value as { version?: unknown; workshop?: unknown; actions?: unknown };
  if (saved.version !== KQ_WORKSHOP_VERSION || saved.workshop !== id
    || !Array.isArray(saved.actions) || saved.actions.length > MAX_WORKSHOP_ACTIONS) return empty;
  try {
    let state = empty.state;
    const actions: KqTrialAction[] = [];
    for (const action of saved.actions) {
      if (!action || typeof action !== "object" || Array.isArray(action)) return empty;
      const next = reduceKqWorkshop(id, state, action as KqTrialAction);
      if (next === state) return empty;
      state = next;
      actions.push(action as KqTrialAction);
    }
    return { state, actions };
  } catch {
    return empty;
  }
}
