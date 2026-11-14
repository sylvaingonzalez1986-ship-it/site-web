import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "./supabase/env";
import { HEALTH_QUESTIONS, VERSION } from "./kanab-quest-school-health";
import { isKqSchoolUuid } from "./kanab-quest-school";

const domain = "kq-school-health-selection:v1";
const digest = (ownerId: string, seed: string) => createHmac("sha256", getSupabaseServiceRoleKey())
  .update(`${domain}\n${ownerId.toLowerCase()}\n${VERSION}\n${seed}`).digest("hex");

/** Stable plan across reading breaks; owner, course and edition bind its signature. */
export function createKqSchoolHealthSelection(ownerId: string): string {
  if (!isKqSchoolUuid(ownerId)) throw new Error("[school] invalid selection owner");
  const seed = randomUUID();
  return `p1.${seed}.${digest(ownerId, seed)}`;
}

export function selectKqSchoolHealthQuestions(ownerId: string | undefined, selectionId: string | undefined): (typeof HEALTH_QUESTIONS)[number][] | null {
  if (!isKqSchoolUuid(ownerId) || !selectionId) return null;
  const match = /^p1\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(selectionId);
  if (!match || !isKqSchoolUuid(match[1])) return null;
  const [, seed, signature] = match;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(ownerId, seed), "hex"))) return null;
  const chapters = [...new Set(HEALTH_QUESTIONS.map(question => question.chapterId))];
  if (HEALTH_QUESTIONS.length !== 32 || chapters.length !== 8
    || new Set(HEALTH_QUESTIONS.map(question => question.id)).size !== 32
    || chapters.some(chapter => HEALTH_QUESTIONS.filter(question => question.chapterId === chapter).length !== 4)) throw new Error("[school] invalid health bank");
  const rank = (value: string) => createHash("sha256").update(`${domain}\n${seed}\n${value}`).digest("hex");
  // One from every chapter, then a second distinct question from two rotating chapters.
  const ranked = chapters.sort((left, right) => rank(`chapter:${left}`).localeCompare(rank(`chapter:${right}`)))
    .map(chapter => HEALTH_QUESTIONS.filter(question => question.chapterId === chapter)
      .sort((left, right) => rank(`question:${left.id}`).localeCompare(rank(`question:${right.id}`))));
  return [...ranked.map(questions => questions[0]), ...ranked.slice(0, 2).map(questions => questions[1])]
    .sort((left, right) => rank(`order:${left.id}`).localeCompare(rank(`order:${right.id}`)));
}
