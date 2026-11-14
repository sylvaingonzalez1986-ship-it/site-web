import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getKqBuddieFlavors } from "./kanab-quest-buddie-flavors";
import { getKqBuddieVariety } from "./kanab-quest-buddie-varieties";
import { KQ_SCHOOL_ANSWERS } from "./kanab-quest-school-answers";
import { KQ_SCHOOL_LESSON_VISUALS } from "./kanab-quest-school-visuals";
import {
  KQ_SCHOOL_BUDDY_LINKS, KQ_SCHOOL_CONTENT_VERSION, KQ_SCHOOL_COURSES,
  KQ_SCHOOL_CROSSWORDS, KQ_SCHOOL_MATCHING_SETS, KQ_SCHOOL_MODULES,
  KQ_SCHOOL_QUESTIONS, KQ_SCHOOL_SOURCES, KQ_SCHOOL_TIMELINE,
  getKqSchoolBuddieLessons, getKqSchoolCourse, getKqSchoolModule, normalizeKqSchoolWord,
} from "./kanab-quest-school-content";

const ids = ["plant", "molecules", "profiles", "genetics", "history", "uses", "evidence", "biodiversity", "law", "prevention"];
const sourceIds = new Set(KQ_SCHOOL_SOURCES.map(source => source.id));

