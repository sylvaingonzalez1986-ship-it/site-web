import { parseKqSchoolSoilProgress } from "@/lib/kanab-quest-school-soil-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolSoil } from "@/lib/supabase/kanab-quest-school-soil-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolSoil(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolSoilProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression invalide.", 400);
    return getKqSchoolSoil(userId, command);
  });
}
