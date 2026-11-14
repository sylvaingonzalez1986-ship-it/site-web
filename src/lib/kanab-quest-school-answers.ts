import "server-only";
import { HARVEST_ANSWERS } from "./kanab-quest-school-harvest-answers";
import { PRODUCTS_ANSWERS } from "./kanab-quest-school-products-answers";
import { SOIL_ANSWERS } from "./kanab-quest-school-soil-answers";
import { HEALTH_ANSWERS } from "./kanab-quest-school-health-answers";
import { CULTIVATION_ANSWERS } from "./kanab-quest-school-cultivation-answers";
import { CANNABINOID_ANSWERS } from "./kanab-quest-school-cannabinoids-answers";
import { TERPENE_ANSWERS } from "./kanab-quest-school-terpenes-answers";
import { HISTORY_EARLY_ANSWERS } from "./kanab-quest-school-history-early-answers";
import { HISTORY_MODERN_ANSWERS } from "./kanab-quest-school-history-modern-answers";
import { BOTANY_FOUNDATIONS_ANSWERS } from "./kanab-quest-school-botany-foundations-answers";
import { BOTANY_DIVERSITY_ANSWERS } from "./kanab-quest-school-botany-diversity-answers";

/** Authoring key: never import this module from a Client Component or a public quiz response. */
export type KqSchoolAnswer = Readonly<{ correctOptionId: string; explanation: string; optionExplanations?: Readonly<Record<string, string>> }>;
type AnswerRow = readonly [correctOptionId: "a" | "b" | "c" | "d", explanation: string];
const answerRows: Readonly<Record<string, readonly AnswerRow[]>> = {
  plant: [
    ["a", "Kew classe Cannabis sativa dans les Cannabacées, famille qui comprend aussi le houblon."],
    ["b", "Une feuille composée comporte plusieurs folioles. Une foliole ne se confond pas avec une fleur."],
    ["c", "Les racines participent à l’ancrage et à l’absorption de l’eau et des éléments minéraux."],
    ["d", "Les feuilles sont un lieu majeur de photosynthèse : leur surface et leurs tissus participent à cette fonction."],
    ["a", "Le chanvre est principalement anémophile : son pollen est transporté par le vent."],
    ["c", "Dioïque signifie que les fleurs mâles et femelles sont portées par des individus distincts."],
    ["b", "La fleur porte les structures reproductrices ; une fibre ou une foliole n’est pas une fleur."],
    ["d", "La pollinisation est l’arrivée du pollen sur la partie réceptrice d’une fleur. Elle précède l’éventuelle fécondation."],
    ["b", "Monoïque décrit un individu portant les deux types de fleurs. Ce terme ne promet aucune qualité commerciale."],
    ["a", "La fiche précise que L’Arbre Mère est un personnage du jeu, sans être une variété réelle ni l’ancêtre commun des variétés."],
  ],
  molecules: [
    ["c", "CBD abrège cannabidiol, une molécule de la famille des cannabinoïdes."],
    ["a", "CBD et THC sont deux cannabinoïdes distincts. Un terpène ou un grain de pollen appartient à un autre registre."],
    ["d", "Plusieurs terpènes contribuent aux odeurs. Une odeur ne suffit pas à mesurer la composition chimique."],
    ["b", "Les trichomes glandulaires produisent et accumulent des substances à la surface de la plante ; ils ne sont pas du pollen."],
    ["c", "Le limonène est un terpène. Cannabidiol est un cannabinoïde et chènevis désigne la graine."],
    ["d", "Un descripteur citronné est sensoriel. Une teneur en limonène exige une analyse appropriée d’un échantillon identifié."],
    ["a", "Le profil de Harlequin dans le Quartier affiche mangue et terre. C’est une description attribuée à sa fiche, pas un effet garanti."],
    ["b", "La fiche d’ACDC affiche citron et diesel. Ces comparaisons sensorielles ne donnent pas un dosage."],
    ["c", "Une note aromatique établit ce que la fiche décrit. Elle ne prouve ni efficacité, ni concentration, ni sécurité."],
    ["d", "Le CBD est distinct du THC et peut néanmoins provoquer des effets indésirables ou interagir avec des médicaments."],
  ],
  profiles: [
    ["b", "Un chémotype caractérise une composition chimique, par exemple des proportions relatives de cannabinoïdes."],
    ["d", "Le nom commercial ne garantit à lui seul ni effet personnel, ni teneur de chaque lot, ni lieu de production."],
    ["a", "L’analyse du lot apporte une mesure de cet échantillon, dans les limites des paramètres et de la méthode utilisés."],
    ["c", "Les étiquettes commerciales indica et sativa ne résument pas toute la variation génétique et chimique, ni la réponse d’une personne."],
    ["b", "1 % = 1 g pour 100 g = 0,01 g/g = 10 mg/g. C’est une conversion d’unités, pas une recommandation d’usage."],
    ["a", "Le lot et la date permettent de rattacher le résultat à ce qui a réellement été analysé."],
    ["d", "Sour Space Candy est décrite dans sa fiche par pomme confite et cerise. Cette attribution ne vaut pas pour tous les produits homonymes."],
    ["c", "La fiche de Hawaiian Haze décrit ananas et floral. Le nom ne prouve pas à lui seul l’origine géographique d’un lot."],
    ["b", "Une information absente reste inconnue. La remplacer par zéro donnerait une fausse mesure."],
    ["a", "mg/mL rapporte une masse à un volume ; un pourcentage en masse rapporte deux masses. Il faut notamment relier masse et volume pour convertir."],
  ],
  genetics: [
    ["d", "Le génotype concerne la constitution génétique ou des variantes de l’ADN à des positions données."],
    ["a", "La hauteur mesurée est un caractère observable, donc phénotypique."],
    ["b", "Le phénotype résulte de facteurs génétiques et environnementaux ; une différence visible n’est pas automatiquement une différence d’ADN."],
    ["c", "La sélection porte sur des caractères définis et leur évaluation ; elle ne transforme pas un nom en garantie médicale."],
    ["d", "DHS signifie distinction, homogénéité, stabilité. Ces études contribuent à l’identification d’une variété."],
    ["b", "La faculté germinative est évaluée pour un lot selon des conditions définies ; elle ne prédit pas tous ses résultats dans tous les milieux."],
    ["a", "Des comparaisons organisées aident à distinguer les effets du matériel étudié et ceux des conditions d’observation."],
    ["c", "La fiche de Cannatonic attribue à Resin Seeds une correction publiée en 2015 : Reina Madre × NYCD. Il s’agit de cette sélection documentée."],
    ["d", "La diversité génétique concerne des différences dans l’information génétique, pas le nombre d’étiquettes commerciales."],
    ["b", "En l’absence de provenance établie, la parenté reste incertaine. Une ressemblance d’arôme ou de nom ne la démontre pas."],
  ],
  history: [
    ["a", "Les braseros de Jirzankal sont datés d’environ 500 avant notre ère ; l’étude des résidus a été publiée en 2019."],
    ["c", "Les objets proviennent d’un contexte funéraire. Ce contexte est essentiel à l’interprétation des traces."],
    ["b", "Une trace documente une pratique située. Elle ne prouve pas qu’aucun usage antérieur n’a existé ailleurs."],
    ["d", "Kew référence la publication du nom Cannabis sativa L. en 1753. Ce n’est pas la date d’apparition de la plante."],
    ["a", "Le travail de 1964 de Gaoni et Mechoulam porte sur l’isolement et la structure du THC. La date de numérisation n’est pas celle de la recherche."],
    ["b", "Matsuda et ses collègues publient en 1990 le clonage et l’expression d’un récepteur cannabinoïde, aujourd’hui nommé CB1."],
    ["d", "L’anandamide est produite dans l’organisme : c’est un endocannabinoïde, identifié par Devane et ses collègues en 1992."],
    ["c", "La fiche de Charlotte’s Web situe le travail des frères Stanley au Colorado. C’est une histoire attribuée à cette sélection."],
    ["b", "2022 vient après 1992. Ce repère juridique est distinct des découvertes de chimie et de biologie."],
    ["a", "L’atelier est un classement chronologique. Les cartes sont régulièrement espacées pour être lisibles ; elles ne représentent pas une échelle temporelle."],
  ],
  uses: [
    ["c", "Le chènevis est la graine de chanvre ; il ne faut pas le confondre avec la chènevotte."],
    ["a", "La chènevotte correspond à la partie interne ligneuse de la tige, séparée des fibres lors du défibrage."],
    ["d", "Les fibres de la tige peuvent être transformées pour des usages textiles."],
    ["b", "Le défibrage sépare les constituants de la paille, notamment les fibres et la chènevotte."],
    ["c", "InterChanvre cite notamment les litières animales, le paillage et le bâtiment parmi les usages de la chènevotte."],
    ["d", "Une huile issue des graines et une huile enrichie en CBD n’ont pas la même composition ; leurs règles applicables peuvent différer."],
    ["a", "Les fibres sont transformées en fil, puis le fil permet de réaliser un tissu. Le pollen et la graine ne sont pas des fibres textiles."],
    ["b", "Un composite associe plusieurs constituants. La présence de fibres de chanvre ne signifie pas que tout l’objet est du chanvre."],
    ["c", "Une comparaison environnementale doit porter sur un service comparable et examiner le cycle de vie, pas seulement l’origine végétale."],
    ["d", "La papeterie fait partie des débouchés documentés des fibres de chanvre."],
  ],
  evidence: [
    ["d", "Le texte de la décision est la source primaire qui permet d’en vérifier la portée."],
    ["b", "Le témoignage rapporte une expérience individuelle ; il ne suffit pas à isoler une cause ni à garantir un effet pour tous."],
    ["c", "Non détecté doit être lu avec la limite de détection et la méthode. Ce n’est pas une preuve d’absence absolue."],
    ["a", "Une mesure est rattachée à un échantillon. Le lot B nécessite des informations qui le concernent."],
    ["d", "2 % en masse = 2 g/100 g = 20 mg/g. Il faut conserver l’unité et la grandeur comparée."],
    ["b", "Une association observée peut avoir d’autres explications. Démontrer une causalité nécessite des données et un protocole adaptés."],
    ["a", "Elektra est associée à orange et chocolat dans sa fiche. Cette réponse se vérifie dans le profil du jeu."],
    ["c", "La référence doit soutenir l’affirmation précise. Une citation hors sujet ne la prouve ni ne la réfute à elle seule."],
    ["d", "L’échantillonnage conditionne la portée d’une enquête ; les produits étudiés ne représentent pas automatiquement tout le marché."],
    ["b", "Attribuer le profil à la fiche respecte le type de preuve disponible. Il ne devient pas une analyse ni une promesse de soin."],
  ],
  biodiversity: [
    ["b", "Cornell a observé des abeilles récoltant du pollen sur les fleurs mâles de chanvre."],
    ["a", "Le pollen est une ressource différente du nectar. Le chanvre étudié fournit du pollen et pas de nectar."],
    ["c", "La récolte de pollen par les abeilles peut coexister avec sa dispersion par le vent. Une visite ne prouve pas la présence de nectar."],
    ["d", "Un auxiliaire contribue à un service utile, par exemple la prédation de certains ravageurs."],
    ["a", "Une rotation organise la succession des cultures sur la même parcelle au fil du temps."],
    ["c", "Une adaptation à la sécheresse ne supprime pas les besoins en eau ni les effets du sol et du climat."],
    ["b", "Les habitats et ressources voisins influencent les organismes présents et les relations écologiques."],
    ["d", "Le profil de Suver Haze affiche pomme verte et poivre. Ce sont des notes de fiche, pas des propriétés écologiques."],
    ["a", "Les conditions locales, les saisons et le paysage doivent être considérés avant de généraliser une observation."],
    ["c", "Cette formulation donne une ressource observée et un périmètre. Les qualificatifs absolus masquent les conditions et les limites."],
  ],
  law: [
    ["a", "La règle vise l’éligibilité à l’aide agricole. Elle ne remplace ni les règles alimentaires, ni le droit de la conduite, ni l’évaluation d’un médicament."],
    ["c", "Le seuil de THC ne remplace pas les conditions liées aux variétés, aux denrées, à la commercialisation ou à la conduite."],
    ["b", "L’article 1 de l’arrêté renvoie aux catalogues concernés en plus du critère de THC ; le seuil n’est pas l’unique condition."],
    ["d", "Le Conseil d’État a annulé l’interdiction générale des fleurs et feuilles concernées. Cela n’autorise pas tous les produits ni tous les usages."],
    ["a", "Le cadre agricole européen mentionne des semences certifiées et des variétés du catalogue commun, avec d’autres conditions d’éligibilité."],
    ["b", "Le rappel ministériel du 20 mai 2026 indique l’absence d’autorisation des denrées incluant du CBD parmi leurs ingrédients au titre des nouveaux aliments."],
    ["d", "Le ministère distingue les graines et leurs dérivés des produits enrichis en cannabinoïdes ; chaque catégorie doit respecter ses conditions."],
    ["c", "L’arrêt du 21 juin 2023 distingue vente licite du produit et conduite après usage de stupéfiants constaté. Une étiquette CBD n’est pas une garantie au dépistage."],
    ["b", "Le territoire, la date, la catégorie de produit et l’usage définissent le contexte de la règle."],
    ["a", "La décision de 2022 modifie la portée du texte initial. Une lecture du seul texte d’origine serait trompeuse sur ce point."],
  ],
  prevention: [
    ["d", "L’origine naturelle n’établit pas l’absence de risque. Composition, situation personnelle et interactions comptent."],
    ["a", "La somnolence fait partie des effets indésirables signalés. Une réaction personnelle nécessite un avis adapté."],
    ["b", "Un médecin ou un pharmacien peut examiner les interactions. Il ne faut pas modifier seul un traitement prescrit."],
    ["c", "Le CBD peut diminuer l’efficacité de certains médicaments ou augmenter leurs effets indésirables."],
    ["d", "Les agences ont signalé des substances non annoncées, dont des cannabinoïdes de synthèse et du THC en teneur inattendue."],
    ["c", "Une difficulté respiratoire ou une perte de connaissance constitue une urgence : appeler le 15 ou le 112."],
    ["a", "L’emballage et les références peuvent aider à identifier l’exposition. Ils ne garantissent pas que la composition annoncée est exacte."],
    ["b", "La fiche de Lifter affiche myrtille et fromage. Ce profil aromatique ne démontre aucun effet médical."],
    ["d", "Une efficacité médicale demande des preuves adaptées au produit et à la question. La popularité d’un témoignage ne suffit pas."],
    ["c", "Garder ces produits hors de portée des enfants évite notamment les confusions avec des bonbons ou aliments ordinaires."],
  ],
};

