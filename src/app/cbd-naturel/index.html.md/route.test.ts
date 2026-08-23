import { describe, expect, it } from "vitest";
import { GET } from "@/app/cbd-naturel/index.html.md/route";
import { CBD_NATUREL_CANONICAL_ANSWER } from "@/lib/cbd-natural-answer";

describe("CBD naturel Markdown alternate", () => {
  it("returns the canonical answer with an HTTP canonical link", async () => {
    const response = GET();
    const content = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("link")).toBe(
      '<https://www.leschanvriersbretons.com/cbd-naturel>; rel="canonical"',
    );
    expect(content).toContain(CBD_NATUREL_CANONICAL_ANSWER);
    expect(content).toContain("## Critères de vérification");
    expect(content).toContain("## Sources publiques");
  });
});
