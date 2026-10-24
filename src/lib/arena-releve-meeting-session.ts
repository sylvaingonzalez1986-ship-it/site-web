import { ARENA_RELEVE_MEETINGS, type ArenaReleveMeetingId } from './arena-releve';
import type { ArenaPlayableLessonId } from './arena-playable-learning';
import { createKqReleveExpansion, getKqRelevePlanReview, getKqReleveProductionProgress, type KqReleveProductionState } from './kanab-quest-releve-production';
import { createReleveCommerceBusiness, createReleveCommerceSocial, createReleveCommerceMerch, getReleveCommerceCash, getReleveCommerceProgress, getReleveCommerceSnapshot, getReleveCommerceTreasury, type KqReleveCommerceState } from './kanab-quest-releve-commerce';
import { isKqWarehouseState } from './kanab-quest-warehouse';
import { encodeKqSave, parseKqBattleSave, parseKqGameSave } from './kanab-quest-persistence';

export type ReleveMeetingState = {
  production: KqReleveProductionState;
  business: KqReleveCommerceState | null;
  completed: ArenaPlayableLessonId[];
};
export type ReleveMeetingSnapshot = { state: ReleveMeetingState; storageWarning: string };
type Backing = Pick<Storage, 'getItem' | 'setItem'>;

export const releveMeetingStorageKey = (meeting: ArenaReleveMeetingId) => `arena-releve-meeting-${meeting}-v1`;
function initialState(meeting: ArenaReleveMeetingId): ReleveMeetingState {
  return { production: createKqReleveExpansion(), business: meeting === 'merch' ? createReleveCommerceMerch() : meeting === 'social' ? createReleveCommerceSocial() : meeting === 'business' ? createReleveCommerceBusiness() : null, completed: [] };
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function quantities(value: unknown): boolean { return record(value) && Object.values(value).every(item => Number.isSafeInteger(item) && Number(item) >= 0); }
function validLedger(value: unknown): boolean {
  return Array.isArray(value) && value.every(row => record(row) && typeof row.id === 'string' && typeof row.label === 'string'
    && ['equipment', 'care', 'supplier', 'energy', 'lab'].includes(String(row.kind)) && ['paid', 'due'].includes(String(row.status))
    && Number.isSafeInteger(row.amountCents) && Number(row.amountCents) >= 0 && typeof row.issuedAt === 'string' && Number.isFinite(Date.parse(row.issuedAt))
    && (row.dueAt === undefined || typeof row.dueAt === 'string' && Number.isFinite(Date.parse(row.dueAt))));
}
function validDraft(value: unknown): boolean {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.zones) || !Array.isArray(value.equipment)) return false;
  if (value.floor !== undefined && (!record(value.floor) || value.floor.columns !== 10 || value.floor.rows !== 10)) return false;
  if (!Number.isSafeInteger(value.preparedAreaM2) || Number(value.preparedAreaM2) < 0) return false;
  const rectangle = (row: unknown) => record(row) && typeof row.id === 'string' && typeof row.name === 'string'
    && ['x', 'y', 'width', 'height'].every(key => Number.isInteger(row[key]));
  if (!value.zones.every(row => rectangle(row) && record(row) && typeof row.active === 'boolean'
    && typeof row.lightingCode === 'string' && typeof row.airCode === 'string'
    && (row.buddieCode === undefined || typeof row.buddieCode === 'string') && (row.optionCodes === undefined || strings(row.optionCodes)))) return false;
  if (value.serviceZones !== undefined && (!Array.isArray(value.serviceZones) || !value.serviceZones.every(row => rectangle(row) && record(row)
    && ['drying', 'storage'].includes(String(row.kind)) && typeof row.deviceCode === 'string'))) return false;
  const equipment = (rows: unknown) => Array.isArray(rows) && rows.every(row => record(row) && typeof row.code === 'string' && Number.isSafeInteger(row.quantity) && Number(row.quantity) >= 0);
  return equipment(value.equipment) && (value.optionInventory === undefined || equipment(value.optionInventory));
}
function validProduction(value: unknown): value is KqReleveProductionState {
  if (!record(value) || value.version !== 1 || !Number.isSafeInteger(value.cashCents) || Number(value.cashCents) < 0
    || !Number.isFinite(value.clock) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0
    || !isKqWarehouseState(value.warehouse) || !validDraft(value.draftWarehouse)
    || !strings(value.ownedBuddies) || !strings(value.recentBuddieCodes) || !strings(value.deckCodes) || !strings(value.milestones)
    || !quantities(value.supportInventory) || !quantities(value.careInventory) || !quantities(value.revealedRounds)
    || !record(value.battles) || !validLedger(value.ledger)
    || !(value.heritageCode === null || typeof value.heritageCode === 'string')) return false;
  if (value.game !== null && !parseKqGameSave(encodeKqSave(value.game))) return false;
  if (Object.values(value.battles).some(battle => !parseKqBattleSave(encodeKqSave(battle)))) return false;
  if (value.checkpoint !== null) {
    const point = value.checkpoint;
    if (!record(point) || !parseKqGameSave(encodeKqSave(point.game)) || !Number.isSafeInteger(point.cashCents)
      || Number(point.cashCents) < 0 || !quantities(point.supportInventory) || !quantities(point.careInventory) || !validLedger(point.ledger)) return false;
  }
  return true;
}

