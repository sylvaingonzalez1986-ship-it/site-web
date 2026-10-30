import { describe, expect, it } from "vitest";
import type { KqOfficialBattle, KqOfficialFlower } from "./kanab-quest-api";
import { getKqJuryTarget } from "./kanab-quest-jury-target";

const flower = (status: KqOfficialFlower["status"]) => ({ id: "wanted", status } as KqOfficialFlower);
const battle = (id: string, status: KqOfficialBattle["status"], flowerId = "wanted", date = "2026-10-30T12:00:00Z") => ({
  id, status, playerFlower: { id: flowerId }, lockedAt: date, verdictAt: status === "locked" ? null : date,
} as KqOfficialBattle);

describe("the jury destination follows the requested harvest", () => {
  it("reveals a locked duel even when the flower source still says available", () => {
    expect(getKqJuryTarget([flower("available")], [battle("duel", "locked")], "wanted")).toEqual({ kind: "battle", id: "duel" });
  });
  it.each(["available", "queued", "locked"] as const)("keeps a %s flower when no current battle exists", status => {
    expect(getKqJuryTarget([flower(status)], [battle("old", "cancelled")], "wanted")).toEqual({ kind: "flower", id: "wanted" });
  });
  it("finds the latest receipt of a consumed flower without changing the history", () => {
    const battles = [battle("old", "cancelled", "wanted", "2026-10-29T12:00:00Z"), battle("recent", "verdict")];
    const before = structuredClone(battles);
    expect(getKqJuryTarget([flower("burned")], battles, "wanted")).toEqual({ kind: "battle", id: "recent" });
    expect(battles).toEqual(before);
  });
  it("finds a receipt even when its flower has left the reserve endpoint", () => {
    expect(getKqJuryTarget([], [battle("recent", "verdict")], "wanted")).toEqual({ kind: "battle", id: "recent" });
  });
  it("does not return to an available-looking flower after its confirmed verdict", () => {
    expect(getKqJuryTarget([flower("available")], [battle("judged", "verdict")], "wanted")).toEqual({ kind: "battle", id: "judged" });
  });
  it("does not substitute another lot when the requested one is missing", () => {
    expect(getKqJuryTarget([{ ...flower("available"), id: "other" }], [battle("other-duel", "locked", "other")], "wanted")).toEqual({ kind: "missing" });
    expect(getKqJuryTarget([flower("burned")], [], "wanted")).toEqual({ kind: "missing" });
  });
  it("does not automatically select a duel on a general visit", () => {
    expect(getKqJuryTarget([flower("available")], [battle("duel", "locked")])).toEqual({ kind: "none" });
  });
});
