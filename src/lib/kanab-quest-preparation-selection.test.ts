import { describe, expect, it } from "vitest";
import { getKqVerifiedPreparationHeritages, reconcileKqPreparationSelection } from "./kanab-quest-preparation-selection";

describe("preparation ownership reconciliation", () => {
  it("retains exact order and copies when the inventory is unknown", () => {
    const choice = { deckCodes: ["BOTTE-003", "BOTTE-003", "BOTTE-017"], heritageCode: "HERITAGE" };
    expect(reconcileKqPreparationSelection(choice, null, null)).toEqual({ selection: choice, removedCopies: 0, removedHeritage: false });
  });
  it.each([NaN, Infinity, -1, 0.5])("does not turn a malformed count %s into a removal", count => {
    const choice = { deckCodes: ["BOTTE-003"], heritageCode: null };
    expect(reconcileKqPreparationSelection(choice, { "BOTTE-003": count }, null).selection).toEqual(choice);
  });
  it("removes only excess copies and unavailable cards without replacing them", () => {
    const choice = { deckCodes: ["BOTTE-003", "BOTTE-017", "BOTTE-003", "BOTTE-005", "BOTTE-001"], heritageCode: "OWNED" };
    expect(reconcileKqPreparationSelection(choice, { "BOTTE-003": 1, "BOTTE-017": 1, "BOTTE-001": 2, "BOTTE-006": 10 }, ["OWNED"]))
      .toEqual({ selection: { deckCodes: ["BOTTE-003", "BOTTE-017"], heritageCode: "OWNED" }, removedCopies: 3, removedHeritage: false });
  });
  it("preserves an explicitly empty deck and no heritage despite available cards", () => {
    const choice = { deckCodes: [], heritageCode: null };
    expect(reconcileKqPreparationSelection(choice, { "BOTTE-003": 4 }, ["OWNED"]).selection).toEqual(choice);
  });
  it("distinguishes a confirmed empty collection from failed ownership reads", () => {
    const choice = { deckCodes: ["BOTTE-003"], heritageCode: "OLD" };
    expect(reconcileKqPreparationSelection(choice, {}, [])).toEqual({ selection: { deckCodes: [], heritageCode: null }, removedCopies: 1, removedHeritage: true });
  });
  it("retains heritage when only the deck can be verified", () => {
    expect(reconcileKqPreparationSelection({ deckCodes: ["BOTTE-003"], heritageCode: "OLD" }, {}, null).selection)
      .toEqual({ deckCodes: [], heritageCode: "OLD" });
  });
  it("does not mutate the supplied draft", () => {
    const choice = { deckCodes: ["BOTTE-003"], heritageCode: "OLD" };
    reconcileKqPreparationSelection(choice, {}, []);
    expect(choice).toEqual({ deckCodes: ["BOTTE-003"], heritageCode: "OLD" });
  });
});

describe("confirmed heritage catalogue", () => {
  it("accepts an explicit empty catalogue and filters inactive or unowned cards", () => {
    expect(getKqVerifiedPreparationHeritages([])).toEqual([]);
    expect(getKqVerifiedPreparationHeritages([
      { code: "YES", isActive: true, ownedCopies: 1 }, { code: "OLD", isActive: false, ownedCopies: 3 },
      { code: "NO", isActive: true, ownedCopies: 0 },
    ])).toEqual(["YES"]);
  });
  it.each([undefined, null, {}, [null], [{ code: "A", isActive: true }], [{ code: "A", isActive: true, ownedCopies: "1" }],
    [{ code: "A", isActive: true, ownedCopies: -1 }], [{ code: "A", isActive: true, ownedCopies: 1 }, { code: "A", isActive: false, ownedCopies: 0 }]])
  ("treats incomplete or ambiguous ownership as unknown: %j", cards => {
    expect(getKqVerifiedPreparationHeritages(cards)).toBeNull();
  });
});
