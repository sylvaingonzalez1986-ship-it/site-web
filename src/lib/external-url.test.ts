import { describe, expect, it } from "vitest";
import { normalizeExternalUrl } from "@/lib/external-url";

describe("external-url", () => {
  it("accepts valid http and https urls", () => {
    expect(normalizeExternalUrl("example.com/path")).toBe("https://example.com/path");
    expect(normalizeExternalUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("rejects dangerous or unsupported protocols", () => {
    expect(normalizeExternalUrl("javascript:alert(1)")).toBe("");
    expect(normalizeExternalUrl("data:text/html,hello")).toBe("");
    expect(normalizeExternalUrl("ftp://example.com/file")).toBe("");
  });

  it("rejects empty, relative, spaced, or overlong values", () => {
    expect(normalizeExternalUrl(undefined)).toBe("");
    expect(normalizeExternalUrl("/relative-path")).toBe("");
    expect(normalizeExternalUrl("https://example.com/with space")).toBe("");
    expect(normalizeExternalUrl(`https://example.com/${"x".repeat(600)}`)).toHaveLength(512);
  });
});