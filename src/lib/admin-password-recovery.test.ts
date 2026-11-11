import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verifyOtp: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), revoke: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: mocks }) }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://example.invalid", anonKey: "fixture" }) }));
vi.mock("@/lib/password-leak-check", () => ({ assertPasswordNotLeaked: async () => {} }));
vi.mock("@/lib/admin-session-store", () => ({ revokeAdminSessionsForCustomer: mocks.revoke }));
import { resetSupabaseCustomerPassword } from "@/lib/supabase/customer-backend";

describe("password recovery revokes administrator elevation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const identity = { data: { user: { id: "customer-fixture", email: "fixture@example.invalid" } }, error: null };
    mocks.verifyOtp.mockResolvedValue(identity); mocks.getUser.mockResolvedValue(identity);
    mocks.updateUser.mockResolvedValue(identity); mocks.signOut.mockResolvedValue({ error: null });
  });
  it("verifies the account and revokes elevation before applying the new password", async () => {
    await expect(resetSupabaseCustomerPassword({ password: "fixture-only-password", tokenHash: "fixture-token" })).resolves.toEqual({ email: "fixture@example.invalid" });
    expect(mocks.revoke).toHaveBeenCalledWith("customer-fixture");
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.getUser.mock.invocationCallOrder[0]);
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0]);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
  it("does not reset the password if the elevation store is unavailable", async () => {
    mocks.revoke.mockRejectedValue(new Error("ADMIN_SESSION_STORE unavailable"));
    await expect(resetSupabaseCustomerPassword({ password: "fixture-only-password", tokenHash: "fixture-token" })).rejects.toThrow("ADMIN_SESSION_STORE");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("does not revoke or change anything if Auth rejects the recovery identity", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid session" } });
    await expect(resetSupabaseCustomerPassword({ password: "fixture-only-password", tokenHash: "fixture-token" })).rejects.toThrow("auth.getUser");
    expect(mocks.revoke).not.toHaveBeenCalled(); expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
