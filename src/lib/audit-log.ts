import "server-only";

import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { sanitizeAuditLogFailureEvent } from "@/lib/sentry-privacy";

export type AuditEventType =
  | "admin_login"
  | "admin_login_failed"
  | "admin_logout"
  | "customer_login"
  | "customer_login_failed"
  | "customer_register"
  | "customer_password_reset_requested"
  | "customer_password_reset_completed"
  | "customer_data_export"
  | "customer_account_deleted"
  | "customer_bind_referral"
  | "customer_burn_duplicates"
  | "customer_claim_reward"
  | "customer_cancel_pending_payment"
  | "customer_purchase_packs_with_points"
  | "rate_limit_rejected"
  | "upload_product_image"
  | "upload_blog_image"
  | "upload_producer_image"
  | "upload_lottery_card_image"
  | "upload_product_analysis"
  | "upload_mission_proof"
  | "update_store"
  | "update_order"
  | "archive_order"
  | "add_promo_code"
  | "create_mission"
  | "update_mission"
  | "reorder_missions"
  | "update_referral_reward_settings"
  | "review_mission_submission"
  | "welcome_pack_claimed"
  | "pioneer_pack_claimed"
  | "viva_webhook_verification"
  | "viva_webhook_verification_failed"
  | "rate_limit_fallback_activated"
  | "contest_profile_upsert"
  | "contest_review_submit"
  | "contest_review_update"
  | "contest_review_vote"
  | "contest_review_moderated"
  | "contest_badge_reward_claim"
  | "contest_season_created"
  | "contest_entry_created"
  | "contest_entry_updated"
  | "contest_entry_deleted";

type AuditLogEntry = {
  eventType: AuditEventType;
  actorEmail?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
};

async function reportWriteFailure(): Promise<void> {
  console.error("[audit-log] audit_log_write_failed");
  try {
    const client = Sentry.getClient();
    if (!client || client.getOptions().enabled === false) {
      console.error("[audit-log] audit_log_alert_unavailable");
      return;
    }
    Sentry.withIsolationScope(() => Sentry.withScope(scope => {
      // Clean inherited data now; the configured beforeSend repeats this after
      // Sentry adds its propagation metadata, immediately before delivery.
      scope.addEventProcessor(sanitizeAuditLogFailureEvent);
      Sentry.captureMessage("Audit log persistence failed", "error");
    }));
    if (!await Sentry.flush(2_000)) console.error("[audit-log] audit_log_alert_failed");
  } catch {
    console.error("[audit-log] audit_log_alert_failed");
  }
}

/**
 * Register the complete insertion with Next's request lifetime (waitUntil).
 * Call from a Route Handler or Server Function, while its context is active.
 * Failures do not break the response; stable signals contain no request data
 * or raw provider errors, which may include credentials or submitted values.
 */
export function logAuditEvent(entry: AuditLogEntry): void {
  try {
    // Capture now: callers may change objects before the response completes.
    const row = {
      event_type: entry.eventType,
      actor_email: entry.actorEmail ?? "",
      ip: entry.ip ?? "",
      metadata: structuredClone(entry.metadata ?? {}),
    };
    after(async () => {
      try {
        const { error } = await createSupabaseServiceClient()
          .from("audit_logs")
          .insert(row)
          .abortSignal(AbortSignal.timeout(5_000));
        if (error) await reportWriteFailure();
      } catch {
        await reportWriteFailure();
      }
    });
  } catch {
    // An unavailable lifecycle hook must be observable; do not silently start
    // another detached write that the platform could terminate prematurely.
    console.error("[audit-log] audit_log_schedule_failed");
  }
}
