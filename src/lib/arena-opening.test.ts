import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";
import { isArenaPrelaunch, isArenaActivityApi, ARENA_OPENING_AT } from "./arena-opening";
import { isArenaCharacterRequestEnabled } from "./arena-character-access";
import { isKqPlayerRequestEnabled } from "./kanab-quest-player-request-access";
import { GET as access } from "@/app/api/contest/access/route";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
  vi.stubEnv("KQ_PLAYER_API_LIVE", "false");
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-19T12:00:00Z"));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const request = (path: string, method = "GET", origin = "https://example.test") => new NextRequest(`https://example.test${path}`, { method, headers: { host: "example.test", origin, "user-agent": "Googlebot" } });
describe("arena preopening", () => {
  it("ends precisely at midnight in Paris on October 15", () => {
    expect(isArenaPrelaunch(Date.parse(ARENA_OPENING_AT) - 1)).toBe(true);
    expect(isArenaPrelaunch(Date.parse(ARENA_OPENING_AT))).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(isArenaPrelaunch()).toBe(false);
  });
  it("opens only character creation and public navigation while the game is off", async () => {
    expect(await isArenaCharacterRequestEnabled()).toBe(true);
    expect(await isKqPlayerRequestEnabled()).toBe(false);
    expect(await (await access()).json()).toMatchObject({ enabled: true, canAccess: true, betaRestricted: false, activitiesOpen: false });
  });
  it.each(["/api/arena/placard/runs", "/api/arena/tutorial", "/api/arena/chanvrier/savings", "/api/contest/leaderboard"])("blocks activity reads and writes: %s", async path => {
    for (const method of ["GET", "POST"]) {
      const response = await middleware(request(path, method));
      expect(response.status).toBe(423);
      expect(await response.json()).toMatchObject({ error: "Rendez-vous le 15 octobre", opensAt: ARENA_OPENING_AT });
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });
  it.each([["/arene/placard", "jouer"], ["/arene/carnet/regular", "carnet"], ["/bete-de-concours/carnet", "carnet"]])("redirects direct entry %s to its preview", async (path, mode) => {
    const response = await middleware(request(path));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://example.test/arene?mode=${mode}&ouverture=1`);
  });
  it.each(["/arene", "/api/arena/chanvrier", "/api/contest/access"])("allows %s through to normal route authentication", async path => {
    expect((await middleware(request(path))).headers.get("x-middleware-next")).toBe("1");
  });
  it("protects character writes against cross-origin requests", async () => {
    expect((await middleware(request("/api/arena/chanvrier", "POST", "https://elsewhere.test"))).status).toBe(403);
    expect((await middleware(request("/api/arena/chanvrier", "POST"))).headers.get("x-middleware-next")).toBe("1");
  });
  it("keeps gift eligibility visible but prevents early distribution", async () => {
    expect(isArenaActivityApi("/api/account/pioneer-pack", "GET")).toBe(false);
    expect((await middleware(request("/api/account/pioneer-pack", "POST"))).status).toBe(423);
  });
});
