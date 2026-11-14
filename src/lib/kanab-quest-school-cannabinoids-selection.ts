import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "./supabase/env";
import { CANNABINOID_QUESTIONS, CANNABINOID_VERSION as VERSION } from "./kanab-quest-school-cannabinoids";
import { isKqSchoolUuid } from "./kanab-quest-school";

const domain = "kq-school-cannabinoids-selection:v1";
const digest = (ownerId: string, seed: string) => createHmac("sha256", getSupabaseServiceRoleKey())
  .update(`${domain}\n${ownerId.toLowerCase()}\n${VERSION}\n${seed}`).digest("hex");

/** Stable reading-break plan, signed for one player, course and content edition. */
export function createKqSchoolCannabinoidsSelection(ownerId: string): string {
  if (!isKqSchoolUuid(ownerId)) throw new Error("[school] invalid selection owner");
  const seed = randomUUID();
  return `c1.${seed}.${digest(ownerId, seed)}`;
}

export function selectKqSchoolCannabinoidsQuestions(ownerId: string | undefined, selectionId: string | undefined): (typeof CANNABINOID_QUESTIONS)[number][] | null {
  if (!isKqSchoolUuid(ownerId) || !selectionId) return null;
  const match = /^c1\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(selectionId);
  if (!match || !isKqSchoolUuid(match[1])) return null;
  const [, seed, signature] = match;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(ownerId, seed), "hex"))) return null;
  const chapters = [...new Set(CANNABINOID_QUESTIONS.map(question => question.chapterId))];
  if (CANNABINOID_QUESTIONS.length !== 40 || chapters.length !== 10
    || new Set(CANNABINOID_QUESTIONS.map(question => question.id)).size !== 40
    || chapters.some(chapter => CANNABINOID_QUESTIONS.filter(question => question.chapterId === chapter).length !== 4)) throw new Error("[school] invalid cannabinoids bank");
  const rank = (value: string) => createHash("sha256").update(`${domain}\n${seed}\n${value}`).digest("hex");
  // Every synthesis covers each chapter once; both order and question rotate.
  return chapters.sort((left, right) => rank(`chapter:${left}`).localeCompare(rank(`chapter:${right}`)))
    .map(chapter => CANNABINOID_QUESTIONS.filter(question => question.chapterId === chapter)
      .sort((left, right) => rank(`question:${left.id}`).localeCompare(rank(`question:${right.id}`)))[0]);
}
