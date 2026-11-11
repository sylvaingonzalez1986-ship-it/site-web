import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export function newsletterTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestNewsletterConfirmation(email: string, source: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const { error } = await createSupabaseServiceClient().rpc("rpc_request_newsletter_confirmation", {
    p_email: email, p_token_hash: newsletterTokenHash(token),
    p_source: source.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "application",
  });
  if (error) throw new Error("Newsletter confirmation unavailable");
  return token;
}

export async function confirmNewsletterSubscription(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_confirm_newsletter_subscription", {
    p_token_hash: newsletterTokenHash(token),
  });
  if (error) throw new Error("Newsletter confirmation unavailable");
  return data === true;
}
