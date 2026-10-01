import { getKqEquipmentDefinition, getKqEquipmentAtLevel, getKqEquipmentLevel } from "@/lib/kanab-quest-equipment";
import type { ChanvrierStrength } from "./arena-chanvrier";
import type { KqCultureEquipmentCondition } from "./kanab-quest-culture-wear";
import { getKqProductionUnits, type KqTentEquipmentProfile } from "./kanab-quest-production-scale";

export const KQ_ENERGY_MODES = {
  eco: { name: "Éco", consumption: 0.75, harvest: 0.9, pressure: 0, label: "−25 % énergie · −10 % récolte" },
  balanced: { name: "Équilibré", consumption: 1, harvest: 1, pressure: 0, label: "Consommation et récolte normales" },
  intensive: { name: "Intensif", consumption: 1.35, harvest: 1.12, pressure: 1, label: "+35 % énergie · +12 % récolte · +1 Pression" },
} as const;
export type KqEnergyMode = keyof typeof KQ_ENERGY_MODES;
export function isKqEnergyMode(value: unknown): value is KqEnergyMode {
  return typeof value === "string" && Object.hasOwn(KQ_ENERGY_MODES, value);
}
const HOURS: Record<string, number> = { lighting: 120, air: 180, "climate-controller": 180, security: 180, "flower-drying": 72 };

export type KqEnergyLine = { code: string; name: string; level: number; watts: number; hours: number; wattHours: number; tentNumber?: number };
export type KqEnergyQuote = { version: 1; mode: KqEnergyMode; productionUnits?: number; lines: KqEnergyLine[]; totalWattHours: number; solarPercent: number; tariffCentsPerKwh: number; totalCents: number; savingsCents: number };

/** Fixed equivalent operating hours, never time spent logged in or offline. */
export function quoteKqEnergy(codes: string[], levels: Record<string, number> = {}, mode: KqEnergyMode = "balanced", productionUnits = 1, tents?: KqTentEquipmentProfile[], scope?: "installation" | "tent"): KqEnergyQuote {
  if (tents) return quoteKqTentEnergy(tents, mode, scope);
  const units = getKqProductionUnits(productionUnits);
  const equipment = [...new Set(codes)].map((code) => getKqEquipmentAtLevel(code, levels[code])).filter((item) => item !== null);
  const solarPercent = Math.min(60, equipment.reduce((sum, item) => sum + (item.effects.energyDiscountPercent ?? 0), 0));
  const lines = equipment.filter((item) => HOURS[item.slot] && item.powerWatts > 0).map((item) => {
    const level = item.purchasable ? getKqEquipmentLevel(levels[item.code]) : 1;
    return { code: item.code, name: item.name, level, watts: item.powerWatts * units, hours: HOURS[item.slot],
      wattHours: Math.round(item.powerWatts * HOURS[item.slot] * (1 + (level - 1) / 10) * KQ_ENERGY_MODES[mode].consumption) * units };
  });
  const totalWattHours = lines.reduce((sum, line) => sum + line.wattHours, 0);
  const totalCents = Math.round(totalWattHours / units * 30 / 1000 * (1 - solarPercent / 100)) * units;
  return { version: 1 as const, mode, ...(units > 1 ? { productionUnits: units } : {}), lines, totalWattHours, solarPercent, tariffCentsPerKwh: 30,
    totalCents, savingsCents: Math.round(totalWattHours / units * 30 / 1000) * units - totalCents };
}
/** Each tent pays for its own services; historical installation invoices remain valid. */
export function quoteKqTentEnergy(tents: KqTentEquipmentProfile[], mode: KqEnergyMode = "balanced", scope?: "installation" | "tent"): KqEnergyQuote {
  const quotes = [...tents].sort((left, right) => left.tentNumber - right.tentNumber)
    .map((tent, index) => ({ tentNumber: tent.tentNumber, quote: quoteKqEnergy(
      scope === "installation" && index > 0
        ? tent.codes.filter(code => !["security", "flower-drying"].includes(getKqEquipmentDefinition(code)?.slot ?? ""))
        : tent.codes,
      tent.levels, mode,
    ) }));
  const totalWattHours = quotes.reduce((sum, { quote }) => sum + quote.totalWattHours, 0);
  const solarPercent = totalWattHours === 0 ? 0 : Math.round(quotes.reduce((sum, { quote }) => sum + quote.totalWattHours * quote.solarPercent, 0) / totalWattHours * 100) / 100;
  return {
    version: 1, mode, ...(tents.length > 1 ? { productionUnits: tents.length } : {}),
    lines: quotes.flatMap(({ tentNumber, quote }) => quote.lines.map(line => ({ ...line, tentNumber }))),
    totalWattHours, solarPercent, tariffCentsPerKwh: 30,
    totalCents: quotes.reduce((sum, { quote }) => sum + quote.totalCents, 0),
    savingsCents: quotes.reduce((sum, { quote }) => sum + quote.savingsCents, 0),
  };
}

