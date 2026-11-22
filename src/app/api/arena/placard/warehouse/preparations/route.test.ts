import { beforeEach, describe, expect, it, vi } from "vitest";

const commit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: async () => ({ customerId: "player" }) }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: async () => true }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1", hitRateLimit: async () => ({ allowed: true }), logRateLimitRejection: vi.fn(),
}));
vi.mock("@/lib/supabase/kanab-quest-warehouse-preparations-backend", () => ({
  commitKqWarehousePreparation: commit, getKqWarehousePreparations: vi.fn(),
}));
import { KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER as accountHeader } from "@/lib/kanab-quest-warehouse-preparations";
import { POST } from "./route";

const pack = { action: "purchasePack", code: "CARE-IRON", quantity: 2, expectedCents: 2780, requestKey: "00000000-0000-4000-8000-000000000001" };
const request = (overrides: Record<string, unknown>, account?: string) => new Request("http://localhost/api/arena/placard/warehouse/preparations", {
  method: "POST", headers: account ? { [accountHeader]: account } : {}, body: JSON.stringify({ ...pack, ...overrides }),
});

describe("warehouse pack checkout", () => {
  beforeEach(() => { commit.mockReset().mockResolvedValue({ items: [] }); });
  it("forwards the quantity in packs and the quoted total under the session owner", async () => {
    const response = await POST(request({ userId: "another-player", chargesPerPack: 999 }, "player"));
    expect(response.status).toBe(200);
    expect(response.headers.get(accountHeader)).toBe("player");
    expect(commit).toHaveBeenCalledWith("player", pack);
  });
  it("rejects a pending order from a different account before committing", async () => {
    const response = await POST(request({}, "another-player"));
    expect(response.status).toBe(409);
    expect(response.headers.get(accountHeader)).toBe("player");
    expect(commit).not.toHaveBeenCalled();
  });
  it.each([{ quantity: 0 }, { quantity: 101 }, { quantity: 1.5 }, { expectedCents: undefined }, { expectedCents: 0 },
    { code: "WAREHOUSE-VACUUM" }, { code: "UNKNOWN" }])("refuses an invalid pack order %# before opening the register", async overrides => {
    expect((await POST(request(overrides))).status).toBe(400);
    expect(commit).not.toHaveBeenCalled();
  });
});
