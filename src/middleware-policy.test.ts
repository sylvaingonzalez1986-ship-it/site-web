import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as verifyAge } from "@/app/api/age-gate/verify/route";
import {
  middleware,
  isAdminRestrictedPage,
  isRecognizedCrawlerUserAgent,
  shouldEnforceAgeGate,
  shouldValidateMutativeOrigin,
} from "../middleware";

afterEach(() => {
  vi.unstubAllEnvs();
});

function parsePolicy(policy: string) {
  return new Map(policy.split(";").map((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }));
}

async function verifiedAgeRequest(next: string) {
  vi.stubEnv("ADMIN_SESSION_SECRET", "age-gate-redirect-test-secret");
  const verification = await verifyAge(new Request("https://example.test/api/age-gate/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmed: true }),
  }));
  const cookie = verification.cookies.get("age_verified")!;
  const url = new URL("https://example.test/age-gate");
  url.searchParams.set("next", next);
  return new NextRequest(url, {
    headers: { accept: "text/html", cookie: `${cookie.name}=${cookie.value}` },
  });
}

describe("middleware policy helpers", () => {
  it.each(["production", "development"])("restricts Supabase to the configured project in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://configured-project.supabase.co/");
    const response = await middleware(new NextRequest("https://example.test/"));
    const policy = response.headers.get("Content-Security-Policy")!;
    const directives = parsePolicy(policy);

    for (const name of ["img-src", "media-src", "connect-src", "frame-src"]) {
      expect(directives.get(name)?.filter((source) => source.includes("supabase.co")))
        .toEqual(["https://configured-project.supabase.co"]);
      expect(directives.get(name)).not.toContain("https:");
      expect(directives.get(name)).not.toContain("*");
    }
    expect(policy).not.toContain("*.supabase.co");
    expect(directives.get("script-src")).not.toContain("https://configured-project.supabase.co");
    expect(directives.get("object-src")).toEqual(["'none'"]);
    expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
    for (const name of ["script-src", "connect-src", "frame-src"]) {
      expect(directives.get(name)).toContain("https://www.vivapayments.com");
    }
    expect(directives.has("upgrade-insecure-requests")).toBe(environment === "production");
    expect(directives.get("connect-src")?.includes("ws:")).toBe(environment !== "production");
  });

  it("uses the existing project when no Supabase URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await middleware(new NextRequest("https://example.test/"));
    const directives = parsePolicy(response.headers.get("Content-Security-Policy")!);
    expect(directives.get("frame-src"))
      .toEqual(["https://www.vivapayments.com", "https://eyowwwpdmfrulhkpvlnf.supabase.co"]);
  });

  it("passes its fresh nonce, policy and pathname to Next instead of trusting request-supplied headers", async () => {
    const request = () => new NextRequest("https://example.test/", {
      headers: {
        "x-nonce": "attacker-nonce",
        "x-site-ui-pathname": "/admin",
        "Content-Security-Policy": "script-src 'unsafe-inline'",
      },
    });
    const first = await middleware(request());
    const second = await middleware(request());

    for (const response of [first, second]) {
      const nonce = response.headers.get("x-middleware-request-x-nonce");
      const policy = response.headers.get("Content-Security-Policy");
      expect(nonce).toMatch(/^[a-f0-9]{32}$/);
      expect(policy).toContain(`'nonce-${nonce}'`);
      expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
      expect(response.headers.get("x-middleware-request-x-site-ui-pathname")).toBe("/");
      expect(parsePolicy(policy!).get("script-src")).not.toContain("'unsafe-inline'");
    }
    expect(first.headers.get("x-middleware-request-x-nonce"))
      .not.toBe(second.headers.get("x-middleware-request-x-nonce"));
  });

  it("permits crypto logo images without authorizing CoinMarketCap scripts or API calls", async () => {
    const response = await middleware(new NextRequest("https://example.test/"));
    const policy = response.headers.get("Content-Security-Policy");
    expect(policy).toBeTruthy();
    const directives = new Map(policy!.split(";").map(directive => {
      const [name, ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }));
    expect(directives.get("img-src")).toContain("https://s2.coinmarketcap.com/static/img/coins/64x64/");
    expect(directives.get("img-src")).toContain("'self'");
    for (const name of ["script-src", "connect-src", "frame-src"]) {
      expect(directives.get(name)?.some(source => source.includes("coinmarketcap.com"))).toBe(false);
    }
    expect(directives.get("img-src")).not.toContain("https:");
    expect(directives.get("img-src")).not.toContain("*");
  });

  it("enforces the age gate on contest pages", () => {
    expect(shouldEnforceAgeGate("/arene")).toBe(true);
    expect(shouldEnforceAgeGate("/arene/lot-premium")).toBe(true);
    expect(shouldEnforceAgeGate("/arene/profils/testeur")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours/lot-premium")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours/profils/testeur")).toBe(true);
  });

  it.each([
    "/\\audit.invalid",
    "/%5caudit.invalid",
    "/%255caudit.invalid",
    "//audit.invalid",
    "/%2faudit.invalid",
    "/admin/..//audit.invalid",
    "/%0aaudit.invalid",
    "https://audit.invalid",
  ])("blocks an unsafe server redirect with a valid signed age cookie: %s", async (next) => {
    const response = await middleware(await verifiedAgeRequest(next));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/");
  });

  it("preserves the intended shop return for an already age-verified visitor", async () => {
    const next = "/boutique?filtre=huile%26bio#catalogue";
    const response = await middleware(await verifiedAgeRequest(next));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://example.test${next}`);
  });

  it.each([
    ["OAI-SearchBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot"],
    ["ChatGPT-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot"],
    ["GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot"],
    ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
    ["Claude-SearchBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Claude-SearchBot/1.0; +https://anthropic.com"],
    ["Claude-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Claude-User/1.0; +https://anthropic.com"],
    ["ClaudeBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +https://anthropic.com"],
    ["PerplexityBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot"],
    ["Perplexity-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user"],
  ])("lets the official %s agent pass the age gate", (_name, userAgent) => {
    expect(isRecognizedCrawlerUserAgent(userAgent)).toBe(true);
  });

  it("keeps regular browsers behind the age gate", () => {
    expect(
      isRecognizedCrawlerUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(isRecognizedCrawlerUserAgent(null)).toBe(false);
  });

  it("validates origins for mutative contest API requests", () => {
    expect(shouldValidateMutativeOrigin("/api/contest/reviews", "POST")).toBe(true);
    expect(shouldValidateMutativeOrigin("/api/contest/reviews/review-1/vote", "POST")).toBe(true);
    expect(shouldValidateMutativeOrigin("/api/contest/profile", "GET")).toBe(false);
  });

  it("keeps checkout webhooks exempt from browser origin validation", () => {
    expect(shouldValidateMutativeOrigin("/api/checkout/viva", "POST")).toBe(true);
    expect(shouldValidateMutativeOrigin("/api/checkout/viva/webhook", "POST")).toBe(false);
  });

  it("protects both the admin Placard and its legacy local entry page", () => {
    expect(isAdminRestrictedPage("/admin/placard")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard/card-back.webp")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard/characters/sylvain.webp")).toBe(true);
    expect(isAdminRestrictedPage("/dev/placard-preview")).toBe(false);
    expect(isAdminRestrictedPage("/arene")).toBe(false);
  });
});
