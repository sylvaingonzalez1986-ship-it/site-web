import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), beta: vi.fn(), activeRun: vi.fn(), startRun: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/customer-backend", () => ({ loadContestBetaTesterEnabled: mocks.beta }));
vi.mock("@/lib/supabase/kanab-quest-backend", async (importOriginal) => ({ getKqPlayerRunsSnapshot: mocks.activeRun, startKqPlayerRun: mocks.startRun, readKqRunSelection: (await importOriginal<typeof import("@/lib/supabase/kanab-quest-backend")>()).readKqRunSelection }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.limit, logRateLimitRejection: vi.fn() }));

import { isArenaRankingRequestEnabled, isKqGameRequestEnabled, isKqPlayerRequestEnabled, isKqPlayerIdentityEnabled } from "./kanab-quest-player-request-access";
import { isKqGameOpen, isKqPublicPlayerApiEnabled } from "./kanab-quest-player-access";
import { ADMIN_ALLOWED_EMAIL } from "./admin-allowlist";
import { GET, POST } from "@/app/api/arena/placard/runs/route";
import { GET as readPrizePool } from "@/app/api/arena/rewards/route";
import { POST as rollPrizeDice } from "@/app/api/arena/rewards/dice/route";

const player = (email: string, contestBetaEnabled = false) => ({ customerId: "verified-customer-id", customer: { email, contestBetaEnabled } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-16T00:00:00Z"));
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "true");
  vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "true");
  vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "false");
  vi.stubEnv("KQ_LOCAL_PLAYER_PREVIEW", "true");
  vi.stubEnv("KQ_PLAYER_API_LIVE", "false");
  vi.stubEnv("KQ_LAUNCH_DOSSIER_JSON", "");
  mocks.session.mockResolvedValue(null);
  mocks.beta.mockResolvedValue(false);
  mocks.activeRun.mockResolvedValue({ activeRun: null, activeRuns: [] });
  mocks.startRun.mockResolvedValue({ runId: "new-run" });
  mocks.limit.mockResolvedValue({ allowed: true });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("public Kanab Quest game beta", () => {
  beforeEach(() => { vi.mocked(Date.now).mockReturnValue(Date.parse("2026-11-22T16:00:00Z")); });

  it("lets an ordinary player read and write their own game while physical prize routes stay closed", async () => {
    const identity = player("ordinary@example.test");
    mocks.session.mockResolvedValue(identity);
    expect(isKqGameOpen()).toBe(true);
    expect(await isKqPlayerIdentityEnabled(identity)).toBe(true);
    expect(mocks.beta).not.toHaveBeenCalled();
    expect((await GET(new Request("https://example.test/api/arena/placard/runs"))).status).toBe(200);
    expect(mocks.activeRun).toHaveBeenCalledWith(identity.customerId, {});
    const action = new Request("https://example.test/api/arena/placard/runs", {
      method: "POST", body: JSON.stringify({ customerId: "other-account", buddieCode: "BUDDIE-1", deckCodes: [] }),
    });
    expect((await POST(action)).status).toBe(201);
    expect(mocks.startRun).toHaveBeenCalledWith(identity.customerId, expect.objectContaining({ buddieCode: "BUDDIE-1" }));
    expect(mocks.limit).toHaveBeenCalledWith(expect.objectContaining({ key: `kq_start_run:${identity.customerId}:127.0.0.1` }));
    expect(isKqPublicPlayerApiEnabled()).toBe(false);
    expect((await readPrizePool()).status).toBe(404);
    expect((await rollPrizeDice(new Request("https://example.test/api/arena/rewards/dice", { method: "POST" }))).status).toBe(404);
  });

  it("requires sign-in before any personal read or write", async () => {
    const url = "https://example.test/api/arena/placard/runs";
    expect((await GET(new Request(url))).status).toBe(401);
    expect((await POST(new Request(url, { method: "POST" }))).status).toBe(401);
    expect(mocks.activeRun).not.toHaveBeenCalled();
    expect(mocks.startRun).not.toHaveBeenCalled();
  });

  it.each([
    ["CONTEST_BETA_ACCESS_ENABLED", "true"], ["CONTEST_BETA_ACCESS_ENABLED", undefined],
    ["CONTEST_FEATURE_ENABLED", "false"], ["CONTEST_FEATURE_ALLOW_PRODUCTION", "false"],
  ] as const)("keeps the public game closed with %s=%s", async (key, value) => {
    vi.stubEnv(key, value);
    mocks.session.mockResolvedValue(player("ordinary@example.test"));
    expect(isKqGameOpen()).toBe(false);
    expect(await isKqGameRequestEnabled()).toBe(false);
  });
});

