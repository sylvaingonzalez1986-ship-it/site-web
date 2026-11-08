import { describe, expect, it } from "vitest";
import { getArenaResumeActions, parseArenaPlayerSummary, type ArenaPlayerSummary } from "./arena-player-summary";

const empty: ArenaPlayerSummary = { activeRun: false, readyLotCount: 0, availableFlowerCount: 0, supportPackCount: 0, buddiePackCount: 0 };
describe("Arena next activity", () => {
  it("keeps the saved culture before harvests and unopened packs", () => {
    const actions = getArenaResumeActions({ activeRun: true, readyLotCount: 2, availableFlowerCount: 3, supportPackCount: 1, buddiePackCount: 4 });
    expect(actions.map(action => action.id)).toEqual(["culture", "market", "jury", "buddies", "support"]);
    expect(actions[0].href).toBe("/arene/placard?view=game");
    expect(actions[1].href).toBe("/arene/placard?view=market&section=sales");
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
    for (const count of [-1, 1.5, "3", Infinity, NaN, null]) expect(parseArenaPlayerSummary({ ...empty, curingFlowerCount: count })).toBeNull();
    expect(parseArenaPlayerSummary({ ...empty, curingFlowerCount: 2 })?.curingFlowerCount).toBe(2);
  });
  it("guides curing lots to storage before suggesting a new culture or packs", () => {
    const actions = getArenaResumeActions({ ...empty, curingFlowerCount: 2, supportPackCount: 1 });
    expect(actions.map(action => action.id)).toEqual(["storage", "support"]);
    expect(actions[0]).toMatchObject({ title: "2 lots en affinage", href: "/arene/placard?view=workshop&section=storage" });
    expect(getArenaResumeActions({ ...empty, availableFlowerCount: 1, curingFlowerCount: 2 }).map(action => action.id)).toEqual(["jury", "storage"]);
  });
  it("keeps a verified trim prerequisite distinct from ready flowers and curing", () => {
    const summary = { ...empty, trimFlowerCount: 2, availableFlowerCount: 1, curingFlowerCount: 3 };
    expect(parseArenaPlayerSummary(summary)).toEqual(summary);
    const actions = getArenaResumeActions(summary);
    expect(actions.map(action => action.id)).toEqual(["trim", "jury", "storage"]);
    expect(actions[0]).toMatchObject({ title: "2 lots à trimmer", href: "/arene/placard?view=workshop&section=processing&workshop=trim", label: "Faire le trim" });
    expect(actions[0].description).toContain("toi-même");
    expect(getArenaResumeActions({ ...empty, trimFlowerCount: 0 }).map(action => action.id)).not.toContain("trim");
    expect(parseArenaPlayerSummary(empty)).not.toHaveProperty("trimFlowerCount");
  });
  it.each([-1, 1.5, "3", Infinity, NaN, null, Number.MAX_SAFE_INTEGER + 1])("rejects an invalid optional trim count: %s", trimFlowerCount => {
    expect(parseArenaPlayerSummary({ ...empty, trimFlowerCount })).toBeNull();
  });
});
