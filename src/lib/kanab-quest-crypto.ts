/** Virtual positions only. All execution maths belongs to PostgreSQL NUMERIC. */
export const KQ_CRYPTO_MAX_QUOTE_AGE_MS = 10 * 60 * 1000;
export const KQ_CRYPTO_MAX_ORDER_CENTS = 100_000_000;
export const KQ_CRYPTO_DECIMAL = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/;
export type KqCryptoAsset = { id: number; rank: number | null; name: string; symbol: string; priceEur: string; change24h: number | null; quotedAt: string; inTop100: boolean };
export type KqCryptoPosition = { assetId: number; quantity: string; costBasisCents: number; valueCents: number | null };
export type KqCryptoTrade = { orderId: string; assetId: number; side: "buy" | "sell"; quantity: string; priceEur: string; amountCents: number; costBasisCents: number; realizedPnlCents: number; cashAfterCents: number; createdAt: string };
export type KqCryptoSnapshot = { version: 1; serverNow: string; marketStatus: "live" | "stale" | "unconfigured" | "unavailable"; updatedAt: string | null; cashCents: number; assets: KqCryptoAsset[]; positions: KqCryptoPosition[]; recentTrades: KqCryptoTrade[] };
export type KqCryptoOrder = { orderId: string; assetId: number; side: "buy" | "sell"; quantity: string; priceEur: string; amountCents: number; expiresAt: string; quotedAt: string };
export type KqCryptoAction = { action: "preview"; side: "buy"; assetId: number; amountCents: number } | { action: "preview"; side: "sell"; assetId: number; quantity: string } | { action: "confirm"; orderId: string };
export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const natural = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const decimal = (value: unknown) => typeof value === "string" && KQ_CRYPTO_DECIMAL.test(value) && /[1-9]/.test(value);
export const KQ_CRYPTO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class KqCryptoRequestError extends Error {}

export function parseKqCryptoAction(value: unknown): KqCryptoAction {
  if (!isRecord(value)) throw new KqCryptoRequestError("Ordre crypto invalide.");
  if (value.action === "confirm" && typeof value.orderId === "string" && KQ_CRYPTO_UUID.test(value.orderId)) return { action: "confirm", orderId: value.orderId };
  if (value.action === "preview" && natural(value.assetId) && Number(value.assetId) > 0 && Number(value.assetId) <= 2_147_483_647) {
    if (value.side === "buy" && natural(value.amountCents) && Number(value.amountCents) >= 100 && Number(value.amountCents) <= KQ_CRYPTO_MAX_ORDER_CENTS) return { action: "preview", side: "buy", assetId: Number(value.assetId), amountCents: Number(value.amountCents) };
    if (value.side === "sell" && decimal(value.quantity)) return { action: "preview", side: "sell", assetId: Number(value.assetId), quantity: value.quantity as string };
  }
  throw new KqCryptoRequestError("Ordre crypto invalide.");
}

export function isKqCryptoAsset(value: unknown): value is KqCryptoAsset {
  return isRecord(value) && natural(value.id) && Number(value.id) > 0 && (value.rank === null || natural(value.rank))
    && typeof value.name === "string" && value.name.length > 0 && value.name.length <= 120
    && typeof value.symbol === "string" && value.symbol.length > 0 && value.symbol.length <= 30
    && decimal(value.priceEur) && (value.change24h === null || (typeof value.change24h === "number" && Number.isFinite(value.change24h)))
    && date(value.quotedAt) && typeof value.inTop100 === "boolean";
}
export function isKqCryptoOrder(value: unknown): value is KqCryptoOrder {
  return isRecord(value) && typeof value.orderId === "string" && KQ_CRYPTO_UUID.test(value.orderId) && natural(value.assetId)
    && ["buy", "sell"].includes(String(value.side)) && decimal(value.quantity) && decimal(value.priceEur)
    && natural(value.amountCents) && date(value.expiresAt) && date(value.quotedAt);
}
export function isKqCryptoTrade(value: unknown): value is KqCryptoTrade {
  return isRecord(value) && typeof value.orderId === "string" && KQ_CRYPTO_UUID.test(value.orderId) && natural(value.assetId)
    && ["buy", "sell"].includes(String(value.side)) && decimal(value.quantity) && decimal(value.priceEur)
    && natural(value.amountCents) && natural(value.costBasisCents) && typeof value.realizedPnlCents === "number"
    && Number.isSafeInteger(value.realizedPnlCents) && natural(value.cashAfterCents) && date(value.createdAt);
}
export function isKqCryptoSnapshot(value: unknown): value is KqCryptoSnapshot {
  return isRecord(value) && value.version === 1 && date(value.serverNow) && ["live", "stale", "unconfigured", "unavailable"].includes(String(value.marketStatus))
    && (value.updatedAt === null || date(value.updatedAt)) && natural(value.cashCents)
    && Array.isArray(value.assets) && value.assets.every(isKqCryptoAsset) && Array.isArray(value.positions)
    && value.positions.every(p => isRecord(p) && natural(p.assetId) && decimal(p.quantity) && natural(p.costBasisCents) && (p.valueCents === null || natural(p.valueCents)))
    && Array.isArray(value.recentTrades) && value.recentTrades.every(isKqCryptoTrade);
}
export function isKqCryptoQuoteFresh(quotedAt: string, now: number) {
  const age = now - Date.parse(quotedAt);
  return Number.isFinite(age) && age >= -60_000 && age < KQ_CRYPTO_MAX_QUOTE_AGE_MS;
}
/** Parse player euros without binary floating point multiplication. */
export function parseKqCryptoEuros(input: string): number | null {
  const match = /^(0|[1-9]\d{0,6})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents >= 100 && cents <= KQ_CRYPTO_MAX_ORDER_CENTS ? cents : null;
}

export function formatKqCryptoQuantity(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "").replace(".", ",") : value;
}
