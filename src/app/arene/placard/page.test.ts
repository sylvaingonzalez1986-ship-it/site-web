import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/components/placard/PlacardPlayerShell", () => ({ PlacardPlayerShell: () => null }));

import PlacardPlayerPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-16T00:00:00Z"));
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "true");
  vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "true");
  vi.stubEnv("KQ_PLAYER_API_LIVE", "false");
  mocks.session.mockResolvedValue(null);
});

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

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

it.each([true, false])("allows only beta players into the Placard before opening: %s", async beta => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-19T12:00:00Z"));
  mocks.session.mockResolvedValue({ customerId: "verified-id", customer: { email: "player@example.test", contestBetaEnabled: beta } });
  if (beta) expect(await PlacardPlayerPage()).toBeTruthy();
  else await expect(PlacardPlayerPage()).rejects.toMatchObject({ digest: "NEXT_REDIRECT;replace;/arene?mode=jouer&ouverture=1;307;" });
});
