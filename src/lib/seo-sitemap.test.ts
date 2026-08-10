import { describe, expect, it } from "vitest";
import { mostRecentSeoDate, parseSeoDate } from "@/lib/seo-sitemap";

describe("SEO sitemap dates", () => {
  it("keeps a valid modification date", () => {
    expect(parseSeoDate("2026-08-09T10:00:00.000Z")?.toISOString()).toBe(
      "2026-08-09T10:00:00.000Z",
    );
  });

  it("omits missing or invalid dates instead of inventing the current time", () => {
    expect(parseSeoDate(undefined)).toBeUndefined();
    expect(parseSeoDate("not-a-date")).toBeUndefined();
  });

  it("selects the most recent trustworthy date", () => {
    expect(
      mostRecentSeoDate([
        "2026-07-01T00:00:00.000Z",
        undefined,
        "2026-08-09T12:30:00.000Z",
      ])?.toISOString(),
    ).toBe("2026-08-09T12:30:00.000Z");
  });
});
