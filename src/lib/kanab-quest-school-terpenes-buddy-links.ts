import type { TerpeneBuddyLink } from "./kanab-quest-school-terpenes-types";

// Petit module autonome : les fiches Buddy n’importent pas l’encyclopédie complète.
// Les liens rapprochent un vocabulaire sensoriel ; ils ne certifient pas une composition.
export const TERPENE_BUDDY_COMPOUND_LABELS: Readonly<Record<string, string>> = {
  "limonene": "Limonène",
  "linalool": "Linalol",
  "alphapinene": "α-Pinène",
  "betapinene": "β-Pinène"
};

export const TERPENE_BUDDY_LINKS: readonly TerpeneBuddyLink[] = [
  {
    "buddyCode": "HH2026-005",
    "compoundIds": [
      "limonene"
    ],
    "exactExcerpt": "pomelo, lemon, sour orange",
    "attribution": "CBD Seed Labs, rubrique « Flavor & Aroma » de sa sélection ACDC ; rapprochement avec la note de jeu Citron.",
    "sourceIds": [
      "tp-buddy-acdc"
    ],
    "limitation": "Lien de vocabulaire sensoriel, pas preuve de présence de ces molécules dans ce Buddy. Une note pin, citron ou florale peut venir d’un mélange ; aucun taux, effet ou profil universel n’est attribué à la carte."
  },
  {
    "buddyCode": "HH2026-007",
    "compoundIds": [
      "linalool"
    ],
    "exactExcerpt": "subtle earthy floral notes",
    "attribution": "East Fork Cultivars, « Tasting Notes » de sa sélection Hawaiian Haze ; rapprochement pédagogique avec Floral.",
    "sourceIds": [
      "tp-buddy-hawaiian"
    ],
    "limitation": "Lien de vocabulaire sensoriel, pas preuve de présence de ces molécules dans ce Buddy. Une note pin, citron ou florale peut venir d’un mélange ; aucun taux, effet ou profil universel n’est attribué à la carte."
  },
  {
    "buddyCode": "HH2026-013",
    "compoundIds": [
      "alphapinene",
      "betapinene",
      "limonene"
    ],
    "exactExcerpt": "Citrus | Diesel | Pine",
    "attribution": "Cannaflower, rubrique « Aroma » de son produit Remedy ; rapprochement avec les notes de jeu Citron et Pin.",
    "sourceIds": [
      "tp-buddy-remedy"
    ],
    "limitation": "Lien de vocabulaire sensoriel, pas preuve de présence de ces molécules dans ce Buddy. Une note pin, citron ou florale peut venir d’un mélange ; aucun taux, effet ou profil universel n’est attribué à la carte."
  }
];

