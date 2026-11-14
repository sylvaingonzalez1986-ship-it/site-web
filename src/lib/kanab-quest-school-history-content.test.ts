import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getKqBuddieVariety } from "./kanab-quest-buddie-varieties";
import { getKqSchoolAnswer, KQ_SCHOOL_HISTORY_ANSWERS } from "./kanab-quest-school-answers";
import {
  HISTORY_CHAPTERS, HISTORY_EVENTS, HISTORY_LESSONS, HISTORY_LESSON_ALIASES,
  HISTORY_QUESTIONS, HISTORY_ROUTES, HISTORY_SOURCES, HISTORY_TERMS,
  historyChapter, historyLesson, historySource,
} from "./kanab-quest-school-history";
import { HISTORY_EARLY_ANSWERS } from "./kanab-quest-school-history-early-answers";
import { HISTORY_MODERN_ANSWERS } from "./kanab-quest-school-history-modern-answers";
import {
  KQ_SCHOOL_HISTORY_ACTIVITY_IDS, KQ_SCHOOL_HISTORY_CHAPTER_IDS,
  KQ_SCHOOL_HISTORY_CHECKPOINT_IDS, KQ_SCHOOL_HISTORY_LESSON_IDS,
  parseKqSchoolHistoryProgress,
} from "./kanab-quest-school-history-progress";
import type { HistoryActivity, HistoryChoice } from "./kanab-quest-school-history-types";

const sourceIds = new Set(HISTORY_SOURCES.map(source => source.id));
const lessonIds = new Set(HISTORY_LESSONS.map(lesson => lesson.id));
const termIds = new Set(HISTORY_TERMS.map(term => term.id));
const activities = HISTORY_CHAPTERS.flatMap(chapter => [...chapter.lessons.map(lesson => lesson.activity), chapter.checkpoint]);
const answers = { ...HISTORY_EARLY_ANSWERS, ...HISTORY_MODERN_ANSWERS };
const evidenceKinds = ["observation", "interpretation", "experiment", "clinical", "tradition", "fiction", "law"];
const regions = ["global", "central-asia", "east-asia", "south-asia", "middle-east", "africa", "europe", "brittany", "americas"];
const uses = ["plant", "fibre", "food", "ritual", "medicine", "science", "policy", "industry"];
const sorted = (values: readonly string[]) => [...values].sort();
const words = (value: string) => value.trim().split(/\s+/).length;

function nonempty(value: string, label: string) {
  expect(typeof value, label).toBe("string");
  expect(value.trim().length, label).toBeGreaterThan(0);
}

function unique(values: readonly string[], label: string) {
  expect(new Set(values).size, label).toBe(values.length);
}

function references(ids: readonly string[], allowed: ReadonlySet<string>, label: string) {
  expect(ids.length, label).toBeGreaterThan(0);
  unique(ids, label);
  for (const id of ids) expect(allowed.has(id), `${label}: ${id}`).toBe(true);
}

function choices(items: readonly HistoryChoice[], label: string) {
  expect(items.length, label).toBeGreaterThanOrEqual(2);
  unique(items.map(item => item.id), label);
  unique(items.map(item => item.text), label);
  expect(items.filter(item => item.correct), label).toHaveLength(1);
  for (const item of items) {
    expect(item.id, label).toMatch(/^[a-z0-9-]{1,80}$/);
    nonempty(item.text, `${label}/${item.id} text`);
    expect(typeof item.correct, label).toBe("boolean");
    expect(item.feedback.trim().length, `${label}/${item.id} feedback`).toBeGreaterThan(10);
  }
}

function sourceIdsForActivity(activity: HistoryActivity) {
  return new Set([...activity.steps.flatMap(step => step.sourceIds), ...(activity.documents ?? []).flatMap(document => document.sourceIds)]);
}

function checkFrenchStrings(value: unknown, path: string) {
  if (typeof value === "string") {
    expect(value, path).not.toContain("\uFFFD");
    // URL query separators are legitimate; an in-word '?' in prose is damaged UTF-8.
    if (!path.endsWith(".url")) expect(value, path).not.toMatch(/[\p{L}\p{N}]\?[\p{L}\p{N}]/u);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => checkFrenchStrings(item, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) checkFrenchStrings(item, `${path}.${key}`);
  }
}

