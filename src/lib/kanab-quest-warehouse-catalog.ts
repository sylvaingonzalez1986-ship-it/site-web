/** Fictional equipment. Historical codes remain stable save and inventory keys. */
export const KQ_WAREHOUSE_TIERS = [
  {
    "code": "economy",
    "label": "Économique"
  },
  {
    "code": "standard",
    "label": "Standard"
  },
  {
    "code": "premium",
    "label": "Haut de gamme"
  }
] as const;
export type KqWarehouseTier = typeof KQ_WAREHOUSE_TIERS[number]["code"];

export type KqWarehouseDevice = {
  code: string;
  name: string;
  tier: KqWarehouseTier;
  /** False only for preserved equipment that can no longer be bought. */
  purchasable?: boolean;
  room: "culture" | "processing" | "storage";
  kind: "lighting" | "air" | "climate" | "drying" | "storage" | "processing";
  legacyCode?: string;
  priceCents: number;
  watts: number;
  wattsBasis: "manufacturer" | "passive" | "estimate" | "simulation";
  footprintM2: number;
  footprintBasis: "manufacturer-dimensions" | "estimate" | "simulation";
  sourceUrl: string;
  specificationUrl?: string;
  checkedAt: string;
  priceBasis: "observed" | "estimate" | "simulation";
  priceNote: string;
  specification: string;
  zoneLayout?: {
    unitsPerM2: number;
    capacityGramsPerUnit: number;
    volumeLitresPerUnit?: number;
    usableSurfaceM2PerUnit?: number;
    note: string;
    art: "drying" | "jars" | "drum" | "shelf";
  };
  gameCapacity: {
    unit: "m2" | "g" | "g/batch";
    value: number;
    durationHours?: number;
    note: string;
  };
};

export const KQ_WAREHOUSE_CATALOG_CHECKED_AT = "2026-10-12";
/** Fictional volume conversion; never a product density. */
export const KQ_WAREHOUSE_STORAGE_SIMULATED_GRAMS_PER_LITRE = 50;

