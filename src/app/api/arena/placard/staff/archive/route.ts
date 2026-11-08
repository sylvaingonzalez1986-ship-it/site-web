import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getKqStaffArchive } from "@/lib/supabase/kanab-quest-staff-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => !["kind", "employeeId", "afterAt", "afterId"].includes(key) || params.getAll(key).length !== 1)) {
    return NextResponse.json({ error: "La demande d’archives est invalide." }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await getKqStaffArchive(session.customerId, {
      kind: params.get("kind"), employeeId: params.get("employeeId"), afterAt: params.get("afterAt"), afterId: params.get("afterId"),
    }), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "[supabase:staff] archive_unavailable";
    const internal = message.startsWith("[supabase:");
    return NextResponse.json({ error: internal ? "Les archives du personnel sont momentanément indisponibles." : message }, { status: internal ? 503 : 400, headers });
  }
}
