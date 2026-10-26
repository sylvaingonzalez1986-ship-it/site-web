import "server-only";

import { getContestProductTastingSummaries, isContestSchemaMissingError } from "@/lib/contest-backend";
import { isContestNotebookEnabledServer } from "@/lib/contest-notebook-access";
import {
  sanitizePublicContestProductTastingSummary,
  type PublicContestProductTastingSummary,
} from "@/lib/contest-public-api";
import { getProductTastingNotebookHref } from "@/lib/contest-product-tasting";
import { isProductTastingNotebookLinkEnabled, isProductTastingStorefrontEnabled } from "@/lib/product-tasting-feature";

export async function getProductCardTastingSummaries(
  productIds: string[],
): Promise<Record<string, PublicContestProductTastingSummary>> {
  if (!isProductTastingStorefrontEnabled()) {
    return {};
  }

  if (!isContestNotebookEnabledServer() || productIds.length === 0) {
    return {};
  }

  try {
    const summaries = await getContestProductTastingSummaries(productIds, 2);
    const showNotebookLink = isProductTastingNotebookLinkEnabled();
    return Object.fromEntries(summaries.map((summary) => [
      summary.entry.productId,
      {
        ...sanitizePublicContestProductTastingSummary(summary),
        ...(showNotebookLink ? { notebookHref: getProductTastingNotebookHref(summary.entry, true) } : {}),
      },
    ]));
  } catch (error) {
    if (!isContestSchemaMissingError(error)) {
      console.error("Unable to load product card tasting summaries", error);
    }
    return {};
  }
}
