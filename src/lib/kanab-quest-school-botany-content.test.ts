import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getKqBuddieVariety } from "./kanab-quest-buddie-varieties";
import { getKqSchoolAnswer, KQ_SCHOOL_BOTANY_ANSWERS } from "./kanab-quest-school-answers";
import {
  BOTANY_CHAPTERS, BOTANY_LESSONS, BOTANY_LESSON_ALIASES, BOTANY_QUESTIONS,
  BOTANY_SOURCES, BOTANY_TERMS, BOTANY_VARIETIES, botanyLesson, botanySource,
} from "./kanab-quest-school-botany";
import { BOTANY_FOUNDATIONS_ANSWERS } from "./kanab-quest-school-botany-foundations-answers";
import { BOTANY_DIVERSITY_ANSWERS } from "./kanab-quest-school-botany-diversity-answers";
import {
  KQ_SCHOOL_BOTANY_ACTIVITY_IDS, KQ_SCHOOL_BOTANY_CHAPTER_IDS,
  KQ_SCHOOL_BOTANY_CHECKPOINT_IDS, KQ_SCHOOL_BOTANY_LESSON_IDS,
  parseKqSchoolBotanyProgress,
} from "./kanab-quest-school-botany-progress";
import type { BotanyVarietyDossier } from "./kanab-quest-school-botany-types";
import type { HistoryChoice } from "./kanab-quest-school-history-types";

const sourceIds = new Set(BOTANY_SOURCES.map(source => source.id));
const lessonIds = new Set(BOTANY_LESSONS.map(lesson => lesson.id));
const termIds = new Set(BOTANY_TERMS.map(term => term.id));
const activities = BOTANY_CHAPTERS.flatMap(chapter => [...chapter.lessons.map(lesson => lesson.activity), chapter.checkpoint]);
const answers = { ...BOTANY_FOUNDATIONS_ANSWERS, ...BOTANY_DIVERSITY_ANSWERS };
const evidenceKinds = ["observation", "interpretation", "experiment", "clinical", "tradition", "fiction", "law"];
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
    nonempty(item.text, `${label}/${item.id}`);
    expect(typeof item.correct, label).toBe("boolean");
    expect(item.feedback.trim().length, `${label}/${item.id}/feedback`).toBeGreaterThan(10);
  }
}

function buddies(codes: readonly string[], label: string) {
  unique(codes, label);
  for (const code of codes) expect(getKqBuddieVariety(code), `${label}/${code}`).toBeDefined();
}

function acyclic(dossier: BotanyVarietyDossier) {
  const finished = new Set<string>();
  const path = new Set<string>();
  function visit(id: string) {
    expect(path.has(id), `${dossier.id}: cycle at ${id}`).toBe(false);
    if (finished.has(id)) return;
    path.add(id);
    for (const edge of dossier.edges.filter(edge => edge.parentId === id)) visit(edge.childId);
    path.delete(id);
    finished.add(id);
  }
  dossier.nodes.forEach(node => visit(node.id));
}

function checkFrenchStrings(value: unknown, path: string) {
  if (typeof value === "string") {
    expect(value, path).not.toContain("\uFFFD");
    if (!path.endsWith(".url")) expect(value, path).not.toMatch(/[\p{L}\p{N}]\?[\p{L}\p{N}]/u);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => checkFrenchStrings(item, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) checkFrenchStrings(item, `${path}.${key}`);
  }
}

