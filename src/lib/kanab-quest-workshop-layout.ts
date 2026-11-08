import type { KqEquipmentSlot } from "./kanab-quest-equipment";
import { getKqWorkshopMachineSpecification } from "./kanab-quest-workshop-machines";

/** One metre-based world, calibrated to the illustrated room; independent of
 * viewport and touch targets. Sources: lab-machine-dimensions-2026-11-08.json.
 * These illustrated envelopes are not a technical installation drawing. */
export const KQ_WORKSHOP_ROOM = { widthM: 6, depthM: 5.5, imageWidth: 1374, imageHeight: 1145 } as const;
export type KqLabDimensions = { widthM: number; depthM: number; heightM: number };
export type KqWorkshopPlacement = {
  code: string; slot: KqEquipmentSlot; label: string; xM: number; yM: number;
  reserve: { widthM: number; depthM: number };
};
export const KQ_WORKSHOP_PLACEMENTS: readonly KqWorkshopPlacement[] = [
  { code: "SIFT-TRAY", slot: "sifting", label: "Tamis", xM: 2.15, yM: 5.05, reserve: { widthM: .9, depthM: .6 } },
  { code: "WASHER-25L", slot: "washing", label: "Laveuse", xM: 1.55, yM: .875, reserve: { widthM: 2.9, depthM: 1.55 } },
  { code: "AUTO-SIEVE", slot: "filtration", label: "Collecteur", xM: 5.45, yM: 3, reserve: { widthM: .9, depthM: .8 } },
  { code: "STATIC-PLASMA", slot: "static-separation", label: "Séparateur", xM: 5.025, yM: .425, reserve: { widthM: 1.75, depthM: .65 } },
  { code: "PRESS-0600", slot: "press", label: "Presse", xM: 3.8, yM: 5.05, reserve: { widthM: 1, depthM: .7 } },
  { code: "FREEZE-DRYER", slot: "drying", label: "Lyophilisateur", xM: 4.9, yM: 4.35, reserve: { widthM: .95, depthM: .9 } },
];
type LabModel = KqLabDimensions & { sprite: string; support?: KqLabDimensions; basis: string; sourceUrl?: string };
const MODELS: Record<string, readonly LabModel[]> = {
  "SIFT-TRAY": [{ sprite: "sift", widthM: .6, depthM: .45, heightM: .15, support: { widthM: .9, depthM: .6, heightM: .9 }, basis: "Plateaux et établi : gabarit illustratif." }],
  "PRESS-0600": [
    { sprite: "press-1", widthM: .45, depthM: .35, heightM: .65, support: { widthM: .75, depthM: .6, heightM: .75 }, basis: "Presse à vis : gabarit illustratif." },
    { sprite: "press-2", widthM: .65, depthM: .5, heightM: 1.05, support: { widthM: .8, depthM: .65, heightM: .35 }, basis: "Presse hydraulique : gabarit illustratif." },
    { sprite: "press-3", widthM: .9, depthM: .65, heightM: 1.5, basis: "Grande presse : gabarit illustratif." },
  ],
  "WASHER-25L": [
    { sprite: "washer-1", widthM: .71, depthM: .56, heightM: .67, support: { widthM: .85, depthM: .75, heightM: .55 }, basis: "Mini Osprey : cotes publiées, orientation et support illustratifs.", sourceUrl: "https://www.lowtemp-plates.com/products/mini-osprey-30-gallon-washing-machine" },
    { sprite: "washer-2", widthM: .85, depthM: 1.22, heightM: 1.65, basis: "Osprey 75 : dimensions constructeur arrondies, couvercle fermé.", sourceUrl: "https://www.lowtemp-plates.com/products/theosprey" },
    { sprite: "washer-3", widthM: 2.9, depthM: 1.55, heightM: 2.25, basis: "TSS-225 : dimensions constructeur arrondies.", sourceUrl: "https://www.forzasolventless.com/products/tss-225" },
  ],
  "AUTO-SIEVE": [{ sprite: "collector", widthM: .65, depthM: .65, heightM: .7, support: { widthM: .9, depthM: .8, heightM: .45 }, basis: "Diamètre du tamis documenté ; ensemble et support illustratifs.", sourceUrl: "https://www.lowtemp-plates.com/products/the-autosieve" }],
  "STATIC-PLASMA": [{ sprite: "separator", widthM: 1.75, depthM: .65, heightM: 1.7, basis: "Plasmastatic : caisson documenté, encombrement des annexes estimé.", sourceUrl: "https://sambocreeck.com/products/separatore-tribostatico" }],
  "FREEZE-DRYER": [{ sprite: "dryer", widthM: .65, depthM: .86, heightM: .96, support: { widthM: .95, depthM: .9, heightM: .35 }, basis: "HiLyph XL : corps documenté, support illustratif et place réservée à la pompe.", sourceUrl: "https://theoriginalresinator.com/collections/freeze-dryers/products/hilyph-hash-dryer" }],
};
export function getKqLabModel(code: string, level = 1): LabModel | null {
  const spec = getKqWorkshopMachineSpecification(code, level);
  const models = Object.hasOwn(MODELS, code) ? MODELS[code] : undefined;
  return spec && models ? models[spec.configuration - 1] ?? models[0] : null;
}
/** Same calibrated projection for every physical metre. */
export function projectKqLabPoint(xM: number, yM: number, zM = 0) {
  return { x: 655 + (xM - yM) * 95.5, y: 481 + (xM + yM) * 51 - zM * 112.6 };
}
export function getKqLabFootprint(placement: KqWorkshopPlacement) {
  const { widthM: w, depthM: d } = placement.reserve;
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
    .map(([x, y]) => projectKqLabPoint(placement.xM + x, placement.yM + y))
    .map(point => `${point.x},${point.y}`).join(" ");
}
export function getKqLabObjectBounds(placement: KqWorkshopPlacement, dimensions: KqLabDimensions, supportHeightM = 0) {
  const center = projectKqLabPoint(placement.xM, placement.yM, supportHeightM);
  const floorHeight = (dimensions.widthM + dimensions.depthM) * 51;
  const width = (dimensions.widthM + dimensions.depthM) * 95.5;
  const height = floorHeight + dimensions.heightM * 112.6;
  return { left: center.x - width / 2, top: center.y + floorHeight / 2 - height, width, height };
}
type Bounds = ReturnType<typeof getKqLabObjectBounds>;
function relativeStyle(box: Bounds, parent: Bounds) {
  return { left: `${(box.left - parent.left) / parent.width * 100}%`, top: `${(box.top - parent.top) / parent.height * 100}%`,
    width: `${box.width / parent.width * 100}%`, height: `${box.height / parent.height * 100}%` };
}
export function getKqLabStationLayout(placement: KqWorkshopPlacement, model: LabModel | null) {
  const body = getKqLabObjectBounds(placement, model ?? { ...placement.reserve, heightM: 0 }, model?.support?.heightM);
  const support = model?.support ? getKqLabObjectBounds(placement, model.support) : body;
  const bounds = { left: Math.min(body.left, support.left), top: Math.min(body.top, support.top),
    width: Math.max(body.left + body.width, support.left + support.width) - Math.min(body.left, support.left),
    height: Math.max(body.top + body.height, support.top + support.height) - Math.min(body.top, support.top) };
  const marker = projectKqLabPoint(placement.xM + placement.reserve.widthM / 2, placement.yM + placement.reserve.depthM / 2);
  return { stage: relativeStyle(bounds, { left: 0, top: 0, width: KQ_WORKSHOP_ROOM.imageWidth, height: KQ_WORKSHOP_ROOM.imageHeight }),
    body: relativeStyle(body, bounds), support: relativeStyle(support, bounds),
    marker: { left: `${(marker.x - bounds.left) / bounds.width * 100}%`, top: `${(marker.y + 12 - bounds.top) / bounds.height * 100}%` } };
}
