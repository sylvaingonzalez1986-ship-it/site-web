import { parseKqSchoolBotanyProgress } from "@/lib/kanab-quest-school-botany-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolBotany } from "@/lib/supabase/kanab-quest-school-botany-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolBotany(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolBotanyProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression botanique invalide.", 400);
    return getKqSchoolBotany(userId, command);
  });
}
