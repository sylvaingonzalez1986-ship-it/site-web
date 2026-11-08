import type { KqProcessingMachine, KqProcessingPlan } from "./kanab-quest-processing-work";

// Evidence and material distinctions: processing-manufacturer-sources-2026-11-08.json.
// All hourly values other than the washer-derived and static-output references
// are explicitly game estimates. No recipe, temperature or pressure is modeled.
export const KQ_PROCESSING_PROFILE_VERSION = 1;
const SOURCE = {
  sift: "https://theoriginalresinator.com/product/resinator-og-extraction-machine/",
  washer: "https://www.lowtemp-plates.com/products/mini-osprey-30-gallon-washing-machine",
  filter: "https://www.lowtemp-plates.com/products/the-autosieve",
  static: "https://sambocreeck.com/products/separatore-tribostatico",
  press: "https://www.lowtemp-plates.com/products/lowtemp-v2-rosin-press",
  dryer: "https://www.tciscientific.com/category/HiLyph-Hash-Dryers",
};
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const levelOf = (level: number) => Number.isInteger(level) && level >= 1 && level <= 10 ? level : 1;
const replacements: Record<string, string> = { "WASHER-75G": "WASHER-25L", "TSS-225": "WASHER-25L", "PRESS-2T": "PRESS-0600", "PRESS-10T": "PRESS-0600", "PRESS-20T": "PRESS-0600" };
type Reference = Omit<KqProcessingMachine, "quantityGrams" | "hours">;
export function getKqProcessingMachineReference(code: string, requestedLevel = 1): Reference | null {
  const canonical = replacements[code] ?? code;
  const level = levelOf(requestedLevel);
  // Better organization approaches, but never exceeds, the reference machine.
  const utilization = .75 + (level - 1) / 36;
  const common = { code, estimated: true, basis: "input" as const, material: "fleurs sèches" };
  const references: Record<string, Reference> = {
    "SIFT-TRAY": { ...common, name: "Tamisage", model: "Resinator OG · référence", sourceUrl: SOURCE.sift,
      specification: "Jusqu’à environ 1 361 g de trim sec par lot ; durée non publiée.",
      gramsPerHour: round(1000 * utilization),
      note: "Cadence de jeu estimée pour les fleurs sèches. La capacité constructeur porte sur du trim sec ; elle ne prouve pas un débit horaire." },
    "WASHER-25L": { ...common, name: "Lavage", model: "Mini Osprey 2.0 · référence", sourceUrl: SOURCE.washer,
      specification: "2 100 g de matière sèche par lot ; environ 2 h par lot complet selon le fabricant.",
      gramsPerHour: round(1050 * utilization),
      note: "Plafond théorique calculé : 1 050 g secs/h. Le débit continu, l’organisation du poste et la part de travail humain sont simulés ; aucun gramme frais n’est assimilé à un gramme sec." },
    "AUTO-SIEVE": { ...common, name: "Collecte", model: "Lowtemp AutoSieve · référence", sourceUrl: SOURCE.filter,
      specification: "Collecteur associé au système de lavage ; aucun débit massique publié.",
      material: "équivalent de fleurs sèches du lot", gramsPerHour: round(2100 * utilization),
      note: "Cadence de jeu estimée sur le volume source, choisie pour que la collecte ne ralentisse pas la laveuse de référence. Ce n’est pas une capacité fabricant." },
    "STATIC-PLASMA": { ...common, name: "Séparation", model: "Plasmastatic V1.8 · référence", sourceUrl: SOURCE.static,
      specification: "500 g de produit fini par heure annoncés.", material: "produit fini prévu", basis: "output",
      gramsPerHour: round(500 * utilization),
      note: "Temps calculé sur le produit fini prévu par le jeu, jamais sur le poids des fleurs. La progression, le rendement et l’utilisation du poste sont simulés." },
    "PRESS-0600": { ...common, name: "Pressage", model: `Lowtemp V2 ${level >= 4 ? "4×7" : "3×5"} · référence`, sourceUrl: SOURCE.press,
      specification: level >= 4 ? "15 à 25 g de fleurs par cycle ; aucune cadence horaire publiée." : "5 à 10 g de fleurs par cycle ; aucune cadence horaire publiée.",
      gramsPerHour: round((level >= 4 ? 250 : 100) * utilization),
      note: "Cadence de jeu estimée avec manipulation comprise. Les charges de hash par cycle ne sont pas utilisées pour chiffrer des fleurs. Les niveaux restent des configurations du jeu." },
    "FREEZE-DRYER": { ...common, name: "Séchage autonome", model: "HiLyph Hash Dryer XL · référence", sourceUrl: SOURCE.dryer,
      specification: "Environ 5 443 g de charge humide ; durée non publiée.", material: "charge humide simulée", basis: "passive", gramsPerHour: null,
      note: "Attente de jeu estimée : 24 h par charge, plus 0,5 h de manutention. Charge humide simulée à quatre fois le produit fini prévu ; le jeu ne mesure pas l’humidité. Ce ratio est une hypothèse de jeu, pas une donnée constructeur." },
  };
  const ref = references[canonical];
  if (!ref) return null;
  return code === canonical ? ref : { ...ref, note: `${ref.note} Ancien équipement repris avec le profil actuel de sa famille, sans attribuer ces chiffres à son ancien fabricant.` };
}

/** Aggregate serial stages in hours of game work; sources keep their own units. */
export function createKqProcessingPlan(input: { inputGrams: number; productGrams: number; equipmentCodes: string[]; levels?: Record<string, number> }): KqProcessingPlan | null {
  if (![input.inputGrams, input.productGrams].every(value => Number.isFinite(value) && value > 0 && value <= 1_000_000) || input.productGrams > input.inputGrams) return null;
  const machines: KqProcessingMachine[] = [];
  let nominalHours = 0, passiveHours = 0;
  for (const code of [...new Set(input.equipmentCodes)]) {
    const reference = getKqProcessingMachineReference(code, input.levels?.[code] ?? 1);
    if (!reference) return null;
    if (reference.basis === "passive") {
      // A disclosed simulation ratio, not a conversion from the dry flower weight.
      const wetGrams = input.productGrams * 4;
      const batches = Math.ceil(wetGrams / 5443);
      const hours = batches * 24;
      passiveHours += hours; nominalHours += batches * .5;
      machines.push({ ...reference, quantityGrams: round(wetGrams), hours });
    } else {
      const quantityGrams = reference.basis === "output" ? input.productGrams : input.inputGrams;
      const hours = quantityGrams / reference.gramsPerHour!;
      nominalHours += hours;
      machines.push({ ...reference, quantityGrams, hours: round(hours) });
    }
  }
  if (!machines.length || nominalHours <= 0) return null;
  return { version: 1, profileVersion: 1, inputGrams: input.inputGrams,
    nominalHours: Math.max(.000001, round(nominalHours)), passiveHours, machines,
    sources: machines.map(machine => ({ label: machine.model, url: machine.sourceUrl })), estimated: true };
}
