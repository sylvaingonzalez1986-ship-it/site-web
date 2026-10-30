import type { ArenaLearningStorage } from './arena-introduction';
import { KQ_BUDDIES, KQ_STAGES, type KqGameState } from './kanab-quest-game';
import { createKqFirstCulture, reduceKqFirstCulture, type KqFirstCultureAction } from './kanab-quest-first-culture';
import { createKqFlower, createKqOpponent, lockKqBattle, resolveKqBattle, type KqBattle } from './kanab-quest-battle';
import { applyKqStorageToJury, changeKqStorageCapacity, createKqStorageLot, getKqStorageContainer, planKqStoragePlacement, projectKqStorageLot, type KqStorageLot } from './kanab-quest-storage';
import { getKqJuryScoreFromStats, type KqMarketRouteCode } from './kanab-quest-market';
import { applyReleveCommerceRequest, createReleveCommerce, getReleveCommerceSnapshot, type KqReleveCommerceState } from './kanab-quest-releve-commerce';
import type { KqCommerceOffer, KqSalesChannel } from './kanab-quest-commerce';

export const ARENA_QUICK_TRIAL_KEY = 'arena-quick-trial-v1';
export const ARENA_QUICK_TRIAL_VERSION = 1;
export const QUICK_TRIAL_BUDDIES = KQ_BUDDIES.filter(buddie => buddie.rarity === 'gold').slice(0, 2);
export const QUICK_TRIAL_CONTAINERS = ['GLASS-3L', 'BOVEDA-1L'] as const;
export type QuickTrialStep = 'variety' | 'culture' | 'storage' | 'curing' | 'jury' | 'verdict' | 'prepare' | 'sale' | 'confirm' | 'complete';
export type QuickTrialOffer = { quoteId: string; offer: KqCommerceOffer; netPayoutCents: number; vatCents: number; electricityPaidCents: number; labPaidCents: number; supplierPaidCents?: number };
export type ArenaQuickTrialState = {
  step: QuickTrialStep; game: KqGameState | null; clock: number; storage: KqStorageLot | null;
  battle: KqBattle | null; commerce: KqReleveCommerceState | null; offer: QuickTrialOffer | null;
};
export type ArenaQuickTrialAction =
  | { type: 'start'; varietyCode: string }
  | { type: 'culture'; action: KqFirstCultureAction }
  | { type: 'store'; containerCode: typeof QUICK_TRIAL_CONTAINERS[number] }
  | { type: 'mature' } | { type: 'jury' } | { type: 'open-market' }
  | { type: 'prepare'; route: KqMarketRouteCode }
  | { type: 'quote'; channel: KqSalesChannel; units: number }
  | { type: 'cancel-sale' } | { type: 'sell' };
export type ArenaQuickTrialJournal = { state: ArenaQuickTrialState; actions: ArenaQuickTrialAction[] };

export function createArenaQuickTrial(): ArenaQuickTrialState {
  return { step: 'variety', game: null, clock: Date.parse('2026-10-07T12:00:00Z'), storage: null, battle: null, commerce: null, offer: null };
}

export function getQuickTrialContainers(state: ArenaQuickTrialState) {
  const units = state.storage?.capacity?.totalUnits ?? 0;
  return QUICK_TRIAL_CONTAINERS.map(code => {
    const container = getKqStorageContainer(code)!;
    return { ...container, quantity: Math.ceil(units / container.capacityUnits) };
  });
}

function commerceAction(state: KqReleveCommerceState, body: Record<string, unknown>) {
  return applyReleveCommerceRequest(state, { path: '/api/arena/placard/commerce', method: 'POST', body });
}

