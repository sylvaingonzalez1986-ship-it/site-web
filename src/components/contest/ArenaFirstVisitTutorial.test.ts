import { describe, expect, it, vi } from "vitest";
import {
  ARENA_TUTORIAL_STEPS,
  ARENA_TUTORIAL_STORAGE_KEY,
  markArenaTutorialSeen,
  shouldShowArenaTutorial,
} from "@/components/contest/ArenaFirstVisitTutorial";
import { ARENA_TUTORIAL_REPUTATION_ROWS } from "@/lib/arena-tutorial";

describe("ArenaFirstVisitTutorial", () => {
  it("opens on the first visit and stays dismissed afterwards", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    expect(shouldShowArenaTutorial(storage)).toBe(true);
    markArenaTutorialSeen(storage);
    expect(values.get(ARENA_TUTORIAL_STORAGE_KEY)).toBe("seen");
    expect(shouldShowArenaTutorial(storage)).toBe(false);
  });

  it("remains usable when private storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error("blocked"); }),
      setItem: vi.fn(() => { throw new Error("blocked"); }),
    };

    expect(shouldShowArenaTutorial(storage)).toBe(true);
    expect(() => markArenaTutorialSeen(storage)).not.toThrow();
  });

  it("shows the new edition once even if the old tutorial was dismissed", () => {
    const storage = { getItem: (key: string) => key === "lcb_arena_tutorial_v1" ? "seen" : null, setItem: vi.fn() };
    expect(shouldShowArenaTutorial(storage)).toBe(true);
    expect(ARENA_TUTORIAL_STORAGE_KEY).toBe("lcb_arena_tutorial_v2");
  });

  it("covers the complete journey with short chapters and valid destinations", () => {
    expect(ARENA_TUTORIAL_STEPS.map((step) => step.id)).toEqual([
      "carnet", "placard", "boutique", "inventaire", "culture", "duel", "marche", "reputation",
    ]);
    expect(ARENA_TUTORIAL_STEPS.map((step) => step.number)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
    for (const step of ARENA_TUTORIAL_STEPS) {
      expect(step.features).toHaveLength(3);
      expect(step.tip).toBeTruthy();
      expect(step.href).toMatch(/^\/arene(?:\/carnet\/regular|\/placard(?:\?view=(?:game|shop&catalog=equipment|arena|market))?|\?vue=classement)$/);
    }
  });

  it("distinguishes the two budgets and buying from installing", () => {
    const shop = ARENA_TUTORIAL_STEPS.find((step) => step.id === "boutique")!;
    expect(shop.features[0].description).toContain("Les points servent aux packs");
    expect(shop.features[0].description).toContain("monnaie de jeu");
    expect(shop.href).toBe("/arene/placard?view=shop&catalog=equipment");
    const inventory = ARENA_TUTORIAL_STEPS.find((step) => step.id === "inventaire")!;
    expect(inventory.features[0].description).toContain("possédé et compatible");
    expect(inventory.features[1].description).toContain("ne le détruit pas");
  });

  it("explains random opponents, burning and irreversible settlement", () => {
    const duel = ARENA_TUTORIAL_STEPS.find((step) => step.id === "duel")!;
    expect(duel.lead).toContain("pas celle de ton adversaire");
    expect(duel.features[1].description).toContain("reste en attente");
    expect(duel.features[2].description).toContain("ne peut plus être engagée");
    const market = ARENA_TUTORIAL_STEPS.find((step) => step.id === "marche")!;
    expect(market.features[2].description).toContain("vente est définitive");
  });

  it("uses the current quality thresholds and warns about reputation losses", () => {
    expect(ARENA_TUTORIAL_REPUTATION_ROWS).toMatchObject([
      { loss: "< 7", neutral: "7 à 7,9", gain: "≥ 8" },
      { loss: "< 8", neutral: "8 à 8,7", gain: "≥ 8,8" },
    ]);
    const reputation = ARENA_TUTORIAL_STEPS.find((step) => step.id === "reputation")!;
    expect(reputation.features[0].description).toContain("0 point en hash tamisé, mais -4 points en Rosin Sélection");
    expect(reputation.features[1].description).toContain("exigent un gain de réputation positif");
    expect(reputation.tip).toContain("s’arrêtent à zéro");
  });
});
