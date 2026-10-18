import { ARENA_RELEVE_CHAPTERS } from './arena-releve';
import { createKqReleveProduction, getKqReleveHarvests, getKqReleveProductionProgress, type KqReleveProductionState } from './kanab-quest-releve-production';
import { createReleveCommerce, getReleveCommerceCash, getReleveCommerceProgress, getReleveCommerceSnapshot, type KqReleveCommerceState } from './kanab-quest-releve-commerce';
import { isKqWarehouseState } from './kanab-quest-warehouse';
import { encodeKqSave, parseKqGameSave, parseKqBattleSave } from './kanab-quest-persistence';

export const ARENA_RELEVE_STORAGE_KEY = 'arena-releve-session-v1';
export type ReleveRenovation = 'locked' | 'opened' | 'emptied' | 'renovated';
export type ArenaReleveCheckpoint = {
  chapter: number;
  renovation: ReleveRenovation;
  production: KqReleveProductionState;
  commerce: KqReleveCommerceState | null;
  completed: boolean;
};
export type ArenaReleveSessionState = ArenaReleveCheckpoint & {
  version: 1;
  checkpoint: ArenaReleveCheckpoint;
};
type Backing = Pick<Storage, 'getItem' | 'setItem'>;
export type ArenaReleveSessionSnapshot = { state: ArenaReleveSessionState; storageWarning: string };

function checkpoint(state: ArenaReleveCheckpoint): ArenaReleveCheckpoint {
  return structuredClone({ chapter: state.chapter, renovation: state.renovation, production: state.production, commerce: state.commerce, completed: state.completed });
}

export function createArenaReleveState(): ArenaReleveSessionState {
  const state: ArenaReleveCheckpoint = { chapter: 0, renovation: 'locked', production: createKqReleveProduction(), commerce: null, completed: false };
  return { ...state, version: 1, checkpoint: checkpoint(state) };
}

export function getArenaReleveProgress(state: ArenaReleveSessionState) {
  const stage = ARENA_RELEVE_CHAPTERS[state.chapter].stage;
  if (stage === 'arrival') return { complete: state.renovation === 'renovated', instruction: state.renovation === 'renovated' ? 'La chambre est prête. Il reste à choisir ton installation.' : '' };
  if (stage === 'delivery' || stage === 'shop' || stage === 'ledger') {
    return state.commerce ? getReleveCommerceProgress(state.commerce, stage) : { complete: false, instruction: 'Retrouvons la récolte avant de poursuivre.' };
  }
  return getKqReleveProductionProgress(stage, state.production);
}

export function advanceArenaReleve(state: ArenaReleveSessionState): ArenaReleveSessionState {
  if (!getArenaReleveProgress(state).complete) return state;
  if (state.chapter === ARENA_RELEVE_CHAPTERS.length - 1) return { ...state, completed: true };
  const chapter = state.chapter + 1;
  const commerce = ARENA_RELEVE_CHAPTERS[chapter].stage === 'delivery' && !state.commerce
    ? createReleveCommerce({ cashCents: state.production.cashCents, clock: state.production.clock, harvests: getKqReleveHarvests(state.production), ledger: state.production.ledger })
    : state.commerce;
  const next = { ...state, chapter, commerce };
  return { ...next, checkpoint: checkpoint(next) };
}

