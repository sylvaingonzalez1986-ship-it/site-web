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

export type CityFaqItem = { question: string; answer: string };

const cityFaqMap: Record<string, CityFaqItem[]> = {
  "cbd-rennes": [
    { question: "Le CBD est-il légal à Rennes ?", answer: "Oui. Nos produits CBD respectent la réglementation française avec un taux de THC inférieur au seuil autorisé. Chaque lot est analysé en laboratoire indépendant." },
    { question: "Quel délai de livraison CBD à Rennes ?", answer: "Les commandes passées avant 14h sont généralement expédiées le jour même. Vous pouvez choisir une livraison à domicile ou en point relais Mondial Relay à Rennes et en Ille-et-Vilaine." },
    { question: "Quelle fleur CBD choisir à Rennes pour débuter ?", answer: "Si vous débutez, une fleur CBD indoor à dominante relaxante comme une variété fruitée ou citronnée est un bon point de départ. Les huiles CBD sublinguales offrent aussi une prise en main très simple." },
    { question: "Existe-t-il une boutique physique CBD à Rennes ?", answer: "Nous sommes un producteur breton en vente directe en ligne. Pas de boutique physique à Rennes, mais une livraison rapide en point relais Mondial Relay ou à domicile dans toute la métropole rennaise." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-quimper": [
    { question: "Peut-on acheter du CBD légalement à Quimper ?", answer: "Absolument. Le CBD est légal en France tant que le taux de THC reste sous le seuil réglementaire. Tous nos produits sont conformes et accompagnés d'analyses laboratoire." },
    { question: "Combien de temps pour recevoir du CBD à Quimper ?", answer: "Expédition rapide depuis la Bretagne. Vous pouvez recevoir votre commande en point relais Mondial Relay ou par livraison à domicile dans le Finistère." },
    { question: "Quels produits CBD recommandez-vous pour le bien-être quotidien ?", answer: "Les huiles CBD full spectrum sont idéales pour un usage quotidien régulier. Pour une approche plus douce, nos tisanes chanvre artisanales s'intègrent facilement dans une routine bien-être." },
    { question: "Vos produits CBD sont-ils cultivés dans le Finistère ?", answer: "Notre chanvre est cultivé en Bretagne selon des méthodes naturelles, sans pesticide. La proximité géographique avec le Finistère garantit une fraîcheur optimale et un circuit court réel." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-brest": [
    { question: "Le CBD vendu en ligne est-il légal à Brest ?", answer: "Oui, la vente de CBD en ligne est légale en France. Nos produits respectent les normes en vigueur avec un THC inférieur au seuil autorisé, vérifié par analyses laboratoire." },
    { question: "Quelle est la différence entre fleurs CBD et résines CBD ?", answer: "Les fleurs CBD conservent le profil aromatique naturel du chanvre avec des terpènes intacts. Les résines CBD offrent une concentration plus marquée et une texture compacte, idéale pour les consommateurs expérimentés." },
    { question: "Livrez-vous rapidement à Brest ?", answer: "Oui. Les commandes sont expédiées depuis la Bretagne vers Brest et l'agglomération brestoise, en point relais Mondial Relay ou à domicile." },
    { question: "Comment conserver mes produits CBD à Brest ?", answer: "Conservez vos fleurs et résines CBD dans un endroit sec, à l'abri de la lumière et de la chaleur. Les huiles CBD se gardent au réfrigérateur après ouverture pour préserver leurs propriétés." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-vannes": [
    { question: "Puis-je commander du CBD à Vannes en toute légalité ?", answer: "Oui. Le CBD est parfaitement légal en France. Notre production bretonne respecte toutes les exigences réglementaires, avec des certificats d'analyse disponibles pour chaque produit." },
    { question: "Quel est le meilleur moment pour prendre de l'huile CBD ?", answer: "L'huile CBD sublinguale peut se prendre matin ou soir selon vos besoins. Le soir favorise la détente, le matin aide à démarrer sereinement la journée. Commencez par un faible dosage." },
    { question: "Livraison CBD Vannes : quels sont les délais ?", answer: "Nous expédions depuis la Bretagne vers Vannes et le Morbihan. Livraison à domicile ou en point relais Mondial Relay au choix." },
    { question: "Proposez-vous des tisanes CBD adaptées à une consommation quotidienne ?", answer: "Oui, nos tisanes chanvre artisanales bretonnes sont conçues pour un usage quotidien. Elles offrent une approche douce du CBD, idéale en infusion le soir pour favoriser la relaxation." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-lorient": [
    { question: "Est-ce légal d'acheter du CBD en ligne à Lorient ?", answer: "Oui. La vente de CBD est autorisée en France sous réserve de conformité au taux de THC. Nos produits sont analysés en laboratoire et livrés légalement sur tout le territoire." },
    { question: "Quels produits CBD proposez-vous à Lorient ?", answer: "Nous proposons des fleurs CBD cultivées en Bretagne, des huiles full spectrum, des résines CBD et des tisanes chanvre artisanales. Tous nos produits sont sans pesticide et en circuit court." },
    { question: "Combien coûte la livraison CBD à Lorient ?", answer: "La livraison en point relais est à 4,90€ et à domicile à 6,90€. Elle devient gratuite à partir de 89€ d'achat, vers Lorient comme partout en France métropolitaine." },
    { question: "Votre CBD est-il vraiment produit en Bretagne ?", answer: "Oui. Nous sommes producteurs à part entière en Bretagne. Notre chanvre est cultivé localement sans chimie, transformé et expédié directement depuis notre atelier breton." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-saint-brieuc": [
    { question: "Le CBD est-il disponible et légal à Saint-Brieuc ?", answer: "Oui. Le CBD est légal partout en France. Nos produits CBD bretons sont conformes à la réglementation, analysés en laboratoire et livrés rapidement à Saint-Brieuc et dans les Côtes-d'Armor." },
    { question: "Quelle différence entre huile CBD full spectrum et isolat ?", answer: "L'huile full spectrum conserve tous les cannabinoïdes et terpènes du chanvre pour un effet d'entourage complet. L'isolat ne contient que du CBD pur. Nous privilégions le full spectrum pour une efficacité optimale." },
    { question: "Puis-je récupérer ma commande en point relais à Saint-Brieuc ?", answer: "Oui, nous livrons via Mondial Relay avec de nombreux points relais à Saint-Brieuc et alentours. L'emballage est discret et le suivi disponible en temps réel." },
    { question: "Quels sont les bienfaits des tisanes chanvre ?", answer: "Les tisanes chanvre favorisent la relaxation et la détente. Préparées artisanalement en Bretagne, elles s'intègrent dans une routine bien-être quotidienne sans effet psychoactif." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-saint-malo": [
    { question: "Peut-on acheter du CBD à Saint-Malo sans risque légal ?", answer: "Oui. Le CBD est un produit légal en France. Nos fleurs, huiles et résines CBD respectent le cadre réglementaire avec des analyses laboratoire à l'appui." },
    { question: "Livrez-vous en été à Saint-Malo pendant la saison touristique ?", answer: "Nous livrons toute l'année à Saint-Malo et sur la côte nord bretonne. Livraison à domicile ou en point relais Mondial Relay disponibles, même en période estivale." },
    { question: "Comment bien choisir son dosage d'huile CBD ?", answer: "Commencez par un faible dosage (quelques gouttes) et augmentez progressivement selon vos ressentis. Le format sublingual permet une absorption rapide et un ajustement facile." },
    { question: "Vos produits conviennent-ils aux touristes de passage à Saint-Malo ?", answer: "Oui. Vous pouvez commander en ligne et vous faire livrer en point relais à Saint-Malo. Nos produits sont légaux et peuvent être transportés partout en France." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-fougeres": [
    { question: "Comment acheter du CBD à Fougères ?", answer: "Vous pouvez commander directement sur notre boutique en ligne. La livraison est rapide vers Fougères et toute l'Ille-et-Vilaine, en point relais ou à domicile." },
    { question: "Le CBD peut-il aider à la relaxation ?", answer: "Le CBD est reconnu pour ses propriétés relaxantes. Nos huiles et tisanes CBD sont particulièrement adaptées pour favoriser la décontraction et le bien-être au quotidien." },
    { question: "Quel est l'avantage d'acheter du CBD direct producteur ?", answer: "Acheter en direct supprime les intermédiaires : meilleur prix, fraîcheur garantie et traçabilité complète du champ à votre porte à Fougères. C'est la force du circuit court breton." },
    { question: "Vos fleurs CBD sont-elles sans pesticide ?", answer: "Oui. Notre chanvre breton est cultivé sans pesticide ni produit chimique. Chaque récolte fait l'objet d'analyses pour garantir la pureté et la conformité du produit final." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-vitre": [
    { question: "Est-il possible de se faire livrer du CBD à Vitré ?", answer: "Oui. Nous livrons à Vitré et dans toute la Bretagne. Plusieurs points relais Mondial Relay sont disponibles à Vitré et dans les communes environnantes, ou livraison à domicile." },
    { question: "Quelle est la différence entre CBD indoor et outdoor ?", answer: "Le CBD indoor est cultivé en intérieur dans des conditions contrôlées, ce qui donne des fleurs plus denses et aromatiques. Le CBD outdoor pousse en plein air avec un profil plus naturel et terreux." },
    { question: "Le CBD convient-il aux personnes sensibles ?", answer: "Les tisanes chanvre et les huiles CBD à faible dosage sont particulièrement adaptées aux personnes sensibles. Commencez par de petites quantités pour observer vos réactions." },
    { question: "Proposez-vous un programme de fidélité ?", answer: "Oui, chaque achat vous fait gagner des points fidélité échangeables contre des réductions. Les clients réguliers à Vitré et en Bretagne bénéficient d'avantages exclusifs sur notre boutique." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
  "cbd-redon": [
    { question: "Puis-je commander du CBD depuis Redon ?", answer: "Oui. Notre boutique en ligne livre à Redon et partout en France métropolitaine. Commandez vos fleurs, huiles ou résines CBD en point relais ou livraison à domicile." },
    { question: "Pourquoi choisir un CBD breton plutôt qu'importé ?", answer: "Le CBD breton offre un circuit court réel : fraîcheur optimale, empreinte carbone réduite, traçabilité locale et soutien à l'agriculture bretonne. C'est un choix de qualité et de sens." },
    { question: "Quels modes de paiement acceptez-vous ?", answer: "Nous acceptons les paiements par carte bancaire via notre plateforme sécurisée. Le paiement est simple, rapide et protégé pour toutes les commandes vers Redon et la Bretagne." },
    { question: "Les résines CBD sont-elles adaptées aux débutants ?", answer: "Les résines CBD ont une concentration plus marquée que les fleurs. Pour débuter, nous recommandons plutôt les fleurs CBD ou les huiles sublinguales, plus faciles à doser." },
    { question: "Vos produits sont-ils naturels ?", answer: "Oui, 100% de nos produits sont naturels. Nos producteurs s'engagent en toute transparence pour vous proposer des produits 100% naturels, sans additif ni chimie. Chaque lot est analysé en laboratoire." },
  ],
};

export function getCityFaq(slug: string): CityFaqItem[] {
  return cityFaqMap[slug] ?? cityFaqMap["cbd-rennes"];
}
