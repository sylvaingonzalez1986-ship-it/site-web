import { KQ_WAREHOUSE_CATALOG, type KqWarehouseDevice } from "./kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_OPTIONS, KQ_WAREHOUSE_OPTION_LIMITS, getKqWarehouseOption, getKqWarehouseOptionLine, validateKqWarehouseOptionCodes, type KqWarehouseOptionLine } from "./kanab-quest-warehouse-options";

/** Historical bounds remain valid for archived plans and immutable run snapshots. */
export const KQ_WAREHOUSE_COLUMNS = 40;
export const KQ_WAREHOUSE_ROWS = 25;
export const KQ_WAREHOUSE_AREA_M2 = KQ_WAREHOUSE_COLUMNS * KQ_WAREHOUSE_ROWS;
export type KqWarehouseDimensions = { columns: number; rows: number };

/** Game assumptions, not manufacturer specifications or a cultivation schedule. */
export const KQ_WAREHOUSE_SIMULATION = {
  equivalentLightingHours: 1_000,
  equivalentAirHours: 1_440,
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
  active: boolean;
  lightingCode: string;
  airCode: string;
  /** Optional, fictional profiles: at most one per family. Absence preserves legacy balance. */
  optionCodes?: string[];
  /** One collectible assigned to this zone; ownership is checked by the server. */
  buddieCode?: string;
};

export type KqWarehouseEquipment = { code: string; quantity: number };
export type KqWarehouseServiceZone = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "drying" | "storage";
  deviceCode: string;
};
export type KqWarehouseState = {
  version: 1;
  /** Absence identifies the historical 40 × 25 floor. Only the server can adopt this floor. */
  floor?: { columns: 10; rows: 10 };
  zones: KqWarehouseZone[];
  /** Absent only in historical plans. When present, capacities require a placed zone. */
  serviceZones?: KqWarehouseServiceZone[];
  /** All owned devices, including culture equipment kept in reserve. */
  equipment: KqWarehouseEquipment[];
  /** Owned simulation-module coverage, in whole square metres. Removed modules stay in reserve. */
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
  /** Frozen fictional score bonus. Absent on all historical snapshots. */
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
      requireAreaDevice(zone.lightingCode, "lighting");
      requireAreaDevice(zone.airCode, "air");
    } catch {
      errors.push("Une zone contient un éclairage ou un extracteur incompatible.");
    }
    if (valid.some((existing) => doKqWarehouseZonesOverlap(zone, existing))) errors.push("Les zones de culture ne peuvent pas se superposer.");
    valid.push(zone);
  }
  return [...new Set(errors)];
}

