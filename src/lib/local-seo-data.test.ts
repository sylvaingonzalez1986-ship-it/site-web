import { describe, expect, it } from "vitest";
import { getCityFaq, LOCAL_SEO_LAST_REVIEWED } from "@/lib/local-seo-data";

describe("local SEO editorial data", () => {
  it("builds factual, city-specific answers", () => {
    const faq = getCityFaq("cbd-rennes");
    const content = JSON.stringify(faq);

    expect(faq).toHaveLength(3);
    expect(content).toContain("Rennes");
    expect(content).toContain("producteurs partenaires");
    expect(content).toContain("n'est pas un label officiel");
    expect(content).not.toMatch(/100\s?%|sans pesticide|efficacit[ée]|bienfaits/i);
  });

  it("does not reuse another city's answers for an unknown slug", () => {
    expect(getCityFaq("cbd-ville-inconnue")).toEqual([]);
  });

  it("exposes an ISO review date for page and sitemap metadata", () => {
    expect(LOCAL_SEO_LAST_REVIEWED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
