import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { isArenaPrelaunch, isArenaActivityApi, ARENA_OPENING_AT } from "./arena-opening";
import { isPioneerPackPrelaunch, PIONEER_PACK_OPENING_AT } from "./pioneer-pack";
import { isArenaCharacterRequestEnabled } from "./arena-character-access";
import { isKqPlayerRequestEnabled } from "./kanab-quest-player-request-access";
import { getContestFeatureAccessDeniedResponse } from "./contest-feature";
import { GET as access } from "@/app/api/contest/access/route";

const mocks = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn(), beta: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/admin-guard", () => ({ isCurrentRequestAdminAuthorized: mocks.admin }));
vi.mock("@/lib/arena-beta-request", () => ({ verifyArenaBetaRequest: mocks.beta }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null); mocks.admin.mockResolvedValue(false); mocks.beta.mockResolvedValue(false);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
  vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", "true");
  vi.stubEnv("KQ_PLAYER_API_LIVE", "false");
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-19T12:00:00Z"));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const request = (path: string, method = "GET", origin = "https://example.test") => new NextRequest(`https://example.test${path}`, { method, headers: { host: "example.test", origin, "user-agent": "Googlebot" } });
describe("arena preopening", () => {
  it("ends precisely at midnight in Paris on November 1 after the clock change", () => {
    expect(isArenaPrelaunch(Date.parse("2026-10-15T00:00:00+02:00"))).toBe(true);
    expect(isArenaPrelaunch(Date.parse("2026-10-31T22:59:59.999Z"))).toBe(true);
    expect(isArenaPrelaunch(Date.parse("2026-10-31T23:00:00Z"))).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(isArenaPrelaunch()).toBe(false);
  });
  it.each(["/api/contest/monthly-draw", "/api/contest/monthly-draw/"])("keeps the monthly review draw visible before the game opens: %s", async path => {
    for (const signedIn of [false, true]) {
      const req = request(path);
      if (signedIn) req.cookies.set("sb-project-auth-token", "untrusted-cookie");
      expect((await middleware(req)).headers.get("x-middleware-next")).toBe("1");
    }
    expect(mocks.beta).not.toHaveBeenCalled();
  });
  it.each(["/api/contest/monthly-draw/claim", "/api/contest/producer-rewards", "/api/contest/badges/claim", "/api/arena/rewards"])("does not extend the monthly draw exception to game reward routes: %s", async path => {
    const response = await middleware(request(path));
    expect(response.status).toBe(423);
    expect(await response.json()).toMatchObject({ opensAt: ARENA_OPENING_AT });
  });
  it("opens the notebook, character creation and public navigation while the game is off", async () => {
    expect(await isArenaCharacterRequestEnabled()).toBe(true);
    expect(await isKqPlayerRequestEnabled()).toBe(false);
    expect(await (await access()).json()).toMatchObject({ enabled: true, canAccess: true, betaRestricted: false, notebookOpen: true, activitiesOpen: false });
  });
  it.each(["/api/arena/placard/runs", "/api/arena/tutorial", "/api/arena/chanvrier/savings", "/api/contest/leaderboard", "/api/contest/badges/claim", "/api/contest/producer-rewards"])("blocks activity reads and writes: %s", async path => {
    for (const method of ["GET", "POST"]) {
      const response = await middleware(request(path, method));
      expect(response.status).toBe(423);
      expect(await response.json()).toMatchObject({ error: "Rendez-vous le 1er novembre", opensAt: ARENA_OPENING_AT });
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });
  it.each([["/arene/placard", "jouer"]])("redirects direct entry %s to its preview", async (path, mode) => {
    const response = await middleware(request(path));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://example.test/arene?mode=${mode}&ouverture=1`);
  });
  it.each([
    "/arene", "/api/arena/chanvrier", "/api/contest/access",
    "/arene/carnet", "/arene/carnet/regular", "/arene/carnet/concours", "/arene/carnet/classement",
    "/arene/selected-flower", "/arene/profils/tester", "/bete-de-concours/carnet",
    "/api/contest/entries", "/api/contest/entries/selected-flower", "/api/contest/reviews", "/api/contest/review-pages/entry-id",
    "/api/contest/reviews/review-id/vote", "/api/contest/profile", "/api/contest/feed", "/api/contest/rankings",
    "/api/contest/seasons", "/api/contest/tester/progress", "/api/contest/testers/rankings", "/api/contest/testers/pseudo",
  ])("allows %s through to normal route authentication", async path => {
    expect((await middleware(request(path))).headers.get("x-middleware-next")).toBe("1");
  });
  it("protects character writes against cross-origin requests", async () => {
    expect((await middleware(request("/api/arena/chanvrier", "POST", "https://elsewhere.test"))).status).toBe(403);
    expect((await middleware(request("/api/arena/chanvrier", "POST"))).headers.get("x-middleware-next")).toBe("1");
  });
  it("keeps notebook writes behind origin validation without requiring beta access", async () => {
    expect((await middleware(request("/api/contest/reviews", "POST", "https://elsewhere.test"))).status).toBe(403);
    for (const path of ["/api/contest/reviews", "/api/contest/profile", "/api/contest/reviews/review-id/vote"]) {
      expect((await middleware(request(path, "POST"))).headers.get("x-middleware-next")).toBe("1");
    }
    expect(mocks.beta).not.toHaveBeenCalled();
  });
  it("keeps gift eligibility visible but prevents early distribution", async () => {
    expect(isArenaActivityApi("/api/account/pioneer-pack")).toBe(false);
    const response = await middleware(request("/api/account/pioneer-pack", "POST"));
    expect(response.status).toBe(423);
    expect(await response.json()).toEqual({ error: "Rendez-vous le 30 octobre", opensAt: PIONEER_PACK_OPENING_AT });
    for (const method of ["GET", "HEAD"]) {
      const req = request("/api/account/pioneer-pack", method);
      req.cookies.set("sb-project-auth-token", "untrusted-cookie");
      expect((await middleware(req)).headers.get("x-middleware-next")).toBe("1");
    }
  });
  it("releases the gift on October 30 while keeping Arena activities closed until November 1", async () => {
    for (const [now, giftOpen, arenaOpen] of [
      ["2026-10-15T00:00:00+02:00", false, false],
      ["2026-10-29T22:59:59.999Z", false, false],
      ["2026-10-29T23:00:00Z", true, false],
      ["2026-10-31T22:59:59.999Z", true, false],
      ["2026-10-31T23:00:00Z", true, true],
    ] as const) {
      vi.mocked(Date.now).mockReturnValue(Date.parse(now));
      expect(isPioneerPackPrelaunch()).toBe(!giftOpen);
      const req = request("/api/account/pioneer-pack/", "POST");
      req.cookies.set("sb-project-auth-token", "untrusted-cookie");
      expect((await middleware(req)).status).toBe(giftOpen ? 200 : 423);
      expect((await middleware(request("/api/arena/placard/runs"))).status).toBe(arenaOpen ? 200 : 423);
    }
    expect(mocks.beta).not.toHaveBeenCalled();
  });
});

it.each([true, false])("preopening server policy respects verified beta=%s even if public switches are on", async beta => {
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "true"); vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "true");
  vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "false"); vi.stubEnv("KQ_PLAYER_API_LIVE", "true");
  mocks.session.mockResolvedValue({ customerId: "verified-id", customer: { email: "player@example.test", contestBetaEnabled: beta } });
  expect(await isKqPlayerRequestEnabled()).toBe(beta);
  expect(await (await access()).json()).toMatchObject({ canAccess: true, activitiesOpen: beta });
  const denied = await getContestFeatureAccessDeniedResponse();
  expect(denied?.status ?? null).toBe(beta ? null : 423);
});
it.each([true, false])("middleware checks live beta status for a signed-in request: %s", async beta => {
  mocks.beta.mockResolvedValue(beta);
  for (const path of ["/arene/placard", "/api/arena/tutorial", "/api/arena/placard/runs", "/api/contest/producer-rewards", "/api/contest/badges/claim"]) {
    const req = request(path); req.cookies.set("sb-project-auth-token", "untrusted-cookie");
    const result = await middleware(req);
    expect(result.status).toBe(beta ? 200 : path.startsWith("/api/") ? 423 : 307);
  }
  expect(mocks.beta).toHaveBeenCalledTimes(5);
});
it("does not extend the beta exception to the pioneer gift launch date", async () => {
  mocks.beta.mockResolvedValue(true);
  const req=request("/api/account/pioneer-pack", "POST"); req.cookies.set("sb-project-auth-token", "untrusted-cookie");
  expect((await middleware(req)).status).toBe(423);
  expect(mocks.beta).not.toHaveBeenCalled();
});
