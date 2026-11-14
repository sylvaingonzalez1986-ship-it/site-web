import "server-only";
import type { HistoryAnswer } from "./kanab-quest-school-history-types";

// Les QCM de synthèse publics ne contiennent ni cette clé ni ces corrigés.
// Chaque justification correspond à l'identifiant stable de l'option, jamais à sa position affichée.
export const HISTORY_EARLY_ANSWERS: Readonly<Record<string, HistoryAnswer>> = {
  "history-evidence-q01": {
    correctOptionId: "b", explanation: "Identifier une graine établit la présence de ce végétal dans le contexte étudié. Son origine et son usage demandent des indices supplémentaires.",
    optionExplanations: { a: "La présence d'une graine ne démontre pas une consommation psychoactive.", b: "C'est la conclusion directement liée à l'identification de la trace.", c: "La graine peut avoir été transportée ; découverte locale ne signifie pas culture locale.", d: "Une graine n'établit pas à elle seule un travail des fibres." },
  },
  "history-evidence-q02": {
    correctOptionId: "d", explanation: "Proposer la participation à un rite interprète la fonction d'un objet. Le prélèvement et l'identification matérielle appartiennent à d'autres étapes du raisonnement.",
    optionExplanations: { a: "Cette phrase rapporte une découverte matérielle, pas sa fonction.", b: "Cette phrase décrit une opération de prélèvement.", c: "Cette phrase rapporte un résultat analytique, qui comporte ses propres conditions de validité.", d: "Le verbe « proposent » attribue explicitement aux auteurs une interprétation de la fonction." },
  },
  "history-evidence-q03": {
    correctOptionId: "a", explanation: "2019 est la date de publication de l'étude citée. Le contexte de Jirzankal est situé vers 500 avant notre ère.",
    optionExplanations: { a: "L'article de Science Advances paraît le 12 juin 2019.", b: "Les tombes étudiées appartiennent à un contexte ancien, pas à 2019.", c: "Une publication sur un site ne date pas un commencement mondial.", d: "Le récit d'Hérodote appartient à l'Antiquité et constitue un autre document." },
  },
  "history-evidence-q04": {
    correctOptionId: "c", explanation: "Une matière médicale ancienne documente des savoirs et des propriétés attribuées. Une efficacité clinique actuelle exige des données adaptées à la population et au produit étudiés.",
    optionExplanations: { a: "Une attribution ancienne ne prouve pas un bénéfice dans toutes les populations.", b: "Une autorisation moderne relève d'une procédure et d'une juridiction distinctes.", c: "Cette formulation décrit exactement la valeur historique du passage.", d: "La répétition d'une mention n'est pas une mesure d'efficacité clinique." },
  },
  "history-prehistory-q01": {
    correctOptionId: "c", explanation: "Le recouvrement des dimensions empêche d'attribuer un usage unique à partir de ce seul caractère. Il faut rapprocher la mesure du contexte et d'autres indices.",
    optionExplanations: { a: "Le groupe destiné aux fibres n'est pas seul compatible avec les dimensions.", b: "La taille ne prouve ni teneur en cannabinoïdes ni usage psychoactif.", c: "Cette conclusion conserve l'incertitude réelle de la comparaison.", d: "Les graines restent informatives pour la présence, les formes et les contextes ; seule la conclusion trop précise est écartée." },
  },
  "history-prehistory-q02": {
    correctOptionId: "a", explanation: "Les conditions de conservation peuvent modifier les dimensions et compliquer la comparaison entre ensembles. L'étude de Haimenkou examine cette difficulté.",
    optionExplanations: { a: "Comparer les états de conservation aide à interpréter les mesures.", b: "L'état de conservation ne fournit pas une mesure de THC ancien.", c: "Cette invariance n'est pas garantie ; c'est précisément une limite discutée.", d: "Un nom commercial actuel ne se déduit pas de la conservation d'une graine ancienne." },
  },
  "history-prehistory-q03": {
    correctOptionId: "d", explanation: "L'étude de Ren et collaborateurs compare des génomes actuels et utilise des modèles pour proposer un scénario ancien. Sa portée dépend de l'échantillonnage et des hypothèses.",
    optionExplanations: { a: "Les chercheurs n'ont pas recueilli le témoignage direct d'un cultivateur néolithique.", b: "L'étude génomique ne constitue pas la datation directe d'un premier champ retrouvé.", c: "Elle n'établit pas le pedigree complet de chaque variété commerciale.", d: "Cette formulation identifie la méthode et le statut d'inférence du résultat." },
  },
  "history-prehistory-q04": {
    correctOptionId: "b", explanation: "Une population férale provient de plantes échappées des cultures. Vivre spontanément aujourd'hui ne suffit pas à établir une origine sauvage jamais influencée par l'humain.",
    optionExplanations: { a: "Cette proposition confond caractère spontané actuel et absence historique de domestication.", b: "C'est le sens de « férale » dans ce parcours.", c: "Le terme décrit une histoire de population, pas une méthode d'identification fossile.", d: "Le statut féral n'impose aucun objectif de sélection particulier." },
  },
  "history-eurasian-antiquity-q01": {
    correctOptionId: "a", explanation: "Au paragraphe IV, 74, Hérodote attribue aux Thraces la confection de vêtements en chanvre. Ce témoignage littéraire ne remplace pas l'identification d'un textile archéologique.",
    optionExplanations: { a: "Cet usage textile figure dans le passage étudié.", b: "Le passage suivant décrit une pratique scythe ; il ne faut pas l'attribuer aux Thraces de IV, 74.", c: "Le passage porte sur la plante et les vêtements, pas sur un classement médical.", d: "Ce paragraphe ne rapporte pas un dépôt de graines dans une tombe thrace." },
  },
  "history-eurasian-antiquity-q02": {
    correctOptionId: "c", explanation: "Le rapprochement d'un texte et d'un vestige doit comparer périodes, lieux et nature des indices. Une ressemblance ne prouve pas une identité de population ou de rite.",
    optionExplanations: { a: "Une pratique ressemblante ne suffit pas à attribuer une identité collective.", b: "Textes et fouilles peuvent être comparés ; il faut préserver leurs méthodes et leurs contextes.", c: "Cette démarche garde la comparaison ouverte sans ajouter un lien non démontré.", d: "Effacer les dates détruirait une information essentielle pour évaluer la comparaison." },
  },
  "history-eurasian-antiquity-q03": {
    correctOptionId: "b", explanation: "Le communiqué de Tunnug décrit des analyses de cheveux, tandis que le résumé de Jirzankal porte sur des résidus de braseros. Les supports imposent des questions d'interprétation distinctes.",
    optionExplanations: { a: "Cette association ne correspond pas aux supports présentés dans les deux documents.", b: "Les deux supports sont correctement associés aux sites.", c: "Les supports de Tunnug et de Jirzankal ont été inversés.", d: "Les génomes actuels sont au centre d'un autre dossier, celui de la domestication." },
  },
  "history-eurasian-antiquity-q04": {
    correctOptionId: "d", explanation: "L'étude de 2015 démontre une possibilité de transfert externe dans des situations contemporaines. Elle motive une vérification méthodologique ; elle n'analyse pas les cheveux anciens de Tunnug.",
    optionExplanations: { a: "Une possibilité générale ne prouve pas la contamination de tous les échantillons d'un site.", b: "L'étude de transfert ne fournit aucune datation des graines de Tunnug.", c: "Elle souligne au contraire pourquoi détection et consommation personnelle ne sont pas équivalentes.", d: "La formulation conserve à la fois l'intérêt de l'étude et sa limite de transposition." },
  },
  "history-asian-contexts-q01": {
    correctOptionId: "d", explanation: "L'attribution à Shennong relève d'une tradition d'autorité. La formation et la transmission du corpus sont des questions historiques étudiées à partir de témoins et de commentaires.",
    optionExplanations: { a: "Aucun manuscrit autographe daté de 2737 avant notre ère n'est établi par les sources consultées.", b: "Une copie conservée témoigne d'un état transmis ; elle ne certifie pas une date légendaire de rédaction.", c: "Les travaux textuels examinent précisément des commentaires, révisions et reconstructions.", d: "Cette réponse distingue la figure d'attribution de l'histoire documentaire réelle." },
  },
  "history-asian-contexts-q02": {
    correctOptionId: "b", explanation: "Comparer les éditions et les mots aide à identifier ce que les textes désignent et comment ils se sont transformés. Cela ne suffit pas à démontrer une efficacité médicale.",
    optionExplanations: { a: "Une indication traditionnelle ne se convertit pas automatiquement en mécanisme expérimental démontré.", b: "Cette démarche correspond au travail de comparaison textuelle et botanique.", c: "L'attribution du titre ne date pas chaque phrase transmise.", d: "Une circulation de textes ne prouve pas des pratiques identiques dans toute l'Asie." },
  },
  "history-asian-contexts-q03": {
    correctOptionId: "a", explanation: "Des témoignages régionaux doivent conserver leur localisation, leur époque et le point de vue de leurs auteurs. Leur diversité constitue une information, pas un obstacle à effacer.",
    optionExplanations: { a: "Cette comparaison permet d'examiner l'origine des différences.", b: "Le caractère favorable d'une réponse ne lui donne pas une représentativité nationale.", c: "Les sources situées ne permettent pas d'uniformiser tous les membres d'une religion.", d: "Une réponse du XIXe siècle ne prouve pas sans autre source une pratique antique identique." },
  },
  "history-asian-contexts-q04": {
    correctOptionId: "c", explanation: "Le cadre institutionnel de l'enquête influence les questions posées et les voix conservées. Le préciser aide à utiliser l'archive sans la considérer comme transparente ou inutile.",
    optionExplanations: { a: "Une source située peut contenir des informations utiles ; le cadre colonial ne rend pas chaque phrase fausse.", b: "Le cadre administratif ne garantit pas une représentation parfaite des populations.", c: "Ces facteurs font partie de la construction de l'archive.", d: "Les témoignages recueillis ne deviennent pas des essais médicaux contrôlés." },
  },
  "history-middle-east-africa-q01": {
    correctOptionId: "b", explanation: "Les analyses d'Arad documentent des résidus sur un objet dans un contexte déterminé. L'usage cultuel est l'interprétation proposée ; les autres lieux demandent leurs propres preuves.",
    optionExplanations: { a: "Un autel local ne démontre pas une pratique universelle dans le Levant.", b: "Cette formulation associe le résultat matériel et l'interprétation sans les confondre.", c: "Les résidus ne retracent pas les échanges jusqu'à l'Égypte médiévale.", d: "Une analyse d'objet ne reconstitue pas l'expérience subjective de chaque participant." },
  },
  "history-middle-east-africa-q02": {
    correctOptionId: "d", explanation: "La page mêle le texte médiéval traduit et des commentaires de Leclerc. Chaque couche doit être attribuée à son auteur et à son époque.",
    optionExplanations: { a: "Les commentaires appartiennent à un traducteur d'une époque ultérieure ; tout n'est pas une observation personnelle d'Ibn al-Bayṭār.", b: "Traduire et commenter ne constituent pas une validation clinique des effets décrits.", c: "La page consultée est une traduction annotée ; elle ne présente pas une copie autographe de l'auteur médiéval.", d: "C'est la précaution nécessaire pour ne pas attribuer au Moyen Âge un commentaire du XIXe siècle." },
  },
  "history-middle-east-africa-q03": {
    correctOptionId: "c", explanation: "Le rapport de 1975 indique une datation associée au contexte contenant les pipes. Elle ne suit ni une consommation individuelle ni la totalité de la diffusion continentale.",
    optionExplanations: { a: "Un contexte éthiopien ne date pas l'arrivée sur tout le continent.", b: "La datation associée ne permet pas d'identifier et dater un acte individuel précis.", c: "La réponse préserve le lien réel avec le contexte et l'incertitude publiée.", d: "La date ne documente aucun itinéraire commercial complet." },
  },
  "history-middle-east-africa-q04": {
    correctOptionId: "a", explanation: "Les circulations sont portées par des personnes dans des rapports sociaux précis. Les travaux sur l'Afrique centrale montrent notamment l'importance des savoirs locaux et des déplacements contraints.",
    optionExplanations: { a: "Ces dimensions expliquent ce que masque une simple flèche de diffusion.", b: "Les sources discutent aussi de l'esclavage ; les échanges ne sont pas tous volontaires.", c: "Les noms commerciaux modernes n'identifient pas les populations anciennes sans preuve généalogique.", d: "Une largeur de flux doit représenter une quantité connue, jamais inventée." },
  },
};
