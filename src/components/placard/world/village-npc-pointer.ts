import type { VillageNpcId } from "./village-npc-types";

/** One click consumes one completed pointer gesture. A drag out and back is still a drag. */
export function createVillageNpcTapGate() {
  const pointers = new Set<number>();
  let gesture: { pointer: number; x: number; y: number; npc?: VillageNpcId; invalid: boolean; released: boolean; consumed: boolean } | null = null;
  return {
    down(pointer: number, x: number, y: number) {
      if (!pointers.size) gesture = { pointer, x, y, invalid: false, released: false, consumed: false };
      pointers.add(pointer);
      if (pointers.size > 1 && gesture) gesture.invalid = true;
    },
    claim(pointer: number, npc: VillageNpcId) { if (gesture?.pointer === pointer) gesture.npc = npc; },
    move(pointer: number, x: number, y: number) {
      if (gesture?.pointer === pointer && Math.hypot(x - gesture.x, y - gesture.y) > 6) gesture.invalid = true;
    },
    up(pointer: number) { pointers.delete(pointer); if (gesture?.pointer === pointer) gesture.released = true; },
    cancel() { pointers.clear(); gesture = null; },
    consume(npc: VillageNpcId) {
      if (!gesture || gesture.invalid || !gesture.released || gesture.consumed || gesture.npc !== npc || pointers.size) return false;
      gesture.consumed = true;
      return true;
    },
  };
}
