import { KQ_WAREHOUSE_CATALOG, getKqWarehouseDeviceQualityBonus, type KqWarehouseDevice } from "./kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_HANDLING_CART, KQ_WAREHOUSE_OPTION_CODE_COUNT, KQ_WAREHOUSE_OPTION_LIMITS, KQ_WAREHOUSE_LEGACY_OPTION_LIMITS,
  getKqWarehouseOption, getKqWarehouseOptionLine, getKqWarehouseZoneModuleEffect, getKqWarehouseZoneOptionQuantity,
  isKqWarehouseLegacyZoneOption, validateKqWarehouseOptionCodes, type KqWarehouseOptionLine } from "./kanab-quest-warehouse-options";
import { hasKqWarehouseHandling, isKqWarehouseHandlingCode, validateKqWarehouseHandlingPlacements, type KqWarehouseHandlingPlacement } from "./kanab-quest-warehouse-handling";
import { assertKqWarehouseCondition, getKqWarehouseZoneCondition, isKqWarehouseCondition, type KqWarehouseCondition } from "./kanab-quest-warehouse-condition";
import { getKqWarehouseAirCoverage, getKqWarehouseAirPlacements, validateKqWarehouseAirPlacements, withKqWarehouseAirService, type KqWarehouseAirPlacement, type KqWarehouseAirService, type KqWarehouseAirZoneCoverage } from "./kanab-quest-warehouse-air";
import { getKqWarehouseStationCoverage, isKqWarehouseStationCode, KQ_WAREHOUSE_STATIONS, validateKqWarehouseStationPlacements, withKqWarehouseStationService,
  type KqWarehouseStationPlacement, type KqWarehouseStationService, type KqWarehouseStationZoneCoverage } from "./kanab-quest-warehouse-stations";
import { getKqWarehouseLightingCount } from "./kanab-quest-warehouse-fixtures";

export type { KqWarehouseAirPlacement } from "./kanab-quest-warehouse-air";

/** Historical bounds remain valid for archived plans and immutable run snapshots. */
export const KQ_WAREHOUSE_COLUMNS = 40;
export const KQ_WAREHOUSE_ROWS = 25;
export const KQ_WAREHOUSE_AREA_M2 = KQ_WAREHOUSE_COLUMNS * KQ_WAREHOUSE_ROWS;
export const KQ_WAREHOUSE_UNLIT_CODE = "UNLIT";
export type KqWarehouseDimensions = { columns: number; rows: number };
export type KqWarehouseRotation = 0 | 90 | 180 | 270;
export const KQ_WAREHOUSE_PARTITION_THICKNESS = 0.12;
export type KqWarehousePartition = {
  id: string;
  /** Initial whole floor cell. The segment follows that cell's centre line. */
  x: number;
  y: number;
  axis: "x" | "y";
  length: number;
};

/** Final physical footprint in metres, centred on the existing business floor. */
export function getKqWarehousePartitionBounds(partition: KqWarehousePartition, dimensions: KqWarehouseDimensions) {
  return partition.axis === "x"
    ? { x: partition.x + partition.length / 2 - dimensions.columns / 2, z: partition.y + 0.5 - dimensions.rows / 2, width: partition.length, depth: KQ_WAREHOUSE_PARTITION_THICKNESS }
    : { x: partition.x + 0.5 - dimensions.columns / 2, z: partition.y + partition.length / 2 - dimensions.rows / 2, width: KQ_WAREHOUSE_PARTITION_THICKNESS, depth: partition.length };
}

/** Game assumptions, not manufacturer specifications or a cultivation schedule. */
export const KQ_WAREHOUSE_SIMULATION = {
  equivalentLightingHours: 1_000,
  equivalentAirHours: 1_440,
  unventilatedYieldFactor: 0.75,
  electricityCentsPerKwh: 25,
  consumablesCentsPerM2: 2_200,
  preparationCentsPerM2: 12_000,
  installationPercent: 15,
  estimatedDryGramsPerM2: 250,
  forecastDays: 60,
  dryingDurationDays: 6 / 24,
  processingHoursPerDay: 6,
  processingOutputRatio: 0.15,
} as const;

export type KqWarehouseZone = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Orientation only; width/height always describe the occupied grid footprint. */
  rotation?: KqWarehouseRotation;
  active: boolean;
  lightingCode: string;
  airCode: string;
  /** Optional, fictional profiles: at most one per family. */
  optionCodes?: string[];
  /** One collectible assigned to this zone; ownership is checked by the server. */
  buddieCode?: string;
};

export function isKqWarehouseZoneOperational(zone: KqWarehouseZone): boolean {
  return zone.active && zone.lightingCode !== KQ_WAREHOUSE_UNLIT_CODE;
}

export type KqWarehouseEquipment = { code: string; quantity: number };
export type KqWarehouseServiceZone = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: KqWarehouseRotation;
  kind: "drying" | "storage";
  deviceCode: string;
};
export type KqWarehouseState = {
  version: 1;
  /** Optional spatial adapter version; legacy plans keep their exact layout. */
  spatial?: { version: 1 };
  /** Visual beta partitions. They do not buy equipment, capacity or preparation. */
  partitions?: KqWarehousePartition[];
  /** Absent on historical plans, which still use the ventilation model stored per zone. */
  airPlacements?: KqWarehouseAirPlacement[];
  /** Derived by the server for SQL settlement. It is replaced when quoting an updated plan. */
  airService?: KqWarehouseAirService;
  stationPlacements?: KqWarehouseStationPlacement[];
  handlingPlacements?: KqWarehouseHandlingPlacement[];
  /** Server-derived cache for projection of a selected zone within the complete floor. */
  stationService?: KqWarehouseStationService;
  /** Absence identifies the historical 40 × 25 floor. Only the server can adopt this floor. */
  floor?: { columns: 10; rows: 10 };
  zones: KqWarehouseZone[];
  /** Absent only in historical plans. When present, capacities require a placed zone. */
  serviceZones?: KqWarehouseServiceZone[];
  /** One selected storage climate unit. Other purchased models remain in reserve. */
  storageClimateCode?: string;
  /** All owned devices, including culture equipment kept in reserve. */
  equipment: KqWarehouseEquipment[];
  /** All owned options, in whole devices or square metres according to the product code. */
  optionInventory?: KqWarehouseEquipment[];
  /** Already funded room preparation. Remains available after moving/removing a zone. */
  preparedAreaM2: number;
};

/** An unspecified new plan starts at 100 m²; an actual old plan keeps its original floor. */
export function getKqWarehouseDimensions(state?: Pick<KqWarehouseState, "floor">): KqWarehouseDimensions {
  return !state || state.floor ? { columns: 10, rows: 10 } : { columns: KQ_WAREHOUSE_COLUMNS, rows: KQ_WAREHOUSE_ROWS };
}

export type KqWarehouseDeviceLine = KqWarehouseEquipment & {
  device: KqWarehouseDevice;
  totalCents: number;
  powerWatts: number;
};

export type KqWarehouseZoneQuote = {
  areaM2: number;
  devices: KqWarehouseDeviceLine[];
  options: KqWarehouseOptionLine[];
  optionEquipmentCostCents: number;
  yieldBonusPercent: number;
  qualityBonus: number;
  equipmentQualityBonus: number;
  moduleQualityBonus: number;
  equipmentCostCents: number;
  preparationCostCents: number;
  installationCostCents: number;
  totalCostCents: number;
  costPerM2Cents: number;
  powerWatts: number;
  energyKwh: number;
  energyCostCents: number;
  consumablesCostCents: number;
  operatingCostCents: number;
  estimatedHarvestGrams: number;
  airCoverage?: KqWarehouseAirZoneCoverage;
};

export type KqWarehouseQuote = {
  nextState: KqWarehouseState;
  purchases: KqWarehouseDeviceLine[];
  optionPurchases: KqWarehouseOptionLine[];
  optionEquipmentCostCents: number;
  addedAreaM2: number;
  equipmentCostCents: number;
  preparationCostCents: number;
  installationCostCents: number;
  totalCostCents: number;
  costPerM2Cents: number;
};

export type KqWarehouseServiceZoneQuote = {
  areaM2: number;
  devices: KqWarehouseDeviceLine[];
  equipmentCostCents: number;
  preparationCostCents: number;
  installationCostCents: number;
  totalCostCents: number;
  costPerM2Cents: number;
  capacityGrams: number;
  capacityGramsPerM2: number;
  volumeLitres: number;
  usableSurfaceM2: number;
};

