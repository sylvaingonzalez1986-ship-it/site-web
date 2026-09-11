export const KQ_STARTING_CASH_CENTS = 35_000;

export const KQ_EQUIPMENT_CATEGORIES = [
  "infrastructure",
  "lighting",
  "climate",
  "processing",
  "energy",
  "security",
] as const;

export type KqEquipmentCategory = (typeof KQ_EQUIPMENT_CATEGORIES)[number];

export type KqEquipmentSlot =
  | "tent"
  | "lighting"
  | "air"
  | "climate-controller"
  | "sifting"
  | "washing"
  | "filtration"
  | "static-separation"
  | "press"
  | "drying"
  | "energy"
  | "security";

export type KqEquipmentUnlock =
  | "raw-sale"
  | "dry-sift"
  | "ice-water-hash"
  | "hash-filtration"
  | "static-sift"
  | "freeze-drying"
  | "rosin-trial"
  | "rosin-selection"
  | "rosin-premium"
  | "rosin-signature"
  | "power-backup"
  | "theft-protection";

export type KqEquipmentRequirement = {
  oneOf: string[];
  label: string;
};

export type KqEquipmentDefinition = {
  code: string;
  name: string;
  category: KqEquipmentCategory;
  slot: KqEquipmentSlot;
  priceCents: number;
  purchasable: boolean;
  shortDescription: string;
  benefit: string;
  tradeoff: string;
  specification: string;
  powerWatts: number;
  effects: {
    quantityPercent?: number;
    qualityMaxBonus?: number;
    regularityPercent?: number;
    pressureDelta?: number;
    energyDiscountPercent?: number;
    processingPrecision?: number;
    processingCapacity?: number;
    processingValueBonusPercent?: number;
  };
  unlocks: KqEquipmentUnlock[];
  requirements?: KqEquipmentRequirement[];
  recommendations?: string[];
  realWorldAnchor: {
    label: string;
    seller: string;
    sourceUrl: string;
    referencePriceCents: number;
    priceKind: "standard" | "promotion" | "starting-at";
    observedPriceCents?: number;
    checkedAt: string;
  };
};

export const KQ_EQUIPMENT_PRICE_CHECKED_AT = "2026-09-01";
const checkedAt = KQ_EQUIPMENT_PRICE_CHECKED_AT;

