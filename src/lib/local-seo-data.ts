import { CBD_NATUREL_CANONICAL_ANSWER } from "@/lib/cbd-natural-answer";

export const bretonCities = [
  {
    name: "Rennes",
    slug: "cbd-rennes",
    keywords: "CBD Rennes, acheter CBD à Rennes, fleur de CBD Rennes",
    description: "CBD livré à Rennes : comparez les produits disponibles, leur origine, leur producteur et les analyses publiées avant de commander.",
    department: "Ille-et-Vilaine",
  },
  {
    name: "Quimper",
    slug: "cbd-quimper",
    keywords: "CBD Quimper, acheter CBD Finistère, fleur de CBD Quimper",
    description: "CBD livré à Quimper : produits disponibles, producteurs identifiés, composition et analyses consultables selon les références.",
    department: "Finistère",
  },
  {
    name: "Brest",
    slug: "cbd-brest",
    keywords: "CBD Brest, acheter CBD Brest, shop CBD Finistère",
    description: "CBD livré à Brest : vérifiez les stocks, le producteur, la région d'origine et l'analyse disponible pour chaque référence.",
    department: "Finistère",
  },
  {
    name: "Vannes",
    slug: "cbd-vannes",
    keywords: "CBD Vannes, acheter CBD Morbihan, fleur CBD Vannes",
    description: "CBD livré à Vannes : produits disponibles avec origine, composition et producteur indiqués sur les fiches.",
    department: "Morbihan",
  },
  {
    name: "Lorient",
    slug: "cbd-lorient",
    keywords: "CBD Lorient, shop CBD Lorient, acheter CBD Morbihan",
    description: "CBD livré à Lorient : comparez les formats en stock, leur composition, leur origine et les analyses publiées.",
    department: "Morbihan",
  },
  {
    name: "Saint-Brieuc",
    slug: "cbd-saint-brieuc",
    keywords: "CBD Saint-Brieuc, CBD Côtes-d'Armor, acheter CBD Bretagne",
    description: "CBD livré à Saint-Brieuc : produits disponibles et producteurs identifiés, avec analyses consultables selon les références.",
    department: "Côtes-d'Armor",
  },
  {
    name: "Saint-Malo",
    slug: "cbd-saint-malo",
    keywords: "CBD Saint-Malo, acheter CBD côte bretonne, shop CBD Côtes-d'Armor",
    description: "CBD livré à Saint-Malo : vérifiez l'origine, la composition, le producteur et l'analyse disponible avant de commander.",
    department: "Ille-et-Vilaine",
  },
  {
    name: "Fougères",
    slug: "cbd-fougeres",
    keywords: "CBD Fougères, CBD Ille-et-Vilaine, acheter CBD Fougères",
    description: "CBD livré à Fougères : catégories en stock, origine des produits et analyses publiées selon les références.",
    department: "Ille-et-Vilaine",
  },
  {
    name: "Vitré",
    slug: "cbd-vitre",
    keywords: "CBD Vitré, CBD Bretagne, acheter CBD Ille-et-Vilaine",
    description: "CBD livré à Vitré : comparez les formats disponibles, leur producteur, leur région et leur composition.",
    department: "Ille-et-Vilaine",
  },
  {
    name: "Redon",
    slug: "cbd-redon",
    keywords: "CBD Redon, CBD Ille-et-Vilaine, acheter CBD breton",
    description: "CBD livré à Redon : produits en stock, producteurs identifiés et analyses consultables selon les références.",
    department: "Ille-et-Vilaine",
  },
];

export const LOCAL_SEO_LAST_REVIEWED = "2026-08-23";

export function getCityData(slug: string) {
  return bretonCities.find((city) => city.slug === slug);
}

const cityEditorialMap: Record<
  string,
  {
    title: string;
    paragraphs: string[];
  }
