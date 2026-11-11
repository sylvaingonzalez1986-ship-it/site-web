import { FARM_GUIDE_CHAPTERS, parseFarmGuide, type FarmGuideChapterId, type FarmGuideFacts } from "./kanab-quest-farm-guide";

/** Learning goals, not a slideshow. Only observed game state can complete a goal. */
export const FARM_GUIDE_STEPS = [
  { id: "welcome", chapter: "arrival", group: "La ferme", title: "Découvrir le quartier", line: "Grand-père t’a laissé les clés. Regarde la carte : chaque bâtiment ouvre une activité de ta ferme.", target: "[data-placard-next-action]" },
  { id: "zone", chapter: "warehouse", group: "La ferme", title: "Enregistrer une zone de culture", line: "Commençons par une zone. Dessine-la sur le plan, puis vérifie le devis avant de l’enregistrer.", target: "[data-warehouse-plan-review], [data-warehouse-map]" },
  { id: "buddies", chapter: "collection", group: "La ferme", title: "Ouvrir l’album Buddies", line: "Voici les variétés de ta future ferme. Ouvre l’album Buddies pour découvrir celles que tu possèdes.", target: "[data-collection-tab=buddies]" },
  { id: "cards", chapter: "collection", group: "La ferme", title: "Découvrir les cartes de soutien", line: "Ouvre Botte du Chanvrier. Ces cartes aident tes cultures ; seuls les exemplaires joués sont consommés.", target: "[data-collection-tab=botte]" },
  { id: "packs", chapter: "packs", group: "La ferme", title: "Repérer tes packs disponibles", line: "Regardons les packs déjà disponibles. Ouvre-les si tu en as besoin ; aucun achat n’est imposé par le guide.", target: "[data-arena-tour-surface=shop]" },
  { id: "assign", chapter: "warehouse", group: "La ferme", title: "Installer un Buddie dans une zone", line: "Touche ta zone, puis Buddies. Choisis une variété et enregistre le plan pour qu’elle soit prête à cultiver.", target: "[data-warehouse-plan-review], [data-warehouse-map]" },
  { id: "launch", chapter: "culture", group: "La première culture", title: "Lancer une culture", line: "Prépare tes Buddies et tes cartes. Vérifie les coûts, puis confirme le lancement quand tu es prêt.", target: "[data-culture-start-review], [data-culture-selection], [data-culture-buddies]" },
  { id: "roll", chapter: "culture", group: "La première culture", title: "Lancer les premiers dés", line: "Lis la situation et les effets possibles, puis lance les dés avec le bouton du jeu.", target: "[data-culture-primary-action], [data-culture-situation]" },
  { id: "resolve", chapter: "culture", group: "La première culture", title: "Valider ton premier tour", line: "Les dés ont parlé. Compare tes possibilités et le résultat prévu avant de valider ta décision.", target: "[data-culture-primary-action], [data-culture-decision]" },
  { id: "harvest", chapter: "culture", group: "La première culture", title: "Aller jusqu’à la récolte", line: "Accompagne les étapes de culture. Je reste avec toi jusqu’à ce que la récolte soit enregistrée.", target: "[data-culture-primary-action], [data-harvest-moment], [data-culture-selection]" },
  { id: "store", chapter: "storage", group: "De la récolte à la vente", title: "Ranger ta récolte", line: "Retrouvons le lot récolté. Choisis ses contenants : le rangement sera validé quand tout le lot sera protégé.", target: "[data-storage-inventory]" },
  { id: "trim", chapter: "warehouse", group: "De la récolte à la vente", title: "Préparer les fleurs à l’Atelier", line: "Rejoins le trim à la main ou à la machine, avec ton équipe. Choisis une personne et ses heures : l’atelier prépare automatiquement les récoltes. Le guide suit toujours ce lot ; le jury attend la fin de son trim et de son affinage.", target: "[data-guide-trim-flower-id]" },
  { id: "cure", chapter: "storage", group: "De la récolte à la vente", title: "Laisser finir l’affinage", line: "Le trim est vérifié. La date du lot fait foi pour l’affinage ; profitons de l’attente pour découvrir les comptes.", target: "[data-storage-inventory]" },
  { id: "jury", chapter: "jury", group: "De la récolte à la vente", title: "Obtenir un verdict du jury", line: "Présente cette Fleur au jury. Lis la confirmation : le duel consomme la Fleur d’Arène, pas le stock récolté.", target: "[data-culture-ranked-flower], [data-culture-training-flower], [data-culture-open-storage]" },
  { id: "sale", chapter: "sale", group: "De la récolte à la vente", title: "Réaliser une première vente", line: "Prépare le produit et compare le montant net. L’objectif sera rempli au reçu de vente, pas à la mise en annonce.", target: "[data-screen]" },
  { id: "accounts", chapter: "accounts", group: "Faire grandir la ferme", title: "Consulter tes factures", line: "Ouvre les factures de la ferme. Repère ce qui reste à payer et les échéances avant d’investir davantage.", target: "[data-guide-invoices-tab], [data-guide-finances-ready=true], [data-pay-all-invoices]" },
  { id: "listings", chapter: "listings", group: "Faire grandir la ferme", title: "Retrouver ton stock en vente", line: "Voici le suivi des annonces et commandes. Un produit proposé n’est pas encore une recette encaissée.", target: "[data-online-listings-heading]" },
  { id: "bank", chapter: "bank", group: "Faire grandir la ferme", title: "Découvrir la banque", line: "Découvrons les financements et leurs échéances. Aucun emprunt n’est nécessaire pour continuer le guide.", target: "[id^=bank-panel-]" },
  { id: "staff-candidate", chapter: "staff", group: "L’équipe", title: "Comparer un profil et son contrat", line: "Dans Recruter, choisis un profil pour examiner ses compétences, son trait, ses contrats et le coût selon les heures. Consulter suffit : tu décideras toi-même d’embaucher.", target: "[data-staff-tab=candidates]" },
  { id: "staff-planning", chapter: "staff", group: "L’équipe", title: "Répartir le travail", line: "Ouvre Répartir le travail. Une personne peut aider à plusieurs métiers, mais toutes ses missions utilisent les mêmes heures. Le trim se confie depuis l’Atelier.", target: "[data-staff-guide=planning] > summary" },
  { id: "staff-development", chapter: "staff", group: "L’équipe", title: "Prévoir les formations et les congés", line: "Ouvre Formations et congés. Le travail terminé apporte de l’expérience ; se former coûte du temps et de l’argent. Prévois les repos et les absences avant de remplir le planning.", target: "[data-staff-guide=development] > summary" },
  { id: "staff-payroll", chapter: "staff", group: "L’équipe", title: "Prévoir la paie de l’équipe", line: "Ouvre Paie & contrats pour distinguer le budget mensuel estimé des salaires réellement échus. Le paiement se confirme ici ; Finances enregistre les charges et les dettes.", target: "[data-staff-tab=payroll]" },
  { id: "site", chapter: "business", group: "Faire grandir la ferme", title: "Découvrir le site de la ferme", line: "Dans Développer, ouvre Site internet. Regarde son état et ses coûts avant de décider de l’améliorer.", target: "[data-shop-view=site]" },
  { id: "studio", chapter: "business", group: "Faire grandir la ferme", title: "Entrer au Studio", line: "Ouvre le Studio : c’est ici que tu construis l’identité de ta ferme. Tu peux simplement regarder.", target: "[data-shop-view=brand]" },
  { id: "merch", chapter: "business", group: "Faire grandir la ferme", title: "Découvrir les produits dérivés", line: "Ouvre Produits dérivés. Compare les coûts et les stocks nécessaires avant d’envisager une fabrication.", target: "[data-shop-view=merch]" },
  { id: "promotion", chapter: "business", group: "Faire grandir la ferme", title: "Découvrir la promotion", line: "Ouvre Promouvoir. Une campagne dépense un budget ; ses prévisions ne garantissent pas des ventes.", target: "[data-shop-view=marketing]" },
  { id: "adventure", chapter: "networks", group: "Faire grandir la ferme", title: "Rencontrer les voisins", line: "Dans Réseaux, ouvre L’aventure. Les habitants du Quartier ont des histoires et des choix à te proposer.", target: "[data-social-view=story]" },
  { id: "partners", chapter: "networks", group: "Faire grandir la ferme", title: "Découvrir les partenariats", line: "Ouvre Partenariats. Lis les honoraires et les engagements ; découvrir une offre ne t’oblige pas à signer.", target: "[data-social-view=sponsors]" },
  { id: "missions", chapter: "missions", group: "Faire grandir la ferme", title: "Choisir ta prochaine direction", line: "Découvre les missions du Quartier. Tu connais les bases : à toi de décider comment faire grandir la ferme.", target: "[data-mission-center]" },
] as const;
export type FarmStep = typeof FARM_GUIDE_STEPS[number];
export type FarmStepId = FarmStep["id"];
const VISIT_STEPS = ["welcome", "buddies", "cards", "packs", "accounts", "listings", "bank", "staff-candidate", "staff-planning", "staff-development", "staff-payroll", "site", "studio", "merch", "promotion", "adventure", "partners", "missions"] as const;
export type FarmVisitId = typeof VISIT_STEPS[number];
export type FarmProgress = { version: 2; active: boolean; started: boolean; collapsed: boolean; completed: FarmStepId[]; flowerId?: string };
export type FarmEvidence = {
  error?: boolean; visits?: FarmVisitId[]; savedZones?: number; assignedZones?: number;
  cultureStarted?: boolean; rolled?: boolean; turnResolved?: boolean; harvestId?: string;
  lots?: { id: string; protected: boolean; ready: boolean }[]; juryIds?: string[]; saleId?: string;
  trim?: { id: string; state: "required" | "running" | "queued" | "complete" | "not-required" };
};
export const emptyFarmProgress = (): FarmProgress => ({ version: 2, active: false, started: false, collapsed: false, completed: [] });
const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
export function parseFarmProgress(raw: string | null): FarmProgress | null {
  if (raw === null) return emptyFarmProgress();
  try {
    const row = JSON.parse(raw);
    if (row?.version === 1) {
      const previous = parseFarmGuide(raw);
      // Reading the old slideshow is not evidence that the player performed its tasks.
      return previous ? { ...emptyFarmProgress(), active: previous.active, started: previous.active || previous.read.length > 0, collapsed: previous.read.length > 0 } : null;
    }
    if (row?.version !== 2 || typeof row.active !== "boolean" || typeof row.started !== "boolean" || typeof row.collapsed !== "boolean"
      || !Array.isArray(row.completed) || row.completed.some((id: unknown) => !FARM_GUIDE_STEPS.some(step => step.id === id))
      || (row.flowerId !== undefined && !validId(row.flowerId))) return null;
    const completed = new Set<FarmStepId>(row.completed);
    // A saved verdict or sale already passed the server prerequisites, including legacy exemptions.
    if (completed.has("jury") || completed.has("sale")) completed.add("trim");
    return { version: 2, active: row.active, started: row.started || row.active, collapsed: row.collapsed, completed: [...completed], ...(row.flowerId ? { flowerId: row.flowerId } : {}) };
  } catch { return null; }
}
export const getFarmStep = (state: FarmProgress) => FARM_GUIDE_STEPS.find(step => !state.completed.includes(step.id));
export const farmStepChapter = (step: FarmStep) => {
  const chapter = FARM_GUIDE_CHAPTERS.find(chapter => chapter.id === step.chapter)!;
  return step.id === "trim" ? { ...chapter, tab: "Atelier · Trim", section: "processing" } : chapter;
};
export function followFarmHarvest(state: FarmProgress, flowerId: string): FarmProgress {
  if (!validId(flowerId) || state.flowerId === flowerId) return state;
  return { ...state, flowerId, completed: state.completed.filter(id => !["store", "trim", "cure", "jury", "sale"].includes(id)) };
}
export function observeFarmProgress(state: FarmProgress, evidence: FarmEvidence): FarmProgress {
  if (!state.started || evidence.error) return state;
  const done = new Set(state.completed);
  evidence.visits?.forEach(id => { if (VISIT_STEPS.includes(id)) done.add(id); });
  if (Number.isSafeInteger(evidence.savedZones) && evidence.savedZones! > 0) done.add("zone");
  if (Number.isSafeInteger(evidence.assignedZones) && evidence.assignedZones! > 0) { done.add("zone"); done.add("assign"); }
  if (evidence.cultureStarted) done.add("launch");
  if (evidence.rolled && evidence.cultureStarted) done.add("roll");
  if (evidence.turnResolved && evidence.cultureStarted) { done.add("roll"); done.add("resolve"); }
  let flowerId = state.flowerId;
  if (validId(evidence.harvestId)) {
    flowerId ??= evidence.harvestId;
    ["launch", "roll", "resolve", "harvest"].forEach(id => done.add(id as FarmStepId));
  }
  // A recorded stock lot can resume an earlier harvest, but never proves that dice were played.
  if (!flowerId) flowerId = evidence.lots?.find(lot => validId(lot.id))?.id;
  const lot = evidence.lots?.find(item => item.id === flowerId);
  if (lot) {
    done.add("harvest");
    if (lot.protected) done.add("store");
    if (lot.ready) done.add("cure");
  }
  if (flowerId && evidence.trim?.id === flowerId && ["complete", "not-required"].includes(evidence.trim.state)) done.add("trim");
  if (flowerId && evidence.juryIds?.includes(flowerId)) { done.add("trim"); done.add("jury"); }
  if (flowerId && evidence.saleId === flowerId) { done.add("trim"); done.add("sale"); }
  const completed = FARM_GUIDE_STEPS.filter(step => done.has(step.id)).map(step => step.id);
  if (completed.join() === state.completed.join() && flowerId === state.flowerId) return state;
  return { ...state, completed, ...(flowerId ? { flowerId } : {}) };
}

