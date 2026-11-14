import { parseKqSchoolHealthProgress } from "@/lib/kanab-quest-school-health-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolHealth } from "@/lib/supabase/kanab-quest-school-health-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolHealth(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolHealthProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression invalide.", 400);
    return getKqSchoolHealth(userId, command);
  });
}