function restore(meeting: ArenaReleveMeetingId, raw: string): ReleveMeetingState | null {
  try {
    const saved: unknown = JSON.parse(raw);
    if (!record(saved) || saved.version !== 1 || saved.meeting !== meeting || !record(saved.state)) return null;
    const state = saved.state;
    if (!validProduction(state.production) || !strings(state.completed)) return null;
    getKqReleveProductionProgress('expansion', state.production);
    // Invalid geometry in an unfinished draft remains editable after a pause.
    getKqRelevePlanReview(state.production);
    if (meeting === 'business' || meeting === 'social' || meeting === 'merch') {
      const business = state.business;
      if (!record(business) || business.version !== 1 || !strings(business.milestones)
        || !validLedger(business.productionLedger) || !Array.isArray(business.journal) || !Array.isArray(business.lots)
        || !record(business.responses) || !Array.isArray(business.wholesaleSales)) return null;
      const value = business as KqReleveCommerceState;
      if (!Number.isSafeInteger(getReleveCommerceCash(value)) || getReleveCommerceCash(value) < 0) return null;
      const commerce = getReleveCommerceSnapshot(value);
      if (!commerce.online || !record(commerce.online.stats) || !record(commerce.online.site)) return null;
      getReleveCommerceProgress(value, meeting); getReleveCommerceTreasury(value);
    } else if (state.business !== null) return null;
    const lessons = ARENA_RELEVE_MEETINGS.find(item => item.id === meeting)!.lessons;
    const completed = state.completed;
    return { production: state.production, business: state.business as KqReleveCommerceState | null,
      completed: lessons.filter(id => completed.includes(id)) };
  } catch { return null; }
}

/** Own key per meeting; the workshop already owns its independent persistent dossier. */
export function createReleveMeetingSession(meeting: ArenaReleveMeetingId, backing?: Backing) {
  let snapshot: ReleveMeetingSnapshot = { state: initialState(meeting), storageWarning: '' };
  const serverSnapshot = snapshot, listeners = new Set<() => void>();
  const key = releveMeetingStorageKey(meeting), persistent = meeting !== 'workshop';
  let storage = persistent ? backing : undefined;
  if (persistent) {
    try {
      if (!storage && typeof window !== 'undefined') storage = window.localStorage;
      const saved = storage?.getItem(key);
      if (saved) {
        const state = restore(meeting, saved);
        snapshot = state ? { state, storageWarning: '' } : { ...snapshot, storageWarning: 'Ce dossier enregistré était incomplet ou incompatible. Sylvain a préparé un nouvel essai pour cette rencontre.' };
      }
    } catch { snapshot = { ...snapshot, storageWarning: 'La sauvegarde de cette rencontre est indisponible. Garde cette fenêtre ouverte pour conserver ton essai.' }; }
  }
  const update = (next: ReleveMeetingState | ((current: ReleveMeetingState) => ReleveMeetingState)) => {
    const state = typeof next === 'function' ? next(snapshot.state) : next;
    if (state === snapshot.state) return;
    let storageWarning = snapshot.storageWarning;
    if (persistent && storage) {
      try { storage.setItem(key, JSON.stringify({ version: 1, meeting, state })); storageWarning = ''; }
      catch { storageWarning = 'Ton dossier reste disponible ici, mais ce navigateur ne peut pas l’enregistrer pour plus tard.'; }
    }
    snapshot = { state, storageWarning };
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update,
    restart: () => update(initialState(meeting)),
  };
}