describe("private production Placard access", () => {
  it("opens public scoreboards with the lobby even when the prize season is pending", async () => {
    vi.mocked(Date.now).mockReturnValue(Date.parse("2026-11-22T16:00:00Z"));
    expect(await isArenaRankingRequestEnabled()).toBe(true);
    expect(mocks.session).not.toHaveBeenCalled();
    vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "true");
    expect(await isArenaRankingRequestEnabled()).toBe(false);
  });
  it("checks a read-only summary from verified identity without hydrating a profile", async () => {
    const identity = player("beta@example.test");
    mocks.beta.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await isKqPlayerIdentityEnabled(identity)).toBe(true);
    expect(await isKqPlayerIdentityEnabled(identity)).toBe(false);
    expect(mocks.beta).toHaveBeenCalledWith(identity.customerId);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("keeps read-only identity access closed to guests and disabled modules", async () => {
    expect(await isKqPlayerIdentityEnabled(null)).toBe(false);
    vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
    expect(await isKqPlayerIdentityEnabled(player(ADMIN_ALLOWED_EMAIL))).toBe(false);
    expect(mocks.beta).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it.each([
    ["admin", ADMIN_ALLOWED_EMAIL, false],
    ["beta", "beta@example.test", true],
  ])("allows the verified %s account without opening the public launch", async (_role, email, beta) => {
    mocks.session.mockResolvedValue(player(email as string, beta as boolean));
    expect(await isKqPlayerRequestEnabled()).toBe(true);
    expect(isKqPublicPlayerApiEnabled()).toBe(false);
    expect((await GET(new Request("http://localhost/api/arena/placard/runs"))).status).toBe(200);
    expect(mocks.activeRun).toHaveBeenCalledWith("verified-customer-id", {});
  });

  it.each([null, player("ordinary@example.test")])("denies anonymous and ordinary customers even when contest beta restrictions are disabled", async (session) => {
    mocks.session.mockResolvedValue(session);
    expect(await isKqPlayerRequestEnabled()).toBe(false);
    expect((await GET(new Request("http://localhost/api/arena/placard/runs"))).status).toBe(404);
    expect(mocks.activeRun).not.toHaveBeenCalled();
  });

  it("checks beta revocation again for each request", async () => {
    mocks.session.mockResolvedValueOnce(player("beta@example.test", true)).mockResolvedValueOnce(player("beta@example.test", false));
    expect(await isKqPlayerRequestEnabled()).toBe(true);
    expect(await isKqPlayerRequestEnabled()).toBe(false);
  });

  it.each(["CONTEST_FEATURE_ENABLED", "CONTEST_FEATURE_ALLOW_PRODUCTION"])("respects the module switch %s", async (key) => {
    vi.stubEnv(key, "false");
    mocks.session.mockResolvedValue(player(ADMIN_ALLOWED_EMAIL));
    expect(await isKqPlayerRequestEnabled()).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("keeps customer ownership and rate limiting on beta writes", async () => {
    mocks.session.mockResolvedValue(player("beta@example.test", true));
    const request = new Request("https://example.test/api/arena/placard/runs", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerId: "someone-else", buddieCode: "BUDDIE-1", deckCodes: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(mocks.startRun).toHaveBeenCalledWith("verified-customer-id", expect.objectContaining({ buddieCode: "BUDDIE-1" }));
    expect(mocks.limit).toHaveBeenCalledWith(expect.objectContaining({ key: "kq_start_run:verified-customer-id:127.0.0.1" }));
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });

  it("does not accept beta or admin privileges from the request body", async () => {
    mocks.session.mockResolvedValue(player("ordinary@example.test"));
    const response = await POST(new Request("https://example.test/api/arena/placard/runs", {
      method: "POST", body: JSON.stringify({ contestBetaEnabled: true, email: ADMIN_ALLOWED_EMAIL }),
    }));
    expect(response.status).toBe(404);
    expect(mocks.startRun).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();
  });
});
