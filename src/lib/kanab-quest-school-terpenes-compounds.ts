import type { TerpeneCompound, TerpeneCorpus, TerpeneSource } from "./kanab-quest-school-terpenes-types";

// Corpus vérifié le 2026-11-12 ; limites, matrices et synonymes sont des données publiques.
export const TERPENE_COMPOUND_SOURCES: readonly TerpeneSource[] = [
  {
    "id": "tp-booth2017",
    "title": "Terpene synthases from Cannabis sativa",
    "author": "Judith K. Booth, Jonathan E. Page et Jörg Bohlmann",
    "organization": "PLOS ONE",
    "published": "2017-03-29",
    "url": "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0173911",
    "passage": "Tableaux 1–2 ; résultats « Functional characterization » ; figures 3–5 ; méthodes GC-MS et séparation chirale.",
    "access": "full-text",
    "documentKind": "Étude analytique et enzymes recombinantes",
    "limitation": "Finola et enzymes testées : ni tous les cannabis, ni preuve d’un effet humain. Certains produits thermolabiles se réarrangent pendant l’analyse.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-booth2020",
    "title": "Terpene Synthases and Terpene Variation in Cannabis sativa",
    "author": "Judith K. Booth, Macaire M. S. Yuen, Sharon Jancsik, Lufiani L. Madilao, Jonathan E. Page et Jörg Bohlmann",
    "organization": "Plant Physiology",
    "published": "2020-06-26",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7479917/",
    "passage": "Tableau 1, légende des astérisques ; « Functions of CsTPSs » ; figures 9–10 ; « Terpene Extraction and Analysis ».",
    "access": "full-text",
    "documentKind": "Profils végétaux et caractérisation fonctionnelle",
    "limitation": "Les pics sans astérisque reposent sur MS et indice de rétention. Les échantillons Purple Kush ne sont pas directement comparables aux autres conditions ; aucun pourcentage universel n’est repris.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-fischedick2017",
    "title": "Identification of Terpenoid Chemotypes Among High (−)-trans-Δ9-Tetrahydrocannabinol-Producing Cannabis sativa L. Cultivars",
    "author": "Justin T. Fischedick",
    "organization": "Cannabis and Cannabinoid Research",
    "published": "2017-03-01",
    "url": "https://doi.org/10.1089/can.2016.0040",
    "passage": "PDF intégral, pages 36–39 : méthodes, tableau 1 et tableau 2 ; rectification cis/trans-ocimène page 37.",
    "access": "full-text",
    "documentKind": "Analyse originale de 233 échantillons",
    "limitation": "PDF original consulté via copie hébergée par Accurate Clinic (URL conservée dans le corpus). Un dispensaire californien, 16 analytes ; les noms commerciaux ne prouvent ni identité génétique ni composition d’une carte Buddy.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-zager2019",
    "title": "Gene Networks Underlying Cannabinoid and Terpenoid Accumulation in Cannabis",
    "author": "Jordan J. Zager, Iris Lange, Narayanan Srividya, Anthony Smith et B. Markus Lange",
    "organization": "Plant Physiology",
    "published": "2019-05-28",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6670104/",
    "passage": "Tableaux 1 et 3 ; figures 7–8 ; paragraphes de caractérisation des synthases linalol/nérolidol.",
    "access": "full-text",
    "documentKind": "Profils de fleurs et enzymes recombinantes",
    "limitation": "Une enzyme active hors de la plante ne démontre pas à elle seule son produit dans chaque variété ; la séparation chirale concerne les analyses spécifiées.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-ovidi2022",
    "title": "Hemp (Cannabis sativa L., Kompolti cv.) and Hop (Humulus lupulus L., Chinook cv.) Essential Oil and Hydrolate: HS-GC-MS Chemical Investigation and Apoptotic Activity Evaluation",
    "author": "Elisa Ovidi et huit coauteurs",
    "organization": "Pharmaceuticals",
    "published": "2022-08-08",
    "url": "https://www.mdpi.com/1424-8247/15/8/976",
    "passage": "Tableau 1, colonne Hemp EO ; tableau 2, colonne Hemp Hy ; méthodes d’identification GC-MS.",
    "access": "full-text",
    "documentKind": "Analyse d’huile et d’hydrolat ; expériences cellulaires distinctes",
    "limitation": "Huile et hydrolat transformés, pas profil de fleur fraîche. Les résultats cellulaires portent sur des mélanges : ils ne sont attribués à aucune molécule isolée dans ces fiches. Quelques lignes n’ont pas d’indice de référence.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-janta2024",
    "title": "Chemical profiling and clustering of various dried cannabis flowers revealed by volatilomics and chemometric processing",
    "author": "Pannipa Janta et Sornkanok Vimolmangkang",
    "organization": "Journal of Cannabis Research",
    "published": "2024-12-06",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11622677/",
    "passage": "« Compound identification » et tableau 2 : noms proposés, indices, différences d’indices et scores de correspondance.",
    "access": "full-text",
    "documentKind": "Volatilomique HS-SPME-GC-MS de 19 fleurs séchées",
    "limitation": "Les auteurs qualifient les identifications de provisoires. Bibliothèque NIST et indice de rétention ne remplacent pas un étalon ; DB-WAX non chirale ne démontre pas les signes (+)/(−) et préfixes R/L du tableau.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-flavornet",
    "title": "Flavornet and human odor space — index des descripteurs",
    "author": "Terry Acree et Heinrich Arn",
    "organization": "Cornell / DATU",
    "published": "2004-06-25 (version annoncée)",
    "url": "https://flavornet.org/d_odors.html",
    "passage": "Index odeurs et fiches liées ; méthode et bibliographies sur https://www.flavornet.org/.",
    "access": "official-page",
    "documentKind": "Base originale de descripteurs issus de GC-olfactométrie",
    "limitation": "Base documentaire, pas nouveau panel réalisé pour l’école. Certains indices sont interpolés : aucun n’est repris ici. Les mots décrivent des contextes perceptifs ; ils ne prouvent ni intensité, ni qualité, ni effet d’un cannabis.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-hops2021",
    "title": "Characterization of Wild Corsican Hops and Assessment of the Performances of German Hops in Corsican Environmental Conditions through a Multidisciplinary Approach",
    "author": "Axel Dabbous-Wach, Margherita Rodolfi, Julien Paolini, Jean Costa et Tommaso Ganino",
    "organization": "Applied Sciences",
    "published": "2021-04-21",
    "url": "https://www.mdpi.com/2076-3417/11/9/3756",
    "passage": "Tableau 6, annexe A1 et §3.3 ; composés identifiés dans les huiles de houblon.",
    "access": "full-text",
    "documentKind": "Analyse GC-MS de houblons",
    "limitation": "Présence dans les échantillons étudiés, non dans chaque houblon. Les commentaires sensoriels ne sont pas un essai d’effet humain.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-herbs2021",
    "title": "Headspace/GC–MS Analysis and Investigation of Antibacterial, Antioxidant and Cytotoxic Activity of Essential Oils and Hydrolates from Rosmarinus officinalis L. and Lavandula angustifolia Miller",
    "author": "Stefania Garzoli, Valentina Laghezza Masci, Sara Franceschi, Antonio Tiezzi, Pierluigi Giacomello et Elisa Ovidi",
    "organization": "Foods",
    "published": "2021-07-30",
    "url": "https://www.mdpi.com/2304-8158/10/8/1768",
    "passage": "Tableaux 1–2 (romarin et lavande) ; §2.2–2.3, identification MS et indices.",
    "access": "full-text",
    "documentKind": "Profils d’huiles et de phases vapeur",
    "limitation": "Seuls les résultats de composition sont utilisés. Les essais sur mélanges et cellules ne prouvent pas les effets des molécules séparées ou d’un usage humain.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-eucalyptus2011",
    "title": "Eucalyptus oleosa Essential Oils: Chemical Composition and Antimicrobial and Antioxidant Activities of the Oils from Different Plant Parts (Stems, Leaves, Flowers and Fruits)",
    "author": "H. N. Ben Marzoug, M. Romdhane, A. Lebrihi, F. Mathieu, F. Couderc, M. Abderraba, M. L. Khouja et J. Bouajila",
    "organization": "Molecules",
    "published": "2011-02-17",
    "url": "https://www.mdpi.com/1420-3049/16/2/1695",
    "passage": "Tableau de composition, lignes 51 (guaiol), 53 (γ-eudesmol), 55 (β-eudesmol), et §2.1.",
    "access": "excerpt",
    "documentKind": "Tableau original consulté dans l’index",
    "limitation": "Page intégrale inaccessible pendant la consultation ; extrait du tableau original vérifié, pas relecture des données brutes. Les huiles étudiées ne représentent pas tous les eucalyptus.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-fennel2021",
    "title": "Gas Chromatography–Mass Spectrometry-Based Classification of 12 Fennel (Foeniculum vulgare Miller) Varieties Based on Their Aroma Profiles and Estragole Levels as Analyzed Using Chemometric Tools",
    "author": "Sherif M. Afifi, Amira El-Mahis, Andreas G. Heiss et Mohamed A. Farag",
    "organization": "ACS Omega",
    "published": "2021-02-12",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7931402/",
    "passage": "Tableau 2, ligne 3 : fenchol dans les fruits de fenouil ; méthodes SPME-GC-MS.",
    "access": "full-text",
    "documentKind": "Profils volatils de fruits de fenouil",
    "limitation": "Détection analytique, sans confirmation de tous les stéréoisomères ni conclusion sur un effet du fenchol isolé.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-snapdragon2008",
    "title": "Two nearly identical terpene synthases catalyze the formation of nerolidol and linalool in snapdragon flowers",
    "author": "Dinesh A. Nagegowda, Michael Gutensohn, Curtis G. Wilkerson et Natalia Dudareva",
    "organization": "The Plant Journal",
    "published": "2008-03-19 (en ligne)",
    "url": "https://pubmed.ncbi.nlm.nih.gov/18363779/",
    "passage": "Résumé original : émissions florales et caractérisation AmNES/LIS-1 et -2.",
    "access": "abstract",
    "documentKind": "Étude enzymatique de fleurs de muflier",
    "limitation": "Résumé consulté ; détail des expériences et annexes non relus. Ne démontre pas un rôle identique chez le cannabis.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-chamomile2023",
    "title": "Biosynthesis of α-Bisabolol by Farnesyl Diphosphate Synthase and α-Bisabolol Synthase and Their Related Transcription Factors in Matricaria recutita L.",
    "author": "Yuling Tai et onze coauteurs",
    "organization": "International Journal of Molecular Sciences",
    "published": "2023-01-15",
    "url": "https://pubmed.ncbi.nlm.nih.gov/36675248/",
    "passage": "Résumé original et légendes accessibles : MrFPS, MrBBS, modèle de biosynthèse.",
    "access": "abstract",
    "documentKind": "Étude de biosynthèse chez la camomille",
    "limitation": "Résumé et légendes consultés, pas texte intégral. La fonction de biosynthèse n’établit ni efficacité clinique ni identité stéréochimique d’un produit commercial.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-sage1998",
    "title": "Monoterpene synthases from common sage (Salvia officinalis): cDNA isolation, characterization, and functional expression",
    "author": "Mitchell L. Wise, Thomas J. Savage, Eva Katahira et Rodney Croteau",
    "organization": "Journal of Biological Chemistry",
    "published": "1998-06-12",
    "url": "https://pubmed.ncbi.nlm.nih.gov/9614092/",
    "passage": "Résumé original : synthases sabinène, cinéole et diphosphate de bornyle, produits secondaires.",
    "access": "abstract",
    "documentKind": "Fonction de synthases recombinantes de sauge",
    "limitation": "Résumé consulté ; aucune procédure de production n’est reprise. Une activité enzymatique n’est pas une preuve de fonction écologique en milieu naturel.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-maize2005",
    "title": "Recruitment of entomopathogenic nematodes by insect-damaged maize roots",
    "author": "Sergio Rasmann et coauteurs",
    "organization": "Nature",
    "published": "2005-04-07",
    "url": "https://www.nature.com/articles/nature03451",
    "passage": "Résumé original et figure 3 : signal (E)-β-caryophyllène et attraction de nématodes.",
    "access": "abstract",
    "documentKind": "Écologie expérimentale du maïs",
    "limitation": "Résultat d’un système maïs–insecte–nématode ; ne démontre ni même fonction dans le cannabis, ni effet sur une personne.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-oswald2021",
    "title": "Identification of a New Family of Prenylated Volatile Sulfur Compounds in Cannabis Revealed by Comprehensive Two-Dimensional Gas Chromatography",
    "author": "Iain W. H. Oswald, Marcos A. Ojeda, Ryan J. Pobanz, Kevin A. Koby, Anthony J. Buchanan, Josh Del Rosso, Mario A. Guzman et Thomas J. Martin",
    "organization": "ACS Omega",
    "published": "2021-11-12",
    "url": "https://pubmed.ncbi.nlm.nih.gov/34869990/",
    "passage": "Résumé original : composés soufrés prénylés et 3-méthyl-2-butène-1-thiol.",
    "access": "abstract",
    "documentKind": "Analyse et caractérisation olfactive",
    "limitation": "Résumé consulté ; auteurs affiliés notamment à Abstrax. Les composés soufrés ne sont pas comptés comme des terpènes dans cet inventaire.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-oswald2023",
    "title": "Minor, Nonterpenoid Volatile Compounds Drive the Aroma Differences of Exotic Cannabis",
    "author": "Iain W. H. Oswald et treize coauteurs",
    "organization": "ACS Omega",
    "published": "2023-10-12",
    "url": "https://pubmed.ncbi.nlm.nih.gov/37901519/",
    "passage": "Résumé original et description des 31 extraits : composés non terpéniques et différences aromatiques.",
    "access": "abstract",
    "documentKind": "Analyse de produits et perception sensorielle",
    "limitation": "Extraits étudiés, pas tous les cannabis ; plusieurs auteurs affiliés à Abstrax. Les associations sensorielles ne sont ni des propriétés thérapeutiques ni une mesure chimique des Buddies.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-identity-selinene",
    "title": "β-Selinene — identité et synonymes",
    "author": "NCBI PubChem",
    "organization": "National Library of Medicine",
    "published": "base évolutive, consultée le 2026-11-12",
    "url": "https://pubchem.ncbi.nlm.nih.gov/compound/Beta-Selinene",
    "passage": "Rubrique Synonyms : beta-eudesmene ; formule et structure.",
    "access": "excerpt",
    "documentKind": "Notice institutionnelle d’identité chimique",
    "limitation": "Extrait indexé consulté ; le synonyme structurel n’attribue pas automatiquement l’énantiomère de la notice à un pic non chiral.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-identity-selinadiene",
    "title": "Selina-3,7(11)-diene — identité et synonymes",
    "author": "NCBI PubChem",
    "organization": "National Library of Medicine",
    "published": "notice modifiée le 2026-09-05",
    "url": "https://pubchem.ncbi.nlm.nih.gov/compound/Selina-3_7_11_-diene",
    "passage": "Rubrique Synonyms : Eudesma-3,7(11)-diene ; formule et structure.",
    "access": "official-page",
    "documentKind": "Notice institutionnelle d’identité chimique",
    "limitation": "Regroupement de synonymes ; aucune preuve nouvelle de présence végétale ou de stéréochimie des échantillons.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-lavender2022",
    "title": "Exploring the Chemical Composition of Bulgarian Lavender Absolute (Lavandula angustifolia Mill.) by GC/MS and GC-FID",
    "author": "Daniela Nedeltcheva-Antonova, Kamelia Gechovska, Stanislav Bozhanov et Liudmil Antonov",
    "organization": "Plants",
    "published": "2022-11-17",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9692913/",
    "passage": "Tableau 1 et chromatogrammes : cis/trans-β-ocimène, nérolidol, acétate de géranyle et autres constituants d’absolues de lavande.",
    "access": "full-text",
    "documentKind": "Analyse de sept absolues de lavande",
    "limitation": "Produits extraits de lavande, pas parfum de la fleur intacte. Les contributions olfactives individuelles ne sont pas mesurées par cette analyse.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-spruce2011",
    "title": "An integrated genomic, proteomic and biochemical analysis of (+)-3-carene biosynthesis in Sitka spruce (Picea sitchensis) genotypes that are resistant or susceptible to white pine weevil",
    "author": "Dawn E. Hall et neuf coauteurs",
    "organization": "The Plant Journal",
    "published": "2011-02-16",
    "url": "https://pubmed.ncbi.nlm.nih.gov/21323772/",
    "passage": "Résumé original : (+)-3-carène, famille PsTPS-3car et association avec des génotypes d’épicéa.",
    "access": "abstract",
    "documentKind": "Étude de biosynthèse chez un conifère",
    "limitation": "Résumé consulté ; notice signalant un erratum. Seule l’association générale et l’étude des synthases sont retenues, sans chiffre ni transfert au cannabis.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-identity-humulene",
    "title": "Humulene — NIST Chemistry WebBook",
    "url": "https://webbook.nist.gov/cgi/cbook.cgi?ID=C6753986",
    "passage": "Other names : α-Caryophyllene, α-Humulene ; structure.",
    "author": "NIST Mass Spectrometry Data Center",
    "organization": "National Institute of Standards and Technology",
    "published": "base évolutive, consultée le 2026-11-12",
    "access": "official-page",
    "documentKind": "Notice institutionnelle d’identité",
    "limitation": "Utilisée pour le nom et le regroupement de synonymes, sans transformer une notice chimique en preuve de présence dans le cannabis. Aucun indice physique sans conditions repris.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-identity-nerol",
    "title": "Nerol — NIST Chemistry WebBook",
    "url": "https://webbook.nist.gov/cgi/cbook.cgi?Name=NEROL",
    "passage": "Other names : cis-Geraniol, Nerol, (Z)-Geraniol.",
    "author": "NIST Mass Spectrometry Data Center",
    "organization": "National Institute of Standards and Technology",
    "published": "base évolutive, consultée le 2026-11-12",
    "access": "excerpt",
    "documentKind": "Notice institutionnelle d’identité",
    "limitation": "Utilisée pour le nom et le regroupement de synonymes, sans transformer une notice chimique en preuve de présence dans le cannabis. Aucun indice physique sans conditions repris.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-identity-neral",
    "title": "Neral — NIST Chemistry WebBook",
    "url": "https://webbook.nist.gov/cgi/cbook.cgi?ID=C106263",
    "passage": "Other names : β-Citral, Neral, Citral B ; structure d’aldéhyde.",
    "author": "NIST Mass Spectrometry Data Center",
    "organization": "National Institute of Standards and Technology",
    "published": "base évolutive, consultée le 2026-11-12",
    "access": "excerpt",
    "documentKind": "Notice institutionnelle d’identité",
    "limitation": "Utilisée pour le nom et le regroupement de synonymes, sans transformer une notice chimique en preuve de présence dans le cannabis. Aucun indice physique sans conditions repris.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-wiles2025",
    "title": "Integrated platform for structural and functional analysis of terpene synthases of Cannabis sativa",
    "author": "Danielle Wiles, James Roest, Bhuvana Shanbhag, Julian Vivian et Travis Beddoe",
    "organization": "PeerJ",
    "published": "2025-07-10",
    "url": "https://pubmed.ncbi.nlm.nih.gov/40656959/",
    "passage": "Résumé original : caractérisation fonctionnelle de dix synthases de C. sativa.",
    "access": "abstract",
    "documentKind": "Plateforme de recherche enzymatique",
    "limitation": "Résumé consulté, texte intégral bloqué. Aucun protocole ni nouvelle présence dans une fleur n’est déduit des produits enzymatiques ; aucune allégation de l’introduction sur la santé n’est reprise.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-buddy-acdc",
    "title": "ACDC — Flavor & Aroma",
    "author": "CBD Seed Labs",
    "organization": "CBD Seed Labs",
    "published": "page commerciale non datée, consultée le 2026-11-12",
    "url": "https://cbdseedlabs.com/acdc/",
    "passage": "Rubrique sensorielle ; court extrait retenu : pomelo, lemon, sour orange. Raccord aux libellés audités du CSV BUDDIES-PARFUMS-PROPOSITION-2026-10-12.csv.",
    "access": "official-page",
    "documentKind": "Description commerciale attribuée d’un produit particulier",
    "limitation": "Utilisée comme déclaration de son auteur sur l’arôme, non comme expertise indépendante ou profil chimique universel. Aucun effet ou taux commercial n’est repris.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-buddy-hawaiian",
    "title": "Hawaiian Haze — Tasting Notes",
    "author": "East Fork Cultivars",
    "organization": "East Fork Cultivars",
    "published": "page commerciale non datée, consultée le 2026-11-12",
    "url": "https://eastforkcultivars.com/cultivars/p/hawaiian-haze",
    "passage": "Rubrique sensorielle ; court extrait retenu : subtle earthy floral notes. Raccord aux libellés audités du CSV BUDDIES-PARFUMS-PROPOSITION-2026-10-12.csv.",
    "access": "official-page",
    "documentKind": "Description commerciale attribuée d’un produit particulier",
    "limitation": "Utilisée comme déclaration de son auteur sur l’arôme, non comme expertise indépendante ou profil chimique universel. Aucun effet ou taux commercial n’est repris.",
    "verifiedAt": "2026-11-12"
  },
  {
    "id": "tp-buddy-remedy",
    "title": "Remedy — Aroma",
    "author": "Cannaflower",
    "organization": "Cannaflower",
    "published": "page commerciale non datée, consultée le 2026-11-12",
    "url": "https://cannaflower.com/product/remedy/",
    "passage": "Rubrique sensorielle ; court extrait retenu : Citrus | Diesel | Pine. Raccord aux libellés audités du CSV BUDDIES-PARFUMS-PROPOSITION-2026-10-12.csv.",
    "access": "official-page",
    "documentKind": "Description commerciale attribuée d’un produit particulier",
    "limitation": "Utilisée comme déclaration de son auteur sur l’arôme, non comme expertise indépendante ou profil chimique universel. Aucun effet ou taux commercial n’est repris.",
    "verifiedAt": "2026-11-12"
  }
];

