import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/components/placard/PlacardPlayerShell", () => ({ PlacardPlayerShell: () => null }));

import PlacardPlayerPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "true");
  vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "true");
  vi.stubEnv("KQ_PLAYER_API_LIVE", "false");
  mocks.session.mockResolvedValue(null);
});

afterEach(() => vi.unstubAllEnvs());

describe("Placard page entry", () => {
  it("sends a visitor without a customer session to login with a return to the Placard", async () => {
    await expect(PlacardPlayerPage()).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/compte/connexion?next=%2Farene%2Fplacard;307;",
    });
  });

  it("keeps the page unavailable when the module is disabled", async () => {
    vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
    await expect(PlacardPlayerPage()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("still denies a connected customer without admin or beta access", async () => {
    mocks.session.mockResolvedValue({
      customerId: "ordinary-customer",
      customer: { email: "ordinary@example.test", contestBetaEnabled: false },
    });
    await expect(PlacardPlayerPage()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});
