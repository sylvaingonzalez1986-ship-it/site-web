import retailSupplies from "./kanab-quest-warehouse-retail-supplies.json";
export const KQ_WAREHOUSE_PREPARATION_CATALOG = {
  "WAREHOUSE-VACUUM": { name: "Aspirateur", kind: "equipment", priceCents: retailSupplies["WAREHOUSE-VACUUM"].unitPriceCents, unit: "outil" },
  "WAREHOUSE-MOP": { name: "Serpillière", kind: "equipment", priceCents: retailSupplies["WAREHOUSE-MOP"].unitPriceCents, unit: "outil" },
  "WAREHOUSE-NUTRITION-BASE": { name: "Nutrition de base", kind: "consumable", priceCents: retailSupplies["WAREHOUSE-NUTRITION-BASE"].unitPriceCents, unit: "dose" },
  "WAREHOUSE-NUTRITION-SUPPLEMENT": { name: "Complément de nutrition", kind: "consumable", priceCents: retailSupplies["WAREHOUSE-NUTRITION-SUPPLEMENT"].unitPriceCents, unit: "dose" },
  "WAREHOUSE-PBI": { name: "Protection biologique", kind: "consumable", priceCents: retailSupplies["WAREHOUSE-PBI"].unitPriceCents, unit: "dose" },
  "WAREHOUSE-MAINTENANCE": { name: "Fournitures d’entretien", kind: "consumable", priceCents: retailSupplies["WAREHOUSE-MAINTENANCE"].unitPriceCents, unit: "dose" },
  "CARE-COMPOST-TEA": { name: "Thé de compost", kind: "consumable", priceCents: retailSupplies["CARE-COMPOST-TEA"].unitPriceCents, unit: "dose" },
  "CARE-VERMICOMPOST": { name: "Lombricompost", kind: "consumable", priceCents: retailSupplies["CARE-VERMICOMPOST"].unitPriceCents, unit: "dose" },
  "CARE-ORGANIC-FEED": { name: "Engrais organique", kind: "consumable", priceCents: retailSupplies["CARE-ORGANIC-FEED"].unitPriceCents, unit: "dose" },
  "CARE-SEAWEED": { name: "Extrait d’algues", kind: "consumable", priceCents: retailSupplies["CARE-SEAWEED"].unitPriceCents, unit: "dose" },
  "CARE-APHIDIUS": { name: "Aphidius colemani", kind: "consumable", priceCents: retailSupplies["CARE-APHIDIUS"].unitPriceCents, unit: "dose" },
  "CARE-PHYTOSEIULUS": { name: "Phytoseiulus persimilis", kind: "consumable", priceCents: retailSupplies["CARE-PHYTOSEIULUS"].unitPriceCents, unit: "dose" },
  "CARE-SWIRSKII": { name: "Amblyseius swirskii", kind: "consumable", priceCents: retailSupplies["CARE-SWIRSKII"].unitPriceCents, unit: "dose" },
  "CARE-ORIUS": { name: "Orius laevigatus", kind: "consumable", priceCents: retailSupplies["CARE-ORIUS"].unitPriceCents, unit: "dose" },
  "CARE-CHRYSOPERLA": { name: "Chrysoperla carnea", kind: "consumable", priceCents: retailSupplies["CARE-CHRYSOPERLA"].unitPriceCents, unit: "dose" },
  "CARE-COCCINELLA": { name: "Coccinelle à sept points", kind: "consumable", priceCents: retailSupplies["CARE-COCCINELLA"].unitPriceCents, unit: "dose" },
  "CARE-IRON": { name: "Fer chélaté", kind: "consumable", priceCents: retailSupplies["CARE-IRON"].unitPriceCents, unit: "dose" },
  "CARE-PERLITE": { name: "Perlite horticole", kind: "consumable", priceCents: retailSupplies["CARE-PERLITE"].unitPriceCents, unit: "dose" },
  "CARE-SHADE": { name: "Filet d’ombrage", kind: "consumable", priceCents: retailSupplies["CARE-SHADE"].unitPriceCents, unit: "dose" },
  "CARE-BLUE-TRAPS": { name: "Plaques bleues engluées", kind: "consumable", priceCents: retailSupplies["CARE-BLUE-TRAPS"].unitPriceCents, unit: "dose" },
} as const;

type Catalog = typeof KQ_WAREHOUSE_PREPARATION_CATALOG;
export type KqWarehousePreparationCode = keyof Catalog;
export type KqWarehouseInputCode = { [Code in KqWarehousePreparationCode]: Catalog[Code]["kind"] extends "consumable" ? Code : never }[KqWarehousePreparationCode];
export type KqWarehouseInputFamily = "nutrition" | "amendment" | "pbi" | "prevention";
export type KqWarehouseInputPack = {
  name: string;
  format: string;
  family: KqWarehouseInputFamily;
  usage: string;
  chargesPerPack: number;
  packPriceCents: number;
  priceNote?: string;
  seller: string;
  url: string;
};

/** Retail pack and game stock are different units. Server quotes govern the transaction. */
export function getKqWarehouseInputPack(code: string): KqWarehouseInputPack | undefined {
  if (!Object.hasOwn(retailSupplies, code)) return undefined;
  const retail = retailSupplies[code as keyof typeof retailSupplies];
  if (!("chargesPerPack" in retail)) return undefined;
  const { family } = retail;
  if (family !== "nutrition" && family !== "amendment" && family !== "pbi" && family !== "prevention") return undefined;
  return { ...retail, family };
}

