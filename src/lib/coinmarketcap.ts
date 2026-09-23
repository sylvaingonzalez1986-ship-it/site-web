import "server-only";
import { isKqCryptoAsset, isKqCryptoQuoteFresh, isRecord, type KqCryptoAsset } from "./kanab-quest-crypto";

export const hasCoinMarketCapKey = () => Boolean(process.env.CMC_API_KEY?.trim());
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
  return rows.map(row => {
    if (!isRecord(row) || !Array.isArray(row.quote)) throw new Error("[cmc] invalid asset");
    const eur = row.quote.find(q => isRecord(q) && q.symbol === "EUR");
    if (!isRecord(eur)) throw new Error("[cmc] missing EUR quote");
    const asset = { id: row.id, rank: row.cmc_rank ?? null, name: row.name, symbol: row.symbol, priceEur: cmcPriceDecimal(eur.price), change24h: eur.percent_change_24h ?? null, quotedAt: eur.last_updated, inTop100: top100 };
    if (!isKqCryptoAsset(asset) || seen.has(asset.id) || !isKqCryptoQuoteFresh(asset.quotedAt, now)
      || (top100 && (asset.rank === null || asset.rank < 1 || asset.rank > 100 || ranks.has(asset.rank)))) throw new Error("[cmc] invalid or stale quote");
    seen.add(asset.id);
    if (asset.rank !== null) ranks.add(asset.rank);
    return asset;
  });
}

async function request(path: string, parameters: Record<string, string>, top100: boolean) {
  const key = process.env.CMC_API_KEY?.trim();

  const url = new URL(`https://pro-api.coinmarketcap.com/${key ? "" : "public-api/"}v3/cryptocurrency/${path}`);
  url.search = new URLSearchParams({ ...parameters, convert: "EUR" }).toString();
  const response = await fetch(url, { headers: { ...(key ? { "X-CMC_PRO_API_KEY": key } : {}), Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8_000), redirect: "error" });
  if (!response.ok) throw new Error("[cmc] unavailable");
  return parseCoinMarketCapAssets(await response.json(), top100);
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
