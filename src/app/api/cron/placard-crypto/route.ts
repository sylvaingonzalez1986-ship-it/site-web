import { timingSafeEqual } from "node:crypto";
import { refreshKqCryptoQuotes } from "@/lib/supabase/kanab-quest-crypto-backend";

export const runtime = "nodejs";
export const maxDuration = 60;

const headers = { "Cache-Control": "no-store" };
const parisHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" });

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  // UTC schedules cover 19h Paris in both seasons and later recovery attempts.
  // PostgreSQL stops all further publications once the daily batch succeeds.
  // Allow full hours because a scheduler can deliver an invocation late.
  const hour = Number(parisHour.format(Date.now()));
  if (hour < 19 || hour > 22) {
    return Response.json({ status: "skipped", reason: "outside_daily_window" }, { headers });
  }

  try {
    // PostgreSQL owns the daily slot, shared lease and provider retry limits.
    const status = await refreshKqCryptoQuotes();
    return Response.json({ status }, { status: status === "failed" ? 503 : 200, headers });
  } catch {
    console.warn("[crypto:cron] refresh unavailable");
    return Response.json({ status: "failed" }, { status: 503, headers });
  }
}