const LEGACY_EQUIPMENT_CATALOG: readonly KqEquipmentDefinition[] = [
  {
    code: "TENT-080-STARTER",
    name: "Tente de départ 90 × 90",
    category: "infrastructure",
    slot: "tent",
    priceCents: 0,
    purchasable: false,
    shortDescription: "Le premier placard de Sylvain : compact, rafistolé, mais fonctionnel.",
    benefit: "Capacité de départ et installation discrète.",
    tradeoff: "La quantité est plafonnée et les gros équipements y sont à l'étroit.",
    specification: "90 × 90 × 180 cm",
    powerWatts: 0,
    effects: {},
    unlocks: ["raw-sale"],
    realWorldAnchor: {
      label: "AC Infinity CLOUDLAB 733 · 3 × 3 ft",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/shop-all/?page=2",
      referencePriceCents: 17_900,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "TENT-120",
    name: "Tente renforcée 120 × 120",
    category: "infrastructure",
    slot: "tent",
    priceCents: 19_900,
    purchasable: true,
    shortDescription: "Plus d'espace pour produire sans transformer la pièce en hangar.",
    benefit: "+50 % de capacité maximale et davantage de matériel compatible.",
    tradeoff: "Le bonus est limité sans éclairage et extraction adaptés.",
    specification: "120 × 120 × 200 cm · toile réfléchissante",
    powerWatts: 0,
    effects: { quantityPercent: 50 },
    unlocks: [],
    recommendations: ["LED-300", "AIR-EC6"],
    realWorldAnchor: {
      label: "AC Infinity CLOUDLAB 844 · 4 × 4 ft",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/cloudlab-844-advance-grow-tent-4x4-thickest-poles-and-canvas-48-x-48-x-80/",
      referencePriceCents: 19_900,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "TENT-150",
    name: "Grande tente 150 × 150",
    category: "infrastructure",
    slot: "tent",
    priceCents: 24_900,
    purchasable: true,
    shortDescription: "Une vraie pièce dans la pièce, avec assez de place pour viser gros.",
    benefit: "+100 % de capacité maximale.",
    tradeoff: "Ajoute 1 Pression si le climat n'est pas correctement équipé.",
    specification: "150 × 150 × 200 cm · structure renforcée",
    powerWatts: 0,
    effects: { quantityPercent: 100, pressureDelta: 1 },
    unlocks: [],
    recommendations: ["LED-500", "CLIMATE-SMART"],
    realWorldAnchor: {
      label: "AC Infinity CLOUDLAB 866 · 5 × 5 ft",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/cloudlab-866-advance-grow-tent-5x5-thickest-poles-and-canvas-60-x-60-x-80/",
      referencePriceCents: 24_900,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "LED-150-STARTER",
    name: "LED compacte 115 W",
    category: "lighting",
    slot: "lighting",
    priceCents: 0,
    purchasable: false,
    shortDescription: "Éclairage sobre fourni avec l'installation de départ.",
    benefit: "Stable, silencieux et peu coûteux.",
    tradeoff: "Ne couvre correctement que la petite tente.",
    specification: "115 W · spectre horticole complet",
    powerWatts: 115,
    effects: {},
    unlocks: [],
    realWorldAnchor: {
      label: "AC Infinity IONBOARD S22 · 115 W",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/ionboard-s22-grow-light-board-115w-full-spectrum-led-2x2-coverage/",
      referencePriceCents: 11_900,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "LED-300",
    name: "LED spéciale 300 W",
    category: "lighting",
    slot: "lighting",
    priceCents: 35_900,
    purchasable: true,
    shortDescription: "Une rampe homogène qui commence à faire très sérieux.",
    benefit: "+20 % de quantité et +2 de qualité maximale.",
    tradeoff: "La facture électrique augmente nettement.",
    specification: "300 W · intensité réglable",
    powerWatts: 300,
    effects: { quantityPercent: 20, qualityMaxBonus: 2 },
    unlocks: [],
    recommendations: ["AIR-EC6"],
    realWorldAnchor: {
      label: "AC Infinity IONFRAME EVO4 · 300 W",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/ionframe-evo4-grow-light-300w-full-spectrum-led-3x3-coverage/",
      referencePriceCents: 35_900,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "LED-500",
    name: "Cadre LED premium 500 W",
    category: "lighting",
    slot: "lighting",
    priceCents: 57_900,
    purchasable: true,
    shortDescription: "Un grand cadre à barres pour pousser la quantité sans perdre l'homogénéité.",
    benefit: "+45 % de quantité et +4 de qualité maximale.",
    tradeoff: "Ajoute 1 Pression et exige une extraction renforcée.",
    specification: "500 W · barres modulaires · variation 0–100 %",
    powerWatts: 500,
    effects: { quantityPercent: 45, qualityMaxBonus: 4, pressureDelta: 1 },
    unlocks: [],
    requirements: [{ oneOf: ["AIR-EC6", "CLIMATE-SMART"], label: "Extraction renforcée" }],
    realWorldAnchor: {
      label: "AC Infinity IONFRAME EVO6 · 500 W",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/ionframe-evo6-grow-light-500w-full-spectrum-led-grow-light-4x4-coverage/",
      referencePriceCents: 57_900,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "AIR-STARTER",
    name: "Extraction de départ",
    category: "climate",
    slot: "air",
    priceCents: 0,
    purchasable: false,
    shortDescription: "Le petit extracteur fourni avec le kit de départ.",
    benefit: "Assure le renouvellement minimal de l'air.",
    tradeoff: "Peu efficace dans une grande tente.",
    specification: "100 mm · variateur manuel",
    powerWatts: 35,
    effects: {},
    unlocks: [],
    realWorldAnchor: {
      label: "AC Infinity CLOUDLINE A4 · 4 pouces",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/cloudline-a4-quiet-inline-fan-4-with-speed-controller/",
      referencePriceCents: 7_999,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "AIR-EC6",
    name: "Extracteur EC 6 pouces",
    category: "climate",
    slot: "air",
    priceCents: 14_900,
    purchasable: true,
    shortDescription: "Un extracteur robuste et réglable pour les installations qui prennent de l'ampleur.",
    benefit: "+6 % de régularité et compatibilité avec les grandes LED.",
    tradeoff: "Le filtre reste à entretenir entre les cultures.",
    specification: "150 mm · moteur EC · 683 m³/h · 32 dBA",
    powerWatts: 38,
    effects: { regularityPercent: 6 },
    unlocks: [],
    realWorldAnchor: {
      label: "AC Infinity CLOUDLINE T6 · 6 pouces",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/duct-fan-systems/?page=1",
      referencePriceCents: 14_900,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "CLIMATE-SMART",
    name: "Contrôleur climatique AI+",
    category: "climate",
    slot: "climate-controller",
    priceCents: 13_900,
    purchasable: true,
    shortDescription: "Un contrôleur central qui automatise le climat depuis ses capteurs.",
    benefit: "+12 % de régularité et +2 de qualité maximale.",
    tradeoff: "Nécessite des appareils compatibles et un réglage précis.",
    specification: "Contrôle température, humidité, VPD et vitesse · Wi-Fi",
    powerWatts: 5,
    effects: { regularityPercent: 12, qualityMaxBonus: 2 },
    unlocks: [],
    requirements: [{ oneOf: ["AIR-EC6"], label: "Extracteur EC 6 pouces" }],
    realWorldAnchor: {
      label: "AC Infinity CONTROLLER AI+",
      seller: "AC Infinity US",
      sourceUrl: "https://acinfinity.com/controller-ai-environment-controller-uis-8-port-with-temp-humidity-vpd-sensor/",
      referencePriceCents: 13_900,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "SIFT-TRAY",
    name: "Pollinator à sec Resinator OG",
    category: "processing",
    slot: "sifting",
    priceCents: 419_500,
    purchasable: true,
    shortDescription: "Un tambour réfrigérable conçu pour séparer les trichomes à sec avec une granulométrie régulière.",
    benefit: "Débloque le Dry Sift et traite plus de matière qu'un plateau manuel.",
    tradeoff: "La pureté ultime exige encore une séparation statique.",
    specification: "Tambour interchangeable · traitement à sec ou cryogénique",
    powerWatts: 180,
    effects: { processingPrecision: 82, processingCapacity: 35 },
    unlocks: ["dry-sift"],
    recommendations: ["STATIC-PLASMA"],
    realWorldAnchor: {
      label: "The Original Resinator OG · Base Model",
      seller: "TCI Scientific / The Original Resinator",
      sourceUrl: "https://www.tciscientific.com/",
      referencePriceCents: 419_500,
      priceKind: "promotion",
      checkedAt,
    },
  },
  {
    code: "WASHER-25L",
    name: "Ice washer Mini Osprey 2.0",
    category: "processing",
    slot: "washing",
    priceCents: 599_500,
    purchasable: true,
    shortDescription: "Une laveuse inox à faible cisaillement pour produire du bubble hash en petit laboratoire.",
    benefit: "Débloque le Hash eau-glace avec une vraie capacité semi-professionnelle.",
    tradeoff: "La collecte et le séchage restent des étapes séparées.",
    specification: "30 gal · jusqu'à 9 000 g frais congelés par cycle",
    powerWatts: 990,
    effects: { processingPrecision: 78, processingCapacity: 45 },
    unlocks: ["ice-water-hash"],
    recommendations: ["AUTO-SIEVE", "FREEZE-DRYER"],
    realWorldAnchor: {
      label: "Lowtemp Mini Osprey 2.0",
      seller: "Lowtemp Industries",
      sourceUrl: "https://www.lowtemp-plates.com/collections/commercial-hash-washing-equipment",
      referencePriceCents: 599_500,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "AUTO-SIEVE",
    name: "Collecteur AutoSieve",
    category: "processing",
    slot: "filtration",
    priceCents: 499_500,
    purchasable: true,
    shortDescription: "Une pile vibrante de tamis inox qui automatise la collecte et le classement par micron.",
    benefit: "Débloque la filtration automatisée nécessaire au Hash Signature.",
    tradeoff: "Ne fonctionne pas seul : il exige une laveuse compatible.",
    specification: "5 tamis · 220, 160, 120, 90 et 45 µm · commande au pied",
    powerWatts: 55,
    effects: { processingPrecision: 94, processingCapacity: 85 },
    unlocks: ["hash-filtration"],
    requirements: [{ oneOf: ["WASHER-25L", "WASHER-75G", "TSS-225"], label: "Machine à eau-glace" }],
    recommendations: ["FREEZE-DRYER"],
    realWorldAnchor: {
      label: "Lowtemp AutoSieve Collection System",
      seller: "Lowtemp Industries",
      sourceUrl: "https://www.lowtemp-plates.com/products/the-autosieve",
      referencePriceCents: 499_500,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "WASHER-75G",
    name: "Ice washer Osprey 75",
    category: "processing",
    slot: "washing",
    priceCents: 3_049_500,
    purchasable: true,
    shortDescription: "Une laveuse commerciale inox destinée aux ateliers qui enchaînent les gros lots.",
    benefit: "Monte fortement la capacité et la régularité du Hash eau-glace.",
    tradeoff: "Immobilise beaucoup de trésorerie et remplace la Mini Osprey dans le même emplacement.",
    specification: "75 gal · jusqu'à 21 000 g frais congelés par cycle",
    powerWatts: 1_800,
    effects: { processingPrecision: 90, processingCapacity: 80 },
    unlocks: ["ice-water-hash"],
    recommendations: ["AUTO-SIEVE", "FREEZE-DRYER"],
    realWorldAnchor: {
      label: "Lowtemp Osprey 75 Gallon Commercial Washing Machine",
      seller: "Lowtemp Industries",
      sourceUrl: "https://www.lowtemp-plates.com/collections/commercial-hash-washing-equipment",
      referencePriceCents: 3_049_500,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "TSS-225",
    name: "Séparateur automatisé TSS-225",
    category: "processing",
    slot: "washing",
    priceCents: 7_940_000,
    purchasable: true,
    shortDescription: "Le sommet industriel : recettes automatisées, recirculation et séparation répétable.",
    benefit: "Traite la totalité d'un gros lot avec la meilleure précision eau-glace.",
    tradeoff: "Prix d'usine, encombrement et consommation réservés à l'endgame.",
    specification: "Système automatisé inox · recettes programmables · recirculation",
    powerWatts: 3_500,
    effects: { processingPrecision: 97, processingCapacity: 100 },
    unlocks: ["ice-water-hash"],
    recommendations: ["AUTO-SIEVE", "FREEZE-DRYER"],
    realWorldAnchor: {
      label: "Forza TSS-225 Automated Trichome Separation System",
      seller: "Forza Solventless",
      sourceUrl: "https://www.forzasolventless.com/",
      referencePriceCents: 7_940_000,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "STATIC-PLASMA",
    name: "Séparateur statique Plasmastatic",
    category: "processing",
    slot: "static-separation",
    priceCents: 2_280_000,
    purchasable: true,
    shortDescription: "Un système électrostatique qui retire les contaminants végétaux d'un dry sift déjà préparé.",
    benefit: "Débloque le Static Sift, très pur et très rémunérateur en réputation.",
    tradeoff: "Faible rendement et investissement de laboratoire ; il faut déjà posséder un pollinator.",
    specification: "Séparation électrostatique · contrôle de charge · analyse d'humidité",
    powerWatts: 650,
    effects: { processingPrecision: 98, processingCapacity: 45 },
    unlocks: ["static-sift"],
    requirements: [{ oneOf: ["SIFT-TRAY"], label: "Pollinator à sec" }],
    realWorldAnchor: {
      label: "Plasmastatic V1.8 Electrostatic Sifting System",
      seller: "Supply The Brand",
      sourceUrl: "https://www.supplythebrand.com/product-page/plasmastatic-v1-8-electrostatic-sifting-system-sc-filtration",
      referencePriceCents: 2_280_000,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "PRESS-0600",
    name: "Presse à rosin Lowtemp V2",
    category: "processing",
    slot: "press",
    priceCents: 369_500,
    purchasable: true,
    shortDescription: "Une presse commerciale compacte, modulaire et pilotée par un contrôleur de température et pression.",
    benefit: "Débloque le Rosin d'essai avec une vraie presse professionnelle.",
    tradeoff: "Le débit reste limité à une seule presse et aux petits lots.",
    specification: "Plaques 3 × 5 ou 4 × 7 pouces · jusqu'à 20 t",
    powerWatts: 600,
    effects: { processingPrecision: 74, processingCapacity: 20 },
    unlocks: ["rosin-trial"],
    realWorldAnchor: {
      label: "Lowtemp V2 Rosin Press",
      seller: "Lowtemp Industries",
      sourceUrl: "https://www.lowtemp-plates.com/products/lowtemp-v2-rosin-press",
      referencePriceCents: 369_500,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "PRESS-2T",
    name: "Presse à rosin Pikes Peak V2",
    category: "processing",
    slot: "press",
    priceCents: 799_500,
    purchasable: true,
    shortDescription: "Une presse pneumatique double pression faite pour répéter les mêmes recettes.",
    benefit: "Débloque Rosin Sélection et améliore la répétabilité.",
    tradeoff: "Demande un compresseur et reste une machine à lot unique.",
    specification: "5 t · plaques 10 × 20 cm · contrôle pneumatique double",
    powerWatts: 1_000,
    effects: { processingPrecision: 84, processingCapacity: 35 },
    unlocks: ["rosin-trial", "rosin-selection"],
    realWorldAnchor: {
      label: "PurePressure Pikes Peak V2",
      seller: "M&R Equipment",
      sourceUrl: "https://www.mnrequipment.com/shop/ppf001-pikes-peak-rosin-press-v2-dual-pressure-control-16855",
      referencePriceCents: 799_500,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "PRESS-10T",
    name: "Presse à rosin Longs Peak",
    category: "processing",
    slot: "press",
    priceCents: 1_149_500,
    purchasable: true,
    shortDescription: "Une presse pneumatique à grandes plaques pour les séries régulières de niveau premium.",
    benefit: "Débloque Rosin Premium et augmente franchement la capacité.",
    tradeoff: "Son débit ne vaut l'investissement que sur les lots bien notés.",
    specification: "8 t · plaques 10 × 25 cm · contrôle de pression",
    powerWatts: 1_400,
    effects: { processingPrecision: 92, processingCapacity: 55 },
    unlocks: ["rosin-trial", "rosin-selection", "rosin-premium"],
    realWorldAnchor: {
      label: "PurePressure Longs Peak Rosin Press",
      seller: "Green Thumb Depot",
      sourceUrl: "https://greenthumbdepot.com/products/purepressure-longs-peak-8-ton-pneumatic-rosin-press",
      referencePriceCents: 1_149_500,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "PRESS-20T",
    name: "Presse automatisée NugSmasher IQ Pro",
    category: "processing",
    slot: "press",
    priceCents: 1_999_600,
    purchasable: true,
    shortDescription: "Une presse connectée haut débit qui journalise température, pression et recettes.",
    benefit: "Débloque Rosin Signature avec une capacité d'atelier automatisé.",
    tradeoff: "Le prix n'a de sens que pour les meilleurs lots et la course à la réputation.",
    specification: "20 t · plaques 10 × 25 cm · écran tactile et recettes",
    powerWatts: 1_800,
    effects: { processingPrecision: 98, processingCapacity: 90 },
    unlocks: ["rosin-trial", "rosin-selection", "rosin-premium", "rosin-signature"],
    realWorldAnchor: {
      label: "NugSmasher IQ Pro",
      seller: "NugSmasher",
      sourceUrl: "https://nugsmasher.com/product-category/rosin-press/",
      referencePriceCents: 1_999_600,
      priceKind: "promotion",
      checkedAt,
    },
  },
  {
    code: "FREEZE-DRYER",
    name: "Sécheur de hash HiLyph XL",
    category: "processing",
    slot: "drying",
    priceCents: 749_500,
    purchasable: true,
    shortDescription: "Un lyophilisateur spécialisé résine qui stabilise rapidement le hash lavé.",
    benefit: "Débloque le séchage professionnel nécessaire au Hash Signature.",
    tradeoff: "Très cher et inutile sans atelier eau-glace.",
    specification: "10 plateaux inox · contrôle thermique · capacité glace 40 lb",
    powerWatts: 1_600,
    effects: { processingPrecision: 98, processingCapacity: 90, qualityMaxBonus: 3 },
    unlocks: ["freeze-drying"],
    requirements: [{ oneOf: ["WASHER-25L", "WASHER-75G", "TSS-225"], label: "Machine à eau-glace" }],
    realWorldAnchor: {
      label: "HiLyph Hash Dryer XL",
      seller: "TCI Scientific Innovations",
      sourceUrl: "https://www.tciscientific.com/hilyph_hash_dryer_xl",
      referencePriceCents: 749_500,
      priceKind: "standard",
      checkedAt,
    },
  },
  {
    code: "SOLAR-BACKUP",
    name: "Panneau solaire et batterie",
    category: "energy",
    slot: "energy",
    priceCents: 114_900,
    purchasable: true,
    shortDescription: "Une réserve d'énergie propre pour encaisser les factures et les coupures.",
    benefit: "Réduit la facture de 20 % et débloque une protection contre les coupures.",
    tradeoff: "Investissement important sans bonus direct de qualité.",
    specification: "Panneau 110 W · batterie 1,024 kWh · sortie 1 800 W",
    powerWatts: 0,
    effects: { energyDiscountPercent: 20 },
    unlocks: ["power-backup"],
    realWorldAnchor: {
      label: "EcoFlow DELTA 2 Solar Generator · panneau 110 W",
      seller: "EcoFlow US",
      sourceUrl: "https://us.ecoflow.com/products/delta-2-110w-portable-solar-panel?country=US&currency=USD&variant=40663878041673",
      referencePriceCents: 114_900,
      priceKind: "promotion",
      checkedAt,
    },
  },
  {
    code: "SECURITY-CAMERA",
    name: "Caméra cabossée",
    category: "security",
    slot: "security",
    priceCents: 6_999,
    purchasable: true,
    shortDescription: "Elle a déjà vécu, mais elle voit encore très bien les renards à deux pattes.",
    benefit: "Protège une partie de la récolte contre le premier vol.",
    tradeoff: "N'améliore ni la quantité ni la qualité.",
    specification: "Caméra 2K QHD · vision nocturne · microSD jusqu'à 512 Go",
    powerWatts: 12,
    effects: {},
    unlocks: ["theft-protection"],
    realWorldAnchor: {
      label: "TP-Link Tapo C520WS 2K QHD",
      seller: "TP-Link US Store",
      sourceUrl: "https://us.store.tp-link.com/collections/motion-sensor-cameras?page=2",
      referencePriceCents: 6_999,
      priceKind: "standard",
      checkedAt,
    },
  },
] as const;

export const KQ_STARTING_EQUIPMENT_CODES = [
  "TENT-080-STARTER",
  "LED-150-STARTER",
  "AIR-STARTER",
] as const;

export const KQ_EQUIPMENT_CATEGORY_LABELS: Record<KqEquipmentCategory, string> = {
  infrastructure: "Tentes",
  lighting: "Éclairage",
  climate: "Climat",
  processing: "Transformation",
  energy: "Énergie",
  security: "Sécurité",
};

export const KQ_EQUIPMENT_SLOT_LABELS: Record<KqEquipmentSlot, string> = {
  tent: "Tente",
  lighting: "Éclairage",
  air: "Extraction",
  "climate-controller": "Contrôle climatique",
  sifting: "Pollinator à sec",
  washing: "Lavage eau-glace",
  filtration: "Filtration",
  "static-separation": "Séparation statique",
  press: "Presse à rosin",
  drying: "Séchage",
  energy: "Énergie",
  security: "Sécurité",
};

export const KQ_EQUIPMENT_UNLOCK_LABELS: Record<KqEquipmentUnlock, string> = {
  "raw-sale": "Vente du lot brut",
  "dry-sift": "Hash tamisé",
  "ice-water-hash": "Hash eau-glace",
  "hash-filtration": "Filtration du Hash Signature",
  "static-sift": "Static Sift",
  "freeze-drying": "Séchage du Hash Signature",
  "rosin-trial": "Rosin d’essai",
  "rosin-selection": "Rosin Sélection",
  "rosin-premium": "Rosin Premium",
  "rosin-signature": "Rosin Signature",
  "power-backup": "Secours contre les coupures",
  "theft-protection": "Protection contre le vol",
};

export const KQ_EQUIPMENT_REPLACEMENTS: Record<string, { code: string; level: number }> = {
  "TENT-150": { code: "TENT-120", level: 10 },
  "LED-500": { code: "LED-300", level: 10 },
  "WASHER-75G": { code: "WASHER-25L", level: 5 },
  "TSS-225": { code: "WASHER-25L", level: 10 },
  "PRESS-2T": { code: "PRESS-0600", level: 5 },
  "PRESS-10T": { code: "PRESS-0600", level: 8 },
  "PRESS-20T": { code: "PRESS-0600", level: 10 },
};

export const KQ_EQUIPMENT_CATALOG: readonly KqEquipmentDefinition[] = LEGACY_EQUIPMENT_CATALOG
  .filter((item) => !KQ_EQUIPMENT_REPLACEMENTS[item.code])
  .map((item) => ({
    ...item,
    ...(item.code === "PRESS-0600" ? {
      name: "Presse à rosin",
      benefit: "Débloque les filières Rosin. Les niveaux augmentent la capacité et la valeur de transformation.",
      unlocks: ["rosin-trial", "rosin-selection", "rosin-premium", "rosin-signature"] as KqEquipmentUnlock[],
    } : {}),
    requirements: item.requirements?.map((requirement) => ({ ...requirement,
      oneOf: [...new Set(requirement.oneOf.map((code) => KQ_EQUIPMENT_REPLACEMENTS[code]?.code ?? code))],
    })),
    recommendations: item.recommendations?.map((code) => KQ_EQUIPMENT_REPLACEMENTS[code]?.code ?? code),
  }));

// Old saves and sale receipts can still resolve retired model codes.
const EQUIPMENT_BY_CODE = new Map([...LEGACY_EQUIPMENT_CATALOG, ...KQ_EQUIPMENT_CATALOG].map((equipment) => [equipment.code, equipment]));

const KQ_EQUIPMENT_UPGRADE_CHAINS: readonly (readonly string[])[] = [
  ["TENT-120", "TENT-150"],
  ["LED-300", "LED-500"],
  ["WASHER-25L", "WASHER-75G", "TSS-225"],
  ["PRESS-0600", "PRESS-2T", "PRESS-10T", "PRESS-20T"],
] as const;

export type KqEquipmentCatalogRow = {
  code: string;
  price_cents: number;
  is_purchasable: boolean;
  is_active: boolean;
};

export function auditKqEquipmentCatalog(rows: KqEquipmentCatalogRow[]) {
  const localCodes = KQ_EQUIPMENT_CATALOG.map((equipment) => equipment.code);
  const sourcesReady = new Set(localCodes).size === localCodes.length
    && KQ_EQUIPMENT_CATALOG.every((equipment) => (
      equipment.realWorldAnchor.referencePriceCents > 0
      && equipment.realWorldAnchor.checkedAt === KQ_EQUIPMENT_PRICE_CHECKED_AT
      && equipment.realWorldAnchor.sourceUrl.startsWith("https://")
      && equipment.realWorldAnchor.seller.trim().length > 0
      && (!equipment.purchasable || equipment.priceCents === equipment.realWorldAnchor.referencePriceCents)
    ));
  const databaseByCode = new Map(rows.map((row) => [row.code, row]));
  const mismatchedCodes = KQ_EQUIPMENT_CATALOG.flatMap((equipment) => {
    const row = databaseByCode.get(equipment.code);
    return row
      && row.price_cents === equipment.priceCents
      && row.is_purchasable === equipment.purchasable
      && row.is_active
      ? []
      : [equipment.code];
  });
  const databaseReady = rows.filter((row) => row.is_active).length === KQ_EQUIPMENT_CATALOG.length
    && databaseByCode.size === rows.length
    && mismatchedCodes.length === 0;

  return {
    sourcesReady,
    databaseReady,
    checkedAt: KQ_EQUIPMENT_PRICE_CHECKED_AT,
    sourceCount: KQ_EQUIPMENT_CATALOG.length,
    purchasableCount: KQ_EQUIPMENT_CATALOG.filter((equipment) => equipment.purchasable).length,
    mismatchedCodes,
  };
}

export function getKqEquipmentDefinition(code: string) {
  return EQUIPMENT_BY_CODE.get(code) ?? null;
}

export const KQ_EQUIPMENT_MAX_LEVEL = 10;
export type KqEquipmentLevels = Record<string, number>;

export function getKqEquipmentLevel(level: number | undefined) {
  return Number.isInteger(level) && Number(level) >= 1 && Number(level) <= KQ_EQUIPMENT_MAX_LEVEL ? Number(level) : 1;
}

// Game upgrades never change the real machine's specifications or its drawbacks.
export function getKqEquipmentAtLevel(code: string, requestedLevel = 1): KqEquipmentDefinition | null {
  const base = getKqEquipmentDefinition(code);
  if (!base) return null;
  const step = base.purchasable ? getKqEquipmentLevel(requestedLevel) - 1 : 0;
  if (!step) return base;
  const effects = { ...base.effects };
  for (const field of ["quantityPercent", "regularityPercent", "energyDiscountPercent"] as const) {
    const value = base.effects[field];
    if (value) effects[field] = value + Math.ceil(value / 10) * step;
  }
  if (effects.qualityMaxBonus) effects.qualityMaxBonus += Math.floor(step / 3);
  if (base.category === "processing") {
    effects.processingCapacity = Math.min(100, (effects.processingCapacity ?? 0) + (base.slot === "press" ? 8 : base.slot === "washing" ? 6 : 2) * step);
    effects.processingValueBonusPercent = 2 * step;
  }
  // These devices already prevent their incident completely at level 1.
  // Their upgrades improve the harvest's regularity without weakening that protection.
  if (base.category === "security" || base.category === "energy") effects.regularityPercent = step;
  return { ...base, effects, benefit: getKqEquipmentImpactLabels({ ...base, effects }).filter((label) => !label.startsWith("Débloque :")).slice(0, 3).join(" · ") };
}

export function getKqEquipmentUpgradeCost(code: string, requestedLevel: number): number | null {
  const equipment = getKqEquipmentDefinition(code);
  const level = getKqEquipmentLevel(requestedLevel);
  if (!equipment?.purchasable || KQ_EQUIPMENT_REPLACEMENTS[code] || level !== requestedLevel || level >= KQ_EQUIPMENT_MAX_LEVEL) return null;
  return Math.ceil(equipment.priceCents * level / 10);
}

export function getKqEquipmentImpactLabels(equipment: KqEquipmentDefinition) {
  const effects = equipment.effects;
  const labels = [
    effects.quantityPercent ? `Quantité +${effects.quantityPercent} %` : null,
    effects.qualityMaxBonus ? `Qualité maximale +${effects.qualityMaxBonus}` : null,
    effects.regularityPercent ? `Régularité +${effects.regularityPercent} %` : null,
    effects.pressureDelta ? `Pression de culture +${effects.pressureDelta}` : null,
    effects.energyDiscountPercent ? `Facture −${effects.energyDiscountPercent} %` : null,
    effects.processingCapacity ? `Capacité de transformation ${effects.processingCapacity} %` : null,
    effects.processingPrecision ? `Précision de transformation ${effects.processingPrecision} %` : null,
    effects.processingValueBonusPercent ? `Valeur de transformation +${effects.processingValueBonusPercent} %` : null,
    ...equipment.unlocks.map((unlock) => `Débloque : ${KQ_EQUIPMENT_UNLOCK_LABELS[unlock]}`),
  ].filter((label): label is string => Boolean(label));
  return [...new Set(labels.length > 0 ? labels : [equipment.benefit])];
}

export function isKqEquipmentSuperseded(equipmentCode: string, ownedCodes: string[]) {
  const owned = new Set(ownedCodes);
  return KQ_EQUIPMENT_UPGRADE_CHAINS.some((chain) => {
    const candidateIndex = chain.findIndex((code) => code === equipmentCode);
    return candidateIndex >= 0 && chain.some((code, index) => index > candidateIndex && owned.has(code));
  });
}

export function getKqEquipmentProgressionStatus(ownedCodes: string[]) {
  const owned = new Set(ownedCodes);
  const remaining = KQ_EQUIPMENT_CATALOG.filter((equipment) => equipment.purchasable && !owned.has(equipment.code));
  const alternatives = remaining.filter((equipment) => isKqEquipmentSuperseded(equipment.code, ownedCodes));
  return {
    catalogComplete: remaining.length === 0,
    progressionComplete: remaining.length === alternatives.length,
    remainingCount: remaining.length,
    alternativeCount: alternatives.length,
  };
}

export function buildKqEquipmentHudSummary(input: {
  ownedCodes: string[];
  equippedCodes: string[];
}) {
  const equipped = new Set(input.equippedCodes);
  const owned = [...new Set(input.ownedCodes)]
    .map((code) => getKqEquipmentDefinition(code))
    .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment));
  return {
    purchased: owned.filter((equipment) => equipment.purchasable).map((equipment) => ({
      ...equipment,
      equipped: equipped.has(equipment.code),
    })),
    installed: [...equipped]
      .map((code) => getKqEquipmentDefinition(code))
      .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment)),
  };
}

export function getKqNextEquipmentGoal(input: {
  ownedCodes: string[];
  cashCents: number;
}) {
  const candidates = KQ_EQUIPMENT_CATALOG
    .filter((equipment) => (
      equipment.purchasable
      && !input.ownedCodes.includes(equipment.code)
      && !isKqEquipmentSuperseded(equipment.code, input.ownedCodes)
      && getKqEquipmentRequirementState({
        equipment,
        ownedCodes: input.ownedCodes,
      }).compatible
    ))
    .sort((left, right) => {
      const leftUnlockPriority = left.unlocks.length > 0 ? 0 : 1;
      const rightUnlockPriority = right.unlocks.length > 0 ? 0 : 1;
      return left.priceCents - right.priceCents
        || leftUnlockPriority - rightUnlockPriority
        || left.code.localeCompare(right.code);
    });
  const equipment = candidates[0] ?? null;
  if (!equipment) return null;
  const savedCents = Math.min(Math.max(0, input.cashCents), equipment.priceCents);
  return {
    equipment,
    savedCents,
    remainingCents: Math.max(0, equipment.priceCents - savedCents),
    progressPercent: equipment.priceCents > 0
      ? Math.round(savedCents / equipment.priceCents * 100)
      : 100,
    affordable: input.cashCents >= equipment.priceCents,
  };
}

export type KqEquipmentGoalReceipt = {
  code: string;
  name: string;
  benefit: string;
  priceCents: number;
  savedCents: number;
  remainingCents: number;
  progressPercent: number;
  affordable: boolean;
};

export function buildKqEquipmentGoalReceipt(input: {
  ownedCodes: string[];
  cashCents: number;
}): KqEquipmentGoalReceipt | null {
  const goal = getKqNextEquipmentGoal(input);
  if (!goal) return null;
  return {
    code: goal.equipment.code,
    name: goal.equipment.name,
    benefit: goal.equipment.benefit,
    priceCents: goal.equipment.priceCents,
    savedCents: goal.savedCents,
    remainingCents: goal.remainingCents,
    progressPercent: goal.progressPercent,
    affordable: goal.affordable,
  };
}

export function formatKqCash(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function getKqEquipmentCartTotal(codes: string[]) {
  return [...new Set(codes)].reduce((total, code) => {
    const equipment = getKqEquipmentDefinition(code);
    return total + (equipment?.purchasable ? equipment.priceCents : 0);
  }, 0);
}

export function getKqEquipmentRequirementState(input: {
  equipment: KqEquipmentDefinition;
  ownedCodes: string[];
  cartCodes?: string[];
}) {
  const available = new Set([...input.ownedCodes, ...(input.cartCodes ?? [])]);
  const missing = (input.equipment.requirements ?? []).filter((requirement) => (
    !requirement.oneOf.some((code) => available.has(code))
  ));
  return { compatible: missing.length === 0, missing };
}

export type KqEquipmentCatalogSort = "progression" | "price-asc" | "price-desc";

export function isKqEquipmentImmediatelyPurchasable(input: {
  equipment: KqEquipmentDefinition;
  ownedCodes: string[];
  cartCodes?: string[];
  cashCents: number;
}) {
  return input.equipment.purchasable
    && !input.ownedCodes.includes(input.equipment.code)
    && input.equipment.priceCents <= input.cashCents
    && getKqEquipmentRequirementState({
      equipment: input.equipment,
      ownedCodes: input.ownedCodes,
      cartCodes: input.cartCodes,
    }).compatible;
}

export function sortKqEquipmentCatalog(input: {
  equipment: readonly KqEquipmentDefinition[];
  ownedCodes: string[];
  cartCodes?: string[];
  cashCents: number;
  recommendedCode?: string | null;
  sort?: KqEquipmentCatalogSort;
}) {
  const sort = input.sort ?? "progression";
  const owned = new Set(input.ownedCodes);
  const compatible = (equipment: KqEquipmentDefinition) => getKqEquipmentRequirementState({
    equipment,
    ownedCodes: input.ownedCodes,
    cartCodes: input.cartCodes,
  }).compatible;
  const immediatelyPurchasable = (equipment: KqEquipmentDefinition) => isKqEquipmentImmediatelyPurchasable({
    equipment,
    ownedCodes: input.ownedCodes,
    cartCodes: input.cartCodes,
    cashCents: input.cashCents,
  });

  return [...input.equipment].sort((left, right) => {
    if (sort === "price-asc") return left.priceCents - right.priceCents || left.code.localeCompare(right.code);
    if (sort === "price-desc") return right.priceCents - left.priceCents || left.code.localeCompare(right.code);
    return Number(right.code === input.recommendedCode) - Number(left.code === input.recommendedCode)
      || Number(isKqEquipmentSuperseded(left.code, input.ownedCodes)) - Number(isKqEquipmentSuperseded(right.code, input.ownedCodes))
      || Number(immediatelyPurchasable(right)) - Number(immediatelyPurchasable(left))
      || Number(owned.has(left.code)) - Number(owned.has(right.code))
      || Number(compatible(right)) - Number(compatible(left))
      || Number(right.purchasable) - Number(left.purchasable)
      || left.priceCents - right.priceCents
      || left.code.localeCompare(right.code);
  });
}

export function validateKqEquipmentCart(input: {
  cartCodes: string[];
  ownedCodes: string[];
  equippedCodes?: string[];
  cashCents: number;
}) {
  const uniqueCodes = [...new Set(input.cartCodes)];
  const duplicateCodes = input.cartCodes.filter((code, index) => input.cartCodes.indexOf(code) !== index);
  const invalidCodes = uniqueCodes.filter((code) => !getKqEquipmentDefinition(code)?.purchasable);
  const alreadyOwnedCodes = uniqueCodes.filter((code) => input.ownedCodes.includes(code));
  const totalCents = getKqEquipmentCartTotal(uniqueCodes);
  const cartEquipment = uniqueCodes
    .map((code) => getKqEquipmentDefinition(code))
    .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment));
  const compatibilityWarnings = uniqueCodes.flatMap((code) => {
    const equipment = getKqEquipmentDefinition(code);
    if (!equipment) return [];
    return getKqEquipmentRequirementState({
      equipment,
      ownedCodes: input.ownedCodes,
      cartCodes: uniqueCodes,
    }).missing.map((requirement) => `${equipment.name} nécessite : ${requirement.label}.`);
  });
  const cartSlotCounts = cartEquipment.reduce((counts, equipment) => {
    counts.set(equipment.slot, (counts.get(equipment.slot) ?? 0) + 1);
    return counts;
  }, new Map<KqEquipmentSlot, number>());
  const slotConflictWarnings = [...cartSlotCounts.entries()].flatMap(([slot, count]) => (
    count > 1
      ? [`${KQ_EQUIPMENT_SLOT_LABELS[slot]} : ${count} articles partagent cet emplacement ; un seul pourra être installé à la fois.`]
      : []
  ));
  const equippedBySlot = new Map(
    (input.equippedCodes ?? [])
      .map((code) => getKqEquipmentDefinition(code))
      .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment))
      .map((equipment) => [equipment.slot, equipment] as const),
  );
  const replacementWarnings = cartEquipment.flatMap((equipment) => {
    const equipped = equippedBySlot.get(equipment.slot);
    return equipped && equipped.code !== equipment.code
      ? [`${equipment.name} remplacera ${equipped.name} dans l’emplacement ${KQ_EQUIPMENT_SLOT_LABELS[equipment.slot]} si tu l’installes.`]
      : [];
  });
  return {
    uniqueCodes,
    totalCents,
    cashAfterCents: input.cashCents - totalCents,
    errors: [
      ...(uniqueCodes.length === 0 ? ["Le panier est vide."] : []),
      ...(duplicateCodes.length > 0 ? ["Un équipement durable ne peut apparaître qu'une fois dans le panier."] : []),
      ...(invalidCodes.length > 0 ? ["Le panier contient un équipement indisponible."] : []),
      ...(alreadyOwnedCodes.length > 0 ? ["Tu possèdes déjà un équipement présent dans le panier."] : []),
      ...(input.cashCents < totalCents ? ["Ton solde est insuffisant pour cet investissement."] : []),
    ],
    warnings: [...compatibilityWarnings, ...slotConflictWarnings, ...replacementWarnings],
  };
}

export function summarizeKqEquipmentLoadout(equippedCodes: string[], levels: KqEquipmentLevels = {}) {
  const equipment = equippedCodes
    .map((code) => getKqEquipmentAtLevel(code, levels[code]))
    .filter((item): item is KqEquipmentDefinition => Boolean(item));
  return equipment.reduce((summary, item) => ({
    quantityPercent: summary.quantityPercent + (item.effects.quantityPercent ?? 0),
    qualityMaxBonus: summary.qualityMaxBonus + (item.effects.qualityMaxBonus ?? 0),
    regularityPercent: summary.regularityPercent + (item.effects.regularityPercent ?? 0),
    pressureDelta: summary.pressureDelta + (item.effects.pressureDelta ?? 0),
    powerWatts: summary.powerWatts + item.powerWatts,
    energyDiscountPercent: Math.min(60, summary.energyDiscountPercent + (item.effects.energyDiscountPercent ?? 0)),
    processingPrecision: Math.max(summary.processingPrecision, item.effects.processingPrecision ?? 0),
    processingCapacityPercent: Math.max(summary.processingCapacityPercent, item.effects.processingCapacity ?? 0),
    unlocks: [...new Set([...summary.unlocks, ...item.unlocks])],
  }), {
    quantityPercent: 0,
    qualityMaxBonus: 0,
    regularityPercent: 0,
    pressureDelta: 0,
    powerWatts: 0,
    energyDiscountPercent: 0,
    processingPrecision: 0,
    processingCapacityPercent: 0,
    unlocks: [] as KqEquipmentUnlock[],
  });
}

export function projectKqEquipmentLoadout(input: {
  equippedCodes: string[];
  candidateCodes: string[];
  ownedCodes?: string[];
  levels?: KqEquipmentLevels;
}) {
  const effectiveBySlot = new Map<KqEquipmentSlot, KqEquipmentDefinition>();
  input.equippedCodes
    .map((code) => getKqEquipmentDefinition(code))
    .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment))
    .forEach((equipment) => effectiveBySlot.set(equipment.slot, equipment));

  const candidatesBySlot = input.candidateCodes
    .map((code) => getKqEquipmentDefinition(code))
    .filter((equipment): equipment is KqEquipmentDefinition => Boolean(equipment))
    .reduce((groups, equipment) => {
      groups.set(equipment.slot, [...(groups.get(equipment.slot) ?? []), equipment]);
      return groups;
    }, new Map<KqEquipmentSlot, KqEquipmentDefinition[]>());
  const ambiguousSlots: KqEquipmentSlot[] = [];
  const blockedCodes: string[] = [];
  const availableCodes = [...(input.ownedCodes ?? []), ...input.candidateCodes];

  candidatesBySlot.forEach((candidates, slot) => {
    if (candidates.length !== 1) {
      ambiguousSlots.push(slot);
      return;
    }
    const candidate = candidates[0];
    if (!getKqEquipmentRequirementState({ equipment: candidate, ownedCodes: availableCodes }).compatible) {
      blockedCodes.push(candidate.code);
      return;
    }
    effectiveBySlot.set(slot, candidate);
  });

  const equipmentCodes = [...effectiveBySlot.values()].map((equipment) => equipment.code);
  return {
    ...summarizeKqEquipmentLoadout(equipmentCodes, input.levels),
    equipmentCodes,
    ambiguousSlots,
    blockedCodes,
  };
}
