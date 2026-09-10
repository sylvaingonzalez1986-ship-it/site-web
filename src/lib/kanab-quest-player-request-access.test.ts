import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), activeRun: vi.fn(), startRun: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPlayerActiveRun: mocks.activeRun, startKqPlayerRun: mocks.startRun }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.limit, logRateLimitRejection: vi.fn() }));

import { isKqPlayerRequestEnabled } from "./kanab-quest-player-request-access";
import { isKqPublicPlayerApiEnabled } from "./kanab-quest-player-access";
import { ADMIN_ALLOWED_EMAIL } from "./admin-allowlist";
import { GET, POST } from "@/app/api/arena/placard/runs/route";

const player = (email: string, contestBetaEnabled = false) => ({ customerId: "verified-customer-id", customer: { email, contestBetaEnabled } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "true");
  vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "true");
  vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "false");
  vi.stubEnv("KQ_LOCAL_PLAYER_PREVIEW", "true");
  vi.stubEnv("KQ_PLAYER_API_LIVE", "false");
  vi.stubEnv("KQ_LAUNCH_DOSSIER_JSON", "");
  mocks.session.mockResolvedValue(null);
  mocks.activeRun.mockResolvedValue(null);
  mocks.startRun.mockResolvedValue({ runId: "new-run" });
  mocks.limit.mockResolvedValue({ allowed: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("private production Placard access", () => {
  it.each([
    ["admin", ADMIN_ALLOWED_EMAIL, false],
    ["beta", "beta@example.test", true],
  ])("allows the verified %s account without opening the public launch", async (_role, email, beta) => {
    mocks.session.mockResolvedValue(player(email as string, beta as boolean));
    expect(await isKqPlayerRequestEnabled()).toBe(true);
    expect(isKqPublicPlayerApiEnabled()).toBe(false);
    expect((await GET()).status).toBe(200);
    expect(mocks.activeRun).toHaveBeenCalledWith("verified-customer-id");
  });

  it.each([null, player("ordinary@example.test")])("denies anonymous and ordinary customers even when contest beta restrictions are disabled", async (session) => {
    mocks.session.mockResolvedValue(session);
    expect(await isKqPlayerRequestEnabled()).toBe(false);
    expect((await GET()).status).toBe(404);
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
