import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FARM_GUIDE_CHAPTERS, getFarmGuideChapter } from "./kanab-quest-farm-guide";
import { FARM_GUIDE_STEPS, FARM_GUIDE_WELCOME } from "./kanab-quest-tutorial-content";

describe("catalogue du tutoriel", () => {
  it("donne une action, une preuve et une issue de reprise à chaque objectif", () => {
    const ids = FARM_GUIDE_STEPS.map(step => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of FARM_GUIDE_STEPS) {
      expect(FARM_GUIDE_CHAPTERS.some(chapter => chapter.id === step.chapter)).toBe(true);
      for (const field of [step.title, step.line, step.target, step.action, step.success, step.cost, step.recovery, step.reaction]) {
        expect(field.trim().length).toBeGreaterThan(5);
      }
      for (const prerequisite of step.prerequisites) expect(ids).toContain(prerequisite);
    }
  });

  it("relie chaque objectif à une matrice sourcée sans confondre découverte et pratique", () => {
    const matrix = JSON.parse(readFileSync(resolve("docs/bete-de-concours/tutorial-coverage.json"), "utf8")) as {
      sourceIndex: Record<string, string>;
      coverage: { id: string; source: string[]; evidence: { kind: string; criterion: string } }[];
    };
    expect(matrix.coverage.map(row => row.id)).toEqual(FARM_GUIDE_STEPS.map(step => step.id));
    for (const step of FARM_GUIDE_STEPS) {
      const row = matrix.coverage.find(item => item.id === step.id)!;
      expect(row.evidence.kind).toBe(step.objectiveKind === "action" ? "server_result" : "useful_observation");
      expect(row.evidence.criterion).toBe(step.success);
      expect(row.source.length).toBeGreaterThan(0);
      for (const source of row.source) expect(existsSync(resolve(matrix.sourceIndex[source]))).toBe(true);
    }
  });

  it("permet de découvrir les chapitres sans imposer une dépense préalable", () => {
    for (const step of FARM_GUIDE_STEPS.filter(item => item.objectiveKind === "visit")) {
      expect(step.prerequisites).toEqual([]);
    }
    expect(FARM_GUIDE_STEPS.find(step => step.id === "pack-open")?.cost).toContain("aucun achat");
    expect(FARM_GUIDE_STEPS.find(step => step.id === "school-answer")?.success).toContain("bonne réponse n’est pas exigée");
  });

  it("n’invente aucun cycle de prérequis et conserve les anciennes identités", () => {
    const byId = new Map<string, (typeof FARM_GUIDE_STEPS)[number]>(FARM_GUIDE_STEPS.map(step => [step.id, step]));
    const follow = (id: string, ancestors: string[]) => {
      expect(ancestors).not.toContain(id);
      for (const predecessor of byId.get(id)?.prerequisites ?? []) follow(predecessor, [...ancestors, id]);
    };
    for (const step of FARM_GUIDE_STEPS) follow(step.id, []);
    for (const id of ["welcome", "zone", "assign", "launch", "roll", "resolve", "harvest", "store", "trim", "cure", "jury", "sale", "staff-payroll", "missions"]) {
      expect(byId.has(id)).toBe(true);
    }
  });

  it("distingue pratique confirmée et découverte de conditions", () => {
    for (const id of ["sale", "jury", "pack-open", "card-play", "school-answer"]) {
      expect(FARM_GUIDE_STEPS.find(step => step.id === id)?.objectiveKind).toBe("action");
    }
    for (const id of ["bank", "processing", "school-tournament", "staff-candidate"]) {
      expect(FARM_GUIDE_STEPS.find(step => step.id === id)?.objectiveKind).toBe("visit");
    }
    expect(FARM_GUIDE_WELCOME.firstAction).toContain("Choisis un bâtiment");
    expect(FARM_GUIDE_STEPS.find(step => step.id === "welcome")?.success).toContain("Navigation demandée par le joueur");
  });

  it("résout les nouvelles destinations et garde les liens extérieurs réels", () => {
    for (const chapter of FARM_GUIDE_CHAPTERS) expect(getFarmGuideChapter(chapter).id).toBe(chapter.id);
    expect(getFarmGuideChapter({ view: "workshop", section: "processing" }).id).toBe("processing");
    const links = FARM_GUIDE_CHAPTERS.filter(chapter => "href" in chapter).map(chapter => "href" in chapter ? chapter.href : "");
    expect(links).toEqual(["/arene/carnet/regular", "/arene", "/arene?vue=classement"]);
  });
});
