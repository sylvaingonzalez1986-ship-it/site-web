import { describe, expect, it } from "vitest";
import {
  emptyFarmProgress,
  FARM_GUIDE_STEPS,
  farmStepAdvice,
  farmStepChapter,
  followFarmHarvest,
  getFarmStep,
  getFarmStepState,
  isFarmProgressComplete,
  observeFarmProgress,
  parseFarmProgress,
  pauseFarmProgress,
  replayFarmStep,
  resumeFarmProgress,
  selectFarmStep,
  type FarmEvidence,
  type FarmProgress,
  type FarmStepId,
} from "./kanab-quest-farm-progress";

const started = (overrides: Partial<FarmProgress> = {}): FarmProgress => ({
  ...emptyFarmProgress(), active: true, started: true, ...overrides,
});
const cultureSteps: FarmStepId[] = ["launch", "roll", "resolve", "harvest"];
const actionSteps: FarmStepId[] = ["zone", "assign", ...cultureSteps, "store", "trim", "cure", "jury", "sale", "pack-open", "card-play", "school-answer"];
const staffSteps = ["staff-candidate", "staff-planning", "staff-development", "staff-payroll"] as const;

describe("trim before the jury", () => {
  const waiting = () => started({ flowerId: "flower-1", completed: FARM_GUIDE_STEPS.slice(0, FARM_GUIDE_STEPS.findIndex(step => step.id === "trim")).map(step => step.id) });

  it("opens the workshop with the same lot before waiting for curing", () => {
    const step = getFarmStep(waiting())!;
    expect(step.id).toBe("trim");
    expect(farmStepChapter(step)).toMatchObject({ view: "workshop", section: "processing" });
    expect(getFarmStep(observeFarmProgress(waiting(), { trim: { id: "flower-1", state: "complete" } }))?.id).toBe("cure");
  });
  it.each(["required", "queued", "running"] as const)("keeps %s trim pending even if curing is done", state => {
    const progress = observeFarmProgress(waiting(), { trim: { id: "flower-1", state }, lots: [{ id: "flower-1", protected: true, ready: true }] });
    expect(getFarmStep(progress)?.id).toBe("trim");
    expect(progress.completed).not.toContain("jury");
  });
  it("requires proof for this lot and a successful read", () => {
    const progress = waiting();
    expect(observeFarmProgress(progress, { trim: { id: "flower-2", state: "complete" } })).toBe(progress);
    expect(observeFarmProgress(progress, { error: true, trim: { id: "flower-1", state: "not-required" } })).toBe(progress);
    expect(observeFarmProgress(progress, {})).toBe(progress);
  });
  it("accepts the server's absence of unfinished trim for a legacy or older completed lot", () => {
    const progress = observeFarmProgress(waiting(), { trim: { id: "flower-1", state: "not-required" } });
    expect(progress.completed).toContain("trim");
    expect(progress.completed).not.toContain("cure");
  });
  it("does not impose retroactive trim on a closed guide already past the jury", () => {
    const saved = waiting();
    saved.active = false; saved.collapsed = true; saved.completed.push("cure", "jury", "sale");
    const restored = parseFarmProgress(JSON.stringify(saved))!;
    expect(restored).toMatchObject({ active: false, collapsed: true, flowerId: "flower-1" });
    expect(restored.completed).toEqual(expect.arrayContaining([...saved.completed, "trim"]));
  });
  it("persists a partial trim without credit and keeps acquired learning when following another lot", () => {
    const progress = observeFarmProgress(waiting(), { trim: { id: "flower-1", state: "running" } });
    expect(getFarmStep(parseFarmProgress(JSON.stringify(progress))!)?.id).toBe("trim");
    const complete = observeFarmProgress(progress, { trim: { id: "flower-1", state: "complete" } });
    expect(followFarmHarvest(complete, "flower-2").completed).toContain("trim");
  });
});

