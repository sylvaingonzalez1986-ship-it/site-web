import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, getKqPlayerCollectionSnapshot, getKqPlayerOwnedBuddieCodes } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerCollectionSnapshot: vi.fn(),
  getKqPlayerOwnedBuddieCodes: vi.fn(),
}));

vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  getKqPlayerCollectionSnapshot,
  getKqPlayerOwnedBuddieCodes,
}));

import { GET } from "@/app/api/arena/placard/collection/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "22222222-2222-2222-2222-222222222222";

describe("GET /api/arena/placard/collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
  });

  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("is hidden while the player API is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await GET()).status).toBe(404);
    expect(getCurrentCustomerSessionByBackend).not.toHaveBeenCalled();
  });

  it("requires the current customer", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("loads only the authenticated customer's physical copies and wallet", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
    getKqPlayerCollectionSnapshot.mockResolvedValue({
      ownerFound: true,
      collectionActive: false,
      cultureTokenBalance: 2,
      inventory: { "BOTTE-001": 1 },
      cards: [],
    });
    getKqPlayerOwnedBuddieCodes.mockResolvedValue(["HH2026-003"]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqPlayerCollectionSnapshot).toHaveBeenCalledWith(customerId);
    expect(getKqPlayerOwnedBuddieCodes).toHaveBeenCalledWith(customerId);
    expect(await response.json()).toMatchObject({
      collection: { cultureTokenBalance: 2, inventory: { "BOTTE-001": 1 } },
      ownedBuddieCodes: ["HH2026-003"],
    });
  });

  it("does not expose backend details", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
    getKqPlayerCollectionSnapshot.mockRejectedValue(new Error("private table name"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private table name");
  });
});