/** Validates drafts as well as persisted plans; a quote purchases missing devices. */
export function validateKqWarehouseState(value: unknown): string[] {
  if (!record(value) || value.version !== 1) return ["Version du plan d’entrepôt inconnue."];
  if ("floor" in value && (!record(value.floor) || value.floor.columns !== 10 || value.floor.rows !== 10
    || Object.keys(value.floor).length !== 2)) return ["Dimensions de l’entrepôt invalides."];
  const dimensions = getKqWarehouseDimensions(value as KqWarehouseState);
  const errors = validateKqWarehouseZones(value.zones, dimensions);
  if ("serviceZones" in value) errors.push(...validateKqWarehouseServiceZones(value.serviceZones, errors.length ? [] : value.zones as KqWarehouseZone[], dimensions));
  if (!natural(value.preparedAreaM2) || value.preparedAreaM2 > dimensions.columns * dimensions.rows) errors.push("Surface aménagée invalide.");
  if ("optionInventory" in value) {
    if (!Array.isArray(value.optionInventory) || value.optionInventory.length > KQ_WAREHOUSE_OPTIONS.length) errors.push("Réserve de modules invalide.");
    else {
      const seen = new Set<string>();
      for (const item of value.optionInventory) {
        if (!record(item) || typeof item.code !== "string" || !getKqWarehouseOption(item.code) || !natural(item.quantity) || item.quantity > 100_000 || seen.has(item.code)) errors.push("Réserve de modules invalide.");
        else seen.add(item.code);
      }
    }
  }
  if (!Array.isArray(value.equipment) || value.equipment.length > KQ_WAREHOUSE_CATALOG.length) return [...errors, "Inventaire d’appareils invalide."];
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

function deviceLine(code: string, quantity: number): KqWarehouseDeviceLine {
  const device = requireDevice(code);
  return { code, quantity, device, totalCents: device.priceCents * quantity, powerWatts: device.watts * quantity };
}

export function getKqWarehouseZoneQuote(zone: KqWarehouseZone): KqWarehouseZoneQuote {
  const errors = validateKqWarehouseZones([zone]);
  if (errors.length) throw new Error(errors.join(" "));
  const areaM2 = zone.width * zone.height;
  const lighting = requireAreaDevice(zone.lightingCode, "lighting");
  const air = requireAreaDevice(zone.airCode, "air");
  const devices = [lighting, air].map((device) => deviceLine(device.code, Math.ceil(areaM2 / device.gameCapacity!.value)));
  const options = (zone.optionCodes ?? []).map(code => getKqWarehouseOptionLine(code, areaM2));
  const optionEquipmentCostCents = options.reduce((sum, line) => sum + line.totalCents, 0);
  const yieldBonusPercent = Math.min(KQ_WAREHOUSE_OPTION_LIMITS.yieldBonusPercent, options.reduce((sum, line) => sum + line.option.yieldBonusPercent, 0));
  const qualityBonus = Math.min(KQ_WAREHOUSE_OPTION_LIMITS.qualityBonus, options.reduce((sum, line) => sum + line.option.qualityBonus, 0));
  const equipmentCostCents = devices.reduce((sum, line) => sum + line.totalCents, 0) + optionEquipmentCostCents;
  const preparationCostCents = areaM2 * KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2;
  const installationCostCents = Math.round(equipmentCostCents * KQ_WAREHOUSE_SIMULATION.installationPercent / 100);
  const totalCostCents = equipmentCostCents + preparationCostCents + installationCostCents;
  const energyKwh = zone.active ? rounded(devices.reduce((sum, line) => sum + line.powerWatts * (line.device.kind === "lighting"
    ? KQ_WAREHOUSE_SIMULATION.equivalentLightingHours : KQ_WAREHOUSE_SIMULATION.equivalentAirHours) / 1_000, 0)) : 0;
  const energyCostCents = Math.round(energyKwh * KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh);
  const consumablesCostCents = zone.active ? areaM2 * KQ_WAREHOUSE_SIMULATION.consumablesCentsPerM2 + options.reduce((sum, line) => sum + line.consumablesCostCents, 0) : 0;
  return {
    areaM2, devices, options, optionEquipmentCostCents, yieldBonusPercent, qualityBonus, equipmentCostCents, preparationCostCents, installationCostCents, totalCostCents,
    costPerM2Cents: Math.round(totalCostCents / areaM2),
    powerWatts: zone.active ? devices.reduce((sum, line) => sum + line.powerWatts, 0) : 0,
    energyKwh, energyCostCents, consumablesCostCents,
    operatingCostCents: energyCostCents + consumablesCostCents,
    estimatedHarvestGrams: zone.active ? rounded(areaM2 * KQ_WAREHOUSE_SIMULATION.estimatedDryGramsPerM2 * (100 + yieldBonusPercent) / 100) : 0,
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

export function getKqWarehouseEquipmentDemand(zones: KqWarehouseZone[], serviceZones: KqWarehouseServiceZone[] = []): KqWarehouseEquipment[] {
  const errors = validateKqWarehouseZones(zones);
  errors.push(...validateKqWarehouseServiceZones(serviceZones, zones));
  if (errors.length) throw new Error(errors.join(" "));
  const quantities = new Map<string, number>();
  for (const zone of zones) {
    for (const line of getKqWarehouseZoneQuote(zone).devices) quantities.set(line.code, (quantities.get(line.code) ?? 0) + line.quantity);
  }
  for (const zone of serviceZones) {
    for (const line of getKqWarehouseServiceZoneQuote(zone).devices) quantities.set(line.code, (quantities.get(line.code) ?? 0) + line.quantity);
  }
  return [...quantities].map(([code, quantity]) => ({ code, quantity })).sort((a, b) => a.code.localeCompare(b.code));
}

export function getKqWarehouseOptionDemand(zones: KqWarehouseZone[]): KqWarehouseEquipment[] {
  const quantities = new Map<string, number>();
  for (const zone of zones) for (const code of zone.optionCodes ?? []) quantities.set(code, (quantities.get(code) ?? 0) + zone.width * zone.height);
  return [...quantities].map(([code, quantity]) => ({ code, quantity })).sort((a, b) => a.code.localeCompare(b.code));
}

const copyZone = (zone: KqWarehouseZone): KqWarehouseZone => ({ ...zone, ...(zone.optionCodes === undefined ? {} : { optionCodes: [...zone.optionCodes] }) });

/** No implicit sale: removing a zone or replacing a device keeps existing assets in reserve. */
export function getKqWarehouseQuote(candidate: KqWarehouseState, previous?: KqWarehouseState): KqWarehouseQuote {
  assertState(candidate);
  if (previous) assertState(previous);
  if (previous && !!previous.floor !== !!candidate.floor) throw new Error("Les dimensions de l’entrepôt ne peuvent pas être modifiées dans un devis.");
  if (previous?.serviceZones !== undefined && candidate.serviceZones === undefined) throw new Error("Les zones de séchage et stockage doivent rester présentes dans le plan.");
  const owned = new Map(previous?.equipment.map((item) => [item.code, item.quantity]) ?? []);
  const target = new Map(owned);
  for (const item of [...candidate.equipment, ...getKqWarehouseEquipmentDemand(candidate.zones, candidate.serviceZones)]) target.set(item.code, Math.max(target.get(item.code) ?? 0, item.quantity));
  const purchases = [...target].map(([code, quantity]) => deviceLine(code, Math.max(0, quantity - (owned.get(code) ?? 0)))).filter((line) => line.quantity > 0);
  if (purchases.some(line => line.device.purchasable === false)) {
    throw new Error("Cet équipement historique peut être réutilisé depuis la réserve, mais ne peut plus être acheté.");
  }
  const ownedOptions = new Map(previous?.optionInventory?.map(item => [item.code, item.quantity]) ?? []);
  const targetOptions = new Map(ownedOptions);
  for (const item of [...(candidate.optionInventory ?? []), ...getKqWarehouseOptionDemand(candidate.zones)]) targetOptions.set(item.code, Math.max(targetOptions.get(item.code) ?? 0, item.quantity));
  const optionPurchases = [...targetOptions].map(([code, quantity]) => getKqWarehouseOptionLine(code, Math.max(0, quantity - (ownedOptions.get(code) ?? 0)))).filter(line => line.quantity > 0);
  const optionEquipmentCostCents = optionPurchases.reduce((sum, line) => sum + line.totalCents, 0);
  if (previous && candidate.serviceZones === undefined && purchases.some(line => line.device.kind === "drying" || line.device.kind === "storage")) {
    throw new Error("Trace une zone de séchage ou stockage avant d’acheter ce matériel.");
  }
  const equippedAreaM2 = candidate.zones.reduce((sum, zone) => sum + zone.width * zone.height, 0);
  const allocatedAreaM2 = equippedAreaM2 + (candidate.serviceZones ?? []).reduce((sum, zone) => sum + zone.width * zone.height, 0);
  // Client-provided preparedAreaM2 never waives the cost of new preparation.
  const preparedAreaM2 = Math.max(previous?.preparedAreaM2 ?? 0, allocatedAreaM2);
  const addedAreaM2 = preparedAreaM2 - (previous?.preparedAreaM2 ?? 0);
  const equipmentCostCents = purchases.reduce((sum, line) => sum + line.totalCents, 0) + optionEquipmentCostCents;
  const preparationCostCents = addedAreaM2 * KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2;
  const installationCostCents = Math.round(equipmentCostCents * KQ_WAREHOUSE_SIMULATION.installationPercent / 100);
  const totalCostCents = equipmentCostCents + preparationCostCents + installationCostCents;
  return {
    nextState: {
      version: 1,
      ...(candidate.floor ? { floor: { ...candidate.floor } } : {}),
      zones: candidate.zones.map(copyZone),
      ...(candidate.serviceZones !== undefined ? { serviceZones: candidate.serviceZones.map(zone => ({ ...zone })) } : {}),
      equipment: [...target].filter(([, quantity]) => quantity > 0).map(([code, quantity]) => ({ code, quantity })).sort((a, b) => a.code.localeCompare(b.code)),
      ...(targetOptions.size || candidate.optionInventory !== undefined || previous?.optionInventory !== undefined ? {
        optionInventory: [...targetOptions].filter(([, quantity]) => quantity > 0).map(([code, quantity]) => ({ code, quantity })).sort((a, b) => a.code.localeCompare(b.code)),
      } : {}),
      preparedAreaM2,
    },
    purchases, optionPurchases, optionEquipmentCostCents, addedAreaM2, equipmentCostCents, preparationCostCents, installationCostCents, totalCostCents,
    costPerM2Cents: allocatedAreaM2 ? Math.round(totalCostCents / allocatedAreaM2) : 0,
  };
}

export function getKqWarehouseSummary(state: KqWarehouseState): KqWarehouseSummary {
  assertState(state);
  const dimensions = getKqWarehouseDimensions(state);
  const totalAreaM2 = dimensions.columns * dimensions.rows;
  const quotes = state.zones.map(getKqWarehouseZoneQuote);
  const equippedAreaM2 = quotes.reduce((sum, quote) => sum + quote.areaM2, 0);
  const serviceZones = state.serviceZones ?? [];
  const dryingAreaM2 = serviceZones.reduce((sum, zone) => sum + (zone.kind === "drying" ? zone.width * zone.height : 0), 0);
  const storageAreaM2 = serviceZones.reduce((sum, zone) => sum + (zone.kind === "storage" ? zone.width * zone.height : 0), 0);
  const allocatedAreaM2 = equippedAreaM2 + dryingAreaM2 + storageAreaM2;
  const activeAreaM2 = state.zones.reduce((sum, zone) => sum + (zone.active ? zone.width * zone.height : 0), 0);
  const demand = new Map(getKqWarehouseEquipmentDemand(state.zones, serviceZones).map((item) => [item.code, item.quantity]));
  const equipment = state.equipment.map((item) => deviceLine(item.code, item.quantity));
  const options = (state.optionInventory ?? []).map(item => getKqWarehouseOptionLine(item.code, item.quantity));
  const optionDemand = new Map(getKqWarehouseOptionDemand(state.zones).map(item => [item.code, item.quantity]));
  const equipmentCostCents = equipment.reduce((sum, line) => sum + line.totalCents, 0) + options.reduce((sum, line) => sum + line.totalCents, 0);
  const investmentCents = equipmentCostCents + Math.round(equipmentCostCents * KQ_WAREHOUSE_SIMULATION.installationPercent / 100)
    + state.preparedAreaM2 * KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2;
  const capacity = (kind: "drying" | "storage") => state.serviceZones !== undefined
    ? serviceZones.reduce((sum, zone) => sum + (zone.kind === kind ? getKqWarehouseServiceZoneQuote(zone).capacityGrams : 0), 0)
    : equipment.reduce((sum, line) => sum + (line.device.kind === kind && line.device.gameCapacity?.unit === "g" ? line.quantity * line.device.gameCapacity.value : 0), 0);
  const energyKwh = rounded(quotes.reduce((sum, quote) => sum + quote.energyKwh, 0));
  const energyCostCents = Math.round(energyKwh * KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh);
  const consumablesCostCents = quotes.reduce((sum, quote) => sum + quote.consumablesCostCents, 0);
  return {
    totalAreaM2, equippedAreaM2, cultureAreaM2: equippedAreaM2, dryingAreaM2, storageAreaM2, allocatedAreaM2,
    activeAreaM2, freeAreaM2: totalAreaM2 - allocatedAreaM2,
    powerWatts: quotes.reduce((sum, quote) => sum + quote.powerWatts, 0),
    energyKwh, energyCostCents, consumablesCostCents, operatingCostCents: energyCostCents + consumablesCostCents,
    estimatedHarvestGrams: quotes.reduce((sum, quote) => sum + quote.estimatedHarvestGrams, 0),
    investmentCents, investmentPerM2Cents: allocatedAreaM2 ? Math.round(investmentCents / allocatedAreaM2) : 0,
    dryingCapacityGrams: capacity("drying"), storageCapacityGrams: capacity("storage"),
    processingCapacityGramsPerHour: rounded(equipment.reduce((sum, line) => sum + (line.device.kind === "processing"
      && line.device.gameCapacity?.unit === "g/batch" && (line.device.gameCapacity.durationHours ?? 0) > 0
      ? line.quantity * line.device.gameCapacity.value / line.device.gameCapacity.durationHours! : 0), 0)),
    equipment,
    options,
    optionReserve: (state.optionInventory ?? []).map(item => ({ code: item.code, quantity: Math.max(0, item.quantity - (optionDemand.get(item.code) ?? 0)) })).filter(item => item.quantity > 0),
    qualityBonus: activeAreaM2 ? Math.floor(quotes.reduce((sum, quote, index) => sum + (state.zones[index].active ? quote.qualityBonus * quote.areaM2 : 0), 0) / activeAreaM2) : 0,
    reserve: state.equipment.filter((item) => requireDevice(item.code).room === "culture" || (state.serviceZones !== undefined && requireDevice(item.code).room === "storage"))
      .map((item) => ({ code: item.code, quantity: Math.max(0, item.quantity - (demand.get(item.code) ?? 0)) })).filter((item) => item.quantity > 0),
  };
}

export function createKqWarehouseStarter(): KqWarehouseState {
  return getKqWarehouseQuote({
    version: 1, floor: { columns: 10, rows: 10 }, preparedAreaM2: 0, equipment: [],
    zones: [{ id: "starter", name: "Première zone", x: 0, y: 0, width: 1, height: 1, active: true, lightingCode: "MH-TS1000", airCode: "SJ-DF16E350" }],
    serviceZones: [
      { id: "starter-drying", name: "Filets de séchage", x: 0, y: 9, width: 1, height: 1, kind: "drying", deviceCode: "SJ-DRYIT90" },
      { id: "starter-storage", name: "Premiers bocaux", x: 2, y: 9, width: 1, height: 1, kind: "storage", deviceCode: "LP-SUPER-1L" },
    ],
  }).nextState;
}

/** Free, conservative relocation. Funding, identity, inventory and dimensions of every zone are preserved.
 * A failed packing leaves the whole historical plan untouched. The server separately locks active runs. */
export function compactKqWarehouseToStarterFloor(state: KqWarehouseState): KqWarehouseState | null {
  assertState(state);
  if (state.floor || state.preparedAreaM2 > 100) return null;
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

export function getKqWarehouseRunSnapshot(state: KqWarehouseState, revision = 0, zoneId?: string): KqWarehouseRunSnapshot {
  if (!natural(revision)) throw new Error("Révision de l’entrepôt invalide.");
  const fullSummary = getKqWarehouseSummary(state);
  const demand = getKqWarehouseEquipmentDemand(state.zones, state.serviceZones);
  const optionDemand = getKqWarehouseOptionDemand(state.zones);
  if (fullSummary.allocatedAreaM2 > state.preparedAreaM2 || demand.some((required) => required.quantity > (state.equipment.find((item) => item.code === required.code)?.quantity ?? 0))
    || optionDemand.some(required => required.quantity > (state.optionInventory?.find(item => item.code === required.code)?.quantity ?? 0))) {
    throw new Error("L’aménagement doit être financé avant de commencer une culture.");
  }
  const selected = zoneId === undefined ? undefined : state.zones.find(zone => zone.id === zoneId);
  if (zoneId !== undefined && (!selected || !selected.active)) throw new Error("Choisis une zone de culture active.");
  const zones = selected ? [selected] : state.zones;
  const summary = selected ? getKqWarehouseSummary({ ...state, zones }) : fullSummary;
  if (!summary.activeAreaM2) throw new Error("Active au moins une zone avant de commencer.");
  return {
    ...(zoneId === undefined ? { version: 1 as const } : { version: 2 as const, zoneId }), revision,
    sourceState: { ...state, ...(state.floor ? { floor: { ...state.floor } } : {}), zones: state.zones.map(copyZone), equipment: state.equipment.map((item) => ({ ...item })),
      ...(state.optionInventory !== undefined ? { optionInventory: state.optionInventory.map(item => ({ ...item })) } : {}),
      ...(state.serviceZones !== undefined ? { serviceZones: state.serviceZones.map(zone => ({ ...zone })) } : {}) },
    zones: zones.map(copyZone),
    activeAreaM2: summary.activeAreaM2, estimatedHarvestGrams: summary.estimatedHarvestGrams,
    powerWatts: summary.powerWatts, energyKwh: summary.energyKwh, energyCostCents: summary.energyCostCents,
    consumablesCostCents: summary.consumablesCostCents, operatingCostCents: summary.operatingCostCents,
    dryingCapacityGrams: summary.dryingCapacityGrams, storageCapacityGrams: summary.storageCapacityGrams,
    ...(getKqWarehouseOptionDemand(zones).length ? { qualityBonus: summary.qualityBonus } : {}),
  };
}

export function isKqWarehouseRunSnapshot(value: unknown): value is KqWarehouseRunSnapshot {
  if (!record(value) || ![1, 2].includes(Number(value.version)) || !natural(value.revision) || !isKqWarehouseState(value.sourceState)) return false;
  if (value.version === 2 ? typeof value.zoneId !== "string" || !value.zoneId : value.version !== 1 || value.zoneId !== undefined) return false;
  try {
    const expected = getKqWarehouseRunSnapshot(value.sourceState, value.revision, value.version === 2 ? value.zoneId as string : undefined);
    const fields = ["activeAreaM2", "estimatedHarvestGrams", "powerWatts", "energyKwh", "energyCostCents", "consumablesCostCents", "operatingCostCents", "dryingCapacityGrams", "storageCapacityGrams"] as const;
    return fields.every((field) => value[field] === expected[field]) && value.qualityBonus === expected.qualityBonus && JSON.stringify(value.zones) === JSON.stringify(expected.zones);
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
