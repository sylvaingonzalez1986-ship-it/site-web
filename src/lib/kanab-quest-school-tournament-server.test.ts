import { describe, expect, it } from 'vitest';
import { createKqSchoolQuestionPlan } from './kanab-quest-school-challenge-server';
import { HEMP_QUIZ_BANK, HEMP_QUIZ_SOURCES } from './kanab-quest-hemp-quiz-bank';
import { HEMP_QUIZ_TOPICS } from './kanab-quest-hemp-quiz-meta';
import type { HempQuizEntry } from './kanab-quest-hemp-quiz-types';
import { createKqSchoolTournamentPlan } from './kanab-quest-school-tournament-server';
import { KQ_TOURNAMENT_VERSION } from './kanab-quest-school-tournament';

const legacyEntry = (level: number): HempQuizEntry => ({ ...HEMP_QUIZ_BANK.find(item => item.level === level)!, domain: undefined });
const domainCounts = (plan: ReturnType<typeof createKqSchoolQuestionPlan>, pool: readonly HempQuizEntry[]) => {
  const selected = plan.questions.map(item => pool.find(entry => entry.id === item.question.id)!);
  return ['active', 'food', 'materials'].map(domain => selected.filter(item => item.domain === domain).length);
};
const classifiedPool = (): HempQuizEntry[] => ([1, 2, 3, 4] as const).flatMap(level =>
  (['active', 'food', 'materials'] as const).flatMap(domain => Array.from({ length: domain === 'active' ? 12 : 3 }, (_, index) => ({
    ...legacyEntry(level), id: `hemp-domain-${level}-${domain}-${index}`, domain,
    subjectKey: `${domain}-${level}-${index}`, topicId: 'molecules' as const,
  }))));

