import { parseKqSchoolHistoryProgress } from "@/lib/kanab-quest-school-history-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolHistory } from "@/lib/supabase/kanab-quest-school-history-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolHistory(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolHistoryProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression historique invalide.", 400);
    return getKqSchoolHistory(userId, command);
  });
}
