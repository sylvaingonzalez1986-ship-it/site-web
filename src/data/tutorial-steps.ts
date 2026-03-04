export type TutorialStep = {
  id: string;
  title: string;
  text: string;
  details?: string[];
  route?: string;
  variant?: "default" | "pack-demo" | "scratch-demo";
  requiresAuth?: boolean;
};

export const TUTORIAL_VERSION = 9;

export const HOME_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Bienvenue dans l'arene",
    text: "Ici c'est du CBD francais, vendu au gramme, sans emballage inutile. Et y'a du loot.",
    details: [
      "Ce tuto dure 30 secondes. Tu peux le relancer depuis ton profil.",
    ],
    route: "/",
  },
  {
    id: "boutique",
    title: "Le shop — Du vrac, du vrai",
    text: "",
    details: [
      "3 univers: Ma prod' (sol vivant, Bretagne), Mes voisins (producteurs bretons), Les copains (partenaires France entiere).",
      "Filtre par categorie: fleurs, resines, huiles, promos… tu vas droit au but.",
      "Chaque fiche produit affiche l'origine, le producteur et les analyses labo.",
    ],
    route: "/boutique",
  },
  {
    id: "loyalty",
    title: "Chaque achat = XP",
    text: "1 EUR dépensé = 1 point. Plus tu commandes, plus tu montes de niveau. 5 badges à débloquer, chacun avec ses avantages.",
    details: [
      "Bronze (100 pts): 1% de réduction automatique + 1 pack booster extra / commande.",
      "Argent (500 pts): 4% de réduction automatique + livraison offerte + 3 packs booster extra / commande.",
      "Or (1000 pts): 6% de réduction automatique + livraison offerte + 5 packs booster extra / commande.",
      "Platine (1500 pts): 8% de réduction automatique + livraison offerte + 10 packs booster + cadeau anniversaire + ventes privées.",
      "Diamant (2000 pts): 10% de réduction automatique + livraison offerte + 20 packs booster + cadeau anniversaire + cadeau de Noël + ventes privées.",
    ],
    route: "/",
  },
  {
    id: "tcg-album",
    title: "Kanab Quest — Collectionne-les tous",
    text: "Chaque commande drop des packs de 3 cartes. Remplis l'album par pages de rarete pour debloquer des lots.",
    details: [
      "5 raretes: Common, Silver, Gold, Epic, Legendary.",
      "Complete une page = recompense debloquee.",
      "Ton album a son propre onglet dans la nav. Tes missions sont dans ton profil.",
    ],
    route: "/",
  },
  {
    id: "tcg-burn",
    title: "Doublons = monnaie d'echange",
    text: "Tes doublons ne sont pas inutiles. Brule-les contre des reductions ou des grammes offerts.",
    details: [
      "10 doublons Common = -10% ou 3g offerts.",
      "10 doublons Silver = -20% ou 10g offerts.",
      "10 doublons Gold = -30% ou 20g offerts.",
      "10 doublons Epic = -50% ou 50g offerts.",
      "Tu peux aussi acheter des packs avec tes points: 100 pts/pack.",
    ],
    route: "/",
  },
  {
    id: "pack-demo",
    title: "Ouvre ton premier pack",
    text: "Glisse pour ouvrir le pack, retourne les 3 cartes. C'est une demo, mais le feeling est le meme.",
    details: [
      "GG si tu drop une Legendary.",
    ],
    route: "/",
    variant: "pack-demo",
  },
  {
    id: "finish",
    title: "GG, t'es pret",
    text: "Boutique, album, fidelite: tout est en place. A toi de jouer.",
    details: [
      "Ton album est accessible depuis la nav, tes missions depuis ton profil.",
      "Tu peux relancer ce tuto a tout moment.",
    ],
    route: "/",
  },
];
