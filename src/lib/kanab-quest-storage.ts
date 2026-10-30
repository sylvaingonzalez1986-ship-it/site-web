import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import { createKqCareState, getKqCannabinoidReport, type KqCareState } from "./kanab-quest-care";
import type { KqPostHarvestProfile } from "./kanab-quest-post-harvest";

/** Six real hours after harvest, before the jury, independent of the game clock. */
export const KQ_CURING_DURATION_MS = 6 * 60 * 60 * 1000;
/** One real hour after the verdict, independent of the accelerated game clock. */
export const KQ_STORAGE_OVERFLOW_GRACE_MS = 60 * 60 * 1000;
/** Fictional clearance offer, shared by manual and automatic surplus sales. */
export const KQ_STORAGE_OVERFLOW_CENTS_PER_GRAM = 54;
export const KQ_STORAGE_METHOD_CODES = ["STORAGE-GLASS", "STORAGE-GROVE", "STORAGE-BOVEDA", "STORAGE-CVAULT", "STORAGE-CANNATROL"] as const;
export type KqStorageMethodCode = typeof KQ_STORAGE_METHOD_CODES[number];
export type KqStorageMethod = {
  /** Legacy installation price; purchases use KQ_STORAGE_CONTAINERS instead. */
  code: KqStorageMethodCode; name: string; priceCents: number; description: string; sourceUrl: string;
  aromaRate: number; chemistryRate: number;
};
/** Fictional protection families; each container has its own price and capacity.
 * Both exposure rates and all loss coefficients below are game balancing. */
export const KQ_STORAGE_METHODS: readonly KqStorageMethod[] = [
  { code: "STORAGE-GLASS", name: "Bocaux en verre", priceCents: 0, description: "Des bocaux réutilisables pour les premières récoltes. Deux bocaux de 1 L sont offerts au départ.", sourceUrl: "", aromaRate: 100, chemistryRate: 100 },
  { code: "STORAGE-GROVE", name: "Sachets de conservation", priceCents: 2500, description: "Des sachets refermables pour ralentir les pertes dans ton entrepôt.", sourceUrl: "", aromaRate: 75, chemistryRate: 80 },
  { code: "STORAGE-BOVEDA", name: "Bocaux régulés", priceCents: 4500, description: "Des bocaux équipés d’un régulateur pour mieux protéger tes lots.", sourceUrl: "", aromaRate: 60, chemistryRate: 65 },
  { code: "STORAGE-CVAULT", name: "Contenants en inox", priceCents: 12000, description: "Des contenants opaques et renforcés pour conserver tes lots plus longtemps.", sourceUrl: "", aromaRate: 45, chemistryRate: 50 },
  { code: "STORAGE-CANNATROL", name: "Armoire de conservation", priceCents: 180000, description: "Une armoire dédiée aux lots que tu souhaites garder longtemps. La meilleure protection de cette gamme.", sourceUrl: "", aromaRate: 25, chemistryRate: 30 },
];
export const KQ_STORAGE_SOURCES = [
  "https://doi.org/10.3390/plants14030414",
  "https://doi.org/10.3389/fpls.2020.583605",
  "https://doi.org/10.1007/s00216-024-05321-w",
] as const;
export function getKqStorageMethod(code: string) { return KQ_STORAGE_METHODS.find(method => method.code === code); }

