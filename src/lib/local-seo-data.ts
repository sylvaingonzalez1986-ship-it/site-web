export const bretonCities = [
  {
    name: "Rennes",
    slug: "cbd-rennes",
    keywords: "CBD Rennes, acheter CBD à Rennes, fleur de CBD Rennes",
    description: "Achetez votre CBD naturel breton livré directement à Rennes. Fleurs, huiles et résines CBD du producteur breton. Livraison rapide France.",
    department: "Ille-et-Vilaine",
  },
  {
    name: "Quimper",
    slug: "cbd-quimper",
    keywords: "CBD Quimper, acheter CBD Finistère, fleur de CBD Quimper",
    description: "CBD naturel breton livré à Quimper et sa région. Direct producteur, sans pesticide. Fleurs, huiles et résines CBD bretonnes.",
    department: "Finistère",
  },
  {
    name: "Brest",
    slug: "cbd-brest",
    keywords: "CBD Brest, acheter CBD Brest, shop CBD Finistère",
    description: "Shop CBD naturel à Brest. Fleurs de CBD breton, huiles et résines direct producteur. Livraison rapide en Bretagne.",
    department: "Finistère",
  },
  {
    name: "Vannes",
    slug: "cbd-vannes",
    keywords: "CBD Vannes, acheter CBD Morbihan, fleur CBD Vannes",
    description: "Boutique CBD Vannes. CBD naturel breton en circuit court. Fleurs, huiles spéciales et résines sans pesticide.",
    department: "Morbihan",
  },
  {
    name: "Lorient",
    slug: "cbd-lorient",
    keywords: "CBD Lorient, shop CBD Lorient, acheter CBD Morbihan",
    description: "CBD naturel à Lorient. Direct producteur breton, sans pesticide. Tous nos produits: fleurs, huiles, résines, tisanes.",
    department: "Morbihan",
  },
  {
    name: "Saint-Brieuc",
    slug: "cbd-saint-brieuc",
    keywords: "CBD Saint-Brieuc, CBD Côtes-d'Armor, acheter CBD Bretagne",
    description: "CBD breton à Saint-Brieuc. Fleurs naturelles, huiles full spectrum et résines. Direct producteur sans pesticide.",
    department: "Côtes-d'Armor",
  },
  {
    name: "Saint-Malo",
    slug: "cbd-saint-malo",
    keywords: "CBD Saint-Malo, acheter CBD côte bretonne, shop CBD Côtes-d'Armor",
    description: "CBD naturel à Saint-Malo. Achetez direct du producteur breton. Fleurs, huiles et résines CBD de qualité.",
    department: "Ille-et-Vilaine",
  },
  {
    name: "Fougères",
    slug: "cbd-fougeres",
    keywords: "CBD Fougères, CBD Ille-et-Vilaine, acheter CBD Fougères",
    description: "CBD naturel à Fougères. Direct du producteur breton. Fleurs de CBD, huiles et résines sans pesticide.",
    department: "Ille-et-Vilaine",
  },
  {
    name: "Vitré",
    slug: "cbd-vitre",
    keywords: "CBD Vitré, CBD Bretagne, acheter CBD Ille-et-Vilaine",
    description: "Shop CBD à Vitré. CBD naturel breton en circuit court. Tous nos produits disponibles: fleurs, huiles, résines.",
    department: "Ille-et-Vilaine",
  },
  {
    name: "Redon",
    slug: "cbd-redon",
    keywords: "CBD Redon, CBD Ille-et-Vilaine, acheter CBD breton",
    description: "CBD naturel à Redon. Direct producteur breton, sans pesticide. Fleurs, huiles et résines CBD de qualité.",
    department: "Ille-et-Vilaine",
  },
];

export function getCityData(slug: string) {
  return bretonCities.find((city) => city.slug === slug);
}

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
