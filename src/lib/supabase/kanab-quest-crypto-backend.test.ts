import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const {rpc,top,quotes}=vi.hoisted(()=>({rpc:vi.fn(),top:vi.fn(),quotes:vi.fn()}));
vi.mock("./admin",()=>({createSupabaseServiceClient:()=>({rpc})}));
vi.mock("../coinmarketcap",async importOriginal=>({...await importOriginal<typeof import("../coinmarketcap")>(),fetchCoinMarketCapTop100:top,fetchCoinMarketCapQuotes:quotes}));
import { CoinMarketCapRequestError } from "../coinmarketcap";
import { getKqCryptoSnapshot, handleKqCryptoAction, refreshKqCryptoQuotes } from "./kanab-quest-crypto-backend";
const owner="11111111-1111-4111-8111-111111111111", id="22222222-2222-4222-8222-222222222222", date="2026-09-23T15:00:00Z";
const asset={id:1,rank:1,name:"Bitcoin",symbol:"BTC",priceEur:"40000",change24h:1,quotedAt:date,inTop100:true};
const snapshot={version:1,serverNow:date,marketStatus:"live",updatedAt:date,cashCents:10000,assets:[asset],positions:[],recentTrades:[]};
const order={orderId:id,assetId:1,side:"buy",quantity:"0.0025",priceEur:"40000",amountCents:10000,expiresAt:date,quotedAt:date};
const trade={...order,costBasisCents:10000,realizedPnlCents:0,cashAfterCents:0,createdAt:date};
afterEach(()=>{vi.restoreAllMocks();});
beforeEach(()=>{vi.clearAllMocks();vi.spyOn(console,"warn").mockImplementation(()=>{});top.mockResolvedValue([asset]);quotes.mockResolvedValue([]);rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_crypto_refresh_claim"?null:snapshot}));});
describe("crypto server authority",()=>{
 it("joins simultaneous local refreshes into one provider request and publication",async()=>{
  let release!: (value:typeof asset[])=>void;
  top.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
  rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_crypto_refresh_claim"?{leaseId:id,heldAssetIds:[]}:true}));
  const first=refreshKqCryptoQuotes(),second=refreshKqCryptoQuotes();
  await vi.waitFor(()=>expect(top).toHaveBeenCalledTimes(1));
  release([asset]);await Promise.all([first,second]);
  expect(rpc.mock.calls.filter(([name])=>name==="rpc_kq_crypto_refresh_claim")).toHaveLength(1);
  expect(rpc.mock.calls.filter(([name])=>name==="rpc_kq_crypto_refresh_publish")).toHaveLength(1);
 });
 it("shares a provider pause while retaining the player's snapshot",async()=>{
  rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_crypto_refresh_claim"?{leaseId:id,heldAssetIds:[]}:snapshot}));
  top.mockRejectedValue(new CoinMarketCapRequestError("[cmc] unavailable (HTTP 429)","rate_limited",600));
  expect(await getKqCryptoSnapshot(owner)).toEqual(snapshot);
  expect(rpc).toHaveBeenCalledWith("rpc_kq_crypto_refresh_fail",{p_lease_id:id,p_failure_code:"rate_limited",p_retry_after_seconds:600});
 });
 it("publishes good top100 quotes while honoring a held-asset Retry-After",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:{leaseId:id,heldAssetIds:[101]}}).mockResolvedValueOnce({error:null,data:true});
  quotes.mockRejectedValue(new CoinMarketCapRequestError("[cmc] unavailable (HTTP 429)","rate_limited",600));
  await refreshKqCryptoQuotes();
  expect(rpc).toHaveBeenLastCalledWith("rpc_kq_crypto_refresh_publish",{p_lease_id:id,p_assets:[asset],p_retry_after_seconds:600});
 });
 it("returns only client refresh metadata and omits operational counters",async()=>{
  const refresh={refreshing:false,nextAttemptAt:date,lastFailureCode:"rate_limited"};
  rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_crypto_refresh_claim"?null:name==="rpc_kq_crypto_refresh_status"?{...refresh,failureCount:2,quoteCount:100}:snapshot}));
  expect(await getKqCryptoSnapshot(owner)).toEqual({...snapshot,refresh});
 });
 it("retains the snapshot when optional status reporting fails",async()=>{
  rpc.mockImplementation(async(name:string)=>name==="rpc_kq_crypto_refresh_status"?{data:null,error:{code:"PGRST202",message:"unavailable"}}:{error:null,data:name==="rpc_kq_crypto_refresh_claim"?null:snapshot});
  expect(await getKqCryptoSnapshot(owner)).toEqual(snapshot);
 });
 it("retains the snapshot if reporting a failed refresh also fails",async()=>{
  rpc.mockImplementation(async(name:string)=>name==="rpc_kq_crypto_refresh_fail"?{data:null,error:{code:"PGRST202",message:"unavailable"}}:{error:null,data:name==="rpc_kq_crypto_refresh_claim"?{leaseId:id,heldAssetIds:[]}:snapshot});
  top.mockRejectedValue(new Error("network"));
  expect(await getKqCryptoSnapshot(owner)).toEqual(snapshot);
 });
 it("records publication failures separately from provider failures",async()=>{
  rpc.mockImplementation(async(name:string)=>name==="rpc_kq_crypto_refresh_publish"?{data:null,error:{code:"P0001",message:"crypto_invalid_quotes"}}:{error:null,data:name==="rpc_kq_crypto_refresh_claim"?{leaseId:id,heldAssetIds:[]}:true});
  await refreshKqCryptoQuotes();
  expect(rpc).toHaveBeenLastCalledWith("rpc_kq_crypto_refresh_fail",{p_lease_id:id,p_failure_code:"publish_failed",p_retry_after_seconds:null});
 });
 it("reads session owner only and retains positions during provider outages",async()=>{
  rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_crypto_refresh_claim"?{leaseId:id,heldAssetIds:[]}:snapshot}));top.mockRejectedValue(new Error("network"));
  expect(await getKqCryptoSnapshot(owner)).toEqual(snapshot);expect(rpc).toHaveBeenCalledWith("rpc_kq_crypto_command",{p_user_id:owner,p_action:"state",p_payload:{},p_market_enabled:true});
 });
 it("a lease prevents external calls by losing server instances",async()=>{await refreshKqCryptoQuotes();expect(top).not.toHaveBeenCalled();expect(quotes).not.toHaveBeenCalled();});
 it("fetches only held IDs missing from top100 and publishes the shared quotes",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:{leaseId:id,heldAssetIds:[1,101]}}).mockResolvedValueOnce({error:null,data:true});quotes.mockResolvedValue([{...asset,id:101,rank:101,inTop100:false}]);
  await refreshKqCryptoQuotes();expect(quotes).toHaveBeenCalledWith([101]);expect(rpc).toHaveBeenLastCalledWith("rpc_kq_crypto_refresh_publish",{p_lease_id:id,p_assets:[asset,{...asset,id:101,rank:101,inTop100:false}]});
 });
 it("reports a rejected publication without pretending the cache was updated",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:{leaseId:id,heldAssetIds:[]}}).mockResolvedValueOnce({error:null,data:false});
  await refreshKqCryptoQuotes();expect(console.warn).toHaveBeenCalledWith("[crypto:refresh] publication lease expired");
 });
 it("keeps diagnostics useful without recording provider secrets or player data",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:{leaseId:id,heldAssetIds:[]}});top.mockRejectedValue(new Error("https://provider/?secret=private-token"));
  await refreshKqCryptoQuotes();expect(console.warn).toHaveBeenCalledWith("[crypto:refresh] retaining last quotes",{reason:"provider request failed"});
  rpc.mockResolvedValueOnce({error:{code:"42501",message:"private db secret"},data:null});
  await expect(handleKqCryptoAction(owner,{action:"confirm",orderId:id})).rejects.toThrow("[supabase:crypto]");
  expect(console.warn).toHaveBeenCalledWith("[crypto:rpc] request failed",{rpc:"rpc_kq_crypto_command",code:"42501"});
  expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private");
  expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(owner);
 });
 it("confirmation retries do not depend on refresh, quote age, or provider availability",async()=>{
  rpc.mockResolvedValue({error:null,data:{trade,replayed:true}});expect(await handleKqCryptoAction(owner,{action:"confirm",orderId:id,userId:"victim",priceEur:"1"})).toEqual({trade,replayed:true});
  expect(top).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_crypto_command",{p_user_id:owner,p_action:"confirm",p_payload:{orderId:id},p_market_enabled:true});
 });
 it("accepts a persisted preview but strips client price and ownership",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:null}).mockResolvedValueOnce({error:null,data:order});await handleKqCryptoAction(owner,{action:"preview",side:"buy",assetId:1,amountCents:10000,userId:"victim",priceEur:"1"});
  expect(rpc).toHaveBeenLastCalledWith("rpc_kq_crypto_command",{p_user_id:owner,p_action:"preview",p_payload:{side:"buy",assetId:1,amountCents:10000},p_market_enabled:true});
 });
 it("validates before RPC calls and does not expose unknown database errors",async()=>{
  await expect(handleKqCryptoAction("invalid",{})).rejects.toThrow("invalide");expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({error:{message:"private db secret"},data:null});await expect(handleKqCryptoAction(owner,{action:"confirm",orderId:id})).rejects.toThrow("[supabase:crypto]");
 });
 it("fails closed on malformed snapshots",async()=>{rpc.mockResolvedValueOnce({error:null,data:null}).mockResolvedValueOnce({error:null,data:{...snapshot,cashCents:-1}});await expect(getKqCryptoSnapshot(owner)).rejects.toThrow("invalid snapshot");});
});
