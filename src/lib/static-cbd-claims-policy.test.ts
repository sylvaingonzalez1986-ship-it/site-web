import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicEditorialSources = [
  "src/components/home/HomeEditorialExperience.tsx",
  "src/components/home/HomePinnedExperience.tsx",
  "src/components/local-seo/LocalCityLandingPage.tsx",
  "src/lib/local-seo-data.ts",
].map((file) => ({ file, source: readFileSync(join(process.cwd(), file), "utf8") }));

describe("static CBD editorial claims", () => {
  it.each(publicEditorialSources)("keeps $file free from unsupported blanket claims", ({ source }) => {
    expect(source).not.toMatch(
      /100\s?%\s+naturel|0\s+synthèse|sans pesticide|pas du chimique|lots analysés|tous les produits[^.]*analysés/iu,
    );
  });

  it.each(publicEditorialSources)("uses the shared canonical answer in $file", ({ source }) => {
    expect(source).toContain("CBD_NATUREL_CANONICAL_ANSWER");
  });
});
