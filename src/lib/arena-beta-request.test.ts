import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: vi.fn(), row: vi.fn(), eq: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: mocks.user } }) }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://example.test", anonKey: "anon" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ eq: mocks.eq }) }) }) }));
import { verifyArenaBetaRequest } from "./arena-beta-request";
beforeEach(() => { vi.clearAllMocks(); mocks.eq.mockReturnValue({ maybeSingle: mocks.row }); });
afterEach(() => vi.restoreAllMocks());
const request=()=>new NextRequest("https://example.test/arene/placard");
it("rejects forged cookies when Auth cannot verify a user", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: { message: "invalid token" } });
  expect(await verifyArenaBetaRequest(request(), [])).toBe(false); expect(mocks.eq).not.toHaveBeenCalled();
});
it.each([true,false])("uses the current private registry, not editable user metadata: %s", async enabled => {
  mocks.user.mockResolvedValue({ data: { user: { id: "verified-id", email: "player@example.test", user_metadata: { contestBetaEnabled: true } } }, error: null });
  mocks.row.mockResolvedValue({ data: { enabled }, error: null });
  expect(await verifyArenaBetaRequest(request(), [])).toBe(enabled);
  expect(mocks.eq).toHaveBeenCalledWith("customer_id", "verified-id");
});
it("fails closed when the beta registry cannot be read", async () => {
  mocks.user.mockResolvedValue({ data: { user: { id: "verified-id" } }, error: null });
  mocks.row.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  expect(await verifyArenaBetaRequest(request(), [])).toBe(false);
});
