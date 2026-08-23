export const CBD_GLOSSARY_SOURCES = {
  mildeca: {
    name: "MILDECA — Le CBD",
    url: "https://www.drogues.gouv.fr/le-cbd",
  },
  marketStudy: {
    name: "MILDECA — étude de la composition des produits CBD",
    url: "https://www.drogues.gouv.fr/etude-cbd",
  },
  food2026: {
    name: "Ministère de l’Agriculture — denrées alimentaires contenant du CBD",
    url: "https://agriculture.gouv.fr/node/110883",
  },
  novelFood: {
    name: "Ministère de l’Agriculture — nouveaux aliments et autorisation",
    url: "https://agriculture.gouv.fr/les-nouveaux-aliments-definition-et-procedure-dautorisation",
  },
  precautions: {
    name: "Drogues Info Service — CBD, risques et précautions",
    url: "https://www.drogues-info-service.fr/Tout-savoir-sur-les-drogues/Le-dico-des-drogues/CBD-cannabidiol",
  },
  organic: {
    name: "Ministère de l’Agriculture — certification biologique",
    url: "https://agriculture.gouv.fr/la-certification-en-agriculture-biologique",
  },
} as const;

export type CbdGlossarySourceId = keyof typeof CBD_GLOSSARY_SOURCES;

export type CbdGlossaryEntry = {
  slug: string;
  term: string;
  aliases?: readonly string[];
  definition: string;
  practicalCheck: string;
  sourceIds: readonly CbdGlossarySourceId[];
  relatedHref?: string;
  relatedLabel?: string;
};

