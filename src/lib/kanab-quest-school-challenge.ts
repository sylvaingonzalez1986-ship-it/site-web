import type { KqSchoolQuestion } from "./kanab-quest-school-content";
import type { KqSchoolCorrection } from "./kanab-quest-school";
import { isKqSchoolUuid } from "./kanab-quest-school";

export const KQ_SCHOOL_CHALLENGE_VERSION = "2026-11-13.hemp2";
export const KQ_SCHOOL_CHALLENGE_LENGTH = 20;
export type KqSchoolChallengeLevel = 1 | 2 | 3 | 4;
export type KqSchoolChallengeQuestion = KqSchoolQuestion & { themeId: string; level: KqSchoolChallengeLevel };
export type KqSchoolChallengeFeedback = KqSchoolCorrection & {
  question: KqSchoolChallengeQuestion; level: KqSchoolChallengeLevel; basePoints: number; bonusPoints: number; awardedPoints: number; elapsedMs: number;
};
export type KqSchoolChallengeRound = {
  id: string; contentVersion: string; status: "question" | "feedback" | "complete";
  questionNumber: number; totalQuestions: 20; level: KqSchoolChallengeLevel;
  score: number; correctCount: number; answeredCount: number; openedAt: string;
  question: KqSchoolChallengeQuestion | null; feedback: KqSchoolChallengeFeedback | null; answers: KqSchoolChallengeFeedback[];
};
export type KqSchoolChallengeSnapshot = {
  version: 1; ownerId: string; serverNow: string; bestScore: number; bestCorrectCount: number;
  completedCount: number; round: KqSchoolChallengeRound | null; replayed: boolean;
};
export type KqSchoolChallengeCommand =
  | { action: "start"; requestKey: string; replaceRoundId?: string }
  | { action: "answer"; requestKey: string; roundId: string; questionId: string; optionId: string }
  | { action: "next"; requestKey: string; roundId: string; questionId: string };

export function parseKqSchoolChallengeCommand(value: unknown): KqSchoolChallengeCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!isKqSchoolUuid(input.requestKey)) return null;
  const keys = input.action === "start" ? ["action", "requestKey", ...(Object.hasOwn(input, "replaceRoundId") ? ["replaceRoundId"] : [])]
    : input.action === "answer" ? ["action", "requestKey", "roundId", "questionId", "optionId"]
      : input.action === "next" ? ["action", "requestKey", "roundId", "questionId"] : [];
  if (!keys.length || Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key))) return null;
  if (input.action === "start") {
    if (Object.hasOwn(input, "replaceRoundId") && !isKqSchoolUuid(input.replaceRoundId)) return null;
    return { action: "start", requestKey: input.requestKey.toLowerCase(), ...(input.replaceRoundId ? { replaceRoundId: (input.replaceRoundId as string).toLowerCase() } : {}) };
  }
  const identifier = (item: unknown): item is string => typeof item === "string" && /^[a-z0-9-]{1,80}$/.test(item);
  if (!isKqSchoolUuid(input.roundId) || !identifier(input.questionId) || (input.action === "answer" && !identifier(input.optionId))) return null;
  return { action: input.action as "answer" | "next", requestKey: input.requestKey.toLowerCase(), roundId: input.roundId.toLowerCase(), questionId: input.questionId,
    ...(input.action === "answer" ? { optionId: input.optionId as string } : {}) } as KqSchoolChallengeCommand;
}

/** Display/reference formula. The authoritative elapsed time is measured in SQL. */
export function getKqSchoolChallengePoints(correct: boolean, elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error("Invalid elapsed time");
  const basePoints = correct ? 100 : 0;
  const bonusPoints = correct ? Math.floor(50 * Math.max(0, 20000 - elapsedMs) / 20000) : 0;
  return { basePoints, bonusPoints, awardedPoints: basePoints + bonusPoints };
}
