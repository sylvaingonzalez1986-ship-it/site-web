import { describe, expect, it } from "vitest";
import { readKqPreparationDraft, writeKqPreparationDraft } from "./kanab-quest-preparation-draft";

function storage() {
  const entries = new Map<string, string>();
  return { entries, getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
}
const selection = { deckCodes: ["BOTTE-003", "BOTTE-003", "BOTTE-017"], heritageCode: "HERITAGE-001" };

describe("preparation across warehouse navigation", () => {
  it("keeps ordered copies and explicit empty choices independently for each account", () => {
    const session = storage();
    writeKqPreparationDraft(session, "alice", selection);
    writeKqPreparationDraft(session, "bob", { deckCodes: [], heritageCode: null });
    expect(readKqPreparationDraft(session, "alice")).toEqual(selection);
    expect(readKqPreparationDraft(session, "bob")).toEqual({ deckCodes: [], heritageCode: null });
    expect(readKqPreparationDraft(session, "charlie")).toBeNull();
    writeKqPreparationDraft(session, "alice", null);
    expect(readKqPreparationDraft(session, "alice")).toBeNull();
    expect(readKqPreparationDraft(session, "bob")).not.toBeNull();
  });

  it("does not create shared anonymous preferences", () => {
    const session = storage();
    expect(writeKqPreparationDraft(session, undefined, selection)).toBe(false);
    expect(writeKqPreparationDraft(session, " ", selection)).toBe(false);
    expect(readKqPreparationDraft(session)).toBeNull();
    expect(session.entries.size).toBe(0);
  });

  it("preserves decks up to the server's 250-card limit", () => {
    const session = storage();
    const full = { deckCodes: Array(250).fill("BOTTE-003"), heritageCode: null };
    writeKqPreparationDraft(session, "alice", full);
    expect(readKqPreparationDraft(session, "alice")).toEqual(full);
  });

  it.each(["{", "null", "[]", '{"version":2,"deckCodes":[],"heritageCode":null}', '{"version":1,"deckCodes":[null],"heritageCode":null}', '{"version":1,"deckCodes":[],"heritageCode":{}}', '{"version":1,"deckCodes":[]}', JSON.stringify({ version: 1, deckCodes: Array(251).fill("BOTTE-003"), heritageCode: null })])("ignores malformed or unsupported saved data: %s", raw => {
    expect(readKqPreparationDraft({ getItem: () => raw }, "alice")).toBeNull();
  });

  it("tolerates browser storage being unavailable without treating it as an empty selection", () => {
    const denied = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("denied"); } };
    expect(readKqPreparationDraft(null, "alice")).toBeNull();
    expect(readKqPreparationDraft(denied, "alice")).toBeNull();
    expect(writeKqPreparationDraft(denied, "alice", selection)).toBe(false);
    expect(writeKqPreparationDraft(denied, "alice", null)).toBe(false);
  });
});
