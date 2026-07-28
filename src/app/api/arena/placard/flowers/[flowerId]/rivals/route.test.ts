import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, getKqPlayerFlowerRivals } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerFlowerRivals: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPlayerFlowerRivals }));

import { GET } from "@/app/api/arena/placard/flowers/[flowerId]/rivals/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const flowerId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const context = { params: Promise.resolve({ flowerId }) };
const request = new Request(`http://localhost/api/arena/placard/flowers/${flowerId}/rivals`);

describe("GET /api/arena/placard/flowers/[flowerId]/rivals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
  });
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("is hidden before coordinated launch", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await GET(request, context)).status).toBe(404);
  });

  it("searches rivals only for a Flower owned by the current customer", async () => {
    getKqPlayerFlowerRivals.mockResolvedValue([{ flowerId: "rival-1", quality: 72 }]);
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(getKqPlayerFlowerRivals).toHaveBeenCalledWith(customerId, flowerId);
    expect((await response.json()).rivals).toHaveLength(1);
  });
});
