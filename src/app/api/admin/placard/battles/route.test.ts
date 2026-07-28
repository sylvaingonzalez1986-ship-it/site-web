import { beforeEach, describe, expect, it, vi } from "vitest";
const { getValidatedAdminContext, lockKqAdminBattle } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(), lockKqAdminBattle: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ lockKqAdminBattle }));
import { POST } from "@/app/api/admin/placard/battles/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/battles", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("POST /api/admin/placard/battles", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not lock flowers without an admin session", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401);
    expect(lockKqAdminBattle).not.toHaveBeenCalled();
  });
  it("locks two explicitly selected flowers", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    lockKqAdminBattle.mockResolvedValue({ battleId: "battle-1", status: "locked" });
    const response = await POST(request({ flowerId: "flower-1", rivalFlowerId: "flower-2" }));
    expect(response.status).toBe(201);
    expect(lockKqAdminBattle).toHaveBeenCalledWith("admin@example.test", "flower-1", "flower-2");
  });
});
