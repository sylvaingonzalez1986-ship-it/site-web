import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";

type WebhookEventKey = {
  provider: string;
  externalId: string;
  eventType: string;
};

export async function beginWebhookEvent(
  key: WebhookEventKey,
): Promise<"process" | "duplicate" | "busy"> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_begin_webhook_event", {
    p_provider: key.provider,
    p_event_type: key.eventType,
    p_external_id: key.externalId,
  });
  if (result.error) {
    throw new Error(`[supabase:rpc_begin_webhook_event] ${result.error.message}`);
  }
  if (result.data === "process" || result.data === "duplicate" || result.data === "busy") {
    return result.data;
  }
  throw new Error("Etat idempotence webhook inconnu.");
}

export async function completeWebhookEvent(key: WebhookEventKey): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_complete_webhook_event", {
    p_provider: key.provider,
    p_event_type: key.eventType,
    p_external_id: key.externalId,
  });
  if (result.error) {
    throw new Error(`[supabase:rpc_complete_webhook_event] ${result.error.message}`);
  }
}

export async function failWebhookEvent(key: WebhookEventKey, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Erreur webhook inconnue";
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_fail_webhook_event", {
    p_provider: key.provider,
    p_event_type: key.eventType,
    p_external_id: key.externalId,
    p_error: message.slice(0, 1000),
  });
  if (result.error) {
    console.error("[webhook-idempotency] Unable to mark event as failed:", result.error.message);
  }
}
