import "server-only";

import { ADMIN_SESSION_MAX_AGE_SECONDS, createAdminSessionToken, verifyAdminSessionToken } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function credentialFingerprint(): Promise<string> {
  return digest(JSON.stringify([process.env.ADMIN_PASSWORD_HASH?.trim() ?? "", process.env.ADMIN_TOTP_SECRET?.trim() ?? ""]));
}

function assertAvailable(error: unknown): void {
  if (error) throw new Error("ADMIN_SESSION_STORE unavailable");
}

export async function createStoredAdminSession(customerId: string): Promise<string> {
  const token = await createAdminSessionToken();
  const { error } = await createSupabaseServiceClient().from("admin_sessions").insert({
    token_hash: await digest(token),
    customer_id: customerId,
    credential_fingerprint: await credentialFingerprint(),
    expires_at: new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  });
  assertAvailable(error);
  return token;
}

export async function getStoredAdminSession(token: string | undefined): Promise<{ customerId: string } | null> {
  if (!token || !await verifyAdminSessionToken(token)) return null;
  const { data, error } = await createSupabaseServiceClient().from("admin_sessions")
    .select("customer_id,expires_at,credential_fingerprint")
    .eq("token_hash", await digest(token)).maybeSingle();
  assertAvailable(error);
  if (!data || !(Date.parse(data.expires_at) > Date.now()) ||
      data.credential_fingerprint !== await credentialFingerprint()) return null;
  return { customerId: data.customer_id };
}

export async function revokeAdminSession(token: string | undefined): Promise<void> {
  if (!token || token.length > 1024) return;
  const { error } = await createSupabaseServiceClient().from("admin_sessions")
    .delete().eq("token_hash", await digest(token));
  assertAvailable(error);
}

export async function revokeAdminSessionsForCustomer(customerId: string): Promise<void> {
  const { error } = await createSupabaseServiceClient().from("admin_sessions")
    .delete().eq("customer_id", customerId);
  assertAvailable(error);
}
