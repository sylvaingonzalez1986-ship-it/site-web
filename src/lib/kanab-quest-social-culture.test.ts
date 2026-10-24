import { describe, expect, it } from "vitest";
import { createKqSocialCultureContext, isKqSocialCultureContext, projectKqSocialCultureContext, projectKqSocialCultureLot, projectKqSocialCultureRun } from "./kanab-quest-social-culture";

const now = Date.parse("2026-10-24T12:00:00Z"), at = new Date(now).toISOString();
const run = () => ({ id: "run-a", updatedAt: at, state: {
  varietyCode: "BUD-001", varietyName: "Variété A", stageIndex: 2, phase: "prepare", seed: 7284,
  situationCodes: ["SIT-001", "SIT-002", "FUTURE-SECRET"], deckCodes: ["PRIVATE-CARD"],
  warehouse: { version: 2, zoneId: "zone-a", zones: [{ id: "zone-a", name: "Mon placard" }] },
  history: [{ stage: "Enracinement", situation: "Substrat compact", outcome: "fragile", trait: "Racines patientes" }],
  care: { problems: [{ code: "APHIDS", status: "suspected", variant: 0, appearedAt: 2 }] },
} });
const lot = () => ({ id: "flower-a", runId: "run-a", varietyCode: "BUD-001", varietyName: "Variété A",
  cultivation: "indoor", harvestedAt: at, storage: { harvestedAt: at, readyAt: new Date(now + 60_000).toISOString() }, harvestGrams: 200, remainingGrams: 12.3 });

describe("observed social culture facts", () => {
  it("distinguishes an unavailable context from a confirmed empty account", () => {
    expect(createKqSocialCultureContext(now)).toEqual({ version: 1, source: "unknown", observedAt: at, runs: [], lots: [] });
    expect(projectKqSocialCultureContext({ runs: [], lots: [] }, now, "own").source).toBe("own");
    expect(isKqSocialCultureContext({ ...createKqSocialCultureContext(now), runs: [projectKqSocialCultureRun(run())] })).toBe(false);
  });
  it("keeps only actual identity, stage and resolved history without future events or private gameplay fields", () => {
    const input = run(), before = structuredClone(input), output = projectKqSocialCultureRun(input)!;
    expect(output).toMatchObject({ id: "run-a", zoneId: "zone-a", zoneName: "Mon placard", cultivation: "indoor", stageIndex: 2,
      lastResolved: { stageIndex: 1, situation: "Substrat compact", outcome: "fragile" } });
    expect(JSON.stringify(output)).not.toMatch(/seed|situationCodes|deckCodes|FUTURE-SECRET|PRIVATE-CARD/);
    expect(input).toEqual(before);
    input.state.history = [{ stage: "Récolte", situation: "Pas encore vécue", outcome: "success", trait: "Succès futur" }];
    expect(projectKqSocialCultureRun(input)?.lastResolved).toBeUndefined();
  });
  it("shows a symptom without inventing a diagnosis, and exposes a diagnosis only after confirmation", () => {
    const input = run();
    expect(projectKqSocialCultureRun(input)?.problem).toEqual({ symptom: "De petits insectes groupés sont visibles sous le feuillage.", diagnosis: null, status: "suspected" });
    input.state.care.problems[0].status = "confirmed";
    expect(projectKqSocialCultureRun(input)?.problem?.diagnosis).toBe("Foyer de pucerons");
    input.state.care.problems[0].appearedAt = 3;
    expect(projectKqSocialCultureRun(input)?.problem).toBeUndefined();
    expect(projectKqSocialCultureRun({ ...run(), state: { ...run().state, cultureDead: true } })?.problem).toBeUndefined();
  });
  it("keeps every zone explicit and never chooses the first variety as the player's only culture", () => {
    const other = run(); other.id = "run-b"; other.state.varietyName = "Variété B"; other.state.warehouse.zoneId = "zone-b";
    other.state.warehouse.zones = [{ id: "zone-b", name: "Deuxième zone" }];
    const context = projectKqSocialCultureContext({ runs: [run(), other], lots: [] }, now, "own");
    expect(context.runs.map(item => [item.id, item.zoneName, item.varietyName])).toEqual([
      ["run-a", "Mon placard", "Variété A"], ["run-b", "Deuxième zone", "Variété B"],
    ]);
    expect(isKqSocialCultureContext(context)).toBe(true);
    expect(() => projectKqSocialCultureContext({ runs: [run(), run()], lots: [] }, now, "own")).toThrow();
  });
  it("separates harvested, curing and ready stock using actual remaining grams", () => {
    expect(projectKqSocialCultureLot(lot(), now)).toMatchObject({ stage: "curing", harvestGrams: 200, remainingGrams: 12.3 });
    expect(projectKqSocialCultureLot(lot(), now + 60_000)).toMatchObject({ stage: "ready", harvestGrams: 200, remainingGrams: 12.3 });
    expect(projectKqSocialCultureLot({ ...lot(), storage: null, remainingGrams: null, harvestGrams: 900 }, now)).toMatchObject({ stage: "unknown", remainingGrams: null });
    expect(projectKqSocialCultureLot({ ...lot(), remainingGrams: 0 }, now + 60_000)?.remainingGrams).toBe(0);
    expect(projectKqSocialCultureLot({ ...lot(), harvestGrams: undefined }, now)?.harvestGrams).toBeNull();
    expect(projectKqSocialCultureLot({ ...lot(), storage: { readyAt: at } }, now)?.stage).toBe("ready");
    expect(projectKqSocialCultureLot({ ...lot(), storage: { readyAt: new Date(now - 1000).toISOString() } }, now)?.stage).toBe("unknown");
  });
  it("does not infer outdoor production, ownership or absent dates from an old or borrowed save", () => {
    const input = { ...run(), state: { ...run().state, warehouse: undefined } };
    expect(projectKqSocialCultureRun(input)?.cultivation).toBe("unknown");
    expect(projectKqSocialCultureContext({ runs: [input], lots: [lot()] }, now, "loan").source).toBe("loan");
    expect(projectKqSocialCultureLot({ ...lot(), harvestedAt: null, storage: null }, now)?.harvestedAt).toBeNull();
  });
  it("rejects malformed or oversized contexts instead of silently turning missing facts into an empty account", () => {
    expect(() => projectKqSocialCultureContext({ runs: [{}], lots: [] }, now, "own")).toThrow();
    expect(() => projectKqSocialCultureContext({ runs: Array(129).fill(run()), lots: [] }, now, "own")).toThrow();
    const context = projectKqSocialCultureContext({ runs: [run()], lots: [lot()] }, now, "own");
    context.runs[0].problem!.diagnosis = "Unconfirmed assertion";
    expect(isKqSocialCultureContext(context)).toBe(false);
    context.runs[0].problem!.diagnosis = null;
    context.lots[0].remainingGrams = Number.NaN;
    expect(isKqSocialCultureContext(context)).toBe(false);
  });
});
