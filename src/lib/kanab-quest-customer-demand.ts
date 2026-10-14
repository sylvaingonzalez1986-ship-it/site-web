import { getKqBuddieFlavors, type KqFlavorCode } from "./kanab-quest-buddie-flavors";

/** Virtual indoor-flower prices and periodic requests. Mirrored by kq_customer_demand_* SQL. */
export const KQ_CUSTOMER_DEMAND_PERIOD_MS = 72 * 60 * 60 * 1000;
export const KQ_CUSTOMER_DEMAND_PREVIEW_MS = 24 * 60 * 60 * 1000;
export const KQ_CUSTOMER_DEMAND_CHANNELS = ["online", "cbd-shop", "wholesale"] as const;
export type KqCustomerDemandChannel = typeof KQ_CUSTOMER_DEMAND_CHANNELS[number];
export const KQ_INDOOR_SHOP_CENTS_PER_GRAM = 300;
export const KQ_INDOOR_WHOLESALE_CENTS_PER_GRAM = 210;

export type KqCustomerDemandRequest = {
  id: string;
  period: number;
  channel: KqCustomerDemandChannel;
  varietyCode: string;
  flavorCodes: readonly [KqFlavorCode, KqFlavorCode];
  /** Maximum premium, awarded when both requested aromas match. */
  bonusPercent: number;
  minimumQuality: number;
  /** All demand quantities use the same decigram unit as commerce stocks. */
  capacityUnits: number;
  remainingUnits: number;
};
export type KqCustomerDemandSnapshot = {
  version: 1;
  serverNow: string;
  period: number;
  startsAt: string;
  endsAt: string;
  requests: KqCustomerDemandRequest[];
  upcoming: KqCustomerDemandRequest[];
};
export type KqAppliedCustomerDemand = Pick<KqCustomerDemandRequest, "id" | "period" | "bonusPercent"> & {
  /** Actual quantity paid with the bonus; never the whole lot by default. */
  units: number;
  matchedFlavorCount: 1 | 2;
};
export type KqMatchedCustomerDemand = KqCustomerDemandRequest & { matchedFlavorCount: 1 | 2 };

