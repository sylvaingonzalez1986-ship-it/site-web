import { describe, expect, it } from "vitest";
import {
  formatKqNotebookReward,
  getKqNotebookReward,
  KQ_CULTURE_TOKEN_RUN_CAP,
  KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE,
  KQ_NOTEBOOK_REWARDS_LIVE,
} from "@/lib/kanab-quest-notebook-rewards";

describe("Kanab Quest notebook rewards", () => {
  it("retires mission rewards without changing the use of acquired culture tokens", () => {
    expect(KQ_NOTEBOOK_REWARDS_LIVE).toBe(false);
    expect(KQ_NOTEBOOK_REWARDS_BY_BADGE_CODE).toEqual({});
    expect(KQ_CULTURE_TOKEN_RUN_CAP).toBe(2);
  });

  it.each(["premier-carnet", "combo-aromatique", "nez-divin", "unknown"])("offers no mission reward for %s", (code) => {
    expect(getKqNotebookReward(code)).toEqual({
      supportBoosters: 0,
      cultureTokens: 0,
    });
    expect(formatKqNotebookReward(getKqNotebookReward(code))).toBe("");
  });

  it("can still format historical reward receipts", () => {
    expect(formatKqNotebookReward({ supportBoosters: 1, cultureTokens: 0 })).toBe("1 booster Botte du Chanvrier");
    expect(formatKqNotebookReward({ supportBoosters: 2, cultureTokens: 1 })).toBe("2 boosters Botte du Chanvrier + 1 jeton Coup de pouce");
  });
});
