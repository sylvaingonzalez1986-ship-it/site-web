/** Fictional workshop capacities, expressed in grams of source flowers per lot.
 * They are balancing values, not manufacturer specifications or extraction instructions.
 * The persisted 1–10 index retains old purchases while describing three configurations.
 */
const MACHINES: Readonly<Record<string, { capacity: number; precision: number; names: readonly [string, string, string] }>> = {
  "SIFT-TRAY": { capacity: 120, precision: 82, names: ["Tamisage de découverte", "Tamisage d’atelier", "Tamisage professionnel"] },
  "PRESS-0600": { capacity: 80, precision: 74, names: ["Presse compacte", "Presse d’atelier", "Presse professionnelle"] },
  "WASHER-25L": { capacity: 180, precision: 78, names: ["Laveuse compacte", "Laveuse d’atelier", "Laveuse professionnelle"] },
  "AUTO-SIEVE": { capacity: 500, precision: 88, names: ["Collecte assistée", "Collecte automatisée", "Collecte professionnelle"] },
  "FREEZE-DRYER": { capacity: 500, precision: 92, names: ["Séchage spécialisé", "Séchage d’atelier", "Séchage professionnel"] },
  "STATIC-PLASMA": { capacity: 120, precision: 96, names: ["Séparation de précision", "Séparation d’atelier", "Séparation professionnelle"] },
};

export function getKqWorkshopMachineSpecification(code: string, requestedLevel = 1) {
  const machine = Object.hasOwn(MACHINES, code) ? MACHINES[code] : null;
  if (!machine) return null;
  const level = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 10 ? requestedLevel : 1;
  const configuration = level >= 7 ? 2 : level >= 4 ? 1 : 0;
  const step = level - [1, 4, 7][configuration];
  return {
    name: machine.names[configuration], configuration: configuration + 1,
    capacityGrams: Math.round(machine.capacity * [1, 2, 4][configuration] * (1 + step * 0.15)),
    precision: Math.min(99.5, machine.precision + (99.5 - machine.precision) * (level - 1) / 12),
    improvement: step === 0 && configuration > 0 ? "Changement de configuration"
      : step === 0 ? "Installation initiale" : step === 1 ? "Réglage et calibration"
        : step === 2 ? "Organisation du poste" : "Optimisation du poste",
  };
}
