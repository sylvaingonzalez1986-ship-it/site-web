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
  "SIFT-TRAY": "Tamis motorisé à tambour horizontal sous capot transparent, avec socle noir et moteur latéral",
  "PRESS-0600": "Presse noire à quatre colonnes et ressorts, plaques rectangulaires, écran séparé et pompe à levier",
  "PRESS-10T": "Presse verticale grise, écran bordé de jaune, plaques basses et deux pieds métalliques inclinés",
  "PRESS-20T": "Presse en inox à large ouverture, deux plaques et grand écran horizontal sur la façade basse",
  "WASHER-25L": "Laveuse compacte à cuve inox gainée de noir, couvercle plat, commande ronde et vanne basse",
  "WASHER-75G": "Grande laveuse inox sur châssis à roulettes, avec écran incliné, couvercle et vanne frontale",
  "TSS-225": "Installation inox avec deux cuves rondes, une cuve rectangulaire, une plateforme à marches et un pupitre",
  "AUTO-SIEVE": "Collecteur à tamis ronds inox empilés, capot transparent et moteur latéral, avec commande et pédale",
  "FREEZE-DRYER": "Lyophilisateur noir à chambre ronde et porte transparente, avec plateaux métalliques et pompe séparée",
  "STATIC-PLASMA": "Séparateur inox sur roulettes, deux portes transparentes, modules verticaux et commandes supérieures",
};

type ProductArtworkFamily = Exclude<KqWarehouseArtworkFamily, WorkshopArtworkFamily>;
const PRODUCT_ALT: Record<ProductArtworkFamily, readonly [string, string, string]> = {
  lighting: ["Panneau LED fin à réflecteur métallique blanc et grille de diodes", "Double panneau LED rectangulaire avec boîtier d’alimentation", "Éclairage à six barres LED sur cadre métallique ouvert"],
  air: ["Extracteur noir compact à face circulaire et trois réglages verticaux", "Extracteur noir à entrée circulaire saillante et trois commandes latérales", "Extracteur en ligne noir avec boîtier de contrôle séparé"],
  drying: ["Séchoir suspendu à cinq plateaux circulaires en filet", "Portant de séchage métallique ouvert sur roulettes", "Grand portant de séchage métallique à plusieurs niveaux sur roulettes"],
  storage: ["Bocal en verre à fermeture métallique et joint orange", "Rayonnage métallique noir à cinq étagères avec bocaux en verre", "Fût blanc à couvercle vissé bleu et poignées noires"],
  water: ["Réservoir portatif blanc avec pompe manuelle, flexible et lance", "Kit de distribution avec tuyaux enroulés, raccords et piquets", "Centrale sur châssis aluminium avec pompe, tuyauterie et coffret de commande"],
  climate: ["Déshumidificateur blanc à grille supérieure noire et réservoir intégré", "Unité de traitement d’air en métal gris avec portes et ouvertures latérales", "Centrale modulaire grise à deux niveaux, filtres et colonne de commande"],
  control: ["Petit capteur blanc à écran et support arrière", "Contrôleur noir à façade bleue, écran et six boutons", "Console tactile horizontale à façade noire et coque grise"],
  hygiene: ["Chariot de nettoyage gris sur roulettes avec bacs noirs", "Aspirateur d’atelier gris et jaune avec flexible, tube et brosse de sol", "Station d’hygiène inox avec brosses, tourniquet et distributeur"],
  logistics: ["Desserte à plateaux et roulettes", "Diable pliant jaune et noir à deux roues", "Établi à plateau en bois sur structure métallique"],
  security: ["Casier métallique rouge élancé à serrure", "Lecteur de badge mural noir et fin", "Moniteur d’interphone blanc à écran noir"],
  substrate: ["Bac carré noir à rebord moulé", "Table à bac noir sur pieds métalliques", "Contenant réutilisable noir à parois alvéolées perforées"],
  nutrition: ["Flacon sombre à bouchon vissé blanc", "Bidon violet à poignée intégrée et bouchon blanc", "Grand bidon vert à poignée et bouchon vissé"],
};

function artwork(family: ProductArtworkFamily, tier: KqWarehouseTier, name: string): KqWarehouseProductArtwork {
  return { src: `/placard/equipment-real-v2/${family}-${TIER_NUMBER[tier]}.webp`,
    alt: `${name} : ${PRODUCT_ALT[family][TIER_NUMBER[tier] - 1].toLocaleLowerCase("fr")}, dessin d’après un modèle réel`, family, tier };
}

/** Reference-based drawings follow the current 1/4/7 configurations.
 * Reuse the same real model when the catalog has no distinct tier model.
 * Sources and prompts: docs/bete-de-concours/ui-equipment-real-provenance.json. */
export function getKqWorkshopProductArtwork(code: string, level = 1): KqWarehouseProductArtwork | null {
  const family = Object.hasOwn(WORKSHOP_FAMILIES, code) ? WORKSHOP_FAMILIES[code] : null;
  const machine = family ? getKqWorkshopMachineSpecification(code, level) : null;
  if (!family || !machine) return null;
  const models = WORKSHOP_MODELS[code];
  const model = models[machine.configuration - 1] ?? models[0];
  return { src: `/placard/equipment-real-v2/${model}.webp`,
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
