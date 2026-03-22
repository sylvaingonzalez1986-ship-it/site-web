import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentCustomerSessionByBackend,
  mockClearLegacyCustomerCookie,
  mockDeleteCustomerAccount,
  mockNormalizeDeletionConfirmationEmail,
  mockRejectOversizedBody,
  mockGetRequestIp,
  mockHitRateLimit,
  mockLogRateLimitRejection,
  mockLogAuditEvent,
  mockCookies,
} = vi.hoisted(() => ({
  mockGetCurrentCustomerSessionByBackend: vi.fn(),
  mockClearLegacyCustomerCookie: vi.fn(),
  mockDeleteCustomerAccount: vi.fn(),
  mockNormalizeDeletionConfirmationEmail: vi.fn((value: unknown) =>
    typeof value === "string" ? value.trim().toLowerCase() : "",
  ),
  mockRejectOversizedBody: vi.fn(),
  mockGetRequestIp: vi.fn(() => "127.0.0.1"),
  mockHitRateLimit: vi.fn(),
  mockLogRateLimitRejection: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/customer-backend", () => ({
  getCurrentCustomerSessionByBackend: mockGetCurrentCustomerSessionByBackend,
  clearLegacyCustomerCookie: mockClearLegacyCustomerCookie,
}));

vi.mock("@/lib/customer-account-deletion", () => ({
  deleteCustomerAccount: mockDeleteCustomerAccount,
  normalizeDeletionConfirmationEmail: mockNormalizeDeletionConfirmationEmail,
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

vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE_NAME: "lcb_admin_session",
  getAdminCookieOptions: () => ({
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 0,
  }),
}));

import { DELETE } from "@/app/api/account/delete/route";

describe("DELETE /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRejectOversizedBody.mockReturnValue(null);
    mockHitRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mockCookies.mockResolvedValue({
      getAll: () => [
        { name: "sb-project-auth-token" },
        { name: "unrelated-cookie" },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 400 when the confirmation email does not match", async () => {
    mockGetCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId: "customer-1",
      customer: { email: "user@example.com" },
    });

    const response = await DELETE(
      new Request("https://example.test/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: "other@example.com" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Confirmation invalide. Saisis l'e-mail exact du compte.",
    });
    expect(mockDeleteCustomerAccount).not.toHaveBeenCalled();
  });

  it("returns 429 when the delete rate limit is exceeded", async () => {
    mockGetCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId: "customer-1",
      customer: { email: "user@example.com" },
    });
    mockHitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 300 });

    const response = await DELETE(
      new Request("https://example.test/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: "user@example.com" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(mockLogRateLimitRejection).toHaveBeenCalledOnce();
  });

  it("deletes the account, logs the action, and clears session cookies", async () => {
    mockGetCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId: "customer-1",
      customer: { email: "user@example.com" },
    });
    mockDeleteCustomerAccount.mockResolvedValue({
      anonymizedOrderCount: 2,
      deletedNewsletterSubscription: true,
      deletedMissionProofCount: 1,
    });

    const response = await DELETE(
      new Request("https://example.test/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: " USER@example.com " }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockDeleteCustomerAccount).toHaveBeenCalledWith({
      customerId: "customer-1",
      customerEmail: "user@example.com",
    });
    expect(mockClearLegacyCustomerCookie).toHaveBeenCalledOnce();
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "customer_account_deleted",
        actorEmail: "user@example.com",
      }),
    );
    expect(response.headers.get("set-cookie")).toContain("lcb_admin_session=");
    expect(response.headers.get("set-cookie")).toContain("sb-project-auth-token=");
  });
});