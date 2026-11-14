import { describe, expect, it } from 'vitest';
import { createKqSchoolChallengePlan } from './kanab-quest-school-challenge-server';
import { createKqSchoolTournamentPlan } from './kanab-quest-school-tournament-server';
import { KQ_TOURNAMENT_VERSION } from './kanab-quest-school-tournament';

describe('private tournament draw', () => {
  it('uses three unique questions per level from the existing private hemp bank', () => {
    for (let index = 0; index < 10; index++) {
      const seed = 'tournament-' + index, plan = createKqSchoolTournamentPlan(seed);
      expect(plan.contentVersion).toBe(KQ_TOURNAMENT_VERSION);
      expect(plan.questions).toEqual(createKqSchoolChallengePlan(seed).questions.filter((_, position) => position % 5 < 3));
      expect(plan.questions).toHaveLength(12);
      expect(new Set(plan.questions.map(item => item.question.id)).size).toBe(12);
      plan.questions.forEach(({ question, answer }, position) => {
        expect(question.level).toBe(Math.floor(position / 3) + 1);
        expect(question.options.some(choice => choice.id === answer.correctOptionId)).toBe(true);
        expect(question).not.toHaveProperty('correctOptionId');
        expect(question).not.toHaveProperty('answer');
      });
    }
  });
  it('can reproduce a stored draw while new draws differ', () => {
    expect(createKqSchoolTournamentPlan('same')).toEqual(createKqSchoolTournamentPlan('same'));
    expect(createKqSchoolTournamentPlan('same')).not.toEqual(createKqSchoolTournamentPlan('different'));
    expect(createKqSchoolTournamentPlan()).not.toEqual(createKqSchoolTournamentPlan());
  });
});
