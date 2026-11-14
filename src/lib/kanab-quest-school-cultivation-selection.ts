import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "./supabase/env";
import { CULTIVATION_QUESTIONS, VERSION } from "./kanab-quest-school-cultivation";
import { isKqSchoolUuid } from "./kanab-quest-school";

const domain = "kq-school-cultivation-selection:v1";
const digest = (ownerId: string, seed: string) => createHmac("sha256", getSupabaseServiceRoleKey())
  .update(`${domain}\n${ownerId.toLowerCase()}\n${VERSION}\n${seed}`).digest("hex");

/** Stable plan across reading breaks; owner, course and edition bind its signature. */
export function createKqSchoolCultivationSelection(ownerId: string): string {
  if (!isKqSchoolUuid(ownerId)) throw new Error("[school] invalid selection owner");
  const seed = randomUUID();
  return `u1.${seed}.${digest(ownerId, seed)}`;
}

export function selectKqSchoolCultivationQuestions(ownerId: string | undefined, selectionId: string | undefined): (typeof CULTIVATION_QUESTIONS)[number][] | null {
  if (!isKqSchoolUuid(ownerId) || !selectionId) return null;
  const match = /^u1\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(selectionId);
  if (!match || !isKqSchoolUuid(match[1])) return null;
  const [, seed, signature] = match;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(ownerId, seed), "hex"))) return null;
  const chapters = [...new Set(CULTIVATION_QUESTIONS.map(question => question.chapterId))];
  if (CULTIVATION_QUESTIONS.length !== 32 || chapters.length !== 8
    || new Set(CULTIVATION_QUESTIONS.map(question => question.id)).size !== 32
    || chapters.some(chapter => CULTIVATION_QUESTIONS.filter(question => question.chapterId === chapter).length !== 4)) throw new Error("[school] invalid cultivation bank");
  const rank = (value: string) => createHash("sha256").update(`${domain}\n${seed}\n${value}`).digest("hex");
  // One from every chapter, then a second distinct question from two rotating chapters.
  const ranked = chapters.sort((left, right) => rank(`chapter:${left}`).localeCompare(rank(`chapter:${right}`)))
    .map(chapter => CULTIVATION_QUESTIONS.filter(question => question.chapterId === chapter)
      .sort((left, right) => rank(`question:${left.id}`).localeCompare(rank(`question:${right.id}`))));
  return [...ranked.map(questions => questions[0]), ...ranked.slice(0, 2).map(questions => questions[1])]
    .sort((left, right) => rank(`order:${left.id}`).localeCompare(rank(`order:${right.id}`)));
}