/** Historical prices, capacities and loads stay unchanged for owned stock and frozen runs. */
export const KQ_WAREHOUSE_CATALOG: readonly KqWarehouseDevice[] = [
  {
    "code": "MH-TS1000",
    "name": "Éclairage économique",
    "room": "culture",
    "kind": "lighting",
    "priceCents": 14900,
    "watts": 150,
    "wattsBasis": "simulation",
    "footprintM2": 0.128734,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Un petit module par case : budget initial contenu, charge par m² plus importante.",
    "gameCapacity": {
      "unit": "m2",
      "value": 1,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "economy"
  },
  {
    "code": "SIM-LIGHT-02",
    "name": "Éclairage standard",
    "room": "culture",
    "kind": "lighting",
    "priceCents": 32900,
    "watts": 240,
    "wattsBasis": "simulation",
    "footprintM2": 0.128734,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Deux cases par module et moins d’énergie par m², contre un prix d’achat supérieur.",
    "gameCapacity": {
      "unit": "m2",
      "value": 2,
      "note": "Couverture fictive ; achat d’appareils entiers, sans dimensionnement réel."
    },
    "tier": "standard",
    "purchasable": true
  },
  {
    "code": "SIM-LIGHT-03",
    "name": "Éclairage haut de gamme",
    "room": "culture",
    "kind": "lighting",
    "priceCents": 74900,
    "watts": 400,
    "wattsBasis": "simulation",
    "footprintM2": 0.128734,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Quatre cases par module et charge minimale par m², avec le budget initial le plus élevé.",
    "gameCapacity": {
      "unit": "m2",
      "value": 4,
      "note": "Couverture fictive ; achat d’appareils entiers, sans dimensionnement réel."
    },
    "tier": "premium",
    "purchasable": true
  },
  {
    "code": "MH-FCE3000",
    "name": "Éclairage historique",
    "room": "culture",
    "kind": "lighting",
    "priceCents": 19900,
    "watts": 300,
    "wattsBasis": "simulation",
    "footprintM2": 0.3684,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Ancien module conservé pour les installations existantes. Il reste utilisable, sans nouvel achat.",
    "gameCapacity": {
      "unit": "m2",
      "value": 2,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "standard",
    "purchasable": false
  },
  {
    "code": "SIM-AIR-01",
    "name": "Extraction économique",
    "room": "culture",
    "kind": "air",
    "priceCents": 4900,
    "watts": 20,
    "wattsBasis": "simulation",
    "footprintM2": 0.0625,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Petit module abordable, avec une charge par m² couvert plus importante.",
    "gameCapacity": {
      "unit": "m2",
      "value": 8,
      "note": "Couverture fictive ; achat d’appareils entiers, sans dimensionnement réel."
    },
    "tier": "economy",
    "purchasable": true
  },
  {
    "code": "SJ-DF16E350",
    "name": "Extraction standard",
    "room": "culture",
    "kind": "air",
    "priceCents": 14900,
    "watts": 35,
    "wattsBasis": "simulation",
    "footprintM2": 0.0625,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Couverture intermédiaire et charge par m² réduite par rapport à la gamme économique.",
    "gameCapacity": {
      "unit": "m2",
      "value": 20,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "standard"
  },
  {
    "code": "SIM-AIR-03",
    "name": "Extraction haut de gamme",
    "room": "culture",
    "kind": "air",
    "priceCents": 44900,
    "watts": 55,
    "wattsBasis": "simulation",
    "footprintM2": 0.0625,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Grande couverture et charge minimale par m² ; son achat se justifie surtout dans une grande zone.",
    "gameCapacity": {
      "unit": "m2",
      "value": 50,
      "note": "Couverture fictive ; achat d’appareils entiers, sans dimensionnement réel."
    },
    "tier": "premium",
    "purchasable": true
  },
  {
    "code": "SJ-DRYIT90",
    "name": "Séchage économique",
    "room": "storage",
    "kind": "drying",
    "priceCents": 3990,
    "zoneLayout": {
      "unitsPerM2": 1,
      "capacityGramsPerUnit": 1000,
      "usableSurfaceM2PerUnit": 2.5132741228718345,
      "art": "drying",
      "note": "Capacité de jeu par m². Aucune charge électrique pour cet équipement passif."
    },
    "watts": 0,
    "wattsBasis": "passive",
    "footprintM2": 0.64,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Rangement suspendu passif : petit budget, capacité limitée par case.",
    "gameCapacity": {
      "unit": "g",
      "value": 5000,
      "durationHours": 6,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "economy"
  },
  {
    "code": "SIM-DRYING-02",
    "name": "Séchage standard",
    "room": "storage",
    "kind": "drying",
    "priceCents": 9990,
    "zoneLayout": {
      "unitsPerM2": 1,
      "capacityGramsPerUnit": 2500,
      "art": "drying",
      "note": "Capacité de jeu par m². Aucune charge électrique pour cet équipement passif."
    },
    "watts": 0,
    "wattsBasis": "passive",
    "footprintM2": 0.64,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Un rangement passif plus dense pour gagner de la capacité sans agrandir la zone.",
    "gameCapacity": {
      "unit": "g",
      "value": 2500,
      "durationHours": 6,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "standard"
  },
  {
    "code": "SIM-DRYING-03",
    "name": "Séchage haut de gamme",
    "room": "storage",
    "kind": "drying",
    "priceCents": 19990,
    "zoneLayout": {
      "unitsPerM2": 1,
      "capacityGramsPerUnit": 6000,
      "art": "drying",
      "note": "Capacité de jeu par m². Aucune charge électrique pour cet équipement passif."
    },
    "watts": 0,
    "wattsBasis": "passive",
    "footprintM2": 0.64,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Capacité maximale par case pour un investissement élevé, sans accélérer le temps de jeu.",
    "gameCapacity": {
      "unit": "g",
      "value": 6000,
      "durationHours": 6,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "premium"
  },
  {
    "code": "LP-SUPER-1L",
    "name": "Stockage économique",
    "room": "storage",
    "kind": "storage",
    "priceCents": 2090,
    "zoneLayout": {
      "unitsPerM2": 4,
      "capacityGramsPerUnit": 300,
      "volumeLitresPerUnit": 6,
      "art": "jars",
      "note": "Capacité de jeu par m². Aucune charge électrique pour cet équipement passif."
    },
    "watts": 0,
    "wattsBasis": "passive",
    "footprintM2": 0.07,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Petits contenants séparés : budget contenu et capacité limitée, adaptés aux petits lots du jeu.",
    "gameCapacity": {
      "unit": "g",
      "value": 300,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "economy"
  },
  {
    "code": "BROR-JARS-48",
    "name": "Stockage standard",
    "room": "storage",
    "kind": "storage",
    "priceCents": 25720,
    "watts": 0,
    "wattsBasis": "passive",
    "footprintM2": 0.34,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Rayonnage compartimenté : davantage de petits lots indépendants par case.",
    "gameCapacity": {
      "unit": "g",
      "value": 2400,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "zoneLayout": {
      "unitsPerM2": 1,
      "capacityGramsPerUnit": 2400,
      "volumeLitresPerUnit": 48,
      "art": "shelf",
      "note": "Capacité de jeu par m². Aucune charge électrique pour cet équipement passif."
    },
    "tier": "standard"
  },
  {
    "code": "CURTEC-60L",
    "name": "Stockage haut de gamme",
    "room": "storage",
    "kind": "storage",
    "priceCents": 8550,
    "watts": 0,
    "wattsBasis": "passive",
    "footprintM2": 0.139876,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Grande capacité par case, mais seulement quatre lots indépendants par m².",
    "gameCapacity": {
      "unit": "g",
      "value": 3000,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "zoneLayout": {
      "unitsPerM2": 4,
      "capacityGramsPerUnit": 3000,
      "volumeLitresPerUnit": 60,
      "art": "drum",
      "note": "Capacité de jeu par m². Aucune charge électrique pour cet équipement passif."
    },
    "tier": "premium"
  },
  {
    "code": "GV-GP50-7",
    "name": "Presse d’atelier",
    "room": "processing",
    "kind": "processing",
    "legacyCode": "PRESS-0600",
    "priceCents": 36999,
    "watts": 500,
    "wattsBasis": "simulation",
    "footprintM2": 0.0576,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Machine fictive reliée à la progression de l’atelier.",
    "gameCapacity": {
      "unit": "g/batch",
      "value": 80,
      "durationHours": 1,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "standard"
  },
  {
    "code": "GV-WASHER-36L",
    "name": "Cuve d’atelier",
    "room": "processing",
    "kind": "processing",
    "legacyCode": "WASHER-25L",
    "priceCents": 12799,
    "watts": 250,
    "wattsBasis": "simulation",
    "footprintM2": 0.25,
    "footprintBasis": "simulation",
    "sourceUrl": "",
    "checkedAt": "2026-10-12",
    "priceBasis": "simulation",
    "priceNote": "Prix fictif du jeu ; pose et préparation de la zone calculées séparément dans le devis.",
    "specification": "Machine fictive reliée à la progression de l’atelier.",
    "gameCapacity": {
      "unit": "g/batch",
      "value": 500,
      "durationHours": 2,
      "note": "Capacité et durée fictives, sans performance ou procédé réel."
    },
    "tier": "standard"
  }
];

export function getKqWarehouseDevice(code: string): KqWarehouseDevice | undefined {
  return KQ_WAREHOUSE_CATALOG.find(device => device.code === code);
}