export function isKqEnergyQuoteValid(value: unknown, codes: string[], levels?: Record<string, number>, productionUnits = 1, tents?: KqTentEquipmentProfile[], scope?: "installation" | "tent"): value is KqEnergyQuote {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (!isKqEnergyMode(row.mode)) return false;
  const expected = quoteKqEnergy(codes, levels, row.mode, productionUnits, tents, scope);
  if (row.productionUnits !== expected.productionUnits) return false;
  return Object.entries(expected).every(([key, item]) => key === "lines"
    ? Array.isArray(row.lines) && row.lines.length === expected.lines.length && expected.lines.every((line, index) =>
      Object.entries(line).every(([field, entry]) => {
        const actual = (row.lines as Record<string, unknown>[])[index]?.[field];
        // The cosmetic camera rename must not invalidate an already running culture.
        return actual === entry || (field === "name" && line.code === "SECURITY-CAMERA" && actual === "Caméra cabossée");
      }))
    : row[key] === item);
}

export function applyKqEnergyHarvest(grams: number, energy?: KqEnergyQuote) {
  if (!energy) return grams;
  return Math.round(Math.max(20, Math.min(500, grams * KQ_ENERGY_MODES[energy.mode].harvest)) * 10) / 10;
}

export function previewKqEnergyPayment(grossCents: number, outstandingCents: number) {
  const electricityPaidCents = Math.min(Math.max(0, Math.trunc(outstandingCents)), Math.floor(Math.max(0, grossCents) / 2));
  return { electricityPaidCents, netPayoutCents: grossCents - electricityPaidCents, electricityRemainingCents: Math.max(0, outstandingCents - electricityPaidCents) };
}

export type KqDogCare = { cycle: number; foodCents: number; vetCents: number; totalCents: number; paidCents: number };
export type KqDogCareSchedule = { completedCycles: number; nextCycle: number; cyclesUntilVet: number; foodCents: number; vetCents: number; nextTotalCents: number };
export function quoteKqDogCare(completedCycles: number): KqDogCareSchedule {
  const cycles = Number.isSafeInteger(completedCycles) && completedCycles >= 0 ? completedCycles : 0;
  const cyclesUntilVet = 10 - cycles % 10;
  return { completedCycles: cycles, nextCycle: cycles + 1, cyclesUntilVet, foodCents: 800, vetCents: 4000, nextTotalCents: 800 + (cyclesUntilVet === 1 ? 4000 : 0) };
}
export type KqEnergyInvoice = { runId: string; createdAt: string; totalCents: number; remainingCents: number; harvestGrams: number; quote: KqEnergyQuote; dogCare?: KqDogCare | null };
export type KqEnergySummary = { outstandingCents: number; invoiceCount: number; bestGramsPerKwh: number | null; invoices: KqEnergyInvoice[]; dogCare?: KqDogCareSchedule | null };
export type KqEnergySnapshot = KqEnergySummary & { tents?: Array<{ tentNumber: number; equippedCodes: string[]; levels: Record<string, number>; cultureWear: Record<string, KqCultureEquipmentCondition>; cultureOperationalCodes: string[] }>; productionUnits?: number; cashCents: number; quotes: Record<KqEnergyMode, KqEnergyQuote>; chanvrierStrength?: ChanvrierStrength | null; maintenanceDueNext?: string[]; cultureWear?: Record<string, KqCultureEquipmentCondition>; cultureEquipmentCodes?: string[]; cultureOperationalCodes?: string[] };
