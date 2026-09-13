import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { ARENA_JOURNEY_VERSION, NEW_ARENA_JOURNEY, parseArenaJourneyProgress } from "@/lib/arena-journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store"};
const missing = (error: {code?:string} | null) => error?.code === "42P01" || error?.code === "PGRST205";
async function identity() {
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({error:"Connecte-toi pour découvrir le parcours."},{status:401,headers});
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({error:"Parcours indisponible."},{status:404,headers});
  return session;
}
export async function GET() {
  try {
    const session = await identity(); if (session instanceof Response) return session;
    const result = await createSupabaseServiceClient().from("arena_journey_progress").select("step,status")
      .eq("user_id",session.customerId).eq("version",ARENA_JOURNEY_VERSION).maybeSingle();
    if (result.error && !missing(result.error)) throw result.error;
    return NextResponse.json({userId:session.customerId,progress:parseArenaJourneyProgress(result.data)??NEW_ARENA_JOURNEY,persisted:!result.error},{headers});
  } catch { return NextResponse.json({error:"Le guide est momentanément indisponible."},{status:503,headers}); }
}
export async function POST(request: Request) {
  try {
    const session = await identity(); if (session instanceof Response) return session;
    let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({error:"Étape invalide."},{status:400,headers}); }
    const progress = parseArenaJourneyProgress(body);
    if (!progress) return NextResponse.json({error:"Étape invalide."},{status:400,headers});
    // Only tutorial preferences are written; identity/version always come from the server.
    const result = await createSupabaseServiceClient().from("arena_journey_progress").upsert({user_id:session.customerId,version:ARENA_JOURNEY_VERSION,...progress,updated_at:new Date().toISOString()},{onConflict:"user_id,version"});
    if (result.error && !missing(result.error)) throw result.error;
    return NextResponse.json({progress,persisted:!result.error},{headers});
  } catch { return NextResponse.json({error:"Impossible de mémoriser le parcours."},{status:503,headers}); }
}
