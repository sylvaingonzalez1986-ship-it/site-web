import type { KqSchoolCrossword } from "./kanab-quest-school-content";
/** Public, non-monetary learning aid. No synthesis quiz answers are imported. */
export const TERPENE_CROSSWORD: KqSchoolCrossword = {
  id: "terpenes-crossword", title: "Des odeurs aux preuves", lessonId: "molecules", width: 11, height: 9,
  entries: [
    { number: 1, answer: "TERPENE", displayAnswer: "Terpène", clue: "Famille à laquelle appartient le limonène ; au sens strict, un hydrocarbure isoprénique.", row: 0, col: 8, direction: "down", sourceIds: ["terpenes-lesson-terpenes"] },
    { number: 2, answer: "SEUIL", displayAnswer: "Seuil", clue: "Limite de perception mesurée dans des conditions précisées : … olfactif.", row: 1, col: 6, direction: "down", sourceIds: ["terpenes-lesson-rice2015"] },
    { number: 3, answer: "ISOMERE", displayAnswer: "Isomère", clue: "Molécule de même formule brute qu’une autre, avec un arrangement différent.", row: 2, col: 4, direction: "down", sourceIds: ["terpenes-lesson-enantiomer"] },
    { number: 4, answer: "ODEUR", displayAnswer: "Odeur", clue: "Perception olfactive ; elle n’est pas une concentration mesurée.", row: 3, col: 10, direction: "down", sourceIds: ["terpenes-lesson-olfaction"] },
    { number: 5, answer: "MELANGE", displayAnswer: "Mélange", clue: "Ensemble de plusieurs substances, dont la perception peut différer de celle des composants isolés.", row: 5, col: 4, direction: "across", sourceIds: ["terpenes-lesson-laing1989","terpenes-lesson-jinks2001"] },
    { number: 6, answer: "ESTER", displayAnswer: "Ester", clue: "Fonction chimique de l’hexanoate de propyle, composé non terpénique documenté.", row: 7, col: 0, direction: "across", sourceIds: ["terpenes-lesson-nonterpenes2023"] },
  ],
};
