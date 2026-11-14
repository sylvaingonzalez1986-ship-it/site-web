import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceRoleKey } from "./supabase/env";
import { getKqSchoolModule } from "./kanab-quest-school-content";
const law = getKqSchoolModule("law")!;
const VERSION = law.version;
import { isKqSchoolUuid } from "./kanab-quest-school";

const domain = "kq-school-law-selection:v1";
const digest = (ownerId: string, seed: string) => createHmac("sha256", getSupabaseServiceRoleKey())
  .update(`${domain}\n${ownerId.toLowerCase()}\n${VERSION}\n${seed}`).digest("hex");

/** Stable reading-break plan, signed for one player, course and content edition. */
export function createKqSchoolLawSelection(ownerId: string): string {
  if (!isKqSchoolUuid(ownerId)) throw new Error("[school] invalid selection owner");
  const seed = randomUUID();
  return `l1.${seed}.${digest(ownerId, seed)}`;
}

export function selectKqSchoolLawQuestions(ownerId: string | undefined, selectionId: string | undefined): typeof law.questions | null {
  if (!isKqSchoolUuid(ownerId) || !selectionId) return null;
  const match = /^l1\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(selectionId);
  if (!match || !isKqSchoolUuid(match[1])) return null;
  const [, seed, signature] = match;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(digest(ownerId, seed), "hex"))) return null;
  return law.questions;
}
