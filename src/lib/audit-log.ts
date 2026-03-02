import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export type AuditEventType =
  | "admin_login"
  | "admin_login_failed"
  | "admin_logout"
  | "upload_product_image"
  | "upload_blog_image"
  | "upload_producer_image"
  | "upload_lottery_card_image"
  | "upload_product_analysis"
  | "upload_mission_proof"
  | "update_store"
  | "update_order"
  | "add_promo_code"
  | "review_mission_submission";

type AuditLogEntry = {
  eventType: AuditEventType;
  actorEmail?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Fire-and-forget audit log insertion.
 * Never throws — failures are silently logged to stderr so they never
 * block or break the calling API route.
 */
export function logAuditEvent(entry: AuditLogEntry): void {
  const supabase = createSupabaseServiceClient();

  Promise.resolve(
    supabase
      .from("audit_logs")
      .insert({
        event_type: entry.eventType,
        actor_email: entry.actorEmail ?? "",
        ip: entry.ip ?? "",
        metadata: entry.metadata ?? {},
      }),
  )
    .then(({ error }) => {
      if (error) {
        console.error("[audit-log] insert failed:", error.message);
      }
    })
    .catch((err: unknown) => {
      console.error("[audit-log] unexpected error:", err);
    });
}
