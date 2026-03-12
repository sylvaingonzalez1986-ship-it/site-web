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

const cityEditorialMap: Record<
  string,
  {
    title: string;
    paragraphs: string[];
  }
> = {
  "cbd-rennes": {
    title: "CBD à Rennes : un choix pratique pour une grande ville bretonne",
    paragraphs: [
      "Rennes concentre une clientèle qui cherche un achat simple, rapide et fiable. Sur cette page, l'objectif est de répondre à une recherche locale claire : trouver des fleurs CBD, des huiles naturelles, des résines ou des tisanes chanvre avec livraison vers Rennes sans passer par une boutique générique éloignée du territoire breton.",
      "Pour Rennes et sa périphérie, l'argument fort reste la combinaison entre circuit court, sérieux produit et livraison suivie. Les habitants qui recherchent un CBD naturel veulent souvent comparer la qualité, la traçabilité et le niveau de transparence du producteur. C'est précisément ce qui distingue une offre locale bretonne d'une place de marché impersonnelle.",
    ],
  },
  "cbd-quimper": {
    title: "CBD à Quimper : terroir, détente et consommation raisonnée",
    paragraphs: [
      "Quimper s'inscrit dans une logique de consommation plus ancrée dans le terroir et les produits bien identifiés. Pour une requête comme CBD Quimper, il est pertinent de mettre en avant un chanvre cultivé proprement, des tisanes chanvre artisanales et des huiles full spectrum faciles à intégrer dans une routine bien-être quotidienne.",
      "Le visiteur qui arrive depuis Quimper ou le sud Finistère attend aussi une réponse concrète : des produits disponibles, une expédition rapide et un positionnement naturel sans promesse excessive. Cette page sert précisément à relier une demande locale à une offre e-commerce cohérente, bretonne et rassurante.",
    ],
  },
  "cbd-brest": {
    title: "CBD à Brest : une offre claire pour une recherche directe",
    paragraphs: [
      "À Brest, les recherches locales autour du CBD sont souvent très directes : fleurs CBD, huile CBD, résine CBD, livraison rapide. Une page dédiée doit donc rester lisible et utile, avec une mise en avant des catégories réellement disponibles plutôt qu'un texte trop abstrait ou trop théorique.",
      "L'intérêt SEO ici est aussi de relier la ville à une promesse simple : du CBD naturel breton, légal en France, sélectionné avec une logique de qualité. Pour Brest et sa zone de chalandise, cette précision géographique aide à mieux aligner la page avec l'intention réelle de recherche.",
    ],
  },
  "cbd-vannes": {
    title: "CBD à Vannes : une page locale orientée usage et naturalité",
    paragraphs: [
      "À Vannes, la recherche autour du CBD s'articule souvent autour de la qualité perçue, des formats et de la simplicité d'achat. C'est pourquoi cette page valorise autant les huiles, les fleurs et les tisanes que le fait de commander auprès d'un producteur breton capable de livrer rapidement dans le Morbihan.",
      "Le référencement local ne repose pas seulement sur le mot-clé CBD Vannes. Il repose aussi sur la cohérence du contenu : expliquer les usages, rappeler l'origine bretonne, parler de chanvre naturel et montrer une vraie continuité entre la page locale et la boutique en ligne.",
    ],
  },
  "cbd-lorient": {
    title: "CBD à Lorient : répondre à une demande locale en ligne",
    paragraphs: [
      "Lorient est une ville où le visiteur veut aller vite vers l'information utile : disponibilité, fiabilité, catégories produits et expédition. Une page locale réussie doit donc aider l'utilisateur à comprendre immédiatement qu'il peut acheter des fleurs CBD, des huiles et des résines sans quitter un cadre breton et transparent.",
      "Sur le plan SEO, l'intérêt est double : capter la requête locale et associer Lorient à une offre qualitative. Le contenu éditorial spécifique sert justement à éviter une répétition trop mécanique entre les pages villes et à mieux contextualiser la recherche pour le Morbihan.",
    ],
  },
  "cbd-saint-brieuc": {
    title: "CBD à Saint-Brieuc : une approche locale pour les Côtes-d'Armor",
    paragraphs: [
      "Pour Saint-Brieuc et plus largement les Côtes-d'Armor, une page SEO locale doit combiner proximité régionale et précision sur les formats. Les fleurs CBD, les résines et les tisanes ne répondent pas aux mêmes attentes, et le contenu doit refléter cette diversité sans perdre le fil local de la recherche.",
      "En mettant en avant le chanvre breton, la culture sans pesticide et la clarté réglementaire, cette page renforce la pertinence de la requête CBD Saint-Brieuc tout en gardant un positionnement crédible, utile et orienté e-commerce.",
    ],
  },
  "cbd-saint-malo": {
    title: "CBD à Saint-Malo : qualité bretonne et achat simple",
    paragraphs: [
      "Saint-Malo attire un profil de recherche souvent lié à la qualité, à la discrétion et à la simplicité de commande. Cette page locale met donc l'accent sur des produits lisibles, une origine bretonne clairement assumée et des catégories faciles à parcourir depuis la boutique en ligne.",
      "Pour le SEO local, parler de Saint-Malo ne suffit pas. Il faut aussi ancrer la page dans une logique de confiance : produit naturel, sélection cohérente, livraison vers la côte nord et maillage avec les autres villes bretonnes pour donner plus de profondeur au site.",
    ],
  },
  "cbd-fougeres": {
    title: "CBD à Fougères : une page locale utile pour l'Ille-et-Vilaine",
    paragraphs: [
      "Fougères représente une recherche locale plus ciblée, souvent avec une forte intention d'achat. Cela justifie une page dédiée qui explique clairement l'intérêt d'acheter des fleurs CBD, huiles naturelles et tisanes chanvre auprès d'un acteur breton plutôt que d'un site sans ancrage régional.",
      "Dans cette zone, l'argument de la proximité régionale et du producteur direct fonctionne bien s'il est accompagné de contenu concret. Le SEO local gagne alors en crédibilité, car la page ne répète pas seulement un mot-clé mais répond à une vraie attente utilisateur.",
    ],
  },
  "cbd-vitre": {
    title: "CBD à Vitré : visibilité locale et offre e-commerce cohérente",
    paragraphs: [
      "Pour une ville comme Vitré, la page locale doit surtout rassurer sur la clarté de l'offre et la cohérence des produits présentés. Une bonne page SEO ne doit pas être un simple doublon : elle doit relier la ville, l'intention d'achat et les catégories les plus pertinentes comme fleurs, huiles et résines.",
      "Cette contextualisation aide Google à mieux comprendre que la page vise réellement une recherche locale, tout en donnant au visiteur une porte d'entrée simple vers la boutique. C'est cette articulation entre SEO local et contenu e-commerce qui donne de la valeur à la page.",
    ],
  },
  "cbd-redon": {
    title: "CBD à Redon : une réponse locale entre Bretagne intérieure et e-commerce",
    paragraphs: [
      "Redon est un bon exemple de requête locale où l'utilisateur cherche avant tout une solution pratique, fiable et proche de son territoire. En parlant de fleurs CBD, d'huiles naturelles et de tisanes chanvre sur une page dédiée, on répond beaucoup mieux à cette intention qu'avec une page boutique trop large.",
      "Le contenu spécifique à Redon renforce aussi le maillage régional du site. Il montre que l'offre ne s'adresse pas seulement aux grandes villes, mais à l'ensemble de la Bretagne avec une même exigence de qualité, de légalité et de lisibilité produit.",
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
