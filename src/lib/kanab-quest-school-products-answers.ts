import "server-only";
import type { HistoryAnswer } from "./kanab-quest-school-history-types";

function answer(chapter: string, n: number, correctOptionId: string, explanation: string, optionExplanations: Readonly<Record<"a" | "b" | "c" | "d", string>>): readonly [string, HistoryAnswer] {
  return ["products-" + chapter + "-q" + String(n).padStart(2, "0"), { correctOptionId, explanation, optionExplanations }];
}

// Références privées : le serveur ne les révèle qu’après la finalisation du quiz.
export const PRODUCTS_ANSWERS: Readonly<Record<string, HistoryAnswer>> = Object.fromEntries([
  answer("seeds", 1, "b", "La graine fournit une matière lipidique distincte de la résine glandulaire. La tige apporte notamment des fibres périphériques et un cœur ligneux dont provient la chènevotte.", {
    a: "Le cœur ligneux fournit la chènevotte ; l’huile de graines vient de la graine.",
    b: "Ces deux associations respectent les fractions de départ et leurs débouchés.",
    c: "Les trichomes glandulaires produisent une résine ; ils ne sont pas les faisceaux de fibres textiles de la tige.",
    d: "Les graines ne sont pas produites à partir des fibres périphériques de tige.",
  }),
  answer("seeds", 2, "c", "La chènevotte est la fraction ligneuse issue du cœur de tige. Elle doit être distinguée des fibres, de l’huile de graines et de la résine.", {
    a: "Une huile de graines est une matière lipidique, pas la fraction ligneuse de la tige.",
    b: "La résine glandulaire appartient à une autre famille de matières.",
    c: "Le cœur ligneux constitue l’origine de la chènevotte après séparation des fractions.",
    d: "Un fil est fabriqué à partir de matière préparée ; il n’est pas déjà tissé dans la plante.",
  }),
  answer("seeds", 3, "a", "L’ajout d’un extrait produit une formulation distincte. Le support ne définit ni la concentration des ajouts ni leur statut réglementaire.", {
    a: "La formulation doit être caractérisée comme produit final, avec ses ingrédients et son usage.",
    b: "Le support peut être commun alors que les compositions finales diffèrent.",
    c: "Le statut de l’huile ne vaut pas autorisation de tout ingrédient ajouté.",
    d: "Une concentration demande une déclaration précise et des preuves analytiques adaptées.",
  }),
  answer("seeds", 4, "d", "Une étude de stabilité documente une matière et des conditions définies. Son résultat n’impose pas une durée universelle aux autres huiles et formulations.", {
    a: "Les matrices, emballages et conditions peuvent différer ; la durée n’est pas universelle.",
    b: "Un suivi d’oxydation sur une huile ne constitue pas une recherche de tous les contaminants d’une autre formulation.",
    c: "Une composition lipidique et sa stabilité ne démontrent pas une indication médicale.",
    d: "Cette formulation conserve l’objet étudié, les conditions et les limites du transfert.",
  }),
  answer("fibres", 1, "b", "La fiche réelle du Buddy Carmagnola donne un contexte historique de semences, fibres et cordages. Les caractéristiques et la conformité du lot actuel demandent leurs propres données.", {
    a: "Une tradition d’usage ne mesure pas les caractéristiques requises par chaque filature.",
    b: "La portée historique est utile et reste distincte d’une caractérisation technique du lot.",
    c: "Le nom d’une population ne certifie pas l’autorisation de tous les produits portant ce nom.",
    d: "La fiche ne mesure pas la longueur de chaque récolte ni son homogénéité.",
  }),
  answer("fibres", 2, "c", "La qualité s’évalue par rapport à des critères de destination. Une fraction pertinente pour un usage ne possède pas automatiquement les caractéristiques requises pour un autre.", {
    a: "Les critères peuvent différer entre textile, granulat et composite.",
    b: "Le nom variétal ne remplace pas les caractéristiques contractuelles du produit livré.",
    c: "La destination permet de définir les caractéristiques et méthodes de contrôle pertinentes.",
    d: "Une fraction ligneuse et un fil préparé ne sont ni la même matière ni le même stade.",
  }),
  answer("fibres", 3, "a", "Dans la voie présentée, on sépare et prépare d’abord les fibres, puis on forme un fil avant de le tisser. Le schéma décrit une chaîne conceptuelle, sans recette.", {
    a: "L’ordre relie les matières disponibles aux fonctions de chaque étape.",
    b: "Le tissage de cette voie nécessite des fils déjà produits.",
    c: "La préparation initiale des fibres doit précéder la filature considérée.",
    d: "Commencer par le tissage inverse le rapport entre matière préparée, fil et tissu.",
  }),
  answer("fibres", 4, "d", "La présentation industrielle distingue plusieurs voies : fibres courtes, semi-longues, longues et voie cellulosique. Le parcours textile choisi ne vaut pas chaîne obligatoire de tous les produits.", {
    a: "Papier et matériaux peuvent employer des parcours différents.",
    b: "Un tissu peut comporter plusieurs matières ; le schéma ne donne aucune proportion.",
    c: "Aucun rendement universel n’est établi par ce schéma.",
    d: "Cette réserve conserve la diversité des voies sans rendre l’exemple inutile.",
  }),
  answer("materials", 1, "b", "Un essai porte sur un système, des critères et des conditions. Sa portée ne s’étend pas automatiquement à un autre liant, une autre configuration ou un bâtiment entier.", {
    a: "La présence de chanvre ne rend pas tous les bâtiments identiques au système testé.",
    b: "Le résultat reste attaché au système effectivement évalué.",
    c: "Changer le liant peut changer les propriétés ; le transfert demande une justification.",
    d: "Isolation et portance sont des fonctions distinctes.",
  }),
  answer("materials", 2, "c", "Un composite associe plusieurs composants. Son caractère partiellement biosourcé ne fixe ni l’origine de tous les composants ni sa fin de vie.", {
    a: "Une matrice ou un liant peut être d’une autre origine que le renfort végétal.",
    b: "La biodégradabilité dépend du matériau et des conditions ; elle n’est pas imposée par le mot composite.",
    c: "Les fonctions émergent de l’assemblage et doivent être évaluées dans ce système.",
    d: "Le composite ne se réduit pas à une fibre isolée et son nom ne certifie pas un ouvrage.",
  }),
  answer("materials", 3, "a", "La comparaison doit porter sur un service comparable, une durée et des frontières explicites. Le résultat dépend aussi des constituants et des étapes incluses.", {
    a: "Cette base évite de comparer des objets qui rendent des services différents.",
    b: "Biosourcé décrit une origine, pas un bilan environnemental complet.",
    c: "Une masse de matière et un bâtiment complet ne constituent pas une référence fonctionnelle commune.",
    d: "Le stock de carbone ne couvre pas à lui seul les impacts du cycle.",
  }),
  answer("materials", 4, "d", "Biosourcé indique une origine biologique pour tout ou partie de la matière. Le reste de la composition, les performances et les impacts demandent des données séparées.", {
    a: "L’origine biologique n’impose pas un bilan climatique négatif dans tous les systèmes.",
    b: "La fin de vie et la biodégradation dépendent de la composition et du contexte.",
    c: "Une fraction végétale peut être associée à un liant minéral ou une matrice polymère.",
    d: "C’est la portée correcte du qualificatif, sans conclusion environnementale excessive.",
  }),
  answer("resins", 1, "b", "Live est utilisé commercialement pour situer l’état de la matière de départ dans certaines catégories. Ce qualificatif ne constitue pas une analyse, un essai clinique ou une garantie sanitaire.", {
    a: "L’absence de contaminants demanderait des contrôles adaptés au lot.",
    b: "La réponse conserve la fonction descriptive du terme et ses limites.",
    c: "Une efficacité clinique ne se déduit pas d’un nom commercial.",
    d: "L’identité chimique de cristaux demande davantage qu’une apparence ou ce qualificatif.",
  }),
  answer("resins", 2, "c", "Une photographie peut documenter l’aspect d’une matière. Elle ne détermine pas seule son identité chimique, sa pureté ou son statut.", {
    a: "Des substances ou mélanges différents peuvent présenter un aspect cristallin.",
    b: "Un constituant non visible n’est pas nécessairement absent.",
    c: "La réponse distingue observation visuelle et caractérisation analytique.",
    d: "Une image ne fournit pas une autorisation de voie d’exposition.",
  }),
  answer("resins", 3, "a", "L’extraction est une famille de séparations par transfert de constituants. Une transformation chimique modifie des identités moléculaires. Une formulation peut simplement associer des ingrédients.", {
    a: "Les deux fonctions sont distinguées sans décrire de fabrication pratique.",
    b: "Répartir des constituants peut laisser leur identité moléculaire inchangée.",
    c: "Associer des ingrédients n’implique pas nécessairement de construire chimiquement une molécule.",
    d: "L’extraction est une famille de séparations ; la catégorie séparation est plus large.",
  }),
  answer("resins", 4, "d", "Une déclaration concernant un solvant ne couvre pas tous les contaminants ni la stabilité. Elle doit être complétée par les contrôles pertinents au produit et à l’usage.", {
    a: "L’absence annoncée de solvant d’extraction n’élimine pas logiquement tous les autres risques.",
    b: "La couleur n’est pas une mesure des métaux.",
    c: "Le nom ne mesure pas l’évolution du produit au cours du temps.",
    d: "La réponse relie les contrôles aux questions réelles sans inventer une contamination.",
  }),
  answer("labels", 1, "b", "Full spectrum est une revendication de profil dont les définitions et la réalité peuvent varier. Une étude utilisant sa propre définition opérationnelle ne crée pas une norme mondiale.", {
    a: "Le mot seul ne donne ni une liste exhaustive ni une composition identique entre produits.",
    b: "Il faut vérifier ce que le fabricant revendique et ce que les analyses établissent.",
    c: "Une catégorie commerciale ne remplace pas une étude clinique pertinente.",
    d: "Le profil revendiqué ne certifie pas l’absence de contaminants.",
  }),
  answer("labels", 2, "c", "La conclusion aucun contaminant dépasse une information sur le procédé. Cela justifie une critique de l’allégation, pas l’invention d’un résultat positif.", {
    a: "La phrase n’identifie ni ne mesure un métal précis.",
    b: "Une information sur un solvant ne couvre pas les autres sources possibles de contamination.",
    c: "Cette critique conserve simultanément la limite de la promesse et l’incertitude réelle.",
    d: "La traçabilité du lot reste nécessaire pour relier une preuve au produit.",
  }),
  answer("labels", 3, "a", "Le dénominateur et la base d’expression font partie de la mesure. Comparer une concentration par masse et une concentration par volume peut demander une donnée supplémentaire pertinente.", {
    a: "La vérification préalable conserve le sens physique et analytique des résultats.",
    b: "Un numérateur commun ne rend pas les dénominateurs équivalents.",
    c: "Une concentration n’est pas directement la quantité totale par emballage.",
    d: "La densité ne peut pas être supposée identique pour toutes les formulations.",
  }),
  answer("labels", 4, "d", "La rubrique 2.6 du règlement 2023/915 utilise la somme Δ9-THC + 0,877 × Δ9-THCA. Il s’agit d’une définition de composition pour ce cadre alimentaire.", {
    a: "Le résultat analytique ne mesure pas l’absorption d’une personne.",
    b: "La définition ne somme pas tous les cannabinoïdes et emploie une pondération précise.",
    c: "Le seuil variétal et la limite alimentaire ne concernent pas le même objet.",
    d: "La formule correspond à la définition réglementaire étudiée, sans prétendre décrire un effet clinique.",
  }),
  answer("food", 1, "b", "La communication française du 20 mai 2026 distingue les graines et dérivés non enrichis des denrées avec ajout de CBD, pour lesquelles elle rappelle l’absence d’autorisation alimentaire concernée dans l’UE.", {
    a: "Le nom de la plante ne supprime pas les différences de catégorie et d’usage.",
    b: "Cette distinction est nécessaire pour lire les règles applicables à la date donnée.",
    c: "Un support autorisé ne rend pas automatiquement autorisé un ajout.",
    d: "Une règle étrangère ne s’applique pas automatiquement au marché français.",
  }),
  answer("food", 2, "c", "Une limite de contaminants d’une denrée, sa base d’expression et sa catégorie juridique diffèrent d’un seuil relatif à une variété ou à sa culture.", {
    a: "Les règles alimentaires étudiées comportent précisément des limites de composition pour les catégories visées.",
    b: "Pourcentage et mg/kg n’ont pas la même valeur numérique et ne résolvent pas la différence d’objet.",
    c: "Il faut d’abord identifier le produit et le référentiel avant de comparer des valeurs.",
    d: "L’huile de graines fait partie des catégories soumises à des limites spécifiques.",
  }),
  answer("food", 3, "a", "L’évaluation scientifique et la décision d’autorisation ont des rôles distincts dans la procédure des nouveaux aliments. La décision et ses conditions doivent correspondre au produit exact.", {
    a: "Cette formulation respecte les étapes et le périmètre de la procédure.",
    b: "Un avis ne donne pas une permission générale à tous les produits de même nom.",
    c: "Le dépôt ouvre une procédure sans garantir son issue.",
    d: "L’identité du produit reste indispensable à l’évaluation comme à la décision.",
  }),
  answer("food", 4, "d", "Un nom moléculaire partagé ne transfère pas l’indication, la formulation ni les preuves d’un médicament à un aliment. Chaque objet demande son propre examen.", {
    a: "Constater le nom commun ne dépasse pas l’information donnée.",
    b: "Vérifier les formulations est précisément une démarche nécessaire.",
    c: "Vérifier les cadres et les usages évite une confusion de statut.",
    d: "C’est la conclusion indue : une identité de nom ne transporte pas une indication médicale.",
  }),
  answer("exposure", 1, "b", "Le contenu du produit et l’exposition de l’organisme ne sont pas identiques. Voie, formulation, absorption et métabolisme influencent le devenir des substances.", {
    a: "La quantité présente dans un flacon n’est pas nécessairement intégralement absorbée.",
    b: "Ces facteurs expliquent pourquoi la composition seule ne prédit pas toute l’exposition.",
    c: "Une présentation alimentaire ne supprime pas les effets différés possibles.",
    d: "L’identité ne décrit pas à elle seule les différences individuelles ou l’exposition.",
  }),
  answer("exposure", 2, "c", "Une étude établit directement des résultats pour ses conditions effectivement comparées. Une comparaison non incluse ne peut être présentée comme un résultat direct du protocole.", {
    a: "Aucun bras inhalé n’est décrit : l’équivalence des voies n’a pas été testée directement.",
    b: "Le protocole ne porte pas sur toutes les huiles commercialisées.",
    c: "La conclusion conserve la population, la formulation et le comparateur réels.",
    d: "Une conversion universelle entre voies ne découle pas de cet essai.",
  }),
  answer("exposure", 3, "a", "Un statut alimentaire ne valide pas une autre voie. La formulation et les émissions éventuelles posent des questions distinctes de la composition de l’huile initiale.", {
    a: "Cette réserve évite de transformer un usage alimentaire en validation d’inhalation.",
    b: "Les poumons et le tube digestif ne constituent pas une même voie d’exposition.",
    c: "L’absence de combustion n’élimine pas toutes les expositions ou transformations possibles.",
    d: "Les émissions peuvent différer de la matière initialement analysée.",
  }),
  answer("exposure", 4, "d", "Une expérience chimique documente les composés et conditions étudiés. Elle peut signaler une question de risque sans mesurer à elle seule le risque clinique de chaque produit ou utilisateur.", {
    a: "La mesure chimique n’est pas une mesure clinique individuelle.",
    b: "Des formulations et situations différentes peuvent produire des émissions différentes.",
    c: "Un nom commercial n’établit pas la prévention d’une transformation ou d’une exposition.",
    d: "La réponse conserve la portée utile du résultat et sa limite de généralisation.",
  }),
  answer("quality", 1, "b", "Une mesure valable d’un cannabinoïde ne renseigne pas une analyse microbiologique absente. La qualité comprend plusieurs critères, chacun avec son périmètre.", {
    a: "L’absence de recherche ne démontre pas l’absence de microorganismes.",
    b: "Le résultat connu est conservé, et la donnée manquante reste identifiée comme inconnue.",
    c: "Une teneur ne couvre pas tous les critères ni toutes les voies d’usage.",
    d: "Non mesuré ne signifie pas égal à zéro.",
  }),
  answer("quality", 2, "c", "Un matériau de référence caractérisé soutient le contrôle analytique. Il ne se substitue ni à l’échantillonnage du produit ni à ses analyses et à sa traçabilité.", {
    a: "Le matériau de référence n’est pas une autorisation du lot commercial.",
    b: "Il ne prélève ni ne représente automatiquement le produit à examiner.",
    c: "C’est son rôle dans la chaîne métrologique, sans certification commerciale automatique.",
    d: "Il ne démontre pas la stabilité de tous les mélanges futurs.",
  }),
  answer("quality", 3, "a", "Un résultat inférieur à la limite de quantification ne permet pas de quantifier selon les performances requises à ce niveau. Il ne prouve pas une absence absolue ni le résultat d’autres analytes.", {
    a: "La conclusion reste liée à la limite de la méthode et à l’échantillon, sans inventer zéro.",
    b: "Une méthode possède des limites ; elle ne démontre pas l’absence à toute échelle.",
    c: "La ligne ne porte que sur l’analyte indiqué, pas tous les autres cannabinoïdes.",
    d: "Inférieur à une limite ne signifie pas égal à cette limite.",
  }),
  answer("quality", 4, "d", "Le rapport concerne l’échantillon A fourni par l’opérateur et les critères effectivement recherchés. L’assemblage B et l’autre lot D posent des questions supplémentaires.", {
    a: "La présence de A dans B ne transfère pas automatiquement la portée du rapport.",
    b: "Le dossier précise une fourniture de A par l’opérateur, pas un prélèvement de B par le laboratoire.",
    c: "Les contaminants non recherchés restent inconnus.",
    d: "La réponse respecte l’identité de l’échantillon et les limites du document.",
  }),
  answer("origins", 1, "b", "Une présence végétale documentée concerne le matériel étudié. L’origine du lot vendu doit être établie par sa propre chaîne de preuves.", {
    a: "Une même identité peut correspondre à différentes origines commerciales.",
    b: "La conclusion conserve la preuve de présence sans lui faire certifier un autre objet.",
    c: "Une observation sur un matériel ne fixe pas l’abondance dans toutes les plantes.",
    d: "L’origine naturelle ne constitue pas une garantie d’innocuité humaine.",
  }),
  answer("origins", 2, "c", "Identité structurale, observation dans un matériel et parcours du lot répondent à trois questions distinctes. Aucune ne remplace automatiquement les deux autres.", {
    a: "Le nom de la molécule ne contient pas tout son historique de fabrication.",
    b: "Une publication de présence ne contrôle pas la composition du produit vendu.",
    c: "Cette distinction attribue à chaque information son objet exact.",
    d: "Une citation commerciale n’efface pas les réserves méthodologiques d’une observation.",
  }),
  answer("origins", 3, "a", "L’hémisynthèse désigne ici une transformation chimique d’un précurseur d’origine naturelle. Elle ne se confond pas avec une simple séparation et ne garantit pas la composition finale.", {
    a: "Cette définition relie origine du précurseur et transformation chimique.",
    b: "Lire un certificat ne transforme aucune matière.",
    c: "Une séparation mécanique n’exige pas un changement d’identité moléculaire.",
    d: "Une catégorie de procédé ne fixe pas à elle seule le profil des stéréoisomères.",
  }),
  answer("origins", 4, "d", "Un nom générique ne décrit pas les proportions d’épimères ni toutes les impuretés. Une caractérisation précise du lot complète la déclaration d’origine et d’identité.", {
    a: "L’emploi du même nom est l’information donnée dans la question.",
    b: "Une caractérisation plus précise est justement pertinente.",
    c: "Examiner les documents du lot est nécessaire, pas une garantie abusive.",
    d: "Cette identité de profil ne peut pas être déduite du seul nom générique.",
  }),
  answer("traceability", 1, "b", "L’enquête doit relier les deux apports et le produit final. Le seul rapport de A ne caractérise pas automatiquement D ni B.", {
    a: "Renommer un rapport ne change pas le lot ou l’échantillon testé.",
    b: "La demande cible les maillons et les critères manquants.",
    c: "Une donnée absente ne permet pas de poser une identité de composition.",
    d: "Les résultats inconnus ne peuvent pas être remplacés par zéro.",
  }),
  answer("traceability", 2, "c", "Un document peut être authentique et exact tout en étant non pertinent pour le lot que l’on cherche à qualifier. Authenticité, identité de lot et représentativité doivent être examinées séparément.", {
    a: "L’authenticité ne change pas l’objet auquel les résultats se rapportent.",
    b: "Un résultat portant sur un autre lot ne devient pas nécessairement faux ; il peut simplement ne pas répondre à la question.",
    c: "Cette distinction permet de conserver le résultat sans étendre sa portée.",
    d: "Un nom commercial commun ne suffit pas à rendre deux lots identiques.",
  }),
  answer("traceability", 3, "a", "Dans le dossier fictif, l’insuffisance de preuves appelle une attente et des vérifications ciblées. Elle ne prouve pas une contamination précise et ne valide pas les usages étendus de l’étiquette.", {
    a: "La conclusion correspond aux inconnues : D, le produit final et les critères absents.",
    b: "Le rapport de A ne couvre ni tout B ni toutes les voies d’usage.",
    c: "Aucune analyse ne démontre ce métal dans B.",
    d: "Sans solvant ne signifie pas absence de tout contaminant.",
  }),
  answer("traceability", 4, "d", "Une enquête relie ses conclusions aux preuves, à leur portée et aux incertitudes. De nouvelles données peuvent modifier la décision ; il faut les intégrer sans inventer ce qui manque.", {
    a: "Une donnée manquante reste inconnue, pas automatiquement positive.",
    b: "La portée d’une preuve limite les promesses qu’elle soutient.",
    c: "Une conclusion doit pouvoir être révisée lorsque les preuves changent.",
    d: "Ce principe permet une décision proportionnée, vérifiable et révisable.",
  }),
]);