describe("discovering the team", () => {
  it("resumes an old completed guide at Personnel without reopening it or losing its harvest", () => {
    const previous = started({ active: false, collapsed: true, flowerId: "flower-1", completed: FARM_GUIDE_STEPS.filter(step => !staffSteps.some(id => id === step.id)).map(step => step.id) });
    const resumed = parseFarmProgress(JSON.stringify(previous))!;
    expect(resumed).toEqual(previous);
    expect(getFarmStep(resumed)?.id).toBe("staff-candidate");
    for (const id of staffSteps) expect(resumed.completed).not.toContain(id);
  });

  it("allows the four discoveries without hiring, assigning work or paying", () => {
    let progress = started({ completed: FARM_GUIDE_STEPS.filter(step => !staffSteps.some(id => id === step.id)).map(step => step.id) });
    for (const id of staffSteps) {
      expect(getFarmStep(progress)?.id).toBe(id);
      progress = observeFarmProgress(progress, { visits: [id] });
    }
    expect(getFarmStep(progress)).toBeUndefined();
    expect(progress.flowerId).toBeUndefined();
  });

  it("keeps Personnel discoveries pending while the screen reports an error", () => {
    const progress = started();
    expect(observeFarmProgress(progress, { error: true, visits: [...staffSteps] })).toBe(progress);
  });

  it("returns to the visible handbook after navigating the staff carousel", () => {
    for (const id of ["staff-planning", "staff-development", "staff-week"]) {
      const step = FARM_GUIDE_STEPS.find(item => item.id === id)!;
      expect(farmStepAdvice(step, { staffTab: "candidates" }, "staff").target).toBe("[data-staff-tab=overview]");
      expect(farmStepAdvice(step, { staffTab: "overview" }, "staff").target).toBe(step.target);
    }
  });

  it("points from Recruter to a real candidate before the planning lesson", () => {
    const step = FARM_GUIDE_STEPS.find(item => item.id === "staff-candidate")!;
    expect(farmStepChapter(step).view).toBe("staff");
    expect(farmStepAdvice(step, { staffTab: "team" }, "staff").target).toBe("[data-staff-tab=candidates]");
    expect(farmStepAdvice(step, { staffTab: "candidates" }, "staff").target).toContain("[data-staff-profile]");
    expect(farmStepAdvice(step, { staffTab: "candidates", error: true }, "staff").target).toBe("[role=alert]");
  });
});

describe("farm progress persistence", () => {
  it("starts closed without prior actions or a tracked harvest", () => {
    expect(parseFarmProgress(null)).toEqual({
      version: 2, active: false, started: false, collapsed: false, completed: [],
    });
  });

  it.each([false, true])("migrates v1 reading without completing any action (active=%s)", active => {
    expect(parseFarmProgress(JSON.stringify({ version: 1, active, read: ["arrival", "culture", "sale"] }))).toEqual({
      version: 2, active, started: true, collapsed: true, completed: [],
    });
  });

  it("keeps an unused v1 guide unstarted", () => {
    expect(parseFarmProgress('{"version":1,"active":false,"read":[]}')).toEqual(emptyFarmProgress());
  });

  it.each([
    "broken", "null", "[]",
    '{"version":3,"active":true,"started":true,"collapsed":false,"completed":[]}',
    '{"version":1,"active":true,"read":["unknown"]}',
    JSON.stringify({ ...started(), active: "yes" }),
    JSON.stringify({ ...started(), collapsed: undefined }),
    JSON.stringify({ ...started(), completed: ["unknown"] }),
    JSON.stringify({ ...started(), flowerId: "flower/another-account" }),
    JSON.stringify({ ...started(), flowerId: "" }),
  ])("rejects an unreadable/future save without replacing it: %s", raw => {
    // null is the caller's signal to retain the original stored value.
    expect(parseFarmProgress(raw)).toBeNull();
  });

  it.each([
    { active: true, collapsed: true },
    { active: false, collapsed: true },
    { active: false, collapsed: false },
  ])("persists the display preference %j independently of completed actions", preference => {
    const progress = started({ ...preference, completed: ["welcome", "harvest"], flowerId: "flower-1" });
    expect(parseFarmProgress(JSON.stringify(progress))).toEqual(progress);
  });

  it("deduplicates persisted completions without discarding the tracked lot", () => {
    const restored = parseFarmProgress(JSON.stringify(started({ completed: ["welcome", "welcome", "harvest"], flowerId: "flower-1" })));
    expect(restored?.completed).toEqual(["welcome", "harvest"]);
    expect(restored?.flowerId).toBe("flower-1");
  });
});

