import type { HistorySource } from "./kanab-quest-school-history-types";

export type CultivationEnvironment = "outdoor" | "greenhouse" | "indoor";
export type CultivationMedium = "soil" | "substrate" | "water";
export type CultivationAxis = "light" | "climate" | "water" | "nutrition" | "energy" | "work" | "risks" | "quality" | "costs" | "performance";
export type CultivationSystem = Readonly<{
  id: string; name: string; environment: CultivationEnvironment; medium: CultivationMedium;
  cover?: string; controlLevel?: string; summary: string;
  traits: Readonly<Record<CultivationAxis, string>>;
  advantages: readonly string[]; constraints: readonly string[]; sourceIds: readonly string[];
}>;
export type CultivationCase = Readonly<{
  id: string; title: string; fictional: true; scenario: string;
  constraints: readonly string[]; question: string;
  options: readonly Readonly<{
    systemId: string; fit: "coherent" | "conditional" | "poor-fit";
    explanation: string; conditions: readonly string[];
  }>[];
  sourceIds: readonly string[];
}>;
export type CultivationBalance = Readonly<{
  fictional: true; functionalUnit: string; boundary: string; assumptions: readonly string[];
  rows: readonly Readonly<{
    id: string; label: string; energyKwh: number; emissionsKgCo2e: number;
    outputKg: number; energyPerKg: number; electricityFactorKgCo2ePerKwh: number;
  }>[];
  limits: readonly string[]; sourceIds: readonly string[];
}>;
export type CultivationGuideEntry = Readonly<{
  id: string; title: string; objective: string; systems: readonly string[];
  questions: readonly string[]; limits: string; sourceIds: readonly string[];
}>;
export type CultivationSimulationChoices = Readonly<{
  environment: CultivationEnvironment; medium: CultivationMedium;
  weather: "cool-humid" | "hot-dry" | "mild";
  resources: "water-limited" | "energy-limited" | "available";
  purpose: "fibre-seed" | "education" | "research";
}>;
export type CultivationSimulationResult = Readonly<{
  title: string; observations: readonly string[]; tensions: readonly string[];
  assumptions: readonly string[]; limits: readonly string[]; sourceIds: readonly string[];
}>;

