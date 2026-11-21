import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

type CheckoutAttemptAction =
  | { action: "create" }
  | { action: "busy" }
  | { action: "completed" }
  | { action: "restart" }
  | { action: "resume"; orderId: string; checkoutUrl: string };

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function createCheckoutFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function swissBitcoinOrderPath(orderId: string): string {
  return `/checkout/bitcoin/${encodeURIComponent(orderId)}`;
}

export async function findRecordedSwissBitcoinCheckout(attemptId: string, customerId: string) {
  const { data, error } = await createSupabaseServiceClient()
    .from("checkout_attempts")
    .select("order_id,checkout_url")
    .eq("attempt_id", attemptId)
    .eq("customer_id", customerId)
    .in("state", ["ready", "completed"])
    .maybeSingle();
  if (error) throw new Error("Session de paiement inaccessible.");
  const orderId = asText(data?.order_id);
  const checkoutUrl = asText(data?.checkout_url);
  return orderId && checkoutUrl === swissBitcoinOrderPath(orderId) ? { orderId, checkoutUrl } : null;
}

export async function beginCheckoutAttempt(input: {
  attemptId: string;
  customerId: string;
  cartFingerprint: string;
}): Promise<CheckoutAttemptAction> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_begin_checkout_attempt", {
    p_attempt_id: input.attemptId,
    p_customer_id: input.customerId,
    p_cart_fingerprint: input.cartFingerprint,
  });
  if (result.error) {
    throw new Error(`[supabase:rpc_begin_checkout_attempt] ${result.error.message}`);
  }

  const payload = asRecord(result.data);
  const action = asText(payload.action);
  if (action === "create" || action === "busy" || action === "completed" || action === "restart") {
    return { action };
  }
  if (action === "resume") {
    const orderId = asText(payload.order_id);
    const orderCode = asText(payload.order_code);
    const checkoutUrl = asText(payload.checkout_url);
    if (!orderId || !checkoutUrl || (!orderCode && checkoutUrl !== swissBitcoinOrderPath(orderId))) {
      throw new Error("Tentative de paiement incomplete.");
    }
    return { action, orderId, checkoutUrl };
  }
  throw new Error("Etat de tentative de paiement inconnu.");
}

export async function completeCheckoutAttempt(input: {
  attemptId: string;
  customerId: string;
  orderId: string;
  orderCode: string;
  checkoutUrl: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_complete_checkout_attempt", {
    p_attempt_id: input.attemptId,
    p_customer_id: input.customerId,
    p_order_id: input.orderId,
    p_viva_order_code: input.orderCode,
    p_checkout_url: input.checkoutUrl,
  });
  if (result.error || result.data !== true) {
    throw new Error(
      `[supabase:rpc_complete_checkout_attempt] ${result.error?.message ?? "completion refusee"}`,
    );
  }
}

export async function failCheckoutAttempt(input: {
  attemptId: string;
  customerId: string;
  reason: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_fail_checkout_attempt", {
    p_attempt_id: input.attemptId,
    p_customer_id: input.customerId,
    p_error: input.reason,
  });
  if (result.error) {
    throw new Error(`[supabase:rpc_fail_checkout_attempt] ${result.error.message}`);
  }
}

export async function failCheckoutAttemptForOrder(orderId: string, reason: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("checkout_attempts")
    .update({
      state: "failed",
      last_error: reason.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)
    .neq("state", "completed");
  if (result.error) {
    throw new Error(`[supabase:fail checkout attempt for order] ${result.error.message}`);
  }
}
