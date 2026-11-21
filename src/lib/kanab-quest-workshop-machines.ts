import { getKqWorkshopPriceList } from "./kanab-quest-warehouse-retail";

/** Fictional workshop capacities, expressed in grams of source flowers per lot.
 * They are balancing values, not manufacturer specifications or extraction instructions.
 * The persisted 1–10 index retains old purchases while describing three configurations.
 */
export const KQ_WORKSHOP_MACHINE_TIERS = [
  { code: "economy", label: "Économique", level: 1 },
  { code: "standard", label: "Standard", level: 4 },
  { code: "premium", label: "Haut de gamme", level: 7 },
] as const;
export type KqWorkshopTierLevel = typeof KQ_WORKSHOP_MACHINE_TIERS[number]["level"];

const MACHINES: Readonly<Record<string, { capacity: number; precision: number; names: readonly [string, string, string] }>> = {
  "SIFT-TRAY": { capacity: 120, precision: 82, names: ["Tamis compact", "Tamis d’atelier", "Tamis professionnel"] },
  "PRESS-0600": { capacity: 80, precision: 74, names: ["Presse compacte", "Presse d’atelier", "Presse professionnelle"] },
  "WASHER-25L": { capacity: 180, precision: 78, names: ["Laveuse compacte", "Laveuse d’atelier", "Laveuse professionnelle"] },
  "AUTO-SIEVE": { capacity: 500, precision: 88, names: ["Collecteur compact", "Collecteur d’atelier", "Collecteur professionnel"] },
  "FREEZE-DRYER": { capacity: 500, precision: 92, names: ["Sécheur compact", "Sécheur d’atelier", "Sécheur professionnel"] },
  "STATIC-PLASMA": { capacity: 120, precision: 96, names: ["Séparateur compact", "Séparateur d’atelier", "Séparateur professionnel"] },
};

export function getKqWorkshopMachineSpecification(code: string, requestedLevel = 1) {
  const machine = Object.hasOwn(MACHINES, code) ? MACHINES[code] : null;
  if (!machine) return null;
  const level = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 10 ? requestedLevel : 1;
  const configuration = level >= 7 ? 2 : level >= 4 ? 1 : 0;
  const step = level - [1, 4, 7][configuration];
  return {
    name: machine.names[configuration], configuration: configuration + 1,
    tier: KQ_WORKSHOP_MACHINE_TIERS[configuration],
    // Real elapsed game time per abstract batch; never a manufacturer cadence.
    durationSeconds: code === "FREEZE-DRYER" ? 21_600 : code === "WASHER-25L" ? 7_200 : 3_600,
    capacityGrams: Math.round(machine.capacity * [1, 2, 4][configuration] * (1 + step * 0.15)),
    precision: Math.min(99.5, machine.precision + (99.5 - machine.precision) * (level - 1) / 12),
    improvement: step === 0 && configuration > 0 ? "Changement de configuration"
      : step === 0 ? "Installation initiale" : step === 1 ? "Réglage et calibration"
        : step === 2 ? "Organisation du poste" : "Optimisation du poste",
  };
}

/** Cumulative values make a direct purchase and successive upgrades cost the same. */
export function getKqWorkshopLevelValue(code: string, level: number): number | null {
  const offers = getKqWorkshopPriceList(code);
  if (!offers || !Number.isInteger(level) || level < 0 || level > 10) return null;
  if (level === 0) return 0;
  const [economy, standard, premium] = offers.map(offer => offer.gamePriceCents);
  if (level <= 4) return economy + Math.floor((standard - economy) * (level - 1) / 3);
  if (level <= 7) return standard + Math.floor((premium - standard) * (level - 4) / 3);
  let value = premium;
  for (let previous = 7; previous < level; previous++) value += Math.ceil(economy * previous / 10);
  return value;
}

export function getKqWorkshopTierPrice(code: string, targetLevel: number, currentLevel = 0): number | null {
  if (!KQ_WORKSHOP_MACHINE_TIERS.some(tier => tier.level === targetLevel) || targetLevel <= currentLevel) return null;
  const target = getKqWorkshopLevelValue(code, targetLevel);
  const owned = getKqWorkshopLevelValue(code, currentLevel);
  return target === null || owned === null ? null : target - owned;
}

/** Presentation only: no branded specification changes the simulated machine. */
export function getKqWorkshopMachinePresentation(code: string, level = 1) {
  const machine = getKqWorkshopMachineSpecification(code, level);
  if (!machine) return null;
  const descriptions: Record<string, string> = {
    "SIFT-TRAY": "Un poste de tri pour ouvrir la première filière de transformation de l’atelier.",
    "PRESS-0600": "Une presse indépendante, disponible en trois gammes pour les lots de l’atelier.",
    "WASHER-25L": "Une laveuse pour développer les filières de transformation du jeu.",
    "AUTO-SIEVE": "Un collecteur qui complète la laveuse dans les filières avancées du jeu.",
    "FREEZE-DRYER": "Un sécheur qui complète les machines de l’atelier pour les filières avancées.",
    "STATIC-PLASMA": "Un séparateur qui complète le poste de tri dans la filière de précision du jeu.",
  };
  return {
    name: machine.name,
    shortDescription: descriptions[code],
    specification: `${machine.tier.label} · atelier commun · capacité de jeu ${machine.capacityGrams} g par lot`,
    tradeoff: "La gamme augmente l’investissement et la capacité de jeu. L’installation, les prérequis de filière et l’entretien restent nécessaires.",
  };
}
