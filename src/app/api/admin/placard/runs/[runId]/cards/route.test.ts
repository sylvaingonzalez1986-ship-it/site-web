import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, playKqAdminCard } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  playKqAdminCard: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ playKqAdminCard }));

import { POST } from "@/app/api/admin/placard/runs/[runId]/cards/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/runs/run-1/cards", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const context = { params: Promise.resolve({ runId: "11111111-1111-1111-1111-111111111111" }) };

describe("POST /api/admin/placard/runs/[runId]/cards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses unauthenticated burns", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST(request({ cardCode: "BOTTE-004" }), context)).status).toBe(401);
    expect(playKqAdminCard).not.toHaveBeenCalled();
  });

  it("plays and burns a card through the server validator", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    playKqAdminCard.mockResolvedValue({ state: { xp: 2 }, burnReceipt: { id: "burn-1" } });
    const response = await POST(request({ cardCode: "BOTTE-004" }), context);
    expect(response.status).toBe(200);
    expect(playKqAdminCard).toHaveBeenCalledWith(
      "admin@example.test",
      "11111111-1111-1111-1111-111111111111",
      "BOTTE-004",
    );
  });

  it("rejects a missing card code before touching Supabase", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    expect((await POST(request({}), context)).status).toBe(400);
    expect(playKqAdminCard).not.toHaveBeenCalled();
  });
});
