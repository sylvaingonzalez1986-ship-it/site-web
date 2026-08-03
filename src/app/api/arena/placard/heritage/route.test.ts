import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, getKqPlayerHeritageSnapshot } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerHeritageSnapshot: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPlayerHeritageSnapshot }));

import { GET } from "@/app/api/arena/placard/heritage/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("GET /api/arena/placard/heritage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
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
});