export const KQ_STORAGE_CONTAINER_CODES = ["GLASS-1L", "GLASS-2L", "GLASS-3L", "GROVE-1OZ", "GROVE-1LB", "BOVEDA-1L", "CVAULT-2OZ", "CVAULT-1LB", "CANNATROL", "CURTEC-60L"] as const;
export type KqStorageContainerCode = typeof KQ_STORAGE_CONTAINER_CODES[number];
export type KqStorageContainer = {
  code: KqStorageContainerCode; methodCode: KqStorageMethodCode; name: string; capacityUnits: number;
  priceCents: number; description: string; sourceUrl: string;
};
/** Capacity uses the commerce unit (0.1 g). All capacities and prices are game values. */
export const KQ_STORAGE_CONTAINERS: readonly KqStorageContainer[] = [
  { code: "GLASS-1L", methodCode: "STORAGE-GLASS", name: "Bocal en verre · 1 L", capacityUnits: 500, priceCents: 500, description: "Un petit bocal à vis pour accueillir 50 g de récolte.", sourceUrl: "" },
  { code: "GLASS-2L", methodCode: "STORAGE-GLASS", name: "Bocal en verre · 2 L", capacityUnits: 1000, priceCents: 900, description: "Un bocal plus grand pour accueillir 100 g de récolte.", sourceUrl: "" },
  { code: "GLASS-3L", methodCode: "STORAGE-GLASS", name: "Bocal en verre · 3 L", capacityUnits: 1500, priceCents: 1200, description: "Le grand format à vis pour accueillir 150 g de récolte.", sourceUrl: "" },
  { code: "GROVE-1OZ", methodCode: "STORAGE-GROVE", name: "Sachet de conservation · 28 g", capacityUnits: 280, priceCents: 300, description: "Un petit sachet refermable pour conserver 28 g de récolte.", sourceUrl: "" },
  { code: "GROVE-1LB", methodCode: "STORAGE-GROVE", name: "Sachet de conservation · 454 g", capacityUnits: 4540, priceCents: 1500, description: "Un grand sachet refermable pour conserver 454 g de récolte.", sourceUrl: "" },
  { code: "BOVEDA-1L", methodCode: "STORAGE-BOVEDA", name: "Bocal régulé · 1 L", capacityUnits: 500, priceCents: 900, description: "Un bocal avec régulateur pour protéger 50 g de récolte.", sourceUrl: "" },
  { code: "CVAULT-2OZ", methodCode: "STORAGE-CVAULT", name: "Boîte en inox · 56 g", capacityUnits: 560, priceCents: 3500, description: "Un contenant opaque et renforcé pour protéger 56 g de récolte.", sourceUrl: "" },
  { code: "CVAULT-1LB", methodCode: "STORAGE-CVAULT", name: "Boîte en inox · 454 g", capacityUnits: 4540, priceCents: 12000, description: "Un grand contenant opaque et renforcé pour protéger 454 g de récolte.", sourceUrl: "" },
  { code: "CANNATROL", methodCode: "STORAGE-CANNATROL", name: "Armoire de conservation", capacityUnits: 20000, priceCents: 180000, description: "Une armoire dédiée à la protection de 2 kg de récolte.", sourceUrl: "" },
  { code: "CURTEC-60L", methodCode: "STORAGE-GLASS", name: "Fût hermétique · 60 L", capacityUnits: 30_000, priceCents: 8_550,
    description: "Un fût réutilisable pour accueillir 3 kg de récolte, avec la même protection que les bocaux. La zone aménagée limite la place disponible.", sourceUrl: "" },
];
export const KQ_STARTER_STORAGE_CONTAINERS: Readonly<Partial<Record<KqStorageContainerCode, number>>> = { "GLASS-1L": 2 };
export function getKqStorageContainer(code: string) { return KQ_STORAGE_CONTAINERS.find(container => container.code === code); }
export type KqStorageAllocation = { containerCode: KqStorageContainerCode; quantity: number; storedUnits: number };
export type KqStorageCapacity = { totalUnits: number; allocations: KqStorageAllocation[]; overflowDeadlineAt: string | null; automaticOverflowSale?: boolean };
export type KqStorageCapacityProjection = KqStorageCapacity & {
  protectedUnits: number; overflowUnits: number; reservedCapacityUnits: number; overflowDue: boolean;
};
export type KqStorageContainerInventory = KqStorageContainer & { ownedQuantity: number; occupiedQuantity: number; freeQuantity: number; storedUnits: number };

