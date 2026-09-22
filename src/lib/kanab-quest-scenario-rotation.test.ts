import { describe, expect, it } from "vitest";
import {
  advanceKqStage,
  buildKqScenarioPath,
  getKqSituation,
  KQ_SITUATIONS,
  KQ_STAGES,
  resolveKqStage,
  rollKqDice,
  startKqGame,
  type KqGameState,
  type KqPest,
  type KqSituationTag,
} from "./kanab-quest-game";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const stagePools = KQ_STAGES.map((stage) => KQ_SITUATIONS.filter((situation) => situation.stage === stage));
const maximumPoolSize = Math.max(...stagePools.map((pool) => pool.length));
const catalogueHistory = Array.from({ length: maximumPoolSize }, (_, runIndex) =>
  stagePools.map((pool) => pool[runIndex % pool.length].code),
);

function situationsFor(path: string[]) {
  return path.map((code, stageIndex) => {
    const situation = KQ_SITUATIONS.find((item) => item.code === code);
    expect(situation?.stage, code).toBe(KQ_STAGES[stageIndex]);
    return situation!;
  });
}

describe("culture situation rotation", () => {
  it("keeps identical inputs deterministic without mutating the supplied history or constraints", () => {
    const history = catalogueHistory.slice(0, 3).flat();
    const tags: KqSituationTag[] = ["pest", "compliance"];
    const pests: KqPest[] = ["mites"];
    const original = { history: [...history], tags: [...tags], pests: [...pests] };

    for (const seed of [0, 1, 42, 99999]) {
      const first = buildKqScenarioPath(seed, history, tags, pests, "external");
      expect(buildKqScenarioPath(seed, history, tags, pests, "external")).toEqual(first);
      situationsFor(first);
    }
    expect({ history, tags, pests }).toEqual(original);
  });

  it("visits unseen situations at each stage before revisiting any over successive cultures", () => {
    const history: string[][] = [];
    const seen = KQ_STAGES.map(() => new Set<string>());

    for (let runIndex = 0; runIndex < maximumPoolSize; runIndex++) {
      const path = buildKqScenarioPath(310 + runIndex * 17, history.flat());
      situationsFor(path);
      path.forEach((code, stageIndex) => {
        if (seen[stageIndex].size < stagePools[stageIndex].length) {
          expect(seen[stageIndex].has(code), `${KQ_STAGES[stageIndex]}, culture ${runIndex + 1}`).toBe(false);
        }
        seen[stageIndex].add(code);
      });
      history.unshift(path);
    }

    stagePools.forEach((pool, stageIndex) => {
      expect([...seen[stageIndex]].sort()).toEqual(pool.map((situation) => situation.code).sort());
    });
  });

  it("uses the oldest last appearance after exhaustion, even if a recently replayed code has an older duplicate", () => {
    // Histories are ordered newest culture first. The last row duplicates the
    // most recent row, so lastIndexOf would incorrectly favour those codes.
    const history = [...catalogueHistory, catalogueHistory[0]].flat();
    const oldest = stagePools.map((pool) => pool[pool.length - 1].code);

    for (let seed = 0; seed < 32; seed++) {
      expect(buildKqScenarioPath(seed, history)).toEqual(oldest);
    }
  });

  it("keeps rotating after a full tour instead of resetting to an unrestricted draw", () => {
    const history = catalogueHistory.map((path) => [...path]);
    for (let runIndex = 0; runIndex < maximumPoolSize * 3; runIndex++) {
      const latest = history[0];
      const secondLatest = history[1];
      const priorCodes = history.flat();
      const path = buildKqScenarioPath(91 + runIndex * 13, priorCodes);

      path.forEach((code, stageIndex) => {
        const lastSeen = priorCodes.indexOf(code);
        const oldestLastSeen = Math.max(...stagePools[stageIndex].map((situation) => priorCodes.indexOf(situation.code)));
        expect(lastSeen, `${KQ_STAGES[stageIndex]}, culture ${runIndex + 1}`).toBe(oldestLastSeen);
        expect(code).not.toBe(latest[stageIndex]);
        expect(code).not.toBe(secondLatest[stageIndex]);
      });
      history.unshift(path);
      history.length = Math.min(history.length, 12);
    }
  });

  it("avoids both of the last two cultures while unseen alternatives remain", () => {
    for (let seed = 0; seed < 48; seed++) {
      const first = buildKqScenarioPath(seed);
      const second = buildKqScenarioPath(seed + 1, first);
      const third = buildKqScenarioPath(seed + 2, [...second, ...first]);
      expect(third.every((code) => !first.includes(code) && !second.includes(code))).toBe(true);
    }
  });

  it("ignores unknown archived codes without changing the known situations' recency", () => {
    const history = [...catalogueHistory, catalogueHistory[0]].flat();
    const archived = ["SIT-RETIRED", ...history.slice(0, 8), "SIT-UNKNOWN", ...history.slice(8)];
    for (let seed = 0; seed < 16; seed++) {
      expect(buildKqScenarioPath(seed, archived)).toEqual(buildKqScenarioPath(seed, history));
    }
  });

  it("keeps required situation tags available even when their complete pool has already been seen", () => {
    const tags = [...new Set(KQ_SITUATIONS.flatMap((situation) => situation.tags))];
    for (const tag of tags) {
      for (let seed = 0; seed < 16; seed++) {
        const path = buildKqScenarioPath(seed, catalogueHistory.flat(), [tag]);
        expect(situationsFor(path).some((situation) => situation.tags.includes(tag)), tag).toBe(true);
      }
    }
  });

  it("preserves jointly achievable required tags when a compatible pest needs another stage choice", () => {
    const tags: KqSituationTag[] = ["energy", "pest", "compliance"];
    const history = catalogueHistory.flat();
    for (let seed = 0; seed < 64; seed++) {
      const situations = situationsFor(buildKqScenarioPath(seed, history, tags, ["mites"]));
      for (const tag of tags) {
        expect(situations.some((situation) => situation.tags.includes(tag)), `${tag}, seed ${seed}`).toBe(true);
      }
      expect(situations.filter((situation) => situation.pest).every((situation) => situation.pest === "mites")).toBe(true);
    }
  });

  it("allows a necessary pest repeat instead of choosing a fresh pest unsupported by the player's PBI", () => {
    for (const pest of ["aphids", "mites", "thrips"] as const) {
      const compatibleHistory = KQ_SITUATIONS.filter((situation) => situation.pest === pest).map((situation) => situation.code);
      for (let seed = 0; seed < 24; seed++) {
        const situations = situationsFor(buildKqScenarioPath(seed, compatibleHistory, ["pest"], [pest]));
        const pestSituations = situations.filter((situation) => situation.pest);
        expect(pestSituations.length).toBeGreaterThan(0);
        expect(pestSituations.every((situation) => situation.pest === pest)).toBe(true);
      }
    }
  });

  it("keeps theft as an intentional recency exception with twice the risk at home", () => {
    const harvestIndex = KQ_STAGES.indexOf("Récolte");
    const theft = KQ_SITUATIONS.find((situation) => situation.incident === "crop-theft")!;
    const history = [theft.code, ...catalogueHistory.flat()];
    const sampleSize = 10000;
    let homeThefts = 0;
    let externalThefts = 0;

    for (let seed = 0; seed < sampleSize; seed++) {
      const home = buildKqScenarioPath(seed, history, [], [], "home");
      const external = buildKqScenarioPath(seed, history, [], [], "external");
      expect(home[harvestIndex] === theft.code).toBe(buildKqScenarioPath(seed, [], [], [], "home")[harvestIndex] === theft.code);
      expect(external[harvestIndex] === theft.code).toBe(buildKqScenarioPath(seed, [], [], [], "external")[harvestIndex] === theft.code);
      if (home[harvestIndex] === theft.code) homeThefts++;
      if (external[harvestIndex] === theft.code) {
        externalThefts++;
        expect(home[harvestIndex]).toBe(theft.code);
      }
      expect(home.filter((_, index) => index !== harvestIndex)).toEqual(external.filter((_, index) => index !== harvestIndex));
      if (home[harvestIndex] !== theft.code) expect(home[harvestIndex]).toBe(external[harvestIndex]);
    }

    expect(Math.abs(externalThefts / sampleSize - 1 / stagePools[harvestIndex].length)).toBeLessThan(0.015);
    expect(homeThefts / externalThefts).toBeGreaterThan(1.9);
    expect(homeThefts / externalThefts).toBeLessThan(2.1);
  });

  it("rotates non-theft harvest situations by recency when the independent theft draw is safe", () => {
    const harvestIndex = KQ_STAGES.indexOf("Récolte");
    const safePool = stagePools[harvestIndex].filter((situation) => situation.incident !== "crop-theft");
    const history = catalogueHistory.flat();
    const oldestSafe = safePool.reduce((oldest, situation) => history.indexOf(situation.code) > history.indexOf(oldest.code) ? situation : oldest);
    let safeDraws = 0;

    for (let seed = 0; seed < 100; seed++) {
      for (const domiciliation of ["home", "external"] as const) {
        const path = buildKqScenarioPath(seed, history, [], [], domiciliation);
        const harvest = KQ_SITUATIONS.find((situation) => situation.code === path[harvestIndex])!;
        if (harvest.incident === "crop-theft") continue;
        safeDraws++;
        expect(harvest.code).toBe(oldestSafe.code);
      }
    }
    expect(safeDraws).toBeGreaterThan(0);
  });

  it("preserves an archived culture's stored path through save loading and play", () => {
    const legacyPath = ["SIT-031", "SIT-033", "SIT-014", "SIT-024", "SIT-027", "SIT-038"];
    const oldState = { ...startKqGame(42), situationCodes: legacyPath };
    // An archived save predates both the domicile and the current rules marker.
    delete oldState.domiciliation;
    delete oldState.rulesVersion;
    const integrity = createKqIntegrityCode(oldState);
    let state = parseKqGameSave(encodeKqSave(oldState)) as KqGameState;
    expect(state).not.toBeNull();
    expect(state.situationCodes).toEqual(legacyPath);
    expect(createKqIntegrityCode(state)).toBe(integrity);

    for (let stageIndex = 0; stageIndex < KQ_STAGES.length; stageIndex++) {
      expect(getKqSituation(state).code).toBe(legacyPath[stageIndex]);
      state = advanceKqStage(resolveKqStage(rollKqDice(state)));
      expect(state.situationCodes).toEqual(legacyPath);
      expect(parseKqGameSave(encodeKqSave(state))?.situationCodes).toEqual(legacyPath);
    }
    expect(state.phase).toBe("complete");
  });
});
