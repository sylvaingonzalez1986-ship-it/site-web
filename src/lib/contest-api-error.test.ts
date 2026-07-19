import { describe, expect, it } from "vitest";
import { getPublicContestError } from "@/lib/contest-api-error";

describe("getPublicContestError", () => {
  it("preserves safe business errors", () => {
    expect(getPublicContestError(new Error("Achat requis pour noter ce lot."), "Erreur."))
      .toBe("Achat requis pour noter ce lot.");
  });

  it("hides database and Supabase details", () => {
    expect(getPublicContestError(new Error("[supabase:rpc] relation contest_reviews failed"), "Erreur publique."))
      .toBe("Erreur publique.");
    expect(getPublicContestError(new Error("constraint 23505"), "Erreur publique."))
      .toBe("Erreur publique.");
  });

  it("bounds public messages", () => {
    expect(getPublicContestError(new Error("x".repeat(500)), "Erreur.")).toHaveLength(240);
  });
});
