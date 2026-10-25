import "server-only";

import type { MonthlyReviewDraw } from "@/lib/monthly-review-draw";
import type { LotteryRewardClaimStatus } from "@/types/lottery";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const unavailable = () => new Error("Tirage mensuel momentanément indisponible.");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isMonthStart = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value);
const claimStatuses: readonly string[] = ["available", "reserved", "used", "fulfilled", "cancelled"];

function parseDraw(value: unknown, customerId: string | null): MonthlyReviewDraw {
  if (!isRecord(value) || value.prizeGrams !== 10
    || !isMonthStart(value.nextDrawDate) || !isMonthStart(value.periodStartsOn)
    || value.periodStartsOn >= value.nextDrawDate || !Array.isArray(value.rewards)) throw unavailable();

  if (customerId) {
    if (!isCount(value.approvedReviewCount) || value.eligible !== (value.approvedReviewCount > 0)) throw unavailable();
  } else if (value.approvedReviewCount !== null || value.eligible !== null || value.rewards.length > 0) {
    throw unavailable();
  }

  let latestDraw: MonthlyReviewDraw["latestDraw"] = null;
  if (value.latestDraw !== null) {
    const latest = value.latestDraw;
    if (!isRecord(latest) || !isMonthStart(latest.drawDate) || !isCount(latest.participantCount)
      || typeof latest.viewerWon !== "boolean" || (!customerId && latest.viewerWon)
      || (latest.participantCount === 0 && latest.viewerWon)) throw unavailable();
    latestDraw = { drawDate: latest.drawDate, participantCount: latest.participantCount, viewerWon: latest.viewerWon };
  }

  const seen = new Set<string>();
  const rewards: MonthlyReviewDraw["rewards"] = value.rewards.map((reward: unknown) => {
    if (!isRecord(reward) || typeof reward.claimId !== "string" || !UUID.test(reward.claimId)
      || seen.has(reward.claimId) || !isMonthStart(reward.drawDate)
      || typeof reward.status !== "string" || !claimStatuses.includes(reward.status)) throw unavailable();
    seen.add(reward.claimId);
    return { claimId: reward.claimId, drawDate: reward.drawDate, status: reward.status as LotteryRewardClaimStatus };
  });

  // Copy the public fields explicitly: never expose the private candidate receipt.
  return {
    prizeGrams: value.prizeGrams,
    nextDrawDate: value.nextDrawDate,
    periodStartsOn: value.periodStartsOn,
    eligible: value.eligible as boolean | null,
    approvedReviewCount: value.approvedReviewCount as number | null,
    latestDraw,
    rewards,
  };
}

export async function getMonthlyReviewDraw(customerId: string | null = null): Promise<MonthlyReviewDraw> {
  if (customerId !== null && !UUID.test(customerId)) throw unavailable();
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_get_monthly_review_draw", {
    p_customer_id: customerId,
  });
  if (error) throw unavailable();
  return parseDraw(data, customerId);
}