export const CULTIVATION_SYSTEM_SOURCES: readonly HistorySource[] = [
  {
    id: "cultivation-system-missouri-2024", title: "Controlled Environment Agriculture: Hydroponic Farming", organization: "University of Missouri Extension",
    author: "Juan Cabrera-Garcia, Ryan Milhollin et Matt Ernst", published: "2024-07 (révision)", verifiedAt: "2026-11-12",
    url: "https://extension.missouri.edu/publications/g6986", access: "full-text", documentKind: "Guide universitaire G6986",
    passage: "Définition de l’agriculture en environnement contrôlé ; systèmes avec substrat ou à base d’eau ; circuits ouverts et fermés ; avantages et difficultés.",
    limitation: "Guide horticole général. Les catégories décrivent des équipements, pas un classement expérimental du chanvre ni une garantie économique.",
  },
  {
    id: "cultivation-system-media-2025", title: "Potting Media: Components and Handling", organization: "Iowa State University Extension and Outreach",
    author: "Randall Vos", published: "2025-03-10", verifiedAt: "2026-11-12",
    url: "https://yardandgarden.extension.iastate.edu/article/2025/03/potting-media-components-and-handling", access: "full-text", documentKind: "Article universitaire de vulgarisation",
    passage: "Differences Between Soil and Potting Media ; Components ; Containers : eau, pores remplis d’air et géométrie des récipients.",
    limitation: "Exemples de plantes en pot, non essai comparatif sur le chanvre. Les proportions et pratiques proposées ne sont pas transposées en recette.",
  },
  {
    id: "cultivation-system-humidity-umass", title: "Reducing Humidity in the Greenhouse", organization: "UMass Extension / University of Connecticut",
    author: "Tina Smith et John W. Bartok, Jr.", published: "Date de la fiche non indiquée ; reprise dans Floral Notes, janvier–février 2016", verifiedAt: "2026-11-12",
    url: "https://www.umass.edu/agriculture-food-environment/greenhouse-floriculture/fact-sheets/reducing-humidity-in-greenhouse", access: "excerpt", documentKind: "Fiche universitaire, passages indexés consultés",
    passage: "Introduction ; Relationship Between Temperature and Humidity ; Ventilation and Heating ; Air Movement. Attribution vérifiée dans la reprise institutionnelle Floral Notes.",
    limitation: "Accès direct refusé par le serveur ; texte indexé consulté. Seuls les principes physiques sont retenus, sans réglage, fréquence, coût ancien ni conseil phytosanitaire.",
  },
  {
    id: "cultivation-system-barbosa-2015", title: "Comparison of Land, Water, and Energy Requirements of Lettuce Grown Using Hydroponic vs. Conventional Agricultural Methods", organization: "International Journal of Environmental Research and Public Health",
    author: "Guilherme Lages Barbosa et al.", published: "2015-06-16", verifiedAt: "2026-11-12",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4483736/", access: "full-text", documentKind: "Étude originale de modélisation, DOI 10.3390/ijerph120606879",
    passage: "Résumé et méthodes : laitue à Yuma, Arizona ; données agricoles conventionnelles et installation hydroponique théorique calculée.",
    limitation: "La comparaison associe statistiques agricoles et modèle d’ingénierie, pas deux essais expérimentaux parallèles. Aucun chiffre n’est transféré au chanvre.",
  },
  {
    id: "cultivation-system-lca-us-2025", title: "The challenges of controlled environment hydroponic farming: a life cycle assessment of lettuce", organization: "The International Journal of Life Cycle Assessment",
    author: "Aline Banboukian, Yongsheng Chen et Valerie M. Thomas", published: "2025-05-13", verifiedAt: "2026-11-12",
    url: "https://link.springer.com/article/10.1007/s11367-025-02463-6", access: "full-text", documentKind: "Analyse de cycle de vie originale",
    passage: "Sections 2.1–2.3 et 3.2.1 : unité de 1 kg de laitue ; champ, tunnel modélisé et hydroponie éclairée ; scénarios énergétiques et de transport.",
    limitation: "Étude américaine. Le périmètre comprend le transport vers le marché malgré l’étiquette cradle-to-gate ; le tunnel est supposé sans électricité ni combustible. Ces hypothèses ne valent pas pour toute serre.",
  },
  {
    id: "cultivation-system-lca-finland-2024", title: "Assessment of climate change impact and resource-use efficiency of lettuce production in vertical farming and greenhouse production in Finland: a case study", organization: "The International Journal of Life Cycle Assessment",
    author: "Katri Joensuu, Titta Kotilainen, Kati Räsänen, Marja Rantanen, Kirsi Usva et Frans Silvenius", published: "2024-08-01", verifiedAt: "2026-11-12",
    url: "https://link.springer.com/article/10.1007/s11367-024-02343-5", access: "full-text", documentKind: "Analyse de cycle de vie originale",
    passage: "Sections 2.1–2.2 et résultats : 1 kg de laitue fraîche comestible, production verticale finlandaise et référence de serre ; variantes d’énergie et de récupération de chaleur.",
    limitation: "Un site vertical (données 2018–2020) comparé à une référence de serre antérieure. Périmètre comprenant notamment équipements, intrants, emballage et stockage temporaire sur place ; ni essai contrôlé ni résultat universel.",
  },
  {
    id: "cultivation-system-hemp-2026", title: "Chanvre — Guide de culture 2026", organization: "Terres Inovia",
    author: "Louis-Marie Allard et contributeurs ; coordination I. Lartigot", published: "2026-01", verifiedAt: "2026-11-12",
    url: "https://www.terresinovia.fr/sites/default/files/2026-01/guide_culture_chanvre_2026.pdf", access: "full-text", documentKind: "Guide technique institutionnel",
    passage: "Pages 8–9 : contractualisation, débouché, variétés et distinction des objectifs paille et graine ; sommaire des risques et de l’irrigation.",
    limitation: "Passages pertinents du PDF consultés. Ni les slogans absolus sur l’absence d’eau ou de risques, ni les rendements, prix et itinéraires techniques ne sont repris dans ces scénarios fictifs.",
  },
  {
    id: "cultivation-system-france-hemp", title: "Arrêté du 30 décembre 2021 portant application de l’article R. 5132-86 du code de la santé publique", organization: "Légifrance",
    author: "Ministres chargés de la santé, de l’agriculture, des comptes publics et de l’industrie", published: "JORF du 2021-12-31 ; arrêté du 30 décembre ; version consolidée après le 2022-12-29", verifiedAt: "2026-11-12",
    url: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000044793213/", access: "official-page", documentKind: "Texte réglementaire consolidé",
    passage: "Article 1, I (variétés de Cannabis sativa L., seuil et catalogues), II annulé, III (produits et règles alimentaires) ; dispositions sur les fleurs, feuilles, plants et bouturage.",
    limitation: "Vérification limitée du cadre français à la date indiquée. Le seuil variétal de 0,30 % de Δ9-THC ne constitue pas une autorisation générale de tout produit, usage ou commercialisation.",
  },
  {
    id: "cultivation-system-france-research", title: "Code de la santé publique, article R5132-86", organization: "Légifrance",
    author: "Pouvoir réglementaire français", published: "Version entrée en vigueur le 2022-03-01", verifiedAt: "2026-11-12",
    url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045186766", access: "official-page", documentKind: "Article réglementaire consolidé",
    passage: "VII : dérogations possibles aux fins de recherche et de contrôle par le directeur général de l’ANSM.",
    limitation: "La finalité pédagogique ou scientifique ne vaut pas autorisation automatique. Les dossiers supposent leur cadre vérifié ; ils ne décrivent pas de démarche d’autorisation.",
  },
];

