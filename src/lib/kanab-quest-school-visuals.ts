/** Human-authored summaries: the full, sourced lessons remain in school-content. */
export type KqSchoolLessonVisual = Readonly<{
  courseId: string;
  image: string;
  imageAlt: string;
  caption: string;
  steps: readonly Readonly<{ sectionId: string; points: readonly [string, string, string]; observe: string }>[];
}>;

function visual(courseId: string, imageAlt: string, caption: string, steps: readonly Readonly<{ points: readonly [string, string, string]; observe: string }>[]): KqSchoolLessonVisual {
  return { courseId, image: `/placard/school/course-${courseId}-v1.webp`, imageAlt, caption, steps: steps.map((step, index) => ({ sectionId: `${courseId}-${index + 1}`, ...step })) };
}

export const KQ_SCHOOL_LESSON_VISUALS: readonly KqSchoolLessonVisual[] = [
  visual("plant", "Planche botanique illustrée d’un plant de chanvre, avec ses feuilles, sa tige, ses racines et ses fleurs.", "Une plante, des organes aux rôles différents.", [
    { points: ["Cannabis sativa appartient aux Cannabacées, comme le houblon.", "Chanvre peut désigner une plante, une filière ou un cadre juridique.", "L’Arbre Mère est un personnage du jeu, pas un ancêtre botanique."], observe: "Repérez les différentes parties de la plante." },
    { points: ["La feuille capte la lumière ; ses petites parties sont les folioles.", "Les racines ancrent la plante et absorbent l’eau et les minéraux.", "La tige porte les organes ; la fleur participe à la reproduction."], observe: "Suivez du regard le trajet entre racines, tige et feuilles." },
    { points: ["Le vent transporte principalement le pollen du chanvre.", "Dioïque : deux types de fleurs sur des individus distincts. Monoïque : sur un même individu.", "La pollinisation précède l’éventuelle fécondation : ce sont deux étapes différentes."], observe: "Comparez les fleurs mâles et les fleurs femelles dessinées." },
    { points: ["Décrivez d’abord la forme et la position de ce que vous voyez.", "Une illustration ne mesure ni le CBD ni le THC.", "Les mots croisés vous aident à relier chaque mot à une fonction."], observe: "Nommez trois organes, puis expliquez leur rôle sans regarder le texte." },
  ]),
  visual("molecules", "Planche botanique du chanvre accompagnée d’une loupe et d’évocations des profils aromatiques.", "Une structure, une molécule et un arôme sont trois informations distinctes.", [
    { points: ["CBD et THC sont deux cannabinoïdes distincts.", "Plusieurs terpènes participent aux odeurs végétales.", "Un arôme ne donne ni un dosage ni un effet médical garanti."], observe: "Distinguez la plante représentée des évocations d’arômes." },
    { points: ["Un trichome est une petite structure à la surface de la plante.", "Certains trichomes glandulaires produisent et accumulent des substances.", "Un trichome n’est ni du pollen ni une graine."], observe: "La loupe rappelle qu’une structure visible n’est pas une analyse chimique." },
    { points: ["Harlequin : mangue et terre, d’après sa fiche du Quartier.", "ACDC : citron et diesel, d’après sa fiche du Quartier.", "Une note citronnée ne prouve pas une teneur mesurée en limonène."], observe: "Retrouvez les mots des fiches ; ils décrivent des perceptions." },
    { points: ["Le CBD est une substance active et peut interagir avec des médicaments.", "Trichome = structure ; CBD = molécule ; citronné = description sensorielle.", "Une fiche aromatique ne remplace pas l’avis d’un professionnel de santé."], observe: "Classez chaque mot dans son registre avant de conclure." },
  ]),
  visual("profiles", "Planche illustrée de spécimens de chanvre et de fiches d’observation, évoquant la comparaison de leurs profils.", "Le nom d’une variété ne remplace pas la mesure d’un lot.", [
    { points: ["Nom, histoire, arômes et analyse répondent à des questions différentes.", "Un chémotype décrit un profil de composition chimique.", "Un nom commercial ne garantit pas une concentration ou un effet."], observe: "Imaginez une fiche distincte pour chaque échantillon." },
    { points: ["Les catégories commerciales indica et sativa restent très générales.", "Elles ne résument pas toute la variation génétique et chimique.", "Une parenté documentée ne garantit pas des lots identiques."], observe: "Comparez des informations de même nature, pas seulement des noms." },
    { points: ["Exemple scolaire : 1 % en masse = 10 mg/g.", "mg/mL et pourcentage en masse ne se comparent pas directement.", "Vérifiez le lot, la date, l’unité et la méthode de l’analyse."], observe: "Les fiches illustrées évoquent des observations ; elles ne contiennent pas de mesures réelles." },
    { points: ["Sour Space Candy : pomme confite et cerise, d’après sa fiche.", "Hawaiian Haze : ananas et floral, d’après sa fiche.", "Une mesure absente reste inconnue ; elle ne devient pas zéro."], observe: "Relisez une fiche en séparant description, histoire et mesure." },
  ]),
  visual("genetics", "Planche botanique illustrée de graines et de plantes présentant des formes différentes.", "L’héritage génétique et le milieu contribuent aux caractères observés.", [
    { points: ["Génotype : information génétique. Phénotype : caractère observable.", "Le milieu contribue aussi au phénotype.", "Une différence visible ne prouve pas, seule, une différence d’ADN."], observe: "Observez les formes sans supposer leur origine génétique." },
    { points: ["Sélectionner, c’est retenir puis évaluer des caractères définis.", "Des conditions comparables aident à interpréter les différences.", "La diversité génétique conserve des possibilités d’adaptation."], observe: "Cherchez ce qu’il faudrait mesurer pour comparer deux plantes." },
    { points: ["La faculté germinative concerne un lot dans des conditions définies.", "Identité, pureté et qualité sanitaire sont des critères distincts.", "DHS signifie distinction, homogénéité et stabilité."], observe: "Un sachet de graines peut réunir plusieurs informations de qualité." },
    { points: ["La fiche de Cannatonic cite la parenté corrigée Reina Madre × NYCD.", "Cette correction est attribuée au sélectionneur et datée de 2015.", "Une parenté non documentée reste incertaine."], observe: "Une bonne fiche conserve la source et la date d’une correction." },
  ]),
  visual("history", "Planche illustrée associant vestiges anciens, herbier et instruments d’observation scientifique autour du chanvre.", "Une trace ancienne, un nom botanique et une découverte scientifique ont des dates différentes.", [
    { points: ["Jirzankal : des traces d’usage vers 500 avant notre ère, en contexte funéraire.", "L’étude paraît en 2019 ; ce n’est pas la date des objets.", "Une trace ancienne ne prouve pas la toute première utilisation humaine."], observe: "Distinguez la date d’un objet de celle de son étude." },
    { points: ["1753 : publication du nom Cannabis sativa L. par Linné.", "1964 : travail de Gaoni et Mechoulam sur l’isolement et la structure du THC.", "Nommer une plante et comprendre une molécule sont des étapes distinctes."], observe: "L’herbier et les instruments évoquent deux façons d’étudier la plante." },
    { points: ["1990 : publication sur le récepteur cannabinoïde aujourd’hui appelé CB1.", "1992 : identification de l’anandamide, un endocannabinoïde.", "Endo : produit dans l’organisme. Phyto : issu d’une plante."], observe: "Une découverte de biologie ne constitue pas un conseil d’utilisation." },
    { points: ["2022 : décision française sur l’interdiction générale des fleurs et feuilles concernées.", "Charlotte’s Web : une histoire située au Colorado, d’après sa fiche.", "La frise est un classement ; l’espace entre cartes ne mesure pas le temps."], observe: "Classez les événements en conservant leur lieu et leur contexte." },
  ]),
  visual("uses", "Planche de chanvre illustrée avec des graines, des fibres, du tissu et des matériaux évoquant ses usages.", "De la partie de plante à la matière, puis à l’objet.", [
    { points: ["Chènevis : graine. Chènevotte : partie interne ligneuse de la tige.", "Les fibres occupent la partie périphérique de la tige.", "Le défibrage sépare notamment fibres et chènevotte."], observe: "Distinguez les graines, les fibres et les fragments de tige." },
    { points: ["Les fibres servent notamment aux textiles, papiers et composites.", "Le trajet textile : fibres → fil → tissu.", "Un composite associe plusieurs matériaux ; il n’est pas forcément entièrement en chanvre."], observe: "Reliez les fibres au fil, puis au tissu." },
    { points: ["La chènevotte entre notamment dans des litières et des matériaux de construction.", "Un matériau au chanvre ne remplace pas automatiquement une structure porteuse.", "Huile de graines et huile enrichie en CBD sont deux compositions différentes."], observe: "Un même mot, chanvre, peut recouvrir des matières très différentes." },
    { points: ["Origine végétale ne signifie pas meilleur bilan dans tous les contextes.", "Comparez le même service sur l’ensemble du cycle de vie.", "Identifiez la partie utilisée et la preuve de la propriété annoncée."], observe: "Pour comparer deux objets, commencez par préciser leur fonction." },
  ]),
  visual("evidence", "Planche illustrée d’un bureau d’enquête botanique avec échantillons, loupe et documents.", "Choisissez la preuve qui répond à votre question.", [
    { points: ["Témoignage : expérience individuelle. Fiche : description. Analyse : mesure.", "Une source primaire présente le travail ou le texte original.", "Une référence doit soutenir l’affirmation précise, pas seulement sembler sérieuse."], observe: "Chaque document peut apporter une information différente." },
    { points: ["Une analyse concerne l’échantillon et les substances effectivement recherchées.", "Non détecté ne signifie pas absence absolue.", "Une enquête ne représente pas automatiquement tout le marché."], observe: "Avant de généraliser, demandez comment les échantillons ont été choisis." },
    { points: ["Exemple scolaire : 2 % en masse = 20 mg/g.", "Masse totale et concentration décrivent deux grandeurs différentes.", "Une corrélation ne suffit pas à démontrer une cause."], observe: "Comparez les unités et cherchez les autres explications possibles." },
    { points: ["Elektra : orange et chocolat, d’après sa fiche du Quartier.", "Cette description ne prouve ni un dosage ni un bénéfice médical.", "Une bonne conclusion précise la source, les conditions et ce qui reste inconnu."], observe: "Reformulez avec « d’après la fiche » ou « pour ce lot analysé »." },
  ]),
  visual("biodiversity", "Planche illustrée de chanvre dans un paysage agricole avec des insectes et des habitats voisins.", "Une plante s’observe dans un paysage et à un moment donné.", [
    { points: ["La biodiversité concerne les gènes, les espèces et les écosystèmes.", "Haies et cultures voisines influencent les organismes présents.", "Un auxiliaire rend un service utile ; tous les insectes ne sont pas des ravageurs."], observe: "Regardez aussi ce qui entoure la plante." },
    { points: ["Le vent pollinise principalement le chanvre.", "Des abeilles peuvent récolter le pollen de ses fleurs mâles.", "Pollen et nectar sont distincts : les observations citées ne montrent pas de nectar."], observe: "Une visite d’abeille ne suffit pas à prouver la présence de nectar." },
    { points: ["Une rotation organise la succession des cultures sur une parcelle.", "Le chanvre a besoin d’eau, de lumière et d’éléments minéraux.", "Résistance à certains épisodes secs ne veut pas dire absence de besoin en eau."], observe: "Le sol, la saison et le climat changent les conditions d’une observation." },
    { points: ["Un intérêt écologique doit préciser un critère, un lieu et une période.", "Suver Haze : pomme verte et poivre, d’après sa fiche.", "Ces notes aromatiques ne prouvent aucune propriété écologique."], observe: "Séparez ce qui décrit une fiche de ce qui décrit un écosystème." },
  ]),
  visual("law", "Planche illustrée de chanvre, de graines et de documents, évoquant des règles distinctes selon les produits et les usages.", "France et Union européenne : repères vérifiés le 11 novembre 2026.", [
    { points: ["Une règle dépend du territoire, de la date, du produit et de l’usage.", "L’arrêté français vise notamment des variétés inscrites et un seuil de THC de 0,30 %.", "Ce seuil n’autorise pas, à lui seul, tous les produits et tous les usages."], observe: "Une plante, une graine et un produit fini ne posent pas la même question juridique." },
    { points: ["En 2022, le Conseil d’État annule l’interdiction générale des fleurs et feuilles concernées.", "Il faut lire le texte initial avec les décisions ultérieures.", "Les conditions d’une aide PAC ne valent pas autorisation de tous les produits."], observe: "La date et la portée d’un document sont aussi importantes que son titre." },
    { points: ["En mai 2026, le ministère rappelle l’absence d’autorisation des aliments avec CBD ajouté.", "Graines et huile de graines relèvent d’une situation distincte, sous conditions.", "La présence en rayon ne suffit pas à prouver la conformité."], observe: "Vérifiez les ingrédients exacts avant de comparer deux produits." },
    { points: ["Vente licite et conduite après usage de THC relèvent de règles distinctes.", "Une étiquette CBD ne garantit pas un dépistage négatif.", "Pour une situation réelle, consultez les textes actuels et les autorités compétentes."], observe: "Demandez toujours : quelle règle, pour quel usage, à quelle date ?" },
  ]),
  visual("prevention", "Planche illustrée de chanvre et de produits étiquetés, accompagnée de repères visuels de vigilance et de conseil.", "Une étiquette ou une origine végétale ne suffit pas à établir la sécurité.", [
    { points: ["Naturel ne signifie pas sans risque.", "Le CBD peut provoquer des effets indésirables, dont la somnolence.", "Un nom de variété ou un arôme ne prédit pas les risques personnels."], observe: "Une présentation rassurante ne remplace pas une information fiable." },
    { points: ["Le CBD peut modifier l’efficacité ou les effets indésirables de certains médicaments.", "Parlez des produits utilisés à votre médecin ou votre pharmacien.", "Ne modifiez pas seul un traitement prescrit."], observe: "La bonne question porte aussi sur les autres produits et traitements utilisés." },
    { points: ["Des produits présentés comme CBD peuvent contenir des substances non annoncées.", "Gardez ces produits hors de portée des enfants ; conservez les références en cas de problème.", "Effet indésirable : arrêtez le produit et demandez conseil. Urgence grave : 15 ou 112."], observe: "Une étiquette aide à identifier un produit ; elle ne garantit pas sa composition réelle." },
    { points: ["Un témoignage favorable ne prouve pas une efficacité médicale.", "Un produit de bien-être ne remplace pas un médicament autorisé et suivi.", "Lifter : myrtille et fromage, d’après sa fiche ; aucune promesse de soin."], observe: "Dites ce que l’information établit, puis ce qu’elle ne permet pas de conclure." },
  ]),
];

export function getKqSchoolLessonVisual(courseId: string): KqSchoolLessonVisual | undefined {
  return KQ_SCHOOL_LESSON_VISUALS.find(item => item.courseId === courseId);
}
