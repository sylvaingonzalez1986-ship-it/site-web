import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CBD_NATUREL_CANONICAL_ANSWER } from "@/lib/cbd-natural-answer";
import { getCityFaq, LOCAL_SEO_LAST_REVIEWED } from "@/lib/local-seo-data";

const localLandingSource = readFileSync(
  join(process.cwd(), "src/components/local-seo/LocalCityLandingPage.tsx"),
  "utf8",
);

describe("local SEO editorial data", () => {
  it("builds factual, city-specific answers", () => {
    const faq = getCityFaq("cbd-rennes");
    const content = JSON.stringify(faq);

    expect(faq).toHaveLength(3);
    expect(content).toContain("Rennes");
    expect(content).toContain("producteurs partenaires");
    expect(content).toContain(CBD_NATUREL_CANONICAL_ANSWER);
    expect(content).not.toMatch(/100\s?%|sans pesticide|efficacit[ée]|bienfaits/i);
  });

  it("does not reuse another city's answers for an unknown slug", () => {
    expect(getCityFaq("cbd-ville-inconnue")).toEqual([]);
  });

  it("exposes an ISO review date for page and sitemap metadata", () => {
    expect(LOCAL_SEO_LAST_REVIEWED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reserves the generic CBD naturel primary heading for the pillar page", () => {
    expect(localLandingSource).toContain("CBD à {cityData.name} : livraison et traçabilité");
    expect(localLandingSource).not.toMatch(/<h1[^>]*>CBD Naturel/iu);
    expect(localLandingSource).not.toContain("CBD naturel : la définition utilisée sur ce site");
  });
});
