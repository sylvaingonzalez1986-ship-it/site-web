import type { ContestScoreCriterion } from "@/types/contest";

export type ContestScoreBand = {
  range: string;
  label: string;
  description: string;
};

export type ContestCriterionGuide = {
  criterion: ContestScoreCriterion;
  shortTitle: string;
  promise: string;
  method: string[];
  positiveSignals: string[];
  warningSignals: string[];
  scoreBands: ContestScoreBand[];
};

export type ContestGuideSection = {
  title: string;
  body: string;
  bullets: string[];
};

export const CONTEST_CBD_TASTING_RULES = [
  "Les lots concours sont selectionnes comme fleurs conformes et l'analyse est consultable quand elle est disponible.",
  "Le carnet juge la qualite sensorielle: aspect, nez, curing, bouche, douceur et coherence.",
  "Les taux de laboratoire ne sont pas des criteres de classement dans le carnet.",
  "On ne note pas un high, une puissance, une montee ou une duree d'effet.",
  "Une bonne note doit recompenser une fleur propre, lisible, agreable et bien travaillee.",
];

const DEFAULT_SCORE_BANDS: ContestScoreBand[] = [
  {
    range: "1-30",
    label: "Defaut net",
    description: "Le probleme domine l'experience ou empeche de juger sereinement.",
  },
  {
    range: "31-60",
    label: "Correct mais limite",
    description: "La fleur est consommable, mais manque de nettete, d'equilibre ou de precision.",
  },
  {
    range: "61-80",
    label: "Tres bon",
    description: "Le critere est clair, propre et agreable, avec seulement de petites limites.",
  },
  {
    range: "81-100",
    label: "Niveau concours",
    description: "Le critere ressort franchement, sans defaut notable, avec une vraie memorabilite.",
  },
];

