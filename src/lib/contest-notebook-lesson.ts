import type { ContestScoreCriterion } from "@/types/contest";
import { CONTEST_SCORE_MAX, CONTEST_SCORE_MIN } from "./contest-score";

export type NotebookLessonExplanation = {
  title: string;
  instruction: string;
};

/** Short, contextual explanations for the native Carnet's training form. */
export const NOTEBOOK_LESSON_CRITERIA = {
  appearance: {
    title: "Aspect visuel · l’état de la fleur",
    instruction: "Tu juges la présentation : structure, couleur et état de la fleur. Dans cet exemple fictif, une fleur écrasée et terne mérite moins qu’une fleur intacte aux détails bien visibles. Choisis une note avec le curseur, ou confirme la valeur proposée.",
  },
  manicure: {
    title: "Manucure · le soin de la finition",
    instruction: "Cette ligne juge le travail de coupe : feuilles superflues, tiges et respect de la fleur. Imagine beaucoup de débris pour une note basse, ou une finition soignée sans fleur abîmée pour une note haute. Ajuste le curseur, ou confirme la note proposée.",
  },
  drying_curing: {
    title: "Séchage / curing · la qualité de la préparation",
    instruction: "Tu juges le séchage et l’affinage après récolte, à travers la texture et la netteté des arômes. Dans notre exemple, une fleur friable au nez de foin reçoit moins qu’une texture équilibrée aux arômes nets. Choisis ta note, ou confirme celle proposée.",
  },
  cold_aroma: {
    title: "Nez à froid · la netteté de l’odeur",
    instruction: "Cette ligne juge la qualité de l’odeur de la fleur avant toute chauffe : est-elle identifiable et agréable ? Dans notre exemple, un parfum citronné précis mérite plus qu’une odeur confuse dominée par le foin. Ajuste le curseur, ou confirme la note proposée.",
  },
  aroma_intensity: {
    title: "Intensité aromatique · la présence du parfum",
    instruction: "Tu juges à quel point les arômes sont perceptibles et restent présents. Imagine un parfum presque absent pour une note basse, ou un parfum franc et durable pour une note haute ; une odeur forte mais déplaisante ne suffit pas. Choisis ta note, ou confirme celle proposée.",
  },
  aroma_complexity: {
    title: "Complexité aromatique · les nuances",
    instruction: "Cette ligne juge les différentes notes que tu peux distinguer et leur harmonie. Dans notre exemple, une seule note plate reçoit moins qu’un ensemble lisible d’agrumes, de pin et d’épices ; multiplier les cases cochées n’augmente pas la note. Ajuste le curseur, ou confirme la note proposée.",
  },
  flavor: {
    title: "Goût · la qualité des saveurs",
    instruction: "Tu juges les saveurs perçues et leur cohérence avec les arômes décrits sur la page précédente. Imagine un goût effacé ou dominé par l’amertume pour une note basse, et des saveurs nettes et équilibrées pour une note haute. Choisis ta note fictive, ou confirme celle proposée.",
  },
  smoothness_burn: {
    title: "Douceur / combustion · le confort sensoriel",
    instruction: "Cette ligne juge la douceur ou l’âcreté, ainsi que la régularité selon le mode renseigné au départ. Dans notre exemple fictif, une sensation agressive reçoit moins qu’une sensation douce et régulière ; le critère porte sur le confort décrit. Ajuste le curseur, ou confirme la note proposée.",
  },
  persistence: {
    title: "Persistance · ce qui reste des saveurs",
    instruction: "Tu juges la longueur et la qualité du souvenir aromatique après la dégustation. Dans notre exemple, une saveur qui disparaît aussitôt reçoit moins qu’une agréable note d’agrume qui reste ; une amertume durable ne mérite pas une bonne note pour sa seule durée. Choisis ta note, ou confirme celle proposée.",
  },
  overall_impression: {
    title: "Impression générale · ton jugement d’ensemble",
    instruction: "Cette dernière ligne juge l’équilibre entre l’aspect, les arômes, le goût et le confort. Imagine une belle présentation suivie de plusieurs déceptions pour une note basse, ou une expérience cohérente et soignée pour une note haute. Relis tes impressions, puis ajuste ou confirme cette note finale.",
  },
} satisfies Record<ContestScoreCriterion, NotebookLessonExplanation>;

export const NOTEBOOK_LESSON_SCORE_SCALE =
  `Chaque ligne va de ${CONTEST_SCORE_MIN} à ${CONTEST_SCORE_MAX} : ${CONTEST_SCORE_MIN}–30, défaut marqué ; 31–60, correct mais perfectible ; 61–80, très bon ; 81–${CONTEST_SCORE_MAX}, niveau concours. La valeur affichée au départ reste à confirmer : elle ne compte pas encore comme une note.`;

export const NOTEBOOK_LESSON_FIELDS = {
  mode: {
    title: "Le mode · un seul choix",
    instruction: "Ce choix donne le contexte de tes impressions, notamment pour le goût et la douceur. Les boutons fonctionnent comme un choix unique : sélectionner un autre mode remplace le précédent. Pour cette fiche fictive, clique sur un mode, même si Vaporisateur est déjà proposé.",
  },
  modeDetails: {
    title: "Les précisions · un contexte facultatif",
    instruction: "Ce champ permet de préciser le matériel ou une particularité utile pour relire tes notes. Il reste facultatif : tu peux écrire « Matériel d’essai de Sylvain » pour t’entraîner, ou le laisser vide. Ces précisions ne donnent aucun point.",
  },
  aromas: {
    title: "Les arômes · nommer une impression",
    instruction: "Ces cases nomment les familles d’odeurs et de saveurs : Agrumes évoque citron ou orange, Floral évoque les fleurs. Elles décrivent tes impressions et ne donnent aucun point. Pour notre fleur fictive, essaie de cocher Agrumes.",
  },
  otherAroma: {
    title: "Autre · préciser une nuance",
    instruction: "La case Autre fait apparaître un champ pour nommer une impression absente de la liste. Tu peux y écrire, par exemple, « Thé noir » pour cette fleur fictive. Dans ton Carnet, garde seulement les familles et nuances que tu reconnais.",
  },
  comment: {
    title: "Le commentaire · expliquer tes notes",
    instruction: "Décris ce qui justifie tes notes : un détail visuel, une famille aromatique, puis une qualité ou une limite. Par exemple : « Fleur bien présentée, agrumes et pin, mais saveurs assez courtes. » Préremplir propose une base à relire et personnaliser ; le texte doit rester cohérent avec tes choix.",
  },
  recap: {
    title: "La relecture · vérifier l’ensemble",
    instruction: "Vérifie ton mode, les familles cochées, tes dix notes et ton commentaire ; tu peux revenir aux pages précédentes pour les corriger. Le Carnet décrit les qualités sensorielles de la fleur. Quand ta fiche fictive te convient, termine l’exercice : aucun avis réel ne sera publié.",
  },
} satisfies Record<string, NotebookLessonExplanation>;
