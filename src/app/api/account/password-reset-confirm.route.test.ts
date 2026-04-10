import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResetCustomerPasswordByBackend,
  mockClearLegacyCustomerCookie,
  mockRejectOversizedBody,
  mockGetRequestIp,
  mockLogAuditEvent,
  mockCookies,
} = vi.hoisted(() => ({
  mockResetCustomerPasswordByBackend: vi.fn(),
  mockClearLegacyCustomerCookie: vi.fn(),
  mockRejectOversizedBody: vi.fn(),
  mockGetRequestIp: vi.fn(() => "127.0.0.1"),
  mockLogAuditEvent: vi.fn(),
  mockCookies: vi.fn(async () => ({ getAll: () => [] })),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/customer-backend", () => ({
  resetCustomerPasswordByBackend: mockResetCustomerPasswordByBackend,
  clearLegacyCustomerCookie: mockClearLegacyCustomerCookie,
}));

vi.mock("@/lib/body-size-guard", () => ({
  rejectOversizedBody: mockRejectOversizedBody,
}));

vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: mockGetRequestIp,
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: mockLogAuditEvent,
}));

import { POST } from "@/app/api/account/password-reset/confirm/route";

describe("POST /api/account/password-reset/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRejectOversizedBody.mockReturnValue(null);
    mockCookies.mockResolvedValue({ getAll: () => [] });
  });

  it("returns 400 when the password is too short", async () => {
    const response = await POST(
      new Request("https://example.test/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "short" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Le mot de passe doit contenir au moins 8 caracteres.",
    });
    expect(mockResetCustomerPasswordByBackend).not.toHaveBeenCalled();
  });

  it("returns 401 when no recovery proof is provided", async () => {
    const response = await POST(
      new Request("https://example.test/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "ValidPass123!" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Lien invalide ou expire. Redemande un nouvel email.",
    });
    expect(mockResetCustomerPasswordByBackend).not.toHaveBeenCalled();
  });

  it("returns 401 when the recovery session is missing or expired", async () => {
    mockResetCustomerPasswordByBackend.mockRejectedValue(new Error("password_reset_session_invalid"));

    const response = await POST(
      new Request("https://example.test/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: "ValidPass123!",
          accessToken: "access-token",
          refreshToken: "refresh-token",
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Lien invalide ou expire. Redemande un nouvel email.",
    });
  });

  it("updates the password, clears the legacy cookie, and logs the action", async () => {
    mockResetCustomerPasswordByBackend.mockResolvedValue({ email: "client@example.com" });

    const response = await POST(
      new Request("https://example.test/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: "ValidPass123!",
          accessToken: "access-token",
          refreshToken: "refresh-token",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockResetCustomerPasswordByBackend).toHaveBeenCalledWith({
      password: "ValidPass123!",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenHash: undefined,
    });
    expect(mockClearLegacyCustomerCookie).toHaveBeenCalledOnce();
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "customer_password_reset_completed",
        actorEmail: "client@example.com",
      }),
    );
  });
});
