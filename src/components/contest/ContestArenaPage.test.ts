import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARENA_OPENING_AT } from "@/lib/arena-opening";

const openingAt = Date.parse(ARENA_OPENING_AT);

const mocks = vi.hoisted(() => ({
  cookieValues: vi.fn(),
  session: vi.fn(),
  admin: vi.fn(),
  activityRead: vi.fn(),
  entries: vi.fn(),
  unlocks: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: mocks.cookieValues }),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/admin-guard", () => ({ isCurrentRequestAdminAuthorized: mocks.admin }));
vi.mock("@/lib/contest-backend", () => ({
  getContestFeed: async () => ({ items: [] }),
  getContestNotebookUnlocks: mocks.unlocks,
  getContestProfile: async () => null,
  getContestProfileBadges: async () => [],
  getContestRankings: async () => ({ entries: [] }),
  getContestSeasons: async () => [],
  getContestTesterProgress: async () => null,
  getPublicContestEntries: mocks.entries,
  isContestSchemaMissingError: () => false,
}));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: async () => false }));
vi.mock("@/lib/supabase/contest-bundle-rewards-backend", () => ({ getContestBundleRewards: mocks.activityRead }));
vi.mock("./ContestArenaHub", () => ({ ContestArenaHub: () => null }));
vi.mock("./ContestHubClient", () => ({ ContestHubClient: () => null }));
vi.mock("./ContestTastingBook", () => ({ ContestTastingBook: () => null }));
vi.mock("./ContestSchemaUnavailable", () => ({ ContestSchemaUnavailable: () => null }));

import { ContestArenaPage, type ContestArenaPageProps } from "./ContestArenaPage";
import { ContestArenaHub } from "./ContestArenaHub";
import { ContestTastingBook } from "./ContestTastingBook";
import { ContestHubClient } from "./ContestHubClient";

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
  vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", "true");
  vi.spyOn(Date, "now").mockReturnValue(openingAt + 1);
  mocks.cookieValues.mockReturnValue([]);
  mocks.session.mockResolvedValue(null);
  mocks.admin.mockResolvedValue(false);
  mocks.entries.mockResolvedValue({ entries: [], selectedSeason: null });
  mocks.unlocks.mockResolvedValue([]);
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
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("also opens discovery for a connected customer without beta access", async () => {
    connectOrdinaryCustomer();
    const result = await visit();
    expect(result.type).toBe(ContestArenaHub);
    expect(mocks.session).toHaveBeenCalledOnce();
  });

  it("opens discovery for an authorized customer's identity", async () => {
    mocks.cookieValues.mockReturnValue([{ name: "sb-test-auth-token", value: "session-cookie" }]);
    mocks.session.mockResolvedValue({ customerId: "beta-player", customer: { email: "beta@example.test", contestBetaEnabled: true } });
    const result = await visit();
    expect(result.type).toBe(ContestArenaHub);
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
    { surface: "arena" as const, params: { vue: "classement" }, next: "/arene?vue=classement" },
    { surface: "arena" as const, params: { vue: "jouer" }, next: "/arene?vue=jouer" },
    { surface: "arena" as const, params: { vue: "classement", season: "automne" }, next: "/arene?season=automne&vue=classement" },
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
    { phase: "before", now: openingAt - 1, prelaunch: true },
    { phase: "after", now: openingAt + 1, prelaunch: false },
  ])("ignores the retired first-culture return $phase opening", async ({ now, prelaunch }) => {
    vi.spyOn(Date, "now").mockReturnValue(now);
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

describe("Public tasting notebook", () => {
  it.each([false, true])("opens to an ordinary visitor before the game, authenticated=%s", async authenticated => {
    vi.mocked(Date.now).mockReturnValue(openingAt - 1);
    vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
    vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "false");
    if (authenticated) connectOrdinaryCustomer();

    const result = await visit({ track: "concours", entry: "selected-flower", edit: "notes" }, "notebook");
    expect(result.type).toBe(ContestTastingBook);
    expect(result.props).toMatchObject({
      isAuthenticated: authenticated,
      initialTrack: "concours", initialEntryId: "selected-flower", initialEditNotes: true,
      draftOwnerId: authenticated ? "ordinary-customer" : null,
    });
    expect(mocks.entries).toHaveBeenCalledOnce();
    expect(mocks.unlocks).toHaveBeenCalledWith({
      customerId: authenticated ? "ordinary-customer" : undefined,
      customerEmail: authenticated ? "ordinary@example.test" : undefined,
      seasonCode: undefined,
    });
  });

  it("keeps the notebook and its flower ranking public after the game opening", async () => {
    expect((await visit({}, "notebook")).type).toBe(ContestTastingBook);
    expect((await visit({}, "notebook-ranking")).type).toBe(ContestHubClient);
  });

  it("keeps the selected flower and note editor when following a legacy notebook link", async () => {
    vi.mocked(Date.now).mockReturnValue(openingAt - 1);
    await expect(visit({ vue: "carnet", track: "concours", entry: "flower", edit: "notes" })).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/arene/carnet/concours?entry=flower&edit=notes;307;",
    });
    expect(mocks.entries).not.toHaveBeenCalled();
  });

  it("honors a notebook-specific shutdown without reading data", async () => {
    vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", "false");
    await expect(visit({}, "notebook")).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(mocks.entries).not.toHaveBeenCalled();
  });
});