const positiveMod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const bounded = (value: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

export function getKqCustomerDemandPeriod(nowMs: number) {
  if (!Number.isFinite(nowMs)) throw new Error("Date du marché invalide.");
  return Math.floor(nowMs / KQ_CUSTOMER_DEMAND_PERIOD_MS);
}

/** A shared calendar, with a separate consumed allowance for each player. */
export function getKqCustomerDemandRequest(period: number, channel: KqCustomerDemandChannel, consumedUnits = 0): KqCustomerDemandRequest {
  if (!Number.isSafeInteger(period)) throw new Error("Période du marché invalide.");
  const index = KQ_CUSTOMER_DEMAND_CHANNELS.indexOf(channel);
  if (index < 0) throw new Error("Circuit de vente inconnu.");
  const capacityUnits = [300, 2000, 5000][index];
  const varietyCode = `HH2026-${String(2 + positiveMod(positiveMod(period, 51) * 7 + index * 17, 51)).padStart(3, "0")}`;
  const flavors = getKqBuddieFlavors(varietyCode);
  return {
    id: `${period}:${channel}`, period, channel,
    // This cultivar seeds the profile; every cultivar with matching aromas is eligible.
    varietyCode,
    flavorCodes: [flavors[0]!.code as KqFlavorCode, flavors[1]!.code as KqFlavorCode],
    bonusPercent: [10, 15, 20, 25][positiveMod(period + index, 4)],
    minimumQuality: [8, 7.5, 7][index],
    capacityUnits,
    remainingUnits: capacityUnits - bounded(Math.floor(consumedUnits), 0, capacityUnits),
  };
}

/** Used by isolated previews/tests. Production snapshots are settled by the server. */
export function createKqCustomerDemandSnapshot(nowMs: number, consumed: Partial<Record<KqCustomerDemandChannel, number>> = {}): KqCustomerDemandSnapshot {
  const period = getKqCustomerDemandPeriod(nowMs);
  const end = (period + 1) * KQ_CUSTOMER_DEMAND_PERIOD_MS;
  return {
    version: 1, serverNow: new Date(nowMs).toISOString(), period,
    startsAt: new Date(period * KQ_CUSTOMER_DEMAND_PERIOD_MS).toISOString(), endsAt: new Date(end).toISOString(),
    requests: KQ_CUSTOMER_DEMAND_CHANNELS.map(channel => getKqCustomerDemandRequest(period, channel, consumed[channel] ?? 0)),
    upcoming: end - nowMs <= KQ_CUSTOMER_DEMAND_PREVIEW_MS
      ? KQ_CUSTOMER_DEMAND_CHANNELS.map(channel => getKqCustomerDemandRequest(period + 1, channel)) : [],
  };
}

export function getKqCustomerDemandFlavorMatch(request: KqCustomerDemandRequest, varietyCode: string | undefined) {
  const requested = new Set<string>(request.flavorCodes);
  const flavors = varietyCode ? getKqBuddieFlavors(varietyCode) : [];
  const matchedFlavorCount = Math.min(2, new Set(flavors.filter(flavor => requested.has(flavor.code)).map(flavor => flavor.code)).size) as 0 | 1 | 2;
  return { matchedFlavorCount, bonusPercent: request.bonusPercent * matchedFlavorCount / 2 };
}

export function getKqActiveCustomerDemand(
  snapshot: KqCustomerDemandSnapshot | undefined,
  channel: KqCustomerDemandChannel,
  varietyCode: string | undefined,
  quality: number,
  nowMs?: number,
): KqMatchedCustomerDemand | null {
  if (!snapshot || snapshot.version !== 1 || !varietyCode || !Number.isFinite(quality)) return null;
  const now = nowMs ?? Date.parse(snapshot.serverNow);
  const start = Date.parse(snapshot.startsAt), end = Date.parse(snapshot.endsAt);
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end) || now < start || now >= end) return null;
  const request = snapshot.requests.find(request => request.period === snapshot.period && request.channel === channel
    && request.minimumQuality <= quality && request.remainingUnits > 0);
  if (!request) return null;
  const match = getKqCustomerDemandFlavorMatch(request, varietyCode);
  return match.matchedFlavorCount > 0 ? { ...request, ...match, matchedFlavorCount: match.matchedFlavorCount as 1 | 2 } : null;
}

/** Suggested retail price, already including packaging in the displayed packet price. */
export function getKqOnlineFlowerReferenceCents(quality: number) {
  return quality >= 9.5 ? 1000 : quality >= 8.5 ? 800 : 700;
}

/** Only the matching quantity receives the premium. The rest sells at the usual price. */
export function getKqCustomerDemandPrice(baseUnitCents: number, units: number, request: KqMatchedCustomerDemand | null) {
  const safeUnits = Math.max(0, Math.floor(Number.isFinite(units) ? units : 0));
  const bonusUnits = request ? Math.min(safeUnits, Math.max(0, Math.floor(request.remainingUnits))) : 0;
  const baseMicros = BigInt(Math.round(baseUnitCents * 1e6));
  // PostgreSQL NUMERIC rounds exact halves up. Binary floating point can fall
  // just below a half and invalidate an otherwise legitimate partial-quota quote.
  const denominator = BigInt(safeUnits) * BigInt(10000);
  const numerator = baseMicros * BigInt(bonusUnits) * BigInt(Math.round((request?.bonusPercent ?? 0) * 100));
  const bonusMicros = denominator > BigInt(0) ? (numerator + denominator / BigInt(2)) / denominator : BigInt(0);
  const unitCents = Number(baseMicros + bonusMicros) / 1e6;
  return {
    unitCents,
    customerDemand: request && bonusUnits > 0 ? {
      id: request.id, period: request.period, bonusPercent: request.bonusPercent, units: bonusUnits, matchedFlavorCount: request.matchedFlavorCount,
    } satisfies KqAppliedCustomerDemand : undefined,
  };
}
