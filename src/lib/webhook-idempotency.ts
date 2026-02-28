import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";

/**
 * Try to record a webhook event for idempotency.
 *
 * Returns `true` if the event was successfully inserted (first time seen).
 * Returns `false` if a row with the same (provider, external_id) already exists
 * — meaning the event was already processed and should be skipped.
 *
 * On unexpected DB errors the function returns `true` (allow processing)
 * to avoid silently dropping legitimate webhooks.
 */
export async function claimWebhookEvent(opts: {
  provider: string;
  externalId: string;
  eventType?: string;
}): Promise<boolean> {
  if (!opts.externalId) {
    // No external ID to deduplicate on — allow processing.
    return true;
  }

  const supabase = createSupabaseServiceClient();

  const { error } = await supabase.from("webhook_events").insert({
    provider: opts.provider,
    external_id: opts.externalId,
    event_type: opts.eventType ?? null,
  });

  if (!error) {
    return true;
  }

  // 23505 = unique_violation in PostgreSQL
  if (error.code === "23505") {
    return false;
  }

  // Table might not exist yet (e.g. migration not applied).
  // Log but allow processing so we don't drop real events.
  console.error("[webhook-idempotency] Unexpected Supabase error:", error.message);
  return true;
}
