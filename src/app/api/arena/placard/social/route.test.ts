import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { enabled, session, social, rate, log } = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), social: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: rate, logRateLimitRejection: log }));
vi.mock("@/lib/supabase/kanab-quest-social-backend", async original => ({ ...await original<typeof import("@/lib/supabase/kanab-quest-social-backend")>(), getKqSocial: social }));
import { GET, POST } from "./route";
import { KqSocialError } from "@/lib/supabase/kanab-quest-social-backend";
const id = "12345678-1234-4123-8123-123456789abc";
const command = { modelVersion: 2, action: "recover", requestKey: id, expectedRevision: 3 };
const getRequest = () => new Request("http://localhost/api/arena/placard/social");
const request = (body: unknown = command, headers?: Record<string, string>) => new Request("http://localhost/api/arena/placard/social", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks(); enabled.mockResolvedValue(true); session.mockResolvedValue({ customerId: "owner", customer: { email: "player@example.test" } });
  rate.mockResolvedValue({ allowed: true }); social.mockResolvedValue({ version: 1 });
});
afterEach(() => vi.unstubAllEnvs());
describe("social adventure API", () => {
  it("requires the feature and an authenticated player before reading state", async () => {
    enabled.mockResolvedValue(false); expect((await GET(getRequest())).status).toBe(404); expect(session).not.toHaveBeenCalled();
    enabled.mockResolvedValue(true); session.mockResolvedValue(null); expect((await POST(request())).status).toBe(401);
    expect(social).not.toHaveBeenCalled(); expect(rate).not.toHaveBeenCalled();
  });
  it("returns a private snapshot and uses only session ownership", async () => {
    const read = await GET(getRequest()); expect(read.status).toBe(200); expect(social).toHaveBeenCalledWith("owner");
    const write = await POST(request()); expect(write.status).toBe(200); expect(social).toHaveBeenCalledWith("owner", command);
    expect(read.headers.get("Cache-Control")).toContain("private, no-store");
    expect(write.headers.get("Cache-Control")).toContain("private, no-store");
  });
  it.each([{ userId: "victim" }, { followers: 5000 }, { expectedRevision: -1 }, { requestKey: "bad" }])("rejects invalid or forged command fields %j", async extra => {
    expect((await POST(request({ ...command, ...extra }))).status).toBe(400); expect(social).not.toHaveBeenCalled();
  });
  it("blocks cross-origin commands", async () => {
    expect((await POST(request(command, { origin: "https://attacker.test" }))).status).toBe(403);
    expect((await POST(request(command, { "sec-fetch-site": "cross-site" }))).status).toBe(403); expect(social).not.toHaveBeenCalled();
  });
  it("accepts an authenticated smartphone publication through the local bind address", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const publication = { modelVersion: 2, action: "choose", requestKey: id, expectedRevision: 3,
      platform: "instagram", scenarioId: "ig-first-frame", choiceId: "workshop",
      narrativeVersion: 3, subjectId: "general", contextKey: "v3-1234abcd" };
    const response = await POST(new Request("http://0.0.0.0:3000/api/arena/placard/social", {
      method: "POST", headers: { "Content-Type": "application/json", origin: "http://192.168.1.24:3000", host: "192.168.1.24:3000" },
      body: JSON.stringify(publication),
    }));
    expect(response.status).toBe(200);
    expect(social).toHaveBeenCalledWith("owner", publication);
  });
  it("limits actual body bytes even without a Content-Length header", async () => {
    expect((await POST(request({ ...command, padding: "x".repeat(3000) }))).status).toBe(413); expect(social).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON before calling the backend", async () => {
    const malformed = new Request("http://localhost/api/arena/placard/social", { method: "POST", body: "{" });
    expect((await POST(malformed)).status).toBe(400); expect(social).not.toHaveBeenCalled();
  });
  it.each(["GET", "POST"])("rate limits and logs %s access", async method => {
    rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 31 });
    const response = method === "GET" ? await GET(getRequest()) : await POST(request());
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("31"); expect(social).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ endpoint: `${method} /api/arena/placard/social`, key: "kq_social:owner" }));
  });
  it("returns a stale-state conflict that the client can recover by refreshing", async () => {
    social.mockRejectedValue(new KqSocialError("Actualise ton aventure.", 409));
    const response = await POST(request()); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "Actualise ton aventure." });
  });
  it("keeps unexpected backend details private", async () => {
    social.mockRejectedValue(new Error("private credentials"));
    const response = await GET(getRequest()); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("credentials");
  });
});
