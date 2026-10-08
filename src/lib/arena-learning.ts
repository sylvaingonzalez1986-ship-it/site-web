export type ArenaLearningChoice = {
  label: string;
  feedback: string;
  correct: boolean;
};

export type ArenaLearningModule = {
  id: string;
  title: string;
  description: string;
  location: string;
  href: string;
  features: readonly string[];
  scenario: string;
  choices: readonly ArenaLearningChoice[];
};

// Optional discovery modules complement the playable culture workshops.
// Their links open existing pages; location names the controls to use there.
// Choices explain existing rules and never perform purchases or account writes.
export const ARENA_LEARNING_MODULES: readonly ArenaLearningModule[] = [
  {
    id: "collection",
    title: "Tes cartes et tes packs",
    description: "Repère les packs Buddies, les soutiens et les Héritages.",
    location: "Mon compte → Collection ; Placard → Boutique pour les soutiens",
    href: "/profil/collection",
    // Sources: lottery-ticket-calculations.ts; supabase/lottery-backend.ts;
    // account/LotterySection.tsx; placard/KqSupportBoosterShop.tsx.
    // The user confirmed the 5 € / 3 cards rule. The calculator also applies
    // the configured order cap and loyalty bonuses: do not promise no cap.
    features: [
      "Les achats payés sur le site donnent un pack Buddies de 3 cartes par tranche de 5 €, selon les conditions et le plafond affichés pour la commande.",
      "Ouvre tes packs disponibles dans ta collection : les cartes rejoignent ton inventaire et peuvent inclure des doublons.",
      "Dans le Placard, la Boutique propose aussi des packs Botte du Chanvrier : un pack acheté coûte 5 points et contient 10 cartes de soutien.",
      "Choisis un Buddie pour ta variété, des soutiens consommés seulement quand tu les joues, et un Héritage permanent si tu en possèdes un.",
      "Après une culture, utilise 5 autres Buddies différents avant de reprendre le même. La collection indique les variétés que tu possèdes.",
    ],
    scenario: "Un pack Buddies gagné avec tes achats attend dans ta collection. Que vas-tu découvrir en l’ouvrant ?",
    choices: [
      { label: "10 soutiens pour ma main", correct: false, feedback: "Les 10 soutiens correspondent au pack acheté à la Boutique Botte du Chanvrier. Ton pack Buddies révèle 3 cartes de sa collection." },
      { label: "3 cartes Buddies", correct: true, feedback: "Ce pack révèle 3 cartes Buddies. Elles peuvent enrichir tes choix de variétés, avec une possibilité de doublons." },
      { label: "Une machine déjà installée", correct: false, feedback: "Le matériel s’achète avec les euros du jeu puis s’installe dans l’entrepôt. Un pack Buddies contient des cartes." },
    ],
  },
  {
    id: "specialties",
    title: "Ton personnage et sa spécialité",
    description: "Choisis l’avantage qui accompagne ta façon de jouer.",
    location: "Arène → Ma carte → Personnaliser mon personnage",
    href: "/arene",
    // Sources: arena-chanvrier.ts; contest/ChanvrierProfileEditor.tsx;
    // placard/KqTreasuryBank.tsx; placard/KqCultureEquipmentWear.tsx.
    features: [
      "Personnalise ton surnom et ton apparence. La spécialité devient définitive à la création ; ton apparence reste modifiable.",
      "Main Verte ajoute 2 XP à chaque culture, en plus du bonus de ton Buddie.",
      "Trésorier commence avec 1 000 € de jeu au lieu de 350 € et accède au livret à 5 % par tranche complète de 24 h.",
      "Commercial améliore les recettes et la capacité de vente. Bricoleur offre les réparations périodiques des machines de transformation.",
      "Le remplacement du matériel de culture usé reste payant, y compris pour le Bricoleur.",
    ],
    scenario: "Tu n’as pas encore créé ton personnage. Tu veux pouvoir déposer tes euros de jeu sur le livret d’épargne. Quelle spécialité donne cet accès ?",
    choices: [
      { label: "Trésorier", correct: true, feedback: "Le livret est réservé au Trésorier. Chaque dépôt commence son délai de 24 h ; les retraits restent libres. Choisis cet avantage avant de valider ton personnage." },
      { label: "Main Verte", correct: false, feedback: "Main Verte apporte 2 XP au départ de chaque culture. Le livret appartient à la spécialité Trésorier." },
      { label: "N’importe laquelle, je changerai ensuite", correct: false, feedback: "La spécialité est définitive. Tu peux ensuite modifier ton surnom et ton apparence, mais cela ne change pas ton avantage." },
    ],
  },
  {
    id: "warehouse",
    title: "Entretenir et agrandir",
    description: "Fais durer ton installation et prépare tes prochaines cultures.",
    location: "Placard → Entrepôt → Choisir une tente ou l’atelier commun",
    href: "/arene/placard?view=workshop",
    // Sources: placard/KqEquipmentInventoryModal.tsx; KqProductionCapacity.tsx;
    // KqCultureEquipmentWear.tsx; KqMachineMaintenance.tsx; KqBusinessPanel.tsx.
    features: [
      "Installe le matériel acheté, améliore ses niveaux et vérifie ses prérequis. Le matériel de chaque tente est fixé au lancement de la culture.",
      "Consulte l’état de tes lampes, tentes et autres équipements. À 0 %, ils perdent leurs bonus ; un remplacement payant conserve leurs niveaux.",
      "Répare séparément les machines de transformation lorsqu’elles arrivent à leur échéance d’entretien. Ces réparations sont gratuites pour le Bricoleur.",
      "Ajoute des tentes selon les conditions et le devis affichés. Chaque tente a son équipement ; les machines de transformation sont communes.",
      "Compare les protections contre le vol et leurs charges. Au Bureau, la domiciliation extérieure réduit le risque par rapport au domicile et possède un abonnement.",
    ],
    scenario: "Ta lampe achetée est hors service à 0 % d’état. Tu es Bricoleur et tu veux retrouver ses bonus pour ta prochaine culture. Quelle action convient ?",
    choices: [
      { label: "Attendre une réparation gratuite automatique", correct: false, feedback: "Bricoleur offre les réparations des machines de transformation. L’usure du matériel de culture demande un remplacement payant dans l’entrepôt." },
      { label: "Acheter une nouvelle tente pour réparer la lampe", correct: false, feedback: "Ajouter une tente augmente la capacité ; cela ne remet pas la lampe existante en état. Son remplacement se trouve dans la fiche de matériel de sa tente." },
      { label: "Remplacer la lampe dans l’entrepôt", correct: true, feedback: "Le remplacement remet ce matériel à neuf et conserve ses niveaux. Vérifie le coût avant de confirmer. Le kit de départ permet de continuer à cultiver en attendant." },
    ],
  },
  {
    id: "missions",
    title: "Missions, succès et réputation",
    description: "Choisis un objectif et retrouve tes récompenses.",
    location: "Placard → Missions ; carte de chanvrier pour les succès et badges",
    href: "/arene/placard?view=missions",
    // Sources: placard/KqMissionCenter.tsx; missions/CommunityMissionsBoard.tsx;
    // contest/ChanvrierPlayerCard.tsx; kanab-quest-missions.ts.
    features: [
      "Parcours les missions de communauté et leurs conditions : certaines demandent une contribution à faire valider.",
      "Dans Tous mes défis, suis les parcours Culture, Vente en ligne et Boutiques partenaires, puis récupère les packs débloqués.",
      "Ouvre les packs obtenus à la Boutique. Une récompense de mission se récupère une seule fois.",
      "Sur ta carte de chanvrier, suis un succès, consulte ta progression et épingle tes badges obtenus.",
      "Les bonnes ventes développent ta réputation, tes clients et ton réseau de shops. Ces progressions ouvrent d’autres objectifs et avantages.",
    ],
    scenario: "Un défi affiche « Récupérer mon pack ». Quelle suite te permet de découvrir les cartes gagnées ?",
    choices: [
      { label: "Relancer une culture pour recevoir les cartes", correct: false, feedback: "Le défi est déjà atteint. Récupère sa récompense dans les Missions, puis ouvre le pack à la Boutique." },
      { label: "Récupérer le pack, puis l’ouvrir à la Boutique", correct: true, feedback: "La récupération ajoute un pack disponible. Son ouverture révèle les cartes ; tu ne peux pas récupérer plusieurs fois la même récompense." },
      { label: "Recharger la page pour multiplier les packs", correct: false, feedback: "Le jeu conserve les récompenses déjà récupérées. Recharger la page permet de retrouver ta progression, pas de gagner une seconde fois le même pack." },
    ],
  },
  {
    id: "bank",
    title: "Le banquier et le livret",
    description: "Découvre les conditions d’un prêt et la réserve du Trésorier.",
    location: "Placard → Bureau → Banque → Prêts ou Livret d’épargne",
    href: "/arene/placard?view=treasury",
    // Sources: kanab-quest-bank.ts; placard/KqBankLoans.tsx; KqTreasuryBank.tsx;
    // supabase/migrations/20260923000700_kq_bank_investment_limits.sql.
    features: [
      "Consulte les conditions du jour, ton plafond personnel et le coût total avant de signer un prêt en euros de jeu.",
      "Le prêt demande au moins 200 de réputation et 24 h après ta première culture terminée, sans autre prêt actif ni impayés bloquants.",
      "Suis les échéances de ton contrat et, si ton solde suffit, rembourse le prêt restant en une fois.",
      "Avec la spécialité Trésorier, dépose sur le livret ou retire ton épargne. Les autres spécialités gardent l’accès aux guichets Bourse et Crypto.",
    ],
    scenario: "Tu viens de terminer ta toute première culture et tu as déjà 250 de réputation. Le banquier ne te propose pas encore de prêt. Que dois-tu vérifier ?",
    choices: [
      { label: "Le délai après ma première culture et mon dossier", correct: true, feedback: "La réputation ne suffit pas : 24 h doivent s’écouler après ta première culture terminée. Le dossier vérifie aussi les prêts et les impayés avant de présenter une offre." },
      { label: "Le nombre de fois où j’ai actualisé le guichet", correct: false, feedback: "Actualiser relit ton dossier. Cela ne raccourcit pas le délai d’accès ni ne change les conditions du prêt." },
      { label: "Mon apparence de chanvrier", correct: false, feedback: "L’apparence ne change pas les conditions bancaires. Le guichet regarde notamment ta réputation, ton ancienneté de culture et tes dettes." },
    ],
  },
  {
    id: "investments",
    title: "Bourse et crypto du jeu",
    description: "Lis un portefeuille et comprends ce qu’une vente change.",
    location: "Placard → Bureau → Banque → Bourse ou Crypto",
    href: "/arene/placard?view=treasury",
    // Sources: placard/KqStockMarket.tsx; placard/KqCryptoMarket.tsx;
    // kanab-quest-stocks.ts; kanab-quest-crypto.ts.
    features: [
      "Recherche des actions du CAC 40 ou du S&P 500, des parts virtuelles d’indices et les cryptoactifs proposés au guichet.",
      "Prépare un achat ou une vente, lis le prix et le montant de l’ordre, puis confirme avec tes euros de jeu.",
      "Dans Mes positions, compare le coût d’achat, la valeur actuelle et le gain ou la perte latent. La valeur du portefeuille n’est pas ton solde disponible.",
      "Les cours sont datés et peuvent être indisponibles. Les placements restent virtuels, leur valeur peut baisser et les actions ne versent pas de dividendes dans ce jeu.",
    ],
    scenario: "Une position affiche un gain latent, mais ton solde disponible n’a pas augmenté. Comment transformer cette position en euros de jeu disponibles ?",
    choices: [
      { label: "Recharger le portefeuille pour encaisser le gain", correct: false, feedback: "Actualiser met à jour l’affichage. Tant que tu conserves la position, sa valeur peut varier et elle ne devient pas automatiquement du solde disponible." },
      { label: "Attendre un dividende garanti", correct: false, feedback: "Les actions du jeu ne versent pas de dividendes. Un gain latent correspond à la valorisation de ta position, pas à un paiement promis." },
      { label: "Examiner puis confirmer une vente disponible", correct: true, feedback: "Une vente confirmée échange la quantité choisie contre des euros de jeu au prix indiqué dans l’ordre. Vérifie ce prix : il peut différer de la valorisation affichée auparavant." },
    ],
  },
  {
    id: "business",
    title: "Ton commerce et ses charges",
    description: "Ouvre ton site, attire des clients et garde tes comptes lisibles.",
    location: "Placard → Bureau → Gestion ou Comptabilité",
    href: "/arene/placard?view=treasury",
    // Sources: placard/KqBusinessPanel.tsx; KqTreasuryInvoices.tsx;
    // KqTreasuryDesk.tsx; kanab-quest-business.ts; kanab-quest-commerce.ts.
    features: [
      "Pour vendre en ligne, achète l’ordinateur à 450 € de jeu puis crée ton site à 1 000 €, premier mois inclus. Les boutiques et grossistes restent d’autres débouchés.",
      "Gère le nom du site, sa réactivation et sa reconduction à 100 € par mois de jeu, soit 5 jours réels.",
      "Lance une campagne publicitaire à la fois sur un site actif. Elle augmente la demande ; le stock, la qualité et le prix restent déterminants et les ventes sont manuelles.",
      "Choisis ta domiciliation : domicile gratuit, ou adresse extérieure à 50 € par mois de jeu avec un risque de vol moindre pour les prochaines cultures.",
      "Consulte et règle les analyses, l’électricité et les soins. La TVA de jeu est réservée sur les ventes ; le journal comptable détaille les mouvements.",
      "Le calendrier des charges continue hors connexion. Compare les recettes et les dépenses pour comprendre ton résultat.",
    ],
    scenario: "Tu as acheté l’ordinateur, mais tu n’as jamais créé ton site. Tu veux vendre en ligne. Quelle est la prochaine étape ?",
    choices: [
      { label: "Lancer immédiatement une campagne publicitaire", correct: false, feedback: "Une campagne demande un site actif. Commence par créer le site au Bureau ; l’ordinateur seul n’ouvre pas les ventes en ligne." },
      { label: "Créer mon site au Bureau avec le budget requis", correct: true, feedback: "Le site coûte 1 000 € de jeu à créer, premier mois inclus, après l’achat de l’ordinateur. Prévois ensuite son abonnement ; tu peux continuer à vendre aux professionnels avant son ouverture." },
      { label: "Attendre que l’ordinateur vende automatiquement", correct: false, feedback: "L’ordinateur est un prérequis matériel. Tu dois créer ton site puis choisir et confirmer tes ventes au Marché ; elles ne se font pas toutes seules." },
    ],
  },
  {
    id: "notebook",
    title: "Le Carnet de dégustation",
    description: "Retrouve tes expériences réelles à côté de l’aventure du Placard.",
    location: "Arène → Le Carnet",
    href: "/arene/carnet/regular",
    // Sources: arena-lobby.ts; contest/ContestNotebookPanel.tsx;
    // app/arene/carnet/[track]/page.tsx; kanab-quest-notebook-rewards.ts.
    features: [
      "Ouvre les fiches des lots du Carnet habituel ou du parcours Concours lorsqu’il est disponible.",
      "Pour un lot auquel ton compte a accès, décris ta dégustation réelle avec les critères, les arômes et ton commentaire.",
      "Retrouve tes notes, leur statut et les conditions des objectifs du Carnet. Les récompenses dépendent des critères du parcours.",
      "Une Fleur gagnée dans le Placard et un résultat du tutoriel restent fictifs : ils ne remplacent pas une dégustation pour le Carnet.",
    ],
    scenario: "Tu viens d’obtenir une belle Fleur dans le tutoriel, mais tu n’as pas dégusté le lot correspondant dans la réalité. Que peux-tu noter dans le Carnet ?",
    choices: [
      { label: "Ma dégustation réelle, quand je l’aurai faite", correct: true, feedback: "Le Carnet décrit ton expérience réelle sur les lots auxquels tu as accès. Tu peux explorer le jeu maintenant et revenir noter une vraie dégustation ensuite." },
      { label: "La note du jury fictif comme avis personnel", correct: false, feedback: "Le jury du Placard évalue une Fleur de jeu. Sa note ne décrit pas ce que tu as goûté et ne remplace pas un avis de dégustation." },
      { label: "Une note maximale pour débloquer les récompenses", correct: false, feedback: "Les critères du Carnet servent à décrire ce que tu as réellement observé. Une note choisie seulement pour une récompense ne raconte pas ta dégustation." },
    ],
  },
];