export function getKqStorageInventory(ownedContainers: Readonly<Record<string, number>>, allocations: readonly KqStorageAllocation[] = []): KqStorageContainerInventory[] {
  for (const [code, quantity] of Object.entries(ownedContainers)) {
    if (!getKqStorageContainer(code) || !Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Inventaire de contenants invalide.");
  }
  if (!validAllocations(allocations)) throw new Error("Réservation de contenants invalide.");
  return KQ_STORAGE_CONTAINERS.map(container => {
    const ownedQuantity = ownedContainers[container.code] ?? 0;
    const reserved = allocations.filter(item => item.containerCode === container.code);
    const occupiedQuantity = reserved.reduce((sum, item) => sum + item.quantity, 0);
    if (occupiedQuantity > ownedQuantity) throw new Error("Un contenant ne peut pas accueillir plusieurs lots.");
    return { ...container, ownedQuantity, occupiedQuantity, freeQuantity: ownedQuantity - occupiedQuantity,
      storedUnits: reserved.reduce((sum, item) => sum + item.storedUnits, 0) };
  });
}

function validAllocations(value: unknown): value is KqStorageAllocation[] {
  return Array.isArray(value) && value.every(item => {
    const container = item && getKqStorageContainer(item.containerCode);
    return container && Number.isSafeInteger(item.quantity) && item.quantity > 0
      && Number.isSafeInteger(item.storedUnits) && item.storedUnits > 0
      && Number.isSafeInteger(item.quantity * container.capacityUnits)
      && item.storedUnits <= item.quantity * container.capacityUnits
      && item.quantity === Math.ceil(item.storedUnits / container.capacityUnits);
  });
}
export function isKqStorageCapacity(value: unknown): value is KqStorageCapacity {
  if (!value || typeof value !== "object") return false;
  const capacity = value as KqStorageCapacity;
  return Number.isSafeInteger(capacity.totalUnits) && capacity.totalUnits >= 0 && validAllocations(capacity.allocations)
    && (capacity.automaticOverflowSale === undefined || typeof capacity.automaticOverflowSale === "boolean")
    && new Set(capacity.allocations.map(item => item.containerCode)).size === capacity.allocations.length
    && capacity.allocations.reduce((sum, item) => sum + item.storedUnits, 0) <= capacity.totalUnits
    && (capacity.overflowDeadlineAt === null || (typeof capacity.overflowDeadlineAt === "string" && Number.isFinite(Date.parse(capacity.overflowDeadlineAt))))
    && (capacity.allocations.reduce((sum, item) => sum + item.storedUnits, 0) === capacity.totalUnits || capacity.overflowDeadlineAt !== null || capacity.automaticOverflowSale === false);
}

/** Reserve whole containers for one lot. The chosen method is filled first,
 * then the other methods from highest protection to lowest. No fractional jar
 * is shared between two harvests. The caller supplies other lots' reservations.
 * Initial nowMs is the storage entry time; reallocations keep overflowDeadlineAt,
 * including lots that initially fit completely inside their containers. */
export function planKqStorageAllocation(input: {
  totalUnits: number; ownedContainers: Readonly<Record<string, number>>; reservedAllocations?: readonly KqStorageAllocation[];
  preferredMethodCode?: KqStorageMethodCode; overflowDeadlineAt?: string | null; nowMs: number;
}): KqStorageCapacity {
  if (!Number.isSafeInteger(input.totalUnits) || input.totalUnits < 0 || !Number.isSafeInteger(input.nowMs)
    || (input.preferredMethodCode !== undefined && !getKqStorageMethod(input.preferredMethodCode))) throw new Error("Allocation de stockage invalide.");
  const inventory = getKqStorageInventory(input.ownedContainers, input.reservedAllocations);
  const methods = [...KQ_STORAGE_METHODS].sort((a, b) => Number(b.code === input.preferredMethodCode) - Number(a.code === input.preferredMethodCode) || a.aromaRate - b.aromaRate || a.code.localeCompare(b.code));
  const allocations: KqStorageAllocation[] = [];
  let remaining = input.totalUnits;
  const reserve = (container: KqStorageContainerInventory, quantity: number) => {
    if (quantity <= 0 || remaining <= 0) return;
    const storedUnits = Math.min(remaining, quantity * container.capacityUnits);
    const previous = allocations.find(item => item.containerCode === container.code);
    if (previous) { previous.quantity += quantity; previous.storedUnits += storedUnits; }
    else allocations.push({ containerCode: container.code, quantity, storedUnits });
    container.freeQuantity -= quantity;
    remaining -= storedUnits;
  };
  for (const method of methods) {
    const containers = inventory.filter(item => item.methodCode === method.code).sort((a, b) => b.capacityUnits - a.capacityUnits || a.code.localeCompare(b.code));
    while (remaining > 0) {
      const fitting = containers.filter(item => item.freeQuantity > 0 && item.capacityUnits >= remaining).sort((a, b) => a.capacityUnits - b.capacityUnits)[0];
      if (fitting) reserve(fitting, 1);
      else {
        const largest = containers.find(item => item.freeQuantity > 0);
        if (!largest) break;
        reserve(largest, Math.min(largest.freeQuantity, Math.floor(remaining / largest.capacityUnits)));
      }
    }
  }
  const result: KqStorageCapacity = { totalUnits: input.totalUnits, allocations,
    overflowDeadlineAt: input.overflowDeadlineAt ?? new Date(input.nowMs + KQ_STORAGE_OVERFLOW_GRACE_MS).toISOString() };
  if (!isKqStorageCapacity(result)) throw new Error("Allocation de stockage invalide.");
  return result;
}

/** Place the entire lot in one exact model. Pass only installed/usable containers
 * and other lots' reservations: the lot may reuse its own containers. */
export function planKqStoragePlacement(input: {
  capacity: KqStorageCapacity; containerCode: KqStorageContainerCode;
  ownedContainers: Readonly<Record<string, number>>; reservedAllocations?: readonly KqStorageAllocation[];
}): KqStorageCapacity {
  if (!isKqStorageCapacity(input.capacity) || input.capacity.totalUnits <= 0) throw new Error("Ce lot n’est plus disponible dans ton entrepôt.");
  const container = getKqStorageInventory(input.ownedContainers, input.reservedAllocations).find(item => item.code === input.containerCode);
  if (!container || container.ownedQuantity === 0) throw new Error("Ce modèle de contenant n’est pas installé dans ton entrepôt.");
  const quantity = Math.ceil(input.capacity.totalUnits / container.capacityUnits);
  if (container.freeQuantity < quantity) throw new Error("Pas assez de contenants libres de ce modèle pour accueillir tout le lot.");
  return { ...input.capacity, allocations: [{ containerCode: container.code, quantity, storedUnits: input.capacity.totalUnits }] };
}

export function projectKqStorageCapacity(capacity: KqStorageCapacity, nowMs: number): KqStorageCapacityProjection {
  if (!isKqStorageCapacity(capacity) || !Number.isSafeInteger(nowMs)) throw new Error("Capacité de stockage invalide.");
  const protectedUnits = capacity.allocations.reduce((sum, allocation) => sum + allocation.storedUnits, 0);
  const overflowUnits = capacity.totalUnits - protectedUnits;
  return { ...capacity, allocations: capacity.allocations.map(item => ({ ...item })), protectedUnits, overflowUnits,
    reservedCapacityUnits: capacity.allocations.reduce((sum, allocation) => sum + allocation.quantity * getKqStorageContainer(allocation.containerCode)!.capacityUnits, 0),
    overflowDue: capacity.automaticOverflowSale !== false && overflowUnits > 0 && capacity.overflowDeadlineAt !== null && nowMs >= Date.parse(capacity.overflowDeadlineAt) };
}

/** Sales release overflow first, then whole containers from the end of the
 * reservation. A partly filled container remains occupied by this same lot. */
export function resizeKqStorageCapacity(capacity: KqStorageCapacity, totalUnits: number): KqStorageCapacity {
  if (!isKqStorageCapacity(capacity) || !Number.isSafeInteger(totalUnits) || totalUnits < 0 || totalUnits > capacity.totalUnits) throw new Error("Volume de stockage invalide.");
  let remaining = totalUnits;
  const allocations: KqStorageAllocation[] = [];
  for (const allocation of capacity.allocations) {
    const storedUnits = Math.min(remaining, allocation.storedUnits);
    if (storedUnits > 0) allocations.push({ ...allocation, storedUnits, quantity: Math.ceil(storedUnits / getKqStorageContainer(allocation.containerCode)!.capacityUnits) });
    remaining -= storedUnits;
  }
  return { ...capacity, totalUnits, allocations };
}

/** Newly available containers fill an existing shortage without relocating the
 * already protected part. Other lots' reservations must exclude this lot. */
export function fillKqStorageCapacity(capacity: KqStorageCapacity, input: {
  ownedContainers: Readonly<Record<string, number>>; reservedAllocations?: readonly KqStorageAllocation[];
  preferredMethodCode?: KqStorageMethodCode; nowMs: number;
}): KqStorageCapacity {
  if (!isKqStorageCapacity(capacity)) throw new Error("Capacité de stockage invalide.");
  getKqStorageInventory(input.ownedContainers, [...(input.reservedAllocations ?? []), ...capacity.allocations]);
  let remaining = capacity.totalUnits - capacity.allocations.reduce((sum, allocation) => sum + allocation.storedUnits, 0);
  const allocations = capacity.allocations.map(allocation => {
    const additional = Math.min(remaining, allocation.quantity * getKqStorageContainer(allocation.containerCode)!.capacityUnits - allocation.storedUnits);
    remaining -= additional;
    return { ...allocation, storedUnits: allocation.storedUnits + additional };
  });
  const additional = planKqStorageAllocation({ ...input, totalUnits: remaining, overflowDeadlineAt: capacity.overflowDeadlineAt,
    reservedAllocations: [...(input.reservedAllocations ?? []), ...allocations] });
  for (const allocation of additional.allocations) {
    const previous = allocations.find(item => item.containerCode === allocation.containerCode);
    if (previous) { previous.quantity += allocation.quantity; previous.storedUnits += allocation.storedUnits; }
    else allocations.push(allocation);
  }
  return { totalUnits: capacity.totalUnits, allocations,
    ...(capacity.automaticOverflowSale === undefined ? {} : { automaticOverflowSale: capacity.automaticOverflowSale }),
    overflowDeadlineAt: capacity.automaticOverflowSale === false ? null : capacity.overflowDeadlineAt ?? additional.overflowDeadlineAt };
}

/** Integer weighted rates match SQL and keep exact integer exposure accounting.
 * Pending overflow receives only the baseline protection until its sale. */
export function getKqStorageExposureRates(lot: Pick<KqStorageLot, "methodCode" | "capacity" | "postHarvest">) {
  const aromaFactor = lot.postHarvest?.aromaRateFactor ?? 100;
  const chemistryFactor = lot.postHarvest?.chemistryRateFactor ?? 100;
  if (!lot.capacity || lot.capacity.totalUnits === 0) {
    const method = getKqStorageMethod(lot.methodCode);
    if (!method) throw new Error("Méthode de conservation invalide.");
    return { aromaRate: Math.ceil(method.aromaRate * aromaFactor / 100), chemistryRate: Math.ceil(method.chemistryRate * chemistryFactor / 100) };
  }
  if (!isKqStorageCapacity(lot.capacity)) throw new Error("Capacité de stockage invalide.");
  const stored = lot.capacity.allocations.reduce((sum, item) => sum + item.storedUnits, 0);
  // Integer numerators avoid rounding a mathematically integral rate upwards.
  let aroma = (lot.capacity.totalUnits - stored) * 10000, chemistry = aroma;
  for (const allocation of lot.capacity.allocations) {
    const method = getKqStorageMethod(getKqStorageContainer(allocation.containerCode)!.methodCode)!;
    aroma += allocation.storedUnits * method.aromaRate * aromaFactor;
    chemistry += allocation.storedUnits * method.chemistryRate * chemistryFactor;
  }
  return { aromaRate: Math.ceil(aroma / (lot.capacity.totalUnits * 100)), chemistryRate: Math.ceil(chemistry / (lot.capacity.totalUnits * 100)) };
}

export type KqStorageBaseline = {
  varietyCode: string; juryScore: number; aroma: number;
  care: Pick<KqCareState, "terpenes" | "cannabinoidExpression" | "cannabinoidConversion" | "cannabinoidOxidation">;
};
export type KqStoragePostHarvest = KqPostHarvestProfile & {
  containerQualityBonus: number;
  /** Exact centi-points × elapsed milliseconds accumulated only before curing ends. */
  curingBonusWeightedMs: number;
};
export type KqStorageLot = {
  version: 1; flowerId: string; harvestedAt: string; curingStartedAt: string; readyAt: string;
  lastSettledAt: string; methodCode: KqStorageMethodCode; baseline: KqStorageBaseline;
  exposure: { aromaWeightedMs: number; chemistryWeightedMs: number };
  capacity?: KqStorageCapacity;
  /** Absent in historical saves: their quality and exposure stay unchanged. */
  postHarvest?: KqStoragePostHarvest;
  /** New lifecycle; historical judged lots retain their original storage clock. */
  preJury?: boolean;
  /** Acquired effects frozen at the first jury engagement; never applied twice. */
  juryApplied?: { at: string; qualityDelta: number; originalStats: Record<string, number>; stats: Record<string, number> };
};
export type KqStorageProjection = {
  stage: "curing" | "ready"; serverNow: string; harvestedAt: string; curingStartedAt: string;
  progressPercent: number; remainingMs: number; elapsedGameDays: number; readyAt: string; nextChangeAt: string;
  methodCode: KqStorageMethodCode; methodName: string; aroma: number; terpenes: number;
  terpeneRetentionPercent: number; cannabinoidReport: ReturnType<typeof getKqCannabinoidReport>;
  qualityLoss: number; qualityDelta: number; conditionScore: number;
  capacity?: KqStorageCapacityProjection;
  postHarvest?: Omit<KqStoragePostHarvest, "curingBonusWeightedMs"> & { curingQualityBonus: number; qualityBonus: number };
};
const round2 = (value: number) => Math.round(value * 100) / 100;
/** Match PostgreSQL NUMERIC rounding even for a jury override with >2 decimals.
 * Add decimal inputs before rounding; negative half-points round away from zero. */
function qualityCentiSum(...values: number[]): number {
  const parts = values.map(value => {
    const [mantissa, exponent = "0"] = value.toString().split("e");
    const scale = (mantissa.split(".")[1]?.length ?? 0) - Number(exponent);
    return { digits: BigInt(mantissa.replace(".", "")), scale };
  });
  const precision = Math.max(2, ...parts.map(part => part.scale));
  const zero = BigInt(0), ten = BigInt(10);
  const total = parts.reduce((sum, part) => sum + part.digits * ten ** BigInt(precision - part.scale), zero);
  const divisor = ten ** BigInt(precision - 2);
  const magnitude = total < zero ? -total : total;
  const rounded = (magnitude + divisor / BigInt(2)) / divisor;
  return Number(total < zero ? -rounded : rounded);
}
const dateMs = (value: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Date de conservation invalide.");
  return parsed;
};
const inRange = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
function validPostHarvest(value: KqStoragePostHarvest | undefined): boolean {
  if (!value || typeof value !== "object") return false;
  // Keep earlier local saves readable; current equipment awards at most .7/.6/.5.
  return inRange(value.dryingQualityBonus, 0, 1.2) && inRange(value.storageQualityBonus, 0, 1)
    && inRange(value.climateQualityBonus, 0, .8) && inRange(value.containerQualityBonus, 0, .3)
    && inRange(value.aromaRateFactor, 1, 100) && Number.isInteger(value.aromaRateFactor)
    && inRange(value.chemistryRateFactor, 1, 100) && Number.isInteger(value.chemistryRateFactor)
    && Number.isSafeInteger(value.curingBonusWeightedMs) && value.curingBonusWeightedMs >= 0;
}
export function getKqStorageContainerQualityBonus(lot: Pick<KqStorageLot, "methodCode" | "capacity">): number {
  const bonus: Record<KqStorageMethodCode, number> = { "STORAGE-GLASS": 0, "STORAGE-GROVE": 10, "STORAGE-BOVEDA": 15, "STORAGE-CVAULT": 20, "STORAGE-CANNATROL": 30 };
  if (!lot.capacity) return bonus[lot.methodCode] / 100;
  if (!lot.capacity.totalUnits) return 0;
  return Math.round(lot.capacity.allocations.reduce((sum, allocation) => sum + allocation.storedUnits * bonus[getKqStorageContainer(allocation.containerCode)!.methodCode], 0) / lot.capacity.totalUnits) / 100;
}
function curingBonusAt(lot: KqStorageLot, nowMs: number): number {
  const profile = lot.postHarvest;
  if (!profile) return 0;
  const elapsed = Math.max(0, Math.min(nowMs, dateMs(lot.readyAt)) - Math.max(dateMs(lot.lastSettledAt), dateMs(lot.curingStartedAt)));
  const protectedUnits = lot.capacity?.allocations.reduce((sum, allocation) => sum + allocation.storedUnits, 0) ?? 1;
  const totalUnits = lot.capacity?.totalUnits ?? 1;
  const roomRate = Math.round(profile.storageQualityBonus * 100) + Math.round(profile.climateQualityBonus * 100);
  const containerRate = Math.round(profile.containerQualityBonus * 100);
  const rate = totalUnits > 0 ? Math.round((roomRate * protectedUnits + containerRate * totalUnits) / totalUnits) : 0;
  const weighted = profile.curingBonusWeightedMs + elapsed * rate;
  if (!Number.isSafeInteger(weighted)) throw new Error("Bonus de conservation invalide.");
  return weighted;
}
export function isKqStorageLot(value: unknown): value is KqStorageLot {
  if (!value || typeof value !== "object") return false;
  const lot = value as KqStorageLot, baseline = lot.baseline, care = baseline?.care;
  const timestamps = [lot.harvestedAt, lot.curingStartedAt, lot.readyAt, lot.lastSettledAt].map(item => typeof item === "string" ? Date.parse(item) : NaN);
  return lot.version === 1 && typeof lot.flowerId === "string" && lot.flowerId.length > 0
    && Boolean(getKqStorageMethod(lot.methodCode)) && timestamps.every(Number.isFinite)
    && timestamps[1] >= timestamps[0] && timestamps[2] > timestamps[1] && timestamps[3] >= timestamps[1]
    && typeof baseline?.varietyCode === "string" && baseline.varietyCode.length > 0
    && inRange(baseline.juryScore, 0, 10) && inRange(baseline.aroma, 35, 99)
    && inRange(care?.terpenes, 35, 99) && inRange(care?.cannabinoidExpression, 35, 99)
    && inRange(care?.cannabinoidConversion, 0, 20) && Number.isInteger(care.cannabinoidConversion)
    && inRange(care?.cannabinoidOxidation, 0, 20) && Number.isInteger(care.cannabinoidOxidation)
    && Number.isSafeInteger(lot.exposure?.aromaWeightedMs) && lot.exposure.aromaWeightedMs >= 0
    && Number.isSafeInteger(lot.exposure?.chemistryWeightedMs) && lot.exposure.chemistryWeightedMs >= 0
    && (lot.capacity === undefined || isKqStorageCapacity(lot.capacity))
    && (lot.preJury === undefined || typeof lot.preJury === "boolean")
    && (lot.juryApplied === undefined || (lot.juryApplied !== null && typeof lot.juryApplied.at === "string" && Number.isFinite(Date.parse(lot.juryApplied.at))
      && inRange(lot.juryApplied.qualityDelta, -10, 10)
      && [lot.juryApplied.originalStats, lot.juryApplied.stats].every(stats => stats && typeof stats === "object" && !Array.isArray(stats)
        && Object.values(stats).every(value => typeof value === "number" && Number.isFinite(value)))))
    && (lot.postHarvest === undefined || (validPostHarvest(lot.postHarvest)
      // Earlier local saves could earn 210 centipoints; new equipment tops out at 140.
      && lot.postHarvest.curingBonusWeightedMs <= (timestamps[2] - timestamps[1]) * 210));
}
export function createKqStorageLot(input: {
  flowerId: string; harvestedAt: string; curingStartedAt?: string; methodCode?: KqStorageMethodCode;
  baseline: KqStorageBaseline; curingDurationMs?: number;
  capacity?: KqStorageCapacity;
  postHarvest?: KqPostHarvestProfile;
  preJury?: boolean;
}): KqStorageLot {
  const started = dateMs(input.curingStartedAt ?? input.harvestedAt);
  const duration = input.curingDurationMs ?? KQ_CURING_DURATION_MS;
  if (!Number.isSafeInteger(duration) || duration <= 0) throw new Error("Durée de curing invalide.");
  const lot: KqStorageLot = {
    version: 1, flowerId: input.flowerId, harvestedAt: new Date(dateMs(input.harvestedAt)).toISOString(),
    curingStartedAt: new Date(started).toISOString(), readyAt: new Date(started + duration).toISOString(),
    lastSettledAt: new Date(started).toISOString(), methodCode: input.methodCode ?? "STORAGE-GLASS",
    baseline: { varietyCode: input.baseline.varietyCode, juryScore: input.baseline.juryScore, aroma: input.baseline.aroma,
      care: { terpenes: input.baseline.care.terpenes, cannabinoidExpression: input.baseline.care.cannabinoidExpression,
        cannabinoidConversion: input.baseline.care.cannabinoidConversion, cannabinoidOxidation: input.baseline.care.cannabinoidOxidation } },
    exposure: { aromaWeightedMs: 0, chemistryWeightedMs: 0 },
    ...(input.preJury !== undefined ? { preJury: input.preJury } : {}),
    ...(input.capacity ? { capacity: structuredClone(input.capacity) } : {}),
  };
  if (input.postHarvest) lot.postHarvest = { ...input.postHarvest, containerQualityBonus: getKqStorageContainerQualityBonus(lot), curingBonusWeightedMs: 0 };
  if (!isKqStorageLot(lot)) throw new Error("Lot de conservation invalide.");
  return lot;
}

function exposureAt(lot: KqStorageLot, nowMs: number) {
  if (!isKqStorageLot(lot) || !Number.isSafeInteger(nowMs)) throw new Error("Horloge ou lot de conservation invalide.");
  const method = getKqStorageExposureRates(lot);
  const elapsed = Math.max(0, nowMs - dateMs(lot.lastSettledAt));
  const exposure = {
    aromaWeightedMs: lot.exposure.aromaWeightedMs + elapsed * method.aromaRate,
    chemistryWeightedMs: lot.exposure.chemistryWeightedMs + elapsed * method.chemistryRate,
  };
  if (!Number.isSafeInteger(exposure.aromaWeightedMs) || !Number.isSafeInteger(exposure.chemistryWeightedMs)) throw new Error("Exposition de conservation invalide.");
  return exposure;
}
/** Checkpoints exact exposure; frequent saves cannot erase fractions of a day. */
export function settleKqStorageLot(lot: KqStorageLot, nowMs: number): KqStorageLot {
  const exposure = exposureAt(lot, nowMs);
  return { ...lot, lastSettledAt: new Date(Math.max(nowMs, dateMs(lot.lastSettledAt))).toISOString(), exposure,
    ...(lot.postHarvest ? { postHarvest: { ...lot.postHarvest, curingBonusWeightedMs: curingBonusAt(lot, nowMs) } } : {}) };
}
/** Settle the old installation first. A purchase never restores lost quality. */
export function changeKqStorageMethod(lot: KqStorageLot, code: KqStorageMethodCode, nowMs: number): KqStorageLot {
  if (!getKqStorageMethod(code)) throw new Error("Installation de conservation inconnue.");
  const next = { ...settleKqStorageLot(lot, nowMs), methodCode: code };
  if (next.postHarvest) next.postHarvest = { ...next.postHarvest, containerQualityBonus: getKqStorageContainerQualityBonus(next) };
  return next;
}
/** Reallocation checkpoints the old protection. Resolving a temporary shortage
 * never grants a fresh one-hour grace period if the same lot overflows again. */
export function changeKqStorageCapacity(lot: KqStorageLot, capacity: KqStorageCapacity, nowMs: number): KqStorageLot {
  if (!isKqStorageCapacity(capacity)) throw new Error("Capacité de stockage invalide.");
  const previousDeadline = lot.capacity?.overflowDeadlineAt;
  const nextCapacity = { ...structuredClone(capacity), overflowDeadlineAt: previousDeadline ?? capacity.overflowDeadlineAt };
  const next = { ...settleKqStorageLot(lot, nowMs), capacity: nextCapacity };
  if (next.postHarvest) next.postHarvest = { ...next.postHarvest, containerQualityBonus: getKqStorageContainerQualityBonus(next) };
  return next;
}
/** Preserve completed drying and all previous exposure; upgrades affect only future time. */
export function changeKqStoragePostHarvest(lot: KqStorageLot, profile: KqPostHarvestProfile, nowMs: number): KqStorageLot {
  const next = settleKqStorageLot(lot, nowMs);
  next.postHarvest = { ...profile, dryingQualityBonus: next.postHarvest?.dryingQualityBonus ?? 0,
    containerQualityBonus: getKqStorageContainerQualityBonus(next), curingBonusWeightedMs: next.postHarvest?.curingBonusWeightedMs ?? 0 };
  if (!isKqStorageLot(next)) throw new Error("Profil de conservation invalide.");
  return next;
}
/** Reading is pure and stable within a game day. A method change creates a new
 * exact checkpoint and invalidates earlier quotations. Maturity uses the exact
 * server timestamp; chemistry uses complete game days since storage started. */
export function projectKqStorageLot(lot: KqStorageLot, nowMs: number, juryScoreOverride?: number): KqStorageProjection {
  if (!isKqStorageLot(lot) || !Number.isSafeInteger(nowMs)) throw new Error("Horloge ou lot de conservation invalide.");
  const started = dateMs(lot.curingStartedAt), settled = dateMs(lot.lastSettledAt), ready = dateMs(lot.readyAt);
  const now = Math.max(settled, nowMs);
  const elapsedGameDays = Math.floor((now - started) / KQ_GAME_DAY_MS);
  const evaluationAt = Math.max(settled, started + elapsedGameDays * KQ_GAME_DAY_MS);
  const exposure = exposureAt(lot, evaluationAt), baseline = lot.baseline, initial = baseline.care;
  const aromaLoss = Math.min(40, Math.floor(exposure.aromaWeightedMs / (15 * KQ_GAME_DAY_MS * 100)));
  const chemistryLoss = Math.min(64, Math.floor(exposure.chemistryWeightedMs / (60 * KQ_GAME_DAY_MS * 100)));
  const aroma = Math.max(35, baseline.aroma - aromaLoss), terpenes = Math.max(35, initial.terpenes - aromaLoss);
  const care = { ...createKqCareState(), ...initial, terpenes,
    cannabinoidExpression: Math.max(35, initial.cannabinoidExpression - chemistryLoss),
    cannabinoidConversion: Math.min(20, initial.cannabinoidConversion + Math.floor(exposure.chemistryWeightedMs / (30 * KQ_GAME_DAY_MS * 100))),
    cannabinoidOxidation: Math.min(20, initial.cannabinoidOxidation + Math.floor(exposure.chemistryWeightedMs / (120 * KQ_GAME_DAY_MS * 100))),
  };
  const qualityLoss = round2((baseline.aroma - aroma + initial.cannabinoidExpression - care.cannabinoidExpression) / 25);
  const juryScore = juryScoreOverride ?? baseline.juryScore;
  if (!inRange(juryScore, 0, 10)) throw new Error("Note de jury invalide.");
  const nextDay = started + (elapsedGameDays + 1) * KQ_GAME_DAY_MS;
  const capacity = lot.capacity ? projectKqStorageCapacity(lot.capacity, now) : undefined;
  const overflowDeadline = capacity && capacity.overflowUnits > 0 && capacity.overflowDeadlineAt ? Date.parse(capacity.overflowDeadlineAt) : Infinity;
  const nextChangeAt = new Date(Math.min(ready > now ? ready : Infinity, nextDay, overflowDeadline > now ? overflowDeadline : Infinity)).toISOString();
  const methods = capacity ? [...new Set(capacity.allocations.map(allocation => getKqStorageContainer(allocation.containerCode)!.methodCode))] : [];
  const methodName = !capacity ? getKqStorageMethod(lot.methodCode)!.name : capacity.protectedUnits === 0 ? "En attente de contenant"
    : methods.length > 1 ? "Contenants mixtes" : getKqStorageMethod(methods[0])!.name;
  const curingQualityBonus = lot.postHarvest ? Math.round(curingBonusAt(lot, now) / (ready - started)) / 100 : 0;
  const qualityBonus = qualityCentiSum(lot.postHarvest?.dryingQualityBonus ?? 0, curingQualityBonus) / 100;
  let conditionScore = lot.postHarvest
    ? Math.max(0, Math.min(1000, qualityCentiSum(juryScore, qualityBonus, -qualityLoss))) / 100
    : Math.max(0, round2(juryScore - qualityLoss));
  if (lot.juryApplied && juryScoreOverride !== undefined) {
    const currentDelta = lot.postHarvest
      ? Math.max(0, Math.min(1000, qualityCentiSum(baseline.juryScore, qualityBonus, -qualityLoss))) / 100 - baseline.juryScore
      : -qualityLoss;
    conditionScore = Math.max(0, Math.min(1000, qualityCentiSum(juryScore, currentDelta, -lot.juryApplied.qualityDelta))) / 100;
  }
  return {
    stage: now >= ready ? "ready" : "curing", serverNow: new Date(now).toISOString(), harvestedAt: lot.harvestedAt,
    curingStartedAt: lot.curingStartedAt, readyAt: lot.readyAt, nextChangeAt, elapsedGameDays,
    progressPercent: now >= ready ? 100 : Math.min(99.99, round2((now - started) / (ready - started) * 100)), remainingMs: Math.max(0, ready - now),
    methodCode: lot.methodCode, methodName,
    aroma, terpenes, terpeneRetentionPercent: round2(terpenes / initial.terpenes * 100),
    cannabinoidReport: getKqCannabinoidReport({ varietyCode: baseline.varietyCode, care }),
    qualityLoss, qualityDelta: lot.postHarvest || lot.juryApplied ? qualityCentiSum(conditionScore, -juryScore) / 100 : qualityLoss === 0 ? 0 : -qualityLoss, conditionScore,
    ...(capacity ? { capacity } : {}),
    ...(lot.postHarvest ? { postHarvest: { dryingQualityBonus: lot.postHarvest.dryingQualityBonus,
      storageQualityBonus: lot.postHarvest.storageQualityBonus, climateQualityBonus: lot.postHarvest.climateQualityBonus,
      containerQualityBonus: lot.postHarvest.containerQualityBonus, aromaRateFactor: lot.postHarvest.aromaRateFactor,
      chemistryRateFactor: lot.postHarvest.chemistryRateFactor, curingQualityBonus, qualityBonus } } : {}),
  };
}

/** Freeze the quality actually acquired in storage before submitting a flower.
 * The harvest evidence and baseline remain immutable. Trading later supplies
 * the final jury score to projectKqStorageLot, which removes this applied delta. */
export function applyKqStorageToJury(lot: KqStorageLot, stats: Record<string, number>, nowMs: number): { lot: KqStorageLot; stats: Record<string, number> } {
  const settled = settleKqStorageLot(lot, nowMs);
  const projection = projectKqStorageLot(settled, nowMs);
  if (projection.stage !== "ready") throw new Error("Le curing doit être terminé avant de présenter cette fleur au jury.");
  if (lot.juryApplied) return { lot, stats: { ...lot.juryApplied.stats } };
  if (!Object.values(stats).every(value => typeof value === "number" && Number.isFinite(value))) throw new Error("Statistiques de fleur invalides.");
  const categories = new Set(["appearance", "aroma", "vigor", "mastery", "regularity", "cannabinoids"]);
  const prepared = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key,
    categories.has(key) ? Math.max(0, Math.min(99, Math.round(value + projection.qualityDelta * 10))) : value]));
  const next = { ...settled, juryApplied: {
    at: new Date(nowMs).toISOString(), qualityDelta: projection.qualityDelta, originalStats: { ...stats }, stats: prepared,
  } };
  return { lot: next, stats: prepared };
}
