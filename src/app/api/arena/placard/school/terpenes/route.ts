import { parseKqSchoolTerpenesProgress } from "@/lib/kanab-quest-school-terpenes-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolTerpenes } from "@/lib/supabase/kanab-quest-school-terpenes-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolTerpenes(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolTerpenesProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression invalide.", 400);
    return getKqSchoolTerpenes(userId, command);
  });
}
