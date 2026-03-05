import { describe, expect, it } from "vitest";
import { computeReadingTimeMinutes } from "@/lib/reading-time";

describe("computeReadingTimeMinutes", () => {
  it("returns 1 for empty content", () => {
    expect(computeReadingTimeMinutes("")).toBe(1);
  });

  it("returns rounded-up reading time", () => {
    const text = new Array(401).fill("mot").join(" ");
    expect(computeReadingTimeMinutes(text)).toBe(3);
  });
});
