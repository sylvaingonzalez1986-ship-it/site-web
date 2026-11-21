import type { KqStaffContext, KqStaffSnapshot } from "./kanab-quest-staff-types";

const places: Record<string, string> = {
  culture: "Culture", commerce: "Commerce", online: "Boutique en ligne", social: "Réseaux sociaux",
  storage: "Stockage", warehouse: "Entrepôt", equipment: "Équipement", administration: "Administration",
};
const actions: Record<string, string> = {
  start: "Démarrer une culture", care: "Appliquer un soin", "buy-care": "Acheter un soin",
  prepare: "Préparer un lot", advertise: "Promouvoir la ferme", sell: "Vendre un lot",
  "create-shop": "Ouvrir une boutique", "rename-shop": "Renommer la boutique", "pay-lab": "Payer le laboratoire",
  "pay-supplier": "Payer un fournisseur", "pay-all-invoices": "Régler les factures", "buy-computer": "Acheter un ordinateur",
  "renew-shop": "Renouveler la boutique", "create-listing": "Publier une annonce",
  "start-marketing": "Lancer une campagne", "buy-packaging": "Acheter des emballages", "update-listing": "Modifier une annonce",
  "upgrade-site": "Améliorer la boutique", "buy-upgrade": "Acheter une amélioration", "buy-studio-level": "Améliorer le studio",
  "choose-studio-style": "Aménager le studio", "buy-merch-module": "Équiper la boutique", "buy-merch-stock": "Acheter du stock",
  "update-merch": "Modifier les produits", "sponsor-post": "Publier pour un sponsor", choose: "Préparer une publication",
  "sponsor-accept": "Accepter un partenariat", buy: "Acheter du stockage", assign: "Affecter le stockage",
  place: "Ranger un lot", "sell-overflow": "Vendre le surplus", save: "Aménager l’entrepôt",
  "remove-zone": "Retirer une zone", purchase: "Acheter un équipement", upgrade: "Améliorer un équipement",
  repair: "Réparer un équipement", replace: "Remplacer un équipement", install: "Installer un équipement",
  "workshop-tier": "Équiper l’atelier", "pay-energy": "Régler l’énergie",
};

export function getKqWorkerBusyUntil(context: KqStaffContext, assigneeId: string) {
  return (context.teamWork ?? []).reduce((end, receipt) => {
    if (receipt.kind === "culture" || receipt.assigneeId !== assigneeId) return end;
    // A Postgres microsecond may fall just after the millisecond JS can represent.
    const fraction = receipt.completesAt.match(/\.(\d+)(?:Z|[+-])/i)?.[1] ?? "";
    const time = Date.parse(receipt.completesAt) + (/[1-9]/.test(fraction.slice(3)) ? 1 : 0);
    return Math.max(end, time);
  }, 0);
}

export function getKqTeamWorkEntries(snapshot: KqStaffSnapshot) {
  const entries = (snapshot.context.teamWork ?? []).map(receipt => ({
    id: receipt.id, assigneeId: receipt.assigneeId, hours: receipt.hours, startedAt: receipt.startedAt,
    completesAt: receipt.completesAt, instant: receipt.kind === "culture",
    label: receipt.kind === "culture" ? `Travailler l’étape ${(receipt.stage ?? 0) + 1}` : receipt.kind === "cleaning" ? receipt.target : "Transformer le lot",
    place: receipt.kind === "cleaning" ? "Hygiène · Entrepôt" : `${receipt.kind === "culture" ? "Culture" : "Atelier"} · ${receipt.target}`,
  }));
  const manual = snapshot.state.playerActions;
  if (manual?.day === snapshot.calendar.day) manual.entries.forEach((action, index) => entries.push({
    id: `gesture-${manual.day}-${index}`, assigneeId: "player", label: actions[action.action] ?? "Travail personnel",
    place: places[action.domain] ?? "Ferme", hours: action.hours, startedAt: action.at, completesAt: action.at, instant: true,
  }));
  return entries;
}
