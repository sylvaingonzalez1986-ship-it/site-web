import { describe, expect, it } from "vitest";
import { buildingForActivity, buildingRoomHref, normalizeKqVillageLocation } from "./kanab-quest-world-mode";

describe("village links", () => {
  it("opens the six isometric rooms and keeps activity bookmarks precise", () => {
    for (const view of ["treasury", "staff", "market", "social", "missions", "arena", "shop"]) {
      const id = buildingForActivity(view)!;
      const { search } = new URL(buildingRoomHref(id), "https://example.test");
      expect(normalizeKqVillageLocation(search)).toBe(`?view=hub&room=${id}`);
      expect(normalizeKqVillageLocation(`${search}&world=2d`)).toBe(`${search}&world=3d`);
      expect(normalizeKqVillageLocation(`?view=${view}&room=${id}&section=test`)).toBe(`?view=${view}&section=test`);
    }
    expect(buildingForActivity("game")).toBeUndefined();
    expect(normalizeKqVillageLocation("?view=hub&room=unknown")).toBe("?view=hub");
  });
  it("resumes old room bookmarks at their activity", () => {
    const destinations = { warehouse: "workshop", bank: "treasury", office: "staff", market: "market", missions: "missions", arena: "arena", collection: "school", shop: "shop" };
    for (const [room, view] of Object.entries(destinations)) {
      expect(normalizeKqVillageLocation(`?world=3d&room=${room}`)).toBe(`?world=3d&view=${view}`);
    }
    expect(normalizeKqVillageLocation("?world=3d&room=warehouse&view=game&zone=zone-a&run=run-a")).toBe("?world=3d&view=game&zone=zone-a&run=run-a");
    expect(normalizeKqVillageLocation("?room=bank&world=2d&view=treasury&pole=bank")).toBe("?world=3d&view=treasury&pole=bank");
    expect(normalizeKqVillageLocation("?world=3d&room=__proto__")).toBe("?world=3d");
    expect(normalizeKqVillageLocation("?room=unknown")).toBe("");
  });

  it.each(["world=2d", "world=3d&world=2d", "world=2d&world=3d", "world=", "world=unknown"])("replaces %s with a single 3D world and preserves activity context", world => {
    const params = new URLSearchParams(normalizeKqVillageLocation(`?view=game&${world}&zone=a%2Bb&zone=c`));
    expect(params.getAll("world")).toEqual(["3d"]);
    expect(params.get("view")).toBe("game");
    expect(params.getAll("zone")).toEqual(["a+b", "c"]);
  });

  it.each(["", "?view=game&zone=a%20b", "?view=hub&world=3d"])("preserves an ordinary village URL %j", search => {
    expect(normalizeKqVillageLocation(search)).toBe(search);
  });
});
