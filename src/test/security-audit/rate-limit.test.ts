import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
import { hitRateLimit } from "@/lib/security-rate-limit";
const options = { key: "admin-login-fixture", windowSeconds: 600, maxHits: 10 };
describe("persistent anti-abuse protection", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    { data: null, error: { message: "Could not find public.rpc_rate_limit_hit" } },
    { data: null, error: { message: "connection failed" } },
    { data: [], error: null }, { data: [{ allowed: true }], error: null },
  ])("never grants a local fallback budget on missing or invalid shared state", async (result) => {
    mocks.rpc.mockResolvedValue(result); await expect(hitRateLimit(options)).rejects.toThrow("rpc_rate_limit_hit");
  });
  it("uses the shared allow/deny decision and retry interval", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ allowed: true, remaining: 9, retry_after_seconds: 0 }], error: null });
    expect(await hitRateLimit(options)).toEqual({ allowed: true, remaining: 9, retryAfterSeconds: 0 });
    mocks.rpc.mockResolvedValueOnce({ data: [{ allowed: false, remaining: 0, retry_after_seconds: 42 }], error: null });
    expect(await hitRateLimit(options)).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 42 });
  });
});
