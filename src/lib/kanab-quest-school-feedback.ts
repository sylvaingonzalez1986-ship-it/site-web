import { isKqSchoolQuizId, isKqSchoolUuid, type KqSchoolCorrection, type KqSchoolQuizId } from "./kanab-quest-school";

export type KqSchoolCheckSubmission = { requestKey: string; quizId: KqSchoolQuizId; contentVersion: string; selectionId: string; questionId: string; optionId: string };
export type KqSchoolQuestionFeedback = { ownerId: string; requestKey: string; correction: KqSchoolCorrection; replayed: boolean };
const prefixes: Record<KqSchoolQuizId, string> = { plant: "b1", molecules: "t1", profiles: "v1", genetics: "u1", history: "h1", uses: "s1", evidence: "c1", biodiversity: "p1", law: "l1", prevention: "r1" };
export function parseKqSchoolCheck(value: unknown): KqSchoolCheckSubmission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 6 || !isKqSchoolUuid(input.requestKey) || !isKqSchoolQuizId(input.quizId)
    || typeof input.contentVersion !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(input.contentVersion)
    || typeof input.selectionId !== "string" || !new RegExp("^" + prefixes[input.quizId] + "\\.[0-9a-f-]{36}\\.[0-9a-f]{64}$").test(input.selectionId)
    || typeof input.questionId !== "string" || !/^[a-z0-9-]{1,80}$/.test(input.questionId)
    || typeof input.optionId !== "string" || !/^[a-z0-9-]{1,80}$/.test(input.optionId)) return null;
  return { requestKey: input.requestKey.toLowerCase(), quizId: input.quizId, contentVersion: input.contentVersion, selectionId: input.selectionId, questionId: input.questionId, optionId: input.optionId };
}
