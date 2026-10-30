import { afterEach, describe, expect, it, vi } from "vitest";
import { createClientRequestKey } from "./client-request-key";
import { clearKqZoneStartRequestKey, getKqZoneStartRequestKey, KQ_CAMPAIGN_START_SCOPE, selectKqClientRun } from "./kanab-quest-client-run-selection";

afterEach(() => vi.unstubAllGlobals());

const legacy = { runId: "legacy", zoneId: null, state: {} };
const first = { runId: "first", zoneId: "a", state: {} };
const second = { runId: "second", state: { warehouse: { zoneId: "b" } } };
const payload = { activeRun: first, activeRuns: [first, second, legacy] };

describe("culture selection", () => {
  it("keeps the requested zone instead of the session's default culture", () => {
    expect(selectKqClientRun(payload, { zoneId: "b" })).toBe(second);
    expect(selectKqClientRun(payload, { zoneId: "free" })).toBeNull();
  });
  it("rejects a run belonging to another zone and a missing explicit run", () => {
    expect(selectKqClientRun(payload, { zoneId: "a", runId: "second" })).toBeNull();
    expect(selectKqClientRun(payload, { zoneId: "a", runId: "deleted" })).toBeNull();
  });
  it("only resumes legacy cultures without an explicit selection", () => {
    expect(selectKqClientRun(payload, {})).toBe(legacy);
    expect(selectKqClientRun({ activeRun: first, activeRuns: [first] }, {})).toBeNull();
    expect(selectKqClientRun({ activeRun: legacy }, {})).toBe(legacy);
  });
  it("accepts an explicitly selected completed run outside the active list", () => {
    expect(selectKqClientRun<typeof first | typeof second>({ activeRun: second, activeRuns: [first] }, { runId: "second", zoneId: "b" })).toBe(second);
  });
  it("opens the same campaign leader from either member zone or run", () => {
    const campaign = { leaderRunId: "first", members: [{ runId: "first", zoneId: "a" }, { runId: "second", zoneId: "b" }] };
    const leader = { ...first, state: { campaign } };
    const member = { ...first, runId: "second", zoneId: "b", state: { campaign } };
    const grouped = { activeRun: leader, activeRuns: [member, leader] };
    expect(selectKqClientRun(grouped, { zoneId: "b" })).toBe(leader);
    expect(selectKqClientRun(grouped, { runId: "second", zoneId: "b" })).toBe(leader);
    expect(selectKqClientRun(grouped, { campaign: true })).toBe(leader);
    expect(selectKqClientRun(grouped, {})).toBe(leader);
    expect(selectKqClientRun(grouped, { zoneId: "unrelated", runId: "second" })).toBeNull();
  });
  it("accepts a canonical terminal response for a requested campaign member", () => {
    const campaign = { leaderRunId: "first", members: [{ runId: "first", zoneId: "a" }, { runId: "second", zoneId: "b" }] };
    const leader = { ...first, state: { campaign } };
    expect(selectKqClientRun({ activeRun: leader, activeRuns: [] }, { runId: "second", zoneId: "b" })).toBe(leader);
  });
  it("does not silently replace a new campaign with an old independent run", () => {
    expect(selectKqClientRun(payload, { campaign: true })).toBeNull();
    expect(selectKqClientRun(payload, { runId: "first" })).toBe(first);
  });
});

describe("zone start retry", () => {
  it("preserves the mobile fallback key across campaign retries until the receipt is cleared", () => {
    let generated = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (values: Uint8Array) => values.fill(++generated),
    });
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const input = { campaign: true, participants: ["a", "b"], deckCodes: [] };

    const firstKey = getKqZoneStartRequestKey(storage, KQ_CAMPAIGN_START_SCOPE, input, createClientRequestKey);
    expect(firstKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getKqZoneStartRequestKey({ ...storage }, KQ_CAMPAIGN_START_SCOPE, input, createClientRequestKey)).toBe(firstKey);
    expect(generated).toBe(1);

    clearKqZoneStartRequestKey(storage, KQ_CAMPAIGN_START_SCOPE);
    expect(getKqZoneStartRequestKey(storage, KQ_CAMPAIGN_START_SCOPE, input, createClientRequestKey)).not.toBe(firstKey);
    expect(generated).toBe(2);
  });

  it("uses one persistent campaign receipt independently of the clicked zone", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const input = { campaign: true, participants: ["a", "b"], deckCodes: [] };
    const first = getKqZoneStartRequestKey(storage, KQ_CAMPAIGN_START_SCOPE, input, () => "00000000-0000-4000-8000-000000000001");
    expect(getKqZoneStartRequestKey(storage, KQ_CAMPAIGN_START_SCOPE, input, () => "must-not-create")).toBe(first);
    clearKqZoneStartRequestKey(storage, KQ_CAMPAIGN_START_SCOPE);
    expect(values.size).toBe(0);
  });
  it("keeps the same key across retries and reloads, isolating zones and changed inputs", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    let count = 0;
    const create = () => `00000000-0000-4000-8000-${String(++count).padStart(12, "0")}`;
    const input = { buddieCode: "B", deckCodes: ["one"] };
    const firstKey = getKqZoneStartRequestKey(storage, "a", input, create);
    expect(getKqZoneStartRequestKey({ ...storage }, "a", input, create)).toBe(firstKey);
    expect(getKqZoneStartRequestKey(storage, "b", input, create)).not.toBe(firstKey);
    expect(getKqZoneStartRequestKey(storage, "a", { ...input, deckCodes: [] }, create)).not.toBe(firstKey);
    clearKqZoneStartRequestKey(storage, "b");
    expect(values.has("kq-zone-start:b")).toBe(false);
    expect(values.has("kq-zone-start:a")).toBe(true);
  });
});
