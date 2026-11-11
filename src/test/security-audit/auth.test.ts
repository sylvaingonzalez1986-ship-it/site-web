// Real token signing, persistence adapter and guards; fictional identities and DB.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  login: vi.fn(), session: vi.fn(), password: vi.fn(), totp: vi.fn(), token: "", unavailable: false,
  records: new Map<string, Record<string, string>>(),
}));
vi.mock("@/lib/customer-backend", () => ({
  loginCustomerByBackend: state.login, getCurrentCustomerSessionByBackend: state.session,
  clearLegacyCustomerCookie: vi.fn(), logoutCustomerByBackend: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({
  from: (table: string) => {
    if (table !== "admin_sessions") throw new Error("Unexpected relation");
    return {
      insert: async (row: Record<string, string>) => {
        if (state.unavailable) return { error: { message: "unavailable" } };
        state.records.set(row.token_hash, row); return { error: null };
      },
      select: () => ({ eq: (_column: string, hash: string) => ({
        maybeSingle: async () => ({ data: state.records.get(hash), error: state.unavailable ? {} : null }),
      }) }),
      delete: () => ({ eq: async (column: string, value: string) => {
        if (state.unavailable) return { error: {} };
        for (const [hash, row] of state.records) if (row[column] === value) state.records.delete(hash);
        return { error: null };
      } }),
    };
  },
}) }));
vi.mock("@/lib/admin-password", () => ({ verifyAdminPassword: state.password }));
vi.mock("@/lib/admin-totp", () => ({ isAdminTotpEnabled: () => true, verifyAdminTotp: state.totp }));
vi.mock("@/lib/account-profile", () => ({ applyCustomerProfilePatch: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "192.0.2.1", hitRateLimit: async () => ({ allowed: true }), logRateLimitRejection: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined, getAll: () => [] }) }));

import { POST as login } from "@/app/api/account/login/route";
import { GET as me } from "@/app/api/account/me/route";
import { POST as adminLogin } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { POST as accountLogout } from "@/app/api/account/logout/route";
import { ADMIN_COOKIE_NAME, createAdminSessionToken, verifyAdminSessionToken } from "@/lib/admin-auth";
import { createStoredAdminSession, revokeAdminSessionsForCustomer } from "@/lib/admin-session-store";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";

const admin = { customerId: "admin-fixture", customer: { id: "admin-fixture", email: "admin@example.invalid" } };
const post = (body: unknown) => new Request("https://shop.example.invalid/api/admin/login", { method: "POST", body: JSON.stringify(body) });

