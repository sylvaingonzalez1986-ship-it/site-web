import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "./supabase/env";
import { HARVEST_QUESTIONS, VERSION } from "./kanab-quest-school-harvest";
import { isKqSchoolUuid } from "./kanab-quest-school";

const domain = "kq-school-harvest-selection:v1";
const digest = (ownerId: string, seed: string) => createHmac("sha256", getSupabaseServiceRoleKey())
  .update(`${domain}\n${ownerId.toLowerCase()}\n${VERSION}\n${seed}`).digest("hex");

/** Stable plan across reading breaks; owner, course and edition bind its signature. */
export function createKqSchoolHarvestSelection(ownerId: string): string {
  if (!isKqSchoolUuid(ownerId)) throw new Error("[school] invalid selection owner");
  const seed = randomUUID();
  return `r1.${seed}.${digest(ownerId, seed)}`;
}

export function selectKqSchoolHarvestQuestions(ownerId: string | undefined, selectionId: string | undefined): (typeof HARVEST_QUESTIONS)[number][] | null {
  if (!isKqSchoolUuid(ownerId) || !selectionId) return null;
  const match = /^r1\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(selectionId);
  if (!match || !isKqSchoolUuid(match[1])) return null;
  const [, seed, signature] = match;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(ownerId, seed), "hex"))) return null;
  const chapters = [...new Set(HARVEST_QUESTIONS.map(question => question.chapterId))];
  if (HARVEST_QUESTIONS.length !== 36 || chapters.length !== 9
    || new Set(HARVEST_QUESTIONS.map(question => question.id)).size !== 36
    || chapters.some(chapter => HARVEST_QUESTIONS.filter(question => question.chapterId === chapter).length !== 4)) throw new Error("[school] invalid harvest bank");
  const rank = (value: string) => createHash("sha256").update(`${domain}\n${seed}\n${value}`).digest("hex");
  // One from every chapter, then a second distinct question from one rotating chapter.
  const ranked = chapters.sort((left, right) => rank(`chapter:${left}`).localeCompare(rank(`chapter:${right}`)))
    .map(chapter => HARVEST_QUESTIONS.filter(question => question.chapterId === chapter)
      .sort((left, right) => rank(`question:${left.id}`).localeCompare(rank(`question:${right.id}`))));
  return [...ranked.map(questions => questions[0]), ...ranked.slice(0, 1).map(questions => questions[1])]
    .sort((left, right) => rank(`order:${left.id}`).localeCompare(rank(`order:${right.id}`)));
}
