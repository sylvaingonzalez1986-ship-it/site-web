import { getKqEquipmentAtLevel, getKqEquipmentLevel } from "@/lib/kanab-quest-equipment";

export const KQ_ENERGY_MODES = {
  eco: { name: "Éco", consumption: 0.75, harvest: 0.9, pressure: 0, label: "−25 % énergie · −10 % récolte" },
  balanced: { name: "Équilibré", consumption: 1, harvest: 1, pressure: 0, label: "Consommation et récolte normales" },
  intensive: { name: "Intensif", consumption: 1.35, harvest: 1.12, pressure: 1, label: "+35 % énergie · +12 % récolte · +1 Pression" },
} as const;
export type KqEnergyMode = keyof typeof KQ_ENERGY_MODES;
export function isKqEnergyMode(value: unknown): value is KqEnergyMode {
  return typeof value === "string" && Object.hasOwn(KQ_ENERGY_MODES, value);
}
const HOURS: Record<string, number> = { lighting: 120, air: 180, "climate-controller": 180, security: 180 };

/** Fixed equivalent operating hours, never time spent logged in or offline. */
export function quoteKqEnergy(codes: string[], levels: Record<string, number> = {}, mode: KqEnergyMode = "balanced") {
  const equipment = [...new Set(codes)].map((code) => getKqEquipmentAtLevel(code, levels[code])).filter((item) => item !== null);
  const solarPercent = Math.min(60, equipment.reduce((sum, item) => sum + (item.effects.energyDiscountPercent ?? 0), 0));
  const lines = equipment.filter((item) => HOURS[item.slot] && item.powerWatts > 0).map((item) => {
    const level = item.purchasable ? getKqEquipmentLevel(levels[item.code]) : 1;
    return { code: item.code, name: item.name, level, watts: item.powerWatts, hours: HOURS[item.slot],
      wattHours: Math.round(item.powerWatts * HOURS[item.slot] * (1 + (level - 1) / 10) * KQ_ENERGY_MODES[mode].consumption) };
  });
  const totalWattHours = lines.reduce((sum, line) => sum + line.wattHours, 0);
  const totalCents = Math.round(totalWattHours * 30 / 1000 * (1 - solarPercent / 100));
  return { version: 1 as const, mode, lines, totalWattHours, solarPercent, tariffCentsPerKwh: 30,
    totalCents, savingsCents: Math.round(totalWattHours * 30 / 1000) - totalCents };
}
export type KqEnergyQuote = ReturnType<typeof quoteKqEnergy>;

export function isKqEnergyQuoteValid(value: unknown, codes: string[], levels?: Record<string, number>): value is KqEnergyQuote {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (!isKqEnergyMode(row.mode)) return false;
  const expected = quoteKqEnergy(codes, levels, row.mode);
  return Object.entries(expected).every(([key, item]) => key === "lines"
    ? Array.isArray(row.lines) && row.lines.length === expected.lines.length && expected.lines.every((line, index) =>
      Object.entries(line).every(([field, entry]) => row.lines && (row.lines as Record<string, unknown>[])[index]?.[field] === entry))
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

export type KqEnergyInvoice = { runId: string; createdAt: string; totalCents: number; remainingCents: number; harvestGrams: number; quote: KqEnergyQuote };
export type KqEnergySummary = { outstandingCents: number; invoiceCount: number; bestGramsPerKwh: number | null; invoices: KqEnergyInvoice[] };
export type KqEnergySnapshot = KqEnergySummary & { cashCents: number; quotes: Record<KqEnergyMode, KqEnergyQuote> };
