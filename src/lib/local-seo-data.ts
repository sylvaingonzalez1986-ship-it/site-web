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
    description: "CBD livré à Vannes : fleurs, huiles, résines et tisanes avec origine et producteur indiqués sur les fiches.",
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
      "Avant de choisir une fleur, une huile, une résine ou une tisane, vérifiez l'origine indiquée sur la fiche. Notre production bretonne y est distinguée des références sélectionnées auprès de producteurs partenaires.",
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
      "Pour une livraison à Brest, commencez par comparer les catégories réellement en stock : fleurs, huiles, résines, tisanes ou cosmétiques. Le prix, le format et le producteur sont affichés sur chaque carte.",
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
      "Les produits en stock peuvent être commandés depuis Saint-Brieuc avec les modes de livraison proposés pendant le parcours d'achat. Fleurs, résines, huiles et tisanes sont présentées séparément pour faciliter la comparaison.",
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
