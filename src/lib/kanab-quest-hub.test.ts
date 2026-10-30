import { describe, expect, it } from "vitest";
import { getKqPlacardNextAction, getKqPlacardResume, type KqPlacardResumeStorage } from "@/lib/kanab-quest-hub";

describe("Kanab Quest hub next action", () => {
  it("sends unready flowers to storage while preserving completed-lot and jury priorities", () => {
    const pending = { activeRun: false, readyLotCount: 0, availableFlowerCount: 0, curingFlowerCount: 2, equipmentGoalAffordable: true };
    expect(getKqPlacardNextAction(pending)).toMatchObject({ destination: "storage", buttonLabel: "Ouvrir le stockage" });
    expect(getKqPlacardNextAction(pending).description).toContain("2 lots sont en affinage");
    expect(getKqPlacardNextAction({ ...pending, curingFlowerCount: 1 }).description).toContain("1 lot est en affinage");
    expect(getKqPlacardNextAction({ ...pending, availableFlowerCount: 1 }).destination).toBe("arena");
    expect(getKqPlacardNextAction({ ...pending, readyLotCount: 1 }).destination).toBe("market");
    expect(getKqPlacardNextAction({ ...pending, activeRun: true }).destination).toBe("game");
  });
  it("prioritizes the open gameplay loop before optional spending", () => {
    expect(getKqPlacardNextAction({ activeRun: true, readyLotCount: 2, availableFlowerCount: 1, equipmentGoalAffordable: true }).destination).toBe("game");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 2, availableFlowerCount: 1, equipmentGoalAffordable: true }).destination).toBe("market");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 1, equipmentGoalAffordable: true }).destination).toBe("arena");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 0, equipmentGoalAffordable: true }).destination).toBe("game");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 0, equipmentGoalAffordable: false }).destination).toBe("game");
  });

  it("pluralizes pending lots and flowers", () => {
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 1, availableFlowerCount: 0, equipmentGoalAffordable: false }).title).toBe("1 lot à valoriser");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 3, availableFlowerCount: 0, equipmentGoalAffordable: false }).title).toBe("3 lots à valoriser");
    expect(getKqPlacardNextAction({ activeRun: false, readyLotCount: 0, availableFlowerCount: 2, equipmentGoalAffordable: false }).description).toContain("2 Fleurs sont prêtes");
  });
});

const idle = { activeRun: false, readyLotCount: 0, availableFlowerCount: 0, curingFlowerCount: 0 };
const stored = (overflowUnits = 0, readyAt = "2026-10-29T16:30:00.000Z"): KqPlacardResumeStorage["lots"][number] => ({
  flowerStatus: "available", projection: { stage: "curing", readyAt,
    capacity: { overflowUnits, overflowDeadlineAt: "2026-10-29T13:00:00.000Z" } },
});
const storage = (...lots: KqPlacardResumeStorage["lots"][number][]): KqPlacardResumeStorage => ({ serverNow: "2026-10-29T12:00:00.000Z", lots });

describe("Quartier resume priorities", () => {
  it("puts confirmed exposed stock before a playable culture or ready activities, with at most two secondary facts", () => {
    const summary = getKqPlacardResume({ ...idle, activeRun: true, readyLotCount: 3, availableFlowerCount: 2 }, storage(stored(1250), stored(500)));
    expect(summary).toMatchObject({ kind: "storage", tone: "attention", primary: { destination: "storage", title: "175 g sans contenant" } });
    expect(summary.primary!.description).toContain("équivalent fleurs");
    expect(summary.primary!.description).toContain("14:00");
    expect(summary.facts).toHaveLength(2);
    expect(summary.facts[0]).toContain("culture est sauvegardée");
    expect(summary.facts[1]).toContain("3 lots prêts à vendre");
  });

  it("keeps confirmed exposure visible when equipment data cannot be read", () => {
    const summary = getKqPlacardResume(null, storage(stored(1250)));
    expect(summary.kind).toBe("storage");
    expect(summary.facts[0]).toContain("indisponible");
  });

  it("does not announce an automatic sale when that lot explicitly disables it", () => {
    const lot = stored(100);
    lot.projection.capacity!.automaticOverflowSale = false;
    expect(getKqPlacardResume(idle, storage(lot)).primary!.description).not.toContain("vente automatique");
  });

  it("presents protected curing as automatic waiting with the earliest actual completion time", () => {
    const summary = getKqPlacardResume({ ...idle, curingFlowerCount: 2 }, storage(stored(0, "2026-10-29T18:00:00.000Z"), stored()));
    expect(summary).toMatchObject({ kind: "curing", tone: "waiting", primary: { buttonLabel: "Voir l’affinage" } });
    expect(summary.primary!.description).toContain("Ces lots sont rangés");
    expect(summary.primary!.description).toContain("Premier lot prêt le 29 octobre à 17:30");
    expect(summary.primary!.description).not.toMatch(/6 heures|Protège/);
  });

  it.each(["missing-storage", "missing-capacity", "missing-lot", "inconsistent-count", "stale-clock"] as const)("does not claim safe waiting from %s", reason => {
    const snapshot = { ...idle, curingFlowerCount: reason === "inconsistent-count" ? 0 : 1 };
    const value = reason === "missing-storage" ? null : reason === "missing-lot" ? storage() : storage(stored());
    if (reason === "missing-capacity") delete value!.lots[0].projection.capacity;
    if (reason === "stale-clock") value!.serverNow = "2026-10-29T20:00:00.000Z";
    const summary = getKqPlacardResume(snapshot, value);
    expect(summary).toMatchObject({ kind: "curing", tone: "unknown", primary: { buttonLabel: "Vérifier le stockage" } });
    if (reason === "missing-capacity") {
      expect(summary.primary!.description).toContain("Le rangement reste à vérifier");
      expect(summary.primary!.description).toContain("17:30");
    } else expect(summary.primary!.description).toContain("ne sont pas confirmés");
    expect(summary.primary!.description).not.toContain("sont rangés");
  });

  it("never promotes a flower to the jury from its local storage clock alone", () => {
    const lot = stored(); lot.projection.stage = "ready";
    const pending = { ...idle, curingFlowerCount: 1 };
    expect(getKqPlacardResume(pending, storage(lot)).kind).toBe("curing");
    expect(getKqPlacardResume({ ...pending, availableFlowerCount: 1 }, storage(lot))).toMatchObject({ kind: "jury", tone: "ready", primary: { destination: "arena" } });
  });

  it("keeps safe waiting secondary to an active culture and distinguishes unreadable storage", () => {
    const active = { ...idle, activeRun: true, curingFlowerCount: 1 };
    expect(getKqPlacardResume(active, storage(stored()))).toMatchObject({ kind: "culture", tone: "ready", facts: [expect.stringContaining("Affinage automatique")] });
    expect(getKqPlacardResume(active, null).facts[0]).toContain("n’a pas pu être vérifié");
    expect(getKqPlacardResume(null, null)).toMatchObject({ kind: "unknown", tone: "unknown", primary: null });
  });
});