export const CULTIVATION_SYSTEMS: readonly CultivationSystem[] = [
  {
    id: "outdoor-soil", name: "Plein air · pleine terre", environment: "outdoor", medium: "soil", controlLevel: "Exposition à la météo",
    summary: "Le sol en place et la saison structurent le système.",
    traits: {
      light: "Soleil, avec variations saisonnières et ombrages.", climate: "Pluie, vent et températures extérieures.", water: "Pluie et réserves du sol ; disponibilité à documenter.", nutrition: "Réserves, activité biologique et apports éventuels du sol.",
      energy: "Pas de lumière artificielle par définition ; autres consommations possibles.", work: "Opérations de terrain et organisation des récoltes.", risks: "Aléas météorologiques et sanitaires ; hétérogénéité du terrain.", quality: "Critères liés au débouché et à la récolte.", costs: "Foncier, matériel et travail à compter, même sans bâtiment.", performance: "À mesurer pour une surface, une durée et un produit définis.",
    },
    advantages: ["Évite de construire un milieu aérien complet.", "Relie les observations au sol et à la saison."],
    constraints: ["La météo reste une variable extérieure.", "La fibre et la graine ne sont pas une qualité unique."],
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-hemp-2026"],
  },
  {
    id: "outdoor-substrate", name: "Plein air · pots et substrat", environment: "outdoor", medium: "substrate", controlLevel: "Racines délimitées, météo extérieure",
    summary: "Un pot change le milieu racinaire, pas la météo.",
    traits: {
      light: "Lumière naturelle et ombrages locaux.", climate: "Exposition extérieure conservée.", water: "Réserve liée au matériau et au récipient.", nutrition: "Dépend de la composition du substrat et des apports.", energy: "Manutention et équipements éventuels à inclure.", work: "Pots, déplacements et observation des contenants.", risks: "Dessèchement ou manque d’air aux racines possibles.", quality: "Des récipients semblables ne garantissent pas des plantes identiques.", costs: "Contenants, matériaux, renouvellement et travail.", performance: "Un résultat par pot ne devient pas un résultat par hectare.",
    },
    advantages: ["Rend le contenant observable et déplaçable.", "Permet de comparer des milieux dans un même lieu."],
    constraints: ["La géométrie du pot modifie la répartition air–eau.", "Les matériaux ont une origine et une fin de vie."],
    sourceIds: ["cultivation-system-media-2025", "cultivation-system-missouri-2024"],
  },
  {
    id: "tunnel-soil", name: "Tunnel non chauffé · pleine terre", environment: "greenhouse", medium: "soil", cover: "Film, dans cet exemple", controlLevel: "Protection passive ; pas de chauffage supposé",
    summary: "Un abri solaire simple, avec le sol en place.",
    traits: {
      light: "Soleil transmis par la couverture.", climate: "Protection partielle ; échauffement et froid restent possibles.", water: "La couverture modifie l’arrivée directe de pluie.", nutrition: "Fonctionnement du sol et apports éventuels.", energy: "Absence de chauffage supposée, pas absence de toute énergie.", work: "Suivi de l’abri et de ses ouvertures.", risks: "Condensation, surchauffe, vent et risques du sol.", quality: "Protection ne signifie ni stérilité ni qualité garantie.", costs: "Structure et remplacement du film, parmi les charges.", performance: "Comparer des saisons et produits équivalents.",
    },
    advantages: ["Abri sans supposer un contrôle climatique complet.", "Conserve l’étude du sol en place."],
    constraints: ["Le tunnel appartient ici à la catégorie serre.", "L’hypothèse sans chauffage doit rester explicite."],
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-humidity-umass", "cultivation-system-lca-us-2025"],
  },
  {
    id: "greenhouse-soil", name: "Serre · pleine terre", environment: "greenhouse", medium: "soil", cover: "Parois transparentes ou translucides", controlLevel: "Variable selon les équipements",
    summary: "Une enveloppe au-dessus d’un sol ; les équipements restent à préciser.",
    traits: {
      light: "Lumière solaire transmise ; appoint éventuel à déclarer.", climate: "Échanges avec l’extérieur, contrôle plus ou moins actif.", water: "Entrées, stockage dans le sol et pertes à distinguer.", nutrition: "La serre ne remplace pas les propriétés du sol.", energy: "Chauffage, éclairage ou ventilation : présents seulement si décrits.", work: "Suivi des plantes, du sol et de l’enveloppe.", risks: "Condensation et défauts d’équipement possibles.", quality: "Protection et régularité à vérifier par des mesures.", costs: "Investissement et fonctionnement à séparer.", performance: "Le mot serre ne renseigne pas le rendement.",
    },
    advantages: ["Associe abri et continuité avec le sol.", "Permet de décrire séparément climat et racines."],
    constraints: ["Serre chauffée et serre passive ne sont pas interchangeables.", "Un bac visible ne prouve pas une culture en pleine terre."],
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-humidity-umass", "cultivation-system-lca-finland-2024"],
  },
  {
    id: "greenhouse-substrate", name: "Serre · substrat en contenant", environment: "greenhouse", medium: "substrate", cover: "Parois transparentes ou translucides", controlLevel: "Climat et milieu racinaire à décrire séparément",
    summary: "L’abri et le contenant constituent deux choix différents.",
    traits: {
      light: "Soleil transmis, appoint possible mais non présumé.", climate: "Dépend de la serre, pas du nom du substrat.", water: "Rétention du matériau ; drainage récupéré ou rejeté à préciser.", nutrition: "Matériau plus ou moins réactif ; apports à documenter.", energy: "Bâtiment et équipements hydrauliques éventuels.", work: "Surveillance, manutention et gestion des matériaux.", risks: "Excès d’eau, défaut d’alimentation ou contamination possibles.", quality: "La traçabilité du lot ne remplace pas les contrôles du produit.", costs: "Contenants, substrat et fonctionnement de l’abri.", performance: "Comparer aussi pertes, durée et charge de travail.",
    },
    advantages: ["Sépare sol local et matériau de culture.", "Offre un support d’observation du contenant."],
    constraints: ["Un substrat n’est pas nécessairement inerte.", "Hors-sol ne signifie pas automatiquement circuit fermé."],
    sourceIds: ["cultivation-system-media-2025", "cultivation-system-missouri-2024", "cultivation-system-lca-finland-2024"],
  },
  {
    id: "greenhouse-water", name: "Serre · sans substrat solide", environment: "greenhouse", medium: "water", cover: "Parois transparentes ou translucides", controlLevel: "Enveloppe et circuit racinaire distincts",
    summary: "Les racines accèdent à une solution ; un support mécanique reste possible.",
    traits: {
      light: "Lumière solaire transmise, appoint à préciser.", climate: "Le circuit d’eau n’élimine pas le climat de serre.", water: "Volumes prélevés, recirculés et rejetés distincts.", nutrition: "Éléments dissous dans la solution.", energy: "Équipements du bâtiment et du circuit à inventorier.", work: "Suivi de la solution, des racines et des installations.", risks: "Défaillance du circuit ou diffusion d’une contamination.", quality: "Absence de sol ne signifie pas absence de contaminants.", costs: "Installation, maintenance et compétences spécialisées.", performance: "L’économie d’eau dépend du circuit et du bilan mesuré.",
    },
    advantages: ["Rend explicite le circuit qui alimente les racines.", "Permet d’étudier séparément prélèvement et réutilisation."],
    constraints: ["Recirculation et qualité de l’eau ne se déduisent pas du nom.", "Oxygénation racinaire et continuité du service restent à considérer."],
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-barbosa-2015"],
  },
  {
    id: "indoor-substrate", name: "Intérieur · substrat en contenant", environment: "indoor", medium: "substrate", cover: "Local opaque dans cet exemple", controlLevel: "Lumière artificielle et ambiance créée",
    summary: "Le bâtiment crée l’environnement lumineux ; le substrat reste un autre choix.",
    traits: {
      light: "Artificielle dans le local opaque défini ici.", climate: "Chaleur et vapeur à gérer ; météo extérieure encore pertinente.", water: "Réserves des contenants et circuit éventuel.", nutrition: "Dépend des matériaux et des apports.", energy: "Éclairage et ambiance pèsent dans le bilan.", work: "Suivi des plantes, du matériel et des alarmes.", risks: "Dépendance électrique ; contamination toujours possible.", quality: "Conditions suivies ne suffisent pas à prouver la qualité.", costs: "Équipements, exploitation, entretien et travail.", performance: "Surface au sol et surface cultivée peuvent différer.",
    },
    advantages: ["Réduit certaines variations lumineuses extérieures.", "Peut répondre à une question expérimentale bien définie."],
    constraints: ["Mesurer l’énergie et préciser son origine.", "Un résultat sur laitue ne prédit pas celui du chanvre."],
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-media-2025", "cultivation-system-lca-us-2025", "cultivation-system-lca-finland-2024"],
  },
  {
    id: "indoor-water", name: "Intérieur · sans substrat solide", environment: "indoor", medium: "water", cover: "Local opaque dans cet exemple", controlLevel: "Ambiance créée et circuit racinaire équipé",
    summary: "Deux dépendances techniques se combinent : ambiance et solution racinaire.",
    traits: {
      light: "Artificielle, comme dans l’autre intérieur présenté.", climate: "Échanges thermiques et humidité à considérer.", water: "Réemploi possible, pertes et rejets toujours à compter.", nutrition: "Éléments dissous ; circuit ouvert ou fermé à préciser.", energy: "Éclairage, ambiance et équipements du circuit.", work: "Maintenance et observation des deux ensembles.", risks: "Pannes et contaminations ne disparaissent pas sous contrôle.", quality: "Évaluer le produit selon son usage, sans présumer sa supériorité.", costs: "Charges fixes et variables, sans prix universel.", performance: "Un gain sur un indicateur peut déplacer une autre charge.",
    },
    advantages: ["Facilite la description de certains flux contrôlés.", "Peut servir à des observations encadrées en recherche."],
    constraints: ["Moins de prélèvement d’eau ne prouve pas moins d’émissions.", "Le bilan dépend aussi du climat et de l’électricité."],
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-barbosa-2015", "cultivation-system-lca-us-2025", "cultivation-system-lca-finland-2024"],
  },
];

