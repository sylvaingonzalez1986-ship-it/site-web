import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContestReviewVersionConflictError } from "@/lib/contest-review-moderation";

const mocks = vi.hoisted(() => ({ update: vi.fn(), session: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/contest-backend", () => ({
  updateContestReview: mocks.update,
  getContestReviewForCustomer: vi.fn(),
  submitContestReview: vi.fn(),
  isContestSchemaMissingError: () => false,
  CONTEST_SCHEMA_MISSING_MESSAGE: "Unavailable",
}));
vi.mock("@/lib/contest-feature", () => ({ getContestFeatureAccessDeniedResponse: async () => null }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: mocks.audit }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1", hitRateLimit: async () => ({ allowed: true }), logRateLimitRejection: vi.fn(),
}));

import { PUT } from "./route";

const version = "2026-10-04T10:00:00.123456+00:00";
const request = (body: unknown) => new Request("http://localhost/api/contest/reviews", {
  method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ customerId: "customer", customer: { email: "client@example.test" } });
  mocks.update.mockResolvedValue({ id: "review", entryId: "entry", customerId: "customer", status: "pending", reviewedBy: "private" });
});

describe("versioned review corrections", () => {
  it("passes the exact version and verified identity to the backend", async () => {
    const payload = { entryId: "entry", expectedUpdatedAt: version };
    const response = await PUT(request(payload));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ customerId: "customer", customerEmail: "client@example.test", payload });
    const data = await response.json();
    expect(data.review.status).toBe("pending");
    expect(data.review).not.toHaveProperty("customerId");
    expect(data.review).not.toHaveProperty("reviewedBy");
  });

  it.each([undefined, "invalid", 42])("rejects missing/invalid version %s", async expectedUpdatedAt => {
    expect((await PUT(request({ entryId: "entry", expectedUpdatedAt }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns a conflict without logging a successful save for an obsolete tab", async () => {
    mocks.update.mockRejectedValue(new ContestReviewVersionConflictError("Cet avis a changé. Recharge sa nouvelle version."));
    const response = await PUT(request({ entryId: "entry", expectedUpdatedAt: version }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("nouvelle version") });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("requires authentication even with a valid version", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await PUT(request({ entryId: "entry", expectedUpdatedAt: version }))).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
