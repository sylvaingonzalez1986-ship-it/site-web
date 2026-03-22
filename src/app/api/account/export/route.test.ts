import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentCustomerSessionByBackend,
  mockExportCustomerData,
  mockGetRequestIp,
  mockHitRateLimit,
  mockLogRateLimitRejection,
  mockLogAuditEvent,
} = vi.hoisted(() => ({
  mockGetCurrentCustomerSessionByBackend: vi.fn(),
  mockExportCustomerData: vi.fn(),
  mockGetRequestIp: vi.fn(() => "127.0.0.1"),
  mockHitRateLimit: vi.fn(),
  mockLogRateLimitRejection: vi.fn(),
  mockLogAuditEvent: vi.fn(),
}));

vi.mock("@/lib/customer-backend", () => ({
  getCurrentCustomerSessionByBackend: mockGetCurrentCustomerSessionByBackend,
}));

vi.mock("@/lib/customer-data-export", () => ({
  exportCustomerData: mockExportCustomerData,
}));

vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: mockGetRequestIp,
  hitRateLimit: mockHitRateLimit,
  logRateLimitRejection: mockLogRateLimitRejection,
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: mockLogAuditEvent,
}));

import { GET } from "@/app/api/account/export/route";

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHitRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when the customer is not authenticated", async () => {
    mockGetCurrentCustomerSessionByBackend.mockResolvedValue(null);

    const response = await GET(new Request("https://example.test/api/account/export"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Non autorise." });
  });

  it("returns 429 when the export rate limit is exceeded", async () => {
    mockGetCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId: "customer-1",
      customer: { email: "user@example.com" },
    });
    mockHitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 });

    const response = await GET(new Request("https://example.test/api/account/export"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    await expect(response.json()).resolves.toEqual({
      error: "Trop de demandes d'export. Reessaie plus tard.",
    });
    expect(mockLogRateLimitRejection).toHaveBeenCalledOnce();
  });

  it("returns a JSON attachment and logs the export", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-03T09:15:00.000Z"));
    mockGetCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId: "customer-1",
      customer: { email: "user@example.com" },
    });
    mockExportCustomerData.mockResolvedValue({
      customerId: "customer-1",
      orders: [{ id: "order-1" }],
      lotteryTickets: [{ id: "ticket-1" }],
    });

    const response = await GET(new Request("https://example.test/api/account/export"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="mes-donnees-2026-02-03.json"',
    );
    await expect(response.json()).resolves.toEqual({
      customerId: "customer-1",
      orders: [{ id: "order-1" }],
      lotteryTickets: [{ id: "ticket-1" }],
    });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "customer_data_export",
        actorEmail: "user@example.com",
      }),
    );
  });
});