/** Expected game limits must stay readable instead of becoming a service outage. */
export function getKqPlayerWorkErrorMessage(error: unknown): string | null {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (/\bstaff_production_machine_reserved\b/.test(message)) return "Ce tamis est réservé à la production autonome. Suspends les nouveaux cycles et termine les lots avant de le réaffecter.";
  if (/\bstaff_production_occupied\b/.test(message)) return "Cette zone ou son équipement est réservé à la production autonome. Termine et vends ses lots avant de changer son affectation.";
  if (/\bstaff_production_capacity\b/.test(message)) return "Le séchage ou le stockage disponible ne suffit pas pour cette réservation. Vérifie les capacités de l’Entrepôt.";
  if (/\bstaff_production_hours\b/.test(message)) return "Ce créneau dépasse les heures disponibles ou chevauche une activité. Actualise le planning et vérifie les durées.";
  if (/\bstaff_production_(changed|invalid)\b/.test(message)) return "Les conditions de production ont changé. Actualise Personnel et vérifie les règles avant de confirmer.";
  if (/\bculture_work_exhausted\b/.test(message)) return "La réserve Culture de l’employé ne permet plus cette étape. Ajoute des heures dans Personnel ou attends le prochain jour travaillé. Aucune heure n’a été débitée.";
  if (/\bculture_work_changed\b/.test(message)) return "La prise en charge ou l’étape de culture a changé. Actualise avant de confirmer le lancer.";
  if (/\bplayer_work_exhausted\b/.test(message)) return "Il ne te reste pas assez d’heures sur tes 12 h de travail personnel. Délègue cette tâche ou attends la prochaine journée du jeu. Aucune heure ni dépense n’a été débitée.";
  if (/\bplayer_work_changed\b/.test(message)) return "Ta journée ou ton temps disponible a changé. Actualise le planning avant de confirmer.";
  return null;
}
