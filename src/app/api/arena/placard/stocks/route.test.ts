import { beforeEach, describe, expect, it, vi } from "vitest";
const {session,enabled,snapshot,action,rate,log}=vi.hoisted(()=>({session:vi.fn(),enabled:vi.fn(),snapshot:vi.fn(),action:vi.fn(),rate:vi.fn(),log:vi.fn()}));
vi.mock("@/lib/customer-backend",()=>({getCurrentCustomerSessionByBackend:session}));
vi.mock("@/lib/kanab-quest-player-request-access",()=>({isKqPlayerRequestEnabled:enabled}));
vi.mock("@/lib/supabase/kanab-quest-stocks-backend",()=>({getKqStockSnapshot:snapshot,handleKqStockAction:action}));
vi.mock("@/lib/security-rate-limit",()=>({getRequestIp:()=>"127.0.0.1",hitRateLimit:rate,logRateLimitRejection:log}));
import { KqStockRequestError } from "@/lib/kanab-quest-stocks";
import {GET,POST} from "./route";
const url="http://localhost/api/arena/placard/stocks";
const post=(body:unknown,headers:Record<string,string>={})=>new Request(url,{method:"POST",headers,body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();enabled.mockResolvedValue(true);session.mockResolvedValue({customerId:"owner",customer:{email:"owner@example.test"}});rate.mockResolvedValue({allowed:true});snapshot.mockResolvedValue({version:1});action.mockResolvedValue({replayed:true});});
describe("stock API boundaries",()=>{
 it("requires feature access and authentication before invoking the market",async()=>{enabled.mockResolvedValue(false);expect((await GET(new Request(url))).status).toBe(404);enabled.mockResolvedValue(true);session.mockResolvedValue(null);expect((await POST(post({}))).status).toBe(401);expect(action).not.toHaveBeenCalled();expect(rate).not.toHaveBeenCalled();});
 it("loads only current account with private no-store responses",async()=>{const response=await GET(new Request(url+"?userId=victim"));expect(snapshot).toHaveBeenCalledExactlyOnceWith("owner",["^FCHI","^GSPC"]);expect(response.headers.get("cache-control")).toContain("private, no-store");});
 it("validates requested instruments and caps provider batches before backend calls",async()=>{
  expect((await GET(new Request(url+"?ids=AAPL,MSFT"))).status).toBe(200);expect(snapshot).toHaveBeenLastCalledWith("owner",["AAPL","MSFT"]);
  snapshot.mockClear();expect((await GET(new Request(url+"?ids=https://private.example/secret"))).status).toBe(400);expect(snapshot).not.toHaveBeenCalled();
 });
 it("provides authenticated identity separately from untrusted body",async()=>{const body={action:"confirm",orderId:"order",userId:"victim"};expect((await POST(post(body))).status).toBe(200);expect(action).toHaveBeenCalledWith("owner",body);});
 it("denies cross-site writes before execution",async()=>{expect((await POST(post({},{origin:"https://attacker.example"}))).status).toBe(403);expect(action).not.toHaveBeenCalled();});
 it("limits traffic before external quote refresh",async()=>{rate.mockResolvedValue({allowed:false,retryAfterSeconds:20});const response=await GET(new Request(url));expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("20");expect(snapshot).not.toHaveBeenCalled();});
 it("rejects oversized and malformed orders",async()=>{expect((await POST(post({payload:"x".repeat(3000)}))).status).toBe(413);expect((await POST(new Request(url,{method:"POST",body:"{"}))).status).toBe(400);expect(action).not.toHaveBeenCalled();});
 it("does not leak non-database internal failures",async()=>{session.mockRejectedValue(new Error("private identity provider details"));const response=await GET(new Request(url));expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain("identity provider");});
 it("hides database failures and preserves safe business errors",async()=>{action.mockRejectedValueOnce(new Error("[supabase:stocks] private database detail"));const response=await POST(post({}));expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain("private database detail");action.mockRejectedValueOnce(new KqStockRequestError("This offer has expired."));expect((await POST(post({}))).status).toBe(400);});
});
