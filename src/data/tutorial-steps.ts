export type TutorialStep = {
  id: string;
  title: string;
  text: string;
  details?: string[];
  target?: string;
  spotlightPadding?: number;
  route?: string;
  variant?: "default" | "pack-demo" | "scratch-demo";
  requiresAuth?: boolean;
};

export const TUTORIAL_VERSION = 8;

export const HOME_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Bienvenue !",
    text: "Sylvain t'accompagne pour un tour rapide du site, de la boutique jusqu'au jeu de cartes Hemp Heroes.",
    details: [
      "Le parcours est volontairement court et concret.",
      "Tu peux le relancer plus tard depuis ton profil.",
    ],
    target: '[data-tutorial="home-hero"]',
    spotlightPadding: 12,
    route: "/",
  },
  {
    id: "navigation",
    title: "La barre de nav'",
    text: "Depuis ici, tu retrouves l'accueil, la boutique, le blog, l'app, ton compte et le panier.",
    details: [
      "La boutique te permet d'acheter au gramme.",
      "Le profil centralise fidelite, commandes, missions et album.",
    ],
    target: '[data-tutorial="navbar"]',
    spotlightPadding: 10,
    route: "/",
  },
  {
    id: "boutique-vrac",
    title: "La boutique - On vend en vrac au gramme !",
    text: "Ici, tu choisis ton produit puis ton format. L'idee: rester simple, lisible et artisanal.",
    details: [
      "Le prix evolue selon le grammage choisi.",
      "Tu compares facilement les produits sans te perdre dans des dizaines de packagings.",
    ],
    route: "/boutique",
  },
  {
    id: "boutique-tabs",
    title: "Mes produits, mes voisins, les copains",
    text: "La boutique est rangee en 3 univers pour te montrer clairement d'ou vient chaque produit.",
    details: [
      "Mes produits: ma production perso sur sol vivant.",
      "Mes voisins: petits producteurs bretons et alentours.",
      "Les copains: partenaires selectionnes partout en France.",
    ],
    target: '[data-tutorial="tab-mes-produits"]',
    spotlightPadding: 8,
    route: "/boutique",
  },
  {
    id: "boutique-filtres",
    title: "Filtre par categorie",
    text: "Tu peux aller droit au but avec les filtres: fleurs, resines, huiles, promos et plus encore.",
    details: [
      "Pratique pour comparer rapidement une famille de produits.",
      "Le filtre promos remonte les offres en cours en un clic.",
    ],
    target: '[data-tutorial="category-filter"]',
    spotlightPadding: 10,
    route: "/boutique",
  },
  {
    id: "loyalty-points",
    title: "Chaque achat te rapporte des points",
    text: "Le programme fidelite est simple: 1 EUR depense = 1 point. Tu cumules naturellement au fil des commandes.",
    details: [
      "Tes points font progresser ton badge.",
      "Une partie de tes points peut aussi servir a acheter des packs de cartes.",
    ],
    target: '[data-tutorial="badge-promo-band"]',
    spotlightPadding: 12,
    route: "/",
  },
  {
    id: "loyalty-badges",
    title: "Les 5 badges et leurs avantages",
    text: "Plus tu commandes, plus tu montes en palier et plus les avantages deviennent interessants.",
    details: [
      "Bronze: 100 pts = 2%",
      "Argent: 500 pts = 4% + livraison offerte",
      "Or: 1000 pts = 6% + livraison offerte",
      "Platine: 1500 pts = 8% + livraison offerte",
      "Diamant: 2000 pts = 10% + livraison offerte",
    ],
    route: "/",
  },
  {
    id: "referral",
    title: "Parraine tes amis",
    text: "Dans ton profil, tu recuperes ton code et ton lien de parrainage pour inviter tes proches.",
    details: [
      "Les bonus tombent apres la premiere commande payee du filleul.",
      "Tu peux suivre tes gains directement dans ton espace fidelite.",
    ],
    target: '[data-tutorial="profile-referral"]',
    spotlightPadding: 10,
    route: "/profil",
    requiresAuth: true,
  },
  {
    id: "tcg-intro",
    title: "Le jeu de cartes Hemp Heroes 2026",
    text: "A chaque commande, tu cumules des packs a ouvrir. Chaque pack contient 3 cartes a reveler.",
    details: [
      "Le bandeau du site t'affiche la regle de gain en cours.",
      "Les cartes servent a completer ton album et debloquer des recompenses.",
    ],
    target: '[data-tutorial="ticket-promo-band"]',
    spotlightPadding: 12,
    route: "/",
  },
  {
    id: "tcg-album",
    title: "L'album de collection",
    text: "Les cartes se rangent par pages de rarete: Common, Silver, Gold, Epic et Legendary.",
    details: [
      "Completer une page permet de debloquer un lot de page.",
      "L'album te montre aussi les recompenses a venir pour garder l'objectif clair.",
    ],
    route: "/",
  },
  {
    id: "tcg-burn",
    title: "Brule tes doublons",
    text: "Les doublons ont une vraie utilite: tu peux les bruler contre une reduction ou des grammes offerts.",
    details: [
      "10 doublons Common = -10% ou 3g offerts",
      "10 doublons Silver = -20% ou 10g offerts",
      "10 doublons Gold = -30% ou 20g offerts",
      "10 doublons Epic = -50% ou 50g offerts",
    ],
    route: "/",
  },
  {
    id: "tcg-buy-packs",
    title: "Achete des packs avec tes points",
    text: "Tu peux aussi convertir tes points fidelite en packs supplementaires pour avancer plus vite dans l'album.",
    details: [
      "Le tarif actuel est de 100 points par pack.",
      "Pratique pour viser une page precise ou transformer ton solde en ouverture de packs.",
    ],
    route: "/",
  },
  {
    id: "tcg-demo",
    title: "Ouvre un pack demo !",
    text: "Teste ici l'experience d'ouverture: glisse pour ouvrir le pack, puis retourne les 3 cartes.",
    details: [
      "C'est une demo, aucun lot reel n'est distribue ici.",
      "L'animation est la meme idee que dans l'experience reelle.",
    ],
    route: "/",
    variant: "pack-demo",
  },
  {
    id: "missions-intro",
    title: "Les missions dans ton profil",
    text: "Le profil contient aussi des missions: Instagram, Facebook, TikTok et d'autres actions ponctuelles.",
    details: [
      "Chaque mission validee peut te rapporter des packs ou des points.",
      "Tu peux les utiliser pour accelerer ta collection ou ta fidelite.",
    ],
    route: "/",
  },
  {
    id: "missions-proof",
    title: "Upload ta preuve",
    text: "Pour prouver une action, tu envoies une capture ou une photo depuis ton smartphone, puis l'equipe verifie.",
    details: [
      "Tu peux choisir une capture depuis ta bibliotheque ou prendre une photo.",
      "Une fois la preuve traitee, la recompense est creditee et le fichier peut etre nettoye.",
    ],
    route: "/",
  },
  {
    id: "finish",
    title: "Merci de nous faire confiance",
    text: "Chaque commande aide a faire vivre une filiere francaise qui a besoin de soutien. Merci de faire partie de l'aventure.",
    details: [
      "Tu peux relancer le tutoriel a tout moment depuis ton profil.",
      "Maintenant, a toi de jouer: boutique, fidelite, missions et album sont prets.",
    ],
    route: "/",
  },
];