export const TERPENE_CORPUS: TerpeneCorpus = {
  "id": "terpenes-corpus-2026-11-12",
  "version": "2026-11-12.terpenes1",
  "checkedAt": "2026-11-12",
  "title": "Terpènes documentés dans le cannabis",
  "scope": "31 fiches développées et 55 entrées complémentaires issues du corpus consulté. Ce sont des dossiers de lecture, pas 86 identités toutes confirmées ni une liste complète du cannabis.",
  "inclusionRules": [
    "Une présence cannabis renvoie à un tableau original, à sa matrice et au nom effectivement publié ; les étalons, RI/MS et propositions provisoires restent distingués.",
    "Le premier niveau développe l’identité, la présence, les odeurs documentées, une autre plante et les résultats biologiques ou les lacunes. L’inventaire garde les composés moins étudiés sans inventer les rubriques manquantes.",
    "Les synthases expliquent une capacité de biosynthèse ; un produit enzymatique seul n’est pas compté comme une présence mesurée dans une fleur.",
    "Les familles aromatiques sont des repères qualitatifs. Aucune intensité, concentration, fréquence universelle ou propriété médicale n’est calculée."
  ],
  "exclusions": [
    "Pics non nommés (« sesquiterpene 1 », « guiane », « eudesmane ») : structure insuffisamment définie.",
    "Hédycaryol et géraniol produits par des enzymes dans Booth : non ajoutés sur cette seule base à l’inventaire de présence florale.",
    "« Cyclounatriene » du tableau Booth : identité insuffisamment résolue pour créer une fiche nominative.",
    "Composés soufrés prénylés, esters non terpéniques, skatole, cannabinoïdes et autres volatils : importants pour l’odeur, mais hors du décompte des terpènes et terpénoïdes de cette encyclopédie.",
    "Composés détectés seulement dans la colonne houblon d’Ovidi : aucune preuve cannabis déduite de cette colonne.",
    "Valeurs de volatilité ou températures physiques sans pression et conditions ; promesses thérapeutiques et profils chimiques attribués aux Buddies."
  ],
  "synonymRules": [
    "Myrcène/β-myrcène, humulène/α-caryophyllène, eucalyptol/1,8-cinéole et terpinolène/δ-terpinène ne sont pas comptés deux fois.",
    "β-eudesmène/β-sélinène et eudesma-3,7(11)-diène/sélina-3,7(11)-diène sont regroupés selon les notices institutionnelles.",
    "cis-géraniol devient nérol ; β-citral devient néral, classé comme composé oxygéné.",
    "Les énantiomères (+)/(−) d’un même squelette restent dans une fiche avec leurs preuves. Les formes E/Z d’ocimène ont des dossiers distincts parce que des lignes originales les distinguent.",
    "Les géométries d’α-farnésène et α-bergamotène sont décrites dans une fiche regroupée, sans masquer que certains tableaux ne les précisent pas.",
    "Les deux attributions 2-carène de Janta sont regroupées ; un signe optique de bibliothèque ne prouve pas une séparation énantiomérique.",
    "β-fenchol provisoire et fenchol/endo-fenchyl alcohol restent signalés séparément avec leur rapprochement non résolu ; le nombre de dossiers n’est donc pas un décompte de structures définitivement élucidées."
  ],
  "limitations": [
    "Corpus raisonné, non revue systématique de toute la littérature mondiale ; vérification des sources le 12 novembre 2026. Publications analytiques centrales 2017–2024, recherche enzymatique consultée jusqu’en 2025.",
    "Une identification RI/MS est moins forte qu’une comparaison à un étalon et peut être faussée par coélution, bibliothèque ou réarrangement thermique. Même un étalon non chiral ne prouve pas une configuration absolue.",
    "Fleur fraîche, fleur séchée, huile, hydrolat et produit d’enzyme sont des matrices distinctes. Aucune teneur observée n’est généralisée.",
    "Flavornet est une base de descripteurs et de références GC-olfactométriques : sa consultation n’équivaut pas à avoir relu tous les articles historiques qu’elle cite.",
    "Absence de fonction écologique établie dans ce dossier ne signifie pas absence de fonction dans la nature. Les travaux cellulaires sur huiles entières ne prouvent pas l’effet d’un terpène isolé chez l’humain.",
    "Les composés soufrés et non terpéniques étudiés par Oswald montrent pourquoi une liste de terpènes ne suffit pas à prédire toute l’odeur d’un produit."
  ],
  "sourceIds": [
    "tp-booth2017",
    "tp-booth2020",
    "tp-fischedick2017",
    "tp-zager2019",
    "tp-ovidi2022",
    "tp-janta2024",
    "tp-flavornet",
    "tp-hops2021",
    "tp-herbs2021",
    "tp-eucalyptus2011",
    "tp-fennel2021",
    "tp-snapdragon2008",
    "tp-chamomile2023",
    "tp-sage1998",
    "tp-maize2005",
    "tp-oswald2021",
    "tp-oswald2023",
    "tp-identity-selinene",
    "tp-identity-selinadiene",
    "tp-lavender2022",
    "tp-spruce2011",
    "tp-identity-humulene",
    "tp-identity-nerol",
    "tp-identity-neral",
    "tp-wiles2025",
    "tp-buddy-acdc",
    "tp-buddy-hawaiian",
    "tp-buddy-remedy"
  ]
};