describe("authored school botany content", () => {
  it("contains eight ordered chapters, sixteen lessons and thirty-two distinct questions", () => {
    expect(BOTANY_CHAPTERS.map(chapter => chapter.id)).toEqual(KQ_SCHOOL_BOTANY_CHAPTER_IDS);
    expect(BOTANY_CHAPTERS.map(chapter => chapter.number)).toEqual(Array.from({ length: 8 }, (_, index) => index + 1));
    expect(BOTANY_LESSONS).toHaveLength(16);
    expect(BOTANY_QUESTIONS).toHaveLength(32);
    unique(BOTANY_QUESTIONS.map(question => question.prompt), "quiz prompts");
    for (const chapter of BOTANY_CHAPTERS) {
      expect(chapter.lessons.map(lesson => lesson.id)).toEqual([`botany-${chapter.id}-1`, `botany-${chapter.id}-2`]);
      expect(BOTANY_QUESTIONS.filter(question => question.chapterId === chapter.id).map(question => question.id))
        .toEqual([1, 2, 3, 4].map(number => `botany-${chapter.id}-q0${number}`));
      expect(chapter.checkpoint.id).toBe(`botany-${chapter.id}-checkpoint`);
      chapter.lessons.forEach((lesson, index) => expect(lesson.activity.id).toBe(`botany-${chapter.id}-activity-${index + 1}`));
      for (const field of ["title", "introduction"] as const) nonempty(chapter[field], `${chapter.id}/${field}`);
      expect(Object.keys(chapter.context).sort()).toEqual(["evidence", "labourAndTrade", "transformations", "uses", "where", "who"]);
      for (const [field, value] of Object.entries(chapter.context)) nonempty(value, `${chapter.id}/${field}`);
    }
  });

  it("keeps stable identities unique and accepted by the TypeScript and SQL progress whitelists", () => {
    for (const [name, items] of Object.entries({ chapters: BOTANY_CHAPTERS, lessons: BOTANY_LESSONS, sources: BOTANY_SOURCES,
      questions: BOTANY_QUESTIONS, terms: BOTANY_TERMS, dossiers: BOTANY_VARIETIES, activities,
      nodes: BOTANY_VARIETIES.flatMap(dossier => dossier.nodes), edges: BOTANY_VARIETIES.flatMap(dossier => dossier.edges) })) {
      unique(items.map(item => item.id), name);
      for (const item of items) expect(item.id, name).toMatch(/^[a-z0-9-]{1,80}$/);
    }
    const command = {
      lessonIds: BOTANY_LESSONS.map(lesson => lesson.id),
      activityIds: BOTANY_LESSONS.map(lesson => lesson.activity.id),
      checkpointIds: BOTANY_CHAPTERS.map(chapter => chapter.checkpoint.id),
    };
    expect(sorted(command.lessonIds)).toEqual(sorted(KQ_SCHOOL_BOTANY_LESSON_IDS));
    expect(sorted(command.activityIds)).toEqual(sorted(KQ_SCHOOL_BOTANY_ACTIVITY_IDS));
    expect(sorted(command.checkpointIds)).toEqual(sorted(KQ_SCHOOL_BOTANY_CHECKPOINT_IDS));
    unique([...command.lessonIds, ...command.activityIds, ...command.checkpointIds], "persisted identities");
    for (const resumeLessonId of command.lessonIds) {
      expect(parseKqSchoolBotanyProgress({ ...command, resumeLessonId, expectedRevision: 0 }))
        .toEqual({ lessonIds: sorted(command.lessonIds), activityIds: sorted(command.activityIds),
          checkpointIds: sorted(command.checkpointIds), resumeLessonId, expectedRevision: 0 });
    }
    const migration = readFileSync("supabase/migrations/20261112000200_kq_school_botany_progress.sql", "utf8");
    const sqlChapters = migration.match(/chapters CONSTANT TEXT\[\]:=ARRAY\[([\s\S]*?)\];/)?.[1];
    expect(sqlChapters, "SQL chapter whitelist").toBeDefined();
    expect([...sqlChapters!.matchAll(/'([^']+)'/g)].map(match => match[1])).toEqual(KQ_SCHOOL_BOTANY_CHAPTER_IDS);
  });

  it("records precise sources with dated consultation and the access actually obtained", () => {
    for (const source of BOTANY_SOURCES) {
      for (const field of ["title", "organization", "author", "published", "passage", "documentKind", "limitation"] as const) {
        nonempty(source[field], `${source.id}/${field}`);
      }
      expect(source.passage.length, source.id).toBeGreaterThan(20);
      expect(source.limitation.length, source.id).toBeGreaterThan(20);
      expect(["full-text", "abstract", "catalogue", "official-page", "excerpt"], source.id).toContain(source.access);
      expect(source.verifiedAt, source.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(source.verifiedAt).toISOString().slice(0, 10), source.id).toBe(source.verifiedAt);
      expect(source.url, source.id).toMatch(/^(https:\/\/|\/arene\/placard\?)/);
      if (source.url.startsWith("https://")) expect(new URL(source.url).hostname, source.id).toContain(".");
      expect(botanySource(source.id)).toBe(source);
    }
    for (const id of ["botany-diversity-cookies", "botany-variety-cookies", "botany-variety-gelato", "botany-variety-og-interview"]) {
      expect(botanySource(id)?.access, id).toBe("excerpt");
    }
  });

  it("retains authored lesson prose, useful visuals, valid references and real Buddy links", () => {
    for (const lesson of BOTANY_LESSONS) {
      for (const field of ["title", "question", "objective", "nextQuestion"] as const) nonempty(lesson[field], `${lesson.id}/${field}`);
      expect(lesson.minutes, lesson.id).toBeGreaterThan(0);
      expect(lesson.essential.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(words(lesson.essential.map(block => block.text).join(" ")), `${lesson.id}/essential`).toBeGreaterThanOrEqual(120);
      expect(words(lesson.deeper.map(block => block.text).join(" ")), `${lesson.id}/deeper`).toBeGreaterThanOrEqual(120);
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
      references(lesson.glossaryIds, termIds, `${lesson.id}/glossary`);
      references(lesson.relatedLessonIds, lessonIds, `${lesson.id}/related`);
      expect(lesson.relatedLessonIds, lesson.id).not.toContain(lesson.id);
      buddies(lesson.buddyCodes ?? [], lesson.id);
      expect(botanyLesson(lesson.id)).toBe(lesson);
    }
    for (const term of BOTANY_TERMS) {
      nonempty(term.term, term.id);
      nonempty(term.definition, term.id);
      references(term.sourceIds, sourceIds, term.id);
      references(term.lessonIds, lessonIds, term.id);
    }
    for (const [alias, target] of Object.entries(BOTANY_LESSON_ALIASES)) {
      expect(lessonIds.has(target), alias).toBe(true);
      expect(botanyLesson(alias)).toBe(botanyLesson(target));
    }
  });

  it("provides 128 private option corrections and valid revision anchors for the plant quiz", () => {
    expect(sorted(Object.keys(answers))).toEqual(sorted(BOTANY_QUESTIONS.map(question => question.id)));
    expect(Object.keys(BOTANY_FOUNDATIONS_ANSWERS)).toHaveLength(16);
    expect(Object.keys(BOTANY_DIVERSITY_ANSWERS)).toHaveLength(16);
    expect(KQ_SCHOOL_BOTANY_ANSWERS).toEqual(answers);
    expect(Object.values(answers).flatMap(answer => Object.values(answer.optionExplanations))).toHaveLength(128);
    for (const question of BOTANY_QUESTIONS) {
      expect(question.lessonId, question.id).toBe("plant");
      expect(BOTANY_CHAPTERS.find(chapter => chapter.lessons.some(lesson => lesson.id === question.sectionId))?.id, question.id).toBe(question.chapterId);
      expect(question.options, question.id).toHaveLength(4);
      unique(question.options.map(option => option.id), question.id);
      unique(question.options.map(option => option.text), question.id);
      for (const option of question.options) nonempty(option.text, `${question.id}/${option.id}`);
      references(question.sources.map(source => source.id), sourceIds, question.id);
      for (const source of question.sources) expect(source, question.id).toEqual(botanySource(source.id));
      buddies(question.buddyCodes ?? [], question.id);
      const answer = answers[question.id];
      expect(question.options.filter(option => option.id === answer.correctOptionId), question.id).toHaveLength(1);
      expect(answer.explanation.length, question.id).toBeGreaterThan(30);
      expect(sorted(Object.keys(answer.optionExplanations)), question.id).toEqual(sorted(question.options.map(option => option.id)));
      for (const explanation of Object.values(answer.optionExplanations)) expect(explanation.length, question.id).toBeGreaterThan(20);
      expect(getKqSchoolAnswer(question.id), question.id).toEqual(answer);
    }
  });

  it("keeps rewarded quiz answers server-only while exposing feedback for learning activities", () => {
    for (const question of BOTANY_QUESTIONS) {
      for (const field of ["correct", "correctOptionId", "explanation", "optionExplanations"]) expect(question, question.id).not.toHaveProperty(field);
      for (const option of question.options) expect(Object.keys(option).sort(), question.id).toEqual(["id", "text"]);
    }
    for (const name of ["botany", "botany-foundations", "botany-diversity", "botany-varieties", "botany-types"]) {
      expect(readFileSync(`src/lib/kanab-quest-school-${name}.ts`, "utf8"), name)
        .not.toMatch(/(?:from\s*|import\s*)["'][^"']+-answers["']/);
    }
    for (const name of ["botany-foundations", "botany-diversity"]) {
      expect(readFileSync(`src/lib/kanab-quest-school-${name}-answers.ts`, "utf8"), name).toMatch(/^import "server-only";/);
    }
  });

  it("contains 24 evaluable activities and checkpoints with coherent decisions and justifications", () => {
    expect(activities).toHaveLength(24);
    for (const activity of activities) {
      for (const field of ["title", "evaluates", "scenario", "takeaway"] as const) nonempty(activity[field], `${activity.id}/${field}`);
      expect(["dossier", "order", "matching", "documents", "chronology", "choice", "diagram"], activity.id).toContain(activity.kind);
      expect(typeof activity.fictional, activity.id).toBe("boolean");
      expect(activity.steps.length, activity.id).toBeGreaterThan(0);
      unique(activity.steps.map(step => step.id), activity.id);
      const hasJustification = activity.steps.some(step => (step.reasons?.length ?? 0) >= 2);
      if (KQ_SCHOOL_BOTANY_ACTIVITY_IDS.includes(activity.id)) {
        expect(hasJustification, `${activity.id}/justification`).toBe(true);
      } else if (!hasJustification) {
        // As in History, a checkpoint may evaluate two complementary decisions.
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
        for (const field of ["title", "text", "status"] as const) nonempty(document[field], `${activity.id}/document/${field}`);
        references(document.sourceIds, sourceIds, `${activity.id}/document`);
      }
    }
  });

  it("covers all seven requested exercises, including insufficient floral evidence", () => {
    const labels = botanyLesson("botany-anatomy-1")!.activity;
    expect(labels.kind).toBe("diagram");
    expect(labels.steps.slice(0, 4).map(step => step.id)).toEqual(["roots", "stem", "leaf", "inflorescence"]);
    labels.steps.slice(0, 4).forEach((step, index) => expect(step.prompt).toContain(`Repère ${index + 1}`));

    // The same labels evaluate organ/function associations, not names alone.
    const organFunctions = labels.steps.slice(0, 4).map(step => step.choices.find(choice => choice.correct)!.text);
    expect(organFunctions[0]).toMatch(/ancrage.*absorption/i);
    expect(organFunctions[1]).toMatch(/support.*transport/i);
    expect(organFunctions[2]).toMatch(/photosynthèse/i);
    expect(organFunctions[3]).toMatch(/reproduction/i);

    const flowers = botanyLesson("botany-sexual-expression-1")!.activity;
    expect(flowers.kind).toBe("diagram");
    expect(flowers.steps.map(step => step.id)).toEqual(expect.arrayContaining(["monoecy", "bisexual"]));
    const uncertain = botanyLesson("botany-observation-1")!.activity.steps.find(step => step.id === "uncertain")!;
    expect(uncertain.choices.find(choice => choice.correct)?.text).toMatch(/insuffisantes/i);
    expect(uncertain.reasons?.some(reason => reason.correct)).toBe(true);

    const cycle = botanyLesson("botany-life-cycle-1")!.activity;
    expect(["order", "chronology"]).toContain(cycle.kind);
    expect(cycle.scenario).toMatch(/embryon.*plantule.*feuillée.*floraison/i);

    const genotype = botanyLesson("botany-genetics-1")!.activity;
    expect(genotype.kind).toBe("diagram");
    expect(genotype.fictional).toBe(true);
    expect(genotype.scenario).toMatch(/AA.*Aa.*aa/);
    expect(genotype.steps[0].choices.find(choice => choice.correct)?.text).toMatch(/AA ou Aa/);

    const pedigree = BOTANY_CHAPTERS.find(chapter => chapter.id === "modern-lineages")!.checkpoint;
    expect(pedigree.kind).toBe("dossier");
    expect(pedigree.steps.find(step => step.id === "unknown")?.choices.find(choice => choice.correct)?.text).toMatch(/non identifié/i);

    const comparison = botanyLesson("botany-modern-lineages-2")!.activity;
    expect(comparison.kind).toBe("dossier");
    expect(comparison.scenario).toMatch(/White Widow/i);
    expect(comparison.steps[0].choices.find(choice => choice.correct)?.text).toMatch(/deux versions attribuées/i);
    expect(comparison.steps[0].reasons?.some(reason => reason.correct)).toBe(true);
  });

  it("supplies ten distinct variety dossiers with all seven evidence fields and real Buddy references", () => {
    expect(BOTANY_VARIETIES.map(dossier => dossier.id)).toEqual([
      "haze", "skunk", "northern-lights", "kush", "diesel", "blueberry", "white-widow", "cookies", "gelato", "cbd-hybrids",
    ]);
    for (const dossier of BOTANY_VARIETIES) {
      for (const field of ["title", "family", "claimedOrigin", "documentedPeriod", "declaredBreeder"] as const) {
        nonempty(dossier[field], `${dossier.id}/${field}`);
      }
      for (const field of ["announcedParents", "variants", "evidence", "unknowns"] as const) {
        expect(dossier[field].length, `${dossier.id}/${field}`).toBeGreaterThan(0);
        unique(dossier[field], `${dossier.id}/${field}`);
        dossier[field].forEach(value => nonempty(value, `${dossier.id}/${field}`));
      }
      references(dossier.sourceIds, sourceIds, dossier.id);
      references(dossier.lessonIds, lessonIds, dossier.id);
      expect(dossier.buddyCodes.length, dossier.id).toBeGreaterThan(0);
      buddies(dossier.buddyCodes, dossier.id);
    }
  });

  it("keeps pedigree graphs acyclic, sourced and explicit about parents versus ancestry", () => {
    for (const dossier of BOTANY_VARIETIES) {
      expect(dossier.nodes.length, dossier.id).toBeGreaterThan(0);
      const nodeIds = new Set(dossier.nodes.map(node => node.id));
      unique(dossier.edges.map(edge => `${edge.parentId}/${edge.childId}`), `${dossier.id}/relations`);
      for (const node of dossier.nodes) {
        nonempty(node.label, node.id);
        nonempty(node.detail, node.id);
        buddies(node.buddyCodes ?? [], node.id);
        for (const code of node.buddyCodes ?? []) expect(dossier.buddyCodes, node.id).toContain(code);
        expect(dossier.edges.filter(edge => edge.childId === node.id && edge.relation === "parent").length,
          `${node.id}/direct parents`).toBeLessThanOrEqual(2);
      }
      for (const edge of dossier.edges) {
        expect(nodeIds.has(edge.parentId), edge.id).toBe(true);
        expect(nodeIds.has(edge.childId), edge.id).toBe(true);
        expect(edge.parentId, edge.id).not.toBe(edge.childId);
        expect(["documented", "breeder-claim", "hypothesis"], edge.id).toContain(edge.status);
        expect(["parent", "ancestry"], edge.id).toContain(edge.relation);
        for (const field of ["claimant", "period", "explanation", "limitation"] as const) nonempty(edge[field], `${edge.id}/${field}`);
        references(edge.sourceIds, sourceIds, edge.id);
        references(edge.sourceIds, new Set(dossier.sourceIds), `${edge.id}/dossier sources`);
      }
      acyclic(dossier);
    }
    const northernLights = BOTANY_VARIETIES.find(dossier => dossier.id === "northern-lights")!;
    const mangoParents = northernLights.edges.filter(edge => edge.childId === "nl-mango-mns");
    expect(mangoParents.filter(edge => edge.relation === "ancestry")).toHaveLength(2);
    expect(mangoParents.filter(edge => edge.relation === "parent")).toHaveLength(1);
    expect(mangoParents.every(edge => edge.status === "breeder-claim")).toBe(true);
  });

  it("does not fill documented gaps with invented founder parents or obsolete Cannatonic claims", () => {
    const edges = BOTANY_VARIETIES.flatMap(dossier => dossier.edges);
    const nodes = BOTANY_VARIETIES.flatMap(dossier => dossier.nodes);
    for (const id of ["nl-five-mns", "kush-og-dinafem-parent", "blue-hso-blueberry", "cbd-crew-therapy"]) {
      expect(nodes.some(node => node.id === id), id).toBe(true);
      expect(edges.filter(edge => edge.childId === id), `${id}/unknown founders`).toHaveLength(0);
    }
    const cbd = BOTANY_VARIETIES.find(dossier => dossier.id === "cbd-hybrids")!;
    expect(cbd.unknowns.join(" ")).toMatch(/parenté précise de CBD Therapy/i);
    expect(sorted(cbd.edges.filter(edge => edge.childId === "cbd-resin-cannatonic").map(edge => edge.parentId)))
      .toEqual(["cbd-resin-nycd", "cbd-resin-reina"]);
    expect(cbd.nodes.map(node => node.label).join(" ")).not.toMatch(/MK-Ultra|G13/i);
    // Distinct White Widow versions stay disconnected rather than acquiring a fictional common ancestor.
    const widow = BOTANY_VARIETIES.find(dossier => dossier.id === "white-widow")!;
    expect(widow.edges.every(edge => edge.parentId.startsWith("widow-shanti-") === edge.childId.startsWith("widow-shanti-"))).toBe(true);
  });

  it("preserves readable UTF-8 throughout public text and private corrections", () => {
    checkFrenchStrings({ chapters: BOTANY_CHAPTERS, sources: BOTANY_SOURCES, questions: BOTANY_QUESTIONS,
      terms: BOTANY_TERMS, dossiers: BOTANY_VARIETIES, answers }, "botany");
  });
});
