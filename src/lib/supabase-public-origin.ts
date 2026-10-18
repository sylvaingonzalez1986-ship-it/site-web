const DEFAULT_SUPABASE_ORIGIN = "https://eyowwwpdmfrulhkpvlnf.supabase.co";

// Share the exact project origin between the browser CSP and Next image loading.
// Never authorize other Supabase tenants through a wildcard.
export function getSupabasePublicOrigin(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const url = new URL(configuredUrl || DEFAULT_SUPABASE_ORIGIN);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.hostname.includes("*") ||
    url.username ||
    url.password
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL doit definir une origine HTTP(S) exacte sans identifiants.");
  }
  return url.origin;
}
