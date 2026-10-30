import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { KQ_MARKET_ROUTE_CODES, type KqMarketRouteCode } from "../kanab-quest-market";
import { KQ_MERCH_PRODUCTS } from "../kanab-quest-merch";
import type { KqOnlineSalesPage, KqOnlineSalesReceipt } from "../kanab-quest-online-sales";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
type SalesCursor = { soldAt: string; source: "flower" | "merch"; id: string };
export type KqOnlineSalesQuery = { limit: number; cursor: SalesCursor | null };

export class KqOnlineSalesQueryError extends Error {
  constructor() { super("Page du journal des ventes invalide."); }
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown): value is string => {
  if (typeof value !== "string" || !TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return year > 0 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};
const validCursor = (value: unknown): value is SalesCursor & Record<string, unknown> => record(value) && timestamp(value.soldAt)
  && (value.source === "flower" || value.source === "merch") && typeof value.id === "string" && UUID.test(value.id);

export function parseKqOnlineSalesQuery(parameters: URLSearchParams): KqOnlineSalesQuery {
  const limit = parameters.get("limit") ?? "50";
  if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) throw new KqOnlineSalesQueryError();
  const encoded = parameters.get("cursor");
  if (encoded === null) return { limit: Number(limit), cursor: null };
  if (encoded.length > 512 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new KqOnlineSalesQueryError();
  try {
    const value: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!record(value) || value.version !== 1 || !validCursor(value)) throw new KqOnlineSalesQueryError();
    return { limit: Number(limit), cursor: { soldAt: value.soldAt, source: value.source, id: value.id } };
  } catch { throw new KqOnlineSalesQueryError(); }
}

function malformed(): never { throw new Error("[supabase:online-sales] Incomplete sales history response."); }

function receipt(value: unknown): KqOnlineSalesReceipt {
  if (!validCursor(value) || !record(value) || !count(value.quantity) || value.quantity < 1
    || !count(value.revenueCents) || !count(value.netPayoutCents) || !count(value.feesCents)) return malformed();
  const shared = {
    id: `${value.source}:${value.id}`, soldAt: value.soldAt, quantity: value.quantity,
    revenueCents: value.revenueCents, netPayoutCents: value.netPayoutCents, feesCents: value.feesCents,
  };
  if (value.source === "flower") {
    if (typeof value.name !== "string" || !value.name.trim() || (value.formatGrams !== 5 && value.formatGrams !== 10)
      || typeof value.satisfaction !== "number" || !Number.isFinite(value.satisfaction) || value.satisfaction < 0 || value.satisfaction > 100
      || typeof value.route !== "string" || !KQ_MARKET_ROUTE_CODES.includes(value.route as KqMarketRouteCode)
      || value.costCents !== null) return malformed();
    return { ...shared, kind: "flower", name: value.name, unitLabel: "paquets", formatGrams: value.formatGrams,
      route: value.route as KqMarketRouteCode, costCents: null, satisfaction: value.satisfaction };
  }
  const product = KQ_MERCH_PRODUCTS.find(item => item.code === value.code);
  if (!product || !count(value.costCents) || value.formatGrams !== null || value.satisfaction !== null) return malformed();
  return { ...shared, kind: "merch", name: product.name, code: product.code, unitLabel: "articles",
    formatGrams: null, costCents: value.costCents, satisfaction: null };
}

export async function getKqOnlineSalesHistory(userId: string, query: KqOnlineSalesQuery): Promise<KqOnlineSalesPage> {
  if (!UUID.test(userId) || !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 100
    || (query.cursor !== null && !validCursor(query.cursor))) throw new KqOnlineSalesQueryError();
  const result = await createSupabaseServiceClient().rpc("rpc_kq_online_sales_history", {
    p_user_id: userId, p_limit: query.limit, p_before_at: query.cursor?.soldAt ?? null,
    p_before_source: query.cursor?.source ?? null, p_before_id: query.cursor?.id ?? null,
  });
  if (result.error) throw new Error(`[supabase:online-sales] ${result.error.message}`);
  const data: unknown = result.data;
  if (!record(data) || data.version !== 1 || !Array.isArray(data.sales) || data.sales.length > query.limit
    || (data.nextCursor !== null && !validCursor(data.nextCursor))) return malformed();
  const receipts = data.sales.map(receipt);
  if (new Set(receipts.map(item => item.id)).size !== receipts.length) return malformed();
  if (data.nextCursor === null) return { receipts, nextCursor: null };
  const last = data.sales.at(-1);
  if (receipts.length !== query.limit || !validCursor(last) || last.id !== data.nextCursor.id
    || last.source !== data.nextCursor.source || last.soldAt !== data.nextCursor.soldAt) return malformed();
  // Keep PostgreSQL's timestamp precision: converting through Date would lose
  // microseconds and could skip receipts at the page boundary.
  const nextCursor = Buffer.from(JSON.stringify({ version: 1, soldAt: data.nextCursor.soldAt,
    source: data.nextCursor.source, id: data.nextCursor.id })).toString("base64url");
  return { receipts, nextCursor };
}
