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

export const TUTORIAL_VERSION = 6;

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
    text: "On passe maintenant a la boutique pour voir les trois onglets de selection.",
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
    text: "Les Chanvriers Bretons, c'est aussi mes voisins: petits producteurs bretons de qualite.",
    target: '[data-tutorial="tab-mes-voisins"]',
    spotlightPadding: 8,
    route: "/boutique",
  },
  {
    id: "boutique-copains",
    title: "Les copains",
    text: "Des rencontres partageant les memes valeurs partout en France. Le terroir compte autant que la variete.",
    target: '[data-tutorial="tab-les-copains"]',
    spotlightPadding: 8,
    route: "/boutique",
  },
  {
    id: "boutique-filtres",
    title: "Filtres de la boutique",
    text: "Tu peux filtrer rapidement par categorie ou promotions.",
    target: '[data-tutorial="category-filter"]',
    spotlightPadding: 10,
    route: "/boutique",
  },
  {
    id: "loyalty",
    title: "Systeme de badges et avantages",
    text: "1 EUR depense = 1 point. Tu montes en palier au fil des commandes.",
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
    text: "A l'inscription, un filleul peut saisir un code parrain dans ce champ.",
    details: [
      "Ton code personnel est visible dans ton profil, section Fidelite > Parrainage.",
      "Les points bonus sont credites apres la premiere commande payee du filleul.",
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
      "Section disponible uniquement si tu es connecte.",
      "Les gains sont traces apres validation de la premiere commande payee du filleul.",
    ],
    target: '[data-tutorial="profile-referral"]',
    spotlightPadding: 10,
    route: "/profil",
    requiresAuth: true,
  },
  {
    id: "tickets",
    title: "Boosters TCG",
    text: "Tu gagnes 1 pack par tranche de depense affichee sur le site. Chaque booster revele 3 cartes de la collection Hemp Heroes 2026.",
    details: [
      "Les cartes peuvent etre communes, silver, gold, epiques ou legendaires.",
      "Les doublons comptent aussi dans ta collection.",
      "Le reglement complet est disponible sur la page dediee.",
    ],
    target: '[data-tutorial="ticket-promo-band"]',
    spotlightPadding: 12,
    route: "/",
  },
  {
    id: "tickets-demo",
    title: "Mini demo booster",
    text: "Essaie ici: ouvre un booster demo et retourne les 3 cartes comme dans l'experience reelle.",
    details: [
      "Le resultat est fictif.",
      "Le tutoriel avance ensuite normalement.",
    ],
    route: "/",
    variant: "pack-demo",
  },
  {
    id: "finish",
    title: "C'est parti",
    text: "Tu peux relancer ce tutoriel a tout moment via le bouton dans ton profil.",
    route: "/",
  },
];
