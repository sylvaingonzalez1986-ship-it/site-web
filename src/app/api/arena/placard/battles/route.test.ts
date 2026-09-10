import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, getKqPlayerBattles, enqueueKqPlayerRandomBattle, leaveKqPlayerRandomBattleQueue, reconcileKqPlayerRandomBattleQueue, hitRateLimit } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerBattles: vi.fn(),
  enqueueKqPlayerRandomBattle: vi.fn(),
  leaveKqPlayerRandomBattleQueue: vi.fn(),
  reconcileKqPlayerRandomBattleQueue: vi.fn(),
  hitRateLimit: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  getKqPlayerBattles,
  enqueueKqPlayerRandomBattle,
  leaveKqPlayerRandomBattleQueue,
  reconcileKqPlayerRandomBattleQueue,
}));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection: vi.fn(),
}));

import { GET, POST } from "@/app/api/arena/placard/battles/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "88888888-8888-8888-8888-888888888888";
const flowerId = "99999999-9999-9999-9999-999999999999";
const request = (body: unknown) => new Request("http://localhost/api/arena/placard/battles", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/arena/placard/battles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId,
      customer: { email: "player@example.test" },
    });
    hitRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("cannot lock Flowers while the player API is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await POST(request({ flowerId, action: "join" }))).status).toBe(404);
    expect(enqueueKqPlayerRandomBattle).not.toHaveBeenCalled();
  });

  it("lists only the authenticated player's official duels", async () => {
    getKqPlayerBattles.mockResolvedValue([{ id: "battle-1" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqPlayerBattles).toHaveBeenCalledWith(customerId, 12);
  });

  it("queues an owned Flower without accepting a chosen rival", async () => {
    enqueueKqPlayerRandomBattle.mockResolvedValue({ matchStatus: "queued", flowerId, queuedAt: "2026-09-05T12:00:00Z" });
    const response = await POST(request({ flowerId, action: "join", rivalFlowerId: "ignored" }));
    expect(response.status).toBe(201);
    expect(enqueueKqPlayerRandomBattle).toHaveBeenCalledWith(customerId, flowerId);
  });

  it("lets the owner leave only while the Flower is still waiting", async () => {
    leaveKqPlayerRandomBattleQueue.mockResolvedValue({ left: true, flowerId });
    const response = await POST(request({ flowerId, action: "leave" }));
    expect(response.status).toBe(200);
    expect(leaveKqPlayerRandomBattleQueue).toHaveBeenCalledWith(customerId, flowerId);
  });

  it("retries a durable queue entry during client polling", async () => {
    reconcileKqPlayerRandomBattleQueue.mockResolvedValue({ matchStatus: "matched", battleId: "battle-1" });
    const response = await POST(request({ flowerId, action: "poll" }));
    expect(response.status).toBe(200);
    expect(reconcileKqPlayerRandomBattleQueue).toHaveBeenCalledWith(customerId, flowerId);
    expect(hitRateLimit).toHaveBeenCalledWith(expect.objectContaining({ maxHits: 70 }));
  });

  it("rejects incomplete and excessive requests before queueing", async () => {
    expect((await POST(request({}))).status).toBe(400);
    hitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    expect((await POST(request({ flowerId, action: "join" }))).status).toBe(429);
    expect(enqueueKqPlayerRandomBattle).not.toHaveBeenCalled();
  });
});
