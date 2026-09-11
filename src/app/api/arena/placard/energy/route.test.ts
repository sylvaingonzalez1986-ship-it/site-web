import { beforeEach, describe, expect, it, vi } from "vitest";
const { session, enabled, snapshot, pay, rate, log } = vi.hoisted(() => ({session:vi.fn(), enabled:vi.fn(), snapshot:vi.fn(), pay:vi.fn(), rate:vi.fn(), log:vi.fn()}));
vi.mock("@/lib/customer-backend", () => ({getCurrentCustomerSessionByBackend:session}));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({isKqPlayerRequestEnabled:enabled}));
vi.mock("@/lib/supabase/kanab-quest-energy-backend", () => ({getKqEnergySnapshot:snapshot,payKqEnergy:pay}));
vi.mock("@/lib/security-rate-limit", () => ({getRequestIp:()=>"127.0.0.1",hitRateLimit:rate,logRateLimitRejection:log}));
import {GET,POST} from "./route";
const request = (body:unknown) => new Request("http://localhost/api/arena/placard/energy",{method:"POST",body:JSON.stringify(body)});
describe("electricity payment API",()=>{
 beforeEach(()=>{vi.clearAllMocks();enabled.mockResolvedValue(true);session.mockResolvedValue({customerId:"owner",customer:{email:"owner@example.test"}});rate.mockResolvedValue({allowed:true});snapshot.mockResolvedValue({outstandingCents:603});pay.mockResolvedValue({paidCents:603});});
 it("hides the feature when access is disabled",async()=>{enabled.mockResolvedValue(false);expect((await GET()).status).toBe(404);expect((await POST(request({}))).status).toBe(404);expect(session).not.toHaveBeenCalled();});
 it("requires authentication before reading or paying",async()=>{session.mockResolvedValue(null);expect((await GET()).status).toBe(401);expect((await POST(request({}))).status).toBe(401);expect(snapshot).not.toHaveBeenCalled();expect(pay).not.toHaveBeenCalled();expect(rate).not.toHaveBeenCalled();});
 it("reads the signed-in account and disables caching",async()=>{const response=await GET();expect(snapshot).toHaveBeenCalledWith("owner");expect(response.headers.get("cache-control")).toContain("no-store");});
 it("ignores supplied ownership and passes the exact payment request",async()=>{const response=await POST(request({userId:"victim",requestKey:"payment-key",expectedCents:603}));expect(response.status).toBe(200);expect(pay).toHaveBeenCalledWith({userId:"owner",requestKey:"payment-key",expectedCents:603});});
 it("blocks rate-limited requests without attempting a payment",async()=>{rate.mockResolvedValue({allowed:false,retryAfterSeconds:42});const response=await POST(request({}));expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("42");expect(log).toHaveBeenCalledOnce();expect(pay).not.toHaveBeenCalled();});
 it("does not expose database failures",async()=>{pay.mockRejectedValue(new Error("[supabase:energy-payment] private database details"));const response=await POST(request({}));expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain("private database details");});
 it("preserves a useful insufficient-cash error",async()=>{pay.mockRejectedValue(new Error("Trésorerie insuffisante."));const response=await POST(request({}));expect(response.status).toBe(400);expect(await response.json()).toEqual({error:"Trésorerie insuffisante."});});
});