export type KqWarehouseCleaningStep = "vacuum" | "mop";
export type KqWarehouseInputQuantities = Partial<Record<KqWarehouseInputCode, number>>;
export type KqWarehouseCampaignInputs = Record<string, KqWarehouseInputQuantities>;
export type KqWarehousePreparationItem = { [Code in KqWarehousePreparationCode]: Catalog[Code] & {
  code: Code;
  availableQuantity: number;
  reservedQuantity: number;
} & (Catalog[Code]["kind"] extends "consumable" ? { packPriceCents?: number; chargesPerPack?: number; legacyPassQuantity?: number } : unknown) }[KqWarehousePreparationCode];

export type KqWarehousePreparationCoverage = {
  zoneId: string;
  areaM2: number;
  stations: { stationId: string; kind: "irrigation" | "hygiene"; servedM2: number }[];
};

export type KqWarehousePreparationProgram = {
  stationId: string;
  zoneId: string;
  quantities: KqWarehouseInputQuantities;
  startsAt: string;
  expiresAt: string;
};

export type KqWarehousePreparationWorkChoice = "player" | "auto" | `employee:${string}`;
export type KqWarehouseCleaningRecord = {
  completedAt: string | null;
  expiresAt: string | null;
  pending: { startsAt: string; endsAt: string; workChoice: KqWarehousePreparationWorkChoice } | null;
};

export type KqWarehouseRunInputs = {
  runId: string;
  zoneId: string;
  reserved: KqWarehouseInputQuantities;
  consumed: KqWarehouseInputQuantities;
  available?: KqWarehouseInputQuantities;
};

export type KqWarehousePreparations = {
  entranceAirlock?: boolean;
  injectorPriceCents?: number;
  injectors?: { id: string; stationId: string | null }[];
  items: KqWarehousePreparationItem[];
  programs: KqWarehousePreparationProgram[];
  coverage: KqWarehousePreparationCoverage[];
  cleaning: Record<KqWarehouseCleaningStep, KqWarehouseCleaningRecord>;
  runs: KqWarehouseRunInputs[];
  cashCents: number;
  serverNow?: string;
  quoteKey?: string;
  calendarOrigin?: string | null;
};

export type KqWarehouseRunPreparation = {
  used: KqWarehouseInputQuantities;
  vacuum: boolean;
  mop: boolean;
  /** Frozen for the entire warehouse at sowing. Older runs used local hygiene coverage. */
  entranceAirlock?: boolean;
  hygieneM2: number;
  irrigatedM2: number;
};

export type KqWarehouseRunPreparations = Record<string, KqWarehouseRunPreparation>;

export type KqWarehousePreparationCommand = (
  | { action: "injector"; stationId: string; expectedCents: number }
  | { action: "purchase"; code: KqWarehousePreparationCode; quantity: number; expectedCents?: number }
  | { action: "purchasePack"; code: KqWarehouseInputCode; quantity: number; expectedCents: number }
  | { action: "clean"; step: KqWarehouseCleaningStep; workChoice: KqWarehousePreparationWorkChoice }
  | { action: "program"; stationId: string; zoneId: string; quantities: KqWarehouseInputQuantities }
  | { action: "use"; runId: string; quantities: KqWarehouseInputQuantities }
) & { requestKey: string };

export const isKqWarehousePreparationCode = (value: string): value is KqWarehousePreparationCode => Object.hasOwn(KQ_WAREHOUSE_PREPARATION_CATALOG, value);
export const isKqWarehouseInputCode = (value: string): value is KqWarehouseInputCode =>
  isKqWarehousePreparationCode(value) && KQ_WAREHOUSE_PREPARATION_CATALOG[value].kind === "consumable";

export function isKqWarehouseInputQuantities(value: unknown): value is KqWarehouseInputQuantities {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(([code, quantity]) =>
    isKqWarehouseInputCode(code)
    && typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 0 && quantity <= 1000);
}

export function isKqWarehouseCampaignInputs(value: unknown): value is KqWarehouseCampaignInputs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 52 && entries.every(([zone, quantities]) => zone.trim().length > 0 && zone.length <= 80
    && isKqWarehouseInputQuantities(quantities));
}

export const KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT = 75;

export function getKqWarehousePreparationEffects(areaM2: number, preparation?: KqWarehouseRunPreparation, pest = true) {
  if (!preparation || areaM2 <= 0) return { yieldBonusPercent: 0, preventionPercent: 0 };
  const { used, vacuum, mop, irrigatedM2, hygieneM2, entranceAirlock } = preparation;
  const base = used["WAREHOUSE-NUTRITION-BASE"] ?? 0;
  const supplement = Math.min(base, used["WAREHOUSE-NUTRITION-SUPPLEMENT"] ?? 0);
  const protection = pest ? used["WAREHOUSE-PBI"] ?? 0 : 0;
  const maintenance = used["WAREHOUSE-MAINTENANCE"] ?? 0;
  const legacyHygiene = entranceAirlock === undefined && vacuum && mop ? 10 * hygieneM2 : 0;
  const basePrevention = Math.min(50, (vacuum ? 5 : 0) + (mop ? 10 : 0)
    + (legacyHygiene + 15 * protection + 10 * maintenance) / areaM2);
  return {
    yieldBonusPercent: (4 * base + 3 * supplement + 3 * irrigatedM2) / areaM2,
    preventionPercent: entranceAirlock
      ? basePrevention + (100 - basePrevention) * KQ_ENTRANCE_AIRLOCK_PREVENTION_PERCENT / 100
      : basePrevention,
  };
}
