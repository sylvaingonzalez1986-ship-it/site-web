import { KQ_WAREHOUSE_TIERS, type KqWarehouseTier } from "./kanab-quest-warehouse-catalog";
import { getKqWarehouseRetailPrice } from "./kanab-quest-warehouse-retail";
import { isKqWarehouseHandlingCode, KQ_WAREHOUSE_HANDLING, KQ_WAREHOUSE_HANDLING_CART } from "./kanab-quest-warehouse-handling";

export { KQ_WAREHOUSE_HANDLING_CART, KQ_WAREHOUSE_HANDLING_CART_PRICE_CENTS, KQ_WAREHOUSE_HANDLING_CART_SAVING } from "./kanab-quest-warehouse-handling";

/** Fictional management-game modules. Values are game balance, never growing advice. */
export const KQ_WAREHOUSE_OPTION_FAMILIES = [
  { code: "water", label: "Irrigation", description: "Organisation de la distribution dans la simulation." },
  { code: "climate", label: "Climat", description: "Confort abstrait de l’atelier." },
  { code: "control", label: "Pilotage", description: "Suivi et coordination des tâches." },
  { code: "hygiene", label: "Hygiène", description: "Entretien et soin de l’espace de travail." },
  { code: "logistics", label: "Manutention", description: "Circulation et rangement des fournitures." },
  { code: "security", label: "Sécurité", description: "Protection des équipements dans le jeu." },
  { code: "substrate", label: "Support", description: "Profil de support fictif, sans composition réelle." },
  { code: "nutrition", label: "Nutrition", description: "Budget abstrait en unités de jeu par m² et par cycle." },
] as const;

export type KqWarehouseOptionFamily = typeof KQ_WAREHOUSE_OPTION_FAMILIES[number]["code"];
export type KqWarehouseOption = {
  code: string;
  family: KqWarehouseOptionFamily;
  tier: KqWarehouseTier;
  name: string;
  description: string;
  /** Price of one funded inventory unit (one device or one square metre of coverage). */
  unitPriceCents: number;
  installationIncluded?: boolean;
  consumablesCentsPerM2: number;
  unitsPerM2PerCycle: number;
  yieldBonusPercent: number;
  qualityBonus: number;
} & ({ unit: "device"; capacityM2: number } | { unit?: undefined; capacityM2?: never });

export type KqWarehouseHandlingCartConversion = {
  quantity: number;
  creditCents: number;
  unknownBasisQuantity: number;
};

const profile = (family: KqWarehouseOptionFamily, suffix: string, name: string, description: string,
  equipmentCentsPerM2: number, consumablesCentsPerM2: number, unitsPerM2PerCycle: number,
  yieldBonusPercent: number, qualityBonus: number): KqWarehouseOption => ({
  code: `SIM-${family.toUpperCase()}-${suffix}`, family,
  tier: KQ_WAREHOUSE_TIERS[Number(suffix) - 1].code,
  name: `${KQ_WAREHOUSE_OPTION_FAMILIES.find(item => item.code === family)!.label} ${KQ_WAREHOUSE_TIERS[Number(suffix) - 1].label.toLocaleLowerCase("fr")}`,
  description: `${name}. ${description}`,
  unitPriceCents: equipmentCentsPerM2, consumablesCentsPerM2, unitsPerM2PerCycle, yieldBonusPercent, qualityBonus,
});

