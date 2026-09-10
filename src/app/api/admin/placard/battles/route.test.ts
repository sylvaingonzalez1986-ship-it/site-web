import { beforeEach, describe, expect, it, vi } from "vitest";
const { getValidatedAdminContext, enqueueKqAdminRandomBattle, leaveKqAdminRandomBattleQueue, reconcileKqAdminRandomBattleQueue } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  enqueueKqAdminRandomBattle: vi.fn(),
  leaveKqAdminRandomBattleQueue: vi.fn(),
  reconcileKqAdminRandomBattleQueue: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  enqueueKqAdminRandomBattle,
  leaveKqAdminRandomBattleQueue,
  reconcileKqAdminRandomBattleQueue,
}));
import { POST } from "@/app/api/admin/placard/battles/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/battles", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("POST /api/admin/placard/battles", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not lock flowers without an admin session", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401);
    expect(enqueueKqAdminRandomBattle).not.toHaveBeenCalled();
  });
  it("queues one Flower without accepting an explicit opponent", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    enqueueKqAdminRandomBattle.mockResolvedValue({ matchStatus: "queued", flowerId: "flower-1" });
    const response = await POST(request({ flowerId: "flower-1", action: "join" }));
    expect(response.status).toBe(201);
    expect(enqueueKqAdminRandomBattle).toHaveBeenCalledWith("admin@example.test", "flower-1");
  });

  it("releases an unmatched admin Flower", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    leaveKqAdminRandomBattleQueue.mockResolvedValue({ left: true, flowerId: "flower-1" });
    const response = await POST(request({ flowerId: "flower-1", action: "leave" }));
    expect(response.status).toBe(200);
    expect(leaveKqAdminRandomBattleQueue).toHaveBeenCalledWith("admin@example.test", "flower-1");
  });

  it("retries an existing admin queue entry", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    reconcileKqAdminRandomBattleQueue.mockResolvedValue({ matchStatus: "matched", battleId: "battle-1" });
    const response = await POST(request({ flowerId: "flower-1", action: "poll" }));
    expect(response.status).toBe(200);
    expect(reconcileKqAdminRandomBattleQueue).toHaveBeenCalledWith("admin@example.test", "flower-1");
  });
});
