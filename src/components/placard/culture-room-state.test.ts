import { afterEach, describe, expect, it, vi } from "vitest";
import { performKqBasicCare } from "@/lib/kanab-quest-care";
import { getKqRoomCare } from "@/lib/kanab-quest-care-presentation";
import { advanceKqStage, getKqRunProjection, playKqCard, resolveKqStage, rollKqDice, startKqGame, type KqGameState } from "@/lib/kanab-quest-game";
import { createKqFlower } from "@/lib/kanab-quest-battle";
import { encodeKqSave, parseKqGameSave } from "@/lib/kanab-quest-persistence";
import { createKqWarehouseStarter, KQ_WAREHOUSE_UNLIT_CODE } from "@/lib/kanab-quest-warehouse";
import { getCultureRoomAction, getCultureRoomZones, getWarehouseRoomZones } from "./culture-room-state";

afterEach(() => vi.useRealTimers());

describe("presentation of accepted cultivation actions", () => {
  it("shows a standalone support without rendering placeholder lighting or ventilation", () => {
    const plan = createKqWarehouseStarter();
    const bareSupport = { ...plan.zones[0], active: false, lightingCode: KQ_WAREHOUSE_UNLIT_CODE, optionCodes: ["SIM-SUBSTRATE-01"] };
    const [presentation] = getWarehouseRoomZones({ ...plan, zones: [bareSupport] }, []);
    expect(presentation).toMatchObject({
      status: "paused", supportCode: "SIM-SUBSTRATE-01", lightingCode: undefined, airCode: undefined,
    });
  });
  it("keeps aggregate stock at warehouse level when a lot has no recorded shelf", () => {
    const plan = createKqWarehouseStarter();
    const shelf = plan.serviceZones!.find(zone => zone.kind === "storage")!;
    plan.serviceZones!.push({ ...shelf, id: "second-shelf", x: 7, y: 4 });
    const states = (stock?: number) => getWarehouseRoomZones(plan, [], null, stock).filter(zone => zone.kind === "storage");
    expect(states(880.2).map(zone => zone.contentState)).toEqual(["unknown", "unknown"]);
    expect(states(880.2)[0].contentLabel).toContain("880,2 g en stock dans l’entrepôt");
    expect(states(0).every(zone => zone.contentState === "empty")).toBe(true);
    expect(states()[0].contentLabel).not.toContain("en stock");
  });

  it("distinguishes an unobserved crop from a confirmed vacant zone and moves drying to its saved station", () => {
    const plan = createKqWarehouseStarter();
    expect(getWarehouseRoomZones(plan, undefined)[0].status).toBe("unknown");
    expect(getWarehouseRoomZones(plan, [])[0].status).toBe("idle");
    const state = startKqGame(17);
    const before = { ...state, stageIndex: 4, phase: "resolved" as const };
    const after = { ...state, stageIndex: 5 };
    expect(getCultureRoomAction(before, after)?.gesture).toBe("dry");
    const current = [{ ...getCultureRoomZones(after)[0], id: plan.zones[0].id }];
    const zones = getWarehouseRoomZones(plan, [], null, 0, current);
    expect(zones.find(zone => zone.kind === "drying")).toMatchObject({ id: "starter-drying", contentState: "occupied" });
    expect(zones.find(zone => zone.kind === "storage")).toMatchObject({ id: "starter-storage", contentState: "empty" });
  });

  it.each([2, 3] as const)("preserves the full journal, scores and saved phases of rules v%s through an absence", rulesVersion => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T08:00:00Z"));
    const initial = startKqGame(91, { rulesVersion, startingXp: 10, firstCultureRescue: true, deckCodes: ["BOTTE-017"] });
    let reference = structuredClone(initial);
    let shown = structuredClone(initial);
    const stages = new Set<number>();
    let rolledCount = 0;
    function compare(action: (state: KqGameState) => KqGameState) {
      reference = action(reference);
      const previous = shown;
      shown = action(shown);
      const save = encodeKqSave(shown);
      // The view may be opened, interrupted and inspected repeatedly.
      for (let i = 0; i < 3; i++) {
        getCultureRoomZones(shown);
        getCultureRoomAction(previous, shown);
      }
      expect(encodeKqSave(shown)).toEqual(save);
      expect(shown).toEqual(reference);
      return getCultureRoomAction(previous, shown);
    }
    expect(compare(state => playKqCard(state, "BOTTE-017"))?.gesture).toBe("card");
    if (rulesVersion === 3) expect(compare(performKqBasicCare)?.gesture).toBe("sweep");
    while (shown.phase !== "complete" && rolledCount < 6) {
      expect(getCultureRoomZones(shown)[0].stageIndex).toBe(shown.stageIndex);
      stages.add(shown.stageIndex);
      expect(compare(rollKqDice)?.gesture).toBe("dice");
      rolledCount++;
      const resumed = parseKqGameSave(encodeKqSave(shown));
      expect(resumed).toEqual(reference);
      vi.advanceTimersByTime(36 * 60 * 60 * 1000);
      shown = resumed!;
      expect(getCultureRoomAction(reference, shown)).toBeNull();
      compare(resolveKqStage);
      compare(advanceKqStage);
    }
    expect([...stages]).toEqual([0, 1, 2, 3, 4, 5]);
    expect(shown.phase).toBe("complete");
    expect(getCultureRoomZones(shown)[0].status).toBe("complete");
    expect(getKqRunProjection(shown)).toEqual(getKqRunProjection(reference));
    expect(createKqFlower(shown)).toEqual(createKqFlower(reference));
  });

  it("keeps an observation or a different run from performing an intervention", () => {
    const state = startKqGame(44);
    const dead = { ...state, phase: "complete" as const, cultureDead: true };
    expect(getCultureRoomZones(dead)[0].status).toBe("dead");
    expect(getCultureRoomAction(state, dead)).toBeNull();
    expect(getCultureRoomAction(state, rollKqDice(startKqGame(45)))).toBeNull();
  });

  it.each([
    ["CARE-COMPOST-TEA", "pour"], ["CARE-SEAWEED", "pour"], ["CARE-ORGANIC-FEED", "pour"],
    ["CARE-VERMICOMPOST", "spread"], ["CARE-CHRYSOPERLA", "pbi"],
  ])("preserves the selected square and uses the appropriate tool for %s", (productCode, gesture) => {
    const before = startKqGame(44, { rulesVersion: 3 });
    const target = { zoneId: "culture-2", x: 2, y: 1 };
    const care = before.care!;
    const after = { ...before, care: { ...care, applications: [{ productCode, stageIndex: 0, target }] } };
    expect(getCultureRoomAction(before, after)).toMatchObject({ gesture, target, label: expect.stringContaining("case 3, 2") });
    expect(getCultureRoomAction(after, structuredClone(after))).toBeNull();
  });
  it("restores active soil inputs and protective packets on their own squares", () => {
    const initial = startKqGame(44, { rulesVersion: 3 }).care!;
    const input = { zoneId: "bed", x: 2, y: 0 }, packet = { ...input, x: 0 };
    const receipt = { stageIndex: 1, status: "active" as const, remainingSteps: 1 };
    const care = { ...initial, interventions: [
      { ...receipt, productCode: "CARE-VERMICOMPOST", target: input },
      { ...receipt, productCode: "CARE-CHRYSOPERLA", target: packet },
      { ...receipt, productCode: "CARE-COMPOST-TEA" },
    ] };
    expect(getKqRoomCare(1, care, "bed")).toMatchObject({ inputSectors: [input], protectedSectors: [packet] });
    expect(getKqRoomCare(1, care, "other").inputSectors).toBeUndefined();
    expect(getKqRoomCare(5, care, "bed").protectedSectors).toBeUndefined();
  });
});
