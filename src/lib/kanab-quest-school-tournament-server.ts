import 'server-only';
import { createKqSchoolChallengePlan, type KqSchoolChallengePlan } from './kanab-quest-school-challenge-server';
import { KQ_TOURNAMENT_VERSION } from './kanab-quest-school-tournament';

export type KqSchoolTournamentPlan = KqSchoolChallengePlan;

/** Shared questions within a tournament; a fresh private draw for each tournament. */
export function createKqSchoolTournamentPlan(seed?: string): KqSchoolTournamentPlan {
  const plan = createKqSchoolChallengePlan(seed);
  return {
    contentVersion: KQ_TOURNAMENT_VERSION,
    questions: plan.questions.filter((_, index) => index % 5 < 3),
  };
}
