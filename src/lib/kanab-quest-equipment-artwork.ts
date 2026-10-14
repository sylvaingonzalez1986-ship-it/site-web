import { getKqWorkshopProductArtwork } from "./kanab-quest-warehouse-product-artwork";

export type KqEquipmentArtwork = {
  src: string;
  alt: string;
};

export const KQ_EQUIPMENT_ARTWORK: Readonly<Record<string, KqEquipmentArtwork>> = {
  "DRYING-ROOM": {
    src: "/placard/equipment-sylvain-v1/drying-1.webp",
    alt: "Séchoir compact en bois et turquoise, illustration du matériel du jeu",
  },
  "TENT-080-STARTER": {
    src: "/app/kanab-quest/equipment/equipment-TENT-080-STARTER-hero-v2.webp",
    alt: "Petite tente de culture noire aux renforts turquoise avec une réparation en toile claire",
  },
  "TENT-120": {
    src: "/app/kanab-quest/equipment/equipment-TENT-120-hero-v2.webp",
    alt: "Tente de culture renforcée de taille moyenne avec deux ouvertures de ventilation",
  },
  "TENT-150": {
    src: "/app/kanab-quest/equipment/equipment-TENT-150-hero-v2.webp",
    alt: "Grande tente de culture noire dotée de nombreux conduits et de renforts orange",
  },
  "LED-150-STARTER": {
    src: "/placard/equipment-sylvain-v1/lighting-1.webp",
    alt: "Éclairage compact suspendu à son support en bois, illustration du matériel du jeu",
  },
  "LED-300": {
    src: "/placard/equipment-sylvain-v1/lighting-2.webp",
    alt: "Éclairage standard turquoise suspendu à son support en bois",
  },
  "LED-500": {
    src: "/placard/equipment-sylvain-v1/lighting-3.webp",
    alt: "Éclairage haut de gamme turquoise avec son boîtier de commande",
  },
  "AIR-STARTER": {
    src: "/placard/equipment-sylvain-v1/air-1.webp",
    alt: "Petit extracteur turquoise monté sur un support en bois",
  },
  "AIR-EC6": {
    src: "/placard/equipment-sylvain-v1/air-2.webp",
    alt: "Extracteur standard turquoise avec sa turbine et son conduit",
  },
  "CLIMATE-SMART": {
    src: "/placard/equipment-sylvain-v1/climate-3.webp",
    alt: "Système climatique haut de gamme, illustration cartoon du matériel du jeu",
  },
  "SIFT-TRAY": {
    src: "/placard/equipment-sylvain-v1/workshop-sift-1.webp",
    alt: "Deux plateaux de tamisage en bois équipés de grilles aux mailles différentes",
  },
  "WASHER-25L": {
    src: "/placard/equipment-sylvain-v1/workshop-washer-1.webp",
    alt: "Laveuse compacte avec couvercle ouvert, tuyau de vidange et quatre sacs filtrants",
  },
  "AUTO-SIEVE": {
    src: "/placard/equipment-sylvain-v1/workshop-collector-1.webp",
    alt: "Pile compacte de cinq tamis circulaires en inox avec capot transparent et moteur vibrant latéral",
  },
  "WASHER-75G": {
    src: "/app/kanab-quest/equipment/equipment-WASHER-75G-hero-v2.webp",
    alt: "Grande laveuse professionnelle en inox avec écran de contrôle, sortie sanitaire et roulettes verrouillables",
  },
  "TSS-225": {
    src: "/app/kanab-quest/equipment/equipment-TSS-225-hero-v2.webp",
    alt: "Système automatisé en inox réunissant trois cuves, une plateforme opérateur et un pupitre de commande",
  },
  "STATIC-PLASMA": {
    src: "/placard/equipment-sylvain-v1/workshop-separator-1.webp",
    alt: "Séparateur électrostatique vitré avec deux plaques internes, sécheur d’air bleu et compresseur",
  },
  "PRESS-0600": {
    src: "/placard/equipment-sylvain-v1/workshop-press-1.webp",
    alt: "Petite presse à vis dans un bâti turquoise avec deux plaques chauffantes opposées",
  },
  "PRESS-2T": {
    src: "/app/kanab-quest/equipment/equipment-PRESS-2T-hero-v2.webp",
    alt: "Presse à levier de taille moyenne avec plaques chauffantes et contrôleur latéral",
  },
  "PRESS-10T": {
    src: "/app/kanab-quest/equipment/equipment-PRESS-10T-hero-v2.webp",
    alt: "Presse hydraulique renforcée avec large manomètre et roue de décompression orange",
  },
  "PRESS-20T": {
    src: "/app/kanab-quest/equipment/equipment-PRESS-20T-hero-v2.webp",
    alt: "Imposante presse d'atelier sur pieds avec vérin central et grandes plaques chauffantes",
  },
  "FREEZE-DRYER": {
    src: "/placard/equipment-sylvain-v1/workshop-dryer-1.webp",
    alt: "Lyophilisateur compact dont la porte ronde dévoile quatre plateaux métalliques",
  },
  "SOLAR-BACKUP": {
    src: "/placard/equipment-sylvain-v1/solar-1.webp",
    alt: "Panneau solaire de secours, illustration cartoon du matériel du jeu",
  },
  "SECURITY-CAMERA": {
    src: "/placard/equipment-sylvain-v1/camera-1.webp",
    alt: "Caméra de surveillance, illustration cartoon du matériel du jeu",
  },
  "SECURITY-DOG": {
    src: "/placard/equipment-sylvain-v1/dog-1.webp",
    alt: "Chien de garde du village, illustration cartoon du compagnon de l’entrepôt",
  },
  "SECURITY-FENCE": {
    src: "/app/kanab-quest/equipment/equipment-SECURITY-FENCE-hero-v1.webp",
    alt: "Clôture électrique aux poteaux turquoise avec centrale et panneau éclair jaune",
  },
};

export function getKqEquipmentVisualTier(level = 1): 1 | 5 | 10 {
  return level >= 10 ? 10 : level >= 5 ? 5 : 1;
}

const EVOLVING_MODELS: Record<string, readonly [string, string, string]> = {
  "TENT-120": ["TENT-080-STARTER", "TENT-120", "TENT-150"],
  "LED-300": ["LED-150-STARTER", "LED-300", "LED-500"],
};

export function getKqEquipmentArtwork(equipmentCode: string, level?: number) {
  const workshop = getKqWorkshopProductArtwork(equipmentCode, level);
  if (workshop) return { src: workshop.src, alt: workshop.alt };
  const tier = getKqEquipmentVisualTier(level);
  const model = level === undefined ? equipmentCode : EVOLVING_MODELS[equipmentCode]?.[tier === 10 ? 2 : tier === 5 ? 1 : 0] ?? equipmentCode;
  const artwork = KQ_EQUIPMENT_ARTWORK[model];
  return artwork ? { ...artwork, alt: level === undefined ? artwork.alt : `${artwork.alt} · niveau ${level}` } : null;
}
