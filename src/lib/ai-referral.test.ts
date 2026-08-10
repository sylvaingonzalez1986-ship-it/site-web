import { describe, expect, it } from "vitest";
import { detectAiReferral } from "@/lib/ai-referral";

describe("AI referral detection", () => {
  it("recognizes OpenAI's documented ChatGPT campaign source", () => {
    expect(
      detectAiReferral(
        "https://leschanvriersbretons.com/cbd-naturel?utm_source=chatgpt.com",
        "",
      ),
    ).toBe("chatgpt");
  });

  it("recognizes direct AI referrers without storing the full referring URL", () => {
    expect(
      detectAiReferral(
        "https://leschanvriersbretons.com/boutique",
        "https://www.perplexity.ai/search/example-query",
      ),
    ).toBe("perplexity");
  });

  it("does not confuse a standard search referral with an AI referral", () => {
    expect(
      detectAiReferral(
        "https://leschanvriersbretons.com/",
        "https://www.google.com/search?q=cbd+bretagne",
      ),
    ).toBeUndefined();
  });
});