describe("school authored content", () => {
  it("covers every revision anchor with an authored visual summary while retaining the full lesson", () => {
    expect(KQ_SCHOOL_LESSON_VISUALS.map(item => item.courseId)).toEqual(ids);
    for (const visual of KQ_SCHOOL_LESSON_VISUALS) {
      const course = getKqSchoolCourse(visual.courseId)!;
      expect(visual.steps.map(step => step.sectionId)).toEqual(course.sections.map(section => section.id));
      expect(visual.image).toBe(`/placard/school/course-${course.id}-v1.webp`);
      expect(visual.imageAlt.length).toBeGreaterThan(40);
      for (const step of visual.steps) {
        expect(step.points).toHaveLength(3);
        expect(step.points.every(point => point.length > 20 && point.length < 160)).toBe(true);
        expect(step.observe.length).toBeGreaterThan(20);
      }
    }
  });

  it("contains exactly ten stable reward identities and ten questions each with one server key", () => {
    expect(KQ_SCHOOL_MODULES.map(quiz => quiz.id)).toEqual(ids);
    expect(KQ_SCHOOL_COURSES.map(course => course.id)).toEqual(ids);
    expect(KQ_SCHOOL_QUESTIONS).toHaveLength(100);
    expect(Object.keys(KQ_SCHOOL_ANSWERS).sort()).toEqual(KQ_SCHOOL_QUESTIONS.map(question => question.id).sort());
    expect(new Set(KQ_SCHOOL_QUESTIONS.map(question => question.prompt)).size).toBe(100);
    for (const quiz of KQ_SCHOOL_MODULES) {
      expect(quiz.questions).toHaveLength(10);
      expect(quiz.version).toBe(KQ_SCHOOL_CONTENT_VERSION);
      expect(getKqSchoolModule(quiz.id)).toBe(quiz);
      for (const question of quiz.questions) {
        expect(question.id).toMatch(new RegExp(`^${quiz.id}-q(0[1-9]|10)$`));
        expect(question.lessonId).toBe(quiz.id);
        expect(question.options.map(option => option.id).sort()).toEqual(["a", "b", "c", "d"]);
        expect(new Set(question.options.map(option => option.text)).size).toBe(4);
        const answer = KQ_SCHOOL_ANSWERS[question.id];
        expect(question.options.filter(option => option.id === answer.correctOptionId)).toHaveLength(1);
        expect(answer.explanation.length).toBeGreaterThan(35);
        expect(question.sources.length).toBeGreaterThan(0);
        expect(question.sources.every(source => sourceIds.has(source.id))).toBe(true);
        expect(getKqSchoolCourse(question.lessonId)?.sections.some(section => section.id === question.sectionId)).toBe(true);
      }
    }
    const answerCounts = Object.values(KQ_SCHOOL_ANSWERS).reduce<Record<string, number>>((counts, answer) => {
      counts[answer.correctOptionId] = (counts[answer.correctOptionId] ?? 0) + 1;
      return counts;
    }, {});
    for (const count of Object.values(answerCounts)) expect(count).toBeGreaterThanOrEqual(20);
  });

  it("keeps reward answers and explanations out of all public module projections", () => {
    for (const question of KQ_SCHOOL_QUESTIONS) {
      expect(question).not.toHaveProperty("correctOptionId");
      expect(question).not.toHaveProperty("explanation");
      expect(question.options.every(option => Object.keys(option).sort().join(",") === "id,text")).toBe(true);
    }
    const publicSource = readFileSync("src/lib/kanab-quest-school-content.ts", "utf8");
    expect(publicSource).not.toContain("kanab-quest-school-answers");
    expect(publicSource).not.toContain("correctOptionId");
    expect(readFileSync("src/lib/kanab-quest-school-answers.ts", "utf8")).toMatch(/^import "server-only";/);
  });

  it("provides substantial guided lessons, revision anchors and verified source metadata", () => {
    const workshops = new Set(["timeline-history", ...KQ_SCHOOL_CROSSWORDS.map(x => x.id), ...KQ_SCHOOL_MATCHING_SETS.map(x => x.id)]);
    for (const course of KQ_SCHOOL_COURSES) {
      const prose = [...course.sections.flatMap(section => section.paragraphs), course.observation, course.exercise].join(" ");
      expect(prose.split(/\s+/).length, course.id).toBeGreaterThanOrEqual(350);
      expect(course.sections).toHaveLength(4);
      expect(new Set(course.sections.map(section => section.id)).size).toBe(4);
      expect(course.readingMinutes).toBeGreaterThanOrEqual(3);
      expect(course.readingMinutes).toBeLessThanOrEqual(5);
      expect(course.sources.length).toBeGreaterThan(0);
      expect(course.workshopIds.every(id => workshops.has(id))).toBe(true);
      expect(course.quizId).toBe(course.id);
    }
    expect(new Set(KQ_SCHOOL_SOURCES.map(source => source.id)).size).toBe(KQ_SCHOOL_SOURCES.length);
    for (const source of KQ_SCHOOL_SOURCES) {
      expect(source.verifiedAt).toBe("2026-11-11");
      expect(source.organization.length).toBeGreaterThan(2);
      expect(source.title.length).toBeGreaterThan(3);
      expect(source.url).toMatch(/^(https:\/\/|\/arene\/placard\?)/);
    }
  });

  it("maps ten real Buddies to readable course content and exact existing descriptions", () => {
    expect(KQ_SCHOOL_BUDDY_LINKS).toHaveLength(10);
    for (const link of KQ_SCHOOL_BUDDY_LINKS) {
      expect(getKqBuddieVariety(link.buddyCode)).toBeDefined();
      expect(getKqSchoolBuddieLessons(link.buddyCode).map(item => item.courseId)).toEqual(link.courseIds);
      for (const questionId of link.questionIds) {
        const question = KQ_SCHOOL_QUESTIONS.find(item => item.id === questionId)!;
        expect(question.buddyCodes).toContain(link.buddyCode);
        expect(link.courseIds).toContain(question.lessonId);
        expect(getKqSchoolCourse(question.lessonId)?.buddyCodes).toContain(link.buddyCode);
      }
    }
    const aromaQuestions = ["molecules-q07", "molecules-q08", "profiles-q07", "profiles-q08", "evidence-q07", "biodiversity-q08", "prevention-q08"];
    for (const id of aromaQuestions) {
      const question = KQ_SCHOOL_QUESTIONS.find(item => item.id === id)!;
      const flavors = getKqBuddieFlavors(question.buddyCodes![0]);
      const expected = flavors.map(flavor => flavor.label.toLocaleLowerCase("fr")).join(" et ");
      const actual = question.options.find(option => option.id === KQ_SCHOOL_ANSWERS[id].correctOptionId)!.text;
      expect(actual.toLocaleLowerCase("fr"), id).toBe(expected);
    }
    expect(getKqBuddieVariety("HH2026-001")?.identity).toBe("fiction");
    expect(getKqBuddieVariety("HH2026-003")?.lineage).toContain("Reina Madre × NYCD");
    expect(getKqBuddieVariety("HH2026-002")?.origin).toContain("Colorado");
  });
});