describe("evidence-driven objectives", () => {
  it("ignores all observations until the player starts the guide", () => {
    const progress = emptyFarmProgress();
    expect(observeFarmProgress(progress, {
      visits: ["welcome", "accounts"], savedZones: 1, assignedZones: 1,
      cultureStarted: true, rolled: true, turnResolved: true, harvestId: "flower-1",
      lots: [{ id: "flower-1", protected: true, ready: true }], juryIds: ["flower-1"], saleId: "flower-1",
    })).toBe(progress);
  });

  it("records actual actions while the started guide is closed or minimized", () => {
    const progress = started({ active: false, collapsed: true });
    const observed = observeFarmProgress(progress, { harvestId: "flower-1" });
    expect(observed).toMatchObject({ active: false, collapsed: true, started: true, flowerId: "flower-1" });
    expect(observed.completed).toEqual(cultureSteps);
    expect(parseFarmProgress(JSON.stringify(observed))).toEqual(observed);
  });

  it("does not turn unknown data or an unsaved plan into confirmed zones", () => {
    const progress = started();
    expect(observeFarmProgress(progress, {})).toBe(progress);
    expect(observeFarmProgress(progress, { savedZones: 0, assignedZones: 0 })).toBe(progress);
  });

  it.each([NaN, Infinity, -Infinity, -1, 0, 0.5])("rejects invalid or empty zone counts: %s", count => {
    expect(observeFarmProgress(started(), { savedZones: count, assignedZones: count }).completed).toEqual([]);
  });

  it("recognizes saved zones and assignments separately", () => {
    const zones = observeFarmProgress(started(), { savedZones: 2 });
    expect(zones.completed).toEqual(["zone"]);
    expect(observeFarmProgress(zones, { assignedZones: 1 }).completed).toEqual(["zone", "assign"]);
  });

  it("never takes a rolled or resolved initial state as proof that a culture was launched", () => {
    const progress = started();
    expect(observeFarmProgress(progress, { rolled: true, turnResolved: true })).toBe(progress);
    expect(observeFarmProgress(progress, { cultureStarted: false, rolled: true, turnResolved: true })).toBe(progress);
  });

  it("distinguishes confirmed launch, rolled dice and a resolved turn", () => {
    const launched = observeFarmProgress(started(), { cultureStarted: true });
    expect(launched.completed).toEqual(["launch"]);
    const rolled = observeFarmProgress(launched, { cultureStarted: true, rolled: true });
    expect(rolled.completed).toEqual(["launch", "roll"]);
    const resolved = observeFarmProgress(rolled, { cultureStarted: true, turnResolved: true });
    expect(resolved.completed).toEqual(["launch", "roll", "resolve"]);
    expect(resolved.completed).not.toContain("harvest");
  });

  it("keeps failures from being treated as a harvest or a completed transaction", () => {
    const progress = started({ completed: ["launch", "roll", "resolve"] });
    expect(observeFarmProgress(progress, {})).toBe(progress);
    expect(observeFarmProgress(progress, {
      error: true, harvestId: "flower-1", lots: [{ id: "flower-1", protected: true, ready: true }],
      juryIds: ["flower-1"], saleId: "flower-1",
    })).toBe(progress);
    expect(progress.completed).not.toContain("harvest");
  });

  it("credits the earlier culture actions when an actual harvest is confirmed", () => {
    const progress = observeFarmProgress(started(), { harvestId: "flower-1" });
    expect(progress.completed).toEqual(cultureSteps);
    expect(progress.flowerId).toBe("flower-1");
    expect(progress.completed).not.toContain("store");
    expect(progress.completed).not.toContain("jury");
  });

  it.each(["", "flower/1", "a".repeat(129)])("does not accept an invalid harvest identifier: %s", harvestId => {
    const progress = started();
    expect(observeFarmProgress(progress, { harvestId })).toBe(progress);
  });

  it("allows visits to complete discovery objectives without invoking any action", () => {
    expect(observeFarmProgress(started(), { visits: ["welcome", "buddies", "accounts", "bank"] }).completed)
      .toEqual(["welcome", "buddies", "accounts", "bank"]);
  });

  it("does not expose a visit-based shortcut for action objectives", () => {
    // Runtime filtering matters as well as the public TypeScript input type.
    const evidence = { visits: actionSteps } as FarmEvidence;
    expect(observeFarmProgress(started(), evidence).completed).toEqual([]);
  });

  it("requires the explicit successful pack/card/answer receipt and keeps errors pending", () => {
    const evidence: FarmEvidence = { openedPack: true, cardPlayed: true, schoolAnswered: true };
    const progress = started();
    expect(observeFarmProgress(progress, { ...evidence, error: true })).toBe(progress);
    expect(observeFarmProgress(progress, { openedPack: false, cardPlayed: false, schoolAnswered: false })).toBe(progress);
    expect(observeFarmProgress(progress, evidence).completed).toEqual(expect.arrayContaining(["pack-open", "card-play", "school-answer"]));
  });

  it("does not mutate saved progress and is stable on repeated observations", () => {
    const progress = started({ completed: ["welcome"] });
    Object.freeze(progress.completed);
    Object.freeze(progress);
    const observed = observeFarmProgress(progress, { harvestId: "flower-1" });
    expect(progress.completed).toEqual(["welcome"]);
    expect(observeFarmProgress(observed, { harvestId: "flower-1" })).toBe(observed);
  });
});

