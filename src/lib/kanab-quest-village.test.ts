import { describe, expect, it } from "vitest";
import { getKqPlacardNextAction } from "./kanab-quest-hub";
import { getKqVillageWelcome } from "./kanab-quest-village";

const action = getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 0, equipmentGoalAffordable: false });

describe("Sylvain's village welcome", () => {
  it("does not invent progress or a previous visit when history is absent", () => {
    expect(getKqVillageWelcome(action).reply).not.toMatch(/retour|absence|première vente/);
  });

  it("keeps active cultivation advice when there are other available actions", () => {
    const current = getKqPlacardNextAction({ activeRun: true, readyLotCount: 2, availableFlowerCount: 1, equipmentGoalAffordable: true });
    const welcome = getKqVillageWelcome(current);
    expect(welcome.reply).toContain("Ta culture est sauvegardée");
    expect(current.destination).toBe("game");
  });
});
