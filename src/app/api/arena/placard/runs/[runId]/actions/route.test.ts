import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, applyKqPlayerRunAction, hitRateLimit } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  applyKqPlayerRunAction: vi.fn(),
  hitRateLimit: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ applyKqPlayerRunAction }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection: vi.fn(),
}));

import { POST } from "@/app/api/arena/placard/runs/[runId]/actions/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "66666666-6666-6666-6666-666666666666";
const runId = "77777777-7777-7777-7777-777777777777";
const context = { params: Promise.resolve({ runId }) };
const request = (body: unknown) => new Request(`http://localhost/api/arena/placard/runs/${runId}/actions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/arena/placard/runs/[runId]/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId,
      customer: { email: "player@example.test" },
    });
    hitRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    applyKqPlayerRunAction.mockResolvedValue({ state: { rolled: true }, persistedFlower: null });
  });

  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("is inert while the player API is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await POST(request({ action: "roll" }), context)).status).toBe(404);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });

  it("applies a progression action only to the authenticated run owner", async () => {
    applyKqPlayerRunAction.mockResolvedValue({ state: { rolled: true }, persistedFlower: null });
    const response = await POST(request({ action: "roll" }), context);
    expect(response.status).toBe(200);
    expect(applyKqPlayerRunAction).toHaveBeenCalledWith(customerId, runId, "roll", {});
  });

  it("requires a session before reading or charging a stage", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);
    expect((await POST(request({ action: "roll", workChoice: "player" }), context)).status).toBe(401);
    expect(hitRateLimit).not.toHaveBeenCalled();
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2, 3, 4, 5])("forwards numeric stage %s using the session owner without client-authored work allocation", async expectedStageIndex => {
    const response = await POST(request({ action: "roll", expectedStageIndex, userId: "forged-owner", runId: "forged-run", p_next_state: { phase: "complete" } }), context);
    expect(response.status).toBe(200);
    expect(applyKqPlayerRunAction).toHaveBeenCalledExactlyOnceWith(customerId, runId, "roll", { expectedStageIndex });
    expect(getCurrentCustomerSessionByBackend).toHaveBeenCalledWith("identity");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });

  it.each(["0", "5", null, true, [], {}, -1, 6, 0.5])("rejects invalid stage value %j before mutation", async expectedStageIndex => {
    const response = await POST(request({ action: "roll", expectedStageIndex }), context);
    expect(response.status).toBe(400);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });

  it.each(["employee", "employee:", "employee:foreign id", "PLAYER", "", null, 1, {}])("rejects malformed work choice %j before mutation", async workChoice => {
    expect((await POST(request({ action: "roll", workChoice }), context)).status).toBe(400);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });

  it.each(["auto", "player", "employee:worker-123"])("forwards explicit %s while binding owner and stage on the server", async workChoice => {
    const response = await POST(request({ action: "roll", workChoice, expectedStageIndex: 2, userId: "forged" }), context);
    expect(response.status).toBe(200);
    expect(applyKqPlayerRunAction).toHaveBeenCalledExactlyOnceWith(customerId, runId, "roll", { workChoice, expectedStageIndex: 2 });
  });

  it.each(["resolve", "advance", "redraw", "heritage", "heritage-swap"])("does not allow roll-only options on %s", async action => {
    expect((await POST(request({ action, workChoice: "player", handIndex: 0, reserveIndex: 0 }), context)).status).toBe(400);
    expect((await POST(request({ action, expectedStageIndex: 0, handIndex: 0, reserveIndex: 0 }), context)).status).toBe(400);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });

  it.each([
    ["culture_work_exhausted", "réserve Culture"], ["culture_work_changed", "prise en charge"],
    ["player_work_exhausted", "12 h"], ["player_work_changed", "temps disponible"],
  ])("returns readable business errors for %s", async (code, expectedMessage) => {
    applyKqPlayerRunAction.mockRejectedValue(new Error(`[supabase:rpc_kq_roll_culture_step] ${code}`));
    const response = await POST(request({ action: "roll", expectedStageIndex: 0 }), context);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain(expectedMessage);
    expect(body.error).not.toContain("[supabase:");
  });

  it("hides internal database errors while preserving a stale-stage explanation", async () => {
    applyKqPlayerRunAction.mockRejectedValueOnce(new Error("[supabase:rpc_kq_roll_culture_step] secret database detail"));
    const unavailable = await POST(request({ action: "roll" }), context);
    expect(unavailable.status).toBe(503);
    expect(JSON.stringify(await unavailable.json())).not.toContain("secret database detail");
    applyKqPlayerRunAction.mockRejectedValueOnce(new Error("L’étape de culture a changé. Actualise avant de confirmer le lancer."));
    const stale = await POST(request({ action: "roll", expectedStageIndex: 0 }), context);
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toContain("étape de culture a changé");
  });

  it("validates Heritage exchange indexes before mutation", async () => {
    expect((await POST(request({ action: "heritage-swap", handIndex: "x" }), context)).status).toBe(400);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });

  it("forwards valid Heritage exchange indexes", async () => {
    applyKqPlayerRunAction.mockResolvedValue({ state: {}, persistedFlower: null });
    await POST(request({ action: "heritage-swap", handIndex: 2, reserveIndex: 1 }), context);
    expect(applyKqPlayerRunAction).toHaveBeenCalledWith(
      customerId,
      runId,
      "heritage-swap",
      { handIndex: 2, reserveIndex: 1 },
    );
  });

  it("rate limits progression before reading or writing the run", async () => {
    hitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 });
    const response = await POST(request({ action: "roll" }), context);
    expect(response.status).toBe(429);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });
});
