import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, GET } from "@/app/api/account/missions/route";
import { MissionRequestError } from "@/lib/mission-proof-policy";
const mocks = vi.hoisted(() => ({ session: vi.fn(), submit: vi.fn(), list: vi.fn(), referrals: vi.fn(), upload: vi.fn(), remove: vi.fn(), rate: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/missions-backend", () => ({ submitMissionProofByBackend: mocks.submit, getCustomerMissionsByBackend: mocks.list, getReferralPendingRewardsByBackend: mocks.referrals }));
vi.mock("@/lib/mission-proof-storage", () => ({ saveMissionProofUpload: mocks.upload, deleteMissionProof: mocks.remove, MissionProofUploadError: class extends Error { status = 415; } }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: mocks.audit }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", mission = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", key = "cccccccc-cccc-4ccc-8ccc-cccccccccccc", submissionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
function form(extra: Record<string, string | undefined> = {}, file = true) {
  const body = new FormData();
  for (const [name, value] of Object.entries({ missionId: mission, requestKey: key, proofUrl: "https://example.com/post/1", proofText: "Ma fleur", ...extra })) if (value !== undefined) body.set(name, value);
  if (file) body.set("file", new File(["fixture"], "proof.png", { type: "image/png" }));
  return body;
}
function request(body: FormData, origin = "https://example.test") { return new Request("https://example.test/api/account/missions", { method: "POST", headers: { origin }, body }); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ customerId: user });
  mocks.rate.mockResolvedValue({ allowed: true, retryAfterSeconds: 30 });
  mocks.upload.mockResolvedValue({ storagePath: user + "/new.webp", contentType: "image/webp", fileSize: 123 });
  mocks.submit.mockResolvedValue({ id: submissionId, proofStoragePath: user + "/new.webp", revision: 1 });
  mocks.list.mockResolvedValue([]); mocks.referrals.mockResolvedValue([]); mocks.remove.mockResolvedValue(undefined);
});
describe("mission submission API", () => {
  it("keeps multipart URL and sends only authenticated ownership plus normalized upload metadata", async () => {
    const response = await POST(request(form()));
    expect(response.status).toBe(200);
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ userId: user, missionId: mission, requestKey: key, proofUrl: "https://example.com/post/1", proofStoragePath: user + "/new.webp", proofContentType: "image/webp", proofFileSize: 123 }));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("allows a screenshot without a durable publication link", async () => {
    expect((await POST(request(form({ proofUrl: "" })))).status).toBe(200);
    expect(mocks.submit.mock.calls[0][0].proofUrl).toBeUndefined();
  });
  it("resubmits a correction with its revision and preserves existing proof when no replacement is uploaded", async () => {
    expect((await POST(request(form({ submissionId, expectedRevision: "2" }, false)))).status).toBe(200);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ submissionId, expectedRevision: 2, proofStoragePath: undefined }));
  });
  it.each(["https://attacker.test", "null"])("rejects cross-origin form posts before any upload: %s", async origin => {
    expect((await POST(request(form(), origin))).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request(form()))).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it.each([{ missionId: "bad" }, { requestKey: "" }, { proofUrl: "javascript:alert(1)" }, { submissionId, expectedRevision: "0" }, { proofText: "x".repeat(2001) }])("validates before allocating storage: %j", async extra => {
    expect((await POST(request(form(extra)))).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("removes only a fresh unused upload after an acknowledged idempotent replay", async () => {
    mocks.submit.mockResolvedValue({ id: submissionId, proofStoragePath: user + "/original.webp", revision: 1 });
    expect((await POST(request(form()))).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(user + "/new.webp");
  });
  it("never deletes a potentially committed upload after uncertain database failure and hides internal errors", async () => {
    mocks.submit.mockRejectedValue(new Error("private SQL detail and token"));
    const response = await POST(request(form()));
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("private SQL");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("exposes safe stale-revision conflict and stops repeated attempts", async () => {
    mocks.submit.mockRejectedValue(new MissionRequestError("Actualise la preuve.", 409));
    expect((await POST(request(form()))).status).toBe(409);
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const response = await POST(request(form()));
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("42");
  });
  it("caps oversized bodies before parsing or upload", async () => {
    const req = request(form()); req.headers.set("content-length", String(9 * 1024 * 1024));
    expect((await POST(req)).status).toBe(413); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("hides backend errors in the private history response", async () => {
    mocks.list.mockRejectedValue(new Error("relation secrets does not exist"));
    const response = await GET();
    expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("secrets");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

it("cleans a fresh upload only after a confirmed rolled-back SQL refusal", async () => {
  mocks.submit.mockRejectedValue(new MissionRequestError("Mission fermée.", 409, true));
  const response = await POST(request(form()));
  expect(response.status).toBe(409);
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(user + "/new.webp");
});
