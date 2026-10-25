import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
import { getMonthlyReviewDraw } from "./monthly-review-draw-backend";

const customerId = "11111111-1111-4111-8111-111111111111";
const reward = { claimId: "22222222-2222-4222-8222-222222222222", drawDate: "2026-11-01", status: "available" };
const draw = {
  prizeGrams: 10, nextDrawDate: "2026-12-01", periodStartsOn: "2026-11-01",
  eligible: true, approvedReviewCount: 2,
  latestDraw: { drawDate: "2026-11-01", participantCount: 3, viewerWon: true }, rewards: [reward],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: draw, error: null });
});

describe("monthly review draw backend", () => {
  it("reads the customer's server-calculated eligibility and prize", async () => {
    await expect(getMonthlyReviewDraw(customerId)).resolves.toEqual(draw);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_get_monthly_review_draw", { p_customer_id: customerId });
  });
  it("strips private receipt fields from the response", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...draw, candidates: [customerId],
      latestDraw: { ...draw.latestDraw, winner_user_id: customerId }, rewards: [{ ...reward, user_id: customerId }] }, error: null });
    await expect(getMonthlyReviewDraw(customerId)).resolves.toEqual(draw);
  });
  it("accepts the anonymous preview and an empty first month", async () => {
    const preview = { ...draw, eligible: null, approvedReviewCount: null, latestDraw: null, rewards: [] };
    mocks.rpc.mockResolvedValue({ data: preview, error: null });
    await expect(getMonthlyReviewDraw()).resolves.toEqual(preview);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_get_monthly_review_draw", { p_customer_id: null });
  });
  it("does not expose personal eligibility or rewards to guests", async () => {
    await expect(getMonthlyReviewDraw()).rejects.toThrow("indisponible");
  });
  it("preserves an actual empty draw", async () => {
    const empty = { ...draw, eligible: false, approvedReviewCount: 0,
      latestDraw: { ...draw.latestDraw, participantCount: 0, viewerWon: false }, rewards: [] };
    mocks.rpc.mockResolvedValue({ data: empty, error: null });
    await expect(getMonthlyReviewDraw(customerId)).resolves.toEqual(empty);
  });
  it.each([null, {}, { ...draw, prizeGrams: 20 }, { ...draw, nextDrawDate: "2026-13-01" },
    { ...draw, nextDrawDate: "2026-11-02" }, { ...draw, eligible: false },
    { ...draw, approvedReviewCount: -1 }, { ...draw, approvedReviewCount: null },
    { ...draw, rewards: [reward, reward] }, { ...draw, rewards: [{ ...reward, status: "unknown" }] },
    { ...draw, latestDraw: { ...draw.latestDraw, participantCount: 0 } },
  ])("rejects malformed authoritative results %#", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getMonthlyReviewDraw(customerId)).rejects.toThrow("indisponible");
  });
  it.each(["PGRST202", "42501"])("reports missing deployment or permissions as unavailable (%s)", async code => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private details" } });
    await expect(getMonthlyReviewDraw(customerId)).rejects.toThrow("Tirage mensuel momentanément indisponible.");
  });
  it("rejects malformed identities before making a service-role request", async () => {
    await expect(getMonthlyReviewDraw("bad-id")).rejects.toThrow("indisponible");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
