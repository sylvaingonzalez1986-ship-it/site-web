import { describe, expect, it } from "vitest";
import type { KqCommerceRawLot, KqCommerceStock } from "./kanab-quest-commerce";
import { getKqCommerceFlowerSelection } from "./kanab-quest-commerce-lot-selection";

const raw = (flowerId: string): KqCommerceRawLot => ({ flowerId, varietyName: "Cherry Abacus", juryScore: 8, harvestGrams: 300, options: [] });
const stock = (flowerId: string, remainingUnits = 100): KqCommerceStock => ({
  id: `stock-${flowerId}`, flowerId, name: "Cherry Abacus", route: "raw", batchRoute: "raw", juryScore: 8,
  initialUnits: 100, remainingUnits, equivalentUnits: 100, originalUnits: 100, baseUnitCents: 300,
  repExact: 0, repRounded: 0, professionalUnits: 0, counted: false,
});

describe("verdict harvest selection at the counter", () => {
  it("keeps two identically named harvests distinct regardless of their list order", () => {
    expect(getKqCommerceFlowerSelection({ rawLots: [raw("other"), raw("judged")], stocks: [] }, "judged"))
      .toEqual({ status: "selected", flowerId: "judged", selectedId: "raw:judged" });
  });

  it("finds the same harvest after preparation instead of the first stock available", () => {
    expect(getKqCommerceFlowerSelection({ rawLots: [raw("other")], stocks: [stock("other"), stock("judged")] }, "judged"))
      .toEqual({ status: "selected", flowerId: "judged", selectedId: "stock-judged" });
  });

  it("keeps the raw remainder available before other products from that same harvest", () => {
    expect(getKqCommerceFlowerSelection({ rawLots: [raw("judged")], stocks: [stock("judged")] }, "judged"))
      .toEqual({ status: "selected", flowerId: "judged", selectedId: "raw:judged" });
  });

  it("does not substitute a different harvest when the target is absent", () => {
    expect(getKqCommerceFlowerSelection({ rawLots: [raw("other")], stocks: [stock("other")] }, "judged"))
      .toEqual({ status: "missing", flowerId: "judged" });
  });

  it.each([0, -1, Number.NaN, Infinity])("does not direct to a stock without confirmed remaining units: %s", remaining => {
    expect(getKqCommerceFlowerSelection({ rawLots: [], stocks: [stock("judged", remaining), stock("other")] }, "judged"))
      .toEqual({ status: "missing", flowerId: "judged" });
  });

  it("leaves the generic counter unselected when no exact identity was supplied", () => {
    expect(getKqCommerceFlowerSelection({ rawLots: [raw("other")], stocks: [stock("other")] })).toEqual({ status: "none" });
  });

  it("restores the exact transformed product even when a raw remainder exists", () => {
    const otherProduct = { ...stock("judged"), id: "dry-sift-product", route: "dry-sift" as const };
    const snapshot = { rawLots: [raw("judged")], stocks: [stock("judged"), otherProduct] };
    expect(getKqCommerceFlowerSelection(snapshot, "judged", otherProduct.id))
      .toEqual({ status: "selected", flowerId: "judged", selectedId: otherProduct.id });
    expect(getKqCommerceFlowerSelection(snapshot, undefined, otherProduct.id))
      .toEqual({ status: "selected", flowerId: "judged", selectedId: otherProduct.id });
  });

  it("never replaces an explicit missing product with the harvest's raw remainder", () => {
    expect(getKqCommerceFlowerSelection({ rawLots: [raw("judged")], stocks: [stock("judged")] }, "judged", "missing-product"))
      .toEqual({ status: "missing", flowerId: "judged" });
  });

  it("rejects conflicting harvest and product identities", () => {
    expect(getKqCommerceFlowerSelection({ rawLots: [raw("other")], stocks: [stock("other")] }, "judged", "stock-other"))
      .toEqual({ status: "missing", flowerId: "judged" });
    expect(getKqCommerceFlowerSelection({ rawLots: [raw("other")], stocks: [] }, "judged", "raw:other"))
      .toEqual({ status: "missing", flowerId: "judged" });
  });

  it("does not restore a sold-out product when another product remains", () => {
    expect(getKqCommerceFlowerSelection({ rawLots: [], stocks: [{ ...stock("judged", 0), id: "empty" }, stock("judged")] }, "judged", "empty"))
      .toEqual({ status: "missing", flowerId: "judged" });
  });
});
