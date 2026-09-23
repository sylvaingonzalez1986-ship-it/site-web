/** Virtual index units and equities. Execution and FX arithmetic belong to PostgreSQL NUMERIC. */
import catalog from "./stock-market-catalog.json";
export const KQ_STOCK_MAX_ORDER_CENTS = 100_000_000;
export const KQ_STOCK_MAX_REFRESH_AGE_MS = 10 * 60 * 1000;
export const KQ_STOCK_OPEN_QUOTE_AGE_MS = 45 * 60 * 1000;
export const KQ_STOCK_CLOSED_QUOTE_AGE_MS = 96 * 60 * 60 * 1000;
export const KQ_STOCK_MAX_BATCH = 12;
export const KQ_STOCK_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const KQ_STOCK_DECIMAL = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/;
export type KqStockMarket = "cac40" | "sp500";
export type KqStockInstrument = { id: string; symbol: string; name: string; kind: "stock" | "index"; markets: KqStockMarket[]; currency: "EUR" | "USD" };
export type KqStockAsset = KqStockInstrument & {
 priceNative: string | null; priceEur: string | null; changePercent: number | null;
 quotedAt: string | null; refreshedAt: string | null; marketState: "open" | "closed" | null;
 fxRate: string | null; fxQuotedAt: string | null;
};
export type KqStockPosition = { assetId: string; quantity: string; costBasisCents: number; valueCents: number | null };
export type KqStockTrade = { orderId: string; assetId: string; side: "buy" | "sell"; quantity: string; priceEur: string; amountCents: number; costBasisCents: number; realizedPnlCents: number; cashAfterCents: number; createdAt: string };
export type KqStockOrder = { orderId: string; assetId: string; side: "buy" | "sell"; quantity: string; priceEur: string; amountCents: number; expiresAt: string; quotedAt: string };
export type KqStockSnapshot = { version: 1; serverNow: string; cashCents: number; assets: KqStockAsset[]; positions: KqStockPosition[]; recentTrades: KqStockTrade[] };
export type KqStockAction = { action: "preview"; side: "buy"; assetId: string; amountCents: number } | { action: "preview"; side: "sell"; assetId: string; quantity: string } | { action: "confirm"; orderId: string };
export const KQ_STOCK_INSTRUMENTS = catalog.instruments as KqStockInstrument[];
export const KQ_STOCK_CATALOG_DATE = catalog.asOf;
const instruments = new Map(KQ_STOCK_INSTRUMENTS.map(asset => [asset.id, asset]));
export const getKqStockInstrument = (id: string) => instruments.get(id);
export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const natural = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const decimal = (value: unknown): value is string => typeof value === "string" && KQ_STOCK_DECIMAL.test(value) && /[1-9]/.test(value);
const assetId = (value: unknown): value is string => typeof value === "string" && instruments.has(value);
export class KqStockRequestError extends Error {}
export function parseKqStockAssetIds(value: string | null): string[] {
 const ids = value === null ? ["^FCHI", "^GSPC"] : value === "" ? [] : [...new Set(value.split(","))];
 if (ids.length > KQ_STOCK_MAX_BATCH || ids.some(id => !assetId(id))) throw new KqStockRequestError("Choix boursier invalide.");
 return ids;
}
export function parseKqStockAction(value: unknown): KqStockAction {
 if (!isRecord(value)) throw new KqStockRequestError("Ordre boursier invalide.");
 if (value.action === "confirm" && typeof value.orderId === "string" && KQ_STOCK_UUID.test(value.orderId)) return { action: "confirm", orderId: value.orderId };
 if (value.action === "preview" && assetId(value.assetId)) {
  if (value.side === "buy" && natural(value.amountCents) && Number(value.amountCents) >= 100 && Number(value.amountCents) <= KQ_STOCK_MAX_ORDER_CENTS) return { action: "preview", side: "buy", assetId: value.assetId, amountCents: Number(value.amountCents) };
  if (value.side === "sell" && decimal(value.quantity)) return { action: "preview", side: "sell", assetId: value.assetId, quantity: value.quantity };
 }
 throw new KqStockRequestError("Ordre boursier invalide.");
}
export function isKqStockAsset(value: unknown): value is KqStockAsset {
 if (!isRecord(value) || !assetId(value.id)) return false;
 const instrument = instruments.get(value.id)!;
 if (value.symbol !== instrument.symbol || value.name !== instrument.name || value.kind !== instrument.kind || value.currency !== instrument.currency
  || !Array.isArray(value.markets) || value.markets.length !== instrument.markets.length || !instrument.markets.every(m => (value.markets as unknown[]).includes(m))) return false;
 if (value.priceEur === null) return value.priceNative === null && value.changePercent === null && value.quotedAt === null && value.refreshedAt === null && value.marketState === null && value.fxRate === null && value.fxQuotedAt === null;
 return decimal(value.priceEur) && decimal(value.priceNative) && date(value.quotedAt) && date(value.refreshedAt)
  && (value.changePercent === null || typeof value.changePercent === "number" && Number.isFinite(value.changePercent))
  && ["open", "closed"].includes(String(value.marketState)) && decimal(value.fxRate)
  && (value.currency === "USD" ? date(value.fxQuotedAt) : value.fxQuotedAt === null && Number(value.fxRate) === 1);
}
export function isKqStockOrder(value: unknown): value is KqStockOrder {
 return isRecord(value) && typeof value.orderId === "string" && KQ_STOCK_UUID.test(value.orderId) && assetId(value.assetId)
  && ["buy", "sell"].includes(String(value.side)) && decimal(value.quantity) && decimal(value.priceEur)
  && natural(value.amountCents) && Number(value.amountCents) > 0 && Number(value.amountCents) <= KQ_STOCK_MAX_ORDER_CENTS && date(value.expiresAt) && date(value.quotedAt);
}
export function isKqStockTrade(value: unknown): value is KqStockTrade {
 return isRecord(value) && typeof value.orderId === "string" && KQ_STOCK_UUID.test(value.orderId) && assetId(value.assetId)
  && ["buy", "sell"].includes(String(value.side)) && decimal(value.quantity) && decimal(value.priceEur)
  && natural(value.amountCents) && natural(value.costBasisCents) && typeof value.realizedPnlCents === "number"
  && Number.isSafeInteger(value.realizedPnlCents) && natural(value.cashAfterCents) && date(value.createdAt);
}
export function isKqStockSnapshot(value: unknown): value is KqStockSnapshot {
 return isRecord(value) && value.version === 1 && date(value.serverNow) && natural(value.cashCents)
  && Array.isArray(value.assets) && value.assets.every(isKqStockAsset) && new Set(value.assets.map(a => a.id)).size === value.assets.length
  && Array.isArray(value.positions) && value.positions.every(p => isRecord(p) && assetId(p.assetId) && decimal(p.quantity) && natural(p.costBasisCents) && (p.valueCents === null || natural(p.valueCents)))
  && new Set(value.positions.map(p => p.assetId)).size === value.positions.length
  && Array.isArray(value.recentTrades) && value.recentTrades.length <= 20 && value.recentTrades.every(isKqStockTrade);
}
const fresh = (stamp: string | null, now: number, max: number) => stamp !== null && Number.isFinite(Date.parse(stamp)) && now - Date.parse(stamp) >= -60_000 && now - Date.parse(stamp) < max;
export function canTradeKqStockAsset(asset: KqStockAsset, now: number): boolean {
 return asset.priceEur !== null && fresh(asset.refreshedAt, now, KQ_STOCK_MAX_REFRESH_AGE_MS)
  && fresh(asset.quotedAt, now, asset.marketState === "open" ? KQ_STOCK_OPEN_QUOTE_AGE_MS : KQ_STOCK_CLOSED_QUOTE_AGE_MS)
  && (asset.currency === "EUR" || fresh(asset.fxQuotedAt, now, asset.marketState === "open" ? KQ_STOCK_OPEN_QUOTE_AGE_MS : KQ_STOCK_CLOSED_QUOTE_AGE_MS));
}
export function parseKqStockEuros(input: string): number | null {
 const match = /^(0|[1-9]\d{0,6}|[1-9]\d{0,2}(?:[ \u00a0\u202f]\d{3}){1,2})(?:[.,](\d{1,2}))?$/.exec(input.trim());
 if (!match) return null;
 const cents = Number(match[1].replace(/[ \u00a0\u202f]/g, "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
 return cents >= 100 && cents <= KQ_STOCK_MAX_ORDER_CENTS ? cents : null;
}
export function formatKqStockQuantity(value: string) {
 return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "").replace(".", ",") : value;
}