describe('private tournament draw', () => {
  it('sends citations without the factual excerpts or extra metadata from the source registry', () => {
    const source = HEMP_QUIZ_SOURCES.values().next().value!;
    const enriched = { ...source, passage: 'private-evidence-sentinel', note: 'private-evidence-sentinel', editorialAnswer: 'private-evidence-sentinel' };
    const registry = new Map([[source.id, enriched]]);
    const pool = classifiedPool().map(question => ({ ...question, sourceIds: [source.id] }));
    const plan = createKqSchoolQuestionPlan('source-projection', 3, pool, registry);
    for (const { question } of plan.questions) {
      expect(question.sources).toEqual([{ id: source.id, title: source.title, organization: source.organization, url: source.url, verifiedAt: source.verifiedAt }]);
      expect(JSON.stringify(question)).not.toContain('private-evidence-sentinel');
    }
    expect(registry.get(source.id)?.passage).toBe('private-evidence-sentinel');
  });
  it('uses three unique questions per level from the existing private hemp bank', () => {
    for (let index = 0; index < 10; index++) {
      const seed = 'tournament-' + index, plan = createKqSchoolTournamentPlan(seed);
      expect(plan.contentVersion).toBe(KQ_TOURNAMENT_VERSION);
      expect(plan.questions).toHaveLength(12);
      expect(new Set(plan.questions.map(item => item.question.id)).size).toBe(12);
      const counts = domainCounts(plan, HEMP_QUIZ_BANK);
      expect([[10, 1, 1], [9, 2, 1], [9, 1, 2]]).toContainEqual(counts);
      plan.questions.forEach(({ question, answer }, position) => {
        expect(question.level).toBe(Math.floor(position / 3) + 1);
        expect(question.options.map(choice => choice.id)).toEqual(['a', 'b', 'c', 'd']);
        expect(question.options.some(choice => choice.id === answer.correctOptionId)).toBe(true);
        const original = HEMP_QUIZ_BANK.find(item => item.id === question.id)!;
        expect(question.options.find(choice => choice.id === answer.correctOptionId)?.text).toBe(original.options[original.answer]);
        expect(question).not.toHaveProperty('correctOptionId');
        expect(question).not.toHaveProperty('answer');
        expect(question).not.toHaveProperty('domain');
        if (position % 3 === 0) expect(original.domain).toBe('active');
      });
      for (let level = 1; level <= 4; level++) {
        expect(plan.questions.filter(item => item.question.level === level && HEMP_QUIZ_BANK.find(entry => entry.id === item.question.id)!.domain !== 'active').length).toBeLessThanOrEqual(1);
      }
    }
  });
  it('limits recurring cultivars before balancing themes, while keeping private metadata private', () => {
    const pool: HempQuizEntry[] = [];
    for (const level of [1,2,3,4] as const) {
      for (let index = 0; index < 15; index++) {
        const original = legacyEntry(level);
        pool.push({...original, id:`hemp-test-${level}-${index}`, subjectKey:`cultivar-${index}`});
      }
    }
    for (let index = 0; index < 40; index++) {
      const plan = createKqSchoolQuestionPlan(`subjects-${index}`, 3, pool, HEMP_QUIZ_SOURCES);
      const selected = plan.questions.map(item => pool.find(entry => entry.id === item.question.id)!.subjectKey);
      expect(new Set(selected).size).toBe(12);
      for (const {question} of plan.questions) {
        expect(question).not.toHaveProperty('subjectKey');
        expect(question).not.toHaveProperty('editorial');
      }
    }
  });
  it('uses the least repeated subjects when a narrow pool cannot provide twelve distinct ones', () => {
    const pool: HempQuizEntry[] = [];
    for (const level of [1,2,3,4] as const) {
      const original = legacyEntry(level);
      for (let index = 0; index < 3; index++) pool.push({...original, id:`hemp-narrow-${level}-${index}`, subjectKey:`cultivar-${index}`});
    }
    const plan = createKqSchoolQuestionPlan('narrow', 3, pool, HEMP_QUIZ_SOURCES);
    expect(new Set(plan.questions.map(item => item.question.id)).size).toBe(12);
    for (let index = 0; index < 3; index++) expect(plan.questions.filter(item => pool.find(entry => entry.id === item.question.id)!.subjectKey === `cultivar-${index}`)).toHaveLength(4);
  });
  it('reserves scarce subjects for later levels when a globally distinct draw is possible', () => {
    const subjectsByLevel = [['a','b','c','d','e','f'],['d','e','f','g','h','i'],['g','h','i','j','k','l'],['c','j','k']];
    const pool: HempQuizEntry[] = subjectsByLevel.flatMap((subjects,index) => {
      const original = legacyEntry(index + 1);
      return subjects.map(subjectKey=>({...original,id:`hemp-reserve-${index}-${subjectKey}`,subjectKey}));
    });
    for (let seed = 0; seed < 60; seed++) {
      const plan = createKqSchoolQuestionPlan(`reserve-${seed}`,3,pool,HEMP_QUIZ_SOURCES);
      expect(new Set(plan.questions.map(item=>pool.find(entry=>entry.id===item.question.id)!.subjectKey)).size).toBe(12);
    }
  });
  it('reserves an early slot for a theme absent from later levels', () => {
    const pool: HempQuizEntry[] = [];
    for (const level of [1, 2, 3, 4] as const) {
      const original = legacyEntry(level);
      for (const topic of HEMP_QUIZ_TOPICS) {
        if (topic.id === 'uses' && level !== 1) continue;
        const id = `hemp-early-${level}-${topic.id}`;
        pool.push({...original, id, topicId: topic.id, subjectKey: id});
      }
    }
    for (let seed = 0; seed < 60; seed++) {
      const plan = createKqSchoolQuestionPlan(`early-${seed}`, 3, pool, HEMP_QUIZ_SOURCES);
      expect(new Set(plan.questions.map(item => item.question.themeId))).toEqual(new Set(HEMP_QUIZ_TOPICS.map(topic => topic.id)));
      expect(plan.questions.find(item => item.question.themeId === 'uses')?.question.level).toBe(1);
    }
  });
  it('keeps subjects distinct when two themes require the same subject', () => {
    const pool: HempQuizEntry[] = [];
    for (const level of [1, 2, 3, 4] as const) {
      const original = legacyEntry(level);
      for (let index = 0; index < 4; index++) {
        const id = `hemp-conflict-${level}-${index}`;
        pool.push({...original, id, topicId: 'plant', subjectKey: id});
      }
      if (level <= 2) pool.push({...original, id: `hemp-shared-${level}`, topicId: level === 1 ? 'seeds' : 'genetics', subjectKey: 'shared-object'});
    }
    for (let seed = 0; seed < 20; seed++) {
      const plan = createKqSchoolQuestionPlan(`conflict-${seed}`, 3, pool, HEMP_QUIZ_SOURCES);
      expect(new Set(plan.questions.map(item => pool.find(entry => entry.id === item.question.id)!.subjectKey)).size).toBe(12);
      expect(new Set(plan.questions.map(item => item.question.themeId)).size).toBeLessThanOrEqual(2);
    }
  });
  it('preserves subjects when an earlier choice makes theme reservations conflict', () => {
    // A different prefix can cover all ten themes. The bounded greedy preference
    // must still preserve distinct subjects when its own prefix prevents that.
    const rows: [string, HempQuizEntry['level'], HempQuizEntry['topicId'], string][] = [
      ['history-z', 1, 'history', 'z'], ['plant-z', 1, 'plant', 'z'],
      ['h1-0', 1, 'history', 'h1-0'], ['h1-1', 1, 'history', 'h1-1'], ['h1-2', 1, 'history', 'h1-2'],
      ['l2-genetics', 2, 'genetics', 'l2-genetics'], ['l2-molecules', 2, 'molecules', 'l2-molecules'], ['l2-evidence', 2, 'evidence', 'l2-evidence'],
      ['l3-seeds', 3, 'seeds', 'l3-seeds'], ['l3-profiles', 3, 'profiles', 'l3-profiles'], ['l3-biodiversity', 3, 'biodiversity', 'l3-biodiversity'],
      ['plant-s', 4, 'plant', 's'], ['uses-s', 4, 'uses', 's'], ['l4-prevention', 4, 'prevention', 'l4-prevention'],
      ['h4-0', 4, 'history', 'h4-0'], ['h4-1', 4, 'history', 'h4-1'], ['h4-2', 4, 'history', 'h4-2'],
    ];
    const pool = rows.map(([id, level, topicId, subjectKey]) => ({
      ...legacyEntry(level), id, level, topicId, subjectKey,
    }));
    const plan = createKqSchoolQuestionPlan('independent-review-0', 3, pool, HEMP_QUIZ_SOURCES);
    expect(plan.questions).toHaveLength(12);
    expect(new Set(plan.questions.map(item => pool.find(entry => entry.id === item.question.id)!.subjectKey)).size).toBe(12);
    expect(new Set(plan.questions.map(item => item.question.themeId)).size).toBeGreaterThanOrEqual(9);
    plan.questions.forEach((item, index) => expect(item.question.level).toBe(Math.floor(index / 3) + 1));
  });
  it('can reproduce a stored draw while new draws differ', () => {
    expect(createKqSchoolTournamentPlan('same')).toEqual(createKqSchoolTournamentPlan('same'));
    expect(createKqSchoolTournamentPlan('same')).not.toEqual(createKqSchoolTournamentPlan('different'));
    expect(createKqSchoolTournamentPlan()).not.toEqual(createKqSchoolTournamentPlan());
  });
  it('rotates 12-question quotas to 80/10/10 across five deterministic allocations', () => {
    const pool = classifiedPool();
    const seeds = ['rotation-4', 'rotation-1', 'rotation-0', 'rotation-2', 'rotation-10'];
    const totals = [0, 0, 0];
    seeds.forEach((seed, rotation) => {
      const plan = createKqSchoolQuestionPlan(seed, 3, pool, HEMP_QUIZ_SOURCES);
      const expected = rotation < 3 ? [10, 1, 1] : rotation === 3 ? [9, 2, 1] : [9, 1, 2];
      expect(domainCounts(plan, pool)).toEqual(expected);
      expected.forEach((count, index) => { totals[index] += count; });
      expect(createKqSchoolQuestionPlan(seed, 3, pool, HEMP_QUIZ_SOURCES)).toEqual(plan);
      expect(new Set(plan.questions.map(item => pool.find(entry => entry.id === item.question.id)!.subjectKey)).size).toBe(12);
      expect(new Set(plan.questions.map(item => item.question.themeId))).toEqual(new Set(['molecules']));
      plan.questions.forEach(({question, answer}, index) => {
        const original = pool.find(entry => entry.id === question.id)!;
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options.map(choice => choice.id)).size).toBe(4);
        expect(question.options.find(choice => choice.id === answer.correctOptionId)?.text).toBe(original.options[original.answer]);
        expect(question.level).toBe(Math.floor(index / 3) + 1);
        if (index % 3 === 0) expect(original.domain).toBe('active');
        expect(question).not.toHaveProperty('domain');
        expect(question).not.toHaveProperty('subjectKey');
        expect(question).not.toHaveProperty('answer');
      });
      for (let level = 1; level <= 4; level++) {
        expect(plan.questions.filter(item => item.question.level === level && pool.find(entry => entry.id === item.question.id)!.domain !== 'active').length).toBeLessThanOrEqual(1);
      }
    });
    expect(totals).toEqual([48, 6, 6]);
  });
  it('applies exact 20-question domain quotas with four active and one secondary per level', () => {
    const pool = classifiedPool();
    for (let index = 0; index < 20; index++) {
      const plan = createKqSchoolQuestionPlan(`classified-20-${index}`, 5, pool, HEMP_QUIZ_SOURCES);
      expect(domainCounts(plan, pool)).toEqual([16, 2, 2]);
      expect(new Set(plan.questions.map(item => pool.find(entry => entry.id === item.question.id)!.subjectKey)).size).toBe(20);
      for (let level = 1; level <= 4; level++) {
        const selected = plan.questions.filter(item => item.question.level === level).map(item => pool.find(entry => entry.id === item.question.id)!);
        expect(selected).toHaveLength(5);
        expect(selected.filter(item => item.domain === 'active')).toHaveLength(4);
        expect(selected[0].domain).toBe('active');
      }
    }
  });
  it('solves rare subjects, levels and domains jointly instead of reserving them independently', () => {
    const pool: HempQuizEntry[] = [];
    // Only level 1 can supply food; only level 4 can supply materials. Both
    // secondary subjects are tempting active candidates in other levels.
    for (const level of [1, 2, 3, 4] as const) {
      for (let index = 0; index < (level === 1 || level === 4 ? 2 : 3); index++) {
        pool.push({...legacyEntry(level), id: `hemp-joint-${level}-${index}`, domain: 'active', subjectKey: `active-${level}-${index}`});
      }
      pool.push({...legacyEntry(level), id: `hemp-joint-decoy-${level}`, domain: 'active', subjectKey: level <= 2 ? 'rare-food' : 'rare-materials'});
    }
    pool.push({...legacyEntry(1), id:'hemp-joint-food', domain:'food', subjectKey:'rare-food'});
    pool.push({...legacyEntry(4), id:'hemp-joint-materials', domain:'materials', subjectKey:'rare-materials'});
    for (const seed of ['rotation-4', 'rotation-1', 'rotation-0']) {
      const plan = createKqSchoolQuestionPlan(seed, 3, pool, HEMP_QUIZ_SOURCES);
      expect(domainCounts(plan, pool)).toEqual([10, 1, 1]);
      expect(new Set(plan.questions.map(item => pool.find(entry => entry.id === item.question.id)!.subjectKey)).size).toBe(12);
      expect(plan.questions.some(item => item.question.id === 'hemp-joint-food')).toBe(true);
      expect(plan.questions.some(item => item.question.id === 'hemp-joint-materials')).toBe(true);
    }
  });
  it('declares impossible domain quotas, partial classifications and repeated-subject requirements', () => {
    const pool = classifiedPool();
    expect(() => createKqSchoolQuestionPlan('rotation-4', 3, pool.filter(item => item.domain !== 'food'), HEMP_QUIZ_SOURCES)).toThrow('impossible hemp domain quotas');
    expect(() => createKqSchoolQuestionPlan('rotation-2', 3, pool.filter(item => item.domain !== 'food' || item.level === 1), HEMP_QUIZ_SOURCES)).toThrow('impossible hemp domain quotas');
    expect(() => createKqSchoolQuestionPlan('rotation-4', 3, pool.map((item, index) => index ? item : {...item, domain:undefined}), HEMP_QUIZ_SOURCES)).toThrow('incomplete hemp domain classification');
    expect(() => createKqSchoolQuestionPlan('rotation-4', 3, pool.map(item => ({...item, subjectKey:'one-subject'})), HEMP_QUIZ_SOURCES)).toThrow('domain quotas cannot provide distinct subjects');
    // There are enough total questions from each domain, but putting all
    // secondary entries in one level cannot satisfy one secondary per level.
    expect(() => createKqSchoolQuestionPlan('rotation-4', 3, pool.filter(item => item.domain === 'active' || item.level === 1), HEMP_QUIZ_SOURCES)).toThrow('impossible hemp domain quotas');
  });
});