/** Keep recovery and the game's real errors ahead of instructions to spend resources. */
export function farmStepAdvice(step: FarmStep, facts: FarmGuideFacts, currentChapter: FarmGuideChapterId) {
  if (facts.error) return { line: "Le jeu demande ton attention. Lis son message avant de poursuivre ; ton objectif reste conservé.", target: "[role=alert]" };
  if (step.id === "trim" && facts.trimState === "queued") return { line: "Ce trim est réservé après une autre mission. Suis son départ dans l’Atelier ; les heures sont déjà engagées et le lot attend encore sa préparation.", target: step.target };
  if (step.id === "trim" && facts.trimState === "running") return { line: "Le trim de cette récolte est en cours. Une tâche peut ne préparer qu’une partie du lot : le guide attend la confirmation que tout le trim est terminé.", target: step.target };
  if (step.id === "staff-candidate" && currentChapter === "staff" && facts.staffTab === "candidates") {
    return { line: step.line, target: "[data-staff-profile], [data-staff-candidates-empty=true]" };
  }
  if ((step.id === "staff-planning" || step.id === "staff-development") && currentChapter === "staff" && facts.staffTab !== "overview") {
    return { line: "Ouvre Bilan pour retrouver les aides de l’équipe. " + step.line, target: "[data-staff-tab=overview]" };
  }
  if (step.chapter === "culture" && currentChapter === "culture") {
    if (facts.cultureDead) return { line: "Cette culture n’a pas donné de récolte. Lis le bilan et les possibilités de reprise avant de relancer.", target: "[data-culture-recovery], [data-culture-rescue]" };
    if (step.id === "harvest" && facts.phase === "prepare") return { line: "Une nouvelle situation attend ta décision. Lis ses effets, puis lance les dés quand tu es prêt.", target: "[data-culture-primary-action], [data-culture-situation]" };
    if (step.id === "harvest" && facts.phase === "rolled") return { line: "Compare les effets de tes choix après le lancer. Valide ta décision avec le bouton du jeu.", target: "[data-culture-primary-action], [data-culture-decision]" };
    if (step.id === "harvest" && facts.phase === "resolved") return { line: "Regarde le résultat sur tes plantes, puis passe à la prochaine étape. La récolte viendra au bout de la culture.", target: "[data-culture-primary-action], [data-culture-result]" };
    if (facts.harvested && step.id === "harvest") return { line: "La culture est finie. Attendons la confirmation de la récolte ; si un message apparaît, suis son indication.", target: "[data-harvest-moment]" };
  }
  return { line: step.line, target: step.target };
}