/** Original balance is retained for cultures already in progress. */
export const KQ_WAREHOUSE_LEGACY_OPTIONS: readonly KqWarehouseOption[] = [
  profile("water", "01", "Réservoir mobile", "Un petit module simple à entretenir, au budget contenu.", 900, 70, 1, 1, 0),
  profile("water", "02", "Réseau distribué", "Plus de rendement de jeu, avec davantage de fournitures à chaque cycle.", 1900, 140, 2, 2, 0),
  profile("water", "03", "Centrale de distribution", "Le meilleur bonus de cette famille demande le plus gros budget.", 3200, 240, 3, 3, 0),
  profile("climate", "01", "Déshumidificateur mobile", "Un petit bonus de rendement de jeu pour des charges contenues.", 1400, 90, 1, 1, 0),
  profile("climate", "02", "Unité de traitement d’air", "Privilégie la qualité de départ au rendement de jeu.", 2800, 190, 2, 0, 1),
  profile("climate", "03", "Centrale modulaire", "Cumule qualité et rendement de jeu, avec les charges les plus hautes.", 4600, 340, 3, 2, 1),
  profile("control", "01", "Capteurs autonomes", "Un suivi léger, peu coûteux à installer.", 600, 40, 1, 1, 0),
  profile("control", "02", "Tableau de suivi", "Favorise le rendement de jeu grâce à une meilleure coordination.", 1500, 100, 2, 2, 0),
  profile("control", "03", "Console de supervision", "Échange une partie du rendement de jeu contre de la qualité de départ.", 2900, 180, 3, 1, 1),
  profile("hygiene", "01", "Station de nettoyage", "Un poste compact et économique à l’achat.", 400, 80, 1, 1, 0),
  profile("hygiene", "02", "Aspirateur d’atelier", "Privilégie la qualité de départ, avec un entretien plus coûteux.", 1100, 160, 2, 0, 1),
  profile("hygiene", "03", "Sas d’entretien", "Combine les deux bonus de jeu au prix de fournitures supplémentaires.", 2000, 260, 3, 1, 1),
  profile("logistics", "01", "Desserte mobile", "Les petites fournitures restent à portée de main.", 700, 35, 1, 1, 0),
  profile("logistics", "02", "Chariot de manutention", "Un bonus de rendement de jeu supérieur, avec plus de charges.", 1600, 80, 2, 2, 0),
  profile("logistics", "03", "Table de travail", "Un grand poste de travail pour le bonus maximal de cette famille.", 2800, 150, 3, 3, 0),
  profile("security", "01", "Casier sécurisé", "Un poste de protection fictive peu coûteux.", 800, 50, 1, 1, 0),
  profile("security", "02", "Contrôle d’accès", "Privilégie le rendement de jeu dans cette famille.", 1800, 110, 2, 2, 0),
  profile("security", "03", "Supervision des accès", "Échange une partie du rendement de jeu contre de la qualité de départ.", 3000, 180, 3, 1, 1),
  profile("substrate", "01", "Bacs modulaires", "Un support fictif économique à installer et à renouveler.", 300, 160, 1, 1, 0),
  profile("substrate", "02", "Table de culture", "Un support qui privilégie la qualité de départ.", 650, 290, 2, 0, 1),
  profile("substrate", "03", "Support réutilisable", "Les deux bonus de jeu, avec un budget d’entretien supérieur.", 1000, 460, 3, 2, 1),
  profile("nutrition", "01", "Fournitures essentielles", "Une unité de jeu par m² et par cycle : le plus petit budget.", 250, 180, 1, 1, 0),
  profile("nutrition", "02", "Fournitures suivies", "Deux unités de jeu par m² et par cycle : priorité au rendement de jeu.", 500, 320, 2, 2, 0),
  profile("nutrition", "03", "Fournitures confort", "Trois unités de jeu par m² et par cycle : rendement modéré et qualité de départ.", 900, 520, 3, 1, 1),
];

const balancedOptions = KQ_WAREHOUSE_LEGACY_OPTIONS.map((option): KqWarehouseOption => {
  const unitPriceCents = getKqWarehouseRetailPrice(option.code)?.unitPriceCents ?? option.unitPriceCents;
  if (option.code === KQ_WAREHOUSE_HANDLING_CART) return {
    ...option,
    unitPriceCents,
    name: "Chariot de manutention",
    description: "Un chariot pour tout l’entrepôt. Réduit jusqu’à 25 % le temps de chargement du lyophilisateur selon son état.",
    consumablesCentsPerM2: 0,
    unitsPerM2PerCycle: 0,
    yieldBonusPercent: 0,
    qualityBonus: 0,
  };
  const yieldBonusPercent = KQ_WAREHOUSE_TIERS.findIndex(tier => tier.code === option.tier) + 1;
  const qualityBonus = option.tier === "premium" && ["climate", "hygiene", "substrate"].includes(option.family)
    ? 2 : option.qualityBonus;
  const quality = qualityBonus > 0 ? ` Qualité au départ : +${qualityBonus}.` : "";
  return {
    ...option,
    unitPriceCents,
    ...(isKqWarehouseHandlingCode(option.code) ? { name: KQ_WAREHOUSE_HANDLING[option.code].name } : {}),
    yieldBonusPercent,
    qualityBonus,
    description: `${option.description.split(". ")[0]}. Récolte estimée : +${yieldBonusPercent} %.${quality}`,
  };
});

const zoneDevices = {
  "SIM-CLIMATE-01": { code: "SIM-CLIMATE-UNIT-01", capacityM2: 20, installationIncluded: true, name: "Déshumidificateur Meaco Arete One", description: "Ce modèle mobile condense l’humidité de l’air et recueille l’eau dans un bac de 4,8 L." },
  "SIM-CLIMATE-02": { code: "SIM-CLIMATE-UNIT-02", capacityM2: 50, name: "VMC double flux Duocosy HR", description: "Renouvelle l’air par deux circuits et récupère la chaleur de l’air extrait." },
  "SIM-CLIMATE-03": { code: "SIM-CLIMATE-UNIT-03", capacityM2: 100, name: "Centrale Atlantic Nova HR 1000 BT", description: "Cette centrale double flux de 1 000 m³/h renouvelle l’air des grands volumes et préchauffe l’air entrant." },
  "SIM-CONTROL-01": { code: "SIM-CONTROL-UNIT-01", capacityM2: 10, installationIncluded: true, name: "Thermohygromètre SwitchBot Meter Plus", description: "Ce capteur affiche la température et l’humidité sur son écran et les transmet par Bluetooth." },
  "SIM-CONTROL-02": { code: "SIM-CONTROL-UNIT-02", capacityM2: 50, name: "Contrôleur TrolMaster Hydro-X", description: "Sa sonde relève température, humidité et lumière. Le contrôleur commande les appareils raccordés d’une zone." },
  "SIM-CONTROL-03": { code: "SIM-CONTROL-UNIT-03", capacityM2: 100, name: "Console TrolMaster Hydro-X Pro", description: "L’écran tactile de 10 pouces permet de programmer plusieurs secteurs d’une salle avec des sondes et des modules compatibles." },
} as const;

