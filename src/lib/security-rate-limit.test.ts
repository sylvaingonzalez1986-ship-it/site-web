import { describe, expect, it } from "vitest";

import {
  applyLocalFallbackRateLimit,
  getRequestIp,
} from "@/lib/security-rate-limit";

describe("security-rate-limit", () => {
  it("allows the first request and tracks remaining hits", () => {
    const key = `test-rate-limit-first-${Date.now()}`;
    expect(
      applyLocalFallbackRateLimit({ key, windowSeconds: 60, maxHits: 2 }),
    ).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 0,
    });
  });

  it("blocks once the limit is exceeded", () => {
    const key = `test-rate-limit-block-${Date.now()}`;
    applyLocalFallbackRateLimit({ key, windowSeconds: 60, maxHits: 1 });

    const decision = applyLocalFallbackRateLimit({ key, windowSeconds: 60, maxHits: 1 });
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reads the first valid ip from x-forwarded-for", () => {
    const request = new Request("https://example.test", {
      headers: {
        "x-forwarded-for": "unknown, 203.0.113.5, 198.51.100.8",
      },
    });

    expect(getRequestIp(request)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip and keeps ipv6 values", () => {
    const request = new Request("https://example.test", {
      headers: {
        "x-real-ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      },
    });

    expect(getRequestIp(request)).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  });
});
