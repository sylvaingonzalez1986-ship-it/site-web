import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEMP_QUIZ_BANK, HEMP_QUIZ_SOURCES } from './kanab-quest-hemp-quiz-bank';
import { HEMP_QUIZ_BANK_SIZE, HEMP_QUIZ_TOPICS, HEMP_QUIZ_LEVELS } from './kanab-quest-hemp-quiz-meta';
import { loadCannabisReferenceCatalog, findCannabisReferenceArticle } from './kanab-quest-cannabis-reference';
import { createKqSchoolChallengePlan } from './kanab-quest-school-challenge-server';
import { HEMP_QUIZ_BIOLOGY } from './kanab-quest-hemp-quiz-biology';
import { HEMP_QUIZ_USES } from './kanab-quest-hemp-quiz-uses';

describe('Hemp quiz factual bank', () => {
  it('contains original concise QCMs in every topic and difficulty', () => {
    expect(HEMP_QUIZ_BANK).toHaveLength(HEMP_QUIZ_BANK_SIZE);
    expect(HEMP_QUIZ_BANK_SIZE).toBe(360);
    const originals = [...HEMP_QUIZ_BIOLOGY, ...HEMP_QUIZ_USES];
    expect(originals).toHaveLength(180);
    // Editorial revisions may correct wording and references while preserving question identity and difficulty.
    expect(HEMP_QUIZ_BANK.slice(0, 180).map(({id, topicId, level}) => ({id, topicId, level}))).toEqual(originals.map(({id, topicId, level}) => ({id, topicId, level})));
    expect(new Set(HEMP_QUIZ_BANK.map(item => item.id)).size).toBe(HEMP_QUIZ_BANK.length);
    expect(new Set(HEMP_QUIZ_BANK.map(item => item.prompt.toLocaleLowerCase('fr'))).size).toBe(HEMP_QUIZ_BANK.length);
    for (const topic of HEMP_QUIZ_TOPICS) {
      for (const level of HEMP_QUIZ_LEVELS) expect(HEMP_QUIZ_BANK.filter(item => item.topicId === topic.id && item.level === level.id).length, `${topic.id}/${level.id}`).toBeGreaterThanOrEqual(5);
    }
    for (const level of HEMP_QUIZ_LEVELS) expect(HEMP_QUIZ_BANK.filter(item => item.level === level.id)).toHaveLength(90);
    for (const item of HEMP_QUIZ_BANK) {
      expect(item.id).toMatch(/^hemp-[a-z0-9-]{1,70}$/);
      expect(item.options, item.id).toHaveLength(4);
      expect(new Set(item.options.map(option => option.toLocaleLowerCase('fr'))).size, item.id).toBe(4);
      expect(item.options[item.answer], item.id).toBeTruthy();
      expect(item.prompt.length, item.id).toBeLessThanOrEqual(150);
      for (const option of item.options) expect(option.length, item.id).toBeLessThanOrEqual(75);
      expect(item.explanation.length, item.id).toBeLessThanOrEqual(240);
      expect(item.sourceIds.length, item.id).toBeGreaterThan(0);
      for (const source of item.sourceIds) expect(HEMP_QUIZ_SOURCES.has(source), `${item.id}/${source}`).toBe(true);
    }
  });
  it('links every correction to factual articles and documented sources, including historical anecdotes', async () => {
    const catalog = await loadCannabisReferenceCatalog();
    expect(HEMP_QUIZ_TOPICS.some(topic => topic.id === 'history')).toBe(true);
    for (const item of HEMP_QUIZ_BANK) {
      const article = findCannabisReferenceArticle(catalog, 'reference', item.articleId);
      expect(article, `${item.id}/${item.articleId}`).toBeDefined();
      for (const source of item.sourceIds) expect(article?.sourceIds.includes(source), `${item.id}: source missing from article ${source}`).toBe(true);
      expect(item.prompt, item.id).not.toMatch(/source fiable|information manquante|méthodologie/i);
    }
  });
  it('draws every topic without archived questions and only exposes public question data', () => {
    const reached = new Set<string>();
    for (let seed = 0; seed < 600; seed++) {
      const plan = createKqSchoolChallengePlan('hemp-review-' + seed);
      expect(new Set(plan.questions.map(item => item.question.themeId))).toEqual(new Set(HEMP_QUIZ_TOPICS.map(item => item.id)));
      for (const { question, answer } of plan.questions) {
        reached.add(question.id);
        const entry = HEMP_QUIZ_BANK.find(item => item.id === question.id)!;
        expect(question.options.find(option => option.id === answer.correctOptionId)?.text).toBe(entry.options[entry.answer]);
        expect(question).not.toHaveProperty('answer'); expect(question).not.toHaveProperty('correctOptionId');
        expect(question).not.toHaveProperty('explanation');
      }
    }
    expect(reached.size).toBe(HEMP_QUIZ_BANK_SIZE);
  });
  it('keeps retired educational quizzes and activities out of the current school', () => {
    const shell = readFileSync('src/components/placard/KqSchool.tsx', 'utf8');
    expect(shell).not.toMatch(/<KqSchoolQuiz|<Workshops|KQ_SCHOOL_COURSES|start\('history'\)/);
    for (const file of ['bank', 'biology', 'uses', 'history-culture', 'history-science', 'expansion-nature']) expect(readFileSync(`src/lib/kanab-quest-hemp-quiz-${file}.ts`, 'utf8')).toMatch(/import ['"]server-only['"]/);
  });
  it('records the current consulted sources and access limits for every reviewed question', () => {
    const bibliography = JSON.parse(readFileSync('docs/encyclopedia-revision/bibliography.json', 'utf8')) as {
      id: string; url: string; verifiedAt: string; access: string;
      reviewEvidence: { status?: string; result?: string }[];
    }[];
    const inventory = JSON.parse(readFileSync('docs/encyclopedia-revision/inventory.json', 'utf8')) as { entries: { quizReviewed: string[] }[] };
    const reviewed = new Set(inventory.entries.flatMap(entry => entry.quizReviewed));
    const documented = new Map(bibliography.map(source => [source.id, source]));
    expect(reviewed.size).toBe(360);
    for (const question of HEMP_QUIZ_BANK) {
      expect(reviewed.has(question.id), question.id).toBe(true);
      for (const id of question.sourceIds) {
        expect(documented.has(id), id).toBe(true);
        const source = documented.get(id)!;
        expect(source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (source.access !== 'unavailable') expect(source.verifiedAt, id).toBe('2026-11-14');
        expect(['full-text', 'abstract', 'official-page', 'catalogue', 'excerpt', 'unavailable']).toContain(source.access);
        expect(new URL(source.url).protocol).toBe('https:');
      }
      expect(question.sourceIds.some(id => documented.get(id)?.access !== 'unavailable'), `${question.id}: no consulted source`).toBe(true);
    }
  });
});
