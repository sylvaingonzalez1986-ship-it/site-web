import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import {
  claimContestBadgeReward,
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getContestProfileBadges,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { sanitizePublicContestBadge } from "@/lib/contest-public-api";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

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
  const keyIp = `contest_badge_claim_ip:${ip}`;
  const keyUser = `contest_badge_claim_user:${session.customerId}`;

  const [limitIp, limitUser] = await Promise.all([
    hitRateLimit({ key: keyIp, windowSeconds: 10 * 60, maxHits: 12 }),
    hitRateLimit({ key: keyUser, windowSeconds: 10 * 60, maxHits: 12 }),
  ]);

  if (!limitIp.allowed || !limitUser.allowed) {
    const retryAfterSeconds = Math.max(limitIp.retryAfterSeconds, limitUser.retryAfterSeconds);
    logRateLimitRejection({
      endpoint: "POST /api/contest/badges/claim",
      key: !limitIp.allowed ? keyIp : keyUser,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds,
      maxHits: 12,
      windowSeconds: 10 * 60,
    });
    return NextResponse.json(
      { error: "Trop de reclamations. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const payload = (await request.json().catch(() => null)) as { badgeId?: string } | null;
  const badgeId = typeof payload?.badgeId === "string" ? payload.badgeId : "";

  try {
    const claim = await claimContestBadgeReward({
      customerId: session.customerId,
      badgeId,
    });
    const badges = await getContestProfileBadges(session.customerId, { syncRewards: false });

    logAuditEvent({
      eventType: "contest_badge_reward_claim",
      actorEmail: session.customer.email,
      ip,
      metadata: {
        customerId: session.customerId,
        badgeId: claim.badgeId,
        grantedPacks: claim.grantedPacks,
      },
    });

    return NextResponse.json({
      badges: badges.map(sanitizePublicContestBadge),
      grantedPacks: claim.grantedPacks,
      message: `${claim.grantedPacks} pack(s) booster ajoute(s) a ton album.`,
    });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recompense impossible a reclamer." },
      { status: 400 },
    );
  }
}
