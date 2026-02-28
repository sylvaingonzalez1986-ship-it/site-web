export type TutorialStep = {
  id: string;
  title: string;
  text: string;
  details?: string[];
  target?: string;
  spotlightPadding?: number;
  route?: string;
  variant?: "default" | "scratch-demo";
  requiresAuth?: boolean;
};

export const TUTORIAL_VERSION = 5;

export const HOME_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Bienvenue chez Les Chanvriers Bretons",
    text: "Charles t'accompagne pour une visite rapide du site.",
    target: '[data-tutorial="home-hero"]',
    spotlightPadding: 12,
    route: "/",
  },
  {
    id: "navigation",
    title: "Navigation principale",
    text: "Depuis la barre du haut, tu retrouves l'accueil, la boutique, le blog, l'app, ton compte et le panier.",
    target: '[data-tutorial="navbar"]',
    spotlightPadding: 10,
    route: "/",
  },
  {
    id: "boutique-intro",
    title: "Direction la boutique",
    text: "On passe maintenant à la boutique pour voir les trois onglets de sélection.",
    route: "/",
  },
  {
    id: "boutique-mes-produits",
    title: "Mes produits",
    text: "Ma production perso: 150 plants sur sol vivant.",
    target: '[data-tutorial="tab-mes-produits"]',
    spotlightPadding: 8,
    route: "/boutique",
  },
  {
    id: "boutique-mes-voisins",
    title: "Mes voisins",
    text: "Les Chanvriers Bretons, c'est aussi mes voisins: petits producteurs bretons de qualité.",
    target: '[data-tutorial="tab-mes-voisins"]',
    spotlightPadding: 8,
    route: "/boutique",
  },
  {
    id: "boutique-copains",
    title: "Les copains",
    text: "Rencontres partageant les mêmes valeurs, partout en France. Le terroir compte: une même variété s'exprime différemment selon son sol et son climat.",
    target: '[data-tutorial="tab-les-copains"]',
    spotlightPadding: 8,
    route: "/boutique",
  },
  {
    id: "boutique-filtres",
    title: "Filtres de la boutique",
    text: "Tu peux filtrer rapidement par catégorie ou promotions.",
    target: '[data-tutorial="category-filter"]',
    spotlightPadding: 10,
    route: "/boutique",
  },
  {
    id: "loyalty",
    title: "Système de badges et avantages",
    text: "1 EUR dépensé = 1 point. Tu montes en palier au fil des commandes.",
    details: [
      "Bronze (100 pts): 2%",
      "Argent (500 pts): 4% + livraison offerte",
      "Or (1000 pts): 6% + livraison offerte",
      "Platine (1500 pts): 8% + livraison offerte",
      "Diamant (2000 pts): 10% + livraison offerte",
    ],
    route: "/",
  },
  {
    id: "referral",
    title: "Parrainage",
    text: "À l'inscription, un filleul peut saisir un code parrain dans ce champ.",
    details: [
      "Ton code personnel est visible dans ton profil, section Fidélité > Parrainage.",
      "Les points bonus sont crédités après la première commande payée du filleul.",
    ],
    target: '[data-tutorial="referral-code-input"]',
    spotlightPadding: 10,
    route: "/compte/inscription",
  },
  {
    id: "referral-profile",
    title: "Ton espace parrainage",
    text: "Dans ton profil, tu peux copier ton lien de parrainage, suivre tes filleuls et voir tes points bonus.",
    details: [
      "Section disponible uniquement si tu es connecté.",
      "Les gains sont tracés après validation de la première commande payée du filleul.",
    ],
    target: '[data-tutorial="profile-referral"]',
    spotlightPadding: 10,
    route: "/profil",
    requiresAuth: true,
  },
  {
    id: "tickets",
    title: "Tickets à gratter",
    text: "Tu gagnes 1 ticket tous les 20 EUR TTC de commande payée, puis tu grattes depuis ton profil.",
    details: [
      "Lots communs, rares, épiques et légendaires.",
      "Le jackpot: 1 an de conso. Détails dans le règlement du jeu.",
    ],
    target: '[data-tutorial="ticket-promo-band"]',
    spotlightPadding: 12,
    route: "/",
  },
  {
    id: "tickets-demo",
    title: "Mini demo ticket",
    text: "Essaie ici: gratte la carte pour voir le comportement en conditions réelles (résultat fictif).",
    route: "/",
    variant: "scratch-demo",
  },
  {
    id: "finish",
    title: "C'est parti",
    text: "Tu peux relancer ce tutoriel à tout moment via le bouton ? dans la barre du haut ou depuis ton profil.",
    route: "/",
  },
];
