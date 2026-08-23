import { describe, expect, it } from "vitest";
import {
  isAdminRestrictedPage,
  isRecognizedCrawlerUserAgent,
  shouldEnforceAgeGate,
  shouldValidateMutativeOrigin,
} from "../middleware";

describe("middleware policy helpers", () => {
  it("enforces the age gate on contest pages", () => {
    expect(shouldEnforceAgeGate("/arene")).toBe(true);
    expect(shouldEnforceAgeGate("/arene/lot-premium")).toBe(true);
    expect(shouldEnforceAgeGate("/arene/profils/testeur")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours/lot-premium")).toBe(true);
    expect(shouldEnforceAgeGate("/bete-de-concours/profils/testeur")).toBe(true);
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
