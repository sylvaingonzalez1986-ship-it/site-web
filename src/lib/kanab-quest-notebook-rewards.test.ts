import { describe, expect, it } from "vitest";
import {
  formatKqNotebookReward,
  getKqNotebookReward,
  KQ_CULTURE_TOKEN_RUN_CAP,
  KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE,
  KQ_NOTEBOOK_REWARDS_LIVE,
} from "@/lib/kanab-quest-notebook-rewards";

describe("Kanab Quest notebook rewards", () => {
  it("keeps every reward within the intended economy bounds", () => {
    expect(KQ_NOTEBOOK_REWARDS_LIVE).toBe(true);
    for (const reward of Object.values(KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE)) {
      expect(reward.supportBoosters).toBeGreaterThanOrEqual(0);
      expect(reward.supportBoosters).toBeLessThanOrEqual(3);
      expect(reward.cultureTokens).toBeGreaterThanOrEqual(0);
      expect(reward.cultureTokens).toBeLessThanOrEqual(3);
    }
    expect(KQ_CULTURE_TOKEN_RUN_CAP).toBe(2);
  });

  it("routes only the two visible tasting missions toward the Placard economy", () => {
    expect(Object.keys(KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE)).toEqual([
      "premier-carnet",
      "combo-aromatique",
    ]);
    expect(getKqNotebookReward("premier-carnet")).toEqual({
      supportBoosters: 1,
      cultureTokens: 0,
    });
    expect(getKqNotebookReward("nez-divin")).toEqual({ supportBoosters: 0, cultureTokens: 0 });
  });

  it("formats each mission as one La Botte booster", () => {
    expect(formatKqNotebookReward(getKqNotebookReward("premier-carnet"))).toBe("1 booster La Botte");
    expect(formatKqNotebookReward(getKqNotebookReward("combo-aromatique"))).toBe("1 booster La Botte");
  });
});