export const CULTIVATION_CASES: readonly CultivationCase[] = [
  {
    id: "brittany-fibre-seed", title: "En Bretagne, préparer un débouché fibre ou graine", fictional: true,
    scenario: "Une exploitation fictive dispose d’une parcelle et envisage du chanvre industriel. Elle doit encore choisir entre deux débouchés annoncés : paille pour fibres ou graines avec valorisation de la paille. Le contrat et les moyens de récolte restent à préciser.",
    constraints: ["Cadre fictif : professionnel, variété et usage permis, semences certifiées ; aucune culture réelle n’est autorisée par ce dossier.", "Objectif de production de matière, dépenses énergétiques limitées et matériel existant.", "Ni prix, ni rendement, ni météo bretonne précise ne sont fournis.", "La conformité variétale ne garantit pas à elle seule la conformité de tous les produits commercialisés."],
    question: "Quel système correspond au projet, et quelles informations manquent avant de choisir le débouché ?",
    options: [
      { systemId: "outdoor-soil", fit: "coherent", explanation: "La parcelle existante correspond au projet de matière. Deux orientations restent défendables : fibres prioritaires ou graines et paille, selon le contrat et les moyens disponibles.", conditions: ["Définir le produit attendu et les critères du transformateur.", "Examiner le sol, les aléas et la logistique sans inventer une marge."] },
      { systemId: "outdoor-substrate", fit: "conditional", explanation: "Des pots peuvent servir à une démonstration annexe ; ils ne répondent pas seuls au projet de production en parcelle.", conditions: ["Annoncer le changement d’objectif vers l’observation.", "Ne pas extrapoler un résultat par pot à la parcelle."] },
      { systemId: "indoor-water", fit: "poor-fit", explanation: "Créer un local équipé s’accorde mal avec le matériel de terrain déjà disponible et la contrainte énergétique annoncée.", conditions: ["Cette conclusion appartient au dossier ; elle ne classe pas tous les usages de l’intérieur."] },
    ],
    sourceIds: ["cultivation-system-hemp-2026", "cultivation-system-france-hemp", "cultivation-system-missouri-2024"],
  },
  {
    id: "teaching-nursery", title: "Une pépinière pédagogique encadrée", fictional: true,
    scenario: "Une structure fictive, dont le cadre légal a été vérifié, observe des plantes de chanvre issues de semences certifiées. Elle dispose d’une serre, de contenants et d’un petit espace extérieur. Aucune vente de plants ni aucun bouturage ne sont prévus.",
    constraints: ["La seule intention pédagogique ne crée aucune autorisation ; le cadre applicable est supposé vérifié avant l’exercice.", "L’objectif est d’observer les relations entre récipient, eau, air et météo, pas de produire une substance.", "Présence encadrante et accessibilité des observations prioritaires ; équipements limités."],
    question: "Veut-on comparer les contenants sous un même abri ou observer leur exposition à la météo ?",
    options: [
      { systemId: "greenhouse-substrate", fit: "coherent", explanation: "Choix cohérent pour comparer les contenants dans la serre existante en décrivant aussi ses variations de climat.", conditions: ["Garder un objectif d’observation clairement formulé.", "Ne pas appeler la serre un environnement parfaitement constant."] },
      { systemId: "outdoor-substrate", fit: "coherent", explanation: "Choix cohérent si la question porte sur les contenants exposés à la saison ; il répond à un autre objectif pédagogique explicite.", conditions: ["Accepter et documenter la variabilité météorologique.", "Conserver une observation accessible et encadrée."] },
      { systemId: "greenhouse-water", fit: "conditional", explanation: "Peut illustrer un circuit racinaire, mais ajoute une dépendance matérielle qui n’est pas nécessaire pour comprendre un pot.", conditions: ["Compétences, suivi et matériel déjà disponibles.", "Ne pas promettre une économie d’eau sans bilan."] },
    ],
    sourceIds: ["cultivation-system-media-2025", "cultivation-system-missouri-2024", "cultivation-system-france-hemp", "cultivation-system-france-research"],
  },
  {
    id: "research-station", title: "Une station de recherche autorisée", fictional: true,
    scenario: "Une équipe fictive dispose d’une autorisation adaptée et étudie la variabilité d’observations végétales. Elle hésite entre une question sous lumière solaire et une question dans une ambiance artificielle suivie. Elle ne cherche pas à augmenter une teneur en substance contrôlée.",
    constraints: ["Autorisation et périmètre de recherche supposés vérifiés ; aucune dérogation implicite.", "La question scientifique doit précéder le choix de l’équipement.", "Comparaisons avec témoins et répétitions, mesures et limites de généralisation à annoncer.", "Budget, travail et consommation doivent rester observables, sans prévision chiffrée inventée."],
    question: "Quelle question veut-on isoler, et à quel contexte souhaite-t-on ensuite généraliser ?",
    options: [
      { systemId: "greenhouse-substrate", fit: "coherent", explanation: "Convient à une question impliquant la lumière solaire transmise, avec un milieu en contenant défini.", conditions: ["Mesurer les variations de l’abri.", "Ne pas présenter le résultat comme celui d’un champ ni d’un local opaque."] },
      { systemId: "indoor-substrate", fit: "coherent", explanation: "Convient à une question nécessitant de définir la lumière artificielle et l’ambiance, sans changer simultanément le milieu choisi.", conditions: ["Décrire ce qui est contrôlé et ce qui varie encore.", "Inclure les contraintes d’énergie et de maintenance."] },
      { systemId: "greenhouse-water", fit: "conditional", explanation: "Pertinent si le circuit racinaire est lui-même l’objet d’étude ; le changer brouillerait une comparaison portant uniquement sur l’environnement aérien.", conditions: ["Déclarer la variable étudiée.", "Éviter d’attribuer à la seule lumière plusieurs changements simultanés."] },
    ],
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-france-research", "cultivation-system-lca-finland-2024"],
  },
];

