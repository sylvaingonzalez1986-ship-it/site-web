/** The guide only explains and navigates. It never performs a game action. */
export const KQ_FARM_GUIDE_OPEN_EVENT = "kq:farm-guide-open";
export const KQ_FARM_GUIDE_KEY = "kq:farm-guide:v1";

export type FarmGuideView = "hub" | "workshop" | "collection" | "shop" | "game" | "harvests" | "arena" | "market" | "treasury" | "staff" | "social" | "missions";
export type FarmGuideDestination = { view: FarmGuideView; section?: string; pole?: "accounting" | "bank" };
export const FARM_GUIDE_CHAPTERS = [
  { id: "arrival", title: "Les clés de grand-père", tab: "Mon quartier", view: "hub", story: "Grand-père t’a légué sa maison et sa grange. Sylvain, ton voisin, t’accompagne pour transformer cet héritage en ferme. La carte est ton point de départ ; son résumé indique ce qui demande ton attention.", task: "Repère ta prochaine action et les bâtiments de la ferme.", target: "[data-placard-next-action]" },
  { id: "warehouse", title: "Transformer la grange", tab: "Entrepôt", view: "workshop", story: "Avant de planter, prenons les mesures de la grange. Dans l’entrepôt, chaque zone a un rôle : culture, séchage ou stockage. L’Atelier accueille le trim et les machines de transformation.", task: "Sur le plan, touche une zone : Aménager ouvre son matériel, Buddies permet de choisir les variétés. Vérifie la surface et le devis avant de confirmer.", target: "[data-warehouse-map]" },
  { id: "collection", title: "Choisir ce que tu cultives", tab: "Collections", view: "collection", story: "Une ferme commence par ses variétés. L’album Buddies montre celles que tu possèdes ; les cartes Botte du Chanvrier t’aident pendant la culture.", task: "Ouvre les deux albums. Une carte jouée consomme un exemplaire ; la consulter ou la garder dans ton deck ne la consomme pas.", target: "[data-collection-tab]" },
  { id: "packs", title: "Compléter tes ressources", tab: "Packs de cartes", view: "shop", story: "Grand-père faisait avec ce qu’il avait avant d’acheter davantage. Ici, tu retrouves tes packs et les moyens de compléter tes albums.", task: "Regarde d’abord les packs déjà disponibles. Lis le contenu et le prix avant un achat ; visiter cet onglet ne t’oblige pas à acheter.", target: "[data-arena-tour-surface=shop]" },
  { id: "culture", title: "Faire vivre la ferme", tab: "Culture", view: "game", story: "Ta grange prend vie. Choisis tes Buddies et tes cartes, puis accompagne la culture étape par étape. Sylvain reste avec toi pendant les décisions.", task: "Choisis une culture à reprendre ou une zone dans l’entrepôt pour préparer tes Buddies. Les coûts restent indiqués avant le lancement.", target: "[data-culture-selection]" },
  { id: "storage", title: "Prendre soin de la récolte", tab: "Mes récoltes", view: "harvests", section: "storage", story: "Grand-père disait de ne pas précipiter une bonne récolte. Range chaque lot par variété dans un contenant, prépare son trim à l’Atelier et laisse l’affinage se terminer avant le jury.", task: "Vérifie tes stocks et tes contenants libres. Choisis le contenant du lot et lis sa date de disponibilité : l’affinage continue pendant le trim et ton absence.", target: "[data-storage-inventory], [data-placard-harvests]" },
  { id: "jury", title: "Faire connaître ta récolte", tab: "Jury & duels", view: "arena", story: "La récolte est prête à rencontrer le Quartier. Tu accèdes au jury depuis Mes récoltes, une fois l’affinage et le trim requis terminés.", task: "Choisis une Fleur disponible et lis la confirmation. Un duel consomme la Fleur d’Arène lorsqu’il est résolu ; ton stock récolté reste conservé. Le verdict ouvre ses possibilités de vente.", target: "[data-culture-ranked-flower], [data-culture-training-flower], [data-culture-open-storage]" },
  { id: "sale", title: "Trouver ton premier débouché", tab: "Commerce · Vendre", view: "market", section: "sales", story: "La ferme doit aussi trouver ses clients. Choisis une récolte, prépare le produit, puis compare les débouchés réellement proposés.", task: "Commence par un lot disponible. Compare le montant net et les conditions avant de valider ; une offre n’est pas encore une vente.", target: "[data-screen]" },
  { id: "listings", title: "Suivre ce qui est en vente", tab: "Mon stock en vente", view: "market", section: "dashboard", story: "Une mise en vente ne remplit pas immédiatement la caisse. Ce registre te permet de suivre les produits proposés et les commandes.", task: "Distingue stock disponible, annonces et ventes réalisées. Vérifie prix, quantités et état de publication avant de modifier une annonce.", target: "[data-online-listings-heading], [data-commerce-view-heading]" },
  { id: "accounts", title: "Tenir les comptes de la ferme", tab: "Finances", view: "treasury", pole: "accounting", story: "Le carnet de grand-père ne notait pas seulement les recettes. Les factures, les échéances et la trésorerie disent ce que la ferme peut vraiment investir.", task: "Repère la trésorerie et les factures à régler. Le paiement groupé affiche son total et le solde restant avant confirmation.", target: "[data-pay-all-invoices], [data-account]" },
  { id: "bank", title: "Financer sans se précipiter", tab: "Finances · Banque", view: "treasury", pole: "bank", story: "Agrandir la ferme peut attendre. La banque propose des financements, avec un coût et des remboursements à prévoir.", task: "Consulte le coût total et les échéances. Aucun emprunt n’est nécessaire pour terminer cette visite.", target: "[data-bank-panel]" },
  { id: "business", title: "Donner une identité à la ferme", tab: "Commerce · Développer", view: "market", section: "management", story: "La ferme de grand-père devient la tienne. Développer regroupe ton site, le Studio, les produits dérivés et les moyens d’attirer des visiteurs.", task: "Découvre Site internet, Studio, Produits dérivés et Promouvoir. Vérifie les coûts et les prérequis ; davantage de visiteurs ne garantit pas des commandes.", target: "[aria-label='Développer ma boutique en ligne']" },
  { id: "networks", title: "Rencontrer le Quartier", tab: "Réseaux", view: "social", story: "Une ferme vit aussi par les histoires qu’elle partage. L’aventure te fait rencontrer le Quartier ; les partenariats engagent ta parole auprès des marques.", task: "Ouvre L’aventure et Partenariats. Lis les ressources nécessaires et les engagements avant de publier ou de signer.", target: "[data-social-networks]" },
  { id: "missions", title: "Écrire la suite", tab: "Missions", view: "missions", story: "Tu connais maintenant les lieux de la ferme. Les missions donnent une direction à tes prochains choix ; à toi de décider comment faire grandir l’héritage de grand-père.", task: "Choisis un objectif adapté à ta ferme. Les aides de chaque écran restent disponibles pour la suite.", target: "[data-mission-center]" },
  { id: "staff", title: "Organiser le travail de la ferme", tab: "Personnel", view: "staff", story: "Les dossiers sont ouverts : chaque personne apporte ses compétences, son expérience et son planning. Sylvain t’aide à répartir le travail sans oublier les repos ni les congés.", task: "Compare les candidats et le coût du contrat avant de recruter. Suis les missions, les formations, les congés et les salaires à régler.", target: "[data-staff-desk]" },
] as const;
export type FarmGuideChapterId = typeof FARM_GUIDE_CHAPTERS[number]["id"];
export type FarmGuideChapter = typeof FARM_GUIDE_CHAPTERS[number];
export type FarmGuideState = { version: 1; active: boolean; read: FarmGuideChapterId[] };
export const emptyFarmGuide = (): FarmGuideState => ({ version: 1, active: false, read: [] });

