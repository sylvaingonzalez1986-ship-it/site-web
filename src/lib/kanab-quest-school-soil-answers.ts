import "server-only";
import type { HistoryAnswer } from "./kanab-quest-school-history-types";

function answer(chapter: string, n: number, correctOptionId: string, explanation: string, optionExplanations: Readonly<Record<"a" | "b" | "c" | "d", string>>): readonly [string, HistoryAnswer] {
  return ["soil-" + chapter + "-q" + String(n).padStart(2, "0"), { correctOptionId, explanation, optionExplanations }];
}

// Références privées : le serveur ne les révèle qu’après la finalisation du quiz.
export const SOIL_ANSWERS: Readonly<Record<string, HistoryAnswer>> = Object.fromEntries([
  answer("physical", 1, "b", "La texture décrit les proportions de particules ; la structure décrit leur organisation. Des agrégats différents sont compatibles avec une texture identique.", {
    a: "Les proportions de sable, limon et argile sont identiques dans le dossier : cela n’impose pas une texture différente.",
    b: "La distinction est correcte : les mêmes particules peuvent être organisées différemment, avec des pores et assemblages différents.",
    c: "Une texture commune ne mesure pas les réserves d’azote, qui nécessitent leurs propres informations et analyses.",
    d: "La profondeur explorée dépend aussi de la structure, des obstacles et du fonctionnement racinaire ; la texture seule ne la fixe pas.",
  }),
  answer("physical", 2, "c", "Un agrégat est un assemblage de particules. Il ne doit pas être confondu avec un grain individuel ni avec une fraction nutritive.", {
    a: "Un grain de sable est une particule individuelle ; un agrégat est un assemblage qui peut réunir plusieurs particules.",
    b: "Un agrégat n’est pas défini par une absence de pores ; des espaces peuvent exister à l’intérieur et entre les agrégats.",
    c: "L’assemblage de plusieurs particules correspond à la notion d’agrégat utilisée pour décrire la structure du sol.",
    d: "Le mot décrit une organisation physique du sol, pas une quantité d’élément immédiatement soluble ou utilisable.",
  }),
  answer("physical", 3, "a", "Une quantité d’eau présente dans le profil n’est pas nécessairement accessible en totalité. L’état de l’eau et le volume exploré par les racines comptent.", {
    a: "Cette formulation conserve la différence entre eau stockée et accès réel à une racine fonctionnelle.",
    b: "L’eau observée dans le sol n’est pas déjà entrée dans la plante ; présence et absorption sont des états différents.",
    c: "L’humidité ne garantit pas le renouvellement de l’air ; une forte occupation des pores par l’eau peut le limiter.",
    d: "La couleur ne quantifie ni toute l’eau présente ni la fraction accessible dans la profondeur réellement explorée.",
  }),
  answer("physical", 4, "d", "L’infiltration, la rétention et l’accès racinaire décrivent des mécanismes distincts. Une circulation rapide ne garantit pas un stockage accessible élevé.", {
    a: "Une entrée rapide peut notamment emprunter des passages préférentiels ; elle ne démontre pas une réserve maximale accessible.",
    b: "L’infiltration rapide n’exclut pas la rétention d’une partie de l’eau dans le profil.",
    c: "Le drainage décrit la circulation de l’eau ; il ne mesure pas directement les éléments effectivement entrés dans la plante.",
    d: "Cette distinction permet de lire les observations sans réduire tout le fonctionnement hydrique à une seule vitesse.",
  }),
  answer("rhizosphere", 1, "b", "La rhizosphère est la zone de sol influencée par l’activité racinaire. Son extension et son fonctionnement varient selon le contexte.", {
    a: "L’influence des racines varie dans l’espace et le temps ; aucune épaisseur universelle ne définit toutes les rhizosphères.",
    b: "La définition relie correctement la zone de sol à l’activité des racines, notamment absorption et exsudation.",
    c: "L’intérieur des cellules chlorophylliennes n’est pas la zone de sol influencée par les racines.",
    d: "La rhizosphère est un milieu d’interactions, pas le nom d’une préparation commerciale à acheter.",
  }),
  answer("rhizosphere", 2, "c", "L’eau et l’air partagent l’espace poreux. Un renouvellement de l’air limité peut perturber des racines qui ont besoin d’oxygène pour leur fonctionnement aérobie.", {
    a: "L’affirmation est absolue : présence d’eau ne signifie pas toujours absence de respiration ; l’organisation et les échanges comptent.",
    b: "Les cellules racinaires respirent et utilisent de l’oxygène dans leur fonctionnement aérobie.",
    c: "La limitation possible des échanges gazeux explique pourquoi humide ne signifie pas nécessairement favorable aux racines.",
    d: "L’humidité ne transforme pas automatiquement tous les nutriments en toxines ; aucun tel mécanisme universel n’est établi.",
  }),
  answer("rhizosphere", 3, "a", "Le pâlissement peut correspondre à plusieurs mécanismes. Sans contexte suffisant, le diagnostic doit rester non confirmé et guider les prochaines observations.", {
    a: "La réponse conserve les hypothèses compatibles et n’invente pas une cause à partir d’une apparence commune.",
    b: "Une couleur seule ne distingue pas manque d’élément, difficulté d’accès, trouble racinaire ou autre problème.",
    c: "Le même symptôme ne confirme pas davantage une infection précise ; celle-ci demande des éléments adaptés.",
    d: "Un apport sans diagnostic peut laisser la cause intacte et créer un excès ; la photographie ne justifie pas un programme universel.",
  }),
  answer("rhizosphere", 4, "d", "Présence dans le sol et absorption sont différentes. Une racine altérée peut mal fonctionner même lorsqu’un élément existe dans le milieu.", {
    a: "Un résultat de présence peut effectivement être obtenu pour une forme définie ; il faut en conserver la méthode et la portée.",
    b: "Un élément peut participer à plusieurs processus ; cette possibilité ne constitue pas la garantie d’absorption demandée.",
    c: "Une analyse peut étudier sa présence ; cela ne signifie pas qu’elle mesure simultanément son entrée dans la plante.",
    d: "C’est la garantie absente : forme accessible, milieu et fonctionnement racinaire conditionnent le transfert effectif.",
  }),
  answer("life", 1, "b", "Les nématodes comprennent plusieurs régimes alimentaires. Une observation sans identification suffisante ne permet pas de fixer leur rôle.", {
    a: "Le groupe comprend aussi d’autres régimes ; le classer entièrement comme ravageur efface cette diversité.",
    b: "Cette formulation garde l’incertitude utile et demande les informations permettant d’attribuer une fonction.",
    c: "L’appartenance à la vie du sol ne constitue pas une mesure de bénéfice ni une garantie de rendement.",
    d: "La présence d’un nématode ne démontre pas l’absence de tous les agents pathogènes dans le milieu.",
  }),
  answer("life", 2, "c", "Un indicateur de diversité décrit un aspect de la communauté. Il ne remplace pas la mesure de ses activités, de ses fonctions ou d’un résultat agricole.", {
    a: "Les fonctions ne sont pas toutes directement mesurées par un dénombrement ou un indicateur de diversité.",
    b: "Une communauté diverse peut comprendre des rôles différents ; elle n’est pas automatiquement bénéfique à toute plante.",
    c: "Cette réponse conserve la portée de l’indicateur au lieu de le transformer en garantie générale.",
    d: "Une décision d’intervention doit répondre à un objectif et à un dossier, pas être déclenchée automatiquement par un seul indicateur.",
  }),
  answer("life", 3, "a", "L’étude de Lutz rapporte des réponses variables dans des champs de maïs. Elle soutient une évaluation contextuelle, pas une promesse uniforme sur chanvre.", {
    a: "La variation entre sites montre pourquoi contexte, comparateurs et critères doivent rester attachés au résultat.",
    b: "Le corpus porte sur maïs et ne démontre aucun résultat identique garanti pour tous les chanvres.",
    c: "Des résultats variables ne prouvent pas une inutilité universelle ; les cas favorables et défavorables doivent être conservés.",
    d: "La détection ou colonisation constitue un résultat différent d’un gain mesuré de croissance ou de récolte.",
  }),
  answer("life", 4, "d", "Une détection documente une présence. Le bénéfice exige un résultat pertinent et une comparaison ; l’autorisation constitue encore une autre question.", {
    a: "Le bénéfice ne se déduit pas de l’implantation seule : aucun résultat comparatif de croissance n’est fourni.",
    b: "L’absence de résultat comparatif ne démontre pas une absence d’effet dans tous les contextes.",
    c: "Une détection biologique ne remplace pas la vérification du statut réglementaire et des conditions du produit exact.",
    d: "La phrase correspond précisément à la preuve disponible sans conclure au-delà de celle-ci.",
  }),
  answer("organic", 1, "b", "L’immobilisation biologique incorpore des nutriments minéraux dans la biomasse. L’élément change de compartiment, il n’est pas détruit.", {
    a: "L’azote ou autre nutriment demeure dans la matière biologique ; une disponibilité modifiée n’est pas une destruction.",
    b: "Le passage d’une forme minérale vers la biomasse correspond à la définition utilisée dans ce cycle.",
    c: "L’immobilisation par les organismes du sol n’est pas une absorption obligatoire et immédiate par la plante.",
    d: "Une perte gazeuse est un autre destin ; elle ne définit pas l’incorporation dans la biomasse.",
  }),
  answer("organic", 2, "c", "La minéralisation concerne la libération de formes minérales à partir de matières organiques ; la nitrification transforme des formes ammoniacales en formes oxydées.", {
    a: "Les deux termes décrivent des transformations distinctes et ne doivent pas être utilisés comme synonymes.",
    b: "Une forme libérée peut ensuite être retenue, immobilisée, déplacée ou perdue ; l’absorption n’est pas garantie.",
    c: "La distinction conserve les étapes et évite de faire passer directement tout azote organique à une absorption certaine.",
    d: "Des organismes peuvent incorporer de l’azote à leur biomasse pendant la décomposition : les processus peuvent coexister.",
  }),
  answer("organic", 3, "a", "Humus possède plusieurs usages historiques. Il faut préciser le sens et la méthode, sans supposer un stock unique indestructible.", {
    a: "La réponse reconnaît la diversité des concepts et les limites d’une lecture universelle du terme.",
    b: "Le mot ne désigne pas une molécule unique indestructible ; les matières organiques et leurs interactions sont diverses.",
    c: "L’eau retenue est une autre composante du sol ; elle ne définit pas les matières organiques transformées.",
    d: "Un terme décrivant des constituants ou horizons n’est pas une mesure de tous les transferts nutritifs dans la plante.",
  }),
  answer("organic", 4, "d", "Une même teneur en carbone peut recouvrir des formes et conditions différentes. Le fonctionnement ne se déduit pas du seul total.", {
    a: "L’égalité des teneurs ne prouve ni mêmes fractions ni mêmes vitesses de transformation.",
    b: "Le carbone mesuré n’est pas automatiquement permanent ; sa persistance dépend notamment des interactions et du contexte.",
    c: "Un nom commercial ne remplace pas l’analyse des matières, du profil et des conditions de fonctionnement.",
    d: "Les formes, interactions et conditions sont des informations pertinentes pour comprendre ce que la teneur seule ne dit pas.",
  }),
  answer("nutrients", 1, "b", "Le magnésium entre dans la chlorophylle et le phosphore participe notamment aux transferts d’énergie. Ces rôles ne constituent pas une prescription d’apport.", {
    a: "Le potassium intervient notamment dans des régulations ; l’élément central de la chlorophylle est le magnésium.",
    b: "Les deux associations sont correctes, tout en restant des exemples parmi plusieurs fonctions de ces éléments.",
    c: "Le calcium participe notamment à des structures et signaux cellulaires ; il n’est pas dépourvu de rôle.",
    d: "Le soufre entre dans certains acides aminés mais ne remplace pas les autres éléments nécessaires à la matière végétale.",
  }),
  answer("nutrients", 2, "c", "Ca, Mg et S restent essentiels. Le qualificatif secondaire les classe quantitativement sans rendre leurs fonctions facultatives.", {
    a: "La présence de NPK ne remplace pas les fonctions spécifiques des autres éléments essentiels.",
    b: "Ces éléments interviennent dans la plante vivante ; leur rôle ne commence pas seulement après la récolte.",
    c: "Cette interprétation sépare correctement quantité relative requise et nécessité biologique.",
    d: "Ils participent à des processus et structures cellulaires, notamment chlorophylle, signaux et certains acides aminés.",
  }),
  answer("nutrients", 3, "a", "Fer, manganèse, zinc, cuivre, bore, molybdène, chlore et nickel sont les oligoéléments essentiels cités. Le besoin réduit n’exclut pas un effet d’excès.", {
    a: "Cet ensemble correspond aux huit oligoéléments présentés, chacun requis en petites quantités.",
    b: "N, P, K, Ca, Mg et S sont des éléments majeurs dans la classification quantitative utilisée ici.",
    c: "C, H et O sont essentiels mais ne forment pas la liste des oligoéléments demandée.",
    d: "Sable, argile et humus sont des constituants ou catégories de matières, pas des symboles d’éléments nutritifs.",
  }),
  answer("nutrients", 4, "d", "Le total, une fraction extraite et la quantité absorbée ne désignent pas la même variable. La méthode et le contexte relient leur interprétation.", {
    a: "Ces quantités ne sont pas nécessairement égales et ne peuvent pas être interchangées sans justification.",
    b: "Une extraction est une opération de laboratoire ; elle ne reproduit pas exactement une racine dans toutes ses conditions.",
    c: "Un total élevé peut coexister avec une disponibilité ou une absorption limitée ; il n’exclut pas tout problème.",
    d: "La réponse distingue la réserve décrite, le résultat analytique et le transfert effectif dans la plante.",
  }),
  answer("measures", 1, "b", "Avant de parler d’évolution, il faut examiner les méthodes et les prélèvements. Une différence de suspension peut modifier le résultat de pH.", {
    a: "La soustraction brute confondrait une différence de méthode avec une possible évolution du sol.",
    b: "Vérifier méthodes, dates, profondeurs et zones permet de savoir à quelle comparaison les résultats peuvent répondre.",
    c: "Choisir la valeur la plus haute ne résout pas l’incompatibilité et sélectionne arbitrairement une mesure.",
    d: "Les écarts usuels entre méthodes ne constituent pas une constante de conversion valable pour tous les sols.",
  }),
  answer("measures", 2, "c", "Le pH est utile mais son interprétation demande un contexte. L’absence de cible universelle ne signifie pas absence de rôle chimique ou biologique.", {
    a: "Le pH influence de nombreuses réactions ; la réserve porte sur une cible parfaite universelle, pas sur son importance.",
    b: "Les résultats restent informatifs lorsqu’ils sont interprétés avec leur méthode et le milieu concerné.",
    c: "Cette formulation conserve l’utilité de l’indicateur tout en refusant une prescription indépendante du contexte.",
    d: "Des pH différents peuvent modifier les disponibilités et interactions ; aucune équivalence de fonctionnement n’est garantie.",
  }),
  answer("measures", 3, "a", "La capacité d’échange cationique décrit une capacité de rétention et d’échange de cations, définie par la méthode et les conditions, notamment le pH.", {
    a: "Cette définition conserve la propriété de surface et les conditions nécessaires à son interprétation.",
    b: "La conduction renvoie à l’EC et exige elle aussi une méthode ; ce n’est pas la définition de la CEC.",
    c: "La CEC ne mesure ni tous les nutriments du sol ni la masse effectivement absorbée par la plante.",
    d: "Une teneur en eau racinaire n’est pas une capacité d’échange de cations du sol.",
  }),
  answer("measures", 4, "d", "L’EC est une mesure de conductivité influencée par les ions et les conditions. Elle ne sépare pas chaque espèce ionique ni son absorption.", {
    a: "Des mélanges d’ions différents peuvent contribuer à la conductivité ; une analyse élément par élément est une autre mesure.",
    b: "Le nitrate éventuellement présent n’est pas distingué ni suivi jusqu’à son absorption par cette seule mesure.",
    c: "La préparation de l’extrait et les conditions, dont la température, restent nécessaires pour comparer les résultats.",
    d: "La formulation correspond au résultat réel sans en déduire une composition complète ou une qualité universelle.",
  }),
  answer("inputs", 1, "b", "La distinction principale porte sur la fonction : fournir des éléments nutritifs ou modifier/entretenir des propriétés du sol. Un matériau peut contribuer aux deux.", {
    a: "Le support racinaire est une autre fonction ; toute eau n’est pas pour autant un amendement au sens étudié.",
    b: "Le classement suit les objectifs principaux et laisse possible la présence de fonctions complémentaires.",
    c: "Les catégories ne se réduisent pas à l’origine chimique ou organique des matériaux.",
    d: "Un amendement peut aussi apporter des nutriments ; sa fonction principale ne signifie pas absence totale d’éléments.",
  }),
  answer("inputs", 2, "c", "Naturel décrit une origine revendiquée, pas un ensemble complet de preuves d’efficacité, d’innocuité ou d’autorisation.", {
    a: "Le statut et les conditions d’emploi du produit exact se vérifient ; une origine ne vaut pas autorisation universelle.",
    b: "Une matière naturelle peut nécessiter une caractérisation de contaminants ; leur absence ne se déduit pas du mot.",
    c: "Cette réponse refuse les garanties qui dépassent la seule catégorie d’origine annoncée.",
    d: "La synchronisation dépend des formes et du milieu ; elle n’est pas démontrée par cette mention publicitaire.",
  }),
  answer("inputs", 3, "a", "La disponibilité dépend de formes, de transformations et de conditions. Une catégorie d’origine ne décrit pas tous ces mécanismes.", {
    a: "Cette réponse relie la disponibilité aux propriétés qui la conditionnent plutôt qu’à un adjectif général.",
    b: "Certaines formes nécessitent des transformations ; l’absorption complète et immédiate n’est pas garantie.",
    c: "Des pertes ou des transferts hors du compartiment étudié restent possibles après une origine organique.",
    d: "Les matières organiques diffèrent par leurs composés, leur état et leur accessibilité aux organismes.",
  }),
  answer("inputs", 4, "d", "Un apport peut être absorbé, retenu, transformé ou perdu. Son devenir se raisonne avec les autres fournitures et le périmètre du système.", {
    a: "L’absorption n’est qu’un destin possible ; elle ne doit pas être posée égale à la totalité de l’apport.",
    b: "Le sol et l’historique continuent de fournir des ressources ; un nouvel apport ne les annule pas.",
    c: "Des transferts avec l’eau ou vers l’atmosphère peuvent sortir du périmètre considéré selon les conditions.",
    d: "Cette formulation conserve les différents destins au lieu de promettre une utilisation intégrale.",
  }),
  answer("amendments", 1, "b", "La couleur décrit un aspect. Elle ne mesure pas à elle seule la maturité, les sels solubles, la composition ou les contaminants d’un compost.", {
    a: "Des contaminants peuvent être invisibles ; leur absence exige des informations adaptées, pas une couleur.",
    b: "Cette réponse rapporte seulement ce qui est observé et laisse les autres propriétés à caractériser.",
    c: "L’aptitude dépend de plusieurs critères et d’un usage ; une couleur ne la certifie pas partout.",
    d: "Les matières initiales et les transformations varient ; une même apparence ne donne pas une composition identique.",
  }),
  answer("amendments", 2, "c", "La stabilité concerne une résistance relative à une décomposition supplémentaire. La maturité intègre une aptitude à un usage selon plusieurs critères.", {
    a: "Ces notions portent sur des propriétés du matériau, pas sur deux désignations de son aspect sombre.",
    b: "Une mesure de stabilité n’est pas une recherche exhaustive de contaminants.",
    c: "La réponse conserve le lien entre les notions tout en distinguant leurs questions et critères.",
    d: "Une appréciation de maturité ne fournit pas toutes les concentrations d’éléments nutritifs.",
  }),
  answer("amendments", 3, "a", "Un couvert vivant possède des racines et utilise des ressources. Une couverture morte peut partager certaines fonctions de protection sans réaliser les mêmes flux.", {
    a: "Cette différence est biologique et fonctionnelle : racines et prélèvements actifs appartiennent à la plante vivante.",
    b: "Un paillis mort ne possède pas un système de racines vivantes fonctionnant comme un couvert.",
    c: "Leurs prélèvements et transformations diffèrent ; une fonction de protection commune n’efface pas ces écarts.",
    d: "Une plante vivante utilise de l’eau ; l’absence de concurrence ne peut pas être garantie dans tous les contextes.",
  }),
  answer("amendments", 4, "d", "Un résidu en surface ne garantit pas une fourniture nutritive immédiate et complète. Transformations, immobilisation et autres destins restent possibles.", {
    a: "Le dossier décrit effectivement une matière posée à la surface : cette observation matérielle reste justifiée.",
    b: "La possibilité de transformations biologiques est cohérente avec la présence d’un résidu organique.",
    c: "Documenter l’origine aide à caractériser le matériau ; ce besoin n’est pas une garantie exagérée.",
    d: "C’est la conclusion excessive : aucune disponibilité intégrale immédiate, absence de risque ou absence de perte n’est démontrée.",
  }),
  answer("analysis", 1, "b", "Dans ces données inventées, 18/1,5 et 24/2 valent tous deux 12. Ce rapport de teneurs ne mesure ni l’azote disponible ni une absorption.", {
    a: "Le calcul de B est incorrect : 24 divisé par 2 vaut 12, et non 24.",
    b: "Le calcul est correct sur la base commune annoncée, et la réserve sur l’azote disponible est indispensable.",
    c: "Une concentration de l’échantillon ne mesure pas la quantité absorbée par une plante ; aucun doublement d’absorption n’est établi.",
    d: "Le rapport C/N ne détermine pas la salinité ; celle-ci demande d’autres mesures avec leurs méthodes.",
  }),
  answer("analysis", 2, "c", "Olsen et Mehlich 3 sont des méthodes d’extraction différentes. Une unité commune ne suffit pas à rendre leurs résultats interchangeables.", {
    a: "mg P/kg décrit l’unité, mais pas la fraction obtenue par chaque extractant ni son étalonnage agronomique.",
    b: "L’extraction n’est pas une absorption et les méthodes diffèrent : ce classement dépasse deux fois la preuve disponible.",
    c: "La réponse demande les références qui permettent d’interpréter chaque méthode dans le contexte étudié.",
    d: "Des méthodes différentes ne rendent pas automatiquement les nombres faux ; elles limitent leur comparaison directe.",
  }),
  answer("analysis", 3, "a", "Un bulletin devient interprétable avec son périmètre, l’historique, les observations de plante et de milieu, et l’objectif du projet.", {
    a: "Ces informations peuvent modifier les hypothèses et préciser à quelle question les analyses répondent.",
    b: "Une mesure absente reste inconnue ; la remplacer par zéro invente un résultat qui peut fausser la décision.",
    c: "La couleur d’un emballage ne renseigne pas les mécanismes du sol, l’état racinaire ou le besoin réel.",
    d: "Un classement commercial ne décrit pas la parcelle, les apports précédents ou le fonctionnement de cette plante.",
  }),
  answer("analysis", 4, "d", "Deux zones observées à la même date ne constituent pas un avant/après. Leur différence ne démontre pas l’effet temporel d’une action.", {
    a: "Le dossier annonce explicitement deux zones : cette conclusion descriptive est disponible.",
    b: "Une différence de concentration entre zones est possible et peut être décrite pour des mesures comparables.",
    c: "Conserver les méthodes est nécessaire et possible ; cela évite de comparer des variables incompatibles.",
    d: "Cette conclusion est impossible depuis le seul dossier : il manque un dispositif temporel et causal adapté.",
  }),
  answer("hemp", 1, "b", "La fiche réelle de Carmagnola documente une histoire attribuée au catalogue du jeu. Elle ne mesure pas les besoins ou le statut d’un projet actuel.", {
    a: "Une histoire variétale ne fournit pas une dose valable sur tous les sols, et le parcours n’en prescrit aucune.",
    b: "Cette lecture respecte l’objet de la fiche tout en gardant les questions agronomiques du projet à évaluer.",
    c: "Le nom d’une référence historique ne certifie pas l’autorisation actuelle d’un lot ou d’un usage.",
    d: "Fibre et graine restent des débouchés différents ; la fiche ne rend pas leurs objectifs interchangeables.",
  }),
  answer("hemp", 2, "c", "Besoin biologique, éléments emportés avec la récolte et éventuel apport décrivent des questions différentes. Les fournitures du milieu et le périmètre doivent être pris en compte.", {
    a: "Ces nombres ne sont pas identiques par définition : une partie des éléments peut rester dans le système ou venir du sol.",
    b: "Ce qui reste dans les racines n’est pas automatiquement exporté avec la matière récoltée ; le périmètre compte.",
    c: "La distinction évite de transformer le contenu d’une récolte en prescription d’apport sans considérer le système.",
    d: "Un apport nouveau ne remplace pas l’analyse des fournitures, des limites et du contexte existants.",
  }),
  answer("hemp", 3, "a", "La démarche relie observation, analyse, limites, décision et suivi. Elle permet de réviser la conclusion si de nouvelles preuves apparaissent.", {
    a: "Cet enchaînement justifie l’action à partir du dossier et prévoit une vérification de son résultat.",
    b: "Choisir d’abord le produit favorise une recherche sélective de justification plutôt qu’une comparaison des causes.",
    c: "Des indicateurs de natures et unités différentes ne donnent pas automatiquement un score ou une ordonnance validée.",
    d: "Écarter les résultats défavorables fausse l’évaluation ; ils doivent être conservés avec les observations favorables.",
  }),
  answer("hemp", 4, "d", "Une amélioration après une action est une observation. Lorsque d’autres facteurs changent, le rôle exclusif de l’action n’est pas démontré par la seule chronologie.", {
    a: "Les changements simultanés empêchent d’attribuer nécessairement tout le résultat à une cause unique.",
    b: "Un résultat local ne justifie pas un programme identique dans tous les sites et débouchés.",
    c: "Les autres changements sont précisément des informations importantes pour interpréter le résultat.",
    d: "La conclusion rapporte l’amélioration tout en gardant la limite causale explicitement présente dans le dossier.",
  }),
]);
