import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), draw: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/monthly-review-draw-backend", () => ({ getMonthlyReviewDraw: mocks.draw }));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", "true");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
  vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "true");
  mocks.session.mockResolvedValue({ customerId: "session-customer" });
  mocks.draw.mockResolvedValue({ prizeGrams: 10 });
});
afterEach(() => vi.unstubAllEnvs());

describe("monthly review draw API", () => {
  it("uses the session identity and opens independently of the game's beta", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ draw: { prizeGrams: 10 } });
    expect(mocks.session).toHaveBeenCalledWith("identity");
    expect(mocks.draw).toHaveBeenCalledWith("session-customer");
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
  });
  it("requests a public preview for guests without inventing a customer identity", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(200);
    expect(mocks.draw).toHaveBeenCalledWith(null);
  });
  it("respects the notebook feature switch", async () => {
    vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", "false");
    expect((await GET()).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.draw).not.toHaveBeenCalled();
  });
  it("reports unavailability without leaking database errors or reporting zero participants", async () => {
    mocks.draw.mockRejectedValue(new Error("private SQL candidates"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Tirage mensuel momentanément indisponible." });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("never falls back to a guest preview after a session lookup fails", async () => {
    mocks.session.mockRejectedValue(new Error("auth unavailable"));
    expect((await GET()).status).toBe(503);
    expect(mocks.draw).not.toHaveBeenCalled();
  });
});
