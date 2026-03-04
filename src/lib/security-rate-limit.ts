import "server-only";

import { logAuditEvent } from "@/lib/audit-log";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  key: string;
  windowSeconds: number;
  maxHits: number;
};

type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitRejectionLogEntry = {
  endpoint: string;
  key: string;
  ip: string;
  actorEmail?: string;
  retryAfterSeconds: number;
  maxHits: number;
  windowSeconds: number;
};

type LocalRateBucket = {
  hits: number;
  startedAt: number;
};

const LOCAL_BUCKETS = new Map<string, LocalRateBucket>();
const IPV4_PATTERN =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_PATTERN = /^(?:[A-F0-9]{1,4}:){1,7}[A-F0-9]{1,4}$/i;

function sanitizeRateLimitKey(rawKey: string): string {
  return rawKey.trim().slice(0, 180);
}

function parseInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function normalizeCandidateIp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().slice(0, 128);
  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return null;
  }

  const bracketless = trimmed.replace(/^\[|\]$/g, "");
  const withoutPort = bracketless.includes(":") && bracketless.includes(".")
    ? bracketless.replace(/:\d+$/, "")
    : bracketless;

  if (IPV4_PATTERN.test(withoutPort) || IPV6_PATTERN.test(withoutPort)) {
    return withoutPort;
  }

  return null;
}

export function applyLocalFallbackRateLimit(options: RateLimitOptions): RateLimitDecision {
  const now = Date.now();
  const key = sanitizeRateLimitKey(options.key);
  const existing = LOCAL_BUCKETS.get(key);

  if (!existing || now - existing.startedAt >= options.windowSeconds * 1000) {
    LOCAL_BUCKETS.set(key, { hits: 1, startedAt: now });
    return {
      allowed: true,
      remaining: Math.max(options.maxHits - 1, 0),
      retryAfterSeconds: 0,
    };
  }

  existing.hits += 1;
  LOCAL_BUCKETS.set(key, existing);

  if (existing.hits <= options.maxHits) {
    return {
      allowed: true,
      remaining: Math.max(options.maxHits - existing.hits, 0),
      retryAfterSeconds: 0,
    };
  }

  const elapsedSeconds = Math.floor((now - existing.startedAt) / 1000);
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(options.windowSeconds - elapsedSeconds, 1),
  };
}

export function getRequestIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    for (const candidate of xForwardedFor.split(",")) {
      const normalized = normalizeCandidateIp(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }

  return normalizeCandidateIp(request.headers.get("x-real-ip")) ?? "unknown";
}

export async function hitRateLimit(options: RateLimitOptions): Promise<RateLimitDecision> {
  const safeKey = sanitizeRateLimitKey(options.key);
  if (!safeKey) {
    throw new Error("Rate limit key invalide.");
  }

  const safeWindowSeconds = Math.max(1, Math.floor(options.windowSeconds));
  const safeMaxHits = Math.max(1, Math.floor(options.maxHits));

  const supabase = createSupabaseServiceClient();
  const rpcResult = await supabase.rpc("rpc_rate_limit_hit", {
    p_key: safeKey,
    p_window_seconds: safeWindowSeconds,
    p_max_hits: safeMaxHits,
  });

  if (rpcResult.error) {
    const message = rpcResult.error.message || "";
    if (
      message.includes("rpc_rate_limit_hit") &&
      (message.includes("Could not find") || message.includes("does not exist"))
    ) {
      return applyLocalFallbackRateLimit({
        key: safeKey,
        windowSeconds: safeWindowSeconds,
        maxHits: safeMaxHits,
      });
    }

    throw new Error(`[supabase:rpc_rate_limit_hit] ${rpcResult.error.message}`);
  }

  const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : null;
  if (!row || typeof row !== "object") {
    return {
      allowed: true,
      remaining: safeMaxHits - 1,
      retryAfterSeconds: 0,
    };
  }

  return {
    allowed: row.allowed === true,
    remaining: Math.max(parseInteger(row.remaining, 0), 0),
    retryAfterSeconds: Math.max(parseInteger(row.retry_after_seconds, 0), 0),
  };
}

export function logRateLimitRejection(entry: RateLimitRejectionLogEntry): void {
  logAuditEvent({
    eventType: "rate_limit_rejected",
    actorEmail: entry.actorEmail,
    ip: entry.ip,
    metadata: {
      endpoint: entry.endpoint.trim().slice(0, 120),
      key: sanitizeRateLimitKey(entry.key),
      retryAfterSeconds: Math.max(0, Math.floor(entry.retryAfterSeconds)),
      maxHits: Math.max(1, Math.floor(entry.maxHits)),
      windowSeconds: Math.max(1, Math.floor(entry.windowSeconds)),
    },
  });
}