describe("authored school history content", () => {
  it("contains eleven ordered chapters, twenty-two lessons and forty-four distinct questions", () => {
    expect(HISTORY_CHAPTERS.map(chapter => chapter.id)).toEqual(KQ_SCHOOL_HISTORY_CHAPTER_IDS);
    expect(HISTORY_CHAPTERS.map(chapter => chapter.number)).toEqual(Array.from({ length: 11 }, (_, index) => index + 1));
    expect(HISTORY_LESSONS).toHaveLength(22);
    expect(HISTORY_QUESTIONS).toHaveLength(44);
    unique(HISTORY_QUESTIONS.map(question => question.prompt), "quiz prompts");
    for (const chapter of HISTORY_CHAPTERS) {
      expect(chapter.lessons.map(lesson => lesson.id)).toEqual([`history-${chapter.id}-1`, `history-${chapter.id}-2`]);
      expect(HISTORY_QUESTIONS.filter(question => question.chapterId === chapter.id).map(question => question.id))
        .toEqual([1, 2, 3, 4].map(number => `history-${chapter.id}-q0${number}`));
      for (const [field, value] of Object.entries(chapter.context)) nonempty(value, `${chapter.id}/${field}`);
      expect(Object.keys(chapter.context).sort()).toEqual(["evidence", "labourAndTrade", "transformations", "uses", "where", "who"]);
      nonempty(chapter.introduction, chapter.id);
    }
  });

  it("keeps stable persisted identities unique and accepted by both backend whitelists", () => {
    for (const [name, items] of Object.entries({ chapters: HISTORY_CHAPTERS, lessons: HISTORY_LESSONS, sources: HISTORY_SOURCES,
      questions: HISTORY_QUESTIONS, terms: HISTORY_TERMS, events: HISTORY_EVENTS, routes: HISTORY_ROUTES, activities })) {
      unique(items.map(item => item.id), name);
      for (const item of items) expect(item.id, name).toMatch(/^[a-z0-9-]{1,80}$/);
    }
    const command = {
      lessonIds: HISTORY_LESSONS.map(lesson => lesson.id),
      activityIds: HISTORY_LESSONS.map(lesson => lesson.activity.id),
      checkpointIds: HISTORY_CHAPTERS.map(chapter => chapter.checkpoint.id),
    };
    expect(sorted(command.lessonIds)).toEqual(sorted(KQ_SCHOOL_HISTORY_LESSON_IDS));
    expect(sorted(command.activityIds)).toEqual(sorted(KQ_SCHOOL_HISTORY_ACTIVITY_IDS));
    expect(sorted(command.checkpointIds)).toEqual(sorted(KQ_SCHOOL_HISTORY_CHECKPOINT_IDS));
    unique([...command.lessonIds, ...command.activityIds, ...command.checkpointIds], "persisted identities");
    for (const resumeLessonId of command.lessonIds) {
      expect(parseKqSchoolHistoryProgress({ ...command, resumeLessonId, expectedRevision: 0 }))
        .toEqual({ lessonIds: sorted(command.lessonIds), activityIds: sorted(command.activityIds),
          checkpointIds: sorted(command.checkpointIds), resumeLessonId, expectedRevision: 0 });
    }
    const migration = readFileSync("supabase/migrations/20261112000100_kq_school_history_progress.sql", "utf8");
    const sqlChapters = migration.match(/chapters CONSTANT TEXT\[\]:=ARRAY\[([\s\S]*?)\];/)?.[1];
    expect(sqlChapters, "SQL chapter whitelist").toBeDefined();
    expect([...sqlChapters!.matchAll(/'([^']+)'/g)].map(match => match[1])).toEqual(KQ_SCHOOL_HISTORY_CHAPTER_IDS);
  });

  it("records precise source metadata and distinguishes the access actually obtained", () => {
    for (const source of HISTORY_SOURCES) {
      for (const field of ["title", "organization", "author", "published", "passage", "documentKind", "limitation"] as const) {
        nonempty(source[field], `${source.id}/${field}`);
      }
      expect(source.passage.length, source.id).toBeGreaterThan(20);
      expect(source.limitation.length, source.id).toBeGreaterThan(20);
      expect(["full-text", "abstract", "catalogue", "official-page"], source.id).toContain(source.access);
      expect(source.verifiedAt, source.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(source.verifiedAt).toISOString().slice(0, 10), source.id).toBe(source.verifiedAt);
      expect(source.url, source.id).toMatch(/^(https:\/\/|\/arene\/placard\?)/);
      if (source.url.startsWith("https://")) expect(new URL(source.url).hostname, source.id).toContain(".");
      expect(historySource(source.id)).toBe(source);
    }
  });

  it("retains substantial lesson prose, sourced evidence and useful visual nodes", () => {
    for (const lesson of HISTORY_LESSONS) {
      for (const field of ["title", "question", "objective", "nextQuestion"] as const) nonempty(lesson[field], `${lesson.id}/${field}`);
      expect(lesson.minutes, lesson.id).toBeGreaterThan(0);
      expect(lesson.essential.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(words(lesson.essential.map(block => block.text).join(" ")), `${lesson.id}/essential`).toBeGreaterThanOrEqual(90);
      expect(words(lesson.deeper.map(block => block.text).join(" ")), `${lesson.id}/deeper`).toBeGreaterThanOrEqual(90);
      for (const block of [...lesson.essential, lesson.example, ...lesson.deeper]) {
        nonempty(block.text, lesson.id);
        expect(evidenceKinds, lesson.id).toContain(block.evidence);
        references(block.sourceIds, sourceIds, `${lesson.id}/block`);
      }
      expect(["evidence", "chain", "dates", "comparison"], lesson.id).toContain(lesson.visual.kind);
      expect(lesson.visual.nodes.length, lesson.id).toBeGreaterThanOrEqual(2);
      nonempty(lesson.visual.title, lesson.id);
      nonempty(lesson.visual.caption, lesson.id);
      references(lesson.visual.sourceIds, sourceIds, `${lesson.id}/visual`);
      for (const node of lesson.visual.nodes) {
        nonempty(node.label, lesson.id);
        nonempty(node.detail, lesson.id);
      }
    }
  });

  it("resolves glossary, related lessons, old revision anchors and real Buddy references", () => {
    for (const lesson of HISTORY_LESSONS) {
      references(lesson.glossaryIds, termIds, `${lesson.id}/glossary`);
      references(lesson.relatedLessonIds, lessonIds, `${lesson.id}/related`);
      expect(lesson.relatedLessonIds, lesson.id).not.toContain(lesson.id);
      expect(historyLesson(lesson.id)).toBe(lesson);
      expect(historyChapter(lesson.id)?.lessons).toContain(lesson);
      for (const code of lesson.buddyCodes ?? []) expect(getKqBuddieVariety(code), `${lesson.id}/${code}`).toBeDefined();
    }
    for (const term of HISTORY_TERMS) {
      nonempty(term.term, term.id);
      nonempty(term.definition, term.id);
      references(term.sourceIds, sourceIds, term.id);
      references(term.lessonIds, lessonIds, term.id);
    }
    for (const [alias, target] of Object.entries(HISTORY_LESSON_ALIASES)) {
      expect(lessonIds.has(target), alias).toBe(true);
      expect(historyLesson(alias)).toBe(historyLesson(target));
    }
    const fictionalBuddyLesson = historyLesson("history-evidence-2")!;
    expect(fictionalBuddyLesson.buddyCodes).toContain("HH2026-001");
    expect(getKqBuddieVariety("HH2026-001")?.identity).toBe("fiction");
    expect(fictionalBuddyLesson.example.evidence).toBe("fiction");
  });

  it("gives every quiz item four distinct options, a valid revision anchor and complete private corrections", () => {
    const keys = sorted(HISTORY_QUESTIONS.map(question => question.id));
    expect(sorted(Object.keys(answers))).toEqual(keys);
    expect(Object.keys(HISTORY_EARLY_ANSWERS)).toHaveLength(20);
    expect(Object.keys(HISTORY_MODERN_ANSWERS)).toHaveLength(24);
    expect(KQ_SCHOOL_HISTORY_ANSWERS).toEqual(answers);
    for (const question of HISTORY_QUESTIONS) {
      expect(question.lessonId, question.id).toBe("history");
      expect(historyChapter(question.sectionId)?.id, question.id).toBe(question.chapterId);
      expect(question.options, question.id).toHaveLength(4);
      unique(question.options.map(option => option.id), question.id);
      unique(question.options.map(option => option.text), question.id);
      for (const option of question.options) nonempty(option.text, `${question.id}/${option.id}`);
      references(question.sources.map(source => source.id), sourceIds, question.id);
      for (const source of question.sources) expect(source, question.id).toEqual(historySource(source.id));
      for (const code of question.buddyCodes ?? []) expect(getKqBuddieVariety(code), `${question.id}/${code}`).toBeDefined();
      const answer = answers[question.id];
      expect(question.options.filter(option => option.id === answer.correctOptionId), question.id).toHaveLength(1);
      expect(answer.explanation.length, question.id).toBeGreaterThan(30);
      expect(sorted(Object.keys(answer.optionExplanations)), question.id).toEqual(sorted(question.options.map(option => option.id)));
      for (const explanation of Object.values(answer.optionExplanations)) expect(explanation.length, question.id).toBeGreaterThan(20);
      expect(getKqSchoolAnswer(question.id), question.id).toEqual(answer);
    }
  });

  it("keeps rewarded answer keys server-only while allowing corrected learning activities", () => {
    for (const question of HISTORY_QUESTIONS) {
      for (const field of ["correct", "correctOptionId", "explanation", "optionExplanations"]) expect(question, question.id).not.toHaveProperty(field);
      for (const option of question.options) expect(Object.keys(option).sort(), question.id).toEqual(["id", "text"]);
    }
    for (const name of ["history", "history-early", "history-modern", "history-types"]) {
      const source = readFileSync(`src/lib/kanab-quest-school-${name}.ts`, "utf8");
      expect(source, name).not.toMatch(/(?:from\s*|import\s*)["'][^"']+-answers["']/);
    }
    for (const name of ["history-early", "history-modern"]) {
      expect(readFileSync(`src/lib/kanab-quest-school-${name}-answers.ts`, "utf8"), name).toMatch(/^import "server-only";/);
    }
  });

  it("provides evaluable activities and checkpoints with feedback for every choice and justification", () => {
    expect(activities).toHaveLength(33);
    for (const activity of activities) {
      for (const field of ["title", "evaluates", "scenario", "takeaway"] as const) nonempty(activity[field], `${activity.id}/${field}`);
      expect(["dossier", "order", "matching", "documents", "chronology", "choice", "diagram"], activity.id).toContain(activity.kind);
      expect(typeof activity.fictional, activity.id).toBe("boolean");
      expect(activity.steps.length, activity.id).toBeGreaterThan(0);
      unique(activity.steps.map(step => step.id), activity.id);
      const hasJustification = activity.steps.some(step => (step.reasons?.length ?? 0) >= 2);
      if (KQ_SCHOOL_HISTORY_ACTIVITY_IDS.includes(activity.id)) {
        expect(hasJustification, `${activity.id}/justification`).toBe(true);
      } else if (!hasJustification) {
        // A chapter checkpoint may instead evaluate two complementary decisions.
        expect(activity.steps.length, `${activity.id}/checkpoint decisions`).toBeGreaterThanOrEqual(2);
      }
      for (const step of activity.steps) {
        nonempty(step.prompt, `${activity.id}/${step.id}`);
        choices(step.choices, `${activity.id}/${step.id}/choices`);
        references(step.sourceIds, sourceIds, `${activity.id}/${step.id}`);
        expect(Boolean(step.reasonPrompt), `${activity.id}/${step.id}`).toBe(Boolean(step.reasons?.length));
        if (step.reasons) choices(step.reasons, `${activity.id}/${step.id}/reasons`);
      }
      for (const document of activity.documents ?? []) {
        nonempty(document.title, activity.id);
        nonempty(document.text, activity.id);
        nonempty(document.status, activity.id);
        references(document.sourceIds, sourceIds, `${activity.id}/document`);
      }
    }
  });

  it("includes the five requested exercises with their evidence and fictional framing", () => {
    const archaeology = HISTORY_CHAPTERS.find(chapter => chapter.id === "eurasian-antiquity")!.checkpoint;
    expect(archaeology.kind).toBe("dossier");
    expect(archaeology.documents!.length).toBeGreaterThanOrEqual(3);
    expect(archaeology.steps.length).toBeGreaterThanOrEqual(3);
    for (const id of ["he-tunnug-2026", "he-jirzankal-2019", "he-hair-2015"]) expect(sourceIdsForActivity(archaeology).has(id), id).toBe(true);

    const order = historyLesson("history-brittany-1")!.activity;
    expect(["order", "dossier"]).toContain(order.kind);
    expect(order.fictional).toBe(true);
    expect(order.scenario).toMatch(/Noyal/i);
    expect(sourceIdsForActivity(order).has("history-modern-noyal")).toBe(true);
    expect(order.steps.length).toBeGreaterThanOrEqual(2);

    const matching = historyLesson("history-brittany-2")!.activity;
    expect(matching.kind).toBe("matching");
    expect(matching.steps.length).toBeGreaterThanOrEqual(2);
    expect(sourceIdsForActivity(matching).has("history-modern-brittany")).toBe(true);

    const propaganda = historyLesson("history-twentieth-century-2")!.activity;
    expect(propaganda.kind).toBe("documents");
    expect(propaganda.documents!.length).toBeGreaterThanOrEqual(2);
    for (const id of ["history-modern-victory", "history-modern-tax1937"]) expect(sourceIdsForActivity(propaganda).has(id), id).toBe(true);
    expect(propaganda.steps.length).toBeGreaterThanOrEqual(2);

    const chronology = historyLesson("history-scientific-discoveries-1")!.activity;
    expect(chronology.kind).toBe("chronology");
    for (const id of ["history-modern-adams1940", "history-modern-gaoni1964"]) expect(sourceIdsForActivity(chronology).has(id), id).toBe(true);
    expect(chronology.steps.some(step => step.reasons?.length)).toBe(true);
  });

  it("gives timeline events typed dates, explicit uncertainty and valid source and lesson links", () => {
    expect(HISTORY_EVENTS.length).toBeGreaterThanOrEqual(20);
    expect(HISTORY_EVENTS.map(event => event.startYear)).toEqual(HISTORY_EVENTS.map(event => event.startYear).sort((a, b) => a - b));
    for (const event of HISTORY_EVENTS) {
      expect(Number.isSafeInteger(event.startYear), event.id).toBe(true);
      if (event.endYear !== undefined) {
        expect(Number.isSafeInteger(event.endYear), event.id).toBe(true);
        expect(event.endYear, event.id).toBeGreaterThanOrEqual(event.startYear);
      }
      expect(["object", "event", "publication", "effective-law"], event.id).toContain(event.dateKind);
      expect(evidenceKinds, event.id).toContain(event.evidence);
      expect(regions, event.id).toContain(event.region);
      references(event.uses, new Set(uses), `${event.id}/uses`);
      for (const field of ["title", "dateLabel", "summary", "uncertainty"] as const) nonempty(event[field], `${event.id}/${field}`);
      references(event.sourceIds, sourceIds, event.id);
      expect(lessonIds.has(event.lessonId), event.id).toBe(true);
    }
    for (const site of ["jirzankal", "tunnug"]) {
      const object = HISTORY_EVENTS.find(event => event.id === `he-event-${site}-context`)!;
      const publication = HISTORY_EVENTS.find(event => event.id === `he-event-${site}-study`)!;
      expect(object.dateKind).toBe("object");
      expect(publication.dateKind).toBe("publication");
      expect(object.startYear).toBeLessThan(0);
      expect(publication.startYear).toBeGreaterThan(2000);
      expect(publication.sourceIds.some(id => object.sourceIds.includes(id))).toBe(true);
    }
  });

  it("locates sourced routes with bounded coordinates and distinguishes hypotheses from documented links", () => {
    expect(HISTORY_ROUTES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(HISTORY_ROUTES.map(route => route.certainty))).toEqual(new Set(["documented-link", "hypothesis"]));
    for (const route of HISTORY_ROUTES) {
      for (const field of ["title", "period", "explanation", "limitation"] as const) nonempty(route[field], `${route.id}/${field}`);
      expect(regions, route.id).toContain(route.region);
      references(route.uses, new Set(uses), `${route.id}/uses`);
      references(route.sourceIds, sourceIds, route.id);
      expect(lessonIds.has(route.lessonId), route.id).toBe(true);
      for (const point of [route.from, route.to]) {
        nonempty(point.label, route.id);
        expect(Number.isFinite(point.lat) && Number.isFinite(point.lon), route.id).toBe(true);
        expect(Math.abs(point.lat), route.id).toBeLessThanOrEqual(90);
        expect(Math.abs(point.lon), route.id).toBeLessThanOrEqual(180);
      }
    }
  });

  it("preserves readable UTF-8 across public prose and all private feedback", () => {
    checkFrenchStrings({ chapters: HISTORY_CHAPTERS, sources: HISTORY_SOURCES, questions: HISTORY_QUESTIONS,
      events: HISTORY_EVENTS, routes: HISTORY_ROUTES, terms: HISTORY_TERMS, answers }, "history");
  });
});
