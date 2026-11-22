import { NextResponse } from "next/server";
import { readRequestBody } from "@/lib/body-size-guard";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqGameRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { isKqWarehouseInputCode, isKqWarehouseInputQuantities, isKqWarehousePreparationCode, KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER, type KqWarehousePreparationCommand } from "@/lib/kanab-quest-warehouse-preparations";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { commitKqWarehousePreparation, getKqWarehousePreparations } from "@/lib/supabase/kanab-quest-warehouse-preparations-backend";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 80;
const accountHeaders = (customerId: string) => ({ ...headers, [KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER]: customerId });

function readCommand(value: unknown): KqWarehousePreparationCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.requestKey !== "string" || !uuid.test(body.requestKey)) return null;
  switch (body.action) {
    case "purchasePack":
      if (typeof body.code !== "string" || !isKqWarehouseInputCode(body.code)
        || typeof body.quantity !== "number" || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 100
        || typeof body.expectedCents !== "number" || !Number.isSafeInteger(body.expectedCents) || body.expectedCents < 1) return null;
      return { action: "purchasePack", code: body.code, quantity: body.quantity, expectedCents: body.expectedCents, requestKey: body.requestKey };
    case "injector":
      if (!id(body.stationId) || typeof body.expectedCents !== "number" || !Number.isSafeInteger(body.expectedCents) || body.expectedCents < 0) return null;
      return { action: "injector", stationId: body.stationId, expectedCents: body.expectedCents, requestKey: body.requestKey };
    case "purchase":
      if (typeof body.code !== "string" || !isKqWarehousePreparationCode(body.code) || typeof body.quantity !== "number"
        || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 100) return null;
      // Receipts created before retail pricing can be replayed without a quote.
      if (body.expectedCents !== undefined && (typeof body.expectedCents !== "number" || !Number.isSafeInteger(body.expectedCents) || body.expectedCents < 1)) return null;
      return { action: "purchase", requestKey: body.requestKey, code: body.code, quantity: body.quantity,
        ...(body.expectedCents === undefined ? {} : { expectedCents: body.expectedCents }) };
    case "clean":
      if ((body.step !== "vacuum" && body.step !== "mop") || typeof body.workChoice !== "string"
        || !/^(player|auto|employee:[a-zA-Z0-9_-]{1,128})$/.test(body.workChoice)) return null;
      return { action: "clean", requestKey: body.requestKey, step: body.step, workChoice: body.workChoice as `employee:${string}` | "player" | "auto" };
    case "program":
      if (!id(body.stationId) || !id(body.zoneId) || !isKqWarehouseInputQuantities(body.quantities)) return null;
      return { action: "program", requestKey: body.requestKey, stationId: body.stationId, zoneId: body.zoneId, quantities: body.quantities };
    case "use":
      if (typeof body.runId !== "string" || !uuid.test(body.runId) || !isKqWarehouseInputQuantities(body.quantities)) return null;
      return { action: "use", requestKey: body.requestKey, runId: body.runId, quantities: body.quantities };
    default: return null;
  }
}

export async function GET() {
  if (!await isKqGameRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  try {
    return NextResponse.json(await getKqWarehousePreparations(session.customerId), { headers: accountHeaders(session.customerId) });
  } catch {
    return NextResponse.json({ error: "Préparations momentanément indisponibles." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!await isKqGameRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  const scopedHeaders = accountHeaders(session.customerId);
  const expectedAccount = request.headers.get(KQ_WAREHOUSE_PREPARATION_ACCOUNT_HEADER);
  if (expectedAccount !== null && expectedAccount !== session.customerId) {
    return NextResponse.json({ error: "Le compte a changé. Relis le registre du compte connecté." }, { status: 409, headers: scopedHeaders });
  }
  const ip = getRequestIp(request);
  const key = `kq_warehouse_preparations:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/warehouse/preparations", key, ip, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
    return NextResponse.json({ error: "Trop de demandes. Réessaie dans un instant." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
  }
  try {
    const bounded = await readRequestBody(request);
    if (!bounded.ok) return bounded.response;
    const command = readCommand(await bounded.body.json().catch(() => null));
    if (!command) return NextResponse.json({ error: "Préparation invalide." }, { status: 400, headers });
    return NextResponse.json(await commitKqWarehousePreparation(session.customerId, command), { headers: scopedHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "[supabase]";
    if (message.startsWith("[supabase")) return NextResponse.json({ error: "Préparations momentanément indisponibles." }, { status: 503, headers });
    return NextResponse.json({ error: message }, { status: 409, headers });
  }
}
