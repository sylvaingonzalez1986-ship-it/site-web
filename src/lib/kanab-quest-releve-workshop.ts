import { createKqWorkshop } from './kanab-quest-workshops';
import { createKqWarehouseStarter, getKqWarehouseRunSnapshot } from './kanab-quest-warehouse';
import { getKqMachineCondition } from './kanab-quest-maintenance';
import { applyReleveCommerceRequest, createReleveCommerce, getReleveCommerceSnapshot, type KqReleveCommerceState } from './kanab-quest-releve-commerce';

export type KqReleveWorkshopState = {
  version: 1;
  commerce: KqReleveCommerceState;
  careerRead: boolean;
  maintenanceRead: boolean;
};
export const KQ_RELEVE_WORKSHOP_STORAGE_KEY = 'arena-releve-workshop-v1';

/** A labelled loan for a separate exercise; never merged into the player's farm. */
export function createKqReleveWorkshop(): KqReleveWorkshopState {
  const trial = createKqWorkshop('market');
  const game = { ...trial.game!, harvestGrams: 200, warehouse: getKqWarehouseRunSnapshot(createKqWarehouseStarter()) };
  let commerce = createReleveCommerce({ cashCents: 500_000, clock: trial.clock, harvests: [{ zoneId: 'workshop', game, battle: trial.battle }] });
  commerce.lots[0].name = 'Lot de démonstration de Sylvain · prêt de 200 g';
  commerce.lots[0].assistance = true;
  Object.assign(commerce.operations.shared, {
    ownedCodes: ['SIFT-TRAY'], purchasedCodes: [], equippedCodes: ['SIFT-TRAY'], levels: { 'SIFT-TRAY': 1 },
    maintenance: { 'SIFT-TRAY': getKqMachineCondition('SIFT-TRAY', 1, 0)! },
  });
  commerce = applyReleveCommerceRequest(commerce, { path: '/api/releve/commerce', method: 'POST', body: { action: 'mature' } }).state;
  return { version: 1, commerce, careerRead: false, maintenanceRead: false };
}

export function getKqReleveWorkshopProgress(state: KqReleveWorkshopState) {
  const { commerce, clock } = state.commerce.operations.trial;
  const lots = commerce.stocks.filter(stock => stock.batchRoute === 'dry-sift');
  const processing = lots.some(stock => stock.processingReadyAt && Date.parse(stock.processingReadyAt) > clock);
  const transformed = lots.length > 0 && !processing;
  return { transformed, processing, complete: transformed && state.careerRead && state.maintenanceRead };
}

/** A damaged local save is rejected before it reaches a live game screen. */
export function readKqReleveWorkshop(value: unknown): KqReleveWorkshopState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as KqReleveWorkshopState;
  if (state.version !== 1 || typeof state.careerRead !== 'boolean' || typeof state.maintenanceRead !== 'boolean'
    || state.commerce?.version !== 1 || !Array.isArray(state.commerce.lots) || state.commerce.lots.length !== 1
    || state.commerce.lots[0].id !== 'releve-workshop') return null;
  try {
    const snapshot = getReleveCommerceSnapshot(state.commerce);
    if (!Number.isSafeInteger(snapshot.cashCents) || snapshot.cashCents < 0
      || !state.commerce.operations.shared.maintenance['SIFT-TRAY']
      || !state.commerce.operations.shared.equippedCodes.includes('SIFT-TRAY')) return null;
    getKqReleveWorkshopProgress(state);
    return state;
  } catch { return null; }
}