export function isKqWarehouseLegacyZoneOption(code: string): code is keyof typeof zoneDevices {
  return Object.hasOwn(zoneDevices, code);
}

export function isKqWarehouseZoneDevice(option: KqWarehouseOption): option is Extract<KqWarehouseOption, { unit: "device" }> {
  return option.unit === "device";
}

export const KQ_WAREHOUSE_OPTIONS: readonly KqWarehouseOption[] = balancedOptions.map(option => {
  if (!isKqWarehouseLegacyZoneOption(option.code)) return option;
  const device = zoneDevices[option.code];
  const retail = getKqWarehouseRetailPrice(device.code);
  if (!retail) throw new Error(`Tarif manquant pour ${device.code}.`);
  return { ...option, ...device, unit: "device", unitPriceCents: retail.unitPriceCents };
});

const archivedZoneOptions = balancedOptions.filter(option => isKqWarehouseLegacyZoneOption(option.code));
const allOptions = [...KQ_WAREHOUSE_OPTIONS, ...archivedZoneOptions];
export const KQ_WAREHOUSE_OPTION_CODE_COUNT = allOptions.length;

export const KQ_WAREHOUSE_LEGACY_OPTION_LIMITS = { yieldBonusPercent: 20, qualityBonus: 4 } as const;
export const KQ_WAREHOUSE_OPTION_LIMITS = { yieldBonusPercent: 24, qualityBonus: 4 } as const;
export const getKqWarehouseOption = (code: string, balanceVersion: 1 | 2 = 2) =>
  (balanceVersion === 1 ? KQ_WAREHOUSE_LEGACY_OPTIONS : allOptions).find(option => option.code === code);

/** Round at the zone boundary. A spare part of a device cannot serve another zone. */
export function getKqWarehouseZoneOptionQuantity(code: string, areaM2: number): number {
  const option = getKqWarehouseOption(code);
  if (!option || !Number.isSafeInteger(areaM2) || areaM2 < 0) throw new Error("Surface de module invalide.");
  return isKqWarehouseZoneDevice(option) ? Math.ceil(areaM2 / option.capacityM2) : areaM2;
}

export function getKqWarehouseZoneModuleEffect(option: KqWarehouseOption, modern: boolean) {
  const { yieldBonusPercent, qualityBonus } = option;
  const unchanged = { yieldBonusPercent, qualityBonus, supplySavingCentsPerM2: 0 };
  if (!modern) return unchanged;

  const tierIndex = KQ_WAREHOUSE_TIERS.findIndex(tier => tier.code === option.tier);
  switch (option.family) {
    case "hygiene":
      return { yieldBonusPercent: 0, qualityBonus: tierIndex + 1, supplySavingCentsPerM2: 0 };
    case "logistics":
      return { yieldBonusPercent: 0, qualityBonus: 0, supplySavingCentsPerM2: [110, 0, 310][tierIndex] };
    case "security":
      return { yieldBonusPercent: 0, qualityBonus: 0, supplySavingCentsPerM2: [125, 250, 400][tierIndex] };
    default:
      return unchanged;
  }
}

export function validateKqWarehouseOptionCodes(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > KQ_WAREHOUSE_OPTION_FAMILIES.length) return false;
  const families = new Set<KqWarehouseOptionFamily>();
  for (const code of value) {
    const option = typeof code === "string" ? getKqWarehouseOption(code) : undefined;
    if (!option || families.has(option.family)) return false;
    families.add(option.family);
  }
  return true;
}

export type KqWarehouseOptionLine = {
  code: string;
  unit?: "station" | "handling" | "device";
  /** Inventory quantity in the product's own unit. */
  quantity: number;
  /** Actual surface of a quoted zone, even when the final device is only partially used. */
  treatedAreaM2?: number;
  option: KqWarehouseOption;
  totalCents: number;
  consumablesCostCents: number;
};

export function getKqWarehouseOptionLine(code: string, quantity: number, balanceVersion: 1 | 2 = 2, treatedAreaM2?: number): KqWarehouseOptionLine {
  const option = getKqWarehouseOption(code, balanceVersion);
  if (!option || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 100_000) throw new Error("Module de simulation invalide.");
  const cycleArea = treatedAreaM2 ?? (isKqWarehouseZoneDevice(option) ? 0 : quantity);
  return { code, quantity, option, ...(option.unit ? { unit: option.unit } : {}),
    ...(treatedAreaM2 === undefined ? {} : { treatedAreaM2 }),
    totalCents: option.unitPriceCents * quantity, consumablesCostCents: option.consumablesCentsPerM2 * cycleArea };
}
