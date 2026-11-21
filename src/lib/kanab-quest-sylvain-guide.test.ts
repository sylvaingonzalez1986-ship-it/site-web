import { describe, expect, it } from "vitest";
import {
  getSylvainGuide,
  readSylvainState,
  sylvainStorageKey,
  updateSylvainGuide,
  writeSylvainState,
  type SylvainLessonId,
  type SylvainObservations,
  type SylvainState,
} from "./kanab-quest-sylvain-guide";

function observations(achieved: string[] = [], relevant: string[] = [], hints: Record<string, string> = {}): SylvainObservations {
  return { achieved, relevant, hints };
}

const invited = () => readSylvainState(null, "owner");
const started = () => updateSylvainGuide(invited(), { type: "start" });
const observe = (state: SylvainState, ...achieved: SylvainLessonId[]) => updateSylvainGuide(state, { type: "observe", observations: observations(achieved) });
const status = (state: SylvainState, id: SylvainLessonId, seen?: SylvainObservations) =>
  getSylvainGuide(state, seen).lessons.find(entry => entry.lesson.id === id)?.status;

describe("parcours tycoon de Loïc", () => {
  it("attend l’accord avant de proposer une étape ou d’enregistrer une progression", () => {
    const state = invited();
    expect(getSylvainGuide(state).current).toBeNull();
    expect(observe(state, "warehouse", "launch")).toBe(state);
    expect(getSylvainGuide(started()).current?.id).toBe("warehouse");
  });

  it("suit les six étapes avec leurs observations propres", () => {
    let state = started();
    const order = ["warehouse", "install", "prepare", "supplies", "launch", "next"] as const;
    for (const id of order) {
      expect(getSylvainGuide(state).current?.id).toBe(id);
      expect(status(state, id)).toBe("available");
      state = observe(state, id);
      expect(status(state, id)).toBe("completed");
    }
    expect(getSylvainGuide(state).initialComplete).toBe(true);
    expect(getSylvainGuide(state).current).toBeNull();
  });

  it("retrouve une réussite antérieure sans attribuer les lectures du récapitulatif et de l’échéance", () => {
    const state = observe(started(), "prepare", "launch");
    expect(getSylvainGuide(state).current?.id).toBe("next");
    expect(getSylvainGuide(state).initialComplete).toBe(false);
    expect(status(state, "warehouse")).toBe("available");
    expect(status(state, "supplies")).toBe("available");
    expect(status(state, "next")).toBe("available");

    const followed = observe(state, "next");
    expect(getSylvainGuide(followed).initialComplete).toBe(true);
    expect(getSylvainGuide(followed).current).toBeNull();
    expect(status(followed, "supplies")).toBe("available");
  });

  it("ne confond pas les cibles d’une action avec sa validation et remplace l’aide selon l’obstacle", () => {
    const state = observe(started(), "warehouse");
    const busy = observations([], ["install"], { install: "Le devis est en cours de calcul." });
    expect(updateSylvainGuide(state, { type: "observe", observations: busy })).toBe(state);
    expect(getSylvainGuide(state, busy)).toMatchObject({ current: { id: "install" }, hint: "Le devis est en cours de calcul." });
    expect(getSylvainGuide(state, observations([], ["install"], { install: "Vérifie le solde affiché." })).hint).toBe("Vérifie le solde affiché.");
    expect(getSylvainGuide(state).hint).toBeNull();
  });

  it("respecte le contexte, les initiatives libres et la priorité du premier semis", () => {
    const context = observations([], ["cleaning"]);
    const state = observe(started(), "warehouse");
    expect(getSylvainGuide(state, context).current?.id).toBe("install");
    expect(status(state, "cleaning", context)).toBe("available");
    expect(status(state, "irrigation", context)).toBe("later");
    const voluntarilyVisited = observe(state, "cleaning");
    expect(status(voluntarilyVisited, "cleaning")).toBe("completed");

    const autonomous = observe(voluntarilyVisited, "launch", "next");
    const irrigation = observations([], ["irrigation"]);
    expect(getSylvainGuide(autonomous, irrigation).current?.id).toBe("irrigation");
    expect(status(autonomous, "irrigation")).toBe("available");
    const selected = updateSylvainGuide(autonomous, { type: "select", id: "irrigation", observations: irrigation });
    expect(getSylvainGuide(selected).current?.id).toBe("irrigation");
    expect(observe(selected, "irrigation").selected).toBeNull();
    expect(getSylvainGuide(autonomous).current).toBeNull();
  });

  it("renvoie vers une zone ou une variété devenue indisponible sans retirer les étapes acquises", () => {
    const state = observe(started(), "warehouse", "install", "prepare", "supplies");
    const lostZone: SylvainObservations = { ...observations(), recovery: "install" };
    const lostBuddie: SylvainObservations = { ...observations(), recovery: "prepare" };

    expect(getSylvainGuide(state, lostZone)).toMatchObject({ current: { id: "install" }, recovery: true, replay: false });
    expect(getSylvainGuide(state, lostBuddie)).toMatchObject({ current: { id: "prepare" }, recovery: true, replay: false });
    expect(getSylvainGuide(state, lostZone).hint).toMatch(/zone éclairée/);
    expect(status(state, "install", lostZone)).toBe("completed");
    expect(updateSylvainGuide(state, { type: "skip", observations: lostZone })).toBe(state);
    expect(getSylvainGuide(state).current?.id).toBe("launch");
    expect(getSylvainGuide(observe(state, "launch"), lostBuddie)).toMatchObject({ current: { id: "next" }, recovery: false });
    expect(getSylvainGuide(updateSylvainGuide(state, { type: "skip" }), lostZone)).toMatchObject({ current: null, recovery: false });

    const replay = updateSylvainGuide(state, { type: "select", id: "install", observations: lostZone });
    expect(getSylvainGuide(replay, lostZone)).toMatchObject({ current: { id: "install" }, recovery: false, replay: true });
  });

  it("passe une leçon disponible et relit les étapes résolues sans effet", () => {
    const state = observe(started(), "warehouse");
    const skipped = updateSylvainGuide(state, { type: "skip" });
    expect(status(skipped, "install")).toBe("skipped");
    expect(getSylvainGuide(skipped).current?.id).toBe("prepare");
    expect(updateSylvainGuide(skipped, { type: "select", id: "air", observations: observations() })).toBe(skipped);
    for (const id of ["install", "warehouse"] as const) {
      const replay = updateSylvainGuide(skipped, { type: "select", id, observations: observations() });
      expect(getSylvainGuide(replay)).toMatchObject({ current: { id }, replay: true });
      expect(getSylvainGuide(replay, observations([], [], { [id]: "Le registre est en cours de chargement." })).hint).toBe("Le registre est en cours de chargement.");
      expect(updateSylvainGuide(replay, { type: "skip" })).toBe(replay);
      expect(observe(replay, "prepare", "install")).toBe(replay);
      expect(updateSylvainGuide(replay, { type: "follow" })).toEqual(skipped);
    }
    expect(status(observe(skipped, "install"), "install")).toBe("completed");
    const autonomous = observe(skipped, "launch", "next");
    const context = observations([], ["trim"]);
    expect(status(updateSylvainGuide(autonomous, { type: "skip", observations: context }), "trim")).toBe("skipped");
  });

  it("conserve le choix et la progression lorsque le joueur met le guide en pause ou le désactive", () => {
    const context = observations([], ["coverage"]);
    const state = observe(started(), "warehouse");
    const selected = updateSylvainGuide(state, { type: "select", id: "coverage", observations: context });
    for (const type of ["pause", "off"] as const) {
      const inactive = updateSylvainGuide(selected, { type });
      expect(getSylvainGuide(inactive, context).current).toBeNull();
      expect(observe(inactive, "install")).toBe(inactive);
      expect(updateSylvainGuide(inactive, { type: "resume" })).toEqual(selected);
    }
    const dismissed = updateSylvainGuide(invited(), { type: "off" });
    expect(getSylvainGuide(dismissed).current).toBeNull();
    expect(updateSylvainGuide(dismissed, { type: "resume" })).toEqual(started());
  });

  it("isole la progression par compte et ignore un ancien format ou un stockage inaccessible", () => {
    const items = new Map<string, string>();
    const storage = { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); } };
    const paused = updateSylvainGuide(observe(started(), "warehouse"), { type: "pause" });
    expect(writeSylvainState(storage, "owner/1", paused)).toBe(true);
    expect(readSylvainState(storage, "owner/1")).toEqual(paused);
    expect(readSylvainState(storage, "owner/2")).toEqual(invited());
    expect(readSylvainState(storage, null)).toEqual(invited());
    expect(sylvainStorageKey("owner/1")).toContain("v1:owner%2F1");
    items.set("kq:sylvain-guide:v0:other", JSON.stringify(paused));
    expect(readSylvainState(storage, "other")).toEqual(invited());
    items.set(sylvainStorageKey("other"), "invalid JSON");
    expect(readSylvainState(storage, "other")).toEqual(invited());
    const inaccessible = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readSylvainState(inaccessible, "owner/1")).toEqual(invited());
    expect(writeSylvainState(inaccessible, "owner/1", paused)).toBe(false);
  });

  it("distingue les destinations des extractions de produits et de la ventilation", () => {
    const entries = getSylvainGuide(started()).lessons;
    const air = entries.find(({ lesson }) => lesson.id === "air")?.lesson;
    const processing = entries.find(({ lesson }) => lesson.id === "processing")?.lesson;
    expect(air?.destination).toEqual({ view: "workshop", section: "equipment" });
    expect(processing?.destination).toEqual({ view: "workshop", section: "processing" });
  });
});
