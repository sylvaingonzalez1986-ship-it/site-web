import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoinMarketCapRequestError, cmcPriceDecimal, fetchCoinMarketCapQuotes, fetchCoinMarketCapTop100, parseCoinMarketCapAssets } from "./coinmarketcap";
const now=Date.parse("2026-09-23T15:00:00Z");
const coin=(id=1)=>({id,name:`Coin ${id}`,symbol:`C${id}`,cmc_rank:id,quote:[{symbol:"EUR",price:0.000001234567890123,percent_change_24h:-1.3,last_updated:"2026-09-23T14:59:00Z"}]});
const top=()=>({status:{error_code:"0"},data:Array.from({length:100},(_,i)=>coin(i+1))});
const fetchMock=vi.fn();
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);vi.stubGlobal("fetch",fetchMock);vi.stubEnv("CMC_API_KEY","");fetchMock.mockResolvedValue({ok:true,json:async()=>top()});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();vi.clearAllMocks();});
describe("CoinMarketCap real quote adapter",()=>{
 it("uses official keyless EUR top100 without exposing a secret",async()=>{
  const assets=await fetchCoinMarketCapTop100();expect(assets).toHaveLength(100);expect(assets[0].priceEur).toBe("0.000001234567890123");
  const [url,options]=fetchMock.mock.calls[0];expect(url.hostname).toBe("pro-api.coinmarketcap.com");expect(url.pathname).toBe("/public-api/v3/cryptocurrency/listings/latest");expect(url.searchParams.get("convert")).toBe("EUR");expect(url.searchParams.get("limit")).toBe("100");expect(options.headers).not.toHaveProperty("X-CMC_PRO_API_KEY");expect(options.redirect).toBe("error");
 });
 it("prefers configured key and does not silently bypass invalid credentials",async()=>{
  vi.stubEnv("CMC_API_KEY","fixture-key");fetchMock.mockResolvedValue({ok:false,status:401,json:async()=>({status:{error_code:1001}})});await expect(fetchCoinMarketCapTop100()).rejects.toThrow("[cmc] unavailable (HTTP 401 code 1001)");
  expect(fetchMock).toHaveBeenCalledTimes(1);const [url,options]=fetchMock.mock.calls[0];expect(url.pathname).toBe("/v3/cryptocurrency/listings/latest");expect(options.headers["X-CMC_PRO_API_KEY"]).toBe("fixture-key");
 });
 it.each([1022,"1022"])("reports the numeric provider code %s without exposing its error message",async code=>{
  vi.stubEnv("CMC_API_KEY","private-test-key");
  fetchMock.mockResolvedValue({ok:false,status:429,headers:new Headers({"Retry-After":"120"}),json:async()=>({status:{error_code:code,error_message:"Rejected private-test-key at https://provider/?secret=private-token"}})});
  const error: unknown = await fetchCoinMarketCapTop100().catch(error=>error);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe("[cmc] unavailable (HTTP 429 code 1022)");
  expect((error as Error).message).toMatch(/^\[cmc\] [a-zA-Z0-9 :()-]+$/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it("discards untrusted provider codes and keeps non-JSON failures diagnostic",async()=>{
  for(const code of ["private-token", "1022 secret", "123456789", -1, 1.5, null, {secret:"private-token"}]) {
   fetchMock.mockResolvedValue({ok:false,status:429,headers:new Headers({"Retry-After":"120"}),json:async()=>({status:{error_code:code,error_message:"private-token"}})});
   await expect(fetchCoinMarketCapTop100()).rejects.toMatchObject({message:"[cmc] unavailable (HTTP 429)"});
  }
  fetchMock.mockResolvedValue({ok:false,status:503,json:async()=>{throw new Error("private-token in HTML");}});
  await expect(fetchCoinMarketCapQuotes([1])).rejects.toMatchObject({message:"[cmc] unavailable (HTTP 503)"});
 });
 it("recovers from a transient HTTP error and network failure with one- then two-second waits",async()=>{
  fetchMock.mockResolvedValueOnce({ok:false,status:503,json:async()=>({})}).mockRejectedValueOnce(new TypeError("network private-token"));
  const pending=fetchCoinMarketCapTop100();
  await vi.advanceTimersByTimeAsync(999);expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1999);expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);expect(await pending).toHaveLength(100);expect(fetchMock).toHaveBeenCalledTimes(3);
 });
 it("honours a short Retry-After before retrying the same keyless endpoint",async()=>{
  fetchMock.mockResolvedValueOnce({ok:false,status:429,headers:new Headers({"Retry-After":"5"}),json:async()=>({status:{error_code:1022}})});
  const pending=fetchCoinMarketCapTop100();
  await vi.advanceTimersByTimeAsync(4999);expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);expect(await pending).toHaveLength(100);
  expect(fetchMock).toHaveBeenCalledTimes(2);expect(fetchMock.mock.calls[1][0].href).toBe(fetchMock.mock.calls[0][0].href);
 });
 it.each([["120",120],[new Date(now+120000).toUTCString(),120],["9999999",604800]])("defers a Retry-After of %s that cannot fit the request deadline",async(header,seconds)=>{
  fetchMock.mockResolvedValue({ok:false,status:429,headers:new Headers({"Retry-After":String(header)}),json:async()=>({status:{error_code:1022}})});
  const error:unknown=await fetchCoinMarketCapTop100().catch(error=>error);
  expect(error).toBeInstanceOf(CoinMarketCapRequestError);
  expect(error).toMatchObject({kind:"rate_limited",retryAfterSeconds:seconds});
  expect(fetchMock).toHaveBeenCalledTimes(1);expect(Date.now()).toBe(now);
 });
 it.each(["private-token","-1","1.5","Wed, 99 Sep 2026 15:00:00 GMT","Thu, 31 Sep 2026 15:00:00 GMT"])("treats invalid Retry-After %s as absent",async header=>{
  fetchMock.mockResolvedValue({ok:false,status:429,headers:new Headers({"Retry-After":header}),json:async()=>({})});
  const error:unknown=await fetchCoinMarketCapQuotes([1]).catch(error=>error);
  expect(error).toMatchObject({kind:"rate_limited",retryAfterSeconds:null});expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it("bounds network retries and their timeouts to eighteen seconds overall",async()=>{
  const timeout=vi.spyOn(AbortSignal,"timeout").mockImplementation(milliseconds=>{
   const controller=new AbortController();setTimeout(()=>controller.abort(new DOMException("Timeout","TimeoutError")),milliseconds);return controller.signal;
  });
  fetchMock.mockRejectedValueOnce(new TypeError("network private-token"));
  fetchMock.mockImplementation((_url:unknown,options:{signal:AbortSignal})=>new Promise((_resolve,reject)=>{
   options.signal.addEventListener("abort",()=>reject(options.signal.reason),{once:true});
  }));
  const pending=fetchCoinMarketCapTop100().catch(error=>({error,endedAt:Date.now()}));
  await vi.advanceTimersByTimeAsync(18000);const result=await pending;
  expect(result).toMatchObject({endedAt:now+18000,error:{kind:"provider_unavailable",retryAfterSeconds:null,message:"[cmc] provider request failed"}});
  expect(fetchMock).toHaveBeenCalledTimes(3);expect(timeout.mock.calls.map(([milliseconds])=>milliseconds)).toEqual([8000,8000,7000]);
 });
 it.each([400,401,403])("does not retry authentication or request failure HTTP %s",async status=>{
  fetchMock.mockResolvedValue({ok:false,status,json:async()=>({})});
  await expect(fetchCoinMarketCapTop100()).rejects.toMatchObject({kind:"provider_unavailable"});expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it("types invalid quote data without retrying or exposing rejected fields",async()=>{
  fetchMock.mockResolvedValue({ok:true,json:async()=>({...top(),data:top().data.map((asset,i)=>i===0?{...asset,id:"private-token"}:asset)})});
  await expect(fetchCoinMarketCapTop100()).rejects.toMatchObject({kind:"invalid_quotes",retryAfterSeconds:null,message:"[cmc] invalid asset"});
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it("makes only one bounded attempt for held-asset quotes",async()=>{
  const timeout=vi.spyOn(AbortSignal,"timeout");fetchMock.mockRejectedValue(new TypeError("network private-token"));
  await expect(fetchCoinMarketCapQuotes([101])).rejects.toMatchObject({kind:"provider_unavailable",message:"[cmc] provider request failed"});
  expect(fetchMock).toHaveBeenCalledTimes(1);expect(timeout).toHaveBeenCalledExactlyOnceWith(8000);
 });
 it("refreshes held currencies by immutable ID after leaving the top100",async()=>{
  fetchMock.mockResolvedValue({ok:true,json:async()=>[{...coin(101),cmc_rank:101}]});const result=await fetchCoinMarketCapQuotes([101]);expect(result[0].inTop100).toBe(false);
  expect(fetchMock.mock.calls[0][0].searchParams.get("id")).toBe("101");expect(fetchMock.mock.calls[0][0].searchParams.get("skip_invalid")).toBe("true");
 });
 it("fails closed on incomplete, stale, duplicate, invalid-currency and provider-error data",()=>{
  expect(()=>parseCoinMarketCapAssets({status:{error_code:0},data:[coin()]},true,now)).toThrow();
  expect(()=>parseCoinMarketCapAssets({status:{error_code:1008},data:[]},false,now)).toThrow();
  expect(()=>parseCoinMarketCapAssets([coin(),coin()],false,now)).toThrow("[cmc] duplicate asset");
  expect(()=>parseCoinMarketCapAssets([{...coin(),quote:[{...coin().quote[0],symbol:"USD"}]}],false,now)).toThrow();
  expect(()=>parseCoinMarketCapAssets([{...coin(),quote:[{...coin().quote[0],last_updated:"2026-09-23T14:00:00Z"}]}],false,now)).toThrow("[cmc] stale quote");
 });
 it("rejects duplicated CMC ranks even when asset IDs differ",()=>{
  const body=top();body.data[99].cmc_rank=1;expect(()=>parseCoinMarketCapAssets(body,true,now)).toThrow("[cmc] duplicate rank");
 });
 it("distinguishes malformed fields and invalid ranks without echoing provider data",()=>{
  expect(()=>parseCoinMarketCapAssets([{...coin(),id:"private-token"}],false,now)).toThrow(new Error("[cmc] invalid asset"));
  for(const rank of [null,-1,0,101,1.5,"private-token"]) {
   const body={...top(),data:top().data.map((row,i)=>i===99?{...row,cmc_rank:rank}:row)};
   expect(()=>parseCoinMarketCapAssets(body,true,now)).toThrow(new Error("[cmc] invalid rank"));
  }
 });
 it("keeps the same strict ten-minute and future-quote validity bounds",()=>{
  for(const timestamp of [now-600000,now+60001]) {
   const body=[{...coin(),quote:[{...coin().quote[0],last_updated:new Date(timestamp).toISOString()}]}];
   expect(()=>parseCoinMarketCapAssets(body,false,now)).toThrow("[cmc] stale quote");
  }
  expect(parseCoinMarketCapAssets([{...coin(),quote:[{...coin().quote[0],last_updated:new Date(now-599999).toISOString()}]}],false,now)).toHaveLength(1);
 });
 it("keeps a stale top-100 quote's original timestamp while the other ninety-nine assets refresh",()=>{
  const body=top(),staleAt=new Date(now-11*60000).toISOString();body.data[99].quote[0].last_updated=staleAt;
  const assets=parseCoinMarketCapAssets(body,true,now);expect(assets).toHaveLength(100);expect(assets[99].quotedAt).toBe(staleAt);
  expect(()=>parseCoinMarketCapAssets([body.data[99]],false,now)).toThrow("[cmc] stale quote");
 });
 it("rejects an entirely stale top-100 response and any future-dated asset",()=>{
  const stale=top();for(const asset of stale.data)asset.quote[0].last_updated=new Date(now-600000).toISOString();
  expect(()=>parseCoinMarketCapAssets(stale,true,now)).toThrow("[cmc] stale quote");
  const future=top();future.data[99].quote[0].last_updated=new Date(now+60001).toISOString();
  expect(()=>parseCoinMarketCapAssets(future,true,now)).toThrow("[cmc] stale quote");
 });
 it("expands scientific notation at the supported precision and rejects zero prices",()=>{
  expect(cmcPriceDecimal(1e-18)).toBe("0.000000000000000001");expect(cmcPriceDecimal(1.23e10)).toBe("12300000000");
  for(const input of [0,-1,NaN,Infinity,1e-19,1e19,"10"])expect(()=>cmcPriceDecimal(input)).toThrow();
 });
});
