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
    expect(KQ_NOTEBOOK_REWARDS_LIVE).toBe(false);
    for (const reward of Object.values(KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE)) {
      expect(reward.supportBoosters).toBeGreaterThanOrEqual(0);
      expect(reward.supportBoosters).toBeLessThanOrEqual(3);
      expect(reward.cultureTokens).toBeGreaterThanOrEqual(0);
      expect(reward.cultureTokens).toBeLessThanOrEqual(3);
    }
    expect(KQ_CULTURE_TOKEN_RUN_CAP).toBe(2);
  });

  it("routes ten tasting missions toward the Placard economy", () => {
    expect(Object.keys(KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE)).toHaveLength(10);
    expect(getKqNotebookReward("premier-carnet")).toEqual({
      supportBoosters: 1,
      cultureTokens: 0,
    });
    expect(getKqNotebookReward("nez-divin")).toEqual({ supportBoosters: 0, cultureTokens: 0 });
  });

  it("formats rewards without empty fragments", () => {
    expect(formatKqNotebookReward(getKqNotebookReward("gouteur-regulier"))).toBe(
      "1 booster La Botte + 2 jetons Coup de pouce",
    );
    expect(formatKqNotebookReward(getKqNotebookReward("critique-utile"))).toBe(
      "1 jeton Coup de pouce",
    );
  });
});