> = {
  "cbd-rennes": {
    title: "Commander du CBD à Rennes depuis la Bretagne",
    paragraphs: [
      "Les commandes destinées à Rennes peuvent être livrées à domicile ou dans un point relais disponible au moment du choix du transport. Les produits en stock, leur prix et leur producteur sont affichés avant l'ajout au panier.",
      "Avant de choisir une référence, vérifiez l'origine indiquée sur la fiche. Notre production bretonne y est distinguée des produits sélectionnés auprès de producteurs partenaires.",
    ],
  },
  "cbd-quimper": {
    title: "CBD livré à Quimper et dans le sud Finistère",
    paragraphs: [
      "Depuis Quimper, vous pouvez consulter les produits réellement disponibles puis choisir une livraison à domicile ou en point relais. Les délais et options sont présentés pendant la commande selon l'adresse saisie.",
      "Chaque fiche doit permettre d'identifier la catégorie, la provenance et le producteur. Lorsqu'une analyse de laboratoire est disponible, elle est accessible depuis le produit concerné.",
    ],
  },
  "cbd-brest": {
    title: "Choisir et faire livrer du CBD à Brest",
    paragraphs: [
      "Pour une livraison à Brest, commencez par comparer les catégories réellement en stock. Le prix, le format et le producteur sont affichés sur chaque carte.",
      "Le nom Les Chanvriers Bretons ne signifie pas que toutes les références sont cultivées en Bretagne. Les produits partenaires affichent leur producteur et leur région afin de rendre cette distinction explicite.",
    ],
  },
  "cbd-vannes": {
    title: "CBD à Vannes : origine et livraison vérifiables",
    paragraphs: [
      "Les commandes à destination de Vannes et du Morbihan sont préparées en Bretagne. Les options de livraison disponibles sont calculées au moment de la commande.",
      "Pour comparer les références, consultez l'origine, le producteur, la composition et l'analyse disponible. Le terme « naturel » ne remplace pas ces informations vérifiables.",
    ],
  },
  "cbd-lorient": {
    title: "Commander du CBD à Lorient en toute transparence",
    paragraphs: [
      "Depuis Lorient, la boutique permet de vérifier les stocks, les formats et les producteurs avant de commander. La livraison peut être proposée à domicile ou en point relais selon l'adresse.",
      "Les références de notre production et celles des producteurs partenaires sont identifiées séparément. Cette provenance doit être vérifiée sur la fiche plutôt que déduite du nom de la boutique.",
    ],
  },
  "cbd-saint-brieuc": {
    title: "CBD livré à Saint-Brieuc et dans les Côtes-d'Armor",
    paragraphs: [
      "Les produits en stock peuvent être commandés depuis Saint-Brieuc avec les modes de livraison proposés pendant le parcours d'achat. Les catégories actives sont présentées séparément pour faciliter la comparaison.",
      "Consultez la provenance affichée sur chaque fiche : certaines références viennent de notre production bretonne, d'autres de producteurs partenaires français clairement nommés.",
    ],
  },
  "cbd-saint-malo": {
    title: "CBD à Saint-Malo : commande et livraison",
    paragraphs: [
      "Depuis Saint-Malo, vous pouvez parcourir les catégories disponibles puis sélectionner une livraison à domicile ou en point relais lorsque cette option est proposée pour votre adresse.",
      "La confiance repose sur des informations concrètes : producteur, région, composition, lot et analyse disponible. Ces éléments figurent sur les fiches et distinguent notre production des sélections partenaires.",
    ],
  },
  "cbd-fougeres": {
    title: "CBD livré à Fougères et en Ille-et-Vilaine",
    paragraphs: [
      "Les produits affichés comme disponibles peuvent être commandés depuis Fougères. Les options de transport et leur tarif sont indiqués avant la validation définitive de la commande.",
      "Avant l'achat, comparez la provenance et le producteur plutôt que de vous fier à une promesse générale. Une analyse de laboratoire, lorsqu'elle est publiée, doit correspondre au produit concerné.",
    ],
  },
  "cbd-vitre": {
    title: "Commander du CBD à Vitré",
    paragraphs: [
      "Pour une livraison à Vitré, consultez les catégories et les stocks avant de choisir votre format. Les conditions et options de transport sont affichées pendant le passage de la commande.",
      "Les fiches identifient le producteur et sa région. Elles permettent ainsi de distinguer notre production bretonne des produits sélectionnés auprès de partenaires situés dans d'autres régions françaises.",
    ],
  },
  "cbd-redon": {
    title: "CBD à Redon : produits disponibles et livraison",
    paragraphs: [
      "Les habitants de Redon peuvent commander les références indiquées en stock et consulter les modes de livraison proposés pour leur adresse avant paiement.",
      "Chaque produit doit être évalué à partir de son origine, de sa composition et de son analyse disponible. Le producteur partenaire est affiché lorsque la référence ne provient pas de notre production propre.",
    ],
  },
};

const nearbyCityMap: Record<string, string[]> = {
  "cbd-rennes": ["cbd-vitre", "cbd-fougeres", "cbd-saint-malo", "cbd-redon"],
  "cbd-quimper": ["cbd-brest", "cbd-lorient", "cbd-vannes", "cbd-saint-brieuc"],
  "cbd-brest": ["cbd-quimper", "cbd-saint-brieuc", "cbd-lorient", "cbd-vannes"],
  "cbd-vannes": ["cbd-lorient", "cbd-redon", "cbd-quimper", "cbd-rennes"],
  "cbd-lorient": ["cbd-vannes", "cbd-quimper", "cbd-brest", "cbd-redon"],
  "cbd-saint-brieuc": ["cbd-saint-malo", "cbd-brest", "cbd-rennes", "cbd-quimper"],
  "cbd-saint-malo": ["cbd-rennes", "cbd-saint-brieuc", "cbd-fougeres", "cbd-vitre"],
  "cbd-fougeres": ["cbd-rennes", "cbd-vitre", "cbd-saint-malo", "cbd-redon"],
  "cbd-vitre": ["cbd-rennes", "cbd-fougeres", "cbd-redon", "cbd-saint-malo"],
  "cbd-redon": ["cbd-rennes", "cbd-vannes", "cbd-vitre", "cbd-fougeres"],
};

export function getNearbyCities(slug: string) {
  const nearbySlugs = nearbyCityMap[slug] ?? [];
  return nearbySlugs
    .map((nearbySlug) => getCityData(nearbySlug))
    .filter((city): city is NonNullable<ReturnType<typeof getCityData>> => Boolean(city));
}

export function getCityEditorialContent(slug: string) {
  return cityEditorialMap[slug] ?? null;
}

export type CityFaqItem = { question: string; answer: string };

export function getCityFaq(slug: string): CityFaqItem[] {
  const city = getCityData(slug);
  if (!city) {
    return [];
  }

  return [
    {
      question: `Tous les produits livrés à ${city.name} viennent-ils de Bretagne ?`,
      answer:
        "Non. Le catalogue distingue la production des Chanvriers Bretons des références proposées par des producteurs partenaires français. Le producteur et sa région sont indiqués sur chaque fiche.",
    },
    {
      question: `Comment vérifier qu'un produit CBD livré à ${city.name} est naturel ?`,
      answer: CBD_NATUREL_CANONICAL_ANSWER,
    },
    {
      question: `Les Chanvriers Bretons ont-ils une boutique physique à ${city.name} ?`,
      answer:
        "Non. Les Chanvriers Bretons vendent en ligne. Les modes de livraison réellement disponibles pour votre adresse sont présentés pendant la commande.",
    },
  ];
}