export const TERPENE_COMPOUNDS: readonly TerpeneCompound[] = [
  {
    "id": "alphapinene",
    "name": "α-Pinène",
    "synonyms": [
      "alpha-pinene"
    ],
    "isomerNotes": "Les deux énantiomères sont séparés dans Booth ; ils restent réunis dans cette fiche, sans attribuer leur proportion à une variété commerciale.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Les deux énantiomères sont séparés dans Booth ; ils restent réunis dans cette fiche, sans attribuer leur proportion à une variété commerciale."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : (+)-α-pinène et (−)-α-pinène.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Pin, térébenthine.",
      "families": [
        "woody"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin (Salvia rosmarinus)",
        "statement": "Tableau 1 : huile et phase vapeur analysées.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS2 étudiée chez Finola produit principalement l’α-pinène ; cette fonction de biosynthèse a été testée sur enzyme recombinante.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-herbs2021",
      "tp-booth2017",
      "tp-flavornet"
    ]
  },
  {
    "id": "betapinene",
    "name": "β-Pinène",
    "synonyms": [
      "beta-pinene"
    ],
    "isomerNotes": "β et α indiquent des structures différentes ; (+)/(−) distinguent des formes miroir. L’identité β ne fixe pas le signe optique.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "β et α indiquent des structures différentes ; (+)/(−) distinguent des formes miroir. L’identité β ne fixe pas le signe optique."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : (+)-β-pinène et (−)-β-pinène.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Pin, résine.",
      "families": [
        "woody"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Houblon (Humulus lupulus)",
        "statement": "Tableau 6 : composant des huiles de houblons corses.",
        "sourceIds": [
          "tp-hops2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Des synthases recombinantes de sauge forment du β-pinène parmi plusieurs produits ; une enzyme peut donc participer à un mélange.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-sage1998"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-hops2021",
      "tp-sage1998",
      "tp-flavornet"
    ]
  },
  {
    "id": "myrcene",
    "name": "Myrcène",
    "synonyms": [
      "β-myrcène",
      "beta-myrcene"
    ],
    "isomerNotes": "Le nom usuel myrcène correspond ici au β-myrcène ; ne pas créer deux fiches pour ces noms.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Le nom usuel myrcène correspond ici au β-myrcène ; ne pas créer deux fiches pour ces noms."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Myrcene ; également tableau 1 de Fischedick.",
        "sourceIds": [
          "tp-booth2020",
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Épicé, résineux, herbacé.",
      "families": [
        "spicy",
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Houblon (Humulus lupulus)",
        "statement": "Tableau 6 : myrcène mesuré dans les huiles étudiées.",
        "sourceIds": [
          "tp-hops2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS3 de Finola et d’autres synthases de cannabis forment le myrcène. L’étude porte sur la biosynthèse, pas sur une promesse de relaxation.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-hops2021",
      "tp-booth2017",
      "tp-flavornet",
      "tp-fischedick2017"
    ]
  },
  {
    "id": "limonene",
    "name": "Limonène",
    "synonyms": [
      "limonene"
    ],
    "isomerNotes": "Booth caractérise le (−)-limonène dans ces échantillons. Ne pas remplacer silencieusement cette donnée par le (+)-limonène souvent associé aux agrumes.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Booth caractérise le (−)-limonène dans ces échantillons. Ne pas remplacer silencieusement cette donnée par le (+)-limonène souvent associé aux agrumes."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : (−)-Limonene ; tableau 1 de Fischedick : Limonene.",
        "sourceIds": [
          "tp-booth2020",
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Citron, agrumes.",
      "families": [
        "citrus"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin (Salvia rosmarinus)",
        "statement": "Tableau 1 : limonène dans l’huile et la phase vapeur.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS1 de Finola et CsTPS14CT sont des synthases de (−)-limonène caractérisées expérimentalement.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-zager2019"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-herbs2021",
      "tp-zager2019",
      "tp-flavornet",
      "tp-fischedick2017"
    ]
  },
  {
    "id": "camphene",
    "name": "Camphène",
    "synonyms": [
      "camphene"
    ],
    "isomerNotes": "Les deux formes optiques sont distinguées dans cette analyse ; la fiche conserve un nom collectif et ne suppose pas un mélange fixe.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Les deux formes optiques sont distinguées dans cette analyse ; la fiche conserve un nom collectif et ne suppose pas un mélange fixe."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : (+)-Camphene et (−)-Camphene.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Camphré.",
      "families": [
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin et lavande",
        "statement": "Tableaux 1–2 : camphène identifié dans les produits étudiés.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS32(PK) forme du camphène parmi ses produits mineurs. Cette observation explique une possibilité de biosynthèse, sans attribuer une fonction de défense.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-herbs2021",
      "tp-flavornet"
    ]
  },
  {
    "id": "alpha-phellandrene",
    "name": "α-Phellandrène",
    "synonyms": [
      "alpha-phellandrene"
    ],
    "isomerNotes": "α-phellandrène et β-phellandrène sont des isomères de position, pas deux orthographes. La configuration optique n’est pas établie par ce tableau.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "α-phellandrène et β-phellandrène sont des isomères de position, pas deux orthographes. La configuration optique n’est pas établie par ce tableau."
      ],
      "sourceIds": [
        "tp-fischedick2017"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’analyse de fleurs commercialisées : 233 échantillons, 30 noms de cultivars et 16 analytes ciblés. Cela ne constitue pas le profil d’un Buddy.",
        "locator": "Tableau 1 et données du tableau 2 : α-Phellandrene.",
        "sourceIds": [
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Mentholé, épicé.",
      "families": [
        "herbal",
        "spicy"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin et lavande",
        "statement": "Tableaux 1–2 : identification du composé dans les huiles.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Fischedick étudie son utilité pour comparer des profils chimiques ; aucune fonction écologique propre à cette molécule n’est testée dans cette étude.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-fischedick2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-fischedick2017",
      "tp-herbs2021",
      "tp-flavornet"
    ]
  },
  {
    "id": "delta3-carene",
    "name": "Δ3-Carène",
    "synonyms": [
      "3-carène",
      "delta-3-carene"
    ],
    "isomerNotes": "Le chiffre 3 indique la position de la double liaison ; 2-carène et 4-carène ne sont pas des synonymes. Le signe optique n’est pas fixé ici.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Le chiffre 3 indique la position de la double liaison ; 2-carène et 4-carène ne sont pas des synonymes. Le signe optique n’est pas fixé ici."
      ],
      "sourceIds": [
        "tp-fischedick2017"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’analyse de fleurs commercialisées : 233 échantillons, 30 noms de cultivars et 16 analytes ciblés. Cela ne constitue pas le profil d’un Buddy.",
        "locator": "Tableau 1 : 3-Carene ; tableau 2 : certaines détections seulement.",
        "sourceIds": [
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Résine, citron.",
      "families": [
        "woody",
        "citrus"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Épicéa de Sitka (Picea sitchensis)",
        "statement": "Le résumé original décrit le (+)-3-carène et ses synthases.",
        "sourceIds": [
          "tp-spruce2011"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Des différences de biosynthèse du (+)-3-carène sont associées à des génotypes d’épicéa résistants ou sensibles à un charançon.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-spruce2011"
        ]
      }
    ],
    "sourceIds": [
      "tp-fischedick2017",
      "tp-spruce2011",
      "tp-flavornet"
    ]
  },
  {
    "id": "alpha-terpinene",
    "name": "α-Terpinène",
    "synonyms": [
      "alpha-terpinene"
    ],
    "isomerNotes": "À distinguer du γ-terpinène et du terpinolène : les positions des doubles liaisons diffèrent.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "À distinguer du γ-terpinène et du terpinolène : les positions des doubles liaisons diffèrent."
      ],
      "sourceIds": [
        "tp-fischedick2017"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’analyse de fleurs commercialisées : 233 échantillons, 30 noms de cultivars et 16 analytes ciblés. Cela ne constitue pas le profil d’un Buddy.",
        "locator": "Tableau 1 : α-Terpinene ; tableau 2 pour les échantillons positifs.",
        "sourceIds": [
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Citron.",
      "families": [
        "citrus"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin et lavande",
        "statement": "Tableaux 1–2 : présence dans les huiles analysées.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Dans le corpus cannabis retenu, l’analyse décrit un profil, sans test de la fonction écologique de l’α-terpinène isolé.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-fischedick2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-fischedick2017",
      "tp-herbs2021",
      "tp-flavornet"
    ]
  },
  {
    "id": "gamma-terpinene",
    "name": "γ-Terpinène",
    "synonyms": [
      "gamma-terpinene"
    ],
    "isomerNotes": "γ-terpinène est distinct de l’α-terpinène. Un nom de bibliothèque ne constitue pas un étalon authentique.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "γ-terpinène est distinct de l’α-terpinène. Un nom de bibliothèque ne constitue pas un étalon authentique."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 15 : γ-terpinene, colonne Hemp EO.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Térébenthine ; note d’essence dans l’index sensoriel.",
      "families": [
        "woody",
        "other"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin et lavande",
        "statement": "Tableaux 1–2 : γ-terpinène identifié par MS et indices.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "La sabinène synthase de sauge étudiée par Wise forme aussi du γ-terpinène : les synthases végétales ne sont pas toujours exclusives d’un produit.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-sage1998"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022",
      "tp-herbs2021",
      "tp-sage1998",
      "tp-flavornet"
    ]
  },
  {
    "id": "terpinolene",
    "name": "Terpinolène",
    "synonyms": [
      "δ-terpinène",
      "terpinolene"
    ],
    "isomerNotes": "δ-terpinène est un synonyme employé par Flavornet pour le terpinolène ; il n’ajoute pas une quatrième fiche de terpinène.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "δ-terpinène est un synonyme employé par Flavornet pour le terpinolène ; il n’ajoute pas une quatrième fiche de terpinène."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Terpinolene ; Fischedick, tableau 1.",
        "sourceIds": [
          "tp-booth2020",
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Pin ; note plastique rapportée par Flavornet.",
      "families": [
        "woody",
        "other"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin",
        "statement": "Tableau 1 : terpinolène dans l’huile et sa phase vapeur.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS23(LS) et CsTPS32(PK) produisent du terpinolène parmi plusieurs produits ; un même composé peut avoir plusieurs voies enzymatiques contributrices.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-herbs2021",
      "tp-flavornet",
      "tp-fischedick2017"
    ]
  },
  {
    "id": "e-beta-ocimene",
    "name": "(E)-β-Ocimène",
    "synonyms": [
      "trans-β-ocimène",
      "trans-ocimene"
    ],
    "isomerNotes": "E correspond au trans pour la double liaison concernée. Fischedick a révisé une ancienne attribution cis grâce à un mélange étalon connu.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "E correspond au trans pour la double liaison concernée. Fischedick a révisé une ancienne attribution cis grâce à un mélange étalon connu."
      ],
      "sourceIds": [
        "tp-booth2020",
        "tp-fischedick2017"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : (E)-β-ocimene ; Fischedick, rectification cis/trans page 37.",
        "sourceIds": [
          "tp-booth2020",
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Herbacé, doux.",
      "families": [
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Muflier (Antirrhinum majus)",
        "statement": "Le résumé original le compte parmi les volatils floraux émis.",
        "sourceIds": [
          "tp-snapdragon2008"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Des synthases de cannabis, dont CsTPS6, forment cet ocimène. Détection et synthèse ne prouvent pas que son rôle écologique serait identique à celui d’une fleur visitée par des insectes.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-snapdragon2008",
      "tp-booth2017",
      "tp-flavornet",
      "tp-fischedick2017"
    ]
  },
  {
    "id": "z-beta-ocimene",
    "name": "(Z)-β-Ocimène",
    "synonyms": [
      "cis-β-ocimène",
      "cis-ocimene"
    ],
    "isomerNotes": "La forme Z reste distincte de E. La correction d’une ancienne attribution cis dans une autre étude n’annule pas toutes les détections de Z.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "La forme Z reste distincte de E. La correction d’une ancienne attribution cis dans une autre étude n’annule pas toutes les détections de Z."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 14 : cis-β-ocimene ; Booth 2020 signale aussi (Z)-β-ocimène dans Purple Kush.",
        "sourceIds": [
          "tp-ovidi2022",
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Floral, agrumes, herbacé.",
      "families": [
        "floral",
        "citrus",
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Lavande (Lavandula angustifolia)",
        "statement": "Tableau 1 : cis-β-ocimène dans des absolues bulgares.",
        "sourceIds": [
          "tp-lavender2022"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Les études citées comparent des volatils végétaux ; elles ne démontrent pas une fonction écologique propre au Z-β-ocimène dans le cannabis.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022",
      "tp-lavender2022",
      "tp-flavornet",
      "tp-booth2020"
    ]
  },
  {
    "id": "linalool",
    "name": "Linalol",
    "synonyms": [
      "linalool"
    ],
    "isomerNotes": "Deux énantiomères existent. Booth rapporte (+) ; Zager montre qu’une synthase peut produire un mélange (+)/(−). Le nom linalol seul ne fixe donc pas la configuration.",
    "family": "oxygenated-monoterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Deux énantiomères existent. Booth rapporte (+) ; Zager montre qu’une synthase peut produire un mélange (+)/(−). Le nom linalol seul ne fixe donc pas la configuration."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : (+)-linalool ; Zager, figures 7–8.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Floral, lavande.",
      "families": [
        "floral"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Lavande (Lavandula angustifolia)",
        "statement": "Tableau 2 : linalol dans l’huile et la phase vapeur.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS18VF et CsTPS19BL relient la production de linalol et de nérolidol à des enzymes capables d’utiliser différents substrats ; leurs produits chiraux diffèrent.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-zager2019"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-herbs2021",
      "tp-zager2019",
      "tp-flavornet"
    ]
  },
  {
    "id": "fenchol",
    "name": "Fenchol",
    "synonyms": [
      "alcool fenchylique",
      "endo-fenchyl alcohol"
    ],
    "isomerNotes": "Le corpus emploie endo-fenchyl alcohol et fenchol. La mention β-fenchol provisoire de Janta est conservée à part, sans l’assimiler à cet étalon.",
    "family": "oxygenated-monoterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Le corpus emploie endo-fenchyl alcohol et fenchol. La mention β-fenchol provisoire de Janta est conservée à part, sans l’assimiler à cet étalon."
      ],
      "sourceIds": [
        "tp-fischedick2017",
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’analyse de fleurs commercialisées : 233 échantillons, 30 noms de cultivars et 16 analytes ciblés. Cela ne constitue pas le profil d’un Buddy.",
        "locator": "Tableau 1 : Endo-fenchyl-alcohol ; Booth 2020, tableau 1 : Fenchol*.",
        "sourceIds": [
          "tp-fischedick2017",
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Camphré.",
      "families": [
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Fenouil (Foeniculum vulgare)",
        "statement": "Tableau 2, ligne 3 : fenchol dans plusieurs fruits analysés.",
        "sourceIds": [
          "tp-fennel2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Le corpus vérifie surtout son identification et sa distribution. Il ne caractérise pas ici une fonction écologique du fenchol dans le cannabis.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-fischedick2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-fischedick2017",
      "tp-fennel2021",
      "tp-flavornet",
      "tp-janta2024",
      "tp-booth2020"
    ]
  },
  {
    "id": "borneol",
    "name": "Bornéol",
    "synonyms": [
      "borneol"
    ],
    "isomerNotes": "Bornéol et isobornéol sont distingués ; le signe optique et la configuration détaillée ne sont pas établis dans la ligne de Booth.",
    "family": "oxygenated-monoterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Bornéol et isobornéol sont distingués ; le signe optique et la configuration détaillée ne sont pas établis dans la ligne de Booth."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Borneol, sans astérisque d’étalon.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Camphré.",
      "families": [
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin",
        "statement": "Tableau 1 : lignes borneol et endo-borneol ; ces libellés ne sont pas deux preuves de deux molécules distinctes dans cette fiche.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Les travaux sur la sauge caractérisent une synthase du diphosphate de bornyle, liée à la voie du bornéol ; ils ne mesurent pas un effet humain du bornéol présent dans le cannabis.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-sage1998"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-herbs2021",
      "tp-sage1998",
      "tp-flavornet"
    ]
  },
  {
    "id": "alpha-terpineol",
    "name": "α-Terpinéol",
    "synonyms": [
      "alpha-terpineol"
    ],
    "isomerNotes": "Le terpinéol est un ensemble de formes ; α-terpinéol, terpinen-4-ol et les autres terpinéols ne sont pas interchangeables. Booth précise (+).",
    "family": "oxygenated-monoterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Le terpinéol est un ensemble de formes ; α-terpinéol, terpinen-4-ol et les autres terpinéols ne sont pas interchangeables. Booth précise (+)."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : (+)-α-terpineol*.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Mentholé, anisé.",
      "families": [
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin et lavande",
        "statement": "Tableaux 1–2 : α-terpinéol dans les huiles.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS17(BC) et CsTPS32(PK) forment de l’α-terpinéol parmi leurs produits. La formation d’un alcool peut accompagner celle d’hydrocarbures par une même synthase.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-herbs2021",
      "tp-flavornet"
    ]
  },
  {
    "id": "terpinen4-ol",
    "name": "Terpinène-4-ol",
    "synonyms": [
      "terpinen-4-ol",
      "4-terpineol"
    ],
    "isomerNotes": "Le groupement alcool n’occupe pas la même position que dans l’α-terpinéol. La méthode ne donne pas le rapport des énantiomères.",
    "family": "oxygenated-monoterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Le groupement alcool n’occupe pas la même position que dans l’α-terpinéol. La méthode ne donne pas le rapport des énantiomères."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 22, et tableau 2, ligne 22 : terpinen-4-ol.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Muscade, térébenthine.",
      "families": [
        "spicy",
        "woody"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin et lavande",
        "statement": "Tableaux 1–2 : présence analytique dans les huiles.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Ovidi compare ce composé dans une huile et un hydrolat. Cette répartition entre produits ne démontre pas une fonction biologique ni l’effet de la molécule isolée.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022",
      "tp-herbs2021",
      "tp-flavornet"
    ]
  },
  {
    "id": "eucalyptol",
    "name": "1,8-Cinéole",
    "synonyms": [
      "eucalyptol",
      "1,8-cineole"
    ],
    "isomerNotes": "Eucalyptol et 1,8-cinéole sont ici un seul composé ; le 1,4-cinéole est différent. C’est un éther oxygéné, pas un alcool.",
    "family": "oxygenated-monoterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Eucalyptol et 1,8-cinéole sont ici un seul composé ; le 1,4-cinéole est différent. C’est un éther oxygéné, pas un alcool."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 2, ligne 12 : 1,8-cineole dans l’hydrolat de chanvre.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Mentholé.",
      "families": [
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin",
        "statement": "Tableau 1 : 1,8-cinéole dans l’huile et la phase vapeur.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "La 1,8-cinéole synthase de sauge a été caractérisée ; ce résultat concerne la biosynthèse d’un éther et ne prouve aucun bénéfice de son inhalation.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-sage1998"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022",
      "tp-herbs2021",
      "tp-sage1998",
      "tp-flavornet"
    ]
  },
  {
    "id": "p-cymene",
    "name": "p-Cymène",
    "synonyms": [
      "para-cymène",
      "p-cymene"
    ],
    "isomerNotes": "Hydrocarbure aromatique à dix carbones ; p désigne la position para. L’o-cymène de l’inventaire n’est pas un synonyme.",
    "family": "monoterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Hydrocarbure aromatique à dix carbones ; p désigne la position para. L’o-cymène de l’inventaire n’est pas un synonyme."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 12 et tableau 2, ligne 11 : p-cymene.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Agrumes ; note d’essence également rapportée.",
      "families": [
        "citrus",
        "other"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin et lavande",
        "statement": "Tableaux 1–2 : p-cymène présent dans les huiles.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Le corpus retenu documente sa détection dans des produits végétaux. Il ne teste pas le rôle écologique du p-cymène isolé dans le cannabis.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022",
      "tp-herbs2021",
      "tp-flavornet"
    ]
  },
  {
    "id": "beta-caryophyllene",
    "name": "β-Caryophyllène",
    "synonyms": [
      "(E)-β-caryophyllène",
      "beta-caryophyllene"
    ],
    "isomerNotes": "Cette fiche concerne la forme usuelle β/(E). L’isocaryophyllène est traité séparément ; l’oxyde possède en plus un oxygène et n’est pas le même composé.",
    "family": "sesquiterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Cette fiche concerne la forme usuelle β/(E). L’isocaryophyllène est traité séparément ; l’oxyde possède en plus un oxygène et n’est pas le même composé."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : β-caryophyllene* ; Fischedick, tableaux 1–2.",
        "sourceIds": [
          "tp-booth2020",
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Boisé, épicé.",
      "families": [
        "woody",
        "spicy"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Houblon (Humulus lupulus)",
        "statement": "Tableau 6 : (E)-β-caryophyllène.",
        "sourceIds": [
          "tp-hops2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Dans une expérience sur le maïs, le (E)-β-caryophyllène émis par des racines attaquées attire des nématodes qui parasitent l’insecte.",
        "model": "plant-ecology",
        "limitations": "Résultat propre au système expérimental décrit ; aucune extrapolation au cannabis ou à la santé humaine.",
        "sourceIds": [
          "tp-maize2005"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-hops2021",
      "tp-maize2005",
      "tp-flavornet",
      "tp-fischedick2017"
    ]
  },
  {
    "id": "alpha-humulene",
    "name": "α-Humulène",
    "synonyms": [
      "humulène",
      "alpha-humulene",
      "α-caryophyllène"
    ],
    "isomerNotes": "α-caryophyllène est un ancien synonyme de l’humulène ; il ne faut pas le confondre avec le β-caryophyllène.",
    "family": "sesquiterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "α-caryophyllène est un ancien synonyme de l’humulène ; il ne faut pas le confondre avec le β-caryophyllène."
      ],
      "sourceIds": [
        "tp-booth2020",
        "tp-identity-humulene"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : α-humulene* ; Fischedick : Humulene.",
        "sourceIds": [
          "tp-booth2020",
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Boisé.",
      "families": [
        "woody"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Houblon (Humulus lupulus)",
        "statement": "Tableau 6 : α-humulène des huiles corses.",
        "sourceIds": [
          "tp-hops2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS9 de Finola forme à la fois β-caryophyllène et α-humulène. Une association dans un profil peut ainsi avoir une origine enzymatique partagée.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-hops2021",
      "tp-booth2017",
      "tp-flavornet",
      "tp-identity-humulene",
      "tp-fischedick2017"
    ]
  },
  {
    "id": "e-beta-farnesene",
    "name": "(E)-β-Farnésène",
    "synonyms": [
      "trans-β-farnésène",
      "(E)-beta-farnesene"
    ],
    "isomerNotes": "La forme E est précisée dans le tableau ; ni α-farnésène ni (Z)-β-farnésène ne doivent être additionnés sous une identité unique.",
    "family": "sesquiterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "La forme E est précisée dans le tableau ; ni α-farnésène ni (Z)-β-farnésène ne doivent être additionnés sous une identité unique."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : (E)-β-farnesene*.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Agrumes, herbacé.",
      "families": [
        "citrus",
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-hops2021"
      ]
    },
    "otherPlants": [
      {
        "name": "Houblon (Humulus lupulus)",
        "statement": "Tableau 6 : (E)-β-farnésène.",
        "sourceIds": [
          "tp-hops2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS25(LS) forme surtout du (E)-β-farnésène dans l’essai enzymatique. Cet essai n’évalue pas son éventuel rôle de signal chez les insectes.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-hops2021",
      "tp-flavornet"
    ]
  },
  {
    "id": "alpha-farnesene",
    "name": "α-Farnésènes",
    "synonyms": [
      "alpha-farnesene",
      "(Z,E)-α-farnésène",
      "(E,E)-α-farnésène"
    ],
    "isomerNotes": "Fiche regroupée car la ligne florale de Booth ne précise pas la géométrie. (Z,E) et (E,E) restent nommés dans leur contexte, sans prétendre à une composition identique.",
    "family": "sesquiterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Fiche regroupée car la ligne florale de Booth ne précise pas la géométrie. (Z,E) et (E,E) restent nommés dans leur contexte, sans prétendre à une composition identique."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : α-farnesene ; fonctions CsTPS25 : (Z,E)-α-farnésène ; Janta, tableau 2, pic 52.",
        "sourceIds": [
          "tp-booth2020",
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Boisé, doux ; dépend de la forme étudiée.",
      "families": [
        "woody"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Houblon (Humulus lupulus)",
        "statement": "Tableau 6 : (E,E)-α-farnésène, forme précisée pour ces échantillons.",
        "sourceIds": [
          "tp-hops2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS25(LS) produit du (Z,E)-α-farnésène en plus du β-farnésène ; la position des doubles liaisons et leur géométrie comptent pour décrire le produit.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-hops2021",
      "tp-flavornet",
      "tp-janta2024"
    ]
  },
  {
    "id": "alpha-bergamotene",
    "name": "α-Bergamotènes",
    "synonyms": [
      "alpha-bergamotene",
      "cis-α-bergamotène",
      "trans-α-bergamotène"
    ],
    "isomerNotes": "Booth ne précise pas cis/trans dans cette ligne. Janta propose cis ; l’étude du houblon précise (E). Ces preuves ne sont pas fusionnées en un isomère prétendument certain.",
    "family": "sesquiterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Booth ne précise pas cis/trans dans cette ligne. Janta propose cis ; l’étude du houblon précise (E). Ces preuves ne sont pas fusionnées en un isomère prétendument certain."
      ],
      "sourceIds": [
        "tp-booth2020",
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : α-bergamotene ; Janta, tableau 2, pic 36 : proposition cis-α-bergamotène.",
        "sourceIds": [
          "tp-booth2020",
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Boisé pour le (E)-α-bergamotène de l’index ; autre géométrie non caractérisée ici.",
      "families": [
        "woody"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Houblon (Humulus lupulus)",
        "statement": "Tableau 6 : (E)-α-bergamotène identifié dans les huiles.",
        "sourceIds": [
          "tp-hops2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Le corpus documente des profils végétaux et des attributions analytiques ; il ne démontre pas la fonction écologique de chaque α-bergamotène dans le cannabis.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-hops2021",
      "tp-flavornet",
      "tp-janta2024"
    ]
  },
  {
    "id": "alpha-selinene",
    "name": "α-Sélinène",
    "synonyms": [
      "alpha-selinene"
    ],
    "isomerNotes": "α et β-sélinène sont distincts ; l’identification MS/indice ne suffit pas à attribuer tous les centres stéréogènes.",
    "family": "sesquiterpene-hydrocarbon",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "α et β-sélinène sont distincts ; l’identification MS/indice ne suffit pas à attribuer tous les centres stéréogènes."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : α-selinene, sans astérisque.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Herbacé.",
      "families": [
        "herbal"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-hops2021"
      ]
    },
    "otherPlants": [
      {
        "name": "Houblon (Humulus lupulus)",
        "statement": "Tableau 6 et §3.3 : α-sélinène dans les huiles.",
        "sourceIds": [
          "tp-hops2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS28(PK) produit de l’α-sélinène parmi plusieurs sesquiterpènes. La caractérisation fonctionnelle apporte une piste de biosynthèse, pas une preuve de rôle défensif.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-hops2021",
      "tp-flavornet"
    ]
  },
  {
    "id": "guaiol",
    "name": "Guaiol",
    "synonyms": [
      "guaiac alcohol",
      "guiaol (graphie du tableau Booth)"
    ],
    "isomerNotes": "Le guaiol est un alcool sesquiterpénique. La graphie « Guiaol » du tableau n’est pas une autre molécule ; le signe optique n’est pas démontré ici.",
    "family": "oxygenated-sesquiterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Le guaiol est un alcool sesquiterpénique. La graphie « Guiaol » du tableau n’est pas une autre molécule ; le signe optique n’est pas démontré ici."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Guiaol ; Janta, tableau 2, pic 70 : Guaiol.",
        "sourceIds": [
          "tp-booth2020",
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Boisé, balsamique.",
      "families": [
        "woody"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Eucalyptus oleosa",
        "statement": "Tableau original indexé, ligne 51 : guaiol dans les huiles étudiées.",
        "sourceIds": [
          "tp-eucalyptus2011"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Les sources citées établissent un profil analytique. Elles ne testent pas séparément un rôle écologique du guaiol chez le cannabis ; les tests d’huiles entières ne lui sont pas attribués.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-eucalyptus2011",
      "tp-flavornet",
      "tp-janta2024"
    ]
  },
  {
    "id": "alpha-bisabolol",
    "name": "α-Bisabolol",
    "synonyms": [
      "alpha-bisabolol"
    ],
    "isomerNotes": "Plusieurs stéréoisomères existent. Lévoménol désigne une forme particulière ; cette fiche ne traite pas ce nom comme une preuve que tous les pics sont du lévoménol.",
    "family": "oxygenated-sesquiterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Plusieurs stéréoisomères existent. Lévoménol désigne une forme particulière ; cette fiche ne traite pas ce nom comme une preuve que tous les pics sont du lévoménol."
      ],
      "sourceIds": [
        "tp-fischedick2017"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’analyse de fleurs commercialisées : 233 échantillons, 30 noms de cultivars et 16 analytes ciblés. Cela ne constitue pas le profil d’un Buddy.",
        "locator": "Tableau 1 : α-Bisabolol ; Booth 2020, tableau 1, astérisque.",
        "sourceIds": [
          "tp-fischedick2017",
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Floral, épicé.",
      "families": [
        "floral",
        "spicy"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Camomille allemande (Matricaria recutita)",
        "statement": "Résumé original : α-bisabolol et étude de sa biosynthèse.",
        "sourceIds": [
          "tp-chamomile2023"
        ]
      }
    ],
    "biology": [
      {
        "statement": "MrBBS de camomille est étudiée comme enzyme formant l’α-bisabolol. Une fonction de biosynthèse ne démontre pas un usage médical de la molécule.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-chamomile2023"
        ]
      }
    ],
    "sourceIds": [
      "tp-fischedick2017",
      "tp-chamomile2023",
      "tp-flavornet",
      "tp-booth2020"
    ]
  },
  {
    "id": "nerolidol",
    "name": "Nérolidol",
    "synonyms": [
      "nerolidol",
      "(E)-nérolidol"
    ],
    "isomerNotes": "Zager caractérise le produit (E)-nérolidol des synthases. La fiche ne déduit pas automatiquement la configuration de tous les centres chiraux ou la forme Z d’un simple nom générique.",
    "family": "oxygenated-sesquiterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-FID pour les profils végétaux",
        "GC-MS pour les produits enzymatiques",
        "étalons authentiques"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Zager caractérise le produit (E)-nérolidol des synthases. La fiche ne déduit pas automatiquement la configuration de tous les centres chiraux ou la forme Z d’un simple nom générique."
      ],
      "sourceIds": [
        "tp-zager2019"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les boutons floraux analysés ; nérolidol quantifiable seulement dans l’échantillon nommé Black Lime de cette étude.",
        "locator": "Tableau 1 : nérolidol quantifiable dans Black Lime ; figures 7–8 et méthodes de caractérisation.",
        "sourceIds": [
          "tp-zager2019"
        ]
      }
    ],
    "aroma": {
      "description": "Floral, boisé.",
      "families": [
        "floral",
        "woody"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Muflier (Antirrhinum majus)",
        "statement": "Résumé original : nérolidol émis par les fleurs.",
        "sourceIds": [
          "tp-snapdragon2008"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS18VF et CsTPS19BL forment du (E)-nérolidol dans les essais ; des synthases proches participent au parfum floral du muflier.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-zager2019"
        ]
      }
    ],
    "sourceIds": [
      "tp-zager2019",
      "tp-snapdragon2008",
      "tp-flavornet"
    ]
  },
  {
    "id": "gamma-eudesmol",
    "name": "γ-Eudesmol",
    "synonyms": [
      "gamma-eudesmol"
    ],
    "isomerNotes": "À distinguer des α-, β- et 10-épi-γ-eudesmols. Les descripteurs d’un « eudesmol » non précisé ne prouvent pas ceux de chaque isomère.",
    "family": "oxygenated-sesquiterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "À distinguer des α-, β- et 10-épi-γ-eudesmols. Les descripteurs d’un « eudesmol » non précisé ne prouvent pas ceux de chaque isomère."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : γ-eudesmol ; Booth 2017, figure 5.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Odeur propre non établie dans les sources sensorielles retenues.",
      "families": [
        "other"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [
      {
        "name": "Eucalyptus oleosa",
        "statement": "Tableau original indexé, ligne 53 : γ-eudesmol.",
        "sourceIds": [
          "tp-eucalyptus2011"
        ]
      }
    ],
    "biology": [
      {
        "statement": "CsTPS8 de Finola forme notamment du γ-eudesmol ; le contrôle d’un artefact thermique montre pourquoi l’identité d’un pic mérite plusieurs vérifications.",
        "model": "plant-enzyme",
        "limitations": "Fonction enzymatique étudiée, distincte d’une fonction écologique démontrée ou d’un effet clinique.",
        "sourceIds": [
          "tp-booth2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-eucalyptus2011",
      "tp-booth2017",
      "tp-flavornet"
    ]
  },
  {
    "id": "caryophyllene-oxide",
    "name": "Oxyde de caryophyllène",
    "synonyms": [
      "caryophyllene oxide"
    ],
    "isomerNotes": "Composé oxygéné distinct du β-caryophyllène. Le nom seul ne donne pas l’origine exacte de l’oxydation, avant ou après récolte.",
    "family": "oxygenated-sesquiterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice de rétention"
      ],
      "statement": "Attribution étayée par le spectre de masse et l’indice de rétention, sans confirmation par étalon revendiquée pour cette ligne.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Composé oxygéné distinct du β-caryophyllène. Le nom seul ne donne pas l’origine exacte de l’oxydation, avant ou après récolte."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Caryophyllene oxide ; Ovidi, tableau 1, ligne 47.",
        "sourceIds": [
          "tp-booth2020",
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Herbacé, épicé, doux.",
      "families": [
        "herbal",
        "spicy"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Romarin",
        "statement": "Tableau 1, ligne 26 : oxyde de caryophyllène dans l’huile.",
        "sourceIds": [
          "tp-herbs2021"
        ]
      }
    ],
    "biology": [
      {
        "statement": "Les comparaisons analytiques révèlent le composé sans établir sa fonction écologique. Sa présence ne prouve à elle seule ni fraîcheur ni altération d’un échantillon.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-herbs2021",
      "tp-flavornet",
      "tp-ovidi2022"
    ]
  },
  {
    "id": "geranyl-acetate",
    "name": "Acétate de géranyle",
    "synonyms": [
      "geranyl acetate"
    ],
    "isomerNotes": "Ester terpénique dérivé du géraniol, distinct de l’acétate de néryle ; il appartient aux monoterpénoïdes oxygénés malgré les deux carbones de l’acétate.",
    "family": "oxygenated-monoterpene",
    "detailLevel": "detailed",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "comparaison avec étalon publié"
      ],
      "statement": "La source retenue utilise un étalon authentique pour cette attribution ; cela renforce l’identité dans les échantillons analysés.",
      "limitations": [
        "La présence dans une étude ne garantit pas la présence dans toute plante ni dans un produit portant le même nom.",
        "Ester terpénique dérivé du géraniol, distinct de l’acétate de néryle ; il appartient aux monoterpénoïdes oxygénés malgré les deux carbones de l’acétate."
      ],
      "sourceIds": [
        "tp-fischedick2017"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’analyse de fleurs commercialisées : 233 échantillons, 30 noms de cultivars et 16 analytes ciblés. Cela ne constitue pas le profil d’un Buddy.",
        "locator": "Tableau 1 : Geranyl-acetate ; tableau 2 : détections variables.",
        "sourceIds": [
          "tp-fischedick2017"
        ]
      }
    ],
    "aroma": {
      "description": "Rose.",
      "families": [
        "floral"
      ],
      "limitations": "Repères qualitatifs documentaires, pas une mesure d’intensité. La perception dépend de la forme chimique, de la concentration, du mélange et de la personne ; ces mots ne prédisent aucun effet.",
      "sourceIds": [
        "tp-flavornet"
      ]
    },
    "otherPlants": [
      {
        "name": "Lavande (Lavandula angustifolia)",
        "statement": "Tableau 1, ligne 29 : geranyl acetate dans les absolues.",
        "sourceIds": [
          "tp-lavender2022"
        ]
      }
    ],
    "biology": [
      {
        "statement": "L’étude cannabis mesure ce composé pour comparer des profils. Elle ne teste pas un rôle écologique ou un effet humain de l’acétate isolé.",
        "model": "analytical",
        "limitations": "L’analyse constate une présence ; elle ne teste pas un mécanisme écologique ou thérapeutique.",
        "sourceIds": [
          "tp-fischedick2017"
        ]
      }
    ],
    "sourceIds": [
      "tp-fischedick2017",
      "tp-lavender2022",
      "tp-flavornet"
    ]
  },
  {
    "id": "beta-phellandrene",
    "name": "β-Phellandrène",
    "family": "monoterpene-hydrocarbon",
    "synonyms": [
      "beta-phellandrene"
    ],
    "isomerNotes": "Distinct de l’α-phellandrène ; énantiomère non précisé dans la ligne.",
    "detailLevel": "inventory",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "étalon authentique"
      ],
      "statement": "Attribution comparée à un étalon dans la source.",
      "limitations": [
        "Distinct de l’α-phellandrène ; énantiomère non précisé dans la ligne.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : β-phellandrene*.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020"
    ]
  },
  {
    "id": "delta-elemene",
    "name": "δ-Élémène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "La méthode et les possibles transformations thermiques doivent être considérées ; le tableau ne démontre pas une origine écologique.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "La méthode et les possibles transformations thermiques doivent être considérées ; le tableau ne démontre pas une origine écologique.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : δ-elemene.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020"
    ]
  },
  {
    "id": "gamma-elemene",
    "name": "γ-Élémène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Ne pas confondre avec δ- ou β-élémène ; les configurations fines ne sont pas établies ici.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Ne pas confondre avec δ- ou β-élémène ; les configurations fines ne sont pas établies ici.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : γ-elemene.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020"
    ]
  },
  {
    "id": "pinan2-ol",
    "name": "Pinan-2-ol",
    "family": "oxygenated-monoterpene",
    "synonyms": [
      "2-pinanol",
      "trans-2-pinanol"
    ],
    "isomerNotes": "Une seule fiche pour le nom général et la forme trans proposée ; aucune certitude sur tous les stéréoisomères.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Une seule fiche pour le nom général et la forme trans proposée ; aucune certitude sur tous les stéréoisomères.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : 2-pinanol ; Janta, tableau 2, pic 31 : trans-2-pinanol proposé.",
        "sourceIds": [
          "tp-booth2020",
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-janta2024"
    ]
  },
  {
    "id": "delta-selinene",
    "name": "δ-Sélinène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le préfixe δ distingue ce composé des sélinènes α et β.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Le préfixe δ distingue ce composé des sélinènes α et β.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : δ-selinene.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020"
    ]
  },
  {
    "id": "beta-selinene",
    "name": "β-Sélinène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [
      "β-eudesmène",
      "beta-eudesmene"
    ],
    "isomerNotes": "β-eudesmène est un synonyme structurel vérifié ; la configuration optique de la notice PubChem n’est pas déduite de cette analyse.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "β-eudesmène est un synonyme structurel vérifié ; la configuration optique de la notice PubChem n’est pas déduite de cette analyse.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022",
        "tp-identity-selinene"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 38 : β-eudesmene ; Janta, tableau 2, pic 49.",
        "sourceIds": [
          "tp-ovidi2022",
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022",
      "tp-identity-selinene",
      "tp-janta2024"
    ]
  },
  {
    "id": "selina-3-7-11-diene",
    "name": "Sélina-3,7(11)-diène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [
      "eudesma-3,7(11)-diène",
      "selina-3,7(11)-diene"
    ],
    "isomerNotes": "Les noms eudesma et selina de cette structure sont regroupés ; cela n’établit pas la configuration chirale des échantillons.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Les noms eudesma et selina de cette structure sont regroupés ; cela n’établit pas la configuration chirale des échantillons.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020",
        "tp-identity-selinadiene"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Eudesma-3,7(11)-diene ; Ovidi, tableau 1, ligne 45 ; Janta, pic 58.",
        "sourceIds": [
          "tp-booth2020",
          "tp-janta2024",
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020",
      "tp-identity-selinadiene",
      "tp-janta2024",
      "tp-ovidi2022"
    ]
  },
  {
    "id": "germacrene-b",
    "name": "Germacrène B",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le B distingue ce composé des germacrènes A et D. Ne pas inférer leur présence à partir de celle de B.",
    "detailLevel": "inventory",
    "identification": {
      "level": "reference-standard",
      "methods": [
        "GC-MS",
        "étalon authentique"
      ],
      "statement": "Attribution comparée à un étalon dans la source.",
      "limitations": [
        "Le B distingue ce composé des germacrènes A et D. Ne pas inférer leur présence à partir de celle de B.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Germacrene B*.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020"
    ]
  },
  {
    "id": "valencene",
    "name": "Valencène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le nom seul ne fixe pas l’énantiomère ; certains échantillons sont non détectés.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Le nom seul ne fixe pas l’énantiomère ; certains échantillons sont non détectés.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Valencene.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020"
    ]
  },
  {
    "id": "bulnesol",
    "name": "Bulnésol",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "Alcool distinct du bulnésène, qui ne possède pas ce groupement oxygéné.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Alcool distinct du bulnésène, qui ne possède pas ce groupement oxygéné.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans les profils de fleurs matures de cannabis du tableau 1 ; la détection varie entre échantillons.",
        "locator": "Tableau 1 : Bulnesol.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-booth2020"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "tp-booth2020"
    ]
  },
  {
    "id": "isoborneol",
    "name": "Isobornéol",
    "family": "oxygenated-monoterpene",
    "synonyms": [],
    "isomerNotes": "Distinct du bornéol ; quantité en trace dans l’huile n’est pas une absence et ne permet pas un profil universel.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Distinct du bornéol ; quantité en trace dans l’huile n’est pas une absence et ne permet pas un profil universel.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 21 (traces) ; tableau 2, ligne 20.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "cis-sabinene-hydrate",
    "name": "Hydrate de sabinène cis",
    "family": "oxygenated-monoterpene",
    "synonyms": [],
    "isomerNotes": "Le préfixe cis est conservé ; cette détection ne démontre pas celle de l’isomère trans.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Le préfixe cis est conservé ; cette détection ne démontre pas celle de l’isomère trans.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 16 ; Janta, tableau 2, pic 25.",
        "sourceIds": [
          "tp-ovidi2022",
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022",
      "tp-janta2024"
    ]
  },
  {
    "id": "humulene-epoxide-ii",
    "name": "Époxyde d’humulène II",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "Le chiffre II reste celui du composé proposé par la source ; aucune fusion avec tous les oxydes d’humulène.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Le chiffre II reste celui du composé proposé par la source ; aucune fusion avec tous les oxydes d’humulène.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 48 : humulene epoxide II.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "isocaryophyllene",
    "name": "Isocaryophyllène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Attribution plus fragile sans indice de référence dans ce tableau ; ne pas la convertir en certitude ou la fusionner avec β-caryophyllène.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Attribution plus fragile sans indice de référence dans ce tableau ; ne pas la convertir en certitude ou la fusionner avec β-caryophyllène.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 33 : isocaryophyllene ; indice de référence absent.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "alpha-gurjunene",
    "name": "α-Gurjunène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "À distinguer des gurjunènes β et γ ; stéréochimie complète non établie.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "À distinguer des gurjunènes β et γ ; stéréochimie complète non établie.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 34.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "alpha-himachalene",
    "name": "α-Himachalène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Une identification α ne démontre pas les formes β ou γ.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Une identification α ne démontre pas les formes β ou γ.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 36.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "gamma-gurjunene",
    "name": "γ-Gurjunène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Attribution MS/indice ; pas de confirmation chirale.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Attribution MS/indice ; pas de confirmation chirale.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 41.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "beta-maaliene",
    "name": "β-Maaliène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Identification provisoire ; la concordance de noms entre études ne remplace pas un étalon commun.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Identification provisoire ; la concordance de noms entre études ne remplace pas un étalon commun.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 44 ; Ovidi, tableau 1, ligne 42, sans indice bibliographique.",
        "sourceIds": [
          "tp-janta2024",
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024",
      "tp-ovidi2022"
    ]
  },
  {
    "id": "cedr-8-en-15-ol",
    "name": "Cédr-8-én-15-ol",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "Nom proposé conservé avec réserve ; aucune configuration ou odeur précise ajoutée.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Nom proposé conservé avec réserve ; aucune configuration ou odeur précise ajoutée.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 50 : cedr-8-en-15-ol ; indice de référence absent.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "ledene-oxide-ii",
    "name": "Oxyde de lédène II",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "Ligne analytique à confirmer, notamment son indice expérimental atypique dans ce tableau ; pas une identité certaine.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Ligne analytique à confirmer, notamment son indice expérimental atypique dans ce tableau ; pas une identité certaine.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 51 : ledene oxide II ; indice de référence absent.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "eudesm-7-11-en-4-ol",
    "name": "Eudesm-7(11)-én-4-ol",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "Nom de position conservé ; la source ne suffit pas à le renommer en un stéréoisomère plus précis.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Nom de position conservé ; la source ne suffit pas à le renommer en un stéréoisomère plus précis.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 1, ligne 54.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "p-cymenene",
    "name": "p-Cyménène",
    "family": "monoterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Hydrocarbure distinct du p-cymène, malgré la proximité des noms.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Hydrocarbure distinct du p-cymène, malgré la proximité des noms.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 2, ligne 15 : p-cymenene dans l’hydrolat.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "p-mentha-1-3-8-triene",
    "name": "p-Mentha-1,3,8-triène",
    "family": "monoterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "L’absence d’indice de référence affaiblit l’attribution ; aucune isomérie supplémentaire n’est supposée.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "L’absence d’indice de référence affaiblit l’attribution ; aucune isomérie supplémentaire n’est supposée.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 2, ligne 19 : 1,3,8-p-menthatriene ; indice de référence absent.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "cis-p-mentha-2-8-dien-1-ol",
    "name": "cis-p-Mentha-2,8-dién-1-ol",
    "family": "oxygenated-monoterpene",
    "synonyms": [],
    "isomerNotes": "Composé rapporté dans un hydrolat ; ne pas le présenter comme une proportion de fleur intacte.",
    "detailLevel": "inventory",
    "identification": {
      "level": "ri-ms-supported",
      "methods": [
        "GC-MS",
        "spectre de masse",
        "indice si disponible"
      ],
      "statement": "Attribution fondée sur MS et indice de rétention, sans étalon déclaré pour cette ligne.",
      "limitations": [
        "Composé rapporté dans un hydrolat ; ne pas le présenter comme une proportion de fleur intacte.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Rapporté dans l’huile essentielle ou l’hydrolat de chanvre Kompolti, selon la colonne précisée ; produit transformé, pas fleur intacte.",
        "locator": "Tableau 2, ligne 21.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-ovidi2022"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-ovidi2022"
        ]
      }
    ],
    "sourceIds": [
      "tp-ovidi2022"
    ]
  },
  {
    "id": "alpha-eudesmol",
    "name": "α-Eudesmol",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "Attribution provisoire ; différente du β-, γ- et 10-épi-γ-eudesmol. La ligne Ovidi correspond au houblon, pas au chanvre : elle n’est pas utilisée comme preuve cannabis.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Attribution provisoire ; différente du β-, γ- et 10-épi-γ-eudesmol. La ligne Ovidi correspond au houblon, pas au chanvre : elle n’est pas utilisée comme preuve cannabis.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024",
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 74 : α-Eudesmol.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024",
      "tp-ovidi2022"
    ]
  },
  {
    "id": "beta-eudesmol",
    "name": "β-Eudesmol",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "Score MS et indice étayent une proposition ; pas d’étalon ni de configuration complète démontrée.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Score MS et indice étayent une proposition ; pas d’étalon ni de configuration complète démontrée.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 75 : β-Eudesmol.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "10-epi-gamma-eudesmol",
    "name": "10-épi-γ-Eudesmol",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "L’épimère annoncé reste une proposition analytique, distincte de la fiche γ-eudesmol.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "L’épimère annoncé reste une proposition analytique, distincte de la fiche γ-eudesmol.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 71 : 10-epi-g-Eudesmol.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "alpha-cubebene",
    "name": "α-Cubébène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "α ne démontre pas β ; une colonne non chirale ne résout pas les formes miroir.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "α ne démontre pas β ; une colonne non chirale ne résout pas les formes miroir.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 26.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "ylangene",
    "name": "Ylangène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "La source n’explicite pas α/β dans ce libellé ; le titre de fiche n’ajoute pas cette précision.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "La source n’explicite pas α/β dans ce libellé ; le titre de fiche n’ajoute pas cette précision.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 27 : Ylangene.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "copaene",
    "name": "Copaène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Pas de préfixe α ajouté : il n’est pas donné dans la ligne citée. La présence d’α-copaène dans la colonne houblon d’Ovidi n’est pas une preuve cannabis.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Pas de préfixe α ajouté : il n’est pas donné dans la ligne citée. La présence d’α-copaène dans la colonne houblon d’Ovidi n’est pas une preuve cannabis.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024",
        "tp-ovidi2022"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 28 : Copaene.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024",
      "tp-ovidi2022"
    ]
  },
  {
    "id": "di-epi-alpha-cedrene",
    "name": "Di-épi-α-cédrène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le préfixe du nom proposé est conservé, mais la méthode n’établit pas une configuration absolue complète.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Le préfixe du nom proposé est conservé, mais la méthode n’établit pas une configuration absolue complète.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 29.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "alpha-longipinene",
    "name": "α-Longipinène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Attribution de bibliothèque et indice ; distinct du pinène monoterpénique.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Attribution de bibliothèque et indice ; distinct du pinène monoterpénique.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 33.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "longicyclene",
    "name": "Longicyclène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Pas de preuve indépendante par étalon dans ce corpus.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Pas de preuve indépendante par étalon dans ce corpus.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 34.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "aristolene",
    "name": "Aristolène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le signe (−) de la bibliothèque n’est pas revendiqué comme démontré par DB-WAX ; il est donc retiré du titre.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Le signe (−) de la bibliothèque n’est pas revendiqué comme démontré par DB-WAX ; il est donc retiré du titre.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 37, libellé source (−)-Aristolene.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "beta-gurjunene",
    "name": "β-Gurjunène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Distinct des gurjunènes α et γ ; identité proposée à confirmer.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Distinct des gurjunènes α et γ ; identité proposée à confirmer.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 40.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "alpha-bulnesene",
    "name": "α-Bulnésène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Hydrocarbure différent du bulnésol ; stéréochimie complète non démontrée.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Hydrocarbure différent du bulnésol ; stéréochimie complète non démontrée.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 41.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "sesquisabinene",
    "name": "Sesquisabinène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le nom de la source ne précise pas tous les isomères ; pas d’ajout de suffixe arbitraire.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Le nom de la source ne précise pas tous les isomères ; pas d’ajout de suffixe arbitraire.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 42.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "viridiflorene",
    "name": "Viridiflorène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "À distinguer du viridiflorol, alcool oxygéné qui n’est pas démontré par ce seul pic.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "À distinguer du viridiflorol, alcool oxygéné qui n’est pas démontré par ce seul pic.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 47.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "gamma-himachalene",
    "name": "γ-Himachalène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Attribution provisoire ; ce n’est pas un synonyme de l’α-himachalène.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Attribution provisoire ; ce n’est pas un synonyme de l’α-himachalène.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 48.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "beta-cadinene",
    "name": "β-Cadinène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le signe optique du libellé n’est pas démontré par la méthode non chirale ; titre limité à β-cadinène.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Le signe optique du libellé n’est pas démontré par la méthode non chirale ; titre limité à β-cadinène.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 50, libellé source (−)-β-Cadinene.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "gamma-amorphene",
    "name": "γ-Amorphène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Nom proposé et non nouvelle identification par l’école.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Nom proposé et non nouvelle identification par l’école.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 53.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "alpha-muurolene",
    "name": "α-Muurolène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Garder α distinct des muurolènes γ et δ ; configuration absolue non établie.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Garder α distinct des muurolènes γ et δ ; configuration absolue non établie.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 54.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "eremophila-1-10-11-diene",
    "name": "Érémophila-1(10),11-diène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le nom de bibliothèque est une hypothèse analytique, pas une preuve isolée de structure.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Le nom de bibliothèque est une hypothèse analytique, pas une preuve isolée de structure.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 55, y compris seconde partie des échantillons.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "alpha-dehydro-ar-himachalene",
    "name": "α-Déhydro-ar-himachalène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Dérivé aromatique : aucune conversion biologique précise n’est déduite du nom.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Dérivé aromatique : aucune conversion biologique précise n’est déduite du nom.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 64.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "trans-alpha-bisabolene",
    "name": "trans-α-Bisabolène",
    "family": "sesquiterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Hydrocarbure sans oxygène ; la grande catégorie « sesquiterpenoids » de la source ne doit pas le faire classer comme alcool.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Hydrocarbure sans oxygène ; la grande catégorie « sesquiterpenoids » de la source ne doit pas le faire classer comme alcool.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 56.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "di-epi-1-10-cubenol",
    "name": "Di-épi-1,10-cubénol",
    "family": "oxygenated-sesquiterpene",
    "synonyms": [],
    "isomerNotes": "Préfixes conservés comme proposition ; pas de structure absolue établie par étalon.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Préfixes conservés comme proposition ; pas de structure absolue établie par étalon.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 69, seconde partie des échantillons.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "o-cymene",
    "name": "o-Cymène",
    "family": "monoterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Isomère ortho distinct du p-cymène ; ne pas regrouper les deux noms.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Isomère ortho distinct du p-cymène ; ne pas regrouper les deux noms.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 13.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "fenchone",
    "name": "Fenchone",
    "family": "oxygenated-monoterpene",
    "synonyms": [],
    "isomerNotes": "Cétone, pas fenchol. L’absence d’indice bibliographique renforce la réserve malgré le score spectral.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Cétone, pas fenchol. L’absence d’indice bibliographique renforce la réserve malgré le score spectral.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 19 : Fenchone, indice de référence indiqué non disponible.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "cis-linalool-oxide",
    "name": "Oxyde de linalol cis",
    "family": "oxygenated-monoterpene",
    "synonyms": [],
    "isomerNotes": "La taille de cycle et la configuration complète ne sont pas précisées par ce nom ; aucune identité plus fine n’est ajoutée.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "La taille de cycle et la configuration complète ne sont pas précisées par ce nom ; aucune identité plus fine n’est ajoutée.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 24.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "beta-fenchol",
    "name": "β-Fenchol (attribution provisoire)",
    "family": "oxygenated-monoterpene",
    "synonyms": [],
    "isomerNotes": "Conservé séparément de l’étalon endo-fenchyl alcohol de Fischedick ; une confirmation structurelle serait nécessaire pour décider du regroupement.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Conservé séparément de l’étalon endo-fenchyl alcohol de Fischedick ; une confirmation structurelle serait nécessaire pour décider du regroupement.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024",
        "tp-fischedick2017"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 35, libellé b-Fenchol.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024",
      "tp-fischedick2017"
    ]
  },
  {
    "id": "citronellol",
    "name": "Citronellol",
    "family": "oxygenated-monoterpene",
    "synonyms": [],
    "isomerNotes": "Énantiomère non établi ; aucun lien automatique avec une odeur de citron ou un nom commercial.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Énantiomère non établi ; aucun lien automatique avec une odeur de citron ou un nom commercial.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 57, seconde partie des échantillons.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "nerol",
    "name": "Nérol",
    "family": "oxygenated-monoterpene",
    "synonyms": [
      "cis-géraniol",
      "cis-geraniol"
    ],
    "isomerNotes": "cis-géraniol désigne le nérol ; il reste distinct du géraniol trans. L’identification de cette étude est provisoire.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "cis-géraniol désigne le nérol ; il reste distinct du géraniol trans. L’identification de cette étude est provisoire.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024",
        "tp-identity-nerol"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 61, libellé cis-Geraniol.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024",
      "tp-identity-nerol"
    ]
  },
  {
    "id": "neral",
    "name": "Néral",
    "family": "oxygenated-monoterpene",
    "synonyms": [
      "β-citral",
      "beta-citral"
    ],
    "isomerNotes": "β-citral désigne le néral, aldéhyde oxygéné. Il est classé ici parmi les monoterpénoïdes oxygénés, même si la source le place sous « monoterpenes ».",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "β-citral désigne le néral, aldéhyde oxygéné. Il est classé ici parmi les monoterpénoïdes oxygénés, même si la source le place sous « monoterpenes ».",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024",
        "tp-identity-neral"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 45, libellé β-Citral.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024",
      "tp-identity-neral"
    ]
  },
  {
    "id": "carene-2",
    "name": "2-Carène (attributions regroupées)",
    "family": "monoterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Deux pics ne prouvent pas deux énantiomères sur une colonne non chirale. Regroupés sous un dossier provisoire, sans compter (+) comme molécule établie distincte.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Deux pics ne prouvent pas deux énantiomères sur une colonne non chirale. Regroupés sous un dossier provisoire, sans compter (+) comme molécule établie distincte.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pics 4 et 7 : 2-Carene et (+)-2-Carene.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  },
  {
    "id": "carene-4",
    "name": "4-Carène (attribution provisoire)",
    "family": "monoterpene-hydrocarbon",
    "synonyms": [],
    "isomerNotes": "Le signe (+) n’est pas établi par la méthode. Cette attribution de bibliothèque reste à confirmer ; elle n’est pas assimilée au 3-carène.",
    "detailLevel": "inventory",
    "identification": {
      "level": "tentative",
      "methods": [
        "HS-SPME-GC-MS",
        "bibliothèque NIST 14",
        "indice DB-WAX si disponible"
      ],
      "statement": "La source rapporte une attribution provisoire ou une identification insuffisamment confirmée ; elle est recensée avec cette réserve.",
      "limitations": [
        "Le signe (+) n’est pas établi par la méthode. Cette attribution de bibliothèque reste à confirmer ; elle n’est pas assimilée au 3-carène.",
        "Une entrée d’inventaire documente un signal rapporté ; elle ne garantit pas sa présence dans chaque cannabis."
      ],
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "cannabisEvidence": [
      {
        "statement": "Signal attribué provisoirement dans l’espace de tête de fleurs séchées parmi 19 échantillons commerciaux ; pas une identité garantie par étalon.",
        "locator": "Tableau 2, pic 6 : (+)-4-Carene.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "aroma": {
      "description": "Description spécifique non retenue sans vérification suffisante dans ce dossier.",
      "families": [
        "other"
      ],
      "limitations": "Aucune odeur ou intensité n’est inventée à partir du nom. L’absence de description ici ne signifie pas que le composé est inodore.",
      "sourceIds": [
        "tp-janta2024"
      ]
    },
    "otherPlants": [],
    "biology": [
      {
        "statement": "Le corpus retenu documente ici une identification analytique ; il n’établit pas de fonction biologique propre à ce composé.",
        "model": "analytical",
        "limitations": "Pas de conclusion écologique ou clinique déduite d’un signal chromatographique.",
        "sourceIds": [
          "tp-janta2024"
        ]
      }
    ],
    "sourceIds": [
      "tp-janta2024"
    ]
  }
];
