import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  freeze: vi.fn(),
  pool: vi.fn(),
  settle: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext: mocks.admin }));
vi.mock("@/lib/supabase/arena-customer-rewards-backend", () => ({
  freezeArenaCustomerRewardSeason: mocks.freeze,
  getArenaCustomerRewardPool: mocks.pool,
  settleArenaCustomerRewards: mocks.settle,
}));

import { GET, POST } from "@/app/api/admin/arena/customer-rewards/route";

const post = (body: object) => POST(new Request("http://localhost/api/admin/arena/customer-rewards", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}));

describe("admin Arena customer rewards API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin.mockResolvedValue({ user: { id: "admin" } });
    mocks.pool.mockResolvedValue({ status: "active", poolGrams: 100 });
    mocks.freeze.mockResolvedValue({ executed: true });
    mocks.settle.mockResolvedValue({ executed: false, ready: false });
  });

  it("does not expose the pool to a non-admin", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await post({ action: "settle", execute: true })).status).toBe(401);
    expect(mocks.settle).not.toHaveBeenCalled();
  });

  it("uses a non-mutating settlement simulation for previews", async () => {
    expect((await post({ action: "preview" })).status).toBe(200);
    expect(mocks.settle).toHaveBeenCalledWith(false);
  });

  it("requires the explicit execute flag for freeze and settlement", async () => {
    await post({ action: "freeze", execute: true });
    await post({ action: "settle", execute: true });
    expect(mocks.freeze).toHaveBeenCalledWith(true);
    expect(mocks.settle).toHaveBeenCalledWith(true);
  });
});
