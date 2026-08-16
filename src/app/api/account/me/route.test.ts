import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  applyCustomerProfilePatch,
  clearSupabaseAuthCookies,
  cookies,
  createAdminSessionToken,
  getCurrentCustomerSessionByBackend,
  hitRateLimit,
  isAllowedAdminEmail,
} = vi.hoisted(() => ({
  applyCustomerProfilePatch: vi.fn(),
  clearSupabaseAuthCookies: vi.fn(),
  cookies: vi.fn(),
  createAdminSessionToken: vi.fn(),
  getCurrentCustomerSessionByBackend: vi.fn(),
  hitRateLimit: vi.fn(),
  isAllowedAdminEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/account-profile", () => ({ applyCustomerProfilePatch }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/admin-allowlist", () => ({ isAllowedAdminEmail }));
vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE_NAME: "admin_session",
  createAdminSessionToken,
  getAdminCookieOptions: vi.fn(() => ({})),
}));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: vi.fn(() => "127.0.0.1"),
  hitRateLimit,
  logRateLimitRejection: vi.fn(),
}));
vi.mock("@/lib/supabase-auth-cookies", () => ({ clearSupabaseAuthCookies }));

import { GET, PATCH } from "@/app/api/account/me/route";

describe("/api/account/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAllowedAdminEmail.mockReturnValue(false);
    hitRateLimit.mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 0 });
    cookies.mockResolvedValue({ getAll: vi.fn(() => []) });
  });

  it("returns a retryable 503 without clearing the session when Supabase Auth is unreachable", async () => {
    getCurrentCustomerSessionByBackend.mockRejectedValue(
      new Error("[supabase:auth.getUser] fetch failed"),
    );

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(payload.error).toContain("momentanément indisponible");
    expect(JSON.stringify(payload)).not.toContain("auth.getUser");
    expect(clearSupabaseAuthCookies).not.toHaveBeenCalled();
  });

  it("returns the same retryable response before a profile update", async () => {
    getCurrentCustomerSessionByBackend.mockRejectedValue(
      new Error("[supabase:auth.getUser] fetch failed"),
    );

    const response = await PATCH(new Request("http://localhost/api/account/me", {
      method: "PATCH",
      body: JSON.stringify({ firstName: "Test" }),
    }));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(applyCustomerProfilePatch).not.toHaveBeenCalled();
  });

  it("keeps invalid sessions distinct from transient backend failures", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ user: null });
    expect(clearSupabaseAuthCookies).toHaveBeenCalledOnce();
  });
});
