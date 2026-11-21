import { getKqWarehouseInputPack } from "./kanab-quest-warehouse-preparations";

/** Fictional product illustrations; commercial references remain separate metadata. */
const productArtwork: Record<string, { src: string; alt: string }> = {
  "CARE-COMPOST-TEA": { src: "/placard/equipment-sylvain-v1/care-compost-tea.webp", alt: "Fournitures pour thé de compost illustrées dans le style de Kanab Quest" },
  "CARE-VERMICOMPOST": { src: "/placard/equipment-sylvain-v1/care-vermicompost.webp", alt: "Lombricompost illustré dans le style de Kanab Quest" },
  "CARE-ORGANIC-FEED": { src: "/placard/equipment-sylvain-v1/nutrition-2.webp", alt: "Fournitures de nutrition illustrées dans le style de Kanab Quest" },
  "CARE-SEAWEED": { src: "/placard/equipment-sylvain-v1/care-seaweed.webp", alt: "Soutien aux algues illustré dans le style de Kanab Quest" },
  "CARE-APHIDIUS": { src: "/placard/equipment-sylvain-v1/care-aphidius.webp", alt: "Auxiliaires Aphidius illustrés dans le style de Kanab Quest" },
  "CARE-PHYTOSEIULUS": { src: "/placard/equipment-sylvain-v1/care-phytoseiulus.webp", alt: "Auxiliaires Phytoseiulus illustrés dans le style de Kanab Quest" },
  "CARE-SWIRSKII": { src: "/placard/equipment-sylvain-v1/care-swirskii.webp", alt: "Auxiliaires Swirskii illustrés dans le style de Kanab Quest" },
  "CARE-ORIUS": { src: "/placard/equipment-sylvain-v1/care-orius.webp", alt: "Auxiliaires Orius illustrés dans le style de Kanab Quest" },
  "CARE-CHRYSOPERLA": { src: "/placard/equipment-sylvain-v1/care-chrysoperla.webp", alt: "Chrysopes illustrées dans le style de Kanab Quest" },
  "CARE-COCCINELLA": { src: "/placard/equipment-sylvain-v1/care-coccinella.webp", alt: "Coccinelles illustrées dans le style de Kanab Quest" },
  "WAREHOUSE-NUTRITION-BASE": { src: "/placard/equipment-sylvain-v1/nutrition-1.webp", alt: "Illustration de matériel de nutrition de base" },
  "WAREHOUSE-NUTRITION-SUPPLEMENT": { src: "/placard/equipment-sylvain-v1/nutrition-3.webp", alt: "Illustration de flacons de compléments nutritifs" },
  "WAREHOUSE-PBI": { src: "/app/kanab-quest/cards/botte-025-plaque-engluee-suivi-v2.webp", alt: "Illustration d’une plaque de suivi des insectes" },
  "WAREHOUSE-MAINTENANCE": { src: "/placard/inputs-v1/black-soap.webp", alt: "Illustration d’un bidon de savon noir pour les sols" },
  "CARE-IRON": { src: "/placard/inputs-v1/iron.webp", alt: "Illustration d’un flacon de complément au fer" },
  "CARE-PERLITE": { src: "/placard/inputs-v1/perlite.webp", alt: "Illustration d’un sac de perlite et de ses grains blancs" },
  "CARE-SHADE": { src: "/placard/inputs-v1/shade.webp", alt: "Illustration d’un filet horticole d’ombrage plié" },
  "CARE-BLUE-TRAPS": { src: "/placard/inputs-v1/blue-traps.webp", alt: "Illustration de plaques bleues de suivi des thrips" },
};

export const KQ_CARE_HEALTH_ARTWORK = {
  src: "/app/kanab-quest/care/plant-health-v1.webp",
  alt: "Illustration botanique d’un plant de chanvre dans un pot en terre cuite",
};

export function getKqCareProductArtwork(code: string) {
  const art = Object.hasOwn(productArtwork, code) ? productArtwork[code] : undefined;
  const pack = getKqWarehouseInputPack(code);
  if (!art || !pack) return undefined;
  return { ...art, referenceLabel: pack.name, referenceUrl: pack.url };
}
