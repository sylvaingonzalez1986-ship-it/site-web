import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const client = readFileSync(
  join(process.cwd(), "src/components/placard/KanabQuestDicePrototype.tsx"),
  "utf8",
);
const styles = readFileSync(
  join(process.cwd(), "src/components/placard/KanabQuestDicePrototype.module.css"),
  "utf8",
);

describe("Kanab Quest daily challenge player UI", () => {
  it("exposes the detailed daily board in the player arena", () => {
    expect(styles).toContain('.page[data-view-mode="arena"] .setupPanel>.dailyChallengeBoard{display:block!important}');
    expect(client).toContain("Les mêmes objectifs sont validables en duel classé ou en entraînement.");
  });

  it("shows durable claim progress and the remaining daily point budget", () => {
    expect(client).toContain("const claimedDailyChallengeCount = dailyChallenges.length - rewardableDailyChallenges.length");
    expect(client).toContain("{claimedDailyChallengeCount}/{dailyChallenges.length}");
    expect(client).toContain("{remainingDailyChallengePoints} points encore disponibles");
    expect(client).toContain("Objectif validé aujourd’hui.");
  });
});
