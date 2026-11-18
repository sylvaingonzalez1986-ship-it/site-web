import type { KqGameState } from "./kanab-quest-game";
import type { KqCareProblem } from "./kanab-quest-care";

/** Cell coordinates are relative to the saved, already rotated footprint. */
export type KqCareSector = { zoneId: string; x: number; y: number };
export type KqCarePlant = KqCareSector & { slot: 0 | 1 | 2 | 3; severity: 1 | 2 | 3 };
type Layout = Pick<KqGameState, "warehouse" | "campaign">;
export const sectorKey = (s: KqCareSector) => JSON.stringify([s.zoneId, s.x, s.y]);
export const plantKey = (p: KqCarePlant) => JSON.stringify([p.zoneId, p.x, p.y, p.slot]);
export const sameKqCareSector = (a?: KqCareSector, b?: KqCareSector) =>
  a?.zoneId === b?.zoneId && a?.x === b?.x && a?.y === b?.y;

export function isKqCareSector(value: unknown): value is KqCareSector {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as KqCareSector;
  return typeof s.zoneId === "string" && s.zoneId.length > 0 && s.zoneId.length <= 128
    && [s.x, s.y].every(n => Number.isSafeInteger(n) && n >= 0 && n < 40);
}
function cropZones(state: Layout) {
  return state.campaign ? state.campaign.members.flatMap(m => m.warehouse.zones.filter(z => z.id === m.zoneId && z.active))
    : state.warehouse?.zones.filter(z => z.active && z.id !== state.warehouse?.productionReservedZoneId
      && (!state.warehouse?.zoneId || z.id === state.warehouse.zoneId)) ?? [];
}
export function getKqCareSectors(state: Layout): KqCareSector[] {
  return cropZones(state).flatMap(zone => Array.from({ length: zone.width * zone.height }, (_, i) =>
    ({ zoneId: zone.id, x: i % zone.width, y: Math.floor(i / zone.width) })));
}
export function isKqRunSector(state: Layout, s: KqCareSector) {
  return isKqCareSector(s) && cropZones(state).some(z => z.id === s.zoneId && s.x < z.width && s.y < z.height);
}

function draw(seed: number, stage: number, code: string, purpose: string) {
  let hash = 2166136261;
  for (const c of [seed, stage, code, purpose].join("/")) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  return (hash ^ (hash >>> 13)) >>> 0;
}
export function getKqCareProblemPlants(state: Layout & {seed: number}, problem: KqCareProblem): KqCarePlant[] {
  if (problem.plants) return problem.plants;
  const cells = getKqCareSectors(state);
  if (!cells.length) return [];
  const i = draw(state.seed, problem.appearedAt, problem.code, "origin") % (4 * cells.length);
  return [{ ...cells[Math.floor(i / 4)], slot: (i % 4) as KqCarePlant["slot"], severity: problem.severity }];
}

/** A single frontier advances per operation. Adjacent pots can share a cell or
 * touch across two cultivated cells. Empty aisles and other runs break contact. */
export function resolveKqPlantFocus(state: KqGameState, problem: KqCareProblem,
  protection: (p: KqCarePlant) => { reduction: number } | undefined, generalHelp: boolean, failed: boolean) {
  const plants = getKqCareProblemPlants(state, problem);
  const zones = cropZones(state);
  const occupied = new Set(plants.map(plantKey));
  const viable = new Map<string, KqCarePlant>(), exposed = new Map<string, KqCarePlant>();
  const survivors: KqCarePlant[] = [];
  for (const p of plants) {
    const zone = zones.find(z => z.id === p.zoneId);
    if (!zone) continue;
    const shield = protection(p);
    const next = p.severity + Number(failed && !shield) - (shield?.reduction ?? 0) - Number(generalHelp);
    if (next > 0) survivors.push({ ...p, severity: Math.min(3, next) as KqCarePlant["severity"] });
    const col = (zone.x + p.x) * 2 + p.slot % 2, row = (zone.y + p.y) * 2 + Math.floor(p.slot / 2);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = col + dx, y = row + dy;
      const neighbor = zones.find(z => x >= 2*z.x && x < 2*(z.x + z.width) && y >= 2*z.y && y < 2*(z.y + z.height));
      if (!neighbor) continue;
      const newPlant: KqCarePlant = { zoneId: neighbor.id, x: Math.floor(x/2) - neighbor.x, y: Math.floor(y/2) - neighbor.y, slot: ((y%2)*2 + x%2) as KqCarePlant["slot"], severity: 1 };
      const key = plantKey(newPlant);
      if (!occupied.has(key)) (shield || protection(newPlant) ? exposed : viable).set(key, newPlant);
    }
  }
  const escapes = draw(state.seed, state.stageIndex, problem.code, "escape") % 10 === 0;
  const candidates = [...(viable.size ? viable : escapes ? exposed : []).values()];
  if (candidates.length) survivors.push(candidates[draw(state.seed, state.stageIndex, problem.code, "neighbor") % candidates.length]);
  return { plants: survivors, spread: candidates.length > 0 };
}
export const careApplicationKey = (a: { productCode: string; stageIndex: number; target?: KqCareSector }) =>
  JSON.stringify([a.productCode, a.stageIndex, a.target && sectorKey(a.target)]);
