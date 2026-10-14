import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KQ_BUDDIES } from "./kanab-quest-game";
import { getKqBuddieFlavors, KQ_BUDDIE_FLAVOR_PROFILES, KQ_FLAVORS } from "./kanab-quest-buddie-flavors";

describe("Buddie flavor catalog", () => {
  it("covers every playable Buddie with two distinct notes from the reviewed proposal", () => {
    const rows = readFileSync(resolve("docs/bete-de-concours/BUDDIES-PARFUMS-PROPOSITION-2026-10-12.csv"), "utf8").trim().split(/\r?\n/).slice(1);
    expect(Object.keys(KQ_BUDDIE_FLAVOR_PROFILES).sort()).toEqual(KQ_BUDDIES.map((buddie) => buddie.code).sort());
    for (const row of rows) {
      const columns = [...row.matchAll(/"((?:[^"]|"")*)"(?:;|$)/g)].map((match) => match[1].replaceAll('""', '"'));
      const [code, , first, second, status, , source, additionalSource] = columns;
      const profile = KQ_BUDDIE_FLAVOR_PROFILES[code as keyof typeof KQ_BUDDIE_FLAVOR_PROFILES];
      expect(getKqBuddieFlavors(code).map((flavor) => flavor.label), code).toEqual([first, second]);
      expect(new Set(profile.flavors).size, code).toBe(2);
      expect(profile.status, code).toBe(status);
      expect(profile.sources, code).toEqual([source, additionalSource].filter(Boolean));
    }
  });

  it("uses one checked-in illustration per flavor for both cultivation and client requests", () => {
    const flavors = Object.values(KQ_FLAVORS);
    expect(flavors).toHaveLength(38);
    expect(new Set(flavors.map((flavor) => flavor.image)).size).toBe(flavors.length);
    for (const flavor of flavors) expect(existsSync(resolve("public", flavor.image.slice(1))), flavor.code).toBe(true);
  });

  it("does not invent notes for unknown or malformed variety codes", () => {
    for (const code of ["", "HH2026-999", "constructor", "__proto__", "toString"]) {
      expect(getKqBuddieFlavors(code)).toEqual([]);
    }
  });
});
