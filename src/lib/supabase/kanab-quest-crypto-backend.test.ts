import { beforeEach, describe, expect, it, vi } from "vitest";
const {rpc,top,quotes}=vi.hoisted(()=>({rpc:vi.fn(),top:vi.fn(),quotes:vi.fn()}));
vi.mock("./admin",()=>({createSupabaseServiceClient:()=>({rpc})}));
vi.mock("../coinmarketcap",()=>({fetchCoinMarketCapTop100:top,fetchCoinMarketCapQuotes:quotes}));
import { getKqCryptoSnapshot, handleKqCryptoAction, refreshKqCryptoQuotes } from "./kanab-quest-crypto-backend";
const owner="11111111-1111-4111-8111-111111111111", id="22222222-2222-4222-8222-222222222222", date="2026-09-23T15:00:00Z";
const asset={id:1,rank:1,name:"Bitcoin",symbol:"BTC",priceEur:"40000",change24h:1,quotedAt:date,inTop100:true};
const snapshot={version:1,serverNow:date,marketStatus:"live",updatedAt:date,cashCents:10000,assets:[asset],positions:[],recentTrades:[]};
const order={orderId:id,assetId:1,side:"buy",quantity:"0.0025",priceEur:"40000",amountCents:10000,expiresAt:date,quotedAt:date};
const trade={...order,costBasisCents:10000,realizedPnlCents:0,cashAfterCents:0,createdAt:date};
beforeEach(()=>{vi.clearAllMocks();top.mockResolvedValue([asset]);quotes.mockResolvedValue([]);rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_crypto_refresh_claim"?null:snapshot}));});
describe("crypto server authority",()=>{
 it("reads session owner only and retains positions during provider outages",async()=>{
  rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_crypto_refresh_claim"?{leaseId:id,heldAssetIds:[]}:snapshot}));top.mockRejectedValue(new Error("network"));
  expect(await getKqCryptoSnapshot(owner)).toEqual(snapshot);expect(rpc).toHaveBeenCalledWith("rpc_kq_crypto_command",{p_user_id:owner,p_action:"state",p_payload:{},p_market_enabled:true});
 });
 it("a lease prevents external calls by losing server instances",async()=>{await refreshKqCryptoQuotes();expect(top).not.toHaveBeenCalled();expect(quotes).not.toHaveBeenCalled();});
 it("fetches only held IDs missing from top100 and publishes the shared quotes",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:{leaseId:id,heldAssetIds:[1,101]}}).mockResolvedValueOnce({error:null,data:true});quotes.mockResolvedValue([{...asset,id:101,rank:101,inTop100:false}]);
  await refreshKqCryptoQuotes();expect(quotes).toHaveBeenCalledWith([101]);expect(rpc).toHaveBeenLastCalledWith("rpc_kq_crypto_refresh_publish",{p_lease_id:id,p_assets:[asset,{...asset,id:101,rank:101,inTop100:false}]});
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