export type KqWarehouseSummary = {
  totalAreaM2: number;
  equippedAreaM2: number;
  cultureAreaM2: number;
  dryingAreaM2: number;
  storageAreaM2: number;
  allocatedAreaM2: number;
  activeAreaM2: number;
  freeAreaM2: number;
  powerWatts: number;
  energyKwh: number;
  energyCostCents: number;
  consumablesCostCents: number;
  operatingCostCents: number;
  estimatedHarvestGrams: number;
  investmentCents: number;
  investmentPerM2Cents: number;
  dryingCapacityGrams: number;
  storageCapacityGrams: number;
  processingCapacityGramsPerHour: number;
  equipment: KqWarehouseDeviceLine[];
  reserve: KqWarehouseEquipment[];
  options: KqWarehouseOptionLine[];
  optionReserve: KqWarehouseEquipment[];
  qualityBonus: number;
};

export type KqWarehouseRunSnapshot = {
  /** Frozen commercial occupancy; never part of the paid sourceState. Absent on historical runs. */
  productionReservedZoneId?: string | null;
  wearVersion?: 1;
  cultureEquipment?: KqWarehouseCondition;
  yieldFactor?: number;
  /** Absent on historical runs, which keep their original yield and quality rules. */
  balanceVersion?: 2;
  /** Version 2 bills storage climate monthly; absent runs retain their cycle charge. */
  climateBillingVersion?: 2;
  /** New crop captures use the stronger drying tiers; historical runs keep theirs. */
  postHarvestBalanceVersion?: 2;
  /** Active preparations replace automatic nutrition and hygiene charges. */
  preparationVersion?: 1;
  revision: number;
  sourceState: KqWarehouseState;
  zones: KqWarehouseZone[];
  activeAreaM2: number;
  estimatedHarvestGrams: number;
  powerWatts: number;
  energyKwh: number;
  energyCostCents: number;
  consumablesCostCents: number;
  operatingCostCents: number;
  dryingCapacityGrams: number;
  storageCapacityGrams: number;
  /** Frozen fictional score bonus, independent from the jury's score out of ten. */
  qualityBonus?: number;
} & ({ version: 1; zoneId?: never } | { version: 2; zoneId: string });

const natural = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const rounded = (value: number) => Math.round(value * 1_000) / 1_000;
const deviceByCode = (code: string) => KQ_WAREHOUSE_CATALOG.find((device) => device.code === code);

function requireDevice(code: string): KqWarehouseDevice {
  const device = deviceByCode(code);
  if (!device) throw new Error("Cet appareil n’appartient pas au catalogue de l’entrepôt.");
  return device;
}

function requireAreaDevice(code: string, kind: "lighting" | "air"): KqWarehouseDevice {
  const device = requireDevice(code);
  if (device.room !== "culture" || device.kind !== kind || device.gameCapacity?.unit !== "m2" || device.gameCapacity.value <= 0) {
    throw new Error("Cet appareil ne peut pas équiper cette zone de culture.");
  }
  return device;
}