describe("continuity of the harvested lot", () => {
  it("requires storage, curing, jury and sale evidence for the tracked harvest", () => {
    const harvest = observeFarmProgress(started(), { harvestId: "flower-1" });
    expect(observeFarmProgress(harvest, {
      lots: [{ id: "flower-2", protected: true, ready: true }], juryIds: ["flower-2"], saleId: "flower-2",
    })).toBe(harvest);
    const stored = observeFarmProgress(harvest, { lots: [{ id: "flower-1", protected: true, ready: false }] });
    expect(stored.completed).toContain("store");
    expect(stored.completed).not.toContain("cure");
    const ready = observeFarmProgress(stored, { lots: [{ id: "flower-1", protected: true, ready: true }] });
    expect(ready.completed).toContain("cure");
    expect(ready.completed).not.toContain("jury");
    const judged = observeFarmProgress(ready, { juryIds: ["flower-1"] });
    expect(judged.completed).toContain("jury");
    expect(judged.completed).not.toContain("sale");
    expect(observeFarmProgress(judged, { saleId: "flower-1" }).completed).toContain("sale");
  });

  it("does not change the tracked harvest when another culture is harvested", () => {
    const first = observeFarmProgress(started(), { harvestId: "flower-1" });
    expect(observeFarmProgress(first, { harvestId: "flower-2" })).toBe(first);
  });

  it("can resume a real storage lot without fabricating its earlier dice actions", () => {
    const progress = observeFarmProgress(started(), { lots: [{ id: "flower-1", protected: false, ready: true }] });
    expect(progress.flowerId).toBe("flower-1");
    expect(progress.completed).toEqual(["harvest", "cure"]);
    expect(progress.completed).not.toContain("store");
    expect(progress.completed).not.toContain("launch");
    expect(progress.completed).not.toContain("resolve");
  });

  it("does not create a tracked harvest from a jury verdict or sale alone", () => {
    const progress = started();
    expect(observeFarmProgress(progress, { juryIds: ["flower-1"], saleId: "flower-1" })).toBe(progress);
  });
});

describe("next objective and recovery advice", () => {
  it("can follow another real harvest without erasing the earlier learning goals", () => {
    const progress = started({ flowerId: "old-flower", completed: ["welcome", "launch", "harvest", "store", "cure", "jury", "sale"] });
    const next = followFarmHarvest(progress, "new-flower");
    expect(next.flowerId).toBe("new-flower");
    expect(next.completed).toEqual(progress.completed);
    expect(followFarmHarvest(progress, "old-flower")).toBe(progress);
    expect(followFarmHarvest(progress, 'invalid"id')).toBe(progress);
  });
  it("finds the first unfinished objective and resolves every destination", () => {
    const progress = started({ completed: ["welcome", "zone", "cards"] });
    expect(getFarmStep(progress)?.id).toBe("work-hours");
    for (const step of FARM_GUIDE_STEPS) expect(farmStepChapter(step).id).toBe(step.chapter);
    expect(getFarmStep(started({ completed: FARM_GUIDE_STEPS.map(step => step.id) }))).toBeUndefined();
  });

  it("puts game errors and a failed culture before an apparent harvest", () => {
    const harvest = FARM_GUIDE_STEPS.find(step => step.id === "harvest")!;
    expect(farmStepAdvice(harvest, { error: true, cultureDead: true, harvested: true }, "culture").target).toBe("[role=alert]");
    expect(farmStepAdvice(harvest, { cultureDead: true, harvested: true }, "culture").target)
      .toBe("[data-culture-recovery], [data-culture-rescue]");
    expect(farmStepAdvice(harvest, { harvested: true }, "culture").line).toContain("confirmation");
  });
});

