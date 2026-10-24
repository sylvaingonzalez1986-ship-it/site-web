import { describe, expect, it } from "vitest";
import { classifyKqBuddieAssignmentReceipt, getKqBuddieAssignmentRequest, parseKqBuddieAssignmentReceipt, type KqBuddieAssignmentSnapshot } from "./kanab-quest-buddie-assignment";
import { createKqWarehouseStarter, getKqWarehouseQuote } from "./kanab-quest-warehouse";
import { KQ_BUDDIE_ROTATION_REQUIRED, type KqBuddieRotation } from "./kanab-quest-buddie-rotation";
import { getKqCampaignParticipants } from "./kanab-quest-campaign";

const key = "aaaaaaaa-1111-4111-8111-111111111111";
const first = "HH2026-001", second = "HH2026-002", third = "HH2026-003";
const collection = (): { ownedCodes: string[]; rotation: KqBuddieRotation } => ({ ownedCodes: [first, second, third], rotation: { requiredDistinctBuddies: KQ_BUDDIE_ROTATION_REQUIRED, recentBuddieCodes: [] } });
function snapshot(): KqBuddieAssignmentSnapshot {
  const state = createKqWarehouseStarter();
  return { state: getKqWarehouseQuote({ ...state, zones: [
    { ...state.zones[0], buddieCode: first },
    { ...state.zones[0], id: "other", name: state.zones[0].name, x: 3 },
  ] }, state).nextState, revision: 8, activeRun: false, legacyActiveRun: false, activeRuns: [] };
}
const choose = (current = snapshot(), code: string | null = second) => getKqBuddieAssignmentRequest(current, { zoneId: "starter", buddieCode: code }, collection(), key);

