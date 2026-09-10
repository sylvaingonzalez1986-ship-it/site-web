import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import {
  equipKqDurableEquipment,
  getKqEquipmentShopSnapshot,
  purchaseKqDurableEquipment,
  setKqEquipmentRoutePlan,
} from "@/lib/supabase/kanab-quest-equipment-backend";
import { isKqMarketRouteCode, type KqMarketRouteCode } from "@/lib/kanab-quest-market";

export const runtime = "nodejs";

function publicEquipmentError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return message.startsWith("[supabase:")
    ? { message: "Service momentanément indisponible.", status: 500 }
    : { message, status: 400 };
}

export async function GET() {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json(await getKqEquipmentShopSnapshot(session.customerId));
  } catch (error) {
    const failure = publicEquipmentError(error, "Catalogue matériel indisponible.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}

export async function POST(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_equipment_purchase:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 600, maxHits: 12 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/equipment", key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 12, windowSeconds: 600 });
    return NextResponse.json({ error: "Trop de tentatives.", retryAfterSeconds: rate.retryAfterSeconds }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }
  try {
    const payload = await request.json() as { requestKey?: string; equipmentCodes?: string[] };
    return NextResponse.json(await purchaseKqDurableEquipment({
      userId: session.customerId,
      requestKey: String(payload.requestKey ?? ""),
      equipmentCodes: Array.isArray(payload.equipmentCodes) ? payload.equipmentCodes : [],
    }));
  } catch (error) {
    const failure = publicEquipmentError(error, "Achat d’équipement impossible.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}

export async function PATCH(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_equipment_update:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 20 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Trop de tentatives.", retryAfterSeconds: rate.retryAfterSeconds }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }
  try {
    const payload = await request.json() as {
      action?: "route-plan";
      route?: string | null;
      equipmentCode?: string | null;
    };
    if (payload.action === "route-plan") {
      const clearing = payload.route === null && payload.equipmentCode === null;
      const route = String(payload.route ?? "");
      if (!clearing && (!isKqMarketRouteCode(route) || !payload.equipmentCode)) {
        throw new Error("Objectif de filière invalide.");
      }
      return NextResponse.json(await setKqEquipmentRoutePlan({
        userId: session.customerId,
        routePlan: clearing ? null : {
          route: route as KqMarketRouteCode,
          equipmentCode: String(payload.equipmentCode),
        },
      }));
    }
    return NextResponse.json(await equipKqDurableEquipment({
      userId: session.customerId,
      equipmentCode: String(payload.equipmentCode ?? ""),
    }));
  } catch (error) {
    const failure = publicEquipmentError(error, "Installation impossible.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
