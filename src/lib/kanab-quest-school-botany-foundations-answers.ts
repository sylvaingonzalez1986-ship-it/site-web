import "server-only";
import type { HistoryAnswer } from "./kanab-quest-school-history-types";

/** Private rewarded-quiz keys; returned by the server only after final submission. */
export const BOTANY_FOUNDATIONS_ANSWERS: Readonly<Record<string, HistoryAnswer>> = {
  "botany-anatomy-q01": {
    correctOptionId: "b", explanation: "Le pétiole commun relie une feuille composée à la tige. Les sept lames dentées en sont les folioles ; leur nombre n’est pas celui des feuilles attachées à la tige.",
    optionExplanations: {
      a: "Les divisions décrites ne s’insèrent pas indépendamment sur la tige : elles partagent le même pétiole.",
      b: "Oui : le point d’attache commun permet de reconnaître une feuille composée et ses folioles.",
      c: "Le dossier décrit des divisions foliaires, sans étamine, stigmate ou autre organe identifiant des fleurs.",
      d: "Les stipules sont de petites pièces près de la base du pétiole ; elles ne constituent pas l’éventail de folioles.",
    },
  },
  "botany-anatomy-q02": {
    correctOptionId: "d", explanation: "Les fibres du liber sont associées au phloème dans la partie périphérique de la tige, à l’extérieur des tissus ligneux. Une coupe permet de distinguer ces ensembles.",
    optionExplanations: {
      a: "Les anthères sont des organes floraux producteurs de pollen, pas le lieu des fibres du liber de la tige.",
      b: "Les trichomes sont des structures de surface ; leur position et leur fonction diffèrent de celles des fibres du phloème.",
      c: "Le centre ligneux appartient principalement au xylème. Les fibres du liber sont situées plus à l’extérieur.",
      d: "Oui : on relie ici les fibres à leur tissu et à leur position, sans confondre fibre et tige entière.",
    },
  },
  "botany-anatomy-q03": {
    correctOptionId: "a", explanation: "Les deux filaments visibles sont des branches stigmatiques réceptrices du pollen. Ils appartiennent à l’appareil pistillé ; chacun n’est pas un pistil entier.",
    optionExplanations: {
      a: "Oui : le mot nomme la partie réceptrice observée sans la confondre avec tout l’ensemble femelle.",
      b: "Un pistil ne contient pas une fleur complète. Les stigmates sont des parties du système pistillé de la fleur.",
      c: "Les stipules se trouvent près de la base du pétiole. Leur ressemblance avec des pointes ne leur donne pas la fonction d’un stigmate.",
      d: "Les anthères produisent le pollen ; les parties décrites ici le reçoivent et appartiennent à une fleur pistillée.",
    },
  },
  "botany-anatomy-q04": {
    correctOptionId: "c", explanation: "Le chènevis entier est couramment décrit comme un akène : un fruit sec contenant une graine. La paroi issue de l’ovaire et les structures de la graine doivent être distinguées.",
    optionExplanations: {
      a: "Le chènevis entier comprend des tissus du fruit ; le qualifier de graine nue efface cet emboîtement.",
      b: "Les deux cotylédons appartiennent à un seul embryon. Leur nombre ne signifie pas deux graines.",
      c: "Oui : cette description sépare le fruit externe de la graine qu’il contient.",
      d: "Un grain de pollen participe à la reproduction, mais il ne devient pas directement le chènevis.",
    },
  },
  "botany-life-cycle-q01": {
    correctOptionId: "d", explanation: "Les cotylédons appartiennent à l’embryon de la graine. Chez le chanvre ils sont deux, et ils précèdent les feuilles dont la forme évolue avec le développement.",
    optionExplanations: {
      a: "Les branches stigmatiques sont des parties d’une fleur pistillée, pas les premières pièces foliaires de l’embryon.",
      b: "Deux cotylédons ne sont pas deux graines ; ils appartiennent au même embryon.",
      c: "Les enveloppes d’une fleur apparaissent dans l’organisation reproductrice, à un autre stade et à un autre emplacement.",
      d: "Oui : leur origine embryonnaire explique pourquoi leur aspect diffère des grandes feuilles de l’adulte.",
    },
  },
  "botany-life-cycle-q02": {
    correctOptionId: "b", explanation: "La morphologie foliaire peut varier au cours du développement et selon la position sur la plante. Une comparaison doit conserver ces informations avant de conclure à une différence entre individus ou variétés.",
    optionExplanations: {
      a: "Les deux feuilles appartiennent au même individu dans le cas décrit. Une différence de forme ne crée pas deux espèces.",
      b: "Oui : les observations morphologiques montrent que le nombre de folioles n’est pas fixe sur toute la vie de la plante.",
      c: "Le nombre de folioles est un caractère morphologique, pas un dosage chimique de THC.",
      d: "La fécondation concerne l’union de gamètes dans l’ovule ; le nombre de folioles ne prouve pas sa réussite.",
    },
  },
  "botany-life-cycle-q03": {
    correctOptionId: "c", explanation: "L’arrivée du pollen sur le stigmate décrit la pollinisation. La fécondation et le développement d’une graine viable sont d’autres étapes, qui ne sont pas démontrées par ce transfert seul.",
    optionExplanations: {
      a: "La fécondation est l’union de gamètes dans l’ovule ; la présence de pollen sur le stigmate ne la montre pas directement.",
      b: "La dispersion concerne ici le déplacement d’un fruit ou d’une graine déjà formés. Le pollen n’est pas un fruit.",
      c: "Oui : le pollen passe à la partie réceptrice de la fleur, ce qui définit la pollinisation.",
      d: "La germination d’une semence est la reprise du développement de l’embryon, pas l’arrivée de pollen.",
    },
  },
  "botany-life-cycle-q04": {
    correctOptionId: "a", explanation: "La photopériode participe au développement floral, avec des réponses différentes selon les formes. Il faut aussi préciser si l’on observe une fleur solitaire ou une inflorescence développée.",
    optionExplanations: {
      a: "Oui : la réponse dépend du matériel végétal et de l’événement floral retenu pour la comparaison.",
      b: "Un même calendrier pour tous les génotypes effacerait la diversité des réponses et des conditions.",
      c: "La photopériode décrit une durée d’éclairement dans l’alternance jour–nuit, pas une quantité de pollen.",
      d: "L’apparition d’une fleur ne garantit ni pollinisation, ni fécondation, ni viabilité d’une future graine.",
    },
  },
  "botany-sexual-expression-q01": {
    correctOptionId: "c", explanation: "La monoécie désigne la présence de fleurs staminales et pistillées distinctes sur un même individu. Dans la dioécie, ces types floraux sont portés par des individus différents.",
    optionExplanations: {
      a: "Deux types de fleurs ne suffisent pas à définir la dioécie : il faut leur séparation entre individus.",
      b: "Une fleur bisexuée réunit les deux ensembles dans une même fleur ; ce n’est pas le cas décrit.",
      c: "Oui : le point décisif est la coexistence des deux types de fleurs sur la même plante.",
      d: "Des fleurs différentes peuvent participer à la reproduction sexuée ; leur différence ne la rend pas asexuée.",
    },
  },
  "botany-sexual-expression-q02": {
    correctOptionId: "a", explanation: "Une fleur bisexuée réunit dans une même unité florale les organes reproducteurs mâles et femelles. Une plante monoïque peut porter les deux fonctions dans des fleurs séparées.",
    optionExplanations: {
      a: "Oui : la distinction repose sur l’échelle de la fleur, pas seulement sur celle de la plante entière.",
      b: "Deux plantes de tailles différentes ne permettent pas de savoir quels organes porte une fleur.",
      c: "Le nombre de folioles décrit une feuille ; il ne démontre pas la réunion d’organes reproducteurs dans une fleur.",
      d: "La définition exige au contraire la présence des deux ensembles d’organes reproducteurs.",
    },
  },
  "botany-sexual-expression-q03": {
    correctOptionId: "d", explanation: "La photographie documente des caractères morphologiques dans son cadrage. Elle ne mesure pas les chromosomes et ne permet pas de remplacer une analyse génétique par une simple apparence.",
    optionExplanations: {
      a: "La présence d’organes clairement discernables est précisément une information accessible à une image nette.",
      b: "Une position apparente peut être décrite si les étamines sont visibles ; cela reste une observation morphologique.",
      c: "Une photo renseigne l’aspect au moment du cliché, à condition de conserver son contexte et ses limites.",
      d: "Oui : aucune mesure chromosomique n’est fournie par la seule observation extérieure d’une fleur.",
    },
  },
  "botany-sexual-expression-q04": {
    correctOptionId: "b", explanation: "Une différence d’expression peut orienter vers un gène candidat. Elle ne démontre pas à elle seule que ce gène cause le développement du type floral, ni qu’il agit seul.",
    optionExplanations: {
      a: "Une association d’expression peut être une conséquence ou un élément du développement, sans en être la cause unique.",
      b: "Oui : la formulation conserve l’observation et annonce le test causal encore nécessaire.",
      c: "L’activité différente d’un gène ne signifie pas que les chromosomes de l’individu ont tous été remplacés.",
      d: "Les observations de développement restent nécessaires pour comprendre à quel stade et dans quels organes le gène intervient.",
    },
  },
  "botany-observation-q01": {
    correctOptionId: "a", explanation: "Les structures nécessaires à l’identification florale ne sont pas discernables. Deux pointes peuvent notamment être des pièces foliaires ; il faut une meilleure vue des organes et de leurs attaches.",
    optionExplanations: {
      a: "Oui : la conclusion décrit exactement la limite du cliché, sans attribuer un sexe à partir d’une forme ambiguë.",
      b: "Le nombre de pointes ne suffit pas : des stipules peuvent être présentes près du pétiole.",
      c: "Une feuille ne montre pas la présence de fleurs staminales et pistillées distinctes sur le même individu.",
      d: "Sans étamines ou autres structures florales identifiables, la certitude proposée dépasse les données.",
    },
  },
  "botany-observation-q02": {
    correctOptionId: "c", explanation: "La position et le stade des feuilles conditionnent leur comparabilité. Il faut les documenter, avec une méthode adaptée, avant d’interpréter une différence de forme.",
    optionExplanations: {
      a: "Comparer des feuilles à des positions et stades différents sans le noter mélange des sources de variation.",
      b: "Choisir les feuilles qui ressemblent au résultat attendu introduit un biais de sélection dans la comparaison.",
      c: "Oui : les caractères deviennent interprétables quand le contexte d’observation est comparable et conservé.",
      d: "Redimensionner les photos sans leur échelle peut masquer les différences réelles de taille et ne documente pas les stades.",
    },
  },
  "botany-observation-q03": {
    correctOptionId: "b", explanation: "L’image peut montrer des structures glandulaires dans sa zone nette. Leur composition et leur concentration demandent une analyse distincte ; les effets humains demanderaient encore d’autres preuves.",
    optionExplanations: {
      a: "Une concentration précise nécessite une mesure chimique du prélèvement, pas seulement une image de surface.",
      b: "Oui : c’est une conclusion morphologique limitée à la zone effectivement observée.",
      c: "Une structure visible ne démontre pas une efficacité clinique, encore moins pour toutes les préparations.",
      d: "Un pedigree exige une documentation de parenté ; la seule apparence des trichomes ne la fournit pas.",
    },
  },
  "botany-observation-q04": {
    correctOptionId: "d", explanation: "Une valeur non mesurée doit rester signalée comme inconnue. Ni zéro, ni une valeur d’un autre lot, ni la couleur d’un dessin ne remplace l’analyse manquante.",
    optionExplanations: {
      a: "Zéro est une valeur mesurée ou démontrée dans un cadre précis ; ce n’est pas le sens d’une donnée absente.",
      b: "Un nom proche ne rend pas les lots identiques et ne transporte pas automatiquement le résultat d’analyse.",
      c: "La couleur d’une illustration ne constitue pas une méthode quantitative de composition chimique.",
      d: "Oui : cette notation conserve l’incertitude et indique quelle preuve serait nécessaire pour la réduire.",
    },
  },
};
