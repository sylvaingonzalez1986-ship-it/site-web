import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getKqCultureWorkQuote } from "@/lib/supabase/kanab-quest-culture-work-backend";
import { getKqPlayerWorkErrorMessage } from "@/lib/kanab-quest-player-work-errors";
import { isKqCultureWorkChoice } from "@/lib/kanab-quest-culture-work";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const workChoice = new URL(request.url).searchParams.get("workChoice");
  if (workChoice !== null && !isKqCultureWorkChoice(workChoice)) return NextResponse.json({ error: "Prise en charge invalide." }, { status: 400 });
  const { runId } = await context.params;
  try {
    const quote = workChoice === null ? await getKqCultureWorkQuote(session.customerId, runId)
      : await getKqCultureWorkQuote(session.customerId, runId, workChoice);
    return NextResponse.json(quote, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = getKqPlayerWorkErrorMessage(error) ?? (error instanceof Error ? error.message : "Prise en charge indisponible.");
    const unavailable = message.startsWith("[supabase:");
    return NextResponse.json({ error: unavailable ? "Prise en charge momentanément indisponible. Actualise avant de lancer l’étape." : message }, { status: unavailable ? 503 : 409, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
