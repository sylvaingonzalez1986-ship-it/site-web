import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "./supabase/env";
import { HISTORY_QUESTIONS, VERSION } from "./kanab-quest-school-history";
import { isKqSchoolUuid } from "./kanab-quest-school";
import type { HistoryQuizQuestion } from "./kanab-quest-school-history-types";

const domain = "kq-school-history-selection:v1";
const digest = (ownerId: string, seed: string) => createHmac("sha256", getSupabaseServiceRoleKey())
  .update(`${domain}\n${ownerId.toLowerCase()}\n${VERSION}\n${seed}`).digest("hex");

/** No expiry: a reading break must not invalidate a quiz; editorial version does. */
export function createKqSchoolHistorySelection(ownerId: string): string {
  if (!isKqSchoolUuid(ownerId)) throw new Error("[school] invalid selection owner");
  const seed = randomUUID();
  return `h1.${seed}.${digest(ownerId, seed)}`;
}

export function selectKqSchoolHistoryQuestions(ownerId: string | undefined, selectionId: string | undefined): HistoryQuizQuestion[] | null {
  if (!isKqSchoolUuid(ownerId) || !selectionId) return null;
  const match = /^h1\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(selectionId);
  if (!match || !isKqSchoolUuid(match[1])) return null;
  const [, seed, signature] = match;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(ownerId, seed), "hex"))) return null;
  const chapterIds = [...new Set(HISTORY_QUESTIONS.map(question => question.chapterId))];
  if (HISTORY_QUESTIONS.length !== 44 || chapterIds.length !== 11
    || new Set(HISTORY_QUESTIONS.map(question => question.id)).size !== 44
    || chapterIds.some(chapter => HISTORY_QUESTIONS.filter(question => question.chapterId === chapter).length !== 4)) throw new Error("[school] invalid history bank");
  const rank = (value: string) => createHash("sha256").update(`${domain}\n${seed}\n${value}`).digest("hex");
  // Ten different chapters per synthesis; changing an option's visual position
  // cannot change the selected identities or the server's grading reference.
  return chapterIds.sort((left, right) => rank(`chapter:${left}`).localeCompare(rank(`chapter:${right}`))).slice(0, 10)
    .map(chapter => HISTORY_QUESTIONS.filter(question => question.chapterId === chapter)
      .sort((left, right) => rank(`question:${left.id}`).localeCompare(rank(`question:${right.id}`)))[0]);
}
