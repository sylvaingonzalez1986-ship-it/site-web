import { readRequestBody } from "@/lib/body-size-guard";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqGameRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { changeKqWarehouseSecurity, getKqWarehouseSecurity, KqWarehouseSecurityError, parseKqWarehouseSecurityCommand } from "@/lib/supabase/kanab-quest-warehouse-security-backend";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

async function withPlayer(load: (userId: string) => Promise<Response>) {
  if (!await isKqGameRequestEnabled()) return json({ error: "Introuvable." }, 404);
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return json({ error: "Non autorisé." }, 401);
  try { return await load(session.customerId); }
  catch (error) {
    if (error instanceof KqWarehouseSecurityError) return json({ error: error.message }, error.status);
    return json({ error: "La sécurité de l’entrepôt est momentanément indisponible." }, 500);
  }
}

export async function GET() {
  return withPlayer(async userId => json(await getKqWarehouseSecurity(userId)));
}

export async function POST(request: Request) {
  return withPlayer(async userId => {
    const ip = getRequestIp(request);
    const key = `kq_warehouse_security:${userId}:${ip}`;
    const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
    if (!rate.allowed) {
      logRateLimitRejection({ endpoint: "POST /api/arena/placard/warehouse/security", key, ip, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
      return Response.json({ error: "Trop de demandes. Réessaie dans un instant." },
        { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    }
    const read = await readRequestBody(request, 4096);
    if (!read.ok) {
      read.response.headers.set("Cache-Control", "no-store");
      return read.response;
    }
    const command = parseKqWarehouseSecurityCommand(await read.body.json().catch(() => null));
    if (!command) return json({ error: "Cette demande de sécurité est invalide." }, 400);
    return json(await changeKqWarehouseSecurity(userId, command));
  });
}
