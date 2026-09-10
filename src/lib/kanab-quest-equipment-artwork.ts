export type KqEquipmentArtwork = {
  src: string;
  alt: string;
};

export const KQ_EQUIPMENT_ARTWORK: Readonly<Record<string, KqEquipmentArtwork>> = {
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
    src: "/app/kanab-quest/equipment/equipment-LED-150-STARTER-hero-v2.webp",
    alt: "Panneau LED compact suspendu dont les diodes diffusent une lumière chaude",
  },
  "LED-300": {
    src: "/app/kanab-quest/equipment/equipment-LED-300-hero-v2.webp",
    alt: "Rampe LED réglable à deux panneaux lumineux dans un cadre turquoise",
  },
  "LED-500": {
    src: "/app/kanab-quest/equipment/equipment-LED-500-hero-v2.webp",
    alt: "Large cadre LED premium composé de six barres lumineuses parallèles",
  },
  "AIR-STARTER": {
    src: "/app/kanab-quest/equipment/equipment-AIR-STARTER-hero-v2.webp",
    alt: "Petit extracteur cylindrique rafistolé avec variateur manuel et colliers turquoise",
  },
  "AIR-EC6": {
    src: "/app/kanab-quest/equipment/equipment-AIR-EC6-hero-v2.webp",
    alt: "Extracteur cylindrique renforcé avec turbine visible et commande de vitesse",
  },
  "CLIMATE-SMART": {
    src: "/app/kanab-quest/equipment/equipment-CLIMATE-SMART-hero-v2.webp",
    alt: "Système climatique complet réunissant filtre, extracteur, contrôleur et sondes",
  },
  "SIFT-TRAY": {
    src: "/app/kanab-quest/equipment/equipment-SIFT-TRAY-hero-v2.webp",
    alt: "Deux plateaux de tamisage en bois équipés de grilles aux mailles différentes",
  },
  "WASHER-25L": {
    src: "/app/kanab-quest/equipment/equipment-WASHER-25L-hero-v2.webp",
    alt: "Laveuse compacte avec couvercle ouvert, tuyau de vidange et quatre sacs filtrants",
  },
  "AUTO-SIEVE": {
    src: "/app/kanab-quest/equipment/equipment-AUTO-SIEVE-hero-v2.webp",
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
    src: "/app/kanab-quest/equipment/equipment-STATIC-PLASMA-hero-v2.webp",
    alt: "Séparateur électrostatique vitré avec deux plaques internes, sécheur d’air bleu et compresseur",
  },
  "PRESS-0600": {
    src: "/app/kanab-quest/equipment/equipment-PRESS-0600-hero-v2.webp",
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
    src: "/app/kanab-quest/equipment/equipment-FREEZE-DRYER-hero-v2.webp",
    alt: "Lyophilisateur compact dont la porte ronde dévoile quatre plateaux métalliques",
  },
  "SOLAR-BACKUP": {
    src: "/app/kanab-quest/equipment/equipment-SOLAR-BACKUP-hero-v2.webp",
    alt: "Panneau solaire pliant relié à une batterie de secours portable renforcée",
  },
  "SECURITY-CAMERA": {
    src: "/app/kanab-quest/equipment/equipment-SECURITY-CAMERA-hero-v2.webp",
    alt: "Caméra de sécurité cabossée et réparée dont l'objectif et les diodes restent intacts",
  },
};

export function getKqEquipmentArtwork(equipmentCode: string) {
  return KQ_EQUIPMENT_ARTWORK[equipmentCode] ?? null;
}
