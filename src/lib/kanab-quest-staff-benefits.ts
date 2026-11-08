import { getKqStaffLevel, getKqStaffProspectChance } from "./kanab-quest-staff";
import { KQ_STAFF_CITIES } from "./kanab-quest-prospecting";
import { getKqStaffSharedTrimQuote } from "./kanab-quest-staff-trim";
import type { KqStaffCandidate, KqStaffContext, KqStaffSkill, KqStaffSkills, KqStaffTaskKind, KqStaffTrimMode } from "./kanab-quest-staff-types";

export type KqStaffBenefitPreview = {
  kind: KqStaffTaskKind; skillLevel: number; title: "Bénéfice prévu";
  metrics: Array<{ label: string; value: number; unit: string }>; notes: string[];
};
export type KqStaffBenefitPreviewInput = {
  actor: Pick<KqStaffCandidate, "skills" | "trait" | "role"> | { skills: KqStaffSkills };
  kind: KqStaffTaskKind; hours: number; context: KqStaffContext; cityId?: string;
  skill?: KqStaffSkill; trimMode?: KqStaffTrimMode;
};

/** Pure forecast. Actual invoices, work receipts and completed missions remain authoritative. */
export function getKqStaffBenefitPreview(input: KqStaffBenefitPreviewInput): KqStaffBenefitPreview {
  const { actor, kind, hours, context } = input;
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 12 || !Number.isInteger(hours * 2)) throw new Error("Durée de prévision invalide.");
  const trait = "trait" in actor ? actor.trait : undefined;
  const skill: KqStaffSkill = kind === "trim" ? "processing" : kind === "countryside" ? "sales" : kind === "training" ? input.skill ?? "culture" : kind;
  const level = Math.min(10, getKqStaffLevel(actor.skills[skill]) + (trait === "versatile" ? 1 : 0));
  const result: KqStaffBenefitPreview = { kind, skillLevel: level, title: "Bénéfice prévu", metrics: [], notes: [] };
  const metric = (label: string, value: number, unit: string) => { result.metrics.push({ label, value, unit }); };
  if (kind === "culture") {
    const grower = "role" in actor && actor.role === "grower";
    if (trait !== undefined && context.cultureWorkVersion === 1) {
      metric("Étapes finançables", hours * 2, "étapes");
      metric("Temps joueur épargnable", hours, "h");
    }
    metric("Vitalité maximale", Math.min(10, Math.ceil(hours)), "points");
    metric("Terpènes maximaux", Math.min(5, Math.round(hours * level * .12 * (trait === "meticulous" ? 1.2 : 1))), "points");
    metric("Rendement maximal", Math.min(2, Math.round(hours * level * (grower ? .045 : .015))), "%");
    metric("Cannabinoïdes maximaux", Math.min(5, Math.round(hours * level * (grower ? .10 : .03))), "points");
    result.notes.push(trait !== undefined && context.cultureWorkVersion === 1
      ? "Chaque étape jouée consomme 0,5 h. Les bonus sont les différences entre les totaux cumulés : arrondis et plafonds s’appliquent, puis l’état de la culture limite le gain. Six étapes demandent 3 h ; réserver davantage peut servir à d’autres cultures."
      : "Soins proposés à la fin de la mission, seulement si la culture est encore active. Les arrondis et plafonds puis l’état de la culture limitent le gain.");
    result.notes.push("Minutieux améliore seulement le calcul des terpènes ; Vif ne réduit pas le coût de 0,5 h par étape. Le chef de culture améliore le rendement et les cannabinoïdes.");
  } else if (kind === "processing") {
    if (context.processingWorkVersion === 1) {
      const efficiency = Math.min(1, (.55 + (level - 1) * .05) * (trait === "quick" ? 1.15 : trait === "meticulous" ? 1 / 1.10 : 1));
      metric("Efficacité", Math.round(efficiency * 10000) / 100, "%");
      metric("Heures réservées", hours, "h");
      result.notes.push("La vitesse dépend du lot et de la machine. Les heures servent aux tranches lancées dans l’Atelier ; les attentes passives et la disponibilité des machines restent nécessaires.");
    } else {
      metric("Délai réductible au maximum", Math.min(3600, Math.floor(hours * level * 45)), "s réelles");
      result.notes.push("Seulement sur un lot encore en transformation à la fin de la mission, dans la limite de son délai restant.");
    }
  } else if (kind === "trim") {
    const quote = getKqStaffSharedTrimQuote({ hours, level, trait, mode: input.trimMode ?? "manual" });
    metric("Cadence", quote.gramsPerHour, "g/h");
    metric("Quantité maximale", quote.grams, "g");
    metric("Qualité à la fin du lot", quote.qualityDelta, "points");
    result.notes.push("La quantité dépend des récoltes compatibles disponibles. La qualité est appliquée une fois par lot terminé. Le trim mécanique exige la machine commune et réduit la qualité.");
  } else if (kind === "communication") {
    const offered = Math.min(500, Math.round(hours * (6 + level * 4) * (trait === "outgoing" ? 1.2 : 1)));
    metric("Abonnés Instagram au maximum", Math.min(offered, Math.max(0, 50_000 - context.instagramFollowers)), "abonnés");
    metric("Réputation proposée", Math.min(25, Math.ceil(hours * level / 4)), "points");
    result.notes.push("Plafonds : 500 abonnés par mission, 50 000 sur Instagram et 100 000 d’audience boutique. Le gain réel dépend de l’audience à la fin ; aucune recette n’est garantie.");
  } else if (kind === "sales" || kind === "countryside") {
    const city = kind === "sales" ? KQ_STAFF_CITIES.find(row => row.id === input.cityId) : undefined;
    const attempts = kind === "countryside" ? 2 : context.staffBenefitsVersion === 1 ? Math.min(trait === undefined ? 6 : 3, Math.max(1, Math.floor(hours / 2))) : 1;
    const chance = Math.round(Math.min(90, getKqStaffProspectChance(level, context.reputation, context.instagramFollowers, trait === "outgoing") + (city?.prospectIntensity ?? 0) / 2));
    metric("Tentatives", attempts, "tentatives");
    metric("Réussite par tentative", chance, "%");
    metric("Par réussite", 1, "partenaire");
    metric("Réputation par réussite", 5, "points");
    result.notes.push(kind === "countryside" ? "Deux tentatives sur une journée de 12 h. Les contacts restent aléatoires."
      : context.staffBenefitsVersion === 1 ? "Une tentative par tranche complète de 2 h ; les tentatives restent dans la même ville et le déplacement est facturé une seule fois par mission. Aucun succès garanti."
      : "Une tentative par mission, dès 2 h ; prolonger la mission n’ajoute pas de tentative sur cette version. Le déplacement est facturé une seule fois. Aucun succès garanti.");
    result.notes.push("Chaque partenaire ajoute 250 unités au budget commercial ; il ne s’agit pas de 250 € de recettes.");
    if (kind === "sales" && !city) result.notes.push("Choisis une ville pour inclure son attractivité dans la probabilité.");
    if (kind === "sales" && hours < 2) result.notes.push("La prospection exige au moins 2 h.");
  } else if (kind === "administration") {
    metric("Remise fournisseurs négociable", Math.min(10, Math.round(level * .7 + (trait === "organized" ? 2 : 0))), "%");
    metric("Validité après mission", 7, "jours du jeu");
    metric("Expérience", Math.min(Math.max(0, 8100 - actor.skills.administration), Math.round(hours * 12 * (trait === "learner" ? 1.25 : 1))), "XP");
    result.notes.push("Sur les nouvelles factures de consommables au lancement des cultures Entrepôt. Anciens soldes, soins/PBI séparés, machines, énergie et salaires exclus.");
    result.notes.push("0,5 h suffit pour la même remise et la même durée. Les remises ne s’additionnent pas : la meilleure active est conservée et prolongée. Les paiements récurrents demandent des règles explicitement activées ; au plus un document par 0,5 h, sous plafond et réserve.");
  } else {
    const gain = Math.min(Math.max(0, 8100 - actor.skills[skill]), Math.round(hours * 60 * (trait === "learner" ? 1.25 : 1)));
    metric("Expérience", gain, "XP");
    metric("Niveau après formation", getKqStaffLevel(actor.skills[skill] + gain), "/10");
    result.notes.push("Gain à la fin de la formation dans la compétence choisie ; plafond de 8 100 XP. Le devis confirme son coût avant réservation.");
  }
  return result;
}
