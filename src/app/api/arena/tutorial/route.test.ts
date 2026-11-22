import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqGameRequestEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/arena-chanvrier-backend", () => ({ getChanvrierProfile: mocks.profile }));

describe("Quartier character entry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ customerId: "player" });
    mocks.enabled.mockResolvedValue(true);
  });
  it("reads only the authenticated player's character", async () => {
    mocks.profile.mockResolvedValue(null);
    const response = await GET();
    expect(await response.json()).toEqual({ userId: "player", chanvrier: null });
    expect(mocks.profile).toHaveBeenCalledExactlyOnceWith("player");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("requires both a session and access to the game", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET()).status).toBe(404);
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it("allows retry when the profile is unavailable", async () => {
    mocks.profile.mockRejectedValue(new Error("database"));
    expect((await GET()).status).toBe(503);
  });
});
