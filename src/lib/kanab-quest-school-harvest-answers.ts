import "server-only";
import type { HistoryAnswer } from "./kanab-quest-school-history-types";

function answer(chapter: string, n: number, correctOptionId: string, explanation: string, optionExplanations: Readonly<Record<"a" | "b" | "c" | "d", string>>): readonly [string, HistoryAnswer] {
  return ["harvest-" + chapter + "-q" + String(n).padStart(2, "0"), { correctOptionId, explanation, optionExplanations }];
}

// Références privées : transmises par le serveur uniquement après finalisation du quiz.
export const HARVEST_ANSWERS: Readonly<Record<string, HistoryAnswer>> = Object.fromEntries([
  answer("outcomes", 1, "b", "Un rendement brut humide égal n’impose pas les mêmes quantités sèches ou commercialisables. Le classement doit nommer le critère ; il ne démontre pas à lui seul la cause des écarts.", {
    a: "L’égalité d’un indicateur n’établit pas l’égalité de tous les autres.",
    b: "Le critère choisi et sa base déterminent ce que le classement signifie.",
    c: "Les données sont descriptives et ne séparent pas les causes possibles.",
    d: "La surface, l’eau, les fractions retenues et les ressources peuvent changer cette conclusion.",
  }),
  answer("outcomes", 2, "c", "C atteint 1 080 kg MS commercialisables/ha dans le dossier fictif, devant A et B. Cette supériorité descriptive ne prouve ni sa cause ni une supériorité globale.", {
    a: "Le brut total n’est pas le critère demandé et dépend aussi de la surface.",
    b: "Les valeurs commercialisables sèches fournies sont différentes.",
    c: "La conclusion conserve exactement le critère et sa limite causale.",
    d: "Les autres coûts et impacts ne se déduisent pas de cette seule quantité.",
  }),
  answer("outcomes", 3, "a", "Le bilan fictif donne 1 260 − 63 − 189 = 1 008 kg MS commercialisables. Le rapport 1 008/1 260 vaut 80 % ; les trois sorties sont disjointes.", {
    a: "Le calcul et son dénominateur sont corrects pour le bilan annoncé.",
    b: "80 % est une part de masse, pas un rendement surfacique en kg/ha.",
    c: "Un motif contractuel ne suffit pas à démontrer un danger alimentaire.",
    d: "Le même flux ne doit pas être compté deux fois dans un bilan fermé.",
  }),
  answer("outcomes", 4, "d", "La fiche réelle Carmagnola situe une histoire de semences, fibres et cordages. Elle ne mesure pas les propriétés ni la performance du lot actuel.", {
    a: "Le rendement dépend d’un contexte et de mesures absentes de la fiche historique.",
    b: "La fraction commercialisable dépend aussi du lot et du débouché.",
    c: "Une histoire d’usages ne remplace ni les analyses ni le contrat.",
    d: "Cette portée historique respecte le contenu réel de la fiche sans inventer une garantie.",
  }),
  answer("units", 1, "b", "Dans l’exemple fictif, 30 % de 1 800 kg représentent 540 kg d’eau. Il reste 1 260 kg de matière sèche. Ce calcul ne prescrit aucune cible de conservation.", {
    a: "Le brut humide contient de l’eau ; il n’est pas entièrement sec.",
    b: "La fraction sèche vaut 70 % du brut, soit 1 260 kg.",
    c: "Un pourcentage doit être appliqué à sa base ; 30 % n’est pas 30 kg.",
    d: "540 kg est ici la masse d’eau, pas celle de matière sèche.",
  }),
  answer("units", 2, "c", "Sur base humide, l’humidité est la masse d’eau divisée par la masse humide totale. Une autre convention doit être nommée explicitement.", {
    a: "Ce rapport utiliserait la masse sèche comme dénominateur : ce n’est pas la convention demandée.",
    b: "Le comptage de graines ne définit pas une fraction massique d’eau.",
    c: "Le dénominateur est bien la masse humide totale.",
    d: "Une définition de mesure ne constitue pas un objectif universel de stockage.",
  }),
  answer("units", 3, "a", "816/960 = 85 % décrit une part de matière sèche entrante ; 816/0,8 = 1 020 kg MS/ha décrit un rendement commercialisable surfacique.", {
    a: "Les deux calculs conservent leurs dénominateurs et leurs unités.",
    b: "Les unités ont été interverties entre une part et un rendement.",
    c: "Ces nombres ne correspondent pas aux rapports définis dans le dossier.",
    d: "Un rapport de masses et un rapport masse/surface ne sont pas la même grandeur.",
  }),
  answer("units", 4, "d", "Une intensité plus faible ne garantit pas un total plus faible si la quantité de produit change. Elle ne couvre pas non plus les autres ressources ou étapes du cycle.", {
    a: "C’est une description limitée du rapport effectivement observé.",
    b: "Le dénominateur est nécessaire pour comprendre l’indicateur.",
    c: "Les frontières et quantités sont justement à vérifier.",
    d: "Cette conclusion globale dépasse la seule baisse d’un rapport partiel.",
  }),
  answer("limits", 1, "b", "Une colonisation documente une présence ou une association biologique. Le bénéfice final annoncé demande un critère mesuré, un contexte et un comparateur adaptés.", {
    a: "La présence ne démontre pas un gain universel de produit commercialisable.",
    b: "Le résultat doit être mesuré au niveau où la promesse est formulée.",
    c: "Une observation biologique ne fournit pas une autorisation d’emploi.",
    d: "D’autres contraintes peuvent rester présentes malgré la colonisation.",
  }),
  answer("limits", 2, "c", "Le modèle, le critère et les conditions de l’étude doivent être conservés. Une croissance mesurée chez le maïs ne constitue pas un rendement garanti de graines de chanvre commercialisables.", {
    a: "Conserver le modèle et le critère est précisément une bonne pratique.",
    b: "Les résultats de tous les sens renseignent la variabilité de la réponse.",
    c: "C’est l’extrapolation indue : elle change à la fois plante, critère et portée.",
    d: "Examiner la comparabilité du contexte est nécessaire avant tout transfert.",
  }),
  answer("limits", 3, "a", "La prochaine mesure se choisit pour l’incertitude qu’elle peut réduire. Vérifier les motifs ou les bases de pesée peut faire évoluer le diagnostic documentaire et la décision.", {
    a: "La démarche relie explicitement la lacune à l’utilité de sa vérification.",
    b: "Une action prédéfinie ne répond pas forcément à la difficulté réelle.",
    c: "Absence de donnée et valeur zéro sont distinctes.",
    d: "Accumuler des nombres non pertinents ne départage pas les hypothèses.",
  }),
  answer("limits", 4, "d", "Plusieurs vérifications peuvent être recevables si chacune vise une inconnue pertinente. Il faut expliquer ce qu’elle permettrait d’apprendre et comment cela orienterait la décision.", {
    a: "La pertinence dépend de la question, pas d’une option toujours correcte.",
    b: "Le coût ne garantit pas l’utilité de l’information.",
    c: "La mesure est proposée pour examiner une hypothèse, pas pour prétendre la prouver avant son résultat.",
    d: "Cette justification rend le choix informatif et contrôlable.",
  }),
  answer("records", 1, "b", "Une correction traçable conserve la pièce initiale et indique ce qui change, pourquoi et quand. Elle évite de laisser l’erreur active tout en préservant l’historique.", {
    a: "L’effacement silencieux empêche de vérifier la correction.",
    b: "La correction et sa justification restent reliées au document original.",
    c: "Conserver l’historique n’impose pas de maintenir une erreur non signalée.",
    d: "Modifier les autres valeurs pour embellir le tableau inventerait des données.",
  }),
  answer("records", 2, "c", "La mesure doit être reliée à son objet, sa date, son unité, sa base et sa méthode. Ces informations permettent de retrouver les pièces et d’examiner la comparabilité.", {
    a: "Un résultat et un nom commercial ne décrivent pas suffisamment l’échantillon ni la méthode.",
    b: "Une photographie et une conclusion causale omettent les informations de mesure nécessaires.",
    c: "Ces repères rendent la ligne interprétable et vérifiable.",
    d: "Sélectionner seulement les confirmations biaiserait le journal.",
  }),
  answer("records", 3, "a", "L’absence de relevé pour B reste une inconnue. On ne peut pas en déduire une consommation nulle ni présenter une estimation comme une mesure réelle.", {
    a: "Le statut manquant est conservé et le classement reste limité.",
    b: "Une case vide ne mesure pas zéro.",
    c: "Une imputation éventuelle serait une estimation, pas le relevé réel de B.",
    d: "Choisir une valeur favorable inventerait un avantage.",
  }),
  answer("records", 4, "d", "Une valeur atypique peut correspondre à une erreur, un incident ou une variation réelle. Son examen et son traitement doivent être documentés, sans suppression opportuniste.", {
    a: "Le désaccord avec une promesse n’est pas un motif scientifique suffisant d’exclusion.",
    b: "Remplacer par le meilleur résultat falsifierait la série.",
    c: "Une valeur éloignée n’est pas nécessairement erronée.",
    d: "La vérification et les règles explicites préservent la fiabilité de l’analyse.",
  }),
  answer("handling", 1, "b", "Une baisse de masse peut venir d’eau, de pertes physiques sèches ou de fractions séparées. Le bilan doit distinguer ces catégories sur des bases compatibles.", {
    a: "L’eau n’est pas de la matière sèche.",
    b: "Cette distinction permet d’interpréter correctement la baisse observée.",
    c: "Le nom de variété ne fixe pas la cause d’une variation de masse.",
    d: "Des pertes physiques sont possibles ; il faut les identifier au lieu de les nier.",
  }),
  answer("handling", 2, "c", "Le tri est une opération de séparation, pas une preuve complète de sécurité. Les critères pertinents doivent être examinés selon le risque et l’usage concernés.", {
    a: "L’aptitude alimentaire ne se déduit pas automatiquement d’un tri.",
    b: "Aucun résultat fourni ne démontre la disparition de tous les contaminants.",
    c: "La réponse conserve la distinction entre opération et preuve de sécurité.",
    d: "Le tri ne révèle pas nécessairement la cause de l’état initial.",
  }),
  answer("handling", 3, "a", "L’échantillonnage, la matrice, la méthode et la base peuvent modifier le résultat. Il faut clarifier ces différences avant d’attribuer l’écart à une évolution réelle de qualité.", {
    a: "La réponse vérifie la comparabilité avant l’interprétation.",
    b: "Un nombre plus grand peut refléter une autre expression plutôt qu’une amélioration.",
    c: "Le nom du laboratoire ne remplace pas la description du prélèvement.",
    d: "Une teneur ne donne pas seule la masse totale de l’analyte dans un lot représentatif.",
  }),
  answer("handling", 4, "d", "Inférieur à la limite de quantification décrit une limite de mesure pour l’analyte et la méthode considérés. Cela ne prouve ni zéro absolu ni le résultat d’autres analytes.", {
    a: "La méthode ne permet pas une affirmation d’absence à toute échelle.",
    b: "La ligne ne porte pas automatiquement sur les autres substances.",
    c: "Inférieur à une limite ne signifie pas égal à cette limite.",
    d: "La réponse conserve le sens métrologique sans inventer une absence.",
  }),
  answer("trials", 1, "b", "Le contraste porte sur plusieurs conditions qui changent ensemble. Le rôle de chaque composant ne peut pas être isolé depuis cette seule comparaison.", {
    a: "Le fournisseur est confondu avec les autres changements.",
    b: "Cette conclusion reste au niveau que le dispositif permet de décrire.",
    c: "Des pesées supplémentaires ne séparent pas les changements simultanés.",
    d: "Un contraste local confondu ne garantit pas un effet universel.",
  }),
  answer("trials", 2, "c", "Une comparaison de systèmes complets peut répondre à une question sur ces systèmes. Elle ne démontre pas automatiquement l’effet isolé de chaque composant.", {
    a: "L’utilité dépend de la question ; un contraste global peut être pertinent.",
    b: "Le contraste global ne sépare pas nécessairement ses composants.",
    c: "Question, dispositif et conclusion sont ici alignés.",
    d: "Les mesures et critères doivent rester définis pour interpréter le résultat.",
  }),
  answer("trials", 3, "a", "Les prélèvements dans une même unité décrivent cette unité. Ils ne créent pas automatiquement de nouvelles attributions indépendantes de l’intervention.", {
    a: "La réponse distingue sous-échantillonnage et répétition du contraste.",
    b: "Le nombre de prélèvements ne définit pas le nombre d’unités expérimentales.",
    c: "Le sous-échantillonnage ne remplace pas une attribution appropriée des conditions.",
    d: "Ces points restent dans la même unité ; ils ne constituent pas des comparateurs externes.",
  }),
  answer("trials", 4, "d", "Le plan doit relier la question, le comparateur, l’attribution des conditions, les unités indépendantes et les mesures prévues. La variabilité et la précision recherchée comptent.", {
    a: "Choisir après coup le meilleur critère favorise une présentation sélective.",
    b: "Réserver les meilleures unités à la nouveauté introduit un biais de sélection.",
    c: "Aucun nombre fixe ne garantit la pertinence dans toute situation.",
    d: "Cette préparation rend les données adaptées au contraste annoncé.",
  }),
  answer("before-after", 1, "b", "La succession décrit une évolution, mais plusieurs facteurs changent. L’effet isolé de la nouveauté ne peut pas être établi depuis cette seule comparaison.", {
    a: "La saison et la parcelle sont d’autres explications possibles.",
    b: "L’information descriptive est conservée sans surinterprétation causale.",
    c: "L’ordre temporel ne supprime pas les autres différences.",
    d: "Des données observationnelles restent utiles si leurs limites sont explicites.",
  }),
  answer("before-after", 2, "c", "Pour attribuer un effet, il faut examiner une comparaison pertinente de ce qui se serait produit sans la nouveauté. Un simple avant/après ne la fournit pas directement.", {
    a: "Un nom commercial ne fournit pas le comparateur causal manquant.",
    b: "Représenter les mêmes valeurs autrement n’ajoute pas une condition de comparaison.",
    c: "Cette question décrit précisément le contraste contrefactuel recherché.",
    d: "Effacer des changements de méthode masquerait une limite au lieu de la résoudre.",
  }),
  answer("before-after", 3, "a", "La moyenne doit être lue avec l’effectif, la dispersion, la précision et la pertinence pratique. Elle ne décrit pas nécessairement chaque unité ni un autre contexte.", {
    a: "Ces informations permettent d’évaluer ce que l’estimation soutient réellement.",
    b: "Des valeurs variables peuvent avoir la même moyenne sans lui être égales.",
    c: "Le maximum ne représente pas l’ensemble de la série.",
    d: "Le transfert entre régions demande des raisons et parfois de nouvelles comparaisons.",
  }),
  answer("before-after", 4, "d", "Une différence non concluante peut refléter un effet faible, une variabilité élevée ou une précision insuffisante. Elle ne démontre pas nécessairement un effet exactement nul partout.", {
    a: "Conserver l’incertitude est approprié lorsque le résultat ne tranche pas.",
    b: "La variabilité et la précision aident à comprendre cette limite.",
    c: "Critère et contexte restent nécessaires à toute interprétation.",
    d: "Cette certitude universelle dépasserait les données du petit essai.",
  }),
  answer("tradeoffs", 1, "b", "Le tableau permet des comparaisons dans son périmètre de dépenses. Sans recettes et sans coûts complets, il ne donne pas la marge ni la rentabilité complète.", {
    a: "Les postes exclus et les recettes manquantes empêchent ce calcul.",
    b: "La conclusion est limitée à l’information effectivement fournie.",
    c: "Aucun revenu réel d’exploitation n’est documenté.",
    d: "Des euros dépensés ne constituent pas une analyse complète des impacts environnementaux.",
  }),
  answer("tradeoffs", 2, "c", "Le budget partiel examine les coûts et revenus qui changent avec une décision. Il faut conserver son périmètre et la qualité des hypothèses utilisées.", {
    a: "Les hypothèses doivent être explicites et réalistes, pas choisies seulement pour favoriser l’option.",
    b: "Un budget partiel n’inclut pas nécessairement tous les coûts de l’activité.",
    c: "C’est l’objet de la comparaison partielle décrite dans la source méthodologique.",
    d: "Un outil de décision ne garantit pas un prix futur.",
  }),
  answer("tradeoffs", 3, "a", "Des critères opposés demandent des priorités explicites. Un choix conditionnel peut être défendable sans prétendre qu’une option domine tous les critères.", {
    a: "Le choix conserve les contraintes, le critère privilégié et le compromis.",
    b: "Le dossier indique précisément un avantage de C sur un autre critère.",
    c: "Le coût de C ne peut pas être déduit de son seul produit commercialisable.",
    d: "Ces unités ne s’additionnent pas directement pour créer un classement universel.",
  }),
  answer("tradeoffs", 4, "d", "La dominance concerne des critères définis et comparables : au moins aussi bien partout, et mieux sur au moins un. Les critères absents ou inconnus limitent ce jugement.", {
    a: "Gagner sur un critère et perdre sur un autre décrit plutôt un compromis.",
    b: "Une inconnue ne peut pas être supposée favorable pour démontrer la dominance.",
    c: "La notoriété du nom ne mesure pas les critères retenus.",
    d: "Cette définition conserve la comparaison sur tous les critères retenus.",
  }),
  answer("tips", 1, "b", "Une promesse doit être confrontée à l’ensemble des résultats et à leur contexte. Un maximum d’une autre culture ne constitue pas une garantie pour le produit visé.", {
    a: "Une photographie favorable ne décrit pas le dispositif ni sa variabilité.",
    b: "Ces informations permettent d’examiner la solidité et les limites du transfert.",
    c: "Supprimer les résultats négatifs déformerait la portée des preuves.",
    d: "Un changement d’appellation ne transforme pas les résultats en garantie universelle.",
  }),
  answer("tips", 2, "c", "Biomasse et graines commercialisables sont des critères différents. Une relation possible entre eux ne remplace pas la mesure du résultat effectivement promis.", {
    a: "La biomasse peut comprendre des fractions qui ne sont pas les graines retenues au contrat.",
    b: "Un mécanisme plausible ne suffit pas à mesurer le résultat final.",
    c: "Le niveau de mesure doit correspondre au niveau de la promesse.",
    d: "Des relations peuvent exister, mais elles doivent être documentées dans le contexte concerné.",
  }),
  answer("tips", 3, "a", "Odeur et condensation sont des indices à examiner. Une condensation sur une paroi ne prouve pas une moisissure dans les graines, encore moins son identité ou une carence précise.", {
    a: "Cette lecture conserve les indices et laisse ouvertes les vérifications nécessaires.",
    b: "Aucune identification d’espèce n’est fournie par ces seuls indices.",
    c: "L’odeur ne démontre pas une carence nutritive précise.",
    d: "Le nom de variété ne garantit pas la sécurité du lot actuel.",
  }),
  answer("tips", 4, "d", "L’enquête doit relier les hypothèses aux pièces, choisir une réponse proportionnée et prévoir un suivi comparable. Les conclusions restent révisables avec de nouvelles preuves.", {
    a: "Une recette choisie avant l’enquête peut ne pas répondre au problème réel.",
    b: "Fleurs et graines sont des matrices et objets distincts ; leur profil ne se transfère pas automatiquement.",
    c: "Une conclusion doit pouvoir changer lorsque les données la contredisent.",
    d: "La démarche relie connaissances, preuve, action prudente et mesure de la suite.",
  }),
]);
