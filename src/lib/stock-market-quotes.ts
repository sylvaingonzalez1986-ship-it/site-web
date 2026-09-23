import "server-only";
import { getKqStockInstrument, isRecord, KQ_STOCK_MAX_BATCH, KQ_STOCK_OPEN_QUOTE_AGE_MS, KQ_STOCK_CLOSED_QUOTE_AGE_MS } from "./kanab-quest-stocks";

export type KqStockProviderQuote = { id: string; currency: "EUR" | "USD"; priceNative: string; changePercent: number | null; quotedAt: string; marketState: "open" | "closed"; fxRate: string; fxQuotedAt: string | null };
/** Expand provider numeric notation without using floats for game-money execution. */
export function stockPriceDecimal(value: unknown): string {
 if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 1e19) throw new Error("[stocks] invalid price");
 const [coefficient, power = "0"] = String(value).toLowerCase().split("e");
 const [whole, fraction = ""] = coefficient.split(".");
 const digits = whole + fraction, offset = whole.length + Number(power);
 const expanded = offset <= 0 ? `0.${"0".repeat(-offset)}${digits}` : offset >= digits.length ? digits + "0".repeat(offset - digits.length) : `${digits.slice(0, offset)}.${digits.slice(offset)}`;
 const [integer, decimals = ""] = expanded.split(".");
 const result = decimals ? `${integer}.${decimals.slice(0, 18)}` : integer;
 if (!/[1-9]/.test(result)) throw new Error("[stocks] price below precision");
 return result;
}
function stamp(value: unknown, now: number, maxAge: number): string {
 if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("[stocks] missing timestamp");
 const millis = value * 1000;
 if (!Number.isSafeInteger(millis) || now - millis < -60_000 || now - millis >= maxAge) throw new Error("[stocks] stale quote");
 return new Date(millis).toISOString();
}
function state(meta: Record<string, unknown>, now: number): "open" | "closed" {
 const regular = isRecord(meta.currentTradingPeriod) ? meta.currentTradingPeriod.regular : undefined;
 if (!isRecord(regular) || typeof regular.start !== "number" || typeof regular.end !== "number" || !Number.isFinite(regular.start) || !Number.isFinite(regular.end)
  || regular.end <= regular.start || regular.end - regular.start > 86400) throw new Error("[stocks] invalid market session");
 return now >= regular.start * 1000 && now < regular.end * 1000 ? "open" : "closed";
}
export function parseYahooStockQuotes(body: unknown, ids: string[], now = Date.now()): KqStockProviderQuote[] {
 const unique = [...new Set(ids)];
 if (unique.length > KQ_STOCK_MAX_BATCH || unique.some(id => !getKqStockInstrument(id))) throw new Error("[stocks] invalid symbols");
 if (!isRecord(body) || !isRecord(body.spark) || body.spark.error || !Array.isArray(body.spark.result)) throw new Error("[stocks] invalid provider response");
 const needsFx = unique.some(id => getKqStockInstrument(id)!.currency === "USD");
 const allowed = new Set([...unique, ...(needsFx ? ["EURUSD=X"] : [])]);
 const metadata = new Map<string, Record<string, unknown>>();
 for (const row of body.spark.result) {
  if (!isRecord(row) || typeof row.symbol !== "string" || !allowed.has(row.symbol) || metadata.has(row.symbol)) throw new Error("[stocks] unexpected symbol");
  const response = Array.isArray(row.response) ? row.response[0] : undefined;
  if (!isRecord(response) || !isRecord(response.meta) || response.meta.symbol !== row.symbol) continue;
  metadata.set(row.symbol, response.meta);
 }
 let fxRate: string | null = null, fxQuotedAt: string | null = null;
 if (needsFx) {
  const fx = metadata.get("EURUSD=X");
  try {
   if (!fx || fx.currency !== "USD" || fx.instrumentType !== "CURRENCY") throw new Error("[stocks] missing FX");
   fxRate = stockPriceDecimal(fx.regularMarketPrice);
   fxQuotedAt = stamp(fx.regularMarketTime, now, KQ_STOCK_CLOSED_QUOTE_AGE_MS);
  } catch { /* A failed FX quote suspends USD symbols only; EUR quotes can still be published. */ }
 }
 return unique.flatMap(id => {
  const instrument = getKqStockInstrument(id)!, meta = metadata.get(id);
  try {
   if (!meta || meta.currency !== instrument.currency || meta.instrumentType !== (instrument.kind === "index" ? "INDEX" : "EQUITY")) throw new Error("[stocks] mismatched instrument");
   if (instrument.currency === "USD" && (!fxRate || !fxQuotedAt)) throw new Error("[stocks] missing FX");
   const marketState = state(meta, now), priceNative = stockPriceDecimal(meta.regularMarketPrice);
   if (instrument.currency === "USD" && marketState === "open" && now - Date.parse(fxQuotedAt!) >= KQ_STOCK_OPEN_QUOTE_AGE_MS) throw new Error("[stocks] stale FX");
   const quotedAt = stamp(meta.regularMarketTime, now, marketState === "open" ? KQ_STOCK_OPEN_QUOTE_AGE_MS : KQ_STOCK_CLOSED_QUOTE_AGE_MS);
   const previous = meta.chartPreviousClose ?? meta.previousClose;
   const change = typeof meta.regularMarketChangePercent === "number" ? meta.regularMarketChangePercent
    : typeof previous === "number" && previous > 0 ? (Number(priceNative) / previous - 1) * 100 : null;
   return [{ id, currency: instrument.currency, priceNative, changePercent: typeof change === "number" && Number.isFinite(change) ? change : null,
    quotedAt, marketState, fxRate: instrument.currency === "USD" ? fxRate! : "1", fxQuotedAt: instrument.currency === "USD" ? fxQuotedAt : null }];
  } catch { return []; }
 });
}
export async function fetchKqStockQuotes(ids: string[]): Promise<KqStockProviderQuote[]> {
 const unique = [...new Set(ids)];
 if (!unique.length) return [];
 if (unique.length > KQ_STOCK_MAX_BATCH || unique.some(id => !getKqStockInstrument(id))) throw new Error("[stocks] invalid symbols");
 const symbols = [...unique, ...(unique.some(id => getKqStockInstrument(id)!.currency === "USD") ? ["EURUSD=X"] : [])];
 const url = new URL("https://query1.finance.yahoo.com/v7/finance/spark");
 url.search = new URLSearchParams({ symbols: symbols.join(","), range: "1d", interval: "1m" }).toString();
 const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
 if (!response.ok) throw new Error(`[stocks] provider HTTP ${response.status}`);
 return parseYahooStockQuotes(await response.json(), unique);
}
