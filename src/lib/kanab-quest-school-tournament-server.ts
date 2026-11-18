import 'server-only';
import { randomUUID } from 'node:crypto';
import { createKqSchoolQuestionPlan, type KqSchoolChallengePlan } from './kanab-quest-school-challenge-server';
import { KQ_TOURNAMENT_VERSION } from './kanab-quest-school-tournament';

export type KqSchoolTournamentPlan = KqSchoolChallengePlan;

/** Shared questions within a tournament; a fresh private draw for each tournament. */
export function createKqSchoolTournamentPlan(seed: string = randomUUID()): KqSchoolTournamentPlan {
  const plan = createKqSchoolQuestionPlan(seed, 3);
  return {
    contentVersion: KQ_TOURNAMENT_VERSION,
    questions: plan.questions,
  };
}
