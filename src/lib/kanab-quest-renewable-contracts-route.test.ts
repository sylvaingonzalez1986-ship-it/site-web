import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/arena/placard/contracts/board/route";
import { KqContractError } from "@/lib/supabase/kanab-quest-contracts-backend";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), rate: vi.fn(), log: vi.fn(), get: vi.fn(), change: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: mocks.log }));
vi.mock("@/lib/supabase/kanab-quest-renewable-contracts-backend", () => ({ getKqContractBoard: mocks.get, changeKqContractBoard: mocks.change }));

const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const command = { action: "accept", code: "pure-grower", attemptId };
const offers = [
  { code: "pure-grower", minimumQuality: 8, maxCardsUsed: 0, rewardCents: 1000 },
  { code: "steady-hand", minimumQuality: 10, maxCardsUsed: 2, rewardCents: 1500 },
  { code: "fine-flower", minimumQuality: 12, maxCardsUsed: null, rewardCents: 2000 },
];
const snapshot = { version: 2, unlocked: false, canAccept: false, reason: "Main légère", offers, current: null, completedCount: 0 };
const result = { board: snapshot, receipt: null, replayed: false };
const request = (body: string = JSON.stringify(command)) => new Request("http://localhost/api/arena/placard/contracts/board", {
  method: "POST", headers: { "content-type": "application/json" }, body,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ customerId: user, customer: { email: "fixture@example.test" } });
  mocks.rate.mockResolvedValue({ allowed: true, retryAfterSeconds: 30 });
  mocks.get.mockResolvedValue(snapshot);
  mocks.change.mockResolvedValue(result);
});

describe("private renewable contract API", () => {
  it("uses the authenticated customer and prevents caching of private progress", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(snapshot);
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(user);
    const mutation = await POST(request());
    expect(mutation.status).toBe(200);
    expect(mutation.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.change).toHaveBeenCalledExactlyOnceWith(user, command);
    expect(mocks.session).toHaveBeenCalledWith("identity");
  });

  it("checks the game gate before identity, database access or rate counters", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET()).status).toBe(404);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("requires login before reading or submitting contract attempts", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.change).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and shares the Main légère mutation rate budget", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect(mocks.change).not.toHaveBeenCalled();
    expect(mocks.rate).toHaveBeenCalledWith({ key: `kq_contracts:${user}`, windowSeconds: 60, maxHits: 20 });
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "POST /api/arena/placard/contracts/board", key: `kq_contracts:${user}` }));
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("never substitutes a body identity for the authenticated customer", async () => {
    const malicious = { ...command, userId: attemptId, rewardCents: 999999 };
    mocks.change.mockRejectedValue(new KqContractError("Demande de contrat invalide.", 400));
    expect((await POST(request(JSON.stringify(malicious)))).status).toBe(400);
    expect(mocks.change).toHaveBeenCalledExactlyOnceWith(user, malicious);
  });

  it("passes an idempotent replay through without manufacturing a second receipt", async () => {
    const receipt = { ...offers[0], id: attemptId, status: "claimed", runId: user, quality: 8, cardsUsed: 0, reason: null, cashAfterCents: 101000 };
    const replay = { board: { ...snapshot, unlocked: true, canAccept: true, current: receipt, completedCount: 1 }, receipt, replayed: true };
    mocks.change.mockResolvedValue(replay);
    const response = await POST(request(JSON.stringify({ action: "claim", attemptId })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(replay);
    expect(mocks.change).toHaveBeenCalledExactlyOnceWith(user, { action: "claim", attemptId });
  });

  it.each([400, 404, 409, 503])("preserves a safe server error and private caching policy: %s", async status => {
    mocks.get.mockRejectedValue(new KqContractError("Message sûr.", status));
    const response = await GET();
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Message sûr." });
  });

  it("hides internal failures from both reads and mutations", async () => {
    mocks.get.mockRejectedValue(new Error("private SQL table"));
    mocks.change.mockRejectedValue(new Error("private SQL table"));
    for (const response of [await GET(), await POST(request())]) {
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain("private SQL");
    }
  });
});