/** A short orchestration of existing engines; no player API, account balance or timers. */
export function reduceArenaQuickTrial(state: ArenaQuickTrialState, action: ArenaQuickTrialAction): ArenaQuickTrialState {
  switch (action.type) {
    case 'start':
      if (state.step !== 'variety' || !QUICK_TRIAL_BUDDIES.some(buddie => buddie.code === action.varietyCode)) return state;
      return { ...state, step: 'culture', game: createKqFirstCulture(action.varietyCode) };
    case 'culture': {
      if (state.step !== 'culture' || !state.game) return state;
      const game = reduceKqFirstCulture(state.game, action.action);
      if (game === state.game) return state;
      if (game.phase !== 'complete') return { ...state, game };
      const flower = createKqFlower(game, 'Essai court');
      const storage = createKqStorageLot({ flowerId: 'quick-trial-flower', harvestedAt: game.completedAt!, preJury: true,
        baseline: { varietyCode: game.varietyCode, juryScore: getKqJuryScoreFromStats(flower.stats), aroma: flower.stats.aroma, care: game.care! },
        capacity: { totalUnits: Math.round(game.harvestGrams! * 10), allocations: [], automaticOverflowSale: false, overflowDeadlineAt: null } });
      return { ...state, game, storage, step: 'storage' };
    }
    case 'store': {
      if (state.step !== 'storage' || !state.storage || !QUICK_TRIAL_CONTAINERS.includes(action.containerCode)) return state;
      const capacity = planKqStoragePlacement({ capacity: state.storage.capacity!, containerCode: action.containerCode,
        ownedContainers: Object.fromEntries(getQuickTrialContainers(state).map(item => [item.code, item.quantity])) });
      return { ...state, storage: changeKqStorageCapacity(state.storage, capacity, state.clock), step: 'curing' };
    }
    case 'mature':
      if (state.step !== 'curing' || !state.storage) return state;
      return { ...state, clock: Date.parse(state.storage.readyAt), step: 'jury' };
    case 'jury': {
      if (state.step !== 'jury' || !state.game || !state.storage || projectKqStorageLot(state.storage, state.clock).stage !== 'ready') return state;
      const flower = createKqFlower(state.game, 'Essai court');
      const prepared = applyKqStorageToJury(state.storage, Object.fromEntries(Object.entries(flower.stats).filter((entry): entry is [string, number] => typeof entry[1] === 'number')), state.clock);
      const opponent = { ...createKqOpponent(2026, { rulesVersion: 3, ownerName: 'Sylvain · essai' }), createdAt: new Date(state.clock).toISOString() };
      const battle = resolveKqBattle(lockKqBattle({ ...flower, stats: prepared.stats as typeof flower.stats }, opponent, 2026), 2026, new Date(state.clock));
      return { ...state, storage: prepared.lot, battle, step: 'verdict' };
    }
    case 'open-market': {
      if (state.step !== 'verdict' || !state.game || !state.battle || !state.storage) return state;
      const commerce = createReleveCommerce({ cashCents: 0, clock: state.clock,
        harvests: [{ zoneId: 'quick-trial', game: state.game, battle: state.battle, storage: state.storage }] });
      commerce.operations.storage.ownedContainers = Object.fromEntries(getQuickTrialContainers(state).map(item => [item.code, item.quantity]));
      return { ...state, step: 'prepare', commerce };
    }
    case 'prepare': {
      if (state.step !== 'prepare' || !state.commerce) return state;
      const raw = getReleveCommerceSnapshot(state.commerce).rawLots[0];
      const route = raw?.options.find(option => option.route === action.route && option.available);
      if (!route) return state;
      const prepared = commerceAction(state.commerce, { action: 'prepare', flowerId: raw.flowerId, route: route.route, expectedCostCents: route.market?.processingCostCents ?? 0 });
      return { ...state, commerce: prepared.state, step: 'sale' };
    }
    case 'quote': {
      if (state.step !== 'sale' || !state.commerce || !['wholesale', 'cbd-shop'].includes(action.channel) || !Number.isSafeInteger(action.units) || action.units <= 0) return state;
      const stock = getReleveCommerceSnapshot(state.commerce).stocks.find(stock => stock.remainingUnits > 0);
      if (!stock) return state;
      const quoted = commerceAction(state.commerce, { action: 'quote', stockId: stock.id, channel: action.channel, policy: 'advised', units: action.units });
      return { ...state, commerce: quoted.state, offer: quoted.payload as QuickTrialOffer, step: 'confirm' };
    }
    case 'cancel-sale': return state.step === 'confirm' ? { ...state, offer: null, step: 'sale' } : state;
    case 'sell': {
      if (state.step !== 'confirm' || !state.commerce || !state.offer) return state;
      const sold = commerceAction(state.commerce, { action: 'sell', quoteId: state.offer.quoteId, expectedPayoutCents: state.offer.offer.payoutCents, requestKey: 'quick-trial-first-sale' });
      return { ...state, commerce: sold.state, step: 'complete' };
    }
  }
  return state;
}

