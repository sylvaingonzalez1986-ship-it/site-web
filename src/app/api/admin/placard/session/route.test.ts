import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, expireKqAbandonedBattles, getKqAdminActiveRun, getKqAdminFlowers, getKqAdminBattles } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  expireKqAbandonedBattles: vi.fn(),
  getKqAdminActiveRun: vi.fn(),
  getKqAdminFlowers: vi.fn(),
  getKqAdminBattles: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  expireKqAbandonedBattles,
  getKqAdminActiveRun,
  getKqAdminFlowers,
  getKqAdminBattles,
}));

import { GET } from "@/app/api/admin/placard/session/route";

describe("GET /api/admin/placard/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expireKqAbandonedBattles.mockResolvedValue({ expiredCount: 0, battleIds: [], hasMore: false });
  });

  it("refuses unauthenticated session bootstraps", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getKqAdminActiveRun).not.toHaveBeenCalled();
  });

  it("loads the official run, flowers and battles in one private response", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminActiveRun.mockResolvedValue({ runId: "run-1" });
    getKqAdminFlowers.mockResolvedValue([{ id: "flower-1" }]);
    getKqAdminBattles.mockResolvedValue([{ id: "battle-1" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      activeRun: { runId: "run-1" },
      flowers: [{ id: "flower-1" }],
      battles: [{ id: "battle-1" }],
      warnings: [],
    });
    expect(getKqAdminActiveRun).toHaveBeenCalledWith("admin@example.test");
    expect(getKqAdminFlowers).toHaveBeenCalledWith("admin@example.test");
    expect(getKqAdminBattles).toHaveBeenCalledWith("admin@example.test");
    expect(expireKqAbandonedBattles).toHaveBeenCalledOnce();
  });

  it("keeps loading the session if daily duel expiry is temporarily unavailable", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    expireKqAbandonedBattles.mockRejectedValue(new Error("RPC indisponible."));
    getKqAdminActiveRun.mockResolvedValue(null);
    getKqAdminFlowers.mockResolvedValue([]);
    getKqAdminBattles.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).warnings).toEqual(["Expiration des duels : RPC indisponible."]);
  });

  it("keeps the active run available when battle history fails", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminActiveRun.mockResolvedValue({ runId: "run-1" });
    getKqAdminFlowers.mockResolvedValue([{ id: "flower-1" }]);
    getKqAdminBattles.mockRejectedValue(new Error("Historique indisponible."));
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.activeRun).toEqual({ runId: "run-1" });
    expect(payload.battles).toEqual([]);
    expect(payload.warnings).toEqual(["Duels : Historique indisponible."]);
  });

  it("returns unavailable only when all session reads fail", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminActiveRun.mockRejectedValue(new Error("A"));
    getKqAdminFlowers.mockRejectedValue(new Error("B"));
    getKqAdminBattles.mockRejectedValue(new Error("C"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).warnings).toHaveLength(3);
  });
});