type ZoneRectangle = Pick<KqWarehouseZone, "x" | "y" | "width" | "height">;
export function doKqWarehouseZonesOverlap(a: ZoneRectangle, b: ZoneRectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function validateKqWarehouseServiceZones(value: unknown, cultureZones: KqWarehouseZone[] = [], dimensions = getKqWarehouseDimensions({})): string[] {
  if (!Array.isArray(value) || value.length > KQ_WAREHOUSE_AREA_M2) return ["Le plan de séchage et stockage est invalide."];
  const errors: string[] = [];
  const ids = new Set(cultureZones.map(zone => zone.id));
  const occupied: ZoneRectangle[] = [...cultureZones];
  for (const candidate of value) {
    if (!record(candidate) || typeof candidate.id !== "string" || !candidate.id.trim() || candidate.id.length > 80
      || typeof candidate.name !== "string" || !candidate.name.trim() || candidate.name.length > 80
      || !["drying", "storage"].includes(String(candidate.kind)) || typeof candidate.deviceCode !== "string") {
      errors.push("Une zone de séchage ou stockage est incomplète.");
      continue;
    }
    if (ids.has(candidate.id)) errors.push("Chaque zone doit avoir un identifiant unique.");
    ids.add(candidate.id);
    if ("rotation" in candidate && ![0, 90, 180, 270].includes(candidate.rotation as number)) errors.push("L’orientation doit suivre un quart de tour.");
    if (![candidate.x, candidate.y, candidate.width, candidate.height].every(natural) || candidate.width === 0 || candidate.height === 0) {
      errors.push("Les dimensions et positions doivent utiliser des cases entières de 1 m².");
      continue;
    }
    const zone = candidate as KqWarehouseServiceZone;
    if (zone.x + zone.width > dimensions.columns || zone.y + zone.height > dimensions.rows) errors.push(`Une zone dépasse les ${dimensions.columns} × ${dimensions.rows} cases de l’entrepôt.`);
    const device = deviceByCode(zone.deviceCode);
    if (!device?.zoneLayout || device.kind !== zone.kind) errors.push("Le matériel choisi ne correspond pas à cette zone.");
    if (occupied.some(other => doKqWarehouseZonesOverlap(zone, other))) errors.push("Les zones de culture, séchage et stockage ne peuvent pas se superposer.");
    occupied.push(zone);
  }
  return [...new Set(errors)];
}

export function validateKqWarehouseZones(value: unknown, dimensions = getKqWarehouseDimensions({})): string[] {
  if (!Array.isArray(value) || value.length > KQ_WAREHOUSE_AREA_M2) return ["Le plan de culture est invalide."];
  const errors: string[] = [];
  const ids = new Set<string>();
  const valid: KqWarehouseZone[] = [];
  for (const candidate of value) {
    if (!record(candidate) || typeof candidate.id !== "string" || !candidate.id.trim() || candidate.id.length > 80
      || typeof candidate.name !== "string" || !candidate.name.trim() || candidate.name.length > 80
      || typeof candidate.active !== "boolean" || typeof candidate.lightingCode !== "string" || typeof candidate.airCode !== "string") {
      errors.push("Une zone est incomplète.");
      continue;
    }
    if (ids.has(candidate.id)) errors.push("Chaque zone doit avoir un identifiant unique.");
    ids.add(candidate.id);
    if ("rotation" in candidate && ![0, 90, 180, 270].includes(candidate.rotation as number)) errors.push("L’orientation doit suivre un quart de tour.");
    if (![candidate.x, candidate.y, candidate.width, candidate.height].every(natural) || candidate.width === 0 || candidate.height === 0) {
      errors.push("Les dimensions et positions doivent utiliser des cases entières de 1 m².");
      continue;
    }
    const zone = candidate as KqWarehouseZone;
    if ("buddieCode" in candidate && (typeof candidate.buddieCode !== "string" || !/^HH2026-\d{3}$/.test(candidate.buddieCode)
      || Number(candidate.buddieCode.slice(-3)) < 1 || Number(candidate.buddieCode.slice(-3)) > 52)) errors.push("Le Buddie de cette zone est invalide.");
    if ("optionCodes" in candidate && !validateKqWarehouseOptionCodes(candidate.optionCodes)) errors.push("Choisis au plus un module de simulation par famille.");
    if (zone.x + zone.width > dimensions.columns || zone.y + zone.height > dimensions.rows) errors.push(`Une zone dépasse les ${dimensions.columns} × ${dimensions.rows} cases de la chambre.`);
    try {
      if (zone.lightingCode !== KQ_WAREHOUSE_UNLIT_CODE) requireAreaDevice(zone.lightingCode, "lighting");
      requireAreaDevice(zone.airCode, "air");
    } catch {
      errors.push("Une zone contient un éclairage ou un extracteur incompatible.");
    }
    if (valid.some((existing) => doKqWarehouseZonesOverlap(zone, existing))) errors.push("Les zones de culture ne peuvent pas se superposer.");
    valid.push(zone);
  }
  return [...new Set(errors)];
}

/** Centred segments join end-to-end; perpendicular intersections merge as junctions. */
export function validateKqWarehousePartitions(value: unknown, zones: ZoneRectangle[] = [], dimensions = getKqWarehouseDimensions({})): string[] {
  if (!Array.isArray(value) || value.length > dimensions.columns * dimensions.rows * 2) return ["Le plan des parois est invalide."];
  const errors: string[] = [];
  const ids = new Set<string>();
  const valid: KqWarehousePartition[] = [];
  for (const candidate of value) {
    if (!record(candidate) || typeof candidate.id !== "string" || !candidate.id.trim() || candidate.id.length > 80
      || !["x", "y"].includes(String(candidate.axis)) || ![candidate.x, candidate.y, candidate.length].every(natural) || candidate.length === 0) {
      errors.push("Chaque paroi doit avoir un identifiant, un axe et une longueur entière d’au moins 1 m."); continue;
    }
    const partition = candidate as KqWarehousePartition;
    if (ids.has(partition.id)) errors.push("Chaque paroi doit avoir un identifiant unique.");
    ids.add(partition.id);
    if (partition.x >= dimensions.columns || partition.y >= dimensions.rows
      || partition.x + (partition.axis === "x" ? partition.length : 1) > dimensions.columns
      || partition.y + (partition.axis === "y" ? partition.length : 1) > dimensions.rows) {
      errors.push("Les parois doivent rester dans les limites de l’entrepôt."); continue;
    }
    const half = KQ_WAREHOUSE_PARTITION_THICKNESS / 2;
    const rectangle = partition.axis === "x"
      ? { x: partition.x, y: partition.y + 0.5 - half, width: partition.length, height: KQ_WAREHOUSE_PARTITION_THICKNESS }
      : { x: partition.x + 0.5 - half, y: partition.y, width: KQ_WAREHOUSE_PARTITION_THICKNESS, height: partition.length };
    if (zones.some(zone => doKqWarehouseZonesOverlap(rectangle, zone))) errors.push("Une paroi ne peut pas traverser une zone de culture, de séchage ou de stockage.");
    for (const other of valid) {
      if (partition.axis === other.axis) {
        const sameLine = partition.axis === "x" ? partition.y === other.y : partition.x === other.x;
        const start = partition.axis === "x" ? partition.x : partition.y, otherStart = other.axis === "x" ? other.x : other.y;
        if (sameLine && start < otherStart + other.length && otherStart < start + partition.length) errors.push("Deux parois sur le même axe ne peuvent pas se superposer.");
      }
    }
    valid.push(partition);
  }
  return [...new Set(errors)];
}

/** Validates drafts as well as persisted plans; a quote purchases missing devices. */
export function validateKqWarehouseState(value: unknown): string[] {
  if (!record(value) || value.version !== 1) return ["Version du plan d’entrepôt inconnue."];
  if ("spatial" in value && (!record(value.spatial) || value.spatial.version !== 1 || Object.keys(value.spatial).length !== 1)) return ["Version de l’aménagement 3D inconnue."];
  if ("floor" in value && (!record(value.floor) || value.floor.columns !== 10 || value.floor.rows !== 10
    || Object.keys(value.floor).length !== 2)) return ["Dimensions de l’entrepôt invalides."];
  const dimensions = getKqWarehouseDimensions(value as KqWarehouseState);
  const errors = validateKqWarehouseZones(value.zones, dimensions);
  if (!errors.length && (value.zones as KqWarehouseZone[]).some(zone => zone.lightingCode === KQ_WAREHOUSE_UNLIT_CODE
    && (zone.active || !Array.isArray(value.airPlacements)))) errors.push("Une zone sans éclairage doit rester en pause sur un plan à ventilation placée.");
  if ("serviceZones" in value) errors.push(...validateKqWarehouseServiceZones(value.serviceZones, errors.length ? [] : value.zones as KqWarehouseZone[], dimensions));
  if ("partitions" in value) {
    const zones = errors.length ? [] : [...value.zones as KqWarehouseZone[], ...((value.serviceZones as KqWarehouseServiceZone[] | undefined) ?? [])];
    errors.push(...validateKqWarehousePartitions(value.partitions, zones, dimensions));
    const zoneIds = new Set(zones.map(zone => zone.id));
    if (Array.isArray(value.partitions) && value.partitions.some(partition => record(partition) && zoneIds.has(String(partition.id)))) errors.push("Une paroi et une zone doivent avoir des identifiants distincts.");
  }
  if ("storageClimateCode" in value) {
    const climate = typeof value.storageClimateCode === "string" ? deviceByCode(value.storageClimateCode) : undefined;
    if (climate?.kind !== "climate" || climate.room !== "storage") errors.push("Le climatiseur de stockage est invalide.");
    if (!Array.isArray(value.serviceZones) || !value.serviceZones.some(zone => record(zone) && zone.kind === "storage")) errors.push("Aménage une zone de stockage avant d’installer son climatiseur.");
  }
  if ("airPlacements" in value) {
    errors.push(...validateKqWarehouseAirPlacements(value.airPlacements, dimensions,
      errors.length ? [] : value.partitions as KqWarehousePartition[] | undefined));
  }
  if ("stationPlacements" in value && !errors.length) {
    errors.push(...validateKqWarehouseStationPlacements(value.stationPlacements, dimensions, value as unknown as KqWarehouseState));
  }
  if (!natural(value.preparedAreaM2) || value.preparedAreaM2 > dimensions.columns * dimensions.rows) errors.push("Surface aménagée invalide.");
  if ("optionInventory" in value) {
    if (!Array.isArray(value.optionInventory) || value.optionInventory.length > KQ_WAREHOUSE_OPTION_CODE_COUNT) errors.push("Réserve de modules invalide.");
    else {
      const seen = new Set<string>();
      for (const item of value.optionInventory) {
        if (!record(item) || typeof item.code !== "string" || !getKqWarehouseOption(item.code) || !natural(item.quantity) || item.quantity > 100_000 || seen.has(item.code)) errors.push("Réserve de modules invalide.");
        else seen.add(item.code);
      }
    }
  }
  if (!Array.isArray(value.equipment) || value.equipment.length > KQ_WAREHOUSE_CATALOG.length) return [...errors, "Inventaire d’appareils invalide."];
  if (!errors.length) errors.push(...validateKqWarehouseHandlingPlacements(value as unknown as KqWarehouseState, dimensions));
  const codes = new Set<string>();
  for (const item of value.equipment) {
    if (!record(item) || typeof item.code !== "string" || !deviceByCode(item.code) || !natural(item.quantity) || item.quantity > 100_000 || codes.has(item.code)) {
      errors.push("Les appareils doivent avoir une référence unique et une quantité entière valide.");
      continue;
    }
    codes.add(item.code);
  }
  return [...new Set(errors)];
}

export function isKqWarehouseState(value: unknown): value is KqWarehouseState {
  return validateKqWarehouseState(value).length === 0;
}

function assertState(state: KqWarehouseState) {
  const errors = validateKqWarehouseState(state);
  if (errors.length) throw new Error(errors.join(" "));
}

function matchesAirService(value: unknown, expected: KqWarehouseAirService | undefined) {
  if (expected === undefined) return value === undefined;
  if (!record(value) || Object.keys(value).length !== Object.keys(expected).length) return false;
  return Object.entries(expected).every(([id, entry]) => {
    const actual = value[id];
    return Object.hasOwn(value, id) && record(actual) && actual.coveredAreaM2 === entry.coveredAreaM2
      && actual.qualityPoints === entry.qualityPoints && actual.powerMilliWatts === entry.powerMilliWatts;
  });
}

function matchesStationService(value: unknown, expected: KqWarehouseStationService | undefined) {
  if (expected === undefined) return value === undefined;
  if (!record(value) || Object.keys(value).length !== Object.keys(expected).length) return false;
  return Object.entries(expected).every(([id, entry]) => {
    const actual = value[id];
    return Object.hasOwn(value, id) && record(actual)
      && actual.waterAreaM2 === entry.waterAreaM2 && actual.hygieneAreaM2 === entry.hygieneAreaM2;
  });
}

function deviceLine(code: string, quantity: number): KqWarehouseDeviceLine {
  const device = requireDevice(code);
  return { code, quantity, device, totalCents: device.priceCents * quantity, powerWatts: device.watts * quantity };
}

export function getKqWarehouseZoneQuote(zone: KqWarehouseZone, balanceVersion: 1 | 2 = 2, condition?: KqWarehouseCondition, airCoverage?: KqWarehouseAirZoneCoverage, stationCoverage?: KqWarehouseStationZoneCoverage, preparationVersion?: 1): KqWarehouseZoneQuote {
  const errors = validateKqWarehouseZones([zone]);
  if (errors.length) throw new Error(errors.join(" "));
  const areaM2 = zone.width * zone.height;
  const lit = zone.lightingCode !== KQ_WAREHOUSE_UNLIT_CODE;
  const operational = isKqWarehouseZoneOperational(zone);
  const devices = !lit ? [] : (airCoverage ? [requireAreaDevice(zone.lightingCode, "lighting")]
    : [requireAreaDevice(zone.lightingCode, "lighting"), requireAreaDevice(zone.airCode, "air")])
    .map(device => deviceLine(device.code, device.kind === "lighting" ? getKqWarehouseLightingCount(zone.width, zone.height, device.code)
      : Math.ceil(areaM2 / device.gameCapacity.value)));
  const options = (zone.optionCodes ?? []).map(code => getKqWarehouseOptionLine(code, getKqWarehouseZoneOptionQuantity(code, areaM2),
    code === KQ_WAREHOUSE_HANDLING_CART ? 1 : balanceVersion, areaM2));
  const runningOptions = preparationVersion ? options.filter(({ option }) => !["nutrition", "hygiene"].includes(option.family)
    && option.code !== "SIM-WATER-03") : options;
  const moduleEffects = runningOptions.map(line => getKqWarehouseZoneModuleEffect(line.option, airCoverage !== undefined));
  const optionEquipmentCostCents = options.reduce((sum, line) => sum + line.totalCents, 0);
  const limits = balanceVersion === 1 ? KQ_WAREHOUSE_LEGACY_OPTION_LIMITS : KQ_WAREHOUSE_OPTION_LIMITS;
  const waterArea = balanceVersion === 2 && !preparationVersion ? stationCoverage?.waterAreaM2 ?? 0 : 0;
  const hygieneArea = balanceVersion === 2 && !preparationVersion ? stationCoverage?.hygieneAreaM2 ?? 0 : 0;
  const water = KQ_WAREHOUSE_STATIONS["SIM-WATER-03"], hygiene = KQ_WAREHOUSE_STATIONS["SIM-HYGIENE-03"];
  const yieldBonusPercent = Math.min(limits.yieldBonusPercent, moduleEffects.reduce((sum, effect) => sum + effect.yieldBonusPercent, water.yieldBonusPercent * waterArea / areaM2));
  const moduleQualityBonus = Math.min(limits.qualityBonus, moduleEffects.reduce((sum, effect) => sum + effect.qualityBonus, hygiene.qualityBonus * hygieneArea / areaM2));
  // A better device benefits the zone once, regardless of how many units it needs.
  const equipmentQualityBonus = lit ? getKqWarehouseDeviceQualityBonus(zone.lightingCode, balanceVersion)
    + (airCoverage && balanceVersion === 2 ? airCoverage.qualityBonus : getKqWarehouseDeviceQualityBonus(zone.airCode, balanceVersion)) : 0;
  const qualityBonus = Math.floor(moduleQualityBonus + equipmentQualityBonus);
  const equipmentCostCents = devices.reduce((sum, line) => sum + line.totalCents, 0) + optionEquipmentCostCents;
  const preparationCostCents = areaM2 * KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2;
  const installationCostCents = getWarehouseInstallationCost(equipmentCostCents, options);
  const totalCostCents = equipmentCostCents + preparationCostCents + installationCostCents;
  const airWatts = airCoverage?.powerWatts ?? 0;
  const energyKwh = operational ? rounded(devices.reduce((sum, line) => sum + line.powerWatts * (line.device.kind === "lighting"
    ? KQ_WAREHOUSE_SIMULATION.equivalentLightingHours : KQ_WAREHOUSE_SIMULATION.equivalentAirHours) / 1_000,
    airWatts * KQ_WAREHOUSE_SIMULATION.equivalentAirHours / 1_000)) : 0;
  const energyCostCents = Math.round(energyKwh * KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh);
  const supplySavingCentsPerM2 = moduleEffects.reduce((sum, effect) => sum + effect.supplySavingCentsPerM2, 0);
  const baseSuppliesCentsPerM2 = Math.max(0, KQ_WAREHOUSE_SIMULATION.consumablesCentsPerM2 - supplySavingCentsPerM2);
  const consumablesCostCents = operational ? areaM2 * baseSuppliesCentsPerM2 + runningOptions.reduce((sum, line) => sum + line.consumablesCostCents, 0)
    + waterArea * water.consumablesCentsPerM2 + hygieneArea * hygiene.consumablesCentsPerM2 : 0;
  const uncoveredYield = KQ_WAREHOUSE_SIMULATION.unventilatedYieldFactor;
  const ventilationYield = airCoverage ? uncoveredYield + (1 - uncoveredYield) * airCoverage.coverageRatio : 1;
  return {
    areaM2, devices, options, optionEquipmentCostCents, yieldBonusPercent, qualityBonus, equipmentQualityBonus, moduleQualityBonus,
    equipmentCostCents, preparationCostCents, installationCostCents, totalCostCents,
    costPerM2Cents: Math.round(totalCostCents / areaM2),
    powerWatts: operational ? devices.reduce((sum, line) => sum + line.powerWatts, airWatts) : 0,
    energyKwh, energyCostCents, consumablesCostCents,
    operatingCostCents: energyCostCents + consumablesCostCents,
    estimatedHarvestGrams: operational ? rounded(areaM2 * KQ_WAREHOUSE_SIMULATION.estimatedDryGramsPerM2 * (100 + yieldBonusPercent) / 100
      * ventilationYield * (condition ? (getKqWarehouseZoneCondition(zone.id, condition.assets).yieldPercent ?? 100) / 100 : 1)) : 0,
    ...(airCoverage ? { airCoverage } : {}),
  };
}

export function getKqWarehouseServiceZoneQuote(zone: KqWarehouseServiceZone): KqWarehouseServiceZoneQuote {
  const errors = validateKqWarehouseServiceZones([zone]);
  if (errors.length) throw new Error(errors.join(" "));
  const device = requireDevice(zone.deviceCode);
  const layout = device.zoneLayout!;
  const areaM2 = zone.width * zone.height;
  const quantity = areaM2 * layout.unitsPerM2;
  const devices = [deviceLine(device.code, quantity)];
  const equipmentCostCents = devices[0].totalCents;
  const preparationCostCents = areaM2 * KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2;
  const installationCostCents = Math.round(equipmentCostCents * KQ_WAREHOUSE_SIMULATION.installationPercent / 100);
  const totalCostCents = equipmentCostCents + preparationCostCents + installationCostCents;
  return {
    areaM2, devices, equipmentCostCents, preparationCostCents, installationCostCents, totalCostCents,
    costPerM2Cents: Math.round(totalCostCents / areaM2),
    capacityGrams: quantity * layout.capacityGramsPerUnit,
    capacityGramsPerM2: layout.unitsPerM2 * layout.capacityGramsPerUnit,
    volumeLitres: quantity * (layout.volumeLitresPerUnit ?? 0),
    usableSurfaceM2: rounded(quantity * (layout.usableSurfaceM2PerUnit ?? 0)),
  };
}

export function getKqWarehouseEquipmentDemand(zones: KqWarehouseZone[], serviceZones: KqWarehouseServiceZone[] = [], storageClimateCode?: string, airPlacements?: KqWarehouseAirPlacement[]): KqWarehouseEquipment[] {
  const errors = validateKqWarehouseZones(zones);
  errors.push(...validateKqWarehouseServiceZones(serviceZones, zones));
  if (errors.length) throw new Error(errors.join(" "));
  const quantities = new Map<string, number>();
  for (const zone of zones) {
    if (zone.lightingCode === KQ_WAREHOUSE_UNLIT_CODE) continue;
    for (const code of airPlacements === undefined ? [zone.lightingCode, zone.airCode] : [zone.lightingCode]) {
      const quantity = code === zone.lightingCode ? getKqWarehouseLightingCount(zone.width, zone.height, code)
        : Math.ceil(zone.width * zone.height / requireDevice(code).gameCapacity.value);
      quantities.set(code, (quantities.get(code) ?? 0) + quantity);
    }
  }
  for (const { code } of airPlacements ?? []) {
    quantities.set(code, (quantities.get(code) ?? 0) + 1);
  }
  for (const zone of serviceZones) {
    for (const line of getKqWarehouseServiceZoneQuote(zone).devices) quantities.set(line.code, (quantities.get(line.code) ?? 0) + line.quantity);
  }
  if (storageClimateCode) {
    const climate = requireDevice(storageClimateCode);
    if (climate.kind !== "climate" || climate.room !== "storage" || !serviceZones.some(zone => zone.kind === "storage")) throw new Error("Le climatiseur requiert une zone de stockage.");
    quantities.set(storageClimateCode, 1);
  }
  return [...quantities].map(([code, quantity]) => ({ code, quantity })).sort((a, b) => a.code.localeCompare(b.code));
}

export function getKqWarehouseOptionDemand(zones: KqWarehouseZone[], stations?: KqWarehouseStationPlacement[]): KqWarehouseEquipment[] {
  const quantities = new Map<string, number>();
  for (const zone of zones) {
    const areaM2 = zone.width * zone.height;
    for (const code of zone.optionCodes ?? []) quantities.set(code, (quantities.get(code) ?? 0) + getKqWarehouseZoneOptionQuantity(code, areaM2));
  }
  for (const { code } of stations ?? []) quantities.set(code, (quantities.get(code) ?? 0) + 1);
  return [...quantities].map(([code, quantity]) => ({ code, quantity })).sort((a, b) => a.code.localeCompare(b.code));
}

const copyZone = (zone: KqWarehouseZone): KqWarehouseZone => ({ ...zone, ...(zone.optionCodes === undefined ? {} : { optionCodes: [...zone.optionCodes] }) });

function getWarehouseInstallationCost(equipmentCents: number, options: KqWarehouseOptionLine[]) {
  const included = options.reduce((sum, line) => sum + (line.option.installationIncluded || line.unit === "handling"
    || line.unit === "station" && line.code === "SIM-HYGIENE-03" ? line.totalCents : 0), 0);
  return Math.round((equipmentCents - included) * KQ_WAREHOUSE_SIMULATION.installationPercent / 100);
}

// The airlock is fitted to the existing entrance. Only irrigation stations need new flooring.
function getWarehouseFloorPreparationArea(state: KqWarehouseState) {
  return [...state.zones, ...(state.serviceZones ?? [])].reduce((sum, zone) => sum + zone.width * zone.height, 0)
    + (state.stationPlacements ?? []).filter(station => station.code !== "SIM-HYGIENE-03").length;
}

/** No implicit sale: removing a zone or replacing a device keeps existing assets in reserve. */
export function getKqWarehouseQuote(candidate: KqWarehouseState, previous?: KqWarehouseState): KqWarehouseQuote {
  // Older 2D clients omit this optional field. Only an explicit array replaces it.
  if (candidate.partitions === undefined && previous?.partitions !== undefined) candidate = { ...candidate, partitions: previous.partitions };
  if (candidate.airPlacements === undefined && previous?.airPlacements !== undefined) candidate = { ...candidate, airPlacements: previous.airPlacements };
  if (candidate.stationPlacements === undefined && previous?.stationPlacements !== undefined) candidate = { ...candidate, stationPlacements: previous.stationPlacements };
  if (candidate.handlingPlacements === undefined && previous?.handlingPlacements !== undefined) candidate = { ...candidate, handlingPlacements: previous.handlingPlacements };
  assertState(candidate);
  if (previous) assertState(previous);
  if (previous && !!previous.floor !== !!candidate.floor) throw new Error("Les dimensions de l’entrepôt ne peuvent pas être modifiées dans un devis.");
  if (previous?.serviceZones !== undefined && candidate.serviceZones === undefined) throw new Error("Les zones de séchage et stockage doivent rester présentes dans le plan.");
  const owned = new Map(previous?.equipment.map((item) => [item.code, item.quantity]) ?? []);
  const target = new Map(owned);
  for (const item of [...candidate.equipment, ...getKqWarehouseEquipmentDemand(candidate.zones, candidate.serviceZones, candidate.storageClimateCode, candidate.airPlacements)]) target.set(item.code, Math.max(target.get(item.code) ?? 0, item.quantity));
  const purchases = [...target].map(([code, quantity]) => deviceLine(code, Math.max(0, quantity - (owned.get(code) ?? 0)))).filter((line) => line.quantity > 0);
  if (purchases.some(line => line.device.purchasable === false)) {
    throw new Error("Cet équipement historique peut être réutilisé depuis la réserve, mais ne peut plus être acheté.");
  }
  const ownedOptions = new Map(previous?.optionInventory?.map(item => [item.code, item.quantity]) ?? []);
  if (candidate.zones.some(zone => zone.optionCodes?.some(code => isKqWarehouseHandlingCode(code)
    && !previous?.zones.find(oldZone => oldZone.id === zone.id)?.optionCodes?.includes(code)))) {
    throw new Error("Le matériel de manutention est commun à tout l’entrepôt.");
  }
  const targetOptions = new Map(ownedOptions);
  const optionDemand = getKqWarehouseOptionDemand(candidate.zones, candidate.stationPlacements);
  for (const item of [...(candidate.optionInventory ?? []), ...optionDemand]) {
    targetOptions.set(item.code, Math.max(targetOptions.get(item.code) ?? 0, item.quantity));
  }
  if ([...targetOptions].some(([code, quantity]) => isKqWarehouseLegacyZoneOption(code) && quantity > (ownedOptions.get(code) ?? 0))) {
    throw new Error("La réserve de cet ancien module ne couvre pas la zone. Choisis un appareil du catalogue ou libère la surface déjà financée.");
  }
  const requiredOptions = new Map(optionDemand.map(item => [item.code, item.quantity]));
  for (const [code, quantity] of targetOptions) {
    if (quantity <= Math.max(ownedOptions.get(code) ?? 0, requiredOptions.get(code) ?? 0)) continue;
    if (getKqWarehouseOption(code)?.unit === "device") throw new Error("Affecte chaque nouvel appareil à une zone de culture avant de confirmer l’achat.");
    if (candidate.stationPlacements !== undefined && isKqWarehouseStationCode(code)) throw new Error("Place les nouveaux postes communs sur le plan avant de les acheter.");
  }
  if ([...targetOptions].some(([code, quantity]) => isKqWarehouseHandlingCode(code)
    && quantity > Math.max(1, ownedOptions.get(code) ?? 0))) {
    throw new Error("Un exemplaire de chaque équipement de manutention peut être acheté pour l’entrepôt.");
  }
  const optionPurchases: KqWarehouseOptionLine[] = [...targetOptions].map(([code, quantity]) => ({
    ...getKqWarehouseOptionLine(code, Math.max(0, quantity - (ownedOptions.get(code) ?? 0))),
    ...(isKqWarehouseHandlingCode(code) ? { unit: "handling" as const, consumablesCostCents: 0 }
      : candidate.stationPlacements !== undefined && isKqWarehouseStationCode(code) ? { unit: "station" as const } : {}),
  })).filter(line => line.quantity > 0);
  const optionEquipmentCostCents = optionPurchases.reduce((sum, line) => sum + line.totalCents, 0);
  if (previous && candidate.serviceZones === undefined && purchases.some(line => line.device.kind === "drying" || line.device.kind === "storage")) {
    throw new Error("Trace une zone de séchage ou stockage avant d’acheter ce matériel.");
  }
  const equippedAreaM2 = candidate.zones.reduce((sum, zone) => sum + zone.width * zone.height, 0);
  const allocatedAreaM2 = equippedAreaM2 + (candidate.serviceZones ?? []).reduce((sum, zone) => sum + zone.width * zone.height, 0)
    + (candidate.stationPlacements?.length ?? 0);
  // Client-provided preparedAreaM2 never waives the cost of new preparation.
  const preparedAreaM2 = Math.max(previous?.preparedAreaM2 ?? 0, getWarehouseFloorPreparationArea(candidate));
  const addedAreaM2 = preparedAreaM2 - (previous?.preparedAreaM2 ?? 0);
  const equipmentCostCents = purchases.reduce((sum, line) => sum + line.totalCents, 0) + optionEquipmentCostCents;
  const preparationCostCents = addedAreaM2 * KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2;
  const installationCostCents = getWarehouseInstallationCost(equipmentCostCents, optionPurchases);
  const totalCostCents = equipmentCostCents + preparationCostCents + installationCostCents;
  return {
    nextState: withKqWarehouseStationService(withKqWarehouseAirService({
      version: 1,
      ...(candidate.spatial || previous?.spatial ? { spatial: { version: 1 } as const } : {}),
      ...(candidate.partitions !== undefined ? { partitions: candidate.partitions.map(partition => ({ ...partition })) } : {}),
      ...(candidate.airPlacements !== undefined ? { airPlacements: getKqWarehouseAirPlacements(candidate) } : {}),
      ...(candidate.stationPlacements !== undefined ? { stationPlacements: candidate.stationPlacements.map(placement => ({ ...placement })) } : {}),
      ...(candidate.handlingPlacements !== undefined ? { handlingPlacements: candidate.handlingPlacements.map(placement => ({ ...placement })) } : {}),
      ...(candidate.floor ? { floor: { ...candidate.floor } } : {}),
      zones: candidate.zones.map(copyZone),
      ...(candidate.serviceZones !== undefined ? { serviceZones: candidate.serviceZones.map(zone => ({ ...zone })) } : {}),
      ...(candidate.storageClimateCode !== undefined ? { storageClimateCode: candidate.storageClimateCode } : {}),
      equipment: [...target].filter(([, quantity]) => quantity > 0).map(([code, quantity]) => ({ code, quantity })).sort((a, b) => a.code.localeCompare(b.code)),
      ...(targetOptions.size || candidate.optionInventory !== undefined || previous?.optionInventory !== undefined ? {
        optionInventory: [...targetOptions].filter(([, quantity]) => quantity > 0).map(([code, quantity]) => ({ code, quantity })).sort((a, b) => a.code.localeCompare(b.code)),
      } : {}),
      preparedAreaM2,
    })),
    purchases, optionPurchases, optionEquipmentCostCents, addedAreaM2, equipmentCostCents, preparationCostCents, installationCostCents, totalCostCents,
    costPerM2Cents: allocatedAreaM2 ? Math.round(totalCostCents / allocatedAreaM2) : 0,
  };
}

export const KQ_STORAGE_CLIMATE_KWH_PER_M2_MONTH: Readonly<Record<string, number>> = {
  "SIM-STORAGE-CLIMATE-01": 6,
  "SIM-STORAGE-CLIMATE-02": 12,
  "SIM-STORAGE-CLIMATE-03": 24,
};

/** A game month costs the same whether cultivation is running or the room is empty. */
export function getKqWarehouseStorageClimateQuote(state: KqWarehouseState) {
  const areaM2 = (state.serviceZones ?? []).reduce((sum, zone) => sum + (zone.kind === "storage" ? zone.width * zone.height : 0), 0);
  const code = areaM2 > 0 && state.storageClimateCode && Object.hasOwn(KQ_STORAGE_CLIMATE_KWH_PER_M2_MONTH, state.storageClimateCode)
    ? state.storageClimateCode : null;
  const kwhPerM2 = code ? KQ_STORAGE_CLIMATE_KWH_PER_M2_MONTH[code] : 0;
  const centsPerM2 = kwhPerM2 * KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh;
  return { code, areaM2, kwhPerM2, monthlyKwh: kwhPerM2 * areaM2, monthlyCents: centsPerM2 * areaM2, centsPerM2 };
}

export function getKqWarehouseSummary(state: KqWarehouseState, balanceVersion: 1 | 2 = 2, climateBillingVersion: 1 | 2 = 2, condition?: KqWarehouseCondition, zoneId?: string, preparationVersion?: 1): KqWarehouseSummary {
  assertState(state);
  const dimensions = getKqWarehouseDimensions(state);
  const totalAreaM2 = dimensions.columns * dimensions.rows;
  const airCoverage = getKqWarehouseAirCoverage(state);
  const stationCoverage = getKqWarehouseStationCoverage(state);
  const zones = zoneId === undefined ? state.zones : state.zones.filter(zone => zone.id === zoneId);
  const quotes = zones.map(zone => getKqWarehouseZoneQuote(zone, balanceVersion, condition, airCoverage?.zones[zone.id], stationCoverage?.zones[zone.id], preparationVersion));
  const equippedAreaM2 = quotes.reduce((sum, quote) => sum + quote.areaM2, 0);
  const serviceZones = state.serviceZones ?? [];
  const dryingAreaM2 = serviceZones.reduce((sum, zone) => sum + (zone.kind === "drying" ? zone.width * zone.height : 0), 0);
  const storageAreaM2 = serviceZones.reduce((sum, zone) => sum + (zone.kind === "storage" ? zone.width * zone.height : 0), 0);
  const allocatedAreaM2 = equippedAreaM2 + dryingAreaM2 + storageAreaM2 + (state.stationPlacements?.length ?? 0) + (state.handlingPlacements?.length ?? 0);
  const activeAreaM2 = zones.reduce((sum, zone) => sum + (zone.active ? zone.width * zone.height : 0), 0);
  const demand = new Map(getKqWarehouseEquipmentDemand(zones, serviceZones, state.storageClimateCode, state.airPlacements).map((item) => [item.code, item.quantity]));
  const equipment = state.equipment.map((item) => deviceLine(item.code, item.quantity));
  const options: KqWarehouseOptionLine[] = (state.optionInventory ?? []).map(item => ({
    ...getKqWarehouseOptionLine(item.code, item.quantity, balanceVersion),
    ...(isKqWarehouseHandlingCode(item.code) && hasKqWarehouseHandling(state, item.code) ? { unit: "handling" as const, consumablesCostCents: 0 }
      : state.stationPlacements !== undefined && isKqWarehouseStationCode(item.code) ? { unit: "station" as const } : {}),
  }));
  const optionDemand = new Map(getKqWarehouseOptionDemand(state.zones, state.stationPlacements).map(item => [item.code, item.quantity]));
  const equipmentCostCents = equipment.reduce((sum, line) => sum + line.totalCents, 0) + options.reduce((sum, line) => sum + line.totalCents, 0);
  const investmentCents = equipmentCostCents + getWarehouseInstallationCost(equipmentCostCents, options)
    + state.preparedAreaM2 * KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2;
  const capacity = (kind: "drying" | "storage") => state.serviceZones !== undefined
    ? serviceZones.reduce((sum, zone) => sum + (zone.kind === kind ? getKqWarehouseServiceZoneQuote(zone).capacityGrams : 0), 0)
    : equipment.reduce((sum, line) => sum + (line.device.kind === kind && line.device.gameCapacity?.unit === "g" ? line.quantity * line.device.gameCapacity.value : 0), 0);
  const storageClimateWatts = climateBillingVersion === 1 && activeAreaM2 > 0 && storageAreaM2 > 0 && state.storageClimateCode ? requireDevice(state.storageClimateCode).watts : 0;
  const energyKwh = rounded(quotes.reduce((sum, quote) => sum + quote.energyKwh, 0) + storageClimateWatts * KQ_WAREHOUSE_SIMULATION.equivalentAirHours / 1000);
  const energyCostCents = Math.round(energyKwh * KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh);
  const consumablesCostCents = quotes.reduce((sum, quote) => sum + quote.consumablesCostCents, 0);
  return {
    totalAreaM2, equippedAreaM2, cultureAreaM2: equippedAreaM2, dryingAreaM2, storageAreaM2, allocatedAreaM2,
    activeAreaM2, freeAreaM2: totalAreaM2 - allocatedAreaM2,
    powerWatts: rounded(quotes.reduce((sum, quote) => sum + quote.powerWatts, 0) + storageClimateWatts),
    energyKwh, energyCostCents, consumablesCostCents, operatingCostCents: energyCostCents + consumablesCostCents,
    estimatedHarvestGrams: quotes.reduce((sum, quote) => sum + quote.estimatedHarvestGrams, 0),
    investmentCents, investmentPerM2Cents: allocatedAreaM2 ? Math.round(investmentCents / allocatedAreaM2) : 0,
    dryingCapacityGrams: capacity("drying"), storageCapacityGrams: capacity("storage"),
    processingCapacityGramsPerHour: rounded(equipment.reduce((sum, line) => sum + (line.device.kind === "processing"
      && line.device.gameCapacity?.unit === "g/batch" && (line.device.gameCapacity.durationHours ?? 0) > 0
      ? line.quantity * line.device.gameCapacity.value / line.device.gameCapacity.durationHours! : 0), 0)),
    equipment,
    options,
    optionReserve: (state.optionInventory ?? []).map(item => ({ code: item.code, quantity: Math.max(0, item.quantity - (optionDemand.get(item.code) ?? 0)) })).filter(item => item.quantity > 0 && !isKqWarehouseHandlingCode(item.code)),
    qualityBonus: activeAreaM2 ? Math.floor(quotes.reduce((sum, quote, index) => sum + (zones[index].active
      ? Math.round((quote.moduleQualityBonus + quote.equipmentQualityBonus) * quote.areaM2) : 0), 0) / activeAreaM2) : 0,
    reserve: state.equipment.filter((item) => requireDevice(item.code).room === "culture" || (state.serviceZones !== undefined && requireDevice(item.code).room === "storage"))
      .map((item) => ({ code: item.code, quantity: Math.max(0, item.quantity - (demand.get(item.code) ?? 0)) })).filter((item) => item.quantity > 0),
  };
}

export function createKqWarehouseStarter(spatialAir = false): KqWarehouseState {
  return getKqWarehouseQuote({
    version: 1, floor: { columns: 10, rows: 10 }, preparedAreaM2: 0, equipment: [],
    zones: [{ id: "starter", name: "Première zone", x: 0, y: 0, width: 1, height: 1, active: true, lightingCode: "MH-TS1000", airCode: "SJ-DF16E350" }],
    ...(spatialAir ? { airPlacements: [{ id: "air-starter", code: "SJ-DF16E350", x: 0, y: 0 }] } : {}),
    serviceZones: [
      { id: "starter-drying", name: "Filets de séchage", x: 0, y: 9, width: 1, height: 1, kind: "drying", deviceCode: "SJ-DRYIT90" },
      { id: "starter-storage", name: "Premiers bocaux", x: 2, y: 9, width: 1, height: 1, kind: "storage", deviceCode: "LP-SUPER-1L" },
    ],
  }).nextState;
}

export function createKqWarehouseEmpty(): KqWarehouseState {
  return { version: 1, floor: { columns: 10, rows: 10 }, zones: [], serviceZones: [],
    airPlacements: [], airService: {}, equipment: [], preparedAreaM2: 0 };
}

/** Free, conservative relocation. Funding, identity, inventory and dimensions of every zone are preserved.
 * A failed packing leaves the whole historical plan untouched. The server separately locks active runs. */
export function compactKqWarehouseToStarterFloor(state: KqWarehouseState): KqWarehouseState | null {
  assertState(state);
  if (state.spatial || state.partitions !== undefined || state.airPlacements !== undefined || state.stationPlacements !== undefined || state.floor || state.preparedAreaM2 > 100) return null;
  const all = [...state.zones, ...(state.serviceZones ?? [])];
  if (all.some(zone => zone.width > 10 || zone.height > 10)
    || all.reduce((area, zone) => area + zone.width * zone.height, 0) > 100) return null;
  const fits = (zone: ZoneRectangle) => zone.x + zone.width <= 10 && zone.y + zone.height <= 10;
  const placed: ZoneRectangle[] = all.filter(fits);
  const moves = new Map<string, { x: number; y: number }>();
  // Preserve array order in the result, but place large displaced rectangles first to avoid needless failure.
  const displaced = all.filter(zone => !fits(zone)).sort((a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id));
  for (const zone of displaced) {
    const preferred = { ...zone, x: Math.min(zone.x, 10 - zone.width), y: Math.min(zone.y, 10 - zone.height) };
    let position: ZoneRectangle | undefined;
    if (!placed.some(other => doKqWarehouseZonesOverlap(preferred, other))) position = preferred;
    else for (let y = 0; y <= 10 - zone.height && !position; y++) for (let x = 0; x <= 10 - zone.width; x++) {
      const candidate = { ...zone, x, y };
      if (!placed.some(other => doKqWarehouseZonesOverlap(candidate, other))) { position = candidate; break; }
    }
    if (!position) return null;
    placed.push(position);
    moves.set(zone.id, { x: position.x, y: position.y });
  }
  const next: KqWarehouseState = { ...state, floor: { columns: 10, rows: 10 },
    zones: state.zones.map(zone => ({ ...copyZone(zone), ...moves.get(zone.id) })),
    ...(state.serviceZones === undefined ? {} : { serviceZones: state.serviceZones.map(zone => ({ ...zone, ...moves.get(zone.id) })) }),
    equipment: state.equipment.map(item => ({ ...item })),
    ...(state.optionInventory === undefined ? {} : { optionInventory: state.optionInventory.map(item => ({ ...item })) }),
  };
  return isKqWarehouseState(next) ? next : null;
}

export function getKqWarehouseRunSnapshot(state: KqWarehouseState, revision = 0, zoneId?: string, balanceVersion: 1 | 2 = 2, climateBillingVersion: 1 | 2 = 2, postHarvestBalanceVersion: 1 | 2 = 2, condition?: KqWarehouseCondition, preparationVersion?: 1): KqWarehouseRunSnapshot {
  if (!natural(revision)) throw new Error("Révision de l’entrepôt invalide.");
  const fullSummary = getKqWarehouseSummary(state, balanceVersion, climateBillingVersion, undefined, undefined, preparationVersion);
  const demand = getKqWarehouseEquipmentDemand(state.zones, state.serviceZones, state.storageClimateCode, state.airPlacements);
  const optionDemand = getKqWarehouseOptionDemand(state.zones, state.stationPlacements);
  const fixedAreaM2 = getWarehouseFloorPreparationArea(state);
  if (fixedAreaM2 > state.preparedAreaM2 || demand.some((required) => required.quantity > (state.equipment.find((item) => item.code === required.code)?.quantity ?? 0))
    || optionDemand.some(required => required.quantity > (state.optionInventory?.find(item => item.code === required.code)?.quantity ?? 0))) {
    throw new Error("L’aménagement doit être financé avant de commencer une culture.");
  }
  const selected = zoneId === undefined ? undefined : state.zones.find(zone => zone.id === zoneId);
  if (selected?.lightingCode === KQ_WAREHOUSE_UNLIT_CODE) throw new Error("Installe un éclairage avant de commencer cette culture.");
  if (zoneId !== undefined && (!selected || !isKqWarehouseZoneOperational(selected))) throw new Error("Choisis une zone de culture active.");
  const zones = selected ? [selected] : state.zones;
  const summary = selected ? getKqWarehouseSummary(state, balanceVersion, climateBillingVersion, undefined, zoneId, preparationVersion) : fullSummary;
  const freshHarvest = summary.estimatedHarvestGrams;
  if (condition) {
    assertKqWarehouseCondition(state, condition);
    const airCoverage = getKqWarehouseAirCoverage(state);
    const stationCoverage = getKqWarehouseStationCoverage(state);
    summary.estimatedHarvestGrams = rounded(zones.filter(zone => zone.active).reduce((sum, zone) => {
      const efficiency = getKqWarehouseZoneCondition(zone.id, condition.assets).yieldPercent;
      if (efficiency === null) throw new Error("L’état du matériel de culture doit être actualisé.");
      return sum + getKqWarehouseZoneQuote(zone, balanceVersion, undefined, airCoverage?.zones[zone.id], stationCoverage?.zones[zone.id], preparationVersion).estimatedHarvestGrams * efficiency / 100;
    }, 0));
  }
  if (!summary.activeAreaM2) throw new Error("Active au moins une zone avant de commencer.");
  // Shared storage climate is charged once across simultaneous zone runs.
  if (climateBillingVersion === 1 && selected && state.storageClimateCode && fullSummary.storageAreaM2 > 0) {
    const watts = requireDevice(state.storageClimateCode).watts;
    const share = summary.activeAreaM2 / fullSummary.activeAreaM2;
    summary.powerWatts = rounded(summary.powerWatts - watts + watts * share);
    summary.energyKwh = rounded(summary.energyKwh - watts * KQ_WAREHOUSE_SIMULATION.equivalentAirHours / 1000 * (1 - share));
    summary.energyCostCents = Math.round(summary.energyKwh * KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh);
    summary.operatingCostCents = summary.energyCostCents + summary.consumablesCostCents;
  }
  return {
    ...(condition ? { wearVersion: 1 as const, cultureEquipment: { version: 1 as const, assets: condition.assets.map(asset => ({ ...asset })) }, yieldFactor: freshHarvest ? summary.estimatedHarvestGrams / freshHarvest : 1 } : {}),
    ...(zoneId === undefined ? { version: 1 as const } : { version: 2 as const, zoneId }), revision,
    ...(balanceVersion === 2 ? { balanceVersion: 2 as const } : {}),
    ...(climateBillingVersion === 2 ? { climateBillingVersion: 2 as const } : {}),
    ...(postHarvestBalanceVersion === 2 ? { postHarvestBalanceVersion: 2 as const } : {}),
    ...(preparationVersion ? { preparationVersion } : {}),
    sourceState: withKqWarehouseStationService(withKqWarehouseAirService({ ...state, ...(state.floor ? { floor: { ...state.floor } } : {}), zones: state.zones.map(copyZone), equipment: state.equipment.map((item) => ({ ...item })),
      ...(state.spatial ? { spatial: { ...state.spatial } } : {}),
      ...(state.partitions !== undefined ? { partitions: state.partitions.map(partition => ({ ...partition })) } : {}),
      ...(state.airPlacements !== undefined ? { airPlacements: getKqWarehouseAirPlacements(state) } : {}),
      ...(state.stationPlacements !== undefined ? { stationPlacements: state.stationPlacements.map(placement => ({ ...placement })) } : {}),
      ...(state.handlingPlacements !== undefined ? { handlingPlacements: state.handlingPlacements.map(placement => ({ ...placement })) } : {}),
      ...(state.optionInventory !== undefined ? { optionInventory: state.optionInventory.map(item => ({ ...item })) } : {}),
      ...(state.serviceZones !== undefined ? { serviceZones: state.serviceZones.map(zone => ({ ...zone })) } : {}) })),
    zones: zones.map(copyZone),
    activeAreaM2: summary.activeAreaM2, estimatedHarvestGrams: summary.estimatedHarvestGrams,
    powerWatts: summary.powerWatts, energyKwh: summary.energyKwh, energyCostCents: summary.energyCostCents,
    consumablesCostCents: summary.consumablesCostCents, operatingCostCents: summary.operatingCostCents,
    dryingCapacityGrams: summary.dryingCapacityGrams, storageCapacityGrams: summary.storageCapacityGrams,
    ...(getKqWarehouseOptionDemand(zones).length || summary.qualityBonus > 0 ? { qualityBonus: summary.qualityBonus } : {}),
  };
}

export function isKqWarehouseRunSnapshot(value: unknown): value is KqWarehouseRunSnapshot {
  if (!record(value) || ![1, 2].includes(Number(value.version)) || !natural(value.revision) || !isKqWarehouseState(value.sourceState)) return false;
  if (value.productionReservedZoneId != null && (typeof value.productionReservedZoneId !== "string"
    || !value.sourceState.zones.some(zone => zone.id === value.productionReservedZoneId)
    || value.version === 2 && value.zoneId === value.productionReservedZoneId)) return false;
  if (value.balanceVersion !== undefined && value.balanceVersion !== 2) return false;
  if (value.climateBillingVersion !== undefined && value.climateBillingVersion !== 2) return false;
  if (value.postHarvestBalanceVersion !== undefined && value.postHarvestBalanceVersion !== 2) return false;
  if (value.preparationVersion !== undefined && (value.preparationVersion !== 1 || value.balanceVersion !== 2)) return false;
  if (value.wearVersion !== undefined ? value.wearVersion !== 1 || !isKqWarehouseCondition(value.cultureEquipment) : value.cultureEquipment !== undefined || value.yieldFactor !== undefined) return false;
  if (value.version === 2 ? typeof value.zoneId !== "string" || !value.zoneId : value.version !== 1 || value.zoneId !== undefined) return false;
  try {
    const expected = getKqWarehouseRunSnapshot(value.sourceState, value.revision, value.version === 2 ? value.zoneId as string : undefined,
      value.balanceVersion === 2 ? 2 : 1, value.climateBillingVersion === 2 ? 2 : 1, value.postHarvestBalanceVersion === 2 ? 2 : 1, value.wearVersion === 1 ? value.cultureEquipment as KqWarehouseCondition : undefined, value.preparationVersion === 1 ? 1 : undefined);
    const fields = ["activeAreaM2", "estimatedHarvestGrams", "powerWatts", "energyKwh", "energyCostCents", "consumablesCostCents", "operatingCostCents", "dryingCapacityGrams", "storageCapacityGrams"] as const;
    return matchesAirService(value.sourceState.airService, expected.sourceState.airService)
      && matchesStationService(value.sourceState.stationService, expected.sourceState.stationService)
      && fields.every((field) => value[field] === expected[field]) && value.yieldFactor === expected.yieldFactor
      && value.qualityBonus === expected.qualityBonus && JSON.stringify(value.zones) === JSON.stringify(expected.zones);
  } catch {
    return false;
  }
}

export type KqWarehouseChainInput = {
  /** Harvest and drying capacities are expressed as dry-equivalent grams. */
  harvestGrams: number;
  dryingCapacityGrams: number;
  storageCapacityGrams: number;
  processingCapacityGramsPerHour: number;
  stockFlowerGrams?: number;
  stockProcessedGrams?: number;
  processingRequestedGrams?: number;
  flowerDemandGrams: number;
  processedDemandGrams?: number;
  periodDays?: number;
  dryingDurationDays?: number;
  processingHoursPerDay?: number;
  processingOutputRatio?: number;
};

export type KqWarehouseChainProjection = {
  periodDays: number;
  harvestGrams: number;
  dryingAcceptedGrams: number;
  dryingCompletedGrams: number;
  dryingInProgressGrams: number;
  waitingForDryingGrams: number;
  processingCapacityGrams: number;
  processedInputGrams: number;
  processedOutputGrams: number;
  processingResidueGrams: number;
  soldFlowerGrams: number;
  soldProcessedGrams: number;
  closingFlowerGrams: number;
  closingProcessedGrams: number;
  closingStockGrams: number;
  peakStorageGrams: number;
  storageOverflowGrams: number;
  unmetFlowerDemandGrams: number;
  unmetProcessedDemandGrams: number;
  bottlenecks: ("drying" | "processing" | "storage" | "sales")[];
};

/**
 * Conservative forecast for one simultaneous harvest. Drying is a concurrent
 * capacity, never multiplied by days to pretend several harvests fit at once.
 * Demand covers this whole period, not each day. All residual matter is retained
 * explicitly; over-capacity stocks trigger a warning instead of disappearing.
 */
export function projectKqWarehouseChain(input: KqWarehouseChainInput): KqWarehouseChainProjection {
  const values = {
    ...input,
    harvestGrams: input.harvestGrams,
    dryingCapacityGrams: input.dryingCapacityGrams,
    storageCapacityGrams: input.storageCapacityGrams,
    processingCapacityGramsPerHour: input.processingCapacityGramsPerHour,
    flowerDemandGrams: input.flowerDemandGrams,
    stockFlowerGrams: input.stockFlowerGrams ?? 0,
    stockProcessedGrams: input.stockProcessedGrams ?? 0,
    processingRequestedGrams: input.processingRequestedGrams ?? 0,
    processedDemandGrams: input.processedDemandGrams ?? 0,
    periodDays: input.periodDays ?? KQ_WAREHOUSE_SIMULATION.forecastDays,
    dryingDurationDays: input.dryingDurationDays ?? KQ_WAREHOUSE_SIMULATION.dryingDurationDays,
    processingHoursPerDay: input.processingHoursPerDay ?? KQ_WAREHOUSE_SIMULATION.processingHoursPerDay,
    processingOutputRatio: input.processingOutputRatio ?? KQ_WAREHOUSE_SIMULATION.processingOutputRatio,
  };
  if (Object.values(values).some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e12)
    || values.processingOutputRatio > 1 || values.processingHoursPerDay > 24 || values.periodDays > 3_660) throw new Error("Prévision de production invalide.");
  const dryingAcceptedGrams = Math.min(values.harvestGrams, values.dryingCapacityGrams);
  const dryingCompletedGrams = values.periodDays >= values.dryingDurationDays ? dryingAcceptedGrams : 0;
  const waitingForDryingGrams = values.harvestGrams - dryingAcceptedGrams;
  const availableFlowerGrams = values.stockFlowerGrams + dryingCompletedGrams;
  // Existing dry stock can use the full period; newly dried material cannot.
  const processingCapacityGrams = values.periodDays * values.processingHoursPerDay * values.processingCapacityGramsPerHour;
  const postDryingCapacity = Math.max(0, values.periodDays - values.dryingDurationDays) * values.processingHoursPerDay * values.processingCapacityGramsPerHour;
  const timeAvailableInput = Math.min(values.stockFlowerGrams, processingCapacityGrams) + Math.min(dryingCompletedGrams, postDryingCapacity);
  const processedInputGrams = Math.min(values.processingRequestedGrams, availableFlowerGrams, processingCapacityGrams, timeAvailableInput);
  const processedOutputGrams = processedInputGrams * values.processingOutputRatio;
  const processingResidueGrams = processedInputGrams - processedOutputGrams;
  const flowerForSale = availableFlowerGrams - processedInputGrams;
  const processedForSale = values.stockProcessedGrams + processedOutputGrams;
  // A zero horizon performs no sales, even when opening stock exists.
  const soldFlowerGrams = values.periodDays > 0 ? Math.min(flowerForSale, values.flowerDemandGrams) : 0;
  const soldProcessedGrams = values.periodDays > 0 ? Math.min(processedForSale, values.processedDemandGrams) : 0;
  const closingFlowerGrams = flowerForSale - soldFlowerGrams;
  const closingProcessedGrams = processedForSale - soldProcessedGrams;
  const closingStockGrams = closingFlowerGrams + closingProcessedGrams;
  const peakStorageGrams = availableFlowerGrams + values.stockProcessedGrams;
  const storageOverflowGrams = Math.max(0, peakStorageGrams - values.storageCapacityGrams);
  const bottlenecks: KqWarehouseChainProjection["bottlenecks"] = [];
  if (waitingForDryingGrams > 0 || dryingCompletedGrams < dryingAcceptedGrams) bottlenecks.push("drying");
  if (processedInputGrams < Math.min(values.processingRequestedGrams, availableFlowerGrams)) bottlenecks.push("processing");
  if (storageOverflowGrams > 0) bottlenecks.push("storage");
  if (closingStockGrams > 0) bottlenecks.push("sales");
  return {
    periodDays: values.periodDays, harvestGrams: values.harvestGrams, dryingAcceptedGrams, dryingCompletedGrams,
    dryingInProgressGrams: dryingAcceptedGrams - dryingCompletedGrams, waitingForDryingGrams,
    processingCapacityGrams, processedInputGrams, processedOutputGrams, processingResidueGrams,
    soldFlowerGrams, soldProcessedGrams, closingFlowerGrams, closingProcessedGrams, closingStockGrams,
    peakStorageGrams, storageOverflowGrams,
    unmetFlowerDemandGrams: values.flowerDemandGrams - soldFlowerGrams,
    unmetProcessedDemandGrams: values.processedDemandGrams - soldProcessedGrams,
    bottlenecks,
  };
}
