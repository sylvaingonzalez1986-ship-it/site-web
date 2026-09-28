import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PUT } from "@/app/api/admin/missions/route";
import { MissionRequestError } from "@/lib/mission-proof-policy";
const mocks = vi.hoisted(() => ({ denied: vi.fn(), context: vi.fn(), review: vi.fn(), create: vi.fn(), rate: vi.fn(), overview: vi.fn(), missions: vi.fn(), buddies: vi.fn() }));
vi.mock("@/lib/admin-guard", () => ({ denyIfNotAdminApi: mocks.denied, getValidatedAdminContext: mocks.context }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: mocks.rate }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/missions-backend", () => ({
  reviewMissionSubmissionByBackend: mocks.review, createSocialMissionByBackend: mocks.create,
  getAdminMissionsOverviewByBackend: mocks.overview, getAdminSocialMissionsByBackend: mocks.missions,
  getMissionBuddyOptionsByBackend: mocks.buddies, getAdminReferralPendingRewardsByBackend: vi.fn().mockResolvedValue([]),
  getReferralRewardSettingsByBackend: vi.fn().mockResolvedValue({}), reorderSocialMissionsByBackend: vi.fn(),
  updateReferralRewardSettingsByBackend: vi.fn(), updateSocialMissionByBackend: vi.fn(),
}));
const submissionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", requestKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function req(payload: object, method = "POST", origin = "https://example.test") { return new Request("https://example.test/api/admin/missions", { method, headers: { origin, "content-type": "application/json" }, body: JSON.stringify(payload) }); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.denied.mockResolvedValue(null); mocks.context.mockResolvedValue({ email: "admin@example.test" }); mocks.rate.mockResolvedValue({ allowed: true });
  mocks.review.mockResolvedValue(undefined); mocks.overview.mockResolvedValue({ submissions: [] }); mocks.missions.mockResolvedValue([]);
  mocks.buddies.mockResolvedValue([{ id: requestKey, name: "Buddy", rarity: "common", imageUrl: "/buddy.webp" }]);
});
describe("admin mission review API", () => {
  it("uses validated admin identity and forwards exact revision, action, and idempotency key", async () => {
    expect((await POST(req({ submissionId, requestKey, expectedRevision: 3, action: "request_changes", adminNote: "Pseudo manquant", adminEmail: "spoof@example.test" }))).status).toBe(200);
    expect(mocks.review).toHaveBeenCalledExactlyOnceWith({ submissionId, requestKey, expectedRevision: 3, action: "request_changes", adminNote: "Pseudo manquant", adminEmail: "admin@example.test" });
  });
  it("rejects cross-origin requests before review or catalogue mutations", async () => {
    expect((await POST(req({}, "POST", "https://attacker.test"))).status).toBe(403);
    expect((await PUT(req({}, "PUT", "https://attacker.test"))).status).toBe(403);
    expect(mocks.review).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("requires verified admin access", async () => {
    mocks.denied.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    expect((await POST(req({ submissionId, requestKey, expectedRevision: 1, action: "approve" }))).status).toBe(403);
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it.each([{ expectedRevision: 0 }, { requestKey: "" }, { action: "autoapprove" }])("rejects invalid review commands: %j", async extra => {
    expect((await POST(req({ submissionId, requestKey, expectedRevision: 1, action: "approve", ...extra }))).status).toBe(400);
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it("returns safe conflicts and hides unknown database errors", async () => {
    mocks.review.mockRejectedValueOnce(new MissionRequestError("La preuve a changé.", 409)).mockRejectedValueOnce(new Error("secret SQL path"));
    expect((await POST(req({ submissionId, requestKey, expectedRevision: 1, action: "approve" }))).status).toBe(409);
    const response = await POST(req({ submissionId, requestKey, expectedRevision: 1, action: "approve" }));
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
  it("returns safe Buddy choices and disables caching on the review dashboard", async () => {
    const response = await GET();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ buddyOptions: [{ id: requestKey, name: "Buddy" }] });
  });
});
