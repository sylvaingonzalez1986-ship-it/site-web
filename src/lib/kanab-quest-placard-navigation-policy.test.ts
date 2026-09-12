import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (file: string) => readFileSync(join(process.cwd(), "src", file), "utf8");
describe("Game viewport integration", () => {
  it("uses the same viewport guard in the Placard, game and arena", () => {
    for (const file of ["components/placard/PlacardPlayerShell.tsx", "components/placard/KanabQuestDicePrototype.tsx", "components/contest/ContestHubClient.tsx"]) {
      expect(source(file)).toContain("useGameViewport");
    }
    expect(source("components/placard/PlacardPlayerShell.tsx")).not.toContain("SCROLL_SETTLE_MS");
    expect(source("components/placard/KanabQuestDicePrototype.tsx")).not.toContain("preserveMobileViewport");
  });
  it("uses coordinated locks for nested game windows", () => {
    for (const file of ["KqMarketDesk", "KqSupportBoosterShop", "KqEquipmentInventoryModal"]) {
      expect(source("components/placard/" + file + ".tsx")).toContain("useBodyScrollLock");
      expect(source("components/placard/" + file + ".tsx")).not.toContain('document.body.style.overflow =');
    }
    expect(source("hooks/useBodyScrollLock.ts")).not.toContain("window.scrollTo");
  });
});
