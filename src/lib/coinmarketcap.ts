import "server-only";
import { isKqCryptoAsset, isKqCryptoQuoteFresh, isRecord, type KqCryptoAsset } from "./kanab-quest-crypto";

export const hasCoinMarketCapKey = () => Boolean(process.env.CMC_API_KEY?.trim());
export class CoinMarketCapRequestError extends Error {
  constructor(message: string, public readonly kind: "rate_limited" | "provider_unavailable" | "invalid_quotes", public readonly retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "CoinMarketCapRequestError";
  }
}

function retryAfterSeconds(value: string | null, now: number): number | null {
  if (!value?.trim()) return null;
  const header = value.trim();
  if (/^\d+$/.test(header)) {
    const seconds = Number(header);
    return Number.isFinite(seconds) ? Math.min(604_800, seconds) : null;
  }
  // Reject loose Date.parse inputs such as negative numbers and fractional seconds.
  if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(header)) return null;
  const timestamp = Date.parse(header);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toUTCString() !== header) return null;
  return Math.min(604_800, Math.max(0, Math.ceil((timestamp - now) / 1000)));
}
/** Expand provider numeric notation; cash/quantity calculations never use JS floats. */
export function cmcPriceDecimal(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 1e19) throw new Error("[cmc] invalid price");
  const [coefficient, power = "0"] = String(value).toLowerCase().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = whole + fraction;
  const offset = whole.length + Number(power);
  const expanded = offset <= 0 ? `0.${"0".repeat(-offset)}${digits}` : offset >= digits.length ? digits + "0".repeat(offset - digits.length) : `${digits.slice(0, offset)}.${digits.slice(offset)}`;
  const [integer, decimals = ""] = expanded.split(".");
  const result = decimals ? `${integer}.${decimals.slice(0, 18)}` : integer;
  if (!/[1-9]/.test(result)) throw new Error("[cmc] price below precision");
  return result;
}

export function parseCoinMarketCapAssets(body: unknown, top100: boolean, now = Date.now()): KqCryptoAsset[] {
  if (isRecord(body) && isRecord(body.status) && String(body.status.error_code) !== "0") throw new Error("[cmc] provider error");
  const rows = Array.isArray(body) ? body : isRecord(body) ? body.data : undefined;
  if (!Array.isArray(rows) || (top100 && rows.length !== 100) || rows.length > 250) throw new Error("[cmc] incomplete response");
  const seen = new Set<number>();
  const ranks = new Set<number>();
  const assets = rows.map(row => {
    if (!isRecord(row) || !Array.isArray(row.quote)) throw new Error("[cmc] invalid asset");
    const eur = row.quote.find(q => isRecord(q) && q.symbol === "EUR");
    if (!isRecord(eur)) throw new Error("[cmc] missing EUR quote");
    const asset = { id: row.id, rank: row.cmc_rank ?? null, name: row.name, symbol: row.symbol, priceEur: cmcPriceDecimal(eur.price), change24h: eur.percent_change_24h ?? null, quotedAt: eur.last_updated, inTop100: top100 };
    if (top100 && (typeof asset.rank !== "number" || !Number.isSafeInteger(asset.rank) || asset.rank < 1 || asset.rank > 100)) throw new Error("[cmc] invalid rank");
    if (!isKqCryptoAsset(asset)) throw new Error("[cmc] invalid asset");
    if (seen.has(asset.id)) throw new Error("[cmc] duplicate asset");
    // Preserve stale timestamps for display without preventing the other top-100
    // quotes from updating. Trading still checks each asset's original quote age.
    if (Date.parse(asset.quotedAt) > now + 60_000 || (!top100 && !isKqCryptoQuoteFresh(asset.quotedAt, now))) throw new Error("[cmc] stale quote");
    if (top100 && asset.rank !== null && ranks.has(asset.rank)) throw new Error("[cmc] duplicate rank");
    seen.add(asset.id);
    if (asset.rank !== null) ranks.add(asset.rank);
    return asset;
  });
  if (top100 && !assets.some(asset => isKqCryptoQuoteFresh(asset.quotedAt, now))) throw new Error("[cmc] stale quote");
  return assets;
}

async function request(path: string, parameters: Record<string, string>, top100: boolean) {
  const key = process.env.CMC_API_KEY?.trim();

  const url = new URL(`https://pro-api.coinmarketcap.com/${key ? "" : "public-api/"}v3/cryptocurrency/${path}`);
  url.search = new URLSearchParams({ ...parameters, convert: "EUR" }).toString();
  const deadline = Date.now() + (top100 ? 18_000 : 8_000);
  const maxAttempts = top100 ? 3 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let retryable = true;
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new CoinMarketCapRequestError("[cmc] request deadline exceeded", "provider_unavailable");
      const response = await fetch(url, { headers: { ...(key ? { "X-CMC_PRO_API_KEY": key } : {}), Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(Math.min(8_000, remaining)), redirect: "error" });
      if (!response.ok) {
        retryable = response.status === 408 || response.status === 429 || (response.status >= 500 && response.status <= 599);
        const retryAfter = retryAfterSeconds(response.headers?.get("retry-after") ?? null, Date.now());
        let providerCode = "";
        try {
          const body: unknown = await response.json();
          const code = isRecord(body) && isRecord(body.status) ? body.status.error_code : undefined;
          // Provider messages can contain request details: retain only a bounded numeric code.
          if ((typeof code === "number" || typeof code === "string") && /^\d{1,8}$/.test(String(code))) providerCode = ` code ${code}`;
        } catch { /* A non-JSON failure still reports its HTTP status. */ }
        throw new CoinMarketCapRequestError(`[cmc] unavailable (HTTP ${response.status}${providerCode})`, response.status === 429 ? "rate_limited" : "provider_unavailable", retryAfter);
      }
      let body: unknown;
      try { body = await response.json(); }
      catch (error) {
        if (error instanceof SyntaxError) throw new CoinMarketCapRequestError("[cmc] invalid JSON response", "invalid_quotes");
        throw error;
      }
      retryable = false;
      try { return parseCoinMarketCapAssets(body, top100); }
      catch (error) {
        const message = error instanceof Error && /^\[cmc\] [a-zA-Z0-9 :()-]+$/.test(error.message) ? error.message : "[cmc] invalid quotes";
        throw new CoinMarketCapRequestError(message, "invalid_quotes");
      }
    } catch (cause) {
      const error = cause instanceof CoinMarketCapRequestError ? cause : new CoinMarketCapRequestError("[cmc] provider request failed", "provider_unavailable");
      if (!retryable || error.kind === "invalid_quotes" || attempt + 1 === maxAttempts) throw error;
      const delay = Math.max(1_000 * 2 ** attempt, (error.retryAfterSeconds ?? 0) * 1000);
      if (delay >= deadline - Date.now()) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new CoinMarketCapRequestError("[cmc] request deadline exceeded", "provider_unavailable");
}
export const fetchCoinMarketCapTop100 = () => request("listings/latest", { start: "1", limit: "100", sort: "market_cap", sort_dir: "desc" }, true);
export async function fetchCoinMarketCapQuotes(ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  if (unique.length > 250 || unique.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error("[cmc] invalid IDs");
  const assets = await request("quotes/latest", { id: unique.join(","), skip_invalid: "true" }, false);
  if (assets.some(asset => !unique.includes(asset.id))) throw new Error("[cmc] unexpected asset");
  return assets;
}
