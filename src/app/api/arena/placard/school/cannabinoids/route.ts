import { parseKqSchoolCannabinoidsProgress } from "@/lib/kanab-quest-school-cannabinoids-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolCannabinoids } from "@/lib/supabase/kanab-quest-school-cannabinoids-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolCannabinoids(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolCannabinoidsProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression invalide.", 400);
    return getKqSchoolCannabinoids(userId, command);
  });
}
