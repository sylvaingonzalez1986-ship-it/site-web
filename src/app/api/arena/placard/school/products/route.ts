import { parseKqSchoolProductsProgress } from "@/lib/kanab-quest-school-products-progress";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { getKqSchoolProducts } from "@/lib/supabase/kanab-quest-school-products-backend";
import { readSchoolBody, schoolRequest } from "../_request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, userId => getKqSchoolProducts(userId)); }
export async function POST(request: Request) {
  return schoolRequest(request, async userId => {
    const command = parseKqSchoolProductsProgress(await readSchoolBody(request));
    if (!command) throw new KqSchoolError("Progression invalide.", 400);
    return getKqSchoolProducts(userId, command);
  });
}