export const KQ_SCHOOL_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = Object.fromEntries(
  Object.entries(answerRows).flatMap(([moduleId, rows]) => rows.map(([correctOptionId, explanation], index) => [
    `${moduleId}-q${String(index + 1).padStart(2, "0")}`, { correctOptionId, explanation },
  ])),
);
/** Keep the legacy 100 keys intact for immutable receipts and old public lessons. */
export const KQ_SCHOOL_HISTORY_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = { ...HISTORY_EARLY_ANSWERS, ...HISTORY_MODERN_ANSWERS };
export const KQ_SCHOOL_BOTANY_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = { ...BOTANY_FOUNDATIONS_ANSWERS, ...BOTANY_DIVERSITY_ANSWERS };
export const KQ_SCHOOL_TERPENE_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = TERPENE_ANSWERS;
export const KQ_SCHOOL_CANNABINOID_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = CANNABINOID_ANSWERS;
export const KQ_SCHOOL_CULTIVATION_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = CULTIVATION_ANSWERS;
export const KQ_SCHOOL_HEALTH_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = HEALTH_ANSWERS;
export const KQ_SCHOOL_SOIL_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = SOIL_ANSWERS;
export const KQ_SCHOOL_PRODUCTS_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = PRODUCTS_ANSWERS;
export const KQ_SCHOOL_HARVEST_ANSWERS: Readonly<Record<string, KqSchoolAnswer>> = HARVEST_ANSWERS;
export function getKqSchoolAnswer(questionId: string): KqSchoolAnswer | undefined {
  if (Object.hasOwn(KQ_SCHOOL_HARVEST_ANSWERS, questionId)) return KQ_SCHOOL_HARVEST_ANSWERS[questionId];
  if (Object.hasOwn(KQ_SCHOOL_PRODUCTS_ANSWERS, questionId)) return KQ_SCHOOL_PRODUCTS_ANSWERS[questionId];
  if (Object.hasOwn(KQ_SCHOOL_SOIL_ANSWERS, questionId)) return KQ_SCHOOL_SOIL_ANSWERS[questionId];
  if (Object.hasOwn(KQ_SCHOOL_HEALTH_ANSWERS, questionId)) return KQ_SCHOOL_HEALTH_ANSWERS[questionId];
  if (Object.hasOwn(KQ_SCHOOL_CULTIVATION_ANSWERS, questionId)) return KQ_SCHOOL_CULTIVATION_ANSWERS[questionId];
  if (Object.hasOwn(KQ_SCHOOL_CANNABINOID_ANSWERS, questionId)) return KQ_SCHOOL_CANNABINOID_ANSWERS[questionId];
  if (Object.hasOwn(KQ_SCHOOL_TERPENE_ANSWERS, questionId)) return KQ_SCHOOL_TERPENE_ANSWERS[questionId];
  return Object.hasOwn(KQ_SCHOOL_BOTANY_ANSWERS, questionId) ? KQ_SCHOOL_BOTANY_ANSWERS[questionId]
    : Object.hasOwn(KQ_SCHOOL_HISTORY_ANSWERS, questionId) ? KQ_SCHOOL_HISTORY_ANSWERS[questionId]
    : Object.hasOwn(KQ_SCHOOL_ANSWERS, questionId) ? KQ_SCHOOL_ANSWERS[questionId] : undefined;
}
