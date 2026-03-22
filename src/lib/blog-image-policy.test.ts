import { describe, expect, it } from "vitest";
import { isSupportedBlogImageMimeType } from "@/lib/blog-image-policy";

describe("blog-image-policy", () => {
  it("accepts the supported image mime types", () => {
    expect(isSupportedBlogImageMimeType("image/jpeg")).toBe(true);
    expect(isSupportedBlogImageMimeType("image/png")).toBe(true);
    expect(isSupportedBlogImageMimeType("image/webp")).toBe(true);
  });

  it("rejects unsupported mime types", () => {
    expect(isSupportedBlogImageMimeType("image/gif")).toBe(false);
    expect(isSupportedBlogImageMimeType("image/svg+xml")).toBe(false);
    expect(isSupportedBlogImageMimeType("application/pdf")).toBe(false);
  });
});