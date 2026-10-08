import { describe, expect, it } from "vitest";
import { getArenaResumeActions, parseArenaPlayerSummary, type ArenaPlayerSummary } from "./arena-player-summary";

const empty: ArenaPlayerSummary = { activeRun: false, readyLotCount: 0, availableFlowerCount: 0, supportPackCount: 0, buddiePackCount: 0 };
describe("Arena next activity", () => {
  it("keeps the saved culture before harvests and unopened packs", () => {
    const actions = getArenaResumeActions({ activeRun: true, readyLotCount: 2, availableFlowerCount: 3, supportPackCount: 1, buddiePackCount: 4 });
    expect(actions.map(action => action.id)).toEqual(["culture", "market", "jury", "buddies", "support"]);
    expect(actions[0].href).toBe("/arene/placard?view=game");
    expect(actions[1].href).toBe("/arene/placard?view=market");
    expect(actions[2].href).toBe("/arene/placard?view=arena");
    expect(actions[3].href).toBe("/profil/collection");
    expect(actions[4].href).toBe("/arene/placard?view=shop");
  });
  it("offers a new culture only when there is nothing to resume or collect", () => {
    expect(getArenaResumeActions(empty)[0].label).toBe("Préparer ma culture");
    expect(getArenaResumeActions({ ...empty, supportPackCount: 1 })[0].id).toBe("support");
    expect(getArenaResumeActions({ ...empty, availableFlowerCount: 1, supportPackCount: 2 })[0].id).toBe("jury");
  });
  it("rejects malformed summaries instead of inventing a zero balance", () => {
    expect(parseArenaPlayerSummary(empty)).toEqual(empty);
    expect(parseArenaPlayerSummary(null)).toBeNull();
    expect(parseArenaPlayerSummary({ activeRun: false })).toBeNull();
    for (const count of [-1, 1.5, "3", Infinity, NaN]) expect(parseArenaPlayerSummary({ ...empty, supportPackCount: count })).toBeNull();
  });
});
