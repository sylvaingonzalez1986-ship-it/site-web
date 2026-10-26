import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContestReviewVersionConflictError } from "@/lib/contest-review-moderation";

const mocks = vi.hoisted(() => ({ update: vi.fn(), submit: vi.fn(), review: vi.fn(), session: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/contest-backend", () => ({
  updateContestReview: mocks.update,
  getContestReviewForCustomer: mocks.review,
  submitContestReview: mocks.submit,
  isContestSchemaMissingError: () => false,
  CONTEST_SCHEMA_MISSING_MESSAGE: "Unavailable",
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: mocks.audit }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1", hitRateLimit: async () => ({ allowed: true }), logRateLimitRejection: vi.fn(),
}));

import { GET, POST, PUT } from "./route";

const version = "2026-10-04T10:00:00.123456+00:00";
const request = (body: unknown) => new Request("http://localhost/api/contest/reviews", {
  method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
  vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "true");
  vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", "true");
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-25T10:00:00Z"));
  mocks.session.mockResolvedValue({ customerId: "customer", customer: { email: "client@example.test", contestBetaEnabled: false } });
  mocks.update.mockResolvedValue({ id: "review", entryId: "entry", customerId: "customer", status: "pending", reviewedBy: "private" });
  mocks.submit.mockResolvedValue({ id: "review", entryId: "entry", customerId: "customer", status: "pending", reviewedBy: "private" });
  mocks.review.mockResolvedValue(null);
});

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Public notebook submissions before the game opens", () => {
  it("accepts an ordinary customer's review and keeps it pending moderation", async () => {
    const payload = { entryId: "flower", customerId: "forged-owner" };
    const response = await POST(request(payload));
    expect(response.status).toBe(200);
    expect(mocks.submit).toHaveBeenCalledWith({ customerId: "customer", customerEmail: "client@example.test", payload });
    const data = await response.json();
    expect(data.review.status).toBe("pending");
    expect(data.review).not.toHaveProperty("customerId");
    expect(data.review).not.toHaveProperty("reviewedBy");
  });

  it.each([GET, POST, PUT])("requires a verified session for personal notes", async handle => {
    mocks.session.mockResolvedValue(null);
    expect((await handle(request({ entryId: "flower", expectedUpdatedAt: version }))).status).toBe(401);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it("preserves the purchase eligibility rejection from the backend", async () => {
    mocks.submit.mockRejectedValue(new Error("Achat requis pour noter cette fleur."));
    const response = await POST(request({ entryId: "flower" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Achat requis pour noter cette fleur." });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("honors the independent notebook shutdown", async () => {
    vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", "false");
    expect((await POST(request({ entryId: "flower" }))).status).toBe(404);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });
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
