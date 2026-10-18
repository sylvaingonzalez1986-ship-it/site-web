import type { NextConfig } from "next";
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@next/bundle-analyzer", () => ({
  default: () => (config: NextConfig) => config,
}));
vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: NextConfig) => config,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Supabase image origin allowlist", () => {
  it("optimizes public storage images only from the configured project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://configured-project.supabase.co/");
    const { default: config } = await import("../next.config");
    const isAllowed = (value: string) => hasRemoteMatch([], config.images!.remotePatterns!, new URL(value));

    expect(isAllowed("https://configured-project.supabase.co/storage/v1/object/public/products/image.webp")).toBe(true);
    expect(isAllowed("https://configured-project.supabase.co/storage/v1/object/public/products/image.webp?v=2")).toBe(true);
    expect(isAllowed("https://other-project.supabase.co/storage/v1/object/public/products/image.webp")).toBe(false);
    expect(isAllowed("https://eyowwwpdmfrulhkpvlnf.supabase.co/storage/v1/object/public/products/image.webp")).toBe(false);
    expect(isAllowed("https://child.configured-project.supabase.co/storage/v1/object/public/products/image.webp")).toBe(false);
    expect(isAllowed("https://configured-project.supabase.co:8443/storage/v1/object/public/products/image.webp")).toBe(false);
    expect(isAllowed("http://configured-project.supabase.co/storage/v1/object/public/products/image.webp")).toBe(false);
    expect(isAllowed("https://configured-project.supabase.co/storage/v1/object/sign/products/image.webp")).toBe(false);
    expect(isAllowed("https://static.wixstatic.com/media/image.webp")).toBe(true);
    expect(isAllowed("https://files.cdn.printful.com/image.webp")).toBe(true);
  });

  it("keeps local Supabase development limited to its configured port", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321/");
    const { default: config } = await import("../next.config");
    const isAllowed = (value: string) => hasRemoteMatch([], config.images!.remotePatterns!, new URL(value));
    expect(isAllowed("http://127.0.0.1:54321/storage/v1/object/public/products/image.webp")).toBe(true);
    expect(isAllowed("http://127.0.0.1:54322/storage/v1/object/public/products/image.webp")).toBe(false);
  });

  it.each([
    "https://*.supabase.co",
    "https://user:password@configured-project.supabase.co",
    "data:text/plain,invalid",
  ])("refuses a broad or invalid origin configuration: %s", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    await expect(import("../next.config")).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});
