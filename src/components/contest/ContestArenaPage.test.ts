import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieValues: vi.fn(),
  session: vi.fn(),
  admin: vi.fn(),
  activityRead: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: mocks.cookieValues }),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/admin-guard", () => ({ isCurrentRequestAdminAuthorized: mocks.admin }));
vi.mock("@/lib/contest-backend", () => ({
  getContestFeed: mocks.activityRead,
  getContestNotebookUnlocks: mocks.activityRead,
  getContestProfile: mocks.activityRead,
  getContestProfileBadges: mocks.activityRead,
  getContestRankings: mocks.activityRead,
  getContestSeasons: mocks.activityRead,
  getContestTesterProgress: mocks.activityRead,
  getPublicContestEntries: mocks.activityRead,
  isContestSchemaMissingError: () => false,
}));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.activityRead }));
vi.mock("@/lib/supabase/contest-bundle-rewards-backend", () => ({ getContestBundleRewards: mocks.activityRead }));
vi.mock("./ContestArenaHub", () => ({ ContestArenaHub: () => null }));
vi.mock("./ContestHubClient", () => ({ ContestHubClient: () => null }));
vi.mock("./ContestTastingBook", () => ({ ContestTastingBook: () => null }));
vi.mock("./ContestSchemaUnavailable", () => ({ ContestSchemaUnavailable: () => null }));

import { ContestArenaPage, type ContestArenaPageProps } from "./ContestArenaPage";
import { ContestArenaHub } from "./ContestArenaHub";

type SearchParams = Awaited<ContestArenaPageProps["searchParams"]>;
const visit = (params: SearchParams = {}, surface: ContestArenaPageProps["surface"] = "arena") =>
  ContestArenaPage({ searchParams: Promise.resolve(params), surface });

function connectOrdinaryCustomer() {
  mocks.cookieValues.mockReturnValue([{ name: "sb-test-auth-token", value: "session-cookie" }]);
  mocks.session.mockResolvedValue({
    customerId: "ordinary-customer",
    customer: { email: "ordinary@example.test", contestBetaEnabled: false },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "true");
  vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "true");
  vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "true");
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-16T12:00:00Z"));
  mocks.cookieValues.mockReturnValue([]);
  mocks.session.mockResolvedValue(null);
  mocks.admin.mockResolvedValue(false);
  mocks.activityRead.mockImplementation(() => { throw new Error("Unexpected activity data access"); });
});

afterEach(() => {
  // The public discovery surface and rejected routes must never read game data.
  expect(mocks.activityRead).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Arena discovery page access", () => {
  it("opens the public hub for a guest while official activities remain beta restricted", async () => {
    const result = await visit();
    expect(result.type).toBe(ContestArenaHub);
    expect(result.props).not.toHaveProperty("continueAfterTrial");
    expect(result.props.personalSummaryEnabled).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("also opens discovery for a connected customer without beta access", async () => {
    connectOrdinaryCustomer();
    const result = await visit();
    expect(result.type).toBe(ContestArenaHub);
    expect(result.props.personalSummaryEnabled).toBe(false);
    expect(mocks.session).toHaveBeenCalledOnce();
  });

  it("enables a fresh personal summary for an authorized customer's identity", async () => {
    mocks.cookieValues.mockReturnValue([{ name: "sb-test-auth-token", value: "session-cookie" }]);
    mocks.session.mockResolvedValue({ customerId: "beta-player", customer: { email: "beta@example.test", contestBetaEnabled: true } });
    const result = await visit();
    expect(result.props.personalSummaryEnabled).toBe(true);
    expect(result.key).toBe("beta-player");
  });

  it.each(["CONTEST_FEATURE_ENABLED", "CONTEST_FEATURE_ALLOW_PRODUCTION"])(
    "keeps the hub unavailable after opening when %s is disabled",
    async flag => {
      vi.stubEnv(flag, "false");
      await expect(visit()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    },
  );

  it.each([
    { surface: "notebook" as const, params: {}, next: "/arene/carnet/regular" },
    { surface: "notebook-ranking" as const, params: {}, next: "/arene/carnet/classement" },
    { surface: "arena" as const, params: { vue: "classement" }, next: "/arene" },
    { surface: "arena" as const, params: { vue: "jouer" }, next: "/arene" },
  ])("keeps guest activity entry protected: $surface $params", async ({ surface, params, next }) => {
    await expect(visit(params, surface)).rejects.toMatchObject({
      digest: `NEXT_REDIRECT;replace;/compte/connexion?next=${encodeURIComponent(next)};307;`,
    });
  });

  it("does not grant ranking access to an ordinary customer who can see discovery", async () => {
    connectOrdinaryCustomer();
    await expect(visit({ vue: "classement" })).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it.each([
    { date: "2026-10-07T12:00:00Z", prelaunch: true },
    { date: "2026-10-16T12:00:00Z", prelaunch: false },
  ])("ignores the retired first-culture return before/after opening: $date", async ({ date, prelaunch }) => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(date));
    connectOrdinaryCustomer();
    const result = await visit({ "premiere-culture": "terminee" });
    expect(result.type).toBe(ContestArenaHub);
    expect(result.props).not.toHaveProperty("continueAfterTrial");
    expect(Boolean(result.props.activitiesLocked)).toBe(prelaunch);
  });

  it("ignores an unrecognized completion query", async () => {
    const result = await visit({ "premiere-culture": "inconnue" });
    expect(result.type).toBe(ContestArenaHub);
    expect(result.props).not.toHaveProperty("continueAfterTrial");
  });
});
