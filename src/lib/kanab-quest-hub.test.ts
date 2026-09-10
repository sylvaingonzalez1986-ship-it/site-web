import { describe, expect, it } from "vitest";
import { getKqPlacardNextAction } from "@/lib/kanab-quest-hub";

describe("Kanab Quest hub next action", () => {
  it("prioritizes the open gameplay loop before optional spending", () => {
    expect(getKqPlacardNextAction({ activeRun: true, readyLotCount: 2, availableFlowerCount: 1, equipmentGoalAffordable: true }).destination).toBe("game");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 2, availableFlowerCount: 1, equipmentGoalAffordable: true }).destination).toBe("market");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 1, equipmentGoalAffordable: true }).destination).toBe("arena");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 0, equipmentGoalAffordable: true }).destination).toBe("shop");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 0, equipmentGoalAffordable: false }).destination).toBe("game");
  });

  it("pluralizes pending lots and flowers", () => {
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 1, availableFlowerCount: 0, equipmentGoalAffordable: false }).title).toBe("1 lot à valoriser");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 3, availableFlowerCount: 0, equipmentGoalAffordable: false }).title).toBe("3 lots à valoriser");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 2, equipmentGoalAffordable: false }).description).toContain("2 Fleurs sont prêtes");
  });
});