export function restartArenaReleveChapter(state: ArenaReleveSessionState): ArenaReleveSessionState {
  return { ...state, ...structuredClone(state.checkpoint), completed: false };
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function validCheckpoint(value: unknown): value is ArenaReleveCheckpoint {
  if (!record(value) || !Number.isInteger(value.chapter) || Number(value.chapter) < 0 || Number(value.chapter) >= ARENA_RELEVE_CHAPTERS.length) return false;
  if (!['locked', 'opened', 'emptied', 'renovated'].includes(String(value.renovation)) || typeof value.completed !== 'boolean') return false;
  if (Number(value.chapter) > 0 && value.renovation !== 'renovated') return false;
  const p = value.production;
  if (!record(p) || p.version !== 1 || !Number.isSafeInteger(p.cashCents) || Number(p.cashCents) < 0 || !Number.isFinite(p.clock)) return false;
  if (!isKqWarehouseState(p.warehouse) || !record(p.draftWarehouse) || !Array.isArray(p.draftWarehouse.zones) || !Array.isArray(p.draftWarehouse.equipment)) return false;
  if (!Array.isArray(p.ownedBuddies) || !Array.isArray(p.milestones) || !Array.isArray(p.ledger) || !record(p.battles) || !record(p.revealedRounds)) return false;
  if (!Array.isArray(p.recentBuddieCodes) || !record(p.supportInventory) || !record(p.careInventory) || !Array.isArray(p.deckCodes)) return false;
  if (p.game !== null && !parseKqGameSave(encodeKqSave(p.game))) return false;
  if (Object.values(p.battles).some(battle => !parseKqBattleSave(encodeKqSave(battle)))) return false;
  if (Number(value.chapter) >= 6 && !record(value.commerce)) return false;
  return value.commerce === null || record(value.commerce);
}

export function restoreArenaReleveState(value: unknown): ArenaReleveSessionState | null {
  if (!record(value) || value.version !== 1) return null;
  const savedCheckpoint = value.checkpoint;
  if (!validCheckpoint(value) || !validCheckpoint(savedCheckpoint)) return null;
  if (savedCheckpoint.chapter !== value.chapter) return null;
  try {
    // Verify that the current engine can interpret this version before exposing it.
    getArenaReleveProgress(value as ArenaReleveSessionState);
    getArenaReleveProgress({ ...value, ...savedCheckpoint } as ArenaReleveSessionState);
    for (const commerce of [value.commerce, savedCheckpoint.commerce]) if (commerce) {
      if (commerce.version !== 1 || !Number.isSafeInteger(getReleveCommerceCash(commerce)) || getReleveCommerceCash(commerce) < 0) return null;
      getReleveCommerceSnapshot(commerce);
    }
    return value as ArenaReleveSessionState;
  } catch { return null; }
}

/** Own key and memory fallback. This store never reads or writes a player save. */
export function createArenaReleveSession(backing?: Backing) {
  let snapshot: ArenaReleveSessionSnapshot = { state: createArenaReleveState(), storageWarning: '' };
  const serverSnapshot = snapshot;
  const listeners = new Set<() => void>();
  let storage = backing;
  try {
    if (!storage && typeof window !== 'undefined') storage = window.localStorage;
    const saved = storage?.getItem(ARENA_RELEVE_STORAGE_KEY);
    if (saved) {
      const restored = restoreArenaReleveState(JSON.parse(saved));
      snapshot = restored ? { state: restored, storageWarning: '' } : { ...snapshot, storageWarning: 'Cette ancienne sauvegarde d’essai n’est plus compatible. Une nouvelle aventure est prête.' };
    }
  } catch {
    snapshot = { ...snapshot, storageWarning: 'La sauvegarde locale est indisponible. Tu peux jouer, mais garde cette fenêtre ouverte pour conserver ta progression.' };
  }
  const update = (next: ArenaReleveSessionState | ((current: ArenaReleveSessionState) => ArenaReleveSessionState)) => {
    const state = typeof next === 'function' ? next(snapshot.state) : next;
    if (state === snapshot.state) return;
    let storageWarning = snapshot.storageWarning;
    try { storage?.setItem(ARENA_RELEVE_STORAGE_KEY, JSON.stringify(state)); }
    catch { storageWarning = 'Ta progression reste disponible ici, mais ce navigateur ne peut pas l’enregistrer pour plus tard.'; }
    snapshot = { state, storageWarning };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update,
    restart: () => update(createArenaReleveState()),
  };
}