/** An unreadable or future save must not be overwritten by a partial visit. */
export function parseFarmGuide(raw: string | null): FarmGuideState | null {
  if (raw === null) return emptyFarmGuide();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    if (row.version !== 1 || typeof row.active !== "boolean" || !Array.isArray(row.read)
      || row.read.some(id => !FARM_GUIDE_CHAPTERS.some(chapter => chapter.id === id))) return null;
    return { version: 1, active: row.active, read: [...new Set(row.read)] as FarmGuideChapterId[] };
  } catch { return null; }
}

export function getFarmGuideChapter(destination: FarmGuideDestination): FarmGuideChapter {
  const { view, section, pole } = destination;
  const id: FarmGuideChapterId = view === "hub" ? "arrival" : view === "workshop" ? "warehouse" : view === "collection" ? "collection"
    : view === "shop" ? "packs" : view === "game" ? "culture" : view === "harvests" ? "storage" : view === "arena" ? "jury"
      : view === "market" ? section === "dashboard" ? "listings" : section === "management" ? "business" : "sale"
        : view === "staff" ? "staff" : view === "treasury" ? pole === "bank" ? "bank" : "accounts" : view === "social" ? "networks" : "missions";
  return FARM_GUIDE_CHAPTERS.find(chapter => chapter.id === id)!;
}

