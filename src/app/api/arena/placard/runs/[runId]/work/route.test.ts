import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KqCultureWorkQuote } from "@/lib/kanab-quest-culture-work";

const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), quote: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/kanab-quest-culture-work-backend", () => ({ getKqCultureWorkQuote: mocks.quote }));
import { GET } from "./route";

const owner = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ runId }) };
const request = () => new Request(`http://localhost/api/arena/placard/runs/${runId}/work?ownerId=forged&runId=forged`);
const quote: KqCultureWorkQuote = {
  version: 1, runId, stageIndex: 0, day: 3, phase: "prepare", source: "player", paid: false,
  stepHours: 0.5, playerRemainingHours: 11.5, employee: null,
  bonus: { vitality: 0, terpenes: 0, yieldPercent: 0, cannabinoids: 0 },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ customerId: owner });
  mocks.quote.mockResolvedValue(quote);
});

describe("GET culture stage work quote", () => {
  it("checks feature access and authentication before resolving a quote", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET(request(), context)).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue(null);
    expect((await GET(request(), context)).status).toBe(401);
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it("binds the quote to the session owner and route, and forbids caching", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(quote);
    expect(mocks.quote).toHaveBeenCalledExactlyOnceWith(owner, runId);
    expect(mocks.session).toHaveBeenCalledWith("identity");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it.each([
    ["culture_work_exhausted", "réserve Culture"], ["culture_work_changed", "prise en charge"],
    ["player_work_exhausted", "12 h"],
  ])("preserves the business explanation for %s", async (code, message) => {
    mocks.quote.mockRejectedValue(new Error(`[supabase:culture-work] ${code}`));
    const response = await GET(request(), context);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain(message);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns a missing-culture explanation and hides internal database details", async () => {
    mocks.quote.mockRejectedValueOnce(new Error("Culture introuvable."));
    const missing = await GET(request(), context);
    expect(missing.status).toBe(409);
    expect(await missing.json()).toEqual({ error: "Culture introuvable." });
    mocks.quote.mockRejectedValueOnce(new Error("[supabase:culture-work] private database detail"));
    const unavailable = await GET(request(), context);
    expect(unavailable.status).toBe(503);
    expect(JSON.stringify(await unavailable.json())).not.toContain("private database detail");
    expect(unavailable.headers.get("cache-control")).toContain("no-store");
  });
});
