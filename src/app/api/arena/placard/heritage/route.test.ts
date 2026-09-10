import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCustomerSessionByBackend,
  getKqPlayerHeritageSnapshot,
  craftKqPlayerHeritageCard,
  hitRateLimit,
  logRateLimitRejection,
} = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerHeritageSnapshot: vi.fn(),
  craftKqPlayerHeritageCard: vi.fn(),
  hitRateLimit: vi.fn(),
  logRateLimitRejection: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection,
}));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPlayerHeritageSnapshot, craftKqPlayerHeritageCard }));

import { GET, POST } from "@/app/api/arena/placard/heritage/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("GET /api/arena/placard/heritage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId, customer: { email: "joueur@example.test" } });
    hitRateLimit.mockResolvedValue({ allowed: true, remaining: 11, retryAfterSeconds: 0 });
  });
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("stays hidden while player access is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await GET()).status).toBe(404);
    expect(getKqPlayerHeritageSnapshot).not.toHaveBeenCalled();
  });

  it("requires the current customer", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns a read-only sanitized collection", async () => {
    getKqPlayerHeritageSnapshot.mockResolvedValue({
      collectionActive: true,
      fragmentBalance: 4,
      eligiblePurchaseUnits: 8,
      draws: [{ id: "private-draw" }],
      cards: [{
        code: "HERITAGE-001", name: "Mémoire du sol",
        description: "Effet", imageUrl: "", isActive: true, ownedCopies: 1,
        effectCode: "private-effect",
      }],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cards[0]).not.toHaveProperty("effectCode");
    expect(body.cards[0]).not.toHaveProperty("rarity");
    expect(body).not.toHaveProperty("draws");
    expect(body).not.toHaveProperty("eligiblePurchaseUnits");
    expect(getKqPlayerHeritageSnapshot).toHaveBeenCalledWith(customerId);
  });

  it("does not leak backend errors", async () => {
    getKqPlayerHeritageSnapshot.mockRejectedValue(new Error("[supabase:secret] private detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });

  it("crafts a missing active Heritage for the authenticated customer", async () => {
    craftKqPlayerHeritageCard.mockResolvedValue({
      fragmentBalance: 3,
      draw: { id: "draw-1", cardCode: "HERITAGE-013", source: "craft" },
    });
    const response = await POST(new Request("http://localhost/api/arena/placard/heritage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardCode: "HERITAGE-013" }),
    }));
    expect(response.status).toBe(201);
    expect(craftKqPlayerHeritageCard).toHaveBeenCalledWith(customerId, "HERITAGE-013");
    expect(await response.json()).toMatchObject({ fragmentBalance: 3, draw: { cardCode: "HERITAGE-013" } });
  });

  it("keeps crafting hidden before player access and requires the current customer", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    const hidden = await POST(new Request("http://localhost/api/arena/placard/heritage", {
      method: "POST",
      body: JSON.stringify({ cardCode: "HERITAGE-013" }),
    }));
    expect(hidden.status).toBe(404);
    expect(craftKqPlayerHeritageCard).not.toHaveBeenCalled();

    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValueOnce(null);
    const unauthorized = await POST(new Request("http://localhost/api/arena/placard/heritage", {
      method: "POST",
      body: JSON.stringify({ cardCode: "HERITAGE-013" }),
    }));
    expect(unauthorized.status).toBe(401);
    expect(craftKqPlayerHeritageCard).not.toHaveBeenCalled();
  });

  it("rejects malformed card codes before the backend mutation", async () => {
    const response = await POST(new Request("http://localhost/api/arena/placard/heritage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardCode: "HERITAGE-any" }),
    }));
    expect(response.status).toBe(400);
    expect(craftKqPlayerHeritageCard).not.toHaveBeenCalled();
  });

  it("returns safe crafting conflicts without leaking backend details", async () => {
    craftKqPlayerHeritageCard.mockRejectedValueOnce(new Error("Solde de fragments insuffisant."));
    const insufficient = await POST(new Request("http://localhost/api/arena/placard/heritage", {
      method: "POST",
      body: JSON.stringify({ cardCode: "HERITAGE-013" }),
    }));
    expect(insufficient.status).toBe(409);
    expect(await insufficient.json()).toEqual({ error: "Solde de fragments insuffisant." });

    craftKqPlayerHeritageCard.mockRejectedValueOnce(new Error("[supabase:private] secret"));
    const unavailable = await POST(new Request("http://localhost/api/arena/placard/heritage", {
      method: "POST",
      body: JSON.stringify({ cardCode: "HERITAGE-013" }),
    }));
    expect(unavailable.status).toBe(409);
    expect(await unavailable.json()).toEqual({ error: "Fabrication impossible." });
  });

  it("rate limits repeated crafting attempts", async () => {
    hitRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 45 });
    const response = await POST(new Request("http://localhost/api/arena/placard/heritage", {
      method: "POST",
      body: JSON.stringify({ cardCode: "HERITAGE-013" }),
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("45");
    expect(logRateLimitRejection).toHaveBeenCalledOnce();
    expect(craftKqPlayerHeritageCard).not.toHaveBeenCalled();
  });
});