export type FarmGuideFacts = { phase?: string; preparation?: boolean; harvested?: boolean; cultureDead?: boolean; room?: string; emptyPlan?: boolean; planDraft?: boolean; album?: string; commerce?: string; social?: string; business?: string; bank?: string; staffTab?: string; storageEmpty?: boolean; curing?: boolean; trimState?: string; error?: boolean };
export type FarmGuideAdvice = { title: string; instruction: string; target: string };
export function getFarmGuideAdvice(chapter: FarmGuideChapter, facts: FarmGuideFacts): FarmGuideAdvice {
  const advice = (title: string, instruction: string, target: string = chapter.target): FarmGuideAdvice => ({ title, instruction, target });
  if (facts.error) return advice("Vérifier avant de continuer", "Une information ou une action demande ton attention. Lis le message du jeu et réessaie si nécessaire ; le guide ne considère pas une action refusée comme réussie.", "[role=alert]");
  if (chapter.id === "staff" && facts.staffTab === "candidates") return advice("Comparer avant de recruter", "Ouvre le contrat d’un profil : compare compétences, trait, salaire brut et coût employeur estimé. Les candidatures changent tous les 15 jours de jeu. Choisis le contrat et les heures selon ton budget ; rien n’est signé avant ta confirmation.", "[data-staff-profile]");
  if (chapter.id === "staff" && facts.staffTab === "team") return advice("Une équipe polyvalente", "Sur le plan, glisse un salarié vers un poste ou sélectionne la personne puis le poste. Choisis ensuite la cible et la durée avant de confirmer : missions et formations partagent la même réserve d’heures. Les aides Répartir le travail sont dans Bilan. Le trim se réalise dans Entrepôt → Atelier → Trim.", "[data-staff-work-plan]");
  if (chapter.id === "staff" && facts.staffTab === "planning") return advice("Organiser la semaine", "Choisis l’employé, puis Journée ou Semaine type. Les heures et les frais restent visibles avant confirmation. Les brouillons sont conservés lorsque tu changes de panneau ou de personne.", "[data-staff-planning-employee], [data-staff-team-files]");
  if (chapter.id === "staff" && facts.staffTab === "production") return advice("Suivre la production", "Observe les étapes et les lots de l’atelier. Organise le travail ou la semaine depuis ce panneau ; les gestes utilisent les heures réservées et les attentes continuent hors horaires.", "[data-staff-production]");
  if (chapter.id === "staff" && facts.staffTab === "payroll") return advice("Prévoir les échéances", "Le coût mensuel estimé aide à préparer ton budget ; le total à régler correspond aux échéances dues. Les heures contractuelles restent dues même sans mission. Règle les salaires dans Personnel ; les charges et dettes apparaissent dans Finances.", "[data-staff-panel=payroll]");
  if (chapter.id === "bank") {
    const target = "[id^=bank-panel-]";
    if (facts.bank === "savings") return advice("Le livret du Trésorier", "Ce livret dépend de la spécialité de ton personnage. Vérifie les conditions et le montant disponible avant de déplacer la monnaie du jeu.", target);
    if (facts.bank === "crypto") return advice("Le guichet Crypto", "Ce guichet utilise la monnaie du jeu. Observe les cours et les frais ; acheter ou vendre un actif demande ta confirmation et peut entraîner une perte.", target);
    if (facts.bank === "stocks") return advice("Le guichet Bourse", "Compare les titres et leurs cours. Les variations ne garantissent aucun gain ; garde de la trésorerie pour faire fonctionner ta ferme.", target);
    return advice(chapter.tab, chapter.task, target);
  }
  if (chapter.id === "culture") {
    if (facts.cultureDead) return advice("Comprendre ce qui s’est passé", "Lis le bilan et les possibilités de reprise proposées. Ne lance une nouvelle culture qu’après avoir vérifié ses coûts.", "[data-culture-recovery], [data-culture-rescue]");
    if (facts.harvested) return advice("Retrouver ta récolte", "La culture est terminée. Lis le bilan, puis ouvre Mes récoltes pour ranger le lot et suivre son affinage avant le jury.", "[data-harvest-flower], [data-culture-campaign-recap]");
    if (facts.preparation) return advice("Préparer avant de lancer", "Choisis tes Buddies, puis tes cartes. « Vérifier et lancer » affiche les coûts ; confirme seulement quand tu es prêt.", "[data-culture-buddies], [data-culture-start-review]");
    if (facts.phase === "prepare") return advice("Lire la situation", "Regarde la situation et les effets possibles. Tu peux consulter tes cartes avant de lancer les dés ; une carte jouée consomme un exemplaire.", "[data-culture-situation]");
    if (facts.phase === "rolled") return advice("Décider après le lancer", "Lis le résultat prévu et les possibilités encore disponibles, puis valide la décision avec le bouton du jeu.", "[data-culture-decision], [data-culture-primary-action]");
    if (facts.phase === "resolved") return advice("Comprendre le résultat", "Observe les conséquences sur ta culture avant de passer à l’étape suivante. Le guide suivra chaque nouvelle situation.", "[data-culture-result], [data-culture-primary-action]");
  }
  if (chapter.id === "warehouse") {
    if (facts.room === "culture" && facts.planDraft) return advice("Relire le devis du plan", "Ton aménagement est encore un brouillon. Vérifie les surfaces et le montant avant d’enregistrer ; annuler permet de garder l’installation précédente.", "[data-warehouse-plan-review]");
    if (facts.room === "culture" && facts.emptyPlan) return advice("Dessiner ta première zone", "Choisis une zone de culture dans les outils du plan, puis trace sa surface. Prévois aussi séchage et stockage ; le devis s’ajuste avant ton accord.", "[data-warehouse-map]");
    if (facts.room === "drying") return advice("Préparer le séchage", "Ce matériel protège la qualité après la récolte. Compare capacité, gamme et coût avant de modifier ton installation.", "[data-postharvest-guide=drying]");
    if (facts.room === "storage") return advice("Faire de la place aux récoltes", "Les stocks et les contenants disponibles passent en premier. Range chaque lot par variété ; les améliorations et leurs coûts se consultent ensuite.", "[data-storage-inventory]");
    if (facts.room === "processing") return advice("Préparer les récoltes à l’Atelier", "Dans Trim, prépare chaque nouvelle récolte avant le jury : travaille toi-même ou choisis un salarié. Le mode manuel privilégie la présentation ; la machine va plus vite mais l’abîme. Consulte aussi les machines de transformation et leurs coûts avant de préparer un produit dans Commerce.", "[data-warehouse-workshop]");
  }
  if (chapter.id === "collection" && facts.album === "buddies") return advice("Tes variétés disponibles", "Les Buddies possédés se choisissent depuis une zone de l’entrepôt ou la préparation de culture. Consulte leurs caractéristiques pour choisir ta variété.", "[data-collection-tab=buddies]");
  if (chapter.id === "storage" && facts.storageEmpty) return advice("Le rangement viendra après la récolte", "Ton stockage n’affiche pas encore de lot. Reprends ta culture ; tu pourras choisir un contenant pour chaque récolte lorsqu’elle sera disponible.");
  if (chapter.id === "jury" && facts.curing) return advice("Laisser l’affinage se terminer", "Cette Fleur attend encore au stockage. Consulte sa date de disponibilité ; le jury reste fermé pour elle jusqu’à la fin de l’affinage.", "[data-culture-open-storage]");
  if (chapter.id === "sale") {
    if (facts.commerce === "preparation") return advice("Choisir le produit", "Garde la fleur ou choisis une transformation disponible. Lis la quantité obtenue, l’équipement requis et les frais avant de confirmer.", "[data-screen=preparation]");
    if (facts.commerce === "distribution") return advice("Comparer les débouchés", "Compare les offres proposées pour ce lot. Le grossiste et la vente en ligne n’ont pas les mêmes délais ni les mêmes conditions.", "[data-sales-channel]");
    if (facts.commerce === "offer") return advice("Lire le montant net", "Regarde la quantité, le prix et les retenues. La confirmation du jeu récapitule ce que tu recevras avant toute vente.", "[data-screen=offer]");
    if (facts.commerce === "receipt") return advice("Vérifier le reçu", "Le reçu indique les quantités vendues, les retenues et le montant versé. Retrouve ensuite les factures et la trésorerie dans Finances.", "[data-screen=receipt]");
  }
  if (chapter.id === "networks" && facts.social === "sponsors") return advice("Tenir tes engagements", "Lis les honoraires, les publications à livrer et leurs contraintes avant de signer. Un partenariat actif affiche la prochaine publication ou le versement à réclamer.", "[data-social-view=sponsors]");
  if (chapter.id === "networks" && facts.social === "story") return advice("Les histoires du Quartier", "Choisis une aventure et lis les effets proposés. Tes décisions et les ressources engagées restent celles de ta partie.", "[data-social-view=story]");
  if (chapter.id === "business" && facts.business === "merch") return advice("Créer des produits dérivés", "Compare le coût de production et le stock à engager. Les recettes prévues ne sont pas encore des ventes réalisées.", "[aria-label='Développer ma boutique en ligne']");
  if (chapter.id === "business" && facts.business === "brand") return advice("Entrer au Studio", "Le Studio réunit les photos et l’identité de ta ferme. Consulte les effets et les coûts d’une création avant de l’engager.", "[data-shop-view=brand]");
  if (chapter.id === "business" && facts.business === "site") return advice("Ouvrir et entretenir ton site", "Vérifie le niveau du site, son abonnement et sa prochaine échéance. Le site accueille tes ventes en ligne ; les produits se suivent dans Mon stock en vente.", "[data-shop-view=site]");
  if (chapter.id === "business" && facts.business === "marketing") return advice("Faire venir des clients", "La publicité et les campagnes ont un budget et une durée. Vérifie le stock vendable et le site avant de dépenser ; les prévisions restent des estimations.", "[aria-label='Développer ma boutique en ligne']");
  return advice(chapter.tab, chapter.task);
}