describe("Buddie assignment from culture preparation", () => {
  it("builds a free revision-bound PATCH with the supplied retry key", () => {
    const current = snapshot(), request = choose(current);
    expect(request).toMatchObject({ expectedRevision: 8, expectedCostCents: 0, requestKey: key });
    expect(request.state.zones[0].buddieCode).toBe(second);
    expect(getKqWarehouseQuote(request.state, current.state).totalCostCents).toBe(0);
  });

  it("changes only the selected assignment, keeping every installed plan field", () => {
    const current = snapshot();
    current.state = getKqWarehouseQuote({ ...current.state, zones: current.state.zones.map(zone => ({ ...zone, optionCodes: ["SIM-WATER-01", "SIM-NUTRITION-01"] })) }, current.state).nextState;
    const before = structuredClone(current), request = choose(current);
    const expected = structuredClone(before.state);
    expected.zones[0].buddieCode = second;
    expect(request.state).toEqual(expected);
    expect(current).toEqual(before);
    request.state.zones[0].optionCodes!.push("SIM-CLIMATE-01");
    expect(current).toEqual(before);
  });

  it("keeps all assigned active zones in the campaign", () => {
    const current = snapshot();
    current.state.zones[1].buddieCode = third;
    expect(getKqCampaignParticipants(choose(current).state, current.revision).map(member => member.buddieCode).sort()).toEqual([second, third]);
  });

  it("removes a rotated Buddie without consuming or reassigning it", () => {
    const current = snapshot(), owned = collection();
    owned.rotation.recentBuddieCodes = [first];
    const request = getKqBuddieAssignmentRequest(current, { zoneId: "starter", buddieCode: null }, owned, key);
    expect(request.state.zones[0]).not.toHaveProperty("buddieCode");
    expect(current.state.zones[0].buddieCode).toBe(first);
    expect(owned.rotation.recentBuddieCodes).toEqual([first]);
  });

  it("allows removal of a no-longer-owned Buddie to repair an obsolete assignment", () => {
    const request = getKqBuddieAssignmentRequest(snapshot(), { zoneId: "starter", buddieCode: null }, { ...collection(), ownedCodes: [] }, key);
    expect(request.state.zones[0]).not.toHaveProperty("buddieCode");
  });

  it("never moves a Buddie implicitly, including from an inactive zone", () => {
    const current = snapshot();
    current.state.zones[1].buddieCode = second;
    current.state.zones[1].active = false;
    expect(() => choose(current)).toThrow("déjà affecté à une autre zone");
    expect(current.state.zones[1].buddieCode).toBe(second);
  });

  it("rejects an occupied target both for assignment and removal", () => {
    const current = { ...snapshot(), activeRun: true, activeRuns: [{ zoneId: "starter" }] };
    expect(() => choose(current)).toThrow("accueille déjà une culture");
    expect(() => choose(current, null)).toThrow("accueille déjà une culture");
  });

  it("preserves another occupied zone while assigning a free zone", () => {
    const current = { ...snapshot(), activeRun: true, activeRuns: [{ zoneId: "other" }] };
    const other = structuredClone(current.state.zones[1]);
    expect(choose(current).state.zones[1]).toEqual(other);
  });

  it("rejects a legacy active run even with an empty modern run list", () => {
    expect(() => choose({ ...snapshot(), legacyActiveRun: true })).toThrow("Termine la culture");
  });

  it("rejects active runs whose occupied zones are unavailable", () => {
    expect(() => choose({ ...snapshot(), activeRun: true, activeRuns: undefined })).toThrow("cultures en cours ne sont pas encore vérifiées");
    expect(() => choose({ ...snapshot(), activeRun: true, activeRuns: [] })).toThrow("Termine la culture");
  });

  it("distinguishes unknown occupancy from a confirmed idle warehouse", () => {
    const current = snapshot();
    delete current.activeRuns;
    delete current.activeRun;
    expect(() => choose(current)).toThrow("cultures en cours ne sont pas encore vérifiées");
    expect(choose({ ...current, activeRun: false }).state.zones[0].buddieCode).toBe(second);
  });

  it("does not select a homonymous zone when the requested ID is absent", () => {
    const current = snapshot();
    expect(current.state.zones[0].name).toBe(current.state.zones[1].name);
    expect(() => getKqBuddieAssignmentRequest(current, { zoneId: "deleted", buddieCode: second }, collection(), key)).toThrow("n’existe plus");
  });

  it("does not activate an inactive zone as a side effect", () => {
    const current = snapshot();
    current.state.zones[0].active = false;
    expect(() => choose(current)).toThrow("zone est inactive");
    expect(() => choose(current, null)).toThrow("zone est inactive");
    expect(current.state.zones[0].active).toBe(false);
  });

  it("blocks unknown ownership, including for removal", () => {
    for (const code of [second, null]) expect(() => getKqBuddieAssignmentRequest(snapshot(), { zoneId: "starter", buddieCode: code }, { ...collection(), ownedCodes: null }, key)).toThrow("collection de Buddies doit être vérifiée");
  });

  it("blocks unknown rotation without treating it as an empty history", () => {
    expect(() => getKqBuddieAssignmentRequest(snapshot(), { zoneId: "starter", buddieCode: second }, { ...collection(), rotation: null }, key)).toThrow("rotation de tes Buddies doit être vérifiée");
  });

  it("rejects unowned varieties and cannot accept a forged catalogue code", () => {
    expect(() => choose(snapshot(), "HH2026-004")).toThrow("présent dans ta collection");
    expect(() => getKqBuddieAssignmentRequest(snapshot(), { zoneId: "starter", buddieCode: "HH2026-999" }, { ...collection(), ownedCodes: ["HH2026-999"] }, key)).toThrow("collection de Buddies doit être vérifiée");
  });

  it("blocks rotation until two other distinct Buddies have been played", () => {
    expect(() => getKqBuddieAssignmentRequest(snapshot(), { zoneId: "starter", buddieCode: second }, { ...collection(), rotation: { requiredDistinctBuddies: 2, recentBuddieCodes: [first, second] } }, key)).toThrow("encore en rotation");
  });

  it("rejects unknown state versions, invalid revisions and malformed keys", () => {
    for (const value of [0, -1, 1.5, NaN, 2_147_483_647]) expect(() => choose({ ...snapshot(), revision: value })).toThrow("plan de culture est incomplet");
    const current = snapshot();
    expect(() => choose({ ...current, state: { ...current.state, version: 2 } as unknown as typeof current.state })).toThrow("plan de culture est incomplet");
    expect(() => getKqBuddieAssignmentRequest(current, { zoneId: "starter", buddieCode: second }, collection(), "new-key")).toThrow("demande d’affectation est invalide");
  });

  it("cannot silently purchase unfunded equipment while assigning a Buddie", () => {
    const current = snapshot();
    current.state.equipment = [];
    expect(() => choose(current)).toThrow("aménagement payant");
    expect(current.state.equipment).toEqual([]);
  });

  it("rejects malformed rotation and occupancy instead of enabling an action", () => {
    const current = snapshot();
    expect(() => choose({ ...current, activeRuns: [{ zoneId: null }] as unknown as typeof current.activeRuns })).toThrow("cultures en cours ne sont pas encore vérifiées");
    expect(() => getKqBuddieAssignmentRequest(current, { zoneId: "starter", buddieCode: second }, { ...collection(), rotation: { requiredDistinctBuddies: 5, recentBuddieCodes: [] } as unknown as KqBuddieRotation }, key)).toThrow("rotation de tes Buddies doit être vérifiée");
  });
});

