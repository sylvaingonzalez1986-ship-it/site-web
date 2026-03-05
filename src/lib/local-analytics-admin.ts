import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { AdminAnalyticsOverview } from "@/types/analytics";

type AnalyticsRow = {
  event_name: string;
  pathname: string;
  created_at: string;
  country_code?: string | null;
  region_code?: string | null;
  city?: string | null;
};

function buildTopPages(rows: AnalyticsRow[], maxItems: number): Array<{ pathname: string; views: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.event_name !== "page_view") {
      continue;
    }
    const key = row.pathname || "/";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([pathname, views]) => ({ pathname, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, maxItems);
}

function buildEventsByName(rows: AnalyticsRow[], maxItems: number): Array<{ eventName: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.event_name || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([eventName, count]) => ({ eventName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);
}

function normalizeLocationValue(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

function buildTopLocations(
  rows: AnalyticsRow[],
  maxItems: number,
): Array<{ countryCode: string; regionCode: string; city: string; count: number }> {
  const counts = new Map<string, number>();
  const decoded = new Map<string, { countryCode: string; regionCode: string; city: string }>();

  for (const row of rows) {
    const countryCode = normalizeLocationValue(row.country_code, "--");
    const regionCode = normalizeLocationValue(row.region_code, "--");
    const city = normalizeLocationValue(row.city, "Inconnue");
    const key = `${countryCode}|${regionCode}|${city}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!decoded.has(key)) {
      decoded.set(key, { countryCode, regionCode, city });
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ ...(decoded.get(key) ?? { countryCode: "--", regionCode: "--", city: "Inconnue" }), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);
}

export async function getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview> {
  const supabase = createSupabaseServiceClient();
  const now = Date.now();
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_name,pathname,created_at,country_code,region_code,city")
    .gte("created_at", since30d)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    throw new Error(`[supabase:analytics_events_admin] ${error.message}`);
  }

  const rows = (data ?? []) as AnalyticsRow[];
  const rows7d = rows.filter((row) => row.created_at >= since7d);

  const pageViews7d = rows7d.filter((row) => row.event_name === "page_view").length;
  const pageViews30d = rows.filter((row) => row.event_name === "page_view").length;
  const tutorialEvents7d = rows7d.filter((row) => row.event_name.startsWith("tutorial_")).length;
  const tutorialEvents30d = rows.filter((row) => row.event_name.startsWith("tutorial_")).length;
  const latestWithGeo =
    rows.find((row) => row.country_code || row.region_code || row.city) ?? null;

  return {
    pageViews7d,
    pageViews30d,
    tutorialEvents7d,
    tutorialEvents30d,
    topPages7d: buildTopPages(rows7d, 10),
    topPages30d: buildTopPages(rows, 10),
    eventsByName30d: buildEventsByName(rows, 12),
    topLocations30d: buildTopLocations(rows, 10),
    latestConnection: latestWithGeo
      ? {
          countryCode: normalizeLocationValue(latestWithGeo.country_code, "--"),
          regionCode: normalizeLocationValue(latestWithGeo.region_code, "--"),
          city: normalizeLocationValue(latestWithGeo.city, "Inconnue"),
          createdAt: latestWithGeo.created_at,
        }
      : null,
    lastEventAt: rows[0]?.created_at ?? null,
  };
}
