import { describe, expect, it } from "vitest";
import { normalizeProductAnalysisPath, normalizeProductVideoPath } from "@/lib/product-media-paths";

describe("product media path normalization", () => {
  it("accepts safe public and remote media paths", () => {
    expect(normalizeProductAnalysisPath("/uploads/product-analyses/report.pdf")).toBe("/uploads/product-analyses/report.pdf");
    expect(normalizeProductAnalysisPath("https://cdn.example.com/report.pdf?token=1")).toBe("https://cdn.example.com/report.pdf?token=1");
    expect(normalizeProductVideoPath("/uploads/product-videos/demo.mp4")).toBe("/uploads/product-videos/demo.mp4");
    expect(normalizeProductVideoPath("https://cdn.example.com/demo.mov?token=1")).toBe("https://cdn.example.com/demo.mov?token=1");
  });

  it("rejects traversal, unsupported extensions, and unsafe protocols", () => {
    expect(normalizeProductAnalysisPath("/uploads/../secret.pdf")).toBeUndefined();
    expect(normalizeProductAnalysisPath("javascript:report.pdf")).toBeUndefined();
    expect(normalizeProductVideoPath("/uploads/product-videos/demo.exe")).toBeUndefined();
    expect(normalizeProductVideoPath("file:///tmp/demo.mp4")).toBeUndefined();
  });
});