describe("security regression: administrator elevation and revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); state.records.clear(); state.token = ""; state.unavailable = false;
    vi.stubGlobal("fetch", () => { throw new Error("Tests forbid network"); });
    vi.stubEnv("ADMIN_ALLOWED_EMAILS", admin.customer.email);
    vi.stubEnv("ADMIN_SESSION_SECRET", "fixture-secret-000000000000000000000000000000");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "fixture-hash"); vi.stubEnv("ADMIN_TOTP_SECRET", "fixture-totp");
    state.login.mockResolvedValue(admin); state.session.mockResolvedValue(admin);
    state.password.mockResolvedValue(true); state.totp.mockReturnValue(true);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("customer login and GET me never issue administrator cookies, even for an allowlisted email", async () => {
    for (const response of [await login(post({ email: admin.customer.email, password: "customer-only" })), await me()]) {
      expect(response.status).toBe(200);
      expect(response.cookies.get(ADMIN_COOKIE_NAME)).toBeUndefined();
    }
    expect(state.records.size).toBe(0); expect((await denyIfNotAdminApi())?.status).toBe(401);
  });
  it("requires the admin password and configured TOTP before recording elevation", async () => {
    state.password.mockResolvedValueOnce(false);
    expect((await adminLogin(post({ password: "wrong", totp: "123456" }))).status).toBe(401);
    const challenge = await adminLogin(post({ password: "valid" }));
    expect(await challenge.json()).toEqual({ requireTotp: true });
    state.totp.mockReturnValueOnce(false);
    expect((await adminLogin(post({ password: "valid", totp: "wrong" }))).status).toBe(401);
    expect(state.records.size).toBe(0);
    const response = await adminLogin(post({ password: "valid", totp: "123456" }));
    expect(response.status).toBe(200); state.token = response.cookies.get(ADMIN_COOKIE_NAME)!.value;
    expect(await getValidatedAdminContext()).toEqual({ customerId: admin.customerId, email: admin.customer.email });
    expect([...state.records.keys()][0]).not.toBe(state.token);
  });
  it("identifies an expired customer session without accepting an administrator password alone", async () => {
    state.session.mockResolvedValueOnce(null);
    const response = await adminLogin(post({ password: "valid", totp: "123456" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "account_session_required" });
    expect(state.password).not.toHaveBeenCalled(); expect(state.records.size).toBe(0);
    expect(state.session).toHaveBeenCalledWith("identity");
  });
  it("denies an authenticated account outside the allowlist without checking its admin password", async () => {
    state.session.mockResolvedValueOnce({ customerId: "ordinary-account", customer: { email: "ordinary@example.invalid" } });
    const response = await adminLogin(post({ password: "valid", totp: "123456" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "admin_account_required" });
    expect(state.password).not.toHaveBeenCalled(); expect(state.records.size).toBe(0);
  });
  it("reports Auth unavailability as a service error", async () => {
    state.session.mockRejectedValueOnce(new Error("[supabase:auth.getUser] fixture unavailable"));
    expect((await adminLogin(post({ password: "valid", totp: "123456" }))).status).toBe(503);
    expect(state.records.size).toBe(0);
  });
  it("does not accept a signed token without a persistent elevation", async () => {
    state.token = await createAdminSessionToken(); expect((await denyIfNotAdminApi())?.status).toBe(401);
  });
  it("binds elevation to the verified customer identity and current allowlist", async () => {
    state.token = await createStoredAdminSession(admin.customerId);
    state.session.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...admin, customerId: "other-account" });
    expect((await denyIfNotAdminApi())?.status).toBe(401); expect((await denyIfNotAdminApi())?.status).toBe(401);
    vi.stubEnv("ADMIN_ALLOWED_EMAILS", "replacement@example.invalid");
    expect((await denyIfNotAdminApi())?.status).toBe(401);
  });
  it("rejects a copied cookie after admin logout", async () => {
    state.token = await createStoredAdminSession(admin.customerId);
    expect(await denyIfNotAdminApi()).toBeNull();
    expect((await logout()).cookies.get(ADMIN_COOKIE_NAME)?.value).toBe("");
    expect((await denyIfNotAdminApi())?.status).toBe(401);
  });
  it("account logout revokes every elevation for that customer", async () => {
    state.token = await createStoredAdminSession(admin.customerId); await createStoredAdminSession(admin.customerId);
    expect((await accountLogout()).status).toBe(200); expect(state.records.size).toBe(0);
    expect((await denyIfNotAdminApi())?.status).toBe(401);
  });
  it("supports revocation for password recovery", async () => {
    state.token = await createStoredAdminSession(admin.customerId); await revokeAdminSessionsForCustomer(admin.customerId);
    expect((await denyIfNotAdminApi())?.status).toBe(401);
  });
  it.each(["ADMIN_PASSWORD_HASH", "ADMIN_TOTP_SECRET", "ADMIN_SESSION_SECRET"])("invalidates elevation on %s rotation", async (name) => {
    state.token = await createStoredAdminSession(admin.customerId); vi.stubEnv(name, "rotated-fixture-value");
    expect((await denyIfNotAdminApi())?.status).toBe(401);
  });
  it("fails closed when persistence is unavailable and does not claim logout succeeded", async () => {
    state.token = await createStoredAdminSession(admin.customerId); state.unavailable = true;
    await expect(denyIfNotAdminApi()).rejects.toThrow("ADMIN_SESSION_STORE");
    expect((await logout()).status).toBe(503);
    expect((await adminLogin(post({ password: "valid", totp: "123456" }))).status).toBe(503);
  });
  it("rejects expired, forged and malformed tokens", async () => {
    expect(await verifyAdminSessionToken(await createAdminSessionToken(-1))).toBe(false);
    const token = await createAdminSessionToken();
    expect(await verifyAdminSessionToken(`${token.split(".")[0]}.${"00".repeat(32)}`)).toBe(false);
    expect(await verifyAdminSessionToken(`${token}.extra`)).toBe(false);
  });
});