describe("independent modules and replays", () => {
  it("lets the player select a module without validating or spending anything", () => {
    const initial = started({ completed: ["welcome"] });
    const selected = selectFarmStep(initial, "bank");
    expect(selected.completed).toBe(initial.completed);
    expect(getFarmStep(selected)?.id).toBe("bank");
    expect(parseFarmProgress(JSON.stringify(selected))).toEqual(selected);
    const locked = selectFarmStep(selected, "sale");
    expect(getFarmStep(locked)?.id).toBe("sale");
    expect(getFarmStepState(locked, "sale")).toMatchObject({ status: "locked", prerequisites: ["jury"] });
  });

  it("offers independent discoveries while culture prerequisites are incomplete", () => {
    const progress = started({ completed: ["welcome", "zone", "buddies", "cards", "packs"] });
    expect(getFarmStepState(progress, "launch")).toMatchObject({ status: "locked", prerequisites: ["assign"] });
    expect(getFarmStepState(progress, "bank")).toMatchObject({ status: "available", prerequisites: [] });
    expect(getFarmStepState(progress, "school-learn")).toMatchObject({ status: "available", prerequisites: [] });
  });

  it("continues the selected chapter after a confirmed action before returning to other goals", () => {
    const selected = selectFarmStep(started({ completed: ["launch"] }), "roll");
    const rolled = observeFarmProgress(selected, { cultureStarted: true, rolled: true });
    expect(getFarmStep(rolled)?.id).toBe("resolve");
    const resolved = observeFarmProgress(rolled, { cultureStarted: true, turnResolved: true });
    expect(getFarmStep(resolved)?.id).toBe("harvest");
    const chapterComplete = { ...resolved, completed: FARM_GUIDE_STEPS.filter(step => step.chapter === "culture").map(step => step.id) };
    expect(getFarmStep(chapterComplete)?.id).toBe("welcome");
  });

  it("keeps a completed action as a reading replay without erasing acquisitions", () => {
    const progress = started({ completed: FARM_GUIDE_STEPS.map(step => step.id), flowerId: "flower-1" });
    const replay = replayFarmStep(progress, "sale");
    expect(isFarmProgressComplete(replay)).toBe(true);
    expect(getFarmStep(replay)?.id).toBe("sale");
    expect(getFarmStepState(replay, "sale").status).toBe("completed");
    expect(replay.completed).toBe(progress.completed);
    const paused = pauseFarmProgress(replay);
    expect(parseFarmProgress(JSON.stringify(paused))).toEqual(paused);
    expect(resumeFarmProgress(paused).replayStepId).toBeUndefined();
    expect(resumeFarmProgress(paused).completed).toBe(progress.completed);
  });

  it("never marks an unfinished action completed just because its replay was requested", () => {
    const replay = replayFarmStep(started(), "sale");
    expect(replay.completed).toEqual([]);
    expect(observeFarmProgress(replay, {})).toBe(replay);
    expect(getFarmStepState(replay, "sale").status).toBe("locked");
  });

  it("distinguishes waiting for server confirmation from unlocked action and missing prerequisites", () => {
    const progress = started({ flowerId: "flower-1", completed: ["harvest"] });
    expect(getFarmStepState(progress, "trim", { trim: { id: "flower-1", state: "running" } }).status).toBe("waiting");
    expect(getFarmStepState(progress, "trim", { trim: { id: "other", state: "running" } }).status).toBe("available");
    expect(getFarmStepState(progress, "cure", { lots: [{ id: "flower-1", protected: true, ready: false }] }).status).toBe("waiting");
    expect(getFarmStepState(progress, "cure", { error: true }).status).toBe("waiting");
    expect(getFarmStepState(progress, "harvest", { error: true }).status).toBe("completed");
    expect(getFarmStepState(progress, "jury").status).toBe("locked");
  });

  it("rejects invalid selected/replay identifiers in saved data", () => {
    expect(parseFarmProgress(JSON.stringify(started({ selectedStepId: "unknown" as FarmStepId })))).toBeNull();
    expect(parseFarmProgress(JSON.stringify(started({ replayStepId: "unknown" as FarmStepId })))).toBeNull();
  });

  it("names the exact missing goals and prioritizes a confirmed unavailable state", () => {
    const progress = started();
    expect(getFarmStepState(progress, "jury").reason).toContain("Préparer les fleurs à l’Atelier");
    expect(getFarmStepState(progress, "jury").reason).toContain("Laisser finir l’affinage");
    expect(getFarmStepState(progress, "jury", { unavailable: { jury: "Ce lot attend son adversaire." } }))
      .toEqual({ status: "waiting", prerequisites: [], reason: "Ce lot attend son adversaire." });
    expect(getFarmStepState(progress, "jury", { error: true }).status).toBe("waiting");
    const completed = started({ completed: ["pack-open"] });
    expect(getFarmStepState(completed, "pack-open", { unavailable: { "pack-open": "Aucun pack disponible." } }).status).toBe("completed");
    expect(observeFarmProgress(progress, { unavailable: { "pack-open": "Aucun pack disponible." } })).toBe(progress);
  });
});
