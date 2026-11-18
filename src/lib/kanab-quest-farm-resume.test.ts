import { describe, expect, it, vi } from "vitest";
import { emptyFarmProgress, observeFarmProgress } from "./kanab-quest-farm-progress";
import { collectFarmResumeEvidence, readFarmResumeEvidence } from "./kanab-quest-farm-resume";

const noRuns = () => ({ activeRun: null, activeRuns: [] });
const noFlowers = () => ({ flowers: [] });
const run = (phase = "prepare", history: unknown[] = []) => ({ runId: "run-1", zoneId: "zone-1", buddieCode: "BUDDIE-1", state: { phase, history } });
const flower = (overrides: Record<string, unknown> = {}) => ({ id: "flower-1", runId: "run-1", status: "available", ...overrides });

describe("confirmed tutorial resume evidence", () => {
  it("reconciles a running culture after closing the tutorial without replaying a command", () => {
    const evidence = readFarmResumeEvidence({ activeRuns: [run("prepare", [{ stageIndex: 0 }])] }, noFlowers());
    const progress = observeFarmProgress({ ...emptyFarmProgress(), started: true }, evidence);
    expect(progress.completed).toEqual(expect.arrayContaining(["zone", "assign", "launch", "roll", "resolve"]));
    expect(progress.completed).not.toContain("harvest");
    expect(progress.active).toBe(false);
  });

  it("resumes a past official harvest and only its confirmed protection, curing and trim", () => {
    const evidence = readFarmResumeEvidence(noRuns(), { flowers: [flower({
      storage: { stage: "ready", capacity: { totalUnits: 100, protectedUnits: 100, overflowUnits: 0 } },
      trim: { status: "ready", totalGrams: 10, completedGrams: 10 },
    })] });
    const progress = observeFarmProgress({ ...emptyFarmProgress(), started: true }, evidence);
    expect(progress.flowerId).toBe("flower-1");
    expect(progress.completed).toEqual(["launch", "roll", "resolve", "harvest", "store", "trim", "cure"]);
    expect(progress.completed).not.toContain("jury");
    expect(progress.completed).not.toContain("sale");
  });

  it.each([undefined, { stage: "ready" }, { stage: "ready", capacity: { totalUnits: 100, overflowUnits: 0 } }])("does not treat unknown protection as a protected lot (%j)", storage => {
    const evidence = readFarmResumeEvidence(noRuns(), { flowers: [flower({ storage })] });
    expect(evidence.lots?.some(lot => lot.protected)).not.toBe(true);
    expect(evidence.trims).toBeUndefined();
  });

  it.each(["queued", "locked", "burned"])("does not equate a %s flower with a jury verdict or sale", status => {
    const evidence = readFarmResumeEvidence(noRuns(), { flowers: [flower({ status })] });
    expect(evidence.juryIds).toBeUndefined();
    expect(evidence.saleId).toBeUndefined();
  });

  it("keeps the followed lot while recognizing earlier server achievements", () => {
    const progress = { ...emptyFarmProgress(), started: true, flowerId: "followed-1" };
    const observed = observeFarmProgress(progress, readFarmResumeEvidence(noRuns(), { flowers: [flower({ storage: { stage: "ready" }, trim: { status: "ready", totalGrams: null, completedGrams: null } })] }));
    expect(observed.flowerId).toBe("followed-1");
    expect(observed.completed).toEqual(["launch", "roll", "resolve", "harvest"]);
  });

  it.each([
    [{ error: "offline" }, noFlowers()],
    [noRuns(), {}],
    [{ activeRuns: [run("unknown")] }, noFlowers()],
    [noRuns(), { flowers: [flower({ runId: "bad/id" })] }],
  ])("rejects malformed successful responses before crediting anything", (runs, flowers) => {
    expect(() => readFarmResumeEvidence(runs, flowers)).toThrow("vérifiée");
  });

  it("uses only two fresh GETs and forwards cancellation", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(noRuns())).mockResolvedValueOnce(Response.json(noFlowers()));
    const signal = new AbortController().signal;
    expect(await collectFarmResumeEvidence(request, signal)).toEqual({});
    expect(request.mock.calls).toEqual([
      ["/api/arena/placard/runs", { method: "GET", cache: "no-store", signal }],
      ["/api/arena/placard/flowers", { method: "GET", cache: "no-store", signal }],
    ]);
  });

  it.each(["http", "json", "network"])("does not turn a partial %s failure into success", async failure => {
    const good = Response.json({ activeRuns: [run("resolved", [{}])] });
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(good);
    if (failure === "network") request.mockRejectedValueOnce(new Error("offline"));
    else request.mockResolvedValueOnce(failure === "http" ? Response.json(noFlowers(), { status: 503 }) : new Response("broken"));
    await expect(collectFarmResumeEvidence(request)).rejects.toThrow();
  });
});
