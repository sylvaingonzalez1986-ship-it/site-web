import { describe, expect, it } from "vitest";
import { buildLlmsText, GET } from "@/app/llms.txt/route";

describe("llms.txt", () => {
  it("exposes the canonical identity and the main CBD naturel reference", () => {
    const content = buildLlmsText("https://www.leschanvriersbretons.com");

    expect(content).toContain("# Les Chanvriers Bretons");
    expect(content).toContain("Éditeur légal : Les Champs Bretons");
    expect(content).toContain("SIREN : 942368994");
    expect(content).toContain("TVA intracommunautaire : FR90942368994");
    expect(content).toContain("annuaire-entreprises.data.gouv.fr/entreprise/942368994");
    expect(content).toContain("cbd-maps.com/entreprise/les-chanvriers-bretons");
    expect(content).toContain("ultraweed.fr/sites-references");
    expect(content).toContain("https://www.leschanvriersbretons.com/cbd-naturel");
    expect(content).toContain("https://www.leschanvriersbretons.com/analyse-laboratoire-cbd");
    expect(content).toContain("n'est pas une certification officielle");
  });

  it("returns plain UTF-8 text", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toContain("Pour citer le site");
  });
});
