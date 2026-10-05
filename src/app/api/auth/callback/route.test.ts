import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  signOut: vi.fn(),
  ensureProfile: vi.fn(),
  bindReferral: vi.fn(),
  clearMetadata: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [{ name: "sb-test-auth-token", value: "old" }] }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchange, signOut: mocks.signOut },
  }),
}));
vi.mock("@/lib/supabase/customer-backend", () => ({
  ensureSupabaseProfileRow: mocks.ensureProfile,
  bindSupabaseReferralCodeSafe: mocks.bindReferral,
  clearSupabaseSignupTransientMetadata: mocks.clearMetadata,
}));

import { GET } from "./route";

function callbackRequest(next?: string, code: string | null = "verification-code") {
  const url = new URL("https://shop.example.test/api/auth/callback");
  if (code !== null) url.searchParams.set("code", code);
  if (next !== undefined) url.searchParams.set("next", next);
  return new Request(url);
}

describe("email verification return to checkout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.exchange.mockResolvedValue({
      data: { user: { id: "customer-1", user_metadata: { firstName: "Camille" } } },
      error: null,
    });
  });

  it("preserves the cart return when asking the verified customer to log in", async () => {
    const next = "/boutique/fleurs-cbd?panier=1&origine=bretagne#catalogue";
    const response = await GET(callbackRequest(next));
    const destination = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(destination.origin).toBe("https://shop.example.test");
    expect(destination.pathname).toBe("/compte/connexion");
    expect(destination.searchParams.get("verified")).toBe("true");
    expect(destination.searchParams.get("next")).toBe(next);
    expect(mocks.exchange).toHaveBeenCalledWith("verification-code");
    expect(mocks.ensureProfile).toHaveBeenCalledWith(expect.objectContaining({ userId: "customer-1" }));
    expect(mocks.clearMetadata).toHaveBeenCalledWith("customer-1");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("");
  });

  it.each([
    undefined,
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "%2F%2Fevil.example",
    "/%5Cevil.example",
    "/%0Devil.example",
    "javascript:alert(1)",
    "/broken%",
  ])("blocks an unsafe return supplied directly to the callback: %s", async (next) => {
    const response = await GET(callbackRequest(next));
    expect(response.headers.get("location")).toBe("https://shop.example.test/compte/connexion?verified=true");
  });

  it.each(["missing", "expired"])("keeps the cart destination after a %s verification code", async (failure) => {
    if (failure === "expired") {
      mocks.exchange.mockResolvedValue({ data: { user: null }, error: { message: "Expired" } });
    }
    const response = await GET(callbackRequest("/boutique?panier=1", failure === "missing" ? null : "expired"));
    const destination = new URL(response.headers.get("location")!);

    expect(destination.searchParams.get("error")).toBe("verification_invalide");
    expect(destination.searchParams.get("next")).toBe("/boutique?panier=1");
    expect(destination.searchParams.has("verified")).toBe(false);
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
