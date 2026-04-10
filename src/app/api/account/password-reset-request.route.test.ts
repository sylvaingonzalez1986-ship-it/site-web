import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequestCustomerPasswordResetByBackend,
  mockRejectOversizedBody,
  mockGetRequestIp,
  mockHitRateLimit,
  mockLogRateLimitRejection,
  mockLogAuditEvent,
  mockGetSiteUrl,
} = vi.hoisted(() => ({
  mockRequestCustomerPasswordResetByBackend: vi.fn(),
  mockRejectOversizedBody: vi.fn(),
  mockGetRequestIp: vi.fn(() => "127.0.0.1"),
  mockHitRateLimit: vi.fn(),
  mockLogRateLimitRejection: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockGetSiteUrl: vi.fn(() => "https://example.test"),
}));

vi.mock("@/lib/customer-backend", () => ({
  requestCustomerPasswordResetByBackend: mockRequestCustomerPasswordResetByBackend,
}));

vi.mock("@/lib/body-size-guard", () => ({
  rejectOversizedBody: mockRejectOversizedBody,
}));

vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: mockGetRequestIp,
  hitRateLimit: mockHitRateLimit,
  logRateLimitRejection: mockLogRateLimitRejection,
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: mockLogAuditEvent,
}));

vi.mock("@/lib/site-url", () => ({
  getSiteUrl: mockGetSiteUrl,
}));

import { POST } from "@/app/api/account/password-reset/request/route";

describe("POST /api/account/password-reset/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRejectOversizedBody.mockReturnValue(null);
    mockHitRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("returns 400 when the email is missing", async () => {
    const response = await POST(
      new Request("https://example.test/api/account/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next: "/profil" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Adresse email manquante." });
    expect(mockRequestCustomerPasswordResetByBackend).not.toHaveBeenCalled();
  });

  it("returns 429 when the IP rate limit is exceeded", async () => {
    mockHitRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 300 });

    const response = await POST(
      new Request("https://example.test/api/account/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "client@example.com" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(mockLogRateLimitRejection).toHaveBeenCalledOnce();
  });

  it("sends a reset request with a sanitized redirect URL and returns a generic message", async () => {
    const response = await POST(
      new Request("https://example.test/api/account/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "Client@Example.com ",
          next: "//evil.example",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message:
        "Si un compte existe pour cette adresse, un email de reinitialisation vient d'etre envoye.",
    });
    expect(mockRequestCustomerPasswordResetByBackend).toHaveBeenCalledWith({
      email: "client@example.com",
      redirectTo: "https://example.test/compte/reinitialiser-mot-de-passe",
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "customer_password_reset_requested",
        actorEmail: "client@example.com",
      }),
    );
  });

  it("returns the same generic success message when Supabase email throttling is hit", async () => {
    mockRequestCustomerPasswordResetByBackend.mockRejectedValue(
      new Error("password_reset_email_rate_limited"),
    );

    const response = await POST(
      new Request("https://example.test/api/account/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "client@example.com",
          next: "/profil",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message:
        "Si un compte existe pour cette adresse, un email de reinitialisation vient d'etre envoye.",
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "customer_password_reset_requested",
        actorEmail: "client@example.com",
        metadata: expect.objectContaining({ providerRateLimited: true }),
      }),
    );
  });
});
