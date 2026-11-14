import { parseKqSchoolHarvestProgress } from "@/lib/kanab-quest-school-harvest-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolHarvest } from "@/lib/supabase/kanab-quest-school-harvest-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolHarvest(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolHarvestProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression invalide.", 400);
    return getKqSchoolHarvest(userId, command);
  });
}
