import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { isAllowedAdminEmail } from "@/lib/admin-allowlist";

export type ArenaSessionCookie = { name: string; value: string; options: CookieOptions };
/** Cookies and user metadata never grant beta access: verify Auth, then read the private registry. */
export async function verifyArenaBetaRequest(request: NextRequest, refreshed: ArenaSessionCookie[]): Promise<boolean> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const client = createServerClient(url, anonKey, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        for (const cookie of values) { request.cookies.set(cookie.name, cookie.value); refreshed.push(cookie); }
      },
    } });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return false;
    if (isAllowedAdminEmail(data.user.email)) return true;
    const result = await createSupabaseServiceClient().from("contest_beta_testers").select("enabled").eq("customer_id", data.user.id).maybeSingle();
    return !result.error && result.data?.enabled === true;
  } catch { return false; }
}
