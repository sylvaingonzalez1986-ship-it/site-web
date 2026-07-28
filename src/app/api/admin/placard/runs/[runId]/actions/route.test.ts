import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, applyKqAdminRunAction } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  applyKqAdminRunAction: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ applyKqAdminRunAction }));

import { POST } from "@/app/api/admin/placard/runs/[runId]/actions/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/runs/run-1/actions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const context = { params: Promise.resolve({ runId: "11111111-1111-1111-1111-111111111111" }) };

describe("POST /api/admin/placard/runs/[runId]/actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses unauthenticated game actions", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST(request({ action: "roll" }), context)).status).toBe(401);
    expect(applyKqAdminRunAction).not.toHaveBeenCalled();
  });

  it("rejects unknown actions before touching Supabase", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    expect((await POST(request({ action: "cheat" }), context)).status).toBe(400);
    expect(applyKqAdminRunAction).not.toHaveBeenCalled();
  });

  it("rejects missing or fractional Main prévoyante positions", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    expect((await POST(request({ action: "heritage-swap", handIndex: 1 }), context)).status).toBe(400);
    expect((await POST(request({ action: "heritage-swap", handIndex: 1.5, reserveIndex: 0 }), context)).status).toBe(400);
    expect(applyKqAdminRunAction).not.toHaveBeenCalled();
  });

  it("forwards valid integer positions to the trusted engine", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    applyKqAdminRunAction.mockResolvedValue({ state: { heritageCode: "HERITAGE-003" }, persistedFlower: null });
    const response = await POST(request({
      action: "heritage-swap",
      handIndex: 2,
      reserveIndex: 1,
    }), context);
    expect(response.status).toBe(200);
    expect(applyKqAdminRunAction).toHaveBeenCalledWith(
      "admin@example.test",
      "11111111-1111-1111-1111-111111111111",
      "heritage-swap",
      { handIndex: 2, reserveIndex: 1 },
    );
  });
});
