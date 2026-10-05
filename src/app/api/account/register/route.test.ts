import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  cookieSet: vi.fn(),
  rateLimit: vi.fn(),
  passwordCheck: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signUp: mocks.signUp } }),
}));
vi.mock("@/lib/password-leak-check", () => ({
  assertPasswordNotLeaked: mocks.passwordCheck,
}));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit: mocks.rateLimit,
  logRateLimitRejection: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: () => "https://shop.example.test" }));

import { POST } from "./route";

function registerRequest(next?: unknown) {
  return new Request("https://untrusted-host.example/api/account/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Camille",
      lastName: "Martin",
      email: "camille@example.test",
      password: "test-password-123",
      dateOfBirth: "1990-01-01",
      next,
    }),
  });
}

function verificationUrl() {
  return new URL(mocks.signUp.mock.calls[0][0].options.emailRedirectTo);
}

describe("registration return to checkout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.passwordCheck.mockResolvedValue(undefined);
    mocks.signUp.mockResolvedValue({ data: { user: { id: "customer-1" } }, error: null });
  });

  it("passes the cart return through both backends into the verification email URL", async () => {
    const next = "/boutique/fleurs-cbd?panier=1&origine=bretagne#catalogue";
    const response = await POST(registerRequest(next));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ needsEmailVerification: true });
    expect(mocks.signUp).toHaveBeenCalledOnce();
    expect(verificationUrl().origin).toBe("https://shop.example.test");
    expect(verificationUrl().pathname).toBe("/api/auth/callback");
    expect(verificationUrl().searchParams.get("next")).toBe(next);
    expect(mocks.passwordCheck).toHaveBeenCalledWith("test-password-123");
  });

  it.each([
    undefined,
    42,
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "%2F%2Fevil.example",
    "/%5Cevil.example",
    "/%0Devil.example",
    "javascript:alert(1)",
    "/broken%",
  ])("uses the profile fallback for an absent or unsafe return path: %s", async (next) => {
    expect((await POST(registerRequest(next))).status).toBe(200);
    expect(verificationUrl().toString()).toBe("https://shop.example.test/api/auth/callback");
  });

  it("keeps rate limiting ahead of registration", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const response = await POST(registerRequest("/boutique?panier=1"));
    expect(response.status).toBe(429);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});
