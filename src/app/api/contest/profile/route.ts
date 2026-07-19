import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getContestProfile,
  isContestSchemaMissingError,
  upsertContestProfile,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { sanitizePublicContestProfile } from "@/lib/contest-public-api";
import { getPublicContestError } from "@/lib/contest-api-error";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ profile: null, error: "Connexion requise." }, { status: 401 });
  }

  try {
    const profile = await getContestProfile(session.customerId);
    return NextResponse.json({ profile: profile ? sanitizePublicContestProfile(profile) : null });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  const rejected = rejectOversizedBody(request, 4 * 1024);
  if (rejected) return rejected;

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const keyIp = `contest_profile_ip:${ip}`;
  const keyUser = `contest_profile_user:${session.customerId}`;

  const [limitIp, limitUser] = await Promise.all([
    hitRateLimit({ key: keyIp, windowSeconds: 15 * 60, maxHits: 10 }),
    hitRateLimit({ key: keyUser, windowSeconds: 15 * 60, maxHits: 10 }),
  ]);

  if (!limitIp.allowed || !limitUser.allowed) {
    const retryAfterSeconds = Math.max(limitIp.retryAfterSeconds, limitUser.retryAfterSeconds);
    logRateLimitRejection({
      endpoint: "POST /api/contest/profile",
      key: !limitIp.allowed ? keyIp : keyUser,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds,
      maxHits: 10,
      windowSeconds: 15 * 60,
    });
    return NextResponse.json(
      { error: "Trop de requetes. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const payload = (await request.json().catch(() => null)) as { pseudo?: string } | null;

  try {
    const profile = await upsertContestProfile({
      customerId: session.customerId,
      pseudo: payload?.pseudo ?? "",
    });
    logAuditEvent({
      eventType: "contest_profile_upsert",
      actorEmail: session.customer.email,
      ip,
      metadata: { customerId: session.customerId },
    });
    return NextResponse.json({ profile: sanitizePublicContestProfile(profile) });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: getPublicContestError(error, "Pseudo invalide.") },
      { status: 400 },
    );
  }
}
