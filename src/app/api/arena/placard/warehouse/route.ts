import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import { getKqWarehouseSnapshot, KqWarehouseError, saveKqWarehouseLayout } from "@/lib/supabase/kanab-quest-warehouse-backend";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 300_000;
const noStore = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  if (error instanceof KqWarehouseError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
  return NextResponse.json({ error: "Entrepôt momentanément indisponible." }, { status: 500, headers: noStore });
}

async function readPayload(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) throw new KqWarehouseError("Le plan envoyé est trop volumineux.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new KqWarehouseError("Plan d’aménagement manquant.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new KqWarehouseError("Le plan envoyé est trop volumineux.", 413);
      }
      chunks.push(value);
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_json_object");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof KqWarehouseError) throw error;
    throw new KqWarehouseError("Le plan d’aménagement est illisible.");
  } finally { reader.releaseLock(); }
}

export async function GET() {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers: noStore });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: noStore });
  try { return NextResponse.json(await getKqWarehouseSnapshot(session.customerId), { headers: noStore }); }
  catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers: noStore });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: noStore });
  const rate = await hitRateLimit({ key: `kq_warehouse:${session.customerId}:${getRequestIp(request)}`, windowSeconds: 60, maxHits: 30 });
  if (!rate.allowed) return NextResponse.json({ error: "Trop de modifications. Réessaie dans un instant.", retryAfterSeconds: rate.retryAfterSeconds }, {
    status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) },
  });
  try {
    const payload = await readPayload(request);
    return NextResponse.json(await saveKqWarehouseLayout({
      userId: session.customerId, requestKey: payload.requestKey as string,
      expectedRevision: payload.expectedRevision as number, state: payload.state,
      expectedCostCents: payload.expectedCostCents as number,
    }), { headers: noStore });
  } catch (error) { return failure(error); }
}
