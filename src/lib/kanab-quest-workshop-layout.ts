import type { KqEquipmentSlot } from "./kanab-quest-equipment";

/** One common metre-based scale for the illustrated workshop, independent of viewport/level.
 * These are plausible scene dimensions for fictional machines, not manufacturer specifications.
 * Small tabletop machines retain their size; their touch targets are enlarged separately.
 */
export const KQ_WORKSHOP_ROOM = { widthM: 5, depthM: 5, floorLeft: 12, floorTop: 12, floorSize: 76 } as const;

export type KqWorkshopPlacement = {
  code: string;
  slot: KqEquipmentSlot;
  label: string;
  xM: number;
  yM: number;
  widthM: number;
  depthM: number;
  bench?: { widthM: number; depthM: number };
  sprite: string;
};

export const KQ_WORKSHOP_PLACEMENTS: readonly KqWorkshopPlacement[] = [
  { code: "SIFT-TRAY", slot: "sifting", label: "Tamis", xM: .95, yM: 1.15, widthM: .65, depthM: .5, bench: { widthM: 1.15, depthM: .7 }, sprite: "sift" },
  { code: "WASHER-25L", slot: "washing", label: "Laveuse", xM: 2.5, yM: 1.15, widthM: .5, depthM: .5, sprite: "washer" },
  { code: "AUTO-SIEVE", slot: "filtration", label: "Collecteur", xM: 4.05, yM: 1.15, widthM: .6, depthM: .6, sprite: "collector" },
  { code: "STATIC-PLASMA", slot: "static-separation", label: "Séparateur", xM: 4.05, yM: 3.5, widthM: 1.05, depthM: .65, sprite: "separator" },
  { code: "PRESS-0600", slot: "press", label: "Presse", xM: .95, yM: 3.5, widthM: .24, depthM: .24, bench: { widthM: 1.15, depthM: .7 }, sprite: "press" },
  { code: "FREEZE-DRYER", slot: "drying", label: "Sécheur", xM: 2.5, yM: 3.5, widthM: .75, depthM: .9, sprite: "dryer" },
];

export function getKqWorkshopPlacementStyle(placement: KqWorkshopPlacement) {
  const scale = KQ_WORKSHOP_ROOM.floorSize / KQ_WORKSHOP_ROOM.widthM;
  return {
    left: `${KQ_WORKSHOP_ROOM.floorLeft + placement.xM * scale}%`,
    top: `${KQ_WORKSHOP_ROOM.floorTop + placement.yM * scale}%`,
    width: `${placement.widthM * scale}%`,
    height: `${placement.depthM * scale}%`,
  };
}
