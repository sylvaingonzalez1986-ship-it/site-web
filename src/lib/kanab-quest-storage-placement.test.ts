import { describe, expect, it } from 'vitest';
import type { KqStorageSnapshot } from './kanab-quest-api';
import { createKqOperationsLesson, getKqOperationsStorage } from './kanab-quest-operations-lesson';
import { createKqStorageLot, getKqStorageContainer, projectKqStorageLot, type KqStorageAllocation } from './kanab-quest-storage';
import { getKqStoragePlacementAvailability } from './kanab-quest-storage-placement';

const lesson = createKqOperationsLesson('warehouse');
const now = Date.parse('2026-10-29T12:00:00Z');
const glass = getKqStorageContainer('GLASS-1L')!.capacityUnits;
function snapshot(installed: Record<string, number>, lots: { id: string; units: number; allocations?: KqStorageAllocation[] }[]): KqStorageSnapshot {
  return { ...getKqOperationsStorage(lesson), installedContainers: installed, ownedContainers: { ...installed, 'GLASS-3L': 100 },
    lots: lots.map(item => ({ flowerId: item.id, varietyName: item.id, flowerStatus: 'available', harvestGrams: item.units / 10,
      projection: projectKqStorageLot(createKqStorageLot({ flowerId: item.id, harvestedAt: new Date(now).toISOString(), baseline: lesson.storage.lot.baseline,
        capacity: { totalUnits: item.units, allocations: item.allocations ?? [], automaticOverflowSale: false, overflowDeadlineAt: null } }), now),
    })),
  };
}

describe('placement action uses the known reservations of the exact lot', () => {
  it('offers a choice when an installed model holds the entire lot, without changing its reservations', () => {
    const state = snapshot({ 'GLASS-1L': 2 }, [{ id: 'a', units: glass * 2 }]);
    const original = structuredClone(state);
    expect(getKqStoragePlacementAvailability(state, 'a').status).toBe('available');
    expect(state).toEqual(original);
  });

  it('does not count purchased but uninstalled equipment as usable', () => {
    expect(getKqStoragePlacementAvailability(snapshot({}, [{ id: 'a', units: glass }]), 'a').status).toBe('insufficient');
  });

  it('keeps another variety’s reserved container unavailable while allowing this lot’s own reuse', () => {
    const state = snapshot({ 'GLASS-1L': 2 }, [
      { id: 'a', units: glass, allocations: [{ containerCode: 'GLASS-1L', quantity: 1, storedUnits: glass }] },
      { id: 'b', units: glass, allocations: [{ containerCode: 'GLASS-1L', quantity: 1, storedUnits: glass }] },
      { id: 'c', units: 1 },
    ]);
    expect(getKqStoragePlacementAvailability(state, 'a').status).toBe('available');
    expect(getKqStoragePlacementAvailability(state, 'c').status).toBe('insufficient');
  });

  it('does not add different models together when placement requires one model for the whole lot', () => {
    const other = getKqStorageContainer('BOVEDA-1L')!.capacityUnits;
    expect(getKqStoragePlacementAvailability(snapshot({ 'GLASS-1L': 1, 'BOVEDA-1L': 1 }, [{ id: 'a', units: glass + other }]), 'a').status).toBe('insufficient');
  });

  it('does not recommend buying equipment from partial or inconsistent reservation data', () => {
    const state = snapshot({ 'GLASS-1L': 2 }, [{ id: 'a', units: glass }, { id: 'b', units: glass }]);
    const partial = structuredClone(state);
    delete (partial.lots[1].projection.capacity as Partial<typeof partial.lots[1]['projection']['capacity']>)!.allocations;
    expect(getKqStoragePlacementAvailability(partial, 'a')).toEqual({ inventory: null, status: 'unknown' });
    const overbooked = snapshot({ 'GLASS-1L': 1 }, [
      { id: 'a', units: glass, allocations: [{ containerCode: 'GLASS-1L', quantity: 1, storedUnits: glass }] },
      { id: 'b', units: glass, allocations: [{ containerCode: 'GLASS-1L', quantity: 1, storedUnits: glass }] },
    ]);
    expect(getKqStoragePlacementAvailability(overbooked, 'a').status).toBe('unknown');
  });

  it('distinguishes missing inventory, a missing lot and an empty lot from insufficient capacity', () => {
    const state = snapshot({}, [{ id: 'empty', units: 0 }]);
    expect(getKqStoragePlacementAvailability(state, 'empty').status).toBe('empty');
    expect(getKqStoragePlacementAvailability(state, 'missing').status).toBe('unknown');
    expect(getKqStoragePlacementAvailability(null, 'empty').status).toBe('unknown');
    state.installedContainers = undefined;
    expect(getKqStoragePlacementAvailability(state, 'empty').status).toBe('unknown');
  });

  it('retains the historical installed-inventory shape when no separate installed field exists', () => {
    const state = snapshot({ 'GLASS-1L': 1 }, [{ id: 'a', units: glass }]);
    delete state.installedContainers;
    state.ownedContainers = { 'GLASS-1L': 1 };
    expect(getKqStoragePlacementAvailability(state, 'a').status).toBe('available');
  });
});
