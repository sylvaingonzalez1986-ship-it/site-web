import { describe, expect, it } from 'vitest';
import { createChanvrierCareerSnapshot, getChanvrierEquipmentAccess } from './chanvrier-career';
import { applyReleveCommerceRequest, getReleveCommerceSnapshot } from './kanab-quest-releve-commerce';
import { createKqReleveWorkshop, getKqReleveWorkshopProgress, readKqReleveWorkshop } from './kanab-quest-releve-workshop';

describe('Le dossier d’atelier prêté par Sylvain', () => {
  it('lends an identified mature lot, storage and pollinator without bypassing the displayed acquisition rules', () => {
    const state = createKqReleveWorkshop(), snapshot = getReleveCommerceSnapshot(state.commerce);
    expect(snapshot.cashCents).toBe(500_000);
    expect(snapshot.rawLots[0].harvestGrams).toBe(200);
    expect(snapshot.rawLots[0].varietyName).toContain('prêt');
    expect(snapshot.rawLots[0].storage?.capacity?.overflowUnits).toBe(0);
    expect(snapshot.rawLots[0].options.find(row => row.route === 'dry-sift')?.available).toBe(true);
    expect(state.commerce.operations.shared.purchasedCodes).toEqual([]);
    const rule = getChanvrierEquipmentAccess(createChanvrierCareerSnapshot(), 'SIFT-TRAY');
    expect(rule).toMatchObject({ allowed: false, requiredLevel: 3, xpToUnlock: 400 });
  });

  it('transforms the actual lot, charges its quote and advances machine wear before allowing completion', () => {
    const state = createKqReleveWorkshop(), lot = getReleveCommerceSnapshot(state.commerce).rawLots[0];
    const quote = lot.options.find(row => row.route === 'dry-sift')!;
    const result = applyReleveCommerceRequest(state.commerce, { path: '/api/arena/placard/commerce', method: 'POST', body: {
      action: 'prepare', flowerId: lot.flowerId, route: 'dry-sift', expectedCostCents: quote.market!.processingCostCents,
    } });
    const next = { ...state, commerce: result.state };
    expect(getReleveCommerceSnapshot(next.commerce).rawLots).toHaveLength(0);
    expect(next.commerce.operations.trial.commerce.cashCents).toBe(500_000 - quote.market!.processingCostCents);
    expect(next.commerce.operations.trial.commerce.stocks.find(stock => stock.route === 'dry-sift')?.remainingUnits).toBe(Math.round(quote.productGrams * 10));
    expect(next.commerce.operations.shared.maintenance['SIFT-TRAY'].cycles).toBe(1);
    expect(quote.processedInputGrams).toBe(200);
    expect(quote.remainderGrams).toBe(0);
    expect(getKqReleveWorkshopProgress(next)).toEqual({ transformed: false, processing: true, complete: false });
    const finished = { ...next, commerce: applyReleveCommerceRequest(next.commerce, {
      path: '/api/releve/commerce', method: 'POST', body: { action: 'finish-processing' },
    }).state };
    expect(finished.commerce.operations.trial.clock - next.commerce.operations.trial.clock).toBe(2 * 3_600_000);
    expect(getKqReleveWorkshopProgress(finished)).toEqual({ transformed: true, processing: false, complete: false });
    expect(getKqReleveWorkshopProgress({ ...finished, careerRead: true, maintenanceRead: true }).complete).toBe(true);
    expect(state.commerce.operations.shared.maintenance['SIFT-TRAY'].cycles).toBe(0);
  });

  it('restores a valid local dossier and rejects damaged snapshots', () => {
    const state = createKqReleveWorkshop();
    expect(readKqReleveWorkshop(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(readKqReleveWorkshop(null)).toBeNull();
    expect(readKqReleveWorkshop({ ...state, commerce: { version: 1, lots: [{ id: 'releve-workshop' }] } })).toBeNull();
  });

  it('supplies native machine screens with real career gates and repairs the borrowed machine locally', () => {
    const initial = createKqReleveWorkshop().commerce;
    const equipment = applyReleveCommerceRequest(initial, { path: '/api/arena/placard/equipment', method: 'GET', body: {} }).payload as { career: ReturnType<typeof createChanvrierCareerSnapshot>; ownedCodes: string[] };
    expect(equipment.ownedCodes).toContain('SIFT-TRAY');
    expect(getChanvrierEquipmentAccess(equipment.career, 'SIFT-TRAY').allowed).toBe(false);
    const lot = getReleveCommerceSnapshot(initial).rawLots[0], quote = lot.options.find(row => row.route === 'dry-sift')!;
    const used = applyReleveCommerceRequest(initial, { path: '/api/arena/placard/commerce', method: 'POST', body: { action: 'prepare', flowerId: lot.flowerId, route: 'dry-sift', expectedCostCents: quote.market!.processingCostCents } }).state;
    const condition = used.operations.shared.maintenance['SIFT-TRAY'];
    const action = { path: '/api/arena/placard/equipment', method: 'PATCH', body: { action: 'repair', equipmentCode: 'SIFT-TRAY', expectedVersion: condition.version, expectedCostCents: condition.repairCents, requestKey: 'repair-loan' } };
    const repaired = applyReleveCommerceRequest(used, action).state;
    expect(repaired.operations.shared.maintenance['SIFT-TRAY'].cycles).toBe(0);
    expect(repaired.operations.trial.commerce.cashCents).toBe(used.operations.trial.commerce.cashCents - condition.repairCents);
    expect(repaired.operations.shared.purchasedCodes).toEqual([]);
    expect(applyReleveCommerceRequest(repaired, action).state).toBe(repaired);
    expect(() => applyReleveCommerceRequest(used, { ...action, body: { ...action.body, expectedCostCents: 0 } })).toThrow('état');
  });
});
