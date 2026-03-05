import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export type LocalAnalyticsEventInput = {
  eventName: string;
  pathname: string;
  source?: string;
  metadata?: Record<string, unknown>;
  referrer?: string | null;
};

type LocalAnalyticsEventRow = {
  event_name: string;
  pathname: string;
  source: string;
  metadata: Record<string, unknown>;
  referrer: string | null;
  country_code?: string | null;
  region_code?: string | null;
  city?: string | null;
  user_agent?: string | null;
};

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function sanitizePathname(value: unknown): string {
  const path = sanitizeText(value, 240);
  if (!path.startsWith("/")) {
    return "/";
  }
  return path;
}

function sanitizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value).slice(0, 20);
  const clean: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = sanitizeText(rawKey, 60);
    if (!key) {
      continue;
    }
    if (rawValue == null || typeof rawValue === "number" || typeof rawValue === "boolean") {
      clean[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "string") {
      clean[key] = rawValue.slice(0, 300);
      continue;
    }
  }
  return clean;
}

export function sanitizeLocalAnalyticsEvent(payload: unknown): LocalAnalyticsEventRow | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const input = payload as LocalAnalyticsEventInput;
  const eventName = sanitizeText(input.eventName, 60).toLowerCase();
  const pathname = sanitizePathname(input.pathname);
  const source = sanitizeText(input.source, 40).toLowerCase() || "web";
  const metadata = sanitizeMetadata(input.metadata);
  const referrerRaw = sanitizeText(input.referrer, 500);
  const referrer = referrerRaw || null;

  if (!eventName || !pathname) {
    return null;
  }

  return {
    event_name: eventName,
    pathname,
    source,
    metadata,
    referrer,
  };
}

export async function logLocalAnalyticsEvent(row: LocalAnalyticsEventRow): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("analytics_events").insert(row);
  if (error) {
    throw new Error(`[supabase:analytics_events] ${error.message}`);
  }
}

export function sanitizeOptionalGeoField(value: string | null | undefined, maxLength: number): string | null {
  if (!value) {
    return null;
  }
  const sanitized = sanitizeText(value, maxLength);
  return sanitized || null;
}
