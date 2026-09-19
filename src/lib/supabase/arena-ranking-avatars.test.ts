import { beforeEach, describe, expect, it, vi } from "vitest";
import { getArenaRankingAvatars } from "./arena-ranking-avatars";
const mocks = vi.hoisted(() => ({ read: vi.fn(), select: vi.fn(), from: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ from: mocks.from }) }));
const profile = { user_id: "player-b", nickname: "Camille", gender: "female", clothing: "teal", skin: "honey", strength: "merchant", appearance: { hair: "braids", hairColor: "pink", private_note: "secret" }, email: "private@example.test" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ in: mocks.read });
});
describe("public ranking portraits", () => {
  it("joins by player ID in one deduplicated batch and exposes only validated appearance", async () => {
    mocks.read.mockResolvedValue({ data: [profile, { ...profile, user_id: "player-a", skin: "ivory" }], error: null });
    const avatars = await getArenaRankingAvatars(["player-a", "player-b", "player-a", ""]);
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith("user_id", ["player-a", "player-b"]);
    expect(avatars.get("player-a")?.skin).toBe("ivory");
    expect(avatars.get("player-b")?.skin).toBe("honey");
    expect(avatars.get("player-b")?.appearance?.hair).toBe("braids");
    expect(Object.keys(avatars.get("player-b")!).sort()).toEqual(["appearance", "clothing", "gender", "skin"]);
    expect(JSON.stringify([...avatars.values()])).not.toMatch(/secret|private|merchant|Camille|player-/);
  });
  it("leaves missing, invalid and unrelated portraits out while supporting old appearances", async () => {
    mocks.read.mockResolvedValue({ data: [
      { ...profile, user_id: "legacy", appearance: undefined },
      { ...profile, user_id: "invalid", appearance: { hair: "unknown" } },
      { ...profile, user_id: "unrelated" },
    ], error: null });
    const avatars = await getArenaRankingAvatars(["legacy", "invalid", "missing"]);
    expect([...avatars.keys()]).toEqual(["legacy"]);
    expect(avatars.get("legacy")).toEqual({ gender: "female", clothing: "teal", skin: "honey" });
  });
  it("does not query for an empty leaderboard", async () => {
    expect((await getArenaRankingAvatars([])).size).toBe(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("keeps scores available when portrait storage fails", async () => {
    mocks.read.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await getArenaRankingAvatars(["player-a"])).size).toBe(0);
    mocks.read.mockRejectedValue(new Error("network"));
    expect((await getArenaRankingAvatars(["player-a"])).size).toBe(0);
  });
});
