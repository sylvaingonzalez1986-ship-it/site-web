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
const WORKSHOP_MODELS: Readonly<Record<string, readonly string[]>> = {
  "SIFT-TRAY": ["SIFT-TRAY"],
  "PRESS-0600": ["PRESS-0600", "PRESS-10T", "PRESS-20T"],
  "WASHER-25L": ["WASHER-25L", "WASHER-75G", "TSS-225"],
  "AUTO-SIEVE": ["AUTO-SIEVE"],
  "FREEZE-DRYER": ["FREEZE-DRYER"],
  "STATIC-PLASMA": ["STATIC-PLASMA"],
};
const WORKSHOP_MODEL_ALT: Readonly<Record<string, string>> = {
  "SIFT-TRAY": "Deux plateaux de tamisage en bois, avec leurs grilles métalliques",
  "PRESS-0600": "Presse compacte à vis, bâti turquoise et deux plaques chauffantes rectangulaires",
  "PRESS-10T": "Presse hydraulique turquoise avec manomètre, volant latéral et plaques rectangulaires",
  "PRESS-20T": "Grande presse d’atelier à vérin central, larges plaques et commande hydraulique latérale",
  "WASHER-25L": "Laveuse compacte ouverte, panier perforé, tuyau de vidange et sacs filtrants",
  "WASHER-75G": "Laveuse professionnelle en inox, sur roulettes, avec écran de commande et sortie basse",
  "TSS-225": "Installation de lavage en inox réunissant trois cuves, une plateforme et un pupitre de commande",
  "AUTO-SIEVE": "Tamis circulaires empilés en inox, avec capot transparent et moteur latéral",
  "FREEZE-DRYER": "Lyophilisateur à porte ronde ouverte, avec plateaux métalliques visibles dans la chambre",
  "STATIC-PLASMA": "Séparateur électrostatique vitré avec deux colonnes, unité de traitement d’air et compresseur",
};

function artwork(family: KqWarehouseArtworkFamily, tier: KqWarehouseTier, name: string): KqWarehouseProductArtwork {
  return { src: `/placard/equipment-sylvain-v1/${family}-${TIER_NUMBER[tier]}.webp`, alt: `${name}, illustration du matériel du jeu`, family, tier };
}

/** Restored local illustrations follow the current 1/4/7 configurations.
 * A shared drawing is retained when no distinct historical model exists. */
export function getKqWorkshopProductArtwork(code: string, level = 1): KqWarehouseProductArtwork | null {
  const family = Object.hasOwn(WORKSHOP_FAMILIES, code) ? WORKSHOP_FAMILIES[code] : null;
  const machine = family ? getKqWorkshopMachineSpecification(code, level) : null;
  if (!family || !machine) return null;
  const models = WORKSHOP_MODELS[code];
  const model = models[machine.configuration - 1] ?? models[0];
  return { src: `/app/kanab-quest/equipment/equipment-${model}-hero-v2.webp`,
    alt: WORKSHOP_MODEL_ALT[model], family, tier: machine.tier.code };
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
