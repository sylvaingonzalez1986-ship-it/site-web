export type TutorialStep = {
  id: string;
  title: string;
  text: string;
  details?: string[];
  route?: string;
  variant?: "default" | "pack-demo" | "scratch-demo";
  requiresAuth?: boolean;
};

export const TUTORIAL_VERSION = 12;

export const HOME_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Bienvenue chez les Chanvriers",
    text: "Je te fais le tour en quelques etapes: la boutique, ton album de cartes et le lien avec l'onglet Concours.",
    details: [
      "Tu peux passer le tutoriel a tout moment.",
      "Tu peux aussi le relancer plus tard depuis ton profil.",
      "Chaque etape t'emmene directement au bon endroit du site.",
    ],
    route: "/",
  },
  {
    id: "boutique",
    title: "Boutique",
    text: "Dans la boutique, tu retrouves les produits par univers pour choisir plus vite ce qui te correspond.",
    details: [
      "Les categories t'aident a filtrer les fleurs, resines, packs et accessoires.",
      "Les fiches produit indiquent les infos utiles avant d'ajouter au panier.",
      "Certains lots premium peuvent aussi etre suivis dans l'onglet Concours.",
    ],
    route: "/boutique",
  },
  {
    id: "collection",
    title: "Ton album de cartes",
    text: "L'onglet Mon album rassemble tes boosters, tes cartes et ta progression Kanab Quest.",
    details: [
      "Tu ouvres tes boosters pour reveler de nouvelles cartes.",
      "Les cartes obtenues restent dans ta collection.",
      "Les doublons peuvent servir a debloquer des avantages quand une regle le permet.",
    ],
    route: "/profil/collection",
  },
  {
    id: "pack-demo",
    title: "Un booster, ca donne quoi ?",
    text: "Voici un exemple rapide: tu ouvres un booster, puis les cartes revelees rejoignent ton album.",
    details: [
      "La rarete des cartes rend la collection plus fun.",
      "Les cartes manquantes t'aident a voir ce qu'il te reste a trouver.",
    ],
    route: "/profil/collection",
    variant: "pack-demo",
  },
  {
    id: "contest",
    title: "L'onglet Concours",
    text: "Le Concours met en avant les lots premium avec des avis, des classements et des profils de testeurs.",
    details: [
      "Tu peux comparer les lots en concours avant de choisir.",
      "Les retours clients aident a suivre les favoris de la saison.",
      "Les recompenses et badges du concours peuvent renvoyer vers ton album.",
    ],
    route: "/arene",
  },
  {
    id: "finish",
    title: "Tu es pret",
    text: "Le plus important: Boutique pour choisir, Mon album pour collectionner, Concours pour suivre les lots premium.",
    details: [
      "Commence par la boutique si tu veux commander.",
      "Passe par Mon album pour ouvrir tes boosters.",
      "Va dans Concours pour suivre les classements et les avis.",
    ],
    route: "/",
  },
];
