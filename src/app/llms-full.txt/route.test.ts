import { describe, expect, it } from "vitest";
import { GET } from "@/app/llms-full.txt/route";
import { CBD_NATUREL_CANONICAL_ANSWER } from "@/lib/cbd-natural-answer";

describe("llms-full.txt", () => {
  it("returns a self-contained sourced context", async () => {
    const response = GET();
    const content = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(content).toContain(CBD_NATUREL_CANONICAL_ANSWER);
    expect(content).toContain("Les Champs Bretons");
    expect(content).toContain("https://www.drogues.gouv.fr/le-cbd");
    expect(content).toContain("cbd-maps.com/entreprise/les-chanvriers-bretons");
    expect(content).toContain("La fiche produit est prioritaire");
  });
});
