export type KqFeedbackTone = "success" | "warning" | "error";

export function getKqFeedbackTone(message: string): KqFeedbackTone {
  if (/impossible|indisponible|introuvable|invalide|refus|erreur|aucune copie|a évolué/i.test(message)) {
    return "error";
  }
  if (/attention|dormant|inactif|en attente|partiel/i.test(message)) return "warning";
  return "success";
}
