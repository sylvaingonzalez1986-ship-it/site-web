import { parseKqSchoolCultivationProgress } from "@/lib/kanab-quest-school-cultivation-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolCultivation } from "@/lib/supabase/kanab-quest-school-cultivation-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolCultivation(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolCultivationProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression invalide.", 400);
    return getKqSchoolCultivation(userId, command);
  });
}
