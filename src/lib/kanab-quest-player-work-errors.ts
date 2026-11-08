/** Expected game limits must stay readable instead of becoming a service outage. */
export function getKqPlayerWorkErrorMessage(error: unknown): string | null {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (/\bculture_work_exhausted\b/.test(message)) return "La réserve Culture de l’employé ne permet plus cette étape. Ajoute des heures dans Personnel ou attends le prochain jour travaillé. Aucune heure n’a été débitée.";
  if (/\bculture_work_changed\b/.test(message)) return "La prise en charge ou l’étape de culture a changé. Actualise avant de confirmer le lancer.";
  if (/\bplayer_work_exhausted\b/.test(message)) return "Il ne te reste pas assez d’heures sur tes 12 h de travail personnel. Délègue cette tâche ou attends la prochaine journée du jeu. Aucune heure ni dépense n’a été débitée.";
  if (/\bplayer_work_changed\b/.test(message)) return "Ta journée ou ton temps disponible a changé. Actualise le planning avant de confirmer.";
  return null;
}