export const CBD_GLOSSARY_ENTRIES: readonly CbdGlossaryEntry[] = [
  {
    slug: "cbd-cannabidiol",
    term: "CBD (cannabidiol)",
    aliases: ["cannabidiol"],
    definition:
      "Le CBD est un cannabinoïde présent dans le chanvre (Cannabis sativa L.). Il ne doit pas être confondu avec le THC et peut aussi être produit par synthèse.",
    practicalCheck:
      "Vérifier la quantité réellement annoncée, la composition complète et l’analyse correspondant au produit ou au lot.",
    sourceIds: ["mildeca", "marketStudy"],
    relatedHref: "/cbd-naturel",
    relatedLabel: "Comprendre le CBD naturel",
  },
  {
    slug: "chanvre",
    term: "Chanvre",
    aliases: ["Cannabis sativa L."],
    definition:
      "Le chanvre est le nom couramment donné à Cannabis sativa L. lorsqu’il est cultivé pour des usages agricoles ou industriels autorisés. Une même plante peut contenir plusieurs cannabinoïdes.",
    practicalCheck:
      "Demander la variété, l’identité du producteur, la région de culture et les documents disponibles pour la récolte concernée.",
    sourceIds: ["mildeca"],
    relatedHref: "/cbd-breton",
    relatedLabel: "Vérifier l’origine bretonne",
  },
  {
    slug: "cannabinoide",
    term: "Cannabinoïde",
    definition:
      "Un cannabinoïde est une substance de cette famille chimique. Le CBD et le delta-9-THC en font partie, tout comme d’autres molécules naturelles, semi-synthétiques ou synthétiques.",
    practicalCheck:
      "Lire la liste des cannabinoïdes recherchés par le laboratoire au lieu de déduire la composition à partir du seul nom commercial.",
    sourceIds: ["mildeca", "marketStudy"],
  },
  {
    slug: "thc",
    term: "THC (delta-9-tétrahydrocannabinol)",
    aliases: ["delta-9-THC", "Δ9-THC"],
    definition:
      "Le delta-9-THC est le cannabinoïde principalement associé aux effets stupéfiants du cannabis. La présence de CBD ne garantit pas l’absence de THC.",
    practicalCheck:
      "Contrôler la teneur mesurée sur l’analyse du lot et respecter les précautions de conduite, car des traces peuvent entraîner un dépistage positif.",
    sourceIds: ["mildeca", "precautions"],
  },
  {
    slug: "cbd-naturel",
    term: "CBD naturel",
    aliases: ["CBD d’origine végétale"],
    definition:
      "L’expression désigne généralement un cannabidiol provenant du chanvre plutôt qu’une molécule obtenue par synthèse. Elle ne constitue ni un label officiel ni une preuve de conformité.",
    practicalCheck:
      "Rapprocher l’origine déclarée, la composition, le producteur, le numéro de lot et l’analyse publiée.",
    sourceIds: ["mildeca"],
    relatedHref: "/cbd-naturel",
    relatedLabel: "Lire le guide CBD naturel",
  },
  {
    slug: "cbd-synthese",
    term: "CBD de synthèse",
    definition:
      "Le CBD de synthèse reproduit la molécule de cannabidiol par un procédé chimique sans extraction directe depuis la plante. Il doit être distingué des autres cannabinoïdes de synthèse ou semi-synthétiques.",
    practicalCheck:
      "Vérifier la dénomination exacte de chaque molécule et ne pas considérer les termes « CBD », « H4-CBD » ou « HHC » comme interchangeables.",
    sourceIds: ["mildeca"],
  },
  {
    slug: "full-spectrum",
    term: "Full spectrum",
    aliases: ["spectre complet"],
    definition:
      "Full spectrum est une appellation commerciale pour un extrait qui conserve plusieurs constituants du chanvre. Elle ne prouve pas à elle seule les teneurs présentes ni la conformité du produit.",
    practicalCheck:
      "Comparer la liste d’ingrédients et le profil de cannabinoïdes de l’analyse ; « spectre complet » ne signifie pas automatiquement « sans THC ».",
    sourceIds: ["marketStudy"],
    relatedHref: "/analyse-laboratoire-cbd",
    relatedLabel: "Lire une analyse CBD",
  },
  {
    slug: "broad-spectrum",
    term: "Broad spectrum",
    aliases: ["spectre large"],
    definition:
      "Broad spectrum est une appellation commerciale généralement utilisée pour un extrait contenant plusieurs constituants du chanvre avec retrait recherché du THC.",
    practicalCheck:
      "Une mention « sans THC » doit être vérifiée sur le rapport d’analyse et interprétée selon la limite de détection indiquée.",
    sourceIds: ["marketStudy"],
    relatedHref: "/analyse-laboratoire-cbd",
    relatedLabel: "Comprendre les limites de détection",
  },
  {
    slug: "isolat-cbd",
    term: "Isolat de CBD",
    definition:
      "Un isolat est une matière fortement purifiée destinée à contenir principalement du CBD, contrairement aux extraits dits à spectre large ou complet.",
    practicalCheck:
      "Vérifier le pourcentage mesuré, la méthode d’analyse et les autres substances recherchées plutôt que de supposer une pureté absolue.",
    sourceIds: ["marketStudy"],
    relatedHref: "/analyse-laboratoire-cbd",
    relatedLabel: "Contrôler le certificat d’analyse",
  },
  {
    slug: "terpenes",
    term: "Terpènes",
    definition:
      "Les terpènes sont des composés aromatiques présents dans de nombreuses plantes, dont le chanvre. Leur mention décrit d’abord un profil olfactif ou gustatif.",
    practicalCheck:
      "Ne pas transformer un descripteur aromatique en promesse médicale ou en effet garanti pour le consommateur.",
    sourceIds: ["marketStudy"],
  },
  {
    slug: "certificat-analyse",
    term: "Certificat d’analyse",
    aliases: ["COA", "rapport de laboratoire"],
    definition:
      "Un certificat d’analyse est un document de laboratoire présentant les résultats obtenus sur un échantillon identifié. Sa portée est limitée aux paramètres et au lot examinés.",
    practicalCheck:
      "Contrôler le laboratoire, la date, l’identifiant d’échantillon, le lot, les unités, les méthodes et les limites de quantification.",
    sourceIds: ["marketStudy"],
    relatedHref: "/analyse-laboratoire-cbd",
    relatedLabel: "Guide de lecture d’un rapport",
  },
  {
    slug: "numero-lot",
    term: "Numéro de lot",
    definition:
      "Le numéro de lot identifie un ensemble de produits issus d’une même fabrication ou préparation. Il sert de lien entre la référence vendue et ses documents de contrôle.",
    practicalCheck:
      "Comparer l’identifiant affiché sur le produit avec celui du rapport ; une analyse générique sans correspondance de lot apporte moins de preuve.",
    sourceIds: ["marketStudy"],
    relatedHref: "/analyse-laboratoire-cbd",
    relatedLabel: "Vérifier la correspondance du lot",
  },
  {
    slug: "tracabilite-cbd",
    term: "Traçabilité du CBD",
    definition:
      "La traçabilité relie un produit à son producteur ou sa marque, son origine déclarée, sa composition, son lot et les contrôles disponibles.",
    practicalCheck:
      "Une adresse d’expédition ou le nom d’une boutique ne suffit pas à démontrer l’origine agricole du chanvre.",
    sourceIds: ["marketStudy"],
    relatedHref: "/cbd-breton",
    relatedLabel: "Distinguer culture et expédition",
  },
  {
    slug: "novel-food",
    term: "Novel Food (nouvel aliment)",
    aliases: ["nouvel aliment"],
    definition:
      "Dans l’Union européenne, un nouvel aliment est un aliment sans historique de consommation significative avant le 15 mai 1997. Une autorisation est requise avant sa mise sur le marché lorsqu’il relève de ce cadre.",
    practicalCheck:
      "Pour un produit alimentaire lié au chanvre, vérifier sa composition et son usage exacts ainsi que les exceptions et décisions publiques applicables.",
    sourceIds: ["novelFood", "food2026"],
  },
  {
    slug: "cbd-bio",
    term: "CBD bio",
    aliases: ["CBD biologique"],
    definition:
      "La mention biologique renvoie à une certification encadrée. Elle ne doit pas être déduite du mot « naturel », d’une pratique artisanale ou d’une simple origine française.",
    practicalCheck:
      "Rechercher le logo applicable, l’organisme certificateur et la portée exacte de la certification sur le produit concerné.",
    sourceIds: ["organic"],
    relatedHref: "/cbd-naturel",
    relatedLabel: "Comparer naturel et biologique",
  },
];

export const CBD_GLOSSARY_LAST_REVIEWED = "2026-08-23";
