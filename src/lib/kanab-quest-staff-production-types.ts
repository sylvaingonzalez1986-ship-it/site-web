import type { KqStaffTrait } from "./kanab-quest-staff-types";

export type KqProductionStep = "auto" | "culture" | "trim" | "processing" | "sell";
export type KqProductionRoute = "flower" | "dry-sift";
export type KqProductionSkills = { culture: number; processing: number; sales: number };
/** Owned server snapshot. Never accept this object from a client command. */
export type KqProductionFacilityInput = {
  warehouseState: unknown; warehouseRevision: number; busyZoneIds: Array<string | null>;
  usedStorageGrams: number; reservedDryingGrams: number;
  equipment: Array<{ code: string; level: number }>;
};
export type KqProductionRulesCommand = {
  action: "set-production-rules"; enabled: boolean; zoneId: string | null;
  route: KqProductionRoute; maxDailyCostCents: number; cashReserveCents: number;
  expectedRevision: number;
};
export type KqProductionSettings = Omit<KqProductionRulesCommand, "action"> & { updatedAt: string };
export type KqProductionFacility = {
  zoneId: string; name: string; areaM2: number; harvestGrams: number; cycleCostCents: number;
  dryingCapacityGrams: number; storageCapacityGrams: number;
  processingRateGramsPerHour: number; processingAvailable: boolean;
};
export type KqProductionFacilityQuote = KqProductionFacility & { available: boolean; reason: string | null; warehouseRevision: number };
/** Commercial material only: there is deliberately no flowerId or competition reference. */
export type KqProductionLot = {
  id: string; route: KqProductionRoute; createdAt: string; stage: "culture" | "drying" | "trim" | "processing" | "ready";
  cultureStage: number; readyAt: string; potentialGrams: number; grams: number; equivalentGrams: number;
  quality: number; remainingWork: number; cultureHours: number; cultureLevelHours: number;
  trimQualityGrams: number; processingEfficiencyGrams: number; processingQualityGrams: number; processingPaid: boolean;
  saleExactCents: number; saleRoundedCents: number;
};
/** A committed active segment. Its endpoint never changes when the client polls. */
export type KqProductionJob = {
  id: string; lotId: string; taskId: string; employeeId: string; step: Exclude<KqProductionStep, "auto">;
  startedAt: string; completesAt: string; hours: number; work: number;
  skillLevel: number; trait?: KqStaffTrait; efficiency: number; qualityDelta: number;
  equivalentGrams: number; priceCentsPerGram: number;
};
export type KqProductionEvent = {
  id: string; at: string; type: "cost" | "sale"; lotId: string; taskId: string; employeeId: string;
  /** Cost debit or gross sale receipt. Sale net is amountCents minus vatCents. */
  amountCents: number; vatCents: number; grams: number;
};
export type KqProductionEffect = { kind: "production"; event: KqProductionEvent };
export type KqStaffProductionState = {
  version: 1; settings: KqProductionSettings; facility: KqProductionFacility | null;
  lots: KqProductionLot[]; jobs: KqProductionJob[]; advancedAt: string; nextId: number;
  budget: { day: number; spentCents: number }; demand: { day: number; reservedGrams: number };
  stats: { startedAt: string; cycles: number; harvestedGrams: number; trimmedGrams: number;
    processedInputGrams: number; producedGrams: number; soldGrams: number; soldEquivalentGrams: number;
    costCents: number; salesCents: number; vatCents: number; workedHours: number; salaryCostCents: number };
};
