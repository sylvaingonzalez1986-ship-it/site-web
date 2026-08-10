import "server-only";

import { getContestProductTastingSummaries, isContestSchemaMissingError } from "@/lib/contest-backend";
import { isContestFeatureEnabledServer } from "@/lib/contest-feature";
import {
  sanitizePublicContestProductTastingSummary,
  type PublicContestProductTastingSummary,
} from "@/lib/contest-public-api";

export async function getProductCardTastingSummaries(
  productIds: string[],
): Promise<Record<string, PublicContestProductTastingSummary>> {
  if (!isContestFeatureEnabledServer() || productIds.length === 0) {
    return {};
  }

  try {
    const summaries = await getContestProductTastingSummaries(productIds, 2);
    return Object.fromEntries(summaries.map((summary) => [
      summary.entry.productId,
      sanitizePublicContestProductTastingSummary(summary),
    ]));
  } catch (error) {
    if (!isContestSchemaMissingError(error)) {
      console.error("Unable to load product card tasting summaries", error);
    }
    return {};
  }
}