export const CULTIVATION_BALANCE: CultivationBalance = {
  fictional: true,
  functionalUnit: "1 kg de biomasse aérienne sèche ; chaque lot fictif fournit 12 kg.",
  boundary: "Électricité de fonctionnement de la phase de culture uniquement, pour trois lots fictifs comparables ; émissions associées calculées avec des facteurs également fictifs.",
  assumptions: ["A, B et C ne correspondent à aucun système réel ni à une mesure publiée.", "La masse sèche sert de dénominateur commun connu dans l’exercice ; elle n’est pas un rendement prédit.", "Émissions = kWh × facteur fictif ; intensité électrique = kWh ÷ kg. Un facteur n’est pas le mix électrique français."],
  rows: [
    { id: "a", label: "Lot A", energyKwh: 120, emissionsKgCo2e: 48, outputKg: 12, energyPerKg: 10, electricityFactorKgCo2ePerKwh: 0.4 },
    { id: "b", label: "Lot B", energyKwh: 240, emissionsKgCo2e: 24, outputKg: 12, energyPerKg: 20, electricityFactorKgCo2ePerKwh: 0.1 },
    { id: "c", label: "Lot C", energyKwh: 180, emissionsKgCo2e: 72, outputKg: 12, energyPerKg: 15, electricityFactorKgCo2ePerKwh: 0.4 },
  ],
  limits: ["Ce bilan partiel n’est pas une analyse de cycle de vie complète.", "Exclus : bâtiment, équipements, matériaux, fabrication des intrants, émissions du sol, eau, combustibles, transport et opérations après récolte, dont séchage.", "Les kg CO₂e ne mesurent ni la consommation d’eau, ni la biodiversité, ni la qualité du produit.", "Les études citées éclairent la méthode ; elles ne fournissent aucun des nombres fictifs de ce tableau."],
  sourceIds: ["cultivation-system-lca-us-2025", "cultivation-system-lca-finland-2024"],
};