describe("playable workshop data", () => {
  it("normalizes accents consistently and preserves display spellings", () => {
    expect(normalizeKqSchoolWord("Chènevotte")).toBe("CHENEVOTTE");
    expect(normalizeKqSchoolWord("  terpène ")).toBe("TERPENE");
    expect(normalizeKqSchoolWord("Cœur")).toBe("COEUR");
  });

  for (const crossword of KQ_SCHOOL_CROSSWORDS) {
    it(`${crossword.id} has compatible intersections, connected words and no accidental words`, () => {
      expect(crossword.entries.length).toBeGreaterThanOrEqual(6);
      expect(crossword.entries.length).toBeLessThanOrEqual(10);
      const cells = new Map<string, { char: string; entries: number[] }>();
      const startNumbers = new Map<string, number>();
      crossword.entries.forEach((entry, index) => {
        expect(normalizeKqSchoolWord(entry.displayAnswer)).toBe(entry.answer);
        expect(entry.sourceIds.every(id => sourceIds.has(id))).toBe(true);
        const start = `${entry.row},${entry.col}`;
        if (startNumbers.has(start)) expect(startNumbers.get(start)).toBe(entry.number);
        startNumbers.set(start, entry.number);
        [...entry.answer].forEach((char, offset) => {
          const row = entry.row + (entry.direction === "down" ? offset : 0);
          const col = entry.col + (entry.direction === "across" ? offset : 0);
          expect(row).toBeGreaterThanOrEqual(0); expect(row).toBeLessThan(crossword.height);
          expect(col).toBeGreaterThanOrEqual(0); expect(col).toBeLessThan(crossword.width);
          const key = `${row},${col}`;
          const existing = cells.get(key);
          if (existing) {
            expect(existing.char, `${crossword.id} ${key}`).toBe(char);
            expect(existing.entries).toHaveLength(1);
            expect(crossword.entries[existing.entries[0]].direction).not.toBe(entry.direction);
            existing.entries.push(index);
          } else cells.set(key, { char, entries: [index] });
        });
      });
      expect([...startNumbers.values()]).toEqual([...new Set(startNumbers.values())].sort((a, b) => a - b));
      const reached = new Set([0]);
      for (let iteration = 0; iteration < crossword.entries.length; iteration++) {
        for (const cell of cells.values()) if (cell.entries.some(index => reached.has(index))) cell.entries.forEach(index => reached.add(index));
      }
      expect(reached.size).toBe(crossword.entries.length);
      const runs: string[] = [];
      for (const [position] of cells) {
        const [row, col] = position.split(",").map(Number);
        for (const direction of ["across", "down"] as const) {
          const dr = direction === "down" ? 1 : 0, dc = 1 - dr;
          if (cells.has(`${row - dr},${col - dc}`)) continue;
          let word = "", offset = 0;
          while (cells.has(`${row + dr * offset},${col + dc * offset}`)) {
            word += cells.get(`${row + dr * offset},${col + dc * offset}`)!.char;
            offset++;
          }
          if (word.length > 1) runs.push(`${row},${col},${direction},${word}`);
        }
      }
      expect(runs.sort()).toEqual(crossword.entries.map(entry => `${entry.row},${entry.col},${entry.direction},${entry.answer}`).sort());
    });
  }

  it("ranks six sourced events chronologically and flags the ancient date as approximate", () => {
    expect(KQ_SCHOOL_TIMELINE).toHaveLength(6);
    expect(KQ_SCHOOL_TIMELINE.map(event => event.year)).toEqual([-500, 1753, 1964, 1990, 1992, 2022]);
    expect(KQ_SCHOOL_TIMELINE[0].dateLabel).toMatch(/^Vers /);
    expect(new Set(KQ_SCHOOL_TIMELINE.map(event => event.id)).size).toBe(6);
    for (const event of KQ_SCHOOL_TIMELINE) {
      expect(event.sourceIds.every(id => sourceIds.has(id))).toBe(true);
      expect(getKqSchoolCourse(event.lessonId)).toBeDefined();
      expect(event.summary.length).toBeGreaterThan(50);
    }
  });

  it("provides three reusable matching series with distinct choices and feedback", () => {
    expect(KQ_SCHOOL_MATCHING_SETS).toHaveLength(3);
    for (const set of KQ_SCHOOL_MATCHING_SETS) {
      expect(set.pairs.length).toBeGreaterThanOrEqual(4);
      expect(new Set(set.pairs.map(pair => pair.id)).size).toBe(set.pairs.length);
      expect(new Set(set.pairs.map(pair => pair.left)).size).toBe(set.pairs.length);
      expect(new Set(set.pairs.map(pair => pair.right)).size).toBe(set.pairs.length);
      for (const pair of set.pairs) {
        expect(pair.explanation.length).toBeGreaterThan(40);
        expect(pair.sourceIds.every(id => sourceIds.has(id))).toBe(true);
      }
    }
  });
});
