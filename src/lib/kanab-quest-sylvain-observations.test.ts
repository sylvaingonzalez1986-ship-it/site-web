import { describe, expect, it } from "vitest";
import { SYLVAIN_LESSONS } from "./kanab-quest-sylvain-guide";
import { getLoicHistoricalAchievements, readSylvainObservations } from "./kanab-quest-sylvain-observations";

function observedMarkup(matches: Record<string, Record<string, string>> = {}) {
  const root = {
    querySelectorAll(selector: string) {
      return Object.hasOwn(matches, selector) ? [{
        matches: () => false,
        parentElement: null,
        ownerDocument: { defaultView: null },
        getAttribute: (attribute: string) => matches[selector][attribute] ?? null,
      }] : [];
    },
  };
  return readSylvainObservations(root as unknown as ParentNode);
}

describe("Conseils de Loïc selon les commandes disponibles", () => {
  it("privilégie le pack à ouvrir et décrit le retour à la préparation", () => {
    const open = '[data-sylvain-target~="prepare-pack-open"]:not(:disabled):not([aria-disabled=true])';
    const welcome = '[data-sylvain-target~="prepare-pack-welcome"]:not(:disabled):not([aria-disabled=true])';
    const offered = observedMarkup({ [welcome]: {} });
    const ready = observedMarkup({ [welcome]: {}, [open]: {} });
    expect(offered.hints.prepare).toContain("Récupère ton pack de bienvenue offert");
    expect(ready.hints.prepare).toContain("choisis Terminer, puis reviens à ta préparation");
    expect(ready.achieved).not.toContain("prepare");
    const targets = SYLVAIN_LESSONS.find(lesson => lesson.id === "prepare")?.targets;
    expect(targets?.filter(target => target.startsWith("prepare-pack-"))).toEqual(["prepare-pack-open", "prepare-pack-welcome"]);
    expect(observedMarkup().hints.prepare).toBeUndefined();
  });

  it.each([["vacuum", "L’aspiration"], ["mop", "Le lavage"]])("permet de revenir à l’échéance du passage %s", (step, label) => {
    const observations = observedMarkup({
      "[data-sylvain-cleaning-pending]": { "data-sylvain-cleaning-pending": step },
      "[data-warehouse-clean-step]:enabled, [data-sylvain-cleaning-pending]": {},
      "[data-sylvain-cleaning-renew=true]": {},
    });
    expect(observations.hints.cleaning).toBe(`${label} est en cours. Tu peux quitter l’entrepôt et revenir à l’échéance affichée.`);
    expect(observations.relevant).toContain("cleaning");
    expect(observations.achieved).not.toContain("cleaning");
  });
});

describe("Loïc’s historical evidence", () => {
  it("recovers the initial work from a run confirmed by the game", () => {
    expect(getLoicHistoricalAchievements({
      activeRun: null,
      activeRuns: [{ runId: "run-1", state: { phase: "prepare" } }],
    })).toEqual(["install", "prepare", "launch"]);
  });

  it("uses a flower linked to its official culture when no run is active", () => {
    expect(getLoicHistoricalAchievements({
      activeRun: null,
      activeRuns: [],
      flowers: [{ id: "flower-1", runId: "finished-run-1", status: "burned" }],
    })).toEqual(["install", "prepare", "launch", "harvest"]);
  });

  it("ignores erroneous and incomplete responses", () => {
    expect(getLoicHistoricalAchievements(null)).toEqual([]);
    expect(getLoicHistoricalAchievements({ error: "Réessayer", flowers: [{ id: "flower-1", runId: "run-1" }] })).toEqual([]);
    expect(getLoicHistoricalAchievements({ activeRun: { runId: "run-1" }, flowers: [{ id: "flower-1" }] })).toEqual([]);
    expect(getLoicHistoricalAchievements({ activeRuns: [], activeRun: null, flowers: [] })).toEqual([]);
  });
});