describe("free assignment receipt", () => {
  function receipt() {
    const request = choose();
    return { request, value: { ...snapshot(), state: structuredClone(request.state), revision: request.expectedRevision + 1,
      receipt: { requestKey: key, revision: request.expectedRevision + 1, investmentCents: 0, chargedCents: 0, creditUsedCents: 0, replayed: false } } };
  }

  it("accepts a complete free receipt and the same idempotent replay", () => {
    const { request, value } = receipt();
    expect(parseKqBuddieAssignmentReceipt(value, request)).toBe(value);
    value.receipt.replayed = true;
    expect(parseKqBuddieAssignmentReceipt(value, request)).toBe(value);
  });

  it("accepts JSONB key order and server-normalized inventory and option order", () => {
    const current = snapshot();
    current.state = getKqWarehouseQuote({ ...current.state, zones: current.state.zones.map(zone => ({ ...zone, optionCodes: ["SIM-WATER-01", "SIM-NUTRITION-01"] })) }, current.state).nextState;
    current.state.equipment.push({ code: "SIM-LIGHT-02", quantity: 0 });
    current.state.optionInventory!.push({ code: "SIM-CLIMATE-01", quantity: 0 });
    const request = choose(current);
    const { value } = receipt();
    value.state = getKqWarehouseQuote(request.state, request.state).nextState;
    value.state.zones.reverse(); value.state.equipment.reverse(); value.state.serviceZones!.reverse(); value.state.optionInventory!.reverse();
    for (const zone of value.state.zones) zone.optionCodes!.reverse();
    value.state = Object.fromEntries(Object.entries(value.state).reverse()) as typeof value.state;
    expect(parseKqBuddieAssignmentReceipt(value, request)).toBe(value);
  });

  it("rejects missing receipts, foreign keys and unconfirmed revisions", () => {
    const { request, value } = receipt();
    expect(parseKqBuddieAssignmentReceipt({ ...value, receipt: undefined }, request)).toBeNull();
    expect(parseKqBuddieAssignmentReceipt({ ...value, receipt: { ...value.receipt, requestKey: "bbbbbbbb-1111-4111-8111-111111111111" } }, request)).toBeNull();
    expect(parseKqBuddieAssignmentReceipt({ ...value, revision: request.expectedRevision }, request)).toBeNull();
    expect(parseKqBuddieAssignmentReceipt({ ...value, receipt: { ...value.receipt, revision: request.expectedRevision } }, request)).toBeNull();
  });

  it("never accepts paid investment, wallet charges or consumed migration credit", () => {
    const { request, value } = receipt();
    for (const field of ["investmentCents", "chargedCents", "creditUsedCents"]) {
      expect(parseKqBuddieAssignmentReceipt({ ...value, receipt: { ...value.receipt, [field]: 1 } }, request)).toBeNull();
      expect(parseKqBuddieAssignmentReceipt({ ...value, receipt: { ...value.receipt, [field]: undefined } }, request)).toBeNull();
    }
  });

  it("rejects the wrong assignment even if its name and revision match", () => {
    const { request, value } = receipt();
    value.state.zones[0].buddieCode = third;
    expect(parseKqBuddieAssignmentReceipt(value, request)).toBeNull();
  });

  it("rejects a changed layout or another assignment in an otherwise valid receipt", () => {
    const { request, value } = receipt();
    value.state.zones[1].buddieCode = third;
    expect(parseKqBuddieAssignmentReceipt(value, request)).toBeNull();
    delete value.state.zones[1].buddieCode;
    value.state.zones[1].x = 4;
    expect(parseKqBuddieAssignmentReceipt(value, request)).toBeNull();
  });

  it("requires a known replay flag and readable occupancy", () => {
    const { request, value } = receipt();
    expect(parseKqBuddieAssignmentReceipt({ ...value, receipt: { ...value.receipt, replayed: undefined } }, request)).toBeNull();
    expect(parseKqBuddieAssignmentReceipt({ ...value, activeRun: undefined, activeRuns: undefined }, request)).toBeNull();
  });

  it("confirms a removal without accepting the previous assigned state", () => {
    const current = snapshot(), request = choose(current, null);
    const { value } = receipt();
    expect(parseKqBuddieAssignmentReceipt({ ...value, state: current.state }, request)).toBeNull();
    expect(parseKqBuddieAssignmentReceipt({ ...value, state: request.state }, request)).not.toBeNull();
  });

  it("distinguishes a confirmed replay from a later concurrent plan change", () => {
    const { request, value } = receipt();
    value.receipt.replayed = true;
    value.revision += 1;
    value.state.zones[0].buddieCode = third;
    expect(classifyKqBuddieAssignmentReceipt(value, request)).toEqual({ status: "changed", snapshot: value });
    expect(parseKqBuddieAssignmentReceipt(value, request)).toBeNull();
    value.state.zones[0].buddieCode = second;
    expect(classifyKqBuddieAssignmentReceipt(value, request)).toEqual({ status: "saved", snapshot: value });
  });

  it("never treats a bad receipt or same-revision wrong state as a concurrent edit", () => {
    const { request, value } = receipt();
    value.state.zones[0].buddieCode = third;
    expect(classifyKqBuddieAssignmentReceipt(value, request)).toBeNull();
    value.revision += 1;
    expect(classifyKqBuddieAssignmentReceipt({ ...value, receipt: { ...value.receipt, requestKey: "bbbbbbbb-1111-4111-8111-111111111111" } }, request)).toBeNull();
    expect(classifyKqBuddieAssignmentReceipt({ ...value, receipt: { ...value.receipt, chargedCents: 1 } }, request)).toBeNull();
    expect(classifyKqBuddieAssignmentReceipt({ ...value, state: { ...value.state, version: 2 } }, request)).toBeNull();
  });
});
