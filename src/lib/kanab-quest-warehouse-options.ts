import { KQ_WAREHOUSE_TIERS, type KqWarehouseTier } from "./kanab-quest-warehouse-catalog";

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
  equipmentCentsPerM2: number;
  consumablesCentsPerM2: number;
  unitsPerM2PerCycle: number;
  yieldBonusPercent: number;
  qualityBonus: number;
};

const profile = (family: KqWarehouseOptionFamily, suffix: string, name: string, description: string,
  equipmentCentsPerM2: number, consumablesCentsPerM2: number, unitsPerM2PerCycle: number,
  yieldBonusPercent: number, qualityBonus: number): KqWarehouseOption => ({
  code: `SIM-${family.toUpperCase()}-${suffix}`, family,
  tier: KQ_WAREHOUSE_TIERS[Number(suffix) - 1].code,
  name: `${KQ_WAREHOUSE_OPTION_FAMILIES.find(item => item.code === family)!.label} ${KQ_WAREHOUSE_TIERS[Number(suffix) - 1].label.toLocaleLowerCase("fr")}`,
  description: `${name}. ${description}`,
  equipmentCentsPerM2, consumablesCentsPerM2, unitsPerM2PerCycle, yieldBonusPercent, qualityBonus,
});

export const KQ_WAREHOUSE_OPTIONS: readonly KqWarehouseOption[] = [
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

export const KQ_WAREHOUSE_OPTION_LIMITS = { yieldBonusPercent: 20, qualityBonus: 4 } as const;
export const getKqWarehouseOption = (code: string) => KQ_WAREHOUSE_OPTIONS.find(option => option.code === code);

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
  /** One purchased unit covers one square metre, even when the zone is inactive. */
  quantity: number;
  option: KqWarehouseOption;
  totalCents: number;
  consumablesCostCents: number;
};

export function getKqWarehouseOptionLine(code: string, quantity: number): KqWarehouseOptionLine {
  const option = getKqWarehouseOption(code);
  if (!option || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 100_000) throw new Error("Module de simulation invalide.");
  return { code, quantity, option, totalCents: option.equipmentCentsPerM2 * quantity,
    consumablesCostCents: option.consumablesCentsPerM2 * quantity };
}
