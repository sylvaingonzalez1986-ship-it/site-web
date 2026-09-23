import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmcPriceDecimal, fetchCoinMarketCapQuotes, fetchCoinMarketCapTop100, parseCoinMarketCapAssets } from "./coinmarketcap";
const now=Date.parse("2026-09-23T15:00:00Z");
const coin=(id=1)=>({id,name:`Coin ${id}`,symbol:`C${id}`,cmc_rank:id,quote:[{symbol:"EUR",price:0.000001234567890123,percent_change_24h:-1.3,last_updated:"2026-09-23T14:59:00Z"}]});
const top=()=>({status:{error_code:"0"},data:Array.from({length:100},(_,i)=>coin(i+1))});
const fetchMock=vi.fn();
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);vi.stubGlobal("fetch",fetchMock);vi.stubEnv("CMC_API_KEY","");fetchMock.mockResolvedValue({ok:true,json:async()=>top()});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();});
describe("CoinMarketCap real quote adapter",()=>{
 it("uses official keyless EUR top100 without exposing a secret",async()=>{
  const assets=await fetchCoinMarketCapTop100();expect(assets).toHaveLength(100);expect(assets[0].priceEur).toBe("0.000001234567890123");
  const [url,options]=fetchMock.mock.calls[0];expect(url.hostname).toBe("pro-api.coinmarketcap.com");expect(url.pathname).toBe("/public-api/v3/cryptocurrency/listings/latest");expect(url.searchParams.get("convert")).toBe("EUR");expect(url.searchParams.get("limit")).toBe("100");expect(options.headers).not.toHaveProperty("X-CMC_PRO_API_KEY");expect(options.redirect).toBe("error");
 });
 it("prefers configured key and does not silently bypass invalid credentials",async()=>{
  vi.stubEnv("CMC_API_KEY","fixture-key");fetchMock.mockResolvedValue({ok:false});await expect(fetchCoinMarketCapTop100()).rejects.toThrow("unavailable");
  expect(fetchMock).toHaveBeenCalledTimes(1);const [url,options]=fetchMock.mock.calls[0];expect(url.pathname).toBe("/v3/cryptocurrency/listings/latest");expect(options.headers["X-CMC_PRO_API_KEY"]).toBe("fixture-key");
 });
 it("refreshes held currencies by immutable ID after leaving the top100",async()=>{
  fetchMock.mockResolvedValue({ok:true,json:async()=>[{...coin(101),cmc_rank:101}]});const result=await fetchCoinMarketCapQuotes([101]);expect(result[0].inTop100).toBe(false);
  expect(fetchMock.mock.calls[0][0].searchParams.get("id")).toBe("101");expect(fetchMock.mock.calls[0][0].searchParams.get("skip_invalid")).toBe("true");
 });
 it("fails closed on incomplete, stale, duplicate, invalid-currency and provider-error data",()=>{
  expect(()=>parseCoinMarketCapAssets({status:{error_code:0},data:[coin()]},true,now)).toThrow();
  expect(()=>parseCoinMarketCapAssets({status:{error_code:1008},data:[]},false,now)).toThrow();
  expect(()=>parseCoinMarketCapAssets([coin(),coin()],false,now)).toThrow();
  expect(()=>parseCoinMarketCapAssets([{...coin(),quote:[{...coin().quote[0],symbol:"USD"}]}],false,now)).toThrow();
  expect(()=>parseCoinMarketCapAssets([{...coin(),quote:[{...coin().quote[0],last_updated:"2026-09-23T14:00:00Z"}]}],false,now)).toThrow();
 });
 it("rejects duplicated CMC ranks even when asset IDs differ",()=>{
  const body=top();body.data[99].cmc_rank=1;expect(()=>parseCoinMarketCapAssets(body,true,now)).toThrow();
 });
 it("expands scientific notation at the supported precision and rejects zero prices",()=>{
  expect(cmcPriceDecimal(1e-18)).toBe("0.000000000000000001");expect(cmcPriceDecimal(1.23e10)).toBe("12300000000");
  for(const input of [0,-1,NaN,Infinity,1e-19,1e19,"10"])expect(()=>cmcPriceDecimal(input)).toThrow();
 });
});
