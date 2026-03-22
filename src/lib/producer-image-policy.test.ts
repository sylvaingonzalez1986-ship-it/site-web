import { describe, expect, it } from "vitest";
import { isSupportedProducerImageMimeType } from "@/lib/producer-image-policy";

describe("producer-image-policy", () => {
  it("accepts the supported producer image mime types", () => {
    expect(isSupportedProducerImageMimeType("image/jpeg")).toBe(true);
    expect(isSupportedProducerImageMimeType("image/png")).toBe(true);
    expect(isSupportedProducerImageMimeType("image/webp")).toBe(true);
  });

  it("rejects unsupported mime types", () => {
    expect(isSupportedProducerImageMimeType("image/gif")).toBe(false);
    expect(isSupportedProducerImageMimeType("text/plain")).toBe(false);
  });
});