export function restoreArenaQuickTrial(value: unknown): ArenaQuickTrialJournal | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { version?: unknown; actions?: unknown };
  if (row.version !== ARENA_QUICK_TRIAL_VERSION || !Array.isArray(row.actions) || row.actions.length > 120) return null;
  try {
    let state = createArenaQuickTrial();
    const actions: ArenaQuickTrialAction[] = [];
    for (const action of row.actions) {
      if (!action || typeof action !== 'object') return null;
      const next = reduceArenaQuickTrial(state, action as ArenaQuickTrialAction);
      if (next === state) return null;
      state = next; actions.push(action as ArenaQuickTrialAction);
    }
    return { state, actions };
  } catch { return null; }
}

export function getQuickTrialStepLabel(state: ArenaQuickTrialState): string {
  if (state.step === 'culture' && state.game) return `Culture · ${KQ_STAGES[state.game.stageIndex]}`;
  return ({ variety: 'Choisir ma variété', culture: 'Culture', storage: 'Ranger ma récolte', curing: 'Affinage', jury: 'Présenter la Fleur au jury', verdict: 'Résultat du jury', prepare: 'Préparer ma vente', sale: 'Choisir une offre', confirm: 'Confirmer la vente', complete: 'Première vente accomplie' })[state.step];
}

export function readArenaQuickTrialResume(storage?: Pick<ArenaLearningStorage, 'getItem'>) {
  try {
    const saved = storage?.getItem(ARENA_QUICK_TRIAL_KEY);
    const restored = saved ? restoreArenaQuickTrial(JSON.parse(saved)) : null;
    return restored?.actions.length ? { step: restored.state.step, label: getQuickTrialStepLabel(restored.state), completed: restored.state.step === 'complete' } : null;
  } catch { return null; }
}

/** This store requires the account-scoped learning adapter. There is no unscoped fallback. */
export function createArenaQuickTrialSession(storage?: ArenaLearningStorage) {
  let snapshot: ArenaQuickTrialJournal & { warning: string; error: string } = { state: createArenaQuickTrial(), actions: [], warning: '', error: '' };
  const server = snapshot;
  const listeners = new Set<() => void>();
  try {
    if (!storage) throw new Error('No scoped storage');
    const saved = storage.getItem(ARENA_QUICK_TRIAL_KEY);
    const restored = saved ? restoreArenaQuickTrial(JSON.parse(saved)) : null;
    if (restored) snapshot = { ...snapshot, ...restored };
    else if (saved) snapshot.warning = 'Cette sauvegarde d’essai est illisible. Un nouvel essai est prêt ; ta partie est inchangée.';
  } catch { snapshot.warning = 'Sauvegarde locale indisponible : garde cette fenêtre ouverte pour conserver cet essai.'; }
  const notify = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => server,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    play(action: ArenaQuickTrialAction) {
      try {
        const state = reduceArenaQuickTrial(snapshot.state, action);
        if (state === snapshot.state) return;
        const actions = [...snapshot.actions, action];
        let warning = snapshot.warning;
        try {
          if (!storage) throw new Error('No scoped storage');
          storage.setItem(ARENA_QUICK_TRIAL_KEY, JSON.stringify({ version: ARENA_QUICK_TRIAL_VERSION, actions }));
          warning = '';
        }
        catch { warning = 'Ta progression est conservée dans cette fenêtre, mais ne peut pas être enregistrée pour plus tard.'; }
        snapshot = { state, actions, warning, error: '' };
      } catch (error) { snapshot = { ...snapshot, error: error instanceof Error ? error.message : 'Cette action est indisponible.' }; }
      notify();
    },
  };
}
