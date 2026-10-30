import { describe, expect, it, vi } from "vitest";
import { createKqScopedRequest, type KqApiBurnReceipt, type KqRemoteActiveRun } from "./kanab-quest-api";
import { readKqCardRecovery, verifyKqCardPlayResult, type KqCardAttempt } from "./kanab-quest-card-recovery";
import { advanceKqStage, playKqCard, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const RUN_ID = "d657a4fb-a690-4593-b068-fad366c012ad";
const CARD = "BOTTE-024";
const OTHER_CARD = "BOTTE-017";
const BEFORE_TIME = "2026-10-30T12:00:00.000Z";
const AFTER_TIME = "2026-10-30T12:00:01.000Z";

function position(): KqGameState {
  const state = startKqGame(91, {
    rulesVersion: 3, varietyCode: "HH2026-020", deckCodes: [CARD, OTHER_CARD], startedAt: BEFORE_TIME,
  });
  return { ...state, situationCodes: ["SIT-001", ...state.situationCodes.slice(1)],
    phase: "rolled", dice: [1, 2, 4], handCodes: [CARD, OTHER_CARD], xp: 10 };
}

function burn(overrides: Partial<KqApiBurnReceipt> = {}): KqApiBurnReceipt {
  return { id: "burn-new", cardInstanceId: "copy-consumed", cardCode: CARD,
    stageIndex: 0, useKind: "support", burnedAt: AFTER_TIME, ...overrides };
}

function run(state = playKqCard(position(), CARD), receipts = [burn()]): KqRemoteActiveRun {
  return { runId: RUN_ID, zoneId: null, buddieCode: state.varietyCode, state,
    startedAt: BEFORE_TIME, updatedAt: AFTER_TIME, burnReceipts: receipts };
}

function attempt(overrides: Partial<KqCardAttempt> = {}): KqCardAttempt {
  return { runId: RUN_ID, cardCode: CARD, stageIndex: 0, seed: 91,
    receiptIds: [], inventoryCodes: [CARD, OTHER_CARD], ...overrides };
}

function album(inventory: unknown = { [CARD]: 1, [OTHER_CARD]: 3 }, availableInventory: unknown = inventory) {
  return { collection: { ownerFound: true, inventory, availableInventory } };
}

const snapshot = (activeRun: unknown) => ({ activeRun, activeRuns: activeRun ? [activeRun] : [] });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function reader(first: unknown = run(), collection: unknown = album(), second: unknown = first) {
  const responses = [snapshot(first), collection, snapshot(second)];
  const request = vi.fn<typeof fetch>(async () => json(responses.shift()));
  return request;
}

function expectReadOnly(request: ReturnType<typeof reader>, count = 3) {
  expect(request).toHaveBeenCalledTimes(count);
  expect(request.mock.calls.every(([, init]) => (!init?.method || init.method === "GET") && init?.cache === "no-store")).toBe(true);
}

describe("card recovery from authoritative reads", () => {
  it("uses valid persisted game states and real card effects, without mutating the original", () => {
    const before = position();
    const after = playKqCard(before, CARD);
    expect(after).not.toBe(before);
    expect(after.usedCards).toEqual([CARD]);
    expect(after.dice).not.toEqual(before.dice);
    expect(parseKqGameSave(encodeKqSave(before))).toEqual(before);
    expect(parseKqGameSave(encodeKqSave(after))).toEqual(after);
  });

  it("reads the exact run, then album, then run again and returns a newly observed receipt", async () => {
    const stored = run();
    const request = reader(stored);
    const result = await readKqCardRecovery(attempt(), createKqScopedRequest("player", request));
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `/api/arena/placard/runs?runId=${RUN_ID}`, "/api/arena/placard/collection", `/api/arena/placard/runs?runId=${RUN_ID}`,
    ]);
    expectReadOnly(request);
    expect(result).toEqual({ run: stored, receipt: burn(),
      inventory: { [CARD]: 1, [OTHER_CARD]: 3 }, availableInventory: { [CARD]: 1, [OTHER_CARD]: 3 } });
  });

  it("accepts the direct admin collection snapshot with the same verified inventory requirements", async () => {
    const collection = album({ [CARD]: 0, [OTHER_CARD]: 3 }).collection;
    const request = reader(run(), collection);
    const result = await readKqCardRecovery(attempt(), createKqScopedRequest("admin", request));
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `/api/admin/placard/runs?runId=${RUN_ID}`, "/api/admin/placard/collection", `/api/admin/placard/runs?runId=${RUN_ID}`,
    ]);
    expect(result.inventory).toEqual(collection.inventory);
    expect(result.availableInventory).toEqual(collection.availableInventory);
    expect(result.receipt).toEqual(burn());
    expectReadOnly(request);
  });

  it.each([
    ["missing known card", album({ [CARD]: 0 }).collection],
    ["unverified owner", { ...album().collection, ownerFound: false }],
    ["missing available inventory", { ownerFound: true, inventory: { [CARD]: 1, [OTHER_CARD]: 3 } }],
    ["invalid nested collection despite valid root fields", { ...album().collection, collection: null }],
    ["null response", null],
  ])("rejects direct collection payload with %s", async (_label, collection) => {
    const request = reader(run(), collection);
    await expect(readKqCardRecovery(attempt(), request)).rejects.toThrow("album");
    expectReadOnly(request, 2);
  });

  it("waits for each read before issuing the next, so inventory cannot predate the first snapshot", async () => {
    let releaseFirst!: (response: Response) => void;
    let releaseAlbum!: (response: Response) => void;
    const request = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { releaseFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { releaseAlbum = resolve; }))
      .mockResolvedValueOnce(json(snapshot(run())));
    const recovery = readKqCardRecovery(attempt(), request);
    expect(request).toHaveBeenCalledTimes(1);
    releaseFirst(json(snapshot(run())));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    releaseAlbum(json(album()));
    await expect(recovery).resolves.toMatchObject({ receipt: burn() });
    expectReadOnly(request);
  });

  it("returns receipt absence as an observation without replaying the POST or inventing a failed result", async () => {
    const stored = run(position(), []);
    const request = reader(stored);
    const result = await readKqCardRecovery(attempt(), request);
    expect(result.receipt).toBeNull();
    expect(result.run.state).toEqual(position());
    expect(result).not.toHaveProperty("failed");
    expect(result).not.toHaveProperty("consumed");
    expectReadOnly(request);
  });

  it.each([
    ["receipt already known", [burn()], ["burn-new"]],
    ["receipt for another card", [burn({ cardCode: OTHER_CARD })], []],
    ["receipt for another stage", [burn({ stageIndex: 1 })], []],
  ] as const)("does not attribute a %s to this attempt", async (_label, receipts, receiptIds) => {
    const request = reader(run(undefined, [...receipts]));
    expect((await readKqCardRecovery(attempt({ receiptIds: [...receiptIds] }), request)).receipt).toBeNull();
    expectReadOnly(request);
  });

  it("keeps the authoritative later stage instead of restoring the attempted stage", async () => {
    const later = advanceKqStage(resolveKqStage(playKqCard(position(), CARD)));
    expect(later.stageIndex).toBe(1);
    expect(parseKqGameSave(encodeKqSave(later))).toEqual(later);
    const result = await readKqCardRecovery(attempt(), reader(run(later)));
    expect(result.run.state).toEqual(later);
    expect(result.receipt).toEqual(burn());
  });

  it.each([
    ["missing run", null],
    ["other run", { ...run(), runId: "5557a4fb-a690-4593-b068-fad366c012ad" }],
    ["other seed", run({ ...position(), seed: 92 }, [])],
    ["invalid saved state", { ...run(), state: { seed: 91, stageIndex: 0 } }],
    ["missing update time", { ...run(), updatedAt: "" }],
    ["invalid update time", { ...run(), updatedAt: "tomorrow" }],
  ])("rejects %s before trusting inventory", async (_label, stored) => {
    const request = reader(stored);
    await expect(readKqCardRecovery(attempt(), request)).rejects.toThrow();
    expectReadOnly(request, 1);
  });

  it("rejects a snapshot older than the attempted stage", async () => {
    const request = reader(run(position(), []));
    await expect(readKqCardRecovery(attempt({ stageIndex: 1 }), request)).rejects.toThrow("sauvegarde");
    expectReadOnly(request, 1);
  });

  it("accepts verified zero copies after the last physical card was consumed", async () => {
    const counts = { [CARD]: 0, [OTHER_CARD]: 3 };
    const result = await readKqCardRecovery(attempt(), reader(run(), album(counts)));
    expect(result.inventory[CARD]).toBe(0);
    expect(result.availableInventory[CARD]).toBe(0);
    expect(result.receipt).toEqual(burn());
  });

  it.each([
    ["played card missing", album({ [OTHER_CARD]: 3 })],
    ["previously known card missing", album({ [CARD]: 1 })],
    ["availability missing", album({ [CARD]: 1, [OTHER_CARD]: 3 }, { [CARD]: 1 })],
    ["new card missing from availability", album({ [CARD]: 1, [OTHER_CARD]: 3, "BOTTE-021": 1 }, { [CARD]: 1, [OTHER_CARD]: 3 })],
    ["availability exceeds copies", album({ [CARD]: 1, [OTHER_CARD]: 3 }, { [CARD]: 2, [OTHER_CARD]: 3 })],
    ["owner not verified", { collection: { ownerFound: false, inventory: {}, availableInventory: {} } }],
    ["collection missing", {}],
  ])("does not silently infer zero when %s", async (_label, collection) => {
    const request = reader(run(), collection);
    await expect(readKqCardRecovery(attempt(), request)).rejects.toThrow("album");
    expectReadOnly(request, 2);
  });

  it.each([
    ["negative count", { [CARD]: -1, [OTHER_CARD]: 3 }],
    ["fractional count", { [CARD]: 0.5, [OTHER_CARD]: 3 }],
    ["unsafe count", { [CARD]: Number.MAX_SAFE_INTEGER + 1, [OTHER_CARD]: 3 }],
    ["numeric string", { [CARD]: "1", [OTHER_CARD]: 3 }],
    ["null count", { [CARD]: null, [OTHER_CARD]: 3 }],
    ["array", [1, 3]],
    ["null map", null],
  ])("rejects invalid inventory: %s", async (_label, inventory) => {
    const request = reader(run(), album(inventory));
    await expect(readKqCardRecovery(attempt(), request)).rejects.toThrow("album");
    expectReadOnly(request, 2);
  });

  it.each([
    ["missing receipt id", [burn({ id: "" })]],
    ["missing copy id", [burn({ cardInstanceId: "" })]],
    ["fractional stage", [burn({ stageIndex: 0.5 })]],
    ["negative stage", [burn({ stageIndex: -1 })]],
    ["out-of-range stage", [burn({ stageIndex: 6 })]],
    ["empty burn time", [burn({ burnedAt: "" })]],
    ["invalid burn time", [burn({ burnedAt: "soon" })]],
    ["invalid kind", [{ ...burn(), useKind: "unknown" }]],
    ["duplicate receipt", [burn(), burn()]],
    ["missing receipts", null],
  ])("rejects malformed receipts: %s", async (_label, receipts) => {
    const request = reader({ ...run(), burnReceipts: receipts });
    await expect(readKqCardRecovery(attempt(), request)).rejects.toThrow("sauvegarde");
    expectReadOnly(request, 1);
  });

  it.each([
    ["state read before commit, receipt read after commit", run(position()), run()],
    ["receipt appears during album read", run(position(), []), run()],
    ["receipt disappears", run(), run(playKqCard(position(), CARD), [])],
    ["updatedAt changed", run(), { ...run(), updatedAt: "2026-10-30T12:00:02.000Z" }],
    ["another exact run returned second", run(), { ...run(), runId: "5557a4fb-a690-4593-b068-fad366c012ad" }],
  ])("leaves recovery unresolved when %s", async (_label, first, second) => {
    const request = reader(first, album(), second);
    await expect(readKqCardRecovery(attempt(), request)).rejects.toThrow();
    expectReadOnly(request);
  });

  it("ignores receipt ordering differences while preserving the complete receipt records", async () => {
    const previous = burn({ id: "burn-previous", cardInstanceId: "older-copy", cardCode: OTHER_CARD, burnedAt: BEFORE_TIME });
    const request = reader(run(undefined, [burn(), previous]), album(), run(undefined, [previous, burn()]));
    const result = await readKqCardRecovery(attempt({ receiptIds: [previous.id] }), request);
    expect(result.receipt).toEqual(burn());
    expect(result.run.burnReceipts).toEqual([previous, burn()]);
    expectReadOnly(request);
  });

  it.each([0, 1, 2])("stops on a 503 during read %s without issuing a mutation", async failureIndex => {
    const bodies = [snapshot(run()), album(), snapshot(run())];
    let index = 0;
    const request = vi.fn<typeof fetch>(async () => {
      const current = index++;
      return current === failureIndex ? json({ error: "Lecture momentanément indisponible." }, 503) : json(bodies[current]);
    });
    await expect(readKqCardRecovery(attempt(), request)).rejects.toThrow("Lecture momentanément indisponible");
    expectReadOnly(request, failureIndex + 1);
  });
});

