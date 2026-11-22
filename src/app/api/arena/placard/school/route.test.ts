import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { enabled, session, snapshot, submit, progress, rate, log } = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), snapshot: vi.fn(), submit: vi.fn(), progress: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqGameRequestEnabled: enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: rate, logRateLimitRejection: log }));
vi.mock("@/lib/supabase/kanab-quest-school-backend", () => ({ getKqSchoolSnapshot: snapshot, submitKqSchoolQuiz: submit, saveKqSchoolProgress: progress }));
import { GET } from "./route";
import { GET as GET_QUIZ, POST as POST_QUIZ } from "./quiz/route";
import { POST as POST_PROGRESS } from "./progress/route";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
const owner = "12345678-1234-4123-8123-123456789abc";
const body = () => ({ requestKey: owner, quizId: "plant", contentVersion: "2026-11-11.1", answers: Array.from({ length: 10 }, (_, index) => ({ questionId: `plant-q${String(index + 1).padStart(2, "0")}`, optionId: "a" })) });
const request = (value: unknown = body(), headers?: Record<string, string>, suffix = "quiz") => new Request(`http://localhost/api/arena/placard/school/${suffix}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(value) });
beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-school-feedback-test-key");
  vi.clearAllMocks(); enabled.mockResolvedValue(true); session.mockResolvedValue({ customerId: owner, customer: { email: "player@example.test" } });
  rate.mockResolvedValue({ allowed: true }); snapshot.mockResolvedValue({ version: 1 }); submit.mockResolvedValue({ replayed: false }); progress.mockResolvedValue({ version: 1 });
});
afterEach(() => vi.unstubAllEnvs());
describe("school API security boundaries", () => {
  it("requires feature availability and authenticated identity before any school access", async () => {
    enabled.mockResolvedValue(false); expect((await GET(new Request("http://localhost/api/arena/placard/school"))).status).toBe(404);
    expect(session).not.toHaveBeenCalled(); enabled.mockResolvedValue(true); session.mockResolvedValue(null);
    expect((await POST_QUIZ(request())).status).toBe(401); expect(submit).not.toHaveBeenCalled(); expect(rate).not.toHaveBeenCalled();
  });
  it("preserves authenticated school history and prevents caching", async () => {
    const response = await GET(new Request("http://localhost/api/arena/placard/school"));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect(snapshot).toHaveBeenCalledExactlyOnceWith(owner);
  });
  it("retires legacy quiz submissions without awarding new rewards", async () => {
    const response = await POST_QUIZ(request());
    expect(response.status).toBe(410); expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect(response.headers.get("Location")).toBe("/arene/placard?view=school&section=tournament");
    expect(await response.json()).toEqual({ error: "Le quiz solo a fermé. Rejoins le tournoi du chanvre.", code: "school_quiz_retired", redirectTo: "/arene/placard?view=school&section=tournament" });
    expect((await POST_QUIZ(request({ ...body(), userId: "victim", score: 10 }))).status).toBe(410);
    expect(submit).not.toHaveBeenCalled();
  });
  it("rejects cross-site writes including progress", async () => {
    expect((await POST_QUIZ(request(body(), { origin: "https://attacker.test" }))).status).toBe(403);
    expect((await POST_PROGRESS(request({ lessonIds: ["plant"], workshopIds: [] }, { "sec-fetch-site": "cross-site" }, "progress"))).status).toBe(403);
    expect(submit).not.toHaveBeenCalled(); expect(progress).not.toHaveBeenCalled();
  });
  it("prevents an old tab from submitting its draft after an account change", async () => {
    const response = await POST_QUIZ(request(body(), { "X-Kq-School-Owner": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
    expect(response.status).toBe(409); expect((await response.json()).code).toBe("school_owner_changed");
    expect(submit).not.toHaveBeenCalled(); expect(rate).not.toHaveBeenCalled();
    expect(response.headers.has("Location")).toBe(false);
    expect((await POST_QUIZ(request(body(), { "X-Kq-School-Owner": owner }))).status).toBe(410);
    expect(submit).not.toHaveBeenCalled();
  });
  it("retains payload limits and strict parsing for encyclopedia progress", async () => {
    const value = { lessonIds: ["plant"], workshopIds: [] };
    expect((await POST_PROGRESS(request({ ...value, padding: "x".repeat(9000) }, {}, "progress"))).status).toBe(413);
    expect((await POST_PROGRESS(request({ ...value, score: 10 }, {}, "progress"))).status).toBe(400);
    expect(progress).not.toHaveBeenCalled();
  });
  it("does not start a legacy quiz or reveal answer keys", async () => {
    const response = await GET_QUIZ(new Request("http://localhost/api/arena/placard/school/quiz?quizId=law"));
    expect(response.status).toBe(410); const quiz = await response.json();
    expect(quiz.questions).toBeUndefined(); expect(quiz.code).toBe("school_quiz_retired");
    expect(JSON.stringify(quiz)).not.toContain("correctOptionId");
    expect(JSON.stringify(quiz)).not.toContain('"explanation"');
  });
  it("persists a bounded progress batch using the same session", async () => {
    const value = { lessonIds: ["plant"], workshopIds: ["crossword-plant"] };
    expect((await POST_PROGRESS(request(value, {}, "progress"))).status).toBe(200);
    expect(progress).toHaveBeenCalledExactlyOnceWith(owner, value);
  });
  it("rate limits submissions and returns retry information", async () => {
    rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 23 });
    const response = await POST_QUIZ(request()); expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("23");
    expect(rate).toHaveBeenCalledExactlyOnceWith({ key: `kq_school_submit:${owner}`, windowSeconds: 60, maxHits: 12 });
    expect(log).toHaveBeenCalledOnce(); expect(submit).not.toHaveBeenCalled();
  });
  it("preserves school errors and hides infrastructure errors when reading history", async () => {
    snapshot.mockRejectedValueOnce(new KqSchoolError("Progression actualisée.", 409, "school_owner_changed"));
    const stale = await GET(new Request("http://localhost/api/arena/placard/school")); expect(stale.status).toBe(409); expect((await stale.json()).code).toBe("school_owner_changed");
    snapshot.mockRejectedValueOnce(new Error("private credentials"));
    const unavailable = await GET(new Request("http://localhost/api/arena/placard/school")); expect(unavailable.status).toBe(503); expect(await unavailable.text()).not.toContain("credentials");
  });
});
