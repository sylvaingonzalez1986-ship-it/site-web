import { getKqSchoolSnapshot } from "@/lib/supabase/kanab-quest-school-backend";
import { schoolRequest } from "./_request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return schoolRequest(request, getKqSchoolSnapshot); }
