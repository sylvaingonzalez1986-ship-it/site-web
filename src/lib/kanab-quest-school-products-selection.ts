import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "./supabase/env";
import { PRODUCTS_QUESTIONS, VERSION } from "./kanab-quest-school-products";
import { isKqSchoolUuid } from "./kanab-quest-school";

const domain = "kq-school-products-selection:v1";
const digest = (ownerId: string, seed: string) => createHmac("sha256", getSupabaseServiceRoleKey())
  .update(`${domain}\n${ownerId.toLowerCase()}\n${VERSION}\n${seed}`).digest("hex");

/** Stable reading-break plan, signed for one player, course and content edition. */
export function createKqSchoolProductsSelection(ownerId: string): string {
  if (!isKqSchoolUuid(ownerId)) throw new Error("[school] invalid selection owner");
  const seed = randomUUID();
  return `v1.${seed}.${digest(ownerId, seed)}`;
}

export function selectKqSchoolProductsQuestions(ownerId: string | undefined, selectionId: string | undefined): (typeof PRODUCTS_QUESTIONS)[number][] | null {
  if (!isKqSchoolUuid(ownerId) || !selectionId) return null;
  const match = /^v1\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(selectionId);
  if (!match || !isKqSchoolUuid(match[1])) return null;
  const [, seed, signature] = match;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(ownerId, seed), "hex"))) return null;
  const chapters = [...new Set(PRODUCTS_QUESTIONS.map(question => question.chapterId))];
  if (PRODUCTS_QUESTIONS.length !== 40 || chapters.length !== 10
    || new Set(PRODUCTS_QUESTIONS.map(question => question.id)).size !== 40
    || chapters.some(chapter => PRODUCTS_QUESTIONS.filter(question => question.chapterId === chapter).length !== 4)) throw new Error("[school] invalid products bank");
  const rank = (value: string) => createHash("sha256").update(`${domain}\n${seed}\n${value}`).digest("hex");
  // Every synthesis covers each chapter once; both order and question rotate.
  return chapters.sort((left, right) => rank(`chapter:${left}`).localeCompare(rank(`chapter:${right}`)))
    .map(chapter => PRODUCTS_QUESTIONS.filter(question => question.chapterId === chapter)
      .sort((left, right) => rank(`question:${left.id}`).localeCompare(rank(`question:${right.id}`)))[0]);
}
