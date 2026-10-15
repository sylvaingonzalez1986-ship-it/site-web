import { describe, expect, it } from "vitest";
import { createKqWarehouseStarter } from "./kanab-quest-warehouse";
import { readWarehouseDraft, writeWarehouseDraft } from "./warehouse-draft";

describe("warehouse draft recovery", () => {
  const memory = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  };
  it("recovers the revision and draft for the same account only", () => {
    const storage = memory(), draft = { revision: 4, state: createKqWarehouseStarter() };
    expect(writeWarehouseDraft(storage, "a", draft)).toBe(true);
    expect(readWarehouseDraft(storage, "a")).toEqual(draft);
    expect(readWarehouseDraft(storage, "b")).toBeNull();
    writeWarehouseDraft(storage, "a", null); expect(readWarehouseDraft(storage, "a")).toBeNull();
  });
  it("ignores corrupt data and tolerates unavailable storage", () => {
    expect(readWarehouseDraft({ getItem: () => "not json" }, "a")).toBeNull();
    expect(readWarehouseDraft({ getItem: () => '{"revision":1,"state":{}}' }, "a")).toBeNull();
    const storage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => {} };
    expect(readWarehouseDraft(storage, "a")).toBeNull();
    expect(writeWarehouseDraft(storage, "a", { revision: 0, state: createKqWarehouseStarter() })).toBe(false);
    expect(readWarehouseDraft(storage, "a")).toEqual({ revision: 0, state: createKqWarehouseStarter() });
    writeWarehouseDraft(storage, "a", null);
  });
  it("keeps same-document navigation safe if even accessing sessionStorage is denied", () => {
    const draft = { revision: 3, state: createKqWarehouseStarter() };
    expect(writeWarehouseDraft(null, "volatile-account", draft)).toBe(false);
    expect(readWarehouseDraft(null, "volatile-account")).toEqual(draft);
    expect(readWarehouseDraft(null, "other-account")).toBeNull();
    writeWarehouseDraft(null, "volatile-account", null);
    expect(readWarehouseDraft(null, "volatile-account")).toBeNull();
  });
});