export const CULTIVATION_GUIDE: readonly CultivationGuideEntry[] = [
  {
    id: "objective-fibre-seed", title: "Produire de la fibre ou de la graine", objective: "Relier le système à un débouché industriel défini.",
    systems: ["outdoor-soil"],
    questions: ["Le projet utilise-t-il une parcelle et des moyens de récolte existants ?", "Quel débouché prime : fibre, graine ou deux valorisations distinctes ?", "Quelles exigences et quelle logistique le transformateur annonce-t-il ?"],
    limits: "Dans le dossier breton fictif, la pleine terre correspond aux moyens annoncés. Le choix entre deux débouchés reste ouvert ; ce constat n’est ni une garantie de rentabilité ni une prescription pour toute exploitation.",
    sourceIds: ["cultivation-system-hemp-2026", "cultivation-system-france-hemp"],
  },
  {
    id: "objective-education", title: "Observer et apprendre", objective: "Rendre une différence visible dans un cadre pédagogique autorisé.",
    systems: ["greenhouse-substrate", "outdoor-substrate", "greenhouse-water"],
    questions: ["Étudie-t-on le contenant sous un même abri ou son exposition à la météo ?", "Le dispositif est-il lisible, accessible et encadré ?", "Un circuit technique apporte-t-il une observation utile, avec les moyens de suivi disponibles ?"],
    limits: "La serre en pots et les pots dehors répondent à deux questions recevables. Un circuit sans substrat solide reste une option conditionnelle, pas un équipement indispensable pour apprendre. L’intention pédagogique ne vaut pas autorisation.",
    sourceIds: ["cultivation-system-media-2025", "cultivation-system-missouri-2024", "cultivation-system-france-hemp"],
  },
  {
    id: "objective-research", title: "Répondre à une question scientifique", objective: "Choisir le degré de contrôle utile à une comparaison autorisée.",
    systems: ["greenhouse-substrate", "indoor-substrate", "greenhouse-water"],
    questions: ["La lumière solaire fait-elle partie de la question ou doit-elle être remplacée par une ambiance artificielle décrite ?", "Change-t-on seulement la variable annoncée ?", "À quel contexte le résultat pourra-t-il être généralisé ?"],
    limits: "La serre et le local opaque peuvent chacun être cohérents selon la question. Changer aussi le milieu racinaire modifie la comparaison. Témoins, répétitions et mesures restent nécessaires ; aucune autorisation scientifique n’est implicite.",
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-france-research"],
  },
  {
    id: "two-axes", title: "Décrire avant de comparer", objective: "Séparer l’environnement aérien du milieu racinaire.",
    systems: CULTIVATION_SYSTEMS.map((system) => system.id),
    questions: ["Plein air, serre ou local opaque ?", "Sol en place, substrat en contenant ou racines sans substrat solide ?", "Quels équipements et quel circuit d’eau sont réellement présents ?"],
    limits: "Ici, « sol » désigne la pleine terre et « substrat » un matériau en contenant. En botanique, le sol est aussi un substrat. L’hydroponie peut utiliser un matériau solide ; « sans substrat solide » n’est donc pas synonyme de toute hydroponie. Les huit exemples ne couvrent pas toutes les combinaisons.",
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-media-2025"],
  },
  {
    id: "product", title: "Nommer le résultat recherché", objective: "Choisir un indicateur adapté au débouché ou à la question.",
    systems: ["outdoor-soil", "greenhouse-substrate", "indoor-substrate"],
    questions: ["Fibre, graine ou observation pédagogique ?", "Quelle qualité faut-il vérifier ?", "Quelle unité, quelle durée et quelles pertes sont prises en compte ?"],
    limits: "Un volume de récolte, une composition, une régularité et une valeur commerciale ne sont pas le même résultat. Aucun rendement ni prix n’est prédit ici.",
    sourceIds: ["cultivation-system-hemp-2026", "cultivation-system-lca-us-2025"],
  },
  {
    id: "resources", title: "Suivre les flux et le travail", objective: "Repérer les charges déplacées par un choix technique.",
    systems: ["tunnel-soil", "greenhouse-water", "indoor-water"],
    questions: ["Eau prélevée, réutilisée ou rejetée ?", "Énergie consommée et origine de l’électricité ?", "Qui surveille et entretient les équipements ?"],
    limits: "Un circuit fermé peut réduire certains prélèvements sans supprimer pertes, traitement, travail ou impacts. Aucun système n’est automatiquement économe sur tous les critères.",
    sourceIds: ["cultivation-system-missouri-2024", "cultivation-system-barbosa-2015", "cultivation-system-lca-finland-2024"],
  },
  {
    id: "comparison", title: "Comparer le même périmètre", objective: "Vérifier ce qu’un bilan inclut et ce qu’il omet.",
    systems: ["outdoor-soil", "tunnel-soil", "indoor-substrate", "indoor-water"],
    questions: ["Même produit et même unité fonctionnelle ?", "Bâtiment, intrants, transport et après-récolte inclus ?", "Données mesurées, hypothèses ou chiffres fictifs ?"],
    limits: "Les ACV américaines et finlandaises de laitue consultées diffèrent par leur climat, leurs données et leur périmètre. Elles n’établissent pas un classement universel du chanvre.",
    sourceIds: ["cultivation-system-lca-us-2025", "cultivation-system-lca-finland-2024"],
  },
  {
    id: "scope", title: "Vérifier le cadre du projet", objective: "Distinguer un exercice fictif d’une autorisation réelle.",
    systems: CULTIVATION_SYSTEMS.map((system) => system.id),
    questions: ["Quel pays, quelle date, quelle variété et quel usage ?", "Le cadre professionnel ou scientifique requis est-il vérifié ?", "Quelles règles s’ajoutent pour le produit et sa destination ?"],
    limits: "France, vérification limitée au 12 novembre 2026 : l’arrêté encadre des variétés de Cannabis sativa L. inscrites et un seuil de Δ9-THC. Cela n’autorise pas tout produit. L’intention pédagogique ou scientifique ne remplace pas les autorisations applicables ; les scénarios les supposent acquises.",
    sourceIds: ["cultivation-system-france-hemp", "cultivation-system-france-research"],
  },
];

