import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "./server";

/** Presentation only, called AFTER the page validates the authenticated owner.
 * session_id survives token refresh and changes on a new sign-in. No token or
 * raw auth session identifier is sent to the browser or used for authorization.
 */
export async function getArenaBetaConnectionKey(authenticatedOwner: string): Promise<string | null> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== authenticatedOwner) return null;
    const token = data.session.access_token;
    if (token.length > 16_384) return null;
    const claims: unknown = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object" || !("sub" in claims) || claims.sub !== authenticatedOwner
      || !("session_id" in claims) || typeof claims.session_id !== "string" || !/^[0-9a-f-]{36}$/i.test(claims.session_id)) return null;
    return createHash("sha256").update(`arena-beta:${authenticatedOwner}:${claims.session_id}`).digest("hex");
  } catch { return null; }
}
