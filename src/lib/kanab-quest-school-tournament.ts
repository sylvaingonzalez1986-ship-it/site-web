import type { KqSchoolChallengeQuestion } from './kanab-quest-school-challenge';
import type { ChanvrierAvatarProfile } from './arena-chanvrier';
import type { KqTournamentBotCode } from './kanab-quest-school-tournament-bots';
import { isKqSchoolUuid } from './kanab-quest-school';

export const KQ_TOURNAMENT_VERSION = '2026-11-14.champion1';
export const KQ_TOURNAMENT_QUESTION_MS = 20_000;
export const KQ_TOURNAMENT_STAGES = [
  { stage: 1, title: 'Les qualifications', entrants: 4, survivors: 3 },
  { stage: 2, title: 'La demi-finale', entrants: 3, survivors: 2 },
  { stage: 3, title: 'La finale', entrants: 2, survivors: 1 },
  { stage: 4, title: 'Le fauteuil', entrants: 1, survivors: 1 },
] as const;

export type KqTournamentCommand =
  | { action: 'join'; requestKey: string }
  | { action: 'leave'; requestKey: string; roomId: string }
  | { action: 'fill_replays'; requestKey: string; roomId: string }
  | { action: 'fill_opponents'; requestKey: string; roomId: string }
  | { action: 'ready'; requestKey: string; roomId: string; ready: boolean }
  | { action: 'answer'; requestKey: string; roomId: string; questionId: string; optionId: string };

export type KqTournamentIdentity = { userId: string; displayName: string; avatarUrl: string | null; avatar?: ChanvrierAvatarProfile | null };
export type KqTournamentChampion = KqTournamentIdentity & {
  score: number; correctCount: number; elapsedMs: number; since: string; defenses: number;
};
export type KqTournamentPlayer = KqTournamentIdentity & {
  seat: number; ready: boolean; connected: boolean; isActive: boolean;
  isReplay: boolean; replayRecordedAt: string | null;
  isBot: boolean; botCode: KqTournamentBotCode | null;
  stageScore: number; stageElapsedMs: number; score: number; correctCount: number; answered: boolean;
};
export type KqTournamentRanking = KqTournamentIdentity & {
  rank: number; tournaments: number; finals: number; titles: number; bestScore: number;
};
export type KqTournamentWeeklyRanking = KqTournamentIdentity & {
  rank: number; score: number; correctCount: number; elapsedMs: number; completedAt: string;
};
export type KqTournamentReveal = {
  question: KqSchoolChallengeQuestion; correctOptionId: string; explanation: string;
  answers: { userId: string; optionId: string | null; isCorrect: boolean; awardedPoints: number; elapsedMs: number }[];
};
export type KqTournamentRoom = {
  id: string;
  editionDate: string | null; resultEditionDate: string | null; autofillAt: string | null;
  status: 'lobby' | 'question' | 'reveal' | 'stage_result' | 'champion_wait' | 'complete' | 'cancelled';
  stage: number; questionNumber: number; availableReplays: number;
  players: KqTournamentPlayer[];
  question: KqSchoolChallengeQuestion | null;
  openedAt: string | null; closesAt: string | null; nextAt: string | null;
  ownAnswerId: string | null; reveal: KqTournamentReveal | null;
  championTarget: KqTournamentChampion | null;
  winnerId: string | null; eliminatedIds: string[]; titleWon: boolean;
  reason: string | null;
};
export type KqTournamentEvent = {
  timeZone: 'Europe/Paris'; isOpen: boolean; editionDate: string;
  opensAt: string; closesAt: string; nextOpensAt: string; awardAt: string;
  participated: boolean; completed: boolean;
};
export type KqTournamentSnapshot = {
  version: 1; ownerId: string; serverNow: string;
  event: KqTournamentEvent;
  champion: KqTournamentChampion | null; leaderboard: KqTournamentRanking[]; weeklyLeaderboard: KqTournamentWeeklyRanking[];
  room: KqTournamentRoom | null; replayed: boolean;
};

/** Only these commands cross the browser boundary; clocks and grades stay on the server. */
export function parseKqSchoolTournamentCommand(value: unknown): KqTournamentCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!isKqSchoolUuid(input.requestKey)) return null;
  const keys = input.action === 'join' ? ['action', 'requestKey']
    : input.action === 'leave' || input.action === 'fill_replays' || input.action === 'fill_opponents' ? ['action', 'requestKey', 'roomId']
      : input.action === 'ready' ? ['action', 'requestKey', 'roomId', 'ready']
        : input.action === 'answer' ? ['action', 'requestKey', 'roomId', 'questionId', 'optionId'] : [];
  if (!keys.length || keys.length !== Object.keys(input).length || !keys.every(key => Object.hasOwn(input, key))) return null;
  const requestKey = input.requestKey.toLowerCase();
  if (input.action === 'join') return { action: 'join', requestKey };
  if (!isKqSchoolUuid(input.roomId)) return null;
  const roomId = input.roomId.toLowerCase();
  if (input.action === 'leave' || input.action === 'fill_replays' || input.action === 'fill_opponents') return { action: input.action, requestKey, roomId };
  if (input.action === 'ready') return typeof input.ready === 'boolean' ? { action: 'ready', requestKey, roomId, ready: input.ready } : null;
  if (typeof input.questionId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.questionId)
    || typeof input.optionId !== 'string' || !/^[a-d]$/.test(input.optionId)) return null;
  return { action: 'answer', requestKey, roomId, questionId: input.questionId, optionId: input.optionId };
}
