import "server-only";

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

type LocalRateBucket = {
  hits: number;
  startedAt: number;
};

const LOCAL_BUCKETS = new Map<string, LocalRateBucket>();

function sanitizeRateLimitKey(rawKey: string): string {
  return rawKey.trim().slice(0, 180);
}

function parseInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function useLocalFallbackRateLimit(options: RateLimitOptions): RateLimitDecision {
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
    return xForwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
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
      return useLocalFallbackRateLimit({
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
