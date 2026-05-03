import { describe, expect, it } from "vitest";
import {
  countReplacementCharacters,
  repairLikelyMojibake,
  sanitizeDisplayText,
  sanitizeNestedText,
} from "@/lib/text-encoding-repair";

describe("text encoding repair", () => {
  it("keeps valid French text unchanged", () => {
    expect(sanitizeDisplayText("Résines françaises, préparées en Bretagne.")).toBe(
      "Résines françaises, préparées en Bretagne.",
    );
  });

  it("repairs common UTF-8 decoded as latin1 mojibake", () => {
    expect(repairLikelyMojibake("RÃ©sines franÃ§aises, prÃ©parÃ©es en Bretagne.")).toBe(
      "Résines françaises, préparées en Bretagne.",
    );
  });

  it("repairs nested CMS content without changing non-string values", () => {
    const repaired = sanitizeNestedText({
      boutique: {
        copainsSectionTitle: "Coin des copains sÃ©lectionnÃ©s",
        visible: true,
        blocks: ["QualitÃ©", 3],
      },
    });

    expect(repaired).toEqual({
      boutique: {
        copainsSectionTitle: "Coin des copains sélectionnés",
        visible: true,
        blocks: ["Qualité", 3],
      },
    });
  });

  it("counts unrecoverable replacement characters in nested content", () => {
    expect(
      countReplacementCharacters({
        title: "F�vrier",
        sections: [{ body: "Troisi�me nuit d'affil�e" }],
      }),
    ).toBe(3);
  });
});
