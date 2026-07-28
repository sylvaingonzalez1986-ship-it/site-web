import { describe, expect, it } from "vitest";
import {
  advancePlacardCulture,
  assessPlacardAction,
  getPlacardDailyEvent,
  getPlacardActionHand,
  getPlacardBiologicalReport,
  getPlacardQuickStatus,
  getPlacardCombos,
  PLACARD_SETUPS,
  PLACARD_DRYING_DAY,
  PLACARD_TOTAL_DAYS,
  scorePlacardHarvest,
  startPlacardCulture,
  type PlacardCultureState,
} from "@/lib/placard-game";

describe("placard game prototype", () => {
  it("produces deterministic turns", () => {
    const initial = startPlacardCulture("HH2026-003", 42);
    expect(advancePlacardCulture(initial, "inspect-canopy")).toEqual(
      advancePlacardCulture(initial, "inspect-canopy"),
    );
  });

  it("reaches a harvest after the expected number of turns", () => {
    let state: PlacardCultureState = startPlacardCulture("HH2026-014", 9);
    while (!state.harvested) {
      state = advancePlacardCulture(state, state.water < 48 ? "measured-irrigation" : "renew-air");
    }

    expect(state.day).toBe(PLACARD_TOTAL_DAYS);
    expect(scorePlacardHarvest(state).total).toBeGreaterThan(0);
  });

  it("rejects an unknown variety", () => {
    expect(() => startPlacardCulture("unknown", 1)).toThrow("Variété inconnue");
  });

  it("applies the selected installation", () => {
    const eco = startPlacardCulture("HH2026-003", 42, "eco");
    const performance = startPlacardCulture("HH2026-003", 42, "performance");

    expect(eco.light).toBe(PLACARD_SETUPS[0].light);
    expect(performance.light).toBeGreaterThan(eco.light);
    expect(performance.setupCode).toBe("performance");
  });

  it("selects daily events deterministically", () => {
    expect(getPlacardDailyEvent(2026, 4)).toEqual(getPlacardDailyEvent(2026, 4));
    expect(getPlacardDailyEvent(2026, 4).label.length).toBeGreaterThan(0);
  });

  it("exposes every cultivation technique on each live-plant turn", () => {
    const state = { seed: 9, day: 4, water: 30 };
    const hand = getPlacardActionHand(state);

    expect(hand).toHaveLength(9);
    expect(new Set(hand).size).toBe(9);
    expect(hand).toContain("measured-irrigation");
    expect(getPlacardActionHand(state)).toEqual(hand);
  });

  it("turns raw values into contextual biological observations", () => {
    const balanced = startPlacardCulture("HH2026-003", 42);
    const saturated = { ...balanced, water: 88, airflow: 35, stress: 38 };
    const report = getPlacardBiologicalReport(saturated);

    expect(report).toHaveLength(6);
    expect(report.find((item) => item.code === "water-status")?.status).toBe("Substrat trop humide");
    expect(report.find((item) => item.code === "sanitary-pressure")?.tone).toBe("alert");
    expect(report.every((item) => item.detail.length > 20)).toBe(true);
  });

  it("deals a distinct post-harvest hand and stops biomass growth", () => {
    const drying: PlacardCultureState = { ...startPlacardCulture("HH2026-003", 42), day: PLACARD_DRYING_DAY, biomass: 52 };
    const hand = getPlacardActionHand(drying);
    const next = advancePlacardCulture(drying, hand[0]);

    expect(hand).toHaveLength(6);
    expect(hand.every((action) => ["space-flowers", "control-drying-air", "inspect-drying", "stabilize-storage", "vent-containers", "sensory-check"].includes(action))).toBe(true);
    expect(next.biomass).toBe(drying.biomass);
    expect(getPlacardBiologicalReport(drying)[0].label).toBe("Humidité résiduelle");
  });

  it("assesses techniques from the current state and phase", () => {
    const dry: PlacardCultureState = { ...startPlacardCulture("HH2026-003", 42), day: 5, water: 30 };
    const late: PlacardCultureState = { ...dry, day: 6, water: 58 };
    const drying: PlacardCultureState = { ...dry, day: PLACARD_DRYING_DAY };

    const irrigation = assessPlacardAction(dry, "measured-irrigation");
    expect(irrigation.level).toBe("recommended");
    expect(irrigation.advantage).toContain("réserve hydrique");
    expect(irrigation.drawback.length).toBeGreaterThan(20);
    expect(assessPlacardAction(late, "canopy-training").level).toBe("poor-window");
    expect(assessPlacardAction(drying, "space-flowers").level).toBe("recommended");
  });

  it("summarizes the simulation into three mainstream-friendly states", () => {
    const thirsty: PlacardCultureState = { ...startPlacardCulture("HH2026-003", 42), water: 28 };
    const status = getPlacardQuickStatus(thirsty);

    expect(status).toHaveLength(3);
    expect(status[0]).toMatchObject({ code: "water", value: "A soif", tone: "alert" });
  });

  it("unlocks history-based combos with a capped harvest bonus", () => {
    const base = startPlacardCulture("HH2026-003", 42, "eco");
    const state = {
      ...base,
      health: 90,
      stress: 10,
      history: [
        { day: 1, action: "inspect-canopy" as const, summary: "" },
        { day: 2, action: "measured-irrigation" as const, summary: "" },
        { day: 3, action: "renew-air" as const, summary: "" },
        { day: 4, action: "adjust-light" as const, summary: "" },
        { day: 5, action: "inspect-canopy" as const, summary: "" },
        { day: 6, action: "climate-control" as const, summary: "" },
      ],
    };

    expect(getPlacardCombos(state)).toHaveLength(4);
    expect(scorePlacardHarvest(state).comboBonus).toBe(6);
  });
});
