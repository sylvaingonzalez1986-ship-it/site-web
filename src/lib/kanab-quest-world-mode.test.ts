import { describe, expect, it } from "vitest";
import { kqWorldModeStorageKey, normalizeKqVillageLocation, parseKqWorldMode, readKqWorldMode, refreshKqWorldMode, rememberKqWorldMode, requestedKqWorldMode } from "./kanab-quest-world-mode";

function storage() {
  const entries = new Map<string, string>();
  return { entries, getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
}

describe("game world preference", () => {
  it("resumes old interior bookmarks in their existing activity without changing world preference", () => {
    const destinations = { warehouse: "workshop", bank: "treasury", office: "staff", market: "market", missions: "missions", arena: "arena", collection: "school", shop: "shop" };
    for (const [room, view] of Object.entries(destinations)) {
      const params = new URLSearchParams(normalizeKqVillageLocation(`?world=3d&room=${room}`));
      expect(params.get("view")).toBe(view);
      expect(params.get("world")).toBe("3d");
      expect(params.has("room")).toBe(false);
    }
    expect(normalizeKqVillageLocation("?world=3d&room=warehouse&view=game&zone=zone-a&run=run-a")).toBe("?world=3d&view=game&zone=zone-a&run=run-a");
    expect(normalizeKqVillageLocation("?room=bank&world=2d&view=treasury&pole=bank")).toBe("?world=2d&view=treasury&pole=bank");
    expect(normalizeKqVillageLocation("?world=3d&room=__proto__")).toBe("?world=3d");
    expect(normalizeKqVillageLocation("?room=unknown")).toBe("");
    expect(normalizeKqVillageLocation("?view=hub&world=3d")).toBe("?view=hub&world=3d");
  });

  it("accepts only an unambiguous explicit 2D or 3D choice", () => {
    expect(requestedKqWorldMode("?view=market&world=3d")).toBe("3d");
    expect(requestedKqWorldMode("?world=2d&view=game")).toBe("2d");
    for (const search of ["", "?world=", "?world=4d", "?world=3D", "?world=3d&world=2d"]) {
      expect(requestedKqWorldMode(search)).toBeUndefined();
    }
    expect(parseKqWorldMode(["3d", "2d"])).toBeUndefined();
  });

  it("resumes ordinary game links for the correct account and allows explicit 2D", () => {
    const store = storage();
    rememberKqWorldMode("world-owner-a", "3d", store);
    expect(readKqWorldMode("world-owner-a", store)).toBe("3d");
    expect(readKqWorldMode("world-owner-b", store)).toBe("2d");
    expect(requestedKqWorldMode("?world=2d") ?? readKqWorldMode("world-owner-a", store)).toBe("2d");
    rememberKqWorldMode("world-owner-a", "2d", store);
    expect(readKqWorldMode("world-owner-a", store)).toBe("2d");
    expect(store.entries.get(kqWorldModeStorageKey("world-owner-a"))).toBe("2d");
  });

  it("retains the choice for this visit when reads, writes or storage access are blocked", () => {
    const blocked = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("blocked"); } };
    expect(readKqWorldMode("world-blocked", blocked)).toBe("2d");
    rememberKqWorldMode("world-blocked", "3d", blocked);
    expect(readKqWorldMode("world-blocked", blocked)).toBe("3d");
    expect(readKqWorldMode("world-blocked", null)).toBe("3d");
    const readOnly = { getItem: () => "2d", setItem: () => { throw Error("quota"); } };
    rememberKqWorldMode("world-read-only", "3d", readOnly);
    expect(readKqWorldMode("world-read-only", readOnly)).toBe("3d");
    expect(readKqWorldMode("world-other", blocked)).toBe("2d");
  });

  it("takes an updated or removed preference from another tab without leaking the memory fallback", () => {
    const store = storage();
    rememberKqWorldMode("world-tabs", "3d", null);
    store.setItem(kqWorldModeStorageKey("world-tabs"), "2d");
    refreshKqWorldMode("world-tabs");
    expect(readKqWorldMode("world-tabs", store)).toBe("2d");
    store.setItem(kqWorldModeStorageKey("world-tabs"), "3d");
    refreshKqWorldMode("world-tabs");
    expect(readKqWorldMode("world-tabs", store)).toBe("3d");
    store.entries.delete(kqWorldModeStorageKey("world-tabs"));
    refreshKqWorldMode("world-tabs");
    expect(readKqWorldMode("world-tabs", store)).toBe("2d");
  });

  it("ignores damaged storage and does not persist anonymous preferences", () => {
    const store = storage();
    store.setItem(kqWorldModeStorageKey("world-damaged"), '{"mode":"3d"}');
    expect(readKqWorldMode("world-damaged", store)).toBe("2d");
    const size = store.entries.size;
    rememberKqWorldMode(undefined, "3d", store);
    expect(readKqWorldMode(undefined, store)).toBe("2d");
    expect(store.entries.size).toBe(size);
  });
});
