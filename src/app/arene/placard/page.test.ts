import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARENA_OPENING_AT } from "@/lib/arena-opening";

const openingAt = Date.parse(ARENA_OPENING_AT);

const mocks = vi.hoisted(() => ({ session: vi.fn(), introduction: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/components/contest/ArenaGameEntry", () => ({ ArenaGameEntry: () => null }));
vi.mock("@/lib/supabase/arena-introduction-backend", () => ({ getArenaIntroductionState: mocks.introduction }));
vi.mock("@/lib/supabase/arena-beta-connection", () => ({ getArenaBetaConnectionKey: async () => "test-connection" }));

import PlacardPlayerPage from "./page";

function renderPage(query: Record<string, string | string[] | undefined> = {}) {
  return PlacardPlayerPage({ searchParams: Promise.resolve(query) });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(openingAt + 1);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "true");
  vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "true");
  vi.stubEnv("KQ_PLAYER_API_LIVE", "false");
  mocks.session.mockResolvedValue(null);
  mocks.introduction.mockResolvedValue("new");
});

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Placard page entry", () => {
  it("sends a visitor without a customer session to login with a return to the Placard", async () => {
    await expect(renderPage()).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/compte/connexion?next=%2Farene%2Fplacard;307;",
    });
    expect(mocks.introduction).not.toHaveBeenCalled();
  });

  it.each([
    { view: "staff", employee: "employee-a" },
    { view: "workshop", section: "processing", workshop: "trim", flower: "flower-b", employee: "employee-a", from: "harvests", fromSection: "storage", fromFlower: "flower-b" },
    { world: "3d", view: "game", zone: "zone-a", run: "run-a", from: "missions" },
  ])("returns a logged-out player to the same Staff or Trim context: %j", async query => {
    const error = await renderPage(query).catch(error => error);
    const login = new URL(error.digest.split(";")[2], "https://example.test");
    const destination = new URL(login.searchParams.get("next")!, login.origin);
    expect(login.pathname).toBe("/compte/connexion");
    expect(destination.origin).toBe(login.origin);
    expect(destination.pathname).toBe("/arene/placard");
    expect(Object.fromEntries(destination.searchParams)).toEqual(query);
    expect(mocks.introduction).not.toHaveBeenCalled();
  });

  it("preserves repeated and encoded query values without treating a nested next as the destination", async () => {
    const query = {
      view: ["workshop", "staff"],
      flower: "lot & reprise + été 20% #1",
      employee: ["employee/a", "employee?b=1"],
      from: "",
      next: "https://elsewhere.invalid/compte?view=staff",
      absent: undefined,
    };
    const error = await renderPage(query).catch(error => error);
    const login = new URL(error.digest.split(";")[2], "https://example.test");
    const destination = new URL(login.searchParams.get("next")!, login.origin);
    expect([...login.searchParams.keys()]).toEqual(["next"]);
    expect(destination.origin).toBe(login.origin);
    expect(destination.pathname).toBe("/arene/placard");
    expect(destination.searchParams.getAll("view")).toEqual(query.view);
    expect(destination.searchParams.get("flower")).toBe(query.flower);
    expect(destination.searchParams.getAll("employee")).toEqual(query.employee);
    expect(destination.searchParams.get("from")).toBe("");
    expect(destination.searchParams.get("next")).toBe(query.next);
    expect(destination.searchParams.has("absent")).toBe(false);
    expect(destination.hash).toBe("");
  });

  it.each(["employee\\other", "employee\nother", "%255celsewhere.invalid"])("falls back safely when a query makes the return path unsafe: %j", async employee => {
    await expect(renderPage({ view: "staff", employee })).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;replace;/compte/connexion?next=%2Farene%2Fplacard;307;",
    });
  });

  it("keeps the page unavailable when the module is disabled", async () => {
    vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
    await expect(renderPage()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.introduction).not.toHaveBeenCalled();
  });

  it("still denies a connected customer without admin or beta access", async () => {
    mocks.session.mockResolvedValue({
      customerId: "ordinary-customer",
      customer: { email: "ordinary@example.test", contestBetaEnabled: false },
    });
    await expect(renderPage()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(mocks.introduction).not.toHaveBeenCalled();
  });

  it("opens the verified player's quarter independently of the retired introduction", async () => {
    mocks.session.mockResolvedValue({ customerId: "verified-id", customer: { email: "player@example.test", contestBetaEnabled: true } });
    const entry = await renderPage();
    expect(mocks.introduction).not.toHaveBeenCalled();
    expect(entry.props).toEqual({ userId: "verified-id", betaConnectionKey: "test-connection" });
    expect(entry.key).toBe("verified-id");
  });

  it("returns a signed-out player with a 2D bookmark to the same activity in 3D", async () => {
    const query = { world: "2d", view: "treasury", pole: "bank" };
    const error = await renderPage(query).catch(error => error);
    const login = new URL(error.digest.split(";")[2], "https://example.test");
    expect(login.searchParams.get("next")).toBe("/arene/placard?world=3d&view=treasury&pole=bank");
  });

  it.each([{ world: "2d" }, { world: "3d" }, { world: "invalid" }, { world: ["3d", "2d"] }])("ignores presentation overrides at the game entry: %j", async query => {
    mocks.session.mockResolvedValue({ customerId: "verified-id", customer: { email: "player@example.test", contestBetaEnabled: true } });
    const entry = await renderPage(query);
    expect(entry.props).not.toHaveProperty("worldMode");
  });
});

it.each([true, false])("allows only beta players into the Placard before opening: %s", async beta => {
  vi.spyOn(Date, "now").mockReturnValue(openingAt - 1);
  mocks.session.mockResolvedValue({ customerId: "verified-id", customer: { email: "player@example.test", contestBetaEnabled: beta } });
  if (beta) expect(await renderPage()).toBeTruthy();
  else await expect(renderPage()).rejects.toMatchObject({ digest: "NEXT_REDIRECT;replace;/arene?mode=jouer&ouverture=1;307;" });
});
