import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

/** Enabled only on the matching disposable deployment. Never opens a database connection. */
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const database = process.env.PLACARD_TEST_DATABASE_ORIGIN;
  const version = process.env.PLACARD_TEST_VERSION;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (process.env.VERCEL_ENV === "production" || origin !== process.env.PLACARD_TEST_APP_ORIGIN || !database || !version ||
      !supabaseUrl || !URL.canParse(supabaseUrl) || new URL(supabaseUrl).origin !== database) {
    return new Response(null, { status: 404 });
  }
  return Response.json({ origin, version, databaseHash: createHash("sha256").update(database).digest("hex") },
    { headers: { "Cache-Control": "no-store" } });
}