export const CONTEST_CRITERION_GUIDES = {
  appearance: {
    criterion: "appearance",
    shortTitle: "Aspect visuel",
    promise: "Regarde si la fleur donne une impression de soin avant meme de la sentir.",
    method: [
      "Observe sous une lumiere neutre, sans flash direct.",
      "Regarde la structure: fleur aeree, compacte, reguliere ou ecrasee.",
      "Cherche les trichomes, la couleur, les pistils et les signes de vieillissement.",
    ],
    positiveSignals: [
      "Structure lisible et coherente avec la culture annoncee.",
      "Trichomes visibles, fleur non ecrasee, couleur vivante.",
      "Aucun signe de moisissure, poussiere, brunissement suspect ou corps etranger.",
    ],
    warningSignals: [
      "Fleur terne, friable, trop compacte ou aplatie.",
      "Taches grises/blanches suspectes, odeur humide associee.",
      "Aspect vieux stock ou manipulation trop brutale.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  manicure: {
    criterion: "manicure",
    shortTitle: "Manucure",
    promise: "La manucure montre le soin apporte apres recolte, sans chercher une fleur sterile.",
    method: [
      "Observe les petites feuilles sucrees autour de la tete.",
      "Regarde si les tiges inutiles et feuilles seches prennent trop de place.",
      "Ne confonds pas manucure propre et fleur rasee: trop couper peut aussi abimer.",
    ],
    positiveSignals: [
      "Peu de feuilles inutiles, tige discrete, fleur facile a lire.",
      "Trichomes preserves, pas de tete massacree par la coupe.",
      "Equilibre entre proprete visuelle et respect de la fleur.",
    ],
    warningSignals: [
      "Beaucoup de feuilles seches, tiges apparentes ou debris.",
      "Manucure trop agressive, fleur abimee ou ouverte partout.",
      "Presentation qui donne plus de feuille que de fleur.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  drying_curing: {
    criterion: "drying_curing",
    shortTitle: "Sechage / curing",
    promise: "Le curing doit rendre les aromes nets, pas masquer la fleur par du foin ou de l'humide.",
    method: [
      "Pince doucement: la fleur doit garder une petite souplesse sans coller.",
      "Casse un petit morceau: il doit s'ouvrir proprement, pas tomber en poussiere.",
      "Sens juste apres ouverture: cherche foin, cave, ammoniac, moisi ou poussiere.",
    ],
    positiveSignals: [
      "Texture ni trop humide ni trop cassante.",
      "Aromes lisibles apres ouverture, sans odeur de stockage douteux.",
      "La fleur reste agreable apres quelques minutes d'aeration.",
    ],
    warningSignals: [
      "Foin, cave, humidite, poussiere ou ammoniac.",
      "Fleur qui s'effrite instantanement ou reste spongieuse.",
      "Nez plat car les composes volatils semblent deja partis.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  cold_aroma: {
    criterion: "cold_aroma",
    shortTitle: "Nez a froid",
    promise: "Le nez a froid est la premiere signature de la fleur, avant toute chauffe.",
    method: [
      "Sens une premiere fois sans toucher, puis attends quelques secondes.",
      "Ouvre legerement la fleur ou remue le contenant, puis sens a nouveau.",
      "Nomme d'abord ce que tu percois: agrume, pin, epice, terre, fruit, floral, herbe.",
    ],
    positiveSignals: [
      "Arome identifiable rapidement, propre et agreable.",
      "Une famille principale claire avec une ou deux nuances secondaires.",
      "Le nez reste present apres plusieurs respirations.",
    ],
    warningSignals: [
      "Odeur muette, confuse ou uniquement vegetale.",
      "Foin, moisi, chimique agressif ou cave humide.",
      "Arome plaisant au debut mais qui disparait presque aussitot.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  aroma_intensity: {
    criterion: "aroma_intensity",
    shortTitle: "Intensite aromatique",
    promise: "L'intensite mesure la presence du nez, pas seulement ton appreciation personnelle.",
    method: [
      "Eloigne legerement le contenant: est-ce encore perceptible ?",
      "Compare avec ton souvenir d'autres fleurs du concours.",
      "Note l'intensite sans confondre puissance et qualite: fort mais sale reste mal note.",
    ],
    positiveSignals: [
      "Nez franc des l'ouverture, sans forcer.",
      "Presence qui tient apres aeration.",
      "Intensite nette mais pas agressive.",
    ],
    warningSignals: [
      "Arome tres faible ou absent.",
      "Odeur forte mais brouillonne, irritante ou defectueuse.",
      "Profil qui s'effondre apres quelques secondes.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  aroma_complexity: {
    criterion: "aroma_complexity",
    shortTitle: "Complexite aromatique",
    promise: "La complexite recompense les couches aromatiques coherentes, pas une odeur confuse.",
    method: [
      "Cherche la famille dominante, puis les notes secondaires.",
      "Demande-toi si les notes se completent ou se contredisent.",
      "Utilise les tags comme vocabulaire, pas comme obligation de tout cocher.",
    ],
    positiveSignals: [
      "Profil en plusieurs couches: par exemple agrume + pin + epice douce.",
      "Evolution apres ouverture ou apres broyage leger.",
      "Aromes precis, pas juste une odeur generique de chanvre.",
    ],
    warningSignals: [
      "Une seule note plate et courte.",
      "Melange flou impossible a decrire.",
      "Complexite cachee par un defaut de sechage ou stockage.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  flavor: {
    criterion: "flavor",
    shortTitle: "Gout",
    promise: "Le gout doit prolonger le nez et rester lisible pendant la degustation.",
    method: [
      "Prends une petite premiere bouffee ou inhalee, sans chercher gros volume.",
      "Compare bouche et nez: est-ce coherent ou totalement efface ?",
      "Note les saveurs percussives, puis ce qui apparait en deuxieme partie.",
    ],
    positiveSignals: [
      "Le profil aromatique se retrouve en bouche.",
      "Gout propre, identifiable, sans amertume dominante.",
      "Une note secondaire apparait avec la chauffe ou la vapeur.",
    ],
    warningSignals: [
      "Gout de carton, foin, brule sale ou chimique.",
      "Nez prometteur mais bouche presque vide.",
      "Amertume ou irritation qui recouvre tout.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  smoothness_burn: {
    criterion: "smoothness_burn",
    shortTitle: "Douceur / combustion",
    promise: "Ici on juge le confort sensoriel, pas un effet: douceur, proprete, irritation, regularite.",
    method: [
      "Avec vaporisateur, regarde si la vapeur reste ronde ou devient piquante trop vite.",
      "Avec combustion, observe la regularite, la chaleur, l'acrete et la facilite de tirage.",
      "Si tu utilises du tabac, note-le: il change fortement la perception.",
    ],
    positiveSignals: [
      "Experience douce, sans gorge qui accroche immediatement.",
      "Chauffe ou combustion reguliere, peu d'agressivite.",
      "La fleur reste confortable assez longtemps pour etre analysee.",
    ],
    warningSignals: [
      "Acrete rapide, irritation forte, gout de brule agressif.",
      "Combustion irreguliere ou besoin de rallumer souvent.",
      "Sensation de residue humide, sale ou trop sec.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  persistence: {
    criterion: "persistence",
    shortTitle: "Persistance",
    promise: "La persistance mesure ce qui reste apres la bouche: longueur, proprete et souvenir aromatique.",
    method: [
      "Attends 20 a 30 secondes apres une petite prise.",
      "Demande-toi ce qui reste: agrume, pin, douceur, epice, amertume ou rien.",
      "Note plus haut si la longueur reste agreable, pas seulement si elle est forte.",
    ],
    positiveSignals: [
      "Retour aromatique propre apres la degustation.",
      "Longueur agreable, meme si elle est delicate.",
      "Fin coherente avec le nez et le gout.",
    ],
    warningSignals: [
      "Fin courte, vide ou uniquement seche.",
      "Amertume, cendre ou irritation qui domine.",
      "Persistance des defauts plutot que des aromes.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
  overall_impression: {
    criterion: "overall_impression",
    shortTitle: "Impression generale",
    promise: "Le verdict recompense l'equilibre complet, pas un seul moment spectaculaire.",
    method: [
      "Relis tes notes visuel, nez, bouche et douceur.",
      "Cherche le fil conducteur: qu'est-ce que cette fleur raconte clairement ?",
      "Si un defaut net apparait, la note globale doit le refleter.",
    ],
    positiveSignals: [
      "Fleur coherente du premier nez a la fin de bouche.",
      "Aucun defaut majeur, une identite sensorielle memorisable.",
      "Le niveau donne envie de comparer cette fleur aux meilleures du concours.",
    ],
    warningSignals: [
      "Un seul bon critere compense mal plusieurs faiblesses.",
      "Profil prometteur mais trop irregulier.",
      "Experience correcte, mais sans signature ni precision.",
    ],
    scoreBands: DEFAULT_SCORE_BANDS,
  },
} satisfies Record<ContestScoreCriterion, ContestCriterionGuide>;

export const CONTEST_PREPARATION_GUIDE: ContestGuideSection[] = [
  {
    title: "Mets le nez dans de bonnes conditions",
    body: "Une fleur delicate se juge mal apres cafe fort, parfum, cuisine ou piece enfumee.",
    bullets: [
      "Lave-toi les mains si tu as manipule nourriture, savon ou parfum.",
      "Evite les odeurs parasites autour de toi.",
      "Sens calmement, fais une pause, puis reviens au lot.",
    ],
  },
  {
    title: "Garde le meme rituel",
    body: "Les notes sont plus justes si chaque lot est teste avec une routine proche.",
    bullets: [
      "Meme materiel autant que possible.",
      "Meme quantite approximative.",
      "Meme logique: observer, sentir, deguster, noter.",
    ],
  },
  {
    title: "Decris avant de juger",
    body: "La meilleure note vient apres les mots. D'abord tu identifies, ensuite tu choisis la note.",
    bullets: [
      "Famille dominante: fruit, agrume, pin, terre, floral, epice.",
      "Qualite: propre, net, doux, frais, lourd, sec, agressif.",
      "Puis seulement: est-ce faible, bon, tres bon ou concours ?",
    ],
  },
];

export const CONTEST_AROMA_LEXICON_GUIDE = [
  {
    family: "Agrumes",
    cues: "Citron, orange, zeste, pamplemousse.",
    nearbyTerpenes: "Limonene, terpinolene, valencene.",
  },
  {
    family: "Pin / resine",
    cues: "Foret, sapin, romarin, resine fraiche.",
    nearbyTerpenes: "Alpha-pinene, beta-pinene, camphene.",
  },
  {
    family: "Terreux / boise",
    cues: "Terre propre, bois sec, houblon, sous-bois.",
    nearbyTerpenes: "Myrcene, humulene, caryophyllene.",
  },
  {
    family: "Epice / poivre",
    cues: "Poivre noir, girofle, cannelle seche.",
    nearbyTerpenes: "Beta-caryophyllene, caryophyllene oxide.",
  },
  {
    family: "Floral / doux",
    cues: "Lavande, rose, camomille, fleur blanche.",
    nearbyTerpenes: "Linalool, geraniol, bisabolol, nerolidol.",
  },
  {
    family: "Fruite / gourmand",
    cues: "Fruit rouge, mangue, bonbon, fruit mur.",
    nearbyTerpenes: "Myrcene, ocimene, terpinolene, geraniol.",
  },
];

export const CONTEST_STANDARD_GUIDE = {
  positives: [
    "Fleur propre, sans odeur de foin, moisi, humidite ou poussiere.",
    "Sechage maitrise: ni cassant, ni trop humide.",
    "Curing net, avec des aromes lisibles et non agressifs.",
    "Manucure soignee, mais trichomes preserves.",
    "Gout coherent avec le nez, puis persistance aromatique agreable.",
    "Vaporisation ou combustion douce, non acre.",
  ],
  redFlags: [
    "Odeur de cave, moisi, ammoniac, foin humide ou poussiere.",
    "Fleur spongieuse, collante d'humidite ou friable comme du sable.",
    "Arome plat, vieux stock ou entierement masque par un defaut.",
    "Gout agressif, chimique, amer ou brule sale.",
    "Belle apparence mais bouche vide ou irritante.",
  ],
};

export const CONTEST_VERDICT_GUIDE = [
  "Phrase 1: ce que tu as vu.",
  "Phrase 2: ce que tu as senti a froid.",
  "Phrase 3: ce que la degustation confirme ou contredit.",
  "Phrase 4: ton verdict sensoriel, sans parler d'effet ou de puissance.",
];
