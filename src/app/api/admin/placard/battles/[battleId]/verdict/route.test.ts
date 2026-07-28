import { beforeEach, describe, expect, it, vi } from "vitest";
const { getValidatedAdminContext, finalizeKqAdminBattle } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(), finalizeKqAdminBattle: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ finalizeKqAdminBattle }));
import { POST } from "@/app/api/admin/placard/battles/[battleId]/verdict/route";

const request = new Request("http://localhost/api/admin/placard/battles/battle-1/verdict", { method: "POST" });
const context = { params: Promise.resolve({ battleId: "battle-1" }) };

describe("POST /api/admin/placard/battles/[battleId]/verdict", () => {
  beforeEach(() => vi.clearAllMocks());
  it("never burns flowers without an admin session", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST(request, context)).status).toBe(401);
    expect(finalizeKqAdminBattle).not.toHaveBeenCalled();
  });
  it("delegates the verdict to the trusted server engine", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    finalizeKqAdminBattle.mockResolvedValue({ battleId: "battle-1", status: "verdict" });
    expect((await POST(request, context)).status).toBe(200);
    expect(finalizeKqAdminBattle).toHaveBeenCalledWith("admin@example.test", "battle-1");
  });
});
