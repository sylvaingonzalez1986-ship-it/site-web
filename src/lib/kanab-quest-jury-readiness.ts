import type { KqOfficialFlower } from "./kanab-quest-api";
import { normalizeKqFlowerTrim } from "./kanab-quest-flower-trim";

/** Preparation advice only; the server still authorizes every jury entry. */
export function getKqTrimPresentation(value: unknown) {
  const trim = normalizeKqFlowerTrim(value);
  if (trim.status === "ready") return { status: trim.status, label: "Trim validé", description: "Aucun travail de trim restant pour ce lot.", buttonLabel: "Voir le trim" };
  if (trim.status === "unknown") return { status: trim.status, label: "Trim à vérifier", description: "Le trim de ce lot n’a pas pu être confirmé. Actualise son suivi ou vérifie-le dans l’Atelier avant le jury.", buttonLabel: "Vérifier le trim" };
  if (trim.status === "in-progress") {
    const quantity = trim.completedGrams !== null && trim.totalGrams !== null
      ? `${trim.completedGrams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g sur ${trim.totalGrams.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g confirmés. ` : "";
    return { status: trim.status, label: "Trim partiel", description: `${quantity}Le trim doit être terminé avant le jury. Retrouve le travail restant dans l’Atelier.`, buttonLabel: "Continuer le trim" };
  }
  return { status: trim.status, label: "Trim à faire", description: "Le trim retire les petites feuilles de la récolte. Fais-le dans l’Atelier, toi-même ou avec un employé, même pendant l’affinage.", buttonLabel: "Faire le trim" };
}

export function getKqJuryReadiness(flower: Pick<KqOfficialFlower, "status" | "storage" | "trim"> | undefined) {
  const trim = getKqTrimPresentation(flower?.trim);
  if (!flower || flower.status !== "available") return { ready: false, label: "Fleur indisponible", description: "Actualise la réserve pour retrouver l’état de cette Fleur." };
  if (flower.storage?.stage === "curing") return { ready: false, label: "En affinage", description: "L’affinage doit être terminé avant le jury. Le trim peut être préparé pendant cette attente." };
  if (flower.storage?.stage !== "ready") return { ready: false, label: "Affinage à vérifier", description: "L’état de l’affinage n’est pas confirmé. Vérifie le stockage avant le jury." };
  if (trim.status !== "ready") return { ready: false, label: trim.label, description: trim.description };
  return { ready: true, label: "Prête pour le jury", description: "Affinage terminé · trim validé" };
}

export function getKqTrimHref(flowerId: string, from: "harvests" | "workshop" | "arena", fromSection?: "storage") {
  const query = new URLSearchParams({ view: "workshop", section: "processing", workshop: "trim", flower: flowerId, from, fromFlower: flowerId });
  if (fromSection) query.set("fromSection", fromSection);
  return `/arene/placard?${query.toString()}`;
}
