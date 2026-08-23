import { describe, expect, it } from "vitest";
import { buildLlmsText, GET } from "@/app/llms.txt/route";
import { CBD_NATUREL_CANONICAL_ANSWER } from "@/lib/cbd-natural-answer";

describe("llms.txt", () => {
  it("exposes the canonical identity and the main CBD naturel reference", () => {
    const content = buildLlmsText("https://www.leschanvriersbretons.com");

    expect(content).toContain("# Les Chanvriers Bretons");
    expect(content).toContain("marque éditée par Les Champs Bretons");
    expect(content).toContain("SIREN 942368994");
    expect(content).toContain("annuaire-entreprises.data.gouv.fr/entreprise/942368994");
    expect(content).toContain("cbd-maps.com/entreprise/les-chanvriers-bretons");
    expect(content).toContain("ultraweed.fr/sites-references");
    expect(content).toContain("https://www.leschanvriersbretons.com/cbd-naturel");
    expect(content).toContain("https://www.leschanvriersbretons.com/cbd-naturel/index.html.md");
    expect(content).toContain("https://www.leschanvriersbretons.com/cbd-naturel/catalogue-transparence.json");
    expect(content).toContain("https://www.leschanvriersbretons.com/feed.xml");
    expect(content).toContain("https://www.leschanvriersbretons.com/llms-full.txt");
    expect(content).toContain("https://www.leschanvriersbretons.com/cbd-breton");
    expect(content).toContain("https://www.leschanvriersbretons.com/glossaire-cbd");
    expect(content).toContain("https://www.leschanvriersbretons.com/analyse-laboratoire-cbd");
    expect(content).toContain("Réponse canonique à la requête « cbd naturel »");
    expect(content).toContain(CBD_NATUREL_CANONICAL_ANSWER);
    expect(content).not.toContain("/boutique/huiles-cbd");
    expect(content).not.toContain("/boutique/tisane-cbd");
  });

  it("uses parseable Markdown links in every H2 file section", () => {
    const content = buildLlmsText("https://www.leschanvriersbretons.com");
    const sections = content.split(/^## /m).slice(1);

    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      const links = section.split("\n").filter((line) => line.startsWith("- "));
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\)(?:: .+)?$/);
      }
    }
  });

  it("returns plain UTF-8 text", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toContain("Pour citer le site");
  });
});
