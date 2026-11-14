import "server-only";
import type { HistoryAnswer } from "./kanab-quest-school-history-types";

/** Rewarded quiz keys and per-option corrections must never enter the client bundle. */
export const HISTORY_MODERN_ANSWERS: Readonly<Record<string, HistoryAnswer>> = {
  "history-medieval-europe-q01": {
    correctOptionId: "b", explanation: "L’étude identifie du chanvre dans quatre objets sur dix examinés, avec des mélanges dans certains cas. La portée de la conclusion reste celle du corpus.",
    optionExplanations: { a: "Dix objets ne représentent pas tous les textiles de l’Europe médiévale ; la généralisation n’est pas démontrée.", b: "Oui : cette formulation décrit le résultat matériel sans élargir artificiellement son périmètre.", c: "Des objets étudiés mêlent chanvre et lin ; le résultat ne montre donc pas l’absence du lin.", d: "Le lieu de conservation n’établit ni le lieu de tissage ni celui de culture des plantes." },
  },
  "history-medieval-europe-q02": {
    correctOptionId: "d", explanation: "La matière, le lieu de découverte et la provenance agricole sont des informations distinctes. Il faut d’autres indices pour relier l’objet à une origine.",
    optionExplanations: { a: "L’ancienneté ne donne pas à elle seule le lieu où la plante a poussé.", b: "La finesse renseigne certaines caractéristiques du tissu, pas une origine agricole précise.", c: "Un musée peut conserver des objets venus de nombreux lieux ; son nom n’est pas une preuve d’origine.", d: "Oui : archives, contexte et comparaisons doivent compléter l’identification matérielle pour étudier la provenance." },
  },
  "history-medieval-europe-q03": {
    correctOptionId: "a", explanation: "Les notices distinguent des supports et des exemplaires. Elles ne fournissent pas d’analyse établissant que le papier des Bibles de Gutenberg serait exclusivement du chanvre.",
    optionExplanations: { a: "Oui : le vélin est documenté pour l’exemplaire de Washington, tandis que la composition des papiers n’est pas démontrée ici.", b: "Cette affirmation contredit les exemplaires sur parchemin et ajoute une composition non établie aux exemplaires sur papier.", c: "Un exemplaire particulier ne décrit pas tous les autres ; Mayence mentionne aussi du papier.", d: "Papier est un type de support, pas le nom d’une plante ni le résultat d’une analyse des fibres." },
  },
  "history-medieval-europe-q04": {
    correctOptionId: "c", explanation: "Le filage assemble les fibres préparées en fil. Le tissage intervient avec des fils déjà constitués pour former une toile.",
    optionExplanations: { a: "Le négoce concerne la vente et la circulation commerciale ; ce n’est pas la formation du fil.", b: "Le tissage entrecroise des fils : il ne faut pas le confondre avec leur production.", c: "Oui : c’est le rôle du filage, une contribution essentielle parfois moins visible dans les archives.", d: "Le classement muséal décrit et conserve un objet ; il ne fabrique pas le fil historique." },
  },
  "history-brittany-q01": {
    correctOptionId: "c", explanation: "La commande est annoncée comme fictive. Les documents permettent de parler des noyales et du travail, mais ne donnent ni tarif ni salaire à reproduire.",
    optionExplanations: { a: "Un prix fabriqué ferait passer la fiction pour une information historique ; il faut signaler son absence.", b: "Aucun document fourni n’établit des rémunérations identiques, ni même leur montant.", c: "Oui : la matière et les tâches sont étayées, tandis que les conditions commerciales sont laissées à documenter.", d: "L’inventaire distingue le lin et le chanvre ; les noyales citées sont bien des toiles de chanvre." },
  },
  "history-brittany-q02": {
    correctOptionId: "b", explanation: "La mention d’un métier dans une étable illustre une organisation rurale intégrant le tissage à des espaces agricoles ou domestiques.",
    optionExplanations: { a: "Le cas d’une ferme ne prouve pas une usine centralisée dans chaque village ; c’est même une autre organisation.", b: "Oui : cette conclusion décrit le cas attesté sans le transformer en règle universelle.", c: "La mention d’un métier à tisser ne permet pas de nier le filage effectué ailleurs ou par d’autres personnes.", d: "La localisation du métier ne fournit aucune somme versée à la personne qui l’utilisait." },
  },
  "history-brittany-q03": {
    correctOptionId: "d", explanation: "Le dossier régional nomme les olonnes autour de Locronan parmi les productions de chanvre. Il ne faut pas les transformer en exemple exclusivement linier.",
    optionExplanations: { a: "Cette opposition géographique est trompeuse : la source citée documente aussi du chanvre autour de Locronan.", b: "L’exportation d’une toile ne détermine pas sa matière, et le dossier ne donne pas ici le coton.", c: "La matière de cette production est précisée dans l’inventaire ; l’incertitude ne doit pas effacer une donnée disponible.", d: "Oui : la formulation respecte l’identification de la production tout en évitant de généraliser à chaque objet local." },
  },
  "history-brittany-q04": {
    correctOptionId: "a", explanation: "Les statuts prévoient plusieurs fibres. Le nom de l’entreprise ne suffit pas à identifier le contenu d’un envoi particulier.",
    optionExplanations: { a: "Oui : il faudrait un document concernant la caisse, comme une description de marchandise ou un registre.", b: "Le nom « linière » n’annule pas la mention du chanvre et du jute dans les statuts.", c: "Une entreprise pouvant travailler trois matières ne les mélange pas nécessairement dans chaque produit.", d: "Les statuts mentionnent précisément le chanvre au XIXe siècle ; le nom ne prouve pas sa disparition." },
  },
  "history-nineteenth-century-q01": {
    correctOptionId: "d", explanation: "La notice de 1839 situe une publication à Calcutta ; celle de 1843 décrit une réimpression à Londres. Il faut dater l’édition concernée.",
    optionExplanations: { a: "Une date de livre n’est pas une preuve de première utilisation mondiale, encore moins deux premières utilisations.", b: "Une réimpression ne supprime pas l’édition précédente ; les deux appartiennent à l’histoire du texte.", c: "1839 est la date de l’édition originale décrite, pas celle du catalogue numérique actuel.", d: "Oui : les lieux, éditeurs et mentions de réimpression expliquent pourquoi plusieurs dates sont pertinentes." },
  },
  "history-nineteenth-century-q02": {
    correctOptionId: "a", explanation: "La notice documente un ouvrage historique. L’annonce d’une utilisation dans son titre ne remplace pas une évaluation clinique actuelle du produit concerné.",
    optionExplanations: { a: "Oui : titre, sujet et édition sont identifiables, mais une efficacité chez les patients actuels n’en découle pas.", b: "Les préparations, populations et méthodes peuvent différer ; une généralisation à tous les produits n’est pas justifiée.", c: "Un titre ancien ne fournit aucun fondement suffisant pour un dosage médical contemporain.", d: "L’ancienneté d’un usage ou d’un texte ne garantit pas l’absence de risques ; les produits doivent être évalués." },
  },
  "history-nineteenth-century-q03": {
    correctOptionId: "c", explanation: "Une cote et une description donnent accès à l’identification du document. Elles ne permettent pas d’affirmer que tous ses témoignages et conclusions ont été lus.",
    optionExplanations: { a: "Cette formulation surestime la consultation : le texte intégral n’a pas été examiné.", b: "L’existence du document est justement attestée par la notice, même si son contenu détaillé reste inaccessible ici.", c: "Oui : cette phrase rend explicite ce qui est connu et ce qui reste à vérifier.", d: "La conservation dans des archives ne prouve pas une innocuité ; il faudrait examiner les données et leurs limites." },
  },
  "history-nineteenth-century-q04": {
    correctOptionId: "b", explanation: "Une page de Moreau renseigne un raisonnement et des catégories historiques. Son contexte et l’étendue de notre lecture doivent accompagner sa présentation.",
    optionExplanations: { a: "Un raisonnement de 1845 ne devient pas automatiquement un diagnostic contemporain.", b: "Oui : l’auteur, la date, la page et la limite de consultation rendent l’affirmation contrôlable.", c: "Un passage ne suffit pas à résumer sans réserve les méthodes ou toutes les conclusions d’un ouvrage.", d: "Aucune équivalence entre toutes les préparations commerciales n’est établie par cette page historique." },
  },
  "history-twentieth-century-q01": {
    correctOptionId: "a", explanation: "Le texte de 1937 est américain et utilise un mécanisme fiscal et administratif. Ses définitions distinguent certaines matières, dont des fibres issues de tiges mûres.",
    optionExplanations: { a: "Oui : cette description respecte la juridiction et les principaux mécanismes du document.", b: "Ce n’est pas une loi mondiale, et sa définition ne traite pas toutes les matières sans distinction.", c: "Cette formulation confond la loi américaine avec la Convention de 1961, entrée en vigueur en 1964.", d: "La loi organise des contraintes ; elle n’est pas une autorisation universelle de toutes les préparations." },
  },
  "history-twentieth-century-q02": {
    correctOptionId: "c", explanation: "L’exception conventionnelle a un champ précis. Elle ne supprime ni les règles nationales ni celles liées à la nature et à l’usage du produit.",
    optionExplanations: { a: "Les États conservent des règles applicables ; il faut examiner le droit national et la situation concrète.", b: "Une appellation commerciale ne détermine pas à elle seule le régime juridique.", c: "Oui : produit, usage, territoire et date sont nécessaires à l’analyse.", d: "L’article 28 comporte bien une distinction concernant certaines cultures exclusivement industrielles ; il ne faut pas l’effacer." },
  },
  "history-twentieth-century-q03": {
    correctOptionId: "b", explanation: "La notice USDA/NAL établit créateur, datation approximative et sujet militaire/industriel du film. Elle ne démontre pas ses effets économiques ou juridiques.",
    optionExplanations: { a: "Un film encourageant une production de fibres ne prouve pas la légalisation générale des autres usages.", b: "Oui : ce sont les informations données par la notice effectivement consultée.", c: "Les revenus individuels nécessiteraient d’autres archives ; la notice ne les présente pas.", d: "Consulter un catalogue n’est pas visionner un film. Le niveau de consultation doit être annoncé honnêtement." },
  },
  "history-twentieth-century-q04": {
    correctOptionId: "d", explanation: "Une hypothèse causale doit être confrontée à des archives et à des mécanismes précis. Une seule cause supposée ne peut être étendue à tous les pays et à tout le siècle sans enquête.",
    optionExplanations: { a: "L’impact d’une illustration ne renforce pas la preuve historique de la causalité.", b: "La répétition d’une théorie ne remplace pas des documents indépendants et vérifiables.", c: "Regrouper des lois différentes sous une date unique effacerait justement les variations à expliquer.", d: "Oui : cette démarche permet de vérifier plusieurs facteurs, leurs relations et leur portée géographique et temporelle." },
  },
  "history-scientific-discoveries-q01": {
    correctOptionId: "c", explanation: "L’article d’Adams, Hunt et Clark paraît en 1940. La date de mise en ligne de l’archive éditeur doit rester séparée de celle de l’édition originale.",
    optionExplanations: { a: "L’accès numérique récent ne déplace pas la publication historique de l’article.", b: "1964 correspond à un autre jalon, sur le THC ; les cannabinoïdes n’ont pas tous une date unique.", c: "Oui : 1940 date l’article, tandis que 2002 décrit une étape de sa diffusion numérique.", d: "1992 concerne l’anandamide dans le corpus étudié, pas cet article sur le CBD." },
  },
  "history-scientific-discoveries-q02": {
    correctOptionId: "d", explanation: "Le travail de 1964 constitue un jalon de caractérisation du THC. Les recherches antérieures sur CBN et CBD empêchent d’en faire le début de toute la science du cannabis.",
    optionExplanations: { a: "Une publication de chimie ne marque pas la première existence de la plante.", b: "Le CBN et le CBD avaient déjà fait l’objet de travaux ; les récepteurs relèvent d’étapes ultérieures distinctes.", c: "Le clonage du récepteur publié en 1990 est un résultat différent, réalisé par une autre équipe.", d: "Oui : cette formulation situe le résultat sans effacer les autres substances ni les travaux précédents." },
  },
  "history-scientific-discoveries-q03": {
    correctOptionId: "a", explanation: "Le corpus distingue caractérisation d’une liaison en 1988, clonage et expression du récepteur en 1990, puis identification d’un ligand endogène en 1992.",
    optionExplanations: { a: "Oui : les trois dates et les trois objets expérimentaux correspondent aux publications citées.", b: "Les substances et dates sont mélangées ; 1992 ne concerne pas une première fibre textile.", c: "Aucune de ces publications n’établit ce scénario clinique ou historique ; les modèles décrits sont différents.", d: "Il s’agit d’articles et de questions distincts, pas de versions datées d’un seul article de 1964." },
  },
  "history-scientific-discoveries-q04": {
    correctOptionId: "b", explanation: "Endogène signifie produit dans l’organisme. L’article de 1992 identifie l’anandamide dans du cerveau porcin ; la molécule est distincte du THC.",
    optionExplanations: { a: "Cette origine végétale contredit le sens du terme endogène et le matériau étudié dans l’article.", b: "Oui : le terme décrit l’origine dans l’organisme, sans assimiler la molécule au THC.", c: "Anandamide est le nom d’une molécule, pas ici celui d’une variété commerciale.", d: "La présence d’un ligand naturel ne démontre pas un bénéfice de toute consommation ni une absence de risque." },
  },
  "history-contemporary-q01": {
    correctOptionId: "b", explanation: "La chènevotte est la fraction ligneuse centrale de la tige. La distinguer des fibres et du chènevis évite de confondre matières et usages.",
    optionExplanations: { a: "Le chènevis désigne les graines, pas la fraction ligneuse de la tige.", b: "Oui : cette définition correspond à la matière recherchée pour l’exemple de matériau.", c: "Un médicament au cannabidiol est un produit formulé et évalué ; ce n’est pas le nom de ce granulat.", d: "La filasse est un ensemble de fibres préparées ; elle ne devient pas des graines par une opération textile." },
  },
  "history-contemporary-q02": {
    correctOptionId: "a", explanation: "Le rappel français distingue les aliments avec CBD ajouté de certains produits de graines, sous conditions. Une origine végétale commune ne crée pas une autorisation commune.",
    optionExplanations: { a: "Oui : il faut examiner les ingrédients, la catégorie alimentaire et les conditions applicables à la date indiquée.", b: "Le nom botanique ne suffit pas : deux compositions peuvent relever de règles différentes.", c: "Une condition agricole pour le chanvre ne vaut pas autorisation de chaque aliment fini.", d: "Le communiqué décrit précisément certains usages alimentaires des graines et dérivés sous conditions ; il ne les exclut pas tous." },
  },
  "history-contemporary-q03": {
    correctOptionId: "d", explanation: "La réforme canadienne et la décision internationale de 2020 ont des champs déterminés. Elles ne se substituent pas aux règles françaises d’un produit ou d’un acte.",
    optionExplanations: { a: "Une loi canadienne n’est pas une autorisation automatiquement valable dans les autres juridictions.", b: "L’OMS précise que le changement de classement ne légalise pas l’usage non médical et maintient le contrôle international.", c: "L’étiquette chanvre ne définit pas à elle seule composition, usage et conformité.", d: "Oui : une comparaison correcte précise territoire, date, produit et acte avant de conclure." },
  },
  "history-contemporary-q04": {
    correctOptionId: "c", explanation: "Une fiche de sélection et un dossier d’évaluation de médicament répondent à des questions différentes. Les résultats d’Epidyolex concernent une formulation, des indications et des patients définis.",
    optionExplanations: { a: "Une origine géographique précise peut documenter l’histoire de la sélection ; elle ne prouve pas une équivalence médicale.", b: "Le seul mot CBD ne garantit ni composition identique, ni contrôle de qualité comparable, ni mêmes résultats cliniques.", c: "Oui : l’évaluation clinique ne se transfère pas automatiquement à une variété ou à un produit commercial différent.", d: "Epidyolex est documenté par l’EMA ; la bonne distinction ne consiste pas à nier l’existence du médicament autorisé." },
  },
};
