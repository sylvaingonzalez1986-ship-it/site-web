import type { KqSchoolQuestion, KqSchoolSource } from "./kanab-quest-school-content";

export const KQ_SCHOOL_QUIZ_IDS = ["plant", "molecules", "profiles", "genetics", "history", "uses", "evidence", "biodiversity", "law", "prevention"] as const;
export type KqSchoolQuizId = (typeof KQ_SCHOOL_QUIZ_IDS)[number];
export const KQ_SCHOOL_WORKSHOP_IDS = ["crossword-plant", "crossword-uses", "timeline-history", "matching-plant", "matching-evidence", "matching-molecules"] as const;
export const KQ_SCHOOL_PASS_SCORE = 7;

export type KqSchoolAnswer = { questionId: string; optionId: string };
export type KqSchoolSubmission = { requestKey: string; quizId: KqSchoolQuizId; contentVersion: string; answers: KqSchoolAnswer[]; selectionId?: string };
export type KqSchoolProgress = { lessonIds: KqSchoolQuizId[]; workshopIds: string[] };
export type KqSchoolQuizProgress = {
  quizId: KqSchoolQuizId; rewardId: string; budgetCents: number; bestScore: number | null;
  paidCents: number; remainingCents: number; attempts: number; lastAttemptAt: string | null;
};
export type KqSchoolSnapshot = KqSchoolProgress & {
  version: 1; ownerId: string; cashCents: number; quizzes: KqSchoolQuizProgress[]; totalBudgetCents: number; totalPaidCents: number;
};
export type KqSchoolQuiz = { quizId: KqSchoolQuizId; contentVersion: string; questions: KqSchoolQuestion[]; selectionId?: string };
export type KqSchoolCorrection = {
  questionId: string; optionId: string; correctOptionId: string; isCorrect: boolean;
  explanation: string; lessonId: string; sectionId: string; sources: readonly KqSchoolSource[]; buddyCodes?: readonly string[];
  optionExplanations?: Readonly<Record<string, string>>;
};
export type KqSchoolResult = {
  requestKey: string; quizId: KqSchoolQuizId; contentVersion: string; score: number; bestScore: number; passed: boolean;
  gainCents: number; paidCents: number; remainingCents: number; cashCents: number; corrections: KqSchoolCorrection[];
};
export type KqSchoolCompletion = { snapshot: KqSchoolSnapshot; result: KqSchoolResult; replayed: boolean };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const identifier = /^[a-z0-9-]{1,80}$/;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const isKqSchoolUuid = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
export const isKqSchoolQuizId = (value: unknown): value is KqSchoolQuizId => typeof value === "string" && KQ_SCHOOL_QUIZ_IDS.includes(value as KqSchoolQuizId);

/** Only answers travel from the browser. Ownership, score and amounts have no input fields. */
export function parseKqSchoolSubmission(value: unknown): KqSchoolSubmission | null {
  if (!record(value)) return null;
  const selectionIncluded = Object.hasOwn(value, "selectionId");
  if (!exactKeys(value, ["requestKey", "quizId", "contentVersion", "answers", ...(selectionIncluded ? ["selectionId"] : [])])
    || !isKqSchoolUuid(value.requestKey) || !isKqSchoolQuizId(value.quizId)
    || typeof value.contentVersion !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(value.contentVersion)
    || !Array.isArray(value.answers) || value.answers.length !== 10
    || (selectionIncluded && (typeof value.selectionId !== "string"
      || !(value.quizId === "history" ? /^h1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "plant" ? /^b1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "molecules" ? /^t1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "evidence" ? /^c1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "genetics" ? /^u1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "biodiversity" ? /^p1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "uses" ? /^s1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "profiles" ? /^v1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "prevention" ? /^r1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : value.quizId === "law" ? /^l1\.[0-9a-f-]{36}\.[0-9a-f]{64}$/ : /$^/).test(value.selectionId)))) return null;
  const answers: KqSchoolAnswer[] = [];
  for (const answer of value.answers) {
    if (!record(answer) || !exactKeys(answer, ["questionId", "optionId"])
      || typeof answer.questionId !== "string" || !identifier.test(answer.questionId)
      || typeof answer.optionId !== "string" || !identifier.test(answer.optionId)) return null;
    answers.push({ questionId: answer.questionId, optionId: answer.optionId });
  }
  if (new Set(answers.map(answer => answer.questionId)).size !== 10) return null;
  // Canonical ordering makes a transport retry independent from UI display order.
  answers.sort((left, right) => left.questionId.localeCompare(right.questionId));
  return { requestKey: value.requestKey.toLowerCase(), quizId: value.quizId, contentVersion: value.contentVersion, answers,
    ...(selectionIncluded ? { selectionId: value.selectionId as string } : {}) };
}

export function parseKqSchoolProgress(value: unknown): KqSchoolProgress | null {
  if (!record(value) || !exactKeys(value, ["lessonIds", "workshopIds"])
    || !Array.isArray(value.lessonIds) || value.lessonIds.length > 10 || !value.lessonIds.every(isKqSchoolQuizId)
    || !Array.isArray(value.workshopIds) || value.workshopIds.length > KQ_SCHOOL_WORKSHOP_IDS.length
    || !value.workshopIds.every(id => typeof id === "string" && KQ_SCHOOL_WORKSHOP_IDS.includes(id as (typeof KQ_SCHOOL_WORKSHOP_IDS)[number]))) return null;
  return { lessonIds: [...new Set(value.lessonIds)].sort(), workshopIds: [...new Set(value.workshopIds as string[])].sort() };
}

/** Display/test helper. The transaction uses the database's configured budget. */
export function getKqSchoolRewardTarget(score: number, budgetCents: number): number {
  if (!Number.isInteger(score) || score < 0 || score > 10 || !Number.isSafeInteger(budgetCents) || budgetCents < 0) throw new Error("Invalid school reward inputs");
  return score < KQ_SCHOOL_PASS_SCORE ? 0 : Math.floor(budgetCents * score / 10);
}
