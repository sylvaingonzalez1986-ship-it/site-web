import { describe, expect, it } from "vitest";
import { getKqFeedbackTone } from "@/lib/kanab-quest-feedback";

describe("Kanab Quest feedback tone", () => {
  it("recognizes confirmations, warnings and actionable errors", () => {
    expect(getKqFeedbackTone("Lancer confirmé par le serveur.")).toBe("success");
    expect(getKqFeedbackTone("Collection dormante · activation en attente.")).toBe("warning");
    expect(getKqFeedbackTone("Aucune copie physique disponible.")).toBe("error");
    expect(getKqFeedbackTone("La culture a évolué. Recharge la partie.")).toBe("error");
  });
});
