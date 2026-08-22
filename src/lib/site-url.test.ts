import { afterEach, describe, expect, it, vi } from "vitest";
import { CANONICAL_SITE_URL, getSiteUrl } from "@/lib/site-url";

describe("site URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the public www host as the canonical origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(CANONICAL_SITE_URL).toBe("https://www.leschanvriersbretons.com");
    expect(getSiteUrl()).toBe(CANONICAL_SITE_URL);
  });

  it.each([
    "https://leschanvriersbretons.com",
    "https://www.leschanvriersbretons.com/une-page",
  ])("normalizes %s to the public canonical origin", (configuredUrl) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", configuredUrl);

    expect(getSiteUrl()).toBe(CANONICAL_SITE_URL);
  });

  it("preserves a valid non-production origin for previews and tests", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example.test/a-path");

    expect(getSiteUrl()).toBe("https://preview.example.test");
  });

  it("falls back to the canonical origin when configuration is invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a URL");

    expect(getSiteUrl()).toBe(CANONICAL_SITE_URL);
  });
});
