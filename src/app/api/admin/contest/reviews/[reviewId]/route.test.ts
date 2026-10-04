import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContestReviewVersionConflictError } from "@/lib/contest-review-moderation";

const mocks = vi.hoisted(() => ({ moderate: vi.fn(), admin: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/contest-backend", () => ({
  moderateContestReview: mocks.moderate,
  isContestSchemaMissingError: () => false,
  CONTEST_SCHEMA_MISSING_MESSAGE: "Unavailable",
}));
vi.mock("@/lib/contest-feature", () => ({ isContestFeatureEnabledServer: () => true }));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext: mocks.admin }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: mocks.audit }));

import { PATCH } from "./route";

const updatedAt = "2026-10-04T12:34:56.123456+00:00";
const request = (payload: unknown) => new Request("http://localhost/api/admin/contest/reviews/review", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
});
const context = { params: Promise.resolve({ reviewId: "review" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ email: "admin@example.test" });
  mocks.moderate.mockResolvedValue(undefined);
});

describe("review moderation version", () => {
  it("requires the exact version examined by an authenticated administrator", async () => {
    const response = await PATCH(request({ status: "approved", expectedUpdatedAt: updatedAt, adminNote: "Merci" }), context);
    expect(response.status).toBe(200);
    expect(mocks.moderate).toHaveBeenCalledWith(expect.objectContaining({
      reviewId: "review", expectedUpdatedAt: updatedAt, status: "approved", adminNote: "Merci",
    }));
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

  it.each([undefined, "invalid-date", 123, {}])("rejects an absent or invalid version: %s", async version => {
    const response = await PATCH(request({ status: "approved", expectedUpdatedAt: version }), context);
    expect(response.status).toBe(400);
    expect(mocks.moderate).not.toHaveBeenCalled();
  });

  it("returns a conflict instead of approving an unseen edit", async () => {
    mocks.moderate.mockRejectedValue(new ContestReviewVersionConflictError());
    const response = await PATCH(request({ status: "approved", expectedUpdatedAt: updatedAt }), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("nouvelle version") });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("requires admin authentication even when a version is provided", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await PATCH(request({ status: "approved", expectedUpdatedAt: updatedAt }), context)).status).toBe(401);
    expect(mocks.moderate).not.toHaveBeenCalled();
  });
});
