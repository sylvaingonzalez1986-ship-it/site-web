import { describe, expect, it } from "vitest";
import { getKqPlacardNextAction, getKqPlacardResume, type KqPlacardResumeStorage } from "@/lib/kanab-quest-hub";
import type { KqPlayerWorkAvailability } from "./kanab-quest-player-work";

describe("Kanab Quest hub next action", () => {
  it("explains required trim before jury access without requiring employees", () => {
    const pending = { activeRun: false, readyLotCount: 0, availableFlowerCount: 2, curingFlowerCount: 1, trimFlowerCount: 1, equipmentGoalAffordable: false };
    expect(getKqPlacardNextAction(pending)).toMatchObject({ destination: "workshop", title: "1 lot à trimmer", buttonLabel: "Faire le trim", href: "/arene/placard?view=workshop&section=processing&workshop=trim" });
    expect(getKqPlacardNextAction(pending).description).toContain("toi-même");
    expect(getKqPlacardNextAction({ ...pending, trimFlowerCount: 0 }).destination).toBe("arena");
    expect(getKqPlacardNextAction({ ...pending, activeRun: true }).destination).toBe("game");
  });
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

const allowance = (remainingHours: number): KqPlayerWorkAvailability => ({ status: "ready", serverNow: "2026-11-07T12:00:00Z",
  workday: { day: 1, usedHours: 12 - remainingHours, remainingHours, dailyHours: 12, nextDayAt: "2026-11-07T16:00:00Z" } });

describe("Quartier shared working hours", () => {
  it("keeps a new culture available at 12 h", () => {
    expect(getKqPlacardResume(idle, storage(), undefined, allowance(12))).toMatchObject({ kind: "new-culture", tone: "ready", workNotice: null });
  });
  it.each([idle, { ...idle, activeRun: true }, { ...idle, trimFlowerCount: 1 }, { ...idle, readyLotCount: 1 }])("offers free planning when all hours are used or reserved: %o", snapshot => {
    const result = getKqPlacardResume(snapshot, storage(), undefined, allowance(0));
    expect(result).toMatchObject({ kind: "workday", tone: "waiting", primary: { destination: "staff", buttonLabel: "Voir mon planning" } });
    expect(result.workNotice).toContain("0 h disponible");
    expect(result.workNotice).toContain("17:00");
    expect(result.workNotice).toContain("réservées");
  });
  it("allows free preparation at half an hour while explaining the launch cost", () => {
    const result = getKqPlacardResume(idle, storage(), undefined, allowance(0.5));
    expect(result).toMatchObject({ kind: "new-culture", tone: "waiting", primary: { destination: "game", buttonLabel: "Préparer la culture" } });
    expect(result.primary!.description).toContain("1 h");
    expect(result.workNotice).toContain("0,5 h");
  });
  it.each([{ ...idle, activeRun: true }, { ...idle, readyLotCount: 1 }, { ...idle, trimFlowerCount: 1 }])("retains half-hour activities: %o", snapshot => {
    expect(getKqPlacardResume(snapshot, storage(), undefined, allowance(0.5)).tone).toBe("ready");
  });
  it("keeps the jury accessible and overflow urgent at zero hours", () => {
    expect(getKqPlacardResume({ ...idle, availableFlowerCount: 1 }, storage(), undefined, allowance(0)).kind).toBe("jury");
    expect(getKqPlacardResume(idle, storage(stored(500)), undefined, allowance(0))).toMatchObject({ kind: "storage", tone: "attention", workNotice: expect.stringContaining("0 h disponible") });
  });
  it.each(["loading", "unavailable"] as const)("does not turn %s hours into zero or promise a launch", status => {
    const result = getKqPlacardResume(idle, storage(), undefined, { status });
    expect(result).toMatchObject({ kind: "new-culture", tone: "unknown", primary: { title: "Prépare ta prochaine culture" } });
    expect(result.workNotice).not.toContain("0 h");
  });
  it("waits for renewed server evidence rather than resetting from a local date", () => {
    const previous = allowance(0);
    if (previous.status !== "ready") throw new Error("fixture");
    previous.serverNow = previous.workday.nextDayAt;
    expect(getKqPlacardResume(idle, storage(), undefined, previous).tone).toBe("unknown");
    expect(getKqPlacardResume(idle, storage(), undefined, allowance(12)).tone).toBe("ready");
  });
});

describe("Quartier resume priorities", () => {
  it("offers trim as the next action and keeps it accessible alongside an active culture", () => {
    const pending = { ...idle, trimFlowerCount: 2, availableFlowerCount: 1, curingFlowerCount: 1 };
    expect(getKqPlacardResume(pending, storage(stored()))).toMatchObject({ kind: "trim", tone: "ready", primary: { destination: "workshop", href: "/arene/placard?view=workshop&section=processing&workshop=trim" } });
    const active = getKqPlacardResume({ ...pending, activeRun: true }, storage(stored()));
    expect(active.kind).toBe("culture");
    expect(active.factActions[0]).toMatchObject({ id: "trim-required", href: "/arene/placard?view=workshop&section=processing&workshop=trim", destination: "workshop" });
    expect(active.facts[0]).toBe("2 lots à trimmer avant le jury.");
  });
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
