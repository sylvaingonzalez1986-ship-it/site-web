import type { KqSchoolChallengeLevel } from './kanab-quest-school-challenge';

export type HempQuizTopic = 'plant' | 'genetics' | 'molecules' | 'evidence' | 'uses' | 'biodiversity' | 'profiles' | 'prevention' | 'seeds' | 'history';
export type HempQuizDomain = 'active' | 'food' | 'materials';
/** Authoring data stays in server-only modules; the client receives one public question. */
export type HempQuizEntry = Readonly<{
  id: string;
  topicId: HempQuizTopic;
  level: KqSchoolChallengeLevel;
  prompt: string;
  options: readonly [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
  articleId: string;
  sourceIds: readonly string[];
  /** Private editorial identity: e.g. a cultivar, not a whole topic such as Cannabis. */
  subjectKey?: string;
  /** Private editorial classification used for the actual draw's 80/10/10 quotas. */
  domain?: HempQuizDomain;
}>;
