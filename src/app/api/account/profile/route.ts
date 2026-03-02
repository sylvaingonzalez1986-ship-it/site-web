import { NextResponse } from "next/server";
import { applyCustomerProfilePatch } from "@/lib/account-profile";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export async function PATCH(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `profile_patch:${ip}`;
  const rl = await hitRateLimit({ key: rateLimitKey, windowSeconds: 300, maxHits: 10 });
  if (!rl.allowed) {
    logRateLimitRejection({
      endpoint: "PATCH /api/account/profile",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rl.retryAfterSeconds,
      maxHits: 10,
      windowSeconds: 300,
    });

    return NextResponse.json({ error: "Trop de requetes." }, { status: 429 });
  }

  try {
    const payload = (await request.json()) as unknown;
    const updated = await applyCustomerProfilePatch(session.customerId, payload);

    if (!updated) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payload invalide." },
      { status: 400 },
    );
  }
}