describe("card play response verification", () => {
  const confirmed = () => ({ state: playKqCard(position(), CARD), burnReceipt: burn() });

  it("accepts the real played state and complete matching receipt", () => {
    expect(verifyKqCardPlayResult(confirmed(), attempt())).toEqual(confirmed());
  });

  it.each([
    ["empty response", null],
    ["state absent", { burnReceipt: burn() }],
    ["receipt absent", { state: playKqCard(position(), CARD) }],
    ["unplayed state", { state: position(), burnReceipt: burn() }],
    ["another seed", { ...confirmed(), state: { ...confirmed().state, seed: 92 } }],
    ["another receipt card", { ...confirmed(), burnReceipt: burn({ cardCode: OTHER_CARD }) }],
    ["another receipt stage", { ...confirmed(), burnReceipt: burn({ stageIndex: 1 }) }],
    ["another receipt category", { ...confirmed(), burnReceipt: burn({ useKind: "pbi" }) }],
    ["substrate receipt", { ...confirmed(), burnReceipt: burn({ useKind: "substrate" }) }],
    ["old receipt already recorded", confirmed()],
  ])("rejects %s before the UI can subtract a copy", (_label, value) => {
    const context = attempt(_label === "old receipt already recorded" ? { receiptIds: ["burn-new"] } : {});
    expect(() => verifyKqCardPlayResult(value, context)).toThrow("confirmation");
  });

  it("does not treat an older use of the same card as a play during the current stage", () => {
    const later = advanceKqStage(resolveKqStage(confirmed().state));
    expect(later.usedCards).toContain(CARD);
    expect(later.playedThisStage).not.toContain(CARD);
    expect(parseKqGameSave(encodeKqSave(later))).toEqual(later);
    expect(() => verifyKqCardPlayResult({ state: later, burnReceipt: burn({ stageIndex: 1 }) }, attempt({ stageIndex: 1 })))
      .toThrow("confirmation");
  });

  it("does not accept a later state as the response to the captured play", () => {
    const later = advanceKqStage(resolveKqStage(confirmed().state));
    expect(() => verifyKqCardPlayResult({ state: later, burnReceipt: burn() }, attempt())).toThrow("confirmation");
  });
});
