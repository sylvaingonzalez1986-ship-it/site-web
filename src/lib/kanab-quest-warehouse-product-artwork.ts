import { getKqWarehouseDevice, type KqWarehouseTier } from "./kanab-quest-warehouse-catalog";
import { getKqWarehouseOption, type KqWarehouseOptionFamily } from "./kanab-quest-warehouse-options";
import { getKqWorkshopMachineSpecification } from "./kanab-quest-workshop-machines";

type WorkshopArtworkFamily = "workshop-sift" | "workshop-press" | "workshop-washer" | "workshop-collector" | "workshop-dryer" | "workshop-separator";
export type KqWarehouseArtworkFamily = KqWarehouseOptionFamily | "lighting" | "air" | "drying" | "storage" | WorkshopArtworkFamily;
export type KqWarehouseProductArtwork = {
  src: string;
  alt: string;
  family: KqWarehouseArtworkFamily;
  tier: KqWarehouseTier;
};

const TIER_NUMBER = { economy: 1, standard: 2, premium: 3 } as const;
const WORKSHOP_FAMILIES: Readonly<Record<string, WorkshopArtworkFamily>> = {
  "SIFT-TRAY": "workshop-sift",
  "PRESS-0600": "workshop-press",
  "WASHER-25L": "workshop-washer",
  "AUTO-SIEVE": "workshop-collector",
  "FREEZE-DRYER": "workshop-dryer",
  "STATIC-PLASMA": "workshop-separator",
};

function artwork(family: KqWarehouseArtworkFamily, tier: KqWarehouseTier, name: string): KqWarehouseProductArtwork {
  return { src: `/placard/equipment-sylvain-v1/${family}-${TIER_NUMBER[tier]}.webp`, alt: `${name}, illustration du matériel du jeu`, family, tier };
}

/** The illustration follows the existing 1/4/7 configurations, without changing the machine. */
export function getKqWorkshopProductArtwork(code: string, level = 1): KqWarehouseProductArtwork | null {
  const family = Object.hasOwn(WORKSHOP_FAMILIES, code) ? WORKSHOP_FAMILIES[code] : null;
  const machine = family ? getKqWorkshopMachineSpecification(code, level) : null;
  return family && machine ? artwork(family, machine.tier.code, machine.name) : null;
}

/** Stable saved codes resolve through the catalog, never through a product's translated name. */
export function getKqWarehouseProductArtwork(code: string): KqWarehouseProductArtwork | null {
  const option = getKqWarehouseOption(code);
  if (option) return artwork(option.family, option.tier, option.name);
  const device = getKqWarehouseDevice(code);
  if (!device) return getKqWorkshopProductArtwork(code);
  if (device.kind === "processing") {
    return device.legacyCode ? getKqWorkshopProductArtwork(device.legacyCode, device.tier === "premium" ? 7 : device.tier === "standard" ? 4 : 1) : null;
  }
  return artwork(device.kind, device.tier, device.name);
}
