import "server-only";
import { isIP } from "node:net";

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

function sanitizeRateLimitKey(rawKey: string): string {
  return rawKey.trim().slice(0, 180);
}

function normalizeCandidateIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 128);
  const candidate = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/)?.[1]
    ?? (trimmed.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/)?.[1] ?? trimmed);
  const version = isIP(candidate);
  if (version === 4) return candidate;
  if (version !== 6 || candidate.includes("%")) return null;
  // URL serializes compressed/expanded IPv6 to the same canonical bucket.
  const canonical = new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
  const mapped = canonical.match(/^::ffff:([a-f0-9]+):([a-f0-9]+)$/);
  if (mapped) {
    const high = Number.parseInt(mapped[1], 16), low = Number.parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return canonical;
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
    throw new Error("[supabase:rpc_rate_limit_hit] Protection anti-abus indisponible.");
  }
  const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : null;
  if (!row || typeof row.allowed !== "boolean" ||
      !Number.isInteger(row.remaining) || row.remaining < 0 ||
      !Number.isInteger(row.retry_after_seconds) || row.retry_after_seconds < 0 ||
      (!row.allowed && row.retry_after_seconds < 1)) {
    throw new Error("[supabase:rpc_rate_limit_hit] Réponse invalide.");
  }
  return { allowed: row.allowed, remaining: row.remaining, retryAfterSeconds: row.retry_after_seconds };
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
