import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const {rpc,quotes}=vi.hoisted(()=>({rpc:vi.fn(),quotes:vi.fn()}));
vi.mock("./admin",()=>({createSupabaseServiceClient:()=>({rpc})}));
vi.mock("../stock-market-quotes",()=>({fetchKqStockQuotes:quotes}));
import { getKqStockSnapshot, handleKqStockAction, refreshKqStockQuotes } from "./kanab-quest-stocks-backend";
import { getKqStockInstrument } from "../kanab-quest-stocks";
const owner="11111111-1111-4111-8111-111111111111",id="22222222-2222-4222-8222-222222222222",date="2026-09-23T15:00:00Z";
const asset={...getKqStockInstrument("AAPL"),priceNative:"120",priceEur:"100",changePercent:2,quotedAt:date,refreshedAt:date,marketState:"open",fxRate:"1.2",fxQuotedAt:date};
const snapshot={version:1,serverNow:date,cashCents:10000,assets:[asset],positions:[],recentTrades:[]};
const order={orderId:id,assetId:"AAPL",side:"buy",quantity:"1",priceEur:"100",amountCents:10000,expiresAt:date,quotedAt:date};
const trade={...order,costBasisCents:10000,realizedPnlCents:0,cashAfterCents:0,createdAt:date};
beforeEach(()=>{vi.clearAllMocks();vi.spyOn(console,"warn").mockImplementation(()=>{});quotes.mockResolvedValue([asset]);rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_stock_refresh_claim"?null:snapshot}));});
afterEach(()=>vi.restoreAllMocks());
describe("stock market server authority",()=>{
 it("keeps holdings available during provider failures and releases only its quote lease",async()=>{
  rpc.mockImplementation(async(name:string)=>({error:null,data:name==="rpc_kq_stock_refresh_claim"?{leaseId:id,assetIds:["AAPL"]}:name==="rpc_kq_stock_command"?snapshot:false}));quotes.mockRejectedValue(new Error("private transport detail"));
  expect(await getKqStockSnapshot(owner,["AAPL"])).toEqual(snapshot);
  expect(rpc).toHaveBeenCalledWith("rpc_kq_stock_refresh_publish",{p_lease_id:id,p_assets:[]});expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private transport detail");
 });
 it("does not call the provider when another instance owns the lease or no prices are requested",async()=>{
  await refreshKqStockQuotes(["AAPL"]);expect(quotes).not.toHaveBeenCalled();rpc.mockClear();await refreshKqStockQuotes([]);expect(rpc).not.toHaveBeenCalled();
 });
 it("fetches only lease-winning requested symbols, then publishes the actual provider data",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:{leaseId:id,assetIds:["AAPL"]}}).mockResolvedValueOnce({error:null,data:true});
  await refreshKqStockQuotes(["AAPL","MSFT"]);expect(quotes).toHaveBeenCalledExactlyOnceWith(["AAPL"]);expect(rpc).toHaveBeenLastCalledWith("rpc_kq_stock_refresh_publish",{p_lease_id:id,p_assets:[asset]});
 });
 it("rejects a forged lease containing unrelated symbols",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:{leaseId:id,assetIds:["MSFT"]}});await expect(refreshKqStockQuotes(["AAPL"])).rejects.toThrow("invalid refresh lease");expect(quotes).not.toHaveBeenCalled();
 });
 it("replays confirmation without depending on a fresh provider price",async()=>{
  rpc.mockResolvedValue({error:null,data:{trade,replayed:true}});expect(await handleKqStockAction(owner,{action:"confirm",orderId:id,userId:"victim",priceEur:"1"})).toEqual({trade,replayed:true});
  expect(quotes).not.toHaveBeenCalled();expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_stock_command",{p_user_id:owner,p_action:"confirm",p_payload:{orderId:id},p_asset_ids:[]});
 });
 it("previews the owner order with server-authoritative price and FX",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:null}).mockResolvedValueOnce({error:null,data:order});await handleKqStockAction(owner,{action:"preview",side:"buy",assetId:"AAPL",amountCents:10000,userId:"victim",fxRate:"1"});
  expect(rpc).toHaveBeenLastCalledWith("rpc_kq_stock_command",{p_user_id:owner,p_action:"preview",p_payload:{side:"buy",assetId:"AAPL",amountCents:10000},p_asset_ids:[]});
 });
 it("rejects bad identities and payloads before RPC, and sanitizes database failures",async()=>{
  await expect(getKqStockSnapshot("bad")).rejects.toThrow("invalide");await expect(handleKqStockAction(owner,{action:"preview",side:"buy",assetId:"unknown",amountCents:10000})).rejects.toThrow("invalide");expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({error:{code:"42501",message:"private DB"},data:null});await expect(handleKqStockAction(owner,{action:"confirm",orderId:id})).rejects.toThrow("[supabase:stocks]");expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private DB");
 });
 it("fails closed on a malformed snapshot",async()=>{
  rpc.mockResolvedValueOnce({error:null,data:null}).mockResolvedValueOnce({error:null,data:{...snapshot,cashCents:-1}});await expect(getKqStockSnapshot(owner,["AAPL"])).rejects.toThrow("invalid snapshot");
 });
});
