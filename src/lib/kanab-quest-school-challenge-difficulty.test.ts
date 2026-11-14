import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HISTORY_QUESTIONS } from "./kanab-quest-school-history";
import { BOTANY_QUESTIONS } from "./kanab-quest-school-botany";
import { TERPENE_QUESTIONS } from "./kanab-quest-school-terpenes";
import { CANNABINOID_QUESTIONS } from "./kanab-quest-school-cannabinoids";
import { CULTIVATION_QUESTIONS } from "./kanab-quest-school-cultivation";
import { HEALTH_QUESTIONS } from "./kanab-quest-school-health";
import { SOIL_QUESTIONS } from "./kanab-quest-school-soil";
import { PRODUCTS_QUESTIONS } from "./kanab-quest-school-products";
import { HARVEST_QUESTIONS } from "./kanab-quest-school-harvest";
import {
  KQ_SCHOOL_CHALLENGE_DIFFICULTY as difficulty,
  KQ_SCHOOL_CHALLENGE_LEVELS as levels,
} from "./kanab-quest-school-challenge-difficulty";

const banks = {
  history: HISTORY_QUESTIONS,
  botany: BOTANY_QUESTIONS,
  terpenes: TERPENE_QUESTIONS,
  cannabinoids: CANNABINOID_QUESTIONS,
  cultivation: CULTIVATION_QUESTIONS,
  health: HEALTH_QUESTIONS,
  soil: SOIL_QUESTIONS,
  products: PRODUCTS_QUESTIONS,
  harvest: HARVEST_QUESTIONS,
};
const questions = Object.values(banks).flat();
const documentation = JSON.parse(readFileSync("docs/bete-de-concours/school-challenge-difficulty.json", "utf8")) as {
  counts: {
    total: number;
    byLevel: Record<number, number>;
    byBank: Record<string, { total: number; byLevel: Record<number, number> }>;
  };
  boundaryExamples: { questionId: string; level: number; rationale: string }[];
  corpusFingerprint: { sha256ByBank: Record<string, string> };
};

describe("school challenge editorial difficulty", () => {
  it("covers exactly the 336 existing questions, with no missing or invented IDs", () => {
    const ids = questions.map(question => question.id);
    expect(ids).toHaveLength(336);
    expect(new Set(ids).size).toBe(336);
    expect(Object.keys(difficulty).sort()).toEqual([...ids].sort());
    expect(Object.isFrozen(difficulty)).toBe(true);
  });

  it("offers four ordered levels with enough questions and all nine themes", () => {
    expect(levels.map(level => level.id)).toEqual([1, 2, 3, 4]);
    expect(levels.map(level => level.label)).toEqual(["Découverte", "Compréhension", "Comparaison", "Raisonnement"]);
    expect([...new Set(Object.values(difficulty))].sort()).toEqual([1, 2, 3, 4]);
    for (const level of levels) {
      expect(questions.filter(question => difficulty[question.id] === level.id).length).toBeGreaterThanOrEqual(5);
      for (const [bank, bankQuestions] of Object.entries(banks)) {
        expect(bankQuestions.some(question => difficulty[question.id] === level.id), `${bank}: level ${level.id}`).toBe(true);
      }
    }
  });

  it("keeps the documented totals and boundary examples tied to the real grid", () => {
    expect(documentation.counts.total).toBe(questions.length);
    for (const level of levels) {
      expect(documentation.counts.byLevel[level.id]).toBe(questions.filter(question => difficulty[question.id] === level.id).length);
    }
    for (const [bank, bankQuestions] of Object.entries(banks)) {
      expect(documentation.counts.byBank[bank].total).toBe(bankQuestions.length);
      for (const level of levels) {
        expect(documentation.counts.byBank[bank].byLevel[level.id]).toBe(bankQuestions.filter(question => difficulty[question.id] === level.id).length);
      }
    }
    for (const example of documentation.boundaryExamples) {
      expect(difficulty[example.questionId], example.questionId).toBe(example.level);
      expect(example.rationale.length).toBeGreaterThan(30);
    }
  });

  it("requires an editorial review when a question or its alternatives change", () => {
    for (const [bank, bankQuestions] of Object.entries(banks)) {
      const inventory = bankQuestions.map(question => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options.map(option => ({ id: option.id, text: option.text })),
      }));
      const fingerprint = createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
      expect(fingerprint, `${bank}: review levels after content changes`).toBe(documentation.corpusFingerprint.sha256ByBank[bank]);
    }
  });
});