/** A deterministic reasoning aid, not an agronomic forecast or a cultivation protocol. */
export function simulateCultivationScenario(choices: CultivationSimulationChoices): CultivationSimulationResult {
  const observations: string[] = [];
  const tensions: string[] = [];
  const sourceIds = new Set(["cultivation-system-missouri-2024"]);
  const environmentNotes: Record<CultivationEnvironment, string> = {
    outdoor: "En plein air, la météo agit directement ; un changement de milieu racinaire ne crée pas un abri.",
    greenhouse: "La serre transmet la lumière solaire et modifie les échanges ; son équipement reste inconnu.",
    indoor: "Le local est supposé opaque et éclairé artificiellement ; il échange encore chaleur et air avec son environnement.",
  };
  const mediumNotes: Record<CultivationMedium, string> = {
    soil: "Le sol en place possède ses propres réserves et variations ; elles ne sont pas connues dans ce scénario.",
    substrate: "Le matériau et le contenant modifient la réserve en eau et les pores remplis d’air.",
    water: "Les racines sont supposées sans substrat solide principal ; circuit ouvert ou recirculé reste à préciser.",
  };
  observations.push(environmentNotes[choices.environment], mediumNotes[choices.medium]);
  if (choices.medium === "substrate") sourceIds.add("cultivation-system-media-2025");
  if (choices.weather === "cool-humid") {
    observations.push(choices.environment === "outdoor"
      ? "Le contexte frais et humide invite à observer pluie, humidité locale et état du sol ; il ne prouve ni maladie ni excès d’eau."
      : "Dans ce contexte frais et humide, une paroi froide peut atteindre le point de rosée ; il manque les températures et l’humidité réelles pour conclure.");
    if (choices.environment !== "outdoor") tensions.push("Un ventilateur qui brasse l’air ne prouve pas une évacuation de vapeur : échange d’air et brassage sont distincts.");
    sourceIds.add("cultivation-system-humidity-umass");
  } else if (choices.weather === "hot-dry") {
    observations.push(choices.environment === "outdoor"
      ? "Un contexte chaud et sec peut accentuer la tension sur l’eau ; la réserve réelle et la durée de l’épisode manquent."
      : "Un extérieur chaud et sec modifie les échanges de chaleur et d’humidité du bâtiment ; il ne décrit pas directement l’ambiance des plantes.");
    tensions.push("La météo seule ne permet de calculer ni besoin d’eau, ni réglage climatique.");
  } else {
    observations.push("Une météo dite douce ne signifie ni stabilité permanente ni absence de risque.");
  }
  if (choices.resources === "water-limited") {
    tensions.push(choices.medium === "water"
      ? "Réutiliser de l’eau peut répondre à la contrainte, mais il faut distinguer prélèvement, circulation, pertes et rejets."
      : "Le bilan d’eau manque : pluie accessible, réserve du milieu, prélèvements et pertes ne sont pas renseignés.");
    sourceIds.add("cultivation-system-barbosa-2015");
  } else if (choices.resources === "energy-limited") {
    tensions.push(choices.environment === "indoor"
      ? "Créer la lumière et l’ambiance dans un local opaque entre en tension avec une énergie limitée. L’intérêt d’une question de recherche peut néanmoins être distinct d’un objectif de production."
      : "L’absence de lumière artificielle supposée ne suffit pas à déclarer une consommation nulle : équipements et travail mécanisé restent à connaître.");
    sourceIds.add("cultivation-system-lca-us-2025");
  } else {
    observations.push("Des ressources déclarées disponibles ont encore un coût, une origine et des impacts ; leur disponibilité n’est pas illimitée.");
  }
  if (choices.purpose === "fibre-seed") {
    tensions.push("Fibre et graine demandent des critères de produit et une organisation de récolte explicites ; une même masse ne résume pas leur qualité.");
    if (choices.environment === "indoor" || choices.medium !== "soil") tensions.push("Le projet de matière doit justifier ses contenants ou son bâtiment ; ces choix ne prouvent aucun avantage économique.");
    sourceIds.add("cultivation-system-hemp-2026");
  } else if (choices.purpose === "education") {
    observations.push("Un dispositif lisible, accessible et encadré peut répondre à l’objectif pédagogique sans rechercher la production maximale.");
  } else {
    observations.push("La cohérence scientifique dépend de la question, des variables comparées et des témoins ; davantage d’équipement n’est pas une preuve plus forte.");
  }
  sourceIds.add("cultivation-system-france-hemp");
  sourceIds.add("cultivation-system-france-research");
  return {
    title: "Lecture qualitative du scénario fictif",
    observations, tensions,
    assumptions: ["Les cinq choix décrivent un cas inventé, sans mesure de terrain.", "Variété, usage et cadre professionnel ou scientifique supposés permis et vérifiés ; aucun droit à cultiver n’est créé par le simulateur.", "Les caractéristiques du sol, du matériel, de l’eau et les conditions exactes restent inconnues."],
    limits: ["Aucun rendement, prix, consommation ni émission n’est calculé.", "Les constats indiquent des questions à examiner ; ils ne prescrivent ni réglages ni conduite de culture.", "Le catalogue de huit systèmes est illustratif. Une combinaison absente du catalogue n’est pas automatiquement impossible."],
    sourceIds: [...sourceIds],
  };
}
