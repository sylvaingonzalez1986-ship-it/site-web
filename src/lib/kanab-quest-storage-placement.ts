import type { KqStorageSnapshot } from './kanab-quest-api';
import { getKqStorageInventory, isKqStorageCapacity, type KqStorageContainerInventory } from './kanab-quest-storage';

/** Availability for this lot, including its reusable containers. Purchased but
 * uninstalled containers and reservations belonging to other lots cannot be used. */
export function getKqStoragePlacementAvailability(snapshot: KqStorageSnapshot | null, flowerId: string): {
  inventory: KqStorageContainerInventory[] | null;
  status: 'available' | 'insufficient' | 'unknown' | 'empty';
} {
  const unknown = { inventory: null, status: 'unknown' as const };
  if (!snapshot || !Array.isArray(snapshot.lots)) return unknown;
  const lot = snapshot.lots.find(item => item.flowerId === flowerId);
  const installed = 'installedContainers' in snapshot ? snapshot.installedContainers : snapshot.ownedContainers;
  if (!lot || !installed || !isKqStorageCapacity(lot.projection?.capacity)
    || snapshot.lots.some(item => !Array.isArray(item.projection?.capacity?.allocations))) return unknown;
  try {
    // Validate the entire ledger before releasing this lot's own reservations.
    getKqStorageInventory(installed, snapshot.lots.flatMap(item => item.projection.capacity!.allocations));
    const inventory = getKqStorageInventory(installed, snapshot.lots.filter(item => item.flowerId !== flowerId).flatMap(item => item.projection.capacity!.allocations));
    const units = lot.projection.capacity.totalUnits;
    return { inventory, status: units === 0 ? 'empty' : inventory.some(item => Math.ceil(units / item.capacityUnits) <= item.freeQuantity) ? 'available' : 'insufficient' };
  } catch { return unknown; }
}
