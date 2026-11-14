import { parseKqSchoolProgress } from "@/lib/kanab-quest-school";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { saveKqSchoolProgress } from "@/lib/supabase/kanab-quest-school-backend";
import { readSchoolBody, schoolRequest } from "../_request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const progress = parseKqSchoolProgress(await readSchoolBody(request));
    if (!progress) throw new KqSchoolError("Progression invalide.", 400);
    return saveKqSchoolProgress(userId, progress);
  });
}
